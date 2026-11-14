const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1280,height:900}})).newPage();const e=[];p.on('pageerror',x=>e.push(x.message));
await p.goto(require('./_pfad.js').APP);await p.waitForTimeout(5200);await p.fill('#gate-pw','pw-test-123');await p.fill('#gate-pw2','pw-test-123');await p.click('#gate-go');
await p.waitForFunction(()=>!document.body.classList.contains('locked'),null,{timeout:20000});await p.keyboard.press('7');await p.waitForTimeout(400);
console.log(await p.evaluate(()=>({rd:document.querySelectorAll('.rd').length,t:document.body.innerText.includes('4.5 Hinweise')&&document.body.innerText.includes('Bergungsverfahren')})));
await p.screenshot({path:'hb.png'});console.log(e.join()||'keine Fehler');await b.close()})();
