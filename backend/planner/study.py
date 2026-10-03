"""Versioned study structures and non-destructive semester preparation."""

from decimal import Decimal

from django.db import transaction
from rest_framework import serializers

from . import models as m


def owner_version(instance):
    if isinstance(instance, m.StudyVersion):
        return instance
    if isinstance(instance, m.Module):
        return instance.study_version
    if isinstance(instance, m.TeachingUnit):
        return instance.module.study_version
    return None


def validate_study(model, instance, attrs, institution):
    def value(key, default=None):
        return attrs.get(key, getattr(instance, key, default))

    current = owner_version(instance)
    if current:
        current.refresh_from_db()
    if current and current.status == "approved":
        raise serializers.ValidationError(
            "Freigegebene Lehrplanversionen sind unveränderlich. Eine neue Version als Kopie anlegen."
        )
    if model in [m.Program, m.StudyVersion]:
        if (
            not 1 <= value("duration_semesters", 6) <= 24
            or not 0 <= value("total_credits", 180) <= 10000
        ):
            raise serializers.ValidationError(
                "Regelstudienzeit: 1–24 Semester; Credit Points: 0–10.000."
            )
    if model == m.Module:
        version = value("study_version")
        version.refresh_from_db()
        if version.status == "approved":
            raise serializers.ValidationError(
                "Freigegebene Lehrplanversion ist unveränderlich."
            )
        if instance and version.id != instance.study_version_id:
            raise serializers.ValidationError(
                "Module können nicht in eine andere Version verschoben werden."
            )
        parent = value("parent")
        visited = {instance.id} if instance else set()
        while parent:
            if (
                parent.id in visited
                or parent.study_version_id != version.id
                or len(visited) >= 12
            ):
                raise serializers.ValidationError(
                    "Obermodul muss in derselben Version liegen; keine zyklische Zuordnung."
                )
            visited.add(parent.id)
            parent = parent.parent
        if not 0 <= value("credits", 0) <= 10000:
            raise serializers.ValidationError(
                "Credit Points müssen zwischen 0 und 10.000 liegen."
            )
        prerequisites = attrs.get(
            "prerequisites", instance.prerequisites.all() if instance else []
        )
        if any(
            item.study_version_id != version.id or (instance and item.id == instance.id)
            for item in prerequisites
        ):
            raise serializers.ValidationError(
                "Voraussetzungen müssen andere Module derselben Version sein."
            )
    if model == m.TeachingUnit:
        version = value("module").study_version
        version.refresh_from_db()
        if version.status == "approved":
            raise serializers.ValidationError(
                "Freigegebene Lehrplanversion ist unveränderlich."
            )
        if instance and version.id != instance.module.study_version_id:
            raise serializers.ValidationError(
                "Lehrveranstaltungen können nicht in eine andere Version verschoben werden."
            )
        if not 1 <= value("semester", 1) <= version.duration_semesters:
            raise serializers.ValidationError(
                "Fachsemester liegt außerhalb der Regelstudienzeit."
            )
        if (
            not 1 <= value("target_units", 2) <= 10000
            or not 1 <= value("duration_minutes", 90) <= 1440
            or not 1 <= value("block_days", 1) <= 7
        ):
            raise serializers.ValidationError(
                "Unterrichtsumfang, Dauer oder Blocktage ungültig."
            )
        days = value("block_days", 1)
        if days > 1 and (
            value("target_mode", "weekly") != "total"
            or value("target_units", 2)
            * institution.unit_minutes
            % (value("duration_minutes", 90) * days)
        ):
            raise serializers.ValidationError(
                "Mehrtagige Blöcke benötigen einen passenden Gesamtumfang."
            )
        if any(person.kind != "teacher" for person in attrs.get("teachers", [])):
            raise serializers.ValidationError("Nur Lehrende auswählen.")
    if model == m.Cohort:
        version = value("study_version")
        if version:
            version.refresh_from_db()
        if version and (
            version.program_id != value("program").id or version.status != "approved"
        ):
            raise serializers.ValidationError(
                "Freigegebene Lehrplanversion des gewählten Studiengangs auswählen."
            )
        if (
            instance
            and instance.study_version_id
            and (not version or version.id != instance.study_version_id)
        ):
            raise serializers.ValidationError(
                "Die Lehrplanversion dieses Jahrgangs bleibt fest zugeordnet."
            )
        if value("entry_year") and not 1900 <= value("entry_year") <= 2200:
            raise serializers.ValidationError("Gültiges Aufnahmejahr angeben.")
    if model == m.Plan:
        cohort = value("cohort")
        semester = value("semester", 1)
        if semester < 1 or (
            cohort
            and cohort.study_version_id
            and semester > cohort.study_version.duration_semesters
        ):
            raise serializers.ValidationError("Gültiges Fachsemester wählen.")
        if (
            instance
            and instance.course_set.filter(teaching_unit__isnull=False).exists()
            and (
                getattr(cohort, "id", None) != instance.cohort_id
                or semester != instance.semester
            )
        ):
            raise serializers.ValidationError(
                "Für ein anderes Fachsemester oder einen anderen Jahrgang einen neuen Plan anlegen."
            )
    if (
        model == m.Course
        and instance
        and instance.teaching_unit_id
        and getattr(value("teaching_unit"), "id", None) != instance.teaching_unit_id
    ):
        raise serializers.ValidationError(
            "Die Herkunft aus der Studienstruktur bleibt erhalten."
        )
    if model == m.Course and value("teaching_unit"):
        unit, plan = value("teaching_unit"), value("plan")
        group = value("study_group")
        if (
            unit.group_mode == "per_group"
            and (not group or group.cohort_id != plan.cohort_id)
        ) or (unit.group_mode == "combined" and group):
            raise serializers.ValidationError(
                "Gruppe der Studienstruktur passt nicht zur Durchführung."
            )
        if (
            instance
            and instance.teaching_unit_id
            and getattr(group, "id", None) != instance.study_group_id
        ):
            raise serializers.ValidationError("Die Herkunftsgruppe bleibt erhalten.")
        if (
            not plan.cohort_id
            or plan.cohort.study_version_id != unit.module.study_version_id
            or plan.semester != unit.semester
        ):
            raise serializers.ValidationError(
                "Lehrveranstaltung passt nicht zur Lehrplanversion und zum Fachsemester des Plans."
            )
        if (
            m.Course.objects.filter(
                plan=plan, teaching_unit=unit, study_group=value("study_group")
            )
            .exclude(pk=getattr(instance, "pk", None))
            .exists()
        ):
            raise serializers.ValidationError(
                "Diese Lehrveranstaltung ist bereits im Semesterplan vorhanden."
            )


