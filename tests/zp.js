const {chromium}=require('playwright');
const ok=(c,m)=>console.log((c?'OK   ':'FAIL ')+m);
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1500,height:1100}})).newPage();const e=[];p.on('pageerror',x=>e.push(x.message));
await p.goto('file:///home/claude/index.html');await p.waitForTimeout(5200);await p.fill('#gate-pw','pw-test-123');await p.fill('#gate-pw2','pw-test-123');await p.click('#gate-go');
await p.waitForFunction(()=>!document.body.classList.contains('locked'),null,{timeout:20000});
await p.evaluate(()=>{dispatch({type:'STATUS_GESETZT',status:'Standby'});dispatch({type:'MISSION_ZUGEWIESEN',id:'M1'});dispatch({type:'MISSION_ANGENOMMEN',id:'M1'});MS('M1').beginn=new Date(Date.now()-3600000).toISOString();alleEntitaeten().forEach(e=>{IZ()[e.id]={status:'frei'}});dispatch({type:'NAVIGATION',modul:'karte'});});await p.waitForTimeout(700);
// Modus per Knopf
await p.click('#k-zugriff-neu');
await p.evaluate(()=>{VIEW.karte.zoom=15;VIEW.karte.lat=52.4806;VIEW.karte.lon=13.4376;zeichneKarte(document.getElementById('k-svg'))});await p.waitForTimeout(400);
const box=await p.locator('#k-svg').boundingBox();
for(const [fx,fy] of [[0.55,0.5],[0.62,0.55],[0.5,0.62]]){await p.mouse.click(box.x+box.width*fx,box.y+box.height*fy);await p.waitForTimeout(250);}
const z=await p.evaluate(()=>zonenEigene(zDef()).map(x=>[x.id,x.art,x.r,x.wertung].join(':')));console.log(z);
ok(z.length===3&&z.every(x=>x.startsWith('ZG-')),'drei Zugriffspunkte per wiederholtem Klick');
ok(await p.evaluate(()=>VIEW.karte.zugriffSetzen===true),'Modus bleibt aktiv');
await p.locator('#k-svg').focus();await p.keyboard.press('Escape');await p.waitForTimeout(200);
ok(await p.evaluate(()=>VIEW.karte.zugriffSetzen===false),'Esc beendet den Modus');
// Popup + Typen
await p.evaluate(()=>{VIEW.karte.auswahl='ZG-001';renderModule()});await p.waitForTimeout(400);
await p.locator('input[data-zp-typ="Seiteneingang"]').check();await p.waitForTimeout(300);
await p.locator('input[data-zp-typ="Lieferbereich"]').check();await p.waitForTimeout(300);
const t=await p.evaluate(()=>zonenEigene(zDef()).find(x=>x.id==='ZG-001').typen);ok(t.join()==='Seiteneingang,Lieferbereich','Mehrfachauswahl der Art: '+t.join());
await p.fill('#zp-notiz','Hinterhof, Rolltor');await p.press('#zp-notiz','Tab');await p.waitForTimeout(300);
ok(await p.evaluate(()=>zonenEigene(zDef()).find(x=>x.id==='ZG-001').notiz==='Hinterhof, Rolltor'),'Notiz gespeichert');
await p.selectOption('#zp-r','100');await p.waitForTimeout(300);
ok(await p.evaluate(()=>zonenEigene(zDef()).find(x=>x.id==='ZG-001').r===100),'Radius 100');
// Lagezone anlegen für Mischauswahl
await p.evaluate(()=>{dispatch({type:'ZONE_ANGELEGT',ll:[52.4815,13.4390]});});await p.waitForTimeout(300);
// Mehrfachauswahl per Modus
await p.evaluate(()=>{VIEW.karte.auswahl=null;VIEW.karte.mehrModus=true;renderModule();zeichneKarte(document.getElementById('k-svg'))});await p.waitForTimeout(500);
const ids=await p.evaluate(()=>[...document.querySelectorAll('#k-svg .k-zone')].map(g=>g.getAttribute('data-id')));console.log('sichtbar',ids.join());
for(const id of ['ZG-001','ZG-002','ZN-001']){await p.evaluate(id=>{const g=document.querySelector('#k-svg .k-zone[data-id="'+id+'"] .k-zone-hit');const o={bubbles:true,shiftKey:true,pointerId:1,button:0,clientX:1,clientY:1};g.dispatchEvent(new PointerEvent('pointerdown',o));g.dispatchEvent(new PointerEvent('pointerup',o))},id);await p.waitForTimeout(200);}
const m=await p.evaluate(()=>VIEW.karte.mehr.slice());console.log('mehr',m);
ok(m.length>=2,'Mehrfachauswahl sammelt Zonen');
ok(await p.evaluate(()=>/Zonen gewählt/.test(document.getElementById('k-auswahl').innerText)),'Mehrfachpanel sichtbar');
await p.screenshot({path:'zp.png'});
// Art ändern
await p.evaluate(()=>{VIEW.karte.mehr=['ZG-001','ZN-001'];karteAuswahlAnzeige()});
await p.click('#mz-zugriff');await p.waitForTimeout(300);
ok(await p.evaluate(()=>zonenEigene(zDef()).find(x=>x.id==='ZN-001').art==='zugriff'),'Lagezone → Zugriffspunkt');
await p.evaluate(()=>{VIEW.karte.mehr=['ZN-001'];karteAuswahlAnzeige()});await p.click('#mz-lage');await p.waitForTimeout(300);
ok(await p.evaluate(()=>{const z=zonenEigene(zDef()).find(x=>x.id==='ZN-001');return z.art==='lage'&&z.r===300||z.art==='lage'}),'Zugriffspunkt → Lagezone');
// Radius für alle
await p.evaluate(()=>{VIEW.karte.mehr=['ZG-001','ZG-002'];karteAuswahlAnzeige()});await p.selectOption('#mz-r','40');await p.waitForTimeout(300);
ok(await p.evaluate(()=>['ZG-001','ZG-002'].every(i=>zonenEigene(zDef()).find(x=>x.id===i).r===40)),'Radius für alle');
// Ereignisse: Zugriffspunkte erzeugen nie Zonenmeldungen
const ev=await p.evaluate(()=>{const zp=zonenEigene(zDef()).find(x=>x.id==='ZG-002');return [dispatch({type:'ZONEN_EREIGNIS',id:'ZG-002'})?'x':'', zp.verlauf?zp.verlauf.length:0]});ok(ev[1]===0,'Zugriffspunkt ohne Zonenereignis');
// Entfernen mit Rückfrage
await p.evaluate(()=>{VIEW.karte.mehr=['ZG-002','ZG-003'];karteAuswahlAnzeige()});await p.click('#mz-weg');await p.waitForTimeout(200);
ok(await p.locator('#mz-weg-ja').count()===1,'Rückfrage vor Entfernen');await p.click('#mz-weg-ja');await p.waitForTimeout(300);
ok(await p.evaluate(()=>!zonenEigene(zDef()).some(x=>x.id==='ZG-002'||x.id==='ZG-003')),'Mehrfach entfernt');
console.log(e.join()||'keine Fehler');await b.close()})();
