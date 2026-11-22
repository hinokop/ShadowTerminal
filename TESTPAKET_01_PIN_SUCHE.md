# Testpaket 01 – Live-Pinsuche und Navigation per Tab

**Statusvermerk (22.11.2026):** PR #94 ist in `main` gemergt; die Angabe „nicht gemergt“ weiter unten ist überholt. Historisches Dokument; der Inhalt unten beschreibt den Stand zum Zeitpunkt der Erstellung und wurde nicht aktualisiert. Den aktuellen Stand führt [docs/AKTUELL.md](docs/AKTUELL.md).

**Stand:** Draft-PR #94 (`feat/terminal-pin-suche`). Dieses Paket enthält den vollständigen Stand des Branches und ist nicht gemergt.

## Windows-Praxistest

1. ZIP des Branches über GitHub **Code → Download ZIP** herunterladen, in einen separaten Testordner entpacken. Die lokale, nicht versionierte `kartenschluessel.js` aus der bestehenden Installation in den Testordner kopieren. Die produktiven Profildateien nicht überschreiben; bei Bedarf Profilexport/Import verwenden.
2. `START_TERMINAL.bat` öffnen und anmelden. Testdaten bevorzugt in einem eigenen Testprofil anlegen.
3. Mindestens drei Pins mit Namen anlegen, z. B. „Parkplatz Nord“, „Nordtor Lagerhalle“ und „Kühlhaus Quellweg“. Den letzten Pin einem Dossier zuordnen und dieses sperren.
4. Terminal: `map pins` zeigt alle drei Pins. Der gesperrte Pin erscheint **nur** mit seiner Kennung und `[LOCKED]`. Namen, Zweck und Koordinaten des gesperrten Pins werden nicht ausgegeben.
5. `map pins nord` zeigt die beiden passenden frei zugänglichen Pins. `map pins kühlhaus` darf den gesperrten Pin weder finden noch nennen. `map pins PIN-... ` mit der gesperrten Kennung soll ihn als `[LOCKED]` ausgeben.
6. Beim Tippen von `map Park`, `open Park`, `sudo map Park` und `sudo open Park` mit **Tab** vervollständigen: Das Ergebnis ist die unveränderliche `PIN-`-Kennung, nicht der frei veränderbare Name.
7. `map PIN-` + **Tab** aufrufen: Bei mehreren Treffern erscheint die bestehende Auswahlliste. Mehrfach Tab/Shift+Tab wechseln, Enter übernimmt ohne Navigation, Escape verwirft die Auswahl.
8. Der Name des gesperrten Pins wird auch bei Tab nicht angeboten; `map PIN-...` und `sudo map PIN-...` über dessen Kennung funktionieren wie bisher. Bei `sudo` wird die vorhandene Zugangskennung verdeckt abgefragt und das Dossier bei Erfolg entsperrt.
9. Karte → Ebenen / Sichtungen: Nach dem Ausblenden eines Pins muss `map pins` ihn weiterhin finden. `map PIN-...` verwendet beim Sprung die bestehende Sichtungslogik.
10. Ein frei zugänglicher Pin wird umbenannt oder neu angelegt: `map pins <Suchbegriff>` und Tab müssen unmittelbar den neuen Zustand erkennen, ohne Terminal- oder App-Neustart.

## Automatisierte Regression

Im Projektordner mit installiertem Playwright:

```powershell
cd tests
$env:FT_PARALLEL = "2"
node runall.js terminal-pin-suche terminal-navigation terminal-sudo terminal-auswahlliste terminal-vorschlag-ergaenzung terminal-befehlstabelle karte-sperre-pins
node runall.js
```

Die Standardauswahl enthält `terminal-pin-suche` und die vier zuvor eingeführten Tests (`terminal-benutzer`, `karte-sperre-pins`, `terminal-navigation`, `terminal-sudo`). `m1flow` ist historisch bekannt rot; auch `wk3`, `dp` und die unter Parallellast instabile `lage-box` werden separat ausgewiesen. Die Ausgabe liegt in `%TEMP%\ft-out`.

## Abnahmekriterien

- Keine Offenlegung manuell gesperrter Pinnamen/Zwecke über Suche oder Ergänzung.
- Keine Änderung der vorhandenen Daten- oder Dossiernummern.
- Kein Sitzungsverlust bei PPP, Profanity oder tmux durch reine Such- und Ergänzungsbefehle.
- Bestehende Tab- und Vorschlagsfunktionen funktionieren weiter.
- Kein Merge ohne Prüfung der aktualisierten PR-Diffs und Praxisabnahme.

**Prüfstatus:** JS-Syntax und isolierte Funktionslogik geprüft. Vollständiger Playwright-Lauf in dieser Umgebung nicht möglich; Ergebnisse bitte im PR dokumentieren.
