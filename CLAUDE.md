# Field Terminal (Repo: ShadowTerminal)

Lokales Einzeldatei-Projekt (Vanilla JS), fiktives Feldterminal. Sprache der Oberfläche und der Arbeit: Deutsch.
Nutzer: Shadow ("Master Wayne"): formell, präzise, keine Emojis, kein Füllmaterial; Schwächen und Widersprüche ungefragt benennen; nie halluzinieren.

## Aufbau
- index.html: Anwendung (dispatch -> ACTIONS -> render, Plansystem, Ablage, Karte)
- szenario.js: Szenario/Dossier/Ablage-Dokumente; dialog.js + klassifikator.js: Dialogmaschine
  (Absichten in DIALOG.absichten, Antwortgruppen MÜSSEN in DIALOG.antworten[kat][kanal] liegen)
- karte.js / karte2.js: Kartendaten; kartenschluessel.js: lokal, NIE committen (.gitignore)
- tests/: Playwright-Skripte (Passwort 'pw-test-123'); bekannt unstabil: abd, wk3, dp
- karte3d.html: MapLibre-3D-Prototyp (Branch feature/maplibre-3d), nutzt Koordinaten aus szenario.js

## Arbeitsweise
- Pro Arbeitsrunde ein Branch, kleine Commits; Historie ersetzt ZIP-Backups.
- Ziel langfristig: Basismission "Transportlinie Ost" ersetzen; nur Rahmen bleibt, getrieben von Dossier, Ablage, Nachrichten.
- Keine spielartigen Hinweise/Zahlen in der Oberfläche; mehr Realismus.
