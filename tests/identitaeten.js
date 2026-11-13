/* Identitäten ohne Auftrag: Wechsel ohne Handler-Nachricht, Erhalt nach Neustart und Zurücksetzen, Fristen im Profil. Exit-Code 1 bei Fehlschlag. */
const PF = require('./_pfad.js'); const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1500, height: 950 } }); const p = await ctx.newPage(); const err = [];
  p.on('pageerror', x => err.push(x.message));
  await p.route(/geobasis|eox|gdi\.berlin|cartocdn|open-meteo|openfreemap|unpkg/, r => r.abort());
  const start = async () => { await p.goto(PF.APP); await p.waitForTimeout(5200); await p.fill('#gate-pw', 'pw-test-123'); const z = await p.$('#gate-pw2'); if (z && await z.isVisible()) await z.fill('pw-test-123'); await p.click('#gate-go');
    await p.waitForFunction(() => !document.body.classList.contains('locked'), null, { timeout: 20000 }); };
  await start();
  const a = await p.evaluate(() => {
    const o = {}; o.liste = legendeListe().map(l => l.id); o.vorlauf = !!STATE.vorlauf; o.mission = !!LM();
    const hand = () => STATE.komm.kanaele.handler.nachrichten.length; const n0 = hand();
    const ziel = o.liste.find(id => id !== aktiveLegendeId()); o.ziel = ziel;
    dispatch({ type: 'LEGENDE_GEWECHSELT', legende: ziel }); o.aktiv = aktiveLegendeId(); o.handlerNachrichten = hand() - n0;
    const d = legendeListe()[0].dokumente[0]; dokZeile(d, Date.now()); o.dokId = d.id; o.frist = PROFIL.dokFristen[d.id]; PROFIL.dokFristen[d.id] = '2031-01-01T00:00:00.000Z'; profilSpeichern();
    return o;
  });
  console.log(JSON.stringify(a));
  /* Neustart (Seite neu laden) */
  await start();
  const c = await p.evaluate((ziel) => {
    const o = { aktivNachNeustart: aktiveLegendeId() === ziel, fristNachNeustart: PROFIL.dokFristen[legendeListe()[0].dokumente[0].id] };
    dispatch({ type: 'RESET' }); o.aktivNachReset = aktiveLegendeId() === ziel; o.fristNachReset = PROFIL.dokFristen[legendeListe()[0].dokumente[0].id];
    return o;
  }, a.ziel);
  console.log(JSON.stringify(c));
  /* Altstand ohne Profilwerte: Übernahme vor dem Reset, ohne den Identitäten-Reiter zu öffnen */
  const d = await p.evaluate(() => {
    const o = {}; PROFIL.identitaet = null; PROFIL.dokFristen = {};
    STATE.agent.legende = 'grenz'; STATE.agent.dokumente['H-01'] = { gueltigBis: '2030-05-05T00:00:00.000Z' }; STATE.agent.dokumente['H-02'] = { gueltigBis: null };
    dispatch({ type: 'RESET' });
    o.identitaet = aktiveLegendeId(); o.spiegel = STATE.agent.legende; o.h01 = PROFIL.dokFristen['H-01']; o.h02 = PROFIL.dokFristen['H-02']; o.h02Vorhanden = 'H-02' in PROFIL.dokFristen;
    /* Zustandsimport mit widersprüchlichem Agentenwert: Profil hat Vorrang, beide Ansichten gleich */
    PROFIL.identitaet = 'ausweich'; const z = JSON.parse(JSON.stringify(STATE)); z.agent.legende = 'grenz';
    dispatch({ type: 'IMPORT', state: z, datei: 't.json' });
    o.impProfil = PROFIL.identitaet; o.impSpiegel = STATE.agent.legende; o.impAktiv = aktiveLegendeId();
    return o;
  });
  console.log(JSON.stringify(d));
  /* Anzeige im Profil */
  const ui = await p.evaluate(() => { dispatch({ type: 'NAVIGATION', modul: 'profil' }); VIEW.profilReiter = 'tarn'; renderModule(); return { karten: document.querySelectorAll('[id^="btn-leg-"]').length, text: document.body.innerText.includes('aktive Identität'), frist: document.body.innerText.includes('2030') }; });
  console.log(JSON.stringify(ui)); let ok = true; const chk = (n, v) => { console.log((v ? 'OK   ' : 'FAIL ') + n); if (!v) ok = false; };
  chk('Identitätsliste ohne Auftrag vorhanden', a.liste.length >= 2); chk('Wechsel ohne laufenden Auftrag', a.mission === false && a.aktiv === a.ziel);
  chk('Wechsel erzeugt keine Handler-Nachricht', a.handlerNachrichten === 0); chk('Aktive Identität nach Neustart erhalten', c.aktivNachNeustart);
  chk('Frist nach Neustart erhalten', c.fristNachNeustart === '2031-01-01T00:00:00.000Z'); chk('Identität nach Zurücksetzen erhalten', c.aktivNachReset); chk('Frist nach Zurücksetzen erhalten', c.fristNachReset === '2031-01-01T00:00:00.000Z');
  chk('Altstand: Identität vor Reset ins Profil übernommen', d.identitaet === 'grenz' && d.spiegel === 'grenz'); chk('Altstand: Frist übernommen, null als Wert gezählt', d.h01 === '2030-05-05T00:00:00.000Z' && d.h02Vorhanden && d.h02 === null);
  chk('Import: Profil hat Vorrang, Spiegel nachgeführt', d.impProfil === 'ausweich' && d.impSpiegel === 'ausweich' && d.impAktiv === 'ausweich');
  chk('Profilansicht zeigt Identitäten, aktive Markierung und Frist', ui.karten >= 1 && ui.text && ui.frist); chk('keine Seitenfehler', err.length === 0); if (err.length) console.log(err.join('|'));
  await b.close(); process.exit(ok ? 0 : 1);
})();
