/* Lage-Box: Objektkontext bei gezieltem Sprung (ohne Auftrag), Rückfall auf die Kartenmitte nur beim eigenen Ziehen, Wetter am Bezugspunkt
   (verspätete Antwort für A überschreibt B nicht), Offline ohne Abfrage; Gegenprobe: mit Auftrag bleiben die Auftragszeilen.
   Exit-Code 1 bei Fehlschlag. */
const PF = require('./_pfad.js'); const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1500, height: 1100 } }); const p = await ctx.newPage(); const err = [];
  p.on('pageerror', x => err.push(x.message)); ctx.on('page', pg => { if (pg !== p) pg.close().catch(() => {}); });
  await p.route(/geobasis|eox|gdi\.berlin|cartocdn|openfreemap|unpkg/, r => r.abort());
  const anfragen = [];
  await p.route(/open-meteo/, async r => {
    const u = new URL(r.request().url()), lat = Number(u.searchParams.get('latitude')); anfragen.push(lat);
    const temp = Math.abs(lat - 48.1) < 1 ? 22 : 11;
    if (temp === 11 && global.__verzoegern) await new Promise(f => setTimeout(f, 2500));
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ current: { temperature_2m: temp, precipitation: 0, weather_code: 0, wind_speed_10m: 5, wind_direction_10m: 90, wind_gusts_10m: 6, visibility: 20000, time: '2026-11-14T10:00' } }) });
  });
  await p.goto(PF.APP); await p.waitForTimeout(5200); await p.fill('#gate-pw', 'pw-test-123'); const z = await p.$('#gate-pw2'); if (z && await z.isVisible()) await z.fill('pw-test-123'); await p.click('#gate-go');
  await p.waitForFunction(() => !document.body.classList.contains('locked'), null, { timeout: 20000 });
  const ok = {};
  ok.ohneAuftrag = await p.evaluate(() => !!STATE.vorlauf && !zDef());
  const text = id => p.evaluate(i => { const e = document.getElementById(i); return e ? e.innerText : null; }, id);
  /* A: gezielter Sprung aus dem Dossier */
  await p.evaluate(() => { dispatch({ type: 'NAVIGATION', modul: 'karte' }); VIEW.karte.reiter = 'karte'; VIEW.karte.statusOffen = false; VIEW.karte.lat = 50; VIEW.karte.lon = 10; VIEW.karte.zoom = 6; renderModule(); });
  const d = await p.evaluate(() => { const e = poolAlle().find(x => karteKoord(x.id)); return e ? { id: e.id, name: e.name, ll: karteKoord(e.id) } : null; });
  ok.dossierMitOrt = !!d;
  await p.evaluate(id => { const e = poolAlle().find(x => x.id === id); kartenSprung(e, karteKoord(id)); }, d.id);
  await p.waitForTimeout(250);
  const mitte = await p.evaluate(() => ({ bezug: VIEW.karte.bezug, auf: VIEW.karte.statusOffen }));
  ok.bezugGesetztBoxOffen = mitte.bezug === d.id && mitte.auf === true;
  await p.waitForTimeout(1500);
  const a = await p.evaluate(() => ({ bezug: VIEW.karte.bezug, lat: VIEW.karte.lat, lon: VIEW.karte.lon, flug: VIEW.karte.flug }));
  ok.bezugNachAnimation = a.bezug === d.id && !a.flug && Math.abs(a.lat - d.ll[0]) < 0.01;
  const kopf = await text('k-st-t'), obj = await text('k-st-objekt');
  ok.objektSichtbar = !!obj && obj.indexOf(d.name) >= 0;
  ok.keineAuftragszeilen = await p.evaluate(() => !document.getElementById('k-st-stufe') && !document.getElementById('k-st-ci') && !document.getElementById('k-st-ziele') && !document.getElementById('k-st-fenster'));
  ok.lichtDa = !!(await text('k-st-licht'));
  ok.keinProtokollKnopfFuerDossier = await p.evaluate(() => !document.getElementById('k-st-protokoll'));
  await p.waitForFunction(() => /11 °C/.test((document.getElementById('k-st-wetter') || {}).innerText || ''), null, { timeout: 15000 }).catch(() => {});
  ok.wetterAmObjekt = /11 °C/.test(await text('k-st-wetter') || '') && anfragen.some(x => Math.abs(x - d.ll[0]) < 0.06);
  /* B: eigenes Ziehen -> Rückfall auf die Kartenmitte */
  const r = await p.evaluate(() => { const e = document.getElementById('k-svg').getBoundingClientRect(); return [e.left + e.width / 2, e.top + e.height / 2]; });
  await p.mouse.move(r[0], r[1]); await p.mouse.down(); await p.mouse.move(r[0] + 40, r[1] + 20, { steps: 4 }); await p.mouse.move(r[0] + 90, r[1] + 50, { steps: 4 }); await p.mouse.up(); await p.waitForTimeout(300);
  ok.rueckfallBeiZiehen = await p.evaluate(() => VIEW.karte.bezug === null && !document.getElementById('k-st-objekt') && /Kartenmitte/.test(document.getElementById('k-st-pos').innerText));
  /* C: Zentrieranimation löst den Rückfall nicht aus; Protokoll-Knopf nur für Objekte mit Filter */
  await p.evaluate(() => { dispatch({ type: 'OZONE_ANGELEGT', ll: [52.5, 13.4] }); VIEW.karte.auswahl = 'ZO-001'; VIEW.karte.lat = 52.5; VIEW.karte.lon = 13.4; VIEW.karte.zoom = 14; renderModule(); });
  await p.waitForTimeout(500);
  await p.evaluate(() => { VIEW.karte.lat = 52.497; VIEW.karte.lon = 13.395; });   /* Mitte leicht versetzt, Popup bleibt sichtbar; der Flug hat damit eine Strecke */
  await p.click('#oz-zentrum'); await p.waitForTimeout(150);
  const mid = await p.evaluate(() => ({ bezug: VIEW.karte.bezug, flug: !!VIEW.karte.flug }));
  await p.waitForTimeout(1200);
  const end = await p.evaluate(() => ({ bezug: VIEW.karte.bezug, flug: !!VIEW.karte.flug, protokoll: !!document.getElementById('k-st-protokoll'), stand: !!document.getElementById('k-st-stand') }));
  ok.animationKeinRueckfall = mid.bezug === 'ZO-001' && mid.flug === true && end.bezug === 'ZO-001' && end.flug === false;
  ok.protokollKnopfFuerZone = end.protokoll && end.stand;
  await p.click('#k-st-protokoll'); await p.waitForTimeout(500);
  ok.protokollFilter = await p.evaluate(() => VIEW.karte.reiter === 'protokoll' && document.getElementById('kp-objekt').value === 'ZO-001');
  await p.evaluate(() => { VIEW.karte.reiter = 'karte'; renderModule(); });
  /* D: verspätete Wetterantwort für A überschreibt B nicht */
  global.__verzoegern = true;
  await p.evaluate(() => { WETTER.cache = {}; WETTER.zuletzt = 0; dispatch({ type: 'OZONE_ANGELEGT', ll: [48.1, 11.6] }); karteBezugSetzen('ZO-001'); karteStatusAkt(); });
  await p.waitForTimeout(300);
  await p.evaluate(() => { karteBezugSetzen('ZO-002'); VIEW.karte.statusOffen = true; karteStatusAkt(); });
  const gesehen = [];
  for (let i = 0; i < 40; i++) { gesehen.push(await text('k-st-wetter')); if (/22 °C/.test(gesehen[gesehen.length - 1] || '')) break; await p.waitForTimeout(500); }
  ok.wetterBGewinnt = /22 °C/.test(gesehen[gesehen.length - 1] || '');
  ok.wetterANieAmBezugB = gesehen.every(t => !/11 °C/.test(t || ''));
  global.__verzoegern = false;
  /* E: Offline: Zentrieren löst keine Abfrage aus */
  const vor = anfragen.length;
  await p.evaluate(() => { VIEW.karte.ebenen.kacheln = false; WETTER.cache = {}; WETTER.zuletzt = 0; karteBezugSetzen('ZO-001'); karteStatusAkt(); });
  await p.waitForTimeout(1500);
  ok.offlineOhneAbfrage = anfragen.length === vor && /Offline/.test(await text('k-st-wetter') || '');
  await p.evaluate(() => { VIEW.karte.ebenen.kacheln = true; });
  /* G: 3D-Pfad (Nachrichten der 3D-Ansicht direkt eingespielt; die gerenderte MapLibre-Ansicht selbst wird hier nicht geprüft) */
  await p.evaluate(() => { VIEW.karte.bezug = null; VIEW.karte.ansicht3d = true; VIEW.karte.statusOffen = true; karteStatusAkt(); });
  ok.dreiDOhneBezug = await p.evaluate(() => !document.getElementById('k-st-objekt'));
  await p.evaluate(() => karteFlug(52.5, 13.4, 15, null, 'ZO-001'));
  ok.dreiDSprungSofort = await p.evaluate(() => /Zone · Zone 1|Zone · /.test((document.getElementById('k-st-objekt') || {}).innerText || '') && !!document.getElementById('k-st-protokoll'));
  await p.evaluate(() => karte3dEingang({ typ: 'karte3d-kamera', kamera: { center: [13.4, 52.5], zoom: 15, pitch: 40, bearing: 0 } }, null));
  ok.dreiDBezugNachAnimation = await p.evaluate(() => VIEW.karte.bezug === 'ZO-001' && !!document.getElementById('k-st-objekt'));
  await p.evaluate(() => { karte3dEingang({ typ: 'karte3d-nutzer-bewegt' }, null); karte3dEingang({ typ: 'karte3d-kamera', kamera: { center: [13.9, 52.9], zoom: 15, pitch: 40, bearing: 0 } }, null); });
  ok.dreiDRueckfall = await p.evaluate(() => VIEW.karte.bezug === null && !document.getElementById('k-st-objekt') && /52\.900/.test(document.getElementById('k-st-pos').innerText) && /13\.900/.test(document.getElementById('k-st-pos').innerText));
  await p.evaluate(() => { VIEW.karte.ansicht3d = false; });
  /* F: Gegenprobe mit Auftrag */
  await p.evaluate(() => { dispatch({ type: 'KENNWORT_SCHALTER', an: false }); dispatch({ type: 'STATUS_GESETZT', status: 'Standby' }); dispatch({ type: 'MISSION_ZUGEWIESEN', id: 'M1' }); dispatch({ type: 'MISSION_ANGENOMMEN', id: 'M1' }); dispatch({ type: 'MISSION_BEGINN_JETZT' }); VIEW.karte.bezug = null; VIEW.karte.statusOffen = true; dispatch({ type: 'NAVIGATION', modul: 'karte' }); VIEW.karte.reiter = 'karte'; renderModule(); });
  await p.waitForTimeout(800);
  ok.mitAuftragZeilen = await p.evaluate(() => !!zDef() && ['k-st-stufe', 'k-st-ci', 'k-st-ziele', 'k-st-fenster', 'k-st-licht'].every(i => !!document.getElementById(i)));
  /* Rücksprung bei aktiver 3D-Ansicht behält den Objektbezug der Lage-Box (Kamerafahrt darf ihn nicht löschen) */
  await p.evaluate(() => { dispatch({ type: 'OZONE_ANGELEGT', ll: [52.51, 13.41] }); const id = PROFIL.zonen[PROFIL.zonen.length - 1].id; window.__zid = id; VIEW.karte.bezug = null; VIEW.karte.ansicht3d = true; kartenObjektZeigen(id); });
  ok.bezugNach3DRuecksprung = await p.evaluate(() => VIEW.karte.bezug === window.__zid);
  await p.evaluate(() => { VIEW.karte.ansicht3d = false; renderModule(); });

  console.log(JSON.stringify(ok, null, 1)); if (err.length) console.log(err.slice(0, 5));
  await b.close(); process.exit(Object.values(ok).every(Boolean) ? 0 : 1);
})();
