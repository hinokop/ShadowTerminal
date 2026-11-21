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

Gesperrte Dossiers, Pins und mit ihnen verknüpfte eigene Zonen sind über Namen weder auffindbar noch per Tab ergänzbar; über ihre Kennung erscheint `Permission denied`. **Phase 5a (Draft):** Die Recherche-Dossierliste sowie Namensauflösung, Tab und die terminalinterne Zugriffsentscheidung sind vom historischen `infozugang`- und Missionsstatus entkoppelt. Die alten Daten bleiben für den Altprofilimport erhalten. Wird der historische Missionsmodus ausdrücklich aktiviert, bleiben vorerst dessen gesonderte `wissen()`-Stufen und Rudiment-/Freigabemaske bestehen; diese Altoberfläche wird erst in 5b gezielt entfernt. Eine exakte manuell geschützte Namensübereinstimmung darf nicht still auf einen längeren sichtbaren Präfixtreffer umleiten. `sudo map` und `sudo open` verwenden ausschließlich die bestehende verdeckte Kennwortprüfung der manuellen Sperren. Gesperrte Profilzonen werden auch auf der Karte, in Objektpopups und in der Lage-Box nicht dargestellt. Bei mehreren sichtbaren Namens-Treffern wird eine Kennung verlangt. Die erfolgreiche Navigation minimiert das Terminal, während PPP, tmux und Profanity weiterlaufen.

Mit `sudo` davor (`sudo open P-nnnn`, `sudo map PIN-nnn`) fragt das Terminal bei einem manuell gesperrten Ziel nach der Zugangskennung der Anmeldung, entsperrt wie die Schaltfläche „Entsperren“ dauerhaft und navigiert. Bei freien Zielen fragt es nicht. Gegenüber dem echten sudo:

- Gleich: Prompt `[sudo] password for raizo:` (Form des Ubuntu-Pakets, angenommen; das Original setzt `Password: `), kein Echo, drei Versuche mit `Sorry, try again.` und `sudo: 3 incorrect password attempts`, Strg+C beendet ohne `^C` mit Rückgabewert 130, `sudo: <befehl>: command not found`, Aufruf ohne Befehl zeigt die Usage (ohne SELinux-Optionen; ob das Ubuntu-Paket sie zeigt, ungeprüft).
- Anders: Das Original fragt vor jedem Befehl und merkt sich die Anmeldung einige Minuten; hier fragt nur ein gesperrtes Ziel, jedes Mal. `sudo` unterstützt ausschließlich `open` und `map`; andere bekannte Befehle erhalten `not supported in Shadow Terminal`. Das Kennwort ist die Zugangskennung der Oberfläche, kein Systemkennwort.
- Der Terminalzugang prüft nur die manuelle Dossiersperre, nicht historische Ansprechpartnerdaten. Historische Dossier-Rudimentmasken im ausdrücklich aktivierten Missionsmodus sind noch vorhanden (5b). Wird die Oberfläche gesperrt, das Terminal geschlossen oder die Sitzung getrennt, wird eine laufende Kennwortabfrage abgebrochen und ihr Eingabepuffer verworfen.

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
