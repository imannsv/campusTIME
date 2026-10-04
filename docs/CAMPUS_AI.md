# campusAI

campusAI ist ein Assistent für die Verwaltung. Die eigene Ansicht bietet
Bedienhilfe und Hinweise zum ausgewählten Semesterplan oder Jahrgang.
Die erste Version liest Daten und erklärt; sie verändert keine Termine,
Raumzuordnungen, Lehrpläne oder Veröffentlichungen.

## Schnellhilfe und Datenprüfung

Die Schnellhilfe verwendet hinterlegte Anleitungen zu Einrichtung, Räumen,
Lehrenden, Studienstruktur, Jahrgängen, Semesterbelastung, Wahlpflichtkursen,
Prüfungen, Abgaben und öffentlichen Anzeigen. Sie benötigt kein Sprachmodell.
Unbekannte Fragen werden ausdrücklich als solche gekennzeichnet.

Das Backend berechnet Hinweise aus dem aktuellen Datenbestand: fehlende
Lehrende und Verfügbarkeiten, fehlende Wahlpflichtbelegungen, ungeeignete
Raumkapazität oder Ausstattung, Planungsfehler einschließlich Unterrichtssoll,
Prüfungsteilnehmer und Aufsichten, noch nicht angelegte Prüfungen sowie fehlende
oder überschrittene Abgabefristen. Für Jahrgänge mit freigegebener Lehrplanversion
werden Semesterbelastung und Voraussetzungen geprüft.

Passende Raumkandidaten sind noch kein Nachweis zeitlicher Verfügbarkeit.
Fehlende Hinweise bestätigen nicht die vollständige fachliche oder organisatorische
Freigabe eines Plans. Vorschläge werden über die vorhandenen Planungsansichten
geprüft und übernommen.

## Lokales Sprachmodell

Ollama betreibt ein Sprachmodell auf dem eigenen Rechner. Der Browser spricht
ausschließlich mit dem campusTIME-Backend; nur dieses greift auf den lokalen
Modelldienst zu. Es gibt keine kostenpflichtige Modell-API und keinen API-Schlüssel.
Rechenleistung, Arbeitsspeicher, Strom und gegebenenfalls eigener Serverbetrieb
bleiben erforderlich. Antworten kleiner Modelle können fehlerhaft sein und sollen
anhand der hinterlegten Hilfe und berechneten Hinweise geprüft werden.

