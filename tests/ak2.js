const {chromium}=require('playwright');const ok=(c,m)=>console.log((c?'OK   ':'FAIL ')+m);
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1400,height:1000}})).newPage();const e=[];p.on('pageerror',x=>e.push(x.message));
await p.goto(require('./_pfad.js').APP);await p.waitForTimeout(5200);await p.fill('#gate-pw','pw-test-123');await p.fill('#gate-pw2','pw-test-123');await p.click('#gate-go');
await p.waitForFunction(()=>!document.body.classList.contains('locked'),null,{timeout:20000});
/* Die historisch registraturgebundenen Einsichts-/Schwärzungstests laufen
   ausdrücklich auf einem isolierten Legacy-Renderer, niemals in der produktiven
   Ablage-Navigation. */
await p.evaluate(()=>{RENDER.akten=renderRegistraturLegacy;dispatch({type:'NAVIGATION',modul:'akten'});});await p.waitForTimeout(400);
await p.click('#ak-open-D-STD-01');await p.waitForTimeout(300);
ok(/1 Einsicht/.test(await p.textContent('#ak-lese')),'Leseprotokoll zählt: '+await p.textContent('#ak-lese'));
await p.click('#ak-open-D-STD-01');await p.waitForTimeout(300);
ok(/2 Einsichten/.test(await p.textContent('#ak-lese')),'zweite Einsicht');
ok(await p.evaluate(()=>document.querySelectorAll('#akte-blatt .rd').length===0),'Handbuch ohne Schwärzungen');
ok(!(await p.evaluate(()=>!!document.getElementById('btn-lock'))),'kein Sperren-Button');
console.log(e.length?'FEHLER '+e.join('|'):'keine Seitenfehler');await b.close()})();
