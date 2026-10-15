Die Studierenden-App bietet Lesezugriff auf Stundenplan, Prüfungen und wichtige Mitteilungen. Die Verwaltung kann gemeinsame Gruppen-/Jahrgangszugänge und persönliche Zugänge für Lernende und Lehrende bereitstellen. App-Zugänge vergeben keine Verwaltungsrechte.

![Verwaltung von App-Zugängen und Mitteilungen in der fiktiven Beispieleinrichtung](/api/wiki/assets/student-app.png)

## Zugang bereitstellen

1. Öffne **Studierenden-App** unter **Veröffentlichung**.
2. Klicke auf **Zugang erstellen** und wähle eine Gruppe oder einen Jahrgang. Ein Jahrgangszugang umfasst dessen Gruppen.
3. Trage die vom iPhone erreichbare CampusZeit-Serveradresse ein, zum Beispiel die HTTPS-Adresse der eigenen Einrichtung. Die Adresse benötigt keinen zusätzlichen Pfad.
4. Erstelle den Zugang. Speichere den angezeigten QR-Code oder kopiere die Zugangsdaten. Das Passwort wird ausschließlich bei der Erstellung angezeigt. Den QR-Code, die Serveradresse und den Zugangscode kannst du später in der Zugangsliste über **Zugang anzeigen** erneut öffnen und speichern – auch nach einem Neuladen.
5. Teile diese Angaben mit der Zielgruppe. Verwende dafür kein Verwaltungskonto.

Bei älteren Zugängen ergänze beim ersten erneuten Öffnen einmalig die erreichbare Serveradresse. Der neu angezeigte QR-Code funktioniert zusätzlich zu bereits verteilten Codes. Passwort und angemeldete Geräte bleiben erhalten. Ein vergessenes Passwort lässt sich aus seiner gespeicherten Prüfsumme nicht wiederherstellen; nutze dann den QR-Code. Gesperrte Zugänge können nicht erneut bereitgestellt werden.

Falls **Zugangsdaten kopieren** oder **Zugangscode kopieren** nicht auf die Zwischenablage zugreifen kann, erscheint ein Hinweis zum manuellen Kopieren. Die Angaben bleiben im Dialog auswählbar; der QR-Download ist weiterhin nutzbar. Bei einem später erfolgreichen Kopierversuch verschwindet der Hinweis.

Für einen lokalen Test müssen Server und iPhone im selben Netzwerk sein. **localhost** und **127.0.0.1** bezeichnen auf dem iPhone das iPhone selbst. Der lokale Server muss unter seiner Netzwerkadresse erreichbar und dafür konfiguriert sein. Verwende im öffentlichen Betrieb HTTPS.

Die App akzeptiert HTTP ausschließlich für lokale Testadressen: eindeutige private IPv4-Adressen, **localhost** und Namen mit **.local**. Eine externe Domain wird nicht lokal, nur weil ihr Name mit einer privaten IP beginnt. Serveradressen mit Anmeldedaten, zusätzlichem Pfad, Abfrageparametern oder Fragment werden abgewiesen.

## Auf dem iPhone anmelden

### Persönlicher Zugang

Die Verwaltung erstellt den Zugang bei einer gespeicherten Person über **Persönlicher Zugang**. Benutzername und einmaliges Startpasswort werden zusammen mit der Serveradresse weitergegeben. Es werden keine E-Mails versendet. Wähle in der App **Mit Zugangsdaten anmelden** und gib **Benutzername oder Zugangscode** und Passwort ein. Ein persönlicher Zugang hat keinen Gruppen-QR.

Vor dem ersten Datenzugriff verlangt die App ein eigenes Passwort mit mindestens zehn Zeichen. Ein zu einfaches Passwort oder eines, das den Personendaten zu ähnlich ist, wird abgelehnt. Bis zum erfolgreichen Wechsel sind Datenabruf, Offline-Wiederherstellung und Push-Anmeldung gesperrt. Später kannst du unter **Profil → Passwort ändern** erneut wechseln. Ein Wechsel meldet die anderen Geräte ab und erneuert die eigene Sitzung.

