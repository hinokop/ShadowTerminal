/* Phase 5c1b: Zustandsformat 5 mit Altbestand.
   Prüft (Abnahmekriterien 1–8 aus docs/phase5c-schemainventar.md, Abschnitt 8):
   (1) frischer Zustand im Format 5 und wiederholtes Laden ohne Veränderung;
   (2) gespeicherter Zustand Format 4 mit echten Daten an P-0001 bis P-0003, Rohsicherung, Überführung, Speicherung;
   (3) Import der Formate 2, 3 und 4 sowie erneuter Import eines überführten Zustands;
   (4) verlustfreie Übernahme aller historischen Felder in altbestand;
   (5) Notizen und Operative Einschränkungen über Überführung, Zurücksetzen, Export, Import und Neuladen;
   (6) erzwungene Speicherfehler vor (Sicherung) und während (Speichern) der Überführung ohne Datenverlust;
   (7) Wiederherstellung aus der Sicherung; Kennungen, Sperren, Dossierbezüge, Fälle, Pins und Profilzonen bleiben;
   (8) unveränderte Onion-Adresse (Übernahme vom alten Schlüssel, stabil über Neuladen und Zurücksetzen).
   Exit-Code 1 bei Fehlschlag. */
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { APP } = require('./_pfad');
const FIX = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'altprofil-mission.json'), 'utf8'));
const KERN = ['version', 't0', 'idv', 'ui', 'seq', 'dossiers', 'log', 'agent', 'alterung'];
const SICH = 'fieldterminal.v1.v4-sicherung';
const HOST_ALT = 'abcdefghijklmnopqrstuvwxyz234567abcdefghijklmnopqrstuvwd.onion';

/* Zustand Format 4 aus dem Altprofil, ergänzt um echte Daten an den früheren Missionsdossiers und Profiltexte */
function v4Eingang() {
  const s = JSON.parse(JSON.stringify(FIX.state));
  const E = s.dossiers.entitaeten, t = '2026-11-15T05:00:00.000Z';
  E['P-0001'] = Object.assign(E['P-0001'], { status: 'relevant', statusAm: t, kurzlage: 'Kurzlage zu Kaya', notizen: [{ id: 'DN-901', t, text: 'Notiz an P-0001' }],
    sichtungen: [{ id: 'SI-901', t, ort: 'Berlin', text: 'Sichtung an P-0001', guete: 'bestaetigt' }] });
  E['P-0002'].notizen = [{ id: 'DN-902', t, text: 'Notiz an P-0002' }];
  E['P-0003'].erkenntnis = 'Erkenntnis zu P-0003';
  s.seq.notiz = Math.max(s.seq.notiz || 0, 902); s.seq.sichtung = Math.max(s.seq.sichtung || 0, 901);
  s.agent.notizen = 'Notiz aus Format 4'; s.agent.notizenGeaendert = '2026-11-14T08:00:00.000Z';
  s.agent.einschraenkungen = 'Einschränkung aus Format 4'; s.agent.einschraenkungenGeaendert = '2026-11-14T09:00:00.000Z';
  s.aussagen = [{ id: 'AS-001', t, entitaet: 'P-9051', wert: true, text: 'alte Aussage', status: 'offen' }];
  const pr = JSON.parse(JSON.stringify(FIX.profil));
  pr.gesperrt = ['P-9052'];
  delete pr.profiltexte;
  return { state: JSON.stringify(s), profil: JSON.stringify(pr) };
}

