# Prüf- und Übergabestand

Stand: 06.10.2026. Eigenständige Umsetzung unter `apps/landingpage`, Branch `landingpage`.

## Umgesetzt

- Deutsche Produktseite mit Navigation, fiktiven Produktansichten, Einrichtungsschritten, getrennten Schul-/Hochschulabläufen, Freddy, Angebotsbereich und FAQ.
- React/TypeScript/Vite mit eigenem Paketmanifest und Lockfile; keine Änderungen an Produktfrontend, Backend oder Root-Vercel-Konfiguration.
- Statische HTML-Ausgabe für Startseite, Impressum, Datenschutz und 404.
- Lokale Schriften, Logo, Favicon und PNG-/SVG-Vorschaugrafik; keine Tracker oder Fremdeinbettungen.
- Konfigurierbarer echter E-Mail-Kontaktweg. Aktuell klar gekennzeichneter Hinweis, da keine bestätigte Adresse vorliegt.
- Rechtliche Entwurfsseiten und überprüfte Freigabesicherung. Öffentliche Freigabe benötigt Domain, Kontakt und freigegebene Inhalte.
- Eigenständige Vercel-Konfiguration mit Buildfilter ausschließlich für `landingpage`.
- Umsetzung auf GitHub im Branch `landingpage` gespeichert und mit dem lokalen Checkout abgeglichen; `main` bleibt unverändert.

## Verifiziert

| Prüfung | Ergebnis |
| --- | --- |
| TypeScript und Client-/Serverbuild | Bestanden |
| Statische Erzeugung von 4 Seiten | Bestanden |
| 5 Node-Tests | Bestanden |
| 7 Playwright-Prüfungen | Bestanden |
| axe: Startseite bei 320, 390, 768 und 1440 Pixeln | Keine Verstöße in geprüften WCAG-A-/AA-Regeln |
| Ohne JavaScript: Inhalte, FAQ und mobile Ankernavigation | Bestanden |
| Produktansichten, Menü/Escape/Fokus, Rechtsseiten und 404-Inhalt | Bestanden |
| Desktop- und Mobil-Screenshots | Visuell geprüft |
| Generierte Open-Graph-Grafik | Visuell geprüft, Schriftzeichen als eingebettete Konturen |
| Browserkonsole | Keine Fehler im geprüften Browser |
| Öffentliche Freigabe ohne Betreiberangaben | Erwartungsgemäß abgewiesen |
| Demo-Link | HTTP 200 am 06.10.2026 |
| npm-Abhängigkeiten | Audit meldet keine bekannten Schwachstellen bei Installation |

Eine unabhängige Codeprüfung fand keine kritischen oder wesentlichen Probleme. Der Hinweis auf verdeckte Ankerüberschriften ohne JavaScript wurde mit einem zuerst fehlschlagenden Browsertest reproduziert und behoben. Alle sieben Browserprüfungen bestanden danach erneut. Das ist keine vollständige manuelle WCAG-Zertifizierung.

Die Tests gegen Vite preview prüfen den dargestellten 404-Inhalt, nicht den HTTP-Status des produktiven Hostings. Vercel-Routing und Git-Deployments müssen am neuen Projekt geprüft werden.

## Offen für die öffentliche Übergabe

1. Bestätigte Kontaktadresse und Betreiber-/Impressumsdaten; tatsächliche Datenschutzinhalte und Freigabe.
2. Bestätigtes Vercel-Konto/Team und Authentifizierung. Die lokale CLI meldete „Logged out“; der angebotene Vercel-Zugang ist nicht verbunden.
3. Neues Vercel-Projekt mit Root `apps/landingpage`, Production Branch `landingpage` und aktivierten Systemvariablen anlegen; Einstellungen und Buildfilter in Logs bestätigen.
4. Zieladresse in `SITE_URL` eintragen und freigegebene Umgebung bauen; Live-Routen, Canonical, Sitemap und Kontakt prüfen.
5. Projektzugriff für Iman mit bestätigter Empfängeridentität einrichten. Es wurde keine Einladung versendet.

Bis dahin bleibt die Seite ein lokal prüfbarer Entwurf. Ein bestehendes Produktprojekt wurde weder umgestellt noch verändert. Es wurden keine Domains oder kostenpflichtigen Dienste gebucht.

Lokale Screenshots liegen im ignorierten Verzeichnis `artifacts/`; Buildausgabe in `dist/`. Konzept und ausführliche Start-/Deployment-Anweisungen stehen in DESIGN.md und der Projekt-README.
