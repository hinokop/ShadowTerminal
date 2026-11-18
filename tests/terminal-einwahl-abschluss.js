/* Abschluss der Einwahl: nach /quit, wg-quick down und poff verschwindet der Countdown aus der Titelleiste,
   die Überflugberechnung bleibt intern erhalten, und beim späteren LOS erscheint keine zweite Abbruchmeldung. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { APP } = require('./_pfad');

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
    await p.clock.install(); await p.clock.pauseAt(new Date(Date.now() + 1000));
    const inp = p.locator('#profil-terminal-eingabe'), out = p.locator('#profil-terminal-ausgabe');
    const badge = p.locator('#profil-terminal-sat');
    const cmd = async z => { await inp.fill(z); await inp.press('Enter'); };

    await cmd('predict -t /var/cache/tle/iridium.tle -p "IRIDIUM 142"');
    const bis = await p.evaluate(() => TERMINAL_ZUSTAND.satLink.bis);
    await cmd('pppd call iridium'); await p.clock.runFor(7500);
    assert.equal(await p.evaluate(() => TERMINAL_ZUSTAND.modem.bereit), true);
    assert.equal(await badge.isVisible(), true, 'Countdown während der Einwahl sichtbar');
    assert.match(await badge.textContent(), /LOS \d\dm \d\ds/);
    await cmd('wg-quick up wg-sat'); await p.clock.runFor(700);
    await cmd('profanity'); await p.clock.runFor(6100);
    assert.equal(await p.evaluate(() => TERMINAL_ZUSTAND.kanal?.phase), 'eingabe');
    assert.equal(await badge.isVisible(), true, 'Countdown im Chat sichtbar');

    await cmd('/quit');
    assert.equal(await badge.isVisible(), true, 'nach /quit läuft das Modem noch');
    await cmd('wg-quick down wg-sat');
    assert.equal(await badge.isVisible(), true, 'nach wg-quick down läuft das Modem noch');
    await cmd('poff iridium');
    assert.match(await out.textContent(), /Terminating on signal 15\npppd\[1401\]: Connection terminated\.$/);
    await p.clock.runFor(500);
    assert.equal(await badge.isVisible(), false, 'nach vollständigem Abbau kein Countdown');
    assert.equal(await p.evaluate(() => TERMINAL_ZUSTAND.satLink?.bis), bis, 'Überflugberechnung intern erhalten');
    await cmd('predict -t /var/cache/tle/iridium.tle -p "IRIDIUM 142"');
    assert.equal(await p.evaluate(() => TERMINAL_ZUSTAND.satLink.bis), bis, 'derselbe Überflug');
    assert.equal(await badge.isVisible(), false, 'predict allein zeigt keinen Countdown');

    const vorLos = await out.textContent();
    await p.clock.fastForward(bis - await p.evaluate(() => Date.now()) + 1000);
    await p.clock.runFor(500);
    assert.equal(await out.textContent(), vorLos, 'beim LOS keine zweite Abbruchmeldung');
    assert.equal(await badge.isVisible(), false, 'nach LOS kein Countdown');
    await cmd('poff iridium');
    assert.match(await out.textContent(), /poff: iridium is not running$/, 'Grund des früheren poff, kein NO CARRIER');

    /* erneute Einwahl nach LOS: neuer Überflug, Countdown wieder sichtbar */
    await cmd('predict -t /var/cache/tle/iridium.tle -p "IRIDIUM 142"');
    assert.notEqual(await p.evaluate(() => TERMINAL_ZUSTAND.satLink.bis), bis, 'neuer Überflug nach LOS');
    await cmd('pppd call iridium'); await p.clock.runFor(500);
    assert.equal(await badge.isVisible(), true, 'Countdown bei erneuter Einwahl');
    /* LOS bei laufendem Modem: poff nennt NO CARRIER nur bis zum nächsten berechneten Überflug */
    await p.clock.runFor(7500);
    await p.clock.fastForward(await p.evaluate(() => TERMINAL_ZUSTAND.satLink.bis - Date.now()) + 1000);
    assert.equal(await badge.isVisible(), false, 'nach LOS mit Modem kein Countdown');
    await cmd('poff iridium'); assert.match(await out.textContent(), /poff: iridium is not running \(NO CARRIER\)$/);
    await cmd('predict -t /var/cache/tle/iridium.tle -p "IRIDIUM 142"');
    await cmd('poff iridium'); assert.match(await out.textContent(), /poff: iridium is not running$/, 'kein veralteter Abbruchgrund');
    assert.deepEqual(errors, []);
    console.log('OK: Einwahlabschluss ohne Countdown und ohne zweite Abbruchmeldung');
  } finally { await b.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
