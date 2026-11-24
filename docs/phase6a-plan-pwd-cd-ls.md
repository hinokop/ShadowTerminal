# Phase 6a: Plan zur Unix-/Linux-Semantik von `pwd`, `cd` und `ls`

Stand: 23.11.2026. Entwurf zur Prüfung. **Dieses Dokument ändert keinen Produktivcode.** Es stellt das gemessene Verhalten des Terminals dem gemessenen Verhalten von GNU bash und GNU coreutils gegenüber und schlägt Etappen, Tests und Risiken vor. Eine Umsetzung beginnt erst nach Prüfung und ausdrücklicher Freigabe von Master Wayne. Grundlage: Prinzip 2 („Reale Vorbilder vor Sonderbefehlen“) und Prinzip 5 im [Entwicklungsplan](terminal-entwicklungsplan-2026-11.md).

## 1. Ergebnis in Kürze

1. Die drei Befehle sind in `profil-modul.js` umgesetzt (`TERMINAL_TABELLE`, `terminalDateiBefehl`, `terminalShellPfad`, `terminalArbeitsverzeichnis`). `pwd` ist nahe am Vorbild; `cd` weicht in wenigen, klar benennbaren Fällen ab; `ls` ist am weitesten entfernt (eigenes Ausgabeformat, nur drei Optionen als einziges Argument, keine Mehrfachoperanden, eigener Fehlerwortlaut).
2. Vorschlag: vier kleine, getrennte Etappen mit je eigenem Draft-PR und Test (Abschnitt 5): 6a-1 `pwd`, 6a-2 `cd`, 6a-3 `ls` (Optionen, Operanden, Fehler), 6a-4 `ls -l` und Sortierung. Ob Shell-Variablen (`$HOME`, `$PWD`, `$OLDPWD`) einbezogen werden, ist eine eigene Entscheidung (Abschnitt 7).
3. Die archivbezogenen Teile (Brücke, Zugriffsschutz für Pin-, Zonen- und Sichtungsdateien, Tab-Ergänzung) werden nicht verändert; sie begrenzen jedoch, was bei `ls` ohne Eingriff in die Brücke möglich ist (Abschnitt 6).
4. Referenz ist ein tatsächlich ausgeführtes bash 5.2.21 mit coreutils 9.4 (Messung des Autors in einer Linux-Sandbox, Abschnitt 2). Dass dies der Version auf dem im Terminal angedeuteten System entspricht, ist eine Annahme: `uname -a` im Terminal nennt Kernel 6.8.0-45 unter Ubuntu; bash 5.2.21 und coreutils 9.4 sind die Versionen von Ubuntu 24.04 (nicht gegen dessen Paketlisten geprüft).

## 2. Methode und Reproduktion

- **Ist-Verhalten:** `tests/_sonde-shell-6a.js` (nur lesend, nicht in `runall.js` registriert) startet die lokale Brücke `terminal_lokal.py --serve-only` mit einem Probearchiv (`pgcl-eu3.arch07/` mit `dossiers/eins.txt`, `dossiers/.intern`, `ops/` leer, `wurzel.txt`), öffnet das Terminal und führt eine feste Liste von 75 Befehlen aus. Je Befehl werden Ausgabe, Rückgabewert (`$?`) und der folgende Prompt aufgezeichnet.
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

*Ergänzung vom 23.11.2026: Zur Reihenfolge (Frage 6) und zur Architektur gilt Abschnitt 9. Die sechs Fragen sind am 23.11.2026 von Master Wayne nach der Empfehlung der unabhängigen Prüfung entschieden (siehe 7.1).*

1. Umfang der Nachbildung: nur die vorgeschlagene Teilmenge, oder strengere Vollständigkeit?
2. Verzeichnismarke: `ls` ohne `/` (wie echtes `ls` ohne `-F`; Unterscheidung nur über `-F` oder Farbe) oder die heutige Darstellung mit `/` beibehalten?
3. Rechte und Eigentümer im Langformat: fiktive, einheitliche Werte (`drwxr-xr-x raizo raizo`) oder nichts darstellen?
4. Shell-Variablen `$HOME`, `$PWD`, `$OLDPWD` (und `${…}`) als eigene Etappe 6a-5? Sie betreffen die Wortzerlegung der Shell (`terminal-shell-kern`) und damit mehr als die drei Befehle.
5. Fehlerpräfix: nur bei Builtins (`bash: cd: …`, wie im Vorbild), externe Programme (`ls: …`) unverändert?
6. Reihenfolge: wie in Abschnitt 5, oder zuerst `ls`?

