Unter Stammdaten wählst du die Datenart und Importieren. Lade dort die CSV-Vorlage und nutze ihre Spalten. Unterstützt werden UTF-8-CSV und XLSX bis 10 MB und 30.000 Zeilen. Erst prüfen, dann übernehmen; bei Fehlern wird nichts übernommen. code ist die stabile Kennung innerhalb der Einrichtung: wiederholte Importe aktualisieren gleiche Kennungen. Beziehungen nutzen Kennungen, Mehrfachzuordnungen trennt |. Abhängigkeiten zuerst: Bereiche → Stockwerke → Räume, Studiengänge → Jahrgänge → Gruppen → Personen, Zeiträume und Planungsbereiche → Pläne → Veranstaltungen. Eine Vorschau verfällt nach einer Stunde oder einer Datenänderung. In der Browser-Demo sind Dateiimporte nicht verfügbar.

![Dateiimporte und Kennungen in der fiktiven Beispieleinrichtung](/api/wiki/assets/imports.png)

## Voraussetzungen und Vorlagen
Öffne unter **Stammdaten** den gewünschten Datentyp und die Importansicht. Lade die dort angebotene CSV-Vorlage herunter. Verwende deren Spalten statt selbst erfundener Feldnamen.
Unterstützt werden UTF-8-CSV und XLSX bis 10 MB und 30.000 Zeilen pro Datei. Die echte Importfunktion benötigt das Backend und ist in der öffentlichen Demo nicht verfügbar.
## Prüfen und übernehmen
1. Fülle die Vorlage und verwende stabile Kennungen in der Spalte `code`.
2. Importiere zuerst abhängige Stammdaten: Bereiche → Stockwerke → Räume sowie Studiengänge → Jahrgänge → Gruppen → Personen.
3. Wähle die Datei und starte die Prüfung.
4. Korrigiere alle gemeldeten Fehler in der Datei und prüfe erneut.
5. Übernimm nur die erfolgreich geprüfte Vorschau.
## Formatregeln
| Angabe | Format / Beispiel |
|---|---|
| Beziehungen | Kennungen statt interner IDs |
| Mehrfachzuordnung | `A1|A2` |
| Ausstattung als Liste | `["Beamer","PC"]` |
| Datum | `2027-10-01` |
| Uhrzeit | `09:00` |
| Zeitpunkt mit Zeitzone | `2027-10-01T09:00:00+02:00` |
| Wahr/Falsch | `true/false`, `1/0` oder `ja/nein` |
## Aktualisieren und Gültigkeit
Ein erneuter Import mit derselben Kennung aktualisiert den bestehenden Datensatz innerhalb der Einrichtung. Prüfvorschauen sind an Benutzer und Einrichtung gebunden. Sie verfallen nach einer Stunde oder nach einer Datenänderung. Bei Fehlern wird kein Datensatz übernommen.
## Fertig, wenn
Die Übernahme war erfolgreich und die gespeicherten Datensätze haben die gewünschten Beziehungen. Ein gültiger Import ersetzt nicht die fachliche Kontrolle der Ausgangsdatei.
