"""Separate read-only device authentication; never grants a management login."""

import hashlib
import io
import ipaddress
import json
import secrets
import uuid
from datetime import date, datetime, time, timedelta
from urllib.parse import urlsplit
from zoneinfo import ZoneInfo

import qrcode
import qrcode.image.svg
from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.core import signing
from django.db import IntegrityError, transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.cache import never_cache
from rest_framework import serializers
from rest_framework.authentication import BaseAuthentication, get_authorization_header
from rest_framework.decorators import (
    api_view,
    authentication_classes,
    permission_classes,
    throttle_classes,
)
from rest_framework.exceptions import AuthenticationFailed, PermissionDenied
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import SimpleRateThrottle

from . import models as m
from .overview import enrich_snapshot, matches_scope
from .services import dt, latest_publications, public_row
from .student_push import push_configured, queue_notice_push
from .teacher_availability import overlay_cancellations
from .views import bump, lock_tenant, tenant


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


def valid_qr_key(access, key):
    if access.person_id:
        return False
    if secrets.compare_digest(access.qr_hash, digest(key)):
        return True
    try:
        return signing.Signer(salt="planner.student-access.qr").unsign(key) == str(
            access.id
        )
    except signing.BadSignature:
        return False


class DeviceAuthentication(BaseAuthentication):
    def authenticate_header(self, request):
        return "Bearer"

    def authenticate(self, request):
        header = get_authorization_header(request).split()
        if len(header) != 2 or header[0].lower() != b"bearer":
            raise AuthenticationFailed("Bitte erneut mit dem Gruppenzugang anmelden.")
        try:
            token = header[1].decode("ascii")
        except UnicodeDecodeError as exc:
            raise AuthenticationFailed("Ungültiger Zugang.") from exc
        session = (
            m.StudentDeviceSession.objects.select_related(
                "access__institution",
                "access__group",
                "access__cohort",
                "access__person",
            )
            .filter(
                token_hash=digest(token),
                expires__gt=timezone.now(),
                access__active=True,
            )
            .first()
        )
        if not session:
            raise AuthenticationFailed("Der Zugang ist abgelaufen oder gesperrt.")
        if (
            session.access.person_id
            and session.access.person.institution_id != session.access.institution_id
        ):
            raise AuthenticationFailed("Ungültiger Zugang.")
        return session.access, session


class LoginThrottle(SimpleRateThrottle):
    scope = "student_login"
    # A whole cohort can log in behind one campus Wi-Fi address.
    rate = "120/min"

    def get_cache_key(self, request, view):
        return self.cache_format % {
            "scope": self.scope,
            "ident": self.get_ident(request),
        }


class LoginInput(serializers.Serializer):
    code = serializers.CharField(max_length=80, required=False)
    password = serializers.CharField(
        max_length=256, required=False, trim_whitespace=False
    )
    access = serializers.UUIDField(required=False)
    key = serializers.CharField(max_length=100, required=False)

    def validate(self, attrs):
        manual = "code" in attrs and "password" in attrs
        qr = "access" in attrs and "key" in attrs
        if manual == qr:
            raise serializers.ValidationError(
                "Zugangscode und Passwort oder QR-Code angeben."
            )
        return attrs


def profile(access):
    scope = (
        access.person
        if access.person_id
        else access.group
        if access.group_id
        else access.cohort
    )
    return {
        "institution": access.institution.name,
        "scope": scope.name,
        "scope_kind": "person"
        if access.person_id
        else "group"
        if access.group_id
        else "cohort",
        "password_change_required": access.must_change_password,
        "timezone": access.institution.timezone,
    }


def issue_session(access):
    token = secrets.token_urlsafe(32)
    expires = timezone.now() + timedelta(days=90)
    m.StudentDeviceSession.objects.create(
        access=access, token_hash=digest(token), expires=expires
    )
    return {"token": token, "expires": expires, **profile(access)}


