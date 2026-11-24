# Terminal: Simulation und echte Zugriffe

## Statusanzeigen im Fensterkopf

Die Anzeige rechts im Kopf des Terminalfensters gehört zu Shadow Terminal. Sie ist keine Ausgabe eines echten Werkzeugs und richtet sich allein nach der Phase von pppd:

| Anzeige | Wann | Farbe |
|---|---|---|
| `DIALING` | während eines Wählversuchs (chat wählt), gleich ob er gelingt | neutral |
| `PPP SETUP` | ab `CONNECT 19200` bis zur IP-Adresse (LCP/IPCP) | neutral |
| `<Satellit> · EST. LINK END hh:mm:ss` | ab stehender PPP-Verbindung (local/remote IP address) | grün |
| leer | holdoff, vor einer Neuwahl, nach `poff`, nach LINK END | |

`EST. LINK END` ist geschätzt aus Bahn und Funkmaske (Wahl ab 5°, Ende unter 3°). Endet der Link erst mit dem geometrischen Untergang, steht dort `EST. LOS`. PREDICT zeigt unabhängig davon immer den geometrischen LOS.

## Navigation: map und open

`map` öffnet die Lagekarte. `map PIN-nnn` navigiert zu einem Pin, `map ZO-nnn` zu einer **eigenen Profilzone** (nicht zu Missionszonen). Die Befehle `map pins [Suchbegriff]` und `map zones [Suchbegriff]` durchsuchen ihre jeweiligen Objektarten unabhängig von der Kartenansicht. Eine Zone erscheint niemals unter `map pins`. Kennungen, sichtbare Namen und eindeutige Namensanfänge sind für die direkte Navigation zugelassen; Tab bietet `PIN-`- und `ZO-`-Kennungen sowie deren sichtbare Namen an und übernimmt stets die stabile Kennung.

`open P-nnnn`, `open O-nnnn` und `open L-nnnn` öffnen weiterhin direkt Dossiers. **`open PIN-nnn` und `open ZO-nnn` öffnen das verknüpfte Dossier**, sofern eine Verknüpfung vorhanden ist. Die Namensnavigation (`open Parkplatz Nord`, `open Treffpunkt Reserve`) folgt derselben Semantik. Ohne Dossierverknüpfung meldet das Terminal `No linked dossier` (Exit-Code 1) und bleibt geöffnet. Bei inzwischen ungültigem Bezug erscheint `Linked dossier not found`. Für die Kartenansicht dient ausschließlich `map`. `open export <Name|PIN|ZO>` ist davon unabhängig und öffnet den entsprechenden VAULT-Datensatz im Terminal.

Gesperrte Dossiers, Pins und mit ihnen verknüpfte eigene Zonen sind über Namen weder auffindbar noch per Tab ergänzbar; über ihre Kennung erscheint `Permission denied`. Die Namen gesperrter Archiv-Exportdateien (Pin-, Zonen-, Sichtungsdateien) werden in keiner Archivlistung angezeigt (`ls`, Tab-Ergänzung, strenge `cd`-Prüfung); `cat` auf einen getippten Namen liefert weiterhin `Permission denied`. Gewöhnliche Archivdateien sind davon nicht betroffen. **Seit Phase 5a (in `main`):** Die Recherche-Dossierliste sowie Namensauflösung, Tab und die terminalinterne Zugriffsentscheidung sind vom historischen `infozugang`- und Missionsstatus entkoppelt. Die alten Daten bleiben für den Altprofilimport erhalten. Der historische Missionsmodus ist stillgelegt (`missionsbetrieb()` liefert `false`); eine Rudiment-/Freigabemaske gibt es nicht mehr. Eine exakte manuell geschützte Namensübereinstimmung darf nicht still auf einen längeren sichtbaren Präfixtreffer umleiten. `sudo map` und `sudo open` verwenden ausschließlich die bestehende verdeckte Kennwortprüfung der manuellen Sperren. Gesperrte Profilzonen werden auch auf der Karte, in Objektpopups und in der Lage-Box nicht dargestellt. Bei mehreren sichtbaren Namens-Treffern wird eine Kennung verlangt. Die erfolgreiche Navigation minimiert das Terminal, während PPP, tmux und Profanity weiterlaufen.