### 7.1 Entscheidungen (Master Wayne, 23.11.2026, nach Empfehlung der unabhängigen Prüfung)

| Nr. | Frage | Entscheidung |
|---|---|---|
| 1 | Umfang | Breite Shell als Zielarchitektur; GNU-/Bash-Verhalten schrittweise möglichst vollständig innerhalb des unterstützten Funktionsumfangs. |
| 2 | Verzeichnismarke | Unix-konform: `ls` ohne `/` im Standardmodus; mit `ls -F` wird `/` angezeigt. |
| 3 | Rechte und Eigentümer | Anzeigen, aber konsistent modellieren; virtuelle Rechte sollen später auch tatsächliche Auswirkungen in der Simulation haben. |
| 4 | Variablen | `$HOME`, `$PWD`, `$OLDPWD`, `${…}` als eigene Etappe 6a-5; die Architektur berücksichtigt sie bereits, die vollständige Expansion folgt separat. |
| 5 | Fehlerpräfix | Bash-Builtins (`cd`, `pwd`) mit Bash-typischen Meldungen (`bash: pwd: -x: invalid option`); externe Programme wie `ls` mit GNU-coreutils-Meldungen. |
| 6 | Reihenfolge | Wie in Abschnitt 5: 6a-0 erledigt, dann `pwd`, `cd`, `ls`, danach die Variablenexpansion. Vor 6a-3 ein kleiner Sicherheits-PR für Variante B (Namen gesperrter Archivobjekte). |
| 7 | Schreibweise von Archivpfaden (Nachtrag 24.11.2026) | Streng mit Groß-/Kleinschreibung wie unter Unix; Details 9.10. |

`pwd` bildet das **Bash-Builtin** nach, nicht `/usr/bin/pwd` (das externe Programm beendet `--help` mit Rückgabewert 0, das Builtin mit 2).

## 8. Nicht geprüft

Mehrspaltige und farbige Ausgabe auf einem TTY; Verhalten bei anderen Locales; Windows-Besonderheiten der Brücke (Kurznamen, Groß- und Kleinschreibung) für die neuen Fälle; die Wirkung gesperrter Objekte auf die heutige `ls`-Ausgabe; die Übereinstimmung von bash 5.2.21 und coreutils 9.4 mit dem im Terminal angedeuteten System.

## 9. Architektur und Etappe 6a-0 (Ergänzung vom 23.11.2026)

Status: Entwurf zur Prüfung. Grundlage ist der Vorschlag der unabhängigen Prüfung (zuerst Architektur, dann Einzelbefehle), die Einwände dagegen und die Entscheidung von Master Wayne („Lassen wir es uns so machen.“) für einen **kleinen, funktionsfähigen vertikalen Durchstich** statt einer vorgezogenen Gesamtarchitektur.

### 9.1 Entscheidung zur Reihenfolge

Zwei Fassungen standen zur Wahl: (a) `pwd` zuerst (Abschnitt 5), jede Etappe isoliert; (b) zuerst eine gemeinsame Architektur, dann die Befehle. Entschieden ist ein Mittelweg: Etappe **6a-0** liefert die gemeinsame Schnittstelle zusammen mit ihren ersten Verbrauchern (`pwd`, `cd`, `ls`), ohne Verhaltensänderung. Die GNU-konformen Verhaltensänderungen folgen danach in getrennten, kleineren PRs (6a-1 bis 6a-4 wie in Abschnitt 5, Reihenfolge dort anzupassen). Eine Architektur ohne Verbraucher wird nicht gebaut, weil sie ungeprüft bliebe.

### 9.2 Dateisystem-Schnittstelle

Operationen (asynchron, weil die Archivbrücke asynchron ist):

- `resolve(pfad)`: normalisiert gegen das Arbeitsverzeichnis, löst `.`/`..` auf, liefert einen Pfad im Dateisystem oder einen Fehler.
- `stat(pfad)`: Art (Datei/Verzeichnis), Größe, Änderungszeit, fiktive Rechte und Eigentümer; Fehler `ENOENT`, `ENOTDIR`, `EACCES`.
- `readdir(pfad)`: Einträge mit Namen und `stat`-Daten; die Brücken-Paginierung (500 je Seite) bleibt im Adapter.
- `readFile(pfad)`: Textinhalt.
- `writeFile(pfad, inhalt)`: **nur entworfen, in 6a-0 nicht implementiert**; das Archiv bleibt schreibgeschützt.

