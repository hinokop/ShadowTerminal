/* Nächster Schritt im Lagebriefing (X): manuell gepflegter Eintrag je Fall mit Änderungszeitpunkt; Speichern über xSchreiben mit Rücknahme;
   Fallpaket-Rundtest (Export, Wiederimport, altes Paket ohne das Feld, Manipulation). Exit-Code 1 bei Fehlschlag. */
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
    const f = await p.evaluate(() => { const a = xAnlegen({ titel: 'Schrittfall' }), b = xAnlegen({ titel: 'Anderer Fall' }); profilSpeichern(); xOeffnen(a.id); return { a: a.id, b: b.id }; });
    const lies = id => p.evaluate(i => JSON.parse(localStorage.getItem(PROFIL_KEY)).recherche.faelle.find(x => x.id === i).naechsterSchritt || null, id);
    assert.equal(await lies(f.a), null, 'zunächst kein Eintrag');
    assert.ok((await p.locator('#x-briefing').innerText()).includes('Kein nächster Schritt'), 'leere Anzeige');
    /* speichern */
    await p.fill('#x-schritt', 'Pressestelle anrufen');
    await p.click('#x-schritt-speichern');
    const s1 = await lies(f.a);
    assert.equal(s1.text, 'Pressestelle anrufen'); assert.ok(/^\d{4}-\d\d-\d\dT/.test(s1.am), 'Zeitpunkt gesetzt');
    assert.equal(await p.inputValue('#x-schritt'), 'Pressestelle anrufen');
    assert.ok((await p.locator('#x-briefing').innerText()).includes('Zuletzt geändert'), 'Änderungszeitpunkt sichtbar');
    assert.equal(await lies(f.b), null, 'anderer Fall unberührt');
    /* unverändert: Zeitpunkt bleibt */
    await p.waitForTimeout(30);
    await p.click('#x-schritt-speichern');
    assert.equal((await lies(f.a)).am, s1.am, 'ohne Änderung kein neuer Zeitpunkt');
    /* ändern: neuer Zeitpunkt; Länge auf 200 begrenzt */
    await p.waitForTimeout(30);
    await p.fill('#x-schritt', 'x'.repeat(250));
    await p.click('#x-schritt-speichern');
    const s2 = await lies(f.a);
    assert.equal(s2.text.length, 200, 'höchstens 200 Zeichen'); assert.notEqual(s2.am, s1.am);
    /* Speicherfehler: Rücknahme, Anzeige zeigt den bisherigen Stand */
    await p.fill('#x-schritt', 'Neuer Text, wird nicht gespeichert');
    await p.evaluate(() => { window.__ps = profilSpeichern; profilSpeichern = () => false; });
    await p.click('#x-schritt-speichern');
    await p.evaluate(() => { profilSpeichern = window.__ps; });
    assert.equal(await p.evaluate(i => xFall(i).naechsterSchritt.text.length, f.a), 200, 'Speicherfehler: Stand zurückgenommen');
    assert.ok((await p.locator('#sys-msg').innerText()).includes('nicht gespeichert'), 'Meldung bei Speicherfehler');
    /* Fall speichern (Formular) lässt den Eintrag unberührt */
    await p.fill('#x-schritt', 'Pressestelle anrufen'); await p.click('#x-schritt-speichern');
    await p.click('#x-speichern');
    assert.equal((await lies(f.a)).text, 'Pressestelle anrufen', 'Fallformular verändert den Schritt nicht');
    /* nach Neustart weiter vorhanden */
    await start(); await p.evaluate(i => xOeffnen(i), f.a);
    assert.equal(await p.inputValue('#x-schritt'), 'Pressestelle anrufen', 'nach Neustart sichtbar');
    /* Fallpaket-Rundtest */
    const amVorExport = (await lies(f.a)).am;
    const paket = await p.evaluate(async i => (await rchPaketBauen(i)).text, f.a);
    assert.equal(JSON.parse(paket).inhalt.fall.naechsterSchritt.text, 'Pressestelle anrufen', 'Export enthält den Schritt');
    const lade = (t, n) => p.evaluate(async ([t, n]) => { rchPaketLaden(new File([t], n, { type: 'application/json' })); await new Promise(r => setTimeout(r, 1800)); return document.getElementById('sys-msg').textContent; }, [t, n]);
    await p.evaluate(i => { PROFIL.recherche.faelle = PROFIL.recherche.faelle.filter(x => x.id !== i); profilSpeichern(); }, f.a);
    await lade(paket, 'p.json');
    const zurueck = await p.evaluate(() => PROFIL.recherche.faelle.map(x => ({ id: x.id, t: x.titel, s: x.naechsterSchritt && x.naechsterSchritt.text, am: x.naechsterSchritt && x.naechsterSchritt.am })));
    const imp = zurueck.find(x => x.t === 'Schrittfall');
    assert.ok(imp, 'Fall importiert'); assert.equal(imp.s, 'Pressestelle anrufen', 'Schritt nach Wiederimport erhalten'); assert.equal(imp.am, amVorExport, 'Änderungszeitpunkt bleibt erhalten');
    /* Wiederholung: nichts doppelt */
    const vorher = await p.evaluate(() => PROFIL.recherche.faelle.length);
    await lade(paket, 'p.json');
    assert.equal(await p.evaluate(() => PROFIL.recherche.faelle.length), vorher, 'zweiter Import erzeugt keinen zweiten Fall');
    /* Manipulation am Schritt wird über die Prüfsumme erkannt */
    const P = JSON.parse(paket); P.inhalt.fall.naechsterSchritt.text = 'verfälscht';
    await lade(JSON.stringify(P), 'm.json');
    assert.equal(await p.evaluate(() => PROFIL.recherche.faelle.some(x => x.naechsterSchritt && x.naechsterSchritt.text === 'verfälscht')), false, 'manipuliertes Paket wird abgelehnt');
    /* altes Paket ohne das Feld bleibt importierbar */
    const alt = await p.evaluate(async () => { const g = xAnlegen({ titel: 'Altfall ohne Schritt' }); profilSpeichern(); const t = (await rchPaketBauen(g.id)).text; PROFIL.recherche.faelle = PROFIL.recherche.faelle.filter(x => x.id !== g.id); profilSpeichern(); return t; });
    assert.equal('naechsterSchritt' in JSON.parse(alt).inhalt.fall, false);
    await lade(alt, 'alt.json');
    const a2 = await p.evaluate(() => PROFIL.recherche.faelle.find(x => x.titel === 'Altfall ohne Schritt'));
    assert.ok(a2 && !('naechsterSchritt' in a2), 'altes Paket ohne Feld importiert');
    await p.evaluate(i => xOeffnen(i), a2.id);
    assert.equal(await p.inputValue('#x-schritt'), '', 'leeres Feld bei Fall ohne Schritt');
    /* leeren entfernt den Eintrag */
    await p.evaluate(i => xOeffnen(i), imp.id);
    await p.fill('#x-schritt', '   '); await p.click('#x-schritt-speichern');
    assert.equal(await lies(imp.id), null, 'Leeren entfernt den Eintrag');
    /* ungespeicherter Entwurf überlebt das Löschen des Falls nicht: gleiche Nummer, neuer Fall, leeres Feld */
    const dn = await p.evaluate(() => { const g = xAnlegen({ titel: 'Entwurfsfall' }); profilSpeichern(); xOeffnen(g.id); return g.id; });
    await p.fill('#x-schritt', 'nie gespeichert');
    await p.evaluate(async i => { await xLoeschen(i); }, dn);
    assert.equal(await p.evaluate(i => !!xFall(i), dn), false, 'Voraussetzung: Fall gelöscht');
    const dn2 = await p.evaluate(() => { const g = xAnlegen({ titel: 'Ersatz Entwurf' }); profilSpeichern(); xOeffnen(g.id); return g.id; });
    assert.equal(dn2, dn, 'Voraussetzung: Nummer wiedervergeben');
    assert.equal(await p.inputValue('#x-schritt'), '', 'Schrittfeld des neuen Falls ist leer');
    assert.deepEqual(fehler, []);
    console.log('OK: Nächster Schritt im Lagebriefing, Fallpaket-Rundtest');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
