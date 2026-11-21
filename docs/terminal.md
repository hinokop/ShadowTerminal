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

`map` öffnet die Lagekarte, `map PIN-nnn` und `open PIN-nnn` springen zum Pin und öffnen sein Fenster, `open P-nnnn` (ebenso `O-`, `L-`) öffnet das Dossier. Nur exakte Kennungen; die Suche nach Namen folgt später. Der Zugang ist derselbe wie in der Oberfläche (`zielZugang`): Ist ein Dossier manuell gesperrt, gilt das auch für die mit ihm verknüpften Pins; der Aufruf meldet dann `Permission denied` und navigiert nicht. Ohne Freigabe durch den Ansprechpartner öffnet `open` die bestehende Ansicht „Zugriff beschränkt“. Zeichnet die Karte statt eines Pins seine Sichtung, wird die Sichtung gewählt. Nach dem Sprung wird das Terminal minimiert; pppd, tmux und Profanity laufen weiter.

Die Befehle sind Teil von Shadow Terminal und keinem echten Werkzeug nachgebildet; die Meldungen folgen dem Muster der Dateibefehle (`open: P-9999: No such file or directory`).

## Echte Zugriffe

Simuliert sind Funkstrecke, pppd, WireGuard, der Onion-Server und Profanity. Echt sind:

- **Ablage:** Dateibefehle (`ls`, `cat`, `wget`, `/sendfile` liest die Datei) über die lokale Brücke `terminal_lokal.py`, nur im Archivordner.
- **nmap:** das installierte Nmap des PCs über dieselbe Brücke, ohne Shell und ohne Einschränkung der Optionen. Es scannt die echten Schnittstellen des PCs; `ppp0` und `wg-sat` spielen dafür keine Rolle. Zeitstempel in Nmaps Ausgabe sind Ortszeit des PCs, die simulierten Teile arbeiten in UTC.
