/* Paket 1, Review zu PR #137: Wiederherstellung, Selbstprüfung, Sitzung und Editor (echte Brücke terminal_lokal.py --serve-only).
   C: strukturell ungültiger Baum mit gültiger Prüfsumme wird vor jeder Änderung abgelehnt (Datei als Eltern, Tiefe samt Präfix, Byte-Zähler, Grenzen).
   D: Restore-Gate (Generation): Änderung eines anderen Fensters zwischen Sicherung und Einspielen verhindert den Austausch.
   E: Selbstprüfung: kein stilles Reparieren bei Datei als lost+found, Zähler aus dem Endbestand.
   F: echte Abmeldung sichert vor dem Trennen (frische Änderung vor der Ruhezeit), mit und ohne Brücke; /tmp der letzten Sitzung endet leer.
   G: Editor: Weitertippen während des Schreibens geht nicht verloren; Abmeldung beendet den Editor sichtbar ohne Schreiben.
   H: Größenvertrag: Randwert (16 MiB Steuerzeichen) wird gesichert; über dem Limit wird sichtbar abgelehnt. home-import als Rückweg ohne Brücke. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const http = require('node:http');
const { chromium } = require('playwright');
const { APP, ROOT } = require('./_pfad');

const PW = 'pw-test-123';
const tmp = (n) => fs.mkdtempSync(path.join(os.tmpdir(), n));
function shell(p) {
  const inp = p.locator('#profil-terminal-eingabe'), out = p.locator('#profil-terminal-ausgabe');
  const cmd = async z => { await inp.fill(z); await inp.press('Enter'); await p.waitForFunction(() => !TERMINAL_ZUSTAND.kette); };
  const lauf = async z => {
    const roh = await out.textContent(), vorher = roh === '' ? 0 : roh.split('\n').length;
    await cmd(z);
    return (await out.textContent()).split('\n').slice(vorher + 1).join('\n');
  };
  return { cmd, lauf, inp, out };
}
async function seite(ctx, fragment) {
  const q = await ctx.newPage();
  q.setDefaultTimeout(180000);
  q.fehler = [];
  q.on('pageerror', e => q.fehler.push(e.message));
  /* Anfragen an die Brücke laufen unverändert durch (große Sicherungen), alles andere im Netz wird abgewiesen */
  await q.route(/^https?:/, r => /^http:\/\/127\.0\.0\.1:\d+\/db$/.test(r.request().url()) && fragment ? r.continue() : r.abort());
  await q.goto(APP + (fragment || ''));
  await q.fill('#gate-pw', PW); if (await q.isVisible('#gate-pw2')) await q.fill('#gate-pw2', PW);
  await q.click('#gate-go'); await q.click('#profil-terminal-oeffnen');
  return q;
}
async function bruecke(sicher) {
  const archiv = tmp('ft-arch-');
  fs.mkdirSync(path.join(archiv, 'pgcl-eu3.arch07'));
  fs.copyFileSync(path.join(ROOT, 'terminal_lokal.py'), path.join(archiv, 'terminal_lokal.py'));
  const py = spawn('python3', [path.join(archiv, 'terminal_lokal.py'), '--serve-only'], { env: { ...process.env, SHADOW_TERMINAL_HOME: sicher } });
  const fragment = await new Promise((ok, fail) => { py.stdout.on('data', d => { const m = /#db=\d+\.[\w-]+/.exec(String(d)); if (m) ok(m[0]); }); py.on('exit', () => fail(new Error('Brücke beendet'))); setTimeout(() => fail(new Error('Brücke startet nicht')), 8000); });
  return { py, fragment };
}
const ende = async (q) => { await q.evaluate(() => { window.close = function () {}; Zugang.beenden(); }); await q.locator('#gate-end-fertig').waitFor({ state: 'visible' }); };

(async () => {
  const sicher = tmp('ft-home-');
  const { py, fragment } = await bruecke(sicher);
  const ctx = await chromium.launchPersistentContext(tmp('ft-vfs3-'), { reducedMotion: 'reduce', viewport: { width: 1280, height: 900 } });
  try {
    const q = await seite(ctx, fragment), t = shell(q);
    await t.lauf('mkdir -p daten/sub');
    await t.lauf('echo "alt" > daten/a.txt');
    const baue = (eintraege, manifest) => q.evaluate(async ([e, x]) => {
      const k = JSON.stringify(e), b = e.reduce((s, z) => s + (z.typ === 'file' ? new TextEncoder().encode(z.inhalt).length : 0), 0);
      return JSON.stringify({ format: TERMINAL_HOME_FORMAT, version: 1, erstellt: 'x', manifest: Object.assign({ eintraege: e.length, bytes: b, sha256: await terminalHomeHash(k) }, x || {}), eintraege: e });
    }, [eintraege, manifest]);
    const datei = (pfad, inhalt) => ({ pfad, typ: 'file', modus: 420, erstellt: 1, geaendert: 1, inhalt });
    const ordner = (pfad) => ({ pfad, typ: 'dir', modus: 493, erstellt: 1, geaendert: 1 });
    let nr = 0;
    const versuche = async (eintraege, erwartet, manifest, text) => {
      const name = 'home-20990101T0000' + String(10 + nr++) + 'Z.json';
      fs.writeFileSync(path.join(sicher, name), text || await baue(eintraege, manifest));
      const aus = await t.lauf('home-restore --yes ' + name);
      assert.match(aus, erwartet, aus);
      assert.equal(await t.lauf('cat daten/a.txt'), 'alt', 'alter Stand unverändert nach: ' + name);
      return name;
    };

    /* ---- C: Restore-Validierung ---- */
    await versuche([datei('a', 'x'), datei('a/b', 'y')], /not a valid backup \(path\); nothing changed/, null);
    await versuche([datei('a', 'x'), ordner('a/b')], /not a valid backup \(path\); nothing changed/, null);
    await versuche([ordner('a'), ordner('a')], /not a valid backup \(path\); nothing changed/, null);
    await versuche([datei('x/y', 'x')], /not a valid backup \(path\); nothing changed/, null);
    await versuche([datei('../x', 'x')], /not a valid backup \(path\); nothing changed/, null);
    await versuche([datei('a//b', 'x')], /not a valid backup \(path\); nothing changed/, null);
    await versuche([datei('a', 'x')], /backup is damaged \(byte count\); nothing changed/, { bytes: 99 });
    await versuche([datei('a', 'x')], /backup is damaged \(entry count\); nothing changed/, { eintraege: 5 });
    await versuche([datei('a', 'x')], /not a valid backup \(entry\); nothing changed/, null, (await baue([{ pfad: 'a', typ: 'file', modus: 1.5, erstellt: 1, geaendert: 1, inhalt: 'x' }])));
    await versuche([datei('a', 'x'.repeat(1048577))], /exceeds the limits/, null);
    const tief = (n) => { const e = []; let p = ''; for (let i = 0; i < n; i++) { p = p ? p + '/d' : 'd'; e.push(ordner(p)); } return e; };
    await versuche(tief(39), /not a valid backup \(path\); nothing changed/, null);   /* 2 Präfixsegmente + 39 = 41 > 40 */
    const okName = await versuche(tief(38).slice(0, 3), /restored from/, null).catch(() => null);
    /* der gültige Fall ersetzt den Bestand: danach neu aufbauen */
    assert.equal(await t.lauf('ls -1'), 'd', 'gültiger Baum wurde eingespielt');
    assert.equal(await q.evaluate(async () => (await TERMINAL_VFS.importieren(Array.from({ length: 38 }, (_, i) => ({ pfad: Array(i + 1).fill('d').join('/'), typ: 'dir', modus: 493, erstellt: 1, geaendert: 1 })))).ok), true, 'Grenztiefe 38 (mit Präfix 40) wird akzeptiert');
    assert.equal((await q.evaluate(async () => TERMINAL_VFS.importieren([{ pfad: 'a', typ: 'file', modus: 420, erstellt: 1, geaendert: 1, inhalt: 'x' }, { pfad: 'a/b', typ: 'file', modus: 420, erstellt: 1, geaendert: 1, inhalt: 'y' }]))).fehler, 'EINVAL', 'API lehnt Datei als Eltern ab');
    assert.equal(await q.evaluate(async () => (await TERMINAL_VFS.readdir(['home', 'raizo'])).eintraege.map(e => e.name).join(',')), 'd', 'abgelehnter Import ändert nichts');
    await t.lauf('rm -r d'); await t.lauf('mkdir -p daten/sub'); await t.lauf('echo "alt" > daten/a.txt');

    /* ---- D: Restore-Gate ---- */
    const q2 = await seite(ctx, fragment);
    const stand = await q.evaluate(async () => (await TERMINAL_VFS.exportieren()).gen);
    await q2.evaluate(async () => { await terminalVfsBereit(); await TERMINAL_VFS.schreiben(['home', 'raizo', 'anderes-fenster.txt'], 'neu', {}); });
    const gate = await q.evaluate(async g => TERMINAL_VFS.importieren([], { gen: g }), stand);
    assert.equal(gate.fehler, 'EBUSY', 'veränderte Generation verhindert den Austausch');
    assert.equal(await t.lauf('cat anderes-fenster.txt'), 'neu', 'Daten des anderen Fensters bleiben erhalten');
    const frisch = await q.evaluate(async () => TERMINAL_VFS.importieren((await TERMINAL_VFS.exportieren()).eintraege, { gen: (await TERMINAL_VFS.exportieren()).gen }));
    assert.equal(frisch.ok, true, 'aktuelle Generation wird akzeptiert');
    await q2.close();
    /* Befehlsebene: Änderung eines anderen Fensters mitten im Wiederherstellen (nach der Sicherung, vor dem Einspielen) */
    for (const f of fs.readdirSync(sicher)) if (f.startsWith('home-2099')) fs.unlinkSync(path.join(sicher, f));   /* sonst verdrängen die künstlichen Namen die Rotation */
    const letzte = /home-\S+\.json/.exec(await t.lauf('home-backup'))[0];
    const q3 = await seite(ctx, fragment);
    await q.evaluate(() => {
      window.__orig = TERMINAL_VFS.importieren;
      TERMINAL_VFS.importieren = async function () { await window.__stoer(); return window.__orig.apply(this, arguments); };
    });
    await q.exposeFunction('__stoer', async () => { await q3.evaluate(async () => { await terminalVfsBereit(); await TERMINAL_VFS.schreiben(['home', 'raizo', 'mitten-drin.txt'], 'x', {}); }); });
    await new Promise(r => setTimeout(r, 1100));
    assert.match(await t.lauf('home-restore --yes ' + letzte), /files changed in another window while restoring; nothing changed/);
    assert.equal(await q.evaluate(async () => (await TERMINAL_VFS.readFile(['home', 'raizo', 'mitten-drin.txt'])).text), 'x');
    await q.evaluate(() => { TERMINAL_VFS.importieren = window.__orig; });
    await q3.close();

    /* ---- E: Selbstprüfung ---- */
    const roh = (fn, ...a) => q.evaluate(([f, args]) => new Promise((ok, fail) => {
      const r = indexedDB.open('fieldterminal.vfs'); r.onerror = () => fail(r.error);
      r.onsuccess = () => { const db = r.result, tx = db.transaction(['knoten', 'meta'], 'readwrite'); new Function('k', 'm', 'a', 'return (' + f + ')(k, m, a)')(tx.objectStore('knoten'), tx.objectStore('meta'), args); tx.oncomplete = () => { db.close(); ok(true); }; tx.onerror = () => fail(tx.error); }; }), [fn.toString(), a]);
    const lesen = () => q.evaluate(() => new Promise((ok, fail) => {
      const r = indexedDB.open('fieldterminal.vfs'); r.onerror = () => fail(r.error);
      r.onsuccess = () => { const db = r.result, tx = db.transaction(['knoten', 'meta'], 'readonly'), a = tx.objectStore('knoten').getAll(), z = tx.objectStore('meta').get('zaehler');
        tx.oncomplete = () => { db.close(); ok({ knoten: a.result, zaehler: z.result }); }; }; }));
    const raizo = (await lesen()).knoten.find(n => n.name === 'raizo').id;
    /* lost+found als gewöhnliche Datei und ein verwaister Knoten */
    await roh((k) => {
      k.add({ eltern: 3, name: 'lost+found', typ: 'file', modus: 420, uid: 1000, gid: 1000, erstellt: 1, geaendert: 1, groesse: 0, inhalt: '', fluechtig: false, version: 1 });
      k.add({ eltern: 99999, name: 'waise', typ: 'file', modus: 420, uid: 1000, gid: 1000, erstellt: 1, geaendert: 1, groesse: 3, inhalt: 'abc', fluechtig: false, version: 1 });
    });
    const vorher = await lesen();
    const r1 = await q.evaluate(async () => TERMINAL_VFS.sitzungStart());
    assert.equal(r1.fehler, 'EIO', 'Datei als lost+found: kein stilles Reparieren');
    const nachher = await lesen();
    assert.deepEqual(nachher.knoten.map(n => [n.id, n.eltern, n.name]), vorher.knoten.map(n => [n.id, n.eltern, n.name]), 'Bestand unverändert');
    await roh((k) => { const r = k.index('ename').get([3, 'lost+found']); r.onsuccess = () => k.delete(r.result.id); });
    const r2 = await q.evaluate(async () => TERMINAL_VFS.sitzungStart());
    assert.equal(r2.ok, true); assert.equal(r2.repariert, 1);
    const fin = await lesen();
    const echt = fin.knoten.filter(n => n.id > 4);
    assert.equal(fin.zaehler.knoten, echt.length, 'Zähler enthält auch das neu angelegte lost+found');
    assert.equal(fin.zaehler.bytes, echt.filter(n => n.typ === 'file').reduce((s, n) => s + n.groesse, 0));
    assert.ok(fin.knoten.some(n => n.name === 'lost+found' && n.typ === 'dir' && n.eltern === raizo));
    await t.lauf('rm -r lost+found');

    /* ---- G: Editor ---- */
    await q.evaluate(() => { const o = TERMINAL_FS.schreiben; window.__sOrig = o; TERMINAL_FS.schreiben = async function () { await new Promise(r => setTimeout(r, 400)); return o.apply(this, arguments); }; });
    await t.inp.fill('nano edit.txt'); await t.inp.press('Enter');
    const ed = q.locator('#profil-terminal-editor-text');
    await ed.waitFor();
    await ed.fill('eins\n');
    await ed.press('Control+o');
    await ed.pressSequentially('zwei');                      /* während des Schreibens weitergetippt */
    await q.waitForFunction(() => /Wrote 1 lines/.test(document.querySelector('#profil-terminal-editor .editor-status').textContent));
    assert.match(await q.locator('#profil-terminal-editor .editor-status').textContent(), /buffer changed meanwhile/);
    assert.match(await q.locator('#profil-terminal-editor .editor-kopf').textContent(), /Modified/, 'Puffer bleibt geändert');
    await ed.press('Control+x');
    await q.waitForFunction(() => /Save modified buffer/.test(document.querySelector('#profil-terminal-editor .editor-status').textContent));
    await ed.press('n');
    await q.waitForFunction(() => !document.querySelector('#profil-terminal-editor') && !TERMINAL_ZUSTAND.kette);
    assert.equal(await t.lauf('cat edit.txt'), 'eins', 'gespeicherter Stand; N verwirft nur den Rest');
    /* ^X während des Schreibens wartet; Y mit Weitertippen fragt erneut */
    await t.inp.fill('nano edit.txt'); await t.inp.press('Enter');
    await ed.waitFor();
    await ed.fill('drei\n');
    await ed.press('Control+x'); await ed.press('y');
    await ed.pressSequentially('x');
    await q.waitForFunction(() => /Buffer changed while saving/.test(document.querySelector('#profil-terminal-editor .editor-status').textContent));
    assert.equal(await q.locator('#profil-terminal-editor').count(), 1, 'Editor bleibt offen, nichts verloren');
    await ed.press('y');
    await q.waitForFunction(() => !document.querySelector('#profil-terminal-editor') && !TERMINAL_ZUSTAND.kette);
    assert.equal(await t.lauf('cat edit.txt'), 'drei\nx');
    await q.evaluate(() => { TERMINAL_FS.schreiben = window.__sOrig; });
    /* ohne Brücke */
    const ctx5 = await chromium.launchPersistentContext(tmp('ft-vfs5-'), { reducedMotion: 'reduce' });
    const q5 = await seite(ctx5, ''), w = shell(q5);
    await w.lauf('touch /tmp/x; echo behalten > bleibt.txt; echo "drei" > edit.txt');
    /* Abmeldung während eines offenen Editors: beendet, Verwerfen sichtbar, nichts still geschrieben */
    await w.inp.fill('nano edit.txt'); await w.inp.press('Enter');
    const ed5 = q5.locator('#profil-terminal-editor-text');
    await ed5.waitFor();
    await ed5.fill('nie gespeichert\n');
    await q5.evaluate(() => terminalSitzungTrennen());
    assert.equal(await q5.locator('#profil-terminal-editor').count(), 0, 'Editor beendet');
    assert.match(await w.out.textContent(), /nano: edit\.txt: modified buffer discarded \(session ended\)/);
    assert.equal(await q5.evaluate(async () => (await TERMINAL_VFS.readFile(['home', 'raizo', 'edit.txt'])).text), 'drei\n', 'nichts still geschrieben');
    await q5.evaluate(() => { TERMINAL_ZUSTAND.version++; });
    await ende(q5);
    assert.equal(await q5.evaluate(async () => (await TERMINAL_VFS.readdir(['tmp'])).eintraege.length), 0, 'ohne Brücke: /tmp geleert');
    assert.equal(await q5.evaluate(async () => (await TERMINAL_VFS.readFile(['home', 'raizo', 'bleibt.txt'])).text), 'behalten\n');
    assert.deepEqual(q5.fehler, []);
    await ctx5.close();


    /* ---- H: Größenvertrag und Rückweg ohne Brücke ---- */
    await t.lauf('rm -r daten'); await t.lauf('rm anderes-fenster.txt mitten-drin.txt edit.txt');
    await q.evaluate(async () => {
      for (let i = 0; i < 16; i++) { const r = await TERMINAL_VFS.schreiben(['home', 'raizo', 'rand' + i], '\u0001'.repeat(1048576), {}); if (r.fehler) throw new Error(r.fehler + ' bei ' + i); }
    });
    const rand = await t.lauf('home-backup');
    assert.match(rand, /^home-backup: home-\d{8}T\d{6}Z(-\d)?\.json \(\d+ entries, \d+ B\)$/, 'Worst Case (16 MiB Steuerzeichen) wird gesichert: ' + rand);
    const groesse = Number(/(\d+) B\)$/.exec(rand)[1]);
    assert.ok(groesse > 90 * 1048576 && groesse <= 112 * 1048576, 'Sicherungsgröße ' + groesse);
    const randName = /home-\S+\.json/.exec(rand)[0];
    await t.lauf('rm rand0 rand1 rand2 rand3 rand4 rand5 rand6 rand7 rand8 rand9 rand10 rand11 rand12 rand13 rand14 rand15');
    await new Promise(r => setTimeout(r, 1100));
    assert.match(await t.lauf('home-restore --yes ' + randName), /^home-restore: 16 entries restored from /, 'Wiederherstellung des Randwerts');
    assert.equal(await q.evaluate(async () => (await TERMINAL_VFS.readFile(['home', 'raizo', 'rand15'])).text.length), 1048576);
    await t.lauf('rm rand0 rand1 rand2 rand3 rand4 rand5 rand6 rand7 rand8 rand9 rand10 rand11 rand12 rand13 rand14 rand15');
    await t.lauf('echo klein > klein.txt');
    await q.evaluate(() => { TERMINAL_HOME_ANFRAGE_MAX = 200; });
    const vorAnzahl = fs.readdirSync(sicher).length;
    assert.match(await t.lauf('home-backup'), /^home-backup: backup too large for the local bridge \(\d+ MiB, limit 0 MiB\); nothing saved$/);
    assert.equal(fs.readdirSync(sicher).length, vorAnzahl, 'nichts gespeichert');
    await q.evaluate(() => { TERMINAL_HOME_ANFRAGE_MAX = 128 * 1024 * 1024; });
    /* home-import: Datei aus home-export */
    const pk = await q.evaluate(async () => (await terminalHomePaket()).text);
    const exportDatei = path.join(tmp('ft-exp-'), 'home-export.json'); fs.writeFileSync(exportDatei, pk);
    await t.lauf('rm klein.txt');
    assert.match(await t.lauf('home-import'), /replaces everything in \/home\/raizo[\s\S]*Run again with --yes/);
    await q.evaluate(() => { window.__fc = true; });
    const chooser = q.waitForEvent('filechooser');
    await t.inp.fill('home-import --yes'); await t.inp.press('Enter');
    (await chooser).setFiles(exportDatei);
    await q.waitForFunction(() => !TERMINAL_ZUSTAND.kette);
    assert.match(await t.out.textContent(), /home-import: 1 entries restored from home-export\.json/);
    assert.equal(await t.lauf('cat klein.txt'), 'klein');
    const schlecht = path.join(path.dirname(exportDatei), 'kaputt.json'); fs.writeFileSync(schlecht, pk.replace('klein.txt', 'anders.txt'));
    const chooser2 = q.waitForEvent('filechooser');
    await t.inp.fill('home-import --yes'); await t.inp.press('Enter');
    (await chooser2).setFiles(schlecht);
    await q.waitForFunction(() => !TERMINAL_ZUSTAND.kette);
    assert.match(await t.out.textContent(), /home-import: kaputt\.json: backup is damaged \(checksum mismatch\); nothing changed/);
    assert.equal(await t.lauf('cat klein.txt'), 'klein');
    /* ---- F: Abmeldung mit Brücke ---- */
    const q4 = await seite(await chromium.launchPersistentContext(tmp('ft-vfs4-'), { reducedMotion: 'reduce' }), fragment), u = shell(q4);
    await q4.evaluate(() => { terminalHomeRuhe = 600000; });
    await u.lauf('echo "frisch" > letzte-aenderung.txt');
    await u.lauf('touch /tmp/fluechtig');
    const vorDatei = fs.readdirSync(sicher).filter(x => /^home-2/.test(x) && !x.startsWith('home-2099')).length;
    await ende(q4);
    const nachDatei = fs.readdirSync(sicher).filter(x => /^home-2/.test(x) && !x.startsWith('home-2099'));
    assert.equal(nachDatei.length >= Math.min(10, vorDatei + 1), true, 'letzte Sicherung beim Abmelden');
    const neuesteHome = nachDatei.sort().at(-1);
    assert.ok(/letzte-aenderung\.txt/.test(fs.readFileSync(path.join(sicher, neuesteHome), 'utf8')), 'frische Änderung vor der Ruhezeit ist gesichert');
    assert.equal(await q4.evaluate(async () => (await TERMINAL_VFS.readdir(['tmp'])).eintraege.length), 0, '/tmp der letzten Sitzung geleert');
    assert.deepEqual(q4.fehler, []);
    await q4.context().close();
    assert.deepEqual(q.fehler, []);
    console.log('OK: terminal-vfs-sicherung (Restore-Validierung, Restore-Gate, Selbstprüfung, Abmeldung, Editor, Größenvertrag, home-import)');
  } finally { await ctx.close().catch(() => {}); py.kill(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
