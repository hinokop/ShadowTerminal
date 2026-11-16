/* Kompatibilität nach Entfernen von seq.galerie: frisches Profil führt den Zähler nicht mehr, ein altes Profil mit seq.galerie lädt und nummeriert Aufnahmen weiter aus dem Bestand,
   und der Profilimport übernimmt den Zähler aus älteren Dateien nicht. Exit-Code 1 bei Fehlschlag. */
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
    async function start() {
      await p.goto(APP);
      await p.fill('#gate-pw', 'pw-test-123');
      if (await p.isVisible('#gate-pw2')) await p.fill('#gate-pw2', 'pw-test-123');
      await p.click('#gate-go');
      await p.waitForFunction(() => !document.querySelector('#gate-seq').hidden || !document.body.classList.contains('locked'));
      await p.keyboard.press('Space');
      await p.click('#nav-dossier');
    }
    await start();
    assert.equal(await p.evaluate(() => 'galerie' in PROFIL.seq), false, 'frisches Profil führt seq.galerie nicht mehr');
    const bild = await p.evaluate(() => { const c = document.createElement('canvas'); c.width = c.height = 4; return c.toDataURL('image/jpeg'); });
    const d = await p.evaluate(() => STATE.dossiers.auswahl);
    /* Altprofil: seq.galerie = 999 und eine vorhandene Aufnahme G-001 */
    await p.evaluate(({ d, bild }) => {
      profilSpeichern();
      const o = JSON.parse(localStorage.getItem(PROFIL_KEY));
      o.seq.galerie = 999; o.galerie = { [d]: [{ id: 'G-001', t: '2020-01-01T00:00:00.000Z', bild, text: 'alt' }] };
      localStorage.setItem(PROFIL_KEY, JSON.stringify(o));
    }, { d, bild });
    await start();
    assert.deepEqual(await p.evaluate(d => PROFIL.galerie[d].map(f => f.id), d), ['G-001'], 'Altprofil lädt');
    const file = { name: 'a.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(bild.split(',')[1], 'base64') };
    await p.locator('#gal-file').setInputFiles(file);
    await p.locator('#gal-G-002').waitFor({ timeout: 4000 });
    assert.deepEqual(await p.evaluate(d => PROFIL.galerie[d].map(f => f.id), d), ['G-001', 'G-002'], 'Nummer aus dem Bestand, nicht aus dem alten Zähler');
    /* Profilimport aus älterer Datei mit seq.galerie */
    const r = await p.evaluate(({ d, bild }) => {
      const q = { v: 1, eigene: [], eigeneKanten: [], seq: { galerie: 777 }, galerie: { [d]: [{ id: 'G-050', t: '2019-01-01T00:00:00.000Z', bild, text: 'aus Datei' }] } };
      dispatch({ type: 'PROFIL_IMPORT', profil: q, datei: 'Alt' });
      return { ids: PROFIL.galerie[d].map(f => f.id), seq: PROFIL.seq.galerie };
    }, { d, bild });
    assert.deepEqual(r.ids, ['G-001', 'G-002', 'G-050']);
    assert.notEqual(r.seq, 777, 'Import übernimmt seq.galerie nicht');
    assert.deepEqual(fehler, []);
    console.log('OK: seq.galerie entfällt, Altprofil und Import bleiben verträglich');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
