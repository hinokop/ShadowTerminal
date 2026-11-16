/* Karten-Popups: ausreichend breit ohne waagerechte Bildlaufleiste; bestätigte Sichtung als TXT exportierbar (Sichtungsdaten und Entwurf);
   Archivbrücke akzeptiert die Art "sichtung" und schreibt sichtung-SI-nnn.txt in dokumente. Exit-Code 1 bei Fehlschlag. */
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { mkdtemp, copyFile, mkdir, readFile, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { chromium } = require('playwright');
const PF = require('./_pfad');
(async () => {
  const temp = await mkdtemp(join(tmpdir(), 'shadow-si-')), root = join(temp, 'pgcl-eu3.arch07');
  let helper, browser;
  try {
    for (const n of ['dokumente', 'ops']) await mkdir(join(root, n), { recursive: true });
    await copyFile(join(PF.ROOT, 'terminal_lokal.py'), join(temp, 'terminal_lokal.py'));
    helper = spawn(process.env.SHADOW_TEST_PYTHON || (process.platform === 'win32' ? 'python' : 'python3'), [join(temp, 'terminal_lokal.py'), '--serve-only']);
    const ready = await Promise.race([once(helper.stdout, 'data').then(([d]) => d.toString().trim()), once(helper, 'exit').then(([c]) => { throw new Error('Brücke beendet: ' + c); })]);
    const [, port, token] = /^#db=(\d+)\.([\w-]+)$/.exec(ready);
    const call = async extra => (await fetch('http://127.0.0.1:' + port + '/db', { method: 'POST', headers: { Origin: 'null', 'Content-Type': 'application/json', 'X-Shadow-Token': token },
      body: JSON.stringify({ op: 'export-txt', folder: 'dokumente', kind: 'sichtung', id: 'SI-001', text: 'Sichtung', ...extra }) })).json();
    const r1 = await call({}); assert.equal(r1.name, 'sichtung-SI-001.txt'); assert.equal(r1.folder, 'dokumente');
    assert.equal(await readFile(join(root, 'dokumente', 'sichtung-SI-001.txt'), 'utf8'), 'Sichtung');
    for (const extra of [{ id: 'PIN-001' }, { id: 'SI-1' }, { id: '../SI-001' }, { kind: 'unbekannt' }]) assert.match((await call(extra)).error, /Permission denied/);

    browser = await chromium.launch();
    const p = await browser.newPage({ viewport: { width: 1500, height: 1000 }, acceptDownloads: true });
    const fehler = []; p.on('pageerror', e => fehler.push(e.message));
    await p.route(/^https?:/, r => r.abort());
    await p.goto(PF.APP); await p.fill('#gate-pw', 'pw-test-123'); if (await p.isVisible('#gate-pw2')) await p.fill('#gate-pw2', 'pw-test-123'); await p.click('#gate-go');
    await p.waitForFunction(() => !document.querySelector('#gate-seq').hidden || !document.body.classList.contains('locked')); await p.keyboard.press('Space');
    const s = await p.evaluate(() => {
      dispatch({ type: 'DOSSIER_ANGELEGT', typ: 'Person', name: 'Exportperson', land: 'DE' }); const d = STATE.dossiers.auswahl;
      dispatch({ type: 'PIN_ANGELEGT', ll: [52.5, 13.4], name: 'Treffpunkt Nord', dossier: d, notiz: 'Notiz vom Entwurf' }); const pin = PROFIL.pins.at(-1);
      dispatch({ type: 'PIN_GEAENDERT', id: pin.id, zwecke: [PIN_ZWECKE[0]], umgebung: { [PIN_UMGEBUNG[0][0]]: 'zwei Zufahrten' } });
      dispatch({ type: 'SICHTUNG_HINZU', id: d, ort: '52.5000, 13.4000', text: 'Person gesehen', guete: 'unbewertet', pin: pin.id });
      return { d, pin: pin.id, notiz: pin.notiz, si: STATE.dossiers.entitaeten[d].sichtungen[0].id };
    });
    /* Entwurf per Kartenklick (Sichtung platzieren) trägt keinen Standardtext mehr in der Notiz */
    await p.evaluate(d => { VIEW.karte.reiter = 'karte'; dispatch({ type: 'NAVIGATION', modul: 'karte' }); VIEW.karte.pick = 'SI:' + d; renderModule(); }, s.d); await p.waitForTimeout(800);
    const n0 = await p.evaluate(() => PROFIL.pins.length);
    await p.evaluate(() => karte3dKlick({ lat: 52.51, lon: 13.41 })); await p.waitForTimeout(300);
    const geklickt = await p.evaluate(n0 => ({ n: PROFIL.pins.length - n0, notiz: PROFIL.pins.at(-1).notiz }), n0);
    assert.equal(geklickt.n, 1); assert.equal(geklickt.notiz, '', 'kein Standardtext in der Notiz');
    const oeffnen = id => p.evaluate(i => { VIEW.karte.reiter = 'karte'; dispatch({ type: 'NAVIGATION', modul: 'karte' }); setTimeout(() => karteWaehlen(i, true), 0); }, id);
    const mass = () => p.evaluate(() => { const b = document.querySelector('#k-auswahl'); return { w: b.getBoundingClientRect().width, scroll: b.scrollWidth, client: b.clientWidth }; });
    /* Sichtungs-Popup */
    await oeffnen(s.si); await p.locator('#si-export').waitFor();
    let m = await mass(); assert.ok(m.w >= 360, 'Sichtungs-Popup breit genug: ' + m.w); assert.ok(m.scroll <= m.client + 1, 'keine waagerechte Leiste (Sichtung): ' + JSON.stringify(m));
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#si-export')]);
    assert.equal(dl.suggestedFilename(), 'sichtung-' + s.si + '.txt');
    const txt = await readFile(await dl.path(), 'utf8');
    for (const f of [s.si, 'Exportperson', 'Person gesehen', 'Güte', 'Treffpunkt Nord', 'zwei Zufahrten']) assert.ok(txt.includes(f), 'TXT enthält ' + f);
    /* Pin-Popup (unbestätigter Entwurf) */
    const pin2 = await p.evaluate(() => { dispatch({ type: 'PIN_ANGELEGT', ll: [52.51, 13.41], name: 'Zweiter', notiz: 'lange Notiz '.repeat(5) }); return PROFIL.pins.at(-1).id; });
    await oeffnen(pin2); await p.locator('#pin-export').waitFor();
    m = await mass(); assert.ok(m.w >= 360, 'Pin-Popup breit genug: ' + m.w); assert.ok(m.scroll <= m.client + 1, 'keine waagerechte Leiste (Pin): ' + JSON.stringify(m));
    assert.deepEqual(fehler, []);
    console.log('OK: Popup-Breite, Sichtungs-TXT und Archivbrücke');
  } finally { if (browser) await browser.close(); if (helper) helper.kill(); await rm(temp, { recursive: true, force: true }); }
})().catch(e => { console.error(e); process.exitCode = 1; });
