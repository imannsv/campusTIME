import csv
import io
import json
import threading
import zipfile
from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from django.conf import settings
from django.contrib.auth import authenticate, login, logout
from django.db import transaction
from django.db.models import F, Max, Q
from django.http import FileResponse, HttpResponse, JsonResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from rest_framework import serializers, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from . import models as m
from .overview import catalog_for, enrich_snapshot, matches_scope, overview_filters
from .serializers import RESOURCES, schema, serializer_for
from .services import (
    block_rows,
    dt,
    latest_publications,
    local,
    plan_rows,
    public_row,
    validate_rows,
)
from .tasks import run_job


def tenant(request):
    membership = (
        m.Membership.objects.filter(user=request.user)
        .select_related("institution")
        .first()
    )
    if not membership:
        raise serializers.ValidationError("Kein Einrichtungszugang zugeordnet.")
    return membership.institution


@api_view(["GET"])
@permission_classes([AllowAny])
def health(request):
    try:
        from django.db import connection

        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        if not settings.LOCAL_WORKER:
            import redis

            redis.Redis.from_url(
                settings.CELERY_BROKER_URL, socket_connect_timeout=2, socket_timeout=2
            ).ping()
        return Response({"status": "ok"})
    except Exception:
        return Response({"status": "unavailable"}, status=503)


def writable(institution):
    if institution.license_until and institution.license_until < timezone.localdate():
        raise serializers.ValidationError(
            "Lizenz abgelaufen. Bitte den Betrieb kontaktieren."
        )


def bump(request, institution, action):
    m.Institution.objects.filter(id=institution.id).update(revision=F("revision") + 1)
    m.Audit.objects.create(institution=institution, user=request.user, action=action)


def lock_tenant(request):
    institution = m.Institution.objects.select_for_update().get(id=tenant(request).id)
    writable(institution)
    return institution


@ensure_csrf_cookie
def auth_state(request):
    if not request.user.is_authenticated:
        return JsonResponse({"authenticated": False})
    memberships = m.Membership.objects.filter(user=request.user).select_related(
        "institution"
    )
    if not memberships:
        return JsonResponse(
            {"authenticated": False, "error": "Kein Einrichtungszugang zugeordnet."}
        )
    membership = memberships.first()
    institution = membership.institution
    return JsonResponse(
        {
            "authenticated": True,
            "user": request.user.get_full_name() or request.user.username,
            "role": membership.role,
            "institution": {
                "id": institution.id,
                "name": institution.name,
                "kind": institution.kind,
                "timezone": institution.timezone,
                "revision": institution.revision,
                "unit_minutes": institution.unit_minutes,
                "exam_max_per_day": institution.exam_max_per_day,
                "exam_gap_hours": institution.exam_gap_hours,
                "license_until": institution.license_until,
            },
            "map_style": settings.MAP_STYLE_URL,
        }
    )


@csrf_protect
def sign_in(request):
    if request.method != "POST":
        return JsonResponse({"detail": "POST erforderlich."}, status=405)
    try:
        data = json.loads(request.body)
    except (ValueError, TypeError):
        return JsonResponse({"detail": "Ungültige Eingabe."}, status=400)
    if (
        not isinstance(data, dict)
        or not isinstance(data.get("username"), str)
        or not isinstance(data.get("password"), str)
    ):
        return JsonResponse(
            {"detail": "Benutzername und Passwort eingeben."}, status=400
        )
    user = authenticate(
        request, username=data.get("username"), password=data.get("password")
    )
    if not user or not m.Membership.objects.filter(user=user).exists():
        return JsonResponse({"detail": "Anmeldedaten prüfen."}, status=400)
    login(request, user)
    return auth_state(request)


@csrf_protect
def sign_out(request):
    if request.method != "POST":
        return JsonResponse({"detail": "POST erforderlich."}, status=405)
    logout(request)
    return JsonResponse({"ok": True})


class Pagination(PageNumberPagination):
    page_size = 100
    page_size_query_param = "page_size"
    max_page_size = 1000


