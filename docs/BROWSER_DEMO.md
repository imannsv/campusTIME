# Browser-Demo auf Vercel

Die separate [Studierendenübersicht](STUDENT_OVERVIEW.md) unter
`/overview/<token>` unterstützt Jahrgangs-, Gruppen- und Kursfilter,
Wochennavigation und teilbare Links. Auf Handys erscheint eine Terminliste.
Die Filter gelten ausschließlich dort; Bildschirm-Anzeigen behalten ihre
fest eingestellte Woche-/Heute-/Morgen-Ansicht.

Für den vorläufigen Produkttest baut Vercel mit `npm run build:demo`.
Diese Variante benötigt keinen Server und greift nicht auf Supabase zu.
Sie wird sichtbar als Demo gekennzeichnet und öffnet ohne Anmeldung.
Es gibt keine echte Benutzer- oder Zugriffsverwaltung.

Die Demo enthält ausschließlich generierte Beispieldaten: 8 Jahrgänge,
8 veröffentlichte Beispielpläne, 262 Lernende, 16 Prüfungen und 14 Räume.
`scripts/build-demo-data.py` erstellt diese in einer separaten temporären
Datenbank und liest niemals die bestehende lokale Produktdatenbank aus.
Die Beispieldaten werden beim ersten Öffnen um ganze Wochen verschoben,
damit die Kalenderansicht zur aktuellen Woche passt.

## Testbare Funktionen

- campusAI-Schnellhilfe und einfache Planungshinweise aus den Demo-Daten; kein Sprachmodell verbunden. [Umfang und lokaler Betrieb](CAMPUS_AI.md).
- Geführte Einrichtung, versionierte Studienstrukturen, Module/Teilmodule und Credit Points pflegen.
- Lehrplanversionen prüfen, freigeben, kopieren und passende Semesterveranstaltungen übernehmen.
- Prüfungsanforderungen als Semester-Vorlagen übernehmen, konkrete Prüfungen daraus anlegen und interne Abgabefristen pflegen: [Ablauf](ASSESSMENT_WORKFLOW.md).
- Jahrgangsverläufe separat verschieben, Semesterbelastung prüfen und Ausgleichsvorschläge mit Voraussetzungen und Fixierungen testen.
- Lehrende mit mehreren Zeitfenstern pro Wochentag und datierten Sperrzeiten pflegen.
- Stundenpläne, Jahrgänge, Gruppen, Kurse und Prüfungen ansehen.
- Bereiche, Stockwerke, Raumkacheln, Kapazitäten und Ausstattung pflegen.
- Datensätze und einzelne Termine anlegen, bearbeiten und löschen.
- Raumblockierungen und öffentliche Woche-/Heute-/Morgen-Anzeigen testen. Jeder Anzeigelink bleibt fest beim in der Verwaltung gewählten Zeitraum; Besucher können diesen nicht umschalten.
- Demoanzeigen mit dem aktuellen Entwurf im selben Browser aktualisieren.
- Änderungen nach Neuladen behalten oder über **Demo zurücksetzen** verwerfen.

Änderungen liegen nur in `localStorage` auf diesem Browserprofil und dieser
Domain. Sie werden nicht zwischen Geräten oder Nutzern synchronisiert.
Ein Anzeigelink auf einem anderen Gerät startet mit den dortigen Beispieldaten.
Private Browserfenster oder gelöschte Browserdaten behalten keine Änderungen.
Keine echten personenbezogenen Daten in diese öffentliche Demo eingeben.

Die Demo prüft einfache Überschneidungen und Raumkapazitäten. Sie ersetzt
nicht die vollständige Django-Prüfung von Unterrichtssoll, Verfügbarkeiten,
Prüfungsregeln und Raumaufteilungen. Automatische Planung, die ältere Übernahme
aus einfachen Lehrplanvorlagen (`curricula`),
Wiederholungsserien für Termine, Dateiimporte und Betriebsverwaltung benötigen
das echte Backend. Die entsprechenden Hauptaktionen sind deaktiviert;
weitergehende API-Aufrufe melden die Einschränkung ausdrücklich.

## Lokal prüfen

```powershell
npm.cmd test
```

Playwright baut dafür eine eigene Demo unter `.playwright/demo`, startet die
fertige Vorschau auf Port 5175, wartet auf Erreichbarkeit und beendet sie nach
dem Testlauf. Ein manuell gestarteter Entwicklungsserver ist nicht erforderlich.
Ein bereits belegter Testport wird ausdrücklich abgelehnt. Der reguläre Build
unter `dist` und die lokalen LFH-Daten bleiben unberührt. Screenshots
fehlgeschlagener Tests liegen unter `test-results`. Für eine gezielte
Diagnose aktiviert `$env:CAMPUS_TEST_TRACE = '1'` zusätzlich Traces;
danach mit `Remove-Item Env:CAMPUS_TEST_TRACE` wieder deaktivieren.

Eine bereits laufende Demo lässt sich weiterhin ausdrücklich verwenden:

```powershell
$env:DEMO_TEST_URL = 'http://127.0.0.1:4173'
npm.cmd test
Remove-Item Env:DEMO_TEST_URL
```

Die Demotests sperren Backend-Anfragen und prüfen Raumänderungen einschließlich
Persistenz, Stockwerkfilter, Zurücksetzen, mobile Breite und feste Anzeigezeiträume.
Die Tests gegen das echte lokale Django-Backend benötigen laufende Server auf
Port 5173 und 8000 und werden ausdrücklich aktiviert. Diese Tests legen Daten
in der angeschlossenen Einrichtung an und löschen ihre Testeinträge wieder:

```powershell
$env:CAMPUS_TEST_MODE = 'platform'
npm.cmd test
Remove-Item Env:CAMPUS_TEST_MODE
```

`PLANNING_API_TEST_URL` wählt weiterhin die API-Fixture-Tests.
`npm run build` baut weiterhin die reguläre Variante.

## Später auf echten Betrieb wechseln

Nach Einrichtung eines Backends `deploy/vercel.example.json` mit dessen
tatsächlicher HTTPS-Adresse als `vercel.json` übernehmen. Das Beispiel verwendet
wieder `npm run build` statt `npm run build:demo`. Browser-Demodaten werden
dadurch nicht automatisch in die echte Datenbank übernommen. Für diesen
Wechsel API-Erreichbarkeit und echte Anmeldung gesondert testen.
