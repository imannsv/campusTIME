from datetime import date

from django.db import models
from rest_framework import serializers

from . import models as m

RESOURCES = {
    "areas": m.Area,
    "programs": m.Program,
    "studyversions": m.StudyVersion,
    "modules": m.Module,
    "teachingunits": m.TeachingUnit,
    "cohorts": m.Cohort,
    "groups": m.Group,
    "people": m.Person,
    "periods": m.Period,
    "buildings": m.Building,
    "floors": m.Floor,
    "rooms": m.Room,
    "curricula": m.Curriculum,
    "plans": m.Plan,
    "courses": m.Course,
    "exams": m.Exam,
    "sessions": m.Session,
    "blocks": m.RoomBlock,
    "displays": m.Display,
}
MODEL_RESOURCES = {value: key for key, value in RESOURCES.items()}


class TenantSerializer(serializers.ModelSerializer):
    def get_fields(self):
        fields = super().get_fields()
        institution = self.context.get("institution")
        if institution:
            for field in fields.values():
                child = getattr(field, "child_relation", field)
                if (
                    hasattr(child, "queryset")
                    and child.queryset is not None
                    and hasattr(child.queryset.model, "institution")
                ):
                    child.queryset = child.queryset.filter(institution=institution)
        return fields

    def validate(self, attrs):
        def value(key, default=None):
            return attrs.get(key, getattr(self.instance, key, default))

        model = self.Meta.model
        tenant = self.context["institution"]
        from .study import validate_study

        validate_study(model, self.instance, attrs, tenant)
        if model == m.Period:
            if value("start") > value("end"):
                raise serializers.ValidationError("Zeitraum endet vor seinem Beginn.")
            if (value("end") - value("start")).days > 550:
                raise serializers.ValidationError(
                    "Ein Planungszeitraum darf höchstens 550 Tage umfassen."
                )
            if value("day_start") >= value("day_end"):
                raise serializers.ValidationError(
                    "Tagesende muss nach Tagesbeginn liegen."
                )
            if not value("slot_minutes", 30) or value("slot_minutes", 30) > 240:
                raise serializers.ValidationError(
                    "Zeitraster muss zwischen 1 und 240 Minuten liegen."
                )
            days = value("weekdays", [0, 1, 2, 3, 4])
            if (
                not isinstance(days, list)
                or not days
                or any(type(n) is not int or n not in range(7) for n in days)
            ):
                raise serializers.ValidationError(
                    "Wochentage: Liste mit 0 (Montag) bis 6 (Sonntag)."
                )
            try:
                for d in value("excluded_dates", []):
                    date.fromisoformat(d)
            except (TypeError, ValueError):
                raise serializers.ValidationError(
                    "Unterrichtsfreie Tage als Liste YYYY-MM-DD angeben."
                ) from None
        if model in (m.Course, m.Exam):
            if value("duration_minutes", 90) < 1:
                raise serializers.ValidationError("Dauer muss positiv sein.")
            if model == m.Course and value("target_units", 2) < 1:
                raise serializers.ValidationError("Sollumfang muss positiv sein.")
            if value("duration_minutes", 90) > 1440 or (
                model == m.Course and value("target_units", 2) > 10000
            ):
                raise serializers.ValidationError(
                    "Dauer höchstens 1.440 Minuten; Soll höchstens 10.000 Einheiten je Fach."
                )
            if model == m.Course:
                days = value("block_days", 1)
                if not 1 <= days <= 7:
                    raise serializers.ValidationError(
                        "Blocktage müssen zwischen 1 und 7 liegen."
                    )
                if days > 1 and (
                    value("target_mode", "weekly") != "total"
                    or (value("target_units", 2) * tenant.unit_minutes)
                    % (value("duration_minutes", 90) * days)
                ):
                    raise serializers.ValidationError(
                        "Mehrtagige Blöcke benötigen einen Gesamtumfang, der aus vollständigen Blöcken der angegebenen Tagesdauer besteht."
                    )
            for field in ("teachers", "supervisors"):
                if field in attrs and any(p.kind != "teacher" for p in attrs[field]):
                    raise serializers.ValidationError(
                        {field: "Nur Lehrende auswählen."}
                    )
            if "learners" in attrs and any(
                p.kind != "learner" for p in attrs["learners"]
            ):
                raise serializers.ValidationError(
                    {"learners": "Nur Lernende auswählen."}
                )
            if model == m.Exam:
                if value("window_start") > value("window_end"):
                    raise serializers.ValidationError("Prüfungszeitraum ungültig.")
                if value("course") and value("course").plan_id != value("plan").id:
                    raise serializers.ValidationError(
                        "Kurs und Prüfung müssen zum selben Plan gehören."
                    )
            if model == m.Course:
                assignments = value("teacher_assignments", [])
                if not isinstance(assignments, list) or any(
                    not isinstance(a, list) or not a for a in assignments
                ):
                    raise serializers.ValidationError(
                        "Lehrendenzuordnung als Liste nichtleerer ID-Listen angeben."
                    )
                eligible = (
                    {p.id for p in attrs["teachers"]}
                    if "teachers" in attrs
                    else set(self.instance.teachers.values_list("id", flat=True))
                    if self.instance
                    else set()
                )
                if any(not set(a).issubset(eligible) for a in assignments):
                    raise serializers.ValidationError(
                        "Terminteams müssen aus den zugeordneten Lehrenden bestehen."
                    )
                if "color" in attrs and attrs["color"] not in [
                    "blue",
                    "violet",
                    "mint",
                    "amber",
                    "rose",
                ]:
                    raise serializers.ValidationError("Ungültige Veranstaltungsfarbe.")
        if model in (m.Session, m.RoomBlock):
            if value("end") <= value("start"):
                raise serializers.ValidationError("Ende muss nach Beginn liegen.")
            if (
                model == m.RoomBlock
                and value("repeat_weekly")
                and not value("repeat_until")
            ):
                raise serializers.ValidationError("Wiederholungsende fehlt.")
            if model == m.Session:
                if bool(value("course")) == bool(value("exam")):
                    raise serializers.ValidationError(
                        "Genau einen Kurs oder eine Prüfung auswählen."
                    )
                entity = value("course") or value("exam")
                if entity.plan_id != value("plan").id:
                    raise serializers.ValidationError(
                        "Veranstaltung gehört nicht zum Plan."
                    )
                if self.instance and value("plan").id != self.instance.plan_id:
                    raise serializers.ValidationError(
                        "Ein Termin kann nicht in einen anderen Plan verschoben werden."
                    )
                if "teachers" in attrs and any(
                    p.kind != "teacher" for p in attrs["teachers"]
                ):
                    raise serializers.ValidationError(
                        "Nur Lehrende/Aufsichten auswählen."
                    )
        if model == m.Person:
            if (
                self.instance
                and attrs.get("kind", self.instance.kind) != self.instance.kind
                and (
                    self.instance.study_teaching_units.exists()
                    or self.instance.teaching_courses.exists()
                    or self.instance.supervised_exams.exists()
                )
            ):
                raise serializers.ValidationError(
                    "Person ist als Lehrende oder Aufsicht zugeordnet; die Art kann nicht geändert werden."
                )
            a = value("availability", {})
            if not isinstance(a, dict):
                raise serializers.ValidationError("Verfügbarkeit muss ein Objekt sein.")
            try:
                from datetime import datetime, time

                if "weekdays" in a and (
                    not isinstance(a["weekdays"], list)
                    or any(
                        type(d) is not int or d not in range(7) for d in a["weekdays"]
                    )
                ):
                    raise ValueError()
                for key in ["from", "to"]:
                    if key in a:
                        time.fromisoformat(a[key])
                if a.get("from", "00:00") >= a.get("to", "23:59"):
                    raise ValueError()
                if "windows" in a:
                    if not isinstance(a["windows"], list):
                        raise ValueError()
                    for window in a["windows"]:
                        if (
                            type(window["weekday"]) is not int
                            or window["weekday"] not in range(7)
                            or time.fromisoformat(window["from"])
                            >= time.fromisoformat(window["to"])
                        ):
                            raise ValueError()
                for x in a.get("exclusions", []):
                    s, e = (
                        datetime.fromisoformat(x["start"]),
                        datetime.fromisoformat(x["end"]),
                    )
                    if not s.tzinfo or not e.tzinfo or s >= e:
                        raise ValueError()
            except (TypeError, ValueError, KeyError):
                raise serializers.ValidationError(
                    "Verfügbarkeit enthält ungültige Tage, Uhrzeiten oder Sperrzeiten."
                ) from None
        for field in ["equipment"]:
            if field in attrs and (
                not isinstance(attrs[field], list)
                or any(not isinstance(x, str) for x in attrs[field])
            ):
                raise serializers.ValidationError(
                    {field: "Liste von Ausstattungsnamen erwartet."}
                )
        if model == m.Room and "polygon" in attrs:
            polygon = attrs["polygon"]
            if (
                not isinstance(polygon, list)
                or (polygon and len(polygon) < 3)
                or any(
                    not isinstance(p, list)
                    or len(p) != 2
                    or any(type(n) not in (int, float) or not 0 <= n <= 1000 for n in p)
                    for p in polygon
                )
            ):
                raise serializers.ValidationError(
                    "Raumfläche benötigt mindestens drei Punkte zwischen 0 und 1000."
                )
        if model == m.Room and value("capacity", 30) < 1:
            raise serializers.ValidationError("Raumkapazität muss positiv sein.")
        if model == m.Building and "geometry" in attrs and attrs["geometry"]:
            g = attrs["geometry"]
            try:
                ring = g["coordinates"][0]
                if (
                    g["type"] != "Polygon"
                    or len(ring) < 4
                    or ring[0] != ring[-1]
                    or any(
                        len(p) != 2 or not -180 <= p[0] <= 180 or not -90 <= p[1] <= 90
                        for p in ring
                    )
                ):
                    raise ValueError()
            except (KeyError, TypeError, ValueError, IndexError):
                raise serializers.ValidationError(
                    "Gebäude benötigt ein gültiges GeoJSON-Polygon."
                ) from None
        if model == m.Building and (
            not -90 <= value("latitude", 52.517) <= 90
            or not -180 <= value("longitude", 13.388) <= 180
        ):
            raise serializers.ValidationError(
                "Koordinaten außerhalb des gültigen Bereichs."
            )
        if model == m.Curriculum and "items" in attrs:
            items = attrs["items"]
            if not isinstance(items, list):
                raise serializers.ValidationError(
                    "Vorlage benötigt eine Liste von Fächern."
                )
            try:
                for item in items:
                    if (
                        not isinstance(item, dict)
                        or not item.get("name")
                        or int(item.get("target_units", 0)) <= 0
                        or int(item.get("duration_minutes", 0)) <= 0
                        or item.get("target_mode") not in ["weekly", "total"]
                    ):
                        raise ValueError()
            except (ValueError, TypeError):
                raise serializers.ValidationError(
                    "Vorlagenfächer benötigen Name, target_mode, positive target_units und duration_minutes."
                ) from None
        return attrs


