/* Phase 5c1b, Nachbesserung nach unabhängigem Review (PR #111): Ladefehler und Schreibsperre.
   Prüft, dass ein vorhandener gespeicherter Zustand in keinem Fehlerpfad ohne geprüfte Sicherung überschrieben wird und das Profil
   bei gesperrter Zustandsspeicherung nicht teilweise fortgeschrieben wird:
   (A) Schreibprobe des Browserspeichers scheitert, vorhandener Zustand Format 4: Rohtext und Profil unverändert, Sitzung nicht persistent;
   (B) dasselbe mit vorhandenem Zustand Format 5;
   (C) ungültiges JSON, Ablage unter .defekt scheitert: Rohtext unverändert, Sitzung nicht persistent;
   (C2) ungültiges JSON, Ablage gelingt: Normalfall, Rohtext unter .defekt, neuer Zustand, keine Sperre;
   (D) Zustand lässt sich nach dem Schreiben nicht zurücklesen: Meldung behauptet keinen unveränderten Stand, Rückschreibversuch des Originals;
   (E) Sicherung scheitert und Speichern scheitert (bereits in phase5c1b-zustandsformat): hier zusätzlich Profil unverändert;
   (F) Lesefehler beim Laden des gespeicherten Zustands: Sperre, Rohtext unverändert;
   (H) vorhandener, aber leerer Schlüssel (''): gilt als defekt, nicht als fehlend. Rohtext wird unter .defekt gesichert, bevor ein neuer Zustand entsteht;
   (H2) dasselbe mit misslungener Ablage unter .defekt: Rohtext unverändert, Sitzung nicht persistent;
   (H3) eine frühere, nicht leere Ablage unter .defekt wird durch einen leeren Rohtext nicht überschrieben.
   Exit-Code 1 bei Fehlschlag. */
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { APP } = require('./_pfad');
const FIX = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'altprofil-mission.json'), 'utf8'));
const SICH = 'fieldterminal.v1.v4-sicherung';
const SCHL = 'fieldterminal.v1';

function v4Eingang() {
  const s = JSON.parse(JSON.stringify(FIX.state));
  s.agent.notizen = 'Notiz aus Format 4'; s.agent.notizenGeaendert = '2026-11-14T08:00:00.000Z';
  const pr = JSON.parse(JSON.stringify(FIX.profil));
  delete pr.profiltexte;
  return { state: JSON.stringify(s), profil: JSON.stringify(pr) };
}

