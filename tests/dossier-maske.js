/* Dossiermaske: keine Verteilerbeschränkung; Erkenntnislage neutral und über "Dossier bearbeiten" änderbar (Beispiele, eigene Dossiers; nicht bei Orten);
   Sichtung über Button und Dialog mit Bewertung; "Sichtung auf der Karte" verweist auf vorhandene Sichtungen; "Sichtung platzieren" setzt per Kartenklick einen Entwurfs-Pin. Exit-Code 1 bei Fehlschlag. */
const PF = require('./_pfad.js'); const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1500, height: 1100 } }); const p = await ctx.newPage(); const err = [], ok = {};
  p.on('pageerror', x => err.push(x.message));
  await p.route(/geobasis|eox|gdi\.berlin|cartocdn|open-meteo|openfreemap|unpkg/, r => r.abort());
  await p.goto(PF.APP); await p.waitForTimeout(5200); await p.fill('#gate-pw', 'pw-test-123'); const z = await p.$('#gate-pw2'); if (z && await z.isVisible()) await z.fill('pw-test-123'); await p.click('#gate-go');
  await p.waitForFunction(() => !document.body.classList.contains('locked'), null, { timeout: 20000 });
  const seite = () => p.evaluate(() => (document.querySelector('.split') || document.body).innerText);
  const oeffnen = (id, tab) => p.evaluate(([i, t]) => { dispatch({ type: 'NAVIGATION', modul: 'dossier' }); VIEW.dossier.q = ''; VIEW.dossier.typ = 'Alle'; VIEW.dossier.status = 'Alle'; STATE.dossiers.auswahl = i; VIEW.dtab = t || 'info'; renderModule(); }, [id, tab]);
  const bearbeiten = () => p.evaluate(() => { const bt = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'Dossier bearbeiten'); bt.click(); });
  const ids = await p.evaluate(() => {
    dispatch({ type: 'DOSSIER_ANGELEGT', typ: 'Person', name: 'Maskenperson', land: 'DE' }); const eigen = STATE.dossiers.auswahl;
    dispatch({ type: 'DOSSIER_ANGELEGT', typ: 'Person', name: 'Ohne Standort', land: 'DE' }); const ohne = STATE.dossiers.auswahl;
    dispatch({ type: 'DOSSIER_ANGELEGT', typ: 'Ort', name: 'Maskenort', land: 'DE' }); const ort = STATE.dossiers.auswahl;
    return { eigen, ohne, ort, beispiel: poolAlle().find(e => e.typ === 'Person' && e.mission === 'STD' && !e.eigen).id };
  });
  /* Verteilerbeschränkung und Spielhinweise entfallen */
  await oeffnen(ids.eigen); let t = await seite();
  ok.ohneVerteilerbeschraenkung = !/Verteilerbeschränkung/i.test(t);
  ok.erkenntnislageNeutral = /Erkenntnislage\s*Keine Erkenntnis erfasst\./i.test(t) && !/altern ab Nutzungsbeginn|Nichts Frisches/.test(t);
  await oeffnen(ids.beispiel); t = await seite();
  ok.beispielOhneVerteilerbeschraenkung = !/Verteilerbeschränkung/i.test(t) && !/Nichts Frisches|altern ab Nutzungsbeginn/.test(t);
  /* Erkenntnislage über Dossier bearbeiten: eigenes Dossier, Beispiel; zurücksetzen durch Leeren */
  await oeffnen(ids.eigen); await bearbeiten(); await p.locator('#bd-erk').fill('Zwei Hinweise aus der Nachbarschaft.'); await p.click('#dlg-ok'); await p.waitForTimeout(300);
  ok.eigenErkenntnisGespeichert = await p.evaluate(i => STATE.dossiers.entitaeten[i].erkenntnis === 'Zwei Hinweise aus der Nachbarschaft.', ids.eigen) && /Zwei Hinweise aus der Nachbarschaft\./.test(await seite());
  await bearbeiten(); ok.dialogMitBestehendemText = (await p.locator('#bd-erk').inputValue()) === 'Zwei Hinweise aus der Nachbarschaft.';
  await p.locator('#bd-erk').fill(''); await p.click('#dlg-ok'); await p.waitForTimeout(300);
  ok.leerenSetztZurueck = await p.evaluate(i => !('erkenntnis' in STATE.dossiers.entitaeten[i]), ids.eigen) && /Keine Erkenntnis erfasst\./.test(await seite());
  await oeffnen(ids.beispiel); await bearbeiten(); const vorgabe = await p.locator('#bd-erk').inputValue();
  await p.locator('#bd-erk').fill('Eigene Einschätzung zur Lage.'); await p.click('#dlg-ok'); await p.waitForTimeout(300);
  ok.beispielErkenntnisBearbeitbar = vorgabe.length > 0 && await p.evaluate(i => STATE.dossiers.entitaeten[i].erkenntnis === 'Eigene Einschätzung zur Lage.' && STATE.dossiers.entitaeten[i].selbstBearbeitet === true, ids.beispiel);
  await oeffnen(ids.ort); await bearbeiten(); ok.ortOhneErkenntnisfeld = !(await p.$('#bd-erk')); await p.click('#dlg-abbrechen').catch(() => p.keyboard.press('Escape'));
  /* Sichtung hinzufügen: Button und Dialog mit Bewertung */
  await p.evaluate(() => { const o = document.querySelector('#dlg[open]'); if (o) o.close(); });
  await oeffnen(ids.eigen, 'sichtungen');
  ok.ohneEingabezeileImReiter = !(await p.$('#si-ort')) && !!(await p.$('#btn-si')) && /Sichtung hinzufügen/.test(await p.locator('#btn-si').innerText());
  await p.click('#btn-si'); await p.locator('#si-ort').fill('Hauptbahnhof'); await p.locator('#si-text').fill('Person am Gleis 4'); await p.locator('#si-guete').selectOption('plausibel'); await p.click('#dlg-ok'); await p.waitForTimeout(300);
  const si = await p.evaluate(i => STATE.dossiers.entitaeten[i].sichtungen, ids.eigen);
  ok.sichtungMitBewertung = si.length === 1 && si[0].ort === 'Hauptbahnhof' && si[0].text === 'Person am Gleis 4' && si[0].guete === 'plausibel';
  await p.click('#btn-si'); const leerGesperrt = await p.locator('#dlg-ok').isDisabled().catch(() => null); await p.keyboard.press('Escape');
  ok.leereSichtungNichtMoeglich = leerGesperrt === true || (await p.evaluate(i => STATE.dossiers.entitaeten[i].sichtungen.length, ids.eigen)) === 1;
  /* Sichtung auf der Karte verweist auf vorhandene Sichtung mit Ort, ohne neuen Pin */
  await p.evaluate(i => { dispatch({ type: 'SICHTUNG_HINZU', id: i, ort: '52.6100, 13.5100', text: 'mit Koordinate', guete: 'unbewertet' }); }, ids.eigen);
  const pins0 = await p.evaluate(() => (PROFIL.pins || []).length);
  await oeffnen(ids.eigen); await p.click('#btn-dk-sichtung'); await p.waitForTimeout(1200);
  const k1 = await p.evaluate(() => ({ mod: STATE.ui.modul, lat: VIEW.karte.lat, lon: VIEW.karte.lon, pins: (PROFIL.pins || []).length }));
  ok.sichtungAufKarteVerweist = k1.mod === 'karte' && Math.abs(k1.lat - 52.61) < 0.05 && Math.abs(k1.lon - 13.51) < 0.05 && k1.pins === pins0;
  /* Sichtung platzieren: Kartenklick setzt Entwurfs-Pin zum Dossier */
  await oeffnen(ids.ohne); ok.platzierenVorhanden = !!(await p.$('#btn-dk-platzieren'));
  await p.click('#btn-dk-platzieren'); await p.waitForTimeout(400);
  const k2 = await p.evaluate(() => ({ pick: VIEW.karte.pick, mod: STATE.ui.modul, leiste: (document.querySelector('.k-pickbar') || {}).innerText || '' }));
  ok.platzierenStartetKartenmodus = k2.pick === 'SI:' + ids.ohne && k2.mod === 'karte' && /Sichtungsentwurf/.test(k2.leiste);
  await p.locator('#k-svg').click({ position: { x: 400, y: 300 } }); await p.waitForTimeout(400);
  const k3 = await p.evaluate(() => { const pin = PROFIL.pins[PROFIL.pins.length - 1]; return { pick: VIEW.karte.pick, dossier: pin && pin.dossier, name: pin && pin.name, ll: pin && pin.ll, n: PROFIL.pins.length }; });
  ok.klickSetztEntwurfspin = k3.pick === null && k3.dossier === ids.ohne && /^M-\d\d$/.test(k3.name) && Array.isArray(k3.ll) && k3.n === pins0 + 1;
  /* Befund 1: ältere Sichtung mit Ort, danach drei ohne Ort und ausgeblendete Ebene: der Sprung zeigt und wählt die Sichtung trotzdem */
  const alt = await p.evaluate(() => {
    dispatch({ type: 'DOSSIER_ANGELEGT', typ: 'Person', name: 'Altsichtung', land: 'DE' }); const i = STATE.dossiers.auswahl;
    dispatch({ type: 'SICHTUNG_HINZU', id: i, ort: '48.1370, 11.5750', text: 'alt mit Ort', guete: 'unbewertet' }); const sid = STATE.dossiers.entitaeten[i].sichtungen[0].id;
    ['a', 'b', 'c'].forEach(x => dispatch({ type: 'SICHTUNG_HINZU', id: i, ort: '', text: 'ohne Ort ' + x, guete: 'unbewertet' }));
    VIEW.karte.ebenen.sichtungen = false; return { i, sid, pins: (PROFIL.pins || []).length };
  });
  await oeffnen(alt.i); await p.click('#btn-dk-sichtung'); await p.waitForTimeout(1500);
  const sp = await p.evaluate(sid => ({ mod: STATE.ui.modul, lat: VIEW.karte.lat, lon: VIEW.karte.lon, auswahl: VIEW.karte.auswahl, im: karteMarker().some(m => m.id === sid), pins: (PROFIL.pins || []).length }), alt.sid);
  ok.aeltereSichtungAngezeigtUndGewaehlt = sp.mod === 'karte' && sp.im && sp.auswahl === alt.sid && Math.abs(sp.lat - 48.137) < 0.05 && Math.abs(sp.lon - 11.575) < 0.05 && sp.pins === alt.pins;
  await p.evaluate(() => { VIEW.karte.ebenen.sichtungen = true; });
  /* Befund 2: eigene Erkenntnislage eines Beispiels bleibt in der Profilsicherung erhalten; Leeren bleibt wirksam */
  const prof = await p.evaluate(i => { profilSpeichern(); const dd = JSON.parse(localStorage.getItem(PROFIL_KEY)).dossierDaten; return dd[i] && dd[i].erkenntnis; }, ids.beispiel);
  ok.erkenntnisInProfilsicherung = prof === 'Eigene Einschätzung zur Lage.';
  const profilText = await p.evaluate(() => localStorage.getItem(PROFIL_KEY));
  await p.evaluate(() => { localStorage.removeItem(STORAGE_KEY); }); await p.goto(PF.APP); await p.waitForTimeout(5200);
  await p.fill('#gate-pw', 'pw-test-123'); const z2 = await p.$('#gate-pw2'); if (z2 && await z2.isVisible()) await z2.fill('pw-test-123'); await p.click('#gate-go');
  await p.waitForFunction(() => !document.body.classList.contains('locked'), null, { timeout: 20000 });
  ok.erkenntnisNachNeuemZustand = await p.evaluate(i => STATE.dossiers.entitaeten[i].erkenntnis === 'Eigene Einschätzung zur Lage.', ids.beispiel);
  await oeffnen(ids.beispiel); await bearbeiten(); await p.locator('#bd-erk').fill(''); await p.click('#dlg-ok'); await p.waitForTimeout(300);
  await p.evaluate(() => { localStorage.removeItem(STORAGE_KEY); }); await p.goto(PF.APP); await p.waitForTimeout(5200);
  await p.fill('#gate-pw', 'pw-test-123'); const z3 = await p.$('#gate-pw2'); if (z3 && await z3.isVisible()) await z3.fill('pw-test-123'); await p.click('#gate-go');
  await p.waitForFunction(() => !document.body.classList.contains('locked'), null, { timeout: 20000 });
  ok.leerenBleibtNachWiederherstellung = await p.evaluate(i => typeof STATE.dossiers.entitaeten[i].erkenntnis !== 'string', ids.beispiel);
  /* Profilimport in ein frisches Profil */
  await p.evaluate(() => { localStorage.clear(); }); await p.goto(PF.APP); await p.waitForTimeout(5200);
  await p.fill('#gate-pw', 'pw-test-123'); const z4 = await p.$('#gate-pw2'); if (z4 && await z4.isVisible()) await z4.fill('pw-test-123'); await p.click('#gate-go');
  await p.waitForFunction(() => !document.body.classList.contains('locked'), null, { timeout: 20000 });
  ok.erkenntnisBeiProfilimport = await p.evaluate(([t, i]) => { dispatch({ type: 'PROFIL_IMPORT', profil: JSON.parse(t), datei: 'p.json' }); return STATE.dossiers.entitaeten[i].erkenntnis === 'Eigene Einschätzung zur Lage.'; }, [profilText, ids.beispiel]);
  ok.keineJsFehler = err.length === 0; if (err.length) console.log(err.slice(0, 4));
  const bad = Object.keys(ok).filter(k => ok[k] !== true); console.log(JSON.stringify(ok, null, 1)); console.log(bad.length ? 'FAIL: ' + bad.join(', ') : 'alle grün');
  await b.close(); process.exit(bad.length ? 1 : 0);
})();
