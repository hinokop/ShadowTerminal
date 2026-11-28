'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {APP}=require('./_pfad');
// Independent startup/profile regression extracted from the long K2 integration scenario.
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
 try{
  const errors=[],anfragen=[],bildAnfragen=[],wetterAnfragen=[];let netz='ok',einzelFehler=0,bildFehler=false,berlinFehler=false;
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
  // Echtes Laden des alten Browserprofils mit abweichender Schlüsseldatei.
  // Nur der in .kartenwahl bereits vorhandene Key darf verwendet werden.
  const browserKey='K2C_BROWSER_STORED+/k', stored=await b.newPage({reducedMotion:'reduce'});
  stored.on('pageerror',e=>errors.push(e.message));
  await stored.addInitScript(k=>{try{localStorage.setItem('fieldterminal.v1.kartenwahl',JSON.stringify({ebenen:{},cartoKey:k,anbieter:'osm'}));}catch(e){}},browserKey);
  await stored.route(/^https?:/,route);
  await stored.goto(APP+'?geospatial-v2=1');
  await stored.fill('#gate-pw','pw-test-123');if(await stored.isVisible('#gate-pw2'))await stored.fill('#gate-pw2','pw-test-123');await stored.click('#gate-go');
  await stored.waitForFunction(()=>!document.body.classList.contains('locked'));
  assert.ok(await stored.evaluate(k=>VIEW.karte.cartoKey===k,browserKey));
  const gespeichertVorher=anfragen.length;
  await stored.evaluate(()=>dispatch({type:'NAVIGATION',modul:'karte'}));
  await stored.waitForFunction(()=>$('k-v2-status')?.textContent.includes('Shadow bereit'));
  assert.ok(anfragen.length>gespeichertVorher&&anfragen.slice(gespeichertVorher).every(x=>x.key===browserKey&&!x.referer),'Browserquelle hat Vorrang beim Start');
  {
    // Persist filters in the existing settings record, preserving key/provider.
    await stored.locator('#k-v2-legende summary').click();
    await stored.uncheck('#k-v2-eb-pins');await stored.uncheck('#k-v2-eb-zonen');
    const gespeicherteFilter=await stored.evaluate(()=>JSON.parse(localStorage.getItem(STORAGE_KEY+'.kartenwahl')));
    assert.equal(gespeicherteFilter.ebenen.pins,false);assert.equal(gespeicherteFilter.ebenen.zonen,false);
    assert.equal(gespeicherteFilter.cartoKey,browserKey);assert.equal(gespeicherteFilter.anbieter,'osm');
    // Fresh context with the actual saved record, not in-memory VIEW state.
    const filterSeite=await b.newPage({reducedMotion:'reduce'});
    filterSeite.on('pageerror',e=>errors.push(e.message));
    await filterSeite.addInitScript(wahl=>localStorage.setItem('fieldterminal.v1.kartenwahl',JSON.stringify(wahl)),gespeicherteFilter);
    await filterSeite.route(/^https?:/,route);
    await filterSeite.goto(APP+'?geospatial-v2=1');
    await filterSeite.fill('#gate-pw','pw-test-123');if(await filterSeite.isVisible('#gate-pw2'))await filterSeite.fill('#gate-pw2','pw-test-123');await filterSeite.click('#gate-go');
    await filterSeite.waitForFunction(()=>!document.body.classList.contains('locked'));
    assert.equal(await filterSeite.evaluate(()=>VIEW.karte.ebenen.pins===false&&VIEW.karte.ebenen.zonen===false),true);
    await filterSeite.evaluate(()=>dispatch({type:'NAVIGATION',modul:'karte'}));
    await filterSeite.waitForFunction(()=>$('k-v2-status')?.textContent.includes('Shadow bereit'));
    await filterSeite.locator('#k-v2-legende summary').click();
    assert.equal(await filterSeite.locator('#k-v2-eb-pins').isChecked(),false);
    assert.equal(await filterSeite.locator('#k-v2-eb-zonen').isChecked(),false);
    await filterSeite.close();
  }
  await stored.close();
  const standard=await b.newPage({reducedMotion:'reduce'});standard.on('pageerror',e=>errors.push(e.message));await standard.route(/^https?:/,r=>r.abort());await standard.goto(APP);
  await standard.fill('#gate-pw','pw-test-123');if(await standard.isVisible('#gate-pw2'))await standard.fill('#gate-pw2','pw-test-123');await standard.click('#gate-go');
  await standard.waitForFunction(()=>!document.body.classList.contains('locked'));
  await standard.evaluate(()=>dispatch({type:'NAVIGATION',modul:'karte'}));
  assert.equal(await standard.locator('#k-v2-map').count(),0);
  assert.equal(await standard.locator('#k-v2-paneele').count(),0);
  assert.equal(await standard.locator('#k-export-verwaist-leiste').count(),1);
  assert.equal(await standard.locator('#k-v2-preset-gesamt').count(),0);
  assert.equal(await standard.locator('.karte-wrap #k-status').count(),1);
  assert.equal(await standard.locator('.karte-wrap #k-auswahl').count(),1);
  assert.equal(await standard.locator('#k-v2-inspektor-klapp').count(),0);
  assert.equal(await standard.evaluate(()=>typeof maplibregl),'undefined','keine Bibliotheksladung ohne Opt-in');
  assert.equal(await standard.evaluate(()=>typeof KARTE_V2_QUELLENSTEUERUNG.erstellen==='function'&&
    typeof KARTE_V2_OBERFLAECHE.erstellen==='function'&&KARTE_V2_DEV.aktiviert===false&&KARTE_V2_DEV.adapter()===null),true,'passive factory scripts in standard view');
  await standard.close();assert.deepEqual(errors,[]);
 }finally{await b.close();}
 console.log('OK: Browser-Schlüsselvorrang, Filterpersistenz und unveränderter Standardstart');
})().catch(e=>{console.error(e);process.exitCode=1;});
