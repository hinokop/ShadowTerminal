/* Phase 5b4: Die aktiven Recherchebereiche dürfen historische Missions- und
   Ansprechpartnerfreigaben nicht als zweite Zugriffsentscheidung verwenden.
   Manuelle Dossiersperren müssen alle relevanten Auswahl-, Schreib- und
   Wiederherstellungspfade unverändert schützen. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { APP } = require('./_pfad');

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
      IZ()[bekannt.id] = { status: 'bekannt' };
      const unbekannt = SCENARIO.standard.dossiers.find(e => e.id !== bekannt.id && e.typ === 'Person' && wissen(e) === 'unbekannt');
      if (!unbekannt) return null;
      const f = xAnlegen({ titel: '5b4 Fallbezug' }); profilSpeichern();
      return { bekannt: bekannt.id, unbekannt: unbekannt.id, fall: f.id,
        wissenBekannt: wissen(bekannt), infoBekannt: infoGesperrt(bekannt),
        wissenUnbekannt: wissen(unbekannt), infoUnbekannt: infoGesperrt(unbekannt) };
    });
    assert.ok(fx, 'Testdossiers aus Standardbestand vorhanden');
    assert.deepEqual([fx.wissenBekannt, fx.infoBekannt, fx.wissenUnbekannt, fx.infoUnbekannt],
      ['bekannt', true, 'unbekannt', true], 'alte Freigabestatuswerte tatsächlich wirksam');

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
    const choices = await p.locator('#ak-eingang-dossier option').evaluateAll(options =>
      options.map(x => x.value));
    assert.ok(choices.includes(fx.bekannt) && choices.includes(fx.unbekannt),
      'Eingangsauswahl enthält beide historisch beschränkten Dossiers');

    await p.locator('#ak-eingang-datei').setInputFiles({
      name: 'phase5b4.txt', mimeType: 'text/plain',
      buffer: Buffer.from('Quellmaterial zum historisch eingeschränkten Dossier')
    });
    await p.locator('#ak-eingang-vorschau pre').waitFor();
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
      'Eingang schreibt unter historischem Freigabestatus');

    /* Recherche-Zuordnung löschen. Dabei bleibt ein evtl. gemeinsamer Beleg
       erhalten; eine manuell gesperrte Dossierzuordnung kann nicht gelöscht werden. */
    const deleted = await p.evaluate(({ bekannt, beleg }) => {
      dispatch({ type: 'RECHERCHE_UNTERLAGE_ENTFERNT', dossier: bekannt, beob: beleg.id });
      return !PROFIL.recherche.beobachtungen.some(b => b.id === beleg.id);
    }, { bekannt: fx.bekannt, beleg });
    assert.equal(deleted, true, 'Unterlagenzuordnung ohne Altfreigabe löschbar');

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
        keinLegacyReiter: !document.querySelector('#ak-tab-registratur, #akte-blatt'), b: b.id };
    }, fx);
    assert.ok(locked.gesperrt && locked.keinSchreiben && !locked.lesbar && !locked.verknuepfen &&
      !locked.pickerEnthaelt && locked.keinLegacyReiter && locked.stand.uebersprungen.includes('Dossier ' + fx.bekannt) &&
      locked.auswahl === fx.unbekannt,
      'Manuelle Sperre bleibt in Fall, Arbeitsstand, Recherche und Eingang wirksam: ' + JSON.stringify(locked));

    await p.evaluate(fx => dispatch({ type: 'DOSSIER_ENTSPERREN', id: fx.bekannt }), fx);
    assert.equal(await p.evaluate(id => xDossierLesbar(entitaet(id)), fx.bekannt), true,
      'Entsperren stellt den Recherchezugriff wieder her');
    assert.deepEqual(errors, [], 'keine Browserfehler');
    console.log('OK: Phase 5b4 – Arbeitsstand, Fall X, Ablage-Eingang, Recherche und manuelle Sperre');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
