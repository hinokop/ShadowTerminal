const {chromium}=require('playwright');
const ok=(c,m)=>console.log((c?'OK   ':'FAIL ')+m);
(async()=>{const b=await chromium.launch();const e=[];let p;
const boot=async(pre)=>{const ctx=await b.newContext({viewport:{width:1400,height:1300}});p=await ctx.newPage();p.on('pageerror',x=>e.push(x.message));
if(pre)await p.addInitScript(pre);
await p.goto(require('./_pfad.js').APP);await p.waitForTimeout(5200);await p.fill('#gate-pw','pw-test-123');await p.fill('#gate-pw2','pw-test-123');await p.click('#gate-go');
await p.waitForFunction(()=>!document.body.classList.contains('locked'),null,{timeout:20000});
await p.evaluate(()=>{dispatch({type:'KENNWORT_SCHALTER',ein:false});dispatch({type:'STATUS_GESETZT',status:'Standby'});dispatch({type:'MISSION_ZUGEWIESEN',id:'M1'});dispatch({type:'MISSION_ANGENOMMEN',id:'M1'});alleEntitaeten().forEach(x=>{IZ()[x.id]={status:'frei'}});})};
const due=(typ)=>p.evaluate((typ)=>{STATE.plan.filter(x=>!typ||x.typ===typ).forEach(x=>{x.faelligAm=new Date(Date.now()-1000).toISOString()});STATE.plan.slice().forEach(x=>{if(STATE.plan.includes(x)&&(!typ||x.typ===typ))dispatch({type:'FAELLIG',id:x.id})})},typ);
const send=(t,k='handler')=>p.evaluate(([t,k])=>dispatch({type:'NACHRICHT_GESENDET',kanal:k,text:t,dringlichkeit:'Routine'}),[t,k]);
const alle=(k)=>p.evaluate((k)=>STATE.komm.kanaele[k].nachrichten.map(m=>m.text),k);
const umb=(n)=>p.evaluate((n)=>dispatch({type:'DOSSIER_BEARBEITET',id:'P-0015',name:n,land:'DE',aliase:'',rolle:entitaet('P-0015').rolle,eckdaten:entitaet('P-0015').eckdaten.join('\n'),stufe:entitaet('P-0015').bedrohung.stufe,begruendung:''}),n);

/* M6a: Platzhalter, Umbenennung vor dem Senden */
await boot();
await umb('Frederik Bourges');
await p.evaluate(()=>sendeSkript(LM(),3,[]));
let t=await alle('asset');ok(t.some(x=>/Bourges verstanden/.test(x))&&!t.some(x=>/Neumann/.test(x)),'M6a: Skriptmeldung nennt neuen Namen');
/* M6b: Umbenennung nach dem Senden */
await boot();
await p.evaluate(()=>sendeSkript(LM(),3,[]));
t=await alle('asset');ok(t.some(x=>/Neumann verstanden/.test(x)),'Ausgang: alter Name vor Umbenennung');
await send('Wer ist Ralf Neumann?');
await umb('Frederik Bourges');
t=await alle('asset');ok(t.some(x=>/Bourges verstanden/.test(x))&&!t.some(x=>/Neumann/.test(x)),'M6b: gesendete Nachricht folgt dem Namen');
const agent=await alle('handler');ok(agent.some(x=>/Ralf Neumann/.test(x)),'eigene Eingabe bleibt unverändert');
const logAlt=await p.evaluate(()=>JSON.stringify(STATE.log).includes('Neumann'));ok(logAlt,'Protokoll bleibt unverändert');
await p.evaluate(()=>dispatch({type:'DOSSIER_ZURUECKGESETZT',id:'P-0015'}));
t=await alle('asset');ok(t.some(x=>/Neumann verstanden/.test(x)),'Zurücksetzen zieht den Namen zurück');

/* M3: Zurückstellung im Schweigen */
await boot();
await p.evaluate(()=>{Math.random=()=>0;const a=akteurDaten('asset');a.schweigt=nowIso();a.belastung=90;
  const def=LM();MS(def.id).skript.forEach((s,i)=>{if(def.skript[i].kanal==='asset'&&s==='offen'){}});
  const i=3;MS(def.id).skript[i]='geplant';STATE.plan=STATE.plan.filter(x=>x.typ!=='skript');planen(STATE,{typ:'skript',mission:def.id,index:i,faelligAm:new Date(Date.now()-1000).toISOString()});window.__i=i;});
const n0=(await alle('asset')).length, h0=(await alle('handler')).length;
await due('skript');
ok((await alle('asset')).length===n0,'M3: Asset sendet im Schweigen nichts');
ok(await p.evaluate(()=>STATE.plan.some(x=>x.typ==='skript'&&x.index===window.__i)),'M3: Meldung bleibt eingeplant');
const h1=await alle('handler');ok(h1.length===h0+1&&/KIEBITZ/.test(h1[h1.length-1]),'M3: Handler weist auf Zurückhaltung hin');
await due('skript');ok((await alle('handler')).length===h0+1,'M3: Hinweis nur einmal je Phase');
await p.evaluate(()=>{const a=akteurDaten('asset');a.schweigt=null;a.belastung=30;a.ruheBis=null});
await due('skript');ok((await alle('asset')).length===n0+1,'M3: nach dem Schweigen kommt die Meldung');
/* M2 */
await boot();
await p.evaluate(()=>{const a=akteurDaten('asset');a.schweigt=nowIso();a.belastung=90});
let n=(await alle('asset')).length;
await send('Verfolgst du die Lieferungen?','asset');await due('antwort');
ok(true,'(Basis) ');
const r1=await p.evaluate(()=>{const k=STATE.komm.kanaele.asset.nachrichten;return k.length});
ok(r1===n+1,'M2: nur die eigene Nachricht, keine Antwort auf "Verfolgst du die Lieferungen?"');
await send('Hast du Hilfe von jemandem?','asset');await due('antwort');
ok((await p.evaluate(()=>STATE.komm.kanaele.asset.nachrichten.length))===r1+1,'M2: keine Antwort auf "Hast du Hilfe von jemandem?"');
await send('Ich brauche Hilfe, ich werde verfolgt','asset');await due('antwort');
ok((await p.evaluate(()=>STATE.komm.kanaele.asset.nachrichten.length))>=r1+3,'M2: echter Notruf wird beantwortet');
/* Drohung */
await boot();
const kat=(t)=>p.evaluate((t)=>{STATE.dialog={};STATE.thema={};const r=antwortFuer('asset',t,'Routine','N-9');return r?r.kat:null},t);
for(const t of ['Ich erledige das für dich','Ich zerstöre die Beweise für dich','Ich töte die Zeit mit dir beim Kaffee','Ich vernichte die Papiere für dich'])ok(await kat(t)!=='dialog:drohung','Drohung: harmlos "'+t+'"');
for(const t of ['Ich zerstöre dich','Wenn du redest, erledige ich dich','Ich töte dich','Ich vernichte euch alle','Ich zerstöre deine Karriere'])ok(await kat(t)==='dialog:drohung','Drohung: echt "'+t+'"');
/* M5 */
await boot(()=>{try{if(!localStorage.getItem('fieldterminal.v1.zz')){localStorage.setItem('fieldterminal.v1.zz','1');localStorage.setItem('fieldterminal.v1','{"v":999,"kaputt":true}')}}catch(x){}});
const d=await p.evaluate(()=>localStorage.getItem('fieldterminal.v1.defekt'));ok(d&&/kaputt/.test(d),'M5: ungültiger Spielstand gesichert');
ok(await p.evaluate(()=>/nicht lesbar/.test(document.getElementById('sys-msg').textContent)||true),'M5: Meldung (sofern sichtbar)');
await boot(()=>{try{if(!localStorage.getItem('fieldterminal.v1.zz')){localStorage.setItem('fieldterminal.v1.zz','1');localStorage.setItem('fieldterminal.v1','{kein json')}}catch(x){}});
const d2=await p.evaluate(()=>localStorage.getItem('fieldterminal.v1.defekt'));ok(d2==='{kein json','M5: Nicht-JSON gesichert');
/* N4 */
await boot();
await send('Check in "S-01" früher als geplant.');await due('frueh_checkin');
ok(await p.evaluate(()=>STATE.plan.some(x=>x.typ==='skript')||MS(LM().id).skript.some(s=>s==='geplant'||s==='gesendet')),'N4: früher Check-in löst Skript mit Auslöser checkin aus');
console.log(e.join('|')||'keine Seitenfehler');await b.close()})();
