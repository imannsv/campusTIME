"""Copy module requirements into semester drafts, separate from scheduled exams."""

from rest_framework import serializers

from . import models as m
from .progression import effective_semester, progression
from .services import attendance

TIMED_TYPES = {"exam", "oral", "presentation", "practical"}


def module_units(module):
    ids = {module.id}
    modules = list(module.study_version.modules.all())
    for _ in range(12):
        children = {item.id for item in modules if item.parent_id in ids}
        if children <= ids:
            break
        ids |= children
    return list(m.TeachingUnit.objects.filter(module_id__in=ids))


def assessment_semester(module, cohort):
    return max(
        (effective_semester(cohort, unit) for unit in module_units(module)), default=0
    )


def prepare_assessments(plan):
    cohort = plan.cohort
    if (
        not cohort
        or not cohort.study_version_id
        or cohort.study_version.status != "approved"
    ):
        raise serializers.ValidationError(
            "Jahrgang mit freigegebener Lehrplanversion auswählen."
        )
    report = progression(cohort)
    if report["errors"]:
        raise serializers.ValidationError(report["errors"])
    created, existing, warnings = 0, 0, []
    for module in cohort.study_version.modules.order_by("id"):
        semester = assessment_semester(module, cohort)
        if not semester and module.assessment_type not in {"none", "unspecified"}:
            warnings.append(
                f"{module.name}: Ohne Lehrveranstaltung ist kein Prüfungssemester bestimmbar."
            )
        if semester != plan.semester or module.assessment_type == "none":
            continue
        if module.assessment_type == "unspecified":
            warnings.append(
                f"{module.name}: Prüfungsanforderung im Lehrplan noch nicht festgelegt."
            )
            continue
        code = f"PLAN{plan.id}-PRUEF{module.id}"
        if (
            m.Assessment.objects.filter(institution=plan.institution, code=code)
            .exclude(plan=plan, module=module)
            .exists()
        ):
            raise serializers.ValidationError(f"Kennung {code} ist bereits vergeben.")
        _, new = m.Assessment.objects.get_or_create(
            institution=plan.institution,
            plan=plan,
            module=module,
            defaults={
                "code": code,
                "name": module.name,
                "assessment_type": module.assessment_type,
                "assessment_duration_minutes": module.assessment_duration_minutes,
                "assessment_notes": module.assessment_notes,
            },
        )
        created += int(new)
        existing += int(not new)
    return {"created": created, "existing": existing, "warnings": warnings}


def exam_draft(assessment):
    if assessment.status != "open" or assessment.assessment_type not in TIMED_TYPES:
        raise serializers.ValidationError(
            "Nur offene zeitgebundene Vorgaben können als Prüfung geplant werden."
        )
    if m.Exam.objects.filter(assessment_template=assessment, resit=False).exists():
        raise serializers.ValidationError(
            "Für diese Vorlage wurde bereits eine Prüfung angelegt."
        )
    plan = assessment.plan
    units = module_units(assessment.module)
    courses = list(
        m.Course.objects.filter(
            plan__cohort=plan.cohort, teaching_unit__in=units
        ).prefetch_related("learners", "groups__people")
    )
    learners, warnings = set(), []
    if courses:
        for course in courses:
            ids, count, _ = attendance(course)
            learners |= ids
            if count > len(ids):
                warnings.append(
                    f"{course.name}: Gruppenliste unvollständig; Teilnehmer prüfen."
                )
            if course.elective and not ids:
                warnings.append(
                    f"{course.name}: Wahlpflichtbelegungen fehlen; Teilnehmer auswählen."
                )
    elif units and all(unit.elective for unit in units):
        warnings.append(
            "Wahlpflichtbelegungen fehlen; Teilnehmer ausdrücklich auswählen."
        )
    else:
        learners = set(
            m.Person.objects.filter(
                institution=assessment.institution,
                kind="learner",
                groups__cohort=plan.cohort,
            ).values_list("id", flat=True)
        )
        warnings.append(
            "Teilnehmer aus dem Jahrgang vorgeschlagen; Belegungen und Gruppenlisten prüfen."
        )
    if not learners:
        warnings.append("Es wurden noch keine Prüfungsteilnehmer erfasst.")
    own_courses = [course for course in courses if course.plan_id == plan.id]
    return {
        "warnings": warnings,
        "defaults": {
            "code": f"VORLAGE{assessment.id}-PRUEF",
            "name": assessment.name,
            "plan": plan.id,
            "course": own_courses[0].id if len(own_courses) == 1 else None,
            "assessment_template": assessment.id,
            "assessment_type": assessment.assessment_type,
            "assessment_notes": assessment.assessment_notes,
            "duration_minutes": assessment.assessment_duration_minutes,
            "window_start": plan.period.start,
            "window_end": plan.period.end,
            "learners": sorted(learners),
            "supervisors": [],
            "resit": False,
        },
    }


