const {chromium}=require('playwright');
const ok=(c,m)=>console.log((c?'OK   ':'FAIL ')+m);
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1400,height:1000}})).newPage();const e=[];p.on('pageerror',x=>e.push(x.message));
await p.goto('file:///home/claude/index.html');await p.waitForTimeout(5200);await p.fill('#gate-pw','pw-test-123');await p.fill('#gate-pw2','pw-test-123');await p.click('#gate-go');
await p.waitForFunction(()=>!document.body.classList.contains('locked'),null,{timeout:20000});
await p.evaluate(()=>{dispatch({type:'STATUS_GESETZT',status:'Standby'});dispatch({type:'NAVIGATION',modul:'komm'});eingang('handler',{von:'gegenstelle',absender:'ARGUS',text:'Testnachricht eins.'});STATE.komm.aktiv='handler';render()});await p.waitForTimeout(600);

const btn=p.locator('button[id^="tx-N"], button[id^="tx-"]').first();
console.log('Buttons:',await p.locator('button[id^="tx-"]').count());
await btn.click();await p.waitForTimeout(200);
const ta=p.locator('textarea[aria-label="Neuer Wortlaut"]');ok(await ta.count()===1,'Editor offen');
console.log('body null?',/\bnull\b/.test(await p.evaluate(()=>document.body.innerText)));
await ta.fill('GEAENDERT TEST');await p.locator('button[id^="tx-ok-"]').click();await p.waitForTimeout(400);
ok(await p.evaluate(()=>document.body.innerText.includes('GEAENDERT TEST')),'Text sichtbar');
ok(await p.locator('textarea[aria-label="Neuer Wortlaut"]').count()===0,'Editor geschlossen');
ok(await p.evaluate(()=>Object.values(PROFIL.tausch).includes('GEAENDERT TEST')),'Profil.tausch');
await p.locator('button[id^="tx-"]').first().click();await p.waitForTimeout(200);
await p.getByRole('button',{name:'Original'}).click();await p.waitForTimeout(400);
ok(await p.evaluate(()=>!document.body.innerText.includes('GEAENDERT TEST')),'Original wiederhergestellt');
ok(await p.evaluate(()=>Object.keys(PROFIL.tausch).length===0),'tausch leer');
// Notizen-Autosave
await p.evaluate(()=>dispatch({type:'TEXT_GEAENDERT',feld:'notizen',wert:'abc'}));
ok(await p.evaluate(()=>STATE.agent.notizen==='abc'),'Notizen-Aktion wieder aktiv');
console.log(e.join()||'keine Fehler');await b.close()})();
