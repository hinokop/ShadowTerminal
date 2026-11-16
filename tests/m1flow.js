const {chromium}=require('playwright');
const ok=(c,m)=>console.log((c?'OK   ':'FAIL ')+m);
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1400,height:1000}})).newPage();const e=[];p.on('pageerror',x=>e.push(x.message));p.on('console',m=>{if(m.type()==='error')e.push('C:'+m.text())});
await p.goto(require('./_pfad.js').APP);await p.waitForTimeout(5200);await p.fill('#gate-pw','pw-test-123');await p.fill('#gate-pw2','pw-test-123');await p.click('#gate-go');
await p.waitForFunction(()=>!document.body.classList.contains('locked'),null,{timeout:20000});
await p.evaluate(()=>{dispatch({type:'STATUS_GESETZT',status:'Standby'});dispatch({type:'MISSION_ZUGEWIESEN',id:'M1'});dispatch({type:'MISSION_ANGENOMMEN',id:'M1'});alleEntitaeten().forEach(e=>{IZ()[e.id]={status:'frei'}});
 MS('M1').beginn=new Date(Date.now()-120000).toISOString();Store.save(STATE);render()});await p.keyboard.press('2');
await p.waitForTimeout(600);
ok(await p.isVisible('#btn-dok'),'Dokumentpanel');ok(await p.isVisible('#btn-zp'),'Zugriffspanel');ok(await p.isVisible('#btn-ez'),'Eigene Ziele');
// eigene Ziele
await p.fill('#ez-text','Beschaffen Foto von Neumann');await p.click('#btn-ez');await p.waitForTimeout(200);
ok(await p.evaluate(()=>MS('M1').eigene.length===1),'eigenes Ziel angelegt');
// Zähler
ok(await p.evaluate(()=>document.getElementById('zz-Z-P1').textContent.startsWith('0 von 4')),'Zähler Fotos 0/4');
ok(await p.evaluate(()=>document.getElementById('z-Z-P1').disabled),'Ziel gesperrt');
// Dokument
await p.setInputFiles('#dk-datei','/tmp/t/x.png');await p.selectOption('#dk-ent','P-0015');await p.selectOption('#dk-art','Frachtbrief');await p.click('#btn-dok');await p.waitForTimeout(600);
ok(await p.evaluate(()=>MS('M1').dokumente.length===1),'Dokument eingereicht');
console.log(await p.evaluate(()=>JSON.stringify(STATE.plan.filter(x=>x.typ==='verlauf').map(x=>x.text.slice(0,60)))));
ok(await p.evaluate(()=>IDB.get('DOK-001').then(b=>!!b&&b.size>0)),'Blob im IndexedDB');
// Zugriff
const pt=async(typ,bez,txt)=>{await p.selectOption('#zp-typ',typ);await p.selectOption('#zp-bezug',bez);await p.fill('#zp-text',txt);await p.click('#btn-zp');await p.waitForTimeout(200);};
await pt('Zugriff','L-0002','Tordurchfahrt Sonnenallee, einzige Zufahrt');
await pt('Eingriff','L-0008','Rastplatz nahe Zwischenlager, Wartezeiten');
await p.click('#btn-zp-ein');await p.waitForTimeout(300);
console.log(await p.evaluate(()=>JSON.stringify(MS('M1').zugriffUrteil)));
await pt('Zugriff','L-0009','Stadtbrücke Frankfurt, Kontrolle vor der Grenze');
await p.click('#btn-zp-ein');await p.waitForTimeout(300);
console.log(await p.evaluate(()=>JSON.stringify(MS('M1').zugriffUrteil)));
ok(await p.evaluate(()=>MS('M1').zugriffUrteil.ok),'Analyse brauchbar');
// Wissen ohne Beleg
await p.selectOption('#wi-s-P-0007','unwissentlich');await p.fill('#wi-b-P-0007','Händler nutzen die Werkstatt, Inhalt der Kisten vermutlich unbekannt');await p.click('#wi-g-P-0007');await p.waitForTimeout(200);
ok(await p.evaluate(()=>!MS('M1').wissen['P-0007']),'ohne Beleg abgewiesen');
// Lagebericht mit Begegnung + Kennung
await p.fill('#lb-text','Gespräch mit P-0015 am Tor, wirkt nervös und kennt die Kisten, P-0007 hat Ware geliefert.');await p.click('#btn-lb');await p.waitForTimeout(200);
ok(await p.evaluate(()=>MS('M1').treffen===1),'Begegnung gezählt');
await p.selectOption('#wi-s-P-0015','wissentlich');await p.fill('#wi-b-P-0015','Kannte die Kisten und wirkte nervös am Tor, Beobachtung im Lagebericht');await p.click('#wi-g-P-0015');await p.waitForTimeout(200);
ok(await p.evaluate(()=>MS('M1').wissen['P-0015'].stand==='bestaetigt'),'Wissensstand bestätigt');
await p.selectOption('#wi-s-P-0007','wissentlich');await p.fill('#wi-b-P-0007','Händler nutzen die Werkstatt, P-0007 liefert Ware, Inhalt wird gekannt');await p.click('#wi-g-P-0007');await p.waitForTimeout(200);
ok(await p.evaluate(()=>MS('M1').wissen['P-0007'].stand==='widerspruch'),'Widerspruch Versuch 1');
await p.selectOption('#wi-s-P-0007','unbeteiligt');await p.fill('#wi-b-P-0007','Händler nutzen die Werkstatt, P-0007 liefert Ware, Inhalt wird gekannt');await p.click('#wi-g-P-0007');await p.waitForTimeout(200);
ok(await p.evaluate(()=>MS('M1').wissen['P-0007'].stand==='festgelegt'),'festgelegt nach 2. Versuch');
// Fotos
await p.evaluate(()=>{['P-0015','P-0016','P-0006','P-0013'].forEach(id=>{PROFIL.bilder[id]='data:image/png;base64,AAAA';});render();});await p.waitForTimeout(300);
ok(await p.evaluate(()=>zielIst(LM(),LM().ziele[0])===4),'Foto-Zähler 4');
await p.evaluate(()=>{dispatch({type:'ZIEL_GESETZT',id:'Z-P1',erledigt:true})});
ok(await p.evaluate(()=>MS('M1').ziele['Z-P1'].erledigt),'Ziel P1 erledigt');
await p.screenshot({path:'m1flow.png',fullPage:true});
// Abbruch
await p.click('#btn-abbruch');await p.waitForTimeout(300);
console.log(await p.evaluate(()=>document.querySelector('dialog,.modal,#dlg')?.innerText.slice(0,300)||'kein Dialog'));
await p.evaluate(()=>dispatch({type:'MISSION_ABGEBROCHEN',begruendung:'Enttarnungsgefahr durch Begleitschutz.'}));await p.waitForTimeout(300);
console.log(await p.evaluate(()=>JSON.stringify({st:MS('M1').status,u:MS('M1').uebergabe,plan:STATE.plan.filter(x=>x.typ==='verlauf').length})));
console.log(e.join('\n')||'keine Fehler');await b.close()})();
