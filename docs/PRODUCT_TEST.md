# Lokaler Produkttest

Die Zusatzdaten sind vollständig fiktiv. Sie wurden für eine Übersicht und interaktive Funktionstests erstellt, nicht als echte Kundeneinrichtung.

```powershell
.\.venv\Scripts\python.exe backend/manage.py seed_showcase
```

Voraussetzung ist `seed_demo`. Der Befehl ergänzt die lokale Demo in einer Transaktion, veröffentlicht alle neuen Pläne erst nach einer vollständigen Konflikt-/Sollprüfung und überschreibt bei wiederholtem Aufruf keine vorhandenen Daten. Vor der aktuellen Erweiterung wurde `backend/db.before-showcase.sqlite3` als lokales Backup erstellt. Der Befehl ist bei `DEBUG=0` gesperrt.

Ein explizites Bezugsdatum ist optional: `seed_showcase --date 2026-10-03`. Standardmäßig zählt das Datum in der Zeitzone der Einrichtung. Unterricht beginnt in der aktuellen Woche, am Wochenende in der folgenden Woche. Das Campusprogramm umfasst die aktuelle und die drei folgenden Wochen inklusive Wochenende. Die erzeugten Termine wandern anschließend nicht automatisch mit der Kalenderzeit mit; nur die Tagesanzeigen wechseln automatisch das Datum.

## Datenumfang

| Daten | Anzahl |
| --- | ---: |
| Studien-/Bildungsgänge | 4 |
| Jahrgänge | 7 |
| Gruppen | 13 |
| Lernende | 262 |
| Lehrende | 18 |
| Pläne, alle veröffentlicht | 8 |
| Veranstaltungen | 52 |
| Prüfungen, davon 5 Nachschreibetermine | 16 |
| Termine insgesamt | 246 |
| Gebäude / Etagen / Räume | 3 / 6 / 14 |
| Raumblockierungen | 4 |
| Öffentliche Anzeigen | 4 |

Enthalten sind `dWI24`, `dWI25`, `dWI26`, `INF25`, `INF26`, `MED26` und eine Orientierungsgruppe. Geteilte A1/A2-Gruppen haben konkrete Teilnehmerlisten. Gemeinsame Vorlesungen, Wahlpflicht mit tatsächlicher Auswahl, A-Wochen, zweitägige Projektblöcke und wechselnde Lehrendenteams zeigen verschiedene Planungsfälle.

## Sinnvolle Testwege

1. **Stundenplanung**: Im Planselektor beispielsweise `dWI24 · Unterricht & Prüfungen` wählen. Erste, zweite und dritte Woche vergleichen: A-Rhythmus, Prüfungen und Projektblöcke unterscheiden sich. Fixierte Prüfungstermine bleiben bei automatischer Unterrichtsplanung bestehen.
2. **Stammdaten → Jahrgänge/Gruppen/Personen**: Die Gruppenaufteilung und Teilnehmerzuordnung nachvollziehen. **Lehrplanvorlagen** enthalten Beispiel-Sollvorgaben für die drei akademischen Studiengänge.
3. **Prüfungen**: Nach „Nachschreiben“ oder „Gemeinsame Grundlagenklausur“ suchen. Die gemeinsame Klausur umfasst 76 Lernende und zwei Räume/Aufsichten. Sie liegt im Plan `Prüfungszentrum · gemeinsame Klausur`.
4. **Raumblockierungen**: Wiederkehrende PC-Wartung, Bauarbeiten und Projektvorbereitung prüfen. Alle Beispielsperren sind mit dem veröffentlichten Plan konfliktfrei. Zum Test einer Fehlermeldung eine Sperre auf einen vorhandenen Termin legen und anschließend wieder entfernen.
5. **Öffentliche Anzeige**: `Produkttest · alle Jahrgänge`, `Campus Nord · Heute` oder `Campus Nord · Morgen` öffnen. Heute und morgen enthalten während des Campuszeitraums jeweils drei Veranstaltungen, auch am Wochenende. Die ursprüngliche kleine Wochenanzeige bleibt als übersichtliches Beispiel bestehen.
6. **Räume**: Zwischen Hauptgebäude, Seminarzentrum und Projektforum sowie den Stockwerken wechseln; Raumkacheln und freigegebene Belegungen vergleichen. Räume über Bezeichnung oder Ausstattung suchen, Kapazität bearbeiten und neue Räume ohne Karte anlegen.

Bei einer neuen Anzeige **Anzeigezeitraum → Woche / Heute / Morgen** auswählen. Das gespeicherte Datumskonzept gilt für jeden Aufruf des Links. Im Anzeigelink gibt es keine Umschaltung zwischen Woche, Heute und Morgen. Änderungen des Zeitraums erfolgen ausschließlich in der Verwaltung; für unterschiedliche Zeiträume separate Anzeigen anlegen. Tagesanzeigen aktualisieren das Datum bei der nächsten Zehn-Sekunden-Abfrage nach Mitternacht in der Einrichtungszeitzone. Ein leerer Tag zeigt eine ausdrückliche Meldung statt Termine eines anderen Tages.


## Studienstruktur-Beispiel

Nach `seed_demo` und `migrate` ergänzt `seed_study` eine fiktive Version mit
6 Semestern und 180 CP sowie Jahrgang dWI27 mit zwei Gruppen. Unter
**Einrichtung & Studienstruktur** Module/Teilmodule, Semesterübersicht und
Voraussetzungen ansehen, eine neue Version kopieren und einen Semesterplan
für dWI27 vorbereiten. Lehrende werden durch die Studienverwaltung gepflegt.
Der Befehl verändert die oben beschriebenen 8 veröffentlichten Pläne nicht.
Die Vercel-Demo enthält dieses zusätzliche Beispiel bereits.
