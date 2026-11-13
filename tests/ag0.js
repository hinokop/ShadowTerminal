const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1400,height:1000}})).newPage();const e=[];p.on('pageerror',x=>e.push(x.message));
await p.goto('file:///home/claude/index.html');await p.waitForTimeout(5200);await p.fill('#gate-pw','pw-test-123');await p.fill('#gate-pw2','pw-test-123');await p.click('#gate-go');
await p.waitForFunction(()=>!document.body.classList.contains('locked'),null,{timeout:20000});
console.log(await p.evaluate(()=>{dispatch({type:'STATUS_GESETZT',status:'Standby'});dispatch({type:'MISSION_ANGENOMMEN',id:'M1'});alleEntitaeten().forEach(e=>{IZ()[e.id]={status:'frei'}});return JSON.stringify({st:MS('M1').status,v:STATE.vorlauf,k:STATE.kontext,mod:STATE.ui.modul})}));
await p.evaluate(()=>dispatch({type:'NAVIGATION',modul:'mission'}));await p.waitForTimeout(400);
console.log(await p.evaluate(()=>document.getElementById('main').innerText.slice(0,300)));console.log(e.join());await b.close()})();
