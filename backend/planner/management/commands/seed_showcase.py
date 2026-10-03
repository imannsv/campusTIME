from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.models import F
from django.utils import timezone

from planner import models as m
from planner.services import plan_rows, validate_rows


class Command(BaseCommand):
    help = "Ergänzt die lokale Demo um eine große, konfliktfreie Produkttestumgebung."

    def add_arguments(self, parser):
        parser.add_argument(
            "--date", type=date.fromisoformat, help="Bezugsdatum YYYY-MM-DD"
        )

    @transaction.atomic
    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError("Produkttestdaten nur im Entwicklungsmodus erlaubt.")
        try:
            institution = m.Institution.objects.select_for_update().get(slug="demo")
        except m.Institution.DoesNotExist:
            raise CommandError("Zuerst seed_demo ausführen.") from None
        if m.Period.objects.filter(institution=institution, code="SHOW-SEM").exists():
            self.stdout.write(
                "Produkttestdaten bereits vorhanden; nichts überschrieben."
            )
            return
        zone = ZoneInfo(institution.timezone)
        reference = options["date"] or timezone.now().astimezone(zone).date()
        monday = reference - timedelta(days=reference.weekday())
        teaching_start = monday + timedelta(days=7 if reference.weekday() >= 5 else 0)
        user = institution.membership_set.filter(role="admin").first().user

        def make(model, code, name, **kwargs):
            return model.objects.create(
                institution=institution, code="SHOW-" + code, name=name, **kwargs
            )

        def stamp(day, hour, minute=0):
            return datetime.combine(day, time(hour, minute), zone)

        def session(
            plan, entity, day, hour, minute, rooms, teachers, duration=90, locked=False
        ):
            start = stamp(day, hour, minute)
            row = m.Session.objects.create(
                institution=institution,
                plan=plan,
                course=entity if isinstance(entity, m.Course) else None,
                exam=entity if isinstance(entity, m.Exam) else None,
                start=start,
                end=start + timedelta(minutes=duration),
                locked=locked,
            )
            row.rooms.set(rooms)
            row.teachers.set(teachers)
            return row

        period = make(
            m.Period,
            "SEM",
            "Produkttest · drei Semesterwochen",
            start=teaching_start,
            end=teaching_start + timedelta(days=18),
        )
        campus_period = make(
            m.Period,
            "CAMPUS",
            "Produkttest · Campusprogramm inkl. Wochenende",
            start=monday,
            end=monday + timedelta(days=27),
            weekdays=list(range(7)),
        )
        seminar = make(
            m.Building,
            "S",
            "Seminarzentrum",
            longitude=13.3514,
            latitude=52.5148,
            geometry={
                "type": "Polygon",
                "coordinates": [
                    [
                        [13.3510, 52.5145],
                        [13.3518, 52.5145],
                        [13.3518, 52.5151],
                        [13.3510, 52.5151],
                        [13.3510, 52.5145],
                    ]
                ],
            },
        )
        floors = [
            make(m.Floor, f"S-{level}", name, building=seminar, level=level)
            for level, name in enumerate(
                ["Seminarzentrum · Erdgeschoss", "Seminarzentrum · 1. OG"]
            )
        ]
        rooms = []
        for i in range(5):
            x = 45 + (i % 3) * 315
            rooms.append(
                make(
                    m.Room,
                    f"S{i + 1}01",
                    f"Seminarraum S.{i + 1}01",
                    floor=floors[i // 3],
                    capacity=45,
                    equipment=["Beamer", "PC"],
                    polygon=[[x, 80], [x + 280, 80], [x + 280, 700], [x, 700]],
                )
            )
        forum = make(
            m.Building,
            "F",
            "Projektforum",
            longitude=13.3502,
            latitude=52.5157,
            geometry={
                "type": "Polygon",
                "coordinates": [
                    [
                        [13.3498, 52.5154],
                        [13.3506, 52.5154],
                        [13.3506, 52.5160],
                        [13.3498, 52.5160],
                        [13.3498, 52.5154],
                    ]
                ],
            },
        )
        forum_floors = [
            make(
                m.Floor,
                f"F-{i}",
                f"Projektforum · {'EG' if i == 0 else '1. OG'}",
                building=forum,
                level=i,
            )
            for i in range(2)
        ]
        forum_rooms = [
            make(
                m.Room,
                f"F{i + 1}01",
                name,
                floor=forum_floors[i // 2],
                capacity=30,
                equipment=["Beamer", "PC"],
                polygon=[
                    [80 + (i % 2) * 460, 100],
                    [460 + (i % 2) * 460, 100],
                    [460 + (i % 2) * 460, 800],
                    [80 + (i % 2) * 460, 800],
                ],
            )
            for i, name in enumerate(
                ["Forum F.101", "Workshop F.201", "Projektlabor F.301"]
            )
        ]

        programs = {
            "WI": m.Program.objects.get(institution=institution, code="BWI"),
            "INF": make(m.Program, "BINF", "B.Sc. Informatik"),
            "MED": make(m.Program, "BMED", "B.A. Mediendesign"),
        }
        specs = [
            (
                "dWI24",
                "WI",
                "Wirtschaftsinformatik · Aufbau",
                "Softwarearchitektur",
                "ERP-Labor",
                "Digitale Geschäftsmodelle",
            ),
            (
                "dWI26",
                "WI",
                "Wirtschaftsinformatik · Einstieg",
                "Mathematik & Logik",
                "Programmierung I",
                "BWL-Grundlagen",
            ),
            (
                "INF25",
                "INF",
                "Informatik · Aufbau",
                "Algorithmen",
                "Netzwerklabor",
                "IT-Sicherheit",
            ),
            (
                "INF26",
                "INF",
                "Informatik · Einstieg",
                "Diskrete Mathematik",
                "Python-Labor",
                "Rechnerarchitektur",
            ),
            (
                "MED26",
                "MED",
                "Mediendesign · Einstieg",
                "Gestaltungsgrundlagen",
                "Medienlabor",
                "Designgeschichte",
            ),
        ]
        plans, cohorts = [], []
        for i, (code, key, name, lecture_name, lab_name, seminar_name) in enumerate(
            specs
        ):
            cohort = make(m.Cohort, code, code, program=programs[key])
            groups = [
                make(
                    m.Group,
                    f"{code}-A{n + 1}",
                    f"{code} A{n + 1}",
                    cohort=cohort,
                    size=size,
                )
                for n, size in enumerate([20, 18])
            ]
            learners = []
            for n in range(38):
                person = make(
                    m.Person, f"{code}-S{n + 1:03d}", f"Testperson {code} {n + 1:02d}"
                )
                person.groups.add(groups[0] if n < 20 else groups[1])
                learners.append(person)
            teachers = [
                make(
                    m.Person,
                    f"{code}-L{n + 1}",
                    f"Demo-Lehrende {code} · Team {n + 1}",
                    kind="teacher",
                    availability={
                        "weekdays": [0, 1, 2, 3, 4],
                        "from": "08:00",
                        "to": "18:00",
                    },
                )
                for n in range(2)
            ]
            area = make(m.Area, code, name)
            plan = make(
                m.Plan,
                code,
                f"{code} · Unterricht & Prüfungen",
                area=area,
                period=period,
            )
            room = rooms[i]
            courses = []

            def course(
                suffix,
                title,
                selected_groups,
                staff,
                color,
                *,
                code=code,
                plan=plan,
                courses=courses,
                **kwargs,
            ):
                c = make(
                    m.Course,
                    f"{code}-{suffix}",
                    title,
                    plan=plan,
                    color=color,
                    **kwargs,
                )
                c.groups.set(selected_groups)
                c.teachers.set(staff)
                courses.append(c)
                return c

            weekly = [
                (
                    course("VL", lecture_name, groups, teachers[:1], "blue"),
                    0,
                    8,
                    30,
                    teachers[:1],
                ),
                (
                    course(
                        "LA1",
                        f"{lab_name} · A1",
                        groups[:1],
                        teachers[:1],
                        "violet",
                        equipment=["PC"],
                    ),
                    0,
                    10,
                    30,
                    teachers[:1],
                ),
                (
                    course(
                        "LA2",
                        f"{lab_name} · A2",
                        groups[1:],
                        teachers[:1],
                        "violet",
                        equipment=["PC"],
                    ),
                    1,
                    8,
                    30,
                    teachers[:1],
                ),
                (
                    course("SEM", seminar_name, groups, teachers, "amber"),
                    2,
                    10,
                    30,
                    teachers,
                ),
            ]
            elective = course(
                "WP",
                f"Wahlpflicht · {'UX & Prototyping' if key == 'MED' else 'KI & Gesellschaft'}",
                groups,
                teachers[1:],
                "mint",
                elective=True,
            )
            elective.learners.set(learners[:10] + learners[20:28])
            weekly.append((elective, 3, 13, 0, teachers[1:]))
            for c, weekday, hour, minute, staff in weekly:
                for week in range(3):
                    session(
                        plan,
                        c,
                        teaching_start + timedelta(days=weekday + 7 * week),
                        hour,
                        minute,
                        [room],
                        staff,
                    )
            a_week = course(
                "A",
                "Vertiefung · A-Woche",
                groups,
                teachers[1:],
                "blue",
                week_pattern="A",
            )
            for week in [0, 2]:
                session(
                    plan,
                    a_week,
                    teaching_start + timedelta(days=7 * week),
                    13,
                    0,
                    [room],
                    teachers[1:],
                )
            project = course(
                "BLOCK",
                "Projektatelier · zweitägiger Block",
                groups,
                teachers,
                "mint",
                target_mode="total",
                target_units=8,
                block_days=2,
            )
            for offset in [3, 4, 17, 18]:
                session(
                    plan,
                    project,
                    teaching_start + timedelta(days=offset),
                    8,
                    30,
                    [room],
                    teachers,
                )
            teams = [[teachers[0].id], [teachers[1].id], [t.id for t in teachers]]
            rotating = course(
                "TEAM",
                "Praxisdialog · wechselnde Lehrendenteams",
                groups,
                teachers,
                "rose",
                teacher_assignments=teams,
            )
            for week, staff in enumerate([teachers[:1], teachers[1:], teachers]):
                session(
                    plan,
                    rotating,
                    teaching_start + timedelta(days=2 + 7 * week),
                    15,
                    0,
                    [room],
                    staff,
                )
            for n, (suffix, title, offset, resit) in enumerate(
                [
                    ("KL1", f"Klausur · {lecture_name}", 7, False),
                    ("KL2", f"Klausur · {lab_name}", 10, False),
                    ("NKL", f"Nachschreiben · {lecture_name}", 17, True),
                ]
            ):
                day = teaching_start + timedelta(days=offset)
                exam = make(
                    m.Exam,
                    f"{code}-{suffix}",
                    title,
                    plan=plan,
                    course=courses[0 if n != 1 else 1],
                    duration_minutes=120,
                    window_start=day,
                    window_end=day + timedelta(days=1),
                    resit=resit,
                )
                exam.learners.set(
                    learners[:7] if resit else learners if n == 0 else learners[:20]
                )
                staff = teachers[n % 2 : n % 2 + 1]
                exam.supervisors.set(staff)
                session(
                    plan, exam, day, 15, 0, [room], staff, duration=120, locked=True
                )
            plans.append(plan)
            cohorts.append((learners, teachers))

        for key, program in programs.items():
            make(
                m.Curriculum,
                f"{key}-VORLAGE",
                f"{program.name} · Produkttestvorlage",
                program=program,
                items=[
                    {
                        "name": "Grundlagenvorlesung",
                        "target_mode": "weekly",
                        "target_units": 2,
                        "duration_minutes": 90,
                    },
                    {
                        "name": "Praxislabor",
                        "target_mode": "weekly",
                        "target_units": 2,
                        "duration_minutes": 90,
                        "equipment": ["PC"],
                    },
                    {
                        "name": "Projektblock",
                        "target_mode": "total",
                        "target_units": 8,
                        "duration_minutes": 90,
                        "block_days": 2,
                    },
                ],
            )

        exam_plan = make(
            m.Plan,
            "PRUEF",
            "Prüfungszentrum · gemeinsame Klausur",
            period=period,
            area=make(m.Area, "PRUEF", "Gemeinsame Prüfungen"),
        )
        exam_day = teaching_start + timedelta(days=15)
        shared = make(
            m.Exam,
            "GEM-KL",
            "Gemeinsame Grundlagenklausur · dWI24 & dWI26",
            plan=exam_plan,
            window_start=exam_day,
            window_end=exam_day,
            duration_minutes=120,
        )
        shared.learners.set(cohorts[0][0] + cohorts[1][0])
        supervisors = [cohorts[0][1][0], cohorts[1][1][0]]
        shared.supervisors.set(supervisors)
        session(
            exam_plan,
            shared,
            exam_day,
            10,
            30,
            rooms[:2],
            supervisors,
            duration=120,
            locked=True,
        )
        plans.append(exam_plan)

        welcome_program = make(
            m.Program, "CAMPUSPROG", "Akademie · Orientierung & offene Werkstätten"
        )
        welcome_cohort = make(m.Cohort, "CAMPUS26", "CAMPUS26", program=welcome_program)
        welcome_group = make(
            m.Group,
            "CAMPUS26-A1",
            "CAMPUS26 · Orientierungsgruppe",
            cohort=welcome_cohort,
            size=18,
        )
        for i in range(18):
            p = make(
                m.Person, f"CAMPUS-S{i + 1:03d}", f"Testperson Orientierung {i + 1:02d}"
            )
            p.groups.add(welcome_group)
        hosts = [
            make(
                m.Person,
                f"CAMPUS-L{i + 1}",
                name,
                kind="teacher",
                availability={"weekdays": list(range(7))},
            )
            for i, name in enumerate(
                ["Demo-Team · Campusbetreuung", "Demo-Team · Projektlabor"]
            )
        ]
        campus_plan = make(
            m.Plan,
            "CAMPUSPLAN",
            "Campusprogramm · Heute, morgen & Wochenende",
            period=campus_period,
            area=make(m.Area, "CAMPUSAREA", "Campusleben & Orientierung"),
        )
        for i, (name, hour, minute, color) in enumerate(
            [
                ("Campusstart · Einführung & Beratung", 8, 30, "blue"),
                ("Offene Werkstatt · Kreativprojekt", 11, 0, "amber"),
                ("Projektlabor · gemeinsam ausprobieren", 14, 0, "mint"),
            ]
        ):
            c = make(
                m.Course,
                f"CAMPUS-K{i + 1}",
                name,
                plan=campus_plan,
                target_mode="total",
                target_units=56,
                color=color,
            )
            c.groups.set([welcome_group])
            staff = hosts if i == 2 else hosts[:1]
            c.teachers.set(staff)
            for offset in range(28):
                session(
                    campus_plan,
                    c,
                    monday + timedelta(days=offset),
                    hour,
                    minute,
                    [forum_rooms[i]],
                    staff,
                )
        plans.append(campus_plan)

        for code, name, selected_rooms, day, hour, end_hour, weekly in [
            (
                "BAU",
                "Bauarbeiten · Seminarzentrum",
                rooms[4:],
                teaching_start + timedelta(days=4),
                12,
                18,
                True,
            ),
            (
                "PC",
                "PC-Wartung · Labor",
                rooms[1:2],
                teaching_start + timedelta(days=1),
                13,
                18,
                True,
            ),
            (
                "PROJ",
                "Projektvorbereitung · Forum",
                forum_rooms[1:2],
                reference,
                16,
                18,
                False,
            ),
        ]:
            block = make(
                m.RoomBlock,
                code,
                name,
                start=stamp(day, hour),
                end=stamp(day, end_hour),
                repeat_weekly=weekly,
                repeat_until=period.end if weekly else None,
            )
            block.rooms.set(selected_rooms)

        for plan in plans:
            rows = plan_rows(plan)
            errors = validate_rows(plan, rows, coverage=True)
            if errors:
                raise CommandError(f"{plan.name}: " + "; ".join(errors[:10]))
            m.Publication.objects.create(
                institution=institution,
                plan=plan,
                number=1,
                created_by=user,
                snapshot=rows,
            )
        # Check all plans again now that every external publication is present.
        for plan in m.Plan.objects.filter(institution=institution):
            errors = validate_rows(plan, plan_rows(plan), coverage=True)
            if errors:
                raise CommandError(
                    f"Gesamtprüfung {plan.name}: " + "; ".join(errors[:10])
                )

        all_plans = list(m.Plan.objects.filter(institution=institution))
        for code, name, mode in [
            ("ANZEIGE", "Produkttest · alle Jahrgänge", "week"),
            ("HEUTE", "Campus Nord · Heute", "today"),
            ("MORGEN", "Campus Nord · Morgen", "tomorrow"),
        ]:
            display = make(m.Display, code, name, view_mode=mode, show_teachers=True)
            display.plans.set(all_plans)
            self.stdout.write(f"{name}: /display/{display.token}")
        m.Institution.objects.filter(pk=institution.pk).update(
            revision=F("revision") + 1
        )
        m.Audit.objects.create(
            institution=institution,
            user=user,
            action="Fiktive Produkttestdaten ergänzt und konfliktfrei veröffentlicht",
        )
        self.stdout.write(
            self.style.SUCCESS(
                f"Produkttest bereit: {len(all_plans)} Pläne, "
                f"{m.Cohort.objects.filter(institution=institution).count()} Jahrgänge, "
                f"{m.Exam.objects.filter(institution=institution).count()} Prüfungen."
            )
        )
