# Interne Schnittstellen

Die separate öffentliche Studierendenübersicht verwendet
`GET /api/public/<token>/overview/`. `since` und `until` sind Zeitpunkte mit
Zeitzone; `cohort`, `group` und `course` sind optionale kombinierte Filter.
`course` verwendet `course:<id>` bzw. für Prüfungen ohne Kurs `exam:<id>`.
Die Antwort enthält sichere öffentliche Terminangaben und einen `catalog`
mit Jahrgängen, Gruppen und Kursen aus den ausgewählten Veröffentlichungen.
Ungültige bzw. nicht verfügbare Filter liefern HTTP 400; deaktivierte oder
unbekannte Links HTTP 404. Dieser Endpunkt bleibt unabhängig vom festgelegten
Anzeigezeitraum eine Wochenübersicht. Details: [Studierendenübersicht](STUDENT_OVERVIEW.md).

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
| `POST /api/plans/{id}/prepare-assessments/` | Kopiert Prüfungsanforderungen anhand des effektiven Jahrgangsverlaufs; liefert `created`, `existing`, `warnings` |
| `GET /api/assessments/{id}/exam_draft/` | Liefert `defaults` und `warnings` für eine konkrete zeitgebundene Prüfung; erzeugt keine Buchung |
| `GET /api/imports/{resource}/` | CSV-Vorlage |
| `POST /api/imports/{resource}/` | Multipart `file`: validierte Vorschau; JSON `{batch}`: atomare Übernahme |
| `POST /api/floors/{id}/upload/` | Multipart `file`: PNG/JPEG/WebP bis 10 MB |
| `GET /api/floors/{id}/file/` | Grundriss mit Einrichtungsberechtigung |
| `GET /api/rooms/{id}/occupancy/` | Freigegebene Belegung für die Verwaltungsansicht |
| `GET /api/public/{token}/` | Anonyme, explizit reduzierte öffentliche Ansicht; keine Personenkennungen |

Ressourcen: `areas`, `programs`, `studyversions`, `modules`, `teachingunits`, `cohorts`, `groups`, `people`, `periods`, `buildings`, `floors`, `rooms`, `curricula`, `plans`, `courses`, `assessments`, `exams`, `sessions`, `blocks`, `displays`.

`assessments` speichert `plan`, `module`, `assessment_type`,
`assessment_duration_minutes`, `assessment_notes`, `due_at` und `status`
(`open` oder `waived`). `due_at` gehört nur zu nicht zeitgebundenen Leistungen.
Pro Plan und Modul existiert höchstens eine Vorlage; ihre Herkunft bleibt bei
Änderungen erhalten. `exams.assessment_template` ist eine optionale eindeutige
Herkunftszuordnung. Konkrete Prüfungen speichern außerdem die Prüfungsart und
Hinweise. Eine verwendete Vorlage kann nicht einzeln gelöscht werden.

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

## Jahrgangsverlauf und Belastung

`modules.difficulty` ist 1, 2 oder 3, vorbelegt mit 2. Jahrgänge speichern
`semester_credit_limit`, `semester_weekly_limit`, `semester_difficulty_limit`
und `study_schedule`. Letzteres ist über CRUD/Import schreibgeschützt; das
dynamische Formularschema zeigt kein JSON-Eingabefeld dafür.

`GET /api/cohorts/<id>/progression/` liefert effektive und Standardsemester,
Fixierungen, bereits übernommene Veranstaltungen, Belastung je Semester,
Fehler, Hinweise, Grenzen und die aktuelle Einrichtungsrevision.

`POST` auf denselben Endpunkt verlangt die aktuelle `revision` und akzeptiert `operation`: `preview`, `propose`
oder `save`. Beispiel:

```json
{
  "operation": "preview",
  "revision": 12,
  "schedule": {"42": {"semester": 4, "pinned": true}},
  "limits": {"semester_credit_limit": 30, "semester_weekly_limit": 24, "semester_difficulty_limit": 60}
}
```

Die Schlüssel sind IDs der Lehrveranstaltungen derselben Lehrplanversion.
Nur abweichende oder fixierte Zuordnungen werden gespeichert. `propose` liefert
zusätzlich `moves` und eine Erklärung, ohne zu speichern. `save` verlangt
zusätzlich `revision` aus der aktuellen Vorschau und keine Voraussetzungskonflikte.
Es verändert ausschließlich den Jahrgang, nicht die Lehrplanversion.
Semesterübernahme und Validierung der Veranstaltung verwenden die effektive
Semesterzuordnung. Bereits übernommene Veranstaltungen können durch den
Jahrgangsverlauf nicht verschoben werden. Grenzen sind weich; Verletzungen
der Voraussetzungen, ungültige Zuordnungen und veraltete Stände sind Fehler.

## campusAI (intern, nur lesend)

- `GET /api/campusai/status/`: lokaler Modellstatus und expliziter Verfügbarkeitsgrund.
- `GET /api/campusai/context/?plan=<id>&cohort=<id>`: aktuelle Fakten, berechnete Hinweise, Semesterbelastung und Revision. Beide Filter sind optional; bei gemeinsamer Auswahl muss der Jahrgang zum Plan gehören.
- `POST /api/campusai/chat/`: `{ "question": "Wie lege ich einen Jahrgang an?", "plan": 1, "use_model": false, "history": [] }`. `cohort` ist optional; Verlaufseinträge verwenden `role: user|assistant` und `content`.

Beide Kontext-Endpunkte akzeptieren zusätzlich `page` (bekannte Verwaltungsseite),
`step` (0–5), `resource` (bekannte Stammdatenkategorie), `study_version`, `view_cohort`, `building`
und `floor`. Alle Datensatz-IDs werden auf die aktuelle Einrichtung geprüft;
ein Stockwerk muss zum angegebenen Bereich gehören. Kontextantworten enthalten
`view`, `proactive` mit bis zu zwei passenden Hinweisen und Aktionen sowie
`action_requirements`. Die Strukturprüfung verwendet die ausgewählte Lehrplanversion.
Chatantworten enthalten `actions: [{id, label}]` und `auto_action: id|null`.
Reine Begrüßungen, Namensfragen und Dank erhalten zusätzlich `intent:
greeting|identity|thanks`, leere Aktionen und Quellen und keinen Modellaufruf.
Nur eindeutige Befehle ergeben eine automatische UI-Aktion. Der Browser prüft
die ID gegen `shared/campus-ai-actions.json` und öffnet eine Ansicht oder ein
ungespeichertes Formular. `view_cohort` wählt für den Einrichtungsschritt Jahrgänge
den tatsächlich sichtbaren Studienverlauf, unabhängig vom Hintergrundplan.
Die Endpunkte selbst schreiben keine Datensätze.

Die Antwort enthält `answer`, `mode: help|local`, `model`, `sources`,
`revision` und stets `changed: false`. Bei Modellproblemen ist `mode: help`
mit `service_note` gesetzt. Anmeldung, Mandantenzuordnung und beim POST
CSRF sind erforderlich. Fremde Plan-/Jahrgangs-IDs ergeben 404; ungültige
Eingaben 400, mehr als zwölf Chat-Anfragen pro Minute 429. Kein Modelldownload
und keine Datenmutation durch diese Endpunkte. [Grenzen und Konfiguration](CAMPUS_AI.md).
