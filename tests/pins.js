/* Pins: Anzeigenummer füllt Lücken, interne Kennung bleibt stabil und unsichtbar (Popup, Protokoll). Exit-Code 1 bei Fehlschlag. */
const PF = require('./_pfad.js'); const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1500, height: 1100 } }); const p = await ctx.newPage(); const err = [];
  p.on('pageerror', x => err.push(x.message)); ctx.on('page', pg => { if (pg !== p) pg.close().catch(() => {}); });
  await p.route(/geobasis|eox|gdi\.berlin|cartocdn|open-meteo|openfreemap|unpkg/, r => r.abort());
  await p.goto(PF.APP); await p.waitForTimeout(5200); await p.fill('#gate-pw', 'pw-test-123'); const z = await p.$('#gate-pw2'); if (z && await z.isVisible()) await z.fill('pw-test-123'); await p.click('#gate-go');
  await p.waitForFunction(() => !document.body.classList.contains('locked'), null, { timeout: 20000 });
  const ok = {};
  await p.evaluate(() => { [0, 1, 2].forEach(i => dispatch({ type: 'PIN_ANGELEGT', ll: [52.5 + i / 100, 13.4] })); });
  const n1 = await p.evaluate(() => PROFIL.pins.map(x => x.name + '|' + x.id).join(','));
  await p.evaluate(() => { dispatch({ type: 'PIN_ENTFERNT', id: 'PIN-001' }); dispatch({ type: 'PIN_ANGELEGT', ll: [52.6, 13.5] }); });
  const n2 = await p.evaluate(() => PROFIL.pins.map(x => x.name + '|' + x.id).join(','));
  ok.reihenfolge = n1 === 'Pin 1|PIN-001,Pin 2|PIN-002,Pin 3|PIN-003' && n2 === 'Pin 2|PIN-002,Pin 3|PIN-003,Pin 1|PIN-004';
  const protokoll = await p.evaluate(() => PROFIL.kartenProtokoll.eintraege.map(x => x.text).join(' || '));
  ok.protokollOhneKennung = !/PIN-\d/.test(protokoll) && /Pin 1 bei/.test(protokoll);
  await p.evaluate(() => { dispatch({ type: 'NAVIGATION', modul: 'karte' }); VIEW.karte.reiter = 'karte'; renderModule(); });
  await p.evaluate(() => { VIEW.karte.auswahl = 'PIN-004'; renderModule(); }); await p.waitForTimeout(600);
  const sichtbar = await p.evaluate(() => document.body.innerText);
  ok.popupZeigtName = /Pin 1/.test(sichtbar) && !/PIN-\d{3}/.test(sichtbar);
  ok.keineFehler = err.length === 0;
  console.log(JSON.stringify(ok, null, 1)); if (err.length) console.log(err.slice(0, 5));
  await b.close(); process.exit(Object.values(ok).every(Boolean) ? 0 : 1);
})();
