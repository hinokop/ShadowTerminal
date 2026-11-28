'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {APP}=require('./_pfad');
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
 try{
  for(const art of ['bibliothek','webgl','layer']){
   const p=await b.newPage({viewport:{width:1500,height:1100},reducedMotion:'reduce'});
   const errors=[],anfragen=[];p.on('pageerror',e=>errors.push(e.message));
   await p.route(/^https?:/,r=>{anfragen.push(r.request().url());return r.abort();});
   await p.addInitScript(art=>{
    window.__mapVersuche=0;
    Element.prototype.requestFullscreen=()=>Promise.resolve();
    if(art==='bibliothek'){
      const orig=HTMLHeadElement.prototype.appendChild;
      HTMLHeadElement.prototype.appendChild=function(node){
        if(node.tagName==='SCRIPT'&&node.src.endsWith('/vendor/maplibre-gl/maplibre-gl.js')){
          ++window.__mapVersuche;
          queueMicrotask(()=>node.dispatchEvent(new Event('error')));
          return node;
        }
        return orig.call(this,node);
      };
    }else if(art==='webgl'){
      const orig=HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext=function(typ,...args){
        if(['webgl','webgl2','experimental-webgl'].includes(typ)){++window.__mapVersuche;return null;}
        return orig.call(this,typ,...args);
      };
    }
   },art);
   await p.goto(APP+'?geospatial-v2=solo');
   await p.fill('#gate-pw','pw-test-123');if(await p.isVisible('#gate-pw2'))await p.fill('#gate-pw2','pw-test-123');
   await p.click('#gate-go');await p.waitForFunction(()=>!document.body.classList.contains('locked'));
   const id=await p.evaluate(()=>{
     dispatch({type:'PIN_ANGELEGT',name:'K4 Rückfallpin',ll:[52.5,13.4]});
     const id=PROFIL.pins.at(-1).id;
     // Keep the test's legacy provider offline before any render.
     VIEW.karte.ebenen.kacheln=false;VIEW.karte.cartoKey='';
     dispatch({type:'NAVIGATION',modul:'karte'});
     Object.assign(VIEW.karte,{lat:52.5,lon:13.4,zoom:15,init:true,auswahl:id});
     renderModule();
     return id;
   });
   if(art==='layer'){
     // Positive control: an operational solo map before the fault is injected.
     await p.waitForFunction(()=>KARTE_V2_DEV.adapter()?.ready()&&$('k-v2-status')?.textContent.includes('Kein lokaler CARTO-Schlüssel'));
     assert.equal(await p.locator('#pin-name').inputValue(),'K4 Rückfallpin');
     assert.equal(await p.locator('#k-svg').count(),0);
     await p.evaluate(()=>{
       const orig=maplibregl.Map.prototype.addLayer;
       maplibregl.Map.prototype.addLayer=function(layer,...args){
         if(layer.id==='shadow-v2-punkt'){
           ++window.__mapVersuche;
           window.__teilLayer=!!this.getLayer('shadow-v2-zone-fill');
           throw Error('K4 test: local symbol layer installation');
         }
         return orig.call(this,layer,...args);
       };
     });
     // Real style reload: failure occurs in the adapter's asynchronous style.load.
     await p.click('#k-v2-leer');
   }
   await p.waitForSelector('#k-v2-rueckfall');
   if(art==='layer'){
     assert.equal(await p.evaluate(()=>__teilLayer),true,'failure after partial installation');
     assert.match(await p.locator('#k-v2-rueckfall').innerText(),/MapLibre-Objektlayer konnten nicht aufgebaut werden/);
   }
   assert.equal(await p.locator('#k-v2-map').count(),0);
   assert.equal(await p.locator('.karte-wrap #k-status').count(),1);
   assert.equal(await p.locator('.karte-wrap #k-auswahl').count(),1);
   assert.equal(await p.locator('#k-export-verwaist-leiste').count(),1);
   assert.equal(await p.locator('#pin-name').inputValue(),'K4 Rückfallpin');
   assert.equal(await p.evaluate(()=>KARTE_V2_DEV.rueckfall&&!KARTE_V2_DEV.aktiviert&&KARTE_V2_DEV.adapter()===null&&KARTE_ST.aktiv()),true);
   assert.equal(await p.evaluate(()=>VIEW.karte.ebenen.kacheln),false);
   assert.equal(await p.evaluate(()=>VIEW.karte.auswahl),id);
   const versuche=await p.evaluate(()=>__mapVersuche);assert.ok(versuche>0,art+' injected failure exercised');
   await p.click('#k-pin-neu');
   assert.equal(await p.evaluate(()=>VIEW.karte.pinSetzen),true);
   await p.click('#k-pin-neu');
   assert.equal(await p.evaluate(()=>VIEW.karte.pinSetzen),false);
   await p.evaluate(()=>dispatch({type:'NAVIGATION',modul:'dossier'}));
   await p.evaluate(()=>dispatch({type:'NAVIGATION',modul:'karte'}));
   await p.waitForSelector('#k-v2-rueckfall');
   assert.equal(await p.evaluate(()=>__mapVersuche),versuche,'no automatic retry');
   assert.equal(await p.evaluate(id=>PROFIL.pins.some(x=>x.id===id),id),true);
   assert.deepEqual(anfragen,[],art+' offline fallback');
   assert.deepEqual(errors,[],art+' no uncaught application errors');
   await p.close();
  }
  console.log('OK: Bibliotheks-, WebGL- und nachträglicher Objektlayerfehler, vollständiger SVG-Rückfall, keine automatischen Neuversuche');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
