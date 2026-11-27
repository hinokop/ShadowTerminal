'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {APP}=require('./_pfad');
// Mercator-Projektion und Rückprojektion beim Neigungswechsel verursachen
// Rundungsreste. 1e-9 Grad (< 0,12 mm) toleriert nur numerisches Rauschen;
// Zoom, Neigung, Drehung und beide Mittelpunktkoordinaten bleiben geprüft.
function assertCamera(actual,expected){
 const {center:a,...restA}=actual,{center:e,...restE}=expected;
 // Numerische Gleichheit statt Object.is: +0 und -0 sind dieselbe Kamera.
 // Alle drei Parameter bleiben exakt und müssen endlich sein.
 assert.deepEqual(Object.keys(restA).sort(),Object.keys(restE).sort(),'Kameraeigenschaften');
 for(const k of ['zoom','pitch','bearing']){
  assert.ok(Number.isFinite(restA[k])&&Number.isFinite(restE[k])&&restA[k]===restE[k],
   'Kamera '+k+': '+restA[k]+' statt '+restE[k]);
 }
 assert.equal(a.length,2);assert.equal(e.length,2);
 for(let i=0;i<2;i++){
  assert.ok(Number.isFinite(a[i])&&Number.isFinite(e[i])&&Math.abs(a[i]-e[i])<=1e-9,
   'Kameramittelpunkt Achse '+i+': '+a[i]+' statt '+e[i]);
 }
}

// Selbstprüfung der Vergleichsfunktion: nur numerisch identische Nullwerte akzeptieren.
{
 const cam={center:[13.4,52.5],zoom:14.25,pitch:0,bearing:0};
 assertCamera({...cam,bearing:-0},cam);
 for(const k of ['zoom','pitch','bearing']){
  assert.throws(()=>assertCamera({...cam,[k]:cam[k]+0.001},cam),assert.AssertionError);
  assert.throws(()=>assertCamera({...cam,[k]:NaN},cam),assert.AssertionError);
 }
 assert.throws(()=>assertCamera({...cam,center:[13.4000001,52.5]},cam),assert.AssertionError);
}

