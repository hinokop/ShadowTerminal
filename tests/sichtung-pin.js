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
  /* Unterschiedliche Orte ändern die manuelle Bewertung nicht. */
  const w = await p.evaluate(d => {
    dispatch({ type: 'SICHTUNG_HINZU', id: d, ort: '48.1000, 11.5000', text: 'zweite', guete: 'unbewertet' }); dispatch({ type: 'SICHTUNG_HINZU', id: d, ort: '53.5000, 10.0000', text: 'dritte', guete: 'unbewertet' });
    const L = STATE.dossiers.entitaeten[d].sichtungen, r = { unbewertet: L.slice(1).map(x => sichtungGuete(x)) };
    L.slice(1).forEach(x => dispatch({ type: 'SICHTUNG_BEWERTET', id: d, sid: x.id, guete: 'gesichert' })); r.bewertet = L.slice(1).map(x => sichtungGuete(x)); return r;
  }, s.d);
  ok.bewertungenBleibenUnabhaengig = w.unbewertet.every(g => g === 'unbewertet') && w.bewertet.every(g => g === 'gesichert');
  /* Tabelle: Bewertung per Auswahl */
  await p.evaluate(d => { dispatch({ type: 'NAVIGATION', modul: 'dossier' }); STATE.dossiers.auswahl = d; VIEW.dtab = 'sichtungen'; renderModule(); }, s.d);
  await p.locator('#si-g-' + a.id).selectOption('widerspruechlich');
  ok.tabelleBewertet = await p.evaluate(([d, sid]) => {
    const si = STATE.dossiers.entitaeten[d].sichtungen.find(x => x.id === sid);
    const gespeichert = JSON.parse(localStorage.getItem(PROFIL_KEY)).daten[d].sichtungen.find(x => x.id === sid);
    return si.guete === 'widerspruechlich' && gespeichert.guete === si.guete && sichtungGuete(si) === si.guete &&
      sichtungGuete({ ...si, t: new Date(0).toISOString() }) === 'veraltet';
  }, [s.d, a.id]);
  await p.evaluate(sid => { VIEW.karte.reiter = 'karte'; dispatch({ type: 'NAVIGATION', modul: 'karte' }); setTimeout(() => karteWaehlen(sid, true), 0); }, a.id);
  await p.locator('#si-bewerten').selectOption('unbestaetigt');
  await p.locator('#si-bewerten').selectOption('widerspruechlich');
  ok.popupWiderspruchManuell = await p.evaluate(sid => karteMarker().some(m => m.id === sid && m.guete === 'widerspruechlich'), a.id);
  await p.evaluate(d => { dispatch({ type: 'NAVIGATION', modul: 'dossier' }); STATE.dossiers.auswahl = d; VIEW.dtab = 'sichtungen'; renderModule(); }, s.d);
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
  /* Gegenprobe 1: Pin und Dreieck dürfen nie beide fehlen (Sichtung älter als die letzten drei, Karte zeichnet nur diese) */
  const g1 = await p.evaluate(() => {
    dispatch({ type: 'DOSSIER_ANGELEGT', typ: 'Person', name: 'Dreierprobe', land: 'DE' }); const d = STATE.dossiers.auswahl;
    dispatch({ type: 'PIN_ANGELEGT', ll: [52.5, 13.4], name: 'Erster', dossier: d, notiz: '' }); const pin = PROFIL.pins[PROFIL.pins.length - 1];
    dispatch({ type: 'SICHTUNG_HINZU', id: d, ort: '52.5000, 13.4000', text: 'aus Entwurf', guete: 'unbewertet', pin: pin.id }); const si0 = STATE.dossiers.entitaeten[d].sichtungen[0].id;
    ['51.1, 10.1', '51.2, 10.2', '51.3, 10.3'].forEach(o => dispatch({ type: 'SICHTUNG_HINZU', id: d, ort: o, text: 'weitere', guete: 'unbewertet' }));
    const M = karteMarker(); return { pin: M.some(m => m.id === pin.id), si: M.some(m => m.id === si0) };
  });
  ok.pinOderDreieckImmerDa = g1.pin || g1.si; ok.dreieckBleibtBeiDreiWeiteren = g1.si === true && g1.pin === false;
  /* Gegenprobe 2: wiedervergebene Nummer darf einen fremden Pin weder ausblenden noch lösen */
  const g2 = await p.evaluate(() => {
    dispatch({ type: 'DOSSIER_ANGELEGT', typ: 'Person', name: 'Fremdpin', land: 'DE' }); const d1 = STATE.dossiers.auswahl;
    dispatch({ type: 'DOSSIER_ANGELEGT', typ: 'Person', name: 'Nummerngeber', land: 'DE' }); const d2 = STATE.dossiers.auswahl;
    Object.keys(STATE.dossiers.entitaeten).forEach(k => (STATE.dossiers.entitaeten[k].sichtungen || []).slice().forEach(x => dispatch({ type: 'SICHTUNG_ENTFERNT', id: k, sid: x.id })));
    dispatch({ type: 'PIN_ANGELEGT', ll: [50.5, 9.5], name: 'Fremd', dossier: d1, notiz: '' }); const pin = PROFIL.pins[PROFIL.pins.length - 1];
    pin.sichtung = 'SI-001';                                  /* veralteter Verweis, wie aus einer älteren Profilsicherung */
    dispatch({ type: 'SICHTUNG_HINZU', id: d2, ort: '49.0000, 8.0000', text: 'andere Akte', guete: 'unbewertet' }); const nr = STATE.dossiers.entitaeten[d2].sichtungen[0].id;
    const vorher = karteMarker().some(m => m.id === pin.id);
    dispatch({ type: 'SICHTUNG_ENTFERNT', id: d2, sid: nr });
    return { nr, vorher, nachher: karteMarker().some(m => m.id === pin.id), ref: pin.sichtung, d1 };
  });
  ok.fremdePinBleibtSichtbar = g2.nr === 'SI-001' && g2.vorher === true && g2.nachher === true;
  ok.fremderVerweisUnangetastet = g2.ref === 'SI-001';
  /* Gegenprobe 3: Wiederherstellung einer älteren Sicherung mit gleicher Nummer in zwei Akten vergibt neu und zieht den Pin-Verweis mit */
  const g3 = await p.evaluate(() => {
    dispatch({ type: 'DOSSIER_ANGELEGT', typ: 'Person', name: 'Rueck A', land: 'DE' }); const a = STATE.dossiers.auswahl;
    dispatch({ type: 'DOSSIER_ANGELEGT', typ: 'Person', name: 'Rueck B', land: 'DE' }); const b = STATE.dossiers.auswahl;
    [a, b].forEach(k => { STATE.dossiers.entitaeten[k].sichtungen = []; });
    dispatch({ type: 'PIN_ANGELEGT', ll: [50.1, 9.1], name: 'PA', dossier: a, notiz: '' }); const pa = PROFIL.pins[PROFIL.pins.length - 1];
    dispatch({ type: 'PIN_ANGELEGT', ll: [50.2, 9.2], name: 'PB', dossier: b, notiz: '' }); const pb = PROFIL.pins[PROFIL.pins.length - 1];
    pa.sichtung = 'SI-001'; pb.sichtung = 'SI-001';
    const mk = pin => ({ notizen: [], sichtungen: [{ id: 'SI-001', t: nowIso(), ort: '50.0000, 9.0000', text: 'alt', guete: 'unbewertet', quelle: 'Eintrag', pin }] });
    PROFIL.dossierDaten[a] = mk(pa.id); PROFIL.dossierDaten[b] = mk(pb.id);
    profilEinspielen(STATE);
    const sa = STATE.dossiers.entitaeten[a].sichtungen[0], sb = STATE.dossiers.entitaeten[b].sichtungen[0], M = karteMarker();
    return { ids: [sa.id, sb.id], verw: [pa.sichtung, pb.sichtung], gepaart: [pinSichtung(pa) === sa, pinSichtung(pb) === sb], pinsDa: M.some(m => m.id === pa.id) || M.some(m => m.id === sa.id) };
  });
  ok.wiederherstellungNummernEindeutig = g3.ids[0] !== g3.ids[1];
  ok.wiederherstellungPaarungErhalten = g3.gepaart[0] && g3.gepaart[1] && g3.verw[0] === g3.ids[0] && g3.verw[1] === g3.ids[1];
  ok.keineJsFehler = err.length === 0; if (err.length) console.log(err.slice(0, 4));
  const bad = Object.keys(ok).filter(k => ok[k] !== true); console.log(JSON.stringify(ok, null, 1)); console.log(bad.length ? 'FAIL: ' + bad.join(', ') : 'alle grün');
  await b.close(); process.exit(bad.length ? 1 : 0);
})();
