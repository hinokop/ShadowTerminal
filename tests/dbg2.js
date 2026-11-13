const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await (await b.newContext()).newPage();
await p.addInitScript(()=>{window.__ARGUS_ERGEBNIS='direkt'});
await p.goto('file:///home/claude/index.html');await p.waitForTimeout(5200);await p.keyboard.press('Space');await p.fill('#gate-pw','pw-test-123');await p.fill('#gate-pw2','pw-test-123');await p.click('#gate-go');
await p.waitForFunction(()=>!document.body.classList.contains('locked'),null,{timeout:20000});
await p.evaluate(()=>{dispatch({type:'KENNWORT_SCHALTER',an:false});dispatch({type:'STATUS_GESETZT',status:'Standby'});dispatch({type:'MISSION_ZUGEWIESEN',id:'M1'});dispatch({type:'MISSION_ANGENOMMEN',id:'M1'});dispatch({type:'MISSION_BEGINN_JETZT'});dispatch({type:'ZONE_ANGELEGT',ll:[52.4817,13.4352]});});
console.log(await p.evaluate(()=>({auto:STATE.automatik,lm:!!LM(),lauf:einsatzLaeuft(),fs:STATE.funkstille.aktiv,st:STATE.agent.status,z:zonenEigene(zDef()).length,ev:STATE.zonenEv})));
await b.close()})();
