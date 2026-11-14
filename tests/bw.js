const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1400,height:1000}})).newPage();const e=[];p.on('pageerror',x=>e.push(x.message));
await p.goto(require('./_pfad.js').APP);await p.waitForTimeout(5200);await p.keyboard.press('Space');await p.fill('#gate-pw','pw-test-123');await p.fill('#gate-pw2','pw-test-123');await p.click('#gate-go');
await p.waitForFunction(()=>!document.body.classList.contains('locked'),null,{timeout:20000});
console.log('gate-skip:',await p.evaluate(()=>!!document.getElementById('gate-skip')),'Hinweistext:',await p.evaluate(()=>/überspringen/i.test(document.body.innerText)));
await p.evaluate(()=>{dispatch({type:'KENNWORT_SCHALTER',an:false});dispatch({type:'STATUS_GESETZT',status:'Standby'});dispatch({type:'MISSION_ZUGEWIESEN',id:'M1'});dispatch({type:'MISSION_ANGENOMMEN',id:'M1'});dispatch({type:'MISSION_BEGINN_JETZT'});ERK.liste=[]});
await p.evaluate(()=>dispatch({type:'NACHRICHT_GESENDET',kanal:'asset',text:'Wo befindest du dich derzeit',dringlichkeit:'Routine'}));
for(let i=0;i<14;i++){await p.evaluate(()=>{STATE.plan.filter(x=>x.typ==='antwort').forEach(x=>{x.faelligAm=new Date(Date.now()-1000).toISOString()});});await p.waitForTimeout(500);
 if(await p.evaluate(()=>STATE.komm.kanaele.asset.nachrichten.some(x=>x.von==='gegenstelle'&&x.zu)))break;}
console.log('Antwort:',JSON.stringify(await p.evaluate(()=>STATE.komm.kanaele.asset.nachrichten.filter(x=>x.von==='gegenstelle'&&x.zu).map(x=>({kat:x.kat,text:x.text})))));
await p.evaluate(()=>{const m=STATE.komm.kanaele.asset.nachrichten.filter(x=>x.von==='gegenstelle'&&x.zu)[0];const el=bewertungsLeiste(m);el.id='bwt';document.body.appendChild(el)});
await p.click('#bwt .unpassend');await p.selectOption('#bwt select','beobachtung');await p.fill('#bwt .bw-wunsch','Bin am Hof.');await p.click('#bwt button:has-text("Speichern")');
console.log('Anzeige:',await p.textContent('#bwt'));
console.log('JSON:',await p.evaluate(()=>ERK.json()));
console.log('Text:',await p.evaluate(()=>ERK.text()));
console.log('Fehler:',e.join()||'keine');await b.close()})();
