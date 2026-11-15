/* Dossiers sind einheitlich (Person, Organisation, Ort): gleiche Grundansicht, ein Status je Dossier (ohne Status, beobachtet, relevant, abgeschlossen, archiviert),
   keine Bedrohungsstufe, kein Rudiment, keine Freigabe, keine Zielperson, kein Haltungsvermerk, keine Auftragszuordnung. Beispiele sind gekennzeichnet und direkt bearbeitbar.
   Altprofil: eigene Dossiers, gespeicherte Stufen und Status bleiben unverändert erhalten. Exit-Code 1 bei Fehlschlag. */
const PF = require('./_pfad.js'); const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const FIX = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'altprofil-mission.json'), 'utf8'));
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1500, height: 1100 } }); const p = await ctx.newPage(); const err = [];
  p.on('pageerror', x => err.push(x.message)); ctx.on('page', pg => { if (pg !== p) pg.close().catch(() => {}); });
  await p.route(/geobasis|eox|gdi\.berlin|cartocdn|open-meteo|openfreemap|unpkg/, r => r.abort());
  const anmelden = async () => {
    await p.goto(PF.APP); await p.waitForTimeout(5200); await p.fill('#gate-pw', 'pw-test-123'); const z = await p.$('#gate-pw2'); if (z && await z.isVisible()) await z.fill('pw-test-123'); await p.click('#gate-go');
    await p.waitForFunction(() => !document.body.classList.contains('locked'), null, { timeout: 20000 });
  };
  const ok = {}; const VERBOTEN = /Rudiment|Freigabe|Bedrohung|Stufe \d|S[1-5] bis|Zielperson|Haltungsvermerk|Rolle zur Mission|Freigeschaltet mit|Zugriff beschränkt|Zugriffsstufe/;
  const seite = () => p.evaluate(() => (document.querySelector('.split') || document.body).innerText);      /* Dossierbereich; Banner und Kopfzeile gehören zum späteren Rückbau der Oberfläche */
  const oeffnen = id => p.evaluate(i => { dispatch({ type: 'NAVIGATION', modul: 'dossier' }); VIEW.dossier.q = ''; VIEW.dossier.typ = 'Alle'; VIEW.dossier.status = 'Alle'; STATE.dossiers.auswahl = i; VIEW.dtab = 'info'; renderModule(); }, id).then(() => p.waitForTimeout(250));
  await anmelden();
  /* --- frisches Profil: alle Beispiele sichtbar --- */
  const bestand = await p.evaluate(() => { const P = pool(); return { n: P.length, typen: ['Person', 'Organisation', 'Ort'].map(t => P.filter(e => e.typ === t).length), std: P.filter(e => !e.eigen).length, beispielIds: P.map(e => e.id) }; });
  ok.alleBeispieleSichtbar = bestand.typen.every(n => n > 0) && bestand.n === bestand.std && bestand.n >= 31;
  await p.evaluate(() => { dispatch({ type: 'NAVIGATION', modul: 'dossier' }); renderModule(); }); await p.waitForTimeout(300);
  ok.listeOhneStufenfilter = !(await p.$('#df-stufe'));
  ok.listeOhneVerbotenes = !VERBOTEN.test(await seite());
  ok.listeNenntBeispiel = await p.evaluate(() => /Beispiel/.test(document.querySelector('.elist').innerText));
  const statusOptionen = await p.evaluate(() => [...document.querySelectorAll('#df-status option')].map(o => o.textContent));
  ok.statusFilterEinheitlich = ['ohne Status', 'beobachtet', 'relevant', 'abgeschlossen', 'archiviert'].every(s => statusOptionen.indexOf(s) >= 0) && statusOptionen.every(s => !/beendet|Eliminiert/i.test(s));
  ok.missionsdossiersAlsBeispiel = await p.evaluate(() => ['P-0001', 'P-0002', 'P-0003'].every(i => pool().some(e => e.id === i && istBeispiel(e))));
  await oeffnen('P-0001'); ok.missionsdossierOhneVerbotenes = !VERBOTEN.test(await seite()) && /Beispiel/.test(await seite());
  /* --- Detailansicht je Typ --- */
  const probe = await p.evaluate(() => ['Person', 'Organisation', 'Ort'].map(t => poolAlle().find(e => e.typ === t && e.mission === 'STD' && !e.eigen).id));
  for (const id of probe) {
    await oeffnen(id); const t = await seite(), typ = await p.evaluate(i => entitaet(i).typ, id);
    ok['detailOhneVerbotenes_' + typ] = !VERBOTEN.test(t) && !(await p.$('#btn-zielperson')) && !(await p.$('#sel-zusatz')) && !(await p.$('#btn-zusatz'));
    ok['detailBeispiel_' + typ] = await p.evaluate(() => /Beispiel/.test(document.querySelector('.panel, main, body').innerText));
    ok['detailStatus_' + typ] = await p.evaluate(() => { const s = document.getElementById('sel-dstatus'); return !!s && [...s.options].map(o => o.textContent).join('|') === 'ohne Status|beobachtet|relevant|abgeschlossen|archiviert'; });
    ok['detailBearbeitbar_' + typ] = !!(await p.$('#btn-dbearb'));
    ok['detailTabs_' + typ] = await p.evaluate(() => { const t = document.body.innerText; return /Übersicht/.test(t) && /Sichtungen/.test(t) && /Chronik/.test(t); });
  }
  /* Status setzen (Person) und über die Liste filtern */
  const pid = probe[0];
  await oeffnen(pid); await p.selectOption('#sel-dstatus', 'relevant'); await p.waitForTimeout(300);
  ok.statusGesetzt = await p.evaluate(i => STATE.dossiers.entitaeten[i].status === 'relevant', pid);
  /* Kopfzeile: CN statt Agent, kein Vorgang */
  ok.kopfzeileCN = await p.evaluate(() => { const k = [...document.querySelectorAll('.hf .k')].map(x => x.textContent.trim()); return k.indexOf('CN') >= 0 && k.indexOf('Agent') < 0 && k.indexOf('Vorgang') < 0 && !document.getElementById('h-op'); });
  /* Zuletzt verändert durch: Kennung, Zeit mit Wochentag und Datum, Schlüssel; beim Speichern festgehalten (bleibt nach Schlüsselwechsel) */
  ok.vermerkNachStatus = await p.evaluate(() => { const t = document.querySelector('.split').innerText; return /Zuletzt verändert durch/i.test(t) && /CN \S+ · \d{6}Z[A-Z]{3}\d\d (So|Mo|Di|Mi|Do|Fr|Sa)\., \d\d\.\d\d\.\d{4} \d\d:\d\d:\d\dZ · Schlüssel [0-9A-F]{4}-[0-9A-F]{4}/.test(t); });
  ok.vermerkFestgehalten = await p.evaluate(i => { const d = STATE.dossiers.entitaeten[i]; return !!d.durch && /^[0-9A-F]{4}-[0-9A-F]{4}$/.test(d.durch.fp) && d.durch.cn === SCENARIO.agent.codename; }, pid);
  /* Lichtbild: kein eigener Abschnitt, Klick auf das Bildfeld öffnet den Dateidialog, Entfernen-Link nur bei eigenem Foto */
  ok.keinLichtbildAbschnitt = !(await p.evaluate(() => [...document.querySelectorAll('h3')].some(x => /Lichtbild/.test(x.textContent))));
  const [fc] = await Promise.all([p.waitForEvent('filechooser', { timeout: 4000 }).catch(() => null), p.click('#fx-bild-knopf')]);
  ok.klickOeffnetDateidialog = !!fc;
  if (fc) {
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
    await fc.setFiles({ name: 'foto.png', mimeType: 'image/png', buffer: png }); await p.waitForTimeout(700);
    ok.bildGesetzt = await p.evaluate(i => !!PROFIL.bilder[i], pid) && !!(await p.$('#btn-fx'));
    await p.click('#btn-fx'); await p.waitForTimeout(300);
    ok.bildEntfernt = await p.evaluate(i => !PROFIL.bilder[i], pid) && !(await p.$('#btn-fx'));
  } else { ok.bildGesetzt = false; ok.bildEntfernt = false; }
  /* Bearbeiten ohne Stufe; gespeicherte Stufe bleibt */
  const stufeVor = await p.evaluate(i => JSON.stringify(entitaet(i).bedrohung), pid);
  await p.click('#btn-dbearb'); await p.waitForTimeout(250);
  ok.bearbeitenOhneStufe = !(await p.$('#bd-stufe')) && !(await p.$('#bd-beg'));
  await p.fill('#bd-rolle', 'Geänderte Beschreibung'); await p.evaluate(() => [...document.querySelectorAll('button')].find(x => /Änderungen speichern/.test(x.textContent)).click()); await p.waitForTimeout(400);
  ok.bearbeitenSpeichert = await p.evaluate(i => entitaet(i).rolle === 'Geänderte Beschreibung', pid);
  ok.stufeBleibtGespeichert = await p.evaluate(i => JSON.stringify(entitaet(i).bedrohung), pid) === stufeVor;
  /* Neues Dossier: keine Stufe, startet leer, ohne Beispielkennzeichnung */
  await p.evaluate(() => { dispatch({ type: 'NAVIGATION', modul: 'dossier' }); renderModule(); }); await p.click('#btn-dneu'); await p.waitForTimeout(250);
  ok.neuOhneStufe = !(await p.$('#nd-stufe'));
  await p.evaluate(() => { dispatch({ type: 'DOSSIER_ANGELEGT', name: 'Leeres Testdossier', typ: 'Organisation' }); }); await p.waitForTimeout(300);
  const neuId = await p.evaluate(() => STATE.dossiers.eigene.find(e => e.name === 'Leeres Testdossier').id);
  await oeffnen(neuId);
  ok.neuOhneBeispiel = await p.evaluate(i => !/Beispiel/.test(document.getElementById('dl-' + i).innerText) && !/Beispiel/.test(document.querySelector('.panel-kopf, .panel h2, .panel > header') ? '' : '') && !/Beispiel/.test([...document.querySelectorAll('.label')].map(x => x.textContent).join(' ')), neuId) && !VERBOTEN.test(await seite());
  /* --- Karte: Popup ohne Stufe, Kennzahlen ohne Höchststufe --- */
  const orteId = await p.evaluate(() => { const m = karteMarker().find(x => x.entitaet); return m ? m.id : null; });
  if (orteId) {
    await p.evaluate(i => { dispatch({ type: 'NAVIGATION', modul: 'karte' }); VIEW.karte.reiter = 'karte'; renderModule(); karteWaehlen(i, false); }, orteId); await p.waitForTimeout(500);
    ok.kartenPopupOhneStufe = await p.evaluate(() => { const bx = document.getElementById('k-auswahl'); return !!bx && !bx.hidden && bx.innerText.length > 0 && !/Stufe|Bedrohung/.test(bx.innerText); });
  } else ok.kartenPopupOhneStufe = false;
  /* --- Beziehungsansicht: keine Stufe in Beschriftung, Hinweistext und Formklasse --- */
  await oeffnen(probe[0]);
  ok.beziehungOhneStufe = await p.evaluate(() => { const k = [...document.querySelectorAll('[id^="gn-"]')]; return k.length > 0 && k.every(g => !/Stufe|Bedrohung| S\d/.test((g.getAttribute('aria-label') || '') + ' ' + g.textContent) && !g.querySelector('.t4, .t5')); });
  /* --- Altprofil: Daten bleiben --- */
  await p.evaluate(a => { localStorage.setItem(STORAGE_KEY, a.state); localStorage.setItem(PROFIL_KEY, a.profil); }, { state: JSON.stringify(FIX.state), profil: JSON.stringify(FIX.profil) });
  await anmelden();
  const alt = await p.evaluate(() => { const e = STATE.dossiers.eigene.find(x => x.name === 'Altprofil Person'); return e ? { id: e.id, stufe: e.bedrohung && e.bedrohung.stufe, vorhanden: pool().some(x => x.id === e.id) } : null; });
  ok.altprofilDossierSichtbar = !!alt && alt.vorhanden && typeof alt.stufe === 'number';
  if (alt) { await oeffnen(alt.id); const t = await seite(); ok.altprofilAnsichtOhneVerbotenes = !VERBOTEN.test(t) && /Altprofil Person/.test(t); if (!ok.altprofilAnsichtOhneVerbotenes) console.log('Altprofil-Treffer:', (t.match(VERBOTEN) || [])[0]); }
  else ok.altprofilAnsichtOhneVerbotenes = false;
  ok.keineJsFehler = err.length === 0; if (err.length) console.log(err.slice(0, 5));
  const bad = Object.keys(ok).filter(k => !ok[k]); console.log(JSON.stringify(ok, null, 1)); console.log(bad.length ? 'FAIL: ' + bad.join(', ') : 'alle grün');
  await b.close(); process.exit(bad.length ? 1 : 0);
})();