def require_password_ready(access):
    if access.must_change_password:
        raise PermissionDenied(
            {
                "detail": "Bitte zuerst dein Startpasswort ändern.",
                "code": "password_change_required",
            }
        )


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
@throttle_classes([LoginThrottle])
def login(request):
    payload = LoginInput(data=request.data)
    payload.is_valid(raise_exception=True)
    values = payload.validated_data
    with transaction.atomic():
        query = (
            {"pk": values["access"]}
            if "access" in values
            else {"code": values["code"].lower()}
        )
        access = (
            m.StudentAccess.objects.select_for_update()
            .filter(**query, active=True)
            .first()
        )
        valid = (
            valid_qr_key(access, values["key"])
            if access and "key" in values
            else check_password(
                values.get("password", ""),
                access.password_hash if access else make_password(None),
            )
        )
        if not access or not valid:
            return Response(
                {"detail": "Zugangscode, Passwort oder QR-Code ist ungültig."},
                status=401,
            )
        # Old device sessions are expired, not retained indefinitely.
        m.StudentDeviceSession.objects.filter(expires__lte=timezone.now()).delete()
        return Response(issue_session(access))


@api_view(["POST"])
@authentication_classes([DeviceAuthentication])
def logout(request):
    request.auth.delete()
    return Response(status=204)


class PushInput(serializers.Serializer):
    token = serializers.RegexField(r"\A(?:[a-fA-F0-9]{2}){16,256}\Z", max_length=512)
    environment = serializers.ChoiceField(choices=["sandbox", "production"])
    topic = serializers.CharField(max_length=255)


@never_cache
@api_view(["POST", "DELETE"])
@authentication_classes([DeviceAuthentication])
def push_registration(request):
    require_password_ready(request.user)
    with transaction.atomic():
        device = get_object_or_404(
            m.StudentDeviceSession.objects.select_for_update(), pk=request.auth.pk
        )
        if request.method == "DELETE":
            device.push_token = None
            device.push_binding = uuid.uuid4()
            device.save(update_fields=["push_token", "push_binding"])
            return Response(status=204)
        payload = PushInput(data=request.data)
        payload.is_valid(raise_exception=True)
        if not push_configured():
            return Response(
                {"detail": "Push ist auf diesem Server noch nicht eingerichtet."},
                status=503,
            )
        values = payload.validated_data
        if (
            values["environment"] != settings.APNS_ENVIRONMENT
            or values["topic"] != settings.APNS_TOPIC
        ):
            raise serializers.ValidationError(
                "App-Signierung und Push-Server passen nicht zusammen."
            )
        token = values["token"].lower()
        # A device belongs to its latest authenticated session, including across institutions.
        m.StudentDeviceSession.objects.filter(push_token=token).exclude(
            pk=device.pk
        ).update(push_token=None, push_binding=uuid.uuid4())
        if device.push_token != token:
            device.push_token = token
            device.push_binding = uuid.uuid4()
            try:
                with transaction.atomic():
                    device.save(update_fields=["push_token", "push_binding"])
            except IntegrityError:
                raise serializers.ValidationError(
                    "Die Geräteanmeldung wurde gleichzeitig geändert. Bitte erneut versuchen."
                ) from None
        return Response({"binding": str(device.push_binding)})


