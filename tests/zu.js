const {chromium}=require('playwright');
const ok=(c,m)=>console.log((c?'OK   ':'FAIL ')+m);
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1400,height:1200}})).newPage();const e=[];p.on('pageerror',x=>e.push(x.message));
await p.goto(require('./_pfad.js').APP);await p.waitForTimeout(5200);await p.fill('#gate-pw','pw-test-123');await p.fill('#gate-pw2','pw-test-123');await p.click('#gate-go');
await p.waitForFunction(()=>!document.body.classList.contains('locked'),null,{timeout:20000});
await p.evaluate(()=>{dispatch({type:'STATUS_GESETZT',status:'Standby'});dispatch({type:'MISSION_ZUGEWIESEN',id:'M1'});dispatch({type:'MISSION_ANGENOMMEN',id:'M1'});alleEntitaeten().forEach(e=>{IZ()[e.id]={status:'frei'}});});
await p.waitForTimeout(500);
const v=()=>p.evaluate(()=>JSON.stringify({h:akteurDaten('handler'),a:akteurDaten('asset')}));
let r=JSON.parse(await v());ok(r.h.vertrauen===60&&r.a.vertrauen===55,'Startwerte');
await p.evaluate(()=>dispatch({type:'LAGEBERICHT',text:'Treffen mit P-0001 an der Sonnenallee, kurzes Gespräch.'}));
r=JSON.parse(await v());ok(r.a.belastung===30,'Begegnung P-0001: Belastung 30 ('+r.a.belastung+')');
await p.evaluate(()=>dispatch({type:'VERSTAERKUNG_ANGEFORDERT',art:'beobachter',anzahl:1,ort:'L-9052',bezug:'',beginnH:8,dauerH:6,dringlichkeit:'Routine',zweck:'Am Kfz-Betrieb Sonnenallee wurde gestern abends ein Fahrzeug beladen; ich beobachte sechs Stunden, um die Anlieferungen und Gesichter zu belegen.'}));
r=JSON.parse(await v());ok(r.a.belastung===42&&r.a.vertrauen===50,'Verstärkung im Umfeld ('+r.a.belastung+'/'+r.a.vertrauen+')');
// Asset antwortet gemoddet
await p.evaluate(()=>{STATE.akteure.asset.belastung=90});
let t=await p.evaluate(()=>{const k=kanalDef('asset');const x=antwortFuer('asset','Wie ist die Lage vor Ort?','Routine','N-0101');return x&&x.text});
ok(/Kein Kontakt jetzt/.test(t),'Belastung>85 blockt: '+t);
t=await p.evaluate(()=>antwortFuer('asset','Hilfe, ich bin enttarnt!','Sofort','N-0102').text);
ok(!/Kein Kontakt jetzt/.test(t),'Notfall nicht geblockt');
await p.evaluate(()=>{STATE.akteure.asset.belastung=20;STATE.akteure.handler.vertrauen=20});
t=await p.evaluate(()=>antwortFuer('handler','Wie viele Ziele sind offen?','Routine','N-0103').text);
ok(/^Ich vermerke/.test(t),'ARGUS reserviert: '+t);
// Termin
await p.evaluate(()=>{STATE.akteure.handler.vertrauen=60;zustandTermin({termin:'M1'})});
r=JSON.parse(await v());ok(r.h.vertrauen===50&&r.h.druck===38,'Termin verstrichen');
// Anzeige
await p.evaluate(()=>dispatch({type:'NAVIGATION',modul:'dossier'}));await p.waitForTimeout(300);
await p.evaluate(()=>dispatch({type:'DOSSIER_GEOEFFNET',id:'P-0001'}));await p.waitForTimeout(400);
ok(await p.evaluate(()=>/haltungsvermerk kiebitz/i.test(document.body.innerText)),'Haltungsvermerk im Dossier');
await p.keyboard.press('4');await p.waitForTimeout(300);
ok(await p.locator('#haltung-handler').count()===1,'Haltung im Kanal');
await p.screenshot({path:'zu.png'});
// Persistenz
await p.reload();await p.waitForTimeout(500);
console.log(e.join()||'keine Fehler');await b.close()})();
