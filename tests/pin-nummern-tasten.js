/* Pin-Nummern, Taste X und entfernter Sperren-Knopf (produktiver Teil, aus nx.js ausgegliedert in Phase 5b7). */
const {chromium}=require('playwright');
const ok=(c,m)=>console.log((c?'OK   ':'FAIL ')+m);
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1400,height:1200}})).newPage();const e=[];p.on('pageerror',x=>e.push(x.message));
await p.goto(require('./_pfad.js').APP);await p.waitForTimeout(5200);await p.fill('#gate-pw','pw-test-123');await p.fill('#gate-pw2','pw-test-123');await p.click('#gate-go');
await p.waitForFunction(()=>!document.body.classList.contains('locked'),null,{timeout:20000});
// Pin-Nummer
await p.evaluate(()=>{dispatch({type:'PIN_ANGELEGT',ll:[52.48,13.43]});dispatch({type:'PIN_ANGELEGT',ll:[52.49,13.44]});});
const n1=await p.evaluate(()=>PROFIL.pins.map(x=>x.name).join(','));ok(n1==='Pin 1,Pin 2','Pins: '+n1);
await p.evaluate(()=>dispatch({type:'PIN_ENTFERNT',id:'PIN-001'}));
await p.evaluate(()=>dispatch({type:'PIN_ANGELEGT',ll:[52.5,13.45]}));
const n2=await p.evaluate(()=>PROFIL.pins.map(x=>x.name).sort().join(','));ok(n2==='Pin 1,Pin 2','Pin 1 wird wiederverwendet: '+n2);
// X-Hotkey
await p.evaluate(()=>{window.__b=0;Zugang.beenden=function(){window.__b++}});await p.keyboard.press('x');await p.waitForTimeout(200);
ok(await p.evaluate(()=>window.__b===1),'X beendet sofort ohne Bestätigung');
await p.keyboard.press('Escape');await p.waitForTimeout(200);
ok(!(await p.evaluate(()=>!!document.getElementById('btn-lock'))),'Sperren-Button entfernt');
ok(e.length===0,'keine Seitenfehler');
console.log(e.join('\n')||'keine Seitenfehler');await b.close()})();
