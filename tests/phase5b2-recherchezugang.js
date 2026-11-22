/* Phase 5b2: Dossier-/Kartenrecherche darf von altem Missions- und Ansprechpartnerstatus
   nicht eingeschränkt werden. Die manuelle Sperre bleibt für Marker, Graph und
   Schreiboperationen wirksam. Historische wissen()-Semantik bleibt bestehen. */
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

    const zuerst = await p.evaluate(() => {
      /* Eine historische Mission ohne freigegebene Entitäten als kontrollierter
         Rückwärtskompatibilitätsfall, ohne deren Timer anlaufen zu lassen. */
      STATE.missionsbetrieb = true;
      const alt = SCENARIO.standard.dossiers.find(e => e.typ === 'Person' && !e.eigen);
      const andereMission = SCENARIO.entitaeten.find(e => e.mission !== 'STD' && !dossierOffen(e.mission));
      if (!alt || !andereMission) return null;
      IZ()[alt.id] = { status: 'bekannt' };
      PROFIL.koord[alt.id] = [52.52, 13.405];
      PROFIL.koord[andereMission.id] = [52.523, 13.406];
      const d = STATE.dossiers.entitaeten[alt.id];
      d.sichtungen = d.sichtungen || [];
      d.sichtungen.push({ id: 'SI-900', uid: 'b2dossier5b2', t: nowIso(), ort: '52.5200, 13.4050',
        text: 'Recherche-Sichtung trotz altem Kenntnisstand', guete: 'unbewertet', quelle: 'Eintrag' });
      VIEW.karte.ebenen.personen = true;
      VIEW.karte.ebenen.sichtungen = true;
      const marker = karteMarker();
      const v = { alt: alt.id, zweite: andereMission.id,
        wissen: wissen(alt), info: infoGesperrt(alt), zweiteOffen: dossierOffen(andereMission.mission),
        altMarker: marker.some(m => m.id === alt.id && m.entitaet),
        zweiteMarker: marker.some(m => m.id === andereMission.id && m.entitaet),
        sichtung: marker.some(m => m.id === 'SI-900' && m.entId === alt.id),
        bezug: !!karteBezugVon(alt.id),
        inRecherche: dossierRechercheBestand().some(e => e.id === andereMission.id) };
      return v;
    });
    assert.ok(zuerst, 'Standard- und Missionsdossier vorhanden');
    assert.deepEqual([zuerst.wissen, zuerst.info, zuerst.zweiteOffen],
      ['bekannt', true, false], 'historische Wissens- und Missionsfreigabe bleiben unverändert');
    assert.ok(zuerst.altMarker && zuerst.zweiteMarker && zuerst.sichtung && zuerst.bezug && zuerst.inRecherche,
      'Kartenmarker, Sichtung und Lagebezug trotz alter Freigabe vorhanden: ' + JSON.stringify(zuerst));

    /* Dossieraktionen: ein zuvor nicht angenommenes Missionsdossier bleibt bearbeitbar. */
    const geschrieben = await p.evaluate(({ alt, zweite }) => {
      dispatch({ type: 'DOSSIER_BEARBEITET', id: zweite, name: entitaet(zweite).name + ' Recherche',
        rolle: entitaet(zweite).rolle, eckdaten: (entitaet(zweite).eckdaten || []).join('\n') });
      dispatch({ type: 'DOSSIER_KURZLAGE', id: zweite, inhalt: '<p>Recherchenotiz ohne Missionsfreigabe</p>' });
      const a = entitaet(alt), b = entitaet(zweite);
      dispatch({ type: 'VERBINDUNG_ANGELEGT', von: a.id, nach: b.id,
        typ: SCENARIO.verbindungstypen[0], bewertung: 'C3', beidseitig: false });
      return { name: entitaet(zweite).name,
        kurzlage: (STATE.dossiers.entitaeten[zweite] || {}).kurzlage || '',
        kante: dossierRechercheKanten().find(v => v.von === alt && v.nach === zweite)?.id || null,
        sichtbareKante: !!dossierRechercheKanten().find(v => v.von === alt && v.nach === zweite) };
    }, zuerst);
    assert.match(geschrieben.name, /Recherche$/, 'Missionsdossier bearbeitet');
    assert.match(geschrieben.kurzlage, /Recherchenotiz ohne Missionsfreigabe/);
    assert.ok(geschrieben.kante && geschrieben.sichtbareKante, 'Verbindung zwischen früher beschränkten Dossiers');

    /* Historisches Rudiment bleibt für Alt-Szenarioprüfungen erreichbar;
       die unabhängig freigegebenen Recherche- und Graph-Panels daneben ebenfalls. */
    const panel = await p.evaluate(({ alt }) => {
      STATE.dossiers.auswahl = alt;
      dispatch({ type: 'NAVIGATION', modul: 'dossier' });
      renderModule();
      const el = document.querySelector('.split');
      return { rudiment: !!document.querySelector('#btn-einreichen'),
        recherche: !!document.querySelector('#rch-dossier-unterlagen'),
        graph: !!el && !!el.querySelector('svg[aria-label^="Beziehungsansicht um"]') && !!el.querySelector('#dossier-verbindungen'),
        kante: dossierRechercheKanten().some(v => v.von === alt || v.nach === alt) };
    }, zuerst);
    assert.ok(panel.rudiment && panel.recherche && panel.graph && panel.kante,
      'Alte Rudimentansicht plus Recherche und Graph: ' + JSON.stringify(panel));

    const block = await p.evaluate(({ alt, zweite }) => {
      dispatch({ type: 'DOSSIER_SPERREN', id: alt });
      const gesperrt = dossierGesperrt(entitaet(alt));
      const marker = karteMarker();
      const option = [...dossierOptionen(alt)].find(x => x.value === alt);
      const vorher = entitaet(alt).name;
      const alteKante = dossierRechercheKanten().some(v => v.von === alt || v.nach === alt);
      const vorherNotizen = (STATE.dossiers.entitaeten[alt].kurzlage || '');
      dispatch({ type: 'DOSSIER_KURZLAGE', id: alt, inhalt: '<p>GESPERRT NICHT SCHREIBEN</p>' });
      dispatch({ type: 'VERBINDUNG_ANGELEGT', von: alt, nach: zweite, typ: SCENARIO.verbindungstypen[0], bewertung: 'C3' });
      STATE.dossiers.auswahl = alt;
      renderModule();
      return { gesperrt, marker: marker.some(m => m.id === alt || m.entId === alt),
        bezug: karteBezugVon(alt), option: option && option.textContent,
        name: vorher, alteKante, unveraendert: (STATE.dossiers.entitaeten[alt].kurzlage || '') === vorherNotizen,
        recherchePanel: !!document.querySelector('#rch-dossier-unterlagen'),
        graphPanel: !!document.querySelector('.split svg[aria-label^="Beziehungsansicht um"]') };
    }, zuerst);
    assert.ok(block.gesperrt && !block.marker && block.bezug === null,
      'Manuelle Sperre entfernt Dossier und Sichtung aus der Karte: ' + JSON.stringify(block));
    assert.equal(block.option, zuerst.alt, 'Sperre zeigt nur Kennung in Karten-Dossierliste');
    assert.equal(block.alteKante, false, 'Verbindungen zu gesperrten Dossiers werden nicht offengelegt');
    assert.equal(block.unveraendert, true, 'gesperrtes Dossier wird nicht geändert');
    assert.equal(block.recherchePanel || block.graphPanel, false, 'keine Zusatzpanels bei manueller Sperre');

    await p.evaluate(({ alt }) => dispatch({ type: 'DOSSIER_ENTSPERREN', id: alt }), zuerst);
    assert.ok(await p.evaluate(id => karteMarker().some(m => m.id === id), zuerst.alt),
      'Entsperren stellt den Kartenmarker wieder her');
    assert.deepEqual(errors, [], 'keine Browserfehler');
    console.log('OK: Phase 5b2 – Kartenobjekte, Dossierbearbeitung, Beziehungsgraph und manuelle Sperren');
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
