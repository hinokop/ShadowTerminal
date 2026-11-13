const {chromium}=require('playwright');const fs=require('fs');
const K=JSON.parse(fs.readFileSync('/home/claude/Testkorpus.json','utf8'));
(async()=>{const b=await chromium.launch();const p=await (await b.newContext()).newPage();const e=[];p.on('pageerror',x=>e.push(x.message));
await p.goto('file:///home/claude/index.html');await p.waitForTimeout(5200);await p.fill('#gate-pw','pw-test-123');await p.fill('#gate-pw2','pw-test-123');await p.click('#gate-go');
await p.waitForFunction(()=>!document.body.classList.contains('locked'),null,{timeout:20000});
await p.evaluate(()=>{dispatch({type:'KENNWORT_SCHALTER',ein:false});dispatch({type:'STATUS_GESETZT',status:'Standby'});dispatch({type:'MISSION_ZUGEWIESEN',id:'M1'});dispatch({type:'MISSION_ANGENOMMEN',id:'M1'});alleEntitaeten().forEach(e=>{IZ()[e.id]={status:'frei'}});});
let n=0,ok=0;const bad=[];
for(let i=0;i<K.length;i++){const [k,t,erw]=K[i];
 const r=await p.evaluate(([k,t,i])=>{STATE.dialog={};STATE.thema={};const r=antwortFuer(k,t,'Routine','N-'+(100+i));return r?{kat:r.kat,text:r.text}:{kat:null,text:''}},[k,t,i]);
 n++;const kat=r.kat===null?'null':r.kat;if(erw.includes(kat))ok++;else bad.push(`${k}|${t}|erwartet ${erw.join('/')}|erhalten ${kat}|${(r.text||'').slice(0,60)}`);}
console.log(`Treffer ${ok}/${n} = ${(100*ok/n).toFixed(0)} %`);console.log(bad.join('\n'));console.log(e.join()||'keine Fehler');await b.close()})();
