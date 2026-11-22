/* Phase 5c1a: Notizen und Operative Einschränkungen liegen im Profil.
   Prüft: einmalige Übernahme aus einem Zustand Format 4 (mit Zeitpunkt), Bearbeiten über die Oberfläche,
   Erhalt über Neuladen und „Zustand zurücksetzen“, Profilexport (Download), Zustandsimport mit Konflikt
   (vorhandener Text hat Vorrang, abweichender wird aufbewahrt und gemeldet), bewusst geleertes Feld wird
   nicht zurückgeholt, Profilimport in ein leeres Profil, „Profil leeren“ löscht beide Felder, Speicherfehler
   wird angezeigt; Leerstand übersteht Export und Import in ein frisches Profil (Review #110). */
const assert = require('node:assert/strict');
const fs = require('fs');
const { chromium } = require('playwright');
const { APP } = require('./_pfad');

(async () => {
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 }, reducedMotion: 'reduce', acceptDownloads: true });
    const p = await ctx.newPage();
    p.setDefaultTimeout(20000);
    const errors = [];
    p.on('pageerror', e => errors.push(e.message));
    await p.route(/^https?:/, r => r.abort());
    const anmelden = async () => {
      await p.goto(APP);
      await p.fill('#gate-pw', 'pw-test-123');
      if (await p.isVisible('#gate-pw2')) await p.fill('#gate-pw2', 'pw-test-123');
      await p.click('#gate-go');
      await p.waitForFunction(() => !document.body.classList.contains('locked'));
    };
    const texte = () => p.evaluate(() => JSON.parse(JSON.stringify(PROFIL.profiltexte)));
    const gespeichert = () => p.evaluate(() => (JSON.parse(localStorage.getItem(PROFIL_KEY)) || {}).profiltexte || null);
    await anmelden();

    /* 1. Altbestand Format 4: Text nur in STATE.agent, kein profiltexte im gespeicherten Profil */
    await p.evaluate(() => {
      STATE.agent.notizen = 'Alt-Notiz aus Format 4'; STATE.agent.notizenGeaendert = '2026-10-01T10:00:00.000Z';
      STATE.agent.einschraenkungen = ''; Store.save(STATE);
      const o = JSON.parse(localStorage.getItem(PROFIL_KEY)); delete o.profiltexte; localStorage.setItem(PROFIL_KEY, JSON.stringify(o));
    });
    await anmelden();
    let t = await texte();
    assert.deepEqual(t.notizen, { text: 'Alt-Notiz aus Format 4', t: '2026-10-01T10:00:00.000Z', verdraengt: [] }, 'Übernahme mit Zeitpunkt');
    assert.deepEqual(t.einschraenkungen, { text: '', t: null, verdraengt: [] }, 'leerer Alttext gilt als nie gesetzt');
    assert.equal((await gespeichert()).notizen.text, 'Alt-Notiz aus Format 4', 'Übernahme sofort gespeichert');

    /* 2. Bearbeiten über die Oberfläche */
    await p.evaluate(() => { dispatch({ type: 'NAVIGATION', modul: 'profil' }); renderModule(); });
    await p.getByText('Bisherige Notizen', { exact: true }).click();
    assert.equal(await p.locator('#ta-notizen').inputValue(), 'Alt-Notiz aus Format 4', 'Feld zeigt den Profiltext');
    await p.fill('#ta-einschr', 'Keine Einsätze nach 22 Uhr');
    await p.locator('#ta-einschr').blur();
    await p.waitForFunction(() => PROFIL.profiltexte.einschraenkungen.text === 'Keine Einsätze nach 22 Uhr');
    assert.equal((await gespeichert()).einschraenkungen.text, 'Keine Einsätze nach 22 Uhr', 'Autosave ins Profil');

    /* 3. Zurücksetzen und 4. Neuladen */
    await p.evaluate(() => dispatch({ type: 'RESET' }));
    t = await texte();
    assert.equal(t.notizen.text + '|' + t.einschraenkungen.text, 'Alt-Notiz aus Format 4|Keine Einsätze nach 22 Uhr', 'Zurücksetzen erhält beide Texte');
    assert.equal(await p.evaluate(() => STATE.agent.einschraenkungen), 'Keine Einsätze nach 22 Uhr', 'Spiegel im Zustand nach Zurücksetzen');
    await anmelden();
    t = await texte();
    assert.equal(t.notizen.text + '|' + t.einschraenkungen.text, 'Alt-Notiz aus Format 4|Keine Einsätze nach 22 Uhr', 'Neuladen erhält beide Texte');
    const warn = await p.evaluate(() => document.documentElement.innerHTML.indexOf('sowie die Notizen und Operativen Einschränkungen') >= 0);
    assert.equal(warn, true, 'Warntexte nennen die beiden Felder');

    /* 5. Profilexport (echter Download über „Profil sichern“ im Modul Dossiers) enthält die Texte */
    await p.evaluate(() => { dispatch({ type: 'NAVIGATION', modul: 'dossier' }); renderModule(); });
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#btn-profil-ex')]);
    const export_ = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
    assert.equal(export_.profiltexte.einschraenkungen.text, 'Keine Einsätze nach 22 Uhr', 'Profilexport enthält die Texte');

    /* 6. Bewusst geleert, dann Zustandsimport einer älteren Datei mit Text: geleertes Feld bleibt leer, Text aufbewahrt */
    const imp = await p.evaluate(() => {
      dispatch({ type: 'TEXT_GEAENDERT', feld: 'notizen', wert: '' });
      const datei = JSON.parse(JSON.stringify(STATE));
      datei.agent.notizen = 'Text aus alter Zustandsdatei'; datei.agent.notizenGeaendert = '2026-09-01T08:00:00.000Z';
      datei.agent.einschraenkungen = 'Keine Einsätze nach 22 Uhr';
      dispatch({ type: 'IMPORT', state: datei, datei: 'alt.json' });
      return { pt: JSON.parse(JSON.stringify(PROFIL.profiltexte)), log: STATE.log[STATE.log.length - 1].detail, spiegel: STATE.agent.notizen,
        gesp: JSON.parse(localStorage.getItem(PROFIL_KEY)).profiltexte.notizen.verdraengt.length };
    });
    assert.equal(imp.pt.notizen.text, '', 'bewusst geleertes Feld nicht zurückgeholt');
    assert.ok(imp.pt.notizen.t, 'Leerstand trägt einen Zeitpunkt');
    assert.equal(imp.pt.notizen.verdraengt.length, 1, 'abweichender Text aufbewahrt');
    assert.equal(imp.pt.notizen.verdraengt[0].text, 'Text aus alter Zustandsdatei');
    assert.equal(imp.pt.einschraenkungen.verdraengt.length, 0, 'gleicher Text nicht doppelt aufbewahrt');
    assert.match(imp.log, /1 abweichende\(r\) Profiltext\(e\)/, 'Import meldet den aufbewahrten Text');
    assert.equal(imp.spiegel, '', 'Zustand spiegelt den Profiltext, nicht den Dateitext');
    assert.equal(imp.gesp, 1, 'Ergebnis des Zustandsimports gespeichert');
    await p.evaluate(() => { dispatch({ type: 'NAVIGATION', modul: 'profil' }); VIEW.profilReiter = 'arbeit'; renderModule(); });
    assert.equal(await p.locator('#pt-alt-notizen').count(), 1, 'aufbewahrter Text sichtbar');

    /* 7. Profil leeren löscht beide Felder; 8. Profilimport in das leere Profil übernimmt die Texte */
    const leer = await p.evaluate((q) => {
      dispatch({ type: 'PROFIL_LEEREN' });
      const nachLeeren = JSON.parse(JSON.stringify(PROFIL.profiltexte));
      dispatch({ type: 'PROFIL_IMPORT', profil: q, datei: 'profil.json' });
      return { nachLeeren, nachImport: JSON.parse(JSON.stringify(PROFIL.profiltexte)), spiegel: STATE.agent.einschraenkungen };
    }, export_);
    assert.deepEqual(leer.nachLeeren, { notizen: { text: '', t: null, verdraengt: [] }, einschraenkungen: { text: '', t: null, verdraengt: [] } }, 'Profil leeren löscht beide Felder');
    assert.equal(leer.nachImport.notizen.text, 'Alt-Notiz aus Format 4', 'Profilimport füllt leeres Feld');
    assert.equal(leer.nachImport.einschraenkungen.text, 'Keine Einsätze nach 22 Uhr');
    assert.equal(leer.spiegel, 'Keine Einsätze nach 22 Uhr', 'Spiegel nach Profilimport');

    /* 9. Speicherfehler wird angezeigt */
    const fehler = await p.evaluate(() => {
      try { for (let i = 0; i < 200; i++) localStorage.setItem('fuell' + i, 'x'.repeat(100000)); } catch (x) {}
      try { for (let i = 0; i < 3000; i++) localStorage.setItem('f2' + i, 'x'.repeat(1000)); } catch (x) {}
      dispatch({ type: 'TEXT_GEAENDERT', feld: 'notizen', wert: 'Groß ' + 'y'.repeat(20000) });
      const text = document.body.innerText;
      Object.keys(localStorage).filter(k => k.indexOf('fuell') === 0 || k.indexOf('f2') === 0).forEach(k => localStorage.removeItem(k));
      return /Profil konnte nicht gespeichert werden/.test(text);
    });
    assert.equal(fehler, true, 'Speicherfehler wird angezeigt');
    /* 10. Review #110: Text setzen → bewusst leeren → Profil exportieren → in frisches Profil importieren → alten Zustand importieren.
       Beide Felder müssen leer bleiben, die alten Texte dürfen nur unter verdraengt erscheinen. */
    const vorbereitung = await p.evaluate(() => {
      dispatch({ type: 'TEXT_GEAENDERT', feld: 'notizen', wert: 'Vorher A' });
      dispatch({ type: 'TEXT_GEAENDERT', feld: 'einschraenkungen', wert: 'Vorher B' });
      const alterZustand = JSON.parse(JSON.stringify(STATE));
      dispatch({ type: 'TEXT_GEAENDERT', feld: 'notizen', wert: '' });
      dispatch({ type: 'TEXT_GEAENDERT', feld: 'einschraenkungen', wert: '' });
      return { alterZustand, t: JSON.parse(JSON.stringify(PROFIL.profiltexte)) };
    });
    assert.ok(vorbereitung.t.notizen.t && vorbereitung.t.einschraenkungen.t, 'bewusstes Leeren trägt Zeitpunkte');
    await p.evaluate(() => { dispatch({ type: 'NAVIGATION', modul: 'dossier' }); renderModule(); });
    const [dl2] = await Promise.all([p.waitForEvent('download'), p.click('#btn-profil-ex')]);
    const geleertExport = JSON.parse(fs.readFileSync(await dl2.path(), 'utf8'));
    assert.equal(geleertExport.profiltexte.notizen.text + geleertExport.profiltexte.einschraenkungen.text, '', 'Export enthält den Leerstand');
    const ctx2 = await browser.newContext({ viewport: { width: 1400, height: 1000 }, reducedMotion: 'reduce' });
    const q = await ctx2.newPage(); q.setDefaultTimeout(20000);
    const errors2 = []; q.on('pageerror', e => errors2.push(e.message));
    await q.route(/^https?:/, r => r.abort());
    await q.goto(APP); await q.fill('#gate-pw', 'pw-test-123'); if (await q.isVisible('#gate-pw2')) await q.fill('#gate-pw2', 'pw-test-123');
    await q.click('#gate-go'); await q.waitForFunction(() => !document.body.classList.contains('locked'));
    const frisch = await q.evaluate(([profil, zustand]) => {
      const vorher = JSON.parse(JSON.stringify(PROFIL.profiltexte));
      dispatch({ type: 'PROFIL_IMPORT', profil, datei: 'geleert.json' });
      const nachProfil = JSON.parse(JSON.stringify(PROFIL.profiltexte));
      dispatch({ type: 'IMPORT', state: zustand, datei: 'alt.json' });
      const nachZustand = JSON.parse(JSON.stringify(PROFIL.profiltexte));
      const spiegel = [STATE.agent.notizen, STATE.agent.einschraenkungen];
      dispatch({ type: 'PROFIL_LEEREN' });
      return { vorher, nachProfil, nachZustand, spiegel, leerSpiegel: [STATE.agent.notizenGeaendert, STATE.agent.einschraenkungenGeaendert] };
    }, [geleertExport, vorbereitung.alterZustand]);
    assert.equal(frisch.vorher.notizen.t, null, 'frisches Profil: nie gesetzt');
    for (const f of ['notizen', 'einschraenkungen']) {
      assert.equal(frisch.nachProfil[f].text, '', f + ': Profilimport übernimmt den Leerstand');
      assert.ok(frisch.nachProfil[f].t, f + ': Profilimport übernimmt den Zeitpunkt des Leerens');
      assert.equal(frisch.nachZustand[f].text, '', f + ': alter Zustand holt den gelöschten Text nicht zurück');
      assert.deepEqual(frisch.nachZustand[f].verdraengt.map(v => v.text), [f === 'notizen' ? 'Vorher A' : 'Vorher B'], f + ': alter Text nur aufbewahrt');
    }
    assert.deepEqual(frisch.spiegel, ['', ''], 'Spiegel zeigt den Leerstand');
    assert.deepEqual(frisch.leerSpiegel, [null, null], 'nach Profil leeren keine veralteten Zeitpunkte im Spiegel');
    assert.deepEqual(errors2, [], 'keine Browserfehler im frischen Profil');
    await ctx2.close();

    assert.deepEqual(errors, [], 'keine Browserfehler');
    console.log('OK: Phase 5c1a – Profiltexte im Profil: Übernahme, Autosave, Zurücksetzen, Neuladen, Export, Importkonflikte, Leeren, Speicherfehler');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
