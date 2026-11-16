const { vorbereiten } = require('./_satcon');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { spawn } = require('node:child_process');
const { mkdtemp, copyFile, mkdir, symlink, readFile, writeFile, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { chromium } = require('playwright');
const PF = require('./_pfad');

(async () => {
  const sandbox = await mkdtemp(join(tmpdir(), 'shadow-terminal-'));
  const db = join(sandbox, 'pgcl-eu3.arch07');
  let helper, b;
  try {
    await mkdir(join(db, 'dossiers'), {recursive:true});
    await copyFile(join(PF.ROOT, 'terminal_lokal.py'), join(sandbox, 'terminal_lokal.py'));
    await writeFile(join(db, 'dossiers', 'eins zwei.txt'), Array.from({length:12}, (_, i) => 'Zeile-' + (i + 1)).join('\n'));
    await writeFile(join(db, 'dossiers', '.intern'), 'verborgen');
    await writeFile(join(db, 'dossiers', 'probe.bin'), Buffer.from([0, 255, 128]));
    await writeFile(join(db, 'dossiers', 'datei mit Leerzeichen.pdf'), Buffer.alloc(2 * 1024 * 1024, 0x41));
    await writeFile(join(sandbox, 'aussen.txt'), 'DARF NICHT ANGEZEIGT WERDEN');
    let link = false;
    try { await symlink(join(sandbox, 'aussen.txt'), join(db, 'dossiers', 'fremd.txt')); link = true; } catch (e) {
      if (process.platform !== 'win32' || !['EACCES','EPERM'].includes(e.code)) throw e;
    }
    helper = spawn(process.env.SHADOW_TEST_PYTHON || (process.platform === 'win32' ? 'python' : 'python3'), [join(sandbox, 'terminal_lokal.py'), '--serve-only']);
    const helperExit = new Promise(resolve => helper.once('exit', (code, signal) => resolve({code, signal})));
    const start = await new Promise((resolve, reject) => {
      helper.once('error', reject); helper.once('exit', code => reject(new Error('Helper exit ' + code)));
      helper.stdout.once('data', d => resolve(d.toString().trim()));
    });
    const [, port, token] = /^#db=(\d+)\.([\w-]+)$/.exec(start);
    let cmdOutput = '';
    helper.stdout.on('data', d => { cmdOutput += d.toString(); });
    const address = 'http://127.0.0.1:' + port + '/db';
    const call = (op, parts, key=token, origin='null') => fetch(address, {
      method:'POST', headers:{'Origin':origin, 'Content-Type':'application/json', 'X-Shadow-Token':key}, body: JSON.stringify({op,parts})
    });
    assert.equal((await call('ls', [], 'wrong')).status, 403);
    assert.equal((await call('ls', [], token, 'https://example.org')).status, 403);
    assert.equal((await fetch(address)).status, 501);
    for (const parts of [['..','aussen.txt'],['C:\\Windows'],['aussen.txt:secret'],['NUL.txt'],['dossiers','eins zwei.txt.']]) {
      for (const op of ['wget', 'send']) assert.equal((await (await call(op, parts)).json()).error, 'Permission denied');
    }
    if (link) for (const op of ['wget', 'send']) {
      assert.equal((await (await call(op, ['dossiers','fremd.txt'])).json()).error, 'Permission denied');
    }
    assert.deepEqual(await (await call('send', ['dossiers','probe.bin'])).json(), {name:'probe.bin', bytes:3});
    b = await chromium.launch();
    const p = await b.newPage();
    const errors = [];
    p.on('pageerror', e => errors.push(e.message));
    const netz = [];
    p.on('request', r => { if (/^https?:/.test(r.url())) netz.push(r.url()); });
    await p.route(/^https?:\/\//, r => r.request().url().startsWith('http://127.0.0.1:' + port + '/') ? r.continue() : r.abort());
    await p.goto(PF.APP + start);
    const passwort = randomBytes(16).toString('hex');
    await p.locator('#gate-pw').fill(passwort);
    if (await p.locator('#gate-pw2').isVisible()) await p.locator('#gate-pw2').fill(passwort);
    await p.click('#gate-go');
    await p.locator('#profil-terminal > summary').click();
    const out = p.locator('#profil-terminal-ausgabe');
    await p.waitForFunction(() => !TERMINAL_ZUSTAND.dateiLaeuft);
    async function cmd(zeile) {
      const input=p.locator('#profil-terminal-eingabe');
      await input.fill(zeile); await input.press('Enter');
      await p.waitForFunction(() => !TERMINAL_ZUSTAND.dateiLaeuft);
      return (await out.textContent()).split('\n' + (await p.locator('#profil-terminal-prompt').textContent()) + ' ').at(-1);
    }
    const eingabe = p.locator('#profil-terminal-eingabe');
    async function tab(vorher, nachher) {
      await eingabe.fill(vorher);
      await eingabe.press('Tab');
      await p.waitForFunction(wert => $('profil-terminal-eingabe').value === wert, nachher);
    }
    await tab('wg', 'wget ');
    await tab('cd pg', 'cd pgcl-eu3.arch07');
    await tab('cd "pg', 'cd "pgcl-eu3.arch07"');
    await eingabe.press('Enter');
    await p.waitForFunction(() => !TERMINAL_ZUSTAND.dateiLaeuft);
    assert.equal(await p.locator('#profil-terminal-prompt').textContent(), 'root@terminal:/pgcl-eu3.arch07#', await out.textContent());
    await tab('cd dos', 'cd dossiers/');
    await tab('cat dossiers/ein', 'cat "dossiers/eins zwei.txt"');
    const vorher = netz.length;
    await eingabe.fill('cat https://example.org');
    await eingabe.press('Tab');
    assert.equal(netz.length, vorher);
    await cmd('cd dossiers');
    assert.match(await cmd('pwd'), /\n\/pgcl-eu3\.arch07\/dossiers$/);
    assert.match(await cmd('ls -l'), /-r--\s+\d+.*eins zwei\.txt/);
    assert.doesNotMatch((await out.textContent()).split('ls -l\n').at(-1), /\.intern/);
    assert.match(await cmd('ls -la'), /\.intern/);
    assert.match(await cmd('head "eins zwei.txt"'), /\nZeile-1\n[\s\S]*\nZeile-10$/);
    assert.match(await cmd('tail "eins zwei.txt"'), /\nZeile-3\n[\s\S]*\nZeile-12$/);
    assert.match(await cmd('cat probe.bin'), /Keine UTF-8-Textdatei/);
    assert.match(await cmd('wget https://example.org'), /Permission denied/);
    const fehlend = await cmd('wget fehlt.bin');
    assert.match(fehlend, /Datei oder Ordner nicht gefunden/);
    assert.doesNotMatch(fehlend, /100%|200 OK/);
    const netzVorher = netz.length;
    const balken = p.locator('#profil-terminal-transfer');
    const liveAnzeige = balken.waitFor({state:'visible'});
    const [download, protokoll] = await Promise.all([p.waitForEvent('download'), cmd('wget probe.bin')]);
    await liveAnzeige;
    assert.match(protokoll, /https:\/\/relay-07\.pgcl-eu3\.inv\/pgcl-eu3\.arch07\/dossiers\/probe\.bin/);
    assert.match(protokoll, /200 OK/);
    assert.match(protokoll, /Länge: 3 \(3 B\)/);
    assert.match(protokoll, /100%/);
    assert.match(protokoll, /Empfangen \[3\/3\]/);
    assert.deepEqual(netz.slice(netzVorher), [address]);
    assert.equal(download.suggestedFilename(), 'probe.bin');
    assert.deepEqual(await readFile(await download.path()), Buffer.from([0,255,128]));
    await tab('wget pr', 'wget probe.bin');
    await cmd('cd ../../../..');
    assert.equal(await p.locator('#profil-terminal-prompt').textContent(), 'root@terminal:/pgcl-eu3.arch07#');
    await cmd('clear');
    assert.equal(await out.textContent(), '');
    assert.equal(await eingabe.getAttribute('placeholder'), null);
    await p.emulateMedia({reducedMotion:'reduce'});
    const prompt = p.locator('#profil-terminal-prompt');
    const wartePrompt = text => p.waitForFunction(t => $('profil-terminal-prompt').textContent === t, text);
    const oeffnen = async () => {
      await vorbereiten(p);
      await cmd('secure-channel --connect --onion --ephemeral');
      await wartePrompt('you >');
    };
    assert.match(await cmd('send probe.bin'), /im geöffneten Secure Channel/);
    await oeffnen();
    await tab('send /pg', 'send /pgcl-eu3.arch07/');
    await tab('send /pgcl-eu3.arch07/dos', 'send /pgcl-eu3.arch07/dossiers/');
    await tab('send /pgcl-eu3.arch07/dossiers/date', 'send "/pgcl-eu3.arch07/dossiers/datei mit Leerzeichen.pdf"');
    const vorSend = netz.length;
    await cmd('send /anderer-ordner/aussen.txt');
    await cmd('send /pgcl-eu3.arch07/../aussen.txt');
    assert.equal(netz.length, vorSend);
    assert.match(await out.textContent(), /Dateipfad innerhalb/);
    await cmd('send /pgcl-eu3.arch07/dossiers/fehlt.pdf');
    await wartePrompt('you >');
    assert.match(await out.textContent(), /send: Datei oder Ordner nicht gefunden/);
    const netzVorSend = netz.length;
    await p.emulateMedia({reducedMotion:'no-preference'});
    await cmd('send "/pgcl-eu3.arch07/dossiers/datei mit Leerzeichen.pdf"');
    await balken.waitFor({state:'visible'});
    assert.match(await balken.textContent(), /2 MiB.*ETA/);
    assert.equal(await prompt.textContent(), '…');
    await wartePrompt('you >');
    assert.match(await out.textContent(), /datei mit Leerzeichen\.pdf.*100%/);
    assert.match(await out.textContent(), /Kanalpuffer vollständig \[2097152\/2097152\]/);
    assert.deepEqual(netz.slice(netzVorSend), [address]);
    await cmd('send /pgcl-eu3.arch07/dossiers/probe.bin');
    await balken.waitFor({state:'visible'});
    await eingabe.press('Escape');
    assert.equal(await prompt.textContent(), 'root@terminal:/pgcl-eu3.arch07#');
    assert.equal(await balken.isVisible(), false);

    const getrennt = 'successfully disconnected from relay-07.pgcl-eu3.inv:443';
    await p.emulateMedia({reducedMotion:'reduce'});
    await p.locator('#btn-end').focus();
    await p.keyboard.press('x');
    await p.waitForFunction(() => Zugang.beendet());
    await new Promise((resolve, reject) => {
      if (cmdOutput.includes(getrennt)) { resolve(); return; }
      const onData = () => {
        if (!cmdOutput.includes(getrennt)) return;
        clearTimeout(timeout);
        helper.stdout.off('data', onData);
        resolve();
      };
      const timeout = setTimeout(() => {
        helper.stdout.off('data', onData);
        reject(new Error('Abmeldung nicht in CMD angekommen'));
      }, 5500);
      helper.stdout.on('data', onData);
    });
    assert.equal((await (await call('ls', [])).json()).error, 'Lokale Sitzung getrennt');
    let exitTimeout;
    try {
      const result = await Promise.race([
        helperExit,
        new Promise((_, reject) => { exitTimeout = setTimeout(() => reject(new Error('Dateibrücke beendet sich nicht')), 5500); })
      ]);
      assert.deepEqual(result, {code:0, signal:null});
    } finally { clearTimeout(exitTimeout); }
    await assert.rejects(() => call('ls', []));
    assert.deepEqual(errors, []);
    console.log('OK: lokale Brücke in Chromium, Dateibefehle und Binärdownload, Token, Pfade, Links und automatisches Beenden');
  } finally {
    if (b) await b.close();
    if (helper) helper.kill();
    await rm(sandbox, {recursive:true, force:true});
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
