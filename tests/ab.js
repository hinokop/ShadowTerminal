const {chromium}=require('playwright');
const ok=(c,m)=>console.log((c?'OK   ':'FAIL ')+m);
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1400,height:1300}})).newPage();const e=[];p.on('pageerror',x=>e.push(x.message));
await p.goto('file:///home/claude/index.html');await p.waitForTimeout(5200);await p.fill('#gate-pw','pw-test-123');await p.fill('#gate-pw2','pw-test-123');await p.click('#gate-go');
await p.waitForFunction(()=>!document.body.classList.contains('locked'),null,{timeout:20000});
const due=()=>p.evaluate(()=>{STATE.plan.slice().forEach(x=>{x.faelligAm=new Date(Date.now()-1000).toISOString()});STATE.plan.slice().forEach(x=>{if(STATE.plan.includes(x))dispatch({type:'FAELLIG',id:x.id})})});
const send=(t,k='handler')=>p.evaluate(([t,k])=>dispatch({type:'NACHRICHT_GESENDET',kanal:k,text:t,dringlichkeit:'Routine'}),[t,k]);
const last=()=>p.evaluate(()=>{const n=STATE.komm.kanaele.handler.nachrichten;return n[n.length-1].text});
await p.evaluate(()=>{dispatch({type:'KENNWORT_SCHALTER',ein:false});dispatch({type:'STATUS_GESETZT',status:'Standby'});dispatch({type:'MISSION_ZUGEWIESEN',id:'M1'});dispatch({type:'MISSION_ANGENOMMEN',id:'M1'});alleEntitaeten().forEach(e=>{IZ()[e.id]={status:'frei'}});});
ok(await p.evaluate(()=>!einsatzLaeuft()),'Einsatz noch nicht gestartet');
const t0=await p.evaluate(()=>Math.round((einsatzBeginn(LM())-Date.now())/3600000));console.log('Start in h:',t0);
// Nachricht-Weg
await send('Bin schon vor Ort, wir können jetzt starten');
ok(await p.evaluate(()=>STATE.plan.some(x=>x.typ==='start_vorziehen')),'Start-Wunsch erkannt');
await due();ok(await p.evaluate(()=>einsatzLaeuft()),'Einsatz läuft nach Bestätigung');
ok(await p.evaluate(()=>STATE.plan.some(x=>x.typ==='anreise_pruefung')||STATE.anreise&&STATE.anreise.ohnePlan),'Reiseplan entfällt');
await due();
ok(await p.evaluate(()=>STATE.anreise&&STATE.anreise.ohnePlan&&STATE.agent.checkin.standortId),'Agent als vor Ort gesetzt');
console.log(await last());
ok(await p.evaluate(()=>meldeAktiv()),'Meldewesen aktiv');
// Abbruchwort
await send('eisvogel');
ok(await p.evaluate(()=>MS('M1').status==='abgebrochen'&&STATE.kw.gesperrt),'Abbruchwort: Abbruch, Kanal gesperrt');
ok(await p.evaluate(()=>STATE.plan.some(x=>x.art==='Aktenvermerk')),'Abbruchbestätigung folgt');
await send('hallo?');ok(await p.evaluate(()=>{const n=STATE.komm.kanaele.handler.nachrichten;return n[n.length-1].blockiert===true}),'Kanal geschlossen');
// Dev-Konsole
await p.evaluate(()=>{dispatch({type:'STATUS_GESETZT',status:'Aktiv'})});await due();await due();
await p.evaluate(()=>{if(STATE.serie.folge)STATE.serie.folge.faelligAm=new Date(Date.now()-1000).toISOString()});await p.waitForTimeout(2300);
await p.evaluate(()=>dispatch({type:'MISSION_ANGENOMMEN',id:'M1'}));
ok(await p.evaluate(()=>!einsatzLaeuft()),'neuer Durchgang: Start wieder in der Zukunft');
console.log(await p.evaluate(()=>Dev.startJetzt()));
ok(await p.evaluate(()=>einsatzLaeuft()),'Dev.startJetzt()');
// Abbruchwort ohne Mission
await p.evaluate(()=>dispatch({type:'MISSION_ABGEBROCHEN',begruendung:'Test Abbruch wegen Lage'}));
console.log(e.join()||'keine Fehler');await b.close()})();
