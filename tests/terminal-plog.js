/* plog (pon(1), Debian-ppp): ohne /var/log/ppp.log ist es "tail "$@" /var/log/syslog | grep ' \(pppd\|chat\)\['".
   Argumente gehen an tail, der Rückgabewert ist der von grep (1 ohne Treffer); -f folgt bis Strg+C (130). */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { APP } = require('./_pfad');
const { imUeberflug } = require('./_kestrel');

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
    const inp = p.locator('#profil-terminal-eingabe'), out = p.locator('#profil-terminal-ausgabe');
    const cmd = async z => { await inp.fill(z); await inp.press('Enter'); };
    const nach = async z => { await cmd(z); await p.waitForFunction(() => !TERMINAL_ZUSTAND.kette); const t = await out.textContent(); return t.slice(t.lastIndexOf('# ' + z) + z.length + 2).split('\n').filter(Boolean); };
    const status = async () => (await nach('echo $?'))[0];
    const syslog = n => p.evaluate(n => TERMINAL_ZUSTAND.syslog.filter(z => / (pppd|chat)\[/.test(z)).slice(-n), n);

    /* Noch nichts protokolliert: keine Ausgabe, grep ohne Treffer */
    assert.deepEqual(await nach('plog'), []);
    assert.equal(await status(), '1');

    /* Eine gescheiterte Wahl füllt das Protokoll (pppd wählt mit persist weiter; poff nach den Prüfungen) */
    await p.evaluate(() => { TERMINAL_ZUSTAND.wahlVorgabe = 'busy'; });
    await cmd('pon kestrel'); await p.clock.runFor(3000);
    await p.waitForFunction(() => !TERMINAL_ZUSTAND.kette && TERMINAL_ZUSTAND.modem?.holdoff);
    assert.ok((await syslog(99)).length > 10, 'Testaufbau: mehr als zehn Zeilen');
    assert.deepEqual(await nach('plog'), await syslog(10), 'wie tail: die letzten zehn Zeilen');
    assert.equal(await status(), '0');
    for (const z of ['plog -n 3', 'plog -n3', 'plog -3', 'plog --lines=3', 'plog --lines 3'])
      assert.deepEqual(await nach(z), await syslog(3), z);
    assert.match((await nach('plog -n 2')).join('\n'), /BUSY\n.* pppd\[\d+\]: Connect script failed$/);
    assert.deepEqual(await nach('plog -n 0'), []);
    assert.equal(await status(), '1', 'tail -n 0: grep ohne Treffer');

    /* Fehler von tail; der Rückgabewert bleibt der von grep */
    assert.deepEqual(await nach('plog -x'), ["tail: invalid option -- 'x'", "Try 'tail --help' for more information."]);
    assert.equal(await status(), '1');
    assert.deepEqual(await nach('plog --foo'), ["tail: unrecognized option '--foo'", "Try 'tail --help' for more information."]);
    assert.deepEqual(await nach('plog -n abc'), ["tail: invalid number of lines: 'abc'"]);
    assert.deepEqual(await nach('plog -n'), ["tail: option requires an argument -- 'n'", "Try 'tail --help' for more information."]);
    const fehlt = await nach('plog -n 2 /nix');
    assert.equal(fehlt[0], "tail: cannot open '/nix' for reading: No such file or directory");
    assert.deepEqual(fehlt.slice(1), await syslog(2), 'die übrigen Dateien liest tail trotzdem');
    assert.equal(await status(), '0');
    await nach('poff');

    /* -f: folgt dem Protokoll; pon im Hintergrund, die Wahl erscheint live */
    await cmd('pon kestrel && plog -f');
    assert.equal(await p.evaluate(() => terminalBeschaeftigt()), true, 'plog -f hält die Shell im Vordergrund');
    await p.clock.runFor(3000);
    const live = (await out.textContent()).split('# pon kestrel && plog -f\n').at(-1);
    assert.match(live, /^(.*\n){6}.* chat\[\d+\]: abort on \(BUSY\)\n[\s\S]* chat\[\d+\]: BUSY\n.* pppd\[\d+\]: Connect script failed$/);
    assert.equal(live.split('abort on (BUSY)').length, 2, 'jede Zeile genau einmal');
    assert.deepEqual(live.split('\n').slice(-12), await syslog(12), 'live dieselben Zeilen wie im Protokoll');
    await inp.press('Control+c');
    await p.waitForFunction(() => !TERMINAL_ZUSTAND.kette);
    assert.match(await out.textContent(), /Connect script failed\n\^C$/);
    await cmd('plog -fn 0'); await p.waitForFunction(() => terminalBeschaeftigt());
    await p.evaluate(() => terminalPppLog('pppd[1]: live')); assert.match(await out.textContent(), /# plog -fn 0\n.* pppd\[1\]: live$/);
    await inp.press('Control+c'); await p.waitForFunction(() => !TERMINAL_ZUSTAND.kette);
    assert.equal(await status(), '130');
    await nach('poff');
    /* Nach dem Ende wird nichts mehr angehängt */
    const vorher = await out.textContent();
    await p.evaluate(() => terminalPppLog('pppd[1]: nachher'));
    assert.equal(await out.textContent(), vorher);
    for (const z of ['plog -f', 'plog --follow -n 1']) {
      await cmd(z); await p.waitForFunction(() => terminalBeschaeftigt());
      await inp.press('Control+c'); await p.waitForFunction(() => !TERMINAL_ZUSTAND.kette);
    }

    /* LOS während plog -f: die Abbruchzeilen nur einmal (über den Syslog), plog läuft weiter und zeigt die Neuwahl (persist) */
    await imUeberflug(p, { wahl: 'ok' });
    await cmd('pon kestrel'); await p.clock.runFor(8000);
    await p.waitForFunction(() => TERMINAL_ZUSTAND.modem?.bereit);
    await cmd('plog -fn 0'); await p.waitForFunction(() => terminalBeschaeftigt());
    await p.evaluate(() => { TERMINAL_ZUSTAND.wahlVorgabe = 'nocarrier'; TERMINAL_ZUSTAND.satLink.bis = Date.now() + 500; });
    await p.clock.runFor(1000);
    await p.waitForFunction(() => TERMINAL_ZUSTAND.modem && !TERMINAL_ZUSTAND.modem.bereit);
    const los = (await out.textContent()).split('# plog -fn 0\n').at(-1).split('\n');
    assert.equal(los.length, 2, 'zwei Zeilen, jede einmal: ' + JSON.stringify(los));
    assert.match(los[0], /^\w{3} \d+ [\d:]{8} terminal pppd\[\d+\]: Modem hangup \(NO CARRIER\)$/);
    assert.match(los[1], /^\w{3} \d+ [\d:]{8} terminal pppd\[\d+\]: Connection terminated\.$/);
    assert.equal(await p.evaluate(() => !!TERMINAL_ZUSTAND.plogFolgen && terminalBeschaeftigt()), true, 'plog -f läuft nach LOS weiter');
    await p.clock.runFor(1500);
    assert.match((await out.textContent()).split('Connection terminated.').at(-1), /^\n.* chat\[\d+\]: abort on \(BUSY\)/, 'Neuwahl erscheint im Protokoll');
    await inp.press('Control+c'); await p.waitForFunction(() => !TERMINAL_ZUSTAND.kette);
    await nach('poff');
    /* Ohne plog -f bleibt die direkte Meldung in der Shell */
    await imUeberflug(p, { wahl: 'ok' });
    await cmd('pon kestrel'); await p.clock.runFor(8000);
    await p.waitForFunction(() => TERMINAL_ZUSTAND.modem?.bereit);
    await cmd('true');
    await p.evaluate(() => { TERMINAL_ZUSTAND.wahlVorgabe = 'nocarrier'; TERMINAL_ZUSTAND.satLink.bis = Date.now() + 500; });
    await p.clock.runFor(1000);
    await p.waitForFunction(() => TERMINAL_ZUSTAND.modem && !TERMINAL_ZUSTAND.modem.bereit);
    assert.deepEqual((await out.textContent()).split('# true\n').at(-1).split('\n'), [
      await p.evaluate(() => 'pppd[' + TERMINAL_SITZUNG.pppd + ']: Modem hangup (NO CARRIER)'),
      await p.evaluate(() => 'pppd[' + TERMINAL_SITZUNG.pppd + ']: Connection terminated.')]);
    await p.clock.runFor(1500);
    assert.doesNotMatch((await out.textContent()).split('# true\n').at(-1), /abort on/, 'Neuwahl im Hintergrund schreibt nicht in die Shell');
    await nach('poff');

    /* exit in tmux beendet die Shell samt plog -f; was in der Kette danach käme, läuft nicht mehr */
    await cmd('tmux'); await p.waitForFunction(() => TERMINAL_ZUSTAND.tmux && !TERMINAL_ZUSTAND.kette);
    await cmd('plog -f; echo danach'); await p.waitForFunction(() => terminalBeschaeftigt());
    await cmd('exit');
    await p.waitForFunction(() => !TERMINAL_ZUSTAND.tmux);
    assert.equal(await p.evaluate(() => ({ f: TERMINAL_ZUSTAND.plogFolgen, k: TERMINAL_ZUSTAND.kette, b: terminalBeschaeftigt() })).then(x => !x.f && !x.k && !x.b), true, 'Follower und Kette beendet');
    const nachExit = await out.textContent();
    assert.match(nachExit, /\[exited\]$/);
    await p.evaluate(() => terminalPppLog('pppd[1]: nach exit'));
    await p.clock.runFor(500);
    assert.equal(await out.textContent(), nachExit, 'keine Logzeilen und kein "danach" nach exit');
    assert.deepEqual(await nach('echo frei'), ['frei'], 'Shell nimmt wieder Befehle an');

    /* Sperre beendet ein laufendes plog -f */
    await cmd('plog -f'); await p.waitForFunction(() => terminalBeschaeftigt());
    await p.evaluate(() => document.body.classList.add('locked'));
    await p.waitForFunction(() => !TERMINAL_ZUSTAND.kette && !TERMINAL_ZUSTAND.plogFolgen);
    assert.deepEqual(errors, []);
    console.log('OK: plog');
  } finally { await b.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
