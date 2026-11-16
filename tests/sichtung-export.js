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
      body: JSON.stringify({ op: 'export-txt', folder: 'dokumente', kind: 'sichtung', id: 'P-0004-SI-001', text: 'Sichtung', ...extra }) })).json();
    const r1 = await call({}); assert.equal(r1.name, 'sichtung-P-0004-SI-001.txt'); assert.equal(r1.folder, 'dokumente');
    assert.equal(await readFile(join(root, 'dokumente', 'sichtung-P-0004-SI-001.txt'), 'utf8'), 'Sichtung');
    for (const extra of [{ id: 'PIN-001' }, { id: 'SI-001' }, { id: 'P-0004-SI-1' }, { id: '../P-0004-SI-001' }, { kind: 'unbekannt' }]) assert.match((await call(extra)).error, /Permission denied/);

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
    assert.equal(dl.suggestedFilename(), 'sichtung-' + s.d + '-' + s.si + '.txt');
    const txt = await readFile(await dl.path(), 'utf8');
    for (const f of [s.si, 'Exportperson', 'Person gesehen', 'Güte', 'Treffpunkt Nord', 'zwei Zufahrten']) assert.ok(txt.includes(f), 'TXT enthält ' + f);
    /* Pin-Popup (unbestätigter Entwurf) */
    const pin2 = await p.evaluate(() => { dispatch({ type: 'PIN_ANGELEGT', ll: [52.51, 13.41], name: 'Zweiter', notiz: 'lange Notiz '.repeat(5) }); return PROFIL.pins.at(-1).id; });
    await oeffnen(pin2); await p.locator('#pin-export').waitFor();
    m = await mass(); assert.ok(m.w >= 360, 'Pin-Popup breit genug: ' + m.w); assert.ok(m.scroll <= m.client + 1, 'keine waagerechte Leiste (Pin): ' + JSON.stringify(m));
    /* Archivweg über die Oberfläche: gleiche Nummer in zwei Dossiers, gelöschte und neu vergebene Nummer, Altvermerk ohne Kennung */
    const q = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
    q.on('pageerror', e => fehler.push(e.message));
    const address = 'http://127.0.0.1:' + port + '/db';
    await q.route(/^https?:/, r => r.request().url() === address ? r.continue() : r.abort());
    await q.goto(PF.APP + ready); await q.fill('#gate-pw', 'pw-test-123'); if (await q.isVisible('#gate-pw2')) await q.fill('#gate-pw2', 'pw-test-123'); await q.click('#gate-go');
    await q.waitForFunction(() => !document.body.classList.contains('locked'));
    const z = await q.evaluate(() => {
      const neu = n => { dispatch({ type: 'DOSSIER_ANGELEGT', typ: 'Person', name: n, land: 'DE' }); return STATE.dossiers.auswahl; };
      const d1 = neu('Archiv Eins'), d2 = neu('Archiv Zwei');
      dispatch({ type: 'SICHTUNG_HINZU', id: d1, ort: '52.5000, 13.4000', text: 'Eins A', guete: 'unbewertet' });
      STATE.dossiers.entitaeten[d2].sichtungen = [{ id: 'SI-001', uid: 'abababababab', t: nowIso(), ort: '48.1000, 11.5000', text: 'Zwei A', guete: 'unbewertet', quelle: 'Eintrag' }];   /* gleiche Nummer wie in Dossier 1 (Altstand) */
      dispatch({ type: 'NAVIGATION', modul: 'karte' });
      return { d1, d2, id1: STATE.dossiers.entitaeten[d1].sichtungen[0].id };
    });
    assert.equal(z.id1, 'SI-001');
    const exportVia = async (dossier, nachricht) => {
      await q.evaluate(d => kartenTxtExport('sichtung', 'SI-001', d), dossier);
      await q.locator('#k-txt-ordner').selectOption('dokumente'); await q.locator('#dlg-ok').click();
      await q.waitForFunction(m => document.querySelector('#sys-msg').innerText.includes(m), nachricht);
    };
    const datei = n => join(root, 'dokumente', n), n1 = 'sichtung-' + z.d1 + '-SI-001.txt', n2 = 'sichtung-' + z.d2 + '-SI-001.txt';
    await exportVia(z.d1, '/pgcl-eu3.arch07/dokumente/' + n1);
    await exportVia(z.d2, '/pgcl-eu3.arch07/dokumente/' + n2);
    assert.match(await readFile(datei(n1), 'utf8'), /Eins A/); assert.match(await readFile(datei(n2), 'utf8'), /Zwei A/);
    assert.equal((await readFile(datei(n1), 'utf8')).includes('Zwei A'), false, 'zweites Dossier überschreibt das erste nicht');
    /* erneuter Export derselben Sichtung: unverändert, bei Änderung Ersetzen */
    await exportVia(z.d1, 'unverändert');
    await q.evaluate(d => { STATE.dossiers.entitaeten[d].sichtungen[0].text = 'Eins B'; }, z.d1);
    await exportVia(z.d1, 'TXT ersetzt');
    assert.match(await readFile(datei(n1), 'utf8'), /Eins B/);
    /* gelöscht und neu vergeben: gleiche Nummer, andere Sichtung -> keine Aktualisierung der alten Datei */
    const neuId = await q.evaluate(d => {
      dispatch({ type: 'SICHTUNG_ENTFERNT', id: d, sid: 'SI-001' });
      const ander = Object.values(STATE.dossiers.entitaeten).some(x => (x.sichtungen || []).some(y => y.id === 'SI-001'));
      dispatch({ type: 'SICHTUNG_HINZU', id: d, ort: '52.6000, 13.5000', text: 'Eins neu', guete: 'unbewertet' });
      const l = STATE.dossiers.entitaeten[d].sichtungen; return { id: l.at(-1).id, uid: l.at(-1).uid, ander };
    }, z.d1);
    const alt1 = await readFile(datei(n1), 'utf8');
    if (neuId.id === 'SI-001') {
      await exportVia(z.d1, 'Neue Version gespeichert');
      assert.equal(await readFile(datei(n1), 'utf8'), alt1, 'alte Datei bleibt unverändert');
      assert.match(await readFile(datei('sichtung-' + z.d1 + '-SI-001-v2.txt'), 'utf8'), /Eins neu/);
    } else assert.ok(neuId.ander, 'Nummer nur dann anders, wenn SI-001 anderswo vergeben ist');
    /* Altbestand: Vermerk nur mit Nummer und Sichtung ohne Kennung geben nichts zum Ersetzen frei */
    const alt2 = await readFile(datei(n2), 'utf8');
    const reg = await q.evaluate(() => { dispatch({ type: 'EXPORT_VERMERKT', schluessel: 'sichtung:SI-001:dokumente', name: 'x.txt', sha: 'a'.repeat(64) }); return Object.keys(PROFIL.exporte || {}).filter(k => k === 'sichtung:SI-001:dokumente').length; });
    assert.equal(reg, 0, 'Vermerk nur mit Nummer wird nicht angenommen');
    await q.evaluate(d => { const s2 = STATE.dossiers.entitaeten[d].sichtungen[0]; delete s2.uid; s2.text = 'Zwei B'; }, z.d2);
    await exportVia(z.d2, 'Neue Version gespeichert');
    assert.equal(await readFile(datei(n2), 'utf8'), alt2, 'Datei ohne bekannte Kennung wird nicht ersetzt');
    assert.match(await readFile(datei('sichtung-' + z.d2 + '-SI-001-v2.txt'), 'utf8'), /Zwei B/);
    await exportVia(z.d2, 'unverändert');                                                   /* ab jetzt mit Kennung: Wiederholung wie gewohnt */
    assert.deepEqual(fehler, []);
    console.log('OK: Popup-Breite, Sichtungs-TXT und Archivbrücke');
  } finally { if (browser) await browser.close(); if (helper) helper.kill(); await rm(temp, { recursive: true, force: true }); }
})().catch(e => { console.error(e); process.exitCode = 1; });
