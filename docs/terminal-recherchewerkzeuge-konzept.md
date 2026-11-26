# Paket 5 – Recherchewerkzeuge und begrenzte Shell-Pipelines

Stand 26.11.2026. **Konzept-Draft, Implementierung erst nach Abschluss von #140 und Abgleich mit dem dann aktuellen main.** Eigentümer hat die Richtung und die anschließende Entwicklungspause beschlossen. Detailumfang nachfolgend als Arbeitsauftrag; technische Abweichungen vor Umsetzung transparent abstimmen.

## 0. Reihenfolge und Ziel

Paket 4 (#140, zuletzt c4eb51a) ist in normaler Windows-Nutzung erfolgreich getestet; Abschlussreview 6066662192 enthält noch Korrekturen. Dieser separate PR ist ausschließlich Vorbereitung, basiert bewusst auf dem bereits gemergten main e5914d1 und darf Paket 4 weder überholen noch verändern. Nach Merge von #140 den Konzeptbranch auf den tatsächlichen main-Stand aktualisieren; keine parallele Implementierung auf einem veralteten Providerstand. Claude implementiert, ChatGPT prüft unabhängig, Eigentümer nimmt Windows ab und entscheidet über Merge.

Paket 5 ist der vorläufig letzte Terminal-Entwicklungsabschnitt. Danach mehrere Tage tatsächliche Recherche, Bedienung und Beobachtung großer Datenbestände durch den Eigentümer. Keine automatische Fortsetzung mit Paket 6, keine Kartenänderungen in diesem PR. Erkenntnisse aus der Praxis bilden die Grundlage einer späteren, eigenständigen Kartenetappe. Kritische Datenverlust-/Funktionsfehler separat behandeln; keine Erweiterungsspirale.

Ziel: vorhandene Dateien und Live-Recherchebestände effizient durchsuchen, selektieren, kombinieren und auswerten. Keine neue Datenquelle oder parallele Wahrheit. Bestehende Kommunikationskette A0 unverändert, auch bei laufendem PREDICT/tmux/plog und PPP/WireGuard/Profanity.

## 1. Referenzen und Ist-Stand

- docs/terminal-dateisystem-architektur.md: Pipes ausdrücklich aus Paket 1 ausgeklammert; stdout/stderr/Status bereits getrennt. Schutzregeln §9 und §11.
- docs/terminal-intel-konzept.md: E4 (Fall-Sichtbarkeit), E6 (keine gewöhnlichen Kopien von INTEL), E12 (grep/find bewusst zurückgestellt).
- docs/terminal-dateiintegration-konzept.md: Paket 4, verwaltete Exporte und Herkunft, D1–D3; abschließenden Stand nach #140 maßgeblich verwenden.
- docs/terminal.md: tatsächlicher Befehlsumfang, GNU-coreutils-9.4-Orientierung, Locale en_US.UTF-8, aktuelle Umleitungsgrenzen.
- profil-modul.js: terminalZerlegen, terminalBefehlLauf, terminalSchutzFiltern, TERMINAL_FS, Anbieter, Befehlsregistrierung, Tab.
- terminal-dateibefehle.js: terminalLeser, terminalUmgeleitet, Herkunftsprüfung, Quoten und atomare Zielschreiboperation.
- INTEL und EXPORTE: Live-Ansichten bzw. gespeicherte Momentaufnahmen; ursprüngliche und aktuelle Schutzabhängigkeiten nicht verlieren.

Vor Codeänderung kurze Matrix der tatsächlich verwendbaren Provider-Operationen und strukturierten Resultate erstellen. Insbesondere finalen Schutzvertrag aus #140 überprüfen. Keine eigene erneute Shell-/Dateisystemarchitektur.

## 2. Beispielbefehle – gewünschte praktische Nutzung

Sämtliche folgenden Beispiele sind **Sollzustand**, noch nicht als implementiert ausgeben. Kennungen müssen im konkreten Profil existieren.

```sh
grep -ri "Berlin" /intel/dossiers
grep -in "observation" /intel/dossiers/persons/P-0001/notes
grep -rl "Berlin" /intel/geospatial
find /exports -name "*.txt"
find /intel/dossiers -type f -name profile
find ~/projects -type f -name "*.txt"
cat /intel/dossiers/index | grep PERSON
ls /exports/pins | wc -l
grep -ri "Berlin" /intel/dossiers | head -n 10
cat ~/report.txt | sort | uniq -c
grep -i "berlin" ~/report.txt > ~/matches.txt
sha256sum ~/report.txt
```

Der letzte Befehl ist optionaler, kleiner Abschlussbaustein (M4). Keine Zwischenkopie für INTEL-Recherche. Geschützte Daten dürfen durch Pipes verarbeitet und auf dem Bildschirm ausgegeben werden, aber nicht als ungeschützte Datei gespeichert werden. Beispiel, das abgewiesen werden muss, ohne das Ziel zu verändern:

```sh
grep -ri "Berlin" /intel/dossiers | head -n 5 > ~/matches.txt
find /exports -name "*.txt" | wc -l > ~/count.txt
```

Das gilt auch bei null Treffern, reinen Zahlen, Hashes und beliebiger Verschachtelung der erlaubten Stufen.

## 3. M1 – Suche

**grep:** Textsuche in expliziten Dateien und rekursiv in Verzeichnissen, auch in /intel, /exports und neutralen lesbaren Archivdateien. Mindestoptionen -i, -n, -r, -l, -v, -c, -F, -E, -e, -h/-H und --; kombinierte Kurzoptionen wie -ri. Ohne Datei aus Pipeline-stdin lesen. Ein Suchmuster, wiederholte -e nur falls ohne Mehraufwand. Basismuster und unterstützte Regex-Syntax dokumentieren: keine Behauptung vollständiger GNU BRE/ERE-Übereinstimmung. Nicht unterstützte Optionen/Muster klar abweisen. Regex-Laufzeit begrenzen (kein ungebremstes JS-RegExp über beliebig große Benutzerdaten im UI-Thread). Ungültiges Muster => Fehler. Status 0 Treffer, 1 keine Treffer, 2 Fehler. Bei mehreren Dateien sinnvolle GNU-artige Pfadpräfixe. -c zählt passende Zeilen, -l nennt passende Dateien, nicht jede Trefferzeile. Kein stilles Umdeuten von Binärdaten zu Text.

**find:** Startpfad (optional .), -name, -iname, -type f/d/l, -maxdepth, -mindepth, -print, einfache UND-Verknüpfung. Quoted glob als Namensmuster (nicht globale Shell-Expansion). Standardmäßig keine rekursive Verfolgung symbolischer Links, aber explizite Startpfade nach dokumentiertem Vertrag; keine Endlosschleifen im INTEL-Verweisgraphen. Keine -exec/-delete, keine hostseitige Befehlsausführung, keine komplexe Ausdruckssprache in diesem Paket. Treffer nur aus zugänglichen Einträgen. Fehlende/gesperrte Pfade gemäß jeweiligem Providervertrag; kein Fehler pro verborgenem Kind.

Scope: /home, /tmp, /intel, /exports, Archiv über bestehende Brücke; normale lesbare simulierte Systemdateien nur unter bestehenden Benutzerrechten, keine privaten Schlüssel, kein sudo für neue Befehle. Archive ohne Brücke melden bekannten Fehler; übrige Anbieter bleiben nutzbar. Keine neuen Python-Endpunkte für rekursives Durchsuchen des Hosts. Neutrale Hostdateien ausschließlich innerhalb der bestehenden Archivgrenze und mit deren tatsächlichen Namen/Pfadregeln. Geschützte Hostexporte nur soweit die endgültige bestehende Lese-/Sichtbarkeitspolitik dies zulässt; keine Umgehung durch Alias, Kurzname oder andere Operation. Keine Beschädigung der bestehenden Dateibefehle.

## 4. M2 – begrenzte Pipes und Filter

Ein einzelnes | verbindet stdout einer freigegebenen Stufe mit stdin der nächsten; | innerhalb von Quotes bleibt Text. &&, ||, ; behalten ihre bisherige Bedeutung und binden schwächer als |. Status der letzten Stufe (kein pipefail); stderr separat und nicht in die nächste Stufe eingespeist. Kein echo-artiges Zwischenanzeigen von stdout. Eine Pipeline ist ein begrenzter gepufferter In-Memory-Datenfluss, kein echtes POSIX-Prozessmodell. Leeres stdout ist gültig; Syntaxfehler vor Ausführung und vor Zielmutation. Kein Host-Shell-Exec.

Freigegebene Stufen: ls, cat, head, tail, echo, pwd, grep, find, wc, sort, uniq, optional sha256sum. Weitere nur nach begründetem Bedarf, keine schreibenden, interaktiven oder langlebigen Befehle. pon, wg-quick, profanity, tmux, predict, nmap, sudo, nano, rm/mv/cp etc. nicht in Pipelines. Vorab ganze Pipeline validieren. Bereits funktionierende standalone-Aufrufe und &&-Kommunikationsketten unverändert.

Filterumfang:
- head/tail: bisherige Dateioptionen plus stdin, insbesondere -n N.
- wc: -l, -w, -c (Zeilen, Wörter, UTF-8-Bytes), Standardausgabe in üblichen Spalten; stdin und Dateioperand, kein erfundener Unicode-Vollständigkeitsanspruch.
- sort: Zeilen auf bestehender Locale-Grundlage, -r, -n, -u; keine komplexe Feld-/Schlüsselsprache.
- uniq: benachbarte gleiche Zeilen, -c, -d, -u, optional -i; keine automatische Sortierung.
- cat: stdin wenn kein Operand innerhalb einer Pipeline; keine neue interaktive stdin-Eingabe im Terminal erforderlich.

Maximal eine abschließende stdout-Umleitung > oder >>; keine mittlere Umleitung, 2>, |&, Subshells, Variablenexpansion, Command substitution, Heredocs, Job Control oder allgemeine Globs. Bisherige Einzelbefehlsumleitungen beibehalten. Neutraler Output darf erst nach erfolgreicher Herkunftsprüfung atomar geschrieben werden; Fehlerstatus/Teiloutput nach dokumentiertem bestehenden Modell, kein stilles Trunkieren bei Abweisung.

## 5. M3 – Schutzvertrag und praktische Belastbarkeit

Der Kern der Etappe: Datenherkunft muss auch durch Filterung, Aggregation und Sortierung erhalten bleiben. Zwei Ebenen unterscheiden:
1. Durchlaufene Anbieter und geschützte Herkunft der gesamten Operation, auch wenn am Ende kein Treffer/kein Text übrig bleibt; maßgeblich für E6 und Umleitung.
2. Zeilen-/Ergebnisabhängigkeiten für endgültige Anzeige, Scrollback, Tab und nachträgliche Sperre. Ursprüngliche und aktuelle Bindungen aus Paket 4 erhalten; zusammengesetzte Ergebnisse (Anzahl, Summe, Hash, sort/uniq) tragen die Vereinigung ihrer tatsächlichen Eingabeabhängigkeiten. Bei Unsicherheit vollständige Operation konservativ binden statt Daten freigeben. Keine Herkunft aus gerendertem Text erraten.

Prüfungen beim Traversieren, nach jeder asynchronen Providerantwort, bei Übergabe an nächste Stufe und vor Ausgabe/Schreiben. Bei Sperre, Relink, Löschung oder Identitätswechsel keine veralteten Treffer/Dateinamen/abgeleiteten Kennzahlen neu ausgeben; bereits vorhandene geschützte Ausgaben nach bestehender Bereinigung entfernen. Kein Zurückholen beim Entsperren. E4-Fallmaskierung und D2-Exportantworten beibehalten. Keine neue globale Profilsynchronisierung, bestehende Mehrfenstergrenze dokumentieren.

Tab für die neuen Befehle nur sinnvolle Pfadpositionen (z.B. nach grep-Muster, find-Startpfad), keine Recherchewerte oder verborgenen Objekte als Vorschlag. Bei Pfaden vorhandene physische Linksemantik nutzen, fehlende Zwischenordner und Providergrenzen beachten. Keine Erweiterung zur allgemeinen GNU-Shell-Vervollständigung.

Belastbarkeit: begrenzte Anzahl besuchter Einträge, gelesener UTF-8-Bytes, Zwischen-/Endausgabe und Pipeline-Stufen; bei Erreichen klare Fehlermeldung und kein irreführendes vollständiges Ergebnis, keine unvollständige dauerhafte Ausgabe. Richtwerte zur technischen Abstimmung: 8 Stufen, 10.000 Einträge, 16 MiB gelesene Daten je Operation, 4 MiB gepufferter Zwischenoutput; bestehende kleinere Provider-/Dateigrenzen gelten weiter. Asynchron abschnittsweise verarbeiten, UI und Funk-/LOS-Timer nicht durch lange synchrone Schleifen blockieren. Session-/Abbruchschutz und Ctrl+C soweit vorhandener Mechanismus geeignet; verspätete Ergebnisse nicht in neue Anmeldung übernehmen. Kein künstliches Delay. Messung mit synthetischen Testbeständen (z.B. 200 Dossiers, 1.000 Exporte bzw. vergleichbare Testdaten, große VFS-Dateien); keine Produktionstestdaten erzeugen, Nutzerprofil nicht auffüllen. Messwerte und Umgebung dokumentieren, keine erfundenen Performancegarantien. Richtwerte sind keine bereits gemessenen Kapazitäten.

## 6. M4 – kleiner optionaler Abschluss

sha256sum für einzelne zugängliche reguläre Dateien (und stdin falls Pipes etabliert), SHA-256 tatsächlich über Bytes berechnen, bekannte Testvektoren; keine Hashes als Schlupfloch für E6. Für Archiv-Binärdateien nur bei verfügbarer echter Byte-/Hash-Schnittstelle; andernfalls klar dokumentierte Beschränkung, keine Text-Ersatzprüfsumme. Kein neuer Hostzugriff nur für diese Option. Falls M1–M3 bereits aufwendig sind, sha256sum mit ausdrücklicher Begründung zurückstellen statt Paket zu verlängern.

## 7. Abnahme und Testpaket

Gezielte Tests pro funktionalem Block, getrennte Code-/Test-/Doku-Commits, ein zusammenhängender Draft-PR. Abnahme:
- Beispielbefehle oben mit definierten Testdaten; genaue stdout/stderr und Statuscodes, Nulltreffer, Unicode, Quotes, führender Bindestrich, Fehleroptionen, mehrere Stufen und &&/||; Vergleich einer sinnvollen Auswahl mit GNU-Werkzeugen in der Testumgebung (keine künstliche Vollständigkeit).
- echte Archivbrücke (inkl. Alias-/Binärfall und fehlender Brücke), VFS, INTEL und EXPORTE; rekursive Suche und find ohne Zyklen.
- Sperren vor und während Suche, zwischen Pipeline-Stufen, unmittelbar vor Ausgabe, nach Ausgabe; ursprüngliche/aktuelle Herkunft, geschützte Namen und Aggregate, verwaiste Exporte. Umleitungsversuche > und >> mit vorhandenem und fehlendem Ziel; keine Änderung von Inhalt oder mtime bei Verweigerung. Neutraler Pipeline-Output funktioniert.
- Grenzen, lange Eingaben/Regex, Abbruch, Sessionwechsel, UI-Reaktionsfähigkeit; kontrollierte Uhr für A0. Bestehende Regressionen für Paket 1–4 und vollständige CI.
- Ein umfassendes Windows-Testpaket vom exakten geprüften Draft-Head am Ende von Paket 5 (kein Mikro-Paket pro Tool). Kurze Checkliste mit Beispielbefehlen; A0 vollständige Kommunikation, normale Recherche, praktische größere Datenmengen und Neustart im selben Profil. Keine verpflichtende Wiederholung aller historischen Einzeltests durch Eigentümer.

**Exit-Gate:** technische Freigabe und Windows-Abnahme, Eigentümer entscheidet Merge, main-CI bestätigen. Danach Terminal-Funktionsentwicklung pausieren. Während der Nutzungsphase Beobachtungen zu Dateigrößen, Dossieranzahl, Suchzeiten, Stabilität, Bedienung und Datenpersistenz sammeln; keine Telemetrie oder automatische Datenerfassung hinzufügen. Kartenänderungen erst in eigener späterer Phase. Kein Paket 6 ohne neuen Auftrag. Sicherung von /exports, VAULT/Archiv-Konsolidierung, neue Netzwerk-/Prozesswerkzeuge, GUI-Kartenentwicklung und allgemeine Shell-Vollständigkeit bleiben außerhalb dieses Pakets.

## 8. Arbeitsauftrag

Nach Abschluss #140: Konzeptbranch aktualisieren, Claude prüft Machbarkeit/Optionen gegen tatsächlichen Code, meldet begrenzte Abweichungen und konkrete Teststrategie; keine neue umfassende Architekturrunde. Umsetzung des vereinbarten Umfangs erst auf dieser Grundlage. Bei Konflikt zwischen GNU-Detailtreue und Schutz/Persistenz/A0 hat der bestehende Projektvertrag Vorrang; Abweichung dokumentieren. Unabhängiges Review und ausdrückliche Eigentümerfreigabe vor Merge.

## 9. Abgleich mit dem Code und Umsetzung (Claude, 26.11.2026, nach #140)

### 9.1 Matrix der Anbieter

| Anbieter | readdir | stat | readFile | readlink | Schutzmetadaten | Bemerkung |
|---|---|---|---|---|---|---|
| `wurzel` (`/`, `/var`) | ja | ja | virtuelle Dateien; `/var/log/syslog` ENOSYS | nein | keine | |
| `vfs` (`/home`, `/tmp`, `/etc`) | ja | ja | ja (Rechte des Benutzers) | nein | keine | 1 MiB je Datei |
| `paket` (`/usr`) | ja | ja | ja | nein | keine | schreibgeschützt |
| `intel` | ja, ohne gesperrte Einträge | ja (folgt Links) | ja, `deps` und `zeilenDeps` | ja | je Eintrag, Datei und Zeile | Links nur hier |
| `exporte` (`/exports`) | ja, nur zugängliche | ja | ja, Herkunft | nein | `herkunft` je Datei, Verzeichnisse über Nachfahren | Bestand je Operation einmal (`opt.cache`) |
| `archiv` | über die Brücke, ohne gesperrte Namen | Art nur mit `pruefen` | Text über die Brücke, nie Exportobjekte | nein | Namen der Exportobjekte (`archivname`) | 64 KiB je Datei, kein Binärtext |

Keine neue Shell- oder Dateisystemarchitektur: die neuen Befehle lesen über `TERMINAL_FS` mit derselben Herkunftsaufzeichnung wie die Umleitung (`terminalFsMitHerkunft`) und nutzen für `ls`, `cat`, `head`, `tail` die bestehenden Befehlsfunktionen.

### 9.2 Abweichungen vom Konzept (begrenzt)

1. **Mustermaschine statt JS-RegExp oder Worker:** eigener Thompson-Automat (linear je Zeile, gibt bei langen Zeilen die Ereignisschleife frei). Ein Worker wäre unter `file://` unsicher verfügbar. Folge: keine Rückverweise, keine Wortgrenzen `\b \< \>`, keine Sammelklassen; klar abgewiesen.
2. **Stdin der ersten Stufe ist leer** (wie `</dev/null`); keine interaktive Standardeingabe.
3. **Umleitung einer Pipeline mit Archivlistung:** ganz abgewiesen, sobald ein Exportname durchlaufen wurde (Einzelbefehl `ls … > datei` filtert dagegen weiterhin nur diese Namen heraus). Strenger, weil Namen nach Filterstufen nicht mehr sicher erkennbar sind.
4. **Umleitung einer Pipeline nach `/intel`:** keine Notizanhänge über Pipelines (Notizen weiter über den Einzelbefehl, E7); Schreibversuch ergibt den Fehler des Anbieters.
5. **`sha256sum` im Archiv:** abgewiesen (dekodierter Text statt Bytes); sonst M4 umgesetzt.
6. **Binärdateien im Archiv:** die Brücke liefert sie nicht als Text; `grep` gibt deren Meldung weiter statt `binary file matches`. `binary file matches` gilt für Text mit NUL aus dem VFS.
7. **Tab** nach `|`, nicht nach `&&`/`;` (keine Änderung der bestehenden Ergänzung der Kommunikationskette).
8. **`/exports` beim Durchlauf:** Dateien erben die Sammelherkunft ihrer Verzeichnisse nicht (nur die eigene vollständige Herkunft). Die konservative Bindung der Verzeichniszeile selbst aus Review 3 bleibt.
9. **Kollation:** `sort` folgt der Locale-Tabelle (Bindestrich und Schrägstrich erst auf Stufe 4), wie `ls`.
10. **Randfall aus dem Abschlussreview zu #140:** umgesetzt; Kandidaten einer Auswahlliste tragen ihre Abhängigkeiten.

### 9.3 Teststrategie und Stand

- `tests/terminal-paket5-recherche.js` (echter Browser, echte Brücke): Beispielbefehle mit Daten, Status und Meldungen; Vergleich mit GNU grep 3.11, coreutils 9.4 und findutils 4.9, soweit unter `/usr/bin` vorhanden, sonst übersprungen und gemeldet (lokal ausgeführt; in der CI nicht einzeln belegt, weil `runall` die Ausgabe der Skripte nicht zeigt; `sort -n` nur ohne Tausendertrennzeichen, weil der Vergleich unter `C.UTF-8` läuft); Schutz bei Umleitung (vorhandenes und fehlendes Ziel, Inhalt und mtime), Scrollback, Sperre während der Suche und zwischen Stufen, verwaiste Exporte; Archiv; Grenzen; teures Muster auf langer Zeile; Strg+C; Sitzungswechsel; Tab und Auswahllisten-Randfall (Gegenprobe ohne Korrektur rot).
- `tests/terminal-paket5-last.js`: synthetische Bestände mit Zeit- und Blockademessung.
- A0: bestehende Regressionen der Kommunikationskette unverändert in der Standardauswahl; keine eigene Messung bei laufendem PPP/WireGuard/Profanity mit kontrollierter Uhr (die neuen Befehle laufen nur über die Shellkette und berühren keine Zeitgeber).

### 9.4 Korrekturen nach dem Review zu #141 (6073578665)

- **Testvorbedingung:** Der Helfer prüft jedes Schreiben und Anlegen; Strg+C und Sitzungswechsel werden an einer Haltestelle am tatsächlichen Lesepunkt ausgelöst (statt einer zu großen Datei und Zeitabhängigkeit).
- **Pfade:** gemeinsamer Resolver `rAufloesen` nach dem Vorbild von `terminalSendPfad` (physisch in `/intel`, Zwischenordner, ENOTDIR), Pfadabhängigkeiten gebunden; `find -P` für den letzten Link. Archivnamensregeln unverändert.
- **Herkunft:** ursprüngliche Bindung über `INTEL.bindung` für `/intel`-Abhängigkeiten und über `terminalArchivSendDeps` für Exportnamen im Archiv (keine neue Datenbank; Altobjekte ohne Identität nur dynamisch). Zahlen und zählabhängige Ergebnisse binden die ganze Operation; Archivnamen werden auch in die Operationsherkunft aufgenommen. `cat`/`head`/`tail` mit Dateien laufen in Pipelines über dieselben Eingaben wie `wc` (volle Herkunft, gelesene Bytes).
- **Große Eingaben:** keine Argument-Spreads mehr; Puffer in UTF-8-Bytes und beim Sammeln; Freigabe auch ohne Treffer und bei `-F -w`; Freigabe nach Schritten auch bei angehaltener Uhr (unter einer gesteuerten Uhr gab die frühere Fassung die Ereignisschleife nie frei).
- **P2:** `sha256sum` nur mit Archivoperanden hasht nicht die Standardeingabe; `sort -n` vergleicht exakt.
- **A0:** `tests/terminal-paket5-a0.js` mit gesteuerter Uhr und 200 zusätzlichen Dossiers: Recherche bei angehaltener Uhr, Einwahl mit unveränderten Dauern, Recherche bei bestehendem Link, Linkende während einer laufenden Recherche (Hangup zum vorgesehenen Zeitpunkt, Ergebnis danach korrekt).
- **Gegenproben am Stand ff59d3e:** Pfade (G), ursprüngliche Bindung (H b), Zahl nach leerem Filter und ausgefilterter Archivname (H a), große Datei (I: `Dateioperation fehlgeschlagen` durch RangeError) jeweils rot; mit Korrektur grün.
