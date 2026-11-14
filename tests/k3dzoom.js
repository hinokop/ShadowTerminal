/* Umschalten 3D -> 2D behält Mitte und Zoom (und umgekehrt). Exit-Code 1 bei Fehlschlag. */
const PF = require('./_pfad.js'); const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1500, height: 950 } })).newPage(); const err = [];
  p.on('pageerror', x => err.push(x.message));
  await p.route(/geobasis|eox|gdi\.berlin|cartocdn|open-meteo|openfreemap|unpkg/, r => r.abort());
  await p.goto(PF.APP); await p.waitForTimeout(5200); await p.fill('#gate-pw', 'pw-test-123'); await p.fill('#gate-pw2', 'pw-test-123'); await p.click('#gate-go');
  await p.waitForFunction(() => !document.body.classList.contains('locked'), null, { timeout: 20000 });
  const r = await p.evaluate(() => {
    const K = VIEW.karte, o = {}; dispatch({ type: 'NAVIGATION', modul: 'karte' });
    K.lat = 52.4; K.lon = 13.3; K.zoom = 12; K.ansicht3d = true; K.kamera3d = { center: [13.45, 52.51], zoom: 17.8, pitch: 55, bearing: 30 };
    karte3dUmschalten();                                                         /* 3D -> 2D */
    o.zu2d = { ansicht3d: K.ansicht3d, lat: K.lat, lon: K.lon, zoom: K.zoom };
    K.zoom = 16; K.lat = 52.6; K.lon = 13.5;                                      /* in 2D weitergearbeitet */
    karte3dUmschalten();                                                         /* 2D -> 3D */
    o.zu3d = { ansicht3d: K.ansicht3d, kamera: K.kamera3d, gesendet: karte3dDaten().kamera };
    karte3dUmschalten(); o.zurueck = { zoom: K.zoom, lat: K.lat, lon: K.lon };   /* Rundreise */
    /* Kamera-Meldung aus dem Frame führt 2D mit */
    karteKameraUebernehmen({ center: [13.1, 52.2], zoom: 18.2, pitch: 60, bearing: 0 }); o.meldung = { zoom: K.zoom, lat: K.lat, lon: K.lon };
    return o;
  });
  console.log(JSON.stringify(r)); let ok = true; const chk = (n, c) => { console.log((c ? 'OK   ' : 'FAIL ') + n); if (!c) ok = false; };
  chk('3D -> 2D: Mitte übernommen', r.zu2d.ansicht3d === false && r.zu2d.lat === 52.51 && r.zu2d.lon === 13.45);
  chk('3D -> 2D: Zoom bleibt nah (17,8 -> 18,3, nicht ganz heraus)', Math.abs(r.zu2d.zoom - 18.3) < 1e-9);
  chk('2D -> 3D: aktuelle 2D-Ansicht wird Kamera, Neigung und Richtung bleiben', r.zu3d.ansicht3d === true && r.zu3d.gesendet.center[0] === 13.5 && r.zu3d.gesendet.center[1] === 52.6 && Math.abs(r.zu3d.gesendet.zoom - 15.5) < 1e-9 && r.zu3d.gesendet.pitch === 55 && r.zu3d.gesendet.bearing === 30);
  chk('Rundreise 2D -> 3D -> 2D ohne Drift', Math.abs(r.zurueck.zoom - 16) < 1e-9 && r.zurueck.lat === 52.6 && r.zurueck.lon === 13.5);
  chk('Kamera-Meldung führt Mitte und Zoom der 2D-Karte mit', Math.abs(r.meldung.zoom - 18.7) < 1e-9 && r.meldung.lat === 52.2 && r.meldung.lon === 13.1);
  chk('keine Seitenfehler', err.length === 0); if (err.length) console.log(err.join('|'));
  await b.close(); process.exit(ok ? 0 : 1);
})();
