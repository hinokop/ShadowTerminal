/* Phase 6a-0: Dateisystem-Schnittstelle (TERMINAL_FS) und Befehlskontext. Direkte Aufrufe von resolve, stat, readdir, readFile und
   writeFile gegen beide Adapter (virtueller Baum, gemockte Archivbrücke), der Haken "sichtbar", sowie Kontext, Exit-Code und getrennte
   Ausgabe von terminalBefehlLauf. */
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
    /* Dateisystem der Brücke: Pfad (echter Name) -> Text; Kurznamen als Alias */
    const dateien = new Map(), alias = new Map();
    const schluessel = teile => teile.join('/').replace(/[. ]+(?=\/|$)/g, '').toLowerCase();
    const finden = teile => {
      const k = schluessel(teile), echt = alias.get(k) || [...dateien.keys()].find(x => x.toLowerCase() === k);
      return echt ? { pfad: echt, text: dateien.get(echt) } : null;
    };
    await p.route(/^https?:/, async route => {
      const req = route.request();
      if (req.url() !== 'http://127.0.0.1:45674/db') return route.abort();
      const d = req.postDataJSON();
      calls.push({ op: d.op, parts: d.parts, offset: d.offset });
      if (d.op === 'cd') return route.fulfill({ json: { ok: true } });
      if (d.op === 'ls') {
        const ordner = d.parts.join('/').toLowerCase();
        /* Verzeichnisse ergeben sich aus den Pfaden (die Brücke führt sie als dir: true); nötig, weil cd Namen streng im Elternverzeichnis prüft */
        const pre = ordner ? ordner + '/' : '', rest = [...dateien.keys()].filter(x => x.toLowerCase().startsWith(pre));
        const verz = [...new Set(rest.filter(x => x.slice(pre.length).includes('/')).map(x => x.slice(pre.length).split('/')[0]))].map(n => ({ name: n, dir: true, bytes: 0, mtime: 1 }));
        const alle = rest.filter(x => !x.slice(pre.length).includes('/'))
          .map(x => ({ name: x.slice(pre.length), dir: false, bytes: dateien.get(x).length, mtime: 1 })).concat(verz)
          .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()) || a.name.localeCompare(b.name));
        const offset = d.offset || 0, limit = d.limit || 500;
        return route.fulfill({ json: { entries: alle.slice(offset, offset + limit), next: offset + limit < alle.length ? offset + limit : null } });
      }
      if (d.parts.some(x => x.includes(':'))) return route.fulfill({ json: { error: 'Permission denied' } });
      const f = finden(d.parts);
      if (!f) return route.fulfill({ json: { error: 'Datei oder Ordner nicht gefunden' } });
      const name = f.pfad.split('/').at(-1);
      if (d.op === 'send') return route.fulfill({ json: { name, file: name, bytes: f.text.length } });
      if (d.op === 'wget') return route.fulfill({ json: { name, file: name, data: Buffer.from(f.text).toString('base64'), endpoint: 'x' } });
      return route.fulfill({ json: { text: f.text, file: name } });
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
    const put = (pfad, text) => { dateien.set(pfad, text); };
    put('ops/lageblatt-' + z.pinZu + '.txt', 'TOKEN_PIN_ZU\n');
    put('ops/sichtung-' + z.zu + '-' + z.siZu + '.txt', 'TOKEN_SICHTUNG_ZU\n');
    put('ops/sichtung-' + z.frei + '-' + z.siFrei + '.txt', 'TOKEN_SICHTUNG_FREI\n');
    put('ops/unrelated.txt', 'TOKEN_NEUTRAL\n');
    const db = await p.evaluate(() => TERMINAL_DB);
    await p.click('#profil-terminal-oeffnen');
    const inp = p.locator('#profil-terminal-eingabe'), out = p.locator('#profil-terminal-ausgabe');
    const cmd = async line => {
      const start = await out.textContent();
      await inp.fill(line); await inp.press('Enter');
      await p.waitForFunction(() => !TERMINAL_ZUSTAND.kette);
      return (await out.textContent()).slice(start.length);
    };
    const r = (fn, ...a) => p.evaluate(([f, a]) => { const x = f.split('.'); return TERMINAL_FS[x[0]](...a); }, [fn, a]);
    /* resolve */
    assert.deepEqual(await r('resolve', '/etc/ppp'), ['etc', 'ppp']);
    assert.deepEqual(await r('resolve', '/etc/../var'), ['var']);
    assert.equal(await r('resolve', 'a\\b'), null, 'Rückwärtsschrägstrich unzulässig');
    /* stat */
    assert.deepEqual(await r('stat', []), { adapter: 'virtuell', typ: 'dir' });
    /* Paket 3: /etc liegt im VFS (Anbieter vfs, mit Größe, Zeit und Rechten) */
    const stPeer = await r('stat', ['etc', 'ppp', 'peers', 'kestrel']);
    assert.deepEqual({ adapter: stPeer.adapter, typ: stPeer.typ, modus: stPeer.eintrag.modus }, { adapter: 'vfs', typ: 'file', modus: 0o644 });
    assert.deepEqual(await r('stat', ['usr', 'share', 'ppp']), { adapter: 'paket', typ: 'dir', bytes: 4096, mtime: 1725019324, eintrag: { name: 'ppp', dir: true, bytes: 4096, mtime: 1725019324, modus: 0o755 } });
    assert.deepEqual(await r('stat', ['nichts']), { fehler: 'ENOENT' });
    assert.deepEqual(await r('stat', [db, 'ops']), { adapter: 'archiv', typ: null }, 'ohne Prüfung bleibt die Art im Archiv unbekannt');
    const stOps = await r('stat', [db, 'ops'], { pruefen: true });
    assert.deepEqual({ adapter: stOps.adapter, typ: stOps.typ, name: stOps.eintrag && stOps.eintrag.name, dir: stOps.eintrag && stOps.eintrag.dir }, { adapter: 'archiv', typ: 'dir', name: 'ops', dir: true }, 'stat mit Prüfung liefert zusätzlich den Eintrag der Quelle (6a-3, für ls -l)');
    /* readdir */
    const wurzel = await r('readdir', []);
    assert.deepEqual(wurzel.eintraege.map(x => x.name), ['etc', 'home', 'intel', 'tmp', 'usr', 'var', db]);
    assert.ok(wurzel.eintraege.every(x => x.dir));
    assert.deepEqual((await r('readdir', ['var', 'log'])).eintraege, [{ name: 'syslog', dir: false }]);
    const ops = await r('readdir', [db, 'ops']);
    assert.ok(ops.eintraege.some(x => x.name === 'unrelated.txt' && x.dir === false && x.bytes > 0));
    assert.deepEqual(await r('readdir', ['nichts']), { fehler: 'ENOENT' });
    /* Haken: Variante B würde hier ansetzen; der Haken wirkt auf readdir */
    await p.evaluate(() => { window.__sichtbar = TERMINAL_FS.sichtbar; TERMINAL_FS.sichtbar = seg => !/unrelated/.test(seg.at(-1)); });
    assert.ok(!(await r('readdir', [db, 'ops'])).eintraege.some(x => x.name === 'unrelated.txt'), 'Haken filtert');
    await p.evaluate(() => { TERMINAL_FS.sichtbar = window.__sichtbar; });
    assert.ok((await r('readdir', [db, 'ops'])).eintraege.some(x => x.name === 'unrelated.txt'), 'Haken zurückgesetzt');
    /* readFile / writeFile */
    assert.match((await r('readFile', ['etc', 'ppp', 'peers', 'kestrel'])).text, /connect/);
    assert.deepEqual(await r('readFile', ['etc']), { fehler: 'EISDIR' });
    assert.deepEqual(await r('readFile', ['var', 'log', 'syslog']), { fehler: 'ENOSYS' });
    assert.deepEqual(await r('readFile', ['nichts']), { fehler: 'ENOENT' });
    assert.equal((await r('readFile', [db, 'ops', 'unrelated.txt'])).text, 'TOKEN_NEUTRAL\n');
    assert.deepEqual(await r('readFile', [db, 'ops', 'lageblatt-' + z.pinZu + '.txt']), { fehler: 'Permission denied' }, 'gesperrter Inhalt bleibt geschützt');
    assert.deepEqual(await r('writeFile', ['etc', 'x'], 'y'), { fehler: 'EACCES' }, 'Paket 1: nur das VFS ist beschreibbar, alle anderen Anbieter weisen ab');
    assert.deepEqual(await r('writeFile', [db, 'x'], 'y'), { fehler: 'EACCES' });
    /* Befehlskontext, Exit-Code, getrennte Ausgabe */
    const lauf = await p.evaluate(async () => {
      let ctx = null;
      const code = await terminalBefehlLauf(async c => { ctx = c; return { code: 3, stdout: ['AUS_EINS'], stderr: ['FEHLER_EINS'] }; }, ['a', 'b'], 'a b', TERMINAL_ZUSTAND.version);
      return { code, schluessel: Object.keys(ctx).sort(), args: ctx.args, arg: ctx.arg, cwd: ctx.cwd, env: ctx.env, fsOps: Object.keys(ctx.fs).sort() };
    });
    assert.equal(lauf.code, 3);
    assert.deepEqual(lauf.schluessel, ['arg', 'args', 'cwd', 'env', 'fs']);
    assert.deepEqual(lauf.args, ['a', 'b']);
    assert.equal(lauf.cwd, '/home/raizo', 'Startverzeichnis seit Paket 1');
    assert.deepEqual(lauf.env, {});
    assert.deepEqual(lauf.fsOps, ['anbieter', 'entfernen', 'kopieren', 'mkdir', 'readFile', 'readdir', 'readlink', 'resolve', 'schreiben', 'sichtbar', 'stat', 'umbenennen', 'writeFile']);
    const text = await out.textContent();
    assert.ok(text.indexOf('AUS_EINS') > -1 && text.indexOf('FEHLER_EINS') > text.indexOf('AUS_EINS'), 'stdout vor stderr');
    /* Arbeitsverzeichnis wird nur über das Ergebnis gesetzt */
    await p.evaluate(() => terminalBefehlLauf(async () => ({ code: 0, stdout: [], stderr: [], cwd: { ort: null, virtuellerOrt: ['etc'] } }), [], '', TERMINAL_ZUSTAND.version));
    assert.equal(await p.evaluate(() => terminalArbeitsverzeichnis()), '/etc');
    /* veraltete Version: kein Ergebnis wird angewendet */
    await p.evaluate(() => terminalBefehlLauf(async () => ({ code: 0, stdout: ['NIE'], stderr: [], cwd: { ort: null, virtuellerOrt: ['var'] } }), [], '', -1));
    assert.equal(await p.evaluate(() => terminalArbeitsverzeichnis()), '/etc');
    assert.ok(!(await out.textContent()).includes('NIE'));
    /* Echte Befehlsaufrufe: ctx.args und ctx.arg kommen aus der Shell (Befehlsfunktionen werden zum Mitschnitt umhüllt) */
    await cmd('cd /');
    await p.evaluate(() => {
      window.__ctx = [];
      for (const n of ['terminalBefehlCd', 'terminalBefehlLs']) { const orig = window[n]; window[n] = c => { window.__ctx.push({ n, args: c.args, arg: c.arg, cwd: c.cwd }); return orig(c); }; }
    });
    await cmd('cd /etc'); await cmd('ls -la'); await cmd('ls "/etc/ppp"'); await cmd('cd /'); await cmd('ls /etc /var');
    const ctxs = await p.evaluate(() => window.__ctx);
    assert.deepEqual(ctxs.map(c => [c.n, c.args]), [
      ['terminalBefehlCd', ['/etc']], ['terminalBefehlLs', ['-la']], ['terminalBefehlLs', ['/etc/ppp']],
      ['terminalBefehlCd', ['/']], ['terminalBefehlLs', ['/etc', '/var']]], 'tatsächliche args aus der Shell');
    assert.deepEqual(ctxs.slice(0).map(c => c.cwd), ['/', '/etc', '/etc', '/etc', '/'], 'cwd des Aufrufs');
    assert.equal(ctxs[2].arg, '/etc/ppp', 'arg: Anführungszeichen der Shell sind bereits aufgelöst');
    /* Explizites cwd: weicht vom globalen Arbeitsverzeichnis (/) ab und bestimmt die Auflösung relativer Pfade */
    assert.equal(await p.evaluate(() => terminalArbeitsverzeichnis()), '/');
    assert.deepEqual(await r('resolve', 'ppp', { cwd: '/etc' }), ['etc', 'ppp']);
    assert.deepEqual(await r('resolve', '..', { cwd: '/etc/ppp' }), ['etc']);
    assert.deepEqual(await r('resolve', '/var', { cwd: '/etc' }), ['var'], 'absolut ignoriert cwd');
    assert.deepEqual(await r('resolve', 'ops', { cwd: '/' + db }), [db, 'ops']);
    assert.deepEqual(await r('resolve', 'ppp'), ['ppp'], 'ohne cwd gilt der globale Zustand (hier /)');
    const direkt = await p.evaluate(async () => {
      const ctx = arg => ({ args: [arg], arg, cwd: '/etc/ppp', env: {}, fs: TERMINAL_FS });
      return { ls: await terminalBefehlLs(ctx('peers')), lsLeer: await terminalBefehlLs(ctx('-l')), cd: await terminalBefehlCd(ctx('peers')),
        cdPunkt: await terminalBefehlCd(ctx('..')), global: terminalArbeitsverzeichnis() };
    });
    assert.deepEqual(direkt.ls.stdout, ['kestrel'], 'ls löst relativ zum Kontext-cwd auf');
    /* Paket 3: /etc liegt im VFS, -l zeigt daher das Langformat */
    assert.match(direkt.lsLeer.stdout.join('\n'), /^drwxr-xr-x +4096  \d\d\.\d\d\.\d{4} \d\d:\d\d:\d\dZ  peers$/, 'ls ohne Operand listet das Kontext-cwd');
    assert.deepEqual(direkt.cd.cwd, { ort: null, virtuellerOrt: ['etc', 'ppp', 'peers'] }, 'cd relativ zum Kontext-cwd');
    assert.deepEqual(direkt.cdPunkt.cwd, { ort: null, virtuellerOrt: ['etc'] });
    assert.equal(direkt.global, '/', 'globaler Zustand unverändert (cd liefert nur ein Ergebnis)');
    assert.deepEqual(errors, []);
    console.log('OK: Dateisystem-Schnittstelle (resolve, stat, readdir, readFile, writeFile), Haken, Befehlskontext');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
