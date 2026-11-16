const { vorbereiten } = require('./_satcon');
/* Die statische Tab-Vervollständigung beweist keine Verbindung. Browserfehler und Abmeldung erklären den richtigen Neustart. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const PF = require('./_pfad');

(async () => {
  const b = await chromium.launch();
  try {
    const p = await b.newPage({ reducedMotion: 'reduce' });
    const antworten = [];
    await p.route(/^http:\/\/127\.0\.0\.1:3847[12]\/db$/, async r => {
      const { op, parts } = r.request().postDataJSON();
      antworten.push(op);
      if (new URL(r.request().url()).port === '38471') return r.abort('connectionrefused');
      assert.equal(r.request().headers()['x-shadow-token'], 'b'.repeat(43));
      const data = op === 'ls' && parts.length === 1 ? { entries: [{ name: 'Ablaufplan.docx', dir: false }] } :
        op === 'ls' ? { entries: [{ name: 'dokumente', dir: true }] } :
        op === 'send' ? { name: 'Ablaufplan.docx', bytes: 13 } : { ok: true };
      return r.fulfill({ json: data });
    });
    await p.goto(PF.APP + '#db=38471.' + 'a'.repeat(43));
    await p.locator('#gate-pw').fill('pw-test-123');
    if (await p.locator('#gate-pw2').isVisible()) await p.locator('#gate-pw2').fill('pw-test-123');
    await p.locator('#gate-go').click();
    await p.locator('#profil-terminal > summary').click();
    const inp = p.locator('#profil-terminal-eingabe'), out = p.locator('#profil-terminal-ausgabe');
    async function taste(wert, key) { await inp.fill(wert); await inp.press(key); }
    const erwartet = async wert => p.waitForFunction(wert => $('profil-terminal-eingabe').value === wert, wert);
    const ausgabe = async wert => p.waitForFunction(wert => $('profil-terminal-ausgabe').textContent.includes(wert), wert);
    await vorbereiten(p);
    await taste('secure-channel --connect --onion --ephemeral', 'Enter');
    await p.waitForFunction(() => $('profil-terminal-prompt').textContent === 'you >');
    const prefix = 'send /pgcl-eu3.arch07/';
    await taste('send pg', 'Tab');
    await erwartet(prefix);
    assert.deepEqual(antworten, []);
    await taste(prefix + 'doc', 'Tab');
    await ausgabe('Tab: Lokale Datenbank nicht erreichbar.');
    assert.match(await out.textContent(), /START_TERMINAL\.bat erneut.*Konsolenfenster offen/);
    const datei = prefix + 'dokumente/Ablaufplan.docx';
    await taste(datei, 'Enter');
    await ausgabe('send: Lokale Datenbank nicht erreichbar.');
    /* Der Windows-Starter kann einen neuen Port und Token im vorhandenen Fenster übergeben. */
    await p.evaluate(() => { location.hash = 'db=38472.' + 'b'.repeat(43); });
    await taste(prefix + 'do', 'Tab');
    await erwartet(prefix + 'dokumente/');
    await taste(prefix + 'dokumente/Ab', 'Tab');
    await erwartet(datei);
    await inp.press('Enter');
    await ausgabe('Kanalpuffer vollständig [13/13]');
    /* Wenn das App-Fenster nach der Abmeldung nicht geschlossen werden darf, keinen alten Port neu laden. */
    await p.evaluate(() => { window.close = function () {}; Zugang.beenden(); });
    await p.locator('#gate-end-fertig').waitFor({state:'visible'});
    assert.equal(await p.locator('#gate-reconnect').isVisible(), false);
    assert.match(await p.locator('#gate-archiv-neustart').textContent(), /START_TERMINAL\.bat erneut/);
    assert.deepEqual(antworten, ['ls','send','ls','ls','send','disconnect']);
    console.log('OK: Tab und send bei fehlender Brücke, Wiederherstellung und richtiger Neustart nach Abmeldung');
  } finally { await b.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
