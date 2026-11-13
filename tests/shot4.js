const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1400,height:1000},deviceScaleFactor:1});
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file:///home/claude/index.html');await p.waitForTimeout(500);
await p.fill('#gate-pw','geheim-pw-123');await p.fill('#gate-pw2','geheim-pw-123');await p.click('#gate-go');
await p.waitForSelector('body:not(.locked)',{timeout:20000});await p.waitForTimeout(600);
// neues Dossier Dialog
await p.click('#nav-dossier');await p.waitForTimeout(300);
await p.click('#btn-dneu');await p.waitForTimeout(300);
await p.setInputFiles('#nd-bild','/tmp/t/portrait.png');await p.waitForTimeout(500);
await p.fill('#nd-name','Karl Test');await p.selectOption('#nd-stufe','4');
await p.screenshot({path:'/tmp/t/n_dialog.png'});
await p.click('#dlg-ok');await p.waitForTimeout(400);await p.screenshot({path:'/tmp/t/n_dossier.png'});
// Schlüsselfigur
await p.evaluate(()=>dispatch({type:'DOSSIER_GEOEFFNET',id:'P-9004',navigieren:true}));await p.waitForTimeout(300);await p.screenshot({path:'/tmp/t/n_key.png'});
// Karte
await p.click('#nav-karte');await p.waitForTimeout(500);await p.screenshot({path:'/tmp/t/n_karte_welt.png'});
await p.click('#k-eu');await p.waitForTimeout(300);await p.screenshot({path:'/tmp/t/n_karte_eu.png'});
// Akten
await p.click('#nav-akten');await p.waitForTimeout(400);await p.screenshot({path:'/tmp/t/n_akten.png',fullPage:true});
// Mission: Status aktiv, Zeit vorspulen
await p.evaluate(()=>{dispatch({type:'STATUS_GESETZT',status:'Standby'});STATE.plan.forEach(x=>x.faelligAm=new Date(Date.now()-1000).toISOString());if(STATE.serie.folge)STATE.serie.folge.faelligAm=new Date(Date.now()-1000).toISOString();});
await p.waitForTimeout(2500);
await p.evaluate(()=>{STATE.plan.forEach(x=>x.faelligAm=new Date(Date.now()-1000).toISOString());});await p.waitForTimeout(1800);
await p.evaluate(()=>dispatch({type:'MISSION_ANGENOMMEN',id:'M1'}));await p.waitForTimeout(300);
await p.click('#nav-mission');await p.waitForTimeout(400);
await p.selectOption('#an-mittel','auto');await p.waitForTimeout(200);
await p.screenshot({path:'/tmp/t/n_anreise.png',fullPage:true});
await p.click('#btn-anreise');await p.waitForTimeout(400);
await p.click('#nav-karte');await p.waitForTimeout(500);await p.screenshot({path:'/tmp/t/n_karte_route.png',fullPage:true});
console.log(errs);await b.close();})();
