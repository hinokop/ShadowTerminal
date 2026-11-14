const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await (await b.newContext()).newPage();
await p.goto(require('./_pfad.js').APP);await p.waitForTimeout(3000);
console.log(await p.evaluate(()=>DIALOG.absichten.map(a=>a.id+(a.frage===true?'?':a.frage===false?'!':'')).join(' ')));
console.log(await p.evaluate(()=>Object.keys(SCENARIO.antworten).join(' ')));
console.log(await p.evaluate(()=>JSON.stringify(SCENARIO.stichworte? Object.keys(SCENARIO.stichworte):Object.keys(SCENARIO).join(' '))));
await b.close()})();
