const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1500,height:1000}})).newPage();const e=[];p.on('pageerror',x=>e.push(x.message));
await p.addInitScript(()=>{window.__ARGUS_ERGEBNIS='direkt'});
await p.goto(require('./_pfad.js').APP);await p.waitForTimeout(5200);await p.keyboard.press('Space');await p.fill('#gate-pw','pw-test-123');await p.fill('#gate-pw2','pw-test-123');await p.click('#gate-go');
await p.waitForFunction(()=>!document.body.classList.contains('locked'),null,{timeout:20000});
await p.evaluate(()=>{dispatch({type:'KENNWORT_SCHALTER',an:false});dispatch({type:'STATUS_GESETZT',status:'Standby'});dispatch({type:'MISSION_ZUGEWIESEN',id:'M1'});dispatch({type:'MISSION_ANGENOMMEN',id:'M1'});dispatch({type:'MISSION_BEGINN_JETZT'});});
let fail=0;const chk=(ok,t)=>{if(!ok)fail++;console.log((ok?'OK  ':'FAIL')+' '+t)};
const due=async()=>{await p.evaluate(()=>{STATE.plan.forEach(x=>{x.faelligAm=new Date(Date.now()-1000).toISOString()})});await p.waitForTimeout(2200)};
const last=(k,n=3)=>p.evaluate(([k,n])=>STATE.komm.kanaele[k].nachrichten.slice(-n).map(m=>m.text),[k,n]);
chk(await p.evaluate(()=>abdWert('legende')===0&&abdWert('asset')===0),'Start: keine Spuren');
// Asset-Kontakte
await p.evaluate(()=>{for(let i=0;i<3;i++)dispatch({type:'NACHRICHT_GESENDET',kanal:'asset',text:'Wie ist die Lage am Tor, Nummer '+i+'?',dringlichkeit:'Routine'})});
const a1=await p.evaluate(()=>({w:abdWert('asset'),s:abdStufe('asset')}));console.log(JSON.stringify(a1));
chk(a1.w>=5.5&&a1.w<=6.5&&a1.s===0,'3 Routine-Kontakte: ca. 6, noch unauffällig');
await p.evaluate(()=>{for(let i=0;i<10;i++)dispatch({type:'NACHRICHT_GESENDET',kanal:'asset',text:'Noch eine Frage zur Lage '+i,dringlichkeit:'Priorität'})});
const a2=await p.evaluate(()=>({w:abdWert('asset'),s:abdStufe('asset'),m:abdS().spuren.filter(x=>x.art==='Muster').length}));console.log(JSON.stringify(a2));
chk(a2.m>=1,'Häufung (5+ Kontakte in 2 h) erzeugt Muster-Spur');
chk(a2.s>=1,'Stufe mindestens bemerkbar');
await due();
// Warnung: eine der zufällig gewählten Fassungen aus SCENARIO.abdruck.asset (Stufe 1 bis 3)
chk(await p.evaluate(()=>{const f=[].concat(...Object.values(SCENARIO.abdruck.asset)).map(x=>x.split('{BIS}')[0]);return STATE.komm.kanaele.handler.nachrichten.slice(-9).some(m=>f.some(a=>m.text.startsWith(a)))}),'ARGUS warnt wegen Asset-Kontakten');
// auf erkennbar treiben
await p.evaluate(()=>dispatch({type:'ABDRUCK_REGIE',tr:'asset',d:60}));await due();await due();await due();
const a3=await p.evaluate(()=>({s:abdStufe('asset'),sp:abdSperre()}));console.log(JSON.stringify(a3));
chk(a3.s>=2&&!!a3.sp,'Asset erkennbar: Kontaktsperre gesetzt');
chk((await last('handler',8)).some(t=>/bis \d\d:\d\dZ/.test(t)),'ARGUS verkündet Kontaktsperre mit Uhrzeit');
// Stimme des Assets: eine der Fassungen aus SCENARIO.abdruck.assetStimme (Stufe 2 oder 3)
chk(await p.evaluate(()=>{const f=[].concat(...Object.values(SCENARIO.abdruck.assetStimme));return STATE.komm.kanaele.asset.nachrichten.slice(-3).some(m=>f.includes(m.text))}),'KIEBITZ reagiert nervös');
// Kontakt trotz Sperre
const v0=await p.evaluate(()=>akteurDaten('handler').vertrauen);const w0=await p.evaluate(()=>abdWert('asset'));
await p.evaluate(()=>dispatch({type:'NACHRICHT_GESENDET',kanal:'asset',text:'Ich muss dich trotzdem sprechen.',dringlichkeit:'Routine'}));await due();
chk(await p.evaluate(()=>abdS().spuren.some(x=>/trotz Kontaktsperre/.test(x.bez))),'Kontakt in der Sperre zählt doppelt/vermerkt');
chk(await p.evaluate(v=>akteurDaten('handler').vertrauen<v,v0),'ARGUS-Vertrauen sinkt bei Kontakt trotz Sperre');
// Rüge: eine der drei Fassungen aus SCENARIO.abdruck.ruege (zufällig gewählt)
chk(await p.evaluate(()=>STATE.komm.kanaele.handler.nachrichten.slice(-9).some(m=>SCENARIO.abdruck.ruege.includes(m.text))),'ARGUS rügt');
const n1=(await last('handler',20)).length;
await p.evaluate(()=>dispatch({type:'NACHRICHT_GESENDET',kanal:'asset',text:'Und noch einmal.',dringlichkeit:'Routine'}));await due();
chk(await p.evaluate(()=>{const r=abdS().letzteRuege;return Date.now()-Date.parse(r)<1200000}),'Rüge wird gedrosselt (kein Spam in 20 min)');
// Verblassen
await p.evaluate(()=>{abdS().spuren.forEach(s=>{s.t=new Date(Date.now()-48*3600000).toISOString()})});
chk(await p.evaluate(()=>abdWert('asset')<abdS().spuren.reduce((a,s)=>a+s.w,0)/5),'Nach 48 h stark verblasst (Halbwertszeit)');
await p.evaluate(()=>{abdPruefen()});
chk(await p.evaluate(()=>abdS().warn.asset===abdStufe('asset')),'Warnmerker sinken mit der Lage');
// Ruhend verblasst schneller
const rr=await p.evaluate(()=>{abdS().spuren=[];abdSpur('legende','Test',40,'Test');abdS().spuren[0].t=new Date(Date.now()-12*3600000).toISOString();const a=abdWert('legende');STATE.agent.status='Ruhend';const b=abdWert('legende');STATE.agent.status='Standby';return [a,b]});
chk(Math.abs(rr[0]-20)<0.5&&Math.abs(rr[1]-10)<0.5,'Halbwertszeit 12 h; Ruhend halbiert doppelt so schnell ('+rr.map(x=>x.toFixed(1))+')');
// Legende: Check-in, Rückkehr, Ausweichort, Begegnung
await p.evaluate(()=>{const A=abdS();A.spuren=[];A.orte=[];A.warn={legende:0,asset:0};A.sperreBis=null});
await p.evaluate(()=>{const o=KM().standorte.map(x=>x.id);window.__o=o;dispatch({type:'CHECKIN',standortId:o[0]});dispatch({type:'CHECKIN',standortId:o[1]});dispatch({type:'CHECKIN',standortId:o[0]})});
chk(await p.evaluate(()=>abdS().spuren.some(x=>x.art==='Rückkehr')),'Rückkehr zu früherem Ort wird vermerkt');
await p.evaluate(()=>dispatch({type:'CHECKIN_AUSWEICH',name:'Parkplatz',ll:[52.47,13.45],begruendung:''}));
chk(await p.evaluate(()=>abdS().spuren.some(x=>x.art==='Ausweichort'&&x.w===9)),'Ausweichort ohne Begründung: schwer');
await p.evaluate(()=>{zustandAus({type:'X'},[{modul:'Mission',aktion:'Begegnung gemeldet',detail:'B-1: Begegnung mit P-0001 KIEBITZ'}]);abdPruefen()});
chk(await p.evaluate(()=>abdS().spuren.some(x=>x.tr==='asset'&&x.art==='Begegnung')&&abdS().spuren.some(x=>x.tr==='legende'&&x.art==='Begegnung')),'Begegnung mit Asset: beide Wertungen');
// Freigabe-Auswirkung
const fg=await p.evaluate(()=>{akteurDaten('handler').vertrauen=90;alleEntitaeten().forEach(e=>{IZ()[e.id]={status:'frei'}});const def=LM(),ms=MS(def.id);ms.zugriffUrteil={ok:true};const org=pool().find(e=>e.typ==='Organisation'&&e.id!=='P-0001');
 ms.dokumente.push({id:'D-F',t:new Date().toISOString(),art:'Foto',entitaet:org.id,notiz:'x',name:'a.png'});
 const T='Die Organisation wurde gestern am Zwischenlager gesehen, ich habe Fotos und das Kennzeichen, um Zugang und Ladung zu belegen.';const art=FG_ARTEN.find(x=>x.id==='sabotage');
 abdS().spuren=[];const r0=fgBewerten(def,art,org,T,'Routine');
 abdSpur('legende','Regie',60,'t');const r1=fgBewerten(def,art,org,T,'Routine');
 abdSpur('legende','Regie',40,'t');const r2=fgBewerten(def,art,org,T,'Routine');
 const obs=fgBewerten(def,FG_ARTEN.find(x=>x.id==='observation'),org,T,'Routine');return {r0,r1,r2,obs}});
