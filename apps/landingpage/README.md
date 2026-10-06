# CampusZeit Landingpage

Eigenständige deutsche Produktseite auf dem Branch `landingpage`. React, TypeScript und Vite mit statisch erzeugtem HTML. Die bestehende CampusZeit-Anwendung und ihre Vercel-Konfiguration bleiben unverändert.

## Lokal starten

Node.js ab 22.12, empfohlen Node.js 24 LTS. Im Repository:

```powershell
cd apps/landingpage
npm.cmd ci
npm.cmd run dev
```

Entwicklung: `http://127.0.0.1:5180`. Produktionsbuild prüfen:

```powershell
npm.cmd run build
npm.cmd run preview
```

Vorschau: `http://127.0.0.1:4180`. Der Build erzeugt vollständiges HTML für Startseite, Impressum, Datenschutz und 404. Die Produkttexte und FAQ bleiben ohne JavaScript lesbar. Produktansichten verwenden ausdrücklich fiktive Daten; die Demo verlinkt auf die bestehende Browser-Demo.

## Tests

```powershell
npm.cmd test
npm.cmd exec playwright install chromium
npm.cmd run test:browser
npm.cmd run check:release
```

Die Freigabeprüfung muss im aktuellen Entwurfsstand fehlschlagen. Sie prüft die noch fehlende öffentliche Konfiguration; das ist kein Fehler des lokalen Builds. Browserprüfungen laufen gegen den zuvor erstellten Build und starten bei Bedarf den Vorschau-Server. Sie prüfen Tastaturbedienung, die Navigation auch ohne JavaScript, Produktansichten, FAQ, direkte Unterseiten, mobile Breite und axe-Regeln bei 320, 390, 768 und 1440 Pixeln.

## Kontakt und rechtliche Inhalte

`.env.example` nach `.env.local` kopieren. `SITE_URL` ist die endgültige HTTPS-Domain ohne Pfad; `CONTACT_EMAIL` eine bestätigte Kontaktadresse. Beide sind öffentliche Angaben und werden in die HTML-Ausgabe aufgenommen. Keine Geheimnisse dort eintragen.

Mit einer Adresse erscheint ein E-Mail-Link für Demo- und Angebotsanfragen. Dieser öffnet das E-Mail-Programm; er behauptet keinen erfolgten Versand. Ohne Adresse steht ein transparenter Hinweis im Kontaktbereich.

`content/legal.json` nimmt freigegebene Texte auf:

```json
{
  "approved": false,
  "imprint": [{ "heading": "Abschnittsüberschrift", "paragraphs": ["Vom Anbieter freigegebener Inhalt."] }],
  "privacy": [{ "heading": "Abschnittsüberschrift", "paragraphs": ["Vom Anbieter freigegebener Inhalt."] }]
}
```

Dieses Beispiel beschreibt ausschließlich das Datenformat und ist kein verwendbarer Rechtstext. Erst nach tatsächlicher Freigabe `approved` auf `true` setzen. Danach `PUBLIC_RELEASE=true` setzen und `npm run check:release` sowie den vollständigen Build prüfen. Ohne Domain, Kontakt oder freigegebene Rechtsinhalte bricht ein öffentlicher Build ab. Im Entwurfsmodus: `noindex, nofollow`, robots.txt mit `Disallow: /`, leere Sitemap und keine erfundene Canonical-Domain. Sobald öffentlich freigegeben, entstehen Canonical-URLs, Sitemap und absolute Open-Graph-Bildadresse für `SITE_URL`.

Keine Tracker, Kontakt-API, Cookie-Speicherung oder eingebetteten Fremddienste. Alle Schriften und Grafiken werden lokal ausgeliefert. Die tatsächlichen Hosting- und Kontaktprozesse müssen in den freigegebenen Datenschutzhinweisen berücksichtigt werden.

## Separates Vercel-Projekt

Neues Projekt, z. B. `campuszeit-landingpage`, im vom Benutzer bestätigten Konto anlegen. Die vorhandene Produktzuordnung **nicht** verwenden.

| Einstellung | Wert |
| --- | --- |
| Repository | `imannsv/campusTIME` |
| Root Directory | `apps/landingpage` |
| Production Branch | `landingpage` |
| Framework | Vite |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Ignored Build Step | `node scripts/ignore-build.mjs` |

