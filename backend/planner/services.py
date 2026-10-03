from collections import defaultdict
from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from django.db.models import Max

from .models import Course, Exam, Person, Publication, Room, RoomBlock


def dt(value):
    return (
        datetime.fromisoformat(value.replace("Z", "+00:00"))
        if isinstance(value, str)
        else value
    )


def local(value, institution):
    return dt(value).astimezone(ZoneInfo(institution.timezone))


def attendance(course):
    explicit = {p.id for p in course.learners.all()}
    if course.elective:
        return explicit, len(explicit), set()
    ids, unknown, group_resources = set(explicit), 0, set()
    for group in course.groups.all():
        roster = {p.id for p in group.people.all() if p.kind == "learner"}
        ids |= roster
        unknown += max(0, group.size - len(roster))
        if group.size > len(roster):
            group_resources.add(group.id)
    return ids, len(ids) + unknown, group_resources


def entity_data(entity):
    if isinstance(entity, Course):
        ids, count, groups = attendance(entity)
        return {
            "learner_ids": sorted(ids),
            "count": count,
            "group_resources": sorted(groups),
            "group_names": [g.name for g in entity.groups.all()],
            "teacher_ids": [p.id for p in entity.teachers.all()],
            "color": entity.color,
            "equipment": entity.equipment,
        }
    ids = {p.id for p in entity.learners.all()}
    return {
        "learner_ids": sorted(ids),
        "count": len(ids),
        "group_resources": [],
        "group_names": ["Nachschreibeklausur" if entity.resit else "Klausur"],
        "teacher_ids": [p.id for p in entity.supervisors.all()],
        "color": "rose",
        "equipment": entity.equipment,
    }


def exam_allocation(row, rooms):
    if not row.get("exam"):
        return []
    learners = list(row["learner_ids"])
    allocation = []
    for index, room in enumerate(rooms):
        assigned = learners[: room.capacity]
        learners = learners[room.capacity :]
        allocation.append(
            {
                "room_id": room.id,
                "room_name": room.name,
                "learner_ids": assigned,
                "supervisor_id": row["teacher_ids"][index]
                if index < len(row["teacher_ids"])
                else None,
            }
        )
    return allocation


def session_row(session, cached_data=None):
    entity = session.exam or session.course
    data = cached_data if cached_data is not None else entity_data(entity)
    assigned = [p.id for p in session.teachers.all()] or data["teacher_ids"]
    rooms = list(session.rooms.all())
    row = {
        **data,
        "id": session.id,
        "plan_id": session.plan_id,
        "course": session.course_id,
        "exam": session.exam_id,
        "name": session.name or entity.name,
        "start": session.start.isoformat(),
        "end": session.end.isoformat(),
        "room_ids": [r.id for r in rooms],
        "room_names": [r.name for r in rooms],
        "teacher_ids": assigned,
        "teacher_names": list(
            Person.objects.filter(id__in=assigned).values_list("name", flat=True)
        ),
        "locked": session.locked,
    }
    row["room_allocations"] = exam_allocation(row, rooms)
    return row


def plan_rows(plan):
    entities = {}
    for c in Course.objects.filter(plan=plan).prefetch_related(
        "learners", "teachers", "groups__people"
    ):
        entities[("course", c.id)] = entity_data(c)
    for e in Exam.objects.filter(plan=plan).prefetch_related("learners", "supervisors"):
        entities[("exam", e.id)] = entity_data(e)
    return [
        session_row(
            s, entities[("exam", s.exam_id) if s.exam_id else ("course", s.course_id)]
        )
        for s in plan.sessions.select_related("course", "exam").prefetch_related(
            "rooms", "teachers"
        )
    ]


def latest_publications(institution):
    latest = (
        Publication.objects.filter(institution=institution)
        .values("plan_id")
        .annotate(n=Max("number"))
    )
    return [
        Publication.objects.get(plan_id=p["plan_id"], number=p["n"]) for p in latest
    ]


