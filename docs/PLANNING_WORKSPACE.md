# Stundenplanung und Termin-Popup

Der Wochenplan nutzt die gesamte Arbeitsbreite. Es gibt keinen permanenten
rechten Detailbereich. Logo, Produktfarben, die aktuelle Woche, rote Zeitlinie
und die einklappbare Navigation bleiben erhalten.

## Terminbearbeitung

- Ein Klick auf einen Kalendertermin öffnet das Formular als modales Popup.
  „Termin“ öffnet dasselbe Popup zum Anlegen. Der Kalender bleibt im Hintergrund.
- Schemafelder, häufig verwendete Felder zuerst, Speichern, Löschen und
  Validierung nutzen weiterhin dieselbe API.
- Escape, Abbrechen, Schließen und Hintergrundklick fragen vor dem Verwerfen
  ungespeicherter Eingaben nach. Ein abgelehntes Verwerfen erhält das Formular.
  Während des Speicherns bleiben die Felder und das Schließen gesperrt.
- Die automatische Zeitnavigation pausiert während der Bearbeitung.
  Nach dem Schließen gilt wieder die zuvor gewählte Navigation. Tastaturfokus
  bleibt im Popup und kehrt anschließend zum auslösenden Element zurück.
- Kopf und Speicheraktionen bleiben sichtbar; lange Formulare scrollen intern.
  Auf kleinen Bildschirmen stehen die Felder untereinander.
- Tagesbreiten verwenden wieder die normalen Kalenderbreiten. Bei Platzmangel
  scrollt der Kalender horizontal.

## Prüfung

Die Demo-Browsertests prüfen Popup, Speichern, Validierung, ungespeicherte
Eingaben, Fokus und Mobilansicht. Die API-Tests verwenden ausschließlich
abgefangene HTTP-Anfragen mit Testdaten und prüfen auch verzögertes Speichern.
