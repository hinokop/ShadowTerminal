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

`map` öffnet die Lagekarte, `map PIN-nnn` und `open PIN-nnn` springen zum Pin und öffnen sein Fenster, `open P-nnnn` (ebenso `O-`, `L-`) öffnet das Dossier. Mit `map pins` werden alle persistenten Pins aufgelistet, auch wenn sie auf der Karte ausgeblendet sind. `map pins <Suchbegriff>` sucht ohne Beachtung der Großschreibung und diakritischer Zeichen nach Kennung, Anzeigename und Zweck. Bei gesperrten Pins sind ausschließlich die Kennungen auffindbar und sichtbar (`[LOCKED]`); die Suche nach Namen oder Zwecken liefert diese Pins nicht. `Tab` ergänzt live die Kennungen für `map`, `open` und `sudo map/open`. Bei frei zugänglichen Pins kann die Vervollständigung auch über den Namensanfang erfolgen; sie setzt beim Übernehmen immer die eindeutige `PIN-`-Kennung ein. Direkte Aufrufe akzeptieren nun auch Namen: `map Parkplatz Nord` oder `map "Parkplatz Nord"` zentrieren den Pin, `open Zielknoten Delta` öffnet ein sichtbares Dossier. Auch eindeutige Namensanfänge und Dossier-Aliase werden erkannt; exakte Namensgleichheit hat Vorrang vor Präfixen. Bei mehreren Treffern werden Kennungen und lesbare Namen aufgelistet, und die Navigation wird verweigert (Status 1). `map` berücksichtigt ausschließlich Pins; `open` berücksichtigt Pins und sichtbare Dossiers. Gesperrte Namen bleiben für `map`, `open` und `sudo` unsichtbar und sind ausschließlich per Kennung erreichbar. Die Tab-Ergänzung umfasst zusätzlich sichtbare Dossier-Namen und Aliase und übernimmt deren stabile Kennungen. Der Zugang ist derselbe wie in der Oberfläche (`zielZugang`): Ist ein Dossier manuell gesperrt, gilt das auch für die mit ihm verknüpften Pins; der Aufruf meldet dann `Permission denied` und navigiert nicht. Ohne Freigabe durch den Ansprechpartner öffnet `open` die bestehende Ansicht „Zugriff beschränkt“. Zeichnet die Karte statt eines Pins seine Sichtung, wird die Sichtung gewählt. Nach dem Sprung wird das Terminal minimiert; pppd, tmux und Profanity laufen weiter.

Mit `sudo` davor (`sudo open P-nnnn`, `sudo map PIN-nnn`) fragt das Terminal bei einem manuell gesperrten Ziel nach der Zugangskennung der Anmeldung, entsperrt wie die Schaltfläche „Entsperren“ dauerhaft und navigiert. Bei freien Zielen fragt es nicht. Gegenüber dem echten sudo:

- Gleich: Prompt `[sudo] password for raizo:` (Form des Ubuntu-Pakets, angenommen; das Original setzt `Password: `), kein Echo, drei Versuche mit `Sorry, try again.` und `sudo: 3 incorrect password attempts`, Strg+C beendet ohne `^C` mit Rückgabewert 130, `sudo: <befehl>: command not found`, Aufruf ohne Befehl zeigt die Usage (ohne SELinux-Optionen; ob das Ubuntu-Paket sie zeigt, ungeprüft).
- Anders: Das Original fragt vor jedem Befehl und merkt sich die Anmeldung einige Minuten; hier fragt nur ein gesperrtes Ziel, jedes Mal. `sudo` unterstützt ausschließlich `open` und `map`; andere bekannte Befehle erhalten `not supported in Shadow Terminal`. Das Kennwort ist die Zugangskennung der Oberfläche, kein Systemkennwort.
- Die fehlende Freigabe durch den Ansprechpartner hebt sudo nicht auf. Wird die Oberfläche gesperrt, das Terminal geschlossen oder die Sitzung getrennt, wird eine laufende Kennwortabfrage abgebrochen und ihr Eingabepuffer verworfen.

Die Befehle sind Teil von Shadow Terminal und keinem echten Werkzeug nachgebildet; die Meldungen folgen dem Muster der Dateibefehle (`open: P-9999: No such file or directory`).

## VAULT-Katalog für Kartenexporte

`exports [Suchbegriff]` durchsucht vorhandene TXT-Exporte der Profil-Pins (`PIN-`) und eigenen Zonen (`ZO-`). `open export <Name|PIN-nnn|ZO-nnn>` liest den bevorzugten Datensatz direkt **im Terminal**. Namen werden exakt oder über einen eindeutigen Präfix aufgelöst; bei Mehrdeutigkeit werden nur zugängliche Objektkennungen und Namen ausgegeben. `sudo open export` erlaubt die vorhandene Kennwortauthentifizierung für manuell gesperrte Objekte. Die Sperre einer verknüpften Zone wird ebenso berücksichtigt wie bei Pins. Tab-Vervollständigung übernimmt jeweils die stabile Kennung.

**Inszenierung und tatsächliche Datenhaltung:** Die Terminaloberfläche zeigt den fiktiven zentralen Katalog `VAULT :: RECORD ACCESS`, niemals einen lokalen Archivpfad, `localhost`, einen Browser-Download oder eine Dateiauswahl. Der Datensatz wird inline dargestellt. Tatsächlich existiert kein zentraler Remote-Dienst: Die Befehle lesen die lokalen Archivordner `ops` und `dokumente` durch die bereits vorhandene, beschränkte Brücke `terminal_lokal.py` (`ls` und `cat`). Bei fehlender Verbindung meldet die Terminaloberfläche lediglich `VAULT: INDEX LINK UNAVAILABLE`; ein erfolgreicher Abruf wird nie fingiert.

Der Katalog erkennt `lageblatt-PIN-nnn[-vN].txt` und `zone-ZO-nnn[-vN].txt` anhand der unveränderlichen Objektkennung und der vorhandenen Datei, auch ohne alten Exportvermerk. Registrierte Exportdateien werden vor unregistrierten bevorzugt, anschließend das Änderungsdatum. Bei geöffnetem Datensatz wird der tatsächliche Text mit dem zuletzt registrierten SHA-256 verglichen und zusätzlich mit dem aktuellen Objekttext. Die Statuswerte sind `VERIFIED / CURRENT`, `VERIFIED / OUTDATED`, `INTEGRITY MISMATCH`, `UNTRACKED` und `UNVERIFIED` (falls die Hashfunktion nicht verfügbar ist). Ein später gesperrter Pin- oder Zonenexport wird vollständig aus dem Terminal-Scrollback entfernt.

**Sicherheitsgrenze:** Diese virtuelle Zugangssperre schützt nur die neuen `open export`-Befehle und die Anzeige im Terminal. Direkte Dateibefehle wie `cat` sind weiterhin über die Archivbrücke zugänglich; ein echter Dateizugriffsschutz müsste zusätzlich auf Ebene der Brücke implementiert werden. Auch die simulierte zentrale Datenbank ist kein tatsächlicher Remote-Dienst.

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
