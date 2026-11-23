# Phase 5c2b: Inventur der Nicht-Standardskripte

Stand: 23.11.2026, gemessen auf `1cb1195` (vor #119) und `5c5a545` (aktueller `main`, Merge von #119). Reiner Dokumentations- und Werkzeug-PR (Draft): Es werden keine Skripte gelöscht, aus `runall.js` entfernt oder umgeschrieben und kein Produktcode geändert. Alle Zahlen stammen aus Messläufen des Autors (Claude) in einer Linux-Sandbox; sie sind bisher nicht unabhängig nachgemessen (siehe Abschnitt 9).

## 1. Ergebnis in Kürze

1. `tests/` enthält 231 Skripte außer `runall.js`: 96 in der Standardauswahl (`GRUPPEN`), 135 außerhalb. 22 Namen stehen in `HISTORISCH`.
2. Freigegebener Umfang: die 50 Nicht-Standardskripte, die den Text `IZ(` enthalten (39 nicht historisch markiert, 11 historisch markiert). Alle 50 waren bereits **vor #119 rot** (auf `1cb1195`). Die drei weiteren Skripte mit `IZ(` auf `1cb1195` (`emp2`, `kt2`, `kt3`) hat #119 durch Entfernen der `IZ()`-Zeile angepasst; sie waren auf `1cb1195` bereits grün gemessen und sind es auf `main` weiterhin (siehe 4.3).
3. #119 hat an den 50 Skripten nichts verschlechtert: Bei 40 von 50 wechselt nur die erste Fehlermeldung zu `IZ is not defined`; bei den übrigen 10 bleibt eine andere erste Meldung (Abschnitt 4.2).
4. Gemeinsame Ursache: Die Skripte hängen an der Altmission (Missionsmechanik, Handler-Dialog, Tarnidentitäten, Freigabenmaske), die mit den Phasen 5b7 (`5c48dd5`), 5b8 (`41717f4`) und 5b9 (`bc6f03f`) am 22.11.2026 stillgelegt beziehungsweise entfernt wurde. Aufrufe entfernter Funktionen scheitern mit `ReferenceError`; `dispatch()` mit entfernten Aktionstypen läuft stumm ins Leere, sodass der Zustand fehlt (`TypeError` auf `undefined`/`null`) oder erwartete Bedienelemente nie erscheinen.
5. Einordnung der 50 nach Produktbezug: 41 betreffen ausschließlich entfernten Funktionsumfang (Dialog 15, Missionsablauf 11, Freigaben 9, Haltung/Vertrauen 6); 9 betreffen Bereiche, die im Produkt bestehen (Karte 5, Dossier/Profil/Ausgangsorte 4). Bei diesen 9 ist die Abdeckung durch die Standardauswahl teils nicht belegt (Abschnitt 6).
6. Zusatzmessung außerhalb des freigegebenen Umfangs (Anhang A): Die übrigen 85 Nicht-Standardskripte wurden einmal auf `main` ausgeführt: 33 grün, 49 rot, 3 ohne Ausgabe. Von den 33 grünen enthalten 27 keines der geprüften Prüfmuster; „grün“ bedeutet dort nur Exit-Code 0 ohne Fehlermuster (Abschnitt 4.3).
7. Empfehlungen sind Vormerkungen; Entscheidungen stehen bei Master Wayne (Abschnitt 7).

## 2. Methode und Reproduktion

Zwei Werkzeuge, nicht in `runall.js` registriert (Unterstrich-Präfix), ändern nichts am Repository:

- `tests/_inventur-nichtstandard.js`: ermittelt die Nicht-Standardskripte aus `GRUPPEN` und `HISTORISCH` in `runall.js`, führt sie (wie `runall.js`: eigenes Temp-Verzeichnis als Arbeitsordner, 170 s Zeitgrenze, Fehlermuster von `runall.js`) aus und schreibt Exit-Code, Dauer und ersten Fehler als JSON.
- `tests/_inventur-statik.js`: parst jedes Skript mit acorn und bestimmt die im Skript aufgerufenen Namen und `dispatch`-Aktionstypen, die auf dem gemessenen Stand nicht mehr deklariert beziehungsweise nicht mehr behandelt werden.

Reproduktion (Ordner mit Playwright; `PLAYWRIGHT_BROWSERS_PATH` wie in `runall.js`):

```
git worktree add ../wt-base 1cb1195
git worktree add ../wt-main 5c5a545
cd ../wt-main/tests
node _inventur-nichtstandard.js liste --enthaelt "IZ("
FT_PARALLEL=3 node _inventur-nichtstandard.js messen --enthaelt "IZ(" --out inv-main.json
FT_PARALLEL=3 node _inventur-nichtstandard.js messen --out inv-main-alle.json     # Zusatzmessung (Anhang A)
NODE_PATH=<Pfad mit acorn und acorn-walk> node _inventur-statik.js --out stat-main.json
```

Dieselben Befehle im Ordner von `1cb1195` ergeben den Stand vor #119 (die Werkzeuge dorthin kopieren). Einzelne Skripte: `cd tests && node runall.js <name>`; `runall.js` führt jeden Skriptnamen auch außerhalb der Standardauswahl aus. Hinweis: Ein flacher Klon genügt nicht für die Historie (`git fetch --unshallow`). Mit `FT_PARALLEL=3` gemessen; ein einzelner Lauf je Skript und Stand.

Zweck eines Skripts: aus dem Skriptinhalt abgeleitet (Skriptköpfe oder Kommentare fehlen; die Historie besteht für diese Dateien meist nur aus dem Erstimport `f09c4bc`). „Produktrelevanz“ stützt sich auf Namens- und Textsuche in Produkt und Standardtests und ist keine Abdeckungsanalyse.

## 3. Ausgangszahlen

| Größe | Anzahl |
|---|---|
| Skripte in `tests/` (ohne `runall.js` und `_`-Dateien) | 231 |
| Standardauswahl (`GRUPPEN`) | 96 |
| Außerhalb der Standardauswahl | 135 |
| davon in `HISTORISCH` | 22 |
| davon mit Text `IZ(` auf `main` (freigegebener Umfang) | 50 (39 nicht historisch, 11 historisch) |
| davon ohne `IZ(` (Anhang A) | 85 (74 nicht historisch, 11 historisch) |

## 4. Befund

### 4.1 Ursachenklassen (Basisstand `1cb1195`, erster Fehler)

| Klasse | Bedeutung | Skripte |
|---|---|---|
| E1 | Aufruf einer entfernten Funktion oder Aktion (`ReferenceError`, „is not a function“) | 15 |
| E2 | Zugriff auf Missionszustand, der nicht mehr besteht (`LM()`, `KM()` leer; `TypeError` auf `null`/`undefined`) | 23 |
| E3 | Erwartete Bedienelemente oder Ansichten der Altmission fehlen (`FAIL` oder Zeitüberschreitung beim Warten auf einen Selektor) | 11 |
| E4 | Umgebungsmangel des Skripts (`tn`: nicht vorhandene Datei `foto.png`, relativer Pfad) | 1 |

Zuordnung je Skript im Abschnitt 5. Die Klasse beschreibt den **ersten** Fehler; dahinter können weitere folgen (Abschnitt „nicht vorhandene Namen und Aktionen“ je Skript).

### 4.2 Wirkung von #119

#119 hat die Hilfsfunktionen `IZ()` und `aussagenListe()` aus `index.html` entfernt. Skripte, die `IZ()` aufrufen, scheitern auf `5c5a545` bei 40 von 50 mit `IZ is not defined` als erstem Fehler. Bei den übrigen 10 (`abd`, `al`, `dp`, `ds2`, `kw`, `ru`, `st`, `tn`, `wk3`, `zp`) scheitert das Skript früher oder an anderer Stelle; `IZ()` wird dort nicht erreicht. Der Status ist in beiden Ständen rot, es gibt keine neue Rötung durch #119.

### 4.3 Bedeutung von „grün“

Das Werkzeug wertet ein Skript als grün bei Exit-Code 0 ohne Fehlermuster in der Ausgabe. Das ist für Skripte ohne eigene Prüfungen kein Nachweis. Beispiel `emp2`: grün, obwohl die Ausgabe viermal `ERR antwortFuer is not defined` enthält, weil das Skript die Fehler abfängt und ausgibt. `emp2`, `kt2` und `kt3` sind auf `1cb1195` grün gemessen und haben nach #119 unveränderten Status; ihre Aussagekraft ist gering (keine Prüfmuster im Text).

### 4.4 Gemeinsame Entfernungen (Quellen der Fehler)

- 5b7 (`5c48dd5`, 22.11.2026): Missionsbetrieb stillgelegt; `dispatch` mit `MISSION_ANGENOMMEN`, `MISSION_ZUGEWIESEN`, `STATUS_GESETZT`, `MISSION_BEGINN_JETZT` und weiteren Aktionstypen bleibt ohne Wirkung.
- 5b8 (`41717f4`): unerreichbarer Code entfernt (164 Deklarationen).
- 5b9 (`bc6f03f`): Missionskern entfernt (224 Deklarationen, `dialog.js`, `klassifikator.js`); damit fehlen `antwortFuer`, `DIALOG`, `akteurDaten`, `nachrichtSenden` und weitere.

## 5. Einzelblöcke (50 Skripte)

Jeder Block enthält: Zweck, Reproduktionsbefehl, Verhalten auf `1cb1195` und `5c5a545` (Status, Dauer, erster Fehler), Ursachenklasse, auf `main` nicht mehr vorhandene Namen und Aktionen im Skript, Produktrelevanz und Empfehlung. Dauer in Sekunden, einzelner Lauf, `FT_PARALLEL=3`.


### 5.1 Handler-Dialog und Kanäle (Dialogkern mit 5b9 entfernt) (15 Skripte)

**`ab2`** (nicht historisch markiert, 15 Zeilen)  
- Zweck (aus dem Skriptinhalt abgeleitet): Antworten des Handlers auf Abfragen (Zeit, Standort, Alias, Phase, Verstärkung) über `antwortFuer`, danach Sichtung im Dossier.
- Reproduktion auf `main`: `cd tests && node runall.js ab2`; auf `1cb1195` im dort ausgecheckten Ordner gleich.
- `1cb1195`: rot (17.9 s), erster Fehler: `page.evaluate: ReferenceError: antwortFuer is not defined`
- `5c5a545`: rot (15.6 s), erster Fehler: `page.evaluate: ReferenceError: IZ is not defined`
- Ursachenklasse (Basisstand): E1 
- Auf `main` nicht vorhandene Namen im Skript (ohne `IZ`): `antwortFuer`; nicht vorhandene Aktionen: `KENNWORT_SCHALTER`, `MISSION_ANGENOMMEN`, `MISSION_ZUGEWIESEN`, `STATUS_GESETZT`
- Produktrelevanz: Funktionsumfang nicht mehr vorhanden. Der Teil „Sichtung im Dossier“ (`SICHTUNG_HINZU`, Reiter Sichtungen) besteht im Produkt und wird von Standardtests abgedeckt (`dossier-maske`, `dossier-sperre`).
- Empfehlung: Ausmusterung vormerken (Entscheidung Master Wayne): getesteter Umfang nicht mehr vorhanden; keine Löschung, keine Änderung der Registrierung.

**`au`** (historisch markiert, 44 Zeilen)  
- Zweck (aus dem Skriptinhalt abgeleitet): Ausfallsicherheit: Speicher erholt sich nach vollem `localStorage`; Plan- und Handlerabläufe.
- Reproduktion auf `main`: `cd tests && node runall.js au`; auf `1cb1195` im dort ausgecheckten Ordner gleich.
- `1cb1195`: rot (15.5 s), erster Fehler: `page.evaluate: TypeError: Cannot read properties of undefined (reading 'kanaele')`
- `5c5a545`: rot (14.2 s), erster Fehler: `page.evaluate: ReferenceError: IZ is not defined`
- Ursachenklasse (Basisstand): E2 
- Auf `main` nicht vorhandene Namen im Skript (ohne `IZ`): `akteurDaten`, `antwortFuer`; nicht vorhandene Aktionen: `FAELLIG`, `KENNWORT_SCHALTER`, `MISSION_ANGENOMMEN`, `MISSION_ZUGEWIESEN`, `NACHRICHT_GESENDET`, `STATUS_GESETZT`
- Produktrelevanz: Funktionsumfang nicht mehr vorhanden. Der Teil „Speicher erholt sich nach vollem localStorage“ besteht im Produkt und wird von `speicher-voll` (Standard) geprüft.
- Empfehlung: Als historisch belassen (bestehende Festlegung in `runall.js`); Ausmusterung nur nach gesonderter Entscheidung.

**`db`** (nicht historisch markiert, 27 Zeilen)  
- Zweck (aus dem Skriptinhalt abgeleitet): Sichtungsmodus im Handler-Kanal (`#btn-sichtung`, `#km-text`): Meldungen zu P-0001 und die Antwort des Handlers.
- Reproduktion auf `main`: `cd tests && node runall.js db`; auf `1cb1195` im dort ausgecheckten Ordner gleich.
- `1cb1195`: rot (44.1 s), erster Fehler: `FAIL Button sichtbar (laufender Auftrag?)`
- `5c5a545`: rot (14.3 s), erster Fehler: `page.evaluate: ReferenceError: IZ is not defined`
- Ursachenklasse (Basisstand): E3 
- Auf `main` nicht vorhandene Namen im Skript (ohne `IZ`): keine; nicht vorhandene Aktionen: `KENNWORT_SCHALTER`, `MISSION_ANGENOMMEN`, `MISSION_BEGINN_JETZT`, `MISSION_ZUGEWIESEN`, `STATUS_GESETZT`
- Produktrelevanz: Funktionsumfang nicht mehr vorhanden.
- Empfehlung: Ausmusterung vormerken (Entscheidung Master Wayne): getesteter Umfang nicht mehr vorhanden; keine Löschung, keine Änderung der Registrierung.

**`dl`** (nicht historisch markiert, 9 Zeilen)  
- Zweck (aus dem Skriptinhalt abgeleitet): Handler-Antworten zu Personen und Verbindungen (`antwortFuer`), Ausgabe je Frage.
- Reproduktion auf `main`: `cd tests && node runall.js dl`; auf `1cb1195` im dort ausgecheckten Ordner gleich.
- `1cb1195`: rot (16.4 s), erster Fehler: `page.evaluate: ReferenceError: antwortFuer is not defined`
- `5c5a545`: rot (14.2 s), erster Fehler: `page.evaluate: ReferenceError: IZ is not defined`
- Ursachenklasse (Basisstand): E1 
- Auf `main` nicht vorhandene Namen im Skript (ohne `IZ`): `antwortFuer`; nicht vorhandene Aktionen: `MISSION_ANGENOMMEN`, `MISSION_ZUGEWIESEN`, `STATUS_GESETZT`
- Produktrelevanz: Funktionsumfang nicht mehr vorhanden.
- Empfehlung: Ausmusterung vormerken (Entscheidung Master Wayne): getesteter Umfang nicht mehr vorhanden; keine Löschung, keine Änderung der Registrierung.

**`dp`** (historisch markiert, 60 Zeilen)  
- Zweck (aus dem Skriptinhalt abgeleitet): DISPO-Abweichung: Schaltfläche „Abweichende Einschätzung an Handler“, Handlerkanal mit Entwurf, zweite Durchsicht.
- Reproduktion auf `main`: `cd tests && node runall.js dp`; auf `1cb1195` im dort ausgecheckten Ordner gleich.
- `1cb1195`: rot (16.1 s), erster Fehler: `page.evaluate: TypeError: Cannot set properties of null (setting 'beginn')`
- `5c5a545`: rot (16.2 s), erster Fehler: `page.evaluate: TypeError: Cannot set properties of null (setting 'beginn')`
- Ursachenklasse (Basisstand): E2 
- Auf `main` nicht vorhandene Namen im Skript (ohne `IZ`): keine; nicht vorhandene Aktionen: `DOKUMENT_EINGEREICHT`, `DOSSIER_GEWAEHLT`, `KENNWORT_SCHALTER`, `MISSION_ANGENOMMEN`, `MISSION_ZUGEWIESEN`, `NACHRICHT_GESENDET`, `NACHRICHT_TEXT_GEAENDERT`, `STATUS_GESETZT`, `ZONE_GEAENDERT`
- Produktrelevanz: Funktionsumfang nicht mehr vorhanden.
- Empfehlung: Als historisch belassen (bestehende Festlegung in `runall.js`); Ausmusterung nur nach gesonderter Entscheidung.

**`er`** (nicht historisch markiert, 19 Zeilen)  
- Zweck (aus dem Skriptinhalt abgeleitet): Erkennung (`ERK`): Markierung „unpassend“ im Handler-Chat und Panel im Profil.
- Reproduktion auf `main`: `cd tests && node runall.js er`; auf `1cb1195` im dort ausgecheckten Ordner gleich.
- `1cb1195`: rot (45.7 s), erster Fehler: `name: 'TimeoutError' | } | @ er.js:8`
- `5c5a545`: rot (14.5 s), erster Fehler: `page.evaluate: ReferenceError: IZ is not defined`
- Ursachenklasse (Basisstand): E3 
- Auf `main` nicht vorhandene Namen im Skript (ohne `IZ`): keine; nicht vorhandene Aktionen: `KENNWORT_SCHALTER`, `MISSION_ANGENOMMEN`, `MISSION_ZUGEWIESEN`, `STATUS_GESETZT`
- Produktrelevanz: Funktionsumfang nicht mehr vorhanden.
- Empfehlung: Ausmusterung vormerken (Entscheidung Master Wayne): getesteter Umfang nicht mehr vorhanden; keine Löschung, keine Änderung der Registrierung.

**`ev`** (nicht historisch markiert, 10 Zeilen)  
- Zweck (aus dem Skriptinhalt abgeleitet): Debug-Ausgabe: Verlaufseinträge und Ereignisse nach Verstärkungsanforderung und Chatmeldung.
- Reproduktion auf `main`: `cd tests && node runall.js ev`; auf `1cb1195` im dort ausgecheckten Ordner gleich.
- `1cb1195`: rot (16.3 s), erster Fehler: `page.evaluate: ReferenceError: akteurDaten is not defined`
- `5c5a545`: rot (13.4 s), erster Fehler: `page.evaluate: ReferenceError: IZ is not defined`
- Ursachenklasse (Basisstand): E1 
- Auf `main` nicht vorhandene Namen im Skript (ohne `IZ`): `akteurDaten`; nicht vorhandene Aktionen: `KENNWORT_SCHALTER`, `MISSION_ANGENOMMEN`, `MISSION_ZUGEWIESEN`, `NACHRICHT_GESENDET`, `STATUS_GESETZT`, `VERSTAERKUNG_ANGEFORDERT`
- Produktrelevanz: Funktionsumfang nicht mehr vorhanden.
- Empfehlung: Ausmusterung vormerken (Entscheidung Master Wayne): getesteter Umfang nicht mehr vorhanden; keine Löschung, keine Änderung der Registrierung.

**`fd`** (historisch markiert, 26 Zeilen)  
- Zweck (aus dem Skriptinhalt abgeleitet): Handler-Dialog „support >“ (Diagnoseausgabe, keine Prüfung).
- Reproduktion auf `main`: `cd tests && node runall.js fd`; auf `1cb1195` im dort ausgecheckten Ordner gleich.
- `1cb1195`: rot (17 s), erster Fehler: `page.evaluate: ReferenceError: antwortFuer is not defined`
- `5c5a545`: rot (15.3 s), erster Fehler: `page.evaluate: ReferenceError: IZ is not defined`
- Ursachenklasse (Basisstand): E1 
- Auf `main` nicht vorhandene Namen im Skript (ohne `IZ`): `antwortFuer`; nicht vorhandene Aktionen: `KENNWORT_SCHALTER`, `MISSION_ANGENOMMEN`, `MISSION_BEGINN_JETZT`, `MISSION_ZUGEWIESEN`, `STATUS_GESETZT`
- Produktrelevanz: Funktionsumfang nicht mehr vorhanden.
- Empfehlung: Als historisch belassen (bestehende Festlegung in `runall.js`); Ausmusterung nur nach gesonderter Entscheidung.

**`fd2`** (nicht historisch markiert, 20 Zeilen)  
- Zweck (aus dem Skriptinhalt abgeleitet): Handler-Dialog zu Budget und Plan („Budget Plan“, „Neumann Plan“), Ausgabe ohne Prüfung.
- Reproduktion auf `main`: `cd tests && node runall.js fd2`; auf `1cb1195` im dort ausgecheckten Ordner gleich.
- `1cb1195`: rot (15.9 s), erster Fehler: `page.evaluate: TypeError: Cannot read properties of undefined (reading 'filter')`
- `5c5a545`: rot (13.9 s), erster Fehler: `page.evaluate: ReferenceError: IZ is not defined`
- Ursachenklasse (Basisstand): E2 
- Auf `main` nicht vorhandene Namen im Skript (ohne `IZ`): keine; nicht vorhandene Aktionen: `KENNWORT_SCHALTER`, `MISSION_ANGENOMMEN`, `MISSION_BEGINN_JETZT`, `MISSION_ZUGEWIESEN`, `NACHRICHT_GESENDET`, `STATUS_GESETZT`
- Produktrelevanz: Funktionsumfang nicht mehr vorhanden.
- Empfehlung: Ausmusterung vormerken (Entscheidung Master Wayne): getesteter Umfang nicht mehr vorhanden; keine Löschung, keine Änderung der Registrierung.

**`md`** (nicht historisch markiert, 8 Zeilen)  
- Zweck (aus dem Skriptinhalt abgeleitet): Handler-Antworten auf Statusfragen (Freigaben, Ausrüstung, Identität, Termine, Berichte), Ausgabe.
- Reproduktion auf `main`: `cd tests && node runall.js md`; auf `1cb1195` im dort ausgecheckten Ordner gleich.
- `1cb1195`: rot (14.9 s), erster Fehler: `page.evaluate: ReferenceError: antwortFuer is not defined`
- `5c5a545`: rot (14.9 s), erster Fehler: `page.evaluate: ReferenceError: IZ is not defined`
- Ursachenklasse (Basisstand): E1 
- Auf `main` nicht vorhandene Namen im Skript (ohne `IZ`): `antwortFuer`; nicht vorhandene Aktionen: `KENNWORT_SCHALTER`, `MISSION_ANGENOMMEN`, `MISSION_ZUGEWIESEN`, `STATUS_GESETZT`
- Produktrelevanz: Funktionsumfang nicht mehr vorhanden.
- Empfehlung: Ausmusterung vormerken (Entscheidung Master Wayne): getesteter Umfang nicht mehr vorhanden; keine Löschung, keine Änderung der Registrierung.

**`p2`** (historisch markiert, 72 Zeilen)  
- Zweck (aus dem Skriptinhalt abgeleitet): Umbenennung (Ausgangsort/Name): Skriptmeldung und gesendete Nachricht folgen dem neuen Namen (`sendeSkript`).
- Reproduktion auf `main`: `cd tests && node runall.js p2`; auf `1cb1195` im dort ausgecheckten Ordner gleich.
- `1cb1195`: rot (14.2 s), erster Fehler: `page.evaluate: ReferenceError: sendeSkript is not defined`
- `5c5a545`: rot (15.4 s), erster Fehler: `page.evaluate: ReferenceError: IZ is not defined`
- Ursachenklasse (Basisstand): E1 
- Auf `main` nicht vorhandene Namen im Skript (ohne `IZ`): `akteurDaten`, `antwortFuer`, `sendeSkript`; nicht vorhandene Aktionen: `FAELLIG`, `KENNWORT_SCHALTER`, `MISSION_ANGENOMMEN`, `MISSION_ZUGEWIESEN`, `NACHRICHT_GESENDET`, `STATUS_GESETZT`
- Produktrelevanz: Funktionsumfang nicht mehr vorhanden.
- Empfehlung: Als historisch belassen (bestehende Festlegung in `runall.js`); Ausmusterung nur nach gesonderter Entscheidung.

**`sh`** (nicht historisch markiert, 10 Zeilen)  
- Zweck (aus dem Skriptinhalt abgeleitet): Debug-Ausgabe: Handler-Nachrichten im Reiter Kommunikation mit Bildschirmfoto.
- Reproduktion auf `main`: `cd tests && node runall.js sh`; auf `1cb1195` im dort ausgecheckten Ordner gleich.
- `1cb1195`: rot (14.2 s), erster Fehler: `page.evaluate: TypeError: Cannot read properties of undefined (reading 'kanaele')`
- `5c5a545`: rot (17.5 s), erster Fehler: `page.evaluate: ReferenceError: IZ is not defined`
- Ursachenklasse (Basisstand): E2 
- Auf `main` nicht vorhandene Namen im Skript (ohne `IZ`): keine; nicht vorhandene Aktionen: `MISSION_ANGENOMMEN`, `MISSION_ZUGEWIESEN`, `STATUS_GESETZT`
- Produktrelevanz: Funktionsumfang nicht mehr vorhanden.
- Empfehlung: Ausmusterung vormerken (Entscheidung Master Wayne): getesteter Umfang nicht mehr vorhanden; keine Löschung, keine Änderung der Registrierung.

**`sk`** (nicht historisch markiert, 54 Zeilen)  
- Zweck (aus dem Skriptinhalt abgeleitet): Funkruhe/Schweigen im Handler-Kanal (`#btn-funkruhe`): erste Antwort, Schweigen gesetzt, keine weitere Antwort.
- Reproduktion auf `main`: `cd tests && node runall.js sk`; auf `1cb1195` im dort ausgecheckten Ordner gleich.
- `1cb1195`: rot (12.8 s), erster Fehler: `page.evaluate: TypeError: Cannot set properties of null (setting 'beginn')`
- `5c5a545`: rot (15.8 s), erster Fehler: `page.evaluate: ReferenceError: IZ is not defined`
- Ursachenklasse (Basisstand): E2 
- Auf `main` nicht vorhandene Namen im Skript (ohne `IZ`): `akteurDaten`; nicht vorhandene Aktionen: `FAELLIG`, `KENNWORT_SCHALTER`, `MISSION_ANGENOMMEN`, `MISSION_ZUGEWIESEN`, `NACHRICHT_GESENDET`, `STATUS_GESETZT`
- Produktrelevanz: Funktionsumfang nicht mehr vorhanden. Nahezu identische Kopie von `sk_d` (zwei Zeilen unterscheiden sich).
- Empfehlung: Ausmusterung vormerken (Entscheidung Master Wayne): getesteter Umfang nicht mehr vorhanden; keine Löschung, keine Änderung der Registrierung.

**`sk_d`** (nicht historisch markiert, 54 Zeilen)  
- Zweck (aus dem Skriptinhalt abgeleitet): Variante von `sk` mit zusätzlicher Debug-Ausgabe der letzten Nachrichten und `akteurDaten`.
- Reproduktion auf `main`: `cd tests && node runall.js sk_d`; auf `1cb1195` im dort ausgecheckten Ordner gleich.
- `1cb1195`: rot (13.6 s), erster Fehler: `page.evaluate: TypeError: Cannot set properties of null (setting 'beginn')`
- `5c5a545`: rot (15.4 s), erster Fehler: `page.evaluate: ReferenceError: IZ is not defined`
- Ursachenklasse (Basisstand): E2 
- Auf `main` nicht vorhandene Namen im Skript (ohne `IZ`): `akteurDaten`; nicht vorhandene Aktionen: `FAELLIG`, `KENNWORT_SCHALTER`, `MISSION_ANGENOMMEN`, `MISSION_ZUGEWIESEN`, `NACHRICHT_GESENDET`, `STATUS_GESETZT`
- Produktrelevanz: Funktionsumfang nicht mehr vorhanden. Nahezu identische Kopie von `sk`.
- Empfehlung: Ausmusterung vormerken (Entscheidung Master Wayne): getesteter Umfang nicht mehr vorhanden; keine Löschung, keine Änderung der Registrierung.

**`wk3`** (historisch markiert, 29 Zeilen)  
- Zweck (aus dem Skriptinhalt abgeleitet): Sichtung und Einschätzung per Chat zu bekannter Person (`nachrichtSenden`).
- Reproduktion auf `main`: `cd tests && node runall.js wk3`; auf `1cb1195` im dort ausgecheckten Ordner gleich.
- `1cb1195`: rot (13 s), erster Fehler: `page.evaluate: TypeError: Cannot read properties of undefined (reading 'kanaele')`
- `5c5a545`: rot (13.7 s), erster Fehler: `page.evaluate: TypeError: Cannot read properties of undefined (reading 'kanaele')`
- Ursachenklasse (Basisstand): E2 
- Auf `main` nicht vorhandene Namen im Skript (ohne `IZ`): `nachrichtSenden`; nicht vorhandene Aktionen: `KENNWORT_SCHALTER`, `MISSION_ANGENOMMEN`, `MISSION_BEGINN_JETZT`, `MISSION_ZUGEWIESEN`, `STATUS_GESETZT`
- Produktrelevanz: Funktionsumfang nicht mehr vorhanden.
- Empfehlung: Als historisch belassen (bestehende Festlegung in `runall.js`); Ausmusterung nur nach gesonderter Entscheidung.

### 5.2 Missionsablauf, Plan und Auftrag (Missionsbetrieb mit 5b7 stillgelegt) (11 Skripte)

**`ab`** (nicht historisch markiert, 36 Zeilen)  
- Zweck (aus dem Skriptinhalt abgeleitet): Einsatzbeginn und Vorlaufplan der Altmission M1: Fälligkeit der Planeinträge, Handler-Nachrichten, „Start in h“.
- Reproduktion auf `main`: `cd tests && node runall.js ab`; auf `1cb1195` im dort ausgecheckten Ordner gleich.
- `1cb1195`: rot (18 s), erster Fehler: `page.evaluate: TypeError: Cannot read properties of undefined (reading 'some')`
- `5c5a545`: rot (16.6 s), erster Fehler: `page.evaluate: ReferenceError: IZ is not defined`
- Ursachenklasse (Basisstand): E2 
- Auf `main` nicht vorhandene Namen im Skript (ohne `IZ`): `meldeAktiv`; nicht vorhandene Aktionen: `FAELLIG`, `KENNWORT_SCHALTER`, `MISSION_ABGEBROCHEN`, `MISSION_ANGENOMMEN`, `MISSION_ZUGEWIESEN`, `NACHRICHT_GESENDET`, `STATUS_GESETZT`
- Produktrelevanz: Funktionsumfang nicht mehr vorhanden.
- Empfehlung: Ausmusterung vormerken (Entscheidung Master Wayne): getesteter Umfang nicht mehr vorhanden; keine Löschung, keine Änderung der Registrierung.

**`abd`** (historisch markiert, 81 Zeilen)  
- Zweck (aus dem Skriptinhalt abgeleitet): Abdruck (Spuren) der Akteure `legende` und `asset` über `abdWert`, `abdSpur`, Sperren und Kontakte.
- Reproduktion auf `main`: `cd tests && node runall.js abd`; auf `1cb1195` im dort ausgecheckten Ordner gleich.
- `1cb1195`: rot (17.9 s), erster Fehler: `page.evaluate: ReferenceError: abdWert is not defined`
- `5c5a545`: rot (14.6 s), erster Fehler: `page.evaluate: ReferenceError: abdWert is not defined`
- Ursachenklasse (Basisstand): E1 
- Auf `main` nicht vorhandene Namen im Skript (ohne `IZ`): `FG_ARTEN`, `abdPruefen`, `abdS`, `abdSperre`, `abdSpur`, `abdStufe`, `abdWert`, `akteurDaten`, `fgBewerten`, `oeffneRegie`, `zustandAus`; nicht vorhandene Aktionen: `ABDRUCK_REGIE`, `CHECKIN`, `CHECKIN_AUSWEICH`, `KENNWORT_SCHALTER`, `MISSION_ANGENOMMEN`, `MISSION_BEGINN_JETZT`, `MISSION_ZUGEWIESEN`, `NACHRICHT_GESENDET`, `STATUS_GESETZT`
- Produktrelevanz: Funktionsumfang nicht mehr vorhanden.
- Empfehlung: Als historisch belassen (bestehende Festlegung in `runall.js`); Ausmusterung nur nach gesonderter Entscheidung.

**`ag0`** (nicht historisch markiert, 8 Zeilen)  
- Zweck (aus dem Skriptinhalt abgeleitet): Kurzsondierung: Missionsstatus nach `MISSION_ANGENOMMEN` und Text der Missionsansicht (Ausgabe, keine Prüfung).
- Reproduktion auf `main`: `cd tests && node runall.js ag0`; auf `1cb1195` im dort ausgecheckten Ordner gleich.
- `1cb1195`: rot (16.1 s), erster Fehler: `page.evaluate: TypeError: Cannot read properties of null (reading 'status')`
- `5c5a545`: rot (15.4 s), erster Fehler: `page.evaluate: ReferenceError: IZ is not defined`
- Ursachenklasse (Basisstand): E2 
- Auf `main` nicht vorhandene Namen im Skript (ohne `IZ`): keine; nicht vorhandene Aktionen: `MISSION_ANGENOMMEN`, `STATUS_GESETZT`
- Produktrelevanz: Funktionsumfang nicht mehr vorhanden.
- Empfehlung: Ausmusterung vormerken (Entscheidung Master Wayne): getesteter Umfang nicht mehr vorhanden; keine Löschung, keine Änderung der Registrierung.

**`al`** (historisch markiert, 79 Zeilen)  
- Zweck (aus dem Skriptinhalt abgeleitet): Alterung der Altmission über `ALTERUNG_REGIE` (Regieaktion) mit Rudiment- und Prüffunktionen.
- Reproduktion auf `main`: `cd tests && node runall.js al`; auf `1cb1195` im dort ausgecheckten Ordner gleich.
- `1cb1195`: rot (15.2 s), erster Fehler: `page.evaluate: TypeError: ACTIONS.ALTERUNG_REGIE is not a function`
- `5c5a545`: rot (16.2 s), erster Fehler: `page.evaluate: TypeError: ACTIONS.ALTERUNG_REGIE is not a function`
- Ursachenklasse (Basisstand): E1 
- Auf `main` nicht vorhandene Namen im Skript (ohne `IZ`): `FG_ARTEN`, `akteurDaten`, `einreichPruefung`, `fgBewerten`, `oeffneRegie`, `rudimentAnsicht`, `undefined`, `zonenUrteil`; nicht vorhandene Aktionen: `ALTERUNG_REGIE`, `INFO_EINGEREICHT`, `KENNWORT_SCHALTER`, `MISSION_ANGENOMMEN`, `MISSION_BEGINN_JETZT`, `MISSION_ZUGEWIESEN`, `STATUS_GESETZT`, `ZONE_GEAENDERT`, `ZONE_GEMELDET`
- Produktrelevanz: Funktionsumfang nicht mehr vorhanden.
- Empfehlung: Als historisch belassen (bestehende Festlegung in `runall.js`); Ausmusterung nur nach gesonderter Entscheidung.

**`be`** (nicht historisch markiert, 17 Zeilen)  
- Zweck (aus dem Skriptinhalt abgeleitet): Extraktion (Stufe, Begründung) und Anreiseplanung (`anreiseBewerten`).
- Reproduktion auf `main`: `cd tests && node runall.js be`; auf `1cb1195` im dort ausgecheckten Ordner gleich.
- `1cb1195`: rot (45.9 s), erster Fehler: `name: 'TimeoutError' | } | @ be.js:7`
- `5c5a545`: rot (14 s), erster Fehler: `page.evaluate: ReferenceError: IZ is not defined`
- Ursachenklasse (Basisstand): E3 
- Auf `main` nicht vorhandene Namen im Skript (ohne `IZ`): `anreiseBewerten`; nicht vorhandene Aktionen: `ANREISE_EINGEREICHT`, `MISSION_ANGENOMMEN`, `MISSION_ZUGEWIESEN`, `STATUS_GESETZT`
- Produktrelevanz: Funktionsumfang nicht mehr vorhanden.
- Empfehlung: Ausmusterung vormerken (Entscheidung Master Wayne): getesteter Umfang nicht mehr vorhanden; keine Löschung, keine Änderung der Registrierung.

**`ent`** (nicht historisch markiert, 9 Zeilen)  
- Zweck (aus dem Skriptinhalt abgeleitet): Debug-Ausgabe: Entitäten des Pools und Ziele/Standorte der Kontextmission (`KM()`), ohne Prüfung.
- Reproduktion auf `main`: `cd tests && node runall.js ent`; auf `1cb1195` im dort ausgecheckten Ordner gleich.
- `1cb1195`: rot (15 s), erster Fehler: `page.evaluate: TypeError: Cannot read properties of null (reading 'ziele')`
- `5c5a545`: rot (14.7 s), erster Fehler: `page.evaluate: ReferenceError: IZ is not defined`
- Ursachenklasse (Basisstand): E2 
- Auf `main` nicht vorhandene Namen im Skript (ohne `IZ`): keine; nicht vorhandene Aktionen: `KENNWORT_SCHALTER`, `MISSION_ANGENOMMEN`, `MISSION_ZUGEWIESEN`, `STATUS_GESETZT`
- Produktrelevanz: Funktionsumfang nicht mehr vorhanden.
- Empfehlung: Ausmusterung vormerken (Entscheidung Master Wayne): getesteter Umfang nicht mehr vorhanden; keine Löschung, keine Änderung der Registrierung.

**`fc`** (nicht historisch markiert, 43 Zeilen)  
- Zweck (aus dem Skriptinhalt abgeleitet): Frühes Check-in mit Quittung (`#btn-frueh-checkin`), Bewertung erst nach Quittung, Einsatz läuft.
- Reproduktion auf `main`: `cd tests && node runall.js fc`; auf `1cb1195` im dort ausgecheckten Ordner gleich.
- `1cb1195`: rot (15.1 s), erster Fehler: `page.evaluate: TypeError: Cannot read properties of undefined (reading 'some')`
- `5c5a545`: rot (13.4 s), erster Fehler: `page.evaluate: ReferenceError: IZ is not defined`
- Ursachenklasse (Basisstand): E2 
- Auf `main` nicht vorhandene Namen im Skript (ohne `IZ`): keine; nicht vorhandene Aktionen: `FAELLIG`, `KENNWORT_SCHALTER`, `MISSION_ANGENOMMEN`, `MISSION_ZUGEWIESEN`, `NACHRICHT_GESENDET`, `STATUS_GESETZT`
- Produktrelevanz: Funktionsumfang nicht mehr vorhanden.
- Empfehlung: Ausmusterung vormerken (Entscheidung Master Wayne): getesteter Umfang nicht mehr vorhanden; keine Löschung, keine Änderung der Registrierung.

**`m1a`** (nicht historisch markiert, 12 Zeilen)  
- Zweck (aus dem Skriptinhalt abgeleitet): Mission M1 nach Annahme sichtbar („Mission sichtbar“).
- Reproduktion auf `main`: `cd tests && node runall.js m1a`; auf `1cb1195` im dort ausgecheckten Ordner gleich.
- `1cb1195`: rot (17.6 s), erster Fehler: `FAIL Mission sichtbar | keine Fehler`
- `5c5a545`: rot (14.5 s), erster Fehler: `page.evaluate: ReferenceError: IZ is not defined`
- Ursachenklasse (Basisstand): E3 
- Auf `main` nicht vorhandene Namen im Skript (ohne `IZ`): keine; nicht vorhandene Aktionen: `MISSION_ANGENOMMEN`, `MISSION_ZUGEWIESEN`, `STATUS_GESETZT`
- Produktrelevanz: Funktionsumfang nicht mehr vorhanden.
- Empfehlung: Ausmusterung vormerken (Entscheidung Master Wayne): getesteter Umfang nicht mehr vorhanden; keine Löschung, keine Änderung der Registrierung.

**`m1end`** (nicht historisch markiert, 23 Zeilen)  
- Zweck (aus dem Skriptinhalt abgeleitet): Abschluss und Nachbereitung von M1 (`MISSION_ABGESCHLOSSEN`, `NACHBEREITUNG_SCHRITT`).
- Reproduktion auf `main`: `cd tests && node runall.js m1end`; auf `1cb1195` im dort ausgecheckten Ordner gleich.
- `1cb1195`: rot (15.1 s), erster Fehler: `page.evaluate: TypeError: Cannot set properties of null (setting 'beginn')`
- `5c5a545`: rot (15 s), erster Fehler: `page.evaluate: ReferenceError: IZ is not defined`
- Ursachenklasse (Basisstand): E2 
- Auf `main` nicht vorhandene Namen im Skript (ohne `IZ`): keine; nicht vorhandene Aktionen: `MISSION_ABGESCHLOSSEN`, `MISSION_ANGENOMMEN`, `MISSION_ZUGEWIESEN`, `NACHBEREITUNG_SCHRITT`, `STATUS_GESETZT`, `ZIEL_GESETZT`
- Produktrelevanz: Funktionsumfang nicht mehr vorhanden.
- Empfehlung: Ausmusterung vormerken (Entscheidung Master Wayne): getesteter Umfang nicht mehr vorhanden; keine Löschung, keine Änderung der Registrierung.

**`m1flow`** (historisch markiert, 55 Zeilen)  
- Zweck (aus dem Skriptinhalt abgeleitet): Gesamtablauf M1: Dokument-, Zugriffs- und Eigenes-Ziel-Panel, Abbruch, Zielerreichung.
- Reproduktion auf `main`: `cd tests && node runall.js m1flow`; auf `1cb1195` im dort ausgecheckten Ordner gleich.
- `1cb1195`: rot (15.7 s), erster Fehler: `page.evaluate: TypeError: Cannot set properties of null (setting 'beginn')`
- `5c5a545`: rot (15.8 s), erster Fehler: `page.evaluate: ReferenceError: IZ is not defined`
- Ursachenklasse (Basisstand): E2 
- Auf `main` nicht vorhandene Namen im Skript (ohne `IZ`): `zielIst`; nicht vorhandene Aktionen: `MISSION_ABGEBROCHEN`, `MISSION_ANGENOMMEN`, `MISSION_ZUGEWIESEN`, `STATUS_GESETZT`, `ZIEL_GESETZT`
- Produktrelevanz: Funktionsumfang nicht mehr vorhanden.
- Empfehlung: Als historisch belassen (bestehende Festlegung in `runall.js`); Ausmusterung nur nach gesonderter Entscheidung.

**`nd`** (nicht historisch markiert, 26 Zeilen)  
- Zweck (aus dem Skriptinhalt abgeleitet): Serienende, neuer Auftrag, Neustart nach Abbruch (`MISSION_ABGEBROCHEN`, `neuer_auftrag`).
- Reproduktion auf `main`: `cd tests && node runall.js nd`; auf `1cb1195` im dort ausgecheckten Ordner gleich.
- `1cb1195`: rot (15.1 s), erster Fehler: `page.evaluate: TypeError: Cannot read properties of undefined (reading 'kanaele')`
- `5c5a545`: rot (15.5 s), erster Fehler: `page.evaluate: ReferenceError: IZ is not defined`
- Ursachenklasse (Basisstand): E2 
- Auf `main` nicht vorhandene Namen im Skript (ohne `IZ`): `zugewiesene`; nicht vorhandene Aktionen: `FAELLIG`, `KENNWORT_SCHALTER`, `MISSION_ABGEBROCHEN`, `MISSION_ANGENOMMEN`, `MISSION_ZUGEWIESEN`, `STATUS_GESETZT`
- Produktrelevanz: Funktionsumfang nicht mehr vorhanden.
- Empfehlung: Ausmusterung vormerken (Entscheidung Master Wayne): getesteter Umfang nicht mehr vorhanden; keine Löschung, keine Änderung der Registrierung.

### 5.3 Freigaben, Verstärkung und Begründungsprüfung (Missionsmechanik) (9 Skripte)

**`bg`** (nicht historisch markiert, 9 Zeilen)  
- Zweck (aus dem Skriptinhalt abgeleitet): Bewertung von Verstärkungsanforderungen nach Begründungstext (`vkBewerten`), Ausgabe je Testsatz.
- Reproduktion auf `main`: `cd tests && node runall.js bg`; auf `1cb1195` im dort ausgecheckten Ordner gleich.
- `1cb1195`: rot (16.5 s), erster Fehler: `page.evaluate: ReferenceError: vkBewerten is not defined`
- `5c5a545`: rot (16.2 s), erster Fehler: `page.evaluate: ReferenceError: IZ is not defined`
- Ursachenklasse (Basisstand): E1 
- Auf `main` nicht vorhandene Namen im Skript (ohne `IZ`): `vkBewerten`; nicht vorhandene Aktionen: `KENNWORT_SCHALTER`, `MISSION_ANGENOMMEN`, `MISSION_ZUGEWIESEN`, `STATUS_GESETZT`
- Produktrelevanz: Funktionsumfang nicht mehr vorhanden.
- Empfehlung: Ausmusterung vormerken (Entscheidung Master Wayne): getesteter Umfang nicht mehr vorhanden; keine Löschung, keine Änderung der Registrierung.

**`bg2`** (nicht historisch markiert, 14 Zeilen)  
- Zweck (aus dem Skriptinhalt abgeleitet): Bewertung von Freigabeanträgen nach Begründung (`FREIGABE_BEANTRAGT`, `FGL`).
- Reproduktion auf `main`: `cd tests && node runall.js bg2`; auf `1cb1195` im dort ausgecheckten Ordner gleich.
- `1cb1195`: rot (15.7 s), erster Fehler: `page.evaluate: ReferenceError: FGL is not defined`
- `5c5a545`: rot (14.3 s), erster Fehler: `page.evaluate: ReferenceError: IZ is not defined`
- Ursachenklasse (Basisstand): E1 
- Auf `main` nicht vorhandene Namen im Skript (ohne `IZ`): `FGL`; nicht vorhandene Aktionen: `FREIGABE_BEANTRAGT`, `MISSION_ANGENOMMEN`, `MISSION_ZUGEWIESEN`, `STATUS_GESETZT`
- Produktrelevanz: Funktionsumfang nicht mehr vorhanden.
- Empfehlung: Ausmusterung vormerken (Entscheidung Master Wayne): getesteter Umfang nicht mehr vorhanden; keine Löschung, keine Änderung der Registrierung.

**`ds2`** (historisch markiert, 62 Zeilen)  
- Zweck (aus dem Skriptinhalt abgeleitet): Dossier-Rudiment: Standortfeld, Fotofeld, Quellenformular und Einschätzung (`INFO_EINGEREICHT`, `EINSCHAETZUNG_GESETZT`).
- Reproduktion auf `main`: `cd tests && node runall.js ds2`; auf `1cb1195` im dort ausgecheckten Ordner gleich.
- `1cb1195`: rot (46.2 s), erster Fehler: `FAIL Standort sichtbar | FAIL Fotofeld da | FAIL Quellenformular @ ds2.js:25`
- `5c5a545`: rot (46.1 s), erster Fehler: `FAIL Standort sichtbar | FAIL Fotofeld da | FAIL Quellenformular @ ds2.js:25`
- Ursachenklasse (Basisstand): E3 
- Auf `main` nicht vorhandene Namen im Skript (ohne `IZ`): `einreichPruefung`, `rudimentAnsicht`; nicht vorhandene Aktionen: `EINSCHAETZUNG_GESETZT`, `INFO_EINGEREICHT`, `KENNWORT_SCHALTER`, `MISSION_ANGENOMMEN`, `MISSION_BEGINN_JETZT`, `MISSION_ZUGEWIESEN`, `STATUS_GESETZT`
- Produktrelevanz: Funktionsumfang nicht mehr vorhanden.
- Empfehlung: Als historisch belassen (bestehende Festlegung in `runall.js`); Ausmusterung nur nach gesonderter Entscheidung.

**`fg`** (historisch markiert, 20 Zeilen)  
- Zweck (aus dem Skriptinhalt abgeleitet): Freigabeliste (`FGL`, Reiter 9): Liste der Anträge.
- Reproduktion auf `main`: `cd tests && node runall.js fg`; auf `1cb1195` im dort ausgecheckten Ordner gleich.
- `1cb1195`: rot (15.9 s), erster Fehler: `page.evaluate: ReferenceError: FGL is not defined`
- `5c5a545`: rot (16 s), erster Fehler: `page.evaluate: ReferenceError: IZ is not defined`
- Ursachenklasse (Basisstand): E1 
- Auf `main` nicht vorhandene Namen im Skript (ohne `IZ`): `FGL`; nicht vorhandene Aktionen: `FREIGABE_BEANTRAGT`, `MISSION_ANGENOMMEN`, `MISSION_ZUGEWIESEN`, `STATUS_GESETZT`
- Produktrelevanz: Funktionsumfang nicht mehr vorhanden.
- Empfehlung: Als historisch belassen (bestehende Festlegung in `runall.js`); Ausmusterung nur nach gesonderter Entscheidung.

**`fg2`** (nicht historisch markiert, 19 Zeilen)  
- Zweck (aus dem Skriptinhalt abgeleitet): Freigabeanträge und Handler-Bewertung (`NACHRICHT_GESENDET`, `FGL`), Ausgabe.
- Reproduktion auf `main`: `cd tests && node runall.js fg2`; auf `1cb1195` im dort ausgecheckten Ordner gleich.
- `1cb1195`: rot (15.6 s), erster Fehler: `page.evaluate: TypeError: Cannot read properties of undefined (reading 'forEach')`
- `5c5a545`: rot (14.4 s), erster Fehler: `page.evaluate: ReferenceError: IZ is not defined`
- Ursachenklasse (Basisstand): E2 
- Auf `main` nicht vorhandene Namen im Skript (ohne `IZ`): `FGL`; nicht vorhandene Aktionen: `KENNWORT_SCHALTER`, `MISSION_ANGENOMMEN`, `MISSION_ZUGEWIESEN`, `NACHRICHT_GESENDET`, `STATUS_GESETZT`
- Produktrelevanz: Funktionsumfang nicht mehr vorhanden.
- Empfehlung: Ausmusterung vormerken (Entscheidung Master Wayne): getesteter Umfang nicht mehr vorhanden; keine Löschung, keine Änderung der Registrierung.

**`fg3`** (nicht historisch markiert, 21 Zeilen)  
- Zweck (aus dem Skriptinhalt abgeleitet): Freigabeanträge, weitere Fälle (`NACHRICHT_GESENDET`, `FGL`), Ausgabe.
- Reproduktion auf `main`: `cd tests && node runall.js fg3`; auf `1cb1195` im dort ausgecheckten Ordner gleich.
- `1cb1195`: rot (17.4 s), erster Fehler: `page.evaluate: TypeError: Cannot read properties of undefined (reading 'forEach')`
- `5c5a545`: rot (16.3 s), erster Fehler: `page.evaluate: ReferenceError: IZ is not defined`
- Ursachenklasse (Basisstand): E2 
- Auf `main` nicht vorhandene Namen im Skript (ohne `IZ`): `FGL`; nicht vorhandene Aktionen: `KENNWORT_SCHALTER`, `MISSION_ANGENOMMEN`, `MISSION_ZUGEWIESEN`, `NACHRICHT_GESENDET`, `STATUS_GESETZT`
- Produktrelevanz: Funktionsumfang nicht mehr vorhanden.
- Empfehlung: Ausmusterung vormerken (Entscheidung Master Wayne): getesteter Umfang nicht mehr vorhanden; keine Löschung, keine Änderung der Registrierung.

**`vk`** (nicht historisch markiert, 30 Zeilen)  
- Zweck (aus dem Skriptinhalt abgeleitet): Verstärkungsanforderung im Modul 8 (`#btn-vk`, `#vk-art`, `#vk-anz`, `#vk-beginn`, `#vk-zweck`, `vkStatus`).
- Reproduktion auf `main`: `cd tests && node runall.js vk`; auf `1cb1195` im dort ausgecheckten Ordner gleich.
- `1cb1195`: rot (45.9 s), erster Fehler: `FAIL Modul 8 sichtbar`
- `5c5a545`: rot (13.9 s), erster Fehler: `page.evaluate: ReferenceError: IZ is not defined`
- Ursachenklasse (Basisstand): E3 
- Auf `main` nicht vorhandene Namen im Skript (ohne `IZ`): `VK`, `vkStatus`; nicht vorhandene Aktionen: `MISSION_ANGENOMMEN`, `MISSION_ZUGEWIESEN`, `STATUS_GESETZT`
- Produktrelevanz: Funktionsumfang nicht mehr vorhanden.
- Empfehlung: Ausmusterung vormerken (Entscheidung Master Wayne): getesteter Umfang nicht mehr vorhanden; keine Löschung, keine Änderung der Registrierung.

**`zus`** (nicht historisch markiert, 19 Zeilen)  
- Zweck (aus dem Skriptinhalt abgeleitet): Zusatzakteur einer Mission zuordnen (`#btn-zusatz`, `#sel-zusatz`, `zusatzBewerten`).
- Reproduktion auf `main`: `cd tests && node runall.js zus`; auf `1cb1195` im dort ausgecheckten Ordner gleich.
- `1cb1195`: rot (13.6 s), erster Fehler: `page.evaluate: ReferenceError: missionsAbstand is not defined`
- `5c5a545`: rot (17 s), erster Fehler: `page.evaluate: ReferenceError: IZ is not defined`
- Ursachenklasse (Basisstand): E1 
- Auf `main` nicht vorhandene Namen im Skript (ohne `IZ`): `missionsAbstand`, `zusatzBewerten`; nicht vorhandene Aktionen: `MISSION_AKTEUR_ZUGEORDNET`, `MISSION_ANGENOMMEN`, `MISSION_ZUGEWIESEN`, `STATUS_GESETZT`
- Produktrelevanz: Funktionsumfang nicht mehr vorhanden.
- Empfehlung: Ausmusterung vormerken (Entscheidung Master Wayne): getesteter Umfang nicht mehr vorhanden; keine Löschung, keine Änderung der Registrierung.

**`zz`** (nicht historisch markiert, 8 Zeilen)  
- Zweck (aus dem Skriptinhalt abgeleitet): Begründungsprüfung (`begruendungPruefen`, `bgBezugWoerter`), Ausgabe.
- Reproduktion auf `main`: `cd tests && node runall.js zz`; auf `1cb1195` im dort ausgecheckten Ordner gleich.
- `1cb1195`: rot (14.3 s), erster Fehler: `page.evaluate: ReferenceError: begruendungPruefen is not defined`
- `5c5a545`: rot (14.6 s), erster Fehler: `page.evaluate: ReferenceError: IZ is not defined`
- Ursachenklasse (Basisstand): E1 
- Auf `main` nicht vorhandene Namen im Skript (ohne `IZ`): `VK`, `akteurDaten`, `begruendungPruefen`, `bgBezugWoerter`; nicht vorhandene Aktionen: `KENNWORT_SCHALTER`, `MISSION_ANGENOMMEN`, `MISSION_ZUGEWIESEN`, `STATUS_GESETZT`, `VERSTAERKUNG_ANGEFORDERT`
- Produktrelevanz: Funktionsumfang nicht mehr vorhanden.
- Empfehlung: Ausmusterung vormerken (Entscheidung Master Wayne): getesteter Umfang nicht mehr vorhanden; keine Löschung, keine Änderung der Registrierung.

### 5.4 Haltung, Vertrauen und Belastung der Akteure (Missionsmechanik) (6 Skripte)

**`kb`** (nicht historisch markiert, 22 Zeilen)  
- Zweck (aus dem Skriptinhalt abgeleitet): Haltung des Assets: `LM().haltung.asset.umfeld`, Vertrauen vor und ohne Hilfszusage (`akteurDaten`).
- Reproduktion auf `main`: `cd tests && node runall.js kb`; auf `1cb1195` im dort ausgecheckten Ordner gleich.
- `1cb1195`: rot (15.8 s), erster Fehler: `page.evaluate: TypeError: Cannot read properties of null (reading 'haltung')`
- `5c5a545`: rot (15.8 s), erster Fehler: `page.evaluate: ReferenceError: IZ is not defined`
- Ursachenklasse (Basisstand): E2 
- Auf `main` nicht vorhandene Namen im Skript (ohne `IZ`): `VK`, `akteurDaten`; nicht vorhandene Aktionen: `KENNWORT_SCHALTER`, `MISSION_ANGENOMMEN`, `MISSION_ZUGEWIESEN`, `NACHRICHT_GESENDET`, `STATUS_GESETZT`, `VERSTAERKUNG_ANGEFORDERT`
- Produktrelevanz: Funktionsumfang nicht mehr vorhanden.
- Empfehlung: Ausmusterung vormerken (Entscheidung Master Wayne): getesteter Umfang nicht mehr vorhanden; keine Löschung, keine Änderung der Registrierung.

**`kw`** (nicht historisch markiert, 64 Zeilen)  
- Zweck (aus dem Skriptinhalt abgeleitet): Kontaktwunsch und Prüfsatz (`kwAnstoss`, `#btn-kw`, `#btn-aw`), Check-in.
- Reproduktion auf `main`: `cd tests && node runall.js kw`; auf `1cb1195` im dort ausgecheckten Ordner gleich.
- `1cb1195`: rot (14.5 s), erster Fehler: `page.evaluate: TypeError: Cannot read properties of undefined (reading 'some')`
- `5c5a545`: rot (15.4 s), erster Fehler: `page.evaluate: TypeError: Cannot read properties of undefined (reading 'some')`
- Ursachenklasse (Basisstand): E2 
- Auf `main` nicht vorhandene Namen im Skript (ohne `IZ`): `akteurDaten`, `kwAnstoss`; nicht vorhandene Aktionen: `CHECKIN`, `CHECKIN_AUSWEICH`, `FAELLIG`, `KENNWORT_SCHALTER`, `MISSION_ANGENOMMEN`, `MISSION_ZUGEWIESEN`, `NACHRICHT_GESENDET`, `STATUS_GESETZT`
- Produktrelevanz: Funktionsumfang nicht mehr vorhanden.
- Empfehlung: Ausmusterung vormerken (Entscheidung Master Wayne): getesteter Umfang nicht mehr vorhanden; keine Löschung, keine Änderung der Registrierung.

**`proto`** (nicht historisch markiert, 35 Zeilen)  
- Zweck (aus dem Skriptinhalt abgeleitet): Protokoll zu Asset-Vertrauen: Drohung ohne Wirkung, Rückfrage gesetzt.
- Reproduktion auf `main`: `cd tests && node runall.js proto`; auf `1cb1195` im dort ausgecheckten Ordner gleich.
- `1cb1195`: rot (13.2 s), erster Fehler: `page.evaluate: TypeError: Cannot read properties of undefined (reading 'filter')`
- `5c5a545`: rot (14.9 s), erster Fehler: `page.evaluate: ReferenceError: IZ is not defined`
- Ursachenklasse (Basisstand): E2 
- Auf `main` nicht vorhandene Namen im Skript (ohne `IZ`): `akteurDaten`; nicht vorhandene Aktionen: `KENNWORT_SCHALTER`, `MISSION_ANGENOMMEN`, `MISSION_BEGINN_JETZT`, `MISSION_ZUGEWIESEN`, `NACHRICHT_GESENDET`, `STATUS_GESETZT`
- Produktrelevanz: Funktionsumfang nicht mehr vorhanden.
- Empfehlung: Ausmusterung vormerken (Entscheidung Master Wayne): getesteter Umfang nicht mehr vorhanden; keine Löschung, keine Änderung der Registrierung.

**`ru`** (nicht historisch markiert, 54 Zeilen)  
- Zweck (aus dem Skriptinhalt abgeleitet): Rückfragen und Vertrauen: Nachfrage im Standby, Antwort Vertrauen +1, ohne Antwort −2.
- Reproduktion auf `main`: `cd tests && node runall.js ru`; auf `1cb1195` im dort ausgecheckten Ordner gleich.
- `1cb1195`: rot (14.2 s), erster Fehler: `page.evaluate: TypeError: Cannot set properties of undefined (setting 'folge')`
- `5c5a545`: rot (16.1 s), erster Fehler: `page.evaluate: TypeError: Cannot set properties of undefined (setting 'folge')`
- Ursachenklasse (Basisstand): E2 
- Auf `main` nicht vorhandene Namen im Skript (ohne `IZ`): `akteurDaten`, `arListe`, `belS`, `zugewiesene`; nicht vorhandene Aktionen: `AUSRUESTUNG_ANFORDERN`, `FAELLIG`, `KENNWORT_SCHALTER`, `MISSION_ABGEBROCHEN`, `MISSION_ANGENOMMEN`, `MISSION_ZUGEWIESEN`, `NACHRICHT_GESENDET`, `STATUS_GESETZT`
- Produktrelevanz: Funktionsumfang nicht mehr vorhanden.
- Empfehlung: Ausmusterung vormerken (Entscheidung Master Wayne): getesteter Umfang nicht mehr vorhanden; keine Löschung, keine Änderung der Registrierung.

**`st`** (nicht historisch markiert, 30 Zeilen)  
- Zweck (aus dem Skriptinhalt abgeleitet): Belastungsmodell (Plateau, Atempause, Zuspruch, Kontaktkosten) über `zustandModulieren`, `dialogAntwort`.
- Reproduktion auf `main`: `cd tests && node runall.js st`; auf `1cb1195` im dort ausgecheckten Ordner gleich.
- `1cb1195`: rot (14.7 s), erster Fehler: `page.evaluate: TypeError: Cannot set properties of null (setting 'beginn')`
- `5c5a545`: rot (15.1 s), erster Fehler: `page.evaluate: TypeError: Cannot set properties of null (setting 'beginn')`
- Ursachenklasse (Basisstand): E2 
- Auf `main` nicht vorhandene Namen im Skript (ohne `IZ`): `akteurDaten`, `belS`, `dialogAntwort`, `zustandModulieren`; nicht vorhandene Aktionen: `ATEMPAUSE`, `MISSION_ANGENOMMEN`, `MISSION_ZUGEWIESEN`, `NACHRICHT_GESENDET`, `STATUS_GESETZT`
- Produktrelevanz: Funktionsumfang nicht mehr vorhanden.
- Empfehlung: Ausmusterung vormerken (Entscheidung Master Wayne): getesteter Umfang nicht mehr vorhanden; keine Löschung, keine Änderung der Registrierung.

**`zu`** (nicht historisch markiert, 36 Zeilen)  
- Zweck (aus dem Skriptinhalt abgeleitet): Haltung des Handlers, Termine und Notfall (`#haltung-handler`, `zustandTermin`), Haltungsvermerk im Dossier.
- Reproduktion auf `main`: `cd tests && node runall.js zu`; auf `1cb1195` im dort ausgecheckten Ordner gleich.
- `1cb1195`: rot (15.1 s), erster Fehler: `page.evaluate: ReferenceError: akteurDaten is not defined`
- `5c5a545`: rot (13.7 s), erster Fehler: `page.evaluate: ReferenceError: IZ is not defined`
- Ursachenklasse (Basisstand): E1 
- Auf `main` nicht vorhandene Namen im Skript (ohne `IZ`): `akteurDaten`, `antwortFuer`, `zustandTermin`; nicht vorhandene Aktionen: `LAGEBERICHT`, `MISSION_ANGENOMMEN`, `MISSION_ZUGEWIESEN`, `STATUS_GESETZT`, `VERSTAERKUNG_ANGEFORDERT`
- Produktrelevanz: Funktionsumfang nicht mehr vorhanden.
- Empfehlung: Ausmusterung vormerken (Entscheidung Master Wayne): getesteter Umfang nicht mehr vorhanden; keine Löschung, keine Änderung der Registrierung.

### 5.5 Karte (Produktbereich besteht) (5 Skripte)

**`ks`** (nicht historisch markiert, 12 Zeilen)  
- Zweck (aus dem Skriptinhalt abgeleitet): Karte: Sichtungsmarker (`karteMarker`, `genau`, `bez`), Zoom und Bildschirmfoto; setzt vorher die Altmission.
- Reproduktion auf `main`: `cd tests && node runall.js ks`; auf `1cb1195` im dort ausgecheckten Ordner gleich.
- `1cb1195`: rot (16.7 s), erster Fehler: `page.evaluate: TypeError: Cannot read properties of null (reading 'replaceChildren') | at zeichneKarte (file:///home/claude/wt-base/karte-modul.js:641:14)`
- `5c5a545`: rot (14.1 s), erster Fehler: `page.evaluate: ReferenceError: IZ is not defined`
- Ursachenklasse (Basisstand): E2 
- Auf `main` nicht vorhandene Namen im Skript (ohne `IZ`): keine; nicht vorhandene Aktionen: `KENNWORT_SCHALTER`, `MISSION_ANGENOMMEN`, `MISSION_ZUGEWIESEN`, `STATUS_GESETZT`
- Produktrelevanz: Bereich besteht im Produkt; Karte, Marker und Sichtungen bestehen im Produkt; `karteMarker` wird u. a. von `dossier-maske`, `karte-sperre-pins` und `kartensprung` geprüft. Gleichwertigkeit der Abdeckung für die Sichtungs-Unschärfe nicht belegt (Textsuche: „unscharf“ kommt in keinem Standardtest vor).
- Empfehlung: Vor einer Ausmusterung prüfen, ob die Standardauswahl den Bereich gleichwertig abdeckt; gegebenenfalls Neuformulierung als Standardtest statt Wiederherstellung. Nichts ändern ohne Entscheidung.

**`kv2`** (nicht historisch markiert, 35 Zeilen)  
- Zweck (aus dem Skriptinhalt abgeleitet): Karte: Basiskarten (`#k-b-carto`, `#k-b-offline`), Messen (`#k-messen`), `#k-spiel`, Suche.
- Reproduktion auf `main`: `cd tests && node runall.js kv2`; auf `1cb1195` im dort ausgecheckten Ordner gleich.
- `1cb1195`: rot (48.1 s), erster Fehler: `name: 'TimeoutError' | } | @ kv2.js:27`
- `5c5a545`: rot (16.9 s), erster Fehler: `page.evaluate: ReferenceError: IZ is not defined`
- Ursachenklasse (Basisstand): E3 
- Auf `main` nicht vorhandene Namen im Skript (ohne `IZ`): keine; nicht vorhandene Aktionen: `KENNWORT_SCHALTER`, `MISSION_ANGENOMMEN`, `MISSION_BEGINN_JETZT`, `MISSION_ZUGEWIESEN`, `STATUS_GESETZT`
- Produktrelevanz: Bereich besteht im Produkt; Bedienelemente bestehen im Produkt; `#k-b-carto` (`kv3`) und `#k-messen` (`karten-messen`) werden in Standardtests verwendet, `#k-b-offline` und `#k-spiel` nicht (Textsuche).
- Empfehlung: Vor einer Ausmusterung prüfen, ob die Standardauswahl den Bereich gleichwertig abdeckt; gegebenenfalls Neuformulierung als Standardtest statt Wiederherstellung. Nichts ändern ohne Entscheidung.

**`kv4`** (nicht historisch markiert, 33 Zeilen)  
- Zweck (aus dem Skriptinhalt abgeleitet): Karte: Messen, Gesamt- und Zeitpanel, Pop-up-Frage (`#k-p-gesamt`, `#k-p-zeit`, `#k-pop-frage`), Handler-Antwort (`antwortFuer`).
- Reproduktion auf `main`: `cd tests && node runall.js kv4`; auf `1cb1195` im dort ausgecheckten Ordner gleich.
- `1cb1195`: rot (48.8 s), erster Fehler: `name: 'TimeoutError' | } | @ kv4.js:25`
- `5c5a545`: rot (16.8 s), erster Fehler: `page.evaluate: ReferenceError: IZ is not defined`
- Ursachenklasse (Basisstand): E3 
- Auf `main` nicht vorhandene Namen im Skript (ohne `IZ`): `antwortFuer`; nicht vorhandene Aktionen: `KENNWORT_SCHALTER`, `MISSION_ANGENOMMEN`, `MISSION_BEGINN_JETZT`, `MISSION_ZUGEWIESEN`, `STATUS_GESETZT`
- Produktrelevanz: Bereich besteht im Produkt; Messen und `#k-svg` bestehen im Produkt und werden in Standardtests verwendet; `#k-p-gesamt`, `#k-p-zeit` und `#k-pop-frage` kommen im Produkt nicht mehr vor (Textsuche).
- Empfehlung: Vor einer Ausmusterung prüfen, ob die Standardauswahl den Bereich gleichwertig abdeckt; gegebenenfalls Neuformulierung als Standardtest statt Wiederherstellung. Nichts ändern ohne Entscheidung.

**`rt`** (nicht historisch markiert, 15 Zeilen)  
- Zweck (aus dem Skriptinhalt abgeleitet): Karte: Transportroute mit drei Abschnitten und zwei Alternativen („Vermutete Transportroute“), Panel abschaltbar (`#k-raum`, `#ke-strecke`).
- Reproduktion auf `main`: `cd tests && node runall.js rt`; auf `1cb1195` im dort ausgecheckten Ordner gleich.
- `1cb1195`: rot (45.7 s), erster Fehler: `FAIL 3 Abschnitte | FAIL 2 Alternativen | FAIL Panel @ rt.js:11`
- `5c5a545`: rot (16.9 s), erster Fehler: `page.evaluate: ReferenceError: IZ is not defined`
- Ursachenklasse (Basisstand): E3 
- Auf `main` nicht vorhandene Namen im Skript (ohne `IZ`): keine; nicht vorhandene Aktionen: `MISSION_ANGENOMMEN`, `MISSION_ZUGEWIESEN`, `STATUS_GESETZT`
- Produktrelevanz: Bereich besteht im Produkt; Karte besteht im Produkt; `#k-raum` kommt in keinem Standardtest vor, `#ke-strecke` und „Vermutete Transportroute“ nicht mehr im Produkt (Textsuche). `.k-strecke` wird in `recherche-oberflaeche` verwendet.
- Empfehlung: Vor einer Ausmusterung prüfen, ob die Standardauswahl den Bereich gleichwertig abdeckt; gegebenenfalls Neuformulierung als Standardtest statt Wiederherstellung. Nichts ändern ohne Entscheidung.

**`zp`** (historisch markiert, 52 Zeilen)  
- Zweck (aus dem Skriptinhalt abgeleitet): Karte: Zugriffspunkte per wiederholtem Klick (`#k-zugriff-neu`, `#mz-lage`, `#mz-weg`, `#mz-r`), Modus bleibt aktiv, Esc, Notiz.
- Reproduktion auf `main`: `cd tests && node runall.js zp`; auf `1cb1195` im dort ausgecheckten Ordner gleich.
- `1cb1195`: rot (15 s), erster Fehler: `page.evaluate: TypeError: Cannot set properties of null (setting 'beginn')`
- `5c5a545`: rot (13.1 s), erster Fehler: `page.evaluate: TypeError: Cannot set properties of null (setting 'beginn')`
- Ursachenklasse (Basisstand): E2 
- Auf `main` nicht vorhandene Namen im Skript (ohne `IZ`): keine; nicht vorhandene Aktionen: `MISSION_ANGENOMMEN`, `MISSION_ZUGEWIESEN`, `STATUS_GESETZT`, `ZONEN_EREIGNIS`
- Produktrelevanz: Bereich besteht im Produkt; Zugriffspunkte (`#mz-*`, `#zp-r`) bestehen im Produkt; in der Standardauswahl wird nur `#k-zugriff-neu` verwendet (`recherche-oberflaeche`), die übrigen kommen in keinem Standardtest vor (Textsuche). Mögliche Abdeckungslücke, nicht belegt.
- Empfehlung: Als historisch belassen; Abdeckung des bestehenden Produktbereichs vorab klären (siehe Produktrelevanz). Nichts ändern ohne Entscheidung.

### 5.6 Dossier, Profil und Ausgangsorte (Produktbereich besteht) (4 Skripte)

**`ag`** (nicht historisch markiert, 28 Zeilen)  
- Zweck (aus dem Skriptinhalt abgeleitet): Ausgangsorte anlegen (`AUSGANG_ANGELEGT`) und in der Missionsansicht verwenden; Raumansicht `#k-raum`.
- Reproduktion auf `main`: `cd tests && node runall.js ag`; auf `1cb1195` im dort ausgecheckten Ordner gleich.
- `1cb1195`: rot (17.6 s), erster Fehler: `FAIL Auswahl Ausgangsort sichtbar`
- `5c5a545`: rot (15.4 s), erster Fehler: `page.evaluate: ReferenceError: IZ is not defined`
- Ursachenklasse (Basisstand): E3 
- Auf `main` nicht vorhandene Namen im Skript (ohne `IZ`): keine; nicht vorhandene Aktionen: `MISSION_ANGENOMMEN`, `MISSION_ZUGEWIESEN`, `STATUS_GESETZT`
- Produktrelevanz: Bereich besteht im Produkt; Ausgangsorte bestehen im Produkt (Profil). In der Standardauswahl kommt `AUSGANG_ANGELEGT` nur in `kartenprotokoll` vor; `#k-raum` kommt in keinem Standardtest vor (Textsuche).
- Empfehlung: Vor einer Ausmusterung prüfen, ob die Standardauswahl den Bereich gleichwertig abdeckt; gegebenenfalls Neuformulierung als Standardtest statt Wiederherstellung. Nichts ändern ohne Entscheidung.

**`ed`** (nicht historisch markiert, 25 Zeilen)  
- Zweck (aus dem Skriptinhalt abgeleitet): Dossier bearbeiten: Label und Stufe ändern, auf Original zurücksetzen (`#bd-name`, `#bd-stufe`, `#btn-dbearb`, `#btn-dorig`).
- Reproduktion auf `main`: `cd tests && node runall.js ed`; auf `1cb1195` im dort ausgecheckten Ordner gleich.
- `1cb1195`: rot (46 s), erster Fehler: `name: 'TimeoutError' | } | @ ed.js:9`
- `5c5a545`: rot (14.7 s), erster Fehler: `page.evaluate: ReferenceError: IZ is not defined`
- Ursachenklasse (Basisstand): E3 
- Auf `main` nicht vorhandene Namen im Skript (ohne `IZ`): keine; nicht vorhandene Aktionen: `MISSION_ANGENOMMEN`, `MISSION_ZUGEWIESEN`, `STATUS_GESETZT`
- Produktrelevanz: Bereich besteht im Produkt; `#btn-dbearb` und `#btn-dorig` bestehen im Produkt und werden in Standardtests verwendet (`dossier-kurzlage`, `phase5b2-recherchezugang`); `#bd-name` kommt in keinem Standardtest vor, `#bd-stufe` nicht mehr im Produkt (Textsuche).
- Empfehlung: Vor einer Ausmusterung prüfen, ob die Standardauswahl den Bereich gleichwertig abdeckt; gegebenenfalls Neuformulierung als Standardtest statt Wiederherstellung. Nichts ändern ohne Entscheidung.

**`th`** (nicht historisch markiert, 14 Zeilen)  
- Zweck (aus dem Skriptinhalt abgeleitet): Handler-Abfragen (`antwortFuer`) und „Sichtung überlebt Reset“ (`RESET`, `SICHTUNG_HINZU`).
- Reproduktion auf `main`: `cd tests && node runall.js th`; auf `1cb1195` im dort ausgecheckten Ordner gleich.
- `1cb1195`: rot (13.9 s), erster Fehler: `page.evaluate: ReferenceError: antwortFuer is not defined`
- `5c5a545`: rot (14.7 s), erster Fehler: `page.evaluate: ReferenceError: IZ is not defined`
- Ursachenklasse (Basisstand): E1 
- Auf `main` nicht vorhandene Namen im Skript (ohne `IZ`): `antwortFuer`; nicht vorhandene Aktionen: `KENNWORT_SCHALTER`, `MISSION_ANGENOMMEN`, `MISSION_ZUGEWIESEN`, `STATUS_GESETZT`
- Produktrelevanz: Bereich besteht im Produkt; `RESET` und `SICHTUNG_HINZU` bestehen im Produkt; in der Standardauswahl kommt `RESET` nur in `pn` vor, `SICHTUNG_HINZU` in mehreren Tests. Ob „Sichtung überlebt Reset“ gleichwertig geprüft wird, ist nicht belegt.
- Empfehlung: Vor einer Ausmusterung prüfen, ob die Standardauswahl den Bereich gleichwertig abdeckt; gegebenenfalls Neuformulierung als Standardtest statt Wiederherstellung. Nichts ändern ohne Entscheidung.

**`tn`** (nicht historisch markiert, 26 Zeilen)  
- Zweck (aus dem Skriptinhalt abgeleitet): Legenden/Tarnidentitäten im Vorlauf (`#reiter-tarn`, `#lb-grenz`): drei Legenden mit Upload, Namen, Foto.
- Reproduktion auf `main`: `cd tests && node runall.js tn`; auf `1cb1195` im dort ausgecheckten Ordner gleich.
- `1cb1195`: rot (14 s), erster Fehler: `FAIL Namen`
- `5c5a545`: rot (16.1 s), erster Fehler: `FAIL Namen`
- Ursachenklasse (Basisstand): E4 
- Auf `main` nicht vorhandene Namen im Skript (ohne `IZ`): keine; nicht vorhandene Aktionen: `MISSION_ANGENOMMEN`, `MISSION_ZUGEWIESEN`, `STATUS_GESETZT`
- Produktrelevanz: Bereich besteht im Produkt; Scheitert zusätzlich an einer nicht vorhandenen Datei `foto.png` (relativer Pfad, Umgebungsmangel des Skripts). Reiter `#reiter-tarn` wird in `profil-arbeitsansicht` (Standard) verwendet.
- Empfehlung: Vor einer Ausmusterung prüfen, ob die Standardauswahl den Bereich gleichwertig abdeckt; gegebenenfalls Neuformulierung als Standardtest statt Wiederherstellung. Nichts ändern ohne Entscheidung.

## 6. Abdeckungshinweise zu den neun Skripten mit bestehendem Produktbereich

Die Hinweise beruhen auf Textsuche (Bedienelement-IDs und Funktionsnamen) in Produkt und Standardtests; sie belegen keine Abdeckung und keine Lücke.

- `ks`: Sichtungs-Unschärfe der Karte; der Begriff „unscharf“ kommt in keinem Standardtest vor.
- `kv2`: `#k-b-offline` und `#k-spiel` kommen in keinem Standardtest vor; `#k-spiel` ist nach den Vorgaben („keine spielartigen Hinweise“) vermutlich nicht mehr zu erwarten (nicht geprüft).
- `kv4`: `#k-p-gesamt`, `#k-p-zeit`, `#k-pop-frage` bestehen im Produkt nicht mehr.
- `rt`: Transportroute „Vermutete Transportroute“ und `#ke-strecke` bestehen im Produkt nicht mehr; `#k-raum` kommt in keinem Standardtest vor.
- `zp`: Zugriffspunkte per Mehrfachklick; nur `#k-zugriff-neu` wird in einem Standardtest verwendet, die übrigen `#mz-*` kommen in keinem vor.
- `ag`: `#k-raum` und Ausgangsorte in der Raumansicht; `AUSGANG_ANGELEGT` kommt in der Standardauswahl nur in `kartenprotokoll` vor.
- `ed`: `#bd-name` kommt in keinem Standardtest vor; `#bd-stufe` besteht im Produkt nicht mehr.
- `th`: „Sichtung überlebt Reset“; gleichwertige Prüfung nicht belegt.
- `tn`: Tarnidentitäten bestehen als `#reiter-tarn` und werden in `profil-arbeitsansicht` verwendet; das Skript selbst scheitert zusätzlich an `foto.png`.

Ein Teil dieser Elemente kann bewusst entfallen sein; das ist Produktsemantik und bleibt Entscheidung von Master Wayne.

## 7. Empfehlungen und Entscheidungsfragen

Es wird nichts geändert. Zur Entscheidung vorgeschlagen:

1. **Ausmusterung vormerken** (31 nicht historisch markierte Skripte mit ausschließlich entferntem Funktionsumfang, Klassen D/M/F/H; Liste in Abschnitt 5 unter „Empfehlung“). Löschung oder Entfernung aus der Registrierung erst nach gesondertem Auftrag.
2. **Historisch belassen** (11 historisch markierte Skripte): bestehende Festlegung in `runall.js` bleibt; zusätzliche Ausmusterung nur auf Anordnung.
3. **Abdeckung klären, dann entscheiden** (Abschnitt 6, die nicht historisch markierten unter den 9 Bereichs-Skripten: `ks`, `kv2`, `kv4`, `rt`, `ag`, `ed`, `th`, `tn`): gegebenenfalls Neuformulierung als Standardtest statt Wiederherstellung.
4. **Dateikopien**: `sk` und `sk_d` sind nahezu identisch (zwei Zeilen Unterschied).
5. **Anhang A**: Die 33 grünen Skripte sind nur zum Teil prüfend; Aufnahme in die Standardauswahl nicht vorgeschlagen, solange keine gezielte Durchsicht erfolgt ist. Die Fälle `karten-txt-export` (Zeitüberschreitung ab Zeile 96) und `eigene-zonen` (`TypeError` Zeile 16) tragen produktnahe Namen; ihre Ursache wurde nicht untersucht und sollte gesondert geprüft werden, bevor eine Ausmusterung erwogen wird.
6. **Auffälligkeit im Standardbestand** (nicht Teil dieses PR, nichts geändert): `sichtung-export` und `terminal-namensnavigation` rufen entfernte Aktionstypen (`MISSION_ZUGEWIESEN`, `MISSION_ANGENOMMEN`) per `dispatch` auf; diese laufen stumm ins Leere.

## 8. Nicht durchgeführt

Keine Löschung, keine Änderung der Registrierung, keine Umschreibung von Skripten, keine Produktcodeänderung. Die Zusatzmessung (Anhang A) wurde einmal ohne Ursachenanalyse je Skript durchgeführt.

## 9. Grenzen und Unbelegtes

- Die Messungen wurden nur vom Autor in einer Sandbox ausgeführt und nicht unabhängig reproduziert; Dauer und Zeitüberschreitungen sind umgebungsabhängig. Lokal sind außerdem bekannte Standardtests rot (Sandbox), daher entscheidet für Standardtests die CI; diese Inventur deckt Nicht-Standardskripte ab, die die CI nicht ausführt.
- `jsdom` ist in der Sandbox nicht installiert; `dlg`, `flow`, `flow2`, `flow3` und `test` scheitern daran vor dem Start (Anhang A). Ob das Paket anderswo vorgesehen ist, ist nicht belegt.
- Zwecke sind aus dem Skriptinhalt abgeleitet, nicht aus Dokumentation.
- Die Abdeckungshinweise sind Textsuche, keine Abdeckungsmessung.
- Ein Lauf je Skript und Stand; Flakiness wurde nicht gemessen.
- Verhalten mit echten Nutzerprofilen ist nicht Gegenstand.

## Anhang A: Zusatzmessung der 85 Nicht-Standardskripte ohne `IZ(` (außerhalb des freigegebenen Umfangs)

Gemessen auf `5c5a545`, einmalig, ohne Ursachenanalyse. Erster Fehler gekürzt. Die Spalte „historisch“ bezieht sich auf `HISTORISCH` in `runall.js`.

| Skript | historisch | Status | s | Erster Fehler |
|---|---|---|---|---|
| `aa` | nein | rot | 13.7 | page.evaluate: ReferenceError: antwortFuer is not defined |
| `aa2` | nein | rot | 14.3 | page.evaluate: TypeError: Cannot read properties of undefined (reading 'map') |
| `aa3` | nein | ungeprüft | 3.7 | Exit 0, keine Ausgabe |
| `ak2` | ja | rot | 14.5 | page.evaluate: ReferenceError: renderRegistraturLegacy is not defined |
| `bw` | nein | rot | 14.4 | page.evaluate: TypeError: Cannot read properties of undefined (reading 'filter') |
| `chk` | nein | grün | 3.6 | - |
| `cnt` | nein | rot | 47.6 | name: 'TimeoutError' / } / @ cnt.js:8 |
| `dang` | nein | grün | 24.4 | - |
| `de` | nein | grün | 15.9 | - |
| `dlg` | nein | rot | 0 | Error: Cannot find module 'jsdom' / Require stack: / - /home/claude/wt-main2/tests/dlg.js @ dlg.js:1 |
| `e2e` | nein | rot | 44.2 | name: 'TimeoutError' / } / @ e2e.js:24 |
| `eigene-zonen` | nein | rot | 13.8 | page.evaluate: TypeError: Cannot read properties of undefined (reading 'length') |
| `emp` | nein | grün | 15 | - |
| `emp2` | nein | grün | 13.3 | - |
| `ents` | nein | grün | 4.1 | - |
| `eo` | nein | rot | 0.7 | Exit 1 ohne Fehlermuster in der Ausgabe |
| `ev2` | nein | rot | 14.6 | page.evaluate: TypeError: Cannot read properties of null (reading 'disabled') |
| `fd3` | nein | rot | 14.9 | page.evaluate: ReferenceError: DIALOG is not defined / at STATE_ID |
| `fd4` | nein | rot | 13.4 | page.evaluate: ReferenceError: antwortFuer is not defined |
| `fg5` | nein | rot | 15.6 | FAIL Eliminierung wählbar |
| `fgx` | nein | rot | 14 | page.evaluate: TypeError: Cannot read properties of null (reading 'id') |
| `fgy` | ja | rot | 15.4 | page.evaluate: ReferenceError: nachrichtSenden is not defined |
| `fl` | nein | grün | 14.3 | - |
| `flow` | nein | rot | 0 | Error: Cannot find module 'jsdom' / Require stack: / - /home/claude/wt-main2/tests/flow.js @ flow.js:1 |
| `flow2` | nein | rot | 0 | Error: Cannot find module 'jsdom' / Require stack: / - /home/claude/wt-main2/tests/flow2.js @ flow2.js:1 |
| `flow3` | nein | rot | 0 | Error: Cannot find module 'jsdom' / Require stack: / - /home/claude/wt-main2/tests/flow3.js @ flow3.js:1 |
| `hb` | nein | grün | 14 | - |
| `ids` | nein | rot | 3.6 | page.evaluate: ReferenceError: DIALOG is not defined |
| `info` | nein | rot | 15.5 | page.evaluate: ReferenceError: infoStufe is not defined |
| `k3d` | nein | grün | 19 | - |
| `k3d2` | nein | grün | 31.5 | - |
| `k3d5` | nein | grün | 24.5 | - |
| `k3dfehler` | nein | grün | 29 | - |
| `k3dzoom` | nein | grün | 15.2 | - |
| `karten-txt-export` | nein | rot | 32.7 | name: 'TimeoutError' / } / @ karten-txt-export.js:96 |
| `kperf` | nein | grün | 17.5 | - |
| `kt2` | nein | grün | 15.7 | - |
| `kt3` | nein | grün | 17.9 | - |
| `kw2` | nein | rot | 15.4 | page.evaluate: TypeError: Cannot read properties of undefined (reading 'forEach') |
| `kwz` | ja | rot | 15.3 | page.evaluate: TypeError: Cannot read properties of undefined (reading 'filter') |
| `lb` | nein | grün | 29.4 | - |
| `lb2` | nein | rot | 28.4 | FAIL dunkle Unterlage außerhalb / keine Fehler |
| `lg` | nein | grün | 7.2 | - |
| `lz` | nein | grün | 7.2 | - |
| `map2` | nein | rot | 43.8 | FAIL Karte sichtbar |
| `nx` | ja | grün | 13.4 | - |
| `p3` | ja | rot | 15.4 | page.evaluate: TypeError: Cannot read properties of undefined (reading 'forEach') |
| `pop` | nein | rot | 45.4 | name: 'TimeoutError' / } / @ pop.js:11 |
| `pr_x` | nein | rot | 14.3 | page.evaluate: ReferenceError: antwortFuer is not defined |
| `pr_y` | nein | rot | 14.7 | page.evaluate: ReferenceError: antwortFuer is not defined |
| `prof2` | nein | rot | 45.5 | name: 'TimeoutError' / } / @ prof2.js:22 |
| `qs` | nein | rot | 13.9 | page.evaluate: ReferenceError: dossierOrt is not defined |
| `req` | nein | grün | 12.8 | - |
| `rp` | nein | rot | 14.2 | page.evaluate: TypeError: Cannot read properties of undefined (reading 'filter') |
| `sat` | nein | grün | 18 | - |
| `sc` | nein | grün | 15.4 | - |
| `shot` | nein | ungeprüft | 13.4 | Exit 0, keine Ausgabe |
| `shot2` | nein | rot | 14.1 | page.evaluate: TypeError: Cannot read properties of undefined (reading 'forEach') |
| `shot3` | nein | grün | 15.7 | - |
| `shot4` | nein | rot | 14 | Error: ENOENT: no such file or directory, stat 'portrait.png' / at async Object.stat (node:internal/fs/promises:1037:18) / at async resolvePathsAndDir |
| `shot_ak` | nein | grün | 75.6 | - |
| `sm` | ja | rot | 13.5 | page.evaluate: TypeError: Cannot read properties of undefined (reading 'forEach') |
| `sonne_pruefung` | nein | grün | 0 | - |
| `sx` | nein | rot | 14.3 | page.evaluate: ReferenceError: antwortFuer is not defined |
| `terminal-lokal` | nein | grün | 21.4 | - |
| `terminal-verlauf` | nein | grün | 13.7 | - |
| `test` | nein | rot | 0 | Error: Cannot find module 'jsdom' / Require stack: / - /home/claude/wt-main2/tests/test.js @ test.js:1 |
| `tile` | nein | grün | 0.8 | - |
| `tile2` | nein | rot | 13.1 | page.evaluate: TypeError: Cannot set properties of null (setting 'open') |
| `tr` | nein | rot | 13.6 | page.evaluate: ReferenceError: akteurDaten is not defined |
| `tx` | ja | rot | 13.5 | page.evaluate: TypeError: Cannot read properties of undefined (reading 'kanaele') / at eingang (file:///home/claude/wt-main2/index.html:1723:24) |
| `wetter` | nein | grün | 16.7 | - |
| `wh` | nein | grün | 2.1 | - |
| `wk` | nein | rot | 13.4 | FAIL Schlüsselfiguren bekannt / OK P-0001 frei / Zum Inhalt springen @ wk.js:24 |
| `wk2` | nein | grün | 14.8 | - |
| `wp` | nein | rot | 13.9 | page.evaluate: ReferenceError: infoFreigeben is not defined |
| `zb` | ja | rot | 12.5 | page.evaluate: TypeError: Cannot read properties of null (reading 'skript') |
| `zev` | ja | rot | 13.4 | page.evaluate: TypeError: Cannot set properties of null (setting 'beginn') |
| `zn` | ja | rot | 16.8 | FAIL Schlüssel aus Datei übernommen / FAIL CARTO-Anfragen mit Schlüssel: 0 / FAIL Auto-Zonen sichtbar @ zn.js:17 |
| `zn2` | nein | ungeprüft | 19.7 | Exit 0, keine Ausgabe |
| `zn3` | ja | rot | 43.1 | FAIL Auto-Zone bearbeitbar |
| `zn4` | nein | rot | 45.6 | name: 'TimeoutError' / } / @ zn4.js:6 |
| `zonen-vorschau` | nein | grün | 19.9 | - |
| `zpform` | nein | rot | 46.3 | name: 'TimeoutError' / } / @ zpform.js:11 |
| `zs` | nein | rot | 13.5 | page.evaluate: TypeError: Cannot read properties of null (reading 'options') |

Grüne Skripte ohne eines der geprüften Textmuster (`assert`, `FAIL`, `process.exit`, `ok(`, `check(`, `chk(`; Heuristik): `chk`, `dang`, `de`, `emp`, `emp2`, `ents`, `fl`, `hb`, `k3d`, `k3d2`, `k3d5`, `k3dfehler`, `kperf`, `kt2`, `kt3`, `lb`, `lg`, `lz`, `sat`, `sc`, `shot3`, `shot_ak`, `sonne_pruefung`, `tile`, `wetter`, `wh`, `wk2`. Mit Mustern: `k3dzoom`, `nx`, `req`, `terminal-lokal`, `terminal-verlauf`, `zonen-vorschau`.

`eo` (rot, Exit 1): erwartet den Seitenpfad als Argument (`process.argv[2]`), den `runall.js` nicht übergibt; Fehler `page.goto: net::ERR_INVALID_URL at file://undefined/`. `aa3`, `shot`, `zn2` beenden mit Exit 0 ohne Ausgabe (Bildschirmfoto-/Diagnoseskripte).
