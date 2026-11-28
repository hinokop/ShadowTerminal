'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {APP}=require('./_pfad');
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
 try{
  const p=await b.newPage({viewport:{width:1500,height:1100},reducedMotion:'reduce'});
  const net=[],errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.route(/^https?:/,r=>{net.push(r.request().url());return r.abort();});
  await p.addInitScript(()=>{Element.prototype.requestFullscreen=()=>Promise.resolve();});
  await p.goto(APP+'?geospatial-v2=solo');
  await p.fill('#gate-pw','pw-test-123');if(await p.isVisible('#gate-pw2'))await p.fill('#gate-pw2','pw-test-123');await p.click('#gate-go');
  await p.waitForFunction(()=>!document.body.classList.contains('locked'));
  const id=await p.evaluate(()=>{
    VIEW.karte.cartoKey='';VIEW.karte.ebenen.kacheln=false;
    dispatch({type:'PIN_ANGELEGT',name:'K4 Solo Test',ll:[52.5,13.4]});
    const id=PROFIL.pins.at(-1).id;
    dispatch({type:'NAVIGATION',modul:'karte'});
    Object.assign(VIEW.karte,{lat:52.5,lon:13.4,zoom:15,init:true,auswahl:id});
    renderModule();return id;
  });
  await p.waitForFunction(()=>KARTE_V2_DEV.adapter()?.ready()&&$('k-v2-status')?.textContent.includes('Kein lokaler CARTO-Schlüssel'));
  assert.equal(await p.locator('#k-svg').count(),0);
  assert.equal(await p.evaluate(()=>KARTE_ST===null&&KARTE_V2_DEV.solo),true);
  assert.equal(await p.locator('#pin-name').inputValue(),'K4 Solo Test');
  await p.evaluate(()=>{window.__soloAdapter=KARTE_V2_DEV.adapter();});
  await p.locator('#k-v2-legende summary').click();await p.uncheck('#k-v2-eb-pins');
  assert.equal(await p.locator('#k-auswahl').isVisible(),false);
  await p.check('#k-v2-eb-pins');
  await p.locator('#k-v2-legende summary').click();
  await p.fill('#k-v2-suche','K4 Solo Test');await p.locator('#k-v2-suchergebnisse button').first().click();
  assert.equal(await p.evaluate(()=>VIEW.karte.auswahl),id);
  await p.click('#k-v2-werkzeug-pin');await p.click('#k-v2-werkzeug-messen');
  assert.equal(await p.evaluate(()=>VIEW.karte.messen&&!VIEW.karte.pinSetzen&&!VIEW.karte.zoneSetzen),true);
  await p.click('#k-v2-voll');await p.keyboard.press('Escape');
  assert.equal(await p.evaluate(()=>VIEW.karte.messen),false);
  assert.equal(await p.locator('#k-v2-voll').getAttribute('aria-pressed'),'true');
  await p.evaluate(()=>meldung('K4 Testmeldung'));
  assert.match(await p.locator('#k-v2-systemmeldung').innerText(),/K4 Testmeldung/);
  await p.keyboard.press('Escape');assert.equal(await p.locator('#k-v2-voll').getAttribute('aria-pressed'),'false');
  assert.equal(await p.evaluate(()=>__soloAdapter===KARTE_V2_DEV.adapter()),true);
  await p.click('#k-v2-werkzeug-pin');
  await p.locator('#k-v2-map canvas.maplibregl-canvas').scrollIntoViewIfNeeded();
  const ziel=await p.evaluate(()=>{
    const canvas=$('k-v2-map').querySelector('canvas.maplibregl-canvas'),r=canvas.getBoundingClientRect();
    const q=KARTE_V2_DEV.adapter().project([52.501,13.401]);
    return [r.left+q.x,r.top+q.y];
  });
  assert.ok(ziel.every(Number.isFinite));
  assert.equal(await p.evaluate(([x,y])=>document.elementFromPoint(x,y)===$('k-v2-map').querySelector('canvas.maplibregl-canvas'),ziel),true);
  const n=await p.evaluate(()=>PROFIL.pins.length);
  await p.mouse.click(...ziel);
  assert.equal(await p.evaluate(()=>PROFIL.pins.length),n+1);
  assert.equal(await p.evaluate(()=>__soloAdapter===KARTE_V2_DEV.adapter()),true);
  await p.evaluate(()=>dispatch({type:'NAVIGATION',modul:'dossier'}));
  assert.equal(await p.evaluate(()=>KARTE_V2_DEV.adapter()),null);
  await p.evaluate(pinId=>kartenObjektZeigen(pinId),id);
  await p.waitForFunction(()=>KARTE_V2_DEV.adapter()?.ready());
  assert.equal(await p.locator('#pin-name').inputValue(),'K4 Solo Test');
  assert.equal(await p.locator('#k-svg').count(),0);
  // Interrupt a real camera animation while its position differs from both
  // the start and the destination. Sample and navigate in the same JS turn.
  const unterbrechen=async(zielPin=null)=>p.evaluate(async pinId=>{
    const adapter=KARTE_V2_DEV.adapter();
    adapter.flyTo({center:[13.4,52.5],zoom:15,pitch:20,bearing:12,duration:0});
    const start=adapter.camera();let map=null;
    const orig=maplibregl.Map.prototype.flyTo;
    maplibregl.Map.prototype.flyTo=function(...args){map=this;return orig.apply(this,args);};
    try{adapter.flyTo({center:[13.46,52.54],zoom:15,duration:3000,essential:true});}
    finally{maplibregl.Map.prototype.flyTo=orig;}
    if(!map)throw Error('real MapLibre flyTo not observed');
    const vorher=await new Promise((resolve,reject)=>{
      const ende=performance.now()+4000;
      function frame(){
        const cam=adapter.camera();
        if(map.isMoving()&&Math.abs(cam.center[0]-start.center[0])>0.0001&&Math.abs(cam.center[0]-13.46)>0.0001){resolve(cam);return;}
        if(performance.now()>ende||!map.isMoving()){reject(Error('no intermediate camera frame'));return;}
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    });
    const geteilt={lat:VIEW.karte.lat,lon:VIEW.karte.lon,zoom:VIEW.karte.zoom};
    if(pinId){if(!kartenObjektZeigen(pinId))throw Error('authorized pin jump refused');}
    else dispatch({type:'NAVIGATION',modul:'dossier'});
    return {start,vorher,geteilt,altBereit:adapter.ready()};
  },zielPin);
  const nah=(a,b,label)=>assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<1e-8,label+': '+a+' vs '+b);
  const kameraVergleich=(a,b)=>{for(let i=0;i<2;i++)nah(a.center[i],b.center[i],'center '+i);for(const k of ['zoom','pitch','bearing'])nah(a[k],b[k],k);};
  const abbruch=await unterbrechen();
  assert.equal(abbruch.altBereit,false);
  nah(abbruch.geteilt.lon,abbruch.vorher.center[0],'live shared longitude');
  nah(abbruch.geteilt.lat,abbruch.vorher.center[1],'live shared latitude');
  nah(abbruch.geteilt.zoom,abbruch.vorher.zoom+.5,'live shared zoom');
  await p.evaluate(()=>dispatch({type:'NAVIGATION',modul:'karte'}));
  await p.waitForFunction(()=>KARTE_V2_DEV.adapter()?.ready());
  kameraVergleich(await p.evaluate(()=>KARTE_V2_DEV.adapter().camera()),abbruch.vorher);
  // Direct object navigation while the old map is moving must win, even when
  // the explicit destination is the initial center of that animation.
  const sprung=await unterbrechen(id);assert.equal(sprung.altBereit,false);
  await p.waitForFunction(()=>KARTE_V2_DEV.adapter()?.ready());
  const zielCam=await p.evaluate(()=>KARTE_V2_DEV.adapter().camera());
  nah(zielCam.center[0],13.4,'explicit pin longitude');nah(zielCam.center[1],52.5,'explicit pin latitude');
  nah(zielCam.zoom,Math.max(sprung.geteilt.zoom,15)-.5,'explicit pin zoom');
  assert.equal(await p.locator('#pin-name').inputValue(),'K4 Solo Test');
  assert.equal(await p.locator('#k-svg').count(),0);
  // Z7: actual explicit easeTo, sampled mid-animation. Extend only the
  // test animation duration so a loaded CI runner cannot skip the sample.
  await p.emulateMedia({reducedMotion:'no-preference'});
  const zielflug=async(art)=>p.evaluate(async ({art,id})=>{
    const a=KARTE_V2_DEV.adapter();a.flyTo({center:[13.46,52.54],zoom:15,pitch:0,bearing:0,duration:0});
    const start=a.camera();let map=null;
    const orig=maplibregl.Map.prototype.easeTo;
    maplibregl.Map.prototype.easeTo=function(o,data){map=this;return orig.call(this,{...o,duration:3000,essential:true},data);};
    try{
      const x=kartePanelObjekt(id,null);
      if(!x||!karteSuchSprung(id,x.objekt.renderKey))throw Error('authorized search jump refused');
    }finally{maplibregl.Map.prototype.easeTo=orig;}
    if(!map)throw Error('explicit easeTo not observed');
    const zwischen=await new Promise((ok,no)=>{
      const ende=performance.now()+4000;
      function frame(){const c=a.camera();
        if(map.isMoving()&&Math.abs(c.center[0]-start.center[0])>.0001&&Math.abs(c.center[0]-13.4)>.0001){ok(c);return;}
        if(performance.now()>ende||!map.isMoving()){no(Error('no intermediate target frame'));return;}
        requestAnimationFrame(frame);
      }requestAnimationFrame(frame);
    });
    if(art==='modul')dispatch({type:'NAVIGATION',modul:'dossier'});
    else if(art==='reiter')$('ktab-protokoll').click();
    else if(art==='stand'){
      asAnwenden({modul:'karte',karte:{lat:52.54,lon:13.46,zoom:15.5}});renderModule();
    }else if(art==='gestoppt'){
      map.stop();dispatch({type:'NAVIGATION',modul:'dossier'});
    }
    return {zwischen,altBereit:a.ready(),geteilt:{lat:VIEW.karte.lat,lon:VIEW.karte.lon,zoom:VIEW.karte.zoom}};
  },{art,id});
  for(const art of ['modul','reiter','stand','gestoppt']){
    const ab=await zielflug(art);assert.equal(ab.altBereit,false);
    if(art==='modul'||art==='reiter'){
      nah(ab.geteilt.lon,13.4,'retained target longitude');nah(ab.geteilt.lat,52.5,'retained target latitude');nah(ab.geteilt.zoom,16.5,'retained target zoom');
    }else if(art==='stand'){
      nah(ab.geteilt.lon,13.46,'working state wins');nah(ab.geteilt.lat,52.54,'working state latitude');nah(ab.geteilt.zoom,15.5,'working state zoom');
    }else{
      nah(ab.geteilt.lon,ab.zwischen.center[0],'cancelled target retains visible longitude');nah(ab.geteilt.lat,ab.zwischen.center[1],'cancelled target retains visible latitude');
    }
    if(art==='reiter')await p.click('#ktab-karte');
    else if(art!=='stand')await p.evaluate(()=>dispatch({type:'NAVIGATION',modul:'karte'}));
    await p.waitForFunction(()=>KARTE_V2_DEV.adapter()?.ready());
    const cam=await p.evaluate(()=>KARTE_V2_DEV.adapter().camera());
    nah(cam.center[0],ab.geteilt.lon,'remounted longitude');nah(cam.center[1],ab.geteilt.lat,'remounted latitude');nah(cam.zoom,ab.geteilt.zoom-.5,'remounted zoom');
  }
  await p.emulateMedia({reducedMotion:'reduce'});
  // Z1: actual V2 camera at maximum zoom and above the old latitude limit.
  await p.evaluate(()=>KARTE_V2_DEV.adapter().flyTo({center:[13.4,85.02],zoom:22,pitch:0,bearing:0,duration:0}));
  await p.waitForFunction(()=>VIEW.karte.lat>85&&VIEW.karte.zoom===22.5);
  const hoch=await p.evaluate(()=>KARTE_V2_DEV.adapter().camera());
  nah(hoch.zoom,22,'maximum V2 zoom');nah(hoch.center[1],85.02,'latitude beyond former limit');
  await p.click('#as-speichern');
  const gespeichert=await p.evaluate(()=>JSON.parse(localStorage.getItem(PROFIL_KEY)).arbeitsstand.karte);
  nah(gespeichert.zoom,22.5,'persisted logical zoom');nah(gespeichert.lat,hoch.center[1],'persisted latitude');
  await p.evaluate(()=>{
    KARTE_V2_DEV.adapter().flyTo({center:[10,50],zoom:8,pitch:0,bearing:0,duration:0});
    dispatch({type:'NAVIGATION',modul:'dossier'});
  });
  assert.equal(await p.evaluate(()=>VIEW.karte.zoom),8.5);
  await p.click('#as-wieder');await p.waitForFunction(()=>KARTE_V2_DEV.adapter()?.ready());
  kameraVergleich(await p.evaluate(()=>KARTE_V2_DEV.adapter().camera()),hoch);
  assert.equal(await p.evaluate(()=>VIEW.karte.zoom),22.5);
  const gueltig=await p.evaluate(()=>{
    const base={lat:85.02,lon:13.4,zoom:22.5};
    const schlecht=[{lat:85.052},{lon:180.01},{zoom:22.51},{zoom:0},{lat:null},{zoom:'22'},{lon:NaN}];
    return {alt:asKarteKameraGueltig({lat:0,lon:0,zoom:1}),neu:asKarteKameraGueltig(base),
      ungueltig:schlecht.every(p=>!asKarteKameraGueltig({...base,...p})),
      meldung:asAnwenden({modul:'karte',karte:{...base,zoom:23}}).uebersprungen};
  });
  assert.deepEqual(gueltig,{alt:true,neu:true,ungueltig:true,meldung:['Kartenkamera']});
  assert.equal(await p.evaluate(()=>VIEW.karte.zoom),22.5,'invalid camera leaves last valid position intact');
  assert.deepEqual(net,[]);assert.deepEqual(errors,[]);
  console.log('OK: eigenständiges V2, Filter, Suche, Werkzeuge, Meldungen, Pin-Anlage, Navigation ohne SVG, unterbrochene Kamerafahrt, expliziter Sprung und Arbeitsstand bei maximalem Zoom');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