class ResourceViewSet(viewsets.ModelViewSet):
    pagination_class = Pagination
    resource = ""

    def get_serializer_class(self):
        return serializer_for(RESOURCES[self.resource])

    def get_serializer_context(self):
        return {**super().get_serializer_context(), "institution": tenant(self.request)}

    def get_queryset(self):
        institution = tenant(self.request)
        qs = (
            RESOURCES[self.resource]
            .objects.filter(institution=institution)
            .order_by("id")
        )
        query = self.request.query_params
        model = RESOURCES[self.resource]
        if query.get("search") and hasattr(model, "name"):
            lookup = Q(name__icontains=query["search"])
            if hasattr(model, "code"):
                lookup |= Q(code__icontains=query["search"])
            qs = qs.filter(lookup)
        for field in [
            "plan",
            "floor",
            "building",
            "kind",
            "cohort",
            "program",
            "study_version",
            "module",
            "semester",
            "groups",
            "status",
        ]:
            if query.get(field) and hasattr(model, field):
                qs = qs.filter(**{field: query[field]})
        if self.resource == "sessions":
            if query.get("since"):
                qs = qs.filter(
                    end__gt=serializers.DateTimeField().run_validation(query["since"])
                )
            if query.get("until"):
                qs = qs.filter(
                    start__lt=serializers.DateTimeField().run_validation(query["until"])
                )
            qs = qs.select_related(
                "course", "exam", "plan__period", "institution"
            ).prefetch_related("rooms", "teachers")
        return qs

    def list(self, request, *args, **kwargs):
        try:
            return super().list(request, *args, **kwargs)
        except (ValueError, TypeError):
            raise serializers.ValidationError("Ungültiger Filter.") from None

    def perform_create(self, serializer):
        self._save(serializer)

    def perform_update(self, serializer):
        self._save(serializer)

    def _save(self, serializer):
        with transaction.atomic():
            institution = lock_tenant(self.request)
            from .study import validate_study

            validate_study(
                RESOURCES[self.resource],
                serializer.instance,
                serializer.validated_data,
                institution,
            )
            from .assessments import validate_assessment

            validate_assessment(
                RESOURCES[self.resource], serializer.instance, serializer.validated_data
            )
            code = serializer.validated_data.get("code")
            if (
                code
                and RESOURCES[self.resource]
                .objects.filter(institution=institution, code=code)
                .exclude(pk=getattr(serializer.instance, "pk", None))
                .exists()
            ):
                raise serializers.ValidationError(
                    {"code": "Kennung ist bereits vergeben."}
                )
            instance = serializer.save(institution=institution)
            if isinstance(instance, m.Session):
                if self.request.data.get("repeat_weekly"):
                    if serializer.instance and self.request.method != "POST":
                        raise serializers.ValidationError(
                            "Wiederholungen nur beim Anlegen eines Termins erstellen."
                        )
                    try:
                        from datetime import date

                        until = date.fromisoformat(
                            self.request.data.get("repeat_until", "")
                        )
                        interval = int(self.request.data.get("repeat_interval", 1))
                    except (ValueError, TypeError):
                        raise serializers.ValidationError(
                            "Gültiges Wiederholungsende auswählen."
                        ) from None
                    if interval not in [1, 2] or until > instance.plan.period.end:
                        raise serializers.ValidationError(
                            "Wiederholung muss innerhalb des Planungszeitraums liegen."
                        )
                    start, end = (
                        local(instance.start, institution),
                        local(instance.end, institution),
                    )
                    while True:
                        start, end = (
                            start + timedelta(weeks=interval),
                            end + timedelta(weeks=interval),
                        )
                        if start.date() > until:
                            break
                        if (
                            start.date().isoformat()
                            in instance.plan.period.excluded_dates
                        ):
                            continue
                        clone = m.Session.objects.create(
                            institution=institution,
                            plan=instance.plan,
                            course=instance.course,
                            exam=instance.exam,
                            name=instance.name,
                            start=start,
                            end=end,
                            locked=instance.locked,
                        )
                        clone.rooms.set(instance.rooms.all())
                        clone.teachers.set(instance.teachers.all())
                rows = plan_rows(instance.plan)
                errors = validate_rows(instance.plan, rows)
                if errors:
                    raise serializers.ValidationError({"conflicts": errors})
            bump(
                self.request, institution, f"{self.resource}: {instance.pk} gespeichert"
            )

    def perform_destroy(self, instance):
        from django.db.models.deletion import ProtectedError, RestrictedError

        with transaction.atomic():
            institution = lock_tenant(self.request)
            from .study import owner_version

            version = owner_version(instance)
            if version:
                version.refresh_from_db()
            if version and version.status == "approved":
                raise serializers.ValidationError(
                    "Freigegebene Lehrplanversionen und ihre Inhalte bleiben erhalten."
                )
            if (
                isinstance(instance, m.Person)
                and instance.study_teaching_units.filter(
                    module__study_version__status="approved"
                ).exists()
            ):
                raise serializers.ValidationError(
                    "Person ist einer freigegebenen Studienstruktur zugeordnet. Verfügbarkeiten können weiterhin angepasst werden."
                )
            try:
                instance.delete()
            except (ProtectedError, RestrictedError):
                raise serializers.ValidationError(
                    "Datensatz wird noch verwendet. Zuerst die Zuordnungen entfernen."
                ) from None
            bump(self.request, institution, f"{self.resource}: gelöscht")

    @action(detail=True, methods=["get"])
    def exam_draft(self, request, pk=None):
        if self.resource != "assessments":
            return Response(status=404)
        from .assessments import exam_draft

        return Response(exam_draft(self.get_object()))

    @action(detail=True, methods=["get"])
    def file(self, request, pk=None):
        if self.resource != "floors":
            return Response(status=404)
        floor = self.get_object()
        if not floor.background:
            return Response(status=404)
        return FileResponse(floor.background.open("rb"), as_attachment=False)

    @action(detail=True, methods=["post"])
    def upload(self, request, pk=None):
        if self.resource != "floors":
            return Response(status=404)
        uploaded = request.FILES.get("file")
        if not uploaded or uploaded.size > 10 * 1024 * 1024:
            raise serializers.ValidationError("Bild fehlt oder ist größer als 10 MB.")
        from PIL import Image

        try:
            image = Image.open(uploaded)
            if (
                image.format not in ["PNG", "JPEG", "WEBP"]
                or image.width * image.height > 40000000
            ):
                raise ValueError()
            image.verify()
            uploaded.seek(0)
        except Exception:
            raise serializers.ValidationError(
                "Grundriss als gültiges PNG-, JPEG- oder WebP-Bild hochladen."
            ) from None
        with transaction.atomic():
            institution = lock_tenant(request)
            floor = self.get_object()
            floor.background.save(uploaded.name, uploaded)
            bump(request, institution, "Grundriss hochgeladen")
        return Response({"ok": True})


