/* Live-Pinsuche im Terminal und Tab-Auflösung mit stabilen Kennungen.
   Sichtbarkeit der Kartenebene verändert die Suche nicht. Gesperrte Pin-Namen und Zwecke
   gelangen weder in Trefferlisten noch in die Ergänzung; IDs bleiben auffindbar. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { APP } = require('./_pfad');

(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1500, height: 1000 }, reducedMotion: 'reduce' });
    page.setDefaultTimeout(15000);
    const fehler = [];
    page.on('pageerror', e => fehler.push(e.message));
    await page.route(/^https?:/, r => r.abort());
    await page.goto(APP);
    await page.fill('#gate-pw', 'pw-test-123');
    if (await page.isVisible('#gate-pw2')) await page.fill('#gate-pw2', 'pw-test-123');
    await page.click('#gate-go');
    await page.waitForFunction(() => !document.body.classList.contains('locked'));

    const ziel = await page.evaluate(() => {
      dispatch({ type: 'DOSSIER_ANGELEGT', name: 'Geheime Nordakte', typ: 'Person' });
      const dossier = STATE.dossiers.eigene.find(e => e.name === 'Geheime Nordakte').id;
      function pin(name, bind) {
        dispatch({ type: 'PIN_ANGELEGT', ll: [52.52 + PROFIL.pins.length * 0.0001, 13.405], name, dossier: bind });
        return PROFIL.pins.at(-1).id;
      }
      const nord = pin('Parkplatz Nord', null);
      const tor = pin('Nordtor Lagerhalle', null);
      const zu = pin('Kühlhaus Quellweg', dossier);
      const andere = pin('Birke Süd', null);
      dispatch({ type: 'DOSSIER_SPERREN', id: dossier });
      VIEW.karte.ebenen.pins = false;
      dispatch({ type: 'NAVIGATION', modul: 'profil' });
      renderModule();
      return { nord, tor, zu, andere, dossier };
    });
    await page.click('#profil-terminal-oeffnen');
    const input = page.locator('#profil-terminal-eingabe');
    const ausgabe = page.locator('#profil-terminal-ausgabe');
    const liste = page.locator('#profil-terminal-auswahl');
    async function cmd(line) {
      const alt = await ausgabe.textContent();
      await input.fill(line);
      await input.press('Enter');
      await page.waitForFunction(() => !TERMINAL_ZUSTAND.kette);
      return (await ausgabe.textContent()).slice(alt.length);
    }
    async function status() { return (await cmd('echo $?')).trim().split('\n').at(-1); }
    assert.equal(await page.evaluate(() => karteMarker().some(m => m.id === PROFIL.pins[0].id)), false,
      'Pins sind in der Karte ausgeblendet');

    /* Alle gespeicherten Pins, auch bei deaktivierter Ebene; gesperrte nur mit Kennung. */
    let txt = await cmd('map pins');
    assert.match(txt, new RegExp(ziel.nord + '\\s+Parkplatz Nord'));
    assert.match(txt, new RegExp(ziel.tor + '\\s+Nordtor Lagerhalle'));
    assert.match(txt, new RegExp(ziel.zu + '\\s+\\[LOCKED\\]'));
    assert.doesNotMatch(txt, /Kühlhaus Quellweg|Geheime Nordakte/);
    assert.equal(await status(), '0');
    assert.equal(await page.evaluate(() => document.getElementById('profil-terminal').classList.contains('minimiert')), false,
      'Suche minimiert Terminal nicht');

    txt = await cmd('map pins nord');
    assert.match(txt, /Parkplatz Nord/);
    assert.match(txt, /Nordtor Lagerhalle/);
    assert.doesNotMatch(txt, /Kühlhaus Quellweg/);
    txt = await cmd('map pins ' + ziel.zu);
    assert.match(txt, new RegExp(ziel.zu + '\\s+\\[LOCKED\\]'));
    assert.equal(await status(), '0');

    txt = await cmd('map pins kühlhaus');
    assert.match(txt, /No matches for kühlhaus/);
    assert.equal(await status(), '1');
    assert.doesNotMatch(txt, /Kühlhaus Quellweg/);

    /* Namensauflösung mittels Tab: übernommen wird ausschließlich die stabile ID. */
    await input.fill('map Park');
    await input.press('Tab');
    assert.equal(await input.inputValue(), 'map ' + ziel.nord);
    await input.fill('open Park');
    await input.press('Tab');
    assert.equal(await input.inputValue(), 'open ' + ziel.nord);
    await input.fill('sudo map Park');
    await input.press('Tab');
    assert.equal(await input.inputValue(), 'sudo map ' + ziel.nord);
    await input.fill('sudo open Park');
    await input.press('Tab');
    assert.equal(await input.inputValue(), 'sudo open ' + ziel.nord);

    /* Suchwort-Ergänzung: mehrteilige Namen werden korrekt gequotet. */
    await input.fill('map pins Nordtor');
    await input.press('Tab');
    assert.equal(await input.inputValue(), 'map pins "Nordtor Lagerhalle"');
    await input.fill('map Kühl');
    await input.press('Tab');
    assert.equal(await input.inputValue(), 'map Kühl', 'gesperrter Name nicht ergänzbar');
    assert.equal(await liste.isVisible(), false);
    await input.fill('map ' + ziel.zu.slice(0, -1));
    await input.press('Tab');
    assert.equal(await input.inputValue(), 'map ' + ziel.zu, 'gesperrte Kennung ergänzbar');

    /* Mehrere Treffer: bestehender Tab-Auswahldialog, Enter übernimmt ohne auszuführen. */
    await input.fill('map PIN-');
    await input.press('Tab');
    await liste.waitFor({ state: 'visible' });
    assert.ok((await liste.textContent()).includes(ziel.nord));
    assert.ok((await liste.textContent()).includes(ziel.zu));
    assert.doesNotMatch(await liste.textContent(), /Kühlhaus Quellweg/);
    const alt = await ausgabe.textContent();
    await input.press('Tab');
    assert.match(await input.inputValue(), /^map PIN-\d+/);
    await input.press('Enter');
    assert.equal(await liste.isVisible(), false);
    assert.equal(await ausgabe.textContent(), alt, 'Enter hat nur Kandidaten übernommen');

    /* Gesperrt bleibt gesperrt, auch wenn vorher per Tab eine Kennung ermittelt wurde. */
    await input.fill('map ' + ziel.zu);
    await input.press('Enter');
    await page.waitForFunction(() => !TERMINAL_ZUSTAND.kette);
    assert.match((await ausgabe.textContent()).split('\n').at(-1), /Permission denied/);

    /* Neue/umbenannte Pins werden ohne Neustart gefunden. */
    const neu = await page.evaluate(() => {
      dispatch({ type: 'PIN_ANGELEGT', ll: [52.5303, 13.4103], name: 'Südportal Atelier' });
      return PROFIL.pins.at(-1).id;
    });
    txt = await cmd('map pins südportal');
    assert.match(txt, new RegExp(neu + '\\s+Südportal Atelier'));
    await input.fill('open Südportal');
    await input.press('Tab');
    assert.equal(await input.inputValue(), 'open ' + neu);

    /* Nach Freigabe erscheinen Name und Navigationsvorschlag, ohne Neuladen. */
    await page.evaluate(id => dispatch({ type: 'DOSSIER_ENTSPERREN', id }), ziel.dossier);
    txt = await cmd('map pins kühlhaus');
    assert.match(txt, /Kühlhaus Quellweg/);
    await input.fill('map Kühl');
    await input.press('Tab');
    assert.equal(await input.inputValue(), 'map ' + ziel.zu);
    assert.deepEqual(fehler, []);
    console.log('OK: Terminal-Pinsuche, Maskierung, Live-Daten, ID- und Namens-Tab, sudo-Navigation');
  } finally { await browser.close(); }
})().catch(err => { console.error(err); process.exitCode = 1; });
