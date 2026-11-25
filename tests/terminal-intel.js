/* Paket 2: /intel (docs/terminal-intel-konzept.md, Abschnitt 0).
   A: Baum, Objektverzeichnisse, englische Beschriftung, Indizes, symbolische Links mit kanonischem cd (auch gegenseitige Verweise ohne Zyklus), readlink.
   B: Schreibschutz (EROFS), EXDEV über Einhängepunkte, E6 (keine Übernahme ins VFS: cp, Umleitung, nano).
   C: Sperren (Variante B, E4): Listen, direkter Zugriff, Fälle mit gesperrtem Dossier, Kartenobjekte, Sichtungen, Tab, Schutz im Scrollback
      (ganze Ausgaben und einzelne Indexzeilen), gesperrtes Arbeitsverzeichnis (E9), Entsperren über sudo open.
   D: Navigation: open/map mit Pfaden, Knopf "Im Terminal" (auch: belegtes Terminal wechselt nicht).
   E: Notiz anhängen (E7): genau eine Aktion, Entwurf der Oberfläche bleibt, Speicherfehler wird zurückgenommen. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright');
const { APP } = require('./_pfad');

const PW = 'pw-test-123';
(async () => {
  const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'ft-intel-')), { reducedMotion: 'reduce', viewport: { width: 1280, height: 900 } });
  try {
    const p = await ctx.newPage();
    p.setDefaultTimeout(15000);
    const fehlerSeite = [];
    p.on('pageerror', e => fehlerSeite.push(e.message));
    await p.route(/^https?:/, r => r.abort());
    await p.goto(APP);
    await p.fill('#gate-pw', PW);
    if (await p.isVisible('#gate-pw2')) await p.fill('#gate-pw2', PW);
    await p.click('#gate-go');
    await p.waitForFunction(() => typeof APP_BEREIT !== 'undefined' && APP_BEREIT && !document.body.classList.contains('locked') && !!STATE);
    /* Bestand: Pin und Zone am Dossier P-0001, Sichtung, Notiz, Fall mit zwei Dossiers und dem Pin, ein freier Pin */
    const z = await p.evaluate(() => {
      dispatch({ type: 'PIN_ANGELEGT', ll: [52.4737, 13.4513], name: 'Nordpunkt', dossier: 'P-0001', notiz: 'Zufahrt hinten' });
      dispatch({ type: 'PIN_ANGELEGT', ll: [52.5, 13.4], name: 'Freier Punkt' });
      dispatch({ type: 'OZONE_ANGELEGT', ll: [52.47, 13.45] });
      const zone = PROFIL.zonen.at(-1).id;
      dispatch({ type: 'OZONE_GEAENDERT', id: zone, dossier: 'P-0001' });
      dispatch({ type: 'SICHTUNG_HINZU', id: 'P-0001', ort: 'Sonnenallee', text: 'Fahrzeug gesehen' });
      dispatch({ type: 'DOSSIER_NOTIZ', id: 'P-0001', text: 'Erste Notiz' });
      let fall = null;
      xSchreiben(function () { fall = xAnlegen({ titel: 'Fall Alpha', frage: 'Wer liefert?' }, 'P-0001'); fall.dossiers.push('P-0007'); fall.pins = [PROFIL.pins[0].id]; return fall; });
      return { pin: PROFIL.pins[0].id, frei: PROFIL.pins[1].id, zone: zone, si: STATE.dossiers.entitaeten['P-0001'].sichtungen[0].id, fall: fall.id };
    });
    assert.deepEqual(z, { pin: 'PIN-001', frei: 'PIN-002', zone: 'ZO-001', si: 'SI-001', fall: 'F-001' });
    await p.click('#profil-terminal-oeffnen');
    const inp = p.locator('#profil-terminal-eingabe'), out = p.locator('#profil-terminal-ausgabe'), prompt = p.locator('#profil-terminal-prompt');
    const cmd = async zeile => { await inp.fill(zeile); await inp.press('Enter'); await p.waitForFunction(() => !TERMINAL_ZUSTAND.kette); };
    const lauf = async zeile => {
      const roh = await out.textContent(), vorher = roh === '' ? 0 : roh.split('\n').length;
      await cmd(zeile);
      return (await out.textContent()).split('\n').slice(vorher + 1).join('\n');
    };
    const D = '/intel/dossiers/persons/P-0001';

    /* ---- A: Baum ---- */
    assert.equal(await lauf('ls /'), 'etc\nhome\nintel\npgcl-eu3.arch07\ntmp\nusr\nvar');   /* Paket 3: /usr */
    assert.equal(await lauf('ls /intel'), 'cases\ndossiers\ngeospatial\nREADME');
    assert.equal(await lauf('ls /intel/dossiers'), 'index\nlocations\norganizations\npersons');
    assert.equal(await lauf('ls /intel/geospatial'), 'pins\nsightings\nzones');
    assert.equal(await lauf('ls ' + D), 'cases\nimages\nlinks\nnotes\npins\nprofile\nsightings\nzones');
    assert.match(await lauf('ls -l ' + D), /lrwxrwxrwx .* sightings -> \/intel\/geospatial\/sightings\/P-0001$/m);
    assert.match(await lauf('ls -l ' + D), /^-r--r--r-- .* profile$/m);
    assert.match(await lauf('ls -F ' + D), /^sightings@$/m);
    const profil = await lauf('cat ' + D + '/profile');
    assert.match(profil, /^ID: P-0001\nName: Emre Kaya\nType: person\n/);
    assert.match(profil, /^Notes: 1$/m); assert.match(profil, /^Sightings: 1$/m);
    assert.match(await lauf('cat ' + D + '/notes'), /^DN-\d{3}\n\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} UTC\nErste Notiz$/);
    assert.match(await lauf('cat /intel/dossiers/index'), /^ID {6}TYPE {10}STATUS {2}NAME\n/);
    assert.match(await lauf('cat /intel/dossiers/persons/index'), /^P-0001 {2}person/m);
    assert.doesNotMatch(await lauf('cat /intel/dossiers/persons/index'), /^O-0001/m);
    assert.equal(await lauf('ls /intel/geospatial/pins'), 'index\nPIN-001\nPIN-002');
    assert.equal(await lauf('ls /intel/geospatial/pins/PIN-001'), 'coordinates\ndossier\nrecord');
    assert.equal(await lauf('ls /intel/geospatial/pins/PIN-002'), 'coordinates\nrecord', 'ohne Verknüpfung kein dossier-Link');
    const pinRec = await lauf('cat /intel/geospatial/pins/PIN-001/record');
    assert.match(pinRec, /^PIN-001 Nordpunkt\nPosition: 52\.47370, 13\.45130\nPurpose: not set\n\nAccess routes: -/);
    assert.match(pinRec, /^Note: Zufahrt hinten$/m); assert.match(pinRec, /^Created: \d{4}-\d{2}-\d{2} /m);
    assert.equal(await lauf('cat /intel/geospatial/pins/PIN-001/coordinates'), 'latitude: 52.47370\nlongitude: 13.45130');
    assert.match(await lauf('cat /intel/geospatial/pins/index'), /^PIN-001 {2}P-0001 {3}Nordpunkt$/m);
    assert.match(await lauf('cat /intel/geospatial/zones/ZO-001/record'), /^ZO-001 .*\nPosition: .*\nRadius: 200 m\nNote: -\nLast checked: /);
    assert.equal(await lauf('readlink /intel/geospatial/pins/PIN-001/dossier'), D);
    assert.equal(await lauf('readlink ' + D + '/profile; echo $?'), '1');
    assert.match(await lauf('cat /intel/geospatial/sightings/P-0001/SI-001/record'), /^SI-001 · dossier P-0001 Emre Kaya\nTime: .*\nReported location: Sonnenallee\n/);
    /* Archivexport bleibt deutsch und unverändert (derselbe Renderer, deutsche Beschriftung als Vorgabe) */
    assert.match(await p.evaluate(() => pinText(PROFIL.pins[0])), /^PIN-001 Nordpunkt\nPosition: 52\.47370, 13\.45130\nZweck: nicht festgelegt\n\nZufahrten und Wege: –/);
    /* Links: cd verwendet den kanonischen Zielpfad; gegenseitige Verweise ergeben keinen Zyklus */
    await cmd('cd /intel/geospatial/pins/PIN-001/dossier');
    assert.equal(await prompt.textContent(), 'raizo@terminal:' + D + '$');
    await cmd('cd sightings');
    assert.equal(await lauf('pwd'), '/intel/geospatial/sightings/P-0001');
    await cmd('cd ' + D + '/cases/F-001/dossiers/P-0001/cases/F-001/dossiers/P-0007');
    assert.equal(await lauf('pwd'), '/intel/dossiers/persons/P-0007');
    await cmd('cd /intel/cases/F-001');
    assert.equal(await lauf('ls'), 'case\ndossiers\npins\nsources');
    assert.match(await lauf('cat case'), /^ID: F-001\nTitle: Fall Alpha\nQuestion: Wer liefert\?\nState: information gathering\nAssessment: unrated\n/);
    assert.equal(await lauf('ls dossiers pins'), 'dossiers:\nP-0001\nP-0007\n\npins:\nPIN-001');
    assert.equal(await lauf('ls ' + D + '/cases ' + D + '/pins ' + D + '/zones'), D + '/cases:\nF-001\n\n' + D + '/pins:\nPIN-001\n\n' + D + '/zones:\nZO-001');
    assert.equal(await lauf('cat nichts'), 'cat: nichts: No such file or directory');
    assert.equal(await lauf('cd ' + D + '/profile'), 'bash: cd: ' + D + '/profile: Not a directory');

    /* ---- B: Schreibschutz, EXDEV, E6 ---- */
    await cmd('cd ~');
    await lauf('echo eins > a.txt');
    const ro = [
      ['touch /intel/x', "touch: cannot touch '/intel/x': Read-only file system"],
      ['mkdir /intel/dossiers/x', "mkdir: cannot create directory '/intel/dossiers/x': Read-only file system"],
      ['rm /intel/README', "rm: cannot remove '/intel/README': Read-only file system"],
      ['rm -r /intel/cases/F-001', "rm: cannot remove '/intel/cases/F-001': Read-only file system"],
      ['mv /intel/README r.txt', "mv: cannot move '/intel/README' to 'r.txt': Invalid cross-device link"],
      ['mv a.txt /intel/x', "mv: cannot move 'a.txt' to '/intel/x': Invalid cross-device link"],
      ['mv a.txt /usr/x', "mv: cannot move 'a.txt' to '/usr/x': Invalid cross-device link"],   /* Paket 3: /etc liegt im VFS, /usr ist eigener Einhängepunkt */
      ['cp /intel/README r.txt', "cp: cannot copy '/intel/README': Operation not permitted"],
      ['cp a.txt /intel/x', "cp: cannot create regular file '/intel/x': Read-only file system"],
      ['cat /intel/README > r.txt', 'bash: cat: Operation not permitted'],
      ['head -n 2 ' + D + '/profile >> r.txt', 'bash: head: Operation not permitted'],
      ['ls /intel > r.txt', 'bash: ls: Operation not permitted'],
      ['echo x > ' + D + '/notes', 'bash: ' + D + '/notes: Read-only file system'],
      ['echo x >> ' + D + '/profile', 'bash: ' + D + '/profile: Read-only file system'],
      ['nano ' + D + '/notes', 'nano: ' + D + '/notes: Read-only file system'],
    ];
    for (const [c, erw] of ro) assert.equal(await lauf(c), erw, c);
    assert.equal(await lauf('ls'), 'a.txt', 'nichts ins VFS übernommen (auch keine leere Zieldatei)');
    await cmd('cd /intel');
    assert.equal(await lauf('ls > ~/l.txt'), 'bash: ls: Operation not permitted');
    assert.equal(await lauf('pwd > ~/p.txt; cat ~/p.txt'), '/intel', 'pwd ist keine Übernahme von Inhalten');
    assert.equal(await lauf('readlink geospatial/pins/PIN-001/dossier > ~/l.txt'), 'bash: readlink: output redirection is not supported for this command');

    /* ---- C: Sperren ---- */
    await cmd('cd ' + D);
    const vorSperre = await lauf('cat profile');
    assert.match(vorSperre, /Emre Kaya/);
    await lauf('cat /intel/dossiers/persons/index');
    await lauf('ls /intel/dossiers/persons');
    await p.evaluate(() => dispatch({ type: 'DOSSIER_SPERREN', id: 'P-0001' }));
    const scroll = await out.textContent();
    assert.doesNotMatch(scroll, /^Name: Emre Kaya$/m, 'gelesenes Profil verschwindet aus dem Scrollback');
    assert.doesNotMatch(scroll, /^P-0001 {2}person/m, 'Indexzeile verschwindet');
    assert.match(scroll, /^P-0002 {2}person/m, 'übrige Indexzeilen bleiben');
    /* Ausgabe eines bestimmten früheren Befehls im Scrollback (bis zur nächsten Promptzeile) */
    const block = (text, befehl) => { const z = text.split('\n'), i = z.lastIndexOf('raizo@terminal:' + D + '$ ' + befehl); const r = []; for (let j = i + 1; j < z.length && !z[j].startsWith('raizo@terminal:'); j++) r.push(z[j]); return r; };
    const lsBlock = block(scroll, 'ls /intel/dossiers/persons');
    assert.ok(!lsBlock.includes('P-0001') && lsBlock.includes('P-0002'), 'Listenzeile verschwindet, übrige bleiben: ' + lsBlock.join(','));
    /* gesperrtes Arbeitsverzeichnis: Prompt bleibt, Zugriff verweigert, hinaus geht es (E9) */
    assert.equal(await prompt.textContent(), 'raizo@terminal:' + D + '$');
    assert.equal(await lauf('ls'), "ls: cannot access '.': Permission denied");
    assert.equal(await lauf('cat notes'), 'cat: notes: Permission denied');
    await cmd('cd ..');
    assert.equal(await lauf('pwd'), '/intel/dossiers/persons');
    assert.doesNotMatch(await lauf('ls'), /P-0001/);
    assert.doesNotMatch(await lauf('cat index'), /P-0001/);
    assert.equal(await lauf('cd P-0001'), 'bash: cd: P-0001: Permission denied');
    assert.equal(await lauf('cat P-0001/profile'), 'cat: P-0001/profile: Permission denied');
    assert.equal(await lauf('ls /intel/geospatial/pins'), 'index\nPIN-002', 'Pin des gesperrten Dossiers fehlt');
    assert.doesNotMatch(await lauf('cat /intel/geospatial/pins/index'), /PIN-001/);
    assert.equal(await lauf('ls /intel/geospatial/zones'), 'index');
    assert.equal(await lauf('ls /intel/geospatial/sightings'), '');
    assert.equal(await lauf('cat /intel/geospatial/sightings/P-0001/SI-001/record'), 'cat: /intel/geospatial/sightings/P-0001/SI-001/record: Permission denied');
    assert.equal(await lauf('cat /intel/geospatial/pins/PIN-001/record'), 'cat: /intel/geospatial/pins/PIN-001/record: Permission denied');
    /* Fall bleibt sichtbar; Dossierkennung im Fall sichtbar, Folgen verweigert; gesperrter Pin nicht offengelegt (E4) */
    assert.equal(await lauf('ls /intel/cases/F-001/dossiers'), 'P-0001\nP-0007');
    assert.equal(await lauf('ls /intel/cases/F-001/pins'), '');
    assert.equal(await lauf('cd /intel/cases/F-001/dossiers/P-0001'), 'bash: cd: /intel/cases/F-001/dossiers/P-0001: Permission denied');
    assert.match(await lauf('cat /intel/cases/F-001/case'), /^Title: Fall Alpha$/m);
    /* Tab-Ergänzung kennt gesperrte Objekte nicht */
    const tab = async text => { await inp.fill(text); await inp.press('Tab'); await p.waitForTimeout(150); const v = await inp.inputValue(); await inp.fill(''); return v; };
    await inp.fill('cd /intel/dossiers/persons/P-000'); await inp.press('Tab'); await p.waitForTimeout(150);
    const liste = await p.evaluate(() => (terminalTabAuswahl && terminalTabAuswahl.anzeige) || []);
    assert.ok(!liste.includes('P-0001/') && liste.includes('P-0002/'), JSON.stringify(liste));
    await inp.press('Escape'); await inp.fill('');
    assert.equal(await tab('cat /intel/geospatial/pins/PIN-00'), 'cat /intel/geospatial/pins/PIN-002/');
    /* Entsperren nur über sudo open (auch mit Pfad) */
    await inp.fill('sudo open ' + D); await inp.press('Enter');
    await p.waitForFunction(() => !!TERMINAL_ZUSTAND.sudo && !TERMINAL_ZUSTAND.sudo.pruefen);
    await inp.focus(); await p.keyboard.type(PW); await inp.press('Enter');
    await p.waitForFunction(() => !TERMINAL_ZUSTAND.kette && !TERMINAL_ZUSTAND.sudo);
    assert.equal(await p.evaluate(() => PROFIL.gesperrt.includes('P-0001')), false);
    assert.deepEqual(await p.evaluate(() => [STATE.ui.modul, STATE.dossiers.auswahl]), ['dossier', 'P-0001']);
    if (await p.evaluate(() => document.getElementById('profil-terminal').classList.contains('minimiert'))) await p.click('#profil-terminal-minimieren');
    assert.match(await lauf('cat ' + D + '/profile'), /^Name: Emre Kaya$/m);

    /* ---- D: Navigation ---- */
    const zurueck = async () => { if (await p.evaluate(() => document.getElementById('profil-terminal').classList.contains('minimiert'))) await p.click('#profil-terminal-minimieren'); };
    await cmd('cd /intel/geospatial/pins/PIN-001');
    await cmd('map .');
    assert.deepEqual(await p.evaluate(() => [STATE.ui.modul, VIEW.karte.auswahl]), ['karte', 'PIN-001']);
    await zurueck();
    await cmd('open .');
    assert.deepEqual(await p.evaluate(() => [STATE.ui.modul, STATE.dossiers.auswahl]), ['dossier', 'P-0001'], 'open auf Pin öffnet das verknüpfte Dossier');
    await zurueck();
    await cmd('open /intel/cases/F-001');
    assert.deepEqual(await p.evaluate(() => [STATE.ui.modul, X_VIEW.id]), ['x', 'F-001']);
    await zurueck();
    assert.equal(await lauf('map /intel/cases/F-001'), 'map: /intel/cases/F-001: not a map object');
    assert.equal(await lauf('open ~'), 'open: ~: not a research object (use a path in /intel)');
    assert.equal(await lauf('open /intel/dossiers'), 'open: /intel/dossiers: not a research object');
    assert.equal(await lauf('open /intel/nichts'), 'open: /intel/nichts: No such file or directory');
    await cmd('map ../PIN-002');
    assert.deepEqual(await p.evaluate(() => [STATE.ui.modul, VIEW.karte.auswahl]), ['karte', 'PIN-002'], 'relativer Pfad');
    await zurueck();
    await cmd('map /intel/geospatial/sightings/P-0001/SI-001');
    assert.equal(await p.evaluate(() => STATE.ui.modul), 'karte');
    await zurueck();
    /* Knopf "Im Terminal" */
    await p.evaluate(() => { dispatch({ type: 'DOSSIER_GEOEFFNET', id: 'P-0007', navigieren: true }); });
    await p.evaluate(() => document.getElementById('btn-dterminal').click());
    await p.waitForFunction(() => !TERMINAL_ZUSTAND.kette);
    assert.equal(await prompt.textContent(), 'raizo@terminal:/intel/dossiers/persons/P-0007$');
    assert.match(await out.textContent(), /raizo@terminal:\/intel\/geospatial\/pins\/PIN-001\$ cd \/intel\/dossiers\/persons\/P-0007$/m, 'der Wechsel ist im Verlauf sichtbar');
    await inp.fill('ungesendet');
    await p.evaluate(() => document.getElementById('btn-dterminal').click());
    assert.equal(await inp.inputValue(), 'ungesendet', 'ungesendete Eingabe bleibt');
    assert.equal(await prompt.textContent(), 'raizo@terminal:/intel/dossiers/persons/P-0007$');
    await inp.fill('');
    await p.evaluate(() => xOeffnen('F-001'));
    await p.evaluate(() => document.getElementById('x-terminal').click());   /* die Konsole liegt über der Fallansicht */
    await p.waitForFunction(() => !TERMINAL_ZUSTAND.kette);
    assert.equal(await prompt.textContent(), 'raizo@terminal:/intel/cases/F-001$');

    /* ---- E: Notiz anhängen ---- */
    await cmd('cd ' + D);
    await p.evaluate(() => { VIEW.draft['dn-P-0001'] = 'Entwurf in der Oberfläche'; });
    const n0 = await p.evaluate(() => STATE.dossiers.entitaeten['P-0001'].notizen.length);
    assert.equal(await lauf('echo "Further verification required." >> notes'), '');
    assert.equal(await p.evaluate(() => STATE.dossiers.entitaeten['P-0001'].notizen.length), n0 + 1, 'genau eine Notiz');
    assert.match(await lauf('tail -n 3 notes'), /^DN-\d{3}\n.* UTC\nFurther verification required\.$/);
    assert.equal(await p.evaluate(() => VIEW.draft['dn-P-0001']), 'Entwurf in der Oberfläche', 'Entwurf der Oberfläche bleibt');
    assert.deepEqual(await p.evaluate(() => [JSON.parse(localStorage.getItem(STORAGE_KEY)).dossiers.entitaeten['P-0001'].notizen.at(-1).text,
      localStorage.getItem(PROFIL_KEY).includes('Further verification required.')]), ['Further verification required.', true], 'dauerhaft gespeichert (Zustand und Profil)');
    await lauf('echo eins > ~/entwurf.txt');
    assert.equal(await lauf('cat ~/entwurf.txt >> notes'), '');
    assert.equal(await p.evaluate(() => STATE.dossiers.entitaeten['P-0001'].notizen.at(-1).text), 'eins');
    assert.equal(await lauf('echo "" >> notes'), '');
    assert.equal(await p.evaluate(() => STATE.dossiers.entitaeten['P-0001'].notizen.length), n0 + 2, 'leerer Text legt keine Notiz an');
    assert.equal(await lauf('cat profile >> notes'), 'bash: cat: Operation not permitted');
    assert.equal(await lauf('echo x >> /intel/dossiers/persons/P-0007/../P-0001/notes'), '');
    assert.equal(await p.evaluate(() => STATE.dossiers.entitaeten['P-0001'].notizen.length), n0 + 3);
    /* Speicherfehler: Rücknahme, Fehlermeldung, Bestand unverändert */
    await p.evaluate(() => { window.__set = Storage.prototype.setItem; Storage.prototype.setItem = function () { throw new Error('voll'); }; });
    assert.equal(await lauf('echo verloren >> notes'), 'bash: notes: Input/output error');
    await p.evaluate(() => { Storage.prototype.setItem = window.__set; });
    assert.equal(await p.evaluate(() => STATE.dossiers.entitaeten['P-0001'].notizen.length), n0 + 3, 'zurückgenommen');
    assert.equal(await p.evaluate(() => STATE.log.some(e => /verloren/.test(e.detail))), false, 'kein Protokolleintrag');
    assert.doesNotMatch(await lauf('cat notes'), /verloren/);
    /* gesperrt: kein Schreiben */
    await p.evaluate(() => dispatch({ type: 'DOSSIER_SPERREN', id: 'P-0001' }));
    assert.equal(await lauf('echo y >> notes'), 'bash: notes: Permission denied');
    assert.equal(await p.evaluate(() => STATE.dossiers.entitaeten['P-0001'].notizen.length), n0 + 3);
    assert.deepEqual(fehlerSeite, []);
    console.log('OK: terminal-intel (Baum, Links, Schreibschutz, Sperren, Navigation, Notizen)');
  } finally { await ctx.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
