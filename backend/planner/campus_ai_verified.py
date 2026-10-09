"""Conservative factual queries. Checked replies never pass through a model."""

import re
from datetime import date, datetime, time, timedelta
from datetime import timezone as datetime_timezone
from types import SimpleNamespace
from zoneinfo import ZoneInfo

from django.utils import timezone

from . import models as m
from .campus_ai_language import normalize
from .services import block_rows, dt, external_rows, latest_publications, plan_rows

SELECTED = re.compile(
    r"\b(?:diese[nmrs]?|ausgewaehlte[nmrs]?|markierte[nmrs]?|aktuelle[nmrs]?)\s+"
    r"(?:termin|veranstaltung|pruefung)\b"
)
DATES = re.compile(r"\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}\.\d{1,2}\.\d{4})\b")
CLOCK = r"\d{1,2}(?::\d{2})?"
RANGE = re.compile(
    rf"\b(?:von\s+)?({CLOCK})\s*(?:uhr\s*)?(?:bis|[-–—])\s*({CLOCK})(?:\s*uhr)?\b"
)
START = re.compile(rf"\b(?:um|ab|von)\s+({CLOCK})(?:\s*uhr)?\b")
DURATION = re.compile(
    r"\b(?:fuer|dauer(?:\s+von)?)\s+(\d+)\s*(minuten?|min|stunden?)\b"
)
PEOPLE = re.compile(
    r"\b(?:fuer|mit)\s*(\d+)\s+(?:personen|teilnehmende[nr]?|teilnehmer[n]?)\b"
)
QUERY_WORDS = set(
    "welche welcher welchen welches raeume raum sind ist frei freie freien freier freies freiem "
    "verfuegbar verfuegbare verfuegbaren verfuegbarer verfuegbares verfuegbarem verfuegbarkeit "
    "fuer am an um ab von bis uhr mit den dem der die das ein einen eine einem es gibt "
    "bitte freddy kannst kann koenntest du mir pruefe pruefen zeige zeigen nenne finde "
    "suche brauche ich haben hat heute morgen zum im kalender".split()
)
MAX_VERIFIED_REPLY = 6000


def unparsed_requirements(text, rooms, equipment):
    """Only certify inputs whose constraints were fully consumed by this grammar."""
    remainder = DATES.sub(" ", text)
    for pattern in (SELECTED, RANGE, START, DURATION, PEOPLE):
        remainder = pattern.sub(" ", remainder)
    names = [normalize(room.name) for room in rooms] + [
        normalize(item) for item in equipment
    ]
    for name in sorted(names, key=len, reverse=True):
        remainder = re.sub(r"\b" + re.escape(name) + r"\b", " ", remainder)
    return any(word not in QUERY_WORDS for word in re.findall(r"\w+", remainder))


def checked_response(context, answer, **extra):
    if len(answer) > MAX_VERIFIED_REPLY:
        marker = "\n… Antwort gekürzt. Öffne die Planung für alle Hinweise."
        answer = answer[: MAX_VERIFIED_REPLY - len(marker)].rstrip() + marker
        extra = {
            **extra,
            "truncated": True,
            "service_note": "Die Datenprüfung wurde wegen der Längenbegrenzung gekürzt.",
        }
    return {
        "answer": answer,
        "mode": "verified",
        "model": None,
        "sources": [],
        "actions": [],
        "auto_action": None,
        "revision": context["revision"],
        "changed": False,
        **extra,
    }


