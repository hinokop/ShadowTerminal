const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1500,height:1000}})).newPage();const e=[];p.on('pageerror',x=>e.push(x.message));
await p.addInitScript(()=>{window.__ARGUS_ERGEBNIS='direkt'});
await p.goto(require('./_pfad.js').APP);await p.waitForTimeout(5200);await p.keyboard.press('Space');await p.fill('#gate-pw','pw-test-123');await p.fill('#gate-pw2','pw-test-123');await p.click('#gate-go');
await p.waitForFunction(()=>!document.body.classList.contains('locked'),null,{timeout:20000});
await p.evaluate(()=>{dispatch({type:'KENNWORT_SCHALTER',an:false});dispatch({type:'STATUS_GESETZT',status:'Standby'});dispatch({type:'MISSION_ZUGEWIESEN',id:'M1'});dispatch({type:'MISSION_ANGENOMMEN',id:'M1'});dispatch({type:'MISSION_BEGINN_JETZT'});});
let fail=0;const chk=(ok,t)=>{if(!ok)fail++;console.log((ok?'OK  ':'FAIL')+' '+t)};
const due=async(n=3)=>{for(let i=0;i<n;i++){await p.evaluate(()=>{STATE.plan.forEach(x=>{x.faelligAm=new Date(Date.now()-1000).toISOString()})});await p.waitForTimeout(1800)}};
const last=(k,n=3)=>p.evaluate(([k,n])=>STATE.komm.kanaele[k].nachrichten.slice(-n).map(m=>m.text),[k,n]);
const send=(t,k='handler')=>p.evaluate(([t,k])=>dispatch({type:'NACHRICHT_GESENDET',kanal:k,text:t,dringlichkeit:'Routine'}),[t,k]);
// --- Neumann
const nm=await p.evaluate(()=>{const def=LM();const i=def.skript.findIndex(s=>s.nennt);const v0=wissen(entitaet('P-0015'));const out=[];sendeSkript(def,i,out);return {v0,v1:wissen(entitaet('P-0015')),log:out.map(o=>o.aktion)}});
console.log(JSON.stringify(nm));
chk(nm.v0==='unbekannt'&&nm.v1==='bekannt'&&nm.log.indexOf('Neue Person im Umfeld bekannt')>=0,'Skriptnennung "Neumann": Dossier wird als Rudiment bekannt');
// --- Wie viele Kisten
await p.evaluate(()=>dispatch({type:'NACHRICHT_EINGESPIELT',kanal:'asset',text:'Heute Abend standen zwei Transporter im Hof. Beim zweiten war die Plane neu. Die Kisten sind schwerer als normale Ersatzteile.',lagerelevant:false,dringlichkeit:'Routine'}));
await send('Wie viele Kisten?','asset');await due(4);
const ak=(await last('asset',4)).join(' | ');console.log(ak);
chk(/Zahl|gezählt/i.test(ak)&&!/Öfter, als man denkt/.test(ak),'"Wie viele Kisten?": passende Antwort (Zahl, nicht Häufigkeit)');
await p.evaluate(()=>dispatch({type:'NACHRICHT_EINGESPIELT',kanal:'asset',text:'Der Wagen kommt jeden Abend gegen zehn und fährt kurz nach Mitternacht wieder weg.',lagerelevant:false,dringlichkeit:'Routine'}));
await send('Wie oft?','asset');await due(4);
const ao=(await last('asset',3)).join(' | ');console.log(ao);
chk(/Mehr als einmal|Öfter|Genau weiß es keiner/.test(ao),'"Wie oft?": Häufigkeitsantwort bleibt');
// --- Zonenbericht
const S=await p.evaluate(()=>{
  const sz=karteKoord(Object.keys(STATE.dossiers.entitaeten)[0]);
  dispatch({type:'DOSSIER_ANGELEGT',typ:'Person',name:'Testperson Alpha',ll:[52.4817,13.4352]});dispatch({type:'DOSSIER_ANGELEGT',typ:'Person',name:'Testperson Beta',ll:[52.4818,13.4353]});
  const ids=(STATE.dossiers.eigene||[]).slice(-2).map(x=>x.id);ids.forEach((i,k)=>{PROFIL.koord[i]=[52.4817+k*0.0001,13.4352]});
  dispatch({type:'ZIELPERSON_GESETZT',id:ids[0],an:true});
  dispatch({type:'SICHTUNG_HINZU',id:ids[0],ort:'Hof',text:'Alpha am Hof gesehen',guete:'gesichert',quelle:'Eintrag'});
  STATE.dossiers.entitaeten[ids[0]].sichtungen[0].t=new Date(Date.now()-5*3600000).toISOString();
  dispatch({type:'ZONE_ANGELEGT',ll:[52.4817,13.4352]});dispatch({type:'ZONE_GEAENDERT',id:'ZN-001',wertung:'leicht',r:150});
  const zn=karteZoneFinden('ZN-001');
  // unbekannte Person in die Zone legen
  const unb=poolAlle().find(e=>e.typ==='Person'&&wissen(e)==='unbekannt'&&e.id!=='P-0015');PROFIL.koord[unb.id]=[52.4817,13.4352];
  return {ids,unb:unb.id,unbName:unb.name,zr:zoneBericht(zn,1)};});
