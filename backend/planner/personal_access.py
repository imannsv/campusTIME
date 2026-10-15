"""Personal app credentials share the existing device boundary, never management rights."""

import re
import secrets
import unicodedata

from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import check_password, make_password
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.cache import never_cache
from rest_framework import serializers
from rest_framework.decorators import api_view, authentication_classes, throttle_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.throttling import SimpleRateThrottle

from . import models as m
from .student_app import DeviceAuthentication, ServerInput, issue_session
from .views import bump, lock_tenant, tenant


def username_stem(value):
    value = value.casefold().replace("ä", "ae").replace("ö", "oe").replace("ü", "ue")
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9._-]+", ".", value).strip("._-")[:70]


def suggestion(person, source):
    name = (
        ".".join(part for part in (person.first_name, person.last_name) if part)
        or person.name
    )
    stem = username_stem(person.code if source == "identifier" else name)
    if len(stem) < 3:
        stem = f"{stem or 'person'}-{person.pk}"
    others = m.StudentAccess.objects.exclude(person=person)
    for suffix in ("", *(f".{n}" for n in range(2, 20))):
        candidate = stem + suffix
        if not others.filter(code=candidate).exists():
            return candidate
    return f"{stem}.{secrets.token_hex(4)}"


def state(person, access):
    result = {
        "exists": access is not None,
        "suggestions": {
            source: suggestion(person, source) for source in ("name", "identifier")
        },
    }
    if access:
        result.update(
            username=access.code,
            server=access.server,
            active=access.active,
            password_change_required=access.must_change_password,
        )
    return result


class AccessAction(serializers.Serializer):
    action = serializers.ChoiceField(choices=["create", "reset", "disable"])
    source = serializers.ChoiceField(choices=["name", "identifier"], default="name")
    username = serializers.RegexField(
        r"\A[a-z0-9][a-z0-9._-]{2,79}\Z", max_length=80, required=False
    )
    server = serializers.CharField(max_length=500, required=False)


@never_cache
@api_view(["GET", "POST"])
def person_access(request, pk):
    institution = tenant(request)
    if not m.Membership.objects.filter(
        user=request.user, institution=institution, role="admin"
    ).exists():
        raise PermissionDenied("Persönliche Zugänge kann nur die Verwaltung verwalten.")
    if request.method == "GET":
        person = get_object_or_404(m.Person, pk=pk, institution=institution)
        access = m.StudentAccess.objects.filter(
            person=person, institution=institution
        ).first()
        return Response(state(person, access))
    payload = AccessAction(data=request.data)
    payload.is_valid(raise_exception=True)
    values = payload.validated_data
    with transaction.atomic():
        institution = lock_tenant(request)
        person = get_object_or_404(
            m.Person.objects.select_for_update(), pk=pk, institution=institution
        )
        access = (
            m.StudentAccess.objects.select_for_update()
            .filter(person=person, institution=institution)
            .first()
        )
        action = values["action"]
        if action == "create" and access:
            raise serializers.ValidationError(
                "Die Person hat bereits einen Zugang. Nutze Passwort zurücksetzen."
            )
        if action != "create" and not access:
            raise serializers.ValidationError(
                "Für diese Person ist noch kein Zugang vorhanden."
            )
        if action == "disable":
            access.active = False
            access.save(update_fields=["active"])
            access.studentdevicesession_set.all().delete()
        else:
            server = values.get("server", access.server if access else "")
            address = ServerInput(data={"server": server})
            address.is_valid(raise_exception=True)
            password = secrets.token_urlsafe(15)
            password_hash = make_password(password)
            if action == "create":
                for _attempt in range(5):
                    username = values.get("username") or suggestion(
                        person, values["source"]
                    )
                    try:
                        with transaction.atomic():
                            access = m.StudentAccess.objects.create(
                                institution=institution,
                                person=person,
                                code=username,
                                password_hash=password_hash,
                                must_change_password=True,
                                server=address.validated_data["server"],
                            )
                        break
                    except IntegrityError:
                        if values.get("username"):
                            raise serializers.ValidationError(
                                "Dieser Benutzername ist bereits vergeben."
                            ) from None
                else:
                    raise serializers.ValidationError(
                        "Benutzername konnte nicht vergeben werden. Bitte erneut versuchen."
                    )
            else:
                access.password_hash = password_hash
                access.must_change_password = True
                access.active = True
                access.server = address.validated_data["server"]
                access.save(
                    update_fields=[
                        "password_hash",
                        "must_change_password",
                        "active",
                        "server",
                    ]
                )
                access.studentdevicesession_set.all().delete()
        bump(
            request,
            institution,
            f"Persönlicher App-Zugang: {action} für Person {person.pk}",
        )
        result = state(person, access)
        if action != "disable":
            result["password"] = password
        return Response(result, status=201 if action == "create" else 200)


class PasswordThrottle(SimpleRateThrottle):
    scope = "personal_password"
    rate = "10/min"

    def get_cache_key(self, request, view):
        return self.cache_format % {"scope": self.scope, "ident": request.auth.pk}


class PasswordInput(serializers.Serializer):
    current_password = serializers.CharField(max_length=256, trim_whitespace=False)
    new_password = serializers.CharField(
        min_length=10, max_length=256, trim_whitespace=False
    )


@never_cache
@api_view(["POST"])
@authentication_classes([DeviceAuthentication])
@throttle_classes([PasswordThrottle])
def change_password(request):
    with transaction.atomic():
        access = get_object_or_404(
            m.StudentAccess.objects.select_for_update().select_related(
                "person", "institution"
            ),
            pk=request.user.pk,
            active=True,
        )
        # Recheck the session after taking the same lock as login/reset.
        if not m.StudentDeviceSession.objects.filter(
            pk=request.auth.pk, access=access, expires__gt=timezone.now()
        ).exists():
            return Response({"detail": "Bitte erneut anmelden."}, status=401)
        if not access.person_id:
            raise PermissionDenied(
                "Ein gemeinsames Gruppenpasswort kann nur die Verwaltung ersetzen."
            )
        payload = PasswordInput(data=request.data)
        if not payload.is_valid():
            return Response(
                {
                    "detail": " ".join(
                        str(message)
                        for messages in payload.errors.values()
                        for message in messages
                    )
                },
                status=400,
            )
        values = payload.validated_data
        if not check_password(values["current_password"], access.password_hash):
            return Response({"detail": "Das aktuelle Passwort ist falsch."}, status=400)
        if values["current_password"] == values["new_password"]:
            return Response(
                {"detail": "Bitte ein anderes neues Passwort wählen."}, status=400
            )
        person = access.person
        user = get_user_model()(
            username=access.code,
            first_name=person.first_name,
            last_name=person.last_name,
            email=person.email,
        )
        try:
            validate_password(values["new_password"], user=user)
        except ValidationError as exc:
            return Response({"detail": " ".join(exc.messages)}, status=400)
        access.password_hash = make_password(values["new_password"])
        access.must_change_password = False
        access.save(update_fields=["password_hash", "must_change_password"])
        access.studentdevicesession_set.all().delete()
        return Response(issue_session(access))