def interval_for(text, institution, selected=None):
    """Parse a single interval; uncertainty is a clarification, never a default."""
    if SELECTED.search(text):
        if not selected:
            return None, "Wähle zuerst den Termin im Kalender aus."
        # Combining a selected term with explicit overrides is ambiguous.
        if DATES.search(text) or re.search(r"\b(?:heute|morgen|um|von|ab|\d+)\b", text):
            return (
                None,
                "Meinst du den ausgewählten Termin oder eine andere Zeitspanne? Bitte stelle eine einzelne Anfrage.",
            )
        if not selected["participants"]:
            return None, "Wie viele Personen sollen am ausgewählten Termin teilnehmen?"
        return {
            "start": dt(selected["start"]),
            "end": dt(selected["end"]),
            "participants": selected["participants"],
            "equipment": selected["equipment"],
        }, None

    zone = ZoneInfo(institution.timezone)
    dates = DATES.findall(text)
    relative = re.findall(r"\b(?:heute|morgen)\b", text)
    ranges = list(RANGE.finditer(DATES.sub(" ", text)))
    durations = DURATION.findall(text)
    people = PEOPLE.findall(text)
    if (
        len(dates) + len(relative) > 1
        or len(ranges) > 1
        or len(durations) > 1
        or len(people) > 1
    ):
        return (
            None,
            "Bitte nenne genau ein Datum, eine Zeitspanne und eine Personenzahl.",
        )
    try:
        if dates:
            day = (
                date.fromisoformat(dates[0])
                if "-" in dates[0]
                else datetime.strptime(dates[0], "%d.%m.%Y").date()
            )
        elif relative:
            day = timezone.now().astimezone(zone).date() + timedelta(
                days=relative[0] == "morgen"
            )
        else:
            day = None
    except ValueError:
        return None, "Bitte nenne ein gültiges Datum, zum Beispiel 08.10.2026."

    def clock(value):
        pieces = value.split(":")
        return time(int(pieces[0]), int(pieces[1]) if len(pieces) > 1 else 0)

    start_clock = end_clock = None
    masked = DATES.sub(" ", text)
    try:
        if ranges:
            if durations:
                return (
                    None,
                    "Nenne entweder die Endzeit oder die Dauer, damit die Zeitspanne eindeutig ist.",
                )
            start_clock, end_clock = map(clock, ranges[0].groups())
            masked = RANGE.sub(" ", masked)
            if re.search(r"\b(?:um|ab|von)\s+\d", masked):
                return None, "Bitte nenne genau eine Zeitspanne."
        else:
            starts = START.findall(masked)
            if len(starts) > 1:
                return None, "Bitte nenne genau eine Startzeit."
            if starts:
                start_clock = clock(starts[0])
            if durations and start_clock:
                number, unit = durations[0]
                minutes = int(number) * (60 if unit.startswith("stunde") else 1)
                if minutes <= 0 or minutes >= 1440:
                    return (
                        None,
                        "Bitte nenne eine positive Dauer innerhalb eines Tages.",
                    )
                ending = datetime.combine(
                    day or date(2000, 1, 1), start_clock
                ) + timedelta(minutes=minutes)
                if ending.date() != (day or date(2000, 1, 1)):
                    return None, "Bitte nenne eine Zeitspanne innerhalb eines Tages."
                end_clock = ending.time()
    except ValueError:
        return None, "Bitte nenne gültige Uhrzeiten zwischen 00:00 und 23:59."
    missing = []
    if day is None:
        missing.append("Datum")
    if start_clock is None:
        missing.append("Startzeit")
    if end_clock is None:
        missing.append("Endzeit oder Dauer")
    if not people or int(people[0]) < 1:
        missing.append("Anzahl der Personen")
    if missing:
        return None, "Für die Raumprüfung fehlen: " + ", ".join(
            missing
        ) + ". Bitte ergänze diese Angaben."
    if end_clock <= start_clock:
        return None, "Die Endzeit muss nach der Startzeit am selben Tag liegen."
    start, end = (
        datetime.combine(day, value, zone) for value in (start_clock, end_clock)
    )
    for value in (start, end):
        if (
            value.replace(fold=1).utcoffset() != value.utcoffset()
            or value.astimezone(datetime_timezone.utc).astimezone(zone) != value
        ):
            return (
                None,
                "Diese Uhrzeit ist wegen der Zeitumstellung nicht eindeutig. Bitte wähle eine eindeutige Zeitspanne.",
            )
    return {
        "start": start,
        "end": end,
        "participants": int(people[0]),
        "equipment": [],
    }, None