@api_view(["GET"])
def bootstrap(request):
    institution = tenant(request)
    counts = {
        name: model.objects.filter(institution=institution).count()
        for name, model in RESOURCES.items()
    }
    return Response(
        {
            "schema": schema(),
            "counts": counts,
            "audit": list(
                m.Audit.objects.filter(institution=institution)
                .order_by("-id")
                .values("action", "created")[:10]
            ),
        }
    )


@api_view(["PATCH"])
def preferences(request):
    with transaction.atomic():
        institution = lock_tenant(request)
        membership = m.Membership.objects.get(
            user=request.user, institution=institution
        )
        if membership.role != "admin":
            return Response(
                {"detail": "Nur die Verwaltung kann Einstellungen ändern."}, status=403
            )
        for key in ["unit_minutes", "exam_max_per_day", "exam_gap_hours"]:
            if key in request.data:
                try:
                    n = int(request.data[key])
                except (ValueError, TypeError):
                    raise serializers.ValidationError("Ganzzahl erwartet.") from None
                if n < (0 if key == "exam_gap_hours" else 1) or n > 10000:
                    raise serializers.ValidationError(
                        "Wert außerhalb des erlaubten Bereichs."
                    )
                if key == "unit_minutes" and n > 240:
                    raise serializers.ValidationError(
                        "Eine Unterrichtseinheit darf höchstens 240 Minuten dauern."
                    )
                setattr(institution, key, n)
        institution.save()
        bump(request, institution, "Einrichtungseinstellungen geändert")
    return Response({"ok": True})


