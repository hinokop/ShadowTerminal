/* Phase 6a-3/6a-4a: ls (Optionen, Operanden, Fehler, Sortierung nach en_US.UTF-8). Die Fälle in FAELLE sind Aufnahmen von GNU coreutils 9.4 (ls, Locale en_US.UTF-8 aus Ubuntu 24.04 / glibc 2.39, Ausgabe ohne TTY, Fehlerzeilen
   vor der Auflistung, [Argumente, Ausgabe, Rückgabewert]) auf einem Baum mit denselben Namen wie die Brücken-Attrappe unten. Abweichungen,
   die diese Etappe bewusst lässt (-a ohne . und .., Reihenfolge der Quelle, Langformat, nicht umgesetzte Optionen), stehen in eigenen Fällen. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { APP } = require('./_pfad');

const FAELLE = [
  [["-z"], "ls: invalid option -- 'z'\nTry 'ls --help' for more information.\n", 2],
  [["--falsch"], "ls: unrecognized option '--falsch'\nTry 'ls --help' for more information.\n", 2],
  [["--a"], "ls: option '--a' is ambiguous; possibilities: '--all' '--almost-all' '--author'\nTry 'ls --help' for more information.\n", 2],
  [["--al"], "ls: option '--al' is ambiguous; possibilities: '--all' '--almost-all'\nTry 'ls --help' for more information.\n", 2],
  [["--c"], "ls: option '--c' is ambiguous; possibilities: '--classify' '--color' '--context'\nTry 'ls --help' for more information.\n", 2],
  [["--all=x"], "ls: option '--all' doesn't allow an argument\nTry 'ls --help' for more information.\n", 2],
  [["--dir", "dossiers"], "ls: option '--dir' is ambiguous; possibilities: '--directory' '--dired'\nTry 'ls --help' for more information.\n", 2],
  [["-d"], ".\n", 0],
  [["-d", "dossiers"], "dossiers\n", 0],
  [["-dF", "dossiers", "datei.txt"], "datei.txt\ndossiers/\n", 0],
  [["-F"], "10.txt\n2.txt\na b.txt\na-b.txt\nalpha.txt\nAlpha.txt\nALPHA.txt\napfel.txt\nÄpfel.txt\ndatei.txt\ndossiers/\nDossiers/\ngross.bin\nklein.bin\nleer/\nmittel.bin\n_unter.txt\nzebra.txt\nZebra.txt\n", 0],
  [["dossiers", "datei.txt"], "datei.txt\n\ndossiers:\neins.txt\n", 0],
  [["dossiers", "leer"], "dossiers:\neins.txt\n\nleer:\n", 0],
  [["datei.txt", "nix"], "ls: cannot access 'nix': No such file or directory\ndatei.txt\n", 2],
  [["nix"], "ls: cannot access 'nix': No such file or directory\n", 2],
  [["nix1", "nix2"], "ls: cannot access 'nix1': No such file or directory\nls: cannot access 'nix2': No such file or directory\n", 2],
  [["leer"], "", 0],
  [["-F", "leer"], "", 0],
  [["datei.txt", "dossiers/eins.txt"], "datei.txt\ndossiers/eins.txt\n", 0],
  [["dossiers/"], "eins.txt\n", 0],
  [["-d", "dossiers/"], "dossiers/\n", 0],
  [["-F", "dossiers/"], "eins.txt\n", 0],
  [["-A"], "10.txt\n2.txt\na b.txt\na-b.txt\nalpha.txt\nAlpha.txt\nALPHA.txt\napfel.txt\nÄpfel.txt\ndatei.txt\ndossiers\nDossiers\n.dot\ngross.bin\nklein.bin\nleer\nmittel.bin\n_unter.txt\n.versteckt\nzebra.txt\nZebra.txt\n.Zeta\n", 0],
  [["--classify", "--directory", "dossiers"], "dossiers/\n", 0],
  [["--human-readable"], "10.txt\n2.txt\na b.txt\na-b.txt\nalpha.txt\nAlpha.txt\nALPHA.txt\napfel.txt\nÄpfel.txt\ndatei.txt\ndossiers\nDossiers\ngross.bin\nklein.bin\nleer\nmittel.bin\n_unter.txt\nzebra.txt\nZebra.txt\n", 0],
  [["-h"], "10.txt\n2.txt\na b.txt\na-b.txt\nalpha.txt\nAlpha.txt\nALPHA.txt\napfel.txt\nÄpfel.txt\ndatei.txt\ndossiers\nDossiers\ngross.bin\nklein.bin\nleer\nmittel.bin\n_unter.txt\nzebra.txt\nZebra.txt\n", 0],
  [["dossiers", "-F"], "eins.txt\n", 0],
  [["--", "dossiers"], "eins.txt\n", 0],
  [["--cl"], "10.txt\n2.txt\na b.txt\na-b.txt\nalpha.txt\nAlpha.txt\nALPHA.txt\napfel.txt\nÄpfel.txt\ndatei.txt\ndossiers/\nDossiers/\ngross.bin\nklein.bin\nleer/\nmittel.bin\n_unter.txt\nzebra.txt\nZebra.txt\n", 0],
  [["--h"], "ls: option '--h' is ambiguous; possibilities: '--human-readable' '--hide-control-chars' '--hide' '--hyperlink' '--help'\nTry 'ls --help' for more information.\n", 2],
  [["datei.txt/"], "ls: cannot access 'datei.txt/': Not a directory\n", 2],
  [["dossiers/eins.txt/x"], "ls: cannot access 'dossiers/eins.txt/x': Not a directory\n", 2],
  [[""], "ls: cannot access '': No such file or directory\n", 2],
  [["-d", ""], "ls: cannot access '': No such file or directory\n", 2],
  [["-d", "."], ".\n", 0],
  [["./dossiers"], "eins.txt\n", 0],
  [["-dF", "dossiers/", "datei.txt/"], "ls: cannot access 'datei.txt/': Not a directory\ndossiers//\n", 2],
  [["--classify=never"], "10.txt\n2.txt\na b.txt\na-b.txt\nalpha.txt\nAlpha.txt\nALPHA.txt\napfel.txt\nÄpfel.txt\ndatei.txt\ndossiers\nDossiers\ngross.bin\nklein.bin\nleer\nmittel.bin\n_unter.txt\nzebra.txt\nZebra.txt\n", 0],
  [["--classify=auto"], "10.txt\n2.txt\na b.txt\na-b.txt\nalpha.txt\nAlpha.txt\nALPHA.txt\napfel.txt\nÄpfel.txt\ndatei.txt\ndossiers\nDossiers\ngross.bin\nklein.bin\nleer\nmittel.bin\n_unter.txt\nzebra.txt\nZebra.txt\n", 0],
  [["--classify=always", "-d", "dossiers"], "dossiers/\n", 0],
  [["--classify=x"], "ls: invalid argument ‘x’ for ‘--classify’\nValid arguments are:\n  - ‘always’, ‘yes’, ‘force’\n  - ‘never’, ‘no’, ‘none’\n  - ‘auto’, ‘tty’, ‘if-tty’\nTry 'ls --help' for more information.\n", 1],
  [["--classify="], "ls: ambiguous argument ‘’ for ‘--classify’\nValid arguments are:\n  - ‘always’, ‘yes’, ‘force’\n  - ‘never’, ‘no’, ‘none’\n  - ‘auto’, ‘tty’, ‘if-tty’\nTry 'ls --help' for more information.\n", 1],
  [["--all="], "ls: option '--all' doesn't allow an argument\nTry 'ls --help' for more information.\n", 2],
  [["-FF", "dossiers"], "eins.txt\n", 0],
  [["-1"], "10.txt\n2.txt\na b.txt\na-b.txt\nalpha.txt\nAlpha.txt\nALPHA.txt\napfel.txt\nÄpfel.txt\ndatei.txt\ndossiers\nDossiers\ngross.bin\nklein.bin\nleer\nmittel.bin\n_unter.txt\nzebra.txt\nZebra.txt\n", 0],
  [["-dd", "dossiers"], "dossiers\n", 0],
  [["dossiers", "leer", "nix"], "ls: cannot access 'nix': No such file or directory\ndossiers:\neins.txt\n\nleer:\n", 2],
  [["-hF", "--", "dossiers"], "eins.txt\n", 0],
  [["-l=x"], "ls: invalid option -- '='\nTry 'ls --help' for more information.\n", 2],
  [["--al=x"], "ls: option '--al=x' is ambiguous; possibilities: '--all' '--almost-all'\nTry 'ls --help' for more information.\n", 2],
  [["--falsch=x"], "ls: unrecognized option '--falsch=x'\nTry 'ls --help' for more information.\n", 2],
  [["--help=x"], "ls: option '--help' doesn't allow an argument\nTry 'ls --help' for more information.\n", 2],
  [["--cla=never"], "10.txt\n2.txt\na b.txt\na-b.txt\nalpha.txt\nAlpha.txt\nALPHA.txt\napfel.txt\nÄpfel.txt\ndatei.txt\ndossiers\nDossiers\ngross.bin\nklein.bin\nleer\nmittel.bin\n_unter.txt\nzebra.txt\nZebra.txt\n", 0],
  [["-"], "ls: cannot access '-': No such file or directory\n", 2],
  [["--", "-x"], "ls: cannot access '-x': No such file or directory\n", 2],
  [["-A", "dossiers", "-d"], "dossiers\n", 0],
  [["dossiers", "-1", "leer"], "dossiers:\neins.txt\n\nleer:\n", 0],
  [["-z", "--help"], "ls: invalid option -- 'z'\nTry 'ls --help' for more information.\n", 2],
  [["dossiers/../leer"], "", 0],
  [["dossiers/./"], "eins.txt\n", 0],
  [["-d", "dossiers/.."], "dossiers/..\n", 0],
  [["--classify", "datei.txt", "leer"], "datei.txt\n\nleer:\n", 0],
  [["-a"], ".\n..\n10.txt\n2.txt\na b.txt\na-b.txt\nalpha.txt\nAlpha.txt\nALPHA.txt\napfel.txt\nÄpfel.txt\ndatei.txt\ndossiers\nDossiers\n.dot\ngross.bin\nklein.bin\nleer\nmittel.bin\n_unter.txt\n.versteckt\nzebra.txt\nZebra.txt\n.Zeta\n", 0],
  [["-aF"], "./\n../\n10.txt\n2.txt\na b.txt\na-b.txt\nalpha.txt\nAlpha.txt\nALPHA.txt\napfel.txt\nÄpfel.txt\ndatei.txt\ndossiers/\nDossiers/\n.dot\ngross.bin\nklein.bin\nleer/\nmittel.bin\n_unter.txt\n.versteckt/\nzebra.txt\nZebra.txt\n.Zeta\n", 0],
  [["-a", "dossiers"], ".\n..\neins.txt\n", 0],
  [["-A", "Dossiers"], "zwei.txt\n", 0],
  [["-a", "leer"], ".\n..\n", 0],
  [["-d", "zebra.txt", "Zebra.txt", "dossiers", "Dossiers", "a b.txt"], "a b.txt\ndossiers\nDossiers\nzebra.txt\nZebra.txt\n", 0],
  [["Dossiers", "dossiers", "leer"], "dossiers:\neins.txt\n\nDossiers:\nzwei.txt\n\nleer:\n", 0],
  [["zebra.txt", "Zebra.txt", "alpha.txt", "Alpha.txt", "ALPHA.txt", "apfel.txt", "Äpfel.txt"], "alpha.txt\nAlpha.txt\nALPHA.txt\napfel.txt\nÄpfel.txt\nzebra.txt\nZebra.txt\n", 0],
  [["-A", "-d", ".dot", ".Zeta", "alpha.txt", "_unter.txt", "a-b.txt", "a b.txt"], "a b.txt\na-b.txt\nalpha.txt\n.dot\n_unter.txt\n.Zeta\n", 0],
  [["10.txt", "2.txt", "a b.txt", "a-b.txt", "_unter.txt"], "10.txt\n2.txt\na b.txt\na-b.txt\n_unter.txt\n", 0],
  [["--classify=al"], "10.txt\n2.txt\na b.txt\na-b.txt\nalpha.txt\nAlpha.txt\nALPHA.txt\napfel.txt\nÄpfel.txt\ndatei.txt\ndossiers/\nDossiers/\ngross.bin\nklein.bin\nleer/\nmittel.bin\n_unter.txt\nzebra.txt\nZebra.txt\n", 0],
  [["--classify=a"], "ls: ambiguous argument ‘a’ for ‘--classify’\nValid arguments are:\n  - ‘always’, ‘yes’, ‘force’\n  - ‘never’, ‘no’, ‘none’\n  - ‘auto’, ‘tty’, ‘if-tty’\nTry 'ls --help' for more information.\n", 1],
  [["--classify=n"], "10.txt\n2.txt\na b.txt\na-b.txt\nalpha.txt\nAlpha.txt\nALPHA.txt\napfel.txt\nÄpfel.txt\ndatei.txt\ndossiers\nDossiers\ngross.bin\nklein.bin\nleer\nmittel.bin\n_unter.txt\nzebra.txt\nZebra.txt\n", 0],
  [["--classify=no"], "10.txt\n2.txt\na b.txt\na-b.txt\nalpha.txt\nAlpha.txt\nALPHA.txt\napfel.txt\nÄpfel.txt\ndatei.txt\ndossiers\nDossiers\ngross.bin\nklein.bin\nleer\nmittel.bin\n_unter.txt\nzebra.txt\nZebra.txt\n", 0],
  [["--classify=ti"], "ls: invalid argument ‘ti’ for ‘--classify’\nValid arguments are:\n  - ‘always’, ‘yes’, ‘force’\n  - ‘never’, ‘no’, ‘none’\n  - ‘auto’, ‘tty’, ‘if-tty’\nTry 'ls --help' for more information.\n", 1],
  [["--classify=ALWAYS"], "ls: invalid argument ‘ALWAYS’ for ‘--classify’\nValid arguments are:\n  - ‘always’, ‘yes’, ‘force’\n  - ‘never’, ‘no’, ‘none’\n  - ‘auto’, ‘tty’, ‘if-tty’\nTry 'ls --help' for more information.\n", 1],
  [["--classify=it's"], "ls: invalid argument ‘it's’ for ‘--classify’\nValid arguments are:\n  - ‘always’, ‘yes’, ‘force’\n  - ‘never’, ‘no’, ‘none’\n  - ‘auto’, ‘tty’, ‘if-tty’\nTry 'ls --help' for more information.\n", 1],
  [["--classify=a\\b"], "ls: invalid argument ‘a\\\\b’ for ‘--classify’\nValid arguments are:\n  - ‘always’, ‘yes’, ‘force’\n  - ‘never’, ‘no’, ‘none’\n  - ‘auto’, ‘tty’, ‘if-tty’\nTry 'ls --help' for more information.\n", 1],
  [["--classify=y", "-d", "dossiers"], "dossiers/\n", 0],
  [["--classify=if"], "10.txt\n2.txt\na b.txt\na-b.txt\nalpha.txt\nAlpha.txt\nALPHA.txt\napfel.txt\nÄpfel.txt\ndatei.txt\ndossiers\nDossiers\ngross.bin\nklein.bin\nleer\nmittel.bin\n_unter.txt\nzebra.txt\nZebra.txt\n", 0],
  [["-dF", "Dossiers", "dossiers", "datei.txt", "Zebra.txt"], "datei.txt\ndossiers/\nDossiers/\nZebra.txt\n", 0],
  [["nix", "Dossiers", "dossiers"], "ls: cannot access 'nix': No such file or directory\ndossiers:\neins.txt\n\nDossiers:\nzwei.txt\n", 2]
];

(async () => {
  const browser = await chromium.launch();
  try {
    const p = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    p.setDefaultTimeout(15000);
    const errors = [];
    p.on('pageerror', e => errors.push(e.message));
    /* Brücke gemockt: Baum mit Dateien (Pfad -> Größe) und leeren Verzeichnissen; Namen mit Punkt nur bei hidden */
    const DATEIEN = { 'dossiers/eins.txt': 2, 'Dossiers/zwei.txt': 3, 'datei.txt': 0, 'alpha.txt': 1025, 'Alpha.txt': 1, 'ALPHA.txt': 1, '.dot': 0, '.Zeta': 0, '.versteckt/x': 2, 'gross.bin': 1048575, 'klein.bin': 1023, 'mittel.bin': 10240,
      'zebra.txt': 1, 'Zebra.txt': 1, 'Äpfel.txt': 1, 'apfel.txt': 1, '10.txt': 1, '2.txt': 1, 'a b.txt': 1, 'a-b.txt': 1, '_unter.txt': 1 };
    const VERZ = ['dossiers', 'Dossiers', 'leer', '.versteckt'];
    const istDir = pfad => pfad === '' || VERZ.includes(pfad);
    await p.route(/^https?:/, async route => {
      const req = route.request();
      if (req.url() !== 'http://127.0.0.1:45674/db') return route.abort();
      const d = req.postDataJSON(), pfad = d.parts.join('/');
      if (d.op === 'disconnect') return route.fulfill({ json: { ok: true } });
      if (d.op === 'cd') return route.fulfill({ json: istDir(pfad) ? { ok: true } : { error: 'Datei oder Ordner nicht gefunden' } });
      if (d.op === 'ls') {
        if (!istDir(pfad)) return route.fulfill({ json: { error: 'Datei oder Ordner nicht gefunden' } });
        const pre = pfad ? pfad + '/' : '', namen = new Map();
        Object.keys(DATEIEN).filter(x => x.startsWith(pre)).forEach(x => { const r = x.slice(pre.length).split('/'); namen.set(r[0], r.length > 1 ? { dir: true, bytes: 0 } : { dir: false, bytes: DATEIEN[x] }); });
        VERZ.filter(x => x.startsWith(pre) && !x.slice(pre.length).includes('/') && x !== pfad).forEach(x => namen.set(x.slice(pre.length), { dir: true, bytes: 0 }));
        const entries = [...namen].map(([name, e]) => Object.assign({ name, mtime: 1 }, e)).filter(e => d.hidden || !e.name.startsWith('.')).sort((a, b) => a.name < b.name ? 1 : -1);   /* absichtlich absteigend: die Reihenfolge der Quelle darf die Anzeige nicht bestimmen */
        return route.fulfill({ json: { entries, next: null } });
      }
      return route.fulfill({ json: { error: 'Datei oder Ordner nicht gefunden' } });
    });
    await p.goto(APP + '#db=45674.' + 'v'.repeat(43));
    await p.fill('#gate-pw', 'pw-test-123');
    if (await p.isVisible('#gate-pw2')) await p.fill('#gate-pw2', 'pw-test-123');
    await p.click('#gate-go');
    await p.waitForFunction(() => !document.body.classList.contains('locked'));
    const db = await p.evaluate(() => TERMINAL_DB);
    await p.evaluate(() => dispatch({ type: 'NAVIGATION', modul: 'profil' }));
    await p.evaluate(() => renderModule());
    await p.click('#profil-terminal-oeffnen');
    const inp = p.locator('#profil-terminal-eingabe'), out = p.locator('#profil-terminal-ausgabe');
    const cmd = async line => {
      const start = await out.textContent();
      await inp.fill(line); await inp.press('Enter');
      await p.waitForFunction(() => !TERMINAL_ZUSTAND.kette);
      return (await out.textContent()).slice(start.length);
    };
    const zeilen = async line => { const t = (await cmd(line)).split('\n'); return t.slice(t.findIndex(x => x.startsWith('raizo@terminal:')) + 1); };
    const aus = async line => (await zeilen(line)).join('\n');
    const rc = async () => (await zeilen('echo $?'))[0];
    const q = a => /^[A-Za-z0-9_.\/=,:+-]+$/.test(a) ? a : "'" + a.replace(/'/g, "'\\''") + "'";
    await cmd('cd /' + db);

    /* A. Aufnahmen von GNU ls 9.4 */
    for (const [args, ausgabe, code] of FAELLE) {
      const befehl = 'ls ' + args.map(q).join(' ');
      assert.equal(await aus(befehl), ausgabe.replace(/\n$/, ''), befehl);
      assert.equal(await rc(), String(code), befehl + ' $?');
    }

    /* B. Eigene Fälle dieser Etappe */
    const alle = await aus('ls -a'), fastAlle = await aus('ls -A');
    assert.deepEqual(alle.split('\n').slice(0, 2), ['.', '..'], '-a: . und .. zuerst (en_US.UTF-8: Interpunktion ignoriert, "." vor "..")');
    assert.equal(alle.split('\n').slice(2).join('\n'), fastAlle, '-a = -A plus . und ..');
    assert.ok(!fastAlle.split('\n').includes('.') && !fastAlle.split('\n').includes('..'), '-A ohne . und ..');
    assert.equal(await aus('ls -A -a'), await aus('ls -a'), 'letzte der Optionen -a/-A gilt');
    assert.equal(await aus('ls -a -A'), await aus('ls -A'), 'letzte der Optionen -a/-A gilt');
    assert.equal((await aus('ls --all --classify')).split('\n').slice(0, 3).join('|'), './|../|10.txt', '--all --classify: Verzeichnisse mit Schrägstrich, auch . und ..');
    assert.equal(await aus('ls -ad'), '.', '-d ohne Operand: der Punkt');
    assert.equal(await aus('ls --help').then(t => t.split('\n')[0]), 'Usage: ls [OPTION]... [FILE]...');
    assert.equal(await rc(), '0');
    assert.equal(await aus('ls --he datei.txt').then(t => t.split('\n')[0]), 'Usage: ls [OPTION]... [FILE]...', 'eindeutige Abkürzung, Operanden ignoriert');
    assert.equal(await aus('ls --help -z').then(t => t.split('\n')[0]), 'Usage: ls [OPTION]... [FILE]...', '--help gilt sofort, vor späteren Fehlern');
    /* nicht umgesetzte, aber in ls 9.4 gültige Optionen: Meldung wie bei unbekannten (Entscheidung des Plans) */
    assert.equal(await aus('ls -q'), "ls: invalid option -- 'q'\nTry 'ls --help' for more information.");
    assert.equal(await rc(), '2');
    assert.equal(await aus('ls --color'), "ls: unrecognized option '--color'\nTry 'ls --help' for more information.");
    assert.equal(await aus('ls --co'), "ls: option '--co' is ambiguous; possibilities: '--color' '--context'\nTry 'ls --help' for more information.", 'Mehrdeutigkeit nutzt die vollständige Optionsliste');
    /* Langformat (bis 6a-4 das bisherige Format), -h, -d, -F und Operanden mit Option */
    assert.equal(await aus('ls -l dossiers'), '-r--         2  01.01.1970 00:00:01Z  eins.txt');
    assert.equal(await aus('ls -lh gross.bin klein.bin mittel.bin alpha.txt'),
      [['alpha.txt', '1.1K'], ['gross.bin', '1.0M'], ['klein.bin', '1023'], ['mittel.bin', '10K']].map(([n, g]) => '-r--' + g.padStart(10) + '  01.01.1970 00:00:01Z  ' + n).join('\n'), 'Operanden sortiert');
    assert.equal(await aus('ls -ld dossiers'), 'dr-x         0  01.01.1970 00:00:01Z  dossiers');
    assert.equal((await aus('ls -lF .')).split('\n').filter(x => x.endsWith('dossiers/') || x.endsWith('leer/')).length, 2, '-F kennzeichnet Verzeichnisse auch im Langformat');
    assert.equal(await aus('ls -1 -l dossiers'), await aus('ls -l dossiers'), '-l nach -1 gilt');
    assert.equal(await aus('ls -l -1 dossiers'), await aus('ls -l dossiers'), '-1 hebt -l nicht auf (ls 9.4 gemessen: -l -1 bleibt Langformat, ebenso -1 -l)');
    assert.equal(await aus('ls dossiers -l'), await aus('ls -l dossiers'), 'Optionen auch hinter Operanden');
    /* Operand in der virtuellen Ebene, absolute Pfade, Wurzel */
    assert.equal(await aus('ls /etc /var'), '/etc:\nchatscripts\nppp\n\n/var:\ncache\nlog');
    assert.equal(await aus('ls /etc/ppp/peers/kestrel'), '/etc/ppp/peers/kestrel');
    assert.equal(await aus('ls /nonexistent'), "ls: cannot access '/nonexistent': No such file or directory");
    assert.equal(await rc(), '2');
    assert.equal(await aus('ls "it\'s"'), "ls: cannot access 'it'\\''s': No such file or directory", 'Apostroph in der Meldung wie bei ls maskiert');
    assert.equal(await aus('ls -d /'), '/');
    assert.equal(await aus('ls -F /'), 'etc/\n' + db + '/\nvar/', 'Wurzel sortiert (en_US.UTF-8): etc, pgcl-..., var');
    assert.equal(await aus('ls /' + db + '/dossiers/eins.txt'), '/' + db + '/dossiers/eins.txt');
    assert.equal(await aus('ls /' + db + '/DOSSIERS'), "ls: cannot access '/" + db + "/DOSSIERS': No such file or directory", 'Groß-/Kleinschreibung im Archiv streng');

    /* Sortierung ändert nichts an der Namensauflösung: Pfade bleiben streng (Groß-/Kleinschreibung, Bytegleichheit) */
    assert.equal(await aus('ls zebra.txt ZEBRA.txt Zebra.txt'), "ls: cannot access 'ZEBRA.txt': No such file or directory\nzebra.txt\nZebra.txt");
    assert.equal(await rc(), '2');
    assert.equal(await aus('ls -d apfel.txt Apfel.txt'), "ls: cannot access 'Apfel.txt': No such file or directory\napfel.txt", 'Apfel.txt ist nicht apfel.txt');
    assert.equal(await aus('ls -d \u00c4pfel.txt'), '\u00c4pfel.txt');
    assert.equal(await aus('ls -d \u00e4pfel.txt'), "ls: cannot access '\u00e4pfel.txt': No such file or directory", 'Umlaut: Groß-/Kleinschreibung streng');

    /* C. -h gegen ls 9.4 (gemessen) */
    const groessen = await p.evaluate(() => [0, 1, 1023, 1024, 1025, 1536, 2047, 2048, 10239, 10240, 10241, 102400, 1048575, 1048576, 1048577, 1073741824, 1073741825, 5000000000].map(terminalLsGroesse));
    assert.deepEqual(groessen, ['0', '1', '1023', '1.0K', '1.1K', '1.5K', '2.0K', '2.0K', '10K', '10K', '11K', '100K', '1.0M', '1.0M', '1.1M', '1.0G', '1.1G', '4.7G']);

    assert.deepEqual(errors, []);
    console.log('OK: ls 6a-4a (' + FAELLE.length + ' Aufnahmen von GNU ls 9.4 unter en_US.UTF-8, ' + 'Sortierung, Optionen, Operanden, Fehler)');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
