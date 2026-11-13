const {chromium}=require('playwright');
const ok=(c,m)=>console.log((c?'OK   ':'FAIL ')+m);
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1500,height:1000}})).newPage();const e=[];p.on('pageerror',x=>e.push(x.message));
const req=[];p.on('request',r=>{const u=r.url();if(/gdi\.berlin|cartocdn/.test(u))req.push(u.replace(/key=[^&]+/,'key=***'))});
await p.goto('file:///home/claude/index.html');await p.waitForTimeout(5200);await p.fill('#gate-pw','pw-test-123');await p.fill('#gate-pw2','pw-test-123');await p.click('#gate-go');
await p.waitForFunction(()=>!document.body.classList.contains('locked'),null,{timeout:20000});
await p.evaluate(()=>{dispatch({type:'STATUS_GESETZT',status:'Standby'});dispatch({type:'NAVIGATION',modul:'karte'});});await p.waitForTimeout(800);
await p.click('#k-b-hybrid');await p.waitForTimeout(300);req.length=0;
await p.evaluate(()=>{VIEW.karte.zoom=16;VIEW.karte.lat=52.4806;VIEW.karte.lon=13.4376;zeichneKarte(document.getElementById('k-svg'))});await p.waitForTimeout(5000);
const n1=req.length;const lb=req.filter(u=>/gdi\.berlin/.test(u)),cn=req.filter(u=>/dark_nolabels/.test(u)),cl=req.filter(u=>/only_labels/.test(u));
console.log('Anfragen: Luftbild',lb.length,'(jpeg',lb.filter(u=>/jpeg/.test(u)).length,') dunkle Unterlage',cn.length,'Beschriftung',cl.length);
ok(cn.length===0,'in Berlin keine dunkle Unterlage');ok(lb.length>0&&lb.filter(u=>/jpeg/.test(u)).length>0,'JPEG im Kerngebiet');
// Verschieben um 1/3 Bild: Elemente wiederverwenden
const t=await p.evaluate(()=>{const svg=document.getElementById('k-svg');const vor=new Set([...svg.querySelectorAll('image')]);VIEW.karte.lon+=0.0008;zeichneKarte(svg);const nach=[...svg.querySelectorAll('image')];return [vor.size,nach.filter(x=>vor.has(x)).length,nach.length]});
console.log('Elemente vor/wiederverwendet/nach',t);ok(t[1]>t[0]*0.6,'Bildelemente werden wiederverwendet');
// Zoomwechsel: Ersatzkacheln
await p.evaluate(()=>{VIEW.karte.zoom=15.4;zeichneKarte(document.getElementById('k-svg'))});
const imgs=await p.evaluate(()=>document.querySelectorAll('#k-svg image').length);console.log('Bilder nach Zoomwechsel (inkl. Ersatz)',imgs);
await p.waitForTimeout(3000);
// außerhalb Berlins: keine Luftbildanfragen
req.length=0;await p.evaluate(()=>{VIEW.karte.zoom=14;VIEW.karte.lat=51.2;VIEW.karte.lon=9.0;zeichneKarte(document.getElementById('k-svg'))});await p.waitForTimeout(2500);
ok(req.filter(u=>/gdi\.berlin/.test(u)).length===0,'Außerhalb Berlins keine Luftbildanfragen');ok(req.filter(u=>/dark_nolabels/.test(u)).length>0,'dunkle Unterlage außerhalb');
await p.evaluate(()=>{VIEW.karte.zoom=16;VIEW.karte.lat=52.4806;VIEW.karte.lon=13.4376;zeichneKarte(document.getElementById('k-svg'))});await p.waitForTimeout(3000);
await p.screenshot({path:'lb2.png'});
console.log(e.join()||'keine Fehler');await b.close()})();
