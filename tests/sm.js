const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1500,height:1000}})).newPage();const e=[];p.on('pageerror',x=>e.push(x.message));
await p.addInitScript(()=>{window.__ARGUS_ERGEBNIS='direkt'});
await p.goto(require('./_pfad.js').APP);await p.waitForTimeout(5200);await p.keyboard.press('Space');await p.fill('#gate-pw','pw-test-123');await p.fill('#gate-pw2','pw-test-123');await p.click('#gate-go');
await p.waitForFunction(()=>!document.body.classList.contains('locked'),null,{timeout:20000});
await p.evaluate(()=>{dispatch({type:'KENNWORT_SCHALTER',an:false});dispatch({type:'STATUS_GESETZT',status:'Standby'});dispatch({type:'MISSION_ZUGEWIESEN',id:'M1'});dispatch({type:'MISSION_ANGENOMMEN',id:'M1'});dispatch({type:'MISSION_BEGINN_JETZT'});});
let fail=0;const chk=(ok,t)=>{if(!ok)fail++;console.log((ok?'OK  ':'FAIL')+' '+t)};
const due=async(n=3)=>{for(let i=0;i<n;i++){await p.evaluate(()=>{STATE.plan.forEach(x=>{x.faelligAm=new Date(Date.now()-1000).toISOString()})});await p.waitForTimeout(1600)}};
const last=(k,n=1)=>p.evaluate(([k,n])=>STATE.komm.kanaele[k].nachrichten.slice(-n).map(m=>m.text).join(' | '),[k,n]);
const frage=async(k,t,w=3)=>{await p.evaluate(([t,k])=>dispatch({type:'NACHRICHT_GESENDET',kanal:k,text:t,dringlichkeit:'Routine'}),[t,k]);await due(w);return await last(k,1)};
const T=[
 ['handler','Bei mir alles in Ordnung.',/Alles klar|Weiter wie besprochen|Meldefenster|Verstanden|Gut\.|Läuft|Gecheckt/,'Befinden: "Bei mir alles in Ordnung"'],
 ['asset','Bist du sauer? Mimimi',/aufhören|hör auf|Nervös|Nein/i,'Asset: "Bist du sauer?"'],
 ['asset','Kenne ich nicht. Halt die Ohren offen.',/Ohren offen|bedeckt|vorsichtig|Bescheid|dran/i,'Asset: Weisung Ohren offen'],
 ['asset','Wie war dein Tag?',/Reifen|Lang|Wie jeder Tag/,'Smalltalk: Tag'],
 ['asset','Hast du schon gegessen?',/Imbiss|Currywurst|Kaffee/,'Smalltalk: Essen'],
 ['asset','Hast du Haustiere?',/Hund|Katze|Tiere/,'Smalltalk: Tiere'],
 ['asset','Schaust du Fußball?',/Fußball|laufen|Kollegen/,'Smalltalk: Sport'],
 ['handler','Wie war dein Wochenende?',/Freizeit|Kanal|Auftrag|Später|Nicht jetzt|Dazu/,'Smalltalk Handler'],
 ['handler','Was wissen wir bisher?',/Nach meinem Stand: Primärziele/,'Lagebild Handler']
];
for(const [k,t,re,n] of T){const a=await frage(k,t);console.log('   '+t+' -> '+a);chk(re.test(a),n)}
// Beschreibung
await p.evaluate(()=>dispatch({type:'NACHRICHT_EINGESPIELT',kanal:'asset',text:'Ein Mann mit Sicherheitsjacke war heute da. Er hat nichts gesagt, nur den Hof gesehen und fotografiert.',lagerelevant:false,dringlichkeit:'Routine'}));
let a1=await frage('asset','Hast du eine Beschreibung?');console.log('   '+a1);
chk(/Größe/.test(a1)&&/Haare/.test(a1),'Beschreibung enthält Größe und Haare');
chk(/nichts gesagt/.test(a1),'Herkunft: Asset kann nach Schweigen nichts sagen');
let a2=await frage('asset','Herkunft, Größe, Haarfarbe etc. Alles an Details, was du gesehen hast.');console.log('   '+a2);
chk(a2.replace(/^[^:]*:/,'').indexOf(a1.replace(/^[^:]*:/,'').split('Haare')[1].split('.')[0])>=0,'Zweite Beschreibung stimmt mit der ersten überein');
let a3=await frage('asset','Wie groß war er?');console.log('   '+a3);
chk(/Größe etwa 1,\d\d m/.test(a3)&&/Größe etwa 1,\d\d m/.test(a1)&&a3.match(/1,\d\d/)[0]===a1.match(/1,\d\d/)[0],'Einzelfrage Größe konsistent');
// Button

const ids=await p.evaluate(()=>{const ns=STATE.komm.kanaele.asset.nachrichten;return ns.filter(m=>m.von==='gegenstelle'&&personMeldung(m.text)).map(m=>m.id)});
console.log('Meldungen mit Person:',ids.join(','));
const sichtMsg=await p.evaluate(()=>STATE.komm.kanaele.asset.nachrichten.find(m=>/Sicherheitsjacke/.test(m.text)).id);
await p.evaluate(()=>{dispatch({type:'NAVIGATION',modul:'komm'});STATE.komm.aktiv='asset';render()});await p.waitForTimeout(500);
chk(await p.locator('#ub-'+sichtMsg).count()===1,'Button "An Handler übermitteln" sichtbar');
const vorher=await p.evaluate(()=>(STATE.dossiers.eigene||[]).length);
await p.click('#ub-'+sichtMsg);await due(3);
const info=await p.evaluate(id=>{const e=STATE.dossiers.eigene.slice(-1)[0];const m=STATE.komm.kanaele.asset.nachrichten.find(x=>x.id===id);return {n:STATE.dossiers.eigene.length,e:e,uebermittelt:!!m.uebermittelt}},sichtMsg);
console.log(JSON.stringify(info).slice(0,600));
chk(info.n===vorher+1&&/Unbekannter Mann mit Sicherheitsjacke/.test(info.e.name),'Dossier angelegt mit sprechendem Namen');
chk(info.e.eckdaten.some(x=>/^Größe:/.test(x))&&info.e.eckdaten.some(x=>/^Quelle: KIEBITZ/.test(x)),'Beschreibung und Quelle in den Eckdaten');
chk(/Ich lege ein Dossier an/.test(await last('handler',1)),'ARGUS bestätigt die Anlage');
chk(await p.evaluate(()=>{STATE.komm.aktiv='asset';render();return document.body.innerText.includes('an Handler übermittelt')}),'Anzeige "an Handler übermittelt"');
// Asset greift auf Dossierdaten zurück
let a4=await frage('asset','Wie sah Unbekannter Mann mit Sicherheitsjacke aus? Beschreibung bitte.');console.log('   '+a4);
chk(/Soweit ich|Größe|Haare/.test(a4),'Asset greift auf Dossierdaten zurück');
// Doppelte Übermittlung
await p.evaluate(id=>dispatch({type:'PERSON_UEBERMITTELN',msgId:id}),sichtMsg);await due(2);
chk(await p.evaluate(()=>STATE.dossiers.eigene.length)===vorher+1,'Keine doppelte Anlage');
// Dossierabriss Plural
const ds=await frage('handler','Wie schätzt du Emre Kaya ein?');console.log('   '+ds);
chk(!/und er weiß es/.test(ds)&&!/\(e\)/.test(ds),'P-0001: Text natürlicher, Plural korrekt');
console.log(e.join('\n')||'keine Seitenfehler');console.log(fail?'FEHLER: '+fail:'ALLE OK');await b.close()})();
