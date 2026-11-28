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

// Flat and north-up: both signs of zero denote exactly the same angle.
function assertFlatNorth(camera){
 assert.ok(camera.pitch===0&&camera.bearing===0,'flat north-up camera: pitch '+camera.pitch+', bearing '+camera.bearing);
}

// Selbstprüfung der Vergleichsfunktion: nur numerisch identische Nullwerte akzeptieren.
{
 const cam={center:[13.4,52.5],zoom:14.25,pitch:0,bearing:0};
 assertCamera({...cam,bearing:-0},cam);
 assertFlatNorth(cam);assertFlatNorth({...cam,pitch:-0,bearing:-0});
 for(const k of ['pitch','bearing'])for(const v of [.001,-.001,NaN,Infinity,'0',null,undefined]){
  assert.throws(()=>assertFlatNorth({...cam,[k]:v}),assert.AssertionError);
 }
 // Actual numerical residuals from the K4b-2 pitch regression.
 assertCamera({...cam,center:[13.395000000001517,52.50500000000022],pitch:60},
   {...cam,center:[13.395,52.50500000000002],pitch:60});
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
  await p.addInitScript(()=>{Element.prototype.requestFullscreen=function(){return Promise.resolve();};});
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
  // Track actual outstanding provider requests, including aborted requests
  // from the preliminary raster-only hybrid style.
  const providerHosts=new Set(['gdi.berlin.de','isk.geobasis-bb.de','geo4.service24.rlp.de','www.wms.nrw.de','tiles.maps.eox.at','basemaps.cartocdn.com','tiles.basemaps.cartocdn.com']);
  const pendingProvider=new Set(),providerWaiters=new Set();
  p.on('request',req=>{if(providerHosts.has(new URL(req.url()).hostname))pendingProvider.add(req);});
  const providerDone=req=>{
    pendingProvider.delete(req);
    if(!pendingProvider.size)for(const done of providerWaiters)done();
  };
  p.on('requestfinished',providerDone);p.on('requestfailed',providerDone);
  function providerDrain(){
    if(!pendingProvider.size)return Promise.resolve();
    return new Promise((resolve,reject)=>{
      const done=()=>{clearTimeout(timer);providerWaiters.delete(done);resolve();};
      const timer=setTimeout(()=>{providerWaiters.delete(done);reject(Error('Provider requests still pending: '+pendingProvider.size));},25000);
      providerWaiters.add(done);
    });
  }
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
  if(process.env.CI)assert.ok(startKey,'CI default-style key fixture missing');
  if(startKey){
    await p.waitForFunction(()=>$('k-v2-status')?.textContent.includes('Shadow bereit'));
    assert.equal(await p.locator('#k-v2-shadow').getAttribute('aria-pressed'),'true');
    assert.ok(anfragen.some(x=>x.art==='tile'&&x.key===startKey),'Shadow lädt beim Erststart');
    await p.click('#k-v2-leer');
  }
  await ready();
  assert.equal(await p.locator('#k-v2-dunkel').count(),0,'Shadow ersetzt Dark Matter');
  assert.ok(await p.locator('#k-svg').isVisible(),'SVG bleibt vorhanden');
  assert.equal(bildAnfragen.length,0,'keine Bildanfrage vor expliziter Wahl');
  const key=(...x)=>JSON.stringify(x), ka=key('sichtung',f.a,f.si),kb=key('sichtung',f.b,f.si);
  const hit=ll=>p.evaluate(ll=>{const a=KARTE_V2_DEV.adapter();return a.hitTest(a.project(ll));},ll);
  // Identical sighting numbers must remain separate search results.
  await p.selectOption('#k-v2-suchtyp','sichtung');
  await p.fill('#k-v2-suche',f.si);
  assert.deepEqual((await p.locator('#k-v2-suchergebnisse button').evaluateAll(bs=>bs.map(b=>b.dataset.renderKey))).sort(),[ka,kb].sort());
  await p.fill('#k-v2-suche','');await p.selectOption('#k-v2-suchtyp','alle');
  // Style registration precedes the asynchronous GeoJSON worker update.
  // Wait for real rendered hits, not just adapter.ready(), after Voyager -> local.
  await p.waitForFunction(({ka,kb,pin,zone})=>{
    const a=KARTE_V2_DEV.adapter();
    if(!a?.ready())return false;
    const hit=ll=>a.hitTest(a.project(ll));
    return hit([52.5,13.4])?.renderKey===ka&&hit([52.51,13.41])?.renderKey===kb&&
      hit([52.505,13.395])?.id===pin&&hit([52.505,13.415])?.id===zone;
  },{ka,kb,pin:f.pin,zone:f.zone});
  assert.equal((await hit([52.5,13.4])).renderKey,ka);assert.equal((await hit([52.51,13.41])).renderKey,kb);
  assert.equal((await hit([52.505,13.415])).id,f.zone);
  const click=async (ll,expected=null)=>{
   const canvas=p.locator('#k-v2-map canvas.maplibregl-canvas');
   await canvas.scrollIntoViewIfNeeded();
   // Projection is relative to the canvas, not the bordered outer container.
   // Assert a genuine rendered hit before clicking a known object, without
   // retrying the click or replacing the application selection.
   await p.waitForFunction(({ll,expected})=>{
     const a=KARTE_V2_DEV.adapter(),el=$('k-v2-map')?.querySelector('canvas.maplibregl-canvas');
     if(!a?.ready()||!el)return false;
     const q=a.project(ll),r=el.getBoundingClientRect();
     if(!q||!Number.isFinite(q.x)||!Number.isFinite(q.y))return false;
     const x=r.left+q.x,y=r.top+q.y;
     if(document.elementFromPoint(x,y)!==el)return false;
     return !expected||a.hitTest(q)?.renderKey===expected;
   },{ll,expected});
   const pt=await p.evaluate(ll=>{const a=KARTE_V2_DEV.adapter(),q=a.project(ll),r=$('k-v2-map').querySelector('canvas.maplibregl-canvas').getBoundingClientRect();return [r.left+q.x,r.top+q.y];},ll);
   await p.mouse.click(pt[0],pt[1]);
  };
  await click([52.51,13.41],kb);assert.equal(await p.evaluate(()=>karteAuswahlSchluessel()),kb);
  assert.match(await p.locator('#k-auswahl').innerText(),/K2 Sued/);
  assert.equal(await p.locator('#k-v2-paneele #k-auswahl').count(),1);
  assert.equal(await p.locator('#k-v2-paneele #k-status').count(),1);
  assert.equal(await p.locator('#k-auswahl').count(),1);
  assert.equal(await p.locator('#k-status').count(),1);
  assert.match(await p.locator('#k-st-objekt').innerText(),/K2 Sued/);
  // K3f-2: panels are overlay siblings, not MapLibre children or a lower dock.
  const overlayBounds=()=>p.evaluate(()=>{
    const r=id=>{const b=$(id).getBoundingClientRect();return {left:b.left,top:b.top,right:b.right,bottom:b.bottom,width:b.width,height:b.height};};
    return {map:r('k-v2-map'),lage:r('k-status'),inspektor:r('k-auswahl')};
  });
  const panelsInside=()=>p.evaluate(()=>{
    const m=$('k-v2-map').getBoundingClientRect(), within=e=>{
      const r=e.getBoundingClientRect();return r.left>=m.left&&r.top>=m.top&&r.right<=m.right&&r.bottom<=m.bottom;
    };
    return within($('k-status'))&&within($('k-auswahl'));
  });
  assert.equal(await p.locator('#k-v2-buehne > #k-v2-paneele').count(),1);
  assert.equal(await p.locator('#k-v2-map #k-status, #k-v2-map #k-auswahl').count(),0);
  assert.equal(await panelsInside(),true);
  const ov=await overlayBounds();
  assert.ok(ov.lage.top-ov.map.top<20&&ov.map.right-ov.lage.right<65&&ov.lage.left>ov.map.left+ov.map.width/2,'Lage oben rechts, Navigation frei');
  assert.ok(ov.inspektor.left-ov.map.left<20&&ov.inspektor.top-ov.map.top<20,'Inspektor frei über Karte');
  assert.equal(await p.evaluate(()=>getComputedStyle($('k-v2-paneele')).pointerEvents),'none');
  const dragCam=await p.evaluate(()=>{window.__panelAdapter=KARTE_V2_DEV.adapter();return __panelAdapter.camera();});
  const dragNet=[anfragen.length,bildAnfragen.length,wetterAnfragen.length];
  const kopf=p.locator('#k-auswahl .k-pop-kopf strong');
  await kopf.scrollIntoViewIfNeeded();
  const dr=await kopf.boundingBox();assert.ok(dr);
  await p.mouse.move(dr.x+dr.width/2,dr.y+dr.height/2);
  await p.mouse.down();await p.mouse.move(dr.x+dr.width/2+24,dr.y+dr.height/2+32,{steps:5});await p.mouse.up();
  const gezogen=await overlayBounds();
  assert.ok(Math.abs((gezogen.inspektor.left-gezogen.map.left)-(ov.inspektor.left-ov.map.left)-24)<=2);
  assert.ok(Math.abs((gezogen.inspektor.top-gezogen.map.top)-(ov.inspektor.top-ov.map.top)-32)<=2);
  assert.equal(await panelsInside(),true);
  assert.equal(await p.evaluate(()=>karteAuswahlSchluessel()),kb);
  assert.equal(await p.evaluate(()=>__panelAdapter===KARTE_V2_DEV.adapter()),true);
  assertCamera(await p.evaluate(()=>KARTE_V2_DEV.adapter().camera()),dragCam);
  await p.evaluate(()=>karteAuswahlAnzeige());
  const neu=await overlayBounds();assert.ok(Math.abs(neu.inspektor.left-gezogen.inspektor.left)<=2&&Math.abs(neu.inspektor.top-gezogen.inspektor.top)<=2,'same object retains window position');
  assert.deepEqual([anfragen.length,bildAnfragen.length,wetterAnfragen.length],dragNet);
  assert.equal(await p.evaluate(({si})=>kartePanelObjekt(si,null),f),null,'duplicate ID without typed key');
  await click([52.505,13.395],key('pin',f.pin));
  assert.match(await p.locator('#k-auswahl').innerText(),/K2 Pin/);
  assert.ok(await p.locator('#pin-export').isVisible());
  assert.ok(await p.locator('#k-st-protokoll').isVisible());
  await click([52.505,13.415],key('zone',f.zone));
  assert.ok(await p.locator('#oz-name').isVisible());
  assert.ok(await p.locator('#oz-protokoll').isVisible());
  await click([52.51,13.41],kb);
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
  await click([52.505,13.395],key('pin',f.pin));
  assert.equal(await body.isVisible(),true);
  assert.equal(await klapp.getAttribute('aria-expanded'),'true');
  assert.equal(await p.evaluate(()=>VIEW.karte.auswahl),f.pin,'new pin selected');
  // The pin name is in the inspector header and the input value, not body.innerText().
  assert.equal(await p.locator('#k-auswahl .k-pop-kopf strong').innerText(),'K2 Pin');
  assert.equal(await body.locator('#pin-name').inputValue(),'K2 Pin');
  await click([52.51,13.41],kb);
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
  assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem(STORAGE_KEY+'.kartenwahl')).ebenen.pins),false);
  assert.equal(await p.evaluate(()=>Object.hasOwn(JSON.parse(localStorage.getItem(STORAGE_KEY+'.kartenwahl')),'cartoKey')),false,'file-only key stays out of browser storage');
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
  await click([52.51,13.41],kb);
  assert.equal(await p.evaluate(()=>karteAuswahlSchluessel()),kb,'selection before fullscreen');
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
  assert.equal(await panelsInside(),true);
  // Actual layout at small viewport, then restore before camera comparisons.
  await p.setViewportSize({width:800,height:600});
  await p.waitForFunction(()=>Math.abs($('k-v2-panel').getBoundingClientRect().width-innerWidth)<=2);
  assert.ok(await p.locator('#k-v2-voll').isVisible());
  assert.ok(await p.evaluate(()=>{const a=$('k-v2-map').getBoundingClientRect(),b=$('k-v2-panel').getBoundingClientRect();return a.left>=b.left-1&&a.right<=b.right+1;}),'Karte bleibt im Vollbildrahmen');
  assert.equal(await panelsInside(),true,'both overlays stay within map on small viewport');
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
  await click([52.51,13.41],kb);assert.deepEqual(await p.evaluate(()=>VIEW.karte.messPts),[[52.51,13.41]],'Messpunkt rastet an realer Sichtung ein');
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
    assert.equal(await p.evaluate(()=>__alt===KARTE_V2_DEV.adapter()&&__alt.ready()),true,'Renderer bleibt erhalten '+stil);
    assert.equal(stilAbrufe(),vorPin,'kein Stilabruf bei Pinanlage '+stil);
    assert.ok(await p.locator('#pin-name').isVisible(),'neuer Pin im Inspektor');
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
  await status('Shadow bereit');
  assert.ok(await p.evaluate(()=>KARTE_V2_DEV.adapter()!==__alt));
  assert.equal(await p.locator('#k-v2-shadow').getAttribute('aria-pressed'),'true');
  assert.equal(await p.locator('#k-v2-gebaeude').getAttribute('aria-pressed'),'false');
  assert.equal(await p.locator('#k-v2-voll').getAttribute('aria-pressed'),'false','Sperre verwirft Layoutzustand');
  assert.ok(anfragen.slice(gesperrt).some(x=>x.art==='tile'),'Shadow nach Entsperrung frisch geladen');
  assert.equal(bildAnfragen.length,bildGesperrt,'kein automatischer erneuter Bildabruf nach Sperre');
  const nachSperre=stilAbrufe();await p.click('#k-v2-voyager');await status('Voyager bereit');
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
    KARTE_V2_DEV.sync();karteStatusAkt();
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
  // Explicit V2 weather permission is independent of the legacy tile
  // switch. Disabling it must block even an otherwise eligible request.
  assert.equal(await p.locator('#k-v2-wetter-online').isChecked(),true);
  const wetterVorAus=wetterAnfragen.length;
  const wetterCam=await p.evaluate(()=>{window.__wetterAdapter=KARTE_V2_DEV.adapter();return __wetterAdapter.camera();});
  await p.uncheck('#k-v2-wetter-online');
  assert.match(await p.locator('#k-st-wetter').innerText(),/Offline, keine Abfrage/);
  const offline=await p.evaluate(()=>{
    clearTimeout(WETTER.retry);WETTER.retry=null;WETTER.cache={};WETTER.zuletzt=0;
    const r=wetterStand(52.5,13.4);karteStatusAkt();return r;
  });
  assert.deepEqual(offline,{offline:true});assert.equal(wetterAnfragen.length,wetterVorAus);
  await p.evaluate(()=>{VIEW.karte.ebenen.kacheln=false;});
  await p.check('#k-v2-wetter-online');
  await p.waitForFunction(()=>!WETTER.laufend&&$('k-st-wetter')?.textContent.includes('12 °C'));
  assert.equal(wetterAnfragen.length,wetterVorAus+1,'explicit weather opt-in without legacy tiles');
  assert.equal(await p.evaluate(()=>VIEW.karte.ebenen.kacheln),false,'weather does not enable tiles');
  assert.equal(await p.evaluate(()=>__wetterAdapter===KARTE_V2_DEV.adapter()),true);
  assertCamera(await p.evaluate(()=>KARTE_V2_DEV.adapter().camera()),wetterCam);
  await p.uncheck('#k-v2-wetter-online');
  assert.match(await p.locator('#k-st-wetter').innerText(),/Offline, keine Abfrage/);
  // Observe the actual MapLibre instance, setStyle calls and source instances.
  // "Bildkacheln geladen" only confirms one tile, not a fully settled viewport.
  await p.evaluate(()=>{
    const proto=maplibregl.Map.prototype,original=proto.setStyle;
    window.__werkMap=null;window.__werkStyleCalls=0;window.__werkIdle=0;
    const idle=()=>{window.__werkIdle++;};
    proto.setStyle=function(...args){
      if(this.getContainer().id==='k-v2-map'){
        if(window.__werkMap!==this){
          window.__werkMap?.off('idle',idle);window.__werkMap=this;this.on('idle',idle);
        }
        window.__werkStyleCalls++;
      }
      return original.apply(this,args);
    };
    window.__restoreWerk=()=>{proto.setStyle=original;window.__werkMap?.off('idle',idle);delete window.__restoreWerk;};
  });
  const werkSettled=async()=>{
    const idle=await p.evaluate(()=>{const n=window.__werkIdle;window.__werkMap.triggerRepaint();return n;});
    await p.waitForFunction(n=>{
      const m=window.__werkMap;
      return window.__werkIdle>n&&m.loaded()&&m.areTilesLoaded()&&!m.isMoving();
    },idle);
    await providerDrain();
  };
  const werkCounts=()=>[stilAbrufe(),anfragen.filter(x=>x.art==='tile').length,bildAnfragen.length];
  try{
    await p.click('#k-v2-hybrid');await hybridBereit();await werkSettled();
    const werkNetz=werkCounts();
    const werkOnlineCam=await p.evaluate(()=>{
      const m=window.__werkMap;
      window.__werkzeugAdapter=KARTE_V2_DEV.adapter();
      window.__werkStyleBaseline=window.__werkStyleCalls;
      window.__werkSources=Object.entries(m.getStyle().sources).filter(([,s])=>s.type==='raster'||s.type==='vector').map(([id])=>[id,m.getSource(id)]);
      return window.__werkzeugAdapter.camera();
    });
    assert.ok(await p.evaluate(()=>window.__werkStyleBaseline>=1&&window.__werkSources.length===2),'positive control: real hybrid style and both sources');
    assert.equal(await p.evaluate(()=>window.__werkMap.getRenderWorldCopies()),false,'no repeating worlds');
    for(const art of ['pin','zone','messen']){
      const b=p.locator('#k-v2-werkzeug-'+art);
      for(const pressed of ['true','false']){
        await b.click();assert.equal(await b.getAttribute('aria-pressed'),pressed);
        await werkSettled();
        assert.equal(await p.evaluate(()=>window.__werkzeugAdapter===KARTE_V2_DEV.adapter()&&
          window.__werkStyleCalls===window.__werkStyleBaseline&&window.__werkSources.every(([id,src])=>window.__werkMap.getSource(id)===src)),true,
          'Hybrid-Werkzeug '+art+' '+pressed+': Adapter, Style und Quellen unverändert');
        assertCamera(await p.evaluate(()=>KARTE_V2_DEV.adapter().camera()),werkOnlineCam);
        assert.deepEqual(werkCounts(),werkNetz,'kein neuer Stil-/Vektor-/Bildabruf durch '+art+' '+pressed);
      }
    }
    // Real creation on settled hybrid. Keep the same network/source baseline.
    // Close the overlay before selecting the next point to preserve free canvas.
    const center=werkOnlineCam.center.slice().reverse();
    for(const [art,list,field,action,delta] of [
      ['pin','pins','#pin-name','Pin gesetzt',[0.002,0]],
      ['zone','zonen','#oz-name','Zone angelegt',[0.003,0]]
    ]){
      const old=await p.evaluate(list=>({count:PROFIL[list].length,seq:STATE.seq.log}),list);
      await p.click('#k-v2-werkzeug-'+art);
      await click([center[0]+delta[0],center[1]+delta[1]]);
      await werkSettled();
      const created=await p.evaluate(({list,action})=>{
        const item=PROFIL[list].at(-1),saved=JSON.parse(localStorage.getItem(PROFIL_KEY)||'{}');
        return {count:PROFIL[list].length,selected:VIEW.karte.auswahl,id:item.id,
          persisted:JSON.stringify(saved[list]?.find(x=>x.id===item.id))===JSON.stringify(item),
          log:STATE.log.findLast(x=>x.aktion===action)?.id,seq:STATE.seq.log};
      },{list,action});
      assert.equal(created.count,old.count+1);
      assert.equal(created.selected,created.id);
      assert.equal(created.persisted,true,'object persisted');
      assert.ok(created.log>old.seq&&created.seq>old.seq,'creation recorded');
      assert.equal(await p.locator('#ktab-protokoll').innerText(),await p.evaluate(()=>kartenProtokollReiterText()),'protocol counter after creation');
      assert.ok(await p.locator(field).isVisible(),'new object inspector');
      assert.equal(await p.locator('#k-v2-werkzeug-'+art).getAttribute('aria-pressed'),'false');
      assert.equal(await p.evaluate(()=>window.__werkzeugAdapter===KARTE_V2_DEV.adapter()&&
        window.__werkStyleCalls===window.__werkStyleBaseline&&window.__werkSources.every(([id,src])=>window.__werkMap.getSource(id)===src)),true,
        'creation '+art+': unchanged adapter, style and sources');
      assertCamera(await p.evaluate(()=>KARTE_V2_DEV.adapter().camera()),werkOnlineCam);
      assert.deepEqual(werkCounts(),werkNetz,'no new provider requests on '+art+' creation');
      if(art==='zone'){
        await p.selectOption('#oz-r','100');
        assert.equal(await p.evaluate(()=>PROFIL.zonen.at(-1).r),100,'radius in authoritative profile');
        assert.match(await p.locator('#oz-koordinaten').innerText(),/Radius 100 m/);
        await p.fill('#oz-name','K3 Radiusprobe');await p.locator('#oz-name').blur();
        assert.equal(await p.locator('#k-auswahl .k-pop-kopf strong').innerText(),'K3 Radiusprobe');
        await p.fill('#oz-bem','K3 Prüfnachweis');
        const seq=await p.evaluate(()=>STATE.seq.log);
        await p.click('#oz-stand');await werkSettled();
        assert.match(await p.locator('#oz-stand-text').innerText(),/K3 Prüfnachweis/);
        assert.equal(await p.locator('#oz-bem').inputValue(),'');
        assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem(PROFIL_KEY)).zonen.at(-1).standBemerkung),'K3 Prüfnachweis');
        assert.ok(await p.evaluate(seq=>STATE.log.some(x=>x.id>seq&&x.aktion==='Stand der Zone aktualisiert'),seq));
        assert.equal(await p.locator('#ktab-protokoll').innerText(),await p.evaluate(()=>kartenProtokollReiterText()));
        assert.equal(await p.evaluate(()=>window.__werkzeugAdapter===KARTE_V2_DEV.adapter()&&window.__werkStyleCalls===window.__werkStyleBaseline&&window.__werkSources.every(([id,src])=>window.__werkMap.getSource(id)===src)),true);
        assertCamera(await p.evaluate(()=>KARTE_V2_DEV.adapter().camera()),werkOnlineCam);
        assert.deepEqual(werkCounts(),werkNetz,'no provider requests on radius or status update');
      }
      await p.click('#k-pop-x');await werkSettled();
    }
  }finally{await p.evaluate(()=>window.__restoreWerk?.());}
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
  assert.equal(await p.evaluate(()=>__werkzeugAdapter===KARTE_V2_DEV.adapter()),true,'Pinanlage ohne Neuaufbau im Vollbild');
  assert.equal(await p.locator('#k-v2-werkzeug-pin').getAttribute('aria-pressed'),'false');
  await p.click('#k-v2-werkzeug-zone');await ready();
  await click([pos[0]+0.001,pos[1]]);await ready();
  assert.equal(await p.evaluate(()=>PROFIL.zonen.length),zonen+1);
  assert.equal(await p.evaluate(()=>__werkzeugAdapter===KARTE_V2_DEV.adapter()),true,'Zonenanlage ohne Neuaufbau im Vollbild');
  await p.click('#k-v2-werkzeug-messen');await ready();
  assert.match(await p.locator('#k-v2-messwert').innerText(),/Ersten Messpunkt/);
  await click(pos);assert.match(await p.locator('#k-v2-messwert').innerText(),/Zweiten Messpunkt/);
  // A second point far enough from the first pin cannot snap to the same icon.
  await click([pos[0]+0.005,pos[1]+0.005]);await ready();
  const messung=await p.evaluate(()=>{
    const [a,b]=VIEW.karte.messPts;return {a,b,m:Math.round(karteDistanz(a,b)*1000)};
  });
  assert.ok(messung.m>100&&messung.m<1000,'non-zero short distance: '+JSON.stringify(messung));
  assert.equal(await p.locator('#k-v2-messwert').innerText(),'Luftlinie: '+messung.m+' m');
  assert.equal(await p.evaluate(()=>__werkzeugAdapter===KARTE_V2_DEV.adapter()),true,'Messabschluss ohne Neuaufbau');
  assert.equal(await p.evaluate(()=>VIEW.karte.messPts.length),2);
  assert.equal(await p.locator('#k-v2-werkzeug-messen').innerText(),'Messung löschen');
  await p.click('#k-v2-werkzeug-messen');await ready();
  assert.equal(await p.evaluate(()=>VIEW.karte.messPts.length),0);
  assert.equal(await p.locator('#k-v2-messwert').isVisible(),false);
  assert.equal(await p.evaluate(()=>__werkzeugAdapter===KARTE_V2_DEV.adapter()),true,'Messung löschen ohne Neuaufbau');
  assert.equal(await p.locator('#k-v2-voll').getAttribute('aria-pressed'),'true');
  assertCamera(await p.evaluate(()=>KARTE_V2_DEV.adapter().camera()),werkCam);
  await p.click('#k-v2-voll');
  {
    // Shared camera in both directions; explicit navigation wins on remount.
    await p.evaluate(()=>{VIEW.karte.ebenen.kacheln=false;KARTE_V2_DEV.adapter().flyTo({center:[13.405,52.505],zoom:13.5,pitch:0,bearing:0,duration:0});});
    await p.waitForFunction(()=>Math.abs(VIEW.karte.lat-52.505)<1e-6&&Math.abs(VIEW.karte.lon-13.405)<1e-6&&Math.abs(VIEW.karte.zoom-14)<1e-6);
    const gemeinsameCam=async()=>{
      const a=await p.evaluate(()=>({v:KARTE_V2_DEV.adapter().camera(),k:{lat:VIEW.karte.lat,lon:VIEW.karte.lon,zoom:VIEW.karte.zoom}}));
      assert.ok(Math.abs(a.v.center[0]-a.k.lon)<1e-6&&Math.abs(a.v.center[1]-a.k.lat)<1e-6&&Math.abs(a.v.zoom+.5-a.k.zoom)<1e-6);
      return a.v;
    };
    await gemeinsameCam();
    // Baseline of actual flat-map CSS pixel scales, not an assertion that
    // the historical half-zoom offset guarantees physical scale parity.
    const massstab=await p.evaluate(()=>{
      const svg=$('k-svg'),m=svg.getScreenCTM(),P=karteProj(),K=VIEW.karte,a=KARTE_V2_DEV.adapter();
      const ll1=[K.lat,K.lon],ll2=[K.lat,K.lon+.001];
      const s1=new DOMPoint(P.px(ll1[1]),P.py(ll1[0])).matrixTransform(m),s2=new DOMPoint(P.px(ll2[1]),P.py(ll2[0])).matrixTransform(m);
      const v1=a.project(ll1),v2=a.project(ll2),cam=a.camera();
      return {svgPx:Math.hypot(s2.x-s1.x,s2.y-s1.y),v2Px:Math.hypot(v2.x-v1.x,v2.y-v1.y),
        svgFaktor:Math.hypot(m.a,m.b),svgWelt:P.Wd,v2Zoom:cam.zoom,pitch:cam.pitch,bearing:cam.bearing,
        svgBreite:svg.getBoundingClientRect().width,v2Breite:$('k-v2-map').clientWidth};
    });
    assertFlatNorth(massstab);
    for(const k of ['svgPx','v2Px','svgFaktor','svgWelt','svgBreite','v2Breite'])assert.ok(Number.isFinite(massstab[k])&&massstab[k]>0,'scale '+k);
    const sollSvg=massstab.svgWelt*.001/360*massstab.svgFaktor,sollV2=512*2**massstab.v2Zoom*.001/360;
    assert.ok(Math.abs(massstab.svgPx-sollSvg)<1e-6,'SVG projection/CTM');
    assert.ok(Math.abs(massstab.v2Px-sollV2)<1e-6,'MapLibre CSS projection');
    console.log('K4 Maßstabsbaseline (CSS-Pixel): '+JSON.stringify({...massstab,verhaeltnis:massstab.v2Px/massstab.svgPx}));
    await p.click('#k-eu');await p.waitForFunction(()=>Math.abs(KARTE_V2_DEV.adapter().camera().zoom-3.9)<1e-6);
    const europa=await gemeinsameCam();
    // f.pin belongs to the dossier explicitly locked earlier in this test.
    // A denied jump must not move either camera; never unlock it for this test.
    assert.equal(await p.evaluate(id=>zielZugang(id)?.gesperrt,f.pin),true,'locked pin fixture');
    assert.equal(await p.evaluate(id=>kartenObjektZeigen(id),f.pin),false,'locked pin jump denied');
    assertCamera(await gemeinsameCam(),europa);
    // Independent authorized fixture with the same known reference coordinates.
    const kameraPin=await p.evaluate(()=>{
      dispatch({type:'PIN_ANGELEGT',ll:[52.505,13.395],name:'K4 Kamera-Testpin'});
      const pin=PROFIL.pins.at(-1);
      return {id:pin.id,accessible:zielZugang(pin.id)?.gesperrt===false,ll:pin.ll};
    });
    assert.equal(kameraPin.accessible,true);
    assert.deepEqual(kameraPin.ll,[52.505,13.395]);
    await ready();
    assert.equal(await p.evaluate(id=>kartenObjektZeigen(id),kameraPin.id),true,'authorized pin jump accepted');
    await ready();
    await p.waitForFunction(()=>Math.abs(KARTE_V2_DEV.adapter().camera().center[0]-13.395)<1e-6);
    assert.equal(await p.evaluate(()=>VIEW.karte.auswahl),kameraPin.id);
    assert.equal(await p.locator('#pin-name').inputValue(),'K4 Kamera-Testpin');
    const vorher=await gemeinsameCam();
    await p.click('#pin-zentrum');
    await p.waitForFunction(()=>Math.abs(KARTE_V2_DEV.adapter().camera().zoom-16)<1e-6);
    const zentriert=await gemeinsameCam();
    assert.ok(zentriert.zoom>vorher.zoom&&Math.abs(zentriert.center[1]-52.505)<1e-6);
    await p.click('#k-plus');await gemeinsameCam();
    const zurueck=await gemeinsameCam();
    await p.evaluate(()=>dispatch({type:'NAVIGATION',modul:'dossier'}));
    await p.evaluate(()=>dispatch({type:'NAVIGATION',modul:'karte'}));await ready();
    assertCamera(await gemeinsameCam(),zurueck);
    await p.evaluate(()=>{window.__k4Adapter=KARTE_V2_DEV.adapter();});
    await providerDrain();
    const stilVor=stilAbrufe(),bildVor=bildAnfragen.length,frameVor=await p.locator('#k-3d-frame').count();
    await p.click('#k-3d');
    await p.waitForFunction(()=>Math.abs(KARTE_V2_DEV.adapter().camera().pitch-60)<1e-6&&$('k-3d').textContent==='2D');
    assert.equal(await p.locator('#k-v2-geneigt').getAttribute('aria-pressed'),'true');
    assert.equal(await p.locator('#k-3d-frame').count(),frameVor,'no new legacy iframe');
    assert.equal(await p.evaluate(()=>VIEW.karte.ansicht3d),false,'legacy renderer stays flat');
    const geneigt=await gemeinsameCam();
    // Pitch changes reproject the center, leaving sub-millimeter
    // floating-point noise. Keep the existing strict camera contract.
    assertCamera(geneigt,{...zurueck,pitch:60});
    await p.click('#k-v2-flach');
    await p.waitForFunction(()=>KARTE_V2_DEV.adapter().camera().pitch===0&&$('k-3d').textContent==='3D');
    assertCamera(await gemeinsameCam(),zurueck);
    await p.click('#k-v2-geneigt');
    await p.waitForFunction(()=>KARTE_V2_DEV.adapter().camera().pitch===60&&$('k-3d').textContent==='2D');
    // The pinned MapLibre 4.7.1 transform constrains both longitude and
    // latitude and may raise minimum zoom when world copies are disabled.
    // Observe the actual requested target separately from the attainable
    // camera. The isolated transform is an oracle for MapLibre's policy,
    // not a call to our production camera controller or a second map.
    await p.evaluate(()=>{
      const proto=maplibregl.Map.prototype,original=proto.jumpTo;
      window.__overviewJumps=[];
      proto.jumpTo=function(opts,...args){
        if(this.getContainer().id==='k-v2-map'&&Array.isArray(opts?.center)&&Number.isFinite(opts.zoom)){
          const tr=this.transform.clone();
          tr.zoom=opts.zoom;
          tr.center=maplibregl.LngLat.convert(opts.center);
          if(opts.bearing!==undefined)tr.bearing=opts.bearing;
          if(opts.pitch!==undefined)tr.pitch=opts.pitch;
          window.__overviewJumps.push({
            request:{center:opts.center.slice(),zoom:opts.zoom,pitch:opts.pitch??this.getPitch(),bearing:opts.bearing??this.getBearing()},
            expected:{center:tr.center.toArray(),zoom:tr.zoom,pitch:tr.pitch,bearing:tr.bearing},
            size:{width:tr.width,height:tr.height},singleWorld:!this.getRenderWorldCopies()
          });
        }
        return original.call(this,opts,...args);
      };
      window.__restoreOverview=()=>{proto.jumpTo=original;delete window.__restoreOverview;};
    });
    try{
      const uebersicht=async(selector,target)=>{
        await p.evaluate(()=>{window.__overviewJumps=[];});
        await p.click(selector);
        // reducedMotion=reduce: production uses synchronous jumpTo.
        const jumps=await p.evaluate(()=>window.__overviewJumps);
        assert.equal(jumps.length,1,selector+' exactly one camera command: '+JSON.stringify(jumps));
        const j=jumps[0],actual=await gemeinsameCam();
        assert.equal(j.singleWorld,true,'single world retained');
        assert.ok(j.size.width>0&&j.size.height>0,'real viewport');
        if(target)assertCamera(j.request,target);
        if(j.request.zoom<4){
          assert.equal(j.request.pitch,0,selector+' requested flat overview');
          assert.ok(j.request.bearing===0,selector+' requested north-up overview');
        }
        // Compare every parameter; allow only numerical projection residue.
        // The constrained minimum zoom may differ from the requested zoom.
        assert.ok(Math.abs(actual.zoom-j.expected.zoom)<1e-9,selector+' zoom '+JSON.stringify(j)+' actual '+JSON.stringify(actual));
        assertCamera(actual,{...j.expected,zoom:actual.zoom});
        return {actual,request:j.request};
      };
      await uebersicht('#k-v2-welt',{center:[20,25],zoom:1.9-.5,pitch:0,bearing:0});
      await uebersicht('#k-v2-europa',{center:[10,50],zoom:4.4-.5,pitch:0,bearing:0});
      // Region depends on the existing profile. Both controls must issue
      // identical requests and reach the same constrained real camera.
      const region=await uebersicht('#k-raum');
      await uebersicht('#k-v2-europa',{center:[10,50],zoom:4.4-.5,pitch:0,bearing:0});
      const v2Region=await uebersicht('#k-v2-region');
      assertCamera(v2Region.request,region.request);
      assertCamera(v2Region.actual,region.actual);
    }finally{await p.evaluate(()=>window.__restoreOverview?.());}
    await providerDrain();
    assert.equal(await p.evaluate(()=>__k4Adapter===KARTE_V2_DEV.adapter()),true,'overview/orientation preserve map');
    assert.equal(stilAbrufe(),stilVor);assert.equal(bildAnfragen.length,bildVor);
  }
  {
    // Placement masks must be visible in the new surface even in fullscreen.
    // Use the existing authorized and locked synthetic dossiers from above.
    await p.evaluate(id=>{
      Object.assign(VIEW.karte,{pick:'SI:'+id,lat:52.505,lon:13.405,zoom:15,auswahl:null});
      renderModule();
    },f.b);
    await ready();
    assert.equal(await p.locator('#k-v2-platzierung #k-pick-x').count(),1);
    assert.equal(await p.locator('#k-pick-x').count(),1);
    assert.match(await p.locator('#k-v2-platzierung').innerText(),/Sichtungsentwurf.*K2 Sued/);
    assert.ok(await p.locator('#k-v2-werkzeug-pin').isDisabled());
    await p.click('#k-v2-voll');
    assert.ok(await p.locator('#k-v2-platzierung').isVisible());
    const before=await p.evaluate(()=>{window.__pickAdapter=KARTE_V2_DEV.adapter();return {pins:PROFIL.pins.length,cam:__pickAdapter.camera()};});
    await p.click('#k-pick-x');
    assert.equal(await p.evaluate(()=>VIEW.karte.pick),null);
    assert.equal(await p.locator('#k-v2-platzierung').isVisible(),false);
    assert.equal(await p.locator('#k-v2-werkzeug-pin').isDisabled(),false);
    assert.equal(await p.evaluate(()=>__pickAdapter===KARTE_V2_DEV.adapter()),true);
    assert.equal(await p.evaluate(()=>PROFIL.pins.length),before.pins);
    assertCamera(await p.evaluate(()=>KARTE_V2_DEV.adapter().camera()),before.cam);
    await p.click('#k-v2-voll');
    // Actual dossier location placement via the common click contract.
    // Chromium delivers mouse coordinates at CSS-pixel precision. Capture
    // the native click BEFORE the map's handler rebuilds the module, then
    // independently unproject its actual position (not the requested point
    // or the application's stored result).
    const platzierungKlick=async ll=>{
      await p.evaluate(ll=>{
        window.__platzierungKlick=null;
        const el=$('k-v2-map').querySelector('.maplibregl-canvas-container');
        el.addEventListener('click',ev=>{
          const a=KARTE_V2_DEV.adapter(),r=el.getBoundingClientRect();
          const x=(ev.clientX-r.left)/(r.width/el.offsetWidth||1)-el.clientLeft;
          const y=(ev.clientY-r.top)/(r.height/el.offsetHeight||1)-el.clientTop;
          const ziel=a.project(ll);
          window.__platzierungKlick={trusted:ev.isTrusted,delta:Math.hypot(x-ziel.x,y-ziel.y),ll:a.unproject([x,y])};
        },{capture:true,once:true});
      },ll);
      await click(ll);
      const event=await p.evaluate(()=>window.__platzierungKlick);
      assert.ok(event?.trusted&&Number.isFinite(event.delta)&&event.delta<=2,
        'real native placement click within 2 CSS pixels: '+JSON.stringify(event));
      assert.ok(Array.isArray(event.ll)&&event.ll.length===2&&event.ll.every(Number.isFinite));
      return event.ll.map(v=>Math.round(v*1e5)/1e5);
    };
    await p.evaluate(id=>{VIEW.karte.pick=id;VIEW.karte.auswahl=null;renderModule();},f.b);
    await ready();
    assert.match(await p.locator('#k-v2-platzierung').innerText(),/Position.*K2 Sued/);
    const koordVor=await p.evaluate(id=>PROFIL.koord[id]||null,f.b);
    const erwartet=await platzierungKlick([52.505,13.405]);
    assert.notDeepEqual(koordVor,erwartet,'placement must actually change dossier position');
    await ready();
    assert.deepEqual(await p.evaluate(id=>PROFIL.koord[id],f.b),erwartet,'stored position matches rounded real click');
    assert.equal(await p.locator('#k-v2-platzierung').isVisible(),false);
    // Stale locked sighting placement must not disclose a name or write a pin.
    await p.evaluate(id=>{VIEW.karte.pick='SI:'+id;VIEW.karte.auswahl=null;renderModule();},f.a);
    await ready();
    assert.match(await p.locator('#k-v2-platzierung').innerText(),/Ziel nicht zugänglich/);
    const pinsVor=await p.evaluate(()=>PROFIL.pins.length);
    assert.equal(await p.evaluate(id=>dossierGesperrt(entitaet(id)),f.a),true,'locked fixture remains locked');
    await platzierungKlick([52.505,13.405]);await ready();
    assert.equal(await p.evaluate(()=>PROFIL.pins.length),pinsVor);
    assert.equal(await p.evaluate(()=>VIEW.karte.pick),null);
    assert.equal(await p.locator('#k-v2-platzierung').isVisible(),false);
  }
  {
    // Search after the earlier access-lock and real placement fixtures.
    const z=await p.evaluate(()=>{
      dispatch({type:'OZONE_ANGELEGT',ll:[52.51,13.42]});
      const id=PROFIL.zonen.at(-1).id;
      dispatch({type:'OZONE_GEAENDERT',id,name:'K4 Suchzone'});
      Object.assign(VIEW.karte.ebenen,{personen:true,zonen:true,pins:true,sichtungen:true});
      karteRendererDatenAktualisieren();
      return id;
    });
    await ready();await providerDrain();
    const netzVor=[anfragen.length,bildAnfragen.length,wetterAnfragen.length];
    const a=await p.evaluate(()=>{window.__suchAdapter=KARTE_V2_DEV.adapter();return __suchAdapter.camera();});
    const buttons=p.locator('#k-v2-suchergebnisse button');
    await p.fill('#k-v2-suche','K2 Nord');
    assert.equal(await buttons.count(),0,'locked name not searchable');
    await p.fill('#k-v2-suche',f.pin);
    assert.equal(await buttons.count(),0,'locked linked pin not searchable');
    await p.fill('#k-v2-suche',f.si);
    assert.deepEqual(await buttons.evaluateAll(bs=>bs.map(b=>b.dataset.renderKey)),[kb]);
    await p.selectOption('#k-v2-suchtyp','dossier');await p.fill('#k-v2-suche','k2 sued');assert.equal(await buttons.count(),1);
    await p.selectOption('#k-v2-suchtyp','zone');await p.fill('#k-v2-suche','K4 Suchzone');
    assert.equal(await buttons.count(),1);
    await p.evaluate(()=>{window.__alterSuchTreffer=$('k-v2-suchergebnisse').querySelector('button');});
    await p.locator('#k-v2-legende summary').click();await p.uncheck('#k-v2-eb-zonen');
    assert.equal(await buttons.count(),0,'filtered zone disappears immediately');
    await p.evaluate(()=>__alterSuchTreffer.click());
    assertCamera(await p.evaluate(()=>KARTE_V2_DEV.adapter().camera()),a);
    await p.check('#k-v2-eb-zonen');assert.equal(await buttons.count(),1);
    await p.locator('#k-v2-legende summary').click();
    assert.deepEqual([anfragen.length,bildAnfragen.length,wetterAnfragen.length],netzVor,'query/filter never contacts provider');
    await buttons.first().click();
    assert.equal(await p.evaluate(()=>VIEW.karte.auswahl),z);
    await p.waitForFunction(()=>Math.abs(KARTE_V2_DEV.adapter().camera().center[0]-13.42)<1e-6&&Math.abs(KARTE_V2_DEV.adapter().camera().center[1]-52.51)<1e-6);
    assert.equal(await p.locator('#oz-name').inputValue(),'K4 Suchzone');
    assert.equal(await p.evaluate(()=>__suchAdapter===KARTE_V2_DEV.adapter()),true);
    await p.selectOption('#k-v2-suchtyp','pin');await p.fill('#k-v2-suche','K4 Kamera-Testpin');
    assert.equal(await buttons.count(),1);await p.locator('#k-v2-suche').press('Enter');
    assert.equal(await p.locator('#pin-name').inputValue(),'K4 Kamera-Testpin');
    await p.selectOption('#k-v2-suchtyp','sichtung');await p.fill('#k-v2-suche',f.si);
    assert.equal(await buttons.count(),1);await buttons.first().click();
    assert.equal(await p.evaluate(()=>karteAuswahlSchluessel()),kb);
    assert.match(await p.locator('#k-auswahl').innerText(),/K2 Sued/);
    await p.selectOption('#k-v2-suchtyp','dossier');await p.fill('#k-v2-suche','K2 Sued');
    assert.equal(await buttons.count(),1);await buttons.first().click();
    assert.equal(await p.evaluate(()=>VIEW.karte.auswahl),f.b);
    assert.equal(await p.evaluate(()=>__suchAdapter===KARTE_V2_DEV.adapter()),true);
    await p.fill('#k-v2-suche','K2 Sued');await p.locator('#k-v2-suche').press('Escape');
    assert.equal(await p.locator('#k-v2-suche').inputValue(),'');assert.equal(await buttons.count(),0);
  }
  {
    // K4d-1: the existing export control is present once, in V2, even if
    // hidden because this profile has no orphaned exports.
    assert.equal(await p.locator('#k-export-verwaist-leiste').count(),1);
    assert.equal(await p.locator('#k-v2-panel #k-export-verwaist-leiste').count(),1);
    const before=await p.evaluate(()=>{
      window.__presetAdapter=KARTE_V2_DEV.adapter();
      return {cam:__presetAdapter.camera(),filters:{...VIEW.karte.ebenen}};
    });
    await providerDrain();
    const netzVor=[anfragen.length,bildAnfragen.length,wetterAnfragen.length];
    const details=p.locator('#k-v2-legende');
    if(!await details.evaluate(el=>el.open))await details.locator('summary').click();
    await p.click('#k-v2-preset-netzwerk');
    assert.equal(await p.locator('#k-v2-preset-netzwerk').getAttribute('aria-pressed'),'true');
    assert.equal(await p.locator('#k-v2-preset-gesamt').getAttribute('aria-pressed'),'false');
    assert.equal(await p.locator('#k-v2-eb-sichtungen').isChecked(),false);
    assert.equal(await p.locator('#k-v2-eb-ausgang').isChecked(),false);
    assert.equal(await p.locator('#ke-sichtungen').isChecked(),false);
    assert.equal(await p.evaluate(()=>karteRenderModell().marker.some(m=>m.kat==='sichtung')),false);
    await p.click('#k-v2-preset-gesamt');
    assert.equal(await p.locator('#k-v2-preset-gesamt').getAttribute('aria-pressed'),'true');
    assert.equal(await p.locator('#k-v2-eb-sichtungen').isChecked(),true);
    assert.equal(await p.locator('#ke-sichtungen').isChecked(),true);
    assert.equal(await p.evaluate(()=>karteRenderModell().marker.some(m=>m.kat==='sichtung')),true);
    for(const key of ['pins','zonen','kacheln']){
      assert.equal(await p.evaluate(key=>VIEW.karte.ebenen[key],key),before.filters[key],'unrelated filter '+key);
    }
    await p.uncheck('#k-v2-eb-personen');
    assert.equal(await p.locator('#k-v2-preset-gesamt').getAttribute('aria-pressed'),'false');
    await p.check('#k-v2-eb-personen');
    assert.equal(await p.locator('#k-v2-preset-gesamt').getAttribute('aria-pressed'),'true');
    assert.equal(await p.evaluate(()=>__presetAdapter===KARTE_V2_DEV.adapter()),true);
    assertCamera(await p.evaluate(()=>KARTE_V2_DEV.adapter().camera()),before.cam);
    await providerDrain();
    assert.deepEqual([anfragen.length,bildAnfragen.length,wetterAnfragen.length],netzVor,'preset changes are local');
  }
  await p.close();
  assert.deepEqual(errors,[]);
 }finally{await b.close();}
 console.log('OK: K2b-2b gefiltertes Anwendungsmodell, echte MapLibre-Klicks, Sperre, Ebenen und Lebenszyklus');
})().catch(e=>{console.error(e);process.exitCode=1;});
