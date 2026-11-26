/* K1a: produktive ZO-Interaktion ohne alte Missionsdaten; ersetzt für diesen Vertrag
   die nicht mehr lauffähige eigene-zonen-Prüfung. Keine echte WebGL-Abnahme. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { APP } = require('./_pfad');
(async () => {
  const b = await chromium.launch();
  try {
    const p = await b.newPage({ viewport: { width: 1500, height: 1100 }, reducedMotion: 'reduce' });
    const errors = [];
    p.on('pageerror', e => errors.push(e.message));
    await p.route(/^https?:/, r => r.abort());
    await p.goto(APP);
    await p.fill('#gate-pw', 'pw-test-123');
    if (await p.isVisible('#gate-pw2')) await p.fill('#gate-pw2', 'pw-test-123');
    await p.click('#gate-go');
    await p.waitForFunction(() => !document.body.classList.contains('locked'));
    await p.evaluate(() => {
      VIEW.karte.reiter = 'karte'; VIEW.karte.lat = 52.5; VIEW.karte.lon = 13.4; VIEW.karte.zoom = 14;
      dispatch({ type: 'NAVIGATION', modul: 'karte' }); renderModule();
    });
    await p.click('#k-ozone-neu');
    const mitte = await p.locator('#k-svg').boundingBox();
    assert.ok(mitte && mitte.width > 0);
    await p.mouse.click(mitte.x + mitte.width / 2, mitte.y + mitte.height / 2);
    await p.locator('#oz-r').waitFor();
    const z = await p.evaluate(() => PROFIL.zonen.at(-1));
    assert.ok(z && /^ZO-/.test(z.id));
    assert.ok(Math.abs(z.ll[0] - 52.5) < 0.001 && Math.abs(z.ll[1] - 13.4) < 0.001, 'reale 2D-Mitte');
    await p.selectOption('#oz-r', '500');
    await p.waitForFunction(id => PROFIL.zonen.find(z => z.id === id).r === 500, z.id);
    assert.ok(await p.evaluate(id => karte3dDaten().zonen.some(z => z.id === id && z.r === 500), z.id));
    await p.evaluate(id => { karteWaehlen(null, false); karte3dEingang({ typ: 'karte3d-klick', lat: 52.5, lon: 13.4, zid: id, umschalt: true }); }, z.id);
    assert.equal(await p.evaluate(() => VIEW.karte.auswahl), z.id);
    assert.equal(await p.locator('#oz-r').inputValue(), '500');
    await p.evaluate(() => { VIEW.karte.zoneSetzen = 'eigen'; karte3dEingang({ typ: 'karte3d-klick', lat: 12.25, lon: 181 }); });
    const neu = await p.evaluate(() => PROFIL.zonen.at(-1));
    assert.notEqual(neu.id, z.id);
    assert.deepEqual(neu.ll, [12.25, -179]);
    assert.ok(await p.evaluate(id => karte3dDaten().zonen.some(z => z.id === id), neu.id));
    assert.deepEqual(errors, []);
    console.log('OK: eigene Zonen via realem SVG-Klick und synthetischer 3D-Nachricht, Radius und Datumsgrenze');
  } finally { await b.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
