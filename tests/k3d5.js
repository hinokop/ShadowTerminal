const PF=require('./_pfad.js');
const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});const p=await (await b.newContext({viewport:{width:1500,height:950}})).newPage();const e=[];p.on('pageerror',x=>e.push(x.message));
const D=PF.MAPLIBRE;
await p.route('**/*',r=>{const u=r.request().url();
 if(u.includes('maplibre-gl.js'))return r.fulfill({path:D+'maplibre-gl.js',contentType:'text/javascript'});
 if(u.includes('maplibre-gl.css'))return r.fulfill({path:D+'maplibre-gl.css',contentType:'text/css'});
 if(u.includes('styles/liberty'))return r.fulfill({json:{version:8,sources:{},glyphs:'https://x/{fontstack}/{range}.pbf',layers:[{id:'bg',type:'background',paint:{'background-color':'#e9e6e0'}}]}});
 if(u.startsWith('file:'))return r.continue(); return r.abort();});
await p.goto(PF.APP);await p.waitForTimeout(5200);await p.fill('#gate-pw','pw-test-123');await p.fill('#gate-pw2','pw-test-123');await p.click('#gate-go');
await p.waitForFunction(()=>!document.body.classList.contains('locked'),null,{timeout:20000});
await p.evaluate(()=>{dispatch({type:'KENNWORT_SCHALTER',ein:false});dispatch({type:'STATUS_GESETZT',status:'Standby'});dispatch({type:'MISSION_ZUGEWIESEN',id:'M1'});dispatch({type:'MISSION_ANGENOMMEN',id:'M1'});dispatch({type:'NAVIGATION',modul:'karte'})});await p.waitForTimeout(800);
await p.click('#k-3d');await p.waitForTimeout(3500);
const fr=()=>p.frames().find(f=>f.url().includes('karte3d'));
await fr().evaluate(()=>{window.__marke=123;});
const pos=async()=>p.evaluate(()=>{const h=document.getElementById('k-3d-host').getBoundingClientRect(),pl=document.querySelector('.k-3d-platz').getBoundingClientRect();return {hostOk:Math.abs(h.left-pl.left)<1.5&&Math.abs(h.top-pl.top)<1.5&&Math.abs(h.width-pl.width)<1.5&&h.width>300,vis:!document.getElementById('k-3d-host').hidden}});
console.log('Position',JSON.stringify(await pos()));
// Ebenenleiste und Zoomtasten liegen über der 3D-Fläche?
console.log('Ebenen oben',await p.evaluate(()=>{const l=document.getElementById('k-ebenen').getBoundingClientRect();const el=document.elementFromPoint(l.left+30,l.top+20);return !!el.closest('#k-ebenen')}),
 'Zoomtaste oben',await p.evaluate(()=>{const l=document.getElementById('k-plus').getBoundingClientRect();return document.elementFromPoint(l.left+5,l.top+5).id==='k-plus'}));
// Pin setzen, Messen, Ebene umschalten -> kein Neuladen
await p.click('#k-pin-neu');await p.waitForTimeout(600);
const box=await p.evaluate(()=>{const r=document.getElementById('k-3d-host').getBoundingClientRect();return {x:r.left,y:r.top,w:r.width,h:r.height}});
await p.mouse.click(box.x+box.w*0.6,box.y+box.h*0.6);await p.waitForTimeout(900);
console.log('nach Pin: Marke',await fr().evaluate(()=>window.__marke),'Pins',await p.evaluate(()=>PROFIL.pins.length),'Popup',await p.evaluate(()=>!document.getElementById('k-auswahl').hidden));
await p.click('#k-messen');await p.mouse.click(box.x+box.w*0.4,box.y+box.h*0.4);await p.mouse.click(box.x+box.w*0.5,box.y+box.h*0.5);await p.waitForTimeout(900);
console.log('nach Messen: Marke',await fr().evaluate(()=>window.__marke),'Messpunkte im 3D',await fr().evaluate(()=>karte3d.getSource('mess')._data.features.length));
// Scroll: Host folgt
await p.evaluate(()=>window.scrollTo(0,120));await p.waitForTimeout(300);console.log('nach Scroll',JSON.stringify(await pos()));
// 2D und zurück: Kamera/Marke bleibt
await p.evaluate(()=>window.scrollTo(0,0));await p.click('#k-3d');await p.waitForTimeout(500);console.log('2D: Host versteckt',await p.evaluate(()=>document.getElementById('k-3d-host').hidden));
await p.click('#k-3d');await p.waitForTimeout(800);console.log('3D wieder: Marke',await fr().evaluate(()=>window.__marke),JSON.stringify(await pos()));
await p.evaluate(()=>dispatch({type:'NAVIGATION',modul:'profil'}));await p.waitForTimeout(400);console.log('anderes Modul: Host versteckt',await p.evaluate(()=>document.getElementById('k-3d-host').hidden));
console.log(e.join('|')||'keine Seitenfehler');await b.close()})();
