"""Disposable backend for documentation screenshots and Wiki browser tests."""

import os
import sys
from pathlib import Path
from tempfile import TemporaryDirectory

import django
from django.conf import settings
from django.core.management import call_command

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))
os.environ["DJANGO_SETTINGS_MODULE"] = "config.settings"
os.environ["DEBUG"] = "1"
os.environ.pop("POSTGRES_HOST", None)

with TemporaryDirectory(prefix="campuszeit-wiki-") as temporary:
    settings.DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": str(Path(temporary) / "fictional.sqlite3"),
        }
    }
    settings.CAMPUS_AI_ENABLED = False
    settings.CSRF_TRUSTED_ORIGINS = ["http://127.0.0.1:5186"]
    django.setup()
    call_command("migrate", verbosity=0)
    call_command("seed_demo", password="WikiBuildOnly2026!")
    call_command("seed_showcase")
    call_command("seed_study")
    call_command(
        "runserver",
        f"127.0.0.1:{sys.argv[1] if len(sys.argv) > 1 else '8123'}",
        use_reloader=False,
    )
