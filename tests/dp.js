const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1500,height:1000}})).newPage();const e=[];p.on('pageerror',x=>e.push(x.message));
await p.addInitScript(()=>{window.__ARGUS_ERGEBNIS='direkt'});
await p.goto('file:///home/claude/index.html');await p.waitForTimeout(5200);await p.keyboard.press('Space');await p.fill('#gate-pw','pw-test-123');await p.fill('#gate-pw2','pw-test-123');await p.click('#gate-go');
await p.waitForFunction(()=>!document.body.classList.contains('locked'),null,{timeout:20000});
await p.evaluate(()=>{dispatch({type:'KENNWORT_SCHALTER',an:false});dispatch({type:'STATUS_GESETZT',status:'Standby'});dispatch({type:'MISSION_ZUGEWIESEN',id:'M1'});dispatch({type:'MISSION_ANGENOMMEN',id:'M1'});MS('M1').beginn=new Date(Date.now()-60000).toISOString();});
let fail=0;const chk=(ok,t)=>{if(!ok)fail++;console.log((ok?'OK  ':'FAIL')+' '+t)};
const due=async(n=3)=>{for(let i=0;i<n;i++){await p.evaluate(()=>{STATE.plan.forEach(x=>{x.faelligAm=new Date(Date.now()-1000).toISOString()})});await p.waitForTimeout(1500)}};
const last=(k,n=1)=>p.evaluate(([k,n])=>STATE.komm.kanaele[k].nachrichten.slice(-n).map(m=>m.text),[k,n]);
const send=(t,k='handler')=>p.evaluate(([t,k])=>dispatch({type:'NACHRICHT_GESENDET',kanal:k,text:t,dringlichkeit:'Routine'}),[t,k]);
const pid=await p.evaluate(()=>{const e=pool().find(x=>x.typ==='Person'&&wissen(x)==='frei')||pool().find(x=>x.typ==='Person');return e.id});
// 1. DISPO je Art
for(const art of ['Chatverlauf','Frachtbrief','Kontoauszug','Lieferschein','Foto eines Dokuments','Sonstiges']){
  await p.evaluate(([pid,art])=>dispatch({type:'DOKUMENT_EINGEREICHT',id:'DK-'+Math.floor(Math.random()*9999),entitaet:pid,art:art,notiz:'',name:'x.pdf',groesse:1000,typ:'application/pdf',leise:true}),[pid,art]);
  await due(4);
  const l=await last('support',2);
  const ok=/Sichtung|sichten/i.test(l[0])&&new RegExp(art==='Foto eines Dokuments'?'Foto|Dokument':art==='Sonstiges'?'Dokument':art,'i').test(l[1]);
  console.log('   '+art+' -> '+l.join(' || ').slice(0,260));chk(ok,'DISPO: Eingang + artspezifisches Ergebnis ('+art+')');
}
// 2. Button und Abweichung
await p.evaluate(()=>{dispatch({type:'NAVIGATION',modul:'komm'});STATE.komm.aktiv='support';render()});await p.waitForTimeout(400);
const mid=await p.evaluate(()=>{const m=STATE.komm.kanaele.support.nachrichten.filter(x=>/informieren/.test(x.text)).pop();return m&&m.id});
chk(!!mid&&await p.locator('#ab-'+mid).count()===1,'Knopf "Abweichende Einschätzung an Handler" bei passender DISPO-Meldung');
await p.click('#ab-'+mid);await p.waitForTimeout(400);
chk(await p.evaluate(()=>STATE.komm.aktiv==='handler'&&/weicht von der Prüfung/.test(VIEW.draft['km-handler']||'')),'Knopf öffnet Handlerkanal mit Entwurf');
const nS=await p.evaluate(()=>STATE.komm.kanaele.support.nachrichten.length);
await send('Zu '+pid+': Meine Einschätzung des Dokuments weicht ab, der Chatverlauf wirkt bearbeitet.');await due(5);
const hb=(await last('handler',1))[0];console.log('   '+hb);chk(/Abweichung|zweite|zweiten|erneut|noch einmal/i.test(hb),'ARGUS nimmt die Abweichung auf');
chk(await p.evaluate(n=>STATE.komm.kanaele.support.nachrichten.length>=n+2,nS),'DISPO meldet zweite Durchsicht und Ergebnis');
// 3. Rückfrage über Chat und Formular
const rid=await p.evaluate(()=>{const e=pool().find(x=>x.typ==='Person'&&wissen(x)==='bekannt');if(!e)return null;IZ()[e.id]=IZ()[e.id]||{status:'bekannt'};IZ()[e.id].rueckfrage=nowIso();return e.id});
console.log('Rudiment für Rückfrage:',rid);
if(rid){
 await p.evaluate(id=>{STATE.ui.modul='dossier';render()},rid);
 const wk=await p.evaluate(id=>{const e=entitaet(id);return {bild:!!(e.bild||PROFIL.bilder[e.id])}},rid);
 await send('Das Foto stammt aus einer öffentlich zugänglichen Quelle im Netz, ich halte es für belastbar.');await due(4);
 chk(await p.evaluate(id=>!IZ()[id].rueckfrage,rid),'Antwort im Chat beantwortet die Rückfrage');
}
// 4. Wissensstandtext
const wt=await p.evaluate(()=>{const e=pool().find(x=>x.typ==='Person'&&wissen(x)==='bekannt');if(!e)return null;dispatch({type:'DOSSIER_GEWAEHLT',id:e.id});return e.id});
await p.waitForTimeout(300);
chk(await p.evaluate(()=>!/Lichtbild und Standort sind bekannt/.test(document.body.innerText)),'Wissensstand ohne pauschale Behauptung');
// 5. Text ändern
await p.evaluate(()=>{dispatch({type:'NAVIGATION',modul:'komm'});STATE.komm.aktiv='handler';render()});await p.waitForTimeout(300);
const m1=await p.evaluate(()=>{const m=STATE.komm.kanaele.handler.nachrichten.find(x=>x.von==='gegenstelle'&&!x.art);return m&&{id:m.id,text:m.text}});
chk(!!m1&&await p.locator('#tx-'+m1.id).count()===1,'Knopf "Text ändern" sichtbar');
await p.evaluate(m=>dispatch({type:'NACHRICHT_TEXT_GEAENDERT',msgId:m.id,text:'ERSATZ: '+m.text}),m1);
chk(await p.evaluate(id=>/^ERSATZ/.test(nachricht(id).msg.text)&&!!nachricht(id).msg.original,m1.id),'Text wird angepasst');
const neu=await p.evaluate(t=>{const m=eingang('handler',{von:'gegenstelle',absender:'ARGUS',text:t});return m.text},m1.text);
chk(/^ERSATZ/.test(neu),'Künftige Nachricht mit gleichem Wortlaut nutzt den eigenen Text');
chk(await p.evaluate(()=>ERK.liste.some(x=>x.grund==='Text geändert')),'Änderung im Erkennungsprotokoll');
await p.evaluate(m=>dispatch({type:'NACHRICHT_TEXT_GEAENDERT',msgId:m.id,text:m.text}),m1);
chk(await p.evaluate(t=>!PROFIL.tausch[t],m1.text),'Original wiederherstellbar');
// 6. Zonenantworten ohne Asset
await p.evaluate(()=>{dispatch({type:'ZONE_ANGELEGT',ll:[52.60,13.10]});dispatch({type:'ZONE_GEAENDERT',id:'ZN-001',wertung:'leicht'})});
await send('Zone ZN-001 „Zone 1“: Bereich angespannt, bitte um eine kurze Einschätzung von dir.');await due(5);
const zb=(await last('handler',3)).join(' | ');console.log('   '+zb);
chk(!/Verstärkung|Sichtung ein|wäre der Weg/.test(zb),'Zonenantwort ohne Zwang zu Asset oder Verstärkung');
console.log(e.join('\n')||'keine Seitenfehler');console.log(fail?'FEHLER: '+fail:'ALLE OK');await b.close()})();
