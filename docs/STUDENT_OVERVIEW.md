# Studierendenübersicht

In der Verwaltung gibt es den Bereich **Studierendenübersicht**. Jede dort
angezeigte Planauswahl besitzt einen eigenen Link `/overview/<token>`.
Die Planauswahl und Aktivierung werden über **Planauswahl verwalten** im
vorhandenen Anzeigenbereich gepflegt. Dieser Link funktioniert ohne Anmeldung.
Die Übersicht zeigt ausschließlich die neuesten freigegebenen Versionen der
ausgewählten Pläne dieser Einrichtung.

Die Filter **Jahrgang**, **Gruppe / Klasse** und **Kurs** lassen sich kombinieren.
Gruppen werden auf den gewählten Jahrgang, Kurse auf Jahrgang und Gruppe
eingeschränkt. Beim Wechsel eines übergeordneten Filters werden die darunter
liegenden Filter zurückgesetzt. Gemeinsame Veranstaltungen erscheinen für jede
zugeordnete Gruppe, Wahlpflichtveranstaltungen ohne Gruppen anhand der
erfassten Teilnehmergruppen. Dies ist eine Gruppen-/Kursübersicht, keine
personenbezogene Anzeige individueller Wahlpflichtbelegungen.

Prüfungen und Nachschreibeklausuren werden anhand ihrer tatsächlichen
Teilnehmergruppen zugeordnet. Ein Kursfilter umfasst auch die mit diesem Kurs
verknüpften Prüfungen. Prüfungen ohne Kurs erscheinen als eigene Filteroption.
Namen, Kennungen und Listen einzelner Lernender werden niemals ausgeliefert.
Lehrendennamen folgen der bestehenden Freigabeeinstellung der Planauswahl.

Die Übersicht bleibt eine Wochenansicht mit Wochennavigation und Datumauswahl.
Eine Datumseingabe wählt die zugehörige Woche. Es gibt keine Umschaltung auf
Heute oder Morgen und kein automatisches Scrollen. Die bisherigen
Bildschirmanzeigen `/display/<token>` behalten unverändert ihren von der
Verwaltung fest eingestellten Zeitraum.

Die Auswahl einschließlich Woche steht in den URL-Parametern `week`, `cohort`,
`group` und `course`. Sie bleibt beim Neuladen bestehen und lässt sich über
**Link zur Auswahl kopieren** teilen. Leere Wochen behalten ihre Filteroptionen
und zeigen einen Hinweis; bei vorhandenen Terminen in einem anderen Zeitraum
kann die erste geplante Woche geöffnet werden. Desktop zeigt ein Wochenraster,
Handys eine nach Tagen sortierte Terminliste mit Uhrzeit, Raum und Gruppe.

Die Daten werden alle zehn Sekunden aktualisiert. Raumblockierungen bleiben
sichtbar. Bei Verbindungsproblemen wird der zuletzt geladene Stand ausdrücklich
gekennzeichnet. Zu einer neu gewählten, noch nicht geladenen Auswahl werden
keine Termine der vorherigen Auswahl angezeigt.

Filterbeziehungen und Bezeichnungen werden beim Veröffentlichen im Snapshot
gesichert. Entwurfsänderungen wirken sich erst nach einer weiteren Freigabe aus.
Migration 0009 ergänzt vorhandene Snapshots um diese Metadaten, ohne Termine,
Veröffentlichungszeitpunkte oder Versionsnummern zu verändern. Für ältere
Snapshots werden die vorhandenen Gruppenbezeichnungen und die zum
Migrationszeitpunkt bestehenden Gruppenzuordnungen verwendet.

Die Vercel-Ausführung bleibt eine Browser-Demo. Die Übersicht funktioniert dort
ebenfalls; Datenänderungen und Aktualisierungen gelten für denselben Browser.
Ein geteilter Link überträgt die Filter, aber keine lokalen Datenänderungen
zwischen verschiedenen Geräten. Bestehender Demo-Speicher wird ergänzt.
