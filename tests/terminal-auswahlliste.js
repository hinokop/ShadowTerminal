/* Auswahlliste der Tab-Ergänzung: Liste ohne stilles Einsetzen, Tab/Umschalt+Tab wählen, Enter übernimmt ohne Ausführen,
   Escape stellt den Entwurf wieder her; /sendfile mit mehreren Dateien; Fokuswechsel nach oben verwirft laufende Ergänzung. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { APP } = require('./_pfad');
const { chatBereit } = require('./_kestrel');

(async () => {
  const b = await chromium.launch();
  try {
    const p = await b.newPage({ reducedMotion: 'reduce' });
    p.setDefaultTimeout(12000);
    const errors = []; let verzoegern = 0;
    p.on('pageerror', e => errors.push(e.message));
    let dateien = ['Ablaufplan.docx', 'Abschrift.txt', 'Adressen.csv', 'archiv/'];
    await p.route(/^https?:/, async r => {
      const req = r.request();
      if (req.url() !== 'http://127.0.0.1:45679/db') return r.abort();
      const data = req.postDataJSON();
      if (verzoegern) await new Promise(ok => setTimeout(ok, verzoegern));
      if (data.op === 'ls') return r.fulfill({ json: { entries: dateien.map(n => ({ name: n.replace(/\/$/, ''), dir: n.endsWith('/') })) } });
      return r.fulfill({ json: { name: data.parts.at(-1), bytes: 120 } });
    });
    await p.goto(APP + '#db=45679.' + 'c'.repeat(43));
    await p.fill('#gate-pw', 'pw-test-123');
    if (await p.isVisible('#gate-pw2')) await p.fill('#gate-pw2', 'pw-test-123');
    await p.click('#gate-go'); await p.click('#profil-terminal-oeffnen');
    const inp = p.locator('#profil-terminal-eingabe'), out = p.locator('#profil-terminal-ausgabe');
    const liste = p.locator('#profil-terminal-auswahl');
    const eintraege = async () => liste.locator('span').allTextContents();
    const aktiv = async () => liste.locator('span.aktiv').allTextContents();

    /* Befehlsnamen: Liste, Entwurf unverändert */
    await inp.fill('w'); await inp.press('Tab');
    await liste.waitFor({ state: 'visible' });
    assert.deepEqual(await eintraege(), ['wget', 'whoami', 'wg-quick', 'wg']);
    assert.equal(await inp.inputValue(), 'w', 'kein stilles Einsetzen');
    assert.deepEqual(await aktiv(), []);
    /* Tab vorwärts, Umschalt+Tab rückwärts, Hervorhebung folgt */
    await inp.press('Tab'); assert.equal(await inp.inputValue(), 'wget '); assert.deepEqual(await aktiv(), ['wget']);
    await inp.press('Tab'); assert.equal(await inp.inputValue(), 'whoami ');
    await inp.press('Shift+Tab'); assert.equal(await inp.inputValue(), 'wget ');
    await inp.press('Shift+Tab'); assert.equal(await inp.inputValue(), 'wg ', 'rückwärts über den Anfang');
    /* Enter übernimmt, führt nicht aus */
    const vorher = await out.textContent();
    await inp.press('Enter');
    assert.equal(await liste.isVisible(), false); assert.equal(await inp.inputValue(), 'wg '); assert.equal(await out.textContent(), vorher);
    /* Escape stellt den Entwurf wieder her, Konsole bleibt offen */
    await inp.fill('w'); await inp.press('Tab'); await liste.waitFor({ state: 'visible' }); await inp.press('Tab'); await inp.press('Tab');
    await inp.press('Escape');
    assert.equal(await inp.inputValue(), 'w'); assert.equal(await liste.isVisible(), false);
    assert.equal(await p.locator('#profil-terminal').isVisible(), true);
    /* Weitertippen schließt die Liste und behält den Text */
    await inp.fill('w'); await inp.press('Tab'); await liste.waitFor({ state: 'visible' });
    await inp.press('h'); assert.equal(await liste.isVisible(), false); assert.equal(await inp.inputValue(), 'wh');
    /* Pfade: virtuelle Ordner, Ordner markiert */
    await inp.fill('cat /'); await inp.press('Tab'); await liste.waitFor({ state: 'visible' });
    assert.deepEqual(await eintraege(), ['etc/', 'home/', 'tmp/', 'var/', 'pgcl-eu3.arch07/']);
    assert.equal(await liste.locator('span.ordner').count(), 5);
    await inp.press('Escape');

    /* /sendfile im Chat: mehrere Dateien, nichts wird eingesetzt, Ordner markiert */
    await chatBereit(p);
    await inp.fill('/sendfile /pgcl-eu3.arch07/dokumente/A'); await inp.press('Tab');
    await liste.waitFor({ state: 'visible' });
    assert.deepEqual(await eintraege(), ['Ablaufplan.docx', 'Abschrift.txt', 'Adressen.csv', 'archiv/'], 'ohne Beachtung der Groß-/Kleinschreibung');
    assert.deepEqual(await liste.locator('span.ordner').allTextContents(), ['archiv/']);
    assert.equal(await inp.inputValue(), '/sendfile /pgcl-eu3.arch07/dokumente/A');
    await inp.press('Tab'); assert.equal(await inp.inputValue(), '/sendfile /pgcl-eu3.arch07/dokumente/Ablaufplan.docx');
    await inp.press('Enter');
    assert.equal(await p.evaluate(() => TERMINAL_ZUSTAND.kanal.uploads?.length || 0), 0, 'Enter wählt nur aus');
    const chatText = () => p.locator('#profil-terminal-chat').textContent();
    const pfad = '/sendfile /pgcl-eu3.arch07/dokumente/';
    /* Pfeiltasten bei offener Liste: ←/→ Eintrag, ↓/↑ Zeile; ohne Liste bleibt der Verlauf zuständig */
    dateien = Array.from({ length: 20 }, (_, i) => 'akte-' + String(i + 1).padStart(2, '0') + '.txt');
    const akte = i => 'akte-' + String(i).padStart(2, '0') + '.txt';
    await inp.fill(pfad + 'a'); await inp.press('Tab'); await p.waitForFunction(v => $('profil-terminal-eingabe').value === v, pfad + 'akte-');
    await inp.fill(pfad + 'akte-'); await inp.press('Tab'); await liste.waitFor({ state: 'visible' });
    const sp = await p.evaluate(() => terminalTabSpalten());
    assert.ok(sp >= 2 && sp < 20, 'mehrere Spalten und Zeilen: ' + sp);
    await inp.press('ArrowDown'); assert.deepEqual(await aktiv(), [akte(1)]);
    await inp.press('ArrowRight'); assert.deepEqual(await aktiv(), [akte(2)]); assert.equal(await inp.inputValue(), pfad + akte(2));
    await inp.press('ArrowDown'); assert.deepEqual(await aktiv(), [akte(2 + sp)]);
    await inp.press('ArrowUp'); assert.deepEqual(await aktiv(), [akte(2)]);
    await inp.press('ArrowLeft'); assert.deepEqual(await aktiv(), [akte(1)]);
    await inp.press('ArrowLeft'); assert.deepEqual(await aktiv(), [akte(20)], 'rückwärts über den Anfang');
    await inp.press('Escape'); assert.equal(await inp.inputValue(), pfad + 'akte-');
    /* 61 Treffer: Umschalt+Tab vom Anfang springt auf den letzten, der Ausschnitt wandert mit */
    dateien = Array.from({ length: 61 }, (_, i) => 'f' + String(i + 1).padStart(2, '0'));
    await inp.fill(pfad + 'f'); await inp.press('Tab'); await liste.waitFor({ state: 'visible' });
    assert.match(await liste.textContent(), /… 1 more/);
    await inp.press('Shift+Tab');
    assert.equal(await inp.inputValue(), pfad + 'f61'); assert.deepEqual(await aktiv(), ['f61'], 'sichtbar markiert');
    assert.match(await liste.textContent(), /… \d+ before/);
    await inp.press('Tab'); assert.deepEqual(await aktiv(), ['f01']); assert.doesNotMatch(await liste.textContent(), /before/);
    await inp.press('Escape');
    /* Enter bei offener Liste ohne Auswahl: nur schließen, nicht senden; erst das nächste Enter führt aus */
    dateien = ['A', 'A.txt'];
    await inp.fill(pfad + 'A'); await inp.press('Tab'); await liste.waitFor({ state: 'visible' });
    assert.deepEqual(await eintraege(), ['A', 'A.txt']);
    await inp.press('Enter');
    assert.equal(await liste.isVisible(), false); assert.equal(await inp.inputValue(), pfad + 'A');
    assert.equal(await p.evaluate(() => TERMINAL_ZUSTAND.kanal.uploads?.length || 0), 0);
    await inp.press('Enter');
    await p.waitForFunction(() => TERMINAL_ZUSTAND.kanal.uploads?.length === 1);
    await inp.fill(''); await inp.press('Escape'); // beendet profanity
    /* Ohne Liste: ↑ blättert im Verlauf */
    await inp.press('ArrowUp'); assert.match(await inp.inputValue(), /profanity|tmux|cat/);
    await inp.fill('');

    /* Fokuswechsel nach oben verwirft eine laufende Ergänzung (verzögerte Brücke) */
    await inp.fill('tmux \\; split-window -bd predict'); await inp.press('Enter');
    await inp.fill('cat /pgcl-eu3.arch07/dokumente/Abl');
    verzoegern = 800;
    await inp.press('Tab');
    await p.locator('.tmux-pane').click();   // Wechsel per Klick: keine Taste, die die Ergänzung ohnehin abbräche
    await p.waitForTimeout(1200);
    verzoegern = 0;
    await inp.press('Control+b'); await inp.press('ArrowDown');
    assert.equal(await inp.inputValue(), 'cat /pgcl-eu3.arch07/dokumente/Abl', 'verspätete Antwort ändert den Entwurf nicht');
    assert.equal(await liste.isVisible(), false);
    assert.deepEqual(errors, []);
    console.log('OK: Auswahlliste der Tab-Ergänzung');
  } finally { await b.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
