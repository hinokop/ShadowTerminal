const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1400,height:800}})).newPage();
await p.goto('file:///home/claude/index.html');await p.waitForTimeout(1500);await p.screenshot({path:'sh0.png'});
await p.waitForTimeout(3700);await p.fill('#gate-pw','pw-test-123');await p.fill('#gate-pw2','pw-test-123');await p.click('#gate-go');
await p.waitForFunction(()=>!document.body.classList.contains('locked'),null,{timeout:20000});
await p.evaluate(()=>{dispatch({type:'STATUS_GESETZT',status:'Standby'});dispatch({type:'MISSION_ZUGEWIESEN',id:'M1'});dispatch({type:'MISSION_ANGENOMMEN',id:'M1'});alleEntitaeten().forEach(e=>{IZ()[e.id]={status:'frei'}});});
await p.waitForTimeout(500);await p.evaluate(()=>dispatch({type:'NAVIGATION',modul:'komm'}));await p.waitForTimeout(500);
console.log(await p.evaluate(()=>STATE.komm.kanaele.handler.nachrichten.map(m=>m.text).join('\n---\n')));
await p.screenshot({path:'sh1.png'});await b.close()})();
