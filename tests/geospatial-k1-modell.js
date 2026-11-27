/* K1b-1: Modellidentitäten und Zugangsfilter in der echten Anwendung.
   Doppelte SI-Nummern als synthetischer importierter Altbestand; keine Änderung persistenter Kennungen. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { APP } = require('./_pfad');
(async () => {
  const b = await chromium.launch();
  try {
    const p = await b.newPage({ viewport: { width: 1500, height: 1100 }, reducedMotion: 'reduce' });
    const errors = [];
    p.on('pageerror', e => errors.push(e.message));
    await p.route(/^https?:/, r => r.abort());
    await p.goto(APP);
    await p.fill('#gate-pw', 'pw-test-123');
    if (await p.isVisible('#gate-pw2')) await p.fill('#gate-pw2', 'pw-test-123');
    await p.click('#gate-go');
    await p.waitForFunction(() => !document.body.classList.contains('locked'));
    const f = await p.evaluate(() => {
      dispatch({ type: 'DOSSIER_ANGELEGT', typ: 'Person', name: 'K1b Nord' }); const a = STATE.dossiers.auswahl;
      dispatch({ type: 'DOSSIER_ANGELEGT', typ: 'Person', name: 'K1b Sued' }); const b = STATE.dossiers.auswahl;
      dispatch({ type: 'SICHTUNG_HINZU', id: a, ort: '52.5000, 13.4000', text: 'Nord' });
      dispatch({ type: 'SICHTUNG_HINZU', id: b, ort: '52.5100, 13.4100', text: 'Sued' });
      const si = STATE.dossiers.entitaeten[a].sichtungen.at(-1).id;
      STATE.dossiers.entitaeten[b].sichtungen.at(-1).id = si;
      dispatch({ type: 'PIN_ANGELEGT', ll: [52.5, 13.4], name: 'K1b Pin', dossier: a });
      const pin = PROFIL.pins.at(-1).id;
      dispatch({ type: 'OZONE_ANGELEGT', ll: [52.51, 13.41] });
      const zone = PROFIL.zonen.at(-1).id;
      dispatch({ type: 'OZONE_GEAENDERT', id: zone, dossier: a });
      dispatch({ type: 'NAVIGATION', modul: 'karte' });
      const K = VIEW.karte; K.reiter = 'karte'; K.lat = 52.5; K.lon = 13.4; K.zoom = 14;
      K.ebenen.sichtungen = true; K.ebenen.pins = true; K.ebenen.zonen = true;
      renderModule();
      return { a, b, si, pin, zone };
    });
    const snapshot = () => p.evaluate(f => {
      const m = karteRenderModell(), d = karte3dDaten();
      const si = m.marker.filter(x => x.kat === 'sichtung' && x.id === f.si && (x.entId === f.a || x.entId === f.b));
      const key = x => [x.id, x.renderKey];
      return {
        si: si.map(x => [x.entId, x.id, x.renderKey, x.ll]),
        frame: d.marker.filter(x => x.kat === 'sichtung' && x.id === f.si).map(key),
        pin: m.marker.filter(x => x.id === f.pin).map(key), zone: m.zonen.filter(x => x.id === f.zone).map(key),
        framePin: d.marker.filter(x => x.id === f.pin).map(key), frameZone: d.zonen.filter(x => x.id === f.zone).map(key)
      };
    }, f);
    const vor = await snapshot();
    assert.equal(vor.si.length, 2);
    assert.equal(new Set(vor.si.map(x => x[2])).size, 2, 'SI-Nummer ist nicht die Rendereridentität');
    assert.deepEqual(vor.si.map(x => x[2]).sort(), vor.frame.map(x => x[1]).sort());
    assert.equal(vor.pin.length, 1); assert.equal(vor.zone.length, 1);
    assert.deepEqual(vor.pin, vor.framePin); assert.deepEqual(vor.zone, vor.frameZone);
    const schluessel = vor.si.find(x => x[0] === f.a)[2], zweiter = vor.si.find(x => x[0] === f.b)[2];
    const paneel=await p.evaluate(({f,schluessel,zweiter})=>{
      const m=karteRenderModell();
      return {
        mehrdeutig:kartePanelObjekt(f.si,null,m),
        nord:kartePanelObjekt(f.si,schluessel,m)?.objekt.entId,
        sued:kartePanelObjekt(f.si,zweiter,m)?.objekt.entId,
        veraltet:kartePanelObjekt(f.si,'missing',m),
        pin:karteBezugModell(f.pin,null,m)?.filter,
        zone:karteBezugModell(f.zone,null,m)?.filter,
        ausgeblendet:kartePanelObjekt(f.pin,null,{...m,marker:m.marker.filter(x=>x.id!==f.pin)})
      };
    },{f,schluessel,zweiter});
    assert.deepEqual(paneel,{mehrdeutig:null,nord:f.a,sued:f.b,veraltet:null,pin:true,zone:true,ausgeblendet:null});
    const svgTreffer = await p.evaluate(f => [...document.querySelectorAll('.k-marker')].filter(g => g.getAttribute('data-id') === f.si).map(g => g.getAttribute('data-render-key')), f);
    assert.deepEqual(svgTreffer.sort(), [schluessel, zweiter].sort(), 'beide SVG-Objekte einzeln gezeichnet');
    await p.evaluate(key => {
      const g = [...document.querySelectorAll('.k-marker')].find(x => x.getAttribute('data-render-key') === key);
      g.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    }, zweiter);
    assert.match(await p.locator('#k-auswahl').innerText(), /K1b Sued/);
    assert.equal(await p.evaluate(() => karte3dDaten().auswahlRenderKey), zweiter);
    await p.evaluate(({si, key}) => karte3dEingang({typ: 'karte3d-klick', id: si, renderKey: key, lat: 52.5, lon: 13.4}), {si: f.si, key: schluessel});
    assert.match(await p.locator('#k-auswahl').innerText(), /K1b Nord/);
    assert.equal(await p.evaluate(() => karte3dDaten().auswahlRenderKey), schluessel);
    await p.locator('#si-bewerten').selectOption('plausibel');
    assert.deepEqual(await p.evaluate(f => [STATE.dossiers.entitaeten[f.a].sichtungen.at(-1).guete, STATE.dossiers.entitaeten[f.b].sichtungen.at(-1).guete], f), ['plausibel','unbewertet']);
    const getrennt = await p.evaluate(f => {
      const m = karteRenderModell().marker.find(x => x.id === f.pin);
      const vorher = PROFIL.pins.find(x => x.id === f.pin).ll[0];
      m.ll[0] = 0;
      return PROFIL.pins.find(x => x.id === f.pin).ll[0] === vorher;
    }, f);
    assert.equal(getrennt, true, 'Zeichenkoordinaten verändern Profil nicht');
    await p.evaluate(id => dispatch({ type: 'DOSSIER_SPERREN', id }), f.a);
    const gesperrt = await snapshot();
    assert.equal(await p.evaluate(() => karte3dDaten().auswahlRenderKey), null, 'gesperrte Auswahl darf nicht auf gleiche SI-Nummer springen');
    assert.equal(await p.locator('#k-auswahl').isVisible(), false);
    await p.evaluate(({si,key}) => karte3dEingang({typ:'karte3d-klick',id:si,renderKey:key,lat:52.5,lon:13.4}), {si:f.si,key:schluessel});
    assert.equal(await p.locator('#k-auswahl').isVisible(), false, 'veraltete 3D-Nachricht bleibt wirkungslos');
    assert.deepEqual(gesperrt.si, vor.si.filter(x => x[0] === f.b));
    assert.deepEqual(gesperrt.frame, vor.frame.filter(x => x[1] === gesperrt.si[0][2]));
    assert.deepEqual(gesperrt.pin, []); assert.deepEqual(gesperrt.framePin, []);
    assert.deepEqual(gesperrt.zone, []); assert.deepEqual(gesperrt.frameZone, []);
    await p.evaluate(id => dispatch({ type: 'DOSSIER_ENTSPERREN', id }), f.a);
    assert.deepEqual(await snapshot(), vor, 'Identität bleibt nach Entsperrung stabil');
    /* Gezielter Sprung zeigt nur die richtige Sichtung auch bei deaktivierter Ebene. */
    const spr = await p.evaluate(f => {
      VIEW.karte.ebenen.sichtungen = false;
      const ok = karteSichtungZeigen(f.b, f.si, 14);
      return {ok, sicht: karteMarker().filter(x => x.kat === 'sichtung').map(x => x.entId), key: karte3dDaten().auswahlRenderKey};
    }, f);
    assert.deepEqual(spr, {ok:true, sicht:[f.b], key:zweiter});
    assert.match(await p.locator('#k-auswahl').innerText(), /K1b Sued/);
    await p.evaluate(f => {
      VIEW.karte.ebenen.sichtungen = true;
      dispatch({type:'NAVIGATION',modul:'dossier'}); STATE.dossiers.auswahl=f.a; renderModule();
    }, f);
    await p.locator('#btn-dk-sichtung').click();
    assert.equal(await p.evaluate(() => karte3dDaten().auswahlRenderKey), schluessel);
    assert.match(await p.locator('#k-auswahl').innerText(), /K1b Nord/);
    /* Zwei gleiche SI-Nummern innerhalb desselben Dossiers sind nicht eindeutig.
       Der echte Dossierknopf muss sichtbar scheitern, statt ein anderes Objekt auszuwählen. */
    await p.evaluate(f => {
      const l = STATE.dossiers.entitaeten[f.a].sichtungen;
      l.push(Object.assign({}, l.at(-1), { ort: '52.6000, 13.5000' }));
      dispatch({type:'NAVIGATION',modul:'dossier'}); STATE.dossiers.auswahl=f.a; renderModule();
      meldung('');
    }, f);
    await p.locator('#btn-dk-sichtung').click();
    assert.match(await p.locator('#sys-msg').innerText(), /Sichtung ist nicht eindeutig oder nicht zugänglich/);
    assert.equal(await p.evaluate(() => STATE.ui.modul), 'dossier');
    await p.evaluate(f => { STATE.dossiers.entitaeten[f.a].sichtungen.pop(); }, f);
    await p.locator('#btn-dk-sichtung').click();
    assert.equal(await p.evaluate(() => karte3dDaten().auswahlRenderKey), schluessel);
    const fallTerminal = await p.evaluate(f => {
      const px = PROFIL.pins.find(x => x.id === f.pin), si = STATE.dossiers.entitaeten[f.a].sichtungen.at(-1);
      si.pin = px.id; px.sichtung = si.id;
      const t = terminalPinZeigen(px), tk = karte3dDaten().auswahlRenderKey;
      xSichtungsZiel(si, px); const fk = karte3dDaten().auswahlRenderKey;
      dispatch({type:'DOSSIER_SPERREN',id:f.a});
      const block = karteSichtungZeigen(f.a,f.si,14);
      return {t,tk,fk,block};
    },f);
    assert.deepEqual(fallTerminal,{t:true,tk:schluessel,fk:schluessel,block:false});
    assert.deepEqual(errors, []);
    console.log('OK: gemeinsames Kartenmodell, typisierte SI-Identitäten, Koordinatenkopie und Sperrstand');
  } finally { await b.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
