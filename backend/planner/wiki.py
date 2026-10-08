"""Git-versioned user documentation, accessible only through an active account."""

import hashlib
import json
from functools import lru_cache
from pathlib import Path

from django.conf import settings
from django.http import FileResponse
from rest_framework.decorators import api_view
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.response import Response

from .models import Membership

ROOT = Path(settings.BASE_DIR).parent / "shared" / "wiki"


@lru_cache(maxsize=1)
def catalog():
    return json.loads((ROOT / "catalog.json").read_text(encoding="utf-8"))


def authorize(request):
    if not Membership.objects.filter(user=request.user).exists():
        raise PermissionDenied("Kein Einrichtungszugang zugeordnet.")


def private(response):
    response["Cache-Control"] = "private, no-store"
    response["X-Content-Type-Options"] = "nosniff"
    return response


def article_for(article_id):
    article = next((item for item in catalog() if item["id"] == article_id), None)
    if not article:
        raise NotFound("Artikel nicht gefunden.")
    return article


@api_view(["GET"])
def index(request):
    authorize(request)
    articles = []
    for item in catalog():
        body = (ROOT / "articles" / f"{item['id']}.md").read_text(encoding="utf-8")
        articles.append({**item, "searchText": body})
    revision = hashlib.sha256(
        json.dumps(articles, ensure_ascii=False).encode()
    ).hexdigest()[:16]
    return private(Response({"revision": revision, "articles": articles}))


@api_view(["GET"])
def article(request, article_id):
    authorize(request)
    item = article_for(article_id)
    body = (ROOT / "articles" / f"{item['id']}.md").read_text(encoding="utf-8")
    return private(Response({"id": item["id"], "markdown": body}))


@api_view(["GET"])
def asset(request, filename):
    authorize(request)
    # Only catalogue-registered images can be requested, never arbitrary paths.
    allowed = {image for item in catalog() for image in item.get("images", [])}
    if filename not in allowed or Path(filename).name != filename:
        raise NotFound("Bild nicht gefunden.")
    file = ROOT / "images" / filename
    if not file.is_file():
        raise NotFound("Bild nicht gefunden.")
    return private(FileResponse(file.open("rb"), content_type="image/png"))
