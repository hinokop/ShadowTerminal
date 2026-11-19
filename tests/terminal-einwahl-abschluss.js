/* Abschluss der Einwahl: nach /quit, wg-quick down und poff verschwindet der Countdown aus der Titelleiste,
   die Überflugberechnung bleibt intern erhalten, und beim späteren LOS erscheint keine zweite Abbruchmeldung. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { APP } = require('./_pfad');
const { imUeberflug } = require('./_kestrel');

(async () => {
  const b = await chromium.launch();
  try {
    const p = await b.newPage({ reducedMotion: 'reduce' });
    p.setDefaultTimeout(12000);
    const errors = [];
    p.on('pageerror', e => errors.push(e.message));
    await p.route(/^https?:/, r => r.abort());
    await p.goto(APP);
    await p.fill('#gate-pw', 'pw-test-123');
    if (await p.isVisible('#gate-pw2')) await p.fill('#gate-pw2', 'pw-test-123');
    await p.click('#gate-go'); await p.click('#profil-terminal-oeffnen');
    await p.clock.install(); await imUeberflug(p);
    const inp = p.locator('#profil-terminal-eingabe'), out = p.locator('#profil-terminal-ausgabe');
    const badge = p.locator('#profil-terminal-sat');
    const cmd = async z => { await inp.fill(z); await inp.press('Enter'); };

    await cmd('predict -t /var/cache/tle/kestrel.tle -p KESTREL-1');
    assert.equal(await p.evaluate(() => TERMINAL_ZUSTAND.satLink), null, 'predict rechnet nur');
    assert.equal(await badge.isVisible(), false, 'predict allein zeigt keinen Countdown');
    await cmd('pon kestrel'); await p.clock.runFor(7500);
    assert.equal(await p.evaluate(() => TERMINAL_ZUSTAND.modem.bereit), true);
    const bis = await p.evaluate(() => TERMINAL_ZUSTAND.satLink.bis);
    assert.equal(await badge.isVisible(), true, 'Countdown während der Einwahl sichtbar');
    assert.match(await badge.textContent(), /^KESTREL-\d · LOS \d\d:\d\d:\d\d$/);
    await cmd('wg-quick up wg-sat'); await p.clock.runFor(700);
    await cmd('profanity'); await p.clock.runFor(6100);
    assert.equal(await p.evaluate(() => TERMINAL_ZUSTAND.kanal?.phase), 'eingabe');
    assert.equal(await badge.isVisible(), true, 'Countdown im Chat sichtbar');

    await cmd('/quit');
    assert.equal(await badge.isVisible(), true, 'nach /quit läuft das Modem noch');
    await cmd('wg-quick down wg-sat');
    assert.equal(await badge.isVisible(), true, 'nach wg-quick down läuft das Modem noch');
    await cmd('poff kestrel');
    assert.match(await out.textContent(), /root@terminal:\/# poff kestrel$/, 'poff bei Erfolg still');
    assert.equal(await p.evaluate(() => TERMINAL_ZUSTAND.modem), null);
    await p.clock.runFor(500);
    assert.equal(await badge.isVisible(), false, 'nach vollständigem Abbau kein Countdown');

    const vorLos = await out.textContent();
    await p.clock.fastForward(bis - await p.evaluate(() => Date.now()) + 1000);
    await p.clock.runFor(500);
    assert.equal(await out.textContent(), vorLos, 'beim LOS keine zweite Abbruchmeldung');
    assert.equal(await badge.isVisible(), false, 'nach LOS kein Countdown');
    await cmd('poff kestrel');
    assert.match(await out.textContent(), /poff: I could not find a pppd process for provider 'kestrel'\. None stopped\.$/, 'kein Hinweis auf Signalverlust');

    /* nächster Überflug: erneute Einwahl, Countdown wieder sichtbar; LOS bei laufendem Modem meldet sich selbst */
    await imUeberflug(p);
    await cmd('pon kestrel'); await p.clock.runFor(500);
    assert.equal(await badge.isVisible(), true, 'Countdown bei erneuter Einwahl');
    await p.clock.runFor(7500);
    await p.clock.fastForward(await p.evaluate(() => TERMINAL_ZUSTAND.satLink.bis - Date.now()) + 1000);
    assert.match(await out.textContent(), /pppd\[\d+\]: Modem hangup \(NO CARRIER\)\npppd\[\d+\]: Connection terminated\.$/);
    assert.equal(await badge.isVisible(), false, 'nach LOS mit Modem kein Countdown');
    // persist: pppd wählt nach LOS weiter; poff beendet es still, danach läuft keins mehr.
    await cmd('poff'); assert.match(await out.textContent(), /root@terminal:\/# poff$/);
    await cmd('poff'); assert.match(await out.textContent(), /poff: No pppd is running\.  None stopped\.$/);
    assert.deepEqual(errors, []);
    console.log('OK: Einwahlabschluss ohne Countdown und ohne zweite Abbruchmeldung');
  } finally { await b.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
