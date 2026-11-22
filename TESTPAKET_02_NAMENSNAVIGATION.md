# Testpaket 02 – Direkte Namensnavigation

**Statusvermerk (22.11.2026):** Der zugehörige PR #95 ist in `main` gemergt; die Angabe, `main` bleibe unverändert, ist überholt. Historisches Dokument; der Inhalt unten beschreibt den Stand zum Zeitpunkt der Erstellung und wurde nicht aktualisiert. Den aktuellen Stand führt [docs/AKTUELL.md](docs/AKTUELL.md).

**Gültig für:** Draft-PR zur direkten Namensnavigation (`feat/terminal-namensnavigation`). Der Entwicklungsstand ist vollständig im Branch enthalten. `main` bleibt bis zur Abnahme unverändert.

## 1. Windows-Testinstallation

1. Den Branch über GitHub als ZIP herunterladen und in einem **separaten Testordner** entpacken.
2. Die lokal vorhandene, nicht versionierte `kartenschluessel.js` in diesen Testordner übernehmen.
3. `START_TERMINAL.bat` starten. Für die Abnahme ein separates Testprofil nutzen oder zuvor ein Profil-Backup erstellen.
4. Folgende Testdaten anlegen: zwei frei zugängliche Pins **Parkplatz Nord** und **Nordtor Lagerhalle**, einen Pin **Kühlhaus Quellweg** mit verknüpftem Dossier, sowie ein frei zugängliches Dossier **Zielknoten Delta**.

## 2. Direkte Befehle

| Eingabe | Erwartung |
|---|---|
| `map Parkplatz Nord` | Ohne Tab zum Pin springen und dessen Informationsfenster öffnen |
| `map "Parkplatz Nord"` | Identisches Verhalten mit Anführungszeichen |
| `open Parkplatz Nord` | Direkt zum Pin wechseln |
| `open Zielknoten Delta` | Direkt zum Dossier wechseln |
| `map Park` | Nur bei eindeutigem Namensanfang direkt navigieren |
| `open P-0020` (passendes Beispiel) | Bereits vorhandene Kennungsnavigation unverändert |
| `map pins nord` | Teilstringsuche nach Pins unverändert |

Ein direkter Name wird ohne Tab aufgelöst. Exakte Namen haben Vorrang vor Präfix-Treffern; bei mehreren Treffern darf das Terminal nicht willkürlich navigieren.

## 3. Mehrdeutigkeit bewusst testen

Zwei Pins mit dem gleichen Namen **Parkplatz Nord** anlegen und danach `map "Parkplatz Nord"` ausführen.

**Erwartung:** `ambiguous name (2 matches)`, Ausgabe der Kennungen und lesbaren Namen, Exit-Code 1 (`echo $?`), Terminal bleibt geöffnet. Danach mit einer angezeigten `PIN-`-Kennung navigieren.

Einem Dossier denselben Namen wie einem Pin geben. `open "<gemeinsamer Name>"` zeigt beide Ziele als mehrdeutig. `map "<gemeinsamer Name>"` berücksichtigt weiterhin nur Pins.

## 4. Sperren und sudo

Ein Dossier sperren, das mit **Kühlhaus Quellweg** verknüpft ist.

- `map "Kühlhaus Quellweg"`, `open "Kühlhaus Quellweg"` und `sudo map "Kühlhaus Quellweg"` dürfen den gesperrten Pin nicht über seinen Namen finden.
- `map PIN-...` meldet weiterhin `Permission denied`.
- `sudo map PIN-...` verlangt das Kennwort der Oberfläche und navigiert anschließend wie bisher.
- `map pins` zeigt gesperrte Pins nur als `PIN-...  [LOCKED]`.
- Nach dem Entsperren wird der Klarname ohne Neustart wieder gefunden und ergänzt.
- Wird ein über seinen Namen geöffnetes Dossier später gesperrt, dürfen historische Terminalausgabe, Verlauf und Vorschläge dessen Namen nicht weiterhin offenlegen.

## 5. Tab und laufende Sitzungen

- `open Zielknoten<Tab>` übernimmt die eindeutige Dossier-Kennung.
- `sudo open Zielknoten<Tab>` entsprechend, ohne vorzeitige Kennwortabfrage.
- Gleiche sichtbare Namen zeigen bei Tab unterscheidbare Kennungen; manuelle Auswahl ist möglich.
- Laufende PPP-, tmux- oder Profanity-Sitzungen bleiben auch bei Namensnavigation erhalten.

## 6. Automatische Tests

Im Ordner `tests` mit installiertem Playwright:

```powershell
$env:FT_PARALLEL = "2"
node runall.js terminal-namensnavigation terminal-navigation terminal-pin-suche terminal-sudo terminal-befehlstabelle karte-sperre-pins terminal-auswahlliste terminal-vorschlag-ergaenzung
node runall.js
```

Der neue Test `terminal-namensnavigation` ist in der Standardauswahl enthalten, ebenso `terminal-benutzer`, `karte-sperre-pins`, `terminal-navigation`, `terminal-sudo` und `terminal-pin-suche`.

**Abnahmekriterium:** Keine Fehler oder Regressionen bei Namensnavigation, bestehenden Kennungsbefehlen und Berechtigungen. Historisch bekannter `m1flow`-Fehler weiterhin getrennt bewerten.

**Prüfstatus:** Quelltext- und Syntaxprüfung sowie isolierte Namensauflösung; vollständiger Playwright- und Windows-Praxistest noch ausstehend. Bitte vor der Merge-Freigabe ausführen.
