'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'..','karte-modul.js'),'utf8');
const start=src.indexOf('function karteSuchTreffer('),end=src.indexOf('function zeichneKarte(',start);
assert.ok(start>=0&&end>start);
const K={zoom:4};
const model={marker:[
 {id:'PIN-001',renderKey:'pin1',kat:'pin',name:'Treffpunkt Süd',ll:[49,8]},
 {id:'SI-001',renderKey:'si1',kat:'sichtung',name:'Dossier Nord',entId:'P-001',ll:[49,8]},
 {id:'SI-001',renderKey:'si2',kat:'sichtung',name:'Dossier Süd',entId:'P-002',ll:[50,9]},
 {id:'P-002',renderKey:'dossier2',entitaet:true,typ:'Person',name:'Süd',ll:[50,9]},
 {id:'PIN-002',renderKey:'pin2',kat:'pin',name:'Gesperrter Name',ll:[49,8]},
 {id:'PIN-003',renderKey:'duplicate',kat:'pin',name:'Doppel',ll:[49,8]},
 {id:'PIN-004',renderKey:'duplicate',kat:'pin',name:'Doppel',ll:[49,8]}
],zonen:[{id:'ZO-001',renderKey:'zone1',name:'Treffpunkt Reserve',ll:[49,9]}],kanten:[]};
let calls=[];
const f=new Function('VIEW','falten','sperreText','karteRenderModell','kartePanelObjekt','karteWaehlen','karteFlug','karteAuswahlAnzeige',src.slice(start,end)+';return {karteSuchTreffer,karteSuchSprung};')(
 {karte:K},s=>String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''),s=>s.replace('Gesperrter Name','P-009'),
 ()=>model,(id,key,m)=>{const a=m.marker.map(objekt=>({art:'marker',objekt})).concat(m.zonen.map(objekt=>({art:'zone',objekt}))).filter(x=>x.objekt.id===id&&(!key||x.objekt.renderKey===key));return a.length===1?a[0]:null;},
 (...a)=>calls.push(['wahl',...a]),(...a)=>calls.push(['flug',...a]),()=>{});
const search=(q,typ)=>f.karteSuchTreffer(model,q,typ);
assert.deepEqual(search('treffpunkt').map(x=>x.key),['zone1','pin1']);
assert.deepEqual(search('TREFFPUNKT sud','pin').map(x=>x.key),['pin1']);
assert.equal(search('SI-001','sichtung').length,2);
assert.deepEqual(search('P-002 SI-001','sichtung').map(x=>x.key),['si2']);
assert.equal(search('gesperrter').length,0);
assert.equal(search('P-009').length,1);
assert.equal(search('Doppel').length,0);
assert.equal(search('').length,0);assert.equal(search('treffpunkt','unbekannt').length,0);
assert.equal(f.karteSuchSprung('SI-001','si2'),true);assert.deepEqual(calls[0],['wahl','SI-001',false,'si2']);assert.deepEqual(calls[1].slice(0,4),['flug',50,9,16.5]);
calls=[];assert.equal(f.karteSuchSprung('ZO-001','zone1'),true);assert.deepEqual(calls[0],['wahl','ZO-001',false]);
calls=[];K.pick='P-002';assert.equal(f.karteSuchSprung('P-002','dossier2'),false);assert.equal(calls.length,0);K.pick=null;
model.zonen=[];assert.equal(f.karteSuchSprung('ZO-001','zone1'),false);assert.equal(calls.length,0);
console.log('OK: lokale Kartensuche, Typen, Maskierung, eindeutige Sichtungen, stale Treffer und Kameraziel');
