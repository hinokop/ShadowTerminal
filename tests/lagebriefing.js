/* Lagebriefing in X (Anzeige): Kurzlage und bis zu fünf zuletzt erfasste, zugängliche Unterlagen; jede führt zum bestehenden Eintrag.
   Keine neuen Datenfelder. Exit-Code 1 bei Fehlschlag. */
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
    const s = await p.evaluate(() => {
      dispatch({ type: 'DOSSIER_ANGELEGT', typ: 'Person', name: 'Briefing Offen', land: 'DE' }); const d = STATE.dossiers.auswahl;
      dispatch({ type: 'DOSSIER_ANGELEGT', typ: 'Person', name: 'Briefing Gesperrt', land: 'DE' }); const g = STATE.dossiers.auswahl;
      const f = xAnlegen({ titel: 'Briefingfall', frage: 'Wer hat den Beschluss vorbereitet?' }), leer = xAnlegen({ titel: 'Leerer Fall' });
      for (let i = 1; i <= 7; i++) dispatch({ type: 'RECHERCHE_BELEG', dossier: d, fall: f.id, art: 'Text', herkunft: 'Quelle Nr ' + i, fassung: { text: 'Text ' + i }, zitat: 'Zitat ' + i });
      dispatch({ type: 'RECHERCHE_BELEG', dossier: g, fall: f.id, art: 'Text', herkunft: 'Quelle gesperrt', fassung: { text: 'geheim' }, zitat: 'Zitat gesperrt' });
      const R = PROFIL.recherche, bs = R.beobachtungen.filter(b => R.fassungen.some(v => v.id === b.fassung && R.quellen.some(q => q.id === v.quelle && q.fall === f.id)));
      bs.forEach((b, i) => { b.erfasst = '2026-01-' + String(10 + i).padStart(2, '0') + 'T10:00:00.000Z'; });   /* aufsteigend; die gesperrte ist die jüngste */
      PROFIL.gesperrt = [g]; profilSpeichern();
      return { f: f.id, leer: leer.id, ids: bs.map(b => b.id) };
    });
    await p.evaluate(id => xOeffnen(id), s.f);
    assert.equal(await p.locator('#x-briefing').count(), 1, 'Briefing vorhanden');
    assert.ok((await p.locator('#x-briefing').innerText()).includes('Wer hat den Beschluss vorbereitet?'), 'Kurzlage steht im Briefing');
    const eintraege = await p.locator('#x-briefing [data-unterlage]').evaluateAll(l => l.map(e => e.getAttribute('data-unterlage')));
    assert.equal(eintraege.length, 5, 'höchstens fünf');
    assert.deepEqual(eintraege, [s.ids[6], s.ids[5], s.ids[4], s.ids[3], s.ids[2]], 'jüngste zuerst, gesperrtes Dossier ausgelassen');
    assert.equal((await p.locator('#x-briefing').innerText()).includes('gesperrt'), false, 'nichts aus dem gesperrten Dossier');
    /* Klick führt zum bestehenden Eintrag */
    await p.click('#x-briefing [data-unterlage="' + s.ids[4] + '"] button');
    assert.equal(await p.evaluate(() => document.activeElement && document.activeElement.id), 'x-eintrag-' + s.ids[4], 'Fokus auf dem Eintrag in der Unterlagenliste');
    assert.ok(await p.locator('#x-eintrag-' + s.ids[4]).isVisible());
    /* keine neuen Datenfelder am Fall */
    assert.deepEqual(await p.evaluate(id => Object.keys(xFall(id)).sort(), s.f), ['erfasst', 'frage', 'id', 'titel', 'zustand']);
    /* leerer Fall */
    await p.evaluate(id => xOeffnen(id), s.leer);
    const t = await p.locator('#x-briefing').innerText();
    assert.ok(t.includes('Keine Kurzlage erfasst') && t.includes('Noch keine Unterlagen'), 'leerer Fall: klare Leeranzeige');
    assert.equal(await p.locator('#x-briefing [data-unterlage]').count(), 0);
    assert.deepEqual(fehler, []);
    console.log('OK: Lagebriefing in X (Anzeige)');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
