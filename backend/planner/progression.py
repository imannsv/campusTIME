"""Cohort-specific semester assignments and bounded, explainable balancing."""

from math import isfinite

from rest_framework import serializers

from . import models as m

LIMIT_FIELDS = [
    "semester_credit_limit",
    "semester_weekly_limit",
    "semester_difficulty_limit",
]


def context(cohort):
    if not cohort.study_version_id or cohort.study_version.status != "approved":
        raise serializers.ValidationError(
            "Jahrgang mit freigegebener Lehrplanversion wählen."
        )
    modules = list(cohort.study_version.modules.prefetch_related("prerequisites"))
    units = list(
        m.TeachingUnit.objects.filter(
            module__study_version=cohort.study_version
        ).order_by("id")
    )
    children = {
        module.id: [child for child in modules if child.parent_id == module.id]
        for module in modules
    }
    owned = {
        module.id: [unit for unit in units if unit.module_id == module.id]
        for module in modules
    }

    def descendants(module):
        return owned[module.id] + [
            unit for child in children[module.id] for unit in descendants(child)
        ]

    shares, difficulty = {}, {}

    def allocate(module, budget):
        parts, direct = children[module.id], owned[module.id]
        child_credits = sum(float(child.credits) for child in parts)
        weights = (
            [float(child.credits) for child in parts]
            if child_credits
            else [1.0 for _ in parts]
        )
        own_weight = (
            max(float(module.credits) - child_credits, 0)
            if child_credits
            else (1.0 if direct else 0)
        )
        total = sum(weights) + own_weight
        for child, weight in zip(parts, weights, strict=True):
            allocate(child, budget * weight / total if total else 0)
        for unit in direct:
            shares[unit.id] = budget * own_weight / total / len(direct) if total else 0
            difficulty[unit.id] = module.difficulty

    for module in modules:
        if not module.parent_id:
            allocate(module, float(module.credits))
    edges = [
        (before.id, after.id, prerequisite.name, module.name)
        for module in modules
        for prerequisite in module.prerequisites.all()
        for before in descendants(prerequisite)
        for after in descendants(module)
    ]
    locked = set(
        m.Course.objects.filter(
            plan__cohort=cohort, teaching_unit__isnull=False
        ).values_list("teaching_unit_id", flat=True)
    )
    prepared_modules = set(
        m.Assessment.objects.filter(plan__cohort=cohort).values_list(
            "module_id", flat=True
        )
    )
    for module in modules:
        if module.id in prepared_modules:
            locked.update(unit.id for unit in descendants(module))
    return {
        "cohort": cohort,
        "units": units,
        "modules": modules,
        "shares": shares,
        "difficulty": difficulty,
        "edges": edges,
        "locked": locked,
        "duration": cohort.study_version.duration_semesters,
    }


def limits_for(cohort, values=None):
    if values is not None and not isinstance(values, dict):
        raise serializers.ValidationError("Belastungsgrenzen müssen ein Objekt sein.")
    result = {}
    for field in LIMIT_FIELDS:
        try:
            value = float((values or {}).get(field, getattr(cohort, field)))
        except (ValueError, TypeError):
            raise serializers.ValidationError(
                "Belastungsgrenzen müssen Zahlen sein."
            ) from None
        if (
            not isfinite(value)
            or value < 0
            or value > 10000
            or (field != "semester_credit_limit" and value != int(value))
        ):
            raise serializers.ValidationError(
                "Belastungsgrenzen: 0–10.000; UE und Schwierigkeit ganzzahlig."
            )
        if (
            field == "semester_credit_limit"
            and abs(value * 10 - round(value * 10)) > 0.00001
        ):
            raise serializers.ValidationError(
                "CP-Grenze mit maximal einer Nachkommastelle angeben."
            )
        result[field] = value
    return result


