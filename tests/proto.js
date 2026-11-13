/* Regressionstest aus dem Erkennungsprotokoll 2026-11-11 plus Strukturfälle */
const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1400,height:1000}})).newPage();const e=[];p.on('pageerror',x=>e.push(x.message));
await p.addInitScript(()=>{window.__ARGUS_ERGEBNIS='direkt'});await p.goto('file:///home/claude/index.html');await p.waitForTimeout(5200);await p.fill('#gate-pw','pw-test-123');await p.fill('#gate-pw2','pw-test-123');await p.click('#gate-go');
await p.waitForFunction(()=>!document.body.classList.contains('locked'),null,{timeout:20000});
await p.evaluate(()=>{dispatch({type:'KENNWORT_SCHALTER',an:false});dispatch({type:'STATUS_GESETZT',status:'Standby'});dispatch({type:'MISSION_ZUGEWIESEN',id:'M1'});dispatch({type:'MISSION_ANGENOMMEN',id:'M1'});dispatch({type:'MISSION_BEGINN_JETZT'});alleEntitaeten().forEach(e=>{IZ()[e.id]={status:'frei'}});});
await p.evaluate(()=>{STATE.plan.filter(x=>x.typ==='verlauf'&&Date.parse(x.faelligAm)<Date.now()+120000).forEach(x=>{x.faelligAm=new Date(Date.now()-1000).toISOString()});});await p.waitForTimeout(4000);
let fail=0;
const send=async(k,t,re,was)=>{const n0=await p.evaluate((k)=>STATE.komm.kanaele[k].nachrichten.length,k);
 await p.evaluate(([k,t])=>dispatch({type:'NACHRICHT_GESENDET',kanal:k,text:t,dringlichkeit:'Routine'}),[k,t]);
 for(let i=0;i<14;i++){await p.evaluate(()=>{STATE.plan.filter(x=>x.typ==='antwort').forEach(x=>{x.faelligAm=new Date(Date.now()-1000).toISOString()});});await p.waitForTimeout(500);
  if(await p.evaluate(([k,n0])=>STATE.komm.kanaele[k].nachrichten.length>=n0+2,[k,n0]))break;}
 const a=await p.evaluate((k)=>{const n=STATE.komm.kanaele[k].nachrichten;return n[n.length-1].text},k);
 const ok=re.test(a);if(!ok)fail++;console.log((ok?'OK  ':'FAIL')+' '+k+' > '+t+'\n       < '+a.slice(0,150));return a};
await send('handler','Wie viel Zeit bleibt mir bis Transport?',/Verladung|Zeit|noch \d/);
await send('handler','Alias von P-0001',/KIEBITZ/);
await send('handler','Verstärkung für P-0001 muss sich beeilen.',/Verstärkung|Anforderung/);
await send('handler','KIEBITZ ist unzuverlässig.',/Einschätzung|Beleg|Urteil|Anlass/);
await send('handler','P-0002 ist gestern Abend mit dem Transporter weggefahren und kam nicht zurück.',/Dossier|notiert|Aufgenommen|relevant/i);
await send('asset','Bist du Einsatzbereit?',/Geht so|da|Ordnung|wachsam|Und du/);
await send('asset','Gibt es aktuelle informationen?',/Nichts|Abends|ruhig|schreibe/);
await send('support','Verstärkung erfoderlich?',/Ansprechpartner|Kräfte|Logistik/);
const v0=await p.evaluate(()=>akteurDaten('asset').vertrauen);
await send('asset','Wenn du mir nochmal so frech antwortest, eliminiere ich deinen erbärmlichen Arsch',/Droh|Zurück|verloren|Wie bitte|Trost|Was soll/i);
const v1=await p.evaluate(()=>akteurDaten('asset').vertrauen);console.log('asset-Vertrauen',v0,'->',v1);if(!(v1<v0)){fail++;console.log('FAIL Drohung ohne Wirkung')}
await send('handler','Du bist ein Idiot.',/Ton|Beleidig|sachlich/i);
// Rückfrage Sichtungsquelle
await p.evaluate(()=>{dispatch({type:'NACHRICHT_GESENDET',kanal:'handler',text:'Emre Kaya wurde bei Hallenbad gesehen',dringlichkeit:'Routine',modus:'sichtung'});});
await p.evaluate(()=>{STATE.plan.forEach(x=>{x.faelligAm=new Date(Date.now()-1000).toISOString()});});await p.waitForTimeout(1500);
console.log('Rückfrage gesetzt:',await p.evaluate(()=>!!STATE.quelleRueck));
await p.evaluate(()=>{if(STATE.quelleRueck)STATE.quelleRueck.ab=new Date(Date.now()-5000).toISOString();});
const a=await send('handler','selbst gesehen',/gesichert/);
console.log('Güte:',await p.evaluate(()=>JSON.stringify(STATE.dossiers.entitaeten['P-0001'].sichtungen.map(s=>[s.id,s.guete]))));
console.log(fail+' Fehlschläge');console.log(e.join()||'keine Fehler');await b.close()})();
