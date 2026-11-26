/* Paket 4, M4: verwaltete Exporte (docs/terminal-dateiintegration-konzept.md §9).
   A: GUI-Export nach /exports (Vorgabe im Dialog), unverändert, neue Version mit Zeitnamen ohne laufende Nummer; Pin, Zone, Sichtung.
   B: Terminal: ls, ls -l, cat (deutscher Text wie Hostexport), keine Kopie, Umleitung, nano, mv; rm -r und rmdir Read-only file system.
   C: Zustände: Sperre (ursprünglich und aktuell, Verknüpfung A -> B, Lösen), Löschung, Neuvergabe der Kennung; gesperrt, verwaist und nicht
      vorhanden antworten gleich (ls, cat, rm, Tab, /sendfile); Scrollback-Schutz.
   D: Löschen: rm über die gemeinsame Aktion, GUI-Knopf mit Anzahl, Sammelbereinigung nur verwaister (nicht gesperrter) Exporte, Protokoll.
   E: Grenzen (Anzahl, Gesamtgröße, 64 KiB), Wiederverwendung am Limit, simulierter Speicherfehler ohne Teilbestand, zwei Fenster am Limit.
   F: Neustart (Neuladen), keine Exporttexte in Home-Sicherung und Profil; /sendfile aus /exports mit Sperre während des Uploads. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright');
const { APP } = require('./_pfad');
const { chatBereit } = require('./_kestrel');

const PW = 'pw-test-123';
(async () => {
  const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'ft-p4e-')), { reducedMotion: 'reduce' });
  try {
    const fehler = [];
    const anmelden = async () => {
      const p = await ctx.newPage();
      p.setDefaultTimeout(15000);
      p.on('pageerror', e => fehler.push(e.message));
      await p.route(/^https?:/, r => r.abort());
      await p.goto(APP);
      await p.fill('#gate-pw', PW); if (await p.isVisible('#gate-pw2')) await p.fill('#gate-pw2', PW);
      await p.click('#gate-go');
      await p.waitForFunction(() => typeof APP_BEREIT !== 'undefined' && APP_BEREIT && !!STATE && !document.body.classList.contains('locked'));
      return p;
    };
    let p = await anmelden();
    const ids = await p.evaluate(() => {
      dispatch({ type: 'PIN_ANGELEGT', ll: [52.47, 13.45], name: 'EXPPIN', dossier: 'P-0003', notiz: 'MARKE-EINS' });
      const pin = PROFIL.pins.at(-1).id;
      dispatch({ type: 'PIN_ANGELEGT', ll: [52.48, 13.46], name: 'FREI', notiz: 'MARKE-FREI' });
      const frei = PROFIL.pins.at(-1).id;
      dispatch({ type: 'OZONE_ANGELEGT', ll: [52.47, 13.45] });
      const zone = PROFIL.zonen.at(-1).id;
      dispatch({ type: 'OZONE_GEAENDERT', id: zone, dossier: 'P-0003' });
      const st = STATE.dossiers.entitaeten['P-0003'];
      st.sichtungen = (st.sichtungen || []).concat([{ id: 'SI-801', t: '2026-11-20T10:00:00.000Z', text: 'MARKE-SICHTUNG', guete: 'unbewertet' }]);
      return { pin, frei, zone };
    });
    const meldung = async () => (await p.locator('#sys-msg').innerText()).replace(/^\d{6}Z[A-Z]{3}\d\d · /, '');   /* Zeitgruppe der Systemmeldung entfernen */
    const gui = async (art, id, ent, ziel) => {
      await p.evaluate(([a, i, e]) => { meldung(''); kartenTxtExport(a, i, e || undefined); }, [art, id, ent]);
      assert.equal(await p.locator('#k-txt-ordner').inputValue(), 'exporte', 'Vorgabe: Exportspeicher');
      if (ziel) await p.selectOption('#k-txt-ordner', ziel);
      await p.click('#dlg-ok');
      await p.waitForFunction(() => /Export|TXT|Download/.test($('sys-msg').innerText));
      return meldung();
    };
    const NAME = /\d{8}T\d{6}\.\d{3}Z-[0-9a-f]{6}\.txt/;

    /* ---- A ---- */
    const m1 = await gui('pin', ids.pin);
    assert.match(m1, new RegExp('^Export gespeichert · /exports/pins/' + ids.pin + '/' + NAME.source + '$'), m1);
    const datei1 = m1.split(' · ')[1];
    assert.match(await gui('pin', ids.pin), /^Export unverändert, keine neue Datei · /, 'gleicher Inhalt');
    await p.evaluate(id => dispatch({ type: 'PIN_GEAENDERT', id, notiz: 'MARKE-ZWEI' }), ids.pin);
    const datei2 = (await gui('pin', ids.pin)).split(' · ')[1];
    assert.notEqual(datei2, datei1, 'neue Version');
    const zoneDatei = (await gui('zone', ids.zone)).split(' · ')[1];
    assert.match(zoneDatei, new RegExp('^/exports/zones/' + ids.zone + '/' + NAME.source + '$'));
    const siDatei = (await gui('sichtung', 'SI-801', 'P-0003')).split(' · ')[1];
    assert.match(siDatei, new RegExp('^/exports/sightings/P-0003/SI-801/' + NAME.source + '$'), 'Sichtung (Kennung wie beim Hostexport vergeben)');
    const freiDatei = (await gui('pin', ids.frei)).split(' · ')[1];
    assert.ok(await p.evaluate(() => STATE.log.some(l => l.aktion === 'Export gespeichert')), 'Protokoll');

    /* ---- B ---- */
    await p.click('#profil-terminal-oeffnen');
    const inp = p.locator('#profil-terminal-eingabe'), out = p.locator('#profil-terminal-ausgabe');
    const lauf = async z => {
      const roh = await out.textContent(), vorher = roh === '' ? 0 : roh.split('\n').length;
      await inp.fill(z); await inp.press('Enter'); await p.waitForFunction(() => !TERMINAL_ZUSTAND.kette && !TERMINAL_ZUSTAND.dateiLaeuft);
      return (await out.textContent()).split('\n').slice(vorher + 1).join('\n');
    };
    assert.equal(await lauf('ls /exports'), 'pins\nsightings\nzones');
    assert.equal((await lauf('ls /exports/pins/' + ids.pin)).split('\n').length, 2);
    assert.match(await lauf('ls -l ' + datei1), /^-r--r--r-- /);
    const text1 = await lauf('cat ' + datei1);
    assert.match(text1, /MARKE-EINS/); assert.match(text1, /Angelegt: /, 'deutscher Renderer wie der Hostexport');
    assert.equal(text1, await p.evaluate(id => pinText(Object.assign({}, PROFIL.pins.find(x => x.id === id), { notiz: 'MARKE-EINS' })), ids.pin));
    assert.match(await lauf('cat ' + datei2), /MARKE-ZWEI/);
    assert.match(await lauf('cp ' + datei1 + ' ~/kopie.txt'), /Operation not permitted/);
    assert.match(await lauf('cat ' + datei1 + ' > ~/kopie.txt'), /Operation not permitted/);
    assert.match(await lauf('cat ~/kopie.txt'), /No such file or directory/, 'keine Kopie entstanden');
    assert.match(await lauf('nano ' + datei1), /Read-only file system/);
    assert.match(await lauf('echo x > ' + datei1), /Read-only file system/);
    assert.match(await lauf('mv ' + datei1 + ' ~/'), /Invalid cross-device link$/);
    assert.match(await lauf('touch /exports/pins/neu.txt'), /Read-only file system/);
    assert.match(await lauf('mv ' + datei1 + ' ' + datei1 + '.x'), /Read-only file system/);
    assert.match(await lauf('rm -r /exports/pins'), /Read-only file system/);
    assert.match(await lauf('rmdir /exports/zones/' + ids.zone), /Read-only file system/);
    assert.match(await lauf('cat ' + datei1), /MARKE-EINS/, 'mv hat nichts verändert');

    /* ---- C ---- */
    const nichtDa = '/exports/pins/' + ids.pin + '/20000101T000000.000Z-000000.txt';
    const antworten = async datei => [await lauf('cat ' + datei), await lauf('rm ' + datei)].map(x => x.split(datei).join('PFAD'));
    const fehltAntwort = await antworten(nichtDa);
    assert.deepEqual(fehltAntwort, ['cat: PFAD: No such file or directory', "rm: cannot remove 'PFAD': No such file or directory"]);
    await p.evaluate(() => dispatch({ type: 'DOSSIER_SPERREN', id: 'P-0003' }));
    assert.doesNotMatch(await out.textContent(), /MARKE-EINS/, 'gelesener Export aus dem Scrollback entfernt');
    assert.deepEqual(await antworten(datei1), fehltAntwort, 'gesperrt wie nicht vorhanden (cat, rm)');
    assert.equal(await lauf('ls /exports'), 'pins', 'nur der freie Pin bleibt');
    await inp.fill('cat /exports/pins/' + ids.pin); await inp.press('Tab'); await p.waitForTimeout(400);
    assert.equal(await inp.inputValue(), 'cat /exports/pins/' + ids.pin, 'Tab ergänzt keinen gesperrten Export');
    await inp.fill('');
    assert.match(await lauf('ls /exports/pins/' + ids.pin), /No such file or directory/);
    await p.evaluate(() => dispatch({ type: 'DOSSIER_ENTSPERREN', id: 'P-0003' }));
    /* Verknüpfung A -> B (B gesperrt), dann Lösen bei gesperrtem Ursprung */
    await p.evaluate(id => { dispatch({ type: 'DOSSIER_SPERREN', id: 'P-0002' }); dispatch({ type: 'PIN_GEAENDERT', id, dossier: 'P-0002' }); }, ids.frei);
    assert.deepEqual(await antworten(freiDatei), fehltAntwort, 'aktuelle Verknüpfung mit gesperrtem Dossier');
    await p.evaluate(id => { dispatch({ type: 'DOSSIER_ENTSPERREN', id: 'P-0002' }); }, ids.frei);
    assert.match(await lauf('cat ' + freiDatei), /MARKE-FREI/);
    await p.evaluate(id => { dispatch({ type: 'PIN_GEAENDERT', id, dossier: 'P-0003' }); dispatch({ type: 'PIN_GEAENDERT', id, dossier: null }); }, ids.frei);
    await p.evaluate(() => dispatch({ type: 'DOSSIER_SPERREN', id: 'P-0003' }));
    assert.match(await lauf('cat ' + datei2), /No such file or directory/);
    await p.evaluate(() => dispatch({ type: 'DOSSIER_ENTSPERREN', id: 'P-0003' }));
    /* Neuvergabe der Kennung (anderes Objekt, andere Anlegezeit): verwaist */
    await p.evaluate(id => { const x = PROFIL.pins.find(y => y.id === id); x.t = '2026-01-01T00:00:00.000Z'; profilSpeichern(); }, ids.frei);
    assert.deepEqual(await antworten(freiDatei), fehltAntwort, 'verwaist wie nicht vorhanden');
    assert.deepEqual(await p.evaluate(async () => (await EXPORTE.verwaiste()).anzahl), 1);

    /* ---- D ---- */
    /* Sammelbereinigung: nur verwaiste, gesperrte bleiben */
    await p.evaluate(() => dispatch({ type: 'DOSSIER_SPERREN', id: 'P-0003' }));
    await p.evaluate(() => { meldung(''); kartenTxtExport('pin', PROFIL.pins.at(-1).id); });
    await p.click('#k-export-verwaist'); assert.match(await p.locator('#k-export-verwaist').innerText(), /wirklich/);
    await p.click('#k-export-verwaist');
    await p.waitForFunction(() => /Verwaiste Exporte entfernt: 1\./.test($('sys-msg').innerText));
    await p.evaluate(() => { const d = $('dlg'); if (d.open) d.close(); });
    await p.evaluate(() => dispatch({ type: 'DOSSIER_ENTSPERREN', id: 'P-0003' }));
    assert.match(await lauf('cat ' + datei1), /MARKE-EINS/, 'gesperrter Export überstand die Bereinigung');
    /* rm über die gemeinsame Aktion */
    assert.equal(await lauf('rm ' + datei1), '');
    assert.match(await lauf('cat ' + datei1), /No such file or directory/);
    assert.ok(await p.evaluate(() => STATE.log.some(l => l.aktion === 'Export gelöscht')));
    /* GUI-Knopf mit Anzahl */
    await p.evaluate(id => { const b = kartenExportLoeschenKnopf('pin', id, null, 'test-loeschen'); document.body.appendChild(b); }, ids.pin);
    await p.waitForFunction(() => $('test-loeschen').textContent === 'Exporte löschen (1)' && !$('test-loeschen').hidden);
    await p.click('#test-loeschen'); await p.click('#dlg-ok');
    await p.waitForFunction(() => /Exporte gelöscht: 1\./.test($('sys-msg').innerText));
    assert.match(await lauf('ls /exports/pins'), /No such file or directory/, 'Verzeichnis ohne zugängliche Exporte besteht nicht');

    /* ---- E ---- */
    const anlegen = (text, art, id, d) => p.evaluate(([t, a, i, dd]) => EXPORTE.anlegen(a, i, dd, t).then(r => r.fehler || r.modus), [text, art || 'pin', id || ids.pin, d || null]);
    const anzahl = () => p.evaluate(() => new Promise(ok => { const r = indexedDB.open('fieldterminal.exporte'); r.onsuccess = () => { const q = r.result.transaction('exporte').objectStore('exporte').count(); q.onsuccess = () => { r.result.close(); ok(q.result); }; }; }));
    assert.equal(await anlegen('x'.repeat(65537)), 'gross');
    const n0 = await anzahl();
    await p.evaluate(n => { EXPORTE_GRENZE.anzahl = n + 1; }, n0);
    assert.equal(await anlegen('LIMIT-A'), 'neu');
    assert.equal(await anlegen('LIMIT-B'), 'grenze', 'Anzahlgrenze');
    assert.equal(await anlegen('LIMIT-A'), 'unveraendert', 'unveränderter Export am Limit wiederverwendet');
    await p.evaluate(() => { EXPORTE_GRENZE.anzahl = 1000; EXPORTE_GRENZE.gesamt = 10; });
    assert.equal(await anlegen('LIMIT-C'), 'grenze', 'Gesamtgröße');
    await p.evaluate(() => { EXPORTE_GRENZE.gesamt = 16 * 1048576; });
    const n1 = await anzahl();
    assert.equal(await p.evaluate(async () => {
      const orig = IDBObjectStore.prototype.add;
      IDBObjectStore.prototype.add = function () { if (this.name === 'texte') throw new DOMException('voll', 'QuotaExceededError'); return orig.apply(this, arguments); };
      try { return (await EXPORTE.anlegen('pin', PROFIL.pins.find(x => x.dossier === 'P-0003').id, null, 'QUOTA')).fehler; } finally { IDBObjectStore.prototype.add = orig; }
    }), 'speicher');
    assert.equal(await anzahl(), n1, 'kein Teilbestand nach Speicherfehler');
    /* zwei Fenster am Limit */
    const p2 = await ctx.newPage();
    p2.on('pageerror', e => fehler.push(e.message));
    await p2.route(/^https?:/, r => r.abort());
    await p2.goto(APP); await p2.fill('#gate-pw', PW); await p2.click('#gate-go');
    await p2.waitForFunction(() => typeof APP_BEREIT !== 'undefined' && APP_BEREIT && !!STATE && !document.body.classList.contains('locked'));
    const n2 = await anzahl();
    for (const q of [p, p2]) await q.evaluate(n => { EXPORTE_GRENZE.anzahl = n + 1; }, n2);
    const [r1, r2] = await Promise.all([p, p2].map((q, i) => q.evaluate(([id, t]) => EXPORTE.anlegen('pin', id, null, t).then(r => r.fehler || r.modus), [ids.pin, 'FENSTER-' + i])));
    assert.deepEqual([r1, r2].sort(), ['grenze', 'neu'], 'genau ein Fenster legt an');
    await p2.close();
    await p.evaluate(() => { EXPORTE_GRENZE.anzahl = 1000; });

    /* ---- F ---- */
    const sicher = await p.evaluate(async () => (await terminalHomePaket(false)).text);
    assert.doesNotMatch(sicher, /MARKE-|LIMIT-A/, 'keine Exporttexte in der Home-Sicherung');
    assert.doesNotMatch(await p.evaluate(() => Object.keys(localStorage).map(k => localStorage.getItem(k)).join('\n')), /LIMIT-A|MARKE-ZWEI\n/, 'keine Exporttexte im Profil');
    await p.close();
    p = await anmelden();
    await p.click('#profil-terminal-oeffnen');
    const inp2 = p.locator('#profil-terminal-eingabe'), out2 = p.locator('#profil-terminal-ausgabe');
    await inp2.fill('ls /exports/zones/' + ids.zone); await inp2.press('Enter');
    await p.waitForFunction(() => !TERMINAL_ZUSTAND.kette && /\.txt/.test($('profil-terminal-ausgabe').textContent));
    assert.match(await out2.textContent(), NAME, 'Export überdauert das Neuladen');
    /* /sendfile aus /exports, Sperre während des Uploads */
    await chatBereit(p);
    await p.clock.pauseAt(await p.evaluate(() => Date.now() + 1000));
    const cmd = async z => { await inp2.fill(z); await inp2.press('Enter'); await p.waitForFunction(() => !TERMINAL_ZUSTAND.kanal?.pruefung); await p.clock.runFor(1); };
    const alle = () => p.evaluate(() => TERMINAL_ZUSTAND.kanal.fenster.map(f => f.log.map(e => e.zeile ?? e).join('\n')).join('\n'));
    await cmd('/sendfile ' + siDatei);
    assert.deepEqual(await p.evaluate(() => TERMINAL_ZUSTAND.kanal.uploads.map(u => u.name)), ['P-0003-SI-801-' + siDatei.split('/').at(-1)]);
    await p.clock.runFor(2500);
    await p.evaluate(() => dispatch({ type: 'DOSSIER_SPERREN', id: 'P-0003' }));
    await p.clock.runFor(20000);
    assert.doesNotMatch(await alle(), /SI-801/, 'kein Abschluss, keine Zeile');
    await cmd('/sendfile ' + zoneDatei);
    assert.match(await alle(), /failed: File not found!/, 'gesperrter Export wie nicht vorhanden');
    assert.deepEqual(fehler, []);
    console.log('OK: Paket 4 M4 (verwaltete Exporte: GUI, Anbieter, Zustände, Löschen, Grenzen, Neustart, Sicherung, Versand)');
  } finally {
    await ctx.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