@api_view(["GET", "POST"])
def cohort_progression(request, pk):
    from .progression import LIMIT_FIELDS, progression

    institution = tenant(request)
    cohort = get_object_or_404(
        m.Cohort.objects.select_related("study_version", "institution"),
        institution=institution,
        pk=pk,
    )
    if request.method == "GET":
        return Response(progression(cohort))
    with transaction.atomic():
        institution = lock_tenant(request)
        cohort = m.Cohort.objects.select_related("study_version", "institution").get(
            pk=cohort.pk
        )
        operation = request.data.get("operation", "preview")
        if operation not in ["preview", "propose", "save"]:
            raise serializers.ValidationError("Ungültige Aktion.")
        if request.data.get("revision") != institution.revision:
            raise serializers.ValidationError(
                "Daten wurden inzwischen geändert. Gespeicherten Verlauf neu laden und Änderungen prüfen."
            )
        result = progression(
            cohort,
            request.data.get("schedule"),
            request.data.get("limits"),
            propose=operation == "propose",
        )
        if operation == "save":
            if result["errors"]:
                raise serializers.ValidationError(result["errors"])
            cohort.study_schedule = result["schedule"]
            for field in LIMIT_FIELDS:
                setattr(cohort, field, result["limits"][field])
            cohort.save(update_fields=["study_schedule", *LIMIT_FIELDS])
            bump(request, institution, f"{cohort.name}: Jahrgangsverlauf angepasst")
            result["revision"] = institution.revision + 1
        return Response(result)


@api_view(["GET", "POST"])
def study_action(request, pk, operation):
    institution = tenant(request)
    version = get_object_or_404(m.StudyVersion, institution=institution, pk=pk)
    from .study import clone_version, structure_report

    if operation == "check" and request.method == "GET":
        return Response(structure_report(version))
    if request.method != "POST":
        return Response(status=405)
    with transaction.atomic():
        institution = lock_tenant(request)
        version.refresh_from_db()
        if operation == "approve":
            report = structure_report(version)
            if report["errors"]:
                return Response(
                    {"detail": "Lehrplanversion ist noch unvollständig.", **report},
                    status=400,
                )
            version.status = "approved"
            version.save(update_fields=["status"])
            bump(request, institution, f"{version.name}: Lehrplanversion freigegeben")
            return Response({"ok": True, **report})
        if operation == "clone":
            values = [
                str(request.data.get(field, "")).strip()
                for field in ["code", "name", "version"]
            ]
            if any(
                len(value) > limit
                for value, limit in zip(values, [80, 200, 80], strict=True)
            ):
                raise serializers.ValidationError(
                    "Kennung oder Versionsbezeichnung zu lang."
                )
            copy = clone_version(version, *values)
            bump(request, institution, f"{version.name}: Neue Lehrplanversion angelegt")
            return Response(serializer_for(m.StudyVersion)(copy).data, status=201)
    return Response(status=404)


