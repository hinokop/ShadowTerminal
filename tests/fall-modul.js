const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { APP } = require('./_pfad');

(async () => {
  const browser = await chromium.launch();
  try {
    const p = await browser.newPage({ reducedMotion: 'reduce' }), errors = [];
    p.setDefaultTimeout(15000);
    p.on('pageerror', e => errors.push(e.message));
    await p.route(/^https?:/, r => r.abort());
    async function start() {
      await p.goto(APP);
      await p.fill('#gate-pw', 'pw-test-123');
      if (await p.isVisible('#gate-pw2')) await p.fill('#gate-pw2', 'pw-test-123');
      await p.click('#gate-go');
      await p.waitForFunction(() => !document.querySelector('#gate-seq').hidden || !document.body.classList.contains('locked'));
      await p.keyboard.press('Space');
      await p.locator('#nav-x').waitFor();
    }
    await start();
    await p.click('#nav-dossier');
    await p.click('#x-dossier-fall');
    await p.fill('#x-dialog-titel', 'Testfall X');
    await p.click('#dlg-ok');
    assert.equal(await p.locator('#mod-title').innerText(), 'X');
    const id = await p.evaluate(() => PROFIL.recherche.faelle[0].id);
    const dossier = await p.evaluate(() => PROFIL.recherche.faelle[0].dossiers[0]);
    assert.ok(dossier);
    assert.equal(await p.inputValue('#x-status'), 'sammlung');
    assert.equal(await p.inputValue('#x-bewertung'), 'unbewertet');
    await p.evaluate(d => {
      dispatch({ type: 'PIN_ANGELEGT', name: 'Vorhandener Pin', ll: [50, 8] });
      dispatch({ type: 'RECHERCHE_BELEG', dossier: d, neuerFall: { titel: 'Bestand' }, fassung: {}, zitat: 'Bestand', art: 'Text' });
      const f = PROFIL.recherche.faelle.at(-1);
      f.zustand = 'ruhend'; profilSpeichern(); renderModule();
    }, dossier);
    const bestand = await p.evaluate(() => PROFIL.recherche.faelle.at(-1).id);
    const vorPin = await p.evaluate(() => PROFIL.pins[0].id);
    assert.match(await p.locator('#x-fall-' + bestand).innerText(), /On hold/);
    await p.selectOption('#x-pin-wahl', vorPin);
    await p.click('#x-pin-hinzu');
    await p.click('#x-pin-loesen-' + vorPin);
    assert.ok(await p.evaluate(pin => PROFIL.pins.some(p => p.id === pin), vorPin));
    await p.evaluate(pin => dispatch({ type: 'PIN_ENTFERNT', id: pin }), vorPin);
    await p.click('#x-fall-' + bestand);
    await p.click('#x-loeschen');
    await p.check('#dlg-pflicht');
    await p.click('#dlg-ok');
    assert.equal(await p.locator('#x-fall-' + bestand).count(), 0);
    await p.fill('#x-kurzlage', 'Erste Arbeitsthese');
    await p.selectOption('#x-status', 'on-hold');
    await p.selectOption('#x-bewertung', 'vorlaeufig');
    await p.fill('#x-begruendung', 'Die Unterlage ist noch nicht geprüft.');
    await p.click('#nav-akten');
    await p.click('#nav-x');
    assert.equal(await p.inputValue('#x-kurzlage'), 'Erste Arbeitsthese');
    await p.click('#x-speichern');
    await p.click('#x-pin-neu');
    assert.match(await p.locator('.k-pickbar').innerText(), /Testfall X/);
    await p.locator('#k-svg').click({ position: { x: 390, y: 230 } });
    assert.equal(await p.locator('#mod-title').innerText(), 'X');
    const pin = await p.evaluate(() => PROFIL.recherche.faelle[0].pins[0]);
    assert.ok(pin);
    await p.click('#x-pin-offen-' + pin);
    assert.equal(await p.evaluate(() => VIEW.karte.auswahl), pin);
    await p.click('#nav-akten');
    await p.click('#ak-tab-eingang');
    await p.locator('#ak-eingang-datei').setInputFiles({ name: 'x-unterlage.txt', mimeType: 'text/plain', buffer: Buffer.from('Fallnotiz') });
    await p.locator('#ak-eingang-vorschau pre').waitFor();
    await p.selectOption('#ak-eingang-fall', id);
    await p.selectOption('#ak-eingang-dossier', dossier);
    await p.click('#ak-eingang-zuordnen');
    await p.waitForFunction(() => PROFIL.recherche.beobachtungen.length === 1 && !AK_EINGANG.arbeit);
    const b = await p.evaluate(() => PROFIL.recherche.beobachtungen[0].id);
    await p.click('#nav-x');
    await p.click('#x-vorschau-' + b);
    assert.equal(await p.locator('#x-vorschau pre').innerText(), 'Fallnotiz');
    await p.click('#x-unterlage-' + b + '-' + dossier);
    await p.locator('#rch-u-' + b).waitFor();
    assert.ok(await p.locator('#rch-dossier-unterlagen').evaluate(x => x.open));
    await start();
    await p.click('#nav-x');
    assert.equal(await p.inputValue('#x-status'), 'on-hold');
    assert.equal(await p.inputValue('#x-bewertung'), 'vorlaeufig');
    assert.equal(await p.inputValue('#x-begruendung'), 'Die Unterlage ist noch nicht geprüft.');
    assert.equal(await p.inputValue('#x-kurzlage'), 'Erste Arbeitsthese');
    const paket = await p.evaluate(async id => JSON.parse((await rchPaketBauen(id)).text), id);
    assert.equal(paket.inhalt.fall.dossiers[0], dossier);
    assert.equal(paket.inhalt.fall.pins, undefined);
    assert.equal(paket.inhalt.fall.zustand, 'on-hold');
    const keys = await p.evaluate(({ id, b, pin }) => {
      const R = PROFIL.recherche, key = R.fassungen[0].anhang;
      const anderer = xAnlegen({ titel: 'Zweiter Fall' });
      anderer.pins = [pin];
      dispatch({ type: 'RECHERCHE_BELEG', dossier: R.faelle[0].dossiers[0], fall: anderer.id, fassung: { anhang: key, dateiname: 'geteilt.txt' }, art: 'Datei' });
      dispatch({ type: 'RECHERCHE_BELEG', dossier: R.faelle[0].dossiers[0], fall: id, fassung: { anhang: 'x-einzigartig', dateiname: 'einzig.txt' }, art: 'Datei' });
      PROFIL.zonen.push({ id: 'ZO-001', unterlagen: [b, R.beobachtungen[1].id] });
      profilSpeichern();
      return [key, anderer.id];
    }, { id, b, pin });
    await p.evaluate(() => RIDB.put('x-einzigartig', new Blob(['Einzigartig'])));
    await p.click('#x-loeschen');
    assert.ok(await p.locator('#dlg-ok').isDisabled());
    await p.click('#dlg-cancel');
    assert.ok(await p.evaluate(id => !!xFall(id), id));
    await p.evaluate(() => {
      window.altesSet = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k, v) {
        if (k === PROFIL_KEY) throw Error('quota');
        return window.altesSet.call(this, k, v);
      };
    });
    async function loeschen() {
      await p.click('#x-loeschen');
      await p.check('#dlg-pflicht');
      await p.click('#dlg-ok');
    }
    await loeschen();
    assert.deepEqual(await p.evaluate(id => [!!xFall(id), PROFIL.recherche.beobachtungen.length, PROFIL.zonen[0].unterlagen.length], id), [true, 3, 2]);
    await p.evaluate(() => { Storage.prototype.setItem = window.altesSet; });
    await loeschen();
    await p.waitForFunction(() => document.querySelector('#sys-msg').textContent.includes('gelöscht'));
    assert.deepEqual(await p.evaluate(async ({ id, pin, dossier, keys }) => [
      !!xFall(id), xFall(keys[1]).pins[0], PROFIL.pins[0].id, !!entitaet(dossier), PROFIL.recherche.beobachtungen.length,
      PROFIL.zonen[0].unterlagen.length, !!(await RIDB.get(keys[0])), !!(await RIDB.get('x-einzigartig'))
    ], { id, pin, dossier, keys }), [false, pin, pin, true, 1, 1, true, false]);
    await p.evaluate(pin => dispatch({ type: 'PIN_ENTFERNT', id: pin }), pin);
    assert.deepEqual(await p.evaluate(id => xFall(id).pins, keys[1]), []);
    await start();
    await p.click('#nav-x');
    assert.equal(await p.locator('#x-fall-' + id).count(), 0);
    assert.equal(await p.locator('#x-fall-' + keys[1]).count(), 1);
    await p.evaluate(dossier => {
      dispatch({ type: 'PIN_ANGELEGT', name: 'Lokaler Kollisionspin', ll: [51, 8] });
      const kollidiert = PROFIL.pins[0].id;
      const eingang = { v: 1, eigene: [], eigeneKanten: [], pins: [{ id: kollidiert, name: 'Importierter Pin', ll: [40, 9] }],
        recherche: { faelle: [{ id: 'F-080', titel: 'Importierter Fall', dossiers: [dossier], pins: [kollidiert] }] } };
      for (let n = 0; n < 2; n++) dispatch({ type: 'PROFIL_IMPORT', profil: JSON.parse(JSON.stringify(eingang)), datei: 'Testprofil' });
    }, dossier);
    assert.deepEqual(await p.evaluate(dossier => {
      const faelle = PROFIL.recherche.faelle.filter(f => f.titel === 'Importierter Fall');
      const p = PROFIL.pins.find(x => x.name.startsWith('Importierter Pin'));
      return [faelle.length, faelle[0].dossiers[0], faelle[0].pins[0], p.id, PROFIL.pins.length, dossier];
    }, dossier).then(([n,d,fp,p,np,erw]) => [n,d === erw,fp === p,np]), [1,true,true,2]);
    assert.deepEqual(errors, []);
    console.log('OK: X, Fallstatus, Bewertung, Karte, Unterlagen, Löschbestätigung, Rücknahme, geteilte Dateien und Reload');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
