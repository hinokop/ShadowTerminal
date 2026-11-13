const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await (await b.newContext()).newPage();p.on('pageerror',x=>console.log('ERR',x.message));
await p.goto('file:///home/claude/index.html');await p.waitForTimeout(5200);await p.fill('#gate-pw','pw-test-123');await p.fill('#gate-pw2','pw-test-123');await p.click('#gate-go');
await p.waitForFunction(()=>!document.body.classList.contains('locked'),null,{timeout:20000});
await p.evaluate(()=>{dispatch({type:'KENNWORT_SCHALTER',an:false});dispatch({type:'STATUS_GESETZT',status:'Standby'});dispatch({type:'MISSION_ZUGEWIESEN',id:'M1'});dispatch({type:'MISSION_ANGENOMMEN',id:'M1'});});
console.log(await p.evaluate(()=>{const t='P-0002 ist gestern Abend mit dem Transporter weggefahren und kam nicht zurück.';const r=antwortFuer('handler',t,'Routine','N-9');return JSON.stringify([r&&r.kat,r&&r.text.slice(0,80),anfrageArt(t),typeof DIALOG, kanalDef('handler')&&1])}));
await b.close()})();
