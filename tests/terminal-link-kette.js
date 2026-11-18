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
    await p.clock.install(); await p.clock.pauseAt(new Date(Date.now() + 1000));
    const inp = p.locator('#profil-terminal-eingabe'), out = p.locator('#profil-terminal-ausgabe');
    const chat = p.locator('#profil-terminal-chat'), orbit = p.locator('#profil-terminal-orbit');
    const progress = p.locator('#profil-terminal-transfer');
    const prompt = p.locator('#profil-terminal-prompt');
    const cmd = async z => { await inp.fill(z); await inp.press('Enter'); };
    const vor = netz.length;
    await cmd('help');
    assert.match(await out.textContent(), /pppd call iridium \[updetach\]/);
    assert.doesNotMatch(await out.textContent(), /satcon-tx|secure-channel|send <datei>/);
    await cmd('pppd call iridium'); assert.match(await out.textContent(), /pppd: NO CARRIER$/);
    await inp.fill('pre'); await inp.press('Tab');
    let eingabe = 'predict ';
    assert.equal(await inp.inputValue(), eingabe);
    for (const token of ['-t', '/var/cache/tle/iridium.tle', '-p', '"IRIDIUM 142"']) {
      await inp.press('Tab'); eingabe += token + ' ';
      assert.equal(await inp.inputValue(), eingabe);
    }
    await inp.press('Tab'); assert.equal(await inp.inputValue(), eingabe);
    await inp.press('Enter');
    const rows = (await out.textContent()).split('\n').slice(-3);
    assert.equal(rows.length, 3);
    for (const row of rows) {
      assert.doesNotMatch(row, /\b12345\b/);
      const [epoch, day, date, time] = row.split(/\s+/);
      assert.equal(new Date(+epoch * 1000).toISOString().slice(11, 19), time);
      assert.equal(new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'UTC' }).format(new Date(+epoch * 1000)), day);
      assert.equal(row.trim().split(/\s+/).length, 12, date);
    }
    const bis = await p.evaluate(() => TERMINAL_ZUSTAND.satLink.bis);
    await cmd('predict -t /var/cache/tle/iridium.tle -p "IRIDIUM 142"');
    assert.equal(await p.evaluate(() => TERMINAL_ZUSTAND.satLink.bis), bis);
    await inp.fill('predict -t /var/cache/tle/iridium.tle -f ');
    await inp.press('Tab');
    assert.equal(await inp.inputValue(), 'predict -t /var/cache/tle/iridium.tle -f "IRIDIUM 142" ');
    await inp.press('Enter');
    // -f ohne Zeitangabe: eine Zeile für jetzt (predict(1)); die laufende Verfolgung gehört zum interaktiven predict.
    assert.equal(await orbit.isVisible(), false);
    assert.equal((await out.textContent()).split('-f "IRIDIUM 142"\n').at(-1).trim().split(/\s+/).length, 12);
    await cmd('predict -t /var/cache/tle/iridium.tle');
    assert.equal(await orbit.isVisible(), true);
    const ersteZeile = await orbit.textContent();
    await p.clock.runFor(1000);
    assert.notEqual(await orbit.textContent(), ersteZeile);
    await inp.press('Control+c'); assert.equal(await orbit.isVisible(), false);
    await inp.fill('pppd '); await inp.press('Tab');
    assert.equal(await inp.inputValue(), 'pppd call iridium updetach');
    await inp.press('Enter');
    assert.equal(await prompt.textContent(), '');
    await p.clock.runFor(450);
    assert.match(await out.textContent(), /AT\+CSQ/);
    await inp.press('Control+c');
    assert.match(await out.textContent(), /Terminating on signal 2/);
    assert.equal(await prompt.textContent(), 'root@terminal:/#');
    await p.clock.runFor(7500);
    assert.equal(await p.evaluate(() => TERMINAL_ZUSTAND.modem), null);
    const bereit = async (vordergrund = false) => {
      await cmd(vordergrund ? 'pppd call iridium updetach' : 'pppd call iridium && tail -n 12 /var/log/syslog');
      if (vordergrund) {
        await p.clock.runFor(3949);
        assert.doesNotMatch((await out.textContent()).split('updetach\n').at(-1), /CONNECT 19200/);
        await p.clock.runFor(1);
        assert.match(await out.textContent(), /CONNECT 19200/);
        await p.clock.runFor(3549);
        assert.equal(await prompt.textContent(), '');
        await cmd('wg-quick up wg-sat');
        assert.equal(await p.evaluate(() => TERMINAL_ZUSTAND.wgSat), null);
        await p.clock.runFor(1);
        assert.match(await out.textContent(), /local IP address/);
        assert.equal(await prompt.textContent(), 'root@terminal:/#');
      } else {
        await cmd('wg-quick up wg-sat'); assert.match(await out.textContent(), /ppp0 is not ready$/);
        await p.clock.runFor(7500);
      }
      await cmd('tail -n 12 /var/log/syslog'); assert.match(await out.textContent(), /Using interface ppp0/);
      // wg-quick läuft im Vordergrund; profanity vorher scheitert ohne Tunnel.
      await cmd('profanity'); assert.match(await out.textContent(), /profanity: Network unreachable$/);
      await cmd('wg-quick up wg-sat');
      await p.clock.runFor(650);
      await cmd('profanity');
      assert.equal(await chat.isVisible(), true); assert.equal(await out.isVisible(), false);
      assert.match(await orbit.textContent(), /IRIDIUM 142  \[LOS/);
      assert.match(await chat.textContent(), /Connecting to ghost@node-5966-q\.onion/);
      await p.clock.runFor(5999); assert.doesNotMatch(await chat.textContent(), /logged in/);
      await p.clock.runFor(1); assert.match(await chat.textContent(), /logged in successfully, online\./);
      await inp.fill('/m'); await inp.press('Tab'); assert.equal(await inp.inputValue(), '/msg ');
      await inp.fill('/msg node-5966-q.onion'); await inp.press('Tab');
      const vorschlag = await inp.inputValue();
      assert.match(vorschlag, /^\/msg [a-z]{14}@node-5966-q\.onion$/);
      await inp.press('Enter');
      await cmd('/omemo start');
      await p.clock.runFor(2999); assert.doesNotMatch(await chat.textContent(), /OMEMO session started/);
      await p.clock.runFor(1);
      await cmd('/omemo fingerprint');
      assert.match(await chat.textContent(), /\/msg [a-z]+@node-5966-q\.onion[\s\S]*\/omemo start[\s\S]*OMEMO session started[\s\S]*\/omemo fingerprint[\s\S]*Your OMEMO fingerprint[\s\S]*'s OMEMO fingerprint/);
    };
    await bereit(true);
    await inp.fill('/sendfile /pgcl-eu3.arch07/ops/lageb'); await inp.press('Tab');
    const ziel = '/sendfile "/pgcl-eu3.arch07/ops/lagebericht final.txt"';
    for (let i = 0; i < 100 && await inp.inputValue() !== ziel; i++) await new Promise(r => setTimeout(r, 10));
    assert.equal(await inp.inputValue(), ziel);
    await inp.press('Enter'); await progress.waitFor({ state: 'visible' });
    await p.clock.runFor(13999); assert.doesNotMatch(await chat.textContent(), /File sent successfully/);
    await p.clock.runFor(1); assert.match(await chat.textContent(), /File sent successfully/);
    await cmd('Auftrag erledigt.'); await p.clock.runFor(7000);
    assert.match(await chat.textContent(), /[a-z]{14}@node-5966-q\.onion: Verstanden\./);
    assert.equal(await chat.isVisible(), true);
    await cmd('/quit');
    assert.equal(await chat.isVisible(), false);
    assert.equal(await p.evaluate(() => !!(TERMINAL_ZUSTAND.modem.bereit && TERMINAL_ZUSTAND.wgSat)), true);
    await cmd('wg show wg-sat'); assert.match(await out.textContent(), /latest handshake/);
    await cmd('wg-quick down wg-sat');
    // poff kennt nur seine eigenen Argumente; && und tail gehören der Shell.
    await cmd('poff -x');
    assert.match(await out.textContent(), /poff: Illegal option -- x\.$/);
    assert.equal(await p.evaluate(() => TERMINAL_ZUSTAND.modem.bereit), true);
    await cmd('poff iridium');
    assert.match(await out.textContent(), /root@terminal:\/# poff iridium$/, 'poff bei Erfolg still');
    assert.equal(await p.evaluate(() => TERMINAL_ZUSTAND.modem), null);
    await cmd('pppd call iridium'); await p.clock.runFor(7500);
    await cmd('poff iridium && tail -n 6 /var/log/syslog');
    assert.match(await out.textContent(), /poff iridium && tail -n 6 \/var\/log\/syslog\n(?:.*\n){4}.*terminal pppd\[1401\]: Terminating on signal 15\n.*Connection terminated\.$/);
    assert.equal((await out.textContent()).split('poff iridium && tail').at(-1).match(/Terminating on signal 15/g).length, 1, 'Abbau genau einmal, im Syslog');
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
    await cmd('wg-quick down wg-sat');
    await cmd('predict -t /var/cache/tle/iridium.tle -p "IRIDIUM 142"');
    await cmd('pppd call iridium updetach');
    await p.clock.runFor(7500);
    await p.clock.fastForward(await p.evaluate(() => TERMINAL_ZUSTAND.satLink.bis - Date.now()));
    assert.match(await out.textContent(), /pppd\[1401\]: Modem hangup \(NO CARRIER\)\npppd\[1401\]: Connection terminated\.$/);
    await cmd('poff iridium');
    assert.match(await out.textContent(), /poff: I could not find a pppd process for provider 'iridium'\. None stopped\.$/);
    await cmd('poff iridium && tail -n 6 /var/log/syslog');
    assert.match(await out.textContent(), /poff: I could not find a pppd process for provider 'iridium'\. None stopped\.$/);
    assert.deepEqual(netz.slice(vor), ['ls', 'send', 'send']);
    assert.deepEqual(errors, []);
    console.log('Terminal-Link-Kette: Überflug, PPP, WireGuard, Chat, /sendfile und LOS grün');
  } finally { await b.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
