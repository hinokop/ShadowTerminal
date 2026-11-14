const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await (await b.newContext()).newPage();const e=[];p.on('pageerror',x=>e.push(x.message));
await p.goto(require('./_pfad.js').APP);await p.waitForTimeout(5200);await p.fill('#gate-pw','pw-test-123');await p.fill('#gate-pw2','pw-test-123');await p.click('#gate-go');
await p.waitForFunction(()=>!document.body.classList.contains('locked'),null,{timeout:20000});
await p.evaluate(()=>{dispatch({type:'KENNWORT_SCHALTER',ein:false});dispatch({type:'STATUS_GESETZT',status:'Standby'});dispatch({type:'MISSION_ZUGEWIESEN',id:'M1'});dispatch({type:'MISSION_ANGENOMMEN',id:'M1'});});
for(const [k,t,dr] of [['asset','Wie ist dein aktueller Stand?','Sofort'],['asset','Standort?','Sofort'],['asset','Wo befindest du dich derzeit','Routine'],['asset','Wo bist du?','Routine'],['asset','Wo bist du gerade?','Routine']]){
 const r=await p.evaluate(([k,t,dr])=>{const r=antwortFuer(k,t,dr,'N-9');return r?{kat:r.kat,text:r.text}:null},[k,t,dr]);console.log(t,'=>',JSON.stringify(r));}
console.log(e.join()||'keine Fehler');await b.close()})();
