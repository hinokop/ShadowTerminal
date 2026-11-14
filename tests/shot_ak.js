const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1400,height:1000}})).newPage();const e=[];p.on('pageerror',x=>e.push(x.message));
await p.goto(require('./_pfad.js').APP);await p.waitForTimeout(5200);await p.fill('#gate-pw','pw-test-123');await p.fill('#gate-pw2','pw-test-123');await p.click('#gate-go');
await p.waitForFunction(()=>!document.body.classList.contains('locked'),null,{timeout:20000});
await p.evaluate(()=>dispatch({type:'NAVIGATION',modul:'akten'}));await p.waitForTimeout(500);
await p.click('#ak-open-D-STD-01').catch(()=>{});await p.click('#ak-open-D-STD-01').catch(()=>{});await p.waitForTimeout(300);
await p.screenshot({path:'ak1.png',fullPage:true});console.log(e.join('|')||'ok');await b.close()})();