@api_view(["GET"])
@authentication_classes([DeviceAuthentication])
def feed(request):
    access = request.user
    require_password_ready(access)
    institution = access.institution
    zone = ZoneInfo(institution.timezone)
    try:
        start = date.fromisoformat(request.query_params["start"])
        end = date.fromisoformat(request.query_params["end"])
    except (ValueError, KeyError) as exc:
        raise serializers.ValidationError(
            "Zeitraum als start/end im Format YYYY-MM-DD angeben."
        ) from exc
    if not 0 < (end - start).days <= 180:
        raise serializers.ValidationError(
            "Der Zeitraum muss 1 bis 180 Tage umfassen; end ist exklusiv."
        )
    first = datetime.combine(start, time.min, zone)
    last = datetime.combine(end, time.min, zone)
    scope = (
        {"group": str(access.group_id)}
        if access.group_id
        else {"cohort": str(access.cohort_id)}
    )
    rows = []
    personal_groups = (
        set(
            access.person.groups.filter(
                institution=institution, cohort__institution=institution
            ).values_list("id", flat=True)
        )
        if access.person_id and access.person.kind == "learner"
        else set()
    )
    for publication in latest_publications(institution):
        scoped = enrich_snapshot(publication.snapshot, institution.id)
        for row in overlay_cancellations(scoped, institution, publication.plan_id):
            if (
                (
                    (not access.person_id and matches_scope(row, scope))
                    or (
                        access.person_id
                        and access.person.kind == "teacher"
                        and access.person_id in row.get("teacher_ids", [])
                    )
                    or (
                        access.person_id
                        and access.person.kind == "learner"
                        and (
                            access.person_id in row.get(
                                "explicit_learner_ids",
                                row.get("learner_ids", []) if row.get("exam") else [],
                            )
                            or any(
                                group["id"] in personal_groups
                                for group in row["overview_scope"]["groups"]
                            )
                        )
                    )
                )
                and dt(row["start"]) < last
                and dt(row["end"]) > first
            ):
                rows.append(
                    {
                        "id": f"{publication.plan_id}:{row['id']}",
                        **public_row(row, True),
                    }
                )
    notice_scope = Q(group__isnull=True, cohort__isnull=True)
    if access.person_id:
        notice_scope |= Q(group_id__in=personal_groups) | Q(
            cohort_id__in=m.Group.objects.filter(id__in=personal_groups).values(
                "cohort_id"
            )
        )
    elif access.group_id:
        notice_scope |= Q(group_id=access.group_id) | Q(
            cohort_id=access.group.cohort_id
        )
    else:
        notice_scope |= Q(cohort_id=access.cohort_id) | Q(
            group__cohort_id=access.cohort_id
        )
    notices = (
        m.StudentNotice.objects.filter(institution=institution, active=True)
        .filter(notice_scope)
        .distinct()
    )
    return Response(
        {
            **profile(access),
            "updated": timezone.now(),
            "rows": sorted(rows, key=lambda row: (row["start"], row["id"])),
            "notices": list(
                notices.order_by("-created", "-id").values(
                    "id", "title", "body", "created"
                )[:100]
            ),
        }
    )


