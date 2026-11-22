/* Alterung von Erkenntnissen (produktiver Teil, aus al.js ausgegliedert in Phase 5b7): Fristen je Quellenzuverlässigkeit,
   Abwertung und Bestätigung von Verbindungen, Dossierdarstellung. Ohne Missionsablauf und ohne Regie-Zeitraffer. */
const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1500,height:1000}})).newPage();const e=[];p.on('pageerror',x=>e.push(x.message));
await p.goto(require('./_pfad.js').APP);await p.waitForTimeout(5200);await p.keyboard.press('Space');await p.fill('#gate-pw','pw-test-123');await p.fill('#gate-pw2','pw-test-123');await p.click('#gate-go');
await p.waitForFunction(()=>!document.body.classList.contains('locked'),null,{timeout:20000});
let fail=0;const chk=(ok,t)=>{if(!ok)fail++;console.log((ok?'OK  ':'FAIL')+' '+t)};
const due=async()=>{await p.evaluate(()=>{STATE.plan.forEach(x=>{x.faelligAm=new Date(Date.now()-1000).toISOString()})});await p.waitForTimeout(2200)};
// 1 Kernfunktion
const f=await p.evaluate(()=>{const v=h=>new Date(Date.now()-h*3600000).toISOString();const o={};
 o.a3=frische('A',v(72)).stufe;o.a4=frische('A',v(96)).stufe;o.a8=frische('A',v(8*24));o.a15=frische('B',v(15*24));
 o.c35=frische('C',v(35)).stufe;o.c73=frische('D',v(73));o.e13=frische('E',v(13)).stufe;o.e25=frische('F',v(25));o.leer=frische('A',undefined).stufe;return o});
chk(f.a3==='aktuell'&&f.a4==='alternd','A/B: 3 d aktuell, 4 d alternd');
chk(f.a8.stufe==='veraltet'&&f.a8.abwertung===1&&f.a15.abwertung===2,'A/B: 8 d veraltet (−1), 15 d (−2)');
chk(f.c35==='aktuell'&&f.c73.stufe==='veraltet','C/D: 35 h aktuell, 73 h veraltet');
chk(f.e13==='alternd'&&f.e25.stufe==='veraltet'&&f.e25.abwertung===1,'E/F: 13 h alternd, 25 h veraltet');
chk(f.leer==='aktuell','ohne Zeitstempel aktuell');
// Faktor
const kv=await p.evaluate(()=>{const v=kantenPool().find(x=>x.bewertung==='B2'||x.bewertung==='C3'||x.bewertung==='A1');const o={id:v.id,orig:v.bewertung,neu:bewertungEff(v).code};
 STATE.dossiers.kantenStand={};STATE.dossiers.kantenStand[v.id]=new Date(Date.now()-2*864e5*(v.bewertung[0]<='B'?5:1)).toISOString();
 o.alt=bewertungEff(v).code;o.altFr=bewertungEff(v).fr.stufe;
 dispatch({type:'KANTE_BESTAETIGT',id:v.id});o.nach=bewertungEff(v).code;o.nachFr=bewertungEff(v).fr.stufe;return o});
console.log(JSON.stringify(kv));
chk(kv.altFr==='veraltet'&&kv.alt[1]>kv.orig[1]&&kv.alt[0]===kv.orig[0],'Verbindung veraltet: Information abgewertet');
chk(kv.nach===kv.orig&&kv.nachFr==='aktuell','Bestätigung erneuert den Stand');
chk(await p.evaluate(()=>{const v=kantenPool().find(x=>x.bewertung==='A1');STATE.dossiers.kantenStand[v.id]=new Date(Date.now()-40*864e5).toISOString();return bewertungEff(v).code==='A6'}),'A1 nach 40 d weit abgewertet');
// Graph/Dossier-Rendering
await p.evaluate(()=>{const id=pool().find(e=>wissen(e)==='frei'&&verbindungenVon(e.id).length).id;dispatch({type:'DOSSIER_GEOEFFNET',id,ueber:'t',navigieren:true})});await p.waitForTimeout(500);
chk(await p.evaluate(()=>/Erkenntnislage|Verbindungen/.test(document.body.innerText)),'Dossier rendert (Erkenntnislage-Zeile)');
// 3 Einschätzung
chk(await p.evaluate(()=>!document.querySelector('.err')),'keine Fehleranzeige');
chk(e.length===0,'keine Seitenfehler');
console.log(e.join('\n')||'keine Seitenfehler');console.log(fail?'FEHLER: '+fail:'ALLE OK');await b.close();process.exitCode=fail?1:0})();
