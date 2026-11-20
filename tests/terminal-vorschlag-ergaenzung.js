/* Vorschlag aus der Ergänzung wie zsh-autosuggestions mit ZSH_AUTOSUGGEST_STRATEGY=(history completion): zuerst der
   Verlauf; findet er nichts, der erste Treffer der Tab-Ergänzung (compstate[insert]=1, Treffer sortiert), nur wenn er die
   Eingabe genau fortsetzt (matcher-list ''). Strg+→ übernimmt auch diesen Vorschlag wortweise. Die Brücke wird je Ordner
   nur einmal gefragt. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { APP } = require('./_pfad');

(async () => {
  const b = await chromium.launch();
  try {
    const p = await b.newPage({ reducedMotion: 'reduce' });
    p.setDefaultTimeout(12000);
    const errors = [], ls = [];
    p.on('pageerror', e => errors.push(e.message));
    await p.route(/^https?:/, async r => {
      const req = r.request();
      if (req.url() !== 'http://127.0.0.1:45678/db') return r.abort();
      const d = req.postDataJSON();
      if (d.op === 'ls') ls.push(d.parts.join('/'));
      const ordner = { '': [{ name: 'dossiers', dir: true }, { name: 'dokumente', dir: true }, { name: 'ops', dir: true }],
        'dokumente': [{ name: 'lageblatt.txt', dir: false }, { name: 'referenz material.txt', dir: false }] };
      await r.fulfill({ json: d.op === 'ls' ? { entries: ordner[d.parts.join('/')] || [] } : { error: 'nicht vorgesehen' } });
    });
    await p.goto(APP + '#db=45678.' + 'a'.repeat(43));
    await p.fill('#gate-pw', 'pw-test-123');
    if (await p.isVisible('#gate-pw2')) await p.fill('#gate-pw2', 'pw-test-123');
    await p.click('#gate-go'); await p.click('#profil-terminal-oeffnen');
    await p.waitForFunction(() => !TERMINAL_ZUSTAND.dateiLaeuft);
    const inp = p.locator('#profil-terminal-eingabe'), geist = p.locator('#profil-terminal-vorschlag');
    const tippen = async z => { await inp.fill(''); await inp.focus(); await p.keyboard.type(z); };
    const rest = async () => (await geist.locator('.rest').count()) ? geist.locator('.rest').textContent() : null;
    const restIst = async erwartet => { await p.waitForFunction(e => (document.querySelector('#profil-terminal-vorschlag .rest')?.textContent ?? null) === e, erwartet); };
    const strg = () => p.keyboard.press('Control+ArrowRight');
    assert.deepEqual(await p.evaluate(() => TERMINAL_ZUSTAND.verlauf), [], 'kein Verlauf');

    /* Befehl und predict-Optionen ohne Verlauf; Strg+→ übernimmt wortweise und der nächste Vorschlag folgt */
    await tippen('pre');
    await restIst('dict ');
    await strg(); assert.equal(await inp.inputValue(), 'predict ');
    await restIst('-t ');
    // forward-word: vor "-t" keine Wortzeichen, dann das Nicht-Wortzeichen "-" überspringen -> vor "t"
    await strg(); assert.equal(await inp.inputValue(), 'predict -');
    await strg(); assert.equal(await inp.inputValue(), 'predict -t ');
    await restIst('/var/cache/tle/kestrel.tle ');
    await p.keyboard.press('ArrowRight'); assert.equal(await inp.inputValue(), 'predict -t /var/cache/tle/kestrel.tle ');

    /* Pfade über die Brücke: erster Treffer in Sortierreihenfolge (dokumente vor dossiers); je Ordner eine Anfrage */
    await tippen('ls /pgcl-eu3.arch07/d');
    await restIst('okumente/');
    await p.keyboard.type('o');
    await restIst('kumente/');
    await p.keyboard.type('s');
    await restIst('siers/');
    assert.deepEqual(ls, [''], 'die Brücke wird für den Ordner nur einmal gefragt');
    await strg(); assert.equal(await inp.inputValue(), 'ls /pgcl-eu3.arch07/dossiers/');

    /* Ein Treffer, der Anführungszeichen bräuchte, setzt die Eingabe nicht genau fort: kein Vorschlag */
    await tippen('cat /pgcl-eu3.arch07/dokumente/ref');
    await p.waitForTimeout(300);
    assert.equal(await rest(), null);

    /* Der Verlauf hat Vorrang */
    await inp.fill('ls /pgcl-eu3.arch07/dossiers/'); await inp.press('Enter');
    await p.waitForFunction(() => !TERMINAL_ZUSTAND.kette);
    await tippen('ls /pgcl-eu3.arch07/d');
    assert.equal(await rest(), 'ossiers/', 'Verlauf statt Ergänzung');
    assert.deepEqual(errors, []);
    console.log('OK: Vorschlag aus der Ergänzung (history completion), Strg+→ darauf');
  } finally { await b.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
