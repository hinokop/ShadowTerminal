const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await (await b.newContext()).newPage();
await p.goto(require('./_pfad.js').APP);await p.waitForTimeout(5200);await p.fill('#gate-pw','pw-test-123');await p.fill('#gate-pw2','pw-test-123');await p.click('#gate-go');
await p.waitForFunction(()=>!document.body.classList.contains('locked'),null,{timeout:20000});
await p.evaluate(()=>{dispatch({type:'KENNWORT_SCHALTER',ein:false});dispatch({type:'STATUS_GESETZT',status:'Standby'});dispatch({type:'MISSION_ZUGEWIESEN',id:'M1'});dispatch({type:'MISSION_ANGENOMMEN',id:'M1'});alleEntitaeten().forEach(e=>{IZ()[e.id]={status:'frei'}});});
console.log(JSON.stringify(await p.evaluate(()=>pool().map(e=>[e.id,e.typ,e.name,(e.aliase||[]).join('/')]))));
console.log(JSON.stringify(await p.evaluate(()=>KM().ziele.map(z=>z.id))),JSON.stringify(await p.evaluate(()=>KM().standorte.map(z=>z.id+' '+z.name))));
await b.close()})();