def external_rows(plan):
    return [
        row
        for publication in latest_publications(plan.institution)
        if publication.plan_id != plan.id
        for row in publication.snapshot
    ]


def block_rows(institution, period):
    rows = []
    for block in RoomBlock.objects.filter(institution=institution).prefetch_related(
        "rooms"
    ):
        start, end = block.start, block.end
        limit = block.repeat_until or local(end, institution).date()
        while True:
            if (
                local(start, institution).date() <= period.end
                and local(end, institution).date() >= period.start
            ):
                rows.append(
                    {
                        "start": start.isoformat(),
                        "end": end.isoformat(),
                        "room_ids": list(block.rooms.values_list("id", flat=True)),
                        "teacher_ids": [],
                        "learner_ids": [],
                        "group_resources": [],
                        "name": block.name,
                        "block": True,
                    }
                )
            if not block.repeat_weekly:
                break
            start, end = (
                local(start, institution) + timedelta(days=7),
                local(end, institution) + timedelta(days=7),
            )
            if local(start, institution).date() > min(limit, period.end):
                break
    return rows


def resource_keys(row):
    return (
        [("room", n) for n in row.get("room_ids", [])]
        + [
            ("person", n)
            for n in row.get("teacher_ids", []) + row.get("learner_ids", [])
        ]
        + [("group", n) for n in row.get("group_resources", [])]
    )


def available(person, start, end, institution):
    a = person.availability or {}
    s, e = local(start, institution), local(end, institution)
    if s.date() != e.date():
        return False
    if "windows" in a:
        if not any(
            s.weekday() == window["weekday"]
            and time.fromisoformat(window["from"]) <= s.time().replace(tzinfo=None)
            and e.time().replace(tzinfo=None) <= time.fromisoformat(window["to"])
            for window in a["windows"]
        ):
            return False
        return not any(
            s < dt(x["end"]) and dt(x["start"]) < e for x in a.get("exclusions", [])
        )
    if s.weekday() not in a.get("weekdays", [0, 1, 2, 3, 4]):
        return False
    if s.strftime("%H:%M") < a.get("from", "00:00") or e.strftime("%H:%M") > a.get(
        "to", "23:59"
    ):
        return False
    return not any(
        s < dt(x["end"]) and dt(x["start"]) < e for x in a.get("exclusions", [])
    )