Mit `sudo` davor (`sudo open P-nnnn`, `sudo map PIN-nnn`) fragt das Terminal bei einem manuell gesperrten Ziel nach der Zugangskennung der Anmeldung, entsperrt wie die Schaltfläche „Entsperren“ dauerhaft und navigiert. Bei freien Zielen fragt es nicht. Gegenüber dem echten sudo:

- Gleich: Prompt `[sudo] password for raizo:` (Form des Ubuntu-Pakets, angenommen; das Original setzt `Password: `), kein Echo, drei Versuche mit `Sorry, try again.` und `sudo: 3 incorrect password attempts`, Strg+C beendet ohne `^C` mit Rückgabewert 130, `sudo: <befehl>: command not found`, Aufruf ohne Befehl zeigt die Usage (ohne SELinux-Optionen; ob das Ubuntu-Paket sie zeigt, ungeprüft).
- Anders: Das Original fragt vor jedem Befehl und merkt sich die Anmeldung einige Minuten; hier fragt nur ein gesperrtes Ziel, jedes Mal. `sudo` unterstützt ausschließlich `open` und `map`; andere bekannte Befehle erhalten `not supported in Shadow Terminal`. Das Kennwort ist die Zugangskennung der Oberfläche, kein Systemkennwort.
- Der Terminalzugang prüft nur die manuelle Dossiersperre, nicht historische Ansprechpartnerdaten. Wird die Oberfläche gesperrt, das Terminal geschlossen oder die Sitzung getrennt, wird eine laufende Kennwortabfrage abgebrochen und ihr Eingabepuffer verworfen.

Die Befehle sind Teil von Shadow Terminal und keinem echten Werkzeug nachgebildet; die Meldungen folgen dem Muster der Dateibefehle (`open: P-9999: No such file or directory`).

## VAULT-Katalog für Kartenexporte

`exports [Suchbegriff]` durchsucht vorhandene TXT-Exporte der Profil-Pins (`PIN-`) und eigenen Zonen (`ZO-`). `open export <Name|PIN-nnn|ZO-nnn>` liest den bevorzugten Datensatz direkt **im Terminal**. Namen werden exakt oder über einen eindeutigen Präfix aufgelöst; bei Mehrdeutigkeit werden nur zugängliche Objektkennungen und Namen ausgegeben. `sudo open export` erlaubt die vorhandene Kennwortauthentifizierung für manuell gesperrte Objekte. Die Sperre einer verknüpften Zone wird ebenso berücksichtigt wie bei Pins. Tab-Vervollständigung übernimmt jeweils die stabile Kennung.

**Inszenierung und tatsächliche Datenhaltung:** Die Terminaloberfläche zeigt den fiktiven zentralen Katalog `VAULT :: RECORD ACCESS`, niemals einen lokalen Archivpfad, `localhost`, einen Browser-Download oder eine Dateiauswahl. Der Datensatz wird inline dargestellt. Tatsächlich existiert kein zentraler Remote-Dienst: Die Befehle lesen die lokalen Archivordner `ops` und `dokumente` durch die bereits vorhandene, beschränkte Brücke `terminal_lokal.py` (`ls` und `cat`). Bei fehlender Verbindung meldet die Terminaloberfläche lediglich `VAULT: INDEX LINK UNAVAILABLE`; ein erfolgreicher Abruf wird nie fingiert.

Die lokale `ls`-Brücke liefert Verzeichniseinträge in deterministisch sortierten Seiten von höchstens 500 Elementen (`offset`, `limit`, `next`). Die Terminalseite liest in `terminalBruecke('ls', …)` alle Seiten: Der Katalog, der Shell-Befehl `ls` und die Tab-Ergänzung für Dateinamen sehen damit jeden Eintrag. Eine ungültige oder abgebrochene Seitenfolge ergibt einen Fehler statt einer unvollständigen Liste. Die Seiten werden nacheinander abgefragt, das Verzeichnis kann sich dazwischen ändern (kein gemeinsamer Schnappschuss).

