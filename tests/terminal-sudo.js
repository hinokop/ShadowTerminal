/* sudo vor map und open: Kennwort nur, wenn das Ziel manuell gesperrt ist (Pin über sein Dossier). Prompt
   "[sudo] password for raizo:", kein Echo, nichts im Eingabefeld, Verlauf, Vorschlag, in der Ausgabe oder im Speicher.
   Drei Versuche (sudo: passwd_tries), "Sorry, try again." und "sudo: 3 incorrect password attempts"; das Ziel bleibt
   gesperrt. Strg+C: nur der Zeilenumbruch, Rückgabewert 130. Richtiges Kennwort: entsperrt wie die Oberfläche
   (DOSSIER_ENTSPERREN), dann Navigation. Die Freigabe durch den Ansprechpartner ersetzt sudo nicht. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { APP } = require('./_pfad');

(async () => {
  const b = await chromium.launch();
  try {
    const p = await b.newPage({ viewport: { width: 1500, height: 1000 }, reducedMotion: 'reduce' });
    p.setDefaultTimeout(15000);
    const errors = [];
    p.on('pageerror', e => errors.push(e.message));
    await p.route(/^https?:/, r => r.abort());
    await p.goto(APP);
    await p.fill('#gate-pw', 'pw-test-123');
    if (await p.isVisible('#gate-pw2')) await p.fill('#gate-pw2', 'pw-test-123');
    await p.click('#gate-go');
    await p.waitForFunction(() => !document.body.classList.contains('locked'));
    const z = await p.evaluate(() => {
      const neu = name => { dispatch({ type: 'DOSSIER_ANGELEGT', name, typ: 'Person' }); return STATE.dossiers.eigene.find(x => x.name === name).id; };
      const frei = neu('Quellner Ida'), zu = neu('Quarzfeld Testmann'), zwei = neu('Sorbinger Kai');
      dispatch({ type: 'PIN_ANGELEGT', ll: [52.52, 13.405], name: 'Kühlhaus Quellweg', dossier: zu });
      const pin = PROFIL.pins.at(-1).id;
      dispatch({ type: 'DOSSIER_SPERREN', id: zu }); dispatch({ type: 'DOSSIER_SPERREN', id: zwei });
      dispatch({ type: 'NAVIGATION', modul: 'profil' }); renderModule();
      return { frei, zu, zwei, pin };
    });
    await p.click('#profil-terminal-oeffnen');
    const inp = p.locator('#profil-terminal-eingabe'), out = p.locator('#profil-terminal-ausgabe'), prompt = p.locator('#profil-terminal-prompt');
    const cmd = async zeile => { await inp.fill(zeile); await inp.press('Enter'); await p.waitForFunction(() => !TERMINAL_ZUSTAND.kette); };
    const starten = async zeile => { await inp.fill(zeile); await inp.press('Enter'); await p.waitForFunction(() => !!TERMINAL_ZUSTAND.sudo && !TERMINAL_ZUSTAND.sudo.pruefen); };
    const zeilen = async n => (await out.textContent()).split('\n').slice(-n);
    const status = async () => { await cmd('echo $?'); return (await zeilen(1))[0]; };
    const gesperrt = id => p.evaluate(i => PROFIL.gesperrt.includes(i), id);
    const ansicht = () => p.evaluate(() => ({ modul: STATE.ui.modul, auswahl: STATE.ui.modul === 'karte' ? VIEW.karte.auswahl : STATE.dossiers.auswahl }));
    const zurueck = async () => { assert.equal(await p.evaluate(() => document.getElementById('profil-terminal').classList.contains('minimiert')), true); await p.click('#profil-terminal-minimieren'); };
    const PROMPT = '[sudo] password for raizo:';
    const geheim = async text => {
      await inp.focus(); await p.keyboard.type(text);
      assert.equal(await inp.inputValue(), '', 'kein Echo im Feld');
      assert.equal(await p.evaluate(() => document.getElementById('profil-terminal-vorschlag').textContent), '', 'kein Overlay');
    };

    /* Ohne Sperre keine Abfrage; übrige Befehle laufen unter sudo unverändert */
    await cmd('sudo open ' + z.frei);
    assert.deepEqual(await ansicht(), { modul: 'dossier', auswahl: z.frei });
    await zurueck();
    assert.doesNotMatch(await out.textContent(), /\[sudo\]/);
    await cmd('sudo whoami'); assert.equal((await zeilen(1))[0], 'raizo');
    await cmd('sudo'); assert.equal((await zeilen(10))[0], 'usage: sudo -h | -K | -k | -V'); assert.equal(await status(), '1');
    await cmd('sudo nope'); assert.equal((await zeilen(1))[0], 'sudo: nope: command not found'); assert.equal(await status(), '1');
    await cmd('sudo open P-9999'); assert.equal((await zeilen(1))[0], 'open: P-9999: No such file or directory');
    await p.evaluate(() => { dispatch({ type: 'NAVIGATION', modul: 'profil' }); renderModule(); });

    /* Drei Fehlversuche: bleibt gesperrt, keine Navigation */
    await starten('sudo open ' + z.zu);
    assert.equal(await prompt.textContent(), PROMPT);
    for (const [i, falsch] of ['geheim1', 'falsch2', 'falsch3'].entries()) {
      await geheim(falsch);
      await inp.press('Enter');
      if (i < 2) {
        await p.waitForFunction(() => TERMINAL_ZUSTAND.sudo && !TERMINAL_ZUSTAND.sudo.pruefen);
        assert.deepEqual(await zeilen(2), [PROMPT + ' ', 'Sorry, try again.']);
        assert.equal(await prompt.textContent(), PROMPT);
      }
    }
    await p.waitForFunction(() => !TERMINAL_ZUSTAND.kette);
    assert.deepEqual(await zeilen(2), [PROMPT + ' ', 'sudo: 3 incorrect password attempts']);
    assert.equal(await status(), '1');
    assert.equal(await gesperrt(z.zu), true);
    assert.equal((await ansicht()).modul, 'profil');
    assert.equal(await prompt.textContent(), 'raizo@terminal:/$');

    /* Strg+C: Zeilenumbruch ohne ^C, 130, bleibt gesperrt */
    await starten('sudo map ' + z.pin);
    await geheim('abc');
    await inp.press('Control+c');
    await p.waitForFunction(() => !TERMINAL_ZUSTAND.kette);
    assert.equal((await zeilen(1))[0], PROMPT + ' ');
    assert.equal(await status(), '130');
    assert.equal(await gesperrt(z.zu), true);

    /* Rücktaste und Strg+U wirken auf das verdeckte Kennwort; richtig: entsperrt, Pin angesprungen */
    await starten('sudo map ' + z.pin);
    await geheim('xyz'); await inp.press('Control+u');
    await geheim('pw-test-12X'); await inp.press('Backspace'); await geheim('3');
    await inp.press('Enter');
    await p.waitForFunction(() => !TERMINAL_ZUSTAND.kette);
    assert.equal(await gesperrt(z.zu), false, 'über das Dossier des Pins entsperrt');
    assert.deepEqual(await ansicht(), { modul: 'karte', auswahl: z.pin });
    await zurueck();
    assert.equal(await status(), '0');
    /* entsperrt bleibt entsperrt: open ohne sudo */
    await cmd('open ' + z.zu); assert.deepEqual(await ansicht(), { modul: 'dossier', auswahl: z.zu }); await zurueck();

    /* Eingefügtes Kennwort (input-Ereignis) */
    await starten('sudo open ' + z.zwei);
    await inp.evaluate(e => { e.value = 'pw-test-123'; e.dispatchEvent(new Event('input', { bubbles: true })); });
    assert.equal(await inp.inputValue(), '');
    await inp.press('Enter');
    await p.waitForFunction(() => !TERMINAL_ZUSTAND.kette);
    assert.equal(await gesperrt(z.zwei), false);
    await zurueck();

    /* Das Kennwort steht nirgends: Ausgabe, Verlauf, Seite, Speicher */
    const spuren = await p.evaluate(() => JSON.stringify([document.getElementById('profil-terminal-ausgabe').textContent, TERMINAL_ZUSTAND.verlauf, document.body.innerText,
      Object.keys(localStorage).map(k => localStorage.getItem(k)), Object.keys(sessionStorage).map(k => sessionStorage.getItem(k))]));
    assert.doesNotMatch(spuren, /geheim1|falsch2|falsch3|pw-test-12|xyz/);
    assert.deepEqual(await p.evaluate(() => TERMINAL_ZUSTAND.verlauf.filter(x => x.startsWith('sudo open') || x.startsWith('sudo map')).length > 0), true);

    /* Freigabe durch den Ansprechpartner bleibt: sudo hebt nur die manuelle Sperre auf */
    const info = await p.evaluate(() => {
      dispatch({ type: 'MISSION_ZUGEWIESEN', id: 'M1' }); dispatch({ type: 'MISSION_ANGENOMMEN', id: 'M1' });
      const e = poolAlle().find(x => !x.eigen && x.typ === 'Person' && wissen(x) === 'unbekannt');
      IZ()[e.id] = { status: 'bekannt' };
      dispatch({ type: 'DOSSIER_SPERREN', id: e.id }); dispatch({ type: 'NAVIGATION', modul: 'profil' }); renderModule();
      return { id: e.id, wissen: wissen(e), info: infoGesperrt(e) };
    });
    assert.deepEqual([info.wissen, info.info], ['bekannt', true]);
    await starten('sudo open ' + info.id);
    await geheim('pw-test-123'); await inp.press('Enter');
    await p.waitForFunction(() => !TERMINAL_ZUSTAND.kette);
    assert.equal(await gesperrt(info.id), false);
    assert.deepEqual(await ansicht(), { modul: 'dossier', auswahl: info.id });
    assert.deepEqual(await p.evaluate(i => [wissen(entitaet(i)), infoGesperrt(entitaet(i)), (STATE.infozugang || {})[i]?.status], info.id), ['bekannt', true, 'bekannt'], 'Freigabe unverändert');
    assert.deepEqual(errors, []);
    console.log('OK: sudo (Kennwort nur bei Sperre, verdeckt, drei Versuche, Strg+C, Freigabe bleibt)');
  } finally { await b.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
