/* Einwahlzeiten (#66 Abschnitt 2, erster Schritt): realistische Dauern mit Streuung, chat-TIMEOUT 60 s ohne Satellit
   ("alarm", "Failed"), ABORT-Meldungen wie chat(8) (" -- failed", "Failed (BUSY)"). Geprüft an den Zeitstempeln im Syslog,
   die mit der Uhr laufen. */
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
    const inp = p.locator('#profil-terminal-eingabe'), out = p.locator('#profil-terminal-ausgabe');
    const cmd = async z => { await inp.fill(z); await inp.press('Enter'); };
    const nach = async z => { await cmd(z); await p.waitForFunction(() => !TERMINAL_ZUSTAND.kette); const t = await out.textContent(); return t.slice(t.lastIndexOf('$ ' + z) + z.length + 2).split('\n').filter(Boolean); };
    // Zeitstempel (Sekunden seit Mitternacht UTC) der letzten Syslog-Zeile, die das Muster enthält.
    const zeit = async muster => p.evaluate(m => {
      const z = TERMINAL_ZUSTAND.syslog.filter(x => x.includes(m)).at(-1);
      if (!z) return null;
      const [h, mi, s] = z.split(' ')[2].split(':').map(Number);
      return h * 3600 + mi * 60 + s;
    }, muster);
    const abstand = async (a, b2) => { const x = await zeit(a), y = await zeit(b2); return (y - x + 86400) % 86400; };

    /* Chat-Datei: TIMEOUT vor der Wahl */
    const chat = await nach('cat /etc/chatscripts/kestrel');
    assert.deepEqual(chat.slice(3, 6), ['OK AT+CSQ', 'TIMEOUT 60', 'OK ATDT00882994401']);

    /* Erfolg, dreimal mit gestreuten Dauern: ATDT bis CONNECT 10-20 s, CONNECT bis IP-Adresse 9-14 s */
    const dauern = [];
    for (let i = 0; i < 3; i++) {
      await imUeberflug(p, { wahl: 'ok' });
      const start = await p.evaluate(() => Date.now());
      await cmd('pppd call kestrel updetach'); await verbunden(p);
      const connect = await abstand('send (ATDT', 'CONNECT 19200'), ip = await abstand('CONNECT 19200', 'local  IP address');
      assert.ok(connect >= 10 && connect <= 21, 'ATDT bis CONNECT ' + connect + ' s');
      assert.ok(ip >= 9 && ip <= 14, 'CONNECT bis IP ' + ip + ' s');
      // Zeitstempel und Uhr stimmen überein: die IP-Zeile trägt die Sekunde, in der die Verbindung stand.
      const jetzt = await p.evaluate(() => Date.now()), ipZeit = await zeit('local  IP address');
      const uhr = Math.floor((jetzt % 86400000) / 1000);
      assert.ok(((uhr - ipZeit + 86400) % 86400) <= 1, 'Zeitstempel synchron zur Uhr');
      assert.ok(jetzt - start >= 20000, 'Einwahl dauert mindestens 20 s');
      dauern.push(connect);
      const log = await p.evaluate(() => TERMINAL_ZUSTAND.syslog.join('\n'));
      assert.match(log, /send \(AT\+CSQ\^M\)\n.*timeout set to 60 seconds\n.*expect \(OK\)/);
      await cmd('poff');
    }

    /* BUSY: chat meldet den ABORT-Treffer; 3-5 s nach ATDT */
    await p.evaluate(() => { TERMINAL_ZUSTAND.wahlVorgabe = 'busy'; });
    await cmd('pon kestrel'); await gescheitert(p);
    assert.match((await nach('tail -n 4 /var/log/syslog')).join('\n'), /chat\[\d+\]: BUSY\n.*chat\[\d+\]:  -- failed\n.*chat\[\d+\]: Failed \(BUSY\)\n.*pppd\[\d+\]: Connect script failed$/);
    const busy = await abstand('send (ATDT', 'Failed (BUSY)');
    assert.ok(busy >= 3 && busy <= 6, 'BUSY nach ' + busy + ' s');
    await cmd('poff');
    /* NO CARRIER: 15-30 s */
    await p.evaluate(() => { TERMINAL_ZUSTAND.wahlVorgabe = 'nocarrier'; });
    await cmd('pon kestrel'); await gescheitert(p);
    const nc = await abstand('send (ATDT', 'Failed (NO CARRIER)');
    assert.ok(nc >= 15 && nc <= 31, 'NO CARRIER nach ' + nc + ' s');
    await cmd('poff');

    /* Kein Satellit über dem Horizont: CSQ 99,99, keine schnelle Absage, chat bricht nach 60 s ab (alarm, Failed) */
    await p.evaluate(() => { TERMINAL_ZUSTAND.wahlVorgabe = null; });
    const frei = await p.evaluate(() => { for (let t = Date.now(); t < Date.now() + 86400000; t += 30000) if (!kestrelSichtbar(t).length && !kestrelSichtbar(t + 180000).length) return t; return null; });
    assert.ok(frei, 'Testaufbau: Zeit ohne Satellit');
    let jetzt = await p.evaluate(() => Date.now());
    while (frei - jetzt > 600000) { jetzt += 600000; await p.clock.pauseAt(new Date(jetzt)); await p.evaluate(() => document.dispatchEvent(new Event('pointermove'))); }
    await p.clock.pauseAt(new Date(Math.max(frei, jetzt + 1000)));
    await cmd('pon kestrel');
    await p.clock.runFor(59000);
    assert.equal(await zeit('alarm'), null, 'vor Ablauf des Timeouts keine Absage');
    await gescheitert(p);
    assert.match((await nach('tail -n 12 /var/log/syslog')).join('\n'), /\+CSQ: 99,99\^M[\s\S]*expect \(CONNECT\)\n.*chat\[\d+\]: alarm\n.*chat\[\d+\]: Failed\n.*pppd\[\d+\]: Connect script failed$/);
    assert.equal(await abstand('send (ATDT', 'chat[' + await p.evaluate(() => TERMINAL_SITZUNG.chat) + ']: alarm'), 60);
    await cmd('poff');
    assert.deepEqual(errors, []);
    console.log('OK: Einwahlzeiten (Dauern ' + dauern.join(', ') + ' s bis CONNECT)');
  } finally { await b.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
