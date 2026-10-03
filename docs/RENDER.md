# Backend auf Render vorbereiten

Diese Einrichtung ist ein Vorschlag für einen online erreichbaren Pilotbetrieb.
Die Vorlage ist vorbereitet, aber es wurden noch keine Render-Dienste gebucht
oder bereitgestellt. Vercel bleibt die Oberfläche, Supabase bleibt PostgreSQL.

## Vorgeschlagene Ressourcen und Kosten

| Ressource | Konfiguration | Monatlicher Grundpreis |
| --- | --- | --- |
| Django-Webdienst | Frankfurt, 0.5 CPU, 512 MB, ein Gunicorn-Prozess | 7 USD |
| Celery-Planungsworker | Frankfurt, 1 CPU, 2 GB, ein Auftrag gleichzeitig | 25 USD |
| Private Warteschlange | Render Key Value, 256 MB, Persistenz, keine Verdrängung | 10 USD |
| Grundrissspeicher | 1 GB am Webdienst | 0,25 USD |
| **Summe** | Kostenloser Hobby-Workspace, ohne zusätzliche Workspace-Gebühr | **42,25 USD** |

Preisstand: 03.10.2026, [Render-Preise](https://render.com/pricing).
Steuern, Mehrverbrauch bei Übertragung/Builds und bestehende Vercel-/Supabase-Kosten
sind nicht enthalten. Das ist eine Startkonfiguration für Tests, kein Kapazitätsnachweis
für einen Schulbetrieb. Bei Speicherengpässen den Webdienst auf 2 GB erhöhen
(dann insgesamt 60,25 USD Grundpreis). Die kostenlosen Dienste decken diese
Konfiguration mit dauerhaftem Speicher und separatem Worker nicht ab.

## Einrichtung nach Zustimmung

1. Einen Render-Account mit GitHub verbinden. Unter **New → Blueprint** das
   Repository `imannsv/campusTIME` und `render.yaml` auswählen. Vor **Deploy**
   die drei Dienste und die angezeigten Preise kontrollieren.
2. In Supabase unter **Connect** die Verbindungsdaten des **Session-Poolers**
   übernehmen. `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER` und
   `POSTGRES_PASSWORD` ausschließlich im Render-Eingabedialog hinterlegen.
   Die Supabase-Projekt-URL ist kein PostgreSQL-Host. Kein Transaction-Pooler.
3. Vor den ersten Migrationen das private Schema `campustime` in Supabase
   anlegen, wie in [CLOUD.md](CLOUD.md) beschrieben. Die Anwendung exponiert
   ihre Tabellen nicht über die Supabase Data API. Mit dem Datenbankkonto
   prüfen, dass es in diesem Schema Tabellen erstellen darf.
4. Render generiert das Django-Geheimnis; der Worker übernimmt dasselbe
   Geheimnis und die Datenbankdaten vom Webdienst. Redis wird nur über das
   private Netzwerk angesprochen. Migrationsfehler stoppen den Web-Deploy.
   Die Migration erzeugt keine Demo- oder Kundenkonten.
5. Die tatsächliche Webdienst-Adresse aus Render übernehmen. Die Vorlage
   übernimmt `RENDER_EXTERNAL_HOSTNAME` für `ALLOWED_HOSTS`; eine eigene
   Backend-Domain dort ergänzen, falls später benötigt.
6. In `deploy/vercel.example.json` alle Backend-Platzhalter durch die
   tatsächliche HTTPS-Adresse ersetzen und die Datei als `vercel.json`
   übernehmen. Dadurch bleiben Browseranfragen und Cookies auf derselben
   Vercel-Domain. Den neuen Stand nach GitHub pushen und den Vercel-Deploy
   abwarten. Keine erfundene Render-Adresse vorab eintragen.
7. In der Render-Shell am Webdienst mit `python manage.py provision` einen
   Verwaltungszugang mit eigenem Passwort anlegen, entsprechend
   [OPERATIONS.md](OPERATIONS.md). Passwort über `ADMIN_PASSWORD` sicher
   hinterlegen und danach entfernen. Kein lokales Demo-Passwort verwenden.
8. `npm run deployment:check -- https://campustime-flame.vercel.app` ausführen.
   Beide API-Prüfungen müssen erfolgreich sein. Danach mit dem neuen Konto
   Anmeldung, Datenspeicherung, eine automatische Planung und eine
   veröffentlichte Heute-/Morgen-Anzeige über die Live-Domain prüfen.

## Betriebshinweise für diesen Pilot

Automatische Backend-Deploys sind zunächst ausgeschaltet. Migrationen,
Webdienst und Worker koordiniert aktualisieren, damit keine Planung während
einer Schemaänderung läuft. Der Vercel-Git-Deploy bleibt davon unabhängig.

Grundrisse liegen auf dem persistenten Webdienst-Datenträger. Der Worker
verarbeitet Planungsdaten aus PostgreSQL und benötigt keinen Dateizugriff.
Render-Datenträger lassen sich nicht zwischen Diensten teilen; mit einem
Datenträger ist der Webdienst auf eine Instanz beschränkt und beim Deploy
kurzzeitig unterbrochen. [Render-Datenträger](https://render.com/docs/disks)

Die lokale Compose-Backuplösung ist für Render nicht aktiviert. Vor der
Übernahme echter Kundendaten PostgreSQL-Backups und Grundrisse getrennt
sichern und eine Wiederherstellung prüfen. Diese Vorlage allein ist noch
keine Abnahme des kommerziellen Betriebs.
