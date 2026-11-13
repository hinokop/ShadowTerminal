const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage();const e=[];p.on('pageerror',x=>e.push(x.message));
await p.goto('file:///home/claude/index.html');await p.waitForTimeout(3000);console.log(e.join('\n')||'keine Fehler');await b.close()})();
