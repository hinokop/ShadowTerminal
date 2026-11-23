# Phase 6a: Plan zur Unix-/Linux-Semantik von `pwd`, `cd` und `ls`

Stand: 23.11.2026. Entwurf zur Prüfung. **Dieses Dokument ändert keinen Produktivcode.** Es stellt das gemessene Verhalten des Terminals dem gemessenen Verhalten von GNU bash und GNU coreutils gegenüber und schlägt Etappen, Tests und Risiken vor. Eine Umsetzung beginnt erst nach Prüfung und ausdrücklicher Freigabe von Master Wayne. Grundlage: Prinzip 2 („Reale Vorbilder vor Sonderbefehlen“) und Prinzip 5 im [Entwicklungsplan](terminal-entwicklungsplan-2026-11.md).

## 1. Ergebnis in Kürze

1. Die drei Befehle sind in `profil-modul.js` umgesetzt (`TERMINAL_TABELLE`, `terminalDateiBefehl`, `terminalShellPfad`, `terminalArbeitsverzeichnis`). `pwd` ist nahe am Vorbild; `cd` weicht in wenigen, klar benennbaren Fällen ab; `ls` ist am weitesten entfernt (eigenes Ausgabeformat, nur drei Optionen als einziges Argument, keine Mehrfachoperanden, eigener Fehlerwortlaut).
2. Vorschlag: vier kleine, getrennte Etappen mit je eigenem Draft-PR und Test (Abschnitt 5): 6a-1 `pwd`, 6a-2 `cd`, 6a-3 `ls` (Optionen, Operanden, Fehler), 6a-4 `ls -l` und Sortierung. Ob Shell-Variablen (`$HOME`, `$PWD`, `$OLDPWD`) einbezogen werden, ist eine eigene Entscheidung (Abschnitt 7).
3. Die archivbezogenen Teile (Brücke, Zugriffsschutz für Pin-, Zonen- und Sichtungsdateien, Tab-Ergänzung) werden nicht verändert; sie begrenzen jedoch, was bei `ls` ohne Eingriff in die Brücke möglich ist (Abschnitt 6).
4. Referenz ist ein tatsächlich ausgeführtes bash 5.2.21 mit coreutils 9.4 (Messung des Autors in einer Linux-Sandbox, Abschnitt 2). Dass dies der Version auf dem im Terminal angedeuteten System entspricht, ist eine Annahme: `uname -a` im Terminal nennt Kernel 6.8.0-45 unter Ubuntu; bash 5.2.21 und coreutils 9.4 sind die Versionen von Ubuntu 24.04 (nicht gegen dessen Paketlisten geprüft).

## 2. Methode und Reproduktion

- **Ist-Verhalten:** `tests/_sonde-shell-6a.js` (nur lesend, nicht in `runall.js` registriert) startet die lokale Brücke `terminal_lokal.py --serve-only` mit einem Probearchiv (`pgcl-eu3.arch07/` mit `dossiers/eins.txt`, `dossiers/.intern`, `ops/` leer, `wurzel.txt`), öffnet das Terminal und führt eine feste Liste von 64 Befehlen aus. Je Befehl werden Ausgabe, Rückgabewert (`$?`) und der folgende Prompt aufgezeichnet.
  Aufruf: `cd tests && PLAYWRIGHT_BROWSERS_PATH=… node _sonde-shell-6a.js ergebnis.json`.
- **Referenz:** dieselben Befehle in echtem bash 5.2.21 (`GNU bash, version 5.2.21(1)-release`) und `ls (GNU coreutils) 9.4` über ein Probeverzeichnis mit gleichem Aufbau (`etc/ppp/peers/kestrel`, `var/log/syslog`, `var/cache/tle/`, `pgcl-eu3.arch07/…`); das Probeverzeichnis wurde als Wurzel simuliert (Pfade `/…` auf das Verzeichnis abgebildet). Ausgaben stammen aus einem Skriptlauf ohne Terminal.
- **Grenzen:** Referenzmessung als root ohne TTY: keine Mehrspaltenausgabe und keine Farben von `ls`; Zeitangaben und Eigentümer (`root`) sind Sandbox-Werte; Fehlermeldungen von bash tragen im Skriptlauf einen Zeilenhinweis statt `bash:` (hier auf `bash:` umgeschrieben, wie in einer interaktiven Sitzung zu erwarten, nicht interaktiv nachgemessen). Einzelner Lauf je Befehl; Verhalten bei anderen Locales wurde nicht gemessen. Die Messdaten liegen nicht im Repository (reproduzierbar mit der Sonde; die Referenzbefehle stehen in Abschnitt 4).

