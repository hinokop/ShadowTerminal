/* Phase 6a-0: Verhaltensgleichheit von pwd, cd und ls. Führt die Messsonde (_sonde-shell-6a.js, 75 Befehle gegen die echte lokale
   Brücke mit Beispielarchiv) aus und vergleicht Ausgabe, Rückgabewert ($?) und Prompt Befehl für Befehl mit der Aufnahme VOR der
   Umstellung (_golden-shell-6a0.json; Zeitstempel normalisiert). Absichtliche Verhaltensänderungen späterer Etappen (6a-1 ff.)
   müssen die Aufnahme bewusst anpassen. */
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'shadow-vgl-')), 'sonde.json');
try {
  execFileSync(process.execPath, [path.join(__dirname, '_sonde-shell-6a.js'), tmp], { stdio: 'inherit', timeout: 240000 });
  const norm = e => Object.assign({}, e, { ausgabe: e.ausgabe.replace(/\d\d\.\d\d\.\d{4} \d\d:\d\d:\d\dZ/g, '<ZEIT>') });
  const ist = JSON.parse(fs.readFileSync(tmp, 'utf8')).map(norm);
  const soll = JSON.parse(fs.readFileSync(path.join(__dirname, '_golden-shell-6a0.json'), 'utf8'));
  assert.equal(ist.length, soll.length, 'Anzahl der Befehle');
  ist.forEach((e, i) => assert.deepEqual(e, soll[i], 'Befehl ' + i + ': ' + soll[i].befehl));
  console.log('OK: pwd/cd/ls unverändert gegenüber der Aufnahme (' + ist.length + ' Befehle)');
} finally { fs.rmSync(path.dirname(tmp), { recursive: true, force: true }); }
