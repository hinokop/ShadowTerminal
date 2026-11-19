/* Abbauzeilen von pppd/chat je Phase (main.c, chat.c) und LOS-Zähler nach poff:
   chat wählt: Signal an chat, Connect script failed, Exit. · ohne PPP-Link (CONNECT bis Connect:, holdoff, nach LOS): Terminating, Exit. ·
   ab Connect: ppp0: Terminating, Connection terminated., Exit. · SIGHUP (exit in tmux) je Phase · poff blendet den Zähler aus. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { APP } = require('./_pfad');
const { imUeberflug, bis, verbunden, gescheitert } = require('./_kestrel');

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
    await p.clock.install();
    // Feste Dauern: CONNECT 3 s nach ATDT, danach 10,9 s Aushandlung bis zur IP-Adresse.
    await p.evaluate(() => Object.assign(TERMINAL_PPP_DAUER, { connect: [3000, 3000], ppp: [800, 800], ip: [10000, 10000], nocarrier: [6000, 6000] }));
    const inp = p.locator('#profil-terminal-eingabe'), out = p.locator('#profil-terminal-ausgabe');
    const cmd = async z => { await inp.fill(z); await inp.press('Enter'); };
    const nach = async z => { await cmd(z); await p.waitForFunction(() => !TERMINAL_ZUSTAND.kette); };
    const marke = () => p.evaluate(() => { TERMINAL_ZUSTAND.syslog = TERMINAL_ZUSTAND.syslog.concat('--- marke'); });
    const seitMarke = () => p.evaluate(() => { const l = TERMINAL_ZUSTAND.syslog; return l.slice(l.lastIndexOf('--- marke') + 1).map(z => z.replace(/^\w+ +\d+ [\d:]+ terminal /, '').replace(/\[\d+\]/, '')); });
    const pid = () => p.evaluate(() => [TERMINAL_SITZUNG.pppd, TERMINAL_SITZUNG.chat]);
    const stand = () => p.evaluate(() => ({ modem: !!TERMINAL_ZUSTAND.modem, phase: TERMINAL_ZUSTAND.modem?.phase }));
    await imUeberflug(p, { wahl: 'ok' });
    await p.clock.pauseAt(await p.evaluate(() => Date.now() + 1000));

    /* poff, während chat wählt */
    await cmd('pon kestrel'); await p.clock.runFor(1000);
    assert.equal((await stand()).phase, 'chat');
    await marke(); await nach('poff');
    assert.deepEqual(await seitMarke(), ['chat: SIGTERM', 'pppd: Connect script failed', 'pppd: Exit.']);
    await p.clock.runFor(120000);
    assert.deepEqual(await seitMarke(), ['chat: SIGTERM', 'pppd: Connect script failed', 'pppd: Exit.'], 'danach keine Wahl mehr');

    /* poff in der holdoff-Phase: kein Link, kein "Connection terminated." */
    await p.evaluate(() => { TERMINAL_ZUSTAND.wahlVorgabe = 'nocarrier'; });
    await cmd('pon kestrel'); await gescheitert(p);
    await marke(); await nach('poff');
    assert.deepEqual(await seitMarke(), ['pppd: Terminating on signal 15', 'pppd: Exit.']);

    /* poff bei bestehender Verbindung; der LOS-Zähler verschwindet sofort, auch mit eingerichtetem wg-sat; PREDICT läuft weiter */
    await p.evaluate(() => { TERMINAL_ZUSTAND.wahlVorgabe = 'ok'; });
    await cmd('pon kestrel'); await verbunden(p);
    await cmd('wg-quick up wg-sat'); await p.clock.runFor(1000);
    await cmd('tmux'); await cmd('tmux split-window -bd predict'); await p.clock.runFor(500);
    const zaehler = p.locator('#profil-terminal-sat');
    assert.equal(await zaehler.isVisible(), true, 'Testaufbau: Zähler sichtbar');
    const sat = (await zaehler.textContent()).split(' ')[0];
    await marke(); await nach('poff');
    assert.deepEqual(await seitMarke(), ['pppd: Terminating on signal 15', 'pppd: Connection terminated.', 'pppd: Exit.']);
    assert.equal(await zaehler.isVisible(), false, 'Zähler nach poff sofort aus');
    assert.equal(await p.evaluate(() => !!TERMINAL_ZUSTAND.wgSat), true, 'wg-sat bleibt eingerichtet');
    await p.clock.runFor(1000);
    assert.equal(await zaehler.isVisible(), false);
    assert.match((await p.locator('.tmux-pane').textContent()).split('\n').find(z => z.startsWith(sat)), / LOS \d\d[A-Z][a-z]{2}\d\d /, 'PREDICT verfolgt den Überflug weiter');
    await cmd('wg-quick down wg-sat'); await cmd('exit');

    /* poff bei offenem Chat: Zähler im Fensterkopf und KESTREL-Block verschwinden, der Chatverlauf bleibt */
    await cmd('pon kestrel'); await verbunden(p);
    await cmd('wg-quick up wg-sat'); await p.clock.runFor(1000);
    await cmd('profanity'); await bis(p, () => TERMINAL_ZUSTAND.kanal?.phase === 'eingabe');
    const block = p.locator('#profil-terminal-orbit'), verlauf = p.locator('#profil-terminal-chat');
    assert.deepEqual([await zaehler.isVisible(), await block.isVisible()], [true, true], 'Testaufbau: beide sichtbar');
    await p.evaluate(() => terminalPppShell('poff', '', []));
    await p.clock.runFor(1000);
    assert.deepEqual([await zaehler.isVisible(), await block.isVisible()], [false, false], 'nach poff beide aus');
    assert.equal(await verlauf.isVisible(), true);
    assert.match(await verlauf.textContent(), /logged in successfully[\s\S]*pppd: Terminating on signal 15[\s\S]*Disconnected from/);
    await p.clock.runFor(5000);
    assert.equal(await block.isVisible(), false, 'bleibt aus');
    await cmd('/quit'); await cmd('wg-quick down wg-sat');

    /* poff nach CONNECT, bevor das PPP-Interface steht: kein Link-Abbau */
    await cmd('pon kestrel'); await p.clock.runFor(150 + 550 + 3000 + 50);
    assert.equal((await stand()).phase, 'seriell');
    await marke(); await nach('poff');
    assert.deepEqual(await seitMarke(), ['pppd: Terminating on signal 15', 'pppd: Exit.']);
    /* poff in der Sekunde nach LOS, vor der Neuwahl: der Link ist schon abgebaut, keine zweite Abbauzeile */
    await cmd('pon kestrel'); await verbunden(p);
    await p.evaluate(() => { TERMINAL_ZUSTAND.wahlVorgabe = 'nocarrier'; TERMINAL_ZUSTAND.satLink.bis = Date.now() + 300; });
    await marke(); await p.clock.runFor(500);
    assert.deepEqual(await seitMarke(), ['pppd: Modem hangup (NO CARRIER)', 'pppd: Connection terminated.']);
    await nach('poff');
    assert.deepEqual(await seitMarke(), ['pppd: Modem hangup (NO CARRIER)', 'pppd: Connection terminated.', 'pppd: Terminating on signal 15', 'pppd: Exit.']);
    await p.evaluate(() => { TERMINAL_ZUSTAND.wahlVorgabe = 'ok'; });

    /* Strg+C im Vordergrund, während chat wählt: SIGINT, Connect-Skript scheitert, $? 8 (EXIT_CONNECT_FAILED, tty.c) */
    await cmd('pppd call kestrel updetach'); await p.clock.runFor(1000);
    await marke(); await inp.press('Control+c'); await p.waitForFunction(() => !TERMINAL_ZUSTAND.kette);
    assert.deepEqual(await seitMarke(), ['chat: SIGINT', 'pppd: Connect script failed', 'pppd: Exit.']);
    assert.match(await out.textContent(), /chat\[\d+\]: SIGINT\npppd\[\d+\]: Connect script failed\npppd\[\d+\]: Exit\.$/);
    await nach('echo $?'); assert.match(await out.textContent(), /\n8$/);

    /* exit in tmux nach CONNECT (Aushandlung): kein "Connect script failed", Link-Abbau, Neuwahl nach holdoff */
    await cmd('tmux');
    await cmd('pppd call kestrel updetach'); await p.clock.runFor(150 + 550 + 3000 + 100 + 800 + 500);
    assert.equal((await stand()).phase, 'ppp', 'Testaufbau: nach CONNECT, vor der IP-Adresse');
    await marke(); await cmd('exit');
    assert.deepEqual(await seitMarke(), ['pppd: Hangup (SIGHUP)', 'pppd: Connection terminated.']);
    assert.equal(await p.evaluate(() => terminalBeschaeftigt()), false, 'Shell frei');
    await p.clock.runFor(19000);
    assert.equal((await seitMarke()).length, 2, 'holdoff: noch keine neue Wahl');
    await p.clock.runFor(1500);
    assert.equal((await seitMarke())[2], 'chat: abort on (BUSY)', 'nach holdoff neue Wahl');
    await nach('poff');

    /* exit in tmux, während chat wählt: Signal an chat, Connect script failed, Hangup; holdoff endet sofort */
    await cmd('tmux');
    await cmd('pppd call kestrel updetach'); await p.clock.runFor(1000);
    await marke(); await cmd('exit');
    const sighup = await seitMarke();
    assert.deepEqual(sighup.slice(0, 4), ['chat: SIGHUP', 'pppd: Connect script failed', 'pppd: Hangup (SIGHUP)', 'chat: abort on (BUSY)']);
    await nach('poff');
    assert.deepEqual(errors, []);
    console.log('OK: Abbauzeilen je Phase und LOS-Zähler nach poff');
  } finally { await b.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
