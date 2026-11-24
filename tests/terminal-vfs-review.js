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
