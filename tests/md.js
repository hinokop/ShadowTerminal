const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1400,height:1100}})).newPage();const e=[];p.on('pageerror',x=>e.push(x.message));
await p.goto(require('./_pfad.js').APP);await p.waitForTimeout(5200);await p.fill('#gate-pw','pw-test-123');await p.fill('#gate-pw2','pw-test-123');await p.click('#gate-go');
await p.waitForFunction(()=>!document.body.classList.contains('locked'),null,{timeout:20000});
await p.evaluate(()=>{dispatch({type:'KENNWORT_SCHALTER',an:false});dispatch({type:'STATUS_GESETZT',status:'Standby'});dispatch({type:'MISSION_ZUGEWIESEN',id:'M1'});dispatch({type:'MISSION_ANGENOMMEN',id:'M1'});alleEntitaeten().forEach(e=>{IZ()[e.id]={status:'frei'}});});
for(const q of ['Wie steht es um meine Freigaben?','Wie ist der Zustand meiner Ausrüstung?','Wie ist mein Zustand?','Welche Identität habe ich aktiv?','Welche Termine stehen an?','Wie viele Berichte habe ich?']){console.log(q,'->',await p.evaluate((q)=>{const r=antwortFuer('handler',q,'Routine','N-301');return r.kat+' :: '+r.text},q));}
console.log(e.join()||'keine Fehler');await b.close()})();
