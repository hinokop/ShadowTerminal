/* Einwahlkette nach Dokumentation mit echter Bahnrechnung: predict(1) -p/-f, KESTREL-Einwahl im chat-/pppd-Protokoll,
   gezielt auslösbare Wahlausgänge (BUSY, NO CARRIER), poff(1)-Verhalten, virtuelle Konfigurationsdateien. */
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
    const pass = await imUeberflug(p);
    const inp = p.locator('#profil-terminal-eingabe'), out = p.locator('#profil-terminal-ausgabe');
    const cmd = async z => { await inp.fill(z); await inp.press('Enter'); };
    const nach = async z => { await cmd(z); const t = await out.textContent(); return t.slice(t.lastIndexOf('# ' + z) + z.length + 2).split('\n').filter(Boolean); };
    const status = async () => { await cmd('echo $?'); return (await out.textContent()).split('\n').at(-1); };
    const F = '/var/cache/tle/kestrel.tle', S = pass.name;
    const spalte = (z, i) => Number(z.trim().split(/\s+/)[i]);

    /* Aufruffehler, Datei, Satellit */
    assert.deepEqual(await nach('predict -p'), [await p.evaluate(() => TERMINAL_PREDICT_USAGE)]);
    assert.equal(await status(), '2');
    assert.deepEqual(await nach(`predict -t /tmp/x.tle -p ${S}`), ['predict: /tmp/x.tle: No such file or directory']);
    assert.equal(await status(), '1');
    assert.deepEqual(await nach(`predict -t ${F} -p ISS`), ['predict: "ISS" not found in ' + F]);
    assert.deepEqual(await nach(`predict -t ${F} -f ${S} 10`), ["predict: invalid start time '10' (expected Unix time)"]);
    /* TLE-Datei: echte Zwei-Zeilen-Elemente mit gültiger Prüfsumme */
    const tle = await nach(`cat ${F}`);
    assert.ok(tle.length >= 3 && tle.length % 3 === 0);
    for (let i = 0; i < tle.length; i += 3) {
      assert.match(tle[i], /^KESTREL-\d$/);
      for (const z of [tle[i + 1], tle[i + 2]]) {
        assert.equal(z.length, 69, z);
        const summe = [...z.slice(0, 68)].reduce((a, c) => a + (c === '-' ? 1 : /\d/.test(c) ? +c : 0), 0);
        assert.equal(summe % 10, +z[68], 'Prüfsumme ' + z);
      }
    }

    /* -p ohne -t (Standarddatenbank): laufender Überflug vom Aufgang bis zum Untergang */
    const zeilen = await nach(`predict -p ${S}`);
    assert.ok(zeilen.length >= 3);
    assert.equal(spalte(zeilen[0], 0), Math.floor(pass.von / 1000), 'beginnt mit dem Aufgang');
    assert.equal(spalte(zeilen.at(-1), 0), Math.floor(pass.bis / 1000), 'endet mit dem Untergang');
    assert.ok(zeilen.every(z => spalte(z, 4) >= 0 && spalte(z, 4) <= 90), 'Elevation im Überflug nicht negativ');
    assert.ok(zeilen.every(z => z.trim().split(/\s+/).length === 12 || /\s$/.test(z)), 'zwölf Spalten');
    /* -f: Sekunden- und Minutenauflösung, außerhalb des Überflugs negative Elevation */
    const jetzt = await p.evaluate(() => Math.floor(Date.now() / 1000));
    assert.deepEqual((await nach(`predict -t ${F} -f ${S} ${jetzt} +10`)).map(z => spalte(z, 0) - jetzt), [...Array(11).keys()]);
    assert.deepEqual((await nach(`predict -f ${S} ${jetzt} +3m`)).map(z => spalte(z, 0) - jetzt), [0, 60, 120, 180]);
    /* lange Ausgabe: vollständig im Scrollback; Kürzung über dem Limit sichtbar */
    const lang = await nach(`predict -t ${F} -f ${S} ${jetzt} +120`);
    assert.equal(lang.length, 121);
    assert.deepEqual([spalte(lang[0], 0), spalte(lang.at(-1), 0)], [jetzt, jetzt + 120]);
    const sehrLang = await nach(`predict -f ${S} ${jetzt} +700`);
    assert.equal(sehrLang.length, 601);
    assert.equal(sehrLang.at(-1), 'predict: output limited to 600 lines');
    assert.ok(spalte((await nach(`predict -f ${S} ${Math.floor(pass.bis / 1000) + 600}`))[0], 4) < 0);
    /* -p mit Startzeit nach dem Untergang: nächster Überflug */
    const naechster = await nach(`predict -p ${S} ${Math.floor(pass.bis / 1000) + 60}`);
    assert.ok(naechster.length && spalte(naechster[0], 0) > pass.bis / 1000, 'nächster Überflug');
    assert.deepEqual(await nach('date +%s'), [String(jetzt)]);

    /* Höchster Punkt unabhängig vom Abfragezeitpunkt (vor dem Aufgang, nach dem Maximum, kurz vor dem Untergang) */
    const gleich = await p.evaluate(({ name, von, bis, max }) => {
      const sat = kestrelSat(name);
      return [von - 600000, max + 30000, bis - 5000].map(ab => { sat.cache = null; const u = kestrelUeberflug(sat, ab); return [u.von, u.bis, u.maxMs, Math.round(u.maxEl * 10)]; });
    }, pass);
    assert.deepEqual(gleich[1], gleich[0]); assert.deepEqual(gleich[2], gleich[0]);
    /* Konfiguration: Peer und Chatscript */
    assert.ok((await nach('cat /etc/ppp/peers/kestrel')).includes('connect "/usr/sbin/chat -v -f /etc/chatscripts/kestrel"'));
    assert.ok((await nach('cat /etc/chatscripts/kestrel')).includes('OK ATDT00882994401'));
    assert.deepEqual(await nach('pon other'), ['pppd: unable to open /etc/ppp/peers/other: No such file or directory']);

    /* BUSY und NO CARRIER gezielt: chat bricht ab, pppd endet mit 8 */
    await p.evaluate(() => { TERMINAL_ZUSTAND.wahlVorgabe = 'busy'; });
    await cmd('pppd call kestrel updetach'); await p.clock.runFor(3000);
    assert.match(await out.textContent(), /chat\[\d+\]: BUSY\npppd\[\d+\]: Connect script failed$/);
    assert.equal(await status(), '8');
    await p.evaluate(() => { TERMINAL_ZUSTAND.wahlVorgabe = 'nocarrier'; });
    await cmd('pon kestrel'); await p.clock.runFor(7000);
    assert.equal(await p.evaluate(() => TERMINAL_ZUSTAND.modem), null, 'gescheiterte Hintergrundwahl räumt ab');
    assert.match((await nach('tail -n 3 /var/log/syslog')).join('\n'), /NO CARRIER\n.*Connect script failed$/);

    /* Erfolg: Signal nach Elevation, Wahl ins Gateway, vollständiges Protokoll */
    await p.evaluate(() => { TERMINAL_ZUSTAND.wahlVorgabe = 'ok'; });
    await cmd('pppd call kestrel updetach'); await p.clock.runFor(7600);
    const log = await out.textContent();
    for (const z of ['send (AT+CSQ^M)', 'send (ATDT00882994401^M)', 'expect (CONNECT)', 'CONNECT 19200', ' -- got it',
      'Connect: ppp0 <--> /dev/ttyUSB0', 'remote IP address 10.64.0.1']) assert.ok(log.includes(z), z);
    assert.match(log, /\+CSQ: ([4-9]|[12]\d|3[01]),99\^M/);
    assert.match(log, /local  IP address 10\.64\.\d+\.\d+/);
    assert.ok(!/AT\+CBST|008816|\*99\*\*\*1#/.test(log), 'keine Iridium- oder GPRS-Wahl');
    assert.match(await p.locator('#profil-terminal-sat').textContent(), new RegExp('^' + S + ' · LOS '));

    /* poff(1) */
    assert.deepEqual(await nach('poff other'), ["poff: I could not find a pppd process for provider 'other'. None stopped."]);
    assert.equal(await p.evaluate(() => TERMINAL_ZUSTAND.modem.bereit), true);
    assert.deepEqual(await nach('poff'), [], 'Erfolg ist still');
    assert.equal(await status(), '0');
    assert.deepEqual(await nach('poff'), ['poff: No pppd is running.  None stopped.']);
    assert.equal(await status(), '1');

    /* interaktiv: Verfolgung aller Satelliten mit nächstem Ereignis */
    await cmd('predict');
    assert.equal(await p.locator('#profil-terminal-prompt').textContent(), 'predict · Ctrl+C');
    const live = await p.locator('#profil-terminal-orbit').textContent();
    assert.match(live, new RegExp(S + '\\s+\\d+\\s+\\d+\\s+\\d+\\s+LOS \\d\\d:\\d\\d:\\d\\d'));
    await inp.press('Control+c');
    assert.deepEqual(errors, []);
    console.log('OK: Einwahlkette mit echter Bahnrechnung');
  } finally { await b.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
