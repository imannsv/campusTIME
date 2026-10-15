Prüfe, ob der Fehler auch nach Neuladen besteht. In der Vollversion muss das Backend erreichbar sein; eine sichtbare Webseite allein bestätigt das nicht. Informiere den Betreiber mit Zeitpunkt, betroffener Ansicht und dem Wortlaut der Meldung. Sende keine Passwörter.

![Probleme beheben in der fiktiven Beispieleinrichtung](/api/wiki/assets/troubleshooting.png)

## Der Dienst ist gerade nicht erreichbar
Prüfe, ob der Fehler auch nach Neuladen besteht. In der Vollversion muss das Backend erreichbar sein; eine sichtbare Webseite allein bestätigt das nicht. Informiere den Betreiber mit Zeitpunkt, betroffener Ansicht und dem Wortlaut der Meldung. Sende keine Passwörter.
## Der Plan ist leer
Prüfe ausgewählten Semesterplan, Woche und Gruppen-/Raumfilter. Die Planung öffnet die aktuelle Woche; ein Plan für einen anderen Zeitraum kann dort keine Termine haben. Kontrolliere, ob Veranstaltungen und Termine tatsächlich angelegt wurden.
## Die automatische Planung liefert keinen passenden Vorschlag
Prüfe Hinweise, Verfügbarkeiten, Raumkapazität/Ausstattung, Sperrzeiten, Soll und Termindauer. Unlösbare Vorgaben müssen fachlich korrigiert werden. Veröffentliche keinen ungeprüften Teilplan als vollständigen Semesterplan.
## Ein Vorschlag lässt sich nicht übernehmen
Änderungen an Ausgangsdaten können ihn veralten lassen. Prüfe den aktuellen Datenstand und berechne neu. Fixierte Termine können die verbleibende Planung einschränken.
## Die öffentliche Anzeige zeigt alte Daten
Prüfe, ob der neue Entwurf veröffentlicht wurde. Kontrolliere ausgewählte Pläne und festen Anzeigezeitraum. Die Ansichten aktualisieren freigegebene Inhalte ungefähr alle zehn Sekunden.
## Ein Import wird abgelehnt
Verwende die passende Vorlage. Prüfe Kennungen, Beziehungen, Datums-/Listenformate sowie Dateigröße und Zeilenanzahl. Korrigiere die Datei vollständig und starte eine neue Vorschau.
## Eine Aktion ist nicht verfügbar
Prüfe Rolle, Lizenz und erforderliche Voraussetzungen. Die öffentliche Browser-Demo besitzt ausdrücklich eingeschränkte Funktionen. Beschreibe bei einer Rückfrage, ob du die Demo oder Vollversion verwendest.

## Wo lege ich Gruppen oder Jahrgänge an?

Öffne **Verwaltung → [Gruppen & Jahrgänge](/wiki/group-admin)**. Für einen Jahrgang muss zuerst ein Studien-/Bildungsgang existieren; eine Gruppe benötigt einen Jahrgang. **Gruppe hinzufügen** direkt auf einer Jahrgangskarte übernimmt die Zuordnung. Prüfe Aufnahmejahr-, Studiengangsfilter und Suche, falls ein vorhandener Eintrag nicht sichtbar ist. Für Lehrplan und Semesterverteilung verwende weiterhin **Einrichtung & Studienstruktur**.

## Eine Person erscheint nicht in der Gruppe

Öffne **[Schüler & Studierende](/wiki/learners)** und wechsle bei Bedarf zu **Liste**. Prüfe die Zuordnung über **Bearbeiten**. **Ohne Zuordnung** findet Personen ohne Gruppe; eine eingetragene Gruppengröße legt keine Personen automatisch an. Eine Person in der Verwaltung erzeugt keinen persönlichen App-Zugang.

## Der QR-Code ist weg oder Kopieren funktioniert nicht

Unter **Veröffentlichung → Studierenden-App** öffnet **Zugang anzeigen** den QR-Code erneut. Bei älteren Zugängen ergänze einmalig die erreichbare Serveradresse. Ein früheres Passwort wird nicht erneut angezeigt; der QR-Code bleibt für die Anmeldung verwendbar.

Fehlt die Zwischenablagefunktion oder verweigert der Browser den Zugriff, zeigt CampusZeit einen Hinweis zum manuellen Kopieren. Markiere die angezeigten Angaben oder speichere den QR-Code. Erstelle deswegen keinen zusätzlichen Zugang. Details: [Studierenden-App und Gruppenzugänge](/wiki/student-app).

## Die App erreicht den lokalen Server nicht

Die Browseradresse auf dem PC ist nicht automatisch eine vom iPhone oder iPad erreichbare Serveradresse. **localhost** und **127.0.0.1** verweisen immer auf das jeweilige Gerät. Der Betreiber muss den Testserver im gemeinsamen Netzwerk erreichbar machen und seine aktuelle Netzwerkadresse bereitstellen. Nach einem WLAN-Wechsel kann sie sich ändern. Prüfe auf dem Gerät die Freigabe für das lokale Netzwerk; für öffentliche Server verwende HTTPS.

## Ein Banner kommt erst beim Öffnen der App

Prüfe **Profil → App-Freigaben → Benachrichtigungen** und **Push-Zustellung**. Ohne eingerichteten Apple-Push-Dienst kann die App neue Mitteilungen erst bei einem erfolgreichen Abruf melden. Hintergrundabrufe werden von iOS zugeteilt und sind nicht garantiert. Ein lokaler Banner beim App-Start beweist daher noch keine Push-Zustellung. Die Einrichtung des Push-Dienstes ist Aufgabe des Betreibers; wiederholtes Erteilen der Gerätefreigabe ersetzt sie nicht.

## Offline fehlen Termine oder neue Mitteilungen

Unter **Profil → Offline verfügbar** siehst du den gespeicherten Stand und Zeitraum. Nur zuvor geladene Wochen stehen offline bereit; zwischen zusätzlich besuchten Wochen können Lücken liegen. Die App lädt beim Öffnen mit Verbindung automatisch nach. Neue Absagen, Mitteilungen und Rücknahmen benötigen Serverkontakt. Bei gesperrtem oder abgelaufenem Zugang wende dich an die Verwaltung. Abmelden löscht den Offline-Stand und eignet sich nicht als erster Schritt bei einem vorübergehenden Serverausfall.
