const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { APP } = require('./_pfad');
const { imUeberflug, verbunden, gescheitert } = require('./_kestrel');

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
    await p.clock.install(); await imUeberflug(p);
    const inp = p.locator('#profil-terminal-eingabe'), out = p.locator('#profil-terminal-ausgabe');
    const chat = p.locator('#profil-terminal-chat'), orbit = p.locator('#profil-terminal-orbit');
    const progress = p.locator('#profil-terminal-transfer');
    const prompt = p.locator('#profil-terminal-prompt');
    const cmd = async z => { await inp.fill(z); await inp.press('Enter'); };
    const vor = netz.length;
    await cmd('help');
    assert.match(await out.textContent(), /pon kestrel · pppd call kestrel \[updetach\]/);
    assert.doesNotMatch(await out.textContent(), /satcon-tx|secure-channel|send <datei>/);
    // Der alte Funkweg (sat0) ist entfernt: keine Befehle, keine Tab-Ergänzung, keine Datei.
    for (const alt of ['satcon-tx', 'secure-channel', 'send']) { await cmd(alt); assert.match(await out.textContent(), new RegExp(alt + ': command not found$')); }
    await inp.fill('sec'); await inp.press('Tab'); assert.equal(await inp.inputValue(), 'sec');
    await cmd('ls /var/cache/tle'); assert.match(await out.textContent(), /\nkestrel\.tle$/);
    await cmd('pppd call iridium'); assert.match(await out.textContent(), /pppd: unable to open \/etc\/ppp\/peers\/iridium: No such file or directory$/);
    await inp.fill('pre'); await inp.press('Tab');
    let eingabe = 'predict ';
    assert.equal(await inp.inputValue(), eingabe);
    for (const token of ['-t', '/var/cache/tle/kestrel.tle', '-p']) {
      await inp.press('Tab'); eingabe += token + ' ';
      assert.equal(await inp.inputValue(), eingabe);
    }
    await inp.fill(eingabe + 'KESTREL-1'); await inp.press('Enter');
    const rows = (await out.textContent()).split('-p KESTREL-1\n').at(-1).split('\n');
    assert.ok(rows.length >= 3, 'Überflug vom Aufgang bis zum Untergang');
    for (const row of rows) {
      assert.doesNotMatch(row, /\b12345\b/);
      const [epoch, day, date, time] = row.split(/\s+/);
      assert.equal(new Date(+epoch * 1000).toISOString().slice(11, 19), time);
      assert.equal(new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'UTC' }).format(new Date(+epoch * 1000)), day);
      assert.ok(row.trim().split(/\s+/).length === 12 || (row.trim().split(/\s+/).length === 11 && / $/.test(row)), date); // im Erdschatten ist die letzte Spalte leer
    }
    assert.equal(await p.evaluate(() => TERMINAL_ZUSTAND.satLink), null, 'predict rechnet nur');
    await cmd('predict -t /var/cache/tle/kestrel.tle -f KESTREL-1');
    // -f ohne Zeitangabe: eine Zeile für jetzt (predict(1)); die laufende Verfolgung gehört zum interaktiven predict.
    assert.equal(await orbit.isVisible(), false);
    const fZeile = (await out.textContent()).split('-f KESTREL-1\n').at(-1);
    assert.ok([12, 11].includes(fZeile.trim().split(/\s+/).length) && !fZeile.includes('\n'), fZeile);
    await cmd('predict');
    assert.equal(await orbit.isVisible(), true);
    const ersteZeile = await orbit.textContent();
    await p.clock.runFor(1000);
    assert.notEqual(await orbit.textContent(), ersteZeile);
    await inp.press('Control+c'); assert.equal(await orbit.isVisible(), false);
    await inp.fill('pppd '); await inp.press('Tab');
    assert.equal(await inp.inputValue(), 'pppd call kestrel updetach');
    await inp.press('Enter');
    assert.equal(await prompt.textContent(), '');
    await p.clock.runFor(450);
    assert.match(await out.textContent(), /AT\+CSQ/);
    await inp.press('Control+c');
    assert.match(await out.textContent(), /chat\[\d+\]: SIGINT\npppd\[\d+\]: Connect script failed\npppd\[\d+\]: Exit\.$/);
    assert.equal(await prompt.textContent(), 'root@terminal:/#');
    await p.clock.runFor(7500);
    assert.equal(await p.evaluate(() => TERMINAL_ZUSTAND.modem), null);
    // Feste Dauern für die Grenzprüfungen (sonst gestreut, siehe TERMINAL_PPP_DAUER): CONNECT 12 s nach ATDT, IP 10,9 s danach.
    await p.evaluate(() => Object.assign(TERMINAL_PPP_DAUER, { connect: [12000, 12000], ppp: [800, 800], ip: [10000, 10000] }));
    const bereit = async (vordergrund = false) => {
      await cmd(vordergrund ? 'pppd call kestrel updetach' : 'pppd call kestrel && tail -n 12 /var/log/syslog');
      if (vordergrund) {
        await p.clock.runFor(150 + 550 + 12000 - 1);
        assert.doesNotMatch((await out.textContent()).split('updetach\n').at(-1), /CONNECT 19200/);
        await p.clock.runFor(1);
        assert.match(await out.textContent(), /CONNECT 19200/);
        await p.clock.runFor(100 + 800 + 10000 - 1);
        assert.equal(await prompt.textContent(), '');
        await cmd('wg-quick up wg-sat');
        assert.equal(await p.evaluate(() => TERMINAL_ZUSTAND.wgSat), null);
        await p.clock.runFor(1);
        assert.match(await out.textContent(), /local\s+IP address/);
        assert.equal(await prompt.textContent(), 'root@terminal:/#');
      } else {
        await cmd('wg-quick up wg-sat'); assert.match(await out.textContent(), /ppp0 is not ready$/);
        await verbunden(p);
      }
      await cmd('tail -n 12 /var/log/syslog'); assert.match(await out.textContent(), /Using interface ppp0/);
      // wg-quick läuft im Vordergrund; profanity vorher scheitert ohne Tunnel.
      await cmd('profanity'); assert.match(await out.textContent(), /profanity: Network unreachable$/);
      await cmd('wg-quick up wg-sat');
      await p.clock.runFor(650);
      await cmd('profanity');
      assert.equal(await chat.isVisible(), true); assert.equal(await out.isVisible(), false);
      assert.match(await orbit.textContent(), /KESTREL-\d  \[LINK END/);
      assert.match(await chat.textContent(), /Connecting to ghost@[a-z2-7]{56}\.onion/);
      await p.clock.runFor(5999); assert.doesNotMatch(await chat.textContent(), /logged in/);
      await p.clock.runFor(1); assert.match(await chat.textContent(), /logged in successfully, online\./);
      await inp.fill('/m'); await inp.press('Tab'); assert.equal(await inp.inputValue(), '/msg ');
      await inp.fill('/msg ' + await p.evaluate(() => TERMINAL_XMPP_DOMAIN)); await inp.press('Tab');
      const vorschlag = await inp.inputValue();
      assert.match(vorschlag, /^\/msg [a-z]{14}@[a-z2-7]{56}\.onion$/);
      await inp.press('Enter');
      await cmd('/omemo start');
      await p.clock.runFor(2999); assert.doesNotMatch(await chat.textContent(), /OMEMO session started/);
      await p.clock.runFor(1);
      await cmd('/omemo fingerprint');
      // Gesprächsfenster des Kontakts: Befehle erscheinen nicht im Verlauf; OMEMO steht im Titel.
      assert.match(await chat.textContent(), /OMEMO session started[\s\S]*Your OMEMO fingerprint[\s\S]*'s OMEMO fingerprint/);
      assert.doesNotMatch(await chat.textContent(), /\/msg |\/omemo /);
      assert.match(await p.locator('#profil-terminal-xmpp-titel').textContent(), /^[a-z]{14}@[a-z2-7]{56}\.onion \[OMEMO\]\[online\]$/);
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
    assert.match(await chat.textContent(), /[a-z]{14}@[a-z2-7]{56}\.onion: Verstanden\./);
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
    await cmd('poff kestrel');
    assert.match(await out.textContent(), /root@terminal:\/# poff kestrel$/, 'poff bei Erfolg still');
    assert.equal(await p.evaluate(() => TERMINAL_ZUSTAND.modem), null);
    await cmd('pppd call kestrel'); await verbunden(p);
    await cmd('poff kestrel && tail -n 6 /var/log/syslog');
    assert.match(await out.textContent(), /poff kestrel && tail -n 6 \/var\/log\/syslog\n(?:.*\n){3}.*terminal pppd\[\d+\]: Terminating on signal 15\n.*Connection terminated\.\n.*terminal pppd\[\d+\]: Exit\.$/);
    assert.equal((await out.textContent()).split('poff kestrel && tail').at(-1).match(/Terminating on signal 15/g).length, 1, 'Abbau genau einmal, im Syslog');

    await bereit();
    bytes = 20_000_000;
    await p.clock.fastForward(await p.evaluate(() => TERMINAL_ZUSTAND.satLink.bis - Date.now() - 4000));
    await cmd(ziel); await progress.waitFor({ state: 'visible' });
    await p.clock.runFor(4000);
    // LOS: Chat offline, der KESTREL-Block verschwindet; die Ursache steht im Chatverlauf.
    assert.equal(await orbit.isVisible(), false);
    assert.doesNotMatch(await chat.textContent(), /pppd:/, 'die Modemursache steht im Syslog, nicht im Chat');
    assert.equal(await progress.isVisible(), false);
    assert.doesNotMatch(await chat.textContent(), /Error uploading file/);
    await p.clock.runFor(750);
    assert.match(await chat.textContent(), /Network unreachable[\s\S]*Lost connection\./);
    await p.clock.fastForward(61000);
    assert.doesNotMatch(await chat.textContent(), /File sent successfully/);
    await cmd('/quit');
    // persist: nach dem Hangup bleibt pppd und wählt neu (ohne Verbindung); der Tunnel hat keinen Handshake mehr.
    assert.equal(await p.evaluate(() => !!TERMINAL_ZUSTAND.modem && !TERMINAL_ZUSTAND.modem.bereit && TERMINAL_ZUSTAND.wgSat.handshake === null), true);
    await cmd('wg-quick down wg-sat');
    await cmd('poff');
    // Scheitert die Wahl (kein Träger), wartet updetach mit persist im Vordergrund weiter; Strg+C beendet pppd mit 5.
    // Gezielt ausgelöst, weil nach einem Untergang ein anderer KESTREL aufgegangen sein kann.
    await p.evaluate(() => { TERMINAL_ZUSTAND.wahlVorgabe = 'nocarrier'; });
    await cmd('pppd call kestrel updetach'); await gescheitert(p);
    assert.match(await out.textContent(), /chat\[\d+\]: NO CARRIER\nchat\[\d+\]:  -- failed\nchat\[\d+\]: Failed \(NO CARRIER\)\npppd\[\d+\]: Connect script failed$/);
    assert.equal(await p.evaluate(() => terminalBeschaeftigt()), true);
    await inp.press('Control+c'); await p.waitForFunction(() => !TERMINAL_ZUSTAND.kette);
    await cmd('echo $?'); assert.match(await out.textContent(), /\n5$/);
    assert.equal(await p.evaluate(() => TERMINAL_ZUSTAND.modem), null);
    await imUeberflug(p);
    await cmd('predict -t /var/cache/tle/kestrel.tle -p KESTREL-1');
    await cmd('pppd call kestrel updetach');
    await verbunden(p);
    await p.clock.fastForward(await p.evaluate(() => TERMINAL_ZUSTAND.satLink.bis - Date.now()));
    assert.match(await out.textContent(), /pppd\[\d+\]: Modem hangup \(NO CARRIER\)\npppd\[\d+\]: Connection terminated\.$/);
    await cmd('poff kestrel');
    assert.match(await out.textContent(), /root@terminal:\/# poff kestrel$/, 'persist: pppd läuft nach LOS weiter, poff beendet es still');
    await cmd('poff kestrel && tail -n 6 /var/log/syslog');
    assert.match(await out.textContent(), /poff: I could not find a pppd process for provider 'kestrel'\. None stopped\.$/);
    assert.deepEqual(netz.slice(vor), ['ls', 'send', 'send']);
    assert.deepEqual(errors, []);
    console.log('Terminal-Link-Kette: Überflug, PPP, WireGuard, Chat, /sendfile und LOS grün');
  } finally { await b.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
