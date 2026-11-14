const {chromium}=require('playwright');
const ok=(c,m)=>console.log((c?'OK   ':'FAIL ')+m);
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1500,height:1000}})).newPage();const e=[];p.on('pageerror',x=>e.push(x.message));
await p.goto(require('./_pfad.js').APP);await p.waitForTimeout(5200);await p.fill('#gate-pw','pw-test-123');await p.fill('#gate-pw2','pw-test-123');await p.click('#gate-go');
await p.waitForFunction(()=>!document.body.classList.contains('locked'),null,{timeout:20000});
await p.evaluate(()=>{dispatch({type:'STATUS_GESETZT',status:'Standby'});dispatch({type:'MISSION_ZUGEWIESEN',id:'M1'});dispatch({type:'MISSION_ANGENOMMEN',id:'M1'});MS('M1').beginn=new Date(Date.now()-3600000).toISOString();alleEntitaeten().forEach(e=>{IZ()[e.id]={status:'frei'}});});
const chat=(k,t)=>p.evaluate(([k,t])=>{dispatch({type:'NACHRICHT_GESENDET',kanal:k,text:t,dringlichkeit:'Routine'});const q=STATE.plan||[];return null},[k,t]);
// Agent: Plateau im Einsatz
const r1=await p.evaluate(()=>{const B=belS();B.w=60;B.t=new Date(Date.now()-120*60000).toISOString();const a=belS().w;B.w=80;B.t=new Date(Date.now()-120*60000).toISOString();return [Math.round(a),Math.round(belS().w)]});
console.log('Anstieg 2h aus 60 / aus 80:',r1);ok(r1[0]===75&&r1[1]===80,'Plateau 75, darüber kein Dauer-Anstieg');
// Atempause
const r2=await p.evaluate(()=>{belS().w=88;const x=[Math.round(belS().w)];dispatch({type:'ATEMPAUSE'});x.push(Math.round(belS().w));dispatch({type:'ATEMPAUSE'});x.push(Math.round(belS().w));return x});
console.log(r2);ok(r2[1]===78&&r2[2]===78,'Atempause -10, Cooldown greift');
// Chat-Atempause (Handler)
const r3=await p.evaluate(()=>{belS().w=80;belS().atemT=null;const m=dialogAntwort('handler','Ich brauche kurz eine Pause','x1',1);return m.kat});
ok(r3==='dialog:atempause','Absicht atempause erkannt: '+r3);
const kats=await p.evaluate(()=>['Mach dir keine Sorgen, wir schaffen das.','Bleib ruhig, ich bin da.','Ich melde mich nicht mehr bis morgen, melde dich wenn du etwas hast.','Was wissen wir bisher?','Keine Sorge, ich kümmere mich darum.'].map((t,i)=>dialogAntwort(i===2?'asset':'asset',t,'y'+i,i).kat));
console.log(kats);
// Asset-Zuspruch
const r4=await p.evaluate(()=>{const a=akteurDaten('asset');a.belastung=80;a.t=nowIso();const v0=a.belastung;const q=zustandModulieren('asset',{kat:'dialog:beruhigung',text:'Danke.',verz:1,vorlage:'Danke.',frage:null},'Bleib ruhig',3);return [v0,akteurDaten('asset').belastung,q.text]});
console.log(r4);ok(r4[1]<r4[0],'Zuspruch senkt Belastung des Assets');
const r5=await p.evaluate(()=>{const a=akteurDaten('asset');a.belastung=90;const q=zustandModulieren('asset',{kat:'dialog:beruhigung',text:'Danke, ich versuche es.',verz:1,vorlage:'x',frage:null},'Bleib ruhig',3);return q.text});
ok(!/Kein Kontakt jetzt/.test(r5),'Beruhigung wird bei Belastung >85 nicht abgeblockt: '+r5);
// Nachrichtenkosten gedeckelt
const r6=await p.evaluate(()=>{const a=akteurDaten('asset');a.belastung=20;a.verlauf=[];for(let i=0;i<15;i++){dispatch({type:'NACHRICHT_GESENDET',kanal:'asset',text:'Test '+i,dringlichkeit:'Routine'})}return akteurDaten('asset').belastung});
const kk=await p.evaluate(()=>akteurDaten('asset').verlauf.filter(v=>v.grund==='Kontaktaufnahme über den Kanal').reduce((n,v)=>n+v.d,0));console.log('Belastung',r6,'Kontaktkosten',kk);ok(kk<=8,'Kontaktkosten höchstens 8 je Stunde');
await p.evaluate(()=>{dispatch({type:'NAVIGATION',modul:'profil'})});await p.waitForTimeout(500);
ok(await p.locator('#btn-atempause').count()>=1,'Knopf im Profil');
console.log(e.join()||'keine Fehler');await b.close()})();