class ScopeInput(serializers.Serializer):
    group = serializers.PrimaryKeyRelatedField(
        queryset=m.Group.objects.none(), allow_null=True, required=False
    )
    cohort = serializers.PrimaryKeyRelatedField(
        queryset=m.Cohort.objects.none(), allow_null=True, required=False
    )

    def __init__(self, *args, institution, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["group"].queryset = m.Group.objects.filter(
            institution=institution, cohort__institution=institution
        )
        self.fields["cohort"].queryset = m.Cohort.objects.filter(
            institution=institution
        )

    def validate(self, attrs):
        if attrs.get("group") and attrs.get("cohort"):
            raise serializers.ValidationError(
                "Eine Gruppe oder einen Jahrgang auswählen."
            )
        return attrs


class ServerInput(serializers.Serializer):
    server = serializers.URLField(max_length=500)

    def validate_server(self, value):
        parsed = urlsplit(value)
        if (
            parsed.scheme not in ("https", "http")
            or parsed.username
            or parsed.password
            or parsed.query
            or parsed.fragment
            or parsed.path not in ("", "/")
        ):
            raise serializers.ValidationError(
                "Serveradresse als http(s)://host[:port] ohne Pfad angeben."
            )
        host = (parsed.hostname or "").lower()
        try:
            address = ipaddress.ip_address(host)
            local = any(
                address in ipaddress.ip_network(network)
                for network in (
                    "10.0.0.0/8",
                    "172.16.0.0/12",
                    "192.168.0.0/16",
                    "127.0.0.0/8",
                )
            )
        except ValueError:
            local = host == "localhost" or host.endswith(".local")
        if parsed.scheme == "http" and not local:
            raise serializers.ValidationError(
                "Für öffentlich erreichbare Server ist HTTPS erforderlich."
            )
        return value.rstrip("/")


class AccessInput(ScopeInput, ServerInput):
    def validate(self, attrs):
        attrs = super().validate(attrs)
        if not attrs.get("group") and not attrs.get("cohort"):
            raise serializers.ValidationError("Gruppe oder Jahrgang fehlt.")
        return attrs


class NoticeInput(ScopeInput):
    title = serializers.CharField(max_length=160)
    body = serializers.CharField(max_length=5000)


def access_row(access):
    scope = access.group if access.group_id else access.cohort
    return {
        "id": access.id,
        "code": access.code,
        "scope": scope.name,
        "active": access.active,
        "created": access.created,
        "server": access.server,
        "group": access.group_id,
        "cohort": access.cohort_id,
    }


def qr_credentials(access):
    # A scoped signature makes the QR reproducible without storing its secret.
    key = signing.Signer(salt="planner.student-access.qr").sign(str(access.id))
    qr = json.dumps(
        {
            "version": 1,
            "server": access.server,
            "access": str(access.id),
            "key": key,
        },
        separators=(",", ":"),
    )
    output = io.BytesIO()
    qrcode.make(qr, image_factory=qrcode.image.svg.SvgPathImage, box_size=8).save(
        output
    )
    return {
        **access_row(access),
        "qr_payload": qr,
        "qr_svg": output.getvalue().decode(),
    }


def credentials(access, server):
    password = secrets.token_urlsafe(12)
    access.password_hash = make_password(password)
    access.qr_hash = digest(
        signing.Signer(salt="planner.student-access.qr").sign(str(access.id))
    )
    access.server = server.rstrip("/")
    access.save()
    return {**qr_credentials(access), "password": password}


@never_cache
@api_view(["GET", "POST"])
def accesses(request):
    institution = tenant(request)
    if request.method == "GET":
        return Response(
            [
                access_row(access)
                for access in m.StudentAccess.objects.filter(
                    institution=institution, person__isnull=True
                )
                .select_related("group", "cohort")
                .order_by("-created")
            ]
        )
    with transaction.atomic():
        institution = lock_tenant(request)
        payload = AccessInput(data=request.data, institution=institution)
        payload.is_valid(raise_exception=True)
        values = payload.validated_data
        access = m.StudentAccess.objects.create(
            institution=institution,
            group=values.get("group"),
            cohort=values.get("cohort"),
            code=secrets.token_hex(6),
        )
        result = credentials(access, values["server"])
        bump(request, institution, "Studierenden-App: Gruppenzugang angelegt")
        return Response(result, status=201)


@never_cache
@api_view(["GET", "POST"])
def access_credentials(request, pk):
    with transaction.atomic():
        institution = (
            lock_tenant(request) if request.method == "POST" else tenant(request)
        )
        access = get_object_or_404(
            m.StudentAccess.objects.select_for_update(),
            pk=pk,
            institution=institution,
            active=True,
            person__isnull=True,
        )
        if request.method == "POST":
            payload = AccessInput(
                data={
                    "group": access.group_id,
                    "cohort": access.cohort_id,
                    "server": request.data.get("server"),
                },
                institution=institution,
            )
            payload.is_valid(raise_exception=True)
            access.server = payload.validated_data["server"].rstrip("/")
            access.save(update_fields=["server"])
        if not access.server:
            raise serializers.ValidationError(
                "Bitte zuerst die erreichbare Serveradresse ergänzen."
            )
        return Response(qr_credentials(access))


@api_view(["POST"])
def disable_access(request, pk):
    with transaction.atomic():
        institution = lock_tenant(request)
        access = get_object_or_404(
            m.StudentAccess, pk=pk, institution=institution, person__isnull=True
        )
        access.active = False
        access.save(update_fields=["active"])
        access.studentdevicesession_set.all().delete()
        bump(request, institution, "Studierenden-App: Gruppenzugang gesperrt")
    return Response(status=204)


@api_view(["GET", "POST"])
def notices(request):
    institution = tenant(request)
    if request.method == "GET":
        rows = (
            m.StudentNotice.objects.filter(institution=institution)
            .select_related("group", "cohort")
            .order_by("-created", "-id")[:100]
        )
        return Response(
            [
                {
                    "id": row.id,
                    "title": row.title,
                    "body": row.body,
                    "active": row.active,
                    "scope": row.group.name
                    if row.group_id
                    else row.cohort.name
                    if row.cohort_id
                    else "Alle Studierenden",
                    "created": row.created,
                }
                for row in rows
            ]
        )
    with transaction.atomic():
        institution = lock_tenant(request)
        payload = NoticeInput(data=request.data, institution=institution)
        payload.is_valid(raise_exception=True)
        notice = m.StudentNotice.objects.create(
            institution=institution, **payload.validated_data
        )
        queue_notice_push(notice)
        bump(request, institution, "Studierenden-App: Mitteilung veröffentlicht")
    return Response({"id": notice.id}, status=201)


@api_view(["POST"])
def withdraw_notice(request, pk):
    with transaction.atomic():
        institution = lock_tenant(request)
        notice = get_object_or_404(m.StudentNotice, pk=pk, institution=institution)
        notice.active = False
        notice.save(update_fields=["active"])
        bump(request, institution, "Studierenden-App: Mitteilung zurückgezogen")
    return Response(status=204)