def structure_report(version):
    modules = list(version.modules.prefetch_related("prerequisites"))
    units = list(
        m.TeachingUnit.objects.filter(module__study_version=version).prefetch_related(
            "teachers"
        )
    )
    errors, warnings = [], []
    by_id = {module.id: module for module in modules}
    children = {
        module.id: [child for child in modules if child.parent_id == module.id]
        for module in modules
    }
    roots = [module for module in modules if not module.parent_id]
    credits = sum((module.credits for module in roots), Decimal(0))
    if not modules:
        errors.append("Noch keine Module angelegt.")
    if credits != version.total_credits:
        errors.append(
            f"Obermodule umfassen {credits} statt {version.total_credits} Credit Points."
        )

    def descendants(module_id, visited=None):
        visited = set() if visited is None else visited
        if module_id in visited:
            errors.append("Zyklische Modulstruktur.")
            return set()
        visited = visited | {module_id}
        return {module_id} | set().union(
            *(descendants(child.id, visited) for child in children.get(module_id, []))
        )

    semesters = {}
    for module in modules:
        ids = descendants(module.id)
        semesters[module.id] = [
            unit.semester for unit in units if unit.module_id in ids
        ]
        if not semesters[module.id]:
            errors.append(f"{module.name}: keine Lehrveranstaltung zugeordnet.")
        part_credits = sum((child.credits for child in children[module.id]), Decimal(0))
        if children[module.id] and part_credits and part_credits != module.credits:
            errors.append(
                f"{module.name}: Teilmodule umfassen {part_credits} statt {module.credits} Credit Points."
            )
        for prerequisite in module.prerequisites.all():
            if prerequisite.id not in by_id:
                errors.append(
                    f"{module.name}: Voraussetzung liegt in einer anderen Lehrplanversion."
                )
    for module in modules:
        for prerequisite in module.prerequisites.all():
            before = semesters.get(prerequisite.id, [])
            after = semesters.get(module.id, [])
            if before and after and max(before) >= min(after):
                errors.append(
                    f"{module.name}: Voraussetzung {prerequisite.name} muss in einem früheren Semester liegen."
                )
    for semester in range(1, version.duration_semesters + 1):
        if not any(unit.semester == semester for unit in units):
            errors.append(f"Semester {semester}: noch keine Lehrveranstaltungen.")
    for unit in units:
        if not 1 <= unit.semester <= version.duration_semesters:
            errors.append(f"{unit.name}: Semester außerhalb der Regelstudienzeit.")
        if not unit.teachers.exists():
            warnings.append(f"{unit.name}: Lehrende bei der Semesterplanung ergänzen.")
    return {
        "errors": sorted(set(errors)),
        "warnings": warnings,
        "credits": str(credits),
        "module_count": len(modules),
        "unit_count": len(units),
    }


