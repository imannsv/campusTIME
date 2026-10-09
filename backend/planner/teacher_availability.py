"""Dated teacher blocks cancel appointments without deleting their history."""
from . import models as m
from .services import dt


def affected_session_ids(person, blocks):
    if person.kind != "teacher":
        return set()
    ids = set()
    for block in blocks:
        sessions = m.Session.objects.filter(
            institution_id=person.institution_id, cancelled=False,
            start__lt=dt(block["end"]), end__gt=dt(block["start"]),
        ).select_related("course", "exam").prefetch_related(
            "teachers", "course__teachers", "exam__supervisors",
        )
        for session in sessions:
            team = list(session.teachers.all())
            if not team:
                entity = session.exam or session.course
                if entity is None:
                    continue
                team = list(entity.supervisors.all() if session.exam else entity.teachers.all())
            if person.id in {teacher.id for teacher in team}:
                ids.add(session.id)
    return ids


def cancel_for_teacher(person):
    ids = affected_session_ids(person, person.availability.get("exclusions", []))
    return m.Session.objects.filter(institution_id=person.institution_id, id__in=ids).update(cancelled=True)


def cancellation_map(institution):
    return set(m.Session.objects.filter(institution=institution, cancelled=True).values_list("plan_id", "id"))


def overlay_cancellations(rows, institution, plan_id=None):
    cancelled = cancellation_map(institution)
    return [
        {**row, "cancelled": bool(row.get("cancelled") or ((plan_id if plan_id is not None else row.get("plan_id")), row.get("id")) in cancelled)}
        for row in rows
    ]
