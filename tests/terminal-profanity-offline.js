/* Offline-Zustellung (XEP-0160 Speicherung beim Server, XEP-0203 Verzögerungsvermerk), wie Profanity 0.18.2 sie anzeigt:
   Die Antwort des Kontakts hängt nicht am Chatfenster. Bricht der Link vor der Antwort ab, bleibt sie beim Server und
   erscheint nach der nächsten Anmeldung genau einmal im Gespräch des Kontakts: sv_ev_incoming_message öffnet dafür ein
   Fenster (chatwin_new, OMEMO still, falls gemerkt); die Zeile trägt die Sendezeit (stanza_get_oldest_delay), die
   Konsole meldet "<< chat message: <jid> (win N)". */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { APP } = require('./_pfad');
const { chatBereit, bis, schnelleWahl } = require('./_kestrel');

(async () => {
  const b = await chromium.launch();
  try {
    const ctx = await b.newContext({ reducedMotion: 'reduce' });
    const p = await ctx.newPage();
    p.setDefaultTimeout(15000);
    const errors = [];
    p.on('pageerror', e => errors.push(e.message));
    await p.route(/^https?:/, r => r.abort());
    const anmelden = async () => {
      await p.fill('#gate-pw', 'pw-test-123');
      if (await p.isVisible('#gate-pw2')) await p.fill('#gate-pw2', 'pw-test-123');
      await p.click('#gate-go'); await p.click('#profil-terminal-oeffnen');
    };
    await p.goto(APP); await anmelden();
    await schnelleWahl(p);
    await chatBereit(p);
    await p.clock.pauseAt(await p.evaluate(() => Date.now() + 1000));
    const inp = p.locator('#profil-terminal-eingabe'), verlauf = p.locator('#profil-terminal-chat');
    const status = p.locator('#profil-terminal-xmpp-status');
    const cmd = async z => { await inp.fill(z); await inp.press('Enter'); await p.clock.runFor(1); };
    const fenster = () => status.locator('.xmpp-fenster').evaluateAll(l => l.map(e => e.textContent + (e.classList.contains('neu') ? '*' : '')));
    const kontakt = await p.evaluate(() => TERMINAL_ZUSTAND.kanal.vorschlag);
    const esc = x => x.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

    /* Online: die Antwort kommt nach 7 s live */
    await cmd('Auftrag erledigt.');
    await p.clock.runFor(7000);
    assert.match(await verlauf.textContent(), new RegExp(' - ' + esc(kontakt) + ': Verstanden\\.$'));

    /* Link bricht 2 s nach der Meldung ab: keine Antwort im Chat, sie liegt beim Server */
    await cmd('Auftrag gescheitert.');
    const gesendet = await p.evaluate(() => Date.now());
    await p.clock.runFor(2000);
    await p.evaluate(() => terminalPppModemAus('Modem hangup (NO CARRIER)', true, true));
    await p.clock.runFor(8000);
    assert.equal((await verlauf.textContent()).match(/Verstanden\./g).length, 1, 'offline keine zweite Antwort');
    assert.equal(await p.evaluate(() => PROFIL.xmpp.ausstehend.length), 1);
    const sendezeit = await p.evaluate(ms => terminalPppZeit(ms + 7000), gesendet);

    /* profanity beenden; pppd wählt (persist) neu; neue Anmeldung: die Antwort kommt genau einmal, im neuen Fenster 2 */
    await cmd('/quit');
    await bis(p, () => TERMINAL_ZUSTAND.modem?.phase === 'up');
    await cmd('profanity');
    await bis(p, () => TERMINAL_ZUSTAND.kanal?.phase === 'eingabe');
    await p.clock.runFor(1000);
    assert.deepEqual(await fenster(), ['-1-', '[2]*'], 'sv_ev_incoming_message öffnet das Gespräch');
    assert.match(await verlauf.textContent(), new RegExp('logged in successfully, online \\(priority 0\\)\\.\\n\\d\\d:\\d\\d:\\d\\d - << chat message: ' + esc(kontakt) + ' \\(win 2\\)$'));
    await cmd('/win 2');
    assert.equal(await verlauf.textContent(), sendezeit + ' - ' + kontakt + ': Verstanden.', 'Zeile mit der Sendezeit (Verzögerungsvermerk)');
    assert.equal(await p.evaluate(() => PROFIL.xmpp.ausstehend.length), 0);
    await p.clock.runFor(30000);
    assert.equal((await verlauf.textContent()).match(/Verstanden\./g).length, 1, 'genau einmal');

    /* Neu laden und anmelden: nichts wird ein zweites Mal zugestellt */
    await p.clock.resume();
    await p.reload(); await anmelden();
    await chatBereit(p, { kontakt: false });
    await p.clock.pauseAt(await p.evaluate(() => Date.now() + 1000));
    await p.clock.runFor(2000);
    assert.deepEqual(await fenster(), ['-1-'], 'keine erneute Zustellung');
    assert.deepEqual(errors, []);
    console.log('OK: Offline-Zustellung (Antwort überlebt den Abbruch, einmal nach der nächsten Anmeldung, Sendezeit)');
  } finally { await b.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
