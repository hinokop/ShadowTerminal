const {chromium}=require('playwright');
const ok=(c,m)=>console.log((c?'OK   ':'FAIL ')+m);
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1400,height:1000}})).newPage();const e=[];p.on('pageerror',x=>e.push(x.message));
await p.goto('file:///home/claude/index.html');await p.waitForTimeout(5200);await p.fill('#gate-pw','pw-test-123');await p.fill('#gate-pw2','pw-test-123');await p.click('#gate-go');
await p.waitForFunction(()=>!document.body.classList.contains('locked'),null,{timeout:20000});
await p.evaluate(()=>{dispatch({type:'STATUS_GESETZT',status:'Standby'});dispatch({type:'MISSION_ZUGEWIESEN',id:'M1'});dispatch({type:'MISSION_ANGENOMMEN',id:'M1'});alleEntitaeten().forEach(e=>{IZ()[e.id]={status:'frei'}});dispatch({type:'NAVIGATION',modul:'mission'})});
await p.waitForTimeout(600);
for (const k of ['1','2','3','4','5','6','7']) { await p.keyboard.press(k); await p.waitForTimeout(300); }
ok(await p.evaluate(()=>document.body.innerText.includes('Transportlinie Ost')),'Mission sichtbar');
await p.keyboard.press('2');await p.waitForTimeout(300);await p.screenshot({path:'m1a.png',fullPage:true});
console.log(e.join()||'keine Fehler');await b.close()})();
