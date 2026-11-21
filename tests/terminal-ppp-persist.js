/* Einwahl mit persist, holdoff 20, maxfail 0 (pppd(8)): gescheiterte Wahl -> holdoff -> neue Wahl mit neuem chat-Prozess;
   updetach bleibt bis zur Verbindung im Vordergrund; LOS -> Hangup und sofortige Neuwahl im Hintergrund; Ende nur durch Signal. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { APP } = require('./_pfad');
const { imUeberflug, schnelleWahl } = require('./_kestrel');

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
    await p.clock.install();
    // Uhr anhalten: nur runFor bewegt die Zeit, damit holdoff unter Last genau prüfbar bleibt.
    await p.clock.pauseAt(await p.evaluate(() => Date.now() + 1000));
    const inp = p.locator('#profil-terminal-eingabe'), out = p.locator('#profil-terminal-ausgabe');
    const cmd = async z => { await inp.fill(z); await inp.press('Enter'); };
    const nach = async z => { await cmd(z); await p.waitForFunction(() => !TERMINAL_ZUSTAND.kette); const t = await out.textContent(); return t.slice(t.lastIndexOf('$ ' + z) + z.length + 2).split('\n').filter(Boolean); };
    const status = async () => (await nach('echo $?'))[0];
    const log = () => p.evaluate(() => TERMINAL_ZUSTAND.syslog.join('\n'));
    const anzahl = async (muster) => ((await log()).match(muster) || []).length;
    const chatPids = async () => [...new Set([...(await log()).matchAll(/chat\[(\d+)\]/g)].map(m => m[1]))];

    /* Peer-Datei */
    const peer = await nach('cat /etc/ppp/peers/kestrel');
    for (const z of ['persist', 'holdoff 20', 'maxfail 0']) assert.ok(peer.includes(z), z + ' in /etc/ppp/peers/kestrel');

    /* Hintergrund: Wahl scheitert, pppd bleibt, nach holdoff neue Wahl mit neuer chat-PID */
    await p.evaluate(() => { TERMINAL_ZUSTAND.wahlVorgabe = 'nocarrier'; });
    await cmd('pon kestrel'); await p.clock.runFor(7000);
    assert.equal(await anzahl(/Connect script failed/g), 1);
    assert.equal(await p.evaluate(() => !!TERMINAL_ZUSTAND.modem && !TERMINAL_ZUSTAND.modem.bereit), true, 'pppd läuft weiter');
    await p.clock.runFor(19000);
    assert.equal(await anzahl(/abort on \(BUSY\)/g), 1, 'während holdoff keine neue Wahl');
    await p.clock.runFor(1500);
    assert.equal(await anzahl(/abort on \(BUSY\)/g), 2, 'nach holdoff neue Wahl');
    assert.equal((await chatPids()).length, 2, 'neuer chat-Prozess je Versuch');
    await p.clock.runFor(7000);
    assert.equal(await anzahl(/Connect script failed/g), 2);
    assert.deepEqual(await nach('pon kestrel'), ['pppd: kestrel already running']);
    await nach('poff');
    assert.equal(await p.evaluate(() => TERMINAL_ZUSTAND.modem), null, 'poff beendet pppd auch während holdoff');
    await p.clock.runFor(30000);
    assert.equal(await anzahl(/abort on \(BUSY\)/g), 2, 'nach poff keine Wahl mehr');

    /* Vordergrund mit updetach: Fehlversuche sichtbar, Shell belegt, nach Verbindung läuft die Kette weiter */
    await imUeberflug(p, { wahl: 'busy' });
    await cmd('pppd call kestrel updetach && echo verbunden');
    await p.clock.runFor(3000);
    assert.match(await out.textContent(), /chat\[\d+\]: BUSY\nchat\[\d+\]:  -- failed\nchat\[\d+\]: Failed \(BUSY\)\npppd\[\d+\]: Connect script failed$/);
    assert.equal(await p.evaluate(() => terminalBeschaeftigt()), true, 'updetach wartet weiter');
    await p.evaluate(() => { TERMINAL_ZUSTAND.wahlVorgabe = 'ok'; });
    await p.clock.runFor(20000 + 7600);
    await p.waitForFunction(() => !TERMINAL_ZUSTAND.kette);
    assert.match(await out.textContent(), /remote IP address [\d.]+\nverbunden$/);
    assert.equal(await status(), '0');

    /* LOS: Hangup, pppd bleibt, wählt sofort im Hintergrund neu; die Shell bleibt frei */
    await p.evaluate(() => { TERMINAL_ZUSTAND.wahlVorgabe = 'nocarrier'; TERMINAL_ZUSTAND.satLink.bis = Date.now() + 500; });
    await p.clock.runFor(1000);
    assert.match(await out.textContent(), /pppd\[\d+\]: Modem hangup \(NO CARRIER\)\npppd\[\d+\]: Connection terminated\.$/);
    assert.equal(await p.evaluate(() => ({ m: !!TERMINAL_ZUSTAND.modem, b: TERMINAL_ZUSTAND.modem?.bereit, f: terminalBeschaeftigt() })).then(x => x.m && !x.b && !x.f), true);
    await p.clock.runFor(1500);
    assert.match((await log()).split('Connection terminated.').at(-1), /chat\[\d+\]: abort on \(BUSY\)/, 'Neuwahl ohne holdoff');
    assert.doesNotMatch(await out.textContent(), /Modem hangup[^]*abort on \(BUSY\)/, 'Hintergrundwahl schreibt nicht in die Shell');
    assert.deepEqual(await nach('echo frei'), ['frei']);
    await nach('poff');

    /* exit in tmux während updetach wartet (holdoff): SIGHUP, pppd wählt sofort im Hintergrund neu, die Shell ist frei */
    const nachExit = async () => (await out.textContent()).split('[exited]').at(-1);
    await cmd('tmux'); await p.waitForFunction(() => TERMINAL_ZUSTAND.tmux && !TERMINAL_ZUSTAND.kette);
    await cmd('pppd call kestrel updetach; echo danach'); await p.clock.runFor(7000);
    assert.equal(await p.evaluate(() => !!TERMINAL_ZUSTAND.modem && !TERMINAL_ZUSTAND.modem.bereit && terminalBeschaeftigt()), true, 'Testaufbau: holdoff im Vordergrund');
    await cmd('exit');
    assert.equal(await p.evaluate(() => !TERMINAL_ZUSTAND.tmux && !TERMINAL_ZUSTAND.kette && !terminalBeschaeftigt()), true, 'Shell frei');
    let rest = (await log()).split(/pppd\[\d+\]: Hangup \(SIGHUP\)/);
    assert.equal(rest.length, 2, 'Hangup (SIGHUP) im Syslog');
    assert.match(rest[1], /chat\[\d+\]: abort on \(BUSY\)/, 'holdoff endet sofort, neue Wahl');
    await p.clock.runFor(8000);
    assert.equal(await nachExit(), '', 'keine Ausgabe in der Shell, kein "danach"');
    assert.equal(await p.evaluate(() => !!TERMINAL_ZUSTAND.modem && !TERMINAL_ZUSTAND.modem.vordergrund), true, 'pppd läuft im Hintergrund');
    assert.deepEqual(await nach('echo frei'), ['frei']);
    await nach('poff');

    /* exit in tmux während chat wählt: das Signal geht an chat, das Connect-Skript scheitert, der Hangup beendet holdoff sofort
       (genauer in terminal-ppp-abbruch) */
    await cmd('tmux'); await p.waitForFunction(() => TERMINAL_ZUSTAND.tmux && !TERMINAL_ZUSTAND.kette);
    await cmd('pppd call kestrel updetach'); await p.clock.runFor(300);
    await cmd('exit');
    rest = (await log()).split(/pppd\[\d+\]: Hangup \(SIGHUP\)/);
    assert.match(rest.at(-2), /chat\[\d+\]: SIGHUP\n.* pppd\[\d+\]: Connect script failed\n.*$/, 'SIGHUP beendet den Versuch');
    assert.match(rest.at(-1), /^\n.* chat\[\d+\]: abort on \(BUSY\)/, 'holdoff endet sofort, neue Wahl');
    assert.equal(await nachExit(), '');
    await nach('poff');

    /* exit in tmux während wg-quick up: bash endet, die EXIT-Falle entfernt wg-sat; keine Ausgabe danach */
    await imUeberflug(p, { wahl: 'ok' });
    await cmd('pppd call kestrel updetach'); await p.clock.runFor(7600);
    await p.waitForFunction(() => TERMINAL_ZUSTAND.modem?.bereit && !TERMINAL_ZUSTAND.kette);
    await cmd('tmux'); await p.waitForFunction(() => TERMINAL_ZUSTAND.tmux && !TERMINAL_ZUSTAND.kette);
    await cmd('wg-quick up wg-sat && echo danach'); await p.clock.runFor(100);
    await cmd('exit');
    await p.clock.runFor(2000);
    assert.equal(await p.evaluate(() => TERMINAL_ZUSTAND.wgSat), null, 'wg-sat entfernt');
    assert.equal(await nachExit(), '');
    assert.deepEqual(await nach('echo frei'), ['frei']);
    await nach('poff');

    /* Strg+C während holdoff im Vordergrund: Signal 2, $? 5 */
    await p.evaluate(() => { TERMINAL_ZUSTAND.wahlVorgabe = 'nocarrier'; });
    await cmd('pppd call kestrel updetach'); await p.clock.runFor(7000);
    assert.equal(await p.evaluate(() => terminalBeschaeftigt()), true);
    await inp.press('Control+c');
    await p.waitForFunction(() => !TERMINAL_ZUSTAND.kette);
    assert.match(await out.textContent(), /Terminating on signal 2/);
    assert.equal(await status(), '5');
    assert.equal(await p.evaluate(() => TERMINAL_ZUSTAND.modem), null);
    assert.deepEqual(errors, []);
    console.log('OK: Einwahl mit persist');
  } finally { await b.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