Der Katalog erkennt `lageblatt-PIN-nnn[-vN].txt` und `zone-ZO-nnn[-vN].txt` anhand der unveränderlichen Objektkennung und der vorhandenen Datei, auch ohne alten Exportvermerk. Registrierte Exportdateien werden vor unregistrierten bevorzugt, anschließend das Änderungsdatum. Bei geöffnetem Datensatz wird der tatsächliche Text mit dem zuletzt registrierten SHA-256 verglichen und zusätzlich mit dem aktuellen Objekttext. Die Statuswerte sind `VERIFIED / CURRENT`, `VERIFIED / OUTDATED`, `INTEGRITY MISMATCH`, `UNTRACKED` und `UNVERIFIED` (falls die Hashfunktion nicht verfügbar ist). Ein später gesperrter Pin- oder Zonenexport wird vollständig aus dem Terminal-Scrollback entfernt.

**Sicherheitsgrenze:** Die terminalinterne Berechtigungsprüfung erfasst `open export` sowie direkte Dateizugriffe über `cat`, `head`, `tail`, `wget` und `/sendfile` für Exportdateien von Pins (`lageblatt-PIN-nnn`), Zonen (`zone-ZO-nnn`) und Sichtungen (`sichtung-<Dossier>-SI-nnn`, gesperrt mit ihrem Dossier). Maßgeblich ist der Dateiname in jedem Ordner, ohne Beachtung der Großschreibung, ohne Endpunkte und Leerzeichen am Ende und ohne Datenstrom nach `:`; zusätzlich gilt der echte Dateiname, den die Brücke in `file` meldet (`os.path.realpath`, deckt Kurznamen unter Windows ab). Geprüft wird vor und nach dem asynchronen Lesen. Gelesene Archivtexte stehen im Scrollback mit ihrer Zuordnung und werden nach **jeder** Zustandsänderung neu geprüft (`terminalSchutzPruefen` am Ende von `dispatch`): Sperrt ein Dossier, oder wird ein gelesener Pin oder eine Zone nachträglich mit einem gesperrten Dossier verknüpft, verschwindet der Text samt Koordinaten und Notizen, gleich über welchen Befehl er gelesen wurde; übrige Ausgaben bleiben. Unter Windows ist die Namensauflösung nur durch einen Einzeltest belegt (docs/windows-einzeltest-archivnamen.md). **Dies bleibt eine Zugriffsbeschränkung der Oberfläche:** Die lokale Python-Brücke kennt keine Dossier-/Profilrechte, und Dateien sind außerhalb der Anwendung über das Dateisystem weiterhin lesbar. Die simulierte zentrale Datenbank ist kein tatsächlicher Remote-Dienst.

## Echte Zugriffe

Simuliert sind Funkstrecke, pppd, WireGuard, der Onion-Server und Profanity. Echt sind:

- **Ablage:** Dateibefehle (`ls`, `cat`, `wget`, `/sendfile` liest die Datei) über die lokale Brücke `terminal_lokal.py`, nur im Archivordner.
- **nmap:** das installierte Nmap des PCs über dieselbe Brücke, ohne Shell und ohne Einschränkung der Optionen. Es scannt die echten Schnittstellen des PCs; `ppp0` und `wg-sat` spielen dafür keine Rolle. Zeitstempel in Nmaps Ausgabe sind Ortszeit des PCs, die simulierten Teile arbeiten in UTC.

## Benutzer

Die Shell läuft als gewöhnlicher Benutzer `raizo` (Prompt `raizo@terminal:/$`, `whoami` gibt `raizo` aus), nicht als root: sudo fragt root nie nach einem Kennwort (sudo, `plugins/sudoers/check.c`), ein Kennwortschutz über sudo setzt also einen anderen Benutzer voraus. Geändert sind nur Name, Prompt und die uid 1000 im tmux-Socket (`/tmp/tmux-1000/default`). Bewusst gleich geblieben:

- `~` und das Startverzeichnis sind `/`; ein Heimatverzeichnis `/home/raizo` gibt es nicht.
- `pon`, `poff`, `plog` und `tail /var/log/syslog` laufen wie bisher. Unter Ubuntu ist der erste angelegte Benutzer unter anderem in den Gruppen `adm` (Protokolle lesen) und `dip` (pppd starten); das ist angenommen, nicht am System geprüft.
- `wg-quick` läuft ohne Rückfrage. Abweichung vom Original: wg-quick startet sich als Nicht-root über sudo neu und fragt nach dem Kennwort (`wg-quick/linux.bash`, Zeile 86 in wireguard-tools).
- nmap ist ohnehin das echte Programm des PCs mit den Rechten des Windows-Benutzers.

