const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1500,height:1000}})).newPage();
await p.goto('file:///home/claude/index.html');await p.waitForTimeout(5200);await p.keyboard.press('Space');await p.fill('#gate-pw','pw-test-123');await p.fill('#gate-pw2','pw-test-123');await p.click('#gate-go');
await p.waitForFunction(()=>!document.body.classList.contains('locked'),null,{timeout:20000});
await p.evaluate(()=>{dispatch({type:'KENNWORT_SCHALTER',an:false});dispatch({type:'STATUS_GESETZT',status:'Standby'});dispatch({type:'MISSION_ZUGEWIESEN',id:'M1'});dispatch({type:'MISSION_ANGENOMMEN',id:'M1'});dispatch({type:'MISSION_BEGINN_JETZT'});dispatch({type:'NAVIGATION',modul:'karte'});VIEW.karte.lat=52.4738;VIEW.karte.lon=13.4515;VIEW.karte.zoom=14;renderModule();karteWaehlen('ZA-S-02',false)});await p.waitForTimeout(300);
await p.selectOption('#zu-stufe','3');await p.waitForTimeout(500);
console.log(await p.evaluate(()=>{zeichneKarte($('k-svg'));return [JSON.stringify(zonenUrteil(zDef())),[...document.querySelectorAll('.k-zone-t')].map(t=>t.textContent).join('|')]}));
await p.evaluate(()=>{dispatch({type:'DOSSIER_ANGELEGT',typ:'Person',name:'T',ll:[52.4738,13.4515]});const i=STATE.dossiers.eigene.slice(-1)[0].id;PROFIL.koord[i]=[52.4738,13.4515];dispatch({type:'ZIELPERSON_GESETZT',id:i,an:true});dispatch({type:'ZONE_ANGELEGT',ll:[52.4738,13.4515]});karteWaehlen('ZN-001',false)});await p.waitForTimeout(400);
console.log(await p.evaluate(()=>$('k-auswahl').innerText.replace(/\n+/g,' / ')));await b.close()})();
