const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1500,height:1000}})).newPage();
await p.goto('file:///home/claude/index.html');await p.waitForTimeout(5200);await p.keyboard.press('Space');await p.fill('#gate-pw','pw-test-123');await p.fill('#gate-pw2','pw-test-123');await p.click('#gate-go');
await p.waitForFunction(()=>!document.body.classList.contains('locked'),null,{timeout:20000});
await p.evaluate(()=>{dispatch({type:'KENNWORT_SCHALTER',an:false});dispatch({type:'STATUS_GESETZT',status:'Standby'});dispatch({type:'MISSION_ZUGEWIESEN',id:'M1'});dispatch({type:'MISSION_ANGENOMMEN',id:'M1'});dispatch({type:'MISSION_BEGINN_JETZT'});dispatch({type:'NAVIGATION',modul:'karte'});
VIEW.karte.ebenenOffen=false;VIEW.karte.lat=52.40;VIEW.karte.lon=13.40;VIEW.karte.zoom=10.6;renderModule();dispatch({type:'ZONE_ANGELEGT',ll:[52.4738,13.4515]});dispatch({type:'ZONE_GEAENDERT',id:'ZN-001',wertung:'akut',r:500,name:'Hof Sonnenallee'});karteWaehlen(null,false)});
await p.waitForTimeout(3000);await p.screenshot({path:'zn_c.png'});
await p.evaluate(()=>{VIEW.karte.lat=52.4738;VIEW.karte.lon=13.4515;VIEW.karte.zoom=13.2;renderModule()});await p.waitForTimeout(3000);await p.screenshot({path:'zn_d.png'});await b.close()})();
