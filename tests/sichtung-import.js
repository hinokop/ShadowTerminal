/* Profilimport mit zwei eigenen Dossiers aus getrennten Profilen, beide mit PIN-001 und SI-001: nach dem Import müssen Nummern eindeutig,
   beide Richtungen der Paarung (pin.sichtung, sichtung.pin) richtig, jedes Dreieck zeigt sein Dossier und Löschen bringt nur den zugehörigen Pin zurück. */
const PF = require('./_pfad.js'); const { chromium } = require('playwright');
async function seite(b) {
  const p = await (await b.newContext({ viewport: { width: 1500, height: 1100 } })).newPage();
  await p.route(/geobasis|eox|gdi\.berlin|cartocdn|open-meteo|openfreemap|unpkg/, r => r.abort());
  await p.goto(PF.APP); await p.waitForTimeout(5200); await p.fill('#gate-pw', 'pw-test-123'); const z = await p.$('#gate-pw2'); if (z && await z.isVisible()) await z.fill('pw-test-123'); await p.click('#gate-go');
  await p.waitForFunction(() => !document.body.classList.contains('locked'), null, { timeout: 20000 }); return p;
}
const profilErzeugen = (p, name, pinName, ll) => p.evaluate(([name, pinName, ll]) => {
  dispatch({ type: 'DOSSIER_ANGELEGT', typ: 'Person', name: name, land: 'DE' }); const d = STATE.dossiers.auswahl;
  dispatch({ type: 'PIN_ANGELEGT', ll: ll, name: pinName, dossier: d, notiz: 'Notiz ' + pinName }); const pin = PROFIL.pins[PROFIL.pins.length - 1];
  dispatch({ type: 'SICHTUNG_HINZU', id: d, ort: ll[0] + ', ' + ll[1], text: 'Text ' + name, guete: 'unbewertet', pin: pin.id });
  profilSpeichern(); return { profil: JSON.parse(window.localStorage.getItem(PROFIL_KEY)), pin: pin.id, si: STATE.dossiers.entitaeten[d].sichtungen[0].id };
}, [name, pinName, ll]);
(async () => {
  const b = await chromium.launch(), err = [], ok = {};
  const pa = await seite(b), A = await profilErzeugen(pa, 'Importalpha', 'Pin Alpha', [52.5, 13.4]);
  const pb = await seite(b), B = await profilErzeugen(pb, 'Importbeta', 'Pin Beta', [48.1, 11.5]);
  ok.ausgangslageGleicheNummern = A.pin === 'PIN-001' && B.pin === 'PIN-001' && A.si === 'SI-001' && B.si === 'SI-001';
  const p = await seite(b); p.on('pageerror', x => err.push(x.message));
  const r = await p.evaluate(([qa, qb]) => {
    dispatch({ type: 'PROFIL_IMPORT', profil: qa }); dispatch({ type: 'PROFIL_IMPORT', profil: qb });
    const E = STATE.dossiers.entitaeten, ds = ['Importalpha', 'Importbeta'].map(n => (STATE.dossiers.eigene.find(x => x.name === n) || {}).id), M = karteMarker();
    const si = ds.map(d => (E[d] && E[d].sichtungen) || []), pins = ds.map(d => PROFIL.pins.filter(y => y.dossier === d));
    return { ds, si: si.map(l => l.map(x => x.id)), siPin: si.map(l => l.map(x => x.pin)), pins: pins.map(l => l.map(y => [y.id, y.sichtung])), gepaart: pins.map((l, i) => l.length === 1 && pinSichtung(l[0]) === si[i][0] && sichtungPin(si[i][0], ds[i]) === l[0]),
      marker: ds.map((d, i) => ({ siDa: M.some(m => m.kat === 'sichtung' && m.id === si[i][0].id && m.entId === d), pinDa: M.some(m => m.kat === 'pin' && m.id === pins[i][0].id) })), alleSI: [].concat(...si.map(l => l.map(x => x.id))), allePin: PROFIL.pins.map(y => y.id) };
  }, [A.profil, B.profil]);
  ok.beideDossiersDa = r.ds.every(Boolean) && r.ds[0] !== r.ds[1];
  ok.sichtungsnummernEindeutig = r.alleSI.length === 2 && new Set(r.alleSI).size === 2;
  ok.pinKennungenEindeutig = new Set(r.allePin).size === r.allePin.length && r.pins.every(l => l.length === 1);
  ok.paarungBeideRichtungen = r.gepaart.every(Boolean) && r.pins.every((l, i) => l[0][1] === r.si[i][0] && r.siPin[i][0] === l[0][0]);
  ok.pinsAusgeblendetDreieckeDa = r.marker.every(m => m.siDa && !m.pinDa);
  /* Klick auf jedes Dreieck öffnet die Sichtung des richtigen Dossiers samt Entwurfsdaten */
  const namen = ['Importalpha', 'Importbeta'], pinNamen = ['Pin Alpha', 'Pin Beta'];
  ok.klickOeffnetRichtigesDreieck = true;
  for (let i = 0; i < 2; i++) {
    await p.evaluate(sid => { VIEW.karte.reiter = 'karte'; dispatch({ type: 'NAVIGATION', modul: 'karte' }); setTimeout(() => karteWaehlen(sid, true), 0); }, r.si[i][0]); await p.waitForTimeout(1200);
    const t = await p.evaluate(() => ({ text: document.body.innerText, name: (document.querySelector('#pin-name') || {}).value, notiz: (document.querySelector('#pin-notiz') || {}).value }));
    const gut = t.text.indexOf(namen[i]) >= 0 && (t.name || '').indexOf(pinNamen[i]) === 0 && t.notiz === 'Notiz ' + pinNamen[i] && t.text.indexOf(namen[1 - i] + ' ') < 0;
    if (!gut) { ok.klickOeffnetRichtigesDreieck = false; console.log('Klick', i, JSON.stringify({ name: t.name, notiz: t.notiz })); }
  }
  /* Löschen der Sichtung des zweiten Dossiers bringt nur dessen Pin zurück */
  const l = await p.evaluate(([ds, sid]) => {
    dispatch({ type: 'SICHTUNG_ENTFERNT', id: ds[1], sid: sid }); const M = karteMarker(), a = PROFIL.pins.find(y => y.dossier === ds[0]), bb = PROFIL.pins.find(y => y.dossier === ds[1]);
    return { aPin: M.some(m => m.id === a.id), bPin: M.some(m => m.id === bb.id), aRef: a.sichtung, bRef: bb.sichtung, aSi: M.some(m => m.kat === 'sichtung' && m.entId === ds[0]) };
  }, [r.ds, r.si[1][0]]);
  ok.loeschenBringtNurZugehörigenPinZurueck = l.bPin === true && l.aPin === false && l.bRef === undefined && l.aRef === r.si[0][0] && l.aSi === true;
  ok.keineJsFehler = err.length === 0; if (err.length) console.log(err.slice(0, 4));
  const bad = Object.keys(ok).filter(k => ok[k] !== true); console.log(JSON.stringify(ok, null, 1)); if (bad.length) console.log(JSON.stringify(r)); console.log(bad.length ? 'FAIL: ' + bad.join(', ') : 'alle grün');
  await b.close(); process.exit(bad.length ? 1 : 0);
})();
