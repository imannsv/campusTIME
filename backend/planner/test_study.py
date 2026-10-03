import io
from datetime import datetime

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase, override_settings
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient

from . import models as m
from .services import available, validate_rows
from .solver import solve
from .study import structure_report, validate_study


@override_settings(DEBUG=True)
class StudyWorkflowTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_demo", password="TestOnly2026!", stdout=io.StringIO())
        cls.institution = m.Institution.objects.get(slug="demo")

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(
            get_user_model().objects.get(username="verwaltung")
        )
        self.program = m.Program.objects.create(
            institution=self.institution,
            code="TEST-SG",
            name="Teststudiengang",
            duration_semesters=2,
            total_credits=10,
        )
        self.version = m.StudyVersion.objects.create(
            institution=self.institution,
            program=self.program,
            code="TEST-LP",
            name="Testlehrplan",
            version="2027",
            duration_semesters=2,
            total_credits=10,
        )
        self.root = m.Module.objects.create(
            institution=self.institution,
            study_version=self.version,
            code="TEST-ROOT",
            name="Informatik",
            credits=10,
        )
        self.first = m.Module.objects.create(
            institution=self.institution,
            study_version=self.version,
            parent=self.root,
            code="TEST-M1",
            name="Programmierung",
            credits=5,
        )
        self.second = m.Module.objects.create(
            institution=self.institution,
            study_version=self.version,
            parent=self.root,
            code="TEST-M2",
            name="Datenbanken",
            credits=5,
        )
        self.second.prerequisites.set([self.first])
        self.teacher = m.Person.objects.filter(kind="teacher").first()
        self.teacher.availability = {
            "windows": [
                {"weekday": 0, "from": "14:00", "to": "16:00"},
                {"weekday": 2, "from": "09:00", "to": "10:00"},
            ]
        }
        self.teacher.save()
        self.units = []
        for semester, module in enumerate([self.first, self.second], 1):
            unit = m.TeachingUnit.objects.create(
                institution=self.institution,
                module=module,
                code=f"TEST-L{semester}",
                name=module.name,
                semester=semester,
                target_units=2,
                duration_minutes=90,
            )
            unit.teachers.set([self.teacher])
            self.units.append(unit)

    def approve(self):
        response = self.client.post(
            f"/api/studyversions/{self.version.id}/approve/", {}, format="json"
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.version.refresh_from_db()

    def test_credits_count_once_and_approved_versions_are_immutable(self):
        report = structure_report(self.version)
        self.assertEqual(report["credits"], "10.0")
        self.assertEqual(report["errors"], [])
        cached_module = m.Module.objects.select_related("study_version").get(
            pk=self.first.pk
        )
        self.assertEqual(cached_module.study_version.status, "draft")
        self.approve()
        with self.assertRaises(ValidationError):
            validate_study(
                m.Module, cached_module, {"name": "Late edit"}, self.institution
            )
        self.assertEqual(
            self.client.delete(f"/api/people/{self.teacher.id}/").status_code, 400
        )
        self.assertEqual(
            self.client.patch(
                f"/api/people/{self.teacher.id}/", {"kind": "learner"}, format="json"
            ).status_code,
            400,
        )
        for resource, instance in [
            ("studyversions", self.version),
            ("modules", self.first),
            ("teachingunits", self.units[0]),
        ]:
            self.assertEqual(
                self.client.patch(
                    f"/api/{resource}/{instance.id}/",
                    {"name": "Changed"},
                    format="json",
                ).status_code,
                400,
            )
            self.assertEqual(
                self.client.delete(f"/api/{resource}/{instance.id}/").status_code, 400
            )
        self.assertEqual(
            self.client.post(
                "/api/modules/",
                {"name": "Extra", "code": "EXTRA", "study_version": self.version.id},
                format="json",
            ).status_code,
            400,
        )

    def test_cloning_preserves_hierarchy_and_old_cohort_binding(self):
        self.approve()
        cohort = m.Cohort.objects.create(
            institution=self.institution,
            program=self.program,
            study_version=self.version,
            code="TEST-JG",
            name="2027",
        )
        response = self.client.post(
            f"/api/studyversions/{self.version.id}/clone/",
            {"code": "NEW-LP", "name": "2028", "version": "2028"},
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        new = m.StudyVersion.objects.get(id=response.data["id"])
        self.assertEqual(new.status, "draft")
        copied = new.modules.get(name="Datenbanken")
        self.assertEqual(copied.parent.study_version_id, new.id)
        self.assertEqual(copied.prerequisites.get().study_version_id, new.id)
        self.assertEqual(structure_report(new)["errors"], [])
        self.assertEqual(
            self.client.post(
                f"/api/studyversions/{new.id}/approve/", {}, format="json"
            ).status_code,
            200,
        )
        self.assertEqual(
            self.client.patch(
                f"/api/cohorts/{cohort.id}/", {"study_version": new.id}, format="json"
            ).status_code,
            400,
        )
        cohort.refresh_from_db()
        self.assertEqual(cohort.study_version_id, self.version.id)

    def test_semester_preparation_is_idempotent_and_solver_respects_windows(self):
        self.approve()
        cohort = m.Cohort.objects.create(
            institution=self.institution,
            program=self.program,
            study_version=self.version,
            code="TEST-JG",
            name="2027",
        )
        group = m.Group.objects.create(
            institution=self.institution,
            cohort=cohort,
            code="TEST-A1",
            name="A1",
            size=20,
        )
        period = m.Period.objects.create(
            institution=self.institution,
            code="TEST-ZEIT",
            name="Semester",
            start="2026-11-02",
            end="2026-11-06",
        )
        plan = m.Plan.objects.create(
            institution=self.institution,
            cohort=cohort,
            semester=1,
            period=period,
            area=m.Area.objects.first(),
            code="TEST-PLAN",
            name="Semester 1",
        )
        plan.refresh_from_db()
        url = f"/api/plans/{plan.id}/prepare/"
        first = self.client.post(url, {}, format="json")
        self.assertEqual(first.status_code, 200, first.data)
        self.assertEqual(first.data["created"], 1)
        course = m.Course.objects.get(plan=plan)
        self.assertEqual(course.teaching_unit_id, self.units[0].id)
        self.assertEqual(list(course.groups.all()), [group])
        self.assertEqual(course.target_units, 2)  # Never infer hours from 5 credits.
        course.name = "Angepasst"
        course.save()
        again = self.client.post(url, {}, format="json")
        self.assertEqual(again.data["created"], 0)
        self.assertEqual(again.data["existing"], 1)
        course.refresh_from_db()
        self.assertEqual(course.name, "Angepasst")
        state, message, rows = solve(plan, "teaching", lambda: False, seconds=5)
        self.assertEqual(state, "ready", message)
        self.assertEqual(validate_rows(plan, rows, coverage=True), [])
        self.assertEqual(len(rows), 1)
        start = datetime.fromisoformat(rows[0]["start"])
        self.assertEqual(start.weekday(), 0)
        self.assertGreaterEqual(start.hour, 14)
        self.assertEqual(
            self.client.patch(
                f"/api/plans/{plan.id}/", {"semester": 2}, format="json"
            ).status_code,
            400,
        )

    def test_invalid_hierarchy_prerequisites_and_credits_block_approval(self):
        self.assertEqual(
            self.client.patch(
                f"/api/modules/{self.root.id}/",
                {"parent": self.first.id},
                format="json",
            ).status_code,
            400,
        )

        self.units[1].semester = 1
        self.units[1].save()
        self.second.credits = 6
        self.second.save()
        report = structure_report(self.version)
        self.assertTrue(any("Voraussetzung" in error for error in report["errors"]))
        self.assertTrue(any("Teilmodule" in error for error in report["errors"]))
        self.assertEqual(
            self.client.post(
                f"/api/studyversions/{self.version.id}/approve/", {}, format="json"
            ).status_code,
            400,
        )
        self.assertEqual(
            self.client.post(
                "/api/cohorts/",
                {
                    "name": "JG",
                    "code": "UNAPPROVED",
                    "program": self.program.id,
                    "study_version": self.version.id,
                },
                format="json",
            ).status_code,
            400,
        )

    def test_separate_delivery_creates_one_course_per_group(self):
        self.units[0].group_mode = "per_group"
        self.units[0].save()
        self.approve()
        cohort = m.Cohort.objects.create(
            institution=self.institution,
            program=self.program,
            study_version=self.version,
            code="TEST-JG",
            name="2027",
        )
        groups = [
            m.Group.objects.create(
                institution=self.institution,
                cohort=cohort,
                code=f"TEST-G{i}",
                name=f"A{i}",
                size=20,
            )
            for i in [1, 2]
        ]
        period = m.Period.objects.create(
            institution=self.institution,
            code="TEST-PERIOD",
            name="Semester",
            start="2026-11-02",
            end="2026-11-06",
        )
        plan = m.Plan.objects.create(
            institution=self.institution,
            cohort=cohort,
            semester=1,
            period=period,
            area=m.Area.objects.first(),
            code="TEST-PLAN",
            name="Semester 1",
        )
        response = self.client.post(f"/api/plans/{plan.id}/prepare/", {}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["created"], 2)
        for group in groups:
            course = m.Course.objects.get(plan=plan, study_group=group)
            self.assertEqual(list(course.groups.all()), [group])
            self.assertEqual(course.teaching_unit_id, self.units[0].id)
        repeat = self.client.post(f"/api/plans/{plan.id}/prepare/", {}, format="json")
        self.assertEqual(repeat.data["created"], 0)
        self.assertEqual(repeat.data["existing"], 2)

    def test_tenant_relations_and_foreign_structure_are_rejected(self):
        other = m.Institution.objects.create(name="Other", slug="study-other")
        program = m.Program.objects.create(institution=other, name="Other", code="SG")
        version = m.StudyVersion.objects.create(
            institution=other, program=program, name="Other", code="LP", version="2027"
        )
        self.assertEqual(
            self.client.get(f"/api/studyversions/{version.id}/check/").status_code, 404
        )
        self.assertEqual(
            self.client.patch(
                f"/api/modules/{self.first.id}/",
                {"study_version": version.id},
                format="json",
            ).status_code,
            400,
        )

    def test_administration_edits_multiple_windows_and_exclusions(self):
        url = f"/api/people/{self.teacher.id}/"
        windows = [
            {"weekday": 0, "from": "09:00", "to": "11:00"},
            {"weekday": 0, "from": "14:00", "to": "16:00"},
        ]
        response = self.client.patch(
            url,
            {
                "availability": {
                    "windows": windows,
                    "exclusions": [
                        {
                            "start": "2026-11-02T14:00:00+01:00",
                            "end": "2026-11-02T15:00:00+01:00",
                        }
                    ],
                }
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.teacher.refresh_from_db()

        def permitted(start, end):
            return available(
                self.teacher,
                datetime.fromisoformat(start),
                datetime.fromisoformat(end),
                self.institution,
            )

        self.assertTrue(
            permitted("2026-11-02T09:00:00+01:00", "2026-11-02T10:30:00+01:00")
        )
        self.assertFalse(
            permitted("2026-11-02T10:30:00+01:00", "2026-11-02T14:30:00+01:00")
        )
        self.assertFalse(
            permitted("2026-11-02T14:00:00+01:00", "2026-11-02T15:30:00+01:00")
        )
        self.assertEqual(
            self.client.patch(
                url,
                {
                    "availability": {
                        "windows": [{"weekday": 0, "from": "16:00", "to": "14:00"}]
                    }
                },
                format="json",
            ).status_code,
            400,
        )
        self.assertEqual(
            self.client.patch(
                url, {"availability": {"windows": []}}, format="json"
            ).status_code,
            200,
        )
        self.teacher.refresh_from_db()
        self.assertFalse(
            permitted("2026-11-02T09:00:00+01:00", "2026-11-02T10:00:00+01:00")
        )
