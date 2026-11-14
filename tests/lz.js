const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await (await b.newContext()).newPage();const e=[];p.on('pageerror',x=>e.push(x.message));
await p.goto(require('./_pfad.js').APP);await p.waitForTimeout(1500);
console.log('Boot-Zeilen:',await p.evaluate(()=>document.getElementById('gate-boot-list').innerText.replace(/\n/g,' | ')));await p.waitForTimeout(4500);
await p.fill('#gate-pw','pw-test-123');await p.fill('#gate-pw2','pw-test-123');await p.click('#gate-go');
await p.waitForTimeout(600);console.log('Aufbau sichtbar:',await p.evaluate(()=>document.getElementById('gate-seq').hidden===false),await p.evaluate(()=>document.getElementById('gate-seq-list').innerText.replace(/\n/g,' ')),await p.textContent('#gate-detail'));
const t0=Date.now();await p.keyboard.press('Space');await p.waitForFunction(()=>!document.body.classList.contains('locked'),null,{timeout:20000});console.log('entsperrt nach',Date.now()-t0,'ms (nach Leertaste)');
console.log(e.join()||'keine Fehler');await b.close()})();
