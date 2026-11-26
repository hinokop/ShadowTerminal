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
   window.__clicks=[];window.__adapter=KARTE_V2_RENDERER.adapter(__map,{onClick:e=>__clicks.push(e)});
   __adapter.setData(model);__adapter.setSelection(model.marker[0].renderKey);
  },model);
  const warten=()=>p.waitForFunction(()=>__adapter.ready()&&__map.loaded()&&__map.areTilesLoaded());
  await warten();
  const hit=async ll=>p.evaluate(ll=>__adapter.hitTest(__adapter.project(ll)),ll);
  assert.equal((await hit(model.marker[0].ll)).renderKey,a);
  assert.equal((await hit(model.marker[1].ll)).renderKey,b);
  assert.equal((await hit(model.zonen[0].ll)).renderKey,zone);
  const pt=await p.evaluate(ll=>{const x=__adapter.project(ll);return{x:x.x,y:x.y};},model.marker[1].ll);
  await p.mouse.click(pt.x,pt.y);
  assert.equal(await p.evaluate(()=>__clicks.at(-1).treffer.renderKey),b);
  assert.equal(await p.evaluate(()=>__clicks.at(-1).mehr),false);
  for(const taste of ['Shift','Control','Meta']){
    await p.keyboard.down(taste);
    try{await p.mouse.click(pt.x,pt.y);}finally{await p.keyboard.up(taste);}
    assert.equal(await p.evaluate(()=>__clicks.at(-1).mehr),true,taste+' wird weitergereicht');
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
  assert.equal((await hit(model.marker[0].ll)).renderKey,a,'Stilwechsel erhält Snapshot');
  assert.deepEqual(await p.evaluate(()=>__map.getFilter('shadow-v2-auswahl')),['==',['get','renderKey'],a]);
  await p.evaluate(model=>__adapter.setData(model),{...model,marker:model.marker.filter(x=>x.renderKey!==a)});
  assert.equal(await hit(model.marker[0].ll),null,'entfernter Treffer sofort ungültig, auch vor Worker-Update');
  await warten();
  assert.deepEqual(await p.evaluate(()=>__map.getFilter('shadow-v2-auswahl')),['==',['get','renderKey'],'']);
  assert.equal((await hit(model.marker[1].ll)).renderKey,b);
  await p.evaluate(()=>{__adapter.unmount();__adapter.setData({});});
  assert.equal(await p.evaluate(()=>!!__map.getSource('shadow-v2-punkte')),false);
  assert.equal(await hit(model.marker[1].ll),null);
  await p.evaluate(()=>__map.remove());
  assert.deepEqual(net,[]);assert.deepEqual(errors,[]);
  console.log('OK: K2b-2a lokale Objektlayer, Identitäten, echte Klicks, Stilwechsel und Freigabe');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
