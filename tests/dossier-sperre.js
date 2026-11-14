/* Dossier sperren: gesperrte Dossiers erscheinen nur mit Nummer (alle Module, Karte, Suche), Entsperren verlangt die Zugangskennung,
   Sperre bleibt nach Neuladen. Exit-Code 1 bei Fehlschlag. */
const PF = require('./_pfad.js'); const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1500, height: 1100 } }); const p = await ctx.newPage(); const err = [];
  p.on('pageerror', x => err.push(x.message)); ctx.on('page', pg => { if (pg !== p) pg.close().catch(() => {}); });
  await p.route(/geobasis|eox|gdi\.berlin|cartocdn|open-meteo|openfreemap|unpkg/, r => r.abort());
  const anmelden = async () => {
    await p.goto(PF.APP); await p.waitForTimeout(5200); await p.fill('#gate-pw', 'pw-test-123'); const z = await p.$('#gate-pw2'); if (z && await z.isVisible()) await z.fill('pw-test-123'); await p.click('#gate-go');
    await p.waitForFunction(() => !document.body.classList.contains('locked'), null, { timeout: 20000 });
  };
  await anmelden();
  const ok = {};
  const d = await p.evaluate(() => { dispatch({ type: 'DOSSIER_ANGELEGT', name: 'Quarzfeld Testmann', typ: 'Person' }); const e = STATE.dossiers.eigene.find(x => x.name === 'Quarzfeld Testmann'); dispatch({ type: 'DOSSIER_ORT', id: e.id, text: '52.5200, 13.4050' }); dispatch({ type: 'SICHTUNG_HINZU', id: e.id, ort: '52.5210, 13.4060', text: 'Quarzfeld Testmann gesehen', guete: 'unbewertet' }); STATE.dossiers.auswahl = e.id; dispatch({ type: 'NAVIGATION', modul: 'dossier' }); renderModule(); return { id: e.id, name: e.name }; });
  await p.waitForTimeout(400);
  const sichtbar = () => p.evaluate(n => document.body.innerText.indexOf(n) >= 0, d.name);
  ok.vorherSichtbar = await sichtbar();
  await p.click('#dg-sperren'); await p.waitForTimeout(400);
  ok.gesperrt = await p.evaluate(i => PROFIL.gesperrt.indexOf(i) >= 0, d.id);
  ok.dossierNurNummer = !(await sichtbar()) && await p.evaluate(i => !!document.getElementById('dg-pw') && document.getElementById('dl-' + i).innerText.trim() === i, d.id);
  /* alle Module durchgehen, auch die Karte mit den Ebenen */
  const mods = await p.evaluate(() => MODULES.map(m => m.id)); const treffer = [];
  for (const m of mods) {
    await p.evaluate(x => { dispatch({ type: 'NAVIGATION', modul: x }); if (x === 'karte') { VIEW.karte.reiter = 'karte'; VIEW.karte.lat = 52.52; VIEW.karte.lon = 13.405; VIEW.karte.zoom = 15; renderModule(); } }, m);
    await p.waitForTimeout(350);
    if (await sichtbar()) treffer.push(m);
  }
  ok.keinModulZeigtName = treffer.length === 0; if (treffer.length) console.log('Name sichtbar in:', treffer.join(','));
  ok.karteOhneMarker = await p.evaluate(i => !karteMarker().some(m => m.entId === i || m.id === i), d.id);
  /* 3D-Übergabe: Pin- und Zonennamen, die den gesperrten Namen enthalten, gehen nur mit der Nummer an den eingebetteten Kartenrahmen */
  await p.evaluate(() => { dispatch({ type: 'PIN_ANGELEGT', ll: [52.5201, 13.4051], name: 'Notiz zu Quarzfeld Testmann' }); dispatch({ type: 'OZONE_ANGELEGT', ll: [52.5202, 13.4052] }); dispatch({ type: 'OZONE_GEAENDERT', id: PROFIL.zonen[PROFIL.zonen.length - 1].id, name: 'Bereich Quarzfeld Testmann' }); });
  const daten3d = () => p.evaluate(() => JSON.stringify(karte3dDaten()));
  const d3 = await daten3d();
  ok.dreiDOhneName = !/Quarzfeld/i.test(d3) && new RegExp('Notiz zu ' + d.id).test(d3) && new RegExp('Bereich ' + d.id).test(d3);
  /* Suche: nur Nummer */
  await p.evaluate(() => { dispatch({ type: 'NAVIGATION', modul: 'dossier' }); VIEW.dossier.q = 'quarz'; renderModule(); }); await p.waitForTimeout(300);
  ok.sucheNachNameOhneTreffer = await p.evaluate(i => !document.getElementById('dl-' + i), d.id);
  await p.evaluate(i => { VIEW.dossier.q = i; STATE.dossiers.auswahl = i; renderModule(); }, d.id); await p.waitForTimeout(300);
  ok.sucheNachNummer = await p.evaluate(i => !!document.getElementById('dl-' + i), d.id);
  /* Neuladen: bleibt gesperrt */
  await anmelden();
  ok.nachNeuladen = await p.evaluate(i => PROFIL.gesperrt.indexOf(i) >= 0, d.id);
  await p.evaluate(i => { STATE.dossiers.auswahl = i; VIEW.dossier.q = ''; dispatch({ type: 'NAVIGATION', modul: 'dossier' }); renderModule(); }, d.id); await p.waitForTimeout(400);
  /* Entsperren: falsche Kennung bleibt gesperrt, richtige entsperrt */
  await p.fill('#dg-pw', 'falsch'); await p.click('#dg-auf'); await p.waitForTimeout(1500);
  ok.falscheKennung = await p.evaluate(i => PROFIL.gesperrt.indexOf(i) >= 0 && /falsch/.test(document.getElementById('dg-fehler').innerText), d.id);
  await p.fill('#dg-pw', 'pw-test-123'); await p.click('#dg-auf'); await p.waitForTimeout(1500);
  ok.entsperrt = await p.evaluate(i => PROFIL.gesperrt.indexOf(i) < 0, d.id);
  ok.nameWieder = await sichtbar();
  ok.dreiDNameWieder = /Notiz zu Quarzfeld Testmann/.test(await daten3d());
  ok.keineFehler = err.length === 0;
  console.log(JSON.stringify(ok, null, 1)); if (err.length) console.log(err.slice(0, 5));
  await b.close(); process.exit(Object.values(ok).every(Boolean) ? 0 : 1);
})();
