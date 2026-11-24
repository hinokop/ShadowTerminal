/* Paket 1, Review zu PR #137: Regressionen zu den Blockern.
   A: ".." wird nicht mehr lexikalisch über fehlende Zwischenverzeichnisse hinweg aufgelöst (rm/mv/cp/touch/Umleitung/cat).
   B: Exportobjekte des Archivs gelangen nie ins VFS (ls-Umleitung, Alias-Antwort der Brücke, nano, cp, gemischte Operanden).
   Die Brücke wird im Browser durch einen Ersatz für terminalBrueckeSenden nachgebildet; es läuft keine Python-Brücke. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright');
const { APP } = require('./_pfad');

const PW = 'pw-test-123';
async function oeffnen(ctx) {
  const p = await ctx.newPage();
  p.setDefaultTimeout(15000);
  p.fehler = [];
  p.on('pageerror', e => p.fehler.push(e.message));
  await p.route(/^https?:/, r => r.abort());
  await p.goto(APP);
  await p.fill('#gate-pw', PW);
  if (await p.isVisible('#gate-pw2')) await p.fill('#gate-pw2', PW);
  await p.click('#gate-go');
  await p.click('#profil-terminal-oeffnen');
  return p;
}
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

(async () => {
  const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'ft-vfsr-')), { reducedMotion: 'reduce', viewport: { width: 1280, height: 900 } });
  try {
    const p = await oeffnen(ctx), s = shell(p);

    /* ---- A: Pfadnormalisierung ---- */
    await s.lauf('echo wichtig > wichtig.txt');
    await s.lauf('mkdir ordner');
    const intakt = async (t) => assert.equal(await s.lauf('cat wichtig.txt'), 'wichtig', 'Datei unverändert nach: ' + t);
    const fehl = {
      'rm fehlt/../wichtig.txt': "rm: cannot remove 'fehlt/../wichtig.txt': No such file or directory",
      'rm wichtig.txt/../wichtig.txt': "rm: cannot remove 'wichtig.txt/../wichtig.txt': Not a directory",
      'rm -r fehlt/../ordner': "rm: cannot remove 'fehlt/../ordner': No such file or directory",
      'mv fehlt/../wichtig.txt neu.txt': "mv: cannot stat 'fehlt/../wichtig.txt': No such file or directory",
      'mv wichtig.txt fehlt/../ziel.txt': "mv: cannot move 'wichtig.txt' to 'fehlt/../ziel.txt': No such file or directory",
      'cp fehlt/../wichtig.txt kopie.txt': "cp: cannot stat 'fehlt/../wichtig.txt': No such file or directory",
      'cp wichtig.txt fehlt/../kopie.txt': "cp: cannot create regular file 'fehlt/../kopie.txt': No such file or directory",
      'touch fehlt/../neu2': "touch: cannot touch 'fehlt/../neu2': No such file or directory",
      'mkdir fehlt/../neu3': "mkdir: cannot create directory 'fehlt/../neu3': No such file or directory",
      'rmdir fehlt/../ordner': "rmdir: failed to remove 'fehlt/../ordner': No such file or directory",
      'echo X > fehlt/../wichtig.txt': 'bash: fehlt/../wichtig.txt: No such file or directory',
      'echo X >> wichtig.txt/../wichtig.txt': 'bash: wichtig.txt/../wichtig.txt: Not a directory',
      'cat fehlt/../wichtig.txt': 'cat: fehlt/../wichtig.txt: No such file or directory'
    };
    for (const [z, text] of Object.entries(fehl)) { assert.equal(await s.lauf(z), text, z); await intakt(z); }
    assert.equal(await s.lauf('ls -1'), 'ordner\nwichtig.txt', 'nichts entstanden oder verschwunden');
    /* gültige Wege bleiben gültig, auch ab dem Arbeitsverzeichnis und mit ~ */
    assert.equal(await s.lauf('cat ordner/../wichtig.txt'), 'wichtig');
    assert.equal(await s.lauf('cp ordner/../wichtig.txt ordner/../kopie.txt; cat kopie.txt'), 'wichtig');
    await s.cmd('cd ordner');
    assert.equal(await s.lauf('cat ../wichtig.txt'), 'wichtig');
    assert.equal(await s.lauf('cat ../../raizo/wichtig.txt'), 'wichtig');
    assert.equal(await s.lauf('rm ../kopie.txt'), '');
    await s.cmd('cd');
    assert.equal(await s.lauf('mkdir -p neu/../zwei'), '');
    assert.equal(await s.lauf('ls -1'), 'neu\nordner\nwichtig.txt\nzwei', 'mkdir -p legt Zwischenverzeichnis an');
    assert.equal(await s.lauf('rm ordner/../zwei/../wichtig.txt'), '', 'zwei ist ein Verzeichnis: gültiger Weg');
    assert.equal(await s.lauf('cat wichtig.txt'), 'cat: wichtig.txt: No such file or directory');

    /* ---- A2: abschließendes "/" und "/." (Review 2) ---- */
    await s.lauf('echo wichtig > wichtig.txt');
    const fehl2 = {
      'rm wichtig.txt/': "rm: cannot remove 'wichtig.txt/': Not a directory",
      'rm wichtig.txt/.': "rm: refusing to remove '.' or '..' directory: skipping 'wichtig.txt/.'",
      'rmdir wichtig.txt/': "rmdir: failed to remove 'wichtig.txt/': Not a directory",
      'echo X > wichtig.txt/': 'bash: wichtig.txt/: Not a directory',
      'echo X >> wichtig.txt/.': 'bash: wichtig.txt/.: Not a directory',
      'touch wichtig.txt/': "touch: cannot touch 'wichtig.txt/': Not a directory",
      'mv wichtig.txt/ x.txt': "mv: cannot stat 'wichtig.txt/': Not a directory",
      'mv neu wichtig.txt/': "mv: cannot move 'neu' to 'wichtig.txt/': Not a directory",
      'cp wichtig.txt/ x.txt': "cp: cannot stat 'wichtig.txt/': Not a directory",
      'cp neu.txt wichtig.txt/': "cp: cannot create regular file 'wichtig.txt/': Not a directory",
      'nano wichtig.txt/': 'nano: wichtig.txt/: Not a directory',
      'cat wichtig.txt/': 'cat: wichtig.txt/: Not a directory'
    };
    await s.lauf('echo n > neu.txt');
    for (const [z, text] of Object.entries(fehl2)) { assert.equal(await s.lauf(z), text, z); await intakt(z); }
    /* fehlendes Ziel mit "/": keine Datei entsteht */
    assert.equal(await s.lauf('echo X > fehlt/'), 'bash: fehlt/: Is a directory');
    assert.equal(await s.lauf('touch fehlt/'), "touch: cannot touch 'fehlt/': Is a directory");
    assert.equal(await s.lauf('cp neu.txt fehlt/'), "cp: cannot create regular file 'fehlt/': Not a directory");
    assert.equal(await s.lauf('mv neu.txt fehlt/'), "mv: cannot move 'neu.txt' to 'fehlt/': Not a directory");
    assert.equal(await s.lauf('ls -1 fehlt'), "ls: cannot access 'fehlt': No such file or directory");
    /* "." und ".." am Ende entfernen nichts (rmdir/rename: EINVAL) */
    await s.lauf('mkdir -p leer/sub');
    assert.equal(await s.lauf('rmdir leer/sub/.'), "rmdir: failed to remove 'leer/sub/.': Invalid argument");
    assert.equal(await s.lauf('rmdir leer/sub/..'), "rmdir: failed to remove 'leer/sub/..': Invalid argument");
    assert.equal(await s.lauf('mv leer/. weg'), "mv: cannot stat 'leer/.': Invalid argument");
    assert.equal(await s.lauf('ls -1 leer'), 'sub');
    /* gültige Verzeichnisformen bleiben gültig */
    assert.equal(await s.lauf('mkdir neuer/'), '');
    assert.equal(await s.lauf('cp neu.txt neuer/; mv neuer/neu.txt neuer/./x.txt; ls -1 neuer/'), 'x.txt');
    assert.equal(await s.lauf('rmdir leer/sub/; rm -r neuer/ leer/; ls -1 -d leer neuer'), "ls: cannot access 'leer': No such file or directory\nls: cannot access 'neuer': No such file or directory");

    /* ---- A3: Wettlauf zwischen Pfadprüfung und Änderung (zweites Fenster) ---- */
    const wettlauf = async (z, op, vorbereitung, erwartet) => {
      await s.lauf(vorbereitung);
      await p.evaluate(([op]) => {
        const orig = TERMINAL_VFS[op];
        TERMINAL_VFS[op] = async function () {
          TERMINAL_VFS[op] = orig;
          /* das Zwischenverzeichnis verschwindet nach der Prüfung, vor der Änderung (eigene Transaktion, wie ein anderes Fenster) */
          await TERMINAL_VFS.entfernen(['home', 'raizo', 'zw'], { rekursiv: true });
          return orig.apply(this, arguments);
        };
      }, [op]);
      assert.equal(await s.lauf(z), erwartet, z);
      await intakt(z);
    };
    await wettlauf('rm zw/../wichtig.txt', 'entfernen', 'mkdir zw', "rm: cannot remove 'zw/../wichtig.txt': Device or resource busy");
    await wettlauf('echo X > zw/../wichtig.txt', 'schreiben', 'mkdir zw', 'bash: zw/../wichtig.txt: Device or resource busy');
    await wettlauf('mv neu.txt zw/../wichtig.txt', 'umbenennen', 'mkdir zw', "mv: cannot move 'neu.txt' to 'zw/../wichtig.txt': Device or resource busy");
    await wettlauf('cp neu.txt zw/../wichtig.txt', 'kopieren', 'mkdir zw', "cp: cannot create regular file 'zw/../wichtig.txt': Device or resource busy");
    /* ohne Wettlauf funktioniert derselbe Weg, auch über mehrere Schritte (Bindung folgt den eigenen Änderungen) */
    await s.lauf('mkdir zw');
    assert.equal(await s.lauf('echo eins > zw/../mehr.txt; echo zwei >> zw/../mehr.txt; cat mehr.txt'), 'eins\nzwei');
    assert.equal(await s.lauf('mkdir ziel; cp neu.txt mehr.txt zw/../ziel; ls -1 ziel'), 'mehr.txt\nneu.txt');
    await s.lauf('rm -r zw ziel mehr.txt');

    /* ---- A4: Tiefe des ganzen Teilbaums bei mv und cp (Review 2, Blocker 1) ---- */
    const tief = Array.from({ length: 37 }, () => 't').join('/');   /* /home/raizo/t/.../t: 39 Segmente */
    assert.equal(await s.lauf('mkdir -p ' + tief + ' a/b'), '');
    assert.equal(await s.lauf('mv a ' + tief), "mv: cannot move 'a' to '" + tief + "/a': File name too long");
    assert.equal(await s.lauf('cp -r a ' + tief), "cp: cannot create directory '" + tief + "/a': File name too long");
    assert.equal(await s.lauf('ls -1 a; ls -1 ' + tief), 'b', 'Quell- und Zielbaum unverändert');
    assert.equal(await s.lauf('rmdir a/b; mv a ' + tief + '; ls -1 ' + tief), 'a', 'Grenztiefe 40 ohne Nachkommen gilt');
    const rund = await p.evaluate(async () => { const pk = await terminalHomePaket(); const gp = await terminalHomePruefen(pk.text); return gp.fehler || 'ok'; });
    assert.equal(rund, 'ok', 'jeder erzeugbare Baum besteht die Prüfung der Wiederherstellung');
    await s.lauf('rm -r t');

    /* ---- B: Archivschutz ---- */
    await p.evaluate(() => {
      window.__brueckeAufrufe = [];
      terminalBrueckeSenden = async d => {
        window.__brueckeAufrufe.push(d.op + ':' + (d.parts || []).join('/'));
        if (d.op === 'ls') return { entries: [{ name: 'zone-ZO-123.txt', dir: false }, { name: 'lageblatt-PIN-200.txt', dir: false }, { name: 'notiz.txt', dir: false }, { name: 'kurz~1.txt', dir: false }], next: null };
        if (d.op === 'cd') return {};
        if (d.op === 'cat') { const n = d.parts[d.parts.length - 1]; return n === 'kurz~1.txt' ? { text: 'GEHEIM', file: 'zone-ZO-123.txt' } : { text: 'norm ' + n, file: n }; }
        return { error: 'Permission denied' };
      };
    });
    const A = '/pgcl-eu3.arch07';
    assert.match(await s.lauf('ls ' + A), /notiz\.txt/, 'Ersatzbrücke liefert die Listung');
    assert.equal(await s.lauf('ls ' + A + ' > liste.txt'), '');
    const liste = await s.lauf('cat liste.txt');
    assert.ok(/notiz\.txt/.test(liste) && !/zone-ZO|lageblatt-PIN/.test(liste), 'Exportnamen nicht in der Datei: ' + liste);
    assert.equal(await s.lauf('ls -l ' + A + ' >> liste2.txt'), '');
    assert.ok(!/zone-ZO|lageblatt-PIN/.test(await s.lauf('cat liste2.txt')), 'auch ls -l');
    /* Alias: neutraler Name, die Brücke meldet ein Exportobjekt */
    assert.equal(await s.lauf('cat ' + A + '/kurz~1.txt > x.txt'), 'cat: ' + A + '/kurz~1.txt: Permission denied');
    assert.equal(await s.lauf('cat x.txt'), '', 'nichts übernommen');
    assert.equal(await s.lauf('cp ' + A + '/kurz~1.txt y.txt'), "cp: cannot create regular file 'y.txt': Permission denied");
    assert.equal(await s.lauf('ls -1 y.txt'), "ls: cannot access 'y.txt': No such file or directory", 'cp legt keine Datei an');
    assert.equal(await s.lauf('nano ' + A + '/kurz~1.txt'), 'nano: ' + A + '/kurz~1.txt: Permission denied');
    /* nach einer Sperre: gewöhnliche Archivdatei bleibt kopierbar, Exportobjekt nie */
    assert.equal(await s.lauf('cat ' + A + '/notiz.txt > n.txt'), '');
    assert.equal(await s.lauf('cat n.txt'), 'norm notiz.txt');
    assert.equal(await s.lauf('cp ' + A + '/notiz.txt n2.txt; cat n2.txt'), 'norm notiz.txt');
    assert.equal(await s.lauf('cat ' + A + '/zone-ZO-123.txt > z.txt'), 'bash: cat: Permission denied');
    /* gemischte Operanden: nicht über den Leser der ctx-Schnittstelle (der keine Schutzmetadaten kennt) */
    const nurVfs = await p.evaluate(A => [terminalLeserNurVfs('cat', [A + '/zone-ZO-123.txt', '/home/raizo/n.txt']), terminalLeserNurVfs('cat', ['/home/raizo/n.txt', A + '/zone-ZO-123.txt']),
      terminalLeserNurVfs('head', ['-n', '2', '/home/raizo/n.txt']), terminalLeserNurVfs('cat', ['n.txt', 'n2.txt']), terminalLeserNurVfs('cat', []), terminalLeserNurVfs('head', ['-n', '2'])], A);
    assert.deepEqual(nurVfs, [false, false, true, true, false, false]);
    /* Provider: Exportobjekte nie lesbar, weder nach getipptem noch nach tatsächlichem Namen */
    const prov = await p.evaluate(async A => [(await TERMINAL_FS.readFile([TERMINAL_DB, 'kurz~1.txt'])).fehler, (await TERMINAL_FS.readFile([TERMINAL_DB, 'zone-ZO-123.txt'])).fehler, (await TERMINAL_FS.readFile([TERMINAL_DB, 'notiz.txt'])).text], A);
    assert.deepEqual(prov, ['Permission denied', 'Permission denied', 'norm notiz.txt']);
    assert.deepEqual(p.fehler, []);
    console.log('OK: terminal-vfs-review (Pfadnormalisierung, Archivschutz)');
  } finally { await ctx.close().catch(() => {}); }
})().catch(e => { console.error(e); process.exitCode = 1; });
