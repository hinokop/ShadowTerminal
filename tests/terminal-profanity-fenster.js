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
    const konto = await p.evaluate(() => TERMINAL_ZUSTAND.kanal.account), jid = await p.evaluate(() => TERMINAL_ZUSTAND.kanal.jid), kontakt = await p.evaluate(() => TERMINAL_ZUSTAND.kanal.vorschlag);

    /* Konsole: Anmeldung; Titel Console mit Präsenz; Statuszeile mit Zeit, Konto, -1- */
    /* Konto mit Ressource (jid_random_resource), Anmeldung wie cl_ev_connect_account und cons_show_login_success */
    const esc = x => x.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
    assert.match(jid, new RegExp('^' + esc(konto) + '/profanity\\.[0-9A-Za-z]{4}$'));
    assert.match(await verlauf.textContent(), new RegExp('^\\d\\d:\\d\\d:\\d\\d - Connecting with account ' + esc(konto) + ' as ' + esc(jid) +
      '\\n\\d\\d:\\d\\d:\\d\\d - ' + esc(jid) + ' logged in successfully, online \\(priority 0\\)\\.$'));
    assert.equal(await titel.textContent(), 'Console[online]');
    assert.match(await status.textContent(), new RegExp('^\\[\\d\\d:\\d\\d\\] \\[' + esc(jid) + '\\]-1-$'));
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
    // chatwin_incoming_msg -> cons_show_incoming_message (console.chat = all): Hinweiszeile, nicht die Nachricht
    assert.match(await verlauf.textContent(), new RegExp('^' + esc(konsole) + '\\n\\d\\d:\\d\\d:\\d\\d - << chat message: ' + esc(kontakt) + ' \\(win 2\\)$'));
    await cmd('/win 2');
    assert.match(await verlauf.textContent(), new RegExp(kontakt.replace(/\./g, '\\.') + ': Verstanden\\.$'));
    assert.deepEqual(await fenster(), ['[1]', '-2-']);

    /* OMEMO (cmd_omemo_start): is_omemo sofort, Titel [OMEMO], "Initiating ..."; vor dem Bundle geht keine Nachricht hinaus;
       "ready" kommt im Fenster des Kontakts, auch nach einem Wechsel, ohne Statuszeilen-Hinweis (win_println) */
    await cmd('/omemo start');
    assert.equal(await titel.textContent(), kontakt + ' [OMEMO][online]');
    assert.match(await verlauf.textContent(), new RegExp('\\d\\d:\\d\\d:\\d\\d ! Initiating OMEMO session with ' + esc(kontakt) + '\\.\\.\\.$'));
    await cmd('Auftrag erledigt.');
    assert.match(await verlauf.textContent(), /! This message cannot be encrypted for any recipient\.\n\d\d:\d\d:\d\d ! It could also be that key bundles have not been received\. Try "\/omemo end", then "\/omemo start"\.$/);
    assert.doesNotMatch(await verlauf.textContent(), /Initiating[\s\S]*me: /, 'die Nachricht wurde nicht gesendet');
    await cmd('/omemo start');
    assert.match(await verlauf.textContent(), /! You are already in an OMEMO session\.$/);
    await cmd('/win 1');
    await p.clock.runFor(3100);
    assert.deepEqual(await fenster(), ['-1-', '[2]']);
    assert.equal(await titel.textContent(), 'Console[online]');
    await cmd('/win 2');
    assert.match(await verlauf.textContent(), new RegExp('! OMEMO session with ' + esc(kontakt) + ' \\(device \\d+\\) ready\\.$'));
    await p.clock.runFor(8000);
    assert.doesNotMatch(await verlauf.textContent(), /Verstanden\.$/, 'auf die nicht gesendete Nachricht folgt keine Antwort');
    /* /omemo fingerprint im Gespräch: Fingerprint des Kontakts (omemo_format_fingerprint), vertraut und aktiv */
    await cmd('/omemo fingerprint');
    assert.match(await verlauf.textContent(), new RegExp(' - ' + esc(kontakt) + "'s OMEMO fingerprint: [0-9a-f]{8}(-[0-9a-f]{8}){7} \\(trusted\\) \\(active\\)\\n" +
      "\\d\\d:\\d\\d:\\d\\d - You can trust it with '/omemo trust \\[<contact>\\] <fingerprint>'\\n" +
      "\\d\\d:\\d\\d:\\d\\d - You can untrust it with '/omemo untrust \\[<contact>\\] <fingerprint>'$"));
    assert.doesNotMatch(await verlauf.textContent(), /Your OMEMO fingerprint/);
    /* /omemo end, dann /omemo start: die Sitzung besteht schon (session_store), kein zweites "ready" */
    await cmd('/omemo end');
    assert.equal(await titel.textContent(), kontakt + '[online]');
    await cmd('/omemo end');
    assert.match(await verlauf.textContent(), /! You are not currently in an OMEMO session\.$/);
    await cmd('/omemo start'); await p.clock.runFor(3100);
    assert.match(await verlauf.textContent(), /! Initiating OMEMO session with \S+\.\.\.$/);
    assert.equal((await verlauf.textContent()).match(/ ready\./g).length, 1);
    assert.equal(await titel.textContent(), kontakt + ' [OMEMO][online]');
    /* /omemo fingerprint in der Konsole: eigener Fingerprint (cons_show), keine weiteren eigenen Geräte */
    await cmd('/win 1'); await cmd('/omemo fingerprint');
    assert.match(await verlauf.textContent(), new RegExp(' - Your OMEMO fingerprint: [0-9a-f]{8}(-[0-9a-f]{8}){7}\\n\\d\\d:\\d\\d:\\d\\d - There is no known fingerprints for ' + esc(konto) + '$'));
    await cmd('/omemo start');
    assert.match(await verlauf.textContent(), / - You must be in a regular chat window to start an OMEMO session\.$/);
    await cmd('/win 2');
    assert.doesNotMatch(await verlauf.textContent(), /\d [-!~] \/(omemo|win|msg)/, 'Befehle erscheinen nicht im Verlauf');

    /* /win auf ein fehlendes Fenster; /msg auf denselben Kontakt öffnet kein zweites Fenster */
    /* Profanity 0.18.2 cmd_win: cons_show schreibt in die Konsole ohne Hinweis, das aktive Fenster bleibt */
    await cmd('/win 3');
    assert.doesNotMatch(await verlauf.textContent(), /does not exist/);
    assert.deepEqual(await fenster(), ['[1]', '-2-']);
    await cmd('/win 1'); await cmd('/msg ' + kontakt);
    assert.deepEqual(await fenster(), ['[1]', '-2-']);

    /* Zwei Gespräche: jede Meldung erhält ihre eigene Antwort; die zweite löscht die erste nicht (Timer je Fenster) */
    const zweiter = 'zweiter@' + kontakt.split('@')[1];
    await cmd('Auftrag erledigt.');
    await p.clock.runFor(1000);
    await cmd('/msg ' + zweiter);
    assert.deepEqual(await fenster(), ['[1]', '[2]', '-3-']);
    await cmd('Auftrag erledigt.');
    await p.clock.runFor(7500);
    assert.match(await verlauf.textContent(), /zweiter@\S+: Verstanden\.$/);
    assert.deepEqual(await fenster(), ['[1]*', '[2]*', '-3-'], 'die Antwort in Fenster 2 kommt trotz der zweiten Meldung; cons_alert markiert die Konsole');
    await cmd('/win 2');
    assert.equal((await verlauf.textContent()).match(/: Verstanden\./g).length, 2, 'Fenster 2: erste und zweite Antwort');
    // im OMEMO-Gespräch tragen Nachrichten das omemo.char '~'
    assert.match(await verlauf.textContent(), /\d\d:\d\d:\d\d ~ me: Auftrag erledigt\.\n[\s\S]*\d\d:\d\d:\d\d ~ \S+: Verstanden\.$/);

    /* Abbruch: Lost connection. genau einmal in Konsole und Gespräch, keine Modemzeile; Präsenz offline; Fenster bleiben wechselbar */
    await p.evaluate(() => terminalPppShell('poff', '', []));
    await p.clock.runFor(1000);
    assert.match(await verlauf.textContent(), /: Verstanden\.\n\d\d:\d\d:\d\d - Lost connection\.$/);
    assert.doesNotMatch(await verlauf.textContent(), /Disconnected/);
    assert.doesNotMatch(await verlauf.textContent(), /pppd:/);
    assert.equal(await titel.textContent(), kontakt + ' [OMEMO][offline]');
    // cons_show_error setzt den Konsolenhinweis; win_println in den übrigen Fenstern setzt keinen
    assert.deepEqual(await fenster(), ['[1]*', '-2-', '[3]']);
    await cmd('/win 1');
    assert.match(await verlauf.textContent(), /logged in successfully[\s\S]*<< chat message: \S+ \(win 2\)[\s\S]*Window 3 does not exist\.\n[\s\S]*Lost connection\.$/);
    assert.equal((await verlauf.textContent()).match(/Lost connection\./g).length, 1, 'je Fenster genau eine Meldung');
    await cmd('/win 3');
    assert.equal((await verlauf.textContent()).match(/Lost connection\./g).length, 1, 'Fenster 3: genau eine Meldung');
    await cmd('/quit');
    assert.deepEqual([await titel.isVisible(), await status.isVisible()], [false, false], 'nach /quit keine profanity-Zeilen');
    assert.deepEqual(errors, []);
    console.log('OK: profanity-Fenster (Console, Gespräch, /win, Titel- und Statuszeile)');
  } finally { await b.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
