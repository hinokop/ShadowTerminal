/* Paket 2, E5 (Review #138): der deutsche Archivexport bleibt bytegenau unverändert, obwohl /intel dieselben Renderer mit englischer
   Beschriftung nutzt. Erwartete Texte: tests/_fixture-export-de.json (erzeugt mit den Renderern von main 07a736d). Die Zeile "Aktualität"
   hängt vom Alter der Sichtung ab und wird vor dem Vergleich vereinheitlicht. Zusätzlich: englische Fassung derselben Objekte ohne deutsche
   Systembeschriftung. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright');
const { APP } = require('./_pfad');

const fx = JSON.parse(fs.readFileSync(path.join(__dirname, '_fixture-export-de.json'), 'utf8'));
(async () => {
  const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'ft-intelx-')), { reducedMotion: 'reduce' });
  try {
    const p = await ctx.newPage();
    const fehler = [];
    p.on('pageerror', e => fehler.push(e.message));
    await p.route(/^https?:/, r => r.abort());
    await p.goto(APP);
    await p.fill('#gate-pw', 'pw-test-123');
    if (await p.isVisible('#gate-pw2')) await p.fill('#gate-pw2', 'pw-test-123');
    await p.click('#gate-go');
    await p.waitForFunction(() => typeof APP_BEREIT !== 'undefined' && APP_BEREIT && !!STATE);
    const r = await p.evaluate((o) => {
      const e = entitaet('P-0001');
      return [pinText(o.pin), pinText(o.pin2), eigeneZoneText(o.zone), eigeneZoneText(o.zone2), sichtungText(e, o.si), sichtungText(e, o.si2)];
    }, fx.objekte);
    const gleich = t => t.replace(/^Aktualität: .*$/m, 'Aktualität: <alter>');
    fx.erwartet.forEach((x, i) => assert.equal(gleich(r[i]), gleich(x.text), x.f + ' #' + i + ' bytegenau'));
    assert.equal(r.length, fx.erwartet.length);
    /* englische Fassung (wie in /intel): keine deutsche Systembeschriftung, Benutzerinhalte unverändert */
    const en = await p.evaluate((o) => {
      dispatch({ type: 'PIN_ANGELEGT', ll: o.pin.ll, name: o.pin.name, notiz: o.pin.notiz });
      const id = PROFIL.pins.at(-1).id;
      dispatch({ type: 'PIN_GEAENDERT', id: id, zwecke: o.pin.zwecke, umgebung: o.pin.umgebung });
      return INTEL.readFile(['geospatial', 'pins', id, 'record']).text;
    }, fx.objekte);
    assert.doesNotMatch(en, /^(Zweck|Zufahrten und Wege|Notiz|Angelegt|Position laut Meldung):|nicht festgelegt/m);
    assert.match(en, /^Note: Hinterhof$/m);
    assert.match(en, /^Access routes: zwei Zufahrten$/m);
    assert.deepEqual(fehler, []);
    console.log('OK: terminal-intel-export (deutscher Export bytegenau, englische Fassung)');
  } finally { await ctx.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
