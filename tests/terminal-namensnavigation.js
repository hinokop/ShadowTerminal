/* Direkte Namensnavigation: exakt vor Präfix, Mehrdeutigkeit, Alias, Sperren,
   Namens-Tab für Dossiers sowie weiterhin stabile IDs und sudo-Schutz. */
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
    /* Übergangsschutz: In der alten Missionslogik teilweise freigegebene Dossiers
       dürfen weder via Name noch via Tab gefunden werden. Kennungszugriffe
       behalten die bereits vorhandene beschränkte Dossieransicht. */
    const beschraenkt = await p.evaluate(() => {
      dispatch({ type: 'MISSION_ZUGEWIESEN', id: 'M1' });
      dispatch({ type: 'MISSION_ANGENOMMEN', id: 'M1' });
      const e = poolAlle().find(x => !x.eigen && x.typ === 'Person' &&
        wissen(x) === 'unbekannt' && x.name);
      if (!e) return null;
      IZ()[e.id] = { status: 'bekannt' };
      const aktuell = pool().find(x => x.id === e.id);
      return { id: e.id, name: e.name, status: wissen(aktuell), info: infoGesperrt(aktuell) };
    });
    assert.ok(beschraenkt && beschraenkt.info && beschraenkt.status === 'bekannt',
      'Testdossier muss tatsächlich infoGesperrt sein');

    txt = await cmd('open ' + beschraenkt.name);
    assert.match(txt, /No such file or directory/, 'gesperrter Dossiername darf nicht auflösen');
    assert.equal(await status(), '1');
    assert.equal((await modul()).name, 'profil');
    assert.equal(await p.evaluate(n => terminalZielNamen('open', n).length, beschraenkt.name), 0,
      'exakter beschränkter Name fehlt im Namensindex');
    await input.fill('open ' + beschraenkt.name);
    await input.press('Tab');
    assert.notEqual(await input.inputValue(), 'open ' + beschraenkt.id,
      'Tab darf den beschränkten Namen nicht in die Kennung auflösen');

    /* Verdeckter exakter Name darf sichtbaren längeren Präfix nicht kapern. */
    const kollisionsziel = await p.evaluate(name => {
      dispatch({ type: 'DOSSIER_ANGELEGT', name, typ: 'Person' });
      const e = STATE.dossiers.eigene.find(x => x.name === name);
      return { id: e.id, info: infoGesperrt(e) };
    }, beschraenkt.name + ' Annex');
    assert.equal(kollisionsziel.info, false, 'sichtbares Kontroll-Dossier muss frei sein');
    txt = await cmd('open ' + beschraenkt.name);
    assert.match(txt, /No such file or directory/,
      'exakter geschützter Name darf nicht auf sichtbaren Präfixtreffer umleiten');
    assert.equal((await modul()).name, 'profil');
    await cmd('open ' + beschraenkt.name + ' Annex');
    assert.equal((await modul()).dossier, kollisionsziel.id,
      'vollständiger sichtbarer Name navigiert weiterhin');
    await back();

    await cmd('open ' + beschraenkt.id);
    assert.equal((await modul()).dossier, beschraenkt.id,
      'Kennungsnavigation bleibt für eingeschränkte Dossiers erhalten');
    await back();

    assert.deepEqual(errors, []);
    console.log('OK: direkte Namen, Präfix, Alias, Mehrdeutigkeit, Sperren und Dossier-Tab');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