Lernende sehen veröffentlichte Termine ihrer aktuellen Gruppen und ausdrücklich zugeordnete veröffentlichte Termine. Lehrende sehen nur ihre eigenen veröffentlichten Termine. Lernende erhalten Hinweise für ihre Einrichtung, Gruppen und Jahrgänge; Lehrende die allgemeinen Einrichtungshinweise. Interne Teilnehmerlisten und E-Mail-Adressen werden nicht übertragen.

Ein vergessenes Passwort setzt die Verwaltung über **Persönlicher Zugang → Passwort zurücksetzen** zurück. Das beendet alle bisherigen Sitzungen und verlangt beim nächsten Anmelden wieder einen Passwortwechsel. **Zugang sperren** beendet alle Sitzungen; Zurücksetzen kann einen gesperrten Zugang wieder aktivieren. Der Benutzername bleibt bei Änderungen des Namens oder der Kennung stabil.

### Gemeinsamer Gruppen- oder Jahrgangszugang

Öffne die installierte CampusZeit-App und wähle **QR-Code scannen**. Erlaube den Kamerazugriff, scanne den bereitgestellten Code und bestätige die angezeigte Serveradresse. Alternativ gib Serveradresse, Zugangscode und Passwort ein. Ein QR-Code ist ein Zugangsschlüssel; veröffentliche ihn nicht außerhalb der Zielgruppe.

Die native App wird als separate Anwendung installiert. Eine lokale Testsignierung läuft ab und ersetzt keine spätere App-Store-Veröffentlichung. Die hier beschriebenen Funktionen gehören zum aktuellen Entwicklungsstand; bereits installierte Testfassungen erhalten neue Funktionen erst mit einem App-Update. Android ist ein späterer Schritt. Die Browser-Demo kann keine echten App-Zugänge bereitstellen.

## Ersteinrichtung und Darstellung

Beim ersten Start erklärt **CampusZeit einrichten** die benötigten Freigaben. **Freigaben einrichten** öffnet die iOS-Abfragen für Kamera und Benachrichtigungen; **Später einrichten** lässt dich ohne diese Freigaben fortfahren. Die manuelle Anmeldung benötigt keine Kamera. Die Freigabe für das lokale Netzwerk fragt iOS bei einer entsprechenden Serververbindung an.

Unter **Profil → App-Freigaben** siehst du den Status und kannst **Freigaben einrichten** erneut öffnen oder zu den iOS-Einstellungen wechseln. Eine zuvor abgelehnte Freigabe musst du dort ändern.

Unter **Profil → Darstellung** wählst du **System**, **Hell** oder **Dunkel**. System folgt der Geräteeinstellung. Diese Auswahl ist unabhängig vom Browser der Verwaltung und verändert weder den Gruppenzugang noch die gespeicherten Daten.

## Was Studierende sehen

**Start** zeigt die Einrichtung, eine Begrüßung mit wechselnden kurzen Sprüchen, den heutigen beziehungsweise nächsten aktiven Termin und Schnellzugriffe. Für die Leibniz-FH ist ein Campusfoto hinterlegt. Die Tageskarte bleibt beim heutigen Datum, auch wenn du im Stundenplan eine andere Woche ansiehst.

**Stundenplan** bietet im Menü oben rechts **Tag**, **2 Tage**, **3 Tage** und **Woche**. Wischen nach links oder rechts wechselt den angezeigten Zeitraum. Über **Datum auswählen** springst du zu einem Datum; der Menüpunkt für heute beziehungsweise die aktuelle Woche führt zurück. Ein Termin öffnet seine Details. Die Tagesüberschrift und **Termine & Details** öffnen die lesbare Tagesliste.

Die Wochenübersicht zeigt Montag bis Freitag; Samstag erscheint nur bei vorhandenen Terminen in dieser Woche. Das Raster beginnt beim frühesten sichtbaren Termin und endet beim spätesten. Eine leere Woche verwendet einen Ersatzbereich von 08–18 Uhr. Die rote Zeitlinie markiert die aktuelle Uhrzeit; liegt sie außerhalb des dargestellten Bereichs, erscheint ein kurzer Hinweis vor Beginn beziehungsweise nach Ende.

