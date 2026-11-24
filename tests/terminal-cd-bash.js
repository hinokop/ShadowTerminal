/* Phase 6a-2: cd als Bash-Builtin (Referenz: bash 5.2.21, lokal gemessen, Meldungen mit dem Präfix des interaktiven Bash).
   Optionen, "--", mehrere Operanden, cd -, OLDPWD, Heimatverzeichnis, Fehlertexte, Rückgabewerte, Pfadkomponenten (Datei in der Mitte,
   fehlende Komponente vor ".."), strenge Groß-/Kleinschreibung im Archiv. Die Brücke ist gemockt und unterscheidet wie unter Windows
   die Schreibweise NICHT; der Browser muss sie anhand der gelisteten Namen selbst prüfen. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { APP } = require('./_pfad');

(async () => {
  const browser = await chromium.launch();
  try {
    const p = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    p.setDefaultTimeout(15000);
    const errors = [], calls = [];
    p.on('pageerror', e => errors.push(e.message));
    /* Brücke gemockt, verzeichnisfähig und wie unter Windows NICHT zwischen Groß- und Kleinschreibung unterscheidend:
       cd-Operation gelingt für jedes Verzeichnis unabhängig von der Schreibweise, ls liefert die echten Namen. */
    const DATEIEN = ['dossiers/eins.txt', 'dossiers/.intern', 'dossiers/tief/blatt.txt', 'ops/lage.txt', 'wurzel.txt'];
    const dirsVon = pfad => [...new Set(DATEIEN.filter(x => x.startsWith(pfad ? pfad + '/' : '')).map(x => x.slice(pfad ? pfad.length + 1 : 0).split('/')).filter(t => t.length > 1).map(t => t[0]))];
    const echterOrdner = teile => { let pfad = ''; for (const t of teile) { const echt = dirsVon(pfad).find(x => x.toLowerCase() === t.toLowerCase()); if (!echt) return null; pfad = pfad ? pfad + '/' + echt : echt; } return pfad; };
    await p.route(/^https?:/, async route => {
      const req = route.request();
      if (req.url() !== 'http://127.0.0.1:45674/db') return route.abort();
      const d = req.postDataJSON();
      calls.push({ op: d.op, parts: d.parts, hidden: d.hidden });
      if (d.op === 'disconnect') return route.fulfill({ json: { ok: true } });
      const pfad = echterOrdner(d.parts);
      if (d.op === 'cd') return route.fulfill({ json: pfad === null ? { error: 'Datei oder Ordner nicht gefunden' } : { ok: true } });
      if (d.op === 'ls') {
        if (pfad === null) return route.fulfill({ json: { error: 'Datei oder Ordner nicht gefunden' } });
        const pre = pfad ? pfad + '/' : '';
        const namen = new Set(DATEIEN.filter(x => x.startsWith(pre)).map(x => x.slice(pre.length).split('/')[0]));
        const entries = [...namen].filter(n => d.hidden || !n.startsWith('.')).map(n => ({ name: n, dir: DATEIEN.some(x => x.startsWith(pre + n + '/')), bytes: 1, mtime: 1 }))
          .sort((x, y) => (y.dir - x.dir) || x.name.localeCompare(y.name));
        return route.fulfill({ json: { entries, next: null } });
      }
      return route.fulfill({ json: { error: 'Datei oder Ordner nicht gefunden' } });
    });
    await p.goto(APP + '#db=45674.' + 'v'.repeat(43));
    await p.fill('#gate-pw', 'pw-test-123');
    if (await p.isVisible('#gate-pw2')) await p.fill('#gate-pw2', 'pw-test-123');
    await p.click('#gate-go');
    await p.waitForFunction(() => !document.body.classList.contains('locked'));
    const z = await p.evaluate(() => {
      const neu = name => { dispatch({ type: 'DOSSIER_ANGELEGT', name, typ: 'Person' }); return STATE.dossiers.eigene.find(x => x.name === name).id; };
      const zu = neu('Quarzfeld Sperrakte'), frei = neu('Birkenhof Freiakte');
      const pin = (name, dossier) => { dispatch({ type: 'PIN_ANGELEGT', ll: [52.52 + PROFIL.pins.length * 0.002, 13.405], name, dossier }); return PROFIL.pins.at(-1).id; };
      const pinZu = pin('Ankerpunkt Zu', zu), pinWechsel = pin('Ankerpunkt Wechsel'), pinExport = pin('Ankerpunkt Export');
      dispatch({ type: 'OZONE_ANGELEGT', ll: [52.53, 13.40], name: 'Zone Wechsel' });
      const zone = PROFIL.zonen.at(-1).id;
      const si = (id, ort) => { dispatch({ type: 'SICHTUNG_HINZU', id, ort, text: 'am Tor' }); return STATE.dossiers.entitaeten[id].sichtungen.at(-1).id; };
      const siZu = si(zu, '52.5301, 13.4101'), siFrei = si(frei, '52.5302, 13.4102');
      dispatch({ type: 'DOSSIER_SPERREN', id: zu });
      dispatch({ type: 'NAVIGATION', modul: 'profil' }); renderModule();
      return { zu, frei, pinZu, pinWechsel, pinExport, zone, siZu, siFrei };
    });
    const db = await p.evaluate(() => TERMINAL_DB);
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
    const pwd = async () => (await zeilen('pwd'))[0];
    const FEHLER = o => 'bash: cd: -' + o + ': invalid option\ncd: usage: cd [-L|[-P [-e]] [-@]] [dir]';
    const D = '/' + db;
    const fall = async (befehl, ausgabe, code, ort) => {
      assert.equal(await aus(befehl), ausgabe, befehl);
      assert.equal(await rc(), String(code), befehl + ' $?');
      if (ort !== undefined) assert.equal(await pwd(), ort, befehl + ' Arbeitsverzeichnis');
    };
    /* Grundfälle im virtuellen Baum */
    await fall('cd -', 'bash: cd: OLDPWD not set', 1, '/');
    await fall('cd /etc', '', 0, '/etc');
    await fall('cd -', '/', 0, '/');
    await fall('cd -', '/etc', 0, '/etc');
    await fall('cd ""', '', 0, '/etc');
    await fall('cd -', '/etc', 0, '/etc');
    await fall('cd /', '', 0, '/');
    await fall('cd ppp', 'bash: cd: ppp: No such file or directory', 1, '/');
    await fall('cd /etc/ppp/peers/kestrel', 'bash: cd: /etc/ppp/peers/kestrel: Not a directory', 1, '/');
    await fall('cd /etc/ppp/peers/kestrel/..', 'bash: cd: /etc/ppp/peers/kestrel/..: Not a directory', 1, '/');
    await fall('cd nonexist/..', 'bash: cd: nonexist/..: No such file or directory', 1, '/');
    await fall('cd /etc/nope/..', 'bash: cd: /etc/nope/..: No such file or directory', 1, '/');
    await fall('cd etc/ppp/../ppp/', '', 0, '/etc/ppp');
    await fall('cd ../..', '', 0, '/');
    await fall('cd ../../../..', '', 0, '/');
    await fall('cd etc var', 'bash: cd: too many arguments', 1, '/');
    await fall('cd etc --', 'bash: cd: too many arguments', 1, '/');
    await fall('cd - x', 'bash: cd: too many arguments', 1, '/');
    await fall('cd - -x', 'bash: cd: too many arguments', 1, '/');
    /* Optionen */
    for (const o of ['-L', '-P', '-e', '-LP', '-Pe', '-LPe']) { await fall('cd ' + o + ' etc', '', 0, '/etc'); await cmd('cd /'); }
    await fall('cd -- /', '', 0, '/');
    await fall('cd -- -x', 'bash: cd: -x: No such file or directory', 1, '/');
    await fall('cd -x', FEHLER('x'), 2, '/');
    await fall('cd -h', FEHLER('h'), 2, '/');
    await fall('cd -@ etc', FEHLER('@'), 2, '/');
    await fall('cd --x', FEHLER('-'), 2, '/');
    await fall('cd -L-', FEHLER('-'), 2, '/');
    await fall('cd -P -x', FEHLER('x'), 2, '/');
    await fall('cd etc', '', 0, '/etc');
    await fall('cd -L', '', 0, '/');
    await fall('cd --', '', 0, '/');
    await fall('cd', '', 0, '/');
    await fall('cd ~', '', 0, '/');
    await fall('cd -- -', '/', 0, '/');
    /* --help */
    const hilfe = await aus('cd --help');
    assert.ok(hilfe.startsWith('cd: cd [-L|[-P [-e]] [-@]] [dir]\n    Change the shell working directory.'), 'Hilfe Anfang');
    assert.ok(hilfe.endsWith('    -P is used; non-zero otherwise.'), 'Hilfe Ende');
    assert.equal(await rc(), '2');
    assert.equal(await aus('cd --help -x'), hilfe); assert.equal(await aus('cd -x --help'), FEHLER('x'));
    /* OLDPWD: jeder erfolgreiche Wechsel (auch cd .), kein Fehlerfall */
    await cmd('cd /'); await cmd('cd /etc'); await cmd('cd .');
    assert.equal(await aus('cd -'), '/etc', 'cd . setzt OLDPWD auf das aktuelle Verzeichnis');
    await cmd('cd /var'); await cmd('cd /nonexistent'); await cmd('cd -x');
    assert.equal(await aus('cd -'), '/etc', 'Fehler ändern OLDPWD nicht');
    await cmd('cd /');
    /* Archiv, streng mit Schreibweise */
    await fall('cd ' + db, '', 0, D);
    await fall('cd dossiers', '', 0, D + '/dossiers');
    await fall('cd eins.txt', 'bash: cd: eins.txt: Not a directory', 1, D + '/dossiers');
    await fall('cd .intern', 'bash: cd: .intern: Not a directory', 1, D + '/dossiers');
    await fall('cd tief/blatt.txt', 'bash: cd: tief/blatt.txt: Not a directory', 1, D + '/dossiers');
    await fall('cd tief/..', '', 0, D + '/dossiers');
    await fall('cd eins.txt/..', 'bash: cd: eins.txt/..: Not a directory', 1, D + '/dossiers');
    await fall('cd ../ops', '', 0, D + '/ops');
    await fall('cd -', D + '/dossiers', 0, D + '/dossiers');
    await fall('cd ../OPS', 'bash: cd: ../OPS: No such file or directory', 1, D + '/dossiers');
    await fall('cd ../Ops', 'bash: cd: ../Ops: No such file or directory', 1, D + '/dossiers');
    await fall('cd TIEF', 'bash: cd: TIEF: No such file or directory', 1, D + '/dossiers');
    await fall('cd tief', '', 0, D + '/dossiers/tief');
    await fall('cd ' + D + '/DOSSIERS', 'bash: cd: ' + D + '/DOSSIERS: No such file or directory', 1, D + '/dossiers/tief');
    await fall('cd /' + db.toUpperCase(), 'bash: cd: /' + db.toUpperCase() + ': No such file or directory', 1, D + '/dossiers/tief');
    await fall('cd dossi~1', 'bash: cd: dossi~1: No such file or directory', 1, D + '/dossiers/tief');
    await fall('cd nichts', 'bash: cd: nichts: No such file or directory', 1, D + '/dossiers/tief');
    await fall('cd /', '', 0, '/');
    /* cd . im Archiv und cd .. aus dem Archiv prüfen den Zugang weiter über die Brücke (Zugangsprüfung je Ebene) */
    await cmd('cd ' + D + '/dossiers'); calls.length = 0;
    await cmd('cd .');
    assert.ok(calls.some(c => c.op === 'cd' && c.parts.join('/') === 'dossiers'), 'cd . ruft die Zugangsprüfung der Brücke auf');
    calls.length = 0; await cmd('cd ..');
    assert.ok(calls.some(c => c.op === 'cd' && c.parts.length === 0), 'cd .. ruft die Zugangsprüfung der Brücke auf');
    /* Verkettung */
    assert.ok(!(await zeilen('cd -x && echo NEIN')).includes('NEIN'));
    assert.ok((await zeilen('cd -x || echo JA')).includes('JA'));
    assert.ok((await zeilen('cd /etc && echo DA')).includes('DA'));
    /* Sitzungsende über den echten Pfad (terminalSitzungTrennen, von der Abmeldung aufgerufen): Arbeitsverzeichnis und OLDPWD enden mit der
       Sitzung, mit verbundener Brücke (disconnect wird gesendet) und ohne (kein Brückenaufruf). */
    const zustand = () => p.evaluate(() => ({ cwd: terminalArbeitsverzeichnis(), oldpwd: TERMINAL_ZUSTAND.oldpwd }));
    await cmd('cd /etc'); await cmd('cd ' + D + '/dossiers');
    assert.deepEqual(await zustand(), { cwd: D + '/dossiers', oldpwd: '/etc' });
    calls.length = 0;
    await p.evaluate(() => terminalSitzungTrennen());
    assert.deepEqual(await zustand(), { cwd: '/', oldpwd: null }, 'mit Brücke: Zustand zurückgesetzt');
    assert.ok(calls.some(c => c.op === 'disconnect'), 'mit Brücke: disconnect gesendet');
    assert.equal(await aus('cd -'), 'bash: cd: OLDPWD not set', 'nach der Trennung gibt es kein vorheriges Verzeichnis');
    await cmd('cd /etc'); await cmd('cd /var');
    assert.deepEqual(await zustand(), { cwd: '/var', oldpwd: '/etc' });
    await p.evaluate(() => history.replaceState(null, '', location.pathname + location.search));
    assert.equal(await p.evaluate(() => !!terminalBrueckenAdresse()), false, 'Brückenadresse entfernt');
    calls.length = 0;
    await p.evaluate(() => terminalSitzungTrennen());
    assert.deepEqual(await zustand(), { cwd: '/', oldpwd: null }, 'ohne Brücke: Zustand zurückgesetzt');
    assert.equal(calls.length, 0, 'ohne Brücke: kein Brückenaufruf');
    assert.deepEqual(errors, []);
    console.log('OK: cd als Bash-Builtin, strenge Schreibweise im Archiv, Sitzungsende');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
