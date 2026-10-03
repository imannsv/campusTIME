# Campuszeit betreiben

## Container und HTTPS

1. `.env.example` nach `.env` kopieren. Eigenes langes Zufallsgeheimnis, Datenbankpasswort, Domain und HTTPS-Ursprung eintragen. `DEBUG=0` und `LOCAL_WORKER=0` werden im regulären Betrieb verwendet.
2. Einen Host in einer EU-Region bereitstellen. Die Compose-Datei enthält PostgreSQL, Redis, Webdienst, Celery-Worker und einen täglichen Backupdienst.
3. `docker compose build` und `docker compose up -d db redis` ausführen.
4. `docker compose run --rm web python manage.py migrate` ausführen.
5. Mit `docker compose run --rm web python manage.py createsuperuser` den gesonderten Betriebszugang anlegen.
6. `docker compose up -d web worker backup` starten.
7. HTTPS über einen vorgeschalteten Reverse Proxy bereitstellen. Der Webdienst bindet nur an `127.0.0.1:8000`. Bei `TRUST_PROXY=1` muss der Proxy eingehende `X-Forwarded-Proto`-Header überschreiben und selbst `https` setzen. `ALLOWED_HOSTS` und `CSRF_TRUSTED_ORIGINS` müssen zur tatsächlichen Domain passen.

Für einen rein lokalen Container-Probelauf kann in einer separaten Konfiguration `DEBUG=1`, `SECURE_SSL_REDIRECT=0` und der passende HTTP-Ursprung eingestellt werden. Produktionskonten niemals durch `seed_demo` anlegen.

## Betreute Kundenanlage

Die Plattform bietet bewusst keine Selbstregistrierung oder Zahlungsschnittstelle. Eine neue Einrichtung lässt sich nach Vertragsabschluss über den Managementbefehl anlegen:

```powershell
$env:ADMIN_PASSWORD = 'ein-eigenes-starkes-passwort'
docker compose run --rm -e ADMIN_PASSWORD web python manage.py provision --name 'Beispielschule' --slug beispielschule --username beispielverwaltung --kind school --license-until 2027-12-31
Remove-Item Env:ADMIN_PASSWORD
```

`--kind university` legt eine Hochschule an. Der Kundenbenutzer erhält kein `staff`- oder Superuserrecht. Weitere Verwaltungs-/Planungskonten und Lizenzverlängerungen werden im Betriebsbereich `/admin/` verwaltet. Ein Kundenkonto wird jeweils einer Einrichtung zugeordnet. Fachliche Stammdaten sind im Betriebsbereich schreibgeschützt; Bearbeitung erfolgt über die validierte Kundenoberfläche.

Bei Lizenzablauf bleiben lesende Zugriffe und veröffentlichte Anzeigen verfügbar; schreibende Kundenaktionen werden gesperrt. Betriebspersonal kann die Lizenz verlängern.

## Backups und Wiederherstellung

Der Backupdienst führt nach Start und anschließend alle 24 Stunden `scripts/backup.sh` aus. Er erstellt PostgreSQL-Archive und ein Archiv der Grundrisse. Lokale Backups werden 14 Tage aufbewahrt. Ein Fehler beendet den aktuellen Dienstlauf und wird über Containerstatus/Logs erkennbar.

Der benannte Docker-Backupdatenträger allein schützt nicht vor Hostverlust. Der Betreiber kopiert abgeschlossene Archive täglich in einen gesonderten, zugriffsgeschützten Speicher. Datenbank und Dateien werden nacheinander gesichert; für exakt zeitgleiche Wiederherstellung Uploads während des Backups pausieren oder konsistente Volume-Snapshots des Hosts verwenden.

Wiederherstellung zuerst in einer **separaten leeren Testumgebung** prüfen:

1. Datenbankarchiv mit `pg_restore --no-owner --dbname <testdatenbank> <archiv>` einspielen.
2. Passendes Medienarchiv in das Medienvolume der Testumgebung entpacken.
3. Anwendung mit derselben Codeversion starten; erst danach gegebenenfalls Migrationen ausführen.
4. Anmeldungen, Mandantentrennung, Lehrpläne, veröffentlichte Anzeigen und Grundrissdateien kontrollieren.

## Überwachung und Updates

- `GET /api/health/` extern über HTTPS überwachen; HTTP 503 weist auf Datenbank- oder Redisprobleme hin. Der Endpunkt beweist nicht, dass ein Worker tatsächlich Aufträge verarbeitet.
- `docker compose logs web worker backup` für Fehler, Planungsaufträge und Backups verwenden. Wiederholte `failed`-Jobs und lange `queued`-Zeiten überwachen.
- Planungsjobs sind zeitlich begrenzt. Ein gestoppter Worker kann einen Auftrag im Status `running` hinterlassen; nach Prüfung durch den Betrieb abbrechen und erneut starten.
- Vor Updates ein zusätzliches Backup erstellen, neue Version bauen, Migrationen ausführen und Container ersetzen. Veröffentlichung und Solver dürfen während einer Migration keine Daten schreiben.
- Die Raumverwaltung verwendet Bereiche, Stockwerke und Raumkacheln ohne externe Kartenquelle. Alte Grundrissdateien und Geometrien bleiben zur Datenkompatibilität erhalten.

Vor dem Verkaufsstart einen repräsentativen Pilot mit echten Planungsregeln, Datensätzen und parallelen Verwaltungszugriffen abnehmen. Die dokumentierten synthetischen Lasttests ersetzen diese Abnahme nicht.
