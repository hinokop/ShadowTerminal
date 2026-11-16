const {JSDOM}=require('jsdom'); const fs=require('fs');
let html=fs.readFileSync(require('path').join(require('./_pfad.js').ROOT, 'index.html'),'utf8');
const sz=fs.readFileSync(require('path').join(require('./_pfad.js').ROOT, 'szenario.js'),'utf8'), dl=fs.readFileSync(require('path').join(require('./_pfad.js').ROOT, 'dialog.js'),'utf8');
const noDlg=process.argv[2]==='nodlg';
html=html.replace('<script src="szenario.js"></script>','<script>'+sz+'</script>').replace('<script src="dialog.js"></script>',noDlg?'':'<script>'+dl+'</script>')
 .replace('const AUFBAU_STUFE_MS = [1200, 2800];','const AUFBAU_STUFE_MS = [60, 80];').replace('const AUFBAU_KURZ_MS = [450, 800];','const AUFBAU_KURZ_MS = [20, 30];');
const errs=[];
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',
 beforeParse(w){ w.crypto=require('crypto').webcrypto; w.TextEncoder=TextEncoder; w.matchMedia=()=>({matches:false}); w.addEventListener('error',e=>errs.push(e.message)); }});
const w=dom.window,d=w.document,$=i=>d.getElementById(i);
const sl=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 await sl(100); $('gate-pw').value='geheim-pw-123'; $('gate-pw2').value='geheim-pw-123';
 $('gate-form').dispatchEvent(new w.Event('submit',{cancelable:true,bubbles:true})); await sl(1500);
 const say=(k,t,dr,id)=>{ const r=w.eval('antwortFuer')(k,t,dr||'Routine',id); console.log(k.padEnd(8),JSON.stringify(t).padEnd(42),'=>',r?('['+r.kat+'] '+r.text+(r.frage?'  {Q:'+r.frage+'}':'')):'(keine)'); return r; };
 console.log('Kontext',w.eval('STATE.kontext'),'Locked',d.body.classList.contains('locked'),'Fehler',errs);
 const T=[['handler','Hallo'],['handler','Wie geht es Ihnen?'],['handler','Bin angekommen'],['handler','Alles ruhig hier'],['handler','Ich habe keine Angst'],['handler','Ich habe Angst'],
 ['handler','Wie spät ist es?'],['handler','Wo bin ich?'],['handler','Was ist mit P-0099?'],['handler','Was ist mit P-9999?'],['handler','blorp frimble'],['handler','Warum ist der Himmel blau?'],
 ['handler','Danke'],['handler','Brauche Hilfe, werde verfolgt'],['handler','Extraktion bitte'],['handler','x'],
 ['support','Wir brauchen ein Fahrzeug'],['support','Mein Handy-Akku ist leer'],['support','Hallo'],['support','Bis später'],
 ['asset','Hallo'],['asset','Wie geht es dir?'],['asset','Können wir uns treffen?'],['asset','Ich bin müde'],['asset','Wer bist du?'],['asset','Was hältst du davon?']];
 let i=100; T.forEach(([k,t])=>say(k,t,'Routine','N-'+(++i)));
 console.log('--- Wiederholung / zu lang');
 w.eval('STATE.komm.kanaele.handler.nachrichten.push({id:"N-900",von:"agent",absender:"X",t:new Date().toISOString(),text:"Lagebericht folgt",status:"gesendet"})');
 say('handler','Lagebericht folgt','Routine','N-901'); say('handler','a '.repeat(250),'Routine','N-902');
 say('handler','Wie bitte?','Routine','N-903');
 console.log('--- Rückfrage-Zyklus via nachrichtSenden');
 const k=w.eval('kanalDef')('handler'), out=[];
 w.eval('STATE.dialog=null');
 const send=(t,id)=>{ w.eval('STATE.seq.nachricht='+(id-1)); const o=[]; w.eval('nachrichtSenden')(k,t,'Routine',o); const p=w.eval('STATE.plan').filter(x=>x.typ==='antwort').pop(); console.log('>',t.padEnd(22),'=>',p?p.text:'(keine)','| offen:',JSON.stringify(w.eval('STATE.dialog&&STATE.dialog.handler&&STATE.dialog.handler.offen&&STATE.dialog.handler.offen.id'))); };
 send('Hallo',2); send('Alles ruhig',4); send('ja',6); send('Danke',8); send('Moin',10); send('nein',12);
 console.log('--- Funkstille blockiert');
 w.eval('STATE.funkstille={aktiv:true,seit:new Date().toISOString(),mission:STATE.kontext}'); const n0=w.eval('STATE.plan.length'); send('Hallo',14); console.log('Plan vorher/nachher',n0,w.eval('STATE.plan.length'));
 console.log('Fehler',errs); process.exit(0);
})();
