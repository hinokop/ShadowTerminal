/* Phase 5c2b (b): Entfernung von IZ() und aussagenListe().
   Belegt wird:
   (1) beide Funktionen sind nicht mehr vorhanden, ALT() bleibt und liefert ohne Altbestand das eingefrorene leere Objekt;
   (2) ein frischer Zustand (ohne gespeicherten Zustand) enthält keinen Altbestand, auch nicht nach der Vorbereitung, die die früheren
       Gruppe-3-Tests (kt, kv3, un, emp2, kt2, kt3) vor ihren Prüfungen ausführen (Status, Auftragsaktionen, Wechsel zur Karte), nach
       dem Speichern und nach dem Neuladen;
   (3) die umgestellten Testskripte erzeugen den Altbestand nicht künstlich: die sechs Gruppe-3-Skripte enthalten weder IZ( noch altbestand,
       die Standardtests enthalten keinen Aufruf von IZ( oder aussagenListe( mehr.
   Exit-Code 1 bei Fehlschlag. */
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { APP } = require('./_pfad');

async function anmelden(p) {
  await p.fill('#gate-pw', 'pw-test-123');
  if (await p.isVisible('#gate-pw2')) await p.fill('#gate-pw2', 'pw-test-123');
  await p.click('#gate-go');
  await p.waitForFunction(() => !document.body.classList.contains('locked'));
}

(async () => {
  const browser = await chromium.launch();
  const fehler = [];
  try {
    /* (3) Quelltextprüfung der umgestellten Skripte */
    ['kt', 'kv3', 'un', 'emp2', 'kt2', 'kt3'].forEach(n => {
      const q = fs.readFileSync(path.join(__dirname, n + '.js'), 'utf8');
      assert.ok(!/IZ\(/.test(q), n + ': kein IZ( mehr');
      assert.ok(!/altbestand/i.test(q), n + ': kein künstlich erzeugter Altbestand');
    });
    const runall = fs.readFileSync(path.join(__dirname, 'runall.js'), 'utf8');
    const gruppen = runall.match(/const GRUPPEN = \[([\s\S]*?)\n\];/)[1];
    [...gruppen.matchAll(/'([^']+)'/g)].map(m => m[1]).forEach(n => {
      if (n === 'phase5c2b-frischer-zustand') return;
      const q = fs.readFileSync(path.join(__dirname, n + '.js'), 'utf8');
      assert.ok(!/\bIZ\(/.test(q) && !/aussagenListe\(/.test(q), n + ': kein Aufruf von IZ( oder aussagenListe(');
    });

    /* (1), (2) frischer Zustand im Browser */
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 }, reducedMotion: 'reduce' });
    const p = await ctx.newPage();
    p.setDefaultTimeout(20000);
    p.on('pageerror', e => fehler.push(e.message));
    await p.route(/^https?:/, r => r.abort());
    await p.goto(APP);
    await p.evaluate(() => { localStorage.clear(); });
    await p.goto(APP);
    await anmelden(p);

    const t = await p.evaluate(() => ({ iz: typeof IZ, al: typeof aussagenListe, alt: typeof ALT,
      leer: ALT() === ALT_LEER && Object.isFrozen(ALT()) && Object.keys(ALT()).length === 0 }));
    assert.equal(t.iz, 'undefined', 'IZ ist entfernt');
    assert.equal(t.al, 'undefined', 'aussagenListe ist entfernt');
    assert.equal(t.alt, 'function', 'ALT bleibt');
    assert.equal(t.leer, true, 'ALT() liefert ohne Altbestand das eingefrorene leere Objekt');

    const zustand = () => p.evaluate(() => {
      const roh = localStorage.getItem(STORAGE_KEY);
      return { mem: STATE.altbestand === undefined && !('altbestand' in STATE), gespeichert: roh ? !('altbestand' in JSON.parse(roh)) : null, v: STATE.version };
    });
    let z = await zustand();
    assert.equal(z.mem, true, 'frischer Zustand ohne Altbestand im Speicher');
    assert.equal(z.v, 5, 'frischer Zustand im Format 5');

    /* Vorbereitung der früheren Gruppe-3-Tests */
    await p.evaluate(() => {
      dispatch({ type: 'KENNWORT_SCHALTER', an: false });
      dispatch({ type: 'STATUS_GESETZT', status: 'Standby' });
      dispatch({ type: 'MISSION_ZUGEWIESEN', id: 'M1' });
      dispatch({ type: 'MISSION_ANGENOMMEN', id: 'M1' });
      dispatch({ type: 'MISSION_BEGINN_JETZT' });
      dispatch({ type: 'NAVIGATION', modul: 'karte' });
      renderModule();
    });
    await p.waitForSelector('#k-svg');
    await p.waitForTimeout(1500);
    z = await zustand();
    assert.equal(z.mem, true, 'nach der Vorbereitung kein Altbestand im Speicher');
    assert.equal(z.gespeichert, true, 'nach der Vorbereitung kein Altbestand im gespeicherten Zustand');

    await p.reload();
    await p.waitForSelector('#gate-pw').catch(() => null);
    if (await p.isVisible('#gate-pw')) await anmelden(p);
    await p.waitForFunction(() => typeof STATE !== 'undefined' && STATE && STATE.version);
    z = await zustand();
    assert.equal(z.mem, true, 'nach Neuladen kein Altbestand im Speicher');
    assert.equal(z.gespeichert, true, 'nach Neuladen kein Altbestand im gespeicherten Zustand');
    assert.deepEqual(fehler, [], 'keine Seitenfehler: ' + fehler.join(' | '));
    console.log('Phase 5c2b (b) frischer Zustand: ALLE OK');
  } catch (e) {
    console.log('FEHLER: ' + (e && e.message || e));
    process.exitCode = 1;
  } finally { await browser.close(); }
})();
