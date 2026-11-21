# Field Terminal (Repo: ShadowTerminal)

Lokales Recherchewerkzeug (Vanilla JS, ohne Build-Schritt), Oberfläche im Stil eines Feldterminals; früher ein Spiel, jetzt Werkzeug (README: Ist-Stand und Planung). Arbeitssprache und interne Dokumentation derzeit Deutsch; sichtbare Terminalmeldungen und Oberfläche werden nach Freigabe schrittweise auf Englisch umgestellt (Tests und Dokumentation synchron).
Nutzer: Shadow ("Master Wayne"): formell, präzise, keine Emojis, kein Füllmaterial; Schwächen und Widersprüche ungefragt benennen; nie halluzinieren.

## Verbindlicher Entwicklungsplan (21.11.2026)

Vor Änderungen und Reviews **[docs/terminal-entwicklungsplan-2026-11.md](docs/terminal-entwicklungsplan-2026-11.md)** beachten. #97, #95 und #96 sind in `main` integriert. **Aktuell Phase 5:** [docs/phase5-missionsinventar.md](docs/phase5-missionsinventar.md); zuerst missionsabhängige Dossierfreigabe (5a), dann Missions-/Kontaktnebenwirkungen (5b), schließlich Schema-/Altprofil-Migration (5c). Anschließend Unix-/Linux-Realismus und Englisch. `map PIN/ZO` führt zur Karte, `open PIN/ZO` zum verknüpften Dossier. Windows-Testpakete sind für umfassende GUI-/Integrationsabnahmen vorgesehen, nicht für jeden Einzel-Fix. Keine ungeprüften Merges.

## Aufbau
- index.html: Anwendung (dispatch -> ACTIONS -> render, Plansystem, Ablage, Karte)
- szenario.js: Szenario/Dossier/Ablage-Dokumente; dialog.js + klassifikator.js: Dialogmaschine
  (Absichten in DIALOG.absichten, Antwortgruppen MÜSSEN in DIALOG.antworten[kat][kanal] liegen)
- karte-modul.js: Modul Karte (Reiter 3; interne Registrierung 6) Lagekarte (2D-Renderer, Kachelspeicher, Zonen, Pins, Messen, 3D-Brücke); klassisches Skript, wird NACH dem Hauptskript geladen, App startet im load-Ereignis. Tabellen im Hauptskript müssen Karten-Funktionen lazy referenzieren.
- Zugang zu Zielen: zielZugang(id) (index.html, bei dossierGesperrt) für Dossiers, Pins und Zonen, gemeinsam für Oberfläche und Terminal. PIN/ZO erben eine **manuelle** Sperre des verknüpften Dossiers; Sichtungen ebenso. **Phase 5a (Draft):** Altdaten aus `infozugang` und Missionsfreigaben begrenzen die Dossieransicht nicht mehr. Die gespeicherten Felder bleiben bis zur Migration erhalten; den Missions- und Hintergrundcode erst in 5b/5c ausbauen.
- akten-modul.js: Modul Ablage (Reiter 4; interne Registrierung 7) (Aktenliste, Dokumentenansicht, Schwärzungen, Einsichtsanträge); wie karte-modul.js nach dem Hauptskript geladen, in der Tabelle der Render-Funktionen lazy referenziert.
- profil-modul.js: Modul Profil (Arbeitsprofil, Identitäten mit lokalen Anlagen, Ausgangsorte); fall-modul.js: Modul X (Fälle, Verknüpfung mit Dossiers und Pins, Löschen eines Falls, Fallverweise im Dossier); beide nach dem Hauptskript geladen.
- terminal_lokal.py: lokale Dateibrücke (Archivordner neben dem Starter, Exportarten pin, zone, sichtung; Ersetzen nur eigener unveränderter Dateien); wird von START_TERMINAL.bat gestartet.
- Weitere Auslagerungskandidaten: Dossiers (Modul 3), Dialogkern; immer einzeln, mit vollem Testlauf (tests, runall).
- karte.js / karte2.js: Kartendaten; kartenschluessel.js: lokal, NIE committen (.gitignore)
- tests/: Playwright-Skripte (Passwort 'pw-test-123'); Standardauswahl mit `node tests/runall.js` (einzelne Skripte: `node tests/runall.js zev zp`); bekannt rot oder unstabil: m1flow (Missionsablauf, auch auf main rot), wk3, dp (abd war eine veraltete Testerwartung, behoben); lage-box unter Parallellast instabil; gleichzeitig laufen höchstens FT_PARALLEL Skripte (Vorgabe: Anzahl der Kerne), seitdem missionstrennung und lage-box in drei Läufen grün. Ausgemusterte Tests: docs/r5-bereinigung.md
- recherche-modul.js: Recherche-Kern (kein eigener sichtbarer Reiter; Bedienung über Dossiers und X), Unterlagen zum Fall (Fall, Quelle, Fassung, Beobachtung am Dossier ohne Auftrag; PROFIL.recherche, Dateien in eigener IndexedDB); nach dem Hauptskript geladen, Fallpaket (Export/Import mit Manifest und Prüfsummen; frühere Aussagen nur als Altdaten); Vertrag in docs/datenvertrag.md
- arbeitsstand-modul.js: Arbeitsstand (Stand sichern/laden in der Navigation; PROFIL.arbeitsstand: Bereich, Dossier, Fall, Kartenmitte, Zoom, Ebenen, Kartenobjekt); nach dem Hauptskript geladen, nur auf Klick, kein Autosprung, nicht Teil des Fallpakets; prüft beim Laden die Identität von Fall (Nummer und Erfassungszeitpunkt) und eigenem Dossier (Registernummer), setzt Platziermodi der Karte zurück
- docs/terminal.md: Statusanzeigen im Fensterkopf (DIALING, PPP SETUP, EST. LINK END) und Grenze Simulation / echte Zugriffe.
- nmap im Terminal: echtes installiertes Nmap über terminal_lokal.py (nmap-start/-read/-stop), Argumente ohne Shell und ohne Einschränkung (Entscheidung Shadow), scannt die echten Schnittstellen des PCs, nicht die Simulation; Test tests/terminal-nmap.js mit Ersatz-nmap (nur POSIX), Windows-Abnahme lokal bei Shadow.
- Terminalbenutzer: raizo (Prompt raizo@terminal:/$, whoami), kein root, damit sudo ein Kennwort verlangen kann; Abweichungen in docs/terminal.md.
- karte3d.html: MapLibre-3D-Ansicht (eingebettet in die Karte; eigenständig nutzt sie szenario.js)

