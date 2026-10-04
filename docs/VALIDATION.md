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

## Ergänzung: Geführte Einrichtung und Studienstruktur

Am 03.10.2026 geprüft:

- 36 Backendtests mit SQLite bestanden. Neue Tests prüfen CP-Zählung ohne
  Doppelzählung, Modulhierarchie und Voraussetzungen, geschützte freigegebene
  Versionen, Kopien mit eigenen Beziehungen, feste Jahrgangszuordnung,
  Mandantentrennung und wiederholbare Semesterübernahme. Gemeinsame
  Veranstaltungen und getrennte Veranstaltungen je Gruppe sind enthalten.
- Ein echter Planervorschlag für einen neuen Semesterplan liegt vollständig
  innerhalb des von der Verwaltung eingetragenen Zeitfensters. Mehrere
  Verfügbarkeitsfenster, Lücken, datierte Sperren und ungültige Zeiten werden
  zusätzlich geprüft.
- Fünf lokale Playwrighttests und vier Tests gegen den Demo-Build bestanden.
  Der neue Ablauf umfasst Studiengang, Version, Obermodul, zwei Teilmodule in
  unterschiedlichen Semestern, Freigabe, Jahrgang mit zwei Gruppen,
  Studierendenpflege, Kalender mit freiem Tag und wiederholte Semesterübernahme.
  Mobile Breite und Erhalt bestehender Browser-Raumänderungen wurden geprüft.
- Regulärer Build, Demo-Build, Ruff, Django-Systemprüfung, Migrationsprüfung
  und `git diff --check` bestanden. Migrationen 0005 und 0006 wurden lokal
  angewendet; PostgreSQL wurde für diese Erweiterung nicht erneut getestet.

Die Vercel-Ausführung bleibt eine Browser-Demo. Studienstruktur und
Semesterübernahme funktionieren dort mit Browser-Speicherung; Solver und
Dateiimporte benötigen das Backend. Siehe `STUDY_WORKFLOW.md` für den Ablauf
und dessen fachliche Grenzen.

## Ergänzung: Jahrgangsverlauf und Ausgleich

Am 03.10.2026 geprüft:

- 41 Backendtests mit SQLite bestanden. Die fünf neuen Tests prüfen
  Standardverteilung, nur für einen Jahrgang gespeicherte Abweichungen,
  Vorschläge ohne automatische Speicherung, Fixierungen, Voraussetzungsketten
  einschließlich unmöglicher Konstellationen, CP-Anteile ohne Doppelzählung,
  Schwierigkeit, A/B-Wochen, Gesamtumfänge, Grenzen und Mandantentrennung.
- Die Semesterübernahme verwendet die angepassten Semester. Bereits übernommene
  Veranstaltungen sind gegen weitere Semesterwechsel geschützt. Veraltete
  Vorschauen werden bei Prüfung, Vorschlag und Speicherung zurückgewiesen.
- Sechs lokale und fünf Demo-Browsertests prüfen unter anderem das Verschieben
  eines zweisemestrigen Obermoduls auf Semester 4 und 5, anschließenden Ausgleich,
  unmögliche Voraussetzungen, Speichern und Neuladen sowie mobile Breite.
  Alte Browserprofile erhalten die neuen Felder unter Erhalt ihrer Raumänderungen.
- TypeScript, regulärer Build, Demo-Build, Ruff, Django-System- und
  Migrationsprüfung sowie `git diff --check` bestanden. Migration 0007 wurde
  lokal angewendet. PostgreSQL wurde für diese Erweiterung nicht erneut geprüft.

Der Ausgleich ist eine begrenzte Heuristik mit höchstens 10.000 bewerteten
Kandidaten und zwölf Verbesserungsrunden. Er ist kein Nachweis einer optimalen
Verteilung und ersetzt keine fachliche Prüfung. CP-Anteile sind Planungswerte,
keine erreichten Leistungen; Schwierigkeit ist administrativ gepflegt.

## Ergänzung: Separate Studierendenübersicht (04.10.2026)

- 51 Django-Tests bestanden, darunter acht Tests der öffentlichen Übersicht:
  kombinierte Jahrgangs-/Gruppen-/Kursfilter, gemeinsame Veranstaltungen,
  Wahlpflichtangebote, verknüpfte Nachschreibeklausuren, Veröffentlichungsgrenzen,
  leere Zeiträume, ungültige Filter und Raumblockierungen. Die aktualisierte
  Veröffentlichung eines zuvor bearbeiteten Entwurfs wurde zusätzlich geprüft.
- Sieben lokale Browserprüfungen und sechs Demo-Browserprüfungen bestanden.
  Die neue Übersicht wurde ohne Anmeldung, mit direktem geteiltem Link,
  Neuladen, Filterwechsel, Wochenwechsel und auf 390 Pixel Breite geprüft.
  Ein Timer-Test prüft das automatische Nachladen bei erhaltener Auswahl.