@api_view(["GET", "POST"])
def plan_action(request, pk, operation):
    institution = tenant(request)
    plan = get_object_or_404(m.Plan, institution=institution, pk=pk)
    if operation == "check" and request.method == "GET":
        rows = plan_rows(plan)
        return Response(
            {
                "conflicts": validate_rows(plan, rows, coverage=True),
                "rows": rows,
                "publication": m.Publication.objects.filter(plan=plan)
                .order_by("-number")
                .values("number", "created")
                .first(),
            }
        )
    if request.method != "POST":
        return Response(status=405)
    with transaction.atomic():
        institution = lock_tenant(request)
        if operation == "prepare-assessments":
            from .assessments import prepare_assessments

            result = prepare_assessments(plan)
            if result["created"]:
                bump(request, institution, f"{plan.name}: Prüfungsvorlagen übernommen")
            return Response(result)
        if operation == "prepare":
            from .study import prepare_semester

            plan = m.Plan.objects.select_related("cohort__study_version").get(
                pk=plan.pk
            )
            groups = request.data.get("groups")
            if groups is not None:
                groups = serializers.ListField(
                    child=serializers.IntegerField(min_value=1)
                ).run_validation(groups)
            result = prepare_semester(plan, groups)
            if result["created"]:
                bump(request, institution, f"{plan.name}: Semester vorbereitet")
            return Response(result)
        if operation == "publish":
            rows = plan_rows(plan)
            errors = validate_rows(plan, rows, coverage=True)
            if errors:
                return Response(
                    {
                        "detail": "Plan kann noch nicht veröffentlicht werden.",
                        "conflicts": errors,
                    },
                    status=400,
                )
            publication = m.Publication.objects.create(
                institution=institution,
                plan=plan,
                number=(
                    m.Publication.objects.filter(plan=plan).aggregate(n=Max("number"))[
                        "n"
                    ]
                    or 0
                )
                + 1,
                created_by=request.user,
                snapshot=enrich_snapshot(rows, institution.id),
            )
            bump(
                request,
                institution,
                f"{plan.name}: Version {publication.number} veröffentlicht",
            )
            return Response({"number": publication.number})
        if operation == "solve":
            if request.data.get("kind", "teaching") not in ["teaching", "exams"]:
                raise serializers.ValidationError("Ungültiger Planungstyp.")
            if m.Job.objects.filter(
                plan=plan, status__in=["queued", "running"]
            ).exists():
                raise serializers.ValidationError(
                    "Für diesen Plan läuft bereits eine Berechnung."
                )
            job = m.Job.objects.create(
                institution=institution,
                plan=plan,
                revision=institution.revision,
                kind=request.data.get("kind", "teaching"),
            )

            def dispatch():
                if settings.LOCAL_WORKER:
                    threading.Thread(
                        target=run_job, args=[str(job.id)], daemon=True
                    ).start()
                else:
                    try:
                        run_job.delay(str(job.id))
                    except Exception:
                        m.Job.objects.filter(id=job.id).update(
                            status="failed", message="Planungsdienst nicht erreichbar."
                        )

            transaction.on_commit(dispatch)
            return Response({"id": str(job.id)}, status=202)
        if operation == "template":
            template = get_object_or_404(
                m.Curriculum, pk=request.data.get("curriculum"), institution=institution
            )
            groups = list(
                m.Group.objects.filter(
                    institution=institution, id__in=request.data.get("groups", [])
                )
            )
            if len(groups) != len(set(request.data.get("groups", []))):
                raise serializers.ValidationError("Ungültige Gruppen.")
            codes = [
                f"{plan.code}-{template.code}-{i + 1}"
                for i in range(len(template.items))
            ]
            if m.Course.objects.filter(
                institution=institution, code__in=codes
            ).exists():
                raise serializers.ValidationError(
                    "Diese Vorlage wurde bereits in diesen Plan übernommen."
                )
            for index, item in enumerate(template.items):
                course = m.Course.objects.create(
                    institution=institution,
                    plan=plan,
                    code=f"{plan.code}-{template.code}-{index + 1}",
                    name=item["name"],
                    target_mode=item["target_mode"],
                    target_units=item["target_units"],
                    duration_minutes=item["duration_minutes"],
                    equipment=item.get("equipment", []),
                    elective=item.get("elective", False),
                )
                course.groups.set(groups)
            bump(request, institution, "Lehrplanvorlage übernommen")
            return Response({"ok": True})
    return Response(status=404)