## 3. Ist-Architektur (gelesen im Quelltext)

- Zustand: `TERMINAL_ZUSTAND.ort` (Pfad innerhalb des Archivs, wenn `cd` ins Archiv ging) und `virtuellerOrt` (Pfad im virtuellen Baum). Der Prompt zeigt das Arbeitsverzeichnis (`raizo@terminal:/etc$`).
- Virtueller Baum: Wurzel `/` mit `etc/`, `var/` und dem Archivordner `pgcl-eu3.arch07/`; darunter feste Verzeichnisse der Einwahlkette (`TERMINAL_TLE_DIRS`) und feste Dateien (`TERMINAL_VIRT_DATEIEN`, `/var/log/syslog`). Alles unter `/pgcl-eu3.arch07` geht an die lokale Brücke (`terminalBruecke('ls' | 'cd' | …)`), die seitenweise (500 Einträge) liest.
- `cd` ohne Argument und `cd ""` setzen auf `/`; `~` wird als `/` behandelt (dokumentiert in `terminal.md`: kein Heimatverzeichnis).
- `ls`, `cd`, `cat`, `head`, `tail`, `wget` laufen gemeinsam durch `terminalDateiBefehl`; die Argumentzeile wird als **ein** Namensargument behandelt (`terminalName(arg)`), nicht als Wortliste mit Optionen und Operanden.
- Fehler werden mit dem Befehlsnamen als Präfix ausgegeben (`cd: x: No such file or directory`), Rückgabewert bei Fehlern immer 1 (Ausnahme: Verwendungsfehler 2).

## 4. Gegenüberstellung (gemessen)

Terminal = Sonde auf `main` (`696784b`); Vorbild = bash 5.2.21 / coreutils 9.4. Die Tabelle nennt Abweichungen, nicht jeden Gleichstand.

### 4.1 `pwd`

| Eingabe | Terminal | Vorbild | Abweichung |
|---|---|---|---|
| `pwd` | `/` (bzw. aktuelles Verzeichnis) | Verzeichnis, Rückgabewert 0 | keine |
| `pwd -P`, `pwd -L` | `usage: pwd`, 2 | Verzeichnis, 0 | Optionen fehlen |
| `pwd x` | `usage: pwd`, 2 | Verzeichnis, 0 (Operand wird ignoriert) | abweichend |
| `pwd --help` | `usage: pwd`, 2 | Hilfetext des Builtins, Rückgabewert 2 | abweichend (Text) |
| `pwd -x` | `usage: pwd`, 2 | `bash: pwd: -x: invalid option` und `pwd: usage: pwd [-LP]`, 2 | abweichend (Text) |

### 4.2 `cd`

| Eingabe | Terminal | Vorbild | Abweichung |
|---|---|---|---|
| `cd /etc`, `cd ..`, `cd .`, `cd /` | wie Vorbild (Prompt wechselt) | wie Terminal | keine |
| `cd` (ohne Argument) | nach `/` | nach `$HOME` | dokumentiert (kein Heimatverzeichnis) |
| `cd ""` | nach `/` (Arbeitsverzeichnis wechselt) | bleibt, Rückgabewert 0 | abweichend |
| `cd -` | `cd: -: No such file or directory`, 1 | wechselt zu `$OLDPWD` und gibt es aus | fehlt |
| `cd /etc /var` | `cd: /etc /var: No such file or directory`, 1 | `bash: cd: too many arguments`, 1 | abweichend (Text) |
| `cd /nonexistent` | `cd: /nonexistent: No such file or directory`, 1 | `bash: cd: /nonexistent: No such file or directory`, 1 | Präfix `bash:` fehlt |
| `cd /etc/ppp/peers/kestrel` (virtuelle Datei) | `cd: …: Not a directory`, 1 | `bash: cd: …: Not a directory`, 1 | Präfix |
| `cd eins.txt` (Archivdatei) | `cd: eins.txt: No such file or directory`, 1 | `bash: cd: eins.txt: Not a directory`, 1 | Text abweichend |
| `cd $HOME` | `cd: $HOME: No such file or directory`, 1 | wechselt nach `$HOME` | Variablen werden nicht expandiert (nur `$?`) |
| `cd -x` | wie anderer Name (No such file) | `bash: cd: -x: invalid option` und Verwendung, 2 | abweichend |

