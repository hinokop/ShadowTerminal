/* Einwahlkette nach Dokumentation: predict(1) -p/-f, Iridium-Datenruf im chat-/pppd-Protokoll, poff(1)-Verhalten. */
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
    const cmd = async z => { await inp.fill(z); await inp.press('Enter'); };
    const nach = async z => { await cmd(z); const t = await out.textContent(); return t.slice(t.lastIndexOf('# ' + z) + z.length + 2).split('\n').filter(Boolean); };
    const status = async () => { await cmd('echo $?'); return (await out.textContent()).split('\n').at(-1); };
    const F = '/var/cache/tle/iridium.tle';

    /* predict: Aufruffehler */
    assert.deepEqual(await nach('predict -p "IRIDIUM 142"'), [await p.evaluate(() => TERMINAL_PREDICT_USAGE)]);
    assert.equal(await status(), '2');
    assert.deepEqual(await nach('predict -t /tmp/x.tle -p "IRIDIUM 142"'), ['predict: /tmp/x.tle: No such file or directory']);
    assert.equal(await status(), '1');
    assert.deepEqual(await nach(`predict -t ${F} -p ISS`), ['predict: "ISS" not found in ' + F]);

    /* -p in beliebiger Reihenfolge; -f ohne Zeit: eine Zeile für jetzt */
    const pass = await nach(`predict -p "IRIDIUM 142" -t ${F}`);
    assert.equal(pass.length, 3);
    const jetzt = await p.evaluate(() => Math.floor(Date.now() / 1000));
    const eine = await nach(`predict -t ${F} -f "IRIDIUM 142"`);
    assert.equal(eine.length, 1); assert.equal(Number(eine[0].split(/\s+/)[0]), jetzt);
    /* -f start +10: Sekundenauflösung; +3m: Minutenauflösung; absolute Endzeit */
    const sek = await nach(`predict -t ${F} -f "IRIDIUM 142" ${jetzt} +10`);
    assert.equal(sek.length, 11);
    assert.deepEqual(sek.map(z => Number(z.split(/\s+/)[0]) - jetzt), [...Array(11).keys()]);
    /* lange Ausgabe: vollständig im Scrollback; Kürzung über dem Limit sichtbar */
    const lang = await nach(`predict -t ${F} -f "IRIDIUM 142" ${jetzt} +120`);
    assert.equal(lang.length, 121);
    assert.deepEqual([Number(lang[0].split(/\s+/)[0]), Number(lang.at(-1).split(/\s+/)[0])], [jetzt, jetzt + 120]);
    const sehrLang = await nach(`predict -t ${F} -f "IRIDIUM 142" ${jetzt} +700`);
    assert.equal(sehrLang.length, 601);
    assert.equal(sehrLang.at(-1), 'predict: output limited to 600 lines');
    const min = await nach(`predict -t ${F} -f "IRIDIUM 142" ${jetzt} +3m`);
    assert.deepEqual(min.map(z => Number(z.split(/\s+/)[0]) - jetzt), [0, 60, 120, 180]);
    assert.equal((await nach(`predict -t ${F} -f "IRIDIUM 142" ${jetzt} ${jetzt + 4}`)).length, 5);
    /* ungültige Zeitangaben werden benannt; date +%s liefert den Zeitstempel */
    assert.deepEqual(await nach(`predict -t ${F} -f "IRIDIUM 142" 10`), ["predict: invalid start time '10' (expected Unix time)"]);
    assert.equal(await status(), '1');
    assert.deepEqual(await nach(`predict -t ${F} -f "IRIDIUM 142" ${jetzt} 10`), ["predict: invalid end time '10' (expected Unix time or +n[m])"]);
    assert.deepEqual(await nach('date +%s'), [String(jetzt)]);
    /* interaktiv: Prompt nennt predict ohne -f */
    await cmd(`predict -t ${F}`);
    assert.equal(await p.locator('#profil-terminal-prompt').textContent(), 'predict · Ctrl+C');
    await inp.press('Control+c');
    /* außerhalb des Überflugs unter dem Horizont */
    const bis = await p.evaluate(() => Math.floor(TERMINAL_ZUSTAND.satLink.bis / 1000));
    const spaet = await nach(`predict -t ${F} -f "IRIDIUM 142" ${bis + 600}`);
    assert.ok(Number(spaet[0].split(/\s+/)[4]) < 0, spaet[0]);
    assert.deepEqual(await nach(`predict -t ${F} -p "IRIDIUM 142" ${bis + 600}`), [], 'kein Überflug nach dem Fenster');

    /* Einwahl: Iridium-Datenruf statt GPRS-Wahl */
    await cmd('pppd call iridium updetach'); await p.clock.runFor(7600);
    const log = await out.textContent();
    for (const z of ['send (AT+CBST=71,0,1^M)', 'send (ATDT008816000025^M)', 'expect (CONNECT)', 'CONNECT 19200', ' -- got it',
      'Connect: ppp0 <--> /dev/ttyUSB0', 'remote IP address 172.16.1.1']) assert.ok(log.includes(z), z);
    assert.ok(!log.includes('*99***1#'), 'keine GPRS-Wahl');

    /* poff(1): falscher Provider lässt die Verbindung stehen; ohne Argument stoppt es die einzige Verbindung, still */
    assert.deepEqual(await nach('poff other'), ["poff: I could not find a pppd process for provider 'other'. None stopped."]);
    assert.equal(await p.evaluate(() => TERMINAL_ZUSTAND.modem.bereit), true);
    assert.deepEqual(await nach('poff'), [], 'Erfolg ist still');
    assert.equal(await status(), '0');
    assert.equal(await p.evaluate(() => TERMINAL_ZUSTAND.modem), null);
    assert.deepEqual(await nach('poff'), ['poff: No pppd is running.  None stopped.']);
    assert.equal(await status(), '1');
    assert.deepEqual(errors, []);
    console.log('OK: Einwahlkette nach Dokumentation');
  } finally { await b.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
