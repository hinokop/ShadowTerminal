const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1500,height:1000}})).newPage();const e=[];p.on('pageerror',x=>e.push(x.message));
await p.addInitScript(()=>{window.__ARGUS_ERGEBNIS='direkt'});
await p.goto(require('./_pfad.js').APP);await p.waitForTimeout(5200);await p.keyboard.press('Space');await p.fill('#gate-pw','pw-test-123');await p.fill('#gate-pw2','pw-test-123');await p.click('#gate-go');
await p.waitForFunction(()=>!document.body.classList.contains('locked'),null,{timeout:20000});
await p.evaluate(()=>{dispatch({type:'KENNWORT_SCHALTER',an:false});dispatch({type:'STATUS_GESETZT',status:'Standby'});dispatch({type:'MISSION_ZUGEWIESEN',id:'M1'});dispatch({type:'MISSION_ANGENOMMEN',id:'M1'});MS('M1').beginn=new Date(Date.now()-60000).toISOString();dispatch({type:'NAVIGATION',modul:'karte'});
dispatch({type:'ZONE_ANGELEGT',ll:[52.4817,13.4352]});});
let fail=0;const chk=(ok,t)=>{if(!ok)fail++;console.log((ok?'OK  ':'FAIL')+' '+t)};
const due=async(n=2)=>{for(let i=0;i<n;i++){await p.evaluate(()=>{STATE.plan.forEach(x=>{x.faelligAm=new Date(Date.now()-1000).toISOString()})});await p.waitForTimeout(1500)}};
const last=(n=1)=>p.evaluate(n=>STATE.komm.kanaele.handler.nachrichten.slice(-n).map(m=>m.text),n);
// Popup: Kurzhinweis
await p.evaluate(()=>{dispatch({type:'ZONE_GEAENDERT',id:'ZN-001',wertung:'leicht'});karteWaehlen('ZN-001',false)});await p.waitForTimeout(500);
await p.click('#zn-melden');await p.waitForTimeout(400);
chk(await p.locator('#zn-melden').count()===0,'Popup schließt nach "Handler informieren"');
chk(await p.evaluate(()=>/informiert: ZN-001/.test(document.getElementById('kurzhinweis').textContent)&&document.getElementById('kurzhinweis').className==='an'),'Kurzhinweis sichtbar');
await p.evaluate(()=>karteWaehlen('ZN-001',false));await p.waitForTimeout(400);await p.click('#zn-frage');await p.waitForTimeout(300);
chk(await p.evaluate(()=>/erfragt/.test(document.getElementById('kurzhinweis').textContent)),'Kurzhinweis bei "Lage erfragen"');
// Ereignisse je Stufe, ohne Eskalation (Math.random fest hoch)
const sets=await p.evaluate(()=>{const o={};STATE.zonenEv=STATE.zonenEv||{};Math.random=()=>0.99;['ruhig','leicht','bedroht','akut'].forEach(w=>{dispatch({type:'ZONE_GEAENDERT',id:'ZN-001',wertung:w});const zn=zonenEigene(zDef())[0];const E=SCENARIO.zonen.ereignisse[w];const seq=[];for(let i=0;i<E.length*2;i++){STATE.zonenEv.letzte=null;dispatch({type:'ZONEN_EREIGNIS',id:'ZN-001'});seq.push(zonenEigene(zDef())[0].verlauf.slice(-1)[0].text)}let ok=true;for(let i=0;i<seq.length;i++){for(let k=1;k<=Math.min(3,E.length-1);k++){if(i+k<seq.length&&seq[i]===seq[i+k])ok=false}}o[w]={n:E.length,verschieden:new Set(seq).size,keineNahWiederholung:ok,wertungBleibt:zonenEigene(zDef())[0].wertung===w}});return o});
console.log(JSON.stringify(sets));
Object.keys(sets).forEach(w=>chk(sets[w].keineNahWiederholung&&sets[w].verschieden>=Math.min(5,sets[w].n)&&sets[w].wertungBleibt,'Stufe '+w+': '+sets[w].n+' Meldungen, keine Wiederholung innerhalb von 3 Meldungen'));
const tot=await p.evaluate(()=>Object.values(SCENARIO.zonen.ereignisse).reduce((a,l)=>a+l.length,0));chk(tot>=20&&tot<=36,'Gesamtzahl Ereignissätze: '+tot);
// Eskalation
await p.evaluate(()=>{dispatch({type:'ZONE_GEAENDERT',id:'ZN-001',wertung:'leicht'});const zn=zonenEigene(zDef())[0];zn.stand=new Date(Date.now()-3600000).toISOString();STATE.zonenEv.letzte=null;Math.random=()=>0.01;dispatch({type:'ZONEN_EREIGNIS',id:'ZN-001'});Math.random=()=>0.5});
const z1=await p.evaluate(()=>{const z=zonenEigene(zDef())[0];return {w:z.wertung,durch:z.durch,v:z.verlauf.slice(-1)[0]}});console.log(JSON.stringify(z1));
chk(z1.w==='bedroht'&&z1.durch==='handler'&&z1.v.art==='angehoben','Handler hebt Zone von leicht auf bedroht');
await due(2);const m=(await last(1))[0];console.log('   '+m);chk(/Bedroht/.test(m)&&/ZN-001/.test(m),'Handler berichtet die Anhebung mit neuer Bewertung');
// Entwarnung
await p.evaluate(()=>{const zn=zonenEigene(zDef())[0];zn.stand=new Date(Date.now()-4*3600000).toISOString();STATE.zonenEv.letzte=null;let k=0;Math.random=()=>{k++;return k<=2?0.99:0.1};dispatch({type:'ZONEN_EREIGNIS',id:'ZN-001'});Math.random=()=>0.5});
const z2=await p.evaluate(()=>{const z=zonenEigene(zDef())[0];return {w:z.wertung,a:z.verlauf.slice(-1)[0].art}});console.log(JSON.stringify(z2));
chk(z2.w==='leicht'&&z2.a==='gesenkt','Handler senkt nach 3+ Stunden');
// Tick-Auslösung
const pre=await p.evaluate(()=>{const zn=zonenEigene(zDef())[0];zn.naechste=new Date(Date.now()-1000).toISOString();STATE.zonenEv.letzte=null;return zn.verlauf.slice(-1)[0].t});
await p.waitForTimeout(2500);
chk(await p.evaluate(n=>zonenEigene(zDef())[0].verlauf.slice(-1)[0].t!==n,pre),'Tick löst fällige Meldung selbst aus');
// Zeitabstand
chk(await p.evaluate(()=>{const zn=zonenEigene(zDef())[0];return Date.parse(zn.naechste)>Date.now()+5*60000}),'Nächste Meldung liegt in der Zukunft');
// Sperre: Ruhend/Funkstille
const sp=await p.evaluate(()=>{const zn=zonenEigene(zDef())[0];zn.naechste=new Date(Date.now()-1000).toISOString();STATE.zonenEv.letzte=null;STATE.agent.status='Ruhend';return zonenEigene(zDef())[0].verlauf.slice(-1)[0].t});
await p.waitForTimeout(2500);chk(await p.evaluate(n=>zonenEigene(zDef())[0].verlauf.slice(-1)[0].t===n,sp),'Ruhend: keine Zonenmeldungen');
await p.evaluate(()=>{STATE.agent.status='Standby'});
// Popup-Verlauf: statt starrem 500-ms-Fenster die tatsächlich gerenderte
// Zone samt Historienfeld erwarten. Unter CI-Last kann das SVG/Popup später
// neu gezeichnet werden. Eine echte fehlende Anzeige bleibt ein Testfehler.
await p.evaluate(()=>{karteWaehlen('ZN-001',false)});
await p.waitForFunction(()=>{
  const box=document.getElementById('k-auswahl');
  return !!box && !box.hidden && /Verlauf/i.test(box.textContent);
},null,{timeout:6000}).catch(()=>null);
const popup=await p.evaluate(()=>{
  const box=document.getElementById('k-auswahl'), z=karteZoneFinden('ZN-001');
  return {auswahl:VIEW.karte.auswahl, popup:!!box, hidden:box?box.hidden:null,
    text:box?box.textContent.slice(0,200):'', zonenansicht:VIEW.missionsansicht===STATE,
    zone:!!z, verlaenge:z&&z.verlauf?z.verlauf.length:0,
    verlauf:!!box && !box.hidden && /Verlauf/i.test(box.textContent)};
});
if(!popup.verlauf)console.log('ZEV Popup-Diagnose:',JSON.stringify(popup));
chk(popup.verlauf,'Popup zeigt Verlauf');
await p.screenshot({path:'zev.png'});
console.log(e.join('\n')||'keine Seitenfehler');console.log(fail?'FEHLER: '+fail:'ALLE OK');await b.close()})();