@api_view(["GET", "POST"])
def job_detail(request, pk):
    job = get_object_or_404(m.Job, pk=pk, institution=tenant(request))
    if request.method == "GET":
        return Response(
            {
                "id": str(job.id),
                "status": job.status,
                "message": job.message,
                "result": job.result,
                "stale": job.revision != tenant(request).revision,
            }
        )
    with transaction.atomic():
        institution = lock_tenant(request)
        job.refresh_from_db()
        if request.data.get("action") == "cancel":
            job.cancel_requested = True
            job.save(update_fields=["cancel_requested"])
            return Response({"ok": True})
        if (
            request.data.get("action") != "apply"
            or job.status != "ready"
            or job.cancel_requested
        ):
            raise serializers.ValidationError("Vorschlag ist nicht übernehmbar.")
        if job.revision != institution.revision:
            raise serializers.ValidationError(
                "Daten wurden geändert. Bitte neu berechnen."
            )
        errors = validate_rows(job.plan, job.result)
        if errors:
            raise serializers.ValidationError({"conflicts": errors})
        job.plan.sessions.all().delete()
        for row in job.result:
            session = m.Session.objects.create(
                institution=institution,
                plan=job.plan,
                course_id=row.get("course"),
                exam_id=row.get("exam"),
                name=row["name"],
                start=row["start"],
                end=row["end"],
                locked=row["locked"],
            )
            session.rooms.set(row["room_ids"])
            session.teachers.set(row["teacher_ids"])
        job.status = "applied"
        job.save(update_fields=["status"])
        bump(request, institution, "Planungsvorschlag übernommen")
    return Response({"ok": True})


@api_view(["GET"])
def jobs(request):
    institution = tenant(request)
    query = m.Job.objects.filter(institution=institution).order_by("-created")
    if request.query_params.get("plan"):
        try:
            query = query.filter(plan_id=int(request.query_params["plan"]))
        except ValueError:
            raise serializers.ValidationError("Ungültiger Planfilter.") from None
    return Response(
        list(
            query.values("id", "kind", "status", "message", "revision", "created")[:20]
        )
    )


@api_view(["GET"])
@permission_classes([AllowAny])
def public_display(request, token):
    return Response(display_payload(request, token))


@api_view(["GET"])
@permission_classes([AllowAny])
def public_overview(request, token):
    return Response(display_payload(request, token, overview=True))


def display_payload(request, token, overview=False):
    display = get_object_or_404(m.Display, token=token, active=True)
    publications = [
        p
        for p in latest_publications(display.institution)
        if p.plan_id in set(display.plans.values_list("id", flat=True))
    ]
    rows = []
    selected = list(display.plans.select_related("period").all())
    # Display links always use the mode chosen by the administration.
    view_mode = "week" if overview else display.view_mode
    catalog, filters = {}, {}
    if overview:
        for publication in publications:
            publication.snapshot = enrich_snapshot(
                publication.snapshot, display.institution_id
            )
        catalog = catalog_for(
            [row for publication in publications for row in publication.snapshot]
        )
        filters = overview_filters(request.query_params, catalog)
    zone = ZoneInfo(display.institution.timezone)
    if view_mode in {"today", "tomorrow"}:
        # Local midnights keep 23/25-hour days correct at daylight saving changes.
        day = timezone.now().astimezone(zone).date()
        if view_mode == "tomorrow":
            day += timedelta(days=1)
        since = datetime.combine(day, time(), zone)
        until = datetime.combine(day + timedelta(days=1), time(), zone)
    else:
        since = request.query_params.get("since")
        until = request.query_params.get("until")
        try:
            since = dt(since) if since else None
            until = dt(until) if until else None
            if (
                (since and not since.tzinfo)
                or (until and not until.tzinfo)
                or (since and until and until <= since)
            ):
                raise ValueError()
        except (ValueError, TypeError):
            raise serializers.ValidationError(
                "Anzeigefenster mit gültigen Zeitpunkten und Zeitzone angeben."
            ) from None
    for publication in publications:
        blocks = block_rows(display.institution, publication.plan.period)
        for row in publication.snapshot:
            if overview and not matches_scope(row, filters):
                continue
            if (since and dt(row["end"]) <= since) or (
                until and dt(row["start"]) >= until
            ):
                continue
            public = public_row(row, display.show_teachers)
            if overview:
                scope = row["overview_scope"]
                public["course_key"] = scope["course"]
                public["group_names"] = [
                    group["name"] for group in scope["groups"]
                ] or public["group_names"]
                public["resit"] = bool(
                    row.get("exam")
                    and "Nachschreibeklausur" in row.get("group_names", [])
                )
            public["blocked"] = any(
                set(row["room_ids"]) & set(b["room_ids"])
                and dt(row["start"]) < dt(b["end"])
                and dt(b["start"]) < dt(row["end"])
                for b in blocks
            )
            rows.append(public)
    return {
        "name": display.name,
        "institution": display.institution.name,
        "timezone": display.institution.timezone,
        "view_mode": view_mode,
        "window_start": since,
        "window_end": until,
        "revision": display.institution.revision,
        "rows": rows,
        "available_from": min(
            (
                dt(r["start"])
                for p in publications
                for r in p.snapshot
                if not overview or matches_scope(r, filters)
            ),
            default=None,
        ),
        "weekdays": sorted({d for p in selected for d in p.period.weekdays})
        or [0, 1, 2, 3, 4],
        "day_start": min(
            (
                p.period.day_start.hour + p.period.day_start.minute / 60
                for p in selected
            ),
            default=8,
        ),
        "day_end": max(
            (p.period.day_end.hour + p.period.day_end.minute / 60 for p in selected),
            default=18,
        ),
        "auto_scroll": False if overview else display.auto_scroll,
        "scroll_seconds": display.scroll_seconds,
        "updated": max((p.created for p in publications), default=None),
        **({"catalog": catalog, "filters": filters} if overview else {}),
    }


