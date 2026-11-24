# Architekturvorschlag: hybrides virtuelles Dateisystem (Entwurf, keine Entscheidung zur Umsetzung)

Stand 24.11.2026. Grundlage: Zielrichtung und Antworten von Master Wayne vom 24.11.2026. Dieses Dokument enthält **keine Implementierung** und **keine endgültige Migration bestehender Pfade**. Es ist die Grundlage für die Abstimmung mit der unabhängigen Prüfung (ChatGPT). Fragenliste: [terminal-zielarchitektur-vorbereitung.md](terminal-zielarchitektur-vorbereitung.md); Backlog: [backlog-terminal-unix-details.md](backlog-terminal-unix-details.md).

## 1. Zielbild

Eine hybride, virtuelle Linux-Betriebsumgebung aus drei Arten von Inhalten:

1. **Persistentes, beschreibbares virtuelles Dateisystem** unter `/home/raizo` und `/tmp` (anlegen, lesen, ändern, kopieren, verschieben, löschen, Umleitungen `>` und `>>`).
2. **Fachlicher Baum `/intel`** (`dossiers`, `cases`, `geospatial`) als Sicht auf die tatsächlichen Anwendungsdaten. Karte, Dossiers und Terminal verwenden denselben Datenbestand; Änderungen laufen ausschließlich über kontrollierte Anwendungsaktionen unter Erhalt aller Zugriffsregeln. Keine Datenkopien, kein direkter Schreibzugriff auf interne Zustände.
3. **Simulierte Systeminfrastruktur** (`/etc`, `/var`, `/run`, `/opt`): PPP, WireGuard, KESTREL/PREDICT, Profanity, tmux und Logs bleiben erhalten und werden eingebunden; Konfigurationsdateien beeinflussen perspektivisch das Verhalten der simulierten Dienste. Es werden keine echten Host-Netzwerkdienste gestartet.

Reale Schnittstellen (Archivbrücke, Nmap) bleiben. Das Hostdateisystem wird nicht allgemein freigegeben. Alle bisherigen Funktionen bleiben erhalten; `TERMINAL_FS` ist die gemeinsame Grundlage.

## 2. Abgleich mit dem Codebestand (gelesen am 24.11.2026, `main` `32d73e6`)

