'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), crypto = require('node:crypto');
const Q = require('../karte-v2-quellen.js');
const { bereitstellen, VERSION, DATEIEN } = require('../tools/maplibre-bereitstellen.js');
const D=require('../karte-v2-diagnose');
const key = 'fixture +/&?';
assert.equal(Q.vektorStil({version:8,sources:{protomaps:{type:'vector'}},layers:[{source:'protomaps','source-layer':'buildings'}]}),true);
assert.equal(Q.vektorStil(Q.leererStil()),false);
assert.equal(Q.vektorStil(null),false);
const basis={version:8,sources:{protomaps:{type:'vector',tiles:['https://example.invalid/{z}/{x}/{y}']}},layers:[
  {id:'f',type:'fill',source:'protomaps','source-layer':'buildings'},
  {id:'label',type:'symbol',source:'protomaps','source-layer':'buildings'}]};
const unveraendert=JSON.stringify(basis), mit=Q.gebaeudeStil(basis,false,true);
assert.equal(JSON.stringify(basis),unveraendert);
assert.deepEqual(mit.sources,basis.sources);
assert.deepEqual(mit.layers.map(l=>l.id),['f',Q.GEBAEUDE_ID,'label']);
const g=mit.layers[1];
assert.equal(g.type,'fill-extrusion');assert.equal(g.minzoom,15);
assert.equal(g.layout.visibility,'visible');
assert.equal(Q.gebaeudeStil(basis,true,false).layers[1].layout.visibility,'none');
assert.notEqual(Q.gebaeudeStil(basis,true,false).layers[1].paint['fill-extrusion-color'],g.paint['fill-extrusion-color']);
assert.throws(()=>Q.gebaeudeStil(mit,false,true));
assert.throws(()=>Q.gebaeudeStil(Q.leererStil(),false,true));
const detail=JSON.parse(JSON.stringify(basis));
detail.glyphs='https://basemaps.cartocdn.com/fonts/{fontstack}/{range}.pbf';
detail.layers[1].layout={'text-field':['get','name'],'text-font':['Fixture Regular']};
const detailOriginal=JSON.stringify(detail);
const dunkel=Q.gebaeudeStil(detail,true,true), haus=dunkel.layers.find(l=>l.id===Q.HAUSNUMMER_ID);
assert.ok(haus);assert.equal(haus.minzoom,17);assert.equal(haus.source,'protomaps');
assert.deepEqual(haus.layout['text-font'],['Fixture Regular']);
assert.deepEqual(haus.layout['text-field'],['to-string',['get','addr_housenumber']]);
assert.equal(haus.layout['text-pitch-alignment'],'viewport');
assert.ok(dunkel.layers.indexOf(haus)>dunkel.layers.findIndex(l=>l.id===Q.GEBAEUDE_ID));
assert.equal(JSON.stringify(detail),detailOriginal);
assert.ok(!Q.gebaeudeStil(detail,false,true).layers.some(l=>l.id===Q.HAUSNUMMER_ID));
assert.ok(!Q.gebaeudeStil(basis,true,true).layers.some(l=>l.id===Q.HAUSNUMMER_ID),'keine ungesicherte Fontquelle');
const vorhanden=JSON.parse(JSON.stringify(detail));
vorhanden.layers.unshift({id:'housenumber',type:'symbol',source:'protomaps','source-layer':'buildings',minzoom:19,layout:{visibility:'none','text-field':['get','addr_housenumber']}});
const angepasst=Q.gebaeudeStil(vorhanden,true,true), nr=angepasst.layers.find(l=>l.id==='housenumber');
assert.equal(nr.minzoom,17);assert.equal(nr.layout.visibility,'visible');
assert.ok(angepasst.layers.indexOf(nr)>angepasst.layers.findIndex(l=>l.id===Q.GEBAEUDE_ID));
assert.ok(!angepasst.layers.some(l=>l.id===Q.HAUSNUMMER_ID),'keine Duplikate');
// K3d: transformation must not mutate the cached provider style.
const shadowBasis=JSON.parse(JSON.stringify(dunkel));
for(const id of ['motorway','primary','minor','primary_casing','unknown']){
  shadowBasis.layers.push({id,type:'line',source:'protomaps','source-layer':'roads',
    minzoom:9,filter:['==',['get','kind'],'major_road'],paint:{'line-color':'#333333','line-width':3}});
}
const shadowOriginal=JSON.stringify(shadowBasis), shadow=Q.shadowStil(shadowBasis);
assert.equal(JSON.stringify(shadowBasis),shadowOriginal);
assert.deepEqual(shadow.sources,shadowBasis.sources);
assert.equal(shadow.glyphs,shadowBasis.glyphs);
assert.equal(shadow.layers.find(l=>l.id===Q.HAUSNUMMER_ID).paint['text-color'],'#e5edf2');
const roadColors=['#a6a18b','#718b99','#455c69','#101820','#333333'];
for(const [i,id] of ['motorway','primary','minor','primary_casing','unknown'].entries()){
  const l=shadow.layers.find(l=>l.id===id), before=shadowBasis.layers.find(l=>l.id===id);
  assert.equal(l.paint['line-color'],roadColors[i]);
  assert.equal(l.paint['line-width'],3);
  assert.deepEqual(l.filter,before.filter);
  assert.equal(l.minzoom,before.minzoom);
}
assert.deepEqual(shadow.layers.map(l=>l.id),shadowBasis.layers.map(l=>l.id));
assert.throws(()=>Q.shadowStil(Q.leererStil()));
assert.ok(Q.styleCachebar(detail,key));
for(const u of ['https://example.invalid/a?key=other','https://example.invalid/a?access_token=other','https://u:p@example.invalid/a','https://example.invalid/'+encodeURIComponent(key)]){
  const copy=JSON.parse(JSON.stringify(detail));copy.sources.protomaps.tiles=[u];assert.equal(Q.styleCachebar(copy,key),false);
}
assert.equal(Q.styleCachebar({...detail,metadata:{token:'other'}},key),false);
assert.equal(Q.styleCachebar({...detail,metadata:{name:key}},key),false);
assert.equal(Q.styleCachebar(detail,''),false);
const bericht=D.beschriftung(vorhanden);
assert.ok(bericht.includes('Hausnummern: 0/1 aktive Textlayer'));
assert.ok(D.beschriftung(angepasst).includes('Hausnummern: 1/1 aktive Textlayer; Zoom 17–24'));
assert.ok(!bericht.includes('Fixture Regular')&&!bericht.includes('https://'));


