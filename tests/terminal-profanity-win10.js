/* profanity, zehntes Fenster (Profanity 0.18.2): _wins_get_next_available_num vergibt nach 9 die Nummer 0, danach 11;
   die Statuszeile zeigt sie als 10 (true_win), der Konsolenhinweis als (win 0); /win 0 öffnet das Fenster,
   /win 10 meldet "Window 10 does not exist.", /win 11 öffnet das elfte. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { APP } = require('./_pfad');
const { chatBereit, schnelleWahl } = require('./_kestrel');

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
    await schnelleWahl(p);
    await chatBereit(p, { kontakt: false });
    await p.clock.pauseAt(await p.evaluate(() => Date.now() + 1000));
    const inp = p.locator('#profil-terminal-eingabe'), verlauf = p.locator('#profil-terminal-chat');
    const titel = p.locator('#profil-terminal-xmpp-titel'), status = p.locator('#profil-terminal-xmpp-status');
    const cmd = async z => { await inp.fill(z); await inp.press('Enter'); };
    const fenster = () => status.locator('.xmpp-fenster').evaluateAll(l => l.map(e => e.textContent + (e.classList.contains('neu') ? '*' : '')));
    const domain = await p.evaluate(() => TERMINAL_XMPP_DOMAIN);
    const k = n => 'k' + n + '@' + domain;

    // Fenster 2 bis 11 (zehn Gespräche): das zehnte Fenster ist intern 0
    for (let n = 2; n <= 11; n++) await cmd('/msg ' + k(n));
    assert.equal(await titel.textContent(), k(11) + '[online]');
    assert.deepEqual(await fenster(), ['[1]', '[2]', '[3]', '[4]', '[5]', '[6]', '[7]', '[8]', '[9]', '[10]', '-11-']);

    // Antwort im zehnten Fenster, während das elfte aktiv ist: Konsolenhinweis (win 0), Statuszeile [10] markiert
    await cmd('/win 0');
    assert.equal(await titel.textContent(), k(10) + '[online]');
    assert.deepEqual((await fenster()).slice(-2), ['-10-', '[11]']);
    await cmd('Auftrag erledigt.');
    await cmd('/win 11');
    assert.equal(await titel.textContent(), k(11) + '[online]');
    await p.clock.runFor(7500);
    assert.deepEqual(await fenster(), ['[1]*', '[2]', '[3]', '[4]', '[5]', '[6]', '[7]', '[8]', '[9]', '[10]*', '-11-']);

    // /win 10 gibt es nicht; die Meldung steht in der Konsole, das aktive Fenster bleibt
    await cmd('/win 10');
    assert.equal(await titel.textContent(), k(11) + '[online]');
    await cmd('/win 1');
    assert.match(await verlauf.textContent(), new RegExp('<< chat message: ' + k(10).replace(/\./g, '\\.') + ' \\(win 0\\)\\n\\d\\d:\\d\\d:\\d\\d - Window 10 does not exist\\.$'));
    assert.deepEqual(errors, []);
    console.log('OK: profanity, zehntes Fenster (/win 0, (win 0), Statuszeile 10, /win 10 fehlt)');
  } finally { await b.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
