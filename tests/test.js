const {JSDOM}=require('jsdom'); const fs=require('fs');
let html=fs.readFileSync('/home/claude/index.html','utf8');
const sz=fs.readFileSync('/home/claude/szenario.js','utf8');
html=html.replace('<script src="szenario.js"></script>','<script>'+sz+'</script>');
// verkürzte Zeiten für den Test
html=html.replace('const SPERRE_SEK = [60, 120, 300];','const SPERRE_SEK = [2, 3, 5];')
 .replace('const AUFBAU_STUFE_MS = [1200, 2800];','const AUFBAU_STUFE_MS = [120, 280];')
 .replace('const AUFBAU_KURZ_MS = [450, 800];','const AUFBAU_KURZ_MS = [45, 80];');
const errs=[];
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',
 beforeParse(w){ w.crypto=require('crypto').webcrypto; w.TextEncoder=TextEncoder; w.matchMedia=()=>({matches:false});
  w.addEventListener('error',e=>errs.push(e.message)); }});
const w=dom.window,d=w.document,$=i=>d.getElementById(i);
const sl=ms=>new Promise(r=>setTimeout(r,ms));
const sub=async(pw,pw2)=>{ $('gate-pw').value=pw; if(pw2!=null)$('gate-pw2').value=pw2; $('gate-form').dispatchEvent(new w.Event('submit',{cancelable:true,bubbles:true})); };
const ok=(c,m)=>console.log((c?'OK   ':'FAIL ')+m);
(async()=>{
 await sl(100);
 ok(d.body.classList.contains('locked'),'gesperrt beim Start');
 ok($('gate-sub').textContent==='Erstkonfiguration','Einrichtung zuerst');
 await sub('kurz','kurz'); ok(/mindestens/.test($('gate-msg').textContent),'zu kurz abgelehnt');
 await sub('geheim-pw-123','anders'); ok(/stimmen nicht/.test($('gate-msg').textContent),'Abweichung abgelehnt');
 await sub('geheim-pw-123','geheim-pw-123');
 await sl(300); ok(!$('gate-seq').hidden,'Sequenz läuft nach Einrichtung');
 ok(!d.body.classList.contains('locked')===false,'noch gesperrt während Sequenz');
 await sl(1500);
 ok(!d.body.classList.contains('locked'),'freigegeben nach Sequenz');
 ok(w.eval('STATE').log.some(e=>e.aktion==='Zugangskennung festgelegt'),'Log: Kennung festgelegt (nachgetragen)');
 const rec=JSON.parse(w.localStorage.getItem('fieldterminal.v1.auth')); console.log(rec.algo,rec.hash.length); ok(rec.algo==='pbkdf2'&&rec.hash.length===64&&!JSON.stringify(rec).includes('geheim'),'Hash gespeichert, Klartext nicht');
 // Sperren per Taste L
 d.dispatchEvent(new w.KeyboardEvent('keydown',{key:'l',bubbles:true}));
 ok(d.body.classList.contains('locked'),'Taste L sperrt');
 ok($('gate-sub').textContent==='Zugang beschränkt','Login-Ansicht');
 await sub('falsch1'); await sl(1200); ok(/Verbleibende Versuche: 2/.test($('gate-msg').textContent),'1. Fehlversuch: '+$('gate-msg').textContent);
 await sub('falsch2'); await sl(1200); ok(/Verbleibende Versuche: 1/.test($('gate-msg').textContent),'2. Fehlversuch');
 await sub('falsch3'); await sl(1200);
 ok(/Sitzung gesperrt – erneute Authentifizierung in 1 Minute/.test($('gate-msg').textContent),'Sperre: '+$('gate-msg').textContent+' '+$('gate-count').textContent);
 ok($('gate-pw').disabled,'Eingabe gesperrt');
 await sub('geheim-pw-123'); await sl(800); ok(d.body.classList.contains('locked'),'richtige Kennung während Sperre ohne Wirkung');
 // Reload-Fest: Sperre bleibt im Speicher
 ok(JSON.parse(w.localStorage.getItem('fieldterminal.v1.auth')).sperreBis>Date.now(),'Sperre persistent (Zeitstempel)');
 await sl(2300);
 ok(!$('gate-pw').disabled,'Sperre abgelaufen, Eingabe frei');
 await sub('geheim-pw-123'); await sl(1500);
 ok(!d.body.classList.contains('locked'),'Wiederfreigabe nach Ablauf');
 ok(!!w.eval('STATE').log.find(e=>e.aktion==='Zugang gesperrt'),'Log: Sperre');
 ok(w.eval('STATE').log.filter(e=>e.krit&&e.modul==='System').length===0,'keine krit-Auth-Einträge');
 console.log('Fehler:',errs);
 process.exit(0);
})();
