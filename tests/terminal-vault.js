/* Zentrale Archivsuche mit rein fiktiver VAULT-Ausgabe, realem Inhaltsabruf per bestehender
   geschützter Archivbrücke (gemockt). Keine Browser-Downloads, keine lokalen Pfade in der UI.
   Versionen, Hash-Status, gesperrte Pins/Zonen, sichere sudo-Abfrage und Sperr-Scrollback. */
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { chromium } = require('playwright');
const { APP } = require('./_pfad');

(async () => {
  const browser = await chromium.launch();
  try {
    const p = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    p.setDefaultTimeout(15000);
    const errors = [], calls = [];
    let archiv = { ops: [], dokumente: [] };
    const sha = x => createHash('sha256').update(x, 'utf8').digest('hex');
    await p.route(/^https?:/, async route => {
      const req = route.request();
      if (req.url() !== 'http://127.0.0.1:45674/db') return route.abort();
      const data = req.postDataJSON();
      calls.push({ op: data.op, parts: data.parts });
      if (data.op === 'ls') {
        const folder = data.parts.join('');
        return route.fulfill({ json: { entries: (archiv[folder] || []).map(x => ({
          name: x.name, dir: false, bytes: Buffer.byteLength(x.text), mtime: x.mtime
        })) } });
      }
      if (data.op === 'cat') {
        const [folder, file] = data.parts;
        const x = (archiv[folder] || []).find(y => y.name === file);
        return route.fulfill({ json: x ? { text: x.text } : { error: 'Datei oder Ordner nicht gefunden' } });
      }
      return route.fulfill({ json: { error: 'nicht vorgesehen' } });
    });
    await p.goto(APP + '#db=45674.' + 'v'.repeat(43));
    await p.fill('#gate-pw', 'pw-test-123');
    if (await p.isVisible('#gate-pw2')) await p.fill('#gate-pw2', 'pw-test-123');
    await p.click('#gate-go');
    await p.waitForFunction(() => !document.body.classList.contains('locked'));
    const z = await p.evaluate(() => {
      dispatch({ type: 'DOSSIER_ANGELEGT', name: 'Geheime Quellakte', typ: 'Person' });
      const d = STATE.dossiers.eigene.find(x => x.name === 'Geheime Quellakte').id;
      const pin = (name, dossier) => {
        dispatch({ type: 'PIN_ANGELEGT', ll: [52.52 + (PROFIL.pins || []).length * 0.002, 13.405], name, dossier });
        return PROFIL.pins.at(-1).id;
      };
      const nord = pin('Treffpunkt Nord');
      const sued = pin('Treffpunkt Süd');
      const secret = pin('Treffpunkt Geheim', d);
      dispatch({ type: 'OZONE_ANGELEGT', ll: [52.53, 13.40], name: 'Treffpunkt Reserve' });
      const zone = PROFIL.zonen.at(-1).id;
      dispatch({ type: 'OZONE_ANGELEGT', ll: [52.531, 13.403], name: 'Zone Gesperrt' });
      const zoneLock = PROFIL.zonen.at(-1).id;
      dispatch({ type: 'OZONE_GEAENDERT', id: zoneLock, dossier: d });
      const texts = {
        nord: pinText(PROFIL.pins.find(p => p.id === nord)) + '\n',
        sued: pinText(PROFIL.pins.find(p => p.id === sued)) + '\n',
        secret: pinText(PROFIL.pins.find(p => p.id === secret)) + '\n',
        zone: eigeneZoneText(PROFIL.zonen.find(p => p.id === zone)) + '\n',
        zoneLock: eigeneZoneText(PROFIL.zonen.find(p => p.id === zoneLock)) + '\n'
      };
      dispatch({ type: 'DOSSIER_SPERREN', id: d });
      dispatch({ type: 'NAVIGATION', modul: 'profil' }); renderModule();
      return { nord, sued, secret, zone, zoneLock, dossier: d, texts };
    });
    archiv = {
      ops: [
        { name: 'lageblatt-' + z.nord + '.txt', text: 'ALTE VERSION\n', mtime: 100 },
        { name: 'lageblatt-' + z.nord + '-v2.txt', text: z.texts.nord, mtime: 300 },
        { name: 'lageblatt-' + z.sued + '.txt', text: z.texts.sued, mtime: 190 },
        { name: 'lageblatt-' + z.secret + '.txt', text: z.texts.secret, mtime: 210 },
        { name: 'zone-' + z.zoneLock + '.txt', text: z.texts.zoneLock, mtime: 220 },
        { name: 'unrelated.txt', text: 'NOT A RECORD', mtime: 350 }
      ],
      dokumente: [
        { name: 'zone-' + z.zone + '.txt', text: z.texts.zone, mtime: 250 }
      ]
    };
    await p.evaluate(({ north, text, data }) => {
      PROFIL.exporte = PROFIL.exporte || {};
      PROFIL.exporte['pin:' + north + ':ops'] = { name: 'lageblatt-' + north + '-v2.txt', sha: data };
    }, { north: z.nord, text: z.texts.nord, data: sha(z.texts.nord) });

    await p.click('#profil-terminal-oeffnen');
    const inp = p.locator('#profil-terminal-eingabe'), out = p.locator('#profil-terminal-ausgabe');
    const cmd = async line => {
      const start = await out.textContent();
      await inp.fill(line);
      await inp.press('Enter');
      await p.waitForFunction(() => !TERMINAL_ZUSTAND.kette);
      const whole = await out.textContent();
      return whole.slice(start.length);
    };
    const code = async () => (await cmd('echo $?')).trim().split('\n').at(-1);
    let res = await cmd('exports treffpunkt');
    assert.match(res, new RegExp(z.nord + '\\s+Treffpunkt Nord'));
    assert.match(res, new RegExp(z.sued + '\\s+Treffpunkt Süd'));
    assert.match(res, new RegExp(z.zone + '\\s+Treffpunkt Reserve'));
    assert.doesNotMatch(res, /Geheim|Zone Gesperrt|lageblatt|\.txt|dokumente|ops\/|127\.0\.0\.1/);
    assert.equal(await code(), '0');

    res = await cmd('exports ' + z.secret);
    assert.match(res, new RegExp(z.secret + '\\s+\\[LOCKED\\]'));
    assert.doesNotMatch(res, /Treffpunkt Geheim|lageblatt/);

    res = await cmd('open export "Treffpunkt Nord"');
    assert.match(res, /VAULT :: RECORD ACCESS/);
    assert.match(res, /INTEGRITY\s+VERIFIED \/ CURRENT/);
    assert.match(res, new RegExp(z.nord));
    assert.match(res, /VAULT :: END OF RECORD/);
    assert.doesNotMatch(res, /ops\/|dokumente\/|localhost|127\.0\.0\.1|\.txt|Download|lokale Datenbank/i);
    assert.equal(await code(), '0');
    assert.equal(await p.evaluate(() => STATE.ui.modul), 'profil', 'Record wird innerhalb der Shell gelesen');
    assert.ok(calls.some(x => x.op === 'cat' && x.parts[1] === 'lageblatt-' + z.nord + '-v2.txt'),
      'jüngste vorhandene Version wurde tatsächlich gelesen');

    res = await cmd('open export "Treffpunkt Reserve"');
    assert.match(res, new RegExp(z.zone));
    assert.match(res, /INTEGRITY\s+UNTRACKED/, 'nicht registrierter Alt-Export bleibt auffindbar');
    assert.equal(await code(), '0');

    res = await cmd('open export treffpunkt');
    assert.match(res, /ambiguous name/);
    assert.equal(await code(), '1');

    res = await cmd('open export "Treffpunkt Geheim"');
    assert.match(res, /record not found/);
    assert.equal(await code(), '1');

    res = await cmd('open export ' + z.secret);
    assert.match(res, /Permission denied/);
    assert.equal(await code(), '1');
    res = await cmd('open export ' + z.zoneLock);
    assert.match(res, /Permission denied/, 'mit Dossier verknüpfte Zone bleibt gesperrt');
    assert.equal(await code(), '1');
    assert.ok(!calls.some(x => x.op === 'cat' && x.parts[1] === 'lageblatt-' + z.secret + '.txt'),
      'ohne Authentifizierung kein Lesezugriff auf gesperrten Export');

    /* Auch sudo löst gesperrte Objektnamen nicht auf, sondern nur die Kennung. */
    res = await cmd('sudo open export "Treffpunkt Geheim"');
    assert.match(res, /record not found/);
    assert.equal(await p.evaluate(() => !!TERMINAL_ZUSTAND.sudo), false);

    /* Tab übernimmt sichtbare Namen als Kennungen. */
    await inp.fill('open export Treffpunkt N');
    await inp.press('Tab');
    assert.equal(await inp.inputValue(), 'open export ' + z.nord);
    await inp.fill('sudo open export Treffpunkt G');
    await inp.press('Tab');
    assert.equal(await inp.inputValue(), 'sudo open export Treffpunkt G', 'gesperrter Name bleibt verborgen');
    await inp.fill('open export ' + z.secret.slice(0, -1));
    await inp.press('Tab');
    assert.equal(await inp.inputValue(), 'open export ' + z.secret);
    await inp.fill('');

    /* Nachträgliche Bearbeitung => Export unverändert, aktueller Inhalt abweichend. */
    await p.evaluate(id => dispatch({ type: 'PIN_GEAENDERT', id, notiz: 'Neuer Treffpunkt nach Erstexport' }), z.nord);
    res = await cmd('open export Treffpunkt Nord');
    assert.match(res, /INTEGRITY\s+VERIFIED \/ OUTDATED/);

    /* Archivinhalt extern verändert: Prüfsumme stimmt nicht mehr. */
    archiv.ops.find(x => x.name === 'lageblatt-' + z.nord + '-v2.txt').text = 'FREMDE MANIPULATION\n';
    res = await cmd('open export ' + z.nord);
    assert.match(res, /INTEGRITY\s+INTEGRITY MISMATCH/);

    /* Nach erfolgreichem sudo ist die Sperre dauerhaft aufgehoben und der Inhalt zugänglich. */
    await inp.fill('sudo open export ' + z.secret); await inp.press('Enter');
    await p.waitForFunction(() => !!TERMINAL_ZUSTAND.sudo && !TERMINAL_ZUSTAND.sudo.pruefen);
    await inp.focus(); await p.keyboard.type('pw-test-123');
    assert.equal(await inp.inputValue(), '');
    await inp.press('Enter');
    await p.waitForFunction(() => !TERMINAL_ZUSTAND.kette);
    assert.equal(await p.evaluate(id => PROFIL.gesperrt.includes(id), z.dossier), false);
    assert.match(await out.textContent(), /Treffpunkt Geheim/);
    assert.equal(await code(), '0');

    /* Neue Sperre entfernt den kompletten Datensatz, nicht bloß den Namen. */
    await p.evaluate(id => dispatch({ type: 'DOSSIER_SPERREN', id }), z.dossier);
    const terminalText = await out.textContent();
    assert.doesNotMatch(terminalText, /Treffpunkt Geheim|Position: 52\.52/, 'Textkörper des gesperrten Exports gelöscht');
    assert.doesNotMatch(terminalText, /Zone Gesperrt/, 'gesperrter Zonenname maskiert');
    await cmd('echo SAFE');
    assert.doesNotMatch(await out.textContent(), /Treffpunkt Geheim/);
    assert.deepEqual(errors, []);
    console.log('OK: VAULT-Katalog, Revision, Integrität, Name, Dossiersperren, sudo und pfadfreie Inline-Ausgabe');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
