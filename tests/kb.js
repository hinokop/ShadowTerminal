const {chromium}=require('playwright');
const ok=(c,m)=>console.log((c?'OK   ':'FAIL ')+m);
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1400,height:1000}})).newPage();const e=[];p.on('pageerror',x=>e.push(x.message));
await p.goto(require('./_pfad.js').APP);await p.waitForTimeout(5200);await p.fill('#gate-pw','pw-test-123');await p.fill('#gate-pw2','pw-test-123');await p.click('#gate-go');
await p.waitForFunction(()=>!document.body.classList.contains('locked'),null,{timeout:20000});
await p.evaluate(()=>{dispatch({type:'KENNWORT_SCHALTER',an:false});dispatch({type:'STATUS_GESETZT',status:'Standby'});dispatch({type:'MISSION_ZUGEWIESEN',id:'M1'});dispatch({type:'MISSION_ANGENOMMEN',id:'M1'});alleEntitaeten().forEach(e=>{IZ()[e.id]={status:'frei'}});});
console.log(await p.evaluate(()=>JSON.stringify(LM().haltung.asset.umfeld)));
for (const mode of ['vor','ohne']) {
  await p.evaluate(()=>dispatch({type:'RESET'}));
  await p.evaluate(()=>{dispatch({type:'STATUS_GESETZT',status:'Standby'});dispatch({type:'MISSION_ZUGEWIESEN',id:'M1'});dispatch({type:'MISSION_ANGENOMMEN',id:'M1'});alleEntitaeten().forEach(e=>{IZ()[e.id]={status:'frei'}});});
  const v0=await p.evaluate(()=>akteurDaten('asset').vertrauen);
  if(mode==='vor') {
    await p.evaluate(()=>dispatch({type:'NACHRICHT_GESENDET',kanal:'asset',text:'Ich schicke dir Unterstützung, keine Details.',dringlichkeit:'Routine'}));
    console.log('angek',await p.evaluate(()=>JSON.stringify(STATE.kiebitz)),await p.evaluate(()=>akteurDaten('asset').vertrauen));
  }
  const ort=await p.evaluate(()=>LM().haltung.asset.umfeld[0]);
  await p.evaluate((ort)=>dispatch({type:'VERSTAERKUNG_ANGEFORDERT',art:'beobachter',anzahl:1,ort:ort,bezug:'',beginnH:1,dauerH:8,zweck:'Beobachtung der Tordurchfahrt am Abend, um den Fahrer zu identifizieren und die Abfahrtszeit zu belegen.',dringlichkeit:'Routine'}),ort);
  const r=await p.evaluate(()=>[akteurDaten('asset').vertrauen,akteurDaten('asset').belastung,VK().slice(-1)[0].urteil,STATE.plan.filter(x=>x.kanal==='asset').map(x=>x.text.slice(0,40))]);
  console.log(mode,v0,JSON.stringify(r));
}
console.log(e.join()||'keine Fehler');await b.close()})();
