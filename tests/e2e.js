const {chromium}=require('playwright');
const ok=(c,m)=>console.log((c?'OK   ':'FAIL ')+m);
(async()=>{
 const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1280,height:800}});
 const p=await ctx.newPage();const errs=[];
 p.on('pageerror',e=>errs.push('PAGE '+e.message));p.on('console',m=>{if(m.type()==='error')errs.push('CON '+m.text())});
 await p.addInitScript(()=>{window.__close=0;window.close=()=>{window.__close++}});
 await p.goto('file:///home/claude/index.html');await p.waitForTimeout(700);
 ok(await p.isVisible('#gate-boot'),'Boot sichtbar'); ok(!(await p.isVisible('#gate-box')),'Zugangsfeld während Boot verborgen');
 await p.screenshot({path:'boot.png'});
 ok((await p.textContent('#tb-st'))==='getrennt' && (await p.textContent('#tb-n'))==='0','Relais 0/3 getrennt');
 const title0=await p.title(); const host0=await p.textContent('#tb-host');
 ok(title0===host0.slice(0,16)+'….onion','Titel aus Adresse: '+title0);
 await p.waitForTimeout(4500);
 ok(await p.isVisible('#gate-box'),'Boot endet selbständig, Zugangsfeld da');
 ok(await p.evaluate(()=>document.activeElement.id)==='gate-pw','Fokus im Kennungsfeld');
 await p.fill('#gate-pw','geheim-pw-123');await p.fill('#gate-pw2','geheim-pw-123');await p.click('#gate-go');
 const verlauf=new Set();
 for(let i=0;i<60;i++){await p.waitForTimeout(250);verlauf.add(await p.textContent('#tb-n'));if(!(await p.evaluate(()=>document.body.classList.contains('locked'))))break;}
 ok(!(await p.evaluate(()=>document.body.classList.contains('locked'))),'freigegeben');
 console.log('Relais-Verlauf:',[...verlauf].join(','));
 ok((await p.textContent('#tb-st'))==='verbunden'&&(await p.textContent('#tb-n'))==='3','Relais 3/3 verbunden');
 ok((await p.textContent('#tb-path'))==='/profil','Pfad /profil: '+await p.textContent('#tb-path'));
 await p.click('#nav-mission');await p.waitForTimeout(60);
 const op=await p.evaluate(()=>getComputedStyle(document.getElementById('tb-load')).opacity);
 ok(await p.textContent('#tb-path')==='/briefing/m1','Pfad Briefing: '+await p.textContent('#tb-path')+' (Streifen-Deckkraft '+op+')');
 await p.click('#nav-komm');ok((await p.textContent('#tb-path'))==='/kanal/handler','Pfad Kanal: '+await p.textContent('#tb-path'));
 await p.click('#nav-dossier');await p.waitForTimeout(100);console.log('Pfad Dossier:',await p.textContent('#tb-path'));
 const hostA=await p.textContent('#tb-host');
 // Panel
 await p.click('#tb-shield');await p.waitForTimeout(200);ok(await p.isVisible('#tb-panel'),'Verbindungsinfo offen');
 await p.screenshot({path:'panel.png'});
 await p.keyboard.press('Escape');ok(!(await p.isVisible('#tb-panel')),'Escape schließt Panel');
 // Persistenz
 await p.reload();await p.waitForTimeout(500);
 ok((await p.textContent('#tb-host'))===hostA,'Adresse nach Neuladen unverändert');
 await p.keyboard.press('x');await p.waitForTimeout(200);
 await p.fill('#gate-pw','geheim-pw-123');await p.click('#gate-go');
 await p.waitForFunction(()=>!document.body.classList.contains('locked'),null,{timeout:20000});
 // Missionswechsel simuliert
 const w=await p.evaluate(()=>{const k=STATE.kontext;STATE.kontext='M2';renderHeader();const h2=document.getElementById('tb-host').textContent;const t2=document.title;STATE.kontext=k;renderHeader();return {h2,t2,h1:document.getElementById('tb-host').textContent}});
 ok(w.h2!==hostA&&w.h1===hostA&&/^[a-z2-7]{55}d\.onion$/.test(w.h2),'M2 eigene Adresse, M1 bleibt: '+w.h2.slice(0,12)+'… / '+w.h1.slice(0,12)+'…');
 await p.waitForTimeout(2200);
 // Sperren per L und kurze Wiederanmeldung
 await p.keyboard.press('l');ok(await p.evaluate(()=>document.body.classList.contains('locked')),'L sperrt');ok((await p.textContent('#tb-n'))==='0','Relais 0/3 nach Sperre');
 await p.fill('#gate-pw','geheim-pw-123');const t0=Date.now();await p.click('#gate-go');
 await p.waitForFunction(()=>!document.body.classList.contains('locked'),null,{timeout:20000});console.log('Wiederanmeldung dauerte',Date.now()-t0,'ms');
 // Beenden
 const dtg1=await p.textContent('#h-dtg');
 await p.click('#btn-end');await p.waitForTimeout(150);ok(await p.evaluate(()=>document.getElementById('dlg').open),'Bestätigung offen');
 await p.click('#dlg-ok');await p.waitForTimeout(800);await p.screenshot({path:'ende1.png'});
 await p.waitForSelector('#gate-end-fertig:not([hidden])',{timeout:10000});
 ok((await p.evaluate(()=>window.__close))>=1,'window.close versucht');ok(await p.isVisible('#gate-reconnect'),'Rückfallbildschirm mit Neu verbinden');
 await p.screenshot({path:'ende2.png'});
 const h1=await p.textContent('#h-dtg');await p.waitForTimeout(2200);const h2=await p.textContent('#h-dtg');ok(h1===h2,'Uhr/Tick nach Beenden angehalten');
 const log=await p.evaluate(()=>STATE.log.filter(e=>/Sitzung|Zugang|Sperre|Authent/.test(e.aktion)).map(e=>e.aktion));console.log(log.join(' | '));
 await p.click('#gate-reconnect');await p.waitForTimeout(600);ok(await p.isVisible('#gate-boot'),'Neu verbinden: Boot beginnt von vorn');
 console.log('Fehler:',errs);await b.close();
})();
