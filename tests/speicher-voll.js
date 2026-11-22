/* Voller Browserspeicher (aus au.js AU-1 ausgegliedert in Phase 5b8): Sichern scheitert erkennbar
   und erholt sich, sobald wieder Platz ist. Auslöser ist eine produktive Dossiernotiz. */
const {chromium}=require('playwright');
const ok=(c,m)=>console.log((c?'OK   ':'FAIL ')+m);
(async()=>{const b=await chromium.launch();const e=[];
const p=await (await b.newContext({viewport:{width:1400,height:1000}})).newPage();p.on('pageerror',x=>e.push(x.message));
await p.goto(require('./_pfad.js').APP);await p.waitForTimeout(5200);await p.fill('#gate-pw','pw-test-123');await p.fill('#gate-pw2','pw-test-123');await p.click('#gate-go');
await p.waitForFunction(()=>!document.body.classList.contains('locked'),null,{timeout:20000});
const r=await p.evaluate(()=>{const id=SCENARIO.standard.dossiers[0].id;
 try{for(let i=0;i<200;i++)localStorage.setItem('fuell'+i,'x'.repeat(100000))}catch(x){}try{for(let i=0;i<3000;i++)localStorage.setItem('f2'+i,'x'.repeat(1000))}catch(x){}
 dispatch({type:'DOSSIER_NOTIZ',id,text:'Erste Notiz bei vollem Speicher '+'x'.repeat(8000)});const voll=Store.isPersistent();
 Object.keys(localStorage).filter(k=>k.indexOf('fuell')===0||k.indexOf('f2')===0).forEach(k=>localStorage.removeItem(k));
 dispatch({type:'DOSSIER_NOTIZ',id,text:'Zweite Notiz nach Freigabe'});
 return {voll,frei:Store.isPersistent(),gesp:JSON.parse(localStorage.getItem(STORAGE_KEY)).dossiers.entitaeten[id].notizen.length}});
ok(r.voll===false,'voller Speicher wird erkannt');
ok(r.frei===true&&r.gesp===2,'Speichern erholt sich, sobald wieder Platz ist ('+JSON.stringify(r)+')');
ok(e.length===0,'keine Seitenfehler');
console.log(e.join('|')||'keine Seitenfehler');await b.close()})();
