/* Altdaten des entfernten Aussagenregisters: keine Oberfläche und keine Bearbeitungsaktionen mehr; vorhandene Aussagen bleiben unverändert
   (auch eine Einschätzung ohne Fundstelle) und überstehen Export, Import und erneuten Export. Exit-Code 1 bei Fehlschlag. */
const PF = require('./_pfad.js'); const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const err = [];
  const neu = async () => { const ctx = await b.newContext({ viewport: { width: 1500, height: 1100 } }); const p = await ctx.newPage();
    p.on('pageerror', x => err.push(x.message)); ctx.on('page', pg => { if (pg !== p) pg.close().catch(() => {}); });
    await p.route(/geobasis|eox|gdi\.berlin|cartocdn|open-meteo|openfreemap|unpkg/, r => r.abort());
    await p.goto(PF.APP); await p.waitForTimeout(5200); await p.fill('#gate-pw', 'pw-test-123'); const z = await p.$('#gate-pw2'); if (z && await z.isVisible()) await z.fill('pw-test-123'); await p.click('#gate-go');
    await p.waitForFunction(() => !document.body.classList.contains('locked'), null, { timeout: 20000 }); return p; };
  const A = await neu();
  const fall = await A.evaluate(() => {
    dispatch({ type: 'DOSSIER_ANGELEGT', typ: 'Person', name: 'Altperson', land: 'DE' }); const d = STATE.dossiers.eigene.find(x => x.name === 'Altperson').id; STATE.dossiers.auswahl = d;
    dispatch({ type: 'RECHERCHE_BELEG', dossier: d, fall: null, neuerFall: { titel: 'Altfall', frage: '' }, art: 'Text', herkunft: '', notiz: '', fassung: { dateiname: null, groesse: 10, typ: 'text/plain', hash: null, anhang: false }, fundstelle: null, zitat: 'Unterlage ohne Fundstelle' });
    const R = PROFIL.recherche, jetzt = new Date().toISOString();
    /* Altzustand, der früher unzulässig war: Einschätzung "dafuer" mit einer Unterlage ohne Fundstelle; der Import darf ihn nicht verändern */
    R.aussagen.push({ id: 'A-001', fall: R.faelle[0].id, text: 'Alte Aussage', status: 'offen', einschaetzung: 'dafuer', begruendung: 'Begründung', dossiers: [d], stuetzend: [{ beob: R.beobachtungen[0].id, pruefstand: 'geprueft', geprueftAm: jetzt }], widersprechend: [], erfasst: jetzt, geaendert: jetzt });
    R.seq.aussage = 1; profilSpeichern(); dispatch({ type: 'NAVIGATION', modul: 'dossier' }); renderModule(); return R.faelle[0].id; });
  const ui = await A.evaluate(() => ({ rca: !!document.querySelector('[id^="rca-"]'), panel: Array.from(document.querySelectorAll('section.panel > h2')).some(h => /Aussagen/.test(h.textContent)), notiz: document.body.innerText.includes('Frühere Aussagen (1)'),
    aktionen: Object.keys(ACTIONS).filter(k => /^RECHERCHE_(AUSSAGE|PRUEFSTAND|BELEG_VERKN|BELEG_GELOEST)/.test(k)).length }));
  const text1 = await A.evaluate(async f => (await rchPaketBauen(f)).text, fall); const aus1 = JSON.parse(text1).inhalt.aussagen;
  const B = await neu();
  await B.evaluate(async t => { rchPaketLaden(new File([t], 'alt.json', { type: 'application/json' })); await new Promise(r => setTimeout(r, 2000)); }, text1);
  const imp = await B.evaluate(() => ({ n: PROFIL.recherche.aussagen.length, ei: PROFIL.recherche.aussagen[0] && PROFIL.recherche.aussagen[0].einschaetzung, fall: PROFIL.recherche.faelle[0] && PROFIL.recherche.faelle[0].id }));
  const text2 = await B.evaluate(async f => (await rchPaketBauen(f)).text, imp.fall); const aus2 = JSON.parse(text2).inhalt.aussagen;
  const gleich = JSON.stringify(aus1.map(x => ({ t: x.text, s: x.status, e: x.einschaetzung, b: x.begruendung, st: x.stuetzend.map(l => l.pruefstand) }))) === JSON.stringify(aus2.map(x => ({ t: x.text, s: x.status, e: x.einschaetzung, b: x.begruendung, st: x.stuetzend.map(l => l.pruefstand) })));
  const ok = { ohneOberflaeche: !ui.rca && !ui.panel, ohneAktionen: ui.aktionen === 0, hinweisImFallpaket: ui.notiz, importErhaeltAussage: imp.n === 1 && imp.ei === 'dafuer', erneuterExportGleich: aus1.length === 1 && aus2.length === 1 && gleich, keineFehler: err.length === 0 };
  console.log(JSON.stringify(ok, null, 1)); if (err.length) console.log(err.slice(0, 5));
  await b.close(); process.exit(Object.values(ok).every(Boolean) ? 0 : 1);
})();
