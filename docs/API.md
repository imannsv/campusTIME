# Interne Schnittstellen

Alle Verwaltungsanfragen verwenden die Django-Sitzung. Schreibende Anfragen benötigen zusätzlich `X-CSRFToken` aus dem `csrftoken`-Cookie. Zuerst `GET /api/auth/me/` aufrufen. Der Server bestimmt die Einrichtung aus der Anmeldung; eine vom Client eingereichte Einrichtungs-ID wird nicht übernommen.

| Schnittstelle | Verhalten |
| --- | --- |
| `GET /api/auth/me/` | Anmeldung, Benutzer, Rolle, Einrichtungseinstellungen und Kartenquelle |
| `POST /api/auth/login/` | `{username, password}`; legt Sitzung an |
| `POST /api/auth/logout/` | Beendet Sitzung |
| `GET /api/bootstrap/` | Formularschema, Datensatzanzahlen, letzte Änderungen |
| `GET /api/health/` | `ok` beziehungsweise HTTP 503; prüft Datenbank und im Workerbetrieb Redis |
| `PATCH /api/preferences/` | Unterrichtseinheit, Prüfungszahl/Tag, Prüfungsabstand; nur Einrichtungsverwaltung |
| `/api/{resource}/` | GET/POST; Listen mit `count`, `next`, `previous`, `results` |
| `/api/{resource}/{id}/` | GET/PATCH/DELETE; ausschließlich eigene Einrichtung |
| `GET /api/plans/{id}/check/` | Vollständige interne Terminansicht, Konflikte und letzte Veröffentlichung |
| `POST /api/plans/{id}/solve/` | `{kind: "teaching" | "exams"}`; HTTP 202 mit Job-ID |
| `GET /api/jobs/{uuid}/` | Status, Meldung, Vorschlag und Kennzeichen `stale` |
| `GET /api/jobs/?plan={id}` | Letzte Aufträge für die Wiederaufnahme geschlossener Planungsdialoge |
| `POST /api/jobs/{uuid}/` | `{action: "cancel" | "apply"}` |
| `POST /api/plans/{id}/publish/` | Prüft Konflikte und Soll; erstellt unveränderliche Veröffentlichung |
| `POST /api/plans/{id}/template/` | `{curriculum, groups: []}`; kopiert Lehrplanfächer |
| `GET /api/imports/{resource}/` | CSV-Vorlage |
| `POST /api/imports/{resource}/` | Multipart `file`: validierte Vorschau; JSON `{batch}`: atomare Übernahme |
| `POST /api/floors/{id}/upload/` | Multipart `file`: PNG/JPEG/WebP bis 10 MB |
| `GET /api/floors/{id}/file/` | Grundriss mit Einrichtungsberechtigung |
| `GET /api/rooms/{id}/occupancy/` | Freigegebene Belegung für die Verwaltungsansicht |
| `GET /api/public/{token}/` | Anonyme, explizit reduzierte öffentliche Ansicht; keine Personenkennungen |

Ressourcen: `areas`, `programs`, `cohorts`, `groups`, `people`, `periods`, `buildings`, `floors`, `rooms`, `curricula`, `plans`, `courses`, `exams`, `sessions`, `blocks`, `displays`.

Listen unterstützen `page`, `page_size` (maximal 1.000), `search` und passende Beziehungsfilter (`plan`, `floor`, `building`, `kind`, `cohort`, `program`). Öffentliche Anzeigen und Terminlisten können über `since`/`until` auf ein Zeitfenster eingeschränkt werden. Öffentliche Metadaten enthalten den frühesten veröffentlichten Termin und den Anzeige-Zeitrahmen.

Anzeigen speichern `view_mode`: `week`, `today` oder `tomorrow`. Der öffentliche Endpunkt verwendet ausschließlich diese gespeicherte Vorgabe. Ein `view`-Parameter wird ignoriert; nur die authentifizierte Verwaltung kann den Zeitraum ändern. Tagesansichten berechnen beide lokalen Mitternachtsgrenzen anhand der Einrichtungszeitzone bei jeder Anfrage und ignorieren `since`/`until`. Die Antwort enthält `view_mode`, `window_start` und `window_end`; dadurch bleiben Tageswechsel und Zeitumstellung serverseitig konsistent. Bei Wochenansichten müssen `since`/`until` Zeitzonen enthalten und das Ende muss nach dem Beginn liegen.

