const {chromium}=require('playwright');
const ok=(c,m)=>console.log((c?'OK   ':'FAIL ')+m);
(async()=>{const b=await chromium.launch();const e=[];let p;
const boot=async()=>{p=await (await b.newContext({viewport:{width:1400,height:1000}})).newPage();p.on('pageerror',x=>e.push(x.message));
await p.goto('file:///home/claude/index.html');await p.waitForTimeout(5200);await p.fill('#gate-pw','pw-test-123');await p.fill('#gate-pw2','pw-test-123');await p.click('#gate-go');
await p.waitForFunction(()=>!document.body.classList.contains('locked'),null,{timeout:20000});
await p.evaluate(()=>{dispatch({type:'KENNWORT_SCHALTER',ein:false});dispatch({type:'STATUS_GESETZT',status:'Standby'});dispatch({type:'MISSION_ZUGEWIESEN',id:'M1'});dispatch({type:'MISSION_ANGENOMMEN',id:'M1'});alleEntitaeten().forEach(e=>{IZ()[e.id]={status:'frei'}});});};
const due=(typ)=>p.evaluate((typ)=>{STATE.plan.filter(x=>x.typ===typ).forEach(x=>{x.faelligAm=new Date(Date.now()-1000).toISOString()});STATE.plan.slice().forEach(x=>{if(STATE.plan.includes(x)&&x.typ===typ)dispatch({type:'FAELLIG',id:x.id})})},typ);
const send=(t,k='handler')=>p.evaluate(([t,k])=>dispatch({type:'NACHRICHT_GESENDET',kanal:k,text:t,dringlichkeit:'Routine'}),[t,k]);
// AU-1 Speicher erholt sich nach vollem localStorage
await boot();
const r=await p.evaluate(()=>{try{for(let i=0;i<200;i++)localStorage.setItem('fuell'+i,'x'.repeat(100000))}catch(x){}try{for(let i=0;i<3000;i++)localStorage.setItem('f2'+i,'x'.repeat(1000))}catch(x){}
 dispatch({type:'NACHRICHT_GESENDET',kanal:'handler',text:'Erste Nachricht bei vollem Speicher',dringlichkeit:'Routine'});const voll=Store.isPersistent();
 Object.keys(localStorage).filter(k=>k.indexOf('fuell')===0||k.indexOf('f2')===0).forEach(k=>localStorage.removeItem(k));
 dispatch({type:'NACHRICHT_GESENDET',kanal:'handler',text:'Zweite Nachricht nach Freigabe',dringlichkeit:'Routine'});
 return {voll,frei:Store.isPersistent(),gesp:JSON.parse(localStorage.getItem('fieldterminal.v1')).komm.kanaele.handler.nachrichten.filter(m=>m.von==='agent').length}});
ok(r.voll===false,'AU-1 voller Speicher wird erkannt');
ok(r.frei===true&&r.gesp===2,'AU-1 Speichern erholt sich, sobald wieder Platz ist ('+JSON.stringify(r)+')');
// AU-2 Funkruhe: schnelle Erholung auch ohne Zwischenabfrage
const b2=await p.evaluate(()=>{const a=akteurDaten('asset');a.belastung=80;a.t=new Date(Date.now()-61*60000).toISOString();a.ruheBis=new Date(Date.now()-60000).toISOString();return akteurDaten('asset').belastung});
ok(b2<=61,'AU-2 60 Minuten Funkruhe senken um etwa 20 (Belastung '+b2+', erwartet etwa 60)');
const b3=await p.evaluate(()=>{const a=akteurDaten('asset');a.belastung=80;a.ruheBis=null;a.t=new Date(Date.now()-60*60000).toISOString();return akteurDaten('asset').belastung});
ok(b3===74,'AU-2 ohne Funkruhe unverändert 1 Punkt je 10 Minuten ('+b3+')');
const b4=await p.evaluate(()=>{const a=akteurDaten('asset');a.belastung=80;a.t=new Date(Date.now()-30*60000).toISOString();a.ruheBis=new Date(Date.now()+30*60000).toISOString();return akteurDaten('asset').belastung});
ok(b4===70,'AU-2 laufende Funkruhe: 30 Minuten senken um 10 ('+b4+')');
// AU-3 Wettlauf: Vorziehen angefragt, Check-in kommt vor der Ausführung
await boot();
await send('Bin schon vor Ort, wir können jetzt starten');await send('Check in "S-01" früher als geplant.');
await due('start_vorziehen');await due('frueh_checkin');
ok(await p.evaluate(()=>einsatzLaeuft()&&!!STATE.anreise&&STATE.anreise.risiko===50),'AU-3 Check-in geht nicht verloren (Risiko '+await p.evaluate(()=>STATE.anreise&&STATE.anreise.risiko)+')');
// AU-4 Frage löst keinen Check-in aus
await boot();
await send('Kann ich den Check-in früher machen?');
ok(await p.evaluate(()=>!STATE.plan.some(x=>x.typ==='frueh_checkin')),'AU-4 Frage nach frühem Check-in startet den Einsatz nicht');
await send('Wäre ein Check in vorab möglich?');
ok(await p.evaluate(()=>!STATE.plan.some(x=>x.typ==='frueh_checkin')),'AU-4 zweite Frageform');
await send('Check in "S-01" früher als geplant.');
ok(await p.evaluate(()=>STATE.plan.some(x=>x.typ==='frueh_checkin')),'AU-4 Befehl wirkt weiterhin');
// AU-5 harmlose Sätze sind keine Drohung, echte Drohungen bleiben erkannt
const kat=(k,t)=>p.evaluate(([k,t])=>{STATE.dialog={};STATE.thema={};const r=antwortFuer(k,t,'Routine','N-900');return r?r.kat:null},[k,t]);
for(const t of ['Ich mache mir Sorgen um dich','Ich bringe dir morgen die Unterlagen','Ich mache dir einen Vorschlag','Ich hole dich um acht ab','Ich bringe euch Kaffee mit','Ich schlage dir vor, wir warten noch','Ich bringe dich um acht nach Hause','Ich mache euch einen Plan fertig']){const k=await kat('asset',t);ok(k!=='dialog:drohung','AU-5 keine Drohung: '+t+' ('+k+')');}
for(const t of ['Ich mach dich fertig.','Wenn du mich verrätst, bring ich dich um.','Ich bringe dich um','Ich schlag dir die Zähne ein.','Ich werde dich kaputt machen.','Ich erledige dich.','Ich töte dich.','Ich mache dich kalt','Ich bring dich um, wenn du redest','Ich krieg dich noch']){const k=await kat('asset',t);ok(k==='dialog:drohung','AU-5 Drohung erkannt: '+t+' ('+k+')');}
console.log(e.join()||'keine Fehler');await b.close()})();
