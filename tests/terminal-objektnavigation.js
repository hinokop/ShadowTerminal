/* Semantik nach getrennten Objektarten:
   map PIN/ZO -> Karte, open PIN/ZO -> verknüpftes Dossier, map pins/zones -> getrennte Listen,
   gesperrte Zonen wie gesperrte Pins, Tab und sudo, VAULT bleibt unberührt. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { APP } = require('./_pfad');

(async () => {
  const browser = await chromium.launch();
  try {
    const p = await browser.newPage({ viewport: { width: 1500, height: 1000 }, reducedMotion: 'reduce' });
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
      const dossier = name => {
        dispatch({ type: 'DOSSIER_ANGELEGT', name, typ: 'Person' });
        return STATE.dossiers.eigene.find(x => x.name === name).id;
      };
      const frei = dossier('Lage Treffpunkt'), geheim = dossier('Sperrakte Gelände');
      const pin = (name, dossier) => {
        dispatch({ type: 'PIN_ANGELEGT', ll: [52.52 + (PROFIL.pins || []).length * 0.001, 13.405], name, dossier });
        return PROFIL.pins.at(-1).id;
      };
      const zone = (name, dossier) => {
        dispatch({ type: 'OZONE_ANGELEGT', ll: [52.54 + (PROFIL.zonen || []).length * 0.001, 13.41], name });
        const id = PROFIL.zonen.at(-1).id;
        if (dossier) dispatch({ type: 'OZONE_GEAENDERT', id, dossier });
        return id;
      };
      const pinFrei = pin('Parkplatz frei'), pinDossier = pin('Pin Verbindung', frei), pinZu = pin('Pin Geheim', geheim);
      const zoneFrei = zone('Treffpunkt Reserve'), zoneDossier = zone('Treffpunkt Hauptzone', frei), zoneZu = zone('Sperrzone West', geheim);
      dispatch({ type: 'DOSSIER_SPERREN', id: geheim });
      dispatch({ type: 'NAVIGATION', modul: 'profil' }); renderModule();
      return { frei, geheim, pinFrei, pinDossier, pinZu, zoneFrei, zoneDossier, zoneZu };
    });
    await p.click('#profil-terminal-oeffnen');
    const inp = p.locator('#profil-terminal-eingabe'), out = p.locator('#profil-terminal-ausgabe');
    const terminalOffen = async () => p.evaluate(() => !document.getElementById('profil-terminal').classList.contains('minimiert'));
    const ansicht = () => p.evaluate(() => ({ modul: STATE.ui.modul,
      id: STATE.ui.modul === 'karte' ? VIEW.karte.auswahl : STATE.dossiers.auswahl }));
    async function cmd(command) {
      const before = await out.textContent();
      await inp.fill(command);
      await inp.press('Enter');
      await p.waitForFunction(() => !TERMINAL_ZUSTAND.kette);
      return (await out.textContent()).slice(before.length);
    }
    async function back() {
      assert.equal(await terminalOffen(), false, 'nur erfolgreiche Navigation minimiert');
      await p.click('#profil-terminal-minimieren');
      await p.evaluate(() => { dispatch({ type: 'NAVIGATION', modul: 'profil' }); renderModule(); });
    }
    const status = async () => (await cmd('echo $?')).trim().split('\n').at(-1);
    const listPins = await cmd('map pins');
    assert.match(listPins, new RegExp(z.pinFrei));
    assert.match(listPins, new RegExp(z.pinZu + '\\s+\\[LOCKED\\]'));
    assert.doesNotMatch(listPins, new RegExp(z.zoneFrei + '|' + z.zoneDossier + '|' + z.zoneZu));
    const listZonen = await cmd('map zones');
    assert.match(listZonen, new RegExp(z.zoneFrei + '\\s+Treffpunkt Reserve'));
    assert.match(listZonen, new RegExp(z.zoneDossier + '\\s+Treffpunkt Hauptzone'));
    assert.match(listZonen, new RegExp(z.zoneZu + '\\s+\\[LOCKED\\]'));
    assert.doesNotMatch(listZonen, /Sperrzone West|Parkplatz frei/);
    assert.doesNotMatch(listZonen, new RegExp(z.pinFrei));
    assert.equal(await status(), '0');
    let text = await cmd('map zones treffpunkt');
    assert.match(text, /Treffpunkt Reserve/);
    assert.match(text, /Treffpunkt Hauptzone/);
    assert.doesNotMatch(text, /Sperrzone West/);
    text = await cmd('map zones ' + z.zoneZu);
    assert.match(text, new RegExp(z.zoneZu + '\\s+\\[LOCKED\\]'));
    text = await cmd('map zones sperrzone');
    assert.match(text, /No matches for sperrzone/);
    assert.equal(await status(), '1');

    /* Karte: Pin und Zone dürfen navigiert werden, auch ohne Dossier. */
    await cmd('map ' + z.pinFrei);
    assert.deepEqual(await ansicht(), { modul: 'karte', id: z.pinFrei }); await back();
    await cmd('map ' + z.zoneFrei);
    assert.deepEqual(await ansicht(), { modul: 'karte', id: z.zoneFrei });
    assert.match(await p.locator('#k-auswahl').innerText(), /Treffpunkt Reserve/); await back();
    await cmd('map Treffpunkt Reserve');
    assert.deepEqual(await ansicht(), { modul: 'karte', id: z.zoneFrei }); await back();

    /* open auf Kartenobjekten: verknüpftes Dossier, kein Kartenmodul. */
    await cmd('open ' + z.pinDossier);
    assert.deepEqual(await ansicht(), { modul: 'dossier', id: z.frei }); await back();
    await cmd('open ' + z.zoneDossier);
    assert.deepEqual(await ansicht(), { modul: 'dossier', id: z.frei }); await back();
    await cmd('open Treffpunkt Hauptzone');
    assert.deepEqual(await ansicht(), { modul: 'dossier', id: z.frei }); await back();
    await cmd('open ' + z.frei);
    assert.deepEqual(await ansicht(), { modul: 'dossier', id: z.frei }); await back();

    for (const id of [z.pinFrei, z.zoneFrei]) {
      text = await cmd('open ' + id);
      assert.equal(text.trim().split('\n').at(-1), 'open: ' + id + ': No linked dossier');
      assert.equal(await status(), '1');
      assert.equal(await terminalOffen(), true);
      assert.equal((await ansicht()).modul, 'profil');
    }
    /* Kein Zonenname/Popup aus gesperrtem Dossier wird auf der Karte gezeichnet. */
    assert.equal(await p.evaluate(id => !!karteZoneFinden(id), z.zoneZu), false);
    for (const line of ['map ' + z.zoneZu, 'open ' + z.zoneZu, 'map Sperrzone West', 'open Sperrzone West']) {
      text = await cmd(line);
      assert.match(text, line.includes(z.zoneZu) ? /Permission denied/ : /No such file or directory/);
      assert.equal(await status(), '1');
      assert.equal(await terminalOffen(), true);
    }

    /* Tab: Eintrag erscheint anhand des ZO-Namens, wird aber zu stabiler Kennung. */
    await inp.fill('map Treffpunkt Res');
    await inp.press('Tab');
    assert.equal(await inp.inputValue(), 'map ' + z.zoneFrei);
    await inp.fill('open Treffpunkt Haupt');
    await inp.press('Tab');
    assert.equal(await inp.inputValue(), 'open ' + z.zoneDossier);
    await inp.fill('map Sperrzone');
    await inp.press('Tab');
    assert.equal(await inp.inputValue(), 'map Sperrzone', 'kein geschützter Name');
    /* Mehrere ZO-00-Kennungen müssen eine Auswahl öffnen. Gesperrte Zone
       bleibt per Kennung auffindbar, ihr Name bleibt geschützt. */
    await inp.fill('map ZO-00');
    await inp.press('Tab');
    const kandidaten = p.locator('#profil-terminal-auswahl');
    await kandidaten.waitFor({ state: 'visible' });
    assert.match(await kandidaten.textContent(), new RegExp(z.zoneZu),
      'gesperrte Zonenkennung bleibt in der Auswahlliste');
    assert.doesNotMatch(await kandidaten.textContent(), /Sperrzone West/,
      'geschützter Zonenname darf nicht ergänzt werden');
    assert.equal(await inp.inputValue(), 'map ZO-00',
      'mehrdeutiger Zonenpräfix wird nicht eindeutig ergänzt');
    await inp.fill('');

    /* sudo open / map ZO: vorhandenes Dossier entsperren, gleiche Oberfläche wie bisher. */
    await inp.fill('sudo open ' + z.zoneZu); await inp.press('Enter');
    await p.waitForFunction(() => TERMINAL_ZUSTAND.sudo && !TERMINAL_ZUSTAND.sudo.pruefen);
    await inp.focus(); await p.keyboard.type('pw-test-123');
    assert.equal(await inp.inputValue(), '', 'Kennwort nicht sichtbar');
    await inp.press('Enter');
    await p.waitForFunction(() => !TERMINAL_ZUSTAND.kette);
    assert.deepEqual(await ansicht(), { modul: 'dossier', id: z.geheim });
    assert.equal(await p.evaluate(id => PROFIL.gesperrt.includes(id), z.geheim), false); await back();
    await cmd('map ' + z.zoneZu);
    assert.deepEqual(await ansicht(), { modul: 'karte', id: z.zoneZu }); await back();
    await p.evaluate(id => dispatch({ type: 'DOSSIER_SPERREN', id }), z.geheim);
    assert.equal(await p.evaluate(id => !!karteZoneFinden(id), z.zoneZu), false);
    await inp.fill('sudo map ' + z.zoneZu); await inp.press('Enter');
    await p.waitForFunction(() => TERMINAL_ZUSTAND.sudo && !TERMINAL_ZUSTAND.sudo.pruefen);
    await inp.focus(); await p.keyboard.type('pw-test-123'); await inp.press('Enter');
    await p.waitForFunction(() => !TERMINAL_ZUSTAND.kette);
    assert.deepEqual(await ansicht(), { modul: 'karte', id: z.zoneZu });
    assert.equal(await p.evaluate(id => PROFIL.gesperrt.includes(id), z.geheim), false);
    await back();
    assert.deepEqual(errors, []);
    console.log('OK: PIN/ZO map vs. open, separate search, zone lock and sudo');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
