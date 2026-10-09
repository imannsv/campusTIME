from datetime import datetime
from zoneinfo import ZoneInfo

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from . import models as m
from .occupancy import overview


class ResourceOccupancyTests(TestCase):
    def setUp(self):
        self.institution = m.Institution.objects.create(name="Testhochschule", slug="occupancy")
        self.user = get_user_model().objects.create_user("occupancy-reader")
        m.Membership.objects.create(user=self.user, institution=self.institution)
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.area = self.make(m.Area, "AREA")
        self.period = self.make(m.Period, "PERIOD", start="2026-10-01", end="2026-11-30")
        self.plan = self.make(m.Plan, "PLAN", area=self.area, period=self.period)
        self.building = self.make(m.Building, "BUILDING")
        self.floor = self.make(m.Floor, "FLOOR", building=self.building, level=1)
        self.room = self.make(m.Room, "ROOM", floor=self.floor)
        self.second_room = self.make(m.Room, "ROOM2", floor=self.floor)
        self.teacher = self.make(m.Person, "TEACHER", kind="teacher")
        self.second_teacher = self.make(m.Person, "TEACHER2", kind="teacher")
        self.learner = self.make(m.Person, "PRIVATE-LEARNER", kind="learner")
        self.course = self.make(m.Course, "COURSE", plan=self.plan)
        self.course.teachers.set([self.teacher, self.second_teacher])
        self.course.learners.set([self.learner])
        self.session = m.Session.objects.create(institution=self.institution, plan=self.plan, course=self.course, start=self.dt("2026-10-09T09:00"), end=self.dt("2026-10-09T10:30"))
        self.session.rooms.set([self.room, self.second_room])

    def dt(self, value):
        return datetime.fromisoformat(value).replace(tzinfo=ZoneInfo("Europe/Berlin"))

    def make(self, model, code, **values):
        return model.objects.create(institution=self.institution, code=code, name=code, **values)

    def get(self, **params):
        return self.client.get("/api/resource-occupancy/", {"start": "2026-10-09", **params})

    def snapshot(self):
        from .services import plan_rows
        return plan_rows(self.plan)

    def test_team_and_multiple_rooms_without_learner_data(self):
        response = self.get()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Cache-Control"], "private, no-store")
        row = response.data["rows"][0]
        self.assertEqual(set(row["teacher_ids"]), {self.teacher.id, self.second_teacher.id})
        self.assertEqual(set(row["room_ids"]), {self.room.id, self.second_room.id})
        self.assertEqual(row["status"], "draft")
        self.assertNotIn("learner_ids", row)
        self.assertNotIn("PRIVATE-LEARNER", str(response.data))
        self.session.teachers.set([self.second_teacher])
        self.assertEqual(self.get().data["rows"][0]["teacher_ids"], [self.second_teacher.id])

    def test_unrestricted_availability_still_respects_individual_blocks(self):
        from .services import available
        self.teacher.availability = {"unrestricted": True, "windows": [], "exclusions": [{"start": "2026-10-11T11:00:00+02:00", "end": "2026-10-11T12:00:00+02:00"}]}
        self.assertTrue(available(self.teacher, self.dt("2026-10-11T10:00"), self.dt("2026-10-11T11:00"), self.institution))
        self.assertFalse(available(self.teacher, self.dt("2026-10-11T11:00"), self.dt("2026-10-11T12:00"), self.institution))

    def test_block_time_cancels_persistently_and_updates_published_views(self):
        m.Publication.objects.create(institution=self.institution, plan=self.plan, number=1, snapshot=self.snapshot())
        display = self.make(m.Display, "DISPLAY", show_teachers=True)
        display.plans.set([self.plan])
        response = self.client.post(f"/api/people/{self.teacher.id}/block-time/", {"start": "2026-10-09T10:00:00+02:00", "end": "2026-10-09T11:00:00+02:00"}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["cancelled_count"], 1)
        self.session.refresh_from_db()
        self.assertTrue(self.session.cancelled)
        for source in ["planning", "published"]:
            rows = self.get(source=source).data["rows"]
            self.assertTrue(next(row for row in rows if row["id"] == self.session.id)["cancelled"])
            self.assertTrue(any(row["kind"] == "teacher_block" for row in rows))
        public = APIClient().get(f"/api/public/{display.token}/")
        self.assertEqual(public.status_code, 200)
        self.assertTrue(public.data["rows"][0]["cancelled"])
        result = self.client.patch(f"/api/people/{self.teacher.id}/", {"availability": {"unrestricted": True, "exclusions": []}}, format="json")
        self.assertEqual(result.status_code, 200)
        self.session.refresh_from_db()
        self.assertTrue(self.session.cancelled)

    def test_block_time_has_strict_boundaries_and_uses_actual_teacher_team(self):
        self.session.teachers.set([self.second_teacher])
        response = self.client.post(f"/api/people/{self.teacher.id}/block-time/", {"start": "2026-10-09T09:00:00+02:00", "end": "2026-10-09T10:30:00+02:00"}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["cancelled_count"], 0)
        response = self.client.post(f"/api/people/{self.second_teacher.id}/block-time/", {"start": "2026-10-09T10:30:00+02:00", "end": "2026-10-09T11:30:00+02:00"}, format="json")
        self.assertEqual(response.data["cancelled_count"], 0)

    def test_block_time_validation_and_tenant_scope(self):
        other = m.Institution.objects.create(name="Andere", slug="blocked-other")
        foreign = m.Person.objects.create(institution=other, code="FOREIGN", name="Andere Lehrperson", kind="teacher")
        payload = {"start": "2026-10-09T10:00:00+02:00", "end": "2026-10-09T11:00:00+02:00"}
        self.assertEqual(self.client.post(f"/api/people/{foreign.id}/block-time/", payload, format="json").status_code, 404)
        payload["end"] = payload["start"]
        self.assertEqual(self.client.post(f"/api/people/{self.teacher.id}/block-time/", payload, format="json").status_code, 400)
        self.assertEqual(APIClient().post(f"/api/people/{self.teacher.id}/block-time/", payload, format="json").status_code, 403)

    def test_regular_availability_update_cancels_and_ignores_cancelled_resources(self):
        from .services import resource_keys, validate_rows
        response = self.client.patch(f"/api/people/{self.teacher.id}/", {"availability": {"unrestricted": True, "exclusions": [{"start": "2026-10-09T10:00:00+02:00", "end": "2026-10-09T11:00:00+02:00"}]}}, format="json")
        self.assertEqual(response.status_code, 200)
        rows = self.snapshot()
        self.assertTrue(rows[0]["cancelled"])
        self.assertEqual(resource_keys(rows[0]), [])
        self.assertEqual(validate_rows(self.plan, rows), [])
        restore = self.client.patch(f"/api/sessions/{self.session.id}/", {"cancelled": False}, format="json")
        self.assertEqual(restore.status_code, 400)
        self.session.refresh_from_db()
        self.assertTrue(self.session.cancelled)

    def test_solver_application_keeps_cancelled_history(self):
        self.session.cancelled = True
        self.session.save()
        job = m.Job.objects.create(institution=self.institution, plan=self.plan, status="ready", kind="teaching", revision=self.institution.revision, result=[])
        response = self.client.post(f"/api/jobs/{job.id}/", {"action": "apply"}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(m.Session.objects.filter(pk=self.session.id, cancelled=True).exists())

    def test_block_time_cancels_exams_and_rejects_non_boolean_availability(self):
        exam = self.make(m.Exam, "BLOCK-EXAM", plan=self.plan, window_start="2026-10-09", window_end="2026-10-09")
        exam.supervisors.set([self.teacher])
        appointment = m.Session.objects.create(institution=self.institution, plan=self.plan, exam=exam, start=self.dt("2026-10-09T12:00"), end=self.dt("2026-10-09T13:00"))
        response = self.client.post(f"/api/people/{self.teacher.id}/block-time/", {"start": "2026-10-09T11:00:00+02:00", "end": "2026-10-09T13:00:00+02:00"}, format="json")
        self.assertEqual(response.data["cancelled_count"], 1)
        appointment.refresh_from_db()
        self.assertTrue(appointment.cancelled)
        response = self.client.patch(f"/api/people/{self.teacher.id}/", {"availability": {"unrestricted": "false"}}, format="json")
        self.assertEqual(response.status_code, 400)

    def test_latest_publication_and_changed_draft_are_distinguished(self):
        old = self.snapshot()
        m.Publication.objects.create(institution=self.institution, plan=self.plan, number=1, snapshot=old)
        self.session.name = "Aktualisiert"
        self.session.save()
        self.assertEqual(self.get().data["rows"][0]["status"], "draft")
        self.assertEqual(self.get(source="published").data["rows"][0]["name"], "COURSE")
        m.Publication.objects.create(institution=self.institution, plan=self.plan, number=2, snapshot=self.snapshot())
        self.assertEqual(self.get().data["rows"][0]["status"], "published")
        rows = self.get(source="published").data["rows"]
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["name"], "Aktualisiert")

    def test_date_boundaries_overnight_and_week(self):
        self.session.start = self.dt("2026-10-08T23:30")
        self.session.end = self.dt("2026-10-09T01:00")
        self.session.save()
        self.assertEqual(len(self.get().data["rows"]), 1)
        self.assertEqual(len(self.get(start="2026-10-10").data["rows"]), 0)
        self.assertEqual(len(self.get(start="2026-10-05", end="2026-10-11").data["rows"]), 1)
        self.session.end = self.dt("2026-10-09T00:00")
        self.session.save()
        self.assertEqual(len(self.get().data["rows"]), 0)

    def test_blocks_repeat_with_local_time_across_dst_and_stop_at_limit(self):
        block = self.make(m.RoomBlock, "BAU", start=self.dt("2026-10-23T08:00"), end=self.dt("2026-10-23T10:00"), repeat_weekly=True, repeat_until="2026-10-30")
        block.rooms.set([self.room])
        block.refresh_from_db()
        for source in ["planning", "published"]:
            rows = self.get(start="2026-10-30", source=source).data["rows"]
            self.assertEqual(len(rows), 1)
            self.assertEqual(rows[0]["status"], "blocked")
            self.assertEqual(rows[0]["start"], "2026-10-30T08:00:00+01:00")
        self.assertEqual(self.get(start="2026-11-06").data["rows"], [])

    def test_exams_and_other_plans_are_included(self):
        plan = self.make(m.Plan, "OTHER-PLAN", area=self.area, period=self.period)
        exam = self.make(m.Exam, "EXAM", plan=plan, window_start="2026-10-09", window_end="2026-10-09")
        exam.supervisors.set([self.teacher])
        session = m.Session.objects.create(institution=self.institution, plan=plan, exam=exam, start=self.dt("2026-10-09T12:00"), end=self.dt("2026-10-09T13:00"))
        session.rooms.set([self.room])
        rows = self.get().data["rows"]
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[1]["kind"], "exam")
        self.assertEqual(rows[1]["teacher_ids"], [self.teacher.id])
        from .services import plan_rows
        m.Publication.objects.create(institution=self.institution, plan=plan, number=1, snapshot=plan_rows(plan))
        self.assertEqual(self.get().data["rows"][1]["status"], "published")

    def test_authentication_and_tenant_isolation(self):
        other = m.Institution.objects.create(name="Andere Hochschule", slug="other-occupancy")
        m.Person.objects.create(institution=other, code="SECRET", name="Nicht sichtbar", kind="teacher")
        foreign_plan = m.Plan.objects.create(institution=other, code="SECRET", name="SECRET", area=self.area, period=self.period)
        m.Publication.objects.create(institution=other, plan=foreign_plan, number=1, snapshot=self.snapshot())
        self.assertNotIn("SECRET", str(self.get(source="published").data))
        self.assertEqual(len(self.get().data["teachers"]), 2)
        self.client.force_authenticate(None)
        self.assertEqual(self.get().status_code, 403)

    def test_invalid_ranges_and_sources_are_rejected(self):
        for params in [{"start": "2026-02-30"}, {"start": "bad"}, {"end": "2026-10-08"}, {"end": "2026-11-09"}, {"source": "unknown"}]:
            self.assertEqual(self.get(**params).status_code, 400, params)
        self.assertEqual(self.get(end="2026-11-08").status_code, 200)
