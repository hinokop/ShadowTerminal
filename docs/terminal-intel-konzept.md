# Paket 2: `/intel` – Architektur und Bedienung

Stand: 24.11.2026 auf Basis von `main` `07a736d`. Grundlage: [terminal-dateisystem-architektur.md](terminal-dateisystem-architektur.md),
Abschnitte 5, 9 (D3), 9a.5 und 11. Der Entwurf ist von Master Wayne grundsätzlich freigegeben (24.11.2026); die verbindlichen Entscheidungen stehen in
**Abschnitt 0** und gehen den Vorschlägen der übrigen Abschnitte vor, wo diese abweichen (insbesondere Abschnitt 5: Objektverzeichnisse statt Einzeldateien für Kartenobjekte).

## 0. Verbindliche Entscheidungen (Master Wayne, 24.11.2026)

**Sprachliche Architektur.** Die grafische Fachanwendung bleibt vorerst vollständig deutschsprachig; Deutsch gilt konzeptionell als die gewählte
Anwendungssprache des Nutzers. Eine spätere optionale Englischumstellung der Oberfläche bleibt möglich, ist aber keine Voraussetzung für die weitere
Entwicklung und nicht Teil des unmittelbaren Plans. Das Terminal und die virtuelle Linux-Systemumgebung sind grundsätzlich vollständig englischsprachig:
Befehle, Fehlermeldungen, Hilfetexte, simulierte Systemdienste, Verzeichnisnamen sowie systemseitige Feld- und Statusbezeichnungen innerhalb von `/intel`.
Benutzerinhalte (Namen, Notizen, Beschreibungen, Zitate, Quellen) bleiben in ihrer Originalsprache. Bestehende deutsche Archivexporte einschließlich ihrer
Dateinamen (`lageblatt-PIN-001.txt` usw.) bleiben unverändert; sie sind Dokumente einer deutschsprachig konfigurierten Fachanwendung. Keine
Internationalisierung der Oberfläche und keine Spracheinstellung in diesem Schritt. Bestehende deutsche Terminalmeldungen werden mit der allgemeinen
Englischumstellung des Terminals angeglichen, nicht in Paket 2.

| Nr. | Entscheidung |
|---|---|
| E1 | Ausschließlich stabile Kennungen als Namen der Objektverzeichnisse. |
| E2 | Gliederung `persons`, `organizations`, `locations`; zusätzlich ein zentraler `/intel/dossiers/index` über alle Typen sowie Indizes für Pins und Zonen. |
| E3 | Symbolische Links, vom Anbieter erzeugt; keine allgemeine `ln`-Implementierung. `cd` verwendet den kanonischen Zielpfad. Gegenseitige Verknüpfungen und Zyklen sind zu berücksichtigen. |
| E4 | Fälle bleiben unabhängig von Dossiersperren sichtbar. Eigene Fallinhalte behalten die Maskierungssemantik der Oberfläche; eingebettete Inhalte gesperrter Dossiers bleiben geschützt. Dossierkennungen in bestehenden Beziehungen dürfen sichtbar sein; gesperrte Kartenobjekte und Sichtungen werden nicht offengelegt. Zusammengesetzte Ausgaben (insbesondere Indizes) erhalten hinreichend granulare Schutzmetadaten. |
| E5 | Neue `/intel`-Dateien und systemseitige Beschriftungen englisch. Vorhandene Renderer wiederverwenden bzw. parametrieren, keine doppelte Datenaufbereitung. Benutzerinhalte unverändert; Archivexporte nicht migrieren. |
| E5b | Dateinamen ohne Endung. |
| E6 | Kopieren, Umleiten und sonstige dauerhafte Übernahme von `/intel`-Inhalten ins VFS vorerst verboten; langfristig über ein bewusstes Export-/Herkunftsmodell. |
| E7 | Anhängen von Dossiernotizen als letzter Meilenstein von Paket 2: genau eine validierte Anwendungsaktion je erfolgreichem Schreibbefehl, dauerhafter Erfolgsstatus, Rücknahme bei Speicherfehler; kein Überschreiben oder Löschen. |
| E8 | Kein automatisches Folgen der Oberfläche beim `cd`. |
| E9 | Arbeitsverzeichnis bei Sperre behalten, Zugriff verweigern, Navigation hinaus bleibt möglich. Entsperren nur über das bestehende `sudo open`; kein `sudo cd`/`sudo cat`. |
| E10 | Metadaten von Galerie- und Belegdateien anzeigen; Inhalte über die Oberfläche; keine neue Binärverarbeitung. |
| E11 | Knopf „Im Terminal“ an Dossiers, Fällen und Kartenobjekten; laufende Terminalprozesse (tmux, PREDICT, PPP, Profanity), ungespeicherte Eingaben und Oberflächenentwürfe werden geschützt. |
| E12 | `grep` und `find` zurückgestellt. |
| O1 | Pins, Zonen und einzelne Sichtungen sind eigene Objektverzeichnisse: `/intel/geospatial/pins/PIN-004/record`, bei Pins und Zonen zusätzlich `coordinates` und bei bestehender Verknüpfung der Link `dossier`; Sichtungen unter `sightings/<Dossier-ID>/<Sichtung-ID>/record`. |
| O2 | Pfadsemantik für bestehende Befehle: `open .`, `open /intel/cases/F-001`, `map .`, `map ../pins/PIN-004`, `readlink dossier`, `cd dossier`. |
| O3 | Keine vollständige POSIX-Symlink-Implementierung, keine zusätzliche GNU-Detailarbeit; `ls -l` nutzt die vorhandene Formatierung und ergänzt nur die für `/intel` nötigen Metadaten. |

