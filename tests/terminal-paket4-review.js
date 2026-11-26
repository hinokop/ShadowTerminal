/* Paket 4, Review 2 zu #140 (Zwischenprüfung M1 bis M3):
   R: echte Brücke (terminal_lokal.py): Verzeichnis mit und ohne "/", Text- und Binärdatei mit echter Bytezahl; Lageblatt eines Pins:
      Bindung beim Start, Verknüpfung A -> B, danach Sperre A (laufender und abgeschlossener Eintrag); verzögerte Leseantwort mit Sperre und /quit.
   P: physische Auflösung in /intel: Link vor ".." (dossier/../record fehlt, dossier/../index besteht), fehlende und gesperrte Zwischenkomponente,
      Tab über denselben Resolver, Tab ohne Systembereiche und ohne gesperrte Objekte.
   I: Identität fail closed: Pin ohne Anlegezeit, Identitätswechsel während des Uploads; Sichtungsrecord mit eingebettetem Pin (Verknüpfung des
      Pins mit gesperrtem Dossier), Sichtung ohne UID (Kennung wie beim Kartenexport); Zone; Falltext bleibt nach E4 bei Sperre sichtbar.
   L: verzögerte Leseantwort über LINK END.
   O: ohne Brücke: VFS und /intel senden vollständig. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');
const { APP, ROOT } = require('./_pfad');
const { chatBereit } = require('./_kestrel');

const PW = 'pw-test-123';
async function bruecke() {
  const ordner = fs.mkdtempSync(path.join(os.tmpdir(), 'ft-p4-'));
  const db = path.join(ordner, 'pgcl-eu3.arch07');
  fs.mkdirSync(path.join(db, 'dossiers'), { recursive: true }); fs.mkdirSync(path.join(db, 'ops'));
  fs.writeFileSync(path.join(db, 'dossiers', 'dossier-index.txt'), 'Index\n'.repeat(50));
  fs.writeFileSync(path.join(db, 'ops', 'bild.bin'), Buffer.from(Array.from({ length: 3001 }, (_, i) => i % 256)));
  fs.copyFileSync(path.join(ROOT, 'terminal_lokal.py'), path.join(ordner, 'terminal_lokal.py'));
  const py = spawn('python3', [path.join(ordner, 'terminal_lokal.py'), '--serve-only'], { env: { ...process.env, SHADOW_TERMINAL_HOME: fs.mkdtempSync(path.join(os.tmpdir(), 'ft-p4h-')) } });
  const fragment = await new Promise((ok, fail) => {
    py.stdout.on('data', d => { const m = /#db=\d+\.[\w-]+/.exec(String(d)); if (m) ok(m[0]); });
    py.on('exit', () => fail(new Error('Brücke beendet'))); setTimeout(() => fail(new Error('Brücke startet nicht')), 15000);
  });
  return { py, fragment, db };
}
async function seite(b, fragment) {
  const p = await b.newPage({ reducedMotion: 'reduce' });
  p.setDefaultTimeout(15000);
  p.fehler = [];
  p.on('pageerror', e => p.fehler.push(e.message));
  await p.route(/^https?:/, r => fragment && /^http:\/\/127\.0\.0\.1:\d+\/db$/.test(r.request().url()) ? r.continue() : r.abort());
  await p.goto(APP + (fragment || ''));
  await p.fill('#gate-pw', PW); if (await p.isVisible('#gate-pw2')) await p.fill('#gate-pw2', PW);
  await p.click('#gate-go');
  await p.waitForFunction(() => typeof APP_BEREIT !== 'undefined' && APP_BEREIT && !!STATE && !document.body.classList.contains('locked'));
  return p;
}
async function chat(p) {
  await p.click('#profil-terminal-oeffnen');
  await chatBereit(p);
  await p.clock.pauseAt(await p.evaluate(() => Date.now() + 1000));
  const inp = p.locator('#profil-terminal-eingabe');
  const h = {
    inp,
    cmd: async z => { await inp.fill(z); await inp.press('Enter'); await p.waitForFunction(() => !TERMINAL_ZUSTAND.kanal?.pruefung); await p.clock.runFor(1); },
    alle: () => p.evaluate(() => TERMINAL_ZUSTAND.kanal.fenster.map(f => f.log.map(e => e.zeile ?? e).join('\n')).join('\n')),
    letzte: async () => (await p.evaluate(() => { const e = TERMINAL_ZUSTAND.kanal.fenster[0].log.at(-1); return e.zeile ?? e; })).replace(/^\d\d:\d\d:\d\d . /, ''),
    uploads: () => p.evaluate(() => (TERMINAL_ZUSTAND.kanal.uploads || []).map(u => ({ datei: u.datei, bytes: u.bytes, name: u.name }))),
    sperren: id => p.evaluate(i => dispatch({ type: 'DOSSIER_SPERREN', id: i }), id),
    entsperren: id => p.evaluate(i => dispatch({ type: 'DOSSIER_ENTSPERREN', id: i }), id),
    tab: async (wert, erwartet) => {
      await inp.fill(wert); await inp.press('Tab');
      if (erwartet === wert) { await p.waitForTimeout(300); assert.equal(await inp.inputValue(), wert, 'keine Ergänzung: ' + wert); }
      else await p.waitForFunction(w => $('profil-terminal-eingabe').value === w, erwartet);
      await inp.fill('');
    }
  };
  return h;
}
const esc = x => x.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
const fehlt = d => "Uploading '" + d + "' failed: File not found!", keine = d => "Uploading '" + d + "' failed: Not a file!";

(async () => {
  const b = await chromium.launch();
  const br = await bruecke();
  try {
    /* ---- R: echte Brücke ---- */
    const p = await seite(b, br.fragment);
    const ids = await p.evaluate(() => {
      dispatch({ type: 'PIN_ANGELEGT', ll: [52.47, 13.45], name: 'LBPIN', dossier: 'P-0002', notiz: 'N'.repeat(3000) });
      const lb = PROFIL.pins.at(-1).id;
      dispatch({ type: 'PIN_ANGELEGT', ll: [52.48, 13.46], name: 'PERSPIN', dossier: 'P-0003' });
      const pp = PROFIL.pins.at(-1).id;
      return { lb, pp };
    });
    fs.writeFileSync(path.join(br.db, 'ops', 'lageblatt-' + ids.lb + '.txt'), 'L'.repeat(2400));
    fs.writeFileSync(path.join(br.db, 'ops', 'lageblatt-' + ids.pp + '.txt'), 'K'.repeat(100));
    const c = await chat(p);
    const D = '/pgcl-eu3.arch07/';
    for (const d of [D + 'dossiers/', D + 'dossiers']) { await c.cmd('/sendfile ' + d); assert.equal(await c.letzte(), keine(d), 'echte Brücke: ' + d); }
    await c.cmd('/sendfile ' + D + 'dossiers/dossier-index.txt/');
    assert.equal(await c.letzte(), fehlt(D + 'dossiers/dossier-index.txt/'));
    await c.cmd('/sendfile ' + D + 'dossiers/dossier-index.txt');
    await c.cmd('/sendfile ' + D + 'ops/bild.bin');
    assert.deepEqual((await c.uploads()).map(u => [u.name, u.bytes]), [['dossier-index.txt', 300], ['bild.bin', 3001]], 'echte Bytezahl, auch binär');
    await p.clock.runFor(2000 + 15000);
    assert.match(await c.alle(), /bild\.bin$/m);
    /* Lageblatt: abgeschlossen, dann Verknüpfung A -> B und Sperre A */
    const lbPfad = D + 'ops/lageblatt-' + ids.pp + '.txt';
    await c.cmd('/sendfile ' + lbPfad);
    await p.clock.runFor(2000 + 2000);
    assert.match(await c.alle(), new RegExp('/lageblatt-' + ids.pp + '\\.txt$', 'm'), 'abgeschlossen');
    await p.evaluate(id => dispatch({ type: 'PIN_GEAENDERT', id, dossier: 'P-0001' }), ids.pp);
    await c.sperren('P-0003');
    assert.doesNotMatch(await c.alle(), new RegExp('lageblatt-' + ids.pp), 'abgeschlossener Eintrag: damaliges Dossier gesperrt');
    await c.entsperren('P-0003');
    /* laufend: Verknüpfung A -> B während des Uploads, dann Sperre A */
    const lb2 = D + 'ops/lageblatt-' + ids.lb + '.txt';
    await c.cmd('/sendfile ' + lb2);
    await p.clock.runFor(2500);
    assert.match(await c.alle(), new RegExp("Uploading '" + esc(lb2) + "': \\d+%"));
    await p.evaluate(id => dispatch({ type: 'PIN_GEAENDERT', id, dossier: 'P-0003' }), ids.lb);
    await c.sperren('P-0002');
    await p.clock.runFor(10000);
    assert.doesNotMatch(await c.alle(), new RegExp('lageblatt-' + ids.lb), 'laufend: kein Abschluss, kein Link');
    assert.deepEqual(await c.uploads(), []);
    await c.entsperren('P-0002');
    /* verzögerte Leseantwort der Brücke: Sperre bzw. /quit dazwischen */
    const verzoegern = () => p.evaluate(() => {
      const orig = terminalBruecke;
      window.terminalBruecke = async function (op, parts, hidden, x) { if (op === 'send') { window.terminalBruecke = orig; await new Promise(r => setTimeout(r, 500)); } return orig(op, parts, hidden, x); };
    });
    await verzoegern();
    await c.inp.fill('/sendfile ' + lb2); await c.inp.press('Enter');
    await c.sperren('P-0003');
    await p.clock.runFor(600); await p.waitForFunction(() => !TERMINAL_ZUSTAND.kanal?.pruefung);
    assert.equal(await c.letzte(), fehlt(lb2), 'Sperre während des Lesens');
    await c.entsperren('P-0003');
    await verzoegern();
    await c.inp.fill('/sendfile ' + D + 'ops/bild.bin'); await c.inp.press('Enter');
    await c.inp.fill('/quit'); await c.inp.press('Enter');
    await p.clock.runFor(3000);
    assert.equal(await p.evaluate(() => TERMINAL_ZUSTAND.kanal), null, 'Chat beendet, kein Upload danach');
    assert.deepEqual(p.fehler, []);
    await p.close();

    /* ---- P, I, L: /intel (Brücke nicht nötig) ---- */
    const q = await seite(b, br.fragment);
    const o = await q.evaluate(() => {
      dispatch({ type: 'PIN_ANGELEGT', ll: [52.47, 13.45], name: 'PIN3', dossier: 'P-0003', notiz: 'N'.repeat(3000) });
      const pin = PROFIL.pins.at(-1).id;
      dispatch({ type: 'PIN_ANGELEGT', ll: [52.47, 13.45], name: 'OHNE_T', notiz: 'x' });
      const ohneT = PROFIL.pins.at(-1); delete ohneT.t;
      dispatch({ type: 'OZONE_ANGELEGT', ll: [52.47, 13.45] });
      const zone = PROFIL.zonen.at(-1).id;
      dispatch({ type: 'OZONE_GEAENDERT', id: zone, dossier: 'P-0003', notiz: 'Z'.repeat(3000) });
      /* Sichtung mit eingebettetem Ursprungspin und Sichtung ohne UID (Altbestand) */
      const st = STATE.dossiers.entitaeten['P-0003'];
      st.sichtungen = (st.sichtungen || []).concat([{ id: 'SI-901', uid: 'u-901', t: '2026-11-20T10:00:00.000Z', text: 'S'.repeat(3000), pin: null },
        { id: 'SI-902', t: '2026-11-20T11:00:00.000Z', text: 'alt' }]);
      dispatch({ type: 'PIN_ANGELEGT', ll: [52.5, 13.5], name: 'SIPIN', dossier: 'P-0003' });
      const sp = PROFIL.pins.at(-1); sp.sichtung = 'SI-901'; st.sichtungen.find(x => x.id === 'SI-901').pin = sp.id;
      let fall = null;
      xSchreiben(function () { fall = xAnlegen({ titel: 'Fall P4', frage: 'F'.repeat(3000) }, 'P-0003'); return fall; });
      return { pin, ohneT: ohneT.id, zone, sp: sp.id, fall: fall.id };
    });
    const k = await chat(q);
    const G = '/intel/geospatial/pins/' + o.pin;
    await k.cmd('/sendfile ' + G + '/dossier/../record');
    assert.equal(await k.letzte(), fehlt(G + '/dossier/../record'), '".." gilt für das Linkziel (/intel/dossiers/persons/record fehlt)');
    await k.cmd('/sendfile ' + G + '/dossier/../index');
    assert.deepEqual((await k.uploads()).map(u => u.name), ['persons-index.txt'], 'physisch /intel/dossiers/persons/index');
    await q.clock.runFor(2000 + 20000);
    assert.match(await k.alle(), /\/persons-index\.txt$/m);
    await k.cmd('/sendfile /intel/geospatial/pins/PIN-999/../' + o.pin + '/record');
    assert.equal(await k.letzte(), fehlt('/intel/geospatial/pins/PIN-999/../' + o.pin + '/record'), 'fehlende Zwischenkomponente');
    await k.tab('/sendfile ' + G + '/dossier/../in', '/sendfile ' + G + '/dossier/../index');
    await k.tab('/sendfile /et', '/sendfile /et');
    await k.tab('/sendfile /us', '/sendfile /us');
    await k.sperren('P-0003');
    assert.doesNotMatch(await k.alle(), /persons-index\.txt/, 'Link-Abhängigkeit (Pin) des Pfads gehört zur Momentaufnahme');
    await k.cmd('/sendfile ' + G + '/dossier/../index');
    assert.equal(await k.letzte(), fehlt(G + '/dossier/../index'), 'gesperrte Zwischenkomponente');
    await k.tab('/sendfile /intel/dossiers/persons/P-000', '/sendfile /intel/dossiers/persons/P-000');
    await k.tab('/sendfile /intel/geospatial/pins/' + o.pin, '/sendfile /intel/geospatial/pins/' + o.pin);
    await k.entsperren('P-0003');

    /* Identität fail closed */
    await k.cmd('/sendfile /intel/geospatial/pins/' + o.ohneT + '/record');
    assert.equal(await k.letzte(), fehlt('/intel/geospatial/pins/' + o.ohneT + '/record'), 'Pin ohne Anlegezeit');
    await k.cmd('/sendfile ' + G + '/record');
    await q.clock.runFor(2500);
    assert.match(await k.alle(), new RegExp("Uploading '" + esc(G) + "/record': \\d+%"));
    await q.evaluate(id => { PROFIL.pins.find(x => x.id === id).t = '2026-01-01T00:00:00.000Z'; terminalSchutzPruefen(); }, o.pin);
    await q.clock.runFor(15000);
    assert.doesNotMatch(await k.alle(), new RegExp(o.pin + '-record|' + esc(G) + "/record': "), 'Identitätswechsel: kein Abschluss');
    /* Sichtungsrecord mit eingebettetem Pin: Verknüpfung des Pins mit einem gesperrten Dossier */
    const S = '/intel/geospatial/sightings/P-0003/SI-901/record';
    await k.cmd('/sendfile ' + S);
    await q.clock.runFor(2500);
    assert.match(await k.alle(), new RegExp("Uploading '" + esc(S) + "': \\d+%"));
    await k.sperren('P-0002');
    await q.evaluate(id => dispatch({ type: 'PIN_GEAENDERT', id, dossier: 'P-0002' }), o.sp);
    await q.clock.runFor(20000);
    assert.doesNotMatch(await k.alle(), /SI-901-record|SI-901\/record': /, 'eingebetteter Pin gehört zur Bindung');
    await k.entsperren('P-0002');
    /* Sichtung ohne UID: Kennung wie beim Kartenexport, dann Versand */
    await k.cmd('/sendfile /intel/geospatial/sightings/P-0003/SI-902/record');
    assert.equal(await q.evaluate(() => typeof STATE.dossiers.entitaeten['P-0003'].sichtungen.find(x => x.id === 'SI-902').uid), 'string');
    assert.deepEqual((await k.uploads()).map(u => u.name), ['P-0003-SI-902-record.txt']);
    await q.clock.runFor(2000 + 5000);
    /* Zone: Sperre während des Uploads */
    const Z = '/intel/geospatial/zones/' + o.zone + '/record';
    await k.cmd('/sendfile ' + Z);
    await q.clock.runFor(2500);
    await k.sperren('P-0003');
    await q.clock.runFor(15000);
    assert.doesNotMatch(await k.alle(), new RegExp(o.zone + '-record|' + esc(Z) + "': "), 'Zone');
    /* Falltext: eigenständige Sichtbarkeit (E4), Sperre des verknüpften Dossiers bricht nicht ab */
    const F = '/intel/cases/' + o.fall + '/case';
    await k.cmd('/sendfile ' + F);
    await q.clock.runFor(2500);
    await k.entsperren('P-0003'); await k.sperren('P-0003');
    await q.clock.runFor(15000);
    assert.match(await k.alle(), new RegExp('/' + o.fall + '-case\\.txt$', 'm'), 'Fall bleibt nach E4 sichtbar');
    await k.entsperren('P-0003');
    /* L: verzögerte Antwort über LINK END */
    await q.clock.runFor(await q.evaluate(() => TERMINAL_ZUSTAND.satLink.bis - Date.now() - 300));
    await q.evaluate(async () => {
      const x = await TERMINAL_VFS.schreiben(['home', 'raizo', 'los.txt'], 'l'.repeat(80), {}); if (x.fehler) throw new Error(x.fehler);
      const st = TERMINAL_FS.stat; TERMINAL_FS.stat = async function () { TERMINAL_FS.stat = st; await new Promise(r => setTimeout(r, 2000)); return st.apply(this, arguments); };
    });
    await k.inp.fill('/sendfile ~/los.txt'); await k.inp.press('Enter');
    await q.clock.runFor(2500);
    await q.waitForFunction(() => !TERMINAL_ZUSTAND.kanal || !TERMINAL_ZUSTAND.kanal.pruefung);
    const nachLos = await q.evaluate(() => TERMINAL_ZUSTAND.kanal ? (TERMINAL_ZUSTAND.kanal.uploads || []).length : 0);
    assert.equal(nachLos, 0, 'nach LINK END kein Upload');
    assert.match(await k.alle(), /You are not currently connected\.$/m, 'verspätete Antwort nach LINK END: nicht verbunden');
    assert.deepEqual(q.fehler, []);
    await q.close();

    /* ---- O: ohne Brücke ---- */
    const r = await seite(b, null);
    const m = await chat(r);
    await r.evaluate(async () => { const x = await TERMINAL_VFS.schreiben(['home', 'raizo', 'ohne.txt'], 'o'.repeat(90), {}); if (x.fehler) throw new Error(x.fehler); });
    await m.cmd('/sendfile ~/ohne.txt');
    await m.cmd('/sendfile /intel/dossiers/persons/P-0003/profile');
    await r.clock.runFor(2000 + 20000);
    assert.match(await m.alle(), /\/ohne\.txt$/m, 'VFS ohne Brücke');
    assert.match(await m.alle(), /\/P-0003-profile\.txt$/m, '/intel ohne Brücke');
    await m.cmd('/sendfile /pgcl-eu3.arch07/ops/x.txt');
    assert.match(await m.alle(), /\/sendfile: /, 'Archiv ohne Brücke: Zustand des Terminals');
    assert.deepEqual(r.fehler, []);
    console.log('OK: Paket 4 Review 2 (echte Brücke, physische Pfade, Bindung und Identität, verzögerte Antworten, ohne Brücke)');
  } finally {
    br.py.kill();
    await b.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
