/* Messen im Recherchebetrieb, ohne Auftrag oder Handler. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { APP } = require('./_pfad');
(async () => {
  const b = await chromium.launch();
  try {
    const p = await b.newPage({ reducedMotion: 'reduce', viewport: { width: 1500, height: 1000 } });
    await p.route(/^https?:/, r => r.abort());
    await p.goto(APP);
    await p.fill('#gate-pw', 'pw-test-123');
    if (await p.isVisible('#gate-pw2')) await p.fill('#gate-pw2', 'pw-test-123');
    await p.click('#gate-go');
    await p.locator('#nav-karte').click();
    const svg = p.locator('#k-svg');
    const messen = p.locator('#k-messen');
    await p.locator("#k-eb-t").click();
    await messen.click();
    await svg.click({ position: { x: 130, y: 250 } });
    await svg.click({ position: { x: 220, y: 310 } });
    await svg.locator(".k-mess-t").waitFor();
    assert.equal(await svg.locator('.k-mess-p').count(), 2);
    assert.match(await svg.locator('.k-mess-t').textContent(), /km|\bm\b/);
    await messen.click();
    assert.equal(await svg.locator('.k-mess-p').count(), 0);
    await messen.click();
    await svg.click({ position: { x: 130, y: 250 } });
    await p.locator('#nav-dossier').click();
    await p.locator('#nav-karte').click();
    assert.equal(await messen.getAttribute('aria-pressed'), 'false');
    assert.equal(await svg.locator('.k-mess-p').count(), 0);
    console.log('OK: zwei Messpunkte, Distanz, Löschen und Modulwechsel ohne Mission');
  } finally { await b.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
