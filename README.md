# Field Terminal

Lokales Recherchewerkzeug im Stil eines Feldterminals. Eine einzelne Webanwendung in Vanilla JavaScript, ohne Server und ohne Build-Schritt. Falldaten werden lokal im Browserprofil gespeichert. Online-Karten und Wetter nutzen externe Dienste. Oberfläche und Dokumentation sind deutsch.

Das Projekt war zuvor ein Spiel. Dieser Stand beschreibt das Werkzeug. Reste der früheren Missionsmechanik sind noch im Code vorhanden und werden schrittweise und nur nach Freigabe entfernt (siehe „Bekannte Grenzen").

## Starten

- Windows: `START_3D.bat`. Öffnet `index.html` in einem Edge-Anwendungsfenster mit Grafikbeschleunigung, die für die 3D-Karte nötig ist.
- Linux: `bash START.sh` (Chromium-Anwendungsfenster; `FT_OHNE_GPU=1` bei schwarzem Fenster).
- Das Browserprofil liegt im Ordner `profil` neben dem Starter. Ordner löschen setzt alles zurück.
- Die Anmeldung erfolgt mit einem Kennwort, das beim ersten Start festgelegt wird.

Kartenhintergründe und Wetter werden von externen Diensten geladen. Die Zugangsdaten für den Kartendienst liegen in der lokalen Datei `kartenschluessel.js`, die nie ins Repository gehört (`.gitignore`).

## Arbeitsnavigation

Die sichtbaren Arbeitsbereiche sind Profil (`1`), Dossiers (`2`), Karte (`3`) und Ablage (`4`). Die früheren Missionsreiter sind aus der Navigation und den Tastenkürzeln entfernt. Gespeicherte Altstände öffnen stattdessen das Profil. Missionsdaten und interne Abläufe bleiben in diesem Schritt unverändert.

Im Profil entfernt „Karte bereinigen“ nach Bestätigung Pins, eigene Zonen, Sichtungen und gesetzte Kartenpositionen. Vorgegebene Dossierpositionen werden danach nicht mehr angezeigt. Dossiers, Unterlagen, Identitäten und Protokolle bleiben erhalten.

## Bausteine

| Datei | Inhalt |
|---|---|
| `index.html` | Anwendung: Ablauf `dispatch` → `ACTIONS` → `render`, Dossiers, Verbindungsgraph, Profil und Identitäten, Nachrichten |
| `karte-modul.js` | Lagekarte in 2D (Kacheln, Zonen, Pins, Messen), Brücke zur 3D-Ansicht |
| `karte3d.html` | 3D-Ansicht mit MapLibre, eingebettet in die Karte |
| `karte.js`, `karte2.js` | Kartendaten |
| `akten-modul.js` | Ablage: Aktenliste, Dokumentenansicht, Schwärzungen, Einsichtsanträge |
| `recherche-modul.js` | Recherche: Unterlagen zum Fall, Fallpaket (Export und Import) |
| `szenario.js`, `dialog.js`, `klassifikator.js` | Szenariodaten und Dialogmaschine |
| `docs/datenvertrag.md` | Datenvertrag der Recherche und des Fallpakets |
| `tests/` | Playwright-Skripte |

Die Module nach dem Hauptskript sind klassische Skripte und werden nach ihm geladen. Die Anwendung startet im `load`-Ereignis.

## Daten

- Das Profil (Dossiers, Pins, Ausgangsorte, Recherche, Kartenprotokoll) liegt in `localStorage`.
- Belegdateien der Recherche liegen in einer eigenen IndexedDB `fieldterminal.recherche`, Prüfsummen werden mit SHA-256 gebildet.
- Kennungen (Fall, Quelle, Fassung, Beobachtung, Aussage, Pin) werden fortlaufend vergeben und nicht wiederverwendet.

## Recherche

- **Unterlagen zum Fall:** Im Dossier werden Unterlagen einem Fall zugeordnet (Fall, Quelle, Fassung, Beobachtung). Das Formular ist einklappbar. Die Fundstelle (Seite, Absatz, Zeitmarke, Zeichenbereich) ist optional und richtet sich nach dem Material. Eine Unterlage lässt sich als geprüft und nützlich markieren, mit Notiz.
- **Sichtung:** Ein Knopf im Dossier öffnet die Karte am letzten bekannten Punkt der Person und legt dort einen Entwurfs-Pin M-01, M-02 usw. an, der sich als Sichtung eintragen lässt.
- **Frühere Aussagen:** Das Aussagenregister ist entfernt (keine Oberfläche, keine Bearbeitung). Vorhandene Aussagen bleiben unverändert erhalten und reisen im Fallpaket mit.
- **Fallpaket:** Ein Fall mit Quellen, Unterlagen, Belegdateien und den benötigten Dossierangaben lässt sich als eine Datei sichern und laden. Das Paket trägt ein Manifest mit Prüfsummen. Beim Laden wird vor jeder Änderung geprüft (ganz oder gar nicht) und ohne Überschreiben zusammengeführt. Eine fehlende Belegdatei wird aus dem Paket ergänzt, eine abweichende nie überschrieben.

## Karte

- 2D und 3D über den Schalter in der Kartenleiste. Marker, Zonen und Kamera gehen per `postMessage` an die 3D-Ansicht. Klicks laufen in beiden Ansichten durch dieselbe Logik.
- **Kartenprotokoll:** Ein eigener Reiter neben der Lagekarte erfasst Sichtungen, Zonen, Pins, Zugriffspunkte, Kartenpositionen und Ausgangsorte, nicht aber Mausbewegungen, Zoom oder Auswahl. Der Verfall ist wählbar (24, 48, 72 Stunden oder nie) und entfernt nur den Protokolleintrag, nie die Sichtung, Zone oder den Pin.
- **Eigene Zonen:** Zone markieren setzt eine Zone mit Name, Radius, Notiz, optionalem Dossier und verknüpften Unterlagen. „Stand aktualisieren“ hält die eigene Prüfung mit Zeitstempel fest und löst keine Meldung und keine Sichtung aus. Das Kartenprotokoll lässt sich nach Objekt filtern. Änderungen an Radius, Name und Dossier zeigen sich sofort in 2D und 3D; das Popup lässt sich an der Titelleiste verschieben. Zone und Pin lassen sich einem Dossier zuordnen; das Dossier zeigt sie unter „Orte zu diesem Dossier“, eine verknüpfte Unterlage unter „Auf der Karte“. Der Profilimport führt Zonen wie Pins zusammen (keine Doppelung, abweichender Inhalt unter neuer Kennung).
- **Lage-Box:** Ein gezielter Sprung (aus dem Dossier, über „Zentrieren“ einer Zone oder eines Pins) öffnet die Box mit dem Objekt (Name, Position, Stand), Licht und Wetter beziehen sich dann auf das Objekt. Erst eigenes Verschieben der Karte stellt auf die Kartenmitte zurück. Check-in, Ziele, Zeitfenster und die höchste Stufe im Bestand erscheinen nur während eines Auftrags. Offline erfolgt keine Wetterabfrage.
- In 3D noch offen: Luftbild, Verbindungen, Route, Sichtungs-Unschärfe, Zeitfenster.
- Zusatzquellen: Sentinel-2 cloudless (EOX, nicht kommerziell) und Brandenburg DOP20 (dl-de/by-2.0). Die Adressen sind nicht gegen die Dienste geprüft. Das BKG-DOP ist für Dritte gebührenpflichtig und wird nicht verwendet.
- Die Zeile „Licht" arbeitet offline (NOAA-Näherung). Wetter kommt von Open-Meteo, höchstens eine Abfrage je 0,1-Grad-Feld und 15 Minuten.

## Tests

Die Skripte in `tests/` benötigen Node.js mit Playwright. Das Testkennwort ist `pw-test-123`. Einige Skripte enthalten feste Pfade und müssen vor dem Lauf angepasst werden. Bekannt unzuverlässig: `abd`, `wk3`, `dp`; rot und nicht zu reparieren: `m1flow` (Missionsablauf).

## Bekannte Grenzen

- Eigene Zonen (Kennung ZO-nnn) lassen sich ohne Auftrag setzen. Lagezonen und Zugriffspunkte des Auftrags sind noch an den Missionsrahmen gekoppelt; eigene und Auftragszonen werden nicht gemeinsam bearbeitet. Eigene Zonen sind noch nicht Teil des Fallpakets.
- Prüfsummen im Fallpaket erkennen Beschädigung, keine Fälschung.
- Notizen und Bilder der Dossiers sind nicht Teil des Fallpakets, Belegdateien nicht Teil des Profilexports.
- Die Anwendung wurde bisher nur mit Playwright und nicht systematisch von Hand geprüft.

## Arbeitsweise

Pro Arbeitsrunde ein Branch und kleine Commits, danach Zusammenführung nach `main`. Änderungen gehen über einen Pull Request und werden unabhängig geprüft. Jeder Schritt hat einen Test, der auf dem vorherigen Stand fehlschlägt. `CLAUDE.md` enthält die Arbeitsregeln für Claude Code.
