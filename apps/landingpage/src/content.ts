import type { IconName } from "./Icon";

export const features: { title: string; text: string; icon: IconName }[] = [
  {
    title: "Räume, die zur Veranstaltung passen",
    text: "Bereiche, Stockwerke und Räume mit Kapazität, Ausstattung und Belegung. Sperrzeiten fließen in die Planung ein.",
    icon: "room",
  },
  {
    title: "Lehrpläne mit klarer Struktur",
    text: "Module, Teilmodule und Semester in versionierten Lehrplänen. Credit Points und Unterrichtsumfang werden getrennt erfasst.",
    icon: "book",
  },
  {
    title: "Jahrgänge und Gruppen zusammenführen",
    text: "Mehrere Gruppen pro Jahrgang, gemeinsame Veranstaltungen, konkrete Wahlpflichtteilnehmer und mehrere Lehrende.",
    icon: "people",
  },
  {
    title: "Änderungen nachvollziehbar planen",
    text: "Module für einen Jahrgang verschieben, Voraussetzungen prüfen und die Semesterbelastung ausgleichen.",
    icon: "calendar",
  },
  {
    title: "Prüfungen und Fristen im Blick",
    text: "Prüfungsformen aus dem Lehrplan übernehmen. Klausuren, Nachschreiber, Räume und Aufsichten planen; Abgabefristen intern pflegen.",
    icon: "exam",
  },
  {
    title: "Freigegebene Pläne teilen",
    text: "Anzeigen für Woche, heute oder morgen. Dazu eine separate Studierendenübersicht mit Jahrgangs-, Gruppen- und Kursfiltern.",
    icon: "screen",
  },
];

export const steps = [
  {
    title: "Grundlagen einrichten",
    text: "Räume, Lehrende und Verfügbarkeiten erfassen. Studien- oder Bildungsgänge, Lehrpläne und Jahrgänge zuordnen.",
  },
  {
    title: "Veranstaltungen vorbereiten",
    text: "Semesterangebote übernehmen, Gruppen verbinden und Unterrichtsumfang sowie Prüfungsanforderungen festlegen.",
  },
  {
    title: "Planen und prüfen",
    text: "Termine manuell setzen oder einen automatischen Vorschlag berechnen. Konflikte prüfen und den passenden Vorschlag übernehmen.",
  },
  {
    title: "Veröffentlichen und teilen",
    text: "Den geprüften Plan freigeben. Bildschirmanzeigen und Studierendenübersicht zeigen anschließend den veröffentlichten Stand.",
  },
];

export const faq = [
  {
    question: "Wie richte ich meine Einrichtung ein?",
    answer:
      "Die geführte Einrichtung beginnt mit Räumen und Lehrenden. Danach folgen Studien- oder Bildungsgänge, Lehrplanversionen, Jahrgänge und Semesterpläne. Stammdaten können im Backend auch nach vorheriger Prüfung per CSV oder XLSX importiert werden.",
  },
  {
    question: "Plant CampusZeit automatisch?",
    answer:
      "Mit dem Backend berechnet CampusZeit Vorschläge für Unterricht und Prüfungen. Verfügbarkeiten, Kapazitäten, Ausstattung, fixierte Termine und weitere Planungsregeln werden berücksichtigt. Sie prüfen den Vorschlag und übernehmen ihn selbst. Eine gültige Lösung ist bei widersprüchlichen Vorgaben nicht garantiert.",
  },
  {
    question: "Was passiert, wenn sich der Plan ändert?",
    answer:
      "Sie bearbeiten zunächst den Entwurf. Veröffentlichte Ansichten bleiben beim freigegebenen Stand, bis Sie erneut veröffentlichen. Raumblockierungen werden als Sperrhinweise sichtbar. Vorschläge aus einer Berechnung können nach zwischenzeitlichen Datenänderungen nicht übernommen werden.",
  },
  {
    question: "Wie werden Räume und Verfügbarkeiten berücksichtigt?",
    answer:
      "Die Verwaltung pflegt Kapazitäten, Ausstattung, Raumblockierungen und die Zeitfenster der Lehrenden. Vor Veröffentlichung prüft CampusZeit auch Überschneidungen mit anderen freigegebenen Planbereichen derselben Einrichtung. Noch unbekannte Raumkapazitäten müssen vor der Planung ergänzt werden.",
  },
  {
    question: "Welche Prüfungen und Abgaben lassen sich verwalten?",
    answer:
      "Prüfungsanforderungen lassen sich aus Modulen in den Semesterplan übernehmen. Daraus entstehen konkrete Klausuren, mündliche oder praktische Prüfungen und Präsentationen. Nachschreibeklausuren haben eigene Teilnehmerlisten; Hausarbeiten und andere Abgaben interne Fristen. Abgabefristen erscheinen derzeit nicht in öffentlichen Ansichten.",
  },
  {
    question: "Was sehen Studierende und öffentliche Anzeigen?",
    answer:
      "Öffentliche Links zeigen ausschließlich freigegebene Planversionen. Bildschirmanzeigen haben einen festgelegten Zeitraum: Woche, heute oder morgen. Die separate Studierendenübersicht bietet Wochenwechsel und Filter. Einzelne Lernendennamen und Teilnehmerlisten werden nicht ausgeliefert; persönliche Lernendenkonten sind noch nicht enthalten.",
  },
  {
    question: "Was kann ich in der Browser-Demo ausprobieren?",
    answer:
      "Sie können die Oberfläche, Studienstruktur, Räume, Beispielpläne und öffentliche Ansichten mit fiktiven Daten ausprobieren. Änderungen bleiben nur im jeweiligen Browserprofil. Automatische Planung und Dateiimporte benötigen das Backend. Die Demo bietet keine echte Anmeldung oder gemeinsame Speicherung zwischen Geräten.",
  },
  {
    question: "Wie unterstützen Freddy und CampusAI?",
    answer:
      "Freddy erklärt Funktionen, zeigt kontextbezogene Hinweise und öffnet passende Ansichten oder ungespeicherte Formulare. Speichern und Freigeben erfolgen über die regulären Eingaben. Optional formuliert ein lokales Ollama-Modell Antworten; diese können Fehler enthalten. Die Browser-Demo bietet die Schnellhilfe ohne Sprachmodell.",
  },
];
