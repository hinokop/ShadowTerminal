/* Gemeinsame Pfade der Karten- und 3D-Tests: unabhängig vom Ablageort des Projekts.
   MAPLIBRE_DIR (optional): Ordner mit maplibre-gl.js/.css, sonst npm-Paket maplibre-gl (npm i maplibre-gl@4.7.1 im tests-Ordner). */
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
let ml = process.env.MAPLIBRE_DIR || '';
if (!ml) { try { ml = path.dirname(require.resolve('maplibre-gl/dist/maplibre-gl.js')); } catch (e) { ml = ''; } }
module.exports = { ROOT, APP: 'file://' + path.join(ROOT, 'index.html'), KARTE3D: 'file://' + path.join(ROOT, 'karte3d.html'), MAPLIBRE: ml ? ml + path.sep : '' };
