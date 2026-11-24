/* Python-Unittests der Sicherungs-API der lokalen Brücke (tests/terminal_home_op_test.py) im Standardlauf. */
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const r = spawnSync('python3', ['-I', path.join(__dirname, 'terminal_home_op_test.py')], { encoding: 'utf8' });
process.stdout.write(r.stdout || ''); process.stderr.write(r.stderr || '');
if (r.status !== 0) { console.error('FEHLER: terminal-home-bruecke'); process.exit(1); }
console.log('OK: terminal-home-bruecke (Python-Unittests der Sicherungs-API)');
