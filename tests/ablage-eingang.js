const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { APP } = require('./_pfad');
(async () => {
  const b = await chromium.launch();
  try {
    const p = await b.newPage({reducedMotion:'reduce'}), errors = [];
    p.on('pageerror', e => errors.push(e.message));
    await p.route(/^https?:/, r => r.abort());
    async function start() {
      await p.goto(APP);
      await p.fill('#gate-pw','pw-test-123');
      if (await p.isVisible('#gate-pw2')) await p.fill('#gate-pw2','pw-test-123');
      await p.click('#gate-go');
      await p.click('#nav-akten'); await p.click('#ak-tab-eingang');
    }
    await start();
    assert.equal(await p.locator('#ak-tab-registratur').count(), 1);
    const datei = {name:'vorlaeufig.txt',mimeType:'text/plain',buffer:Buffer.from('Nur Text <script>kein HTML</script>')};
    await p.locator('#ak-eingang-datei').setInputFiles(datei);
    await p.locator('#ak-eingang-vorschau pre').waitFor();
    assert.equal(await p.locator('#ak-eingang-vorschau pre').textContent(), datei.buffer.toString());
    const key = await p.evaluate(() => { if (PROFIL.recherche.faelle.length) throw Error('Ungewollter Standardfall'); return akEingangLesen()[0].anhang; });
    await start();
    await p.locator('#ak-eingang-vorschau pre').waitFor();
    await p.click('#ak-eingang-zuordnen');
    assert.match(await p.locator('#sys-msg').textContent(), /Dossier und einen Fall/);
    async function zuordnen() {
      await p.selectOption('#ak-eingang-fall','__neu');
      await p.fill('#ak-eingang-titel','Ablagetest');
      await p.selectOption('#ak-eingang-dossier','P-0004');
      await p.fill('#ak-eingang-ft','2');
      await p.fill('#ak-eingang-notiz','Materialnotiz');
      await p.click('#ak-eingang-zuordnen');
    }
    await p.evaluate(() => { window.__akSet = Storage.prototype.setItem; Storage.prototype.setItem = function(k,v) { if(k === PROFIL_KEY) throw Error('quota'); return window.__akSet.call(this,k,v); }; });
    await zuordnen();
    await p.waitForFunction(() => !AK_EINGANG.arbeit);
    assert.equal(await p.evaluate(() => PROFIL.recherche.fassungen.length),0);
    assert.equal(await p.evaluate(async k => !!(await RIDB.get(k)), key),true);
    await p.evaluate(() => { Storage.prototype.setItem = window.__akSet; });
    await zuordnen();
    await p.waitForFunction(() => PROFIL.recherche.fassungen.length === 1 && !AK_EINGANG.arbeit);
    const r = await p.evaluate(async () => {
      const R = PROFIL.recherche, f = R.fassungen[0];
      return {key:f.anhang, blobs:await RIDB.schluessel(), fall:R.faelle[0].titel, dossier:R.beobachtungen[0].dossiers[0], fund:R.beobachtungen[0].fundstelle.wert, notiz:R.quellen[0].notiz, eingang:akEingangLesen().length, hash:await rchHash(await RIDB.get(f.anhang)), gespeichert:f.hash};
    });
    assert.equal(r.key,key); assert.deepEqual(r.blobs,[key]);
    assert.deepEqual([r.fall,r.dossier,r.fund,r.notiz,r.eingang],['Ablagetest','P-0004','2','Materialnotiz',0]);
    assert.ok(r.hash && r.hash === r.gespeichert);
    const paket = await p.evaluate(async () => JSON.parse((await rchPaketBauen(PROFIL.recherche.faelle[0].id)).text));
    assert.equal(paket.manifest.dateien[0].sha256, r.hash);
    assert.equal(paket.manifest.dateien[0].status, 'ok');
    assert.deepEqual(Buffer.from(paket.dateien[key], 'base64'), datei.buffer);
    await p.locator('#ak-eingang-datei').setInputFiles({
      name:'bild.png', mimeType:'image/png',
      buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+nt1cAAAAASUVORK5CYII=', 'base64')
    });
    await p.waitForFunction(() => document.querySelector('#ak-eingang-vorschau img')?.naturalWidth === 1);
    const lang = 'Screenshot 2025-02-16 222343 ' + 'LangerDateiname'.repeat(10) + '.txt';
    await p.locator('#ak-eingang-datei').setInputFiles({ ...datei, name: lang });
    const zeile = p.locator('#ak-eingang-wahl-0');
    await zeile.getByText(lang, {exact:true}).waitFor();
    assert.equal(await zeile.getAttribute('title'), lang);
    await p.evaluate(async () => { if (document.fullscreenElement) await document.exitFullscreen(); });
    for (const width of [1500, 760, 390]) {
      await p.setViewportSize({width, height:900});
      const layout = await zeile.evaluate(el => {
        const name = el.firstElementChild, list = el.closest('ul');
        const b = el.getBoundingClientRect(), n = name.getBoundingClientRect();
        return { zeile:b.height, name:n.width, anteil:n.width/b.width, scrollt:list.scrollWidth > list.clientWidth, umbruch:getComputedStyle(name).whiteSpace };
      });
      assert.ok(layout.zeile <= 45 && layout.name > 100 && layout.anteil > .8 && !layout.scrollt && layout.umbruch === 'nowrap', JSON.stringify({width, ...layout}));
    }
    await p.locator('#ak-eingang-wahl-1').click();
    await p.waitForFunction(() => document.querySelector('#ak-eingang-vorschau img')?.naturalWidth === 1);
    assert.equal(await p.locator('#ak-eingang-wahl-1').getAttribute('aria-current'), 'true');
    const auswahl = await p.evaluate(() => akEingangLesen().find(x => x.dateiname === 'bild.png'));
    await p.click('#ak-eingang-loeschen');
    await p.click('#dlg-cancel');
    assert.equal(await p.evaluate(async k => !!(await RIDB.get(k)), auswahl.anhang), true);
    await p.evaluate(() => { window.__akDel = RIDB.del; RIDB.del = () => Promise.reject(Error('nicht löschbar')); });
    await p.click('#ak-eingang-loeschen');
    await p.click('#dlg-ok');
    await p.waitForFunction(() => !AK_EINGANG.arbeit);
    assert.equal(await p.evaluate(k => akEingangLesen().some(x => x.anhang === k), auswahl.anhang), true);
    await p.evaluate(() => { RIDB.del = window.__akDel; });
    // Ein inzwischen zugeordneter Anhang ist auch über einen alten Eintrag nicht löschbar.
    await p.evaluate(k => akEingangLoeschen({anhang:k}), key);
    assert.equal(await p.evaluate(async k => !!(await RIDB.get(k)), key), true);
    await p.click('#ak-eingang-loeschen');
    await p.click('#dlg-ok');
    await p.waitForFunction(() => !AK_EINGANG.arbeit && !akEingangLesen().some(x => x.dateiname === 'bild.png'));
    assert.equal(await p.evaluate(async k => !!(await RIDB.get(k)), auswahl.anhang), false);
    await start();
    assert.equal(await p.locator('.ak-eingang-liste li').count(), 1);
    await p.click('#ak-eingang-loeschen');
    await p.click('#dlg-ok');
    await p.getByText('Noch keine Dateien abgelegt.').waitFor();
    assert.deepEqual(await p.evaluate(() => RIDB.schluessel()), [key]);
    await p.click('#ak-tab-registratur'); await p.locator('#ak-suche').waitFor();
    assert.deepEqual(errors,[]);
    console.log('OK: Eingang, Textvorschau, Neustart, Speicherrücknahme, Zuordnung ohne Kopie Löschen, Abbrechen, Fehlerrücknahme und Registratur');
  } finally { await b.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
