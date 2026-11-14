const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1400,height:1000}})).newPage();const e=[];p.on('pageerror',x=>e.push(x.message));
await p.goto(require('./_pfad.js').APP);await p.waitForTimeout(5200);await p.fill('#gate-pw','pw-test-123');await p.fill('#gate-pw2','pw-test-123');await p.click('#gate-go');
await p.waitForFunction(()=>!document.body.classList.contains('locked'),null,{timeout:20000});
await p.evaluate(()=>{dispatch({type:'KENNWORT_SCHALTER',an:false});dispatch({type:'STATUS_GESETZT',status:'Standby'});dispatch({type:'MISSION_ZUGEWIESEN',id:'M1'});dispatch({type:'MISSION_ANGENOMMEN',id:'M1'});alleEntitaeten().forEach(e=>{IZ()[e.id]={status:'frei'}});});
const qs=[['handler','Wie viel Zeit bleibt mir bis Transport?'],['handler','Standort von KIEBITZ und P9101'],['handler','Alias von P-0001'],['handler','Nächste Missionsphase?'],['handler','Verstärkung für P-0001 muss sich beeilen.'],['handler','Letzter Standort p-9101'],['support','Ist DISPO verfügbar?'],['handler','Ist DISPO verfügbar?'],['handler','Wann ist das Treffen mit KIEBITZ?'],['handler','Wo ist P-9999?'],['handler','Letzter Standort P-0001']];
for(const [k,q] of qs){console.log(k,'|',q,'\n   ->',await p.evaluate(([k,q])=>{const r=antwortFuer(k,q,'Routine','N-101');return r&&r.kat+' :: '+r.text},[k,q]));}
await p.evaluate(()=>dispatch({type:'SICHTUNG_HINZU',id:'P-0001',ort:'Sonnenallee 14',text:'verlässt die Werkstatt'}));
console.log(await p.evaluate(()=>antwortFuer('handler','Letzter Standort P-0001','Routine','N-102').text));
await p.keyboard.press('3');await p.waitForTimeout(300);
await p.evaluate(()=>{oeffneDossier('P-0001','test');VIEW.dtab='sichtungen';renderModule();});await p.waitForTimeout(300);
console.log(await p.evaluate(()=>document.querySelector('#btn-si')?'Sichtungen-Tab ok':'FEHLT'));
await p.screenshot({path:'si.png'});
console.log(e.join()||'keine Fehler');await b.close()})();
