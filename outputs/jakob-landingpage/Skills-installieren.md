# Skill-Paket für Jakob

Dieses Paket enthält acht ausgewählte Skills aus Imans aktuellem Setup für die CampusZeit-Landingpage. Es enthält keine Projekt-, Hochschul- oder Zugangsdaten. Die vollständige Arbeitsanweisung steht in `Arbeitsanweisung-Jakob.md`.

## Installation für Codex

1. ZIP außerhalb des Git-Repositories entpacken, zum Beispiel in einen eigenen Übergabeordner.
2. Die acht vollständigen Verzeichnisse unter `skills/` nach `~/.codex/skills/` kopieren. Unter Windows ist das üblicherweise `C:\Users\DEINNAME\.codex\skills\`.
3. Bereits vorhandene gleichnamige Skills vergleichen. Nicht automatisch überschreiben oder dieselben Skills zusätzlich als Plugin und lokale Kopie installieren.
4. Eine neue Codex-Sitzung öffnen und prüfen, dass die Skills erkannt werden. Vor der jeweiligen Aufgabe die zugehörige `SKILL.md` lesen. Alle Referenzdateien im selben Ordner behalten.

Unter Windows kannst du im entpackten Übergabeordner diese PowerShell-Befehle verwenden. Vorhandene Verzeichnisse werden übersprungen:

```powershell
$campusSkillTarget = Join-Path $HOME '.codex\skills'
New-Item -ItemType Directory -Path $campusSkillTarget -Force | Out-Null
Get-ChildItem -LiteralPath '.\skills' -Directory | ForEach-Object {
    $campusSkillDestination = Join-Path $campusSkillTarget $_.Name
    if (Test-Path -LiteralPath $campusSkillDestination) {
        Write-Warning "Schon vorhanden, bitte vergleichen: $($_.Name)"
    } else {
        Copy-Item -LiteralPath $_.FullName -Destination $campusSkillDestination -Recurse
    }
}
```

## Inhalt und Bezeichnungen

| Ordner im Paket | Bezeichnung in Imans Setup |
|---|---|
| `frontend-design` | `frontend-design:frontend-design` |
| `refactoring-ui` | `refactoring-ui` |
| `ui-typography` | `ui-typography` |
| `ux-heuristics` | `ux-heuristics` |
| `web-design-guidelines` | `web-design-guidelines` |
| `vercel-react-best-practices` | `vercel-react-best-practices` |
| `deployments-cicd` | `vercel:deployments-cicd` |
| `vercel-cli` | `vercel:vercel-cli` |

Bei lokaler Installation können die Plugin-Präfixe entfallen. Der Inhalt der jeweiligen `SKILL.md` bestimmt die Verwendung. Die Dateien sind eine Momentaufnahme vom 6. Oktober 2026. Aktuelle technische Einstellungen zusätzlich anhand der offiziellen Dokumentation prüfen.

## Tools und Konten zusätzlich einrichten

- Git und GitHub-Zugriff auf `imannsv/campusTIME`.
- Eine geeignete aktuelle Node.js-LTS-Version und npm.
- Browser mit Entwicklertools; Browser-Automation nach Verfügbarkeit.
- Eigener Vercel-Account und GitHub-Verbindung.
- Optional das offizielle [Vercel-Plugin](https://github.com/vercel/vercel-plugin), um zusätzlich die Vercel-Werkzeuge und Kontoanbindung zu erhalten. Bestehende lokale Vercel-Skills dann auf doppelte Installation prüfen.

Skill-Dateien allein richten keine Werkzeuge, API-Schlüssel oder MCP-Verbindungen ein. Nutze deine eigenen Anmeldungen. Das Übergabepaket ist nicht Teil der Landingpage und soll nicht als öffentliches Website-Asset ins Repository übernommen werden. Enthaltene Urheber- und Lizenzhinweise beibehalten.