def validate_assessment(model, instance, attrs):
    def value(key, default=None):
        return attrs.get(key, getattr(instance, key, default))

    if model == m.Assessment:
        plan, module = value("plan"), value("module")
        if (
            not plan.cohort_id
            or plan.cohort.study_version_id != module.study_version_id
            or module.study_version.status != "approved"
        ):
            raise serializers.ValidationError(
                "Modul muss zur freigegebenen Lehrplanversion des Jahrgangs gehören."
            )
        if instance and (
            plan.id != instance.plan_id or module.id != instance.module_id
        ):
            raise serializers.ValidationError(
                "Herkunftsmodul und Semesterplan bleiben erhalten."
            )
        if not instance and assessment_semester(module, plan.cohort) != plan.semester:
            raise serializers.ValidationError(
                "Prüfungsvorgabe gehört in das letzte zugehörige Fachsemester."
            )
        if (
            m.Assessment.objects.filter(plan=plan, module=module)
            .exclude(pk=getattr(instance, "pk", None))
            .exists()
        ):
            raise serializers.ValidationError(
                "Für dieses Modul existiert bereits eine Prüfungsvorlage."
            )
        kind, duration = value("assessment_type"), value("assessment_duration_minutes")
        if kind in TIMED_TYPES:
            if type(duration) is not int or not 1 <= duration <= 1440:
                raise serializers.ValidationError(
                    "Prüfungsdauer von 1 bis 1.440 Minuten angeben."
                )
            if value("due_at"):
                raise serializers.ValidationError(
                    "Für zeitgebundene Prüfungen den Prüfungszeitraum statt einer Abgabefrist planen."
                )
        elif duration is not None:
            raise serializers.ValidationError(
                "Hausarbeiten und Abgaben haben keine Minutendauer."
            )
        if (
            instance
            and m.Exam.objects.filter(assessment_template=instance).exists()
            and (
                value("status") != "open"
                or kind != instance.assessment_type
                or duration != instance.assessment_duration_minutes
            )
        ):
            raise serializers.ValidationError(
                "Prüfung bereits angelegt. Art und Dauer bleiben an der Vorlage erhalten; konkrete Prüfung separat bearbeiten."
            )
    if model == m.Exam:
        source = value("assessment_template")
        if instance and getattr(source, "id", None) != instance.assessment_template_id:
            raise serializers.ValidationError(
                "Die Herkunft der Prüfung bleibt erhalten."
            )
        if source:
            if (
                source.plan_id != value("plan").id
                or source.status != "open"
                or source.assessment_type not in TIMED_TYPES
            ):
                raise serializers.ValidationError(
                    "Offene zeitgebundene Vorlage aus demselben Semesterplan wählen."
                )
            if source.assessment_type != value("assessment_type", "exam"):
                raise serializers.ValidationError(
                    "Prüfungsart muss zur Vorlage passen."
                )
            if value("resit", False):
                raise serializers.ValidationError(
                    "Nachschreibeklausuren separat mit eigener Teilnehmerliste anlegen."
                )
            if (
                m.Exam.objects.filter(assessment_template=source)
                .exclude(pk=getattr(instance, "pk", None))
                .exists()
            ):
                raise serializers.ValidationError(
                    "Für diese Vorlage wurde bereits eine Prüfung angelegt."
                )
            learners = attrs.get(
                "learners", instance.learners.all() if instance else []
            )
            if not learners:
                raise serializers.ValidationError(
                    {"learners": "Prüfungsteilnehmer auswählen."}
                )
