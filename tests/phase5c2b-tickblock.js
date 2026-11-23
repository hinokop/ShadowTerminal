/* Phase 5c2b (a): Entfernung des stillgelegten Ereignisblocks in tickModule (data-melde, data-vk, data-fenster) und der danach
   funktionslosen Helfer meldeText, meldungLiegtVor, VK, vkStatus, fensterZelle sowie widerspruchOffen.
   Belegt wird:
   (1) die entfernten Funktionen sind nicht mehr vorhanden, die ausdrücklich ausgenommenen (ALT, LM, KM, MS, missionDef,
       einsatzLaeuft, einsatzBeginn) bleiben;
   (2) tickModule fasst Elemente mit den früheren Attributen nicht mehr an (vorher: Textersetzung bzw. Fehler) und läuft über mehrere
       Sekunden ohne Seitenfehler;
   (3) ein Zustand mit Altbestand (Aussagen, Widerspruch, Berichte, Einschätzung, Verstärkung, Zeitfenster) bleibt im Speicher und im
       gespeicherten Zustand unverändert, auch nach Neuladen;
   (4) Karte (2D-Zeichenfläche) und Diagnoseterminal arbeiten weiter.
   Exit-Code 1 bei Fehlschlag. */
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { APP } = require('./_pfad');
const FIX = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'altprofil-mission.json'), 'utf8'));

function eingang() {
  const s = JSON.parse(JSON.stringify(FIX.state)), t = '2026-11-15T05:00:00.000Z', jetzt = new Date().toISOString();
  s.aussagen = [{ id: 'AS-001', t, entitaet: 'P-0001', wert: true, text: 'alte Aussage zu P-0001', status: 'gilt' }];
  s.widerspruch = { t: jetzt, entitaet: 'P-0001' };
  s.berichte = [{ t: jetzt, text: 'Bericht zu P-0001', id: 'B-901' }];
  s.verstaerkung = [{ id: 'VK-001', urteil: 'genehmigt', grund: 'alter Eintrag', entscheidung: t, ankunft: t, ende: t }];
  s.infozugang = Object.assign({}, s.infozugang, { 'P-0001': { einschaetzung: { t: jetzt, quelle: 'B', text: 'alte Einschätzung' } } });
  return { state: JSON.stringify(s), profil: JSON.stringify(FIX.profil) };
}

async function anmeldenMit(p) {
  await p.fill('#gate-pw', 'pw-test-123');
  if (await p.isVisible('#gate-pw2')) await p.fill('#gate-pw2', 'pw-test-123');
  await p.click('#gate-go');
  await p.waitForFunction(() => !document.body.classList.contains('locked'));
}

