const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1500,height:1000}})).newPage();const e=[];p.on('pageerror',x=>e.push(x.message));
await p.addInitScript(()=>{window.__ARGUS_ERGEBNIS='direkt'});
await p.goto('file:///home/claude/index.html');await p.waitForTimeout(5200);await p.keyboard.press('Space');await p.fill('#gate-pw','pw-test-123');await p.fill('#gate-pw2','pw-test-123');await p.click('#gate-go');
await p.waitForFunction(()=>!document.body.classList.contains('locked'),null,{timeout:20000});
await p.evaluate(()=>{dispatch({type:'KENNWORT_SCHALTER',an:false});dispatch({type:'STATUS_GESETZT',status:'Standby'});dispatch({type:'MISSION_ZUGEWIESEN',id:'M1'});dispatch({type:'MISSION_ANGENOMMEN',id:'M1'});dispatch({type:'MISSION_BEGINN_JETZT'});dispatch({type:'NAVIGATION',modul:'karte'})});
let fail=0;const chk=(ok,t)=>{if(!ok)fail++;console.log((ok?'OK  ':'FAIL')+' '+t)};
const due=async(n=3)=>{for(let i=0;i<n;i++){await p.evaluate(()=>{STATE.plan.forEach(x=>{x.faelligAm=new Date(Date.now()-1000).toISOString()})});await p.waitForTimeout(1500)}};
const lastH=(n=1)=>p.evaluate(n=>STATE.komm.kanaele.handler.nachrichten.slice(-n).map(m=>m.text).join(' | '),n);
// Skala
chk(await p.evaluate(()=>Object.values(SCENARIO.zonen.wertungen).join(',')==='Unauffällig,Angespannt,Bedroht,Akut bedroht'),'Vier Stufen der Zonenbewertung');
chk(await p.evaluate(()=>{const M=SCENARIO.zonen.meldung;return M.leicht.length+M.bedroht.length+M.akut.length>=28}),'Mindestens 28 Meldeformulierungen');
chk(await p.evaluate(()=>{const M=SCENARIO.zonen.meldung,all=[].concat(M.leicht,M.bedroht,M.akut);return new Set(all).size===all.length}),'Keine doppelten Formulierungen');
chk(await p.evaluate(()=>bewertungText('B2')==='B2: Quelle überwiegend zuverlässig, Information wahrscheinlich richtig'&&bewertungText('F6').indexOf('nicht beurteilbar')>0),'Neue Quellenskala im Text');
// bedroht
await p.evaluate(()=>{dispatch({type:'ZONE_ANGELEGT',ll:[52.4817,13.4352]});dispatch({type:'ZONE_GEAENDERT',id:'ZN-001',wertung:'bedroht',r:150});karteWaehlen('ZN-001',false)});await p.waitForTimeout(400);
chk(await p.evaluate(()=>[...$('zn-wertung').options].map(o=>o.text).join('|')==='Unauffällig|Angespannt|Bedroht|Akut bedroht'),'Auswahl zeigt vier Stufen');
chk(await p.evaluate(()=>/Abstand/.test($('k-auswahl').innerText)),'Hinweis zur Wirkung der Meldung');
await p.click('#zn-melden');await due(4);
const m=await p.evaluate(()=>STATE.komm.kanaele.handler.nachrichten.filter(m=>m.von==='agent'||m.von==='agent').slice(-1)[0]?.text||'');
const hb=await lastH(4);console.log(hb);
chk(await p.evaluate(()=>SCENARIO.zonen.meldung.bedroht.some(x=>STATE.komm.kanaele.handler.nachrichten.some(m=>m.text.indexOf(x)>=0))),'Meldung mit Formulierung der Stufe "bedroht"');
chk(/als bedroht vermerkt|gilt als bedroht|Bedroht, verstanden/.test(hb),'ARGUS reagiert auf Stufe "bedroht"');
chk(await p.evaluate(()=>$('k-auswahl').hidden),'Fenster nach Meldung geschlossen');
// Lage erfragen
await p.evaluate(()=>{karteWaehlen('ZN-001',false)});await p.waitForTimeout(300);
const gemeldetVorher=await p.evaluate(()=>JSON.stringify(zonenEigene(zDef())[0].gemeldet));
chk(await p.locator('#zn-frage').count()===1,'Button "Lage erfragen" vorhanden');
await p.click('#zn-frage');await due(4);
const hq=await lastH(2);console.log(hq);
chk(await p.evaluate(()=>$('k-auswahl').hidden&&/erfragt/.test($('sys-msg').textContent)),'Fenster schließt, Statuszeile bestätigt');
chk(await p.evaluate(g=>JSON.stringify(zonenEigene(zDef())[0].gemeldet)===g,gemeldetVorher),'Frage ändert Meldestand nicht');
chk(!/als bedroht vermerkt|akut bedroht vermerkt/.test(hq.split(' | ').pop()),'Antwort auf Frage ist Bericht, keine Meldungsquittung');
// Lage bestätigen
await p.evaluate(()=>{karteWaehlen('ZN-001',false)});await p.waitForTimeout(300);
await p.click('#zn-best');await p.waitForTimeout(300);
chk(await p.evaluate(()=>$('k-auswahl').hidden&&/bestätigt/.test($('sys-msg').textContent)),'Lage bestätigen: schließt und bestätigt');
console.log(e.join('\n')||'keine Seitenfehler');console.log(fail?'FEHLER: '+fail:'ALLE OK');await b.close()})();
