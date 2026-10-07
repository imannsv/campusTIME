# Prüf- und Übergabestand

Stand: 07.10.2026. Eigenständige Umsetzung unter `apps/landingpage`, Branch `landingpage`.

## Umgesetzt

- Deutsche Produktseite mit Navigation, fiktiven Produktansichten, Einrichtungsschritten, getrennten Schul-/Hochschulabläufen, Freddy, Angebotsbereich und FAQ.
- React/TypeScript/Vite mit eigenem Paketmanifest und Lockfile; keine Änderungen an Produktfrontend, Backend oder Root-Vercel-Konfiguration.
- Statische HTML-Ausgabe für Startseite, Impressum, Datenschutz und 404.
- Lokale Schriften, Logo, Favicon und PNG-/SVG-Vorschaugrafik; keine Tracker oder Fremdeinbettungen.
- Konfigurierbarer echter E-Mail-Kontaktweg. Aktuell klar gekennzeichneter Hinweis, da keine bestätigte Adresse vorliegt.
- Rechtliche Entwurfsseiten und überprüfte Freigabesicherung. Öffentliche Freigabe benötigt Domain, Kontakt und freigegebene Inhalte.
- Eigenständige Vercel-Konfiguration mit Buildfilter ausschließlich für `landingpage`.
- Umsetzung auf GitHub im Branch `landingpage` gespeichert und mit dem lokalen Checkout abgeglichen; `main` bleibt unverändert.
- Logo an die bestehende Produktmarke angeglichen: `campuszeit.`, DM Sans 800, vier gedrehte farbige Quadrate; durchgängig in Seite, Favicon und Vorschaugrafik. Build und alle zwölf Tests bestanden nach der Korrektur erneut; visuell und unabhängig geprüft.
- Recherchierte Impressums- und Datenschutzentwürfe mit Platzhaltern für Anbieter, Kontakt und tatsächliche Betriebsangaben eingebaut. Lesbare Texte und Ausfüllhinweise mit Primärquellen stehen in `RECHTSTEXTE.md` und `RECHTLICHE_ANGABEN.md`.
- Öffentliche Freigabe mit ungelösten Klammerplatzhaltern wird auch bei versehentlich gesetztem `approved: true` abgewiesen. Desktop- und Mobilansichten der längeren Rechtsseiten geprüft; alle 13 Tests bestehen.

## Verifiziert

| Prüfung | Ergebnis |
| --- | --- |
| TypeScript und Client-/Serverbuild | Bestanden |
| Statische Erzeugung von 4 Seiten | Bestanden |
| 6 Node-Tests | Bestanden |
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

Die lokalen Tests gegen Vite preview prüfen den dargestellten 404-Inhalt, nicht den HTTP-Status des Hostings. Im neuen Vercel-Projekt wurden die Rechtsseiten mit HTTP 200 und eine unbekannte Route mit HTTP 404 und eigener Fehlerseite anschließend geprüft. Der Benutzer hat manuelle CLI-Deployments gewählt; eine Git-Verbindung ist dafür nicht erforderlich.

## Vercel-Vorschau

