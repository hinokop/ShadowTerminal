const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1500,height:1000}})).newPage();const e=[];p.on('pageerror',x=>e.push(x.message));
await p.addInitScript(()=>{window.__ARGUS_ERGEBNIS='direkt'});await p.goto(require('./_pfad.js').APP);await p.waitForTimeout(5200);await p.keyboard.press('Space');await p.fill('#gate-pw','pw-test-123');await p.fill('#gate-pw2','pw-test-123');await p.click('#gate-go');
await p.waitForFunction(()=>!document.body.classList.contains('locked'),null,{timeout:20000});
await p.evaluate(()=>{dispatch({type:'KENNWORT_SCHALTER',an:false});dispatch({type:'STATUS_GESETZT',status:'Standby'});dispatch({type:'MISSION_ZUGEWIESEN',id:'M1'});dispatch({type:'MISSION_ANGENOMMEN',id:'M1'});dispatch({type:'MISSION_BEGINN_JETZT'});});
let fail=0;const chk=(ok,t)=>{if(!ok)fail++;console.log((ok?'OK  ':'FAIL')+' '+t)};
const send=async(t,modus)=>{const n0=await p.evaluate(()=>STATE.komm.kanaele.handler.nachrichten.length);
 await p.evaluate(([t,m])=>{const k=kanalDef('handler');const out=[];nachrichtSenden(k,t,'Routine',out,m);STATE.log.push&&0;if(out.length)dispatch({type:'AUTH_EREIGNIS',liste:out.map(o=>Object.assign({t:nowIso()},o))});},[t,modus||null]).catch(async()=>{});
 for(let i=0;i<16;i++){await p.evaluate(()=>{STATE.plan.filter(x=>x.typ==='antwort').forEach(x=>{if(!x.infoFrei)x.faelligAm=new Date(Date.now()-1000).toISOString()});});await p.waitForTimeout(450);
  const n=await p.evaluate(()=>STATE.komm.kanaele.handler.nachrichten.filter(m=>m.von==='gegenstelle').slice(-1)[0].text);const c=await p.evaluate(()=>STATE.komm.kanaele.handler.nachrichten.length);if(c>=n0+2)return n}
 return await p.evaluate(()=>STATE.komm.kanaele.handler.nachrichten.slice(-1)[0].text)};
// Sichtung per Chat auf bekannte Person
let a=await send('Der Kutscher hat um 21 Uhr den Transporter am "Sonnenallee 14" beladen','sichtung');console.log('1:',a);
chk(/Vermerkt|Notiert|SI-|Sichtung/.test(a)&&!/P-0002/.test(a),'Sichtung per Chat zu bekannter Person');
chk(await p.evaluate(()=>(STATE.dossiers.entitaeten['P-0002'].sichtungen||[]).length)===1,'Sichtung gespeichert');
a=await send('Einschätzung zum Kutscher: B2');console.log('2:',a);
chk(/vermerkt/.test(a),'Einschätzung per Chat');
chk(await p.evaluate(()=>!!IZ()['P-0002'].einschaetzung),'Einschätzung im Zustand');
a=await send('Reiche die Unterlagen zum Kutscher ein');console.log('3:',a);
const pl=await p.evaluate(()=>STATE.plan.filter(x=>x.infoFrei).length);chk(pl===1,'Freigabe geplant');
await p.evaluate(()=>{STATE.plan.forEach(x=>{x.faelligAm=new Date(Date.now()-1000).toISOString()})});await p.waitForTimeout(1500);
chk(await p.evaluate(()=>wissen(entitaet('P-0002')))==='frei','frei nach Prüfung');
a=await send('Was weißt du über den Kutscher?');console.log('4:',a.slice(0,200));
chk(/P-0002/.test(a)||/Fahrer/.test(a),'Vollauskunft nach Freigabe');
// unbekannte Person: Sichtung abgewiesen
a=await send('Murat Aydın hat gerade das Lager verlassen','sichtung');console.log('5:',a);
chk(await p.evaluate(()=>(STATE.dossiers.entitaeten['P-9058'].sichtungen||[]).length)===0,'keine Sichtung zu Unbekanntem');
console.log('Fehler:',e.join()||'keine','| Fehlschläge:',fail);await b.close()})();
