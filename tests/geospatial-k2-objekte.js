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
/* K3f-3: deterministic screen layout and strict geography invariants. */
const ringMarker=[
  {id:'PIN-R1',renderKey:key('pin','PIN-R1'),kat:'pin',ll:[52.52,13.405]},
  {id:'PIN-R2',renderKey:key('pin','PIN-R2'),kat:'pin',ll:[52.52,13.405]},
  {id:'PIN-R3',renderKey:key('pin','PIN-R3'),kat:'pin',ll:[52.52005,13.40505]}
];
{
 const base=R.daten({...model,marker:ringMarker});
 const before=JSON.stringify(base.quellen);
 const fake=(scale)=>({
   getCanvas:()=>({clientWidth:1000,clientHeight:800}),getCenter:()=>({lng:13.405}),
   project:([x,y])=>({x:500+(x-13.405)*scale,y:400-(y-52.52)*scale}),
   unproject:([x,y])=>({lng:13.405+(x-500)/scale,lat:52.52-(y-400)/scale})
 });
 const out=R.entflechten(base.quellen,fake(10000));
 assert.equal(out.leit.features.filter(f=>f.geometry.type==='LineString').length,3);
 const points=out.punkte.features.map(f=>fake(10000).project(f.geometry.coordinates));
 for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++)
   assert.ok(Math.hypot(points[i].x-points[j].x,points[i].y-points[j].y)>=27.9);
 assert.equal(JSON.stringify(base.quellen),before,'display never mutates snapshot');
 for(const m of ringMarker)assert.deepEqual(base.treffer.get(m.renderKey).ll,m.ll);
 for(const k of ['mess','zonen','kanten','unsicherheit'])assert.equal(out[k],base.quellen[k]);
 const reverse=R.entflechten(R.daten({marker:ringMarker.slice().reverse()}).quellen,fake(10000));
 for(const f of out.punkte.features)assert.deepEqual(f.geometry,reverse.punkte.features.find(g=>g.properties.renderKey===f.properties.renderKey).geometry);
 const zoom=R.entflechten(base.quellen,fake(1000000));
 assert.equal(zoom.leit.features.filter(f=>f.geometry.type==='LineString').length,2);
 assert.deepEqual(zoom.punkte.features[2].geometry.coordinates,[13.40505,52.52005],'separated point returns to true position');
 // A 30-point chain at 15 px spacing must remain local, not one giant ring.
 const chain=Array.from({length:30},(_,i)=>({id:'C'+i,renderKey:'C'+i,kat:'pin',ll:[52.52,13.405+(i-15)*.0015]}));
 const chainData=R.daten({marker:chain}), chainOut=R.entflechten(chainData.quellen,fake(10000));
 assert.ok(chainOut.leit.features.length>0);
 const drawn=chainOut.punkte.features.map(f=>fake(10000).project(f.geometry.coordinates));
 for(let i=0;i<chain.length;i++){
   const orig=fake(10000).project(chainData.quellen.punkte.features[i].geometry.coordinates);
   assert.ok(Math.hypot(drawn[i].x-orig.x,drawn[i].y-orig.y)<30,'local displacement '+i);
   for(let j=0;j<i;j++)assert.ok(Math.hypot(drawn[i].x-drawn[j].x,drawn[i].y-drawn[j].y)>=20,'distinct adjacent targets');
 }
 const single=R.daten({marker:[ringMarker[0]]});
 assert.equal(R.entflechten(single.quellen,fake(10000)),single.quellen);
 // The entire ring of a visible group near the top left remains clickable.
 const randMap={...fake(10000),project:([x,y])=>({x:8+(x-13.405)*10000,y:9-(y-52.52)*10000}),
   unproject:([x,y])=>({lng:13.405+(x-8)/10000,lat:52.52-(y-9)/10000})};
 const rand=R.entflechten(base.quellen,randMap);
 assert.equal(rand.leit.features.filter(f=>f.geometry.type==='LineString').length,3);
 for(const f of rand.punkte.features){
   const q=randMap.project(f.geometry.coordinates);
   assert.ok(q.x>=12.99&&q.y>=12.99&&q.x<=987.01&&q.y<=787.01,'ring inside viewport');
 }
 // Single-world maps must not project the other side of the date line
 // as a neighboring visible copy.
 const seam=R.daten({marker:[
   {id:'A',kat:'pin',renderKey:'seam-a',ll:[0,179.99]},
   {id:'B',kat:'pin',renderKey:'seam-b',ll:[0,-179.99]}
 ]});
 const seamMap={getCanvas:()=>({clientWidth:1000,clientHeight:800}),getCenter:()=>({lng:179.99}),
   getRenderWorldCopies:()=>false,project:([x,y])=>({x:500+(x-179.99)*100,y:400-y*100}),
   unproject:([x,y])=>({lng:179.99+(x-500)/100,lat:(400-y)/100})};
 assert.equal(R.entflechten(seam.quellen,seamMap),seam.quellen,'no phantom world copy');
 // A ring crossing the single-world seam is not wrapped to the other side.
 const same=R.daten({marker:[
   {id:'A',kat:'pin',renderKey:'seam-a',ll:[0,179.99]},
   {id:'B',kat:'pin',renderKey:'seam-b',ll:[.01,179.99]}
 ]});
 assert.equal(R.entflechten(same.quellen,seamMap),same.quellen,'invalid ring retains true geography');
}
/* Adapter-level regression without browser timing: equivalent snapshots must
   not cause worker refreshes, but changed or removed objects must. */
{
 const sources=new Map(),layers=new Map(),images=new Set(),handlers=new Map(),writes=[],filters=[];
 const mock={
   on:(e,fn)=>handlers.set(e,fn),off:e=>handlers.delete(e),
   isStyleLoaded:()=>true,getSource:id=>sources.get(id),getLayer:id=>layers.get(id),hasImage:id=>images.has(id),
   addSource:(id,s)=>sources.set(id,{data:s.data,setData(data){this.data=data;writes.push(id);}}),
   addLayer:l=>layers.set(l.id,l),addImage:id=>images.add(id),
   setFilter:(id,f)=>filters.push([id,f]),
   queryRenderedFeatures:(p,{layers})=>layers[0]==='shadow-v2-punkt'?[{properties:{renderKey:a}}]:[],
   removeSource:id=>sources.delete(id),removeLayer:id=>layers.delete(id),removeImage:id=>images.delete(id)
 };
 const adapter=R.adapter(mock);adapter.setData(model);adapter.setSelection(a);
 writes.length=0;filters.length=0;
 adapter.setData(JSON.parse(JSON.stringify(model)));adapter.setSelection(a);
 assert.deepEqual(writes,[],'identical model no source writes');
 assert.deepEqual(filters,[],'identical selection no filter writes');
 adapter.setData(model,{mess:[[52.52,13.4]]});
 assert.deepEqual(writes,['shadow-v2-mess'],'measurement only refreshes measurement source');
 assert.deepEqual(filters,[]);
 writes.length=0;adapter.setSelection(b);
 assert.equal(filters.length,3);assert.deepEqual(writes,[],'selection does not update sources');
 adapter.setData({...model,marker:model.marker.filter(x=>x.renderKey!==a)},{mess:[[52.52,13.4]]});
 assert.ok(writes.includes('shadow-v2-punkte'));
 assert.equal(adapter.hitTest({x:0,y:0}),null,'stale removed hit immediately rejected');
 adapter.unmount();
 assert.equal(handlers.has('move'),false,'movement listener removed');
 assert.equal(handlers.has('moveend'),false);
}
// Controlled clock: intermediate motion updates only local points/leader
// lines; rapid events are throttled, moveend settles the exact final layout.
{
 const sources=new Map(),layers=new Map(),images=new Set(),handlers=new Map(),writes=[];
 let scale=10000,zeit=0,moving=false;
 const mock={
   on:(e,fn)=>handlers.set(e,fn),off:e=>handlers.delete(e),
   isStyleLoaded:()=>true,getSource:id=>sources.get(id),getLayer:id=>layers.get(id),hasImage:id=>images.has(id),
   addSource:(id,s)=>sources.set(id,{data:s.data,setData(data){this.data=data;writes.push(id);}}),
   addLayer:l=>layers.set(l.id,l),addImage:id=>images.add(id),setFilter:()=>{},
   removeSource:id=>sources.delete(id),removeLayer:id=>layers.delete(id),removeImage:id=>images.delete(id),
   getCanvas:()=>({clientWidth:1000,clientHeight:800}),getCenter:()=>({lng:13.405}),isMoving:()=>moving,
   project:([x,y])=>({x:500+(x-13.405)*scale,y:400-(y-52.52)*scale}),
   unproject:([x,y])=>({lng:13.405+(x-500)/scale,lat:52.52-(y-400)/scale})
 };
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'performance');
 Object.defineProperty(globalThis,'performance',{configurable:true,value:{now:()=>zeit}});
 try{
   const adapter=R.adapter(mock);adapter.setData({marker:ringMarker});
   writes.length=0;scale=15000;handlers.get('move')();
   assert.deepEqual(writes,[],'not moving');
   moving=true;handlers.get('move')();
   assert.deepEqual(writes,['shadow-v2-punkte','shadow-v2-leit']);
   writes.length=0;scale=18000;zeit=50;handlers.get('move')();
   assert.deepEqual(writes,[],'burst throttled');
   zeit=100;handlers.get('move')();
   assert.deepEqual(writes,['shadow-v2-punkte','shadow-v2-leit']);
   writes.length=0;scale=1000000;zeit=110;moving=false;handlers.get('moveend')();
   assert.deepEqual(writes,['shadow-v2-punkte','shadow-v2-leit'],'final layout not throttled');
   const expected=R.entflechten(R.daten({marker:ringMarker}).quellen,mock);
   assert.deepEqual(sources.get('shadow-v2-punkte').data,expected.punkte);
   assert.deepEqual(sources.get('shadow-v2-leit').data,expected.leit);
   adapter.unmount();assert.equal(handlers.size,0);
 }finally{
   if(descriptor)Object.defineProperty(globalThis,'performance',descriptor);
   else delete globalThis.performance;
 }
}
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
  // Real browser: overlapping pins are individually clickable; clicks
  // report the original position, not the fanned-out display coordinate.
  await p.evaluate(marker=>{__adapter.setData({marker});__adapter.setSelection(marker[0].renderKey);},ringMarker);
  const ringReady=()=>p.waitForFunction(marker=>{
    const d=KARTE_V2_RENDERER.entflechten(KARTE_V2_RENDERER.daten({marker}).quellen,__map);
    return d.leit.features.filter(f=>f.geometry.type==='LineString').length===3&&
      d.punkte.features.every(f=>__adapter.hitTest(__map.project(f.geometry.coordinates))?.renderKey===f.properties.renderKey);
  },ringMarker);
  await ringReady();
  for(const m of ringMarker){
    const pnt=await p.evaluate(({marker,key})=>{
      const d=KARTE_V2_RENDERER.entflechten(KARTE_V2_RENDERER.daten({marker}).quellen,__map);
      const q=__map.project(d.punkte.features.find(f=>f.properties.renderKey===key).geometry.coordinates);
      return {x:q.x,y:q.y};
    },{marker:ringMarker,key:m.renderKey});
    await p.mouse.click(pnt.x,pnt.y);
    assert.deepEqual(await p.evaluate(()=>__clicks.at(-1).treffer.ll),m.ll);
    assert.equal(await p.evaluate(()=>__clicks.at(-1).treffer.renderKey),m.renderKey);
  }
  await p.evaluate(()=>__map.jumpTo({pitch:45,bearing:25}));await ringReady();
  await p.evaluate(()=>__adapter.setStyle(KARTE_V2_QUELLEN.leererStil()));await ringReady();
  await p.evaluate(marker=>__adapter.setData({marker}),[ringMarker[0]]);
  await p.waitForFunction(m=>__adapter.hitTest(__adapter.project(m.ll))?.renderKey===m.renderKey,ringMarker[0]);
  assert.equal(await p.evaluate(()=>__map.queryRenderedFeatures({layers:['shadow-v2-leit-line']}).length),0);
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
