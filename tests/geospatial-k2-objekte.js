'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const {ROOT}=require('./_pfad');
const R=require('../karte-v2-renderer');
const key=(...a)=>JSON.stringify(a);
const a=key('sichtung','P-1','SI-1'),b=key('sichtung','P-2','SI-1'),pin=key('pin','PIN-1'),zone=key('zone','ZO-1'),p1=key('dossier','P-1'),p2=key('dossier','P-2'),edge=key('verbindung','V-1');
const model={marker:[
  {id:'SI-1',renderKey:a,kat:'sichtung',ll:[52.52,13.4],unM:{m:80},name:'NICHT-IM-GEOJSON'},
  {id:'SI-1',renderKey:b,kat:'sichtung',ll:[52.52,13.41]},
  {id:'PIN-1',renderKey:pin,kat:'pin',ll:[52.524,13.4]},
  {id:'P-1',renderKey:p1,kat:'figur',entitaet:true,typ:'Person',ll:[52.516,13.4]},
  {id:'P-2',renderKey:p2,kat:'figur',entitaet:true,typ:'Organisation',ll:[52.516,13.41]}
],zonen:[{id:'ZO-1',renderKey:zone,ll:[52.524,13.41],r:150}],kanten:[{id:'V-1',renderKey:edge,von:'P-1',nach:'P-2'}]};
const s=R.daten(model,{mess:[[52.52,179.99],[52.52,-179.99]]});
assert.equal(R.legende.filter(l=>l.filter).length,8);
assert.equal(new Set(R.legende.filter(l=>l.filter).map(l=>l.filter)).size,8);
assert.ok(Object.isFrozen(R.legende)&&R.legende.every(Object.isFrozen));
for(const [i,k] of ['sichtungen','sichtungen','pins','personen','organisationen'].entries())
  assert.equal(s.quellen.punkte.features[i].properties.farbe,R.legende.find(l=>l.filter===k).farbe);
const punktLegende=R.legende.filter(l=>l.symbol);
assert.equal(punktLegende.length,6);
assert.equal(new Set(punktLegende.map(l=>l.form)).size,6);
assert.equal(new Set(punktLegende.map(l=>l.symbol)).size,6);
const masken=punktLegende.map(l=>{
  const b=R.symbolBild(l.symbol);
  assert.deepEqual([b.width,b.height,b.data.length],[40,40,6400]);
  assert.ok(b.data.some((v,i)=>i%4===3&&v===255));
  assert.ok(b.data.some((v,i)=>i%4===3&&v===0));
  return Buffer.from(b.data.filter((v,i)=>i%4===3)).toString('base64');
});
assert.equal(new Set(masken).size,6,'tatsächlich unterschiedliche Silhouetten');
assert.deepEqual(R.symbolBild('toString'),R.symbolBild('sonstige'),'unbekannte Kategorie sicher');
for(const [i,k] of ['sichtungen','sichtungen','pins','personen','organisationen'].entries())
  assert.equal(s.quellen.punkte.features[i].properties.symbol,'shadow-v2-icon-'+R.legende.find(l=>l.filter===k).symbol);
