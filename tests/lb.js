const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1500,height:1000},deviceScaleFactor:1})).newPage();const e=[];p.on('pageerror',x=>e.push(x.message));
const req=[];p.on('response',r=>{const u=r.url();if(/gdi\.berlin|cartocdn/.test(u))req.push(r.status()+' '+u.replace(/key=[^&]+/,'key=***').slice(0,110))});
await p.goto(require('./_pfad.js').APP);await p.waitForTimeout(5200);await p.fill('#gate-pw','pw-test-123');await p.fill('#gate-pw2','pw-test-123');await p.click('#gate-go');
await p.waitForFunction(()=>!document.body.classList.contains('locked'),null,{timeout:20000});
await p.evaluate(()=>{dispatch({type:'STATUS_GESETZT',status:'Standby'});dispatch({type:'NAVIGATION',modul:'karte'});});await p.waitForTimeout(800);
for(const a of ['luftbild','hybrid']){
 await p.click('#k-b-'+(a==='luftbild'?'luft':'hybrid'));await p.waitForTimeout(300);
 await p.evaluate(()=>{VIEW.karte.zoom=16;VIEW.karte.lat=52.4806;VIEW.karte.lon=13.4376;zeichneKarte(document.getElementById('k-svg'))});await p.waitForTimeout(6000);
 await p.screenshot({path:'lb_'+a+'.png'});
}
console.log(req.slice(0,6).join('\n'),'\nn=',req.length,'\n',e.join()||'keine Fehler');await b.close()})();
