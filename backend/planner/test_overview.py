import io
import json
from datetime import date

from django.core.management import call_command
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from . import models as m
from .overview import enrich_snapshot


@override_settings(DEBUG=True)
class StudentOverviewTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_demo", password="TestCampuszeit2026!", stdout=io.StringIO())
        cls.display = m.Display.objects.first()
        cls.plan = m.Plan.objects.first()
        cls.institution = cls.plan.institution
        cls.group = m.Group.objects.get(code="A1")
        cls.other_group = m.Group.objects.get(code="A2")
        cls.course = m.Course.objects.get(code="MAT")

    def setUp(self):
        self.client = APIClient()
        self.url = f"/api/public/{self.display.token}/overview/"

    def test_anonymous_filters_keep_common_and_elective_courses(self):
        all_data = self.client.get(self.url).data
        self.assertEqual(all_data["view_mode"], "week")
        response = self.client.get(self.url, {"group": self.group.id})
        self.assertEqual(response.status_code, 200)
        rows = response.data["rows"]
        names = {row["name"] for row in rows}
        self.assertIn("Mathematik I", names)
        self.assertIn("Wahlpflicht: UX & Design", names)
        self.assertIn("Programmierung · A1", names)
        self.assertNotIn("Programmierung · A2", names)
        common = next(row for row in rows if row["name"] == "Mathematik I")
        self.assertEqual(
            set(common["group_names"]), {self.group.name, self.other_group.name}
        )
        cohort = self.client.get(self.url, {"cohort": self.group.cohort_id}).data
        self.assertEqual(len(cohort["rows"]), len(all_data["rows"]))
        filtered = self.client.get(
            self.url,
            {
                "cohort": self.group.cohort_id,
                "group": self.group.id,
                "course": f"course:{self.course.id}",
            },
        ).data
        self.assertTrue(filtered["rows"])
        self.assertTrue(all(row["name"] == "Mathematik I" for row in filtered["rows"]))

    def test_payload_has_no_private_rosters_or_participant_names(self):
        payload = json.dumps(self.client.get(self.url).data, default=str)
        for key in [
            "learner_ids",
            "teacher_ids",
            "room_allocations",
            "overview_scope",
            "count",
            "availability",
        ]:
            self.assertNotIn(f'"{key}"', payload)
        for name in m.Person.objects.filter(kind="learner").values_list(
            "name", flat=True
        ):
            self.assertNotIn(name, payload)
        self.display.show_teachers = False
        self.display.save()
        for row in self.client.get(self.url).data["rows"]:
            self.assertNotIn("teacher_names", row)

    def test_filter_metadata_and_rows_stay_on_published_version(self):
        before = self.client.get(self.url).data
        self.course.name = "Unveröffentlichter Kursname"
        self.course.save()
        self.course.groups.set([self.other_group])
        self.group.name = "Unveröffentlichte Gruppenbezeichnung"
        self.group.save()
        after = self.client.get(self.url).data
        self.assertEqual(after["catalog"], before["catalog"])
        self.assertEqual(after["rows"], before["rows"])
        self.client.force_authenticate(
            m.Membership.objects.get(institution=self.institution).user
        )
        response = self.client.post(
            f"/api/plans/{self.plan.id}/publish/", {}, format="json"
        )
        self.assertEqual(response.status_code, 200, response.data)
        published = self.client.get(
            self.url, {"course": f"course:{self.course.id}"}
        ).data
        self.assertTrue(published["rows"])
        self.assertTrue(
            all(row["name"] == self.course.name for row in published["rows"])
        )
        self.assertTrue(
            all(
                row["group_names"] == [self.other_group.name]
                for row in published["rows"]
            )
        )

    def test_only_selected_published_plans_are_exposed(self):
        other_institution = m.Institution.objects.create(
            name="Andere Uni", slug="other-overview"
        )
        foreign_cohort = m.Cohort.objects.create(
            institution=other_institution,
            code="OTHER",
            name="Geheimer Jahrgang",
            program=m.Program.objects.create(
                institution=other_institution, code="P", name="Geheimer Studiengang"
            ),
        )
        m.Course.objects.create(
            institution=self.institution,
            plan=self.plan,
            code="DRAFT",
            name="Unveröffentlichte Veranstaltung",
        )
        payload = self.client.get(self.url).data
        self.assertNotIn("Geheimer Jahrgang", str(payload))
        self.assertNotIn("Unveröffentlichte Veranstaltung", str(payload))
        self.assertEqual(
            self.client.get(self.url, {"cohort": foreign_cohort.id}).status_code, 400
        )
        self.display.plans.clear()
        payload = self.client.get(self.url).data
        self.assertEqual(payload["rows"], [])
        self.assertEqual(
            payload["catalog"], {"cohorts": [], "groups": [], "courses": []}
        )

    def test_overview_is_weekly_even_for_fixed_daily_display(self):
        self.display.view_mode = "tomorrow"
        self.display.save()
        query = {
            "since": "2026-10-05T00:00:00+02:00",
            "until": "2026-10-12T00:00:00+02:00",
            "view": "today",
        }
        overview = self.client.get(self.url, query).data
        self.assertEqual(overview["view_mode"], "week")
        self.assertTrue(overview["rows"])
        display = self.client.get(f"/api/public/{self.display.token}/", query).data
        self.assertEqual(display["view_mode"], "tomorrow")
        self.display.active = False
        self.display.save()
        self.assertEqual(self.client.get(self.url).status_code, 404)

    def test_empty_weeks_keep_filter_options_and_invalid_filters_fail(self):
        before = self.client.get(self.url).data
        empty = self.client.get(
            self.url, {"since": "2030-01-01T00:00:00Z", "until": "2030-01-08T00:00:00Z"}
        ).data
        self.assertEqual(empty["rows"], [])
        self.assertEqual(empty["catalog"], before["catalog"])
        for query in [
            {"group": "invalid"},
            {"course": "course:999999"},
            {"since": "bad"},
            {"since": "2026-10-05T00:00:00"},
            {"since": "2026-10-12T00:00:00Z", "until": "2026-10-05T00:00:00Z"},
        ]:
            with self.subTest(query=query):
                self.assertEqual(self.client.get(self.url, query).status_code, 400)

    def test_course_filter_includes_linked_resit_for_actual_groups(self):
        exam = m.Exam.objects.create(
            institution=self.institution,
            plan=self.plan,
            course=self.course,
            code="RESIT",
            name="Mathematik Nachschreiben",
            resit=True,
            window_start=date(2026, 10, 5),
            window_end=date(2026, 10, 12),
        )
        learner = self.group.people.filter(kind="learner").first()
        exam.learners.add(learner)
        row = {
            "exam": exam.id,
            "course": None,
            "name": exam.name,
            "learner_ids": [learner.id],
            "group_names": ["Nachschreibeklausur"],
            "start": "2026-10-10T08:00:00+02:00",
            "end": "2026-10-10T10:00:00+02:00",
            "room_ids": [],
            "room_names": [],
            "color": "rose",
        }
        publication = m.Publication.objects.first()
        publication.snapshot += enrich_snapshot([row], self.institution.id)
        publication.save()
        query = {"course": f"course:{self.course.id}", "group": self.group.id}
        rows = self.client.get(self.url, query).data["rows"]
        found = next(item for item in rows if item["name"] == exam.name)
        self.assertTrue(found["resit"])
        self.assertEqual(found["kind"], "exam")
        query["group"] = self.other_group.id
        self.assertNotIn(exam.name, str(self.client.get(self.url, query).data["rows"]))

    def test_room_blocks_remain_visible_in_filtered_overview(self):
        publication = m.Publication.objects.first()
        row = next(
            item
            for item in publication.snapshot
            if item.get("course") == self.course.id
        )
        block = m.RoomBlock.objects.create(
            institution=self.institution,
            code="OVERVIEW-BLOCK",
            name="Bauarbeiten",
            start=row["start"],
            end=row["end"],
        )
        block.rooms.set(row["room_ids"])
        rows = self.client.get(self.url, {"course": f"course:{self.course.id}"}).data[
            "rows"
        ]
        self.assertTrue(any(item["blocked"] for item in rows))
