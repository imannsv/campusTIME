import time

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from planner.models import Institution, Job, Plan
from planner.tasks import run_job


class Command(BaseCommand):
    help = "Prüft in einer Entwicklungsumgebung Redis/Celery mit einem echten Demo-Planungsauftrag."

    def handle(self, *args, **options):
        if not settings.DEBUG or settings.LOCAL_WORKER:
            raise CommandError(
                "Nur in einer Entwicklungsumgebung mit Celery ausführen."
            )
        institution = Institution.objects.get(slug="demo")
        plan = Plan.objects.filter(institution=institution).first()
        job = Job.objects.create(
            institution=institution,
            plan=plan,
            revision=institution.revision,
            kind="teaching",
        )
        run_job.delay(str(job.id))
        deadline = time.monotonic() + 50
        while time.monotonic() < deadline:
            job.refresh_from_db()
            if job.status not in ["queued", "running"]:
                break
            time.sleep(0.5)
        if job.status != "ready":
            raise CommandError(f"Worker-Test: {job.status}, {job.message}")
        self.stdout.write(
            self.style.SUCCESS(
                f"Redis/Celery geprüft: {len(job.result)} gültige Termine. Der Vorschlag wurde nicht übernommen."
            )
        )
