import io

from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import check_password
from django.core import signing
from django.core.cache import cache
from django.core.management import call_command
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from . import models as m


@override_settings(DEBUG=True)
class PersonalAccessTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_demo", password="TestCampuszeit2026!", stdout=io.StringIO())
        cls.group = m.Group.objects.get(code="A1")
        cls.other_group = m.Group.objects.get(code="A2")
        cls.institution = cls.group.institution
        cls.admin = m.Membership.objects.get(institution=cls.institution).user

    def setUp(self):
        cache.clear()
        self.manager = APIClient()
        self.manager.force_authenticate(self.admin)
        self.client = APIClient()
        self.person = m.Person.objects.create(
            institution=self.institution,
            code="123456",
            name="Max Müller",
            kind="learner",
        )
        self.person.groups.add(self.group)
        self.url = f"/api/people/{self.person.pk}/access/"

    def create(self, **values):
        response = self.manager.post(
            self.url,
            {"action": "create", "server": "https://campus.example.org", **values},
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        return response.data

    def login(self, access):
        response = self.client.post(
            "/api/student-app/v1/login/",
            {"code": access["username"], "password": access["password"]},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.client.credentials(HTTP_AUTHORIZATION="Bearer " + response.data["token"])
        return response.data

    def change(self, password):
        response = self.client.post(
            "/api/student-app/v1/password/",
            {"current_password": password, "new_password": "Anders!Lernen2026"},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.client.credentials(HTTP_AUTHORIZATION="Bearer " + response.data["token"])
        return response.data

    def feed(self):
        return self.client.get(
            "/api/student-app/v1/feed/?start=2026-10-01&end=2026-11-01"
        )

    def test_get_existing_person_offers_access_without_creating_one(self):
        response = self.manager.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data["exists"])
        self.assertEqual(response.data["suggestions"]["identifier"], "123456")
        self.assertFalse(m.StudentAccess.objects.filter(person=self.person).exists())

    def test_structured_identity_for_both_kinds_preserves_legacy_names(self):
        for kind in ("learner", "teacher"):
            response = self.manager.post(
                "/api/people/",
                {
                    "code": f"IDENTITY-{kind}",
                    "kind": kind,
                    "first_name": "Mara",
                    "last_name": "Weiß",
                    "email": f"{kind}@example.org",
                },
                format="json",
            )
            self.assertEqual(response.status_code, 201, response.data)
            self.assertEqual(response.data["name"], "Mara Weiß")
            self.assertEqual(response.data["email"], f"{kind}@example.org")
            result = self.manager.get(f"/api/people/?search={kind}@example.org").data
            self.assertIn(response.data["id"], [row["id"] for row in result["results"]])
        self.assertEqual(
            self.manager.get(f"/api/people/{self.person.pk}/").data["name"],
            "Max Müller",
        )
        bad = self.manager.patch(
            f"/api/people/{self.person.pk}/", {"email": "keine-adresse"}, format="json"
        )
        self.assertEqual(bad.status_code, 400)

    def test_name_generation_collisions_and_identifier_are_stable_and_private(self):
        self.manager.patch(
            f"/api/people/{self.person.pk}/",
            {"first_name": "Max", "last_name": "Müller"},
            format="json",
        )
        first = self.create(source="name")
        self.assertEqual(first["username"], "max.mueller")
        stored = m.StudentAccess.objects.get(person=self.person)
        self.assertTrue(check_password(first["password"], stored.password_hash))
        self.assertNotEqual(first["password"], stored.password_hash)
        second_person = m.Person.objects.create(
            institution=self.institution,
            code="P2",
            name="Max Müller",
            first_name="Max",
            last_name="Müller",
        )
        second = self.manager.post(
            f"/api/people/{second_person.pk}/access/",
            {
                "action": "create",
                "source": "name",
                "server": "https://campus.example.org",
            },
            format="json",
        )
        self.assertEqual(second.status_code, 201, second.data)
        self.assertNotEqual(second.data["username"], first["username"])
        self.assertNotIn("password", self.manager.get(self.url).data)
        self.assertIn("no-store", self.manager.get(self.url)["Cache-Control"])
        self.assertEqual(self.manager.get("/api/student-app/accesses/").data, [])
        self.assertEqual(
            self.manager.get(
                f"/api/student-app/accesses/{stored.pk}/credentials/"
            ).status_code,
            404,
        )
        self.assertEqual(
            self.manager.post(
                self.url, {"action": "create"}, format="json"
            ).status_code,
            400,
        )
        self.manager.patch(
            f"/api/people/{self.person.pk}/", {"name": "Neuer Name"}, format="json"
        )
        self.assertEqual(self.manager.get(self.url).data["username"], first["username"])

    def test_initial_password_gates_data_and_push_and_change_rotates_sessions(self):
        access = self.create(source="identifier")
        login = self.login(access)
        self.assertTrue(login["password_change_required"])
        self.assertEqual(login["scope_kind"], "person")
        self.assertEqual(self.feed().status_code, 403)
        self.assertEqual(self.feed().data["code"], "password_change_required")
        self.assertEqual(
            self.client.post(
                "/api/student-app/v1/push/", {}, format="json"
            ).status_code,
            403,
        )
        for old, new in [
            ("wrong", "Anders!Lernen2026"),
            (access["password"], "1234567890"),
            (access["password"], access["password"]),
        ]:
            response = self.client.post(
                "/api/student-app/v1/password/",
                {"current_password": old, "new_password": new},
                format="json",
            )
            self.assertEqual(response.status_code, 400, response.data)
            self.assertIsInstance(response.data["detail"], str)
        changed = self.change(access["password"])
        self.assertFalse(changed["password_change_required"])
        self.assertNotEqual(changed["token"], login["token"])
        stale = APIClient()
        stale.credentials(HTTP_AUTHORIZATION="Bearer " + login["token"])
        self.assertEqual(
            stale.get(
                "/api/student-app/v1/feed/?start=2026-10-01&end=2026-11-01"
            ).status_code,
            401,
        )
        self.assertEqual(self.feed().status_code, 200)
        self.assertEqual(self.client.get("/api/bootstrap/").status_code, 403)
        self.assertNotIn("email", str(self.feed().data))

    def test_reset_disable_reactivation_and_qr_cannot_bypass_first_change(self):
        access = self.create(source="identifier")
        self.assertEqual(access["username"], "123456")
        self.login(access)
        self.change(access["password"])
        reset = self.manager.post(self.url, {"action": "reset"}, format="json")
        self.assertEqual(reset.status_code, 200, reset.data)
        self.assertEqual(reset.data["username"], access["username"])
        self.assertTrue(reset.data["password_change_required"])
        self.assertEqual(self.feed().status_code, 401)
        stored = m.StudentAccess.objects.get(person=self.person)
        key = signing.Signer(salt="planner.student-access.qr").sign(str(stored.pk))
        qr = APIClient().post(
            "/api/student-app/v1/login/",
            {"access": str(stored.pk), "key": key},
            format="json",
        )
        self.assertEqual(qr.status_code, 401)
        self.login(reset.data)
        self.assertEqual(
            self.client.post("/api/student-app/v1/logout/").status_code, 204
        )
        self.login(reset.data)
        self.assertEqual(
            self.manager.post(
                self.url, {"action": "disable"}, format="json"
            ).status_code,
            200,
        )
        self.assertEqual(self.feed().status_code, 401)
        active = self.manager.post(self.url, {"action": "reset"}, format="json")
        self.assertTrue(active.data["active"])
        self.assertTrue(active.data["password_change_required"])

    def test_tenant_and_role_boundaries(self):
        other = m.Institution.objects.create(name="Andere", slug="personal-other")
        foreign = m.Person.objects.create(
            institution=other, code="F", name="Fremde Person"
        )
        self.assertEqual(
            self.manager.get(f"/api/people/{foreign.pk}/access/").status_code, 404
        )
        planner = get_user_model().objects.create_user("planner-personal")
        m.Membership.objects.create(
            user=planner, institution=self.institution, role="planner"
        )
        self.manager.force_authenticate(planner)
        self.assertEqual(self.manager.get(self.url).status_code, 403)
        self.assertEqual(
            self.manager.post(
                self.url, {"action": "create"}, format="json"
            ).status_code,
            403,
        )
        self.assertEqual(APIClient().get(self.url).status_code, 403)

    def test_learner_and_teacher_only_see_their_published_scope(self):
        access = self.create(source="identifier")
        self.login(access)
        self.change(access["password"])
        response = self.feed()
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["rows"])
        self.assertNotIn(
            "Programmierung · A2", [r["name"] for r in response.data["rows"]]
        )
        self.person.groups.clear()
        self.assertEqual(self.feed().data["rows"], [])
        teacher = m.Person.objects.filter(
            institution=self.institution, kind="teacher"
        ).first()
        teacher_access = self.manager.post(
            f"/api/people/{teacher.pk}/access/",
            {
                "action": "create",
                "username": "dozent.test",
                "server": "https://campus.example.org",
            },
            format="json",
        )
        self.assertEqual(teacher_access.status_code, 201, teacher_access.data)
        self.login(teacher_access.data)
        self.change(teacher_access.data["password"])
        from .services import latest_publications

        expected = {
            f"{p.plan_id}:{r['id']}"
            for p in latest_publications(self.institution)
            for r in p.snapshot
            if teacher.pk in r.get("teacher_ids", [])
        }
        self.assertEqual({r["id"] for r in self.feed().data["rows"]}, expected)

    @override_settings(APNS_ENABLED=True)
    def test_personal_notice_audiences_follow_current_groups_and_password_gate(self):
        from .student_push import audience, queue_notice_push

        access = self.create(source="identifier")
        self.login(access)
        self.change(access["password"])
        stored = m.StudentAccess.objects.get(person=self.person)
        device = m.StudentDeviceSession.objects.get(access=stored)
        device.push_token = "ab" * 32
        device.save()
        notice = m.StudentNotice.objects.create(
            institution=self.institution, group=self.group, title="Nur A1", body="A1"
        )
        queue_notice_push(notice)
        self.assertTrue(
            m.StudentDeviceSession.objects.filter(
                audience(notice), pk=device.pk
            ).exists()
        )
        self.assertEqual(m.StudentPushDelivery.objects.filter(device=device).count(), 1)
        self.person.groups.clear()
        self.assertFalse(
            m.StudentDeviceSession.objects.filter(
                audience(notice), pk=device.pk
            ).exists()
        )
        self.assertNotIn(notice.pk, [n["id"] for n in self.feed().data["notices"]])
        stored.must_change_password = True
        stored.save()
        general = m.StudentNotice.objects.create(
            institution=self.institution, title="Alle", body="Alle"
        )
        queue_notice_push(general)
        self.assertFalse(m.StudentPushDelivery.objects.filter(notice=general).exists())

    def test_old_group_roster_does_not_grant_access_after_group_change(self):
        from .overview import enrich_snapshot
        from .services import plan_rows

        publication = m.Publication.objects.filter(institution=self.institution).first()
        course = m.Course.objects.filter(
            plan=publication.plan, groups=self.group, elective=False
        ).first()
        publication.snapshot = enrich_snapshot(
            plan_rows(publication.plan), self.institution.pk
        )
        publication.save()
        access = self.create()
        self.login(access)
        self.change(access["password"])
        self.assertTrue(self.feed().data["rows"])
        self.person.groups.clear()
        self.assertEqual(self.feed().data["rows"], [])

        course.learners.add(self.person)
        publication.snapshot = enrich_snapshot(
            plan_rows(publication.plan), self.institution.pk
        )
        publication.save()
        self.assertTrue(self.feed().data["rows"])
        self.assertNotIn("explicit_learner_ids", str(self.feed().data))

        for row in publication.snapshot:
            row.pop("explicit_learner_ids", None)
        publication.save()
        self.assertEqual(self.feed().data["rows"], [])

    def test_group_passwords_cannot_be_changed_through_personal_endpoint(self):
        response = self.manager.post(
            "/api/student-app/accesses/",
            {"group": self.group.pk, "server": "https://campus.example.org"},
            format="json",
        )
        self.login(
            {"username": response.data["code"], "password": response.data["password"]}
        )
        self.assertEqual(
            self.client.post(
                "/api/student-app/v1/password/",
                {
                    "current_password": response.data["password"],
                    "new_password": "Anders!Lernen2026",
                },
                format="json",
            ).status_code,
            403,
        )
