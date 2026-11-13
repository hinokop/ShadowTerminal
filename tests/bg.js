const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1400,height:1100}})).newPage();const e=[];p.on('pageerror',x=>e.push(x.message));
await p.goto('file:///home/claude/index.html');await p.waitForTimeout(5200);await p.fill('#gate-pw','pw-test-123');await p.fill('#gate-pw2','pw-test-123');await p.click('#gate-go');
await p.waitForFunction(()=>!document.body.classList.contains('locked'),null,{timeout:20000});
await p.evaluate(()=>{dispatch({type:'KENNWORT_SCHALTER',an:false});dispatch({type:'STATUS_GESETZT',status:'Standby'});dispatch({type:'MISSION_ZUGEWIESEN',id:'M1'});dispatch({type:'MISSION_ANGENOMMEN',id:'M1'});alleEntitaeten().forEach(e=>{IZ()[e.id]={status:'frei'}});});
const T=[['Ich mache mir Sorgen um P-0001, bitte 1 Team entsenden.','P-0001'],['Beobachtung der Tordurchfahrt am Abend, um den Fahrer zu identifizieren und die Abfahrtszeit zu belegen.','L-9052'],['Das Fahrzeug von P-0002 wurde gestern am Kfz-Betrieb gesehen, ich habe ein Foto, damit lässt sich die Abfahrt belegen.','L-9052'],['Wir brauchen mehr Leute dort bitte dringend.','L-9052']];
for(const [t,o] of T){console.log(t.slice(0,60),'->',await p.evaluate(([t,o])=>{const d=LM();const r=vkBewerten(d,{art:'beobachter',anzahl:1,ort:o,bezug:o,beginnH:6,dauerH:8,zweck:t,dringlichkeit:'Routine'});return r.urteil+' '+(r.grund||'').slice(0,140)},[t,o]));}
console.log(e.join()||'keine Fehler');await b.close()})();
