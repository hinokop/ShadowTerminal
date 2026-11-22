const {chromium}=require('playwright');const ok=(c,m)=>console.log((c?'OK   ':'FAIL ')+m);
(async()=>{const b=await chromium.launch();const e=[];const p=await (await b.newContext({viewport:{width:1400,height:900}})).newPage();p.on('pageerror',x=>e.push(x.message));
await p.goto(require('./_pfad.js').APP);await p.waitForTimeout(5200);await p.fill('#gate-pw','pw-test-123');await p.fill('#gate-pw2','pw-test-123');await p.click('#gate-go');
await p.waitForFunction(()=>!document.body.classList.contains('locked'),null,{timeout:20000});
/* Phase 5b8: Die historische Aktion STANDORTFREIGABE_GESETZT ist entfernt; geprüft bleibt die Kopfzeile. */
ok((await p.locator('#h-standort, #h-standort-btn').count())===0,'Keine Standortfreigabe in der Kopfzeile');
ok(e.length===0,'keine Seitenfehler');
console.log(e.join('|')||'keine Seitenfehler');await b.close()})();
