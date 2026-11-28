'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {APP}=require('./_pfad');
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
 try{
  for(const [art,viewport] of [['bibliothek',{width:1500,height:1100}],['webgl',{width:1500,height:1100}],['initialisierung',{width:1500,height:1100}],['layer',{width:1500,height:1100}],['layer',{width:1200,height:900}],['update',{width:1500,height:1100}],['source',{width:1500,height:1100}]]){
   const p=await b.newPage({viewport,reducedMotion:'reduce'});
   let vorher=null;
   const errors=[],anfragen=[],diagnosen=[];p.on('pageerror',e=>errors.push(e.message));
   p.on('console',msg=>{if(msg.text().startsWith('[Shadow V2] '))diagnosen.push(msg.text());});
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
    }else if(art==='initialisierung'){
      // All libraries have loaded except the final local diagnostic script.
      // Inject a fault only after map construction, not in the constructor.
      const append=HTMLHeadElement.prototype.appendChild;
      HTMLHeadElement.prototype.appendChild=function(node){
        if(node.tagName==='SCRIPT'&&node.src.endsWith('/karte-v2-diagnose.js')&&!window.__initPatch){
          window.__initPatch=true;
          const orig=maplibregl.Map.prototype.addControl;
          maplibregl.Map.prototype.addControl=function(control,...args){
            if(control instanceof maplibregl.NavigationControl){
              ++window.__mapVersuche;
              window.__konstruierteMap=!!this.getCanvas();
              throw new TypeError('synthetic-secret-DO-NOT-LOG https://example.invalid/?key=fixture');
            }
            return orig.call(this,control,...args);
          };
        }
        return append.call(this,node);
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
     vorher=await p.evaluate(()=>{
       const a=KARTE_V2_DEV.adapter(),cam=a.camera(),ll1=[cam.center[1],cam.center[0]],ll2=[cam.center[1],cam.center[0]+.001];
       const p=a.project(ll1),q=a.project(ll2);
       return {cam,ll1,ll2,px:Math.hypot(q.x-p.x,q.y-p.y)};
     });
     assert.ok(vorher.cam.pitch===0&&vorher.cam.bearing===0&&vorher.px>0);
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
   if(art==='update'||art==='source'){
     await p.waitForFunction(()=>KARTE_V2_DEV.adapter()?.ready()&&$('k-v2-status')?.textContent.includes('Kein lokaler CARTO-Schlüssel'));
     const probe=await p.evaluate(art=>{
       const a=KARTE_V2_DEV.adapter(),orig=maplibregl.Map.prototype.flyTo;let map;
       maplibregl.Map.prototype.flyTo=function(...args){map=this;return orig.apply(this,args);};
       try{a.flyTo({...a.camera(),duration:0});}finally{maplibregl.Map.prototype.flyTo=orig;}
       if(!map)throw Error('real map not observed');
       // Provider-prefixed IDs are not local object sources.
       map.fire('error',{sourceId:'shadow-v2-hybrid-999',error:new Error('fixture provider')});
       const bereit=a.ready();
       if(art==='update'){
         map.getSource('shadow-v2-mess').setData=()=>{++window.__mapVersuche;throw new TypeError('synthetic-secret-DO-NOT-LOG');};
         a.setData(karteRenderModell(),{mess:[[52.5,13.4]]});
       }else{
         ++window.__mapVersuche;
         map.fire('error',{sourceId:'shadow-v2-punkte',error:new Error('synthetic-secret-DO-NOT-LOG')});
         map.fire('error',{sourceId:'shadow-v2-punkte',error:new Error('duplicate fixture')});
       }
       return {bereit,danach:a.ready(),treffer:a.hitTest({x:0,y:0})};
     },art);
     assert.deepEqual(probe,{bereit:true,danach:false,treffer:null},'local failure immediately disables old hits; provider prefix does not');
   }
   await p.waitForSelector('#k-v2-rueckfall');
   const code={bibliothek:'V2-LIB',webgl:'V2-MAP',initialisierung:'V2-INIT',layer:'V2-LAYER',update:'V2-UPDATE',source:'V2-SOURCE'}[art];
   const meldung=await p.locator('#k-v2-rueckfall').innerText();
   assert.ok(meldung.includes('Diagnose: '+code+'.'),art+' correct diagnostic phase: '+meldung);
   assert.equal(diagnosen.length,1,art+' exactly one active-context diagnostic');
   assert.ok(['Error','TypeError','RangeError','unbekannt'].some(typ=>diagnosen[0]==='[Shadow V2] '+code+' ('+typ+')'));
   if(art==='update'||art==='source')assert.ok(!meldung.includes('synthetic-secret'));
   if(art==='initialisierung'){
     assert.equal(await p.evaluate(()=>__konstruierteMap),true,'failure after map construction');
     assert.equal(diagnosen[0],'[Shadow V2] V2-INIT (TypeError)');
     assert.ok(!meldung.includes('synthetic-secret')&&!meldung.includes('example.invalid'));
   }
   if(art==='layer'){
     assert.equal(await p.evaluate(()=>__teilLayer),true,'failure after partial installation');
     assert.match(await p.locator('#k-v2-rueckfall').innerText(),/MapLibre-Objektlayer konnten nicht aufgebaut werden/);
     const nachher=await p.evaluate(({ll1,ll2})=>{
       const svg=$('k-svg'),m=svg.getScreenCTM(),P=karteProj(),K=VIEW.karte;
       const a=new DOMPoint(P.px(ll1[1]),P.py(ll1[0])).matrixTransform(m),b=new DOMPoint(P.px(ll2[1]),P.py(ll2[0])).matrixTransform(m);
       return {px:Math.hypot(b.x-a.x,b.y-a.y),faktor:Math.hypot(m.a,m.b),zoom:K.zoom,lat:K.lat,lon:K.lon};
     },{ll1:vorher.ll1,ll2:vorher.ll2});
     assert.ok(nachher.faktor>0&&Number.isFinite(nachher.faktor));
     assert.ok(Math.abs(nachher.px-vorher.px)<1e-6,'same flat CSS scale after fallback '+JSON.stringify({viewport,vorher,nachher}));
     assert.ok(Math.abs(nachher.lat-vorher.cam.center[1])<1e-9&&Math.abs(nachher.lon-vorher.cam.center[0])<1e-9,'fallback center unchanged');
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
   assert.equal(diagnosen.length,1,'no duplicate diagnostic after navigation');
   assert.equal(await p.evaluate(id=>PROFIL.pins.some(x=>x.id===id),id),true);
   assert.deepEqual(anfragen,[],art+' offline fallback');
   assert.deepEqual(errors,[],art+' no uncaught application errors');
   await p.close();
  }
  console.log('OK: Bibliotheks-, WebGL-, Anwendungsaufbau- und nachträglicher Objektlayerfehler sowie lokale Update-/Quellfehler, vollständiger SVG-Rückfall, flacher Maßstab bei zwei Fenstergrößen, keine automatischen Neuversuche');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
