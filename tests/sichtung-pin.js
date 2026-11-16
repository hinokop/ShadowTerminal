/* Entwurfs-Pin und Sichtung: Bestätigung blendet den Pin auf der Karte aus (Daten bleiben), das Sichtungs-Popup zeigt und bearbeitet die Pin-Felder,
   neue Sichtungen bleiben unbewertet; Widerspruch nur unter bewerteten; Entfernen der Sichtung bringt den Entwurf zurück. Exit-Code 1 bei Fehlschlag. */
const PF = require('./_pfad.js'); const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1500, height: 1100 } })).newPage(); const err = [], ok = {};
  p.on('pageerror', x => err.push(x.message));
  await p.route(/geobasis|eox|gdi\.berlin|cartocdn|open-meteo|openfreemap|unpkg/, r => r.abort());
  await p.goto(PF.APP); await p.waitForTimeout(5200); await p.fill('#gate-pw', 'pw-test-123'); const z = await p.$('#gate-pw2'); if (z && await z.isVisible()) await z.fill('pw-test-123'); await p.click('#gate-go');
  await p.waitForFunction(() => !document.body.classList.contains('locked'), null, { timeout: 20000 });
  const s = await p.evaluate(() => {
    dispatch({ type: 'DOSSIER_ANGELEGT', typ: 'Person', name: 'Pinperson', land: 'DE' }); const d = STATE.dossiers.auswahl;
    dispatch({ type: 'PIN_ANGELEGT', ll: [52.479, 13.4568], name: 'Mein Entwurf', dossier: d, notiz: 'zuerst notiert' });
    const pin = PROFIL.pins[PROFIL.pins.length - 1];
    dispatch({ type: 'PIN_GEAENDERT', id: pin.id, zwecke: [PIN_ZWECKE[0]], umgebung: { [PIN_UMGEBUNG[0][0]]: 'Parkplatz' } });
    return { d, pin: pin.id, vorher: karteMarker().some(m => m.id === pin.id) };
  });
  ok.entwurfSichtbar = s.vorher === true;
  await p.evaluate(d => { dispatch({ type: 'NAVIGATION', modul: 'dossier' }); STATE.dossiers.auswahl = d; VIEW.dtab = 'sichtungen'; renderModule(); }, s.d);
  await p.click('#si-pin-' + s.pin); await p.waitForTimeout(300);
  const a = await p.evaluate(([d, pid]) => { const si = STATE.dossiers.entitaeten[d].sichtungen, pin = PROFIL.pins.find(x => x.id === pid);
    return { n: si.length, id: si[0] && si[0].id, guete: si[0] && si[0].guete, pinRef: si[0] && si[0].pin, pinDa: !!pin, pinSicht: pin && pin.sichtung, pinMarker: karteMarker().some(m => m.id === pid), siMarker: karteMarker().some(m => si[0] && m.id === si[0].id), notiz: pin && pin.notiz }; }, [s.d, s.pin]);
  ok.pinNachBestaetigungAusgeblendet = a.n === 1 && a.pinRef === s.pin && a.pinDa && a.pinSicht === a.id && a.pinMarker === false && a.siMarker === true;
  ok.neueSichtungUnbewertet = a.guete === 'unbewertet';
  /* Popup der Sichtung: Pin-Felder sichtbar und bearbeitbar */
  await p.evaluate(sid => { VIEW.karte.reiter = 'karte'; dispatch({ type: 'NAVIGATION', modul: 'karte' }); setTimeout(() => karteWaehlen(sid, true), 0); }, a.id); await p.waitForTimeout(1200);
  const pop = await p.evaluate(() => ({ text: document.body.innerText, notiz: (document.querySelector('#pin-notiz') || {}).value, name: (document.querySelector('#pin-name') || {}).value, bew: !!document.querySelector('#si-bewerten') }));
  ok.popupZeigtPinDaten = /Aus Entwurf Mein Entwurf/.test(pop.text) && pop.notiz === 'zuerst notiert' && pop.name === 'Mein Entwurf' && /Parkplatz/.test(await p.evaluate(() => [...document.querySelectorAll('input')].map(i => i.value).join('|')));
  await p.locator('#pin-notiz').fill('im Popup geändert'); await p.locator('#pin-notiz').blur(); await p.waitForTimeout(300);
  ok.popupBearbeitetPin = await p.evaluate(pid => PROFIL.pins.find(x => x.id === pid).notiz === 'im Popup geändert', s.pin);
  await p.locator('#si-bewerten').selectOption('plausibel'); await p.waitForTimeout(300);
  ok.popupBewertet = await p.evaluate(([d, sid]) => STATE.dossiers.entitaeten[d].sichtungen.find(x => x.id === sid).guete === 'plausibel', [s.d, a.id]);
  /* Widerspruch nur unter bewerteten Sichtungen */
  const w = await p.evaluate(d => {
    dispatch({ type: 'SICHTUNG_HINZU', id: d, ort: '48.1000, 11.5000', text: 'zweite', guete: 'unbewertet' }); dispatch({ type: 'SICHTUNG_HINZU', id: d, ort: '53.5000, 10.0000', text: 'dritte', guete: 'unbewertet' });
    const e = entitaet(d), L = STATE.dossiers.entitaeten[d].sichtungen, r = { unbewertet: L.slice(1).map(x => sichtungGuete(e, x)) };
    L.slice(1).forEach(x => dispatch({ type: 'SICHTUNG_BEWERTET', id: d, sid: x.id, guete: 'gesichert' })); r.bewertet = L.slice(1).map(x => sichtungGuete(e, x)); return r;
  }, s.d);
  ok.widerspruchNurBewertet = w.unbewertet.every(g => g === 'unbewertet') && w.bewertet.every(g => g === 'widerspruechlich');
  /* Tabelle: Bewertung per Auswahl */
  await p.evaluate(d => { dispatch({ type: 'NAVIGATION', modul: 'dossier' }); STATE.dossiers.auswahl = d; VIEW.dtab = 'sichtungen'; renderModule(); }, s.d);
  await p.locator('#si-g-' + a.id).selectOption('unbestaetigt'); await p.waitForTimeout(300);
  ok.tabelleBewertet = await p.evaluate(([d, sid]) => STATE.dossiers.entitaeten[d].sichtungen.find(x => x.id === sid).guete === 'unbestaetigt', [s.d, a.id]);
  /* Sichtung entfernen: Entwurf erscheint wieder */
  await p.locator('#si-del-' + a.id).click(); await p.waitForTimeout(300);
  const r = await p.evaluate(pid => { const pin = PROFIL.pins.find(x => x.id === pid); return { sichtbar: karteMarker().some(m => m.id === pid), ref: pin && pin.sichtung, notiz: pin && pin.notiz }; }, s.pin);
  ok.entwurfKehrtZurueck = r.sichtbar === true && r.ref === undefined && r.notiz === 'im Popup geändert';
  /* Nummern folgen dem Bestand: nach dem Löschen aller Sichtungen beginnt die Zählung wieder bei SI-001; fehlt nur die neueste, wird ihre Nummer wieder vergeben */
  const nr = await p.evaluate(d => {
    const L = () => STATE.dossiers.entitaeten[d].sichtungen;
    L().slice().forEach(x => dispatch({ type: 'SICHTUNG_ENTFERNT', id: d, sid: x.id }));
    dispatch({ type: 'SICHTUNG_HINZU', id: d, ort: 'A', text: 'a', guete: 'unbewertet' }); dispatch({ type: 'SICHTUNG_HINZU', id: d, ort: 'B', text: 'b', guete: 'unbewertet' });
    const erst = L().map(x => x.id); dispatch({ type: 'SICHTUNG_ENTFERNT', id: d, sid: 'SI-002' }); dispatch({ type: 'SICHTUNG_HINZU', id: d, ort: 'C', text: 'c', guete: 'unbewertet' });
    return { erst, danach: L().map(x => x.id) };
  }, s.d);
  ok.sichtungsnummernNachLoeschen = JSON.stringify(nr.erst) === '["SI-001","SI-002"]' && JSON.stringify(nr.danach) === '["SI-001","SI-002"]';
  ok.keineJsFehler = err.length === 0; if (err.length) console.log(err.slice(0, 4));
  const bad = Object.keys(ok).filter(k => ok[k] !== true); console.log(JSON.stringify(ok, null, 1)); console.log(bad.length ? 'FAIL: ' + bad.join(', ') : 'alle grün');
  await b.close(); process.exit(bad.length ? 1 : 0);
})();
