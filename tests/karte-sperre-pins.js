/* Pins gesperrter Dossiers: Die Sperre eines Pins leitet sich ausschließlich aus seinem verknüpften Dossier ab (zielZugang,
   pinGesperrt). Ein solcher Pin wird wie die Sichtungen des Dossiers nicht gezeichnet; Popup, Lage-Box, Kartensprung,
   Umgebungsliste, 3D-Übergabe und Kartenprotokoll zeigen weder Name noch Position noch Notiz. Unverknüpfte Pins bleiben frei.
   Nach dem Entsperren ist alles wieder da. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { APP } = require('./_pfad');

(async () => {
  const b = await chromium.launch();
  try {
    const p = await b.newPage({ viewport: { width: 1500, height: 1000 }, reducedMotion: 'reduce' });
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
      dispatch({ type: 'DOSSIER_ANGELEGT', name: 'Quarzfeld Testmann', typ: 'Person' });
      const e = STATE.dossiers.eigene.find(x => x.name === 'Quarzfeld Testmann');
      dispatch({ type: 'PIN_ANGELEGT', ll: [52.5201, 13.4051], name: 'Kühlhaus Quellweg', dossier: e.id, notiz: 'Zufahrt über den Hof' });
      const verknuepft = PROFIL.pins.at(-1).id;
      dispatch({ type: 'PIN_ANGELEGT', ll: [52.5203, 13.4053], name: 'Parkplatz Nord' });
      return { e: e.id, pin: verknuepft, frei: PROFIL.pins.at(-1).id };
    });
    const zugang = id => p.evaluate(i => { const a = zielZugang(i); return a && { art: a.art, dossier: a.dossier, gesperrt: a.gesperrt, info: a.info }; }, id);
    const marker = () => p.evaluate(() => karteMarker().filter(m => m.kat === 'pin').map(m => m.id));
    const karteZeigen = async reiter => {
      await p.evaluate(r => { VIEW.karte.reiter = r; VIEW.karte.lat = 52.52; VIEW.karte.lon = 13.405; VIEW.karte.zoom = 15; dispatch({ type: 'NAVIGATION', modul: 'karte' }); renderModule(); }, reiter);
      await p.waitForTimeout(300);
    };
    const text = () => p.evaluate(() => document.body.innerText);

    /* Vor der Sperre: beide Pins frei und gezeichnet */
    assert.deepEqual(await zugang(z.pin), { art: 'pin', dossier: z.e, gesperrt: false, info: false });
    assert.deepEqual(await zugang(z.frei), { art: 'pin', dossier: null, gesperrt: false, info: false });
    assert.deepEqual(await zugang(z.e), { art: 'dossier', dossier: z.e, gesperrt: false, info: false });
    assert.equal(await zugang('P-9999'), null);
    assert.deepEqual((await marker()).filter(i => i === z.pin || i === z.frei).sort(), [z.pin, z.frei].sort());

    /* Sperren */
    await p.evaluate(i => dispatch({ type: 'DOSSIER_SPERREN', id: i }), z.e);
    assert.equal((await zugang(z.pin)).gesperrt, true, 'Sperre aus dem Dossier abgeleitet');
    assert.equal((await zugang(z.frei)).gesperrt, false, 'unverknüpfter Pin bleibt frei');
    assert.equal((await zugang(z.e)).gesperrt, true);
    const m = await marker();
    assert.equal(m.includes(z.pin), false, 'Pin des gesperrten Dossiers nicht gezeichnet');
    assert.equal(m.includes(z.frei), true);
    assert.equal(await p.evaluate(i => kartenObjektZeigen(i), z.pin), false, 'Kartensprung verweigert');
    assert.notEqual(await p.evaluate(() => VIEW.karte.auswahl), z.pin);
    assert.equal(await p.evaluate(i => karteBezugVon(i), z.pin), null, 'Lage-Box');
    assert.equal(await p.evaluate(([frei, pin]) => pinNaehe(PROFIL.pins.find(x => x.id === frei), 1000).some(q => q.id === pin), [z.frei, z.pin]), false, 'Umgebungsliste');
    assert.doesNotMatch(await p.evaluate(() => JSON.stringify(karte3dDaten())), /Kühlhaus Quellweg/, '3D-Übergabe');
    await karteZeigen('karte');
    await p.evaluate(i => { VIEW.karte.auswahl = i; karteAuswahlAnzeige(); }, z.pin);
    assert.equal(await p.evaluate(() => document.getElementById('k-auswahl').hidden), true, 'kein Popup');
    let t = await text();
    assert.doesNotMatch(t, /Kühlhaus Quellweg|Zufahrt über den Hof|Quarzfeld/);
    /* Popup des freien Pins: Dossier-Auswahl nennt das gesperrte Dossier nur mit Kennung */
    await p.evaluate(i => { VIEW.karte.auswahl = i; karteAuswahlAnzeige(); }, z.frei);
    assert.equal(await p.evaluate(() => document.getElementById('k-auswahl').hidden), false);
    assert.equal(await p.evaluate(i => [...document.querySelectorAll('#pin-dossier option')].some(o => o.value === i), z.e), true);
    assert.doesNotMatch(await text(), /Quarzfeld/, 'Auswahl maskiert');
    /* Phase 5b8: Die PACE-Sammelpunktauswahl (planPanel) ist mit dem Missionsmodul entfernt; frühere Texte bleiben maskiert. */
    const historisch = await p.evaluate(pin => {
      const block = document.createElement('div');
      block.textContent = 'Kommunikationsplan: Sammelpunkt Kühlhaus Quellweg; Pin ' + pin;
      document.body.appendChild(block); sperreMaskieren(block);
      const ausgabe = block.textContent; block.remove(); return ausgabe;
    }, z.pin);
    assert.equal(historisch, 'Kommunikationsplan: Sammelpunkt ' + z.pin + '; Pin ' + z.pin,
      'frühere Texte werden beim Anzeigen maskiert');
    await karteZeigen('protokoll');
    t = await text();
    assert.match(t, new RegExp(z.pin), 'Protokoll mit Kennung');
    assert.doesNotMatch(t, /Kühlhaus Quellweg|52\.5201/, 'Protokoll ohne Name und Position');
    assert.match(t, /Parkplatz Nord/);

    /* Entsperren: alles wieder da */
    await p.evaluate(i => dispatch({ type: 'DOSSIER_ENTSPERREN', id: i }), z.e);
    assert.equal((await zugang(z.pin)).gesperrt, false);
    assert.equal((await marker()).includes(z.pin), true);
    await karteZeigen('protokoll');
    assert.match(await text(), /Kühlhaus Quellweg/);
    await karteZeigen('karte');
    assert.equal(await p.evaluate(i => kartenObjektZeigen(i), z.pin), true);
    assert.equal(await p.evaluate(() => VIEW.karte.auswahl), z.pin);
    assert.match(await text(), /Zufahrt über den Hof|Kühlhaus Quellweg/);
    assert.deepEqual(errors, []);
    console.log('OK: Pins gesperrter Dossiers (zielZugang, Karte, Popup, Lage-Box, 3D, Protokoll)');
  } finally { await b.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
