import time as clock
from collections import defaultdict
from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from django.conf import settings
from ortools.sat.python import cp_model

from .models import Course, Exam, Person, Room
from .services import (
    available,
    block_rows,
    course_chunks,
    dt,
    entity_data,
    exam_allocation,
    external_rows,
    local,
    plan_rows,
    resource_keys,
    validate_rows,
)


def solve(plan, kind, cancelled, seconds=None):
    started = clock.monotonic()
    budget = seconds if seconds is not None else settings.SOLVER_SECONDS
    institution, period = plan.institution, plan.period
    origin = datetime.combine(period.start, time(), ZoneInfo(institution.timezone))

    def minute(value):
        return int((dt(value).timestamp() - origin.timestamp()) / 60)

    def stamp(value):
        return datetime.fromtimestamp(
            origin.timestamp() + value * 60, ZoneInfo(institution.timezone)
        ).isoformat()

    old_rows = plan_rows(plan)
    preserved = [
        r for r in old_rows if r["locked"] or (kind == "exams") != bool(r.get("exam"))
    ]
    errors = validate_rows(plan, preserved)
    if errors:
        return "invalid", "Fixierte Termine prüfen: " + " ".join(errors[:6]), []
    fixed = preserved + external_rows(plan) + block_rows(institution, period)
    hint_busy = defaultdict(list)
    for row in fixed:
        for key in set(resource_keys(row)):
            hint_busy[key].append((minute(row["start"]), minute(row["end"])))
    hint_templates = {}
    greedy_rows = list(preserved)
    greedy_exams = [r for r in fixed if r.get("exam")]
    greedy_complete = True

    def fallback(message):
        if greedy_complete and not validate_rows(plan, greedy_rows):
            return "ready", message, greedy_rows
        return (
            "timeout",
            "Zeitlimit erreicht, ohne einen gültigen Plan zu finden. Das beweist keine Unlösbarkeit.",
            [],
        )

    model = cp_model.CpModel()
    resources, exam_resources = defaultdict(list), defaultdict(list)
    exam_days = defaultdict(list)
    rooms = list(Room.objects.filter(institution=institution))
    teachers = {
        p.id: p for p in Person.objects.filter(institution=institution, kind="teacher")
    }
    for row in fixed:
        start, end = minute(row["start"]), minute(row["end"])
        interval = model.new_fixed_size_interval_var(start, end - start, "existing")
        for key in set(resource_keys(row)):
            resources[key].append(interval)
        if row.get("exam"):
            for person in row["learner_ids"]:
                exam_resources[person].append(
                    model.new_fixed_size_interval_var(
                        start,
                        end - start + institution.exam_gap_hours * 60,
                        "existing_exam",
                    )
                )
                exam_days[(person, local(row["start"], institution).date())].append(1)
    entities = (
        Exam.objects.filter(plan=plan).prefetch_related("learners", "supervisors")
        if kind == "exams"
        else Course.objects.filter(plan=plan).prefetch_related(
            "learners", "teachers", "groups__people"
        )
    )
    tasks, objective, templates = [], [], {}
    optimization_events, audience_events = [], defaultdict(list)

    def sequence(entity, index, previous, begin, end, starts):
        if previous is None:
            return
        pbegin, pend, pstarts = previous
        if entity.block_days > 1 and index % entity.block_days:
            valid = set(starts)
            pairs = [
                [n, minute(dt(stamp(n)) + timedelta(days=1))]
                for n in pstarts
                if minute(dt(stamp(n)) + timedelta(days=1)) in valid
            ]
            model.add_allowed_assignments([pbegin, begin], pairs)
        else:
            model.add(begin >= pend)

    domain_count = 0
    for entity in entities:
        if cancelled():
            return "cancelled", "Berechnung abgebrochen.", []
        if clock.monotonic() - started >= budget:
            return "timeout", "Zeitlimit beim Aufbau des Planungsmodells erreicht.", []
        previous_occurrence = None
        previous_hint = None
        data = entity_data(entity)
        is_exam = isinstance(entity, Exam)
        if not data["count"]:
            return "invalid", f"{entity.name}: Teilnehmer fehlen.", []
        if is_exam:
            dates, day = [], max(entity.window_start, period.start)
            while day <= min(entity.window_end, period.end):
                if (
                    day.weekday() in period.weekdays
                    and day.isoformat() not in period.excluded_dates
                ):
                    dates.append(day)
                day += timedelta(days=1)
            chunks = [(dates, entity.duration_minutes, 0, None)]
        else:
            chunks = course_chunks(entity)
        locked = [
            r
            for r in preserved
            if r.get("exam" if is_exam else "course") == entity.id
            and bool(r.get("exam")) == is_exam
        ]
        for dates, duration, index, template in chunks:
            match = next(
                (
                    r
                    for r in locked
                    if local(r["start"], institution).date() in dates
                    and minute(r["end"]) - minute(r["start"]) == duration
                ),
                None,
            )
            if match:
                locked.remove(match)
                if not is_exam:
                    start_value, end_value = (
                        minute(match["start"]),
                        minute(match["end"]),
                    )
                    sequence(
                        entity,
                        index,
                        previous_occurrence,
                        start_value,
                        end_value,
                        [start_value],
                    )
                    previous_occurrence = (start_value, end_value, [start_value])
                    previous_hint = start_value
                    if template is not None:
                        key = (entity.id, template)
                        if key not in templates:
                            templates[key] = model.new_int_var(0, 10080, "weekly_slot")
                        s = local(match["start"], institution)
                        model.add(
                            templates[key]
                            == s.weekday() * 1440 + s.hour * 60 + s.minute
                        )
                        hint_templates[key] = (
                            s.weekday() * 1440 + s.hour * 60 + s.minute
                        )
                continue
            assigned = data["teacher_ids"]
            if not is_exam and entity.teacher_assignments:
                if index >= len(entity.teacher_assignments):
                    return (
                        "invalid",
                        f"{entity.name}: Lehrendenzuordnung für Termin {index + 1} fehlt.",
                        [],
                    )
                assigned = entity.teacher_assignments[index]
            if not assigned or any(p not in teachers for p in assigned):
                return "invalid", f"{entity.name}: Lehrende/Aufsichten fehlen.", []
            suitable = [
                r
                for r in rooms
                if r.capacity is not None
                and set(entity.equipment).issubset(r.equipment)
                and (is_exam or r.capacity >= data["count"])
            ]
            if not suitable or sum(r.capacity for r in suitable) < data["count"]:
                return (
                    "infeasible",
                    f"{entity.name}: Keine ausreichenden geeigneten Räume.",
                    [],
                )
            starts, signatures, candidate_days = [], [], {}
            for day in dates:
                start = datetime.combine(
                    day, period.day_start, ZoneInfo(institution.timezone)
                )
                end_of_day = datetime.combine(
                    day, period.day_end, ZoneInfo(institution.timezone)
                )
                while start + timedelta(minutes=duration) <= end_of_day:
                    end = start + timedelta(minutes=duration)
                    if all(
                        available(teachers[p], start, end, institution)
                        for p in assigned
                    ):
                        n = minute(start)
                        starts.append(n)
                        signatures.append(
                            [n, day.weekday() * 1440 + start.hour * 60 + start.minute]
                        )
                        candidate_days[n] = day
                    start += timedelta(minutes=period.slot_minutes)
            domain_count += len(starts)
            if domain_count > 500000:
                return (
                    "invalid",
                    "Zu viele mögliche Termine. Bitte den Planbereich oder Zeitraum verkleinern.",
                    [],
                )
            if not starts:
                return (
                    "infeasible",
                    f"{entity.name}: Kein Termin innerhalb der Verfügbarkeit.",
                    [],
                )
            begin = model.new_int_var_from_domain(
                cp_model.Domain.from_values(starts), f"start_{entity.id}_{index}"
            )
            end = model.new_int_var(
                min(starts) + duration, max(starts) + duration, "end"
            )
            interval = model.new_interval_var(begin, duration, end, "event")
            if not is_exam:
                sequence(entity, index, previous_occurrence, begin, end, starts)
                previous_occurrence = (begin, end, starts)
            if template is not None:
                key = (entity.id, template)
                if key not in templates:
                    templates[key] = model.new_int_var(0, 10080, "weekly_slot")
                model.add_allowed_assignments([begin, templates[key]], signatures)
            for key in [("person", p) for p in assigned + data["learner_ids"]] + [
                ("group", g) for g in data["group_resources"]
            ]:
                resources[key].append(interval)
            choices = []
            for room in suitable:
                selected = model.new_bool_var(f"room_{room.id}")
                choices.append((room, selected))
                resources[("room", room.id)].append(
                    model.new_optional_interval_var(
                        begin, duration, end, selected, "room_event"
                    )
                )
            if is_exam:
                model.add(sum(r.capacity * b for r, b in choices) >= data["count"])
                model.add(sum(b for _, b in choices) <= len(assigned))
                objective.extend(b * 5 for _, b in choices)
                for learner in data["learner_ids"]:
                    exam_resources[learner].append(
                        model.new_fixed_size_interval_var(
                            begin,
                            duration + institution.exam_gap_hours * 60,
                            "exam_gap",
                        )
                    )
                for day in set(candidate_days.values()):
                    flag = model.new_bool_var("exam_day")
                    model.add_allowed_assignments(
                        [begin, flag],
                        [[n, int(d == day)] for n, d in candidate_days.items()],
                    )
                    for learner in data["learner_ids"]:
                        exam_days[(learner, day)].append(flag)
            else:
                model.add_exactly_one(b for _, b in choices)
            # A fast, validated starting assignment also survives a short optimization timeout.
            keys = [("person", p) for p in assigned + data["learner_ids"]] + [
                ("group", g) for g in data["group_resources"]
            ]

            def free(key, n, duration=duration):
                return all(n + duration <= s or n >= e for s, e in hint_busy[key])

            hinted = None
            for n in starts:
                s = dt(stamp(n))
                if not is_exam:
                    if previous_hint is not None and n < previous_hint:
                        continue
                    if (
                        entity.block_days > 1
                        and index % entity.block_days
                        and (
                            previous_hint is None
                            or s != dt(stamp(previous_hint)) + timedelta(days=1)
                        )
                    ):
                        continue
                    key = (entity.id, template)
                    if (
                        template is not None
                        and key in hint_templates
                        and hint_templates[key]
                        != s.weekday() * 1440 + s.hour * 60 + s.minute
                    ):
                        continue
                if not all(free(key, n) for key in keys):
                    continue
                if is_exam:
                    relevant = [
                        r
                        for r in greedy_exams
                        if set(r["learner_ids"]) & set(data["learner_ids"])
                    ]
                    if any(
                        not (
                            n >= minute(r["end"]) + institution.exam_gap_hours * 60
                            or n + duration + institution.exam_gap_hours * 60
                            <= minute(r["start"])
                        )
                        for r in relevant
                    ):
                        continue
                    if any(
                        sum(
                            1
                            for r in relevant
                            if learner in r["learner_ids"]
                            and local(r["start"], institution).date() == s.date()
                        )
                        >= institution.exam_max_per_day
                        for learner in data["learner_ids"]
                    ):
                        continue
                selected = []
                for room, _ in sorted(
                    choices, key=lambda choice: choice[0].capacity, reverse=is_exam
                ):
                    if free(("room", room.id), n):
                        selected.append(room)
                    if sum(r.capacity for r in selected) >= data["count"]:
                        break
                if (
                    not selected
                    or sum(r.capacity for r in selected) < data["count"]
                    or (is_exam and len(selected) > len(assigned))
                ):
                    continue
                hinted = (n, selected)
                break
            if hinted:
                n, selected = hinted
                previous_hint = n
                if template is not None:
                    hint_templates[(entity.id, template)] = (
                        dt(stamp(n)).weekday() * 1440
                        + dt(stamp(n)).hour * 60
                        + dt(stamp(n)).minute
                    )
                model.add_hint(begin, n)
                model.add_hint(end, n + duration)
                for room, flag in choices:
                    model.add_hint(flag, int(room in selected))
                hint_row = {
                    **data,
                    "name": entity.name,
                    "plan_id": plan.id,
                    "course": None if is_exam else entity.id,
                    "exam": entity.id if is_exam else None,
                    "start": stamp(n),
                    "end": stamp(n + duration),
                    "room_ids": [r.id for r in selected],
                    "room_names": [r.name for r in selected],
                    "teacher_ids": assigned,
                    "teacher_names": [teachers[p].name for p in assigned],
                    "locked": False,
                }
                hint_row["room_allocations"] = exam_allocation(hint_row, selected)
                greedy_rows.append(hint_row)
                if is_exam:
                    greedy_exams.append(hint_row)
                for key in set(keys + [("room", r.id) for r in selected]):
                    hint_busy[key].append((n, n + duration))
            else:
                greedy_complete = False
            previous = [
                r
                for r in old_rows
                if bool(r.get("exam")) == is_exam
                and r.get("exam" if is_exam else "course") == entity.id
                and local(r["start"], institution).date() in dates
            ]
            if previous:
                previous_row = previous[min(index, len(previous) - 1)]
                changed = model.new_bool_var("changed_time")
                model.add(begin != minute(previous_row["start"])).only_enforce_if(
                    changed
                )
                model.add(begin == minute(previous_row["start"])).only_enforce_if(
                    changed.Not()
                )
                objective.append(changed * 10000000)
                objective.extend(
                    b * 100000
                    for r, b in choices
                    if r.id not in previous_row["room_ids"]
                )
            offset = model.new_int_var(0, 1440, "day_offset")
            model.add_allowed_assignments(
                [begin, offset],
                [[n, d.hour * 60 + d.minute] for n in starts for d in [dt(stamp(n))]],
            )
            objective.append(offset)
            if not is_exam:
                flags = {}
                for day in set(candidate_days.values()):
                    flag = model.new_bool_var("teaching_day")
                    model.add_allowed_assignments(
                        [begin, flag],
                        [[n, int(d == day)] for n, d in candidate_days.items()],
                    )
                    flags[day] = flag
                event_index = len(optimization_events)
                optimization_events.append((begin, end, duration, flags))
                for key in set(
                    [("person", p) for p in assigned + data["learner_ids"]]
                    + [("group", g) for g in data["group_resources"]]
                ):
                    audience_events[key].append(event_index)
            tasks.append((entity, data, assigned, begin, end, choices))
        if locked:
            return (
                "invalid",
                f"{entity.name}: Fixierte Termine passen nicht zum Soll.",
                [],
            )
    # Identical participation patterns share one constraint, even for 30,000 learners.
    seen_intervals = set()
    for intervals in resources.values():
        signature = tuple(i.index for i in intervals)
        if len(intervals) > 1 and signature not in seen_intervals:
            model.add_no_overlap(intervals)
            seen_intervals.add(signature)
    for signature in {tuple(indices) for indices in audience_events.values()}:
        days = set(day for i in signature for day in optimization_events[i][3])
        for day in days:
            day_begin = minute(
                datetime.combine(day, period.day_start, ZoneInfo(institution.timezone))
            )
            day_end = minute(
                datetime.combine(day, period.day_end, ZoneInfo(institution.timezone))
            )
            starts_on_day, ends_on_day, flags, occupied = [], [], [], []
            for i in signature:
                begin, end, duration, by_day = optimization_events[i]
                if day not in by_day:
                    continue
                flag = by_day[day]
                flags.append(flag)
                occupied.append(duration * flag)
                s = model.new_int_var(day_begin, day_end, "effective_start")
                e = model.new_int_var(day_begin, day_end, "effective_end")
                model.add(s == begin).only_enforce_if(flag)
                model.add(s == day_end).only_enforce_if(flag.Not())
                model.add(e == end).only_enforce_if(flag)
                model.add(e == day_begin).only_enforce_if(flag.Not())
                starts_on_day.append(s)
                ends_on_day.append(e)
            first = model.new_int_var(day_begin, day_end, "first")
            last = model.new_int_var(day_begin, day_end, "last")
            model.add_min_equality(first, starts_on_day)
            model.add_max_equality(last, ends_on_day)
            gaps = model.new_int_var(0, day_end - day_begin, "gaps")
            used = model.new_bool_var("used_day")
            model.add_max_equality(used, flags)
            model.add(gaps >= last - first - sum(occupied))
            objective.extend([gaps * 100, used * 50])
    for intervals in exam_resources.values():
        if len(intervals) > 1:
            model.add_no_overlap(intervals)
    for flags in exam_days.values():
        model.add(sum(flags) <= institution.exam_max_per_day)
    model.minimize(sum(objective))
    solver = cp_model.CpSolver()
    remaining = budget - (clock.monotonic() - started)
    if remaining <= 0:
        return fallback(
            "Gültige Startlösung; Zeitlimit vor der weiteren Optimierung erreicht."
        )
    solver.parameters.max_time_in_seconds = remaining
    solver.parameters.num_search_workers = 4
    # Poll cancellation independently; CP-SAT may not invoke a solution callback before finding a solution.
    import threading

    stopped = threading.Event()

    def watch():
        while not stopped.wait(0.5):
            if cancelled():
                solver.stop_search()
                return

    watcher = threading.Thread(target=watch, daemon=True)
    watcher.start()
    try:
        status = solver.solve(model)
    finally:
        stopped.set()
        watcher.join(timeout=1)
    if cancelled():
        return "cancelled", "Berechnung abgebrochen.", []
    if status == cp_model.INFEASIBLE:
        return (
            "infeasible",
            "Kein gültiger Plan: Kapazitäten, Verfügbarkeiten, fixierte Termine und Prüfungsabstände prüfen.",
            [],
        )
    if status == cp_model.MODEL_INVALID:
        return "invalid", "Planungsmodell ungültig: " + model.validate(), []
    if status not in (cp_model.FEASIBLE, cp_model.OPTIMAL):
        return fallback(
            "Gültige Startlösung; Optimierung hat innerhalb des Zeitlimits keine bessere Lösung geliefert."
        )
    result = list(preserved)
    for entity, data, assigned, begin, end, choices in tasks:
        selected_rooms = [r for r, b in choices if solver.value(b)]
        is_exam = isinstance(entity, Exam)
        row = {
            **data,
            "name": entity.name,
            "plan_id": plan.id,
            "course": None if is_exam else entity.id,
            "exam": entity.id if is_exam else None,
            "start": stamp(solver.value(begin)),
            "end": stamp(solver.value(end)),
            "room_ids": [r.id for r in selected_rooms],
            "room_names": [r.name for r in selected_rooms],
            "teacher_ids": assigned,
            "teacher_names": [teachers[p].name for p in assigned],
            "locked": False,
        }
        row["room_allocations"] = exam_allocation(row, selected_rooms)
        result.append(row)
    errors = validate_rows(plan, result)
    if errors:
        return "invalid", "Ergebnisprüfung: " + " ".join(errors[:5]), []
    return (
        "ready",
        "Optimaler Vorschlag."
        if status == cp_model.OPTIMAL
        else "Gültiger Vorschlag; weitere Verbesserung möglich.",
        result,
    )