const ds={sources:{protomaps:{type:'vector',maxzoom:15}},layers:[{source:'protomaps','source-layer':'buildings'}]};
const sample=[{properties:{height:12,min_height:'0',name:'A','name:de':'A',secret:'NICHT-IM-BERICHT'}},{properties:{height:'unbekannt','building:levels':'3',name:'B'}},{properties:{height:'',min_height:null,'name:de':''}}];
const stats=D.statistik(sample);
assert.equal(stats.fragmente,3);
assert.deepEqual(stats.hoehen.height,{vorhanden:3,numerisch:1});
assert.deepEqual(stats.hoehen.min_height,{vorhanden:2,numerisch:1});
assert.equal(stats.namen['name:de'],1);
assert.equal(stats.hoehen['building:levels'].numerisch,1);
assert.equal(D.quelle(ds),'protomaps');
assert.equal(D.quelle({sources:{},layers:[]}),null);
const probe=D.stichprobe({getStyle:()=>ds,querySourceFeatures:(id,opt)=>{assert.equal(id,'protomaps');return opt.sourceLayer==='buildings'?sample:[];}});
assert.equal(probe.nativeMaxzoom,15);
assert.ok(D.text('Fixture',16,probe).includes('Gebäudefragmente: 3'));
assert.ok(!D.text('Fixture',16,probe).includes('NICHT-IM-BERICHT'));
assert.equal(D.ORTE.length,3);
for (const url of [
  Q.stil('voyager'), Q.stil('dunkel'),
  'https://tiles.basemaps.cartocdn.com/vector/carto.streets/v2/tiles.json?lang=de',
  'https://a.basemaps.cartocdn.com/gl/fonts/Noto/0-255.pbf',
  'https://basemaps.cartocdn.com/gl/voyager-gl-style/sprite@2x.png?key=old'
]) {
  const r = new URL(Q.cartoRequest(url,key).url);
  assert.equal(r.searchParams.get('key'),key);
  assert.equal(r.searchParams.getAll('key').length,1);
  assert.equal(r.hostname,new URL(url).hostname);
  assert.equal(r.searchParams.get('lang'),new URL(url).searchParams.get('lang'));
}
for (const url of [
  'https://basemaps.cartocdn.com.evil.example/a', 'https://evil.example/?next=basemaps.cartocdn.com',
  'https://evil.example@basemaps.cartocdn.com/a','https://basemaps.cartocdn.com@evil.example/a',
  'https://basemaps.cartocdn.com:444/a','http://basemaps.cartocdn.com/a',
  'https://tiles.openfreemap.org/styles/liberty','file:///C:/test','blob:abc','data:application/json,{}','relative.json'
]) assert.deepEqual(Q.cartoRequest(url,key),{url});
assert.deepEqual(Q.cartoRequest(Q.stil('voyager'),'  '),{url:Q.stil('voyager')});
assert.equal(Q.stil('toString'),null); assert.equal(Q.stil('shadow'),null);
assert.deepEqual(Q.leererStil().sources,{});
const a=Q.leererStil(); a.layers.length=0; assert.equal(Q.leererStil().layers.length,1);
// K2d-1: raster sources never imply exact coverage or send a CARTO key.
const bild=Q.bildInfo('berlin2024'), raster=Q.bildStil('berlin2024');
assert.equal(bild.gsd,0.20);assert.equal(bild.lizenz,'dl-de-zero-2.0');
assert.equal(Q.bildInfo('toString'),null);assert.throws(()=>Q.bildStil('mapbox'));
assert.equal(Q.bildBereich('berlin2024',[13.405,52.52],13),'kandidat');
assert.equal(Q.bildBereich('berlin2024',[13.405,52.52],8),'uebersicht');
assert.equal(Q.bildBereich('berlin2024',[8.138,49.350],16),'ausserhalb');
assert.equal(Q.bildBereich('berlin2024',[13.405,NaN],16),'unbekannt');
assert.equal(Q.bildBereich('unbekannt',[13.405,52.52],16),'unbekannt');
const bq=raster.sources[Q.BILD_ID], burl=bq.tiles[0];
assert.equal(bq.type,'raster');assert.equal(bq.tileSize,256);
assert.deepEqual(bq.bounds,bild.bounds);assert.equal(bq.maxzoom,19);
assert.ok(burl.includes('bbox={bbox-epsg-3857}')&&burl.includes('crs=EPSG:3857'));
assert.ok(burl.includes('format=image/png')&&burl.includes('transparent=true'));
assert.deepEqual(Q.cartoRequest(burl,key),{url:burl});
assert.equal(raster.layers.at(-1).id,Q.BILD_LAYER);
assert.equal(Q.vektorStil(raster),false);
bild.bounds[0]=0;bq.bounds[0]=0;
assert.equal(Q.bildInfo('berlin2024').bounds[0],13.07);
assert.equal(Q.bildStil('berlin2024').sources[Q.BILD_ID].bounds[0],13.07);
const liste=Q.bildListe();
assert.deepEqual(liste.map(q=>q.id),['berlin2024','brandenburg','rheinlandPfalz','nrw','sentinel2016']);
assert.ok(liste.every(q=>!Object.hasOwn(q,'url')));
liste[0].bounds[0]=0;assert.equal(Q.bildInfo('berlin2024').bounds[0],13.07);
assert.deepEqual(Q.bildKandidaten([13.405,52.52],14),['berlin2024','brandenburg','sentinel2016']);
assert.deepEqual(Q.bildKandidaten([13.405,52.52],14,['berlin2024']),['brandenburg','sentinel2016']);
assert.deepEqual(Q.bildKandidaten([13.405,52.52],14,['berlin2024','brandenburg']),['sentinel2016']);
assert.deepEqual(Q.bildKandidaten([14.33,51.76],14),['brandenburg','sentinel2016']);
assert.deepEqual(Q.bildKandidaten([8.27,50.0],14),['rheinlandPfalz','sentinel2016']);
// M1: real administrative polygons, not the rectangular request bounds.
for(const center of [[7.596,50.359],[7.46,50.43],[7.83,50.44]])assert.deepEqual(Q.bildKandidaten(center,16),['rheinlandPfalz','sentinel2016']);
for(const center of [[8.047,52.279],[8.678,50.584],[6.168,51.37]])assert.deepEqual(Q.bildKandidaten(center,16),['sentinel2016']);
for(const center of [[13.22,52.405],[13.51,52.39]])assert.deepEqual(Q.bildKandidaten(center,16),['brandenburg','sentinel2016']);
assert.deepEqual(Q.bildKandidaten([7.596,50.359],16,['rheinlandPfalz']),['sentinel2016']);
// Explicit provider selection retains coarse request bounds for edge comparisons.
assert.equal(Q.bildBereich('nrw',[7.596,50.359],16),'kandidat');
assert.ok(Q.bildStil('nrw').sources[Q.BILD_ID].attribution.includes('BKG'));

