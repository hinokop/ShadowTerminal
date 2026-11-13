const {JSDOM}=require('jsdom'); const fs=require('fs');
let html=fs.readFileSync('/home/claude/index.html','utf8');
html=html.replace('<script src="szenario.js"></script>','<script>'+fs.readFileSync('/home/claude/szenario.js','utf8')+'</script>').replace('<script src="dialog.js"></script>','<script>'+fs.readFileSync('/home/claude/dialog.js','utf8')+'</script>')
 .replace('const AUFBAU_STUFE_MS = [1200, 2800];','const AUFBAU_STUFE_MS = [60, 80];').replace('const AUFBAU_KURZ_MS = [450, 800];','const AUFBAU_KURZ_MS = [20, 30];');
const errs=[];
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',
 beforeParse(w){ w.crypto=require('crypto').webcrypto; w.TextEncoder=TextEncoder; w.matchMedia=()=>({matches:false}); w.addEventListener('error',e=>errs.push(e.message)); }});
const w=dom.window,d=w.document,$=i=>d.getElementById(i);
const sl=ms=>new Promise(r=>setTimeout(r,ms)); const E=x=>w.eval(x);
const ok=(c,m)=>console.log((c?'OK   ':'FAIL ')+m);
const jetzt=async()=>{ E("STATE.plan.forEach(function(p){p.faelligAm=new Date(Date.now()-1000).toISOString()}); if(STATE.serie.folge) STATE.serie.folge.faelligAm=new Date(Date.now()-1000).toISOString();"); await sl(1300); };
const cnt=()=>E("Object.values(STATE.komm.kanaele).reduce((a,k)=>a+k.nachrichten.length,0)");
(async()=>{
 await sl(100); $('gate-pw').value='geheim-pw-123'; $('gate-pw2').value='geheim-pw-123';
 $('gate-form').dispatch||0; $('gate-form').dispatchEvent(new w.Event('submit',{cancelable:true,bubbles:true})); await sl(1500);
 ok(E('STATE.agent.status')==='Ruhend','Start im Status Ruhend');
 await jetzt(); ok(cnt()===0 && E('STATE.plan.length')===0 && E('STATE.serie.folge')===null,'Ruhend: nichts geschieht');
 E("dispatch({type:'STATUS_GESETZT',status:'Standby'})"); ok(E('STATE.plan.length')===3 && !!E('STATE.serie.folge'),'Standby: Einweisung geplant');
 await jetzt(); ok(cnt()>=4 && E("zugewiesene()&&zugewiesene().id")==='M1','Einweisung + Auftrag M1 ('+cnt()+')');
 // Ruhend nach Zuweisung: Annahme blockiert
 E("dispatch({type:'STATUS_GESETZT',status:'Ruhend'})"); E("dispatch({type:'MISSION_ANGENOMMEN',id:'M1'})"); ok(E("MS('M1').status")==='zugewiesen','Annahme im Ruhend-Status blockiert');
 E("dispatch({type:'NAVIGATION',modul:'mission'})"); ok($('btn-annehmen').disabled,'Button gesperrt');
 E("dispatch({type:'STATUS_GESETZT',status:'Aktiv'})"); E("dispatch({type:'MISSION_ANGENOMMEN',id:'M1'})");
 ok(E("MS('M1').status")==='laufend','M1 angenommen');
 const b=Date.parse(E("MS('M1').beginn")), a=Date.parse(E("MS('M1').angenommenAm"));
 ok(Math.round((b-a)/3600000)===48,'Einsatzbeginn +48 h');
 ok(E("einsatzLaeuft()")===false,'Einsatz läuft noch nicht');
 ok(/ruht · Einsatzbeginn in/.test($('h-melde').textContent||E("meldeText(Date.now())")),'Meldewesen ruht bis Beginn: '+E("meldeText(Date.now())"));
 E("dispatch({type:'ZIEL_GESETZT',id:'Z-P1',erledigt:true})"); ok(E("MS('M1').ziele['Z-P1'].erledigt")===false,'Ziel vor Einsatzbeginn nicht abhakbar');
 ok(E("STATE.plan.filter(p=>p.typ==='skript').every(p=>Date.parse(p.faelligAm)>=Date.parse(MS('M1').beginn))"),'Skript erst ab Einsatzbeginn');
 ok(E("Object.values(MS('M1').zeitfenster).every(z=>Date.parse(z.von)>=Date.parse(MS('M1').angenommenAm)-1300*60000)"),'Zeitfenster relativ zum Beginn');
 // Zeitsprung: Beginn jetzt
 E("MS('M1').beginn=new Date(Date.now()-1000).toISOString()"); ok(E("einsatzLaeuft()"),'Einsatz läuft nach Beginn');
 E("dispatch({type:'ZIEL_GESETZT',id:'Z-P1',erledigt:true})"); ok(E("MS('M1').ziele['Z-P1'].erledigt")===true,'Ziel danach abhakbar');
 // Ruhend nicht während Auftrag
 E("dispatch({type:'STATUS_GESETZT',status:'Ruhend'})"); ok(E('STATE.agent.status')!=='Ruhend','Ruhend während laufendem Auftrag abgelehnt');
 // Dossier
 E("dispatch({type:'NAVIGATION',modul:'dossier'})"); ok(!!$('btn-dneu'),'Button Neues Dossier'); 
 ok(E("pool().filter(e=>e.mission==='STD').length")===5,'5 Dummies im Pool');
 E("dispatch({type:'DOSSIER_ANGELEGT',typ:'Person',name:'Karl Test',land:'NL',aliase:'KT, Karl',rolle:'Kontakt aus Rotterdam',eckdaten:'Jahrgang 1990\\nFahrer',stufe:'3'})");
 const id=E("STATE.dossiers.auswahl"); ok(/^P-91\d\d$/.test(id),'Eigenes Dossier '+id);
 E("dispatch({type:'VERBINDUNG_ANGELEGT',von:'"+id+"',nach:'P-9001',typ:'Kontakt',bewertung:'C3',beidseitig:true})"); ok(E("kantenPool().some(v=>v.von==='"+id+"')"),'Verbindung im Graph');
 ok(!!$('btn-dx') && !!$('btn-vn'),'Dossier-UI: Löschen und Verbindung');
 ok(E("isValidState(JSON.parse(JSON.stringify(STATE)))"),'Zustand gültig inkl. eigenem Dossier');
 E("dispatch({type:'DOSSIER_GELOESCHT',id:'"+id+"'})"); ok(!E("entitaet('"+id+"')")&&E("STATE.dossiers.eigeneKanten.length")===0,'Löschen entfernt Dossier und Kanten');
 // Dialog: Dossierkennung
 const r=E("antwortFuer('handler','Was ist mit P-9001?','Routine','N-900')"); console.log('Dialog:',r&&r.kat,'|',r&&r.text);
 // Pause-Verschiebung: Mission abschließen, Ruhend, warten
 E("LM().ziele.forEach(z=>dispatch({type:'ZIEL_GESETZT',id:z.id,erledigt:true}))");
 E("dispatch({type:'MISSION_ABGESCHLOSSEN',bericht:'Alle Ziele erreicht, Bericht ohne Auffaelligkeiten.'})");
 ['legende','geraet','asset','standort','nachbesprechung'].forEach(i=>E("dispatch({type:'NACHBEREITUNG_SCHRITT',id:'"+i+"'})"));
 ok(!!E('STATE.serie.folge'),'Folge M2 geplant'); 
 E("dispatch({type:'STATUS_GESETZT',status:'Ruhend'})"); const f0=Date.parse(E('STATE.serie.folge.faelligAm'));
 E("STATE.pause=new Date(Date.now()-600000).toISOString()");
 E("dispatch({type:'STATUS_GESETZT',status:'Standby'})"); const f1=Date.parse(E('STATE.serie.folge.faelligAm'));
 ok(f1-f0>=590000,'Pause verschiebt Folgeauftrag um ~10 min ('+Math.round((f1-f0)/1000)+' s)');
 await jetzt(); E("dispatch({type:'MISSION_ANGENOMMEN',id:'M2'})"); ok(E("MS('M2').status")==='laufend','M2 angenommen');
 // M3 Funkstille ab Beginn
 E("MS('M2').status='abgeschlossen'; MS('M3').status='zugewiesen'; STATE.kontext='M2'");
 E("dispatch({type:'MISSION_ANGENOMMEN',id:'M3'})");
 ok(E('STATE.funkstille.aktiv')===false && E("STATE.plan.some(p=>p.typ==='funkstille')"),'Funkstille M3 erst zum Einsatzbeginn geplant');
 E("STATE.plan.forEach(p=>{p.faelligAm=new Date(Date.now()-1000).toISOString()})"); await sl(1300);
 ok(E('STATE.funkstille.aktiv')===true,'Funkstille aktiv nach Beginn');
 console.log('Fehler',errs); process.exit(0);
})();
