# Paket 4 – Dateiintegration und kontrollierter Export

Stand: 25.11.2026. **Konzeptentwurf, keine Implementierungs- oder Mergefreigabe.** Ergänzt am 25.11.2026 um den Speicher- und Sicherungsvertrag für M4 (§9) nach den Freigaben des Eigentümers zu F3, F4, F5 und zur Löschung; §9 geht in Widerspruchsfällen den älteren Formulierungen in §5 und §8 vor.
Basis: main `e5914d1c7ff257642b7da8bd89c91c03b98f27ab` (Paket 3, #139).
Grundlagen: [Dateisystemarchitektur](terminal-dateisystem-architektur.md), [Paket 2](terminal-intel-konzept.md) (insbesondere E4, E5, E6, E10, §10), [Terminal](terminal.md).
Der Eigentümer hat die Vorbereitung dieses Pakets gebilligt. Die nachfolgenden Detailentscheidungen sind Vorschläge zur Freigabe. Keine Änderung an der laufenden Installation.

## 1. Anlass und verifizierter Ist-Stand

- Main-CI nach #139: [Run 45693390048](https://github.com/hinokop/ShadowTerminal/actions/runs/45693390048), 114/114 grün. Windows-Funktionsabnahme laut Eigentümer weitgehend erfolgreich; Neustartpersistenz und WireGuard-Schlüssel nach Neustart noch nicht abschließend bestätigt. Ein bestätigter Verlust ist ein Fehler von Paket 3, unabhängig von Paket 4.
- Screenshot: `/sendfile /pgcl-eu3.arch07/dossiers/` ergibt File not found; die Datei `/pgcl-eu3.arch07/dossiers/dossier-index.txt` wird anschließend erfolgreich übertragen. Keine zufällige Funkstörung: `terminalArchivDateipfad` verwirft leere Segmente. Isolierte Ausführung der tatsächlichen Funktionen `terminalName`, `terminalArchivDateipfad`, `terminalPppSendfile` mit Brücken-/Timer-Attrappen reproduziert den Unterschied. Ohne abschließenden Schrägstrich und mit notfile-Antwort erscheint Not a file. Kein eigener Windows-/Browser-Lauf.
- `profil-modul.js`: `terminalPppSendfile` (~2577), `terminalKanalTab` (~3970), `terminalArchivDateipfad` (~1358) kennen nur den Archivadapter. Die reguläre Shell kennt bereits `TERMINAL_FS` mit vfs, intel, paket, archiv und wurzel.
- `terminal_lokal.py`: send liest die reale Archivdatei unter den bestehenden Host-Pfadregeln, gibt Name, tatsächlichen Namen und Bytezahl zurück, keine echten Netzwerk-Uploads. Die Upload-Simulation in JS modelliert Slot-Anfrage, gemeinsame Funkrate, Fortschritt, OMEMO-URL, Verbindungsabbruch.
- `karte-modul.js`: `kartenTxtExport` (~704) schreibt über export-txt nach dokumente/ops im Hostarchiv; ohne Brücke Browserdownload. `pinText`, `eigeneZoneText`, `sichtungText` sind bereits gemeinsame parametrierte Renderer für den deutschen Export und die englische INTEL-Sicht. Keine zweite Aufbereitung nötig.
- Der alte dossier-index.txt liegt statisch im Repository; er ist nicht identisch mit dem Live-Index unter /intel/dossiers/index. Paket 2 §10 hat Hostexporte bewusst als Momentaufnahmen belassen; E6 untersagt bislang die dauerhafte Übernahme aus /intel in gewöhnliche VFS-Dateien. Die neue Integration braucht eine ausdrückliche, enge Ausnahme für Versand und kontrollierte Exporte.

## 2. Ziel und Bedienung

**A0 bleibt verbindlich:** keine zusätzlichen Pflichtbefehle, Kennwortabfragen oder künstlichen Wartezeiten für die bisherige Kommunikationskette. Kein Eingriff in laufende PPP-, WireGuard-, PREDICT-, tmux- oder Profanity-Prozesse durch Kartenexporte oder Navigation. Der Benutzer kann nach dem Login direkt senden; kein obligatorischer Zwischenexport.

Beispielbefehle (Sollzustand, noch nicht implementiert):

```sh
/sendfile /intel/dossiers/persons/P-0001/profile
/sendfile /intel/geospatial/pins/PIN-004/record
/sendfile /intel/dossiers/index
/sendfile ~/report.txt
/sendfile /tmp/observation.txt
/sendfile /pgcl-eu3.arch07/dossiers/dossier-index.txt
```

Dossierkennungen sind Beispiele; tatsächliche Verfügbarkeit und Zugriffsschutz gelten. Relative Pfade beziehen sich auf das Arbeitsverzeichnis beim Start von Profanity; ~ bezeichnet /home/raizo. Kein Shell-Globbing, kein Verzeichnisversand, kein ZIP-Zwang. Tab verwendet dieselbe Pfadauflösung. Keine neuen Netzwerkdienste oder realen XMPP-/Tor-Uploads.

## 3. M1/M2 – Gemeinsamer Versandadapter und Pfadauflösung

- Eine gemeinsame, eng definierte Dateioperation für Versand auf Basis von TERMINAL_FS und der Provider-Tabelle (z. B. prepareSend). **Nicht** die bestehenden Schutzprüfungen in readFile/cp/Umleitung aufweichen: der Archivprovider braucht weiterhin eine eigene send-Operation für Binärdateien und geschützte Exportnamen. Existierende Hostregeln (reale Namen, 8.3, keine Reparse-Points/Traversals) beibehalten.
- Ergebnis: kanonischer Pfad, tatsächlicher Dateiname, UTF-8-Bytezahl bzw. echte Binärbytezahl, ggf. Herkunft/Schutzabhängigkeiten; eindeutiger Fehler. Ein konsistenter Schnappschuss zum Versandbeginn, keine wechselnde Bytezahl bei späterer Änderung. Kein Zwang, sämtliche Hostdateien als Text zu lesen.
- Zunächst /home, /tmp, Archiv; /intel nach M3, verwaltete Exporte nach M4. Systembereiche /etc, /usr, /var sowie sonstige Wurzeldateien zunächst nicht als Versandquellen freigeben. Kein administrativer Versand und kein Schlüsselzugriff.
- Datei, Verbindung und Chatfenster weiterhin in der bisherigen Reihenfolge prüfen. Vorhandenes Verzeichnis mit oder ohne / => Not a file; nicht vorhandener Pfad => File not found. Eine Datei mit abschließendem / darf nicht als reguläre Datei gesendet werden. Fehlende Zwischenordner und physische Linkziele nicht durch lexikalisches .. überspringen; nur die vorhandene gemeinsame Pfadsemantik erweitern, kein allgemeiner POSIX-Ausbau.
- Tab und Vorschlag über gemeinsame Listungs-/Sichtbarkeitsregeln; keine alten Treffer aus verspäteten Antworten. Generation, Chatidentität, Eingabestand und aktuelle Berechtigung vor Übernahme prüfen. Leerzeichen/Quotes, case-sensitive VFS und INTEL, bisherige zulässige Archivnamensvarianten abdecken.
- Bestehende Slot-Zeit (2 s), Rate (2400 bit/s), paralleles Rate-Sharing, Größenlimit, OMEMO und LINK END unverändert. Kein done/Link nach LOS oder /quit, auch bei verzögerter Dateiprüfung. Keine zufälligen neuen Fehler. Keine neuen Authentifizierungen während des Versands.

## 4. M3 – INTEL direkt versenden: bewusste Ausnahme von E6

Direktes Senden einer aktuell zugänglichen Blattdatei ist eine ausdrückliche Exportabsicht. Keine implizite Kopie nach /home oder /tmp. Allgemeines cp, Umleitungen und nano bleiben für /intel gesperrt. E10 bleibt bestehen: nur Textansichten, keine echten Beleg-/Galerie-Binärdateien aus /intel.

- Aus einer einzigen gerenderten Antwort des INTEL-Providers Text, Bytezahl, kanonischen Ursprung und Schutzabhängigkeiten übernehmen. Abhängigkeiten von Pfad/Eltern, Datei und sämtlichen enthaltenen Zeilen vereinigen; E4-Fallmaskierung und erlaubte Kennungsverweise unverändert. Zusammengesetzte Indizes als explizite Momentaufnahme der sichtbaren Zeilen; keine verborgenen Einträge oder Namen. Keine ungeschützte generische Zwischendatei.
- Rechte vor und nach asynchronischem Zugriff, bei Slot-Antwort und unmittelbar vor Veröffentlichung des simulierten Dateilinks prüfen; zusätzlich bei Sperrstandsänderung bzw. Upload-Takt abbrechen. Auch alte Abhängigkeiten und gegenwärtige Zuordnung von Pin/Zone/Sichtung prüfen; bei Löschung/Identitätswechsel nicht still auf einen anderen Datensatz umdeuten. Bei Sperre während Upload kein erfolgreicher Abschluss, kein neuer Link. Bereits abgeschlossene Übertragungen sind historisch nicht rückrufbar; kein vorgetäuschter Remote-Löschmechanismus.
- Chat-/Konsoleneinträge und Tab dürfen keine geschützten Namen, Pfade, Inhalte oder nicht abgeschlossenen Links nach Sperre neu preisgeben. Vorhandenen Schutzmechanismus möglichst erweitern, keine zweite unabhängige Berechtigungsdatenbank. Keine echten Nutzdaten an externe Server. Beibehalten des Simulationscharakters.
- Für linkseitige Dateinamen ein eindeutiger Vorschlag aus stabilem Objektbezug und Blattname, z. B. P-0001-profile.txt oder PIN-004-record.txt; /intel selbst bleibt endungslos. Indizes erhalten eindeutig unterscheidbare Namen. Namen enthalten keine Personennamen. Vorschlag zur Freigabe; kein zusätzlicher Eingabeschritt.

## 5. M4 – Kartenexport als verwaltete Momentaufnahme

Live-Daten bleiben unter /intel. Ein Export ist ein bewusst erzeugtes, zeitlich eingefrorenes Dokument; kein automatischer Abgleich und keine Duplikation der Fachobjekte. Der bisherige GUI-Knopf „Als TXT exportieren“ erhält als bevorzugtes Ziel das virtuelle Dateisystem. Bestehende Hostziele und Browserdownload bleiben als ausdrückliche Alternativen. Kein erzwungener Wechsel ins Terminal, keine Änderung von cwd oder Chat.

**Architektur (Freigabe 25.11.2026, Vertrag in §9):** eigener verwalteter, schreibgeschützter Anbieter /exports auf einer eigenen IndexedDB `fieldterminal.exporte`; weder im VFS noch im localStorage, kein beliebig beschreibbarer Ordner in /home. Die Pfade im folgenden Beispiel zeigen die Gliederung; die Dateinamen regelt §9.3. Beispiel:

```text
/exports/
  pins/PIN-004/record.txt
  zones/ZO-007/record.txt
  sightings/P-0001/SI-001/record.txt
```

Alternativ geschützter reservierter Unterbaum in /home/raizo; er würde Kollisions- und Backupfragen mit gewöhnlichen Benutzerdateien aufwerfen. Daher eigener Mount bevorzugt. Kein neuer frei beschreibbarer Exportbereich: Lesen, ls/Tab, expliziter Versand und kontrolliertes Löschen einzelner Exporte; keine freie Bearbeitung, Kopie, Umleitung, Verschiebung oder Entfernung der Schutzmetadaten. Keine allgemeine CLI-Exportverwaltung in diesem Paket; GUI und direkter INTEL-Versand genügen zunächst.

- Eine Momentaufnahme speichert Text, stabile Quell-ID (bei Sichtungen dauerhafte UID), Sprache, Erstellungszeit, Hash und Schutzabhängigkeiten in derselben atomaren Transaktion. Bestehende Renderer wiederverwenden. GUI-Exporte weiterhin Deutsch (E5), /intel und neue Systempfade Englisch, Benutzereingaben unverändert. Alte Hostdateien bytegetreu erhalten.
- Sichtbarkeit und Zugriff nach Variante B. Herkunft bleibt bei nachträglicher Verknüpfung, Sperre oder Löschung wirksam. Aktuelle und ursprüngliche Abhängigkeiten prüfen; fehlende oder nicht eindeutig auflösbare Herkunft führt zur Verweigerung, nicht zum freien Zugriff. Keine Rechtevererbung aus sudo-Verwaltung.
- Bestehender Exportvertrag: identischer Inhalt erzeugt keine neue Version; ersetzter/abweichender Bestand nur nach definierter Bestätigung bzw. neue Version, keine stille Überschreibung. Export-Erfolg erst nach dauerhafter Speicherung; Quota und Speicherfehler melden. Löschen: §9.7; keine automatische Altbestandslöschung.
- Persistenz und Sicherung: siehe §9.2 und §9.8 (eigene Datenbank, bewusst keine Sicherungsabdeckung, dokumentiert). Bestehende Formate 1 bis 3 und die Home-/Etc-Sicherung bleiben unverändert. Export-Momentaufnahmen bestehen über den normalen Neustart.
- Hostexport ist bereits ein bewusstes Verlassen der UI-Schutzgrenze: Windows-Dateien können außerhalb der Anwendung gelesen werden. Keine Behauptung, eine spätere Sperre könne externe Dateien zurückholen. Beibehalten der bestehenden Hostfunktion, nicht automatische Ausweitung auf beliebige Pfade.

## 6. M5 – Archivbestand und Kompatibilität

Inventar der realen Nutzung von /pgcl-eu3.arch07, insbesondere dossiers/dossier-index.txt, kontakte, freigaben, dokumente, ops; unterscheiden zwischen statischen Szenariodateien, echten Nutzerdateien, fachlichen Exporten und nicht mehr genutzten Altbeständen. Empfehlung: Archiv als Hostbrücke erhalten, Live-Index und Live-Kartenansichten bevorzugen; Altindex gegebenenfalls als historisch kennzeichnen. Keine Löschung, Umbenennung oder automatische Migration, kein neuer /mnt/archive-Alias ohne gesonderte Entscheidung. Bestehende open export/exports, VAULT und Hostpfade bleiben nutzbar; eine mögliche Erweiterung auf /exports zunächst als Teil des Konzepts prüfen, keine Umdefinition von VAULT.

## 7. Prüfplan und Abnahme

| Gate | Mindestnachweis |
|---|---|
| A0 | Vollständige bestehende Kette, Standardkonfiguration, keine neuen Pflichtaktionen; Chat und tmux/PREDICT bleiben bei GUI-Export aktiv. |
| M1/M2 | echte Archivbrücke (inkl. Verzeichnis mit /, Binärdatei, Fehler), VFS mit/ohne Brücke, relative/absolute Pfade, ~/Quotes/Tab, fehlende Zwischenordner, Größe in UTF-8, parallele Uploads, LOS/quit und verzögerte Antwort. |
| M3 | Direkter Versand von Profil, Index, Kartenrecord und Falltext; gesperrte Objekte, Links/Indizes/Fallmaskierung, Sperre während Lesen, Slot und Upload; keine URL bei Verweigerung; keine Lockerung von cp/Umleitung; kein Zugriff auf private Schlüssel. |
| M4 | Pin, Zone, Sichtung: gleicher Renderer, deutsche Momentaufnahme und englische Live-Sicht, identischer Inhalt/Versionierung, Lock nach Export/Relink/Löschung, keine generische Kopie/Backup-Leckage, Fehler/Quota/Rollback, Neustart. Hostexport-Regressionsfixtures weiterhin grün. |
| M5 | Inventar mit Nutzung und Vorschlag; keinerlei Nutzerdaten gelöscht, alte Befehle weiter verfügbar. |

Neue gezielte Tests auf realer Brücke und Browser, mit kontrollierter Uhr; bestehende terminal-profanity-sendfile, terminal-intel-schutz, terminal-intel-export, terminal-vfs-sicherung, terminal-sys-review und Linkketten weiter grün. Vollständige Standard-CI vor Merge. Windows-Testpaket mit realer Bedienung und Neustart nach Freigabe. Paket-3-Neustartprüfung getrennt protokollieren: vorhandenes Home-Testfile, /etc und öffentlicher WG-Schlüssel vor/nach vollständigem Neustart im selben Profil/Installationspfad; keinen privaten Schlüssel ausgeben oder teilen. Bei bestätigtem Verlust zuerst Fehleranalyse, keine Migration auf Verdacht.

## 8. Entscheidungen und Arbeitsmodus

| Nr. | Empfehlung (noch zur Freigabe) |
|---|---|
| F1 | Direkter Versand aus /home, /tmp, /intel und bestehendem Archiv; keine Pflichtkopie, keine Systemdateien. |
| F2 | Kontrollierte Ausnahme von E6 nur für den expliziten Versand bzw. verwalteten Export, keine allgemeinen Kopien. |
| F3 | **Freigegeben (25.11.):** schreibgeschützter Anbieter /exports auf eigener IndexedDB `fieldterminal.exporte` (§9); bevorzugtes Kartenexportziel; Deutsch für GUI-Export, Englisch für neue Pfade; Hostziele bleiben. |
| F4 | Schutzabhängigkeiten und Byte-Snapshot; Sperre bricht noch nicht abgeschlossenen Versand ab. Bereits abgeschlossene Simulation nicht rückrufbar. **Freigegeben (25.11.):** auch der Chatverlauf trägt Schutzabhängigkeiten; betroffene Einträge werden bei Sperre entfernt wie im Shell-Verlauf (§9.10, M3). |
| F5 | **Freigegeben (25.11.):** Vertrag in §9; vorerst keine Sicherungsabdeckung der Exporte, ausdrücklich akzeptiert und zu dokumentieren; bestehende Home-/Etc-Backups bleiben unverändert. |
| F6 | Archiv erhalten, Altbestände inventarisieren, keine Löschung/Migration in diesem Paket. |
| F7 | Keine Änderung der Funk-/Verbindungszeiten, keine zusätzlichen Pflichtaktionen; Neustartabnahme Paket 3 bleibt unabhängig. |

Empfohlen: ein zusammenhängender Draft-PR nach Konzeptfreigabe; gezielte Meilensteintests, volle CI, unabhängiges Review. Kein eigenständiger PR je Shell-Detail. M1/M2 und M3 dürfen vorbereitet werden, ohne auf die Export-Speicherentscheidung zu warten; M4 erst nach deren Freigabe. Keine Implementation, Veröffentlichung eines Builds oder Merge aus diesem Entwurf heraus. Laufende Windows-Installation bleibt unangetastet.

## 9. Speicher- und Sicherungsvertrag für M4 (Verwaltete Exporte)

Freigegeben vom Eigentümer am 25.11.2026 (einschließlich D1 bis D3, §9.11): separate IndexedDB `fieldterminal.exporte`, Löschen per GUI und `rm` über eine gemeinsame validierte Aktion, Behandlung des Chatverlaufs, vorläufige Grenzen, bewusst fehlende Sicherungsabdeckung (dokumentiert). Die Abschnitte 9.1 bis 9.9 gelten für M4; 9.10 regelt den Chatverlauf für M3. **Keine Implementierung vor Freigabe dieses Vertrags.**

### 9.1 Grundsätze

- Ein Export ist eine unveränderliche Momentaufnahme. Es gibt kein Überschreiben, keine Bearbeitung und keine Kopie; Änderung nur durch Neuanlage, Entfernen nur durch Löschen (§9.7).
- Der Speicher ist von VFS, Profil (localStorage), Home-Sicherung und Fallpaket getrennt. Das VFS-Schema, die VFS-Zähler und die Formate 1 bis 3 bleiben unverändert.
- Zugriff nach Variante B: Maßgeblich sind die **ursprünglichen und die aktuellen** Schutzabhängigkeiten (§9.4). Eine spätere Änderung der Verknüpfung gibt nie einen älteren Inhalt frei.
- Gesperrte oder nicht auflösbare Exporte sind für Listen, Tab, Lesen, Versand und Löschen **nicht vorhanden** (§9.5). Das Löschen eröffnet keinen Kanal, der über das Lesen hinausgeht.
- A0: Die Datenbank wird lazy beim ersten Zugriff auf `/exports` oder beim ersten GUI-Export geöffnet. Anmeldung, PPP, WireGuard, PREDICT, tmux und Profanity warten nie auf sie; ein Fehler beim Öffnen bleibt auf `/exports` und den Export begrenzt.

### 9.2 Speicher

Datenbank `fieldterminal.exporte`, Version 1, zwei Objektspeicher:

| Speicher | Inhalt |
|---|---|
| `exporte` | Schlüssel `id` (16 Hex-Zeichen aus `crypto.getRandomValues`, nie wiederverwendet); Indizes `quelle` (`art` + `qid`) und `erstellt` |
| `meta` | `zaehler`: `{ n, bytes }` für den Gesamtbestand |

Datensatz (unveränderlich nach dem Anlegen):

| Feld | Bedeutung |
|---|---|
| `id`, `name` | interne Kennung; Dateiname nach §9.3 |
| `art`, `qid` | `pin`, `zone` oder `sichtung`; Kennung des Objekts (`PIN-004`, `ZO-007`, `SI-001`) |
| `dossier` | nur Sichtung: Kennung des Dossiers |
| `identitaet` | Pin und Zone: Anlegezeit des Objekts (`t`); Sichtung: dauerhafte UID. Dient der Erkennung von Löschung und Identitätswechsel |
| `ursprung` | Liste der Schutzabhängigkeiten **zum Zeitpunkt des Exports**, im Format der Abhängigkeiten von `/intel` (`{art:'dossier', id}`; bei Sichtung zusätzlich `{art:'sichtung', dossier, id}`) |
| `sprache` | `de` (E5) |
| `erstellt` | Zeit in ms |
| `bytes`, `sha256` | UTF-8-Bytezahl und Prüfsumme des Textes |
| `text` | der gerenderte Text (gleicher Renderer wie Hostexport und `/intel`) |

Zähler und Grenzen (vorläufig, freigegeben): **1.000 Exporte, 16 MiB insgesamt, 64 KiB je Export** (UTF-8-Bytes des Textes; der Hostexport hat dieselbe Grenze je Datei). Die Grenzen stehen als eine Konstante `EXPORT_GRENZE`. Alle Datensätze zählen, auch gesperrte und verwaiste. Prüfung, Duplikatprüfung (§9.6), Anlegen und Zählerfortschreibung laufen in **einer** readwrite-Transaktion; das ist der einzige Schutz gegen gleichzeitige Fenster. Beim Öffnen wird der Zähler gegen den Bestand geprüft und bei Abweichung neu berechnet. Es gibt **keine automatische Löschung**: Bei erschöpftem Speicher schlägt der Export atomar fehl.

### 9.3 Pfade und Namen

```text
/exports/pins/PIN-004/<UTC-Zeit>.txt              Beispiel: 20261125T101500Z.txt
/exports/zones/ZO-007/<UTC-Zeit>.txt
/exports/sightings/P-0001/SI-001/<UTC-Zeit>.txt
```

- Verzeichnisse sind virtuell: Sie existieren, solange mindestens ein **zugänglicher** Export darunter liegt.
- Der Dateiname enthält die Erstellungszeit und keine laufende Versionsnummer. Eine Nummer ließe über Lücken erkennen, dass eine gesperrte Version existiert (`-v2` ohne `-v1`). Das ersetzt den Beispielnamen `record.txt` aus §5; die Zeit macht die Namen außerdem nicht erratbar. Bei gleicher Sekunde und verschiedenem Inhalt wird `-2` angehängt.
- Der Name erscheint in Chat, Konsole und Link nur zusammen mit den Kennungen, nie mit Personennamen (§4).

### 9.4 Herkunft und Zugriffsregel

Abhängigkeiten sind heute einfach: Pin, Zone und Sichtung hängen an **einem** Dossier (`pinGesperrt`, `zoneGesperrt`, Dossier der Sichtung); gesperrt ist, was in `PROFIL.gesperrt` steht.

- `ursprung` wird beim Anlegen aus dem damaligen Zustand des Objekts gebildet.
- **Aktuelle** Abhängigkeiten werden bei jedem Zugriff aus dem heutigen Objekt abgeleitet und über dieselbe Funktion geprüft wie bei `/intel` (`INTEL.gesperrt`). Es gibt keine zweite Berechtigungsdatenbank.

Zustand eines Exports, in dieser Reihenfolge ausgewertet:

| Zustand | Bedingung |
|---|---|
| gesperrt | mindestens eine Abhängigkeit aus `ursprung` **oder** die aktuelle Abhängigkeit des Objekts ist gesperrt |
| verwaist | nicht gesperrt, aber das Objekt ist nicht auflösbar (gelöscht) oder die Identität stimmt nicht mehr (`identitaet`), sodass die aktuelle Verknüpfung nicht eindeutig feststeht |
| zugänglich | keines von beidem |

Folgen: Wird ein Objekt nachträglich mit einem gesperrten Dossier verknüpft, sperrt das den Export (aktuell). Wird die Verknüpfung gelöst, bleibt er gesperrt, solange das ursprüngliche Dossier gesperrt ist. Wird ein Objekt gelöscht und seine Kennung später für ein anderes Objekt vergeben, wird der Export nicht auf das neue Objekt umgedeutet (verwaist). `sudo open` hebt die Sperre wie bisher am Dossier auf; ein eigener Zugang für Exporte entsteht nicht (keine Rechtevererbung aus der Systemverwaltung).

Verwaiste Exporte gelten für alle Zugriffe als nicht vorhanden. Die Annahme, dass ein gesperrtes Objekt in der Oberfläche nicht gelöscht werden kann, ist vor der Implementierung im Code zu bestätigen (§9.11); der Vertrag stützt sich nicht darauf, weil verwaiste Exporte ohnehin unzugänglich bleiben.

### 9.5 Antworten des Anbieters

Für **alle** nicht zugänglichen Zustände (gesperrt, verwaist) und für Pfade ohne Export ist die Antwort identisch: `No such file or directory`. Das weicht bewusst von `/intel` ab, wo ein gesperrtes Objekt bei direktem Zugriff `Permission denied` ergibt. Begründung: Bei `/intel` verrät die Antwort die Existenz eines Objekts, dessen Kennung ohnehin sichtbar sein darf (E4). Bei Exporten würde sie die Existenz einer Datei verraten, und mit der Anforderung, dass Löschen keinen zusätzlichen Kanal öffnet, ist die einheitliche Antwort die einzige, die ohne Sonderfälle auskommt.

| Zugriff | zugänglich | gesperrt, verwaist oder ohne Export |
|---|---|---|
| `ls`, Tab, `cd` | Eintrag sichtbar | Eintrag fehlt; Verzeichnis ohne zugängliche Einträge existiert nicht |
| `cat`, `head`, `tail`, `/sendfile` | Text | `No such file or directory` |
| `rm <datei>` | löscht genau diese Datei | `rm: cannot remove '<pfad>': No such file or directory` |
| `cp`, `mv`, `>`, `nano`, `touch`, `mkdir`, `rm -r` | `Read-only file system` bzw. `Operation not permitted` | gleiche Meldung, unabhängig vom Bestand |
| `ls -l` | Modus `-r--r--r--`, Eigentümer `root`, Größe aus `bytes`, Zeit aus `erstellt` | Eintrag fehlt |

Lesen und Versand liefern die Abhängigkeiten (`deps`) in der Form von `/intel`, damit der vorhandene Schutz des Shell-Verlaufs (`terminalSchutzBereinigen`) und der Chat-Schutz (§9.10) ohne weitere Mechanik greifen. Die Prüfsumme wird beim Lesen und Senden geprüft; bei Abweichung `Input/output error`, ohne automatische Löschung.

### 9.6 Anlegen (GUI „Als TXT exportieren“)

1. Zugang zum Objekt wie bisher prüfen (Objekt vorhanden, Dossier nicht gesperrt); der Text wird mit dem bestehenden Renderer erzeugt (Deutsch).
2. Eine Transaktion: Grenzen prüfen; unter den **zugänglichen** Exporten desselben Objekts nach gleicher `sha256` suchen.
3. Gleicher Inhalt: kein neuer Datensatz, Meldung „unverändert“ mit dem vorhandenen Namen. Andere Inhalte: neuer Datensatz; ältere bleiben bis zum Löschen. Es gibt kein stilles Überschreiben und keine Bestätigungsabfrage für Neuversionen.
4. Die Duplikatprüfung sieht gesperrte und verwaiste Versionen nicht. Sonst würde „unverändert“ verraten, dass eine verborgene Version mit gleichem Inhalt existiert.
5. Erfolg wird erst nach dem Abschluss der Transaktion gemeldet. Fehlermeldungen (deutsch, ohne Zählerstände): „Export nicht gespeichert. Speichergrenze erreicht.“, „… Export zu groß (maximal 64 KiB).“, „… Browserspeicher voll.“; bei jedem Fehler bleibt der Bestand unverändert.
6. Es gibt keinen Vermerk in `PROFIL.exporte` für diese Exporte; Duplikat- und Versionsverwaltung liegen vollständig in der Datenbank, deshalb gibt es keine Konsistenzfrage zwischen zwei Speichern. Die bestehenden Hostexport-Vermerke bleiben unverändert.
7. Die Hostziele und der Browserdownload bleiben als ausdrückliche Alternativen. Das Bestätigungsfenster nennt den Speicherort `/exports` und den Hinweis aus §9.8. Der Export ändert weder Arbeitsverzeichnis noch Chat und berührt keinen laufenden Prozess.
8. Protokolleintrag wie bei den Dossiernotizen (Art und Kennung, kein Inhalt).

### 9.7 Löschen

- **Eine** validierte Aktion `exportLoeschen(ids)` für GUI und `rm`. Sie prüft **innerhalb der Löschtransaktion** für jede Kennung noch einmal den Zustand (§9.4); nur zugängliche Exporte werden gelöscht. Danach Zähler fortschreiben und protokollieren (Art, Kennung, Anzahl; kein Inhalt). Fehler bei der Speicherung werden gemeldet, der Bestand bleibt unverändert.
- **Terminal:** `rm <datei>` genau einer Exportdatei, ohne `-r`; `-f` unterdrückt wie üblich nur die Meldung für fehlende Dateien. Verzeichnisse, mehrere Quellen mit Wildcards, `mv`, `cp` und Umleitung bleiben verboten. Die Antworten stehen in §9.5; `rm` auf Unzugängliches ist von `rm` auf Nichtvorhandenes nicht zu unterscheiden.
- **GUI:** An der Karteninfo eines zugänglichen Objekts erscheint neben „Als TXT exportieren“ der Knopf „Exporte löschen (n)“, solange mindestens ein zugänglicher Export existiert. Das Bestätigungsfenster nennt die Zahl der **zugänglichen** Exporte dieses Objekts; gelöscht werden diese.
- **Gesperrte Exporte** lassen sich erst löschen, wenn sie wieder zugänglich sind (Entsperren am Dossier). Ein gesperrtes Objekt ist in der Oberfläche ohnehin gesperrt, sodass der Knopf dort nicht erscheint.
- **Verwaiste Exporte** sind einzeln nicht ansprechbar. Damit sie den Speicher nicht dauerhaft belegen, gibt es eine GUI-Sammelbereinigung (Bestätigung, Meldung nur mit der Anzahl, keine Namen). Sie wirkt auf den ganzen Bestand an verwaisten Exporten und meldet keine Zustände einzelner Pfade. Zur Entscheidung vorgelegt (§9.11, D1).

### 9.8 Sicherung, Neustart, Datenverlust (bewusst und dokumentiert)

- Exporte sind **nicht** Teil der Profilsicherung, des Profilexports, des Fallpakets, des Arbeitsstands, von `home-backup`, `home-export` und `home-restore` (Formate 1 bis 3 unverändert). Es gibt keine Sicherungsabdeckung.
- Sie bleiben über den normalen Neustart im selben Browserprofil (Ordner `profil` neben dem Starter) bestehen. Verloren gehen sie mit dem Löschen dieses Ordners, einer neuen Installation oder einem anderen Browserprofil sowie bei einer Löschung der Browserdaten.
- Ein Profilimport auf einem anderen Rechner bringt die Dossiers, Pins, Zonen und Sichtungen mit, aber keine Exporte. Das beschädigt nichts; Exporte lassen sich neu erstellen.
- Dauerhafte Außenkopien bleiben über den bestehenden Hostexport möglich (verlässt die Schutzgrenze der Oberfläche, §5, letzter Punkt).
- Dokumentation: `docs/datenvertrag.md` (neue Datenbank, Felder, Grenzen, keine Sicherung), `docs/terminal.md` und ein Satz im Bestätigungsfenster des Exports. Eine eigene Sicherung folgt erst nach einem herkunftserhaltenden Vertrag, der Herkunft, Sperrzustand und Prüfsummen einschließt und die Formate 1 bis 3 nicht bricht.

### 9.9 Restkanäle (ehrlich benannt)

- Beim Anlegen verrät die Meldung „Speichergrenze erreicht“, dass der Gesamtbestand voll ist; die Differenz zum Sichtbaren erlaubt einen Rückschluss auf verborgene Exporte. Die Meldungen enthalten keine Zählerstände, und `/exports` zeigt keinen Zähler; der Rückschluss bleibt möglich und wird akzeptiert.
- Die Existenz eines Exports lässt sich ohne Kenntnis des Zeitstempels im Namen nicht erraten; sie lässt sich nicht über Unterschiede der Antworten erfragen (§9.5).
- Bereits übertragene Dateien (Chat) bleiben historisch erfolgt (§4).

### 9.10 Chatverlauf (M3, Freigabe F4)

Die Zeilen von `fenster.log` erhalten wie der Shell-Verlauf optional Schutzabhängigkeiten (`deps`). Zeilen mit Abhängigkeiten, die inzwischen gesperrt sind, werden **entfernt** (nicht nur ausgeblendet), also auch der Fortschritt, der Dateiname und der Dateilink. Die Prüfung läuft beim Sperrstandswechsel und im Upload-Takt (§4). Die Semantik entspricht dem Shell-Verlauf, es gibt keine Wiederkehr nach dem Entsperren. Bereits abgeschlossene Übertragungen bleiben historisch erfolgt.

### 9.11 Annahmen und offene Punkte

- Zu bestätigen vor der Implementierung: (a) Pin und Zone tragen ein stabiles Anlegedatum (`t` bei Pin; für Zonen noch nicht geprüft), sonst ist die Identität über ein anderes Feld zu sichern; (b) ob die Oberfläche das Löschen gesperrter Pins und Zonen verhindert; (c) Verhalten der IndexedDB im Edge-Anwendungsfenster unter `file://` bei vollem Speicher (`QuotaExceededError`).
- **D1 (entschieden 25.11.2026):** GUI-Sammelbereinigung der verwaisten Exporte mit Bestätigung und Meldung nur der Anzahl (§9.7).
- **D2 (entschieden 25.11.2026):** einheitliche Antwort `No such file or directory` für alle unzugänglichen Zustände (§9.5); strenger als `/intel` und ohne Sonderfälle.
- **D3 (entschieden 25.11.2026):** Dateinamen mit UTC-Zeitstempel, keine laufende Versionsnummer (§9.3).

### 9.12 Mindestnachweis M4 (ergänzt §7)

Gezielte Tests auf Browser, mit kontrollierter Uhr:

1. Anlegen, Wiederholung ohne Änderung (unverändert), Änderung (neue Version), Obergrenzen (1.000 Exporte, 16 MiB, 64 KiB), Speicherfehler und Abbruch ohne Teilbestand; zwei Fenster gleichzeitig am Limit.
2. Zustände: Verknüpfung nach dem Export mit einem gesperrten Dossier, Lösen der Verknüpfung bei gesperrtem Ursprung, Löschung des Objekts, Kennung neu für ein anderes Objekt; jeweils Liste, Tab, `cat`, `/sendfile`, `rm`, Tabverlauf. Antworten für gesperrt, verwaist und nicht vorhanden sind identisch.
3. Duplikatprüfung sieht verborgene Versionen nicht; keine Lücken in Namen.
4. Löschen: gemeinsame Aktion, GUI und `rm`, Prüfung innerhalb der Transaktion, Löschen nach Sperrwechsel zwischen Klick und Ausführung, Sammelbereinigung (nur Anzahl).
5. Verfügbarkeit: Fehler beim Öffnen der Datenbank beeinträchtigt A0 (PPP, WireGuard, PREDICT, tmux, Profanity) nicht; Neustart (Seite neu laden) behält Exporte; Hostexport-Regressionstests bleiben grün.
6. Sicherung: `home-backup`, `home-export`, Profilexport und Fallpaket enthalten keine Exporttexte (Stichprobe auf einen eindeutigen Text); `terminal-vfs-sicherung` unverändert grün.