Zwei Adapter: der **virtuelle Baum** (heute `TERMINAL_TLE_DIRS`, `TERMINAL_VIRT_DATEIEN`) und die **Archivbrücke** (`terminalBruecke`, `terminalBrueckeLsAlle`). Die Schnittstelle bildet beide unter einer Wurzel `/` ab, wie das Terminal es heute zeigt (Archivwurzel `pgcl-eu3.arch07`).

### 9.3 Zugriffsentscheidung

Eine zentrale Stelle entscheidet jeden Zugriff. Zwei Dimensionen, beide je Zugriff zu berücksichtigen:

1. **Virtuelle Unix-Rechte** (Eigentümer, Gruppe, `rwx`): fiktiv, aber funktional konsistent (eine geänderte Berechtigung wirkt auf `cat`, `stat`, `ls`).
2. **Anwendungsberechtigungen:** manuelle Dossiersperren (maßgebliche Zugangskontrolle, unverändert), geschützte Pins und Zonen, verknüpfte Archivinformationen (heute `terminalArchivZielGesperrt`).

Das Archiv bleibt schreibgeschützt. Die vorhandene Prüfung (`Permission denied`, Maskierung des Scrollbacks) darf in 6a-0 nicht schwächer werden.

**Sichtbarkeit gesperrter Objekte: entschieden (Variante B als Zielverhalten).** Entscheidung von Master Wayne nach der Empfehlung der unabhängigen Prüfung: Für **anwendungsseitig geschützte Archivdateien** (gesperrte Pin-, Zonen- und Sichtungsobjekte) ist auch der **Name** geschützt; er erscheint weder in `ls`, `find`, Tab-Ergänzung, `stat` noch in Platzhaltern. Für **gewöhnliche Dateien** gilt normales Unix-Verhalten. Die Regel gehört zentral in die Dateisystemschicht, damit jeder spätere Befehl sie ohne eigene Prüfung erbt.

**Heutiger Stand (statisch aus dem Quelltext gelesen, nicht zur Laufzeit gemessen):** `terminalBruecke` gibt für `ls` vor der Sperrprüfung zurück; die Prüfung (`terminalArchivZiele`) gilt nur für `cat`, `head`, `tail`, `wget`, `send`. Demnach würden Namen von Export-Dateien gesperrter Objekte heute aufgelistet, der Inhalt ist geschützt. Das Tab-Verhalten ist nicht untersucht. **6a-0 darf dieses Verhalten vorläufig bewahren** (keine Verhaltensänderung, siehe 9.5); die Umsetzung von Variante B ist eine eigene, getrennte Etappe nach 6a-0 und braucht vorab eine Laufzeitmessung mit `terminal-archiv-zugriff`. Bis dahin ist die Abweichung zwischen Zielverhalten und Ist-Stand als bekannte Lücke geführt, nicht als Zusage.

### 9.4 Befehlskontext und Ausführung

Jeder Befehl erhält einen Kontext `{ args: [...], cwd: "...", env: {}, fs: dateisystem }` und liefert Exit-Code, **getrennt** `stdout` und `stderr`. In 6a-0 gibt es keine Pipes, Streams oder Prozesse; die Shell (`terminalKetteAusfuehren`) setzt `$?` aus dem Exit-Code wie bisher. `pwd`, `cd` und `ls` sind die ersten Verbraucher; alle übrigen Befehle laufen unverändert über die bestehende Tabelle (`TERMINAL_TABELLE`), bis sie einzeln umgestellt werden.

### 9.5 Rückwärtskompatibilität von 6a-0

6a-0 darf keine Funktion verlieren und keine sichtbare Ausgabe ändern. Zu erhalten und zu testen: alle Terminalbefehle, Archivzugriff und Paginierung, manuelle Dossiersperren samt Scrollback-Maskierung, Tab-Ergänzung und Vorschläge, `sudo`, Nmap-Integration. Regressionstests mindestens: `terminal-lokal`, `terminal-archiv-zugriff`, `terminal-befehlstabelle`, `terminal-auswahlliste`, `terminal-vorschlag-ergaenzung`, `terminal-sudo`, `terminal-shell-kern`, `terminal-nmap`. Zusätzlich ein Test, der die Ausgabe der drei Befehle vor und nach der Umstellung vergleicht (Messsonde aus `tests/_sonde-shell-6a.js` als Grundlage).

