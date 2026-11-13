const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1500,height:1000}});const p=await ctx.newPage();const e=[];p.on('pageerror',x=>e.push(x.message));
const reqs=[];p.on('request',r=>{if(/cartocdn/.test(r.url()))reqs.push(r.url())});
await p.goto('file:///home/claude/index.html');await p.waitForTimeout(5200);await p.keyboard.press('Space');await p.fill('#gate-pw','pw-test-123');await p.fill('#gate-pw2','pw-test-123');await p.click('#gate-go');
await p.waitForFunction(()=>!document.body.classList.contains('locked'),null,{timeout:20000});
await p.evaluate(()=>{dispatch({type:'KENNWORT_SCHALTER',an:false});dispatch({type:'STATUS_GESETZT',status:'Standby'});dispatch({type:'MISSION_ZUGEWIESEN',id:'M1'});dispatch({type:'MISSION_ANGENOMMEN',id:'M1'});dispatch({type:'MISSION_BEGINN_JETZT'});dispatch({type:'NAVIGATION',modul:'karte'});});
let fail=0;const chk=(ok,t)=>{if(!ok)fail++;console.log((ok?'OK  ':'FAIL')+' '+t)};
await p.waitForTimeout(800);
chk(await p.evaluate(()=>VIEW.karte.anbieter==='carto'&&VIEW.karte.ebenen.kacheln&&!!VIEW.karte.cartoKey),'Schlüssel aus Datei übernommen');
// Fokus auf S-02
await p.evaluate(()=>{VIEW.karte.lat=52.4738;VIEW.karte.lon=13.4515;VIEW.karte.zoom=14;renderModule()});await p.waitForTimeout(2500);
chk(reqs.length>0&&reqs.every(u=>/key=cb1_/.test(u)),'CARTO-Anfragen mit Schlüssel: '+reqs.length);
chk(await p.evaluate(()=>document.querySelectorAll('.k-zone.auto').length)>=1,'Auto-Zonen sichtbar');
console.log(await p.evaluate(()=>[...document.querySelectorAll('.k-zone-t')].map(t=>t.textContent).join(' | ')));
await p.screenshot({path:'zn_a.png'});
// Klick auf Ring S-02
const zs=await p.evaluate(()=>{const c=document.querySelector('.k-zone[data-id="ZA-S-02"] .k-zone-hit');const r=c.getBoundingClientRect();return [r.left+r.width/2,r.top+2]});
await p.mouse.click(zs[0],zs[1]);await p.waitForTimeout(400);
chk(await p.evaluate(()=>!$('k-auswahl').hidden&&/Lagezone S-02/.test($('k-auswahl').innerText)),'Popup Auto-Zone');
console.log((await p.evaluate(()=>$('k-auswahl').innerText)).replace(/\n+/g,' / '));
// eigene Zone
await p.keyboard.press('Escape');
await p.evaluate(()=>{karteWaehlen(null,false)});
await p.click('#k-zone-neu');await p.waitForTimeout(200);
const box=await p.evaluate(()=>{const r=$('k-svg').getBoundingClientRect();return [r.left+r.width*0.5,r.top+r.height*0.5]});
await p.mouse.click(box[0],box[1]);await p.waitForTimeout(600);
chk(await p.evaluate(()=>/ZN-001/.test($('k-auswahl').innerText)),'eigene Zone angelegt, Popup offen');
chk(await p.evaluate(()=>$('zn-melden').disabled),'Melden gesperrt bei unauffällig');
await p.selectOption('#zn-wertung','leicht');await p.waitForTimeout(500);
const info=await p.evaluate(()=>$('k-auswahl').innerText.replace(/\n+/g,' / '));console.log(info);
await p.screenshot({path:'zn_b.png'});
chk(await p.evaluate(()=>!$('zn-melden').disabled),'Melden frei mit Standortbezug');
await p.click('#zn-melden');await p.waitForTimeout(400);
let last=await p.evaluate(()=>STATE.komm.kanaele.handler.nachrichten.slice(-1)[0].text);console.log(last);
chk(await p.evaluate(l=>SCENARIO.zonen.meldung.leicht.some(x=>l.indexOf(x)>=0),last),'Meldetext leicht (eine der Formulierungen)');
chk(await p.evaluate(()=>$('k-auswahl').hidden||!$('zn-melden')),'Fenster schließt nach "Handler informieren"');
chk(await p.evaluate(()=>/gemeldet/.test($('sys-msg').textContent)),'Kurzbestätigung in der Statuszeile');
await p.evaluate(()=>{STATE.plan.forEach(x=>{x.faelligAm=new Date(Date.now()-1000).toISOString()})});await p.waitForTimeout(2500);
console.log('handler:',await p.evaluate(()=>STATE.komm.kanaele.handler.nachrichten.slice(-2).map(m=>m.von+': '+m.text)));
console.log('asset:',await p.evaluate(()=>STATE.komm.kanaele.asset.nachrichten.slice(-2).map(m=>m.von+': '+m.text)));
chk(await p.evaluate(()=>STATE.komm.kanaele.asset.nachrichten.some(m=>m.von==='gegenstelle'&&/Ruhig|ruhig|nichts|Wagen|Unruhe/.test(m.text))),'Asset bestätigt');
// akut
await p.evaluate(()=>{karteWaehlen('ZN-001',false)});await p.waitForTimeout(300);
await p.selectOption('#zn-wertung','akut');await p.waitForTimeout(500);await p.click('#zn-melden');await p.waitForTimeout(400);
last=await p.evaluate(()=>STATE.komm.kanaele.handler.nachrichten.slice(-1)[0].text);console.log(last);
chk(await p.evaluate(l=>SCENARIO.zonen.meldung.akut.some(x=>l.indexOf(x)>=0),last),'Meldetext akut (eine der Formulierungen)');
await p.evaluate(()=>{STATE.plan.forEach(x=>{x.faelligAm=new Date(Date.now()-1000).toISOString()})});await p.waitForTimeout(2000);
console.log('handler:',await p.evaluate(()=>STATE.komm.kanaele.handler.nachrichten.slice(-1)[0].text));
// Zone ohne Zielperson (Wald)
await p.evaluate(()=>{dispatch({type:'ZONE_ANGELEGT',ll:[52.60,13.10]});dispatch({type:'ZONE_GEAENDERT',id:'ZN-002',wertung:'akut'});karteWaehlen('ZN-002',false)});await p.waitForTimeout(400);
chk(await p.evaluate(()=>!$('zn-melden').disabled),'ohne Bezug jetzt möglich');
// Chat-Pfad
await p.evaluate(()=>{const o=[];nachrichtSenden(kanalDef('handler'),'Zone ZN-002: Bereich akut bedroht','Routine',o)});
await p.evaluate(()=>{STATE.plan.forEach(x=>{x.faelligAm=new Date(Date.now()-1000).toISOString()})});await p.waitForTimeout(2000);
console.log('handler:',await p.evaluate(()=>STATE.komm.kanaele.handler.nachrichten.slice(-1)[0].text));
// Entfernen
await p.evaluate(()=>{karteWaehlen('ZN-002',false)});await p.waitForTimeout(300);await p.evaluate(()=>$('zn-weg').click());await p.waitForTimeout(300);
chk(await p.evaluate(()=>!karteZoneFinden('ZN-002')),'Zone entfernt');
// Statusbox
chk(await p.evaluate(()=>$('k-status').innerText.length<80),'Statusbox kompakt');
// Zielperson toggle
await p.evaluate(()=>dispatch({type:'ZIELPERSON_GESETZT',id:'P-0002',an:false}));
chk(await p.evaluate(()=>zielpersonenListe().indexOf('P-0002')<0),'Zielperson entfernt');
console.log('Fehler:',e.join()||'keine','| Fehlschläge:',fail);await b.close()})();
