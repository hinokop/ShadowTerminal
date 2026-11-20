/* nmap über die lokale Brücke: das installierte nmap (hier ein Ersatzskript im PATH der Brücke) erhält die Argumente
   unverändert und ohne Shell; Ausgabe laufend, stdout und stderr in Nmaps Reihenfolge; $? ist Nmaps Rückgabewert;
   Strg+C beendet den Prozess (130); ohne nmap "command not found" (127); ohne Brücke die Brückenmeldung;
   Trennen der Sitzung beendet laufende Scans. */
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { spawn, execFileSync } = require('node:child_process');
const { mkdtemp, copyFile, mkdir, writeFile, readFile, rename, chmod, rm, symlink } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join, delimiter } = require('node:path');
const { chromium } = require('playwright');
const PF = require('./_pfad');

const ERSATZ = `#!/usr/bin/env python3
import json, os, sys, time
args = sys.argv[1:]
with open(os.environ["FAKE_NMAP_LOG"], "a") as f:
    f.write(json.dumps({"args": args, "pid": os.getpid()}) + "\\n")
print("Starting Nmap 7.95 ( https://nmap.org ) at 2026-11-19 22:00 UTC", flush=True)
if "lang.invalid" in args:
    print("Initiating Ping Scan", flush=True)
    time.sleep(1.5)
    print("Nmap done: 1 IP address (1 host up) scanned in 1.50 seconds", flush=True)
elif "fehler.invalid" in args:
    print("Zeile 1 stdout", flush=True)
    print('Failed to resolve "fehler.invalid".', file=sys.stderr, flush=True)
    print("Zeile 3 stdout", flush=True)
    sys.stdout.write("ohne Zeilenende")
    sys.stdout.flush()
    sys.exit(3)
elif "haengt.invalid" in args:
    print("Initiating Connect Scan", flush=True)
    time.sleep(120)
else:
    print("ARGS " + json.dumps(args, ensure_ascii=False, separators=(",", ":")), flush=True)
`;

function lebt(pid) { try { process.kill(pid, 0); return true; } catch (e) { return false; } }

