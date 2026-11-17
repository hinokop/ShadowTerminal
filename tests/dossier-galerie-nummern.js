const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { APP } = require('./_pfad');

(async () => {
  const browser = await chromium.launch();
  try {
    const p = await browser.newPage({ reducedMotion: 'reduce' });
    const errors = [];
    p.on('pageerror', e => errors.push(e.message));
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
    const d = await p.evaluate(() => STATE.dossiers.auswahl);
    const bild = await p.evaluate(() => {
      const c = document.createElement('canvas');
      c.width = c.height = 4;
      return c.toDataURL("image/jpeg");
    });
    const file = { name: 'aufnahme.jpg', mimeType: "image/jpeg", buffer: Buffer.from(bild.split(',')[1], 'base64') };
    const foto = n => p.locator('#gal-G-' + n);
    async function laden(n) {
      await p.locator('#gal-file').setInputFiles(file);
      await foto(n).waitFor({ timeout: 4000 });
    }
    async function entfernen(n) {
      await foto(n).click();
      await p.click('#gal-x');
      await foto(n).waitFor({ state: 'detached' });
    }
    await laden('001');
    await entfernen('001');
    await start();
    await laden('001');
    await laden('002');
    await entfernen('002');
    await laden('002');
    assert.equal(await foto('001').count(), 1);

    const r = await p.evaluate(({ bild, d }) => {
      const anders = pool().find(e => e.id !== d).id;
      PROFIL.seq.galerie = 999;
      dispatch({ type: 'DOSSIER_FOTO_HINZU', id: anders, bild, text: 'Anderes Dossier' });
      const lokal = PROFIL.galerie[d][0];
      const gleich = Object.assign({}, lokal);
      const konflikt = { id: lokal.id, t: '2020-01-01T00:00:00.000Z', bild, text: 'Archivaufnahme' };
      const bestand = { id: 'G-009', t: konflikt.t, bild, text: 'In alter Sicherung' };
      const q = { v: 1, eigene: [], eigeneKanten: [], galerie: { [d]: [gleich, konflikt, bestand] } };
      for (let i = 0; i < 2; i++) dispatch({ type: 'PROFIL_IMPORT', profil: JSON.parse(JSON.stringify(q)), datei: 'Testprofil' });
      return [PROFIL.galerie[anders][0].id, PROFIL.galerie[d].map(f => [f.id, f.text])];
    }, { bild, d });
    assert.equal(r[0], 'G-001');
    assert.deepEqual(r[1], [['G-001', ''], ['G-002', ''], ['G-010', 'Archivaufnahme'], ['G-009', 'In alter Sicherung']]);
    await laden('011');
    assert.deepEqual(errors, []);
    console.log('OK: Aufnahmenummern je Dossier, Löschen/Neustart und kollisionsfreier Profilimport');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
