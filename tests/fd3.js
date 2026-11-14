const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await (await b.newContext()).newPage();const e=[];p.on('pageerror',x=>e.push(x.message));
await p.goto(require('./_pfad.js').APP);await p.waitForTimeout(5200);await p.keyboard.press('Space');await p.fill('#gate-pw','pw-test-123');await p.fill('#gate-pw2','pw-test-123');await p.click('#gate-go');
await p.waitForFunction(()=>!document.body.classList.contains('locked'),null,{timeout:20000});
await p.evaluate(()=>{dispatch({type:'KENNWORT_SCHALTER',an:false});dispatch({type:'STATUS_GESETZT',status:'Standby'});dispatch({type:'MISSION_ZUGEWIESEN',id:'M1'});dispatch({type:'MISSION_ANGENOMMEN',id:'M1'});dispatch({type:'MISSION_BEGINN_JETZT'});});
const R=await p.evaluate(()=>{
 STATE.dialog={asset:{offen:{id:STATE_ID(),t:nowIso()},zuletzt:[],seitFrage:0,fragenZuletzt:[]}};
 function STATE_ID(){return DIALOG.nachfragen.asset[0].id}
 return ['Was kannst du mir zu Xylander sagen','Informationen zu Zorn ?','Nein, reine Routine.','Wer ist der Mann am Tor?','Danke, was weißt du über den Fahrer?'].map(t=>{STATE.dialog.asset.offen={id:DIALOG.nachfragen.asset[0].id,t:nowIso()};const r=antwortFuer('asset',t,'Routine','N-910');return t+' -> '+r.kat+' | '+r.text});});
console.log(R.join('\n'));console.log('Fehler:',e.join('|')||'keine');await b.close()})();