Die Windows-Neustartprüfung von Paket 1 ist bestanden (25.11.2026, bestätigt von Shadow: `~/projects` mit Unterordnern nach vollständigem Neustart vorhanden).

## 1. Ziel

`/intel` macht den fachlichen Bestand der Anwendung (Dossiers, Fälle, Pins, Zonen, Sichtungen) im Terminal als Verzeichnisbaum begehbar. Er ist
**eine Sicht auf denselben Bestand**, keine Kopie: Was in der Oberfläche geändert wird, steht sofort im Baum. Ändern lässt sich über den Baum zunächst
nichts; in einer späteren Stufe (E7) nur das Anhängen einer Dossiernotiz, und zwar als dieselbe Aktion, die die Oberfläche auslöst.

Mehrwert für die Arbeit: schneller Überblick per Tastatur (`ls`, `cat`, `head`), Querverweise zwischen Fall, Dossier und Karte mit einem Befehl, und
Sprünge in beide Richtungen zwischen Terminal und Oberfläche.

## 2. Ausgangslage (geprüft am Code)

| Bestand | Ort im Code | Kennung | Sperre |
|---|---|---|---|
| Dossiers (Beispiel-, Standard- und eigene) | `dossierRechercheBestand()`, Zustand in `STATE.dossiers.entitaeten[id]` (Status, Notizen, Sichtungen, Kurzlage, Registernummer) | `P-…`, `O-…`, `L-…`; Typen Person, Organisation, Ort | manuell, `PROFIL.gesperrt` (`dossierGesperrt`) |
| Fälle | `PROFIL.recherche.faelle` (Titel, Leitfrage, Zustand, Bewertung, Begründung, nächster Schritt, `dossiers[]`, `pins[]`) | `F-nnn` | **keine eigene** |
| Unterlagen zum Fall | `PROFIL.recherche.quellen`, `fassungen`, `beobachtungen` (Dateien in eigener IndexedDB) | `Q-`, `V-`, `B-` | keine eigene; Beobachtungen tragen `dossiers[]` |
| Pins | `PROFIL.pins` (Name, Position, Zwecke, Umgebung, Notiz, optional `dossier`) | `PIN-nnn` | erbt vom verknüpften Dossier (`pinGesperrt`) |
| Zonen (eigene) | `PROFIL.zonen` (Name, Position, Radius, Notiz, Stand, optional `dossier`) | `ZO-nnn` | erbt vom verknüpften Dossier (`zoneGesperrt`) |
| Sichtungen | `STATE.dossiers.entitaeten[id].sichtungen` | `SI-nnn`, **nur je Dossier eindeutig** (Import nummeriert je Dossier um) | erbt vom Dossier |

Weitere Fakten:
- `zielZugang(id)` deckt Dossiers, Pins und Zonen ab; Fälle und Sichtungen nicht (Vorbedingung 9a.5).
- Die Oberfläche maskiert Namen gesperrter Dossiers und Pins/Zonen per `MutationObserver` im gesamten Dokument (`sperreText`/`sperreMaskieren`),
  also auch in der Terminalanzeige. Der gespeicherte Scrollback (`TERMINAL_ZUSTAND.ausgabe`) ist davon nicht erfasst.
