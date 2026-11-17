const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { APP } = require('./_pfad');

(async () => {
  const b = await chromium.launch();
  try {
    const p = await b.newPage({ reducedMotion: 'reduce' });
    p.setDefaultTimeout(12000);
    let bytes = 4200;
    const netz = [], errors = [];
    p.on('pageerror', e => errors.push(e.message));
    await p.route(/^https?:/, async r => {
      const req = r.request();
      if (req.url() !== 'http://127.0.0.1:45678/db') { netz.push(req.url()); return r.abort(); }
      const data = req.postDataJSON();
      netz.push(data.op);
      assert.deepEqual(data.parts, data.op === 'ls' ? ['ops'] : ['ops', 'lagebericht final.txt']);
      await r.fulfill({ json: data.op === 'ls' ? { entries: [{ name: 'lagebericht final.txt', dir: false }] } :
        { name: 'lagebericht final.txt', bytes } });
    });
    await p.goto(APP + '#db=45678.' + 'a'.repeat(43));
    await p.fill('#gate-pw', 'pw-link-kette-123');
    if (await p.isVisible('#gate-pw2')) await p.fill('#gate-pw2', 'pw-link-kette-123');
    await p.click('#gate-go'); await p.click('#profil-terminal-oeffnen');
    await p.emulateMedia({ reducedMotion: 'no-preference' });
    await p.clock.install(); await p.clock.pauseAt(new Date(Date.now() + 1000));
    const inp = p.locator('#profil-terminal-eingabe'), out = p.locator('#profil-terminal-ausgabe');
    const chat = p.locator('#profil-terminal-chat'), orbit = p.locator('#profil-terminal-orbit');
    const progress = p.locator('#profil-terminal-transfer');
    const cmd = async z => { await inp.fill(z); await inp.press('Enter'); };
    const vor = netz.length;
    await cmd('pppd call iridium'); assert.match(await out.textContent(), /pppd: NO CARRIER$/);
    await cmd('predict -t /var/cache/tle/iridium.tle -p "IRIDIUM 142"');
    const rows = (await out.textContent()).split('\n').slice(-3);
    assert.equal(rows.length, 3);
    for (const row of rows) {
      const [epoch, day, date, time] = row.split(/\s+/);
      assert.equal(new Date(+epoch * 1000).toISOString().slice(11, 19), time);
      assert.equal(new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'UTC' }).format(new Date(+epoch * 1000)), day);
      assert.equal(row.trim().split(/\s+/).length, 12, date);
    }
    const bis = await p.evaluate(() => TERMINAL_ZUSTAND.satLink.bis);
    await cmd('predict -t /var/cache/tle/iridium.tle -p "IRIDIUM 142"');
    assert.equal(await p.evaluate(() => TERMINAL_ZUSTAND.satLink.bis), bis);
    const bereit = async () => {
      await cmd('pppd call iridium && tail -n 12 /var/log/syslog');
      await cmd('wg-quick up wg-sat'); assert.match(await out.textContent(), /ppp0 is not ready$/);
      await p.clock.runFor(4000);
      await cmd('tail -n 12 /var/log/syslog'); assert.match(await out.textContent(), /Using interface ppp0/);
      await cmd('wg-quick up wg-sat');
      await cmd('profanity');
      assert.equal(await chat.isVisible(), true); assert.equal(await out.isVisible(), false);
      assert.match(await orbit.textContent(), /IRIDIUM 142  \[LOS/);
      await cmd('/msg kontakt');
      await cmd('/omemo start'); await cmd('/omemo fingerprint');
      assert.match(await chat.textContent(), /OMEMO session started[\s\S]*Your OMEMO fingerprint/);
    };
    await bereit();
    await inp.fill('/sendfile /pgcl-eu3.arch07/ops/lageb'); await inp.press('Tab');
    const ziel = '/sendfile "/pgcl-eu3.arch07/ops/lagebericht final.txt"';
    for (let i = 0; i < 100 && await inp.inputValue() !== ziel; i++) await new Promise(r => setTimeout(r, 10));
    assert.equal(await inp.inputValue(), ziel);
    await inp.press('Enter'); await progress.waitFor({ state: 'visible' });
    await p.clock.runFor(13999); assert.doesNotMatch(await chat.textContent(), /File sent successfully/);
    await p.clock.runFor(1); assert.match(await chat.textContent(), /File sent successfully/);
    await cmd('Auftrag erledigt.'); await p.clock.runFor(7000);
    assert.match(await chat.textContent(), /kontakt: Verstanden\./);
    assert.equal(await chat.isVisible(), true);
    await cmd('/quit');
    assert.equal(await chat.isVisible(), false);
    assert.equal(await p.evaluate(() => !!(TERMINAL_ZUSTAND.modem.bereit && TERMINAL_ZUSTAND.wgSat)), true);
    await cmd('wg show wg-sat'); assert.match(await out.textContent(), /latest handshake/);
    await cmd('wg-quick down wg-sat'); await cmd('poff iridium && tail -n 6 /var/log/syslog');
    assert.match(await out.textContent(), /Terminating on signal 15/);
    assert.equal(await p.evaluate(() => TERMINAL_ZUSTAND.satLink.bis), bis);

    await bereit();
    bytes = 20_000_000;
    await p.clock.fastForward(await p.evaluate(() => TERMINAL_ZUSTAND.satLink.bis - Date.now() - 4000));
    await cmd(ziel); await progress.waitFor({ state: 'visible' });
    await p.clock.runFor(4000);
    assert.match(await orbit.textContent(), /LOS 00m 00s[\s\S]*NO CARRIER/);
    assert.equal(await progress.isVisible(), false);
    assert.doesNotMatch(await chat.textContent(), /Error uploading file/);
    await p.clock.runFor(750);
    assert.match(await chat.textContent(), /Network unreachable[\s\S]*Disconnected/);
    await p.clock.fastForward(61000);
    assert.doesNotMatch(await chat.textContent(), /File sent successfully/);
    await cmd('/quit');
    assert.equal(await p.evaluate(() => TERMINAL_ZUSTAND.modem === null && TERMINAL_ZUSTAND.wgSat.handshake === null), true);
    assert.deepEqual(netz.slice(vor), ['ls', 'send', 'send']);
    assert.deepEqual(errors, []);
    console.log('Terminal-Link-Kette: Überflug, PPP, WireGuard, Chat, /sendfile und LOS grün');
  } finally { await b.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
