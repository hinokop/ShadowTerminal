const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await (await b.newContext()).newPage();
p.on('response',r=>{if(r.url().includes('tile.openstreetmap'))console.log(r.status(),r.url(),r.headers()['content-length'])});
await p.goto(require('./_pfad.js').APP);
const r=await p.evaluate(()=>new Promise(res=>{const i=new Image();i.onload=()=>res('ok '+i.width);i.onerror=()=>res('fehler');i.src='https://tile.openstreetmap.org/5/16/10.png'}));
console.log(r);await b.close()})();
