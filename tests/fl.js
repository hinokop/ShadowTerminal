const PF=require('./_pfad.js');
const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1500,height:950}})).newPage();const e=[];p.on('pageerror',x=>e.push(x.message));
await p.route(/geobasis|eox|gdi\.berlin|cartocdn|open-meteo/,r=>r.abort());
await p.goto(PF.APP);await p.waitForTimeout(5200);await p.fill('#gate-pw','pw-test-123');await p.fill('#gate-pw2','pw-test-123');await p.click('#gate-go');
await p.waitForFunction(()=>!document.body.classList.contains('locked'),null,{timeout:20000});
await p.evaluate(()=>{dispatch({type:'KENNWORT_SCHALTER',ein:false});dispatch({type:'STATUS_GESETZT',status:'Standby'});dispatch({type:'MISSION_ZUGEWIESEN',id:'M1'});dispatch({type:'MISSION_ANGENOMMEN',id:'M1'});dispatch({type:'NAVIGATION',modul:'karte'})});await p.waitForTimeout(900);
console.log(await p.evaluate(()=>[...document.querySelectorAll('#k-fenster tr')].slice(0,4).map(r=>r.textContent.replace(/\s+/g,' ').slice(0,170)).join('\n')));console.log(e.join('|')||'keine Seitenfehler');await b.close()})();
