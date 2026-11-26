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
    await p.waitForTimeout(100);
    assert.deepEqual(errors,[]);
    console.log('OK: SVG mount/unmount, Projektion, Modulwechsel und 3D-Ereignisgeneration');
  } finally { await b.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