def assignments(ctx, changes):
    if not isinstance(changes, dict):
        raise serializers.ValidationError("Semesterverteilung muss ein Objekt sein.")
    units = {str(unit.id): unit for unit in ctx["units"]}
    schedule, pins = {unit.id: unit.semester for unit in ctx["units"]}, set()
    normalized = {}
    for key, value in changes.items():
        if (
            key not in units
            or not isinstance(value, dict)
            or set(value) - {"semester", "pinned"}
        ):
            raise serializers.ValidationError(
                "Nur Lehrveranstaltungen der gewählten Lehrplanversion verschieben."
            )
        semester, pinned = value.get("semester"), value.get("pinned", False)
        if (
            type(semester) is not int
            or not 1 <= semester <= ctx["duration"]
            or type(pinned) is not bool
        ):
            raise serializers.ValidationError(
                "Gültiges Fachsemester und Fixierung angeben."
            )
        unit = units[key]
        old = ctx["cohort"].study_schedule.get(key, {}).get("semester", unit.semester)
        if unit.id in ctx["locked"] and old != semester:
            raise serializers.ValidationError(
                f"{unit.name}: bereits in einem Semesterplan übernommen. Zuerst dort die Veranstaltung bzw. Prüfungsvorlage entfernen."
            )
        schedule[unit.id] = semester
        if pinned:
            pins.add(unit.id)
        if semester != unit.semester or pinned:
            normalized[key] = {"semester": semester, "pinned": pinned}
    # Removing an override also cannot move an already prepared delivery.
    for unit in ctx["units"]:
        old = (
            ctx["cohort"]
            .study_schedule.get(str(unit.id), {})
            .get("semester", unit.semester)
        )
        if unit.id in ctx["locked"] and schedule[unit.id] != old:
            raise serializers.ValidationError(
                f"{unit.name}: Semesterplan besteht bereits; die Zuordnung bleibt erhalten."
            )
    return schedule, pins | ctx["locked"], normalized


def loads(ctx, schedule):
    result = [
        {
            "semester": semester,
            "credits": 0.0,
            "weekly_units": 0.0,
            "total_units": 0,
            "difficulty": 0.0,
            "count": 0,
        }
        for semester in range(1, ctx["duration"] + 1)
    ]
    for unit in ctx["units"]:
        row = result[schedule[unit.id] - 1]
        share = ctx["shares"].get(unit.id, 0)
        row["credits"] += share
        row["difficulty"] += share * ctx["difficulty"].get(unit.id, 2)
        row["count"] += 1
        if unit.target_mode == "weekly":
            row["weekly_units"] += unit.target_units * (
                1 if unit.week_pattern == "all" else 0.5
            )
        else:
            row["total_units"] += unit.target_units
    return result


def caps(ctx, limits):
    return {
        "credits": limits["semester_credit_limit"]
        or sum(ctx["shares"].values()) / ctx["duration"],
        "weekly_units": limits["semester_weekly_limit"],
        "difficulty": limits["semester_difficulty_limit"]
        or sum(
            ctx["shares"].get(unit.id, 0) * ctx["difficulty"].get(unit.id, 2)
            for unit in ctx["units"]
        )
        / ctx["duration"],
    }


def valid(ctx, schedule):
    return all(
        schedule[before] < schedule[after] for before, after, _, _ in ctx["edges"]
    )


def repair(ctx, schedule, pins):
    for _ in range(len(ctx["units"]) * 2 + 1):
        violations = [
            (before, after)
            for before, after, _, _ in ctx["edges"]
            if schedule[before] >= schedule[after]
        ]
        if not violations:
            return schedule
        changed = False
        for before, after in violations:
            if after not in pins and schedule[before] < ctx["duration"]:
                schedule[after] = schedule[before] + 1
                changed = True
            elif before not in pins and schedule[after] > 1:
                schedule[before] = schedule[after] - 1
                changed = True
        if not changed:
            break
    return None


