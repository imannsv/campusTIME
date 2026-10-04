# Campuszeit

Ausführbare Stundenplanplattform für Schulen und Hochschulen. React/TypeScript im Browser, Django REST Framework als Backend, PostgreSQL für den Betrieb, OR-Tools CP-SAT für Unterrichts- und Prüfungsplanung.

## Vorläufige Vercel-Demo

Auf [campustime-flame.vercel.app](https://campustime-flame.vercel.app) ist eine
interaktive Browser-Demo mit fiktiven Produkttestdaten verfügbar.
`vercel.json` baut dafür mit `npm run build:demo`. Änderungen bleiben nur im
jeweiligen Browser; automatische Planung und Dateiimporte benötigen weiterhin
das lokale Backend. Umfang, Grenzen und Testbefehle: [Browser-Demo](docs/BROWSER_DEMO.md).

## Lokal starten (Windows)

Voraussetzungen: Python 3.12+ und Node.js 24. Im Projektverzeichnis:

```powershell
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
npm.cmd ci
.\.venv\Scripts\python.exe backend/manage.py migrate
.\.venv\Scripts\python.exe backend/manage.py seed_demo --password 'Campuszeit2026!'
.\.venv\Scripts\python.exe backend/manage.py seed_showcase
.\.venv\Scripts\python.exe backend/manage.py runserver 127.0.0.1:8000
```

In einem zweiten Terminal:

```powershell
npm.cmd run dev
```

Öffnen: **http://127.0.0.1:5173**. Demozugang: **verwaltung / Campuszeit2026!**. Demodaten werden nur im Entwicklungsmodus und nur einmal angelegt. Lokale Daten liegen in `backend/db.sqlite3`; Dateien in `backend/media`. Das Demo-Passwort ist ausschließlich für diese lokale Beispieleinrichtung vorgesehen.

Für den umfangreichen Produkttest anschließend `seed_showcase` ausführen. Dieser ergänzt 7 Jahrgänge, insgesamt 8 veröffentlichte Pläne, 262 Lernende, 16 Prüfungen und Tagesanzeigen. Umfang und Testwege: [Produkttest](docs/PRODUCT_TEST.md).

Alternativ `npm.cmd run build` ausführen und die vollständige Anwendung über http://127.0.0.1:8000 öffnen. Ohne Redis nutzt die lokale Entwicklung einen Hintergrundthread; im Dockerbetrieb werden Celery-Worker verwendet.

## Geführte Einrichtung

Unter **Einrichtung & Studienstruktur**: Räume → Lehrende → Studiengänge →
Studienstruktur → Jahrgänge → Semester planen. Versionierte Lehrpläne enthalten
Module, Teilmodule, Credit Points und semesterbezogene Lehrveranstaltungen.
Die Studienverwaltung pflegt mehrere Verfügbarkeitsfenster je Lehrendem.
Details und Grenzen: [Studienstruktur](docs/STUDY_WORKFLOW.md).

Jahrgänge können eigene Semesterverteilungen erhalten. **Studienverlauf und
Semesterbelastung** prüft Voraussetzungen und Lastgrenzen, erlaubt fixierte
Verschiebungen und zeigt Ausgleichsvorschläge vor der Übernahme.

Das zusätzliche fiktive Beispiel wird lokal mit
`.\.venv\Scripts\python.exe backend/manage.py seed_study` nach den Migrationen
angelegt. Es enthält sechs Semester, 180 CP und Jahrgang dWI27.

## Bedienung

Das **campusAI-Chat-Icon unten rechts** öffnet Bedienhilfe und aktuelle Planungshinweise.
Optional kann ein eigenes lokales Sprachmodell über Ollama Fragen formuliert
beantworten, ohne kostenpflichtige Modell-API. Auf Vercel steht die Schnellhilfe
zur Verfügung. Einrichtung, Datenschutz und Grenzen: [campusAI](docs/CAMPUS_AI.md).

1. Unter **Stammdaten** Zeiträume, Planbereiche, Studien-/Bildungsgänge, Jahrgänge und Gruppen anlegen. Für Räume zuerst einen Raumbereich und ein Stockwerk anlegen.
2. Personen mit Gruppen und Kursen verbinden. Lehrende als solche kennzeichnen und Verfügbarkeiten hinterlegen. Bei vollständigen Klassenlisten werden Teilnehmerzahlen aus eindeutigen Personen berechnet; noch fehlende Klassenmitglieder werden über die Gruppengröße berücksichtigt.
3. Einen Stundenplan für Planbereich und Zeitraum anlegen. Veranstaltungen manuell pflegen oder eine Lehrplanvorlage übernehmen. Vorlagen werden kopiert, nicht nachträglich mit bestehenden Plänen synchronisiert.
4. Soll als Unterrichtseinheiten je Woche oder im gesamten Zeitraum definieren. Die Einrichtung bestimmt die Minutenzahl einer Einheit. `Termindauer` bestimmt die Aufteilung des Solls. Für Mehrtagesblöcke Gesamtumfang und Blocktage einstellen; jeder vollständige Block findet an aufeinanderfolgenden Tagen zur gleichen Uhrzeit statt.
5. Bei Wahlpflichtkursen konkrete Teilnehmer auswählen. Bei gemeinsamen Veranstaltungen mehrere Gruppen auswählen. Lehrende entweder gemeinsam zuordnen oder Teams für die chronologische Terminfolge festlegen.
6. **Automatisch planen** erzeugt einen prüfbaren Vorschlag. **Übernehmen** ersetzt den Entwurf. Fixierte Termine bleiben erhalten. Datenänderungen während einer Berechnung verhindern die Übernahme veralteter Ergebnisse.
7. **Veröffentlichen** prüft den gesamten Plan einschließlich Soll und anderer veröffentlichter Planbereiche erneut. Öffentliche Anzeigen zeigen ausschließlich freigegebene Versionen. Neue Raumblockierungen markieren betroffene veröffentlichte Termine als gesperrt; Terminänderungen benötigen eine neue Freigabe.
8. Unter **Prüfungen** einen Semesterplan auswählen und **Prüfungsanforderungen übernehmen** wählen. Vorlagen kopieren die Modulvorgaben für den Jahrgang; daraus lassen sich Prüfungen mit eigenem Zeitraum, Teilnehmern und Aufsichten anlegen. Hausarbeiten erhalten unter **Abgaben & Fristen** eine interne Abgabefrist. [Ablauf und Grenzen](docs/ASSESSMENT_WORKFLOW.md). Nachschreibeklausuren erhalten ihre eigene Liste. Mehrraumprüfungen teilen die Teilnehmer deterministisch nach Raumkapazität auf; je Raum wird eine Aufsicht zugeordnet. Die Raumaufteilung liegt im internen Planungsergebnis unter `room_allocations`.
9. Unter **Räume** Bereiche und Stockwerke anlegen und vorhandene Raumbezeichnungen verwenden. Raumkacheln zeigen Kapazität und Ausstattung; Raumdetails zeigen freigegebene Belegungen. Bereiche, Stockwerke und Räume lassen sich direkt dort bearbeiten. Geografische Positionen und Grundrisse werden für die Raumplanung nicht benötigt.
10. Unter **Öffentliche Anzeige** Anzeigen mit ausgewählten Plänen und **Anzeigezeitraum: Woche, Heute oder Morgen** anlegen. Der Link funktioniert ohne Anmeldung; Aktualisierung erfolgt alle zehn Sekunden. Tagesanzeigen wechseln automatisch in der Einrichtungszeitzone das Datum. Jeder Anzeigelink bleibt bei seinem fest eingestellten Zeitraum; nur die Verwaltung kann diesen ändern. Scrollen lässt sich konfigurieren und pausieren. Namen/IDs einzelner Lernender werden nie ausgeliefert.
11. Unter **Studierendenübersicht** den separaten Link öffnen oder teilen. Dort Jahrgang, Gruppe/Klasse und Kurs filtern und zwischen Wochen wechseln. Auf Handys erscheinen Termine als Tagesliste. Die Auswahl bleibt im Link erhalten; freigegebene Änderungen werden alle zehn Sekunden geladen. Details: [Studierendenübersicht](docs/STUDENT_OVERVIEW.md).

## Dateiimporte

CSV-Vorlagen stehen direkt in der Importansicht bereit. Unterstützt werden UTF-8-CSV und XLSX, maximal 10 MB und 30.000 Zeilen je Datei. Erst prüfen, dann übernehmen; bei Fehlern wird kein Datensatz übernommen. Vorschauen sind an Benutzer und Einrichtung gebunden und verfallen nach einer Stunde beziehungsweise nach einer Datenänderung.

- `code` ist die stabile Kennung je Datensatz und Einrichtung. Wiederholte Importe aktualisieren diese Einträge.
- Beziehungen verwenden Kennungen, keine internen IDs. Mehrfachzuordnungen werden durch `|` getrennt, beispielsweise `A1|A2`.
- Listen/Objekte verwenden JSON, etwa Ausstattung `["Beamer","PC"]` oder freie Tage `["2026-12-24"]`.
- Daten: `YYYY-MM-DD`; Uhrzeiten: `HH:mm`; Zeitpunkte mit Zeitzone: `2026-10-05T08:00:00+02:00`.
- Boolesche Werte: `true/false`, `1/0` oder `ja/nein`.
- Abhängigkeiten zuerst importieren: Programme → Jahrgänge → Gruppen → Personen; Gebäude → Etagen → Räume; Zeiträume/Planbereiche → Pläne → Veranstaltungen/Prüfungen.

## Tests und Prüfung

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe backend/manage.py test planner
.\.venv\Scripts\ruff.exe check backend
npm.cmd run build
npm.cmd exec playwright install chromium
npm.cmd test
```

Die Browserprüfung benötigt laufende lokale Server, die Zusatzdaten aus `seed_showcase` und den oben beschriebenen Demozugang. Screenshots werden in `test-results` gespeichert. Backendtests nutzen eine eigene Testdatenbank.

```powershell
.\.venv\Scripts\python.exe backend/manage.py benchmark --learners 30000 --courses 100 --seconds 20
.\.venv\Scripts\python.exe backend/manage.py benchmark --learners 30000 --courses 100 --seconds 20 --dense
```

Die Lasttests rollen alle synthetischen Daten zurück. Geprüft wurden 30.000 erfasste Lernende und ein Teilplan mit 100 Veranstaltungen: 6.000 aktive Lernende im ersten Fall, 3.030 mit überlappenden Gruppen im zweiten. Beide lieferten 100 gültige Termine ohne Konflikte in etwa 15 beziehungsweise 20 Sekunden auf der Entwicklungsmaschine. Die Vorschläge stammten aus der geprüften Startlösung; im kurzen Limit fand die weitere Optimierung keine bessere Lösung. Das ist kein Nachweis für beliebig große oder komplexe Semesterpläne.

## Betrieb und Kundenanlage

Siehe [Betriebsanleitung](docs/OPERATIONS.md) für Docker, PostgreSQL, Celery, Kundenanlage, Backups und Wiederherstellungsprüfung. Die interne API ist in [API.md](docs/API.md) beschrieben.

Die Zuordnung zu `imannsv/campusTIME`, `imanabi/campustime` und Supabase sowie die verbleibenden Schritte für den Livebetrieb stehen in [Cloud-Anbindung](docs/CLOUD.md).

## Grenzen der ersten Version

- Konkrete Fremdsystemanbindungen, individuelle Lernendenzugänge mit persönlichen Belegungen, Handy-App, Regelbaukasten und automatische Online-Abrechnung sind wie vereinbart spätere Erweiterungen.
- Die Automatik besitzt ein zehnminütiges Standardbudget und eine Begrenzung auf 500.000 mögliche Startpositionen. Größere Aufgaben müssen in Teilbereiche aufgeteilt werden. Die Oberfläche zeigt Arbeitsstatus statt eines erfundenen Fortschrittsprozentsatzes.
- Fehlerberichte benennen Eingabefehler, Konflikte und offensichtlich fehlende Ressourcen. Bei komplexer Unlösbarkeit gibt es noch keine minimale mathematische Konfliktursache.
- Die Raumverwaltung verwendet Bereiche → Stockwerke → Räume. Bestehende Gebäude-/Etagenzuordnungen bleiben erhalten; alte Geometriefelder sind nur noch zur Datenkompatibilität vorhanden.
- Jede Anmeldung arbeitet zunächst mit der ersten zugeordneten Einrichtung; beim betreuten Start werden separate Konten pro Einrichtung angelegt.
- Ein realer Pilot mit repräsentativen Daten und Abnahme der Betriebsumgebung ist vor einem kommerziellen Rollout erforderlich. Hosting, Domains und externe Überwachung werden durch den Betreiber bereitgestellt.
