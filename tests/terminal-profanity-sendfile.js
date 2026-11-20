/* profanity /sendfile wie Profanity 0.18.2 (cmd_sendfile, iq_http_upload_request, http_file_put): Prüfreihenfolge Datei,
   Verbindung, Fenster; Slot-Anfrage; eine Statuszeile "Uploading '<datei>': N%" an derselben Stelle bis "done";
   danach die URL als gewöhnliche Nachricht (OMEMO: aesgcm://…#IV+Schlüssel, Zeichen '~'); scheitert der Versand der URL
   (OMEMO ohne Bundle), bleibt der Upload "done"; Abbruch bei LOS mit curl-Fehler; Prosodys Größengrenze.
   Dazu die Eingabemeldungen desselben Pfads (Unknown command, Invalid usage, nicht verbunden). */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { APP } = require('./_pfad');
const { chatBereit } = require('./_kestrel');

(async () => {
  const b = await chromium.launch();
  try {
    const p = await b.newPage({ reducedMotion: 'reduce' });
    p.setDefaultTimeout(12000);
    const errors = [];
    p.on('pageerror', e => errors.push(e.message));
    // Brücke: Dateien im Ordner ops; "gross.bin" über Prosodys 10 MiB; "ordner" ist ein Verzeichnis.
    const dateien = { 'bericht final.txt': 4200, 'kurz.txt': 40, 'gross.bin': 11 * 1024 * 1024, 'lang.bin': 9 * 1024 * 1024 };
    await p.route(/^https?:/, async r => {
      const req = r.request();
      if (req.url() !== 'http://127.0.0.1:45678/db') return r.abort();
      const d = req.postDataJSON(), name = d.parts?.at(-1);
      if (d.op === 'send' && name === 'ordner') return r.fulfill({ json: { notfile: true } });
      if (d.op === 'send') return r.fulfill({ json: name in dateien ? { name, bytes: dateien[name] } : { error: 'Datei oder Ordner nicht gefunden' } });
      return r.fulfill({ json: { entries: [] } });
    });
    await p.goto(APP + '#db=45678.' + 'a'.repeat(43));
    await p.fill('#gate-pw', 'pw-test-123');
    if (await p.isVisible('#gate-pw2')) await p.fill('#gate-pw2', 'pw-test-123');
    await p.click('#gate-go'); await p.click('#profil-terminal-oeffnen');
    await chatBereit(p, { kontakt: false });
    await p.clock.pauseAt(await p.evaluate(() => Date.now() + 1000));
    const inp = p.locator('#profil-terminal-eingabe'), verlauf = p.locator('#profil-terminal-chat');
    const status = p.locator('#profil-terminal-xmpp-status');
    const cmd = async z => { await inp.fill(z); await inp.press('Enter'); await p.waitForFunction(() => !TERMINAL_ZUSTAND.kanal?.pruefung); await p.clock.runFor(1); };
    const text = () => verlauf.textContent();
    const fenster = () => status.locator('.xmpp-fenster').evaluateAll(l => l.map(e => e.textContent + (e.classList.contains('neu') ? '*' : '')));
    const chat = await p.evaluate(() => ({ domain: TERMINAL_ZUSTAND.kanal.domain, kontakt: TERMINAL_ZUSTAND.kanal.vorschlag }));
    const esc = x => x.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
    const Z = '\\d\\d:\\d\\d:\\d\\d';
    const D = '/pgcl-eu3.arch07/ops/';

    /* Konsole: unbekannter Befehl und Text, Invalid usage, Prüfreihenfolge von cmd_sendfile */
    await cmd('/foo bar baz');
    assert.match(await text(), new RegExp(Z + ' - Unknown command: /foo bar baz$'));
    await cmd('hallo zusammen');
    assert.match(await text(), new RegExp(Z + ' - Unknown command: hallo zusammen$'));
    await cmd('/sendfile');
    assert.match(await text(), new RegExp('\\n' + Z + ' - \\n' + Z + " - Invalid usage, see '/help sendfile' for details\\.$"));
    await cmd('/sendfile ' + D + 'fehlt.txt');
    assert.match(await text(), new RegExp(Z + " - Uploading '" + esc(D) + "fehlt\\.txt' failed: File not found!$"));
    await cmd('/sendfile ' + D + 'ordner');
    assert.match(await text(), new RegExp(Z + " - Uploading '" + esc(D) + "ordner' failed: Not a file!$"));
    await cmd('/sendfile ' + D + 'kurz.txt');
    assert.match(await text(), new RegExp(Z + ' - Unsupported window for file transmission\\.$'));
    assert.doesNotMatch(await text(), /Uploading '[^']*kurz/);

    /* /msg mit Nachricht: Fenster öffnen und gleich senden */
    await cmd('/msg ' + chat.kontakt + ' Lage unverändert.');
    assert.deepEqual(await fenster(), ['[1]', '-2-']);
    assert.match(await text(), new RegExp('^' + Z + ' - me: Lage unverändert\\.$'));

    /* Upload ohne OMEMO: Slot-Anfrage (2 s), eine Statuszeile mit '!', fortgeschrieben bis done; Nachrichten bleiben möglich */
    await cmd('/sendfile "' + D + 'bericht final.txt"');
    assert.doesNotMatch(await text(), /Uploading/, 'erst nach der Slot-Anfrage');
    await p.clock.runFor(2000);
    const name = esc(D + 'bericht final.txt');
    assert.match(await text(), new RegExp(Z + " ! Uploading '" + name + "': 0%$"));
    await cmd('Auftrag erledigt.');
    await p.clock.runFor(7100);
    assert.match(await text(), new RegExp("Uploading '" + name + "': [1-9]\\d?%\\n" + Z + ' - me: Auftrag erledigt\\.\\n' + Z + ' - ' + esc(chat.kontakt) + ': Verstanden\\.$'));
    await p.clock.runFor(8000); // 4200 B bei 2400 bit/s: 14 s
    const fertig = await text();
    assert.equal(fertig.match(/Uploading '/g).length, 1, 'eine Statuszeile, an derselben Stelle fortgeschrieben');
    assert.match(fertig, new RegExp("Uploading '" + name + "': done\\n"));
    const url = new RegExp(Z + ' - me: http://upload\\.' + esc(chat.domain) + '/file_share/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/bericht%20final\\.txt$');
    assert.match(fertig, url);

    /* OMEMO vor "ready": der Upload wird done, die URL geht aber nicht hinaus */
    await cmd('/omemo start');
    await cmd('/sendfile ' + D + 'kurz.txt');
    await p.clock.runFor(2500);
    assert.match(await text(), new RegExp("! Uploading '" + esc(D) + "kurz\\.txt': done\\n" + Z + ' ! This message cannot be encrypted for any recipient\\.\\n' +
      Z + ' ! It could also be that key bundles have not been received\\. Try "/omemo end", then "/omemo start"\\.$'));
    await p.clock.runFor(1000);
    assert.match(await text(), /\(device \d+\) ready\.$/);

    /* OMEMO mit Sitzung: aesgcm-URL mit 88 Hex-Zeichen (12 Byte IV, 32 Byte Schlüssel), Zeichen '~' */
    await cmd('/sendfile ' + D + 'kurz.txt');
    await p.clock.runFor(2500);
    assert.match(await text(), new RegExp(Z + ' ~ me: aesgcm://upload\\.' + esc(chat.domain) + '/file_share/[0-9a-f-]{36}/kurz\\.txt#[0-9a-f]{88}$'));

    /* Größengrenze des Upload-Dienstes (Prosody, 10 MiB): Fehler der Slot-Anfrage in der Konsole, keine Statuszeile */
    const vorher = (await text()).match(/Uploading '/g).length;
    await cmd('/sendfile ' + D + 'gross.bin');
    await p.clock.runFor(2000);
    assert.equal((await text()).match(/Uploading '/g).length, vorher);
    assert.deepEqual(await fenster(), ['[1]*', '-2-'], 'cons_show_error markiert die Konsole');
    await cmd('/win 1');
    assert.match(await text(), new RegExp(Z + " - Uploading '" + esc(D) + "gross\\.bin' failed for upload\\." + esc(chat.domain) + ': File too large$'));
    await cmd('/win 2');

    /* LOS mitten im Upload: Statuszeile "failed: <curl>", dieselbe Meldung in der Konsole, dann Lost connection. */
    await cmd('/sendfile ' + D + 'lang.bin');
    await p.clock.runFor(2000 + 5000);
    assert.match(await text(), new RegExp("Uploading '" + esc(D) + "lang\\.bin': \\d+%$"));
    await p.evaluate(() => terminalPppModemAus('Modem hangup (NO CARRIER)', true, true)); // wie beim LOS
    await p.clock.runFor(800);
    assert.match(await text(), new RegExp("! Uploading '" + esc(D) + "lang\\.bin' failed: Failed sending data to the peer\\n" + Z + ' - Lost connection\\.$'));
    assert.doesNotMatch(await text(), /lang\.bin': \d+%/, 'die Statuszeile ist ersetzt, nicht ergänzt');
    await p.clock.runFor(70000);
    assert.doesNotMatch(await text(), /lang\.bin': done|lang\.bin\n/, 'nach dem Abbruch geht nichts mehr hinaus');

    /* Ohne Verbindung: Datei zuerst geprüft, dann "not connected" in der Konsole; Text im Gespräch, /msg, /omemo */
    await cmd('/sendfile ' + D + 'fehlt.txt');
    await cmd('/sendfile ' + D + 'kurz.txt');
    await cmd('Hallo?');
    assert.match(await text(), new RegExp(Z + ' - You are not currently connected\\.$'));
    await cmd('/msg ' + chat.kontakt);
    await cmd('/omemo fingerprint');
    await cmd('/win 1');
    assert.match(await text(), new RegExp("Lost connection\\.\\n" + Z + " - Uploading '" + esc(D) + "fehlt\\.txt' failed: File not found!\\n" +
      Z + ' - You are not currently connected\\.\\n' + Z + ' - You are not currently connected\\.\\n' +
      Z + ' - You must be connected with an account to load OMEMO information\\.$'));
    assert.deepEqual(errors, []);
    console.log('OK: profanity /sendfile (Prüfreihenfolge, Statuszeile, URL, OMEMO, Größengrenze, Abbruch, Eingabemeldungen)');
  } finally { await b.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
