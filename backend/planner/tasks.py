import logging

from celery import shared_task
from django.db import close_old_connections

from .models import Job
from .solver import solve

logger = logging.getLogger(__name__)


@shared_task
def run_job(job_id):
    close_old_connections()
    job = Job.objects.select_related("plan__period", "institution").get(id=job_id)
    if job.cancel_requested:
        Job.objects.filter(id=job_id).update(
            status="cancelled", message="Berechnung abgebrochen."
        )
        return
    Job.objects.filter(id=job_id).update(
        status="running", message="Termine und Ressourcen werden berechnet."
    )
    try:
        status, message, result = solve(
            job.plan, job.kind, lambda: Job.objects.get(id=job_id).cancel_requested
        )
        if Job.objects.get(id=job_id).cancel_requested:
            status, result = "cancelled", []
        Job.objects.filter(id=job_id).update(
            status=status, message=message, result=result
        )
    except Exception:
        logger.exception("Planning job failed: %s", job_id)
        Job.objects.filter(id=job_id).update(
            status="failed",
            message="Berechnung fehlgeschlagen. Bitte Planungsdaten prüfen oder den Betrieb kontaktieren.",
        )
    finally:
        close_old_connections()
