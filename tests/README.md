# Tests

Playwright-Skripte (`npm i playwright`; für die 3D-Tests zusätzlich `npm i maplibre-gl@4.7.1` oder `MAPLIBRE_DIR=/pfad/zu/maplibre-gl/dist`).
Pfade werden aus der Lage des Ordners gebildet (`_pfad.js`), das Projekt kann also an beliebiger Stelle liegen.
Passwort der Testanmeldung: `pw-test-123`. Die Skripte aus der Anfangszeit (aa*.js usw.) enthalten noch feste Pfade nach `/home/claude`.

Karte und 3D:
- `kperf.js`: Kachelgruppe, Neuzeichnen
- `sat.js`: Zusatzquellen (Sentinel-2, Brandenburg), Fehleranzeige, Schalter, Speicherung
- `k3d.js`, `k3d5.js`: 3D-Einbettung, Klick (Auswahl, Pin, Messen), kein Neuladen
- `k3d2.js`: WebGL-Prüfung mit und ohne Starter-Flags
- `k3dfehler.js`: Bibliothek fehlt, Stil nicht erreichbar, Kontextverlust
- `zpform.js`: Layout des Zugriffspunkt-Popups

Die Dienste (Kacheln, OpenFreeMap) werden in den Tests durch Platzhalter ersetzt; die Tests prüfen daher Ablauf und Fehlerbehandlung, nicht die echte Darstellung.