Beim Anlegen eines Unterrichtstermins sind zusätzlich `repeat_weekly`, `repeat_until` und `repeat_interval` (1 oder 2 Wochen) möglich. Die Serie wird insgesamt validiert und atomar gespeichert. Ausgeschlossene Kalendertage werden ausgelassen.

Jobstatus: `queued`, `running`, `ready`, `infeasible`, `timeout`, `invalid`, `failed`, `cancelled`, `applied`. `timeout` ist kein Unlösbarkeitsnachweis. Ein geprüfter vollständiger Startvorschlag kann auch dann als `ready` bereitgestellt werden, wenn weitere Optimierung im Zeitlimit keine Lösung verbessert hat.

Einrichtungsänderungen erhöhen eine Revisionsnummer. Jobübernahme, Importe und Veröffentlichungen sperren den Einrichtungsdatensatz während des Schreibens. `apply` lehnt jede gegenüber dem Berechnungsstand veränderte Datenbasis ab. Veröffentlichungen prüfen andere Planbereiche anhand deren freigegebener Versionen, nicht anhand unveröffentlichter Entwürfe.

Interne Prüfungstermine enthalten `room_allocations` mit Raum-ID, Teilnehmer-IDs und Aufsichts-ID. Dieses Feld gehört ausschließlich zur Verwaltungsansicht und wird vom öffentlichen Serializer ausgeschlossen.

## Studienstruktur und Semesterübernahme

Neue Ressourcen: `studyversions`, `modules`, `teachingunits`. Programme speichern
`duration_semesters` und `total_credits`. Jahrgänge speichern optional
`study_version` und `entry_year`; Pläne optional `cohort` und `semester`.
Veranstaltungen speichern eine geschützte Herkunft `teaching_unit` und bei
separater Durchführung `study_group`. `teachingunits.group_mode` ist `combined`
(Gruppen gemeinsam) oder `per_group` (eine Veranstaltung je Gruppe).

- `GET /api/studyversions/<id>/check/`: Fehler, Hinweise und CP-Gesamtumfang.
- `POST /api/studyversions/<id>/approve/`: Vollständige Studienstruktur freigeben.
  `status` ist über die generische CRUD-API nicht beschreibbar. Freigegebene
  Versionen sowie ihre Module und Lehrveranstaltungen sind geschützt.
- `POST /api/studyversions/<id>/clone/`: `code`, `name`, `version` übergeben.
  Erzeugt einen neuen Entwurf mit kopierten Modulbeziehungen und Veranstaltungen.
- `POST /api/plans/<id>/prepare/`: Veranstaltungen des ausgewählten Fachsemesters
  übernehmen. Optional `groups` als Liste von Gruppen-IDs des Jahrgangs.
  Je nach `group_mode` entsteht eine gemeinsame Veranstaltung oder je Gruppe
  eine eigene. Jede erhält den vorgegebenen Unterrichtsumfang.
  Liefert `created`, `existing`, `warnings`; vorhandene Einträge bleiben erhalten.

Alle Zugriffe sind authentifiziert und an die Einrichtung gebunden. Schreibende
Aktionen prüfen die Lizenz und sperren die Einrichtung während der Transaktion.
Ein Jahrgang behält seine einmal zugeordnete freigegebene Lehrplanversion.

`availability.windows` ersetzt bei Personen die bisherige gemeinsame Wochenzeit:
`[{"weekday":0,"from":"09:00","to":"11:00"},{"weekday":3,"from":"14:00","to":"17:00"}]`.
Eine leere Liste bedeutet keine Verfügbarkeit. `exclusions` enthält weiterhin
Start-/Endzeitpunkte mit Zeitzone. Alte `weekdays`/`from`/`to` werden verwendet,
wenn `windows` fehlt. Unterricht und Prüfungsplanung verwenden dieselbe Prüfung.

Zusätzliche Listenfilter: `study_version`, `module`, `semester`, `status`,
bei Personen `groups` und `kind`. Die CSV-Importe verwenden die dynamischen
Ressourcenschemata; Freigabe einer Lehrplanversion erfolgt separat.
