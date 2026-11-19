/* profanity-Fenster: 1 Console (System- und Befehlsmeldungen), /msg öffnet ein Gesprächsfenster, /win wechselt;
   Titelzeile mit Fenster, [OMEMO] und Präsenz; Statuszeile mit Zeit, Konto und Fenstern (aktuelles -n-, Neues
   hervorgehoben); Befehle erscheinen nicht im Verlauf; Abbruch meldet Lost connection. in jedem Fenster (Profanity 0.18.2: sv_ev_lost_connection, wins_lost_connection). */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { APP } = require('./_pfad');
const { chatBereit, schnelleWahl } = require('./_kestrel');

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
    await chatBereit(p, { kontakt: false });
    await p.clock.pauseAt(await p.evaluate(() => Date.now() + 1000));
    const inp = p.locator('#profil-terminal-eingabe'), verlauf = p.locator('#profil-terminal-chat');
    const titel = p.locator('#profil-terminal-xmpp-titel'), status = p.locator('#profil-terminal-xmpp-status');
    const cmd = async z => { await inp.fill(z); await inp.press('Enter'); };
    const fenster = () => status.locator('.xmpp-fenster').evaluateAll(l => l.map(e => e.textContent + (e.classList.contains('neu') ? '*' : '')));
    const konto = await p.evaluate(() => TERMINAL_ZUSTAND.kanal.account), kontakt = await p.evaluate(() => TERMINAL_ZUSTAND.kanal.vorschlag);

    /* Konsole: Anmeldung; Titel Console mit Präsenz; Statuszeile mit Zeit, Konto, -1- */
    assert.match(await verlauf.textContent(), /Connecting to ghost@[\s\S]*logged in successfully, online\./);
    assert.equal(await titel.textContent(), 'Console[online]');
    assert.match(await status.textContent(), new RegExp('^\\[\\d\\d:\\d\\d\\] \\[' + konto.replace(/\./g, '\\.') + '\\]-1-$'));
    // Fenster rechtsbündig (statusbar.c)
    const lage = await p.evaluate(() => { const s = document.getElementById('profil-terminal-xmpp-status').getBoundingClientRect(), t = document.querySelector('#profil-terminal-xmpp-status .xmpp-tabs').getBoundingClientRect(); return Math.round(s.right - t.right); });
    assert.ok(lage <= 1, 'Fenster rechtsbündig: ' + lage);

    /* /msg: Fenster 2 für den Kontakt, aktiv; der Befehl erscheint nicht; die Konsole bleibt unverändert */
    const konsole = await verlauf.textContent();
    await cmd('/msg ' + kontakt);
    assert.equal(await titel.textContent(), kontakt + '[online]');
    assert.deepEqual(await fenster(), ['[1]', '-2-']);
    assert.equal(await verlauf.textContent(), '', 'neues Gesprächsfenster leer');
    await cmd('Auftrag erledigt.');
    assert.match(await verlauf.textContent(), /^\d\d:\d\d:\d\d - me: Auftrag erledigt\.$/);

    /* Antwort, während die Konsole aktiv ist: Fenster 2 wird hervorgehoben; /win 2 zeigt sie und hebt die Markierung auf */
    await cmd('/win 1');
    assert.equal(await verlauf.textContent(), konsole);
    assert.equal(await titel.textContent(), 'Console[online]');
    await p.clock.runFor(7500);
    assert.deepEqual(await fenster(), ['-1-', '[2]*']);
    assert.equal(await verlauf.textContent(), konsole, 'die Antwort steht nicht in der Konsole');
    await cmd('/win 2');
    assert.match(await verlauf.textContent(), new RegExp(kontakt.replace(/\./g, '\\.') + ': Verstanden\\.$'));
    assert.deepEqual(await fenster(), ['[1]', '-2-']);

    /* OMEMO je Gespräch: Start im Fenster 2, Wechsel zur Konsole; die Meldung landet in Fenster 2, der Titel zeigt [OMEMO] */
    await cmd('/omemo start'); await cmd('/win 1');
    await p.clock.runFor(3100);
    assert.deepEqual(await fenster(), ['-1-', '[2]*']);
    assert.equal(await titel.textContent(), 'Console[online]');
    await cmd('/win 2');
    assert.equal(await titel.textContent(), kontakt + ' [OMEMO][online]');
    assert.match(await verlauf.textContent(), /OMEMO session started\.$/);
    assert.doesNotMatch(await verlauf.textContent(), /\/omemo|\/win|\/msg/, 'Befehle erscheinen nicht im Verlauf');

    /* /win auf ein fehlendes Fenster; /msg auf denselben Kontakt öffnet kein zweites Fenster */
    /* Profanity 0.18.2 cmd_win: cons_show schreibt in die Konsole ohne Hinweis, das aktive Fenster bleibt */
    await cmd('/win 3');
    assert.doesNotMatch(await verlauf.textContent(), /does not exist/);
    assert.deepEqual(await fenster(), ['[1]', '-2-']);
    await cmd('/win 1'); await cmd('/msg ' + kontakt);
    assert.deepEqual(await fenster(), ['[1]', '-2-']);

    /* Abbruch: Lost connection. genau einmal in Konsole und Gespräch, keine Modemzeile; Präsenz offline; Fenster bleiben wechselbar */
    await p.evaluate(() => terminalPppShell('poff', '', []));
    await p.clock.runFor(1000);
    assert.match(await verlauf.textContent(), /OMEMO session started\.\n\d\d:\d\d:\d\d - Lost connection\.$/);
    assert.doesNotMatch(await verlauf.textContent(), /Disconnected/);
    assert.doesNotMatch(await verlauf.textContent(), /pppd:/);
    assert.equal(await titel.textContent(), kontakt + ' [OMEMO][offline]');
    assert.deepEqual(await fenster(), ['[1]*', '-2-'], 'cons_show_error setzt den Konsolenhinweis');
    await cmd('/win 1');
    assert.match(await verlauf.textContent(), /logged in successfully[\s\S]*Window 3 does not exist\.\n[\s\S]*Lost connection\.$/);
    assert.equal((await verlauf.textContent()).match(/Lost connection\./g).length, 1, 'je Fenster genau eine Meldung');
    await cmd('/quit');
    assert.deepEqual([await titel.isVisible(), await status.isVisible()], [false, false], 'nach /quit keine profanity-Zeilen');
    assert.deepEqual(errors, []);
    console.log('OK: profanity-Fenster (Console, Gespräch, /win, Titel- und Statuszeile)');
  } finally { await b.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
