const {chromium}=require('playwright');
const ok=(c,m)=>console.log((c?'OK   ':'FAIL ')+m);
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1400,height:1000}})).newPage();const e=[];p.on('pageerror',x=>e.push(x.message));
await p.goto('file:///home/claude/index.html');await p.waitForTimeout(5200);await p.fill('#gate-pw','pw-test-123');await p.fill('#gate-pw2','pw-test-123');await p.click('#gate-go');
await p.waitForFunction(()=>!document.body.classList.contains('locked'),null,{timeout:20000});
await p.evaluate(()=>{dispatch({type:'STATUS_GESETZT',status:'Standby'});dispatch({type:'MISSION_ZUGEWIESEN',id:'M1'});dispatch({type:'MISSION_ANGENOMMEN',id:'M1'});alleEntitaeten().forEach(e=>{IZ()[e.id]={status:'frei'}});});
await p.keyboard.press('8');await p.waitForTimeout(400);
ok(await p.isVisible('#btn-vk'),'Modul 8 sichtbar');
// kurze Begründung
await p.fill('#vk-zweck','zu kurz');await p.click('#btn-vk');await p.waitForTimeout(300);
console.log(await p.evaluate(()=>JSON.stringify(VK().map(v=>[v.id,v.urteil,v.grund.slice(0,50)]))));
await p.fill('#vk-zweck','Beobachtung der Tordurchfahrt am Abend, um den Fahrer zu identifizieren und die Abfahrtszeit zu belegen.');
await p.selectOption('#vk-beginn','1');await p.click('#btn-vk');await p.waitForTimeout(300);
console.log(await p.evaluate(()=>JSON.stringify(VK().slice(-1).map(v=>[v.id,v.urteil,v.auflage,v.rufzeichen,v.beginnH]))));
// zugriff gesperrt
await p.selectOption('#vk-art','zugriff');await p.fill('#vk-zweck','Zugriff auf die Ladung am Zwischenlager vorbereiten, damit die Kette früh gestoppt wird.');await p.click('#btn-vk');await p.waitForTimeout(300);
console.log(await p.evaluate(()=>JSON.stringify(VK().slice(-1).map(v=>[v.id,v.urteil,v.grund.slice(0,60)]))));
// Kräfte-Limit: 2 Observationsteams (4 Kräfte) + 1 Fahrer
await p.selectOption('#vk-art','beobachter');await p.selectOption('#vk-anz','2');await p.selectOption('#vk-beginn','6');await p.fill('#vk-zweck','Zweites Team zur Beobachtung der Strecke bei Ludwigsfelde, um das Umladen zu belegen.');await p.click('#btn-vk');await p.waitForTimeout(300);
console.log(await p.evaluate(()=>JSON.stringify(VK().slice(-1).map(v=>[v.id,v.urteil,v.grund.slice(0,90)]))));
await p.evaluate(()=>{const v=VK().find(x=>x.urteil!=='abgelehnt');v.entscheidung=new Date(Date.now()-1000).toISOString();render();});await p.waitForTimeout(300);
console.log(await p.evaluate(()=>[...document.querySelectorAll('[data-vk]')].map(c=>c.textContent).join('|')));
await p.click('[id^=vk-z-]');await p.waitForTimeout(200);
console.log(await p.evaluate(()=>[...document.querySelectorAll('dialog button')].map(b=>b.textContent).join('|')));
await p.evaluate(()=>{[...document.querySelectorAll('dialog button')].find(b=>/Zurückziehen/.test(b.textContent)).click()});await p.waitForTimeout(300);
console.log(await p.evaluate(()=>JSON.stringify(VK().map(v=>[v.id,vkStatus(v)]))));
await p.screenshot({path:'vk.png',fullPage:true});
for (const k of ['1','2','3','4','5','6','7','8']) { await p.keyboard.press(k); await p.waitForTimeout(200); }
console.log(e.join()||'keine Fehler');await b.close()})();