(async () => {
  const browser = await chromium.launch();
  const fehler = [];
  try {
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 }, reducedMotion: 'reduce' });
    /* Erzwungene Fehler über Regeln in sessionStorage:
       ft-fehler: { exakt: [...], praefix: [...] }  setItem wirft für diese Schlüssel
       ft-lesen:  { schluessel, nachSchreiben }     getItem wirft für den Schlüssel, bei nachSchreiben erst nach einem erfolgreichen Schreiben von Format 5
       ft-lesen:  { schluessel }                    ohne nachSchreiben sofort */
    await ctx.addInitScript(() => {
      const setO = Storage.prototype.setItem, getO = Storage.prototype.getItem;
      let v5Geschrieben = false;
      const regel = n => { try { return JSON.parse(window.sessionStorage.getItem(n) || 'null'); } catch (e) { return null; } };
      Storage.prototype.setItem = function (k, v) {
        if (this === window.localStorage) {
          const r = regel('ft-fehler');
          if (r && ((r.exakt || []).includes(k) || (r.praefix || []).some(x => String(k).indexOf(x) === 0))) {
            const e = new Error('Speicher voll (Test)'); e.name = 'QuotaExceededError'; throw e;
          }
        }
        const x = setO.call(this, k, v);
        if (this === window.localStorage && k === 'fieldterminal.v1' && /"version":5\b/.test(String(v))) v5Geschrieben = true;
        return x;
      };
      Storage.prototype.getItem = function (k) {
        if (this === window.localStorage) {
          const r = regel('ft-lesen');
          if (r && k === r.schluessel && (!r.nachSchreiben || v5Geschrieben)) { const e = new Error('Lesefehler (Test)'); e.name = 'SecurityError'; throw e; }
        }
        return getO.call(this, k);
      };
      window.__roh = k => getO.call(window.localStorage, k);
    });
    const p = await ctx.newPage();
    p.setDefaultTimeout(20000);
    p.on('pageerror', e => fehler.push(e.message));
    await p.route(/^https?:/, r => r.abort());
    const anmelden = async () => {
      await p.goto(APP);
      await p.fill('#gate-pw', 'pw-test-123');
      if (await p.isVisible('#gate-pw2')) await p.fill('#gate-pw2', 'pw-test-123');
      await p.click('#gate-go');
      await p.waitForFunction(() => !document.body.classList.contains('locked'));
    };
    const regeln = (f, l) => p.evaluate(a => {
      if (a.f) sessionStorage.setItem('ft-fehler', JSON.stringify(a.f)); else sessionStorage.removeItem('ft-fehler');
      if (a.l) sessionStorage.setItem('ft-lesen', JSON.stringify(a.l)); else sessionStorage.removeItem('ft-lesen');
    }, { f, l });
    const einlegen = roh => p.evaluate(a => {
      Object.keys(localStorage).filter(k => k.indexOf(STORAGE_KEY + '.v4-sicherung') === 0 || k === STORAGE_KEY + '.defekt').forEach(k => localStorage.removeItem(k));
      localStorage.setItem(STORAGE_KEY, a.state); localStorage.setItem(PROFIL_KEY, a.profil);
    }, roh);
    const lesen = () => p.evaluate(() => ({ roh: window.__roh('fieldterminal.v1'), profil: window.__roh('fieldterminal.v1.profil'), defekt: window.__roh('fieldterminal.v1.defekt'),
      sich: window.__roh('fieldterminal.v1.v4-sicherung'), grund: Store.sperrgrund, persist: Store.isPersistent(), v: STATE && STATE.version,
      meldung: document.getElementById('sys-msg').textContent, kopf: document.getElementById('h-persist').textContent }));

    /* Ausgangslage: Seite einmal laden, damit sessionStorage und STORAGE_KEY erreichbar sind */
    await anmelden();
    const roh4 = v4Eingang();
    const rot = [];
    const fall = async (n, f) => { try { await f(); } catch (e) { rot.push(n + ': ' + String(e && e.message || e).split('\n')[0]); } };

    /* (A) Schreibprobe scheitert, Zustand Format 4 vorhanden */
    await fall('A', async () => {
    await einlegen(roh4);
    await regeln({ exakt: [SCHL + '.probe'] }, null);
    await anmelden();
    const a = await lesen();
    assert.equal(a.roh, roh4.state, 'A: gespeicherter Zustand Format 4 bleibt zeichengleich');
    assert.equal(a.profil, roh4.profil, 'A: Profil bleibt zeichengleich');
    assert.ok(a.grund, 'A: Schreibsperre gesetzt'); assert.equal(a.persist, false, 'A: Sitzung nicht persistent');
    assert.match(a.kopf, /nicht persistent/); assert.match(a.meldung, /nicht gespeichert/);
    assert.equal(a.v, 5, 'A: Sitzung arbeitet mit dem vorhandenen (überführten) Zustand, nicht mit einem leeren');
    assert.ok(a.sich === null || a.sich === roh4.state, 'A: eine etwaige Sicherung ist der Rohtext');

    });
    /* (B) Schreibprobe scheitert, Zustand Format 5 vorhanden */
    await fall('B', async () => {
    await regeln(null, null);
    await einlegen(roh4);
    await anmelden();
    const v5 = await p.evaluate(() => ({ state: localStorage.getItem(STORAGE_KEY), profil: localStorage.getItem(PROFIL_KEY) }));
    assert.equal(JSON.parse(v5.state).version, 5);
    await einlegen(v5);
    await regeln({ exakt: [SCHL + '.probe'] }, null);
    await anmelden();
    const b = await lesen();
    assert.equal(b.roh, v5.state, 'B: gespeicherter Zustand Format 5 bleibt zeichengleich');
    assert.equal(b.profil, v5.profil, 'B: Profil bleibt zeichengleich');
    assert.ok(b.grund, 'B: Schreibsperre gesetzt'); assert.equal(b.persist, false);
    assert.equal(await p.evaluate(() => STATE.log.length > 0 && STATE.dossiers && STATE.dossiers.entitaeten['P-0001'] ? 1 : 0), 1, 'B: Sitzung arbeitet mit dem vorhandenen Zustand');

    });
    /* (C) Ungültiges JSON, Ablage unter .defekt scheitert */
    await fall('C', async () => {
    await regeln(null, null);
    await einlegen({ state: '{kein json', profil: roh4.profil });
    await regeln({ exakt: [SCHL + '.defekt'] }, null);
    await anmelden();
    const c = await lesen();
    assert.equal(c.roh, '{kein json', 'C: nicht lesbarer Rohtext bleibt unverändert, solange er nicht gesichert ist');
    assert.equal(c.profil, roh4.profil, 'C: Profil bleibt zeichengleich');
    assert.ok(c.grund, 'C: Schreibsperre gesetzt'); assert.equal(c.persist, false);
    assert.equal(c.defekt, null);

    });
    /* (C2) Ungültiges JSON, Ablage gelingt: Normalfall */
    await fall('C2', async () => {
    await regeln(null, null);
    await einlegen({ state: '{kein json', profil: roh4.profil });
    await anmelden();
    const c2 = await lesen();
    assert.equal(c2.defekt, '{kein json', 'C2: Rohtext unter .defekt gesichert');
    assert.equal(c2.grund, null); assert.equal(c2.persist, true);
    assert.equal(JSON.parse(c2.roh).version, 5, 'C2: neuer Zustand gespeichert');
    assert.match(c2.meldung, /nicht lesbar/);

    });
    /* (D) Zustand lässt sich nach dem Schreiben nicht zurücklesen */
    await fall('D', async () => {
    await regeln(null, null);
    await einlegen(roh4);
    await regeln(null, { schluessel: SCHL, nachSchreiben: true });
    await anmelden();
    const d = await lesen();
    assert.ok(d.grund, 'D: Sperre gesetzt');
    assert.equal(d.persist, false);
    assert.equal(d.roh, roh4.state, 'D: Original wurde zurückgeschrieben');
    assert.equal(d.sich, roh4.state, 'D: Sicherung vorhanden');
    assert.equal(d.profil, roh4.profil, 'D: Profil bleibt zeichengleich');
    assert.match(d.meldung, /nicht bestätigt/, 'D: Meldung nennt den unbestätigten Stand');
    assert.doesNotMatch(d.meldung, /bleibt unverändert/, 'D: Meldung behauptet keinen unveränderten Stand, der nicht geprüft wurde');

    });
    /* (E) Sicherung scheitert: Profil unverändert */
    await fall('E', async () => {
    await regeln(null, null);
    await einlegen(roh4);
    await regeln({ praefix: [SICH] }, null);
    await anmelden();
    const e = await lesen();
    assert.equal(e.roh, roh4.state); assert.equal(e.profil, roh4.profil, 'E: Profil bleibt bei misslungener Sicherung zeichengleich');
    assert.ok(e.grund);

    });
    /* (E2) Speichern des überführten Zustands scheitert: Profil unverändert */
    await fall('E2', async () => {
    await regeln(null, null);
    await einlegen(roh4);
    await regeln({ exakt: [SCHL] }, null);
    await anmelden();
    const e2 = await lesen();
    assert.equal(e2.roh, roh4.state); assert.equal(e2.profil, roh4.profil, 'E2: Profil bleibt bei misslungenem Speichern zeichengleich');
    assert.ok(e2.grund);

    });
    /* (F) Lesefehler beim Laden */
    await fall('F', async () => {
    await regeln(null, null);
    await einlegen(roh4);
    await regeln(null, { schluessel: SCHL });
    await anmelden();
    const f = await lesen();
    assert.equal(f.roh, roh4.state, 'F: gespeicherter Stand bleibt zeichengleich');
    assert.equal(f.profil, roh4.profil, 'F: Profil bleibt zeichengleich');
    assert.ok(f.grund, 'F: Sperre gesetzt'); assert.equal(f.persist, false);

    });
    /* (H) Vorhandener, aber leerer Schlüssel: defekt, nicht fehlend */
    await fall('H', async () => {
    await regeln(null, null);
    await einlegen({ state: '', profil: roh4.profil });
    await anmelden();
    const h = await lesen();
    assert.equal(h.defekt, '', 'H: leerer Rohtext unter .defekt abgelegt (Existenz des Schlüssels nachgewiesen)');
    assert.equal(h.grund, null); assert.equal(h.persist, true);
    assert.equal(JSON.parse(h.roh).version, 5, 'H: danach neuer Zustand');
    assert.match(h.meldung, /nicht lesbar/);
    });

    /* (H2) Leerer Schlüssel, Ablage unter .defekt scheitert */
    await fall('H2', async () => {
    await regeln(null, null);
    await einlegen({ state: '', profil: roh4.profil });
    await regeln({ exakt: [SCHL + '.defekt'] }, null);
    await anmelden();
    const h2 = await lesen();
    assert.equal(h2.roh, '', 'H2: leerer Rohtext bleibt unberührt');
    assert.equal(h2.profil, roh4.profil, 'H2: Profil bleibt zeichengleich');
    assert.ok(h2.grund, 'H2: Schreibsperre gesetzt'); assert.equal(h2.persist, false);
    });

    /* (H3) Frühere, nicht leere Ablage unter .defekt wird durch einen leeren Rohtext nicht überschrieben */
    await fall('H3', async () => {
    await regeln(null, null);
    await einlegen({ state: '', profil: roh4.profil });
    await p.evaluate(() => localStorage.setItem(STORAGE_KEY + '.defekt', '{frueherer defekter stand'));
    await anmelden();
    const h3 = await lesen();
    assert.equal(h3.defekt, '{frueherer defekter stand', 'H3: frühere Ablage bleibt erhalten');
    assert.equal(h3.grund, null); assert.equal(JSON.parse(h3.roh).version, 5);
    });

    /* (G) Normalfall ohne Fehler: Überführung, Profil wird danach geschrieben */
    await fall('G', async () => {
    await regeln(null, null);
    await einlegen(roh4);
    await anmelden();
    const g = await lesen();
    assert.equal(g.grund, null); assert.equal(g.persist, true);
    assert.equal(JSON.parse(g.roh).version, 5);
    assert.notEqual(g.profil, roh4.profil, 'G: Profil wird nach geprüfter Überführung fortgeschrieben (Profiltexte)');
    assert.equal(JSON.parse(g.profil).profiltexte.notizen.text, 'Notiz aus Format 4');

    });
    assert.deepEqual(rot, [], 'fehlgeschlagene Fälle');
    assert.deepEqual(fehler, [], 'keine Seitenfehler');
    console.log('phase5c1b-ladefehler: alle Prüfungen bestanden');
  } catch (e) {
    console.log('FAIL', e && e.message ? e.message : e);
    if (fehler.length) console.log('Seitenfehler:', fehler.slice(0, 5));
    process.exitCode = 1;
  } finally { await browser.close(); }
})();
