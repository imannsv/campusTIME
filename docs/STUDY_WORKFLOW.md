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
bestandene Prüfungen. Prüfungsleistungen, persönliche CP-Konten, komplexe
Wahlpflicht-Katalogregeln und fachliche Genehmigung einer Studienordnung sind
nicht Bestandteil dieser Erweiterung. Die Beispieldaten sind keine echte
Studienordnung.
