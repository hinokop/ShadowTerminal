'use strict';
/* K1a: gleicher Klickvertrag für SVG und MapLibre, ohne Netzwerk/Browser.
   Echte Produktionsfunktionen werden aus karte-modul.js geladen; keine Kopie der Entscheidungslogik. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const src = fs.readFileSync(path.join(__dirname, '..', 'karte-modul.js'), 'utf8').replace(/\r\n/g, '\n');
function ausschnitt(von, bis) {
  const a = src.indexOf(von), b = src.indexOf(bis, a + von.length);
  assert.ok(a >= 0 && b > a, 'Produktionsfunktion gefunden: ' + von);
  return src.slice(a, b);
}
const fabrik = new Function('VIEW', 'dispatch', 'renderModule', 'entitaet', 'sichtungsPinName', 'xPinSetzen',
  'karteZoneFinden', 'karteWaehlen', 'karteMarker', 'karteAuswahlAnzeige', '$', 'karte3dSenden',
  'karteProj', 'requestAnimationFrame', 'KW', 'KH', 'svg', 'karteRendererDatenAktualisieren', 'KARTE_3D_ADAPTER',
  ausschnitt('function karteRenderSchluessel(', 'function karteRenderModell(') +
  ausschnitt('function karteKlickVerarbeiten(', '/* =====================================================================\n   KARTENPROTOKOLL:') +
  ausschnitt('function karte3dKlick(', 'let KARTE_ST = null;') +
  ausschnitt('function karte3dEingang(', '/* Gemeinsame Klicksemantik') +
  '\nconst KARTE_ST = karteSteuerung(svg); return { st: KARTE_ST, klick3d: karte3dKlick, eingang: karte3dEingang };');
function umgebung(patch) {
  const K = Object.assign({ messPts: [], auswahl: null }, patch);
  const VIEW = { karte: K, draft: {} }, aktionen = [], nachrichten = [];
  const listeners = {}, svg = { addEventListener(name, fn) { (listeners[name] ||= []).push(fn); }, getBoundingClientRect() { return { left: 20, top: 30, width: 960, height: 540 }; } };
  const marker = [{ id: 'PIN-001', ll: [51, 11] }];
  const a = fabrik(VIEW, a => aktionen.push(a), () => {}, id => ({ id }), () => 'Entwurf',
    (id, ll) => aktionen.push({ type: 'FALL_PIN', id, ll }),
    id => id === 'ZO-001' ? { id, profil: true } : /^ZN-[12]$/.test(id) ? { id, profil: false } : null,
    id => { K.auswahl = id; }, () => marker, () => {}, () => svg,
    msg => nachrichten.push(msg), () => ({ lat: y => 50 + y / 1000, lon: x => 10 + x / 1000 }),
    () => {}, 960, 540, svg, () => {}, {setSelection: msg => nachrichten.push(msg)});
  return { K, VIEW, aktionen, nachrichten, listeners, ...a };
}
const ll = [50.2, 10.1];
function klick(e, renderer, hit, mehr) {
  if (renderer === '3d') {
    e.klick3d({ lat: ll[0], lon: ll[1], id: hit === 'marker' ? 'PIN-001' : null,
      zid: hit === 'zone' ? 'ZO-001' : null, umschalt: mehr });
  } else {
    const typ = { marker: '.k-marker', zone: '.k-zone', kante: '.k-verbg' }[hit];
    const id = { marker: 'PIN-001', zone: 'ZO-001', kante: 'V-001' }[hit];
    e.st.klick({ clientX: 120, clientY: 230, shiftKey: mehr,
      target: { closest(q) { return q === typ ? { getAttribute(attr) { return attr === 'data-render-key' ? null : id; } } : null; } } });
  }
}
for (const renderer of ['svg', '3d']) {
  for (const [patch, expected] of [
    [{ pick: 'P-0001', pinSetzen: true }, { type: 'DOSSIER_ORT', id: 'P-0001', ll }],
    [{ pick: 'AO-001' }, { type: 'AUSGANG_ORT', id: 'AO-001', ll }],
    [{ pick: 'ZP-001' }, { type: 'ZUGRIFF_ORT', id: 'ZP-001', ll }],
    [{ zugriffSetzen: true }, { type: 'ZONE_ANGELEGT', art: 'zugriff', ll }],
    [{ pick: 'SI:P-0001' }, { type: 'PIN_ANGELEGT', ll, name: 'Entwurf', dossier: 'P-0001', notiz: '' }],
    [{ pick: 'X:X-001' }, { type: 'FALL_PIN', id: 'X-001', ll }],
    [{ pinSetzen: true }, { type: 'PIN_ANGELEGT', ll }],
    [{ zoneSetzen: 'eigen' }, { type: 'OZONE_ANGELEGT', ll }]
  ]) {
    const e = umgebung(patch); klick(e, renderer, 'marker');
    assert.deepEqual(e.aktionen, [expected], renderer + ' ' + expected.type);
    if (patch.pick) assert.equal(e.K.pick, null);
    if (patch.pinSetzen && !patch.pick) assert.equal(e.K.pinSetzen, false);
    if (patch.zoneSetzen) assert.equal(e.K.zoneSetzen, false);
    if (patch.zugriffSetzen) assert.equal(e.K.zugriffSetzen, true);
  }
  let e = umgebung({ pick: 'CI-AUS' }); klick(e, renderer);
  assert.equal(e.VIEW.draft['aw-koord'], '50.20000, 10.10000');
  assert.deepEqual(e.aktionen, [{ type: 'NAVIGATION', modul: 'profil' }]);
  e = umgebung({ messen: true }); klick(e, renderer, 'marker'); klick(e, renderer);
  assert.deepEqual(e.K.messPts, [[51, 11], ll], 'Messung rastet an realer Markerposition ein');
  assert.equal(e.K.messen, false);
  assert.deepEqual(e.aktionen, []);
  e = umgebung(); klick(e, renderer, 'marker'); assert.equal(e.K.auswahl, 'PIN-001');
  klick(e, renderer, 'zone', true); assert.equal(e.K.auswahl, 'ZO-001');
  klick(e, renderer); assert.equal(e.K.auswahl, null);
  /* Nur synthetischer Altzweig: produktiv gibt es keine Auftragszonen mehr. */
  const alt = (x, id, mehr) => renderer === '3d'
    ? x.eingang({ typ: 'karte3d-klick', lat: ll[0], lon: ll[1], zid: id, umschalt: mehr })
    : x.st.klick({ clientX: 120, clientY: 230, ctrlKey: mehr, target: { closest(q) { return q === '.k-zone' ? { getAttribute(attr) { return attr === 'data-render-key' ? null : id; } } : null; } } });
  e = umgebung({ auswahl: 'ZN-1' }); alt(e, 'ZN-2', true);
  assert.deepEqual(e.K.mehr, ['ZN-1', 'ZN-2']); assert.equal(e.K.auswahl, null);
  alt(e, 'ZN-2', true); assert.deepEqual(e.K.mehr, ['ZN-1']);
  e = umgebung({ mehrModus: true }); alt(e, 'ZN-2', false); assert.deepEqual(e.K.mehr, ['ZN-2']);
  e = umgebung({ mehrModus: true }); klick(e, renderer, 'zone', true); assert.equal(e.K.auswahl, 'ZO-001');
}
const k = umgebung(); klick(k, 'svg', 'kante'); assert.equal(k.K.auswahl, 'V-001');
const invalid = umgebung({ pinSetzen: true });
invalid.klick3d({ lat: NaN, lon: 13 }); invalid.klick3d({ lat: 91, lon: 13 });
assert.deepEqual(invalid.aktionen, []); assert.equal(invalid.K.pinSetzen, true);
const fern = umgebung({ pinSetzen: true }); fern.klick3d({ lat: -34.123456, lon: 151.987654 });
assert.deepEqual(fern.aktionen, [{ type: 'PIN_ANGELEGT', ll: [-34.123456, 151.987654] }], '3D-Koordinaten direkt, unabhängig vom SVG');
for (const [lon, erwartet] of [[181, -179], [-181, 179], [540, -180], [-540, -180], [180, 180], [-180, -180]]) {
  const e = umgebung({ pinSetzen: true });
  e.eingang({ typ: 'karte3d-klick', lat: 12, lon });
  assert.deepEqual(e.aktionen, [{ type: 'PIN_ANGELEGT', ll: [12, erwartet] }]);
  assert.equal(e.nachrichten.at(-1).typ, 'karte3d-auswahl');
}
invalid.klick3d({ lat: 12, lon: Infinity }); assert.deepEqual(invalid.aktionen, []);
for (const key of ['Enter', ' ']) {
  const e = umgebung(); let prevented = false;
  e.listeners.keydown[0]({ key, preventDefault() { prevented = true; }, target: { closest(q) { return q === '.k-marker' ? this : null; }, getAttribute(attr) { return attr === 'data-render-key' ? null : 'PIN-001'; } } });
  assert.equal(prevented, true); assert.equal(e.K.auswahl, 'PIN-001');
}
console.log('OK: K1a SVG/3D-Klickvertrag, Moduspriorität, Mehrfachauswahl, Tastatur, Mess-Snap und Datumsgrenze');