Installation unter Windows: [Ollama für Windows](https://docs.ollama.com/windows).
Cloud-Funktionen vor dem Start deaktivieren:

```powershell
[Environment]::SetEnvironmentVariable('OLLAMA_NO_CLOUD', '1', 'User')
$env:OLLAMA_NO_CLOUD = '1'
$env:OLLAMA_HOST = '127.0.0.1:11434'
$env:OLLAMA_NUM_PARALLEL = '1'
$env:OLLAMA_MAX_LOADED_MODELS = '1'
ollama serve
```

Ist Ollama bereits gestartet, zuerst den eigenen Ollama-Dienst beenden und
mit diesen Einstellungen neu starten. Nach einem Rechnerneustart muss
Ollama wieder laufen. Den Dienst nicht öffentlich ins Internet freigeben.
[Lokaler Betrieb und Cloud-Einstellungen](https://docs.ollama.com/faq).

Standardmodell ist [Qwen3.5 2B](https://ollama.com/library/qwen3.5:2b),
unter Apache 2.0, mit etwa 2,7 GB Download. Installation in einem zweiten Terminal:

```powershell
ollama pull qwen3.5:2b
```

Das konfigurierte Modell muss vorab mit `ollama pull <Modellname>` installiert
sein. campusAI lädt Modelle nicht selbst nach. Das Backend erlaubt ausschließlich
lokale HTTP-Adressen (`127.0.0.1`, `localhost`, `::1` oder den privaten
Docker-Dienstnamen `ollama`). Cloud-Modellnamen und als remote gekennzeichnete
Modelle werden abgewiesen.

Backend-Einstellungen:

| Variable | Bedeutung |
|---|---|
| `CAMPUS_AI_ENABLED` | Bei `DEBUG=1` standardmäßig aktiv; im Produktionsbetrieb standardmäßig aus. |
| `CAMPUS_AI_URL` | Standard: `http://127.0.0.1:11434`. |
| `CAMPUS_AI_MODEL` | Standard: `qwen3.5:2b`; installierter lokaler Modellname. |
| `CAMPUS_AI_TIMEOUT` | Standard 90 Sekunden; erlaubter Bereich 5–120 Sekunden. |

Es wird höchstens eine Modellantwort pro Backend-Prozess gleichzeitig erzeugt.
Bei mehreren Serverprozessen ist dies keine globale Warteschlange. Nicht
erreichbare, beschäftigte oder zu langsame Modelle führen zur gekennzeichneten
Schnellhilfe. Gekürzte Modellantworten werden gekennzeichnet.

## Daten und Gespräch

Alle echten Backend-Anfragen erfordern Anmeldung und eine zugeordnete Einrichtung.
Der Kontext enthält Einrichtungszahlen, Plan-/Jahrgangsnamen, Semesterbelastung,
Planungshinweise sowie begrenzte Raum- und Veranstaltungslisten. Einzelne
Studierenden- und Lehrendennamen sowie E-Mail-Adressen werden nicht in den
Modellkontext übernommen. Raum-/Veranstaltungsnamen können dennoch interne
Informationen enthalten; der Modelldienst muss unter eigener Kontrolle bleiben.

Der Modellkontext ist ein Ausschnitt: höchstens zehn Hinweise, acht Veranstaltungen
und acht Räume. Die Datenprüfung zeigt bis zu 40 Hinweise mit Gesamtzahl an.
Ein neuer Frageaufruf berechnet die Fakten erneut. **Hinweise aktualisieren**
lädt die sichtbaren Prüfungen neu. Antworten tragen den verwendeten Datenstand;
alte Chatantworten werden nicht nachträglich aktualisiert.

Der Gesprächsverlauf liegt im Arbeitsspeicher der Ansicht, wird beim Wechsel
von Plan/Jahrgang oder beim Verlassen der Ansicht geleert und nicht als Chat
in der Datenbank gespeichert. Für Anschlussfragen werden höchstens vier
vorherige Nachrichten an das lokale Modell übergeben. Backend: 2.000 Zeichen
pro Frage, maximal sechs Verlaufsnachrichten und 6.000 Zeichen Verlauf,
zwölf Chat-Anfragen pro Minute je angemeldetem Benutzer. Es werden keine
Schreibwerkzeuge an das Modell übergeben.

## Vercel-Demo

In der Browser-Demo funktioniert campusAI als Schnellhilfe mit einfachen Hinweisen
aus den Demo-Daten. Der Unterschied zum lokalen Sprachmodell wird sichtbar
angezeigt. Es gibt keinen Modellaufruf, keine Verbindung zum privaten Rechner
und weiterhin keinen gemeinsamen Cloud-Datenbestand. Die Demo ersetzt auch
hier nicht die vollständigen Backend-Planungsprüfungen.

Beispielfragen: „Wie lege ich einen neuen Jahrgang an?“, „Wie prüfe ich die
Semesterbelastung?“ oder „Wie plane ich Prüfungen und Abgaben?“.

## Prüfen

Die Backend-Tests verwenden nachgebildete Modellantworten für Fehlerfälle,
Zugriffsschutz, Kontextaufbereitung und Begrenzungen. Browserprüfungen testen
Schnellhilfe, Planwechsel, unveränderte Daten und mobile Darstellung.
Der echte lokale Modelldienst kann zusätzlich bei laufender Anwendung geprüft werden:

```powershell
$env:CAMPUS_AI_LIVE_TEST = '1'
npm.cmd exec playwright -- test -g 'campusAI erreicht'
Remove-Item Env:CAMPUS_AI_LIVE_TEST
```

Dieser Test benötigt das installierte Modell und den lokalen Demozugang.
Eine bestandene Verbindung mit Beispielantwort bestätigt keine allgemeine
inhaltliche Zuverlässigkeit des Sprachmodells.