(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
 try{
  const p=await b.newPage({viewport:{width:1500,height:1100},reducedMotion:'reduce'});p.setDefaultTimeout(25000);
  const errors=[],anfragen=[],bildAnfragen=[],wetterAnfragen=[];let netz='ok',einzelFehler=0,bildFehler=false,berlinFehler=false;p.on('pageerror',e=>errors.push(e.message));
  const Q=require('../karte-v2-quellen');
  const tile='https://tiles.basemaps.cartocdn.com/v/fixture/vectortiles/test/{z}/{x}/{y}.mvt';
  // Leere, aber gültige MVT-Layer (Name buildings, Version 2, Extent 4096).
  const layer=Buffer.concat([Buffer.from([10,9]),Buffer.from('buildings'),Buffer.from([120,2,40,128,32])]);
  const mvt=Buffer.concat([Buffer.from([26,layer.length]),layer]);
  const stil={version:8,sources:{protomaps:{type:'vector',tiles:[tile],maxzoom:15,attribution:'© CARTO'}},layers:[
    {id:'bg',type:'background',paint:{'background-color':'#304050'}},
    {id:'buildings',source:'protomaps','source-layer':'buildings',type:'fill',paint:{'fill-color':'#888'}},
    {id:'roads',source:'protomaps','source-layer':'roads',type:'line',paint:{'line-color':'#555','line-width':2}}
  ]};
  const route=async r=>{
    const u=new URL(r.request().url()),bare=u.origin+u.pathname;
    if(u.hostname==='api.open-meteo.com'){
      wetterAnfragen.push({lat:u.searchParams.get('latitude'),lon:u.searchParams.get('longitude')});
      return r.fulfill({json:{current:{temperature_2m:12,precipitation:0,weather_code:3,cloud_cover:80,wind_speed_10m:5,wind_direction_10m:90,wind_gusts_10m:6,visibility:20000,time:'2026-11-27T12:00'}},headers:{'access-control-allow-origin':'*'}});
    }
    if(['gdi.berlin.de','isk.geobasis-bb.de','geo4.service24.rlp.de','www.wms.nrw.de','tiles.maps.eox.at'].includes(u.hostname)){
      bildAnfragen.push({url:u.href,referer:r.request().headers().referer||''});
      if(bildFehler||(berlinFehler&&u.hostname==='gdi.berlin.de'))return r.fulfill({status:500,body:'fixture',headers:{'access-control-allow-origin':'*'}});
      return r.fulfill({body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAQAAAAEAAQMAAABmvDolAAAABlBMVEU/fFsAAABwZYnaAAAAH0lEQVR42u3BAQ0AAADCoPdPbQ43oAAAAAAAAAAAvg0hAAABYOSdlwAAAABJRU5ErkJggg==','base64'),contentType:'image/png',headers:{'access-control-allow-origin':'*','cache-control':'no-store'}});
    }
    if(bare===Q.stil('voyager')||bare===Q.stil('dunkel')){
      anfragen.push({art:'stil',key:u.searchParams.get('key'),referer:r.request().headers().referer||''});
      if(netz==='stilfehler')return r.abort();
      return r.fulfill({json:stil,headers:{'access-control-allow-origin':'*'}});
    }
    if(u.hostname==='tiles.basemaps.cartocdn.com'&&u.pathname.startsWith('/v/fixture/')){
      anfragen.push({art:'tile',key:u.searchParams.get('key'),referer:r.request().headers().referer||''});
      if(netz==='kachelfehler')return r.abort();
      if(netz==='einzelfehler'&&einzelFehler===0){einzelFehler++;return r.fulfill({status:500,body:'fixture',headers:{'access-control-allow-origin':'*'}});}
      return r.fulfill({body:mvt,contentType:'application/vnd.mapbox-vector-tile',headers:{'access-control-allow-origin':'*'}});
    }
    return r.abort();
  };
  await p.route(/^https?:/,route);
  await p.goto(APP+'?geospatial-v2=1');
  await p.fill('#gate-pw','pw-test-123');if(await p.isVisible('#gate-pw2'))await p.fill('#gate-pw2','pw-test-123');await p.click('#gate-go');
  await p.waitForFunction(()=>!document.body.classList.contains('locked'));
  const f=await p.evaluate(()=>{
   dispatch({type:'DOSSIER_ANGELEGT',typ:'Person',name:'K2 Nord'});const a=STATE.dossiers.auswahl;
   dispatch({type:'DOSSIER_ANGELEGT',typ:'Person',name:'K2 Sued'});const b=STATE.dossiers.auswahl;
   dispatch({type:'SICHTUNG_HINZU',id:a,ort:'52.5000, 13.4000',text:'Nord'});
   dispatch({type:'SICHTUNG_HINZU',id:b,ort:'52.5100, 13.4100',text:'Sued'});
   const si=STATE.dossiers.entitaeten[a].sichtungen.at(-1).id;
   STATE.dossiers.entitaeten[b].sichtungen.at(-1).id=si;
   dispatch({type:'PIN_ANGELEGT',ll:[52.505,13.395],name:'K2 Pin',dossier:a});const pin=PROFIL.pins.at(-1).id;
   dispatch({type:'OZONE_ANGELEGT',ll:[52.505,13.415]});const zone=PROFIL.zonen.at(-1).id;
   dispatch({type:'OZONE_GEAENDERT',id:zone,dossier:a});
   dispatch({type:'NAVIGATION',modul:'karte'});
   Object.assign(VIEW.karte,{reiter:'karte',lat:52.505,lon:13.405,zoom:14,ansicht3d:false,auswahl:null});
   Object.assign(VIEW.karte.ebenen,{kacheln:false,sichtungen:true,zonen:true,pins:true});renderModule();
   return {a,b,si,pin,zone};
  });
  const ready=()=>p.waitForFunction(()=>$('k-v2-leer')?.getAttribute('aria-pressed')==='true'&&/Objektlayer bereit|Ohne Basiskarte|Kein lokaler CARTO-Schlüssel/.test($('k-v2-status')?.textContent||'')&&KARTE_V2_DEV.adapter()?.ready());
  const startKey=await p.evaluate(()=>VIEW.karte.cartoKey);
  if(startKey){
    await p.waitForFunction(()=>$('k-v2-status')?.textContent.includes('Voyager bereit'));
    assert.equal(await p.locator('#k-v2-voyager').getAttribute('aria-pressed'),'true');
    assert.ok(anfragen.some(x=>x.art==='tile'&&x.key===startKey),'Voyager lädt beim Erststart');
    await p.click('#k-v2-leer');
  }
  await ready();
  assert.equal(await p.locator('#k-v2-dunkel').count(),0,'Shadow ersetzt Dark Matter');
  assert.ok(await p.locator('#k-svg').isVisible(),'SVG bleibt vorhanden');
  assert.equal(bildAnfragen.length,0,'keine Bildanfrage vor expliziter Wahl');
  const key=(...x)=>JSON.stringify(x), ka=key('sichtung',f.a,f.si),kb=key('sichtung',f.b,f.si);
  const hit=ll=>p.evaluate(ll=>{const a=KARTE_V2_DEV.adapter();return a.hitTest(a.project(ll));},ll);
  assert.equal((await hit([52.5,13.4])).renderKey,ka);assert.equal((await hit([52.51,13.41])).renderKey,kb);
  assert.equal((await hit([52.505,13.415])).id,f.zone);
  const click=async ll=>{
   await p.locator('#k-v2-map').scrollIntoViewIfNeeded();
   const pt=await p.evaluate(ll=>{const a=KARTE_V2_DEV.adapter(),q=a.project(ll),r=$('k-v2-map').getBoundingClientRect();return [r.left+q.x,r.top+q.y];},ll);
   await p.mouse.click(pt[0],pt[1]);
  };
  await click([52.51,13.41]);assert.equal(await p.evaluate(()=>karteAuswahlSchluessel()),kb);
  assert.match(await p.locator('#k-auswahl').innerText(),/K2 Sued/);
  assert.equal(await p.locator('#k-v2-paneele #k-auswahl').count(),1);
  assert.equal(await p.locator('#k-v2-paneele #k-status').count(),1);
  assert.equal(await p.locator('#k-auswahl').count(),1);
  assert.equal(await p.locator('#k-status').count(),1);
  assert.match(await p.locator('#k-st-objekt').innerText(),/K2 Sued/);
  assert.equal(await p.evaluate(({si})=>kartePanelObjekt(si,null),f),null,'duplicate ID without typed key');
  await click([52.505,13.395]);
  assert.match(await p.locator('#k-auswahl').innerText(),/K2 Pin/);
  assert.ok(await p.locator('#pin-export').isVisible());
  assert.ok(await p.locator('#k-st-protokoll').isVisible());
  await click([52.505,13.415]);
  assert.ok(await p.locator('#oz-name').isVisible());
  assert.ok(await p.locator('#oz-protokoll').isVisible());
  await click([52.51,13.41]);
  assert.match(await p.locator('#k-st-objekt').innerText(),/K2 Sued/);
  // K3e: collapsing the inspector is not deselection or a new weather query.
  const vorKlapp=[anfragen.length,bildAnfragen.length,wetterAnfragen.length];
  const klapp=p.locator('#k-v2-inspektor-klapp'), body=p.locator('#k-v2-inspektor-body');
  assert.equal(await klapp.getAttribute('aria-expanded'),'true');
  await klapp.click();
  assert.equal(await body.isVisible(),false);
  assert.equal(await klapp.getAttribute('aria-expanded'),'false');
  assert.equal(await p.evaluate(()=>karteAuswahlSchluessel()),kb);
  await p.evaluate(()=>karteAuswahlAnzeige());
  assert.equal(await body.isVisible(),false,'same selection retains collapse');
  await klapp.click();
  assert.equal(await body.isVisible(),true);
  assert.equal(await klapp.getAttribute('aria-expanded'),'true');
  assert.deepEqual([anfragen.length,bildAnfragen.length,wetterAnfragen.length],vorKlapp);
  // A different selection opens its own inspector.
  await klapp.click();
  await click([52.505,13.395]);
  assert.equal(await body.isVisible(),true);
  assert.equal(await klapp.getAttribute('aria-expanded'),'true');
  assert.equal(await p.evaluate(()=>VIEW.karte.auswahl),f.pin,'new pin selected');
  // The pin name is in the inspector header and the input value, not body.innerText().
  assert.equal(await p.locator('#k-auswahl .k-pop-kopf strong').innerText(),'K2 Pin');
  assert.equal(await body.locator('#pin-name').inputValue(),'K2 Pin');
  await click([52.51,13.41]);
  // K3c-1: the legend is a real filter control, not a second data store.
  assert.equal(await p.locator('#k-v2-legendenliste input').count(),8);
  assert.ok(await p.locator('#k-v2-kamera').innerText().then(s=>s.includes('Zoom')));
  assert.equal(await p.locator('#k-v2-map .maplibregl-ctrl-scale').count(),1);
  await p.locator('#k-v2-legende summary').click();
  assert.equal(await p.locator('#k-v2-legendenliste canvas[data-symbol]').count(),6);
  assert.equal(await p.evaluate(()=>{
    const canvases=[...document.querySelectorAll('#k-v2-legendenliste canvas[data-symbol]')];
    return canvases.every(c=>{
      const b=KARTE_V2_RENDERER.symbolBild(c.dataset.symbol),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
      return c.width===b.width&&c.height===b.height&&d.every((v,i)=>i%4===3||b.data[i-i%4+3]===255?v===b.data[i]:true);
    });
  }),true,'Legende nutzt dieselbe Silhouette und opake Farbe wie Renderer');
  const legendCam=await p.evaluate(()=>{window.__legendenAdapter=KARTE_V2_DEV.adapter();return __legendenAdapter.camera();});
  const legendVorNetz=[anfragen.length,bildAnfragen.length,wetterAnfragen.length];
  await p.uncheck('#k-v2-eb-pins');
  await p.waitForFunction(ll=>{const a=KARTE_V2_DEV.adapter();return a?.ready()&&a.hitTest(a.project(ll))===null;},[52.505,13.395]);
  assert.equal(await p.evaluate(()=>VIEW.karte.ebenen.pins),false);
  await p.check('#k-v2-eb-pins');
  await p.waitForFunction(({ll,id})=>{const a=KARTE_V2_DEV.adapter();return a?.hitTest(a.project(ll))?.id===id;},{ll:[52.505,13.395],id:f.pin});
  await p.uncheck('#k-v2-eb-sichtungen');
  await p.waitForFunction(ll=>{const a=KARTE_V2_DEV.adapter();return a?.hitTest(a.project(ll))===null;},[52.51,13.41]);
  assert.equal(await p.locator('#k-auswahl').isVisible(),false);
  assert.ok(!(await p.locator('#k-status').innerText()).includes('K2 Sued'));
  await p.check('#k-v2-eb-sichtungen');
  await p.waitForFunction(({ll,key})=>{const a=KARTE_V2_DEV.adapter();return a?.hitTest(a.project(ll))?.renderKey===key;},{ll:[52.51,13.41],key:kb});
  assert.equal(await p.evaluate(()=>__legendenAdapter===KARTE_V2_DEV.adapter()),true);
  assertCamera(await p.evaluate(()=>KARTE_V2_DEV.adapter().camera()),legendCam);
  assert.deepEqual([anfragen.length,bildAnfragen.length,wetterAnfragen.length],legendVorNetz);
  await p.locator('#k-v2-legende summary').click();
  await click([52.51,13.41]);
  // K3c-2: enlarge the same MapLibre instance, retain camera and selection.
  const layoutVor=await p.evaluate(()=>{window.__layoutAdapter=KARTE_V2_DEV.adapter();return {cam:__layoutAdapter.camera(),h:$('k-v2-map').clientHeight};});
  const layoutNetz=[anfragen.length,bildAnfragen.length,wetterAnfragen.length];
  await p.click('#k-v2-voll');
  assert.equal(await p.locator('#k-v2-voll').getAttribute('aria-pressed'),'true');
  assert.ok(await p.evaluate(h=>$('k-v2-map').clientHeight>h,layoutVor.h));
  assert.equal(await p.evaluate(()=>__layoutAdapter===KARTE_V2_DEV.adapter()),true);
  assertCamera(await p.evaluate(()=>KARTE_V2_DEV.adapter().camera()),layoutVor.cam);
  assert.equal(await p.evaluate(()=>karteAuswahlSchluessel()),kb);
  assert.equal(await p.locator('#k-v2-paneele #k-status').count(),1);
  // Actual layout at small viewport, then restore before camera comparisons.
  await p.setViewportSize({width:800,height:600});
  await p.waitForFunction(()=>Math.abs($('k-v2-panel').getBoundingClientRect().width-innerWidth)<=2);
  assert.ok(await p.locator('#k-v2-voll').isVisible());
  assert.ok(await p.evaluate(()=>{const a=$('k-v2-map').getBoundingClientRect(),b=$('k-v2-panel').getBoundingClientRect();return a.left>=b.left-1&&a.right<=b.right+1;}),'Karte bleibt im Vollbildrahmen');
  await p.setViewportSize({width:1500,height:1100});
  await p.locator('#k-v2-voll').focus();await p.keyboard.press('Escape');
  assert.equal(await p.locator('#k-v2-voll').getAttribute('aria-pressed'),'false');
  assert.equal(await p.evaluate(()=>__layoutAdapter===KARTE_V2_DEV.adapter()),true);
  assertCamera(await p.evaluate(()=>KARTE_V2_DEV.adapter().camera()),layoutVor.cam);
  assert.deepEqual([anfragen.length,bildAnfragen.length,wetterAnfragen.length],layoutNetz);
  const status=text=>p.waitForFunction(text=>$('k-v2-status')?.textContent.includes(text),text);
  const stilAbrufe=()=>anfragen.filter(x=>x.art==='stil').length;
  const fixtureKey='K2C_FIXTURE+/k';
  // Frisches Browserprofil: die echte Datei-Quelle wird schon beim Appstart aufgelöst.
  const dateiKey=await p.evaluate(()=>window.KARTEN_SCHLUESSEL?.carto?.trim()||'');
  if(process.env.CI)assert.ok(dateiKey,'CI-Datei-Fixture fehlt');
  if(dateiKey){
    assert.ok(await p.evaluate(()=>VIEW.karte.cartoKey===window.KARTEN_SCHLUESSEL.carto.trim()));
    assert.ok(await p.evaluate(()=>!JSON.parse(localStorage.getItem(STORAGE_KEY+'.kartenwahl')||'{}').cartoKey));
    await p.click('#k-v2-voyager');await status('Voyager bereit');
    assert.ok(anfragen.length>0&&anfragen.every(x=>x.key===dateiKey&&!x.referer),'Dateiquelle und Referrer');
    await p.click('#k-v2-leer');await status('Ohne Basiskarte');
    anfragen.length=0;
  }
  await p.evaluate(()=>{window.KARTEN_SCHLUESSEL={carto:''};VIEW.karte.cartoKey='';VIEW.karte.anbieter='carto';renderModule();});
  await ready();
  const ohne=anfragen.length;await p.click('#k-v2-voyager');await status('Kein lokaler CARTO-Schlüssel');
  assert.equal(anfragen.length,ohne);
  await p.click('#k-v2-hybrid');await status('Kein lokaler CARTO-Schlüssel');await status('Bildkacheln geladen');
  assert.equal(anfragen.length,ohne,'Hybrid ohne Key nur Luftbild');
  await p.click('#k-v2-leer');await status('Ohne Basiskarte');
  // Tatsächliches bestehendes Eingabefeld, Datei leer, keine neue V2-Persistenz.
  await p.locator('#k-carto-key').evaluate(el=>{el.closest('details').open=true;});
  await p.fill('#k-carto-key',fixtureKey);await p.locator('#k-carto-key').blur();
  await p.evaluate(()=>{VIEW.karte.ebenen.kacheln=false;VIEW.karte.messen=true;VIEW.karte.messPts=[[52.51,13.41]];karteRendererDatenAktualisieren();});
  await ready();
  assert.ok(await p.evaluate(k=>VIEW.karte.cartoKey===k&&!window.KARTEN_SCHLUESSEL.carto,fixtureKey));
  assert.ok(await p.evaluate(k=>JSON.parse(localStorage.getItem(STORAGE_KEY+'.kartenwahl')).cartoKey===k,fixtureKey));
  // Eine widersprechende Datei darf den bereits aufgelösten Browser-Key nicht übersteuern.
  await p.evaluate(()=>{window.KARTEN_SCHLUESSEL={carto:'K2C_OTHER_FILE'};});
  const cam=await p.evaluate(()=>KARTE_V2_DEV.adapter().camera());
  await p.click('#k-v2-voyager');await status('Voyager bereit');
  assert.ok(anfragen.some(x=>x.art==='tile'),'echter Vektorabruf über Fixture');
  assert.equal((await hit([52.51,13.41])).renderKey,kb);
  assert.equal(await p.evaluate(()=>karteAuswahlSchluessel()),kb);
  assert.deepEqual(await p.evaluate(()=>VIEW.karte.messPts),[[52.51,13.41]]);
  assert.equal(await p.locator('#k-v2-gebaeude').isEnabled(),true);
  assert.equal(await p.locator('#k-v2-gebaeude').getAttribute('aria-pressed'),'false');
  await p.click('#k-v2-gebaeude');
  assert.equal(await p.locator('#k-v2-gebaeude').getAttribute('aria-pressed'),'true');
  await p.click('#k-v2-geneigt');
  await p.waitForFunction(()=>Math.abs(KARTE_V2_DEV.adapter().camera().pitch-60)<0.001);
  assert.equal((await p.evaluate(()=>KARTE_V2_DEV.adapter().camera())).zoom,cam.zoom);
  await p.click('#k-v2-flach');
  await p.waitForFunction(()=>KARTE_V2_DEV.adapter().camera().pitch===0&&KARTE_V2_DEV.adapter().camera().bearing===0);
  assert.equal(await p.locator('#k-v2-gebaeude').getAttribute('aria-pressed'),'true','unabhängig von Neigung');
  await p.click('#k-v2-shadow');await status('Shadow bereit');
  assert.equal(await p.locator('#k-v2-gebaeude').getAttribute('aria-pressed'),'true','Gebäudewunsch über Stilwechsel');
  assert.equal(await p.locator('#k-v2-shadow').getAttribute('aria-pressed'),'true');
  assert.equal(await p.locator('#k-v2-gebaeude').getAttribute('aria-pressed'),'true');
  assertCamera(await p.evaluate(()=>KARTE_V2_DEV.adapter().camera()),cam);
  assert.equal((await hit([52.51,13.41])).renderKey,kb);
  assert.equal(await p.evaluate(()=>karteAuswahlSchluessel()),kb);
  assert.deepEqual(await p.evaluate(()=>VIEW.karte.messPts),[[52.51,13.41]]);
  await p.click('#k-v2-voyager');await status('Voyager bereit');
  await p.click('#k-v2-gebaeude');
  assert.equal(await p.locator('#k-v2-gebaeude').getAttribute('aria-pressed'),'false');
  assertCamera(await p.evaluate(()=>KARTE_V2_DEV.adapter().camera()),cam);
  assert.equal((await hit([52.51,13.41])).renderKey,kb);
  assert.ok(anfragen.every(x=>x.key===fixtureKey&&!x.referer),'Schlüssel und Referrer');
  assert.ok(!(await p.locator('body').innerText()).includes(fixtureKey));
  assert.equal(await p.evaluate(k=>Object.keys(localStorage).some(n=>n!==STORAGE_KEY+'.kartenwahl'&&localStorage.getItem(n).includes(k)),fixtureKey),false,'keine zusätzliche Schlüsselpersistenz');
  // ready() bedeutet Layer installiert, nicht GeoJSON-Worker fertig.
  // Auf einen tatsächlich gerenderten Treffer warten, nicht nur auf Registrierung.
  const rueckfallTreffer=async()=>{
    await p.waitForFunction(({ll,k})=>{
      const a=KARTE_V2_DEV.adapter();
      return a?.ready()&&a.hitTest(a.project(ll))?.renderKey===k;
    },{ll:[52.51,13.41],k:kb});
    assert.equal((await hit([52.51,13.41]))?.renderKey,kb);
    assertCamera(await p.evaluate(()=>KARTE_V2_DEV.adapter().camera()),cam);
    assert.equal(await p.evaluate(()=>karteAuswahlSchluessel()),kb);
    assert.deepEqual(await p.evaluate(()=>VIEW.karte.messPts),[[52.51,13.41]]);
    assert.equal(await p.locator('#k-v2-leer').getAttribute('aria-pressed'),'true');
    assert.equal(await p.locator('#k-v2-gebaeude').isDisabled(),true);
  };
  // Teilstörung beim Stilstart: eine echte HTTP-500-Kachel, übrige gültig.
  netz='einzelfehler';await p.click('#k-v2-voyager');await status('Voyager bereit');
  await status('Einzelne Kacheln nicht verfügbar');
  assert.equal(einzelFehler,1);assert.equal(await p.locator('#k-v2-voyager').getAttribute('aria-pressed'),'true');
  await p.waitForFunction(k=>{const a=KARTE_V2_DEV.adapter();return a?.ready()&&a.hitTest(a.project([52.51,13.41]))?.renderKey===k;},kb);
  assertCamera(await p.evaluate(()=>KARTE_V2_DEV.adapter().camera()),cam);
  netz='stilfehler';await p.click('#k-v2-shadow');await status('CARTO-Stil nicht verfügbar');
  await rueckfallTreffer();
  netz='kachelfehler';await p.click('#k-v2-shadow');await status('CARTO-Ressource nicht verfügbar');
  await rueckfallTreffer();
  // Amtliches Luftbild in der echten Anwendungsansicht: kein CARTO-Abruf,
  // lokale Objekte, Kamera und Messung erhalten; kein automatischer Providerwechsel.
  netz='ok';
  const vorBild=anfragen.length, vorherBild=bildAnfragen.length;
  assert.equal(await p.locator('#k-v2-luftbild').innerText(),'Luftbild');
  assert.equal(await p.locator('#k-v2-berlin2024').count(),0);
  assert.equal(await p.locator('#k-v2-bildwahl').isVisible(),false);
  await p.click('#k-v2-luftbild');
  try{await status('Bildkacheln geladen');}
  catch(e){throw Error('Anwendungs-Luftbild: '+await p.locator('#k-v2-status').innerText()+'; WMS-Anfragen: '+bildAnfragen.length,{cause:e});}
  assert.ok(bildAnfragen.length>vorherBild);assert.equal(anfragen.length,vorBild,'kein CARTO-Abruf bei Bildwahl');
  assert.equal(await p.locator('#k-v2-gebaeude').isDisabled(),true);
  assertCamera(await p.evaluate(()=>KARTE_V2_DEV.adapter().camera()),cam);
  await p.waitForFunction(k=>{const a=KARTE_V2_DEV.adapter();return a?.ready()&&a.hitTest(a.project([52.51,13.41]))?.renderKey===k;},kb);
  assert.deepEqual(await p.evaluate(()=>VIEW.karte.messPts),[[52.51,13.41]]);
  await p.evaluate(()=>{window.__alt=KARTE_V2_DEV.adapter();renderModule();});
  await status('Bildkacheln geladen');
  assert.equal(await p.evaluate(()=>__alt.ready()),false);
  assertCamera(await p.evaluate(()=>KARTE_V2_DEV.adapter().camera()),cam);
  assert.equal(await p.locator('#k-v2-luftbild').getAttribute('aria-pressed'),'true');
  await p.evaluate(()=>KARTE_V2_DEV.adapter().flyTo({center:[14.33,51.76],zoom:14,duration:0}));
  await status('Brandenburg / Berlin DOP20');await status('Bildkacheln geladen');
  assert.equal(await p.locator('#k-v2-bildwahl').inputValue(),'auto');
  await p.selectOption('#k-v2-bildwahl','berlin2024');await status('Mittelpunkt außerhalb des Anfragebereichs');
  await p.evaluate(()=>renderModule());await status('Mittelpunkt außerhalb des Anfragebereichs');
  assert.equal(await p.locator('#k-v2-bildwahl').inputValue(),'berlin2024');
  await p.selectOption('#k-v2-bildwahl','auto');await status('Brandenburg / Berlin DOP20');await status('Bildkacheln geladen');
  await p.evaluate(()=>KARTE_V2_DEV.adapter().flyTo({center:[7.596,50.359],zoom:14,duration:0}));
  await status('Rheinland-Pfalz DOP20');await status('Bildkacheln geladen');
  assert.ok(bildAnfragen.some(a=>new URL(a.url).hostname==='geo4.service24.rlp.de'));
  await p.evaluate(()=>KARTE_V2_DEV.adapter().flyTo({center:[6.168,51.37],zoom:14,duration:0}));
  await status('Sentinel-2 Übersicht (EOX)');await status('Bildkacheln geladen');
  await p.evaluate(()=>KARTE_V2_DEV.adapter().flyTo({center:[6.56,51.3],zoom:16,duration:0}));
  await status('Nordrhein-Westfalen DOP10');await status('Bildkacheln geladen');await status('nominal 10 cm');
  assert.ok(bildAnfragen.some(a=>new URL(a.url).hostname==='www.wms.nrw.de'));
  await p.evaluate(()=>KARTE_V2_DEV.adapter().flyTo({center:[151.21,-33.87],zoom:16,duration:0}));
  await status('Sentinel-2 Übersicht (EOX)');await status('Bildkacheln geladen');
  await status('nominal 10 m');await status('keine Gebäudedetailauflösung');await status('Overzoom');
  assert.ok(bildAnfragen.some(a=>new URL(a.url).hostname==='tiles.maps.eox.at'));
  await p.selectOption('#k-v2-bildwahl','rheinlandPfalz');await status('Mittelpunkt außerhalb des Anfragebereichs');
  await p.selectOption('#k-v2-bildwahl','auto');await status('Bildkacheln geladen');
  assert.equal(await p.locator('#k-v2-luftbild').getAttribute('aria-pressed'),'true');
  await p.evaluate(cam=>KARTE_V2_DEV.adapter().flyTo({...cam,duration:0}),cam);
  await p.waitForFunction(()=>KARTE_V2_DEV.adapter().camera().center[0]>13);
  await p.click('#k-v2-leer');await status('Ohne Basiskarte');
  // Automatischer Rückfall auf die zweite zugelassene Quelle.
  berlinFehler=true;
  await p.click('#k-v2-luftbild');await status('Brandenburg / Berlin DOP20');
  await status('Bildkacheln geladen');await status('Automatischer Quellenrückfall');
  bildFehler=true;
  await p.selectOption('#k-v2-bildwahl','berlin2024');await status('Luftbild nicht verfügbar');
  berlinFehler=false;
  await rueckfallTreffer();
  // Automatik: alle drei Kandidaten am Berliner Mittelpunkt fallen aus.
  // Keine Schleife, kein CARTO-Wechsel; Luftbild bleibt als Modus erhalten.
  // Der manuelle Fehler hat gerade auf "leer" zurückgeschaltet. Bei sofort
  // erneutem Fehler kann der manuelle Modus schon wieder verlassen sein,
  // bevor Playwright die Quellenauswahl erreicht. Erst reproduzierbar einen
  // funktionierenden manuellen Modus herstellen, dann den Totalausfall auslösen.
  bildFehler=false;
  await p.click('#k-v2-luftbild');await status('Bildkacheln geladen');
  assert.equal(await p.locator('#k-v2-luftbild').getAttribute('aria-pressed'),'true');
  assert.equal(await p.locator('#k-v2-bildwahl').inputValue(),'berlin2024');
  const vorTotalAusfall=bildAnfragen.length;
  bildFehler=true;
  await p.selectOption('#k-v2-bildwahl','auto');
  await status('Keine geeignete Bildquelle verfügbar');
  const ausfallHosts=new Set(bildAnfragen.slice(vorTotalAusfall).map(a=>new URL(a.url).hostname));
  for(const host of ['gdi.berlin.de','isk.geobasis-bb.de','tiles.maps.eox.at'])
    assert.ok(ausfallHosts.has(host),'Automatik muss Kandidaten tatsächlich anfragen: '+host);
  assert.equal(await p.locator('#k-v2-luftbild').getAttribute('aria-pressed'),'true');
  await p.waitForFunction(k=>{const a=KARTE_V2_DEV.adapter();return a?.ready()&&a.hitTest(a.project([52.51,13.41]))?.renderKey===k;},kb);
  await p.click('#k-v2-leer');await status('Ohne Basiskarte');
  bildFehler=false;
  for(const a of bildAnfragen){
    const u=new URL(a.url);
    if(u.hostname==='tiles.maps.eox.at'){
      const m=u.pathname.match(/^\/wmts\/1\.0\.0\/s2cloudless_3857\/default\/g\/(\d+)\/(\d+)\/(\d+)\.jpg$/);
      assert.ok(m,'WMTS-Matrixpfad');const [z,y,x]=m.slice(1).map(Number);
      assert.ok(z<=14&&x>=0&&y>=0&&x<2**z&&y<2**z);
    }else{
      const bb=u.searchParams.get('bbox').split(',').map(Number);
      assert.ok(bb.length===4&&bb.every(Number.isFinite)&&bb[0]<bb[2]&&bb[1]<bb[3]);
      const pfade={'gdi.berlin.de':'/services/wms/truedop_2024','isk.geobasis-bb.de':'/mapproxy/dop20c/service/wms','geo4.service24.rlp.de':'/wms/rp_dop20.fcgi','www.wms.nrw.de':'/geobasis/wms_nw_dop'};
      assert.equal(u.pathname,pfade[u.hostname]);
      if(u.hostname==='geo4.service24.rlp.de'){assert.equal(u.searchParams.get('srs'),'EPSG:3857');assert.equal(u.searchParams.get('layers'),'rp_dop20');}
      if(u.hostname==='www.wms.nrw.de'){assert.equal(u.searchParams.get('crs'),'EPSG:3857');assert.equal(u.searchParams.get('layers'),'nw_dop_rgb');}
    }
    assert.ok(!u.searchParams.has('key')&&!a.referer);
  }
  assert.equal(anfragen.length,vorBild,'kein automatischer CARTO-Rückfall');
  // Hybrid in der gemeinsamen Ansicht: beide Quellen unabhängig, ein Modus.
  const hybridBereit=async()=>{await status('Bildkacheln geladen');await status('Vektorkacheln geladen');};
  const hybridTreffer=()=>p.waitForFunction(k=>{const a=KARTE_V2_DEV.adapter();return a?.ready()&&a.hitTest(a.project([52.51,13.41]))?.renderKey===k;},kb);
  await p.click('#k-v2-hybrid');await hybridBereit();await hybridTreffer();
  assert.equal(await p.locator('#k-v2-hybrid').getAttribute('aria-pressed'),'true');
  assert.equal(await p.locator('#k-v2-bildwahl').inputValue(),'auto');
  assert.equal(await p.locator('#k-v2-gebaeude').isDisabled(),true);
  assertCamera(await p.evaluate(()=>KARTE_V2_DEV.adapter().camera()),cam);
  assert.deepEqual(await p.evaluate(()=>VIEW.karte.messPts),[[52.51,13.41]]);
  await p.locator('#k-v2-qualitaet').evaluate(el=>{el.closest('details').open=true;});
  await p.click('#k-v2-qualitaet');
  const bericht=await p.locator('#k-v2-qualitaetsbericht').inputValue();
  assert.ok(bericht.includes('Modus: Hybrid')&&bericht.includes('Bildquelle: Berlin TrueDOP 2024'));
  assert.match(bericht,/Kartenfläche: \d+ × \d+ CSS-Pixel · DPR [\d.]+ · Vollbild nein/);
  assert.ok(bericht.includes('Hausnummern:')&&bericht.includes('Extrusion: 0 aktive Layer'));
  assert.ok(!bericht.includes(fixtureKey)&&!bericht.includes('https://')&&!bericht.includes('K2 Sued')&&!bericht.includes('13.405'));
  const vorHybridRemount=stilAbrufe();
  await p.evaluate(()=>{window.__alt=KARTE_V2_DEV.adapter();renderModule();});
  await hybridBereit();await hybridTreffer();
  assert.equal(await p.evaluate(()=>__alt.ready()),false);
  assert.equal(stilAbrufe(),vorHybridRemount,'Hybrid-Stil im Sitzungs-RAM');
  await p.evaluate(()=>KARTE_V2_DEV.adapter().flyTo({center:[6.56,51.3],zoom:16,duration:0}));
  await status('Nordrhein-Westfalen DOP10');await hybridBereit();
  assert.equal(stilAbrufe(),vorHybridRemount,'kein neuer Stilabruf bei Bildquellenwechsel');
  await p.evaluate(cam=>KARTE_V2_DEV.adapter().flyTo({...cam,duration:0}),cam);
  await status('Berlin TrueDOP 2024');await hybridBereit();
  // Manueller Bildausfall: Vektoroverlay bleibt, keine automatische Ersatzquelle.
  bildFehler=true;
  await p.selectOption('#k-v2-bildwahl','berlin2024');await status('Keine geeignete Bildquelle verfügbar');await status('Vektorkacheln geladen');
  assert.equal(await p.locator('#k-v2-hybrid').getAttribute('aria-pressed'),'true');await hybridTreffer();
  bildFehler=false;await p.selectOption('#k-v2-bildwahl','auto');await hybridBereit();
  // Vektor-Stil- und Kachelausfälle: Raster und Objektlayer bleiben, kein Moduswechsel.
  for(const [fehler,grund] of [['stilfehler','CARTO-Stil nicht verfügbar'],['kachelfehler','CARTO-Vektorkacheln nicht verfügbar']]){
    netz=fehler;
    if(fehler==='kachelfehler'){
      // M3: no idle delivery at all during the failure phase. MapLibre still
      // processes tile errors and render events. Recovery must not wait 25 s.
      await p.evaluate(()=>{
        const proto=maplibregl.Map.prototype, fire=proto.fire;
        window.__idleUnterdrueckt=0;
        window.__idleRestore=()=>{proto.fire=fire;delete window.__idleRestore;};
        proto.fire=function(e,...args){if((typeof e==='string'?e:e?.type)==='idle'){window.__idleUnterdrueckt++;return this;}return fire.call(this,e,...args);};
      });
    }
    await p.click('#k-v2-hybrid');
    try{
      await p.waitForFunction(text=>$('k-v2-status')?.textContent.includes(text),grund,{timeout:15000});
      await status('Bildkacheln geladen');
    }finally{if(fehler==='kachelfehler')await p.evaluate(()=>window.__idleRestore?.());}
    // Whether MapLibre attempted to emit idle or not, none was delivered during the failure phase.
    assert.equal(await p.locator('#k-v2-hybrid').getAttribute('aria-pressed'),'true');await hybridTreffer();
    const vor=stilAbrufe();await p.evaluate(()=>renderModule());await status(grund);await status('Bildkacheln geladen');
    assert.equal(stilAbrufe(),vor,'kein automatischer CARTO-Neuversuch nach Fehler');
  }
  netz='ok';await p.click('#k-v2-hybrid');await hybridBereit();
  bildFehler=true;await p.click('#k-v2-hybrid');await status('Keine geeignete Bildquelle verfügbar');await status('Vektorkacheln geladen');await hybridTreffer();
  bildFehler=false;await p.click('#k-v2-leer');await status('Ohne Basiskarte');
  assert.ok(bildAnfragen.every(a=>!new URL(a.url).searchParams.has('key')&&!a.referer));
  assert.ok(anfragen.every(a=>a.key===fixtureKey&&!a.referer));
  await p.evaluate(()=>{VIEW.karte.messen=false;VIEW.karte.messPts=[];karteRendererDatenAktualisieren();});
  await p.evaluate(()=>{window.__alt=KARTE_V2_DEV.adapter();});
  await p.evaluate(({si,key})=>{karteWaehlen(si,false,key);karteBezugSetzen(si);},{si:f.si,key:ka});
  assert.match(await p.locator('#k-auswahl').innerText(),/K2 Nord/);
  await p.evaluate(id=>dispatch({type:'DOSSIER_SPERREN',id}),f.a);
  assert.equal(await p.locator('#k-auswahl').isVisible(),false,'locked selected object not rebound to other SI');
  assert.ok(!(await p.locator('#k-status').innerText()).includes('K2 Nord'));
  assert.equal(await p.evaluate(({si,key})=>karteBezugModell(si,key),{si:f.si,key:ka}),null);
  assert.equal(await p.evaluate(()=>__alt.ready()),false,'alter Renderer freigegeben');
  await ready();
  await p.waitForFunction(k=>{const a=KARTE_V2_DEV.adapter();return a?.ready()&&a.hitTest(a.project([52.51,13.41]))?.renderKey===k;},kb);
  assert.equal(await hit([52.5,13.4]),null);assert.equal(await hit([52.505,13.395]),null);assert.equal(await hit([52.505,13.415]),null);
  assert.equal((await hit([52.51,13.41])).renderKey,kb);
  await p.evaluate(()=>{VIEW.karte.sichtungFokus=null;VIEW.karte.ebenen.sichtungen=false;karteRendererDatenAktualisieren();});
  assert.equal(await hit([52.51,13.41]),null,'Treffer bereits vor Worker-Update ungültig');
  await p.evaluate(()=>{VIEW.karte.ebenen.sichtungen=true;karteRendererDatenAktualisieren();});
  await p.waitForFunction(()=>{const a=KARTE_V2_DEV.adapter();return !!a.hitTest(a.project([52.51,13.41]));});
  await p.evaluate(()=>{VIEW.karte.messen=true;VIEW.karte.messPts=[];});
  await click([52.51,13.41]);assert.deepEqual(await p.evaluate(()=>VIEW.karte.messPts),[[52.51,13.41]],'Messpunkt rastet an realer Sichtung ein');
  await p.evaluate(()=>{VIEW.karte.messen=false;VIEW.karte.messPts=[];karteRendererDatenAktualisieren();});
  // Echter Neuaufbau mit unabhängiger Kamera, Stil und Gebäudewunsch; neuer Key
  // wird aus VIEW aufgelöst, nicht aus dem alten Kontext übernommen.
  await p.click('#k-v2-voyager');await status('Voyager bereit');
  await p.click('#k-v2-gebaeude');
  await p.evaluate(()=>KARTE_V2_DEV.adapter().flyTo({center:[13.406,52.506],zoom:14.25,pitch:45,bearing:22,duration:0}));
  await p.waitForFunction(()=>KARTE_V2_DEV.adapter()?.camera()?.pitch===45);
  const neuCam=await p.evaluate(()=>KARTE_V2_DEV.adapter().camera());
  const neuKey='K2C_SECOND+/k', vorher=anfragen.length, vorKeywechsel=stilAbrufe();
  // T1: associate transformations with the newly constructed Map instance,
  // not with delivery time of an already queued request from the old map.
  await p.evaluate(k=>{
    const Original=maplibregl.Map;
    window.__neueTransforms=[];
    maplibregl.Map=class extends Original{
      constructor(opts){
        const transform=opts.transformRequest;
        super({...opts,transformRequest:(url,...args)=>{
          const result=transform(url,...args);
          const u=new URL(result.url,location.href);
          if(u.hostname==='basemaps.cartocdn.com'||u.hostname.endsWith('.basemaps.cartocdn.com'))
            window.__neueTransforms.push({key:u.searchParams.get('key'),art:u.pathname.endsWith('.mvt')?'tile':'sonst'});
          return result;
        }});
      }
    };
    window.__restoreMap=()=>{maplibregl.Map=Original;delete window.__restoreMap;};
    window.__alt=KARTE_V2_DEV.adapter();VIEW.karte.cartoKey=k;renderModule();
  },neuKey);
  try{await status('Voyager bereit');}
  finally{await p.evaluate(()=>window.__restoreMap?.());}
  assert.equal(await p.evaluate(()=>__alt.ready()),false);
  assert.equal(stilAbrufe(),vorKeywechsel+1,'Keywechsel verlangt frischen Stil');
  assertCamera(await p.evaluate(()=>KARTE_V2_DEV.adapter().camera()),neuCam);
  assert.equal(await p.locator('#k-v2-gebaeude').getAttribute('aria-pressed'),'true');
  const neueTransforms=await p.evaluate(()=>window.__neueTransforms);
  assert.ok(neueTransforms.some(x=>x.art==='tile'),'neue Map hat Vektorkacheln angefordert');
  assert.ok(neueTransforms.every(x=>x.key===neuKey),'ausschließlich neuer Schlüssel bei Transformation der neuen Map');
  const neuAnfragen=anfragen.slice(vorher);
  assert.ok(neuAnfragen.some(x=>x.art==='tile'&&x.key===neuKey),'neuer Schlüssel im tatsächlichen Tileabruf');
  assert.deepEqual(neuAnfragen.filter(x=>x.art==='stil'),[{art:'stil',key:neuKey,referer:''}]);
  assert.ok(neuAnfragen.every(x=>!x.referer),'kein Referrer auch bei auslaufenden Anfragen');
  assert.equal(await p.evaluate(k=>Object.values(localStorage).some(v=>v.includes(k)),neuKey),false);
  await p.click('#k-v2-flach');await p.waitForFunction(()=>KARTE_V2_DEV.adapter().camera().pitch===0&&KARTE_V2_DEV.adapter().camera().bearing===0);
  const pinCam=await p.evaluate(()=>KARTE_V2_DEV.adapter().camera());
  for(const [stil,bezeichnung,ll] of [['voyager','Voyager',[52.503,13.407]],['shadow','Shadow',[52.504,13.408]]]){
    if(stil==='shadow'){await p.click('#k-v2-shadow');await status('Shadow bereit');}
    await p.evaluate(()=>{window.__alt=KARTE_V2_DEV.adapter();VIEW.karte.pinSetzen=true;});
    const n=await p.evaluate(()=>PROFIL.pins.length), vorPin=stilAbrufe();
    await click(ll);assert.equal(await p.evaluate(()=>PROFIL.pins.length),n+1,'gemeinsame Pin-Aktion '+stil);
    await status(bezeichnung+' bereit');
    assert.equal(await p.evaluate(()=>__alt.ready()),false,'Renderer erneuert '+stil);
    assert.equal(stilAbrufe(),vorPin,'kein Stilabruf bei Pin-Neuaufbau '+stil);
    assertCamera(await p.evaluate(()=>KARTE_V2_DEV.adapter().camera()),pinCam);
    assert.equal(await p.locator('#k-v2-gebaeude').getAttribute('aria-pressed'),'true');
    assert.equal(await p.locator('#k-v2-'+stil).getAttribute('aria-pressed'),'true');
  }
  const vorModulwechsel=stilAbrufe();
  await p.click('#k-v2-voll');
  await p.evaluate(()=>{window.__alt=KARTE_V2_DEV.adapter();dispatch({type:'NAVIGATION',modul:'dossier'});});
  assert.equal(await p.locator('#k-v2-map').count(),0);
  assert.equal(await p.evaluate(()=>__alt.ready()),false);
  await p.evaluate(()=>dispatch({type:'NAVIGATION',modul:'karte'}));await status('Shadow bereit');
  assert.equal(await p.locator('#k-v2-voll').getAttribute('aria-pressed'),'false','Modulwechsel beendet Vollbild');
  assert.ok(await p.evaluate(()=>KARTE_V2_DEV.adapter()!==__alt));
  assert.equal(stilAbrufe(),vorModulwechsel,'kein Stilabruf nach Modulwechsel');
  assertCamera(await p.evaluate(()=>KARTE_V2_DEV.adapter().camera()),pinCam);
  assert.equal(await p.locator('#k-v2-gebaeude').getAttribute('aria-pressed'),'true');
  await p.click('#k-v2-hybrid');await hybridBereit();
  await p.click('#k-v2-voll');
  /* Reale Zugangssperre und erneute Freigabe, ohne Navigation oder Neuladen. */
  await p.evaluate(()=>{window.__alt=KARTE_V2_DEV.adapter();Zugang.sperren('K2-Test');});
  assert.equal(await p.evaluate(()=>__alt.ready()),false);
  assert.equal(await p.locator('#k-v2-map canvas').count(),0);
  const gesperrt=anfragen.length, bildGesperrt=bildAnfragen.length;
  await p.fill('#gate-pw','pw-test-123');await p.click('#gate-go');
  await p.waitForFunction(()=>!document.body.classList.contains('locked'));
  await status('Voyager bereit');
  assert.ok(await p.evaluate(()=>KARTE_V2_DEV.adapter()!==__alt));
  assert.equal(await p.locator('#k-v2-voyager').getAttribute('aria-pressed'),'true');
  assert.equal(await p.locator('#k-v2-gebaeude').getAttribute('aria-pressed'),'false');
  assert.equal(await p.locator('#k-v2-voll').getAttribute('aria-pressed'),'false','Sperre verwirft Layoutzustand');
  assert.ok(anfragen.slice(gesperrt).some(x=>x.art==='tile'),'Voyager nach Entsperrung frisch geladen');
  assert.equal(bildAnfragen.length,bildGesperrt,'kein automatischer erneuter Bildabruf nach Sperre');
  const nachSperre=stilAbrufe();await p.click('#k-v2-shadow');await status('Shadow bereit');
  assert.equal(stilAbrufe(),nachSperre+1,'Stil nach Sperre frisch abrufen');
  await p.click('#k-v2-leer');await status('Ohne Basiskarte');
  // K3: shared Lagebox weather cache is independent of every V2 style.
  // Enable the existing online weather permission without changing the map
  // position or rebuilding the legacy renderer. No live request in CI.
  const vorWetter=wetterAnfragen.length;
  await p.evaluate(()=>{
    const K=VIEW.karte;K.wetter=true;K.ebenen.kacheln=true;K.statusOffen=true;
    K.bezug=null;K.bezugRenderKey=null;K.lat=52.505;K.lon=13.405;
    clearTimeout(WETTER.retry);WETTER.retry=null;WETTER.cache={};WETTER.zuletzt=0;
    karteStatusAkt();
  });
  await p.waitForFunction(()=>$('k-st-wetter')?.textContent.includes('12 °C')&&!WETTER.laufend);
  assert.equal(wetterAnfragen.length,vorWetter+1,'weather positive control');
  const wetterVorStil=wetterAnfragen.length;
  const wetterTextVor=await p.locator('#k-st-wetter').innerText();
  for(const [modus,erwartet] of [['voyager','Voyager bereit'],['shadow','Shadow bereit'],['luftbild','Bildkacheln geladen'],['hybrid','Vektorkacheln geladen'],['leer','Ohne Basiskarte']]){
    await p.click('#k-v2-'+modus);await status(erwartet);
    // Refresh through the real shared panel, e.g. after camera/UI updates.
    await p.evaluate(()=>karteStatusAkt());
    assert.equal(await p.locator('#k-st-wetter').innerText(),wetterTextVor);
    assert.equal(wetterAnfragen.length,wetterVorStil,'no weather fetch on basemap '+modus);
  }
  // Position changes remain a real trigger (bypass only the time throttle,
  // not the cache/position selection). Without this control, a disabled
  // weather implementation would falsely pass the negative assertion.
  await p.evaluate(()=>{
    const a=KARTE_V2_DEV.adapter(),cam=a.camera();WETTER.zuletzt=0;
    a.flyTo({...cam,center:[cam.center[0],cam.center[1]+0.2],duration:0});
  });
  await p.waitForFunction(()=>!WETTER.laufend&&$('k-st-wetter')?.textContent.includes('12 °C')&&WETTER.zuletzt>0);
  assert.equal(wetterAnfragen.length,wetterVorStil+1);
  assert.notEqual(wetterAnfragen.at(-1).lat,wetterAnfragen.at(-2).lat);
  await p.evaluate(()=>{VIEW.karte.ebenen.kacheln=false;karteStatusAkt();});
  await p.click('#k-v2-hybrid');await status('Bildkacheln geladen');await status('Vektorkacheln geladen');
  const werkNetz=[stilAbrufe(),bildAnfragen.length];
  const werkOnlineCam=await p.evaluate(()=>{window.__werkzeugAdapter=KARTE_V2_DEV.adapter();return __werkzeugAdapter.camera();});
  for(const art of ['pin','zone','messen']){
    const b=p.locator('#k-v2-werkzeug-'+art);
    await b.click();assert.equal(await b.getAttribute('aria-pressed'),'true');
    await b.click();assert.equal(await b.getAttribute('aria-pressed'),'false');
    assert.equal(await p.evaluate(()=>__werkzeugAdapter===KARTE_V2_DEV.adapter()),true,'Hybrid-Werkzeug '+art+' ohne Neuaufbau');
  }
  assertCamera(await p.evaluate(()=>KARTE_V2_DEV.adapter().camera()),werkOnlineCam);
  assert.deepEqual([stilAbrufe(),bildAnfragen.length],werkNetz,'kein neuer Stil-/Bildabruf allein durch Werkzeugwahl');
  await p.click('#k-v2-leer');await status('Ohne Basiskarte');
  // Real actions in the expanded map. Same application state and click contract.
  await p.click('#k-v2-voll');
  const werkCam=await p.evaluate(()=>{window.__werkzeugAdapter=KARTE_V2_DEV.adapter();return __werkzeugAdapter.camera();});
  const pos=werkCam.center.slice().reverse();
  const pins=await p.evaluate(()=>PROFIL.pins.length),zonen=await p.evaluate(()=>PROFIL.zonen.length);
  await p.click('#k-v2-werkzeug-pin');await ready();
  assert.equal(await p.locator('#k-v2-voll').getAttribute('aria-pressed'),'true');
  assert.equal(await p.locator('#k-v2-werkzeug-pin').getAttribute('aria-pressed'),'true');
  assert.equal(await p.evaluate(()=>__werkzeugAdapter===KARTE_V2_DEV.adapter()),true,'Werkzeugwahl ohne Neuaufbau');
  await click(pos);await ready();
  assert.equal(await p.evaluate(()=>PROFIL.pins.length),pins+1);
  assert.equal(await p.locator('#k-v2-werkzeug-pin').getAttribute('aria-pressed'),'false');
  await p.click('#k-v2-werkzeug-zone');await ready();
  await click([pos[0]+0.001,pos[1]]);await ready();
  assert.equal(await p.evaluate(()=>PROFIL.zonen.length),zonen+1);
  await p.evaluate(()=>{window.__werkzeugAdapter=KARTE_V2_DEV.adapter();});
  await p.click('#k-v2-werkzeug-messen');await ready();
  assert.match(await p.locator('#k-v2-messwert').innerText(),/Ersten Messpunkt/);
  await click(pos);assert.match(await p.locator('#k-v2-messwert').innerText(),/Zweiten Messpunkt/);
  await click([pos[0]+0.001,pos[1]+0.001]);await ready();
  assert.match(await p.locator('#k-v2-messwert').innerText(),/^Luftlinie: \d+ m$/);
  assert.equal(await p.evaluate(()=>__werkzeugAdapter===KARTE_V2_DEV.adapter()),true,'Messabschluss ohne Neuaufbau');
  assert.equal(await p.evaluate(()=>VIEW.karte.messPts.length),2);
  assert.equal(await p.locator('#k-v2-werkzeug-messen').innerText(),'Messung löschen');
  await p.click('#k-v2-werkzeug-messen');await ready();
  assert.equal(await p.evaluate(()=>VIEW.karte.messPts.length),0);
  assert.equal(await p.locator('#k-v2-messwert').isVisible(),false);
  assert.equal(await p.evaluate(()=>__werkzeugAdapter===KARTE_V2_DEV.adapter()),true,'Messung löschen ohne Neuaufbau');
  assert.equal(await p.locator('#k-v2-voll').getAttribute('aria-pressed'),'true');
  assertCamera(await p.evaluate(()=>KARTE_V2_DEV.adapter().camera()),werkCam);
  await p.click('#k-v2-voll');await p.close();
  // Echtes Laden des alten Browserprofils mit abweichender Schlüsseldatei.
  // Nur der in .kartenwahl bereits vorhandene Key darf verwendet werden.
  const browserKey='K2C_BROWSER_STORED+/k', stored=await b.newPage({reducedMotion:'reduce'});
  await stored.addInitScript(k=>{try{localStorage.setItem('fieldterminal.v1.kartenwahl',JSON.stringify({ebenen:{},cartoKey:k,anbieter:'osm'}));}catch(e){}},browserKey);
  await stored.route(/^https?:/,route);
  await stored.goto(APP+'?geospatial-v2=1');
  await stored.fill('#gate-pw','pw-test-123');if(await stored.isVisible('#gate-pw2'))await stored.fill('#gate-pw2','pw-test-123');await stored.click('#gate-go');
  await stored.waitForFunction(()=>!document.body.classList.contains('locked'));
  assert.ok(await stored.evaluate(k=>VIEW.karte.cartoKey===k,browserKey));
  const gespeichertVorher=anfragen.length;
  await stored.evaluate(()=>dispatch({type:'NAVIGATION',modul:'karte'}));
  await stored.waitForFunction(()=>$('k-v2-status')?.textContent.includes('Voyager bereit'));
  assert.ok(anfragen.length>gespeichertVorher&&anfragen.slice(gespeichertVorher).every(x=>x.key===browserKey&&!x.referer),'Browserquelle hat Vorrang beim Start');
  await stored.close();
  const standard=await b.newPage({reducedMotion:'reduce'});await standard.route(/^https?:/,r=>r.abort());await standard.goto(APP);
  await standard.fill('#gate-pw','pw-test-123');if(await standard.isVisible('#gate-pw2'))await standard.fill('#gate-pw2','pw-test-123');await standard.click('#gate-go');
  await standard.waitForFunction(()=>!document.body.classList.contains('locked'));
  await standard.evaluate(()=>dispatch({type:'NAVIGATION',modul:'karte'}));
  assert.equal(await standard.locator('#k-v2-map').count(),0);
  assert.equal(await standard.locator('#k-v2-paneele').count(),0);
  assert.equal(await standard.locator('.karte-wrap #k-status').count(),1);
  assert.equal(await standard.locator('.karte-wrap #k-auswahl').count(),1);
  assert.equal(await standard.locator('#k-v2-inspektor-klapp').count(),0);
  assert.equal(await standard.evaluate(()=>typeof maplibregl),'undefined','keine Bibliotheksladung ohne Opt-in');
  await standard.close();assert.deepEqual(errors,[]);
  console.log('OK: K2b-2b gefiltertes Anwendungsmodell, echte MapLibre-Klicks, Sperre, Ebenen und Lebenszyklus');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
