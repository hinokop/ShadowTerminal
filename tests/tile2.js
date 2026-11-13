const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1280,height:900}})).newPage();const e=[];p.on('pageerror',x=>e.push(x.message));
await p.goto('file:///home/claude/index.html');await p.waitForTimeout(5200);await p.fill('#gate-pw','pw-test-123');await p.fill('#gate-pw2','pw-test-123');await p.click('#gate-go');
await p.waitForFunction(()=>!document.body.classList.contains('locked'),null,{timeout:20000});await p.keyboard.press('6');await p.waitForTimeout(400);
await p.evaluate(()=>{document.querySelector('.k-eb-det').open=true});await p.check('#ke-kacheln');await p.evaluate(()=>{VIEW.karte.lat=51.92;VIEW.karte.lon=4.48;VIEW.karte.zoom=11;zeichneKarte($('k-svg'))});await p.waitForTimeout(2500);
await p.screenshot({path:'tile.png'});console.log(e.join()||'keine Fehler');await b.close()})();