## pwd (Bash-Builtin, Phase 6a-1)

`pwd` bildet das Bash-Builtin nach (Referenz bash 5.2.21, lokal gemessen), nicht das externe `/usr/bin/pwd` (dessen `--help` endet mit Rückgabewert 0).

- `-L` und `-P` (auch kombiniert oder wiederholt) werden akzeptiert; im Terminal gibt es keine symbolischen Links, beide liefern denselben Pfad.
- `--` beendet die Optionen; der erste Nicht-Optionswert beendet die Optionsauswertung; Operanden werden ignoriert (`pwd x` gibt den Pfad aus, Rückgabewert 0).
- Ungültige Option (`pwd -x`, auch `--x` und `-L-`, dort als `--` gemeldet): `bash: pwd: -x: invalid option` und `pwd: usage: pwd [-LP]`, Rückgabewert 2.
- `pwd --help`: Hilfetext des Builtins auf stdout, Rückgabewert 2. Die Optionen werden der Reihe nach ausgewertet.
- Abweichungen: `$PWD` und `$OLDPWD` gibt es noch nicht (geplant 6a-5); `-L` richtet sich deshalb nicht nach `$PWD`. Das Arbeitsverzeichnis `/` ist zugleich Heimatverzeichnis (siehe Benutzer). Die Schreibweise von Archivpfaden unter Windows (Brücke ohne Unterscheidung der Groß- und Kleinschreibung) gehört zur Etappe `cd`.

## cd (Bash-Builtin, Phase 6a-2)

`cd` bildet das Bash-Builtin nach (Referenz bash 5.2.21, lokal gemessen).

- Optionen `-L`, `-P`, `-e` werden angenommen (ohne Wirkung, keine symbolischen Links); `--` beendet die Optionen; `-@` und andere Optionen: `bash: cd: -x: invalid option`, Usage-Zeile, Rückgabewert 2; `cd --help` Hilfetext, Rückgabewert 2.
- Mehr als ein Operand: `bash: cd: too many arguments` (1). Ohne Operand: Wechsel nach `/` (Abweichung: es gibt kein Heimatverzeichnis `/home/raizo`, siehe Benutzer). `cd ""` bleibt im Verzeichnis (0).
- `cd -` wechselt in das vorherige Verzeichnis und gibt den Pfad aus; vor dem ersten Wechsel `bash: cd: OLDPWD not set` (1). Jeder erfolgreiche Wechsel (auch `cd .`) setzt das vorherige Verzeichnis, ein Fehler nicht. `$OLDPWD` als Variable gibt es noch nicht (6a-5).
- Pfadkomponenten werden der Reihe nach geprüft: Datei als Komponente `Not a directory`, fehlende Komponente `No such file or directory` (auch bei `x/..`). Fehlermeldungen tragen das Präfix `bash: cd:`.
- Archivpfade werden streng mit Groß- und Kleinschreibung geprüft, auch unter Windows (`cd DOSSIERS` scheitert, ebenso Kurznamen wie `dossi~1`). Die Prüfung liest das Elternverzeichnis über die Brücke; der Zugangsschutz der Brücke gilt weiterhin.
- Die strenge Namensprüfung gilt nur für `cd`; `ls`, Tab und `cat` nutzen noch die bisherige Brückenlogik (spätere Etappen).
- Mit dem Sitzungsende (Abmeldung) werden Arbeitsverzeichnis und vorheriges Verzeichnis zurückgesetzt.
- Nicht nachgebildet: `CDPATH`, `cdable_vars`, Variablen (`$HOME`, `$PWD`, `$OLDPWD`).

## Sprache und Locale (seit 6a-4a)

