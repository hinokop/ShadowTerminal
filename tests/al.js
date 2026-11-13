const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1500,height:1000}})).newPage();const e=[];p.on('pageerror',x=>e.push(x.message));
await p.addInitScript(()=>{window.__ARGUS_ERGEBNIS='direkt'});
await p.goto('file:///home/claude/index.html');await p.waitForTimeout(5200);await p.keyboard.press('Space');await p.fill('#gate-pw','pw-test-123');await p.fill('#gate-pw2','pw-test-123');await p.click('#gate-go');
await p.waitForFunction(()=>!document.body.classList.contains('locked'),null,{timeout:20000});
await p.evaluate(()=>{dispatch({type:'KENNWORT_SCHALTER',an:false});dispatch({type:'STATUS_GESETZT',status:'Standby'});dispatch({type:'MISSION_ZUGEWIESEN',id:'M1'});dispatch({type:'MISSION_ANGENOMMEN',id:'M1'});dispatch({type:'MISSION_BEGINN_JETZT'});});
let fail=0;const chk=(ok,t)=>{if(!ok)fail++;console.log((ok?'OK  ':'FAIL')+' '+t)};
const due=async()=>{await p.evaluate(()=>{STATE.plan.forEach(x=>{x.faelligAm=new Date(Date.now()-1000).toISOString()})});await p.waitForTimeout(2200)};
const vor=h=>new Date(Date.now()-h*3600000).toISOString();
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
const fk=await p.evaluate(()=>{const v=new Date(Date.now()-3600000).toISOString();const r={};dispatch({type:'ALTERUNG_REGIE',faktor:0});r.aus=frische('F',v).stufe;dispatch({type:'ALTERUNG_REGIE',faktor:60});r.x60=frische('F',v).stufe;dispatch({type:'ALTERUNG_REGIE',faktor:1});r.eins=frische('F',v).stufe;r.bad=ACTIONS.ALTERUNG_REGIE({faktor:-3});return r});
chk(fk.aus==='aktuell'&&fk.x60==='veraltet'&&fk.eins==='aktuell'&&fk.bad===null,'Regie-Faktor 0 / ×60 / 1, ungültig abgelehnt');
// 2 Verbindungen
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
const id=await p.evaluate(()=>pool().find(e=>wissen(e)==='bekannt').id);
await p.evaluate(i=>{dispatch({type:'SICHTUNG_HINZU',id:i,ort:'Hof Ludwigsfelde',text:'Fahrzeug am Hof gesehen, Kennzeichen notiert',guete:'gesichert',quelle:'Eintrag'});ACTIONS.EINSCHAETZUNG_GESETZT({id:i,quelle:'E',info:'2',quelleArt:'Angabe im Kanal'})},id);
chk(await p.evaluate(i=>einreichPruefung(entitaet(i)).ok,id),'frische Einschätzung: Prüfung ok');
await p.evaluate(i=>{IZ()[i].einschaetzung.t=new Date(Date.now()-30*3600000).toISOString()},id);
const pr=await p.evaluate(i=>einreichPruefung(entitaet(i)),id);
chk(!pr.ok&&pr.einschaetzungAlt,'E-Einschätzung nach 30 h: veraltet, Prüfung scheitert');
await p.evaluate(i=>{dispatch({type:'INFO_EINGEREICHT',id:i})},id);await due();
chk(await p.evaluate(()=>/zu alt/.test(STATE.komm.kanaele.handler.nachrichten.slice(-1)[0].text)),'ARGUS verlangt neue Einschätzung');
await p.evaluate(i=>{dispatch({type:'NAVIGATION',modul:'dossier'});VIEW.dtab='info';dispatch({type:'DOSSIER_GEOEFFNET',id:i,ueber:'t',navigieren:true})},id);await p.waitForTimeout(500);
chk(await p.evaluate(()=>/veraltet/.test(document.body.innerText)&&/auffrischen/i.test(document.body.innerText)),'Rudiment zeigt "veraltet"/Auffrischen');
await p.evaluate(i=>{ACTIONS.EINSCHAETZUNG_GESETZT({id:i,quelle:'E',info:'2',quelleArt:'Angabe im Kanal'})},id);
chk(await p.evaluate(i=>einreichPruefung(entitaet(i)).ok,id),'Neu abgegeben: wieder gültig');
// 4 Zonen
const z=await p.evaluate(()=>{dispatch({type:'ZONE_ANGELEGT',ll:[52.47,13.45]});dispatch({type:'ZONE_GEAENDERT',id:'ZN-001',wertung:'akut'});const zn=karteZoneFinden('ZN-001');const o={f0:zoneFrische(zn).stufe};
 zonenEigene(zDef()).find(x=>x.id==='ZN-001').stand=new Date(Date.now()-30*3600000).toISOString();const z2=karteZoneFinden('ZN-001');o.f1=zoneFrische(z2).stufe;o.kurz=zoneKurz(z2,zoneLage(z2));return o});
