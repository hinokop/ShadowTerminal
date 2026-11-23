/* Direkte Namensnavigation: exakt vor Präfix, Mehrdeutigkeit, Alias, manuelle Sperren,
   historische Namensfreigabe unabhängig vom Erkenntnisstatus, stabile IDs und sudo. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { APP } = require('./_pfad');
const { altzustandOeffnen, altbestandPruefen, altbestandUnveraendert } = require('./_altzustand');

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
    /* Phase 5a/5b7: Dossierliste und Terminalnamen lösen ohne Ansprechpartnerstatus auf;
       seit 5b7 ist auch die historische Wissenslogik wirkungslos. */
    const historisch = await p.evaluate(() => {
      dispatch({ type: 'MISSION_ZUGEWIESEN', id: 'M1' });
      dispatch({ type: 'MISSION_ANGENOMMEN', id: 'M1' });
      const e = poolAlle().find(x => !x.eigen && x.typ === 'Person' && x.mission === 'STD' &&
        x.name && !dossierGesperrt(x));
      if (!e) return null;
      /* Phase 5c2b (b): In diesem Zustand gibt es keinen Altbestand; der frühere Schreibzugriff über die Hilfsfunktion IZ veränderte nur ein temporäres Objekt und ist entfallen. */
      const z = zielZugang(e.id);
      return { id: e.id, name: e.name, status: wissen(e), info: (typeof infoGesperrt === 'function' && infoGesperrt(e)),
        zugang: z && { id: z.id, info: z.info, gesperrt: z.gesperrt },
        recherche: dossierRechercheBestand().some(x => x.id === e.id),
        nameTreffer: terminalZielNamen('open', e.name).some(x => x.id === e.id) };
    });
    assert.ok(historisch && historisch.name, 'Test benötigt ein benanntes Standarddossier ohne manuelle Sperre');
    /* Phase 5b7: Das gespeicherte Merkmal bleibt erhalten, der stillgelegte Missionsbetrieb wirkt nicht mehr. */
    assert.equal(historisch.status, 'frei', 'Wissensstand ohne Wirkung (Zustand ohne Altbestand)');
    assert.equal(historisch.info, false, 'Freigabe ohne Wirkung (Zustand ohne Altbestand)');
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

    /* Teststärkung (Phase 5c2b-Nachtrag): Namensnavigation gegen einen migrierten Format-4-Zustand mit tatsächlich vorhandenen
       historischen Freigabestufen (bekannt, frei, unbekannt = kein Eintrag). Historische Freigaben dürfen die Namensauflösung nicht
       beeinflussen; eine manuelle Sperre schlägt auch die historische Freigabe 'frei'. Der Altbestand bleibt unverändert. */
    {
      const q = await (await browser.newContext({ viewport: { width: 1500, height: 1000 }, reducedMotion: 'reduce' })).newPage();
      q.setDefaultTimeout(15000);
      const qfehler = [];
      q.on('pageerror', e => qfehler.push(e.message));
      await q.route(/^https?:/, r => r.abort());
      const o = await altzustandOeffnen(q, APP), ids = o.ids, alle = [ids.bekannt, ids.frei, ids.unbekannt, ids.gesperrtFrei];
      const alt = await altbestandPruefen(q, assert, ids);
      const namen = await q.evaluate(alle => alle.map(id => entitaet(id).name), alle);
      const nm = { bekannt: namen[0], frei: namen[1], unbekannt: namen[2], gesperrtFrei: namen[3] };
      assert.equal(new Set(namen).size, 4, 'vier verschiedene Namen');

      await q.evaluate(() => { STATE.missionsbetrieb = true; dispatch({ type: 'NAVIGATION', modul: 'profil' }); renderModule(); });
      await q.click('#profil-terminal-oeffnen');
      const qin = q.locator('#profil-terminal-eingabe'), qout = q.locator('#profil-terminal-ausgabe');
      const qcmd = async zeile => {
        await qin.fill(zeile); await qin.press('Enter');
        await q.waitForFunction(() => !TERMINAL_ZUSTAND.kette);
        return await qout.textContent();
      };
      const qmodul = () => q.evaluate(() => ({ name: STATE.ui.modul, dossier: STATE.dossiers.auswahl }));
      const qzurueck = async () => {
        assert.equal(await q.evaluate(() => document.getElementById('profil-terminal').classList.contains('minimiert')), true, 'Terminal nach Navigation minimiert');
        await q.click('#profil-terminal-minimieren');
        await q.evaluate(() => { dispatch({ type: 'NAVIGATION', modul: 'profil' }); renderModule(); });
      };

      /* Zugang und Namensauflösung der drei freigegebenen Stufen: nur die manuelle Sperre zählt */
      const vor = await q.evaluate(({ alle, nm }) => alle.map((id, i) => {
        const e = entitaet(id), z = zielZugang(id), name = Object.values(nm)[i];
        return { id, wissen: wissen(e), info: typeof infoGesperrt === 'function' && infoGesperrt(e),
          zugang: z && { gesperrt: z.gesperrt, info: z.info },
          recherche: dossierRechercheBestand().some(x => x.id === id),
          treffer: terminalZielNamen('open', name).some(x => x.id === id) };
      }), { alle, nm });
      for (const v of vor) {
        assert.equal(v.wissen, 'frei', 'historische Stufe ohne Wirkung auf wissen(): ' + v.id);
        assert.equal(v.info, false, 'historische Stufe ohne Wirkung auf die Freigabe: ' + v.id);
        assert.deepEqual(v.zugang, { gesperrt: false, info: false }, 'Terminalzugang allein nach manueller Sperre: ' + v.id);
        assert.equal(v.recherche && v.treffer, true, 'Name auflösbar unabhängig von der historischen Stufe: ' + v.id);
      }
      for (const [stufe, id] of [['bekannt', ids.bekannt], ['frei', ids.frei], ['unbekannt', ids.unbekannt]]) {
        await qcmd('open "' + nm[stufe] + '"');
        assert.equal((await qmodul()).dossier, id, 'open per Name navigiert (Stufe ' + stufe + ')');
        await qzurueck();
        await qin.fill('open ' + nm[stufe]); await qin.press('Tab');
        assert.equal(await qin.inputValue(), 'open ' + id, 'Tab ergänzt den Namen (Stufe ' + stufe + ')');
        await qin.fill('');
      }

      /* Manuelle Sperre auf das Dossier mit historischer Freigabe 'frei' */
      await q.evaluate(id => dispatch({ type: 'DOSSIER_SPERREN', id }), ids.gesperrtFrei);
      for (const zeile of ['open "' + nm.gesperrtFrei + '"', 'sudo open "' + nm.gesperrtFrei + '"']) {
        const t = await qcmd(zeile);
        assert.match(t, /No such file or directory/, zeile);
        assert.equal((await qmodul()).name, 'profil', zeile);
        assert.equal(await q.evaluate(() => !!TERMINAL_ZUSTAND.sudo), false, 'keine Kennwortabfrage via Namen');
      }
      assert.equal(await q.evaluate(({ n, id }) => terminalZielNamen('open', n).some(x => x.id === id), { n: nm.gesperrtFrei, id: ids.gesperrtFrei }), false,
        'gesperrter Name trotz historischer Freigabe nicht auflösbar');
      await qin.fill('open ' + nm.gesperrtFrei); await qin.press('Tab');
      assert.equal(await qin.inputValue(), 'open ' + nm.gesperrtFrei, 'gesperrter Name niemals im Tab');
      assert.doesNotMatch(await qout.textContent(), new RegExp(nm.gesperrtFrei.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), 'sichtbarer Scrollback maskiert');
      await qin.fill('');
      for (const [stufe, id] of [['bekannt', ids.bekannt], ['frei', ids.frei], ['unbekannt', ids.unbekannt]]) {
        await qcmd('open "' + nm[stufe] + '"');
        assert.equal((await qmodul()).dossier, id, 'Sperre wirkt nur auf das gesperrte Dossier (Stufe ' + stufe + ')');
        await qzurueck();
      }
      await q.evaluate(id => dispatch({ type: 'DOSSIER_ENTSPERREN', id }), ids.gesperrtFrei);
      await qcmd('open "' + nm.gesperrtFrei + '"');
      assert.equal((await qmodul()).dossier, ids.gesperrtFrei, 'nach Entsperren live navigierbar');

      const nach = await altbestandUnveraendert(q, assert, alt, 'terminal-namensnavigation');
      assert.deepEqual(nach.ls, alt, 'Altbestand im gespeicherten Zustand unverändert');
      assert.deepEqual(qfehler, [], 'keine Browserfehler im Altbestandszustand');
    }

    assert.deepEqual(errors, []);
    console.log('OK: direkte Namen, Präfix, Alias, Mehrdeutigkeit, Sperren und Dossier-Tab');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
