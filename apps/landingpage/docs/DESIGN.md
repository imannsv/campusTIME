# CampusZeit Landingpage

## Auftrag und Grenzen

Die Arbeitsanweisung unter `outputs/jakob-landingpage/Arbeitsanweisung-Jakob.md` ist das Briefing. Die Seite erklärt Hochschul- und Schulverwaltungen das aktuelle Produkt und führt zur Browser-Demo oder einer Kontaktanfrage. Umsetzung direkt auf dem vorgegebenen Branch `landingpage`, ausschließlich unter `apps/landingpage`. Produktdateien und bestehendes Vercel-Projekt bleiben unverändert.

## Gestaltung

Farben: Campusblau `#214b76`, Text `#20364a`, Mint `#6ed8bf`, heller Hintergrund `#f4f8fa`, Weiß `#ffffff`, Nebeninformation `#52677b`. Manrope für Überschriften, DM Sans für Fließtext, lokal ausgelieferte Latin-Schriftdateien. Links ausgerichtete Texte, großzügige Abstände und ein ruhiger Wechsel zwischen hellen Flächen und einem dunkelblauen Ablaufbereich.

Die Wochenplanung ist das zentrale visuelle Motiv. Eine ausdrücklich fiktive Produktvorschau zeigt Termin, Raum und Gruppe; ergänzende Ansichten erklären Räume und Prüfungen. Keine erfundenen Kennzahlen oder Referenzen, keine dekorativen Stockbilder. Funktionalität ist wichtiger als Animation. Navigation, Vorschau-Auswahl und FAQ funktionieren mit Tastatur; Inhalte und FAQ sind auch ohne JavaScript lesbar.

```text
Logo                  Produkt | Ablauf | Zielgruppen | Fragen      Demo
Konkreter Nutzen                    Fiktive Wochenplanung
Demo / Kontakt                      Termin mit Raum und Gruppe
Produktansichten: Stundenplan / Räume / Prüfungen
Vier tatsächliche Schritte von Einrichtung bis Veröffentlichung
Hochschulen                         Schulen
Freddy und seine nachvollziehbaren Grenzen
Individuelles Angebot / Kontakt
FAQ                                 Footer / Rechtliche Seiten
```

## Technik und Inhalte

Eigenständiges React-/TypeScript-/Vite-Projekt mit eigenem Lockfile. React-Rendering beim Build erzeugt vollständige HTML-Dateien für `/`, `/impressum/`, `/datenschutz/` und `/404.html`; der Client hydriert nur für Interaktionen. Keine Produkt-API, Tracker, Fremdeinbettungen oder Formulardienste. Schriften, Logo, Favicon und Vorschaugrafik gehören zum eigenen Projekt.

Demo-Link: `https://campustime-flame.vercel.app`, am 06.10.2026 per HTTP geprüft. Der Text nennt Testdaten, Browser-Speicherung und fehlende automatische Backendplanung. Freddy wird als Hilfe und Navigation beschrieben; das lokale Sprachmodell ist optional.

Kontakt erfolgt nach Bereitstellung einer Adresse per `mailto:`. Ohne Adresse wird kein funktionierender Versand behauptet; stattdessen steht ein klarer Hinweis neben dem Demo-Link. Impressum und Datenschutz zeigen zunächst einen ausdrücklich unfertigen Entwurfsstand. Freigegebene Inhalte werden in `content/legal.json` eingetragen. `SITE_URL`, `CONTACT_EMAIL` und `PUBLIC_RELEASE` steuern Metadaten und Freigabe. Ein öffentlicher Build setzt vollständige, freigegebene Angaben voraus. Vorher: `noindex`, gesperrte robots.txt und keine erfundene Canonical-Domain.

## Prüfung und Übergabe

Node-Tests prüfen Freigabevalidierung, Domain-/E-Mail-Eingaben und Branch-Buildfilter. Playwright prüft Navigation, Vorschau, FAQ, Rechtsseiten, JavaScript-freie Inhalte, mobile Breiten und Barrierefreiheit mit axe. Zusätzlich echte Browser- und Screenshotprüfung. Separates Vercel-Projekt: Root `apps/landingpage`, Production Branch `landingpage`, Ignored Build Step nur für diesen Branch. Veröffentlichung und Projektzugriff hängen von vorhandener Authentifizierung und bestätigten Anbieterangaben ab.
