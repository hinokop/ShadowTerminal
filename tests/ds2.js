const {chromium}=require('playwright');const fs=require('fs');
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1500,height:1100}})).newPage();const e=[];p.on('pageerror',x=>e.push(x.message));
await p.goto(require('./_pfad.js').APP);await p.waitForTimeout(5200);await p.keyboard.press('Space');await p.fill('#gate-pw','pw-test-123');await p.fill('#gate-pw2','pw-test-123');await p.click('#gate-go');
await p.waitForFunction(()=>!document.body.classList.contains('locked'),null,{timeout:20000});
await p.evaluate(()=>{dispatch({type:'KENNWORT_SCHALTER',an:false});dispatch({type:'STATUS_GESETZT',status:'Standby'});dispatch({type:'MISSION_ZUGEWIESEN',id:'M1'});dispatch({type:'MISSION_ANGENOMMEN',id:'M1'});dispatch({type:'MISSION_BEGINN_JETZT'});});
let fail=0;const chk=(ok,t)=>{if(!ok)fail++;console.log((ok?'OK  ':'FAIL')+' '+t)};
const ids=await p.evaluate(()=>pool().filter(e=>wissen(e)==='bekannt').map(e=>e.id));console.log('bekannt:',ids.join());
const id=ids[0];
await p.evaluate(i=>{VIEW.dtab='info';dispatch({type:'DOSSIER_GEOEFFNET',id:i,ueber:'t',navigieren:true})},id);await p.waitForTimeout(500);
await p.screenshot({path:'ds2_a.png'});
const txt=await p.evaluate(()=>document.body.innerText);
chk(/letzter bekannter standort/i.test(txt),'Standort sichtbar');chk(!!(await p.$('.foto')),'Fotofeld da');
chk(/Art der Quelle/.test(txt)&&/Zuverlässigkeit/.test(txt),'Quellenformular');
// Formular ohne Text
await p.click('#btn-eq');await p.waitForTimeout(300);
chk(await p.evaluate(i=>!(IZ()[i]||{}).einschaetzung,id),'ohne Quelle nicht gespeichert');
await p.selectOption('#sel-ea','Asset vor Ort');await p.fill('#eq-text','KIEBITZ, Beobachtung am Hof');await p.selectOption('#sel-eq','B');await p.selectOption('#sel-ei','2');await p.click('#btn-eq');await p.waitForTimeout(400);
chk(await p.evaluate(i=>{const x=IZ()[i].einschaetzung;return x&&x.quelleArt==='Asset vor Ort'&&x.quelleText.includes('KIEBITZ')&&x.quelle==='B'},id),'Einschätzung mit Quelle gespeichert');
// einreichen ohne Beleg
await p.click('#btn-einreichen');await p.waitForTimeout(400);
chk(await p.evaluate(i=>!(IZ()[i]||{}).eingereicht,id),'ohne Beleg nicht eingereicht');
// Upload
fs.writeFileSync('beleg.png',Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==','base64'));
await p.setInputFiles('#rb-datei','beleg.png');await p.fill('#rb-notiz','Foto vom Hof');await p.click('#btn-beleg');await p.waitForTimeout(800);
chk(await p.evaluate(i=>dossierBelege(entitaet(i)).length===1,id),'Beleg gespeichert');
chk(await p.evaluate(i=>einreichPruefung(entitaet(i)).ok,id),'Prüfung ok mit Dokument statt Sichtung');
await p.screenshot({path:'ds2_b.png'});
// Ausgang rueck
await p.evaluate(()=>{window.__ARGUS_ERGEBNIS='rueck'});
await p.click('#btn-einreichen');await p.waitForTimeout(400);
chk(await p.evaluate(i=>!!IZ()[i].rueckfrage,id),'Rückfrage gesetzt');
chk(await p.evaluate(()=>STATE.plan.filter(x=>x.infoFrei).length===0),'noch keine Freigabe geplant');
await p.evaluate(()=>{STATE.plan.forEach(x=>{x.faelligAm=new Date(Date.now()-1000).toISOString()})});await p.waitForTimeout(1500);
await p.evaluate(i=>{{STATE.dossiers.auswahl=null;dispatch({type:'DOSSIER_GEOEFFNET',id:i,ueber:'t',navigieren:true})}},id);await p.waitForTimeout(300);
chk(!!(await p.$('#btn-rf')),'Antwortfeld sichtbar');
await p.fill('#rf-text','zu kurz');await p.click('#btn-rf');await p.waitForTimeout(300);
chk(await p.evaluate(i=>!!IZ()[i].rueckfrage,id),'kurze Antwort genügt nicht');
await p.evaluate(()=>{STATE.plan.forEach(x=>{x.faelligAm=new Date(Date.now()-1000).toISOString()})});await p.waitForTimeout(1200);
await p.evaluate(i=>{{STATE.dossiers.auswahl=null;dispatch({type:'DOSSIER_GEOEFFNET',id:i,ueber:'t',navigieren:true})}},id);await p.waitForTimeout(300);
await p.fill('#rf-text','Das Foto stammt vom Asset, am Hof aufgenommen, Zeitstempel passt.');await p.click('#btn-rf');await p.waitForTimeout(300);
chk(await p.evaluate(i=>!IZ()[i].rueckfrage,id),'Rückfrage beantwortet');
chk(await p.evaluate(()=>STATE.plan.filter(x=>x.infoFrei).length===1),'Freigabe geplant nach Antwort');
await p.evaluate(()=>{STATE.plan.forEach(x=>{x.faelligAm=new Date(Date.now()-1000).toISOString()})});await p.waitForTimeout(1500);
chk(await p.evaluate(i=>wissen(entitaet(i)),id)==='frei','frei nach Rückfrage');
const m=await p.evaluate(()=>STATE.komm.kanaele.handler.nachrichten.filter(m=>m.von==='gegenstelle').slice(-6).map(m=>m.text));console.log(m);
// Ausgang denken in zweitem Dossier (Chat-Rückfrage)
const id2=ids[1];
if(id2){await p.evaluate(([i])=>{window.__ARGUS_ERGEBNIS='denken';dispatch({type:'SICHTUNG_HINZU',id:i,ort:'Hof Neukölln',text:'Person am Hof gesehen',guete:'gesichert'});dispatch({type:'EINSCHAETZUNG_GESETZT',id:i,quelle:'C',info:'3',quelleArt:'Eigene Beobachtung',quelleText:'eigene Sicht'});dispatch({type:'INFO_EINGEREICHT',id:i});},[id2]);await p.waitForTimeout(300);
 const pl=await p.evaluate(()=>STATE.plan.filter(x=>x.infoFrei).map(x=>Date.parse(x.faelligAm)-Date.now()));console.log('denken plan ms',pl);chk(pl.length===1&&pl[0]>60000,'zweite Durchsicht verzögert');}
await p.screenshot({path:'ds2_c.png'});
console.log('Fehler:',e.join()||'keine','| Fehlschläge:',fail);await b.close()})();
