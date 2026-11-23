/* Messwerkzeug für die Inventur der Nicht-Standardskripte (nicht Teil der Standardauswahl, nicht registriert).
   Zweck: reproduzierbar feststellen, welche Skripte in tests/ nicht zur Standardauswahl von runall.js gehören, wie sie sich auf einem
   gegebenen Stand verhalten (Exit-Code, Dauer, erste Fehlermeldung) und ob sie bestimmte Funktionsaufrufe (Vorgabe: IZ() ) enthalten.
   Es ändert nichts am Repository und löscht oder deregistriert nichts.

   Aufruf (im Ordner tests des zu messenden Standes, Playwright installiert):
     node _inventur-nichtstandard.js liste [--enthaelt "IZ("]              Kandidaten (Name, historisch ja/nein, enthält) als JSON
     node _inventur-nichtstandard.js messen [--enthaelt "IZ("] [--nur a,b,c] [--zeit 170] [--out datei.json]
   Umgebung: FT_PARALLEL (Vorgabe 4), PLAYWRIGHT_BROWSERS_PATH wie bei runall.js.
   Ein Skript gilt als grün bei Exit-Code 0 und ohne Treffer der Fehlermuster von runall.js, als rot sonst, als Zeit bei Überschreitung. */
const fs = require('fs'), os = require('os'), path = require('path');
const { spawn } = require('child_process');

const DIR = __dirname;
const QUELLE = fs.readFileSync(path.join(DIR, 'runall.js'), 'utf8');
function liste(name) {
  const m = QUELLE.match(new RegExp('const ' + name + '\\s*=\\s*\\[([\\s\\S]*?)\\n?\\];'));
  if (!m) throw new Error(name + ' nicht in runall.js gefunden');
  return Array.from(m[1].replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/'([^']+)'/g), x => x[1]);
}
const STANDARD = new Set(liste('GRUPPEN'));
const HIST = new Set(liste('HISTORISCH'));
const FEHLER = /(^|\s)FAIL\b|FEHLER: [1-9]|Fehlschläge: [1-9]|Error/;   /* wie runall.js */

function kandidaten(enthaelt) {
  return fs.readdirSync(DIR).filter(f => f.endsWith('.js') && !f.startsWith('_') && f !== 'runall.js').map(f => f.slice(0, -3))
    .filter(n => !STANDARD.has(n)).sort()
    .map(n => { const t = fs.readFileSync(path.join(DIR, n + '.js'), 'utf8'); return { name: n, historisch: HIST.has(n), enthaelt: enthaelt ? t.includes(enthaelt) : null }; })
    .filter(k => !enthaelt || k.enthaelt);
}
function erstesProblem(text) {
  const z = text.split('\n'); let i = z.findIndex(l => /AssertionError|^\w*Error|TimeoutError|FAIL\b|FEHLER: [1-9]|Fehlschläge: [1-9]|Error:/.test(l));
  if (i < 0) return '';
  const block = z.slice(i, i + 3).join(' | ').replace(/\s+/g, ' ').slice(0, 300);
  const stelle = (text.match(/at (?:[^\n]*\()?([^\s()]*tests[\\/][^\s():]+:\d+):\d+/) || [])[1] || '';
  return block + (stelle ? ' @ ' + path.basename(stelle) : '');
}
function lauf(name, zeitS, tmp) {
  return new Promise(res => {
    const datei = path.join(DIR, name + '.js'), start = Date.now(); let text = '', zeit = false;
    const k = spawn(process.execPath, [datei], { cwd: tmp, env: process.env });
    const t = setTimeout(() => { zeit = true; k.kill('SIGKILL'); }, zeitS * 1000);
    k.stdout.on('data', d => text += d); k.stderr.on('data', d => text += d);
    k.on('close', code => {
      clearTimeout(t);
      const status = zeit ? 'Zeit' : (code !== 0 || FEHLER.test(text)) ? 'rot' : !text.trim() ? 'ungeprüft' : 'grün';
      res({ name, status, code, sekunden: Math.round((Date.now() - start) / 100) / 10, problem: status === 'grün' ? '' : erstesProblem(text), ausgabeEnde: text.trim().split('\n').slice(-2).join(' | ').slice(0, 200) });
    });
  });
}
(async () => {
  const [, , modus, ...a] = process.argv, opt = {};
  for (let i = 0; i < a.length; i += 2) opt[a[i].replace(/^--/, '')] = a[i + 1];
  let ks = kandidaten(opt.enthaelt);
  if (opt.nur) { const n = new Set(opt.nur.split(',')); ks = ks.filter(k => n.has(k.name)); }
  if (modus === 'liste') { console.log(JSON.stringify({ stand: process.env.INV_STAND || null, anzahl: ks.length, historisch: ks.filter(k => k.historisch).length, kandidaten: ks }, null, 1)); return; }
  if (modus !== 'messen') { console.error('Aufruf: liste | messen'); process.exit(2); }
  const par = Math.max(1, Number(process.env.FT_PARALLEL) || 4), zeitS = Number(opt.zeit) || 170;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'inventur-')), erg = new Array(ks.length); let n = 0;
  await Promise.all(Array.from({ length: Math.min(par, ks.length) }, async () => { while (n < ks.length) { const i = n++; erg[i] = Object.assign({ historisch: ks[i].historisch }, await lauf(ks[i].name, zeitS, tmp)); } }));
  const out = { stand: process.env.INV_STAND || null, gemessen: new Date().toISOString(), parallel: par, zeitgrenzeS: zeitS, ergebnisse: erg };
  if (opt.out) fs.writeFileSync(opt.out, JSON.stringify(out, null, 1)); else console.log(JSON.stringify(out, null, 1));
  const z = s => erg.filter(r => r.status === s).length;
  console.error('grün ' + z('grün') + ', rot ' + z('rot') + ', Zeit ' + z('Zeit') + ', ungeprüft ' + z('ungeprüft') + ' von ' + erg.length);
})();
