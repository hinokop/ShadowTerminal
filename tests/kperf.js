const PF=require('./_pfad.js');
const {chromium}=require('playwright');const zlib=require('zlib');
function png(){ // 256x256 rot-grau PNG ohne Abhängigkeiten
 const w=256,h=256,raw=Buffer.alloc((w*3+1)*h);for(let y=0;y<h;y++){raw[y*(w*3+1)]=0;for(let x=0;x<w;x++){const o=y*(w*3+1)+1+x*3;raw[o]=90+(x>>5)*10;raw[o+1]=90;raw[o+2]=100+(y>>5)*8}}
 const crc=(b)=>{let c,t=[];for(let n=0;n<256;n++){c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;t[n]=c>>>0}let r=0xffffffff;for(const x of b)r=t[(r^x)&255]^(r>>>8);return(r^0xffffffff)>>>0};
 const ch=(ty,d)=>{const l=Buffer.alloc(4);l.writeUInt32BE(d.length);const td=Buffer.concat([Buffer.from(ty),d]);const c=Buffer.alloc(4);c.writeUInt32BE(crc(td));return Buffer.concat([l,td,c])};
 const ih=Buffer.alloc(13);ih.writeUInt32BE(w,0);ih.writeUInt32BE(h,4);ih[8]=8;ih[9]=2;
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),ch('IHDR',ih),ch('IDAT',zlib.deflateSync(raw)),ch('IEND',Buffer.alloc(0))])}
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1500,height:950}})).newPage();const e=[];p.on('pageerror',x=>e.push(x.message));
const P=png();let reqs=0;
await p.route(/geoportal|fbinter|cartocdn|openstreetmap|basemaps/,async r=>{reqs++;await new Promise(s=>setTimeout(s,80));r.fulfill({body:P,contentType:'image/png',headers:{'access-control-allow-origin':'*'}})});
await p.goto(PF.APP);await p.waitForTimeout(5200);await p.fill('#gate-pw','pw-test-123');await p.fill('#gate-pw2','pw-test-123');await p.click('#gate-go');
await p.waitForFunction(()=>!document.body.classList.contains('locked'),null,{timeout:20000});
await p.evaluate(()=>{dispatch({type:'NAVIGATION',modul:'karte'})});await p.waitForTimeout(800);
const r=await p.evaluate(async()=>{
 VIEW.karte.anbieter='luftbild';VIEW.karte.ebenen.kacheln=true;VIEW.karte.lat=52.4737;VIEW.karte.lon=13.4513;VIEW.karte.zoom=17;
 const svg=$('k-svg');let loads=0;document.addEventListener('load',()=>loads++,true);
 zeichneKarte(svg);await new Promise(s=>setTimeout(s,2500));
 const l0=loads;const imgs0=svg.querySelectorAll('image');const first=imgs0[0];
 // 60 Neuzeichnungen mit kleiner Verschiebung
 const t=performance.now();let weg=0;
 for(let i=0;i<60;i++){VIEW.karte.lon+=0.00003;zeichneKarte(svg);if(first&&!first.isConnected)weg++;await new Promise(s=>requestAnimationFrame(s));}
 const ms=(performance.now()-t)/60;
 // Zoom-Test: 17 -> 19 -> 17, sichtbar gefüllte Fläche prüfen
 const nach=svg.querySelectorAll('image').length;
 VIEW.karte.zoom=18.5;zeichneKarte(svg);const direkt=[...svg.querySelectorAll('image')].filter(i=>i.getAttribute('display')!=='none').length;
 return {l0,loadsNach:loads-l0,ms:ms.toFixed(1),imgs:nach,ersterTrennungen:weg,sichtNachZoom:direkt,kachelnMap:KACHELN.size};});
console.log(JSON.stringify(r),'requests',reqs);console.log(e.join('|')||'keine Seitenfehler');await p.screenshot({path:'kperf.png'});await b.close()})();
