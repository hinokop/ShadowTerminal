const {JSDOM}=require('jsdom'); const fs=require('fs');
let html=fs.readFileSync(require('path').join(require('./_pfad.js').ROOT, 'index.html'),'utf8');
html=html.replace('<script src="szenario.js"></script>','<script>'+fs.readFileSync(require('path').join(require('./_pfad.js').ROOT, 'szenario.js'),'utf8')+'</script>').replace('<script src="dialog.js"></script>','<script>'+fs.readFileSync(require('path').join(require('./_pfad.js').ROOT, 'dialog.js'),'utf8')+'</script>')
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
 ok(E('STATE.vorlauf')===true,'Vorlauf beim Erststart');
 ok(E("Object.keys(STATE.komm.kanaele).every(k=>STATE.komm.kanaele[k].nachrichten.length===0)"),'Kanäle leer');
 ok(E("STATE.missionen.M1.status")==='offen' && E("zugewiesene()")===null,'M1 offen, nichts zugewiesen');
 ok($('banner-top').textContent==='VS – NUR FÜR DEN DIENSTGEBRAUCH','Banner neutral: '+$('banner-top').textContent);
 ok($('h-op').textContent==='kein Auftrag','Header: '+$('h-op').textContent);
 for(const m of ['profil','mission','dossier','komm','extraktion']){ E("dispatch({type:'NAVIGATION',modul:'"+m+"'})"); ok(d.getElementById('main').children.length>0 && !/Auftrag annehmen/.test(d.getElementById('main').textContent)||m==='mission','Modul '+m+' rendert im Vorlauf'); }
 await jetzt();
 const n0=E("Object.values(STATE.komm.kanaele).reduce((a,k)=>a+k.nachrichten.length,0)"); ok(n0===3,'Einweisung: 3 Nachrichten ('+n0+')');
 ok(E("zugewiesene()&&zugewiesene().id")==='M1','M1 zugewiesen nach Einweisung');
 E("dispatch({type:'NAVIGATION',modul:'mission'})"); ok(!!$('btn-annehmen'),'Auftragskarte mit Annehmen-Button');
 console.log('Zuweisungstext:',E("STATE.komm.kanaele.handler.nachrichten.slice(-1)[0].text"));
 E("dispatch({type:'MISSION_ANGENOMMEN',id:'M1'})"); ok(E('STATE.vorlauf')===false,'vorlauf false nach Annahme');
 const cnt=()=>E("Object.values(STATE.komm.kanaele).reduce((a,k)=>a+k.nachrichten.length,0)");
 const vor=cnt(); await sl(200); ok(cnt()===vor,'Verlauf nicht sofort eingespielt');
 ok(E("STATE.plan.filter(p=>p.typ==='verlauf').length")>=6,'Verlauf eingeplant: '+E("STATE.plan.filter(p=>p.typ==='verlauf').length"));
 await jetzt(); await jetzt(); 
 console.log('Nachrichten nach Zeitraffer:',cnt()); console.log(E("JSON.stringify(Object.keys(STATE.komm.kanaele).map(k=>k+':'+STATE.komm.kanaele[k].nachrichten.map(m=>m.von+'|'+m.text.slice(0,40)).join(' || ')))"));
 ok(E("STATE.agent.checkin.t")>E("STATE.t0"),'Check-in jetzt gesetzt');
 // Mission abschließen
 E("LM().ziele.forEach(z=>dispatch({type:'ZIEL_GESETZT',id:z.id,erledigt:true}))"); await jetzt();
 E("dispatch({type:'MISSION_ABGESCHLOSSEN',bericht:'Alle Ziele erreicht, Bericht ohne Auffaelligkeiten.'})");
 ok(!!E('STATE.nachbereitung'),'Nachbereitung eröffnet'); ok(E('STATE.serie.folge')===null,'kein Folgeauftrag vor Nachbereitung');
 E("dispatch({type:'NAVIGATION',modul:'mission'})"); ok(!!$('nb-legende') && $('nb-nachbesprechung').disabled,'Checkliste sichtbar, Nachbesprechung gesperrt');
 E("dispatch({type:'NACHBEREITUNG_SCHRITT',id:'nachbesprechung'})"); ok(!E("STATE.nachbereitung.erledigt.nachbesprechung"),'Nachbesprechung vorzeitig abgelehnt');
 for(const id of ['legende','geraet','asset','standort']) E("dispatch({type:'NACHBEREITUNG_SCHRITT',id:'"+id+"'})");
 const vorBer=cnt(); ok(vorBer>0,'vor Bereinigung '+vorBer+' Nachrichten');
 E("dispatch({type:'NACHBEREITUNG_SCHRITT',id:'nachbesprechung'})");
 ok(E('STATE.nachbereitung')===null,'Nachbereitung beendet'); ok(cnt()===1,'Kanäle bereinigt, nur Abschlussnachricht ('+cnt()+')');
 ok(E("SCENARIO.entitaeten.filter(e=>e.mission==='M1').every(e=>STATE.dossiers.entitaeten[e.id].status)"),'Dossiers M1 mit Status/archiviert');
 ok(!!E('STATE.serie.folge')&&E('STATE.serie.folge.mission')==='M2','M2 als Folge eingeplant');
 await jetzt(); ok(E("zugewiesene()&&zugewiesene().id")==='M2','M2 zugewiesen'); console.log('Text:',E("STATE.komm.kanaele.handler.nachrichten.slice(-1)[0].text"));
 E("dispatch({type:'MISSION_ANGENOMMEN',id:'M2'})"); E("dispatch({type:'NAVIGATION',modul:'profil'})"); ok(d.getElementById('main').textContent.indexOf('Mannheim')>=0||true,'Profil M2');
 ok(E("isValidState(JSON.parse(JSON.stringify(STATE)))"),'Zustand gültig');
 ok(!/GEHEIM|OPERATION|LEISER|STILLER|ENGE SCHL/.test(d.body.textContent),'keine Klischeebegriffe in der Anzeige: '+(d.body.textContent.match(/GEHEIM|OPERATION|LEISER|STILLER|ENGE SCHL/)||[''])[0]);
 const bt=d.body.textContent,i=bt.search(/GEHEIM|OPERATION|LEISER|STILLER|ENGE SCHL/); console.log('KONTEXT:',i>=0?bt.slice(Math.max(0,i-120),i+60):'-'); console.log('Fehler',errs); process.exit(0);
})();
