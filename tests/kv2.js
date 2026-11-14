const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1500,height:1150}})).newPage();const e=[];p.on('pageerror',x=>e.push(x.message));p.on('console',m=>{if(m.type()==='error')e.push('console:'+m.text())});
await p.goto(require('./_pfad.js').APP);await p.waitForTimeout(5200);await p.keyboard.press('Space');await p.fill('#gate-pw','pw-test-123');await p.fill('#gate-pw2','pw-test-123');await p.click('#gate-go');
await p.waitForFunction(()=>!document.body.classList.contains('locked'),null,{timeout:20000});
await p.evaluate(()=>{dispatch({type:'KENNWORT_SCHALTER',an:false});dispatch({type:'STATUS_GESETZT',status:'Standby'});dispatch({type:'MISSION_ZUGEWIESEN',id:'M1'});dispatch({type:'MISSION_ANGENOMMEN',id:'M1'});dispatch({type:'MISSION_BEGINN_JETZT'});
 ['P-0002','P-0003','P-9054','P-9063','O-9051','P-9053'].forEach(i=>{IZ()[i]={status:'frei'}});dispatch({type:'NAVIGATION',modul:'karte'});});
await p.waitForTimeout(600);
const R={};
await p.evaluate(()=>{VIEW.karte.zoom=11;VIEW.karte.lat=52.46;VIEW.karte.lon=13.45;zeichneKarte($('k-svg'))});
R.leit=await p.$$eval('.k-leit',n=>n.length);
// Suche
await p.fill('#k-suche','kaya');R.suche=await p.$$eval('#k-suche-erg button',n=>n.map(x=>x.textContent));
await p.click('#k-suche-erg button');await p.waitForTimeout(900);
R.auswahl=await p.evaluate(()=>VIEW.karte.auswahl);R.popup=await p.$eval('#k-auswahl',n=>!n.hidden);
// Hover-Fokus
const box=await p.locator('.k-marker[data-id="P-0001"] .k-treffer').boundingBox();
await p.mouse.move(box.x+box.width/2,box.y+box.height/2);await p.waitForTimeout(200);
R.fokus=await p.evaluate(()=>({hat:document.getElementById('k-svg').classList.contains('hat-fokus'),nah:document.querySelectorAll('.k-nah').length,tip:document.getElementById('k-tip').textContent}));
await p.screenshot({path:'/tmp/t/kv2a.png'});
// Messen
await p.click('#k-messen');
await p.evaluate(()=>{const P=karteProj();VIEW.karte.messPts=[[52.52,13.40],[52.39,13.81]];zeichneKarte($('k-svg'))});
R.mess=await p.$eval('.k-mess-t',n=>n.textContent);
await p.screenshot({path:'/tmp/t/kv2b.png'});
await p.click('#k-messen');
// Wiedergabe
await p.click('#k-spiel');await p.waitForTimeout(1200);R.dt=await p.evaluate(()=>VIEW.karte.dt);await p.click('#k-spiel');
// Presets/Basis
await p.click('#k-p-netzwerk');R.netz=await p.evaluate(()=>({f:VIEW.karte.ebenen.fenster,v:VIEW.karte.ebenen.verbindungen}));
await p.click('#k-p-lage');
await p.click('#k-b-carto');R.carto=await p.evaluate(()=>VIEW.karte.ebenen.kacheln+'/'+VIEW.karte.anbieter);await p.click('#k-b-offline');
// Popup-Aktion
await p.evaluate(()=>karteWaehlen('P-0001',false));await p.click('#k-pop-frage');R.draft=await p.evaluate(()=>VIEW.draft['km-handler']+' @'+STATE.ui.modul);
console.log(JSON.stringify(R,null,1));console.log('Fehler:',e.join(' | ')||'keine');await b.close()})();
