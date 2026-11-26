'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {APP}=require('./_pfad');
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
 try{
  const p=await b.newPage({viewport:{width:1500,height:1100},reducedMotion:'reduce'});p.setDefaultTimeout(25000);
  const errors=[],anfragen=[];let netz='ok';p.on('pageerror',e=>errors.push(e.message));
  const Q=require('../karte-v2-quellen');
  const tile='https://tiles.basemaps.cartocdn.com/v/fixture/vectortiles/test/{z}/{x}/{y}.mvt';
  // Leere, aber gültige MVT-Layer (Name buildings, Version 2, Extent 4096).
  const layer=Buffer.concat([Buffer.from([10,9]),Buffer.from('buildings'),Buffer.from([120,2,40,128,32])]);
  const mvt=Buffer.concat([Buffer.from([26,layer.length]),layer]);
  const stil={version:8,sources:{protomaps:{type:'vector',tiles:[tile],maxzoom:15,attribution:'© CARTO'}},layers:[
    {id:'bg',type:'background',paint:{'background-color':'#304050'}},
    {id:'buildings',source:'protomaps','source-layer':'buildings',type:'fill',paint:{'fill-color':'#888'}}
  ]};
  await p.route(/^https?:/,async r=>{
    const u=new URL(r.request().url()),bare=u.origin+u.pathname;
    if(bare===Q.stil('voyager')||bare===Q.stil('dunkel')){
      anfragen.push({art:'stil',key:u.searchParams.get('key'),referer:r.request().headers().referer||''});
      if(netz==='stilfehler')return r.abort();
      return r.fulfill({json:stil,headers:{'access-control-allow-origin':'*'}});
    }
    if(u.hostname==='tiles.basemaps.cartocdn.com'&&u.pathname.startsWith('/v/fixture/')){
      anfragen.push({art:'tile',key:u.searchParams.get('key'),referer:r.request().headers().referer||''});
      if(netz==='kachelfehler')return r.abort();
      return r.fulfill({body:mvt,contentType:'application/vnd.mapbox-vector-tile',headers:{'access-control-allow-origin':'*'}});
    }
    return r.abort();
  });
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
  const ready=()=>p.waitForFunction(()=>document.getElementById('k-v2-status')?.textContent.includes('Objektlayer bereit')&&KARTE_V2_DEV.adapter()?.ready());
  await ready();
  assert.ok(await p.locator('#k-svg').isVisible(),'SVG bleibt vorhanden');
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
  const status=text=>p.waitForFunction(text=>$('k-v2-status')?.textContent.includes(text),text);
  const fixtureKey='K2C_FIXTURE+/k';
  // Der bestehende Raster-Schlüssel ist nicht die V2-Quelle.
  await p.evaluate(()=>{window.KARTEN_SCHLUESSEL={carto:''};});
  const ohne=anfragen.length;await p.click('#k-v2-voyager');await status('Kein lokaler CARTO-Schlüssel');
  assert.equal(anfragen.length,ohne);
  await p.evaluate(key=>{window.KARTEN_SCHLUESSEL={carto:key};VIEW.karte.messen=true;VIEW.karte.messPts=[[52.51,13.41]];karteRendererDatenAktualisieren();},fixtureKey);
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
  await p.click('#k-v2-dunkel');await status('Dark Matter bereit');
  assert.equal(await p.locator('#k-v2-gebaeude').getAttribute('aria-pressed'),'true','Gebäudewunsch über Stilwechsel');
  await p.click('#k-v2-gebaeude');
  assert.equal(await p.locator('#k-v2-gebaeude').getAttribute('aria-pressed'),'false');
  assert.deepEqual(await p.evaluate(()=>KARTE_V2_DEV.adapter().camera()),cam);
  assert.equal((await hit([52.51,13.41])).renderKey,kb);
  assert.ok(anfragen.every(x=>x.key===fixtureKey&&!x.referer),'Schlüssel und Referrer');
  assert.ok(!(await p.locator('body').innerText()).includes(fixtureKey));
  assert.equal(await p.evaluate(k=>Object.values(localStorage).some(v=>v.includes(k)),fixtureKey),false);
  // ready() bedeutet Layer installiert, nicht GeoJSON-Worker fertig.
  // Auf einen tatsächlich gerenderten Treffer warten, nicht nur auf Registrierung.
  const rueckfallTreffer=async()=>{
    await p.waitForFunction(({ll,k})=>{
      const a=KARTE_V2_DEV.adapter();
      return a?.ready()&&a.hitTest(a.project(ll))?.renderKey===k;
    },{ll:[52.51,13.41],k:kb});
    assert.equal((await hit([52.51,13.41]))?.renderKey,kb);
    assert.deepEqual(await p.evaluate(()=>KARTE_V2_DEV.adapter().camera()),cam);
    assert.equal(await p.evaluate(()=>karteAuswahlSchluessel()),kb);
    assert.deepEqual(await p.evaluate(()=>VIEW.karte.messPts),[[52.51,13.41]]);
    assert.equal(await p.locator('#k-v2-leer').getAttribute('aria-pressed'),'true');
    assert.equal(await p.locator('#k-v2-gebaeude').isDisabled(),true);
  };
  netz='stilfehler';await p.click('#k-v2-voyager');await status('CARTO-Stil nicht verfügbar');
  await rueckfallTreffer();
  netz='kachelfehler';await p.click('#k-v2-dunkel');await status('CARTO-Ressource nicht verfügbar');
  await rueckfallTreffer();
  netz='ok';await p.evaluate(()=>{VIEW.karte.messen=false;VIEW.karte.messPts=[];karteRendererDatenAktualisieren();});
  await p.evaluate(()=>{window.__alt=KARTE_V2_DEV.adapter();});
  await p.evaluate(id=>dispatch({type:'DOSSIER_SPERREN',id}),f.a);
  assert.equal(await p.evaluate(()=>__alt.ready()),false,'alter Renderer freigegeben');
  await ready();
  assert.equal(await hit([52.5,13.4]),null);assert.equal(await hit([52.505,13.395]),null);assert.equal(await hit([52.505,13.415]),null);
  assert.equal((await hit([52.51,13.41])).renderKey,kb);
  await p.evaluate(()=>{VIEW.karte.sichtungFokus=null;VIEW.karte.ebenen.sichtungen=false;karteRendererDatenAktualisieren();});
  assert.equal(await hit([52.51,13.41]),null,'Treffer bereits vor Worker-Update ungültig');
  await p.evaluate(()=>{VIEW.karte.ebenen.sichtungen=true;karteRendererDatenAktualisieren();});
  await p.waitForFunction(()=>{const a=KARTE_V2_DEV.adapter();return !!a.hitTest(a.project([52.51,13.41]));});
  await p.evaluate(()=>{VIEW.karte.messen=true;VIEW.karte.messPts=[];});
  await click([52.51,13.41]);assert.deepEqual(await p.evaluate(()=>VIEW.karte.messPts),[[52.51,13.41]],'Messpunkt rastet an realer Sichtung ein');
  await p.evaluate(()=>{VIEW.karte.messen=false;VIEW.karte.messPts=[];VIEW.karte.pinSetzen=true;});
  const n=await p.evaluate(()=>PROFIL.pins.length);
  await click([52.503,13.407]);assert.equal(await p.evaluate(()=>PROFIL.pins.length),n+1,'gemeinsame Pin-Aktion');
  await ready();
  await p.evaluate(()=>{window.__alt=KARTE_V2_DEV.adapter();dispatch({type:'NAVIGATION',modul:'dossier'});});
  assert.equal(await p.locator('#k-v2-map').count(),0);
  assert.equal(await p.evaluate(()=>__alt.ready()),false);
  await p.evaluate(()=>dispatch({type:'NAVIGATION',modul:'karte'}));await ready();
  assert.ok(await p.evaluate(()=>KARTE_V2_DEV.adapter()!==__alt));
  /* Reale Zugangssperre und erneute Freigabe, ohne Navigation oder Neuladen. */
  await p.evaluate(()=>{window.__alt=KARTE_V2_DEV.adapter();Zugang.sperren('K2-Test');});
  assert.equal(await p.evaluate(()=>__alt.ready()),false);
  assert.equal(await p.locator('#k-v2-map canvas').count(),0);
  await p.fill('#gate-pw','pw-test-123');await p.click('#gate-go');
  await p.waitForFunction(()=>!document.body.classList.contains('locked'));
  await ready();
  assert.ok(await p.evaluate(()=>KARTE_V2_DEV.adapter()!==__alt));
  const standard=await b.newPage({reducedMotion:'reduce'});await standard.route(/^https?:/,r=>r.abort());await standard.goto(APP);
  await standard.fill('#gate-pw','pw-test-123');if(await standard.isVisible('#gate-pw2'))await standard.fill('#gate-pw2','pw-test-123');await standard.click('#gate-go');
  await standard.waitForFunction(()=>!document.body.classList.contains('locked'));
  await standard.evaluate(()=>dispatch({type:'NAVIGATION',modul:'karte'}));
  assert.equal(await standard.locator('#k-v2-map').count(),0);
  assert.equal(await standard.evaluate(()=>typeof maplibregl),'undefined','keine Bibliotheksladung ohne Opt-in');
  await standard.close();assert.deepEqual(errors,[]);
  console.log('OK: K2b-2b gefiltertes Anwendungsmodell, echte MapLibre-Klicks, Sperre, Ebenen und Lebenszyklus');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
