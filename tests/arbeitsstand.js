/* Arbeitsstand: ausdrücklich speichern und wiederherstellen (Arbeitsbereich, Dossier, Fall in X, Kartenmitte, Zoom, Ebenen, Kartenobjekt);
   kein automatischer Sprung beim Start; gelöschte oder gesperrte Objekte werden übersprungen. Exit-Code 1 bei Fehlschlag. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { APP } = require('./_pfad');
(async () => {
  const browser = await chromium.launch();
  try {
    const p = await browser.newPage({ viewport: { width: 1500, height: 1000 }, reducedMotion: 'reduce' });
    const fehler = []; p.on('pageerror', e => fehler.push(e.message));
    await p.route(/^https?:/, r => r.abort());
    const start = async () => {
      await p.goto(APP); await p.fill('#gate-pw', 'pw-test-123'); if (await p.isVisible('#gate-pw2')) await p.fill('#gate-pw2', 'pw-test-123'); await p.click('#gate-go');
      await p.waitForFunction(() => !document.body.classList.contains('locked'));
    };
    await start();
    assert.equal(await p.locator('#as-wieder').isDisabled(), true, 'ohne Stand nicht wählbar');
    const s = await p.evaluate(() => {
      dispatch({ type: 'DOSSIER_ANGELEGT', typ: 'Person', name: 'Standperson', land: 'DE' }); const d = STATE.dossiers.auswahl;
      dispatch({ type: 'DOSSIER_ANGELEGT', typ: 'Person', name: 'Zweitperson', land: 'DE' }); const d2 = STATE.dossiers.auswahl;
      dispatch({ type: 'PIN_ANGELEGT', ll: [52.5, 13.4], name: 'Standpin' }); const pin = PROFIL.pins.at(-1).id;
      const f = xAnlegen({ titel: 'Standfall' }); const f2 = xAnlegen({ titel: 'Zweitfall' }); profilSpeichern();
      /* gewünschter Stand */
      dispatch({ type: 'NAVIGATION', modul: 'karte' });
      return { d, d2, pin, f: f.id, f2: f2.id };
    });
    await p.waitForTimeout(1200);                                                    /* Karte initialisiert sich beim ersten Öffnen */
    await p.evaluate(s => {
      STATE.dossiers.auswahl = s.d; VIEW.dtab = 'sichtungen'; X_VIEW.id = s.f;
      Object.assign(VIEW.karte, { lat: 52.4, lon: 13.3, zoom: 11, auswahl: s.pin }); VIEW.karte.ebenen.sichtungen = false; VIEW.karte.ebenen.zonen = false;
    }, s);
    await p.click('#as-speichern');
    assert.equal(await p.locator('#as-wieder').isDisabled(), false, 'nach dem Sichern wählbar');
    const gespeichert = await p.evaluate(() => JSON.parse(localStorage.getItem(PROFIL_KEY)).arbeitsstand);
    assert.equal(gespeichert.modul, 'karte'); assert.equal(gespeichert.dossier, s.d); assert.equal(gespeichert.fall, s.f); assert.equal(gespeichert.karte.zoom, 11);
    /* alles verändern, dann wiederherstellen */
    await p.evaluate(s => { STATE.dossiers.auswahl = s.d2; VIEW.dtab = 'info'; X_VIEW.id = s.f2; Object.assign(VIEW.karte, { lat: 40, lon: 5, zoom: 6, auswahl: null }); VIEW.karte.ebenen.sichtungen = true; VIEW.karte.ebenen.zonen = true; dispatch({ type: 'NAVIGATION', modul: 'akten' }); }, s);
    await p.click('#as-wieder');
    assert.equal(await p.locator('#mod-title').textContent(), 'Karte', 'das Kartenmodul ist tatsächlich aufgebaut');
    assert.ok(await p.locator('#k-svg').count() > 0, 'Kartenansicht sichtbar');
    assert.equal(await p.locator('#nav-karte').getAttribute('aria-current'), 'page');
    const r = await p.evaluate(() => ({ modul: STATE.ui.modul, d: STATE.dossiers.auswahl, dtab: VIEW.dtab, fall: X_VIEW.id, k: { lat: VIEW.karte.lat, lon: VIEW.karte.lon, zoom: VIEW.karte.zoom, auswahl: VIEW.karte.auswahl, sicht: VIEW.karte.ebenen.sichtungen, zonen: VIEW.karte.ebenen.zonen } }));
    assert.deepEqual(r, { modul: 'karte', d: s.d, dtab: 'sichtungen', fall: s.f, k: { lat: 52.4, lon: 13.3, zoom: 11, auswahl: s.pin, sicht: false, zonen: false } });
    /* kein automatischer Sprung beim Start */
    await p.evaluate(() => dispatch({ type: 'NAVIGATION', modul: 'akten' }));
    await start();
    assert.equal(await p.evaluate(() => STATE.ui.modul), 'akten', 'Start übernimmt den zuletzt offenen Bereich, nicht den gespeicherten Arbeitsstand (karte)');
    assert.equal(await p.evaluate(() => !!PROFIL.arbeitsstand), true, 'Stand bleibt gespeichert');
    /* gelöschtes Pin, gesperrtes Dossier, gelöschter Fall werden übersprungen, nichts bricht */
    await p.evaluate(s => {
      dispatch({ type: 'PIN_ENTFERNT', id: s.pin }); (PROFIL.gesperrt ||= []).push(s.d);
      PROFIL.recherche.faelle = PROFIL.recherche.faelle.filter(f => f.id !== s.f);
      STATE.dossiers.auswahl = s.d2; X_VIEW.id = s.f2;
    }, s);
    await p.click('#as-wieder');
    const u = await p.evaluate(() => ({ d: STATE.dossiers.auswahl, fall: X_VIEW.id, auswahl: VIEW.karte.auswahl, zoom: VIEW.karte.zoom, msg: document.querySelector('#sys-msg').innerText, modul: STATE.ui.modul }));
    assert.equal(u.d, s.d2, 'gesperrtes Dossier wird nicht gewählt'); assert.equal(u.fall, s.f2, 'gelöschter Fall wird nicht gewählt');
    assert.equal(u.auswahl, null); assert.equal(u.zoom, 11); assert.equal(u.modul, 'karte');
    for (const t of ['übersprungen', 'Dossier ' + s.d, 'Fall ' + s.f, 'Kartenobjekt ' + s.pin]) assert.ok(u.msg.includes(t), 'Meldung nennt ' + t);
    /* Dossier und X: das Modul baut sich sichtbar mit dem gespeicherten Objekt auf */
    const ziele = await p.evaluate(() => { const l = alleEntitaeten().filter(e => !e.eigen && wissen(e) === 'frei'); return { d: l[0].id, name: l[0].name }; });
    await p.evaluate(z => { PROFIL.gesperrt = []; STATE.dossiers.auswahl = z.d; VIEW.dtab = 'info'; dispatch({ type: 'NAVIGATION', modul: 'dossier' }); }, ziele);
    await p.click('#as-speichern');
    await p.evaluate(() => dispatch({ type: 'NAVIGATION', modul: 'akten' }));
    await p.click('#as-wieder');
    assert.equal(await p.locator('#mod-title').textContent(), 'Dossiers');
    assert.ok((await p.locator('#main, main, body').first().innerText()).includes(ziele.name), 'gewähltes Dossier sichtbar');
    /* X sichtbar: Fall A sichern, Fall B öffnen, Stand laden, Fall A steht im Formular */
    await p.evaluate(() => { PROFIL.gesperrt = []; });
    const xf = await p.evaluate(() => {
      const b = xAnlegen({ titel: 'Fall Beta sichtbar' }), a = xAnlegen({ titel: 'Fall Alpha sichtbar' }); profilSpeichern();
      X_VIEW.id = a.id; dispatch({ type: 'NAVIGATION', modul: 'x' }); return { a: a.id, b: b.id };
    });
    assert.equal(await p.inputValue('#x-titel'), 'Fall Alpha sichtbar');
    await p.click('#as-speichern');
    await p.evaluate(b => xOeffnen(b), xf.b);
    assert.equal(await p.inputValue('#x-titel'), 'Fall Beta sichtbar');
    await p.click('#as-wieder');
    assert.equal(await p.inputValue('#x-titel'), 'Fall Alpha sichtbar', 'Stand laden zeigt Fall A tatsächlich im Formular');
    /* Fall A löschen, Nummer neu vergeben: der alte Stand öffnet den Ersatzfall nicht */
    const ers = await p.evaluate(a => {
      PROFIL.recherche.faelle = PROFIL.recherche.faelle.filter(f => f.id !== a);
      const e = xAnlegen({ titel: 'Ersatzfall' }); profilSpeichern();
      X_VIEW.id = null; renderModule(); return e.id;
    }, xf.a);
    assert.equal(ers, xf.a, 'Voraussetzung: Nummer wird wiedervergeben');
    await p.evaluate(() => new Promise(r => setTimeout(r, 50)));
    await p.click('#as-wieder');
    const ue = await p.evaluate(() => ({ fall: X_VIEW.id, msg: document.querySelector('#sys-msg').innerText }));
    assert.notEqual(ue.fall, ers, 'Ersatzfall mit gleicher Nummer wird nicht geöffnet');
    assert.ok(ue.msg.includes('Fall ' + xf.a), 'Meldung nennt den übersprungenen Fall');
    /* Karte: nach dem Laden kein Platziermodus */
    await p.evaluate(() => dispatch({ type: 'NAVIGATION', modul: 'karte' }));
    await p.waitForTimeout(600);
    await p.click('#as-speichern');
    await p.click('#k-pin-neu');
    assert.equal(await p.evaluate(() => !!VIEW.karte.pinSetzen), true, 'Voraussetzung: Pin-Modus aktiv');
    await p.evaluate(() => { VIEW.karte.zoneSetzen = 'eigen'; VIEW.karte.zugriffSetzen = true; });
    await p.click('#as-wieder');
    assert.deepEqual(await p.evaluate(() => ({ p: VIEW.karte.pinSetzen, z: VIEW.karte.zoneSetzen, g: VIEW.karte.zugriffSetzen })), { p: false, z: false, g: false });
    assert.equal(await p.locator('#k-svg').getAttribute('class').then(c => c.includes('pick')), false, 'Karte zeigt kein Fadenkreuz');
    assert.equal(await p.locator('#k-pin-neu').getAttribute('aria-pressed'), 'false');
    assert.deepEqual(fehler, []);
    console.log('OK: Arbeitsstand sichern und wiederherstellen, kein Autosprung, Überspringen');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