def verified_reply(question, context):
    text = normalize(question)
    selected = context.get("calendar", {}).get("selected_session")
    term_question = SELECTED.search(text) and re.search(
        r"\b(?:warum|wieso|problem\w*|konflikt\w*|fehlt|hinweis\w*|pruefe)\b", text
    )
    resource_named = re.search(
        r"\b(?:ra(?:um|eume)\w*|hoersa(?:al|ele)\w*|labor\w*|seminarraum\w*)\b", text
    ) or any(
        room.get("name")
        and re.search(r"\b" + re.escape(normalize(room["name"])) + r"\b", text)
        for room in context.get("rooms", [])
    )
    room_question = resource_named and re.search(
        r"\b(?:frei(?:e[nrms]?)?|verfuegbar(?:e[nrms]?)?|verfuegbarkeit)\b", text
    )
    # General instructions stay with curated help. Factual questions require a check.
    if (
        room_question
        and text.startswith(("wie ", "wann ", "reicht "))
        and not (
            DATES.search(text)
            or SELECTED.search(text)
            or re.search(r"\b(?:heute|morgen)\b", text)
        )
    ):
        room_question = False
    if not term_question and not room_question:
        return None
    compound = (
        re.search(r"\b(?:oder|und|sowie|zusaetzlich|inklusive)\b|[;]", text)
        or len(re.findall(r"\b(?:warum|wieso|wer|wann|wie|welche|welcher)\b", text)) > 1
    )
    negated_rooms = room_question and re.search(r"\b(?:nicht|kein\w*|ohne)\b", text)
    if compound or negated_rooms:
        return checked_response(
            context,
            "Bitte stelle eine einzelne, eindeutige Anfrage. Nenne für freie Räume Datum, Startzeit, Endzeit oder Dauer und Personenzahl.",
        )
    if term_question and not room_question:
        if not selected:
            return checked_response(
                context,
                "Wähle zuerst den Termin im Kalender aus, dessen Hinweise ich erklären soll.",
            )
        issues = selected["issues"]
        return checked_response(
            context,
            f"Geprüfter Termin „{selected['name']}“:\n"
            + (
                "\n".join("• " + issue for issue in issues)
                if issues
                else "Für diesen Termin wurden bei der aktuellen Planprüfung keine Konflikte festgestellt."
            ),
        )
    institution_id = context.get("facts", {}).get("institution_id")
    if not institution_id:
        return checked_response(
            context, "Für diese Prüfung fehlt der Kontext der angemeldeten Einrichtung."
        )
    institution = m.Institution.objects.get(id=institution_id)
    query, clarification = interval_for(text, institution, selected)
    if clarification:
        return checked_response(context, clarification)
    # Unparsed extra requirements must never be silently ignored.
    if re.search(
        r"\b(?:ausser|ausgenommen|mindestens|hoechstens|barrierefrei|neben|vor|nach|zwischen)\b",
        text,
    ):
        return checked_response(
            context,
            "Für diese zusätzlichen Bedingungen ist die Anfrage nicht eindeutig. Bitte prüfe einen ausgewählten Termin oder nenne eine einzelne Zeitspanne und Personenzahl.",
        )
    rooms = list(m.Room.objects.filter(institution=institution).order_by("id"))
    named_rooms = [
        room
        for room in rooms
        if re.search(r"\b" + re.escape(normalize(room.name)) + r"\b", text)
    ]
    if not named_rooms and re.search(r"^ist\s+(?:der\s+)?raum\b", text):
        return checked_response(
            context,
            "Welchen hinterlegten Raum meinst du? Bitte nenne seine genaue Bezeichnung.",
        )
    equipment = set(query["equipment"])
    # Explicitly named equipment is checked against stored room equipment.
    if " mit " in text and not re.search(
        r"\bmit\s+\d+\s+(?:personen|teilnehmende|teilnehmer)\b", text
    ):
        requested = text.split(" mit ", 1)[1]
        known = {str(item) for room in rooms for item in room.equipment}
        named = {
            item
            for item in known
            if re.search(r"\b" + re.escape(normalize(item)) + r"\b", requested)
        }
        remainder = requested
        for item in named:
            remainder = re.sub(
                r"\b" + re.escape(normalize(item)) + r"\b", " ", remainder
            )
        remainder = re.sub(
            r"\b(?:frei|verfuegbar|bitte|sein|ist|sind)\b|[?!.]", " ", remainder
        ).strip()
        if not named or remainder:
            return checked_response(
                context,
                "Welche hinterlegte Raumausstattung benötigst du? Bitte nenne sie genau oder wähle den Termin im Kalender aus.",
            )
        equipment |= named
    if unparsed_requirements(text, rooms, equipment):
        return checked_response(
            context,
            "Ich kann die zusätzlichen Bedingungen nicht eindeutig prüfen. Bitte nenne ein Datum, eine Zeitspanne und die Personenzahl oder frage nach dem ausgewählten Termin.",
        )
    plan_id = context.get("facts", {}).get("plan", {}).get("id")
    plan = (
        m.Plan.objects.select_related("institution")
        .filter(institution=institution, id=plan_id)
        .first()
    )
    selected_id = selected["id"] if selected and SELECTED.search(text) else None
    draft = [row for row in plan_rows(plan) if row["id"] != selected_id and not row.get("cancelled")] if plan else []
    from .teacher_availability import overlay_cancellations
    published = (
        external_rows(plan)
        if plan
        else [
            row
            for publication in latest_publications(institution)
            for row in overlay_cancellations(publication.snapshot, institution, publication.plan_id)
            if not row.get("cancelled")
        ]
    )
    zone = ZoneInfo(institution.timezone)
    start, end = query["start"], query["end"]
    period = SimpleNamespace(
        start=start.astimezone(zone).date(), end=end.astimezone(zone).date()
    )
    blocks = block_rows(institution, period)
    occupied = {
        room_id
        for row in draft + published + blocks
        if dt(row["start"]) < end and start < dt(row["end"])
        for room_id in row.get("room_ids", [])
    }
    candidates = named_rooms or rooms
    matches = [
        room
        for room in candidates
        if room.id not in occupied
        and room.capacity is not None
        and room.capacity >= query["participants"]
        and equipment <= set(room.equipment)
    ]
    local_start, local_end = start.astimezone(zone), end.astimezone(zone)
    interval = f"{local_start:%d.%m.%Y}, {local_start:%H:%M}–{local_end:%H:%M}"
    answer = f"Geprüft für {interval} ({institution.timezone}), {query['participants']} Personen"
    answer += f":\n{len(matches)} freie passende Räume.\n"
    if equipment:
        equipment_text = ", ".join(sorted(equipment))
        answer += "Ausstattung: " + equipment_text[:1000]
        if len(equipment_text) > 1000:
            answer += " … (Ausstattungsliste gekürzt)"
        answer += "\n"
    scope_note = (
        "\nGeprüft wurden der ausgewählte Entwurf, die zuletzt veröffentlichten anderen Pläne und Raumblockierungen."
        if plan
        else "\nGeprüft wurden die zuletzt veröffentlichten Pläne und Raumblockierungen; kein Entwurf ist ausgewählt."
    )
    scope_note += " Räume ohne bestätigte Kapazität werden nicht als passend bestätigt."
    if selected_id:
        scope_note += " Der ausgewählte Termin wurde bei der Belegung ausgenommen."
    omitted_note = f"\n{len(matches)} weitere passende Räume sind aus Platzgründen nicht angezeigt."
    display_budget = (
        MAX_VERIFIED_REPLY - len(answer) - len(scope_note) - len(omitted_note) - 2
    )
    displayed = []
    for room in matches:
        label = f"{room.name} ({room.capacity} Plätze)"
        cost = len(label) + (2 if displayed else 0)
        if cost > display_budget:
            break
        displayed.append(label)
        display_budget -= cost
    omitted = len(matches) - len(displayed)
    answer += (
        ", ".join(displayed) + "."
        if matches
        else "Für diese Angaben wurde kein freier passender Raum gefunden."
    )
    if omitted:
        answer += (
            f"\n{omitted} weitere passende Räume sind aus Platzgründen nicht angezeigt."
        )
    answer += scope_note
    return checked_response(
        context,
        answer,
        checked={
            "date": local_start.date().isoformat(),
            "start": start.isoformat(),
            "end": end.isoformat(),
            "participants": query["participants"],
            "equipment": sorted(equipment),
            "room_ids": [room.id for room in matches],
            "coverage": {
                "rooms": len(rooms),
                "matching_rooms": len(matches),
                "displayed_rooms": len(displayed),
                "omitted_rooms": omitted,
                "draft_sessions": len(draft),
                "published_sessions": len(published),
                "room_blocks": len(blocks),
                "context": "tenant",
                "selected_session_excluded": selected_id,
            },
        },
    )
