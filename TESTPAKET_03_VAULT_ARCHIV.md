# Testpaket 03 – VAULT-Archivzugriff

**Entwicklungsstand:** PR #96 auf Basis von PR #95. Separat testen; weder #95 noch #96 ist automatisch gemergt.

## Vorbereitung auf Windows

1. Den Branch `feat/archive-vault-lookup` als ZIP beziehen und in einen separaten Testordner entpacken.
2. Die lokale, nicht versionierte `kartenschluessel.js` aus der vorhandenen Installation übernehmen. Danach `START_TERMINAL.bat` starten.
3. Ein Testprofil mit mehreren Pins und mindestens einer eigenen Zone verwenden. Zur Kontrolle einen Pin `Treffpunkt Nord`, eine Zone `Treffpunkt Reserve` und einen Pin `Treffpunkt Geheim` anlegen; den letzten Pin einem Dossier zuordnen.
4. Diese Kartenobjekte über die vorhandenen Schaltflächen als TXT in `ops` beziehungsweise `dokumente` exportieren. Die Daten im Browserprofil und im normalen Archiv nicht versehentlich überschreiben.

## Prüfsequenz

| Eingabe / Handlung | Erwartetes Verhalten |
|---|---|
| `exports treffpunkt` | Alle passenden **tatsächlich vorhandenen** Kartenexporte, gruppiert nach Pin/Zone |
| `open export "Treffpunkt Nord"` | Direkte Ausgabe des richtigen Archivdatensatzes im Terminal |
| `open export Treffpunkt` | Bei mehreren Treffern: Mehrdeutigkeit, kein zufälliger Abruf |
| `open export PIN-...` bzw. `ZO-...` | Zugriff über stabile Objektkennung |
| `open export Treff<Tab>` | Namensvorschläge, bei eindeutiger Wahl Einsetzen der Kennung |
| `exports PIN-...` bei gesperrtem Dossier | Nur die Kennung mit `[LOCKED]`; kein Name |
| `open export "Treffpunkt Geheim"` | Kein Zugriff über gesperrten Namen |
| `open export PIN-...` bei gesperrtem Dossier | `Permission denied`, keine Inhaltsausgabe |
| `sudo open export PIN-...` | Verdeckte Kennwortabfrage; danach derselbe Datensatz lesbar |
| Dossier nach dem Abruf erneut sperren | Vollständiger archivierter Text wird aus dem Scrollback entfernt |
| Keine lokale Archivbrücke | `VAULT: INDEX LINK UNAVAILABLE`, ohne lokale Pfade oder vermeintlichen Abruf |

## Inszenierung gezielt prüfen

Die Terminalausgabe zeigt `VAULT :: RECORD INDEX` und `VAULT :: RECORD ACCESS` samt Kennung, Revision, Integritätsstatus und archiviertem Inhalt. **Nicht** sichtbar sein dürfen physische Pfade wie `ops/lageblatt-PIN-...`, `dokumente/...`, `127.0.0.1`, Browser-Download-Dialoge oder Hinweise auf eine lokal gelesene Datei. Der Terminalzustand (PPP, Profanity, tmux) darf durch `exports` und `open export` nicht verändert werden.

## Versionen und Integrität

1. Einen Pin exportieren und mit `open export <Name>` öffnen. Erwartet: `VERIFIED / CURRENT`, sofern WebCrypto verfügbar ist.
2. Den Pin nach dem Export verändern und erneut öffnen. Erwartet: `VERIFIED / OUTDATED`.
3. Die archivierte Datei **im Testordner** extern ändern und erneut öffnen. Erwartet: `INTEGRITY MISMATCH`.
4. Ein bereits vorhandenes Lageblatt ohne Exportvermerk im aktuellen Profil öffnen. Erwartet: `UNTRACKED`, sofern die Objektkennung noch existiert.
5. Mehrere Versionen desselben Objekts prüfen. Eine gültig registrierte Version wird bevorzugt; andernfalls die neueste Dateiversion.
6. Eigene Zone mit Dossier verknüpfen, sperren und Export über Namen und Kennung prüfen: gleiche Sperrregeln wie beim Pin.

**Hinweis:** `VAULT` ist die fiktive Datenbankdarstellung der lokalen Archivbrücke. Eine echte serverseitige Sperre für direkte Dateibefehle ist damit nicht eingeführt.

## Automatische Regression

Im Ordner `tests`:

```powershell
$env:FT_PARALLEL = "2"
node runall.js terminal-vault terminal-namensnavigation terminal-pin-suche terminal-navigation terminal-sudo terminal-befehlstabelle karte-sperre-pins
node runall.js
```

`terminal-vault` ist Teil der Standardauswahl. Historisch bekannte Problemtests bleiben getrennt zu bewerten.

**Status:** Quellcode und Syntax geprüft; automatischer Playwright-/Windows-Praxistest muss nach dem gemeinsamen Stand von #95 und #96 erfolgen. Erst danach Merge-Freigabe.
