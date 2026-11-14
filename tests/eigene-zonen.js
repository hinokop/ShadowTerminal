/* Eigene Zonen (ZO-nnn): ohne Auftrag anlegen, ändern, Stand aktualisieren, nach Neuladen sichtbar in 2D und in der 3D-Brücke,
   Objektfilter im Kartenprotokoll, keine Handler-Nachricht und kein Planeintrag; Gegenproben: Auftragszone bleibt unverändert,
   wiederholter Profilimport, Profil leeren. Exit-Code 1 bei Fehlschlag. */
const PF = require('./_pfad.js'); const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1500, height: 1100 } }); const p = await ctx.newPage(); const err = [];
  p.on('pageerror', x => err.push(x.message)); ctx.on('page', pg => { if (pg !== p) pg.close().catch(() => {}); });
  await p.route(/geobasis|eox|gdi\.berlin|cartocdn|open-meteo|openfreemap|unpkg/, r => r.abort());
  const anmelden = async () => {
    await p.goto(PF.APP); await p.waitForTimeout(5200); await p.fill('#gate-pw', 'pw-test-123'); const z = await p.$('#gate-pw2'); if (z && await z.isVisible()) await z.fill('pw-test-123'); await p.click('#gate-go');
    await p.waitForFunction(() => !document.body.classList.contains('locked'), null, { timeout: 20000 });
  };
  await anmelden();
  const ok = {};
  ok.ohneAuftrag = await p.evaluate(() => !!STATE.vorlauf && !zDef());
  const vorher = await p.evaluate(() => JSON.stringify([STATE.seq.nachricht, STATE.plan.length, STATE.log.filter(e => e.modul === 'Mission').length]));
  /* Anlegen über die Oberfläche */
  await p.evaluate(() => { dispatch({ type: 'NAVIGATION', modul: 'karte' }); VIEW.karte.reiter = 'karte'; VIEW.karte.lat = 52.5; VIEW.karte.lon = 13.4; VIEW.karte.zoom = 14; renderModule(); });
  await p.waitForTimeout(500);
  ok.knopfAktiv = await p.evaluate(() => { const k = $('k-ozone-neu'); return !!k && !k.disabled; });
  await p.click('#k-ozone-neu');
  const mitte = await p.evaluate(() => { const r = $('k-svg').getBoundingClientRect(); return [r.left + r.width * 0.5, r.top + r.height * 0.5]; });
  await p.mouse.click(mitte[0], mitte[1]); await p.waitForTimeout(500);
  ok.angelegt = await p.evaluate(() => PROFIL.zonen.length === 1 && PROFIL.zonen[0].id === 'ZO-001' && PROFIL.zonen[0].name === 'Zone 1' && !(STATE.vorlauf === false));
  ok.popupOffen = await p.evaluate(() => !$('k-auswahl').hidden && !!$('oz-stand') && !!$('oz-protokoll') && !!$('oz-weg'));
  /* Bearbeiten */
  await p.fill('#oz-name', 'Hafenzufahrt'); await p.dispatchEvent('#oz-name', 'change'); await p.waitForTimeout(200);
  await p.selectOption('#oz-r', '500'); await p.waitForTimeout(200);
  await p.fill('#oz-notiz', 'Zufahrt gesichtet, Tor offen'); await p.dispatchEvent('#oz-notiz', 'change'); await p.waitForTimeout(200);
  ok.bearbeitet = await p.evaluate(() => { const z = PROFIL.zonen[0]; return z.name === 'Hafenzufahrt' && z.r === 500 && z.notiz === 'Zufahrt gesichtet, Tor offen'; });
  /* Unterlage und Dossier verknüpfen */
  await p.evaluate(() => {
    const R = PROFIL.recherche;
    R.faelle.push({ id: 'F-001', titel: 'Testfall', frage: 'x', zustand: 'offen' });
    R.quellen.push({ id: 'Q-001', fall: 'F-001', art: 'Text' });
    R.fassungen.push({ id: 'V-001', quelle: 'Q-001', hash: 'abc123' });
    R.beobachtungen.push({ id: 'B-001', fassung: 'V-001', fundstelle: { typ: 'Absatz', wert: '3' }, zitat: 'Tor offen', dossiers: [] });
    profilSpeichern(); renderModule();
  });
  await p.evaluate(() => { VIEW.karte.auswahl = 'ZO-001'; renderModule(); }); await p.waitForTimeout(500);
  ok.unterlageSichtbar = await p.evaluate(() => !!$('oz-unt-ja'));
  await p.click('#oz-unt-ja'); await p.waitForTimeout(300);
  ok.unterlageVerknuepft = await p.evaluate(() => (PROFIL.zonen[0].unterlagen || []).join() === 'B-001');
  const dos = await p.evaluate(() => poolAlle()[0].id);
  await p.selectOption('#oz-dossier', dos); await p.waitForTimeout(300);
  ok.dossierVerknuepft = await p.evaluate(d => PROFIL.zonen[0].dossier === d, dos);
  /* Stand aktualisieren: eigene Prüfung mit Zeitstempel, keine Antwort, keine Sichtung */
  const standAlt = await p.evaluate(() => PROFIL.zonen[0].stand);
  await p.waitForTimeout(1100);
  const sichtungen = await p.evaluate(() => JSON.stringify(Object.keys(STATE.dossiers.entitaeten).map(k => (STATE.dossiers.entitaeten[k].sichtungen || []).length)));
  await p.fill('#oz-bem', 'Vor Ort erneut geprüft'); await p.click('#oz-stand'); await p.waitForTimeout(300);
  ok.standAktualisiert = await p.evaluate(a => { const z = PROFIL.zonen[0]; return Date.parse(z.stand) > Date.parse(a) && z.standBemerkung === 'Vor Ort erneut geprüft'; }, standAlt);
  ok.keineSichtung = (await p.evaluate(() => JSON.stringify(Object.keys(STATE.dossiers.entitaeten).map(k => (STATE.dossiers.entitaeten[k].sichtungen || []).length)))) === sichtungen;
  /* Darstellung: neutral, ohne Auftragsbewertung */
  const dar = await p.evaluate(() => { const g = document.querySelector('.k-zone[data-id="ZO-001"]'); return g ? { klasse: g.getAttribute('class'), text: g.textContent } : null; });
  ok.neutral2D = !!dar && /\bprofil\b/.test(dar.klasse) && !/ruhig|leicht|bedroht|akut|auto/.test(dar.klasse) && /Hafenzufahrt/.test(dar.text);
  const popup = await p.evaluate(() => $('k-auswahl').innerText);
  ok.popupOhneHandler = !/Handler|ARGUS|Bewertung|Lage bestätigen|Lage erfragen|informieren/.test(popup) && /Stand aktualisieren/.test(popup) && /Protokoll öffnen/.test(popup) && /Unterlage verknüpfen|Keine Unterlage|B-001/.test(popup);
  /* Neuladen: bleibt in 2D und in der 3D-Brücke */
  await anmelden();
  await p.evaluate(() => { dispatch({ type: 'NAVIGATION', modul: 'karte' }); VIEW.karte.reiter = 'karte'; VIEW.karte.lat = PROFIL.zonen[0].ll[0]; VIEW.karte.lon = PROFIL.zonen[0].ll[1]; VIEW.karte.zoom = 14; renderModule(); });
  await p.waitForTimeout(800);
  ok.nachNeuladen2D = await p.evaluate(() => PROFIL.zonen.length === 1 && !!document.querySelector('.k-zone.profil[data-id="ZO-001"]'));
  ok.nachNeuladen3D = await p.evaluate(() => { const z = karte3dDaten().zonen.find(x => x.id === 'ZO-001'); return !!z && z.name === 'Hafenzufahrt' && z.r === 500; });
  /* Objektfilter im Protokoll */
  await p.evaluate(() => { VIEW.karte.auswahl = 'ZO-001'; renderModule(); }); await p.waitForTimeout(400);
  await p.click('#oz-protokoll'); await p.waitForTimeout(500);
  const prot = await p.evaluate(() => ({ filter: $('kp-objekt').value, zeilen: [...document.querySelectorAll('table tbody tr')].map(r => r.innerText) }));
  ok.protokollFilter = prot.filter === 'ZO-001' && prot.zeilen.length === 7 && prot.zeilen.every(t => /Hafenzufahrt/.test(t));
  ok.protokollArten = /Zone angelegt/.test(prot.zeilen.join('\n')) && /Stand der Zone aktualisiert/.test(prot.zeilen.join('\n'));
  /* kein Handler, kein Plan */
  await p.waitForTimeout(2500);
  const nachher = await p.evaluate(() => JSON.stringify([STATE.seq.nachricht, STATE.plan.length, STATE.log.filter(e => e.modul === 'Mission').length]));
  ok.keinHandlerKeinPlan = vorher === nachher;
  /* Import: identisch = keine Kopie; geänderter Inhalt = neue Kennung, zweiter Import keine weitere; fehlende Bezüge werden weggelassen */
  const q = await p.evaluate(() => { const o = {}; Object.keys(PROFIL).forEach(k => { if (k !== 'leer') o[k] = PROFIL[k]; }); return JSON.parse(JSON.stringify(o)); });
  const anz = () => p.evaluate(() => PROFIL.zonen.map(z => z.id + ':' + z.name).join('|'));
  await p.evaluate(q => dispatch({ type: 'PROFIL_IMPORT', profil: q, datei: 'a.json' }), q); await p.evaluate(q => dispatch({ type: 'PROFIL_IMPORT', profil: q, datei: 'a.json' }), q);
  ok.importIdentisch = (await anz()) === 'ZO-001:Hafenzufahrt';
  const q2 = JSON.parse(JSON.stringify(q)); q2.zonen[0].r = 100;
  await p.evaluate(q => dispatch({ type: 'PROFIL_IMPORT', profil: q, datei: 'b.json' }), q2);
  const nach1 = await anz();
  await p.evaluate(q => dispatch({ type: 'PROFIL_IMPORT', profil: q, datei: 'b.json' }), q2);
  const nach2 = await anz();
  ok.importAndererInhalt = nach1 === 'ZO-001:Hafenzufahrt|ZO-002:Hafenzufahrt (Import ZO-001)' && nach2 === nach1;
  const q3 = JSON.parse(JSON.stringify(q)); q3.zonen = [{ id: 'ZO-077', name: 'Fremd', ll: [52.1, 13.1], r: 200, notiz: '', unterlagen: ['B-999'], dossier: 'X-NIE', t: '2026-11-01T10:00:00.000Z', stand: '2026-11-01T10:00:00.000Z' }]; q3.seq.zone = 77;
  await p.evaluate(q => dispatch({ type: 'PROFIL_IMPORT', profil: q, datei: 'c.json' }), q3);
  const fremd = await p.evaluate(() => PROFIL.zonen.find(z => z.id === 'ZO-077'));
  ok.importOhneBezug = !!fremd && !fremd.dossier && (fremd.unterlagen || []).length === 0;
  ok.importBezugEindeutig = await p.evaluate(() => { const z = PROFIL.zonen.find(y => y.id === 'ZO-001'); return z.unterlagen.join() === 'B-001' && !!z.dossier; });
  /* Profil leeren: Zonen weg, Zähler bleibt */
  await p.evaluate(() => dispatch({ type: 'PROFIL_LEEREN' }));
  ok.leerenZonenWeg = await p.evaluate(() => PROFIL.zonen.length === 0 && PROFIL.seq.zone >= 77);
  await p.evaluate(() => dispatch({ type: 'OZONE_ANGELEGT', ll: [52.5, 13.4] }));
  ok.zaehlerBleibt = await p.evaluate(() => PROFIL.zonen[0].id === 'ZO-078');
  /* Gegenprobe: mit Auftrag bleibt die Auftragszone auf ihrem Pfad */
  await p.evaluate(() => { dispatch({ type: 'KENNWORT_SCHALTER', an: false }); dispatch({ type: 'STATUS_GESETZT', status: 'Standby' }); dispatch({ type: 'MISSION_ZUGEWIESEN', id: 'M1' }); dispatch({ type: 'MISSION_ANGENOMMEN', id: 'M1' }); dispatch({ type: 'MISSION_BEGINN_JETZT' }); dispatch({ type: 'NAVIGATION', modul: 'karte' }); VIEW.karte.reiter = 'karte'; renderModule(); });
  await p.waitForTimeout(800);
  await p.evaluate(() => dispatch({ type: 'ZONE_ANGELEGT', ll: [52.4738, 13.4515] }));
  ok.auftragszoneBleibt = await p.evaluate(() => { const z = karteZonen(); const a = z.find(x => /^ZN-/.test(x.id)), o = z.find(x => x.id === 'ZO-078'); return !!a && !a.profil && a.wertung === 'ruhig' && !!o && o.profil === true && !!zonenEigene(zDef()).find(x => x.id === a.id) && !PROFIL.zonen.some(x => x.id === a.id); });
  await p.evaluate(() => { VIEW.karte.auswahl = 'ZN-001'; renderModule(); }); await p.waitForTimeout(400);
  ok.auftragPopup = await p.evaluate(() => !!$('zn-melden') && !!$('zn-frage') && !$('oz-stand'));
  await p.evaluate(() => { VIEW.karte.auswahl = 'ZO-078'; renderModule(); }); await p.waitForTimeout(400);
  ok.eigenPopupMitAuftrag = await p.evaluate(() => !$('zn-melden') && !!$('oz-stand'));
  ok.keineFehler = err.length === 0;
  console.log(JSON.stringify(ok, null, 1)); if (err.length) console.log(err.slice(0, 5));
  await b.close(); process.exit(Object.values(ok).every(Boolean) ? 0 : 1);
})();
