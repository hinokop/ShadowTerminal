const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1400,height:1000}})).newPage();const e=[];p.on('pageerror',x=>e.push(x.message));
await p.goto(require('./_pfad.js').APP);await p.waitForTimeout(5200);await p.keyboard.press('Space');await p.fill('#gate-pw','pw-test-123');await p.fill('#gate-pw2','pw-test-123');await p.click('#gate-go');
await p.waitForFunction(()=>!document.body.classList.contains('locked'),null,{timeout:20000});
await p.evaluate(()=>{dispatch({type:'KENNWORT_SCHALTER',an:false});dispatch({type:'STATUS_GESETZT',status:'Standby'});dispatch({type:'MISSION_ZUGEWIESEN',id:'M1'});dispatch({type:'MISSION_ANGENOMMEN',id:'M1'});dispatch({type:'MISSION_BEGINN_JETZT'});
 alleEntitaeten().forEach(e=>{IZ()[e.id]={status:'frei'}});});
const T=[
['handler','Erbitte erweiterung des Budgets. Unvorhergesehene Kosten bzgl. P-0001','D'],
['handler','Die Person hat finanzielle Probleme, die aktiv die Mission gefährden, es wird ein Kredit, mit Zinsen.','D'],
['asset','Informationen zu Neumann ?','D'],
['asset','Was kannst du mir zu Neumann sagen','D'],
['asset','Wie geht es dir momentan?','D'],
['asset','Wie ist dein aktueller Stand?','D'],
['asset','Standort?','D'],
['asset','Wo befindest du dich derzeit','D'],
['handler','Gibt es Verstärkung?','D'],
['support','Gibt es Verstärkung als Absicherung?','D'],
['handler','Bestätigt durch Asset.','D'],['handler','Erbitte erweiterung des Budgets. Unvorhergesehene Kosten bzgl. P-0001','P'],['handler','Die Person hat finanzielle Probleme, die aktiv die Mission gefährden, es wird ein Kredit, mit Zinsen.','P'],
['handler','Wann findet der Transport statt?','D'],
];
for(const [k,t,dd] of T){const r=await p.evaluate(([k,t,dd])=>{const m3=dd==='P'?'Priorität':null;const r=antwortFuer(k,t,m3||'Routine','N-901');return r?{kat:r.kat,text:r.text,teile:r.teile||null,faden:r.faden?r.faden.text:null}:null},[k,t,dd]);console.log(k+' > '+t+'\n   '+JSON.stringify(r))}
// Folgefrage mit Davor
await p.evaluate(()=>{STATE.komm.kanaele.support.nachrichten.push({id:'N-950',von:'gegenstelle',absender:'DISPO',t:nowIso(),text:'Der Logistikpark in Ludwigsfelde wechselt auffällig oft den Mieter. Ob das hier Zufall ist, kann ich nicht belegen.',status:'gelesen'})});
for(const t of ['Wie oft genau?','Seit wann?','Wer genau?']){const r=await p.evaluate((t)=>{const r=antwortFuer('support',t,'Routine','N-902');return {kat:r.kat,text:r.text,faden:r.faden?r.faden.text:null}},t);console.log('support > '+t+'\n   '+JSON.stringify(r))}
console.log('Fehler:',e.join('|')||'keine');await b.close()})();