def course_chunks(course):
    """(allowed dates, duration, stable occurrence index, weekly template key)."""
    period = course.plan.period
    days = []
    d = period.start
    monday = d - timedelta(days=d.weekday())
    while d <= period.end:
        week = (d - monday).days // 7
        if (
            d.weekday() in period.weekdays
            and d.isoformat() not in period.excluded_dates
            and (
                course.week_pattern == "all"
                or course.week_pattern == ("A" if week % 2 == 0 else "B")
            )
        ):
            days.append(d)
        d += timedelta(days=1)

    def chunks(minutes):
        result = []
        while minutes:
            duration = min(minutes, course.duration_minutes)
            result.append(duration)
            minutes -= duration
        return result

    if course.target_mode == "total":
        return [
            (days, duration, i, None)
            for i, duration in enumerate(
                chunks(course.target_units * course.institution.unit_minutes)
            )
        ]
    weeks = defaultdict(list)
    for day in days:
        weeks[(day - monday).days // 7].append(day)
    result = []
    for week_days in weeks.values():
        for i, duration in enumerate(
            chunks(course.target_units * course.institution.unit_minutes)
        ):
            result.append((week_days, duration, len(result), i))
    return result


def validate_rows(plan, rows, coverage=False):
    institution, period = plan.institution, plan.period
    problems = []
    room_map = {r.id: r for r in Room.objects.filter(institution=institution)}
    person_map = {
        p.id: p for p in Person.objects.filter(institution=institution, kind="teacher")
    }
    courses = {
        c.id: c
        for c in Course.objects.filter(plan=plan).prefetch_related(
            "learners", "teachers", "groups__people"
        )
    }
    exams = {
        e.id: e
        for e in Exam.objects.filter(plan=plan).prefetch_related(
            "learners", "supervisors"
        )
    }
    for row in rows:
        label = row["name"]
        start, end = local(row["start"], institution), local(row["end"], institution)
        entity = (
            exams.get(row.get("exam"))
            if row.get("exam")
            else courses.get(row.get("course"))
        )
        if not entity:
            problems.append(f"{label}: Veranstaltung gehört nicht zu diesem Plan.")
            continue
        if end <= start or start.date() != end.date():
            problems.append(f"{label}: Ungültige Dauer.")
            continue
        if (
            not (period.start <= start.date() <= period.end)
            or start.weekday() not in period.weekdays
            or start.date().isoformat() in period.excluded_dates
        ):
            problems.append(f"{label}: Termin außerhalb des Unterrichtskalenders.")
        if (
            start.time().replace(tzinfo=None) < period.day_start
            or end.time().replace(tzinfo=None) > period.day_end
        ):
            problems.append(f"{label}: Termin außerhalb des Zeitrasters.")
        minutes_from_start = (start.hour * 60 + start.minute) - (
            period.day_start.hour * 60 + period.day_start.minute
        )
        if minutes_from_start % period.slot_minutes:
            problems.append(f"{label}: Beginn passt nicht ins Zeitraster.")
        room_ids = row.get("room_ids", [])
        if not room_ids or any(i not in room_map for i in room_ids):
            problems.append(f"{label}: Räume fehlen oder sind ungültig.")
        else:
            if sum(room_map[i].capacity for i in room_ids) < row["count"]:
                problems.append(f"{label}: Raumkapazität reicht nicht aus.")
            if any(
                not set(entity.equipment).issubset(room_map[i].equipment)
                for i in room_ids
            ):
                problems.append(f"{label}: Raumausstattung fehlt.")
            if isinstance(entity, Course) and len(room_ids) != 1:
                problems.append(f"{label}: Unterricht benötigt einen Raum.")
        teachers = row.get("teacher_ids", [])
        eligible = set(entity_data(entity)["teacher_ids"])
        if not teachers or not set(teachers).issubset(eligible):
            problems.append(
                f"{label}: Lehrende/Aufsichten fehlen oder sind nicht zugeordnet."
            )
        if (
            isinstance(entity, Course)
            and not entity.teacher_assignments
            and set(teachers) != eligible
        ):
            problems.append(
                f"{label}: Das vollständige Lehrendenteam muss zugeordnet sein."
            )
        if isinstance(entity, Exam):
            if not (entity.window_start <= start.date() <= entity.window_end):
                problems.append(f"{label}: Außerhalb des Prüfungszeitraums.")
            if int((end - start).total_seconds() / 60) != entity.duration_minutes:
                problems.append(f"{label}: Prüfungsdauer stimmt nicht.")
            if len(teachers) < len(room_ids):
                problems.append(f"{label}: Jeder Prüfungsraum benötigt eine Aufsicht.")
        for teacher in teachers:
            if teacher not in person_map or not available(
                person_map[teacher], start, end, institution
            ):
                problems.append(f"{label}: Lehrende/Aufsichten sind nicht verfügbar.")
        if not row["count"]:
            problems.append(f"{label}: Keine Teilnehmer zugeordnet.")
    all_rows = rows + external_rows(plan) + block_rows(institution, period)
    resources = defaultdict(list)
    for index, row in enumerate(all_rows):
        for resource in set(resource_keys(row)):
            resources[resource].append((dt(row["start"]), dt(row["end"]), index))
    conflicts = set()
    for entries in resources.values():
        entries.sort()
        active = []
        for start, end, i in entries:
            active = [(e, j) for e, j in active if e > start]
            for _, j in active:
                if i < len(rows) or j < len(rows):
                    conflicts.add(tuple(sorted((i, j))))
            active.append((end, i))
    for i, j in conflicts:
        problems.append(
            f"Überschneidung: {all_rows[i]['name']} / {all_rows[j]['name']}."
        )
    exam_by_person = defaultdict(list)
    for i, row in enumerate(all_rows):
        if row.get("exam"):
            for learner in row["learner_ids"]:
                exam_by_person[learner].append(
                    (
                        local(row["start"], institution),
                        local(row["end"], institution),
                        i,
                    )
                )
    for entries in exam_by_person.values():
        entries.sort()
        dates = defaultdict(list)
        for s, _e, i in entries:
            dates[s.date()].append(i)
        for day, indices in dates.items():
            if len(indices) > institution.exam_max_per_day and any(
                i < len(rows) for i in indices
            ):
                problems.append(
                    f"Prüfungsbelastung am {day}: Zu viele Prüfungen pro Person."
                )
        for prev, nxt in zip(entries, entries[1:], strict=False):
            if (
                nxt[0] - prev[1]
            ).total_seconds() < institution.exam_gap_hours * 3600 and (
                prev[2] < len(rows) or nxt[2] < len(rows)
            ):
                problems.append("Mindestabstand zwischen Prüfungen unterschritten.")
    if coverage:
        for course in courses.values():
            ordered = sorted(
                [r for r in rows if r.get("course") == course.id and not r.get("exam")],
                key=lambda r: r["start"],
            )
            if course.teacher_assignments and (
                len(ordered) != len(course.teacher_assignments)
                or any(
                    set(r["teacher_ids"]) != set(course.teacher_assignments[i])
                    for i, r in enumerate(ordered[: len(course.teacher_assignments)])
                )
            ):
                problems.append(
                    f"{course.name}: Lehrendenteams passen nicht zur Terminzuordnung."
                )
            if course.block_days > 1:
                for i in range(0, len(ordered), course.block_days):
                    block = ordered[i : i + course.block_days]
                    if len(block) != course.block_days or any(
                        local(n["start"], institution)
                        != local(p["start"], institution) + timedelta(days=1)
                        for p, n in zip(block, block[1:], strict=False)
                    ):
                        problems.append(
                            f"{course.name}: Mehrtagiger Block ist nicht zusammenhängend."
                        )
            actual = sum(
                int((dt(r["end"]) - dt(r["start"])).total_seconds() / 60)
                for r in rows
                if r.get("course") == course.id and not r.get("exam")
            )
            expected = sum(chunk[1] for chunk in course_chunks(course))
            if actual != expected:
                problems.append(
                    f"{course.name}: Soll {expected} Minuten, geplant {actual} Minuten."
                )
            if course.target_mode == "weekly":
                monday = period.start - timedelta(days=period.start.weekday())
                expected_weeks, actual_weeks = defaultdict(int), defaultdict(int)
                for days, duration, _, _ in course_chunks(course):
                    expected_weeks[(days[0] - monday).days // 7] += duration
                for r in rows:
                    if r.get("course") == course.id and not r.get("exam"):
                        day = local(r["start"], institution).date()
                        actual_weeks[(day - monday).days // 7] += int(
                            (dt(r["end"]) - dt(r["start"])).total_seconds() / 60
                        )
                if dict(expected_weeks) != dict(actual_weeks):
                    problems.append(
                        f"{course.name}: Wochensoll oder A/B-Zuordnung nicht erfüllt."
                    )
        for exam in exams.values():
            if sum(1 for r in rows if r.get("exam") == exam.id) != 1:
                problems.append(f"{exam.name}: Genau ein Prüfungstermin erforderlich.")
    return list(dict.fromkeys(problems))


def public_row(row, show_teachers=False):
    keys = ["name", "start", "end", "room_names", "group_names", "color"]
    result = {key: row.get(key) for key in keys}
    result["kind"] = "exam" if row.get("exam") else "teaching"
    if show_teachers:
        result["teacher_names"] = row.get("teacher_names", [])
    return result
