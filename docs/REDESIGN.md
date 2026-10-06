# CampusZeit – Designvorlage, Meilenstein 1

Branch: `codex/redesign-campuszeit`, ausgehend von `main`.

## Stand

Die gemeinsame Navigation sowie Stundenplanung und Raumverwaltung bilden die
erste umgesetzte Designvorlage. Die vollständige Übertragung auf die weiteren
Ansichten folgt laut vereinbartem Plan nach einer gemeinsamen Designprüfung.

Das ursprüngliche Logo bleibt erhalten: Symbol, Farben, Manrope-Schrift,
Schriftgewicht, Abstände und Proportionen. Die Bedienoberfläche verwendet DM Sans.

### Gemeinsame Oberfläche

- Farben, Abstände und Radien in `src/workspace.css`.
- Nach Aufgaben gruppierte Seitenleiste mit 232/64 px Breite und mobilem Menü.
- `PageHeader`, `ActionMenu` und `DetailPanel` in `src/WorkspaceUI.tsx`.
- Detailbereich ab 1440 px als 420 px breiter Dock; darunter als Dialog,
  auf schmalen Geräten bildschirmfüllend. Lesen und Bearbeiten sind getrennt.
- RecordForm schützt geänderte Eingaben beim Schließen, Wechseln und Verlassen
  des Browsers. Native Feldfehler und vom vorhandenen API formatierte Feldfehler
  erscheinen am betreffenden Feld; allgemeine Fehler bleiben sichtbar.
- Formularüberschrift und Speicheraktionen bleiben erreichbar, Fokus und Escape
  werden im Dialog verwaltet. Ein offener Editor minimiert Freddy und erhält den
  Chatverlauf. Blobatar und Blickbewegung bleiben erhalten.

### Stundenplanung

- Kompakte Termin-, Hinweis- und Veröffentlichungszeile.
- Planwahl und Aktionen getrennt von Wochennavigation und Filtern.
- Lehrplanübernahme und Planungsstatus im Menü „Weitere Aktionen“.
- Kalender füllt den verfügbaren Arbeitsbereich, mit eigenen Scrollflächen und
  haftender Tagesüberschrift. Parallele Karten haben mindestens 180 px nutzbare
  Breite. Keine Verkleinerung der Titelschrift zur Platzgewinnung.
- Karten priorisieren Zeit, Titel und Raum; vollständige Angaben in Vorschau und
  Detailbereich. Kurze Termine erhalten eine passende kompakte Darstellung.
- Unter 768 px chronologische Wochenliste; Navigation mit „Diese Woche“.
- Beim normalen Öffnen erscheint die aktuelle Woche in der Zeitzone der
  Einrichtung. Die dünne rote Zeitlinie aktualisiert sich regelmäßig.
  „Jetzt folgen“ hält sie im sichtbaren Ausschnitt und kann zum freien Planen
  ausgeschaltet werden. „Diese Woche“ aktiviert die Verfolgung wieder.
  Außerhalb der Unterrichtszeiten wird nur die sichtbare Zeitachse erweitert;
  Planungszeiten und Daten bleiben gleich. Explizit aus der Studienstruktur
  geöffnete künftige Semester behalten ihren zugehörigen Zeitraum.

### Räume

- Hauptaktion „Raum hinzufügen“, Strukturaktionen im beschrifteten Menü.
- Bereich, Stockwerk und Suche getrennt; Raumkacheln mit vorhandenen Namen,
  Kapazität und Ausstattung.
- Details, veröffentlichte Belegung, Bearbeitung und Raumblockierung im Panel.

## Prüfung

Die QA verwendet die isolierte Browser-Demo, nicht den LFH-Datenbestand.

```powershell
npm.cmd run dev -- --mode demo --host 127.0.0.1 --port 5174 --strictPort
# In einem zweiten Terminal:
$env:DEMO_TEST_URL = 'http://127.0.0.1:5174'
npm.cmd test
Remove-Item Env:DEMO_TEST_URL
node --test tests/timetable-layout.test.ts
npm.cmd run build
npm.cmd run build:demo
```

Geprüft wurden:

- 390, 768, 1280, 1440 und 1920 px; zusätzlich Reflow bei 640 × 450 CSS-Pixeln
  als Entsprechung eines 1280 × 900-Fensters bei 200 % Zoom.
- Sechs Unterrichtstage, vier parallele Veranstaltungen, lange Raum- und
  Veranstaltungstitel, ein 15-Minuten-Termin und haftende Tagesüberschrift.
- Angedockte und mobile Bearbeitung, Speichern, Abbrechen, Verwerfen, blockierter
  Seitenwechsel mit ungespeicherten Eingaben und feldbezogene Validierung.
- Fokus, Escape, mobile Menütastatur, Suchshortcut im Dialog und reduzierte Bewegung.
- Bestehende Studienstruktur-, Jahrgangsverlaufs-, Prüfungs- und Freddy-Abläufe
  sowie feste Anzeigezeiträume und teilbare Studierendenfilter in der Demo.
- Vier bestehende Kalender-Layouttests, regulärer Build und Demo-Build.

Die Browserprüfungen erzeugen Ansichtsaufnahmen unter `test-results/`.
Echtes Browser-Chrome-Zoom und produktive Backend-Abläufe sind durch diese
isolierte Demo-QA nicht abgedeckt.

## Nächster Meilenstein nach Designprüfung

Prüfungen, Studienstruktur, Stammdaten, öffentliche Ansichten, Anmeldung und
Einstellungen erhalten die vollständigen Arbeitslayouts derselben Vorlage.
Sie verwenden bereits die gemeinsamen Grundlagen und behalten ihre bisherigen
Funktionen. Ihre vollständige Layoutüberarbeitung ist noch offen.

Backend-APIs, Datenmodelle und Datenbestände werden für diese Designänderung nicht
geändert. Interne Seitenkennungen, Freddy-Aktionen und öffentliche Filterlinks
bleiben kompatibel. `main` und Jakobs `landingpage` werden nicht verändert.
