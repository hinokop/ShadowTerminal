# Field Terminal

Lokales Recherchewerkzeug im Stil eines Feldterminals. Eine einzelne Webanwendung in Vanilla JavaScript, ohne Server und ohne Build-Schritt. Alle Daten bleiben im Browserprofil auf dem eigenen Gerät. Oberfläche und Dokumentation sind deutsch.

Das Projekt war zuvor ein Spiel. Dieser Stand beschreibt das Werkzeug. Reste der früheren Missionsmechanik sind noch im Code vorhanden und werden schrittweise und nur nach Freigabe entfernt (siehe „Bekannte Grenzen").

## Starten

- Windows: `START_3D.bat`. Öffnet `index.html` in einem Edge-Anwendungsfenster mit Grafikbeschleunigung, die für die 3D-Karte nötig ist.
- Linux: `bash START.sh` (Chromium-Anwendungsfenster; `FT_OHNE_GPU=1` bei schwarzem Fenster).
- Das Browserprofil liegt im Ordner `profil` neben dem Starter. Ordner löschen setzt alles zurück.
- Die Anmeldung erfolgt mit einem Kennwort, das beim ersten Start festgelegt wird.

Kartenhintergründe und Wetter werden von externen Diensten geladen. Die Zugangsdaten für den Kartendienst liegen in der lokalen Datei `kartenschluessel.js`, die nie ins Repository gehört (`.gitignore`).

## Bausteine

| Datei | Inhalt |
|---|---|
| `index.html` | Anwendung: Ablauf `dispatch` → `ACTIONS` → `render`, Dossiers, Verbindungsgraph, Profil und Identitäten, Nachrichten |
| `karte-modul.js` | Lagekarte in 2D (Kacheln, Zonen, Pins, Messen), Brücke zur 3D-Ansicht |
| `karte3d.html` | 3D-Ansicht mit MapLibre, eingebettet in die Karte |
| `karte.js`, `karte2.js` | Kartendaten |
| `akten-modul.js` | Ablage: Aktenliste, Dokumentenansicht, Schwärzungen, Einsichtsanträge |
| `recherche-modul.js` | Recherche: Fälle, Quellen, Fassungen, Beobachtungen, Prüfstand und Einschätzung |
| `szenario.js`, `dialog.js`, `klassifikator.js` | Szenariodaten und Dialogmaschine |
| `docs/datenvertrag.md` | Datenvertrag der Recherche und des Fallpakets |
| `tests/` | Playwright-Skripte |

Die Module nach dem Hauptskript sind klassische Skripte und werden nach ihm geladen. Die Anwendung startet im `load`-Ereignis.

## Daten

- Das Profil (Dossiers, Pins, Ausgangsorte, Recherche) liegt in `localStorage`.
- Belegdateien der Recherche liegen in einer eigenen IndexedDB `fieldterminal.recherche`, Prüfsummen werden mit SHA-256 gebildet.
- Kennungen (Fall, Quelle, Fassung, Beobachtung, Aussage, Pin) werden fortlaufend vergeben und nicht wiederverwendet.

## Karte

- 2D und 3D über den Schalter in der Kartenleiste. Marker, Zonen und Kamera gehen per `postMessage` an die 3D-Ansicht. Klicks laufen in beiden Ansichten durch dieselbe Logik.
- In 3D noch offen: Luftbild, Verbindungen, Route, Sichtungs-Unschärfe, Zeitfenster.
- Zusatzquellen: Sentinel-2 cloudless (EOX, nicht kommerziell) und Brandenburg DOP20 (dl-de/by-2.0). Die Adressen sind nicht gegen die Dienste geprüft. Das BKG-DOP ist für Dritte gebührenpflichtig und wird nicht verwendet.
- Die Zeile „Licht" arbeitet offline (NOAA-Näherung). Wetter kommt von Open-Meteo, höchstens eine Abfrage je 0,1-Grad-Feld und 15 Minuten.

## Tests

Die Skripte in `tests/` benötigen Node.js mit Playwright. Das Testkennwort ist `pw-test-123`. Einige Skripte enthalten feste Pfade und müssen vor dem Lauf angepasst werden. Bekannt unzuverlässig: `abd`, `wk3`, `dp`; rot und nicht zu reparieren: `m1flow` (Missionsablauf).

## Bekannte Grenzen

- Zonen und Zugriffspunkte der Karte sind noch an den Missionsrahmen gekoppelt und lassen sich ohne ihn nicht setzen.
- Prüfsummen im Fallpaket erkennen Beschädigung, keine Fälschung.
- Notizen und Bilder der Dossiers sind nicht Teil des Fallpakets.
- Die Anwendung wurde bisher nur mit Playwright und nicht systematisch von Hand geprüft.

## Arbeitsweise

Pro Arbeitsrunde ein Branch und kleine Commits, danach Zusammenführung nach `main`. Änderungen gehen über einen Pull Request und werden unabhängig geprüft. Jeder Schritt hat einen Test, der auf dem vorherigen Stand fehlschlägt. `CLAUDE.md` enthält die Arbeitsregeln für Claude Code.
