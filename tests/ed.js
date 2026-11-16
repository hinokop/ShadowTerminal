const {chromium}=require('playwright');
const ok=(c,m)=>console.log((c?'OK   ':'FAIL ')+m);
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1400,height:1000}})).newPage();const e=[];p.on('pageerror',x=>e.push(x.message));
await p.goto(require('./_pfad.js').APP);await p.waitForTimeout(5200);await p.fill('#gate-pw','pw-test-123');await p.fill('#gate-pw2','pw-test-123');await p.click('#gate-go');
await p.waitForFunction(()=>!document.body.classList.contains('locked'),null,{timeout:20000});
await p.evaluate(()=>{dispatch({type:'STATUS_GESETZT',status:'Standby'});dispatch({type:'MISSION_ZUGEWIESEN',id:'M1'});dispatch({type:'MISSION_ANGENOMMEN',id:'M1'});alleEntitaeten().forEach(e=>{IZ()[e.id]={status:'frei'}});dispatch({type:'DOSSIER_GEOEFFNET',id:'P-0015',navigieren:true})});
await p.waitForTimeout(400);
await p.click('#btn-dbearb');await p.waitForTimeout(300);
await p.fill('#bd-name','Rolf Neumann-Berger');await p.selectOption('#bd-stufe','4');
await p.keyboard.press('Tab');
const okb=await p.$('dialog button.primary, dialog .acts button:last-child, .modal button.primary');
console.log(await p.evaluate(()=>[...document.querySelectorAll('dialog button')].map(b=>b.textContent+':'+b.disabled)));
await p.evaluate(()=>{[...document.querySelectorAll('dialog button')].find(b=>/Änderungen speichern/.test(b.textContent)).click()});await p.waitForTimeout(400);
console.log(await p.evaluate(()=>JSON.stringify({n:entitaet('P-0015').name,st:entitaet('P-0015').bedrohung.stufe,pf:Object.keys(PROFIL.aenderungen),txt:document.body.innerText.includes('Rolf Neumann-Berger'),log:STATE.log.slice(-1)[0].detail,orig:entitaet('P-0015')._orig.name})));
ok(await p.evaluate(()=>document.body.innerText.includes('bearbeitet')),'Label bearbeitet');
// Persistenz: neu laden
await p.evaluate(()=>profilSpeichern());
console.log(await p.evaluate(()=>JSON.parse(localStorage.getItem(PROFIL_KEY)).aenderungen['P-0015'].name));
await p.click('#btn-dorig');await p.waitForTimeout(300);
ok(await p.evaluate(()=>entitaet('P-0015').name==='Ralf Neumann'&&!PROFIL.aenderungen['P-0015']),'Zurücksetzen');
// eigenes Dossier
await p.evaluate(()=>{dispatch({type:'DOSSIER_ANGELEGT',typ:'Person',name:'Eigen A',land:'DE',stufe:2});dispatch({type:'DOSSIER_BEARBEITET',id:'P-0018',name:'Eigen B',stufe:3,rolle:'x',eckdaten:'a\nb',aliase:'q',land:'PL'});});
console.log(await p.evaluate(()=>JSON.stringify(entitaet('P-0018'))));
console.log(e.join()||'keine Fehler');await b.close()})();
