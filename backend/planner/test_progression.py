import io

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from . import models as m
from .progression import progression


@override_settings(DEBUG=True)
class CohortProgressionTests(TestCase):
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
            code="BAL-SG",
            name="Studiengang",
            duration_semesters=6,
            total_credits=36,
        )
        self.version = m.StudyVersion.objects.create(
            institution=self.institution,
            program=self.program,
            code="BAL-V",
            name="Lehrplan",
            version="2027",
            duration_semesters=6,
            total_credits=36,
            status="approved",
        )
        self.units, self.modules = [], []
        for semester in range(1, 7):
            module = m.Module.objects.create(
                institution=self.institution,
                study_version=self.version,
                code=f"BAL-M{semester}",
                name=f"Modul {semester}",
                credits=6,
            )
            unit = m.TeachingUnit.objects.create(
                institution=self.institution,
                module=module,
                code=f"BAL-L{semester}",
                name=module.name,
                semester=semester,
                target_units=2,
            )
            self.modules.append(module)
            self.units.append(unit)
        self.modules[1].prerequisites.set([self.modules[0]])
        self.cohort = m.Cohort.objects.create(
            institution=self.institution,
            program=self.program,
            study_version=self.version,
            code="BAL-JG",
            name="2027",
        )
        self.url = f"/api/cohorts/{self.cohort.id}/progression/"

    def post(self, schedule, operation="preview", **values):
        revision = self.client.get(self.url).data["revision"]
        return self.client.post(
            self.url,
            {
                "operation": operation,
                "schedule": schedule,
                "revision": revision,
                **values,
            },
            format="json",
        )

    def test_standard_manual_override_balance_and_cohort_isolation(self):
        report = self.client.get(self.url).data
        self.assertEqual([row["credits"] for row in report["semesters"]], [6] * 6)
        self.assertEqual(report["warnings"], [])
        schedule = {str(self.units[2].id): {"semester": 1, "pinned": True}}
        preview = self.post(schedule)
        self.assertEqual(preview.status_code, 200, preview.data)
        self.assertEqual(preview.data["semesters"][0]["credits"], 12)
        self.assertTrue(preview.data["warnings"])
        suggestion = self.post(schedule, "propose")
        self.assertEqual(suggestion.status_code, 200, suggestion.data)
        self.assertTrue(suggestion.data["moves"])
        self.assertEqual(
            suggestion.data["schedule"][str(self.units[2].id)]["semester"], 1
        )
        self.assertEqual(suggestion.data["warnings"], [])
        self.cohort.refresh_from_db()
        self.assertEqual(self.cohort.study_schedule, {})  # Proposal is read-only.
        saved = self.post(suggestion.data["schedule"], "save")
        self.assertEqual(saved.status_code, 200, saved.data)
        self.cohort.refresh_from_db()
        self.assertEqual(self.cohort.study_schedule, suggestion.data["schedule"])
        other = m.Cohort.objects.create(
            institution=self.institution,
            program=self.program,
            study_version=self.version,
            code="BAL-OTHER",
            name="2028",
        )
        self.assertEqual(progression(other)["schedule"], {})
        self.units[2].refresh_from_db()
        self.assertEqual(self.units[2].semester, 3)

    def test_prerequisite_repair_and_impossible_pins(self):
        schedule = {str(self.units[0].id): {"semester": 4, "pinned": True}}
        invalid = self.post(schedule, "save")
        self.assertEqual(invalid.status_code, 400)
        proposal = self.post(schedule, "propose")
        self.assertEqual(proposal.data["errors"], [])
        entries = {row["id"]: row for row in proposal.data["entries"]}
        self.assertEqual(entries[self.units[0].id]["semester"], 4)
        self.assertGreater(entries[self.units[1].id]["semester"], 4)
        self.assertEqual(proposal.data["warnings"], [])
        blocked = self.post(
            {str(self.units[0].id): {"semester": 6, "pinned": True}}, "propose"
        )
        self.assertTrue(blocked.data["errors"])
        self.assertEqual(blocked.data["moves"], [])

    def test_overrides_drive_preparation_and_prepared_units_are_protected(self):
        schedule = {str(self.units[2].id): {"semester": 4, "pinned": True}}
        self.assertEqual(self.post(schedule, "save").status_code, 200)
        m.Group.objects.create(
            institution=self.institution,
            cohort=self.cohort,
            code="BAL-G",
            name="A1",
            size=20,
        )
        period = m.Period.objects.first()
        plan = m.Plan.objects.create(
            institution=self.institution,
            period=period,
            area=m.Area.objects.first(),
            cohort=self.cohort,
            semester=4,
            code="BAL-PLAN",
            name="Semester 4",
        )
        prepared = self.client.post(f"/api/plans/{plan.id}/prepare/", {}, format="json")
        self.assertEqual(prepared.status_code, 200, prepared.data)
        self.assertEqual(prepared.data["created"], 2)
        courses = m.Course.objects.filter(plan=plan)
        self.assertEqual(
            set(courses.values_list("teaching_unit_id", flat=True)),
            {self.units[2].id, self.units[3].id},
        )
        course = courses.get(teaching_unit=self.units[2])
        self.assertEqual(
            self.client.patch(
                f"/api/courses/{course.id}/", {"name": "Angepasst"}, format="json"
            ).status_code,
            200,
        )
        self.assertEqual(self.post({}, "save").status_code, 400)
        self.assertEqual(
            self.post(
                {str(self.units[2].id): {"semester": 5, "pinned": True}}, "save"
            ).status_code,
            400,
        )
        suggested = self.post(schedule, "propose")
        entries = {row["id"]: row for row in suggested.data["entries"]}
        self.assertEqual(entries[self.units[2].id]["semester"], 4)
        self.assertTrue(entries[self.units[2].id]["locked"])

    def test_limits_difficulty_credit_shares_and_mixed_hours(self):
        parent = m.Module.objects.create(
            institution=self.institution,
            study_version=self.version,
            code="BAL-ROOT",
            name="Obermodul",
            credits=12,
        )
        for module in self.modules[:2]:
            module.parent = parent
            module.save()
        self.modules[0].difficulty = 3
        self.modules[0].save()
        self.units[1].week_pattern = "A"
        self.units[1].save()
        self.units[2].target_mode = "total"
        self.units[2].target_units = 10
        self.units[2].save()
        report = self.post(
            {},
            limits={
                "semester_credit_limit": 8,
                "semester_difficulty_limit": 15,
                "semester_weekly_limit": 1,
            },
        ).data
        self.assertEqual(
            sum(row["credits"] for row in report["semesters"]), 36
        )  # Parent does not double count.
        self.assertEqual(report["semesters"][0]["difficulty"], 18)
        self.assertEqual(report["semesters"][1]["weekly_units"], 1)
        self.assertEqual(report["semesters"][2]["weekly_units"], 0)
        self.assertEqual(report["semesters"][2]["total_units"], 10)
        self.assertTrue(
            any("Belastungspunkte" in warning for warning in report["warnings"])
        )

    def test_revision_tenant_and_payload_guards(self):
        revision = self.client.get(self.url).data["revision"]
        self.institution.refresh_from_db()
        self.institution.revision += 1
        self.institution.save()
        stale = self.client.post(
            self.url,
            {"operation": "save", "schedule": {}, "revision": revision},
            format="json",
        )
        self.assertEqual(stale.status_code, 400)
        for operation in ["preview", "propose"]:
            self.assertEqual(
                self.client.post(
                    self.url,
                    {"operation": operation, "schedule": {}, "revision": revision},
                    format="json",
                ).status_code,
                400,
            )
        for schedule in [
            {"999999": {"semester": 1}},
            {str(self.units[0].id): {"semester": 0}},
            {str(self.units[0].id): {"semester": True}},
            [],
        ]:
            self.assertEqual(self.post(schedule).status_code, 400)
        for limit in [-1, 10001, "bad", 1.234]:
            self.assertEqual(
                self.post({}, limits={"semester_credit_limit": limit}).status_code, 400
            )
        other_tenant = m.Institution.objects.create(name="Other", slug="balance-other")
        foreign = m.Cohort.objects.create(
            institution=other_tenant, program=self.program, code="FOREIGN", name="Other"
        )
        self.assertEqual(
            self.client.get(f"/api/cohorts/{foreign.id}/progression/").status_code, 404
        )
        # Generic CRUD cannot bypass validation of the protected schedule.
        self.assertEqual(
            self.client.patch(
                f"/api/cohorts/{self.cohort.id}/",
                {"study_schedule": {"999999": {"semester": 8}}},
                format="json",
            ).status_code,
            200,
        )
        self.cohort.refresh_from_db()
        self.assertEqual(self.cohort.study_schedule, {})
