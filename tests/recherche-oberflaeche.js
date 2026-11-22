/* Keine Auftragsanzeigen in der Recherche, auch wenn ein gespeicherter Zustand den Missionsbetrieb gesetzt hat. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const PF = require('./_pfad.js');
const alt = require('./fixtures/altprofil-mission.json');

(async () => {
  const b = await chromium.launch();
  try {
    const p = await b.newPage({ reducedMotion: 'reduce', viewport: { width: 1500, height: 1100 } });
    const fehler = [];
    p.on('pageerror', e => fehler.push(e.message));
    await p.route(/^https?:/, r => r.abort());
    async function start() {
      await p.goto(PF.APP);
      await p.locator('#gate-pw').fill('pw-test-123');
      const zweite = p.locator('#gate-pw2');
      if (await zweite.isVisible()) await zweite.fill('pw-test-123');
      await p.locator('#gate-go').click();
      await p.waitForFunction(() => !document.body.classList.contains('locked'));
    }
    async function pruefeAnsicht() {
      for (const id of ['banner-top', 'banner-bottom']) {
        assert.match(await p.locator('#' + id).textContent(), / · interner Bereich$/);
        assert.equal(await p.locator('#' + id).getAttribute('aria-label'), 'Bereich');
      }
      assert.equal(await p.locator('#h-standort, #h-standort-btn').count(), 0);
      for (const id of ['h-agent', 'h-status', 'h-kanal', 'h-dtg']) assert.ok(await p.locator('#' + id).isVisible());
      await p.keyboard.press('3');
      await p.locator('#k-st-t').click();
      assert.equal(await p.locator('.mod-head > span').first().textContent(), 'Modul 3');
      assert.match(await p.locator('#k-st-pos').textContent(), /Kartenmitte/);
      for (const id of ['k-pin-neu', 'k-ozone-neu', 'k-messen', 'k-st-licht', 'k-st-wetter', 'ke-zonen', 'ke-orte', 'ke-ausgang']) {
        assert.ok(await p.locator('#' + id).isVisible(), id);
      }
      for (const id of ['k-zone-neu', 'k-zugriff-neu', 'k-mehr', 'k-dt', 'k-p-zeit', 'ke-fenster', 'ke-strecke', 'k-st-stufe', 'k-st-ci', 'k-st-ziele', 'k-st-fenster']) {
        assert.equal(await p.locator('#' + id).count(), 0, id);
      }
      assert.doesNotMatch(await p.locator('#k-ebenen').textContent(), /Auftrag|Check-in|Roter Ring/);
    }
    await start();
    await pruefeAnsicht();
    await p.evaluate(({ state, profil }) => {
      /* Gegenprobe mit einem bereits gesetzten Flag. Automatik und fällige Antworten sind nicht Gegenstand des UI-Tests. */
      state.missionsbetrieb = true;
      state.automatik = false;
      state.plan = state.plan.filter(x => x.typ !== 'antwort');
      if (state.serie.folge) state.serie.folge.faelligAm = new Date(Date.now() + 3600000).toISOString();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      localStorage.setItem(PROFIL_KEY, JSON.stringify(profil));
    }, alt);
    await start();
    await pruefeAnsicht();
    const vorhanden = await p.evaluate(() => {
      const K = VIEW.karte;
      const d = PROFIL.eigene[0], pin = PROFIL.pins[0], zone = PROFIL.zonen[0], def = KM();   /* gespeicherte Kontextmission (Altfeld) */
      const ll = karteKoord(d.id) || pin.ll;
      const gespeicherteMission = JSON.stringify(MS(def.id));
      /* Farbe und Zusatzringe testen, auch wenn das Altprofil das Dossier genau an den alten Check-in setzt. */
      PROFIL.koord[d.id] = ll;
      STATE.agent.checkin.standortId = d.id;
      Object.assign(K, { lat: ll[0], lon: ll[1], zoom: 10 });
      zeichneKarte($('k-svg'));
      const m = karteMarker(), drei = karte3dDaten();
      return {
        altmodus: !!def && STATE.altbestand.missionsbetrieb === true && !missionsbetrieb() && zDef() === null,   /* Phase 5c1b: Altfeld im Altbestand */ standorteAlt: def.standorte.length,
        missionUnveraendert: gespeicherteMission === JSON.stringify(MS(def.id)),
        eigeneObjekte: m.some(x => x.id === pin.id) && m.some(x => x.id === d.id) && drei.zonen.some(x => x.id === zone.id),
        ohneMissionsebenen: m.every(x => !['standort', 'zugriff'].includes(x.kat) && !x.stufe && !x.asset && !x.zusatz) &&
          drei.marker.every(x => x.stufe === 0) && drei.zonen.length === PROFIL.zonen.length &&
          !$('k-svg').querySelector('.k-hoch-ring, .k-checkin, .k-ziel, .k-fenster, .k-strecke, .k-zone.auto')
      };
    });
    assert.ok(vorhanden.altmodus && vorhanden.standorteAlt > 0);
    assert.ok(vorhanden.missionUnveraendert && vorhanden.eigeneObjekte && vorhanden.ohneMissionsebenen, JSON.stringify(vorhanden));
    assert.deepEqual(fehler, []);
    console.log('OK: neutrale Rechercheoberfläche im frischen und im gespeicherten Missionszustand, Profilobjekte in 2D und 3D');
  } finally {
    await b.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
