/* Phase 5b6: Das Modul Dossiers darf im Altzustand (missionsbetrieb=true, M1
   angenommen) nicht anders aussehen oder sich anders verhalten als im
   Recherchebetrieb. Differenzprüfung über alle Dossiers: Übersichtstext,
   Bedienelemente, Beziehungsansicht (SVG-Texte und -Titel), Verbindungsziele
   und Adresspfad. Zusätzlich: Ausblenden einer Szenarioverbindung wirkt nur im
   Profil, manuelle Sperren gelten weiter; seit 5b7 wirkt der Altzustand auch auf die historischen Helfer nicht. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { APP } = require('./_pfad');

(async () => {
  const browser = await chromium.launch();
  try {
    const p = await browser.newPage({ viewport: { width: 1500, height: 1000 }, reducedMotion: 'reduce' });
    p.setDefaultTimeout(20000);
    const errors = [];
    p.on('pageerror', e => errors.push(e.message));
    await p.route(/^https?:/, r => r.abort());
    await p.goto(APP);
    await p.fill('#gate-pw', 'pw-test-123');
    if (await p.isVisible('#gate-pw2')) await p.fill('#gate-pw2', 'pw-test-123');
    await p.click('#gate-go');
    await p.waitForFunction(() => !document.body.classList.contains('locked'));

    const r = await p.evaluate(() => {
      const bild = id => {
        STATE.dossiers.auswahl = id; VIEW.dtab = 'info';
        dispatch({ type: 'NAVIGATION', modul: 'dossier' }); renderModule(); Leiste.sync();
        const m = document.querySelector('main');
        return {
          text: m.innerText,
          ids: Array.from(m.querySelectorAll('[id]'), x => x.id).join('|'),
          svg: Array.from(m.querySelectorAll('svg text, svg title'), x => x.textContent).join('|'),
          aria: Array.from(m.querySelectorAll('svg [aria-label]'), x => x.getAttribute('aria-label')).join('|'),
          ziele: Array.from(m.querySelectorAll('#vn-ziel option'), x => x.value + '=' + x.textContent).join('|'),
          pfad: document.getElementById('tb-path') ? document.getElementById('tb-path').textContent : null
        };
      };
      const ids = alleEntitaeten().map(e => e.id);
      const recherche = {}; ids.forEach(id => { recherche[id] = bild(id); });
      STATE.missionsbetrieb = true;
      /* Phase 5c1b: Missionsfelder eines überführten Zustands liegen im Altbestand */
      STATE.altbestand = { automatik: false, missionen: { M1: { status: 'laufend', angenommenAm: nowIso() } }, kontext: 'M1' };
      const abweichend = [];
      ids.forEach(id => {
        const alt = bild(id), ref = recherche[id];
        Object.keys(ref).forEach(k => { if (alt[k] !== ref[k]) abweichend.push(id + ':' + k); });
      });
      const o1 = entitaet('O-0001');
      return {
        anzahl: ids.length,
        altAktiv: STATE.missionsbetrieb === true && freigeschaltet('M1') && !missionsbetrieb(),
        abweichend,
        /* Seit 5b7 verhalten sich auch die historischen Helfer wie im Recherchebetrieb. */
        schutzAlt: schutz('Beirat bei O-0001'),
        anzeigeAlt: anzeige(o1),
        eckdatenP4: recherche['P-0004'].text.includes('Beirat bei O-0001'),
        pfadP4: recherche['P-0004'].pfad
      };
    });
    assert.ok(r, 'Altmission M1 im Zustand vorhanden');
    assert.ok(r.anzahl >= 28, 'alle Dossiers geprüft (' + r.anzahl + ')');
    assert.equal(r.altAktiv, true, 'Altfelder gesetzt, Missionsbetrieb seit 5b7 wirkungslos');
    assert.equal(r.eckdatenP4, true, 'Referenz: Eckdaten von P-0004 nennen O-0001 im Recherchebetrieb');
    assert.equal(r.pfadP4, '/dossier?id=P-0004', 'Referenz: Adresspfad mit Kennung');
    assert.deepEqual(r.abweichend, [], 'Modul Dossiers im Altzustand identisch zum Recherchebetrieb');
    assert.equal(r.schutzAlt, 'Beirat bei O-0001', 'schutz() ohne Wirkung des Altzustands');
    assert.equal(r.anzeigeAlt, 'O-0001 Havelstahl Handels GmbH', 'anzeige() ohne Wirkung des Altzustands');

    /* Verbindung entfernen im Altzustand: Szenario bleibt, Ausblendung nur im Profil. */
    const v = await p.evaluate(() => {
      STATE.dossiers.auswahl = 'P-0004'; VIEW.dtab = 'info'; renderModule();
      const knopf = !!document.getElementById('vx-V-S1');
      const imSzenario = () => SCENARIO.standard.verbindungen.some(x => x.id === 'V-S1');
      const vorher = imSzenario();
      dispatch({ type: 'VERBINDUNG_GELOESCHT', id: 'V-S1', dossier: 'P-0004' });
      return {
        knopf, vorher, nachher: imSzenario(),
        ausgeblendet: (PROFIL.ausgeblendeteKanten || []).includes('V-S1'),
        sichtbar: dossierRechercheKanten().some(x => x.id === 'V-S1'),
        tabelle: !!document.getElementById('vl-V-S1')
      };
    });
    assert.equal(v.knopf, true, 'Entfernen-Knopf für Szenarioverbindung auch im Altzustand');
    assert.equal(v.vorher && v.nachher, true, 'Szenarioverbindung bleibt im Szenario erhalten');
    assert.equal(v.ausgeblendet, true, 'Ausblendung im Profil vermerkt');
    assert.equal(v.sichtbar || v.tabelle, false, 'Verbindung aus Recherche und Tabelle ausgeblendet');

    /* Manuelle Sperre bleibt maßgeblich, auch für Nachbarn in der Beziehungsansicht. */
    const s = await p.evaluate(() => {
      STATE.dossiers.auswahl = 'P-0005'; renderModule();
      const knotenVorher = !!document.getElementById('gn-O-0001');
      dispatch({ type: 'DOSSIER_SPERREN', id: 'O-0001' });
      STATE.dossiers.auswahl = 'O-0001'; renderModule();
      const maske = !!document.getElementById('dg-pw') && !document.getElementById('btn-dbearb');
      STATE.dossiers.auswahl = 'P-0005'; renderModule();
      const knoten = !!document.getElementById('gn-O-0001');
      dispatch({ type: 'DOSSIER_ENTSPERREN', id: 'O-0001' });
      STATE.dossiers.auswahl = 'O-0001'; renderModule();
      return { knotenVorher, maske, knoten, frei: !!document.getElementById('btn-dbearb') };
    });
    assert.equal(s.knotenVorher, true, 'Referenz: O-0001 ist Nachbar von P-0005 in der Beziehungsansicht');
    assert.equal(s.maske, true, 'manuelle Sperre zeigt die Kennungsmaske');
    assert.equal(s.knoten, false, 'gesperrtes Dossier erscheint nicht als Knoten beim Nachbarn');
    assert.equal(s.frei, true, 'Entsperren stellt die Ansicht wieder her');
    assert.deepEqual(errors, [], 'keine Browserfehler');
    console.log('OK: Phase 5b6 – Modul Dossiers im Altzustand identisch zum Recherchebetrieb (' + r.anzahl + ' Dossiers); Szenario, Sperren und Altlogik erhalten');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
