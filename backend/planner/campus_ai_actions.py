"""Deterministic, allowlisted UI instructions. These never write records."""

import json
import re
from functools import lru_cache
from pathlib import Path

from django.conf import settings

from .campus_ai_language import language, normalize


@lru_cache(maxsize=1)
def catalog():
    return json.loads(
        (
            Path(settings.BASE_DIR).parent / "shared" / "campus-ai-actions.json"
        ).read_text(encoding="utf-8")
    )


def requested_action(question):
    text = normalize(re.sub(r"\bbitte\b", "", normalize(question)))
    text = re.sub(r"^freddy\s+", "", text)
    for action in catalog():
        for target in action["targets"]:
            templates = language()[
                "creation_templates" if action.get("create") else "navigation_templates"
            ]
            if any(
                text == template.replace("{target}", normalize(target))
                for template in templates
            ):
                return action
    return None


def reply_actions(question, guides, context):
    command = requested_action(question)
    actions = (
        [command]
        if command
        else [
            action
            for action in catalog()
            if any(guide["id"] in action["guides"] for guide in guides)
        ]
    )
    allowed = [
        action
        for action in actions
        if not action.get("requires")
        or context.get("action_requirements", {}).get(action["requires"])
    ]
    result = {
        "actions": [
            {"id": action["id"], "label": action["label"]} for action in allowed
        ],
        "auto_action": command["id"] if command and allowed else None,
    }
    if command:
        if allowed:
            result["answer"] = (
                f"Ich öffne das Formular: {command['label']}. Trage die Angaben ein und speichere sie anschließend selbst."
                if command.get("create")
                else f"Ich öffne die Ansicht: {command['label']}."
            )
        else:
            reason = {
                "approved_version": "Lege zuerst einen Studiengang mit freigegebener Lehrplanversion an.",
                "plan": "Wähle zuerst einen Semesterplan aus.",
            }.get(
                command.get("requires"),
                "Richte zuerst den benötigten Bereich, das Stockwerk oder die Räume ein.",
            )
            result["answer"] = "Dafür fehlen noch Voraussetzungen. " + reason
    return result


def proactive_context(context, selection):
    page, step = selection.get("page", "schedule"), selection.get("step", 0)
    names = {
        "map": "Räume",
        "schedule": "Stundenplanung",
        "data": "Stammdaten",
        "exams": "Prüfungen",
        "displays": "Öffentliche Anzeigen",
        "students": "Studierendenübersicht",
        "settings": "Einstellungen",
    }
    steps = [
        "Räume",
        "Lehrende",
        "Studiengänge",
        "Studienstruktur",
        "Jahrgänge",
        "Semester planen",
    ]
    defaults = {
        "map": ["add_room", "blocks"],
        "schedule": ["courses", "semester"],
        "exams": ["exams", "add_exam"],
        "displays": ["displays", "schedule"],
        "students": ["students", "displays"],
        "settings": ["settings", "setup"],
        "data": ["courses", "blocks"],
    }
    setup = [
        ["rooms", "add_building"],
        ["teachers", "add_teacher"],
        ["programs", "add_program"],
        ["structure", "programs"],
        ["cohorts", "add_cohort"],
        ["semester", "schedule"],
    ]
    resource = selection.get("resource", "")
    resource_scopes = {
        "people": ("setup", 1, "teachers"),
        "programs": ("setup", 2, "programs"),
        "studyversions": ("setup", 3, "structure"),
        "modules": ("setup", 3, "structure"),
        "teachingunits": ("setup", 3, "structure"),
        "cohorts": ("setup", 4, "cohorts"),
        "groups": ("setup", 4, "cohorts"),
        "buildings": ("map", 0, "rooms"),
        "floors": ("map", 0, "rooms"),
        "rooms": ("map", 0, "rooms"),
        "blocks": ("blocks", 0, "blocks"),
    }
    scope = resource_scopes.get(resource) if page == "data" else None
    scope_page, scope_step = scope[:2] if scope else (page, step)
    relevant = [
        item
        for item in context["notices"]
        if (
            item["page"] == scope_page
            and (scope_page != "setup" or item.get("step", scope_step) == scope_step)
        )
        or (page == "setup" and step == 0 and item["page"] == "map")
    ]
    ids = list(
        dict.fromkeys(
            [item.get("action") for item in relevant[:2]]
            + (
                [scope[2]]
                if scope
                else setup[step]
                if page == "setup"
                else defaults.get(page, ["setup"])
            )
        )
    )
    actions = [
        next((action for action in catalog() if action["id"] == id), None) for id in ids
    ]
    actions = [
        action
        for action in actions
        if action
        and (
            not action.get("requires")
            or context["action_requirements"].get(action["requires"])
        )
    ][:2]
    resource = selection.get("resource", "")
    labels = {
        "courses": "Veranstaltungen",
        "people": "Personen",
        "blocks": "Raumblockierungen",
        "groups": "Gruppen",
        "rooms": "Räume",
    }
    label = (
        "Einrichtung · " + steps[step]
        if page == "setup"
        else names.get(page, "Einrichtung")
    )
    if page == "data":
        label += " · " + labels.get(resource, resource or "Übersicht")
    return {
        "view": {"page": page, "step": step, "resource": resource, "label": label},
        "proactive": {
            "notices": relevant[:2],
            "actions": [
                {"id": action["id"], "label": action["label"]} for action in actions
            ],
        },
    }
