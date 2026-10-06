# Aktuelle Woche und Zeitlinie

Die Anwendung verwendet wieder das ursprüngliche Design vor dem Redesign.
Farben, Logo, Navigation, Raumansicht, Kalenderkarten und Formulare sind aus
dem Stand `5bafe35` wiederhergestellt.

Die Stundenplanung öffnet beim normalen Einstieg die aktuelle Woche in der
Zeitzone der Einrichtung. Eine dünne rote Linie zeigt die aktuelle Uhrzeit.
„Jetzt folgen“ hält sie im sichtbaren Ausschnitt und kann zum freien Planen
ausgeschaltet werden. „Diese Woche“ aktiviert die Verfolgung wieder.

Die Anzeige aktualisiert sich regelmäßig sowie beim Zurückkehren zum Tab.
Beim Wochenwechsel folgt eine auf die aktuelle Woche eingestellte Ansicht
automatisch. Die sichtbare Zeitachse kann außerhalb der Unterrichtszeiten
erweitert werden; konfigurierte Planungszeiten bleiben erhalten.

Explizit geöffnete künftige Semester behalten ihren Zeitraum. Öffentliche
Anzeigen behalten die fest konfigurierte Woche-, Heute- oder Morgen-Ansicht.

QA läuft mit isolierten Browser-Demodaten:

```powershell
$env:DEMO_TEST_URL = 'http://127.0.0.1:5174'
npm.cmd test
Remove-Item Env:DEMO_TEST_URL
node --test tests/timetable-layout.test.ts
npm.cmd run build
npm.cmd run build:demo
```
