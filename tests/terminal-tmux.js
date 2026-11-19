/* tmux-Ausschnitt: predict im oberen Fenster, Shell unten bedienbar; Fokuswechsel mit Strg+B, Strg+C je Fenster,
   kill-pane, exit, Sperre. Abnahme: halb getippte Eingabe, Cursor und $? bleiben beim LOS oben unverändert. */
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
    const pass = await imUeberflug(p);
    const inp = p.locator('#profil-terminal-eingabe'), out = p.locator('#profil-terminal-ausgabe');
    const pane = p.locator('.tmux-pane'), status = p.locator('#profil-terminal-tmux');
    const prompt = p.locator('#profil-terminal-prompt');
    const cmd = async z => { await inp.fill(z); await inp.press('Enter'); };
    const letzte = async () => (await out.textContent()).split('\n').at(-1);

    /* ohne Sitzung */
    await cmd('tmux split-window -bd predict');
    assert.equal(await letzte(), 'no server running on /tmp/tmux-0/default');
    await cmd('tmux attach'); assert.equal(await letzte(), 'unknown command: attach');
    /* Sitzung mit Statuszeile; verschachtelt abgewiesen */
    await cmd('tmux');
    assert.equal(await status.isVisible(), true);
    assert.match(await status.textContent(), /^\[0\] 0:bash\*\s+"terminal" \d\d:\d\d \d\d-[A-Z][a-z]{2}-\d\d$/);
    await cmd('tmux'); assert.equal(await letzte(), 'sessions should be nested with care, unset $TMUX to force');

    /* Tab-Ergänzung und Split: Fokus bleibt unten */
    await inp.fill('tmux sp'); await inp.press('Tab'); assert.equal(await inp.inputValue(), 'tmux split-window -bd p', 'gemeinsamer Anfang von predict und plog -f');
    await inp.press('r'); await inp.press('Tab'); assert.equal(await inp.inputValue(), 'tmux split-window -bd predict');
    await inp.press('Enter');
    assert.equal(await pane.isVisible(), true);
    assert.match(await pane.textContent(), new RegExp(pass.name + '\\s+\\d+\\s+\\d+\\s+\\d+\\s+LOS '));
    // automatic-rename: der Name folgt dem aktiven Bereich; mit -d bleibt das die Shell.
    assert.match(await status.textContent(), /^\[0\] 0:bash\*/);
    assert.equal(await prompt.textContent(), 'root@terminal:/#');
    assert.equal(await inp.evaluate(e => e.readOnly), false);
    const panePos = await pane.evaluate(e => e.getBoundingClientRect().top), ausPos = await out.evaluate(e => e.getBoundingClientRect().top);
    assert.ok(panePos < ausPos, 'Fenster oberhalb der Shell');
    /* Zweiter Bereich: plog -f direkt über der Shell; ein dritter passt nicht */
    await cmd('tmux split-window -bd plog -f');
    assert.equal(await pane.count(), 2);
    assert.deepEqual(await pane.evaluateAll(l => l.map(e => e.getAttribute('aria-label'))), ['tmux: predict', 'tmux: plog']);
    await cmd('tmux split-window -bd predict'); assert.equal(await letzte(), 'create pane failed: pane too small');
    await cmd("tmux kill-pane -t '{up-of}'");
    assert.deepEqual(await pane.evaluateAll(l => l.map(e => e.getAttribute('aria-label'))), ['tmux: predict']);

    /* Abnahme: unten halb getippt, oben LOS -> nächster AOS; Eingabe, Cursor, $? unverändert */
    await cmd('false');
    await inp.fill('echo $?'); await inp.evaluate(e => e.setSelectionRange(5, 5));
    await p.clock.fastForward(pass.bis - await p.evaluate(() => Date.now()) + 2000);
    const nachLos = await pane.textContent();
    assert.match(nachLos, new RegExp(pass.name + '\\s+\\d+\\s+-?\\d+\\s+\\d+\\s+AOS '), 'nach LOS zeigt die Verfolgung den nächsten Aufgang');
    assert.equal(await inp.inputValue(), 'echo $?');
    assert.deepEqual(await inp.evaluate(e => [e.selectionStart, e.selectionEnd]), [5, 5]);
    await inp.press('End'); await inp.press('Enter'); assert.equal(await letzte(), '1');

    /* Strg+C unten wirkt nur auf die Shell */
    await inp.fill('halb'); await inp.press('Control+c');
    assert.equal(await letzte(), 'root@terminal:/# halb^C');
    assert.equal(await pane.isVisible(), true);
    /* Strg+B ↑: Fokus oben, Eingabe gesperrt; Strg+B ↓ zurück */
    await inp.press('Control+b'); await inp.press('ArrowUp');
    assert.equal(await pane.evaluate(e => e.classList.contains('aktiv')), true);
    assert.equal(await inp.evaluate(e => e.readOnly), true);
    const vorEnter = await out.textContent(); await inp.press('Enter'); assert.equal(await out.textContent(), vorEnter, 'Enter oben führt nichts aus');
    // Oben gehören die Tasten predict: Verlauf, Tab und Zeichen ändern den Entwurf unten nicht.
    await inp.press('Control+b'); await inp.press('ArrowDown');
    await inp.fill('echo halbfertig'); await inp.evaluate(e => e.setSelectionRange(6, 6));
    await inp.press('Control+b'); await inp.press('ArrowUp'); await p.clock.runFor(800);
    for (const k of ['ArrowUp', 'ArrowDown', 'Tab', 'x', 'Backspace', 'Enter']) await inp.press(k);
    assert.equal(await inp.inputValue(), 'echo halbfertig');
    assert.deepEqual(await inp.evaluate(e => [e.selectionStart, e.selectionEnd]), [6, 6]);
    await inp.press('Control+b'); await inp.press('ArrowDown');
    assert.equal(await inp.evaluate(e => e.readOnly), false);
    assert.equal(await inp.inputValue(), 'echo halbfertig');
    await inp.fill('');
    /* Klick oben, Strg+C oben schließt nur das Fenster; PPP bleibt bestehen */
    await imUeberflug(p);
    await cmd('pppd call kestrel updetach'); await p.clock.runFor(7600);
    assert.equal(await p.evaluate(() => TERMINAL_ZUSTAND.modem.bereit), true);
    await pane.click();
    assert.equal(await pane.evaluate(e => e.classList.contains('aktiv')), true);
    await inp.press('Control+c');
    assert.equal(await pane.isVisible(), false);
    assert.equal(await inp.evaluate(e => e.readOnly), false);
    assert.equal(await p.evaluate(() => TERMINAL_ZUSTAND.modem?.bereit), true, 'Einwahl läuft weiter');
    assert.match(await status.textContent(), /^\[0\] 0:bash\*/);
    /* kill-pane von unten */
    await cmd('tmux split-window -bd predict'); assert.equal(await pane.isVisible(), true);
    await cmd("tmux kill-pane -t '{up-of}'"); assert.equal(await pane.isVisible(), false);
    await cmd("tmux kill-pane -t '{up-of}'"); assert.equal(await letzte(), "can't find pane: {up-of}");
    /* exit verlässt die Sitzung, Konsole bleibt offen */
    await cmd('tmux split-window -bd predict');
    await cmd('exit');
    assert.equal(await letzte(), '[exited]');
    assert.deepEqual([await pane.isVisible(), await status.isVisible(), await p.locator('#profil-terminal').isVisible()], [false, false, true]);
    /* kill-pane ohne Ziel trifft die Shell: Sitzung endet */
    await cmd('tmux'); await cmd('tmux split-window -bd predict'); await cmd('tmux kill-pane');
    assert.equal(await letzte(), '[exited]'); assert.equal(await status.isVisible(), false);
    /* Befehlsfolge wie in tmux: tmux \; split-window -bd predict */
    await cmd('tmux \\; split-window -bd predict');
    assert.deepEqual([await status.isVisible(), await pane.isVisible()], [true, true]);
    // In laufender Sitzung: Fehler der verschachtelten Sitzung bricht die Folge ab, kein zweites Fenster, $? 1.
    await cmd("tmux kill-pane -t '{up-of}'");
    await cmd('tmux \\; split-window -bd predict');
    assert.match(await out.textContent(), /sessions should be nested with care, unset \$TMUX to force$/);
    assert.equal(await pane.isVisible(), false);
    await cmd('echo $?'); assert.equal(await letzte(), '1');
    await cmd('tmux split-window -bd predict');
    /* Pfeiltasten wiederholbar: einmal Strg+B, dann ↑ und ↓ innerhalb von 500 ms; danach steht der Fokus im Eingabefeld */
    await inp.press('Control+b'); await inp.press('ArrowUp');
    assert.equal(await pane.evaluate(e => e.classList.contains('aktiv')), true);
    await p.clock.runFor(200); await inp.press('ArrowDown');
    assert.equal(await pane.evaluate(e => e.classList.contains('aktiv')), false);
    await p.clock.runFor(200); await inp.press('ArrowUp');
    assert.equal(await pane.evaluate(e => e.classList.contains('aktiv')), true);
    await p.clock.runFor(800); await inp.press('ArrowDown');
    assert.equal(await pane.evaluate(e => e.classList.contains('aktiv')), true, 'nach 500 ms wieder Präfix nötig');
    await pane.click(); await inp.press('Control+b'); await inp.press('ArrowDown');
    assert.equal(await p.evaluate(() => document.activeElement?.id), 'profil-terminal-eingabe');
    await inp.press('a'); assert.equal(await inp.inputValue(), 'a', 'unten sofort beschreibbar');
    await cmd('exit');
    /* Sperre beendet die Sitzung */
    await cmd('tmux'); await cmd('tmux split-window -bd predict');
    await p.evaluate(() => document.body.classList.add('locked'));
    await p.waitForFunction(() => TERMINAL_ZUSTAND.tmux === null);
    assert.deepEqual(errors, []);
    console.log('OK: tmux-Split mit predict oben und bedienbarer Shell unten');
  } finally { await b.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