assert.deepEqual(Q.bildKandidaten([13.405,52.52],8),['sentinel2016']);
assert.deepEqual(Q.bildKandidaten([NaN,52.52],14),[]);
const bb=Q.bildStil('brandenburg','shadow-v2-bild-42');
assert.equal(bb.layers.at(-1).source,'shadow-v2-bild-42');
assert.equal(bb.sources['shadow-v2-bild-42'].type,'raster');
assert.ok(bb.sources['shadow-v2-bild-42'].attribution.includes('© Geoportal Berlin'));
assert.ok(bb.sources['shadow-v2-bild-42'].tiles[0].includes('layers=bebb_dop20c'));
assert.deepEqual(Q.cartoRequest(bb.sources['shadow-v2-bild-42'].tiles[0],key),{url:bb.sources['shadow-v2-bild-42'].tiles[0]});
assert.deepEqual(Q.bildKandidaten([13.405,52.52],14,['berlin2024','brandenburg','sentinel2016']),[]);
assert.deepEqual(Q.bildKandidaten([151.21,-33.87],19),['sentinel2016']);
assert.deepEqual(Q.bildKandidaten([0,89],14),[]);
const rp=Q.bildStil('rheinlandPfalz').sources[Q.BILD_ID], eox=Q.bildStil('sentinel2016').sources[Q.BILD_ID];
assert.equal(Q.bildInfo('rheinlandPfalz').gsd,0.2);assert.ok(rp.tiles[0].includes('layers=rp_dop20')&&rp.tiles[0].includes('srs=EPSG:3857'));
assert.ok(rp.attribution.includes('LVermGeoRP')&&rp.attribution.includes('dl-de/by-2-0'));
assert.equal(Q.bildInfo('sentinel2016').gsd,10);assert.equal(Q.bildInfo('sentinel2016').lizenz,'CC BY 4.0');
assert.equal(eox.maxzoom,14);assert.ok(eox.tiles[0].endsWith('/g/{z}/{y}/{x}.jpg'));
assert.ok(eox.attribution.includes('2016 &amp; 2017')&&eox.attribution.includes('CC BY 4.0'));
for(const src of [rp,eox])assert.deepEqual(Q.cartoRequest(src.tiles[0],key),{url:src.tiles[0]});


