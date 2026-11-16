const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { APP } = require('./_pfad');
(async () => {
  const browser = await chromium.launch();
  try {
    const p = await browser.newPage({ reducedMotion: 'reduce' });
    const fehler = [];
    p.on('pageerror', e => fehler.push(e.message));
    await p.route(/^https?:/, r => r.abort());
    await p.goto(APP);
    await p.fill('#gate-pw', 'pw-test-123');
    await p.fill('#gate-pw2', 'pw-test-123');
    await p.click('#gate-go');
    await p.waitForFunction(() => !document.querySelector('#gate-seq').hidden || !document.body.classList.contains('locked'));
    await p.keyboard.press('Space');
    await p.click('#nav-dossier');
    await p.locator('#x-dossier-kein-fall').waitFor();
    const ids = await p.evaluate(() => {
      const d = STATE.dossiers.auswahl;
      const direkt = xAnlegen({ titel: 'Direkt verknüpft' }, d);
      dispatch({ type: 'RECHERCHE_BELEG', dossier: d, neuerFall: { titel: 'Aus der Ablage' }, fassung: {}, zitat: 'Notiz', art: 'Text' });
      const material = PROFIL.recherche.faelle.at(-1);
      profilSpeichern(); renderModule();
      return { d, direkt: direkt.id, material: material.id };
    });
    const links = p.locator('#x-dossier-faelle button');
    assert.equal(await links.count(), 2);
    assert.match(await p.locator('#x-dossier-verweis-' + ids.material).textContent(), /über Unterlagen/);
    await p.click('#x-dossier-verweis-' + ids.direkt);
    assert.equal(await p.inputValue('#x-titel'), 'Direkt verknüpft');
    await p.click('#x-dossier-loesen-' + ids.d);
    await p.click('#nav-dossier');
    assert.equal(await links.count(), 1);
    await p.click('#x-dossier-verweis-' + ids.material);
    assert.equal(await p.inputValue('#x-titel'), 'Aus der Ablage');
    await p.click('#x-loeschen');
    await p.check('#dlg-pflicht');
    await p.click('#dlg-ok');
    await p.click('#nav-dossier');
    await p.locator('#x-dossier-kein-fall').waitFor();
    assert.equal(await links.count(), 0);
    assert.deepEqual(fehler, []);
    console.log('OK: direkte und indirekte Fallverweise, Sprung nach X, Lösen und Löschen');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
