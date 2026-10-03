# GitHub, Vercel und Supabase

Stand: 03.10.2026. Die laufende Produkttestumgebung verwendet weiterhin lokale SQLite-Daten. Es wurden keine Kundendaten zu Supabase übertragen und noch keine vollständige Live-Anwendung bereitgestellt.

## Zuordnung

| Ressource | Ziel | Geprüfter Stand |
| --- | --- | --- |
| GitHub | `imannsv/campusTIME` | Quellcode auf `main`; lokales `origin` eingerichtet |
| Vercel | `imanabi/campustime` | Projekt in Team `imanabi` vorhanden; lokale Zuordnung in `.vercel/project.json` |
| Supabase | `knwieisajkaiphosfssa`, Name `campusTIME` | Gesund, PostgreSQL 17, Region `eu-west-1`; im Schema `public` noch keine Anwendungstabellen |

`.vercel/project.json` ist lokal und wird nicht eingecheckt. Zugangsdaten und Datenbankdateien sind von Git und Container-Builds ausgeschlossen.

## Aufbau für den Livebetrieb

Die bestehende Anwendung besteht aus einer Vite-Oberfläche, einem Django-Webdienst, einem Celery-Worker mit OR-Tools, Redis und dauerhaft gespeicherten Grundrissdateien. Für diese Architektur kann Vercel die Oberfläche bereitstellen; der langlebige Webdienst und der Planungsworker benötigen zusätzlich einen Backend-Host. Supabase übernimmt dann PostgreSQL. Dieser Host ist bisher nicht angegeben oder eingerichtet.

Nach Bereitstellung des Backend-Hosts:

1. Die Oberfläche über Vercel mit dem GitHub-Repository verbinden. `vercel.json` legt Framework Vite, Build `npm run build`, Ausgabe `dist` und die SPA-Route für Anzeigen fest. Damit wird zunächst nur die Oberfläche gebaut; Anmeldung und Datenzugriffe benötigen noch das Backend.
2. Sobald die Backend-Domain bereitsteht, `deploy/vercel.example.json` als `vercel.json` ins Projekt kopieren und die Backend-Domain an beiden Stellen ersetzen. Die API- und Admin-Regeln müssen vor der SPA-Regel bleiben. Das Beispiel enthält Platzhalter und ist noch keine aktive Backend-Anbindung.
3. Die Django-Umgebung mit den Werten aus `.env.supabase.example` konfigurieren. Diese Datei enthält ausschließlich Platzhalter; Django lädt sie nicht automatisch. Webdienst und Worker bekommen dieselben Datenbank-/Redisvariablen über die Laufzeitumgebung des Hosts.
4. `ALLOWED_HOSTS` auf die Backend-Domain setzen, `CSRF_TRUSTED_ORIGINS` auf die tatsächliche Vercel-/eigene Frontend-Domain. Session- und CSRF-Cookies benötigen HTTPS. Keine pauschale Freigabe aller Preview-Domains.
5. Redis privat bereitstellen, Medien persistent speichern und den Backend-Host inklusive Backupprüfung nach `OPERATIONS.md` abnehmen. Die mitgelieferte Compose-Datei nutzt ihre eigene lokale PostgreSQL-Datenbank; für Supabase die Datenbankvariablen für Webdienst/Worker und den Backupdienst gezielt anpassen.
6. Django-Migrationen ausführen, Betriebs-/Kundenkonto mit eigenen Zugangsdaten anlegen und Anmeldung, Freigabe, Solver und öffentliche Tagesanzeigen über die Live-Domain prüfen. `seed_demo` und `seed_showcase` bleiben ausschließlich lokale Entwicklungsbefehle.

Vercel unterstützt externe Backend-Rewrites; Details: [Vercel-Dokumentation](https://vercel.com/docs/routing/rewrites).

## Supabase-Verbindung und Schema

Die Projekt-URL `https://knwieisajkaiphosfssa.supabase.co` ist die API-Adresse. Django benötigt eine PostgreSQL-Verbindung samt Datenbankpasswort. In Supabase unter **Connect** die Verbindungsdaten kopieren. Für einen dauerhaften Backend-Host kommt eine direkte Verbindung infrage, bei IPv4-only ein Session-Pooler. Pooler-Host und Benutzer aus dem Dialog übernehmen. Für dieses Setup keinen Transaction-Pooler einsetzen; der konfigurierte Schema-Suchpfad gehört zur Sitzung. Siehe [Supabase-Verbindungsdokumentation](https://supabase.com/docs/guides/database/connecting-to-postgres).

Die Anwendung erzwingt bei Supabase-Hosts SSL und ein eigenes Schema, standardmäßig `campustime`. Dieses Schema vor den Django-Migrationen mit dem vorgesehenen Backend-Datenbankbenutzer als Eigentümer anlegen. Es darf in Supabase nicht als Data-API-Schema exponiert werden; `anon` und `authenticated` erhalten darauf keinen Zugriff. Die Mandantenprüfung und Anmeldung laufen weiter über Django. Supabase Auth wird durch diese Anbindung nicht aktiviert.

Beispiel für den Betreiber, auszuführen mit einem berechtigten Datenbankkonto:

```sql
CREATE SCHEMA campustime AUTHORIZATION <backend_db_role>;
REVOKE ALL ON SCHEMA campustime FROM PUBLIC, anon, authenticated;
```

Den Platzhalter durch den tatsächlich gewählten, korrekt quotierten Datenbankrollennamen ersetzen. Kein Datenbankpasswort oder Service-Role-Schlüssel gehört in `VITE_*`-Variablen oder ins Repository. Fehlt das Schema, schlagen Migrationen fehl; die Konfiguration fällt nicht auf `public` zurück.

Diese Vorbereitung wurde lokal mit PostgreSQL geprüft. Die tatsächliche Supabase-Verbindung kann erst nach sicherer Hinterlegung der Datenbankzugangsdaten beim gewählten Backend-Host geprüft werden. Am verbundenen Supabase-Projekt wurden bisher keine Migrationen ausgeführt.
