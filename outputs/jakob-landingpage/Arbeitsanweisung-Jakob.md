# Auftrag an Jakob: Landingpage für CampusZeit

Hallo Jakob,

bitte erstelle für **CampusZeit** eine vollständige, professionelle Landingpage. Sie soll Hochschulen, Schulen und deren Verwaltung erklären, was die Plattform bietet, den Nutzen verständlich zeigen und Interessenten zur Demo oder Kontaktaufnahme führen. Übernimm Konzeption, Texte, Gestaltung, Umsetzung, Prüfung und das separate Vercel-Deployment.

## 1. Arbeitsumgebung und GitHub

Repository: [imannsv/campusTIME](https://github.com/imannsv/campusTIME).

Lege bei dir einen Oberordner `CampusZeit` an und klone das Repository hinein. Arbeite ausschließlich im Branch **`landingpage`**. Wenn dieser schon existiert, verwende ihn weiter, statt ihn zu überschreiben. Bei einer frischen Einrichtung:

```powershell
mkdir CampusZeit
cd CampusZeit
git clone https://github.com/imannsv/campusTIME.git
cd campusTIME
git switch -c landingpage
```

Prüfe vorher die vorhandenen Remote-Branches. Die Befehle oben setzen voraus, dass `landingpage` noch nicht existiert.

Die Landingpage bekommt ein eigenes Projektverzeichnis mit eigenem Paketmanifest, Lockfile, Assets und Build:

```text
CampusZeit/
└── campusTIME/                 Repository, Branch landingpage
    └── apps/
        └── landingpage/       Eigenständige Landingpage
```

Lies vorhandene Repository-Anweisungen und die Produktdokumentation. Nutze die Anwendung als Informationsquelle. Das Produkt basiert aktuell auf React, TypeScript und Vite; für die Landingpage ist derselbe Stack eine sinnvolle Grundlage. Sorge für gut indexierbare Inhalte, bei Bedarf durch statische Generierung oder Prerendering.

Ändere weder den Standardbranch `main` noch die bestehenden Produktdateien, Backend-Konfigurationen oder das bestehende Vercel-Projekt. Verändere insbesondere nicht die bisherige `vercel.json` im Repository-Hauptverzeichnis. Lege die Landingpage-Konfiguration in `apps/landingpage/` an. Keine Zusammenführung in `main`, keine erzwungenen Pushes, keine fremden Branches löschen.

Committe gezielt die Landingpage-Dateien und pushe anschließend:

```powershell
git push -u origin landingpage
```

## 2. Was CampusZeit erklären soll

CampusZeit unterstützt die Verwaltung von Unterricht, Studium, Räumen und Prüfungen. Ziel ist ein zusammenhängender Ablauf: Einrichtung vorbereiten, Studien- oder Lehrpläne anlegen, Jahrgänge und Gruppen zuordnen, Veranstaltungen planen, Konflikte prüfen und Stundenpläne veröffentlichen.

Diese Bereiche gehören in die Produktdarstellung:

- **Räume:** Bereiche, Stockwerke und benannte Räume als übersichtliche Kacheln; Kapazität, Ausstattung, Belegung und Sperrzeiten.
- **Studien- und Lehrpläne:** Studiengänge, Semester, Module und Untermodule, Credit Points getrennt von Unterrichtsumfang sowie Prüfungsformen und Lehrplanversionen.
- **Jahrgänge und Gruppen:** mehrere Gruppen pro Jahrgang, Wahlpflichtkurse, gemeinsame Veranstaltungen und mehrere Lehrende pro Veranstaltung.
- **Planung:** Verfügbarkeiten der Lehrenden durch die Verwaltung, manuelle Planung, automatische Planungsvorschläge und Prüfung auf Konflikte.
- **Anpassungen:** Standardablauf für neue Jahrgänge übernehmen; Module für einen Jahrgang verschieben und die Semesterbelastung prüfen.
- **Prüfungen:** Klausuren mit Dauer, Nachschreibetermine, Räume und Aufsicht sowie Hausarbeiten, Abgaben und Fristen.
- **Veröffentlichung:** allgemeine Anzeigen für Woche, heute oder morgen mit Aktualisierung und optionalem Scrollen; eine eigene Übersicht mit Kurs- und Gruppenfiltern.
- **Freddy / CampusAI:** Unterstützung beim Umgang mit dem Tool, kontextbezogene Hinweise und Navigation. Beschreibe nur Funktionen, die du im aktuellen Stand nachvollziehen kannst.

Prüfe die Aussagen im Repository und der Anwendung. Eine implementierte Funktion ist nicht automatisch in der öffentlichen Browser-Demo vollständig verfügbar. Dort werden Testdaten verwendet; automatische Optimierung und weitere Serverfunktionen benötigen das Backend. Behaupte keine fertige mobile App, flächendeckende Hochschulintegration oder einsatzbereite Enterprise-Funktionen, wenn diese noch geplant sind.

## 3. Seitenumfang und Gestaltung

Erstelle zunächst eine deutsche Landingpage mit diesen Bestandteilen:

1. Klare Navigation, CampusZeit-Logo und gut sichtbarer Demo-/Kontaktaktion.
2. Einstieg, der Zielgruppe und konkreten Nutzen unmittelbar erklärt, mit passender Produktansicht.
3. Verständliche Darstellung der wichtigsten Funktionen mit echten, anonymisierten oder fiktiven UI-Beispielen.
4. Kurzer Ablauf vom Einrichten der Räume und Lehrpläne bis zum veröffentlichten Stundenplan.
5. Nutzen für Hochschulen und Schulen, ohne beide Abläufe als identisch darzustellen.
6. Ehrliche Vorstellung von Freddy und seiner Unterstützung.
7. Angebotsbereich mit „Individuelles Angebot“ beziehungsweise „Demo anfragen“; konkrete Preise sind noch nicht beschlossen.
8. FAQ zu Einrichtung, Planung, Änderungen, Raumbelegung, Prüfungen und veröffentlichten Ansichten.
9. Kontaktbereich sowie Footer mit Impressum und Datenschutz.

Gestalte die Seite ruhig, hochwertig und eigenständig. Orientiere dich an der Produktidentität, mit klarer Typografie, sinnvollen Abständen, guter Lesbarkeit und dezenten Animationen. Die Seite muss auf Handy, Tablet und Desktop überzeugen. Produktbilder sollen erklären, wie die Software hilft. Vermeide beliebige Werbesprüche, überladene Kacheln und dekorative Effekte ohne Zweck.

Verwende ausschließlich fiktive oder ausdrücklich freigegebene Daten. Keine echten Studierendendaten, internen LFH-Dokumente oder Hochschullogos als angebliche Kundenreferenz. Erfinde keine Kunden, Bewertungen, Erfolgszahlen, Zertifizierungen oder Datenschutzversprechen.

## 4. Funktionierende Inhalte und Technik

- Navigation, mobile Navigation, Links und alle sichtbaren Aktionen funktionieren.
- Verwende für die Demo den aktuellen, von Iman bestätigten Produktlink. Kennzeichne die Demo als Ansicht mit Testdaten.
- Setze einen echten Kontaktweg um, sobald Iman die Empfängeradresse beziehungsweise das gewünschte Verfahren bereitgestellt hat. Ein Formular darf nur Erfolg melden, wenn die Anfrage tatsächlich übermittelt wurde.
- Fehlende Kontaktdaten und rechtliche Angaben erhältst du von Iman. Bereite die entsprechenden Seiten vor; veröffentliche keine erfundenen Angaben und präsentiere Platzhalter nicht als fertige Rechtstexte.
- Ergänze passende Seitentitel, Beschreibungen, Open-Graph-Vorschau, Favicon, Sitemap, robots.txt und eine sinnvolle 404-Seite. Canonical-URLs und Sitemap müssen zur endgültigen Landingpage-Domain passen.
- Prüfe Tastaturbedienung, sichtbaren Fokus, Kontraste, Formularbeschriftungen, Alternativtexte und reduzierte Bewegung.
- Optimiere Bildgrößen, Schriften und Ladeverhalten. Keine unnötigen Tracker, eingebetteten Fremddienste oder zusätzlichen kostenpflichtigen APIs.
- Prüfe die Seite im Browser bei schmaler und breiter Ansicht auf abgeschnittene Inhalte, horizontales Scrollen und überlappende Elemente.

## 5. Eigenes Vercel-Projekt ausschließlich für landingpage

Falls du noch keinen Vercel-Account hast, erstelle einen eigenen und verbinde deinen GitHub-Zugang. Importiere unser Repository in ein **neues** Vercel-Projekt, zum Beispiel `campuszeit-landingpage`. Iman soll Zugriff auf dieses Projekt erhalten, damit die Übergabe möglich ist.

Konfiguriere:

- **Production Branch:** `landingpage`.
- **Root Directory:** `apps/landingpage`, im Vercel-Dashboard einstellen.
- **Install / Build / Output:** passend zum eigenständigen Landingpage-Projekt; bei Vite üblicherweise `npm ci`, `npm run build` und `dist`.
- Eigene Landingpage-Domain beziehungsweise zunächst die neue Vercel-Projektadresse.

Der Produktionsbranch allein unterbindet keine Preview-Builds anderer Branches. Stelle deshalb im neuen Projekt zusätzlich einen **Ignored Build Step** ein:

```sh
if [ "$VERCEL_GIT_COMMIT_REF" = "landingpage" ]; then exit 1; else exit 0; fi
```

Aktiviere die Bereitstellung der Vercel-Systemvariablen für diesen Schritt. Bei diesem speziellen Vercel-Feld bedeutet `0`: Build überspringen; `1`: Build ausführen. Damit werden nur Builds aus `landingpage` zugelassen. Prüfe dies in den Deployment-Einstellungen und Logs. Übersprungene Versuche anderer Branches können als abgebrochene Einträge erscheinen. [Vercel: Ignored Build Step](https://vercel.com/kb/guide/how-do-i-use-the-ignored-build-step-field-on-vercel).

Die Zielzuordnung ist:

| Branch | Inhalt | Vercel-Projekt |
|---|---|---|
| `main` | CampusZeit-Anwendung | Bestehendes Produktprojekt |
| `landingpage` | Separate Landingpage | Dein neues Landingpage-Projekt |

Ändere das bestehende Produktprojekt nicht. Sollte dessen Git-Integration zusätzlich Previews für `landingpage` erzeugen, melde das Iman zur getrennten Konfiguration. Die Produktadresse darf nicht auf die Landingpage umgestellt werden. Kaufe keine Domain oder Zusatzdienste ohne vorherige Abstimmung.

## 6. Skills aus Imans Setup

Im beigefügten Paket sind die für diesen Auftrag ausgewählten Skill-Ordner einschließlich ihrer Referenzdateien enthalten. Installiere diese bei dir und lies die jeweiligen Anweisungen vor der passenden Arbeitsphase. Der Plugin-Präfix kann bei dir anders lauten; maßgeblich ist der Skill selbst.

| Skill aus Imans Setup | Einsatz |
|---|---|
| `frontend-design:frontend-design` | Visuelles Konzept und professionelle Frontend-Umsetzung |
| `refactoring-ui` | Hierarchie, Layout, Abstände, Farben und verständliche UI-Texte |
| `ui-typography` | Schriftwahl, Größen, Zeilenlängen und responsive Typografie |
| `ux-heuristics` | Nutzerführung, Navigation und verständliche Interaktionen |
| `web-design-guidelines` | Abschließende Prüfung von Oberfläche, Bedienbarkeit und Barrierefreiheit |
| `vercel-react-best-practices` | React-Qualität, Ladeverhalten und Performance |
| `vercel:deployments-cicd` | Git-Anbindung, Branch-Trennung, Deployment und Rollback |
| `vercel:vercel-cli` | Vercel-Verwaltung und Diagnose, wenn du die CLI verwendest |

Installation in Codex: ZIP entpacken und die vollständigen Unterordner aus `skills/` nach `~/.codex/skills/` kopieren. Bestehende gleichnamige Skills vorher prüfen, nicht blind überschreiben. Danach eine neue Codex-Sitzung öffnen und kontrollieren, dass die Skills verfügbar sind. Eine ausführliche Installationsanleitung liegt im Paket.

Für die Vercel-Kontoanbindung kannst du ergänzend das offizielle [Vercel-Plugin](https://github.com/vercel/vercel-plugin) installieren und mit deinem eigenen Account authentifizieren. Laut dessen Installationsanleitung:

```sh
npx plugins add vercel/vercel-plugin
```

Die ZIP überträgt Skill-Anweisungen, aber keine Kontozugänge, Browser-Werkzeuge oder MCP-Anmeldungen. Dafür brauchst du deine eigene Einrichtung. Weitere Grundlagen sind Git, eine geeignete aktuelle Node.js-LTS-Version, npm und ein Browser mit Entwicklertools beziehungsweise Browser-Automation. Ein Bildgenerierungs-Tool ist optional, wenn wirklich zusätzliche Grafiken benötigt werden.

Die übrigen Skills für etwa Shopify, Supabase, Datenanalysen, Dokumente oder Studienplanung brauchst du für diese eigenständige Landingpage nicht zu installieren.

## 7. Fertigstellung und Übergabe

Der Auftrag ist fertig, wenn die Landingpage vollständig umgesetzt, geprüft und aus `landingpage` im separaten Vercel-Projekt erreichbar ist. Noch fehlende Freigaben für Kontakt- und Rechtstexte müssen transparent benannt werden; sie verhindern die Einstufung als öffentlich startbereite Seite.

Übergebe Iman:

- Live-Link und Zugriff auf das neue Vercel-Projekt.
- GitHub-Link zum Branch und den abschließenden Commit.
- Eine kurze README unter `apps/landingpage/` mit Start-, Build- und Deployment-Anweisungen.
- Nachweis der Branch-Konfiguration und der Prüfung auf Mobilgerät/Desktop.
- Eine Liste noch offener Angaben oder Freigaben.

Arbeite die Aufgabe eigenständig bis zum prüfbaren Ergebnis ab. Kläre fehlende Produkt- oder Unternehmensangaben mit Iman, ohne sie zu erfinden.
