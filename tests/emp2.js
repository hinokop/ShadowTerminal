const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await (await b.newContext()).newPage();const e=[];p.on('pageerror',x=>e.push(x.message));
await p.goto('file:///home/claude/index.html');await p.waitForTimeout(5200);await p.fill('#gate-pw','pw-test-123');await p.fill('#gate-pw2','pw-test-123');await p.click('#gate-go');
await p.waitForFunction(()=>!document.body.classList.contains('locked'),null,{timeout:20000});await p.evaluate(()=>{dispatch({type:'STATUS_GESETZT',status:'Standby'});dispatch({type:'MISSION_ZUGEWIESEN',id:'M1'});dispatch({type:'MISSION_ANGENOMMEN',id:'M1'});alleEntitaeten().forEach(e=>{IZ()[e.id]={status:'frei'}});});
const r=await p.evaluate(()=>['Hallo','Wo bist du?','Kann ich dich treffen?','Hast du Geld?'].map(t=>{try{return t+' -> '+JSON.stringify(antwortFuer('asset',t,'Routine','N-X'))}catch(x){return t+' ERR '+x.message}}));
console.log(r.join('\n'));console.log(e.join()||'keine Fehler');await b.close()})();