**Prüfungen** zeigt freigegebene zeitgebundene Prüfungen im heruntergeladenen Zeitraum der aktuellen und nächsten 17 Wochen. Änderungen an Entwürfen erscheinen erst nach [Veröffentlichung](/wiki/publication). Abgesagte Termine bleiben sichtbar, rot markiert und durchgestrichen. Persönliche Noten, Teilnehmerlisten und unveröffentlichte Prüfungsanforderungen werden nicht übertragen.

Bei kommenden Prüfungen zeigt **In X Tagen** die verbleibenden Kalendertage in der Zeitzone der Einrichtung. Heute, abgesagte und beendete Termine haben ihren entsprechenden Status. Tippe eine Prüfung an, um die vollständigen Angaben zu lesen.

**Mitteilungen** zeigt die veröffentlichten Hinweise für die Einrichtung und die zugehörige Gruppe beziehungsweise den Jahrgang. Die App aktualisiert bei erneuter Aktivierung, per Herunterziehen und im Vordergrund regelmäßig. Bei Verbindungsproblemen bleiben die gespeicherten Inhalte samt Datenstand sichtbar, auch nach einem vollständigen Neustart der App.

**Profil** bündelt den persönlichen oder gemeinsamen Zugang, Verbindung, Offline-Stand, Darstellung und App-Freigaben. Unter **Über CampusZeit** findest du **Was gibt es Neues**, **Hilfe** und **Open-Source-Lizenzen**. Die Lizenzansicht nennt die tatsächlich in dieser App verwendeten Komponenten; Bibliotheken aus anderen Apps werden nicht übernommen.

## Automatisch offline nutzen

1. Öffne CampusZeit mit Verbindung zu deinem Server und melde dich an.
2. Die App lädt und speichert die Daten selbst beim Öffnen und während der Nutzung. Auch im Hintergrund werden Aktualisierungen angefragt; iOS bestimmt, wann sie laufen. Du musst keinen Download anstoßen.
3. Unter **Profil → Offline verfügbar** kannst du den Speicherzeitpunkt nachsehen. Der Download umfasst die aktuelle Woche und die nächsten 17 Wochen, Prüfungen und veröffentlichte Mitteilungen. Zusätzlich besuchte Wochen bleiben bis zur Grenze von 30 gespeicherten Wochen erhalten; dazwischen können nicht geladene Wochen liegen.
4. Ohne Verbindung kannst du diese Wochen, Details, Prüfungen und Mitteilungstexte weiterhin öffnen. Die App zeigt den letzten geladenen Stand. Noch nicht heruntergeladene Wochen werden als solche gekennzeichnet.
5. Sobald der Server wieder erreichbar ist, aktualisiert sich die geöffnete App automatisch. Erst dann werden neue Mitteilungen, Änderungen, Absagen oder zurückgezogene Inhalte übernommen.

Abmelden entfernt den Offline-Stand. Das Ablaufdatum des Zugangs gilt auch ohne Verbindung; eine zwischenzeitliche Sperre wird beim nächsten Serverkontakt erkannt. Bei Serverwartung bleiben die zuvor heruntergeladenen Daten nutzbar.

Hintergrundabrufe haben keine feste Uhrzeit und können durch iOS-Einstellungen oder Energiesparregeln verzögert werden. Beim Öffnen wird der Abruf immer automatisch versucht. Der gespeicherte Stand bleibt verfügbar, wenn der Server nicht erreichbar ist.

## Mitteilung veröffentlichen oder zurückziehen

Klicke in der Verwaltung auf **Mitteilung erstellen**. Wähle eine Zielgruppe oder **Alle Studierenden**, erfasse Titel und Text und klicke **Veröffentlichen**. Mit **Zurückziehen** entfernst du die Mitteilung aus der App. Mit freigeschaltetem Apple-Push-Dienst können neue Mitteilungen auch bei geschlossener App eintreffen. Ohne diese zusätzliche Einrichtung erscheinen nach erteilter Freigabe lokale Banner beim automatischen Abruf. Im App-Profil steht der Push-Status.

