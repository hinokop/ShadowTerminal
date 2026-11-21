/* Direkte Namensnavigation: exakt vor Präfix, Mehrdeutigkeit, Alias, manuelle Sperren,
   historische Namensfreigabe unabhängig vom Erkenntnisstatus, stabile IDs und sudo. */
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
        return STATE.dossiers.eigene.find(e => e.name === name);
      };
      const frei = dossier('Zielknoten Delta');
      frei.aliase = ['Marke Delta'];
      const gleich = dossier('Nordtor Lagerhalle');
      const zu = dossier('Geheime Quellakte');
      const pin = (name, dossierId) => {
        dispatch({ type: 'PIN_ANGELEGT', ll: [52.52 + (PROFIL.pins || []).length * 0.001, 13.405], name, dossier: dossierId });
        return PROFIL.pins.at(-1).id;
      };
      const park = pin('Parkplatz Nord');
      const nord = pin('Nordtor Lagerhalle');
      const west = pin('Nordseite West');
      const kuhl = pin('Kühlpunkt Ost');
      const zuPin = pin('Kühlhaus Quellweg', zu.id);
      dispatch({ type: 'DOSSIER_SPERREN', id: zu.id });
      dispatch({ type: 'NAVIGATION', modul: 'profil' });
      renderModule();
      return { frei: frei.id, gleich: gleich.id, zu: zu.id, park, nord, west, kuhl, zuPin };
    });
    await p.click('#profil-terminal-oeffnen');
    const input = p.locator('#profil-terminal-eingabe'), out = p.locator('#profil-terminal-ausgabe');
    const minimiert = () => p.evaluate(() => document.getElementById('profil-terminal').classList.contains('minimiert'));
    const modul = () => p.evaluate(() => ({ name: STATE.ui.modul, pin: VIEW.karte.auswahl, dossier: STATE.dossiers.auswahl }));
    const cmd = async zeile => {
      await input.fill(zeile);
      await input.press('Enter');
      await p.waitForFunction(() => !TERMINAL_ZUSTAND.kette);
      return await out.textContent();
    };
    const status = async () => (await cmd('echo $?')).trim().split('\n').at(-1);
    const back = async () => {
      assert.equal(await minimiert(), true, 'Terminal nach Navigation minimiert');
      await p.click('#profil-terminal-minimieren');
      await p.evaluate(() => { dispatch({ type: 'NAVIGATION', modul: 'profil' }); renderModule(); });
    };

    /* Exakter Name ohne Tab, mit und ohne Anführungszeichen. */
    await cmd('map "Parkplatz Nord"');
    assert.deepEqual((await modul()).pin, z.park);
    await back();
    await cmd('map Parkplatz Nord');
    assert.deepEqual((await modul()).pin, z.park);
    await back();

    /* Eindeutiger Namensanfang und diakritische Zeichen. */
    await cmd('map Kühlpunkt');
    assert.equal((await modul()).pin, z.kuhl);
    await back();
    await cmd('map Kuhlpunkt');
    assert.equal((await modul()).pin, z.kuhl);
    await back();

    /* open findet sichtbare Dossiers über den Namen und Alias. */
    await cmd('open "Zielknoten Delta"');
    assert.deepEqual((await modul()).name, 'dossier');
    assert.deepEqual((await modul()).dossier, z.frei);
    await back();
    await cmd('open Marke Delta');
    assert.equal((await modul()).dossier, z.frei);
    await back();
    await cmd('open Zielknoten');
    assert.equal((await modul()).dossier, z.frei);
    await back();

    /* Gleiche Namen an Pin und Dossier: map kennt nur Pins; open meldet Mehrdeutigkeit. */
    await cmd('map "Nordtor Lagerhalle"');
    assert.equal((await modul()).pin, z.nord);
    await back();
    let txt = await cmd('open "Nordtor Lagerhalle"');
    assert.match(txt, /open: Nordtor Lagerhalle: ambiguous name \(2 matches\)/);
    assert.ok(txt.includes(z.nord) && txt.includes(z.gleich));
    assert.equal(await status(), '1');
    assert.equal((await modul()).name, 'profil');
    assert.equal(await minimiert(), false);

    /* Prefix mit zwei Pins löst nicht stillschweigend zum ersten Treffer auf. */
    txt = await cmd('map Nord');
    assert.match(txt, /map: Nord: ambiguous name \(2 matches\)/);
    assert.ok(txt.includes(z.nord) && txt.includes(z.west));
    assert.equal(await status(), '1');
    assert.equal((await modul()).name, 'profil');

    /* Exakt vor Präfix: "Parkplatz" schlägt "Parkplatz Nord". */
    const direkt = await p.evaluate(() => {
      dispatch({ type: 'PIN_ANGELEGT', ll: [52.536, 13.407], name: 'Parkplatz' });
      return PROFIL.pins.at(-1).id;
    });
    await cmd('map Parkplatz');
    assert.equal((await modul()).pin, direkt);
    await back();

    /* Gesperrte Namen und Aliase weder durch open/map noch durch sudo auflösbar. */
    for (const zeile of ['map Kühlhaus Quellweg', 'open Geheime Quellakte',
      'sudo map "Kühlhaus Quellweg"', 'sudo open Geheime Quellakte']) {
      txt = await cmd(zeile);
      assert.match(txt, /No such file or directory/, zeile);
      assert.equal(await status(), '1', zeile);
      assert.equal((await modul()).name, 'profil', zeile);
      assert.equal(await p.evaluate(() => !!TERMINAL_ZUSTAND.sudo), false, 'keine Kennwortabfrage via Namen');
    }
    txt = await cmd('map ' + z.zuPin);
    assert.match(txt, new RegExp(z.zuPin + ': Permission denied'));
    assert.equal(await status(), '1');

    /* Tab findet sichtbare Dossier-Namen/Aliase und ersetzt sie durch die Kennung. */
    await input.fill('open Zielknoten');
    await input.press('Tab');
    assert.equal(await input.inputValue(), 'open ' + z.frei);
    await input.fill('sudo open Marke');
    await input.press('Tab');
    assert.equal(await input.inputValue(), 'sudo open ' + z.frei);
    await input.fill('open Geheime');
    await input.press('Tab');
    assert.equal(await input.inputValue(), 'open Geheime', 'gesperrter Dossiername niemals im Tab');
    await input.fill('open ' + z.zu.slice(0, -1));
    await input.press('Tab');
    assert.equal(await input.inputValue(), 'open ' + z.zu, 'gesperrte ID ist ergänzbar');

    /* Nach Entsperren wird der Name live navigierbar, ohne Tab-Cache. */
    await p.evaluate(id => dispatch({ type: 'DOSSIER_ENTSPERREN', id }), z.zu);
    await cmd('open "Geheime Quellakte"');
    assert.equal((await modul()).dossier, z.zu);
    await back();
    await cmd('map Kühlhaus');
    assert.equal((await modul()).pin, z.zuPin);
    await back();

    /* Vertraulichkeit des Verlaufs auch nach nachträglicher Sperrung eines zuvor geöffneten Dossiers. */
    await cmd('open "Geheime Quellakte"');
    await back();
    await p.evaluate(id => dispatch({ type: 'DOSSIER_SPERREN', id }), z.zu);
    assert.equal(await p.evaluate(() => TERMINAL_ZUSTAND.verlauf.some(s => s.includes('Geheime Quellakte'))), false,
      'Verlauf enthält nach Sperre keinen Dossier-Klarnamen');
    assert.doesNotMatch(await out.textContent(), /Geheime Quellakte/, 'sichtbarer Scrollback sofort maskiert');
    await cmd('echo maskierung-aktiv');
    assert.doesNotMatch(await out.textContent(), /Geheime Quellakte/,
      'nach weiterer Terminalausgabe keine kurzzeitig unmaskierten Namen');
    /* Phase 5a: Die historische Wissens-/Einschätzungslogik bleibt unverändert,
       Dossierliste und Terminalnamen lösen dagegen ohne Ansprechpartnerstatus auf. */
    const historisch = await p.evaluate(() => {
      dispatch({ type: 'MISSION_ZUGEWIESEN', id: 'M1' });
      dispatch({ type: 'MISSION_ANGENOMMEN', id: 'M1' });
      const e = poolAlle().find(x => !x.eigen && x.typ === 'Person' &&
        wissen(x) === 'unbekannt' && x.name && !dossierGesperrt(x));
      if (!e) return null;
      IZ()[e.id] = { status: 'bekannt' };
      const z = zielZugang(e.id);
      return { id: e.id, name: e.name, status: wissen(e), info: infoGesperrt(e),
        zugang: z && { id: z.id, info: z.info, gesperrt: z.gesperrt },
        recherche: dossierRechercheBestand().some(x => x.id === e.id),
        nameTreffer: terminalZielNamen('open', e.name).some(x => x.id === e.id) };
    });
    assert.ok(historisch && historisch.name, 'Test benötigt ein historisch eingeschränktes Dossier');
    assert.equal(historisch.status, 'bekannt', 'Wissensstand bleibt für historische Abläufe erhalten');
    assert.equal(historisch.info, true, 'historische Freigabe wird nicht künstlich überschrieben');
    assert.deepEqual(historisch.zugang, { id: historisch.id, info: false, gesperrt: false },
      'Terminalzugang beruht allein auf der manuellen Sperre');
    assert.equal(historisch.recherche && historisch.nameTreffer, true,
      'Dossiername ist unabhängig von alter Freigabe auflösbar');
    txt = await cmd('open ' + historisch.name);
    assert.equal((await modul()).dossier, historisch.id, 'historischer Name navigiert zum Dossier');
    await back();
    await input.fill('open ' + historisch.name);
    await input.press('Tab');
    assert.equal(await input.inputValue(), 'open ' + historisch.id,
      'Tab ergänzt den alten Dossiernamen auf seine Kennung');
    await input.fill('');

    /* Eine manuelle Sperre bleibt auch gegenüber sichtbaren längeren Präfixtreffern
       wirksam: kein stilles Ausweichen auf einen anderen Datensatz. */
    const kollisionsziel = await p.evaluate(() => {
      dispatch({ type: 'DOSSIER_ANGELEGT', name: 'Geheime Quellakte Annex', typ: 'Person' });
      return STATE.dossiers.eigene.find(e => e.name === 'Geheime Quellakte Annex').id;
    });
    txt = await cmd('open Geheime Quellakte');
    assert.match(txt, /No such file or directory/,
      'exakter manuell gesperrter Name darf keinen längeren Präfixtreffer öffnen');
    assert.equal((await modul()).name, 'profil');
    await cmd('open Geheime Quellakte Annex');
    assert.equal((await modul()).dossier, kollisionsziel);
    await back();

    assert.deepEqual(errors, []);
    console.log('OK: direkte Namen, Präfix, Alias, Mehrdeutigkeit, Sperren und Dossier-Tab');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
