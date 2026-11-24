/* Paket 1: persistentes virtuelles Dateisystem (/home/raizo, /tmp), Befehle, Umleitung, Editor.
   Abnahmeszenario (Entscheidung Shadow 24.11.2026): Verzeichnisse anlegen, cd, touch, echo > , nano mit ^O und ^X, cat, nach vollständigem
   Neustart (neuer Browserkontext mit demselben Profilordner) sind die Daten vorhanden, /tmp ist leer.
   Weitere Abschnitte: Fehlermeldungen nach GNU coreutils 9.4, Umleitung und Parser, Rechte und Grenzen, Quoten ohne Teilzustand,
   Selbstprüfung (verwaiste Knoten), /tmp bei mehreren Fenstern, Tab, Sicherung über die echte Brücke (terminal_lokal.py --serve-only). */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');
const { APP, ROOT } = require('./_pfad');

const PW = 'pw-test-123';
async function oeffnen(ctx, hash) {
  const p = await ctx.newPage();
  p.setDefaultTimeout(15000);
  p.fehler = [];
  p.on('pageerror', e => p.fehler.push(e.message));
  await p.route(/^https?:/, r => r.abort());
  await p.goto(APP + (hash || ''));
  await p.fill('#gate-pw', PW);
  if (await p.isVisible('#gate-pw2')) await p.fill('#gate-pw2', PW);
  await p.click('#gate-go');
  await p.click('#profil-terminal-oeffnen');
  return p;
}
function shell(p) {
  const inp = p.locator('#profil-terminal-eingabe'), out = p.locator('#profil-terminal-ausgabe');
  const cmd = async z => { await inp.fill(z); await inp.press('Enter'); await p.waitForFunction(() => !TERMINAL_ZUSTAND.kette); };
  /* Ausgabe eines Befehls: Text nach der Eingabezeile bis zum nächsten Prompt */
  const lauf = async z => {
    const roh = await out.textContent(), vorher = roh === '' ? 0 : roh.split('\n').length;
    await cmd(z);
    const zeilen = (await out.textContent()).split('\n');
    return zeilen.slice(vorher + 1).join('\n');
  };
  return { cmd, lauf, inp, out, prompt: p.locator('#profil-terminal-prompt') };
}
const fsAufruf = (p, ausdruck, ...a) => p.evaluate(([x, args]) => new Function('args', 'return (' + x + ')')(args), [ausdruck, a]);

