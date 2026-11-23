/* Phase 5b4: Die aktiven Recherchebereiche dürfen historische Missions- und
   Ansprechpartnerfreigaben nicht als zweite Zugriffsentscheidung verwenden.
   Manuelle Dossiersperren müssen alle relevanten Auswahl-, Schreib- und
   Wiederherstellungspfade unverändert schützen. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { APP } = require('./_pfad');
const { altzustandOeffnen, altbestandPruefen, altbestandUnveraendert } = require('./_altzustand');

(async () => {
  const browser = await chromium.launch();
  try {
    const p = await browser.newPage({ viewport: { width: 1500, height: 1000 }, reducedMotion: 'reduce' });
    p.setDefaultTimeout(18000);
    const errors = [];
    p.on('pageerror', e => errors.push(e.message));
    await p.route(/^https?:/, r => r.abort());
    await p.goto(APP);
    await p.fill('#gate-pw', 'pw-test-123');
    if (await p.isVisible('#gate-pw2')) await p.fill('#gate-pw2', 'pw-test-123');
    await p.click('#gate-go');
    await p.waitForFunction(() => !document.body.classList.contains('locked'));

    const fx = await p.evaluate(() => {
      STATE.missionsbetrieb = true;
      STATE.automatik = false;
      const bekannt = SCENARIO.standard.dossiers.find(e => e.typ === 'Person' && !e.eigen);
      if (!bekannt) return null;
      /* Phase 5c2b (b): In diesem Zustand gibt es keinen Altbestand; der frühere Schreibzugriff über die Hilfsfunktion IZ veränderte nur ein temporäres Objekt und ist entfallen. */
      const unbekannt = SCENARIO.standard.dossiers.find(e => e.id !== bekannt.id && e.typ === 'Person');
      if (!unbekannt) return null;
      const f = xAnlegen({ titel: '5b4 Fallbezug' }); profilSpeichern();
      return { bekannt: bekannt.id, unbekannt: unbekannt.id, fall: f.id,
        wissenBekannt: wissen(bekannt), infoBekannt: (typeof infoGesperrt === 'function' && infoGesperrt(bekannt)),
        wissenUnbekannt: wissen(unbekannt), infoUnbekannt: (typeof infoGesperrt === 'function' && infoGesperrt(unbekannt)) };
    });
    assert.ok(fx, 'Testdossiers aus Standardbestand vorhanden');
    /* Phase 5b7: Altfelder bleiben gespeichert, wirken aber nicht mehr. */
    assert.deepEqual([fx.wissenBekannt, fx.infoBekannt, fx.wissenUnbekannt, fx.infoUnbekannt],
      ['frei', false, 'frei', false], 'Freigabestufen ohne Wirkung (Zustand ohne Altbestand)');

    /* Fall X: beide historischen Freigabestufen erscheinen im Dossierpicker. */
    const fall = await p.evaluate(fx => {
      const f = xFall(fx.fall);
      const verbunden = xVerknuepfen(f, 'dossiers', fx.unbekannt, false);
      dispatch({ type: 'NAVIGATION', modul: 'x' });
      renderModule();
      const opts = [...document.querySelectorAll('#x-dossier-wahl option')].map(o => o.value);
      return { bekanntLesbar: xDossierLesbar(entitaet(fx.bekannt)),
        unbekanntLesbar: xDossierLesbar(entitaet(fx.unbekannt)),
        verbunden, ids: xDossiers(f), options: opts };
    }, fx);
    assert.ok(fall.bekanntLesbar && fall.unbekanntLesbar && fall.verbunden &&
      fall.ids.includes(fx.unbekannt) && fall.options.includes(fx.bekannt),
      'Fallansicht und Verknüpfung ohne Altfreigabe: ' + JSON.stringify(fall));

    /* Arbeitsstand: ausdrücklich gespeicherte Dossierauswahl wiederherstellen. */
    const stand = await p.evaluate(fx => {
      STATE.dossiers.auswahl = fx.unbekannt;
      const s = { modul: 'dossier', dossier: fx.bekannt, dtab: 'chronik' };
      const r = asAnwenden(s);
      return { r, auswahl: STATE.dossiers.auswahl, tab: VIEW.dtab };
    }, fx);
    assert.ok(stand.r.ok && !stand.r.uebersprungen.length && stand.auswahl === fx.bekannt &&
      stand.tab === 'chronik', 'Arbeitsstand öffnet historisch teilfreigegebenes Dossier');

    /* Lokaler Ablage-Eingang: der sichtbare Picker und der asynchrone Schreibpfad
       müssen unabhängig von infozugang sein. */
    await p.locator('#nav-akten').click();
    assert.equal(await p.locator('#ak-tab-registratur, #ak-tab-eingang, #akte-blatt, #ak-suche').count(), 0,
      'produktive Ablage enthält keine Registratur oder Umschaltreiter');
    assert.equal(await p.locator('#ak-eingang-datei').count(), 1,
      'lokaler Eingang ist unmittelbar sichtbar');
    await p.locator('#ak-eingang-datei').setInputFiles({
      name: 'phase5b4.txt', mimeType: 'text/plain',
      buffer: Buffer.from('Quellmaterial zum historisch eingeschränkten Dossier')
    });
    /* Der Dossierpicker existiert nur für eine konkrete Eingangsdatei. */
    await p.locator('#ak-eingang-vorschau pre').waitFor();
    const choices = await p.locator('#ak-eingang-dossier option').evaluateAll(options =>
      options.map(x => x.value));
    assert.ok(choices.includes(fx.bekannt) && choices.includes(fx.unbekannt),
      'Eingangsauswahl enthält beide historisch beschränkten Dossiers');
    await p.locator('#ak-eingang-fall').selectOption('__neu');
    await p.locator('#ak-eingang-titel').fill('5b4 Eingangsdokument');
    await p.locator('#ak-eingang-dossier').selectOption(fx.bekannt);
    await p.locator('#ak-eingang-zuordnen').click();
    await p.waitForFunction(id => PROFIL.recherche.beobachtungen.some(b => b.dossiers.includes(id)) &&
      !AK_EINGANG.arbeit, fx.bekannt);
    const beleg = await p.evaluate(id => {
      const b = PROFIL.recherche.beobachtungen.find(b => b.dossiers.includes(id));
      return { id: b.id, dos: b.dossiers, fall: PROFIL.recherche.faelle.find(f => f.titel === '5b4 Eingangsdokument')?.id || null };
    }, fx.bekannt);
    assert.ok(beleg.id && beleg.fall && beleg.dos.includes(fx.bekannt),
      'Eingang schreibt ohne Freigabestatus');

    /* Recherche-Zuordnung löschen. Dabei bleibt ein evtl. gemeinsamer Beleg
       erhalten; eine manuell gesperrte Dossierzuordnung kann nicht gelöscht werden. */
    const deleted = await p.evaluate(({ bekannt, beleg }) => {
      dispatch({ type: 'RECHERCHE_UNTERLAGE_ENTFERNT', dossier: bekannt, beob: beleg.id });
      return !PROFIL.recherche.beobachtungen.some(b => b.id === beleg.id);
    }, { bekannt: fx.bekannt, beleg });
    assert.equal(deleted, true, 'Unterlagenzuordnung ohne Altfreigabe löschbar');

    /* Zweite, noch nicht zugeordnete Datei hält das Zuordnungsformular offen,
       damit die folgende Sperrprüfung das echte Dossier-Dropdown untersucht. */
    await p.locator('#ak-eingang-datei').setInputFiles({
      name: 'phase5b4-sperre.txt', mimeType: 'text/plain',
      buffer: Buffer.from('Manuellen Dossierschutz im Dateieingang prüfen')
    });
    await p.locator('#ak-eingang-vorschau pre').waitFor();
    assert.ok(await p.locator('#ak-eingang-dossier option').evaluateAll((options, id) =>
      options.some(o => o.value === id), fx.bekannt), 'vor Sperre ist der Dossiereintrag wählbar');

    const locked = await p.evaluate(fx => {
      dispatch({ type: 'RECHERCHE_BELEG', dossier: fx.bekannt, fall: fx.fall,
        art: 'Text', fassung: {}, zitat: 'Manuelle Sperre vorbereiten' });
      const b = PROFIL.recherche.beobachtungen.at(-1);
      dispatch({ type: 'DOSSIER_SPERREN', id: fx.bekannt });
      STATE.dossiers.auswahl = fx.unbekannt;
      const vorher = PROFIL.recherche.beobachtungen.length;
      dispatch({ type: 'RECHERCHE_UNTERLAGE_ENTFERNT', dossier: fx.bekannt, beob: b.id });
      dispatch({ type: 'RECHERCHE_BELEG', dossier: fx.bekannt, fall: fx.fall,
        art: 'Text', fassung: {}, zitat: 'GESPERRT' });
      const stand = asAnwenden({ modul: 'dossier', dossier: fx.bekannt, dtab: 'info' });
      const keinSchreiben = PROFIL.recherche.beobachtungen.length === vorher &&
        PROFIL.recherche.beobachtungen.some(x => x.id === b.id) &&
        !PROFIL.recherche.beobachtungen.some(x => x.zitat === 'GESPERRT');
      const lesbar = xDossierLesbar(entitaet(fx.bekannt));
      const verknuepfen = xVerknuepfen(xFall(fx.fall), 'dossiers', fx.bekannt, false);
      /* Ein importiertes Legacy-Reiterfeld darf die Registratur nicht reaktivieren. */
      VIEW.akte.reiter = 'registratur';
      dispatch({ type: 'NAVIGATION', modul: 'akten' });
      renderModule();
      const picker = [...document.querySelectorAll('#ak-eingang-dossier option')].map(x => x.value);
      return { gesperrt: dossierGesperrt(entitaet(fx.bekannt)), keinSchreiben,
        stand, auswahl: STATE.dossiers.auswahl, lesbar, verknuepfen,
        pickerEnthaelt: picker.includes(fx.bekannt),
        pickerAnderesDossier: picker.includes(fx.unbekannt),
        keinLegacyReiter: !document.querySelector('#ak-tab-registratur, #akte-blatt'), b: b.id };
    }, fx);
    assert.ok(locked.gesperrt && locked.keinSchreiben && !locked.lesbar && !locked.verknuepfen &&
      !locked.pickerEnthaelt && locked.pickerAnderesDossier && locked.keinLegacyReiter && locked.stand.uebersprungen.includes('Dossier ' + fx.bekannt) &&
      locked.auswahl === fx.unbekannt,
      'Manuelle Sperre bleibt in Fall, Arbeitsstand, Recherche und Eingang wirksam: ' + JSON.stringify(locked));

    await p.evaluate(fx => dispatch({ type: 'DOSSIER_ENTSPERREN', id: fx.bekannt }), fx);
    assert.equal(await p.evaluate(id => xDossierLesbar(entitaet(id)), fx.bekannt), true,
      'Entsperren stellt den Recherchezugriff wieder her');

    /* Teststärkung (Phase 5c2b-Nachtrag): derselbe Ablauf gegen einen migrierten Format-4-Zustand mit tatsächlich vorhandenen
       historischen Freigabestufen (bekannt, frei, unbekannt = kein Eintrag). Historische Freigaben dürfen keine Wirkung auf
       Zugriffsrechte haben; eine manuelle Sperre schlägt auch eine historische Freigabe 'frei'. Der Altbestand bleibt unverändert. */
    {
      const q = await (await browser.newContext({ viewport: { width: 1500, height: 1000 }, reducedMotion: 'reduce' })).newPage();
      q.setDefaultTimeout(18000);
      const qfehler = [];
      q.on('pageerror', e => qfehler.push(e.message));
      await q.route(/^https?:/, r => r.abort());
      const o = await altzustandOeffnen(q, APP), ids = o.ids, alle = [ids.bekannt, ids.frei, ids.unbekannt, ids.gesperrtFrei];
      const alt = await altbestandPruefen(q, assert, ids);

      const g = await q.evaluate(({ ids, alle }) => {
        STATE.missionsbetrieb = true;
        const f = xAnlegen({ titel: '5b4 Altbestand' }); profilSpeichern();
        const zug = alle.map(id => {
          const e = entitaet(id), z = zielZugang(id);
          return { id, wissen: wissen(e), info: typeof infoGesperrt === 'function' && infoGesperrt(e),
            zugang: z && { gesperrt: z.gesperrt, info: z.info },
            lesbar: xDossierLesbar(e), recherche: dossierRechercheBestand().some(x => x.id === id) };
        });
        dispatch({ type: 'NAVIGATION', modul: 'x' }); renderModule();
        const options = [...document.querySelectorAll('#x-dossier-wahl option')].map(o => o.value);
        const verbunden = alle.map(id => xVerknuepfen(xFall(f.id), 'dossiers', id, false));
        const stand = alle.map(id => {
          STATE.dossiers.auswahl = ids.unbekannt === id ? ids.bekannt : ids.unbekannt;
          const r = asAnwenden({ modul: 'dossier', dossier: id, dtab: 'chronik' });
          return { ok: !!r.ok && !r.uebersprungen.length, auswahl: STATE.dossiers.auswahl === id };
        });
        return { fall: f.id, zug, options, verbunden, stand };
      }, { ids, alle });
      for (const z of g.zug) {
        assert.equal(z.wissen, 'frei', 'historische Stufe ohne Wirkung auf wissen(): ' + z.id);
        assert.equal(z.info, false, 'historische Stufe ohne Wirkung auf die Freigabe: ' + z.id);
        assert.deepEqual(z.zugang, { gesperrt: false, info: false }, 'Zugang allein nach manueller Sperre: ' + z.id);
        assert.equal(z.lesbar && z.recherche, true, 'Dossier lesbar und im Rechercheindex: ' + z.id);
      }
      for (const id of alle) assert.ok(g.options.includes(id), 'Fall-X-Auswahl enthält ' + id);
      assert.deepEqual(g.verbunden, [true, true, true, true], 'Verknüpfung mit allen vier Stufen möglich');
      assert.deepEqual(g.stand, alle.map(() => ({ ok: true, auswahl: true })), 'Arbeitsstand stellt alle vier Stufen wieder her');

      /* Ablage-Eingang: alle Stufen wählbar, Zuordnung zum Dossier ohne Freigabe schreibt */
      await q.locator('#nav-akten').click();
      await q.locator('#ak-eingang-datei').setInputFiles({ name: 'altbestand.txt', mimeType: 'text/plain', buffer: Buffer.from('Quellmaterial mit Altbestand') });
      await q.locator('#ak-eingang-vorschau pre').waitFor();
      const wahl = await q.locator('#ak-eingang-dossier option').evaluateAll(opts => opts.map(x => x.value));
      for (const id of alle) assert.ok(wahl.includes(id), 'Eingangsauswahl enthält ' + id);
      await q.locator('#ak-eingang-fall').selectOption('__neu');
      await q.locator('#ak-eingang-titel').fill('5b4 Eingang Altbestand');
      await q.locator('#ak-eingang-dossier').selectOption(ids.unbekannt);
      await q.locator('#ak-eingang-zuordnen').click();
      await q.waitForFunction(id => PROFIL.recherche.beobachtungen.some(b => b.dossiers.includes(id)) && !AK_EINGANG.arbeit, ids.unbekannt);

      /* Manuelle Sperre auf ein Dossier mit historischer Freigabe 'frei': Sperre bleibt wirksam, andere Stufen unberührt */
      await q.locator('#ak-eingang-datei').setInputFiles({ name: 'altbestand2.txt', mimeType: 'text/plain', buffer: Buffer.from('Zweite Datei') });
      await q.locator('#ak-eingang-vorschau pre').waitFor();
      const s = await q.evaluate(ids => {
        dispatch({ type: 'DOSSIER_SPERREN', id: ids.gesperrtFrei });
        STATE.dossiers.auswahl = ids.frei;
        const vorher = PROFIL.recherche.beobachtungen.length;
        dispatch({ type: 'RECHERCHE_BELEG', dossier: ids.gesperrtFrei, fall: null, art: 'Text', fassung: {}, zitat: 'GESPERRT-ALT' });
        const stand = asAnwenden({ modul: 'dossier', dossier: ids.gesperrtFrei, dtab: 'info' });
        const z = zielZugang(ids.gesperrtFrei);
        dispatch({ type: 'NAVIGATION', modul: 'akten' }); renderModule();
        const picker = [...document.querySelectorAll('#ak-eingang-dossier option')].map(x => x.value);
        return { zugang: z && { gesperrt: z.gesperrt, info: z.info }, lesbar: xDossierLesbar(entitaet(ids.gesperrtFrei)),
          verknuepfen: xVerknuepfen(xFall(null) || xAnlegen({ titel: '5b4 Sperre' }), 'dossiers', ids.gesperrtFrei, false),
          keinSchreiben: PROFIL.recherche.beobachtungen.length === vorher && !PROFIL.recherche.beobachtungen.some(x => x.zitat === 'GESPERRT-ALT'),
          uebersprungen: stand.uebersprungen, auswahl: STATE.dossiers.auswahl, picker,
          andere: [ids.bekannt, ids.frei, ids.unbekannt].map(id => ({ gesperrt: zielZugang(id).gesperrt, lesbar: xDossierLesbar(entitaet(id)) })) };
      }, ids);
      assert.deepEqual(s.zugang, { gesperrt: true, info: false }, 'manuelle Sperre schlägt historische Freigabe frei');
      assert.equal(s.lesbar, false, 'gesperrtes Dossier in Fall X nicht lesbar');
      assert.equal(s.verknuepfen, false, 'gesperrtes Dossier nicht verknüpfbar');
      assert.equal(s.keinSchreiben, true, 'kein Schreiben auf das gesperrte Dossier');
      assert.ok(s.uebersprungen.includes('Dossier ' + ids.gesperrtFrei) && s.auswahl === ids.frei, 'Arbeitsstand überspringt gesperrtes Dossier');
      assert.equal(s.picker.includes(ids.gesperrtFrei), false, 'Eingangsauswahl ohne gesperrtes Dossier');
      for (const id of [ids.bekannt, ids.frei, ids.unbekannt]) assert.ok(s.picker.includes(id), 'Eingangsauswahl weiter mit ' + id);
      assert.deepEqual(s.andere, [{ gesperrt: false, lesbar: true }, { gesperrt: false, lesbar: true }, { gesperrt: false, lesbar: true }],
        'Sperre wirkt nur auf das gesperrte Dossier');
      await q.evaluate(id => dispatch({ type: 'DOSSIER_ENTSPERREN', id }), ids.gesperrtFrei);
      assert.equal(await q.evaluate(id => xDossierLesbar(entitaet(id)), ids.gesperrtFrei), true, 'Entsperren stellt den Zugriff wieder her');

      const nach = await altbestandUnveraendert(q, assert, alt, 'phase5b4-arbeitszugang');
      assert.deepEqual(nach.ls, alt, 'Altbestand im gespeicherten Zustand unverändert');
      assert.deepEqual(qfehler, [], 'keine Browserfehler im Altbestandszustand');
    }

    assert.deepEqual(errors, [], 'keine Browserfehler');
    console.log('OK: Phase 5b4 – Arbeitsstand, Fall X, Ablage-Eingang, Recherche und manuelle Sperre');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
