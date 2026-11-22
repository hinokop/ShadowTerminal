# Shadow Terminal

Privates Recherchewerkzeug mit deutschsprachiger Oberfläche. Die Anwendung läuft lokal im Browser ohne Build-Schritt und ohne gehostetes Backend. Für den Dateizugriff und das Terminal-Nmap steht eine lokale Python-Brücke zur Verfügung.

Diese Datei beschreibt den Stand von `main`. Offene Pull Requests, die Reihenfolge der nächsten Schritte und offene Entscheidungen stehen in [docs/AKTUELL.md](docs/AKTUELL.md); Entwicklungsregeln in [CLAUDE.md](CLAUDE.md).

## Start

- Windows: `START_TERMINAL.bat` (Edge-Anwendungsfenster mit lokaler Dateibrücke, Python 3 erforderlich) oder `START_3D.bat` (ohne Dateibrücke, mit GPU; für die 3D-Ansicht nötig).
- Linux: `START.sh` (Chromium-Anwendungsfenster).
- `index.html` bindet die lokale, nicht versionierte Datei `kartenschluessel.js` (Kartenschlüssel) ein; sie soll neben `index.html` liegen. Fehlt sie, ist beim Start eine Ladefehlermeldung für diese Datei zu erwarten (nicht getestet).

## Ist-Stand

| Modul | Funktion |
| --- | --- |
| **Profil** | Identitäten, Ausgangsorte, Arbeitsstatus und Terminal mit lokaler Dateibrücke. |
| **Dossiers** | Personen, Organisationen und Orte mit Kurzlage, Notizen, Aufnahmen, Sichtungen, Verbindungen und Unterlagen. Fallverweise führen direkt zu X. |
| **Karte** | 2D- und 3D-Lagekarte mit Pins, eigenen Zonen, Sichtungen, Messung und Kartenprotokoll. Online-Kacheln und Wetter nutzen externe Dienste. |
| **Ablage** | Lokaler Eingang mit Dateivorschau. Bei der Zuordnung zu Fall und Dossier bleibt dieselbe Dateikopie erhalten. Die frühere Registratur mit Einsichtsanträgen wurde aus der Oberfläche entfernt; ihre Altdaten bleiben im gespeicherten Profil unverändert erhalten. |
| **X** | Fälle mit Kurzlage, Arbeitsstand und Bewertung der Informationslage. Dossiers und Pins sind verknüpft. Beim Löschen eines Falls bleiben die verknüpften Dossiers und Pins erhalten. |

Profile und Anhänge liegen im lokalen Browserprofil. Profilexporte enthalten keine Belegdateien. Fallpakete enthalten fallbezogene Rechercheunterlagen samt Prüfsummen und den erforderlichen Dossierangaben. Die Satelliten- und Secure-Channel-Sequenzen des Terminals sind lokale Simulationen; `nmap` im Terminal dagegen startet ein echtes, auf dem PC installiertes Nmap über die lokale Brücke (Einzelheiten in [docs/terminal.md](docs/terminal.md)).

## Geplant

Die Planung mit Reihenfolge und offenen Entscheidungen führt [docs/AKTUELL.md](docs/AKTUELL.md). Grundzüge:

- Abschluss des Abbaus der alten Missionsstruktur im gespeicherten Zustand (Schema- und Altprofilmigration, ohne Datenverlust).
- Unix-/Linux-Realismus im Terminal und schrittweise Umstellung der Oberfläche auf Englisch, jeweils nach Freigabe.
- Den Anwendungskern schrittweise in kleinere, eigenständig prüfbare Module aufteilen. Bestehende Profile sowie Import und Export bleiben kompatibel.
- Ein appweiter Offline-Modus ist vorerst zurückgestellt.

## Technische Referenz

- [Datenvertrag und Fallpakete](docs/datenvertrag.md)
- [Terminal: Befehle, Zugriffsregeln, Grenze Simulation / echte Zugriffe](docs/terminal.md)
- [Karte: Befunde und vorgemerkte Optimierungen](docs/karte-optimierungen.md)
- [Entwicklungsplan 11/2026](docs/terminal-entwicklungsplan-2026-11.md)
- [Schema- und Migrationsinventar (Phase 5c)](docs/phase5c-schemainventar.md)
- Historisch: [Missionsabhängigkeiten](docs/missionsabhaengigkeiten.md), [Stand der ersten Bereinigung](docs/r5-bereinigung.md), [Inventar Phase 5](docs/phase5-missionsinventar.md)