def serializer_for(model):
    read_only = ["id", "institution", "token"]
    if model == m.StudyVersion:
        read_only.append("status")
    if model == m.Cohort:
        read_only.append("study_schedule")
    meta = type(
        "Meta",
        (),
        {
            "model": model,
            "exclude": ["institution"],
            "read_only_fields": read_only,
            "validators": [],
        },
    )
    return type(model.__name__ + "Serializer", (TenantSerializer,), {"Meta": meta})


def schema():
    result = {}
    for resource, model in RESOURCES.items():
        fields = []
        for field in list(model._meta.fields) + list(model._meta.many_to_many):
            if (
                field.name in ["id", "institution", "token"]
                or (model == m.StudyVersion and field.name == "status")
                or (model == m.Cohort and field.name == "study_schedule")
            ):
                continue
            kind = "text"
            if field.is_relation:
                kind = "many" if field.many_to_many else "relation"
            elif isinstance(field, models.BooleanField):
                kind = "boolean"
            elif isinstance(field, models.DateTimeField):
                kind = "datetime-local"
            elif isinstance(field, models.DateField):
                kind = "date"
            elif isinstance(field, models.TimeField):
                kind = "time"
            elif isinstance(
                field, (models.IntegerField, models.FloatField, models.DecimalField)
            ):
                kind = "number"
            elif isinstance(field, models.JSONField):
                kind = "json"
            elif isinstance(field, models.FileField):
                kind = "file"
            if field.choices:
                kind = "choice"
            default = (
                field.get_default()
                if field.has_default()
                else ([] if field.many_to_many else "")
            )
            fields.append(
                {
                    "name": field.name,
                    "type": kind,
                    "required": not field.blank and not field.has_default(),
                    "resource": MODEL_RESOURCES.get(field.related_model)
                    if field.is_relation
                    else None,
                    "choices": list(field.choices or []),
                    "default": default,
                }
            )
        if resource == "sessions":
            fields += [
                {
                    "name": "repeat_weekly",
                    "type": "boolean",
                    "required": False,
                    "default": False,
                    "choices": [],
                },
                {
                    "name": "repeat_until",
                    "type": "date",
                    "required": False,
                    "default": "",
                    "choices": [],
                },
                {
                    "name": "repeat_interval",
                    "type": "choice",
                    "required": False,
                    "default": "1",
                    "choices": [["1", "Jede Woche"], ["2", "Alle zwei Wochen"]],
                },
            ]
        result[resource] = fields
    return result
