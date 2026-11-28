'use strict';
/* Entwicklungs-/Paketierungsschritt. Kein npm oder CDN zur Laufzeit des Prototyps. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ROOT = path.resolve(__dirname, '..');
const VERSION = '4.7.1';
const DATEIEN = ['maplibre-gl.js', 'maplibre-gl.css', 'LICENSE.txt'];
function bereitstellen(quelle = path.join(ROOT, 'tests', 'node_modules', 'maplibre-gl'), ziel = path.join(ROOT, 'vendor', 'maplibre-gl')) {
  const pkg = JSON.parse(fs.readFileSync(path.join(quelle, 'package.json'), 'utf8'));
  if (pkg.name !== 'maplibre-gl' || pkg.version !== VERSION) throw new Error('MapLibre-Paket muss exakt ' + VERSION + ' sein.');
  const daten = DATEIEN.map(n => [n, fs.readFileSync(path.join(quelle, 'dist', n))]);
  if (daten.some(x => !x[1].length)) throw new Error('MapLibre-Distributionsdatei ist leer.');
  const manifest = { name: pkg.name, version: pkg.version, dateien: Object.fromEntries(daten.map(([n,b]) => [n, crypto.createHash('sha256').update(b).digest('hex')])) };
  const manifestBytes = Buffer.from(JSON.stringify(manifest, null, 2) + '\n');
  /* Vorhandene abweichende Dateien nicht stillschweigend überschreiben. */
  const alle = daten.concat([['manifest.json',manifestBytes]]);
  for (const [n,b] of alle) {
    const p = path.join(ziel,n);
    if (fs.existsSync(p) && !fs.readFileSync(p).equals(b)) throw new Error('Abweichende lokale MapLibre-Datei: ' + n);
  }
  fs.mkdirSync(ziel,{recursive:true});
  for (const [n,b] of alle) if (!fs.existsSync(path.join(ziel,n))) fs.writeFileSync(path.join(ziel,n),b,{flag:'wx'});
  return manifest;
}
module.exports = { bereitstellen, VERSION, DATEIEN };
if (require.main === module) {
  try { const m = bereitstellen(); console.log('OK: MapLibre ' + m.version + ' lokal bereitgestellt (inkl. Lizenz und SHA-256-Manifest).'); }
  catch (e) { console.error('MapLibre-Bereitstellung fehlgeschlagen: ' + e.message); process.exitCode = 1; }
}
