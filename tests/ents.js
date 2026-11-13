const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await (await b.newContext()).newPage();
await p.goto('file:///home/claude/index.html');await p.waitForTimeout(3000);
console.log(await p.evaluate(()=>SCENARIO.entitaeten.concat(SCENARIO.standard.dossiers).map(e=>[e.id,e.typ,e.mission,e.bedrohung&&e.bedrohung.stufe,e.name.slice(0,28),(e.rolle||'').slice(0,40)].join(' | ')).join('\n')));
console.log(await p.evaluate(()=>Object.keys(SCENARIO.standard)+' // '+Object.keys(SCENARIO.abfragen)));
await b.close()})();
