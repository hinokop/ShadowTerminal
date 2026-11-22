# Field Terminal (Repo: ShadowTerminal)

Lokales Recherchewerkzeug (Vanilla JS, ohne Build-Schritt, `file://`-fähig), Oberfläche im Stil eines Feldterminals; früher ein Spiel, jetzt Werkzeug. Arbeitssprache und interne Dokumentation Deutsch; sichtbare Terminalmeldungen und Oberfläche werden nach Freigabe schrittweise auf Englisch umgestellt (Tests und Dokumentation synchron).
Nutzer: Shadow ("Master Wayne"): formell, präzise, keine Emojis, kein Füllmaterial; Schwächen und Widersprüche ungefragt benennen; nie halluzinieren.

## Wo der Stand steht

Aktueller Stand von `main`, offene Pull Requests, Reihenfolge der nächsten Schritte, offene Entscheidungen und Dokumentenlandkarte stehen **ausschließlich in [docs/AKTUELL.md](docs/AKTUELL.md)**. Diese Datei enthält nur dauerhafte Regeln und den Aufbau und nennt bewusst keine PR-Nummern oder Phasenstände. Verbindlich sind außerdem [docs/terminal-entwicklungsplan-2026-11.md](docs/terminal-entwicklungsplan-2026-11.md) und spätere ausdrückliche Entscheidungen von Shadow. Vor Änderungen und Reviews beides lesen.

## Verbindliche Regeln

- Kleine, einzeln prüfbare Pull Requests; pro Arbeitsrunde ein Branch von `main`. Kein Big-Bang-Umbau, keine ungeprüften Merges.
- Merge, Löschen von Branches oder Daten und Force-Push nur nach ausdrücklicher Freigabe von Shadow. Weder erfolgreiche CI noch ein positives Review ersetzen diese Freigabe.
- Unabhängige Prüfung durch ChatGPT; Teststand im Pull Request angeben als bestätigt, fehlgeschlagen oder nicht ausgeführt. Nur wirklich ausgeführte Tests als solche bezeichnen. Reine Sichtungen, Reviews und Dokumentationsänderungen erfordern keinen Volllauf (Diff prüfen).
- Codeänderungen: gezielte Regression, vor Merge die volle Standardauswahl; bekannte Ausfälle separat bewerten. Produktionscode und Tests getrennt nachvollziehbar ändern.
- Gespeicherte Daten (Zustand, Profil, Anhänge, IndexedDB) nie verlustbehaftet ändern; alte Profile und der Profilimport müssen tolerant bleiben (Vertrag: docs/datenvertrag.md). Manuelle Dossiersperren und ihre Vererbung auf Pins, Zonen und Sichtungen bleiben erhalten.
- Keine Produktsemantik ohne Entscheidung von Shadow ändern. Die Karte (2D/3D, Pins, Profilzonen, Ebenen, Messung, Protokoll, Wetter) wird nicht vereinfacht; Zonen sind keine Pins. Die visuelle Identität einschließlich Libelle bleibt.
- Keine spielartigen Hinweise oder Zahlen in der Oberfläche; mehr Realismus.
- `map PIN/ZO` führt zur Karte, `open PIN/ZO` zum verknüpften Dossier.
- Windows-Testpakete sind für umfassende GUI- und Integrationsabnahmen vorgesehen, nicht für jeden Einzel-Fix. Abnahmen echter Daten nur an Kopien.

## Aufbau

