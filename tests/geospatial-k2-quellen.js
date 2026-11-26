'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), crypto = require('node:crypto');
const Q = require('../karte-v2-quellen.js');
const { bereitstellen, VERSION, DATEIEN } = require('../tools/maplibre-bereitstellen.js');
const key = 'fixture +/&?';
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
