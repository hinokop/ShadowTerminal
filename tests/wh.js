const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await (await b.newContext()).newPage();
await p.goto('file:///home/claude/index.html');await p.waitForTimeout(1500);
console.log(await p.evaluate(()=>{const d=SCENARIO.missionen.find(m=>m.wahrheit);return JSON.stringify(Object.keys(d.wahrheit).map(id=>{const e=entitaet(id);return [d.id,id,e&&e.name,e&&e.mission,!!e&&pool().indexOf(e)>=0]}))}));
console.log(await p.evaluate(()=>SCENARIO.missionen.map(m=>m.id+':'+Object.keys(m.wahrheit||{}).join(',')).join(' | ')));
await b.close()})();
