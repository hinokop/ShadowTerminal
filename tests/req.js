const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage();
p.on('requestfailed',r=>console.log('FAILED',r.url().slice(0,100),r.failure().errorText));
await p.goto(require('./_pfad.js').APP);await p.waitForTimeout(4800);
await p.fill('#gate-pw','geheim-pw-123');await p.fill('#gate-pw2','geheim-pw-123');await p.click('#gate-go');
await p.waitForFunction(()=>!document.body.classList.contains('locked'),null,{timeout:30000});
await p.click('#nav-dossier');await p.waitForTimeout(500);await b.close();})();
