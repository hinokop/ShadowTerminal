/* Phase 5c2b D2: genau eine globale Deklaration von sichtungText (karte-modul.js) und unveränderter Sichtungstext.
   Statisch: in den geladenen Anwendungsskripten steht genau eine Deklaration function sichtungText(…), und zwar in karte-modul.js.
   Laufzeit: sichtungText hat zwei Parameter; der Text einer bestätigten Sichtung mit Entwurfs-Pin entspricht dem festgehaltenen Wortlaut
   (Zeitzone UTC, Sichtungszeit fest gesetzt). Der Wortlaut wurde vor der Entfernung der überlagerten Variante aus index.html auf main erzeugt. Exit-Code 1 bei Fehlschlag. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const PF = require('./_pfad');

/* Statisch: alle lokal geladenen Skripte aus index.html plus der Inhalt von index.html selbst */
const html = fs.readFileSync(PF.APP.replace(/^file:\/\//, ''), 'utf8');
const dir = path.dirname(PF.APP.replace(/^file:\/\//, ''));
const quellen = [['index.html', html]];
for (const m of html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)) if (!/^https?:/.test(m[1]) && /\.js$/.test(m[1])) {
  const f = path.join(dir, m[1]); if (fs.existsSync(f)) quellen.push([m[1], fs.readFileSync(f, 'utf8')]);
}
const treffer = [];
for (const [name, text] of quellen) for (const m of text.matchAll(/^[ \t]*function\s+sichtungText\s*\(/gm)) treffer.push(name);
assert.ok(quellen.some(q => q[0] === 'karte-modul.js'), 'karte-modul.js wird von index.html geladen');
assert.deepEqual(treffer, ['karte-modul.js'], 'genau eine Deklaration von sichtungText, in karte-modul.js: ' + JSON.stringify(treffer));

/* Normalisiert: „Güte“ (Wert derzeit ein Elementobjekt als Text, bekannte Abweichung außerhalb von D2, siehe Dokumentation) und „Angelegt“ (Erfassungszeit) */
const SOLL = "<SI> · Dossier <D> Textperson\nZeit: 02.01.2026 03:04:05Z\nOrt laut Meldung: 52.5000, 13.4000\nPosition: 52.50000, 13.40000 (ungefähr, aus Koordinate)\nGüte: <Wert>\nBeobachtung: Person gesehen\n\nEntwurf: <PIN> Treffpunkt Nord\nPosition: 52.50000, 13.40000\nZweck: Treffpunkt\n\nZufahrten und Wege: zwei Zufahrten\nSichtlinien: –\nFluchtmöglichkeiten: –\nPublikumsverkehr: –\nKameras, Beleuchtung: –\nNachbarschaft, Gewerbe: –\n\nNotiz: Notiz vom Entwurf\n\nAngelegt: <Zeit>";

(async () => {
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 }, timezoneId: 'UTC', locale: 'de-DE' });
    const p = await ctx.newPage(); const fehler = []; p.on('pageerror', e => fehler.push(e.message));
    await p.route(/^https?:/, r => r.abort());
    await p.goto(PF.APP); await p.fill('#gate-pw', 'pw-test-123'); if (await p.isVisible('#gate-pw2')) await p.fill('#gate-pw2', 'pw-test-123'); await p.click('#gate-go');
    await p.waitForFunction(() => !document.querySelector('#gate-seq').hidden || !document.body.classList.contains('locked')); await p.keyboard.press('Space');
    const r = await p.evaluate(() => {
      dispatch({ type: 'DOSSIER_ANGELEGT', typ: 'Person', name: 'Textperson', land: 'DE' }); const d = STATE.dossiers.auswahl;
      dispatch({ type: 'PIN_ANGELEGT', ll: [52.5, 13.4], name: 'Treffpunkt Nord', dossier: d, notiz: 'Notiz vom Entwurf' }); const pin = PROFIL.pins.at(-1);
      dispatch({ type: 'PIN_GEAENDERT', id: pin.id, zwecke: [PIN_ZWECKE[0]], umgebung: { [PIN_UMGEBUNG[0][0]]: 'zwei Zufahrten' } });
      dispatch({ type: 'SICHTUNG_HINZU', id: d, ort: '52.5000, 13.4000', text: 'Person gesehen', guete: 'gesichert', pin: pin.id });
      const e = entitaet(d), si = STATE.dossiers.entitaeten[d].sichtungen[0];
      si.t = '2026-01-02T03:04:05.000Z'; pin.stand = '2026-01-02T03:04:05.000Z';
      return { laenge: sichtungText.length, text: sichtungText(e, si).split(d).join('<D>').split(si.id).join('<SI>').split(pin.id).join('<PIN>').replace(/^Güte: .*$/m, 'Güte: <Wert>').replace(/^Angelegt: .*$/m, 'Angelegt: <Zeit>') };
    });
    assert.equal(r.laenge, 2, 'sichtungText(e, si) ist die wirksame Variante');
    assert.equal(r.text, SOLL, 'Sichtungstext unverändert:\n' + r.text);
    assert.deepEqual(fehler, [], 'keine Browserfehler');
    console.log('phase5c2b-sichtungtext: OK');
  } finally { await browser.close(); }
})().catch(e => { console.error('FAIL', e.message || e); process.exit(1); });
