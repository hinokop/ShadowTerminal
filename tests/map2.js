const {chromium}=require('playwright');
const ok=(c,m)=>console.log((c?'OK   ':'FAIL ')+m);
(async()=>{
 const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1280,height:900}});
 const p=await ctx.newPage();const errs=[];
 p.on('pageerror',e=>errs.push('PAGE '+e.message));p.on('console',m=>{if(m.type()==='error')errs.push('CON '+m.text())});
 await p.goto(require('./_pfad.js').APP);await p.waitForTimeout(5200);
 await p.fill('#gate-pw','pw-test-123');await p.fill('#gate-pw2','pw-test-123');await p.click('#gate-go');
 await p.waitForFunction(()=>!document.body.classList.contains('locked'),null,{timeout:20000});
 await p.keyboard.press('6');await p.waitForTimeout(500);
 ok(await p.isVisible('#k-svg'),'Karte sichtbar');
 await p.screenshot({path:'k_a.png'});
 // Welt, Europa, Zoom auf Berlin-ähnlich
 await p.click('#k-eu');await p.waitForTimeout(200);await p.screenshot({path:'k_eu.png'});
 const n=await p.evaluate(()=>document.querySelectorAll('.k-marker').length);console.log('Marker Europa',n);
 await p.evaluate(()=>{VIEW.karte.lat=52.52;VIEW.karte.lon=13.4;VIEW.karte.zoom=9;zeichneKarte($('k-svg'))});await p.waitForTimeout(200);
 await p.screenshot({path:'k_city.png'});
 // Klick auf Marker -> Dossier
 const id=await p.evaluate(()=>{VIEW.karte.lat=50;VIEW.karte.lon=10;VIEW.karte.zoom=4.4;zeichneKarte($('k-svg'));const m=document.querySelector('.k-marker[data-id^="P-"]');return m&&m.getAttribute('data-id')});
 console.log('erster Marker',id);
 if(id){const box=await p.locator('.k-marker[data-id="'+id+'"] .k-treffer').boundingBox();await p.mouse.click(box.x+box.width/2,box.y+box.height/2);await p.waitForTimeout(400);
  console.log('Pfad',await p.textContent('#tb-path'));ok((await p.textContent('#tb-path')).startsWith('/dossier'),'Klick öffnet Dossier');}
 console.log(errs.join('\n')||'keine Fehler');
 await b.close();
})();
