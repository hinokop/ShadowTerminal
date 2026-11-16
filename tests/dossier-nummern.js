/* Dossier-Nummern laufen je Typ durchgehend (P-0001 ff., O-0001 ff., L-0001 ff.); neue Dossiers setzen die Zählung fort; Liste nach Typ und Nummer;
   ältere Bestände (9051 ff., eigene 9101 ff.) werden einmalig umgeschrieben, auch in Verweisen (Pins, Zonen, Sperrliste). Exit-Code 1 bei Fehlschlag. */
const PF = require('./_pfad.js'); const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const FIX = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'altprofil-mission.json'), 'utf8'));
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1500, height: 1100 } })).newPage(); const err = [], ok = {};
  p.on('pageerror', x => err.push(x.message + ' @ ' + String(x.stack).split('\n').slice(1,3).join('|')));
  await p.route(/geobasis|eox|gdi\.berlin|cartocdn|open-meteo|openfreemap|unpkg/, r => r.abort());
  const an = async () => {
    await p.goto(PF.APP); await p.waitForTimeout(5200); await p.fill('#gate-pw', 'pw-test-123'); const z = await p.$('#gate-pw2'); if (z && await z.isVisible()) await z.fill('pw-test-123'); await p.click('#gate-go');
    await p.waitForFunction(() => !document.body.classList.contains('locked'), null, { timeout: 20000 }).catch(e => { console.log('ERR', err.slice(0,5)); throw e; });
  };
  const reihe = (typ, von, bis) => Array.from({ length: bis - von + 1 }, (_, i) => typ + '-' + String(von + i).padStart(4, '0'));
  await an();
  const bestand = await p.evaluate(() => poolAlle().map(e => e.id));
  ok.beispieleDurchlaufend = JSON.stringify(bestand) === JSON.stringify([].concat(reihe('P', 1, 17), reihe('O', 1, 5), reihe('L', 1, 9)));
  const neu = await p.evaluate(() => {
    const t = ['Person', 'Organisation', 'Ort', 'Person'].map(x => { dispatch({ type: 'DOSSIER_ANGELEGT', name: 'N-' + x, typ: x }); return STATE.dossiers.auswahl; });
    dispatch({ type: 'NAVIGATION', modul: 'dossier' }); renderModule();
    const dom = [...document.querySelectorAll('.elist li')].map(l => (l.innerText.match(/[POL]-[0-9]{4}/) || ['?'])[0]);
    return { t, dom };
  });
  ok.neueFortgesetzt = JSON.stringify(neu.t) === JSON.stringify(['P-0018', 'O-0006', 'L-0010', 'P-0019']);
  ok.listeNachTypUndNummer = JSON.stringify(neu.dom) === JSON.stringify([].concat(reihe('P', 1, 19), reihe('O', 1, 6), reihe('L', 1, 10)));
  /* Altprofil mit Verweisen */
  const alt = JSON.parse(JSON.stringify(FIX));
  alt.profil.pins = [{ id: 'PIN-001', name: 'Alt-Pin', ll: [50.1, 8.2], zwecke: [], umgebung: {}, notiz: 'bei P-9055', dossier: 'P-9051', t: new Date().toISOString() }];
  alt.profil.gesperrt = ['P-9055', 'P-9101'];
  alt.profil.aenderungen = { 'P-9052': { name: 'Geänderter Name', aliase: [], land: 'DE', rolle: 'x', eckdaten: [], bedrohung: { stufe: 1, begruendung: '' } } };
  alt.profil.eigene.push({ id: 'O-9102', typ: 'Organisation', land: 'DE', mission: 'STD', name: 'Alt-Organisation', bild: null, aliase: [], reg: 'ohne', verteiler: 'Eigener Eintrag', rolle: 'x', eckdaten: [], bedrohung: { stufe: 2, begruendung: '' }, nachtraege: [], eigen: true });
  alt.state.dossiers.eigene.push(JSON.parse(JSON.stringify(alt.profil.eigene[alt.profil.eigene.length - 1])));
  alt.state.dossiers.entitaeten['O-9102'] = { status: 'beobachtet', statusAm: new Date().toISOString(), notizen: [] };
  alt.state.dossiers.entitaeten['P-9060'] = Object.assign({ status: null, notizen: [] }, alt.state.dossiers.entitaeten['P-9060'] || {}, { status: 'relevant' });
  await p.evaluate(a => { localStorage.setItem(STORAGE_KEY, a.s); localStorage.setItem(PROFIL_KEY, a.p); }, { s: JSON.stringify(alt.state), p: JSON.stringify(alt.profil) });
  await an();
  const m = await p.evaluate(() => {
    const roh = JSON.stringify(STATE) + JSON.stringify(PROFIL).replace(/"idmap":\{[^}]*\}/, '');
    return { rest: roh.match(/\b[POL]-9[0-9]{3}\b/g) || [], eigene: STATE.dossiers.eigene.map(e => e.id + ' ' + e.name), pe: PROFIL.eigene.map(e => e.id),
      pin: PROFIL.pins[0], gesperrt: PROFIL.gesperrt, aend: Object.keys(PROFIL.aenderungen), st60: STATE.dossiers.entitaeten['P-0013'] && STATE.dossiers.entitaeten['P-0013'].status,
      stO: STATE.dossiers.entitaeten['O-0006'] && STATE.dossiers.entitaeten['O-0006'].status, idv: [STATE.idv, PROFIL.idv], pool: pool().filter(e => e.eigen).map(e => e.id) };
  });
  ok.altOhneRestIds = m.rest.length === 0; if (m.rest.length) console.log('Rest:', m.rest.slice(0, 6));
  ok.altEigeneUmnummeriert = JSON.stringify(m.eigene) === JSON.stringify(['P-0018 Altprofil Person', 'O-0006 Alt-Organisation']) && JSON.stringify(m.pe) === JSON.stringify(['P-0018', 'O-0006']);
  ok.altVerweiseFolgen = m.pin.dossier === 'P-0004' && /P-0008/.test(m.pin.notiz) && JSON.stringify(m.gesperrt) === JSON.stringify(['P-0008', 'P-0018']) && JSON.stringify(m.aend) === JSON.stringify(['P-0005']);
  ok.altStatusFolgtDerNummer = m.st60 === 'relevant' && m.stO === 'beobachtet';
  ok.altMarker = m.idv[0] === 2 && m.idv[1] === 2;
  const danach = await p.evaluate(() => { dispatch({ type: 'DOSSIER_ANGELEGT', name: 'Nach Migration', typ: 'Person' }); return STATE.dossiers.auswahl; });
  ok.altNeuesDossierFortgesetzt = danach === 'P-0019';
  /* Erneutes Laden ändert nichts mehr */
  await an();
  ok.erneutLadenStabil = await p.evaluate(() => JSON.stringify(PROFIL.eigene.map(e => e.id)) === '["P-0018","O-0006","P-0019"]' || JSON.stringify(PROFIL.eigene.map(e => e.id)));
  ok.keineJsFehler = err.length === 0; if (err.length) console.log(err.slice(0, 4));
  const bad = Object.keys(ok).filter(k => ok[k] !== true); console.log(JSON.stringify(ok, null, 1)); console.log(bad.length ? 'FAIL: ' + bad.join(', ') : 'alle grün');
  await b.close(); process.exit(bad.length ? 1 : 0);
})();
