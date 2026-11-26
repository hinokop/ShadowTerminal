/* Paket 4, M1 bis M3: /sendfile über den gemeinsamen Versandadapter (docs/terminal-dateiintegration-konzept.md §3, §4, §9.10).
   A: Archiv über die Brücke: Verzeichnis mit und ohne "/" (Not a file, Befund aus der Windows-Abnahme), Datei mit "/" (File not found),
      fehlender Zwischenordner vor "..".
   B: VFS: ~/ wird wie get_expanded_path erweitert und so gemeldet, file://, relative Pfade ab dem Arbeitsverzeichnis, Leerzeichen in Quotes,
      /tmp, UTF-8-Bytezahl als Momentaufnahme beim Start; Systembereiche sind keine Versandquellen (Datei: File not found, Verzeichnis: Not a file).
   C: Tab-Ergänzung wie in der Shell (VFS, /intel ohne gesperrte Objekte).
   D: /intel direkt: Profil, Index (Dateiname beim Empfänger), Verzeichnis, gesperrt wie nicht vorhanden; Sperre vor der Slot-Antwort, während
      des Uploads und vor dem Link; Verknüpfung mit gesperrtem Dossier während des Uploads; Löschung des Pins; abgeschlossene Zeilen werden bei
      Sperre entfernt und kommen beim Entsperren nicht wieder.
   E: Archivname eines Exportobjekts (Lageblatt): Sperre während des Uploads entfernt Zeilen, kein Link. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { APP } = require('./_pfad');
const { chatBereit } = require('./_kestrel');

(async () => {
  const b = await chromium.launch();
  try {
    const p = await b.newPage({ reducedMotion: 'reduce' });
    p.setDefaultTimeout(12000);
    const errors = [];
    p.on('pageerror', e => errors.push(e.message));
    let pinId = null;
    const archiv = () => ({ dossiers: { 'dossier-index.txt': 500 }, ops: { ['lageblatt-' + pinId + '.txt']: 900 } });
    await p.route(/^https?:/, async r => {
      const req = r.request();
      if (req.url() !== 'http://127.0.0.1:45679/db') return r.abort();
      const d = req.postDataJSON();
      if (d.op === 'home-save') return r.fulfill({ json: { name: 'home-20261125T000000Z.json', bytes: 1 } });
      const A = archiv(), parts = d.parts || [];
      const knoten = parts.length === 0 ? A : parts.length === 1 ? A[parts[0]] : parts.length === 2 && A[parts[0]] ? A[parts[0]][parts[1]] : undefined;
      if (d.op === 'ls' || d.op === 'cd') {
        if (typeof knoten !== 'object') return r.fulfill({ json: { error: 'Datei oder Ordner nicht gefunden' } });
        if (d.op === 'cd') return r.fulfill({ json: { ok: true } });
        return r.fulfill({ json: { entries: Object.entries(knoten).map(([name, v]) => ({ name, dir: typeof v === 'object', bytes: typeof v === 'number' ? v : 0, mtime: 0 })), next: null } });
      }
      if (d.op === 'send') {
        if (typeof knoten === 'object') return r.fulfill({ json: { notfile: true } });
        if (typeof knoten === 'number') return r.fulfill({ json: { name: parts.at(-1), file: parts.at(-1), bytes: knoten } });
        return r.fulfill({ json: { error: 'Datei oder Ordner nicht gefunden' } });
      }
      return r.fulfill({ json: { error: 'Datei oder Ordner nicht gefunden' } });
    });
    await p.goto(APP + '#db=45679.' + 'a'.repeat(43));
    await p.fill('#gate-pw', 'pw-test-123');
    if (await p.isVisible('#gate-pw2')) await p.fill('#gate-pw2', 'pw-test-123');
    await p.click('#gate-go');
    await p.waitForFunction(() => typeof APP_BEREIT !== 'undefined' && APP_BEREIT && !!STATE);
    pinId = await p.evaluate(() => {
      dispatch({ type: 'PIN_ANGELEGT', ll: [52.47, 13.45], name: 'PINMARKER', dossier: 'P-0003' });
      dispatch({ type: 'PIN_ANGELEGT', ll: [52.48, 13.46], name: 'FREIPIN' });
      return PROFIL.pins.at(-2).id;
    });
    const freiPin = await p.evaluate(() => PROFIL.pins.at(-1).id);
    await p.click('#profil-terminal-oeffnen');
    await chatBereit(p, { kontakt: false });
    await p.clock.pauseAt(await p.evaluate(() => Date.now() + 1000));
    const inp = p.locator('#profil-terminal-eingabe'), verlauf = p.locator('#profil-terminal-chat');
    const cmd = async z => { await inp.fill(z); await inp.press('Enter'); await p.waitForFunction(() => !TERMINAL_ZUSTAND.kanal?.pruefung); await p.clock.runFor(1); };
    const text = () => verlauf.textContent();
    const alle = () => p.evaluate(() => TERMINAL_ZUSTAND.kanal.fenster.map(f => f.log.map(e => e.zeile ?? e).join('\n')).join('\n'));
    const letzte = async () => (await p.evaluate(() => { const e = TERMINAL_ZUSTAND.kanal.fenster[0].log.at(-1); return e.zeile ?? e; })).replace(/^\d\d:\d\d:\d\d . /, '');   /* Konsole (cons_show_error) */
    const schreiben = (pfad, t) => p.evaluate(async ([seg, t]) => { const r = await TERMINAL_VFS.schreiben(seg, t, {}); if (r.fehler) throw new Error(r.fehler); }, [pfad.split('/').filter(Boolean), t]);
    const sperren = id => p.evaluate(i => dispatch({ type: 'DOSSIER_SPERREN', id: i }), id);
    const entsperren = id => p.evaluate(i => dispatch({ type: 'DOSSIER_ENTSPERREN', id: i }), id);
    const uploads = () => p.evaluate(() => (TERMINAL_ZUSTAND.kanal.uploads || []).map(u => ({ datei: u.datei, bytes: u.bytes, name: u.name })));
    const chat = await p.evaluate(() => ({ domain: TERMINAL_ZUSTAND.kanal.domain, kontakt: TERMINAL_ZUSTAND.kanal.vorschlag }));
    const fehlt = d => "Uploading '" + d + "' failed: File not found!", keine = d => "Uploading '" + d + "' failed: Not a file!";

    /* ---- A: Archiv ---- */
    for (const d of ['/pgcl-eu3.arch07/dossiers/', '/pgcl-eu3.arch07/dossiers', '/pgcl-eu3.arch07/']) { await cmd('/sendfile ' + d); assert.equal(await letzte(), keine(d), d); }
    await cmd('/sendfile /pgcl-eu3.arch07/dossiers/dossier-index.txt/');
    assert.equal(await letzte(), fehlt('/pgcl-eu3.arch07/dossiers/dossier-index.txt/'), 'Datei mit "/" ist keine Datei (ENOTDIR)');
    await cmd('/sendfile /pgcl-eu3.arch07/fehlt/../dossiers/dossier-index.txt');
    assert.equal(await letzte(), fehlt('/pgcl-eu3.arch07/fehlt/../dossiers/dossier-index.txt'), 'fehlender Zwischenordner vor ".."');
    await cmd('/sendfile /pgcl-eu3.arch07/dossiers/dossier-index.txt');
    assert.equal(await letzte(), 'Unsupported window for file transmission.', 'Datei gefunden, Prüfung erreicht das Fenster');

    /* ---- B: VFS und Systembereiche ---- */
    await schreiben('/home/raizo/report.txt', 'ä'.repeat(100));
    await schreiben('/home/raizo/mit leer.txt', 'x'.repeat(150));
    await schreiben('/tmp/obs.txt', 'y'.repeat(120));
    await cmd('/sendfile ~/');
    assert.equal(await letzte(), keine('/home/raizo/'), '~/ wie get_expanded_path erweitert');
    await cmd('/sendfile ~/report.txt/');
    assert.equal(await letzte(), fehlt('/home/raizo/report.txt/'));
    await cmd('/sendfile fehlt/../report.txt');
    assert.equal(await letzte(), fehlt('fehlt/../report.txt'));
    await cmd('/sendfile ~/fehlt.txt');
    assert.equal(await letzte(), fehlt('/home/raizo/fehlt.txt'));
    for (const d of ['/etc/hostname', '/etc/wireguard/wg-sat.key', '/usr/share/predict/default/predict.tle', '/var/cache/tle/kestrel.tle']) { await cmd('/sendfile ' + d); assert.equal(await letzte(), fehlt(d), 'keine Versandquelle: ' + d); }
    for (const d of ['/etc', '/usr/share', '/']) { await cmd('/sendfile ' + d); assert.equal(await letzte(), keine(d), d); }
    await cmd('/sendfile file://~/report.txt');
    assert.equal(await letzte(), 'Unsupported window for file transmission.', 'file:// fällt weg');

    await cmd('/msg ' + chat.kontakt);
    await cmd('/sendfile ~/report.txt');
    await schreiben('/home/raizo/report.txt', 'z'.repeat(5000));
    assert.deepEqual(await uploads(), [{ datei: '/home/raizo/report.txt', bytes: 200, name: 'report.txt' }], 'UTF-8-Bytes, Momentaufnahme beim Start');
    await cmd('/sendfile "mit leer.txt"');
    await cmd('/sendfile /tmp/obs.txt');
    await p.clock.runFor(2000);
    assert.match(await text(), /! Uploading '\/home\/raizo\/report\.txt': \d+%/);
    assert.match(await text(), /! Uploading 'mit leer\.txt': \d+%/, 'relativ zum Arbeitsverzeichnis');
    await p.clock.runFor(4000);
    const v = await text();
    for (const [d, n] of [['/home/raizo/report.txt', 'report\\.txt'], ['mit leer.txt', 'mit%20leer\\.txt'], ['/tmp/obs.txt', 'obs\\.txt']]) {
      assert.match(v, new RegExp("Uploading '" + d.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&') + "': done"), d);
      assert.match(v, new RegExp('me: https://[^ ]+/file_share/[\\w-]{16}/' + n + '$', 'm'), d);
    }
    assert.equal(await p.evaluate(() => TERMINAL_ZUSTAND.kanal.uploadTakt), null, 'Takt beendet');

    /* ---- C: Tab ---- */
    const tab = async (wert, erwartet) => { await inp.fill(wert); await inp.press('Tab'); await p.waitForFunction(w => $('profil-terminal-eingabe').value === w, erwartet); };
    await tab('/sendfile ~/rep', '/sendfile ~/report.txt');
    await tab('/sendfile /intel/geospatial/pins/' + pinId, '/sendfile /intel/geospatial/pins/' + pinId + '/');
    await tab('/sendfile /intel/geospatial/pins/' + pinId + '/rec', '/sendfile /intel/geospatial/pins/' + pinId + '/record');
    await tab('/sendfile /pgcl-eu3.arch07/doss', '/sendfile /pgcl-eu3.arch07/dossiers/');
    await inp.fill('');

    /* ---- D: /intel ---- */
    await cmd('/sendfile /intel/dossiers/persons/P-0003');
    assert.equal(await letzte(), keine('/intel/dossiers/persons/P-0003'));
    const profilBytes = await p.evaluate(() => new TextEncoder().encode(INTEL.readFile(['dossiers', 'persons', 'P-0003', 'profile']).text).length);
    await cmd('/sendfile /intel/dossiers/persons/P-0003/profile');
    await cmd('/sendfile /intel/dossiers/index');
    assert.deepEqual((await uploads()).map(u => [u.name, u.bytes]), [['P-0003-profile.txt', Math.max(64, profilBytes)], ['dossiers-index.txt', (await uploads())[1].bytes]]);
    await p.clock.runFor(2000 + 30000);
    assert.match(await text(), /me: https:\/\/[^ ]+\/P-0003-profile\.txt$/m);
    assert.match(await text(), /me: https:\/\/[^ ]+\/dossiers-index\.txt$/m);
    await cmd('/sendfile /intel/dossiers/persons/P-9999/profile');
    const nichtDa = await letzte();
    await sperren('P-0003');
    assert.doesNotMatch(await alle(), /P-0003-profile|Uploading '\/intel\/dossiers\/persons\/P-0003\/profile': (\d+%|done)/, 'abgeschlossene Zeilen mit gesperrtem Ursprung entfernt (Fehlerzeilen mit dem getippten Pfad bleiben wie in der Shell)');
    assert.doesNotMatch(await alle(), /dossiers-index\.txt/, 'Index-Momentaufnahme enthielt die Zeile von P-0003: hängt an allen enthaltenen Zeilen');
    assert.match(await alle(), /report\.txt$/m, 'Zeilen ohne Abhängigkeit bleiben');
    await cmd('/sendfile /intel/dossiers/persons/P-0003/profile');
    assert.equal(await letzte(), fehlt('/intel/dossiers/persons/P-0003/profile'), 'gesperrt wie nicht vorhanden');
    assert.equal(nichtDa.replace('P-9999', 'P-0003'), await letzte());
    await entsperren('P-0003');
    assert.doesNotMatch(await alle(), /P-0003-profile/, 'kein Wiederauftauchen nach dem Entsperren');

    /* Sperre vor der Slot-Antwort */
    const rec = '/intel/geospatial/pins/' + pinId + '/record';
    await cmd('/sendfile ' + rec);
    await sperren('P-0003');
    await p.clock.runFor(2500);
    assert.doesNotMatch(await alle(), new RegExp(pinId + '-record|Uploading \'' + rec), 'kein Slot, keine Zeile');
    assert.deepEqual(await uploads(), []);
    await entsperren('P-0003');
    /* Sperre während des Uploads */
    await p.evaluate(() => { const st = STATE.dossiers.entitaeten['P-0003']; st.kurzlage = 'L'.repeat(3000); });
    await cmd('/sendfile /intel/dossiers/persons/P-0003/profile');
    await p.clock.runFor(2500);
    assert.match(await alle(), /Uploading '\/intel\/dossiers\/persons\/P-0003\/profile': \d+%/);
    await sperren('P-0003');
    assert.doesNotMatch(await alle(), /P-0003\/profile': /, 'Statuszeile sofort entfernt');
    await p.clock.runFor(20000);
    assert.doesNotMatch(await alle(), /P-0003\/profile': |P-0003-profile/, 'kein Abschluss, kein Link');
    assert.deepEqual(await uploads(), []);
    await entsperren('P-0003');
    /* Verknüpfung mit gesperrtem Dossier während des Uploads (aktuelle Bindung) */
    await sperren('P-0002');
    const frei = '/intel/geospatial/pins/' + freiPin + '/record';
    await p.evaluate(id => { const x = PROFIL.pins.find(y => y.id === id); x.notiz = 'N'.repeat(3000); }, freiPin);
    await cmd('/sendfile ' + frei);
    await p.clock.runFor(2500);
    assert.match(await alle(), new RegExp("Uploading '" + frei + "': \\d+%"));
    await p.evaluate(id => dispatch({ type: 'PIN_GEAENDERT', id, dossier: 'P-0002' }), freiPin);
    await p.clock.runFor(20000);
    assert.doesNotMatch(await alle(), new RegExp(freiPin), 'Verknüpfung mit gesperrtem Dossier bricht ab');
    /* Lösen der Verknüpfung gibt nichts frei; ursprüngliche Bindung: Pin gelöscht während des Uploads */
    await p.evaluate(id => dispatch({ type: 'PIN_GEAENDERT', id, dossier: null }), freiPin);
    await entsperren('P-0002');
    await cmd('/sendfile ' + frei);
    await p.clock.runFor(2500);
    assert.match(await alle(), new RegExp("Uploading '" + frei + "': \\d+%"));
    await p.evaluate(id => dispatch({ type: 'PIN_ENTFERNT', id }), freiPin);
    await p.clock.runFor(250);
    await p.evaluate(() => terminalSchutzPruefen());
    await p.clock.runFor(20000);
    assert.doesNotMatch(await alle(), new RegExp(freiPin), 'gelöschter Pin: kein Abschluss, kein Link');
    assert.deepEqual(await uploads(), []);

    /* ---- E: Archivname eines Exportobjekts ---- */
    const lb = '/pgcl-eu3.arch07/ops/lageblatt-' + pinId + '.txt';
    await cmd('/sendfile ' + lb);
    await p.clock.runFor(2500);
    assert.match(await alle(), new RegExp("Uploading '" + lb.replace(/[./]/g, '\\$&') + "': \\d+%"));
    await sperren('P-0003');
    assert.doesNotMatch(await alle(), new RegExp('lageblatt-' + pinId));
    await p.clock.runFor(10000);
    assert.doesNotMatch(await alle(), new RegExp('lageblatt-' + pinId), 'kein Link');
    await entsperren('P-0003');

    assert.deepEqual(errors, []);
    console.log('OK: Paket 4 M1 bis M3 (/sendfile über VFS, Archiv und /intel, Profanity-Meldungen, Tab, Chat-Schutz)');
  } finally {
    await b.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
