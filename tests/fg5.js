const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1500,height:1000}})).newPage();const e=[];p.on('pageerror',x=>e.push(x.message));
await p.goto('file:///home/claude/index.html');await p.waitForTimeout(5200);await p.keyboard.press('Space');await p.fill('#gate-pw','pw-test-123');await p.fill('#gate-pw2','pw-test-123');await p.click('#gate-go');
await p.waitForFunction(()=>!document.body.classList.contains('locked'),null,{timeout:20000});
await p.evaluate(()=>{dispatch({type:'STATUS_GESETZT',status:'Standby'});dispatch({type:'MISSION_ZUGEWIESEN',id:'M1'});dispatch({type:'MISSION_ANGENOMMEN',id:'M1'});dispatch({type:'MISSION_BEGINN_JETZT'});dispatch({type:'NAVIGATION',modul:'freigabe'});});await p.waitForTimeout(500);
let fail=0;const chk=(ok,t)=>{if(!ok)fail++;console.log((ok?'OK  ':'FAIL')+' '+t)};
chk(await p.evaluate(()=>[...document.querySelectorAll('#fg-art option')].map(o=>o.textContent).includes('Eliminierung')),'Eliminierung wählbar');
const due=async()=>{await p.evaluate(()=>{STATE.plan.forEach(x=>{x.faelligAm=new Date(Date.now()-1000).toISOString()})});await p.waitForTimeout(2200)};
await p.evaluate(()=>{const o=[];nachrichtSenden(kanalDef('handler'),'Ich brauche die Freigabe zur Eliminierung von P-9054','Routine',o)});await due();
console.log(await p.evaluate(()=>STATE.komm.kanaele.handler.nachrichten.slice(-1)[0].text));
await p.evaluate(()=>{const o=[];nachrichtSenden(kanalDef('handler'),'Freigabe für Festsetzung bei P-9054','Routine',o)});await due();
console.log(await p.evaluate(()=>STATE.komm.kanaele.handler.nachrichten.slice(-1)[0].text));
// Regler
await p.evaluate(()=>{window.__r=1});
const hasFn=await p.evaluate(()=>typeof regieOeffnen==='function'||typeof renderRegie==='function');console.log('regie fn',hasFn);
await p.evaluate(()=>{dispatch({type:'BELASTUNG_REGIE',w:75})});
chk(await p.evaluate(()=>Math.round(belS().w)===75),'Belastung gesetzt');
await p.waitForTimeout(800);
console.log(await p.evaluate(()=>STATE.komm.kanaele.handler.nachrichten.slice(-1)[0].text));
// Eisvogel in Grossbuchstaben bei aktiver Kennwortpruefung
await p.evaluate(()=>{const o=[];nachrichtSenden(kanalDef('handler'),'EISVOGEL','Sofort',o);dispatch({type:'AUTH_EREIGNIS',liste:o.map(x=>Object.assign({t:nowIso()},x))})});
chk(await p.evaluate(()=>STATE.abschlussLauf===true),'EISVOGEL (Großbuchstaben, Kennwortprüfung an) erkannt');
console.log('Fehler:',e.join()||'keine','| Fehlschläge:',fail);await b.close()})();
