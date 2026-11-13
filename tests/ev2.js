const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1500,height:1000}})).newPage();const e=[];p.on('pageerror',x=>e.push(x.message));
await p.goto('file:///home/claude/index.html');await p.waitForTimeout(5200);await p.keyboard.press('Space');await p.fill('#gate-pw','pw-test-123');await p.fill('#gate-pw2','pw-test-123');await p.click('#gate-go');
await p.waitForFunction(()=>!document.body.classList.contains('locked'),null,{timeout:20000});
await p.evaluate(()=>{dispatch({type:'KENNWORT_SCHALTER',an:false});dispatch({type:'STATUS_GESETZT',status:'Standby'});dispatch({type:'MISSION_ZUGEWIESEN',id:'M1'});dispatch({type:'MISSION_ANGENOMMEN',id:'M1'});dispatch({type:'MISSION_BEGINN_JETZT'});});
let fail=0;const chk=(ok,t)=>{if(!ok)fail++;console.log((ok?'OK  ':'FAIL')+' '+t)};
// Ruhend im Einsatz gesperrt, Hinweis
await p.evaluate(()=>{dispatch({type:'NAVIGATION',modul:'profil'})});await p.waitForTimeout(300);
chk(await p.evaluate(()=>document.querySelector('#sel-status option[value="Ruhend"]').disabled&&!!$('ruhend-hinweis')),'Ruhend im Einsatz gesperrt, Hinweis sichtbar');
await p.evaluate(()=>{belS().w=75;dispatch({type:'BELASTUNG_PRUEFUNG'})});
console.log(await p.evaluate(()=>STATE.komm.kanaele.handler.nachrichten.slice(-1)[0].text));
chk(await p.evaluate(()=>!/Setze dazu den Status auf Ruhend/.test(STATE.komm.kanaele.handler.nachrichten.slice(-1)[0].text)),'Hinweis im Einsatz ohne Ruhend-Aufforderung');
// Eisvogel
await p.evaluate(()=>{const o=[];nachrichtSenden(kanalDef('handler'),'Eisvogel','Routine',o);dispatch({type:'AUTH_EREIGNIS',liste:o.map(x=>Object.assign({t:nowIso()},x))})});
chk(await p.evaluate(()=>STATE.abschlussLauf===true&&!STATE.komm.kanaele.handler.geschlossen),'Kanal bleibt offen bis nach der Übergabe');
chk(await p.evaluate(()=>STATE.agent.status!=='Ruhend'),'Status noch nicht Ruhend');
const pl=await p.evaluate(()=>STATE.plan.filter(x=>x.typ==='komm_schluss'||x.typ==='verlauf').map(x=>x.typ+':'+Math.round((Date.parse(x.faelligAm)-Date.now())/1000)+'s'));console.log(pl.join(' '));
// zeitlich geordnet abarbeiten
for(let i=0;i<40&&await p.evaluate(()=>STATE.abschlussLauf);i++){await p.evaluate(()=>{const n=STATE.plan.filter(x=>x.typ==='verlauf'||x.typ==='komm_schluss').sort((a,b)=>Date.parse(a.faelligAm)-Date.parse(b.faelligAm))[0];if(n)n.faelligAm=new Date(Date.now()-1000).toISOString()});await p.waitForTimeout(1300);}
const txt=await p.evaluate(()=>STATE.komm.kanaele.handler.nachrichten.map(m=>m.text));
chk(txt.some(t=>/Übergabe an SPERBER bestätigt/.test(t)),'Übergabe-Text im Kanal');
chk(await p.evaluate(()=>STATE.komm.kanaele.handler.nachrichten.some(m=>/Hier SPERBER/.test(m.text))),'Asset-Übergabetext');
chk(await p.evaluate(()=>['handler','support','asset'].every(i=>STATE.komm.kanaele[i].geschlossen)),'alle Kanäle geschlossen');
chk(await p.evaluate(()=>STATE.agent.status==='Ruhend'),'Status Ruhend');
chk(await p.evaluate(()=>{const h=STATE.komm.kanaele.handler.nachrichten,i=h.findIndex(m=>/Übergabe an SPERBER/.test(m.text)),j=h.findIndex(m=>m.text==='Verbindung geschlossen.');return i>=0&&j>i}),'Schließung nach der Übergabe');
// Nachricht blockiert
await p.evaluate(()=>{const o=[];nachrichtSenden(kanalDef('handler'),'Hallo?','Routine',o);dispatch({type:'AUTH_EREIGNIS',liste:o.map(x=>Object.assign({t:nowIso()},x))})});
chk(await p.evaluate(()=>STATE.komm.kanaele.handler.nachrichten.slice(-1)[0].blockiert===true),'Nachricht an geschlossenen Kanal blockiert');
// Wiederaufnahme
await p.evaluate(()=>dispatch({type:'STATUS_GESETZT',status:'Standby'}));
chk(await p.evaluate(()=>!STATE.komm.kanaele.handler.geschlossen&&!STATE.komm.kanaele.asset.geschlossen&&STATE.agent.status==='Standby'),'Wiederaufnahme öffnet Kanäle');
// Wissensstände
await p.evaluate(()=>{dispatch({type:'MISSION_ZUGEWIESEN',id:'M1'})});
console.log('Fehler:',e.join()||'keine','| Fehlschläge:',fail);await b.close()})();