- Team: `jakob-fee8`; Projekt: `campuszeit-landingpage` (`prj_zITmXtZRWcLAv5dOSaATMyIFsMVn`).
- Vorschau: https://campuszeit-landingpage-gkvbucbz0-jakob-fee8.vercel.app
- Deployment: `dpl_Cb5gdmKSoYXFA9UpZRT8GWgP4YXP`, Ziel **preview**, Status **READY**, Builddauer 17 Sekunden.
- Quellstand: `36a9c6dee966dbb251965eae6cf56c513a55e520`, Branch `landingpage`. CLI-Upload eines isolierten Snapshots mit ausschließlich Landingpage-Dateien; kein Git-Deployment.
- Root Directory `apps/landingpage`, Framework Vite, Node 24.x, `npm ci`, `npm run build`, Ausgabe `dist`, Systemvariablen und Ignored Build Step eingerichtet.
- Entwurfsmodus (`PUBLIC_RELEASE=false`), keine Canonical-URL; Hauptseite, Impressum und Datenschutz mit `noindex, nofollow`; robots sperrt Crawling, Sitemap ohne öffentliche URLs.
- Vercel Authentication für **alle** Deployments und Adressen (`ssoProtection.deploymentType=all`). Für die neue Vorschau Startseite und beide Rechtsseiten authentifiziert mit HTTP 200 und `noindex, nofollow` geprüft; Rechtsseiten zeigen den Entwurfshinweis. Unangemeldeter Impressumsaufruf liefert HTTP 302 zur Vercel-Anmeldung. robots/Sitemap/Favicon und unbekannte Route mit eigener HTTP-404-Seite wurden beim vorherigen Deployment geprüft.
- Beim ersten CLI-Deployment ordnete Vercel trotz angefordertem Preview das initiale Deployment dem Ziel production zu. Die automatisch angelegte Adresse `campuszeit-landingpage.vercel.app` war kurz öffentlich erreichbar, bis der Schutz auf `all` erweitert wurde. Sie ist jetzt ebenfalls geschützt. Es wurden keine echten Kontakt-/Betreiber- oder Personendaten veröffentlicht. Danach wurde ein separates Preview-Deployment erstellt und verifiziert.
- Authentifizierte Browserprüfung der neuen Vorschau durchgeführt: Impressum am Desktop und Datenschutz auf Mobilgerät mit sichtbaren Abschnitten und Platzhaltern; bei 390 Pixeln kein horizontaler Überlauf. Lokale Rechtsseiten ebenfalls visuell geprüft. Nachweise im ignorierten `artifacts/`.
- Beim vorherigen Logo-Deployment stimmten ausgelieferte JavaScript-/CSS-Dateien und PNG-Vorschaugrafik per SHA-256 mit dem lokal getesteten Build überein. Der neue Textbuild wurde anhand seiner Quellcommit-Metadaten, HTTP-Antworten und gerenderten Inhalte geprüft.
- Git-Verbindung zu `imannsv/campusTIME` wurde von Vercel abgewiesen. Der Benutzer möchte beim manuellen Deployment bleiben. Root-Verzeichnis und Branchfilter sind eingerichtet; der Ignored Build Step wurde bei den CLI-Deployments nicht ausgeführt.

Die lokale Vercel-Verknüpfung und heruntergeladene Entwicklungsvariablen liegen ausschließlich in ignorierten Dateien. Keine Tokens, Bypass-Schlüssel oder Umgebungsdateien gehören ins Repository.

## Offen für die öffentliche Übergabe

1. Platzhalter durch bestätigte Kontakt-, Betreiber- und Betriebsangaben ersetzen, nicht einschlägige Abschnitte entfernen und Inhalte freigeben.
2. Hostingvertrag, Rollenverteilung, Drittlandgarantien und Tarifnutzung klären: Das Projekt nutzt Hobby; das veröffentlichte Vercel-DPA nennt Pro/Enterprise. Ein wirksamer AVV ist nicht nachgewiesen. E-Mail-Dienstleister und tatsächliche Löschfristen bestätigen.
3. Zieladresse in `SITE_URL` eintragen und freigegebene Umgebung bauen; Live-Routen, Canonical, Sitemap und Kontakt prüfen.
4. Falls weiterhin gewünscht: Projektzugriff für Iman mit bestätigter Empfängeridentität einrichten. Es wurde keine Einladung versendet.

Bis dahin bleibt die Seite ein geschützter, lokal und auf Vercel prüfbarer Entwurf. Ein bestehendes Produktprojekt wurde weder umgestellt noch verändert. Es wurden keine Domains oder kostenpflichtigen Dienste gebucht.

Lokale Screenshots liegen im ignorierten Verzeichnis `artifacts/`; Buildausgabe in `dist/`. Konzept und ausführliche Start-/Deployment-Anweisungen stehen in DESIGN.md und der Projekt-README.
