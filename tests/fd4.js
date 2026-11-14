const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await (await b.newContext()).newPage();const e=[];p.on('pageerror',x=>e.push(x.message));
await p.goto(require('./_pfad.js').APP);await p.waitForTimeout(5200);await p.keyboard.press('Space');await p.fill('#gate-pw','pw-test-123');await p.fill('#gate-pw2','pw-test-123');await p.click('#gate-go');
await p.waitForFunction(()=>!document.body.classList.contains('locked'),null,{timeout:20000});
await p.evaluate(()=>{dispatch({type:'KENNWORT_SCHALTER',an:false});dispatch({type:'STATUS_GESETZT',status:'Standby'});dispatch({type:'MISSION_ZUGEWIESEN',id:'M1'});dispatch({type:'MISSION_ANGENOMMEN',id:'M1'});dispatch({type:'MISSION_BEGINN_JETZT'});});
const T=[['asset','Was kannst du mir zu Xylander sagen'],['asset','Informationen zu Zorn ?'],['support','Wer ist Herr Brandt?'],['handler','Kennst du Frau Vogelsang?'],['asset','Informationen zu Werkstatt?'],['asset','Was weißt du über den Fahrer?'],['asset','Was weißt du über Hinterhofgeschäfte?'],['handler','Wer ist Mueller']];
for(const [k,t] of T){const r=await p.evaluate(([k,t])=>{const r=antwortFuer(k,t,'Routine','N-905');return r.kat+' | '+r.text+' | '+(r.faden?r.faden.text:'-')},[k,t]);console.log(k+' > '+t+'\n   '+r)}
await p.evaluate(()=>{STATE.komm.kanaele.support.nachrichten.push({id:'N-950',von:'gegenstelle',absender:'DISPO',t:nowIso(),text:'Der Logistikpark in Ludwigsfelde wechselt auffällig oft den Mieter. Ob das hier Zufall ist, kann ich nicht belegen.',status:'gelesen'})});
await p.evaluate(()=>{dispatch({type:'NACHRICHT_GESENDET',kanal:'support',text:'Wie oft genau?',dringlichkeit:'Routine',modus:null})});
await p.evaluate(()=>{dispatch({type:'NACHRICHT_GESENDET',kanal:'support',text:'Wie oft genau?',dringlichkeit:'Routine',modus:null})});
console.log(JSON.stringify(await p.evaluate(()=>STATE.plan.filter(x=>x.typ==='antwort').map(x=>x.text.slice(0,80)))));
await p.evaluate(()=>{STATE.plan.forEach(x=>{x.faelligAm=new Date(Date.now()-1000).toISOString()});tick()});await p.waitForTimeout(300);
await p.evaluate(()=>{dispatch({type:'NACHRICHT_GESENDET',kanal:'support',text:'Wie oft genau?',dringlichkeit:'Routine',modus:null})});
console.log(JSON.stringify(await p.evaluate(()=>STATE.plan.filter(x=>x.typ==='antwort').map(x=>x.text.slice(0,100)))));
console.log('Fehler:',e.join('|')||'keine');await b.close()})();
