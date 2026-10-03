"""Generate only fictional data in a disposable database, never export user data."""

import json
import os
import sys
from datetime import date
from pathlib import Path
from tempfile import TemporaryDirectory

import django
from django.conf import settings
from django.core.management import call_command
from django.core.serializers.json import DjangoJSONEncoder

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))
os.environ["DJANGO_SETTINGS_MODULE"] = "config.settings"
os.environ["DEBUG"] = "1"

with TemporaryDirectory(prefix="campustime-demo-") as temporary:
    settings.DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": str(Path(temporary) / "fictional.sqlite3"),
        }
    }
    django.setup()
    from planner.models import Institution, Publication
    from planner.serializers import RESOURCES, schema, serializer_for

    call_command("migrate", verbosity=0)
    call_command("seed_demo", password="FictionalBuildOnly2026!")
    reference = date(2026, 10, 3)
    call_command("seed_showcase", date=reference)
    institution = Institution.objects.get(slug="demo")
    content = {
        "reference": reference.isoformat(),
        "schema": schema(),
        "institution": {
            field.name: getattr(institution, field.name)
            for field in institution._meta.fields
        },
        "data": {
            name: list(
                serializer_for(model)(
                    model.objects.order_by("id"),
                    many=True,
                    context={"institution": institution},
                ).data
            )
            for name, model in RESOURCES.items()
        },
        "publications": list(
            Publication.objects.values("plan_id", "number", "created", "snapshot")
        ),
        "audit": [],
    }
    target = ROOT / "src" / "demo-data.json"
    target.write_text(
        json.dumps(
            content, cls=DjangoJSONEncoder, ensure_ascii=False, separators=(",", ":")
        ),
        encoding="utf-8",
    )
    print(f"Fictional browser demo generated: {target.name}")
    from django.db import connections

    connections.close_all()
