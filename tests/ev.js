const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1400,height:1100}})).newPage();const e=[];p.on('pageerror',x=>e.push(x.message));
await p.goto(require('./_pfad.js').APP);await p.waitForTimeout(5200);await p.fill('#gate-pw','pw-test-123');await p.fill('#gate-pw2','pw-test-123');await p.click('#gate-go');
await p.waitForFunction(()=>!document.body.classList.contains('locked'),null,{timeout:20000});
await p.evaluate(()=>{dispatch({type:'KENNWORT_SCHALTER',an:false});dispatch({type:'STATUS_GESETZT',status:'Standby'});dispatch({type:'MISSION_ZUGEWIESEN',id:'M1'});dispatch({type:'MISSION_ANGENOMMEN',id:'M1'});alleEntitaeten().forEach(e=>{IZ()[e.id]={status:'frei'}});akteurDaten('handler').druck=70;akteurDaten('handler').vertrauen=50;});
await p.evaluate(()=>{dispatch({type:'NACHRICHT_GESENDET',kanal:'handler',text:'P-0001 steht gerade am Hallenbad',dringlichkeit:'Routine',modus:'dossier'});dispatch({type:'VERSTAERKUNG_ANGEFORDERT',art:'beobachter',anzahl:1,ort:'L-0002',bezug:'L-0002',beginnH:6,dauerH:8,zweck:'Beobachtung der Tordurchfahrt am Abend, um den Fahrer zu identifizieren und die Abfahrtszeit zu belegen.',dringlichkeit:'Routine'});});
console.log(await p.evaluate(()=>JSON.stringify(STATE.plan.filter(x=>x.typ==='verlauf').map(x=>[x.kanal,x.text.slice(0,60)]))));
console.log(await p.evaluate(()=>JSON.stringify(STATE.ereignisse)));
console.log(e.join()||'keine Fehler');await b.close()})();
