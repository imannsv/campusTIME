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
npm.cmd run build:demo
npm.cmd exec vite preview -- --host 127.0.0.1 --port 4173
```

In einem zweiten Terminal:

```powershell
$env:DEMO_TEST_URL = 'http://127.0.0.1:4173'
npm.cmd test
Remove-Item Env:DEMO_TEST_URL
```

Die Demotests sperren Backend-Anfragen und prüfen Raumänderungen einschließlich
Persistenz, Stockwerkfilter, Zurücksetzen, mobile Breite und feste Anzeigezeiträume.
Die regulären lokalen Tests bleiben unter `npm test` mit dem
Django-Backend ausführbar. `npm run build` baut weiterhin die reguläre Variante.

## Später auf echten Betrieb wechseln

Nach Einrichtung eines Backends `deploy/vercel.example.json` mit dessen
tatsächlicher HTTPS-Adresse als `vercel.json` übernehmen. Das Beispiel verwendet
wieder `npm run build` statt `npm run build:demo`. Browser-Demodaten werden
dadurch nicht automatisch in die echte Datenbank übernommen. Für diesen
Wechsel API-Erreichbarkeit und echte Anmeldung gesondert testen.