Verbindliche Referenz ist `en_US.UTF-8` (Ubuntu 24.04, GNU coreutils 9.4, glibc 2.39), unabhängig von Host- und Browser-Locale. Die Kollation steckt in `terminal-locale.js` (erzeugt von `tools/gen-locale-en_US.py`). Sie bestimmt ausschließlich die Anzeigereihenfolge; Pfadauflösung und Zugriffsentscheidungen bleiben streng und unterscheiden Groß- und Kleinschreibung. Typografische Anführungszeichen erscheinen nur dort, wo das Referenzsystem sie verwendet (gnulib-Meldungen zu Optionsargumenten). Konfiguration über `LANG`/`LC_ALL`/`LC_COLLATE` ist vorgesehen, aber nicht umgesetzt. Details und Grenzen: `docs/phase6a-plan-pwd-cd-ls.md`, Abschnitt 9.13.

## ls (Phase 6a-3)

`ls` bildet GNU coreutils 9.4 nach (Ausgabe ohne TTY, Locale C, lokal gemessen; Aufnahmen in `tests/terminal-ls-gnu.js`). Die Meldungen tragen den Programmnamen `ls:`, nicht `bash:`.

- Optionen wie bei `getopt_long`: zusammengesetzte Kurzoptionen, Optionen auch hinter Operanden, `--` beendet sie, `-` ist ein Operand, eindeutig abgekürzte Langoptionen (`--cl`). Umgesetzt: `-a`, `-A` (die letzte gilt), `-d`, `-F` (hängt nur bei Verzeichnissen `/` an; ohne `-F` gibt es keinen Schrägstrich), `-h` (nur mit `-l`; Basis 1024, aufgerundet), `-l`, `-1` (die letzte von `-l`/`-1` gilt), `--all`, `--almost-all`, `--directory`, `--classify[=WHEN]`, `--human-readable`, `--help`.
- Fehler: `ls: invalid option -- 'z'`, `ls: unrecognized option '--falsch'`, `ls: option '--a' is ambiguous; possibilities: '--all' '--almost-all' '--author'`, `ls: option '--all' doesn't allow an argument`, jeweils mit der Zeile `Try 'ls --help' for more information.` und Rückgabewert 2; ungültiges `--classify=x`: Rückgabewert 1. Nicht erreichbarer Operand: `ls: cannot access 'x': No such file or directory` (auch `Not a directory`), Rückgabewert 2; Fehler stehen vor der Auflistung. Die Mehrdeutigkeitsmeldung nutzt die vollständige Langoptionsliste von ls 9.4 (Reihenfolge und Argumentarten gegen alle Präfixe gemessen).
- Operanden: mehrere Operanden mit Kopfzeile `name:` und Leerzeile; Dateioperanden zuerst; ein Dateioperand wird wie getippt ausgegeben; `ls -l /etc` und `ls /etc /var` funktionieren; jede Pfadkomponente wird streng geprüft (Archiv: Groß-/Kleinschreibung, auch unter Windows); leeres Verzeichnis: keine Ausgabe; `ls ''`: Fehler. Gesperrte Archivobjekte bleiben verborgen (Variante B).
- Sortierung und `.`/`..` (6a-4a): Einträge und Operanden werden nach en_US.UTF-8 sortiert (siehe Abschnitt "Sprache und Locale"); `-a` zeigt `.` und `..`, `-A` nicht.
- Bewusste Abweichungen (bis 6a-4b): Langformat unverändert (`dr-x`/`-r--`, Größe, Zeit in UTC; keine Zeile `total`), im virtuellen Baum zeigt `-l` nur Namen.
- Nicht umgesetzte Optionen von ls 9.4 (zum Beispiel `-R`, `-t`, `-r`, `-q`, `--color`) werden wie unbekannte Optionen gemeldet (`invalid option` beziehungsweise `unrecognized option`), obwohl `ls` sie kennt; das ist eine Entscheidung des Plans (Originalmeldung statt Sonderausgabe), kein Abbild des echten Systems. `--help` und `--version`: `--help` druckt einen auf die umgesetzten Optionen gekürzten Text im GNU-Format, `--version` ist nicht umgesetzt.
- Quoting der Namen in Meldungen: einfache Anführungszeichen, ein Apostroph als `'\''`; weitere Quoting-Stile von `ls` fehlen. Meldungen aus gnulib (`invalid argument ‘x’ for ‘--classify’`) erscheinen seit 6a-4a in typografischen Anführungszeichen (en_US.UTF-8), getopt-Meldungen und `cannot access` in ASCII.
