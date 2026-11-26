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