// NRW: nominell feinere regionale Quelle, keine Jahresgarantie.
assert.deepEqual(Q.bildKandidaten([6.56,51.3],14),['nrw','sentinel2016']);
assert.deepEqual(Q.bildKandidaten([6.56,51.3],14,['nrw']),['sentinel2016']);
assert.deepEqual(Q.bildKandidaten([6.56,51.3],8),['sentinel2016']);
const nw=Q.bildStil('nrw').sources[Q.BILD_ID];
assert.equal(Q.bildInfo('nrw').gsd,0.1);
assert.equal(Q.bildInfo('nrw').lizenz,'dl-de-zero-2.0');
assert.equal(nw.maxzoom,20);
assert.ok(nw.tiles[0].includes('layers=nw_dop_rgb')&&nw.tiles[0].includes('crs=EPSG:3857'));
assert.deepEqual(Q.cartoRequest(nw.tiles[0],key),{url:nw.tiles[0]});
// Hybrid: Raster unter ausgewählten Linien und Texten; keinerlei Mutation.
const hybridBasis=JSON.parse(JSON.stringify(detail));
hybridBasis.layers.push(
  {id:'water',type:'fill',source:'protomaps','source-layer':'water',paint:{'fill-color':'#333'}},
  {id:'roads',type:'line',source:'protomaps','source-layer':'roads',minzoom:10,filter:['==',['get','kind'],'major_road'],paint:{'line-width':2,'line-color':'#000'}},
  {id:'places',type:'symbol',source:'protomaps','source-layer':'places',layout:{'text-field':['get','name'],'text-font':['Fixture Regular'],'icon-image':'fixture'},paint:{'icon-opacity':1}},
  {id:'hidden-road',type:'line',source:'protomaps','source-layer':'roads',layout:{visibility:'none'}},
  {id:'poi',type:'symbol',source:'protomaps','source-layer':'pois',layout:{'text-field':['get','name']}}
);
hybridBasis.sprite='https://example.invalid/sprites';
const hb=JSON.stringify(hybridBasis);
const hybrid=Q.hybridStil('nrw',hybridBasis,'shadow-v2-bild-42');
assert.equal(JSON.stringify(hybridBasis),hb);
assert.deepEqual(hybrid.layers.map(l=>l.id),['hintergrund',Q.BILD_LAYER,'roads','places',Q.HAUSNUMMER_ID]);
assert.equal(hybrid.sources['shadow-v2-bild-42'].type,'raster');
assert.deepEqual(hybrid.sources.protomaps,hybridBasis.sources.protomaps);
assert.equal(hybrid.glyphs,hybridBasis.glyphs);assert.equal(hybrid.sprite,undefined);
assert.equal(hybrid.layers[2].paint['line-opacity'],0.55);
assert.deepEqual(hybrid.layers[2].filter,hybridBasis.layers[3].filter);
assert.equal(hybrid.layers[3].layout['icon-image'],undefined);
assert.equal(hybrid.layers[3].paint['icon-opacity'],undefined);
assert.equal(hybrid.layers[3].paint['text-halo-width'],1.4);
assert.ok(hybrid.layers.every(l=>['background','raster','line','symbol'].includes(l.type)));
assert.throws(()=>Q.hybridStil('nrw',Q.leererStil()));
assert.throws(()=>Q.hybridStil('nrw',basis));
assert.throws(()=>Q.hybridStil('nrw',hybridBasis,'protomaps'));
const nurOverlay=Q.hybridStil(null,hybridBasis,Q.BILD_ID,'shadow-v2-hybrid-2');
assert.deepEqual(Object.keys(nurOverlay.sources),['shadow-v2-hybrid-2']);
assert.ok(!nurOverlay.layers.some(l=>l.type==='raster'));
assert.ok(nurOverlay.layers.filter(l=>l.source).every(l=>l.source==='shadow-v2-hybrid-2'));
assert.deepEqual(nurOverlay.sources['shadow-v2-hybrid-2'],hybridBasis.sources.protomaps);
assert.throws(()=>Q.hybridStil('nrw',hybridBasis,Q.BILD_ID,Q.BILD_ID));
assert.equal(JSON.stringify(hybridBasis),hb);

