/* Paket 2, Review #138: Regressionen zu den Befunden.
   A: Schutzmetadaten: Datei- und Zeilenabhängigkeiten vereinigt (Galerie, Links A->B bei Sperre A und B), mehrzeilige Benutzerfelder einzeilig
      dargestellt, head/tail, Sperre zwischen Antwort des Anbieters und Ausgabe; geprüft im rohen Scrollback (TERMINAL_ZUSTAND.ausgabe).
   B: gemischtes ls /intel + Archiv (beide Reihenfolgen, -l): beide Schutzarten wirken; verzögerte Archivantwort mit Sperre dazwischen.
   C: E6 am tatsächlichen Lesepfad ("--", führender Bindestrich, Zieldatei bleibt erhalten, Rückfall bei verfehlter Vorprüfung);
      Notizquellen (nur echo und VFS-Dateien) und Notizziel (fehlender Zwischenordner, notes/, notes/.).
   D: Notiz-Commit: selektive Speicherfehler (nur Zustand, nur Profil, Fehler beim Zurückschreiben), volles Protokoll, Neuladen.
   E: Fall mit Einträgen aus Modul X und echter Unterlage (Quelle, Fassung mit Hash, Beobachtung, verknüpftes Dossier, Sperre); englische Werte.
   F: Knöpfe "Im Terminal" in den Kartenpopups, Belegung (tmux oben, PREDICT, Profanity-Kanal, PPP im Vordergrund), Fallentwurf bleibt.
   G: Tab-Ergänzung und Vorschlag verwerfen Ergebnisse einer früheren Sperrgeneration. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright');
const { APP } = require('./_pfad');

const PW = 'pw-test-123';
(async () => {
  const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'ft-intels-')), { reducedMotion: 'reduce', viewport: { width: 1280, height: 900 } });
  try {
    let p = await ctx.newPage();
    p.setDefaultTimeout(15000);
    const fehlerSeite = [];
    const anmelden = async () => {
      p.on('pageerror', e => fehlerSeite.push(e.message));
      await p.route(/^https?:/, r => r.abort());
      await p.goto(APP);
      await p.fill('#gate-pw', PW);
      if (await p.isVisible('#gate-pw2')) await p.fill('#gate-pw2', PW);
      await p.click('#gate-go');
      await p.waitForFunction(() => typeof APP_BEREIT !== 'undefined' && APP_BEREIT && !document.body.classList.contains('locked') && !!STATE);
    };
    await anmelden();
    const setup = await p.evaluate(() => {
      /* Galerie direkt im Profil (bildGueltig verlangt ein echtes Bild); der zweite Eintrag entspricht importierten Altdaten mit Zeilenumbruch */
      PROFIL.galerie['P-0002'] = [{ id: 'G-001', t: nowIso(), bild: 'data:image/png;base64,iVBORw0KGgo=', text: 'GALERIEMARKER' }];
      PROFIL.galerie['P-0002'].push({ id: 'G-099', t: nowIso(), bild: 'data:image/png;base64,iVBORw0KGgo=', text: 'Zeile eins\nZWEITZEILEMARKER' });   /* importierte Altdaten mit Zeilenumbruch */
      dispatch({ type: 'PIN_ANGELEGT', ll: [52.47, 13.45], name: 'PINMARKER', dossier: 'P-0003' });
      dispatch({ type: 'OZONE_ANGELEGT', ll: [52.47, 13.45] });
      const zone = PROFIL.zonen.at(-1).id;
      dispatch({ type: 'OZONE_GEAENDERT', id: zone, dossier: 'P-0003' });
      let fall = null;
      xSchreiben(function () {
        fall = xAnlegen({ titel: 'Fall Beta', frage: 'Woher?' }, 'P-0002');
        fall.eintraege = [{ uid: 'u1', art: 'schritt', text: 'Lieferanten prüfen', erfasst: '2026-01-02T03:04:05.000Z' }, { uid: 'u2', art: 'frage', text: 'Wer zahlt?', erfasst: '2026-01-03T03:04:05.000Z' }];
        return fall;
      });
      dispatch({ type: 'RECHERCHE_BELEG', dossier: 'P-0003', fall: fall.id, art: 'Datei', herkunft: 'Hinweisgeber', notiz: 'Original',
        fassung: { dateiname: 'bericht.pdf', groesse: 2048, typ: 'application/pdf', hash: 'ab'.repeat(32), anhang: false }, zitat: 'ZITATMARKER', fundstelle: { typ: 'Seite', wert: '4' } });
      const R = PROFIL.recherche;
      return { pin: PROFIL.pins.at(-1).id, zone: zone, fall: fall.id, q: R.quellen.at(-1).id, v: R.fassungen.at(-1).id };
    });
    await p.click('#profil-terminal-oeffnen');
    const inp = p.locator('#profil-terminal-eingabe'), out = p.locator('#profil-terminal-ausgabe'), prompt = p.locator('#profil-terminal-prompt');
    const cmd = async zeile => { await inp.fill(zeile); await inp.press('Enter'); await p.waitForFunction(() => !TERMINAL_ZUSTAND.kette); };
    const lauf = async zeile => {
      const roh = await out.textContent(), vorher = roh === '' ? 0 : roh.split('\n').length;
      await cmd(zeile);
      return (await out.textContent()).split('\n').slice(vorher + 1).join('\n');
    };
    const roh = () => p.evaluate(() => TERMINAL_ZUSTAND.ausgabe.join('\n'));
    const sperren = id => p.evaluate(i => dispatch({ type: 'DOSSIER_SPERREN', id: i }), id);
    const entsperren = id => p.evaluate(i => dispatch({ type: 'DOSSIER_ENTSPERREN', id: i }), id);
    const P2 = '/intel/dossiers/persons/P-0002', P1 = '/intel/dossiers/persons/P-0001';

    /* ---- A: Schutzmetadaten ---- */
    const bilder = await lauf('cat ' + P2 + '/images');
    assert.match(bilder, /GALERIEMARKER/);
    assert.match(bilder, /Zeile eins\\nZWEITZEILEMARKER/, 'Zeilenumbruch kontrolliert maskiert, eine physische Zeile');
    assert.equal(bilder.split('\n').length, 3, 'Kopf und zwei Datensätze');
    await lauf('head -n 2 ' + P2 + '/images');
    await lauf('tail -n 1 ' + P2 + '/images');
    /* Links A -> B: Sperre des Ausgangsdossiers (A) und der Gegenstelle (B) entfernen die Zeile */
    const links = await lauf('cat ' + P1 + '/links');
    assert.match(links, /^<-> {2}P-0007 {2}contact {5}B2 {6}/m, 'Beziehungsart englisch');
    assert.match(links, /^-> {3}L-0002 {2}employment/m);
    await sperren('P-0002');
    let r = await roh();
    assert.doesNotMatch(r, /GALERIEMARKER|ZWEITZEILEMARKER|Zeile eins/, 'Galerie (auch head/tail) nach Sperre aus dem rohen Scrollback entfernt');
    await entsperren('P-0002');
    await sperren('P-0001');
    r = await roh();
    assert.doesNotMatch(r, /P-0007 {2}contact/, 'Sperre des Ausgangsdossiers entfernt die Zeile');
    await entsperren('P-0001');
    await lauf('cat ' + P1 + '/links');
    await sperren('P-0007');
    r = await roh();
    assert.doesNotMatch(r, /P-0007 {2}contact/, 'Sperre der Gegenstelle entfernt die Zeile');
    assert.match(r, /L-0002 {2}employment/, 'übrige Zeilen bleiben');
    await entsperren('P-0007');
    /* Sperre zwischen Antwort des Anbieters und Ausgabe */
    await p.evaluate(() => {
      const orig = TERMINAL_FS.readFile;
      TERMINAL_FS.readFile = async function (seg) { const x = await orig.call(this, seg); TERMINAL_FS.readFile = orig; dispatch({ type: 'DOSSIER_SPERREN', id: 'P-0002' }); return x; };
    });
    assert.equal(await lauf('cat ' + P2 + '/images'), '', 'nichts ausgegeben');
    assert.doesNotMatch(await roh(), /GALERIEMARKER/);
    await entsperren('P-0002');
    /* ls: Verzeichnisabhängigkeit für die ganze Ausgabe */
    await lauf('ls -l ' + P2);
    await sperren('P-0002');
    assert.doesNotMatch(await roh(), /-r--r--r-- .* images$/m, 'Langliste des gesperrten Dossiers entfernt');
    await entsperren('P-0002');

    /* ---- B: gemischtes ls mit Archiv (Ersatzbrücke) ---- */
    await p.evaluate((zone) => {
      window.__verz = 0;
      terminalBrueckeSenden = async d => {
        if (d.op === 'ls') { if (window.__verz) await new Promise(r => setTimeout(r, window.__verz)); return { entries: [{ name: 'zone-' + zone + '.txt', dir: false }, { name: 'neutral.txt', dir: false }], next: null }; }
        if (d.op === 'cd') return {};
        return { error: 'Permission denied' };
      };
    }, setup.zone);
    const A = '/pgcl-eu3.arch07';
    for (const z of ['ls ' + A + ' /intel/geospatial/zones', 'ls -l /intel/geospatial/zones ' + A]) {
      const aus = await lauf(z);
      assert.match(aus, new RegExp('zone-' + setup.zone + '\\.txt'), z + ': Exportname frei sichtbar');
      assert.match(aus, new RegExp(setup.zone + '$', 'm'));
    }
    await sperren('P-0003');
    r = await roh();
    assert.doesNotMatch(r, new RegExp('zone-' + setup.zone), 'Exportname nach Sperre aus beiden gemischten Ausgaben entfernt');
    assert.doesNotMatch(r, new RegExp('^' + setup.zone + '$', 'm'), 'Zonenverzeichnis aus /intel entfernt');
    assert.match(r, /neutral\.txt/);
    await entsperren('P-0003');
    /* verzögerte Archivantwort, Sperre während des Wartens */
    await p.evaluate(() => { window.__verz = 600; });
    await inp.fill('ls /intel/geospatial/zones ' + A); await inp.press('Enter');
    await p.waitForTimeout(200);
    await sperren('P-0003');
    await p.waitForFunction(() => !TERMINAL_ZUSTAND.kette);
    await p.evaluate(() => { window.__verz = 0; });
    r = await roh();
    assert.doesNotMatch(r, new RegExp('zone-' + setup.zone + '|^' + setup.zone + '$', 'm'), 'verspätete Antwort zeigt nichts Gesperrtes');
    await entsperren('P-0003');

    /* ---- C: E6 am Lesepfad, Notizquellen, Notizziel ---- */
    await cmd('cd ~');
    await lauf('mkdir -- -x; echo alt > ziel.txt');
    assert.equal(await lauf('ls -- -x/../../../intel/dossiers/persons > liste'), 'bash: ls: Operation not permitted');
    assert.equal(await lauf('ls -- -x/../../../intel > ziel.txt'), 'bash: ls: Operation not permitted');
    assert.equal(await lauf('cat -- /intel/README > ziel.txt'), 'bash: cat: Operation not permitted');
    assert.equal(await lauf('head -n 1 -- /intel/README >> ziel.txt'), 'bash: head: Operation not permitted');
    assert.equal(await lauf('cat ziel.txt; ls'), 'alt\n-x\nziel.txt', 'Zieldatei unverändert, keine neue Datei');
    /* verfehlte Vorprüfung (simuliert): Durchsetzung am Lesepfad, Zieldatei erhält ihren Inhalt zurück */
    await p.evaluate(() => { window.__lies = terminalLiestIntel; terminalLiestIntel = function () { return false; }; });
    assert.equal(await lauf('cat /intel/README > ziel.txt'), 'bash: cat: Operation not permitted');
    assert.equal(await lauf('ls /intel > neu.txt'), 'bash: ls: Operation not permitted');
    await p.evaluate(() => { terminalLiestIntel = window.__lies; });
    assert.equal(await lauf('cat ziel.txt; ls'), 'alt\n-x\nziel.txt', 'Inhalt wiederhergestellt, neue Datei entfernt');
    /* Restblocker Review 2: keinerlei Zielmutation bei E6-Abweisung (Inhalt und Änderungszeit), echter Pfad über /intel/.., ">" und ">>",
       fehlendes und bestehendes Ziel, erzwungene Vorfilterabweichung, verzögerte Quelle mit konkurrierender Änderung; Selbstumleitung */
    const knoten = (name) => p.evaluate(async (n) => { const e = (await TERMINAL_VFS.exportieren()).eintraege.find(x => x.pfad === n); return e ? [e.inhalt, e.geaendert] : null; }, name);
    const zielVorher = await knoten('ziel.txt');
    await p.waitForTimeout(20);
    for (const art of ['>', '>>']) {
      assert.equal(await lauf('ls /intel/../home/raizo ' + art + ' ~/neu-' + art.length + '.txt'), 'bash: ls: Operation not permitted', 'echter Pfad ' + art);
      assert.equal(await knoten('neu-' + art.length + '.txt'), null, 'fehlendes Ziel nicht angelegt (' + art + ')');
      assert.equal(await lauf('ls /intel/../home/raizo ' + art + ' ziel.txt'), 'bash: ls: Operation not permitted');
      assert.deepEqual(await knoten('ziel.txt'), zielVorher, 'bestehendes Ziel unverändert, auch die Änderungszeit (' + art + ')');
    }
    await p.evaluate(() => { window.__lies = terminalLiestIntel; terminalLiestIntel = function () { return false; }; });
    for (const art of ['>', '>>']) {
      assert.equal(await lauf('cat /intel/README ' + art + ' ziel.txt'), 'bash: cat: Operation not permitted', 'Vorfilterabweichung ' + art);
      assert.deepEqual(await knoten('ziel.txt'), zielVorher);
      assert.equal(await lauf('head -n 1 /intel/README ' + art + ' frisch.txt'), 'bash: head: Operation not permitted');
      assert.equal(await knoten('frisch.txt'), null);
    }
    /* verzögerte Quelle, ein anderes Fenster ändert währenddessen das Ziel: die fremde Änderung bleibt */
    await lauf('echo quelle > q.txt');
    await p.evaluate(() => {
      window.__rf = TERMINAL_FS.readFile;
      TERMINAL_FS.readFile = async function (seg) {
        if (seg.join('/') === 'home/raizo/q.txt') { await new Promise(z => setTimeout(z, 300)); await TERMINAL_VFS.schreiben(['home', 'raizo', 'ziel.txt'], 'fremd\n', {}); }
        return window.__rf.call(this, seg);
      };
    });
    assert.equal(await lauf('cat q.txt /intel/README > ziel.txt'), 'bash: cat: Operation not permitted');
    await p.evaluate(() => { TERMINAL_FS.readFile = window.__rf; terminalLiestIntel = window.__lies; });
    assert.equal(await lauf('cat ziel.txt'), 'fremd', 'konkurrierende Änderung nicht überschrieben');
    await lauf('echo alt > ziel.txt');
    /* Selbstumleitung: nichts aus dem Ziel übernehmen */
    await lauf('echo inhalt > s1.txt; echo x > s2.txt');
    assert.equal(await lauf('cat s1.txt > s1.txt'), 'cat: s1.txt: input file is output file');
    assert.equal(await lauf('cat s1.txt'), '', '">": Ziel danach leer (wie bash)');
    assert.equal(await lauf('cat s2.txt >> s2.txt'), 'cat: s2.txt: input file is output file');
    assert.equal(await lauf('cat s2.txt'), 'x', '">>": unverändert');
    await lauf('rm s1.txt s2.txt q.txt');
    /* Review 3: schreibende Befehle mit Umleitung vor jeder Ausführung abgewiesen (kein Datenverlust bei ungültigem oder gültigem Ziel) */
    await lauf('echo wichtig > wichtig.txt; mkdir ordner');
    const zielR3 = await knoten('ziel.txt');
    const nichtUnterst = b => 'bash: ' + b + ': output redirection is not supported for commands that change files';
    for (const [z, b] of [['rm wichtig.txt > /etc/nicht-schreibbar.txt', 'rm'], ['rm wichtig.txt > fehlt/out.txt', 'rm'], ['rm wichtig.txt > ordner', 'rm'],
      ['mv wichtig.txt w2.txt > /etc/x.txt', 'mv'], ['mv wichtig.txt w2.txt > gueltig.txt', 'mv'], ['rm wichtig.txt >> ziel.txt', 'rm'],
      ['cp wichtig.txt w3.txt > gueltig.txt', 'cp'], ['touch t.txt > gueltig.txt', 'touch'], ['mkdir m > gueltig.txt', 'mkdir'], ['rmdir ordner > gueltig.txt', 'rmdir']]) {
      assert.equal(await lauf(z), nichtUnterst(b), z);
      assert.equal(await lauf('cat wichtig.txt'), 'wichtig', z + ': Quelle unverändert');
    }
    assert.equal(await lauf('ls'), 'ordner\nwichtig.txt\n-x\nziel.txt', 'keine Nebenwirkung, kein Ziel angelegt');
    assert.deepEqual(await knoten('ziel.txt'), zielR3, 'gültiges Ziel unverändert, auch die Änderungszeit');
    /* ohne Umleitung unverändert funktionsfähig */
    assert.equal(await lauf('mv wichtig.txt w2.txt; rm w2.txt; rmdir ordner; ls'), '-x\nziel.txt');
    /* ein einziger Schreibvorgang: scheitert er (Dateigrenze), bleibt der bisherige Inhalt */
    await p.evaluate(() => TERMINAL_FS.schreiben(['home', 'raizo', 'gross.txt'], 'g'.repeat(700000), {}));
    assert.equal(await lauf('cat gross.txt gross.txt > ziel.txt'), 'bash: cat: write error: File too large');
    assert.equal(await lauf('cat ziel.txt'), 'alt', 'Ziel nach gescheitertem Schreiben unverändert');
    await lauf('rm gross.txt');
    /* Notizquellen */
    await cmd('cd ' + P1);
    const n0 = await p.evaluate(() => STATE.dossiers.entitaeten['P-0001'].notizen.length);
    const nurQ = 'bash: notes: only echo or text files from /home and /tmp can be appended to notes';
    assert.equal(await lauf('ls ' + A + ' >> notes'), nurQ);
    assert.equal(await lauf('ls ~ >> notes'), nurQ);
    assert.equal(await lauf('cat ' + A + '/neutral.txt >> notes'), nurQ);
    assert.equal(await lauf('pwd >> notes'), nurQ);
    /* Notizziel */
    assert.equal(await lauf('echo x >> /intel/dossiers/persons/fehlt/../P-0001/notes'), 'bash: /intel/dossiers/persons/fehlt/../P-0001/notes: No such file or directory');
    assert.equal(await lauf('echo x >> notes/'), 'bash: notes/: Not a directory');
    assert.equal(await lauf('echo x >> notes/.'), 'bash: notes/.: Not a directory');
    assert.equal(await lauf('echo x >> profile/../notes'), 'bash: profile/../notes: Not a directory');
    assert.equal(await p.evaluate(() => STATE.dossiers.entitaeten['P-0001'].notizen.length), n0, 'keine Notiz bei abgewiesenem Ziel oder abgewiesener Quelle');

    /* ---- D: Notiz-Commit ---- */
    const speicher = () => p.evaluate(() => [localStorage.getItem(STORAGE_KEY), localStorage.getItem(PROFIL_KEY)]);
    const fehlerBei = (wo) => p.evaluate((w) => {
      window.__setOrig = window.__setOrig || Storage.prototype.setItem;
      let n = 0;
      Storage.prototype.setItem = function (k, v) {
        n++;
        if ((w === 'zustand' && k === STORAGE_KEY) || (w === 'profil' && k === PROFIL_KEY) || (w === 'rueck' && (k === PROFIL_KEY || (k === STORAGE_KEY && n > 1)))) throw new Error('voll');
        return window.__setOrig.call(this, k, v);
      };
    }, wo);
    const heil = () => p.evaluate(() => { Storage.prototype.setItem = window.__setOrig; });
    for (const wo of ['zustand', 'profil']) {
      const vorher = await speicher(), log = await p.evaluate(() => JSON.stringify(STATE.log));
      await fehlerBei(wo);
      assert.equal(await lauf('echo verloren-' + wo + ' >> notes'), 'bash: notes: Input/output error', wo);
      await heil();
      assert.deepEqual(await speicher(), vorher, wo + ': gespeicherter Stand zeichengleich');
      assert.equal(await p.evaluate(() => JSON.stringify(STATE.log)), log, wo + ': Protokoll unverändert');
      assert.equal(await p.evaluate(() => STATE.dossiers.entitaeten['P-0001'].notizen.length), n0);
    }
    /* Fehler beim Zurückschreiben: ausdrücklich inkonsistent */
    await fehlerBei('rueck');
    assert.equal(await lauf('echo verloren-rueck >> notes'), 'bash: notes: Input/output error (storage could not be restored; the saved state may be inconsistent)');
    await heil();
    assert.match(await p.locator('#sys-msg').textContent(), /Speicherstand möglicherweise inkonsistent/, 'Inkonsistenz in der Oberfläche gemeldet');
    assert.equal(await p.evaluate(() => STATE.dossiers.entitaeten['P-0001'].notizen.length), n0, 'im Speicher zurückgenommen');
    await p.evaluate(() => { Store.save(STATE); profilSpeichern(); });   /* Speicher wieder in Ordnung bringen */
    /* volles Protokoll: Rücknahme stellt auch den abgeschnittenen ältesten Eintrag wieder her */
    await p.evaluate(() => { while (STATE.log.length < LOG_LIMIT) { STATE.seq.log++; STATE.log.push({ id: STATE.seq.log, t: nowIso(), modul: 'Test', aktion: 'Füllung', detail: 'x' }); } Store.save(STATE); });
    const logVoll = await p.evaluate(() => JSON.stringify(STATE.log));
    await fehlerBei('profil');
    assert.equal(await lauf('echo verloren-voll >> notes'), 'bash: notes: Input/output error');
    await heil();
    assert.equal(await p.evaluate(() => JSON.stringify(STATE.log)), logVoll, 'Protokoll bei LOG_LIMIT vollständig zurückgenommen');
    /* Erfolg und Neuladen */
    await p.evaluate(() => { VIEW.draft['dn-P-0001'] = 'Entwurf'; });
    assert.equal(await lauf('echo DAUERMARKER >> notes'), '');
    assert.equal(await p.evaluate(() => VIEW.draft['dn-P-0001']), 'Entwurf');
    await p.reload();
    fehlerSeite.length = 0;
    await p.fill('#gate-pw', PW);
    await p.click('#gate-go');
    await p.waitForFunction(() => typeof APP_BEREIT !== 'undefined' && APP_BEREIT && !document.body.classList.contains('locked') && !!STATE);
    const nachLaden = await p.evaluate(() => STATE.dossiers.entitaeten['P-0001'].notizen.map(n => n.text));
    assert.ok(nachLaden.includes('DAUERMARKER'), 'nach Neuladen vorhanden');
    assert.ok(!nachLaden.some(t => /verloren/.test(t)), 'zurückgenommene Notizen auch nach Neuladen nicht vorhanden');
    await p.click('#profil-terminal-oeffnen');

    /* ---- E: Fall und Unterlagen ---- */
    const F = '/intel/cases/' + setup.fall;
    const fall = await lauf('cat ' + F + '/case');
    assert.match(fall, /^Entries:\n\[next step\] 2026-01-02 03:04:05 UTC\nLieferanten prüfen\n\n\[open question\] 2026-01-03 03:04:05 UTC\nWer zahlt\?$/m);
    assert.equal(await lauf('ls ' + F + '/sources'), setup.q);
    assert.equal(await lauf('ls ' + F + '/sources/' + setup.q), 'source\n' + setup.v);
    assert.match(await lauf('cat ' + F + '/sources/' + setup.q + '/source'), /^Type: file\nOrigin: Hinweisgeber$/m);
    const ver = await lauf('cat ' + F + '/sources/' + setup.q + '/' + setup.v + '/version');
    assert.match(ver, /^File name: bericht\.pdf\nSize: 2048\nMedia type: application\/pdf\nSHA-256: (ab){32}$/m);
    assert.match(ver, /^Attachment: none$/m);
    const beob = await lauf('cat ' + F + '/sources/' + setup.q + '/' + setup.v + '/observations');
    assert.match(beob, /^Location in source: page 4\nQuote: ZITATMARKER\n/m);
    assert.match(beob, /^Dossiers: P-0003$/m);
    await sperren('P-0003');
    assert.match(await lauf('cat ' + F + '/sources/' + setup.q + '/' + setup.v + '/observations'), /^Dossiers: P-0003$/m, 'Fallinhalt bleibt, Dossierkennung sichtbar (E4)');
    assert.equal(await lauf('ls ' + F + '/dossiers'), 'P-0002', 'verknüpftes Dossier über den Beleg, nicht als Falldossier');
    await entsperren('P-0003');
    await p.evaluate(() => dispatch({ type: 'DOSSIER_STATUS', id: 'P-0003', status: 'beobachtet' }));
    assert.match(await lauf('cat /intel/dossiers/persons/index'), /^P-0003 {2}person {2}under observation/m, 'Status englisch');

    /* ---- F: Knöpfe in Kartenpopups, Belegung, Fallentwurf ---- */
    const popup = async (id, knopf) => {
      await p.evaluate((i) => { VIEW.karte.auswahl = i; dispatch({ type: 'NAVIGATION', modul: 'karte' }); renderModule(); }, id);
      await p.waitForSelector('#' + knopf, { state: 'attached' });
      await p.evaluate((k) => document.getElementById(k).click(), knopf);
      await p.waitForFunction(() => !TERMINAL_ZUSTAND.kette);
    };
    await popup(setup.pin, 'pin-terminal');
    assert.equal(await prompt.textContent(), 'raizo@terminal:/intel/geospatial/pins/' + setup.pin + '$');
    await popup(setup.zone, 'oz-terminal');
    assert.equal(await prompt.textContent(), 'raizo@terminal:/intel/geospatial/zones/' + setup.zone + '$');
    await p.evaluate(() => dispatch({ type: 'SICHTUNG_HINZU', id: 'P-0003', ort: '52.4700, 13.4500', text: 'gesehen' }));
    const si = await p.evaluate(() => STATE.dossiers.entitaeten['P-0003'].sichtungen.at(-1).id);
    await popup(si, 'si-terminal');
    assert.equal(await prompt.textContent(), 'raizo@terminal:/intel/geospatial/sightings/P-0003/' + si + '$');
    /* Belegung: es wird nicht gewechselt, der laufende Zustand bleibt unverändert */
    const belegt = [
      ['tmux oben', 't.tmux = { panes: [], fokus: "oben", aktiv: null, letzter: null }', 't.tmux = null'],
      ['PREDICT', 't.orbitLive = { test: true }', 't.orbitLive = false'],
      ['Profanity', 't.kanal = { phase: "eingabe", test: true }', 't.kanal = null'],
      ['PPP vorne', 't.modem = Object.assign({}, t.modem, { vordergrund: true, bereit: false })', 't.modem = null']
    ];
    for (const [name, an, aus] of belegt) {
      const vorher = await prompt.textContent();
      await p.evaluate((an) => { const t = TERMINAL_ZUSTAND; new Function('t', an)(t); window.__stand = JSON.stringify([t.tmux, t.orbitLive, t.kanal && t.kanal.test, t.modem && t.modem.vordergrund]); }, an);
      const ergebnis = await p.evaluate(() => terminalImTerminal('dossier', 'P-0002'));
      assert.equal(ergebnis, false, name);
      assert.equal(await p.evaluate(() => { const t = TERMINAL_ZUSTAND; return JSON.stringify([t.tmux, t.orbitLive, t.kanal && t.kanal.test, t.modem && t.modem.vordergrund]) === window.__stand; }), true, name + ': Zustand unverändert');
      await p.evaluate((aus) => new Function('t', aus)(TERMINAL_ZUSTAND), aus);
      assert.equal(await prompt.textContent(), vorher, name + ': kein Wechsel');
    }
    /* ungespeicherter Fallentwurf bleibt */
    await p.evaluate((f) => { xOeffnen(f); }, setup.fall);
    await p.waitForSelector('#x-terminal', { state: 'attached' });
    const feld = await p.evaluate(() => { const x = document.getElementById('x-begruendung') || document.getElementById('x-titel'); if (!x) return null; x.value = 'UNGESPEICHERT'; x.dispatchEvent(new Event('input', { bubbles: true })); return x.id; });
    assert.ok(feld, 'Eingabefeld im Fall gefunden');
    await p.evaluate(() => document.getElementById('x-terminal').click());
    await p.waitForFunction(() => !TERMINAL_ZUSTAND.kette);
    assert.equal(await prompt.textContent(), 'raizo@terminal:/intel/cases/' + setup.fall + '$');
    assert.equal(await p.evaluate((i) => document.getElementById(i).value, feld), 'UNGESPEICHERT', 'Entwurf im Fall unverändert');

    /* ---- G: Ergänzung und Vorschlag über eine Sperre hinweg ---- */
    await cmd('cd /intel/geospatial/pins');
    /* verzögerte Antwort des Anbieters mit dem Stand VOR der Sperre (Antwort berechnet, Auslieferung erst danach) */
    await p.evaluate(() => {
      window.__readdirOrig = TERMINAL_FS.readdir;
      TERMINAL_FS.readdir = async function (seg, opt) { const r = await window.__readdirOrig.call(this, seg, opt); window.__gerufen = (window.__gerufen || 0) + 1; await new Promise(z => setTimeout(z, 500)); return r; };
    });
    const geist = () => p.evaluate(() => { const g = document.getElementById('profil-terminal-vorschlag'); return g && !g.hidden ? g.textContent : ''; });
    /* Kontrolle ohne Sperre: der Vorschlag erscheint */
    await inp.fill('cat ' + setup.pin.slice(0, -1));
    await p.waitForTimeout(900);
    assert.match(await geist(), new RegExp(setup.pin), 'Vorschlag ohne Sperre');
    await inp.fill('');
    await p.waitForTimeout(100);
    /* Vorschlag beginnt, Sperre während der Antwort, derselbe Vorschlag startet neu */
    await p.evaluate(() => { window.__gerufen = 0; });
    await inp.fill('head ' + setup.pin.slice(0, -1));   /* anderer Text als die Kontrolle, sonst gilt deren zwischengespeicherter Vorschlag */
    await p.waitForFunction(() => window.__gerufen > 0);   /* Antwort des Anbieters steht (vor der Sperre), Auslieferung folgt */
    await sperren('P-0003');
    await p.evaluate(() => document.getElementById('profil-terminal-eingabe').dispatchEvent(new Event('input', { bubbles: true })));
    await p.waitForTimeout(1300);
    assert.doesNotMatch(await geist(), new RegExp(setup.pin), 'kein Vorschlag aus der früheren Sperrgeneration');
    /* Tab mit derselben verzögerten Antwort */
    await inp.press('Tab');
    await p.waitForTimeout(900);
    assert.equal(await inp.inputValue(), 'head ' + setup.pin.slice(0, -1), 'Tab ergänzt nichts Gesperrtes');
    await p.evaluate(() => { TERMINAL_FS.readdir = window.__readdirOrig; });
    await inp.fill('');
    assert.deepEqual(fehlerSeite, []);
    console.log('OK: terminal-intel-schutz (Schutzmetadaten, gemischtes ls, E6, Notizziel, Commit, Fall und Unterlagen, Knöpfe, Sperrgeneration)');
  } finally { await ctx.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
