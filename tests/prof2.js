const {chromium}=require('playwright');
const ok=(c,m)=>console.log((c?'OK   ':'FAIL ')+m);
(async()=>{
 const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1280,height:900}});
 const p=await ctx.newPage();const errs=[];
 p.on('pageerror',e=>errs.push('PAGE '+e.message));
 await p.goto('file:///home/claude/index.html');await p.waitForTimeout(5200);
 await p.fill('#gate-pw','pw-test-123');await p.fill('#gate-pw2','pw-test-123');await p.click('#gate-go');
 await p.waitForFunction(()=>!document.body.classList.contains('locked'),null,{timeout:20000});
 const id=await p.evaluate(()=>{dispatch({type:'DOSSIER_ANGELEGT',typ:'Person',name:'Testperson Alpha',land:'DE',aliase:'',beschreibung:'x',eckdaten:'',einschaetzung:3});
   const e=Object.values(STATE.dossiers.eigene||{})[0]||(PROFIL.eigene[0]);return e&&e.id});
 console.log('id',id);
 ok(!!id,'Dossier angelegt');
 await p.evaluate(i=>{dispatch({type:'DOSSIER_ORT',id:i,ll:[48.1374,11.5755]});dispatch({type:'DOSSIER_FOTO_HINZU',id:i,bild:'data:image/jpeg;base64,/9j/AAAA',titel:'Obs'})},id);
 const pr=await p.evaluate(()=>JSON.stringify({k:PROFIL.koord,g:PROFIL.galerie,n:PROFIL.eigene.length}));console.log(pr);
 await p.evaluate(()=>dispatch({type:'RESET'}));await p.waitForTimeout(300);
 const nach=await p.evaluate(i=>({e:!!entitaet(i),k:karteKoord(i),g:JSON.stringify(PROFIL.galerie)}),id);console.log(nach);
 ok(nach.e&&nach.k&&nach.k[0]===48.1374,'Dossier+Koord überstehen Reset');
 // pick
 await p.keyboard.press('6');await p.waitForTimeout(300);
 await p.evaluate(i=>{VIEW.karte.pick=i;renderModule()},id);await p.waitForTimeout(200);
 const bb=await p.locator('#k-svg').boundingBox();await p.mouse.click(bb.x+bb.width/2,bb.y+bb.height/2);await p.waitForTimeout(300);
 ok(await p.evaluate(i=>Math.abs(karteKoord(i)[0]-VIEW.karte.lat)<0.5,id),'Pick setzt Position (Kartenmitte)');
 console.log(errs.join('\n')||'keine Fehler');await b.close();
})();
