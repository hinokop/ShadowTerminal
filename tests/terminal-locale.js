/* Kollation en_US.UTF-8 (terminal-locale.js) gegen Aufzeichnungen von glibc 2.39 strcoll und GNU ls 9.4 (Ubuntu 24.04).
   Reines Node-Skript ohne Browser. Aufruf: node tests/terminal-locale.js */
const fs = require('fs'), vm = require('vm'), path = require('path');
const wurzel = path.join(__dirname, '..');
const ctx = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(wurzel, 'terminal-locale.js'), 'utf8') + '\nthis.L = TERMINAL_LOCALE;', ctx);
const L = ctx.L, gold = JSON.parse(fs.readFileSync(path.join(__dirname, '_golden-locale-en_US.json'), 'utf8'));
let fail = 0;
const pruefe = function (name, ok, info) { if (!ok) { fail++; console.log('FAIL ' + name + (info ? ' ' + info : '')); } };
pruefe('name', L.name === 'en_US.UTF-8');
let abw = 0;
for (const [a, b, r] of gold.paare) { if (L.vergleich(a, b) !== r) { abw++; if (abw < 6) console.log('  Abweichung', JSON.stringify([a, b, r, L.vergleich(a, b)])); } }
pruefe('paare gegen strcoll (' + gold.paare.length + ')', abw === 0, 'abweichend ' + abw);
/* Paare, die nur durch Ebene 3 (Groß-/Kleinschreibung bei sonst gleichen Ebenen 1, 2 und 4) entschieden werden: ohne Ebene 3 fielen sie anders aus */
let abw3 = 0;
for (const [a, b, r] of gold.ebene3) if (L.vergleich(a, b) !== r) abw3++;
pruefe('Paare der Ebene 3 (' + gold.ebene3.length + ')', abw3 === 0, 'abweichend ' + abw3);
const sortiert = gold.baum.slice().sort(function (a, b) { return L.vergleich(a, b); });
const gemischt = gold.baum.slice().reverse().sort(function (a, b) { return L.vergleich(a, b); });
pruefe('baum gegen ls -1A', JSON.stringify(sortiert) === JSON.stringify(gold.baum), JSON.stringify(sortiert));
pruefe('baum unabhaengig von Eingabereihenfolge', JSON.stringify(gemischt) === JSON.stringify(gold.baum));
/* Gezielte Fälle aus der Messung */
const f = function (a, b) { return Math.sign(L.vergleich(a, b)); };
pruefe('Ziffern: 10.txt vor 1.txt (Punkt ignoriert)', f('10.txt', '1.txt') === -1);
pruefe('klein vor gross: alpha < Alpha < ALPHA', f('alpha.txt', 'Alpha.txt') === -1 && f('Alpha.txt', 'ALPHA.txt') === -1);
pruefe('Umlaut: Apfel zwischen apfel und Ärger', f('apfel.txt', 'Äpfel.txt') === -1 && f('Äpfel.txt', 'Ärger.txt') === -1);
pruefe('Punktdatei sortiert nach Buchstaben: .alpha nach ae.txt', f('ae.txt', '.alpha') === -1 && f('.alpha', 'alpha.txt') === -1);
pruefe('Antisymmetrie', f('a b.txt', 'a-b.txt') === -f('a-b.txt', 'a b.txt'));
pruefe('Gleichheit', L.vergleich('x', 'x') === 0);
/* Zeichen ausserhalb des Repertoires: hinter dem Repertoire, nach Codepunkt, deterministisch */
pruefe('Fallback hinter Repertoire', f('z', '中') === -1 && f('中', '丮') === -1 && f('ÿ', '中') === -1);
pruefe('Fallback Surrogatpaar', f('\u{1F600}', '\u{1F601}') === -1 && f('a', '\u{1F600}') === -1);
console.log(fail ? 'Fehlschläge: ' + fail : 'terminal-locale: alle Prüfungen bestanden');
process.exit(fail ? 1 : 0);
