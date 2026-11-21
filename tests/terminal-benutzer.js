/* Terminalbenutzer raizo statt root: Prompt wie bash unter Ubuntu (PS1 '\u@\h:\w\$', für Nicht-root '$'), whoami gibt den
   Namen aus. root bliebe für sudo unpassend: sudo fragt root nie nach einem Kennwort (sudo, plugins/sudoers/check.c,
   "Do not prompt for the root password"). Arbeitsverzeichnis und übrige Befehle bleiben unverändert. */
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
    const inp = p.locator('#profil-terminal-eingabe'), prompt = p.locator('#profil-terminal-prompt'), out = p.locator('#profil-terminal-ausgabe');
    const cmd = async z => { await inp.fill(z); await inp.press('Enter'); await p.waitForFunction(() => !TERMINAL_ZUSTAND.kette); };

    assert.equal(await prompt.textContent(), 'raizo@terminal:/$');
    await cmd('whoami');
    assert.match(await out.textContent(), /raizo@terminal:\/\$ whoami\nraizo$/);
    /* Arbeitsverzeichnis im Prompt: terminal-lokal (mit Brücke) */
    await cmd('tmux split-window -bd predict');
    assert.match(await out.textContent(), /\nno server running on \/tmp\/tmux-1000\/default$/, 'tmux-Socket mit der uid des Benutzers');
    assert.doesNotMatch(await out.textContent(), /root/);
    assert.deepEqual(errors, []);
    console.log('OK: Terminalbenutzer raizo (Prompt mit $, whoami)');
  } finally { await b.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
