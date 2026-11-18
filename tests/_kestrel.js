/* Testhilfe: simulierte Uhr in den nächsten KESTREL-Überflug mit ausreichender Elevation setzen (echte Bahnrechnung). */
const assert = require('node:assert/strict');
async function imUeberflug(p, { minMax = 15, el = 10, wahl = 'ok' } = {}) {
  const ziel = await p.evaluate(({ minMax, el }) => {
    let ab = Date.now();
    for (let k = 0; k < 60; k++) {
      let best = null;
      for (const sat of kestrelSats()) { const u = kestrelUeberflug(sat, ab); if (u && (!best || u.von < best.von)) best = u; }
      if (!best) return null;
      if (best.maxEl >= minMax) {
        let t = best.von;
        while (kestrelEl(best.sat, t) < el && t < best.maxMs) t += 5000;
        return { t, von: best.von, bis: best.bis, max: best.maxMs, name: best.sat.name };
      }
      ab = best.bis + 60000;
    }
    return null;
  }, { minMax, el });
  assert.ok(ziel, 'kein geeigneter Überflug in den nächsten Tagen');
  // In Schritten unter der Leerlaufsperre (15 min) vorrücken; ein Ereignis je Schritt hält die Sitzung offen.
  let jetzt = await p.evaluate(() => Date.now());
  while (ziel.t - jetzt > 600000) {
    jetzt += 600000;
    await p.clock.pauseAt(new Date(jetzt));
    await p.evaluate(() => document.dispatchEvent(new Event('pointermove')));
  }
  await p.clock.pauseAt(new Date(ziel.t));
  await p.evaluate(() => document.dispatchEvent(new Event('pointermove')));
  if (wahl) await p.evaluate(w => { TERMINAL_ZUSTAND.wahlVorgabe = w; }, wahl);
  return ziel;
}
module.exports = { imUeberflug };