// K2f: fixed probe whitelist, exact WMS tile extent and WMTS row/column.
assert.equal(D.BILDPROBEN.length,6);
assert.throws(()=>D.bildProbe(Q,{...D.BILDPROBEN[0]}));
for(const p of D.BILDPROBEN){
  const b=D.bildProbe(Q,p),u=new URL(b.url),n=2**p.z;
  assert.ok(b.x>=0&&b.x<n&&b.y>=0&&b.y<n);assert.equal(b.tileSize,256);
  assert.ok(!u.searchParams.has('key')&&!/[{}]/.test(b.url));
  if(p.id==='sentinel2016')assert.ok(u.pathname.endsWith('/'+p.z+'/'+b.y+'/'+b.x+'.jpg'));
  else{
    const box=u.searchParams.get('bbox').split(',').map(Number);
    assert.ok(box.every(Number.isFinite)&&box[0]<box[2]&&box[1]<box[3]);
    const d=40075016.685578488/n;
    assert.ok(Math.abs(box[2]-box[0]-d)<1e-6&&Math.abs(box[3]-box[1]-d)<1e-6);
  }
}
assert.deepEqual(D.pixelStatistik([1,2,3,255,1,2,3,255]),{pixel:2,transparent:0,deckend:2,einfarbig:true,auffaellig:true});
assert.equal(D.pixelStatistik([1,2,3,0,9,9,9,0]).auffaellig,true);
assert.equal(D.pixelStatistik([1,2,3,255,4,5,6,255]).auffaellig,false);
assert.throws(()=>D.pixelStatistik([]));
const render=D.renderDetails({getStyle:()=>angepasst,queryRenderedFeatures:()=>[{properties:{name:'PRIVATE_FIXTURE',token:'PRIVATE_FIXTURE'}}]});
assert.equal(render.Hausnummern.layer,1);assert.equal(render.Hausnummern.fragmente,1);
assert.ok(!JSON.stringify(render).includes('PRIVATE_FIXTURE'));
assert.equal(D.renderDetails({getStyle:()=>Q.leererStil()}),null);
const adr=D.adressDetails({getStyle:()=>angepasst,querySourceFeatures:()=>[
  {geometry:{type:'Point'},properties:{addr_housenumber:'PRIVATE_1',kind:'address'}},
  {geometry:{type:'Polygon'},properties:{addr_housenumber:'PRIVATE_2',kind:'building'}},
  {geometry:{type:'Polygon'},properties:{addr_housenumber:''}},
  {geometry:{type:'Point'},properties:{name:'PRIVATE_3'}}
]});
assert.equal(adr.punkt,1);assert.equal(adr.polygon,1);assert.equal(adr.kindAddress,1);
assert.equal(adr.geprueft,4);assert.equal(adr.layer.length,1);assert.equal(adr.layer[0].min,17);
assert.ok(!JSON.stringify(adr).includes('PRIVATE_'));
const adrFallback=D.adressDetails({getStyle:()=>dunkel,querySourceFeatures:()=>[]});
assert.equal(adr.layer[0].stil.farbe,'nicht gesetzt');
assert.equal(adrFallback.layer[0].stil.farbe,'#d6dbe0');
assert.equal(adrFallback.layer[0].stil.halo,'#24292e');
assert.equal(adrFallback.layer[0].stil.haloBreite,1.2);
assert.equal(adrFallback.layer[0].stil.opazitaet,'nicht gesetzt');
assert.equal(adrFallback.layer[0].stil.groesse,11);
assert.equal(adrFallback.layer[0].stil.neigung,'viewport');
assert.equal(adr.extrusion[0].farbe,'#637783');
assert.equal(adr.extrusion[0].opazitaet,0.82);
const adrStil=JSON.parse(JSON.stringify(dunkel));
const adrLayer=adrStil.layers.find(l=>l.id===Q.HAUSNUMMER_ID);
adrLayer.paint['text-color']=['match',['get','PRIVATE_PROPERTY'],'PRIVATE_VALUE','#000','#fff'];
adrLayer.paint['text-halo-color']='https://example.invalid/PRIVATE_URL';
adrLayer.paint['text-opacity']=0.5;
adrLayer.layout['text-size']=['interpolate',['linear'],['zoom'],17,11,19,13];
const adrSicher=D.adressDetails({getStyle:()=>adrStil,querySourceFeatures:()=>[]});
assert.equal(adrSicher.layer[0].stil.farbe,'Ausdruck/Objekt');
assert.equal(adrSicher.layer[0].stil.halo,'nicht ausgewertet');
assert.equal(adrSicher.layer[0].stil.opazitaet,0.5);
assert.equal(adrSicher.layer[0].stil.groesse,'Ausdruck/Objekt');
assert.ok(!JSON.stringify(adrSicher).includes('PRIVATE_'));

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'shadow-maplibre-'));
try {
  const pkg=path.join(__dirname,'node_modules','maplibre-gl'), ziel=path.join(tmp,'vendor');
  const m=bereitstellen(pkg,ziel);
  assert.equal(m.version,VERSION);
  for (const n of DATEIEN) {
    const b=fs.readFileSync(path.join(ziel,n));
    assert.deepEqual(b,fs.readFileSync(path.join(pkg,'dist',n)));
    assert.equal(m.dateien[n],crypto.createHash('sha256').update(b).digest('hex'));
  }
  assert.deepEqual(bereitstellen(pkg,ziel),m);
  fs.writeFileSync(path.join(ziel,DATEIEN[0]),'abweichend');
  assert.throws(()=>bereitstellen(pkg,ziel),/Abweichende lokale/);
  assert.equal(fs.readFileSync(path.join(ziel,DATEIEN[0]),'utf8'),'abweichend');
  const falsch=path.join(tmp,'falsch'); fs.mkdirSync(falsch);
  fs.writeFileSync(path.join(falsch,'package.json'),JSON.stringify({name:'maplibre-gl',version:'0.0.0'}));
  assert.throws(()=>bereitstellen(falsch,path.join(tmp,'nicht-erzeugt')),/exakt/);
  assert.equal(fs.existsSync(path.join(tmp,'nicht-erzeugt')),false);
} finally { fs.rmSync(tmp,{recursive:true,force:true}); }
console.log('OK: K2a CARTO-Hostgrenzen, Schlüsselparameter, leere Karte und lokale MapLibre-Dateien');
