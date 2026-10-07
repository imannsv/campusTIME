# Planungszentrale

Die Stundenplanung zeigt den Wochenplan und einen dauerhaften Detailbereich
nebeneinander. Die bestehenden Produktfarben und das Logo bleiben erhalten.
Die Umsetzung baut auf `codex/redesign-campuszeit` auf; aktuelle Zeitanzeige und
einklappbare Navigation bleiben verfügbar.

## Terminbearbeitung

- Ein Kalendertermin öffnet das bestehende Formular rechts, ohne Hintergrundsperre.
  Der gewählte Termin erhält eine Umrandung. Filter und Wochennavigation bleiben
  bedienbar, während die Eingaben im Editor erhalten bleiben.
- Die automatische Zeitnavigation pausiert während der Bearbeitung, damit das
  Formular auch auf dem Mobilgerät im Blick bleibt. Die Uhrzeitlinie wird weiter
  aktualisiert; nach dem Schließen gilt wieder die zuvor gewählte Navigation.
- Sämtliche schemaabhängigen Felder bleiben verfügbar, einschließlich Prüfungen,
  Stundenplan, Räume, Lehrpersonen, Fixierung und Wiederholungen. Häufig verwendete
  Felder stehen zuerst. Speichern, Löschen und Validierung nutzen dieselbe API wie
  die bisherigen Formulare.
- Terminwechsel, Seitenwechsel, Planwechsel, Abmelden, Demo-Zurücksetzen und
  Schließen fragen vor dem Verwerfen geänderter Eingaben nach. Während eines
  Speichervorgangs bleiben die Felder gesperrt. Beim Verlassen des Browserdokuments
  greift die Browserwarnung für ungespeicherte Eingaben.
- Unter 1101 Pixeln steht der geöffnete Editor über dem Kalender. Tastaturfokus
  wechselt zum Editor; Escape oder Abbrechen schließen ihn und geben den Fokus
  an den auslösenden Termin zurück. Unabhängige Formulare bleiben modale Dialoge.
- Einzelne Termine nutzen kompaktere Tagesbreiten. Parallele Termine behalten ihre
  Mindestbreite; bei Bedarf scrollt nur der Kalender horizontal.

## Prüfung

`npm run build` prüft TypeScript und erstellt die Anwendung mit API-Anbindung.
`npm run build:demo` erstellt die Browser-Demo.

Für die bestehenden Demo-Tests einschließlich vier neuer Editor-Tests:

```powershell
npm run dev -- --mode demo --port 5174
# In einem zweiten Terminal:
$env:DEMO_TEST_URL = 'http://127.0.0.1:5174'
npm test
```

Zwei zusätzliche Tests prüfen die normale HTTP-Anbindung mit kontrollierten
API-Antworten: Abmelden mit ungespeicherten Eingaben, erneutes Anmelden und
ein absichtlich verzögerter Speichervorgang. Es werden keine echten Zugangsdaten
oder Einrichtungsdaten verwendet.

```powershell
npm run build
npm run preview -- --port 5175
# In einem zweiten Terminal:
$env:PLANNING_API_TEST_URL = 'http://127.0.0.1:5175'
npm test
```

Ohne diese Umgebungsvariablen bleibt die vorhandene Backend-Testsuite ausgewählt.
