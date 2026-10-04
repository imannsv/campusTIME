import os
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from planner import models as m
from planner.overview import enrich_snapshot
from planner.services import session_row, validate_rows


class Command(BaseCommand):
    help = "Erstellt eine lokale Demoeinrichtung. Bestehende Daten werden nicht überschrieben."

    def add_arguments(self, parser):
        parser.add_argument("--password", default=os.getenv("DEMO_PASSWORD"))

    @transaction.atomic
    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError("Demodaten nur im Entwicklungsmodus erlaubt.")
        if m.Institution.objects.filter(slug="demo").exists():
            self.stdout.write("Demo ist bereits eingerichtet.")
            return
        password = options["password"]
        if not password:
            raise CommandError("Passwort mit --password oder DEMO_PASSWORD festlegen.")
        user = get_user_model().objects.create_user(
            "verwaltung",
            password=password,
            first_name="Alex",
            last_name="Weber",
            is_staff=True,
            is_superuser=True,
        )
        institution = m.Institution.objects.create(
            name="Campus Nord · Hochschule & Akademie",
            slug="demo",
            license_until=date(2027, 12, 31),
        )
        m.Membership.objects.create(user=user, institution=institution, role="admin")

        def make(model, code, name, **kwargs):
            return model.objects.create(
                institution=institution, code=code, name=name, **kwargs
            )

        area = make(m.Area, "WI", "Wirtschaftsinformatik")
        program = make(m.Program, "BWI", "B.Sc. Wirtschaftsinformatik")
        cohort = make(m.Cohort, "dWI25", "dWI25", program=program)
        a1 = make(m.Group, "A1", "dWI25 A1", cohort=cohort, size=28)
        a2 = make(m.Group, "A2", "dWI25 A2", cohort=cohort, size=26)
        people = []
        for i in range(54):
            p = make(m.Person, f"S{i + 1:04d}", f"Demo Studierende {i + 1:02d}")
            p.groups.add(a1 if i < 28 else a2)
            people.append(p)
        teachers = [
            make(m.Person, f"L{i + 1}", name, kind="teacher")
            for i, name in enumerate(
                [
                    "Prof. Lena Hoffmann",
                    "Dr. Jonas Richter",
                    "Prof. Mira Schulz",
                    "Dr. Felix Brandt",
                    "Sara Neumann",
                    "Dr. Paul Berger",
                ]
            )
        ]
        period = make(
            m.Period,
            "WS26",
            "Wintersemester 2026/27",
            start=date(2026, 10, 5),
            end=date(2026, 10, 23),
            day_start="08:00",
            day_end="18:00",
        )
        period.refresh_from_db()
        building = make(
            m.Building,
            "H",
            "Hauptgebäude",
            latitude=52.5148,
            longitude=13.3502,
            geometry={
                "type": "Polygon",
                "coordinates": [
                    [
                        [13.3498, 52.5145],
                        [13.3506, 52.5145],
                        [13.3506, 52.5151],
                        [13.3498, 52.5151],
                        [13.3498, 52.5145],
                    ]
                ],
            },
        )
        floor = make(m.Floor, "EG", "Erdgeschoss", building=building, level=0)
        upper = make(m.Floor, "OG1", "1. Obergeschoss", building=building, level=1)
        room_specs = [
            (
                "H101",
                "Hörsaal H.101",
                60,
                ["Beamer"],
                floor,
                [[50, 60], [450, 60], [450, 360], [50, 360]],
            ),
            (
                "H102",
                "Seminar H.102",
                32,
                ["Beamer"],
                floor,
                [[550, 60], [940, 60], [940, 360], [550, 360]],
            ),
            (
                "H103",
                "Labor H.103",
                30,
                ["Beamer", "PC"],
                floor,
                [[50, 530], [450, 530], [450, 850], [50, 850]],
            ),
            (
                "H104",
                "Seminar H.104",
                30,
                ["Beamer"],
                floor,
                [[550, 530], [940, 530], [940, 850], [550, 850]],
            ),
            (
                "H201",
                "Labor H.201",
                32,
                ["Beamer", "PC"],
                upper,
                [[50, 80], [450, 80], [450, 750], [50, 750]],
            ),
            (
                "H202",
                "Seminar H.202",
                60,
                ["Beamer"],
                upper,
                [[550, 80], [940, 80], [940, 750], [550, 750]],
            ),
        ]
        rooms = [
            make(
                m.Room,
                code,
                name,
                capacity=cap,
                equipment=equipment,
                floor=f,
                polygon=polygon,
            )
            for code, name, cap, equipment, f, polygon in room_specs
        ]
        plan = make(
            m.Plan,
            "WI-WS26",
            "Wirtschaftsinformatik · WS 2026/27",
            period=period,
            area=area,
        )
        specs = [
            ("MAT", "Mathematik I", [a1, a2], teachers[:1], "blue", 0, 0, "08:30"),
            (
                "PROG1",
                "Programmierung · A1",
                [a1],
                teachers[1:2],
                "violet",
                2,
                0,
                "10:30",
            ),
            (
                "PROG2",
                "Programmierung · A2",
                [a2],
                teachers[1:2],
                "violet",
                4,
                1,
                "08:30",
            ),
            (
                "BWL",
                "Betriebswirtschaftslehre",
                [a1, a2],
                teachers[2:3],
                "amber",
                0,
                1,
                "10:30",
            ),
            ("DB1", "Datenbanken · A1", [a1], teachers[3:4], "mint", 2, 2, "08:30"),
            ("DB2", "Datenbanken · A2", [a2], teachers[3:4], "mint", 4, 2, "10:30"),
            ("RECHT", "IT-Recht", [a1, a2], teachers[4:5], "rose", 0, 3, "08:30"),
            (
                "PROJ",
                "Projektwerkstatt",
                [a1, a2],
                teachers[4:6],
                "blue",
                5,
                4,
                "10:30",
            ),
        ]
        for code, name, groups, staff, color, room_index, weekday, start_time in specs:
            course = make(
                m.Course,
                code,
                name,
                plan=plan,
                color=color,
                equipment=["PC"] if code.startswith(("PROG", "DB")) else ["Beamer"],
            )
            course.groups.set(groups)
            course.teachers.set(staff)
            for week in range(3):
                start = datetime.fromisoformat(
                    f"{(period.start + timedelta(days=weekday + 7 * week)).isoformat()}T{start_time}:00"
                ).replace(tzinfo=ZoneInfo("Europe/Berlin"))
                session = m.Session.objects.create(
                    institution=institution,
                    plan=plan,
                    course=course,
                    start=start,
                    end=start + timedelta(minutes=90),
                )
                session.rooms.set([rooms[room_index]])
                session.teachers.set(staff)
        elective = make(
            m.Course,
            "UX",
            "Wahlpflicht: UX & Design",
            plan=plan,
            color="violet",
            elective=True,
            target_mode="total",
            target_units=4,
            duration_minutes=90,
        )
        elective.learners.set(people[:12] + people[28:36])
        elective.teachers.set([teachers[5]])
        for day in [0, 2]:
            start = datetime(2026, 10, 5 + day, 13, 0, tzinfo=ZoneInfo("Europe/Berlin"))
            session = m.Session.objects.create(
                institution=institution,
                plan=plan,
                course=elective,
                start=start,
                end=start + timedelta(minutes=90),
            )
            session.rooms.set([rooms[1]])
            session.teachers.set([teachers[5]])
        make(
            m.Curriculum,
            "WI-GRUND",
            "Wirtschaftsinformatik · Grundlagen",
            program=program,
            items=[
                {
                    "name": "Mathematik I",
                    "target_mode": "weekly",
                    "target_units": 2,
                    "duration_minutes": 90,
                },
                {
                    "name": "Programmierung",
                    "target_mode": "weekly",
                    "target_units": 4,
                    "duration_minutes": 90,
                    "equipment": ["PC"],
                },
            ],
        )
        block = make(
            m.RoomBlock,
            "BAU",
            "Wartung der Labortechnik",
            start=datetime(2026, 10, 9, 14, tzinfo=ZoneInfo("Europe/Berlin")),
            end=datetime(2026, 10, 9, 18, tzinfo=ZoneInfo("Europe/Berlin")),
        )
        block.rooms.set([rooms[2]])
        rows = [session_row(s) for s in plan.sessions.all()]
        errors = validate_rows(plan, rows, coverage=True)
        if errors:
            raise CommandError(str(errors))
        m.Publication.objects.create(
            institution=institution,
            plan=plan,
            number=1,
            created_by=user,
            snapshot=enrich_snapshot(rows, institution.id),
        )
        display = make(
            m.Display, "FOYER", "Campus Nord · Wochenübersicht", show_teachers=True
        )
        display.plans.set([plan])
        m.Audit.objects.create(
            institution=institution,
            user=user,
            action="Wintersemester eingerichtet und veröffentlicht",
        )
        self.stdout.write(
            self.style.SUCCESS(
                "Demo bereit. Benutzer: verwaltung. Das festgelegte Passwort verwenden."
            )
        )
        self.stdout.write(f"Anzeige: /display/{display.token}")
