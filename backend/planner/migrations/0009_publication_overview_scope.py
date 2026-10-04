from types import SimpleNamespace

from django.db import migrations


def add_overview_scopes(apps, schema_editor):
    from planner.overview import enrich_snapshot

    models = SimpleNamespace(
        **{
            name: apps.get_model("planner", name)
            for name in ["Group", "Person", "Course", "Exam"]
        }
    )
    Publication = apps.get_model("planner", "Publication")
    for publication in Publication.objects.all().iterator():
        publication.snapshot = enrich_snapshot(
            publication.snapshot, publication.institution_id, models
        )
        publication.save(update_fields=["snapshot"])


class Migration(migrations.Migration):
    dependencies = [("planner", "0008_module_assessment_duration_minutes_and_more")]
    operations = [migrations.RunPython(add_overview_scopes, migrations.RunPython.noop)]
