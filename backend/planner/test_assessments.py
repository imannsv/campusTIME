import io

from django.core.management import call_command
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from . import models as m
from .progression import progression
from .services import plan_rows, validate_rows


@override_settings(DEBUG=True)
class SemesterAssessmentTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_demo", password="TestOnly2026!", stdout=io.StringIO())
        cls.institution = m.Institution.objects.get(slug="demo")
        cls.program = m.Program.objects.create(
            institution=cls.institution, code="AS-SG", name="Prüfungsstudiengang"
        )
        cls.version = m.StudyVersion.objects.create(
            institution=cls.institution,
            program=cls.program,
            code="AS-LP",
            name="Lehrplan",
            version="2027",
            duration_semesters=2,
            total_credits=10,
            status="approved",
        )
        cls.root = m.Module.objects.create(
            institution=cls.institution,
            study_version=cls.version,
            code="AS-ROOT",
            name="Grundlagen",
            credits=10,
            assessment_type="none",
        )
        cls.first = m.Module.objects.create(
            institution=cls.institution,
            study_version=cls.version,
            parent=cls.root,
            code="AS-M1",
            name="Programmierung",
            credits=5,
            assessment_type="exam",
            assessment_duration_minutes=90,
            assessment_notes="Einfacher Taschenrechner erlaubt.",
        )
        cls.second = m.Module.objects.create(
            institution=cls.institution,
            study_version=cls.version,
            parent=cls.root,
            code="AS-M2",
            name="Wissenschaftliches Arbeiten",
            credits=5,
            assessment_type="term_paper",
            assessment_notes="15 Seiten; Abgabe vier Wochen nach Themenausgabe.",
        )
        cls.first_unit = m.TeachingUnit.objects.create(
            institution=cls.institution,
            module=cls.first,
            code="AS-L1",
            name=cls.first.name,
            semester=1,
        )
        cls.second_unit = m.TeachingUnit.objects.create(
            institution=cls.institution,
            module=cls.second,
            code="AS-L2",
            name=cls.second.name,
            semester=2,
        )

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(
            m.Membership.objects.get(institution=self.institution).user
        )
        self.cohort = m.Cohort.objects.create(
            institution=self.institution,
            program=self.program,
            study_version=self.version,
            code="AS-JG",
            name="Jahrgang",
        )
        self.group = m.Group.objects.create(
            institution=self.institution,
            cohort=self.cohort,
            code="AS-G",
            name="Prüfungsgruppe",
            size=4,
        )
        self.learners = list(
            m.Person.objects.filter(institution=self.institution, kind="learner")[:4]
        )
        for learner in self.learners:
            learner.groups.add(self.group)
        self.plan = m.Plan.objects.create(
            institution=self.institution,
            cohort=self.cohort,
            semester=1,
            code="AS-P",
            name="Semester 1",
            period=m.Period.objects.first(),
            area=m.Area.objects.first(),
        )
        self.url = f"/api/plans/{self.plan.id}/prepare-assessments/"

    def prepare(self, plan=None):
        response = self.client.post(
            f"/api/plans/{(plan or self.plan).id}/prepare-assessments/",
            {},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        return response.data

    def test_copy_is_idempotent_and_does_not_create_exam_bookings(self):
        self.assertEqual(self.prepare()["created"], 1)
        source = m.Assessment.objects.get(plan=self.plan)
        self.assertEqual(source.assessment_duration_minutes, 90)
        self.assertEqual(source.assessment_notes, self.first.assessment_notes)
        source.assessment_duration_minutes = 120
        source.assessment_notes = "Manuelle Anpassung"
        source.save()
        report = self.prepare()
        self.assertEqual(report["created"], 0)
        self.assertEqual(report["existing"], 1)
        source.refresh_from_db()
        self.assertEqual(source.assessment_duration_minutes, 120)
        self.assertEqual(source.assessment_notes, "Manuelle Anpassung")
        self.assertFalse(self.plan.exam_set.exists())
        self.assertFalse(self.plan.sessions.exists())
        self.assertEqual(
            validate_rows(self.plan, plan_rows(self.plan), coverage=True), []
        )

    def test_parent_and_child_requirements_have_separate_completion_semesters(self):
        self.root.assessment_type = "exam"
        self.root.assessment_duration_minutes = 120
        self.root.save()
        self.prepare()
        self.assertEqual(
            list(self.plan.assessments.values_list("module_id", flat=True)),
            [self.first.id],
        )
        second_plan = m.Plan.objects.create(
            institution=self.institution,
            cohort=self.cohort,
            semester=2,
            code="AS-P2",
            name="Semester 2",
            period=self.plan.period,
            area=self.plan.area,
        )
        self.prepare(second_plan)
        self.assertEqual(
            set(second_plan.assessments.values_list("module_id", flat=True)),
            {self.root.id, self.second.id},
        )

    def test_saved_cohort_overrides_control_assessment_semester_and_are_protected(self):
        self.cohort.study_schedule = {
            str(self.first_unit.id): {"semester": 2, "pinned": True}
        }
        self.cohort.save()
        self.assertEqual(self.prepare()["created"], 0)
        self.plan.semester = 2
        self.plan.save()
        self.assertEqual(self.prepare()["created"], 2)
        from rest_framework.exceptions import ValidationError

        with self.assertRaises(ValidationError):
            progression(
                self.cohort, {str(self.first_unit.id): {"semester": 1, "pinned": True}}
            )
        response = self.client.patch(
            f"/api/plans/{self.plan.id}/", {"semester": 1}, format="json"
        )
        self.assertEqual(response.status_code, 400)

    def test_unspecified_warns_and_no_own_assessment_is_skipped(self):
        self.first.assessment_type = "unspecified"
        self.first.assessment_duration_minutes = None
        self.first.save()
        report = self.prepare()
        self.assertEqual(report["created"], 0)
        self.assertIn("noch nicht festgelegt", str(report["warnings"]))
        self.first.assessment_type = "none"
        self.first.save()
        self.assertEqual(self.prepare()["warnings"], [])

    def test_deadline_can_be_set_without_creating_a_room_exam(self):
        self.plan.semester = 2
        self.plan.save()
        self.prepare()
        source = m.Assessment.objects.get(plan=self.plan)
        response = self.client.patch(
            f"/api/assessments/{source.id}/",
            {"due_at": "2027-02-18T23:59:00+01:00"},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["assessment_type"], "term_paper")
        self.assertFalse(self.plan.exam_set.exists())
        self.assertEqual(
            self.client.get(f"/api/assessments/{source.id}/exam_draft/").status_code,
            400,
        )
        self.prepare()
        source.refresh_from_db()
        self.assertIsNotNone(source.due_at)

    def test_exam_defaults_and_concrete_creation_preserve_origin_and_prevent_duplicates(
        self,
    ):
        self.client.post(f"/api/plans/{self.plan.id}/prepare/", {}, format="json")
        self.prepare()
        source = m.Assessment.objects.get(plan=self.plan)
        response = self.client.get(f"/api/assessments/{source.id}/exam_draft/")
        self.assertEqual(response.status_code, 200)
        body = response.data["defaults"]
        self.assertEqual(set(body["learners"]), {person.id for person in self.learners})
        self.assertEqual(body["duration_minutes"], 90)
        self.assertEqual(body["course"], self.plan.course_set.get().id)
        response = self.client.post("/api/exams/", body, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["assessment_template"], source.id)
        self.assertEqual(response.data["assessment_notes"], self.first.assessment_notes)
        body["code"] = "AS-DUP"
        self.assertEqual(
            self.client.post("/api/exams/", body, format="json").status_code, 400
        )
        self.assertEqual(
            self.client.get(f"/api/assessments/{source.id}/exam_draft/").status_code,
            400,
        )
        self.assertEqual(
            self.client.patch(
                f"/api/exams/{response.data['id']}/",
                {"assessment_template": None},
                format="json",
            ).status_code,
            400,
        )
        self.assertEqual(
            self.client.patch(
                f"/api/assessments/{source.id}/", {"status": "waived"}, format="json"
            ).status_code,
            400,
        )

    def test_elective_participants_are_not_guessed_from_full_year_roster(self):
        self.first_unit.elective = True
        self.first_unit.save()
        self.client.post(f"/api/plans/{self.plan.id}/prepare/", {}, format="json")
        self.prepare()
        source = m.Assessment.objects.get(plan=self.plan)
        response = self.client.get(f"/api/assessments/{source.id}/exam_draft/")
        self.assertEqual(response.data["defaults"]["learners"], [])
        self.assertTrue(response.data["warnings"])
        self.assertEqual(
            self.client.post(
                "/api/exams/", response.data["defaults"], format="json"
            ).status_code,
            400,
        )
        course = self.plan.course_set.get()
        course.learners.add(self.learners[0])
        defaults = self.client.get(f"/api/assessments/{source.id}/exam_draft/").data[
            "defaults"
        ]
        self.assertEqual(defaults["learners"], [self.learners[0].id])

    def test_linked_template_is_protected_but_whole_plan_can_be_deleted(self):
        self.prepare()
        source = m.Assessment.objects.get(plan=self.plan)
        defaults = self.client.get(f"/api/assessments/{source.id}/exam_draft/").data[
            "defaults"
        ]
        response = self.client.post("/api/exams/", defaults, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        exam_id = response.data["id"]
        self.assertEqual(
            self.client.delete(f"/api/assessments/{source.id}/").status_code, 400
        )
        response = self.client.delete(f"/api/plans/{self.plan.id}/")
        self.assertEqual(response.status_code, 204, response.data)
        self.assertFalse(m.Exam.objects.filter(id=exam_id).exists())
        self.assertFalse(m.Assessment.objects.filter(id=source.id).exists())

    def test_invalid_requirements_and_foreign_tenant_access_fail(self):
        self.prepare()
        source = m.Assessment.objects.get(plan=self.plan)
        for body in [
            {"assessment_duration_minutes": 0},
            {"due_at": "2027-02-18T12:00:00Z"},
            {"assessment_type": "none"},
            {"module": self.second.id},
            {"assessment_notes": "x" * 2001},
        ]:
            with self.subTest(body=body):
                self.assertEqual(
                    self.client.patch(
                        f"/api/assessments/{source.id}/", body, format="json"
                    ).status_code,
                    400,
                )
        other = m.Institution.objects.create(slug="assessment-other", name="Andere Uni")
        from django.contrib.auth import get_user_model

        user = get_user_model().objects.create_user(username="assessment-other")
        m.Membership.objects.create(institution=other, user=user, role="admin")
        self.client.force_authenticate(user)
        self.assertEqual(
            self.client.get(f"/api/assessments/{source.id}/exam_draft/").status_code,
            404,
        )
        self.assertEqual(self.client.post(self.url, {}, format="json").status_code, 404)
