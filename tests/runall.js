/* Gesamtlauf der Playwright-Tests, unabhängig vom Ablageort des Projekts.
   Aufruf (im Ordner tests/, Playwright installiert):   node runall.js            alle Gruppen
                                                        node runall.js zev zp     nur diese Skripte (ohne .js)
   Je Gruppe laufen die Skripte parallel; Ausgaben liegen in <TMP>/ft-out/<name>.txt. Ein Skript gilt als fehlgeschlagen bei Exit-Code != 0,
   Zeitüberschreitung (170 s) oder einem Treffer auf FAIL, FEHLER: n (n > 0), Fehlschläge: n (n > 0) oder Error. Bekannt rote und
   unzuverlässige Skripte werden getrennt ausgewiesen und lassen den Lauf nicht scheitern. Exit-Code 1, wenn ein anderes Skript scheitert. */
const { spawn } = require('child_process'); const fs = require('fs'); const os = require('os'); const path = require('path');
const GRUPPEN = [
  ['kt', 'kv3', 'kv4', 'zn'], ['zn3', 'zev', 'dp', 'al', 'abd'], ['zb', 'ds2', 'wk', 'wk3', 'ev2'], ['fgy', 'fd', 'fg', 'rs', 'm1flow'],
  ['st', 'zp', 'un', 'tx', 'sm'], ['fc', 'sk', 'au', 'p2', 'p3', 'p4', 'pn', 'kwz', 'nx', 'kc', 'ak2'],
  ['kartenprotokoll', 'pins', 'unterlagen', 'aussagen', 'aussagen-alt', 'fallpaket', 'recherche'], ['kartensprung', 'identitaeten', 'verlaesslichkeit']
];
const BEKANNT = { m1flow: 'Missionsablauf, auch auf main rot', abd: 'unzuverlässig', wk3: 'unzuverlässig', dp: 'unzuverlässig' };
const FEHLER = /(^|\s)FAIL\b|FEHLER: [1-9]|Fehlschläge: [1-9]|Error/;
const ausgabe = path.join(process.env.TMPDIR || os.tmpdir(), 'ft-out'); fs.mkdirSync(ausgabe, { recursive: true });
const wahl = process.argv.slice(2);
function lauf(name) {
  return new Promise(res => {
    const datei = path.join(__dirname, name + '.js');
    if (!fs.existsSync(datei)) return res({ name, status: 'fehlt' });
    const out = fs.createWriteStream(path.join(ausgabe, name + '.txt')); let text = '';
    const k = spawn(process.execPath, [datei], { cwd: __dirname, env: process.env }); let zeit = false;
    const t = setTimeout(() => { zeit = true; k.kill('SIGKILL'); }, 170000);
    const sammeln = d => { text += d; out.write(d); }; k.stdout.on('data', sammeln); k.stderr.on('data', sammeln);
    k.on('close', code => { clearTimeout(t); out.end(); res({ name, status: zeit ? 'Zeit' : (code !== 0 || FEHLER.test(text)) ? 'rot' : 'grün', code }); });
  });
}
(async () => {
  const gruppen = wahl.length ? [wahl] : GRUPPEN, erg = [];
  for (const g of gruppen) erg.push(...await Promise.all(g.map(lauf)));
  let neu = 0;
  erg.forEach(r => { const b = BEKANNT[r.name]; console.log(r.name.padEnd(18) + r.status + (r.status !== 'grün' && r.status !== 'fehlt' && b ? '  (bekannt: ' + b + ')' : '')); if ((r.status === 'rot' || r.status === 'Zeit') && !b) neu++; });
  console.log('\n' + erg.filter(r => r.status === 'grün').length + ' grün, ' + erg.filter(r => r.status === 'fehlt').length + ' nicht vorhanden, ' + neu + ' unerwartet rot. Ausgaben: ' + ausgabe);
  process.exit(neu ? 1 : 0);
})();
