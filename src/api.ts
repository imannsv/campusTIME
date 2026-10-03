import { DateTime } from "luxon";
export const DEMO_MODE = import.meta.env.MODE === "demo";
export type Row = Record<string, any>;
export type Field = {
  name: string;
  type: string;
  required: boolean;
  resource?: string;
  choices: [string, string][];
  default: any;
};
export const labels: Record<string, string> = {
  areas: "Planungsbereiche",
  programs: "Studien- & Bildungsgänge",
  studyversions: "Lehrplanversionen",
  modules: "Module & Teilmodule",
  teachingunits: "Lehrveranstaltungen der Studienstruktur",
  cohorts: "Jahrgänge",
  groups: "Gruppen & Klassen",
  people: "Personen",
  periods: "Planungszeiträume",
  buildings: "Raumbereiche",
  floors: "Stockwerke",
  rooms: "Räume",
  curricula: "Lehrplanvorlagen",
  plans: "Stundenpläne",
  courses: "Veranstaltungen",
  exams: "Prüfungen",
  sessions: "Termine",
  blocks: "Raumblockierungen",
  displays: "Anzeigen",
  name: "Name",
  code: "Kennung",
  program: "Studien-/Bildungsgang",
  duration_semesters: "Regelstudienzeit (Semester)",
  total_credits: "Credit Points gesamt",
  credits: "Credit Points",
  difficulty: "Schwierigkeit",
  assessment_type: "Prüfungsart",
  assessment_duration_minutes: "Prüfungsdauer (Minuten)",
  assessment_notes: "Prüfungsanforderungen / Abgabehinweise",
  semester_credit_limit: "CP-Planungsgrenze je Semester (0 = Mittelwert)",
  semester_weekly_limit: "UE-Grenze pro Woche (0 = keine Vorgabe)",
  semester_difficulty_limit: "Belastungsgrenze je Semester (0 = Mittelwert)",
  study_version: "Lehrplanversion",
  version: "Versionsbezeichnung",
  parent: "Obermodul",
  prerequisites: "Voraussetzungen",
  module: "Modul",
  semester: "Fachsemester",
  format: "Veranstaltungsart",
  entry_year: "Aufnahmejahr",
  teaching_unit: "Vorlage der Studienstruktur",
  group_mode: "Durchführung für Gruppen",
  study_group: "Gruppe der Studienstruktur",
  cohort: "Jahrgang",
  size: "Gruppengröße",
  kind: "Art",
  availability: "Verfügbarkeit",
  start: "Beginn",
  end: "Ende",
  excluded_dates: "Unterrichtsfreie Tage",
  day_start: "Tagesbeginn",
  day_end: "Tagesende",
  slot_minutes: "Zeitraster (Minuten)",
  weekdays: "Wochentage",
  longitude: "Längengrad",
  latitude: "Breitengrad",
  geometry: "Gebäudeumriss",
  building: "Bereich",
  level: "Stockwerknummer",
  background: "Grundriss",
  floor: "Stockwerk",
  capacity: "Kapazität",
  equipment: "Ausstattung",
  polygon: "Raumfläche",
  items: "Fächer der Vorlage",
  period: "Zeitraum",
  area: "Planungsbereich",
  plan: "Stundenplan",
  learners: "Teilnehmer",
  teachers: "Lehrende",
  elective: "Wahlpflichtkurs",
  target_mode: "Sollart",
  target_units: "Soll (Unterrichtseinheiten)",
  duration_minutes: "Termindauer (Minuten)",
  block_days: "Zusammenhängende Blocktage",
  week_pattern: "Wochenrhythmus",
  color: "Farbe",
  teacher_assignments: "Lehrendenteams je Termin",
  course: "Kurs",
  exam: "Prüfung",
  supervisors: "Aufsichten",
  window_start: "Prüfungszeitraum ab",
  window_end: "Prüfungszeitraum bis",
  resit: "Nachschreibeklausur",
  locked: "Termin fixieren",
  repeat_weekly: "Wöchentlich wiederholen",
  repeat_until: "Wiederholen bis",
  repeat_interval: "Wiederholungsrhythmus",
  show_teachers: "Lehrendennamen anzeigen",
  view_mode: "Anzeigezeitraum",
  auto_scroll: "Automatisch scrollen",
  scroll_seconds: "Scroll-Dauer (Sekunden)",
  active: "Anzeige aktiv",
};
export async function api(
  path: string,
  method = "GET",
  body?: any,
): Promise<any> {
  if (DEMO_MODE) {
    const { demoApi } = await import("./demo");
    return demoApi(path, method, body);
  }
  const csrf =
    document.cookie
      .split("; ")
      .find((x) => x.startsWith("csrftoken="))
      ?.split("=")
      .slice(1)
      .join("=") || "";
  const form = body instanceof FormData;
  const response = await fetch("/api/" + path, {
    method,
    credentials: "same-origin",
    headers: {
      ...(form ? {} : { "Content-Type": "application/json" }),
      "X-CSRFToken": decodeURIComponent(csrf),
    },
    body: body === undefined ? undefined : form ? body : JSON.stringify(body),
  });
  if (response.status === 204) return null;
  const data = await response
    .json()
    .catch(() => ({ detail: "Der Dienst ist gerade nicht erreichbar." }));
  if (!response.ok) {
    const message = Object.entries(data)
      .map(
        ([key, value]) =>
          `${key === "detail" || key === "conflicts" ? "" : (labels[key] || key) + ": "}${Array.isArray(value) ? value.join("\n") : typeof value === "object" ? JSON.stringify(value) : value}`,
      )
      .join("\n");
    throw new Error(message || "Anfrage fehlgeschlagen.");
  }
  return data;
}
export async function all(resource: string, query = ""): Promise<Row[]> {
  let page = 1,
    rows: Row[] = [];
  while (true) {
    const result = await api(
      `${resource}/?page_size=1000&page=${page}${query ? "&" + query : ""}`,
    );
    rows.push(...result.results);
    if (!result.next) break;
    page++;
  }
  return rows;
}
export const fmt = (iso: string, zone = "Europe/Berlin", format = "HH:mm") =>
  DateTime.fromISO(iso, { zone }).toFormat(format);
export const localInput = (iso: string, zone: string) =>
  iso ? DateTime.fromISO(iso, { zone }).toFormat("yyyy-MM-dd'T'HH:mm") : "";
