from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from .models import Institution, Membership
from .wiki import ROOT, catalog


class WikiAccessTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = get_user_model().objects.create_user(
            "wiki-reader", password="test-only"
        )
        self.institution = Institution.objects.create(
            name="Fiktive Testhochschule", slug="wiki-test"
        )
        Membership.objects.create(
            user=self.user, institution=self.institution, role="planner"
        )

    def test_anonymous_cannot_read_catalog_articles_or_images(self):
        for url in [
            "/api/wiki/",
            "/api/wiki/articles/setup/",
            "/api/wiki/assets/start-01.png",
        ]:
            response = self.client.get(url)
            self.assertEqual(response.status_code, 403, url)
            self.assertNotIn(b"Neu anfangen", response.content)

    def test_account_requires_institution_membership(self):
        Membership.objects.all().delete()
        self.client.force_authenticate(self.user)
        self.assertEqual(self.client.get("/api/wiki/").status_code, 403)

    def test_every_registered_article_and_image_is_readable_and_private(self):
        self.client.force_authenticate(self.user)
        response = self.client.get("/api/wiki/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Cache-Control"], "private, no-store")
        self.assertEqual(len(response.data["articles"]), len(catalog()))
        for item in response.data["articles"]:
            self.assertTrue(item["searchText"])
            article = self.client.get(f"/api/wiki/articles/{item['id']}/")
            self.assertEqual(article.status_code, 200)
            self.assertEqual(article.data["markdown"], item["searchText"])
            for image in item["images"]:
                asset = self.client.get(f"/api/wiki/assets/{image}")
                try:
                    self.assertEqual(asset.status_code, 200)
                    self.assertEqual(asset["Content-Type"], "image/png")
                    self.assertEqual(asset["Cache-Control"], "private, no-store")
                    self.assertEqual(asset["X-Content-Type-Options"], "nosniff")
                finally:
                    asset.close()

    def test_expired_license_can_read_without_changing_institution(self):
        self.institution.license_until = timezone.localdate() - timedelta(days=1)
        self.institution.save()
        self.client.force_authenticate(self.user)
        self.assertEqual(self.client.get("/api/wiki/articles/setup/").status_code, 200)
        self.institution.refresh_from_db()
        self.assertEqual(self.institution.revision, 0)

    def test_unknown_resources_and_unregistered_files_are_unavailable(self):
        self.client.force_authenticate(self.user)
        for url in [
            "/api/wiki/articles/missing/",
            "/api/wiki/assets/catalog.json",
            "/api/wiki/assets/unknown.png",
            "/api/wiki/assets/%2e%2e%2fcatalog.json",
        ]:
            self.assertEqual(self.client.get(url).status_code, 404, url)

    def test_logout_revokes_access(self):
        self.client.force_login(self.user)
        self.assertEqual(self.client.get("/api/wiki/").status_code, 200)
        self.client.logout()
        self.assertEqual(self.client.get("/api/wiki/").status_code, 403)

    def test_documentation_is_read_only(self):
        self.client.force_authenticate(self.user)
        before = (ROOT / "articles/setup.md").read_bytes()
        for method in ["post", "put", "patch", "delete"]:
            response = getattr(self.client, method)(
                "/api/wiki/articles/setup/", {}, format="json"
            )
            self.assertEqual(response.status_code, 405)
        self.assertEqual((ROOT / "articles/setup.md").read_bytes(), before)
