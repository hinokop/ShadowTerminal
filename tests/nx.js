const {chromium}=require('playwright');
const ok=(c,m)=>console.log((c?'OK   ':'FAIL ')+m);
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1400,height:1200}})).newPage();const e=[];p.on('pageerror',x=>e.push(x.message));
await p.goto(require('./_pfad.js').APP);await p.waitForTimeout(5200);await p.fill('#gate-pw','pw-test-123');await p.fill('#gate-pw2','pw-test-123');await p.click('#gate-go');
await p.waitForFunction(()=>!document.body.classList.contains('locked'),null,{timeout:20000});
const due=async(typ)=>p.evaluate((t)=>{const l=STATE.plan.filter(x=>x.typ===t);l.forEach(x=>dispatch({type:'FAELLIG',id:x.id}));return l.length},typ);
const send=(t,k='handler')=>p.evaluate(([t,k])=>dispatch({type:'NACHRICHT_GESENDET',kanal:k,text:t,dringlichkeit:'Routine'}),[t,k]);
const last=()=>p.evaluate(()=>{const n=STATE.komm.kanaele.handler.nachrichten;return n[n.length-1]});
const alleDue=()=>p.evaluate(()=>{STATE.plan.slice().forEach(x=>{if(x.typ==='antwort'||x.typ==='kennwort_frei'||x.typ==='verlauf'||x.typ==='funkstille')dispatch({type:'FAELLIG',id:x.id})})});
// Pin-Nummer
await p.evaluate(()=>{dispatch({type:'PIN_ANGELEGT',ll:[52.48,13.43]});dispatch({type:'PIN_ANGELEGT',ll:[52.49,13.44]});});
const n1=await p.evaluate(()=>PROFIL.pins.map(x=>x.name).join(','));ok(n1==='Pin 1,Pin 2','Pins: '+n1);
await p.evaluate(()=>dispatch({type:'PIN_ENTFERNT',id:'PIN-001'}));
await p.evaluate(()=>dispatch({type:'PIN_ANGELEGT',ll:[52.5,13.45]}));
const n2=await p.evaluate(()=>PROFIL.pins.map(x=>x.name).sort().join(','));ok(n2==='Pin 1,Pin 2','Pin 1 wird wiederverwendet: '+n2);
// X-Hotkey
await p.evaluate(()=>{window.__b=0;Zugang.beenden=function(){window.__b++}});await p.keyboard.press('x');await p.waitForTimeout(200);
ok(await p.evaluate(()=>window.__b===1),'X beendet sofort ohne Bestätigung');
await p.keyboard.press('Escape');await p.waitForTimeout(200);
ok(!(await p.evaluate(()=>!!document.getElementById('btn-lock'))),'Sperren-Button entfernt');
// Mission, PACE
await p.evaluate(()=>{dispatch({type:'STATUS_GESETZT',status:'Aktiv'});});
await p.evaluate(()=>{dispatch({type:'MISSION_ZUGEWIESEN',id:'M1'});dispatch({type:'MISSION_ANGENOMMEN',id:'M1'})});
console.log('laufend',await p.evaluate(()=>!!LM()));
if(await p.evaluate(()=>!!LM())){
 const r=await p.evaluate(()=>{dispatch({type:'PACE_EINGEREICHT',p:'Kanal Ansprechpartner',a:'Kanal Support',c:'Rückruf über Festnetz (einmal klingeln lassen)',e:'Kontakt über KIEBITZ',pin:'',abbruch:'Wenn ich zweimal dasselbe Fahrzeug sehe'});return MS(LM().id).pace.stand});
 ok(r==='zurueck','KIEBITZ als Notfallweg wird zurückgewiesen');
 const r2=await p.evaluate(()=>{dispatch({type:'PACE_EINGEREICHT',p:'Kanal Ansprechpartner',a:'Kanal Support',c:'Rückruf über Festnetz (einmal klingeln lassen)',e:'Persönliches Signal am Sammelpunkt',pin:'',abbruch:'Wenn ich zweimal dasselbe Fahrzeug sehe'});return MS(LM().id).pace.stand});
 ok(r2==='angenommen','sauberer Plan angenommen');
 await p.evaluate(()=>dispatch({type:'NAVIGATION',modul:'mission'}));await p.waitForTimeout(400);
 ok(await p.evaluate(()=>!!document.getElementById('btn-pace')&&!!document.getElementById('btn-zp-karte')&&!document.getElementById('wi-g-P-0019')),'Panels: PACE und Karten-Button da, Wissensstände weg');
 await p.screenshot({path:'auftrag.png',fullPage:true});
}
if(await p.evaluate(()=>!!LM())){
 await p.evaluate(()=>dispatch({type:'ZUGRIFF_ANGELEGT',typ:'Zugriff',bezug:'L-0002',text:'',r:'100'}));
 ok(await p.evaluate(()=>MS('M1').zugriff.length===1&&MS('M1').zugriff[0].r===100),'Zugriffspunkt ohne Begründungspflicht, Radius');
 await p.evaluate(()=>dispatch({type:'ZUGRIFF_GEAENDERT',id:'ZP-01',typ:'Eingriff',r:250,bezug:'L-0008',text:'Tor'}));
 const z=await p.evaluate(()=>MS('M1').zugriff[0]);ok(z.typ==='Eingriff'&&z.r===250&&z.bezug==='L-0008'&&z.text==='Tor','Zugriffspunkt änderbar');
 await p.evaluate(()=>dispatch({type:'ZUGRIFF_ORT',id:'ZP-01',ll:[52.4,13.3]}));
 ok(await p.evaluate(()=>MS('M1').zugriff[0].ll[0]===52.4),'Zugriffspunkt verschiebbar');
 await p.evaluate(()=>dispatch({type:'NAVIGATION',modul:'karte'}));await p.evaluate(()=>{VIEW.karte.auswahl='ZP-01';karteAuswahlAnzeige()});await p.waitForTimeout(300);
 ok(await p.evaluate(()=>!!document.getElementById('zpp-verschieben')),'Karten-Popup mit Bearbeitung');
}
console.log(e.length?'FEHLER '+e.join('|'):'keine Seitenfehler');await b.close()})();
