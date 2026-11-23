# Phase 5c2b (c) – Analyse: Entwicklerkonsole, `SCENARIO.abfragen` und mögliche ungenutzte Helfer

Stand: 23.11.2026. Reine Analyse auf `main` `5c5a545af952a85c2aef53ced2b489e1306975f1` (nach #119). **Kein Produktivcode und kein Test geändert.** Gegenstand der Entscheidung von Master Wayne (23.11.2026): 5c2b (c) bleibt zurückgestellt; eine rein analytische Untersuchung ist erlaubt, produktive Codeänderungen erfordern eine gesonderte Entscheidung. Den aktuellen Stand von `main` nennt ausschließlich [AKTUELL.md](AKTUELL.md).

## 1. Ergebnis in Kürze

1. **Entwicklerkonsole (`window.Dev`):** nur über die Browserkonsole erreichbar, nirgends in Oberfläche, Terminal oder Produktivcode aufgerufen. Auf einem frischen Zustand liefert `Dev.startJetzt()` „nicht möglich …“, ohne den Zustand zu verändern. Auf einem migrierten Format-4-Zustand liefert sie „Einsatz läuft“, weil der alte Einsatz laut Altbestand längst begonnen hat; verändert wird auch dort nichts (gemessen, Abschnitt 3). Der Kettenschluss `START_VORGEZOGEN` → `startVorziehen` bricht in beiden Fällen sofort ab, weil `STATE.plan` seit 5c1b kein Array mehr ist. Die Meldung „Einsatz läuft“ ist für diesen Zustand irreführend (Abschnitt 3.3).
2. **`SCENARIO.abfragen`:** zur Laufzeit liest **keine** Anwendungsstelle mehr einen Schlüssel dieses Objekts. Der einzige Leser (`abfrageT()` → `sichtungText(e)` in `index.html`) ist durch eine **gleichnamige spätere Funktionsdeklaration in `karte-modul.js` überlagert** und damit unerreichbar (neuer Befund B-3, Abschnitt 4). `SCENARIO.abfragen.aussagen` hat seit #119 (Entfernung von `aussagenListe`) und 5c2a keinen Leser mehr. Auch der Alias `SCENARIO.dokumentPruefung` wird nirgends gelesen.
3. **Mögliche ungenutzte Helfer:** neun Funktionen sind im Anwendungscode nicht mehr (oder nur noch von anderen ungenutzten Funktionen) referenziert; vier davon werden bewusst von Standardtests als Invariantennachweis genutzt und waren in den Inventaren ausdrücklich als „bewusst behalten“ geführt. Die Übersicht steht in Abschnitt 5.
4. **Empfehlung:** keine Entfernung in diesem Schritt. Je Gruppe ist eine eigene Entscheidung nötig (Abschnitt 7); die größte Reichweite hat die Frage nach `SCENARIO.abfragen` (rund 21 kB Text) und der doppelten Funktion `sichtungText`.

## 2. Methode und Reproduktion

Grundsatz (Master Wayne, 23.11.2026): Entfernt wird nur bei nachgewiesener Unerreichbarkeit oder fehlender fachlicher Bedeutung, nicht wegen weniger Referenzen. Diese Analyse liefert daher Belege für Erreichbarkeit, keine Entfernung.

| Schritt | Werkzeug | Befehl / Quelle |
|---|---|---|
| Erreichbarkeit der Funktionen | AST-Analyse (acorn), alle Funktionsdeklarationen der Anwendungsskripte; Referenz = Bezeichner außerhalb der eigenen Deklaration, Eigenschaftsnamen und Schlüssel ausgeschlossen; Fixpunkt: eine Funktion gilt als lebend, wenn sie aus Top-Level-Code oder aus einer lebenden Funktion referenziert wird | Skript in Abschnitt 8; Ausführung `node analyse.js <Wurzelordner>` mit `acorn` und `acorn-walk` (`npm install acorn acorn-walk` in einem leeren Ordner außerhalb des Repositorys) |
| Doppelte globale Deklarationen | AST der Top-Level-Anweisungen aller klassischen Skripte | Skript in Abschnitt 8 (zweiter Block) |
| Textsuche je Name | `grep -n -w <Name> index.html szenario.js karte-modul.js akten-modul.js profil-modul.js fall-modul.js recherche-modul.js arbeitsstand-modul.js`, danach `grep -l -w <Name> tests/*.js` | wörtliche Treffer inklusive Zeichenketten und Kommentare |
| Laufzeitbelege | Playwright (Chromium), frischer Zustand und migrierter Zustand aus `tests/fixtures/altprofil-mission.json` (Format 4, `infozugang` ergänzt) | Skizzen in Abschnitt 3 und 4 |

Geprüftes Ergebnis der AST-Analyse auf `5c5a545`: 656 deklarierte Funktionen; ohne weitere Annahmen nicht erreichbar sind acht (`fristMs`, `fensterListe`, `fensterNach`, `missionsbetrieb`, `dokZeile`, `legendeListe`, `neuverbinden`, `karteOhneMission`); zehn, wenn man die in `index.html` überlagerte `sichtungText` als nicht ausführbar behandelt (zusätzlich `abfrageT` und `adresseHinterlegt`, Abschnitt 4).

Grenzen der Methode (nicht belegt):

- Dynamische Zugriffe über Zeichenketten (`window['name']`, `eval`, Zeichenketten als Ereignisbehandler) werden von der AST-Analyse nicht erfasst. Ergänzende Textsuche: Die neun Namen kommen im Anwendungscode ausschließlich als Deklaration oder, wo in Abschnitt 5 genannt, als Aufruf vor; kein Treffer in einer Zeichenkette oder einem HTML-Attribut.
- Als „Top-Level“ gilt konservativ jeder Verweis außerhalb benannter Funktionsdeklarationen (Funktionsausdrücke in Objekten wie `ACTIONS` und `window.Dev` zählen als lebend). Die Analyse unterschätzt daher die Menge unerreichbarer Funktionen.
- Nutzung von `Dev` oder anderer Konsolenbefehle durch Master Wayne selbst ist dem Repository nicht zu entnehmen.
- Geprüft wurde nur der Stand im Repository; gespeicherte echte Nutzerprofile wurden nicht eingesehen.

## 3. Entwicklerkonsole `window.Dev`

### 3.1 Bestand

`index.html`, Zeilen 3965 bis 3969: Kommentar „Entwicklerkonsole: Dev.startJetzt() beginnt den Einsatz sofort …“, Objekt `window.Dev` mit

- `startJetzt()` → `dispatch({ type: 'START_VORGEZOGEN' })`, danach Rückgabe `einsatzLaeuft() ? 'Einsatz läuft' : 'nicht möglich (kein laufender Auftrag oder Start bereits erreicht)'`,
- `zeitplan()` → gibt `ALT().plan` als Textzeilen aus (nur lesend).

Kette: `Dev.startJetzt` → Aktion `START_VORGEZOGEN` (Zeile 2175) → `startVorziehen(out)` (Zeile 1692) → `LM()`, `einsatzLaeuft()` (1051), `einsatzBeginn()` (1047), `MS()`, `planEntfernen()` (1787). Die Funktion `startVorziehen` hat als Aufrufer nur diese Aktion; `planEntfernen` hat als Aufrufer nur `startVorziehen`; `einsatzLaeuft` wird von `startVorziehen` und von `Dev` aufgerufen; `einsatzBeginn` von `startVorziehen` und `einsatzLaeuft`.

### 3.2 Erreichbarkeit

- Kein Aufruf in `index.html`, den Modulen oder dem Terminal außer der Dev-Definition selbst (Textsuche und AST).
- Tests: `Dev.` kommt nur in `tests/ab.js` vor (nicht in der Standardauswahl, außerhalb der Registrierung). `START_VORGEZOGEN` und `startVorziehen` kommen in keinem Test vor. `einsatzLaeuft` ist in `phase5c2b-tickblock` (Standardauswahl) nur als vorhandene Funktion geprüft (Liste der bewusst behaltenen Funktionen) und kommt außerdem in `flow2`, `fc` und dem historischen `au` vor; `einsatzBeginn` in `phase5c2b-tickblock` und `ab`.

### 3.3 Messung (Laufzeit)

Probe: Seite öffnen und anmelden, dann in einem Aufruf `Dev.startJetzt()`, `Dev.zeitplan()`, `einsatzLaeuft()`, `dispatch({ type: 'START_VORGEZOGEN' })` auslesen; Zustand des Altbestands vor und nach vergleichen. Zwei Ausgangslagen: (a) frischer Zustand, (b) migrierter Format-4-Zustand (Fixture, `infozugang` für vier Standarddossiers ergänzt). Ergebnis, ausgeführt am 23.11.2026:

| Größe | (a) frisch | (b) migriert |
|---|---|---|
| `typeof window.Dev` | `object` | `object` |
| `LM()` (laufender Auftrag laut Altbestand) | `false` | `true` |
| `Array.isArray(STATE.plan)` | `false` | `false` |
| `Dev.startJetzt()` | „nicht möglich (kein laufender Auftrag oder Start bereits erreicht)“ | „Einsatz läuft“ |
| `Dev.zeitplan()` | leere Liste | Planzeilen aus `ALT().plan` (ab `F-001 verlauf …`) |
| `einsatzLaeuft()` | `false` | `true` |
| `dispatch({ type: 'START_VORGEZOGEN' })` | `undefined`, ohne Wirkung | `undefined`, ohne Wirkung |
| Altbestand nach den Aufrufen unverändert | ja | ja |
| Seitenfehler | keine | keine |

Ergebnis: Die Kette verändert nichts (`startVorziehen` bricht an der Bedingung `!Array.isArray(STATE.plan)` ab, die seit 5c1b immer zutrifft). Im migrierten Zustand meldet `Dev.startJetzt()` jedoch „Einsatz läuft“, weil `einsatzLaeuft()` den Beginn aus dem Altbestand liest und dieser in der Vergangenheit liegt; die Meldung beschreibt den Altbestand, nicht eine Wirkung des Aufrufs, und ist deshalb missverständlich. Nicht bewiesen ist, dass ein manipulierter Speicherstand mit Array in `STATE.plan` die Kette nicht doch erreicht; die regulären Lade- und Migrationspfade erzeugen ein solches Feld nicht (Abschnitt 8b in [phase5c-schemainventar.md](phase5c-schemainventar.md)).

### 3.4 Einordnung

Funktional ist `Dev.startJetzt()` seit 5c1b wirkungslos; `Dev.zeitplan()` ist eine reine Leseanzeige des Altbestands. Ob die Konsole als Entwicklungswerkzeug erhalten bleiben soll, ist eine Produktentscheidung (Master Wayne), keine technische.

## 4. `SCENARIO.abfragen`

### 4.1 Bestand

`szenario.js` Zeilen 885 bis rund 1130: `SCENARIO.abfragen` mit 15 Schlüsseln (`keinAuftrag`, `zeit`, `phase`, `alias`, `standort`, `verstaerkung`, `erreichbar`, `freigabe`, `dossier`, `aussagen`, `modul`, `info`, `aussageEntitaet`, `quelle`, `checkin`), zusammen etwa 21 kB Text (Antwortvorlagen der früheren Dialogmaschine, die mit 5b9 entfernt wurde). Zeile 1352: `SCENARIO.dokumentPruefung = SCENARIO.abfragen.info.dokumentPruefung;`.

### 4.2 Leser

- Anwendungscode: ein einziger Zugriff, `function abfrageT() { return SCENARIO.abfragen; }` (`index.html` 1850). `abfrageT()` wird nur von `sichtungText(e)` in `index.html` (1914) aufgerufen und liest dort ausschließlich `standort.ort`, `.sichtung`, `.adresse` und `.nichts`. Die Schlüssel `standort.gesperrt` und `standort.unbekannt` werden nirgends gelesen. `adresseHinterlegt(e)` (1851) wird nur von dieser `sichtungText` aufgerufen.
- `SCENARIO.abfragen.aussagen` (Zeile 953): letzter Leser war die Darstellung der Altaussagen im Dossier (`wissenJa`/`wissenNein`), entfernt mit 5c2a (Commit `4797dcd`). Keine Anwendungsstelle liest den Schlüssel heute.
- `SCENARIO.dokumentPruefung`: kein Leser in Anwendungscode, Tests oder Dokumenten außer der Zuweisung selbst.
- Tests: `tests/ents.js` (nicht in der Standardauswahl) gibt `Object.keys(SCENARIO.abfragen)` aus. Kein Standardtest liest `SCENARIO.abfragen`.
- `karte3d.html` lädt `szenario.js`, liest aber kein Feld von `abfragen`.

### 4.3 Befund B-3: doppelte globale Funktion `sichtungText`

Die AST-Prüfung der Top-Level-Deklarationen aller Anwendungsskripte findet genau eine doppelt vergebene Funktionsbezeichnung:

| Datei | Zeile | Signatur |
|---|---|---|
| `index.html` (Hauptskript, zuerst geladen) | 1914 | `sichtungText(e)` |
| `karte-modul.js` (nach dem Hauptskript geladen) | 682 | `sichtungText(e, si)` |

In klassischen Skripten ersetzt die spätere Deklaration die frühere. Laufzeitprobe (Seite geöffnet, ohne Anmeldung ausgewertet): `sichtungText.length === 2`, der Funktionstext beginnt mit `function sichtungText(e, si) {` (Variante aus `karte-modul.js`) und enthält kein `abfrageT`. Die Variante in `index.html` ist damit zur Laufzeit nicht ausführbar. Ihre Abhängigen (`abfrageT`, `adresseHinterlegt`) sind es ebenfalls, und damit liest zur Laufzeit niemand `SCENARIO.abfragen.standort`.

Folgen:

- Die Aussage „`SCENARIO.abfragen` hat keinen Leser“ gilt zur Laufzeit für alle 15 Schlüssel, nicht nur für `aussagen`.
- Die Tests `sichtung-export` und die Kartenskripte prüfen die Variante aus `karte-modul.js` (tatsächlich geladen). Die tote Variante in `index.html` ist durch keinen Test belegt oder gebunden.
- Latentes Risiko: Eine Änderung der Skriptreihenfolge würde die Variante aus `index.html` (ein Argument, `abfrageT`) aktivieren und den Sichtungs-Export still verändern. Das Risiko besteht nur durch die doppelte Deklaration, nicht durch einen aktuellen Fehler.
- Herkunft: Die Version in `karte-modul.js` kam beim Auslagern des Kartenmoduls hinzu; die Version in `index.html` blieb stehen. Ein belegter Auslagerungs-Commit wurde in dieser Analyse nicht ermittelt (nicht geprüft).

Dies ist kein Ergebnis eines Testlaufs gegen die Standardauswahl, sondern eine Messung am geladenen Zustand und eine Quelltextprüfung.

## 5. Übersicht möglicher ungenutzter Helfer

Spalten: Anwendung = Referenzen im Anwendungscode außerhalb der eigenen Deklaration (AST); Standardtest / sonstige Tests = Skripte, in denen der Name vorkommt (Standardauswahl = in `GRUPPEN` von `tests/runall.js` aufgeführt, nicht historisch); Entscheidung = frühere dokumentierte Entscheidung.

| Funktion | Ort | Anwendung | Standardtest | sonstige Tests | frühere Entscheidung | Einordnung |
|---|---|---|---|---|---|---|
| `fensterNach` | `index.html` 1038 | 0 | – | – | – | nicht erreichbar |
| `fensterListe` | `index.html` 1030 | nur `fensterNach` | – | – | – | nur über `fensterNach` |
| `fristMs` | `index.html` 1029 | nur `fensterNach` | – | – | – | nur über `fensterNach` |
| `abfrageT` | `index.html` 1850 | nur die überlagerte `sichtungText` | – | – | – | nicht erreichbar (B-3) |
| `adresseHinterlegt` | `index.html` 1851 | nur die überlagerte `sichtungText` | – | – | – | nicht erreichbar (B-3) |
| `sichtungText(e)` | `index.html` 1914 | überlagert durch `karte-modul.js` 682 | – | – | – | nicht ausführbar (B-3) |
| `neuverbinden` | `index.html` 4112 (innere Funktion in der Navigation) | 0 | – | – | – | nicht erreichbar |
| `dokZeile` | `index.html` 2977 | 0 | `identitaeten` | – | „bewusst behalten (Entscheidung offen)“, `phase5-missionsinventar.md` Z. 148 und 178 | nur über Test |
| `legendeListe` | `index.html` 2993 | 0 | `identitaeten` | – | wie `dokZeile` | nur über Test |
| `missionsbetrieb` | `index.html` 2824 | 0 | `missionstrennung`, `phase5b2-recherchezugang`, `phase5b3-dossieroberflaeche`, `phase5b4-arbeitszugang`, `phase5b5-dossier-nachtraege`, `phase5b6-dossier-kennungen`, `phase5b7-missionsbetrieb`, `recherche-oberflaeche`, `sichtung-export` | – | „bewusst behalten“, `phase5-missionsinventar.md` Z. 178 | nur über Tests (Invariante) |
| `karteOhneMission` | `karte-modul.js` 108 | 0 | `phase5b7-missionsbetrieb` | – | wie `missionsbetrieb` | nur über Test (Invariante) |

Über Dev erreichbar (Abschnitt 3): `startVorziehen` (Zeile 1692, Aufrufer: Aktion `START_VORGEZOGEN`), `planEntfernen` (1787, Aufrufer: nur `startVorziehen`), `einsatzLaeuft` (1051) und `einsatzBeginn` (1047). Sie sind zur Laufzeit wirkungslos (Abschnitt 3.3), aber im Anwendungscode referenziert. `fmtRest` (Aufrufer `chronikBlock`) und `fmtDauer` (Aufrufer `startVorziehen`, `renderClock`) sind lebend und gehören nicht zu den Kandidaten; frühere Vermutungen zu diesen beiden Namen sind damit ausgeräumt.

Die Namen `ALT()`, `LM()`, `KM()`, `MS()`, `missionDef()` und `SCENARIO.missionen` sind bewusst nicht Teil dieser Untersuchung (Beschluss: unangetastet).

## 6. Auswirkungen einer späteren Entfernung (zur Vorbereitung der Entscheidung, nicht beantragt)

| Gruppe | Reichweite | Nötige Testanpassung | Risiko |
|---|---|---|---|
| A: `fensterNach`, `fensterListe`, `fristMs` | drei Funktionen, rund 20 Zeilen | keine Standardtests betroffen (kein Test nennt die Namen) | gering; rein tot |
| B: `neuverbinden` | eine innere Funktion, 10 Zeilen | keine | gering; rein tot |
| C: `sichtungText(e)` in `index.html`, `abfrageT`, `adresseHinterlegt` | drei Funktionen | keine Standardtests betroffen; vorher Zielzustand des Sichtungstextes festlegen | gering bis mittel: Entfernen beseitigt das latente Reihenfolgerisiko (B-3); die Variante in `karte-modul.js` bleibt die einzige |
| D: `SCENARIO.abfragen` und `SCENARIO.dokumentPruefung` | rund 21 kB Text in `szenario.js` | `tests/ents.js` (nicht registriert) liest die Schlüssel; Standardtests unberührt | mittel: größte Änderung am Szenariotext; setzt voraus, dass B-3 bereinigt ist; `szenario.js` wird auch von `karte3d.html` geladen |
| E: `dokZeile`, `legendeListe`, `missionsbetrieb`, `karteOhneMission` | vier Einzeiler/Funktionen | `identitaeten`, `phase5b7-missionsbetrieb` und weitere acht Standardtests müssten umgestellt werden | mittel: verlöre Invariantennachweise; bisher ausdrücklich behalten |
| F: Entwicklerkonsole `Dev`, `START_VORGEZOGEN`, `startVorziehen`, `planEntfernen` (`einsatzLaeuft`/`einsatzBeginn` nur, wenn die Tests geändert werden) | rund 60 Zeilen | `phase5c2b-tickblock` (Liste behaltener Funktionen), nicht registrierte `ab`, `flow2`, `fc`, historisches `au` | mittel: Produktentscheidung über die Entwicklerkonsole nötig |

Hinweis zu Gruppe F: `einsatzLaeuft()` und `einsatzBeginn()` stehen im Standardtest `phase5c2b-tickblock` in der Liste der bewusst behaltenen Funktionen; ihre Entfernung wäre eine eigene Entscheidung.

## 7. Offene Entscheidungen für Master Wayne

1. Soll die Entwicklerkonsole `window.Dev` erhalten bleiben (als Werkzeug, auch wenn `startJetzt` wirkungslos ist), geändert (Meldung korrigieren, z. B. „Start bereits erreicht“ statt „Einsatz läuft“) oder entfallen?
2. Soll die doppelte Funktion `sichtungText` bereinigt werden (Gruppe C), und soll dies vor einer Entscheidung über `SCENARIO.abfragen` geschehen?
3. Soll `SCENARIO.abfragen` samt `SCENARIO.dokumentPruefung` entfernt werden (Gruppe D), oder bleibt der Text als Historie?
4. Gruppen A und B (nachweislich ohne Aufrufer und ohne Test): Entfernung freigeben, oder zusammen mit anderen Gruppen später?
5. Gruppe E: weiterhin „bewusst behalten“, oder ist die Invariantenprüfung auf andere Weise zu sichern?

Jede Entfernung wäre ein eigener Pull Request mit eigenem Test (Beleg der Unerreichbarkeit vorher und nachher) und bleibt Draft bis zur unabhängigen Prüfung. Ohne ausdrückliche Freigabe wird nichts geändert.

## 8. Anhang: Analyseskripte

Erreichbarkeit der Funktionen (`analyse.js`; benötigt `acorn` und `acorn-walk`):

```js
const acorn = require('acorn'), walk = require('acorn-walk'), fs = require('fs'), path = require('path');
const root = process.argv[2];
const files = ['index.html', 'szenario.js', 'karte-modul.js', 'akten-modul.js', 'profil-modul.js', 'fall-modul.js',
  'recherche-modul.js', 'arbeitsstand-modul.js', 'karte.js', 'karte2.js'];
const srcs = [];
for (const f of files) {
  const p = path.join(root, f); if (!fs.existsSync(p)) continue;
  const t = fs.readFileSync(p, 'utf8');
  if (f.endsWith('.html')) { const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g; let m, i = 0; while ((m = re.exec(t))) srcs.push({ f: f + '#' + (i++), code: m[1] }); }
  else srcs.push({ f, code: t });
}
const decls = new Map(), refs = [];
for (const s of srcs) {
  const ast = acorn.parse(s.code, { ecmaVersion: 'latest', sourceType: 'script', allowHashBang: true });
  walk.full(ast, n => { if (n.type === 'FunctionDeclaration' && n.id) { (decls.get(n.id.name) || decls.set(n.id.name, []).get(n.id.name)).push(s.f); } });
  walk.ancestor(ast, { Identifier(node, st, anc) {
    const p = anc[anc.length - 2];
    if (p && p.type === 'FunctionDeclaration' && p.id === node) return;
    if (p && p.type === 'MemberExpression' && p.property === node && !p.computed) return;
    if (p && (p.type === 'Property' || p.type === 'MethodDefinition') && p.key === node && !p.computed && !p.shorthand) return;
    let owner = null;
    for (let i = anc.length - 2; i >= 0; i--) if (anc[i].type === 'FunctionDeclaration' && anc[i].id) { owner = anc[i].id.name; break; }
    refs.push({ name: node.name, owner });
  } });
}
const byName = {}; refs.forEach(r => (byName[r.name] = byName[r.name] || []).push(r));
const live = new Set(); let changed = true;
const isLive = n => (byName[n] || []).some(r => r.owner === null || (r.owner !== n && live.has(r.owner)));
while (changed) { changed = false; for (const n of decls.keys()) if (!live.has(n) && isLive(n)) { live.add(n); changed = true; } }
console.log([...decls.keys()].filter(n => !live.has(n)));
```

Doppelte globale Deklarationen (Top-Level, klassische Skripte):

```js
// wie oben die Quellen sammeln, dann je Quelle:
for (const stmt of ast.body) if (stmt.type === 'FunctionDeclaration') (m.get(stmt.id.name) || m.set(stmt.id.name, []).get(stmt.id.name)).push(file + ':' + zeile);
// ausgeben: Namen mit mehr als einem Eintrag. Ergebnis auf 5c5a545: nur sichtungText (index.html Z. 1914, karte-modul.js Z. 682).
```

Die ausgeführten Skriptfassungen lagen unter `/tmp` (außerhalb des Repositorys); die hier abgedruckte Fassung ist für die Prüfung gekürzt und gleichwertig (die Ausgabe der Langfassung enthielt zusätzlich Dateinamen und Zeilen).
