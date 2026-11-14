const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1400,height:1000}})).newPage();const e=[];p.on('pageerror',x=>e.push(x.message));
await p.goto(require('./_pfad.js').APP);await p.waitForTimeout(5200);await p.fill('#gate-pw','pw-test-123');await p.fill('#gate-pw2','pw-test-123');await p.click('#gate-go');
await p.waitForFunction(()=>!document.body.classList.contains('locked'),null,{timeout:20000});
const r=await p.evaluate(()=>['P-9101 "Sonnenallee 12" Sichtung, 2 Begleiter','P-9101 „Hafenstraße 4“ gesehen','P-9101 in Richtung Berlin','P-9101 Sonnenallee Sichtung','P-9101 Zahl "5" war da'].map(t=>t+' => ['+dossierOrt(t)+']'));
console.log(r.join('\n'));console.log(e.join()||'keine Fehler');await b.close()})();