console.log(JSON.stringify(fg).slice(0,700));
chk(!/Abdruck/.test((fg.r0.grund||'')+(fg.r0.auflage||'')),'Freigabe bei sauberer Lage: keine Abdruck-Auflage');
chk(/Abdruck ist erkennbar/.test(fg.r1.auflage||'')&&fg.r1.urteil==='auflage','Legende erkennbar: Auflage');
chk(fg.r2.urteil==='abgelehnt'&&/verbrannt/.test(fg.r2.grund||''),'Legende verbrannt: keine eingriffsnahe Freigabe');
chk(!/verbrannt/.test(fg.obs.grund||''),'Observation bleibt möglich');
// Abfrage im Chat
await p.evaluate(()=>{const A=abdS();A.spuren=[];abdSpur('legende','Ausweichort',30,'Ausweichort, nicht im Plan')});
await p.evaluate(()=>dispatch({type:'NACHRICHT_GESENDET',kanal:'handler',text:'Wie sieht mein Abdruck aus?',dringlichkeit:'Routine'}));await due();
const ab=(await last('handler',2)).join(' | ');console.log(ab);
chk(/Legende bemerkbar/.test(ab)&&/Ausweichort/.test(ab)&&!/\d{2}\)/.test(ab),'ARGUS nennt Stufen und Hauptgrund, ohne Zahlen');
// UI
await p.evaluate(()=>dispatch({type:'NAVIGATION',modul:'profil'}));await p.waitForTimeout(400);
// Seit cbc12c3 (Arbeitsprofil) zeigt das Profil keine Abdruck-Zeilen mehr; der Abdruck steht in der Regie (profil-arbeitsansicht prüft das Profil).
chk(await p.evaluate(()=>!/Abdruck Legende|Abdruck Asset/i.test($('main').innerText)),'Profil ohne Abdruck-Zeilen (Arbeitsprofil)');
await p.evaluate(()=>oeffneRegie());await p.waitForTimeout(300);
chk(await p.evaluate(()=>!!$('rg-abd-l')&&!!$('rg-abd-0')),'Regie: Abdruck-Schalter');
await p.click('#rg-abd-0');await p.waitForTimeout(300);chk(await p.evaluate(()=>abdWert('legende')===0&&!abdSperre()),'Regie: Spuren löschen');
console.log(e.join('\n')||'keine Seitenfehler');console.log(fail?'FEHLER: '+fail:'ALLE OK');await b.close()})();
