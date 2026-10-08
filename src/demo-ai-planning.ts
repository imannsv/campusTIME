import { DateTime } from "luxon";
import type { Row } from "./api";
import type { Store } from "./demo";
import { normalizeQuestion } from "./campus-ai-language";

const selectedPattern =
  /\b(?:diese[nmrs]?|ausgewaehlte[nmrs]?|markierte[nmrs]?|aktuelle[nmrs]?)\s+(?:termin|veranstaltung|pruefung)\b/;
const datePattern = /\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}\.\d{1,2}\.\d{4})\b/;
const rangePattern =
  /\b(?:von\s+)?(\d{1,2}(?::\d{2})?)\s*(?:uhr\s*)?(?:bis|[-–—])\s*(\d{1,2}(?::\d{2})?)(?:\s*uhr)?\b/;
const startPattern = /\b(?:um|ab|von)\s+(\d{1,2})(?::(\d{2}))?\s*(?:uhr)?\b/;
const durationPattern =
  /\b(?:fuer|dauer(?:\s+von)?)\s+(\d+)\s*(minuten?|min|stunden?)\b/;
const peoplePattern =
  /\b(?:fuer|mit)\s+(\d+)\s*(?:personen|teilnehmende[nr]?|teilnehmer[n]?)\b/;
const queryWords = new Set(
  "welche welcher welchen welches raeume raum sind ist frei freie freier freien freiem freies verfuegbar verfuegbarkeit fuer am an um ab von bis uhr mit den dem der die das ein einen eine einem es gibt bitte freddy kannst kann koenntest du mir pruefe pruefen zeige zeigen nenne finde suche brauche ich haben hat heute morgen zum im kalender".split(
    " ",
  ),
);
const globally = (pattern: RegExp) => new RegExp(pattern.source, "g");
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// These answers use fixture records, not language-model guesses or keyword guides.
export function demoPlanningReply(
  question: string,
  context: Row,
  state: Store,
  occupancy: (start: string, end: string) => Row[],
): Row | null {
  const text = normalizeQuestion(question);
  const selected = context.calendar?.selected_session;
  const refersToTerm = selectedPattern.test(text);
  const knownRoom = state.data.rooms.some((room) =>
    new RegExp(`\\b${escape(normalizeQuestion(room.name))}\\b`).test(text),
  );
  const roomQuestion =
    (/\b(?:raum\w*|raeum\w*|hoersaal\w*|labor\w*|seminarraum\w*)\b/.test(
      text,
    ) ||
      knownRoom) &&
    /\b(?:frei|freie[rmns]?|verfuegbar|passt|passen|geeignet)\b/.test(text);
  const termQuestion =
    refersToTerm && /warum|wieso|problem|konflikt|passt|pruef/.test(text);
  if (!roomQuestion && !termQuestion) return null;
  const reply = (answer: string, extra: Row = {}) => ({
    answer:
      answer.length <= 6000
        ? answer
        : answer.slice(0, 5800) +
          "\nWeitere Hinweise stehen in der Planprüfung. Die Antwort wurde gekürzt.",
    mode: "verified",
    revision: context.revision,
    model: null,
    changed: false,
    sources: [],
    actions: [],
    auto_action: null,
    service_note:
      "Geprüft anhand der Daten in diesem Browser. Die vollständige Backend-Planungsprüfung bleibt erforderlich.",
    ...extra,
  });
  if (refersToTerm && !selected)
    return reply(
      "Wähle zuerst einen Termin im Wochenplan aus. Dann kann ich seine Zeiten, Räume und die erkannten Konflikte prüfen.",
    );
  const clarify = () =>
    reply(
      "Bitte stelle eine einzelne, eindeutige Anfrage. Nenne Datum, Startzeit, Endzeit oder Dauer, Personenzahl und nur hinterlegte Raumnamen oder Ausstattungen. Unklare Bedingungen kann ich nicht als erfüllt bestätigen.",
    );
  if (/\b(?:oder|und|sowie|zusaetzlich|inklusive)\b|;/.test(text))
    return clarify();
  if (
    (text.match(/\b(?:warum|wieso|wer|wann|wie|welche|welcher)\b/g)?.length ||
      0) > 1
  )
    return clarify();
  if (termQuestion && !roomQuestion) {
    const issues: string[] = selected.issues || [];
    return reply(
      `${selected.name}: ${issues.length ? "Die Demo-Prüfung meldet:\n" + issues.map((issue) => `• ${issue}`).join("\n") : "In der Demo-Prüfung sind für diesen Termin keine Raum- oder Überschneidungskonflikte erkannt. Das bestätigt noch keine vollständige Freigabe."}`,
    );
  }
  if (
    /\b(?:nicht|kein\w*|ausser|ohne|oder|und|sowie|zusaetzlich|inklusive)\b|;/.test(
      text,
    )
  )
    return clarify();
  const maskedDates = text.replace(globally(datePattern), " ");
  const range = maskedDates.match(rangePattern);
  const maskedRange = maskedDates.replace(globally(rangePattern), " ");
  if (
    (text.match(globally(datePattern))?.length || 0) +
      (text.match(/\b(?:heute|morgen)\b/g)?.length || 0) >
      1 ||
    (maskedDates.match(globally(rangePattern))?.length || 0) > 1 ||
    (maskedRange.match(globally(startPattern))?.length || 0) >
      (range ? 0 : 1) ||
    (text.match(globally(durationPattern))?.length || 0) > 1 ||
    (text.match(globally(peoplePattern))?.length || 0) > 1 ||
    (range && durationPattern.test(text))
  )
    return clarify();
  if (
    refersToTerm &&
    (datePattern.test(text) || /\b(?:heute|morgen|um|von|ab|\d+)\b/.test(text))
  )
    return clarify();
  const catalog = [
    ...new Set<string>(
      state.data.rooms.flatMap((room) => room.equipment || []),
    ),
  ];
  let remainder = text;
  for (const pattern of [
    datePattern,
    selectedPattern,
    rangePattern,
    startPattern,
    durationPattern,
    peoplePattern,
  ])
    remainder = remainder.replace(globally(pattern), " ");
  const knownNames = [...state.data.rooms.map((room) => room.name), ...catalog]
    .map(normalizeQuestion)
    .sort((a, b) => b.length - a.length);
  for (const name of knownNames)
    remainder = remainder.replace(
      new RegExp(`\\b${escape(name)}\\b`, "g"),
      " ",
    );
  if ((remainder.match(/\w+/g) || []).some((word) => !queryWords.has(word)))
    return clarify();
  const zone = state.institution.timezone || "Europe/Berlin";
  const today = DateTime.now().setZone(zone).startOf("day");
  const iso = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  const german = text.match(/\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/);
  let date = iso
    ? DateTime.fromISO(iso[1], { zone })
    : german
      ? DateTime.fromObject(
          {
            year: Number(german[3] || today.year),
            month: Number(german[2]),
            day: Number(german[1]),
          },
          { zone },
        )
      : /\buebermorgen\b/.test(text)
        ? today.plus({ days: 2 })
        : /\bmorgen\b/.test(text)
          ? today.plus({ days: 1 })
          : /\bheute\b/.test(text)
            ? today
            : refersToTerm
              ? DateTime.fromISO(selected.start, { zone })
              : null;
  const clockParts = (value: string) =>
    [value, ...value.split(":")] as RegExpMatchArray;
  const startMatch = range ? clockParts(range[1]) : text.match(startPattern);
  const endMatch = range ? clockParts(range[2]) : null;
  const durationMatch = text.match(durationPattern);
  const peopleMatch = text.match(peoplePattern);
  if (!date?.isValid)
    return reply(
      "Für welches Datum soll ich die Räume prüfen? Nenne heute, morgen oder ein gültiges Datum.",
    );
  const validClock = (match: RegExpMatchArray) =>
    Number(match[1]) <= 23 && Number(match[2] || 0) <= 59;
  if (
    (startMatch && !validClock(startMatch)) ||
    (endMatch && !validClock(endMatch))
  )
    return reply("Nenne gültige Uhrzeiten zwischen 00:00 und 23:59.");
  const start = startMatch
    ? date.set({
        hour: Number(startMatch[1]),
        minute: Number(startMatch[2] || 0),
        second: 0,
        millisecond: 0,
      })
    : refersToTerm
      ? DateTime.fromISO(selected.start, { zone })
      : null;
  if (!start?.isValid)
    return reply("Ab welcher Uhrzeit wird der Raum benötigt?");
  const end = endMatch
    ? date.set({
        hour: Number(endMatch[1]),
        minute: Number(endMatch[2] || 0),
        second: 0,
        millisecond: 0,
      })
    : durationMatch
      ? start.plus({
          minutes:
            Number(durationMatch[1]) *
            (durationMatch[2].startsWith("stunde") ? 60 : 1),
        })
      : refersToTerm
        ? DateTime.fromISO(selected.end, { zone })
        : null;
  if (!end?.isValid)
    return reply(
      "Bis wann wird der Raum benötigt? Nenne die Endzeit oder die Dauer, beispielsweise „bis 11 Uhr“ oder „für 60 Minuten“.",
    );
  if (
    start.getPossibleOffsets().length > 1 ||
    end.getPossibleOffsets().length > 1 ||
    (startMatch &&
      (start.hour !== Number(startMatch[1]) ||
        start.minute !== Number(startMatch[2] || 0))) ||
    (endMatch &&
      (end.hour !== Number(endMatch[1]) ||
        end.minute !== Number(endMatch[2] || 0)))
  )
    return reply(
      "Diese Uhrzeit ist wegen der Zeitumstellung nicht eindeutig. Bitte wähle eine eindeutige Zeitspanne.",
    );
  if (end <= start || end.toISODate() !== start.toISODate())
    return reply(
      "Die Endzeit muss nach dem Beginn am selben Tag liegen. Nenne ein eindeutiges Zeitfenster.",
    );
  const participants = peopleMatch
    ? Number(peopleMatch[1])
    : refersToTerm
      ? selected.participants
      : null;
  if (!participants || participants < 1)
    return reply("Für wie viele Personen soll ich die Raumkapazität prüfen?");
  const equipment = refersToTerm ? [...(selected.equipment || [])] : [];
  for (const item of catalog)
    if (text.includes(normalizeQuestion(item)) && !equipment.includes(item))
      equipment.push(item);
  const busy = occupancy(start.toISO()!, end.toISO()!).filter(
    (row) =>
      !(
        refersToTerm &&
        row.plan_id === context.facts.plan?.id &&
        row.id === selected.id
      ),
  );
  const names = state.data.rooms.filter((room) =>
    text.includes(normalizeQuestion(room.name)),
  );
  const candidates = state.data.rooms.filter(
    (room) =>
      (!names.length || names.some((named) => named.id === room.id)) &&
      room.capacity != null &&
      room.capacity >= participants &&
      equipment.every((item) => room.equipment?.includes(item)) &&
      !busy.some((row) => (row.room_ids || row.rooms || []).includes(room.id)),
  );
  const window = `${start.toFormat("dd.MM.yyyy")} · ${start.toFormat("HH:mm")}–${end.toFormat("HH:mm")} · ${participants} Personen`;
  const roomLines: string[] = [];
  let displaySize = 0;
  for (const room of candidates) {
    const line = `• ${room.name} · ${room.capacity} Plätze`;
    if (displaySize + line.length > 4800) break;
    roomLines.push(line);
    displaySize += line.length + 1;
  }
  const omitted = candidates.length - roomLines.length;
  return reply(
    candidates.length
      ? `Im angefragten Zeitfenster passen ${candidates.length} Räume nach der Demo-Prüfung (${window}):\n` +
          roomLines.join("\n") +
          (omitted
            ? `\n${omitted} weitere Räume wurden ebenfalls als passend geprüft. Frage nach einem genauen Raumnamen, um die Auswahl einzugrenzen.`
            : "")
      : `Für ${window} wurde kein passender freier Raum gefunden. Geprüft wurden Kapazität, benötigte Ausstattung, gespeicherte Belegungen und Raumsperren.`,
    {
      checked_query: { start: start.toISO(), end: end.toISO(), participants },
      matching_rooms: candidates.map(({ id, name, capacity }) => ({
        id,
        name,
        capacity,
      })),
    },
  );
}
