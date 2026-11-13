const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1400,height:1000}})).newPage();const e=[];p.on('pageerror',x=>e.push(x.message));
await p.goto('file:///home/claude/index.html');await p.waitForTimeout(5200);await p.fill('#gate-pw','pw-test-123');await p.fill('#gate-pw2','pw-test-123');await p.click('#gate-go');
await p.waitForFunction(()=>!document.body.classList.contains('locked'),null,{timeout:20000});
await p.evaluate(()=>{dispatch({type:'STATUS_GESETZT',status:'Standby'});dispatch({type:'MISSION_ZUGEWIESEN',id:'M1'});dispatch({type:'MISSION_ANGENOMMEN',id:'M1'});alleEntitaeten().forEach(e=>{IZ()[e.id]={status:'frei'}});});
const q=[['handler','Ralf Neumann, Informationen?'],['handler','Was weißt du über Neumann?'],['handler','Wusste Neumann Bescheid?'],['handler','Hat Zielińska ein Foto im Dossier?'],['handler','Verbindungen von P-9054?'],['handler','Wie gefährlich ist Kremer?'],['handler','Wo ist die Hinterhofwerkstatt?'],['handler','Yildirim Informationen'],['support','Auswertung zu Oderland Transit?'],['asset','Kennst du Nguyen?'],['asset','Was weißt du über Neumann?'],['asset','Kennst du den Kutscher?'],['asset','Kennst du Aydın?'],['handler','Lage?'],['handler','Informationen?'],['handler','Wie ist die Lage bei Z-P1?'],['handler','Hallo']];
for (const [k,t] of q) console.log(k.padEnd(8),t,'\n    ->',await p.evaluate(([k,t])=>{const r=antwortFuer(k,t,'Routine','N-20');return r?r.text:'(null)'},[k,t]));
console.log(e.join()||'keine Fehler');await b.close()})();
