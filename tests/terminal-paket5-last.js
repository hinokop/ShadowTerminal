/* Paket 5, Belastbarkeit mit synthetischen Beständen (nur im Testprofil, kein Nutzerprofil): 200 zusätzliche Dossiers mit Notizen, 1.000 Exporte
   (200 Pins mit je fünf Fassungen), zwei Dateien zu knapp 1 MiB (Grenze des VFS je Datei), gemeinsam knapp 2 MiB im Strom. Gemessen werden Dauer und größte Lücke der Ereignisschleife je Befehl; die Werte
   werden ausgegeben (keine Garantie, abhängig vom Rechner). Geprüft wird nur Korrektheit der Ergebnisse und dass die Oberfläche nicht für
   lange Zeit blockiert (Schwelle 500 ms je Lücke, großzügig wegen geteilter CI-Rechner). */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright');
const { APP } = require('./_pfad');

const PW = 'pw-test-123';
(async () => {
  const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'ft-p5l-')), { reducedMotion: 'reduce' });
  try {
    const p = await ctx.newPage();
    p.setDefaultTimeout(120000);
    const fehler = [];
    p.on('pageerror', e => fehler.push(e.message));
    await p.route(/^https?:/, r => r.abort());
    await p.goto(APP);
    await p.fill('#gate-pw', PW); if (await p.isVisible('#gate-pw2')) await p.fill('#gate-pw2', PW);
    await p.click('#gate-go');
    await p.waitForFunction(() => typeof APP_BEREIT !== 'undefined' && APP_BEREIT && !!STATE && !document.body.classList.contains('locked'));
    const bestand = await p.evaluate(async () => {
      const t0 = performance.now();
      for (let i = 0; i < 200; i++) {
        dispatch({ type: 'DOSSIER_ANGELEGT', name: 'Synthetisch ' + i, typ: 'Person' });
        const id = STATE.dossiers.eigene.at(-1).id;
        dispatch({ type: 'DOSSIER_NOTIZ', id: id, text: 'LASTMARKE ' + (i % 7 === 0 ? 'Berlin' : 'Leipzig') + ' ' + i });
      }
      for (let i = 0; i < 200; i++) dispatch({ type: 'PIN_ANGELEGT', ll: [52 + i / 1000, 13], name: 'L' + i, notiz: 'n' });
      const pins = PROFIL.pins.slice(-200).map(x => x.id);
      let n = 0;
      for (const id of pins) for (let k = 0; k < 5; k++) { const r = await EXPORTE.anlegen('pin', id, null, 'Fassung ' + k + ' von ' + id + ' LASTMARKE\n'); if (r.modus === 'neu') n++; }
      const gross = Array.from({ length: 30000 }, (_, i) => 'eintrag ' + (i % 997) + ' ' + 'x'.repeat(20)).join('\n') + '\n';   /* VFS: höchstens 1 MiB je Datei */
      for (const n of ['gross1.txt', 'gross2.txt']) { const w = await TERMINAL_FS.schreiben(['home', 'raizo', n], gross); if (w.fehler) throw new Error(n + ': ' + w.fehler); }
      return { exporte: n, dossiers: Object.keys(STATE.dossiers.entitaeten).length, ms: Math.round(performance.now() - t0) };
    });
    console.log('Bestand: ' + bestand.dossiers + ' Dossiers, ' + bestand.exporte + ' Exporte, Aufbau ' + bestand.ms + ' ms');
    assert.equal(bestand.exporte, 1000);
    await p.click('#profil-terminal-oeffnen');
    const out = p.locator('#profil-terminal-ausgabe');
    const messen = async zeile => {
      const roh = await out.textContent(), vor = roh === '' ? 0 : roh.split('\n').length;
      const m = await p.evaluate(async z => {
        let max = 0, letzt = performance.now();
        const iv = setInterval(() => { const j = performance.now(); max = Math.max(max, j - letzt); letzt = j; }, 10);
        const t0 = performance.now(), inp = $('profil-terminal-eingabe');
        inp.value = z; inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        await new Promise(ok => { const w = () => (!TERMINAL_ZUSTAND.kette && !TERMINAL_ZUSTAND.dateiLaeuft ? ok() : setTimeout(w, 20)); setTimeout(w, 20); });
        clearInterval(iv);
        return { ms: Math.round(performance.now() - t0), luecke: Math.round(max), status: TERMINAL_ZUSTAND.status };
      }, zeile);
      m.aus = (await out.textContent()).split('\n').slice(vor + 1).join('\n');
      console.log('  ' + zeile + ' -> ' + m.ms + ' ms, größte Lücke ' + m.luecke + ' ms');
      assert.ok(m.luecke < 500, zeile + ': Ereignisschleife ' + m.luecke + ' ms blockiert');
      return m;
    };
    assert.equal((await messen('grep -ri lastmarke /intel/dossiers/persons | wc -l')).aus, '200');
    assert.equal((await messen('grep -rli "lastmarke berlin" /intel/dossiers/persons | wc -l')).aus, '29');
    assert.equal((await messen('find /exports -name "*.txt" | wc -l')).aus, '1000');
    assert.equal((await messen('grep -r LASTMARKE /exports | wc -l')).aus, '1000');
    assert.equal((await messen('find /intel -type f | wc -l')).status, 0);
    const s = await messen('cat ~/gross1.txt ~/gross2.txt | sort | uniq -c | sort -rn | head -n 3');
    assert.equal(s.aus.split('\n').length, 3, s.aus);
    assert.match(s.aus, /^ {5}62 eintrag \d+ x{20}$/m);
    assert.equal((await messen('grep -c "eintrag 5 " ~/gross1.txt')).aus, '31');
    assert.equal((await messen('wc -l ~/gross1.txt ~/gross2.txt')).aus, '  30000 /home/raizo/gross1.txt\n  30000 /home/raizo/gross2.txt\n  60000 total');
    assert.deepEqual(fehler, []);
    console.log('terminal-paket5-last grün');
  } finally { await ctx.close(); }
})().catch(e => { console.error(e); process.exit(1); });
