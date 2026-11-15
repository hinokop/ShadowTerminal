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
    assert.equal(race.filter(x => x.name === 'zone-ZO-997.txt').length, 1);
    assert.equal(race.filter(x => /existiert/.test(x.error || '')).length, 1);
    await rm(join(root, 'ops', 'zone-ZO-997.txt'));
    if (process.platform !== 'win32') {
      await writeFile(join(temp, 'unverändert.txt'), 'unverändert');
      await symlink(join(temp, 'unverändert.txt'), join(root, 'ops', 'zone-ZO-999.txt'));
      assert.match((await call({})).error, /existiert/);
      assert.equal(await readFile(join(temp, 'unverändert.txt'), 'utf8'), 'unverändert');
      await rm(join(root, 'ops', 'zone-ZO-999.txt'));
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
      dispatch({ type: 'PIN_GEAENDERT', id: 'PIN-001', notiz: 'Düsseldorf', dossier: 'P-9051' });
      dispatch({ type: 'OZONE_ANGELEGT', ll: [50.1, 8.2], name: 'Testzone' });
      dispatch({ type: 'OZONE_GEAENDERT', id: 'ZO-001', r: 300, notiz: 'Größe geprüft', dossier: 'P-9051' });
      dispatch({ type: 'NAVIGATION', modul: 'karte' });
    });
    const choose = (page, id) => page.evaluate(id => karteWaehlen(id, false, true), id);
    const p = await open(ready);
    await seed(p);
    const exportVia = async (button, folder, message) => {
      await p.locator('#' + button).click();
      await p.locator('#k-txt-ordner').selectOption(folder);
      await p.locator('#dlg-ok').click();
      await p.waitForFunction(message => document.querySelector('#sys-msg').innerText.includes(message), message);
    };
    await choose(p, 'PIN-001');
    await exportVia('pin-export', 'dokumente', '/pgcl-eu3.arch07/dokumente/lageblatt-PIN-001.txt');
    const pin = join(root, 'dokumente', 'lageblatt-PIN-001.txt'), original = await readFile(pin, 'utf8');
    assert.match(original, /PIN-001 Testpin[\s\S]*Düsseldorf/);
    assert.doesNotMatch(original, /P-9051|Umkreis|In der Nähe/);
    await p.evaluate(() => dispatch({ type: 'PIN_GEAENDERT', id: 'PIN-001', notiz: 'Später' }));
    await exportVia('pin-export', 'dokumente', 'Datei existiert bereits');
    assert.equal(await readFile(pin, 'utf8'), original);
    await choose(p, 'ZO-001');
    await exportVia('oz-export', 'ops', '/pgcl-eu3.arch07/ops/zone-ZO-001.txt');
    assert.match(await readFile(join(root, 'ops', 'zone-ZO-001.txt'), 'utf8'), /ZO-001 Testzone[\s\S]*Radius: 300 m[\s\S]*Größe geprüft/);
    assert.deepEqual(await readdir(join(root, 'ops')), ['zone-ZO-001.txt']);

    await p.locator('#oz-export').click();
    await p.evaluate(() => { (PROFIL.gesperrt ||= []).push('P-9051'); });
    const davor = exporte.length;
    await p.locator('#dlg-ok').click();
    assert.match(await p.locator('#sys-msg').innerText(), /Dossier ist gesperrt/);
    await choose(p, 'PIN-001');
    await p.locator('#pin-export').click();
    assert.match(await p.locator('#sys-msg').innerText(), /Dossier ist gesperrt/);
    assert.equal(exporte.length, davor);

    await p.evaluate(() => dispatch({ type: 'NAVIGATION', modul: 'profil' }));
    await p.locator('#profil-terminal > summary').click();
    const input = p.locator('#profil-terminal-eingabe'), out = p.locator('#profil-terminal-ausgabe');
    await input.fill('secure-channel --connect --onion --ephemeral');
    await input.press('Enter');
    await p.waitForFunction(() => document.querySelector('#profil-terminal-prompt').textContent === 'you >');
    for (const [folder, short, name] of [['dokumente', 'lageb', 'lageblatt-PIN-001.txt'], ['ops', 'zone', 'zone-ZO-001.txt']]) {
      const arg = 'send /pgcl-eu3.arch07/' + folder + '/';
      await input.fill(arg + short);
      await input.press('Tab');
      await p.waitForFunction(value => document.querySelector('#profil-terminal-eingabe').value === value, arg + name);
      await input.press('Enter');
      await p.waitForFunction(name => document.querySelector('#profil-terminal-ausgabe').textContent.includes('»' + name + '«'), name);
      assert.match(await out.textContent(), /Lokale Archivbrücke … 200 OK/);
      await p.waitForFunction(() => document.querySelector('#profil-terminal-prompt').textContent === 'you >');
    }

    const offline = await open('');
    await seed(offline);
    await choose(offline, 'ZO-001');
    const [download] = await Promise.all([offline.waitForEvent('download'), offline.locator('#oz-export').click()]);
    assert.equal(download.suggestedFilename(), 'zone-ZO-001.txt');
    assert.match(await readFile(await download.path(), 'utf8'), /Testzone/);
    await offline.evaluate(() => dispatch({ type: 'DOSSIER_SPERREN', id: 'P-9051' }));
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