@transaction.atomic
def clone_version(source, code, name, version):
    if not code or not name or not version:
        raise serializers.ValidationError(
            "Kennung, Name und Versionsbezeichnung angeben."
        )
    if m.StudyVersion.objects.filter(
        institution=source.institution, code=code
    ).exists():
        raise serializers.ValidationError("Kennung ist bereits vergeben.")
    target = m.StudyVersion.objects.create(
        institution=source.institution,
        program=source.program,
        code=code,
        name=name,
        version=version,
        duration_semesters=source.duration_semesters,
        total_credits=source.total_credits,
    )
    mapping = {}
    modules = list(source.modules.all())
    for module in modules:
        mapping[module.id] = m.Module.objects.create(
            institution=source.institution,
            study_version=target,
            code=f"SV{target.id}-M{module.id}",
            name=module.name,
            credits=module.credits,
        )
    for module in modules:
        copy = mapping[module.id]
        copy.parent = mapping.get(module.parent_id)
        copy.save()
        copy.prerequisites.set(mapping[item.id] for item in module.prerequisites.all())
    for unit in m.TeachingUnit.objects.filter(module__study_version=source):
        copy = m.TeachingUnit.objects.create(
            institution=source.institution,
            module=mapping[unit.module_id],
            code=f"SV{target.id}-L{unit.id}",
            **{
                field: getattr(unit, field)
                for field in [
                    "name",
                    "semester",
                    "format",
                    "group_mode",
                    "target_mode",
                    "target_units",
                    "duration_minutes",
                    "block_days",
                    "week_pattern",
                    "elective",
                    "equipment",
                ]
            },
        )
        copy.teachers.set(unit.teachers.all())
    return target


def prepare_semester(plan, group_ids=None):
    if not plan.cohort_id or not plan.cohort.study_version_id:
        raise serializers.ValidationError(
            "Jahrgang mit freigegebener Lehrplanversion auswählen."
        )
    version = plan.cohort.study_version
    if (
        version.status != "approved"
        or not 1 <= plan.semester <= version.duration_semesters
    ):
        raise serializers.ValidationError(
            "Freigegebene Lehrplanversion und gültiges Fachsemester erforderlich."
        )
    groups = m.Group.objects.filter(cohort=plan.cohort, institution=plan.institution)
    if group_ids is not None:
        requested = set(group_ids)
        groups = groups.filter(id__in=requested)
        if set(groups.values_list("id", flat=True)) != requested:
            raise serializers.ValidationError(
                "Gruppen müssen zum gewählten Jahrgang gehören."
            )
    groups = list(groups)
    if not groups:
        raise serializers.ValidationError(
            "Zuerst mindestens eine Gruppe für den Jahrgang anlegen."
        )
    units = list(
        m.TeachingUnit.objects.filter(
            module__study_version=version, semester=plan.semester
        ).prefetch_related("teachers")
    )
    if not units:
        raise serializers.ValidationError(
            "Für dieses Fachsemester sind keine Lehrveranstaltungen hinterlegt."
        )
    created, warnings, total = 0, [], 0
    for unit in units:
        deliveries = (
            [[group] for group in groups]
            if unit.group_mode == "per_group"
            else [groups]
        )
        for assigned in deliveries:
            total += 1
            study_group = assigned[0] if unit.group_mode == "per_group" else None
            origin = m.Course.objects.filter(
                institution=plan.institution,
                plan=plan,
                teaching_unit=unit,
                study_group=study_group,
            ).exists()
            code = f"PLAN{plan.id}-LEHRE{unit.id}" + (
                f"-GR{study_group.id}" if study_group else ""
            )
            if (
                not origin
                and m.Course.objects.filter(
                    institution=plan.institution, code=code
                ).exists()
            ):
                raise serializers.ValidationError(
                    f"Kennung {code} ist bereits vergeben. Den vorhandenen Eintrag umbenennen."
                )
            course, new = m.Course.objects.get_or_create(
                institution=plan.institution,
                plan=plan,
                teaching_unit=unit,
                study_group=study_group,
                defaults={
                    "code": code,
                    **{
                        field: getattr(unit, field)
                        for field in [
                            "name",
                            "target_mode",
                            "target_units",
                            "duration_minutes",
                            "block_days",
                            "week_pattern",
                            "elective",
                            "equipment",
                        ]
                    },
                },
            )
            if new:
                created += 1
                if study_group:
                    course.name = f"{unit.name} · {study_group.name}"
                    course.save(update_fields=["name"])
                course.groups.set(assigned)
                course.teachers.set(unit.teachers.all())
            if not course.teachers.exists():
                warnings.append(f"{course.name}: Lehrende zuordnen.")
            if course.elective and not course.learners.exists():
                warnings.append(
                    f"{course.name}: konkrete Wahlpflichtteilnehmer auswählen."
                )
    return {"created": created, "existing": total - created, "warnings": warnings}
