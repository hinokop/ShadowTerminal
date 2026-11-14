const {JSDOM}=require('jsdom'); const fs=require('fs');
let html=fs.readFileSync(require('path').join(require('./_pfad.js').ROOT, 'index.html'),'utf8');
html=html.replace('<script src="szenario.js"></script>','<script>'+fs.readFileSync(require('path').join(require('./_pfad.js').ROOT, 'szenario.js'),'utf8')+'</script>').replace('<script src="dialog.js"></script>','<script>'+fs.readFileSync(require('path').join(require('./_pfad.js').ROOT, 'dialog.js'),'utf8')+'</script>').replace('<script src="karte.js"></script>','<script>'+fs.readFileSync(require('path').join(require('./_pfad.js').ROOT, 'karte.js'),'utf8')+'</script>')
 .replace('const AUFBAU_STUFE_MS = [1200, 2800];','const AUFBAU_STUFE_MS = [60, 80];').replace('const AUFBAU_KURZ_MS = [450, 800];','const AUFBAU_KURZ_MS = [20, 30];');
const errs=[];
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',
 beforeParse(w){ w.crypto=require('crypto').webcrypto; w.TextEncoder=TextEncoder; w.matchMedia=()=>({matches:false}); w.addEventListener('error',e=>errs.push(e.message)); }});
