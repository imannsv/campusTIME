# Einrichtung und Studienstruktur

Der neue Bereich führt die Studienverwaltung durch sechs Schritte. Bestehende
Pläne, Lehrplanvorlagen, Räume und Personen bleiben erhalten. Die Migration
legt neue Zuordnungen zunächst optional an; alte Jahrgänge werden nicht
automatisch an eine erfundene Studienstruktur gebunden.

## Einmalige Grundlagen

1. **Räume:** Bereiche, Stockwerke, vorhandene Raumbezeichnungen, Kapazität und
   Ausstattung pflegen.
2. **Lehrende:** Personen anlegen und die mit ihnen abgestimmten Verfügbarkeiten
   eintragen. Mehrere Zeitfenster pro Wochentag und datierte Sperrzeiten sind
   möglich. Die Eingabe erfolgt durch die Studienverwaltung; es gibt keinen
   Selbstbedienungszugang für Lehrende. Ohne Zeitfenster ist die Person nicht
   verfügbar. Bestehende Verfügbarkeiten bleiben lesbar.
3. **Studiengang:** Regelstudienzeit und Zielumfang an Credit Points hinterlegen.
   Für Bildungsgänge ohne Credit Points ist ein Zielumfang von 0 möglich. Danach
   eine Lehrplanversion mit eigener Versionsbezeichnung anlegen.
4. **Studienstruktur:** Obermodule und Teilmodule anlegen. Je Lehrveranstaltung
   Fachsemester, Veranstaltungsart, Unterrichtsumfang, Termindauer, Ausstattung
   und optional Lehrende hinterlegen. Veranstaltungen desselben Moduls können
   in verschiedenen Semestern liegen. Voraussetzungen beziehen sich auf andere
   Module derselben Version.

Module und Teilmodule erhalten direkt eine Prüfungsart: Klausur, Hausarbeit,
Abgabe, mündliche oder praktische Prüfung, Präsentation, Portfolio oder eine
sonstige Prüfungsleistung. „Noch nicht festgelegt“ unterscheidet sich von
„Keine eigene Prüfung“. Die Vorgabe gilt ausschließlich für das gewählte Modul;
eine Prüfung am Obermodul wird nicht automatisch auf seine Teilmodule kopiert.
Zeitgebundene Prüfungsarten benötigen eine Dauer von 1 bis 1.440 Minuten.
Für Klausuren bietet das Formular 60, 90 und 120 Minuten als Vorschläge.
Hausarbeiten und Abgaben haben keine Minutendauer; Umfang und relative
Abgabehinweise stehen in einem eigenen Textfeld. Konkrete Termine, Abgabedaten,
Räume und Aufsichten werden weiterhin separat für den jeweiligen Jahrgang
geplant. Aus diesen Vorgaben entstehen noch keine automatischen Prüfungsbuchungen.
Neue Lehrplanversionen als Kopie übernehmen die Prüfungsanforderungen.
Bestehende Module bleiben bei der Migration zunächst „Noch nicht festgelegt“.

Je Lehrveranstaltung wird außerdem festgelegt, ob sie gemeinsam für den
Jahrgang oder separat je Gruppe durchgeführt wird. Bei der Semesterübernahme
entsteht entsprechend eine gemeinsame Veranstaltung oder eine Veranstaltung
je Gruppe, jeweils mit eigenem Unterrichtssoll.

Credit Points und Unterrichtseinheiten sind getrennte Angaben. Der Planer
leitet niemals Unterrichtsstunden aus Credit Points ab. Für den Gesamtumfang
zählen ausschließlich Obermodule. Teilmodule mit eigenen Punkten müssen
zusammen den Umfang ihres Obermoduls ergeben; Teilmodule ohne eigene Punkte
sind ebenfalls möglich. Obermodul und Teilmodule werden nicht addiert.

