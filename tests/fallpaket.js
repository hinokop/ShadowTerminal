/* Fallpaket: Export mit Manifest und Prüfsummen, Import in ein leeres Profil (Datei bytegleich, Aussage samt Einschätzung und Prüfstand),
   Wiederholung ohne Dopplung, Nummernkonflikt ohne Überschreiben, Manipulation und voller Speicher ohne Teilübernahme, Profilimport mit Recherche.
   Exit-Code 1 bei Fehlschlag. */
const PF = require('./_pfad.js'); const { chromium } = require('playwright'); const crypto = require('crypto');
(async () => {
  const b = await chromium.launch(); const err = []; const seiten = [];
  const neu = async () => { const ctx = await b.newContext({ viewport: { width: 1500, height: 1100 } }); const p = await ctx.newPage();
    p.on('pageerror', x => err.push(x.message)); ctx.on('page', pg => { if (pg !== p) pg.close().catch(() => {}); });
    await p.route(/geobasis|eox|gdi\.berlin|cartocdn|open-meteo|openfreemap|unpkg/, r => r.abort());
    await p.goto(PF.APP); await p.waitForTimeout(5200); await p.fill('#gate-pw', 'pw-test-123'); const z = await p.$('#gate-pw2'); if (z && await z.isVisible()) await z.fill('pw-test-123'); await p.click('#gate-go');
    await p.waitForFunction(() => !document.body.classList.contains('locked'), null, { timeout: 20000 }); seiten.push(ctx); return p; };
  const buf = Buffer.from('%PDF-1.4\n% Beleg Seite 2 des Fallpakets\n'.repeat(30)); const sha = crypto.createHash('sha256').update(buf).digest('hex');
  /* --- Quellprofil A --- */
  const A = await neu();
  await A.evaluate(() => { dispatch({ type: 'DOSSIER_ANGELEGT', typ: 'Person', name: 'Paketperson', land: 'DE' }); const d = STATE.dossiers.eigene.find(x => x.name === 'Paketperson'); STATE.dossiers.auswahl = d.id; dispatch({ type: 'NAVIGATION', modul: 'dossier' }); renderModule(); });
  await A.waitForSelector('#rch-ok');
  await A.selectOption('#rch-fall', '__neu'); await A.fill('#rch-fall-titel', 'Radweg'); await A.selectOption('#rch-ft-typ', 'Seite'); await A.fill('#rch-ft-wert', '2');
  await A.setInputFiles('#rch-datei', { name: 'blatt.pdf', mimeType: 'application/pdf', buffer: buf }); await A.click('#rch-ok'); await A.waitForTimeout(800);
  const fall = await A.evaluate(() => PROFIL.recherche.faelle[0].id);
  await A.selectOption('#rch-fall', fall); await A.fill('#rch-text', 'Eröffnung erst im August'); await A.selectOption('#rch-ft-typ', 'Absatz'); await A.fill('#rch-ft-wert', '3'); await A.click('#rch-ok'); await A.waitForTimeout(500);
  const aid = await A.evaluate(() => { const R = PROFIL.recherche, d = STATE.dossiers.auswahl;
    dispatch({ type: 'RECHERCHE_AUSSAGE_NEU', dossier: d, fall: R.faelle[0].id, text: 'Der Radweg wurde im Juni eröffnet.' }); const x = R.aussagen[0];
    dispatch({ type: 'RECHERCHE_BELEG_VERKNUEPFT', aussage: x.id, beob: R.beobachtungen[0].id, rolle: 'stuetzend' }); dispatch({ type: 'RECHERCHE_BELEG_VERKNUEPFT', aussage: x.id, beob: R.beobachtungen[1].id, rolle: 'widersprechend' });
    dispatch({ type: 'RECHERCHE_AUSSAGE_SETZEN', id: x.id, begruendung: 'Seite 2 nennt Juni.' }); dispatch({ type: 'RECHERCHE_AUSSAGE_SETZEN', id: x.id, einschaetzung: 'dafuer' });
    dispatch({ type: 'RECHERCHE_PRUEFSTAND', aussage: x.id, beob: R.beobachtungen[0].id, stand: 'geprueft' }); return x.id; });
  const paket = await A.evaluate(async f => (await rchPaketBauen(f)).text, fall);
  const P = JSON.parse(paket); const man = P.manifest;
  const hashOk = await A.evaluate(async t => { const o = JSON.parse(t); return (await rchTextHash(rchKanon(o.inhalt))) === o.manifest.inhaltHash; }, paket);
  const dateiHashOk = man.dateien.length === 1 && man.dateien[0].sha256 === sha && man.dateien[0].status === 'ok';
  /* ganzes Profil für den Profilimport-Test */
  const profil = await A.evaluate(() => { profilSpeichern(); const o = {}; Object.keys(PROFIL).forEach(k => { if (k !== 'leer') o[k] = PROFIL[k]; }); return JSON.stringify(o); });
  /* --- Zielprofil B (leer) --- */
  const B = await neu();
  const lade = (p, text, name) => p.evaluate(async ([t, n]) => { rchPaketLaden(new File([t], n, { type: 'application/json' })); await new Promise(r => setTimeout(r, 1800)); return document.getElementById('sys-msg').textContent; }, [text, name || 'paket.json']);
  const stand = p => p.evaluate(async () => { const R = PROFIL.recherche; return { f: R.faelle.length, q: R.quellen.length, v: R.fassungen.length, b: R.beobachtungen.length, a: R.aussagen.length, dos: STATE.dossiers.eigene.length, keys: (await RIDB.schluessel()).length, log: STATE.log.filter(x => x.aktion === 'Fallpaket geladen').length }; });
  const b0 = await stand(B); const msg1 = await lade(B, paket); const b1 = await stand(B);
  const ergebnis = await B.evaluate(async () => { const R = PROFIL.recherche, x = R.aussagen[0], f = R.fassungen.find(y => y.anhang), blob = await RIDB.get(f.anhang), d = STATE.dossiers.eigene[0];
    const bz = R.beobachtungen.find(y => y.id === x.stuetzend[0].beob); return { ei: x.einschaetzung, begr: x.begruendung, pr: x.stuetzend[0].pruefstand, pr2: x.widersprechend[0].pruefstand, hash: await rchHash(blob), name: d.name, imp: d.importVon && d.importVon.name, bd: bz.dossiers[0] === d.id, aussageDossier: x.dossiers[0] === d.id, aq: R.quellen.find(q => q.id === f.quelle).aktuelleFassung === f.id }; });
  const msgOeffnen = await B.evaluate(async () => { const R = PROFIL.recherche, f = R.fassungen.find(y => y.anhang), bz = R.beobachtungen.find(y => y.fassung === f.id); rchOeffnen(rchZuBeobachtung(bz.id)); await new Promise(r => setTimeout(r, 800)); return document.getElementById('sys-msg').textContent; });
  /* Wiederholung: nichts doppelt */
  const msg2 = await lade(B, paket); const b2 = await stand(B);
  /* Manipulation: Inhalt, Datei */
  const Pi = JSON.parse(paket); Pi.inhalt.beobachtungen[0].zitat = 'verfälscht'; const msgInh = await lade(B, JSON.stringify(Pi)); const b3 = await stand(B);
  /* --- Profil C mit Nummernkonflikt: eigener Fall F-001 anderer Inhalt, Dossier mit gleicher Nummer anderer Name --- */
  const C = await neu();
  await C.evaluate(() => { dispatch({ type: 'DOSSIER_ANGELEGT', typ: 'Person', name: 'Andere Person', land: 'DE' }); const d = STATE.dossiers.eigene[0];
    dispatch({ type: 'RECHERCHE_BELEG', dossier: d.id, fall: null, neuerFall: { titel: 'Fremder Fall', frage: '' }, art: 'Text', herkunft: 'x', notiz: '', fassung: { dateiname: null, groesse: 3, typ: 'text/plain', hash: null, anhang: false }, fundstelle: { typ: 'Absatz', wert: '1' }, zitat: 'lokal' }); });
  const lokalVor = await C.evaluate(() => JSON.stringify(PROFIL.recherche.faelle[0]) + JSON.stringify(PROFIL.recherche.beobachtungen[0]));
  const msgK = await lade(C, paket);
  const konflikt = await C.evaluate(() => { const R = PROFIL.recherche, x = R.aussagen[0]; const ids = R.beobachtungen.map(y => y.id);
    return { faelle: R.faelle.map(f => f.id + ':' + f.titel), lokalErhalten: JSON.stringify(R.faelle[0]) + JSON.stringify(R.beobachtungen[0]), verkn: x.stuetzend.concat(x.widersprechend).every(l => ids.includes(l.beob) && R.beobachtungen.find(y => y.id === l.beob).fassung !== R.beobachtungen[0].fassung),
      dossiers: STATE.dossiers.eigene.map(d => d.id + ':' + d.name), aussageFall: x.fall, neuerFall: R.faelle[1] && R.faelle[1].id, importVon: R.faelle[1] && R.faelle[1].importVon, einzigartig: new Set(ids).size === ids.length }; });
  /* --- Voller Speicher: nichts bleibt halb übernommen --- */
  const D = await neu(); const d0 = await stand(D);
  const voll = await D.evaluate(async t => { const orig = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (String(k).endsWith('.profil')) throw new Error('quota'); return orig.call(this, k, v); };
    rchPaketLaden(new File([t], 'p.json')); await new Promise(r => setTimeout(r, 1800)); Storage.prototype.setItem = orig; return document.getElementById('sys-msg').textContent; }, paket);
  const d1 = await stand(D);
  /* --- Profilimport mit Recherche; Dossiernummer kollidiert in E mit anderem Namen --- */
  const E = await neu();
  await E.evaluate(() => { dispatch({ type: 'DOSSIER_ANGELEGT', typ: 'Person', name: 'Ganz Anders', land: 'DE' }); });
  const pm = await E.evaluate(async t => { const o = JSON.parse(t); const vor = PROFIL.recherche.faelle.length; dispatch({ type: 'PROFIL_IMPORT', profil: o, datei: 'p.json' }); return { msg: STATE.log[STATE.log.length - 1].detail, faelle: PROFIL.recherche.faelle.length - vor, aussagen: PROFIL.recherche.aussagen.length, eingeschaetzt: PROFIL.recherche.aussagen[0] && PROFIL.recherche.aussagen[0].einschaetzung }; }, profil);
  const F = await neu();
  const pf = await F.evaluate(async t => { dispatch({ type: 'PROFIL_IMPORT', profil: JSON.parse(t), datei: 'p.json' }); const R = PROFIL.recherche, x = R.aussagen[0]; const d = STATE.dossiers.eigene.find(e => e.name === 'Paketperson');
    return { a: R.aussagen.length, b: R.beobachtungen.length, ei: x && x.einschaetzung, dossier: !!d && x.dossiers[0] === d.id, gespeichert: JSON.parse(localStorage.getItem(PROFIL_KEY)).recherche.aussagen.length }; }, profil);
  const r = {
    exportManifest: man.zaehler.quellen === 2 && man.zaehler.beobachtungen === 2 && man.zaehler.aussagen === 1 && man.zaehler.dateien === 1 && man.zaehler.dossiers === 1 && hashOk && dateiHashOk,
    importLeer: b0.f === 0 && b1.f === 1 && b1.q === 2 && b1.v === 2 && b1.b === 2 && b1.a === 1 && b1.dos === 1 && b1.keys === 1 && b1.log === 1,
    inhaltErhalten: ergebnis.ei === 'dafuer' && ergebnis.begr === 'Seite 2 nennt Juni.' && ergebnis.pr === 'geprueft' && ergebnis.pr2 === 'eingetragen' && ergebnis.hash === sha && ergebnis.imp === 'Paketperson' && ergebnis.bd && ergebnis.aussageDossier && ergebnis.aq,
    oeffnenNachImport: /Prüfsumme stimmt/.test(msgOeffnen),
    wiederholungOhneDopplung: JSON.stringify(b2) === JSON.stringify(b1) && /bereits vollständig vorhanden/.test(msg2),
    manipulationAbgelehnt: JSON.stringify(b3) === JSON.stringify(b1) && /abgelehnt/.test(msgInh),
    konfliktOhneUeberschreiben: konflikt.lokalErhalten === lokalVor && konflikt.faelle.length === 2 && konflikt.neuerFall !== 'F-001' && konflikt.importVon === 'F-001' && konflikt.verkn && konflikt.aussageFall === konflikt.neuerFall && konflikt.einzigartig && konflikt.dossiers.length === 2,
    vollerSpeicher: d1.f === 0 && d1.q === 0 && d1.b === 0 && d1.a === 0 && d1.dos === d0.dos && d1.keys === d0.keys && d1.log === 0 && /nicht gespeichert/i.test(voll),
    profilimportKonflikt: pm.faelle === 1 && pm.aussagen === 1 && /nicht zuordenbar/.test(pm.msg) && /Belegdateien sind nicht Teil/.test(pm.msg),
    profilimportRecherche: pf.a === 1 && pf.b === 2 && pf.ei === 'dafuer' && pf.dossier && pf.gespeichert === 1,
    keineFehler: err.length === 0
  };
  console.log(JSON.stringify({ r, msg1, msg2, msgInh, msgK, voll, pm, konflikt, err }));
  await b.close(); process.exit(Object.values(r).every(v => v === true) ? 0 : 1);
})();