@api_view(["GET"])
def resource_occupancy(request):
    from .occupancy import overview

    response = Response(overview(tenant(request), request.query_params))
    response["Cache-Control"] = "private, no-store"
    return response


@api_view(["GET"])
def room_occupancy(request, pk):
    institution = tenant(request)
    room = get_object_or_404(m.Room, institution=institution, pk=pk)
    rows = [
        public_row(r, True)
        for p in latest_publications(institution)
        for r in p.snapshot
        if room.id in r["room_ids"]
    ]
    return Response({"rows": rows})


def import_rows(upload):
    if upload.size > 10 * 1024 * 1024:
        raise serializers.ValidationError("Maximal 10 MB pro Import.")
    if upload.name.lower().endswith(".xlsx"):
        from openpyxl import load_workbook

        raw = upload.read()
        with zipfile.ZipFile(io.BytesIO(raw)) as archive:
            if sum(x.file_size for x in archive.infolist()) > 100 * 1024 * 1024:
                raise serializers.ValidationError("Excel-Datei entpackt zu groß.")
        sheet = load_workbook(io.BytesIO(raw), read_only=True, data_only=True).active
        values = sheet.iter_rows(values_only=True)
        headers = [str(x) if x is not None else "" for x in next(values)]
        rows = []
        for row in values:
            if any(x is not None for x in row):
                rows.append(
                    dict(
                        zip(
                            headers,
                            [str(x) if x is not None else "" for x in row],
                            strict=False,
                        )
                    )
                )
            if len(rows) > 30000:
                raise serializers.ValidationError(
                    "Maximal 30.000 Datensätze pro Import."
                )
        return rows
    text = upload.read().decode("utf-8-sig")
    try:
        dialect = csv.Sniffer().sniff(text[:4096], delimiters=",;\t")
    except csv.Error:
        dialect = csv.excel
    rows = list(csv.DictReader(io.StringIO(text), dialect=dialect))
    if len(rows) > 30000:
        raise serializers.ValidationError("Maximal 30.000 Datensätze pro Import.")
    return rows


