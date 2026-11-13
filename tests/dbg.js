const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await (await b.newContext()).newPage();
await p.goto('file:///home/claude/index.html');await p.waitForTimeout(5200);await p.keyboard.press('Space');await p.fill('#gate-pw','pw-test-123');await p.fill('#gate-pw2','pw-test-123');await p.click('#gate-go');
await p.waitForFunction(()=>!document.body.classList.contains('locked'),null,{timeout:20000});
for(const [k,t] of [['asset','Hast du schon gegessen?'],['handler','Wie war dein Wochenende?'],['asset','Wie war dein Wochenende?']]){
 const r=await p.evaluate(([k,t])=>{const a=DIALOG.absichten.find(x=>{const m=dlgMatcher(t);if(x.nurKanal&&x.nurKanal.indexOf(k)<0)return false;return x.muster?new RegExp(x.muster,'i').test(t):m.trifft(x.stamm)&&!(x.nicht&&m.trifft(x.nicht))});return a?a.id:null},[k,t]);console.log(t,'->',r)}
await b.close()})();
