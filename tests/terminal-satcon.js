const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { APP } = require('./_pfad');
const { SAT, vorbereiten } = require('./_satcon');
(async () => {
  const b = await chromium.launch();
  try {
    const p = await b.newPage({reducedMotion:'reduce'});
    const netz = [], fehler = [];
    p.on('pageerror', e => fehler.push(e.message));
    await p.route(/^https?:/, r => { netz.push(r.request().url()); return r.abort(); });
    await p.goto(APP);
    await p.fill('#gate-pw', 'pw-test-123'); if (await p.isVisible('#gate-pw2')) await p.fill('#gate-pw2','pw-test-123');
    await p.click('#gate-go'); await p.click('#profil-terminal-oeffnen');
    const input = p.locator('#profil-terminal-eingabe'), prompt = p.locator('#profil-terminal-prompt'), out = p.locator('#profil-terminal-ausgabe');
    const kanal = 'secure-channel --connect --onion --ephemeral';
    const cmd = async z => { await input.fill(z); await input.press('Enter'); };
    const abgewiesen = async () => {
      await cmd(kanal); assert.match(await out.textContent(), /\[!\] keine sichere Verbindung hergestellt$/);
      assert.notEqual(await prompt.textContent(), 'you >');
    };
    const start = await prompt.textContent(), vorher = netz.length;
    await abgewiesen();
    await cmd('satcon live'); await abgewiesen();
    await p.emulateMedia({reducedMotion:'no-preference'});
    await cmd(SAT); assert.equal(await prompt.textContent(), start);
    await input.press('Escape');
    await p.waitForFunction(() => !TERMINAL_ZUSTAND.satAufbau);
    await abgewiesen();
    await p.emulateMedia({reducedMotion:'reduce'});
    await input.fill('sat'); await input.press('Tab'); assert.equal(await input.inputValue(), 'satcon ');
    let erwartet = 'satcon ';
    for (const wort of SAT.split(' ').slice(1)) {
      await input.press('Tab'); erwartet += wort + ' '; assert.equal(await input.inputValue(), erwartet);
    }
    await input.press('Enter');
    await p.waitForFunction(() => !!TERMINAL_ZUSTAND.satBereit);
    assert.equal(await prompt.textContent(), start);
    const aus = await out.textContent();
    assert.match(aus, /NOAA-19 \(APT\) · 137\.100 MHz[\s\S]*Secure connection ready\.$/);
    assert.equal(new Set([...aus.matchAll(/frequency lock \(([\d.]+) MHz\)/g)].map(m => m[1])).size, 3);
    const ident = aus.match(/Connected to: .*\nContact: .*\nChannel: .*/)[0];
    await cmd(kanal);
    await p.waitForFunction(() => $('profil-terminal-prompt').textContent === 'you >');
    assert.equal((await out.textContent()).split(ident).length, 3);
    await cmd('/close'); await abgewiesen();
    await vorbereiten(p);
    await cmd('exit');
    await p.click('#profil-terminal-oeffnen'); await abgewiesen();
    await vorbereiten(p);
    await p.evaluate(() => document.body.classList.add('locked'));
    await p.waitForFunction(() => !TERMINAL_ZUSTAND.satBereit);
    assert.equal(netz.length, vorher); assert.deepEqual(fehler, []);
    console.log('OK: satcon, schrittweises Tab, Identität, Abbruch, Sperre und lokaler Ablauf');
  } finally { await b.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
