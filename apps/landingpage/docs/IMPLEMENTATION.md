# CampusZeit Landingpage Implementation Plan

> Umsetzung inline mit superpowers:executing-plans; abschließende unabhängige Prüfung. Das detaillierte Übergabebriefing und der Auftrag „setze um“ autorisieren die Umsetzung.

**Goal:** Eine eigenständige, prüfbare deutsche Produktseite für CampusZeit erstellen.

**Architecture:** React mit statischer HTML-Erzeugung beim Vite-Build. Konfiguration und rechtliche Inhalte steuern einen expliziten Entwurfs-/Freigabemodus. Hosting ausschließlich in einem separaten Vercel-Projekt.

**Tech Stack:** React, TypeScript, Vite, Node test runner, Playwright, axe.

**Spec:** `docs/DESIGN.md`, `../../outputs/jakob-landingpage/Arbeitsanweisung-Jakob.md` (vom Projektstamm aus).

## Global Constraints

- Ausschließlich Branch `landingpage` und Verzeichnis `apps/landingpage` bearbeiten.
- Bestehende Produktdateien, Root-vercel.json und bestehendes Vercel-Projekt nicht ändern.
- Keine erfundenen Kontaktdaten, Rechtstexte, Preise oder Referenzen.
- Browser-Demo eindeutig als Testdaten und eingeschränkten Funktionsumfang kennzeichnen.
- Öffentliche Freigabe erst mit bestätigter Domain, Kontaktadresse und freigegebenen Rechtsinhalten.

## Review Focus

- Fehlende Betreiberangaben: Entwurf ohne Versand-/Rechtsversprechen; Releaseprüfung schlägt fehl.
- Ohne JavaScript: Produktinhalte, Navigation und FAQ bleiben erreichbar.
- Sehr schmale Ansichten: keine horizontale Überbreite; nutzbare Produktvorschau.
- Direkte Unterseiten/404: eigenständiger Inhalt und korrekte Metadaten.
- Fremder Branch: Vercel-Build wird übersprungen; Produktdeployment bleibt unberührt.

## Task 1: Konfiguration und isolierter Build

- [x] Tests für `createSiteConfig(env, legal)` und `shouldIgnoreBuild(branch)` schreiben, erwartetes RED prüfen.
- [x] Eigenes package.json, Lockfile, TypeScript-/Vite-Konfiguration und getestete Konfiguration implementieren.
- [x] Tests ausführen; keine Änderung am Root-Paketmanifest.

## Task 2: Seite und statische Ausgabe

- [x] Browserprüfungen für Demo, Vorschau, Navigation, FAQ, Rechtsseiten und schmale Ansichten anlegen.
- [x] `src/App.tsx`, eigenständige Produktansichten, Inhalte und CSS implementieren.
- [x] Client-/Server-Einstieg und `scripts/prerender.mjs` mit Metadaten, robots und Sitemap implementieren.
- [x] Build, Browserprüfungen und Screenshots auf Mobilgerät/Tablet/Desktop prüfen.

## Task 3: Übergabe und Deployment

- [x] README, Status und eigene vercel.json mit Branchfilter und statischen Routen erstellen.
- [x] Gesamte Landingpage prüfen, unabhängige Prüfung durchführen, wesentliche Befunde beheben.
- [x] Ausschließlich Landingpage-Dateien committen und auf Branch `landingpage` übertragen.
- [x] Vercel-Zugang prüfen und fehlende Angaben/Authentifizierung transparent dokumentieren.
- [x] Eigenes Vercel-Projekt nach Anmeldung konfigurieren und geschützte Vorschau per HTTP prüfen.
- [ ] Git-Verbindung, entfernte Browserprüfung und öffentliche Freigabe nach bestätigten Kontakt-/Rechtsangaben abschließen.

## Fortschritt

- Briefing und Produktfunktionen gelesen; Demo HTTP 200.
- Mitgelieferte acht Skills außerhalb des Repositories installiert; vorhandene Skills nicht überschrieben.
- Ausführung im ausdrücklich vorgegebenen bestehenden `landingpage`-Checkout. Kein zusätzlicher Checkout oder Branch.
- Kontakt-/Anbieter-/Vercel-Angaben angefragt. Lokale Umsetzung abgeschlossen.
- Task 1 abgeschlossen: fünf Tests zuerst wegen fehlender Funktionen rot, nach Implementierung grün.
- Task 2 abgeschlossen: Hauptüberschrift zuerst nicht vorhanden; danach funktionsfähige Seite. Responsive-Test zeigte Überbreite bei 320 Pixeln; Schriftgröße und Grid korrigiert. Sieben Browserprüfungen grün.
- Unabhängige Prüfung ohne kritische/wesentliche Befunde. Mobile Ankernavigation ohne JavaScript als zusätzlicher Test zuerst rot (Überschrift unter Header), nach CSS-Korrektur grün. Keine zurückgestellten Befunde.
- Vorschaugrafik visuell geprüft und Fontkonturen eingebettet, damit Linux-/Windows-Builds ohne Systemschriften funktionieren.
- Task 3 zunächst lokal abgeschlossen; nach Vercel-Anmeldung geschützte Vorschau eingerichtet. Git-Verbindung und öffentliche Freigabe bleiben offen. Details in `docs/STATUS.md`.
- Umsetzung über die verbundene GitHub-Anbindung auf `landingpage` übertragen; lokaler und entfernter Stand abgeglichen. Keine Änderung an `main`.

## Logokorrektur

- [x] Produktlogo aus `src/App.tsx` und `src/styles.css` als verbindliche Vorlage übernehmen: vier abgerundete Quadrate, Originalfarben, −5° Drehung, `campuszeit.` in DM Sans 800 und hellblauer Punkt.
- [x] Navigation, Produktvorschau, Footer auf heller Fläche, Favicon und Vorschaugrafik angleichen; lokale Schrift und Laufweite auch im SVG-/PNG-Build berücksichtigen.
- [x] Build, fünf Konfigurationstests und sieben Browsertests bestanden; Desktop, Mobilansicht, Rechtsseite/Footer, Favicon und Vorschaugrafik visuell geprüft und mit der bestehenden Demo abgeglichen.
- [x] Unabhängige Prüfung ohne relevante Befunde. Änderungen ausschließlich unter `apps/landingpage`.

## Geschützte Vercel-Vorschau

- [x] Benutzer hat die CLI-Anmeldung abgeschlossen; einziges Team `jakob-fee8` geprüft und eigenes Projekt `campuszeit-landingpage` eingerichtet.
- [x] Root/Build/Node/Systemvariablen und Branchfilter konfiguriert; isolierten Snapshot des geprüften Commits `e58f83d` ohne Umgebungsdateien hochgeladen.
- [x] Preview-Ziel und READY geprüft; authentifizierte HTTP-Prüfung von Seiten, Entwurfsmetadaten und echtem 404 abgeschlossen. Schutz nach initialer automatischer Produktionszuordnung auf sämtliche Adressen erweitert und unangemeldeten Zugriff geprüft.
- [ ] GitHub-Repository-Zugriff und Verbindung, Production Branch `landingpage` und automatische Git-Builds einrichten; Vercel verweigerte bisher die Repository-Verbindung.
- [ ] Entfernte Browserdarstellung mit angemeldetem Vercel-Konto prüfen; In-App-Browser zeigt den erwarteten Login. Öffentliche Freigabe weiterhin erst nach bestätigten Kontakt-/Rechtsangaben.
