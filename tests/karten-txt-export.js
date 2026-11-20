const { chatBereit } = require('./_kestrel');
/* Kartenobjekt → neue Archiv-TXT → Tab im offenen Kanal → send. */
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { mkdtemp, copyFile, mkdir, readFile, writeFile, symlink, readdir, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { chromium } = require('playwright');
const PF = require('./_pfad');

(async () => {
  const temp = await mkdtemp(join(tmpdir(), 'shadow-txt-')), root = join(temp, 'pgcl-eu3.arch07');
  let helper, browser;
  try {
    for (const name of ['dokumente', 'ops', 'dossiers']) await mkdir(join(root, name), { recursive: true });
    await copyFile(join(PF.ROOT, 'terminal_lokal.py'), join(temp, 'terminal_lokal.py'));
    helper = spawn(process.env.SHADOW_TEST_PYTHON || (process.platform === 'win32' ? 'python' : 'python3'), [join(temp, 'terminal_lokal.py'), '--serve-only']);
    const ready = await Promise.race([once(helper.stdout, 'data').then(([d]) => d.toString().trim()), once(helper, 'exit').then(([c]) => { throw new Error('Dateibrücke beendet: ' + c); })]);
    const [, port, token] = /^#db=(\d+)\.([\w-]+)$/.exec(ready), address = 'http://127.0.0.1:' + port + '/db';
    const call = async extra => {
      const r = await fetch(address, { method: 'POST', headers: { Origin: 'null', 'Content-Type': 'application/json', 'X-Shadow-Token': token },
        body: JSON.stringify({ op: 'export-txt', folder: 'ops', kind: 'zone', id: 'ZO-999', text: 'Prüfung', ...extra }) });
      return r.json();
    };
    for (const extra of [{ folder: 'dossiers' }, { id: '../ZO-1' }, { kind: 'pin' }, { id: 'ZO-999.txt' }, { text: '' }, { text: 'a\0b' }, { name: 'abc.txt' }]) assert.match((await call(extra)).error, /Permission denied/);
    assert.match((await call({ text: 'ä'.repeat(32769) })).error, /zu groß/);
    const race = await Promise.all([call({ id: 'ZO-997', text: 'eins' }), call({ id: 'ZO-997', text: 'zwei' })]);
    assert.deepEqual(race.map(x => x.name).sort(), ['zone-ZO-997-v2.txt', 'zone-ZO-997.txt']);
    assert.deepEqual(race.map(x => x.mode).sort(), ['neu', 'version']);
    await rm(join(root, 'ops', 'zone-ZO-997.txt')); await rm(join(root, 'ops', 'zone-ZO-997-v2.txt'));
    /* Ersetzen nur mit passender Prüfsumme der zuletzt geschriebenen Datei */
    const erst = await call({ id: 'ZO-996', text: 'eins' });
    assert.equal(erst.mode, 'neu'); assert.match(erst.sha256, /^[0-9a-f]{64}$/);
    const last = { name: erst.name, sha: erst.sha256 };
    assert.equal((await call({ id: 'ZO-996', text: 'eins', last })).mode, 'unveraendert');
    assert.equal((await call({ id: 'ZO-996', text: 'eins' })).mode, 'unveraendert');
    const ers = await call({ id: 'ZO-996', text: 'zwei', last });
    assert.equal(ers.mode, 'ersetzt'); assert.equal(ers.name, 'zone-ZO-996.txt');
    assert.equal(await readFile(join(root, 'ops', 'zone-ZO-996.txt'), 'utf8'), 'zwei');
    const falsch = await call({ id: 'ZO-996', text: 'drei', last });                  /* Prüfsumme passt nicht mehr zur Datei */
    assert.equal(falsch.mode, 'version'); assert.equal(falsch.name, 'zone-ZO-996-v2.txt');
    assert.equal(await readFile(join(root, 'ops', 'zone-ZO-996.txt'), 'utf8'), 'zwei');
    assert.equal((await call({ id: 'ZO-996', text: 'vier', last: { name: falsch.name, sha: falsch.sha256 } })).mode, 'ersetzt');
    assert.equal(await readFile(join(root, 'ops', 'zone-ZO-996-v2.txt'), 'utf8'), 'vier');
    assert.equal((await call({ id: 'ZO-996', text: 'fünf', last: { name: 'zone-ZO-995.txt', sha: erst.sha256 } })).mode, 'version');   /* fremder Name wird nicht als Ziel akzeptiert */
    assert.match((await call({ id: 'ZO-996', text: 'x', last: { name: '../x.txt', sha: erst.sha256 } })).name, /^zone-ZO-996-v[0-9]+\.txt$/);   /* ungültiger Name als Ziel wird ignoriert */
    assert.match((await call({ id: 'ZO-996', text: 'x', last: { name: 'zone-ZO-996.txt', sha: 'abc' } })).error, /Permission/);
    assert.deepEqual((await readdir(join(root, 'ops'))).filter(n => n.startsWith('.')), []);
    for (const n of await readdir(join(root, 'ops'))) await rm(join(root, 'ops', n));
    if (process.platform !== 'win32') {
      await writeFile(join(temp, 'unverändert.txt'), 'unverändert');
      await symlink(join(temp, 'unverändert.txt'), join(root, 'ops', 'zone-ZO-999.txt'));
      const sym = await call({});                                            /* ein Link am Zielnamen wird weder gelesen noch ersetzt */
      assert.equal(sym.mode, 'version'); assert.equal(sym.name, 'zone-ZO-999-v2.txt');
      assert.equal((await call({ last: { name: 'zone-ZO-999.txt', sha: sym.sha256 } })).mode, 'unveraendert');
      assert.equal(await readFile(join(temp, 'unverändert.txt'), 'utf8'), 'unverändert');
      await rm(join(root, 'ops', 'zone-ZO-999.txt')); await rm(join(root, 'ops', 'zone-ZO-999-v2.txt'));
      await rm(join(root, 'ops'), { recursive: true });
      await symlink(temp, join(root, 'ops'));
      assert.ok((await call({})).error);
      assert.equal((await readdir(temp)).includes('zone-ZO-999.txt'), false);
      await rm(join(root, 'ops'));
      await mkdir(join(root, 'ops'));
    }

    browser = await chromium.launch();
    const errors = [], exporte = [];
    const open = async fragment => {
      const page = await browser.newPage({ reducedMotion: 'reduce' });
      page.on('pageerror', e => errors.push(e.message));
      await page.route(/^https?:/, route => {
        if (route.request().url() !== address) return route.abort();
        if (route.request().postDataJSON()?.op === 'export-txt') exporte.push(route.request().postDataJSON());
        return route.continue();
      });
      await page.goto(PF.APP + fragment);
      await page.locator('#gate-pw').fill('pw-test-123');
      if (await page.locator('#gate-pw2').isVisible()) await page.locator('#gate-pw2').fill('pw-test-123');
      await page.locator('#gate-go').click();
      await page.waitForFunction(() => !document.body.classList.contains('locked'));
      return page;
    };
    const seed = page => page.evaluate(() => {
      dispatch({ type: 'PIN_ANGELEGT', ll: [50.1, 8.2], name: 'Testpin' });
      dispatch({ type: 'PIN_GEAENDERT', id: 'PIN-001', notiz: 'Düsseldorf', dossier: 'P-0004' });
      dispatch({ type: 'OZONE_ANGELEGT', ll: [50.1, 8.2], name: 'Testzone' });
      dispatch({ type: 'OZONE_GEAENDERT', id: 'ZO-001', r: 300, notiz: 'Größe geprüft', dossier: 'P-0004' });
      dispatch({ type: 'NAVIGATION', modul: 'karte' });
    });
    const choose = (page, id) => page.evaluate(id => karteWaehlen(id, false, true), id);
    const p = await open(ready);
    await seed(p);
    const exportVia = async (button, folder, message) => {
      await p.evaluate(() => meldung(''));   /* alte Meldung leeren: gewartet wird auf die dieses Exports */
      await p.locator('#' + button).click();
      await p.locator('#k-txt-ordner').selectOption(folder);
      await p.locator('#dlg-ok').click();
      await p.waitForFunction(message => document.querySelector('#sys-msg').innerText.includes(message), message);
    };
    await choose(p, 'PIN-001');
    await exportVia('pin-export', 'dokumente', '/pgcl-eu3.arch07/dokumente/lageblatt-PIN-001.txt');
    const pin = join(root, 'dokumente', 'lageblatt-PIN-001.txt'), original = await readFile(pin, 'utf8');
    assert.match(original, /PIN-001 Testpin[\s\S]*Düsseldorf/);
    assert.doesNotMatch(original, /P-0004|Umkreis|In der Nähe/);
    await p.evaluate(() => dispatch({ type: 'PIN_GEAENDERT', id: 'PIN-001', notiz: 'Später' }));
    await exportVia('pin-export', 'dokumente', 'TXT ersetzt');                         /* unverändert seit dem letzten Export: ersetzen */
    const geaendert = await readFile(pin, 'utf8');
    assert.notEqual(geaendert, original); assert.match(geaendert, /Später/);
    await exportVia('pin-export', 'dokumente', 'unverändert');
    await writeFile(pin, geaendert + 'Handnotiz\n');                                         /* von Hand verändert: nie überschreiben */
    await p.evaluate(() => dispatch({ type: 'PIN_GEAENDERT', id: 'PIN-001', notiz: 'Noch später' }));
    await exportVia('pin-export', 'dokumente', 'Neue Version gespeichert');
    assert.match(await readFile(pin, 'utf8'), /Handnotiz/);
    assert.match(await readFile(join(root, 'dokumente', 'lageblatt-PIN-001-v2.txt'), 'utf8'), /Noch später/);
    await p.evaluate(() => dispatch({ type: 'PIN_GEAENDERT', id: 'PIN-001', notiz: 'Zuletzt' }));
    await exportVia('pin-export', 'dokumente', 'TXT ersetzt');                          /* die zuletzt geschriebene Version wird weitergeführt */
    assert.match(await readFile(join(root, 'dokumente', 'lageblatt-PIN-001-v2.txt'), 'utf8'), /Zuletzt/);
    assert.match(await readFile(pin, 'utf8'), /Handnotiz/);
    assert.equal(await p.evaluate(() => Object.keys(PROFIL.exporte).length > 0), true);
    /* Fremddatei: identischer Inhalt wird als unverändert gemeldet, darf aber nicht als eigener Export gemerkt werden */
    await p.evaluate(() => dispatch({ type: 'PIN_ANGELEGT', ll: [50.2, 8.3], name: 'Fremdpin' }));
    await choose(p, 'PIN-002');
    await exportVia('pin-export', 'dokumente', '/pgcl-eu3.arch07/dokumente/lageblatt-PIN-002.txt');
    const fremd = join(root, 'dokumente', 'lageblatt-PIN-002.txt'), fremdInhalt = await readFile(fremd);
    await p.evaluate(() => { Object.keys(PROFIL.exporte).filter(k => /PIN-002/.test(k)).forEach(k => delete PROFIL.exporte[k]); });   /* Terminal kennt die Datei nicht mehr */
    await exportVia('pin-export', 'dokumente', 'unverändert');
    assert.equal(await p.evaluate(() => Object.keys(PROFIL.exporte).filter(k => /PIN-002/.test(k)).length), 0);
    await p.evaluate(() => dispatch({ type: 'PIN_GEAENDERT', id: 'PIN-002', notiz: 'Geändert' }));
    await exportVia('pin-export', 'dokumente', 'Neue Version gespeichert');
    assert.deepEqual(await readFile(fremd), fremdInhalt);                                 /* Originaldatei bytegleich */
    assert.match(await readFile(join(root, 'dokumente', 'lageblatt-PIN-002-v2.txt'), 'utf8'), /Geändert/);
    await choose(p, 'ZO-001');
    await exportVia('oz-export', 'ops', '/pgcl-eu3.arch07/ops/zone-ZO-001.txt');
    assert.match(await readFile(join(root, 'ops', 'zone-ZO-001.txt'), 'utf8'), /ZO-001 Testzone[\s\S]*Radius: 300 m[\s\S]*Größe geprüft/);
    assert.deepEqual(await readdir(join(root, 'ops')), ['zone-ZO-001.txt']);

    await p.locator('#oz-export').click();
    await p.evaluate(() => { (PROFIL.gesperrt ||= []).push('P-0004'); });
    const davor = exporte.length;
    await p.locator('#dlg-ok').click();
    assert.match(await p.locator('#sys-msg').innerText(), /Dossier ist gesperrt/);
    await choose(p, 'PIN-001');
    await p.locator('#pin-export').click();
    assert.match(await p.locator('#sys-msg').innerText(), /Dossier ist gesperrt/);
    assert.equal(exporte.length, davor);

    await p.evaluate(() => dispatch({ type: 'NAVIGATION', modul: 'profil' }));
    await p.locator('#profil-terminal-oeffnen').click();
    const input = p.locator('#profil-terminal-eingabe'), out = p.locator('#profil-terminal-ausgabe');
    await chatBereit(p);
    const chat = p.locator('#profil-terminal-chat');
    for (const [folder, short, name] of [['dokumente', 'lageblatt-PIN-001.', 'lageblatt-PIN-001.txt'], ['ops', 'zone', 'zone-ZO-001.txt']]) {
      const arg = '/sendfile /pgcl-eu3.arch07/' + folder + '/';
      const vorher = ((await chat.textContent()).match(/': done\n/g) || []).length;
      await input.fill(arg + short);
      await input.press('Tab');
      await p.waitForFunction(value => document.querySelector('#profil-terminal-eingabe').value === value, arg + name);
      await input.press('Enter');
      await p.waitForFunction(n => (document.querySelector('#profil-terminal-chat').textContent.match(/': done\n/g) || []).length > n, vorher, { timeout: 70000 });
      // Statuszeile bis done, danach die URL mit dem Dateinamen als Nachricht
      assert.match(await chat.textContent(), new RegExp("Uploading '" + (arg.slice(10) + name).replace(/\./g, '\\.') + "': done\\n.* - me: http://upload\\.\\S+/file_share/[0-9a-f-]{36}/" + name.replace(/\./g, '\\.') + '$'));
    }

    const offline = await open('');
    await seed(offline);
    await choose(offline, 'ZO-001');
    const [download] = await Promise.all([offline.waitForEvent('download'), offline.locator('#oz-export').click()]);
    assert.equal(download.suggestedFilename(), 'zone-ZO-001.txt');
    assert.match(await readFile(await download.path(), 'utf8'), /Testzone/);
    await offline.evaluate(() => dispatch({ type: 'DOSSIER_SPERREN', id: 'P-0004' }));
    let downloads = 0;
    offline.on('download', () => downloads++);
    await choose(offline, 'PIN-001');
    await offline.locator('#pin-export').click();
    assert.match(await offline.locator('#sys-msg').innerText(), /Dossier ist gesperrt/);
    assert.equal(downloads, 0);
    assert.deepEqual(errors, []);
    console.log('Pin und Zone als TXT, Tab und send, Kollision, Dossiersperre und Download: grün');
  } finally {
    if (browser) await browser.close();
    if (helper && helper.exitCode === null) {
      const beendet = once(helper, 'exit');
      helper.kill();
      await beendet;
    }
    await rm(temp, { recursive: true, force: true });
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
