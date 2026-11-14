/* Arbeitsnavigation: sichtbare Module und ihre Kürzel, Rückkehr aus einem Altstand ohne Datenverlust. */
const assert = require('node:assert/strict');
const PF = require('./_pfad.js');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route(/^https?:/, route => route.abort());
    async function starten() {
      await page.locator('#gate-pw').fill('pw-test-123');
      const wiederholung = page.locator('#gate-pw2');
      if (await wiederholung.isVisible()) await wiederholung.fill('pw-test-123');
      await page.locator('#gate-go').click();
      await page.waitForFunction(() => !document.body.classList.contains('locked'));
    }
    await page.goto(PF.APP);
    await starten();

    assert.deepEqual(await page.locator('#nav-list .ttl').allTextContents(), ['Profil', 'Dossiers', 'Karte', 'Ablage']);
    for (const [taste, titel] of [['6', 'Karte'], ['7', 'Ablage'], ['3', 'Dossiers'], ['1', 'Profil']]) {
      await page.keyboard.press(taste);
      assert.equal(await page.locator('#mod-title').innerText(), titel);
    }
    for (const taste of ['2', '4', '5', '8', '9', 'Control+Shift+Alt+KeyR']) {
      await page.keyboard.press(taste);
      assert.equal(await page.locator('#mod-title').innerText(), 'Profil');
      assert.equal(await page.locator('#regie[open]').count(), 0);
    }

    const name = 'Bestand aus Altstand';
    await page.evaluate(name => {
      dispatch({ type: 'DOSSIER_ANGELEGT', typ: 'Person', name, land: 'DE' });
      dispatch({ type: 'PIN_ANGELEGT', name, ll: [52.5, 13.4] });
      STATE.ui.modul = 'mission';
      Store.save(STATE);
    }, name);
    await page.reload();
    await starten();
    assert.equal(await page.locator('#mod-title').innerText(), 'Profil');
    assert.ok(await page.evaluate(name => PROFIL.pins.some(p => p.name === name) && PROFIL.eigene.some(d => d.name === name), name));
    await page.evaluate(() => {
      const alt = JSON.parse(JSON.stringify(STATE));
      alt.ui.modul = 'komm';
      dispatch({ type: 'IMPORT', state: alt, datei: 'test-alt.json' });
    });
    assert.equal(await page.locator('#mod-title').innerText(), 'Profil');
    assert.deepEqual(errors, []);
    console.log('OK: Arbeitsnavigation, Tastenkürzel, Altstand und Zustandsimport');
  } finally {
    await browser.close();
  }
})().catch(function (e) { console.error(e); process.exitCode = 1; });
