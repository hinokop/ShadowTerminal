/* Charakterisierung (Ist-Stand, Phase 6a-0): Sichtbarkeit der Namen anwendungsseitig gesperrter Archivdateien in ls und Tab.
   Zielverhalten ist laut Plan (Abschnitt 9.3) Variante B (Name ebenfalls geschützt); dieser Test hält den HEUTIGEN Stand fest
   und ist bei der Umsetzung von Variante B bewusst umzukehren. Die Brücke ist gemockt (wie terminal-archiv-zugriff). */
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
    const ls = await cmd('ls /' + db + '/ops');
    /* Ist (gemessen): Namen gesperrter Exportdateien erscheinen in ls; der Inhalt bleibt durch cat/head/tail/wget geschützt */
    assert.ok(ls.includes('lageblatt-' + z.pinZu + '.txt'), 'Ist: Name der gesperrten Pin-Datei in ls');
    assert.ok(ls.includes('sichtung-' + z.zu + '-' + z.siZu + '.txt'), 'Ist: Name der gesperrten Sichtungsdatei in ls');
    assert.match(await cmd('cat /' + db + '/ops/lageblatt-' + z.pinZu + '.txt'), /Permission denied/, 'Inhalt bleibt gesperrt');
    await cmd('cd /' + db + '/ops');
    await inp.fill('cat lageblatt-' + z.pinZu.slice(0, 8)); await inp.press('Tab');
    await p.waitForFunction(() => document.getElementById('profil-terminal-eingabe').value.endsWith('.txt'), null, { timeout: 5000 });
    assert.equal(await inp.inputValue(), 'cat lageblatt-' + z.pinZu + '.txt', 'Ist: Tab ergänzt den Namen der gesperrten Pin-Datei');
    await inp.fill('');
    assert.deepEqual(errors, []);
    console.log('OK: Ist-Stand Namenssichtbarkeit gesperrter Archivdateien (ls, Tab) festgehalten');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
