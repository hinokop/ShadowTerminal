const {chromium}=require('playwright');
const T=[['handler','wieder bereit.'],['handler','Das will ich auch hoffen.'],['asset','Das will ich auch hoffen.'],['handler','Funkstille mit KIEBITZ noch 8 Minuten. Ich kümmere mich.'],['handler','Ich kümmere mich.'],['support','Funkruhe mit Asset 10 Minuten'],['asset','Funkstille für eine Stunde.']];
(async()=>{const b=await chromium.launch();const p=await (await b.newContext()).newPage();
await p.goto(require('./_pfad.js').APP);await p.waitForTimeout(5200);await p.fill('#gate-pw','pw-test-123');await p.fill('#gate-pw2','pw-test-123');await p.click('#gate-go');
await p.waitForFunction(()=>!document.body.classList.contains('locked'),null,{timeout:20000});
for(const [k,t] of T){const r=await p.evaluate(([k,t])=>{STATE.dialog={};STATE.thema={};const r=antwortFuer(k,t,'Routine','N-9');return JSON.stringify(r)},[k,t]);console.log(k,'|',t,'=>',r)}
await b.close()})();
