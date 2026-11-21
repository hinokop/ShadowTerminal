/* Befehlstabelle: Hilfe, Ausführung und Tab-Ergänzung kommen aus einer Definition; Verhalten unverändert. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { APP } = require('./_pfad');

(async () => {
  const b = await chromium.launch();
  try {
    const p = await b.newPage();
    p.setDefaultTimeout(12000);
    const errors = [];
    p.on('pageerror', e => errors.push(e.message));
    await p.route(/^https?:/, r => r.abort());
    await p.goto(APP);
    await p.fill('#gate-pw', 'pw-test-123');
    if (await p.isVisible('#gate-pw2')) await p.fill('#gate-pw2', 'pw-test-123');
    await p.click('#gate-go'); await p.click('#profil-terminal-oeffnen');
    const inp = p.locator('#profil-terminal-eingabe'), out = p.locator('#profil-terminal-ausgabe');
    const cmd = async z => { await inp.fill(z); await inp.press('Enter'); await p.waitForFunction(() => !TERMINAL_ZUSTAND.kette); };
    const nach = async z => { await cmd(z); const t = await out.textContent(); return t.slice(t.lastIndexOf('$ ' + z) + z.length + 2).split('\n').filter(Boolean); };

    /* Tabelle vollständig: jeder Name eindeutig, jede Zeile ausführbar */
    const info = await p.evaluate(() => ({ namen: TERMINAL_BEFEHLE, ohneAus: TERMINAL_TABELLE.filter(e => typeof e.aus !== 'function').map(e => e.name) }));
    assert.equal(new Set(info.namen).size, info.namen.length);
    assert.deepEqual(info.ohneAus, []);
    assert.deepEqual(info.namen, ['ls', 'cd', 'cat', 'head', 'tail', 'wget', 'help', 'pwd', 'whoami', 'uname', 'date', 'ping', 'clear', 'exit',
      'predict', 'pon', 'pppd', 'poff', 'plog', 'nmap', 'map', 'open', 'sudo', 'echo', 'true', 'false', 'wg-quick', 'wg', 'profanity', 'tmux']);
    /* Hilfe aus der Tabelle erzeugt (map, open und sudo neu) */
    assert.deepEqual(await nach('help'), [
      'ls [-a|-l|-la] · cd <ordner> · pwd · cat <datei> · head <datei> · tail <datei> · wget <datei> · nmap <options> <target> · map [pins [query]|PIN-nnn|name] · open <id|name> · sudo <command> · echo · true · false · whoami · uname -a · date [+%s] · ping relay · clear · exit',
      'predict · pon kestrel · pppd call kestrel [updetach] · poff [kestrel] · plog [-n N] [-f] · wg-quick · wg · profanity (/msg, /omemo, /sendfile, /quit)',
      "tmux · tmux split-window -bd predict · tmux split-window -bd plog -f · Ctrl+B ↑/↓ switch pane · tmux kill-pane -t '{up-of}'",
      'cmd1 && cmd2 · cmd1 || cmd2 · cmd1 ; cmd2 · exit status: echo $?']);
    /* Aufruffehler und Rückgabewerte wie bisher */
    for (const [z, erwartet, code] of [['help x', 'usage: help', '2'], ['pwd x', 'usage: pwd', '2'], ['uname', 'usage: uname -a', '2'],
      ['date x', 'usage: date', '2'], ['true x', 'usage: true', '2'], ['clear x', 'usage: clear', '2'], ['foo', 'foo: command not found', '127'],
      ['ping', 'ping: usage: ping <destination>', '1'], ['ping x', 'ping: x: Name or service not known', '2']]) {
      assert.deepEqual(await nach(z), [erwartet], z);
      assert.deepEqual(await nach('echo $?'), [code], z);
    }
    /* Tab-Ergänzung aus der Tabelle: Befehle, feste Argumente, Optionen, Pfade, keine Ergänzung ohne Tab-Art */
    const tab = async (vorher, nachher) => { await inp.fill(vorher); await inp.press('Tab'); await p.waitForFunction(w => $('profil-terminal-eingabe').value === w, nachher); };
    await tab('tm', 'tmux '); await tab('tmux k', "tmux kill-"); await tab('wg-quick u', 'wg-quick up wg-sat');
    await tab('uname ', 'uname -a'); await tab('ping r', 'ping relay'); await tab('ls -l', 'ls -l');
    await tab('cat /var/cache/tle/k', 'cat /var/cache/tle/kestrel.tle'); await tab('tail -n 5 /var/l', 'tail -n 5 /var/log/syslog');
    await tab('pppd call kestrel && ', 'pppd call kestrel && tail -n 12 /var/log/syslog');
    await inp.fill('echo he'); await inp.press('Tab'); assert.equal(await inp.inputValue(), 'echo he');
    assert.deepEqual(errors, []);
    console.log('OK: Befehlstabelle');
  } finally { await b.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
