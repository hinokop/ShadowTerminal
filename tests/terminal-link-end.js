/* LINK END (#66 Abschnitt 2): Funkmaske aus der Bahnkurve. Einwahl ab 5°, Linkende unter 3° auf dem absteigenden Ast;
   Fensterkopf und Chat zeigen LINK END, PREDICT weiter den geometrischen LOS; der Hangup kommt zum LINK END. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { APP } = require('./_pfad');
const { imUeberflug, verbunden, schnelleWahl } = require('./_kestrel');

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
    const inp = p.locator('#profil-terminal-eingabe'), out = p.locator('#profil-terminal-ausgabe');
    const cmd = async z => { await inp.fill(z); await inp.press('Enter'); };
    const uhr = ms => new Date(ms).toISOString().slice(11, 19);

    /* Beispiel aus #66: KESTREL-1 am 18.11.2026, Standard-QTH, absteigender Ast: 3° um 17:44:14, LOS um 17:45:00 UTC */
    const bsp = await p.evaluate(() => {
      const sat = kestrelSat('KESTREL-1'), u = kestrelUeberflugRechnen(sat, Date.UTC(2026, 10, 18, 17, 30));
      return { ende: kestrelLinkEnde(u), los: u.bis, el: [kestrelEl(sat, kestrelLinkEnde(u) - 1000), kestrelEl(sat, kestrelLinkEnde(u))] };
    });
    assert.ok(Math.abs(bsp.ende - Date.UTC(2026, 10, 18, 17, 44, 14)) <= 1000, 'Linkende ' + uhr(bsp.ende));
    assert.ok(Math.abs(bsp.los - Date.UTC(2026, 10, 18, 17, 45, 0)) <= 1000, 'LOS ' + uhr(bsp.los));
    assert.ok(bsp.el[0] >= 3 && bsp.el[1] < 3, 'Linkende = erste Sekunde unter 3°: ' + bsp.el);

    /* Verbindung: Fensterkopf zeigt LINK END (Countdown auf das Linkende), PREDICT den geometrischen LOS */
    await imUeberflug(p, { wahl: 'ok' });
    await p.clock.pauseAt(await p.evaluate(() => Date.now() + 1000));
    await cmd('pppd call kestrel updetach'); await verbunden(p);
    const link = await p.evaluate(() => { const l = TERMINAL_ZUSTAND.satLink; return { sat: l.sat.name, bis: l.bis, los: l.los, u: kestrelUeberflug(l.sat, Date.now()).bis }; });
    assert.equal(link.los, link.u, 'los = geometrischer LOS');
    assert.ok(link.bis < link.los, 'Linkende vor dem LOS');
    await cmd('tmux'); await cmd('tmux split-window -bd predict'); await p.clock.runFor(300);
    const kopf = p.locator('#profil-terminal-sat');
    const zeile = async () => (await p.locator('.tmux-pane').textContent()).split('\n').find(z => z.startsWith(link.sat));
    const jetzt = () => p.evaluate(() => terminalZeitstand());
    assert.equal(await kopf.textContent(), link.sat + ' · EST. LINK END ' + await p.evaluate(b => terminalCountdown(b, terminalZeitstand()), link.bis));
    assert.ok((await zeile()).endsWith('LOS ' + await p.evaluate(ms => kestrelDatum(ms) + ' ' + terminalPppZeit(ms), link.los) + ' (' + await p.evaluate(b => terminalCountdown(b, terminalZeitstand()), link.los) + ')'), await zeile());

    /* Hangup zum LINK END, nicht zum LOS; PREDICT zählt weiter bis zum LOS und wechselt dann auf AOS */
    await p.clock.runFor(link.bis - await p.evaluate(() => Date.now()) - 600);
    assert.doesNotMatch(await out.textContent(), /Modem hangup/);
    await p.clock.runFor(1000);
    assert.match(await out.textContent(), /pppd\[\d+\]: Modem hangup \(NO CARRIER\)\npppd\[\d+\]: Connection terminated\.$/);
    assert.equal(await kopf.isVisible(), false, 'Fensterkopf nach dem Linkende aus');
    const el = await p.evaluate(s => kestrelEl(kestrelSat(s), Date.now()), link.sat);
    assert.ok(el >= 0 && el < 3, 'zum Linkende noch über dem Horizont: ' + el);
    assert.match(await zeile(), / LOS /, 'PREDICT zeigt weiter den LOS');
    assert.equal(await p.locator('.tmux-pane .predict-oben').count() > 0, true, 'über dem geometrischen Horizont hervorgehoben');
    await p.clock.runFor(link.los - await p.evaluate(() => Date.now()) + 2000);
    assert.match(await zeile(), / AOS /, 'nach dem LOS der nächste Aufgang');
    await cmd('exit'); await cmd('poff');

    /* Grenze gleich null: kein Unterschied, der Kopf zeigt LOS */
    await p.evaluate(() => { KESTREL_FUNK.ende = 0; });
    await imUeberflug(p, { wahl: 'ok' });
    await cmd('pppd call kestrel updetach'); await verbunden(p);
    await p.clock.runFor(300);
    assert.match(await kopf.textContent(), / · EST\. LOS \d\d:\d\d:\d\d$/);
    await cmd('poff');
    assert.deepEqual(errors, []);
    console.log('OK: LINK END aus der Funkmaske, PREDICT mit geometrischem LOS');
  } finally { await b.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
