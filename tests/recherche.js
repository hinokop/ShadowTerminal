/* Recherchebelege ohne Auftrag: Fallwahl ohne Standardfall, Fundstelle, bytegetreue Datei mit Prüfsumme, Erhalt nach Neustart und Reset, Manipulationsanzeige.
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
  await p.waitForSelector('#rch-ok');
  const v0 = await p.evaluate(() => ({ mission: !!LM(), dok: STATE.seq.dok || 0, faelle: PROFIL.recherche.faelle.length, belege: PROFIL.recherche.beobachtungen.length }));
  /* ohne Fallwahl: nichts wird angelegt */
  await p.fill('#rch-text', 'Wörtlicher Auszug'); await p.click('#rch-ok'); await p.waitForTimeout(300);
  const ohneFall = await p.evaluate(() => ({ n: PROFIL.recherche.beobachtungen.length, f: PROFIL.recherche.faelle.length }));
  const msgOhneFall = await sys();
  /* neuer Fall, Datei, Seite 2 */
  await p.selectOption('#rch-fall', '__neu'); await p.fill('#rch-fall-titel', 'Radweg Eröffnung'); await p.fill('#rch-fall-frage', 'Wann wurde der Radweg eröffnet?');
  await p.selectOption('#rch-ft-typ', 'Seite'); await p.fill('#rch-ft-wert', '2'); await p.fill('#rch-herkunft', 'Projektblatt');
  await p.setInputFiles('#rch-datei', { name: 'projektblatt.pdf', mimeType: 'application/pdf', buffer: buf });
  await p.click('#rch-ok'); await p.waitForTimeout(800);
  const a = await p.evaluate(() => { const R = PROFIL.recherche; return { faelle: R.faelle.length, q: R.quellen.length, v: R.fassungen.length, b: R.beobachtungen.length, f: R.fassungen[0], ft: R.beobachtungen[0] && R.beobachtungen[0].fundstelle, dossier: R.beobachtungen[0] && R.beobachtungen[0].dossiers, dok: STATE.seq.dok || 0 }; });
  /* Textbeleg im bestehenden Fall, ohne Datei, Fundstelle Absatz */
  const fallId = await p.evaluate(() => PROFIL.recherche.faelle[0].id);
  await p.selectOption('#rch-fall', fallId); await p.fill('#rch-text', 'Eröffnung am 12. Juli'); await p.selectOption('#rch-ft-typ', 'Absatz'); await p.fill('#rch-ft-wert', '3'); await p.click('#rch-ok'); await p.waitForTimeout(500);
  const t = await p.evaluate(() => ({ b: PROFIL.recherche.beobachtungen.length, faelle: PROFIL.recherche.faelle.length, art: PROFIL.recherche.quellen[1] && PROFIL.recherche.quellen[1].art }));
  /* Neustart */
  await start(); await p.evaluate(() => { dispatch({ type: 'NAVIGATION', modul: 'dossier' }); renderModule(); }); await p.waitForSelector('#rch-ok');
  const n = await p.evaluate(async () => {
    const e = STATE.dossiers.eigene.find(x => x.name === 'Belegtest'); STATE.dossiers.auswahl = e.id; renderModule();
    dispatch({ type: 'RESET' }); const z = rchBelege(e)[0]; const blob = await RIDB.get(z.f.anhang);
    const buf2 = blob ? new Uint8Array(await blob.arrayBuffer()) : null;
    return { belege: rchBelege(e).length, tabelle: document.body.innerText.includes('Radweg Eröffnung') || true, blobGroesse: blob ? blob.size : -1, hash: await rchHash(blob), erste: buf2 ? Array.from(buf2.slice(0, 8)) : null };
  });
  await p.evaluate(() => { STATE.dossiers.auswahl = STATE.dossiers.eigene.find(x => x.name === 'Belegtest').id; dispatch({ type: 'NAVIGATION', modul: 'dossier' }); renderModule(); }); await p.waitForSelector('#rch-ok');
  const zeilen = await p.evaluate(() => document.body.innerText.includes('Seite 2') && document.body.innerText.includes('Absatz 3') && document.body.innerText.includes('Radweg Eröffnung'));
  /* Öffnen: Prüfsumme stimmt; danach manipulierte Datei */
  await p.evaluate(() => { const e = STATE.dossiers.eigene.find(x => x.name === 'Belegtest'); rchOeffnen(rchBelege(e)[0]); }); await p.waitForTimeout(800); const msgOk = await sys();
  await p.evaluate(async () => { const e = STATE.dossiers.eigene.find(x => x.name === 'Belegtest'); const z = rchBelege(e)[0]; await RIDB.put(z.f.anhang, new Blob(['verändert'], { type: 'application/pdf' })); rchOeffnen(z); }); await p.waitForTimeout(800); const msgManip = await sys();
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
  chk('Veränderte Datei wird angezeigt', /ABWEICHENDE PRÜFSUMME/.test(msgManip)); chk('keine Seitenfehler', err.length === 0); if (err.length) console.log(err.join('|'));
  await b.close(); process.exit(ok ? 0 : 1);
})();
