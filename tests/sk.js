const {chromium}=require('playwright');
const ok=(c,m)=>console.log((c?'OK   ':'FAIL ')+m);
(async()=>{const b=await chromium.launch();const e=[];
const p=await (await b.newContext({viewport:{width:1400,height:1300}})).newPage();p.on('pageerror',x=>e.push(x.message));
await p.goto(require('./_pfad.js').APP);await p.waitForTimeout(5200);await p.fill('#gate-pw','pw-test-123');await p.fill('#gate-pw2','pw-test-123');await p.click('#gate-go');
await p.waitForFunction(()=>!document.body.classList.contains('locked'),null,{timeout:20000});
const due=(typ)=>p.evaluate((typ)=>{STATE.plan.filter(x=>!typ||x.typ===typ).forEach(x=>{x.faelligAm=new Date(Date.now()-1000).toISOString()});STATE.plan.slice().forEach(x=>{if(STATE.plan.includes(x)&&(!typ||x.typ===typ))dispatch({type:'FAELLIG',id:x.id})})},typ);
const send=(t,k='asset')=>p.evaluate(([t,k])=>dispatch({type:'NACHRICHT_GESENDET',kanal:k,text:t,dringlichkeit:'Routine'}),[t,k]);
const n=()=>p.evaluate(()=>STATE.komm.kanaele.asset.nachrichten.filter(m=>m.von==='gegenstelle').length);
const lastA=()=>p.evaluate(()=>{const a=STATE.komm.kanaele.asset.nachrichten.filter(m=>m.von==='gegenstelle');return a.length?a[a.length-1].text:''});
await p.evaluate(()=>{dispatch({type:'KENNWORT_SCHALTER',ein:false});dispatch({type:'STATUS_GESETZT',status:'Standby'});dispatch({type:'MISSION_ZUGEWIESEN',id:'M1'});dispatch({type:'MISSION_ANGENOMMEN',id:'M1'});alleEntitaeten().forEach(e=>{IZ()[e.id]={status:'frei'}});MS('M1').beginn=new Date(Date.now()-120000).toISOString();akteurDaten('asset').belastung=90;Store.save(STATE);render()});
// 1 erste Antwort
await send('Wie ist die Lage vor Ort?');await due('antwort');
console.log(await lastA());
ok(/Kein Kontakt jetzt/.test(await lastA()),'erste Antwort: Kein Kontakt jetzt');
ok(await p.evaluate(()=>!!akteurDaten('asset').schweigt),'Schweigen gesetzt');
const n1=await n();
// 2 weitere Nachrichten: keine Antwort
await send('Bist du noch da?');await due('antwort');await send('Antworte bitte.');await due('antwort');
ok(await n()===n1,'keine weitere Antwort');
ok(await p.evaluate(()=>STATE.komm.kanaele.asset.nachrichten.slice(-1)[0].von!=='gegenstelle'),'letzte Nachricht ist meine');
// 3 Pause per Button
await p.keyboard.press('4');await p.evaluate(()=>{STATE.komm.aktiv='asset';render()});await p.waitForTimeout(300);
const vis=await p.evaluate(()=>{const b=document.getElementById('btn-funkruhe');return !!b&&!b.disabled});
if(!vis){console.log(await p.evaluate(()=>STATE.ui.modul+' '+STATE.komm.aktiv))}
ok(vis,'Funkruhe-Button vorhanden');
const bv=await p.evaluate(()=>akteurDaten('asset').belastung);if(vis){await p.click('#btn-funkruhe');await p.waitForTimeout(200);await due('antwort');}
ok(await n()===n1+1,'Quittung der Funkruhe');
console.log(await lastA());
ok(await p.evaluate((bv)=>{const a=akteurDaten('asset');return !!a.ruheBis&&a.belastung<=bv-5},bv),'Funkruhe gesetzt, Belastung gesenkt');
const b1=await p.evaluate(()=>akteurDaten('asset').belastung);
// 4 Bruch der Funkruhe
await send('Kurze Rückfrage.');await due('antwort');
ok(await n()===n1+1,'Funkruhe: keine Antwort');
ok(await p.evaluate(b1=>akteurDaten('asset').belastung>b1,b1),'Bruch belastet');
// 5 Zeit vergeht: 60 min, Erholung
await p.evaluate(()=>{const a=akteurDaten('asset');a.t=new Date(Date.now()-3600000).toISOString();a.ruheBis=new Date(Date.now()-1000).toISOString();});
// Erholung während Ruhe nicht rückwirkend simulierbar: Belastung direkt setzen
await p.evaluate(()=>{akteurDaten('asset').belastung=55});
await due('asset_ruhe_ende');
ok(await n()===n1+2,'Rückmeldung nach der Ruhe');console.log(await lastA());
ok(await p.evaluate(()=>!akteurDaten('asset').schweigt&&!akteurDaten('asset').ruheBis),'Sperre aufgehoben');
await send('Wie ist die Lage vor Ort?');await due('antwort');
ok(await n()===n1+3,'normale Antwort wieder da');
// 6 Notfall bricht Schweigen
await p.evaluate(()=>{akteurDaten('asset').belastung=92;akteurDaten('asset').schweigt=nowIso()});
await send('Notfall, ich werde verfolgt');await due('antwort');
ok(await n()===n1+4,'Notfall wird beantwortet');
// 7 Chat-Pause
await p.evaluate(()=>{akteurDaten('asset').belastung=88;akteurDaten('asset').schweigt=nowIso();akteurDaten('asset').ruheBis=null});
await send('Ich muss mich beruhigen und mache erstmal etwas anderes.');await due('antwort');
ok(await p.evaluate(()=>!!akteurDaten('asset').ruheBis),'Pause per Anfrage erkannt');
console.log(e.join()||'keine Fehler');await b.close()})();
