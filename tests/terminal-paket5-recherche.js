/* Paket 5: Recherchewerkzeuge und Pipelines (docs/terminal-recherchewerkzeuge-konzept.md), im echten Browser mit echter Brücke.
   A: Beispielbefehle des Konzepts mit definierten Daten (stdout, stderr, Status), Nulltreffer, Unicode, Quotes, führender Bindestrich, Fehleroptionen,
      Muster (BRE/ERE, -F, -w, -x, -i), mehrere Stufen mit && und ||, Tilde in Ausgaben.
   B: Vergleich mit GNU grep 3.11, coreutils (wc, uniq, sha256sum, sort -n) und GNU find, sofern auf dem Rechner vorhanden (sonst übersprungen und gemeldet).
   C: Schutz: Umleitung geschützter Ergebnisse (Treffer, Nulltreffer, Zahlen, Hashes; vorhandenes und fehlendes Ziel, Inhalt und mtime unverändert),
      neutrale Pipelines schreiben; Scrollback nach Sperre (Treffer, Zahlen), Sperre während der Suche und zwischen Stufen, verwaiste Exporte.
   D: Archiv über die echte Brücke: grep -r, find, Exportnamen geschützt, Binärdatei, ohne Brücke.
   E: Grenzen, langes Muster, teures Muster auf langer Zeile ohne Blockade, Strg+C, Sitzungswechsel.
   F: Tab nach "|", Pfadpositionen bei grep und find, offene Auswahlliste verfällt bei Identitätswechsel eines Exports. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, execFileSync } = require('node:child_process');
const { chromium } = require('playwright');
const { APP, ROOT } = require('./_pfad');

const PW = 'pw-test-123';
const GNU = (function () {
  const probe = function (bin, muster) { try { return muster.test(execFileSync(bin, ['--version'], { encoding: 'utf8' })) ? bin : null; } catch (e) { return null; } };
  return { grep: probe('/usr/bin/grep', /GNU grep/), find: probe('/usr/bin/find', /GNU findutils/), wc: probe('/usr/bin/wc', /GNU coreutils/), uniq: probe('/usr/bin/uniq', /GNU coreutils/),
    sha256sum: probe('/usr/bin/sha256sum', /GNU coreutils/), sort: probe('/usr/bin/sort', /GNU coreutils/) };
})();
async function bruecke() {
  const ordner = fs.mkdtempSync(path.join(os.tmpdir(), 'ft-p5-'));
  const db = path.join(ordner, 'pgcl-eu3.arch07');
  fs.mkdirSync(path.join(db, 'dokumente', 'unter'), { recursive: true }); fs.mkdirSync(path.join(db, 'ops'));
  fs.writeFileSync(path.join(db, 'dokumente', 'bericht.txt'), 'Lage Berlin\nLage Hamburg\n');
  fs.writeFileSync(path.join(db, 'dokumente', 'unter', 'notiz.txt'), 'berlin klein\n');
  fs.writeFileSync(path.join(db, 'ops', 'bild.bin'), Buffer.from(Array.from({ length: 300 }, (_, i) => i % 256)));
  fs.copyFileSync(path.join(ROOT, 'terminal_lokal.py'), path.join(ordner, 'terminal_lokal.py'));
  const py = spawn('python3', [path.join(ordner, 'terminal_lokal.py'), '--serve-only'], { env: { ...process.env, SHADOW_TERMINAL_HOME: fs.mkdtempSync(path.join(os.tmpdir(), 'ft-p5h-')) } });
  const fragment = await new Promise((ok, fail) => {
    py.stdout.on('data', d => { const m = /#db=\d+\.[\w-]+/.exec(String(d)); if (m) ok(m[0]); });
    py.on('exit', () => fail(new Error('Brücke beendet'))); setTimeout(() => fail(new Error('Brücke startet nicht')), 15000);
  });
  return { py, fragment, db };
}
(async () => {
  const br = await bruecke();
  const b = await chromium.launch();
  const uebersprungen = [];
  try {
    const p = await b.newPage({ reducedMotion: 'reduce' });
    p.setDefaultTimeout(20000);
    const seitenfehler = [];
    p.on('pageerror', e => seitenfehler.push(e.message));
    await p.route(/^https?:/, r => /^http:\/\/127\.0\.0\.1:\d+\/db$/.test(r.request().url()) ? r.continue() : r.abort());
    await p.goto(APP + br.fragment);
    await p.fill('#gate-pw', PW); if (await p.isVisible('#gate-pw2')) await p.fill('#gate-pw2', PW);
    await p.click('#gate-go');
    await p.waitForFunction(() => typeof APP_BEREIT !== 'undefined' && APP_BEREIT && !!STATE && !document.body.classList.contains('locked'));
    const ids = await p.evaluate(() => {
      dispatch({ type: 'DOSSIER_NOTIZ', id: 'P-0001', text: 'observation MARKE Berlin Mitte' });
      dispatch({ type: 'DOSSIER_NOTIZ', id: 'P-0003', text: 'observation MARKE Hamburg' });
      dispatch({ type: 'PIN_ANGELEGT', ll: [52.47, 13.45], name: 'Nordpunkt', dossier: 'P-0003', notiz: 'MARKE Zufahrt' });
      const p3 = PROFIL.pins.at(-1).id;
      dispatch({ type: 'PIN_ANGELEGT', ll: [52.48, 13.46], name: 'Freipunkt', notiz: 'MARKE frei' });
      return { p3: p3, frei: PROFIL.pins.at(-1).id };
    });
    await p.click('#profil-terminal-oeffnen');
    const inp = p.locator('#profil-terminal-eingabe'), out = p.locator('#profil-terminal-ausgabe');
    const warten = () => p.waitForFunction(() => !TERMINAL_ZUSTAND.kette && !TERMINAL_ZUSTAND.dateiLaeuft);
    const lauf = async z => {
      const roh = await out.textContent(), vorher = roh === '' ? 0 : roh.split('\n').length;
      await inp.fill(z); await inp.press('Enter'); await warten();
      return (await out.textContent()).split('\n').slice(vorher + 1).join('\n');
    };
    const status = () => p.evaluate(() => TERMINAL_ZUSTAND.status);
    const mitStatus = async z => [await lauf(z), await status()];
    const ausgabe = () => p.evaluate(() => TERMINAL_ZUSTAND.ausgabe.join('\n'));
    const vfs = (pfad, text) => p.evaluate(([s, t]) => TERMINAL_FS.schreiben(s, t), [pfad.split('/').filter(Boolean), text]);
    const DATEN = {
      'report.txt': 'Berlin eins\nHamburg\nBerlin eins\nStraße Köln\n-x Zeile\nberlin klein\n',
      'zahlen.txt': '10\n9\n-3\n1,000\n2.5\nabc\n10\n',
      'woerter.txt': 'a a\nb\nb\nc\na a\n',
      'ohne-ende.txt': 'zeile eins\nzeile zwei',
      'zahlen-c.txt': '10\n9\n-3\n2.5\nabc\n10\n007\n'
    };
    for (const [n, t] of Object.entries(DATEN)) await vfs('/home/raizo/' + n, t);
    await p.evaluate(() => TERMINAL_FS.mkdir(['home', 'raizo', 'projects']));
    await vfs('/home/raizo/projects/notiz.txt', 'Projekt Berlin\n');

    /* ---- A ---- */
    assert.deepEqual(await mitStatus('grep -n Berlin ~/report.txt'), ['1:Berlin eins\n3:Berlin eins', 0]);
    assert.deepEqual(await mitStatus('grep -c Berlin ~/report.txt'), ['2', 0]);
    assert.deepEqual(await mitStatus('grep -ic berlin ~/report.txt'), ['3', 0]);
    assert.deepEqual(await mitStatus('grep zzz ~/report.txt'), ['', 1], 'Nulltreffer');
    assert.deepEqual(await mitStatus('grep zzz ~/fehlt.txt'), ['grep: /home/raizo/fehlt.txt: No such file or directory', 2]);
    assert.deepEqual(await mitStatus('grep -s zzz ~/fehlt.txt'), ['', 2]);
    assert.deepEqual(await mitStatus('grep "Straße K" ~/report.txt'), ['Straße Köln', 0], 'Unicode und Leerzeichen im Muster');
    assert.deepEqual(await mitStatus('grep -e -x ~/report.txt'), ['-x Zeile', 0], 'führender Bindestrich über -e');
    assert.deepEqual(await mitStatus('grep -- -x ~/report.txt'), ['-x Zeile', 0]);
    assert.deepEqual(await mitStatus('grep -Q x ~/report.txt'), ["grep: invalid option -- 'Q'\nUsage: grep [OPTION]... PATTERNS [FILE]...\nTry 'grep --help' for more information.", 2]);
    assert.deepEqual(await mitStatus('grep -o x ~/report.txt'), ['grep: -o: option not supported in Shadow Terminal', 2]);
    assert.deepEqual(await mitStatus('grep'), ["Usage: grep [OPTION]... PATTERNS [FILE]...\nTry 'grep --help' for more information.", 2]);
    assert.deepEqual(await mitStatus('grep -E "a(" ~/report.txt'), ['grep: Unmatched ( or \\(', 2]);
    assert.deepEqual(await mitStatus('grep "\\(a\\)\\1" ~/report.txt'), ['grep: back-references are not supported', 2]);
    assert.deepEqual(await mitStatus('grep -E "^(Berlin|Hamburg)$" ~/report.txt'), ['Hamburg', 0]);
    assert.deepEqual(await mitStatus('grep "^Berlin e[a-z]*$" ~/report.txt'), ['Berlin eins\nBerlin eins', 0]);
    assert.deepEqual(await mitStatus('grep -w ein ~/report.txt'), ['', 1]);
    assert.deepEqual(await mitStatus('grep -x Hamburg ~/report.txt'), ['Hamburg', 0]);
    assert.deepEqual(await mitStatus('grep -F "a(" ~/report.txt'), ['', 1]);
    assert.deepEqual(await mitStatus('grep -vc Berlin ~/report.txt'), ['4', 0]);
    assert.deepEqual(await mitStatus('grep -l Berlin ~/report.txt ~/zahlen.txt ~/fehlt.txt'), ['/home/raizo/report.txt\ngrep: /home/raizo/fehlt.txt: No such file or directory', 2]);
    assert.deepEqual(await mitStatus('grep -r Berlin ~/projects'), ['/home/raizo/projects/notiz.txt:Projekt Berlin', 0]);
    assert.deepEqual(await mitStatus('grep Berlin ~/projects'), ['grep: /home/raizo/projects: Is a directory', 2]);
    assert.deepEqual(await mitStatus('grep -q Berlin ~/report.txt'), ['', 0]);
    assert.deepEqual(await mitStatus('cd ~/projects && grep -r Berlin; cd'), ['notiz.txt:Projekt Berlin', 0], 'grep -r ohne Operand: Arbeitsverzeichnis ohne ./');
    assert.deepEqual(await mitStatus('find ~/projects -type f -name "*.txt"'), ['/home/raizo/projects/notiz.txt', 0]);
    assert.deepEqual(await mitStatus('find ~ -maxdepth 0'), ['/home/raizo', 0]);
    assert.deepEqual(await mitStatus('find ~/nein'), ['find: ‘/home/raizo/nein’: No such file or directory', 1]);
    assert.deepEqual(await mitStatus('find ~ -exec rm {} ;'), ['find: -exec: not supported in Shadow Terminal', 1]);
    assert.deepEqual(await mitStatus('find ~ -type x'), ['find: Unknown argument to -type: x', 1]);
    assert.deepEqual(await mitStatus('find ~ -bla'), ["find: unknown predicate `-bla'", 1]);
    assert.deepEqual(await mitStatus('cat ~/report.txt | sort | uniq -c'), ['      2 Berlin eins\n      1 berlin klein\n      1 Hamburg\n      1 Straße Köln\n      1 -x Zeile', 0], 'Kollation en_US.UTF-8 (Bindestrich erst auf Stufe 4, wie ls)');
    assert.deepEqual(await mitStatus('sort -n ~/zahlen.txt'), ['-3\nabc\n2.5\n9\n10\n10\n1,000', 0], 'Tausendertrennzeichen in en_US.UTF-8');
    assert.deepEqual(await mitStatus('sort -nu ~/zahlen.txt'), ['-3\nabc\n2.5\n9\n10\n1,000', 0], '-u mit -n: gleiche Zahl ist gleich (10 und 10)');
    assert.deepEqual(await mitStatus('sort -r ~/woerter.txt | uniq'), ['c\nb\na a', 0]);
    assert.deepEqual(await mitStatus('uniq -d ~/woerter.txt'), ['b', 0]);
    assert.deepEqual(await mitStatus('uniq -u ~/woerter.txt'), ['a a\nc\na a', 0]);
    assert.deepEqual(await mitStatus('wc ~/report.txt'), [' 6 11 68 /home/raizo/report.txt', 0]);
    assert.deepEqual(await mitStatus('wc -l ~/report.txt ~/woerter.txt'), [' 6 /home/raizo/report.txt\n 5 /home/raizo/woerter.txt\n11 total', 0]);
    assert.deepEqual(await mitStatus('cat ~/report.txt | wc'), ['      6      11      68', 0]);
    assert.deepEqual(await mitStatus('cat ~/report.txt | wc -l'), ['6', 0]);
    assert.deepEqual(await mitStatus('cat ~/ohne-ende.txt | wc -l'), ['1', 0], 'letzte Zeile ohne Zeilenende');
    assert.deepEqual(await mitStatus('cat ~/ohne-ende.txt | tail -n 1 | wc -c'), ['10', 0]);
    assert.deepEqual(await mitStatus('sha256sum ~/report.txt'), [require('node:crypto').createHash('sha256').update(DATEN['report.txt']).digest('hex') + '  /home/raizo/report.txt', 0]);
    assert.deepEqual(await mitStatus('cat ~/woerter.txt | sha256sum'), [require('node:crypto').createHash('sha256').update(DATEN['woerter.txt']).digest('hex') + '  -', 0]);
    assert.deepEqual(await mitStatus('grep -i "berlin" ~/report.txt | head -n 2'), ['Berlin eins\nBerlin eins', 0]);
    assert.deepEqual(await mitStatus('grep zzz ~/report.txt | wc -l'), ['0', 0], 'Status der letzten Stufe (kein pipefail)');
    assert.deepEqual(await mitStatus('grep zzz ~/report.txt | wc -l && echo weiter'), ['0\nweiter', 0]);
    assert.deepEqual(await mitStatus('echo a | grep b || echo leer'), ['leer', 0]);
    assert.deepEqual(await mitStatus('echo "a|b" | grep "|"'), ['a|b', 0], '| in Anführungszeichen ist Text');
    assert.deepEqual(await mitStatus('pon kestrel | wc'), ['terminal: pon: not supported in a pipeline', 2]);
    assert.deepEqual(await mitStatus('echo 1 | cat | cat | cat | cat | cat | cat | cat | cat'), ['terminal: pipelines are limited to 8 commands', 2]);
    assert.deepEqual(await mitStatus('echo a |'), ["terminal: syntax error near unexpected token `newline'", 2]);
    assert.deepEqual(await mitStatus('grep -i berlin ~/report.txt > ~/matches.txt'), ['', 0]);
    assert.equal(await lauf('cat ~/matches.txt'), 'Berlin eins\nBerlin eins\nberlin klein');
    assert.deepEqual(await mitStatus('cat ~/report.txt | sort | uniq -c >> ~/matches.txt'), ['', 0]);
    assert.match(await lauf('cat ~/matches.txt'), /berlin klein\n {6}2 Berlin eins\n/);
    /* /intel: Beispiele des Konzepts */
    assert.deepEqual(await mitStatus('grep -ri "marke" /intel/dossiers'), ['/intel/dossiers/persons/P-0001/notes:observation MARKE Berlin Mitte\n/intel/dossiers/persons/P-0003/notes:observation MARKE Hamburg', 0]);
    assert.match(await lauf('grep -in "observation" /intel/dossiers/persons/P-0001/notes'), /^\d+:observation MARKE Berlin Mitte$/);
    const geo = (await lauf('grep -rl MARKE /intel/geospatial')).split('\n').sort();
    assert.deepEqual(geo, ['/intel/geospatial/pins/' + ids.p3 + '/record', '/intel/geospatial/pins/' + ids.frei + '/record'].sort());
    assert.equal(await lauf('find /intel/dossiers -type f -name profile | wc -l'), String(await p.evaluate(() => Object.keys(STATE.dossiers.entitaeten).length)));
    assert.match(await lauf('cat /intel/dossiers/index | grep -i person | head -n 1'), /^P-\d{4} +person/);
    assert.equal(await lauf('ls /intel/geospatial/pins | wc -l'), '3', 'zwei Pins und index');

    /* ---- B: Vergleich mit GNU ---- */
    const host = fs.mkdtempSync(path.join(os.tmpdir(), 'ft-p5gnu-'));
    for (const [n, t] of Object.entries(DATEN)) fs.writeFileSync(path.join(host, n), t);
    fs.mkdirSync(path.join(host, 'projects')); fs.writeFileSync(path.join(host, 'projects', 'notiz.txt'), 'Projekt Berlin\n');
    const gnu = (bin, args, eingabe) => {
      try { return [execFileSync(bin, args, { cwd: host, encoding: 'utf8', input: eingabe, env: { ...process.env, LC_ALL: 'C.UTF-8' } }).replace(/\n$/, ''), 0]; }
      catch (e) { return [String(e.stdout || '').replace(/\n$/, '') + String(e.stderr || '').replace(/\n$/, ''), e.status]; }
    };
    const vergleich = async (bin, args, zeile) => {
      if (!GNU[bin]) { uebersprungen.push(bin + ' ' + args.join(' ')); return; }
      const g = gnu(GNU[bin], args);
      const [a, s] = await mitStatus('cd ~ && ' + zeile + '; echo "#$?"; cd');
      const ich = a.replace(/\n?#(\d+)$/, ''), code = Number(/#(\d+)$/.exec(a)[1]);
      assert.deepEqual([ich, code], [g[0].split(host + '/').join(''), g[1]], 'GNU-Vergleich: ' + zeile);
      void s;
    };
    const q = x => x.map(a => /[\s"'|\\$*?[\]{}()<>;&]/.test(a) ? "'" + a + "'" : a).join(' ');
    for (const args of [['-n', 'Berlin', 'report.txt'], ['-c', 'Berlin', 'report.txt', 'woerter.txt'], ['-v', 'Berlin', 'report.txt'], ['-i', 'BERLIN', 'report.txt'], ['-w', 'a', 'woerter.txt'],
      ['-x', 'b', 'woerter.txt'], ['-E', 'Ber(l|x)in{1,2}', 'report.txt'], ['Berl.n e\\+', 'report.txt'], ['-F', '-x', 'report.txt'], ['-l', 'a', 'woerter.txt', 'report.txt'],
      ['-rn', 'Berlin', 'projects'], ['-h', 'Berlin', 'report.txt', 'projects/notiz.txt'], ['-H', 'Hamburg', 'report.txt'], ['[[:upper:]]', 'zahlen.txt'], ['^[0-9]\\{2\\}$', 'zahlen.txt']]) {
      await vergleich('grep', args, 'grep ' + q(args));
    }
    await vergleich('wc', ['report.txt', 'zahlen.txt'], 'wc report.txt zahlen.txt');
    await vergleich('wc', ['-w', 'woerter.txt'], 'wc -w woerter.txt');
    await vergleich('wc', ['-lc', 'ohne-ende.txt'], 'wc -lc ohne-ende.txt');
    await vergleich('uniq', ['-c', 'woerter.txt'], 'uniq -c woerter.txt');
    await vergleich('sha256sum', ['report.txt', 'zahlen.txt'], 'sha256sum report.txt zahlen.txt');
    await vergleich('sort', ['-n', 'zahlen-c.txt'], 'sort -n zahlen-c.txt');   /* ohne Tausendertrennzeichen: C.UTF-8 und en_US gleich */
    await vergleich('find', ['projects', '-name', '*.txt'], 'find projects -name "*.txt"');
    await vergleich('find', ['projects', '-type', 'd'], 'find projects -type d');
    await vergleich('find', ['.', '-maxdepth', '1', '-name', 'r*'], 'find . -maxdepth 1 -name "r*"');

    /* ---- C: Schutz ---- */
    await vfs('/home/raizo/count.txt', 'ALT\n');
    const vorher = await p.evaluate(async () => (await TERMINAL_FS.stat(['home', 'raizo', 'count.txt'])).eintrag);
    for (const z of ['grep -ri "MARKE" /intel/dossiers | head -n 5 > ~/count.txt', 'grep -ri zzzzz /intel/dossiers | wc -l > ~/count.txt', 'find /intel -name x | wc -l >> ~/count.txt',
      'cat /intel/dossiers/index | sha256sum > ~/count.txt', 'ls /intel | sort > ~/count.txt', 'grep -c MARKE /intel/dossiers/persons/P-0001/notes > ~/count.txt']) {
      assert.deepEqual(await mitStatus(z), ['bash: ' + z.split(' ')[0] + ': Operation not permitted', 1], z);
      assert.deepEqual(await mitStatus(z.replace('~/count.txt', '~/neu.txt')), ['bash: ' + z.split(' ')[0] + ': Operation not permitted', 1]);
    }
    assert.equal(await lauf('cat ~/count.txt'), 'ALT');
    assert.deepEqual(await p.evaluate(async () => (await TERMINAL_FS.stat(['home', 'raizo', 'count.txt'])).eintrag), vorher, 'Inhalt und mtime unverändert');
    assert.match(await lauf('ls ~/neu.txt'), /No such file or directory/, 'fehlendes Ziel nicht angelegt');
    assert.deepEqual(await mitStatus('grep -c Berlin ~/report.txt | wc -l > ~/neu.txt'), ['', 0], 'neutrale Pipeline schreibt');
    assert.equal(await lauf('cat ~/neu.txt'), '1');
    /* Scrollback: Treffer und Zahlen mit P-0003 verschwinden bei Sperre, P-0001 bleibt */
    await lauf('clear');
    await lauf('grep -ri "marke" /intel/dossiers');
    await lauf('grep -rc MARKE /intel/dossiers/persons/P-0003');
    await lauf('grep -ri marke /intel/dossiers | wc -l');
    await lauf('find /intel/geospatial/pins -name "PIN-*"');
    await lauf('grep -r MARKE /intel/geospatial | sort -u');
    await p.evaluate(() => dispatch({ type: 'DOSSIER_SPERREN', id: 'P-0003' }));
    let sb = (await ausgabe()).split('\n').filter(l => !/^raizo@terminal/.test(l));
    assert.ok(sb.includes('/intel/dossiers/persons/P-0001/notes:observation MARKE Berlin Mitte'), sb.join('\n'));
    assert.ok(!sb.some(l => /Hamburg|P-0003|^2$/.test(l) || l.includes(ids.p3)), 'nach Sperre:\n' + sb.join('\n'));
    assert.ok(sb.some(l => l.includes(ids.frei)), 'freier Pin bleibt');
    /* nach der Sperre: gesperrte Inhalte nicht gefunden, Anzahl ohne sie */
    assert.equal(await lauf('grep -ri marke /intel/dossiers | wc -l'), '1');
    assert.equal(await lauf('find /intel/geospatial/pins -name "PIN-*"'), '/intel/geospatial/pins/' + ids.frei);
    await p.evaluate(() => dispatch({ type: 'DOSSIER_ENTSPERREN', id: 'P-0003' }));
    /* Sperre während der Suche und zwischen den Stufen */
    await p.evaluate(() => {
      const a = TERMINAL_ANBIETER.intel, rf = a.readFile;
      window.__halt = null;
      a.readFile = async function (seg) {
        const h = window.__halt;
        if (h && seg.join('/').includes(h.bei)) { window.__halt = null; h.erreicht = true; await new Promise(ok => { h.weiter = ok; }); }
        return rf.apply(this, arguments);
      };
    });
    const waehrend = async (zeile, bei, aktion) => {
      const roh = await out.textContent(), vor = roh.split('\n').length;
      await p.evaluate(b => { window.__h = window.__halt = { bei: b }; }, bei);
      await inp.fill(zeile); await inp.press('Enter');
      await p.waitForFunction(() => window.__h.erreicht);
      await p.evaluate(aktion);
      await p.evaluate(() => window.__h.weiter());
      await warten();
      return (await out.textContent()).split('\n').slice(vor + 1).join('\n');
    };
    const sp3 = () => dispatch({ type: 'DOSSIER_SPERREN', id: 'P-0003' });
    let w = await waehrend('grep -ri marke /intel/dossiers', 'P-0003/notes', sp3);
    assert.ok(!/Hamburg/.test(w), 'Sperre während der Suche: ' + w);
    await p.evaluate(() => dispatch({ type: 'DOSSIER_ENTSPERREN', id: 'P-0003' }));
    w = await waehrend('grep -ri marke /intel/dossiers | sort | wc -l', 'P-0003/notes', sp3);
    assert.ok(!/^2$/.test(w), 'Zahl nach Sperre während der Suche: ' + w);
    await p.evaluate(() => dispatch({ type: 'DOSSIER_ENTSPERREN', id: 'P-0003' }));
    /* zwischen den Stufen: Sperre, während die zweite Stufe liest */
    w = await waehrend('grep -rl MARKE /intel/dossiers/persons/P-0003 | cat /intel/dossiers/persons/P-0001/notes', 'P-0001/notes', sp3);
    assert.ok(!/P-0003/.test(w), w);
    assert.ok(!(await ausgabe()).split('\n').some(l => !/^raizo@terminal/.test(l) && /Hamburg/.test(l)), 'Scrollback');
    await p.evaluate(() => dispatch({ type: 'DOSSIER_ENTSPERREN', id: 'P-0003' }));
    /* Exporte: find /exports, Identitätswechsel macht die Zeile und die Zahl unsichtbar */
    await p.evaluate(async id => { await EXPORTE.anlegen('pin', id, null, pinText(PROFIL.pins.find(x => x.id === id)) + '\n'); }, ids.frei);
    const exp = await lauf('find /exports -name "*.txt"');
    assert.match(exp, new RegExp('^/exports/pins/' + ids.frei + '/\\d{8}T\\d{6}\\.\\d{3}Z-[0-9a-f]{6}\\.txt$'));
    assert.equal(await lauf('find /exports -name "*.txt" | wc -l'), '1');
    assert.match(await lauf('grep -r MARKE /exports'), /MARKE frei/);
    assert.deepEqual(await mitStatus('find /exports -name "*.txt" | wc -l > ~/c2.txt'), ['bash: find: Operation not permitted', 1]);
    await p.evaluate(id => { PROFIL.pins.find(x => x.id === id).t = '2026-01-01T00:00:00.000Z'; profilSpeichern(); dispatch({ type: 'PIN_GEAENDERT', id, notiz: 'MARKE frei' }); }, ids.frei);
    sb = (await ausgabe()).split('\n').filter(l => !/^raizo@terminal/.test(l));
    assert.ok(!sb.some(l => l.startsWith('/exports/') || /^\/exports.*MARKE frei/.test(l)), sb.slice(-6).join('\n'));
    assert.deepEqual(await mitStatus('find /exports -name "*.txt"'), ['', 0], 'verwaister Export nicht gefunden');

    /* ---- D: Archiv über die Brücke ---- */
    const A = '/pgcl-eu3.arch07';
    const arch = await mitStatus('grep -ri berlin ' + A + '/dokumente');   /* Reihenfolge des Verzeichnisses (wie GNU nicht festgelegt) */
    assert.deepEqual([arch[0].split('\n').sort(), arch[1]], [[A + '/dokumente/bericht.txt:Lage Berlin', A + '/dokumente/unter/notiz.txt:berlin klein'], 0]);
    assert.match(await lauf('find ' + A + ' -name "*.txt" | sort'), /bericht\.txt\n.*notiz\.txt/);
    assert.match(await lauf('grep -r x ' + A + '/ops'), /bild\.bin: Keine (UTF-8-)?Textdatei/, 'Binärdatei: Meldung der Brücke, kein Text');
    assert.deepEqual(await mitStatus('grep -ri berlin ' + A + '/dokumente > ~/archiv.txt'), ['', 0], 'neutrale Archivdateien dürfen gespeichert werden');
    fs.writeFileSync(path.join(br.db, 'ops', 'lageblatt-' + ids.p3 + '.txt'), 'GEHEIM\n');
    assert.match(await lauf('find ' + A + '/ops'), new RegExp('lageblatt-' + ids.p3));
    assert.match(await lauf('grep -r GEHEIM ' + A + '/ops'), new RegExp('lageblatt-' + ids.p3 + '\\.txt: Permission denied'), 'Exportobjekte nie als Text');
    assert.deepEqual(await mitStatus('find ' + A + '/ops | wc -l > ~/archiv2.txt'), ['bash: find: Operation not permitted', 1], 'Exportname durchlaufen');
    await p.evaluate(() => dispatch({ type: 'DOSSIER_SPERREN', id: 'P-0003' }));
    sb = (await ausgabe()).split('\n').filter(l => !/^raizo@terminal/.test(l));
    assert.ok(!sb.some(l => l.includes('lageblatt-' + ids.p3)), 'Archivname nach Sperre aus dem Scrollback');
    assert.doesNotMatch(await lauf('find ' + A + '/ops'), new RegExp('lageblatt-' + ids.p3));
    await p.evaluate(() => dispatch({ type: 'DOSSIER_ENTSPERREN', id: 'P-0003' }));

    /* ---- E: Grenzen, Muster, Abbruch, Sitzung ---- */
    await p.evaluate(() => { RECHERCHE_GRENZE.eintraege = 5; });
    assert.deepEqual(await mitStatus('find /intel | wc -l'), ['wc: search limit reached (5 entries); no result', 2], 'keine Teilausgabe');
    await p.evaluate(() => { RECHERCHE_GRENZE.eintraege = 10000; RECHERCHE_GRENZE.gelesen = 100; });
    assert.deepEqual(await mitStatus('cat ~/report.txt ~/report.txt | wc -l'), ['wc: read limit reached (16 MiB); no result', 2]);
    await p.evaluate(() => { RECHERCHE_GRENZE.gelesen = 16 * 1048576; RECHERCHE_GRENZE.puffer = 20; });
    assert.deepEqual(await mitStatus('cat ~/report.txt | wc -l'), ['wc: output limit reached (4 MiB); no result', 2]);
    await p.evaluate(() => { RECHERCHE_GRENZE.puffer = 4 * 1048576; });
    /* Mustergrenze (1024; die Eingabezeile ist selbst auf 1024 Zeichen begrenzt): vorübergehend 10 */
    await p.evaluate(() => { RECHERCHE_GRENZE.muster = 10; });
    assert.deepEqual(await mitStatus('grep ' + 'a'.repeat(11) + ' ~/report.txt'), ['grep: pattern too long (maximum 10 characters)', 2]);
    await p.evaluate(() => { RECHERCHE_GRENZE.muster = 1024; RECHERCHE_GRENZE.zustaende = 50; });
    assert.deepEqual(await mitStatus('grep -E "(ab){30}" ~/report.txt'), ['grep: Regular expression too big', 2]);
    await p.evaluate(() => { RECHERCHE_GRENZE.zustaende = 4096; });
    /* teures Muster für Rückverfolgung auf langer Zeile: linear, Ereignisschleife frei */
    await vfs('/home/raizo/lang.txt', 'a'.repeat(200000) + '\n');
    const messung = await p.evaluate(async () => {
      let max = 0, letzt = performance.now();
      const iv = setInterval(() => { const j = performance.now(); max = Math.max(max, j - letzt); letzt = j; }, 10);
      const t0 = performance.now();
      const inp = $('profil-terminal-eingabe');
      inp.value = 'grep -E "(a|aa)*b" ~/lang.txt'; inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await new Promise(ok => { const w = () => (!TERMINAL_ZUSTAND.kette && !TERMINAL_ZUSTAND.dateiLaeuft ? ok() : setTimeout(w, 20)); setTimeout(w, 20); });
      clearInterval(iv);
      return { dauer: performance.now() - t0, maxLuecke: max, status: TERMINAL_ZUSTAND.status };
    });
    console.log('Messung (a|aa)*b auf 200.000 Zeichen: ' + Math.round(messung.dauer) + ' ms, größte Lücke der Ereignisschleife ' + Math.round(messung.maxLuecke) + ' ms');
    assert.equal(messung.status, 1);
    assert.ok(messung.maxLuecke < 250, 'Ereignisschleife blockiert: ' + messung.maxLuecke);
    /* Strg+C während einer langen Suche */
    await vfs('/home/raizo/viel.txt', ('zeile ' + 'x'.repeat(50) + '\n').repeat(40000));
    await inp.fill('grep -c -E "(x|xx)*y" ~/viel.txt'); await inp.press('Enter');
    await p.waitForFunction(() => TERMINAL_ZUSTAND.dateiLaeuft);
    await inp.press('Control+c');
    await warten();
    assert.equal(await status(), 130);
    assert.doesNotMatch((await ausgabe()).split('\n').slice(-2).join('\n'), /^\d+$/m, 'kein Ergebnis nach Abbruch');
    /* Sitzungswechsel: verspätetes Ergebnis wird nicht ausgegeben */
    await inp.fill('grep -c -E "(x|xx)*y" ~/viel.txt'); await inp.press('Enter');
    await p.waitForFunction(() => TERMINAL_ZUSTAND.dateiLaeuft);
    const vorSitzung = await p.evaluate(() => TERMINAL_ZUSTAND.ausgabe.length);
    await p.evaluate(() => { TERMINAL_ZUSTAND.version++; });
    await p.waitForFunction(() => !TERMINAL_ZUSTAND.dateiLaeuft);
    await p.waitForTimeout(200);
    assert.equal(await p.evaluate(() => TERMINAL_ZUSTAND.ausgabe.length), vorSitzung, 'keine Ausgabe in die neue Sitzung: ' + JSON.stringify(await p.evaluate(n => TERMINAL_ZUSTAND.ausgabe.slice(n - 2), vorSitzung)));
    await warten();

    /* ---- F: Tab ---- */
    const tab = async (wert, erwartet, text) => {
      await inp.fill(wert); await inp.press('Tab');
      if (erwartet !== null) await p.waitForFunction(e => $('profil-terminal-eingabe').value === e, erwartet).catch(() => {});
      else await p.waitForTimeout(400);
      assert.equal(await inp.inputValue(), erwartet === null ? wert : erwartet, text || wert);
    };
    await tab('cat ~/report.txt | gre', 'cat ~/report.txt | grep ');
    await tab('echo a | ponx', null, 'nur Pipeline-Befehle nach |');
    await tab('grep -i "Berlin" /intel/dossi', 'grep -i "Berlin" /intel/dossiers/');
    await tab('grep /intel/dossi', null, 'erstes Wort ist das Muster');
    await tab('grep -e x /intel/dossi', 'grep -e x /intel/dossiers/');
    await tab('find /exp', 'find /exports/');
    await tab('find ~ -ty', 'find ~ -type ');
    await tab('find ~ -type ', null, 'drei Arten: Liste');
    await tab('cat ~/report.txt | wc ~/repo', 'cat ~/report.txt | wc ~/report.txt');
    await tab('ls | sort ~/zah', 'ls | sort ~/zahlen');   /* zahlen.txt und zahlen-c.txt: gemeinsamer Anfang */
    await inp.fill('');
    /* offene Auswahlliste unter /exports verfällt, wenn ein Kandidat verwaist (ohne Änderung der Sperrgeneration) */
    const zwei = await p.evaluate(async () => {
      dispatch({ type: 'PIN_ANGELEGT', ll: [52.4, 13.4], name: 'T1', notiz: 'a' }); const a = PROFIL.pins.at(-1).id;
      dispatch({ type: 'PIN_ANGELEGT', ll: [52.4, 13.4], name: 'T2', notiz: 'b' }); const b = PROFIL.pins.at(-1).id;
      await EXPORTE.anlegen('pin', a, null, 'A\n'); await EXPORTE.anlegen('pin', b, null, 'B\n');
      return [a, b];
    });
    let gemeinsam = zwei[0]; while (!zwei[1].startsWith(gemeinsam)) gemeinsam = gemeinsam.slice(0, -1);
    const entwurf = 'cat /exports/pins/' + gemeinsam;
    await inp.fill(entwurf); await inp.press('Tab');
    const liste = p.locator('#profil-terminal-auswahl');
    await liste.waitFor({ state: 'visible' });
    await inp.press('Tab');
    const gewaehlt = await inp.inputValue();
    assert.ok(zwei.some(id => gewaehlt.includes(id)), gewaehlt);
    const generation = await p.evaluate(() => terminalSperrGeneration);
    await p.evaluate(id => { PROFIL.pins.find(x => x.id === id).t = '2026-01-02T00:00:00.000Z'; profilSpeichern(); dispatch({ type: 'PIN_GEAENDERT', id, notiz: 'z' }); }, zwei[0]);
    assert.equal(await p.evaluate(() => terminalSperrGeneration), generation, 'Sperrgeneration unverändert');
    assert.equal(await liste.isVisible(), false, 'Auswahlliste geschlossen');
    assert.equal(await inp.inputValue(), entwurf, 'Entwurf wiederhergestellt');

    assert.deepEqual(seitenfehler, [], seitenfehler.join('; '));
    if (uebersprungen.length) console.log('GNU-Vergleich übersprungen (Werkzeug fehlt): ' + uebersprungen.join(' | '));
    console.log('terminal-paket5-recherche grün');
  } finally { await b.close(); br.py.kill(); }
})().catch(e => { console.error(e); process.exit(1); });
