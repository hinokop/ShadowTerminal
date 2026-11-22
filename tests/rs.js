const {chromium}=require('playwright');
const ok=(c,m)=>console.log((c?'OK   ':'FAIL ')+m);
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1400,height:1100}})).newPage();const e=[];p.on('pageerror',x=>e.push(x.message));
await p.goto(require('./_pfad.js').APP);await p.waitForTimeout(5200);await p.fill('#gate-pw','pw-test-123');await p.fill('#gate-pw2','pw-test-123');await p.click('#gate-go');
await p.waitForFunction(()=>!document.body.classList.contains('locked'),null,{timeout:20000});
await p.evaluate(()=>{dispatch({type:'KENNWORT_SCHALTER',an:false});dispatch({type:'STATUS_GESETZT',status:'Standby'});dispatch({type:'MISSION_ZUGEWIESEN',id:'M1'});dispatch({type:'MISSION_ANGENOMMEN',id:'M1'});/* Phase 5c1b: Format 5 hat weder Plan noch Kanäle; künstlich eingesetzte, überfällige Planeinträge werden nicht abgearbeitet */
 STATE.plan=[];STATE.seq.plan=0;for(let i=0;i<5;i++) planen(STATE,{typ:'verlauf',kanal:'handler',auto:false,text:'Rückstau '+i,faelligAm:new Date(Date.now()-3600000-i*1000).toISOString()});});
const zaehl=()=>p.evaluate(()=>[STATE.plan.length,!!STATE.komm]);
await p.waitForTimeout(3500);
const a=await zaehl();console.log('nach 3,5 s:',JSON.stringify(a));ok(a[0]===5&&!a[1],'Rückstau nach 3,5 s unverarbeitet');
await p.waitForTimeout(30000);
const c=await zaehl();console.log('nach 34 s:',JSON.stringify(c));ok(c[0]===5&&!c[1],'Rückstau nach 34 s unverarbeitet');
console.log(e.join()||'keine Fehler');await b.close()})();