## Arbeitsweise
- Pro Arbeitsrunde ein Branch, kleine Commits; Historie ersetzt ZIP-Backups.
- Alte Missionsmechanik und gespeicherte Altprofile bestehen teilweise weiter. **Shadow hat den Abbau am 2026-11-21 freigegeben; Phase 5a ist ein noch nicht getesteter Draft, kein vollständiger Rückbau.** Abhängigkeiten im neuen Phase-5-Inventar prüfen. Manuelle Dossiersperren und Profilkompatibilität unbedingt erhalten; Produktionscode und Tests getrennt nachvollziehbar ändern.
- Ablauf bei Codeänderungen: passender Branch (abhängige Drafts auf ihrer dokumentierten Basis), gezielte Regression und vor Merge volle Standardauswahl; bestehende bekannte Ausfälle separat bewerten. **Reine Sichtungen/Reviews erfordern keinen Volllauf**; nur wirklich ausgeführte Tests als solche bezeichnen. Dokumentationsänderungen: Diff prüfen. Draft-PR mit Teststand und Ungeprüftem, unabhängige Prüfung durch ChatGPT, Merge erst nach Freigabe von Shadow und ChatGPT. Nichts löschen, nichts force-pushen ohne ausdrücklichen Auftrag.
- Datenformat und Kompatibilität: Änderungen an gespeicherten Daten müssen alte Profile und den Profilimport tolerieren (Vertrag: docs/datenvertrag.md).
- Keine spielartigen Hinweise/Zahlen in der Oberfläche; mehr Realismus.

## Karte (Stand)
- Kacheln liegen in einer dauerhaften SVG-Gruppe (KGRUPPE); beim Neuzeichnen werden Bildelemente nicht mehr entfernt und neu eingesetzt.
- 3D-Ansicht: Schalter "3D"/"2D" in der Kartenleiste; karte3d.html wird eingebettet (iframe) und erhält Marker, Zonen und Kamera per postMessage.
  Klicks in 3D laufen über st.klick (KARTE_ST) wie in 2D. Offen in 3D: Luftbild, Verbindungen, Route, Sichtungs-Unschärfe, Zeitfenster.
- Zusatzquellen (SAT_QUELLEN in karte-modul.js): Sentinel-2 cloudless (EOX, nicht-kommerziell) und Brandenburg DOP20 (dl-de/by-2.0); Adressen ungeprüft gegen die Dienste. BKG-DOP ist für Dritte gebührenpflichtig, nicht verwenden.
- Karte: Zeile "Licht" (offline, NOAA-Näherung, geprüft gegen astral) und Wetter (Open-Meteo, dauerhaft an, max. 1 Abfrage je 0,1-Grad-Feld/15 min).
- Start unter Windows: START_TERMINAL.bat (Edge-Anwendungsfenster mit lokaler Dateibrücke, Python 3) oder START_3D.bat (ohne Dateibrücke, mit GPU, für 3D nötig). Frühere Starter (START.bat, START_LOKAL.bat, START_SICHER.bat, START.vbs, DIAGNOSE.bat, PROFIL_UEBERNEHMEN.bat) wurden entfernt, siehe Git-Historie. START.sh bleibt für Linux.

## Git
- main ist der Hauptstand. Pro Arbeitsrunde ein Branch von main, danach nach main zusammenführen.