### 9.6 Konformitätsklassen

Die Messsonde wird zur Konformitätsprüfung gegen bash/coreutils ausgebaut. Jeder Fall erhält genau eine Klasse:

- **Konform:** Ausgabe und Exit-Code stimmen mit der Referenz überein.
- **Bewusste Abweichung:** mit dokumentiertem Architekturgrund (etwa Heimatverzeichnis `/`, virtuelles Dateisystem, kontrollierte Archivbrücke).
- **Nicht implementiert:** bekannt und aufgeführt, nicht still ignoriert.

Maßstab ist eine in sich stimmige virtuelle Betriebsumgebung: ein angelegtes Verzeichnis existiert für `ls`, `cd` und `find`; eine geänderte Berechtigung wirkt auf `cat` und `stat`; Prozesse sind für `ps` sichtbar. Dieser Maßstab ist Richtung, nicht Umfang von 6a.

### 9.7 Schwächen und Ungeprüftes dieses Entwurfs

- Der Aufwand von 6a-0 ist nicht gemessen; die Umstellung dreier Befehle samt zweier Adapter berührt mit Tab-Ergänzung und Archivschutz sicherheitsrelevante Pfade. Deshalb: Draft, kleine Commits, volle Standardauswahl vor Merge.
- Die Umsetzung der Sichtbarkeitsregel (9.3, Variante B) ist Voraussetzung für 6a-3 (`ls`-Operanden) und für Namensauflösungen mit Platzhaltern, nicht für 6a-0 und 6a-1.
- Fiktive Rechte und Eigentümer (Frage 3 aus Abschnitt 7) sind für `stat` und `ls -l` Voraussetzung und noch nicht entschieden.
- Die Annahme Ubuntu 24.04 (bash 5.2.21, coreutils 9.4) als Referenz bleibt eine Annahme.

### 9.8 Stand der Umsetzung von 6a-0 (Draft #128)

Umgesetzt in `profil-modul.js`: `TERMINAL_FS` (`resolve`, `stat`, `readdir`, `readFile`, `writeFile` als Stub `EROFS`, Haken `sichtbar`), `terminalBefehlLauf` mit Kontext `{ args, arg, cwd, env, fs }` und Ergebnis `{ code, stdout, stderr, cwd? }`, Verbraucher `pwd`, `cd`, `ls`. `terminalDateiBefehl` behält `cat`, `head`, `tail`, `wget`; die Tab-Ergänzung nutzt die Schnittstelle noch nicht (bewusst, nicht migriert). Die Brücke kennt kein `stat`: `cd` prüft über die Brückenoperation `cd`, `ls` ruft im Archiv ohne Vorprüfung `ls` auf (Brückenaufrufe wie zuvor).

Laufzeitmessung zur Sichtbarkeit (9.3), gemockte Brücke: Namen gesperrter Pin- und Sichtungs-Exportdateien erscheinen in `ls`, und Tab ergänzt den Namen; `cat` liefert `Permission denied` (`tests/terminal-fs-ist.js`, bei Umsetzung von Variante B bewusst umzukehren). Unter Windows nicht gemessen.

Verhaltensgleichheit: `tests/terminal-fs-vergleich.js` vergleicht 75 Befehle (Aufnahme vor der Umstellung, `tests/_golden-shell-6a0.json`, Zeitstempel normalisiert) nach Ausgabe, `$?` und Prompt.

Korrekturen nach dem Review von #128: Die tatsächlichen `args` der Shell werden an `cd` und `ls` durchgereicht (`TERMINAL_DATEI`, `terminalDateiAusfuehren`); die Pfadauflösung erhält das Arbeitsverzeichnis ausdrücklich (`fs.resolve(pfad, { cwd })`, reine Funktion `terminalPfadAufloesen`), `cd` und `ls` übergeben `ctx.cwd`. Ohne `opt.cwd` gilt weiterhin der Zustand der einen Shell (Altverhalten, für `cat` usw.). Abgesichert in `tests/terminal-fs-schnittstelle.js` durch echte Shell-Aufrufe (Mitschnitt von `ctx.args`, `ctx.cwd`) und ein vom globalen Arbeitsverzeichnis abweichendes explizites `cwd`.

