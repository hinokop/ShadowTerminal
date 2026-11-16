const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1500,height:1000}})).newPage();const e=[];p.on('pageerror',x=>e.push(x.message));
await p.goto(require('./_pfad.js').APP);await p.waitForTimeout(5200);await p.keyboard.press('Space');await p.fill('#gate-pw','pw-test-123');await p.fill('#gate-pw2','pw-test-123');await p.click('#gate-go');
await p.waitForFunction(()=>!document.body.classList.contains('locked'),null,{timeout:20000});
await p.evaluate(()=>{dispatch({type:'KENNWORT_SCHALTER',an:false});dispatch({type:'STATUS_GESETZT',status:'Standby'});dispatch({type:'MISSION_ZUGEWIESEN',id:'M1'});dispatch({type:'MISSION_ANGENOMMEN',id:'M1'});dispatch({type:'MISSION_BEGINN_JETZT'});});
const send=async(t)=>{await p.evaluate((t)=>{const o=[];nachrichtSenden(kanalDef('handler'),t,'Routine',o);dispatch({type:'AUTH_EREIGNIS',liste:o.map(x=>Object.assign({t:nowIso()},x))})},t);for(let i=0;i<6;i++){await p.evaluate(()=>{STATE.plan.filter(x=>x.typ==='antwort').forEach(x=>x.faelligAm=new Date(Date.now()-1000).toISOString())});await p.waitForTimeout(500)}return p.evaluate(()=>STATE.komm.kanaele.handler.nachrichten.filter(m=>m.von==='gegenstelle').slice(-1)[0].text)};
console.log(await send('Ich beantrage die Freigabe zur Eliminierung von P-0015'));
console.log(await send('Weil Anlass: Sichtung zeigt ihn beim Beladen, Beleg Foto und Bericht, Nutzen: Lieferkette unterbrechen und Auftrag sichern.'));
console.log(await send('Ich beantrage die Freigabe zur Festsetzung von P-0015 weil Anlass: Sichtung zeigt ihn beim Beladen, Beleg Foto und Bericht, Nutzen: Lieferkette unterbrechen und Auftrag sichern.'));
// Regie
await p.evaluate(()=>oeffneRegie());await p.waitForTimeout(300);
await p.evaluate(()=>{dispatch({type:'BELASTUNG_REGIE',w:60})});await p.evaluate(()=>oeffneRegie());
console.log(await p.evaluate(()=>[!!$('rg-bel-m25'),!!$('rg-bel-m10'),!!$('rg-bel-w')]));
await p.evaluate(()=>$('rg-bel-m25')&&$('rg-bel-m25').click());console.log(await p.evaluate(()=>Math.round(belS().w)));
console.log('Fehler:',e.join()||'keine');await b.close()})();