console.log(JSON.stringify(S).slice(0,900));
chk(S.zr.anzahl===2,'Bericht: zwei bekannte (eigene) Personen im Bereich');
chk(!new RegExp(S.unbName.split(' ').slice(-1)[0]).test(S.zr.text),'Unbekannte Person wird nicht namentlich genannt');
chk(/weitere Person/.test(S.zr.text),'Unbekannte nur als Anzahl');
chk(/Zielperson/.test(S.zr.text),'Zielperson gekennzeichnet');
await send('Zone ZN-001 „Zone 1“: Bereich leicht gefährdet, bitte um kurze Bestätigung durch Asset.');await due(5);
const hb=(await last('handler',6)).join(' || ');console.log(hb);
chk(/Testperson Alpha/.test(hb)&&/Testperson Beta/.test(hb),'ARGUS nennt beide Personen');
chk(/Ist die Person noch im Bereich\?|Ist die Person tatsächlich vor Ort\?/.test(hb),'ARGUS stellt Rückfrage');
chk(await p.evaluate(()=>!!zoneRueckS()),'Rückfrage-Zustand gesetzt');
// Antworten
await send('Nein, ist abgereist.');await due(4);
let r1=(await last('handler',3)).join(' || ');console.log(r1);
chk(await p.evaluate(()=>{const z=zonenEigene(zDef())[0];return z.abwesend&&Object.keys(z.abwesend).length===1}),'Antwort "nein": Person aus Zonenlage genommen');
chk(await p.evaluate(()=>zoneLage(karteZoneFinden('ZN-001')).personen.length===1),'Zonenlage zählt nur noch eine Person');
await send('Ja, noch da.');await due(4);
let r2=(await last('handler',3)).join(' || ');console.log(r2);

chk(/bleibt es offen/.test(r2)&&await p.evaluate(()=>!zoneRueckS()),'Bloßes "Ja" auf Frage nach Unbekannten: bleibt offen, keine Notiz');
chk(await p.evaluate(()=>((zonenEigene(zDef())[0].notizen)||[]).length===0),'Keine Notiz aus bloßer Bestätigung');
await p.evaluate(()=>{STATE.zoneRueck={zone:'ZN-001',t:nowIso(),offen:[{typ:'unbekannt'}]}});
await send('Zwei Männer in dunkler Jacke am Eingang.');await due(4);
let r3=(await last('handler',2)).join(' || ');console.log(r3);
chk(/Notiert/.test(r3),'Beschreibung wird notiert');
chk(await p.evaluate(()=>((zonenEigene(zDef())[0].notizen)||[]).length===1&&!zoneRueckS()),'Notiz an Zone gespeichert, Rückfragen erledigt');
// normale Frage wird nicht verschluckt
await p.evaluate(()=>{STATE.zoneRueck={zone:'ZN-001',t:nowIso(),offen:[{typ:'unbekannt'}]}});
await send('Wie sieht mein Abdruck aus?');await due(3);
chk((await last('handler',2)).join(' ').indexOf('Legende')>=0,'Normale Frage mit "?" wird nicht als Antwort verschluckt');
console.log(e.join('\n')||'keine Seitenfehler');console.log(fail?'FEHLER: '+fail:'ALLE OK');await b.close()})();
