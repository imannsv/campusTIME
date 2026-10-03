import io
import json
from datetime import date, datetime, timedelta
from pathlib import Path
from unittest.mock import patch

from config.database import database_configuration
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import SimpleTestCase, TestCase, override_settings
from rest_framework.test import APIClient

from . import models as m
from .services import attendance, plan_rows, session_row, validate_rows
from .solver import solve


@override_settings(DEBUG=True)
class PlatformTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_demo", password="TestCampuszeit2026!", stdout=io.StringIO())
        cls.user = get_user_model().objects.get(username="verwaltung")
        cls.institution = m.Institution.objects.get(slug="demo")
        cls.plan = m.Plan.objects.first()

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.plan.refresh_from_db()
        self.institution.refresh_from_db()

    def test_demo_is_complete_and_conflict_free(self):
        rows = [session_row(s) for s in self.plan.sessions.all()]
        self.assertEqual(validate_rows(self.plan, rows, coverage=True), [])

    def test_tenant_records_and_relations_are_isolated(self):
        other = m.Institution.objects.create(name="Andere Einrichtung", slug="other")
        area = m.Area.objects.create(
            institution=other, code="OTHER", name="Geheimer Bereich"
        )
        self.assertNotIn("Geheimer Bereich", str(self.client.get("/api/areas/").data))
        self.assertEqual(self.client.get(f"/api/areas/{area.id}/").status_code, 404)
        response = self.client.post(
            "/api/plans/",
            {
                "code": "LEAK",
                "name": "Leak",
                "period": self.plan.period_id,
                "area": area.id,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertFalse(m.Plan.objects.filter(code="LEAK").exists())

    def test_conflicting_manual_edit_rolls_back(self):
        sessions = list(self.plan.sessions.order_by("start"))
        a, b = sessions[0], sessions[1]
        original = b.start
        response = self.client.patch(
            f"/api/sessions/{b.id}/",
            {
                "start": a.start.isoformat(),
                "end": a.end.isoformat(),
                "rooms": list(a.rooms.values_list("id", flat=True)),
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        b.refresh_from_db()
        self.assertEqual(b.start, original)

    def test_public_payload_has_no_learner_identifiers(self):
        display = m.Display.objects.first()
        anon = APIClient()
        response = anon.get(f"/api/public/{display.token}/")
        self.assertEqual(response.status_code, 200)
        for row in response.data["rows"]:
            self.assertNotIn("learner_ids", row)
            self.assertNotIn("teacher_ids", row)
            self.assertNotIn("count", row)
            self.assertNotIn("Demo Studierende", json.dumps(row))

    def test_drafts_do_not_change_publication(self):
        display = m.Display.objects.first()
        before = self.client.get(f"/api/public/{display.token}/").data["rows"]
        s = self.plan.sessions.first()
        response = self.client.patch(
            f"/api/sessions/{s.id}/", {"name": "Neuer Entwurfsname"}, format="json"
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            self.client.get(f"/api/public/{display.token}/").data["rows"], before
        )
        response = self.client.post(
            f"/api/plans/{self.plan.id}/publish/", {}, format="json"
        )
        self.assertEqual(response.status_code, 200)
        self.assertNotEqual(
            self.client.get(f"/api/public/{display.token}/").data["rows"], before
        )

    def test_room_block_warns_public_and_prevents_publication(self):
        s = self.plan.sessions.first()
        block = m.RoomBlock.objects.create(
            institution=self.institution,
            code="NEWBLOCK",
            name="Bauarbeiten",
            start=s.start,
            end=s.end,
        )
        block.rooms.set(s.rooms.all())
        display = m.Display.objects.first()
        self.assertTrue(
            any(
                r["blocked"]
                for r in self.client.get(f"/api/public/{display.token}/").data["rows"]
            )
        )
        self.assertEqual(
            self.client.post(
                f"/api/plans/{self.plan.id}/publish/", {}, format="json"
            ).status_code,
            400,
        )

    def test_incomplete_soll_cannot_be_published(self):
        self.plan.sessions.first().delete()
        response = self.client.post(
            f"/api/plans/{self.plan.id}/publish/", {}, format="json"
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("Soll", str(response.data))

    def test_electives_use_actual_roster_and_common_events_deduplicate(self):
        elective = m.Course.objects.get(code="UX")
        ids, count, groups = attendance(elective)
        self.assertEqual(count, 20)
        self.assertEqual(len(ids), 20)
        self.assertEqual(groups, set())
        math = m.Course.objects.get(code="MAT")
        ids, count, _ = attendance(math)
        self.assertEqual(count, 54)
        extra = math.groups.first()
        learner = extra.people.first()
        learner.groups.add(math.groups.last())
        self.assertEqual(attendance(math)[1], 54)

    def test_import_preview_commit_and_duplicate_update(self):
        file = SimpleUploadedFile(
            "areas.csv", "code;name\nNEW;Neuer Bereich\n".encode()
        )
        preview = self.client.post(
            "/api/imports/areas/", {"file": file}, format="multipart"
        )
        self.assertEqual(preview.status_code, 200)
        self.assertEqual(preview.data["errors"], [])
        self.assertFalse(m.Area.objects.filter(code="NEW").exists())
        committed = self.client.post(
            "/api/imports/areas/", {"batch": preview.data["batch"]}, format="json"
        )
        self.assertEqual(committed.status_code, 200)
        file = SimpleUploadedFile("areas.csv", "code;name\nNEW;Geändert\n".encode())
        preview = self.client.post(
            "/api/imports/areas/", {"file": file}, format="multipart"
        )
        self.assertEqual(
            self.client.post(
                "/api/imports/areas/", {"batch": preview.data["batch"]}, format="json"
            ).status_code,
            200,
        )
        self.assertEqual(m.Area.objects.filter(code="NEW").count(), 1)
        self.assertEqual(m.Area.objects.get(code="NEW").name, "Geändert")

    def test_stale_solver_result_rejected(self):
        rows = [session_row(s) for s in self.plan.sessions.all()]
        job = m.Job.objects.create(
            institution=self.institution,
            plan=self.plan,
            revision=self.institution.revision,
            status="ready",
            result=rows,
        )
        self.client.post(
            "/api/areas/", {"code": "CHANGE", "name": "Änderung"}, format="json"
        )
        response = self.client.post(
            f"/api/jobs/{job.id}/", {"action": "apply"}, format="json"
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("geändert", str(response.data))

    def test_license_blocks_writes_but_keeps_reads(self):
        self.institution.license_until = date(2000, 1, 1)
        self.institution.save()
        self.assertEqual(self.client.get("/api/areas/").status_code, 200)
        self.assertEqual(
            self.client.post(
                "/api/areas/", {"code": "NO", "name": "Nein"}, format="json"
            ).status_code,
            400,
        )

    def test_csrf_required_for_session_writes(self):
        client = APIClient(enforce_csrf_checks=True)
        client.force_login(self.user)
        self.assertEqual(
            client.post(
                "/api/areas/", {"code": "CSRF", "name": "CSRF"}, format="json"
            ).status_code,
            403,
        )

    def test_solver_teaching_preserves_locks_and_satisfies_soll(self):
        locked = self.plan.sessions.first()
        locked.locked = True
        locked.save()
        state, message, rows = solve(self.plan, "teaching", lambda: False, seconds=10)
        self.assertEqual(state, "ready", message)
        self.assertEqual(validate_rows(self.plan, rows, coverage=True), [])
        preserved = next(r for r in rows if r.get("id") == locked.id)
        self.assertEqual(preserved["start"], locked.start.isoformat())

    def test_solver_cancellation(self):
        state, _, _ = solve(self.plan, "teaching", lambda: True, seconds=1)
        self.assertEqual(state, "cancelled")

    def test_solver_insufficient_rooms(self):
        m.Room.objects.all().update(capacity=1)
        state, message, _ = solve(self.plan, "teaching", lambda: False, seconds=1)
        self.assertEqual(state, "infeasible", message)

    def test_exam_solver_multi_room_and_gaps(self):
        floor = m.Floor.objects.first()
        for i in range(2):
            m.Room.objects.create(
                institution=self.institution,
                code=f"ER{i}",
                name=f"Prüfungsraum {i}",
                floor=floor,
                capacity=32,
                equipment=["Klausur"],
            )
        supervisors = list(m.Person.objects.filter(kind="teacher")[:2])
        learners = list(m.Person.objects.filter(kind="learner"))
        for i in range(2):
            exam = m.Exam.objects.create(
                institution=self.institution,
                code=f"E{i}",
                name=f"Klausur {i}",
                plan=self.plan,
                window_start=date(2026, 10, 19),
                window_end=date(2026, 10, 23),
                duration_minutes=120,
                equipment=["Klausur"],
            )
            exam.learners.set(learners)
            exam.supervisors.set(supervisors)
        state, message, rows = solve(self.plan, "exams", lambda: False, seconds=10)
        self.assertEqual(state, "ready", message)
        self.assertEqual(validate_rows(self.plan, rows, coverage=True), [])
        exam_rows = [r for r in rows if r.get("exam")]
        self.assertEqual(len(exam_rows), 2)
        self.assertTrue(all(len(r["room_ids"]) == 2 for r in exam_rows))

    def test_floor_upload_requires_valid_image(self):
        floor = m.Floor.objects.first()
        response = self.client.post(
            f"/api/floors/{floor.id}/upload/",
            {"file": SimpleUploadedFile("fake.png", b"not an image")},
            format="multipart",
        )
        self.assertEqual(response.status_code, 400)

    def test_disabled_display_is_not_public(self):
        display = m.Display.objects.first()
        display.active = False
        display.save()
        self.assertEqual(
            APIClient().get(f"/api/public/{display.token}/").status_code, 404
        )

    def create_extra_course(self, **kwargs):
        plan = m.Plan.objects.create(
            institution=self.institution,
            code="EXTRA",
            name="Zusatzplan",
            period=self.plan.period,
            area=self.plan.area,
        )
        course = m.Course.objects.create(
            institution=self.institution,
            code="EXTRA",
            name="Blockkurs",
            plan=plan,
            **kwargs,
        )
        course.groups.set([m.Group.objects.first()])
        course.teachers.set([m.Person.objects.filter(kind="teacher").last()])
        return plan, course

    def test_manual_weekly_series(self):
        plan, course = self.create_extra_course()
        room = m.Room.objects.get(code="H102")
        response = self.client.post(
            "/api/sessions/",
            {
                "plan": plan.id,
                "course": course.id,
                "start": "2026-10-09T14:00:00+02:00",
                "end": "2026-10-09T15:30:00+02:00",
                "rooms": [room.id],
                "repeat_weekly": True,
                "repeat_until": "2026-10-23",
                "repeat_interval": 1,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(plan.sessions.count(), 3)
        self.assertEqual(
            validate_rows(
                plan, [session_row(s) for s in plan.sessions.all()], coverage=True
            ),
            [],
        )

    def test_multi_day_blocks_and_per_occurrence_teachers(self):
        plan, course = self.create_extra_course(
            target_mode="total", target_units=8, duration_minutes=90, block_days=2
        )
        teachers = list(m.Person.objects.filter(kind="teacher").order_by("id")[:2])
        course.teachers.set(teachers)
        course.teacher_assignments = [
            [teachers[0].id],
            [teachers[1].id],
            [teachers[0].id],
            [teachers[1].id],
        ]
        course.save()
        state, message, rows = solve(plan, "teaching", lambda: False, seconds=10)
        self.assertEqual(state, "ready", message)
        self.assertEqual(validate_rows(plan, rows, coverage=True), [])
        rows.sort(key=lambda r: r["start"])
        self.assertEqual([r["teacher_ids"] for r in rows], course.teacher_assignments)
        for i in [0, 2]:
            self.assertEqual(
                datetime.fromisoformat(rows[i + 1]["start"])
                - datetime.fromisoformat(rows[i]["start"]),
                timedelta(days=1),
            )

    def test_jobs_list_is_tenant_scoped(self):
        m.Job.objects.create(institution=self.institution, plan=self.plan, revision=0)
        other = m.Institution.objects.create(
            name="Andere Einrichtung", slug="job-other"
        )
        m.Job.objects.create(institution=other, plan=self.plan, revision=0)
        response = self.client.get(f"/api/jobs/?plan={self.plan.id}")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)

    def test_public_time_window_and_health(self):
        display = m.Display.objects.first()
        response = APIClient().get(
            f"/api/public/{display.token}/",
            {
                "since": "2026-10-05T00:00:00+02:00",
                "until": "2026-10-12T00:00:00+02:00",
            },
        )
        self.assertEqual(len(response.data["rows"]), 10)
        self.assertEqual(response.data["weekdays"], [0, 1, 2, 3, 4])
        self.assertEqual(APIClient().get("/api/health/").status_code, 200)

    def test_display_mode_is_fixed_for_visitors(self):
        display = m.Display.objects.first()
        display.view_mode = "today"
        display.save()
        url = f"/api/public/{display.token}/"
        with patch(
            "planner.views.timezone.now",
            return_value=datetime.fromisoformat("2026-10-05T12:00:00+00:00"),
        ):
            today = APIClient().get(
                url, {"since": "2027-01-01T00:00:00Z", "until": "2027-02-01T00:00:00Z"}
            )
            for attempted_mode in ["week", "tomorrow", "invalid"]:
                override = APIClient().get(url, {"view": attempted_mode})
                self.assertEqual(override.status_code, 200)
                self.assertEqual(override.data["view_mode"], "today")
                self.assertEqual(override.data["rows"], today.data["rows"])
            display.view_mode = "tomorrow"
            display.save()
            tomorrow = APIClient().get(url, {"view": "today"})
        self.assertEqual(today.data["view_mode"], "today")
        self.assertEqual(len(today.data["rows"]), 3)
        self.assertEqual(len(tomorrow.data["rows"]), 2)
        self.assertEqual(tomorrow.data["window_start"].date(), date(2026, 10, 6))
        display.refresh_from_db()
        self.assertEqual(display.view_mode, "tomorrow")
        self.assertNotIn("learner_ids", today.data["rows"][0])
        display.view_mode = "week"
        display.save()
        for attempted_mode in ["today", "tomorrow"]:
            response = APIClient().get(
                url,
                {
                    "view": attempted_mode,
                    "since": "2026-10-05T00:00:00+02:00",
                    "until": "2026-10-12T00:00:00+02:00",
                },
            )
            self.assertEqual(response.data["view_mode"], "week")
            self.assertEqual(len(response.data["rows"]), 10)

    def test_daily_display_rollover_empty_days_and_timezone(self):
        display = m.Display.objects.first()
        display.view_mode = "today"
        display.save()
        url = f"/api/public/{display.token}/"
        with patch(
            "planner.views.timezone.now",
            return_value=datetime.fromisoformat("2026-10-05T21:59:00+00:00"),
        ):
            before = APIClient().get(url, {"view": "today"})
        with patch(
            "planner.views.timezone.now",
            return_value=datetime.fromisoformat("2026-10-05T22:01:00+00:00"),
        ):
            after = APIClient().get(url, {"view": "today"})
        self.assertEqual(before.data["window_start"].date(), date(2026, 10, 5))
        self.assertEqual(after.data["window_start"].date(), date(2026, 10, 6))
        with patch(
            "planner.views.timezone.now",
            return_value=datetime.fromisoformat("2026-10-04T12:00:00+00:00"),
        ):
            empty = APIClient().get(url, {"view": "today"})
        self.assertEqual(empty.data["rows"], [])
        self.assertEqual(empty.data["window_start"].date(), date(2026, 10, 4))
        self.institution.timezone = "Pacific/Auckland"
        self.institution.save()
        with patch(
            "planner.views.timezone.now",
            return_value=datetime.fromisoformat("2026-10-05T12:00:00+00:00"),
        ):
            remote_zone = APIClient().get(url, {"view": "today"})
        self.assertEqual(remote_zone.data["window_start"].date(), date(2026, 10, 6))

    def test_daily_display_dst_and_year_boundary(self):
        display = m.Display.objects.first()
        display.view_mode = "tomorrow"
        display.save()
        url = f"/api/public/{display.token}/"
        with patch(
            "planner.views.timezone.now",
            return_value=datetime.fromisoformat("2026-10-24T12:00:00+00:00"),
        ):
            result = APIClient().get(url, {"view": "tomorrow"}).data
        self.assertEqual(result["window_start"].date(), date(2026, 10, 25))
        self.assertEqual(
            result["window_end"].timestamp() - result["window_start"].timestamp(),
            25 * 3600,
        )
        with patch(
            "planner.views.timezone.now",
            return_value=datetime.fromisoformat("2026-12-31T12:00:00+00:00"),
        ):
            result = APIClient().get(url, {"view": "tomorrow"}).data
        self.assertEqual(result["window_start"].date(), date(2027, 1, 1))
        self.assertEqual(APIClient().get(url, {"view": "invalid"}).status_code, 200)
        display.view_mode = "week"
        display.save()
        self.assertEqual(
            APIClient()
            .get(
                url, {"since": "2026-10-06T00:00:00Z", "until": "2026-10-05T00:00:00Z"}
            )
            .status_code,
            400,
        )


@override_settings(DEBUG=True)
class ShowcaseTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_demo", password="TestCampuszeit2026!", stdout=io.StringIO())
        call_command("seed_showcase", date=date(2026, 10, 3), stdout=io.StringIO())
        cls.institution = m.Institution.objects.get(slug="demo")

    def test_showcase_is_complete_published_and_globally_conflict_free(self):
        self.assertEqual(m.Plan.objects.count(), 8)
        self.assertEqual(m.Cohort.objects.count(), 7)
        self.assertEqual(m.Exam.objects.count(), 16)
        self.assertEqual(m.Person.objects.filter(kind="learner").count(), 262)
        self.assertEqual(m.Session.objects.count(), 246)
        for plan in m.Plan.objects.select_related("institution", "period"):
            self.assertEqual(
                validate_rows(plan, plan_rows(plan), coverage=True), [], plan.name
            )
            self.assertEqual(m.Publication.objects.filter(plan=plan).count(), 1)
        shared = m.Session.objects.get(exam__code="SHOW-GEM-KL")
        row = session_row(shared)
        self.assertEqual(len(row["room_allocations"]), 2)
        self.assertEqual(
            sum(len(a["learner_ids"]) for a in row["room_allocations"]), 76
        )

    def test_showcase_is_idempotent_and_today_tomorrow_are_populated(self):
        counts = (
            m.Person.objects.count(),
            m.Session.objects.count(),
            m.Publication.objects.count(),
        )
        call_command("seed_showcase", date=date(2026, 10, 4), stdout=io.StringIO())
        self.assertEqual(
            counts,
            (
                m.Person.objects.count(),
                m.Session.objects.count(),
                m.Publication.objects.count(),
            ),
        )
        with patch(
            "planner.views.timezone.now",
            return_value=datetime.fromisoformat("2026-10-03T12:00:00+00:00"),
        ):
            for code, day in [
                ("SHOW-HEUTE", date(2026, 10, 3)),
                ("SHOW-MORGEN", date(2026, 10, 4)),
            ]:
                display = m.Display.objects.get(code=code)
                result = APIClient().get(f"/api/public/{display.token}/").data
                self.assertEqual(len(result["rows"]), 3)
                self.assertEqual(result["window_start"].date(), day)


class DatabaseConfigurationTests(SimpleTestCase):
    def test_supabase_uses_encryption_and_a_private_schema(self):
        env = {
            "POSTGRES_HOST": "db.knwieisajkaiphosfssa.supabase.co",
            "POSTGRES_PASSWORD": "test-only",
        }
        config = database_configuration(env, Path("backend"))
        self.assertEqual(config["OPTIONS"]["sslmode"], "require")
        self.assertEqual(config["OPTIONS"]["options"], "-c search_path=campustime")
        self.assertEqual(config["NAME"], "postgres")
        for unsafe in [
            {"POSTGRES_SCHEMA": "public"},
            {"POSTGRES_SSLMODE": "disable"},
            {"POSTGRES_SCHEMA": "campustime,public"},
        ]:
            with self.assertRaises(RuntimeError):
                database_configuration({**env, **unsafe}, Path("backend"))

    def test_local_postgres_and_sqlite_remain_supported(self):
        env = {"POSTGRES_HOST": "127.0.0.1", "POSTGRES_PASSWORD": "test-only"}
        self.assertEqual(
            database_configuration(env, Path("backend"))["OPTIONS"]["options"],
            "-c search_path=public",
        )
        self.assertEqual(
            database_configuration({}, Path("backend"))["ENGINE"],
            "django.db.backends.sqlite3",
        )
