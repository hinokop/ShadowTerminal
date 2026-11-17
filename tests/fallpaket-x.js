/* Fallpaket direkt in X: "Fallpaket sichern" exportiert den geöffneten Fall, "Fallpaket importieren" ist auch ohne Fall verfügbar.
   Nutzt die vorhandene Paketlogik. Exit-Code 1 bei Fehlschlag. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');
const { APP } = require('./_pfad');
(async () => {
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 }, reducedMotion: 'reduce', acceptDownloads: true });
    const p = await ctx.newPage();
    const fehler = []; p.on('pageerror', e => fehler.push(e.message));
    await p.route(/^https?:/, r => r.abort());
    await p.goto(APP); await p.fill('#gate-pw', 'pw-test-123'); if (await p.isVisible('#gate-pw2')) await p.fill('#gate-pw2', 'pw-test-123'); await p.click('#gate-go');
    await p.waitForFunction(() => !document.body.classList.contains('locked'));
    /* ohne Fall: Import verfügbar, Export nicht */
    await p.evaluate(() => { PROFIL.recherche.faelle = []; profilSpeichern(); dispatch({ type: 'NAVIGATION', modul: 'x' }); });
    assert.equal(await p.locator('#x-paket-laden').count(), 1, 'Import auch ohne Fall verfügbar');
    assert.equal(await p.locator('#x-paket-sichern').count(), 0, 'ohne Fall kein Export');
    /* mit Fall: Export genau dieses Falls */
    const ids = await p.evaluate(() => {
      dispatch({ type: 'DOSSIER_ANGELEGT', typ: 'Person', name: 'Paketperson', land: 'DE' }); const d = STATE.dossiers.auswahl;
      const a = xAnlegen({ titel: 'Paketfall A', frage: 'Lage A' }), b = xAnlegen({ titel: 'Paketfall B' });
      dispatch({ type: 'RECHERCHE_BELEG', dossier: d, fall: a.id, art: 'Text', herkunft: 'Quelle A', fassung: { text: 'Text A' }, zitat: 'Zitat A' });
      profilSpeichern(); xOeffnen(a.id); return { a: a.id, b: b.id };
    });
    assert.ok((await p.locator('#x-paket-sichern').innerText()).includes(ids.a), 'Schaltfläche nennt den geöffneten Fall');
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#x-paket-sichern')]);
    assert.ok(dl.suggestedFilename().includes('fallpaket-' + ids.a), 'Dateiname nennt den Fall');
    const pfad = await dl.path(); const inhalt = JSON.parse(fs.readFileSync(pfad, 'utf8'));
    assert.equal(inhalt.format, 'fieldterminal-fallpaket'); assert.equal(inhalt.inhalt.fall.id, ids.a); assert.equal(inhalt.inhalt.fall.titel, 'Paketfall A');
    assert.equal(inhalt.inhalt.quellen.length, 1, 'enthält nur die Quellen dieses Falls');
    /* anderer Fall geöffnet: exportiert diesen */
    await p.evaluate(i => xOeffnen(i), ids.b);
    const [dl2] = await Promise.all([p.waitForEvent('download'), p.click('#x-paket-sichern')]);
    assert.equal(JSON.parse(fs.readFileSync(await dl2.path(), 'utf8')).inhalt.fall.id, ids.b);
    /* Rundweg: alle Fälle löschen, Import ohne Fall über die Oberfläche */
    await p.evaluate(() => { PROFIL.recherche.faelle = []; PROFIL.recherche.quellen = []; PROFIL.recherche.fassungen = []; PROFIL.recherche.beobachtungen = []; profilSpeichern(); X_VIEW.id = null; renderModule(); });
    assert.equal(await p.locator('#x-paket-sichern').count(), 0);
    await p.setInputFiles('#x-paket-laden', pfad);
    await p.locator('#x-fall-' + ids.a).waitFor();
    assert.equal(await p.evaluate(i => xFall(i).titel, ids.a), 'Paketfall A', 'Fall nach Import in der Liste');
    assert.ok(await p.evaluate(() => PROFIL.recherche.beobachtungen.length) === 1, 'Unterlage importiert');
    /* beschädigtes Paket wird abgelehnt */
    const kaputt = JSON.parse(fs.readFileSync(pfad, 'utf8')); kaputt.inhalt.fall.titel = 'verfälscht'; const kp = pfad + '.kaputt.json'; fs.writeFileSync(kp, JSON.stringify(kaputt));
    await p.evaluate(() => { PROFIL.recherche.faelle = []; profilSpeichern(); renderModule(); });
    await p.setInputFiles('#x-paket-laden', kp);
    await p.waitForFunction(() => document.getElementById('sys-msg').innerText.includes('abgelehnt'));
    assert.equal(await p.evaluate(() => PROFIL.recherche.faelle.length), 0, 'nichts übernommen');
    assert.deepEqual(fehler, []);
    console.log('OK: Fallpaket in X (sichern, importieren)');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
