"""Authenticated resource timelines; never return learner rosters."""

import re
from datetime import date, datetime, time, timedelta
from types import SimpleNamespace
from zoneinfo import ZoneInfo

from rest_framework import serializers

from . import models as m
from .services import block_rows, dt, latest_publications


def date_range(params, institution):
    zone = ZoneInfo(institution.timezone)
    today = datetime.now(zone).date().isoformat()
    values = [params.get("start", today), params.get("end", params.get("start", today))]
    try:
        if any(not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value) for value in values):
            raise ValueError
        start, end = [date.fromisoformat(value) for value in values]
        if end < start or (end - start).days > 30:
            raise ValueError
    except (ValueError, TypeError):
        raise serializers.ValidationError(
            "Bitte einen Zeitraum von 1 bis 31 Tagen wählen."
        ) from None
    source = params.get("source", "planning")
    if source not in ("planning", "published"):
        raise serializers.ValidationError("Unbekannter Planungsstand.")
    return (
        start,
        end,
        source,
        datetime.combine(start, time.min, zone),
        datetime.combine(end + timedelta(days=1), time.min, zone),
    )


def signature(row):
    return (
        dt(row["start"]).timestamp(),
        dt(row["end"]).timestamp(),
        row["name"],
        tuple(sorted(row.get("room_ids", []))),
        tuple(sorted(row.get("teacher_ids", []))),
        row.get("course"),
        row.get("exam"),
        tuple(sorted(row.get("group_names", []))),
    )


def overview(institution, params):
    start, end, source, lower, upper = date_range(params, institution)
    teachers = list(
        m.Person.objects.filter(institution=institution, kind="teacher")
        .order_by("name", "id")
        .values("id", "name", "code")
    )
    rooms = list(
        m.Room.objects.filter(institution=institution)
        .order_by("name", "id")
        .values("id", "name", "code", "floor", "capacity", "equipment")
    )
    teacher_names = {item["id"]: item["name"] for item in teachers}
    room_names = {item["id"]: item["name"] for item in rooms}
    plans = dict(m.Plan.objects.filter(institution=institution).values_list("id", "name"))
    published = {}
    rows = []

    def safe_row(row, plan_id, status):
        room_ids = [pk for pk in row.get("room_ids", []) if pk in room_names]
        teacher_ids = [pk for pk in row.get("teacher_ids", []) if pk in teacher_names]
        return {
            "id": row.get("id"),
            "plan_id": plan_id,
            "plan_name": plans.get(plan_id, ""),
            "name": row["name"],
            "start": row["start"],
            "end": row["end"],
            "room_ids": room_ids,
            "room_names": [room_names[pk] for pk in room_ids],
            "teacher_ids": teacher_ids,
            "teacher_names": [teacher_names[pk] for pk in teacher_ids],
            "group_names": row.get("group_names", []),
            "color": row.get("color", "blue"),
            "kind": "exam" if row.get("exam") else "teaching",
            "status": status,
        }

    for publication in latest_publications(institution):
        for row in publication.snapshot:
            published[(publication.plan_id, row.get("id"))] = signature(row)
            if (
                source == "published"
                and dt(row["start"]) < upper
                and dt(row["end"]) > lower
            ):
                rows.append(safe_row(row, publication.plan_id, "published"))

    if source == "planning":
        sessions = (
            m.Session.objects.filter(
                institution=institution,
                plan__institution=institution,
                start__lt=upper,
                end__gt=lower,
            )
            .select_related("course", "exam")
            .prefetch_related(
                "rooms", "teachers", "course__teachers", "course__groups",
                "exam__supervisors",
            )
        )
        for session in sessions:
            entity = session.exam or session.course
            if entity is None or entity.institution_id != institution.id:
                continue
            assigned = list(session.teachers.all()) or list(
                entity.supervisors.all() if session.exam else entity.teachers.all()
            )
            if session.exam:
                groups = [
                    "Nachschreibeklausur" if entity.resit
                    else entity.get_assessment_type_display()
                ]
            else:
                groups = [
                    group.name for group in entity.groups.all()
                    if group.institution_id == institution.id
                ]
            row = {
                "id": session.id,
                "name": session.name or entity.name,
                "start": session.start.isoformat(),
                "end": session.end.isoformat(),
                "room_ids": [room.id for room in session.rooms.all()],
                "teacher_ids": [person.id for person in assigned],
                "course": session.course_id,
                "exam": session.exam_id,
                "group_names": groups,
                "color": "rose" if session.exam else entity.color,
            }
            status = (
                "published"
                if published.get((session.plan_id, session.id)) == signature(row)
                else "draft"
            )
            rows.append(safe_row(row, session.plan_id, status))

    for row in block_rows(institution, SimpleNamespace(start=start, end=end)):
        if dt(row["start"]) < upper and dt(row["end"]) > lower:
            rows.append({
                **safe_row(row, None, "blocked"), "id": None,
                "kind": "block", "color": "amber",
            })
    return {
        "teachers": teachers,
        "rooms": rooms,
        "rows": sorted(rows, key=lambda row: (row["start"], row["name"])),
        "start": start.isoformat(),
        "end": end.isoformat(),
        "source": source,
    }
