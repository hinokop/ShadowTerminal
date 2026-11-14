const PF=require('./_pfad.js');const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1500,height:950}})).newPage();const e=[];p.on('pageerror',x=>e.push(x.message));
let anfragen=[];
await p.route(/api\.open-meteo\.com/,r=>{anfragen.push(r.request().url());r.fulfill({json:{current:{time:'2026-11-13T17:15',temperature_2m:6.4,precipitation:0.3,weather_code:61,cloud_cover:90,wind_speed_10m:14.2,wind_direction_10m:225,wind_gusts_10m:38,visibility:8200}},headers:{'access-control-allow-origin':'*'}})});
await p.route(/geobasis|eox|gdi\.berlin|cartocdn/,r=>r.abort());
await p.goto(require('./_pfad.js').APP);await p.waitForTimeout(5200);await p.fill('#gate-pw','pw-test-123');await p.fill('#gate-pw2','pw-test-123');await p.click('#gate-go');
await p.waitForFunction(()=>!document.body.classList.contains('locked'),null,{timeout:20000});
await p.evaluate(()=>{dispatch({type:'KENNWORT_SCHALTER',ein:false});dispatch({type:'STATUS_GESETZT',status:'Standby'});dispatch({type:'MISSION_ZUGEWIESEN',id:'M1'});dispatch({type:'MISSION_ANGENOMMEN',id:'M1'});dispatch({type:'NAVIGATION',modul:'karte'})});await p.waitForTimeout(800);
await p.evaluate(()=>{VIEW.karte.statusOffen=true;VIEW.karte.lat=52.4905;VIEW.karte.lon=13.426;VIEW.karte.zoom=15;renderModule()});await p.waitForTimeout(800);
console.log('Licht:',await p.textContent('#k-st-licht'),'| Wetter-Zeile vorhanden',await p.evaluate(()=>!!document.getElementById('k-st-wetter')));
await p.waitForTimeout(1500);console.log('Checkbox vorhanden',await p.evaluate(()=>!!document.getElementById('k-wetter')));
console.log('Wetter:',await p.textContent('#k-st-wetter'),'| Anfragen',anfragen.length);
// Mehrfaches Neuzeichnen/Verschieben löst keine neue Anfrage aus
await p.evaluate(()=>{for(let i=0;i<30;i++){VIEW.karte.lon+=0.003;zeichneKarte($('k-svg'));}});await p.waitForTimeout(500);
console.log('Anfragen nach Verschieben im selben 0,1-Grad-Feld:',anfragen.length,anfragen[0]&&anfragen[0].slice(0,110));
console.log(e.join('|')||'keine Seitenfehler');await b.close()})();
