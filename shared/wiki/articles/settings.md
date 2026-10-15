Einstellungen enthalten Einrichtungsdaten, Zeitzone, Unterrichtseinheiten und Prüfungsgrenzen. Die Browser-Demo speichert Änderungen nur im jeweiligen Browser und bietet weder automatische Terminplanung noch Dateiimporte oder ein lokales Sprachmodell. Die lokale Anwendung kann Ollama nutzen; es entstehen dafür keine Modell-API-Kosten. Die native [Studierenden-App](/wiki/student-app) ist mit Gruppen-/Jahrgangszugang, Offline-Daten und Hell-/Dunkel-Darstellung vorhanden. Persönliche Lernendenkonten, Fremdsystemanbindungen und automatische Online-Abrechnung sind weiterhin keine vorhandenen Funktionen. Hosting, kundeneigene Domains und Anmeldesysteme sind kein bereits fertiger Verwaltungsdialog. Freddy erklärt die vorhandenen Funktionen, stellt bei fehlenden Angaben Rückfragen und schlägt nächste Schritte vor. Nur eindeutige Navigationsbefehle werden automatisch ausgeführt; empfohlene Schritte öffnest du über Schaltflächen, Datensätze speicherst du selbst.

![Einstellungen, Demo und Funktionsgrenzen in der fiktiven Beispieleinrichtung](/api/wiki/assets/settings.png)

## Einstellungen prüfen
Öffne **Einstellungen**. Prüfe Einrichtungsname, Einrichtungsart, Zeitzone und Minuten je Unterrichtseinheit. Die Zeitzone wirkt unter anderem auf Datumswechsel und öffentliche Heute-/Morgen-Anzeigen.
Verwaltungszugänge können die freigegebenen Einrichtungsangaben ändern. Ein Planungsverantwortlicher erhält nicht automatisch dieselben Einstellungsrechte. Speichere erst nach Kontrolle der Auswirkungen auf Planung und Soll.
## Darstellung wählen
Über den Schalter **Darstellung** oben rechts oder den Abschnitt **Darstellung** in den Einstellungen kannst du zwischen **Hell**, **Dunkel** und **System** wählen. System folgt automatisch der Hell-/Dunkel-Einstellung deines Betriebssystems. Die Auswahl wird sofort übernommen und auf diesem Gerät im Browser gespeichert; du musst die Einrichtungseinstellungen dafür nicht speichern. Auch andere geöffnete CampusZeit-Tabs übernehmen die Auswahl, einschließlich Wiki und Studierendenübersicht. Die Darstellung verändert keine Daten oder Einstellungen der Hochschule.
## Zugänge und Lizenz
Der Betreiber stellt Zugänge bereit; es gibt derzeit keine Selbstregistrierung oder integrierte Zahlung. Kundenkonten sind einer Einrichtung zugeordnet. Die Einstellungen zeigen die vorhandene Lizenzlaufzeit.
Bei abgelaufener Lizenz bleiben lesende Zugriffe und öffentliche Anzeigen verfügbar; schreibende Kundenaktionen sind gesperrt. Wende dich zur Verlängerung an den Betreiber. Ein automatisches Abo- und Zahlungssystem ist noch keine vorhandene Funktion.
## Demo und Vollversion
Die öffentliche Vercel-Demo verwendet fiktive Daten im Browser. Sie besitzt keine echte Anmeldung und synchronisiert Änderungen nicht zwischen Geräten. Automatische Planung, Dateiimporte und weitere Backendfunktionen sind dort eingeschränkt. Die vollständige Wiki ist ausschließlich in der angemeldeten Vollversion verfügbar.
## Funktionsgrenzen

Die App und die angemeldete Verwaltung sind unterschiedliche Zugänge. Die Verwaltung kann nach dem Speichern einer Person einen **Persönlichen Zugang** erstellen; dadurch entstehen keine Verwaltungsrechte. Der erste App-Login verlangt ein eigenes Passwort. Gruppen-QR-Zugänge bleiben zusätzlich erhalten. Push bei geschlossener App benötigt einen zusätzlich eingerichteten Apple-Push-Dienst und eine passende App-Signierung; die Benachrichtigungsfreigabe allein aktiviert ihn nicht. Den Status siehst du im App-Profil unter **App-Freigaben → Push-Zustellung**.

CampusZeit prüft eingepflegte Regeln, ersetzt aber keine fachliche Freigabe. Studienstruktur und Planung werden nicht automatisch aus einem Modulhandbuch abgeleitet. Das System ist kein Prüfungsbewertungs-, Hausarbeitsupload- oder vollständiges Kurswahlportal.
