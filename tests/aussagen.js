/* Aussagenregister: eine Aussage mit stützendem und widersprechendem Beleg; nach Neustart beide Fundstellen erreichbar,
   Einschätzung samt Begründung erhalten, Prüfstand je Beleg unabhängig; unzulässige Einschätzungen abgelehnt; Rücknahme bei vollem Speicher. Exit-Code 1 bei Fehlschlag. */
const PF = require('./_pfad.js'); const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1500, height: 1100 } }); const p = await ctx.newPage(); const err = [];
  p.on('pageerror', x => err.push(x.message)); ctx.on('page', pg => { if (pg !== p) pg.close().catch(() => {}); });
  await p.route(/geobasis|eox|gdi\.berlin|cartocdn|open-meteo|openfreemap|unpkg/, r => r.abort());
  const start = async () => { await p.goto(PF.APP); await p.waitForTimeout(5200); await p.fill('#gate-pw', 'pw-test-123'); const z = await p.$('#gate-pw2'); if (z && await z.isVisible()) await z.fill('pw-test-123'); await p.click('#gate-go');
    await p.waitForFunction(() => !document.body.classList.contains('locked'), null, { timeout: 20000 }); };
  const zeigen = () => p.evaluate(() => { STATE.dossiers.auswahl = STATE.dossiers.eigene.find(x => x.name === 'Aussagetest').id; dispatch({ type: 'NAVIGATION', modul: 'dossier' }); renderModule(); });
  const A = () => p.evaluate(() => JSON.parse(JSON.stringify(PROFIL.recherche.aussagen)));
  const buf = Buffer.from('%PDF-1.4\n% Beleg Seite 2\n'.repeat(10));
  await start();
  await p.evaluate(() => { dispatch({ type: 'DOSSIER_ANGELEGT', typ: 'Person', name: 'Aussagetest', land: 'DE' }); });
  await zeigen(); await p.waitForSelector('#rch-ok');
  /* Beleg 1: Datei, Seite 2 (stützend); Beleg 2: Textauszug, Absatz 3 (widersprechend) */
  await p.selectOption('#rch-fall', '__neu'); await p.fill('#rch-fall-titel', 'Radweg'); await p.selectOption('#rch-ft-typ', 'Seite'); await p.fill('#rch-ft-wert', '2');
  await p.setInputFiles('#rch-datei', { name: 'blatt.pdf', mimeType: 'application/pdf', buffer: buf }); await p.click('#rch-ok'); await p.waitForTimeout(800);
  const fall = await p.evaluate(() => PROFIL.recherche.faelle[0].id);
  await p.selectOption('#rch-fall', fall); await p.fill('#rch-text', 'Eröffnung erst im August'); await p.selectOption('#rch-ft-typ', 'Absatz'); await p.fill('#rch-ft-wert', '3'); await p.click('#rch-ok'); await p.waitForTimeout(500);
  const belege = await p.evaluate(() => PROFIL.recherche.beobachtungen.map(x => x.id));
  /* ohne Fall oder Text: nichts angelegt */
  await p.fill('#rca-text', 'Der Radweg wurde im Juni eröffnet.'); await p.click('#rca-neu'); await p.waitForTimeout(200);
  const ohneFall = (await A()).length;
  await p.selectOption('#rca-fall', fall); await p.click('#rca-neu'); await p.waitForTimeout(300);
  const a1 = await A(); const id = a1[0] && a1[0].id;
  /* Verknüpfen über die Oberfläche */
  await p.selectOption('#rca-b-' + id, belege[0]); await p.selectOption('#rca-r-' + id, 'stuetzend'); await p.click('#rca-v-' + id); await p.waitForTimeout(200);
  await p.selectOption('#rca-b-' + id, belege[1]); await p.selectOption('#rca-r-' + id, 'widersprechend'); await p.click('#rca-v-' + id); await p.waitForTimeout(200);
  const nachV = await A();
  /* Einschätzung ohne Begründung wird abgelehnt; mit Begründung angenommen */
  const ohneBegr = await p.evaluate(id => { dispatch({ type: 'RECHERCHE_AUSSAGE_SETZEN', id, einschaetzung: 'dafuer' }); return PROFIL.recherche.aussagen[0].einschaetzung; }, id);
  await p.fill('#rca-begr-' + id, 'Beleg 1 nennt den 12. Juni, Beleg 2 widerspricht.'); await p.click('#rca-begr-ok-' + id); await p.waitForTimeout(200);
  await p.selectOption('#rca-ei-' + id, 'dafuer'); await p.waitForTimeout(200);
  /* Prüfstand nur für Beleg 1 */
  await p.click('#rca-pr-' + id + '-' + belege[0]); await p.waitForTimeout(200);
  const vorNeustart = await A();
  /* Neustart */
  await start(); await zeigen(); await p.waitForSelector('#rca-neu');
  const nach = await A();
  const text = await p.evaluate(() => document.body.innerText);
  const msgOk = await p.evaluate(async b => { const z = rchZuBeobachtung(b); rchOeffnen(z); await new Promise(r => setTimeout(r, 800)); return document.getElementById('sys-msg').textContent; }, belege[0]);
  /* unzulässig: positive Einschätzung ohne stützenden Beleg; Beleg lösen nimmt Einschätzung zurück, Begründung bleibt */
  const gel = await p.evaluate(({ id, b }) => {
    dispatch({ type: 'RECHERCHE_AUSSAGE_NEU', dossier: STATE.dossiers.auswahl, fall: PROFIL.recherche.faelle[0].id, text: 'Zweite Aussage' });
    const z = PROFIL.recherche.aussagen[1]; dispatch({ type: 'RECHERCHE_AUSSAGE_SETZEN', id: z.id, begruendung: 'x' }); dispatch({ type: 'RECHERCHE_AUSSAGE_SETZEN', id: z.id, einschaetzung: 'gestuetzt' });
    const zweite = z.einschaetzung; dispatch({ type: 'RECHERCHE_BELEG_GELOEST', aussage: id, beob: b });
    const x = PROFIL.recherche.aussagen[0]; return { zweite, ei: x.einschaetzung, begr: x.begruendung, stuetz: x.stuetzend.length, wider: x.widersprechend.length };
  }, { id, b: belege[0] });
  /* Speicher voll: Aussage wird zurückgenommen */
  const voll = await p.evaluate(async () => {
    const n0 = PROFIL.recherche.aussagen.length, s0 = PROFIL.recherche.seq.aussage, l0 = STATE.log.length;
    const orig = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (String(k).endsWith('.profil')) throw new Error('quota'); return orig.call(this, k, v); };
    const ok = rchSchreiben({ type: 'RECHERCHE_AUSSAGE_NEU', dossier: STATE.dossiers.auswahl, fall: PROFIL.recherche.faelle[0].id, text: 'Voll' }, 'Aussage angelegt'); Storage.prototype.setItem = orig;
    return { ok, n: PROFIL.recherche.aussagen.length - n0, seq: PROFIL.recherche.seq.aussage - s0, log: STATE.log.length - l0 };
  });
  const r = {
    ohneFall: ohneFall === 0, angelegt: a1.length === 1 && a1[0].status === 'entwurf' && a1[0].einschaetzung === null,
    verknuepft: nachV[0].stuetzend.length === 1 && nachV[0].widersprechend.length === 1 && nachV[0].stuetzend[0].beob === belege[0],
    ohneBegruendungAbgelehnt: ohneBegr === null,
    einschaetzungErhalten: nach[0].einschaetzung === 'dafuer' && nach[0].begruendung.startsWith('Beleg 1 nennt'),
    pruefstandUnabhaengig: nach[0].stuetzend[0].pruefstand === 'geprueft' && nach[0].widersprechend[0].pruefstand === 'eingetragen',
    fundstellenSichtbar: text.includes('Seite 2') && text.includes('Absatz 3') && text.includes('strittig'),
    oeffnenOk: /Fundstelle Seite 2; Prüfsumme stimmt/.test(msgOk),
    ohneStuetzeAbgelehnt: gel.zweite === null, loesenNimmtEinschaetzungZurueck: gel.ei === null && gel.begr.startsWith('Beleg 1') && gel.stuetz === 0 && gel.wider === 1,
    vollRollback: voll.ok === false && voll.n === 0 && voll.seq === 0 && voll.log === 0, keineFehler: err.length === 0
  };
  console.log(JSON.stringify({ r, msgOk, err }));
  await b.close(); process.exit(Object.values(r).every(v => v === true) ? 0 : 1);
})();