## Benachrichtigungen richtig prüfen

1. Öffne **Profil → App-Freigaben** und prüfe **Benachrichtigungen** sowie **Push-Zustellung**.
2. Wenn kein Push-Dienst eingerichtet ist, teste eine neue Mitteilung bei geöffneter App und erreichbarem Server. Die App kann den lokalen Banner erst beim erfolgreichen Abruf anzeigen. Der erste vorhandene Mitteilungsbestand dient als Ausgangspunkt und löst keine rückwirkenden Banner aus; erneutes Laden meldet dieselbe Nachricht nicht nochmals.
3. Ein Banner erst beim Öffnen bestätigt den Abruf und die lokale Benachrichtigung, aber noch keine Zustellung bei geschlossener App.
4. Für Push bei geschlossener App benötigt der Betreiber zusätzlich Apple-Developer-Mitgliedschaft, passende App-Signierung und einen eingerichteten Push-Dienst. Die Anbindung ist vorbereitet und standardmäßig deaktiviert. Die Gerätefreigabe allein schaltet sie nicht frei.

Bei eingerichtetem Push-Dienst enthält der Sperrbildschirm nur einen allgemeinen Hinweis. Den vollständigen Inhalt liest du nach dem Öffnen im Posteingang. Ohne Verbindung sind nur bereits gespeicherte Mitteilungen verfügbar; eine neue Nachricht kann nicht vor ihrer Übertragung angezeigt werden.

## Automatische Ausfallmitteilungen

Wenn die Verwaltung einen bereits veröffentlichten Termin absagt, erstellt CampusZeit automatisch eine Mitteilung für jede betroffene Gruppe. Das gilt auch für Absagen durch eine Lehrenden-Blockzeit oder eine gespeicherte Verfügbarkeit mit Blockzeiten. Jahrgangszugänge erhalten die Mitteilungen ihrer Gruppen ebenfalls.

Die Nachricht enthält den veröffentlichten Titel, Datum, Uhrzeit und Raum. Unveröffentlichte Änderungen und persönliche Gründe für Blockzeiten werden nicht übertragen. Der abgesagte Termin bleibt rot und durchgestrichen im Plan erhalten. Wiederholtes Speichern und die Blockzeit-Vorschau erzeugen keine weiteren Nachrichten.

Die Mitteilung erscheint auch in der Verwaltung unter **Studierenden-App** und kann dort zurückgezogen werden. Wird die Absage am Termin aufgehoben und erfolgreich gespeichert, zieht CampusZeit die zugehörige Ausfallmitteilung zurück. Eine spätere erneute Absage erzeugt eine neue Nachricht. Für unveröffentlichte Termine oder Termine ohne zugeordnete Gruppe wird keine Nachricht verschickt; alte Absagen werden beim Update nicht nachträglich gemeldet.

Die App übernimmt den vollständigen Inhalt beim nächsten erfolgreichen automatischen Abruf. Ohne Verbindung bleibt ihr gespeicherter Stand erhalten. Ein eingerichteter Push-Dienst verschickt für neue Ausfälle automatisch einen allgemeinen Hinweis an die passende Gruppe. Ohne Apple-Freischaltung bleiben Hintergrundabrufe von iOS abhängig.

## Zugang sperren oder ersetzen

**Sperren** beendet alle Gerätesitzungen dieses Gruppenzugangs. Für neue Zugangsdaten sperre den bisherigen Zugang und erstelle einen neuen. Auf einem iPhone beendet **Mein Zugang → Auf diesem Gerät abmelden** nur die eigene Sitzung. Gerätesitzungen laufen nach 90 Tagen ab und erfordern dann eine erneute Anmeldung.

Ein geteilter Gruppenzugang kann von Empfängern weitergegeben werden; er zeigt weiterhin die freigegebenen Termine der gesamten Gruppe beziehungsweise des Jahrgangs. Ein persönlicher Zugang grenzt die Ansicht auf die zugeordneten Termine ein. Die Anmeldung selbst ist kein Nachweis einer Prüfungszulassung und zeigt keine persönlichen Noten.
