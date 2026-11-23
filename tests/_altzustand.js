/* Gemeinsamer Helfer: migrierter Format-4-Zustand mit tatsächlich vorhandenen historischen Freigabestufen.
   Phase 5c2b (b)-Nachtrag (Teststärkung). Grundlage ist die kontrollierte Migrationsfixture tests/fixtures/altprofil-mission.json
   (Format 4, Missionsfelder). Vor der Anmeldung wird in den Speicher geschrieben, die Anwendung überführt den Zustand beim
   Entsperren nach Format 5; dabei entsteht STATE.altbestand mit infozugang.

   Historische Freigabestufen (Stand vor Phase 5b7, Funktion wissen()):
     'frei'     Eintrag infozugang[id] = { status: 'frei' }      voller Zugang
     'bekannt'  Eintrag infozugang[id] = { status: 'bekannt' }   Name bekannt, Dossier gesperrt
     'unbekannt' kein Eintrag                                    Standarddossier ohne Freigabe, gesperrt
   Der Helfer legt für drei Standard-Personendossiers je eine Stufe an und gibt deren Kennungen zurück.
   Zusätzlich erhält ein viertes Standarddossier die Stufe 'frei' und wird vom Test manuell gesperrt (Sperre muss die Freigabe schlagen). */
const fs = require('fs');
const path = require('path');
const FIX = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'altprofil-mission.json'), 'utf8'));
const KENNWORT = 'pw-test-123';

/* Wählt vier Standard-Personendossiers (feste Reihenfolge des Szenarios, ohne eigene Dossiers). */
async function standardPersonen(p) {
  return p.evaluate(() => SCENARIO.standard.dossiers.filter(e => e.typ === 'Person' && !e.eigen).slice(0, 4).map(e => e.id));
}

/* Öffnet die Anwendung in einer Seite, schreibt den Format-4-Zustand in den Speicher, lädt neu und meldet an.
   Rückgabe: { ids: { bekannt, frei, unbekannt, gesperrtFrei }, vorher: <Kopie des geschriebenen infozugang> }. */
async function altzustandOeffnen(p, APP, extra) {
  await p.goto(APP);
  const [bekannt, frei, unbekannt, gesperrtFrei] = await standardPersonen(p);
  if (!(bekannt && frei && unbekannt && gesperrtFrei)) throw new Error('Szenario enthält weniger als vier Standard-Personendossiers');
  const s = JSON.parse(JSON.stringify(FIX.state)), pr = JSON.parse(JSON.stringify(FIX.profil));
  s.infozugang = Object.assign({}, s.infozugang, {
    [bekannt]: { status: 'bekannt' },
    [frei]: { status: 'frei' },
    [gesperrtFrei]: { status: 'frei' }
  });
  /* 'unbekannt' = bewusst kein Eintrag */
  if (extra && typeof extra.state === 'function') extra.state(s);
  await p.evaluate(a => { localStorage.setItem(STORAGE_KEY, a.s); localStorage.setItem(PROFIL_KEY, a.p); }, { s: JSON.stringify(s), p: JSON.stringify(pr) });
  await p.goto(APP);
  await p.fill('#gate-pw', KENNWORT);
  if (await p.isVisible('#gate-pw2')) await p.fill('#gate-pw2', KENNWORT);
  await p.click('#gate-go');
  await p.waitForFunction(() => !document.body.classList.contains('locked'));
  return { ids: { bekannt, frei, unbekannt, gesperrtFrei }, vorher: JSON.parse(JSON.stringify(s.infozugang)) };
}

/* Prüft, dass der migrierte Zustand tatsächlich einen Altbestand mit den gewünschten Stufen enthält
   (sonst wäre die Prüfung wieder wirkungslos, vgl. Befund zu den Entkopplungstests). Gibt eine Kopie des Altbestands zurück. */
async function altbestandPruefen(p, assert, ids) {
  const a = await p.evaluate(() => ({ v: STATE.version, alt: JSON.parse(JSON.stringify(STATE.altbestand || null)) }));
  assert.equal(a.v, 5, 'Fixture auf Format 5 überführt');
  assert.ok(a.alt && a.alt.infozugang, 'Altbestand mit infozugang vorhanden');
  assert.equal(a.alt.infozugang[ids.bekannt].status, 'bekannt', 'Stufe bekannt vorhanden');
  assert.equal(a.alt.infozugang[ids.frei].status, 'frei', 'Stufe frei vorhanden');
  assert.equal(a.alt.infozugang[ids.gesperrtFrei].status, 'frei', 'Stufe frei (später manuell gesperrt) vorhanden');
  assert.equal(ids.unbekannt in a.alt.infozugang, false, 'Stufe unbekannt = kein Eintrag');
  return a.alt;
}

/* Der Altbestand muss nach allen Aktionen bytegleich sein (Speicher und gespeicherter Zustand). */
async function altbestandUnveraendert(p, assert, vorher, text) {
  const jetzt = await p.evaluate(() => ({
    mem: JSON.parse(JSON.stringify(STATE.altbestand || null)),
    ls: (() => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)).altbestand || null; } catch (e) { return 'FEHLER'; } })()
  }));
  assert.deepEqual(jetzt.mem, vorher, 'Altbestand im Speicher unverändert: ' + text);
  return jetzt;
}

module.exports = { FIX, altzustandOeffnen, altbestandPruefen, altbestandUnveraendert, standardPersonen };