Bekannte Grenzen von 6a-0 (kein Merge-Blocker, vor breiterer Nutzung zu beheben): `sichtbar` greift nur in `readdir` (Archiv), nicht in `stat` und `readFile`; vor `find`/`stat`-Verbrauchern ist eine zentrale Operationsregel (`discover`, `stat`, `read`, `write`) auch für Aliasnamen, Tab und nachträgliche Sperren festzulegen. Archiv-`stat` ohne `pruefen` liefert `typ: null` auch für nicht vorhandene Ziele. `readdir` auf eine virtuelle Datei meldet `ENOENT` statt `ENOTDIR`. `stdout` und `stderr` sind getrennt, werden aber gemeinsam ausgegeben; Pipes und Ströme fehlen, es gibt keine vollständige Unix-Shell.

Windows-Rückmeldung (Master Wayne): Befehle wie erwartet. Bei `cd DOSSIERS` übernimmt der Shell-Pfad die getippte Schreibweise (`/DOSSIERS`), weil die Brücke unter Windows Groß- und Kleinschreibung nicht unterscheidet. Das ist Altverhalten (ALT wie NEU) und kein Fehler von 6a-0; unter Unix würde ein anderer Name als `Datei nicht gefunden` gelten. Ob der Pfad künftig den echten Namen der Brücke zeigen oder die Schreibweise streng prüfen soll, ist offen und gehört in die `cd`-Etappe.

### 9.9 Etappe 6a-1: `pwd` als Bash-Builtin (Draft)

Referenz bash 5.2.21 (lokal mit `bash -c` gemessen, nicht TTY, Skriptmodus-Präfix `bash: line 1:` durch das interaktive `bash:` ersetzt). Verbindlich: `-L`, `-P` (auch kombiniert und wiederholt) liefern ohne symbolische Links denselben Pfad; `--` beendet die Optionen; der erste Nicht-Optionswert beendet die Optionsauswertung; Operanden werden ignoriert (`pwd x` Rückgabewert 0); ungültige Option (auch `--x`, `-L-`, gemeldet als `--`) ergibt `bash: pwd: -x: invalid option` und `pwd: usage: pwd [-LP]` mit Rückgabewert 2; `pwd --help` gibt den Hilfetext aus, Rückgabewert 2; Auswertung der Reihe nach (`pwd --help -x` Hilfe, `pwd -x --help` Fehler). Test: `tests/terminal-pwd-bash.js` (29 Fälle, Verkettung mit `&&`/`||`, virtueller Baum und Archiv). Nicht nachgebildet: `$PWD` und `$OLDPWD` als Quelle von `-L` (Etappe 6a-5), symbolische Links existieren im Terminal nicht. `cd` und `ls` sind unverändert.

### 9.10 Etappe 6a-2: `cd` als Bash-Builtin und Schreibweise der Archivpfade (Draft)

Entscheidung (Master Wayne, 24.11.2026): Archivnamen werden **streng mit Groß- und Kleinschreibung** geprüft, wie unter Unix; `cd DOSSIERS` scheitert mit `No such file or directory`, auch unter Windows. Umsetzung ohne Änderung der Brücke: `fs.stat(seg, { pruefen: true })` liest das Elternverzeichnis (`ls` mit versteckten Einträgen) und vergleicht den Namen exakt; danach folgt wie bisher die Brückenoperation `cd` als Zugangsprüfung. Dadurch ist auch `Not a directory` bei Archivdateien möglich. Kosten: je Komponente ein `ls`-Aufruf des Elternverzeichnisses (bei sehr großen Verzeichnissen mehrere Seiten). Kurznamen (`dossi~1`) scheitern ebenfalls.

