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
  await A.waitForSelector('#rch-neu');
  const fall = await A.evaluate(async bytes => {
    const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }), key = 'ANH-paket1', hash = await rchHash(blob), d = STATE.dossiers.auswahl;
    await RIDB.put(key, blob);
    dispatch({ type: 'RECHERCHE_BELEG', dossier: d, fall: null, neuerFall: { titel: 'Radweg', frage: '' }, art: 'Datei', herkunft: '', notiz: '', fassung: { dateiname: 'blatt.pdf', groesse: blob.size, typ: 'application/pdf', hash: hash, anhang: key }, fundstelle: { typ: 'Seite', wert: '2' }, zitat: '' });
    const f = PROFIL.recherche.faelle[0].id;
    dispatch({ type: 'RECHERCHE_BELEG', dossier: d, fall: f, neuerFall: null, art: 'Text', herkunft: '', notiz: '', fassung: { dateiname: null, groesse: 24, typ: 'text/plain', hash: null, anhang: false }, fundstelle: { typ: 'Absatz', wert: '3' }, zitat: 'Eröffnung erst im August' });
    return f;
  }, Array.from(buf));
  const aid = await A.evaluate(() => { const R = PROFIL.recherche, d = STATE.dossiers.auswahl;
    /* Altdaten: das Aussagenregister ist entfernt; die Aussage wird als vorhandener Datensatz angelegt */
    const jetzt = new Date().toISOString(), x = { id: 'A-001', fall: R.faelle[0].id, text: 'Der Radweg wurde im Juni eröffnet.', status: 'entwurf', einschaetzung: 'dafuer', begruendung: 'Seite 2 nennt Juni.', dossiers: [d],
      stuetzend: [{ beob: R.beobachtungen[0].id, pruefstand: 'geprueft', geprueftAm: jetzt }], widersprechend: [{ beob: R.beobachtungen[1].id, pruefstand: 'eingetragen', geprueftAm: null }], erfasst: jetzt, geaendert: jetzt };
    R.aussagen.push(x); R.seq.aussage = 1; profilSpeichern(); return x.id; });
  const paket = await A.evaluate(async f => (await rchPaketBauen(f)).text, fall);
  const P = JSON.parse(paket); const man = P.manifest;
  const hashOk = await A.evaluate(async t => { const o = JSON.parse(t); return (await rchTextHash(rchKanon({ inhalt: o.inhalt, dateien: o.manifest.dateien }))) === o.manifest.inhaltHash; }, paket);
  const dateiHashOk = man.dateien.length === 1 && man.dateien[0].sha256 === sha && man.dateien[0].status === 'ok';
  /* ganzes Profil für den Profilimport-Test */
  const profil = await A.evaluate(() => { profilSpeichern(); const o = {}; Object.keys(PROFIL).forEach(k => { if (k !== 'leer') o[k] = PROFIL[k]; }); return JSON.stringify(o); });
  /* zweites Paket mit zwei Dateien und einer Unterlage ohne Fundstelle */
  const paket2 = await A.evaluate(async () => { const d = STATE.dossiers.auswahl, f = PROFIL.recherche.faelle[0].id, blob = new Blob([new Uint8Array([7, 7, 7, 7, 1])], { type: 'application/pdf' }); await RIDB.put('ANH-paket2', blob); const hash = await rchHash(blob);
    dispatch({ type: 'RECHERCHE_BELEG', dossier: d, fall: f, neuerFall: null, art: 'Datei', herkunft: '', notiz: '', fassung: { dateiname: 'zwei.pdf', groesse: blob.size, typ: 'application/pdf', hash: hash, anhang: 'ANH-paket2' }, fundstelle: { typ: 'Seite', wert: '1' }, zitat: '' }); return (await rchPaketBauen(f)).text; });
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
  /* Wiederherstellung: Datensätze vorhanden, Datei fehlt; dasselbe Paket legt sie wieder ab */
  const schl = await B.evaluate(() => PROFIL.recherche.fassungen.find(x => x.anhang).anhang);
  await B.evaluate(k => RIDB.del(k), schl); const w0 = await stand(B);
  const msgW = await lade(B, paket); const w1 = await stand(B);
  const wDatei = await B.evaluate(async k => { const bl = await RIDB.get(k); return bl ? await rchHash(bl) : null; }, schl);
  /* Dateikollision: unter demselben Schlüssel liegt anderer Inhalt; Wiederholungsimport ergibt dieselbe Zuordnung */
  const G = await neu();
  const kol = JSON.parse(paket).manifest.dateien[0].key;
  await G.evaluate(k => RIDB.put(k, new Blob(['fremd'], { type: 'application/pdf' })), kol);
  const anhaenge = p => p.evaluate(() => PROFIL.recherche.fassungen.map(x => x.anhang).filter(Boolean).sort().join(','));
  await lade(G, paket); const g1 = await stand(G), ga1 = await anhaenge(G); await lade(G, paket); const g2 = await stand(G), ga2 = await anhaenge(G);
  /* Ersatzschlüssel belegt, aber beschädigt: Import wird abgelehnt, die vorhandene Datei bleibt unverändert, nichts wird übernommen */
  const k2 = ga1.split(',').find(x => x.indexOf(kol + '-') === 0);
  await G.evaluate(k => RIDB.put(k, new Blob(['defekt'], { type: 'application/pdf' })), k2);
  const gv = await stand(G), gMsg = await lade(G, paket), gn = await stand(G), gk2 = await G.evaluate(async k => { const bl = await RIDB.get(k); return bl ? await bl.text() : null; }, k2);
  /* Abbruch bei der zweiten Datei: die erste bleibt nicht zurück */
  const H = await neu(); const h0 = await stand(H);
  const msgH = await H.evaluate(async t => { const orig = RIDB.put; let n = 0; RIDB.put = function (k, bl) { n += 1; return n === 2 ? Promise.reject(new Error('Schreibfehler')) : orig.call(RIDB, k, bl); };
    rchPaketLaden(new File([t], 'p2.json')); await new Promise(r => setTimeout(r, 1800)); RIDB.put = orig; return document.getElementById('sys-msg').textContent; }, paket2);
  const h1 = await stand(H);
  /* Dateiinhalt verändert: einmal mit altem Manifest, einmal mit nachgezogener Dateiprüfsumme im Manifest; beides wird abgelehnt */
  const T1 = JSON.parse(paket), kt = Object.keys(T1.dateien)[0]; T1.dateien[kt] = Buffer.from('anderer Inhalt').toString('base64');
  const T2 = JSON.parse(JSON.stringify(T1)); T2.manifest.dateien[0].sha256 = crypto.createHash('sha256').update('anderer Inhalt').digest('hex');
  const bt0 = await stand(B); const msgT1 = await lade(B, JSON.stringify(T1)); const msgT2 = await lade(B, JSON.stringify(T2)); const bt1 = await stand(B);
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
    dateiManipulationAbgelehnt: JSON.stringify(bt0) === JSON.stringify(bt1) && /abgelehnt/.test(msgT1) && /abgelehnt/.test(msgT2),
    dateiWiederhergestellt: w0.keys === w1.keys - 1 && w1.b === w0.b && w1.q === w0.q && wDatei === sha && /wiederhergestellt/.test(msgW),
    dateikollisionWiederholung: g1.b === 2 && g2.b === 2 && g1.keys === 2 && g2.keys === 2 && ga1 === ga2 && ga1.indexOf(kol + '-') >= 0 && g1.q === g2.q && g1.v === g2.v,
    ersatzschluesselBeschaedigt: !!k2 && gk2 === 'defekt' && JSON.stringify(gv) === JSON.stringify(gn) && /stimmt nicht mit der Prüfsumme/.test(gMsg) && /abgelehnt/.test(gMsg),
    abbruchRaeumtAuf: h0.keys === 0 && h1.keys === 0 && h1.f === 0 && h1.b === 0 && h1.log === 0 && /nicht übernommen/.test(msgH),
    keineFehler: err.length === 0
  };
  console.log(JSON.stringify({ r, msgW, msgH, g1, g2, w0, w1, msg1, msg2, msgInh, msgK, voll, pm, konflikt, err }));
  await b.close(); process.exit(Object.values(r).every(v => v === true) ? 0 : 1);
})();
