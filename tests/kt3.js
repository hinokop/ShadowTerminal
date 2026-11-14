const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1500,height:1100}})).newPage();const e=[];p.on('pageerror',x=>e.push(x.message));
await p.goto(require('./_pfad.js').APP);await p.waitForTimeout(5200);await p.keyboard.press('Space');await p.fill('#gate-pw','pw-test-123');await p.fill('#gate-pw2','pw-test-123');await p.click('#gate-go');
await p.waitForFunction(()=>!document.body.classList.contains('locked'),null,{timeout:20000});
await p.evaluate(()=>{dispatch({type:'KENNWORT_SCHALTER',an:false});dispatch({type:'STATUS_GESETZT',status:'Standby'});dispatch({type:'MISSION_ZUGEWIESEN',id:'M1'});dispatch({type:'MISSION_ANGENOMMEN',id:'M1'});dispatch({type:'MISSION_BEGINN_JETZT'});
 ['P-0002','P-0003','P-9054'].forEach(i=>{IZ()[i]={status:'frei'}});dispatch({type:'NAVIGATION',modul:'karte'});});
await p.waitForTimeout(600);
await p.evaluate(()=>karteWaehlen('P-0001',false));await p.waitForTimeout(200);
const links=await p.$$eval('#k-auswahl button,#k-auswahl a',n=>n.map(x=>x.textContent));console.log('Popup-Schaltflächen',links);
const vh=await p.$$eval('.k-verb-hit',n=>n.length);console.log('Kanten',vh);
if(vh){await p.evaluate(()=>{const v=document.querySelector('.k-verb-hit');v.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));v.dispatchEvent(new PointerEvent('pointerup',{bubbles:true}));v.dispatchEvent(new MouseEvent('click',{bubbles:true}))});}
const btn=await p.$('#k-auswahl button:has-text("P-0001")');if(btn){await btn.click();await p.waitForTimeout(300);console.log('Pfad',await p.textContent('#tb-path'));}
await p.evaluate(()=>{dispatch({type:'NAVIGATION',modul:'karte'})});await p.waitForTimeout(300);
await p.evaluate(()=>{VIEW.karte.dt=36;renderModule()});await p.waitForTimeout(500);await p.screenshot({path:'/tmp/t/k3.png'});
console.log('Fehler:',e.join('|')||'keine');await b.close()})();
