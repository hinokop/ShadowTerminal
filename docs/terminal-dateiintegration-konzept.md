# Paket 4 – Dateiintegration und kontrollierter Export

Stand: 25.11.2026. **Konzeptentwurf, keine Implementierungs- oder Mergefreigabe.**
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

**Empfehlung zur Architektur (zu bestätigen):** eigener verwalteter Mount /exports, VFS-gestützt, nicht ein beliebig beschreibbarer Ordner in /home. Beispiel:

```text
/exports/
  pins/PIN-004/record.txt
  zones/ZO-007/record.txt
  sightings/P-0001/SI-001/record.txt
```

Alternativ geschützter reservierter Unterbaum in /home/raizo; er würde Kollisions- und Backupfragen mit gewöhnlichen Benutzerdateien aufwerfen. Daher eigener Mount bevorzugt. Kein neuer frei beschreibbarer Exportbereich: Lesen, ls/Tab, expliziter Versand und kontrolliertes Löschen einzelner Exporte; keine freie Bearbeitung, Kopie, Umleitung, Verschiebung oder Entfernung der Schutzmetadaten. Keine allgemeine CLI-Exportverwaltung in diesem Paket; GUI und direkter INTEL-Versand genügen zunächst.

- Eine Momentaufnahme speichert Text, stabile Quell-ID (bei Sichtungen dauerhafte UID), Sprache, Erstellungszeit, Hash und Schutzabhängigkeiten in derselben atomaren Transaktion. Bestehende Renderer wiederverwenden. GUI-Exporte weiterhin Deutsch (E5), /intel und neue Systempfade Englisch, Benutzereingaben unverändert. Alte Hostdateien bytegetreu erhalten.
- Sichtbarkeit und Zugriff nach Variante B. Herkunft bleibt bei nachträglicher Verknüpfung, Sperre oder Löschung wirksam. Aktuelle und ursprüngliche Abhängigkeiten prüfen; fehlende oder nicht eindeutig auflösbare Herkunft führt zur Verweigerung, nicht zum freien Zugriff. Keine Rechtevererbung aus sudo-Verwaltung.
- Bestehender Exportvertrag: identischer Inhalt erzeugt keine neue Version; ersetzter/abweichender Bestand nur nach definierter Bestätigung bzw. neue Version, keine stille Überschreibung. Export-Erfolg erst nach dauerhafter Speicherung; Quota und Speicherfehler melden. Eine separate, kontrollierte Löschung ist zulässig; keine automatische Altbestandslöschung.
- Persistenz/Backup ist vor M4 festzulegen: gewöhnliches home-export darf keine geschützten Exporttexte über eine Herkunfts-freie JSON-Kopie offenlegen. Empfehlung: verwaltete Exporte getrennt von gewöhnlichen Home-Paketen halten, zunächst bewusst nicht in deren Export/Restore aufnehmen; separate Sicherung erst nach überprüfbarem, herkunftserhaltendem Vertrag. Vor Implementierung muss geklärt sein, ob vorhandene VFS-Backup-Infrastruktur hierfür sicher erweitert werden kann, ohne bestehende Formate 1–3 zu brechen. Export-Momentaufnahmen müssen über normalen Neustart bestehen bleiben; fehlende Sicherungsabdeckung transparent dokumentieren. Keine Änderung an bestehender Home-/Etc-Sicherung in M1–M3.
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
| F3 | Eigener verwalteter /exports-Mount als bevorzugtes Kartenexportziel; Deutsch für GUI-Export, Englisch für neue Pfade; Hostziele bleiben. |
| F4 | Schutzabhängigkeiten und Byte-Snapshot; Sperre bricht noch nicht abgeschlossenen Versand ab. Bereits abgeschlossene Simulation nicht rückrufbar. |
| F5 | Export-Persistenz und Backup-Abgrenzung vor M4 konkretisieren; bestehende Home-/Etc-Backups nicht still erweitern. |
| F6 | Archiv erhalten, Altbestände inventarisieren, keine Löschung/Migration in diesem Paket. |
| F7 | Keine Änderung der Funk-/Verbindungszeiten, keine zusätzlichen Pflichtaktionen; Neustartabnahme Paket 3 bleibt unabhängig. |

Empfohlen: ein zusammenhängender Draft-PR nach Konzeptfreigabe; gezielte Meilensteintests, volle CI, unabhängiges Review. Kein eigenständiger PR je Shell-Detail. M1/M2 und M3 dürfen vorbereitet werden, ohne auf die Export-Speicherentscheidung zu warten; M4 erst nach deren Freigabe. Keine Implementation, Veröffentlichung eines Builds oder Merge aus diesem Entwurf heraus. Laufende Windows-Installation bleibt unangetastet.
