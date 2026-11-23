/* Phase 5c2b (b): Karte mit vorhandenem Altbestand (kontrollierte Migrationsfixture tests/fixtures/altprofil-mission.json, Format 4 mit
   Missionsdaten, Überführung nach Format 5). Frühere Karteskripte (kt, kv3, kt2, kt3) setzten nur Vorbedingungen auf einem Zustand ohne
   Altbestand; dieser Test prüft die Karte erstmals gegen einen echten Altbestand.
   Belegt wird:
   (1) die Fixture wird überführt und enthält einen Altbestand mit Kenntnisstand (infozugang), Aussagen und Missionsfeldern;
   (2) Karte, Marker (Pin, Dossier, Sichtung) und Ebenen funktionieren; die Markermenge ist identisch mit der Markermenge desselben
       Zustands ohne Altbestand (Differenz: Altbestand zeitweise ausgeblendet);
   (3) der Altbestand bleibt im Speicher und im gespeicherten Zustand unverändert, auch nach Kartenaktionen und Neuladen;
   (4) keine Seitenfehler. Exit-Code 1 bei Fehlschlag. */
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { APP } = require('./_pfad');
const FIX = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'altprofil-mission.json'), 'utf8'));

async function anmelden(p) {
  await p.fill('#gate-pw', 'pw-test-123');
  if (await p.isVisible('#gate-pw2')) await p.fill('#gate-pw2', 'pw-test-123');
  await p.click('#gate-go');
  await p.waitForFunction(() => !document.body.classList.contains('locked'));
}

(async () => {
  const browser = await chromium.launch();
  const fehler = [];
  try {
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 }, reducedMotion: 'reduce' });
    const p = await ctx.newPage();
    p.setDefaultTimeout(20000);
    p.on('pageerror', e => fehler.push(e.message));
    await p.route(/^https?:/, r => r.abort());
    await p.goto(APP);
    const s = JSON.parse(JSON.stringify(FIX.state)), pr = JSON.parse(JSON.stringify(FIX.profil));
    s.infozugang = Object.assign({}, s.infozugang, { 'P-0001': { status: 'bekannt' }, 'P-0002': { status: 'frei' } });
    s.aussagen = [{ id: 'AS-001', t: '2026-11-15T05:00:00.000Z', entitaet: 'P-0001', wert: true, text: 'alte Aussage', status: 'gilt' }];
    pr.koord = Object.assign({}, pr.koord, { 'P-0001': [52.52, 13.405], 'P-0002': [52.523, 13.406] });
    await p.evaluate(a => { localStorage.setItem(STORAGE_KEY, a.s); localStorage.setItem(PROFIL_KEY, a.p); }, { s: JSON.stringify(s), p: JSON.stringify(pr) });
    await p.goto(APP);
    await anmelden(p);

    /* (1) Überführung und Altbestand */
    const alt = await p.evaluate(() => ({ v: STATE.version, a: JSON.parse(JSON.stringify(STATE.altbestand || null)) }));
    assert.equal(alt.v, 5, 'Fixture auf Format 5 überführt');
    assert.ok(alt.a && alt.a.infozugang && alt.a.infozugang['P-0001'].status === 'bekannt', 'Altbestand mit Kenntnisstand vorhanden');
    assert.equal(alt.a.aussagen.length, 1, 'Altbestand mit Aussage vorhanden');
    assert.ok(Array.isArray(alt.a.verstaerkung) || alt.a.missionen, 'Altbestand mit Missionsfeldern vorhanden');

    /* (2) Karte mit Altbestand */
    const k = await p.evaluate(() => {
      const d = STATE.dossiers.entitaeten['P-0001'];
      d.sichtungen = d.sichtungen || [];
      d.sichtungen.push({ id: 'SI-902', uid: 'c2karte5c2b', t: nowIso(), ort: '52.5200, 13.4050', text: 'Sichtung zur Karte mit Altbestand', guete: 'unbewertet', quelle: 'Eintrag' });
      VIEW.karte.ebenen.personen = true;
      VIEW.karte.ebenen.sichtungen = true;
      dispatch({ type: 'NAVIGATION', modul: 'karte' });
      renderModule();
      const ids = () => karteMarker().map(m => m.id).sort();
      const mit = ids();
      const behalten = STATE.altbestand;
      delete STATE.altbestand;
      let ohne;
      try { ohne = ids(); } finally { STATE.altbestand = behalten; }
      return { mit, ohne, pin: mit.includes('PIN-001'), dossier: mit.includes('P-0001'), sichtung: mit.includes('SI-902') };
    });
    await p.waitForSelector('#k-svg');
    assert.ok(k.mit.length >= 3, 'Marker vorhanden: ' + k.mit.join(','));
    assert.ok(k.pin && k.dossier && k.sichtung, 'Pin, Dossier und Sichtung als Marker mit Altbestand: ' + k.mit.join(','));
    assert.deepEqual(k.mit, k.ohne, 'Markermenge mit und ohne Altbestand identisch');

    /* Ebenen umschalten und neu zeichnen */
    await p.evaluate(() => {
      ['personen', 'sichtungen'].forEach(e => { VIEW.karte.ebenen[e] = false; renderModule(); VIEW.karte.ebenen[e] = true; renderModule(); });
    });
    await p.waitForSelector('#k-svg');

    /* (3) Altbestand unverändert */
    const ist = () => p.evaluate(() => ({ mem: JSON.parse(JSON.stringify(STATE.altbestand)), disk: JSON.parse(localStorage.getItem(STORAGE_KEY)).altbestand }));
    let n = await ist();
    assert.deepEqual(n.mem, alt.a, 'Altbestand im Speicher unverändert nach Kartenaktionen');
    assert.deepEqual(n.disk, alt.a, 'Altbestand gespeichert unverändert nach Kartenaktionen');
    await p.reload();
    await anmelden(p);
    n = await ist();
    assert.deepEqual(n.mem, alt.a, 'Altbestand nach Neuladen im Speicher unverändert');
    assert.deepEqual(n.disk, alt.a, 'Altbestand nach Neuladen gespeichert unverändert');

    /* (4) */
    assert.deepEqual(fehler, [], 'keine Seitenfehler: ' + fehler.join(' | '));
    console.log('Phase 5c2b (b) Karte mit Altbestand: ALLE OK');
  } catch (e) {
    console.log('FEHLER: ' + (e && e.message || e));
    process.exitCode = 1;
  } finally { await browser.close(); }
})();
