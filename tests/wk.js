const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1500,height:1000}})).newPage();const e=[];p.on('pageerror',x=>e.push(x.message));
await p.addInitScript(()=>{window.__ARGUS_ERGEBNIS='direkt'});await p.goto('file:///home/claude/index.html');await p.waitForTimeout(5200);await p.keyboard.press('Space');await p.fill('#gate-pw','pw-test-123');await p.fill('#gate-pw2','pw-test-123');await p.click('#gate-go');
await p.waitForFunction(()=>!document.body.classList.contains('locked'),null,{timeout:20000});
let fail=0;const chk=(ok,t)=>{if(!ok)fail++;console.log((ok?'OK  ':'FAIL')+' '+t)};
await p.evaluate(()=>{dispatch({type:'KENNWORT_SCHALTER',an:false});dispatch({type:'STATUS_GESETZT',status:'Standby'});dispatch({type:'MISSION_ZUGEWIESEN',id:'M1'});dispatch({type:'MISSION_ANGENOMMEN',id:'M1'});dispatch({type:'MISSION_BEGINN_JETZT'});});
const W=await p.evaluate(()=>alleEntitaeten().filter(e=>e.typ!=='Ort').map(e=>e.id+':'+wissen(e)).join(' '));
console.log(W);
const st=await p.evaluate(()=>({frei:pool().filter(e=>wissen(e)==='frei').map(e=>e.id),bek:pool().filter(e=>wissen(e)==='bekannt').map(e=>e.id),unb:alleEntitaeten().filter(e=>wissen(e)==='unbekannt').length}));
console.log(JSON.stringify(st));
chk(st.bek.sort().join()==='P-0002,P-0003,P-9054,P-9063','Schlüsselfiguren bekannt');
chk(st.frei.includes('P-0001'),'P-0001 frei');
// Dossier-Ansicht Liste und Rudiment
await p.evaluate(()=>{STATE.ui.modul='dossier';render()});
await p.evaluate(()=>{dispatch({type:'DOSSIER_GEOEFFNET',id:'P-0002',navigieren:true})});await p.waitForTimeout(300);
let txt=await p.evaluate(()=>document.body.innerText);
console.log(txt.slice(0,1200));
chk(!/P-9051|P-9052|P-9055|P-9058|P-9061|O-9052/.test(txt),'keine unbekannten Kennungen in der Dossieransicht');
chk(!/P-0002/.test(txt.split('\n').filter(l=>!/dl-/.test(l)).join('\n')),'keine P-0002 im sichtbaren Text');
chk(/Rudiment/.test(txt),'Rudiment-Ansicht');
// Dropdown Dokumente / Freigabe
const opt=await p.evaluate(()=>{const o=[];[...document.querySelectorAll('select option')].forEach(x=>o.push(x.textContent));return o.join('|')});
// Handler-Auskunft zu Rudiment
const r1=await p.evaluate(()=>{const r=antwortFuer('handler','Was weißt du über den Kutscher?','Routine','N-9');return r&&r.text});console.log('Handler Rudiment:',r1);
chk(/Rudiment|Eckdaten|Einschätzung/.test(r1)&&!/P-0002/.test(r1),'Handler gibt Rudiment ohne Kennung');
const r2=await p.evaluate(()=>{const r=antwortFuer('handler','Erbitte Informationen zu Murat Aydın','Routine','N-9');return r&&r.text});console.log('Handler unbekannt:',r2);
// Einreichung unvollständig
await p.evaluate(()=>dispatch({type:'INFO_EINGEREICHT',id:'P-0002'}));
let pl=await p.evaluate(()=>STATE.plan.filter(x=>x.typ==='antwort').map(x=>x.text));console.log('Plan1',pl);
chk(pl.some(t=>/Sichtung/.test(t)),'fehlende Sichtung gemeldet');
await p.evaluate(()=>{dispatch({type:'SICHTUNG_HINZU',id:'P-0002',ort:'Sonnenallee 14',text:'Fährt den dunklen Transporter',guete:'gesichert'});});
await p.evaluate(()=>dispatch({type:'INFO_EINGEREICHT',id:'P-0002'}));
pl=await p.evaluate(()=>STATE.plan.filter(x=>x.typ==='antwort').map(x=>x.text));
chk(pl.some(t=>/Einschätzung/.test(t)),'fehlende Einschätzung gemeldet');
await p.evaluate(()=>dispatch({type:'EINSCHAETZUNG_GESETZT',id:'P-0002',quelle:'B',info:'2'}));
await p.evaluate(()=>{STATE.plan=STATE.plan.filter(x=>x.typ!=='antwort')});
await p.evaluate(()=>dispatch({type:'INFO_EINGEREICHT',id:'P-0002'}));
pl=await p.evaluate(()=>STATE.plan.filter(x=>x.typ==='antwort').map(x=>({t:x.text,f:x.infoFrei})));console.log('Plan2',JSON.stringify(pl));
chk(pl.length===2&&pl.some(x=>x.f==='P-0002'),'Ack und Freigabe geplant');
chk(await p.evaluate(()=>wissen(entitaet('P-0002')))==='bekannt','vor Prüfung noch bekannt');
for(let i=0;i<10;i++){await p.evaluate(()=>{STATE.plan.filter(x=>x.typ==='antwort').forEach(x=>{x.faelligAm=new Date(Date.now()-1000).toISOString()});});await p.waitForTimeout(600);if(await p.evaluate(()=>wissen(entitaet('P-0002')))==='frei')break;}
chk(await p.evaluate(()=>wissen(entitaet('P-0002')))==='frei','P-0002 frei nach Prüfung');
const kette=await p.evaluate(()=>['P-9063','L-9058'].concat(['P-9053','O-9051']).map(i=>i+':'+wissen(entitaet(i))));console.log(kette.join(' '));
const msgs=await p.evaluate(()=>STATE.komm.kanaele.handler.nachrichten.filter(m=>m.von==='gegenstelle').slice(-3).map(m=>m.text));console.log(msgs);
// Kette Freigabe P-0003 -> P-9053, O-9051 bekannt
await p.evaluate(()=>{dispatch({type:'SICHTUNG_HINZU',id:'P-0003',ort:'Hof',text:'Tritt nicht selbst auf, Mittelsmann',guete:'plausibel'});dispatch({type:'EINSCHAETZUNG_GESETZT',id:'P-0003',quelle:'C',info:'3'});dispatch({type:'INFO_EINGEREICHT',id:'P-0003'})});
for(let i=0;i<10;i++){await p.evaluate(()=>{STATE.plan.filter(x=>x.typ==='antwort').forEach(x=>{x.faelligAm=new Date(Date.now()-1000).toISOString()});});await p.waitForTimeout(600);if(await p.evaluate(()=>wissen(entitaet('P-0003')))==='frei')break;}
console.log(await p.evaluate(()=>['P-0003','P-9053','O-9051','P-9051'].map(i=>i+':'+wissen(entitaet(i))).join(' ')));
chk(await p.evaluate(()=>wissen(entitaet('P-9053')))==='bekannt'&&await p.evaluate(()=>wissen(entitaet('O-9051')))==='bekannt','Kette: Umfeld wird bekannt');
// freies Dossier zeigt Verbindungen, bekannte nur mit Namen
await p.evaluate(()=>oeffneDossier('P-0003'));await p.waitForTimeout(300);
txt=await p.evaluate(()=>document.body.innerText);
chk(/Petrenko|Havelstahl/.test(txt)&&!/P-9053|O-9051/.test(txt.replace(/dl-/g,'')),'Verbindungen zu Bekannten nur mit Namen');
// Chat-Pfad
await p.evaluate(()=>{dispatch({type:'NACHRICHT_GESENDET',kanal:'handler',text:'Reiche meine Einschätzung zu Petrenko ein',dringlichkeit:'Routine'})});
console.log('Fehler:',e.join()||'keine','| Fehlschläge:',fail);await b.close()})();
