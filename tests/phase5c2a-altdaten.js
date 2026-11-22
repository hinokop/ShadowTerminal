/* Phase 5c2a: Darstellung der verbliebenen Missionsdaten (Entscheidung C, Master Wayne, 22.11.2026).
   Ein Zustand mit Altbestand (frühere Aussagen, offener Widerspruch, Berichte, Einschätzungen) zeigt im Dossier
   (1) keine Tabelle "Aussagen des Agenten" und keinen Hinweis "offener Widerspruch" im Sichtungsreiter,
   (2) eine Erkenntnislage, die nur eigene Sichtungen zählt,
   während (3) alle Altdaten unverändert in STATE.altbestand und im gespeicherten Zustand erhalten bleiben.
   Exit-Code 1 bei Fehlschlag. */
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { APP } = require('./_pfad');
const FIX = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'altprofil-mission.json'), 'utf8'));

function eingang() {
  const s = JSON.parse(JSON.stringify(FIX.state)), t = '2026-11-15T05:00:00.000Z', jetzt = new Date().toISOString();
  s.dossiers.entitaeten['P-0001'].sichtungen = [{ id: 'SI-901', t: jetzt, ort: 'Berlin', text: 'Sichtung an P-0001', guete: 'bestaetigt' }];
  s.seq.sichtung = Math.max(s.seq.sichtung || 0, 901);
  s.aussagen = [{ id: 'AS-001', t, entitaet: 'P-0001', wert: true, text: 'alte Aussage zu P-0001', status: 'gilt' }];
  s.widerspruch = { t: jetzt, entitaet: 'P-0001' };
  s.berichte = [{ t: jetzt, text: 'Bericht zu P-0001', id: 'B-901' }];
  s.infozugang = Object.assign({}, s.infozugang, { 'P-0001': { einschaetzung: { t: jetzt, quelle: 'B', text: 'alte Einschätzung' } } });
  return { state: JSON.stringify(s), profil: JSON.stringify(FIX.profil) };
}

(async () => {
  const browser = await chromium.launch();
  const fehler = [];
  try {
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 }, reducedMotion: 'reduce' });
    const p = await ctx.newPage();
    p.setDefaultTimeout(20000);
    p.on('pageerror', e => fehler.push(e.message));
    await p.route(/^https?:/, r => r.abort());
    await p.goto(APP);
    await p.evaluate(a => { localStorage.setItem(STORAGE_KEY, a.state); localStorage.setItem(PROFIL_KEY, a.profil); }, eingang());
    await p.goto(APP);
    await p.fill('#gate-pw', 'pw-test-123');
    if (await p.isVisible('#gate-pw2')) await p.fill('#gate-pw2', 'pw-test-123');
    await p.click('#gate-go');
    await p.waitForFunction(() => !document.body.classList.contains('locked'));

    const vor = await p.evaluate(() => ({ v: STATE.version, alt: JSON.parse(JSON.stringify(STATE.altbestand)) }));
    assert.equal(vor.v, 5, 'Zustand im Format 5');
    assert.equal(vor.alt.aussagen.length, 1, 'Altbestand enthält die Aussage');
    assert.equal(vor.alt.berichte.length, 1, 'Altbestand enthält den Bericht');
    assert.ok(vor.alt.infozugang['P-0001'].einschaetzung, 'Altbestand enthält die Einschätzung');
    assert.equal(vor.alt.widerspruch.entitaet, 'P-0001', 'Altbestand enthält den Widerspruch');

    /* (2) Erkenntnislage zählt nur die eine eigene Sichtung, nicht Bericht und Einschätzung */
    const erk = await p.evaluate(() => ({ text: erkenntnisText(entitaet('P-0001')), l: erkenntnisLage(entitaet('P-0001')) }));
    assert.match(erk.text, /^1 Spur, jüngste: Sichtung vom /, 'nur die eigene Sichtung: ' + erk.text);
    assert.equal(erk.l.anzahl, 1);
    const leer = await p.evaluate(() => erkenntnisText(entitaet('P-0002')));
    assert.equal(leer, 'Keine Erkenntnis erfasst.', 'ohne eigene Sichtung keine Erkenntnis (Altdaten zählen nicht)');

    /* (1) Sichtungsreiter ohne Aussagentabelle und ohne Widerspruchshinweis */
    await p.evaluate(() => { VIEW.dtab = 'sichtungen'; dispatch({ type: 'DOSSIER_GEOEFFNET', id: 'P-0001', ueber: 't', navigieren: true }); });
    await p.waitForSelector('#btn-si');
    const text = await p.evaluate(() => document.body.innerText);
    assert.match(text, /Sichtung an P-0001/, 'Sichtungsreiter zeigt die eigene Sichtung');
    assert.doesNotMatch(text, /Aussagen des Agenten/i, 'keine Aussagentabelle');
    assert.doesNotMatch(text, /alte Aussage zu P-0001/, 'kein Aussagentext');
    assert.doesNotMatch(text, /offener Widerspruch|ARGUS wartet/i, 'kein Widerspruchshinweis');

    /* (3) Altbestand im Speicher und im gespeicherten Zustand unverändert, auch nach Neuladen */
    await p.evaluate(() => dispatch({ type: 'DOSSIER_GEOEFFNET', id: 'P-0002', ueber: 't', navigieren: true }));
    const nach = await p.evaluate(() => ({ mem: JSON.parse(JSON.stringify(STATE.altbestand)), disk: JSON.parse(localStorage.getItem(STORAGE_KEY)).altbestand }));
    assert.deepEqual(nach.mem, vor.alt, 'Altbestand im Speicher unverändert');
    assert.deepEqual(nach.disk, vor.alt, 'Altbestand gespeichert unverändert');
    assert.deepEqual(fehler, [], 'keine Seitenfehler: ' + fehler.join(' | '));
    console.log('Phase 5c2a: ALLE OK');
  } catch (e) {
    console.log('FEHLER: ' + (e && e.message || e));
    process.exitCode = 1;
  } finally { await browser.close(); }
})();
