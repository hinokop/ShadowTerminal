const assert = require('node:assert/strict');
const PF = require('./_pfad.js');
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  try {
    const p = await b.newPage(), errors = [];
    p.on('pageerror', e => errors.push(e.message));
    await p.route(/^https?:/, r => r.abort());
    async function starten() {
      await p.locator('#gate-pw').fill('pw-test-123');
      if (await p.locator('#gate-pw2').isVisible()) await p.locator('#gate-pw2').fill('pw-test-123');
      await p.click('#gate-go');
      await p.waitForFunction(() => !document.body.classList.contains('locked'));
    }
    await p.goto(PF.APP); await starten();
    const id = await p.evaluate(() => {
      dispatch({ type:'DOSSIER_ANGELEGT', typ:'Person', name:'Vorlage', land:'DE' });
      const id = STATE.dossiers.eigene.find(e => e.name === 'Vorlage').id;
      dispatch({ type:'DOSSIER_ORT', id, ll:[52,13] });
      dispatch({ type:'PIN_ANGELEGT', dossier:id, ll:[52,13] });
      dispatch({ type:'OZONE_ANGELEGT', ll:[52,13] });
      dispatch({ type:'SICHTUNG_HINZU', id, ort:'52, 13', text:'Test' });
      dispatch({ type:'RECHERCHE_BELEG', dossier:id, neuerFall:{titel:'Vorlage'}, art:'Text', fassung:{anhang:false}, zitat:'Bleibt' });
      return id;
    });
    const ergebnis = () => p.evaluate(id => {
      const d = STATE.dossiers.entitaeten[id];
      return { dossier:!!d, sichtungen:(d.sichtungen || []).length, position:karteKoord(id), pins:PROFIL.pins.length, zonen:PROFIL.zonen.length,
        map:karte3dDaten().marker.length, unterlagen:PROFIL.recherche.beobachtungen.length, zaehler:PROFIL.seq.pin };
    }, id);
    await p.click('#btn-karte-bereinigen');
    assert.equal(await p.locator('#dlg-ok').isEnabled(), false);
    await p.click('#dlg-cancel');
    assert.equal((await ergebnis()).pins,1);
    await p.click('#btn-karte-bereinigen');
    await p.check('#dlg-pflicht');
    await p.click('#dlg-ok');
    const leer = { dossier:true, sichtungen:0, position:null, pins:0, zonen:0, map:0, unterlagen:1, zaehler:1 };
    assert.deepEqual(await ergebnis(),leer);
    await p.reload(); await starten();
    assert.deepEqual(await ergebnis(),leer);
    await p.evaluate(id => dispatch({ type:'DOSSIER_ORT', id, ll:[51,7] }), id);
    assert.deepEqual((await ergebnis()).position,[51,7]);
    assert.equal(await p.evaluate(id => karte3dDaten().marker.some(m => m.id === id), id), true);
    await p.keyboard.press('3');
    await p.evaluate(id => karteWaehlen(id,true), id);
    await p.locator('#k-auswahl').waitFor({ state:'visible' });
    assert.equal(await p.locator('#k-pop-messen').count(),1);
    assert.equal(await p.locator('#k-pop-frage').count(),0);
    assert.deepEqual(errors,[]);
    console.log('OK: Bestätigung, leere Karte nach Neustart, Vorlagen und Unterlagen erhalten, neue Platzierung möglich');
  } finally { await b.close(); }
})().catch(e => { console.error(e); process.exitCode=1; });
