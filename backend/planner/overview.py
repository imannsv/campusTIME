"""Public filtering uses publication metadata, never exposes learner rosters."""

from collections import defaultdict

from rest_framework import serializers

from . import models as m


def enrich_snapshot(rows, institution_id, models=m):
    """Freeze safe filter labels and associations when a plan is published.

    Historical snapshots use their stored group names and participant IDs to
    recover associations once. The resulting scope contains no participant IDs.
    The optional model namespace also supports historical migration models.
    """
    if all("overview_scope" in row for row in rows):
        return rows
    groups = {
        group.id: {
            "id": group.id,
            "name": group.name,
            "cohort": group.cohort_id,
            "cohort_name": group.cohort.name,
        }
        for group in models.Group.objects.filter(
            institution_id=institution_id
        ).select_related("cohort")
    }
    memberships = defaultdict(set)
    learner_ids = {pk for row in rows for pk in row.get("learner_ids", [])}
    for person_id, group_id in models.Person.objects.filter(
        institution_id=institution_id, kind="learner", id__in=learner_ids
    ).values_list("id", "groups__id"):
        if group_id in groups:
            memberships[person_id].add(group_id)
    exam_ids = {row.get("exam") for row in rows if row.get("exam")}
    exam_courses = dict(
        models.Exam.objects.filter(
            institution_id=institution_id, id__in=exam_ids
        ).values_list("id", "course_id")
    )
    course_ids = {row.get("course") for row in rows} | set(exam_courses.values())
    course_names = dict(
        models.Course.objects.filter(
            institution_id=institution_id, id__in=course_ids
        ).values_list("id", "name")
    )
    # Prefer a published course title over a later draft name.
    for row in rows:
        if row.get("course"):
            course_names[row["course"]] = row.get("course_name", row["name"])
    result = []
    for row in rows:
        if "overview_scope" in row:
            result.append(row)
            continue
        group_ids = {
            pk
            for pk, group in groups.items()
            if group["name"] in row.get("group_names", [])
        }
        if "group_ids" in row:
            group_ids = set(row["group_ids"]) & groups.keys()
        if row.get("exam") or not group_ids:
            group_ids |= {
                group_id
                for pk in row.get("learner_ids", [])
                for group_id in memberships[pk]
            }
        course_id = row.get("course") or exam_courses.get(row.get("exam"))
        scope = {
            "groups": [groups[pk] for pk in sorted(group_ids)],
            "course": f"course:{course_id}" if course_id else f"exam:{row.get('exam')}",
            "course_name": course_names.get(course_id, row["name"]),
        }
        result.append({**row, "overview_scope": scope})
    return result


def catalog_for(rows):
    cohorts, groups, courses = {}, {}, {}
    for row in rows:
        scope = row["overview_scope"]
        course = courses.setdefault(
            scope["course"],
            {
                "id": scope["course"],
                "name": scope["course_name"],
                "group_ids": set(),
                "cohort_ids": set(),
            },
        )
        for group in scope["groups"]:
            cohorts[group["cohort"]] = {
                "id": group["cohort"],
                "name": group["cohort_name"],
            }
            groups[group["id"]] = {
                "id": group["id"],
                "name": group["name"],
                "cohort": group["cohort"],
            }
            course["group_ids"].add(group["id"])
            course["cohort_ids"].add(group["cohort"])
    for course in courses.values():
        course["group_ids"] = sorted(course["group_ids"])
        course["cohort_ids"] = sorted(course["cohort_ids"])
    return {
        key: sorted(items.values(), key=lambda item: (item["name"], str(item["id"])))
        for key, items in [
            ("cohorts", cohorts),
            ("groups", groups),
            ("courses", courses),
        ]
    }


def overview_filters(query, catalog):
    result = {}
    for key, resource in [
        ("cohort", "cohorts"),
        ("group", "groups"),
        ("course", "courses"),
    ]:
        value = query.get(key)
        if value:
            if value not in {str(item["id"]) for item in catalog[resource]}:
                raise serializers.ValidationError(
                    {key: "Auswahl ist in dieser Übersicht nicht verfügbar."}
                )
            result[key] = value
    return result


def matches_scope(row, filters):
    scope = row["overview_scope"]
    return (
        (not filters.get("course") or scope["course"] == filters["course"])
        and (
            not filters.get("group")
            or any(str(group["id"]) == filters["group"] for group in scope["groups"])
        )
        and (
            not filters.get("cohort")
            or any(
                str(group["cohort"]) == filters["cohort"] for group in scope["groups"]
            )
        )
    )