Verbindlich (Referenz bash 5.2.21, lokal in frischen Shells gemessen): Optionen `-L`, `-P`, `-e` ohne Wirkung (keine symbolischen Links), `-@` ungültig wie in der Referenz, `--` und erster Nicht-Optionswert beenden die Optionsauswertung, `--help` Hilfetext (2); mehr als ein Operand `bash: cd: too many arguments` (1); ohne Operand Heimatverzeichnis `/` (dokumentierte Abweichung); `cd ""` bleibt (0); `cd -` wechselt nach `OLDPWD` und gibt den Pfad aus, sonst `bash: cd: OLDPWD not set` (1); jeder erfolgreiche Wechsel (auch `cd .`, `cd ""`) setzt `OLDPWD`, ein Fehler nicht; Pfadkomponenten werden der Reihe nach geprüft (`f/..` Not a directory, `nonexist/..` No such file or directory); Fehlermeldungen mit Präfix `bash: cd:`. `OLDPWD` ist interner Zustand der Shell (`TERMINAL_ZUSTAND.oldpwd`, Kontext `env.OLDPWD`); die Variablenexpansion (`$OLDPWD`, `$HOME`) folgt in 6a-5. Nicht nachgebildet: `CDPATH`, `cdable_vars`, Zeilenhinweis der Bash im Skriptmodus. Test: `tests/terminal-cd-bash.js` (Mock-Brücke mit Verzeichnissen, die wie unter Windows die Schreibweise nicht unterscheidet).

Beobachtung zu den Mock-Brücken älterer Tests: sie führten bisher keine Verzeichniseinträge (`dir: true`); wegen der strengen Prüfung im Elternverzeichnis wurden `terminal-archiv-zugriff`, `-fs-ist`, `-fs-schnittstelle` und `-pwd-bash` um Verzeichniseinträge ergänzt (Testinfrastruktur, kein Produktionsverhalten). Die echte Brücke liefert Verzeichnisse als `dir: true`.

Nachträge nach dem Review von #132: Die strenge Namensprüfung gilt **nur für `cd`**; `ls`, Tab-Ergänzung, `cat`, `head`, `tail` und `wget` nutzen weiterhin die bisherige Brückenlogik (Windows: Schreibweise wird dort nicht streng geprüft). Sie ist **kein** Schutz vor der Offenlegung von Namen gesperrter Objekte (Variante B bleibt ein eigener Sicherheits-PR). Gegenüber der Aufnahme von 6a-1 ändern sich in der Sonde 12 Fälle: 11 `cd`-Fälle und ein nachfolgendes `pwd` (Folge des nun erfolgreichen `cd -`). Das Sitzungsende (`terminalSitzungTrennen`) setzt Arbeitsverzeichnis und `OLDPWD` jetzt auch ohne verbundene Archivbrücke zurück (vorher nur mit Brücke); Test über den echten Trennungspfad in `terminal-cd-bash`. Windows-Abnahme von Master Wayne am 24.11.2026: erfolgreich.

### 9.11 Sicherheits-PR Variante B (Namenssichtbarkeit)

Umgesetzt (Draft): `terminalBruecke('ls')` filtert Einträge, deren Name auf ein anwendungsseitig gesperrtes Pin-, Zonen- oder Sichtungsobjekt zeigt (`terminalArchivNameSichtbar`, gleiche Mustererkennung und Sperrentscheidung wie der Inhaltsschutz); `TERMINAL_FS.sichtbar` nutzt dieselbe Regel als zweite Schranke. Alle Verbraucher der Listung erben sie: `ls`, Tab-Ergänzung und die strenge Namensprüfung von `cd` (ein verborgener Name gilt dort als nicht vorhanden). Die Entscheidung gilt zum Abrufzeitpunkt, eine währenddessen gesetzte Sperre wirkt. Der Katalog `VAULT` liest die Brücke bewusst ungefiltert und behandelt Sperren selbst. `cat`, `head`, `tail`, `wget` auf einen getippten Namen liefern unverändert `Permission denied` (bewusst nicht in `No such file or directory` umgedeutet; der getippte Name ist dem Nutzer bereits bekannt). Es gibt noch keine Befehle `find`, `stat` und keine Platzhalterauflösung; sie erben die Regel über die FS-Schicht, sobald sie entstehen. `tests/terminal-fs-ist.js` ist umgekehrt (Dateiname bleibt aus Kontinuität erhalten) und deckt zusätzlich Entsperren/erneutes Sperren und Tab; Mutationsprobe: ohne die Codeänderung schlägt der Test an. Nicht gemessen: Windows, 8.3-Kurznamen gesperrter Dateien in `ls` (die Brücke meldet echte Namen; Prüfung besteht dort über `terminalArchivNameZiel` auf den gemeldeten Namen), große Listen.