(async () => {
  const browser = await chromium.launch();
  const fehler = [];
  try {
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 }, reducedMotion: 'reduce', acceptDownloads: true });
    /* Erzwungene Speicherfehler: Regel in sessionStorage { exakt: [...], praefix: [...] } */
    await ctx.addInitScript(() => {
      const orig = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k, v) {
        if (this === window.localStorage) {
          let r = null; try { r = JSON.parse(window.sessionStorage.getItem('ft-fehler') || 'null'); } catch (e) { r = null; }
          if (r && ((r.exakt || []).includes(k) || (r.praefix || []).some(x => String(k).indexOf(x) === 0))) {
            const e = new Error('Speicher voll (Test)'); e.name = 'QuotaExceededError'; throw e;
          }
        }
        return orig.call(this, k, v);
      };
    });
    const p = await ctx.newPage();
    p.setDefaultTimeout(20000);
    p.on('pageerror', e => fehler.push(e.message));
    await p.route(/^https?:/, r => r.abort());
    const anmelden = async () => {
      await p.goto(APP);
      await p.fill('#gate-pw', 'pw-test-123');
      if (await p.isVisible('#gate-pw2')) await p.fill('#gate-pw2', 'pw-test-123');
      await p.click('#gate-go');
      await p.waitForFunction(() => !document.body.classList.contains('locked'));
    };
    const gespeichert = () => p.evaluate(() => JSON.parse(localStorage.getItem(STORAGE_KEY)));
    const ohneSitzung = z => { const o = JSON.parse(JSON.stringify(z)); delete o.log; delete o.seq.log; return o; };
    const einlegen = (roh, mitDienst) => p.evaluate(a => {
      Object.keys(localStorage).filter(k => k.indexOf(STORAGE_KEY + '.v4-sicherung') === 0 || k === STORAGE_KEY + '.defekt').forEach(k => localStorage.removeItem(k));
      localStorage.setItem(STORAGE_KEY, a.state); localStorage.setItem(PROFIL_KEY, a.profil);
      if (a.mitDienst) localStorage.setItem(STORAGE_KEY + '.dienste', JSON.stringify({ M1: { host: a.host, t: '2026-01-02T03:04:05.000Z' } }));
    }, Object.assign({ mitDienst, host: HOST_ALT }, roh));
    const fehlerRegel = r => p.evaluate(x => { if (x) sessionStorage.setItem('ft-fehler', JSON.stringify(x)); else sessionStorage.removeItem('ft-fehler'); }, r);

    /* (1) Frischer Zustand */
    await anmelden();
    const f1 = await p.evaluate(() => ({ v: STATE.version, keys: Object.keys(STATE), alt: 'altbestand' in STATE, host: document.getElementById('tb-host').textContent,
      dienste: JSON.parse(localStorage.getItem(STORAGE_KEY + '.dienste')), sich: Object.keys(localStorage).some(k => k.indexOf(STORAGE_KEY + '.v4-sicherung') === 0) }));
    assert.equal(f1.v, 5, 'frischer Zustand im Format 5');
    assert.equal(f1.alt, false, 'frischer Zustand ohne Altbestand');
    assert.ok(f1.keys.every(k => KERN.includes(k)), 'frischer Zustand nur mit Kernfeldern: ' + f1.keys.join(','));
    assert.equal(f1.sich, false, 'keine Sicherung bei frischem Zustand');
    assert.equal(f1.dienste.terminal.host, f1.host, 'Adresse unter festem Schlüssel');
    const st1 = await gespeichert();
    await anmelden();
    const st2 = await gespeichert();
    assert.equal(st2.version, 5);
    assert.deepEqual(ohneSitzung(st2), ohneSitzung(st1), 'wiederholtes Laden verändert einen Zustand im Format 5 nicht');
    assert.equal(await p.evaluate(() => document.getElementById('tb-host').textContent), f1.host, 'Adresse über Neuladen stabil');

    /* (2) Zustand Format 4 mit echten Daten an P-0001 bis P-0003; (8) Adresse vom alten Schlüssel */
    const roh = v4Eingang();
    await einlegen(roh, true);
    await anmelden();
    const m = await p.evaluate(a => {
      const sicherung = localStorage.getItem(STORAGE_KEY + '.v4-sicherung');
      const E = STATE.dossiers.entitaeten;
      return { v: STATE.version, keys: Object.keys(STATE), sicherungGleich: sicherung === a, gesp: JSON.parse(localStorage.getItem(STORAGE_KEY)).version,
        p1: E['P-0001'], p2: E['P-0002'], p3: E['P-0003'], log: STATE.log.filter(l => l.aktion === 'Zustand überführt').map(l => l.detail),
        meldung: document.getElementById('sys-msg').textContent, host: document.getElementById('tb-host').textContent,
        dienste: JSON.parse(localStorage.getItem(STORAGE_KEY + '.dienste')), persist: Store.isPersistent(),
        pt: JSON.parse(JSON.stringify(PROFIL.profiltexte)), dd: JSON.parse(JSON.stringify(PROFIL.dossierDaten)),
        sperre: zielZugang('P-0005') && zielZugang('P-0005').gesperrt, eigene: STATE.dossiers.eigene.map(e => e.id),
        pins: PROFIL.pins.map(x => x.id + ':' + (x.dossier || '')), zonen: PROFIL.zonen.map(z => z.id), faelle: PROFIL.recherche.faelle.map(f => f.id),
        aussagen: aussagenListe().length };
    }, roh.state);
    assert.equal(m.v, 5, 'überführter Zustand im Format 5');
    assert.equal(m.gesp, 5, 'überführter Zustand gespeichert');
    assert.equal(m.persist, true, 'Sitzung persistent');
    assert.equal(m.sicherungGleich, true, 'Rohtext des Formats 4 zeichengleich gesichert');
    assert.ok(m.keys.every(k => KERN.includes(k) || k === 'altbestand'), 'aktiver Kern ohne Missionsfelder: ' + m.keys.join(','));
    assert.equal(m.log.length, 1, 'genau ein Protokolleintrag zur Überführung');
    assert.match(m.log[0], /^Version 4 → 5: \d+ Felder/);
    assert.match(m.meldung, /überführt/, 'Hinweis auf die Überführung');
    assert.equal(m.p1.status, 'relevant'); assert.equal(m.p1.kurzlage, 'Kurzlage zu Kaya'); assert.equal(m.p1.notizen[0].text, 'Notiz an P-0001');
    assert.equal(m.p1.sichtungen[0].id, 'SI-901'); assert.equal(m.p2.notizen[0].text, 'Notiz an P-0002'); assert.equal(m.p3.erkenntnis, 'Erkenntnis zu P-0003');
    assert.equal(m.dd['P-0001'].status, 'relevant', 'E6: Status von P-0001 wird wie bei Standarddossiers im Profil gesichert');
    assert.equal(m.host, HOST_ALT, 'E7: Adresse vom alten Schlüssel übernommen');
    assert.equal(m.dienste.terminal.host, HOST_ALT); assert.equal(m.dienste.terminal.t, '2026-01-02T03:04:05.000Z', 'Erstellungszeitpunkt übernommen');
    assert.equal(m.dienste.M1.host, HOST_ALT, 'alter Eintrag bleibt stehen');
    assert.equal(m.pt.notizen.text, 'Notiz aus Format 4'); assert.equal(m.pt.notizen.t, '2026-11-14T08:00:00.000Z');
    assert.equal(m.pt.einschraenkungen.text, 'Einschränkung aus Format 4');
    assert.equal(m.sperre, true, 'manuelle Sperre (P-9052 → P-0005) erhalten');
    assert.deepEqual(m.pins, ['PIN-001:']); assert.deepEqual(m.zonen, ['ZO-001']); assert.deepEqual(m.faelle, ['F-001']); assert.deepEqual(m.eigene, ['P-0018']);
    assert.equal(m.aussagen, 1, 'frühere Aussage bleibt lesbar');

    /* (4) Verlustfreie Übernahme: jedes Nicht-Kernfeld des Eingangs steht unverändert im Altbestand
       (nach derselben einmaligen Nummernumschreibung, die auch Format 4 erfuhr) */
    const vl = await p.evaluate(a => {
      const x = JSON.parse(a); idMigrieren(x, PROFIL.idmap);
      const A = STATE.altbestand, felder = Object.keys(x).filter(k => !['version', 't0', 'idv', 'ui', 'seq', 'dossiers', 'log', 'agent', 'alterung'].includes(k));
      return { felder, fehlend: felder.filter(k => !(k in A)), abweichend: felder.filter(k => JSON.stringify(A[k]) !== JSON.stringify(x[k])), zusaetzlich: Object.keys(A).filter(k => !felder.includes(k)),
        agent: JSON.stringify(STATE.agent.dokumente) === JSON.stringify(x.agent.dokumente) && STATE.agent.status === x.agent.status && JSON.stringify(STATE.agent.checkin) === JSON.stringify(x.agent.checkin) };
    }, roh.state);
    assert.ok(vl.felder.length >= 15, 'Altfelder vorhanden: ' + vl.felder.length);
    assert.deepEqual(vl.fehlend, [], 'kein Altfeld fehlt');
    assert.deepEqual(vl.abweichend, [], 'kein Altfeld verändert');
    assert.deepEqual(vl.zusaetzlich, [], 'nichts hinzugefügt');
    assert.equal(vl.agent, true, 'Agentenkern unverändert');
    const altA = await p.evaluate(() => JSON.stringify(STATE.altbestand));

    /* Neuladen: keine zweite Überführung, Altbestand unverändert, keine weitere Sicherung */
    await anmelden();
    const r1 = await p.evaluate(() => ({ alt: JSON.stringify(STATE.altbestand), n: STATE.log.filter(l => l.aktion === 'Zustand überführt').length,
      sich: Object.keys(localStorage).filter(k => k.indexOf(STORAGE_KEY + '.v4-sicherung') === 0).length, host: document.getElementById('tb-host').textContent }));
    assert.equal(r1.alt, altA, 'Altbestand über Neuladen unverändert');
    assert.equal(r1.n, 1); assert.equal(r1.sich, 1); assert.equal(r1.host, HOST_ALT);

    /* Bearbeiten eines früheren Missionsdossiers verändert den Altbestand nicht (keine Umbenennung alter Nachrichten) */
    const um = await p.evaluate(() => {
      /* alle Ansichten, die historische Daten lesen, einmal darstellen */
      dispatch({ type: 'NAVIGATION', modul: 'dossier' });
      alleEntitaeten().forEach(e => { STATE.dossiers.auswahl = e.id; ['info', 'sichtungen', 'chronik'].forEach(t => { VIEW.dtab = t; renderModule(); }); });
      VIEW.dtab = 'info';
      ['karte', 'akten', 'profil'].forEach(m => { dispatch({ type: 'NAVIGATION', modul: m }); renderModule(); });
      tickModule(Date.now());
      dispatch({ type: 'DOSSIER_NOTIZ', id: 'P-0002', text: 'Neue Notiz nach Überführung' });
      return { alt: JSON.stringify(STATE.altbestand), n: STATE.dossiers.entitaeten['P-0002'].notizen.length };
    });
    assert.equal(um.alt, altA, 'Altbestand bleibt bei Darstellung aller Ansichten und Arbeit an Dossiers unverändert');
    assert.equal(um.n, 2);

    /* (5) Zustandsexport, Zurücksetzen, Import des Exports */
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#btn-export')]);
    const exportText = fs.readFileSync(await dl.path(), 'utf8'), ex = JSON.parse(exportText);
    assert.equal(ex.version, 5, 'Export im Format 5'); assert.equal(JSON.stringify(ex.altbestand), altA, 'Export enthält den Altbestand');
    const rs = await p.evaluate(() => { dispatch({ type: 'RESET' }); return { keys: Object.keys(STATE), pt: JSON.parse(JSON.stringify(PROFIL.profiltexte)),
      p1: STATE.dossiers.entitaeten['P-0001'], host: document.getElementById('tb-host').textContent, sperre: zielZugang('P-0005').gesperrt, pins: PROFIL.pins.length }; });
    assert.ok(!rs.keys.includes('altbestand'), 'nach Zurücksetzen kein Altbestand');
    assert.equal(rs.pt.notizen.text, 'Notiz aus Format 4', 'Notizen überstehen Zurücksetzen');
    assert.equal(rs.p1.status, 'relevant', 'E6: Status von P-0001 kommt nach Zurücksetzen aus dem Profil zurück');
    assert.equal(rs.p1.notizen[0].text, 'Notiz an P-0001');
    assert.equal(rs.host, HOST_ALT, 'Adresse über Zurücksetzen stabil');
    assert.equal(rs.sperre, true); assert.equal(rs.pins, 1);
    const importieren = async (name, text) => {
      await p.setInputFiles('#file-import', { name, mimeType: 'application/json', buffer: Buffer.from(text) });
      await p.waitForSelector('#dlg[open]');
      await p.click('#dlg-ok');
      await p.waitForFunction(n => STATE.log.some(l => l.aktion === 'Zustand importiert' && l.detail.indexOf(n) === 0), name);
    };
    await importieren('export-v5.json', exportText);
    const im = await p.evaluate(() => ({ v: STATE.version, alt: JSON.stringify(STATE.altbestand), n: STATE.log.filter(l => l.aktion === 'Zustand überführt').length,
      p2: STATE.dossiers.entitaeten['P-0002'].notizen.length, pt: PROFIL.profiltexte.notizen.text }));
    assert.equal(im.v, 5); assert.equal(im.alt, altA, 'erneuter Import eines überführten Zustands lässt den Altbestand unverändert');
    assert.equal(im.n, 1, 'keine zweite Überführung'); assert.equal(im.p2, 2); assert.equal(im.pt, 'Notiz aus Format 4');

    /* (3) Import der Formate 4, 3 und 2 */
    await importieren('alt-v4.json', roh.state);
    const i4 = await p.evaluate(() => ({ v: STATE.version, missionen: !!STATE.altbestand.missionen.M1, kern: Object.keys(STATE).every(k => ['version', 't0', 'idv', 'ui', 'seq', 'dossiers', 'log', 'agent', 'alterung', 'altbestand'].includes(k)) }));
    assert.deepEqual(i4, { v: 5, missionen: true, kern: true }, 'Import Format 4');
    const v3 = await p.evaluate(() => {
      const b = buildInitialStateV4(Date.parse('2026-10-01T00:00:00.000Z'));
      const x = { version: 3, t0: b.t0, ui: b.ui, seq: b.seq, agent: b.agent, melde: b.melde, extraktion: b.extraktion, log: [{ id: 1, t: b.t0, modul: 'System', aktion: 'alt', detail: 'Format 3' }],
        mission: { ziele: {}, zeitfenster: {}, von: b.t0, bis: b.t0, status: 'Laufend', berichte: [{ t: b.t0, text: 'Bericht zu P-0004', id: 'B-001' }] },
        komm: { kanaele: b.komm.kanaele, aktiv: 'handler', skriptIndex: 0 }, dossiers: { entitaeten: b.dossiers.entitaeten, auswahl: b.dossiers.auswahl } };
      x.seq.log = 1;
      const y = JSON.parse(JSON.stringify(x)); y.version = 2; y.extraktion.begruendung = ['Alte Begründung'];
      return { v3: JSON.stringify(x), v2: JSON.stringify(y) };
    });
    await importieren('alt-v3.json', v3.v3);
    const i3 = await p.evaluate(() => ({ v: STATE.version, ueber: STATE.log.map(l => l.detail).filter(d => /^Version (3 → 4|4 → 5)/.test(d)).length, bericht: STATE.altbestand.berichte.length }));
    assert.deepEqual(i3, { v: 5, ueber: 2, bericht: 1 }, 'Import Format 3 über 4 nach 5');
    await importieren('alt-v2.json', v3.v2);
    const i2 = await p.evaluate(() => ({ v: STATE.version, b: typeof STATE.altbestand.extraktion.begruendung[0] }));
    assert.deepEqual(i2, { v: 5, b: 'object' }, 'Import Format 2 über 3 und 4 nach 5');
    /* abgelehnter Import lässt Zustand und Profil unverändert */
    const vorAbl = await p.evaluate(() => JSON.stringify(STATE) + localStorage.getItem(PROFIL_KEY));
    await p.setInputFiles('#file-import', { name: 'kaputt.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ version: 4, ui: {} })) });
    await p.waitForFunction(() => STATE.log.some(l => l.aktion === 'Import abgelehnt'));
    const nachAbl = await p.evaluate(() => { const z = JSON.parse(JSON.stringify(STATE)); z.log = z.log.filter(l => l.aktion !== 'Import abgelehnt'); z.seq.log -= 1; return JSON.stringify(z) + localStorage.getItem(PROFIL_KEY); });
    assert.equal(nachAbl, vorAbl, 'abgelehnter Import ändert weder Zustand noch Profil');

    /* (6a) Speicherfehler vor der Überführung: Sicherung scheitert → kein Speichern, gespeicherter Stand unverändert */
    await einlegen(roh, true);
    await fehlerRegel({ praefix: [SICH] });
    await anmelden();
    const e1 = await p.evaluate(() => { dispatch({ type: 'DOSSIER_NOTIZ', id: 'P-0002', text: 'In gesperrter Sitzung' });
      return { v: STATE.version, grund: Store.sperrgrund, persist: Store.isPersistent(), roh: localStorage.getItem(STORAGE_KEY), sich: localStorage.getItem(STORAGE_KEY + '.v4-sicherung'),
        meldung: document.getElementById('sys-msg').textContent, kopf: document.getElementById('h-persist').textContent }; });
    assert.equal(e1.v, 5, 'Sitzung läuft mit überführtem Zustand im Speicher');
    assert.match(e1.grund || '', /nicht gesichert/);
    assert.equal(e1.persist, false); assert.equal(e1.sich, null, 'keine Sicherung angelegt');
    assert.equal(e1.roh, roh.state, 'gespeicherter Stand bleibt zeichengleich');
    assert.match(e1.meldung, /nicht gespeichert/); assert.match(e1.kopf, /nicht persistent/);

    /* (6b) Speicherfehler während der Überführung: Sicherung gelingt, Speichern des Zustands scheitert */
    await fehlerRegel({ exakt: ['fieldterminal.v1'] });
    await anmelden();
    const e2 = await p.evaluate(() => ({ grund: Store.sperrgrund, roh: localStorage.getItem(STORAGE_KEY), sich: localStorage.getItem(STORAGE_KEY + '.v4-sicherung') }));
    assert.match(e2.grund || '', /nicht gespeichert werden/);
    assert.equal(e2.roh, roh.state, 'gespeicherter Stand bleibt zeichengleich');
    assert.equal(e2.sich, roh.state, 'Sicherung angelegt');

    /* Nächster Start ohne Fehler: Überführung gelingt, die vorhandene Sicherung wird weiterverwendet */
    await fehlerRegel(null);
    await anmelden();
    const e3 = await p.evaluate(() => ({ v: JSON.parse(localStorage.getItem(STORAGE_KEY)).version, grund: Store.sperrgrund, alt: JSON.stringify(STATE.altbestand),
      sich: Object.keys(localStorage).filter(k => k.indexOf(STORAGE_KEY + '.v4-sicherung') === 0) }));
    assert.equal(e3.v, 5); assert.equal(e3.grund, null); assert.deepEqual(e3.sich, [SICH]);
    assert.equal(e3.alt, altA, 'Überführung desselben Eingangs liefert denselben Altbestand');

    /* (7) Wiederherstellung aus der Sicherung: Rohtext zurückschreiben, erneut überführen */
    await p.evaluate(() => localStorage.setItem(STORAGE_KEY, localStorage.getItem(STORAGE_KEY + '.v4-sicherung')));
    assert.equal((await gespeichert()).version, 4, 'Format 4 aus der Sicherung wiederhergestellt');
    await anmelden();
    const w = await p.evaluate(() => ({ v: STATE.version, alt: JSON.stringify(STATE.altbestand), p1: STATE.dossiers.entitaeten['P-0001'].kurzlage,
      sich: Object.keys(localStorage).filter(k => k.indexOf(STORAGE_KEY + '.v4-sicherung') === 0).length }));
    assert.equal(w.v, 5); assert.equal(w.alt, altA, 'wiederhergestellter Stand wird identisch überführt'); assert.equal(w.p1, 'Kurzlage zu Kaya');
    assert.equal(w.sich, 1, 'gleicher Rohtext: keine zweite Sicherung');
    /* Ein anderer Stand im Format 4 überschreibt die vorhandene Sicherung nie */
    const anders = JSON.parse(roh.state); anders.agent.einschraenkungen = 'anderer Stand';
    await p.evaluate(t => localStorage.setItem(STORAGE_KEY, t), JSON.stringify(anders));
    await anmelden();
    const w2 = await p.evaluate(a => ({ erste: localStorage.getItem(STORAGE_KEY + '.v4-sicherung') === a,
      weitere: Object.keys(localStorage).filter(k => /^fieldterminal\.v1\.v4-sicherung\.\d+$/.test(k)).map(k => localStorage.getItem(k)) }), roh.state);
    assert.equal(w2.erste, true, 'erste Sicherung unverändert');
    assert.equal(w2.weitere.length, 1); assert.equal(JSON.parse(w2.weitere[0]).agent.einschraenkungen, 'anderer Stand', 'abweichender Stand eigens gesichert');

    /* Frisches Profil ohne alten Dienstschlüssel: neue Adresse einmalig, danach stabil */
    await p.evaluate(() => { localStorage.removeItem(STORAGE_KEY + '.dienste'); localStorage.removeItem(STORAGE_KEY); });
    await anmelden();
    const h1 = await p.evaluate(() => document.getElementById('tb-host').textContent);
    await p.evaluate(() => { dispatch({ type: 'NAVIGATION', modul: 'karte' }); dispatch({ type: 'NAVIGATION', modul: 'dossier' }); });
    const h2 = await p.evaluate(() => document.getElementById('tb-host').textContent);
    await anmelden();
    const h3 = await p.evaluate(() => ({ host: document.getElementById('tb-host').textContent, keys: Object.keys(JSON.parse(localStorage.getItem(STORAGE_KEY + '.dienste'))) }));
    assert.match(h1, /^[a-z2-7]{55}d\.onion$/); assert.equal(h2, h1, 'Navigation ändert die Adresse nicht'); assert.equal(h3.host, h1); assert.deepEqual(h3.keys, ['terminal']);

    assert.deepEqual(fehler, [], 'keine Seitenfehler');
    console.log('phase5c1b-zustandsformat: alle Prüfungen bestanden');
  } catch (e) {
    console.log('FAIL', e && e.message ? e.message : e);
    if (fehler.length) console.log('Seitenfehler:', fehler.slice(0, 5));
    process.exitCode = 1;
  } finally { await browser.close(); }
})();
