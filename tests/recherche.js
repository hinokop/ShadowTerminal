/* Unterlagen zum Fall ohne Auftrag: Fallwahl ohne Standardfall, Fundstelle, bytegetreue Datei mit Prüfsumme, Erhalt nach Neustart und Reset, Manipulationsanzeige.
   Exit-Code 1 bei Fehlschlag. */
const PF = require('./_pfad.js'); const { chromium } = require('playwright'); const crypto = require('crypto');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1500, height: 1000 }, permissions: [] }); const p = await ctx.newPage(); const err = [];
  p.on('pageerror', x => err.push(x.message)); ctx.on('page', pg => { if (pg !== p) pg.close().catch(() => {}); });
  await p.route(/geobasis|eox|gdi\.berlin|cartocdn|open-meteo|openfreemap|unpkg/, r => r.abort());
  const start = async () => { await p.goto(PF.APP); await p.waitForTimeout(5200); await p.fill('#gate-pw', 'pw-test-123'); const z = await p.$('#gate-pw2'); if (z && await z.isVisible()) await z.fill('pw-test-123'); await p.click('#gate-go');
    await p.waitForFunction(() => !document.body.classList.contains('locked'), null, { timeout: 20000 }); };
  const sys = () => p.textContent('#sys-msg');
  await start();
  const buf = Buffer.from('%PDF-1.4\n% Testbeleg fuer die Recherche, Seite 2\n'.repeat(20)); const sha = crypto.createHash('sha256').update(buf).digest('hex');
  await p.evaluate(() => { dispatch({ type: 'DOSSIER_ANGELEGT', typ: 'Person', name: 'Belegtest', land: 'DE' }); dispatch({ type: 'NAVIGATION', modul: 'dossier' }); renderModule(); });
  await p.locator('#rch-dossier-unterlagen > summary').click();
  await p.click('#rch-neu'); await p.waitForSelector('#rch-ok');
  const v0 = await p.evaluate(() => ({ mission: !!LM(), dok: STATE.seq.dok || 0, faelle: PROFIL.recherche.faelle.length, belege: PROFIL.recherche.beobachtungen.length }));
  /* ohne Fallwahl: nichts wird angelegt */
  await p.fill('#rch-text', 'Wörtlicher Auszug'); await p.click('#rch-ok'); await p.waitForTimeout(300);
  const ohneFall = await p.evaluate(() => ({ n: PROFIL.recherche.beobachtungen.length, f: PROFIL.recherche.faelle.length }));
  const msgOhneFall = await sys();
  /* neuer Fall, Datei, Seite 2 */
  await p.selectOption('#rch-fall', '__neu'); await p.fill('#rch-fall-titel', 'Radweg Eröffnung'); await p.fill('#rch-fall-frage', 'Wann wurde der Radweg eröffnet?');
  await p.setInputFiles('#rch-datei', { name: 'projektblatt.pdf', mimeType: 'application/pdf', buffer: buf });
  await p.selectOption('#rch-ft-typ', 'Seite'); await p.fill('#rch-ft-wert', '2'); await p.fill('#rch-herkunft', 'Projektblatt');
  await p.click('#rch-ok'); await p.waitForTimeout(800);
  const a = await p.evaluate(() => { const R = PROFIL.recherche; return { faelle: R.faelle.length, q: R.quellen.length, v: R.fassungen.length, b: R.beobachtungen.length, f: R.fassungen[0], ft: R.beobachtungen[0] && R.beobachtungen[0].fundstelle, dossier: R.beobachtungen[0] && R.beobachtungen[0].dossiers, dok: STATE.seq.dok || 0 }; });
  /* Textbeleg im bestehenden Fall, ohne Datei, Fundstelle Absatz */
  const fallId = await p.evaluate(() => PROFIL.recherche.faelle[0].id);
  await p.click('#rch-neu'); await p.selectOption('#rch-fall', fallId); await p.fill('#rch-text', 'Eröffnung am 12. Juli'); await p.selectOption('#rch-ft-typ', 'Absatz'); await p.fill('#rch-ft-wert', '3'); await p.click('#rch-ok'); await p.waitForTimeout(500);
  const t = await p.evaluate(() => ({ b: PROFIL.recherche.beobachtungen.length, faelle: PROFIL.recherche.faelle.length, art: PROFIL.recherche.quellen[1] && PROFIL.recherche.quellen[1].art }));
  /* Neustart */
  await start(); await p.evaluate(() => { dispatch({ type: 'NAVIGATION', modul: 'dossier' }); renderModule(); }); await p.waitForSelector('#rch-neu', { state: 'attached' });
  const n = await p.evaluate(async () => {
    const e = STATE.dossiers.eigene.find(x => x.name === 'Belegtest'); STATE.dossiers.auswahl = e.id; renderModule();
    dispatch({ type: 'RESET' }); const z = rchBelege(e)[0]; const blob = await RIDB.get(z.f.anhang);
    const buf2 = blob ? new Uint8Array(await blob.arrayBuffer()) : null;
    return { belege: rchBelege(e).length, blobGroesse: blob ? blob.size : -1, hash: await rchHash(blob), erste: buf2 ? Array.from(buf2.slice(0, 8)) : null };
  });
  await p.evaluate(() => { STATE.dossiers.auswahl = STATE.dossiers.eigene.find(x => x.name === 'Belegtest').id; dispatch({ type: 'NAVIGATION', modul: 'dossier' }); renderModule(); }); await p.waitForSelector('#rch-neu', { state: 'attached' });
  if (await p.locator('#rch-dossier-unterlagen').getAttribute('open') === null) await p.locator('#rch-dossier-unterlagen > summary').click();
  /* Der Fallname steht in den Details jeder Unterlage, die Fundstelle bleibt in der Zeile sichtbar. */
  const dateiZeile = p.locator('#rch-u-B-001'), textZeile = p.locator('#rch-u-B-002');
  await dateiZeile.locator('details[id^="rch-d-"] > summary').click();
  await textZeile.locator('details[id^="rch-d-"] > summary').click();
  const zeilen = /Fundstelle: Seite 2/.test(await dateiZeile.innerText()) &&
    /Fundstelle: Absatz 3/.test(await textZeile.innerText()) &&
    [await dateiZeile.innerText(), await textZeile.innerText()].every(zeile => zeile.includes('F-001 Radweg Eröffnung'));
  /* Öffnen: Prüfsumme stimmt; danach manipulierte Datei */
  await p.evaluate(() => { const e = STATE.dossiers.eigene.find(x => x.name === 'Belegtest'); rchOeffnen(rchBelege(e)[0]); }); await p.waitForTimeout(800); const msgOk = await sys();
  await p.evaluate(async () => { const e = STATE.dossiers.eigene.find(x => x.name === 'Belegtest'); const z = rchBelege(e)[0]; await RIDB.put(z.f.anhang, new Blob(['verändert'], { type: 'application/pdf' })); rchOeffnen(z); }); await p.waitForTimeout(800); const msgManip = await sys();
  /* Regression 1: Profilspeicher voll: Eintrag zurücknehmen, Datei aufräumen, Entwurf behalten, kein Protokolleintrag */
  const vor = await p.evaluate(async () => {
    const e = STATE.dossiers.eigene.find(x => x.name === 'Belegtest'); STATE.dossiers.auswahl = e.id; dispatch({ type: 'NAVIGATION', modul: 'dossier' }); renderModule();
    return { n: PROFIL.recherche.beobachtungen.length, keys: (await RIDB.schluessel()).length, log: STATE.log.filter(x => x.aktion === 'Unterlage erfasst').length, fall: PROFIL.recherche.faelle[0].id };
  });
  const voll = await p.evaluate(async (vor) => {
    const e = STATE.dossiers.eigene.find(x => x.name === 'Belegtest');
    Object.assign(VIEW.draft, { 'rch-fall': vor.fall, 'rch-text': 'Auszug voll', 'rch-ft-typ': 'Absatz', 'rch-ft-wert': '9', 'rch-herkunft': 'H-voll' }); renderModule();
    VIEW.recherche.datei = new File([new Uint8Array([1, 2, 3, 4])], 'voll.bin', { type: 'application/octet-stream' }); VIEW.recherche.offen = true; renderModule();
    const orig = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (String(k).endsWith('.profil')) throw new Error('quota'); return orig.call(this, k, v); };
    rchErfassen(e); await new Promise(r => setTimeout(r, 900)); Storage.prototype.setItem = orig;
    return { n: PROFIL.recherche.beobachtungen.length, keys: (await RIDB.schluessel()).length, log: STATE.log.filter(x => x.aktion === 'Unterlage erfasst').length, text: VIEW.draft['rch-text'], herkunft: VIEW.draft['rch-herkunft'],
      gespeichertN: JSON.parse(localStorage.getItem(PROFIL_KEY)).recherche.beobachtungen.length, meldung: document.getElementById('sys-msg').textContent };
  }, vor);
  for (const k of ['rch-fall', 'rch-text', 'rch-ft-typ', 'rch-ft-typ2', 'rch-ft-wert', 'rch-herkunft', 'rch-notiz']) await p.evaluate(k => { delete VIEW.draft[k]; }, k);
  /* Regression 2: Eingaben werden beim Klick gemeinsam erfasst; ein neuer Entwurf geht beim Abschluss nicht verloren */
  const misch = await p.evaluate(async (vor) => {
    const e = STATE.dossiers.eigene.find(x => x.name === 'Belegtest'); renderModule();
    Object.assign(VIEW.draft, { 'rch-fall': vor.fall, 'rch-text': 'Auszug A', 'rch-ft-typ': 'Absatz', 'rch-ft-wert': '1', 'rch-herkunft': 'Herkunft A', 'rch-notiz': 'Notiz A' }); renderModule();
    VIEW.recherche.datei = new File([new Uint8Array([9, 9, 9])], 'a.bin', { type: 'application/octet-stream' }); VIEW.recherche.offen = true; renderModule();
    rchErfassen(e);
    VIEW.draft['rch-herkunft'] = 'Herkunft B'; VIEW.draft['rch-notiz'] = 'Notiz B'; VIEW.draft['rch-text'] = 'Auszug B';     /* neuer Entwurf, während A gespeichert wird */
    await new Promise(r => setTimeout(r, 900));
    const R = PROFIL.recherche, q = R.quellen[R.quellen.length - 1], bz = R.beobachtungen[R.beobachtungen.length - 1];
    return { herkunft: q.herkunft, notiz: q.notiz, zitat: bz.zitat, datei: R.fassungen[R.fassungen.length - 1].dateiname, dHerkunft: VIEW.draft['rch-herkunft'], dNotiz: VIEW.draft['rch-notiz'], dText: VIEW.draft['rch-text'] };
  }, vor);
  console.log(JSON.stringify({ vor, voll, misch }));
  console.log(JSON.stringify({ v0, ohneFall, a: { faelle: a.faelle, q: a.q, v: a.v, b: a.b, ft: a.ft, dossier: a.dossier, dok: a.dok, hashGespeichert: a.f && a.f.hash === sha, name: a.f && a.f.dateiname }, t, n: { belege: n.belege, blobGroesse: n.blobGroesse, hashGleich: n.hash === sha } }));
  console.log(msgOhneFall); console.log(msgOk); console.log(msgManip);
  let ok = true; const chk = (m, c) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) ok = false; };
  chk('Panel ohne laufenden Auftrag sichtbar', v0.mission === false);
  chk('Ohne Fallwahl wird nichts angelegt (kein Standardfall)', ohneFall.n === 0 && ohneFall.f === 0 && /Fall/.test(msgOhneFall));
  chk('Beleg mit neuem Fall: Fall, Quelle, Fassung, Beobachtung angelegt', a.faelle === 1 && a.q === 1 && a.v === 1 && a.b === 1);
  chk('Fundstelle und Dossierbezug gespeichert', a.ft && a.ft.typ === 'Seite' && a.ft.wert === '2' && a.dossier && a.dossier.length === 1);
  chk('Prüfsumme (SHA-256) entspricht den Originalbytes', a.f && a.f.hash === sha);
  chk('Missionszähler unverändert (eigener Pfad)', a.dok === v0.dok);
  chk('Textbeleg im bestehenden Fall ohne neuen Fall', t.b === 2 && t.faelle === 1 && t.art === 'Text');
  chk('Nach Neustart und Reset: Belege vorhanden', n.belege === 2); chk('Nach Neustart und Reset: Datei bytegetreu (Größe und Hash)', n.blobGroesse === buf.length && n.hash === sha);
  chk('Ansicht zeigt Fall und Fundstellen nach Neustart', zeilen); chk('Öffnen meldet stimmende Prüfsumme und Fundstelle', /Prüfsumme stimmt/.test(msgOk) && /Seite 2/.test(msgOk));
  chk('Veränderte Datei wird angezeigt', /ABWEICHENDE PRÜFSUMME/.test(msgManip)); chk('Speicher voll: kein zusätzlicher Beleg in App und Profil', voll.n === vor.n && voll.gespeichertN === vor.n); chk('Speicher voll: Datei aufgeräumt', voll.keys === vor.keys);
  chk('Speicher voll: Entwurf bleibt erhalten', voll.text === 'Auszug voll' && voll.herkunft === 'H-voll'); chk('Speicher voll: Fehler gemeldet, kein Protokolleintrag', /nicht gespeichert/.test(voll.meldung) && voll.log === vor.log);
  chk('Beleg enthält die Angaben vom Klick (Herkunft, Notiz, Auszug, Datei)', misch.herkunft === 'Herkunft A' && misch.notiz === 'Notiz A' && misch.zitat === 'Auszug A' && misch.datei === 'a.bin');
  chk('Neuer Entwurf geht beim Abschluss nicht verloren', misch.dHerkunft === 'Herkunft B' && misch.dNotiz === 'Notiz B' && misch.dText === 'Auszug B');
  chk('keine Seitenfehler', err.length === 0); if (err.length) console.log(err.join('|'));
  await b.close(); process.exit(ok ? 0 : 1);
})();
