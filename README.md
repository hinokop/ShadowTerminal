# Shadow Terminal

Privates Recherchewerkzeug mit deutschsprachiger Oberfläche. Die Anwendung läuft lokal im Browser ohne Build-Schritt und ohne gehostetes Backend. Unter Windows steht für den Dateizugriff eine lokale Python-Brücke zur Verfügung.

## Ist-Stand

| Modul | Funktion |
| --- | --- |
| **Profil** | Identitäten, Ausgangsorte, Arbeitsstatus und Terminal mit lokaler Dateibrücke. |
| **Dossiers** | Personen, Organisationen und Orte mit Kurzlage, Notizen, Aufnahmen, Sichtungen, Verbindungen und Unterlagen. Fallverweise führen direkt zu X. |
| **Karte** | 2D- und 3D-Lagekarte mit Pins, eigenen Zonen, Sichtungen, Messung und Kartenprotokoll. Online-Kacheln und Wetter nutzen externe Dienste. |
| **Ablage** | Registratur und lokaler Eingang mit Dateivorschau. Bei der Zuordnung zu Fall und Dossier bleibt dieselbe Dateikopie erhalten. |
| **X** | Fälle mit Kurzlage, Arbeitsstand und Bewertung der Informationslage. Dossiers und Pins sind verknüpft. Beim Löschen eines Falls bleiben die verknüpften Dossiers und Pins erhalten. |

Profile und Anhänge liegen im lokalen Browserprofil. Profilexporte enthalten keine Belegdateien. Fallpakete enthalten fallbezogene Rechercheunterlagen samt Prüfsummen und den erforderlichen Dossierangaben. Die Satelliten- und Secure-Channel-Sequenzen des Terminals sind lokale Simulationen.

## Geplant

- Verbliebene Missionspfade und historische Tests auf tatsächliche Nutzung prüfen. Nachweislich ungenutzten Code und überholte Tests getrennt bereinigen.
- Den Anwendungskern schrittweise in kleinere, eigenständig prüfbare Module aufteilen. Bestehende Profile sowie Import und Export bleiben kompatibel.
- Ein appweiter Offline-Modus ist vorerst zurückgestellt.

## Technische Referenz

- [Datenvertrag und Fallpakete](docs/datenvertrag.md)
- [Verbliebene Missionsabhängigkeiten](docs/missionsabhaengigkeiten.md)
- [Stand der bisherigen Bereinigung](docs/r5-bereinigung.md)
