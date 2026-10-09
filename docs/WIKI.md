# CampusZeit Wiki

Die Benutzerhilfe läuft unter `/wiki` und wird über **Wiki & Hilfe** in einem neuen Tab geöffnet. Anmeldung und Einrichtungszuordnung sind erforderlich. Die öffentliche Browser-Demo bietet nur einen Hinweis auf die Vollversion. Sie enthält weder die vollständigen Artikel noch die Bilder.

## Inhalte über GitHub pflegen

1. Erstelle einen Arbeitsbranch von `main`.
2. Bearbeite den betreffenden Artikel in `shared/wiki/articles/<id>.md`. Verwende die tatsächlichen Beschriftungen der Anwendung. Nenne Voraussetzungen, einzelne Schritte, Abschlusskriterien und typische Fehler. Beschreibe geplante Funktionen ausdrücklich als noch nicht verfügbar.
3. Pflege Titel, Zusammenfassung, Suchbegriffe, Gruppe, übergeordneten Artikel, Datum und weiterführende Links in `shared/wiki/catalog.json`. Bestehende IDs bleiben stabil: Freddy und direkte Links verwenden sie. Ein neues `page` muss eine vorhandene Freddy-Seitenkennung verwenden.
4. Lege Screenshots ausschließlich mit fiktiven Daten als PNG in `shared/wiki/images/` ab. Registriere den Dateinamen in `images` beim Artikel. Binde das Bild mit aussagekräftigem Alternativtext ein: `![Raumformular mit Kapazität](/api/wiki/assets/rooms.png)`.
5. Verlinke andere Artikel mit `[Räume einrichten](/wiki/rooms)`. Überschriften ab Ebene 2 erhalten automatisch Sprungmarken. Rohes HTML wird nicht gerendert; externe Bilder sind nicht zugelassen.
6. Führe `npm run wiki:generate` und `npm run wiki:check` aus. Der Generator leitet Freddys kurze Bedienhilfe aus derselben Zusammenfassung und denselben IDs ab. `shared/campus-ai-knowledge.json` nicht getrennt bearbeiten.
7. Prüfe den Artikel in der angemeldeten Vollversion und erstelle einen Pull Request. Bilder, Artikel und Metadaten gehören in denselben Commit.

Die vollständigen Artikel werden vom Django-Backend gelesen. Nach einer Veröffentlichung muss das Backend neu gestartet werden, damit es den aktualisierten Katalog verwendet. Docker kopiert `shared/` bereits in das Backend-Image; kein Datenbankimport und keine Migration sind nötig.

## Authentifizierung und Auslieferung

| Endpunkt | Inhalt |
|---|---|
| `GET /api/wiki/` | Navigation, Metadaten und Volltext für die Suche |
| `GET /api/wiki/articles/<id>/` | Ein Markdown-Artikel |
| `GET /api/wiki/assets/<filename>` | Ein registriertes PNG |

Alle drei Endpunkte erfordern eine aktive Sitzung und eine Einrichtungsmitgliedschaft. Die Antworten verwenden `Cache-Control: private, no-store`. Es gibt keine öffentlich eingebundenen Wiki-Dateien und keinen Schreibendpunkt. Eine abgelaufene Lizenz verhindert den lesenden Zugriff nicht. Abmeldung in einem anderen Anwendungstab leert die Wiki; zusätzlich wird die Sitzung beim Fokussieren und alle 30 Sekunden geprüft. Bereits betrachtete Informationen können vom Leser natürlich selbst gespeichert werden.

## Reproduzierbare Bilder und Tests

`npm run test:wiki` startet einen separaten Django-Server mit einer temporären SQLite-Datenbank sowie einen eigenen Vite-Server. Die Beispieldaten sind fiktiv. Es werden keine bestehenden LFH-Daten geändert. Unter Windows muss die vorhandene `.venv` mit den Backend-Abhängigkeiten eingerichtet sein.

Für neue Screenshots in zwei Terminals starten:

```powershell
.venv/Scripts/python.exe -u scripts/wiki-test-server.py 8123
npm run build:wiki-test
node scripts/wiki-test-vite.mjs
```

Anschließend `npm run wiki:screenshots`. Danach die beiden Server beenden. Das Skript ist absichtlich auf den separaten Port 5186 festgelegt.

Prüfungen:

```powershell
npm run wiki:check
.venv/Scripts/python.exe backend/manage.py test planner.test_wiki --noinput
npm run test:wiki
npm test
npm run build
npm run build:demo
```

Die Wiki-Browsertests prüfen Anmeldung, erhaltene Artikellinks, Bilder, Suche, Inhaltsverzeichnis, Browserhistorie, Abmeldung über Tabs, Tastatur und Ansichten von 390 bis 1920 px. Der 720-px-Test entspricht dem verfügbaren CSS-Platz eines 1440-px-Bildschirms bei 200 % Zoom; er ersetzt keine manuelle Browserzoom-Prüfung.
