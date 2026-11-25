/* Zugriffswege auf archivierte Kartenobjekte im Terminal (cat, head, tail, wget, send, open export):
   - Dateinamen wie unter Windows (Groß-/Kleinschreibung, Endpunkt, Unterordner, Kurzname), die Brücke meldet den echten Namen (file)
   - Sichtungs-Exporte (sichtung-<Dossier>-SI-nnn.txt) folgen der Sperre ihres Dossiers
   - nachträgliche Verknüpfung eines gelesenen Pins oder einer Zone mit einem gesperrten Dossier entfernt den Inhalt aus dem
     Scrollback, unabhängig vom Lesebefehl; andere Ausgaben bleiben
   - ls und Tab sehen auch Einträge jenseits der ersten Seite (500)
   Die Brücke ist gemockt (Namensauflösung ohne Beachtung der Großschreibung wie unter Windows). */
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
      if (d.op === 'home-save') return route.fulfill({ json: { name: 'home-20261125T000000Z.json', bytes: 1 } });   /* Paket 3: erste automatische Sicherung nach der Installation von /etc */
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
    const put = (pfad, text, kurz) => { dateien.set(pfad, text); if (kurz) alias.set(kurz.toLowerCase(), pfad); };
    put('ops/lageblatt-' + z.pinZu + '.txt', 'TOKEN_PIN_ZU\n', 'ops/lagebl~1.txt');
    put('ops/archiv/lageblatt-' + z.pinZu + '.txt', 'TOKEN_PIN_ZU_UNTERORDNER\n');
    put('ops/lageblatt-' + z.pinWechsel + '.txt', 'TOKEN_PIN_WECHSEL\n');
    put('ops/lageblatt-' + z.pinExport + '.txt', 'TOKEN_PIN_EXPORT\n');
    put('dokumente/zone-' + z.zone + '.txt', 'TOKEN_ZONE_WECHSEL\n');
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
    const code = async () => (await cmd('echo $?')).trim().split('\n').at(-1);
    const speicher = () => p.evaluate(() => TERMINAL_ZUSTAND.ausgabe.join('\n'));
    const weg = async (token, wo) => {
      assert.doesNotMatch(await out.textContent(), new RegExp(token), token + ' nicht im Terminal (' + wo + ')');
      assert.doesNotMatch(await speicher(), new RegExp(token), token + ' nicht im Scrollback (' + wo + ')');
    };
    const pfad = x => '/' + db + '/' + x;

    /* 1 Gesperrter Export: jede Schreibweise, jeder Befehl; die Brücke liefert den echten Namen */
    const formen = [
      'ops/lageblatt-' + z.pinZu + '.txt', 'ops/LAGEBLATT-' + z.pinZu.toLowerCase() + '.TXT', 'ops/lageblatt-' + z.pinZu + '.txt.',
      'ops/archiv/lageblatt-' + z.pinZu + '.txt', 'ops/../ops/lageblatt-' + z.pinZu + '.txt', 'ops/LAGEBL~1.TXT',
      'ops/sichtung-' + z.zu + '-' + z.siZu + '.txt', 'ops/SICHTUNG-' + z.zu + '-' + z.siZu + '.TXT'];
    for (const form of formen) for (const befehl of ['cat', 'head', 'tail', 'wget']) {
      const res = await cmd(befehl + ' ' + pfad(form));
      assert.match(res, /Permission denied/, befehl + ' ' + form);
      assert.equal(await code(), '1', befehl + ' ' + form);
    }
    for (const form of formen.slice(0, 1).concat(formen.slice(5, 6))) {
      const r = await p.evaluate(x => terminalBruecke('send', x.split('/')), form);
      assert.equal(r.error, 'Permission denied', 'send ' + form);
    }
    await weg('TOKEN_PIN_ZU|TOKEN_SICHTUNG_ZU', 'gesperrt');
    await cmd('cat ' + pfad('ops/unrelated.txt'));
    assert.match(await out.textContent(), /TOKEN_NEUTRAL/, 'nicht zugeordnete Datei bleibt lesbar');

    /* 2 Sichtungs-Export eines freien Dossiers: lesbar, nach der Sperre des Dossiers verschwunden */
    await cmd('cat ' + pfad('ops/sichtung-' + z.frei + '-' + z.siFrei + '.txt'));
    assert.match(await out.textContent(), /TOKEN_SICHTUNG_FREI/);
    await p.evaluate(id => dispatch({ type: 'DOSSIER_SPERREN', id }), z.frei);
    await weg('TOKEN_SICHTUNG_FREI', 'Sperre des Dossiers');
    assert.match(await out.textContent(), /TOKEN_NEUTRAL/, 'übrige Ausgabe bleibt');

    /* 3 Nachträgliche Verknüpfung: Pin und Zone werden gelesen (cat, head, tail, open export), dann mit dem gesperrten Dossier verknüpft */
    for (const [id, art, token, aktion] of [[z.pinWechsel, 'pin', 'TOKEN_PIN_WECHSEL', 'PIN_GEAENDERT'], [z.zone, 'zone', 'TOKEN_ZONE_WECHSEL', 'OZONE_GEAENDERT']]) {
      const datei = art === 'pin' ? 'ops/lageblatt-' + id + '.txt' : 'dokumente/zone-' + id + '.txt';
      for (const befehl of ['cat', 'head', 'tail']) await cmd(befehl + ' ' + pfad(datei));
      await cmd('open export ' + id);
      assert.match(await out.textContent(), new RegExp(token), art + ' gelesen');
      assert.match(await speicher(), /VAULT :: RECORD ACCESS/);
      await cmd('echo BEHALTEN_' + art);
      await p.evaluate(({ id, aktion, d }) => dispatch({ type: aktion, id, dossier: d }), { id, aktion, d: z.zu });
      await weg(token, art + ' nachträglich verknüpft');
      await weg('VAULT :: RECORD ACCESS\\nOBJECT\\s+' + id, art + ' Datensatz');
      assert.match(await out.textContent(), new RegExp('BEHALTEN_' + art), 'andere Ausgabe bleibt');
      const res = await cmd('cat ' + pfad(datei));
      assert.match(res, /Permission denied/, art + ' nach Verknüpfung gesperrt');
      await p.evaluate(({ id, aktion }) => dispatch({ type: aktion, id, dossier: '' }), { id, aktion });
      assert.match(await cmd('cat ' + pfad(datei)), new RegExp(token), art + ' nach Lösen der Verknüpfung wieder lesbar');
    }

    /* 4 ls und Tab: Einträge jenseits der ersten Seite */
    for (let i = 0; i < 520; i++) put('ops/aaa-' + String(i).padStart(4, '0') + '.txt', '');
    put('ops/zzz-spaet.txt', 'TOKEN_SPAET\n');
    assert.match(await cmd('ls ' + pfad('ops')), /zzz-spaet\.txt/, 'ls zeigt alle Einträge');
    await cmd('cd ' + pfad('ops'));
    await inp.fill('cat zzz-sp'); await inp.press('Tab');
    await p.waitForFunction(() => document.getElementById('profil-terminal-eingabe').value !== 'cat zzz-sp', null, { timeout: 5000 }).catch(() => {});
    assert.equal(await inp.inputValue(), 'cat zzz-spaet.txt', 'Tab sieht Einträge nach der ersten Seite');
    await inp.fill('');
    assert.ok(calls.some(x => x.op === 'ls' && x.offset >= 500));
    assert.deepEqual(errors, []);
    console.log('OK: Archivzugriff (Schreibweisen, Sichtungen, nachträgliche Verknüpfung, Paginierung)');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
