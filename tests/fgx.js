const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1500,height:1000}})).newPage();const e=[];p.on('pageerror',x=>e.push(x.message));
await p.goto(require('./_pfad.js').APP);await p.waitForTimeout(5200);await p.keyboard.press('Space');await p.fill('#gate-pw','pw-test-123');await p.fill('#gate-pw2','pw-test-123');await p.click('#gate-go');
await p.waitForFunction(()=>!document.body.classList.contains('locked'),null,{timeout:20000});
await p.evaluate(()=>{dispatch({type:'KENNWORT_SCHALTER',an:false});dispatch({type:'STATUS_GESETZT',status:'Standby'});dispatch({type:'MISSION_ZUGEWIESEN',id:'M1'});dispatch({type:'MISSION_ANGENOMMEN',id:'M1'});dispatch({type:'MISSION_BEGINN_JETZT'});});
const bg='Anlass: Sichtung SI-001 zeigt die Person beim Beladen des Transporters. Beleg: Foto und Bericht des Assets, Dokument DOK-001 liegt vor. Nutzen: Wir brauchen die Maßnahme, um die Lieferkette zu unterbrechen und den Auftrag zu sichern.';
const r=await p.evaluate((bg)=>{
 const def=LM(),ms=MS(def.id);
 // eigenes Dossier mit Stufe 5
 dispatch({type:'DOSSIER_ANGELEGT',typ:'Person',name:'Eigen Test'});const id=STATE.dossiers.eigene.slice(-1)[0].id;
 const res={id,eig:JSON.stringify(STATE.dossiers.eigene.slice(-1)[0]).slice(0,300)};
 res.arten=FG_ARTEN.filter(x=>fgSichtbar(x,def)).map(x=>x.id);
 ['festsetzung','eliminierung'].forEach(a=>{res[a]=fgBewerten(def,FG_ARTEN.find(x=>x.id===a),entitaet(id),bg,'Routine')});
 res.p9062=['festsetzung','eliminierung'].map(a=>JSON.stringify(fgBewerten(def,FG_ARTEN.find(x=>x.id===a),entitaet('P-9062'),bg,'Routine')));
 return res},bg);
console.log(JSON.stringify(r,null,1));await b.close()})();
