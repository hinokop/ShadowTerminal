/* F1 sichert, F2 lädt den Arbeitsstand: funktioniert auch beim Schreiben, nicht in gesperrter Sitzung und nicht bei offenem Dialog;
   die Schaltflächen bleiben. Exit-Code 1 bei Fehlschlag. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { APP } = require('./_pfad');
(async () => {
  const browser = await chromium.launch();
  try {
    const p = await browser.newPage({ viewport: { width: 1500, height: 1000 }, reducedMotion: 'reduce' });
    const fehler = []; p.on('pageerror', e => fehler.push(e.message));
    await p.route(/^https?:/, r => r.abort());
    await p.goto(APP); await p.fill('#gate-pw', 'pw-test-123'); if (await p.isVisible('#gate-pw2')) await p.fill('#gate-pw2', 'pw-test-123'); await p.click('#gate-go');
    await p.waitForFunction(() => !document.body.classList.contains('locked'));
    await p.evaluate(() => {                                                       /* Aufrufe zählen, Standardverhalten beobachten */
      window.__n = { s: 0, w: 0 }; window.__prevented = {};
      const s = asSpeichern, w = asWiederherstellen;
      asSpeichern = function () { window.__n.s++; return s(); }; asWiederherstellen = function () { window.__n.w++; return w(); };
      document.addEventListener('keydown', ev => { if (/^F[12]$/.test(ev.key)) window.__prevented[ev.key] = ev.defaultPrevented; });
      PROFIL.recherche.faelle = []; const f = xAnlegen({ titel: 'Tastenfall' }); profilSpeichern(); xOeffnen(f.id);
    });
    assert.equal(await p.locator('#as-speichern').count(), 1, 'Schaltflächen bleiben erhalten');
    /* F2 ohne Stand: nichts geladen, Meldung */
    await p.keyboard.press('F2');
    assert.equal(await p.evaluate(() => window.__n.w), 0, 'ohne Stand wird nicht geladen');
    assert.ok((await p.locator('#sys-msg').innerText()).includes('Kein Arbeitsstand'), 'Meldung ohne Stand');
    /* F1 sichert, auch während im Textfeld geschrieben wird */
    await p.click('#x-kurzlage'); await p.keyboard.type('Entwurf');
    await p.keyboard.press('F1');
    assert.equal(await p.evaluate(() => window.__n.s), 1, 'F1 sichert');
    assert.equal(await p.evaluate(() => window.__prevented.F1), true, 'F1 unterdrückt die Browserhilfe');
    assert.equal(await p.innerText('#x-kurzlage'), 'Entwurf', 'Texteingabe unberührt');
    const t1 = await p.evaluate(() => PROFIL.arbeitsstand.modul); assert.equal(t1, 'x');
    assert.equal(await p.locator('#as-wieder').isDisabled(), false, 'Stand laden danach wählbar');
    /* F2 lädt */
    await p.evaluate(() => dispatch({ type: 'NAVIGATION', modul: 'karte' }));
    await p.keyboard.press('F2');
    assert.equal(await p.evaluate(() => window.__n.w), 1, 'F2 lädt');
    assert.equal(await p.evaluate(() => window.__prevented.F2), true);
    assert.equal(await p.evaluate(() => STATE.ui.modul), 'x', 'Stand wiederhergestellt');
    /* Wiederholung durch gehaltene Taste löst nicht mehrfach aus */
    await p.evaluate(() => { window.dispatchEvent(new Event('x')); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'F1', repeat: true, bubbles: true, cancelable: true })); });
    assert.equal(await p.evaluate(() => window.__n.s), 1, 'Tastenwiederholung ignoriert');
    /* Umschalt, Strg, Alt: keine Auslösung */
    await p.keyboard.press('Control+F1'); await p.keyboard.press('Shift+F1'); await p.keyboard.press('Alt+F2');
    assert.deepEqual(await p.evaluate(() => window.__n), { s: 1, w: 1 }, 'Kombinationen lösen nichts aus');
    /* offener Dialog: nichts */
    await p.evaluate(() => bestaetigen('Test', 'Dialog offen', 'OK', function () {}));
    await p.keyboard.press('F1'); await p.keyboard.press('F2');
    assert.deepEqual(await p.evaluate(() => window.__n), { s: 1, w: 1 }, 'bei offenem Dialog nichts ausgelöst');
    await p.keyboard.press('Escape');
    await p.waitForFunction(() => !document.getElementById('dlg').open);
    /* gesperrte Sitzung: nichts */
    await p.evaluate(() => Zugang.sperren('Test'));
    await p.waitForFunction(() => document.body.classList.contains('locked'));
    await p.keyboard.press('F1'); await p.keyboard.press('F2');
    assert.deepEqual(await p.evaluate(() => window.__n), { s: 1, w: 1 }, 'in gesperrter Sitzung nichts ausgelöst');
    assert.deepEqual(fehler, []);
    console.log('OK: F1/F2 für den Arbeitsstand');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