### 4.3 `ls`

| Eingabe | Terminal | Vorbild | Abweichung |
|---|---|---|---|
| `ls` | je Eintrag eine Zeile, Verzeichnisse mit `/`, Reihenfolge wie im Baum bzw. der Brücke (Wurzel: `etc/`, `var/`, `pgcl-eu3.arch07/`) | alphabetisch sortiert, ohne `/` (ohne `-F`) | Sortierung und `/`-Marke |
| `ls -a` | virtuell: wie `ls`; Archiv: Punktdateien, aber kein `.` und `..` | mit `.` und `..` | abweichend |
| `ls -l` | virtuell: wie `ls` (ohne Langformat); Archiv: `dr-x      4096  23.11.2026 19:50:39Z  dossiers/` | `total N`, `drwxr-xr-x 2 root root 4096 Nov 23 19:51 dossiers` | Format, `total`, Rechte, Eigentümer, Zeit |
| `ls -1`, `-d`, `-F`, `-lh`, `-z` | `ls: unrecognized option '-1'` (usw.), 1 | `-1`, `-d`, `-F`, `-lh` funktionieren; `-z` → `ls: invalid option -- 'z'` und `Try 'ls --help' for more information.`, 2 | Optionen fehlen; Text und Rückgabewert |
| `ls --falsch` | `ls: unrecognized option '--falsch'`, 1 | `ls: unrecognized option '--falsch'` und `Try 'ls --help' for more information.`, 2 | zweite Zeile, Rückgabewert |
| `ls --help` | `ls: unrecognized option '--help'`, 1 | Hilfetext, 0 | fehlt |
| `ls -l /etc` | `ls: unrecognized option '-l /etc'`, 1 | Langformat von `/etc` | Option mit Operand nicht möglich |
| `ls /etc /var` | `ls: /etc /var: No such file or directory`, 1 | `/etc:` … Leerzeile … `/var:` … | Mehrfachoperanden fehlen |
| `ls /nonexistent` | `ls: /nonexistent: No such file or directory`, 1 | `ls: cannot access '/nonexistent': No such file or directory`, 2 | Text und Rückgabewert |
| `ls /etc/ppp/peers/kestrel` (virtuelle Datei) | `kestrel` | `/etc/ppp/peers/kestrel` (Operand wie getippt) | abweichend |
| `ls /pgcl-eu3.arch07/dossiers/eins.txt` (Archivdatei) | `No such file or directory`, 1 | gibt den Operanden aus, 0 | Fehler statt Ausgabe |
| leeres Archivverzeichnis | `(leer)` | keine Ausgabe | abweichend (Text) |

Hinweis zur Ausgabe in einem echten Terminal: Auf einem TTY ordnet `ls` Namen spaltenweise an und färbt Verzeichnisse; das Terminal gibt eine Zeile je Eintrag aus (wie `ls | cat`). Diese Mehrspaltenausgabe wurde nicht gemessen.

## 5. Vorgeschlagene Etappen

Jede Etappe ist ein eigener Draft-PR mit eigenem Test und Dokumentationsnachtrag in `terminal.md`. Keine Etappe ändert Brücke, Zugriffsschutz oder Archivstruktur.

| Etappe | Inhalt | Beabsichtigtes Verhalten (nach Vorbild) | Tests |
|---|---|---|---|
| 6a-1 `pwd` | `-L`, `-P` zulassen; Operanden ignorieren; ungültige Option mit zwei Zeilen und Rückgabewert 2 | `pwd -P`, `pwd x` → Verzeichnis, 0; `pwd -x` → `bash: pwd: -x: invalid option` / `pwd: usage: pwd [-LP]`, 2 | Anpassung der Erwartung `pwd x` in `terminal-befehlstabelle` (bisher `usage: pwd`, 2); neue Fälle |
| 6a-2 `cd` | `cd ""` ohne Wechsel; `cd -` mit `OLDPWD` (Ausgabe des Ziels); `too many arguments`; Präfix `bash: cd:` für Fehler; `Not a directory` bei Archivdateien; ungültige Option | siehe 4.2; Heimatverzeichnis bleibt `/` (dokumentierte Abweichung) | neuer Test mit Probearchiv; Prompt nach jedem Fall; Regression `terminal-lokal`, `terminal-archiv-zugriff`, `terminal-link-kette` |
| 6a-3 `ls` (Optionen, Operanden, Fehler) | Wort-Zerlegung in Optionen und Operanden (zusammengesetzte Kurzoptionen); `-a`, `-A`, `-1`, `-d`, `-F`, `-h` (mit `-l`); mehrere Operanden mit Kopfzeilen; Operand, der eine Datei ist, wird ausgegeben; Fehlertext `cannot access` und Rückgabewert 2; `--help`; zweite Zeile `Try 'ls --help' …` | siehe 4.3 | neuer Test; Anpassung der Erwartung `ls --falsch` in `terminal-lokal` |
| 6a-4 `ls -l`, Sortierung | alphabetische Sortierung; `total`; Langformat `drwxr-xr-x 2 raizo raizo <Größe> <Mon TT hh:mm> <Name>`; `.` und `..` bei `-a` | Rechte und Eigentümer sind Darstellung (Archivdateien lesbar, nicht schreibbar nach Entscheidung); Zeit in UTC | neuer Test; Regression Tab-Ergänzung und Auswahlliste |