- Desktop- und Mobil-Screenshots wurden visuell geprüft. Im mobilen Layout
  werden die Termine als Tagesliste gezeigt, ohne Überbreite der Seite.
- Bestehender Demo-Speicher wird unter Erhalt von Raumänderungen ergänzt.
  Die bestehenden Bildschirmanzeigen behalten ihre festen Anzeigezeiträume.
- TypeScript, normaler Build und Demo-Build bestanden. Migration 0009 wurde
  nach lokalem Datenbankbackup angewendet; alle acht vorhandenen
  Veröffentlichungssnapshots enthalten danach die Filtermetadaten.

Vercel bleibt eine Browser-Demo. Diese Prüfung bestätigt keinen gemeinsamen
Cloud-Datenbestand oder produktiven Mehrbenutzerbetrieb. Der neue Endpunkt
und die Datenmigration wurden lokal auf SQLite getestet.

## Ergänzung: Semester-Prüfungsvorlagen und Abgabefristen (04.10.2026)

- 60 Django-Tests bestanden, darunter neun neue Prüfungen für wiederholbare
  Übernahme, getrennte Ober-/Teilmodulvorgaben, effektive Semesterzuordnung,
  Wahlpflichtbelegungen, konkrete Prüfungen, Abgabefristen, Herkunftsschutz,
  Löschschutz, ungültige Angaben und Mandantentrennung.
- Acht lokale Browserabläufe bestanden. Der neue vollständige Einrichtungs-
  und Prüfungsablauf wurde auf einer Kopie der bestehenden SQLite-Datenbank
  ausgeführt; die Produktdatenbank erhielt ausschließlich Migration 0010.
  Konkrete Prüfung mit übernommener Dauer, wiederholte Übernahme, Hausarbeitsfrist,
  Neuladen und mobile Breite wurden geprüft.
- Alle sechs Demo-Browserabläufe bestanden. Die Aktualisierung eines alten
  Browserprofils erhält bestehende Raumänderungen und Prüfungen und ergänzt
  die neuen Vorlagenfelder. Desktop- und Mobilansicht wurden visuell geprüft.
- TypeScript, normaler Build, Demo-Build, Ruff, Django-Systemprüfung,
  Migrationsprüfung und `git diff --check` bestanden. Migration 0010 wurde
  nach SQLite-Backup lokal angewendet. PostgreSQL wurde nicht erneut geprüft.

Abgabefristen gehören zur internen Verwaltung und werden noch nicht öffentlich
ausgeliefert. Die Übernahme erstellt Vorlagen; die bestehende Terminplanung
erzeugt die konkreten Raumbelegungen. Die Vercel-Variante bleibt eine Demo mit
Speicherung im jeweiligen Browserprofil.

## Ergänzung: campusAI (04.10.2026)

- 78 Django-Tests bestanden, darunter 18 campusAI-Prüfungen für Anmeldung,
  CSRF, Mandantentrennung, unveränderte Planungsdaten, berechnete Hinweise,
  Semesterlasten, Prüfungsvorlagen/Fristen, Eingabegrenzen, Rate-Limit,
  lokale Modellantworten und ausdrücklich gekennzeichnete Fehlerfälle.
- Der lokale campusAI-Browserablauf bestand: Fragen, Schnellhilfe, Planwechsel,
  Gespräch leeren, unveränderte Daten und Darstellung bei 390 Pixel Breite.
  Zusätzlich bestand der optionale Browsertest gegen das tatsächlich installierte
  Qwen3.5-2B-Modell über Ollama, ohne Änderungen am Datenbestand.
- Sieben Demo-Browserabläufe bestanden. campusAI verursacht dort keine
  Backend-/Modell-Anfragen und verändert keinen Demo-Speicher. Desktop- und
  Mobilansicht wurden visuell geprüft.
- TypeScript, regulärer Build, Demo-Build, Ruff und Migrationsprüfung bestanden.
  Es gibt keine neue Datenbankmigration und keinen persistenten Chatverlauf.

Das lokale Modell wurde auf einem i5-1335U mit rund 16 GB RAM getestet.
Beispielantworten mit Plan-Kontext benötigten etwa 26–40 Sekunden; dies ist
keine garantierte Antwortzeit. Zwei zunächst geprüfte Modelle wurden wegen
unzureichender Antworten verworfen. Auch das gewählte Modell kann Angaben
falsch formulieren; die Oberfläche verweist auf die Hilfe und berechneten
Hinweise. Der Test bestätigt keine allgemeine inhaltliche Zuverlässigkeit.
Produktionsbetrieb in Docker oder auf PostgreSQL wurde für campusAI nicht
erneut getestet; Vercel bietet ausschließlich die Browser-Schnellhilfe.