- Textdarstellungen existieren bereits für den Archivexport: `pinText`, `eigeneZoneText`, `sichtungText` (karte-modul.js, deutsche Beschriftung).
- `dispatch` meldet keinen dauerhaften Erfolg (`Store.save` ohne Rückgabewert, `profilSpeichern` nur als Meldung). `xSchreiben` im Modul X zeigt das
  richtige Muster: ändern, speichern, bei Fehlschlag zurückrollen.
- Vorhandene Terminalbefehle: `map`, `open`, `exports`, `sudo open …` (Entsperren mit der Zugangskennung), Tab-Ergänzung für Kennungen.

## 3. Grundsätze

1. **Sicht, keine Kopie.** Jeder Zugriff rendert aus den Selektoren der Oberfläche. Es gibt keinen Zwischenspeicher, der veralten kann.
2. **Ein Zugangsentscheid.** Alles läuft über eine erweiterte Zugangsfunktion `intelZugang(objekt)` auf Basis von `zielZugang` (Abschnitt 6). Geprüft wird beim
   `readdir`, beim Öffnen, nach jedem asynchronen Schritt und unmittelbar vor der Ausgabe.
3. **Namen gesperrter Objekte erscheinen nie.** Pfade bestehen nur aus Kennungen. Gerenderte Texte laufen durch `sperreText`, sodass auch Erwähnungen
   gesperrter Dossiers in fremden Notizen durch die Kennung ersetzt werden, wie in der Oberfläche.
4. **Schreiben ist eine Absicht.** Ein Schreibzugriff wird in eine validierte Anwendungsaktion übersetzt; nie direkt auf `PROFIL` oder `localStorage`.
5. **Unix-Verhalten, wo es trägt.** `/intel` ist ein eigener, schreibgeschützter Einhängepunkt (`EROFS`, „Read-only file system“). `mv` über die Grenze ergibt
   `EXDEV`. Querverweise sind symbolische Links (E3).

## 4. Vorbedingungen aus Paket 1 (Teil dieses Pakets)

