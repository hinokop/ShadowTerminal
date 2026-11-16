const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1500,height:1150}})).newPage();const e=[];p.on('pageerror',x=>e.push(x.message));
await p.goto(require('./_pfad.js').APP);await p.waitForTimeout(5200);await p.keyboard.press('Space');await p.fill('#gate-pw','pw-test-123');await p.fill('#gate-pw2','pw-test-123');await p.click('#gate-go');
await p.waitForFunction(()=>!document.body.classList.contains('locked'),null,{timeout:20000});
await p.evaluate(()=>{dispatch({type:'KENNWORT_SCHALTER',an:false});dispatch({type:'STATUS_GESETZT',status:'Standby'});dispatch({type:'MISSION_ZUGEWIESEN',id:'M1'});dispatch({type:'MISSION_ANGENOMMEN',id:'M1'});dispatch({type:'MISSION_BEGINN_JETZT'});
 ['P-0002','P-0003','P-0007','P-0016','O-0001','P-0006'].forEach(i=>{IZ()[i]={status:'frei'}});dispatch({type:'NAVIGATION',modul:'karte'});});
await p.waitForTimeout(500);const R={};
await p.evaluate(()=>{VIEW.karte.zoom=9.4;VIEW.karte.lat=52.40;VIEW.karte.lon=13.40;zeichneKarte($('k-svg'))});
await p.click('#k-messen');R.an=await p.evaluate(()=>VIEW.karte.messen);
await p.evaluate(()=>{});
// zwei Klicks auf Karte
const sv=await p.locator('#k-svg').boundingBox();
await p.mouse.click(sv.x+300,sv.y+300);await p.mouse.click(sv.x+700,sv.y+400);
R.nachZwei=await p.evaluate(()=>({messen:VIEW.karte.messen,pts:VIEW.karte.messPts.length}));
R.btn=await p.textContent('#k-messen');
// Popup öffnen funktioniert wieder
await p.evaluate(()=>karteWaehlen('P-0007',false));R.popup=await p.$eval('#k-auswahl',n=>!n.hidden);R.knoepfe=await p.$$eval('#k-auswahl button',n=>n.map(x=>x.textContent));
await p.click('#k-messen');R.geloescht=await p.evaluate(()=>VIEW.karte.messPts.length);
// Messen an, Modulwechsel
await p.click('#k-messen');await p.evaluate(()=>dispatch({type:'NAVIGATION',modul:'dossier'}));await p.waitForTimeout(300);
await p.evaluate(()=>dispatch({type:'NAVIGATION',modul:'karte'}));await p.waitForTimeout(300);
R.nachWechsel=await p.evaluate(()=>VIEW.karte.messen);
// Presets
R.preset=await p.$$eval('.k-seg button',n=>n.map(x=>x.textContent+':'+x.classList.contains('aktiv')));
await p.click('#k-p-zeit');R.zeit=await p.$$eval('.k-seg button',n=>n.map(x=>x.textContent+':'+x.classList.contains('aktiv')));
await p.click('#k-p-gesamt');await p.waitForTimeout(400);
await p.screenshot({path:'kv4.png'});
// Handler fragen Antwort
await p.evaluate(()=>karteWaehlen('P-0007',false));await p.click('#k-pop-frage');
R.draft=await p.evaluate(()=>VIEW.draft['km-handler']);
R.antw=await p.evaluate(()=>antwortFuer('handler',VIEW.draft['km-handler'],'Routine','N-960').text);
console.log(JSON.stringify(R,null,1));console.log('Fehler:',e.join('|')||'keine');await b.close()})();