assert.equal(s.treffer.size,7);
assert.equal(s.quellen.punkte.features.length,5);
assert.deepEqual(s.quellen.punkte.features[0].geometry.coordinates,[13.4,52.52]);
assert.equal(s.quellen.unsicherheit.features.length,1);
assert.equal(s.quellen.zonen.features[0].geometry.coordinates[0].length,65);
assert.equal(s.quellen.kanten.features.length,1);
assert.ok(Math.abs(s.quellen.mess.features[2].geometry.coordinates[1][0]-179.99)<0.03);
assert.ok(!JSON.stringify(s.quellen).includes('NICHT-IM-GEOJSON'));
s.treffer.get(a).ll[0]=0;assert.equal(model.marker[0].ll[0],52.52);
const dup=R.daten({...model,marker:model.marker.concat(model.marker[0])});
assert.equal(dup.treffer.has(a),false);assert.equal(dup.treffer.has(b),true);
assert.equal(R.daten({...model,marker:model.marker.filter(x=>x.id!=='P-1')}).quellen.kanten.features.length,0);
(async()=>{
 const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
 try{
  const p=await browser.newPage({viewport:{width:1100,height:800},reducedMotion:'reduce'});p.setDefaultTimeout(20000);
  const errors=[],net=[];p.on('pageerror',e=>errors.push(e.message));await p.route(/^https?:/,r=>{net.push(r.request().url());return r.abort();});
  await p.goto(pathToFileURL(path.join(ROOT,'karte-v2-prototyp.html')).href);
  await p.waitForFunction(()=>document.getElementById('meldung').textContent.includes('Keine Kachelquelle aktiv'));
  // Zweite unabhängige MapLibre-Instanz mit demselben produktiven Adapter.
  await p.evaluate(model=>{
   const el=document.createElement('div');Object.assign(el.style,{position:'fixed',inset:'0',zIndex:'100'});document.body.appendChild(el);
   window.__map=new maplibregl.Map({container:el,style:KARTE_V2_QUELLEN.leererStil(),center:[13.405,52.52],zoom:14,attributionControl:false});
   window.__boxZoomVorher=__map.boxZoom.isEnabled();
   window.__clicks=[];window.__adapter=KARTE_V2_RENDERER.adapter(__map,{onClick:e=>__clicks.push(e)});
   __adapter.setData(model);__adapter.setSelection(model.marker[0].renderKey);
  },model);
  const warten=()=>p.waitForFunction(()=>__adapter.ready()&&__map.loaded()&&__map.areTilesLoaded());
  await warten();
  const hit=async ll=>p.evaluate(ll=>__adapter.hitTest(__adapter.project(ll)),ll);
  assert.equal(await p.evaluate(()=>__map.getLayer('shadow-v2-punkt').type),'symbol');
  assert.equal(await p.evaluate(()=>__map.hasImage('shadow-v2-icon-sichtung')),true);
  for(const marker of model.marker)assert.equal((await hit(marker.ll)).renderKey,marker.renderKey);
  await p.evaluate(()=>__map.jumpTo({pitch:45,bearing:25}));await warten();
  for(const marker of model.marker)assert.equal((await hit(marker.ll)).renderKey,marker.renderKey,'Treffer auch geneigt');
  await p.evaluate(()=>__map.jumpTo({pitch:0,bearing:0}));await warten();
  assert.equal((await hit(model.marker[0].ll)).renderKey,a);
  assert.equal((await hit(model.marker[1].ll)).renderKey,b);
  assert.equal((await hit(model.zonen[0].ll)).renderKey,zone);
  const pt=await p.evaluate(ll=>{const x=__adapter.project(ll);return{x:x.x,y:x.y};},model.marker[1].ll);
  assert.deepEqual(await p.evaluate(()=>[__boxZoomVorher,__map.boxZoom.isEnabled(),__map.dragPan.isEnabled(),__map.scrollZoom.isEnabled(),__map.dragRotate.isEnabled()]),[true,false,true,true,true]);
  await p.mouse.click(pt.x,pt.y);
  assert.equal(await p.evaluate(()=>__clicks.at(-1).treffer.renderKey),b);
  assert.equal(await p.evaluate(()=>__clicks.at(-1).mehr),false);
  for(const taste of ['Shift','Control','Meta']){
    const vorher=await p.evaluate(()=>__clicks.length);
    await p.keyboard.down(taste);
    try{await p.mouse.click(pt.x,pt.y);}finally{await p.keyboard.up(taste);}
    assert.equal(await p.evaluate(()=>__clicks.length),vorher+1,taste+' erzeugt genau einen neuen Klick');
    assert.deepEqual(await p.evaluate(()=>[__clicks.at(-1).treffer.renderKey,__clicks.at(-1).mehr]),[b,true],taste+' wird weitergereicht');
  }
  // Ein eigener Bereich über der Verbindung: Marker > Verbindung > Zone.
  await p.evaluate(model=>__adapter.setData({...model,zonen:[...model.zonen,{id:'ZO-2',renderKey:'zone-overlap',ll:[52.516,13.405],r:400}]}),model);
  await warten();
  assert.equal((await hit([52.516,13.405])).renderKey,edge,'Verbindung innerhalb einer Zone');
  assert.equal((await hit(model.marker[3].ll)).renderKey,p1,'Marker vor Verbindung und Zone');
  assert.equal((await hit([52.517,13.405])).renderKey,'zone-overlap','Zone außerhalb der Verbindung');
  await p.evaluate(model=>__adapter.setData(model),model);await warten();
  assert.deepEqual(await p.evaluate(()=>__map.getFilter('shadow-v2-auswahl')),['==',['get','renderKey'],a]);
  const round=await p.evaluate(ll=>__adapter.unproject(__adapter.project(ll)),model.marker[0].ll);
  assert.ok(Math.abs(round[0]-52.52)<1e-6&&Math.abs(round[1]-13.4)<1e-6);
  await p.evaluate(()=>__adapter.setStyle(KARTE_V2_QUELLEN.leererStil()));
  await warten();
  assert.equal(await p.evaluate(()=>__map.hasImage('shadow-v2-icon-sichtung')),true,'lokales Sprite nach Stilwechsel');
  // loaded()/areTilesLoaded() guarantee neither a completed symbol placement
  // nor a current rendered-symbol hit index after a fresh style. Wait for the
  // real adapter hit (bounded by the test timeout), never substitute source data.
  try{
    await p.waitForFunction(marker=>marker.every(m=>
      __adapter.hitTest(__adapter.project(m.ll))?.renderKey===m.renderKey),model.marker,{timeout:10000});
  }catch(e){
    const diagnose=await p.evaluate(marker=>({
      ready:__adapter.ready(),loaded:__map.loaded(),tilesLoaded:__map.areTilesLoaded(),
      layer:__map.getLayer('shadow-v2-punkt')?.type,
      rendered:__map.queryRenderedFeatures({layers:['shadow-v2-punkt']}).map(f=>f.properties.renderKey),
      hits:marker.map(m=>({expected:m.renderKey,actual:__adapter.hitTest(__adapter.project(m.ll))?.renderKey??null}))
    }),model.marker);
    throw Error('Stilwechsel: Symboltreffer nicht wiederhergestellt: '+JSON.stringify(diagnose),{cause:e});
  }
  assert.equal((await hit(model.marker[0].ll))?.renderKey,a,'Stilwechsel erhält Snapshot');
  assert.deepEqual(await p.evaluate(()=>__map.getFilter('shadow-v2-auswahl')),['==',['get','renderKey'],a]);
  await p.evaluate(model=>__adapter.setData(model),{...model,marker:model.marker.filter(x=>x.renderKey!==a)});
  assert.equal(await hit(model.marker[0].ll),null,'entfernter Treffer sofort ungültig, auch vor Worker-Update');
  await warten();
  assert.deepEqual(await p.evaluate(()=>__map.getFilter('shadow-v2-auswahl')),['==',['get','renderKey'],'']);
  assert.equal((await hit(model.marker[1].ll)).renderKey,b);
  await p.evaluate(()=>{__adapter.unmount();__adapter.setData({});});
  assert.equal(await p.evaluate(()=>!!__map.getSource('shadow-v2-punkte')),false);
  assert.equal(await p.evaluate(()=>__map.hasImage('shadow-v2-icon-sichtung')),false);
  assert.equal(await p.evaluate(()=>__map.boxZoom.isEnabled()),true,'vorherige BoxZoom-Einstellung nach unmount wiederhergestellt');
  assert.equal(await hit(model.marker[1].ll),null);
  await p.evaluate(()=>__map.remove());
  assert.deepEqual(net,[]);assert.deepEqual(errors,[]);
  console.log('OK: K2b-2a lokale Objektlayer, Identitäten, echte Klicks, Stilwechsel und Freigabe');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
