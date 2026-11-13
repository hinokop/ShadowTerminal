# Field Terminal (Repo: ShadowTerminal)

Lokales Einzeldatei-Projekt (Vanilla JS), fiktives Feldterminal. Sprache der Oberfläche und der Arbeit: Deutsch.
Nutzer: Shadow ("Master Wayne"): formell, präzise, keine Emojis, kein Füllmaterial; Schwächen und Widersprüche ungefragt benennen; nie halluzinieren.

## Aufbau
- index.html: Anwendung (dispatch -> ACTIONS -> render, Plansystem, Ablage, Karte)
- szenario.js: Szenario/Dossier/Ablage-Dokumente; dialog.js + klassifikator.js: Dialogmaschine
  (Absichten in DIALOG.absichten, Antwortgruppen MÜSSEN in DIALOG.antworten[kat][kanal] liegen)
- karte.js / karte2.js: Kartendaten; kartenschluessel.js: lokal, NIE committen (.gitignore)
- tests/: Playwright-Skripte (Passwort 'pw-test-123'); bekannt unstabil: abd, wk3, dp
- karte3d.html: MapLibre-3D-Ansicht (eingebettet in die Karte; eigenständig nutzt sie szenario.js)

## Arbeitsweise
- Pro Arbeitsrunde ein Branch, kleine Commits; Historie ersetzt ZIP-Backups.
- Ziel langfristig: Basismission "Transportlinie Ost" ersetzen; nur Rahmen bleibt, getrieben von Dossier, Ablage, Nachrichten.
- Keine spielartigen Hinweise/Zahlen in der Oberfläche; mehr Realismus.

## Karte (Stand)
- Kacheln liegen in einer dauerhaften SVG-Gruppe (KGRUPPE); beim Neuzeichnen werden Bildelemente nicht mehr entfernt und neu eingesetzt.
- 3D-Ansicht: Schalter "3D"/"2D" in der Kartenleiste; karte3d.html wird eingebettet (iframe) und erhält Marker, Zonen und Kamera per postMessage.
  Klicks in 3D laufen über st.klick (KARTE_ST) wie in 2D. Offen in 3D: Luftbild, Verbindungen, Route, Sichtungs-Unschärfe, Zeitfenster.
- 3D braucht WebGL: START.bat/START_LOKAL.bat/START_SICHER.bat/START.vbs schalten die GPU ab; START_3D.bat nicht.

## Git
- main ist der Hauptstand. Pro Arbeitsrunde ein Branch von main, danach nach main zusammenführen.