Vercel-Systemvariablen aktivieren. Die lokale `vercel.json` enthält denselben Branchfilter. Vercel führt bei Exit-Code `1` den Build aus, bei `0` überspringt es ihn. Nur `landingpage` wird zugelassen; auch ein fehlender Branchwert führt zum Überspringen. Production Branch und Root Directory zusätzlich im Dashboard prüfen, da die Datei sie nicht festlegt.

Ein Entwurf gehört hinter die Zugriffssperre des neuen Vercel-Projekts; `noindex` ist keine Zugriffskontrolle. Nicht öffentlich als fertige Seite bereitstellen, solange Anbieterangaben und Freigabe fehlen. Keine Domain oder kostenpflichtigen Zusatzdienste buchen.

Aktueller Prüfstand: Im Team `jakob-fee8` besteht das eigene Projekt `campuszeit-landingpage` mit [geschützter Vorschau](https://campuszeit-landingpage-gb57j6kki-jakob-fee8.vercel.app) aus Commit `e58f83d`. Vercel Authentication gilt für **alle** Adressen. Die GitHub-Verbindung ist noch nicht freigegeben; automatische Deployments und Production Branch `landingpage` sind deshalb noch offen. Details und verifizierte HTTP-Status stehen in `docs/STATUS.md`.

Für CLI-Deployments mit Root Directory `apps/landingpage` muss das Upload-Verzeichnis diese relative Struktur enthalten. Ein direktes Deployment aus dem App-Unterordner würde den Pfad verdoppeln. Verwendet wurde ein isolierter Snapshot ausschließlich der getrackten Landingpage-Dateien. Beim allerersten Deployment kann Vercel das Ziel production automatisch zuweisen; Zugriffsschutz für sämtliche Adressen deshalb **vor** dem Upload setzen und das tatsächliche Ziel danach mit `vercel inspect` prüfen.

Nach Bereitstellung prüfen:

- Projektname, Production Branch, Root Directory und freigegebene Umgebung bestätigen.
- Deployment-Logs zeigen, dass der Branchfilter für `landingpage` weiterbaut; `main` und andere Branches werden übersprungen.
- `/`, `/impressum/` und `/datenschutz/` direkt aufrufen; unbekannte Route liefert HTTP 404 mit eigener Seite. Die Vite-Vorschau liefert für unbekannte Routen einen SPA-Fallback mit HTTP 200 und ersetzt diese Produktionsprüfung nicht.
- Demo-Link, Kontakt, Metadaten, Canonical, Sitemap und Mobil-/Desktopdarstellung prüfen.
- Iman erhält den Live-Link und Projektzugriff über die vom Kontoinhaber bestätigte Einladung.

Die Root-`vercel.json` bleibt unverändert. Keine Zusammenführung nach `main`.

Offizielle Referenzen: [Vercel-Projektkonfiguration](https://vercel.com/docs/project-configuration), [Ignored Build Step](https://vercel.com/kb/guide/how-do-i-use-the-ignored-build-step-field-on-vercel).

## Aufbau

- `src/App.tsx`: Seiten, Navigation, Kontakt und Rechtsansichten.
- `src/ProductPreview.tsx`: fiktive Stundenplan-, Raum- und Prüfungsvorschau.
- `src/content.ts`: fachlich überprüfte Produkttexte und FAQ.
- `src/styles.css`: eigenständiges responsives Design.
- `scripts/prerender.mjs`: HTML, Metadaten, Sitemap, robots und Vorschaugrafik.
- `scripts/site-config.mjs`: Konfiguration und öffentliche Freigabeprüfung.
- `docs/DESIGN.md` und `docs/IMPLEMENTATION.md`: Konzept und Umsetzungsnachweis.
- `docs/STATUS.md`: Prüfstand und offene Übergabeschritte.

Schriftlizenzen für DM Sans und Manrope liegen in den jeweiligen Fontsource-Paketen unter OFL-1.1. Die SVG-Grafiken wurden für diese Landingpage erstellt; fontkit und resvg werden ausschließlich beim Build genutzt.
