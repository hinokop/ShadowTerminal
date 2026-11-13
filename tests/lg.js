const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1500,height:900}})).newPage();const e=[];p.on('pageerror',x=>e.push(x.message));
await p.goto('file:///home/claude/index.html');await p.waitForTimeout(4500);await p.keyboard.press('Space');await p.waitForTimeout(1800);
await p.screenshot({path:'/tmp/t/lg1.png'});
console.log(await p.evaluate(()=>{const i=document.querySelector('.gl-basis');return i.naturalWidth+'x'+i.naturalHeight}));console.log('Fehler:',e.join('|')||'keine');await b.close()})();
