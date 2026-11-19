/* PREDICT-Anzeige (#66 Abschnitt 1): Titel, QTH mit UTC-Datum, Spanne der TLE-Epochen, Entfernung in km, AOS/LOS mit Datum
   und Countdown HH:MM:SS (auch über UTC-Mitternacht), Hervorhebung nur über dem geometrischen Horizont, gleiche Rundung wie
   die Link-Anzeige, Bereich ohne eigene Fläche mit schmaler Trennlinie. Bahnrechnung und Einwahl unverändert. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { APP } = require('./_pfad');
const { imUeberflug, schnelleWahl } = require('./_kestrel');

// Unabhängig von der Anwendung: Epoche aus TLE-Zeile 1 (JJTTT.TTTTTTTT).
const epoche = l1 => { const jj = +l1.slice(18, 20), tag = +l1.slice(20, 32); return Date.UTC(2000 + jj, 0, 1) + (tag - 1) * 86400000; };
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const datum = ms => { const d = new Date(ms); return String(d.getUTCDate()).padStart(2, '0') + MON[d.getUTCMonth()] + String(d.getUTCFullYear()).slice(2); };
const uhr = ms => new Date(ms).toISOString().slice(11, 19);
const countdown = (bis, ms) => { const s = Math.max(0, Math.ceil((bis - ms) / 1000)), z = n => String(n).padStart(2, '0'); return z(Math.floor(s / 3600)) + ':' + z(Math.floor(s / 60) % 60) + ':' + z(s % 60); };

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
    // Ohne Funkmaske meinen Fensterkopf (LOS) und PREDICT (LOS) dasselbe Ereignis; LINK END prüft terminal-link-end.
    await p.evaluate(() => { KESTREL_FUNK.ende = 0; });
    await p.clock.install();
    const inp = p.locator('#profil-terminal-eingabe');
    const cmd = async z => { await inp.fill(z); await inp.press('Enter'); };
    const taste = async k => { await inp.press('Control+b'); await inp.press(k); await p.clock.runFor(600); };

    /* Kopf: Titel, QTH mit Datum, Spanne der TLE-Epochen, Spaltenkopf mit km */
    const tle = await p.evaluate(() => KESTREL_TLE.map(e => e[1]));
    const ep = tle.map(epoche), von = Math.min(...ep), bis = Math.max(...ep);
    assert.notEqual(von, bis, 'Testaufbau: unterschiedliche Epochen');
    const jetzt = await p.evaluate(() => Date.now());
    const kopf = (await p.evaluate(ms => terminalPredictLive(ms), jetzt)).split('\n');
    assert.match(kopf[0], new RegExp('^PREDICT Real-Time Multi-Tracking Mode · ' + datum(jetzt) + ' \\d\\d:\\d\\d:\\d\\d UTC$'));
    assert.match(kopf[1], new RegExp('^QTH \\S+ \\d+\\.\\d\\d[NS] \\d+\\.\\d\\d[EW] · TLE epoch ' + datum(von) + ' ' + uhr(von).slice(0, 5) + ' - ' + datum(bis) + ' ' + uhr(bis).slice(0, 5) + ' UTC$'));
    assert.match(kopf[2], /^Satellite\s+Az\s+El\s+Range km\s+Next event \(UTC\)$/);
    assert.equal(kopf.length, 3 + tle.length, 'drei Kopfzeilen, eine Zeile je Satellit');

    /* Pflichtfall: nächster AOS nach UTC-Mitternacht, mit Datum des Folgetags und Countdown */
    const fall = await p.evaluate(start => {
      for (let ms = start; ms < start + 3 * 86400000; ms += 600000) for (const sat of kestrelSats()) {
        const l = kestrelLage(sat, ms), u = kestrelUeberflug(sat, ms);
        if (u && l.el < 0 && new Date(u.von).getUTCDate() !== new Date(ms).getUTCDate()) return { ms, name: sat.name, von: u.von };
      }
      return null;
    }, jetzt);
    assert.ok(fall, 'Testaufbau: AOS nach Mitternacht gefunden');
    const zeile = (await p.evaluate(ms => terminalPredictLive(ms), fall.ms)).split('\n').find(z => z.startsWith(fall.name));
    assert.notEqual(datum(fall.von), datum(fall.ms));
    assert.ok(zeile.endsWith('AOS ' + datum(fall.von) + ' ' + uhr(fall.von) + ' (' + countdown(fall.von, fall.ms) + ')'), zeile);
    assert.match(zeile, /\(\d\d:\d\d:\d\d\)$/);

    /* Über dem Horizont: fett markiert, nur diese Zeile; LOS-Countdown wie in der Link-Anzeige */
    const pass = await imUeberflug(p, { wahl: 'ok' });
    await p.clock.pauseAt(await p.evaluate(() => Date.now() + 1000));
    await cmd('pppd call kestrel updetach'); await p.clock.runFor(7600);
    await p.waitForFunction(() => TERMINAL_ZUSTAND.modem?.bereit);
    await cmd('tmux'); await cmd('tmux split-window -bd predict');
    await p.clock.runFor(1000);
    const pane = p.locator('.tmux-pane');
    const markiert = await pane.locator('.predict-oben').allTextContents();
    const oben = await p.evaluate(() => kestrelSats().filter(s => kestrelLage(s, Date.now()).el >= 0).map(s => s.name));
    assert.ok(oben.includes(pass.name), 'Testaufbau: Überflug-Satellit über dem Horizont');
    assert.deepEqual(markiert.map(t => t.split(' ')[0]).sort(), oben.sort(), 'genau die Satelliten über dem Horizont');
    assert.equal(await pane.locator('.predict-oben').first().evaluate(e => getComputedStyle(e).fontWeight), '700');
    const zeilePass = (await pane.textContent()).split('\n').find(z => z.startsWith(pass.name));
    const badge = await p.locator('#profil-terminal-sat').textContent();
    assert.match(badge, /^KESTREL-\d · LOS \d\d:\d\d:\d\d$/);
    assert.ok(zeilePass.endsWith('(' + badge.split('LOS ')[1] + ')'), 'gleiche Rundung: ' + zeilePass + ' / ' + badge);
    /* Gleicher Zeitstand: zu beliebigen Zeitpunkten innerhalb der Sekunden zeigen Fensterkopf und PREDICT denselben Countdown */
    for (const schritt of [137, 251, 333, 89, 412, 177, 263, 501, 71, 349]) {
      await p.clock.runFor(schritt);
      const k = (await p.locator('#profil-terminal-sat').textContent()).split('LOS ')[1];
      const z = (await pane.textContent()).split('\n').find(x => x.startsWith(pass.name)).match(/\((\d\d:\d\d:\d\d)\)$/)[1];
      assert.equal(z, k, 'Zeitstand nach +' + schritt + ' ms');
    }
    /* Sekundensprung innerhalb eines Takts: die Uhr läuft während des Takts weiter (Start 1 ms vor der Sekundengrenze, jeder Aufruf von Date.now() +400 ms);
       Fensterkopf und PREDICT nutzen trotzdem denselben, einmal erfassten Zeitstand */
    const gleich = async (wo) => {
      const k = (await p.locator('#profil-terminal-sat').textContent()).split('LOS ')[1];
      const z = (await p.locator('.tmux-pane[aria-label="tmux: predict"]').textContent()).split('\n').find(x => x.startsWith(pass.name)).match(/\((\d\d:\d\d:\d\d)\)$/)[1];
      assert.equal(z, k, wo);
    };
    await p.evaluate(() => { const echt = Date.now, start = Math.ceil(echt() / 1000) * 1000 - 1; let n = 0; Date.now = () => start + 400 * n++; try { terminalTakt(); } finally { Date.now = echt; } });
    await gleich('Sekundensprung im Takt');
    /* Neue plog-Zeile kurz nach einer Sekundengrenze, vor dem nächsten Takt: kein Vorlauf von PREDICT */
    await cmd('tmux split-window -bd plog -f');
    for (let i = 0; i < 4; i++) {
      await p.evaluate(() => { TERMINAL_ZEITSTAND = Math.floor(Date.now() / 1000) * 1000; terminalTakt(); });
      const bisGrenze = await p.evaluate(() => 1000 - Date.now() % 1000);
      await p.evaluate(ms => { const echt = Date.now, t = echt() + ms + 5; Date.now = () => t; try { terminalPppLog('pppd[1]: nach der Grenze'); } finally { Date.now = echt; } }, bisGrenze);
      await gleich('plog-Zeile nach der Sekundengrenze, Versuch ' + (i + 1));
      await p.clock.runFor(1000);
    }
    await cmd("tmux kill-pane -t '{up-of}'");
    /* Farben: kein flächiges Grün. plog in der Textfarbe der Shell; PREDICT-Kopf hellgrau, unter dem Horizont gedämpft,
       über dem Horizont hell und fett; Grün nur für Statusleiste und Fokuslinie */
    await cmd('tmux split-window -bd plog -f');
    const farben = await p.evaluate(() => {
      const c = e => getComputedStyle(e).color, q = s => document.querySelector(s);
      return { shell: c(q('#profil-terminal-ausgabe')), plog: c(q('.tmux-pane[aria-label="tmux: plog"]')),
        kopf: c(q('.predict-kopf')), unten: c(q('.predict-unten')), oben: c(q('.predict-oben')),
        status: getComputedStyle(q('#profil-terminal-tmux')).backgroundColor };
    });
    const GRUEN = 'rgb(168, 210, 147)';
    assert.equal(farben.plog, farben.shell, 'plog wie die Shell');
    for (const k of ['kopf', 'unten', 'oben']) assert.notEqual(farben[k], GRUEN, k + ' nicht grün');
    const hell = f => f.match(/\d+/g).slice(0, 3).reduce((a, b) => a + +b, 0);
    assert.ok(hell(farben.oben) > hell(farben.kopf) && hell(farben.kopf) > hell(farben.unten), 'oben heller als Kopf heller als unten: ' + JSON.stringify(farben));
    assert.equal(farben.status, 'rgb(47, 138, 58)', 'Statusleiste bleibt grün');
    await taste('ArrowUp');
    assert.equal(await p.locator('.tmux-pane.aktiv').evaluate(e => getComputedStyle(e).borderBottomColor), 'rgb(111, 191, 86)', 'Fokuslinie grün');
    await taste('ArrowDown');
    await cmd("tmux kill-pane -t '{up-of}'");
    /* Fläche: keine eigene Hintergrundfarbe, schmale Trennlinie unten */
    const stil = await pane.evaluate(e => { const s = getComputedStyle(e); return [s.backgroundColor, s.borderTopWidth, s.borderBottomWidth]; });
    assert.deepEqual(stil, ['rgba(0, 0, 0, 0)', '0px', '1px']);
    await cmd('exit');
    /* Chat-Kopf: Relais und Countdown hell und halbfett, Telemetrie gedämpft */
    await cmd('wg-quick up wg-sat'); await p.clock.runFor(1000);
    await cmd('profanity'); await p.clock.runFor(3000);
    const orbitStil = await p.evaluate(() => {
      const k = document.querySelector('#profil-terminal-orbit .link-kopf'), t = document.querySelector('#profil-terminal-orbit .link-telemetrie');
      return k && t ? { kopf: k.textContent, kc: getComputedStyle(k).color, kw: getComputedStyle(k).fontWeight, tc: getComputedStyle(t).color } : null;
    });
    assert.ok(orbitStil, 'Chat-Kopf mit Relais und Telemetrie');
    assert.match(orbitStil.kopf, new RegExp('^' + pass.name + '  \\[LOS \\d\\d:\\d\\d:\\d\\d\\]$'));
    assert.equal(orbitStil.kw, '600');
    assert.ok(hell(orbitStil.kc) > hell(orbitStil.tc), 'Kopf heller als Telemetrie');
    assert.notEqual(orbitStil.tc, GRUEN);
    await cmd('/quit'); await cmd('wg-quick down wg-sat'); await cmd('poff');
    assert.deepEqual(errors, []);
    console.log('OK: PREDICT-Anzeige');
  } finally { await b.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
