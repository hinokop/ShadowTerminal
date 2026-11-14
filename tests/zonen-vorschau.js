/* Eigene Zonen und Pins: sofortige Vorschau (2D und 3D), gleiche Farben, verschiebbares Popup, Dossier beim Pin,
   Rückbezug von Dossier und Unterlage zur Karte. Exit-Code 1 bei Fehlschlag. */
const PF = require('./_pfad.js'); const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1500, height: 1100 } }); const p = await ctx.newPage(); const err = [];
  p.on('pageerror', x => err.push(x.message)); ctx.on('page', pg => { if (pg !== p) pg.close().catch(() => {}); });
  await p.route(/geobasis|eox|gdi\.berlin|cartocdn|open-meteo|openfreemap|unpkg/, r => r.abort());
  await p.goto(PF.APP); await p.waitForTimeout(5200); await p.fill('#gate-pw', 'pw-test-123'); const z = await p.$('#gate-pw2'); if (z && await z.isVisible()) await z.fill('pw-test-123'); await p.click('#gate-go');
  await p.waitForFunction(() => !document.body.classList.contains('locked'), null, { timeout: 20000 });
  const ok = {};
  await p.evaluate(() => { dispatch({ type: 'NAVIGATION', modul: 'karte' }); const K = VIEW.karte; K.reiter = 'karte'; K.lat = 52.5; K.lon = 13.4; K.zoom = 15; renderModule(); });
  await p.waitForTimeout(500);
  await p.evaluate(() => { dispatch({ type: 'OZONE_ANGELEGT', ll: [52.5, 13.4] }); renderModule(); }); await p.waitForTimeout(500);
  const breite = () => p.evaluate(() => { const g = document.querySelector('.k-zone.profil[data-id="ZO-001"]'); const e = g && (g.querySelector('circle') || g); return e ? e.getBoundingClientRect().width : 0; });
  const w0 = await breite();
  /* Vorschau 2D: Radius ohne „Stand aktualisieren“ */
  await p.selectOption('#oz-r', '1000'); await p.waitForTimeout(300);
  const w1 = await breite();
  ok.vorschau2D = w0 > 0 && w1 > w0 * 3 && await p.evaluate(() => PROFIL.zonen[0].r === 1000);
  /* Vorschau 3D: Nachricht mit dem neuen Radius geht an die 3D-Ansicht */
  await p.evaluate(() => { window.__gesendet = []; const o = karte3dSenden; window.karte3dSenden = function (m) { window.__gesendet.push(m); return o(m); }; VIEW.karte.ansicht3d = true; });
  await p.selectOption('#oz-r', '300'); await p.waitForTimeout(300);
  ok.vorschau3D = await p.evaluate(() => window.__gesendet.some(m => (m.zonen || []).some(zn => zn.id === 'ZO-001' && zn.r === 300)));
  await p.evaluate(() => { VIEW.karte.ansicht3d = false; renderModule(); }); await p.waitForTimeout(400);
  /* Farben 2D und 3D stimmen überein */
  const f2 = await p.evaluate(() => getComputedStyle(document.querySelector('.k-zone.profil[data-id="ZO-001"]')).getPropertyValue('--zc').trim().toLowerCase());
  const f3 = fs.readFileSync(PF.ROOT + '/karte3d.html', 'utf8');
  ok.farbenGleich = f2 === '#e08a00' && /id:'z-fl'[^}]*'fill-color':'#e08a00'/i.test(f3);
  /* Popup verschiebbar */
  await p.evaluate(() => { VIEW.karte.auswahl = 'ZO-001'; renderModule(); }); await p.waitForTimeout(400);
  const kopf = await p.evaluate(() => { const r = document.querySelector('#k-auswahl .k-pop-kopf strong').getBoundingClientRect(); return [r.left + 5, r.top + 5]; });
  await p.mouse.move(kopf[0], kopf[1]); await p.mouse.down(); await p.mouse.move(kopf[0] - 120, kopf[1] + 40, { steps: 5 }); await p.mouse.up();
  ok.popupVerschoben = await p.evaluate(() => /-120px 40px/.test(document.getElementById('k-auswahl').style.translate) && PROFIL.zonen[0].ll[0] === 52.5);
  await p.evaluate(() => { karteWaehlen(null, false); karteWaehlen('ZO-001', false); }); await p.waitForTimeout(200);
  ok.popupZurueck = await p.evaluate(() => !document.getElementById('k-auswahl').style.translate);
  /* Pin mit Dossier */
  const dos = await p.evaluate(() => pool()[0].id);
  await p.evaluate(() => { dispatch({ type: 'PIN_ANGELEGT', ll: [52.5008, 13.4012], name: 'Testpin' }); renderModule(); }); await p.waitForTimeout(400);
  const pid = await p.evaluate(() => PROFIL.pins[PROFIL.pins.length - 1].id);
  await p.evaluate(i => { VIEW.karte.auswahl = i; renderModule(); }, pid); await p.waitForTimeout(400);
  await p.selectOption('#pin-dossier', dos); await p.waitForTimeout(300);
  ok.pinDossier = await p.evaluate(a => PROFIL.pins.find(x => x.id === a[0]).dossier === a[1], [pid, dos]);
  /* Zone: Dossier und Unterlage; Rückbezug */
  await p.evaluate(a => {
    const R = PROFIL.recherche;
    R.faelle.push({ id: 'F-001', titel: 'Testfall', frage: 'x', zustand: 'offen' }); R.quellen.push({ id: 'Q-001', fall: 'F-001', art: 'Text', herkunft: 'Zeitung' }); R.fassungen.push({ id: 'V-001', quelle: 'Q-001', hash: 'abc' });
    R.beobachtungen.push({ id: 'B-001', fassung: 'V-001', fundstelle: { typ: 'Absatz', wert: '3' }, zitat: 'Tor offen', dossiers: [a], erfasst: '2026-11-14T10:00:00.000Z' });
    dispatch({ type: 'OZONE_GEAENDERT', id: 'ZO-001', dossier: a }); dispatch({ type: 'OZONE_UNTERLAGE', id: 'ZO-001', unterlage: 'B-001', op: 'verknuepfen' });
  }, dos);
  await p.evaluate(() => { VIEW.karte.auswahl = 'ZO-001'; renderModule(); }); await p.waitForTimeout(400);
  const opt = await p.evaluate(() => [...document.querySelectorAll('#oz-unterlagen li')].map(l => l.innerText).join('|'));
  ok.unterlageLesbar = /Tor offen/.test(opt) && !/\bQ-001\b|\bV-001\b/.test(opt);
  await p.evaluate(a => { STATE.dossiers.auswahl = a; dispatch({ type: 'NAVIGATION', modul: 'dossier' }); renderModule(); }, dos); await p.waitForTimeout(500);
  const orte = await p.evaluate(() => { const e = document.getElementById('rch-orte'); return e ? e.innerText : null; });
  ok.dossierZeigtOrte = !!orte && /Zone Zone 1/.test(orte) && /Pin Testpin/.test(orte);
  ok.unterlageZeigtZone = await p.evaluate(() => !!document.getElementById('rch-karte-B-001')) || await p.evaluate(() => { const e = entitaet(STATE.dossiers.auswahl), n = rchUnterlageZeile(e, rchUnterlagen(e, 'F-001', true)[0]); document.body.appendChild(n); const t = !!document.getElementById('rch-karte-B-001'); n.remove(); return t; });
  await p.click('#rch-orte [data-ort="ZO-001"]'); await p.waitForTimeout(500);
  ok.zeigenSpringtZurKarte = await p.evaluate(() => STATE.ui.modul === 'karte' && VIEW.karte.auswahl === 'ZO-001' && !!document.querySelector('.k-zone.profil[data-id="ZO-001"]'));
  /* Rücksprung bei aktiver 3D-Ansicht: Kamerafahrt zum Ziel */
  await p.evaluate(() => { VIEW.karte.ansicht3d = true; VIEW.karte.auswahl = null; window.__gesendet = []; kartenObjektZeigen('ZO-001'); });
  ok.rueckbezug3DKamera = await p.evaluate(() => { const z = PROFIL.zonen[0]; return window.__gesendet.some(m => m.typ === 'karte3d-flug' && Math.abs(m.center[0] - z.ll[1]) < 1e-9 && Math.abs(m.center[1] - z.ll[0]) < 1e-9); });
  await p.evaluate(() => { VIEW.karte.ansicht3d = false; renderModule(); });
  ok.keineFehler = err.length === 0;
  console.log(JSON.stringify(ok, null, 1)); if (err.length) console.log(err.slice(0, 5));
  await b.close(); process.exit(Object.values(ok).every(Boolean) ? 0 : 1);
})();
