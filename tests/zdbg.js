const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1500,height:1100}})).newPage();const e=[];p.on('pageerror',x=>e.push(x.message));
await p.goto('file:///home/claude/index.html');await p.waitForTimeout(5200);await p.fill('#gate-pw','pw-test-123');await p.fill('#gate-pw2','pw-test-123');await p.click('#gate-go');
await p.waitForFunction(()=>!document.body.classList.contains('locked'),null,{timeout:20000});
await p.evaluate(()=>{dispatch({type:'STATUS_GESETZT',status:'Standby'});dispatch({type:'MISSION_ZUGEWIESEN',id:'M1'});dispatch({type:'MISSION_ANGENOMMEN',id:'M1'});MS('M1').beginn=new Date(Date.now()-3600000).toISOString();alleEntitaeten().forEach(e=>{IZ()[e.id]={status:'frei'}});dispatch({type:'NAVIGATION',modul:'karte'});
dispatch({type:'ZONE_ANGELEGT',art:'zugriff',ll:[52.4806,13.4376]});dispatch({type:'ZONE_ANGELEGT',art:'zugriff',ll:[52.4811,13.4386]});VIEW.karte.zoom=16;VIEW.karte.lat=52.4808;VIEW.karte.lon=13.4381;VIEW.karte.mehrModus=true;VIEW.karte.auswahl=null;renderModule();});await p.waitForTimeout(800);
const r=await p.evaluate(()=>{const g=document.querySelector('#k-svg .k-zone[data-id="ZG-001"] .k-zone-hit');const rc=g.getBoundingClientRect();return [rc.left,rc.top,rc.width,rc.height,getComputedStyle(g).pointerEvents,document.elementFromPoint(rc.left+rc.width/2,rc.top+1)&&document.elementFromPoint(rc.left+rc.width/2,rc.top+1).outerHTML.slice(0,100)]});console.log(r);
await p.mouse.click(r[0]+r[2]/2,r[1]+1);await p.waitForTimeout(300);console.log(await p.evaluate(()=>[VIEW.karte.mehr,VIEW.karte.auswahl,VIEW.karte.mehrModus]));
console.log(e.join()||'keine Fehler');await b.close()})();
