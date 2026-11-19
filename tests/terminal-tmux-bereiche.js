/* tmux mit mehreren Bereichen: predict und plog -f oberhalb der Shell, Fokuswechsel durch alle drei, Reihenfolge bei
   split-window -b, kill-pane auf {up-of}, {top}, {last}, Fensternamen (automatic-rename), plog -f live im Bereich,
   exit verwirft auch eine laufende Archivabfrage. */
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
    await imUeberflug(p);
    await p.clock.pauseAt(await p.evaluate(() => Date.now() + 1000));
    const inp = p.locator('#profil-terminal-eingabe'), out = p.locator('#profil-terminal-ausgabe');
    const bereiche = p.locator('.tmux-pane'), status = p.locator('#profil-terminal-tmux');
    const cmd = async z => { await inp.fill(z); await inp.press('Enter'); };
    const letzte = async () => (await out.textContent()).split('\n').at(-1);
    const namen = () => bereiche.evaluateAll(l => l.map(e => e.getAttribute('aria-label').slice(6) + (e.classList.contains('aktiv') ? '*' : '')));
    const fenster = async () => (await status.textContent()).match(/^\[0\] 0:(\S+)\*/)[1];
    const taste = async k => { await inp.press('Control+b'); await inp.press(k); await p.clock.runFor(600); };

    /* Zwei Bereiche über der Shell, in der Reihenfolge des Anlegens */
    await cmd('tmux');
    await cmd('tmux split-window -bd predict');
    await cmd('tmux split-window -bd plog -f');
    assert.deepEqual(await namen(), ['predict', 'plog']);
    const lage = await p.evaluate(() => [...document.querySelectorAll('.tmux-pane'), document.getElementById('profil-terminal-ausgabe')].map(e => e.getBoundingClientRect().top));
    assert.ok(lage[0] < lage[1] && lage[1] < lage[2], 'predict über plog über der Shell');
    assert.equal(await fenster(), 'bash');
    await cmd('tmux split-window -bd predict'); assert.equal(await letzte(), 'create pane failed: pane too small');

    /* plog -f im Bereich: die Einwahl erscheint dort live, die Shell bleibt frei */
    await p.evaluate(() => { TERMINAL_ZUSTAND.wahlVorgabe = 'busy'; });
    await cmd('pon kestrel'); await p.clock.runFor(3000);
    assert.match(await bereiche.nth(1).textContent(), /chat\[\d+\]:  -- failed\n.* chat\[\d+\]: Failed \(BUSY\)\n.* pppd\[\d+\]: Connect script failed$/);
    assert.equal(await p.evaluate(() => terminalBeschaeftigt()), false);
    await cmd('echo frei'); assert.equal(await letzte(), 'frei');
    await cmd('poff');

    /* Fokus: ↑ plog, ↑ predict, ↑ bleibt (kein Umlauf), ↓ plog, ↓ Shell; o läuft reihum */
    await taste('ArrowUp'); assert.deepEqual(await namen(), ['predict', 'plog*']); assert.equal(await fenster(), 'sh');
    await taste('ArrowUp'); assert.deepEqual(await namen(), ['predict*', 'plog']); assert.equal(await fenster(), 'predict');
    await taste('ArrowUp'); assert.deepEqual(await namen(), ['predict*', 'plog']);
    assert.equal(await inp.evaluate(e => e.readOnly), true);
    await taste('ArrowDown'); assert.deepEqual(await namen(), ['predict', 'plog*']);
    await taste('ArrowDown'); assert.deepEqual(await namen(), ['predict', 'plog']); assert.equal(await fenster(), 'bash');
    assert.equal(await inp.evaluate(e => e.readOnly), false);
    await taste('o'); assert.deepEqual(await namen(), ['predict*', 'plog']);
    await taste('o'); assert.deepEqual(await namen(), ['predict', 'plog*']);
    await taste('o'); assert.deepEqual(await namen(), ['predict', 'plog']);
    /* Klick wählt den Bereich; Strg+C beendet nur dessen Programm, der Fokus geht an die Shell */
    await bereiche.nth(1).click(); assert.deepEqual(await namen(), ['predict', 'plog*']);
    await inp.press('Control+c');
    assert.deepEqual(await namen(), ['predict']);
    assert.equal(await inp.evaluate(e => e.readOnly), false);

    /* Ohne -f endet plog sofort, sein Bereich schließt sich wieder */
    await cmd('tmux split-window -bd plog'); assert.deepEqual(await namen(), ['predict']);
    await cmd('echo $?'); assert.equal(await letzte(), '0');

    /* {last}: der zuletzt aktive Bereich; {top}: der oberste */
    await cmd('tmux split-window -bd plog -f');
    await taste('ArrowUp'); await taste('ArrowUp'); await taste('ArrowDown'); await taste('ArrowDown');
    await cmd("tmux kill-pane -t '{last}'"); assert.deepEqual(await namen(), ['predict'], '{last} = plog (zuletzt aktiv vor der Shell)');
    await cmd("tmux kill-pane -t '{last}'"); assert.equal(await letzte(), "can't find pane: {last}");
    await cmd('tmux split-window -bd plog -f');
    await cmd("tmux kill-pane -t '{top}'"); assert.deepEqual(await namen(), ['plog']);
    await cmd("tmux kill-pane -t '{up-of}'"); assert.deepEqual(await namen(), []);

    /* -b ohne -d: der neue Bereich wird aktiv; der nächste mit -b steht über ihm */
    await cmd('tmux split-window -b predict \\; split-window -b plog -f');
    assert.deepEqual(await namen(), ['plog*', 'predict']);
    await taste('ArrowDown'); await taste('ArrowDown'); assert.deepEqual(await namen(), ['plog', 'predict']);

    /* Standardfenster (400 px): plog zuerst, dann predict; plog zeigt ohne neuen Eintrag die jüngsten ganzen Zeilen,
       auch nach dem Verkleinern und Vergrößern; predict ist bei Platzmangel scrollbar */
    await cmd('exit');
    await p.evaluate(() => { terminalKonsoleGeometrie.hoehe = 400; terminalKonsoleLayout(); });
    for (let i = 0; i < 30; i++) await p.evaluate(i => terminalPppLog('pppd[1]: Zeile ' + i), i);
    await cmd('tmux'); await cmd('tmux split-window -bd plog -f'); await cmd('tmux split-window -bd predict');
    // ResizeObserver läuft mit dem Rendern in Echtzeit, unabhängig von der angehaltenen Testuhr.
    const plogStand = async () => { await p.waitForTimeout(250); return p.evaluate(() => {
      const el = document.querySelector('.tmux-pane[aria-label="tmux: plog"]'), pr = document.querySelector('.tmux-pane[aria-label="tmux: predict"]');
      return { letzte: el.textContent.split('\n').at(-1), passt: el.scrollHeight <= el.clientHeight, predict: getComputedStyle(pr).overflowY };
    }); };
    let stand = await plogStand();
    assert.deepEqual([stand.letzte.replace(/^.* pppd/, 'pppd'), stand.passt, stand.predict], ['pppd[1]: Zeile 29', true, 'auto'], 'nach dem zweiten Bereich');
    for (const hoehe of [300, 560]) {
      await p.evaluate(h => { terminalKonsoleGeometrie.hoehe = h; terminalKonsoleLayout(); }, hoehe);
      stand = await plogStand();
      assert.deepEqual([stand.letzte.replace(/^.* pppd/, 'pppd'), stand.passt], ['pppd[1]: Zeile 29', true], 'Fensterhöhe ' + hoehe);
    }

    /* exit beendet alle Bereiche und verwirft eine laufende Archivabfrage */
    await p.evaluate(() => { window.terminalBruecke = () => new Promise(r => setTimeout(() => r({ text: 'zu spät' }), 2000)); });
    await cmd('cat /' + await p.evaluate(() => TERMINAL_DB) + '/test.txt');
    await p.clock.runFor(200);
    await cmd('exit');
    assert.equal(await letzte(), '[exited]');
    assert.deepEqual(await namen(), []);
    await p.clock.runFor(3000);
    assert.equal(await letzte(), '[exited]', 'keine Ausgabe der Archivabfrage nach exit');
    assert.deepEqual(errors, []);
    console.log('OK: tmux mit mehreren Bereichen');
  } finally { await b.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