const w=dom.window,d=w.document,$=i=>d.getElementById(i);
const sl=ms=>new Promise(r=>setTimeout(r,ms)); const E=x=>w.eval(x);
const ok=(c,m)=>console.log((c?'OK   ':'FAIL ')+m);
const jetzt=async()=>{ E("STATE.plan.forEach(function(p){p.faelligAm=new Date(Date.now()-1000).toISOString()}); if(STATE.serie.folge) STATE.serie.folge.faelligAm=new Date(Date.now()-1000).toISOString();"); await sl(1300); };
(async()=>{
 await sl(100); $('gate-pw').value='geheim-pw-123'; $('gate-pw2').value='geheim-pw-123';
 $('gate-form').dispatchEvent(new w.Event('submit',{cancelable:true,bubbles:true})); await sl(1500);
 // Begriffe
 E("dispatch({type:'STATUS_GESETZT',status:'Standby'})"); await jetzt();
 ok(/SEKTION 9 · NUR FÜR AUTORISIERTE EMPFÄNGER/.test($('banner-top').textContent),'Banner Vorlauf: '+$('banner-top').textContent);
 ok(E("SCENARIO.bedrohungsstufen[3]")==='Sicherheitsrelevant','neue Skala');
 // Karte ohne Mission
 E("dispatch({type:'NAVIGATION',modul:'karte'})"); ok(!!$('k-svg'),'Karte rendert'); 
 ok(d.querySelectorAll('.k-marker').length>=10,'Marker im Vorlauf: '+d.querySelectorAll('.k-marker').length);
 ok(d.querySelectorAll('path.k-land').length===1 && $('k-svg').querySelector('path.k-land').getAttribute('d').length>1000,'Länderumrisse gezeichnet');
 // Akten im Vorlauf
 E("dispatch({type:'NAVIGATION',modul:'akten'})"); ok(!!$('akte-blatt'),'Akte sichtbar');
 ok(d.querySelectorAll('#akte-blatt .rd').length===1,'Schwärzungen im Handbuch (nur nicht sichtbare): '+d.querySelectorAll('#akte-blatt .rd').length);
 ok(!/Bergungsverfahren/.test($('akte-blatt').textContent) && !/zwei Stunden/.test($('akte-blatt').textContent),'Geschwärzter Text nicht im DOM');
 E("dispatch({type:'AKTE_ANTRAG',doc:'D-STD-01',r:'a'})"); ok(!!E("STATE.akten.anfragen['D-STD-01:a']"),'Antrag erfasst');
 E("dispatch({type:'AKTE_ANTRAG',doc:'D-STD-01',r:'d'})"); ok(!E("STATE.akten.anfragen['D-STD-01:d']"),'Stufe 5 nicht beantragbar');
 await jetzt(); ok(E("STATE.akten.freigaben['D-STD-01:a']")===true,'Freigabe erteilt');
 ok(/zwei Stunden/.test($('akte-blatt').textContent),'freigegebener Text sichtbar');
 E("dispatch({type:'AKTE_ANTRAG',doc:'D-STD-01',r:'b'})"); await jetzt(); ok(!E("STATE.akten.freigaben['D-STD-01:b']"),'Antrag abgelehnt');
 ok(E("Object.values(STATE.komm.kanaele.handler.nachrichten).some(m=>/Akte D-STD-01/.test(m.text))"),'Handler-Antwort im Kanal');
 // Mission annehmen
 E("dispatch({type:'MISSION_ANGENOMMEN',id:'M1'})");
 ok(E("MS('M1').status")==='laufend','M1 angenommen');
 ok(E("STATE.agent.checkin.standortId")===null,'Check-in bis Ankunft offen');
 E("dispatch({type:'NAVIGATION',modul:'mission'})");
 ok(!!$('btn-anreise'),'Anreisepanel');
 ok(/ZUGANG STUFE 2/.test($('banner-top').textContent),'Banner Mission: '+$('banner-top').textContent);
 const opts=[...$('an-abf').options].map(o=>o.value); ok(opts.length>=8,'Abfahrtsoptionen '+opts.join(','));
 // ungültig: Flug sofort nach 1 h vor Beginn?? Ankunft nach Beginn bei 1h und 540min Bus
 const bad=E("anreiseBewerten(KM(),{mittel:'bus',abfahrtH:3,unterkunft:'haupt',erkundung:false},Date.now())"); ok(bad&&!bad.gueltig,'Ankunft nach Beginn ungültig: '+bad.grund);
 E("dispatch({type:'ANREISE_EINGEREICHT',mittel:'bus',abfahrtH:3,unterkunft:'haupt',erkundung:false})"); ok(!E("STATE.anreise"),'ungültiger Plan nicht übernommen');
 E("dispatch({type:'ANREISE_EINGEREICHT',mittel:'flug',abfahrtH:24,unterkunft:'ausweich',erkundung:true})");
 const an=E("STATE.anreise"); ok(an&&an.risiko>=40&&an.stufe==='hoch','Plan mit Risiko '+(an&&an.risiko)+' '+(an&&an.stufe));
 E("dispatch({type:'ANREISE_EINGEREICHT',mittel:'bahn',abfahrtH:12,unterkunft:'haupt',erkundung:false})");
 const an2=E("STATE.anreise"); ok(an2&&an2.mittel==='bahn'&&an2.risiko<25,'Plan geändert, niedrig: '+(an2&&an2.risiko));
 ok(E("STATE.plan.filter(p=>p.typ==='anreise_ankunft').length")===1 && E("STATE.plan.filter(p=>p.anreise).length")===1,'alter Plan ersetzt');
 ok(E("STATE.plan.some(p=>p.typ==='anreise_pruefung')"),'Prüfung zum Beginn geplant');
 E("dispatch({type:'NAVIGATION',modul:'karte'})"); ok(d.querySelectorAll('.k-route').length===1,'Route auf Karte');
 ok(d.querySelectorAll('.k-fenster').length>=2,'Fensterringe '+d.querySelectorAll('.k-fenster').length);
 // Ankunft
 E("STATE.plan.filter(p=>p.typ==='anreise_ankunft').forEach(p=>p.faelligAm=new Date(Date.now()-1000).toISOString())"); await sl(1300);
 ok(E("STATE.anreise.angekommen")===true && E("STATE.agent.checkin.standortId")==='S-01','Ankunft: Check-in S-01');
 ok(E("isValidState(JSON.parse(JSON.stringify(STATE)))"),'Zustand gültig');
 // Beginn ohne Plan (neu testen mit M2 später); hier Beginn jetzt
 E("MS('M1').beginn=new Date(Date.now()-1000).toISOString()"); 
 E("STATE.plan.filter(p=>p.typ==='anreise_pruefung').forEach(p=>p.faelligAm=new Date(Date.now()-1000).toISOString())"); await sl(1300);
 ok(E("STATE.anreise.ohnePlan")!==true,'Prüfung ohne Wirkung bei vorhandenem Plan');
 // Dossier-Bild
 const bild='data:image/jpeg;base64,'+'A'.repeat(200);
 E("dispatch({type:'DOSSIER_BILD',id:'P-9001',bild:'"+bild+"'})"); ok(E("bildPfad(entitaet('P-9001'),'P-9001')")===bild,'Foto-Override');
 E("dispatch({type:'DOSSIER_BILD',id:'P-9001',bild:'http://evil/x.png'})"); ok(E("bildPfad(entitaet('P-9001'),'P-9001')")===bild,'ungültiges Bild abgelehnt');
 E("dispatch({type:'DOSSIER_BILD',id:'P-9001',bild:null})"); ok(E("bildPfad(entitaet('P-9001'),'P-9001')")==='bilder/p-9001.jpg','Foto entfernt');
 E("dispatch({type:'DOSSIER_ANGELEGT',typ:'Person',name:'Foto Test',land:'AE',aliase:'',rolle:'x',eckdaten:'',stufe:'4',bild:'"+bild+"'})");
 const nid=E("STATE.dossiers.auswahl"); ok(E("bildPfad(entitaet('"+nid+"'),'"+nid+"')")===bild,'Neues Dossier mit Foto');
 E("dispatch({type:'NAVIGATION',modul:'dossier'})"); ok(!!$('fx-bild'),'Foto-Upload im Dossier');
 w.eval("neuesDossier()"); ok(!!$('nd-bild') && /Gefährlich/.test($('nd-stufe').textContent),'Upload-Feld im Formular, neue Skala'); 
 // Nachbereitung räumt auf
 E("LM().ziele.forEach(z=>dispatch({type:'ZIEL_GESETZT',id:z.id,erledigt:true}))");
 E("dispatch({type:'MISSION_ABGESCHLOSSEN',bericht:'Alle Ziele erreicht, Bericht ohne Auffaelligkeiten.'})");
 ['legende','geraet','asset','standort','nachbesprechung'].forEach(i=>E("dispatch({type:'NACHBEREITUNG_SCHRITT',id:'"+i+"'})"));
 ok(E("STATE.anreise")===null && Object.keys(E("STATE.akten.freigaben")).length===0,'Nachbereitung: Anreise und Freigaben zurückgesetzt');
 // M2 ohne Plan bis Beginn
 await jetzt(); E("dispatch({type:'MISSION_ANGENOMMEN',id:'M2'})");
 E("MS('M2').beginn=new Date(Date.now()-1000).toISOString(); STATE.plan.filter(p=>p.typ==='anreise_pruefung').forEach(p=>p.faelligAm=new Date(Date.now()-1000).toISOString())"); await sl(1300);
 ok(E("STATE.anreise&&STATE.anreise.ohnePlan")===true && E("STATE.agent.checkin.standortId")==='S-11','Ohne Plan: Risiko 70, Standort S-11');
 // Alle Module rendern ohne Fehler
 ['profil','mission','dossier','komm','extraktion','karte','akten'].forEach(m=>{ E("dispatch({type:'NAVIGATION',modul:'"+m+"'})"); ok(d.getElementById('mod-title')&&true,'Modul '+m+' rendert'); });
 ok(E("isValidState(JSON.parse(JSON.stringify(STATE)))"),'Zustand gültig (Ende)');
 console.log('Fehler',errs);
 process.exit(0);
})();
