/* Phase 5b3: Nach Altprofil-/Missionsstatus darf die produktive Dossieransicht
   weder Rudiment, Freigabeformular noch Kontaktmaske zeigen.
   Die manuelle Sperre behält Vorrang, alle drei Dossiertabs bleiben zugänglich. */
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

    const ids = await p.evaluate(() => {
      STATE.missionsbetrieb = true;  /* gespeichertes Altfeld; seit 5b7 ohne Wirkung */
      const known = SCENARIO.standard.dossiers.find(e => e.typ === 'Person');
      if (!known) return null;
      IZ()[known.id] = { status: 'bekannt' };
      const unknown = SCENARIO.standard.dossiers.find(e => e.typ === 'Person' && e.id !== known.id && !IZ()[e.id]);
      const unaccepted = SCENARIO.entitaeten.find(e => e.typ === 'Person' && e.mission !== 'STD' && !freigeschaltet(e.mission));
      if (!unknown || !unaccepted) return null;
      return { known: known.id, unknown: unknown.id, unaccepted: unaccepted.id,
        knownW: wissen(known), knownInfo: infoGesperrt(known),
        unknownW: wissen(unknown), unknownInfo: infoGesperrt(unknown),
        unacceptedW: wissen(unaccepted), unacceptedOffen: dossierOffen(unaccepted.mission) };
    });
    assert.ok(ids, 'historisch bekanntes, unbekanntes und nicht freigeschaltetes Dossier verfügbar');
    assert.deepEqual([ids.knownW, ids.knownInfo, ids.unknownW, ids.unknownInfo, ids.unacceptedW, ids.unacceptedOffen],
      ['frei', false, 'frei', false, 'frei', true],
      'Phase 5b7: gespeicherte alte Wissens-/Missionsfreigabezustände ohne Wirkung');

    const oeffnen = id => p.evaluate(i => {
      STATE.dossiers.auswahl = i;
      VIEW.dtab = 'info';
      dispatch({ type: 'NAVIGATION', modul: 'dossier' });
      renderModule();
    }, id);
    const sicht = () => p.evaluate(() => {
      const split = document.querySelector('.split'), seite = split ? split.innerText : '';
      return {
        tabs: ['info', 'sichtungen', 'chronik'].every(n => !!document.getElementById('dtab-' + n)),
        status: !!document.getElementById('sel-dstatus'),
        edit: !!document.getElementById('btn-dbearb'),
        kurzlage: !!document.getElementById('kl-bearbeiten'),
        recherche: !!document.getElementById('rch-dossier-unterlagen'),
        graph: !!document.querySelector('.split svg[aria-label^="Beziehungsansicht um"]'),
        legacy: !!document.getElementById('btn-einreichen') || !!document.getElementById('btn-eq')
          || /Rudiment|Zugriff beschränkt|Freigabe beantragen über Modul 4/.test(seite),
        lock: !!document.getElementById('dg-pw')
      };
    });

    await oeffnen(ids.known);
    let v = await sicht();
    assert.ok(v.tabs && v.status && v.edit && v.kurzlage && v.recherche && v.graph && !v.legacy && !v.lock,
      'vollständige Dossierübersicht trotz historischer Teilfreigabe: ' + JSON.stringify(v));
    await p.locator('#dtab-sichtungen').click();
    assert.ok(await p.evaluate(() => !!document.getElementById('btn-si') &&
      !!document.querySelector('#dtab-sichtungen[aria-selected="true"]')), 'Sichtungen-Tab nutzbar');
    await p.locator('#dtab-chronik').click();
    assert.ok(await p.evaluate(() => !!document.querySelector('#dtab-chronik[aria-selected="true"]')),
      'Chronik-Tab nutzbar');

    await oeffnen(ids.unknown);
    v = await sicht();
    assert.ok(v.tabs && v.status && v.edit && v.kurzlage && v.recherche && v.graph && !v.legacy && !v.lock,
      'vollständige Dossierübersicht trotz historisch unbekanntem Standarddossier: ' + JSON.stringify(v));
    await oeffnen(ids.unaccepted);
    v = await sicht();
    assert.ok(v.tabs && v.status && v.edit && v.kurzlage && v.recherche && v.graph && !v.legacy && !v.lock,
      'vollständige Dossierübersicht trotz nicht angenommener Altmission: ' + JSON.stringify(v));

    await p.evaluate(i => dispatch({ type: 'DOSSIER_SPERREN', id: i }), ids.known);
    await oeffnen(ids.known);
    v = await sicht();
    assert.ok(v.lock && !v.tabs && !v.edit && !v.recherche && !v.graph,
      'manuelle Dossiersperre weiterhin vorrangig: ' + JSON.stringify(v));
    await p.evaluate(i => dispatch({ type: 'DOSSIER_ENTSPERREN', id: i }), ids.known);
    await oeffnen(ids.known);
    v = await sicht();
    assert.ok(v.tabs && v.edit && !v.lock && !v.legacy,
      'manuelles Entsperren stellt vollständige Rechercheoberfläche wieder her');
    assert.deepEqual(errors, [], 'keine Browserfehler');
    console.log('OK: Phase 5b3 – kein Freigabe-/Rudimentpanel, vollständige Tabs, manuelle Sperre');
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
