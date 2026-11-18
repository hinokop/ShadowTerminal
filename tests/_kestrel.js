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
        // Nicht in die Vergangenheit springen; genug Elevation und mindestens 6 min bis zum Untergang.
        let t = Math.max(best.von, Math.ceil(Date.now() / 1000) * 1000 + 1000);
        while (kestrelEl(best.sat, t) < el && t < best.bis) t += 5000;
        if (kestrelEl(best.sat, t) >= el && best.bis - t >= 360000) return { t, von: best.von, bis: best.bis, max: best.maxMs, name: best.sat.name };
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

/* Chat bereitstellen: Uhr in einen Überflug, Einwahl, Tunnel, profanity bis zur Anmeldung; danach läuft die Zeit weiter.
   kontakt: zusätzlich /msg an den vorgeschlagenen Kontakt (für /sendfile nötig). */
async function chatBereit(p, { kontakt = true } = {}) {
  try { await p.clock.install(); } catch (e) { /* bereits installiert */ }
  await imUeberflug(p);
  const inp = p.locator('#profil-terminal-eingabe');
  await inp.fill('pppd call kestrel updetach && wg-quick up wg-sat && profanity'); await inp.press('Enter');
  await p.clock.runFor(14500);
  await p.waitForFunction(() => TERMINAL_ZUSTAND.kanal?.phase === 'eingabe');
  if (kontakt) {
    const v = await p.evaluate(() => TERMINAL_ZUSTAND.kanal.vorschlag);
    await inp.fill('/msg ' + v); await inp.press('Enter');
  }
  await p.clock.resume();
}
module.exports.chatBereit = chatBereit;