Rückwärtskompatibilität: Gespeicherte Daten sind nicht betroffen (Terminalzustand wird nicht persistiert, soweit aus dem Code erkennbar; nicht eigens geprüft). Betroffen sind ausschließlich Ausgabetexte und Rückgabewerte; die Tests, die sie festschreiben, werden je Etappe ausdrücklich mitgeändert und in der PR-Beschreibung benannt.

## 6. Risiken

- **Zugriffsschutz im Archiv:** Terminalseitig werden Dateizugriffe auf Pin-, Zonen- und Sichtungsdateien gesperrter Objekte verweigert und der Scrollback maskiert. Ob `ls` die Namen gesperrter Objektdateien bereits heute auflistet oder ausblendet, wurde in dieser Vorbereitung **nicht geprüft**; vor 6a-3 und 6a-4 ist das mit `terminal-archiv-zugriff` zu klären, damit neue Ausgabeformen (Langformat, Mehrfachoperanden) keine Namen offenlegen, die heute maskiert werden.
- **Bridge-Antworten:** Das Langformat benötigt Größe und Änderungszeit; die Brücke liefert beides (`bytes`, `mtime`), keine Rechte oder Eigentümer (diese wären Darstellung).
- **Tab-Ergänzung und Vorschläge:** Verzeichnisse werden heute mit `/` erkannt und angeboten; die Ergänzung darf bei Änderung der Ausgabe nicht auf Zeichenketten der `ls`-Ausgabe angewiesen sein (nicht geprüft; `terminal-auswahlliste` und `terminal-vorschlag-ergaenzung` sind Regressionstests).
- **Umfang:** Je vollständiger die Nachbildung, desto mehr Optionen sind zu pflegen. Vorschlag ist eine bewusst kleine, getestete Teilmenge; unbekannte Optionen erhalten die Originalmeldung statt einer Sonderausgabe.
- **Version der Referenz:** Verhalten (etwa Quoting von Dateinamen in Fehlern) kann sich zwischen coreutils-Versionen unterscheiden; die Tests nennen die Referenzversion.

## 7. Entscheidungsfragen an Master Wayne

1. Umfang der Nachbildung: nur die vorgeschlagene Teilmenge, oder strengere Vollständigkeit?
2. Verzeichnismarke: `ls` ohne `/` (wie echtes `ls` ohne `-F`; Unterscheidung nur über `-F` oder Farbe) oder die heutige Darstellung mit `/` beibehalten?
3. Rechte und Eigentümer im Langformat: fiktive, einheitliche Werte (`drwxr-xr-x raizo raizo`) oder nichts darstellen?
4. Shell-Variablen `$HOME`, `$PWD`, `$OLDPWD` (und `${…}`) als eigene Etappe 6a-5? Sie betreffen die Wortzerlegung der Shell (`terminal-shell-kern`) und damit mehr als die drei Befehle.
5. Fehlerpräfix: nur bei Builtins (`bash: cd: …`, wie im Vorbild), externe Programme (`ls: …`) unverändert?
6. Reihenfolge: wie in Abschnitt 5, oder zuerst `ls`?

## 8. Nicht geprüft

Mehrspaltige und farbige Ausgabe auf einem TTY; Verhalten bei anderen Locales; Windows-Besonderheiten der Brücke (Kurznamen, Groß- und Kleinschreibung) für die neuen Fälle; die Wirkung gesperrter Objekte auf die heutige `ls`-Ausgabe; die Übereinstimmung von bash 5.2.21 und coreutils 9.4 mit dem im Terminal angedeuteten System.
