const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { APP } = require('./_pfad');

const TX = 'satcon-tx --target IRIDIUM-142 --device limesdr --iface sat0 --tle /var/cache/tle/leo.txt';
const KANAL = 'secure-channel --connect --iface sat0 --route mixnet --ephemeral';
const SEND = 'send /pgcl-eu3.arch07/dossiers/beleg.txt';
(async () => {
  const b = await chromium.launch();
  try {
    const p = await b.newPage({ reducedMotion: 'reduce' });
    p.setDefaultTimeout(12000);
    const errors = [], netz = [];
    let bytes = 4500;
    p.on('pageerror', e => errors.push(e.message));
    await p.route(/^https?:/, async r => {
      const req = r.request();
      if (!req.url().startsWith('http://127.0.0.1:45678/db')) { netz.push(req.url()); await r.abort(); return; }
      const d = req.postDataJSON();
      netz.push(d.op);
      assert.ok(['cd', 'send', 'ls'].includes(d.op));
      const exports = ['lageblatt-PIN-001.txt', 'lageblatt-PIN-014.txt', 'lageblatt-PIN-017 final.txt'];
      await r.fulfill({ json: d.op === 'ls' ? { entries: exports.map(name => ({ name, dir: false })) } :
        d.op === 'cd' ? { ok: true } : { name: 'beleg.txt', bytes } });
    });
    await p.goto(APP + '#db=45678.' + 'a'.repeat(43));
    await p.fill('#gate-pw', 'pw-satcon-tx-123');
    if (await p.isVisible('#gate-pw2')) await p.fill('#gate-pw2', 'pw-satcon-tx-123');
    await p.click('#gate-go');
    await p.click('#profil-terminal-oeffnen');
    const input = p.locator('#profil-terminal-eingabe'), out = p.locator('#profil-terminal-ausgabe');
    const prompt = p.locator('#profil-terminal-prompt'), badge = p.locator('#profil-terminal-sat');
    const progress = p.locator('#profil-terminal-transfer'), min = p.locator('#profil-terminal-minimieren');
    const cmd = async z => { await input.fill(z); await input.press('Enter'); };
    await cmd('cd /var/cache/tle'); assert.equal(await prompt.textContent(), 'root@terminal:/var/cache/tle#');
    await cmd('cat leo.txt'); assert.match(await out.textContent(), /Profile: demo LEO pass/);
    await cmd('cd /pgcl-eu3.arch07/'); await p.waitForFunction(() => !TERMINAL_ZUSTAND.dateiLaeuft);
    const cwd = await prompt.textContent();
    assert.equal(cwd, 'root@terminal:/pgcl-eu3.arch07#');
    await p.emulateMedia({ reducedMotion: 'no-preference' });
    await p.clock.install();
    await p.clock.pauseAt(new Date(Date.now() + 1000));
    const vorher = netz.length;
    await cmd('satcon live'); assert.match(await out.textContent(), /satcon: command not found$/);
    await cmd('secure-channel --connect --onion --ephemeral');
    assert.match(await out.textContent(), /usage: secure-channel --connect --iface sat0/);
    await cmd(KANAL); assert.match(await out.textContent(), /sat0: Link is down/);
    await input.fill('sat'); await input.press('Tab');
    assert.equal(await input.inputValue(), 'satcon-tx ');
    for (const wort of TX.split(' ').slice(1)) {
      await input.press('Tab');
      assert.ok((await input.inputValue()).endsWith(wort + ' '));
    }
    assert.equal((await input.inputValue()).trim(), TX);
    await input.press('Enter');
    await p.clock.runFor(10699); assert.equal(await badge.isVisible(), false);
    await p.clock.runFor(1); assert.equal(await badge.isVisible(), true);
    const rest = await p.evaluate(() => TERMINAL_ZUSTAND.satLink.bis - Date.now());
    assert.ok(rest >= 300000 && rest <= 900000);
    const startBadge = await badge.textContent();
    await min.click(); assert.equal(await input.isVisible(), false);
    await p.clock.runFor(2000);
    assert.notEqual(await badge.textContent(), startBadge);
    await min.click();
    await input.fill('secure-channel ');
    let zug = 'secure-channel ';
    for (const wort of KANAL.split(' ').slice(1)) {
      await input.press('Tab'); zug += wort + ' '; assert.equal(await input.inputValue(), zug);
    }
    assert.equal(zug.trim(), KANAL);
    await input.press('Enter');
    await p.clock.runFor(5799); assert.equal(await prompt.textContent(), '…');
    await p.clock.runFor(1); assert.equal(await prompt.textContent(), 'you >');
    assert.equal(netz.length, vorher);
    const basis = 'send /pgcl-eu3.arch07/ops/lageblatt-PIN-0';
    const logVorTab = await out.textContent();
    await input.fill(basis); await input.press('Tab');
    for (let i = 0; i < 100 && !(await input.inputValue()).endsWith('001.txt'); i++)
      await new Promise(resolve => setTimeout(resolve, 10));
    assert.equal(await input.inputValue(), basis + '01.txt');
    await input.press('Tab'); assert.equal(await input.inputValue(), basis + '14.txt');
    await input.press('Tab'); assert.equal(await input.inputValue(), 'send "/pgcl-eu3.arch07/ops/lageblatt-PIN-017 final.txt"');
    await input.press('Shift+Tab'); assert.equal(await input.inputValue(), basis + '14.txt');
    assert.equal(await out.textContent(), logVorTab);
    assert.deepEqual(netz.slice(vorher), ['ls']);
    await cmd(SEND); await progress.waitFor({ state: 'visible' });
    assert.match(await out.textContent(), /Encrypting 9 chunks for sat0/);
    await p.clock.runFor(14000); assert.doesNotMatch(await out.textContent(), /ACK received/);
    await p.clock.runFor(2000); assert.match(await out.textContent(), /ACK received/);
    assert.equal(await prompt.textContent(), 'you >');
    const rest2 = await p.evaluate(() => TERMINAL_ZUSTAND.satLink.bis - Date.now());
    await p.clock.fastForward(rest2 - 8000);
    bytes = 20_000_000;
    await cmd(SEND); await progress.waitFor({ state: 'visible' });
    assert.doesNotMatch(await out.textContent(), /Accelerated transfer simulation/);
    await min.click();
    await p.clock.runFor(8000);
    assert.equal(await badge.isVisible(), false);
    await min.click();
    assert.equal(await progress.isVisible(), false);
    assert.equal(await prompt.textContent(), cwd);
    await p.clock.fastForward(65000);
    const los = await out.textContent();
    assert.match(los, /Loss of signal · sat0 down\.\nsend: transfer interrupted/);
    assert.doesNotMatch(los, /Sending CLOSE|ACK received/);
    await cmd(KANAL); assert.match(await out.textContent(), /sat0: Link is down$/);
    await cmd(TX); await p.clock.runFor(10700);
    await cmd(KANAL); await p.clock.runFor(5800);
    await cmd('Auftrag erledigt.'); await p.clock.runFor(18300);
    assert.match(await out.textContent(), /> Verstanden\.\n─+\n\[\*\] Sending CLOSE frame\.\.\.\n\[\*\] Wiping key material\.\.\. done\.\n\[\*\] Detaching sat0 \(RF carrier OFF\)\.\.\. done\.\nConnection terminated\.$/);
    assert.equal(await prompt.textContent(), cwd);
    assert.equal(await badge.isVisible(), false);
    await cmd(KANAL); assert.match(await out.textContent(), /sat0: Link is down$/);
    assert.deepEqual(netz.slice(vorher), ['ls', 'send', 'send']);
    assert.deepEqual(errors, []);
    console.log('Satcon-TX: Aufbauzeiten, TLE, Countdown, SEND, LOS und Abbau grün');
  } finally { await b.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