Die Vollständigkeitsprüfung kontrolliert den Gesamtumfang, Teilmodulsummen,
semesterbezogene Veranstaltungen und die zeitliche Reihenfolge von
Voraussetzungen. Fehlende Lehrende sind zunächst Hinweise; sie können beim
konkreten Semester ergänzt werden. Die Semesterübersicht zeigt die fachliche
Verteilung über den Studienverlauf.

Erst eine vollständige Version lässt sich freigeben. Ihre Struktur ist danach
geschützt. **Neue Version aus Kopie** erzeugt einen bearbeitbaren Entwurf mit
übernommenen Modulen, Beziehungen und Lehrveranstaltungen. Bereits angelegte
Jahrgänge behalten ihre alte Version.

## Wiederkehrender Ablauf

5. **Jahrgang:** Freigegebene Lehrplanversion auswählen, Aufnahmejahr und Gruppen
   erfassen. Über **Studierendenliste verwalten** die Personen einer Gruppe
   pflegen oder im lokalen Backend importieren. Neue Einzelpersonen erhalten
   die Gruppe automatisch; CSV-Dateien geben Gruppenkennungen in `groups` an.
6. **Semester planen:** Kalenderzeitraum mit Unterrichtstagen und freien Tagen
   anlegen oder auswählen. Einen Plan für Jahrgang und Fachsemester anlegen.
   **Veranstaltungen übernehmen** übernimmt ausschließlich dieses Fachsemester.

Die Übernahme ist wiederholbar: vorhandene Veranstaltungen und ihre manuellen
Anpassungen bleiben erhalten. Lehrende, Gruppen und konkrete Wahlpflichtbelegungen
können anschließend in den Veranstaltungen des Semesterplans geändert werden.
Fehlende Lehrende oder Wahlpflichtteilnehmer werden als Hinweise gemeldet.
Der Zeitraum wird bewusst gewählt, nicht aus dem Aufnahmejahr geraten.

**Stundenplanung öffnen** führt in den vorhandenen Kalender. Die echte Automatik
berücksichtigt dort die von der Verwaltung gepflegten Verfügbarkeiten,
Teilnehmer, Räume, Ausstattung, Sperren und Unterrichtssoll. Der Vorschlag muss
weiterhin geprüft, übernommen und separat veröffentlicht werden.

## Beispiel und Prüfung

```powershell
.\.venv\Scripts\python.exe backend/manage.py migrate
.\.venv\Scripts\python.exe backend/manage.py seed_study
```

Der Entwicklungsbefehl benötigt die bestehende `seed_demo`-Einrichtung und ist
idempotent. Er ergänzt ausschließlich fiktive Daten: eine freigegebene
Wirtschaftsinformatik-Version mit 6 Semestern, 180 CP, 37 Modulen einschließlich
eines Obermoduls mit zwei Teilmodulen, 36 Lehrveranstaltungen und Jahrgang
`dWI27` mit zwei Gruppen. Bestehende Pläne und Personen werden nicht verändert.

Die Vercel-Demo unterstützt den geführten Ablauf einschließlich Freigabe,
Kopie und Semesterübernahme im jeweiligen Browser. Automatische Terminplanung
und Dateiimporte benötigen weiterhin das echte Backend. Ein bestehender
Demo-Speicher wird um die neue Struktur ergänzt; Raumänderungen bleiben erhalten.

Die Voraussetzungen prüfen die hinterlegte Studienfolge, nicht individuell
bestandene Prüfungen. Prüfungsergebnisse, persönliche CP-Konten, komplexe
Wahlpflicht-Katalogregeln und fachliche Genehmigung einer Studienordnung sind
nicht Bestandteil dieser Erweiterung. Die Beispieldaten sind keine echte
Studienordnung.

## Studienverlauf eines Jahrgangs anpassen

