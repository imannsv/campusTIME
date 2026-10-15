# Persönliche App-Zugänge

Stand 15.10.2026. Zusätzlich zu Gruppen-/Jahrgangs-QR-Zugängen können Administratoren einen App-Zugang pro gespeicherter lernender oder lehrender Person verwalten. Es entsteht kein Django-Verwaltungskonto. Vorname, Nachname und E-Mail sind optional; vorhandene Anzeigenamen und Gruppen-Zugänge bleiben bei Migration 0017 erhalten.

## Verwaltung und Anmeldung

- **Schüler & Studierende → Bearbeiten → Persönlicher Zugang** beziehungsweise das Lehrendenformular oder **Lehrendenübersicht → Verfügbarkeit → Persönlicher Zugang**. Änderungen zuerst speichern.
- Benutzername aus Vor-/Nachname oder Kennung vorschlagen lassen, bei Bedarf anpassen. Benutzernamen sind serverweit eindeutig, kleingeschrieben und bleiben bei späteren Änderungen der Person stabil.
- Erreichbare Serveradresse prüfen. Öffentlich HTTPS; HTTP ausschließlich für lokale Testadressen. Einmaliges Startpasswort sicher weitergeben; es wird weder gespeichert noch per E-Mail versendet. Gespeichert wird nur der Django-Passworthash.
- Die App verlangt vor Datenabruf, Push-Registrierung und Cache-Wiederherstellung den Wechsel auf ein eigenes Passwort. Mindestens zehn Zeichen und die Django-Passwortprüfungen gelten. Spätere Änderungen stehen unter **Profil → Passwort ändern** bereit.
- Zurücksetzen erzeugt ein neues Startpasswort und aktiviert gegebenenfalls einen gesperrten Zugang. Sperren und Zurücksetzen widerrufen alle Gerätesitzungen. Ein eigener Passwortwechsel widerruft alle Sitzungen und ersetzt die eigene durch eine neue.
- Ein gemeinsamer Gruppen-QR bleibt zusätzlich verwendbar und hat weiterhin den bisherigen Gruppen-/Jahrgangsumfang. Persönliche Zugänge erhalten keinen QR-Code.

## Datenumfang

Lernende sehen veröffentlichte Termine ihrer aktuellen Gruppen und ausdrücklich zugeordnete veröffentlichte Termine. Lehrende sehen eigene veröffentlichte Termine. Interne Teilnehmer-IDs und E-Mail-Adressen werden nicht an die App ausgegeben. Allgemeine Einrichtungshinweise gelten für beide; Gruppen-/Jahrgangshinweise folgen bei Lernenden der aktuellen Gruppenzuordnung. Lehrenden-Blockzeitabsagen erzeugen weiterhin Gruppenmitteilungen, keine zusätzliche persönliche Lehrendenmitteilung.

Neue Veröffentlichungen speichern explizite Kurszuordnungen getrennt vom damaligen Gruppenbestand als `explicit_learner_ids`. Historische Kursveröffentlichungen können diese Unterscheidung nicht zuverlässig rekonstruieren: Sie werden nur über die aktuellen Gruppen angezeigt. Für ausschließlich individuell zugeordnete Kurstermine muss der Plan erneut veröffentlicht werden. Historische Prüfungszuordnungen bleiben verwendbar, da deren Teilnehmerliste bereits explizit ist. Nicht veröffentlichte Änderungen werden nicht nachträglich aus Entwürfen ergänzt.

Offline gilt weiterhin: Bereits heruntergeladene Daten bleiben ohne Verbindung bis zum Sitzungsablauf verfügbar. Sperren, Zurücksetzen und Zuordnungsänderungen werden auf dem Gerät erst beim nächsten Serverkontakt erkannt. Ein zurückgesetzter persönlicher Zugang muss sich erneut anmelden und sein Passwort wechseln. Das neue App-Verhalten erfordert ein App-Update; alte Fassungen können den Erstwechsel nicht durchführen.

## API

- `GET /api/people/{id}/access/`: Administrator derselben Einrichtung; Status und Benutzernamenvorschläge, keine Passwörter.
- `POST /api/people/{id}/access/`: `action` ist `create`, `reset` oder `disable`. Erstellung nutzt `source` (`name`/`identifier`), optional `username`, und `server`; Reset kann die gespeicherte Serveradresse behalten. Nur Erstellung/Reset liefern das neue `password` einmalig. Antworten sind nicht cachebar.
- `POST /api/student-app/v1/login/`: bestehende manuelle Anmeldung mit `code` (auch persönlicher Benutzername) und `password`. Persönliche Antworten haben `scope_kind: person` und `password_change_required`.
- `POST /api/student-app/v1/password/`: Bearer-Sitzung und `current_password`/`new_password`. Erfolg liefert die vollständige Login-Antwort mit neuem Token. Gruppen-/Jahrgangszugänge sind ausgeschlossen. Fehlermeldungen stehen als Zeichenkette in `detail`.
- Feed/Push antworten bis zum Erstwechsel mit HTTP 403 und `code: password_change_required`. Abmelden bleibt erlaubt. Bestehende gemeinsame Zugänge benötigen keinen Passwortwechsel.

Echte Push-Zustellung benötigt weiterhin die Apple-Developer- und APNs-Einrichtung. Persönliche Konten ersetzen weder diese Freischaltung noch eine Prüfungszulassung.
