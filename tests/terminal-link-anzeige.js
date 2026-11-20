/* Statusanzeige im Fensterkopf (Shadow Terminal, keine Ausgabe eines echten Werkzeugs): DIALING während eines Wählversuchs,
   gleich ob er gelingt; PPP SETUP zwischen CONNECT und der IP-Adresse (IPCP); erst mit stehender PPP-Verbindung grün
   "<Satellit> · EST. LINK END hh:mm:ss". In holdoff/vor einer Neuwahl leer; nach poff kein Countdown mehr. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { APP } = require('./_pfad');
const { imUeberflug, bis, schnelleWahl } = require('./_kestrel');

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
    await p.clock.install(); await imUeberflug(p); await schnelleWahl(p);
    await p.clock.pauseAt(await p.evaluate(() => Date.now() + 1000));
    const inp = p.locator('#profil-terminal-eingabe'), kopf = p.locator('#profil-terminal-sat');
    const cmd = async z => { await inp.fill(z); await inp.press('Enter'); };
    const stand = async () => [await kopf.isVisible(), await kopf.textContent(), await kopf.evaluate(e => e.classList.contains('aktiv'))];
    const plog = () => p.evaluate(() => TERMINAL_ZUSTAND.syslog.join('\n'));

    /* BUSY: DIALING während des Versuchs, nie ein Countdown; in holdoff leer */
    await p.evaluate(() => { TERMINAL_ZUSTAND.wahlVorgabe = 'busy'; });
    await cmd('pon kestrel');
    assert.deepEqual(await stand(), [true, 'DIALING', false]);
    await p.clock.runFor(1000);
    assert.deepEqual(await stand(), [true, 'DIALING', false]);
    await bis(p, () => !!TERMINAL_ZUSTAND.modem?.holdoff);
    assert.match(await plog(), /Failed \(BUSY\)/);
    assert.deepEqual((await stand()).slice(0, 2), [false, ''], 'holdoff: Kopf leer');

    /* Neuwahl mit Erfolg: DIALING, ab CONNECT 19200 PPP SETUP, erst mit der IP-Adresse grün EST. LINK END */
    await p.evaluate(() => { TERMINAL_ZUSTAND.wahlVorgabe = 'ok'; });
    await bis(p, () => TERMINAL_ZUSTAND.modem?.phase === 'chat');
    assert.deepEqual(await stand(), [true, 'DIALING', false]);
    await bis(p, () => TERMINAL_ZUSTAND.modem?.phase === 'seriell');
    assert.match(await plog(), /CONNECT 19200\n.*-- got it$/);
    assert.deepEqual(await stand(), [true, 'PPP SETUP', false], 'bei CONNECT 19200 noch kein Countdown');
    await bis(p, () => TERMINAL_ZUSTAND.modem?.phase === 'ppp');
    assert.deepEqual(await stand(), [true, 'PPP SETUP', false], 'Connect: ppp0, aber noch keine IP-Adresse');
    await bis(p, () => TERMINAL_ZUSTAND.modem?.phase === 'up');
    assert.match(await plog(), /remote IP address \S+$/);
    const [sichtbar, text, gruen] = await stand();
    assert.deepEqual([sichtbar, gruen], [true, true]);
    assert.match(text, /^KESTREL-\d · EST\. (LINK END|LOS) \d\d:\d\d:\d\d$/);

    /* poff: kein Countdown mehr */
    await cmd('poff kestrel');
    await p.clock.runFor(500);
    assert.deepEqual((await stand()).slice(0, 2), [false, '']);
    assert.deepEqual(errors, []);
    console.log('OK: Statusanzeige im Fensterkopf (DIALING, PPP SETUP, EST. LINK END, BUSY ohne Countdown, poff)');
  } finally { await b.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
