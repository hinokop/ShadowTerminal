const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1400,height:950}})).newPage();const e=[];p.on('pageerror',x=>e.push(x.message));
await p.goto(require('./_pfad.js').APP);await p.waitForTimeout(5200);await p.fill('#gate-pw','pw-test-123');await p.fill('#gate-pw2','pw-test-123');await p.click('#gate-go');
await p.waitForFunction(()=>!document.body.classList.contains('locked'),null,{timeout:20000});
await p.keyboard.press('3');await p.waitForTimeout(500);await p.screenshot({path:'de_doss.png'});
await p.keyboard.press('6');await p.waitForTimeout(400);
await p.evaluate(()=>{VIEW.karte.lat=51.9;VIEW.karte.lon=9.7;VIEW.karte.zoom=5.6;VIEW.karte.init=true;renderModule()});await p.waitForTimeout(500);
console.log('Marker',await p.evaluate(()=>document.querySelectorAll('.k-marker').length));
await p.screenshot({path:'de_karte.png'});console.log(e.join()||'keine Fehler');await b.close()})();
