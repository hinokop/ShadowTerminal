const fs=require('fs');const src=fs.readFileSync(require('path').join(__dirname,'..','karte-modul.js')+'','utf8');
const m=src.match(/function sonneHoehe[\s\S]*?function lichtPhase/)[0].replace(/function lichtPhase$/,'');
eval(m+';globalThis.sonneHoehe=sonneHoehe;globalThis.sonneTag=sonneTag;');
const cases=[[52.4905,13.426,'2026-11-13T12:00:00Z'],[52.4905,13.426,'2026-06-21T12:00:00Z'],[52.35,14.55,'2026-12-21T12:00:00Z'],[50.5,8,'2026-03-20T12:00:00Z'],[69.65,18.96,'2026-12-21T12:00:00Z'],[69.65,18.96,'2026-06-21T12:00:00Z'],[-33.9,151.2,'2026-11-13T12:00:00Z']];
const out=cases.map(([la,lo,t])=>{const d=sonneTag(la,lo,Date.parse(t));const f=x=>x?new Date(x).toISOString().slice(11,16):null;return {la,lo,t:t.slice(0,10),auf:d.sonne&&f(d.sonne.auf),unter:d.sonne&&f(d.sonne.unter),bA:d.buerger&&f(d.buerger.auf),bU:d.buerger&&f(d.buerger.unter),el:sonneHoehe(la,lo,Date.parse(t)).toFixed(2)}});
console.log(JSON.stringify(out));