(async () => {
  if (process.platform === 'win32') { console.log('übersprungen: Ersatz-nmap ist ein POSIX-Skript'); return; }
  const sandbox = await mkdtemp(join(tmpdir(), 'shadow-nmap-'));
  const bin = join(sandbox, 'bin'), log = join(sandbox, 'nmap.log');
  let helper, b;
  try {
    await mkdir(join(sandbox, 'pgcl-eu3.arch07'), { recursive: true });
    await mkdir(bin);
    await copyFile(join(PF.ROOT, 'terminal_lokal.py'), join(sandbox, 'terminal_lokal.py'));
    await writeFile(join(bin, 'nmap'), ERSATZ); await chmod(join(bin, 'nmap'), 0o755);
    await writeFile(log, '');
    // PATH der Brücke: nur das Ersatz-nmap und python3, damit ein auf dem Rechner installiertes nmap nicht mitspielt.
    const python = execFileSync('python3', ['-c', 'import sys; print(sys.executable)']).toString().trim(), py = join(sandbox, 'py');
    await mkdir(py); await symlink(python, join(py, 'python3'));
    helper = spawn(process.env.SHADOW_TEST_PYTHON || python, [join(sandbox, 'terminal_lokal.py'), '--serve-only'],
      { env: { ...process.env, PATH: bin + delimiter + py, FAKE_NMAP_LOG: log } });
    const start = await new Promise((resolve, reject) => {
      helper.once('error', reject); helper.once('exit', code => reject(new Error('Helper exit ' + code)));
      helper.stdout.once('data', d => resolve(d.toString().trim()));
    });
    const [, port, token] = /^#db=(\d+)\.([\w-]+)$/.exec(start);
    const call = body => fetch('http://127.0.0.1:' + port + '/db', {
      method: 'POST', headers: { 'Origin': 'null', 'Content-Type': 'application/json', 'X-Shadow-Token': token }, body: JSON.stringify(body)
    }).then(r => r.json());
    const aufrufe = async () => (await readFile(log, 'utf8')).trim().split('\n').filter(Boolean).map(JSON.parse);

    /* Brücke: ungültige Argumente werden abgewiesen, unbekannte Scans gemeldet */
    assert.deepEqual(await call({ op: 'nmap-start', args: 'nmap -sV' }), { error: 'Permission denied' });
    assert.deepEqual(await call({ op: 'nmap-start', args: [1] }), { error: 'Permission denied' });
    assert.deepEqual(await call({ op: 'nmap-read', job: 'unbekannt', from: 0 }), { error: 'nmap: no such scan' });

    b = await chromium.launch();
    const p = await b.newPage();
    const errors = [];
    p.on('pageerror', e => errors.push(e.message));
    await p.route(/^https?:\/\//, r => r.request().url().startsWith('http://127.0.0.1:' + port + '/') ? r.continue() : r.abort());
    await p.goto(PF.APP + start);
    const passwort = randomBytes(16).toString('hex');
    await p.locator('#gate-pw').fill(passwort);
    if (await p.locator('#gate-pw2').isVisible()) await p.locator('#gate-pw2').fill(passwort);
    await p.click('#gate-go');
    await p.locator('#profil-terminal-oeffnen').click();
    await p.waitForFunction(() => !TERMINAL_ZUSTAND.dateiLaeuft);
    const out = p.locator('#profil-terminal-ausgabe'), prompt = p.locator('#profil-terminal-prompt'), eingabe = p.locator('#profil-terminal-eingabe');
    const fertig = () => p.waitForFunction(() => !TERMINAL_ZUSTAND.kette, null, { timeout: 15000 });
    async function cmd(zeile) { await eingabe.fill(zeile); await eingabe.press('Enter'); await fertig(); return out.textContent(); }

    /* Argumente unverändert, ohne Shell: Leerzeichen, Anführungszeichen, Semikolon, Umlaut, $(...) */
    const text = await cmd(`nmap -sV -p 22,80 --script-args 'a=b; c' "x y" ä '$(id)' && echo weiter`);
    const erwartet = ['-sV', '-p', '22,80', '--script-args', 'a=b; c', 'x y', 'ä', '$(id)'];
    assert.deepEqual((await aufrufe()).at(-1).args, erwartet);
    assert.match(text, new RegExp('Starting Nmap 7\\.95 \\( https://nmap\\.org \\) at 2026-11-19 22:00 UTC\\nARGS ' +
      JSON.stringify(erwartet).replace(/[[\]()$.*+?^{}|\\]/g, '\\$&') + '\\nweiter$'));
    assert.match(await cmd('echo $?'), /\n0$/);

    /* Laufende Ausgabe: die erste Zeile steht da, bevor Nmap fertig ist; währenddessen kein Prompt */
    await eingabe.fill('nmap lang.invalid'); await eingabe.press('Enter');
    await p.waitForFunction(() => /Initiating Ping Scan$/.test($('profil-terminal-ausgabe').textContent), null, { timeout: 5000 });
    assert.doesNotMatch(await out.textContent(), /Nmap done/);
    assert.equal(await prompt.textContent(), '');
    await fertig();
    assert.match(await out.textContent(), /Initiating Ping Scan\nNmap done: 1 IP address \(1 host up\) scanned in 1\.50 seconds$/);

    /* stdout und stderr in Nmaps Reihenfolge; letzte Zeile ohne Zeilenende; Rückgabewert 3 an $?, && bricht ab */
    await cmd('nmap fehler.invalid && echo nie');
    assert.match(await out.textContent(), /Zeile 1 stdout\nFailed to resolve "fehler\.invalid"\.\nZeile 3 stdout\nohne Zeilenende$/);
    assert.match(await cmd('echo $?'), /\n3$/);

    /* Strg+C: ^C, $? 130, der Prozess ist beendet */
    await eingabe.fill('nmap haengt.invalid'); await eingabe.press('Enter');
    await p.waitForFunction(() => /Initiating Connect Scan$/.test($('profil-terminal-ausgabe').textContent), null, { timeout: 5000 });
    const pid = (await aufrufe()).at(-1).pid;
    assert.equal(lebt(pid), true, 'nmap läuft vor Strg+C');
    await eingabe.press('Control+c');
    await fertig();
    assert.match(await out.textContent(), /Initiating Connect Scan\n\^C$/);
    assert.match(await cmd('echo $?'), /\n130$/);
    for (let i = 0; i < 50 && lebt(pid); i++) await new Promise(r => setTimeout(r, 100));
    assert.equal(lebt(pid), false, 'nmap läuft nach Strg+C nicht weiter');

    /* Ohne installiertes nmap: command not found, 127 */
    await rename(join(bin, 'nmap'), join(bin, 'nmap-weg'));
    assert.match(await cmd('nmap -h'), /\nnmap: command not found$/);
    assert.match(await cmd('echo $?'), /\n127$/);
    await rename(join(bin, 'nmap-weg'), join(bin, 'nmap'));

    /* Trennen der Sitzung beendet einen laufenden Scan in der Brücke */
    const vorher = (await aufrufe()).length;
    const job = await call({ op: 'nmap-start', args: ['haengt.invalid'] });
    assert.match(job.job, /^[0-9a-f]{16}$/);
    for (let i = 0; i < 50 && (await aufrufe()).length === vorher; i++) await new Promise(r => setTimeout(r, 100));
    const pid2 = (await aufrufe()).at(-1).pid;
    assert.equal(lebt(pid2), true, 'zweiter Scan läuft vor disconnect');
    assert.deepEqual(await call({ op: 'disconnect' }), { ok: true });
    for (let i = 0; i < 50 && lebt(pid2); i++) await new Promise(r => setTimeout(r, 100));
    assert.equal(lebt(pid2), false, 'disconnect beendet laufende Scans');

    /* Ohne Brücke (Seite ohne #db): die Brückenmeldung, kein Aufruf */
    const q = await b.newPage();
    q.on('pageerror', e => errors.push(e.message));
    await q.route(/^https?:\/\//, r => r.abort());
    await q.goto(PF.APP);
    await q.locator('#gate-pw').fill(passwort);
    if (await q.locator('#gate-pw2').isVisible()) await q.locator('#gate-pw2').fill(passwort);
    await q.click('#gate-go');
    await q.locator('#profil-terminal-oeffnen').click();
    const anzahl = (await aufrufe()).length;
    await q.locator('#profil-terminal-eingabe').fill('nmap 127.0.0.1'); await q.locator('#profil-terminal-eingabe').press('Enter');
    await q.waitForFunction(() => !TERMINAL_ZUSTAND.kette);
    assert.match(await q.locator('#profil-terminal-ausgabe').textContent(), /Lokale Datenbank nicht verbunden\. Starte START_TERMINAL\.bat\.$/);
    assert.equal((await aufrufe()).length, anzahl);
    assert.deepEqual(errors, []);
    console.log('OK: nmap über die lokale Brücke (Argumente, laufende Ausgabe, $?, Strg+C, fehlendes nmap, Trennen)');
  } finally {
    if (b) await b.close();
    if (helper) helper.kill();
    await rm(sandbox, { recursive: true, force: true });
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
