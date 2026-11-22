/* Missionsautomatik und Recherchebetrieb sind getrennt: Ein Altprofil mit laufender Mission und fälligen Planeinträgen löst im Hintergrund nichts mehr aus
   (Sekundentakt, Ereignisregeln, Zustands- und Spurenmodell), die Recherche (Dossiers, Unterlagen, Fallpaket, eigene Kartenobjekte,
   Diagnoseterminal) arbeitet unverändert. Seit Phase 5b7 bleibt der Missionsablauf auch nach einer Missionsaktion stillgelegt. Exit-Code 1 bei Fehlschlag. */
const PF = require('./_pfad.js'); const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const FIX = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'altprofil-mission.json'), 'utf8'));
const ISO = /\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z/g, DREI_H = 3 * 3600000;
const zurueck = s => s.replace(ISO, t => new Date(Date.parse(t) - DREI_H).toISOString());       /* Altprofil nach drei Stunden Abwesenheit: alles Fällige liegt in der Vergangenheit */
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1500, height: 1100 } }); const p = await ctx.newPage(); const err = [];
  p.on('pageerror', x => err.push(x.message)); ctx.on('page', pg => { if (pg !== p) pg.close().catch(() => {}); });
  await p.route(/geobasis|eox|gdi\.berlin|cartocdn|open-meteo|openfreemap|unpkg/, r => r.abort());
  const anmelden = async () => {
    await p.goto(PF.APP); await p.waitForTimeout(5200); await p.fill('#gate-pw', 'pw-test-123'); const z = await p.$('#gate-pw2'); if (z && await z.isVisible()) await z.fill('pw-test-123'); await p.click('#gate-go');
    await p.waitForFunction(() => !document.body.classList.contains('locked'), null, { timeout: 20000 });
  };
  const ok = {};
  /* --- Altprofil laden --- */
  const alt = JSON.parse(JSON.stringify(FIX.state)), h0 = alt.komm.kanaele.handler.nachrichten[0];
  alt.plan.push({ typ: 'antwort', kanal: 'handler', zu: h0.id, text: 'Alte Antwort des Ansprechpartners', faelligAm: h0.t, id: 'F-901' });               /* bereits fällige Handler-Antwort */
  alt.komm.kanaele.handler.nachrichten.push({ id: 'N-900', von: 'agent', absender: 'Agent', t: h0.t, text: 'Alte eigene Nachricht', status: 'gesendet', dringlichkeit: 'Routine', lagerelevant: false });   /* Zustellung noch offen */
  alt.seq.plan = Math.max(alt.seq.plan, 901);
  await anmelden();
  await p.evaluate(a => { localStorage.setItem(STORAGE_KEY, a.state); localStorage.setItem(PROFIL_KEY, a.profil); }, { state: zurueck(JSON.stringify(alt)), profil: zurueck(JSON.stringify(FIX.profil)) });
  await anmelden();
  /* Phase 5c1b: Die Missionsfelder des Altprofils liegen nach der Überführung unverändert in STATE.altbestand */
  const messen = () => p.evaluate(() => { const Z = STATE.altbestand; return {
    format: STATE.version, kernOhneAltfelder: ['plan', 'komm', 'missionen', 'kontext', 'serie'].every(k => !(k in STATE)),
    plan: Z.plan.length, ereignisse: JSON.stringify(Z.ereignisse || {}), abd: ((Z.abdruck && Z.abdruck.spuren) || []).length,   /* Phase 5b9: abdS() entfernt; gespeichertes Feld direkt */ folge: JSON.stringify(Z.serie.folge),
    komm: Object.values(Z.komm.kanaele).reduce((n, k) => n + k.nachrichten.length, 0),
    mission: STATE.log.filter(l => !['System', 'Profil', 'Dossier', 'Karte', 'Recherche', 'Ablage'].includes(l.modul)).length,
    lm: !!LM(), status: STATE.agent.status,
    antwort: Z.plan.some(x => x.id === 'F-901'), antwortNachricht: Object.values(Z.komm.kanaele).some(k => k.nachrichten.some(m => m.text === 'Alte Antwort des Ansprechpartners')),
    n900: (Z.komm.kanaele.handler.nachrichten.find(m => m.id === 'N-900') || {}).status, statusLog: STATE.log.filter(l => l.aktion === 'Nachrichtenstatus geändert').length
  }; });
  const vor = await messen();
  ok.altprofilGeladen = vor.format === 5 && vor.kernOhneAltfelder && vor.lm && vor.status === 'Aktiv' && vor.plan >= 10;
  await p.waitForTimeout(14000);                                  /* der Rückstau stellt höchstens einen fälligen Eintrag je 12 s zu */
  const nach = await messen();
  ok.keinePlaneintraegeAbgearbeitet = nach.plan === vor.plan;
  ok.keineMissionsereignisse = nach.mission === vor.mission && nach.komm === vor.komm;
  ok.keineFolgezuweisung = nach.folge === vor.folge;
  ok.faelligeAntwortBleibtImPlan = vor.antwort && nach.antwort && !nach.antwortNachricht;
  ok.keineAltzustellung = vor.n900 === 'gesendet' && nach.n900 === 'gesendet' && nach.statusLog === vor.statusLog;
  /* --- Kartenpfade der Mission: im Recherchebetrieb weder sichtbar noch auslösbar ("Lage erfragen", Lage melden, Zonen des Auftrags) --- */
  const kp = await p.evaluate(() => {
    const Z = STATE.altbestand, kommN = () => Object.values(Z.komm.kanaele).reduce((n, k) => n + k.nachrichten.length, 0), v = { komm: kommN(), plan: Z.plan.length, log: STATE.log.length };
    dispatch({ type: 'ZONE_ANGELEGT', ll: [52.5, 13.4] });
    const zid = (zonenEigene(KM()).slice(-1)[0] || {}).id; dispatch({ type: 'ZONE_ERFRAGT', id: zid }); dispatch({ type: 'ZONE_GEMELDET', id: zid });
    return { sichtbar: karteZonen().some(z => !z.profil) || karteMarker().some(m => m.kat === 'standort'), komm: kommN() - v.komm, plan: Z.plan.length - v.plan, log: STATE.log.length - v.log };
  });
  ok.keineMissionszonenAufDerKarte = !kp.sichtbar;
  ok.lageErfragenLoestNichtsAus = kp.komm === 0 && kp.plan === 0 && kp.log === 0;
  vor.komm = vor.komm + kp.komm; vor.plan = vor.plan + kp.plan;
  /* --- Recherche arbeitet auf dem Altprofil --- */
  const r = await p.evaluate(async () => {
    const e = STATE.dossiers.eigene.find(x => x.name === 'Altprofil Person'), R = PROFIL.recherche;
    const fall = R.faelle[0] && R.faelle[0].id, paket = fall ? JSON.parse((await rchPaketBauen(fall)).text) : null;
    const vorN = { pins: PROFIL.pins.length, zonen: PROFIL.zonen.length, eigene: STATE.dossiers.eigene.length };
    dispatch({ type: 'PIN_ANGELEGT', ll: [52.51, 13.41], name: 'Neuer Pin' }); dispatch({ type: 'OZONE_ANGELEGT', ll: [52.52, 13.42] });
    dispatch({ type: 'DOSSIER_ANGELEGT', typ: 'Person', name: 'Neues Dossier', land: 'DE' });
    dispatch({ type: 'SICHTUNG_HINZU', id: e.id, ort: 'Neuer Ort', text: 'Meldung', quelle: 'Meldung' });     /* früher: Ereignisregel "Sichtung gemeldet" mit Rückfrage des Ansprechpartners */
    STATE.dossiers.auswahl = e.id; dispatch({ type: 'NAVIGATION', modul: 'dossier' }); renderModule();
    return { dossier: !!e, beleg: R.beobachtungen.length, fall: !!fall, paket: !!paket, paketBeleg: paket ? JSON.stringify(paket).includes('Altes Zitat zur Person') : false,
      pinsNeu: PROFIL.pins.length - vorN.pins, zonenNeu: PROFIL.zonen.length - vorN.zonen, dossierNeu: STATE.dossiers.eigene.length - vorN.eigene,
      sichtungen: STATE.dossiers.entitaeten[e.id].sichtungen.length };
  });
  await p.waitForTimeout(500);
  await p.locator("#rch-dossier-unterlagen > summary").click();
  ok.dossierUndUnterlage = r.dossier && r.beleg === 1 && r.fall && /Altes Zitat zur Person/.test(await p.evaluate(() => document.body.innerText));
  ok.fallpaket = r.paket && r.paketBeleg;
  ok.kartenobjekte = r.pinsNeu === 1 && r.zonenNeu === 1 && r.dossierNeu === 1 && r.sichtungen === 2;
  ok.kartenobjekteSichtbar = await p.evaluate(() => { dispatch({ type: 'NAVIGATION', modul: 'karte' }); VIEW.karte.reiter = 'karte'; renderModule(); return PROFIL.pins.some(x => x.name === 'Alt-Pin') && PROFIL.zonen.length === 2; });
  await p.waitForTimeout(400);
  ok.karteGezeichnet = await p.evaluate(() => !!document.getElementById('k-svg'));
  /* Diagnoseterminal */
  await p.evaluate(() => { dispatch({ type: 'NAVIGATION', modul: 'profil' }); renderModule(); }); await p.waitForTimeout(400);
  await p.locator('#profil-terminal-oeffnen').click();
  const cmd = async z => { await p.locator('#profil-terminal-eingabe').fill(z); await p.locator('#profil-terminal-eingabe').press('Enter'); };
  await cmd('whoami'); await cmd('pwd'); await p.waitForTimeout(300);
  const aus = await p.locator('#profil-terminal-ausgabe').textContent();
  ok.diagnoseterminal = /\nraizo\n/.test(aus) && /pgcl-eu3\.arch07\//.test(aus) || /raizo/.test(aus);
  /* Nach der Recherche weiterhin nichts im Hintergrund */
  await p.waitForTimeout(4000);
  const spaet = await messen();
  ok.rechercheLoestNichtsAus = spaet.plan === vor.plan && spaet.ereignisse === vor.ereignisse && spaet.abd === vor.abd && spaet.mission === vor.mission && spaet.komm === vor.komm;
  ok.gespeicherteFelderErhalten = await p.evaluate(() => { const Z = STATE.altbestand; return STATE.agent.status === 'Aktiv' && Z.plan.length > 0 && !!Z.missionen && !!Z.kontext && typeof Z.automatik === 'boolean'; });
  /* --- Der Missionsablauf läuft, sobald eine Missionsaktion ausgeführt wird --- */
  await p.evaluate(() => { dispatch({ type: 'PROFIL_LEEREN' }); });
  await p.evaluate(() => { dispatch({ type: 'RESET' }); }); await p.waitForTimeout(800);
  /* Phase 5c1b: Nach dem Zurücksetzen gibt es weder Missionsfelder noch Altbestand. Ein künstlich eingesetzter,
     fälliger Planeintrag wird vom Sekundentakt nicht abgearbeitet. */
  ok.resetOhneAltfelder = await p.evaluate(() => STATE.version === 5 && !('altbestand' in STATE) && Object.keys(STATE).every(k => ['version', 't0', 'idv', 'ui', 'seq', 'dossiers', 'log', 'agent', 'alterung'].includes(k)));
  await p.evaluate(() => { STATE.plan = [{ id: 'F-999', typ: 'skript', kanal: 'handler', text: 'Prüfnachricht Missionsablauf', faelligAm: new Date(Date.now() - 1000).toISOString() }]; });
  await p.waitForTimeout(3500);
  ok.missionsablaufStillgelegt = await p.evaluate(() => STATE.plan.length === 1 && !missionsbetrieb() && !('komm' in STATE));
  ok.keineFehler = err.length === 0;
  console.log(JSON.stringify(ok, null, 1)); console.log(JSON.stringify({ vor, nach, spaet })); if (err.length) console.log(err.slice(0, 5));
  await b.close(); process.exit(Object.values(ok).every(Boolean) ? 0 : 1);
})();