- `TERMINAL_FS` (`profil-modul.js`) hat zwei feste Adapter: statische Maps (`TERMINAL_TLE_DIRS`, `TERMINAL_VIRT_DATEIEN`) und die Archivbrücke; `writeFile` liefert überall `EROFS`. `cat`, `head`, `tail`, `wget` (`terminalDateiBefehl`) und die Tab-Ergänzung laufen noch nicht über die Schnittstelle.
- Befehle liefern `{ code, stdout, stderr }` und eignen sich damit für Umleitungen. Der Shell-Zerleger (`terminalZerlegen`) kennt Quotes, `;`, `&&`, `||`; Umleitungen sind dort nicht vorgesehen.
- Speicher heute: Zustand und Profil als JSON in `localStorage` (synchron, begrenzt, Monolith); Dateien der Recherche in IndexedDB `fieldterminal.recherche` (Store `dateien`, SHA-256 je Blob); Fallpaket mit Manifest und Prüfsummen. `navigator.storage.persist()` wird nicht aufgerufen.
- Zugriffsregeln: `zielZugang(id)` ist die gemeinsame Entscheidung für Dossiers, Pins, Zonen; die Sichtbarkeit gesperrter Archivobjekte (Variante B, #133) sitzt zentral in `terminalBruecke('ls')` und als zweite Schranke in `TERMINAL_FS.sichtbar`.
- Start (korrigiert nach Review #136): `START_TERMINAL.bat` startet `terminal_lokal.py`; dieser ruft auf Windows `START_3D.bat` als Edge-Starter auf (`--user-data-dir=profil` neben der Startdatei, Seite per `file:///`). `START_3D.bat` wird also indirekt verwendet und bleibt bestehen; die Dateibrücke läuft im Normalfall. Master Wayne startet sie nicht mehr von Hand.

## 3. Mount-Tabelle und Richtlinienstufe

`TERMINAL_FS` wird zur Mount-Tabelle: längster Pfadpräfix wählt einen Provider mit einheitlicher Schnittstelle (`stat`, `readdir`, `read`, `write`, `mkdir`, `unlink`, `rmdir`, `rename`; Fehler errno-artig). **Vor jedem Provider** läuft eine zentrale Richtlinienstufe in dieser Reihenfolge: Mount und Pfadgültigkeit, Sichtbarkeit (Sperren, Variante B), Rechte, Quota, dann Provider. Befehle prüfen nie selbst. Die Prüfung wird beim Schreiben unmittelbar vor der Ausführung wiederholt (Wettlauf, siehe #133).

| Mount | Provider | Schreibbar |
|---|---|---|
| `/home`, `/tmp` | `vfs` (IndexedDB) | ja |
| `/intel` | Anwendungssicht aus `STATE` | nur über Aktionen (siehe 5) |
| `/etc`, `/var`, `/run`, `/opt` | `sys` (simuliert, Overlay) | teilweise (Konfiguration) |
| `/<Archiv>`, später auch `/mnt/archive` | Archivbrücke | wie heute |

## 4. Persistentes VFS (`/home`, `/tmp`)

**Technologie:** eigene IndexedDB `fieldterminal.vfs`, getrennt vom Profil-JSON und von der Recherche-DB. Ein Vorgang entspricht einer Transaktion (atomar, auch `mv`).

**Datenmodell (Entwurf):**
- Store `knoten`: `id` (fortlaufend, nie wiederverwendet), `eltern`, `name`, `typ` (`dir`/`file`), `modus`, `uid`, `gid`, `erstellt`, `geaendert`, `groesse`, `inhalt` (Schlüssel oder `null`), `fluechtig` (für `/tmp`), `version`. Eindeutiger Index auf (`eltern`, `name`).
- Store `inhalt`: Schlüssel, Daten (Text oder Blob), `sha256`, Kodierung.
- Store `meta`: Schemaversion, Zähler, Marke „sauber beendet".

**Namen und Pfade:** Namen strikt byte-gleich, Groß-/Kleinschreibung unterschieden, keine Normalisierung. Unzulässig: `/`, NUL, `.` und `..` als Name; Längengrenzen wie unter Linux (Name 255 Bytes, Pfad 4096). Paket 1 behandelt Textdateien (UTF-8); Binärdateien nur kopierend innerhalb des VFS.

**Quoten (Vorschlag, zu messen):** je Datei, gesamt und Knotenzahl begrenzt, damit kein Fehlverhalten den Browserspeicher füllt.

**Berechtigungen:** ein Benutzer `raizo`, `root` nur über das bestehende `sudo`. `modus`, `uid`, `gid` werden von Anfang an gespeichert (vermeidet eine spätere Migration). Erzwungen wird zunächst nur: Mount schreibbar und Schreibrecht des Eigentümers. Anzeige (`ls -l`) und `chmod` bleiben Backlog (B1/B2).

**`/tmp`:** flüchtig. Wird bei Abmeldung (Ende der Terminalsitzung, Sperren der Anwendung) geleert **und** beim nächsten Start, falls die Marke „sauber beendet" fehlt (Fenster geschlossen, Absturz). Entscheidung D1.

**Shell:** Der Zerleger erhält Umleitungen `>` und `>>` (Standardausgabe); der Runner schreibt `stdout` über die Richtlinienstufe. Pipes (`|`) und Fehlerumleitung (`2>`) sind nicht Teil von Paket 1, weil sie ein Prozessmodell brauchen. Befehle in Paket 1: `touch`, `mkdir`, `rmdir`, `rm` (auch `-r`), `cp`, `mv`, `cat` (auf `TERMINAL_FS`), Tab auf `TERMINAL_FS`, ein kleiner Editor (D2).

**Editor:** `nano`-artige Ansicht im Terminalfenster auf Basis eines `<textarea>` (Zwischenablage und Eingabemethoden funktionieren), Strg+O speichern, Strg+X beenden, Rückfrage bei ungespeicherten Änderungen. Eigener Unterpunkt von Paket 1.

**Sicherung gegen Datenverlust (Priorität vor Verschlüsselung):**
- `navigator.storage.persist()` anfordern.
- Zweitkopie über die Dateibrücke: `terminal_lokal.py` schreibt einen Schnappschuss von `/home` (Manifest mit Prüfsummen) in einen festen Ordner neben dem Starter; automatisch (verzögert) nach Änderungen, bei Abmeldung und auf Befehl; Wiederherstellung per Befehl. Die Brücke akzeptiert nur diesen Ordner, wie bisher mit Kennung und Größenbegrenzung. Befehlsnamen offen.
- Integritätsprüfung beim Laden: Prüfsummenfehler werden gemeldet, nichts wird still verworfen (Grundregel 7 des Datenvertrags).
- Manueller Export und Import als Rückfall, falls die Brücke nicht läuft; Erinnerung bei Abmeldung („letzte Sicherung vor N Tagen").
- **Eigenes Sicherungspaket, nicht Teil des Fallpakets** (D4): Das Fallpaket ist ein geprüfter Datenvertrag für den Fallkern; `/home` enthält beliebige, womöglich große oder sensible Dateien. Das Sicherungspaket nutzt denselben Mechanismus (Manifest, Prüfsummen). Einzelne Dateien in ein Fallpaket aufzunehmen kann später folgen.
- Verschlüsselung ist nachrangig. Die Trennung von `knoten` und `inhalt` hält ein späteres Verschlüsseln der Inhalte ohne Umbau offen. Ob die Passwortschranke Daten verschlüsselt oder nur den Zugang schützt, ist nicht verifiziert.

## 5. `/intel`

**Sicht, keine Kopie.** Der Provider rendert aus denselben Selektoren wie die Oberfläche und läuft durch `zielZugang`. Gesperrte Objekte fehlen im `readdir` (Variante B) und liefern bei direktem Zugriff `Permission denied`. Karte, Dossiers und Terminal verwenden denselben Bestand.

**Entwurf der Struktur** (Namen stabil über IDs, englische Pluralnamen; Typen nach Datenvertrag Person, Organisation, Ort, Sache):

```
/intel/dossiers/{persons,organizations,locations,things}/<ID>/   dossier.txt, notes.txt, identifiers.txt, links.txt
/intel/cases/<Fall-ID>/                                           Lesesichten des Falls
/intel/geospatial/{pins,zones,sightings}/<ID>.txt
```

**Schreiben (erste Stufe, D3):** ausschließlich das **Anhängen einer Notiz** an ein Dossier: `echo "..." >> /intel/dossiers/.../notes.txt` löst die bestehende Aktion `DOSSIER_NOTIZ` (`{ id, text }`) aus. `>` (Überschreiben), Editor und `rm` auf `notes.txt` sind nicht erlaubt (Notizen sind anhängend). Alles andere (Status, Kennungen, Pins, Zonen, Fälle) bleibt lesend. Weitere Felder folgen einzeln, jeweils mit eigener Aktion, Zugriffsprüfung und Test.

**Grundsatz:** Datei-Operation ist eine Absicht, die in eine validierte Anwendungsaktion übersetzt wird (`dispatch`), `STATE` ändert sich, die Sicht wird neu projiziert. Nie direkt auf `PROFIL`, `localStorage` oder interne Zustandsdateien. Eine gerenderte Textdatei zu bearbeiten und zurückzuparsen ist verlustbehaftet; deshalb sind nur ausgewählte Blattdateien, und nur anhängend, schreibbar.

**Verhältnis zu den Archiv-Exporten:** `lageblatt-PIN-…`, `zone-ZO-…`, `sichtung-…` im Archivordner sind Exportartefakte desselben Datenbestands. `/intel` ist die primäre Sicht; die Archivbrücke bleibt als Host-Ordner. Doppelte Darstellung ist ein Risiko, das bei Paket 2 zu bewerten ist.

## 6. Simulierte Systeminfrastruktur (`sys`)

Standardinhalte (PPP, chatscripts, WireGuard, TLE, `hostname`, `hosts`, `os-release`) kommen aus dem Code. Eigene Änderungen liegen als Overlay im `vfs`; ein Zurücksetzen stellt die Standardwerte wieder her. Dienste lesen ihre Konfiguration über den Provider und prüfen sie gegen ein Schema; eine fehlerhafte Konfiguration führt zur Fehlermeldung des Dienstes wie bei einem echten Daemon. `/run` und die Logs erzeugen die simulierten Dienste, der Benutzer schreibt dort nicht. Nichts startet auf dem Host. Die bestehenden Funktionen bleiben unverändert erhalten; die Einbindung erfolgt schrittweise je Dienst.

## 7. Grenzen zum Host

`terminal_lokal.py`, Archivbrücke und Nmap bleiben. Das Hostdateisystem bleibt gesperrt. Ein Austausch mit dem Host geschieht nur über den Archivordner und den festen Sicherungsordner.

## 8. Entwicklungspakete (größer, praktisch testbar)

1. **Persistentes VFS:** Mount-Tabelle, `vfs`-Provider, Richtlinienstufe, Umleitungen, Dateibefehle, Tab, Editor, `/tmp`-Verhalten, Quoten, Sicherung und Wiederherstellung. Mehrwert: Datei anlegen, Seite neu laden, Datei ist da; Verlust ist wiederherstellbar.
2. **`/intel`:** zuerst lesend mit Zugriffsmatrix, dann Notiz anhängen; `open` und `map` für `/intel`-Pfade. Der Zugriffsteil wird als sicherheitskritisch gesondert abgesichert (eigener Pull Request, eigene Regressionen, eigene Prüfung).
3. **`sys`:** Overlay, Konfiguration beeinflusst Dienste, schrittweise je Dienst.

Vorgehen je Paket: gezielte Zwischentests während der Entwicklung, vollständige CI und unabhängige Prüfung am Integrationsmeilenstein. Bestehende Tests (Sicherheit, `pwd`/`cd`/`ls`) bleiben Regressionsschutz.

## 9. Entscheidungen

| Nr. | Entscheidung | Stand |
|---|---|---|
| D1 | `/tmp` bei Abmeldung leeren, zusätzlich beim nächsten Start ohne saubere Beendigung | entschieden (Master Wayne, 24.11.2026) |
| D2 | Kleiner Editor in Paket 1 | entschieden |
| D3 | `/intel` zuerst nur anhängende Notizen schreibbar, alles andere lesend | entschieden |
| D4 | `/home` getrennt vom Fallpaket, eigenes Sicherungspaket | entschieden (nach Empfehlung) |
| D5 | Archivpfad: bestehenden Pfad `/<Archiv>` vorerst behalten, Alias `/mnt/archive` später nach Bedarf | entschieden (Review #136) |
| D6 | Englische Dateinamen bevorzugt; Quotenwerte werden gemessen, nicht geschätzt; Namen der Sicherungsbefehle | teilweise entschieden (Review #136) |
| D7 | `START_3D.bat` bleibt (wird von `terminal_lokal.py` aufgerufen); Zweitkopie über die Dateibrücke ist der Normalfall | geklärt (Review #136) |

## 9a. Präzisierungen aus dem Architekturreview (verbindlich für Paket 1)

1. **Kein Root-Modell.** Das bestehende `sudo` entsperrt Anwendungsobjekte und ist keine allgemeine Root-Identität. Paket 1 führt keine Root-Rechte im VFS ein. Mountgrenzen und Rechte gelten für beide Pfade von `rename`/`cp`, rekursive Operationen und Mountwurzeln. Über Mountgrenzen hinweg gibt `mv` `EXDEV` (Invalid cross-device link); `cp` hat definierte Semantik (nur lesen aus Quelle, schreiben ins VFS; Quellen mit Anwendungsschutz ausgeschlossen, siehe 11).
2. **Atomarität.** Wurzelknoten, kanonische Pfade und Quotenprüfung liegen in derselben IDB-Transaktion wie die Änderung. Der `/tmp`-Lebenszyklus ist für mehrere Fenster definiert (Leeren nur durch die letzte beendete Sitzung, Sitzungsregister in `meta`).
3. **Umleitung ist eine Shell-Operation.** `stdout` wird von der Anzeige getrennt; Quoting und Fehlercodes werden getestet; keine Hostausführung.
4. **Sicherungen** sind atomar (temporäre Datei, dann Umbenennen), halten mehrere Generationen, werden vor Restore vollständig validiert und überschreiben nie still. Persistenz unter Windows/`file://` ist tatsächlich abzunehmen (Windows-Testpaket).
5. **Vor Paket 2:** `zielZugang` deckt nur Dossiers, Pins und Zonen ab; Fälle, Sichtungen und indirekte Verweise brauchen explizite Regeln. Autorisierung auch nach asynchronem Lesen und vor Anzeige oder Übernahme; strukturierte Herkunftsmetadaten für Scrollback und Tab; Entscheidung zu Kopien und Umleitungen geschützter Daten. `DOSSIER_NOTIZ` existiert, `dispatch` liefert aber keinen dauerhaften Erfolgsstatus: ein Speicherfehler darf nicht als Erfolg gemeldet werden, nötig ist ein validierter Schreibpfad mit Fehler- und Rollbackvertrag.
6. Paket 1 ist ein zusammenhängender Meilenstein mit gezielten Zwischentests und einem Sicherheits- und Restore-Gate vor der Integration.

## 10. Risiken und Ungeprüftes

- Datenverlust bei verlorenem oder nicht mitkopiertem Browserprofil (`profil`); Maßnahmen siehe 4. Das Speicherverhalten von `file:///` unter dem eingesetzten Profil ist nicht gemessen und tatsächlich abzunehmen.
- Neue Top-Level-Verzeichnisse ändern die Wurzelliste und die Golden-Aufnahme (beabsichtigt, additiv).
- Parser-Erweiterung um Umleitungen berührt alle Befehle; Regressionstests nötig.
- Konsistenz der doppelten Darstellung (`/intel` und Archivexporte) ist offen.
- Nicht verifiziert: Verschlüsselung der Passwortschranke, Windows-Verhalten der Sicherung, tatsächliche Quotengrenzen.

## 11. Entscheidung für Paket 1: geschützte Anwendungsdaten und Kopien

Bis zur Entscheidung vor Paket 2 gilt in Paket 1: Inhalte, die der Anwendungsschutz erfasst (Archivdateien mit Namen der Exportobjekte `lageblatt-PIN-…`, `zone-ZO-…`, `sichtung-…`), werden weder per Umleitung noch per `cp` in das VFS übernommen (`Operation not permitted`). Gewöhnliche Archivdateien und simulierte Systemdateien dürfen gelesen und nach `/home` und `/tmp` kopiert werden. Begründung: Eine Kopie überlebt eine spätere Sperre des Dossiers.