(async () => {
  const browser = await chromium.launch();
  const fehler = [];
  try {
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 }, reducedMotion: 'reduce' });
    const p = await ctx.newPage();
    p.setDefaultTimeout(20000);
    p.on('pageerror', e => fehler.push(e.message));
    await p.route(/^https?:/, r => r.abort());
    await p.goto(APP);
    await p.evaluate(a => { localStorage.setItem(STORAGE_KEY, a.state); localStorage.setItem(PROFIL_KEY, a.profil); }, eingang());
    await p.goto(APP);
    await anmeldenMit(p);

    /* (1) entfernte und erhaltene Funktionen */
    const typen = await p.evaluate(() => {
      const t = {};
      ['meldeText', 'meldungLiegtVor', 'VK', 'vkStatus', 'fensterZelle', 'widerspruchOffen',
        'ALT', 'LM', 'KM', 'MS', 'missionDef', 'einsatzLaeuft', 'einsatzBeginn', 'tickModule'].forEach(n => { t[n] = typeof window[n]; });
      return t;
    });
    ['meldeText', 'meldungLiegtVor', 'VK', 'vkStatus', 'fensterZelle', 'widerspruchOffen'].forEach(n => assert.equal(typen[n], 'undefined', n + ' ist entfernt'));
    ['ALT', 'LM', 'KM', 'MS', 'missionDef', 'einsatzLaeuft', 'einsatzBeginn', 'tickModule'].forEach(n => assert.equal(typen[n], 'function', n + ' bleibt erhalten'));

    /* (3, Ausgangsstand) Altbestand vor allen weiteren Handlungen */
    const vor = await p.evaluate(() => JSON.parse(JSON.stringify(STATE.altbestand)));
    assert.equal(vor.aussagen.length, 1, 'Altbestand enthält die Aussage');
    assert.equal(vor.verstaerkung.length, 1, 'Altbestand enthält den Verstärkungseintrag');
    assert.equal(vor.widerspruch.entitaet, 'P-0001', 'Altbestand enthält den Widerspruch');

    /* (2) Fremde Elemente mit den früheren Attributen bleiben unberührt; tickModule und der laufende Takt erzeugen keinen Fehler */
    const tick = await p.evaluate(() => {
      const w = document.createElement('div');
      w.innerHTML = '<span id="t-melde" data-melde>M</span><span id="t-vk" data-vk="VK-001">V</span><span id="t-fenster" data-fenster="x">F</span>';
      document.body.appendChild(w);
      let wurf = null;
      try { tickModule(Date.now()); tickModule(Date.now() + 61000); } catch (e) { wurf = String(e && e.message || e); }
      const r = { wurf, melde: document.getElementById('t-melde').textContent, vk: document.getElementById('t-vk').textContent,
        fenster: document.getElementById('t-fenster').textContent, minute: document.getElementById('t-fenster').hasAttribute('data-min') };
      w.remove();
      return r;
    });
    assert.equal(tick.wurf, null, 'tickModule wirft nicht: ' + tick.wurf);
    assert.equal(tick.melde, 'M', 'data-melde wird nicht mehr beschrieben');
    assert.equal(tick.vk, 'V', 'data-vk wird nicht mehr beschrieben');
    assert.equal(tick.fenster, 'F', 'data-fenster wird nicht mehr beschrieben');
    assert.equal(tick.minute, false, 'data-min wird nicht mehr gesetzt');
    await p.waitForTimeout(3500);   /* mehrere echte Takte */
    assert.deepEqual(fehler, [], 'keine Seitenfehler während des Takts: ' + fehler.join(' | '));

    /* (4) Karte und Terminal */
    await p.evaluate(() => { dispatch({ type: 'NAVIGATION', modul: 'karte' }); VIEW.karte.reiter = 'karte'; renderModule(); });
    await p.waitForSelector('#k-svg');
    assert.equal(await p.evaluate(() => Array.isArray(karteMarker())), true, 'Kartenmarker abrufbar');
    await p.evaluate(() => { dispatch({ type: 'NAVIGATION', modul: 'profil' }); renderModule(); });
    await p.locator('#profil-terminal-oeffnen').click();
    const eing = p.locator('#profil-terminal-eingabe');
    await eing.fill('whoami'); await eing.press('Enter');
    await p.waitForFunction(() => /raizo/.test(document.getElementById('profil-terminal-ausgabe').textContent));

    /* (3) Altbestand unverändert, im Speicher und gespeichert, auch nach Neuladen */
    const nach = await p.evaluate(() => ({ mem: JSON.parse(JSON.stringify(STATE.altbestand)), disk: JSON.parse(localStorage.getItem(STORAGE_KEY)).altbestand }));
    assert.deepEqual(nach.mem, vor, 'Altbestand im Speicher unverändert');
    assert.deepEqual(nach.disk, vor, 'Altbestand gespeichert unverändert');
    await p.reload();
    await anmeldenMit(p);
    const neu = await p.evaluate(() => ({ v: STATE.version, mem: JSON.parse(JSON.stringify(STATE.altbestand)), disk: JSON.parse(localStorage.getItem(STORAGE_KEY)).altbestand }));
    assert.equal(neu.v, 5, 'nach Neuladen weiterhin Format 5');
    assert.deepEqual(neu.mem, vor, 'Altbestand nach Neuladen im Speicher unverändert');
    assert.deepEqual(neu.disk, vor, 'Altbestand nach Neuladen gespeichert unverändert');
    assert.deepEqual(fehler, [], 'keine Seitenfehler: ' + fehler.join(' | '));
    console.log('Phase 5c2b (a): ALLE OK');
  } catch (e) {
    console.log('FEHLER: ' + (e && e.message || e));
    process.exitCode = 1;
  } finally { await browser.close(); }
})();
