/* Phase 5b7: Der alte Missionsbetrieb ist stillgelegt. Ein gespeichertes Altfeld
   STATE.missionsbetrieb bleibt über Speichern und Neuladen unverändert erhalten,
   hat aber keine Wirkung; Missionsaktionen setzen es nicht neu. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { APP } = require('./_pfad');

(async () => {
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 }, reducedMotion: 'reduce' });
    const p = await ctx.newPage();
    p.setDefaultTimeout(20000);
    const errors = [];
    p.on('pageerror', e => errors.push(e.message));
    await p.route(/^https?:/, r => r.abort());
    const anmelden = async () => {
      await p.goto(APP);
      await p.fill('#gate-pw', 'pw-test-123');
      if (await p.isVisible('#gate-pw2')) await p.fill('#gate-pw2', 'pw-test-123');
      await p.click('#gate-go');
      await p.waitForFunction(() => !document.body.classList.contains('locked'));
    };
    await anmelden();

    /* Frischer Zustand: Missionsaktionen setzen das Feld nicht. */
    const frisch = await p.evaluate(() => {
      const vorher = 'missionsbetrieb' in STATE;
      dispatch({ type: 'MISSION_ZUGEWIESEN', id: 'M1' });
      dispatch({ type: 'MISSION_ANGENOMMEN', id: 'M1' });
      dispatch({ type: 'AUTOMATIK_GESETZT', ein: true });
      return { vorher, nachher: 'missionsbetrieb' in STATE, mb: missionsbetrieb() };
    });
    assert.deepEqual(frisch, { vorher: false, nachher: false, mb: false }, 'Missionsaktionen setzen kein Altfeld');

    /* Gespeichertes Altfeld: bleibt erhalten, wirkt nicht. */
    await p.evaluate(() => { STATE.missionsbetrieb = true; Store.save(STATE); });
    await anmelden();
    const alt = await p.evaluate(() => {
      dispatch({ type: 'PIN_ANGELEGT', ll: [52.5, 13.4] });          /* beliebige Aktion speichert den Zustand erneut */
      const roh = JSON.parse(localStorage.getItem(STORAGE_KEY));
      const e = SCENARIO.standard.dossiers.find(x => x.typ === 'Person');
      return { geladen: STATE.missionsbetrieb === true, gespeichert: roh.missionsbetrieb === true,
        mb: missionsbetrieb(), wissen: wissen(e), offen: dossierOffen('M2'), zdef: zDef() === null,
        ohneMission: karteOhneMission() };
    });
    assert.deepEqual(alt, { geladen: true, gespeichert: true, mb: false, wissen: 'frei', offen: true, zdef: true, ohneMission: true },
      'Altfeld erhalten und ohne Wirkung');
    assert.deepEqual(errors, [], 'keine Browserfehler');
    console.log('OK: Phase 5b7 – Missionsbetrieb stillgelegt, Altfeld erhalten und wirkungslos');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
