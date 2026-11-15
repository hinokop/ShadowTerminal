const assert = require('node:assert/strict');
const PF = require('./_pfad.js');
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  try {
    const p = await b.newPage({ viewport: { width: 1366, height: 768 } }), fehler = [];
    p.on('pageerror', e => fehler.push(e.message));
    await p.route(/^https?:/, r => r.abort());
    async function login() {
      await p.locator('#gate-pw').fill('pw-test-123');
      if (await p.locator('#gate-pw2').isVisible()) await p.locator('#gate-pw2').fill('pw-test-123');
      await p.click('#gate-go');
      await p.waitForFunction(() => !document.body.classList.contains('locked'));
    }
    await p.goto(PF.APP); await login();
    assert.deepEqual(await p.getByRole('tablist').getByRole('tab').allTextContents(), ['Profil', 'Identitäten (3)', 'Ausgangsorte']);
    assert.equal(await p.locator('#main').getByText('RAIZO', {exact:true}).count(), 1);
    assert.equal(await p.locator('#main').getByText(/Meldewesen|Freigabestufe|Ausrüstungsübersicht|Abdruck Legende|Abdruck Asset/).count(), 0);
    assert.equal(await p.locator('#h-melde, #h-checkin').count(), 0);
    assert.equal(await p.locator('#btn-karte-bereinigen').isVisible(), true);
    assert.equal(await p.locator('#h-status').textContent(), 'Offline');
    const mission = () => p.evaluate(() => [STATE.agent.status, !!LM(), STATE.komm.kanaele.handler.nachrichten.length]);
    const alt = await mission();
    await p.locator('#sel-status').selectOption('Aktiv');
    assert.equal(await p.locator('#h-status').textContent(), 'Aktiv');
    assert.deepEqual(await mission(), alt);
    const polygon = () => p.locator('.profil-radar-form').getAttribute('points');
    const vorher = await polygon();
    await p.getByText('Werte bearbeiten', {exact:true}).click();
    await p.locator('#radar-cyber').fill('0');
    await p.locator('#profil-radar-speichern').click();
    assert.notEqual(await polygon(), vorher);
    assert.match(await p.locator('.profil-radar-werte').textContent(), /Cyber0/);
    await p.click('#reiter-orte');
    assert.equal(await p.locator('#btn-ausgang-neu').isVisible(), true);
    assert.equal(await p.locator('.profil-radar').count(), 0);
    await p.click('#reiter-tarn');
    const karten = p.locator('.profil-identitaeten > .panel');
    assert.equal(await karten.count(), 3);
    const boxen = await karten.evaluateAll(els => els.map(e => {
      const r = e.getBoundingClientRect(); return {x:r.x, y:r.y, width:r.width, height:r.height};
    }));
    assert.equal(boxen.every(r => r.x === boxen[0].x && r.width === boxen[0].width), true);
    assert.equal(boxen[1].y >= boxen[0].y + boxen[0].height, true);
    assert.equal(boxen[2].y >= boxen[1].y + boxen[1].height, true);
    assert.equal(await karten.getByRole('row').count(), 9);
    const [auswahl] = await Promise.all([p.waitForEvent('filechooser'), p.click('#id-nr-H-01')]);
    await auswahl.setFiles({ name:'eigene-anlage.txt', mimeType:'text/plain', buffer:Buffer.from('Testanlage') });
    await karten.nth(0).getByText('eigene-anlage.txt', {exact:true}).waitFor();
    await p.click('#btn-leg-ausweich');
    await p.click('#dlg-ok');
    assert.equal(await p.evaluate(() => aktiveLegendeId()), 'ausweich');
    await p.reload(); await login();
    assert.equal(await p.locator('#h-status').textContent(), 'Aktiv');
    assert.match(await p.locator('.profil-radar-werte').textContent(), /Cyber0/);
    assert.match(await p.locator('#main').textContent(), /Sven Albrecht · Reporter/);
    await p.click('#reiter-tarn');
    await karten.nth(0).getByText('eigene-anlage.txt', {exact:true}).waitFor();
    const [download] = await Promise.all([p.waitForEvent('download'), karten.nth(0).getByRole('button', {name:'Herunterladen'}).click()]);
    assert.equal(download.suggestedFilename(), 'eigene-anlage.txt');
    await karten.nth(0).getByRole('button', {name:'Entfernen', exact:true}).click();
    await p.click('#dlg-ok');
    await p.waitForFunction(() => [...document.querySelectorAll('[data-identitaet="haupt"] tbody tr')].every(e => e.textContent.includes('Keine Datei')));
    assert.deepEqual(fehler, []);
    console.log('OK: Arbeitsprofil, Radar und unabhängiger Status, Ausgangsorte, drei gestapelte Identitäten und lokale Anlagen mit Neustart');
  } finally { await b.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
