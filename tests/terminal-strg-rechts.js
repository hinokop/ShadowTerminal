/* Strg+→ wie Oh My Zsh mit zsh-autosuggestions: Strg+→ ist forward-word (lib/key-bindings.zsh, ^[[1;5C), WORDCHARS=''
   (lib/completion.zsh: nur Buchstaben und Ziffern bilden ein Wort); forward-word überspringt Wortzeichen, dann
   Nicht-Wortzeichen (zle_word.c) und landet am Anfang des nächsten Wortes; zsh-autosuggestions übernimmt den Vorschlag
   bis dorthin (_zsh_autosuggest_partial_accept). Ohne Vorschlag bewegt Strg+→ nur den Cursor. */
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
    const inp = p.locator('#profil-terminal-eingabe'), geist = p.locator('#profil-terminal-vorschlag');
    const cmd = async z => { await inp.fill(z); await inp.press('Enter'); await p.waitForFunction(() => !TERMINAL_ZUSTAND.kette); };
    const tippen = async z => { await inp.fill(''); await inp.focus(); await p.keyboard.type(z); };
    const rest = async () => (await geist.locator('.rest').count()) ? geist.locator('.rest').textContent() : null;
    const strg = () => p.keyboard.press('Control+ArrowRight');

    await cmd('echo alpha-beta /var/log/syslog.1');
    /* Mit Vorschlag: Wort für Wort übernehmen, der Rest bleibt grau */
    await tippen('ec');
    assert.equal(await rest(), 'ho alpha-beta /var/log/syslog.1');
    const schritte = ['echo ', 'echo alpha-', 'echo alpha-beta /', 'echo alpha-beta /var/', 'echo alpha-beta /var/log/',
      'echo alpha-beta /var/log/syslog.', 'echo alpha-beta /var/log/syslog.1'];
    for (const erwartet of schritte) {
      await strg();
      assert.equal(await inp.inputValue(), erwartet);
      const r = await rest();
      assert.equal(r, erwartet === schritte.at(-1) ? null : 'echo alpha-beta /var/log/syslog.1'.slice(erwartet.length));
      assert.equal(await inp.evaluate(e => e.selectionStart === e.value.length), true, 'Cursor am Ende');
    }
    await strg();
    assert.equal(await inp.inputValue(), 'echo alpha-beta /var/log/syslog.1', 'am Ende nichts mehr');

    /* Ohne Vorschlag (Cursor mitten im Text): nur Cursorbewegung, Text unverändert */
    await tippen('eins zwei-drei');
    await inp.evaluate(e => e.setSelectionRange(0, 0));
    const pos = [];
    for (let i = 0; i < 4; i++) { await strg(); pos.push(await inp.evaluate(e => e.selectionStart)); }
    assert.deepEqual(pos, [5, 10, 14, 14]);
    assert.equal(await inp.inputValue(), 'eins zwei-drei');
    assert.deepEqual(errors, []);
    console.log('OK: Strg+→ (forward-word, Teilübernahme des Vorschlags)');
  } finally { await b.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
