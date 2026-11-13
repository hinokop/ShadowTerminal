const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1500,height:1000}})).newPage();const e=[];p.on('pageerror',x=>e.push(x.message));
await p.goto('file:///home/claude/index.html');await p.waitForTimeout(5200);await p.keyboard.press('Space');await p.fill('#gate-pw','pw-test-123');await p.fill('#gate-pw2','pw-test-123');await p.click('#gate-go');
await p.waitForFunction(()=>!document.body.classList.contains('locked'),null,{timeout:20000});
await p.evaluate(()=>{dispatch({type:'KENNWORT_SCHALTER',an:false});dispatch({type:'STATUS_GESETZT',status:'Standby'});dispatch({type:'MISSION_ZUGEWIESEN',id:'M1'});dispatch({type:'MISSION_ANGENOMMEN',id:'M1'});dispatch({type:'MISSION_BEGINN_JETZT'});dispatch({type:'NAVIGATION',modul:'karte'});VIEW.karte.lat=52.47;VIEW.karte.lon=13.45;VIEW.karte.zoom=14;renderModule();
dispatch({type:'ZONE_ANGELEGT',ll:[52.47,13.45]});dispatch({type:'ZONE_GEAENDERT',id:'ZN-001',wertung:'akut'});zonenEigene(zDef()).find(x=>x.id==='ZN-001').stand=new Date(Date.now()-30*3600000).toISOString();karteWaehlen('ZN-001',false)});await p.waitForTimeout(500);
console.log(await p.evaluate(()=>$('k-auswahl').innerText));console.log(await p.evaluate(()=>!!$('zn-best')));
await p.evaluate(()=>oeffneRegie());await p.waitForTimeout(400);console.log(await p.evaluate(()=>(document.getElementById('regie')||{}).innerText||'none').then(t=>t.slice(0,200)));
console.log(e.join());await b.close()})();
