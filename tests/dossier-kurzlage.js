/* Akzeptanztest für die echte Dossieransicht, einschließlich Galerie und Tabelle unter dem Graphen. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const PF = require('./_pfad.js');

(async () => {
  const browser = await chromium.launch();
  try {
    const p = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const fehler = [];
    p.on('pageerror', e => fehler.push(e.message));
    await p.route(/^https?:/, r => r.abort());
    const anmelden = async () => {
      await p.goto(PF.APP);
      await p.locator('#gate-pw').fill('pw-test-123', { timeout: 20000 });
      if (await p.locator('#gate-pw2').isVisible()) await p.locator('#gate-pw2').fill('pw-test-123');
      await p.locator('#gate-go').click();
      await p.waitForFunction(() => !document.body.classList.contains('locked'));
    };
    const click = id => p.locator('#' + id).click();
    const nummer = () => p.locator('.field').filter({ has: p.getByText('Registernummer', { exact: true }) }).locator('dd').innerText();
    const oeffnen = id => click('dl-' + id);
    await anmelden();
    await p.evaluate(() => dispatch({ type: 'NAVIGATION', modul: 'dossier' }));
    await oeffnen('P-9051');
    assert.equal(await nummer(), 'ohne', 'Öffnen vergibt keine Registernummer');
    await click('btn-dbearb');
    assert.equal(await p.locator('#dlg label').filter({ hasText: 'Registernummer' }).count(), 0);
    await click('dlg-ok');
    const archiv = await nummer();
    assert.match(archiv, /^REG-[A-F0-9]{8}-[A-F0-9]{8}$/);
    await click('btn-dbearb');
    await p.locator('#bd-rolle').fill('Geänderte Beschreibung für den Browsertest');
    await click('dlg-ok');
    assert.equal(await nummer(), archiv);
    await click('btn-dorig');
    assert.equal(await nummer(), archiv, 'Auf Original zurücksetzen behält die Nummer');
    await oeffnen('P-0001');
    const bestand = await nummer();
    assert.notEqual(bestand, 'ohne');
    await click('btn-dbearb');
    await click('dlg-ok');
    assert.equal(await nummer(), bestand, 'Bestehende Archivnummer bleibt unverändert');

    await click('btn-dneu');
    assert.equal(await p.locator('#dlg label').filter({ hasText: 'Registernummer' }).count(), 0);
    await p.locator('#nd-name').fill('Dossier-Browsertest');
    await click('dlg-ok');
    const id = await p.evaluate(() => STATE.dossiers.auswahl);
    const eigene = await nummer();
    assert.match(eigene, /^REG-[A-F0-9]{8}-[A-F0-9]{8}$/);
    assert.notEqual(eigene, archiv);

    await click('rch-neu');
    await p.locator('#rch-fall').selectOption('__neu');
    await p.locator('#rch-fall-titel').fill('Fall für den Dossiertest');
    await p.locator('#rch-text').fill('Dokumentierter Auszug zur Kurzlage.');
    await click('rch-ok');
    const unterlage = await p.evaluate(() => PROFIL.recherche.beobachtungen[0].id);
    await click('kl-bearbeiten');
    await p.locator('#kl-eingabe').fill('Belegte Kurzlage');
    await p.locator('#kl-eingabe').press('Control+a');
    await p.getByRole('button', { name: 'Fett', exact: true }).click();
    await p.locator('#kl-unterlage').selectOption(unterlage);
    await click('kl-einfuegen');
    await click('kl-speichern');
    assert.match(await p.locator('#kl-text').locator('b,strong').innerText(), /^Belegte Kurzlage\b/);
    await p.locator('#kl-text button').click();
    assert.equal(await p.evaluate(() => document.activeElement.id), 'rch-u-' + unterlage);
    assert.match(await p.locator('.mitfoto').innerText(), /Zuletzt verändert durch\s+CN /i);

    // Synthetisches großes JPEG und PNG. Keine persönlichen Fotos oder Netzwerkressourcen.
    const bilder = await p.evaluate(() => ['image/jpeg', 'image/png'].map((mime, i) => {
      const c = document.createElement('canvas'); c.width = 2400; c.height = 1600;
      const ctx = c.getContext('2d'); ctx.fillStyle = i ? '#4c8' : '#268'; ctx.fillRect(0, 0, c.width, c.height);
      ctx.fillStyle = '#dca'; ctx.fillRect(600, 300, 1300, 900);
      return { mime, data: c.toDataURL(mime).split(',')[1] };
    }));
    const [jpg, png] = bilder.map(({ mime, data }, i) => ({ name: i ? 'ersatz.png' : 'aufnahme.jpg', mimeType: mime, buffer: Buffer.from(data, 'base64') }));
    const lichtbild = async datei => {
      const [wahl] = await Promise.all([p.waitForEvent('filechooser'), click('fx-bild-knopf')]);
      await wahl.setFiles(datei);
      await p.waitForFunction(() => {
        const img = document.querySelector('#fx-bild-knopf img');
        return img && img.complete && img.naturalWidth === 240 && img.naturalHeight === 300;
      });
      return p.locator('#fx-bild-knopf img').getAttribute('src');
    };
    const erstesFoto = await lichtbild(jpg);
    await lichtbild(png);
    assert.notEqual(await p.locator('#fx-bild-knopf img').getAttribute('src'), erstesFoto);
    await click('btn-fx');
    await p.locator('#fx-bild-knopf img').waitFor({ state: 'detached' });

    await p.locator('#gal-text').fill('Geländeaufnahme');
    await p.locator('#gal-file').setInputFiles(jpg);
    const vorschau = '.gal img[alt="Geländeaufnahme"]';
    await p.waitForFunction(sel => {
      const img = document.querySelector(sel);
      return img && img.complete && img.naturalWidth === 960 && img.naturalHeight === 640;
    }, vorschau);
    await p.locator(vorschau).click();
    await p.locator('#dlg[open] .gal-gross').waitFor();
    await click('dlg-ok');

    await click('btn-dk-sichtung');
    assert.match(await p.locator('[role=tab][aria-selected=true]').innerText(), /Sichtungen/);
    await p.getByRole('tab', { name: 'Übersicht', exact: true }).click();
    await p.locator('#dn-text').fill('Notiz im Bestand');
    await click('btn-dn');
    await p.locator('#vn-ziel').selectOption('P-9051');
    await click('btn-vn');
    assert.deepEqual(await p.locator('#dossier-verbindungen th').allTextContents(), ['Gegenüber', 'Typ', 'Richtung', 'Bewertung', 'Quelle']);
    const unten = await p.locator('#dossier-verbindungen').evaluate(t => {
      const graph = t.parentElement.querySelector('.g-wrap');
      return !!graph && graph.getBoundingClientRect().bottom <= t.getBoundingClientRect().top;
    });
    assert.equal(unten, true);
    assert.match(await p.locator('#dossier-verbindungen tbody').innerText(), /P-9051.*ausgehend.*Eigene Angabe/s);
    await p.locator('#dossier-verbindungen tbody button').click();
    assert.equal(await p.evaluate(() => STATE.dossiers.auswahl), 'P-9051');

    await anmelden();
    await p.evaluate(() => dispatch({ type: 'NAVIGATION', modul: 'dossier' }));
    await oeffnen(id);
    assert.equal(await nummer(), eigene);
    assert.match(await p.locator('#kl-text').innerText(), /Belegte Kurzlage/);
    await p.waitForFunction(sel => document.querySelector(sel)?.naturalWidth === 960, vorschau);
    assert.equal(await p.locator('#dossier-verbindungen tbody button').count(), 1);
    assert.deepEqual(fehler, []);
    console.log('Registernummer, Kurzlage, Lichtbild, Aufnahmen, Sichtung und klickbare Verbindungstabelle: grün');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