@api_view(["GET", "POST"])
def imports(request, resource):
    if resource not in RESOURCES or resource == "sessions":
        return Response(status=404)
    institution = tenant(request)
    model = RESOURCES[resource]
    fields = schema()[resource]
    if request.method == "GET":
        output = io.StringIO()
        writer = csv.writer(output, delimiter=";")
        writer.writerow([f["name"] for f in fields if f["type"] != "file"])
        response = HttpResponse(
            output.getvalue(), content_type="text/csv; charset=utf-8"
        )
        response["Content-Disposition"] = (
            f'attachment; filename="{resource}-vorlage.csv"'
        )
        return response
    if request.data.get("batch"):
        with transaction.atomic():
            institution = lock_tenant(request)
            batch = get_object_or_404(
                m.ImportBatch,
                id=request.data["batch"],
                institution=institution,
                user=request.user,
                resource=resource,
                committed=False,
            )
            if (
                batch.created < timezone.now() - timedelta(hours=1)
                or batch.revision != institution.revision
            ):
                raise serializers.ValidationError(
                    "Importvorschau veraltet. Bitte Datei erneut prüfen."
                )
            for row in batch.rows:
                instance = model.objects.filter(
                    institution=institution, code=row["code"]
                ).first()
                serializer = serializer_for(model)(
                    instance,
                    data=row,
                    partial=bool(instance),
                    context={"institution": institution},
                )
                serializer.is_valid(raise_exception=True)
                serializer.save(institution=institution)
            batch.committed = True
            batch.save(update_fields=["committed"])
            bump(request, institution, f"{len(batch.rows)} {resource} importiert")
        return Response({"count": len(batch.rows)})
    upload = request.FILES.get("file")
    if not upload:
        raise serializers.ValidationError("Datei fehlt.")
    try:
        rows = import_rows(upload)
    except serializers.ValidationError:
        raise
    except Exception:
        raise serializers.ValidationError(
            "Datei kann nicht gelesen werden. CSV UTF-8 oder XLSX verwenden."
        ) from None
    errors, normalized, seen = [], [], set()
    for index, row in enumerate(rows):
        data = {}
        try:
            for field in fields:
                key = field["name"]
                raw = row.get(key, "")
                if raw in ("", None):
                    continue
                if field["type"] == "json":
                    data[key] = json.loads(raw)
                elif field["type"] == "boolean":
                    if str(raw).lower() not in [
                        "true",
                        "false",
                        "1",
                        "0",
                        "ja",
                        "nein",
                    ]:
                        raise ValueError(f"{key}: Ja/Nein oder true/false verwenden.")
                    data[key] = str(raw).lower() in ["true", "1", "ja"]
                elif field["type"] == "date":
                    data[key] = raw.split(" ")[0].split("T")[0]
                elif field["type"] in ["relation", "many"]:
                    related = RESOURCES[field["resource"]]
                    codes = [c.strip() for c in raw.split("|")]
                    ids = []
                    for code in codes:
                        obj = related.objects.filter(
                            institution=institution, code=code
                        ).first()
                        if not obj:
                            raise ValueError(f"{key}: Kennung {code} nicht gefunden.")
                        ids.append(obj.id)
                    data[key] = ids if field["type"] == "many" else ids[0]
                elif field["type"] != "file":
                    data[key] = raw
            if not data.get("code"):
                raise ValueError("Kennung code fehlt.")
            if data["code"] in seen:
                raise ValueError("Kennung mehrfach in der Datei.")
            seen.add(data["code"])
            instance = model.objects.filter(
                institution=institution, code=data["code"]
            ).first()
            serializer = serializer_for(model)(
                instance,
                data=data,
                partial=bool(instance),
                context={"institution": institution},
            )
            serializer.is_valid(raise_exception=True)
            normalized.append(data)
        except Exception as error:
            errors.append({"row": index + 2, "message": str(error)})
    batch = None
    if not errors and normalized:
        batch = m.ImportBatch.objects.create(
            institution=institution,
            user=request.user,
            resource=resource,
            rows=normalized,
            revision=institution.revision,
        )
    return Response(
        {
            "batch": str(batch.id) if batch else None,
            "count": len(rows),
            "preview": rows[:10],
            "errors": errors[:100],
        }
    )
