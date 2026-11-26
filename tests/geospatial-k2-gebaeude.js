'use strict';
/* Echte MVT-Geometrien statt leerer Kachel: tatsächliche Filterung im MapLibre-Worker
   und sichtbare Layer über Zoom/Toggle prüfen. Keine echten Provideranfragen. */
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const {ROOT}=require('./_pfad');
const Q=require('../karte-v2-quellen');
function vi(n){const a=[];while(n>=128){a.push(n%128+128);n=Math.floor(n/128);}a.push(n);return Buffer.from(a);}
const zz=n=>n<0?-2*n-1:2*n;
const cat=(...a)=>Buffer.concat(a);
const field=(n,v)=>cat(vi(n*8),vi(v));
const bytes=(n,v)=>cat(vi(n*8+2),vi(v.length),v);
const str=(n,v)=>bytes(n,Buffer.from(v,'utf8'));
const packed=(n,v)=>bytes(n,cat(...v.map(vi)));
const keys=['kind','height','min_height','addr_housenumber'], values=[];
function value(v){let i=values.findIndex(x=>x===v);if(i<0){i=values.length;values.push(v);}return i;}
const rows=[
 {kind:'building',height:30},
 {kind:'building_part',height:50,min_height:10},
 {kind:'building'},
 {kind:'building',height:-5},
 {kind:'building_part',height:10,min_height:10},
 {kind:'address',height:25,addr_housenumber:'7'},
 {kind:'address',height:30,polygon:true,addr_housenumber:'7'},
 {kind:'building',height:'30'},
 {kind:'building_part',height:20,min_height:-2},
 {kind:'building',height:1600},
 {kind:'building',height:20,min_height:'5'},
 {kind:'building',height:0},
 {kind:'building',height:20,point:true,addr_housenumber:'7'},
 {kind:'building_part',height:15,min_height:0},
 {kind:'address',height:20},
 {kind:'address',addr_housenumber:''}
];
const features=rows.map((r,i)=>{
 const x=300+(i%4)*950,y=300+Math.floor(i/4)*950,w=400,h=400;
 const point=r.point||(r.kind==='address'&&!r.polygon);
 const geom=point?[9,zz(x),zz(y)]:[9,zz(x),zz(y),26,zz(w),0,0,zz(h),zz(-w),0,15];
 const tags=keys.flatMap((k,j)=>Object.hasOwn(r,k)?[j,value(r[k])]:[]);
 return bytes(2,cat(field(1,i+1),packed(2,tags),field(3,point?1:3),packed(4,geom)));
});
const layer=cat(str(1,'buildings'),...features,...keys.map(k=>str(3,k)),...values.map(v=>bytes(4,typeof v==='string'?str(1,v):field(6,zz(v)))),field(5,4096),field(15,2));
const tile=bytes(3,layer);
// Deterministische synthetische SDF-Glyphe '7' (8x8, 3px Rand), kein fremder Font.
const bitmap=Buffer.alloc(14*14);for(let y=3;y<11;y++)for(let x=3;x<11;x++)bitmap[y*14+x]=(y<5||x===10-(y-3))?255:64;
const glyph=cat(field(1,55),bytes(2,bitmap),field(3,8),field(4,8),field(5,zz(0)),field(6,zz(8)),field(7,9));
const glyphPbf=bytes(1,cat(str(1,'Fixture Regular'),str(2,'0-255'),bytes(3,glyph)));
const source={type:'vector',tiles:['https://example.invalid/fixture/{z}/{x}/{y}.mvt'],maxzoom:15};
const basis={version:8,sources:{protomaps:source},layers:[
 {id:'bg',type:'background',paint:{'background-color':'#e0e0e0'}},
 {id:'flat',type:'fill',source:'protomaps','source-layer':'buildings',paint:{'fill-color':'#909090'}}
]};
(async()=>{
 const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
 try{
  const p=await browser.newPage({viewport:{width:1200,height:900},reducedMotion:'reduce'});p.setDefaultTimeout(25000);
  const errors=[];let requests=0,glyphRequests=0;p.on('pageerror',e=>errors.push(e.message));
  await p.route(/^https?:/,r=>{
    const u=new URL(r.request().url());
    if(u.hostname==='example.invalid'&&u.pathname.startsWith('/fonts/')){glyphRequests++;return r.fulfill({body:glyphPbf,contentType:'application/x-protobuf',headers:{'access-control-allow-origin':'*'}});}
    if(u.hostname==='example.invalid'){requests++;return r.fulfill({body:tile,contentType:'application/vnd.mapbox-vector-tile',headers:{'access-control-allow-origin':'*'}});}
    return r.abort();
  });
  await p.goto(pathToFileURL(path.join(ROOT,'karte-v2-prototyp.html')).href);
  await p.waitForFunction(()=>document.getElementById('meldung').textContent.includes('Keine Kachelquelle aktiv'));
  await p.evaluate(style=>{
    const el=document.createElement('div');Object.assign(el.style,{position:'fixed',inset:'0',zIndex:'100'});document.body.appendChild(el);
    const n=2**15,x=17604.5,y=10747.5;
    window.__m=new maplibregl.Map({container:el,style,center:[x/n*360-180,Math.atan(Math.sinh(Math.PI*(1-2*y/n)))*180/Math.PI],zoom:15});
    __m.on('error',e=>{window.__mapErr=(window.__mapErr||[]).concat(String(e.error?.message||e.error));});
  },Q.gebaeudeStil(basis,false,true));
  const idle=()=>p.waitForFunction(()=>__m.loaded()&&__m.areTilesLoaded());
  const ids=id=>p.evaluate(id=>[...new Set(__m.queryRenderedFeatures({layers:[id]}).map(f=>f.id))].sort((a,b)=>a-b),id);
  await idle();
  assert.ok(requests>0);
  assert.deepEqual(await ids(Q.GEBAEUDE_ID),[1,2,14],'nur gültige Gebäude und Gebäudeteile');
  const flat=await ids('flat');assert.ok(flat.includes(3)&&flat.includes(4)&&flat.includes(5),'unbekannte/ungültige Höhen behalten Grundriss');
  await p.evaluate(id=>__m.setLayoutProperty(id,'visibility','none'),Q.GEBAEUDE_ID);await idle();assert.deepEqual(await ids(Q.GEBAEUDE_ID),[]);
  await p.evaluate(id=>__m.setLayoutProperty(id,'visibility','visible'),Q.GEBAEUDE_ID);await idle();assert.deepEqual(await ids(Q.GEBAEUDE_ID),[1,2,14]);
  await p.evaluate(()=>__m.jumpTo({zoom:14}));await idle();assert.deepEqual(await ids(Q.GEBAEUDE_ID),[],'keine Extrusion unter Zoom 15');
  await p.evaluate(()=>__m.jumpTo({zoom:15,pitch:45}));await idle();
  assert.ok((await ids(Q.GEBAEUDE_ID)).length>0,'Extrusion auch geneigt sichtbar');
  // Echter Dark-Matter-Ersatzlayer: nur Adresspunkt mit nichtleerer Nummer,
  // kein Adresspolygon, Gebäudepunkt oder fehlender Wert.
  const nacht=JSON.parse(JSON.stringify(basis));
  nacht.glyphs='https://example.invalid/fonts/{fontstack}/{range}.pbf';
  nacht.layers.push({id:'font-fixture',type:'symbol',source:'protomaps','source-layer':'buildings',layout:{'text-field':'','text-font':['Fixture Regular']}});
  await p.evaluate(style=>{
    __m.setStyle(style,{diff:false});
    const n=2**15,x=17604+1250/4096,y=10747+1250/4096;
    __m.jumpTo({center:[x/n*360-180,Math.atan(Math.sinh(Math.PI*(1-2*y/n)))*180/Math.PI],zoom:17,pitch:0,bearing:0});
  },Q.gebaeudeStil(nacht,true,true));
  const hausBereit=()=>p.waitForFunction(id=>__m.loaded()&&__m.areTilesLoaded()&&__m.getLayer(id)&&__m.queryRenderedFeatures({layers:[id]}).some(f=>f.id===6),Q.HAUSNUMMER_ID);
  await hausBereit();assert.deepEqual(await ids(Q.HAUSNUMMER_ID),[6]);assert.ok(glyphRequests>0);
  await p.evaluate(()=>__m.jumpTo({pitch:60}));await hausBereit();
  assert.deepEqual(await ids(Q.HAUSNUMMER_ID),[6],'Hausnummer bei 60 Grad Neigung');
  await p.evaluate(()=>__m.jumpTo({zoom:16,pitch:0}));await idle();assert.deepEqual(await ids(Q.HAUSNUMMER_ID),[],'Hausnummer erst ab Zoom 17');
  assert.deepEqual(await p.evaluate(()=>window.__mapErr||[]),[]);
  await p.evaluate(()=>__m.remove());assert.deepEqual(errors,[]);
  console.log('OK: echte MVT-Gebäude, Ausschluss unplausibler Höhen/Adresspunkte, Zoom und Sichtbarkeit');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
