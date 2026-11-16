const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1400,height:1000}})).newPage();const e=[];p.on('pageerror',x=>e.push(x.message));
await p.goto(require('./_pfad.js').APP);await p.waitForTimeout(5200);await p.fill('#gate-pw','pw-test-123');await p.fill('#gate-pw2','pw-test-123');await p.click('#gate-go');
await p.waitForFunction(()=>!document.body.classList.contains('locked'),null,{timeout:20000});
await p.evaluate(()=>{dispatch({type:'KENNWORT_SCHALTER',an:false});dispatch({type:'STATUS_GESETZT',status:'Standby'});dispatch({type:'MISSION_ZUGEWIESEN',id:'M1'});dispatch({type:'MISSION_ANGENOMMEN',id:'M1'});dispatch({type:'MISSION_BEGINN_JETZT'});
 dispatch({type:'DOSSIER_NEU',typ:'Person',name:'Testperson Eins'});});
const T=[['handler','Wie viel Zeit bleibt mir bis Transport?'],['handler','Standort von KIEBITZ und P9101'],['handler','Alias von P-0001'],['handler','Nächste Missionsphase?'],['handler','Verstärkung für P-0001 muss sich beeilen.'],['handler','Ist DISPO verfügbar?'],['handler','Letzter Standort p-9101'],['asset','Gibt es aktuelle informationen?'],['handler','Sichtung von P-0018 Sonnenallee Cafe, 2 Begleiter'],['support','Verstärkung erfoderlich?'],['asset','Bist du Einsatzbereit?'],['asset','Wenn du mir nochmal so frech antwortest, eliminiere ich deinen erbärmlichen Arsch'],['handler','KIEBITZ ist unzuverlässig.']];
for(const [k,t] of T){await p.evaluate(([k,t])=>dispatch({type:'NACHRICHT_GESENDET',kanal:k,text:t,dringlichkeit:'Routine'}),[k,t]);
 await p.evaluate(()=>{STATE.plan.filter(x=>x.typ==='antwort').forEach(x=>{x.faelligAm=new Date(Date.now()-1000).toISOString()});});await p.waitForTimeout(1300);
 console.log(k+' > '+t+'\n   < '+await p.evaluate((k)=>{const n=STATE.komm.kanaele[k].nachrichten;return n[n.length-1].text.slice(0,170)},k));}
console.log(e.join()||'keine Fehler');await b.close()})();
