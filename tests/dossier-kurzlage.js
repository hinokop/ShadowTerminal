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

    const bereich = p.locator('#rch-dossier-unterlagen');
    const titelUnterlagen = bereich.locator(':scope > summary');
    assert.equal(await bereich.getAttribute('open'), null);
    await titelUnterlagen.click();
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
    await titelUnterlagen.click();
    assert.equal(await bereich.getAttribute('open'), null);
    await p.locator('#kl-text button').click();
    assert.notEqual(await bereich.getAttribute('open'), null);
    const ziel = bereich.locator('.rch-sprungziel');
    assert.equal(await ziel.getAttribute('id'), 'rch-u-' + unterlage);
    assert.match(await ziel.innerText(), /Verweis aus Kurzlage/);
    const pos = await ziel.boundingBox();
    assert.ok(pos && pos.y >= 0 && pos.y + pos.height <= 1000, 'Referenzzeile wird ins Sichtfeld gescrollt');
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
    assert.deepEqual(await p.locator('#dossier-verbindungen th').allTextContents(), ['Gegenüber', 'Typ', 'Richtung', 'Bewertung', 'Quelle', 'Aktion']);
    const unten = await p.locator('#dossier-verbindungen').evaluate(t => {
      const graph = t.parentElement.querySelector('.g-wrap');
      return !!graph && graph.getBoundingClientRect().bottom <= t.getBoundingClientRect().top;
    });
    assert.equal(unten, true);
    assert.match(await p.locator('#dossier-verbindungen tbody').innerText(), /P-9051.*ausgehend.*Eigene Angabe/s);
    await p.locator('#dossier-verbindungen tbody button[id^=vl-]').click();
    assert.equal(await p.evaluate(() => STATE.dossiers.auswahl), 'P-9051');

    await anmelden();
    await p.evaluate(() => dispatch({ type: 'NAVIGATION', modul: 'dossier' }));
    await oeffnen(id);
    assert.equal(await nummer(), eigene);
    assert.match(await p.locator('#kl-text').innerText(), /Belegte Kurzlage/);
    await p.waitForFunction(sel => document.querySelector(sel)?.naturalWidth === 960, vorschau);
    assert.equal(await p.locator('#dossier-verbindungen tbody button[id^=vl-]').count(), 1);
    assert.equal(await bereich.getAttribute('open'), null, 'Standard nach Neuladen ist zugeklappt');
    await p.locator('#kl-text button').click();
    const zuvor = await p.evaluate(() => JSON.stringify(PROFIL.recherche));
    await click('rch-x-' + unterlage);
    await click('dlg-cancel');
    assert.equal(await p.evaluate(() => JSON.stringify(PROFIL.recherche)), zuvor);
    await click('rch-x-' + unterlage);
    await click('dlg-ok');
    assert.equal(await p.locator('#rch-u-' + unterlage).count(), 0);
    assert.equal(await p.locator('#kl-text button').count(), 0);
    assert.match(await p.locator('#kl-text [title]').getAttribute('title'), /nicht verfügbar/);
    assert.deepEqual(await p.evaluate(() => {
      const r = PROFIL.recherche;
      return [r.faelle.length, r.quellen.length, r.fassungen.length, r.beobachtungen.length];
    }), [1, 0, 0, 0]);

    await click('rch-neu');
    await p.locator('#rch-datei').setInputFiles(png);
    await p.locator("#rch-fall").selectOption("F-001");
    await click('rch-ok');
    const dateiZeile = bereich.locator('[id^=rch-u-]').filter({ hasText: 'ersatz.png' });
    await dateiZeile.waitFor();
    const dateiId = (await dateiZeile.getAttribute('id')).slice('rch-u-'.length);
    const anhang = await p.evaluate(id => rchZuBeobachtung(id).f.anhang, dateiId);
    assert.equal(await p.evaluate(async key => (await RIDB.get(key)).size, anhang), png.buffer.length);
    await click('rch-x-' + dateiId);
    await click('dlg-ok');
    await dateiZeile.waitFor({ state: 'detached' });
    await p.waitForFunction(async key => !(await RIDB.get(key)), anhang);

    const geteilt = await p.evaluate(() => {
      const id = STATE.dossiers.auswahl;
      dispatch({ type: 'RECHERCHE_BELEG', dossier: id, fall: 'F-001', art: 'Text', fassung: { anhang: false }, zitat: 'Geteilte Unterlage' });
      const b = PROFIL.recherche.beobachtungen[0];
      b.dossiers.push('P-9051');
      profilSpeichern();
      renderModule();
      return b.id;
    });
    assert.match(await p.locator('#rch-x-' + geteilt).innerText(), /Vom Dossier lösen/);
    await click('rch-x-' + geteilt);
    await click('dlg-ok');
    assert.equal(await p.locator('#rch-u-' + geteilt).count(), 0);

    const eigeneKante = p.locator('#dossier-verbindungen button[id^=vx-]');
    const kante = await eigeneKante.getAttribute('id');
    await eigeneKante.click();
    await click('dlg-cancel');
    assert.equal(await eigeneKante.count(), 1);
    await eigeneKante.click();
    await click('dlg-ok');
    assert.equal(await eigeneKante.count(), 0);

    const beispiel = await p.evaluate(() => {
      const v = SCENARIO.standard.verbindungen.find(x => x.von === 'P-9051' || x.nach === 'P-9051');
      return v && { id: v.id, gegenueber: v.von === 'P-9051' ? v.nach : v.von };
    });
    assert.ok(beispiel);
    await oeffnen('P-9051');
    await titelUnterlagen.click();
    await p.locator('#rch-u-' + geteilt).waitFor();
    await click('vx-' + beispiel.id);
    await click('dlg-ok');
    assert.equal(await p.locator('#vl-' + beispiel.id).count(), 0);
    await oeffnen(beispiel.gegenueber);
    assert.equal(await p.locator('#vl-' + beispiel.id).count(), 0);

    await anmelden();
    await p.evaluate(() => dispatch({ type: 'NAVIGATION', modul: 'dossier' }));
    await oeffnen('P-9051');
    assert.equal(await p.locator('#vl-' + beispiel.id).count(), 0);
    assert.equal(await p.locator('#' + kante).count(), 0);
    assert.deepEqual(await p.evaluate(() => PROFIL.recherche.beobachtungen.map(b => [b.id, b.dossiers])), [[geteilt, ['P-9051']]]);
    assert.equal(await p.evaluate(() => STATE.dossiers.eigeneKanten.length), 0);
    assert.equal(await p.evaluate(id => kantenPool().some(v => v.id === id), beispiel.id), false);
    assert.deepEqual(fehler, []);
    console.log('Registernummer, Kurzlage, Lichtbild, Aufnahmen, Sichtung, Kurzlage-Sprung und Entfernen von Unterlagen und Verbindungen: grün');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