- `index.html`: Anwendung (dispatch -> ACTIONS -> render, Zustand und Speicher `Store`, Terminal). Das Hauptskript wird zuerst geladen; die Module danach, die App startet im load-Ereignis. Tabellen im Hauptskript müssen Funktionen der Module lazy referenzieren.
- `szenario.js`: Szenario- und Dossierdaten. Der Dialogkern (`dialog.js`, `klassifikator.js`) und der Missionsbetrieb wurden entfernt; Altfelder im Zustand bleiben bis zur Migration erhalten.
- `karte-modul.js`: Modul Karte (Reiter 3; interne Registrierung 6): 2D-Renderer, Kachelspeicher (KGRUPPE), Zonen, Pins, Messen, 3D-Brücke, Zusatzquellen (`SAT_QUELLEN`), Zeile "Licht" (offline) und Wetter (Open-Meteo, höchstens eine Abfrage je 0,1-Grad-Feld und 15 Minuten). `karte.js`, `karte2.js`: Kartendaten. `kartenschluessel.js`: lokal, nie committen (`.gitignore`). BKG-DOP ist für Dritte gebührenpflichtig und nicht zu verwenden.
- `karte3d.html`: MapLibre-3D-Ansicht, per iframe eingebettet, erhält Marker, Zonen und Kamera per postMessage; Klicks laufen über `st.klick` (`KARTE_ST`) wie in 2D. Offen in 3D: Luftbild, Verbindungen, Route, Sichtungs-Unschärfe, Zeitfenster.
- `akten-modul.js`: Modul Ablage (Reiter 4; interne Registrierung 7); produktiv nur lokaler Eingang mit Dateivorschau (Kommentar im Dateikopf noch veraltet, siehe docs/AKTUELL.md).
- `profil-modul.js`: Modul Profil (Arbeitsprofil, Identitäten mit lokalen Anlagen, Ausgangsorte). `fall-modul.js`: Modul X (Fälle, Verknüpfung mit Dossiers und Pins, Fallverweise im Dossier).
- `recherche-modul.js`: Recherche-Kern (kein eigener Reiter; Bedienung über Dossiers und X), Unterlagen zum Fall, Fallpaket (Export/Import mit Manifest und Prüfsummen); `PROFIL.recherche`, Dateien in eigener IndexedDB. Vertrag: docs/datenvertrag.md.
- `arbeitsstand-modul.js`: Arbeitsstand (Sichern/Laden in der Navigation; nur auf Klick, kein Autosprung, nicht Teil des Fallpakets; prüft beim Laden die Identität von Fall und eigenem Dossier).
- Zugang zu Zielen: `zielZugang(id)` für Dossiers, Pins und Zonen, gemeinsam für Oberfläche und Terminal. Es zählt ausschließlich die **manuelle** Dossiersperre; PIN/ZO und Sichtungen erben sie.
- `terminal_lokal.py`: lokale Dateibrücke (Archivordner neben dem Starter, Exportarten pin, zone, sichtung; Ersetzen nur eigener unveränderter Dateien; Nmap-Anbindung). `docs/terminal.md`: Statusanzeigen im Fensterkopf und Grenze Simulation / echte Zugriffe.
- Terminal-nmap: echtes installiertes Nmap über die Brücke (`nmap-start/-read/-stop`), Argumente ohne Shell und ohne Einschränkung (Entscheidung Shadow); scannt die echten Schnittstellen des PCs, nicht die Simulation. Test `tests/terminal-nmap.js` mit Ersatz-nmap (nur POSIX), Windows-Abnahme lokal bei Shadow.
- Terminalbenutzer: `raizo` (Prompt `raizo@terminal:/$`), kein root, damit sudo ein Kennwort verlangen kann; Abweichungen in docs/terminal.md.
- Start: Windows `START_TERMINAL.bat` (Edge-Anwendungsfenster mit Dateibrücke, Python 3, ruft `START_3D.bat` auf) oder `START_3D.bat` (ohne Dateibrücke, mit GPU, für 3D nötig); Linux `START.sh`.

## Tests

`node tests/runall.js` führt die Standardauswahl aus (Playwright, Passwort `pw-test-123`); einzelne Skripte: `node tests/runall.js zev zp`. Gleichzeitig laufen höchstens `FT_PARALLEL` Skripte (Vorgabe: Anzahl der Kerne). Historische Skripte des stillgelegten Missionsablaufs sind nur namentlich aufrufbar. Bekannt rot oder instabil: `m1flow`, `wk3`, `dp`; `lage-box` unter Parallellast. Ausgemusterte Tests: docs/r5-bereinigung.md. CI: `.github/workflows/ci.yml` führt die Standardauswahl bei jedem Pull Request gegen `main` und jedem Push auf `main` aus; die phasengebundenen Workflows (`phase5*-regression.yml`) sind Altbestand (Einzelheiten in docs/AKTUELL.md).

## Git

`main` ist der Hauptstand (nicht geschützt). Historie ersetzt ZIP-Backups. Pull Requests werden als Draft eröffnet, mit Teststand und Ungeprüftem in der Beschreibung.