- **Anbieter-Tabelle** statt Verzweigungen in `TERMINAL_FS` (Review #137): Einhängepunkte `/`, `/etc`, `/var`, `/home`, `/tmp`, `/<Archiv>`, `/intel`, jeweils
  mit `stat`, `readdir`, `readFile`, optional `readlink` und Schreiboperationen. Der Wurzel-`readdir` zeigt `intel/` zusätzlich (Golden-Aufnahme beabsichtigt geändert).
- **EXDEV** für `mv` über Einhängepunkte; `EROFS` für schreibende Operationen auf `/intel`.
- **Symbolische Links** im Pfadmodell (nur lesend, nur in `/intel`): `ls -l` zeigt `name -> ziel`, `cd` und `cat` folgen, `readlink` (neu, klein) gibt das Ziel aus.
  Schleifen sind ausgeschlossen, weil Links nur auf Objektverzeichnisse oder -dateien zeigen.

## 5. Baum

Vorschlag (Namen nach D6 englisch, Dossiers nach Typ gegliedert, siehe E2):

```
/intel/
  README                          kurze Beschreibung des Baums (statisch)
  dossiers/
    index                         alle Typen: Kennung, Typ, Status, Name je freiem Dossier (gesperrte fehlen)
    persons/  organizations/  locations/
      index                       wie oben, je Typ
      P-0001/
        profile                   Name, Typ, Länderkennung, Aliase, Status, Registernummer, Erkenntnislage, Kurzlage, Beschreibung, Eckdaten
        notes                     Dossiernotizen (DN-nnn), älteste zuerst; später anhängbar (E7)
        links                     Verbindungen im Beziehungsgraph (Art, Gegenstelle als Kennung)
        sightings -> /intel/geospatial/sightings/P-0001
        cases/                    F-001 -> /intel/cases/F-001   (Fälle, die das Dossier verknüpfen oder Unterlagen dazu haben)
        pins/                     PIN-004 -> /intel/geospatial/pins/PIN-004   (Pins mit Bezug zu diesem Dossier)
        zones/                    ZO-002 -> /intel/geospatial/zones/ZO-002
        images                    Liste der Galeriebilder (Name, Größe), keine Bilddaten (E10)
  cases/
    index                         Kennung, Zustand, Titel je Fall
    F-001/
      case                        Titel, Leitfrage, Zustand, Bewertung, Begründung, nächster Schritt, erfasst/geändert
      dossiers/                   P-0001 -> /intel/dossiers/persons/P-0001
      pins/                       PIN-004 -> /intel/geospatial/pins/PIN-004
      sources/
        Q-001/
          source                  Art, Herkunft, URL, Abruf, Güte mit Begründung, Kette
          V-001/                  je Fassung
            version               erfasst, Dateiname, Größe, Typ, SHA-256, veröffentlicht
            observations          Beobachtungen dieser Fassung: Fundstelle, Zitat, Ereigniszeit, Ort, Dossiers, Prüfung
  geospatial/
    pins/
      index                       Kennung, Name, verknüpftes Dossier je freiem Pin
      PIN-004/
        record                    Pinblatt (Zweck, Umgebung, Notiz, angelegt)
        coordinates               Breite und Länge
        dossier -> /intel/dossiers/persons/P-0001   (nur bei Verknüpfung)
    zones/
      index
      ZO-002/   record  coordinates  [dossier ->]
    sightings/
      P-0001/
        SI-001/
          record                  Sichtungsblatt
          dossier -> /intel/dossiers/persons/P-0001
          [pin -> /intel/geospatial/pins/PIN-007]   (Entwurfs-Pin, aus dem sie entstand)
```

Zeitstempel (`ls -l`): letzte Änderung des Objekts (`aktualisiert`, `stand`, `t`, `geaendert`), Größe gleich der Bytezahl des gerenderten Texts,
Modus `r--r--r--` (Dateien) bzw. `r-xr-xr-x` (Verzeichnisse), Eigentümer `root`, damit die Schreibsperre auch optisch Unix entspricht.

Dateien ohne Endung (wie `/etc/hostname`) oder mit `.txt` ist E5b.

## 6. Zugriffsmatrix

„Frei“ heißt: keine manuelle Sperre am maßgeblichen Dossier. Variante B (gesperrte Objekte fehlen in Listen, direkter Zugriff `Permission denied`) gilt wie
im Archiv.

| Objekt | Maßgeblich | `ls` des Elternverzeichnisses | direkter Zugriff (`cd`, `cat`) | Querverweise auf das Objekt |
|---|---|---|---|---|
| Dossier | eigene Sperre | fehlt, wenn gesperrt | `Permission denied` | Link bleibt sichtbar (nur Kennung), Folgen ergibt `Permission denied` |
| Pin, Zone | Sperre des verknüpften Dossiers; ohne Dossier frei | fehlt, wenn gesperrt | `Permission denied` | wie Dossier |
| Sichtung | Sperre ihres Dossiers | Verzeichnis `sightings/P-…` fehlt, wenn gesperrt | `Permission denied` | – |
| Fall | **neue Regel nötig (E4)** | | | |
| Unterlagen | wie Fall; Beobachtungen mit Bezug auf ein gesperrtes Dossier: Bezug nur als Kennung, Zitat und Text unverändert aber mit `sperreText` | | | |
| `index`-Dateien | je Zeile wie das Objekt | gesperrte Zeilen fehlen | – | – |

Querverweise, die auf ein gesperrtes Ziel zeigen, als sichtbare Kennung zu belassen, entspricht der Oberfläche (dort erscheint ein gesperrtes Dossier mit seiner
Nummer). Alternative: auch Links verbergen (strenger, aber ein Fall würde dann scheinbar weniger Dossiers haben, als er hat). Siehe E4.

**Prüfzeitpunkte:** vor dem Lesen, nach jedem `await`, unmittelbar vor `terminalAusgabe`. Ausgaben aus `/intel` erhalten Schutzmetadaten im Scrollback
(`ausgabeMeta` mit Objektbezug), sodass eine spätere Sperre sie wie gelesene Archivtexte wieder entfernt (`terminalSchutzBereinigen`). Tab-Ergänzung und
Verlauf nutzen dieselbe Sichtbarkeit; Pfade enthalten nur Kennungen, der Verlauf braucht daher keine neue Namensregel.

**Entsperren:** `sudo cd …`, `sudo cat …` oder `sudo open …` auf ein gesperrtes Objekt fragt die Zugangskennung und hebt die Sperre dauerhaft auf, wie
heute `sudo open`. Ob `sudo` für `cd`/`cat` überhaupt angeboten wird, ist E9.

## 7. Bedienung im Terminal

```
raizo@terminal:~$ cd /intel/dossiers/persons
raizo@terminal:/intel/dossiers/persons$ cat index
P-0001  Person  aktiv      Max Beispiel
P-0007  Person  –          Jana Muster
raizo@terminal:/intel/dossiers/persons$ cd P-0007
raizo@terminal:/intel/dossiers/persons/P-0007$ ls -l
-r--r--r-- 1 root root  412 Nov 24 18:02 links
-r--r--r-- 1 root root 1180 Nov 24 18:02 notes
...
lrwxrwxrwx 1 root root   35 Nov 24 18:02 sightings -> /intel/geospatial/sightings/P-0007
raizo@terminal:/intel/dossiers/persons/P-0007$ tail -n 3 notes
raizo@terminal:/intel/dossiers/persons/P-0007$ open .            # Dossier P-0007 in der Oberfläche
raizo@terminal:/intel/dossiers/persons/P-0007$ map pins/PIN-004  # Pin auf der Karte
raizo@terminal:/intel/dossiers/persons/P-0007$ cd cases/F-001    # folgt dem Link
raizo@terminal:/intel/cases/F-001$ cat case
```

- **Lesen:** `ls` (alle vorhandenen Optionen), `cd`, `pwd`, `cat`, `head`, `tail`, `readlink` (neu). Tab ergänzt Kennungen und Dateinamen.
- **`open <pfad>`**, **`map <pfad>`**: zusätzlich zu Kennung und Name nehmen beide Pfade an (`open .`, `open /intel/cases/F-001`, `map ../pins/PIN-004`).
  `open` auf einen Fall öffnet ihn im Modul X, auf ein Dossier, einen Pin, eine Zone oder eine Sichtung das Dossier (bzw. bei unverknüpften Pins/Zonen
  „No linked dossier“ wie bisher). `map` auf Pin, Zone oder Sichtung zeigt sie auf der Karte; auf ein Dossier dessen Kartenobjekte (wie der Kartenknopf im Dossier).
- **Schreiben:** jede schreibende Operation auf `/intel` ergibt `Read-only file system`. Ausnahme in der späteren Stufe: `echo "…" >> notes` (E7).
- **Kopieren aus `/intel`:** siehe E6.

## 8. Integration mit der Oberfläche (beide Richtungen)

**Terminal → Oberfläche:** `open` und `map` mit Pfaden (Abschnitt 7). Kein automatisches Mitführen der Oberfläche beim `cd` (E8).

**Oberfläche → Terminal:** Ein Knopf „Im Terminal“ an Dossier, Fall (Modul X) und im Kartenpopup von Pin, Zone und Sichtung öffnet das Terminal und
wechselt dorthin (`cd` mit sichtbarer Befehlszeile im Verlauf, damit nachvollziehbar ist, was geschah). Läuft im Terminal gerade ein Befehl, wird nicht
gewechselt, sondern gemeldet.

**Laufende Konsistenz:**
- Änderungen in der Oberfläche sind beim nächsten Zugriff sichtbar (kein Zwischenspeicher).
- Wird das Objekt des Arbeitsverzeichnisses gelöscht, bleibt der Prompt wie unter Linux stehen; `ls`/`cat` melden `No such file or directory`, `cd ..` funktioniert.
- Wird es gesperrt, gilt dasselbe mit `Permission denied`; der Prompt zeigt nur die Kennung (E9: alternativ Rücksprung auf die Elternebene).
- Gesperrte Inhalte, die bereits ausgegeben wurden, verschwinden aus dem Scrollback (Schutzmetadaten, Abschnitt 6).

## 9. Schreiben (spätere Stufe, E7)

`echo "Text" >> /intel/dossiers/persons/P-0001/notes` löst `DOSSIER_NOTIZ` aus. Voraussetzung ist ein Erfolgsvertrag (9a.5): ein Pfad `intelNotiz(id, text)`, der
die Aktion ausführt, das Profil sichert und bei Fehlschlag zurückrollt (Muster `xSchreiben`); erst dann meldet die Umleitung Erfolg, sonst
`bash: notes: Input/output error`. `>` (Überschreiben), `nano`, `rm` auf `notes` ergeben `Read-only file system`. Mehrzeiliger Text wird eine Notiz.
Gesperrtes Dossier: `Permission denied`, nichts geschrieben.

Hinweis zur Windows-Abnahme: Diese Notiz landet im Anwendungsprofil (wie jede Notiz aus der Oberfläche), **nicht im VFS**. Sie hing daher nicht von der
Neustartprüfung des VFS ab (inzwischen bestanden, 25.11.2026). VFS-abhängig ist in Paket 2 nur das Kopieren aus `/intel` nach `/home` (E6).

## 10. Verhältnis zu den Archivexporten

`lageblatt-PIN-…`, `zone-ZO-…`, `sichtung-…` bleiben Momentaufnahmen im Hostordner, `/intel` ist der lebende Stand. Beide nutzen denselben Renderer (E5), sodass
ein Vergleich per Auge möglich ist. Es gibt keinen automatischen Abgleich; ein später geänderter Pin macht den Export nicht ungültig. Ein Befehl
„Export aus `/intel` heraus“ ist nicht Teil dieses Pakets.

## 11. Zu entscheiden

| Nr. | Frage | Optionen | Empfehlung |
|---|---|---|---|
| E1 | Verzeichnisnamen | (a) nur Kennung `P-0001`; (b) Kennung und Name `P-0001_Max_Beispiel` | (a): Namen stehen nie im Pfad, Sperre und Umbenennen sind unproblematisch; Namen über `index` |
| E2 | Gliederung der Dossiers | (a) nach Typ `persons/`, `organizations/`, `locations/`; (b) flach `/intel/dossiers/P-0001` | (a) wie im Architekturdokument; der Typ steckt zwar schon im Präfix, das Blättern wird aber übersichtlicher. Ein Verzeichnis `things/` erst, wenn es den Typ Sache gibt (heute nicht vorhanden) |
| E3 | Querverweise | (a) symbolische Links (`ls -l` zeigt `->`, `cd` folgt); (b) Textdateien mit Kennungen | (a): realistisch und direkt begehbar; Aufwand im Pfadmodell überschaubar (Abschnitt 4) |
| E4 | Zugang zu Fällen | (a) Fall immer sichtbar, Verweise auf gesperrte Dossiers als Kennung, Inhalte gesperrter Dossiers nicht eingebettet; (b) Fall gesperrt, sobald ein verknüpftes Dossier gesperrt ist; (c) eigene Fallsperre (neue Produktfunktion) | (a): entspricht der Oberfläche, in der ein Fall trotz gesperrtem Dossier sichtbar bleibt. Zu bestätigen: Beobachtungen mit Bezug auf ein gesperrtes Dossier zeigen Zitat und Text (maskiert), nicht verborgen |
| E5 | Inhalt und Sprache der Dateien | (a) vorhandene Exporttexte wiederverwenden (deutsch, identisch zum Lageblatt); (b) neue englische Schlüssel-Wert-Dateien | (a) jetzt, Umstellung auf Englisch mit der allgemeinen Sprachumstellung; eine Quelle, kein zweiter Renderer |
| E5b | Dateinamen | ohne Endung (`profile`, `notes`) oder mit `.txt` | ohne Endung, wie Systemdateien unter Linux; Tab und `cat` bleiben gleich bequem |
| E6 | Kopieren und Umleiten aus `/intel` ins VFS (`cp`, `cat … > datei`, `nano`) | (a) verbieten (`Operation not permitted`), Lesen nur auf dem Bildschirm; (b) erlauben, Kopie überlebt eine spätere Sperre; (c) erlauben mit Herkunftsvermerk und Bereinigung bei Sperre | (a), konsistent mit Abschnitt 11 der Architektur (Archivexporte). Ohnehin zurückgestellt, bis die VFS-Persistenz unter Windows abgenommen ist |
| E7 | Notiz anhängen | (a) in Paket 2 als letzter Meilenstein mit Erfolgsvertrag; (b) erst nach Paket 2 | (a): schreibt ins Anwendungsprofil, nicht ins VFS, und ist damit nicht von der Neustartprüfung abhängig |
| E8 | Oberfläche folgt dem `cd` automatisch | (a) nein, nur ausdrücklich über `open`/`map`; (b) zuschaltbar | (a), entspricht der Regel „kein Autosprung“ beim Arbeitsstand |
| E9 | Gesperrtes Arbeitsverzeichnis; `sudo` für `cd`/`cat` | (a) Linux-artig stehen bleiben, Entsperren nur über `sudo open`; (b) Rücksprung auf die Elternebene; (c) zusätzlich `sudo cd`/`sudo cat` | (a): wenige Sonderwege, gleiche Kennungsprüfung wie bisher |
| E10 | Galeriebilder und Belegdateien | (a) nur auflisten (Name, Größe, SHA-256), Inhalt über `open` in der Oberfläche; (b) Inhalt per `cat` (Textdateien) | (a); Text-Belege per `cat` kann folgen, wenn Bedarf besteht |
| E11 | Knopf „Im Terminal“ in der Oberfläche | an Dossier, Fall und Kartenpopups; Beschriftung | ja, an allen drei Stellen; Beschriftung „Im Terminal“ |
| E12 | Suche | (a) nicht in Paket 2; (b) `grep`/`find` (lesend) für `/intel` | (a): eigenes Thema mit eigenen Schutzfragen (Treffer in gesperrten Inhalten dürfen nichts verraten) |

## 12. Umsetzung als ein Paket

Ein Branch, ein Draft-PR, Meilensteine mit gezielten Zwischentests, volle CI und unabhängige Prüfung am Ende. Kein vorgezogener Einzel-PR.

1. **Unterbau:** Anbieter-Tabelle, `EROFS`/`EXDEV`, Symlinks und `readlink`; bestehende Suite unverändert grün (bis auf die beabsichtigte Wurzelliste).
2. **Zugang:** `intelZugang` mit der Matrix aus Abschnitt 6, Schutzmetadaten im Scrollback, Tab und Verlauf. Eigene Regressionen: Sperre während eines laufenden
   Lesevorgangs, Sperre nach der Ausgabe, Links auf gesperrte Ziele, Fall mit gesperrtem Dossier, Namensmaskierung in fremden Notizen.
3. **Baum lesend:** Dossiers, Fälle mit Unterlagen, Geodaten; `index`; `ls -l`-Metadaten; Abgleich der Texte mit den Exporten.
4. **Integration:** `open`/`map` mit Pfaden; Knopf „Im Terminal“; Verhalten bei Löschen und Sperren des Arbeitsverzeichnisses.
5. **Notiz anhängen** (falls E7 a): Erfolgsvertrag, Rücknahme bei Speicherfehler, Test mit erzwungenem Speicherfehler.
6. **Zurückgestellt bis zur Windows-Abnahme der VFS-Persistenz:** alles, was Inhalte aus `/intel` dauerhaft ins VFS bringt (je nach E6 ohnehin entfallend).

Dokumentation (`docs/terminal.md`, Architektur, AKTUELL) wird im selben PR nachgezogen. Ein Windows-Testpaket folgt am Ende für die praktische Abnahme
(Bedienung, Knopf „Im Terminal“, Sperren).

## 13. Risiken und Ungeprüftes

- **Sicherheitskritisch** ist die Zugangsmatrix: jede neue Ausgabestelle (Tab, `index`, Links, Fehlermeldungen) ist ein möglicher Abfluss. Deshalb eigener
  Meilenstein mit eigenen Tests vor dem Baum.
- Namensmaskierung per `sperreText` ersetzt nur Namen und Aliase ab einer Mindestlänge (heute 3 bzw. 5 Zeichen); kurze Aliase bleiben in fremden Texten
  sichtbar, wie in der Oberfläche. Ob das so bleiben soll, ist eine Produktfrage außerhalb dieses Pakets.
- Leistung: `index` und `ls -l` rendern alle Objekte eines Verzeichnisses; bei sehr großen Beständen (Tausende Dossiers) ungemessen.
- Sichtungsnummern sind nur je Dossier eindeutig; der Baum trägt das durch `sightings/<Dossier>/SI-nnn` Rechnung.
- Die Fall-Unterlagen liegen teils in einer eigenen IndexedDB; Metadaten (Größe, Hash) kommen aus `PROFIL.recherche`, die Dateien selbst werden nicht gelesen.
- Nicht geprüft: Verhalten der Oberfläche beim Öffnen eines Falls über `open`, wenn Modul X gerade einen ungespeicherten Entwurf hat.