def report(ctx, schedule, limits, normalized):
    errors = sorted(
        {
            f"{after_name}: Voraussetzung {before_name} muss vorher abgeschlossen sein (Semester {schedule[before]} vor Semester {schedule[after]})."
            for before, after, before_name, after_name in ctx["edges"]
            if schedule[before] >= schedule[after]
        }
    )
    rows, boundaries = loads(ctx, schedule), caps(ctx, limits)
    names = {
        "credits": "CP-Anteile",
        "weekly_units": "UE pro Woche",
        "difficulty": "Belastungspunkte",
    }
    warnings = []
    for row in rows:
        row["overloaded"] = False
        for metric, cap in boundaries.items():
            if cap and row[metric] > cap + 0.001:
                warnings.append(
                    f"Semester {row['semester']}: {row[metric]:.1f} {names[metric]} überschreiten die Planungsgrenze {cap:.1f}."
                )
                row["overloaded"] = True
        for metric in ["credits", "difficulty", "weekly_units"]:
            row[metric] = round(row[metric], 2)
    return {
        "revision": ctx["cohort"].institution.revision,
        "schedule": normalized,
        "limits": limits,
        "caps": boundaries,
        "semesters": rows,
        "errors": errors,
        "warnings": warnings,
        "entries": [
            {
                "id": unit.id,
                "name": unit.name,
                "module": unit.module_id,
                "standard_semester": unit.semester,
                "semester": schedule[unit.id],
                "pinned": normalized.get(str(unit.id), {}).get("pinned", False),
                "locked": unit.id in ctx["locked"],
                "credits": round(ctx["shares"].get(unit.id, 0), 2),
                "difficulty": ctx["difficulty"].get(unit.id, 2),
            }
            for unit in ctx["units"]
        ],
    }


def progression(cohort, changes=None, limit_values=None, propose=False):
    ctx = context(cohort)
    schedule, pins, normalized = assignments(
        ctx, cohort.study_schedule if changes is None else changes
    )
    limits = limits_for(cohort, limit_values)
    initial = dict(schedule)
    if not propose:
        return report(ctx, schedule, limits, normalized)
    # Repair prerequisite order first, while preserving administrative pins.
    schedule = repair(ctx, schedule, pins)
    if schedule is None:
        result = report(ctx, initial, limits, normalized)
        return {
            **result,
            "moves": [],
            "message": "Voraussetzungen lassen sich mit den fixierten Semestern nicht erfüllen. Fixierungen oder Verschiebungen prüfen.",
        }
    boundaries = caps(ctx, limits)

    def score(candidate):
        value = 0.0
        for row in loads(ctx, candidate):
            for metric, cap in boundaries.items():
                if cap:
                    ratio = row[metric] / cap
                    value += ratio * ratio + 12 * max(0, ratio - 1) ** 2
        return value + 0.03 * sum(
            abs(candidate[key] - initial[key]) for key in candidate
        )

    movable = [unit.id for unit in ctx["units"] if unit.id not in pins]
    evaluated = 0
    for _ in range(12):
        best, best_score = None, score(schedule)
        for unit in movable:
            for semester in range(1, ctx["duration"] + 1):
                if evaluated >= 10000:
                    break
                evaluated += 1
                candidate = {**schedule, unit: semester}
                candidate = repair(ctx, candidate, pins | {unit})
                if candidate is not None:
                    value = score(candidate)
                    if value < best_score - 0.000001:
                        best, best_score = candidate, value
        # Swaps can improve balance where no isolated move does.
        if best is None:
            for i, left in enumerate(movable):
                for right in movable[i + 1 :]:
                    if evaluated >= 10000:
                        break
                    evaluated += 1
                    if schedule[left] == schedule[right]:
                        continue
                    candidate = {
                        **schedule,
                        left: schedule[right],
                        right: schedule[left],
                    }
                    candidate = repair(ctx, candidate, pins | {left, right})
                    if candidate is not None:
                        value = score(candidate)
                        if value < best_score - 0.000001:
                            best, best_score = candidate, value
        if best is None:
            break
        schedule = best
    normalized = {
        str(unit.id): {
            "semester": schedule[unit.id],
            "pinned": str(unit.id) in normalized and normalized[str(unit.id)]["pinned"],
        }
        for unit in ctx["units"]
        if schedule[unit.id] != unit.semester
        or str(unit.id) in normalized
        and normalized[str(unit.id)]["pinned"]
    }
    result = report(ctx, schedule, limits, normalized)
    moves = [
        {
            "id": unit.id,
            "name": unit.name,
            "from": initial[unit.id],
            "to": schedule[unit.id],
        }
        for unit in ctx["units"]
        if initial[unit.id] != schedule[unit.id]
    ]
    return {
        **result,
        "moves": moves,
        "message": "Vorschlag berücksichtigt Voraussetzungen, Fixierungen und Semesterbelastung. Vor dem Speichern fachlich prüfen."
        if moves
        else "Mit diesen Grenzen und Fixierungen wurde keine weitere Verbesserung gefunden.",
    }


def effective_semester(cohort, unit):
    return cohort.study_schedule.get(str(unit.id), {}).get("semester", unit.semester)
