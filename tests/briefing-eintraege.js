/* Datierte Einträge im Lagebriefing (X): Lage, Nächster Schritt, Offene Frage; anlegen, bearbeiten, löschen, abhaken.
   Speichern über xSchreiben mit Rücknahme; Fallpaket-Rundtest. Exit-Code 1 bei Fehlschlag. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');
const { APP } = require('./_pfad');
(async () => {
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 1500, height: 1100 }, reducedMotion: 'reduce', acceptDownloads: true });
    const p = await ctx.newPage();
    const fehler = []; p.on('pageerror', e => fehler.push(e.message));
    await p.route(/^https?:/, r => r.abort());
    const start = async () => {
      await p.goto(APP); await p.fill('#gate-pw', 'pw-test-123'); if (await p.isVisible('#gate-pw2')) await p.fill('#gate-pw2', 'pw-test-123'); await p.click('#gate-go');
      await p.waitForFunction(() => !document.body.classList.contains('locked'));
    };
    await start();
    const f = await p.evaluate(() => { PROFIL.recherche.faelle = []; const a = xAnlegen({ titel: 'Eintragsfall' }), b = xAnlegen({ titel: 'Anderer Fall' }); profilSpeichern(); xOeffnen(a.id); return { a: a.id, b: b.id }; });
    const lies = id => p.evaluate(i => (JSON.parse(localStorage.getItem(PROFIL_KEY)).recherche.faelle.find(x => x.id === i).eintraege || []), id);
    const wert = sel => p.evaluate(x => document.querySelector(x).innerText.trim(), sel);
    const neu = async (art, text) => { await p.selectOption('#x-bf-art', art); await p.fill('#x-bf-text', text); await p.click('#x-bf-neu'); };
    assert.equal(await p.locator('#x-schritt').count(), 0, 'kein Einzelfeld mehr');
    assert.ok((await p.locator('#x-briefing').innerText()).includes('Noch keine Einträge'), 'Leeranzeige');
    /* leerer Text wird abgelehnt */
    await p.selectOption('#x-bf-art', 'lage'); await p.fill('#x-bf-text', '   '); await p.click('#x-bf-neu');
    assert.equal((await lies(f.a)).length, 0); assert.ok((await p.locator('#sys-msg').innerText()).includes('Text'), 'Meldung bei leerem Text');
    /* anlegen */
    await neu('lage', 'Beschluss liegt vor');
    await p.waitForTimeout(20); await neu('schritt', 'Pressestelle anrufen');
    await p.waitForTimeout(20); await neu('frage', 'Wer hat unterschrieben?');
    const E = await lies(f.a);
    assert.equal(E.length, 3);
    assert.deepEqual(E.map(e => e.art), ['lage', 'schritt', 'frage']);
    assert.ok(E.every(e => /^[0-9a-f]{12}$/.test(e.uid) && /^\d{4}-\d\d-\d\dT/.test(e.erfasst)), 'uid und Erfassungszeitpunkt');
    assert.equal(new Set(E.map(e => e.uid)).size, 3, 'uid eindeutig');
    assert.equal(await wert('#x-bf-text'), '', 'Eingabefeld nach dem Anlegen leer');
    const reihe = await p.locator('#x-briefing [data-eintrag]').evaluateAll(l => l.map(e => e.getAttribute('data-eintrag')));
    assert.deepEqual(reihe, [E[2].uid, E[1].uid, E[0].uid], 'jüngster zuerst');
    assert.deepEqual(Object.keys(await p.evaluate(i => xFall(i), f.a)).sort(), ['eintraege', 'erfasst', 'frage', 'id', 'titel', 'zustand']);
    assert.equal((await lies(f.b)).length, 0, 'anderer Fall unberührt');
    /* Frage abhaken und wieder öffnen */
    const q = E[2].uid;
    assert.equal(await p.locator('#x-bf-erledigt-' + q).count(), 1, 'nur Fragen haben einen Haken');
    assert.equal(await p.locator('#x-bf-erledigt-' + E[0].uid).count(), 0);
    await p.check('#x-bf-erledigt-' + q);
    assert.equal((await lies(f.a)).find(e => e.uid === q).erledigt, true);
    await p.uncheck('#x-bf-erledigt-' + q);
    assert.ok(!(await lies(f.a)).find(e => e.uid === q).erledigt, 'wieder geöffnet');
    /* bearbeiten */
    const u = E[0].uid; await p.waitForTimeout(20);
    await p.click('#x-bf-bearb-' + u);
    assert.equal(await wert('#x-bf-bearb-text-' + u), 'Beschluss liegt vor');
    await p.fill('#x-bf-bearb-text-' + u, 'Beschluss liegt vor und wurde veröffentlicht'); await p.click('#x-bf-bearb-ok-' + u);
    let e0 = (await lies(f.a)).find(e => e.uid === u);
    assert.equal(e0.text, 'Beschluss liegt vor und wurde veröffentlicht'); assert.equal(e0.erfasst, E[0].erfasst, 'Erfassungszeitpunkt bleibt'); assert.ok(e0.geaendert, 'Änderungszeitpunkt gesetzt');
    assert.equal((await lies(f.a)).length, 3, 'Bearbeiten legt keinen neuen Eintrag an');
    /* bearbeiten ohne Änderung und Abbrechen */
    await p.click('#x-bf-bearb-' + u); await p.click('#x-bf-bearb-ok-' + u);
    assert.equal((await lies(f.a)).find(e => e.uid === u).geaendert, e0.geaendert, 'ohne Änderung kein neuer Zeitpunkt');
    await p.click('#x-bf-bearb-' + u); await p.fill('#x-bf-bearb-text-' + u, 'verworfen'); await p.click('#x-bf-bearb-abbr-' + u);
    assert.equal((await lies(f.a)).find(e => e.uid === u).text, e0.text, 'Abbrechen verwirft');
    /* Speicherfehler beim Bearbeiten: neuer Text bleibt im Editor erhalten */
    await p.click('#x-bf-bearb-' + u); await p.fill('#x-bf-bearb-text-' + u, 'Neuer Text bei Speicherfehler');
    await p.evaluate(() => { window.__ps2 = profilSpeichern; profilSpeichern = () => false; });
    await p.click('#x-bf-bearb-ok-' + u);
    await p.evaluate(() => { profilSpeichern = window.__ps2; });
    assert.equal(await p.locator('#x-bf-bearb-text-' + u).count(), 1, 'Editor bleibt nach Speicherfehler offen');
    assert.equal(await p.locator('#x-bf-bearb-text-' + u).innerText(), 'Neuer Text bei Speicherfehler', 'getippter Text bleibt erhalten');
    assert.equal((await lies(f.a)).find(e => e.uid === u).text, e0.text, 'gespeicherter Eintrag unverändert');
    await p.click('#x-bf-bearb-ok-' + u);
    assert.equal((await lies(f.a)).find(e => e.uid === u).text, 'Neuer Text bei Speicherfehler', 'zweiter Versuch speichert');
    assert.equal(await p.locator('#x-bf-bearb-text-' + u).count(), 0, 'Editor nach Erfolg geschlossen');
    e0 = (await lies(f.a)).find(e => e.uid === u);
    /* Speicherfehler: Rücknahme */
    await p.selectOption('#x-bf-art', 'lage'); await p.fill('#x-bf-text', 'wird nicht gespeichert');
    await p.evaluate(() => { window.__ps = profilSpeichern; profilSpeichern = () => false; });
    await p.click('#x-bf-neu');
    await p.evaluate(() => { profilSpeichern = window.__ps; });
    assert.equal(await p.evaluate(i => xFall(i).eintraege.length, f.a), 3, 'Speicherfehler: zurückgenommen');
    assert.ok((await p.locator('#sys-msg').innerText()).includes('nicht gespeichert'));
    /* löschen: Abbrechen behält, Bestätigen entfernt genau diesen Eintrag */
    await p.fill('#x-bf-text', '');
    await p.click('#x-bf-loesch-' + E[1].uid); await p.click('#dlg-cancel');
    assert.equal((await lies(f.a)).length, 3, 'Abbrechen löscht nicht');
    await p.click('#x-bf-loesch-' + E[1].uid); await p.click('#dlg-ok');
    const rest = await lies(f.a);
    assert.deepEqual(rest.map(e => e.uid).sort(), [E[0].uid, E[2].uid].sort(), 'nur der gewählte Eintrag gelöscht');
    /* Formatierung: Fett, Kursiv, Unterstrichen, Liste über die Schaltflächen */
    await p.selectOption('#x-bf-art', 'lage'); await p.click('#x-bf-text'); await p.keyboard.type('Formatiert');
    await p.keyboard.press('Control+A'); await p.click('#x-bf-text-leiste [data-format="bold"]'); await p.click('#x-bf-text-leiste [data-format="italic"]'); await p.click('#x-bf-text-leiste [data-format="underline"]');
    await p.click('#x-bf-neu');
    const fm = (await lies(f.a)).find(e => e.text.includes('Formatiert'));
    assert.ok(fm && /<b>|<strong>/.test(fm.text) && /<i>|<em>/.test(fm.text) && /<u>/.test(fm.text), 'Fett, Kursiv, Unterstrichen gespeichert: ' + (fm && fm.text));
    assert.equal(await p.locator('#x-bf-' + fm.uid + ' b, #x-bf-' + fm.uid + ' strong').count() > 0, true, 'Anzeige formatiert');
    await p.click('#x-bf-text'); await p.keyboard.type('Eins'); await p.click('#x-bf-text-leiste [data-format="insertUnorderedList"]'); await p.keyboard.type('Zwei');
    await p.selectOption('#x-bf-art', 'schritt'); await p.click('#x-bf-neu');
    assert.ok((await lies(f.a)).some(e => /<ul>/.test(e.text) && /<li>/.test(e.text)), 'Liste gespeichert');
    /* eingeschleustes Markup wird beim Speichern entfernt */
    await p.evaluate(() => { const el = document.getElementById('x-bf-text'); el.innerHTML = '<img src=x onerror="window.__x=1"><b>sicher</b><script>window.__x=2<\/script><span data-unterlage="B-1">[B-1]</span><a href="javascript:window.__x=3">Link</a>'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    await p.click('#x-bf-neu');
    const sauber = (await lies(f.a)).find(e => e.text.includes('sicher'));
    assert.ok(sauber && !/img|script|onerror|<a |data-unterlage|javascript/i.test(sauber.text), 'Markup entfernt: ' + (sauber && sauber.text));
    assert.ok(/<b>sicher<\/b>/.test(sauber.text), 'erlaubte Formatierung bleibt');
    /* beschädigter Inhalt aus Import/Altdaten wird nur bereinigt angezeigt */
    await p.evaluate(() => { const x = xAnlegen({ titel: 'Präpariert' }); x.eintraege = [{ uid: 'eeeeeeeeeeee', art: 'lage', text: '<img src=x onerror="window.__y=1"><b>ok</b><script>window.__y=2<\/script>', erfasst: '2026-01-01T00:00:00.000Z' }]; profilSpeichern(); xOeffnen(x.id); });
    await p.waitForTimeout(400);                                       /* onerror eines geladenen Bildes feuert asynchron */
    assert.equal(await p.evaluate(() => window.__y), undefined, 'kein Skript aus präpariertem Eintrag');
    assert.equal(await p.locator('#x-bf-eeeeeeeeeeee img, #x-bf-eeeeeeeeeeee script').count(), 0);
    assert.equal(await p.locator('#x-bf-eeeeeeeeeeee b').count(), 1, 'erlaubte Formatierung wird angezeigt');
    /* Länge zählt den sichtbaren Text */
    await p.evaluate(i => xOeffnen(i), f.a);
    await p.fill('#x-bf-text', 'y'.repeat(501)); const vor = (await lies(f.a)).length; await p.click('#x-bf-neu');
    assert.equal((await lies(f.a)).length, vor, 'über 500 Zeichen wird abgelehnt'); assert.ok((await p.locator('#sys-msg').innerText()).includes('500'));
    await p.fill('#x-bf-text', '');
    /* Neustart: Einträge sichtbar */
    await start(); await p.evaluate(i => xOeffnen(i), f.a);
    assert.equal(await p.locator('#x-briefing [data-eintrag]').count(), (await lies(f.a)).length, 'nach Neustart vorhanden');
    /* Entwurf überlebt das Löschen des Falls nicht (gleiche Nummer) */
    const g = await p.evaluate(() => { PROFIL.recherche.faelle = []; const x = xAnlegen({ titel: 'Entwurfsfall' }); profilSpeichern(); xOeffnen(x.id); return x.id; });
    await p.fill('#x-bf-text', 'nie gespeichert');
    await p.evaluate(async i => { await xLoeschen(i); }, g);
    const g2 = await p.evaluate(() => { const x = xAnlegen({ titel: 'Ersatz' }); profilSpeichern(); xOeffnen(x.id); return x.id; });
    assert.equal(g2, g, 'Voraussetzung: Nummer wiedervergeben');
    assert.equal(await wert('#x-bf-text'), '', 'Eingabefeld des neuen Falls leer');
    /* Fallpaket-Rundtest */
    await p.evaluate(() => { PROFIL.recherche.faelle = []; const x = xAnlegen({ titel: 'Paketfall' }); xSchreiben(() => { x.eintraege = [{ uid: 'aaaaaaaaaaaa', art: 'frage', text: 'Offen?', erfasst: '2026-11-01T10:00:00.000Z', erledigt: true }, { uid: 'bbbbbbbbbbbb', art: 'lage', text: 'Lage 1', erfasst: '2026-11-02T10:00:00.000Z', geaendert: '2026-11-03T10:00:00.000Z' }]; return true; }); profilSpeichern(); xOeffnen(x.id); });
    const paket = await p.evaluate(async () => (await rchPaketBauen(PROFIL.recherche.faelle[0].id)).text);
    assert.equal(JSON.parse(paket).inhalt.fall.eintraege.length, 2, 'Export enthält die Einträge');
    const lade = (t, n) => p.evaluate(async ([t, n]) => { rchPaketLaden(new File([t], n, { type: 'application/json' })); await new Promise(r => setTimeout(r, 1800)); return 1; }, [t, n]);
    await p.evaluate(() => { PROFIL.recherche.faelle = []; profilSpeichern(); });
    await lade(paket, 'p.json');
    const imp = await p.evaluate(() => PROFIL.recherche.faelle.find(x => x.titel === 'Paketfall'));
    assert.ok(imp, 'Fall importiert'); assert.deepEqual(imp.eintraege.map(e => [e.uid, e.art, e.text, !!e.erledigt, e.geaendert || null]), [['aaaaaaaaaaaa', 'frage', 'Offen?', true, null], ['bbbbbbbbbbbb', 'lage', 'Lage 1', false, '2026-11-03T10:00:00.000Z']], 'Einträge nach Wiederimport erhalten');
    const P = JSON.parse(paket); P.inhalt.fall.eintraege[1].text = 'verfälscht';
    await p.evaluate(() => { PROFIL.recherche.faelle = []; profilSpeichern(); });
    await lade(JSON.stringify(P), 'm.json');
    assert.equal(await p.evaluate(() => PROFIL.recherche.faelle.length), 0, 'manipuliertes Paket abgelehnt');
    const alt = await p.evaluate(async () => { const x = xAnlegen({ titel: 'Altfall' }); profilSpeichern(); const t = (await rchPaketBauen(x.id)).text; PROFIL.recherche.faelle = []; profilSpeichern(); return t; });
    assert.equal('eintraege' in JSON.parse(alt).inhalt.fall, false);
    await lade(alt, 'alt.json');
    const a2 = await p.evaluate(() => PROFIL.recherche.faelle.find(x => x.titel === 'Altfall'));
    assert.ok(a2 && !('eintraege' in a2), 'altes Paket ohne Feld importiert');
    await p.evaluate(i => xOeffnen(i), a2.id);
    assert.ok((await p.locator('#x-briefing').innerText()).includes('Noch keine Einträge'));
    /* beschädigte Einträge (Import, Altdaten) stören die Ansicht nicht */
    await p.evaluate(() => { const x = xAnlegen({ titel: 'Beschädigt' }); x.eintraege = [null, 5, { uid: 'x' }, { uid: 'cccccccccccc', art: 'unbekannt', text: 'a', erfasst: 'e' }, { uid: 'dddddddddddd', art: 'lage', text: 'gültig', erfasst: '2026-01-01T00:00:00.000Z' }, { uid: 'dddddddddddd', art: 'lage', text: 'doppelt', erfasst: '2026-01-02T00:00:00.000Z' }]; profilSpeichern(); xOeffnen(x.id); });
    assert.equal(await p.locator('#x-briefing [data-eintrag]').count(), 1, 'nur der gültige Eintrag erscheint');
    assert.ok((await p.locator('#x-briefing').innerText()).includes('gültig'));
    /* Kurzlage / Leitfrage mit Editor: Formatierung, Klartext im Fallobjekt, Bereinigung */
    const kf = await p.evaluate(() => { const x = xAnlegen({ titel: 'Kurzlagefall', frage: 'Alt, mit <spitzen> & Zeichen' }); profilSpeichern(); xOeffnen(x.id); return x.id; });
    assert.equal(await p.evaluate(() => document.getElementById('x-kurzlage').innerText.trim()), 'Alt, mit <spitzen> & Zeichen', 'Altwert als Text, nicht als Markup');
    await p.click('#x-kurzlage'); await p.keyboard.press('Control+A'); await p.keyboard.type('Leitfrage fett'); await p.keyboard.press('Control+A');
    await p.click('#x-kurzlage-leiste [data-format="bold"]');
    await p.click('#x-speichern');
    const kz = await p.evaluate(i => { const x = xFall(i); return { frage: x.frage, fmt: x.frageFormat }; }, kf);
    assert.equal(kz.frage, 'Leitfrage fett', 'Klartext für andere Stellen'); assert.ok(/<b>|<strong>/.test(kz.fmt), 'Formatierung gespeichert: ' + kz.fmt);
    assert.ok(await p.locator('#x-briefing b, #x-briefing strong').count() > 0, 'Lagebriefing zeigt die formatierte Kurzlage');
    assert.equal(await p.evaluate(() => document.querySelector('#x-kurzlage b, #x-kurzlage strong') !== null), true, 'Formular zeigt die Formatierung wieder');
    /* mehrzeilig: Zeilenumbrüche im Klartext */
    await p.click('#x-kurzlage'); await p.keyboard.press('Control+A'); await p.keyboard.type('Zeile eins'); await p.keyboard.press('Enter'); await p.keyboard.type('Zeile zwei');
    await p.click('#x-speichern');
    assert.equal(await p.evaluate(i => xFall(i).frage, kf), 'Zeile eins\nZeile zwei', 'Klartext mit Zeilenumbruch');
    assert.equal(await p.evaluate(i => xFall(i).frageFormat === undefined || xFall(i).frageFormat.indexOf('Zeile') >= 0, kf), true);
    /* ohne Formatierung kein zweites Feld */
    await p.evaluate(() => { document.getElementById('x-kurzlage').innerHTML = ''; }); await p.click('#x-kurzlage'); await p.keyboard.type('Nur Text'); await p.click('#x-speichern');
    assert.equal(await p.evaluate(i => 'frageFormat' in xFall(i), kf), false, 'ohne Formatierung kein frageFormat');
    /* über 300 Zeichen: abgelehnt, nichts verändert */
    await p.fill('#x-kurzlage', 'z'.repeat(301)); await p.click('#x-speichern');
    assert.equal(await p.evaluate(i => xFall(i).frage, kf), 'Nur Text'); assert.ok((await p.locator('#sys-msg').innerText()).includes('300'));
    /* eingeschleustes Markup und uneinheitliches frageFormat: bereinigt bzw. ignoriert angezeigt */
    await p.evaluate(i => { const x = xFall(i); x.frage = 'echt'; x.frageFormat = '<img src=x onerror="window.__k=1"><b>falsch</b>'; profilSpeichern(); xOeffnen(i); renderModule(); }, kf);
    assert.equal(await p.evaluate(() => window.__k), undefined); assert.ok((await p.locator('#x-briefing').innerText()).includes('echt'), 'uneinheitliches frageFormat wird ignoriert');
    /* Fallpaket erhält frageFormat */
    await p.evaluate(i => { const x = xFall(i); x.frage = 'Fett'; x.frageFormat = '<b>Fett</b>'; profilSpeichern(); }, kf);
    const pk = await p.evaluate(async i => (await rchPaketBauen(i)).text, kf);
    await p.evaluate(i => { PROFIL.recherche.faelle = PROFIL.recherche.faelle.filter(x => x.id !== i); profilSpeichern(); }, kf);
    await lade(pk, 'k.json');
    assert.equal(await p.evaluate(() => (PROFIL.recherche.faelle.find(x => x.titel === 'Kurzlagefall') || {}).frageFormat), '<b>Fett</b>', 'frageFormat nach Wiederimport erhalten');
    /* Altdaten aus Testpaket #50: einzelner Schritt wird einmalig zum datierten Eintrag */
    const ids = await p.evaluate(() => { PROFIL.recherche.faelle = []; const a = xAnlegen({ titel: 'Altschritt' }); const b = xAnlegen({ titel: 'Ohne Schritt' });
      a.naechsterSchritt = { text: 'Gutachten anfordern', am: '2026-01-02T03:04:05.000Z' }; profilSpeichern(); return { a: a.id, b: b.id }; });
    await p.reload(); await p.fill('#gate-pw', 'pw-test-123'); await p.click('#gate-go');
    await p.waitForFunction(() => !document.body.classList.contains('locked'));
    await p.evaluate(i => xOeffnen(i), ids.a);
    let altF = await p.evaluate(i => JSON.parse(localStorage.getItem(PROFIL_KEY)).recherche.faelle.find(x => x.id === i), ids.a);
    assert.equal(altF.naechsterSchritt, undefined, 'Einzelfeld entfernt');
    assert.equal((altF.eintraege || []).length, 1, 'genau ein Eintrag');
    assert.deepEqual([altF.eintraege[0].art, altF.eintraege[0].erfasst, altF.eintraege[0].text], ['schritt', '2026-01-02T03:04:05.000Z', 'Gutachten anfordern'], 'Art, bisheriger Zeitstempel, Text');
    assert.ok((await p.locator('#x-briefing').innerText()).includes('Gutachten anfordern'), 'Eintrag sichtbar');
    /* erneutes Laden desselben Altstands erzeugt keine Dublette */
    await p.evaluate(i => { const x = xFall(i); x.naechsterSchritt = { text: 'Gutachten anfordern', am: '2026-01-02T03:04:05.000Z' }; profilSpeichern(); renderModule(); }, ids.a);
    altF = await p.evaluate(i => JSON.parse(localStorage.getItem(PROFIL_KEY)).recherche.faelle.find(x => x.id === i), ids.a);
    assert.equal(altF.eintraege.length, 1, 'keine Dublette'); assert.equal(altF.naechsterSchritt, undefined);
    assert.equal(await p.evaluate(i => (xFall(i).eintraege || []).length, ids.b), 0, 'Fall ohne Altschritt bleibt unberührt');
    assert.deepEqual(fehler, []);
    console.log('OK: datierte Einträge im Lagebriefing');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
