/* Paket 4, Review 3 zu #140 (pullrequestreview-6066662192), im echten Browser.
   A (P1, Herkunft beim Anlegen): verzögerter Hash; währenddessen Verknüpfung A -> B und Sperre A bzw. Identitätswechsel: kein Datensatz, kein
     zugänglicher Alttext, Bestand (Quote) unverändert. Sperre innerhalb der Schreibtransaktion: gespeichert, aber nicht bereitgestellt
     ('nachher'), Meldung ohne Pfad und ohne Rückbau-Behauptung. Unveränderte Herkunft: normaler Export.
   B (P1, Schutz für /exports): A-Export, Verknüpfung A -> B, ls, ls -l, ls des Wurzelverzeichnisses, Tab; dann Sperre A: kein verborgener
     Name mehr in den automatisch erzeugten Listen; andere Exporte sichtbar und lesbar. Identitätswechsel und Löschung ebenso.
     Verzögerte Antwort (ls und Tab): Sperre während der Antwort, Prüfung unmittelbar vor Ausgabe bzw. Übernahme.
   C (Bedienung): Zielauswahl bietet Download auch mit Brücke; Sammelbereinigung verwaister Exporte dauerhaft in der Kartenleiste, auch ohne
     verbliebenes Kartenobjekt; gesperrte Exporte bleiben unberührt. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright');
const { APP } = require('./_pfad');

const PW = 'pw-test-123';
(async () => {
  const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'ft-p4r3-')), { reducedMotion: 'reduce' });
  try {
    const fehler = [];
    const p = await ctx.newPage();
    p.setDefaultTimeout(15000);
    p.on('pageerror', e => fehler.push(e.message));
    if (process.env.FT_DEBUG) { p.on('framenavigated', f => console.log('NAV', f.url())); p.on('console', m => console.log('CON', m.text())); }
    await p.route(/^https?:/, r => r.abort());
    await p.goto(APP);
    await p.fill('#gate-pw', PW); if (await p.isVisible('#gate-pw2')) await p.fill('#gate-pw2', PW);
    await p.click('#gate-go');
    await p.waitForFunction(() => typeof APP_BEREIT !== 'undefined' && APP_BEREIT && !!STATE && !document.body.classList.contains('locked'));

    /* Hilfen im Browser: Pin anlegen, Bestand roh zählen (unabhängig vom Zustand), Hash verzögern */
    await p.evaluate(() => {
      window.__neuPin = function (name, dossier) { dispatch({ type: 'PIN_ANGELEGT', ll: [52.47, 13.45], name: name, dossier: dossier || undefined, notiz: 'MARKE-' + name }); return PROFIL.pins.at(-1).id; };
      window.__roh = async function () {
        await EXPORTE.verwaiste();   /* Datenbank zuerst über die Anwendung öffnen (legt Stores an) */
        return new Promise(function (ok) {
          const r = indexedDB.open('fieldterminal.exporte');
          r.onsuccess = function () {
            const t = r.result.transaction(['exporte', 'texte']), a = t.objectStore('exporte').count(), b = t.objectStore('texte').count();
            t.oncomplete = function () { ok([a.result, b.result]); r.result.close(); };
          };
        });
      };
      const orig = crypto.subtle.digest.bind(crypto.subtle);
      window.__hashHalt = null;
      crypto.subtle.digest = function (alg, daten) {
        const h = window.__hashHalt;
        if (!h) return orig(alg, daten);
        window.__hashHalt = null;
        return new Promise(function (ok) { h.weiter = function () { ok(orig(alg, daten)); }; h.erreicht = true; });
      };
    });
    const anlegenMit = async (id, waehrend) => p.evaluate(async ([pid, was]) => {
      const x = PROFIL.pins.find(y => y.id === pid);
      const text = pinText(x) + '\n';                            /* Text wie im Dialog unmittelbar vor dem Aufruf gerendert */
      const halt = window.__hashHalt = {};
      const lauf = EXPORTE.anlegen('pin', pid, null, text);
      while (!halt.erreicht) await new Promise(r => setTimeout(r, 5));
      if (was === 'relink') { dispatch({ type: 'PIN_GEAENDERT', id: pid, dossier: 'P-0002' }); dispatch({ type: 'DOSSIER_SPERREN', id: 'P-0003' }); }
      if (was === 'identitaet') { x.t = '2026-01-02T00:00:00.000Z'; profilSpeichern(); }
      halt.weiter();
      return lauf;
    }, [id, waehrend]);

    /* ---- A ---- */
    const a1 = await p.evaluate(() => __neuPin('HERKUNFT-A', 'P-0003'));
    const vorher = await p.evaluate(() => __roh());
    assert.deepEqual(await anlegenMit(a1, 'relink'), { fehler: 'herkunft' }, 'A -> B und Sperre A während des Hashs');
    assert.deepEqual(await p.evaluate(() => __roh()), vorher, 'kein Datensatz, Bestand unverändert');
    await p.evaluate(() => dispatch({ type: 'DOSSIER_ENTSPERREN', id: 'P-0003' }));
    assert.deepEqual(await p.evaluate(async () => (await EXPORTE.liste()).alle.length), 0, 'kein zugänglicher Alttext');
    const a2 = await p.evaluate(() => __neuPin('HERKUNFT-ID', 'P-0003'));
    assert.deepEqual(await anlegenMit(a2, 'identitaet'), { fehler: 'herkunft' }, 'Identitätswechsel während des Hashs');
    assert.deepEqual(await p.evaluate(() => __roh()), vorher);
    /* Sperre innerhalb der Schreibtransaktion (nach der letzten Prüfung): gespeichert, nicht bereitgestellt */
    const a3 = await p.evaluate(() => __neuPin('NACHHER', 'P-0003'));
    const nachher = await p.evaluate(async pid => {
      const add = IDBObjectStore.prototype.add;
      IDBObjectStore.prototype.add = function (wert) {
        if (this.name === 'texte') { IDBObjectStore.prototype.add = add; dispatch({ type: 'DOSSIER_SPERREN', id: 'P-0003' }); }
        return add.apply(this, arguments);
      };
      meldung('');
      const r = await kartenExportSpeichern('pin', pid, null, pinText(PROFIL.pins.find(y => y.id === pid)) + '\n');
      return { r: r, m: $('sys-msg').innerText };
    }, a3);
    assert.equal(nachher.r.fehler, 'nachher');
    assert.match(nachher.m, /Export nicht bereitgestellt\. Das Objekt wurde während des Speicherns geändert oder gesperrt\.$/);
    assert.doesNotMatch(nachher.m, /\/exports|gespeichert ·|zurückgenommen|rückgängig/, 'kein Pfad, keine Rückbau-Behauptung');
    assert.deepEqual(await p.evaluate(() => __roh()), [vorher[0] + 1, vorher[1] + 1], 'Commit erfolgt (ehrlich gemeldet)');
    assert.equal(await p.evaluate(async () => (await EXPORTE.liste()).alle.length), 0, 'nicht zugänglich');
    await p.evaluate(() => dispatch({ type: 'DOSSIER_ENTSPERREN', id: 'P-0003' }));
    /* unveränderte Herkunft: normaler Export */
    const a4 = await p.evaluate(() => __neuPin('NORMAL', 'P-0003'));
    const normal = await anlegenMit(a4, 'nichts');
    assert.equal(normal.modus, 'neu', JSON.stringify(normal));

    /* ---- B ---- */
    await p.click('#profil-terminal-oeffnen');
    const inp = p.locator('#profil-terminal-eingabe'), out = p.locator('#profil-terminal-ausgabe');
    const lauf = async z => {
      const roh = await out.textContent(), vor = roh === '' ? 0 : roh.split('\n').length;
      await inp.fill(z); await inp.press('Enter'); await p.waitForFunction(() => !TERMINAL_ZUSTAND.kette && !TERMINAL_ZUSTAND.dateiLaeuft);
      return (await out.textContent()).split('\n').slice(vor + 1).join('\n');
    };
    const ausgabe = () => p.evaluate(() => TERMINAL_ZUSTAND.ausgabe.join('\n'));
    const frei = await p.evaluate(() => __neuPin('FREI'));
    assert.equal((await anlegenMit(frei, 'nichts')).modus, 'neu');
    /* Export von b1 mit Ursprung A (P-0003); Verknüpfung A -> B, danach Listen erzeugen */
    const b1 = await p.evaluate(() => __neuPin('B-EXPORT', 'P-0003'));
    assert.equal((await anlegenMit(b1, 'nichts')).modus, 'neu');
    await p.evaluate(id => dispatch({ type: 'PIN_GEAENDERT', id, dossier: 'P-0002' }), b1);
    assert.match(await lauf('ls /exports/pins'), new RegExp(b1));
    assert.match(await lauf('ls -l /exports/pins/' + b1), /-r--r--r--/);
    assert.match(await lauf('ls -d /exports/pins/' + b1), new RegExp(b1));
    assert.equal(await lauf('ls /exports'), 'pins');
    await inp.fill('cat /exports/pins/' + b1); await inp.press('Tab'); await p.waitForTimeout(400);
    assert.equal(await inp.inputValue(), 'cat /exports/pins/' + b1 + '/', 'Tab vor der Sperre');
    await inp.fill('');
    assert.ok((await ausgabe()).includes(b1));
    await p.evaluate(() => dispatch({ type: 'DOSSIER_SPERREN', id: 'P-0003' }));
    const sb = await ausgabe();
    /* getippte Befehlszeilen bleiben (vereinbarte Ausnahme); automatisch erzeugte Zeilen mit dem Namen nicht */
    const erzeugt = sb.split('\n').filter(l => !/^raizo@terminal/.test(l));
    assert.ok(!erzeugt.some(l => l.includes(b1)), 'kein verborgener Name in alten Listen:\n' + erzeugt.join('\n'));
    assert.match(await lauf('ls /exports/pins'), new RegExp('^' + frei + '$'), 'anderer Export sichtbar');
    const freiName = (await lauf('ls /exports/pins/' + frei)).trim();
    assert.match(await lauf('cat /exports/pins/' + frei + '/' + freiName), /MARKE-FREI/, 'anderer Export lesbar');
    await inp.fill('cat /exports/pins/' + b1); await inp.press('Tab'); await p.waitForTimeout(400);
    assert.equal(await inp.inputValue(), 'cat /exports/pins/' + b1, 'Tab ergänzt den gesperrten Export nicht');
    await inp.fill('');
    await p.evaluate(() => dispatch({ type: 'DOSSIER_ENTSPERREN', id: 'P-0003' }));

    /* Identitätswechsel und Löschung entfernen frühere Listenzeilen ebenso */
    const idw = await p.evaluate(() => __neuPin('IDW')), weg = await p.evaluate(() => __neuPin('WEG'));
    assert.equal((await anlegenMit(idw, 'nichts')).modus, 'neu');
    assert.equal((await anlegenMit(weg, 'nichts')).modus, 'neu');
    const l1 = await lauf('ls /exports/pins');
    assert.ok(l1.includes(idw) && l1.includes(weg), l1);
    await p.evaluate(id => { PROFIL.pins.find(y => y.id === id).t = '2026-01-03T00:00:00.000Z'; profilSpeichern(); dispatch({ type: 'PIN_GEAENDERT', id, notiz: 'x' }); }, idw);
    await p.evaluate(id => dispatch({ type: 'PIN_ENTFERNT', id }), weg);
    const sb2 = (await ausgabe()).split('\n').filter(l => !/^raizo@terminal/.test(l));
    assert.ok(!sb2.some(l => l.includes(idw) || l.includes(weg)), 'Identitätswechsel/Löschung:\n' + sb2.join('\n'));

    /* Verzögerte Antwort: Sperre während der Antwort, Prüfung unmittelbar vor Ausgabe bzw. Übernahme */
    await p.evaluate(id => dispatch({ type: 'PIN_GEAENDERT', id, dossier: 'P-0003' }), frei);
    await p.evaluate(() => {
      const baum = EXPORTE_ANBIETER.baum;
      window.__baumHalt = null;
      EXPORTE_ANBIETER.baum = async function () {
        const r = await baum.apply(this, arguments), h = window.__baumHalt;
        if (h) { window.__baumHalt = null; h.erreicht = true; await new Promise(ok => { h.weiter = ok; }); }
        return r;
      };
    });
    /* ls */
    const vorLs = (await out.textContent()).split('\n').length;
    await p.evaluate(() => { window.__baumHalt = {}; window.__halt1 = window.__baumHalt; });
    await inp.fill('ls /exports/pins'); await inp.press('Enter');
    await p.waitForFunction(() => window.__halt1.erreicht);
    await p.evaluate(() => { dispatch({ type: 'DOSSIER_SPERREN', id: 'P-0003' }); window.__halt1.weiter(); });
    await p.waitForFunction(() => !TERMINAL_ZUSTAND.kette && !TERMINAL_ZUSTAND.dateiLaeuft);
    const lsVerz = (await out.textContent()).split('\n').slice(vorLs + 1).join('\n');
    assert.ok(!lsVerz.includes(frei), 'verzögertes ls zeigt den inzwischen gesperrten Export nicht: ' + lsVerz);
    await p.evaluate(() => dispatch({ type: 'DOSSIER_ENTSPERREN', id: 'P-0003' }));
    /* Tab */
    await p.evaluate(() => { window.__baumHalt = {}; window.__halt2 = window.__baumHalt; });
    await inp.fill('cat /exports/pins/' + frei); await inp.press('Tab');
    await p.waitForFunction(() => window.__halt2.erreicht);
    await p.evaluate(() => { dispatch({ type: 'DOSSIER_SPERREN', id: 'P-0003' }); window.__halt2.weiter(); });
    await p.waitForTimeout(400);
    assert.equal(await inp.inputValue(), 'cat /exports/pins/' + frei, 'verzögerter Tab übernimmt keinen gesperrten Export');
    await inp.fill('');

    /* ---- C ---- */
    /* Zielauswahl: Download auch mit Brücke (Brückenadresse simuliert, keine Anfrage beim Öffnen des Dialogs) */
    await p.evaluate(() => dispatch({ type: 'DOSSIER_ENTSPERREN', id: 'P-0003' }));
    const optionen = await p.evaluate(id => {
      const alt = window.terminalBrueckenAdresse;
      window.terminalBrueckenAdresse = function () { return 'http://127.0.0.1:9/'; };
      try { kartenTxtExport('pin', id); return Array.from($('k-txt-ordner').options).map(o => o.value); }
      finally { window.terminalBrueckenAdresse = alt; const d = $('dlg'); if (d.open) d.close(); }
    }, frei);
    assert.deepEqual(optionen, ['exporte', 'dokumente', 'ops', 'download']);
    const ohne = await p.evaluate(id => {
      const alt = window.terminalBrueckenAdresse;
      window.terminalBrueckenAdresse = function () { return ''; };
      try { kartenTxtExport('pin', id); return Array.from($('k-txt-ordner').options).map(o => o.value); }
      finally { window.terminalBrueckenAdresse = alt; const d = $('dlg'); if (d.open) d.close(); }
    }, frei);
    assert.deepEqual(ohne, ['exporte', 'download']);

    /* Sammelbereinigung in der Kartenleiste ohne verbliebenes Kartenobjekt: alle Pins außer a1 entfernen (a1 hat keinen Export). Exporte mit
       Ursprung P-0003 (gesperrt) bleiben unberührt, die übrigen sind verwaist */
    await p.evaluate(() => {
      const behalten = PROFIL.pins.find(y => y.name === 'HERKUNFT-A');
      dispatch({ type: 'PIN_GEAENDERT', id: behalten.id, dossier: 'P-0003' });
      dispatch({ type: 'DOSSIER_SPERREN', id: 'P-0003' });
      PROFIL.pins.filter(y => y.name !== 'HERKUNFT-A').map(y => y.id).forEach(id => dispatch({ type: 'PIN_ENTFERNT', id }));
    });
    const gesperrtVor = await p.evaluate(async () => (await __roh())[0]);
    await p.evaluate(() => { const d = $('dlg'); if (d.open) d.close(); dispatch({ type: 'NAVIGATION', modul: 'karte' }); VIEW.karte.reiter = 'karte'; renderModule(); });
    await p.waitForSelector('#k-export-verwaist-leiste:not([hidden])');
    assert.match(await p.locator('#k-export-verwaist-leiste').innerText(), /^Verwaiste Exporte entfernen \(\d+\)$/);
    await p.click('#k-export-verwaist-leiste');
    assert.match(await p.locator('#k-export-verwaist-leiste').innerText(), /wirklich/);
    await p.evaluate(() => meldung(''));
    await p.click('#k-export-verwaist-leiste');
    await p.waitForFunction(() => /Verwaiste Exporte entfernt: \d+\./.test($('sys-msg').innerText));
    const nach = await p.evaluate(async () => (await __roh())[0]);
    assert.ok(nach >= 1 && nach < gesperrtVor, 'verwaiste entfernt, gesperrte geblieben: ' + gesperrtVor + ' -> ' + nach);
    assert.equal(await p.evaluate(async () => (await EXPORTE.verwaiste()).anzahl), 0);
    await p.evaluate(() => dispatch({ type: 'DOSSIER_ENTSPERREN', id: 'P-0003' }));
    assert.equal(await p.evaluate(async () => (await EXPORTE.verwaiste()).anzahl), nach, 'die zuvor gesperrten Exporte blieben erhalten und sind nach dem Entsperren verwaist');
    assert.equal(await p.evaluate(async () => (await EXPORTE.liste()).alle.length), 0);

    assert.deepEqual(fehler, [], 'keine Seitenfehler: ' + fehler.join('; '));
    console.log('terminal-paket4-review3 grün');
  } finally { await ctx.close(); }
})().catch(e => { console.error(e); process.exit(1); });
