# Verifikation der ersten Version

Geprüft am 03.10.2026 im lokalen Arbeitsbereich.

| Prüfung | Ergebnis |
| --- | --- |
| Django-Systemprüfung und unveränderte Migrationen | Bestanden |
| Ruff | Bestanden |
| TypeScript und Vite-Produktionsbuild | Bestanden |
| 22 Backendtests mit SQLite | Bestanden |
| Dieselben 22 Tests mit PostgreSQL 17 und Redis | Bestanden |
| 2 Playwright-Browsertests, Desktop und Mobilansicht | Bestanden |
| Docker-Image für Linux | Erfolgreich gebaut |
| Echter Redis/Celery-Planungsauftrag | 26 gültige Termine; Vorschlag nicht übernommen |
| PostgreSQL-Backup und Wiederherstellung in separater Testdatenbank | Erfolgreich; 26 Termine wiederhergestellt |
| Synthetischer Teilplan, 30.000 erfasste / 6.000 aktive Lernende | 100 Termine, keine Konflikte, etwa 15 Sekunden |
| Synthetischer Teilplan mit überlappenden Gruppen, 30.000 erfasste / 3.030 aktive Lernende | 100 Termine, keine Konflikte, etwa 20 Sekunden |

Die Lasttests verwendeten 100 Veranstaltungen, 20 Räume und 16 Lehrende in einer Woche sowie ein 20-Sekunden-Budget. Beide lieferten eine geprüfte Startlösung; im Testlimit verbesserte CP-SAT diese Lösung nicht weiter. Daraus lässt sich keine Laufzeitgarantie für ganze Hochschulen oder realistische Semester mit komplexer Kurswahl ableiten.

Die Browserprüfung deckt Anmeldung, Wochenkalender, Datenpflege mit Anlegen/Löschen, Raumdetails, öffentliche Anzeige und die mobile Navigation ab. Backendtests prüfen zusätzlich Mandantentrennung, CSRF, Lizenzablauf, Importvorschau/Übernahme, Freigaberegeln, unveränderliche Veröffentlichungen, Sperrhinweise, Wahlpflichtteilnehmer, gemeinsame Veranstaltungen, fixierte Termine, Mehrtagesblöcke, unterschiedliche Lehrendenteams und Mehrraumprüfungen.

Temporäre PostgreSQL-, Redis-, Worker- und Backupcontainer sowie deren Testvolumes wurden nach der Prüfung entfernt. Die lokale Demoeinrichtung bleibt in SQLite verfügbar.

Die frühere Kartenoberfläche wurde inzwischen durch Raumkacheln ersetzt; die Kartenbibliothek ist entfernt. Die zugehörige frühere Größenwarnung entfällt.

## Ergänzung: Tagesanzeigen und Produkttestdaten

Ebenfalls am 03.10.2026 geprüft:

- 29 Backendtests mit SQLite und dieselben 29 Tests mit PostgreSQL 17 bestanden.
- Tagesanzeigen prüfen gespeicherte Vorgaben und feste Anzeigezeiträume, Mitternacht, leere Tage, Einrichtungszeitzone, Zeitumstellung und Jahreswechsel.
- Die Erweiterung enthält 8 veröffentlichte Pläne, 7 Jahrgänge, 262 Lernende, 18 Lehrende, 52 Veranstaltungen, 16 Prüfungen und 246 Termine. Alle Pläne wurden nach Veröffentlichung gemeinsam erneut auf Konflikte und Soll geprüft.
- Der Zusatzdatenbefehl ist idempotent; bestehende Daten werden nicht überschrieben. Mehrraumklausur und Nachschreibeklausuren sind enthalten.
- PostgreSQL-Migrationen mit privatem Schema erzeugten 42 Tabellen in `campustime` und keine in `public`. Dieser Test nutzte einen eigenen temporären lokalen Container, keine Cloud-Datenbank. Der Container wurde anschließend entfernt.
- Alle 3 Playwright-Browsertests bestanden. Der zusätzliche Test prüft Anlegen/Speichern einer Tagesanzeige, Heute/Morgen/Woche sowie mobile Breite und räumt seine Daten wieder auf. TypeScript, Vite-Build, Ruff und Django-System-/Migrationsprüfung bestanden.
- Die gemeinsame Wochenanzeige wurde zusätzlich mit 76 sichtbaren Terminen geprüft; bei vielen parallelen Veranstaltungen verwendet sie lesbare Terminkarten.

Die zugehörigen Testwege stehen in `PRODUCT_TEST.md`. Der Quellcode wird über `imannsv/campusTIME` auf `main` bereitgestellt; die lokale Vercel-Zuordnung und die Vite-Buildkonfiguration sind eingerichtet. Eine vollständige Cloud-Bereitstellung einschließlich Backend und eine echte Supabase-Datenbankverbindung wurden noch nicht ausgeführt, siehe `CLOUD.md`. Docker-/Worker-/Backupmessungen oben beziehen sich auf die zuvor geprüfte erste Version.

## Ergänzung: Raumkacheln und Browser-Demo

Am 03.10.2026 nach dem Umbau geprüft:

- 29 Backendtests mit SQLite bestanden, einschließlich fester Anzeigezeiträume,
  Mitternachtswechsel, Zeitzone und Zeitumstellung. Besucherparameter können
  den gespeicherten Zeitraum nicht ändern. PostgreSQL wurde bei diesem Umbau
  nicht erneut getestet; die früheren Ergebnisse stehen oben.
- Vier lokale Playwrighttests bestanden: Datenpflege, Bereiche/Stockwerke/Räume,
  Kapazität, Suche, mobile Darstellung sowie gespeicherte Anzeigen, deren
  Zeitraum ausschließlich die Verwaltung ändert.
- Zwei Playwrighttests gegen den Demo-Build bestanden: keine Backend-Anfragen,
  Raumänderungen nach Neuladen, Zurücksetzen, Stockwerkfilter, mobile Breite und
  feste Woche-/Heute-/Morgen-Anzeigen.
- TypeScript, regulärer Vite-Build, Demo-Build, Ruff und `git diff --check`
  bestanden. Die entfernte Kartenbibliothek wird nicht mehr ausgeliefert.

Die Browser-Demo ist kein Nachweis für produktiven Mehrbenutzerbetrieb,
Anmeldung, automatische Planung oder vollständige Freigabeprüfung. Diese
Funktionen benötigen weiterhin das Django-Backend; siehe `BROWSER_DEMO.md`.
