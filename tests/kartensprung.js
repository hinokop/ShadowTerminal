/* Kartensprung aus dem Dossier macht die passende Markerebene sichtbar (Orte, Personen, Organisationen). Exit-Code 1 bei Fehlschlag. */
const PF = require('./_pfad.js'); const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1500, height: 950 } })).newPage(); const err = [];
  p.on('pageerror', x => err.push(x.message));
  await p.route(/geobasis|eox|gdi\.berlin|cartocdn|open-meteo|openfreemap|unpkg/, r => r.abort());
  await p.goto(PF.APP); await p.waitForTimeout(5200); await p.fill('#gate-pw', 'pw-test-123'); await p.fill('#gate-pw2', 'pw-test-123'); await p.click('#gate-go');
  await p.waitForFunction(() => !document.body.classList.contains('locked'), null, { timeout: 20000 });
  const r = await p.evaluate(() => {
    const o = { ergebnis: {} };
    ['Ort', 'Person', 'Organisation'].forEach(typ => {
      dispatch({ type: 'DOSSIER_ANGELEGT', typ: typ, name: 'Sprungtest ' + typ, land: 'DE' });
      const e = pool().find(x => x.typ === typ && x.name === 'Sprungtest ' + typ); if (e && !karteKoord(e.id)) PROFIL.koord[e.id] = [52.5 + Math.random() / 100, 13.4];
      if (!e) { o.ergebnis[typ] = null; return; }
      VIEW.karte.ebenen.orte = false; VIEW.karte.ebenen.personen = false; VIEW.karte.ebenen.organisationen = false;
      const vorher = karteMarker().some(m => m.id === e.id);
      kartenSprung(e, karteKoord(e.id));
      o.ergebnis[typ] = { id: e.id, vorher, nachher: karteMarker().some(m => m.id === e.id), alteEbene: VIEW.karte.ebenen.akteure === true };
    });
    return o;
  });
  console.log(JSON.stringify(r)); let ok = true; const chk = (n, c) => { console.log((c ? 'OK   ' : 'FAIL ') + n); if (!c) ok = false; };
  ['Ort', 'Person', 'Organisation'].forEach(t => { const x = r.ergebnis[t]; chk(t + ': Testfall vorhanden', !!x); if (x) { chk(t + ': vorher ausgeblendet', x.vorher === false); chk(t + ': nach dem Sprung sichtbar', x.nachher === true); chk(t + ': kein altes akteure-Flag', x.alteEbene === false); } });
  chk('keine Seitenfehler', err.length === 0); if (err.length) console.log(err.join('|'));
  await b.close(); process.exit(ok ? 0 : 1);
})();
