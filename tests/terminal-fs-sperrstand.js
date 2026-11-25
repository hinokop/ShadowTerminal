/* Variante B, dynamischer Teil (Review #133): nachträgliche Sperre wirkt auf bereits Angezeigtes und Abgeleitetes.
   Geprüft werden Scrollback früherer ls-Ausgaben, Verlauf, Zwischenspeicher der Inline-Vorschläge, offene Auswahlliste, ein laufender
   (verzögerter) Abruf, eine gesperrte Zone und das Verknüpfen eines Pins mit einem gesperrten Dossier. Brücke gemockt; Verzögerung steuerbar. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { APP } = require('./_pfad');

(async () => {
  const browser = await chromium.launch();
  try {
    const p = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    p.setDefaultTimeout(15000);
    const errors = [], calls = [];
    let bremse = null;
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
      if (d.op === 'ls' && bremse) await bremse;
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
      const pinFrei = pin('Ankerpunkt Frei');
      dispatch({ type: 'OZONE_GEAENDERT', id: zone, dossier: zu });
      dispatch({ type: 'NAVIGATION', modul: 'profil' }); renderModule();
      return { zu, frei, pinZu, pinWechsel, pinExport, pinFrei, zone, siZu, siFrei };
    });
    const put = (pfad, text) => { dateien.set(pfad, text); };
    put('ops/lageblatt-' + z.pinZu + '.txt', 'TOKEN_PIN_ZU\n');
    put('ops/sichtung-' + z.zu + '-' + z.siZu + '.txt', 'TOKEN_SICHTUNG_ZU\n');
    put('ops/sichtung-' + z.frei + '-' + z.siFrei + '.txt', 'TOKEN_SICHTUNG_FREI\n');
    put('ops/unrelated.txt', 'TOKEN_NEUTRAL\n');
    const pinDatei = 'lageblatt-' + z.pinZu + '.txt', pinFreiDatei = 'lageblatt-' + z.pinFrei + '.txt', zoneDatei = 'zone-' + z.zone + '.txt';
    const siZuDatei = 'sichtung-' + z.zu + '-' + z.siZu + '.txt';
    put('ops/' + pinDatei, 'TOKEN_PIN_ZU\n'); put('ops/' + pinFreiDatei, 'TOKEN_PIN_FREI\n'); put('ops/' + zoneDatei, 'TOKEN_ZONE\n');
    put('ops/' + siZuDatei, 'TOKEN_SICHTUNG\n'); put('ops/unrelated.txt', 'TOKEN_NEUTRAL\n');
    const db = await p.evaluate(() => TERMINAL_DB);
    await p.click('#profil-terminal-oeffnen');
    const inp = p.locator('#profil-terminal-eingabe'), out = p.locator('#profil-terminal-ausgabe');
    const cmd = async line => {
      const start = await out.textContent();
      await inp.fill(line); await inp.press('Enter');
      await p.waitForFunction(() => !TERMINAL_ZUSTAND.kette && !TERMINAL_ZUSTAND.dateiLaeuft);
      return (await out.textContent()).slice(start.length);
    };
    const sperren = id => p.evaluate(i => dispatch({ type: 'DOSSIER_SPERREN', id: i }), id);
    const entsperren = id => p.evaluate(i => dispatch({ type: 'DOSSIER_ENTSPERREN', id: i }), id);
    const gesperrteNamen = [pinDatei, zoneDatei, siZuDatei];
    const tabNur = async eingabe => { await inp.fill(eingabe); await inp.press('Tab'); await p.waitForFunction(() => terminalTabLauf === null); };

    /* A. vor der Sperre: alles sichtbar (Dossier zu noch nicht gesperrt); Verlauf und Scrollback füllen */
    await cmd('cd /' + db + '/ops');
    const vorher = await cmd('ls');
    for (const n of gesperrteNamen.concat([pinFreiDatei, 'unrelated.txt'])) assert.ok(vorher.includes(n), 'vor der Sperre sichtbar: ' + n);
    await cmd('cat ' + pinDatei);
    await cmd('echo harmlos');
    const verlaufVor = await p.evaluate(() => TERMINAL_ZUSTAND.verlauf.slice());
    assert.ok(verlaufVor.some(x => x.includes(pinDatei)), 'Verlauf enthält den Namen vor der Sperre');
    /* Zwischenspeicher der Inline-Vorschläge füllen und offene Mehrfach-Auswahl herstellen (zwei Kandidaten mit gleichem Anfang) */
    await p.evaluate(async () => { await terminalVorschlagLs(['ops'], false); });
    assert.ok(await p.evaluate(() => TERMINAL_VORSCHLAG_LS.size) > 0, 'Zwischenspeicher gefüllt');
    await tabNur('cat lageblatt-PIN-');
    if (!(await p.evaluate(() => !!terminalTabAuswahl))) { await inp.press('Tab'); await p.waitForFunction(() => terminalTabLauf === null); }   /* erster Tab ergänzt nur den gemeinsamen Anfang */
    assert.ok(await p.evaluate(() => !!terminalTabAuswahl), 'Mehrfach-Auswahl offen');
    const auswahlVorher = await p.evaluate(() => terminalTabAuswahl.werte.slice());
    assert.ok(auswahlVorher.some(x => x.includes(pinDatei)), 'Auswahl enthält den späteren gesperrten Namen');

    /* B. Sperre: Scrollback, Verlauf, Zwischenspeicher, Auswahl */
    await sperren(z.zu);
    const ausgabe = await p.evaluate(() => TERMINAL_ZUSTAND.ausgabe.join('\n'));
    /* Die selbst getippte Eingabezeile (cat <Name>) darf bleiben (Review); die frühere ls-Ausgabe nicht */
    const lsBlock = ausgabe.split('\n').filter(l => !l.startsWith('raizo@terminal'));
    for (const n of gesperrteNamen) assert.ok(!lsBlock.some(l => l.includes(n) && !/Permission denied|No such/.test(l)), 'ls-Scrollback ohne ' + n);
    assert.ok(lsBlock.includes(pinFreiDatei) && lsBlock.includes('unrelated.txt'), 'übrige Zeilen der alten Liste bleiben');
    assert.ok(await p.evaluate(() => TERMINAL_ZUSTAND.verlauf.includes('echo harmlos')), 'unbeteiligte Verlaufseinträge bleiben');
    assert.ok(!(await p.evaluate(() => TERMINAL_ZUSTAND.verlauf)).some(x => x.includes(pinDatei)), 'Verlauf ohne gesperrten Namen');
    /* verworfen oder (durch einen Folgevorschlag) neu und bereits gefiltert gefüllt: kein Eintrag mit gesperrtem Namen */
    const gecacht = await p.evaluate(async () => (await Promise.all([...TERMINAL_VORSCHLAG_LS.values()].map(e => e.antwort))).flatMap(a => (a.entries || []).map(x => x.name)));
    assert.ok(!gecacht.some(n => gesperrteNamen.includes(n)), 'Zwischenspeicher ohne gesperrte Namen: ' + gecacht.join(','));
    assert.ok(await p.evaluate(() => terminalTabAuswahl === null), 'Auswahlliste geschlossen');
    /* Zwischenspeicher-Entnahme filtert zusätzlich (Gürtel): alten Treffer künstlich einsetzen */
    const eingeschmuggelt = await p.evaluate(async () => {
      const alt = { entries: [{ name: 'lageblatt-' + PROFIL.pins[0].id + '.txt', dir: false }, { name: 'unrelated.txt', dir: false }] };
      TERMINAL_VORSCHLAG_LS.set('ops', { zeit: Date.now(), antwort: Promise.resolve(alt) });
      return (await terminalVorschlagLs(['ops'], false)).entries.map(e => e.name);
    });
    assert.ok(eingeschmuggelt.includes('unrelated.txt'));
    assert.ok(!eingeschmuggelt.some(n => n === pinDatei), 'gecachter gesperrter Name wird bei der Entnahme entfernt');
    /* Gesperrte Zone (über Dossierverknüpfung) und Sichtung: nicht in ls, nicht in Tab */
    const nach = await cmd('ls');
    assert.ok(!nach.includes(zoneDatei) && !nach.includes(pinDatei) && !nach.includes(siZuDatei), 'neue Liste ohne gesperrte Namen');
    assert.ok(nach.includes(pinFreiDatei) && nach.includes('unrelated.txt'), 'neue Liste mit freien Namen');
    await tabNur('cat zone-ZO');
    assert.equal(await inp.inputValue(), 'cat zone-ZO', 'Tab ergänzt gesperrte Zone nicht');
    await inp.fill('');

    /* C. Verknüpfung: freier Pin wird mit dem gesperrten Dossier verknüpft, sein Name verschwindet, ohne dass DOSSIER_SPERREN läuft */
    const mitPin = await p.evaluate(id => { dispatch({ type: 'PIN_GEAENDERT', id, dossier: STATE.dossiers.eigene.find(x => x.name === 'Quarzfeld Sperrakte').id }); return true; }, z.pinFrei);
    assert.ok(mitPin);
    assert.ok(!(await cmd('ls')).includes(pinFreiDatei), 'Verknüpfung mit gesperrtem Dossier verbirgt den Pin-Namen');
    assert.ok(!(await p.evaluate(() => TERMINAL_ZUSTAND.ausgabe.join('\n'))).split('\n').some(l => !l.startsWith('raizo@terminal') && l === pinFreiDatei), 'auch aus dem Scrollback');

    /* D. Entsperren: Namen kehren in neuen Listen zurück (Sperrstand ist maßgeblich) */
    await entsperren(z.zu);
    const wieder = await cmd('ls');
    assert.ok(wieder.includes(pinDatei) && wieder.includes(zoneDatei) && wieder.includes(pinFreiDatei), 'nach Entsperren wieder sichtbar');

    /* E. Wettlauf: Abruf läuft, während gesperrt wird; die Antwort muss mit der aktuellen Sperre gefiltert werden */
    let frei; bremse = new Promise(r => { frei = r; });
    await inp.fill('cat lageblatt-PIN-'); await inp.press('Tab');
    await p.waitForFunction(() => terminalTabLauf !== null);
    await sperren(z.zu);
    frei(); bremse = null;
    await p.waitForFunction(() => terminalTabLauf === null);
    const eingabe = await inp.inputValue();
    assert.ok(!eingabe.includes(pinDatei), 'laufende Tab-Ergänzung übernimmt keinen inzwischen gesperrten Namen: ' + eingabe);
    assert.ok(await p.evaluate(() => terminalTabAuswahl === null || !terminalTabAuswahl.werte.some(w => w.includes('lageblatt-PIN-001'))), 'Auswahl ohne gesperrten Namen');
    await inp.fill('');

    /* G. Verlauf: Verkettungen und Parserfehler (Review, Restlücke A) */
    await entsperren(z.zu);
    const ketten = ['cat ' + pinDatei + '; echo OK', 'cat "' + pinDatei + '"; echo OK', 'cat ' + pinDatei + '&&echo OK', 'cat ' + pinDatei + ' || echo OK',
      'echo a;cat /' + db + '/ops/' + pinDatei, "cat '" + zoneDatei + "'", 'cat ' + siZuDatei + " 'offen", 'echo a | cat ' + pinDatei, 'cat lageblatt-\\' + pinDatei.slice(10)];
    await p.evaluate(k => { TERMINAL_ZUSTAND.verlauf = k.concat(['echo harmlos2', 'cat unrelated.txt; echo OK']); }, ketten);
    await sperren(z.zu);
    const verlaufNach = await p.evaluate(() => TERMINAL_ZUSTAND.verlauf.slice());
    assert.deepEqual(verlaufNach, ['echo harmlos2', 'cat unrelated.txt; echo OK'], 'Verlauf nach Sperre: nur unbeteiligte Einträge, Rest: ' + JSON.stringify(verlaufNach));

    /* H. Vorschlags-Overlay (graue Ergänzung) verschwindet unmittelbar bei der Sperre, ohne Tastendruck und ohne vorheriges ls im Scrollback */
    await entsperren(z.zu);
    await cmd('cd /' + db + '/ops');
    await p.evaluate(() => { TERMINAL_ZUSTAND.ausgabe = []; TERMINAL_ZUSTAND.ausgabeMeta = []; TERMINAL_ZUSTAND.verlauf = []; });
    await inp.fill('cat lageblatt-PIN-001');
    await p.waitForFunction(() => document.getElementById('profil-terminal-vorschlag').textContent.includes('.txt'), null, { timeout: 8000 });
    await sperren(z.zu);
    assert.ok(!(await p.evaluate(() => document.getElementById('profil-terminal-vorschlag').textContent)).includes('.txt'), 'grauer Vorschlag mit gesperrtem Namen sofort entfernt');
    await inp.fill('');

    /* I. Übergabepunkt: die Sperre greift zwischen Brückenantwort (bereits gefiltert) und Ausgabe bzw. Tab-Übernahme */
    await entsperren(z.zu);
    await p.evaluate(() => { window.__orig = terminalBruecke; terminalBruecke = async function (...a) {
      const r = await window.__orig(...a);
      if (a[0] === 'ls' && window.__sperreNach) { const id = window.__sperreNach; window.__sperreNach = null; dispatch({ type: 'DOSSIER_SPERREN', id }); }
      return r;
    }; window.__sperreNach = STATE.dossiers.eigene.find(x => x.name === 'Quarzfeld Sperrakte').id; });
    const gelistet = await cmd('ls');
    assert.ok(!gelistet.includes(pinDatei) && !gelistet.includes(zoneDatei), 'ls: Sperre zwischen Antwort und Ausgabe wirkt');
    assert.ok(gelistet.includes('unrelated.txt'), 'ls: übrige Namen bleiben');
    await entsperren(z.zu);
    await p.evaluate(() => { window.__sperreNach = STATE.dossiers.eigene.find(x => x.name === 'Quarzfeld Sperrakte').id; TERMINAL_VORSCHLAG_LS.clear(); });
    await tabNur('cat lageblatt-PIN-');
    const nachTab = await p.evaluate(() => ({ wert: document.getElementById('profil-terminal-eingabe').value, auswahl: terminalTabAuswahl ? terminalTabAuswahl.werte.join('|') : '' }));
    assert.ok(!nachTab.wert.includes(pinDatei) && !nachTab.auswahl.includes(pinDatei), 'Tab: Sperre zwischen Antwort und Übernahme wirkt: ' + JSON.stringify(nachTab));
    await p.evaluate(() => { terminalBruecke = window.__orig; });
    await inp.fill('');

    /* J. Dateioperanden mit Pfad (Review #134): die Zeile trägt den eingegebenen Pfad; Bereinigung und Endprüfung prüfen den Basisnamen */
    await entsperren(z.zu);
    await p.evaluate(() => { window.__sperreNach = null; });
    const zeilenOhneEingabe = t => t.split('\n').filter(l => l && !l.startsWith('raizo@terminal'));
    const absPin = '/' + db + '/ops/' + pinDatei;
    const operandenFaelle = ['ls ' + absPin + ' unrelated.txt', 'ls -l ./' + pinDatei + ' unrelated.txt', 'ls -F ../ops/' + pinDatei + ' ' + absPin + ' unrelated.txt', 'ls -d ' + pinDatei + ' ' + siZuDatei + ' ' + zoneDatei];
    for (const befehl of operandenFaelle) {
      const roh = zeilenOhneEingabe(await cmd(befehl));
      assert.ok(roh.some(l => l.includes(pinDatei)), 'vor der Sperre sichtbar: ' + befehl);
      await sperren(z.zu);
      const danach = await p.evaluate(() => TERMINAL_ZUSTAND.ausgabe.join('\n'));
      const block = danach.split('\n').filter(l => !l.startsWith('raizo@terminal'));
      for (const n of gesperrteNamen) assert.ok(!block.some(l => l.includes(n) && !/Permission denied|No such/.test(l)), 'Scrollback ohne ' + n + ' nach: ' + befehl);
      if (befehl.includes('unrelated.txt')) assert.ok(block.some(l => l.includes('unrelated.txt')), 'neutraler Operand bleibt: ' + befehl);
      /* neue Ausführung bei bestehender Sperre: Pfadoperand mit gesperrtem Namen wird nicht gelistet, bleibt bei Permission denied */
      const neu = zeilenOhneEingabe(await cmd(befehl));
      assert.ok(!neu.some(l => !/Permission denied|No such/.test(l) && gesperrteNamen.some(n => l.includes(n))), 'gesperrt: keine Zeile mit Namen, nur Fehlertext: ' + befehl + ' -> ' + neu.join(' | '));
      await entsperren(z.zu);
    }
    /* Sperre zwischen stat des ersten und stat des zweiten Operanden (verzögert): die Endprüfung vor der Ausgabe entfernt die Zeile */
    await p.evaluate(() => { window.__statOrig = TERMINAL_FS.stat; TERMINAL_FS.stat = async function (...a) {
      const r = await window.__statOrig.apply(this, a);
      if (window.__nachStat && a[0][a[0].length - 1] === 'unrelated.txt') { const id = window.__nachStat; window.__nachStat = null; dispatch({ type: 'DOSSIER_SPERREN', id }); }
      return r;
    }; window.__nachStat = STATE.dossiers.eigene.find(x => x.name === 'Quarzfeld Sperrakte').id; });
    const verzoegert = zeilenOhneEingabe(await cmd('ls -l ' + absPin + ' unrelated.txt'));
    assert.ok(!verzoegert.some(l => l.includes(pinDatei)), 'Sperre zwischen stat und Ausgabe: Pfadzeile entfernt: ' + verzoegert.join(' | '));
    assert.ok(verzoegert.some(l => l.includes('unrelated.txt')), 'neutraler Operand bleibt');
    await p.evaluate(() => { TERMINAL_FS.stat = window.__statOrig; });
    await entsperren(z.zu);
    /* Normale Dateien mit Pfad bleiben unverändert sichtbar */
    assert.ok(zeilenOhneEingabe(await cmd('ls /' + db + '/ops/unrelated.txt')).includes('/' + db + '/ops/unrelated.txt'));

    /* F. Messung (keine Prüfung): Filterzeit bei 5000 Einträgen */
    const ms = await p.evaluate(() => {
      const namen = Array.from({ length: 5000 }, (_, i) => i % 5 ? 'datei-' + i + '.txt' : 'lageblatt-PIN-' + String(100 + i).padStart(4, '0') + '.txt');
      const t0 = performance.now(); const sicht = terminalArchivSichtbarkeit(); namen.filter(sicht); return Math.round((performance.now() - t0) * 10) / 10;
    });
    console.log('Messung: 5000 Namen filtern in', ms, 'ms (ohne Prüfung)');
    assert.deepEqual(errors, []);
    console.log('OK: Variante B dynamisch (Scrollback, Verlauf, Cache, Auswahl, Zone, Verknüpfung, Wettlauf)');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
