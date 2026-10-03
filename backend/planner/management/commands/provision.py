import os
from datetime import date

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from planner.models import Audit, Institution, Membership


class Command(BaseCommand):
    help = "Richtet eine neue Kundeneinrichtung samt Verwaltungszugang ein."

    def add_arguments(self, parser):
        parser.add_argument("--name", required=True)
        parser.add_argument("--slug", required=True)
        parser.add_argument("--username", required=True)
        parser.add_argument("--email", default="")
        parser.add_argument(
            "--kind", choices=["school", "university"], default="university"
        )
        parser.add_argument("--license-until", required=True)

    @transaction.atomic
    def handle(self, *args, **options):
        password = os.getenv("ADMIN_PASSWORD")
        if not password:
            raise CommandError("ADMIN_PASSWORD in der Umgebung setzen.")
        if (
            Institution.objects.filter(slug=options["slug"]).exists()
            or get_user_model().objects.filter(username=options["username"]).exists()
        ):
            raise CommandError("Einrichtung oder Benutzername existiert bereits.")
        try:
            validate_password(password)
            license_until = date.fromisoformat(options["license_until"])
        except Exception as error:
            raise CommandError(str(error)) from None
        institution = Institution.objects.create(
            name=options["name"],
            slug=options["slug"],
            kind=options["kind"],
            license_until=license_until,
        )
        institution.full_clean()
        user = get_user_model().objects.create_user(
            options["username"], email=options["email"], password=password
        )
        Membership.objects.create(institution=institution, user=user, role="admin")
        Audit.objects.create(
            institution=institution, action="Kundeneinrichtung angelegt"
        )
        self.stdout.write(
            self.style.SUCCESS("Einrichtung und Verwaltungszugang eingerichtet.")
        )
