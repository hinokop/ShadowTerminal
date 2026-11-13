const {chromium}=require('playwright');const ok=(c,m)=>console.log((c?'OK   ':'FAIL ')+m);
(async()=>{const b=await chromium.launch();const e=[];const p=await (await b.newContext({viewport:{width:1400,height:900}})).newPage();p.on('pageerror',x=>e.push(x.message));
await p.goto('file:///home/claude/index.html');await p.waitForTimeout(5200);await p.fill('#gate-pw','pw-test-123');await p.fill('#gate-pw2','pw-test-123');await p.click('#gate-go');
await p.waitForFunction(()=>!document.body.classList.contains('locked'),null,{timeout:20000});
const N=()=>p.evaluate(()=>STATE.komm.kanaele.handler.nachrichten.length);
await p.evaluate(()=>{dispatch({type:'KENNWORT_SCHALTER',ein:false});dispatch({type:'STATUS_GESETZT',status:'Standby'});dispatch({type:'MISSION_ZUGEWIESEN',id:'M1'});dispatch({type:'MISSION_ANGENOMMEN',id:'M1'});dispatch({type:'ZONE_ANGELEGT',ll:[52.4817,13.4352]});});
await p.evaluate(()=>{STATE.agent.bel=STATE.agent.bel||{};dispatch({type:'ATEMPAUSE'})});
const due=()=>p.evaluate(()=>{STATE.plan.forEach(x=>{x.faelligAm=new Date(Date.now()-1000).toISOString()});STATE.plan.slice().forEach(x=>{if(STATE.plan.includes(x))dispatch({type:'FAELLIG',id:x.id})})});
await due();const n1=await N();const txt=await p.evaluate(()=>{const m=STATE.komm.kanaele.handler.nachrichten;return m.slice(-1)[0].text});
ok(/Atempause/.test(txt),'Bestätigung der Atempause kommt');
await p.evaluate(()=>{dispatch({type:'ZONEN_EREIGNIS',id:'ZN-001'})});await due();await due();
ok((await N())===n1,'In der Stille kommt nichts vom Handler (Zonenmeldung, Skript)');
ok(await p.evaluate(()=>STATE.plan.some(x=>x.typ==='skript')),'Meldungen bleiben eingeplant');
await p.evaluate(()=>dispatch({type:'NACHRICHT_GESENDET',kanal:'handler',text:'Bin wieder da',dringlichkeit:'Routine'}));
ok(await p.evaluate(()=>!handlerStill()),'Eigene Nachricht beendet die Stille');
await due();ok((await N())>n1,'Danach kommen Meldungen wieder');
/* Dialogweg */
const p2=await (await b.newContext()).newPage();
console.log(e.join('|')||'keine Seitenfehler');await b.close()})();
