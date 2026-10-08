# campusAI

**Freddy** ist der CampusAI-Assistent für die Verwaltung. Das Chat-Icon unten rechts
öffnet ein kompaktes Fenster über der aktuellen Verwaltungsansicht mit der Begrüßung
„Hi, ich bin Freddy, dein CampusAI-Assistent. Wie kann ich dir helfen?“.
Die kompakte Kontextzeile öffnet eine Auswahl von Plänen und Jahrgängen.
Im Drei-Punkte-Menü liegen Antwortmodus, Aktualisieren und Gespräch leeren.
Freddy verwendet einen lokal erzeugten [Blobatar](https://blobatar.dev/) als Avatar,
ohne externen Avatarabruf. Seine Augen folgen dem Mauszeiger in der gesamten
Ansicht; im Chat und im geschlossenen Start-Icon. Blobatars Bewegung berücksichtigt
reduzierte Bewegung und bleibt auf Geräten ohne feinen Zeiger aus.
Berechnete Planungshinweise erscheinen passend zur
aktuellen Seite schon beim Öffnen. Einrichtungsschritt, ausgewählte Lehrplanversion
sowie Bereich und Stockwerk werden dabei berücksichtigt. Beispielfragen stehen
untereinander unter der Begrüßung und verschwinden nach der ersten Nachricht.
Die Kontextauswahl allein verändert nicht den Plan in der Arbeitsansicht. Eine
anschließend ausgeführte Aktion zur Stundenplanung, zu Veranstaltungen oder
Prüfungen öffnet den gewählten Plan. Beim Wechsel des aktiven Arbeitsplans
übernimmt der Chat den neuen Plan.
Gespräch und offene Eingabe bleiben für jeden Plan bzw. Jahrgang getrennt erhalten.
Der Chat lässt sich vergrößern; lange Antworten lassen sich vollständig aufklappen.
Anleitungsquellen liegen unter „Verwendete Anleitung“.
Freddy kann Ansichten öffnen, Einrichtungsschritte auswählen und Formulare mit
passenden Vorgaben vorbereiten. „Öffne Prüfungen“, „Öffne die Jahrgänge“ und
„Lege einen Raum an“ werden als eindeutige Befehle direkt ausgeführt. Bei
Empfehlungen stehen Schaltflächen bereit. Voraussetzungen werden vorher geprüft;
ein bereits geöffnetes Formular wird nicht überschrieben. Erst die Verwaltung
speichert über das reguläre Formular. Freddy speichert, löscht, plant und
veröffentlicht keine Daten selbstständig. Mehrteilige oder verneinte Befehle
werden nicht automatisch ausgeführt.

## Schnellhilfe und Datenprüfung

Die Schnellhilfe verwendet hinterlegte Anleitungen zu Einrichtung, Räumen,
Lehrenden, Studienstruktur, Jahrgängen, Semesterbelastung, Wahlpflichtkursen,
Prüfungen, Abgaben und öffentlichen Anzeigen. Sie benötigt kein Sprachmodell.
Unbekannte Fragen werden ausdrücklich als solche gekennzeichnet.
Reine Begrüßungen (auch „Hi 👋“), Fragen nach Freddys Namen, Fähigkeiten und Dank
werden direkt im Browser beantwortet, während Planungshinweise noch laden oder
der Dienst nicht erreichbar ist. Sie lösen keine Einrichtungsvorschläge, Hilfequellen oder
Navigationsaktionen aus. Eine Begrüßung mit angehängter Fachfrage wird weiterhin
als Fachfrage behandelt. Freddy ist der Name des Assistenten, nicht der Verwaltung.

Für Bedienfragen gibt es geprüfte Fragevarianten und gezielte Antworten in
`shared/campus-ai-faq.json`. Die Anleitungen in `shared/campus-ai-knowledge.json`
decken zusätzlich Importe, Kennungen, manuelle Termine, Fixierung, Entwurf und
Veröffentlichung, Kalender, Begriffserklärungen, Schulen und Funktionsgrenzen ab.
Dieses Wissen gilt für alle Einrichtungen; es enthält keine LFH-spezifischen Vorgaben.
Im Modus **Schnellhilfe** werden bekannte Fragen direkt im Browser beantwortet,
einschließlich passender Quellen und Schaltflächen. Höfliche Formulierungen,
Umlautumschreibungen, bestimmte Synonyme und ein einzelner kleiner Tippfehler
werden vorsichtig erkannt. Zusätzliche Bedingungen und Verneinungen werden nicht
entfernt. Kurze Anschlussfragen beziehen sich auf das letzte bekannte Thema;
bei unbekanntem Bezug fragt Freddy nach. Dabei werden frühere Befehle nicht ausgeführt.

Im Modus **Lokale KI** laufen auch bekannte Bedienfragen und Anschlussfragen über
das Sprachmodell. Es erhält passende allgemeine Anleitungen, den Gesprächsverlauf
und den frisch geprüften Kontext der angemeldeten Einrichtung. Es formuliert eine
eigene Antwort und wählt hilfreiche nächste Schritte aus. Häufige einfache
Bedienfragen verwenden das Modell ohne zusätzlichen Thinking-Durchgang; bei
freien, komplexen, begründenden Fragen und Empfehlungen kann dieser bei einem
geeigneten Modell über `CAMPUS_AI_THINK=1` aktiviert werden. Auf dem derzeitigen
Rechner überschritt der zusätzliche Durchgang im Praxistest das Zeitlimit, deshalb
ist er standardmäßig aus. Die normale KI-Antwort wird weiterhin vom Sprachmodell
aus Frage, Anleitung, Gespräch und Kontext erzeugt; sie ist keine feste Textantwort.
Ein Thinking-Durchgang ist keine Garantie für korrekte
Antworten. Reine Begrüßungen bleiben sofort verfügbar. Ist das Modell beschäftigt,
nicht erreichbar oder zu langsam, wird die Schnellhilfe mit einem Hinweis angezeigt.
Mehrteilige und verneinte Fragen werden nicht durch einen Teiltreffer abgefangen.
Die Wissensbasis und Antwortsteuerung stimmen Freddy auf campusTIME ab; die
Modellgewichte werden dabei nicht trainiert. Freie Modellantworten bleiben von der
Rechenleistung des lokalen Rechners abhängig. Es kommen keine bezahlten APIs hinzu.
„Was fehlt hier?“ und „Was empfiehlst du mir hier?“ verwenden in der Schnellhilfe
die geprüften Hinweise der aktuellen Ansicht. Im KI-Modus kann das Modell diese
Hinweise anhand des Toolwissens erklären und passende nächste Schritte vorschlagen.

Das Backend berechnet Hinweise aus dem aktuellen Datenbestand: fehlende
Lehrende und Verfügbarkeiten, fehlende Wahlpflichtbelegungen, ungeeignete
Raumkapazität oder Ausstattung, Planungsfehler einschließlich Unterrichtssoll,
Prüfungsteilnehmer und Aufsichten, noch nicht angelegte Prüfungen sowie fehlende
oder überschrittene Abgabefristen. Für Jahrgänge mit freigegebener Lehrplanversion
werden Semesterbelastung und Voraussetzungen geprüft.

Passende Raumkandidaten sind noch kein Nachweis zeitlicher Verfügbarkeit.
Konkrete Fragen nach freien Räumen mit Datum, Startzeit, Endzeit oder Dauer und
Personenzahl werden separat aus dem Datenbestand geprüft. Diese Antworten tragen
„Datenprüfung“ und werden nicht vom Sprachmodell formuliert. Berücksichtigt werden
Kapazität, hinterlegte Ausstattung, Termine des ausgewählten Entwurfs, veröffentlichte
Belegungen anderer Pläne und wiederholte Raumsperren. Ohne ausgewählten Entwurf
werden die veröffentlichten Belegungen geprüft. Unbekannte Bedingungen oder mehrere
Zeitfenster führen zur Rückfrage. Das bestätigt keine organisatorische Freigabe.
„Warum passt dieser Termin nicht?“ zeigt die aktuellen Prüfergebnisse des im Kalender
ausgewählten, gespeicherten Termins. Noch nicht gespeicherte Formularänderungen
sind kein Teil dieser Prüfung. Kalenderwoche und aktive Raum-/Gruppenfilter sind
sichtbarer Kontext; die Raumabfrage beschränkt sich nur auf ausdrücklich genannte Räume.
Im Termin-Popup öffnet „Termin mit Freddy prüfen“ den Chat und schließt das
unveränderte Formular. Bei ungespeicherten Änderungen ist der Übergang gesperrt;
speichere sie zuerst. Der ausgewählte Termin bleibt nach dem Schließen als Kontext
erhalten. Wechsel von Plan oder Woche sowie Löschen des Termins löschen die Auswahl.
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

Standardmodell ist [Qwen3.5 2B Q4_K_M](https://ollama.com/library/qwen3.5:2b-q4_K_M),
mit etwa 1,9 GB Download. Die stärker komprimierte Variante desselben Modells wurde
auf dem Entwicklungsrechner installiert und benötigt weniger Speicher als die
bisherige Q8-Variante. Installation in einem zweiten Terminal:

```powershell
ollama pull qwen3.5:2b-q4_K_M
```

Das konfigurierte Modell muss vorab mit `ollama pull <Modellname>` installiert
sein. campusAI lädt Modelle nicht selbst nach. Das Backend erlaubt ausschließlich
lokale HTTP-Adressen (`127.0.0.1`, `localhost`, `::1` oder den privaten
Docker-Dienstnamen `ollama`). Cloud-Modellnamen und als remote gekennzeichnete
Modelle werden abgewiesen.

Backend-Einstellungen:

| Variable            | Bedeutung                                                                                                                                                                                                            |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CAMPUS_AI_ENABLED` | Bei `DEBUG=1` standardmäßig aktiv; im Produktionsbetrieb standardmäßig aus.                                                                                                                                          |
| `CAMPUS_AI_URL`     | Standard: `http://127.0.0.1:11434`.                                                                                                                                                                                  |
| `CAMPUS_AI_MODEL`   | Standard: `qwen3.5:2b-q4_K_M`; installierter lokaler Modellname. Bestehende andere lokale Modelle bleiben konfigurierbar.                                                                                            |
| `CAMPUS_AI_TIMEOUT` | Standard 30 Sekunden; erlaubter Bereich 5–120 Sekunden.                                                                                                                                                              |
| `CAMPUS_AI_THINK`   | Standard `0`: Antworten stammen vom Sprachmodell ohne zusätzlichen Thinking-Durchgang. `1` aktiviert ihn bei anspruchsvolleren Fragen, sofern das Modell dies unterstützt. Auf CPU kann das erheblich länger dauern. |

Es wird höchstens eine Modellantwort pro Backend-Prozess gleichzeitig erzeugt.
Bei mehreren Serverprozessen ist dies keine globale Warteschlange. Nicht
erreichbare, beschäftigte oder zu langsame Modelle führen zur gekennzeichneten
Schnellhilfe. Gekürzte Modellantworten werden gekennzeichnet.
Im Browser zeigt Freddy die Wartezeit und „Antwort abbrechen“. Nach 45 Sekunden
bricht der Browser die Anfrage ab und erhält die Frage für einen erneuten Versuch.
Schließen oder Kontextwechsel brechen ebenfalls ab; verspätete Antworten werden
verworfen. Ein Browser-Abbruch beendet eine bereits laufende Berechnung im
Modelldienst nicht zuverlässig. Es gibt weiterhin keine Ausgabe einzelner Tokens.
Das Modell bleibt zehn Minuten geladen, damit Folgefragen keinen erneuten
Kaltstart benötigen. Auf einem Rechner ohne geeignete GPU können KI-Antworten
trotzdem deutlich länger dauern als die Schnellhilfe. Thinking und JSON-Antworten
verwenden die offiziellen [Thinking](https://docs.ollama.com/capabilities/thinking)-
und [Structured-Outputs](https://docs.ollama.com/capabilities/structured-outputs)-Schnittstellen.

## Daten und Gespräch

Alle echten Backend-Anfragen erfordern Anmeldung und eine zugeordnete Einrichtung.
Der Kontext enthält die aktuelle Ansicht, Einrichtungszahlen, Plan-/Jahrgangsnamen, Semesterbelastung,
Planungshinweise sowie Raum- und Veranstaltungslisten. Einzelne
Studierenden- und Lehrendennamen sowie E-Mail-Adressen werden nicht in den
Modellkontext übernommen. Die aktuell angemeldete Einrichtung liefert den Kontext;
fremde Plan-, Termin-, Jahrgangs-, Versions-, Bereichs- und Etagenauswahlen werden abgewiesen,
bevor das Modell aufgerufen wird. Raum-/Veranstaltungsnamen können dennoch interne
Informationen enthalten; der Modelldienst muss unter eigener Kontrolle bleiben.

Der Modellkontext ist ein Ausschnitt: höchstens vier zur Frage passende allgemeine
Hinweise und zwei Hinweise zur aktuellen Ansicht, acht Semester, acht Veranstaltungen
und acht Räume. Genannte Datensätze werden bevorzugt; Gesamtzahlen und Angaben zur
Abdeckung kennzeichnen ausgelassene Datensätze. Die separate Raumprüfung verwendet
alle Räume der Einrichtung. Der ausgewählte Termin wird gesondert übergeben.
Hinweistexte werden auf 300 Zeichen begrenzt. Bei Bedienfragen mit „Wie …“ werden
Raum- und Veranstaltungslisten weggelassen; es werden nur Hinweise zur aktuellen
Ansicht mitgeschickt. Ein geprüftes Frage-Antwort-
Beispiel zum erkannten Thema zeigt dem Modell die gewünschten Begriffe und Schritte.
Der Kontext enthält die vollständige Liste der Planungshinweise mit Gesamtzahl.
Ein Backend-Frageaufruf berechnet die Fakten erneut; Standardfragen im Browser
verwenden den zuletzt geladenen Kontext. **Hinweise aktualisieren**
lädt die sichtbaren Prüfungen neu. Antworten tragen den verwendeten Datenstand;
alte Chatantworten werden nicht nachträglich aktualisiert.

Der Gesprächsverlauf liegt im Arbeitsspeicher. Schließen, Wiederöffnen und
Wechsel zwischen Verwaltungsansichten erhalten das Gespräch, einschließlich
des bisherigen Verlaufs. Ein Ansichtswechsel verwirft eine noch laufende Antwort,
damit sie keine Aktionen mit veraltetem Seitenkontext ausführt.
Der Chat lässt sich per Schließen-Button, Icon
oder Escape im Fenster schließen; der Fokus kehrt zum Icon zurück.
Plan-/Jahrgangswechsel stellen das jeweilige Gespräch wieder her. Neuladen der Seite
und Abmelden leeren alle Gespräche. Sie werden weder in der Datenbank noch im
Browser-Speicher abgelegt. Für Anschlussfragen werden höchstens zwölf vorherige,
beantwortete Nachrichten innerhalb eines Budgets von 12.000 Zeichen übergeben.
Es werden ganze Nachrichten erhalten; abgebrochene Fragen gehen nicht in den Kontext ein.
Backend: 2.000 Zeichen pro Frage, maximal zwölf Verlaufsnachrichten,
6.000 Zeichen je Verlaufsnachricht und 12.000 Zeichen Verlauf insgesamt,
zwölf Chat-Anfragen pro Minute je angemeldetem Benutzer. Es werden keine
Schreibwerkzeuge an das Modell übergeben. Das Modell liefert die finale Antwort
und bis zu drei vorgeschlagene Aktionskennungen als JSON. Nur bekannte Kennungen
aus dem gemeinsamen Aktionskatalog mit erfüllten Voraussetzungen erscheinen als
Schaltflächen. Das Modell bekommt nur Aktionen passend zum Fragethema und bei
freien Empfehlungen zur aktuellen Ansicht angeboten. Unbekannte Kennungen und
Werkzeugaufrufe werden verworfen. Diese
Empfehlungen werden nie automatisch ausgeführt. Eindeutige Navigationsbefehle
verwenden weiterhin den geprüften Befehlsweg. Interne Thinking-Texte werden nicht
an den Browser zurückgegeben; Nutzer sehen die Antwort und Handlungsvorschläge.

## Vercel-Demo

In der Browser-Demo funktioniert Freddy mit Navigation, Formularvorbereitung und Schnellhilfe mit einfachen Hinweisen
aus den Demo-Daten. Der Unterschied zum lokalen Sprachmodell wird sichtbar
angezeigt. Es gibt keinen Modellaufruf, keine Verbindung zum privaten Rechner
und weiterhin keinen gemeinsamen Cloud-Datenbestand. Die Demo ersetzt auch
hier nicht die vollständigen Backend-Planungsprüfungen.

Beispielfragen: „Wie lege ich einen neuen Jahrgang an?“, „Wie prüfe ich die
Semesterbelastung?“ oder „Wie plane ich Prüfungen und Abgaben?“.

## Prüfen

Die Backend-Tests verwenden nachgebildete Modellantworten für Fehlerfälle,
Zugriffsschutz, Kontextaufbereitung und Begrenzungen. Browserprüfungen testen
Schnellhilfe, Planwechsel, Navigation, Formularvorgaben, verneinte Befehle,
unveränderte Daten, lokal erzeugte Avatare und mobile Darstellung.
Der echte lokale Modelldienst kann zusätzlich bei laufender Anwendung geprüft werden:

```powershell
$env:CAMPUS_AI_LIVE_TEST = '1'
npm.cmd exec playwright -- test -g 'campusAI erreicht'
Remove-Item Env:CAMPUS_AI_LIVE_TEST
```

Dieser Test benötigt das installierte Modell und den lokalen Demozugang.
Eine bestandene Verbindung mit Beispielantwort bestätigt keine allgemeine
inhaltliche Zuverlässigkeit des Sprachmodells.
