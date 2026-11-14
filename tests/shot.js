const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1500,height:1100}})).newPage();
await p.goto(require('./_pfad.js').APP);await p.waitForTimeout(5200);await p.keyboard.press('Space');await p.fill('#gate-pw','pw-test-123');await p.fill('#gate-pw2','pw-test-123');await p.click('#gate-go');
await p.waitForFunction(()=>!document.body.classList.contains('locked'),null,{timeout:20000});
await p.evaluate(()=>{dispatch({type:'KENNWORT_SCHALTER',an:false});dispatch({type:'STATUS_GESETZT',status:'Standby'});dispatch({type:'MISSION_ZUGEWIESEN',id:'M1'});dispatch({type:'MISSION_ANGENOMMEN',id:'M1'});dispatch({type:'MISSION_BEGINN_JETZT'});dispatch({type:'SICHTUNG_HINZU',id:'P-0002',ort:'Sonnenallee 14',text:'Fährt den Transporter',guete:'gesichert'});dispatch({type:'DOSSIER_GEOEFFNET',id:'P-0002',navigieren:true})});
await p.waitForTimeout(500);await p.screenshot({path:'rud.png'});await b.close()})();
