# Paket 3: `sys` – Konzept (entschieden am 25.11.2026, siehe Abschnitt 0)

Stand 25.11.2026, Grundlage `main` `8773b37` (nach #137 und #138). Bezug: docs/terminal-dateisystem-architektur.md, Abschnitte 6 und 8.3.
Die Punkte S1 bis S9 in Abschnitt 5 sind entschieden (Abschnitt 0); A0 ist verbindliches Abnahmekriterium.

## 0. Entscheidungen (Master Wayne, 25.11.2026)

S1 bis S9 sind wie in Abschnitt 5 empfohlen entschieden:

- **S1:** Es gibt ein eingeschränktes `sudo` mit zwei strikt getrennten Berechtigungsbereichen. Die *Systemadministration* erlaubt das Bearbeiten ausdrücklich freigegebener Systemdateien unter `/etc`. Die *Rechercheberechtigung* entsperrt Dossiers über `sudo open` bzw. `sudo map`. Es gibt keine Root-Shell und keinen Zugriff auf den Windows-Host, und administrative Dateibefehle umgehen keine Dossiersperre.
- **S2:** Die Systemkonfiguration wird in die Sicherung integriert.
- **S3:** Die Standardwerte liegen schreibgeschützt unter `/usr/share`.
- **S4:** Der Umfang ist wie vorgeschlagen; profanity wird zurückgestellt.
- **S5:** Eine Änderung wirkt beim nächsten Start des Dienstes.
- **S6:** Abweichende Werte führen zu realistischem Fehlerverhalten.
- **S7:** Die Konfigurationsdatei von predict hat Vorrang.
- **S8:** Es gilt ein einheitlicher, konfigurierbarer Hostname.
- **S9:** Die bestehenden Namen der Sicherungsbefehle bleiben.

**Verbindliche Zusatzanforderung und Abnahmekriterium A0:** Die größere technische Tiefe darf den operativen Kommunikationsablauf weder verkomplizieren noch verlängern.
Mit der Standardkonfiguration muss der bisherige vollständige Ablauf **ohne zusätzliche Befehle und ohne zusätzliche künstliche Wartezeiten** weiter funktionieren:
predict im geteilten Terminalfenster; `pon kestrel && tmux split-window -bd plog -f`; `wg-quick up wg-sat && profanity`; dazu das bestehende Verhalten von
DIALING, AOS/LOS, Countdown und Verbindungsabbau bei LOS. Daraus folgt:
- Alle dafür nötigen Konfigurationsdateien sind standardmäßig vorhanden, gültig und sofort einsatzbereit.
- WireGuard-Schlüssel werden einmalig erzeugt und danach automatisch verwendet. Es gibt keinen manuellen Schlüsselimport.
- Das Bearbeiten von Konfigurationsdateien ist eine optionale Verwaltungstätigkeit außerhalb des Kommunikationsfensters und nie Voraussetzung für den Verbindungsaufbau.
- Ein `sudo`-Kennwort wird nur für diese Verwaltung verlangt, nie im Kommunikationsablauf.
- Realistische Folgen gibt es nur bei Konfigurationen, die der Benutzer selbst geändert hat. Künstliche Fehler, zusätzliche Pflichtauthentifizierungen und zusätzliche Verzögerungen gibt es nicht.
- Die zeitliche Begrenzung durch die Sichtbarkeit der Satelliten bleibt unverändert.
- A0 wird als automatisierter Ende-zu-Ende-Test des Ablaufs mit Standardkonfiguration und unveränderten Zeitkonstanten umgesetzt, zusätzlich als Punkt der Windows-Abnahme.

**Präzisierungen (Master Wayne und ChatGPT nach Prüfung von `9909c39`, 25.11.2026; Implementierung freigegeben):**
- WireGuard-Schlüssel werden getrennt und dauerhaft gespeichert, automatisch verwendet und in die Sicherung integriert. Private Schlüssel sind angemessen vor Lesen geschützt. `PostUp` ist ausschließlich eine begrenzte Simulationsfunktion und keine allgemeine Befehlsausführung.
- Der aktive Hostname erscheint einheitlich im Prompt, in `hostname`, `uname -n`, `uname -a` und in neu erzeugten Systemprotokollen.
- predict: Eine eigene QTH-Datei hat Vorrang. Fehlt sie, gilt dynamisch der Ausgangsort des Anwendungsprofils, danach der bisherige Standardwert Berlin.
- Die fünf Meilensteine werden in einem zusammenhängenden Pull Request umgesetzt, mit gezielten Zwischentests sowie vollständiger CI und unabhängigem Review vor dem Merge.

**Umsetzungsdetails aus A0 (Vorschlag, im Pull Request zur Prüfung):**
- Der Schlüssel liegt in einer eigenen Datei `/etc/wireguard/wg-sat.key`. Sie wird beim ersten `wg-quick up` erzeugt, ohne sichtbare Verzögerung. `wg-sat.conf` lädt ihn wie in der Praxis über `PostUp = wg set %i private-key …`. Wer die Konfiguration aus `/usr/share` zurücksetzt, behält deshalb den Schlüssel.
- Der Hostname bleibt standardmäßig `terminal`, wie im Prompt; `uname -n` wird daran angeglichen. Eine Änderung wirkt ab der nächsten Anmeldung.

## 1. Ziel

Die simulierte Systemkonfiguration soll wie unter Linux aus Dateien kommen, die man lesen, ändern und zurücksetzen kann. Die Dienste
lesen diese Dateien beim Start, prüfen sie und verhalten sich danach. Bei fehlerhafter Konfiguration melden sie einen Fehler wie ein echter Daemon.
Grundsatz der Architektur: Standardinhalte kommen aus dem Code. Eigene Änderungen liegen als Overlay darüber. Dienste schreiben `/run` und die Logs,
der Benutzer nicht. Es startet nichts auf dem echten Rechner, und der Zugriff auf den Host bleibt so begrenzt wie bisher.

## 2. Ist-Stand im Code (gelesen am 25.11.2026)

| Bereich | Ort im Code | Stand |
|---|---|---|
| Wurzelbaum | `TERMINAL_TLE_DIRS`, `TERMINAL_VIRT_DATEIEN`, Anbieter `wurzel` (profil-modul.js) | nur lesend, `schreibFehler` EACCES; Inhalte bei Aufruf aus Konstanten erzeugt |
| PPP | `/etc/ppp/peers/kestrel`, `/etc/chatscripts/kestrel` | Text wird aus `TERMINAL_PPP_HOLDOFF`, `TERMINAL_PPP_DAUER.timeout`, `TERMINAL_PPP_WAHL` erzeugt; `pon`/`pppd`/`poff` lesen die Datei **nicht**, sondern die Konstanten |
| WireGuard | `wg-quick up/down wg-sat`, `wg show wg-sat` | keine Konfigurationsdatei; Schlüssel bei jedem `up` neu zufällig, Endpunkt `192.0.2.42:51820`, Adresse und MTU fest im Code |
| predict | `~/.predict/predict.tle` (nur als Name), `/var/cache/tle/kestrel.tle` | QTH aus dem ersten Ausgangsort des Profils (sonst Berlin); die Datei `~/.predict/predict.tle` existiert im VFS nicht |
| profanity | `PROFIL.xmpp` | Konto im Anwendungsprofil, keine Dateien |
| Identität | Prompt `raizo@terminal`, `uname -a` meldet `ubuntu-server` | **Widerspruch** im Hostnamen; `/etc/hostname`, `/etc/hosts`, `/etc/os-release` fehlen |
| Logs | `/var/log/syslog` | von den Diensten erzeugt; `cat`/`tail` über einen Sonderpfad, im Anbieter `readFile` ENOSYS |
| sudo | `terminalSudo` | nur `sudo open`/`sudo map` (Entsperren von Anwendungsobjekten); alles andere `not supported`; kein Root-Modell (Architektur 9a.1) |
| ping | `ping relay` | fester Name, keine Namensauflösung |

## 3. Vorgeschlagene Architektur

**Anbieter `sys`.** Er wird für `/etc` (später auch `/usr/share`) eingehängt und ersetzt dort den heutigen Teil des Anbieters `wurzel`. Jede Datei ist
1. ein **Standard** aus dem Code (`SYS_STANDARD`: Pfad → Erzeugerfunktion und Prüfschema) oder
2. ein **Overlay-Eintrag** im VFS-Speicher von Paket 1 (eigener Namensraum, getrennt von `/home`, gleiche Quoten-, Prüfsummen- und Sperrmechanik).

Lesen liefert das Overlay, wenn es vorhanden ist, sonst den Standard. Gelöschte Standarddateien werden als Löschmarke im Overlay vermerkt.
Damit verhält sich das System wie ein Paket, dessen Konfigurationsdatei entfernt wurde, und die Datei taucht nicht wieder auf.

**Dienste lesen Dateien.** `pon`, `pppd`, `wg-quick` usw. lesen ihre Konfiguration beim Start über `TERMINAL_FS` aus dem Anbieter, nicht mehr
aus Konstanten. Ein kleiner Parser je Dateiformat prüft die Datei gegen ein Schema mit den Schlüsseln, die die Simulation tatsächlich auswertet.
Unbekannte Schlüssel behandeln die Dienste wie ihr Vorbild: als Fehler oder als ignoriert, je Dienst nach Quelle belegt.
Was gelesen wurde, gilt bis zum nächsten Start des Dienstes, so wie bei einem echten Daemon.

**Standardwerte bleiben erhalten.** Die Konstanten werden zum Inhalt der Standarddateien. Ohne Overlay verhält sich alles exakt wie heute
(Regressionsschutz: bestehende Tests der Einwahlkette bleiben unverändert grün).

**Datenvertrag.** Alte Profile haben kein Overlay, für sie gelten die Standards. Das Fallpaket ist nicht betroffen. Für das Sicherungspaket siehe S2.

## 4. Kandidaten nach Dienst

| Dienst | Dateien | Ausgewertete Schlüssel (Vorschlag) | Wirkung |
|---|---|---|---|
| PPP | `/etc/ppp/peers/kestrel`, `/etc/chatscripts/kestrel`, neue Peers unter `/etc/ppp/peers/` | Gerät, `holdoff`, `maxfail`, `persist`, `connect`-Zeile mit Pfad des Chatskripts; im Chatskript `ABORT`, `TIMEOUT`, Wählbefehl `ATDT<Nummer>` | anderes Gerät, andere Nummer, kürzere Zeitgrenze, fehlerhaftes Skript wirken auf die Einwahl |
| WireGuard | `/etc/wireguard/wg-sat.conf` (neu) | `PrivateKey`, `Address`, `MTU`, `ListenPort`; Peer `PublicKey`, `Endpoint`, `AllowedIPs` | Schlüssel bleiben über `up`/`down` hinweg gleich, `wg show` zeigt die Konfiguration; optional `wg genkey`/`wg pubkey` |
| Identität | `/etc/hostname`, `/etc/hosts`, `/etc/os-release` (neu) | Hostname, Namen in `hosts` | Prompt und `uname -n` konsistent; `ping` löst Namen über `hosts` auf (bisher fest `relay`) |
| predict | `~/.predict/predict.qth`, `~/.predict/predict.tle` (Benutzerdateien im VFS, nicht `/etc`) | Format nach predict(1) | QTH und Satellitenbestand aus Dateien; Verhältnis zum Ausgangsort der Oberfläche siehe S7 |
| profanity | `~/.config/profanity/profrc` | – | Vorschlag: nicht in Paket 3 |
| Logs, `/run` | `/var/log/syslog`, `/run/ppp0.pid` u. a. | – | weiter nur durch Dienste erzeugt; `/run` optional |

Vor der Umsetzung muss jedes übernommene Verhalten an einer Quelle belegt werden (Handbuchseiten pppd(8), chat(8), wg(8), wg-quick(8), predict(1),
Debian-Paketinhalte). Dazu gehören besonders die genauen Fehlermeldungen von pppd und chat bei fehlender oder fehlerhafter Peer-Datei.
Ich habe sie **noch nicht geprüft** und schreibe sie hier deshalb bewusst nicht auf.

## 5. Offene Entscheidungen

**S1 – Wer darf `/etc` ändern?** (zentral, berührt Architektur 9a.1 „kein Root-Modell“)
- (a) **Eng begrenztes `sudo` für Systemdateien:** `sudo nano`, `sudo cp`, `sudo mv`, `sudo rm`, `sudo mkdir` und neu `sudo tee [-a]`, nur mit Zielen
  unter `/etc` und mit demselben Kennwort. Es gibt keine Root-Shell und kein `sudo -i`; die bisherige Bedeutung von `sudo open/map` bleibt.
  `sudo echo x > /etc/datei` scheitert dann wie unter Linux mit `Permission denied`, weil die eigene Shell umleitet; der übliche Weg ist `… | sudo tee`.
  Das setzt Pipes voraus, die es nicht gibt. Ohne Pipes bleibt nur `sudo tee datei` mit Eingabe über die Tastatur oder `sudo nano`.
- (b) `/etc` direkt für `raizo` beschreibbar: einfacher, aber unrealistisch.
- (c) Gruppenmodell wie unter Debian (`dip` darf `pon` ausführen, Dateien gehören root). Ändern geht dann trotzdem nur über (a).
- Empfehlung: (a), ohne `tee`, solange es keine Pipes gibt; `sudo nano` und `sudo cp` genügen.

**S2 – Sicherung des Overlays**
- (a) Das Overlay ist Teil des Sicherungspakets von Paket 1, als eigener Abschnitt. Das Manifest bekommt eine neue Formatversion, ältere Pakete bleiben importierbar.
- (b) Keine Sicherung; ein Verlust bedeutet nur die Rückkehr zu den Standards.
- Empfehlung: (a). Eigene Konfigurationen sind Arbeit, und die Befehlsnamen `home-backup` usw. bleiben dann aber ungenau; siehe S9.

**S3 – Zurücksetzen auf Standard**
- (a) Die Standards liegen lesbar unter `/usr/share/…` (wie Beispieldateien in Paketen), zurückgesetzt wird mit `sudo cp`.
- (b) Ein `rm` der Overlay-Datei lässt den Standard wieder erscheinen: bequem, aber anders als unter Linux.
- (c) Ein eigener Befehl.
- Empfehlung: (a); `rm` löscht wirklich (Löschmarke).

**S4 – Umfang von Paket 3.** Vorschlag: PPP, WireGuard, Identität, predict-Dateien. Nicht enthalten: profanity, `/run`, `systemctl`/`journalctl`.

**S5 – Wann wirkt eine Änderung?** Vorschlag: beim nächsten Start des Dienstes (`poff`/`pon`, `wg-quick down/up`). Ein laufender Dienst bleibt unberührt.

**S6 – Verhalten bei abweichenden Werten** (kreativ und funktional zugleich)
- Nummer: (a) nur die Gateway-Nummer verbindet, andere enden realistisch mit `NO CARRIER` oder `BUSY`; (b) jede Nummer verbindet.
- Gerät: nur `/dev/ttyUSB0` existiert, andere Geräte ergeben den Öffnungsfehler von pppd.
- WireGuard-Endpunkt: (a) nur der vorgesehene Endpunkt antwortet, sonst gibt es keinen Handshake (wie bei falschem Endpunkt in der Wirklichkeit); (b) jeder Endpunkt geht.
- Empfehlung jeweils (a). Ausgegeben werden nur echte Daemonmeldungen, keine Hinweise zum Spielverlauf.

**S7 – QTH von predict:** (a) Das Profil (Ausgangsort) bleibt die Quelle, `predict.qth` wird daraus erzeugt und ist nur lesbar; (b) die Datei hat Vorrang,
wenn sie im VFS existiert, sonst gilt das Profil; (c) nur die Datei. Empfehlung: (b).

**S8 – Hostname:** Welcher Name gilt (`terminal` wie im Prompt oder `ubuntu-server` wie in `uname`, oder ein dritter)? Wirkt eine Änderung an `/etc/hostname`
erst nach Ab- und Anmeldung (realistisch) oder sofort? Empfehlung: ein einziger Name, Wirkung erst bei der nächsten Anmeldung.

**S9 – Namen der Sicherungsbefehle:** Bei S2 (a) sichern `home-backup`/`home-restore` auch `/etc`. Belassen (mit Dokumentation) oder allgemein benennen
(Befehlsnamen sind ohnehin eigene, kein Linux-Vorbild)? Empfehlung: belassen; die Wiederherstellung fragt getrennt nach `/home` und `/etc`.

## 6. Meilensteine (ein Pull Request, Zwischentests je Meilenstein)

1. **Anbieter `sys`, Overlay und Rechte:** Einhängung, Standard und Overlay, Löschmarken, S1, Sicherung (S2), Zurücksetzen (S3), Regressionen für Sperren und Quoten.
2. **PPP aus Dateien:** Parser für Peer und Chatskript, Einwahl liest die Dateien, Fehlerfälle nach S6.
3. **WireGuard:** `wg-sat.conf`, feste Schlüssel, `wg show` aus der Datei, Endpunktverhalten.
4. **Identität:** `hostname`, `hosts`, `os-release`, Prompt, `uname -n`, `ping` über `hosts`.
5. **predict-Dateien:** `predict.qth` und `predict.tle` nach S7.

Danach folgen die vollständige Standardauswahl, das Review durch ChatGPT und die Windows-Abnahme mit Neustart (Overlay über einen Neustart hinweg).

## 7. Risiken und Ungeprüftes

- Die genauen Meldungen von pppd, chat und wg-quick sind noch nicht an Quellen geprüft (siehe Abschnitt 4).
- `sudo` mit Schreibrecht ist eine neue Rechteklasse. Sie braucht Regressionen dafür, dass `/home`, `/intel` und das Archiv davon unberührt bleiben und dass `sudo` keine manuelle Sperre umgeht.
- Golden-Ausgaben der Einwahlkette und `ls /etc` (neue Dateien) ändern sich absichtlich; die Erwartungen kommen in einen eigenen Commit.
- Größere Bestände in `/etc` sind nicht geplant; die Quoten von Paket 1 gelten mit.
- Die echten Dienste des PCs (Nmap) bleiben getrennt; `/etc/hosts` der Simulation wirkt nicht auf das echte Nmap.
