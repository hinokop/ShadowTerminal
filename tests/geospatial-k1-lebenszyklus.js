/* K1c: reale Modulwechsel und SVG-Neuaufbau, simulierte 3D-Nachrichten.
   Kein externes Netz, keine Abhängigkeit von echter WebGL-Verfügbarkeit. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { APP } = require('./_pfad');
(async () => {
  const b = await chromium.launch();
  try {
    const p = await b.newPage({ viewport: { width: 1500, height: 1100 }, reducedMotion: 'reduce' });
    const errors = []; p.on('pageerror', e => errors.push(e.message));
    await p.route(/^https?:/, r => r.abort());
    await p.goto(APP);
    await p.fill('#gate-pw', 'pw-test-123');
    if (await p.isVisible('#gate-pw2')) await p.fill('#gate-pw2', 'pw-test-123');
    await p.click('#gate-go');
    await p.waitForFunction(() => !document.body.classList.contains('locked'));
    const res = await p.evaluate(() => {
      dispatch({type:'NAVIGATION',modul:'karte'});
      VIEW.karte.reiter='karte'; renderModule();
      const K=VIEW.karte, alt=KARTE_ST, svgAlt=$('k-svg'), pins=PROFIL.pins.length;
      K.pinSetzen=true; alt.neu(); renderModule();
      const aktuell=KARTE_ST;
      alt.klickGeo({ll:[52,13]});
      svgAlt.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
      const ersetzt=!alt.aktiv() && aktuell.aktiv() && aktuell!==alt && K.pinSetzen && PROFIL.pins.length===pins;
      const kamera=aktuell.camera(), ll=[52.5,13.4], xy=aktuell.project(ll), rueck=aktuell.unproject(xy);
      const projektion=Math.abs(ll[0]-rueck[0])<1e-8 && Math.abs(ll[1]-rueck[1])<1e-8 && Number.isFinite(kamera.zoom);
      K.reiter='protokoll'; renderModule();
      const protokoll=KARTE_ST===null && !aktuell.aktiv();
      K.reiter='karte'; renderModule();
      const vorWechsel=KARTE_ST;
      karte3dAktivSetzen(true); const sitzung=KARTE3D.sitzung;
      const erlaubt=karte3dNachrichtZulaessig({typ:'karte3d-klick',sitzung});
      dispatch({type:'NAVIGATION',modul:'dossier'});
      const weg=KARTE_ST===null && !vorWechsel.aktiv() && !KARTE3D.aktiv &&
        !karte3dNachrichtZulaessig({typ:'karte3d-klick',sitzung});
      dispatch({type:'NAVIGATION',modul:'karte'});
      karte3dAktivSetzen(true); const neu=KARTE3D.sitzung;
      const generation=neu!==sitzung && !karte3dNachrichtZulaessig({typ:'karte3d-kamera',sitzung}) &&
        karte3dNachrichtZulaessig({typ:'karte3d-kamera',sitzung:neu});
      karte3dAktivSetzen(false);
      return {ersetzt,projektion,protokoll,erlaubt,weg,generation};
    });
    for (const [k,v] of Object.entries(res)) assert.equal(v,true,k);
    /* Echte Layer-Handler und beide Datenadapter, ohne Netz oder WebGL.
       Nachrichten werden an der Transportgrenze abgefangen, nicht die Filter nachgebaut. */
    const sync = await p.evaluate(() => {
      dispatch({type:'OZONE_ANGELEGT',ll:[52.5,13.4]});
      const zid=PROFIL.zonen.at(-1).id;
      dispatch({type:'DOSSIER_ANGELEGT',typ:'Person',name:'K1c Test'});
      const eid=STATE.dossiers.auswahl;
      dispatch({type:'SICHTUNG_HINZU',id:eid,ort:'52.5000, 13.4000',text:'Test'});
      dispatch({type:'NAVIGATION',modul:'karte'});
      const K=VIEW.karte; K.reiter='karte'; K.lat=52.5; K.lon=13.4; K.zoom=14;
      K.ebenenOffen=true; K.ebenen.zonen=true; K.ebenen.sichtungen=true;
      K.sichtungFokus=null; K.auswahl=null; renderModule();
      const messages=[], senden=karte3dSenden, warBereit=KARTE3D.bereit;
      karte3dSenden=d=>messages.push(d);
      KARTE3D.aktiv=true; KARTE3D.bereit=true;
      const letzter=()=>messages.filter(m=>m.typ==='karte3d-daten').at(-1);
      const toggle=(id,on)=>{const e=$(id);e.checked=on;e.dispatchEvent(new Event('change',{bubbles:true}));};
      const zoneSvg=()=>[...document.querySelectorAll('.k-zone')].some(g=>g.getAttribute('data-id')===zid);
      const siSvg=()=>[...document.querySelectorAll('.k-marker')].some(g=>g.getAttribute('data-render-key')===karteRenderSchluessel('sichtung',STATE.dossiers.entitaeten[eid].sichtungen.at(-1).id,eid));
      try {
        karteRendererDatenAktualisieren();
        const sichtbar=zoneSvg() && siSvg() && letzter().zonen.some(z=>z.id===zid) &&
          letzter().marker.some(m=>m.renderKey===karteRenderSchluessel('sichtung',STATE.dossiers.entitaeten[eid].sichtungen.at(-1).id,eid));
        toggle('ke-zonen',false);
        const zoneAus=!zoneSvg() && !letzter().zonen.some(z=>z.id===zid);
        karteWaehlen(null,false); karte3dKlick({lat:52.5,lon:13.4,zid});
        const stale=K.auswahl===null;
        toggle('ke-sichtungen',false);
        const sichtAus=!siSvg() && !letzter().marker.some(m=>m.kat==='sichtung');
        toggle('ke-zonen',true); toggle('ke-sichtungen',true);
        const wieder=zoneSvg() && siSvg() && letzter().zonen.some(z=>z.id===zid);
        K.messen=true; K.messPts=[];
        karte3dKlick({lat:52.5,lon:13.4});
        const mess=letzter().mess.length===1 && letzter().mess[0][0]===52.5 && letzter().mess[0][1]===13.4;
        K.messen=false; K.messPts=[];
        KARTE3D.aktiv=false; messages.length=0; karteNeuZeichnen();
        const inaktiv=messages.length===0;
        return {sichtbar,zoneAus,stale,sichtAus,wieder,mess,inaktiv};
      } finally { KARTE3D.aktiv=false; KARTE3D.bereit=warBereit; karte3dSenden=senden; }
    });
    for (const [k,v] of Object.entries(sync)) assert.equal(v,true,k);
    const vertrag = await p.evaluate(() => {
      const K=VIEW.karte, A=KARTE_3D_ADAPTER, nachrichten=[], senden=karte3dSenden;
      const vorher={aktiv:KARTE3D.aktiv,bereit:KARTE3D.bereit,groesse:KARTE3D.groesse,kamera:K.kamera3d};
      karte3dSenden=d=>nachrichten.push(d);
      try {
        KARTE3D.aktiv=true; KARTE3D.bereit=true; KARTE3D.groesse=null;
        const erste=A.resize(800,600), gleich=A.resize(800,600), zweite=A.resize(960,600), ungueltig=A.resize(0,600);
        const resize=erste && !gleich && zweite && !ungueltig && nachrichten.length===2 &&
          nachrichten.every(n=>n.typ==='karte3d-resize' && n.sitzung===KARTE3D.sitzung);
        K.kamera3d={center:[13.4,52.5],zoom:15,pitch:55,bearing:12};
        const kopie=A.camera(); kopie.center[0]=0;
        const kamera=K.kamera3d.center[0]===13.4 && kopie.zoom===15;
        A.flyTo([11,51],16); A.setSelection({typ:'karte3d-auswahl',id:null,renderKey:null});
        const befehle=nachrichten.at(-2).typ==='karte3d-flug' && nachrichten.at(-2).center[0]===11 &&
          nachrichten.at(-1).typ==='karte3d-auswahl';
        KARTE3D.aktiv=false; nachrichten.length=0;
        A.resize(1200,600); A.flyTo([1,2],15); A.setSelection({typ:'karte3d-auswahl'});
        const inaktiv=nachrichten.length===0;
        KARTE3D.aktiv=true; KARTE3D.bereit=false;
        const nichtBereit=!A.resize(1200,600) && nachrichten.length===0;
        return {resize,kamera,befehle,inaktiv,nichtBereit};
      } finally {
        KARTE3D.aktiv=vorher.aktiv; KARTE3D.bereit=vorher.bereit; KARTE3D.groesse=vorher.groesse;
        K.kamera3d=vorher.kamera; karte3dSenden=senden;
      }
    });
    for (const [k,v] of Object.entries(vertrag)) assert.equal(v,true,k);
    /* Echter Nachrichtenlistener mit richtiger/falscher Frame-Quelle, keine WebGL-Abhängigkeit. */
    const fehlerpfad = await p.evaluate(() => {
      const fr=h('iframe',{id:'k-3d-frame',src:'about:blank'});document.body.appendChild(fr);
      const event=(typ,grund,source=fr.contentWindow)=>window.dispatchEvent(new MessageEvent('message',{source,data:{typ,grund}}));
      try {
        karte3dAktivSetzen(false); meldung('');
        event('karte3d-fehler','fremd',window);
        const fremd=KARTE3D.fehlerOffen===null;
        event('karte3d-fehler','Test-Ladefehler');
        const wartet=KARTE3D.fehlerOffen==='Test-Ladefehler'&&!$('sys-msg').textContent;
        karte3dAktivSetzen(true);
        const angezeigt=$('sys-msg').textContent.includes('Test-Ladefehler');
        meldung('');event('karte3d-fehler','Test-Ladefehler');
        const einmal=!$('sys-msg').textContent;
        karte3dAktivSetzen(false);event('karte3d-fehler','Zweiter Fehler');event('karte3d-erholt');
        karte3dAktivSetzen(true);
        const erholt=KARTE3D.fehlerOffen===null&&!$('sys-msg').textContent;
        return {fremd,wartet,angezeigt,einmal,erholt};
      } finally {karte3dAktivSetzen(false);fr.remove();}
    });
    for(const [k,v] of Object.entries(fehlerpfad))assert.equal(v,true,k);
    await p.waitForTimeout(100);
    assert.deepEqual(errors,[]);
    console.log('OK: SVG mount/unmount, Projektion, Modulwechsel und 3D-Ereignisgeneration');
  } finally { await b.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
