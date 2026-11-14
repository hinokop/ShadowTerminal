const {chromium}=require('playwright');
const ok=(c,m)=>console.log((c?'OK   ':'FAIL ')+m);
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1400,height:1000}})).newPage();const e=[];p.on('pageerror',x=>e.push(x.message));
await p.goto(require('./_pfad.js').APP);await p.waitForTimeout(5200);await p.fill('#gate-pw','pw-test-123');await p.fill('#gate-pw2','pw-test-123');await p.click('#gate-go');
await p.waitForFunction(()=>!document.body.classList.contains('locked'),null,{timeout:20000});
await p.evaluate(()=>{dispatch({type:'STATUS_GESETZT',status:'Standby'});dispatch({type:'MISSION_ZUGEWIESEN',id:'M1'});dispatch({type:'MISSION_ANGENOMMEN',id:'M1'});alleEntitaeten().forEach(e=>{IZ()[e.id]={status:'frei'}});});
await p.waitForTimeout(400);
const fg=(m,z,t)=>p.evaluate(([m,z,t])=>{dispatch({type:'FREIGABE_BEANTRAGT',massnahme:m,ziel:z,begruendung:t,dringlichkeit:'Routine'});const f=FGL();if(!f.length)return 'KEINE FG; entitaet='+!!entitaet(z);const x=f[f.length-1];return x.urteil+'|'+(x.grund||x.auflage||'')},[m,z,t]);
const U='Person gefährdet akut einen weiteren Asset, wenn dieser auffliegt, scheitert die Mission und ich verliere meinen Asset.';
const r1=await fg('eliminierung','P-9062',U);console.log(r1);ok(!/Das reicht mir so noch nicht|trägt nicht/.test(r1)||/Ziel|Verhältn|Auflage|abgelehnt/.test(r1)&&false,'Satz Nutzer (Ausgabe prüfen)');
for(const t of ['ich mache mir Sorgen','kurz','Ich denke, das wäre gut.','Es ist mir einfach wichtig.']){console.log(t,'=>',await fg('eliminierung','P-9062',t));}
console.log('beob',await fg('observation','P-9062','Asset meldet Sichtung am Hof, zur Bestätigung nötig.'));
console.log(e.join()||'keine Fehler');await b.close()})();
