/* Statische Ergänzung zur Inventur der Nicht-Standardskripte (nicht registriert, ändert nichts).
   Je Skript wird ermittelt, welche Namen es innerhalb von page.evaluate/waitForFunction-Funktionen verwendet, die auf dem geprüften Stand
   in der Anwendung nicht mehr (oder nicht) vorhanden sind: globale Funktionen und Variablen (typeof === 'undefined') sowie
   dispatch-Aktionstypen ohne Eintrag in ACTIONS. Das erklärt, woran ein Skript scheitert, ohne dass es ausgeführt werden muss.

   Aufruf (im Ordner tests, Playwright und acorn/acorn-walk auffindbar, z. B. NODE_PATH auf einen Ordner mit installierten Paketen):
     node _inventur-statik.js [--enthaelt "IZ("] [--out datei.json]
   Grenzen: Die Analyse ist heuristisch (Namen innerhalb der Rückruffunktionen, die dort nicht deklariert sind). Zeichenketten-Zugriffe,
   Selektoren und Seitenstruktur werden nicht geprüft. Namen, die ein Skript über Argumente der evaluate-Aufrufe erhält, sind Parameter und zählen nicht. */
const fs = require('fs'), path = require('path');
const acorn = require('acorn'), walk = require('acorn-walk');
const { chromium } = require('playwright');
const { APP } = require('./_pfad');

const DIR = __dirname;
const argv = process.argv.slice(2), opt = {};
for (let i = 0; i < argv.length; i += 2) opt[argv[i].replace(/^--/, '')] = argv[i + 1];

function analyse(code) {
  const ast = acorn.parse(code, { ecmaVersion: 'latest', allowAwaitOutsideFunction: true, allowReturnOutsideFunction: true, allowHashBang: true });
  const frei = new Set(), aktionen = new Set();
  walk.full(ast, node => {
    if (node.type !== 'CallExpression' || node.callee.type !== 'MemberExpression' || node.callee.computed) return;
    if (!['evaluate', 'waitForFunction', 'addInitScript', 'evaluateHandle'].includes(node.callee.property.name)) return;
    const fn = node.arguments.find(a => a.type === 'FunctionExpression' || a.type === 'ArrowFunctionExpression');
    if (!fn) return;
    const deklariert = new Set(), refs = [];
    const muster = p => { if (!p) return; if (p.type === 'Identifier') deklariert.add(p.name); else if (p.type === 'ObjectPattern') p.properties.forEach(x => muster(x.value || x.argument)); else if (p.type === 'ArrayPattern') p.elements.forEach(muster); else if (p.type === 'AssignmentPattern') muster(p.left); else if (p.type === 'RestElement') muster(p.argument); };
    fn.params.forEach(muster);
    walk.ancestor(fn, {
      VariableDeclarator(n) { muster(n.id); },
      FunctionDeclaration(n) { if (n.id) deklariert.add(n.id.name); n.params.forEach(muster); },
      FunctionExpression(n) { if (n.id) deklariert.add(n.id.name); n.params.forEach(muster); },
      ArrowFunctionExpression(n) { n.params.forEach(muster); },
      CatchClause(n) { muster(n.param); },
      Identifier(n, st, anc) {
        const p = anc[anc.length - 2];
        if (p && p.type === 'MemberExpression' && p.property === n && !p.computed) return;
        if (p && p.type === 'Property' && p.key === n && !p.computed && !p.shorthand) return;
        if (p && (p.type === 'LabeledStatement' || p.type === 'BreakStatement' || p.type === 'ContinueStatement')) return;
        refs.push(n.name);
      },
      CallExpression(n) {
        if (n.callee.type === 'Identifier' && n.callee.name === 'dispatch' && n.arguments[0] && n.arguments[0].type === 'ObjectExpression') {
          const t = n.arguments[0].properties.find(x => x.key && (x.key.name === 'type' || x.key.value === 'type'));
          if (t && t.value.type === 'Literal') aktionen.add(t.value.value);
        }
      }
    });
    refs.forEach(r => { if (!deklariert.has(r)) frei.add(r); });
  });
  return { namen: [...frei].sort(), aktionen: [...aktionen].sort() };
}

(async () => {
  const quelle = fs.readFileSync(path.join(DIR, 'runall.js'), 'utf8');
  const g = quelle.match(/const GRUPPEN\s*=\s*\[([\s\S]*?)\n\];/)[1].replace(/\/\*[\s\S]*?\*\//g, '');
  const standard = new Set(Array.from(g.matchAll(/'([^']+)'/g), m => m[1]));
  const hist = new Set(Array.from(quelle.match(/const HISTORISCH\s*=\s*\[([\s\S]*?)\];/)[1].replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/'([^']+)'/g), m => m[1]));
  const namen = fs.readdirSync(DIR).filter(f => f.endsWith('.js') && !f.startsWith('_') && f !== 'runall.js').map(f => f.slice(0, -3)).filter(n => !standard.has(n)).sort()
    .filter(n => !opt.enthaelt || fs.readFileSync(path.join(DIR, n + '.js'), 'utf8').includes(opt.enthaelt));
  const browser = await chromium.launch(), p = await browser.newPage();
  await p.route(/^https?:/, r => r.abort());
  await p.goto(APP);
  await p.fill('#gate-pw', 'pw-test-123'); if (await p.isVisible('#gate-pw2')) await p.fill('#gate-pw2', 'pw-test-123'); await p.click('#gate-go');
  await p.waitForFunction(() => !document.body.classList.contains('locked'));
  const erg = [];
  for (const n of namen) {
    let a; try { a = analyse(fs.readFileSync(path.join(DIR, n + '.js'), 'utf8')); } catch (e) { erg.push({ name: n, historisch: hist.has(n), fehler: 'Analyse: ' + e.message }); continue; }
    const fehlt = await p.evaluate(({ namen, aktionen }) => ({
      namen: namen.filter(x => { try { return typeof eval(x) === 'undefined'; } catch (e) { return true; } }),
      aktionen: aktionen.filter(x => typeof ACTIONS[x] !== 'function')
    }), a);
    erg.push({ name: n, historisch: hist.has(n), fehlendeNamen: fehlt.namen, fehlendeAktionen: fehlt.aktionen });
  }
  await browser.close();
  const out = { stand: process.env.INV_STAND || null, anzahl: erg.length, ergebnisse: erg };
  if (opt.out) fs.writeFileSync(opt.out, JSON.stringify(out, null, 1)); else console.log(JSON.stringify(out, null, 1));
})().catch(e => { console.error(e); process.exit(1); });
