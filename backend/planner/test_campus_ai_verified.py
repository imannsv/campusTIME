"""Integration checks for Freddy's factual, tenant-scoped planning answers."""

import json
from datetime import datetime
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from . import campus_ai
from . import models as m


@override_settings(CAMPUS_AI_ENABLED=True, CAMPUS_AI_MODEL="qwen3.5:2b")
class VerifiedCampusAITests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.institution = m.Institution.objects.create(slug="verified", name="Test Uni")
        cls.user = get_user_model().objects.create_user(username="verified")
        m.Membership.objects.create(institution=cls.institution, user=cls.user)
        cls.area = m.Area.objects.create(
            institution=cls.institution, code="A", name="Bereich"
        )
        program = m.Program.objects.create(
            institution=cls.institution, code="P", name="Studium"
        )
        cohort = m.Cohort.objects.create(
            institution=cls.institution, program=program, code="C", name="Jahrgang"
        )
        cls.building = m.Building.objects.create(
            institution=cls.institution, code="B", name="Campus"
        )
        cls.floor = m.Floor.objects.create(
            institution=cls.institution, building=cls.building, code="F", name="EG"
        )
        cls.period = m.Period.objects.create(
            institution=cls.institution,
            code="P",
            name="Semester",
            start="2026-10-01",
            end="2027-03-31",
        )
        cls.period.refresh_from_db()
        cls.plan = m.Plan.objects.create(
            institution=cls.institution,
            code="P",
            name="Entwurf",
            period=cls.period,
            area=cls.area,
        )
        cls.course = m.Course.objects.create(
            institution=cls.institution,
            plan=cls.plan,
            code="C",
            name="Statistik",
            equipment=["Beamer"],
        )
        cls.group = m.Group.objects.create(
            institution=cls.institution,
            code="G",
            name="Gruppe A",
            size=25,
            cohort=cohort,
        )
        cls.course.groups.add(cls.group)
        cls.rooms = [
            m.Room.objects.create(
                institution=cls.institution,
                floor=cls.floor,
                code=f"R{i}",
                name=f"Raum {i}",
                capacity=40,
                equipment=["Beamer"],
            )
            for i in range(35)
        ]
        cls.session = m.Session.objects.create(
            institution=cls.institution,
            plan=cls.plan,
            course=cls.course,
            start="2026-10-08T08:00:00Z",
            end="2026-10-08T09:30:00Z",
        )
        cls.session.rooms.add(cls.rooms[0])

    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def ask(self, question, **values):
        cache.clear()
        return self.client.post(
            "/api/campusai/chat/",
            {
                "question": question,
                "plan": self.plan.id,
                **values,
            },
            format="json",
        )

    def test_calendar_context_contains_selected_session_and_specific_issues(self):
        result = self.client.get(
            "/api/campusai/context/",
            {
                "plan": self.plan.id,
                "week": "2026-10-05",
                "session_id": self.session.id,
                "group_filter": "Gruppe A",
                "room_filter": "Raum 0",
            },
        )
        self.assertEqual(result.status_code, 200)
        calendar = result.data["calendar"]
        self.assertEqual(calendar["week"], "2026-10-05")
        self.assertEqual(calendar["group_filter"], "Gruppe A")
        self.assertEqual(calendar["selected_session"]["id"], self.session.id)
        self.assertEqual(calendar["selected_session"]["participants"], 25)
        self.assertEqual(calendar["selected_session"]["equipment"], ["Beamer"])
        self.assertIn(
            "Lehrende/Aufsichten fehlen", str(calendar["selected_session"]["issues"])
        )
        self.assertNotIn("Soll ", str(calendar["selected_session"]["issues"]))

    def test_calendar_display_filters_accept_full_valid_names_and_reject_overlong(self):
        for size in (121, 200):
            value = "x" * size
            result = self.client.get(
                "/api/campusai/context/",
                {"plan": self.plan.id, "room_filter": value, "group_filter": value},
            )
            self.assertEqual(result.status_code, 200)
            self.assertEqual(result.data["calendar"]["room_filter"], value)
            self.assertEqual(result.data["calendar"]["group_filter"], value)
        for field in ("room_filter", "group_filter"):
            result = self.client.get(
                "/api/campusai/context/", {"plan": self.plan.id, field: "x" * 201}
            )
            self.assertEqual(result.status_code, 400)

    def test_selected_session_requires_tenant_and_selected_plan_even_in_greeting(self):
        other = m.Institution.objects.create(slug="other-verified", name="Geheim")
        foreign = m.Session.objects.create(
            institution=other,
            plan=self.plan,
            course=self.course,
            start="2026-10-08T08:00:00Z",
            end="2026-10-08T09:30:00Z",
        )
        for question in ("Hi", "Warum ist dieser Termin problematisch?"):
            with self.subTest(question=question):
                self.assertEqual(
                    self.ask(question, session_id=foreign.id).status_code, 404
                )
                self.assertEqual(
                    self.ask(
                        question, plan=None, session_id=self.session.id
                    ).status_code,
                    400,
                )
        second = m.Plan.objects.create(
            institution=self.institution,
            code="P2",
            name="Anderer",
            period=self.period,
            area=self.area,
        )
        self.assertEqual(
            self.ask("Hi", plan=second.id, session_id=self.session.id).status_code, 400
        )

    def test_verified_availability_checks_all_rooms_and_ignores_selected_session(self):
        with patch(
            "planner.campus_ai.ollama_request",
            side_effect=AssertionError("Model contacted"),
        ):
            result = self.ask(
                "Welche Räume sind für diesen Termin frei?",
                session_id=self.session.id,
                use_model=True,
            )
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.data["mode"], "verified")
        self.assertIn("Raum 34", result.data["answer"])
        self.assertIn("Raum 0", result.data["answer"])
        self.assertEqual(len(result.data["checked"]["room_ids"]), 35)
        self.assertIsNone(result.data["auto_action"])
        self.assertFalse(result.data["changed"])

    def test_occupancy_uses_draft_other_published_plans_and_recurring_blocks(self):
        # The selected event is omitted, but a different draft event still occupies room 1.
        draft = m.Session.objects.create(
            institution=self.institution,
            plan=self.plan,
            course=self.course,
            start="2026-10-08T08:30:00Z",
            end="2026-10-08T10:00:00Z",
        )
        draft.rooms.add(self.rooms[1])
        other_plan = m.Plan.objects.create(
            institution=self.institution,
            code="P2",
            name="Veröffentlicht",
            period=self.period,
            area=self.area,
        )
        m.Publication.objects.create(
            institution=self.institution,
            plan=other_plan,
            number=1,
            snapshot=[
                {
                    "start": "2026-10-08T08:00:00Z",
                    "end": "2026-10-08T09:00:00Z",
                    "room_ids": [self.rooms[2].id],
                    "name": "Publizierter Termin",
                }
            ],
        )
        # A foreign tenant's snapshot must not occupy a local room even with malformed IDs.
        foreign = m.Institution.objects.create(slug="foreign-occupancy", name="Geheim")
        m.Publication.objects.create(
            institution=foreign,
            plan=other_plan,
            number=2,
            snapshot=[
                {
                    "start": "2026-10-08T08:00:00Z",
                    "end": "2026-10-08T09:00:00Z",
                    "room_ids": [self.rooms[3].id],
                    "name": "Geheim",
                }
            ],
        )
        block = m.RoomBlock.objects.create(
            institution=self.institution,
            code="BLOCK",
            name="Wöchentlich gesperrt",
            start="2026-10-01T08:00:00Z",
            end="2026-10-01T09:00:00Z",
            repeat_weekly=True,
            repeat_until="2026-10-15",
        )
        block.rooms.add(self.rooms[4])
        result = self.ask(
            "Welche Räume sind für diesen Termin frei?", session_id=self.session.id
        )
        self.assertEqual(result.data["mode"], "verified")
        self.assertEqual(
            set(result.data["checked"]["room_ids"]),
            {room.id for room in self.rooms} - {self.rooms[i].id for i in (1, 2, 4)},
        )
        self.assertNotIn("Geheim", result.data["answer"])

    def test_unknown_capacity_and_missing_equipment_are_not_certified(self):
        self.rooms[1].capacity = None
        self.rooms[1].save()
        self.rooms[2].equipment = []
        self.rooms[2].save()
        result = self.ask(
            "Welche Räume sind für diesen Termin frei?", session_id=self.session.id
        )
        ids = result.data["checked"]["room_ids"]
        self.assertNotIn(self.rooms[1].id, ids)
        self.assertNotIn(self.rooms[2].id, ids)

    def test_large_matching_room_set_bounds_answer_and_keeps_complete_checked_ids(self):
        added = m.Room.objects.bulk_create(
            [
                m.Room(
                    institution=self.institution,
                    floor=self.floor,
                    code=f"LONG-{index}",
                    name=f"Langraum {index}: " + "x" * 150,
                    capacity=40,
                    equipment=["Beamer"],
                )
                for index in range(80)
            ]
        )
        result = self.ask(
            "Welche Räume sind für diesen Termin frei?", session_id=self.session.id
        )
        self.assertLessEqual(len(result.data["answer"]), 6000)
        self.assertEqual(
            set(result.data["checked"]["room_ids"]),
            {room.id for room in self.rooms + added},
        )
        self.assertIn("115 freie passende Räume", result.data["answer"])
        coverage = result.data["checked"]["coverage"]
        self.assertEqual(coverage["matching_rooms"], 115)
        self.assertGreater(coverage["omitted_rooms"], 0)
        self.assertIn(
            str(coverage["omitted_rooms"]) + " weitere", result.data["answer"]
        )
        self.assertEqual(
            self.ask(
                "Hi", history=[{"role": "assistant", "content": result.data["answer"]}]
            ).status_code,
            200,
        )

    def test_large_selected_session_issue_reply_is_annotated_and_history_safe(self):
        clashes = m.Session.objects.bulk_create(
            [
                m.Session(
                    institution=self.institution,
                    plan=self.plan,
                    course=self.course,
                    name=f"Konflikt {index}: " + "x" * 180,
                    start="2026-10-08T08:00:00Z",
                    end="2026-10-08T09:30:00Z",
                )
                for index in range(45)
            ]
        )
        m.Session.rooms.through.objects.bulk_create(
            [
                m.Session.rooms.through(session_id=session.id, room_id=self.rooms[0].id)
                for session in clashes
            ]
        )
        result = self.ask(
            "Warum passt dieser Termin nicht?", session_id=self.session.id
        )
        self.assertLessEqual(len(result.data["answer"]), 6000)
        self.assertTrue(result.data["truncated"])
        self.assertIn("gekürzt", result.data["answer"])
        self.assertIn("gekürzt", result.data["service_note"])
        self.assertEqual(
            self.ask(
                "Hi", history=[{"role": "assistant", "content": result.data["answer"]}]
            ).status_code,
            200,
        )

    def test_independent_interval_keeps_selected_event_occupied(self):
        result = self.ask(
            "Welche Räume sind am 08.10.2026 von 10:00 bis 11:30 für 25 Personen frei?",
            session_id=self.session.id,
        )
        self.assertEqual(result.data["mode"], "verified")
        self.assertNotIn(self.rooms[0].id, result.data["checked"]["room_ids"])
        self.assertIsNone(
            result.data["checked"]["coverage"]["selected_session_excluded"]
        )
        self.assertEqual(result.data["checked"]["coverage"]["draft_sessions"], 1)
        self.assertNotIn(
            "Termin wurde bei der Belegung ausgenommen", result.data["answer"]
        )
        replacement = self.ask(
            "Welche Räume sind für diesen Termin frei?", session_id=self.session.id
        )
        self.assertIn(self.rooms[0].id, replacement.data["checked"]["room_ids"])
        self.assertEqual(
            replacement.data["checked"]["coverage"]["selected_session_excluded"],
            self.session.id,
        )

    def test_inflected_free_room_question_routes_to_checked_availability(self):
        result = self.ask(
            "Welche freien Räume gibt es am 08.10.2026 von 10 bis 11 Uhr für25 Personen?"
        )
        self.assertEqual(result.data["mode"], "verified")
        self.assertEqual(
            set(result.data["checked"]["room_ids"]),
            {room.id for room in self.rooms[1:]},
        )

    def test_common_resource_nouns_and_exact_known_names_route_to_checked_room(self):
        for room, name in [
            (self.rooms[1], "Hörsaal H.101"),
            (self.rooms[2], "Audimax"),
        ]:
            room.name = name
            room.save()
            with (
                self.subTest(name=name),
                patch(
                    "planner.campus_ai.ollama_request",
                    side_effect=AssertionError("Model contacted"),
                ),
            ):
                result = self.ask(
                    f"Ist {name} am 08.10.2026 von 10 bis 11 Uhr für 25 Personen frei?",
                    use_model=True,
                )
                self.assertEqual(result.data["mode"], "verified")
                self.assertEqual(result.data["checked"]["room_ids"], [room.id])

    def test_room_query_requires_date_duration_and_people_without_assumptions(self):
        for question, missing in [
            (
                "Welche Räume sind heute um 10 Uhr für 25 Personen frei?",
                "Endzeit oder Dauer",
            ),
            ("Welche Räume sind um 10-11 Uhr für 25 Personen frei?", "Datum"),
            ("Welche Räume sind am 08.10.2026 von 10:00 bis 11:00 frei?", "Personen"),
        ]:
            with (
                self.subTest(question=question),
                patch(
                    "planner.campus_ai.ollama_request",
                    side_effect=AssertionError("Model contacted"),
                ),
            ):
                result = self.ask(question, use_model=True, session_id=self.session.id)
                self.assertEqual(result.data["mode"], "verified")
                self.assertIn(missing, result.data["answer"])
                self.assertNotIn("checked", result.data)

    def test_explicit_dates_time_ranges_and_institution_today_are_checked(self):
        # Berlin already has October 9 while UTC is still October 8.
        with patch(
            "planner.campus_ai_verified.timezone.now",
            return_value=datetime.fromisoformat("2026-10-08T22:30:00+00:00"),
        ):
            for question, day, start, end in [
                (
                    "Welche Räume sind heute von 10:00 bis 11:30 für 25 Personen frei?",
                    "2026-10-09",
                    "10:00",
                    "11:30",
                ),
                (
                    "Welche Räume sind morgen um 10 Uhr für 90 Minuten für 25 Personen frei?",
                    "2026-10-10",
                    "10:00",
                    "11:30",
                ),
                (
                    "Welche Räume sind am 08.10.2026 von 10 bis 11 Uhr für 25 Personen frei?",
                    "2026-10-08",
                    "10:00",
                    "11:00",
                ),
                (
                    "Welche Räume sind am 2026-10-08 von 11:30–12:00 für 25 Personen frei?",
                    "2026-10-08",
                    "11:30",
                    "12:00",
                ),
            ]:
                with self.subTest(question=question):
                    result = self.ask(question)
                    self.assertEqual(result.data["mode"], "verified")
                    self.assertEqual(result.data["checked"]["date"], day)
                    self.assertIn(start, result.data["answer"])
                    self.assertIn(end, result.data["answer"])
                    if start == "11:30":
                        self.assertIn(
                            self.rooms[0].id, result.data["checked"]["room_ids"]
                        )

    def test_ambiguous_negated_compound_or_invalid_queries_never_certify_rooms(self):
        for question in [
            "Welche Räume sind heute und morgen von 10 bis 11 Uhr für 25 Personen frei?",
            "Welche Räume sind heute von 10 bis 11 Uhr für 25 Personen nicht frei?",
            "Welche Räume sind am 31.02.2026 von 10 bis 11 Uhr für 25 Personen frei?",
            "Welche Räume sind heute von 11 bis 10 Uhr für 25 Personen frei?",
            "Welche Räume sind heute um 25 Uhr für 90 Minuten für 25 Personen frei?",
            "Welche Räume sind heute von 10 bis 11 Uhr für 25 Personen frei und wer unterrichtet?",
        ]:
            with (
                self.subTest(question=question),
                patch(
                    "planner.campus_ai.ollama_request",
                    side_effect=AssertionError("Model contacted"),
                ),
            ):
                result = self.ask(question, use_model=True)
                self.assertEqual(result.data["mode"], "verified")
                self.assertNotIn("checked", result.data)

    def test_selected_session_explanation_is_verified_and_specific(self):
        with patch(
            "planner.campus_ai.ollama_request",
            side_effect=AssertionError("Model contacted"),
        ):
            result = self.ask(
                "Warum ist dieser Termin problematisch?",
                session_id=self.session.id,
                use_model=True,
            )
        self.assertEqual(result.data["mode"], "verified")
        self.assertIn("Statistik", result.data["answer"])
        self.assertIn("Lehrende/Aufsichten fehlen", result.data["answer"])
        self.assertNotIn("Soll ", result.data["answer"])
        self.assertIsNone(result.data["auto_action"])

    def test_negative_selected_term_why_question_explains_actual_issues(self):
        with patch(
            "planner.campus_ai.ollama_request",
            side_effect=AssertionError("Model contacted"),
        ):
            result = self.ask(
                "Warum passt dieser Termin nicht?",
                session_id=self.session.id,
                use_model=True,
            )
        self.assertEqual(result.data["mode"], "verified")
        self.assertIn("Lehrende/Aufsichten fehlen", result.data["answer"])
        self.assertIn("Statistik", result.data["answer"])
        for question in [
            "Warum passt dieser Termin nicht und welche Räume sind heute frei?",
            "Warum passt dieser Termin nicht? Wer unterrichtet morgen?",
        ]:
            result = self.ask(question, session_id=self.session.id)
            self.assertNotIn("Lehrende/Aufsichten fehlen", result.data["answer"])

    def test_history_accepts_twelve_messages_but_bounds_characters_and_roles(self):
        result = self.ask("Hi", history=[{"role": "user", "content": "x" * 1000}] * 12)
        self.assertEqual(result.status_code, 200)
        self.assertEqual(
            self.ask(
                "Hi", history=[{"role": "assistant", "content": "x" * 6000}] * 2
            ).status_code,
            200,
        )
        for history in [
            [{"role": "user", "content": "x" * 1001}] * 12,
            [{"role": "user", "content": "x"}] * 13,
            [{"role": "system", "content": "x"}],
        ]:
            self.assertEqual(self.ask("Hi", history=history).status_code, 400)

    def test_foreign_session_in_selected_plan_is_never_used_as_occupancy(self):
        foreign = m.Institution.objects.create(slug="foreign-row", name="Geheim")
        course = m.Course.objects.create(
            institution=foreign, plan=self.plan, code="SECRET", name="Geheimer Kurs"
        )
        session = m.Session.objects.create(
            institution=foreign,
            plan=self.plan,
            course=course,
            start="2026-10-08T08:00:00Z",
            end="2026-10-08T09:30:00Z",
        )
        session.rooms.add(self.rooms[34])
        result = self.ask(
            "Welche Räume sind für diesen Termin frei?", session_id=self.session.id
        )
        self.assertIn(self.rooms[34].id, result.data["checked"]["room_ids"])
        context = self.client.get("/api/campusai/context/", {"plan": self.plan.id})
        self.assertNotIn("Geheimer Kurs", str(context.data))

    def test_specific_unknown_room_and_unparsed_equipment_do_not_certify_other_rooms(
        self,
    ):
        for question in [
            "Ist Raum Unbekannt heute von 10 bis 11 Uhr für 25 Personen frei?",
            "Welche Räume sind heute von 10 bis 11 Uhr für 25 Personen mit Beamer sowie Laserlabor frei?",
            "Welche Räume sind für diesen Termin für 80 Personen frei?",
            "Welche Räume sind heute von 10 bis 11 Uhr für 25 Personen im Gebäude Süd frei?",
            "Welche Räume sind heute von 10 bis 11 Uhr für 25 Personen frei? Wer unterrichtet?",
        ]:
            with self.subTest(question=question):
                result = self.ask(question, session_id=self.session.id)
                self.assertNotIn("checked", result.data)

    def test_relevant_notices_beyond_initial_context_page_reach_model(self):
        for index in range(45):
            m.Course.objects.create(
                institution=self.institution,
                plan=self.plan,
                code=f"LATE-{index}",
                name=f"Nachzügler {index}",
            )
        context = campus_ai.context_for(self.institution, self.plan)
        with patch(
            "planner.campus_ai.ollama_request",
            side_effect=[
                {"models": [{"name": "qwen3.5:2b"}]},
                {"done": True, "message": {"content": "Ergänze Lehrende."}},
            ],
        ) as model:
            result = campus_ai.reply(
                "Erkläre Hinweise zu Nachzügler 44", context, use_model=True
            )
        self.assertEqual(result["mode"], "local")
        facts = json.loads(
            model.call_args.args[1]["messages"][0]["content"]
            .split("GEPRÜFTE FAKTEN:\n", 1)[1]
            .split("\nANGEBOTENE AKTIONEN:", 1)[0]
        )
        self.assertIn("Nachzügler 44", str(facts["notices"]))

    def test_model_receives_all_twelve_full_messages_within_total_limit(self):
        history = [{"role": "assistant", "content": "x" * 3000}] + [
            {"role": "user", "content": f"Verlauf {index}"} for index in range(11)
        ]
        with patch(
            "planner.campus_ai.ollama_request",
            side_effect=[
                {"models": [{"name": "qwen3.5:2b"}]},
                {"done": True, "message": {"content": "Prüfe die Stammdaten."}},
            ],
        ) as model:
            result = self.ask("Was sollte ich prüfen?", history=history, use_model=True)
        self.assertEqual(result.data["mode"], "local")
        self.assertEqual(model.call_args.args[1]["messages"][-13:-1], history)

    def test_status_reports_busy_and_read_only_verified_capabilities(self):
        campus_ai.MODEL_LOCK.acquire()
        try:
            with patch(
                "planner.campus_ai.ollama_request",
                return_value={"models": [{"name": "qwen3.5:2b"}]},
            ):
                result = self.client.get("/api/campusai/status/")
            self.assertTrue(result.data["busy"])
            self.assertTrue(result.data["capabilities"]["room_availability"])
            self.assertFalse(result.data["capabilities"]["writes"])
        finally:
            campus_ai.MODEL_LOCK.release()

    def test_availability_without_plan_reports_published_scope_without_draft(self):
        result = self.ask(
            "Welche Räume sind am 08.10.2026 von 10 bis 11 Uhr für 25 Personen frei?",
            plan=None,
        )
        self.assertEqual(result.data["mode"], "verified")
        self.assertEqual(result.data["checked"]["coverage"]["draft_sessions"], 0)
        self.assertIn("kein Entwurf", result.data["answer"])
        self.assertNotIn("der ausgewählte Entwurf", result.data["answer"])

    def test_model_context_selects_relevant_records_and_declares_coverage(self):
        context = campus_ai.context_for(self.institution, self.plan)
        context["courses"] = [{"name": f"Kurs {i}"} for i in range(21)]
        context["rooms"] = [{"name": f"Raum {i}"} for i in range(35)]
        with patch(
            "planner.campus_ai.ollama_request",
            side_effect=[
                {"models": [{"name": "qwen3.5:2b"}]},
                {"done": True, "message": {"content": "Ergänze die Stammdaten."}},
            ],
        ) as model:
            result = campus_ai.reply(
                "Erkläre die Stammdaten für Kurs 20 und Raum 34",
                context,
                use_model=True,
            )
        self.assertEqual(result["mode"], "local")
        facts = json.loads(
            model.call_args.args[1]["messages"][0]["content"]
            .split("GEPRÜFTE FAKTEN:\n", 1)[1]
            .split("\nANGEBOTENE AKTIONEN:", 1)[0]
        )
        self.assertIn({"name": "Kurs 20"}, facts["courses"])
        self.assertIn({"name": "Raum 34"}, facts["rooms"])
        self.assertEqual(facts["coverage"]["rooms"]["total"], 35)
        self.assertTrue(facts["coverage"]["rooms"]["subset"])
        self.assertFalse(facts["coverage"]["availability_checked"])

    def test_model_context_prioritizes_requested_semester_beyond_initial_eight(self):
        context = campus_ai.context_for(self.institution, self.plan)
        context["semesters"] = [
            {"semester": index, "credits": 30} for index in range(1, 13)
        ]
        with patch(
            "planner.campus_ai.ollama_request",
            side_effect=[
                {"models": [{"name": "qwen3.5:2b"}]},
                {"done": True, "message": {"content": "Prüfe die Semesterstruktur."}},
            ],
        ) as model:
            result = campus_ai.reply("Erkläre Semester 9", context, use_model=True)
        self.assertEqual(result["mode"], "local")
        facts = json.loads(
            model.call_args.args[1]["messages"][0]["content"]
            .split("GEPRÜFTE FAKTEN:\n", 1)[1]
            .split("\nANGEBOTENE AKTIONEN:", 1)[0]
        )
        self.assertIn({"semester": 9, "credits": 30}, facts["semesters"])
        self.assertEqual(facts["coverage"]["semesters"]["total"], 12)
        self.assertTrue(facts["coverage"]["semesters"]["subset"])

    def test_general_model_cannot_certify_resource_availability(self):
        context = campus_ai.context_for(self.institution, self.plan)
        with patch(
            "planner.campus_ai.ollama_request",
            side_effect=[
                {"models": [{"name": "qwen3.5:2b"}]},
                {
                    "done": True,
                    "message": {"content": "Raum 34 ist frei und verfügbar."},
                },
            ],
        ):
            result = campus_ai.reply(
                "Was empfiehlst du für meine Planung?", context, use_model=True
            )
        self.assertEqual(result["mode"], "help")
        self.assertIn("Verfügbarkeit", result["service_note"])

    def test_generic_model_rejects_availability_claims_for_known_room_names(self):
        context = campus_ai.context_for(self.institution, self.plan)
        context["rooms"] = [{"name": "Audimax"}, {"name": "Hörsaal H.101"}]
        for answer in [
            "Hörsaal H.101 ist heute frei.",
            "Audimax ist heute frei.",
            "Das Labor ist verfügbar.",
            "Der Seminarraum ist frei.",
        ]:
            with (
                self.subTest(answer=answer),
                patch(
                    "planner.campus_ai.ollama_request",
                    side_effect=[
                        {"models": [{"name": "qwen3.5:2b"}]},
                        {"done": True, "message": {"content": answer}},
                    ],
                ),
            ):
                result = campus_ai.reply(
                    "Was empfiehlst du für meine Planung?", context, use_model=True
                )
            self.assertEqual(result["mode"], "help")
            self.assertIn("Verfügbarkeit", result["service_note"])
