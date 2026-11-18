/* Shell-Kern: Zerlegung mit Anführungszeichen, Verkettung (&&, ||, ;), Rückgabewert $?, Vordergrundbefehle in Ketten.
   Abnahme: poff … && tail … bei laufendem und bei bereits beendetem Modem. Exit-Code 1 bei Fehlschlag. */
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
    await p.clock.install(); await p.clock.pauseAt(new Date(Date.now() + 1000));
    const inp = p.locator('#profil-terminal-eingabe'), out = p.locator('#profil-terminal-ausgabe');
    const prompt = p.locator('#profil-terminal-prompt');
    const cmd = async z => { await inp.fill(z); await inp.press('Enter'); };
    const letzte = async () => (await out.textContent()).split('\n').at(-1);
    const status = async () => { await cmd('echo $?'); return letzte(); };

    /* Ausgabe bleibt nach einer Kette unten (Prompt-Wechsel ändert die Höhe der Eingabezeile) */
    for (let i = 0; i < 6; i++) await cmd('help');
    await cmd('echo "Hello"');
    const unten = () => p.$eval('#profil-terminal-ausgabe', el => el.scrollHeight - el.scrollTop - el.clientHeight);
    assert.ok(await unten() < 4, 'letzte Zeile sichtbar: ' + await unten());
    await cmd('clear');

    /* Strg+C an der leeren Eingabe: ^C, $? = 130 */
    await inp.fill('halb getippt'); await inp.press('Control+c');
    assert.equal(await letzte(), 'root@terminal:/# halb getippt^C'); assert.equal(await inp.inputValue(), '');
    await cmd('$?'); assert.equal(await letzte(), '130: command not found');

    /* Zerlegung */
    await cmd(`echo "a  b" 'c $?' d\\ e`); assert.equal(await letzte(), 'a  b c $? d e');
    await cmd('echo "Status $?"'); assert.equal(await letzte(), 'Status 0');
    await cmd('echo "a && b" \'c || d ; e\''); assert.equal(await letzte(), 'a && b c || d ; e');
    await cmd('echo "offen'); assert.match(await letzte(), /unexpected EOF while looking for matching `"'/);
    assert.equal(await status(), '2');
    await cmd('&& echo x'); assert.match(await letzte(), /syntax error near unexpected token `&&'/);
    await cmd('echo x &&'); assert.match(await letzte(), /syntax error near unexpected token `newline'/);
    await cmd('echo x ;'); assert.equal(await letzte(), 'x');
    await cmd('ls | grep ops'); assert.match(await letzte(), /terminal: \|: pipes, redirections and substitutions are not supported/);
    await cmd('echo a > datei'); assert.match(await letzte(), /terminal: >: /);

    /* Verkettung und Rückgabewerte */
    await cmd('false; echo $?'); assert.equal(await letzte(), '1');
    await cmd('true && echo ja || echo nein'); assert.equal(await letzte(), 'ja');
    await cmd('false && echo ja || echo nein'); assert.equal(await letzte(), 'nein');
    await cmd('false && echo nie; echo $?'); assert.equal(await letzte(), '1');
    await cmd('unbekannt; echo $?');
    assert.deepEqual((await out.textContent()).split('\n').slice(-2), ['unbekannt: command not found', '127']);
    await cmd('poff'); assert.equal(await letzte(), 'usage: poff iridium'); assert.equal(await status(), '2');

    /* Abnahme: poff && tail bei laufendem Modem */
    await cmd('predict -t /var/cache/tle/iridium.tle -p "IRIDIUM 142"');
    await cmd('pppd call iridium'); await p.clock.runFor(7500);
    assert.equal(await p.evaluate(() => TERMINAL_ZUSTAND.modem.bereit), true);
    await cmd('poff iridium && tail -n 6 /var/log/syslog');
    assert.match(await out.textContent(), /terminal pppd\[1401\]: Terminating on signal 15\n.*terminal pppd\[1401\]: Connection terminated\.$/, 'tail läuft nach erfolgreichem poff');
    assert.equal((await out.textContent()).split('poff iridium && tail').at(-1).match(/Terminating on signal 15/g).length, 1, 'Abbau genau einmal, im Syslog');
    assert.equal(await status(), '0');
    /* … und bei bereits beendetem Modem: tail startet nicht, $? zeigt den Fehler */
    await cmd('poff iridium && tail -n 6 /var/log/syslog');
    assert.equal(await letzte(), 'poff: iridium is not running', 'tail startet nicht');
    assert.equal(await status(), '1');
    await cmd('poff iridium || echo kein Modem'); assert.equal(await letzte(), 'kein Modem');

    /* Vordergrund: updetach hält die Kette an, bis die Einwahl steht */
    await cmd('pppd call iridium updetach && wg-quick up wg-sat && echo bereit');
    assert.equal(await prompt.textContent(), '');
    await p.clock.runFor(3000);
    await cmd('echo zwischendurch');
    assert.doesNotMatch(await out.textContent(), /zwischendurch|bereit$/, 'Eingabe während der Kette wird nicht ausgeführt');
    assert.equal(await inp.inputValue(), 'echo zwischendurch', 'Eingabe bleibt stehen');
    assert.equal(await p.locator('#profil-terminal form').getAttribute('aria-busy'), 'true', 'sichtbares Signal: Shell beschäftigt');
    await p.clock.runFor(4600);
    assert.match(await out.textContent(), /local IP address [\d.]+\n\[#\] ip link add wg-sat type wireguard$/);
    await p.clock.runFor(700);
    assert.equal(await letzte(), 'bereit');
    assert.equal(await p.evaluate(() => TERMINAL_ZUSTAND.wgSat.bereit), true);
    assert.equal(await prompt.textContent(), 'root@terminal:/#');
    assert.equal(await p.locator('#profil-terminal form').getAttribute('aria-busy'), 'false');
    assert.equal(await inp.inputValue(), 'echo zwischendurch', 'alte Eingabe wird nicht von selbst ausgeführt');
    assert.doesNotMatch(await out.textContent(), /\nzwischendurch/);
    await cmd('wg-quick down wg-sat; poff iridium; echo $?'); assert.equal(await letzte(), '0');

    /* Abbruch mit Strg+C beendet die ganze Kette; kein späterer Timer startet Tunnel oder Chat */
    await cmd('pppd call iridium updetach && wg-quick up wg-sat && profanity');
    await p.clock.runFor(3000);
    await inp.press('Control+c');
    assert.match(await out.textContent(), /Terminating on signal 2\npppd\[1401\]: Connection terminated\.$/);
    await p.clock.runFor(30000);
    assert.deepEqual(await p.evaluate(() => [TERMINAL_ZUSTAND.modem, TERMINAL_ZUSTAND.wgSat, TERMINAL_ZUSTAND.kanal, TERMINAL_ZUSTAND.kette]), [null, null, null, null]);
    assert.equal(await p.locator('#profil-terminal-chat').isVisible(), false);
    assert.match(await out.textContent(), /Connection terminated\.$/, 'nach dem Abbruch keine weitere Ausgabe');
    assert.equal(await status(), '5', 'pppd endet nach SIGINT mit 5 (pppd(8))');

    /* Strg+C während wg-quick up: Kette abgebrochen, Schnittstelle abgeräumt, $? 130 */
    await cmd('pppd call iridium updetach'); await p.clock.runFor(7600);
    await cmd('wg-quick up wg-sat && profanity'); await p.clock.runFor(200);
    await inp.press('Control+c');
    assert.match(await out.textContent(), /\^C\n\[#\] ip link delete dev wg-sat$/);
    await p.clock.runFor(10000);
    assert.deepEqual(await p.evaluate(() => [TERMINAL_ZUSTAND.wgSat, TERMINAL_ZUSTAND.kanal, TERMINAL_ZUSTAND.kette]), [null, null, null]);
    assert.equal(await status(), '130');
    await cmd('poff iridium');

    /* Interaktiv: nach /quit läuft die Kette weiter */
    await cmd('pppd call iridium updetach && wg-quick up wg-sat'); await p.clock.runFor(8300);
    await cmd('profanity && echo zurueck'); await p.clock.runFor(6100);
    assert.equal(await p.locator('#profil-terminal-chat').isVisible(), true);
    await cmd('/quit');
    assert.equal(await letzte(), 'zurueck');
    assert.deepEqual(errors, []);
    console.log('OK: Shell-Kern mit Verkettung und Rückgabewerten');
  } finally { await b.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
