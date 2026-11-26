'use strict';
/* Reale lokale MapLibre-Bibliothek unter file://, aber ausschließlich deterministische
   HTTP-Fixtures. Kein API-Key, keine echten Anbieterabrufe, keine Profildaten. */
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const { ROOT } = require('./_pfad');
const Q = require('../karte-v2-quellen');
(async () => {
  const vendor = path.join(ROOT, 'vendor', 'maplibre-gl');
  const manifest = JSON.parse(fs.readFileSync(path.join(vendor,'manifest.json'),'utf8'));
  assert.equal(manifest.version,'4.7.1');
  for (const n of ['maplibre-gl.js','maplibre-gl.css','LICENSE.txt']) {
    const bytes=fs.readFileSync(path.join(vendor,n));
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),manifest.dateien[n],n);
    assert.deepEqual(bytes,fs.readFileSync(path.join(__dirname,'node_modules','maplibre-gl','dist',n)),n+' wie npm');
  }
  const browser = await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
  try {
    const p = await browser.newPage({viewport:{width:1000,height:720},reducedMotion:'reduce'});
    p.setDefaultTimeout(20000);
    const errors=[], requests=[], unexpected=[];
    p.on('pageerror', e => errors.push(e.message));
    const key='FIXTURE+/k';
    const own='https://tiles.basemaps.cartocdn.com/k2-fixture.geojson';
    const other='https://example.invalid/k2-fixture.geojson';
    const feature={type:'FeatureCollection',features:[{type:'Feature',properties:{},geometry:{type:'Point',coordinates:[13.405,52.52]}}]};
    const style={version:8,sources:{own:{type:'geojson',data:own},other:{type:'geojson',data:other}},layers:[
      {id:'bg',type:'background',paint:{'background-color':'#304050'}},
      {id:'own',type:'circle',source:'own',paint:{'circle-radius':10,'circle-color':'#ffb000'}},
      {id:'other',type:'circle',source:'other',paint:{'circle-radius':4,'circle-color':'#ffffff'}}
    ]};
    await p.route(/^https?:/, async route => {
      const u=new URL(route.request().url()); requests.push(u.href);
      const bare=u.origin+u.pathname;
      const json=bare===Q.stil('voyager')||bare===Q.stil('dunkel')?style:bare===own||bare===other?feature:null;
      if(!json){unexpected.push(bare);return route.abort();}
      return route.fulfill({status:200,json,headers:{'access-control-allow-origin':'*'}});
    });
    const meldung=text=>p.waitForFunction(text=>document.getElementById('meldung').textContent.includes(text),text);
    await p.goto(pathToFileURL(path.join(ROOT,'karte-v2-prototyp.html')).href);
    await meldung('Keine Kachelquelle aktiv');
    assert.equal(await p.evaluate(()=>maplibregl.getVersion()),'4.7.1');
    assert.equal(await p.locator('canvas.maplibregl-canvas').count(),1);
    assert.ok(await p.locator('.maplibregl-ctrl-zoom-in').isVisible());
    assert.match(await p.locator('footer').innerText(),/OpenStreetMap contributors, © CARTO/);
    assert.equal(requests.length,0,'keine Anfrage beim Start');
    await p.click('#diagnose');
    assert.match(await p.inputValue('#diagnose-bericht'),/Kein geeigneter CARTO-Vektorstil geladen/);
    assert.equal(requests.length,0,'Diagnose ohne Schlüssel/Quelle bleibt lokal');
    await p.click('#voyager'); await meldung('CARTO-Schlüssel lokal eingeben');
    assert.equal(requests.length,0,'keine Anfrage ohne Key');
    const waitReq = base => p.waitForRequest(r=>{const u=new URL(r.url());return u.origin+u.pathname===base;});
    await p.fill('#key',key);
    const [req,ownReq,otherReq] = await Promise.all([waitReq(Q.stil('voyager')),waitReq(own),waitReq(other),p.click('#voyager')]);
    assert.equal(new URL(req.url()).searchParams.get('key'),key);
    assert.equal(new URL(ownReq.url()).searchParams.get('key'),key);
    assert.equal(new URL(otherReq.url()).searchParams.has('key'),false);
    await meldung('Stil geladen');
    assert.equal(await p.locator('#key').inputValue(),'');
    assert.ok(!(await p.locator('body').innerText()).includes(key));
    await p.click('#geneigt'); await p.click('#flach');
    const [dark]=await Promise.all([waitReq(Q.stil('dunkel')),p.click('#dunkel')]);
    assert.equal(new URL(dark.url()).searchParams.get('key'),key);
    await meldung('Stil geladen');
    await p.click('#leer'); await meldung('Keine Kachelquelle aktiv');
    const anzahl=requests.length;
    await p.click('#voyager'); await meldung('CARTO-Schlüssel lokal eingeben');
    assert.equal(requests.length,anzahl,'nach Leeren kein Key und kein neuer Abruf');
    assert.deepEqual(unexpected,[]);
    assert.deepEqual(errors,[]);
    console.log('OK: K2b lokale MapLibre-Browserprobe, Integrität, Quellenvertrag und Stilwechsel');
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
