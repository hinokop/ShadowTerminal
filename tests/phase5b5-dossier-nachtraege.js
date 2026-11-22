/* Phase 5b5: Der produktive Dossier-Renderer zeigt keine historischen
   missionsgebundenen Nachträge mehr, auch wenn eine alte Mission als
   angenommen gespeichert oder im Browser aktiviert ist. Die Nachtragsdaten
   dürfen weder verändert noch gelöscht werden. Manuelle Sperren bleiben. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { APP } = require('./_pfad');

(async () => {
  const browser = await chromium.launch();
  try {
    const p = await browser.newPage({ viewport: { width: 1500, height: 1000 }, reducedMotion: 'reduce' });
    p.setDefaultTimeout(20000);
    const errors = [];
    p.on('pageerror', e => errors.push(e.message));
    await p.route(/^https?:/, r => r.abort());
    await p.goto(APP);
    await p.fill('#gate-pw', 'pw-test-123');
    if (await p.isVisible('#gate-pw2')) await p.fill('#gate-pw2', 'pw-test-123');
    await p.click('#gate-go');
    await p.waitForFunction(() => !document.body.classList.contains('locked'));

    const fixture = await p.evaluate(() => {
      const e = SCENARIO.standard.dossiers.find(x =>
        (x.nachtraege || []).some(n => n.mission === 'M1' && n.rolle));
      if (!e || !STATE.missionen.M1) return null;
      const nachtrag = e.nachtraege.find(n => n.mission === 'M1');
      const original = JSON.stringify(nachtrag);
      STATE.missionsbetrieb = true;
      STATE.automatik = false;
      STATE.missionen.M1.angenommenAm = nowIso();
      STATE.dossiers.auswahl = e.id;
      VIEW.dtab = 'info';
      dispatch({ type: 'NAVIGATION', modul: 'dossier' });
      renderModule();
      const text = document.querySelector('main').innerText;
      return {
        id: e.id,
        missionAktiv: missionsbetrieb() && freigeschaltet('M1'),
        legacyLabel: text.includes('Nachtrag M1'),
        legacyRolle: text.includes(nachtrag.rolle),
        legacyEckdaten: (nachtrag.eckdaten || []).some(d => d && text.includes(d)),
        stammdaten: text.includes(e.rolle),
        regulareAnsicht: !!document.querySelector('#btn-dbearb') &&
          !!document.querySelector('#dtab-sichtungen'),
        unveraendert: JSON.stringify(nachtrag) === original,
        original
      };
    });
    assert.ok(fixture, 'Standarddossier mit gespeichertem M1-Nachtrag und Altmissionszustand vorhanden');
    assert.equal(fixture.missionAktiv, true, 'historische Freischaltung tatsächlich aktiv');
    assert.equal(fixture.regulareAnsicht && fixture.stammdaten, true,
      'reguläre Rechercheansicht mit ursprünglichen Stammdaten bleibt sichtbar');
    assert.equal(fixture.legacyLabel || fixture.legacyRolle || fixture.legacyEckdaten, false,
      'Missionsnachtrag erscheint in der produktiven Dossieransicht nicht');
    assert.equal(fixture.unveraendert, true, 'gespeicherte Alt-Nachtragsdaten bleiben unverändert');

    await p.evaluate(id => dispatch({ type: 'DOSSIER_SPERREN', id }), fixture.id);
    const gesperrt = await p.evaluate(() => ({
      maske: !!document.querySelector('#dg-pw'),
      bearbeiten: !!document.querySelector('#btn-dbearb'),
      texte: document.querySelector('main').innerText
    }));
    assert.equal(gesperrt.maske && !gesperrt.bearbeiten, true,
      'manuelle Sperre blockiert weiterhin die reguläre Dossieransicht');
    assert.equal(gesperrt.texte.includes('Nachtrag M1'), false);

    await p.evaluate(id => dispatch({ type: 'DOSSIER_ENTSPERREN', id }), fixture.id);
    const frei = await p.evaluate(id => {
      const e = entitaet(id), n = (e.nachtraege || []).find(x => x.mission === 'M1');
      return {
        ansicht: !!document.querySelector('#btn-dbearb'),
        text: document.querySelector('main').innerText,
        nachtrag: JSON.stringify(n)
      };
    }, fixture.id);
    assert.equal(frei.ansicht, true, 'Entsperren stellt Rechercheansicht wieder her');
    assert.equal(frei.text.includes('Nachtrag M1'), false,
      'historischer Missionsnachtrag bleibt nach Entsperren verborgen');
    assert.equal(frei.nachtrag, fixture.original,
      'Alt-Nachtragsdaten über Sperren und Entsperren hinweg erhalten');
    assert.deepEqual(errors, [], 'keine Browserfehler');
    console.log('OK: Phase 5b5 – keine Missionsnachträge in produktiver Dossieransicht; Stammdaten, Altbestand und Sperren erhalten');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
