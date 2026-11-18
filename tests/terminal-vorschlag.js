/* Grauer Vorschlag aus dem Verlauf (zsh-autosuggestions): Anzeige, Übernahme mit → und Ende, keine Anzeige im Chat,
   beim Blättern, bei offener Auswahlliste oder mit Cursor mitten im Text. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { APP } = require('./_pfad');
const { chatBereit } = require('./_kestrel');

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
    const rest = async () => (await geist.isVisible()) ? geist.locator('.rest').textContent() : null;

    await cmd('echo eins'); await cmd('predict -t /var/cache/tle/kestrel.tle -p KESTREL-2'); await cmd('echo zwei');
    /* Anzeige: jüngster passender Eintrag */
    await tippen('ec'); assert.equal(await rest(), 'ho zwei');
    await tippen('echo e'); assert.equal(await rest(), 'ins');
    await tippen('pre'); assert.equal(await rest(), 'dict -t /var/cache/tle/kestrel.tle -p KESTREL-2');
    assert.equal(await geist.locator('.text').textContent(), 'pre', 'Text deckungsgleich hinter dem Eingabefeld');
    /* → übernimmt; Ende übernimmt */
    await p.keyboard.press('ArrowRight'); assert.equal(await inp.inputValue(), 'predict -t /var/cache/tle/kestrel.tle -p KESTREL-2');
    assert.equal(await rest(), null, 'vollständig: kein Rest');
    await tippen('echo z'); await p.keyboard.press('End'); assert.equal(await inp.inputValue(), 'echo zwei');
    /* kein Vorschlag: leer, kein Treffer, Cursor mitten im Text */
    await tippen(''); assert.equal(await rest(), null);
    await tippen('xyz'); assert.equal(await rest(), null);
    await tippen('ec'); await p.keyboard.press('ArrowLeft');
    assert.equal(await rest(), null); assert.equal(await inp.inputValue(), 'ec', '← bewegt nur den Cursor');
    await p.keyboard.press('ArrowRight'); await p.keyboard.press('ArrowRight');
    assert.equal(await inp.inputValue(), 'echo zwei', 'am Zeilenende übernimmt → wieder');
    /* Jüngster Treffer entscheidet: nach "echo eins && echo zwei" und später "echo eins" kein Vorschlag bei "echo eins" */
    await cmd('echo eins && echo zwei'); await cmd('echo eins');
    await tippen('echo eins'); assert.equal(await rest(), null);
    await p.keyboard.press('End'); assert.equal(await inp.inputValue(), 'echo eins', 'Ende erweitert einen vollständig getippten Befehl nicht');
    await tippen('echo ein'); assert.equal(await rest(), 's');
    /* Vordergrund-predict: kein Vorschlag, keine Übernahme */
    await inp.fill('predict'); await inp.press('Enter');
    await tippen('ec'); assert.equal(await rest(), null);
    await p.keyboard.press('End'); assert.equal(await inp.inputValue(), 'ec');
    await inp.press('Control+c'); await inp.fill('');
    /* Während einer IME-Komposition übernehmen → und Ende nicht */
    await tippen('ec'); assert.equal(await rest(), 'ho eins');
    await inp.evaluate(e => e.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', isComposing: true, bubbles: true, cancelable: true })));
    assert.equal(await inp.inputValue(), 'ec');
    /* Blättern im Verlauf: kein Vorschlag */
    await inp.fill(''); await inp.press('ArrowUp'); assert.equal(await rest(), null);
    await inp.press('Escape');
    /* Auswahlliste offen: kein Vorschlag */
    await tippen('w'); await inp.press('Tab'); await p.locator('#profil-terminal-auswahl').waitFor({ state: 'visible' });
    assert.equal(await rest(), null); await inp.press('Escape');
    /* Chat: kein Vorschlag */
    await chatBereit(p, { kontakt: false });
    await tippen('ec'); assert.equal(await rest(), null);
    await inp.fill('/quit'); await inp.press('Enter');
    /* Sperre leert den Verlauf: kein Vorschlag mehr */
    await p.evaluate(() => document.body.classList.add('locked'));
    await p.waitForFunction(() => TERMINAL_ZUSTAND.verlauf.length === 0);
    assert.deepEqual(errors, []);
    console.log('OK: grauer Vorschlag aus dem Verlauf');
  } finally { await b.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
