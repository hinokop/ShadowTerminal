const {chromium}=require('playwright');
const T=[['handler','wieder bereit.'],['handler','Ich bin wieder da.'],['handler','Das will ich auch hoffen.'],['asset','Das will ich auch hoffen.'],['asset','Gibt es was Neues?'],['handler','Was wissen wir bisher?']];
(async()=>{const b=await chromium.launch();const p=await (await b.newContext()).newPage();
await p.goto(require('./_pfad.js').APP);await p.waitForTimeout(5200);await p.fill('#gate-pw','pw-test-123');await p.fill('#gate-pw2','pw-test-123');await p.click('#gate-go');
await p.waitForFunction(()=>!document.body.classList.contains('locked'),null,{timeout:20000});
for(const [k,t] of T){const r=await p.evaluate(([k,t])=>{STATE.dialog={};STATE.thema={};const r=antwortFuer(k,t,'Routine','N-9');return r?r.kat+' | '+(r.teile?r.teile.join(' / '):r.text||''):null},[k,t]);console.log(k,'|',t,'=>',String(r).slice(0,110));}
await b.close()})();
