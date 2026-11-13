const PF=require('./_pfad.js');
const {chromium}=require('playwright');
async function lauf(args,label){const b=await chromium.launch({args});const p=await (await b.newContext({viewport:{width:1500,height:950}})).newPage();const e=[];p.on('pageerror',x=>e.push(x.message));
await p.goto(PF.APP);await p.waitForTimeout(5200);await p.fill('#gate-pw','pw-test-123');await p.fill('#gate-pw2','pw-test-123');await p.click('#gate-go');
await p.waitForFunction(()=>!document.body.classList.contains('locked'),null,{timeout:20000});
await p.evaluate(()=>{dispatch({type:'NAVIGATION',modul:'karte'})});await p.waitForTimeout(600);
await p.click('#k-3d');await p.waitForTimeout(800);
console.log(label,'webgl',await p.evaluate(()=>webglVorhanden()),'hinweis',await p.evaluate(()=>!!document.getElementById('k-3d-hinweis')),'frame',await p.evaluate(()=>!!document.getElementById('k-3d-frame')),e.join('|')||'ok');await b.close()}
(async()=>{await lauf(['--disable-gpu','--disable-software-rasterizer'],'Starter-Flags:');await lauf(['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'],'mit GPU/SW:')})();
