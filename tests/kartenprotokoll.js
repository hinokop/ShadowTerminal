/* Kartenprotokoll: Reiter neben der Lagekarte, Erfassung von Sichtung/Zone/Pin, keine Erfassung von Auswahl oder Mission,
   Verfall 24/48/72 h/nie (Entfernung nur der Protokolleinträge), Bestätigung beim Verkürzen, Leeren, Persistenz. Exit-Code 1 bei Fehlschlag. */
const PF = require('./_pfad.js'); const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1500, height: 1100 } }); const p = await ctx.newPage(); const err = [];
  p.on('pageerror', x => err.push(x.message)); ctx.on('page', pg => { if (pg !== p) pg.close().catch(() => {}); });
  await p.route(/geobasis|eox|gdi\.berlin|cartocdn|open-meteo|openfreemap|unpkg/, r => r.abort());
  await p.goto(PF.APP); await p.waitForTimeout(5200); await p.fill('#gate-pw', 'pw-test-123'); const z = await p.$('#gate-pw2'); if (z && await z.isVisible()) await z.fill('pw-test-123'); await p.click('#gate-go');
  await p.waitForFunction(() => !document.body.classList.contains('locked'), null, { timeout: 20000 });
  const ok = {};
  await p.evaluate(() => { dispatch({ type: 'DOSSIER_ANGELEGT', typ: 'Person', name: 'Protokolltest', land: 'DE' }); });
  const id = await p.evaluate(() => STATE.dossiers.eigene.find(x => x.name === 'Protokolltest').id);
  await p.evaluate(i => { dispatch({ type: 'SICHTUNG_HINZU', id: i, ort: 'Hauptbahnhof', text: 'Person gesehen', guete: 'plausibel', quelle: 'Meldung' }); }, id);
  await p.evaluate(() => { dispatch({ type: 'PIN_ANGELEGT', ll: [52.52, 13.4] }); });
  /* Zonen setzen den Missionsrahmen voraus (zDef); Missionseinträge selbst werden nicht protokolliert */
  await p.evaluate(() => { dispatch({ type: 'KENNWORT_SCHALTER', an: false }); dispatch({ type: 'STATUS_GESETZT', status: 'Standby' }); dispatch({ type: 'MISSION_ZUGEWIESEN', id: 'M1' }); dispatch({ type: 'MISSION_ANGENOMMEN', id: 'M1' }); dispatch({ type: 'MISSION_BEGINN_JETZT' }); });
  const vorZone = await p.evaluate(() => PROFIL.kartenProtokoll.eintraege.length);
  await p.evaluate(() => { dispatch({ type: 'ZONE_ANGELEGT', ll: [52.51, 13.41] }); });
  ok.missionNichtErfasst = (await p.evaluate(() => PROFIL.kartenProtokoll.eintraege.length)) === vorZone + 1;
  const arten = await p.evaluate(() => PROFIL.kartenProtokoll.eintraege.map(x => x.art));
  ok.erfasst = ['Sichtung', 'Pin', 'Zone'].every(a => arten.includes(a)) && arten.length >= 3;
  /* Auswahl, Navigation, Mausaktionen erzeugen nichts */
  const n0 = await p.evaluate(() => PROFIL.kartenProtokoll.eintraege.length);
  await p.evaluate(() => { dispatch({ type: 'NAVIGATION', modul: 'karte' }); renderModule(); });
  ok.navigationNichtErfasst = (await p.evaluate(() => PROFIL.kartenProtokoll.eintraege.length)) === n0;
  /* Reiter */
  await p.click('#ktab-protokoll'); await p.waitForTimeout(200);
  ok.reiter = await p.evaluate(() => document.getElementById('ktab-protokoll').getAttribute('aria-selected') === 'true' && !!document.getElementById('kp-frist') && document.querySelectorAll('section.panel table tbody tr').length >= 3);
  /* Verfall: zwei Einträge künstlich altern lassen (30 h, 80 h) */
  await p.evaluate(() => { const E = PROFIL.kartenProtokoll.eintraege; E[0].t = new Date(Date.now() - 30 * 3600000).toISOString(); E[1].t = new Date(Date.now() - 80 * 3600000).toISOString(); renderModule(); });
  ok.frist72Bestaetigung = await (async () => { await p.selectOption('#kp-frist', '72'); await p.waitForTimeout(300); return await p.evaluate(() => !!document.getElementById('dlg') && document.getElementById('dlg').open); })();
  await p.evaluate(() => { const d = document.getElementById('dlg'); const btn = Array.from(d.querySelectorAll('button')).find(x => /Frist setzen/.test(x.textContent)); btn && btn.click(); }); await p.waitForTimeout(300);
  const nach72 = await p.evaluate(() => ({ f: PROFIL.kartenProtokoll.frist, n: PROFIL.kartenProtokoll.eintraege.length }));
  ok.frist72 = nach72.f === 72 && nach72.n === n0 - 1;
  /* Objekte selbst bleiben */
  ok.objekteBleiben = await p.evaluate(i => (STATE.dossiers.entitaeten[i].sichtungen || []).length >= 1 && (PROFIL.pins || []).length >= 1, id);
  /* nie: kein Verfall */
  await p.evaluate(() => { dispatch({ type: 'KARTENPROTOKOLL_FRIST', stunden: 0 }); PROFIL.kartenProtokoll.eintraege[0].t = new Date(Date.now() - 900 * 3600000).toISOString(); renderModule(); });
  ok.nie = (await p.evaluate(() => PROFIL.kartenProtokoll.eintraege.length)) === nach72.n;
  /* ungültige Frist wird verworfen */
  await p.evaluate(() => { dispatch({ type: 'KARTENPROTOKOLL_FRIST', stunden: 5 }); });
  ok.ungueltigeFrist = (await p.evaluate(() => PROFIL.kartenProtokoll.frist)) === 0;
  /* Filter */
  await p.selectOption('#kp-filter', 'Sichtung'); await p.waitForTimeout(150);
  ok.filter = await p.evaluate(() => Array.from(document.querySelectorAll('section.panel tbody tr')).every(r => /Sichtung/.test(r.textContent)));
  /* Persistenz */
  const gespeichert = await p.evaluate(() => JSON.parse(localStorage.getItem(PROFIL_KEY) || '{}'));
  ok.persistenz = !!(gespeichert.kartenProtokoll && gespeichert.kartenProtokoll.eintraege.length === nach72.n);
  /* Leeren */
  await p.selectOption('#kp-filter', ''); await p.click('#kp-leeren'); await p.waitForTimeout(300);
  await p.evaluate(() => { const d = document.getElementById('dlg'); const btn = Array.from(d.querySelectorAll('button')).find(x => /Protokoll leeren/.test(x.textContent)); btn && btn.click(); }); await p.waitForTimeout(300);
  ok.leeren = (await p.evaluate(() => PROFIL.kartenProtokoll.eintraege.length)) === 0 && await p.evaluate(i => (STATE.dossiers.entitaeten[i].sichtungen || []).length >= 1, id);
  ok.keineFehler = err.length === 0;
  console.log(JSON.stringify(ok, null, 1)); if (err.length) console.log(err.slice(0, 5));
  await b.close(); process.exit(Object.values(ok).every(Boolean) ? 0 : 1);
})();
