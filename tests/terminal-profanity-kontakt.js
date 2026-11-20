/* Fester Kontakt im Profil: einmal erzeugt, danach bei jedem Start von profanity und nach einem Neuladen derselbe.
   Profanity 0.18.2 merkt sich OMEMO je Kontakt (accounts_add_omemo_state, Vorgabe omemo.policy automatic): beim nächsten
   Öffnen des Gesprächs startet chatwin_new OMEMO still; die Sitzung (session_store) besteht dann schon, Nachrichten gehen
   sofort verschlüsselt hinaus, kein zweites "ready". /omemo end nimmt den Kontakt wieder heraus. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { APP } = require('./_pfad');
const { chatBereit, bis } = require('./_kestrel');

(async () => {
  const b = await chromium.launch();
  try {
    const ctx = await b.newContext({ reducedMotion: 'reduce' });
    const p = await ctx.newPage();
    p.setDefaultTimeout(12000);
    const errors = [];
    p.on('pageerror', e => errors.push(e.message));
    await p.route(/^https?:/, r => r.abort());
    const anmelden = async () => {
      await p.fill('#gate-pw', 'pw-test-123');
      if (await p.isVisible('#gate-pw2')) await p.fill('#gate-pw2', 'pw-test-123');
      await p.click('#gate-go'); await p.click('#profil-terminal-oeffnen');
    };
    await p.goto(APP); await anmelden();
    await chatBereit(p, { kontakt: false });
    await p.clock.pauseAt(await p.evaluate(() => Date.now() + 1000));
    const inp = p.locator('#profil-terminal-eingabe'), verlauf = p.locator('#profil-terminal-chat'), titel = p.locator('#profil-terminal-xmpp-titel');
    const cmd = async z => { await inp.fill(z); await inp.press('Enter'); await p.clock.runFor(1); };
    const kontakt = await p.evaluate(() => TERMINAL_ZUSTAND.kanal.vorschlag);
    assert.match(kontakt, /^[a-z]{14}@[a-z2-7]{56}\.onion$/);

    /* Neuladen gleich nach dem ersten Start, ohne OMEMO oder einen anderen Speichervorgang: derselbe Kontakt */
    const neuLaden = async () => {
      await p.clock.resume();
      await p.reload(); await anmelden();
      await chatBereit(p, { kontakt: false });
      await p.clock.pauseAt(await p.evaluate(() => Date.now() + 1000));
    };
    await neuLaden();
    assert.equal(await p.evaluate(() => TERMINAL_ZUSTAND.kanal.vorschlag), kontakt, 'Kontakt beim Erzeugen gespeichert');

    /* OMEMO einmal starten: Sitzung entsteht (ready), der Kontakt ist für OMEMO gemerkt */
    await cmd('/msg ' + kontakt);
    await cmd('/omemo start');
    await p.clock.runFor(3100);
    assert.match(await verlauf.textContent(), / \(device \d+\) ready\.$/);

    /* profanity neu starten: derselbe Kontakt; das Gespräch öffnet mit OMEMO, still, ohne Initiating und ohne ready */
    await cmd('/quit');
    await inp.fill('profanity'); await inp.press('Enter');
    await bis(p, () => TERMINAL_ZUSTAND.kanal?.phase === 'eingabe');
    assert.equal(await p.evaluate(() => TERMINAL_ZUSTAND.kanal.vorschlag), kontakt);
    await cmd('/msg ' + kontakt);
    assert.equal(await titel.textContent(), kontakt + ' [OMEMO][online]');
    await cmd('Lage unverändert.');
    await p.clock.runFor(3100);
    assert.match(await verlauf.textContent(), /^\d\d:\d\d:\d\d ~ me: Lage unverändert\.$/, 'Sitzung besteht: sofort verschlüsselt, keine Hinweiszeile');

    /* Neu laden: Kontakt und OMEMO-Zustand bleiben (Profil) */
    await neuLaden();
    assert.equal(await p.evaluate(() => TERMINAL_ZUSTAND.kanal.vorschlag), kontakt);
    await cmd('/msg ' + kontakt);
    assert.equal(await titel.textContent(), kontakt + ' [OMEMO][online]');
    await cmd('/omemo start');
    assert.match(await verlauf.textContent(), /! You are already in an OMEMO session\.$/);

    /* /omemo end: beim nächsten Öffnen ohne OMEMO */
    await cmd('/omemo end');
    await cmd('/quit');
    await inp.fill('profanity'); await inp.press('Enter');
    await bis(p, () => TERMINAL_ZUSTAND.kanal?.phase === 'eingabe');
    await cmd('/msg ' + kontakt);
    assert.equal(await titel.textContent(), kontakt + '[online]');
    /* erneut /omemo start: die Sitzung besteht schon, deshalb nur Initiating, kein ready */
    await cmd('/omemo start');
    await p.clock.runFor(3100);
    assert.match(await verlauf.textContent(), /^\d\d:\d\d:\d\d ! Initiating OMEMO session with \S+\.\.\.$/);

    /* Profil leeren bei offenem Chat, während eine OMEMO-Sitzung aufgebaut wird: profanity endet samt Timern (wie /quit),
       die PPP-Verbindung bleibt; kein spätes ready, die Sitzung des verworfenen Kontakts wird nicht wieder gespeichert. */
    const zweiter = 'zweiter@' + kontakt.split('@')[1];
    await cmd('/msg ' + zweiter);
    await cmd('/omemo start');
    assert.equal(await p.evaluate(() => !!TERMINAL_ZUSTAND.kanal.fenster.at(-1).omemoAufbau), true);
    await p.evaluate(() => dispatch({ type: 'PROFIL_LEEREN' }));
    assert.equal(await p.evaluate(() => TERMINAL_ZUSTAND.kanal), null, 'profanity beendet');
    assert.equal(await p.evaluate(() => TERMINAL_ZUSTAND.modem?.phase), 'up', 'PPP bleibt');
    await p.clock.runFor(3100);
    assert.equal(await p.evaluate(() => PROFIL.xmpp), null, 'nichts wieder gespeichert');
    await neuLaden();
    const neu = await p.evaluate(() => TERMINAL_ZUSTAND.kanal.vorschlag);
    assert.notEqual(neu, kontakt, 'nach dem Leeren ein neuer Kontakt');
    assert.deepEqual(await p.evaluate(() => [Object.keys(PROFIL.xmpp.omemo), PROFIL.xmpp.sitzungen]), [[], []]);
    await cmd('/msg ' + neu);
    assert.equal(await titel.textContent(), neu + '[online]');
    assert.deepEqual(errors, []);
    console.log('OK: fester Kontakt im Profil, OMEMO je Kontakt gemerkt, Sitzung bleibt');
  } finally { await b.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
