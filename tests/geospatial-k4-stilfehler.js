'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {APP}=require('./_pfad');
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
 try{
  for(const art of ['style','vorlauf']){
   const p=await b.newPage({viewport:{width:1500,height:1100},reducedMotion:'reduce'});
   const errors=[],anfragen=[],diagnosen=[];
   p.on('pageerror',e=>errors.push(e.message));
   p.on('console',m=>{if(m.text().startsWith('[Shadow V2] '))diagnosen.push(m.text());});
   await p.route(/^https?:/,r=>{
    anfragen.push(new URL(r.request().url()).hostname);
    return r.fulfill({status:500,body:'fixture',headers:{'access-control-allow-origin':'*'}});
   });
   await p.addInitScript(()=>{Element.prototype.requestFullscreen=()=>Promise.resolve();window.__versuche=0;});
   await p.goto(APP+'?geospatial-v2=solo');
   await p.fill('#gate-pw','pw-test-123');if(await p.isVisible('#gate-pw2'))await p.fill('#gate-pw2','pw-test-123');
   await p.click('#gate-go');await p.waitForFunction(()=>!document.body.classList.contains('locked'));
   const id=await p.evaluate(art=>{
    dispatch({type:'PIN_ANGELEGT',name:'Lokaler Stil Testpin',ll:[52.5,13.4]});
    const id=PROFIL.pins.at(-1).id;
    Object.assign(VIEW.karte,{lat:52.5,lon:13.4,zoom:15,init:true,auswahl:id,cartoKey:''});
    VIEW.karte.ebenen.kacheln=false;VIEW.karte.wetterOnline=false;
    if(art==='vorlauf'){
     const orig=document.addEventListener;
     document.addEventListener=function(typ,fn,opts){
      if(typ==='keydown'&&opts===true&&$('k-v2-map')){
       document.addEventListener=orig;++window.__versuche;
       throw new TypeError('synthetic-secret-DO-NOT-LOG');
      }
      return orig.call(this,typ,fn,opts);
     };
    }
    dispatch({type:'NAVIGATION',modul:'karte'});
    return id;
   },art);
   if(art==='style'){
    await p.waitForFunction(()=>KARTE_V2_DEV.adapter()?.ready()&&$('k-v2-status')?.textContent.includes('Kein lokaler CARTO-Schlüssel'));
    // Positive control: normal local reload must not claim readiness before style installation.
    await p.evaluate(()=>{
     const orig=maplibregl.Map.prototype.setStyle;
     maplibregl.Map.prototype.setStyle=function(...args){
      window.__vorStatus=$('k-v2-status').textContent;
      const result=orig.apply(this,args);window.__nachBereit=KARTE_V2_DEV.adapter()?.ready();return result;
     };
     window.__originalSetStyle=orig;
    });
    await p.click('#k-v2-leer');
    await p.waitForFunction(()=>KARTE_V2_DEV.adapter()?.ready()&&$('k-v2-status')?.textContent.includes('Ohne Basiskarte'));
    assert.equal(await p.evaluate(()=>__vorStatus),'Lokaler Kartenstil wird wiederhergestellt.');
    assert.equal(await p.evaluate(()=>__nachBereit),false);
    await p.evaluate(()=>{
      maplibregl.Map.prototype.setStyle=function(){++window.__versuche;throw new TypeError('synthetic-secret-DO-NOT-LOG');};
      VIEW.karte.cartoKey='cb1_ci_fixture_not_a_real_token';
    });
    await p.click('#k-v2-shadow');
   }
   await p.waitForSelector('#k-v2-rueckfall');
   const code=art==='style'?'V2-STYLE':'V2-INIT';
   const meldung=await p.locator('#k-v2-rueckfall').innerText();
   assert.ok(meldung.includes('Diagnose: '+code+'.')&&!meldung.includes('synthetic-secret'));
   assert.deepEqual(diagnosen,['[Shadow V2] '+code+' (TypeError)']);
   assert.equal(await p.evaluate(()=>__versuche),1);
   assert.equal(await p.evaluate(()=>KARTE_V2_DEV.rueckfall&&KARTE_V2_DEV.adapter()===null&&KARTE_ST.aktiv()),true);
   assert.equal(await p.locator('#pin-name').inputValue(),'Lokaler Stil Testpin');
   assert.equal(await p.evaluate(()=>VIEW.karte.auswahl),id);
   await p.evaluate(()=>{dispatch({type:'NAVIGATION',modul:'dossier'});dispatch({type:'NAVIGATION',modul:'karte'});});
   await p.waitForSelector('#k-v2-rueckfall');
   assert.equal(await p.evaluate(()=>__versuche),1);
   assert.equal(diagnosen.length,1);assert.deepEqual(errors,[]);
   assert.equal(anfragen.length,art==='style'?1:0,'only intentional fixture style request');
   await p.close();
  }
 }finally{await b.close();}
 console.log('OK: ehrlicher lokaler Stilstatus, V2-STYLE nach Providerfehler, synchroner Mount-Vorlauf V2-INIT');
})().catch(e=>{console.error(e);process.exitCode=1;});
