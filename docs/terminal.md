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

## Echte Zugriffe

Simuliert sind Funkstrecke, pppd, WireGuard, der Onion-Server und Profanity. Echt sind:

- **Ablage:** Dateibefehle (`ls`, `cat`, `wget`, `/sendfile` liest die Datei) über die lokale Brücke `terminal_lokal.py`, nur im Archivordner.
- **nmap:** das installierte Nmap des PCs über dieselbe Brücke, ohne Shell und ohne Einschränkung der Optionen. Es scannt die echten Schnittstellen des PCs; `ppp0` und `wg-sat` spielen dafür keine Rolle. Zeitstempel in Nmaps Ausgabe sind Ortszeit des PCs, die simulierten Teile arbeiten in UTC.

## Benutzer

Die Shell läuft als gewöhnlicher Benutzer `raizo` (Prompt `raizo@terminal:/$`, `whoami` gibt `raizo` aus), nicht als root: sudo fragt root nie nach einem Kennwort (sudo, `plugins/sudoers/check.c`), ein Kennwortschutz über sudo setzt also einen anderen Benutzer voraus. Geändert sind nur Name und Prompt. Bewusst gleich geblieben:

- `~` und das Startverzeichnis sind `/`; ein Heimatverzeichnis `/home/raizo` gibt es nicht.
- `pon`, `poff`, `plog` und `tail /var/log/syslog` laufen wie bisher. Unter Ubuntu ist der erste angelegte Benutzer unter anderem in den Gruppen `adm` (Protokolle lesen) und `dip` (pppd starten); das ist angenommen, nicht am System geprüft.
- `wg-quick` läuft ohne Rückfrage. Abweichung vom Original: wg-quick startet sich als Nicht-root über sudo neu und fragt nach dem Kennwort (`wg-quick/linux.bash`, Zeile 86 in wireguard-tools).
- nmap ist ohnehin das echte Programm des PCs mit den Rechten des Windows-Benutzers.
