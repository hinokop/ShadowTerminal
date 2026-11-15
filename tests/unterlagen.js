/* Unterlagen zum Fall: Standardansicht ohne Aussagen, einklappbares Formular, optionale und materialabhängige Fundstelle, Fallübernahme,
   Liste ohne horizontales Scrollen, Details aufklappbar, Markierung "geprüft und nützlich" mit Notiz, Sichtung-Button mit Entwurfs-Pin. Exit-Code 1 bei Fehlschlag. */
const PF = require('./_pfad.js'); const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1500, height: 1100 } }); const p = await ctx.newPage(); const err = [];
  p.on('pageerror', x => err.push(x.message)); ctx.on('page', pg => { if (pg !== p) pg.close().catch(() => {}); });
  await p.route(/geobasis|eox|gdi\.berlin|cartocdn|open-meteo|openfreemap|unpkg/, r => r.abort());
  const start = async () => { await p.goto(PF.APP); await p.waitForTimeout(5200); await p.fill('#gate-pw', 'pw-test-123'); const z = await p.$('#gate-pw2'); if (z && await z.isVisible()) await z.fill('pw-test-123'); await p.click('#gate-go');
    await p.waitForFunction(() => !document.body.classList.contains('locked'), null, { timeout: 20000 }); };
  const zeigen = (name) => p.evaluate(n => { STATE.dossiers.auswahl = STATE.dossiers.eigene.find(x => x.name === n).id; dispatch({ type: 'NAVIGATION', modul: 'dossier' }); renderModule(); }, name);
  const sys = () => p.textContent('#sys-msg');
  const buf = Buffer.from('%PDF-1.4\n% Unterlage\n'.repeat(20));
  await start();
  await p.evaluate(() => { dispatch({ type: 'DOSSIER_ANGELEGT', typ: 'Person', name: 'Unterlagentest', land: 'DE' }); });
  await zeigen('Unterlagentest');
  const ueberschriften = await p.evaluate(() => Array.from(document.querySelectorAll('section.panel > h2, #rch-dossier-unterlagen > summary')).map(h => h.textContent.trim()));
  const formularZu = await p.evaluate(() => !document.getElementById('rch-ok') && !!document.getElementById('rch-neu'));
  const ohneAussagenmaske = await p.evaluate(() => !document.getElementById('rca-neu') && !document.getElementById('rca-text'));
  await p.locator('#rch-dossier-unterlagen > summary').click();
  /* Formular öffnen, schließen, wieder öffnen */
  await p.click('#rch-neu'); const offen = await p.evaluate(() => !!document.getElementById('rch-ok')); await p.click('#rch-abbruch'); const zu2 = await p.evaluate(() => !document.getElementById('rch-ok')); await p.click('#rch-neu');
  const labels = await p.evaluate(() => ({ quelle: document.querySelector('label[for="rch-herkunft"]')?.textContent === 'Quelle oder URL' && !document.getElementById('rch-herkunft').hasAttribute('placeholder'), alt: document.body.innerText.includes('Herkunft oder Adresse') }));
  /* ohne Fall: Frage nach der Zuordnung, nichts angelegt */
  await p.fill('#rch-text', 'Erster Auszug ohne Fundstelle'); await p.click('#rch-ok'); await p.waitForTimeout(200);
  const ohneFall = await p.evaluate(() => PROFIL.recherche.beobachtungen.length); const msgFall = await sys();
  /* neuer Fall, Text ohne Fundstelle (Absatz, aber ohne Wert) */
  await p.selectOption('#rch-fall', '__neu'); await p.fill('#rch-fall-titel', 'Radweg'); await p.click('#rch-ok'); await p.waitForTimeout(400);
  const a1 = await p.evaluate(() => ({ n: PROFIL.recherche.beobachtungen.length, ft: PROFIL.recherche.beobachtungen[0] && PROFIL.recherche.beobachtungen[0].fundstelle, sel: VIEW.recherche.fall, zu: !document.getElementById('rch-ok') }));
  /* zweiter Eintrag: Fall ist übernommen; Fundstellenarten passen zum Material */
  await p.click('#rch-neu');
  const fallUebernommen = await p.evaluate(() => document.getElementById('rch-fall').value === PROFIL.recherche.faelle[0].id);
  const optionen = () => p.evaluate(() => Array.from(document.getElementById('rch-ft-typ').options).map(o => o.value));
  const oText = await optionen();
  await p.setInputFiles('#rch-datei', { name: 'film.mp4', mimeType: 'video/mp4', buffer: Buffer.from('x') }); const oVideo = await optionen();
  await p.setInputFiles('#rch-datei', { name: 'bild.png', mimeType: 'image/png', buffer: Buffer.from('x') }); const oBild = await optionen();
  await p.setInputFiles('#rch-datei', { name: 'blatt.pdf', mimeType: 'application/pdf', buffer: buf }); const oPdf = await optionen();
  const dateiBleibt = await p.evaluate(() => document.getElementById('rch-datei').files.length === 1);
  await p.fill('#rch-ft-wert', '4'); await p.fill('#rch-herkunft', 'https://example.org/blatt'); await p.click('#rch-ok'); await p.waitForTimeout(800);
  const a2 = await p.evaluate(() => { const R = PROFIL.recherche; const bz = R.beobachtungen[1]; return { n: R.beobachtungen.length, ft: bz.fundstelle, art: R.quellen[1].art, herkunft: R.quellen[1].herkunft, datei: R.fassungen[1].dateiname }; });
  /* weitere Optionen: Zeichenbereich bei Text */
  await p.click('#rch-neu'); await p.click('#rch-weitere summary'); await p.selectOption('#rch-ft-typ2', 'Zeichenbereich'); await p.fill('#rch-ft-wert', '120–260');
  await p.fill('#rch-text', 'Dritter Auszug mit ' + 'sehr langem Inhalt, '.repeat(30) + 'ENDE-MARKE'); await p.click('#rch-ok'); await p.waitForTimeout(400);
  const a3 = await p.evaluate(() => PROFIL.recherche.beobachtungen[2] && PROFIL.recherche.beobachtungen[2].fundstelle);
  /* Liste: kein horizontales Scrollen, Details zunächst verborgen */
  const layout = w => p.evaluate(w => { const s = document.getElementById('rch-dossier-unterlagen');
    const alt = s.style.width; s.style.width = w ? w + 'px' : ''; const ok = s.scrollWidth <= s.clientWidth + 1 && !s.querySelector('.tw'); s.style.width = alt; return ok; }, w);
  const kein1500 = await layout(0), kein700 = await layout(520);
  const verborgen = await p.evaluate(() => { const t = document.getElementById('rch-u-B-002').innerText; return !/[0-9a-f]{64}/.test(t) && !t.includes('Q-002') && !t.includes('Erfasst'); });
  const sichtbarNachOeffnen = await p.evaluate(() => { document.getElementById('rch-d-B-002').open = true; const t = document.getElementById('rch-u-B-002').innerText; return t.includes('Q-002') && t.includes('V-002') && t.includes('Erfasst'); });
  /* Öffnen und Volltext */
  await p.click('#rch-o-B-002'); await p.waitForTimeout(800); const msgOeffnen = await sys();
  const voll = await p.evaluate(() => { const el = document.querySelector('#rch-z-B-003 [data-vollstaendig]'); return !!el && el.textContent.endsWith('ENDE-MARKE'); });
  /* Markierung mit Notiz */
  await p.fill('#rch-n-B-002', 'Nennt das Eröffnungsdatum'); await p.click('#rch-m-B-002'); await p.waitForTimeout(300);
  const m1 = await p.evaluate(() => { const x = PROFIL.recherche.beobachtungen[1]; return { ok: x.pruefung && x.pruefung.nuetzlich, notiz: x.pruefung && x.pruefung.notiz, badge: document.getElementById('rch-u-B-002').innerText.includes('geprüft und nützlich'), aussagen: PROFIL.recherche.aussagen.length, knopf: document.getElementById('rch-m-B-002').textContent }; });
  await start(); await zeigen('Unterlagentest');
  await p.locator('#rch-dossier-unterlagen > summary').click();
  const m2 = await p.evaluate(() => { const x = PROFIL.recherche.beobachtungen[1]; return { ok: x.pruefung.nuetzlich, notiz: x.pruefung.notiz, am: !!x.pruefung.am, sichtbar: document.getElementById('rch-u-B-002').innerText.includes('geprüft und nützlich'), fall: rchFallAuswahl(STATE.dossiers.entitaeten[STATE.dossiers.auswahl]) }; });
  await p.click('#rch-m-B-002'); await p.waitForTimeout(300);
  const m3 = await p.evaluate(() => { const x = PROFIL.recherche.beobachtungen[1]; return { ok: x.pruefung.nuetzlich, notiz: x.pruefung.notiz }; });
  /* Speicher voll: Markierung wird zurückgenommen */
  const voll2 = await p.evaluate(async () => { const orig = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (String(k).endsWith('.profil')) throw new Error('quota'); return orig.call(this, k, v); };
    const log0 = STATE.log.length; const ok = rchSchreiben({ type: 'RECHERCHE_UNTERLAGE_MARKIERT', beob: 'B-001', geprueft: true, notiz: 'x' }, 'Unterlage geprüft'); Storage.prototype.setItem = orig;
    return { ok, pr: PROFIL.recherche.beobachtungen[0].pruefung || null, log: STATE.log.length - log0 }; });
  /* eine Unterlage ohne Fundstelle lässt sich ablegen und markieren */
  const gp = await p.evaluate(() => { const R = PROFIL.recherche; dispatch({ type: 'RECHERCHE_UNTERLAGE_MARKIERT', beob: 'B-001', geprueft: true }); return { marke: R.beobachtungen[0].pruefung.nuetzlich, fs: R.beobachtungen[0].fundstelle }; });
  const ohneAussagenAktionen = await p.evaluate(() => !Object.keys(ACTIONS).some(k => /^RECHERCHE_(AUSSAGE|PRUEFSTAND|BELEG_VERKN|BELEG_GELOEST)/.test(k)));
  /* Sichtung-Button */
  await p.evaluate(() => { dispatch({ type: 'DOSSIER_ANGELEGT', typ: 'Person', name: 'Ohne Ort', land: 'DE' }); dispatch({ type: 'DOSSIER_ANGELEGT', typ: 'Person', name: 'Mit Ort', land: 'DE', koord: '52.5000, 13.4000' }); });
  await zeigen('Ohne Ort'); await p.click('#btn-dk-sichtung'); await p.waitForTimeout(300);
  const ohneOrt = await p.evaluate(() => ({ pins: (PROFIL.pins || []).length, tab: VIEW.dtab, mod: STATE.ui.modul }));
  await zeigen('Mit Ort'); await p.evaluate(() => { VIEW.dtab = 'info'; renderModule(); }); await p.click('#btn-dk-sichtung'); await p.waitForTimeout(1000);
  const s1 = await p.evaluate(() => { const pin = PROFIL.pins[PROFIL.pins.length - 1]; return { name: pin.name, ll: pin.ll, dossier: pin.dossier === STATE.dossiers.eigene.find(x => x.name === 'Mit Ort').id, mod: STATE.ui.modul, lat: VIEW.karte.lat, auswahl: VIEW.karte.auswahl === pin.id, marker: karteMarker().some(m => m.id === pin.id) }; });
  await zeigen('Mit Ort'); await p.evaluate(() => { VIEW.dtab = 'sichtungen'; renderModule(); }); await p.click('#si-pin-' + await p.evaluate(() => PROFIL.pins[PROFIL.pins.length - 1].id)); await p.waitForTimeout(300);
  const s2 = await p.evaluate(() => { const e = STATE.dossiers.eigene.find(x => x.name === 'Mit Ort'), si = STATE.dossiers.entitaeten[e.id].sichtungen, pin = PROFIL.pins[PROFIL.pins.length - 1];
    const k = si[0] ? sichtungKoord(si[0]) : null; return { n: si.length, id: si[0] && si[0].id, pin: pin.sichtung, ll: k && k.ll, markerSichtung: karteMarker().some(m => m.kat === 'sichtung' && m.id === si[0].id) }; });
  /* nächster Start liegt an der letzten Sichtung; Pinnummer zählt weiter */
  await p.evaluate(() => { const e = STATE.dossiers.eigene.find(x => x.name === 'Mit Ort'); dispatch({ type: 'SICHTUNG_HINZU', id: e.id, ort: '52.6100, 13.5100', text: 'neuere Sichtung', guete: 'unbewertet' }); });
  await zeigen('Mit Ort'); await p.evaluate(() => { VIEW.dtab = 'info'; renderModule(); }); await p.click('#btn-dk-sichtung'); await p.waitForTimeout(300);
  const s3 = await p.evaluate(() => { const pin = PROFIL.pins[PROFIL.pins.length - 1]; return { name: pin.name, ll: pin.ll, n: PROFIL.pins.length }; });
  const r = {
    titelUnterlagen: ueberschriften.some(t => t.startsWith('Unterlagen zu diesem Dossier')) && !ueberschriften.some(t => /^Recherchebelege/i.test(t)), ohneAussagenmaske: ohneAussagenmaske && !ueberschriften.some(t => /^Aussagen$/i.test(t)),
    formularEingeklappt: formularZu && offen && zu2, labelQuelle: labels.quelle && !labels.alt, ohneFallFrage: ohneFall === 0 && /Fall/.test(msgFall),
    fundstelleOptional: a1.n === 1 && a1.ft === null && a1.sel === 'F-001' && a1.zu, fallUebernommen: fallUebernommen,
    fundstelleNachMaterial: JSON.stringify(oText) === '["Absatz","Abschnitt"]' && JSON.stringify(oVideo) === '["Zeitmarke"]' && JSON.stringify(oBild) === '[""]' && JSON.stringify(oPdf) === '["Seite"]' && dateiBleibt,
    pdfMitSeite: a2.n === 2 && a2.ft.typ === 'Seite' && a2.ft.wert === '4' && a2.art === 'Datei' && a2.herkunft === 'https://example.org/blatt' && a2.datei === 'blatt.pdf', weitereOptionen: a3 && a3.typ === 'Zeichenbereich' && a3.wert === '120–260',
    keinHorizontalesScrollen: kein1500 && kein700, detailsVerborgen: verborgen && sichtbarNachOeffnen, oeffnen: /Prüfsumme stimmt/.test(msgOeffnen), volltext: voll,
    markierung: m1.ok === true && m1.notiz === 'Nennt das Eröffnungsdatum' && m1.badge && m1.aussagen === 0 && m1.knopf === 'Markierung zurücknehmen',
    markierungErhalten: m2.ok === true && m2.notiz === 'Nennt das Eröffnungsdatum' && m2.am && m2.sichtbar, markierungZurueck: m3.ok === false && m3.notiz === 'Nennt das Eröffnungsdatum',
    markierungRollback: voll2.ok === false && voll2.pr === null && voll2.log === 0,
    ohneAussagenAktionen: ohneAussagenAktionen,
    ohneFundstelleMarkierbar: gp.marke === true && gp.fs === null,
    sichtungOhneOrt: ohneOrt.pins === 0 && ohneOrt.tab === 'sichtungen',
    sichtungPin: s1.name === 'M-01' && Math.abs(s1.ll[0] - 52.5) < 1e-6 && Math.abs(s1.ll[1] - 13.4) < 1e-6 && s1.dossier && s1.mod === 'karte' && Math.abs(s1.lat - 52.5) < 1e-6 && s1.auswahl && s1.marker,
    sichtungAusPin: s2.n === 1 && /^SI-/.test(s2.id) && s2.pin === s2.id && s2.ll && Math.abs(s2.ll[0] - 52.5) < 1e-4 && s2.markerSichtung,
    sichtungLetzterPunkt: s3.name === 'M-02' && Math.abs(s3.ll[0] - 52.61) < 1e-6 && Math.abs(s3.ll[1] - 13.51) < 1e-6 && s3.n === 2,
    keineFehler: err.length === 0
  };
  console.log(JSON.stringify({ r, a1, a2, a3, oText, oVideo, oBild, oPdf, m2, voll2, gp, ohneOrt, s1, s2, s3, msgOeffnen, err }));
  await b.close(); process.exit(Object.values(r).every(v => v === true) ? 0 : 1);
})();
