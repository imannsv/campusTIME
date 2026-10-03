import json
import time
import uuid
from datetime import date

from django.core.management.base import BaseCommand
from django.db import transaction

from planner import models as m
from planner.services import validate_rows
from planner.solver import solve


class Command(BaseCommand):
    help = "Synthetischer Lasttest. Alle Testdaten werden am Ende zurückgerollt."

    def add_arguments(self, parser):
        parser.add_argument("--learners", type=int, default=30000)
        parser.add_argument("--courses", type=int, default=100)
        parser.add_argument("--seconds", type=int, default=20)
        parser.add_argument("--dense", action="store_true")

    def handle(self, *args, **options):
        with transaction.atomic():
            started = time.monotonic()
            inst = m.Institution.objects.create(
                name="Lasttest", slug="bench-" + uuid.uuid4().hex
            )

            def create(model, code, **kwargs):
                return model.objects.create(
                    institution=inst, code=code, name=code, **kwargs
                )

            program = create(m.Program, "PROGRAM")
            cohort = create(m.Cohort, "COHORT", program=program)
            area = create(m.Area, "AREA")
            people = m.Person.objects.bulk_create(
                [
                    m.Person(institution=inst, code=f"P{i}", name=f"Person {i}")
                    for i in range(options["learners"])
                ],
                batch_size=1000,
            )
            groups = m.Group.objects.bulk_create(
                [
                    m.Group(
                        institution=inst,
                        code=f"G{i}",
                        name=f"Gruppe {i}",
                        cohort=cohort,
                        size=min(30, options["learners"] - i * 30),
                    )
                    for i in range((options["learners"] + 29) // 30)
                ]
            )
            m.Person.groups.through.objects.bulk_create(
                [
                    m.Person.groups.through(person_id=p.id, group_id=groups[i // 30].id)
                    for i, p in enumerate(people)
                ],
                batch_size=1000,
            )
            teachers = [create(m.Person, f"T{i}", kind="teacher") for i in range(16)]
            building = create(m.Building, "BUILDING")
            floor = create(m.Floor, "FLOOR", building=building)
            for i in range(20):
                create(m.Room, f"R{i}", floor=floor, capacity=60)
            period = create(
                m.Period, "PERIOD", start=date(2026, 10, 5), end=date(2026, 10, 9)
            )
            plan = create(m.Plan, "PLAN", area=area, period=period)
            for i in range(options["courses"]):
                course = create(
                    m.Course, f"C{i}", plan=plan, target_units=2, duration_minutes=90
                )
                offset = i if options["dense"] else i * 2
                course.groups.set(
                    [groups[offset % len(groups)], groups[(offset + 1) % len(groups)]]
                )
                course.teachers.set([teachers[i % len(teachers)]])
            prepared = time.monotonic()
            state, message, rows = solve(
                plan, "teaching", lambda: False, seconds=options["seconds"]
            )
            finished = time.monotonic()
            errors = (
                validate_rows(plan, rows, coverage=True) if state == "ready" else []
            )
            self.stdout.write(
                json.dumps(
                    {
                        "learners": options["learners"],
                        "active_learners": min(
                            options["learners"],
                            (options["courses"] + 1) * 30
                            if options["dense"]
                            else options["courses"] * 60,
                        ),
                        "dense_overlaps": options["dense"],
                        "courses": options["courses"],
                        "rooms": 20,
                        "teachers": 16,
                        "preparation_seconds": round(prepared - started, 2),
                        "planning_seconds": round(finished - prepared, 2),
                        "status": state,
                        "message": message,
                        "sessions": len(rows),
                        "conflicts": len(errors),
                    },
                    ensure_ascii=False,
                )
            )
            transaction.set_rollback(True)
