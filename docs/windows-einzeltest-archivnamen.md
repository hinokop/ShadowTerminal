# Windows-Einzeltest: Archivdateinamen und Dossiersperre

Kurzprüfung für `terminalArchivNameZiel` und das Feld `file` der lokalen Brücke (`terminal_lokal.py`). Auf Linux nicht prüfbar, weil
dort die Namensauflösung die Schreibweise unterscheidet. Kein Gesamttest der Oberfläche. Dauer etwa fünf Minuten.

## Vorbereitung

1. Branch-Stand mit `START_TERMINAL.bat` starten, Testprofil verwenden (nicht das Arbeitsprofil), lokale `kartenschluessel.js` vorhanden.
2. Ein Dossier anlegen (Beispiel `P-0001`), einen Pin anlegen und mit diesem Dossier verknüpfen (Beispiel `PIN-001`).
3. Pin als TXT exportieren (Archivordner `ops`). Es entsteht `lageblatt-PIN-001.txt`.
4. Terminal öffnen, anmelden, Dossier `P-0001` sperren.

## Befehle und Erwartung

Jeder Befehl muss mit `Permission denied` enden, der Inhalt der Datei (Position, Notiz) darf nirgends im Terminal erscheinen:

| Eingabe | Prüft |
|---|---|
| `cat /pgcl-eu3.arch07/ops/lageblatt-PIN-001.txt` | Grundfall |
| `cat /pgcl-eu3.arch07/ops/LAGEBLATT-PIN-001.TXT` | Großschreibung |
| `cat "/pgcl-eu3.arch07/ops/lageblatt-PIN-001.txt."` | Endpunkt am Namen |
| `cat /pgcl-eu3.arch07/ops/lageblatt-PIN-001.txt::$DATA` | Datenstrom |
| `dir /x ops` in einer Windows-Konsole, daraus den Kurznamen (etwa `LAGEBL~1.TXT`) lesen, dann `cat /pgcl-eu3.arch07/ops/LAGEBL~1.TXT` | Kurzname (8.3) |
| `head`, `tail` und `wget` mit denselben Namen | alle Dateibefehle |

Sperre mit `sudo open export PIN-001` und Kennung aufheben, den Inhalt mit `cat` lesen, dann das Dossier erneut sperren: der gelesene Text
muss aus dem Terminal verschwunden sein.

## Ergebnis eintragen

Je Zeile: bestanden oder fehlgeschlagen, Windows-Version, Branch und Commit. Wenn der Kurzname den Inhalt zeigt, ist `real_name` auf diesem
System nicht wirksam; dann Fund melden, nichts am Code vermuten.