Unter **Jahrgänge → Studienverlauf und Semesterbelastung** erscheint zunächst
der Standardverlauf. Einzelne Lehrveranstaltungen können in ein anderes
Fachsemester verschoben werden. **Modul verschieben** verschiebt alle
Veranstaltungen eines Ober- oder Teilmoduls gemeinsam; bei mehrsemestrigen
Modulen bleiben die relativen Abstände erhalten. Der Standardlehrplan und
andere Jahrgänge behalten ihre Verteilung.

Manuelle Verschiebungen sind zunächst fixiert. Die Fixierung kann gelöst
werden, damit **Ausgleich vorschlagen** diese Veranstaltung ebenfalls bewegen
darf. Ein Vorschlag wird separat mit seinen Verschiebungen und verbleibenden
Belastungshinweisen angezeigt. Erst **Vorschlag in Vorschau übernehmen** und
**Studienverlauf speichern** ändern den Jahrgang dauerhaft. Vorschläge können
verworfen und unverplante Veranstaltungen auf den Standard zurückgesetzt werden.

Die Belastungsprüfung verwendet:

- **CP-Anteile:** CP eines Obermoduls werden nach den CP seiner Teilmodule
  verteilt. Teilmodule ohne CP erhalten gleiche Anteile. Innerhalb eines
  Moduls wird der Anteil gleichmäßig auf seine Veranstaltungen verteilt.
  Beispiel: 10 CP mit zwei Teilmodulen zu je 5 CP in Semester 1 und 2 ergeben
  jeweils 5 Planungs-CP. Das ist keine Verbuchung bestandener Prüfungen.
- **Wöchentliche UE:** Wöchentliche Unterrichtsvolumina pro Studierendengruppe;
  A/B-Wochen zählen im Mittel zur Hälfte. Separate Gruppendurchführungen werden
  für die individuelle Lernbelastung nicht mehrfach gezählt. Gesamtumfänge
  werden zusätzlich angezeigt und ohne Semesterwochen nicht in Wochenwerte
  umgerechnet.
- **Belastungspunkte:** CP-Anteil × administrativ gepflegte Modulschwierigkeit
  (1 = leicht, 2 = mittel, 3 = anspruchsvoll). Bestehende und neue Module sind
  mit 2 vorbelegt. Die Software erschließt keine fachliche Schwierigkeit aus
  Namen oder bewertet Inhalte selbstständig.

Grenzen sind pro Jahrgang einstellbar. Bei CP und Belastungspunkten verwendet
0 den Mittelwert über die Regelstudienzeit, bei UE deaktiviert 0 die Grenze.
Überschreitungen sind Planungshinweise und können bewusst gespeichert werden.
Verletzte Voraussetzungen sperren das Speichern. Ein vorausgesetztes Modul
muss mit sämtlichen zugehörigen Veranstaltungen früher abgeschlossen sein.

Der begrenzte heuristische Ausgleich prüft einzelne Verschiebungen,
zusammenhängende Voraussetzungsketten und Tausche. Er verbessert die
Lastverteilung unter Berücksichtigung der Grenzen und bevorzugt kleine
Änderungen. Er garantiert keine optimale Lösung. Wenn Fixierungen die
Voraussetzungen unmöglich machen, meldet er den Konflikt; verbleibende
Überschreitungen werden sichtbar ausgewiesen. Fachliche Vorgaben ohne erfasste
Voraussetzung, saisonale Angebote und personelle/raumbezogene Kapazitäten
lassen sich daraus nicht ableiten. Letztere prüft die konkrete Stundenplanung.

Die Semesterübernahme verwendet den gespeicherten Jahrgangsverlauf.
Bereits übernommene Veranstaltungen sind gegen Semesterwechsel geschützt;
sie müssen zuerst aus ihrem bestehenden Semesterplan entfernt werden.
Speichern prüft zusätzlich den Stand der Einrichtungsdaten und lehnt eine
veraltete Vorschau ab. Bestehende Jahrgänge starten ohne Abweichungen.
