/* Messsonde Phase 6a (nur lesend, nicht in runall.js registriert): führt eine feste Befehlsliste (pwd, cd, ls und Verwandtes) im Terminal
   aus und gibt je Befehl Ausgabe, Rückgabewert ($?) und folgenden Prompt als JSON aus. Dient der Gegenüberstellung mit echtem Unix/Linux
   (docs/phase6a-plan-pwd-cd-ls.md). Archivordner der Brücke: pgcl-eu3.arch07 mit dossiers/ (eins.txt, .intern), ops/ (leer), wurzel.txt.
   Aufruf: cd tests && PLAYWRIGHT_BROWSERS_PATH=... node _sonde-shell-6a.js [ausgabe.json] */
const { spawn } = require('node:child_process');
const { mkdtemp, copyFile, mkdir, writeFile, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');
const PF = require('./_pfad');

const BEFEHLE = [
  'pwd', 'pwd -P', 'pwd -L', 'pwd x', 'pwd --help',
  'ls', 'ls -a', 'ls -l', 'ls -la', 'ls -al', 'ls -1', 'ls -lh', 'ls -d', 'ls -z', 'ls --help',
  'ls /', 'ls /etc', 'ls /etc/ppp', 'ls /var/log', 'ls /etc /var', 'ls -l /etc', 'ls /nonexistent', 'ls etc', 'ls /etc/ppp/peers/kestrel',
  'ls pgcl-eu3.arch07', 'ls /pgcl-eu3.arch07/dossiers', 'ls /pgcl-eu3.arch07/dossiers/eins.txt', 'ls /pgcl-eu3.arch07/ops',
  'cd', 'pwd', 'cd /', 'cd ~', 'cd /etc', 'pwd', 'cd ..', 'cd ../..', 'cd /etc/ppp', 'cd -', 'pwd', 'cd .', 'cd /nonexistent', 'cd /etc/ppp/peers/kestrel',
  'cd /etc /var', 'cd ""', 'cd ~/etc', 'echo $HOME', 'echo $PWD', 'echo $OLDPWD', 'cd $HOME', 'cd /var/log/syslog',
  'cd /pgcl-eu3.arch07', 'pwd', 'ls', 'ls -l', 'cd dossiers', 'pwd', 'ls -a', 'ls -l', 'cd eins.txt', 'cd nichts', 'ls nichts', 'ls ..', 'cd ..', 'cd ../ops', 'ls', 'cd /',
  'cat /nonexistent', 'cat /etc', 'ls /var/cache/tle', 'cd /var/cache/tle', 'ls -l'
];
(async () => {
  const sandbox = await mkdtemp(join(tmpdir(), 'shadow-sonde-')), db = join(sandbox, 'pgcl-eu3.arch07');
  let helper, b;
  try {
    await mkdir(join(db, 'dossiers'), { recursive: true }); await mkdir(join(db, 'ops'), { recursive: true });
    await copyFile(join(PF.ROOT, 'terminal_lokal.py'), join(sandbox, 'terminal_lokal.py'));
    await writeFile(join(db, 'dossiers', 'eins.txt'), 'Zeile-1\nZeile-2'); await writeFile(join(db, 'dossiers', '.intern'), 'verborgen'); await writeFile(join(db, 'wurzel.txt'), 'w');
    helper = spawn(process.env.SHADOW_TEST_PYTHON || (process.platform === 'win32' ? 'python' : 'python3'), [join(sandbox, 'terminal_lokal.py'), '--serve-only']);
    const start = await new Promise((res, rej) => { helper.once('error', rej); helper.stdout.once('data', d => res(d.toString().trim())); });
    b = await chromium.launch();
    const p = await b.newPage({ reducedMotion: 'reduce' }); p.setDefaultTimeout(12000);
    await p.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());   /* Brücke auf 127.0.0.1 bleibt erreichbar */
    await p.goto(PF.APP + start);
    await p.fill('#gate-pw', 'pw-test-123'); if (await p.isVisible('#gate-pw2')) await p.fill('#gate-pw2', 'pw-test-123');
    await p.click('#gate-go'); await p.click('#profil-terminal-oeffnen');
    const inp = p.locator('#profil-terminal-eingabe'), out = p.locator('#profil-terminal-ausgabe'), prompt = p.locator('#profil-terminal-prompt');
    const zeilen = async () => (await out.textContent()).split('\n');
    const ergebnis = [];
    await inp.fill('echo bereit'); await inp.press('Enter'); await p.waitForTimeout(300);   /* Vorlauf: Start-Ausgaben abwarten */
    for (const z of BEFEHLE) {
      const vor = (await zeilen()).length;
      await inp.fill(z); await inp.press('Enter');
      await p.waitForFunction(() => !TERMINAL_ZUSTAND.dateiLaeuft); await p.waitForTimeout(120);
      const nach = await zeilen();
      await inp.fill('echo $?'); await inp.press('Enter'); await p.waitForTimeout(60);
      const st = (await zeilen()).at(-1);
      const neu = nach.slice(vor);   /* erste Zeile ist das Echo des Befehls mit Prompt */
      ergebnis.push({ befehl: z, ausgabe: neu.slice(1).join('\n'), status: st, promptDanach: (await prompt.textContent()).trim() });
    }
    const json = JSON.stringify(ergebnis, null, 1);
    if (process.argv[2]) fs.writeFileSync(process.argv[2], json); else console.log(json);
  } finally { if (b) await b.close(); if (helper) helper.kill(); await rm(sandbox, { recursive: true, force: true }).catch(() => {}); }
})().catch(e => { console.error(e); process.exit(1); });