chk(z.f0==='aktuell'&&z.f1==='veraltet'&&/veraltet/.test(z.kurz),'Eigene akute Zone: nach 30 h veraltet ('+z.kurz+')');
await p.evaluate(()=>{dispatch({type:'NAVIGATION',modul:'karte'});karteWaehlen('ZN-001',false)});await p.waitForTimeout(400);
chk(await p.evaluate(()=>/Stand der Einstufung/i.test($('k-auswahl').innerText)&&!!$('zn-best')),'Popup: Stand der Einstufung + Lage bestätigen');
await p.evaluate(()=>{dispatch({type:'ZONE_GEMELDET',id:'ZN-001'})});await due();
chk(await p.evaluate(()=>STATE.komm.kanaele.handler.nachrichten.slice(-3).some(m=>/Einstufung ist .* alt/.test(m.text))),'ARGUS fordert bei Meldung veralteter Zone Bestätigung');
await p.evaluate(()=>karteWaehlen('ZN-001',false));await p.waitForTimeout(200);await p.click('#zn-best');await p.waitForTimeout(300);
chk(await p.evaluate(()=>zoneFrische(karteZoneFinden('ZN-001')).stufe==='aktuell'),'Lage bestätigen erneuert');
// Standortzone mit Einstufung ≥4
await p.evaluate(()=>{const u=zonenUrteil(zDef());u['ZA-S-02']={stufe:5,status:'frei',t:new Date(Date.now()-30*3600000).toISOString()}});
chk(await p.evaluate(()=>zoneFrische(karteZoneFinden('ZA-S-02')).stufe==='veraltet'),'Standortzone Stufe 5 nach 30 h veraltet');
chk(await p.evaluate(()=>{const u=zonenUrteil(zDef());u['ZA-S-03']={stufe:2,status:'frei',t:new Date(Date.now()-30*3600000).toISOString()};return karteZoneFrische=zoneFrische(karteZoneFinden('ZA-S-03')).stufe==='aktuell'||zoneFrische(karteZoneFinden('ZA-S-03')).stufe==='alternd'}),'Ruhige Zone (Stufe 2) altert langsamer (7 d)');
// 5 Freigabe
const fgR=await p.evaluate(()=>{alleEntitaeten().forEach(e=>{IZ()[e.id]={status:'frei'}});akteurDaten('handler').vertrauen=90;const def=LM(),ms=MS(def.id);const org=pool().find(e=>e.typ==='Organisation'&&e.id!=='P-0001');
 ms.dokumente.push({id:'D-ALT',t:new Date(Date.now()-100*3600000).toISOString(),art:'Foto',entitaet:org.id,notiz:'alt',name:'a.png'});
 const T='Die Organisation wurde gestern am Zwischenlager gesehen, ich habe Fotos und das Kennzeichen, um Zugang und Ladung zu belegen.';
 const art=FG_ARTEN.find(x=>x.id==='sabotage');const r1=fgBewerten(def,art,org,T,'Routine');
 ms.dokumente[ms.dokumente.length-1].t=new Date().toISOString();const r2=fgBewerten(def,art,org,T,'Routine');return {org:org.id,r1,r2}});
console.log(JSON.stringify(fgR).slice(0,500));
chk(/nicht mehr frisch/.test(fgR.r1.grund||''),'Freigabe: veralteter Beleg wird beanstandet (oder früherer Grund)');
chk(!/nicht mehr frisch/.test(fgR.r2.grund||'')&&/Streckenanalyse|Zugang/.test(fgR.r2.grund||'')||fgR.r2.urteil!=='abgelehnt','Freigabe: frischer Beleg: keine Alterungsablehnung');
// Regie-UI
await p.evaluate(()=>oeffneRegie());await p.waitForTimeout(400);
chk(await p.evaluate(()=>/Alterung von Wissen/i.test(document.getElementById('regie')?.innerText||'')&&!!$('rg-alt-60')),'Regie-Konsole zeigt Alterungsschalter');
await p.click('#rg-alt-60');await p.waitForTimeout(300);chk(await p.evaluate(()=>altS().faktor===60),'Regie ×60 wirkt');
await p.click('#rg-alt-1');await p.waitForTimeout(200);
chk(await p.evaluate(()=>!document.querySelector('.err')),'keine Fehleranzeige');
console.log(e.join('\n')||'keine Seitenfehler');console.log(fail?'FEHLER: '+fail:'ALLE OK');await b.close()})();
