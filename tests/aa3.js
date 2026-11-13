const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await (await b.newContext()).newPage();
await p.goto('file:///home/claude/index.html');await p.waitForTimeout(3000);
for(const t of process.argv.slice(2)) console.log(t,'=>',await p.evaluate((t)=>{const m=dlgMatcher(t);return DIALOG.absichten.filter(a=>a.stamm&&m.trifft(a.stamm)).map(a=>a.id+':'+a.stamm.filter(s=>m.trifft([s])).join('|')).join(' ; ')},t));
await b.close()})();
