const PF=require('./_pfad.js');
const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const D=PF.MAPLIBRE;
async function lauf(label,fall){const p=await (await b.newContext({viewport:{width:900,height:600}})).newPage();const e=[];p.on('pageerror',x=>e.push(x.message));
 await p.route('**/*',r=>{const u=r.request().url();
  if(u.includes('maplibre-gl.js'))return fall==='lib'?r.abort():r.fulfill({path:D+'maplibre-gl.js',contentType:'text/javascript'});
  if(u.includes('maplibre-gl.css'))return r.fulfill({path:D+'maplibre-gl.css',contentType:'text/css'});
  if(u.includes('styles/liberty'))return fall==='stil'?r.abort():r.fulfill({json:{version:8,sources:{},glyphs:'https://x/{fontstack}/{range}.pbf',layers:[{id:'bg',type:'background',paint:{'background-color':'#223'}}]}});
  if(u.startsWith('file:'))return r.continue(); return r.abort();});
 await p.goto(PF.KARTE3D);await p.waitForTimeout(6500);
 if(fall==='kontext'){await p.evaluate(()=>{const c=karte3d.getCanvas();const g=c.getContext('webgl2')||c.getContext('webgl');const x=g.getExtension('WEBGL_lose_context');x.loseContext();window.__x=x});await p.waitForTimeout(500);
   const a=await p.evaluate(()=>!document.getElementById('fehler').hidden);await p.evaluate(()=>window.__x.restoreContext());await p.waitForTimeout(800);const z=await p.evaluate(()=>!document.getElementById('fehler').hidden);console.log(label,'Hinweis bei Verlust',a,'nach Wiederherstellung noch sichtbar',z,e.join('|')||'ok');return}
 console.log(label,JSON.stringify(await p.evaluate(()=>({sichtbar:!document.getElementById('fehler').hidden,text:document.getElementById('fehler').textContent.slice(0,80)}))),e.join('|')||'ok');}
await lauf('normal');await lauf('Bibliothek fehlt','lib');await lauf('Stil nicht erreichbar','stil');await lauf('Kontextverlust','kontext');await b.close()})();