(async () => {
  const profil = fs.mkdtempSync(path.join(os.tmpdir(), 'ft-vfs-'));
  const start = () => chromium.launchPersistentContext(profil, { reducedMotion: 'reduce', viewport: { width: 1280, height: 900 } });
  let ctx = await start();
  try {
    /* ---- A: Abnahmeszenario ---- */
    let p = await oeffnen(ctx), s = shell(p);
    assert.equal(await s.prompt.textContent(), 'raizo@terminal:~$', 'Start im Heimverzeichnis, Prompt mit ~');
    assert.equal(await s.lauf('pwd'), '/home/raizo');
    assert.equal(await s.lauf('mkdir -p projects/alpha/notes'), '');
    await s.cmd('cd projects/alpha');
    assert.equal(await s.prompt.textContent(), 'raizo@terminal:~/projects/alpha$');
    assert.equal(await s.lauf('touch briefing.txt'), '');
    assert.equal(await s.lauf('echo "Initial assessment" > briefing.txt'), '');
    /* nano: der Befehl hält die Kette, bis der Editor beendet wird */
    await s.inp.fill('nano briefing.txt'); await s.inp.press('Enter');
    const ed = p.locator('#profil-terminal-editor-text');
    await ed.waitFor();
    assert.equal(await ed.inputValue(), 'Initial assessment\n');
    assert.match(await p.locator('#profil-terminal-editor').textContent(), /\^O Write Out.*\^X Exit/);
    await ed.fill('Initial assessment\nSecond line\n');
    await ed.press('Control+o');
    await p.waitForFunction(() => /Wrote 2 lines/.test(document.querySelector('#profil-terminal-editor .editor-status').textContent));
    await ed.press('Control+x');
    await p.waitForFunction(() => !document.querySelector('#profil-terminal-editor') && !TERMINAL_ZUSTAND.kette);
    assert.equal(await s.lauf('cat briefing.txt'), 'Initial assessment\nSecond line');
    assert.equal(await s.lauf('ls -a ~'), '.\n..\nprojects');
    await s.lauf('touch /tmp/fluechtig.txt');
    assert.equal(await s.lauf('ls /tmp'), 'fluechtig.txt');
    assert.deepEqual(p.fehler, []);
    await ctx.close();

    /* vollständiger Neustart: neuer Kontext, gleiches Profil */
    ctx = await start();
    p = await oeffnen(ctx); s = shell(p);
    assert.equal(await s.lauf('cat projects/alpha/briefing.txt'), 'Initial assessment\nSecond line');
    assert.equal(await s.lauf('ls /tmp'), '', '/tmp ist nach unsauberem Ende beim Start leer (D1)');

    /* ---- B: Editor, Änderungsabfrage ---- */
    await s.inp.fill('nano projects/alpha/briefing.txt'); await s.inp.press('Enter');
    const ed2 = p.locator('#profil-terminal-editor-text');
    await ed2.waitFor();
    await ed2.fill('verworfen\n');
    await ed2.press('Control+x');
    await p.waitForFunction(() => /Save modified buffer/.test(document.querySelector('#profil-terminal-editor .editor-status').textContent));
    await ed2.press('n');
    await p.waitForFunction(() => !document.querySelector('#profil-terminal-editor') && !TERMINAL_ZUSTAND.kette);
    assert.equal(await s.lauf('cat projects/alpha/briefing.txt'), 'Initial assessment\nSecond line', 'N verwirft');
    await s.inp.fill('nano neu.txt'); await s.inp.press('Enter');
    const ed3 = p.locator('#profil-terminal-editor-text');
    await ed3.waitFor();
    assert.match(await p.locator('#profil-terminal-editor .editor-status').textContent(), /New File/);
    await ed3.fill('neu angelegt\n');
    await ed3.press('Control+x'); await ed3.press('y');
    await p.waitForFunction(() => !document.querySelector('#profil-terminal-editor') && !TERMINAL_ZUSTAND.kette);
    assert.equal(await s.lauf('cat neu.txt'), 'neu angelegt', 'Y speichert und beendet');
    assert.equal(await s.lauf('nano /etc/ppp/peers'), 'nano: /etc/ppp/peers: Is a directory');
    assert.equal(await s.lauf('nano'), 'nano: exactly one file name is required in this terminal (usage: nano <file>)');

    /* ---- C: Meldungen (GNU coreutils 9.4) ---- */
    const erw = {
      'mkdir projects': "mkdir: cannot create directory 'projects': File exists",
      'mkdir nodir/x': "mkdir: cannot create directory 'nodir/x': No such file or directory",
      'mkdir /etc/x': "mkdir: cannot create directory '/etc/x': Permission denied",
      'mkdir /home/x': "mkdir: cannot create directory '/home/x': Permission denied",
      'mkdir': "mkdir: missing operand\nTry 'mkdir --help' for more information.",
      'mkdir -z a': "mkdir: invalid option -- 'z'\nTry 'mkdir --help' for more information.",
      'touch /home/x': "touch: cannot touch '/home/x': Permission denied",
      'touch nodir/x': "touch: cannot touch 'nodir/x': No such file or directory",
      'touch /etc/hosts': "touch: cannot touch '/etc/hosts': Permission denied",
      'rmdir projects': "rmdir: failed to remove 'projects': Directory not empty",
      'rmdir neu.txt': "rmdir: failed to remove 'neu.txt': Not a directory",
      'rmdir nix': "rmdir: failed to remove 'nix': No such file or directory",
      'rmdir /tmp': "rmdir: failed to remove '/tmp': Permission denied",
      'rm nix': "rm: cannot remove 'nix': No such file or directory",
      'rm projects': "rm: cannot remove 'projects': Is a directory",
      'rm -r /': "rm: it is dangerous to operate recursively on '/'\nrm: use --no-preserve-root to override this failsafe",
      'rm -r .': "rm: refusing to remove '.' or '..' directory: skipping '.'",
      'rm /etc/ppp': "rm: cannot remove '/etc/ppp': Is a directory",
      'rm /etc/hosts': "rm: cannot remove '/etc/hosts': No such file or directory",
      'rm -r /home/raizo': "rm: cannot remove '/home/raizo': Permission denied",
      'cp': "cp: missing file operand\nTry 'cp --help' for more information.",
      'cp neu.txt': "cp: missing destination file operand after 'neu.txt'\nTry 'cp --help' for more information.",
      'cp nix x': "cp: cannot stat 'nix': No such file or directory",
      'cp projects x': "cp: -r not specified; omitting directory 'projects'",
      'cp -r projects projects/alpha/in': "cp: cannot copy a directory, 'projects', into itself, 'projects/alpha/in'",
      'cp neu.txt neu.txt': "cp: 'neu.txt' and 'neu.txt' are the same file",
      'cp neu.txt /etc/x': "cp: cannot create regular file '/etc/x': Permission denied",
      'cp neu.txt nodir/x': "cp: cannot create regular file 'nodir/x': No such file or directory",
      'mv nix x': "mv: cannot stat 'nix': No such file or directory",
      'mv projects projects/alpha/in': "mv: cannot move 'projects' to a subdirectory of itself, 'projects/alpha/in'",
      'mv neu.txt neu.txt': "mv: 'neu.txt' and 'neu.txt' are the same file",
      'mv neu.txt /etc/x': "mv: cannot move 'neu.txt' to '/etc/x': Invalid cross-device link",
      'mv /etc/ppp x': "mv: cannot move '/etc/ppp' to 'x': Invalid cross-device link",
      'cat nix': 'cat: nix: No such file or directory',
      'cat projects': 'cat: projects: Is a directory',
      'cat projects/alpha/nix': 'cat: projects/alpha/nix: No such file or directory'
    };
    for (const [z, text] of Object.entries(erw)) assert.equal(await s.lauf(z), text, z);
    assert.equal(await s.lauf('rm -f nix; echo $?'), '0', 'rm -f ohne Meldung, Rückgabewert 0');
    assert.equal(await s.lauf('mkdir /etc/x; echo $?'), "mkdir: cannot create directory '/etc/x': Permission denied\n1");

    /* ---- D: Umleitung ---- */
    assert.equal(await s.lauf('echo a > r.txt; echo b >> r.txt; echo c >> r.txt; cat r.txt'), 'a\nb\nc');
    assert.equal(await s.lauf('echo neu > r.txt; cat r.txt'), 'neu', '> ersetzt');
    assert.equal(await s.lauf('ls projects > liste.txt; cat liste.txt'), 'alpha');
    assert.equal(await s.lauf('cat projects/alpha/briefing.txt > kopie.txt; cat kopie.txt'), 'Initial assessment\nSecond line');
    assert.equal(await s.lauf('echo "a b   c" >r.txt; cat r.txt'), 'a b   c', 'Quoting und Leerzeichen');
    assert.equal(await s.lauf('echo $? > st.txt; cat st.txt'), '0');
    assert.equal(await s.lauf('false > leer.txt; cat leer.txt; echo $?'), '0', 'Ziel wird auch bei fehlschlagendem Befehl angelegt');
    assert.equal(await s.lauf('ls leer.txt'), 'leer.txt');
    assert.equal(await s.lauf('> nur.txt; ls nur.txt'), 'nur.txt', 'Umleitung ohne Befehl legt an');
    assert.equal(await s.lauf('ls /nix > fehl.txt; cat fehl.txt'), "ls: cannot access '/nix': No such file or directory", 'stderr bleibt auf dem Bildschirm, nicht in der Datei');
    assert.equal(await s.lauf('echo x > /etc/y'), 'bash: /etc/y: Permission denied');
    assert.equal(await s.lauf('echo x > nodir/y'), 'bash: nodir/y: No such file or directory');
    assert.equal(await s.lauf('echo x > projects'), 'bash: projects: Is a directory');
    assert.equal(await s.lauf('echo x > /tmp'), 'bash: /tmp: Is a directory');
    assert.equal(await s.lauf('ping relay > p.txt'), 'bash: ping: output redirection is not supported for this command');
    assert.equal(await s.lauf('echo a >'), "terminal: syntax error near unexpected token `newline'");
    assert.equal(await s.lauf('echo a > b > c'), 'terminal: multiple redirections are not supported');
    assert.equal(await s.lauf('echo a 2> b'), 'terminal: file descriptor redirections are not supported');
    assert.equal(await s.lauf('echo a >& b'), 'terminal: >& redirections are not supported');
    assert.equal(await s.lauf('echo "a > b"'), 'a > b', '> in Anführungszeichen ist Text');
    assert.equal(await s.lauf('echo a \\> b'), 'a > b', 'maskiertes > ist Text');

    /* ---- E: cp, mv, rm im Baum ---- */
    await s.lauf('cp -r projects kopie-baum');
    assert.equal(await s.lauf('cat kopie-baum/alpha/briefing.txt'), 'Initial assessment\nSecond line');
    await s.lauf('echo geaendert > kopie-baum/alpha/briefing.txt');
    assert.equal(await s.lauf('cat projects/alpha/briefing.txt'), 'Initial assessment\nSecond line', 'Kopie ist unabhängig');
    assert.equal(await s.lauf('mv kopie-baum /tmp/baum; ls /tmp'), 'baum', 'mv in /tmp');
    assert.equal(await s.lauf('mv /tmp/baum ~/zurueck; cat ~/zurueck/alpha/briefing.txt'), 'geaendert');
    assert.equal(await s.lauf('mv neu.txt zurueck; ls zurueck'), 'alpha\nneu.txt', 'mv in vorhandenes Verzeichnis');
    assert.equal(await s.lauf('cp r.txt kopie.txt zurueck; ls zurueck'), 'alpha\nkopie.txt\nneu.txt\nr.txt');
    assert.equal(await s.lauf('cp r.txt nix.txt nodatei.txt'), "cp: target 'nodatei.txt': No such file or directory");
    assert.equal(await s.lauf('rm -r zurueck; ls zurueck'), "ls: cannot access 'zurueck': No such file or directory");
    assert.equal(await s.lauf('cd /tmp; pwd; cd; pwd'), '/tmp\n/home/raizo');

    /* ---- F: Rechte, strenge Namen, Grenzen ---- */
    const g = await fsAufruf(p, 'TERMINAL_VFS.GRENZE');
    assert.equal((await fsAufruf(p, "TERMINAL_FS.schreiben(['home','x'], 'a')")).fehler, 'EACCES');
    assert.equal((await fsAufruf(p, "TERMINAL_FS.schreiben(['etc','x'], 'a')")).fehler, 'EACCES');
    assert.equal((await fsAufruf(p, "TERMINAL_FS.schreiben(['etc','nix','x'], 'a')")).fehler, 'ENOENT');
    assert.equal((await fsAufruf(p, "TERMINAL_FS.entfernen(['tmp'], {rekursiv:true})")).fehler, 'EACCES');
    assert.equal((await fsAufruf(p, "TERMINAL_FS.umbenennen(['home','raizo'], ['home','anders'])")).fehler, 'EACCES');
    assert.equal((await fsAufruf(p, "TERMINAL_FS.schreiben(['home','raizo','a/b'], 'a')")).fehler, 'EINVAL', 'Name mit Schrägstrich');
    assert.equal((await fsAufruf(p, "TERMINAL_FS.schreiben(['home','raizo','x'.repeat(256)], 'a')")).fehler, 'ENAMETOOLONG');
    await s.lauf('touch Datei datei DATEI');
    assert.match(await s.lauf('ls -1 | cat'), /pipes, redirections and substitutions are not supported/, 'Pipes bleiben ausgeschlossen');
    assert.deepEqual((await s.lauf('ls')).split('\n').filter(x => /^datei$/i.test(x)).sort(), ['DATEI', 'Datei', 'datei'], 'Groß-/Kleinschreibung unterscheidet');
    await fsAufruf(p, "TERMINAL_FS.schreiben(['home','raizo','é'], '1')");
    await fsAufruf(p, "TERMINAL_FS.schreiben(['home','raizo','e\\u0301'], '2')");
    assert.equal((await fsAufruf(p, "TERMINAL_FS.readFile(['home','raizo','é'])")).text, '1', 'keine Normalisierung (bytegleich)');
    assert.equal((await fsAufruf(p, "TERMINAL_FS.readFile(['home','raizo','e\\u0301'])")).text, '2');
    assert.equal((await fsAufruf(p, `TERMINAL_FS.schreiben(['home','raizo','gross'], 'x'.repeat(${g.datei + 1}))`)).fehler, 'EFBIG');
    assert.equal((await fsAufruf(p, "TERMINAL_FS.stat(['home','raizo','gross'])")).fehler, 'ENOENT', 'abgewiesenes Schreiben legt nichts an');
    /* Quote: Gesamtgröße, kein Teilzustand */
    const vorher = await fsAufruf(p, 'TERMINAL_VFS.zaehler()');
    let n = 0, fehler = null;
    for (; n < 40 && !fehler; n++) { const r = await fsAufruf(p, `TERMINAL_FS.schreiben(['home','raizo','fuell-${n}'], 'y'.repeat(1000000))`); fehler = r.fehler; }
    assert.equal(fehler, 'ENOSPC', 'Gesamtquote');
    const nach = await fsAufruf(p, 'TERMINAL_VFS.zaehler()');
    assert.ok(nach.bytes <= g.gesamt && nach.bytes > g.gesamt - 1000000 - 100, 'Zähler an der Grenze: ' + nach.bytes);
    assert.equal((await fsAufruf(p, `TERMINAL_FS.stat(['home','raizo','fuell-${n - 1}'])`)).fehler, 'ENOENT', 'fehlgeschlagenes Schreiben hinterlässt keine Datei');
    await fsAufruf(p, `TERMINAL_FS.schreiben(['home','raizo','fuell-rest'], 'y'.repeat(${g.gesamt - nach.bytes}))`);
    assert.equal((await fsAufruf(p, 'TERMINAL_VFS.zaehler()')).bytes, g.gesamt, 'Quote genau ausgeschöpft');
    assert.equal(await s.lauf('echo mehr > extra.txt'), 'bash: echo: write error: No space left on device');
    for (let i = 0; i < n; i++) await fsAufruf(p, `TERMINAL_FS.entfernen(['home','raizo','fuell-${i}'])`);
    await fsAufruf(p, "TERMINAL_FS.entfernen(['home','raizo','fuell-rest'])");
    assert.equal(await s.lauf('echo mehr > extra.txt; cat extra.txt'), 'mehr', 'nach dem Löschen wieder Platz');
    /* Zähler stimmt mit den Daten überein */
    const rechnung = await fsAufruf(p, `(async () => { const gesamt = async seg => { const d = await TERMINAL_VFS.readdir(seg); let b = 0, k = 0; for (const e of d.eintraege) { k++; if (e.dir) { const r = await gesamt(seg.concat(e.name)); b += r.b; k += r.k; } else b += (await TERMINAL_VFS.readFile(seg.concat(e.name))).text.length; } return { b, k }; }; const a = await gesamt(['home','raizo']), t = await gesamt(['tmp']), z = await TERMINAL_VFS.zaehler(); return { z, bk: a.k + t.k, bb: a.b + t.b }; })()`);
    assert.equal(rechnung.z.knoten, rechnung.bk, 'Knotenzähler');
    assert.ok(rechnung.z.bytes >= rechnung.bb, 'Bytezähler (UTF-8 ≥ Zeichen)');

    /* ---- G: Selbstprüfung: verwaiste Knoten ---- */
    await p.evaluate(() => new Promise((ok, fail) => {
      const r = indexedDB.open('fieldterminal.vfs');
      r.onsuccess = () => { const t = r.result.transaction('knoten', 'readwrite'); t.objectStore('knoten').add({ eltern: 987654, name: 'waise.txt', typ: 'file', modus: 420, uid: 1000, gid: 1000, erstellt: 1, geaendert: 1, groesse: 3, inhalt: 'abc', fluechtig: false, version: 1 }); t.oncomplete = () => { r.result.close(); ok(); }; t.onerror = () => fail(t.error); };
    }));
    const rep = await fsAufruf(p, 'TERMINAL_VFS.sitzungStart()');
    assert.equal(rep.repariert, 1, 'Selbstprüfung fand den verwaisten Knoten');
    assert.match(await s.lauf('ls ~/lost+found'), /^waise\.txt\.\d+$/);
    assert.equal(await s.lauf('cat ~/lost+found/' + (await s.lauf('ls ~/lost+found'))), 'abc');

    /* ---- H: Tab ---- */
    const tab = async (text, erwartet, meldung) => {
      await s.inp.fill(text); await s.inp.press('Tab');
      if (erwartet === text) await p.waitForTimeout(400);
      else await p.waitForFunction(v => document.querySelector('#profil-terminal-eingabe').value === v, erwartet);
      assert.equal(await s.inp.inputValue(), erwartet, meldung || text);
    };
    await tab('cat br', 'cat br', 'kein Treffer im Heimverzeichnis');
    await tab('cd pro', 'cd projects/');
    await tab('cp r.t', 'cp r.txt', 'Ergänzung des letzten Operanden');
    await tab('ls /ho', 'ls /home/');
    await tab('cat projects/alpha/br', 'cat projects/alpha/briefing.txt');
    await tab('rmdir pro', 'rmdir projects/', 'rmdir ergänzt nur Verzeichnisse');
    await tab('rmdir r.', 'rmdir r.', 'rmdir ergänzt keine Dateien');
    await s.inp.fill('');

    /* ---- I: /tmp bei mehreren Fenstern, Abmeldung ---- */
    await s.lauf('touch /tmp/t1');
    const p2 = await oeffnen(ctx), s2 = shell(p2);
    assert.equal(await s2.lauf('ls /tmp'), 't1', 'zweites Fenster leert /tmp nicht, solange das erste lebt');
    await s2.lauf('exit');
    assert.equal(await s.lauf('ls /tmp'), 't1', 'Ende des zweiten Fensters leert /tmp nicht');
    await p2.close();
    await s.cmd('exit');
    await p.waitForFunction(() => terminalVfsStart === null);
    assert.deepEqual((await fsAufruf(p, "TERMINAL_VFS.readdir(['tmp'])")).eintraege, [], 'Abmeldung der letzten Sitzung leert /tmp');
    assert.deepEqual(p.fehler, []);
    await ctx.close();

    /* ---- J: Sicherung über die echte Brücke ---- */
    const sicher = fs.mkdtempSync(path.join(os.tmpdir(), 'ft-home-'));
    const archiv = fs.mkdtempSync(path.join(os.tmpdir(), 'ft-arch-'));
    fs.mkdirSync(path.join(archiv, 'pgcl-eu3.arch07'));
    for (const f of ['terminal_lokal.py']) fs.copyFileSync(path.join(ROOT, f), path.join(archiv, f));
    const py = spawn('python3', [path.join(archiv, 'terminal_lokal.py'), '--serve-only'], { env: { ...process.env, SHADOW_TERMINAL_HOME: sicher } });
    const fragment = await new Promise((ok, fail) => { py.stdout.on('data', d => { const m = /#db=\d+\.[\w-]+/.exec(String(d)); if (m) ok(m[0]); }); py.on('exit', () => fail(new Error('Brücke beendet'))); setTimeout(() => fail(new Error('Brücke startet nicht')), 8000); });
    const ctx2 = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'ft-vfs2-')), { reducedMotion: 'reduce' });
    try {
      const q = await ctx2.newPage();
      q.setDefaultTimeout(15000);
      q.fehler = [];
      q.on('pageerror', e => q.fehler.push(e.message));
      await q.route(/^https?:/, async r => {
        const req = r.request();
        if (!/^http:\/\/127\.0\.0\.1:\d+\/db$/.test(req.url())) return r.abort();
        const antwort = await new Promise((ok, fail) => {
          const u = new URL(req.url()), rq = require('node:http').request({ host: u.hostname, port: u.port, path: u.pathname, method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Shadow-Token': req.headers()['x-shadow-token'], Origin: 'null' } }, res => { let t = ''; res.on('data', d => t += d); res.on('end', () => ok({ status: res.statusCode, body: t })); });
          rq.on('error', fail); rq.end(req.postData());
        });
        return r.fulfill({ status: antwort.status, body: antwort.body, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } });
      });
      await q.goto(APP + fragment);
      await q.fill('#gate-pw', PW); if (await q.isVisible('#gate-pw2')) await q.fill('#gate-pw2', PW);
      await q.click('#gate-go'); await q.click('#profil-terminal-oeffnen');
      const t = shell(q);
      await t.lauf('mkdir -p daten/sub');
      await t.lauf('echo "Zeile eins" > daten/a.txt');
      await t.lauf('echo "Umlaute: äöü ß € 𝄞" > daten/sub/b.txt');
      const b1 = await t.lauf('home-backup');
      assert.match(b1, /^home-backup: home-\d{8}T\d{6}Z\.json \(4 entries, \d+ B\)$/, b1);
      assert.match(await t.lauf('home-backup list'), /^home-\d{8}T\d{6}Z\.json {2}\d+ B$/);
      const dateien = fs.readdirSync(sicher).filter(x => x.startsWith('home-'));
      assert.equal(dateien.length, 1);
      const paket = JSON.parse(fs.readFileSync(path.join(sicher, dateien[0]), 'utf8'));
      assert.equal(paket.format, 'fieldterminal-home'); assert.equal(paket.manifest.eintraege, 4);
      assert.equal(fs.readdirSync(sicher).filter(x => x.startsWith('.tmp-')).length, 0, 'keine Reste der atomaren Ablage');
      /* Verlust und Wiederherstellung */
      await t.lauf('rm -r daten; echo "ersatz" > neu.txt');
      assert.match(await t.lauf('home-restore'), /^Available backups \(newest first\):\n {2}home-\d{8}T\d{6}Z\.json\nRestore with: home-restore --yes <name>$/);
      const name = dateien[0];
      assert.match(await t.lauf('home-restore ' + name), /this replaces everything in \/home\/raizo \(4 entries in the backup\)[\s\S]*--yes/, 'ohne --yes wird nichts ersetzt');
      assert.equal(await t.lauf('cat neu.txt'), 'ersatz');
      await new Promise(r => setTimeout(r, 1100));   /* neuer Zeitstempel der Sicherheitskopie */
      const r1 = await t.lauf('home-restore --yes ' + name);
      assert.match(r1, /^home-restore: 4 entries restored from home-.*\nprevious state saved as home-\d{8}T\d{6}Z(-\d)?\.json$/, r1);
      assert.equal(await t.lauf('cat daten/sub/b.txt'), 'Umlaute: äöü ß € 𝄞');
      assert.equal(await t.lauf('cat neu.txt'), 'cat: neu.txt: No such file or directory', 'Wiederherstellung ersetzt den Stand vollständig');
      assert.equal(fs.readdirSync(sicher).filter(x => x.startsWith('home-')).length, 2, 'Sicherheitskopie des vorherigen Standes');
      /* beschädigte Sicherung: nichts ändert sich */
      const defekt = path.join(sicher, 'home-20990101T000000Z.json');
      const kaputt = JSON.parse(fs.readFileSync(path.join(sicher, name), 'utf8'));
      kaputt.eintraege[1].inhalt = 'manipuliert';
      fs.writeFileSync(defekt, JSON.stringify(kaputt));
      assert.match(await t.lauf('home-restore --yes home-20990101T000000Z.json'), /\(checksum mismatch\); nothing changed/);
      assert.equal(await t.lauf('cat daten/a.txt'), 'Zeile eins', 'Stand unverändert nach abgelehnter Sicherung');
      fs.writeFileSync(path.join(sicher, 'home-20990101T000001Z.json'), 'kein json');
      assert.match(await t.lauf('home-restore --yes home-20990101T000001Z.json'), /not a valid backup \(unreadable\); nothing changed/);
      assert.match(await t.lauf('home-restore --yes ../etc/passwd'), /not a backup name/);
      /* Bridge verweigert freie Namen und falsche Prüfsumme */
      const roh = (op) => q.evaluate(async d => (await fetch('http://127.0.0.1:' + d.port + '/db', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Shadow-Token': d.token }, body: JSON.stringify(d.op) })).json(), { port: /#db=(\d+)/.exec(fragment)[1], token: /\.([\w-]+)$/.exec(fragment)[1], op });
      assert.deepEqual(await roh({ op: 'home-load', name: '../x' }), { error: 'Permission denied' });
      assert.deepEqual(await roh({ op: 'home-save', data: '{"format":"fieldterminal-home"}', sha256: '0'.repeat(64) }), { error: 'Prüfsumme stimmt nicht; nichts gespeichert' });
      assert.deepEqual(await roh({ op: 'home-save', data: '{"format":"x"}', sha256: require('node:crypto').createHash('sha256').update('{"format":"x"}').digest('hex') }), { error: 'Permission denied' });
      assert.deepEqual(await roh({ op: 'home-list', extra: 1 }), { error: 'Permission denied' });
      /* automatische Sicherung nach Ruhezeit */
      const vorAuto = fs.readdirSync(sicher).filter(x => /^home-\d/.test(x) && !x.startsWith('home-2099')).length;
      await q.evaluate(() => { terminalHomeRuhe = 300; });
      await t.lauf('echo auto > auto.txt');
      const zaehle = () => fs.readdirSync(sicher).filter(x => /^home-\d/.test(x) && !x.startsWith('home-2099')).length;
      for (let i = 0; i < 80 && zaehle() === vorAuto; i++) await new Promise(r => setTimeout(r, 100));
      assert.equal(zaehle(), vorAuto + 1, 'automatische Sicherung nach Änderung');
      /* Schutz geschützter Exportobjekte (Architektur 11) */
      assert.equal(await t.lauf('echo x > lageblatt-PIN-123.txt; cat lageblatt-PIN-123.txt'), 'x', 'gewöhnlicher Datei im VFS mit solchem Namen ist erlaubt (kein Archivobjekt)');
      assert.equal(await t.lauf('cp /pgcl-eu3.arch07/zone-ZO-123.txt z.txt'), "cp: cannot open '/pgcl-eu3.arch07/zone-ZO-123.txt' for reading: Permission denied");
      assert.equal(await t.lauf('cat /pgcl-eu3.arch07/zone-ZO-123.txt > z.txt'), 'bash: cat: Permission denied');
      assert.match(await t.lauf('home-export'), /^home-export: home-\d{8}T\d{6}Z\.json \(\d+ entries\) handed to the browser download$/);
      assert.deepEqual(q.fehler, []);
    } finally { await ctx2.close(); py.kill(); }
    console.log('OK: terminal-vfs (Abnahmeszenario, Neustart, Editor, Meldungen, Umleitung, Quoten, Selbstprüfung, mehrere Fenster, Sicherung)');
  } finally { await ctx.close().catch(() => {}); }
})().catch(e => { console.error(e); process.exitCode = 1; });
