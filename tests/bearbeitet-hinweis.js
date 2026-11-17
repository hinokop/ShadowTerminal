/* Hinweis "bearbeitet" am Dossier: nur bei Abweichung vom Original, dezent (kein farbiges Label) und am rechten Rand der Zeile mit den Schaltflächen. Exit-Code 1 bei Fehlschlag. */
const PF = require('./_pfad.js'); const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1500, height: 1100 } })).newPage(); const err = [], ok = {};
  p.on('pageerror', x => err.push(x.message));
  await p.route(/geobasis|eox|gdi\.berlin|cartocdn|open-meteo|openfreemap|unpkg/, r => r.abort());
  await p.goto(PF.APP); await p.waitForTimeout(5200); await p.fill('#gate-pw', 'pw-test-123'); const z = await p.$('#gate-pw2'); if (z && await z.isVisible()) await z.fill('pw-test-123'); await p.click('#gate-go');
  await p.waitForFunction(() => !document.body.classList.contains('locked'), null, { timeout: 20000 });
  const zeig = () => p.evaluate(() => { dispatch({ type: 'NAVIGATION', modul: 'dossier' }); STATE.dossiers.auswahl = 'P-0015'; VIEW.dtab = 'info'; renderModule(); });
  await zeig();
  ok.ohneAenderungKeinHinweis = await p.evaluate(() => !document.querySelector('.bearb-hinweis'));
  await p.evaluate(() => { const e = entitaet('P-0015'); dispatch({ type: 'DOSSIER_BEARBEITET', id: 'P-0015', name: e.name + ' neu', land: e.land, aliase: '', rolle: e.rolle, eckdaten: e.eckdaten.join('\n'), stufe: e.bedrohung.stufe, begruendung: '' }); });
  await zeig();
  const h = await p.evaluate(() => { const x = document.querySelector('.bearb-hinweis'); if (!x) return null; const r = x.getBoundingClientRect(), z = x.parentElement.getBoundingClientRect(), cs = getComputedStyle(x);
    return { text: x.textContent, label: x.classList.contains('label'), klein: parseFloat(cs.fontSize) <= 12, rechts: z.right - r.right < 24, hintergrund: cs.backgroundColor, rand: cs.borderTopWidth }; });
  ok.hinweisNachAenderung = !!h && h.text === 'bearbeitet';
  ok.hinweisDezent = !!h && !h.label && h.klein && h.rand === '0px' && /rgba\(0, 0, 0, 0\)|transparent/.test(h.hintergrund);
  ok.hinweisAmRechtenRand = !!h && h.rechts;
  await p.evaluate(() => dispatch({ type: 'DOSSIER_ZURUECKGESETZT', id: 'P-0015' })); await zeig();
  ok.nachZuruecksetzenWeg = await p.evaluate(() => !document.querySelector('.bearb-hinweis'));
  ok.keineJsFehler = err.length === 0; if (err.length) console.log(err.slice(0, 4));
  const bad = Object.keys(ok).filter(k => ok[k] !== true); console.log(JSON.stringify(ok, null, 1), h); console.log(bad.length ? 'FAIL: ' + bad.join(', ') : 'alle grün');
  await b.close(); process.exit(bad.length ? 1 : 0);
})();
