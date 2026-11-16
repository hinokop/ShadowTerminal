'use strict';
/* Field Terminal: Modul 6, Lagekarte (2D-Renderer, Kachelspeicher, Zonen, Zugriffspunkte, Pins, Messen, 3D-Brücke).
   Klassisches Skript (kein ES-Modul, damit es auch von file:// geladen wird). Wird nach dem Hauptskript in index.html geladen und
   nutzt dessen globale Namen (STATE, VIEW, PROFIL, h, s, $, dispatch, SCENARIO, ...). Die Anwendung startet erst nach dem load-Ereignis. */
/* =====================================================================
   MODUL 6: LAGEKARTE
   Offline-Karte in Mercator-Projektion: Länderumrisse (karte.js), Flüsse, Seen, Siedlungen, Fernstraßen und Orte (karte2.js),
   Gitternetz, Standorte, Orte, Akteure, Anreiseroute und Zeitschieber für die Zeitfenster der Mission.
   Optional (standardmäßig aus): Online-Kacheln mit Straßen und Namen; dabei lädt der Browser Kacheln vom Anbieter.
   Ein Klick auf einen Akteur öffnet sein Dossier. Kartenpositionen setzt der Agent im Dossier (Koordinaten oder Klick auf die Karte).
   ===================================================================== */
const KW = 960, KH = 540, DEG = Math.PI / 180;
VIEW.karte = { cartoKey: '', cartoStil: 'dark_all', zoneSetzen: false, statusOffen: false, lat: 50.5, lon: 8, zoom: 5, dt: 0, auswahl: null, pick: null, init: false, messen: false, messPts: [], spiel: null, flug: null, suche: '', anbieter: 'osm', url: '', dunkel: true,
  ebenenOffen: true, quellenAus: {}, wetter: true,
  ebenen: { ausgang: true, standorte: true, orte: true, personen: true, organisationen: true, verbindungen: true, sichtungen: true, fenster: true, route: true, strecke: true, gelaende: true, strassen: true, namen: true, zonen: true, kacheln: false } };
try {
  const gespeichert = JSON.parse(window.localStorage.getItem(STORAGE_KEY + '.kartenwahl') || 'null');
  if (gespeichert && typeof gespeichert === 'object') {
    Object.keys(VIEW.karte.ebenen).forEach(function (k) { if (typeof gespeichert.ebenen[k] === 'boolean') VIEW.karte.ebenen[k] = gespeichert.ebenen[k]; });
    if (typeof gespeichert.ebenen.akteure === 'boolean' && typeof gespeichert.ebenen.personen !== 'boolean') { VIEW.karte.ebenen.personen = gespeichert.ebenen.akteure; VIEW.karte.ebenen.organisationen = gespeichert.ebenen.akteure; }
    if (['eigen', 'osm', 'carto', 'luftbild', 'hybrid'].indexOf(gespeichert.anbieter) >= 0) VIEW.karte.anbieter = gespeichert.anbieter;
    if (typeof gespeichert.url === 'string') VIEW.karte.url = gespeichert.url;
    if (typeof gespeichert.cartoKey === 'string') VIEW.karte.cartoKey = gespeichert.cartoKey;
    if (gespeichert.cartoStil === 'dark_all' || gespeichert.cartoStil === 'dark_nolabels') VIEW.karte.cartoStil = gespeichert.cartoStil;
    if (typeof gespeichert.dunkel === 'boolean') VIEW.karte.dunkel = gespeichert.dunkel;
    if (gespeichert.quellenAus && typeof gespeichert.quellenAus === 'object') VIEW.karte.quellenAus = gespeichert.quellenAus;
  }
  /* Schlüsseldatei kartenschluessel.js (optional, liegt neben index.html): setzt den Schlüssel, wenn im Browser keiner steht */
  const sd = window.KARTEN_SCHLUESSEL;
  if (sd && typeof sd.carto === 'string' && sd.carto.trim() && !(VIEW.karte.cartoKey || '').trim()) {
    VIEW.karte.cartoKey = sd.carto.trim();
    if (!gespeichert) { VIEW.karte.anbieter = 'carto'; VIEW.karte.ebenen.kacheln = true; }
  }
} catch (e) { /* ohne gespeicherte Wahl */ }
function karteWahlSichern() { try { window.localStorage.setItem(STORAGE_KEY + '.kartenwahl', JSON.stringify({ ebenen: VIEW.karte.ebenen, anbieter: VIEW.karte.anbieter, url: VIEW.karte.url, dunkel: VIEW.karte.dunkel, cartoKey: VIEW.karte.cartoKey, cartoStil: VIEW.karte.cartoStil, quellenAus: VIEW.karte.quellenAus })); } catch (e) { /* ohne Speicher */ } }
function merc(lat) { return Math.log(Math.tan(Math.PI / 4 + Math.max(-85, Math.min(85, lat)) * DEG / 2)); }
function mercInv(y) { return (2 * Math.atan(Math.exp(y)) - Math.PI / 2) / DEG; }
function karteProj() {
  const K = VIEW.karte, Wd = 256 * Math.pow(2, K.zoom), my0 = merc(K.lat);
  return { Wd: Wd,
    px: function (lon) { return KW / 2 + (lon - K.lon) / 360 * Wd; },
    py: function (lat) { return KH / 2 - (merc(lat) - my0) / (2 * Math.PI) * Wd; },
    lon: function (x) { return K.lon + (x - KW / 2) / Wd * 360; },
    lat: function (y) { return mercInv(my0 - (y - KH / 2) / Wd * 2 * Math.PI); } };
}
function entpacke(flat, start) {
  const n = (flat.length - start) / 2, lon = new Float32Array(n), lat = new Float32Array(n);
  let x = flat[start], y = flat[start + 1], b = [x, y, x, y];
  lon[0] = x / 100; lat[0] = y / 100;
  for (let i = 1; i < n; i++) {
    x += flat[start + 2 * i]; y += flat[start + 2 * i + 1];
    lon[i] = x / 100; lat[i] = y / 100;
    if (x < b[0]) b[0] = x; if (y < b[1]) b[1] = y; if (x > b[2]) b[2] = x; if (y > b[3]) b[3] = y;
  }
  return { lon: lon, lat: lat, b: [b[0] / 100, b[1] / 100, b[2] / 100, b[3] / 100] };
}
let KARTE_RINGE = null, KARTE_EBENEN_C = null;
function karteRinge() {
  if (KARTE_RINGE) return KARTE_RINGE;
  const out = [];
  (typeof KARTE_LAND !== 'undefined' && Array.isArray(KARTE_LAND) ? KARTE_LAND : []).forEach(function (c) { c.p.forEach(function (flat) { out.push(entpacke(flat, 0)); }); });
  return (KARTE_RINGE = out);
}
function karteEbenenDaten() {
  if (KARTE_EBENEN_C) return KARTE_EBENEN_C;
  const E = typeof KARTE_EBENEN !== 'undefined' && KARTE_EBENEN ? KARTE_EBENEN : {};
  return (KARTE_EBENEN_C = {
    fluesse: (E.fluesse || []).map(function (f) { return entpacke(f, 0); }),
    seen: (E.seen || []).map(function (f) { return entpacke(f, 0); }),
    siedlung: (E.siedlung || []).map(function (f) { return entpacke(f, 0); }),
    strassen: (E.strassen || []).map(function (f) { const o = entpacke(f, 1); o.k = f[0]; return o; }),
    orte: (E.orte || []).slice().sort(function (a, b) { return b[3] - a[3]; })
  });
}
function karteKoord(id) {
  if (PROFIL.koord[id]) return PROFIL.koord[id];
  if (PROFIL.karteBlanko) return null;
  const k = SCENARIO.karte && SCENARIO.karte.koord ? SCENARIO.karte.koord[id] : null;
  return k || null;
}
function sichtungKoord(s) {
  const roh = String(s.ort || '').trim();
  if (!roh) return null;
  const kk = parseKoord(roh);                                     /* Koordinatenangabe (aus einem Entwurfs-Pin): genau dieser Punkt */
  if (kk) return { ll: kk, genau: 'Koordinate', bez: roh };
  const richtung = /^richtung\b/i.test(roh), name = erkFold(roh.replace(/^richtung\s+/i, '')).replace(/[^a-z0-9 ]/g, ' ').trim();
  if (name.length < 4) return null;
  const norm = function (t) { return erkFold(t).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim(); }, q = name.replace(/\s+/g, ' ');
  const orte = pool().filter(function (e) { return e.typ === 'Ort' && karteKoord(e.id); });
  /* exakter Name zuerst; Teiltreffer nur, wenn genau ein Ort passt (mehrdeutige Angaben bekommen keinen geratenen Punkt) */
  const exakt = orte.filter(function (e) { return norm(e.name) === q; }), teil = orte.filter(function (e) { return norm(e.name).indexOf(q) >= 0; });
  const dmehr = exakt.length > 1 || (!exakt.length && teil.length > 1);          /* mehrdeutiger Dossier-Ort: kein Punkt, auch nicht aus dem Ortsverzeichnis */
  if (dmehr) return null;
  const ort = exakt.length === 1 ? exakt[0] : (teil.length === 1 ? teil[0] : null);
  if (ort) return { ll: karteKoord(ort.id), genau: richtung ? 'Richtung' : 'Ort im Dossier', bez: ort.id + ' ' + ort.name };
  const nn = function (o) { return erkFold(String(o[0])).replace(/[^a-z0-9 ]/g, ' ').trim(); }, verz = karteEbenenDaten().orte;
  const sx = verz.filter(function (o) { return nn(o) === name; }), sp = name.length >= 5 ? verz.filter(function (o) { return nn(o).indexOf(name) === 0; }) : [];
  /* im Ortsverzeichnis gilt dieselbe Regel: exakt eindeutig, sonst genau ein Präfixtreffer, sonst kein Punkt */
  const st = sx.length === 1 ? sx[0] : (!sx.length && sp.length === 1 ? sp[0] : null);
  if (st) return { ll: [st[2] / 100, st[1] / 100], genau: richtung ? 'Richtung' : 'Ortschaft', bez: st[0] };
  return null;
}
function karteAssetId(e) {
  const n = erkFold(kanalDef('asset').gegenstelle || '');
  return !!n && e.typ === 'Person' && (e.aliase || []).some(function (al) { return erkFold(al) === n; });
}
/* Missionsobjekte der Karte (Standorte, Zonen des Auftrags, Verbindungen, Zeitfenster) gibt es nur im Missionsbetrieb mit laufendem Auftrag */
function karteOhneMission() { return STATE.vorlauf || !missionsbetrieb(); }
/* Darstellung getrennt von zDef() für den historischen Ablauf. Kein Wiederaufleben des Karten-UI aus Altdaten. */
function karteAuftragsansicht() { return VIEW.missionsansicht === STATE && !PROFIL.karteBlanko ? zDef() : null; }
/* Ein Entwurfs-Pin gilt als bestätigt, sobald die zugehörige Sichtung im Dossier existiert; dann zeigt die Karte nur noch die Sichtung (Pin-Daten bleiben erhalten) */
function pinSichtung(x) {
  if (!x || !x.sichtung) return null;
  const ds = STATE.dossiers.entitaeten;
  for (const id in ds) { const l = ds[id] && ds[id].sichtungen; if (l) { const si = l.find(function (y) { return y.id === x.sichtung; }); if (si) return si; } }
  return null;
}
function pinBestaetigt(x) { return !!pinSichtung(x); }
function sichtungPin(si) { return (PROFIL.pins || []).find(function (y) { return y.sichtung === si.id; }) || null; }
function karteMarker() {
  const Z = VIEW.karte.ebenen, def = karteAuftragsansicht(), out = [];
  if (Z.ausgang) PROFIL.ausgang.forEach(function (x) { if (x.ll) out.push({ id: x.id, kat: 'ausgang', name: x.name, ll: x.ll, art: x.art }); });
  if (def && Z.standorte && STATE.agent.checkin.standortId === 'AW' && STATE.agent.checkin.koord) out.push({ id: 'AW', kat: 'standort', name: 'Ausweichort ' + STATE.agent.checkin.name, ll: STATE.agent.checkin.koord, land: '' });
  if (def && Z.standorte) def.standorte.forEach(function (st) {
    const ll = karteKoord(st.id);
    if (ll) out.push({ id: st.id, kat: 'standort', name: st.name, ll: ll, land: st.land });
  });
  if (def && Z.route !== false) MS(def.id).zugriff.forEach(function (z) { if (z.ll) out.push({ id: z.id, kat: 'zugriff', name: z.typ + ' ' + z.id, ll: z.ll, r: z.r || 0, zp: z }); });
  if (Z.pins !== false) (PROFIL.pins || []).forEach(function (x) { if (x.ll && !pinBestaetigt(x)) out.push({ id: x.id, kat: 'pin', name: x.name, ll: x.ll }); });
  const fokus = VIEW.karte.sichtungFokus || null;             /* gezielt angesprungene Sichtung: auch wenn älter als die letzten drei oder die Ebene ausgeblendet ist */
  if (Z.sichtungen !== false || fokus) pool().forEach(function (e) {
    if (infoGesperrt(e) || dossierGesperrt(e)) return;
    const d = STATE.dossiers.entitaeten[e.id], alle = (d && d.sichtungen) || [], sicht = Z.sichtungen !== false ? alle.slice(-3) : [];
    if (fokus) { const f = alle.find(function (x) { return x.id === fokus; }); if (f && sicht.indexOf(f) < 0) sicht.push(f); }
    sicht.forEach(function (si) {
      const k = sichtungKoord(si);
      if (k) out.push({ id: si.id, kat: 'sichtung', typ: 'Sichtung', name: e.id + ' ' + e.name + (si.ort ? ' · ' + si.ort : ''), ll: k.ll, genau: k.genau, bez: k.bez, entId: e.id, si: si, guete: sichtungGuete(e, si), unM: sichtungRadiusM(si, k.genau) });
    });
  });
  const zusatzIds = {};
  if (def) (MS(def.id).zusatz || []).forEach(function (x) { if (x.urteil !== 'abgelehnt') zusatzIds[x.id] = true; });
  pool().forEach(function (e) {
    const ll = karteKoord(e.id);
    if (!ll) return;
    if (infoGesperrt(e) || dossierGesperrt(e)) return;
    const stufe = def ? bedrohung(e).stufe : 0;
    if (e.typ === 'Ort') { if (Z.orte) out.push({ id: e.id, kat: 'ort', typ: 'Ort', name: e.name, ll: ll, land: e.land, entitaet: true, stufe: stufe }); }
    else if (e.typ === 'Person' ? Z.personen : Z.organisationen) out.push({ id: e.id, kat: 'figur', typ: e.typ, name: e.name, ll: ll, land: e.land, entitaet: true, stufe: stufe, zusatz: zusatzIds[e.id] || false, asset: !!def && karteAssetId(e) });
  });
  return out;
}
function karteFenster(def = karteAuftragsansicht()) {
  if (!def) return [];
  const ms = MS(def.id), T = Date.now() + VIEW.karte.dt * 3600000, zuord = (SCENARIO.karte && SCENARIO.karte.fensterOrt) || {};
  return def.zeitfenster.map(function (w) {
    const z = ms.zeitfenster[w.id];
    if (!z) return null;
    const von = Date.parse(z.von), bis = Date.parse(z.bis);
    return { id: w.id, titel: w.titel, von: von, bis: bis, ort: zuord[w.id] || null, zustand: bis < T ? 'abgelaufen' : von <= T ? 'aktiv' : 'ausstehend', T: T };
  }).filter(Boolean);
}
function karteStrecke() {
  const def = karteAuftragsansicht();
  return def && def.route && Array.isArray(def.route.abschnitte) ? def.route : null;
}
function karteHerkunft() {
  const def = karteAuftragsansicht(), an = STATE.anreise;
  if (!def || !an || an.mission !== def.id || an.ohnePlan || !an.ortId) return null;
  const ag = an.ausgangId ? PROFIL.ausgang.find(function (x) { return x.id === an.ausgangId; }) : null;
  const hk = ag && ag.ll ? { koord: ag.ll, name: ag.name } : (SCENARIO.karte && SCENARIO.karte.herkunft && SCENARIO.karte.herkunft[def.id]), ziel = karteKoord(an.ortId);
  return hk && ziel ? { von: hk.koord, nach: ziel, name: hk.name, plan: an } : null;
}
function karteEinpassen(punkte) {
  const K = VIEW.karte;
  if (!punkte.length) return;
  let a = 90, b = -90, c = 180, d = -180;
  punkte.forEach(function (p) { a = Math.min(a, p[0]); b = Math.max(b, p[0]); c = Math.min(c, p[1]); d = Math.max(d, p[1]); });
  K.lon = (c + d) / 2; K.lat = mercInv((merc(a) + merc(b)) / 2);
  const dLon = Math.max(d - c, 0.004), dMy = Math.max(merc(b) - merc(a), 0.00008);
  const Wd = Math.min(0.8 * KW * 360 / dLon, 0.8 * KH * 2 * Math.PI / dMy);
  K.zoom = Math.max(2, Math.min(15, Math.log(Wd / 256) / Math.LN2));
}
function karteGrundansicht() {
  const K = VIEW.karte, def = karteAuftragsansicht();
  const pts = def ? def.standorte.map(function (s) { return karteKoord(s.id); }).filter(Boolean) : [];
  const hk = karteHerkunft();
  if (hk) pts.push(hk.von, hk.nach);
  if (pts.length) karteEinpassen(pts); else { K.lat = 30; K.lon = 40; K.zoom = 2.2; }
}
function karteSchritt(liste, minPx, proPx) {
  for (let i = 0; i < liste.length; i++) if (liste[i] * proPx >= minPx) return liste[i];
  return liste[liste.length - 1];
}
function kartePfad(arr, P, vb, geschlossen, minAbst, filter) {
  let d = '';
  for (let j = 0; j < arr.length; j++) {
    const r = arr[j];
    if (r.b[2] < vb.lonMin || r.b[0] > vb.lonMax || r.b[3] < vb.latMin || r.b[1] > vb.latMax) continue;
    if (filter && !filter(r)) continue;
    let lx = 1e9, ly = 1e9, seg = '';
    for (let i = 0; i < r.lon.length; i++) {
      const x = P.px(r.lon[i]), y = P.py(r.lat[i]);
      if (i > 0 && i < r.lon.length - 1 && Math.abs(x - lx) < minAbst && Math.abs(y - ly) < minAbst) continue;
      seg += (seg ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
      lx = x; ly = y;
    }
    if (seg) d += seg + (geschlossen ? 'Z' : '');
  }
  return d;
}
/* Amtliches Luftbild Berlin (TrueOrthophoto 2024, 20 cm; Datenlizenz Deutschland Zero 2.0, keine Auflagen): WMS-Abruf je Kachel in Web-Mercator.
   Außerhalb Berlins liefert der Dienst transparente Flächen, darunter bleibt die dunkle Karte sichtbar. */
const LUFTBILD_WMS = 'https://gdi.berlin.de/services/wms/truedop_2024';
const BERLIN_BOX = [13.07, 52.33, 13.78, 52.69];      /* Lage Berlins (Länge min, Breite min, Länge max, Breite max); außerhalb liefert der Dienst nichts */
const BERLIN_KERN = [13.25, 52.43, 13.58, 52.56];     /* Kerngebiet ohne Randflächen: hier genügt das kleinere JPEG */
/* Weitere freie Luftbild- und Satellitenquellen (zuschaltbar unter Grundlage). Die Dienstadressen stammen aus den Angaben der Betreiber
   (LGB Brandenburg: OSM-Wiki Geoportal Brandenburg; EOX: s2maps.eu); sie konnten in der Entwicklungsumgebung nicht abgerufen und daher nicht
   gegen die Dienste geprüft werden. Fällt ein Dienst aus, zeigt die Quellenzeile "nicht erreichbar" und die Karte bleibt benutzbar.
   Nicht aufgenommen: DOP-Dienst des BKG (für Dritte gebührenpflichtig). */
const SAT_QUELLEN = {
  sat: { name: 'Satellit weltweit (Sentinel-2, 10 m)', kurz: 'Sentinel-2 cloudless 2024, s2maps.eu by EOX IT Services GmbH (enthält modifizierte Copernicus-Sentinel-Daten 2024)',
    zmin: 3, zmax: 13, box: null,
    url: function (z, x, y) { return 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/' + z + '/' + y + '/' + x + '.jpg'; } },
  bb: { name: 'Brandenburg Luftbild (20 cm)', kurz: '© GeoBasis-DE/LGB, dl-de/by-2-0',
    zmin: 10, zmax: 19, box: [11.2, 51.35, 14.8, 53.6],
    url: function (z, x, y) {
      const gr = kachelGrenzen(z, x, y), b = SAT_QUELLEN.bb.box;
      if (gr[2] < b[0] || gr[0] > b[2] || gr[3] < b[1] || gr[1] > b[3]) return null;
      const g = 40075016.6856 / Math.pow(2, z), o = 20037508.3428, x0 = -o + x * g, y1 = o - y * g;
      return 'https://isk.geobasis-bb.de/mapproxy/dop20c/service/wms?service=WMS&version=1.3.0&request=GetMap&layers=bebb_dop20c&styles=&crs=EPSG:3857&bbox='
        + [x0, y1 - g, x0 + g, y1].map(function (v) { return v.toFixed(3); }).join(',') + '&width=256&height=256&format=image/jpeg';
    } }
};
const KQ = {};            /* Ladestand je Kachelebene: { ok, fehler } */
let KACHEL_VERMERK = [];  /* Quellenangaben der im letzten Zeichenvorgang benutzten Zusatzquellen */
function kachelGrenzen(z, x, y) {
  const n = Math.pow(2, z), lat = function (yy) { return Math.atan(Math.sinh(Math.PI * (1 - 2 * yy / n))) / DEG; };
  return [x / n * 360 - 180, lat(y + 1), (x + 1) / n * 360 - 180, lat(y)];
}
function luftbildURL(z, x, y) {
  const gr = kachelGrenzen(z, x, y);
  if (gr[2] < BERLIN_BOX[0] || gr[0] > BERLIN_BOX[2] || gr[3] < BERLIN_BOX[1] || gr[1] > BERLIN_BOX[3]) return null;   /* außerhalb Berlins: keine Anfrage */
  const g = 40075016.6856 / Math.pow(2, z), o = 20037508.3428, x0 = -o + x * g, y1 = o - y * g;
  const innen = gr[0] >= BERLIN_KERN[0] && gr[2] <= BERLIN_KERN[2] && gr[1] >= BERLIN_KERN[1] && gr[3] <= BERLIN_KERN[3];
  return LUFTBILD_WMS + '?service=WMS&version=1.3.0&request=GetMap&layers=truedop_2024&styles=&crs=EPSG:3857&bbox=' + [x0, y1 - g, x0 + g, y1].map(function (v) { return v.toFixed(3); }).join(',') + '&width=256&height=256&' + (innen ? 'format=image/jpeg&bgcolor=0x0b1118' : 'format=image/png&transparent=true');
}
function cartoURL(stil, z, x, y) { return 'https://basemaps.cartocdn.com/rastertiles/' + stil + '/' + z + '/' + x + '/' + y + '.png?key=' + encodeURIComponent(VIEW.karte.cartoKey || ''); }
function kachelURL(z, x, y) {
  const u = VIEW.karte.url.trim();
  if (VIEW.karte.anbieter === 'eigen' && /^https:\/\//.test(u) && u.indexOf('{z}') >= 0) return u.replace('{s}', 'abcd'.charAt((x + y) % 4)).replace('{z}', z).replace('{x}', x).replace('{y}', y).replace('{r}', '');
  if (VIEW.karte.anbieter === 'carto') return 'https://basemaps.cartocdn.com/rastertiles/' + (VIEW.karte.cartoStil === 'dark_nolabels' ? 'dark_nolabels' : 'dark_all') + '/' + z + '/' + x + '/' + y + '.png?key=' + encodeURIComponent(VIEW.karte.cartoKey || '');
  return 'https://tile.openstreetmap.org/' + z + '/' + x + '/' + y + '.png';
}
/* Kachelspeicher: Bildelemente bleiben zwischen den Zeichenvorgängen erhalten. So blitzt beim Verschieben nichts auf,
   und noch nicht geladene Kacheln werden zunächst durch schon geladene gröbere (oder feinere) Nachbarebenen ersetzt. */
/* Zwischenspeicher für das Luftbild (IndexedDB, nur lokal): einmal geladene Kacheln kommen beim nächsten Besuch von der Platte.
   Der Dienst sendet "no-store"; der Browser-Cache hilft also nicht. Haltbarkeit 30 Tage, höchstens 4000 Kacheln. Fehlt der Speicher oder
   erlaubt der Dienst den Abruf nicht, lädt die Kachel wie bisher direkt. */
const KCACHE = {
  db: null, kaputt: false, TTL: 30 * 86400000, MAX: 4000, puts: 0,
  oeffnen: function () {
    return new Promise(function (ok, nein) {
      if (KCACHE.kaputt) { nein(new Error('aus')); return; }
      if (KCACHE.db) { ok(KCACHE.db); return; }
      let r;
      try { r = indexedDB.open('fieldterminal.kacheln', 1); } catch (x) { KCACHE.kaputt = true; nein(x); return; }
      r.onupgradeneeded = function () { const st = r.result.createObjectStore('k'); st.createIndex('t', 't'); };
      r.onsuccess = function () { KCACHE.db = r.result; ok(KCACHE.db); };
      r.onerror = function () { KCACHE.kaputt = true; nein(r.error); };
    });
  },
  get: function (key) {
    return KCACHE.oeffnen().then(function (db) {
      return new Promise(function (ok) {
        const q = db.transaction('k').objectStore('k').get(key);
        q.onsuccess = function () { const v = q.result; ok(v && v.blob && Date.now() - v.t < KCACHE.TTL ? v.blob : null); };
        q.onerror = function () { ok(null); };
      });
    });
  },
  put: function (key, blob) {
    return KCACHE.oeffnen().then(function (db) {
      const st = db.transaction('k', 'readwrite').objectStore('k');
      st.put({ blob: blob, t: Date.now() }, key);
      if (++KCACHE.puts % 40 === 0) KCACHE.aufraeumen();
    }).catch(function () {});
  },
  aufraeumen: function () {
    KCACHE.oeffnen().then(function (db) {
      const st = db.transaction('k', 'readwrite').objectStore('k'), c = st.count();
      c.onsuccess = function () {
        let zuviel = c.result - Math.round(KCACHE.MAX * 0.9);
        if (c.result <= KCACHE.MAX) return;
        st.index('t').openCursor().onsuccess = function (ev) { const cur = ev.target.result; if (cur && zuviel-- > 0) { cur.delete(); cur.continue(); } };
      };
    }).catch(function () {});
  },
  anzahl: function () { return KCACHE.oeffnen().then(function (db) { return new Promise(function (ok) { const c = db.transaction('k').objectStore('k').count(); c.onsuccess = function () { ok(c.result); }; c.onerror = function () { ok(0); }; }); }).catch(function () { return 0; }); },
  leeren: function () { return KCACHE.oeffnen().then(function (db) { return new Promise(function (ok) { const q = db.transaction('k', 'readwrite').objectStore('k').clear(); q.onsuccess = q.onerror = function () { ok(); }; }); }).catch(function () {}); },
  laden: function (el, url) {
    const frei = function (u) { el.addEventListener('load', function () { try { URL.revokeObjectURL(u); } catch (x) {} }, { once: true }); };
    const direkt = function () { el.setAttribute('href', url); };
    KCACHE.get(url).then(function (blob) {
      if (blob) { const u = URL.createObjectURL(blob); frei(u); el.setAttribute('href', u); return; }
      return fetch(url, { mode: 'cors', cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error('http'); return r.blob(); }).then(function (b) {
        if (!b || b.size < 100 || !/^image\//.test(b.type)) throw new Error('inhalt');
        KCACHE.put(url, b);
        const u = URL.createObjectURL(b); frei(u); el.setAttribute('href', u);
      });
    }).catch(direkt);
  }
};
const KACHELN = new Map(); let kachelFrame = 0, kachelTimer = 0;
function kachelNachladen() {
  clearTimeout(kachelTimer);
  kachelTimer = setTimeout(function () { const svg = typeof $ === 'function' ? $('k-svg') : null; if (svg && !VIEW.karte.flug && !VIEW.karte.ziehen) zeichneKarte(svg); }, 350);   /* Ersatzkacheln wieder entfernen */
}
function kachelHolen(url, ebKey, z, x, y) {
  const k = ebKey + '|' + z + '|' + x + '|' + y;
  let c = KACHELN.get(k);
  if (!c || c.url !== url) {
    const luftK = url.indexOf(LUFTBILD_WMS) === 0 && typeof indexedDB !== 'undefined' && typeof fetch === 'function';
    const el = s('image', luftK ? { preserveAspectRatio: 'none' } : { href: url, preserveAspectRatio: 'none' });
    if (luftK) KCACHE.laden(el, url);
    c = { el: el, ok: false, fehler: false, url: url, z: z, x: x, y: y, eb: ebKey, f: 0 };
    const q = KQ[ebKey] || (KQ[ebKey] = { ok: 0, fehler: 0 });
    el.addEventListener('load', function () { c.ok = true; q.ok++; kachelNachladen(); });
    el.addEventListener('error', function () { c.fehler = true; q.fehler++; });
    KACHELN.set(k, c);
    if (KACHELN.size > 900) { const alt = []; KACHELN.forEach(function (v, kk) { if (v.f < kachelFrame - 40) alt.push(kk); }); alt.slice(0, 300).forEach(function (kk) { const v = KACHELN.get(kk); if (v && v.el.parentNode) v.el.parentNode.removeChild(v.el); KACHELN.delete(kk); }); }
  }
  c.f = kachelFrame;
  return c;
}
/* Dauerhafte Kachelgruppe: Die Bildelemente bleiben beim Neuzeichnen im Dokument und werden nur umgesetzt oder ein- und ausgeblendet.
   Dadurch entfällt das Entfernen und Wiedereinsetzen, das ein kurzes Schwarz verursachen kann. */
const KGRUPPE = { wurzel: null, teile: {}, sicht: new Set() };
function kachelTeil(key, rolle) {
  if (!KGRUPPE.wurzel) KGRUPPE.wurzel = s('g', { class: 'k-kachelgruppe' });
  const k = key + '|' + rolle;
  if (!KGRUPPE.teile[k]) { KGRUPPE.teile[k] = s('g', { class: 'k-kachelteil' }); KGRUPPE.wurzel.appendChild(KGRUPPE.teile[k]); }
  return KGRUPPE.teile[k];
}
function kachelAblegen(el, key, rolle, neuSicht) {
  const g = kachelTeil(key, rolle);
  if (el.parentNode !== g) g.appendChild(el);
  neuSicht.add(el);
}
function kachelnZeichnen(P, kids) {
  const K = VIEW.karte, z = Math.max(0, Math.min(19, Math.round(K.zoom))), n = Math.pow(2, z), ts = P.Wd / n;
  const tx = function (lon) { return Math.floor((lon + 180) / 360 * n); };
  const ty = function (lat) { const r = Math.max(-85, Math.min(85, lat)) * DEG; return Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n); };
  const x0 = tx(P.lon(0)), x1 = tx(P.lon(KW)), y0 = Math.max(0, ty(P.lat(0))), y1 = Math.min(n - 1, ty(P.lat(KH)));
  if ((x1 - x0 + 1) * (y1 - y0 + 1) > 60) return;
  kachelFrame++;
  KACHEL_VERMERK = [];
  const neuSicht = new Set();
  const hatKey = !!(K.cartoKey || '').trim(), luft = K.anbieter === 'luftbild' || K.anbieter === 'hybrid';
  /* Ganz in Berlin: die dunkle Unterlage wird nicht gebraucht und nicht geladen */
  const imBerlin = P.lon(0) >= BERLIN_BOX[0] && P.lon(KW) <= BERLIN_BOX[2] && P.lat(KH) >= BERLIN_BOX[1] && P.lat(0) <= BERLIN_BOX[3];
  /* Ebenen von unten nach oben */
  const ebenen = [];
  if (!luft) ebenen.push({ key: K.anbieter + (K.cartoStil || ''), u: kachelURL, dunkel: VIEW.karte.dunkel && K.anbieter !== 'carto' });
  else {
    if (hatKey && !(imBerlin && z >= 10)) ebenen.push({ key: 'cn', u: function (zz, xx, yy) { return cartoURL('dark_nolabels', zz, xx, yy); }, dunkel: false });
    Object.keys(SAT_QUELLEN).forEach(function (k) {
      const q = SAT_QUELLEN[k];
      if (z < q.zmin || z > q.zmax || (K.quellenAus || {})[k]) return;
      ebenen.push({ key: k, u: q.url, dunkel: false, quelle: k });
    });
    if (z >= 10) ebenen.push({ key: 'lb', u: luftbildURL, dunkel: false });
    if (K.anbieter === 'hybrid' && hatKey) ebenen.push({ key: 'cl', u: function (zz, xx, yy) { return cartoURL('dark_only_labels', zz, xx, yy); }, dunkel: false, beschr: true });
  }
  ebenen.forEach(function (eb) { if (eb.quelle) { const q = SAT_QUELLEN[eb.quelle], st = KQ[eb.key]; KACHEL_VERMERK.push(q.kurz + (st && st.fehler >= 3 && !st.ok ? ' (nicht erreichbar)' : '')); } });
  const gesetzt = new Set();
  const setze = function (c, zz, xx, yy, dunkel, beschr, ebk) {
    if (gesetzt.has(c.el)) return;
    gesetzt.add(c.el);
    const nn = Math.pow(2, zz), lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * yy / nn))) / DEG, ts2 = P.Wd / nn;
    const el = c.el;
    el.setAttribute('x', P.px(xx / nn * 360 - 180).toFixed(2)); el.setAttribute('y', P.py(lat).toFixed(2));
    el.setAttribute('width', (ts2 + 0.6).toFixed(2)); el.setAttribute('height', (ts2 + 0.6).toFixed(2));
    el.setAttribute('class', 'k-kachel' + (dunkel ? ' dunkel' : '') + (beschr ? ' beschriftung' : ''));
    kachelAblegen(el, ebk, 'u', neuSicht);
  };
  ebenen.forEach(function (eb) {
    const unten = [], oben = [];
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
      const xm = ((x % n) + n) % n, url = eb.u(z, xm, y);
      if (!url) continue;
      const c = kachelHolen(url, eb.key, z, xm, y);
      if (!c.ok && !eb.beschr) {
        /* Ersatz: gröbere Ebenen darüber, sonst die vier feineren darunter */
        let fand = false;
        for (let d = 1; d <= 3 && !fand && z - d >= 0; d++) {
          const k = eb.key + '|' + (z - d) + '|' + (xm >> d) + '|' + (y >> d), p = KACHELN.get(k);
          if (p && p.ok && !gesetzt.has(p.el)) { unten.push([p, z - d, xm >> d, y >> d]); fand = true; }
        }
        if (!fand) for (let dx = 0; dx < 2; dx++) for (let dy = 0; dy < 2; dy++) {
          const k = eb.key + '|' + (z + 1) + '|' + (xm * 2 + dx) + '|' + (y * 2 + dy), p = KACHELN.get(k);
          if (p && p.ok && !gesetzt.has(p.el)) unten.push([p, z + 1, xm * 2 + dx, y * 2 + dy]);
        }
      }
      oben.push([c, z, xm, y, x]);
    }
    unten.forEach(function (u) { u[0].f = kachelFrame; setze(u[0], u[1], u[2], u[3], eb.dunkel, eb.beschr, eb.key); });
    oben.forEach(function (o) {
      /* Der Abstand über die Dateline hinaus: Position aus dem ungewrappten x, damit die Kachel am richtigen Ort liegt */
      const c = o[0], nn = n, lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * o[3] / nn))) / DEG;
      if (gesetzt.has(c.el)) return;
      gesetzt.add(c.el);
      const el = c.el;
      el.setAttribute('x', P.px(o[4] / nn * 360 - 180).toFixed(2)); el.setAttribute('y', P.py(lat).toFixed(2));
      el.setAttribute('width', (ts + 0.6).toFixed(2)); el.setAttribute('height', (ts + 0.6).toFixed(2));
      el.setAttribute('class', 'k-kachel' + (eb.dunkel ? ' dunkel' : '') + (eb.beschr ? ' beschriftung' : ''));
      kachelAblegen(el, eb.key, 'o', neuSicht);
    });
  });
  /* Reihenfolge der Teilgruppen wie die Ebenen (nur bei Änderung wird umgesetzt), nicht benötigte ausblenden */
  const W = KGRUPPE.wurzel; let pos = 0;
  ebenen.forEach(function (eb) { ['u', 'o'].forEach(function (r) {
    const g = kachelTeil(eb.key, r); g.removeAttribute('display');
    if (W.childNodes[pos] !== g) W.insertBefore(g, W.childNodes[pos] || null);
    pos++;
  }); });
  Object.keys(KGRUPPE.teile).forEach(function (k) { const g = KGRUPPE.teile[k]; if (!ebenen.some(function (eb) { return k === eb.key + '|u' || k === eb.key + '|o'; })) g.setAttribute('display', 'none'); });
  KGRUPPE.sicht.forEach(function (el) { if (!neuSicht.has(el)) el.setAttribute('display', 'none'); });
  neuSicht.forEach(function (el) { el.removeAttribute('display'); });
  KGRUPPE.sicht = neuSicht;
  kids.push(W);
}
function karteSymbol(m, x, y) {
  const hoch = m.stufe >= 4 ? ' hoch' : '';
  let sym;
  if (m.kat === 'zugriff') sym = [s('circle', { cx: x, cy: y, r: 6, class: 'k-m zugriff' }), s('line', { x1: x - 4, y1: y - 4, x2: x + 4, y2: y + 4, class: 'k-kreuz' }), s('line', { x1: x - 4, y1: y + 4, x2: x + 4, y2: y - 4, class: 'k-kreuz' })];
  else if (m.kat === 'pin') sym = [s('circle', { cx: x, cy: y, r: 6.5, class: 'k-m pin' }), s('circle', { cx: x, cy: y, r: 2, class: 'k-pin-kern' })];
  else if (m.kat === 'ausgang') sym = [s('polygon', { points: [x, y - 6, x + 5.5, y + 4, x - 5.5, y + 4].join(' '), class: 'k-m ausgang' })];
  else if (m.kat === 'standort') sym = [s('circle', { cx: x, cy: y, r: 5.5, class: 'k-m standort' }), s('line', { x1: x - 3.2, y1: y, x2: x + 3.2, y2: y, class: 'k-kreuz' }), s('line', { x1: x, y1: y - 3.2, x2: x, y2: y + 3.2, class: 'k-kreuz' })];
  else if (m.kat === 'ort') sym = [s('polygon', { points: [x, y - 6.5, x + 6.5, y, x, y + 6.5, x - 6.5, y].join(' '), class: 'k-m ort' + hoch })];
  else if (m.typ === 'Organisation') sym = [s('rect', { x: x - 5, y: y - 5, width: 10, height: 10, rx: 1.5, class: 'k-m org' + hoch }), s('line', { x1: x - 2, y1: y - 2.5, x2: x - 2, y2: y + 2.5, class: 'k-glyph org' }), s('line', { x1: x + 2, y1: y - 2.5, x2: x + 2, y2: y + 2.5, class: 'k-glyph org' })];
  else if (m.asset) sym = [s('circle', { cx: x, cy: y, r: 10, class: 'k-asset-ring' }), s('circle', { cx: x, cy: y, r: 5.5, class: 'k-m asset' }), s('circle', { cx: x, cy: y, r: 1.8, class: 'k-asset-punkt' })];
  else sym = [s('circle', { cx: x, cy: y, r: 6.2, class: 'k-m person' + hoch }), s('circle', { cx: x, cy: y - 1.7, r: 1.7, class: 'k-glyph' }), s('path', { d: 'M ' + (x - 3.3) + ' ' + (y + 3.4) + ' Q ' + x + ' ' + (y - 0.6) + ' ' + (x + 3.3) + ' ' + (y + 3.4), class: 'k-glyph' })];
  /* Hohe Bedrohung: ruhige, feste Ringe in Warnfarbe, ohne Blinken */
  if (m.stufe >= 4) { sym.unshift(s('circle', { cx: x, cy: y, r: 11, class: 'k-hoch-ring' })); if (m.stufe >= 5) sym.unshift(s('circle', { cx: x, cy: y, r: 14.5, class: 'k-hoch-ring zwei' })); }
  return sym;
}
function karteFensterLage() {
  const L = karteFenster();
  return { liste: L, aktiv: L.filter(function (w) { return w.zustand === 'aktiv'; }), kommend: L.filter(function (w) { return w.zustand === 'ausstehend'; }).sort(function (a, b) { return a.von - b.von; }) };
}
function zeichneKarte(svg) {
  const K = VIEW.karte, P = karteProj(), Z = K.ebenen, zm = K.zoom;
  const vb = { lonMin: P.lon(0), lonMax: P.lon(KW), latMin: P.lat(KH), latMax: P.lat(0) };
  const kids = [s('rect', { x: 0, y: 0, width: KW, height: KH, class: 'k-meer' })];
  const E = karteEbenenDaten();
  const kachelnOk = Z.kacheln && (K.anbieter !== 'carto' || !!(K.cartoKey || '').trim());   /* luftbild/hybrid: Luftbild ohne Schlüssel, Beschriftung und dunkle Unterlage nur mit Schlüssel */
  if (Z.kacheln && !kachelnOk) kids.push(s('rect', { x: 0, y: 0, width: KW, height: KH, class: 'k-meer' }));
  if (kachelnOk) kachelnZeichnen(P, kids);
  if (!kachelnOk) {
    const d = kartePfad(karteRinge(), P, vb, true, 0.8, function (r) { return (r.b[2] - r.b[0]) * P.Wd / 360 > 0.8 || (r.b[3] - r.b[1]) * P.Wd / 360 > 0.8; });
    if (d) kids.push(s('path', { d: d, class: 'k-land', 'fill-rule': 'evenodd' }));
    else if (!karteRinge().length) kids.push(s('text', { x: KW / 2, y: 24, class: 'k-hinweis', 'text-anchor': 'middle' }, 'Keine Länderumrisse geladen (karte.js fehlt). Markierungen und Gitternetz bleiben nutzbar.'));
    if (Z.gelaende) {
      if (zm >= 3) { const dd = kartePfad(E.seen, P, vb, true, 0.8); if (dd) kids.push(s('path', { d: dd, class: 'k-see' })); }
      if (zm >= 5.2) { const dd = kartePfad(E.siedlung, P, vb, true, 0.6); if (dd) kids.push(s('path', { d: dd, class: 'k-siedlung' })); }
      if (zm >= 3.2) { const dd = kartePfad(E.fluesse, P, vb, false, 0.8); if (dd) kids.push(s('path', { d: dd, class: 'k-fluss', style: 'stroke-width:' + Math.min(2.2, 0.5 + (zm - 3) * 0.2).toFixed(2) + 'px' })); }
    }
    if (Z.strassen && zm >= 5.6) {
      const a = kartePfad(E.strassen, P, vb, false, 0.8, function (r) { return r.k === 1 || zm >= 7; });
      if (a) { kids.push(s('path', { d: a, class: 'k-strasse-glow' })); kids.push(s('path', { d: a, class: 'k-strasse' })); }
    }
  }
  /* Gitternetz */
  const grad = 360 / P.Wd, gs = karteSchritt([0.0005, 0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 30], 90, 1 / grad);
  for (let lo = Math.ceil(vb.lonMin / gs) * gs; lo <= vb.lonMax; lo += gs) kids.push(s('line', { x1: P.px(lo), y1: 0, x2: P.px(lo), y2: KH, class: 'k-gitter' }));
  for (let la = Math.ceil(vb.latMin / gs) * gs; la <= vb.latMax; la += gs) kids.push(s('line', { x1: 0, y1: P.py(la), x2: KW, y2: P.py(la), class: 'k-gitter' }));
  /* Ortsnamen */
  if (Z.namen && !kachelnOk) {
    const schwelle = zm < 3.6 ? 5e6 : zm < 4.6 ? 2e6 : zm < 5.6 ? 8e5 : zm < 6.6 ? 3e5 : zm < 7.6 ? 1.5e5 : 0;
    let n = 0;
    for (let i = 0; i < E.orte.length && n < 70; i++) {
      const o = E.orte[i];
      if (o[3] < schwelle) continue;
      const lo = o[1] / 100, la = o[2] / 100;
      if (lo < vb.lonMin || lo > vb.lonMax || la < vb.latMin || la > vb.latMax) continue;
      const x = P.px(lo), y = P.py(la);
      kids.push(s('circle', { cx: x, cy: y, r: o[3] > 1e6 ? 2.6 : 1.8, class: 'k-ortpunkt' }), s('text', { x: x + 5, y: y - 4, class: 'k-ortname' }, o[0]));
      n += 1;
    }
  }
  /* Zeitfenster: außerhalb aller aktiven Fenster wird die Fläche leicht abgedunkelt */
  const FL = Z.fenster ? karteFensterLage() : { liste: [], aktiv: [], kommend: [] };
  if (FL.liste.length && !FL.aktiv.length) kids.push(s('rect', { x: 0, y: 0, width: KW, height: KH, class: 'k-ausserhalb' }));
  kids.push(s('defs', null, s('radialGradient', { id: 'k-vig-g', cx: '50%', cy: '50%', r: '72%' }, s('stop', { offset: '55%', 'stop-color': '#000', 'stop-opacity': '0' }), s('stop', { offset: '100%', 'stop-color': '#000', 'stop-opacity': '.55' }))));
  kids.push(s('rect', { x: 0, y: 0, width: KW, height: KH, fill: 'url(#k-vig-g)', class: 'k-vignette' }));
  /* Route */
  const hk = Z.route ? karteHerkunft() : null;
  if (hk) {
    const x1 = P.px(hk.von[1]), y1 = P.py(hk.von[0]), x2 = P.px(hk.nach[1]), y2 = P.py(hk.nach[0]);
    kids.push(s('line', { x1: x1, y1: y1, x2: x2, y2: y2, class: 'k-route' }), s('circle', { cx: x1, cy: y1, r: 4, class: 'k-start' }));
    const links = x1 > KW - 200;
    kids.push(s('text', { x: links ? x1 - 7 : x1 + 7, y: y1 - 8, class: 'k-text', 'text-anchor': links ? 'end' : 'start' }, hk.name + ' · Abfahrt'));
    kids.push(s('text', { x: (x1 + x2) / 2 + 6, y: (y1 + y2) / 2 - 6, class: 'k-text dim' }, hk.plan.mittelName + ', ' + dauerText(hk.plan.dauerMin)));
  }
  /* Vermutete Transportroute */
  const rt = Z.strecke ? karteStrecke() : null;
  if (rt) rt.abschnitte.forEach(function (a) {
    const pf = function (pts) { return pts.map(function (p, i) { return (i ? 'L' : 'M') + P.px(p[1]).toFixed(1) + ' ' + P.py(p[0]).toFixed(1); }).join(' '); };
    if (a.alternative) kids.push(s('path', { d: pf(a.alternative.pts), class: 'k-strecke-alt' }, s('title', null, a.titel + ': Alternative, ' + a.alternative.km + ' km, ca. ' + a.alternative.min + ' min')));
    kids.push(s('path', { d: pf(a.haupt), class: 'k-strecke' }, s('title', null, a.titel + ' (' + a.bewertung + '): ' + a.km + ' km, ca. ' + a.min + ' min, vermutet')));
    const m = a.haupt[Math.floor(a.haupt.length / 2)], mx = P.px(m[1]), my = P.py(m[0]);
    if (mx > 0 && mx < KW && my > 0 && my < KH) kids.push(s('text', { x: mx + 6, y: my - 6, class: 'k-strecke-tag' }, a.id + ' · ' + a.bewertung));
  });
  /* Zeitfenster-Ringe */
  FL.liste.forEach(function (w) {
    const ll = w.ort && karteKoord(w.ort);
    if (!ll) return;
    const cx = P.px(ll[1]), cy = P.py(ll[0]), r = w.zustand === 'aktiv' ? 26 : 20;
    kids.push(s('circle', { cx: cx, cy: cy, r: r, class: 'k-fenster-fl ' + w.zustand }), s('circle', { cx: cx, cy: cy, r: r, class: 'k-fenster ' + w.zustand }, s('title', null, w.id + ' ' + w.titel + ' (' + w.zustand + ')')));
  });
  /* Markierungen und Verbindungen */
  const marker = karteMarker(), def = karteAuftragsansicht(), pos = {};
  const ci = def && STATE.agent.checkin && STATE.agent.checkin.standortId, zielpersonen = def ? zielpersonenListe() : [];
  /* Markierungen, die sich überdecken, werden auf einem kleinen Kreis aufgefächert; ein Leitstrich führt zur wahren Lage */
  { const gruppen = [];
    marker.forEach(function (m) {
      if (m.kat === 'sichtung') return;
      const x = P.px(m.ll[1]), y = P.py(m.ll[0]);
      if (x < -30 || x > KW + 30 || y < -30 || y > KH + 30) return;
      const g = gruppen.find(function (q) { return Math.abs(q.x - x) < 13 && Math.abs(q.y - y) < 13; });
      if (g) g.m.push(m); else gruppen.push({ x: x, y: y, m: [m] });
    });
    gruppen.forEach(function (g) {
      if (g.m.length < 2) return;
      g.m.sort(function (a, b) { return a.id < b.id ? -1 : 1; });
      g.m.forEach(function (m, i) {
        const w = -Math.PI / 2 + i * 2 * Math.PI / g.m.length, r = 15 + g.m.length * 2;
        m.llV = [P.lat(g.y + Math.sin(w) * r), P.lon(g.x + Math.cos(w) * r)];
        kids.push(s('line', { x1: g.x, y1: g.y, x2: g.x + Math.cos(w) * r, y2: g.y + Math.sin(w) * r, class: 'k-leit' }));
      });
      kids.push(s('circle', { cx: g.x, cy: g.y, r: 1.6, class: 'k-leitpunkt' }));
    });
  }
  marker.forEach(function (m) { if (m.llV) { m.llW = m.ll; m.ll = m.llV; } });             /* Zeichenlage; ll bleibt für Popup und Zentrieren die wahre Lage */
  marker.forEach(function (m) { if (m.entitaet) pos[m.id] = m; });
  if (Z.verbindungen) {
    kantenPool().forEach(function (v) {
      const a = pos[v.von], b = pos[v.nach];
      if (!a || !b) return;
      const x1 = P.px(a.ll[1]), y1 = P.py(a.ll[0]), x2 = P.px(b.ll[1]), y2 = P.py(b.ll[0]);
      if (Math.max(x1, x2) < -20 || Math.min(x1, x2) > KW + 20 || Math.max(y1, y2) < -20 || Math.min(y1, y2) > KH + 20) return;
      if (Math.abs(x1 - x2) + Math.abs(y1 - y2) < 6) return;
      const g = String(v.bewertung || 'F').charAt(0), st = g === 'A' || g === 'B' ? 'stark' : g === 'C' ? 'mittel' : 'schwach';
      const an = K.auswahl === v.id || K.auswahl === v.von || K.auswahl === v.nach;
      const titel = v.typ + ' · ' + bewertungText(bewertungEff(v).code) + ' · ' + anzeige(entitaet(v.von)) + (v.richtung === 'beidseitig' ? ' ↔ ' : ' → ') + anzeige(entitaet(v.nach));
      const gv = s('g', { class: 'k-verbg', 'data-vid': v.id, 'data-von': v.von, 'data-nach': v.nach }, s('title', null, titel),
        s('line', { x1: x1, y1: y1, x2: x2, y2: y2, class: 'k-verb ' + st + (an ? ' an' : '') + (K.auswahl === v.id ? ' sel' : '') }),
        s('line', { x1: x1, y1: y1, x2: x2, y2: y2, class: 'k-verb-hit', 'data-vid': v.id }));
      kids.push(gv);
      if (an || zm >= 12.5) kids.push(s('text', { x: (x1 + x2) / 2, y: (y1 + y2) / 2 - 4, class: 'k-text dim', 'text-anchor': 'middle' }, v.typ + ' ' + bewertungEff(v).code));
    });
  }
  /* Lagezonen: je Standort eine Zone, dazu eigene; Radius in Metern, bewegen sich mit der Karte */
  if (Z.zonen !== false && zm >= 8) {
    const mpx = 40075017 * Math.cos(K.lat * DEG) / P.Wd;
    karteZonen().forEach(function (zn) {
      const x = P.px(zn.ll[1]), y = P.py(zn.ll[0]), r = Math.max(zn.art === 'zugriff' ? 7 : 9, zn.r / mpx);
      if (x < -r || x > KW + r || y < -r || y > KH + r) return;
      const zg = zn.art === 'zugriff', lg = zg || zn.profil ? null : zoneLage(zn), kl = zg ? 'zugriff' : zn.profil ? 'profil' : zoneKlasse(zn, lg), sel = K.auswahl === zn.id, mehr = (K.mehr || []).indexOf(zn.id) >= 0;
      const g = s('g', { class: 'k-zone ' + kl + (zn.auto ? ' auto' : ' eigen') + (sel ? ' sel' : '') + (mehr ? ' mehr' : ''), 'data-id': zn.id },
        s('title', null, zn.profil ? 'Zone ' + zn.name + ' · Radius ' + zn.r + ' m · Stand ' + fmtZ(zn.stand || zn.t) : (zg ? 'Möglicher Zugriffspunkt ' + zn.id : zn.auto ? 'Lagezone ' + zn.standort : 'Zone ' + zn.id + ' ' + zn.name) + ': ' + zoneKurz(zn, lg) + ' · Radius ' + zn.r + ' m'),
        s('circle', { cx: x, cy: y, r: r, class: 'k-zone-fl' }), s('circle', { cx: x, cy: y, r: r, class: 'k-zone-ring' }), s('circle', { cx: x, cy: y, r: r, class: 'k-zone-hit' }));
      if (zg) { g.appendChild(s('line', { x1: x - 5, y1: y, x2: x + 5, y2: y, class: 'k-zone-kreuz' })); g.appendChild(s('line', { x1: x, y1: y - 5, x2: x, y2: y + 5, class: 'k-zone-kreuz' })); }
      if (r >= 16 || sel) g.appendChild(s('text', { x: x, y: zn.auto ? y - r - 5 : y + r + 13, class: 'k-zone-t', 'text-anchor': 'middle' }, zn.profil ? zn.name : zoneKurz(zn, lg)));
      kids.push(g);
    });
  }
  /* Beschriftungen kollisionsfrei: Reihenfolge der Marker, ausgewählter Marker hat Vorrang; verdeckte Namen bleiben im Tooltip und im Popup */
  const belegt = [], gez = {};
  const platz = function (x, y, text, erzwingen) {
    const b = { x1: x, y1: y - 8, x2: x + 6.4 * String(text).length + 4, y2: y + 5 };
    if (!erzwingen && belegt.some(function (o) { return b.x1 < o.x2 && b.x2 > o.x1 && b.y1 < o.y2 && b.y2 > o.y1; })) return false;
    belegt.push(b); return true;
  };
  const reihe = marker.slice().sort(function (a, b2) { return (b2.id === K.auswahl) - (a.id === K.auswahl); });
  reihe.forEach(function (m) {
    const x = P.px(m.ll[1]), y = P.py(m.ll[0]);
    if (x < -20 || x > KW + 20 || y < -20 || y > KH + 20) return;
    const sel = K.auswahl === m.id;
    if (m.kat === 'sichtung') {
      const gs = s('g', { class: 'k-marker' + (m.guete === 'veraltet' ? ' alt' : ''), 'data-id': m.id, tabindex: '0', role: 'button', 'aria-label': 'Sichtung ' + m.name + ', ' + (SCENARIO.guete[m.guete] || {}).label });
      gs.appendChild(s('title', null, 'Sichtung ' + m.id + ' (' + (SCENARIO.guete[m.guete] || {}).label + '): ' + m.name + ' · Lage nach ' + m.genau + ', Position ungefähr'));
      { const mProPx = 40075016.69 * Math.cos(m.ll[0] * DEG) / P.Wd, rpx = Math.max(m.genau === 'Ortschaft' || m.genau === 'Richtung' ? 14 : 9, Math.min(420, m.unM.m / mProPx));
        gs.appendChild(s('circle', { cx: x, cy: y, r: rpx.toFixed(1), class: 'k-unsicher' + (m.guete === 'unbestaetigt' || m.guete === 'widerspruechlich' ? ' stark' : ''), style: 'opacity:' + Math.max(0.4, 1 - Math.min(m.unM.alter.verhaeltnis, 2) * 0.3).toFixed(2) })); }
      gs.appendChild(s('polygon', { points: [x, y - 5.5, x + 5, y + 4, x - 5, y + 4].join(' '), class: 'k-m sichtung' }));
      { const t = m.id + (m.guete !== 'gesichert' ? ' · ' + SCENARIO.guete[m.guete].label : ''); if ((sel || zm >= 8) && platz(x + 9, y + 4, t, sel)) gs.appendChild(s('text', { x: x + 9, y: y + 4, class: 'k-text' }, t)); }
      if (sel) gs.appendChild(s('circle', { cx: x, cy: y, r: 12, class: 'k-sel' }));
      gs.appendChild(s('circle', { cx: x, cy: y, r: 12, class: 'k-treffer' }));
      gez[m.id] = gs;
      return;
    }
    const g = s('g', { class: 'k-marker', 'data-id': m.id, tabindex: '0', role: 'button', 'aria-label': m.id + ' ' + m.name + (m.entitaet ? ', Kurzinfo' : '') });
    g.appendChild(s('title', null, m.id + ' ' + m.name));
    if (m.id === ci && Z.ausgang !== false) { g.appendChild(s('circle', { cx: x, cy: y, r: 10, class: 'k-checkin' })); g.appendChild(s('circle', { cx: x, cy: y, r: 16, class: 'k-checkin aussen' })); }
    if (m.kat === 'zugriff' && m.r) g.appendChild(s('circle', { cx: x, cy: y, r: Math.max(9, m.r / (40075016.69 * Math.cos(m.ll[0] * DEG) / P.Wd)).toFixed(1), class: 'k-zp-ring' }));
    if (m.zusatz) g.appendChild(s('circle', { cx: x, cy: y, r: 9, class: 'k-zusatz' }));
    if (m.entitaet && zielpersonen.indexOf(m.id) >= 0) g.appendChild(s('circle', { cx: x, cy: y, r: 9.5, class: 'k-ziel' }));
    if (sel) g.appendChild(s('circle', { cx: x, cy: y, r: 13, class: 'k-sel' }));
    karteSymbol(m, x, y).forEach(function (e) { g.appendChild(e); });
    g.appendChild(s('circle', { cx: x, cy: y, r: 12, class: 'k-treffer' }));
    if (sel || zm >= 6.5 || m.kat === 'standort') { const t = zm >= 7.5 || sel ? kuerzen(m.name, 24) : m.id; if (platz(x + 10, y + 4, t, sel)) g.appendChild(s('text', { x: x + 10, y: y + 4, class: 'k-text' }, t)); }
    gez[m.id] = g;
  });
  marker.forEach(function (m) { if (gez[m.id]) kids.push(gez[m.id]); });
  /* Messung */
  if (K.messPts && K.messPts.length) {
    const q = K.messPts.map(function (ll) { return [P.px(ll[1]), P.py(ll[0])]; });
    if (q.length === 2) {
      kids.push(s('line', { x1: q[0][0], y1: q[0][1], x2: q[1][0], y2: q[1][1], class: 'k-mess' }));
      const t = karteMessText(K.messPts[0], K.messPts[1]), tx = (q[0][0] + q[1][0]) / 2, ty = (q[0][1] + q[1][1]) / 2;
      kids.push(s('text', { x: tx, y: ty - 8, class: 'k-text k-mess-t', 'text-anchor': 'middle' }, t));
    }
    q.forEach(function (p) { kids.push(s('circle', { cx: p[0], cy: p[1], r: 4, class: 'k-mess-p' })); });
  }
  /* Maßstab, Quellenangabe, Rahmen */
  const kmProPx = 40075.017 * Math.cos(K.lat * DEG) / P.Wd, km = karteSchritt([0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000], 90, 1 / kmProPx), len = km / kmProPx;
  kids.push(s('line', { x1: 16, y1: KH - 18, x2: 16 + len, y2: KH - 18, class: 'k-mass' }), s('text', { x: 16, y: KH - 24, class: 'k-text' }, km < 1 ? Math.round(km * 1000) + ' m' : km + ' km'));
  kids.push(s('text', { x: KW - 12, y: KH - 10, class: 'k-text dim', 'text-anchor': 'end' },
    (kachelnOk ? (K.anbieter === 'osm' ? '© OpenStreetMap-Mitwirkende' : K.anbieter === 'carto' ? '© CARTO © OpenStreetMap-Mitwirkende' : (K.anbieter === 'luftbild' || K.anbieter === 'hybrid') ? 'Luftbild: Geoportal Berlin, TrueDOP 2024' + (KACHEL_VERMERK.length ? ' · ' + KACHEL_VERMERK.join(' · ') : '') + (K.cartoKey ? ' · © CARTO © OSM' : '') : 'Kacheln: eigener Anbieter') + ' · ' : 'Natural Earth · ') + 'Breite ' + K.lat.toFixed(4) + ', Länge ' + K.lon.toFixed(4) + ' · Zoom ' + K.zoom.toFixed(1)));
  const kw = KGRUPPE.wurzel;
  if (kw && kids.indexOf(kw) >= 0) {
    /* Kachelgruppe bleibt im Dokument; alles andere wird ausgetauscht */
    Array.prototype.slice.call(svg.childNodes).forEach(function (n) { if (n !== kw) svg.removeChild(n); });
    let davor = true;
    kids.forEach(function (n) {
      if (n === kw) { davor = false; if (kw.parentNode !== svg) svg.appendChild(kw); return; }
      if (davor && kw.parentNode === svg) svg.insertBefore(n, kw); else svg.appendChild(n);
    });
  } else svg.replaceChildren.apply(svg, kids);
  kartePopupPos();
  karteStatusAkt();
}

/* ---------- Lagezonen ---------- */
function zDef() { return karteOhneMission() ? null : KM(); }
/* Abstand bis zur nächsten Ereignismeldung einer eigenen Zone (Minuten, je nach Bewertung; unruhige Zonen melden häufiger) */
const ZONEN_INTERVALL = { ruhig: [90, 180], leicht: [35, 70], bedroht: [20, 40], akut: [10, 20] };
function zoneNaechste(zn) {
  if (zn.art === 'zugriff') return;   /* Zugriffspunkte haben keine Lageereignisse */
  const I = ZONEN_INTERVALL[zn.wertung] || ZONEN_INTERVALL.ruhig;
  zn.naechste = new Date(Date.now() + (I[0] + Math.random() * (I[1] - I[0])) * 60000).toISOString();
}
/* Kennung der Zone, die jetzt eine Meldung fällig hat (höchstens eine alle 8 Minuten über alle Zonen) */
function zonenFaellig(jetzt) {
  const def = zDef(); if (!def) return null;
  const ev = STATE.zonenEv || {};
  if (ev.letzte && jetzt - Date.parse(ev.letzte) < 8 * 60000) return null;
  const L = zonenEigene(def);
  for (let i = 0; i < L.length; i++) {
    const zn = L[i]; if (zn.auto || zn.art === 'zugriff') continue;
    if (!zn.naechste) { zoneNaechste(zn); continue; }
    if (Date.parse(zn.naechste) <= jetzt) return zn.id;
  }
  return null;
}
const ZUGRIFF_TYPEN = ['Zufahrt', 'Tor', 'Seiteneingang', 'Lieferbereich', 'Dach/Fenster', 'Sichtlücke', 'Sonstiges'], ZUGRIFF_RADIEN = [20, 40, 60, 100, 150];
const PIN_ZWECKE = ['Treffpunkt', 'Beobachtungspunkt', 'Übergabe', 'Unterstand', 'Fluchtweg', 'Parkmöglichkeit', 'Sammelpunkt', 'Sonstiges'];
const PIN_UMGEBUNG = [['zufahrt', 'Zufahrten und Wege'], ['sicht', 'Sichtlinien'], ['flucht', 'Fluchtmöglichkeiten'], ['publikum', 'Publikumsverkehr'], ['kameras', 'Kameras, Beleuchtung'], ['nachbarn', 'Nachbarschaft, Gewerbe']];
function pinEntfernungM(a, b) {
  const R = 6371000, r = Math.PI / 180, dl = (b[0] - a[0]) * r, dn = (b[1] - a[1]) * r;
  const q = Math.sin(dl / 2) * Math.sin(dl / 2) + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dn / 2) * Math.sin(dn / 2);
  return 2 * R * Math.asin(Math.sqrt(q));
}
/* Bekannte Punkte im Umkreis (Standorte, Orte, Personen mit Position, eigene Pins) für das Lageblatt */
function pinNaehe(x, maxM) {
  const L = [];
  try { karteMarker().forEach(function (m) { if (m.id === x.id || !m.ll || m.kat === 'sichtung') return; const d = pinEntfernungM(x.ll, m.ll); if (d <= maxM) L.push({ id: m.id, name: m.name, d: d }); }); } catch (e) { /* ohne Umgebungsdaten */ }
  return L.sort(function (p, q) { return p.d - q.d; }).slice(0, 8);
}
function pinText(x) {
  const z = [x.id + ' ' + x.name, 'Position: ' + x.ll[0].toFixed(5) + ', ' + x.ll[1].toFixed(5), 'Zweck: ' + (x.zwecke && x.zwecke.length ? x.zwecke.join(', ') : 'nicht festgelegt'), ''];
  PIN_UMGEBUNG.forEach(function (u) { z.push(u[1] + ': ' + ((x.umgebung && x.umgebung[u[0]]) || '–')); });
  z.push('', 'Notiz: ' + (x.notiz || '–'), '', 'Angelegt: ' + dtg(new Date(x.t)));
  return z.join('\n');
}
/* Nur Profilobjekte exportieren, ohne abgeleitete Missions- oder Umgebungsdaten. */
function eigeneZoneText(x) {
  return [x.id + ' ' + x.name, 'Position: ' + x.ll[0].toFixed(5) + ', ' + x.ll[1].toFixed(5),
    'Radius: ' + x.r + ' m', 'Notiz: ' + (x.notiz || '–'), 'Stand: ' + fmtZ(x.stand || x.t),
    'Bemerkung zur Prüfung: ' + (x.standBemerkung || '–')].join('\n');
}
function kartenTxtExport(art, id) {
  const objekt = function () { return ((art === 'pin' ? PROFIL.pins : PROFIL.zonen) || []).find(function (x) { return x.id === id; }); };
  const muster = art === 'pin' ? /^PIN-[0-9]{3,15}$/ : /^ZO-[0-9]{3,15}$/;
  const pruefen = function () {
    const x = objekt();
    if (!x || !muster.test(x.id)) { meldung('TXT-Export nicht möglich. Kartenobjekt nicht vorhanden.'); return null; }
    if (x.dossier && (PROFIL.gesperrt || []).includes(x.dossier)) {
      meldung('TXT-Export blockiert. Das verknüpfte Dossier ist gesperrt.'); return null;
    }
    return x;
  };
  const x = pruefen();
  if (!x) return;
  const dateiname = (art === 'pin' ? 'lageblatt-' : 'zone-') + id + '.txt';
  const textVon = function (y) { return (art === 'pin' ? pinText(y) : eigeneZoneText(y)) + '\n'; };
  if (!terminalBrueckenAdresse()) {
    const a = h('a', { download: dateiname }), u = URL.createObjectURL(new Blob([textVon(x)], { type: 'text/plain;charset=utf-8' }));
    a.href = u; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(u); }, 2000);
    meldung('TXT-Download gestartet. Für send die Datei in dokumente oder ops im lokalen Archiv legen.');
    return;
  }
  const ordner = h('select', { id: 'k-txt-ordner' },
    h('option', { value: 'dokumente' }, 'dokumente'), h('option', { value: 'ops' }, 'ops'));
  bestaetigen('Als TXT exportieren', [h('p', { class: 'note' }, dateiname),
    h('div', { class: 'row' }, h('label', { for: 'k-txt-ordner' }, 'Archivordner'), ordner)],
    'TXT speichern', async function () {
      const aktuell = pruefen();
      if (!aktuell) return;
      const schluessel = art + ':' + id + ':' + ordner.value, gemerkt = (PROFIL.exporte || {})[schluessel];
      const antwort = await terminalBruecke('export-txt', null, false, { art: art, id: id, ordner: ordner.value, text: textVon(aktuell), last: gemerkt && gemerkt.name && gemerkt.sha ? { name: gemerkt.name, sha: gemerkt.sha } : null });
      if (antwort.error) { meldung('TXT-Export nicht gespeichert. ' + antwort.error); return; }
      if (antwort.sha256 && antwort.mode !== 'unveraendert') dispatch({ type: 'EXPORT_VERMERKT', schluessel: schluessel, name: antwort.name, sha: antwort.sha256 });
      const ziel = '/' + TERMINAL_DB + '/' + antwort.folder + '/' + antwort.name;
      meldung(antwort.mode === 'ersetzt' ? 'TXT ersetzt · ' + ziel : antwort.mode === 'unveraendert' ? 'TXT unverändert, keine neue Datei · ' + ziel
        : antwort.mode === 'version' ? 'Vorhandene Datei wurde nicht ersetzt, da sie verändert wurde. Neue Version gespeichert · ' + ziel : 'TXT gespeichert · ' + ziel);
    });
}
function pinFormular(x, ab, mitDossier) {
  return h('div', { class: 'pin-form' }, h('label', { for: 'pin-name' }, 'Name'), h('input', { type: 'text', id: 'pin-name', maxlength: '60', value: x.name, onchange: function (ev) { ab({ name: ev.target.value }); } }),
      h('span', { class: 'pin-kopf' }, 'Zweck (mehrere möglich)'),
      h('div', { class: 'pin-zwecke' }, PIN_ZWECKE.map(function (z) {
        const hat = (x.zwecke || []).indexOf(z) >= 0;
        return h('label', { class: 'pin-chip' + (hat ? ' an' : '') }, h('input', { type: 'checkbox', 'data-pin-zweck': z, checked: hat, onchange: function () { ab({ zwecke: PIN_ZWECKE.filter(function (y) { return y === z ? !hat : (x.zwecke || []).indexOf(y) >= 0; }) }); } }), h('span', null, z));
      })),
      PIN_UMGEBUNG.map(function (u) { return [h('label', { for: 'pin-u-' + u[0] }, u[1]), h('input', { type: 'text', id: 'pin-u-' + u[0], maxlength: '300', value: (x.umgebung && x.umgebung[u[0]]) || '', onchange: function (ev) { const o = {}; o[u[0]] = ev.target.value; ab({ umgebung: o }); } })]; }),
      mitDossier ? [h('label', { for: 'pin-dossier' }, 'Dossier'), h('select', { id: 'pin-dossier', 'aria-label': 'Dossier zum Pin', onchange: function (ev) { ab({ dossier: ev.target.value || null }); karteNeuZeichnen(); } },
        [h('option', { value: '' }, 'keines')].concat(dossierOptionen(x.dossier)))] : null,
      h('label', { for: 'pin-notiz' }, 'Notiz'), h('textarea', { id: 'pin-notiz', rows: '3', maxlength: '1500', onchange: function (ev) { ab({ notiz: ev.target.value }); } }, x.notiz || ''));
}
function pinPopup(x, fertig) {
  const K = VIEW.karte, ab = function (patch) { dispatch(Object.assign({ type: 'PIN_GEAENDERT', id: x.id }, patch)); karteNeuZeichnen(); };
  const n = pinNaehe(x, 1000);
  fertig(x.name, [   /* die interne Kennung PIN-nnn bleibt verborgen; sie dient nur den Verweisen */
    h('p', { class: 'k-pop-sub' }, x.ll[0].toFixed(5) + ', ' + x.ll[1].toFixed(5)),
    pinFormular(x, ab, true),
    h('p', { class: 'k-pop-meta' }, n.length ? 'In der Nähe: ' + n.map(function (q) { return q.id + ' ' + kuerzen(q.name, 24) + ' (' + Math.round(q.d) + ' m)'; }).join('; ') : 'Keine bekannten Punkte im Umkreis von 1 km.'),
    h('div', { class: 'k-pop-akt' },
      h('button', { type: 'button', class: 'link', id: 'pin-zentrum', onclick: function () { karteFlug(x.ll[0], x.ll[1], Math.max(K.zoom, 16.5), karteAuswahlAnzeige, x.id); } }, 'Zentrieren'),
      h('button', { type: 'button', class: 'link', id: 'pin-export', title: 'Lageblatt als Textdatei speichern', onclick: function () { kartenTxtExport('pin', x.id); } }, 'Als TXT exportieren'),
      VIEW.draft['pin-weg'] === x.id ? h('button', { type: 'button', id: 'pin-weg-ja', onclick: function () { delete VIEW.draft['pin-weg']; K.auswahl = null; dispatch({ type: 'PIN_ENTFERNT', id: x.id }); } }, 'Wirklich entfernen')
        : h('button', { type: 'button', class: 'link', id: 'pin-weg', onclick: function () { VIEW.draft['pin-weg'] = x.id; karteAuswahlAnzeige(); } }, 'Entfernen'))]);
}
function naechsterRadius(liste, w) { return liste.reduce(function (b, r) { return Math.abs(r - w) < Math.abs(b - w) ? r : b; }, liste[0]); }
function zonenEigene(def) { const ms = def ? MS(def.id) : null; if (!ms) return []; if (!ms.zonen) ms.zonen = []; return ms.zonen; }
function zonenUrteil(def) { const ms = def ? MS(def.id) : null; if (!ms) return {}; if (!ms.zonenUrteil) ms.zonenUrteil = {}; return ms.zonenUrteil; }
/* wirksame Stufe einer Standortzone: eigene, freigegebene Einstufung vor der berechneten */
function zoneStufe(zn, lg) { return zn.auto && zn.urteil && zn.urteil.stufe != null && zn.urteil.status === 'frei' ? zn.urteil.stufe : lg.stufe; }
function zielpersonenListe() {
  const def = zDef(), ms = def ? MS(def.id) : null;
  if (!ms) return [];
  if (!ms.zielpersonen) ms.zielpersonen = (def.zielpersonen || []).slice();
  return ms.zielpersonen;
}
function istZielperson(e) { return zielpersonenListe().indexOf(e.id) >= 0; }
function karteZonen(def = karteAuftragsansicht()) {
  const out = [];
  if (def) {
    const Z = SCENARIO.zonen, sz = (SCENARIO.karte && SCENARIO.karte.zonen) || {};
    def.standorte.forEach(function (st) {
      const ll = karteKoord(st.id);
      const u = zonenUrteil(def)['ZA-' + st.id] || null;
      if (ll) out.push({ id: 'ZA-' + st.id, auto: true, standort: st.id, name: st.name, ll: ll, r: (u && u.r) || (sz[st.id] && sz[st.id].r) || Z.radiusStandard, urteil: u });
    });
    zonenEigene(def).forEach(function (zn) { out.push(Object.assign({ auto: false }, zn)); });
  }
  /* Eigene Zonen des Profils (ZO-nnn): unabhängig vom Auftrag, ohne Bewertung, Zeitgeber und Meldungen */
  (PROFIL.zonen || []).forEach(function (zn) { out.push(Object.assign({}, zn, { auto: false, profil: true, art: 'ort' })); });
  return out;
}
function karteZoneFinden(id, def) { return id ? (karteZonen(def).find(function (x) { return x.id === id; }) || null) : null; }
function zonePositionen(e) {
  const out = [], ll = karteKoord(e.id);
  if (ll) out.push(ll);
  const d = STATE.dossiers.entitaeten[e.id];
  ((d && d.sichtungen) || []).forEach(function (si) {
    if (frische('E', si.t).stufe === 'veraltet') return;
    const k = sichtungKoord(si);
    if (k) out.push(k.ll);
  });
  return out;
}
/* Lage einer Zone: höchste Bewertung der Dossiers im Bereich, offene Zeitfenster, Sichtungen der letzten 24 Stunden, Zielpersonen */
function zoneLage(zn) {
  const ents = pool().filter(function (e) {
    if (wissen(e) === 'unbekannt') return false;
    if (zn.abwesend && zn.abwesend[e.id] && Date.now() - Date.parse(zn.abwesend[e.id]) < 43200000) return false;
    const d = STATE.dossiers.entitaeten[e.id];
    if (!zn.auto && d && (d.sichtungen || []).some(function (si) { return si.zone === zn.id && frische('E', si.t).stufe !== 'veraltet'; })) return true;
    return zonePositionen(e).some(function (ll) { return karteDistanz(ll, zn.ll) * 1000 <= zn.r + 100; });
  });
  const ortId = zn.auto ? (/\bL-\d{4}\b/.exec(zn.name) || [null])[0] : null;
  if (ortId && !ents.some(function (e) { return e.id === ortId; })) { const oe = entitaet(ortId); if (oe && wissen(oe) !== 'unbekannt') ents.push(oe); }
  let top = null;
  ents.forEach(function (e) { const b = bedrohung(e); if (!top || b.stufe > top.stufe) top = { stufe: b.stufe, e: e }; });
  const orte = ents.filter(function (e) { return e.typ === 'Ort'; }).map(function (e) { return e.id; }).concat(zn.auto ? [zn.standort] : []);
  const def = zDef(), fenster = karteFenster(PROFIL.karteBlanko ? null : def).filter(function (w) { return w.ort && orte.indexOf(w.ort) >= 0 && w.zustand !== 'abgelaufen'; });
  const si = karteMarker().filter(function (m) { return m.kat === 'sichtung' && karteDistanz(m.ll, zn.ll) * 1000 <= zn.r + 100; });
  const zp = zielpersonenListe();
  const sts = def ? def.standorte.filter(function (st) { const ll = karteKoord(st.id); return ll && karteDistanz(ll, zn.ll) * 1000 <= zn.r + 100; }).map(function (st) { return st.id; }) : [];
  return { standorte: sts, ents: ents, personen: ents.filter(function (e) { return e.typ !== 'Ort'; }), stufe: top ? top.stufe : null, quelle: top ? top.e : null, fenster: fenster, sichtungen: si.length,
           ziel: ents.filter(function (e) { return zp.indexOf(e.id) >= 0; }), asset: ents.some(function (e) { return karteAssetId(e); }) };
}
/* Bezug zum Auftrag: Zielperson oder Standort des Auftrags liegt in der Zone; nur dann ist eine Meldung an den Ansprechpartner sinnvoll */
function zoneBezug(lg) {
  return lg.ziel.map(function (e) { return 'Zielperson ' + anzeige(e); }).concat(lg.standorte.map(function (id) { return 'Standort ' + id; }));
}
function zoneHandlerName() { return (kanalDef('handler') || {}).gegenstelle || 'ARGUS'; }
function zoneKlasse(zn, lg) {
  if (!zn.auto) return zn.wertung === 'akut' ? 'akut' : zn.wertung === 'bedroht' ? 'bedroht' : zn.wertung === 'leicht' ? 'leicht' : 'ruhig';
  const st = zoneStufe(zn, lg);
  return st == null || st <= 2 ? 'ruhig' : st === 3 ? 'leicht' : 'akut';
}
/* Frische einer selbst gesetzten Einstufung: akute Lagen veralten am schnellsten (24 h), leichte nach 72 h, ruhige nach 7 Tagen */
function zoneFrische(zn) {
  if (zn.auto) { const u = zn.urteil; if (!u || u.status !== 'frei' || u.stufe == null || !u.t) return null; return frische(u.stufe >= 4 ? 'E' : u.stufe === 3 ? 'D' : 'B', u.t); }
  const t = zn.stand || zn.t;
  return t ? frische(zn.wertung === 'akut' ? 'E' : zn.wertung === 'bedroht' || zn.wertung === 'leicht' ? 'D' : 'B', t) : null;
}
function zoneKurz(zn, lg) {
  if (zn.art === 'zugriff') return zn.id + ' · Zugriff' + (zn.typen && zn.typen.length ? ': ' + zn.typen.join(', ') : '');
  const fr = zoneFrische(zn), alt = fr && fr.stufe === 'veraltet' ? ' · veraltet' : '';
  if (!zn.auto) return zn.id + ' · ' + SCENARIO.zonen.wertungen[zn.wertung] + alt;
  const st = zoneStufe(zn, lg);
  return zn.standort + ' · ' + (st == null ? 'ohne Bewertung' : 'Stufe ' + st) + (zn.urteil && zn.urteil.status === 'frei' ? ' (eigen)' : '') + alt;
}
/* ---------- Sonne, Licht und Wetter ----------
   Sonnenstand und Zeiten werden offline berechnet (NOAA-Näherung, Genauigkeit etwa eine Minute; Brechung der Atmosphäre ist über -0,833 Grad
   berücksichtigt). Das Wetter ist dauerhaft aktiv (Open-Meteo, CC BY 4.0, nicht-kommerzielle Nutzung): je Kartenmitte (auf 0,1 Grad
   gerundet) höchstens eine Abfrage in 15 Minuten, nie öfter als alle 8 Sekunden. */
function sonneHoehe(lat, lon, t) {
  const n = t / 86400000 + 2440587.5 - 2451545.0, rad = Math.PI / 180;
  const L = (280.460 + 0.9856474 * n) % 360, g = ((357.528 + 0.9856003 * n) % 360) * rad;
  const lam = (L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * rad, eps = (23.439 - 0.0000004 * n) * rad;
  const ra = Math.atan2(Math.cos(eps) * Math.sin(lam), Math.cos(lam)), dek = Math.asin(Math.sin(eps) * Math.sin(lam));
  const gmst = (18.697374558 + 24.06570982441908 * n) % 24, ha = ((gmst * 15 + lon) * rad) - ra;
  const phi = lat * rad;
  return Math.asin(Math.sin(phi) * Math.sin(dek) + Math.cos(phi) * Math.cos(dek) * Math.cos(ha)) / rad;
}
/* Aufgang, Untergang und bürgerliche Dämmerung für den Tag um t (Sonnenkulmination in der Nähe); null bei Polartag oder Polarnacht */
function sonneTag(lat, lon, t) {
  const rad = Math.PI / 180, jd = t / 86400000 + 2440587.5;
  const n = Math.round(jd - 2451545.0 + 0.0008 + lon / 360), Js = n - lon / 360;   /* Tageszähler und mittlere Kulmination (Länge Ost positiv) */
  const M = ((357.5291 + 0.98560028 * Js) % 360) * rad;
  const C = 1.9148 * Math.sin(M) + 0.0200 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M);
  const lam = ((M / rad + C + 180 + 102.9372) % 360) * rad;
  const Jt = 2451545.0 + Js + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * lam);
  const sd = Math.sin(lam) * Math.sin(23.4397 * rad), cd = Math.cos(Math.asin(sd)), phi = lat * rad;
  const zeit = function (h0) {
    const c = (Math.sin(h0 * rad) - Math.sin(phi) * sd) / (Math.cos(phi) * cd);
    if (c < -1 || c > 1) return null;
    const w = Math.acos(c) / rad / 360;
    return { auf: (Jt - w - 2440587.5) * 86400000, unter: (Jt + w - 2440587.5) * 86400000 };
  };
  return { sonne: zeit(-0.833), buerger: zeit(-6) };
}
function lichtPhase(el) { return el > -0.833 ? 'Tag' : el > -6 ? 'bürgerliche Dämmerung' : el > -12 ? 'nautische Dämmerung' : 'Nacht'; }
function lichtText(lat, lon, t) {
  const el = sonneHoehe(lat, lon, t), d = sonneTag(lat, lon, t), hm = function (ms) { return fmtZ(new Date(ms).toISOString()).slice(11, 16) + 'Z'; };
  const zeiten = d.sonne ? 'Aufgang ' + hm(d.sonne.auf) + ' · Untergang ' + hm(d.sonne.unter) : (el > 0 ? 'Polartag' : 'Polarnacht');
  return lichtPhase(el) + ' · ' + zeiten;
}
const WMO_TEXT = { 0: 'klar', 1: 'überwiegend klar', 2: 'teils bewölkt', 3: 'bedeckt', 45: 'Nebel', 48: 'Reifnebel', 51: 'leichter Nieselregen', 53: 'Nieselregen', 55: 'starker Nieselregen', 56: 'gefrierender Nieselregen', 57: 'gefrierender Nieselregen',
  61: 'leichter Regen', 63: 'Regen', 65: 'starker Regen', 66: 'gefrierender Regen', 67: 'gefrierender Regen', 71: 'leichter Schneefall', 73: 'Schneefall', 75: 'starker Schneefall', 77: 'Schneegriesel',
  80: 'leichte Regenschauer', 81: 'Regenschauer', 82: 'heftige Regenschauer', 85: 'Schneeschauer', 86: 'heftige Schneeschauer', 95: 'Gewitter', 96: 'Gewitter mit Hagel', 99: 'schweres Gewitter mit Hagel' };
const WETTER = { cache: {}, laufend: false, zuletzt: 0 };
function windRichtung(grad) { return ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'][Math.round(((grad % 360) + 360) % 360 / 45) % 8]; }
function wetterStand(lat, lon) {
  if (!VIEW.karte.wetter || typeof fetch !== 'function') return null;
  if (VIEW.karte.ebenen && VIEW.karte.ebenen.kacheln === false) return { offline: true };      /* Offline: keine externe Abfrage, auch nicht beim Zentrieren */
  const key = lat.toFixed(1) + ',' + lon.toFixed(1), c = WETTER.cache[key], jetzt = Date.now();
  if (c && jetzt - c.t < 15 * 60000) return c;
  if (!WETTER.laufend && jetzt - WETTER.zuletzt > 8000) {
    WETTER.laufend = true; WETTER.zuletzt = jetzt;
    fetch('https://api.open-meteo.com/v1/forecast?latitude=' + (+lat.toFixed(1)) + '&longitude=' + (+lon.toFixed(1)) + '&current=temperature_2m,precipitation,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m,visibility&wind_speed_unit=kmh&timezone=UTC')
      .then(function (r) { if (!r.ok) throw new Error('http'); return r.json(); })
      .then(function (j) { WETTER.cache[key] = { t: Date.now(), c: j.current }; })
      .catch(function () { WETTER.cache[key] = { t: Date.now(), fehler: true }; })
      .then(function () { WETTER.laufend = false; karteStatusAkt(); });
  }
  else if (!WETTER.retry) {                                /* gesperrt (laufende oder zu junge Abfrage): einmal nachfassen, damit der aktuelle Bezugspunkt nicht dauerhaft auf „wird abgerufen“ bleibt */
    WETTER.retry = setTimeout(function () { WETTER.retry = null; karteStatusAkt(); }, Math.max(1000, 8200 - (jetzt - WETTER.zuletzt)));
  }
  return c || { laden: true };
}
function wetterText(w) {
  if (!w) return '–';
  if (w.offline) return 'Offline, keine Abfrage';
  if (w.laden) return 'wird abgerufen …';
  if (w.fehler || !w.c) return 'nicht erreichbar';
  const c = w.c, sicht = c.visibility != null ? (c.visibility >= 10000 ? ' · Sicht ' + Math.round(c.visibility / 1000) + ' km' : ' · Sicht ' + (c.visibility / 1000).toFixed(1).replace('.', ',') + ' km') : '';
  return Math.round(c.temperature_2m) + ' °C, ' + (WMO_TEXT[c.weather_code] || 'Wettercode ' + c.weather_code) + ' · Wind ' + Math.round(c.wind_speed_10m) + ' km/h ' + windRichtung(c.wind_direction_10m)
    + (c.wind_gusts_10m > c.wind_speed_10m + 15 ? ', Böen ' + Math.round(c.wind_gusts_10m) : '') + (c.precipitation > 0 ? ' · Niederschlag ' + String(c.precipitation).replace('.', ',') + ' mm' : '') + sicht + ' · ' + String(c.time || '').slice(11, 16) + 'Z';
}
/* Objektkontext der Lage-Box: Kennung des Objekts, auf das gezielt gesprungen wurde (Zone, Pin, Sichtung, Dossierort, Ausgangsort). */
function karteBezugVon(id) {
  if (!id) return null;
  const zn = typeof karteZoneFinden === 'function' ? karteZoneFinden(id) : null;
  if (zn) return { id: id, typ: zn.art === 'zugriff' ? 'Zugriffspunkt' : 'Zone', name: zn.profil ? zn.name : (zn.name || zn.id), ll: zn.ll, stand: zn.profil ? (zn.stand || zn.t) : null, filter: !!zn.profil };
  const pn = (PROFIL.pins || []).find(function (x) { return x.id === id; });
  if (pn && pn.ll) return { id: id, typ: 'Pin', name: pn.name, ll: pn.ll, stand: null, filter: true };
  const ao = (PROFIL.ausgang || []).find(function (x) { return x.id === id; });
  if (ao && ao.ll) return { id: id, typ: 'Ausgangsort', name: ao.name, ll: ao.ll, stand: null, filter: false };
  const m = karteMarker().find(function (x) { return x.id === id; });
  if (m && m.ll) return { id: id, typ: m.kat === 'sichtung' ? 'Sichtung' : 'Standort', name: m.name || id, ll: m.ll, stand: null, filter: false };
  const e = entitaet(id), ll = e && !infoGesperrt(e) && !dossierGesperrt(e) ? karteKoord(id) : null;
  if (ll) return { id: id, typ: 'Dossier ' + e.typ, name: e.name, ll: ll, stand: null, filter: false };
  return null;
}
function karteBezugSetzen(id) {
  const K = VIEW.karte;
  K.bezug = id && karteBezugVon(id) ? id : null;
  if (K.bezug) K.statusOffen = true;
  karteStatusAkt();                                   /* Anzeige sofort aktualisieren, auch im 3D-Pfad ohne eigenes Neuzeichnen */
}
function karteStatusAkt() {
  const box = $('k-status');
  if (!box) return;
  const K = VIEW.karte;
  const bz = K.bezug ? karteBezugVon(K.bezug) : null;
  if (K.bezug && !bz) K.bezug = null;
  const ref = bz ? bz.ll : [K.lat, K.lon];
  const zeile = function (k, v, id) { return h('div', { class: 'k-st-z' }, h('span', { class: 'k-st-k' }, k), h('span', { class: 'k-st-v', id: id }, v)); };
  const kurz = bz ? bz.typ + ' · ' + bz.name : 'Kartenmitte';
  const zeilen = [];
  if (bz) {
    zeilen.push(zeile('Objekt', bz.typ + ' · ' + bz.name, 'k-st-objekt'), zeile('Position', bz.ll[0].toFixed(5) + ', ' + bz.ll[1].toFixed(5), 'k-st-pos'));
    if (bz.stand) zeilen.push(zeile('Stand', fmtZ(bz.stand), 'k-st-stand'));
    if (bz.filter) zeilen.push(h('div', { class: 'k-st-z' }, h('button', { type: 'button', class: 'link', id: 'k-st-protokoll', onclick: function () { K.kpObjekt = bz.id; K.kpFilter = ''; K.reiter = 'protokoll'; renderModule(); } }, 'Protokoll öffnen')));
  } else zeilen.push(zeile('Position', 'Kartenmitte ' + K.lat.toFixed(3) + ', ' + K.lon.toFixed(3), 'k-st-pos'));
  zeilen.push(zeile('Licht', lichtText(ref[0], ref[1], Date.now()), 'k-st-licht'));
  if (K.wetter) zeilen.push(zeile('Wetter', wetterText(wetterStand(ref[0], ref[1])), 'k-st-wetter'));
  box.classList.toggle('offen', !!K.statusOffen);
  box.replaceChildren.apply(box, [h('button', { type: 'button', class: 'k-st-kopf', id: 'k-st-t', 'aria-expanded': K.statusOffen ? 'true' : 'false', title: 'Lage am ausgewählten Objekt oder an der Kartenmitte ein- oder ausklappen', onclick: function () { K.statusOffen = !K.statusOffen; karteStatusAkt(); } },
      h('span', null, 'LAGE'), h('span', { class: 'k-st-kurz' }, kurz), h('span', { class: 'k-eb-pfeil' }, K.statusOffen ? '▴' : '▾')),
    K.statusOffen ? h('div', { class: 'k-st-body' }, zeilen) : null].filter(Boolean));
}
function karteFensterListe() {
  const wrap = $('k-fenster');
  if (!wrap) return;
  const liste = karteFenster(), K = VIEW.karte, T = Date.now() + K.dt * 3600000;
  wrap.replaceChildren(tabelle(['ID', 'Fenster', 'Ort', 'Zustand'], liste.map(function (w) {
    const lbl = w.zustand === 'aktiv' ? 's-accent' : w.zustand === 'ausstehend' ? 's-warn' : 's-dim';
    const rest = w.zustand === 'aktiv' ? 'noch ' + dauerText((w.bis - T) / 60000) : w.zustand === 'ausstehend' ? 'in ' + dauerText((w.von - T) / 60000) : 'seit ' + dauerText((T - w.bis) / 60000);
    const ll = (w.ort && karteKoord(w.ort)) || [K.lat, K.lon], p1 = lichtPhase(sonneHoehe(ll[0], ll[1], w.von)), p2 = lichtPhase(sonneHoehe(ll[0], ll[1], w.bis));
    return [td('nw', w.id), td('txt', [w.titel + ' (' + fmtZ(w.von).slice(0, 16) + 'Z bis ' + fmtZ(w.bis).slice(0, 16) + 'Z)', h('span', { class: 'dim' }, ' · Licht: ' + (p1 === p2 ? p1 : p1 + ' → ' + p2))]),
      w.ort && karteKoord(w.ort) ? h('button', { type: 'button', class: 'link', onclick: function () { karteWaehlen(w.ort, true); } }, w.ort) : td('dim', 'ohne Ort'),
      td('nw', [h('span', { class: 'label ' + lbl }, w.zustand), ' ' + rest])];
  }), 'Keine Zeitfenster.'));
  const z = $('k-zeit');
  if (z) z.textContent = (K.dt === 0 ? 'jetzt' : (K.dt > 0 ? '+' : '−') + Math.abs(K.dt) + ' h') + ' · ' + fmtZ(T).slice(0, 16) + 'Z';
}
/* Popup per Titelleiste verschieben (gilt bis zur nächsten Auswahl); verschiebt nur das Fenster, nie das Objekt */
function kartePopupZiehbar(kopf, box) {
  kopf.addEventListener('pointerdown', function (ev) {
    if (ev.button > 0 || (ev.target.closest && ev.target.closest('button'))) return;
    const K = VIEW.karte, v0 = K.popupVersatz || { x: 0, y: 0 }, x0 = ev.clientX, y0 = ev.clientY;
    try { kopf.setPointerCapture(ev.pointerId); } catch (e) { /* ohne Capture */ }
    const bew = function (e2) { K.popupVersatz = { x: v0.x + e2.clientX - x0, y: v0.y + e2.clientY - y0 }; box.style.translate = K.popupVersatz.x + 'px ' + K.popupVersatz.y + 'px'; };
    const ende = function () { kopf.removeEventListener('pointermove', bew); kopf.removeEventListener('pointerup', ende); kopf.removeEventListener('pointercancel', ende); };
    kopf.addEventListener('pointermove', bew); kopf.addEventListener('pointerup', ende); kopf.addEventListener('pointercancel', ende);
    ev.preventDefault();
  });
}
function kartePopupPos() {
  const box = $('k-auswahl'), K = VIEW.karte;
  if (box) box.style.translate = K.popupVersatz ? K.popupVersatz.x + 'px ' + K.popupVersatz.y + 'px' : '';
  if (box && K.ansicht3d) { if (box.hidden) return; box.style.visibility = 'visible'; box.style.left = 'auto'; box.style.right = '64px'; box.style.top = '64px'; box.style.transform = 'none'; return; }
  if (box) { box.style.right = ''; box.style.transform = ''; }
  const ref = K.auswahl || (K.mehr && K.mehr.length ? K.mehr[K.mehr.length - 1] : null);   /* Mehrfachauswahl: Popup an der zuletzt gewählten Zone */
  if (!box || box.hidden || !ref) return;
  let ll = null;
  const m = karteMarker().find(function (x) { return x.id === ref; });
  if (m) ll = m.ll;
  else if (karteZoneFinden(ref)) ll = karteZoneFinden(ref).ll;
  else {
    const v = kantenPool().find(function (x) { return x.id === ref; });
    const a = v && karteKoord(v.von), b = v && karteKoord(v.nach);
    if (a && b) ll = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  }
  if (!ll) { box.style.visibility = 'hidden'; return; }
  const P = karteProj(), x = P.px(ll[1]), y = P.py(ll[0]);
  if (x < 0 || x > KW || y < 0 || y > KH) { box.style.visibility = 'hidden'; return; }
  box.style.visibility = 'visible';
  box.style.left = (x / KW * 100).toFixed(2) + '%'; box.style.top = (y / KH * 100).toFixed(2) + '%';
  box.classList.toggle('links', x > KW * 0.58); box.classList.toggle('unten', y > KH * 0.5);
}
function karteAuswahlAnzeige() {
  const box = $('k-auswahl'), id = VIEW.karte.auswahl;
  if (!box) return;
  const zu = h('button', { type: 'button', class: 'link k-pop-x', id: 'k-pop-x', 'aria-label': 'Schließen', onclick: function () { karteWaehlen(null, false); } }, '×');
  const fertig = function (kopf, nodes) { box.hidden = false; const kk = h('div', { class: 'k-pop-kopf', title: 'Zum Verschieben ziehen' }, h('strong', null, kopf), zu); kartePopupZiehbar(kk, box); box.replaceChildren(kk, h('div', { class: 'k-pop-body' }, nodes)); kartePopupPos(); };
  if (VIEW.karte.mehr && VIEW.karte.mehr.length) { zonenMehrPanel(fertig); return; }
  if (!id) { box.hidden = true; box.replaceChildren(); return; }
  const v = kantenPool().find(function (x) { return x.id === id; });
  if (v) {
    const a = entitaet(v.von), b = entitaet(v.nach);
    fertig('Verbindung ' + v.id, [h('dl', { class: 'fields' }, feld('Art', v.typ), feld('Richtung', v.richtung === 'beidseitig' ? 'beidseitig' : 'gerichtet'), feld('Bewertung', [bewertungAnzeige(v)]), feld('Stand', bewertungEff(v).fr.text + ' (' + bewertungEff(v).fr.stufe + ')'), feld('Quelle', v.quelle || '–', 'full')),
      h('div', { class: 'k-pop-akt' }, dossierLink(a, 'Karte', 'k-dl-' + a.id), dossierLink(b, 'Karte', 'k-dl-' + b.id),
        h('button', { type: 'button', class: 'link', id: 'k-kante-best', title: 'Bestätigt, dass die Verbindung weiterhin besteht (setzt den Stand zurück)', onclick: function () { dispatch({ type: 'KANTE_BESTAETIGT', id: v.id }); } }, 'Bestand bestätigen'))]);
    return;
  }
  const pin = (PROFIL.pins || []).find(function (y) { return y.id === id; });
  if (pin) { pinPopup(pin, fertig); return; }
  const zn = karteZoneFinden(id);
  if (zn) { zonePopup(zn, fertig); return; }
  const m = karteMarker().find(function (x) { return x.id === id; });
  if (!m) { box.hidden = true; box.replaceChildren(); return; }
  if (m.kat === 'sichtung') {
    const e0 = entitaet(m.entId), pinX = sichtungPin(m.si);
    fertig('Sichtung ' + m.id, [h('dl', { class: 'fields' }, feld('Dossier', e0 ? dossierLink(e0, 'Karte', 'k-dl-' + e0.id) : m.entId), feld('Zeit', fmtZ(m.si.t)), feld('Ort laut Meldung', m.si.ort || '–'),
      feld('Güte', gueteLabel(m.guete)), feld('Lage', 'Position ungefähr, abgeleitet aus ' + m.genau + (m.bez ? ' (' + m.bez + ')' : '') + '. Der gestrichelte Ring zeigt die Unschärfe: derzeit etwa ' + m.unM.m + ' m Radius, wachsend mit dem Alter der Sichtung (' + (m.unM.alter.text || 'jetzt') + ').', 'full'),
      feld('Beobachtung', m.si.text || '–', 'full')),
      h('div', { class: 'pin-form' }, h('label', { for: 'si-bewerten' }, 'Bewertung'), h('select', { id: 'si-bewerten', 'aria-label': 'Güte der Sichtung', onchange: function (ev) { dispatch({ type: 'SICHTUNG_BEWERTET', id: m.entId, sid: m.si.id, guete: ev.target.value }); karteNeuZeichnen(); } },
        ['unbewertet', 'gesichert', 'plausibel', 'unbestaetigt'].map(function (g) { return h('option', { value: g, selected: (m.si.guete || 'unbewertet') === g }, SCENARIO.guete[g].label + ' (' + SCENARIO.guete[g].text + ')'); }))),
      pinX ? [h('h3', null, 'Aus Entwurf ' + pinX.name), pinFormular(pinX, function (patch) { dispatch(Object.assign({ type: 'PIN_GEAENDERT', id: pinX.id }, patch)); karteNeuZeichnen(); }, false)] : null]);
    return;
  }
  const e = m.entitaet ? entitaet(m.id) : null, w = karteFenster().filter(function (x) { return x.ort === m.id; });
  if (e) {
    const d = STATE.dossiers.entitaeten[e.id], vs = verbindungenVon(e.id), kurz = schutz(String(e.rolle || '').split(/(?<=\.)\s/)[0]);
    fertig(e.name, [h('p', { class: 'k-pop-sub' }, e.typ + (m.asset ? ' · Kontakt vor Ort' : '') + (istBeispiel(e) ? ' · Beispiel' : '') + (d && d.status ? ' · ' + statusDef(d.status).label : '')),
      h('p', { class: 'k-pop-text' }, kurz),
      h('p', { class: 'k-pop-meta' }, vs.length + ' Verbindung(en) · ' + ((d && d.sichtungen) || []).length + ' Sichtung(en)' + (w.length ? ' · Fenster ' + w.map(function (x) { return x.id + ' (' + x.zustand + ')'; }).join(', ') : '')),
      h('div', { class: 'k-pop-akt' }, dossierLink(e, 'Karte', 'k-dl-' + e.id), h('button', { type: 'button', class: 'link', id: 'k-pop-zentrum', onclick: function () { karteWaehlen(e.id, true); } }, 'Zentrieren'),
        h('button', { type: 'button', class: 'link', id: 'k-pop-messen', onclick: function () { VIEW.karte.messen = true; VIEW.karte.messPts = [m.ll]; renderModule(); } }, 'Messen ab hier'))]);
    return;
  }
  if (m.kat === 'zugriff' && m.zp && LM()) {
    const def = LM(), f = zpFelder(def, m.zp, 'zpp-'), bz = m.zp.bezug ? entitaet(m.zp.bezug) : null;
    fertig(m.zp.typ + ' ' + m.id, [h('div', { class: 'pin-form' },
      h('label', { for: 'zpp-typ-' + m.id }, 'Art'), f[0], h('label', { for: 'zpp-r-' + m.id }, 'Radius'), f[1], h('label', { for: 'zpp-bz-' + m.id }, 'Dossier'), f[2], h('label', { for: 'zpp-tx-' + m.id }, 'Notiz'), f[3]),
      h('p', { class: 'k-pop-meta' }, m.ll[0].toFixed(4) + ', ' + m.ll[1].toFixed(4)),
      h('div', { class: 'k-pop-akt' }, bz ? dossierLink(bz, 'Karte', 'k-dl-' + bz.id) : null,
        h('button', { type: 'button', class: 'link', id: 'zpp-verschieben', onclick: function () { VIEW.karte.pick = m.id; VIEW.karte.auswahl = null; renderModule(); } }, 'Verschieben'),
        h('button', { type: 'button', class: 'link', id: 'zpp-weg', onclick: function () { dispatch({ type: 'ZUGRIFF_ENTFERNT', id: m.id }); VIEW.karte.auswahl = null; renderModule(); } }, 'Entfernen'))]);
    return;
  }
  fertig(m.name, [h('dl', { class: 'fields' }, feld('Kennung', m.id), feld('Art', m.kat === 'ausgang' ? 'Ausgangsort (privat)' : m.kat === 'standort' ? 'Standort des Auftrags' : m.kat === 'zugriff' ? 'Zugriffspunkt' : '–'),
    feld('Staat', m.land ? [land(m.land), ' ' + (SCENARIO.laender[m.land] || '')] : '–'), feld('Koordinaten (ungefähr)', m.ll[0].toFixed(4) + ', ' + m.ll[1].toFixed(4)),
    w.length ? feld('Zeitfenster', w.map(function (x) { return x.id + ' (' + x.zustand + ')'; }).join(', ')) : null)]);
}

function zugriffPopup(zn, fertig) {
  const K = VIEW.karte, hat = function (t) { return (zn.typen || []).indexOf(t) >= 0; };
  const feldNotiz = h('input', { type: 'text', id: 'zp-notiz', maxlength: '300', value: zn.notiz || '', placeholder: 'Notiz (optional)', 'aria-label': 'Notiz zum Zugriffspunkt', spellcheck: 'false', onchange: function (ev) { dispatch({ type: 'ZONE_GEAENDERT', id: zn.id, notiz: ev.target.value }); } });
  fertig('Möglicher Zugriffspunkt ' + zn.id, [h('p', { class: 'k-pop-sub' }, zn.name + ' · Radius ' + zn.r + ' m · ' + zn.ll[0].toFixed(4) + ', ' + zn.ll[1].toFixed(4)),
    h('div', { class: 'k-pop-form' }, h('span', null, 'Art'),
      h('div', { class: 'k-zp-typen' }, ZUGRIFF_TYPEN.map(function (t) {
        return h('label', { class: 'k-ebene' }, h('input', { type: 'checkbox', 'data-zp-typ': t, checked: hat(t), onchange: function () { const neu = ZUGRIFF_TYPEN.filter(function (x) { return x === t ? !hat(t) : hat(x); }); dispatch({ type: 'ZONE_GEAENDERT', id: zn.id, typen: neu }); } }), h('span', null, t));
      })),
      h('label', { for: 'zp-r' }, 'Radius'), h('select', { id: 'zp-r', 'aria-label': 'Radius des Zugriffspunkts', onchange: function (ev) { dispatch({ type: 'ZONE_GEAENDERT', id: zn.id, r: Number(ev.target.value) }); } }, ZUGRIFF_RADIEN.map(function (r) { return h('option', { value: String(r), selected: r === zn.r }, r + ' m'); })),
      h('label', { for: 'zp-notiz' }, 'Notiz'), feldNotiz),
    h('p', { class: 'k-pop-meta' }, 'Potenzieller Zugriffspunkt, nicht bestätigt. Er gilt nur für diese Karte; die Streckenanalyse reichst du weiterhin im Auftrag ein.'),
    h('div', { class: 'k-pop-akt' }, h('button', { type: 'button', class: 'link', id: 'k-pop-zentrum', onclick: function () { karteFlug(zn.ll[0], zn.ll[1], Math.max(K.zoom, 16.5), karteAuswahlAnzeige, zn.id); } }, 'Zentrieren'),
      h('button', { type: 'button', class: 'link', id: 'zp-lage', title: 'Führt die Markierung als Lagezone mit Bewertung und Meldungen', onclick: function () { dispatch({ type: 'ZONEN_MEHRFACH', ids: [zn.id], op: 'art', wert: 'lage' }); } }, 'Als Lagezone führen'),
      h('button', { type: 'button', class: 'link', id: 'zn-weg', onclick: function () { K.auswahl = null; dispatch({ type: 'ZONE_ENTFERNT', id: zn.id }); } }, 'Entfernen'))]);
}
/* Mehrfachauswahl: Umschalt- oder Strg-Klick auf Zonen, oder Schalter "Mehrfach" in der Kartenleiste */
function zonenMehrPanel(fertig) {
  const K = VIEW.karte, Zt = SCENARIO.zonen, alle = (K.mehr || []).map(function (id) { return karteZoneFinden(id); }).filter(Boolean), Z = alle.filter(function (z) { return !z.auto; });
  const nZ = Z.filter(function (z) { return z.art === 'zugriff'; }).length, nL = Z.length - nZ, nA = alle.length - Z.length;
  const radien = Zt.radien.concat(ZUGRIFF_RADIEN).filter(function (r, i, a) { return a.indexOf(r) === i; }).sort(function (x, y) { return x - y; });
  const ids = Z.map(function (z) { return z.id; });
  fertig(alle.length + ' Zonen gewählt', [
    h('p', { class: 'k-pop-sub' }, nL + ' Lagezone(n), ' + nZ + ' Zugriffspunkt(e)' + (nA ? ' · ' + nA + ' Standortzone(n) bleiben unverändert' : '')),
    h('div', { class: 'k-pop-form' }, h('label', { for: 'mz-r' }, 'Radius für alle'),
      h('select', { id: 'mz-r', 'aria-label': 'Radius für alle gewählten Zonen', onchange: function (ev) { if (ev.target.value) dispatch({ type: 'ZONEN_MEHRFACH', ids: ids, op: 'radius', wert: Number(ev.target.value) }); } },
        [h('option', { value: '' }, 'unverändert')].concat(radien.map(function (r) { return h('option', { value: String(r) }, r + ' m'); })))),
    h('p', { class: 'k-pop-meta' }, 'Zugriffspunkte kennen nur 20 bis 150 m, Lagezonen die üblichen Radien; nicht passende Werte werden auf den nächstliegenden erlaubten Radius gesetzt.'),
    h('div', { class: 'k-pop-akt' },
      h('button', { type: 'button', class: 'link', id: 'mz-zugriff', disabled: !nL, onclick: function () { dispatch({ type: 'ZONEN_MEHRFACH', ids: ids, op: 'art', wert: 'zugriff' }); } }, 'Als Zugriffspunkte'),
      h('button', { type: 'button', class: 'link', id: 'mz-lage', disabled: !nZ, onclick: function () { dispatch({ type: 'ZONEN_MEHRFACH', ids: ids, op: 'art', wert: 'lage' }); } }, 'Als Lagezonen'),
      VIEW.draft['mz-weg'] ? h('button', { type: 'button', id: 'mz-weg-ja', onclick: function () { delete VIEW.draft['mz-weg']; dispatch({ type: 'ZONEN_MEHRFACH', ids: ids, op: 'entfernen' }); } }, 'Wirklich ' + Z.length + ' entfernen')
        : h('button', { type: 'button', class: 'link', id: 'mz-weg', disabled: !Z.length, onclick: function () { VIEW.draft['mz-weg'] = '1'; karteAuswahlAnzeige(); } }, 'Entfernen'),
      h('button', { type: 'button', class: 'link', id: 'mz-aus', onclick: function () { K.mehr = []; delete VIEW.draft['mz-weg']; K.auswahl = null; renderModule(); } }, 'Auswahl aufheben'))]);
}
/* Änderungen an Pin und eigener Zone sofort in 2D und 3D zeigen (die Aktionen sind „leicht“ und zeichnen die Karte nicht selbst) */
function karteNeuZeichnen() {
  const svg = $('k-svg'); if (svg) zeichneKarte(svg);
  if (VIEW.karte.ansicht3d) karte3dSenden(karte3dDaten());
  karteStatusAkt();
}
function dossierOptionen(gewaehlt) {
  const liste = typeof pool === 'function' ? pool().slice().sort(function (a, b) { return String(a.name).localeCompare(String(b.name), 'de'); }) : [];
  return liste.map(function (e) { return h('option', { value: e.id, selected: e.id === gewaehlt }, kuerzen(e.name, 40) + ' (' + e.id + ')'); });
}
/* Zone oder Pin auf der Karte zeigen (aus Dossier und Unterlage); wählt das Objekt und zentriert */
function kartenObjektZeigen(id) {
  const K = VIEW.karte, ziel = (PROFIL.zonen || []).concat(PROFIL.pins || []).find(function (x) { return x.id === id; });
  if (!ziel || !ziel.ll) return;
  K.pick = null; K.lat = ziel.ll[0]; K.lon = ziel.ll[1]; K.zoom = Math.max(K.zoom, 15); K.reiter = 'karte'; K.auswahl = id; K.popupVersatz = null;
  dispatch({ type: 'NAVIGATION', modul: 'karte' });
  if (typeof karteBezugSetzen === 'function') karteBezugSetzen(id);
  renderModule();
  if (K.ansicht3d) karteFlug(ziel.ll[0], ziel.ll[1], K.zoom, null, id);
}
/* Eigene Zone (Profil): neutrale Darstellung ohne Bewertung, Handler und Zeitgeber; Schaltflächen benennen ihre tatsächliche Wirkung */
function eigeneZonePopup(zn, fertig) {
  const K = VIEW.karte, ab = function (patch) { dispatch(Object.assign({ type: 'OZONE_GEAENDERT', id: zn.id }, patch)); karteNeuZeichnen(); };
  const R = PROFIL.recherche || { beobachtungen: [] };
  const unterlageText = function (id) {
    const z = typeof rchZuBeobachtung === 'function' ? rchZuBeobachtung(id) : null;
    if (!z) return id + ' (nicht mehr vorhanden)';
    const titel = (z.f && z.f.dateiname) || kuerzen(String(z.b.zitat || '').replace(/\s+/g, ' '), 40) || (z.q && z.q.herkunft) || id, ft = z.b.fundstelle && z.b.fundstelle.typ && typeof rchFundstelleText === 'function' ? ', ' + rchFundstelleText(z.b.fundstelle) : '';
    return titel + (z.fall ? ' (' + kuerzen(z.fall.titel || z.fall.id, 30) + ft + ')' : '');
  };
  const frei = (R.beobachtungen || []).filter(function (b) {
    const dossiers = b.dossiers || [];
    return (zn.unterlagen || []).indexOf(b.id) < 0 &&
      !dossiers.some(function (id) { return typeof dossierGesperrt === 'function' && dossierGesperrt(entitaet(id)); });
  });
  const auswahl = frei.filter(function (b) { return zn.dossier && (b.dossiers || []).indexOf(zn.dossier) >= 0; });
  const andere = frei.filter(function (b) { return auswahl.indexOf(b) < 0; });
  const optionen = function (L) { return L.map(function (b) { return h('option', { value: b.id }, unterlageText(b.id)); }); };
  fertig(zn.name, [
    h('p', { class: 'k-pop-sub' }, zn.ll[0].toFixed(5) + ', ' + zn.ll[1].toFixed(5) + ' · Radius ' + zn.r + ' m'),
    h('div', { class: 'k-pop-form' },
      h('label', { for: 'oz-name' }, 'Name'), h('input', { type: 'text', id: 'oz-name', maxlength: '60', value: zn.name, onchange: function (ev) { ab({ name: ev.target.value }); } }),
      h('label', { for: 'oz-r' }, 'Radius'), h('select', { id: 'oz-r', 'aria-label': 'Radius der Zone', onchange: function (ev) { ab({ r: Number(ev.target.value) }); } }, OZONE_RADIEN.map(function (r) { return h('option', { value: String(r), selected: r === zn.r }, r + ' m'); })),
      h('label', { for: 'oz-dossier' }, 'Dossier'), h('select', { id: 'oz-dossier', 'aria-label': 'Dossier zur Zone', onchange: function (ev) { ab({ dossier: ev.target.value || null }); } },
        [h('option', { value: '' }, 'keines')].concat(dossierOptionen(zn.dossier))),
      h('label', { for: 'oz-notiz' }, 'Notiz'), h('textarea', { id: 'oz-notiz', rows: '3', maxlength: '1500', onchange: function (ev) { ab({ notiz: ev.target.value }); } }, zn.notiz || '')),
    h('p', { class: 'k-pop-meta', id: 'oz-stand-text' }, 'Stand: ' + fmtZ(zn.stand || zn.t) + (zn.standBemerkung ? ' · ' + zn.standBemerkung : '') + '. Der Stand hält fest, wann Sie die Zone zuletzt selbst geprüft haben; er löst keine Meldung aus.'),
    h('div', { class: 'k-pop-form' }, h('label', { for: 'oz-bem' }, 'Bemerkung zur Prüfung'), h('input', { type: 'text', id: 'oz-bem', maxlength: '300', placeholder: 'optional', value: VIEW.draft['oz-bem-' + zn.id] || '', oninput: function (ev) { VIEW.draft['oz-bem-' + zn.id] = ev.target.value; } })),
    (zn.unterlagen || []).length ? h('ul', { class: 'k-pop-meta', id: 'oz-unterlagen' }, zn.unterlagen.map(function (u) {
      return h('li', null, unterlageText(u) + ' ', h('button', { type: 'button', class: 'link', 'data-oz-los': u, onclick: function () { dispatch({ type: 'OZONE_UNTERLAGE', id: zn.id, unterlage: u, op: 'loesen' }); } }, 'lösen'));
    })) : h('p', { class: 'k-pop-meta' }, 'Keine Unterlage verknüpft.'),
    frei.length ? h('details', { id: 'oz-unt-details' },
      h('summary', null, 'Unterlage verknüpfen'),
      h('div', { class: 'k-pop-form' }, h('label', { for: 'oz-unt' }, 'Unterlage'),
        h('select', { id: 'oz-unt', 'aria-label': 'Unterlage zur Zone', onchange: function (ev) { $('oz-unt-ja').disabled = !ev.target.value; } },
          h('option', { value: '', selected: true }, '– Unterlage wählen –'),
          auswahl.length ? h('optgroup', { label: 'Dieses Dossier' }, optionen(auswahl)) : null,
          andere.length ? h('optgroup', { label: auswahl.length ? 'Andere Unterlagen' : 'Vorhandene Unterlagen' }, optionen(andere)) : null),
        h('span', null), h('button', { type: 'button', id: 'oz-unt-ja', disabled: true, onclick: function () {
          const id = $('oz-unt').value;
          if (id) dispatch({ type: 'OZONE_UNTERLAGE', id: zn.id, unterlage: id, op: 'verknuepfen' });
        } }, 'Verknüpfen'))) : null,
    h('div', { class: 'k-pop-akt' },
      h('button', { type: 'button', id: 'oz-stand', onclick: function () { const t = VIEW.draft['oz-bem-' + zn.id] || ''; delete VIEW.draft['oz-bem-' + zn.id]; dispatch({ type: 'OZONE_STAND', id: zn.id, bemerkung: t }); } }, 'Stand aktualisieren'),
      h('button', { type: 'button', class: 'link', id: 'oz-protokoll', onclick: function () { K.kpObjekt = zn.id; K.kpFilter = ''; K.reiter = 'protokoll'; renderModule(); } }, 'Protokoll öffnen'),
      h('button', { type: 'button', class: 'link', id: 'oz-zentrum', onclick: function () { karteFlug(zn.ll[0], zn.ll[1], Math.max(K.zoom, 15), karteAuswahlAnzeige, zn.id); } }, 'Zentrieren'),
      h('button', { type: 'button', class: 'link', id: 'oz-export', onclick: function () { kartenTxtExport('zone', zn.id); } }, 'Als TXT exportieren'),
      VIEW.draft['oz-weg'] === zn.id ? h('button', { type: 'button', id: 'oz-weg-ja', onclick: function () { delete VIEW.draft['oz-weg']; K.auswahl = null; dispatch({ type: 'OZONE_ENTFERNT', id: zn.id }); } }, 'Wirklich entfernen')
        : h('button', { type: 'button', class: 'link', id: 'oz-weg', onclick: function () { VIEW.draft['oz-weg'] = zn.id; karteAuswahlAnzeige(); } }, 'Entfernen'))].filter(Boolean));
}
function zonePopup(zn, fertig) {
  if (zn.profil) return eigeneZonePopup(zn, fertig);
  if (zn.art === 'zugriff') return zugriffPopup(zn, fertig);
  const Zt = SCENARIO.zonen, lg = zoneLage(zn), K = VIEW.karte;
  const liste = function (L, max) {
    if (!L.length) return 'keine';
    const teile = [];
    L.slice(0, max || 6).forEach(function (e, i) { if (i) teile.push(', '); teile.push(dossierLink(e, 'Karte', 'zn-dl-' + e.id)); });
    if (L.length > (max || 6)) teile.push(' und ' + (L.length - (max || 6)) + ' weitere');
    return teile;
  };
  const eff = zoneStufe(zn, lg);
  const lageFeld = eff == null ? 'Keine Bewertung: kein bekanntes Dossier im Bereich.' : [stufeLabel(eff), ' ', zn.auto && zn.urteil && zn.urteil.status === 'frei' ? 'eigene Einstufung, freigegeben' : 'höchste Bewertung im Bereich: ' + anzeige(lg.quelle)];
  const info = [
    feld('Lage', lageFeld, 'full'),
    feld('Im Bereich', liste(lg.personen), 'full'),
    feld('Zielpersonen' + (lg.ziel.length ? ' (' + lg.ziel.length + ')' : ''), liste(lg.ziel), 'full'),
    lg.standorte.length ? feld('Standorte', lg.standorte.join(', ')) : null,
    feld('Zeitfenster', lg.fenster.length ? lg.fenster.map(function (w) { return w.id + ' (' + w.zustand + ')'; }).join(', ') : 'keine offen'),
    feld('Sichtungen', String(lg.sichtungen)),
    zoneFrische(zn) ? feld('Stand der Einstufung', [frischeLabel(zoneFrische(zn)), ' ' + zoneFrische(zn).text + (zoneFrische(zn).stufe === 'veraltet' ? ' – bitte bestätigen oder neu einstufen' : '')], 'full') : null,
    !zn.auto && zn.verlauf && zn.verlauf.length ? feld('Verlauf', zn.verlauf.slice(-4).reverse().reduce(function (acc, v, k) { if (k) acc.push(h('br')); acc.push(fmtZ(v.t).slice(11, 16) + 'Z · ' + kuerzen(v.text.replace(/^ZN-\d+ „[^“]*“: /, ''), 110)); return acc; }, []), 'full') : null
  ];
  const selR = function (id) { return h('select', { id: 'zn-r', 'aria-label': 'Radius der Zone', onchange: function (ev) { dispatch({ type: id.indexOf('ZA-') === 0 ? 'ZONE_URTEIL' : 'ZONE_GEAENDERT', id: id, r: Number(ev.target.value) }); } }, Zt.radien.map(function (r) { return h('option', { value: String(r), selected: r === zn.r }, r + ' m'); })); };
  const zentrum = h('button', { type: 'button', class: 'link', id: 'k-pop-zentrum', onclick: function () { karteFlug(zn.ll[0], zn.ll[1], Math.max(K.zoom, 13.5), karteAuswahlAnzeige, zn.id); } }, 'Zentrieren');
  if (zn.auto) {
    const u = zn.urteil, wahl = VIEW.draft['zu-stufe-' + zn.id], offen = u && u.status === 'beantragt';
    const stufeSel = h('select', { id: 'zu-stufe', 'aria-label': 'Eigene Einstufung', onchange: function (ev) {
      const v = ev.target.value;
      if (v === '' || Number(v) <= 3) { delete VIEW.draft['zu-stufe-' + zn.id]; dispatch({ type: 'ZONE_URTEIL', id: zn.id, stufe: v === '' ? null : Number(v) }); }
      else { VIEW.draft['zu-stufe-' + zn.id] = v; karteAuswahlAnzeige(); }
    } }, [h('option', { value: '', selected: !wahl && !(u && u.status === 'frei') }, 'berechnet' + (lg.stufe != null ? ' (Stufe ' + lg.stufe + ')' : ''))].concat([1, 2, 3, 4, 5].map(function (n) {
      return h('option', { value: String(n), selected: wahl ? wahl === String(n) : !!(u && u.status === 'frei' && u.stufe === n) }, 'Stufe ' + n + ' – ' + SCENARIO.bedrohungsstufen[n] + (n >= 4 ? ' (mit Begründung)' : ''));
    })));
    const bg = wahl ? h('div', { class: 'k-pop-form' },
      h('label', { for: 'zu-bg' }, 'Begründung'),
      entwurf('input', 'zu-bg', 'zu-bg-' + zn.id, { type: 'text', maxlength: '300', placeholder: 'Anlass, Beleg, Nutzen', 'aria-label': 'Begründung für ARGUS', spellcheck: 'false' }),
      h('span', null), h('button', { type: 'button', id: 'zu-senden', onclick: function () { const t = $('zu-bg').value || ''; dispatch({ type: 'ZONE_URTEIL', id: zn.id, stufe: Number(wahl), begruendung: t }); } }, 'Bei ' + ((kanalDef('handler') || {}).gegenstelle || 'ARGUS') + ' beantragen')) : null;
    fertig('Lagezone ' + zn.standort, [h('p', { class: 'k-pop-sub' }, zn.name + ' · Radius ' + zn.r + ' m'),
      h('div', { class: 'k-pop-form' }, h('label', { for: 'zu-stufe' }, 'Einstufung'), stufeSel, h('label', { for: 'zn-r' }, 'Radius'), selR(zn.id)),
      bg, h('dl', { class: 'fields' }, info),
      offen ? h('p', { class: 'k-pop-meta' }, 'Beantragt: Stufe ' + u.stufe + ', ' + ((kanalDef('handler') || {}).gegenstelle || 'ARGUS') + ' prüft.') : null,
      h('div', { class: 'k-pop-akt' }, zentrum,
        h('button', { type: 'button', class: 'link', id: 'k-pop-frage', title: 'Öffnet den Kanal zum Ansprechpartner mit einem vorbereiteten Entwurf (wird nicht gesendet)', onclick: function () { STATE.komm.aktiv = 'handler'; VIEW.draft['km-handler'] = 'Wie ist die Lage bei ' + zn.standort + '?'; dispatch({ type: 'NAVIGATION', modul: 'nachrichten' }); } }, 'Lage erfragen'),
        zoneFrische(zn) ? h('button', { type: 'button', class: 'link', id: 'zn-best', onclick: function () { dispatch({ type: 'ZONE_BESTAETIGT', id: zn.id }); meldung('Lage ' + zn.standort + ' bestätigt'); kurzHinweis('Lage ' + zn.standort + ' bestätigt'); karteWaehlen(null, false); } }, 'Lage bestätigen') : null,
        u ? h('button', { type: 'button', class: 'link', id: 'zu-reset', onclick: function () { delete VIEW.draft['zu-stufe-' + zn.id]; dispatch({ type: 'ZONE_URTEIL', id: zn.id, stufe: null, zurueck: true }); } }, 'Zurücksetzen') : null)].filter(Boolean));
    return;
  }
  const feldName = h('input', { type: 'text', id: 'zn-name', value: zn.name, maxlength: '60', 'aria-label': 'Name der Zone', spellcheck: 'false', onchange: function (ev) { dispatch({ type: 'ZONE_GEAENDERT', id: zn.id, name: ev.target.value }); } });
  const selW = h('select', { id: 'zn-wertung', 'aria-label': 'Sicherheitsbewertung', onchange: function (ev) { dispatch({ type: 'ZONE_GEAENDERT', id: zn.id, wertung: ev.target.value }); } }, Object.keys(Zt.wertungen).map(function (w) { return h('option', { value: w, selected: w === zn.wertung }, Zt.wertungen[w]); }));
  const kann = zn.wertung !== 'ruhig';
  fertig('Zone ' + zn.id, [h('div', { class: 'k-pop-form' }, h('label', { for: 'zn-name' }, 'Name'), feldName, h('label', { for: 'zn-r' }, 'Radius'), selR(zn.id), h('label', { for: 'zn-wertung' }, 'Bewertung'), selW),
    h('dl', { class: 'fields' }, info),
    h('p', { class: 'k-pop-meta' }, (zn.durch === 'handler' ? 'Zuletzt von ' + zoneHandlerName() + ' neu eingestuft. ' : '') + (zn.gemeldet ? 'Gemeldet um ' + fmtZ(zn.gemeldet.t).slice(11, 16) + 'Z (' + Zt.wertungen[zn.gemeldet.wertung] + '). ' : '') + (kann ? Zt.meldungHinweis[zn.wertung] : 'Bei „Unauffällig“ ist keine Meldung nötig.')),
    h('div', { class: 'k-pop-akt' },
      h('button', { type: 'button', id: 'zn-melden', disabled: !kann, onclick: function () { dispatch({ type: 'ZONE_GEMELDET', id: zn.id }); meldung(zn.id + ' an ' + zoneHandlerName() + ' gemeldet'); kurzHinweis(zoneHandlerName() + ' informiert: ' + zn.id + ' (' + Zt.wertungen[zn.wertung] + ')'); karteWaehlen(null, false); } }, 'Handler informieren'),
      zentrum,
      h('button', { type: 'button', class: 'link', id: 'zn-frage', title: 'Fragt ARGUS nach der Lage im Bereich, ohne die Einstufung zu ändern', onclick: function () { dispatch({ type: 'ZONE_ERFRAGT', id: zn.id }); meldung('Lage ' + zn.id + ' bei ' + zoneHandlerName() + ' erfragt'); kurzHinweis('Lage ' + zn.id + ' bei ' + zoneHandlerName() + ' erfragt'); karteWaehlen(null, false); } }, 'Lage erfragen'),
      h('button', { type: 'button', class: 'link', id: 'zn-best', onclick: function () { dispatch({ type: 'ZONE_BESTAETIGT', id: zn.id }); meldung('Lage ' + zn.id + ' bestätigt'); kurzHinweis('Lage ' + zn.id + ' bestätigt'); karteWaehlen(null, false); } }, 'Lage bestätigen'),
      h('button', { type: 'button', class: 'link', id: 'zn-weg', onclick: function () { K.auswahl = null; dispatch({ type: 'ZONE_ENTFERNT', id: zn.id }); } }, 'Entfernen'))]);
}
function karteWaehlen(id, zentrieren) {
  const K = VIEW.karte, m = id ? (karteMarker().find(function (x) { return x.id === id; }) || (karteKoord(id) ? { ll: karteKoord(id) } : null) || (karteZoneFinden(id) ? { ll: karteZoneFinden(id).ll } : null)) : null;
  if (K.auswahl !== id) K.popupVersatz = null;       /* neue Auswahl: Popup wieder an der Standardstelle */
  if (K.sichtungFokus && K.sichtungFokus !== id) K.sichtungFokus = null;
  K.auswahl = id; K.mehr = [];
  const svg = $('k-svg');
  if (zentrieren && m) { karteFlug(m.ll[0], m.ll[1], Math.max(K.zoom, 11), karteAuswahlAnzeige, id); }
  else if (svg) zeichneKarte(svg);
  karteAuswahlAnzeige();
  if (K.ansicht3d) karte3dSenden({ typ: 'karte3d-auswahl', id: id || null });
}
/* Weiche Kamerafahrt (550 ms); ohne Bewegungsreduktion */
function karteFlug(lat, lon, zoom, fertig, bezugId) {
  karteBezugSetzen(bezugId);                      /* gezielter Sprung setzt den Objektkontext der Lage-Box; Region, Europa und Welt löschen ihn */
  if (VIEW.karte.ansicht3d) { karte3dSenden({ typ: 'karte3d-flug', center: [lon, lat], zoom: Math.max(15, zoom || 15) }); if (fertig) fertig(); return; }
  const K = VIEW.karte, a = { lat: K.lat, lon: K.lon, zoom: K.zoom }, t0 = performance.now();
  if (K.flug) cancelAnimationFrame(K.flug);
  const reduziert = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const dauer = reduziert ? 1 : 550;
  const schritt = function (t) {
    const u = Math.min(1, (t - t0) / dauer), e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
    K.lat = a.lat + (lat - a.lat) * e; K.lon = a.lon + (lon - a.lon) * e; K.zoom = a.zoom + (zoom - a.zoom) * e;
    const svg = $('k-svg'); if (svg) zeichneKarte(svg);
    if (u < 1) K.flug = requestAnimationFrame(schritt); else { K.flug = null; if (fertig) fertig(); }
  };
  K.flug = requestAnimationFrame(schritt);
}
function karteDistanz(a, b) {
  const R = 6371, dLa = (b[0] - a[0]) * DEG, dLo = (b[1] - a[1]) * DEG;
  const x = Math.sin(dLa / 2) * Math.sin(dLa / 2) + Math.cos(a[0] * DEG) * Math.cos(b[0] * DEG) * Math.sin(dLo / 2) * Math.sin(dLo / 2);
  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
/* Messung: Luftlinie, Straßenstrecke geschätzt (Faktor 1,25) und Fahrzeit bei durchschnittlich 70 km/h */
function karteMessText(a, b) {
  const luft = karteDistanz(a, b), strasse = luft * 1.25, min = Math.round(strasse / 70 * 60);
  const km = function (v) { return (v < 10 ? v.toFixed(1) : String(Math.round(v))).replace('.', ',') + ' km'; };
  return km(luft) + ' Luftlinie · Straße ca. ' + km(strasse) + ' · ca. ' + (min >= 90 ? Math.floor(min / 60) + ' h ' + (min % 60) + ' min' : min + ' min');
}
/* Fokus beim Überfahren: Nachbarn und Kanten bleiben hell, der Rest tritt zurück */
function karteFokus(svg, id) {
  if (!id) { svg.classList.remove('hat-fokus'); svg.querySelectorAll('.k-nah').forEach(function (n) { n.classList.remove('k-nah'); }); return; }
  const nah = {}; nah[id] = 1;
  kantenPool().forEach(function (v) { if (v.von === id) nah[v.nach] = 1; else if (v.nach === id) nah[v.von] = 1; });
  svg.classList.add('hat-fokus');
  svg.querySelectorAll('.k-marker').forEach(function (g) { g.classList.toggle('k-nah', !!nah[g.getAttribute('data-id')]); });
  svg.querySelectorAll('.k-verbg').forEach(function (g) { g.classList.toggle('k-nah', g.getAttribute('data-von') === id || g.getAttribute('data-nach') === id); });
}
/* 3D-Ansicht: eingebettete Seite karte3d.html (MapLibre). Das Terminal liefert Markierungen, Zonen und die Kamera per postMessage;
   die Kamera der 3D-Ansicht wird gemerkt, damit ein Neuaufbau des Moduls sie nicht zurücksetzt. */
function karte3dDaten() {
  const K = VIEW.karte;
  const marker = karteMarker().filter(function (m) { return m.ll; }).map(function (m) { return { id: m.id, kat: m.kat, typ: m.typ, stufe: m.stufe || 0, name: typeof sperreText === 'function' ? sperreText(m.name) : m.name, ll: m.ll }; });
  const zonen = karteZonen().filter(function (z) { return z.ll; }).map(function (z) { return { id: z.id, name: typeof sperreText === 'function' ? sperreText(z.name) : z.name, ll: z.ll, r: z.r }; });
  /* Ohne gemerkte Kamera: bei weiter Ausgangsansicht auf den ersten Standort (sonst erste Markierung) gehen, sonst die aktuelle Mitte nehmen */
  const ziel = K.zoom < 9 ? (marker.find(function (m) { return m.kat === 'standort'; }) || marker[0]) : null;
  const kamera = K.kamera3d || (ziel
    ? { center: [ziel.ll[1], ziel.ll[0]], zoom: 15.5, pitch: 60, bearing: -20 }
    : { center: [K.lon, K.lat], zoom: Math.max(14, Math.min(17.5, K.zoom - 0.5)), pitch: 60, bearing: -20 });
  return { typ: 'karte3d-daten', marker: marker, zonen: zonen, kamera: kamera, auswahl: K.auswahl || null, fadenkreuz: !!(K.pick || K.pinSetzen || K.zoneSetzen || K.zugriffSetzen || K.messen), mess: K.messPts || [] };
}
function webglVorhanden() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; }
}
/* Zoom und Mitte der beiden Ansichten bleiben beim Umschalten gekoppelt (feste Differenz von 0,5 Stufen in beide Richtungen, damit Hin- und Rückwechsel stabil sind) */
const KARTE_ZOOM_3D = 0.5;
function karteKameraUebernehmen(kamera) {
  const K = VIEW.karte;
  if (!kamera || !Array.isArray(kamera.center)) return;
  K.kamera3d = kamera;
  K.lon = kamera.center[0]; K.lat = kamera.center[1];
  if (isFinite(kamera.zoom)) K.zoom = Math.max(1.6, Math.min(19, kamera.zoom + KARTE_ZOOM_3D));
}
function karte3dUmschalten() {
  const K = VIEW.karte;
  if (K.ansicht3d) { if (K.kamera3d) karteKameraUebernehmen(K.kamera3d); }                       /* zurück nach 2D: letzte 3D-Kamera übernehmen */
  else if (K.kamera3d) {                                                                         /* nach 3D: aktuelle 2D-Ansicht als Kamera, Neigung und Richtung bleiben (erster Aufruf: Ausgangslogik in karte3dDaten) */
    const alt = K.kamera3d;
    K.kamera3d = { center: [K.lon, K.lat], zoom: Math.max(1, K.zoom - KARTE_ZOOM_3D), pitch: alt.pitch != null ? alt.pitch : 60, bearing: alt.bearing != null ? alt.bearing : -20 };
  }
  K.ansicht3d = !K.ansicht3d; renderModule();
}
function karte3dSenden(nachricht) {
  const fr = document.getElementById('k-3d-frame');
  if (fr && fr.contentWindow) { try { fr.contentWindow.postMessage(nachricht, '*'); } catch (e) { /* ohne 3D */ } }
}
/* Klick in der 3D-Ansicht: läuft durch denselben Klick-Handler wie in 2D (Auswahl, Pin, Zone, Zugriffspunkt, Messen, Positionswahl) */
function karte3dKlick(d) {
  const st = KARTE_ST, svg = $('k-svg');
  if (!st || !st.klick || !svg) return;
  const P = karteProj(), r = svg.getBoundingClientRect();
  const ziel = d.id ? { closest: function (q) { return q === '.k-marker' ? { getAttribute: function () { return d.id; } } : null; } }
    : d.zid ? { closest: function (q) { return q === '.k-zone' ? { getAttribute: function () { return d.zid; } } : null; } }
    : { closest: function () { return null; } };
  st.klick({ target: ziel, shiftKey: !!d.umschalt, clientX: r.left + P.px(d.lon) * r.width / KW, clientY: r.top + P.py(d.lat) * r.height / KH });
  karte3dSenden({ typ: 'karte3d-auswahl', id: VIEW.karte.auswahl || null });
}
let KARTE_ST = null;
const KARTE3D = { host: null, frame: null, platz: null, bereit: false };
/* Die 3D-Seite lebt dauerhaft außerhalb des Moduls (fest am Seitenende) und wird über den Platzhalter in der Karte positioniert.
   Ein Neuaufbau des Moduls (Pin setzen, Messen, Ebenen) lädt sie so nicht neu; kein Weißblitz, die Kamera bleibt erhalten. */
function karte3dHost() {
  if (!KARTE3D.host) {
    const fr = h('iframe', { class: 'k-3d-frame', id: 'k-3d-frame', title: '3D-Ansicht der Lagekarte', src: 'karte3d.html?eingebettet=1' });
    const host = h('div', { class: 'k-3d-host', id: 'k-3d-host', hidden: true }, fr);
    document.body.appendChild(host);
    KARTE3D.host = host; KARTE3D.frame = fr;
    const folgen = function () {
      const pl = KARTE3D.platz;
      if (pl && pl.isConnected && VIEW.karte.ansicht3d && STATE.ui.modul === 'karte') {
        const r = pl.getBoundingClientRect();
        host.hidden = false;
        host.style.left = r.left + 'px'; host.style.top = r.top + 'px'; host.style.width = r.width + 'px'; host.style.height = r.height + 'px';
      } else host.hidden = true;
      requestAnimationFrame(folgen);
    };
    requestAnimationFrame(folgen);
  }
  return KARTE3D.host;
}
function karte3dRahmen() {
  if (!webglVorhanden()) return h('div', { class: 'k-3d k-3d-hinweis', id: 'k-3d-hinweis' },
    h('p', null, 'Die 3D-Ansicht benötigt Grafikbeschleunigung (WebGL). In diesem Fenster ist sie abgeschaltet.'),
    h('p', { class: 'dim' }, 'Der Start über START_3D.bat lässt sie zu.'));
  karte3dHost();
  const platz = h('div', { class: 'k-3d-platz' });
  KARTE3D.platz = platz;
  requestAnimationFrame(function () { if (KARTE3D.bereit) karte3dSenden(karte3dDaten()); });   /* aktueller Stand nach jedem Neuaufbau des Moduls */
  return platz;
}
if (typeof window !== 'undefined' && !window.__karte3dHoerer) {
  window.__karte3dHoerer = true;
  window.addEventListener('message', function (ev) {
    const fr = document.getElementById('k-3d-frame'); if (!fr || ev.source !== fr.contentWindow) return;
    karte3dEingang(ev.data || {}, fr);
  });
}
/* Nachrichten der 3D-Ansicht (eigene Funktion, damit sie ohne gerenderte 3D-Ansicht geprüft werden kann) */
function karte3dEingang(d, fr) {
  {
    if (d.typ === 'karte3d-bereit') { KARTE3D.bereit = true; try { fr.contentWindow.postMessage(karte3dDaten(), '*'); } catch (e) { /* ohne 3D */ } }
    else if (d.typ === 'karte3d-klick') karte3dKlick(d);
    else if (d.typ === 'karte3d-fehler') { if (!KARTE3D.fehlerGemeldet) { KARTE3D.fehlerGemeldet = true; meldung('3D-Ansicht: ' + d.grund + '. Die 2D-Karte bleibt nutzbar.'); } }
    else if (d.typ === 'karte3d-nutzer-bewegt') { if (VIEW.karte.bezug) { VIEW.karte.bezug = null; karteStatusAkt(); } }   /* eigenes Ziehen in 3D: Rückfall auf die Kartenmitte */
    else if (d.typ === 'karte3d-kamera' && d.kamera) {
      karteKameraUebernehmen(d.kamera);
      karteStatusAkt();                                /* Kartenmitte und Wetter nachziehen; der Bezug bleibt, solange der Nutzer nicht gezogen hat */
    }
  }
}
function karteSteuerung(svg) {
  const K = VIEW.karte;
  let ausstehend = false;
  const neu = function () { if (ausstehend) return; ausstehend = true; requestAnimationFrame(function () { ausstehend = false; zeichneKarte(svg); }); };   /* höchstens ein Neuzeichnen je Bild */
  const zoomUm = function (dz, cx, cy) {
    const P = karteProj(), gl = P.lon(cx), gb = P.lat(cy);
    K.zoom = Math.max(1.6, Math.min(19, K.zoom + dz));
    const Wd = 256 * Math.pow(2, K.zoom);
    K.lon = gl - (cx - KW / 2) / Wd * 360;
    K.lat = Math.max(-80, Math.min(80, mercInv(merc(gb) + (cy - KH / 2) * 2 * Math.PI / Wd)));
    neu();
  };
  const koordUm = function (ev) {
    const r = svg.getBoundingClientRect();
    return [(ev.clientX - r.left) * KW / r.width, (ev.clientY - r.top) * KH / r.height];
  };
  let zug = null;
  svg.addEventListener('wheel', function (ev) { ev.preventDefault(); const c = koordUm(ev); zoomUm(ev.deltaY < 0 ? 0.5 : -0.5, c[0], c[1]); }, { passive: false });
  svg.addEventListener('pointerdown', function (ev) {
    if (ev.button > 0) return;
    zug = { x: ev.clientX, y: ev.clientY, bewegt: false, ziel: ev.target };
    try { svg.setPointerCapture(ev.pointerId); } catch (e) { /* ohne Capture */ }
  });
  svg.addEventListener('pointermove', function (ev) {
    if (!zug) return;
    const r = svg.getBoundingClientRect(), f = KW / r.width, dx = (ev.clientX - zug.x) * f, dy = (ev.clientY - zug.y) * f;
    if (!zug.bewegt && Math.abs(dx) + Math.abs(dy) < 4) return;
    zug.bewegt = true; zug.x = ev.clientX; zug.y = ev.clientY;
    if (K.bezug) { K.bezug = null; karteStatusAkt(); }          /* eigenes Verschieben: die Box fällt auf die Kartenmitte zurück (die Zentrieranimation löst das nicht aus) */
    const Wd = 256 * Math.pow(2, K.zoom);
    K.lon -= dx / Wd * 360; K.lat = Math.max(-80, Math.min(80, mercInv(merc(K.lat) + dy * 2 * Math.PI / Wd)));
    neu();
  });
  const klick = function (ev) {
    if (K.pick === 'CI-AUS') {                                          /* Ausweichort für den Check-in */
      const c = koordUm(ev), P = karteProj();
      K.pick = null;
      VIEW.draft['aw-koord'] = P.lat(c[1]).toFixed(5) + ', ' + P.lon(c[0]).toFixed(5);
      dispatch({ type: 'NAVIGATION', modul: 'profil' });
      renderModule();
      return;
    }
    if (typeof K.pick === 'string' && K.pick.indexOf('SI:') === 0) {      /* Sichtung platzieren: Entwurfs-Pin zum Dossier */
      const c = koordUm(ev), P = karteProj(), eid = K.pick.slice(3), de = entitaet(eid);
      K.pick = null;
      if (de) {
        dispatch({ type: 'PIN_ANGELEGT', ll: [P.lat(c[1]), P.lon(c[0])], name: sichtungsPinName(), dossier: de.id, notiz: 'Sichtungsentwurf zu ' + de.id + ' ' + de.name + ' (Punkt auf der Karte gesetzt)' });
      }
      renderModule();
      return;
    }
    if (K.pick) {                                                      /* Position für ein Dossier festlegen */
      const c = koordUm(ev), P = karteProj(), id = K.pick;
      K.pick = null;
      dispatch({ type: id.indexOf('AO-') === 0 ? 'AUSGANG_ORT' : id.indexOf('ZP-') === 0 ? 'ZUGRIFF_ORT' : 'DOSSIER_ORT', id: id, ll: [P.lat(c[1]), P.lon(c[0])] });
      K.auswahl = id;
      renderModule();
      return;
    }
    const t = ev.target && ev.target.closest ? ev.target.closest('.k-marker') : null;
    const vt = !t && ev.target && ev.target.closest ? ev.target.closest('.k-verbg') : null;
    if (K.zugriffSetzen && !K.messen) {                              /* Zugriffspunkte markieren: bleibt aktiv, bis es beendet wird */
      const c = koordUm(ev), P = karteProj();
      dispatch({ type: 'ZONE_ANGELEGT', art: 'zugriff', ll: [P.lat(c[1]), P.lon(c[0])] });
      renderModule();
      return;
    }
    if (K.pinSetzen && !K.messen) {                                  /* Pin setzen: einmalig */
      const c = koordUm(ev), P = karteProj();
      K.pinSetzen = false;
      dispatch({ type: 'PIN_ANGELEGT', ll: [P.lat(c[1]), P.lon(c[0])] });
      renderModule();
      return;
    }
    if (K.zoneSetzen) {                                              /* Zone markieren: einmalig, danach normales Verhalten */
      const c = koordUm(ev), P = karteProj(), eigen = K.zoneSetzen === 'eigen';
      K.zoneSetzen = false;
      dispatch({ type: eigen ? 'OZONE_ANGELEGT' : 'ZONE_ANGELEGT', ll: [P.lat(c[1]), P.lon(c[0])] });
      renderModule();
      return;
    }
    const zt = !t && !vt && ev.target && ev.target.closest ? ev.target.closest('.k-zone') : null;
    if (zt && !K.messen) {
      const zid = zt.getAttribute('data-id');
      const zo = karteZoneFinden(zid), vorher = K.auswahl ? karteZoneFinden(K.auswahl) : null;
      /* Mehrfachbearbeitung gilt nur für Zonen des Auftrags; eigene Zonen werden einzeln bearbeitet */
      if ((ev.shiftKey || ev.ctrlKey || ev.metaKey || K.mehrModus) && !(zo && zo.profil)) {   /* Mehrfachauswahl: Zone zur Auswahl hinzufügen oder entfernen */
        K.mehr = K.mehr || [];
        if (!K.mehr.length && K.auswahl && K.auswahl !== zid && vorher && !vorher.profil) K.mehr.push(K.auswahl);   /* die bisher gewählte Zone zählt mit */
        const i = K.mehr.indexOf(zid); if (i >= 0) K.mehr.splice(i, 1); else K.mehr.push(zid);
        K.auswahl = null; delete VIEW.draft['mz-weg'];
        karteAuswahlAnzeige(); neu();
        return;
      }
      karteWaehlen(zid, false); return;
    }
    if (K.messen) {                                                  /* Messwerkzeug: Punkte setzen, an Markierungen einrasten */
      const c = koordUm(ev), P = karteProj();
      const mk = t ? karteMarker().find(function (x) { return x.id === t.getAttribute('data-id'); }) : null;
      const ll = mk ? mk.ll : [P.lat(c[1]), P.lon(c[0])];
      K.messPts = (K.messPts.length >= 2 ? [] : K.messPts).concat([ll]);
      if (K.messPts.length >= 2) { K.messen = false; renderModule(); return; }      /* Messung ist einmalig: danach arbeiten Markierungen und Popups wieder normal */
      neu();
      return;
    }
    karteWaehlen(t ? t.getAttribute('data-id') : vt ? vt.getAttribute('data-vid') : null, false);
  };
  const tip = function (ev, id) {
    const box = $('k-tip'); if (!box) return;
    if (!id) { box.hidden = true; return; }
    const m = karteMarker().find(function (x) { return x.id === id; });
    if (!m) { box.hidden = true; return; }
    const wrap = svg.parentNode.getBoundingClientRect();
    box.textContent = m.name + (m.kat === 'sichtung' ? '' : m.entitaet ? ' · ' + (entitaet(m.id) ? entitaet(m.id).typ : '') : '');
    box.hidden = false; box.style.left = (ev.clientX - wrap.left + 14) + 'px'; box.style.top = (ev.clientY - wrap.top + 12) + 'px';
  };
  svg.addEventListener('pointerover', function (ev) {
    if (zug) return;
    const t = ev.target && ev.target.closest ? ev.target.closest('.k-marker') : null;
    if (t) { karteFokus(svg, t.getAttribute('data-id')); tip(ev, t.getAttribute('data-id')); }
  });
  svg.addEventListener('pointerout', function (ev) {
    const t = ev.target && ev.target.closest ? ev.target.closest('.k-marker') : null;
    if (t) { karteFokus(svg, null); tip(ev, null); }
  });
  svg.addEventListener('pointermove', function (ev) {
    const t = ev.target && ev.target.closest ? ev.target.closest('.k-marker') : null;
    if (t && !zug) tip(ev, t.getAttribute('data-id'));
  });
  svg.addEventListener('pointerup', function (ev) { const z = zug; zug = null; if (z && !z.bewegt) klick({ target: z.ziel, clientX: ev.clientX, clientY: ev.clientY, shiftKey: ev.shiftKey, ctrlKey: ev.ctrlKey, metaKey: ev.metaKey }); });
  svg.addEventListener('pointercancel', function () { zug = null; });
  svg.addEventListener('dblclick', function (ev) { if (K.pick) return; const c = koordUm(ev); zoomUm(1, c[0], c[1]); });
  svg.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape' && (K.messen || K.pick || K.pinSetzen || K.zoneSetzen || K.zugriffSetzen || (K.mehr && K.mehr.length) || K.mehrModus)) { K.pinSetzen = false; K.messen = false; K.messPts = []; K.pick = null; K.zoneSetzen = false; K.zugriffSetzen = false; K.mehr = []; K.mehrModus = false; K.auswahl = null; renderModule(); return; }
    const t = ev.target && ev.target.closest ? ev.target.closest('.k-marker') : null;
    if (t && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); klick({ target: t, clientX: 0, clientY: 0 }); }
  });
  return { zoom: function (dz) { zoomUm(dz, KW / 2, KH / 2); }, neu: neu, klick: klick };
}
/* =====================================================================
   KARTENPROTOKOLL: Reiter neben der Lagekarte. Erfasst Vorgänge mit Kartenbezug (Sichtungen, Zonen, Pins, Zugriffspunkte, Positionen,
   Ausgangsorte), nicht aber Mausbewegungen, Zoom oder Auswahl. Verfall nach Wahl: 24, 48, 72 Stunden oder nie (Voreinstellung nie).
   Der Verfall entfernt nur Protokolleinträge, nie die Sichtungen, Zonen oder Pins selbst. Liegt im Profil und überlebt das Zurücksetzen.
   ===================================================================== */
PROFIL.kartenProtokoll = Object.assign({ frist: 0, eintraege: [], seq: 0 }, PROFIL.kartenProtokoll || {});
PROFIL.kartenProtokoll.eintraege = Array.isArray(PROFIL.kartenProtokoll.eintraege) ? PROFIL.kartenProtokoll.eintraege : [];
PROFIL_AKTIONEN.KARTENPROTOKOLL_FRIST = 1; PROFIL_AKTIONEN.KARTENPROTOKOLL_LEEREN = 1;
const KP_FRISTEN = [[24, '24 Stunden'], [48, '48 Stunden'], [72, '72 Stunden'], [0, 'nie']];
const KP_ARTEN = ['Sichtung', 'Zone', 'Pin', 'Zugriffspunkt', 'Position', 'Ausgangsort'];
/* Ausdrücklich gekennzeichnete Aktionen: nur Eingaben und Änderungen der Person, nie simulierte Meldungen (Handler, Zonenereignisse),
   nie Missionsvorgänge. Entscheidend ist der Aktionstyp, nicht der Anzeigetext; "leicht" markierte Änderungen zählen mit. */
const KP_AKTIONEN = {
  SICHTUNG_HINZU: 'Sichtung', SICHTUNG_ENTFERNT: 'Sichtung', SICHTUNG_BEWERTET: 'Sichtung',
  PIN_ANGELEGT: 'Pin', PIN_GEAENDERT: 'Pin', PIN_ENTFERNT: 'Pin',
  ZONE_ANGELEGT: 'Zone', ZONE_GEAENDERT: 'Zone', ZONEN_MEHRFACH: 'Zone', ZONE_URTEIL: 'Zone', ZONE_ENTFERNT: 'Zone',
  OZONE_ANGELEGT: 'Zone', OZONE_GEAENDERT: 'Zone', OZONE_STAND: 'Zone', OZONE_UNTERLAGE: 'Zone', OZONE_ENTFERNT: 'Zone',
  DOSSIER_ORT: 'Position',
  AUSGANG_ANGELEGT: 'Ausgangsort', AUSGANG_GELOESCHT: 'Ausgangsort', AUSGANG_ORT: 'Ausgangsort'
};
function kpArt(typ, aktion) {
  const art = KP_AKTIONEN[typ];
  if (!art) return null;
  return art === 'Zone' && /Zugriffspunkt/.test(String(aktion || '')) ? 'Zugriffspunkt' : art;   /* Unterart nur zur Anzeige */
}
/* entfernt abgelaufene Einträge; liefert die Zahl der entfernten */
function kpVerfall(frist, nur) {
  const P = PROFIL.kartenProtokoll, f = frist === undefined ? P.frist : frist;
  if (!f) return 0;
  const grenze = Date.now() - f * 3600000, weg = P.eintraege.filter(function (x) { return Date.parse(x.t) < grenze; }).length;
  if (!nur && weg) P.eintraege = P.eintraege.filter(function (x) { return Date.parse(x.t) >= grenze; });
  return weg;
}
/* wird von dispatch für jeden Protokolleintrag aufgerufen; true, wenn das Kartenprotokoll sich geändert hat */
function kartenProtokollErfassen(eintrag, ereignis, typ) {
  if (eintrag.modul === 'Mission') return false;
  const art = kpArt(typ, eintrag.aktion);
  if (!art) return false;
  const P = PROFIL.kartenProtokoll; P.seq += 1;
  const ein = { id: 'KP-' + p3(P.seq), t: eintrag.t, art: art, aktion: eintrag.aktion, text: eintrag.detail || '' };
  if (ereignis && typeof ereignis.objekt === 'string' && ereignis.objekt) { ein.objekt = ereignis.objekt; ein.objektName = String(ereignis.objektName || ereignis.objekt).slice(0, 60); }   /* Bezug zum Objekt (Zone, Pin) für den Filter */
  P.eintraege.push(ein);
  kpVerfall();
  return true;
}
/* räumt abgelaufene Einträge auf und speichert, wenn tatsächlich etwas entfernt wurde */
function kpAufraeumen() {
  const n = kpVerfall();
  if (n) profilSpeichern();
  return n;
}
/* Beim Laden: abgelaufene Einträge entfernen und nur das Protokoll im gespeicherten Profil nachziehen. profilSpeichern() ist hier
   nicht zulässig, weil es den Stand der Dossiers aus STATE übernähme, bevor die Anwendung gestartet ist. */
if (kpVerfall()) {
  try {
    const roh = window.localStorage.getItem(PROFIL_KEY), o = roh ? JSON.parse(roh) : null;
    if (o && o.v === 1) { o.kartenProtokoll = PROFIL.kartenProtokoll; window.localStorage.setItem(PROFIL_KEY, JSON.stringify(o)); }
  } catch (ex) { /* bleibt im Arbeitsspeicher; die nächste Speicherung zieht es nach */ }
}
ACTIONS.KARTENPROTOKOLL_FRIST = function (a) {
  const f = Number(a.stunden), P = PROFIL.kartenProtokoll;
  if (!KP_FRISTEN.some(function (x) { return x[0] === f; }) || f === P.frist) return null;
  const alt = P.frist; P.frist = f; const weg = kpVerfall();
  return { modul: 'Karte', aktion: 'Protokollfrist geändert', detail: (alt ? alt + ' h' : 'nie') + ' → ' + (f ? f + ' h' : 'nie') + (weg ? '; ' + weg + ' abgelaufene Einträge entfernt' : '') };
};
ACTIONS.KARTENPROTOKOLL_LEEREN = function () {
  const P = PROFIL.kartenProtokoll, n = P.eintraege.length;
  if (!n) return null;
  P.eintraege = [];
  return { modul: 'Karte', aktion: 'Protokoll geleert', detail: n + ' Einträge des Kartenprotokolls entfernt' };
};
function kartenReiter(aktiv) {
  kpAufraeumen();
  const n = PROFIL.kartenProtokoll.eintraege.length;
  return h('div', { class: 'reiterleiste', role: 'tablist', 'aria-label': 'Bereiche der Karte' },
    [['karte', 'Lagekarte'], ['protokoll', 'Protokoll (' + n + ')']].map(function (x) {
      return h('button', { type: 'button', role: 'tab', id: 'ktab-' + x[0], 'aria-selected': aktiv === x[0] ? 'true' : 'false', class: aktiv === x[0] ? 'reiter on' : 'reiter', onclick: function () { VIEW.karte.reiter = x[0]; renderModule(); } }, x[1]);
    }));
}
function kartenProtokollAnsicht() {
  const P = PROFIL.kartenProtokoll, K = VIEW.karte, filter = KP_ARTEN.indexOf(K.kpFilter) >= 0 ? K.kpFilter : '';
  kpAufraeumen();
  /* Anzeigename: aktueller Name des Objekts, solange es besteht, sonst der beim Eintrag festgehaltene */
  const objName = function (x) { const z = (PROFIL.zonen || []).find(function (y) { return y.id === x.objekt; }), pn = (PROFIL.pins || []).find(function (y) { return y.id === x.objekt; }); return (z || pn || {}).name || x.objektName || x.objekt; };
  const objekte = {}; P.eintraege.forEach(function (x) { if (x.objekt) objekte[x.objekt] = objName(x); });
  const objFilter = K.kpObjekt && objekte[K.kpObjekt] ? K.kpObjekt : '';
  const liste = P.eintraege.filter(function (x) { return (!filter || x.art === filter) && (!objFilter || x.objekt === objFilter); }).slice().sort(function (a, b) { return Date.parse(b.t) - Date.parse(a.t); });
  return panel('Kartenprotokoll', [h('span', { class: 'badge' }, String(liste.length))],
    h('p', { class: 'note pad' }, 'Vorgänge mit Kartenbezug: Sichtungen, Zonen, Pins, Zugriffspunkte, Kartenpositionen und Ausgangsorte. Mausbewegungen, Zoom und Auswahl werden nicht erfasst. Der Verfall entfernt nur den Protokolleintrag, nicht die Sichtung, Zone oder den Pin selbst.'),
    h('div', { class: 'row pad' },
      h('label', { for: 'kp-frist' }, 'Verfall nach'),
      h('select', { id: 'kp-frist', 'aria-label': 'Verfall der Protokolleinträge', onchange: function (ev) {
        const f = Number(ev.target.value), weg = f ? kpVerfall(f, true) : 0;
        if (weg) { renderModule(); bestaetigen('Protokollfrist verkürzen', weg + ' Protokolleinträge sind älter als ' + f + ' Stunden und werden entfernt.', 'Frist setzen', function () { dispatch({ type: 'KARTENPROTOKOLL_FRIST', stunden: f }); }); return; }
        dispatch({ type: 'KARTENPROTOKOLL_FRIST', stunden: f });
      } }, KP_FRISTEN.map(function (x) { return h('option', { value: String(x[0]), selected: x[0] === P.frist }, x[1]); })),
      h('label', { for: 'kp-objekt' }, 'Objekt'),
      h('select', { id: 'kp-objekt', 'aria-label': 'Objekt der Einträge', onchange: function (ev) { K.kpObjekt = ev.target.value; renderModule(); } },
        [h('option', { value: '' }, 'alle')].concat(Object.keys(objekte).sort().map(function (id) { return h('option', { value: id, selected: id === objFilter }, objekte[id]); }))),
      h('label', { for: 'kp-filter' }, 'Art'),
      h('select', { id: 'kp-filter', 'aria-label': 'Art der Einträge', onchange: function (ev) { K.kpFilter = ev.target.value; renderModule(); } },
        [h('option', { value: '' }, 'alle')].concat(KP_ARTEN.map(function (a) { return h('option', { value: a, selected: a === filter }, a); }))),
      h('button', { type: 'button', id: 'kp-leeren', disabled: !P.eintraege.length, onclick: function () {
        bestaetigen('Kartenprotokoll leeren', 'Alle ' + P.eintraege.length + ' Einträge des Kartenprotokolls werden entfernt. Sichtungen, Zonen und Pins bleiben bestehen.', 'Protokoll leeren', function () { dispatch({ type: 'KARTENPROTOKOLL_LEEREN' }); });
      } }, 'Protokoll leeren')),
    tabelle(['Zeit (UTC)', 'Art', 'Objekt', 'Vorgang', 'Einzelheiten', 'Verfällt (UTC)'], liste.map(function (x) {
      return [td('nw', fmtZ(x.t)), td('nw', x.art), td('nw', x.objekt ? objName(x) : '–'), td('nw', x.aktion), td('txt', x.text || '–'), td('nw', P.frist ? fmtZ(new Date(Date.parse(x.t) + P.frist * 3600000).toISOString()) : 'nie')];
    }), filter || objFilter ? 'Keine Einträge dieser Auswahl.' : 'Noch keine Einträge.'));
}
function renderKarte(m) {
  const K = VIEW.karte, def = karteAuftragsansicht();
  if (K.reiter === 'protokoll') return [modKopf(m), kartenReiter('protokoll'), kartenProtokollAnsicht()];
  if (!K.init) { karteGrundansicht(); K.init = true; }
  if (K.spiel) { clearInterval(K.spiel); K.spiel = null; }
  if (!def) {
    if (K.zoneSetzen === true) K.zoneSetzen = false;
    if (K.pick && (K.pick === 'CI-AUS' || K.pick.indexOf('ZP-') === 0)) K.pick = null;
    K.zugriffSetzen = false;
    K.mehr = [];
    K.mehrModus = false;
  }
  const svg = s('svg', { id: 'k-svg', class: 'karte-svg' + (K.pick || K.pinSetzen || K.zoneSetzen || K.zugriffSetzen ? ' pick' : '') + (K.messen ? ' messen' : ''), viewBox: '0 0 ' + KW + ' ' + KH, role: 'application', tabindex: '-1', 'aria-label': 'Karte, mit Maus ziehen und Mausrad zoomen' });
  const st = karteSteuerung(svg); KARTE_ST = st;
  const knopf = function (id, text, fn) { return h('button', { type: 'button', id: id, onclick: fn }, text); };
  /* Ebenenleiste: ein Eintrag kann mehrere technische Ebenen schalten; das Symbol zeigt, wie die Ebene auf der Karte aussieht */
  const ik = function () { return s.apply(null, ['svg', { class: 'k-ik', viewBox: '0 0 14 14', 'aria-hidden': 'true' }].concat([].slice.call(arguments))); };
  const IKON = {
    standorte: ik(s('circle', { cx: 7, cy: 7, r: 5, class: 'k-m standort' }), s('line', { x1: 4.5, y1: 7, x2: 9.5, y2: 7, class: 'k-kreuz' }), s('line', { x1: 7, y1: 4.5, x2: 7, y2: 9.5, class: 'k-kreuz' })),
    personen: ik(s('circle', { cx: 7, cy: 7, r: 5.5, class: 'k-m person' }), s('circle', { cx: 7, cy: 5.6, r: 1.6, class: 'k-glyph' }), s('path', { d: 'M 4 10 Q 7 6.6 10 10', class: 'k-glyph' })),
    organisationen: ik(s('rect', { x: 2, y: 2, width: 10, height: 10, rx: 1.5, class: 'k-m org' }), s('line', { x1: 5, y1: 5, x2: 5, y2: 9, class: 'k-glyph org' }), s('line', { x1: 9, y1: 5, x2: 9, y2: 9, class: 'k-glyph org' })),
    verbindungen: ik(s('line', { x1: 1.5, y1: 11.5, x2: 12.5, y2: 2.5, class: 'k-verb stark' })),
    fenster: ik(s('circle', { cx: 7, cy: 7, r: 5.5, class: 'k-fenster-fl aktiv' }), s('circle', { cx: 7, cy: 7, r: 5.5, class: 'k-fenster aktiv' })),
    ausgang: ik(s('polygon', { points: '7,2 12,11 2,11', class: 'k-m ausgang' })),
    zonen: ik(s('circle', { cx: 7, cy: 7, r: 5.5, style: 'fill:rgba(201,160,74,.2);stroke:#C9A04A;stroke-width:1.2;stroke-dasharray:3 2' })),
    sichtungen: ik(s('polygon', { points: '7,2 12,11 2,11', class: 'k-m sichtung' })),
    strecke: ik(s('path', { d: 'M 1 11 L 5 5 L 9 8 L 13 2', class: 'k-strecke' }))
  };
  const ebene = function (keys, text, ikon, titel) {
    keys = [].concat(keys);
    return h('label', { class: 'k-ebene', title: titel || null },
      h('input', { type: 'checkbox', id: 'ke-' + keys[0], checked: keys.some(function (k) { return K.ebenen[k]; }), onchange: function (ev) { keys.forEach(function (k) { K.ebenen[k] = ev.target.checked; }); karteWahlSichern(); st.neu(); karteAuswahlAnzeige(); karteFensterListe(); if (keys[0] === 'kacheln') renderModule(); } }),
      ikon || h('span', { class: 'k-ik leer' }), h('span', null, text));
  };
  const pickE = K.pick ? (K.pick.indexOf('SI:') === 0 ? (entitaet(K.pick.slice(3)) ? { id: 'Sichtung zu ' + K.pick.slice(3), name: entitaet(K.pick.slice(3)).name } : null) : K.pick === 'CI-AUS' ? { id: 'Check-in', name: 'Ausweichort' } : K.pick.indexOf('AO-') === 0 ? (PROFIL.ausgang.find(function (x) { return x.id === K.pick; }) || null) : K.pick.indexOf('ZP-') === 0 ? { id: K.pick, name: 'Zugriffspunkt' } : entitaet(K.pick)) : null;
  const kopf = [knopf('k-raum', 'Region', function () { const a = { lat: K.lat, lon: K.lon, zoom: K.zoom }; karteGrundansicht(); const z = { lat: K.lat, lon: K.lon, zoom: K.zoom }; K.lat = a.lat; K.lon = a.lon; K.zoom = a.zoom; karteFlug(z.lat, z.lon, z.zoom); }),
    knopf('k-eu', 'Europa', function () { karteFlug(50, 10, 4.4); }),
    knopf('k-welt', 'Welt', function () { karteFlug(25, 20, 1.9); }),
    h('button', { type: 'button', id: 'k-pin-neu', class: K.pinSetzen ? 'aktiv' : '', 'aria-pressed': K.pinSetzen ? 'true' : 'false', title: 'Auf die Karte klicken: setzt einen eigenen Pin mit Lageblatt (Zweck, Umgebung, Notiz, Textexport)', onclick: function () { K.pinSetzen = !K.pinSetzen; K.zoneSetzen = false; K.zugriffSetzen = false; K.messen = false; K.messPts = []; renderModule(); } }, K.pinSetzen ? 'Pin: auf Karte klicken' : 'Pin setzen'),
    h('button', { type: 'button', id: 'k-ozone-neu', class: K.zoneSetzen === 'eigen' ? 'aktiv' : '', 'aria-pressed': K.zoneSetzen === 'eigen' ? 'true' : 'false', title: 'Auf die Karte klicken: setzt eine eigene Zone mit Radius, Notiz und Stand', onclick: function () { K.zoneSetzen = K.zoneSetzen === 'eigen' ? false : 'eigen'; K.pinSetzen = false; K.zugriffSetzen = false; K.messen = false; K.messPts = []; renderModule(); } }, K.zoneSetzen === 'eigen' ? 'Zone: auf Karte klicken' : 'Zone markieren'),
    def ? h('button', { type: 'button', id: 'k-zone-neu', class: K.zoneSetzen === true ? 'aktiv' : '', 'aria-pressed': K.zoneSetzen === true ? 'true' : 'false', title: 'Auf die Karte klicken: setzt eine Lagezone mit Radius und Sicherheitsbewertung', onclick: function () { K.zoneSetzen = K.zoneSetzen === true ? false : true; K.messen = false; K.messPts = []; renderModule(); } }, K.zoneSetzen === true ? 'Lagezone: auf Karte klicken' : 'Lagezone (Auftrag)') : null,
    def ? h('button', { type: 'button', id: 'k-zugriff-neu', class: K.zugriffSetzen ? 'aktiv' : '', 'aria-pressed': K.zugriffSetzen ? 'true' : 'false', title: 'Wiederholt auf die Karte klicken: markiert mögliche Zugriffspunkte. Ende mit Esc oder erneutem Klick', onclick: function () { K.zugriffSetzen = !K.zugriffSetzen; K.zoneSetzen = false; K.messen = false; K.messPts = []; renderModule(); } }, K.zugriffSetzen ? 'Zugriffspunkte: klicken, Ende mit Esc' : 'Zugriffspunkte markieren') : null,
    def ? h('button', { type: 'button', id: 'k-mehr', class: K.mehrModus ? 'aktiv' : '', 'aria-pressed': K.mehrModus ? 'true' : 'false', title: 'Zonen nacheinander anklicken, um mehrere gemeinsam zu bearbeiten (auch mit Umschalt- oder Strg-Klick)', onclick: function () { K.mehrModus = !K.mehrModus; if (!K.mehrModus) { K.mehr = []; } K.zoneSetzen = false; K.zugriffSetzen = false; K.messen = false; renderModule(); } }, K.mehrModus ? 'Mehrfach: Zonen anklicken' : 'Mehrfach') : null,
    h('button', { type: 'button', id: 'k-messen', class: K.messen ? 'aktiv' : '', 'aria-pressed': K.messen ? 'true' : 'false', title: 'Zwei Punkte oder Markierungen anklicken: Entfernung und Fahrzeit', onclick: function () { if (K.messen || K.messPts.length) { K.messen = false; K.messPts = []; } else { K.messen = true; K.auswahl = null; } renderModule(); } }, K.messen ? 'Messen beenden' : K.messPts.length ? 'Messung löschen' : 'Messen'),
    h('button', { type: 'button', id: 'k-3d', class: K.ansicht3d ? 'aktiv' : '', 'aria-pressed': K.ansicht3d ? 'true' : 'false', title: 'Wechselt zwischen der flachen Karte und der geneigten Ansicht mit Gebäuden (benötigt Internetverbindung)', onclick: karte3dUmschalten }, K.ansicht3d ? '2D' : '3D')];
  const preset = function (name, sets) {
    const aktiv = Object.keys(sets).every(function (k) { return !!K.ebenen[k] === sets[k]; });
    return h('button', { type: 'button', class: aktiv ? 'aktiv' : '', 'aria-pressed': aktiv ? 'true' : 'false', id: 'k-p-' + name.toLowerCase(), onclick: function () { Object.keys(sets).forEach(function (k) { K.ebenen[k] = sets[k]; }); karteWahlSichern(); renderModule(); } }, name);
  };
  const suche = h('div', { class: 'k-suche' },
    h('input', { type: 'search', id: 'k-suche', placeholder: 'Suchen: Name oder Kennung', 'aria-label': 'Karte durchsuchen', autocomplete: 'off', spellcheck: 'false', value: K.suche || '',
      oninput: function (ev) {
        K.suche = ev.target.value; const q = falten(K.suche).trim(), ul = $('k-suche-erg'); if (!ul) return;
        const tr = q.length < 2 ? [] : karteMarker().filter(function (m) { return m.kat !== 'sichtung' && falten(m.id + ' ' + m.name).indexOf(q) >= 0; }).slice(0, 6);
        ul.replaceChildren.apply(ul, tr.map(function (m) { return h('li', null, h('button', { type: 'button', class: 'link', onclick: function () { K.suche = ''; $('k-suche').value = ''; ul.replaceChildren(); karteWaehlen(m.id, true); } }, m.name)); }));
      } }),
    h('ul', { id: 'k-suche-erg', class: 'k-suche-erg' }));
  const zeit = def ? h('input', { type: 'range', id: 'k-dt', min: '-12', max: '96', step: '1', value: String(K.dt), 'aria-label': 'Zeitpunkt relativ zu jetzt in Stunden',
    oninput: function (ev) { K.dt = Number(ev.target.value); st.neu(); karteFensterListe(); karteAuswahlAnzeige(); } }) : null;
  const Z0 = K.ebenen;
  const leiste = h('div', { class: 'k-ebenen', id: 'k-ebenen' },
    h('button', { type: 'button', class: 'k-eb-kopf', id: 'k-eb-t', 'aria-expanded': K.ebenenOffen ? 'true' : 'false', onclick: function () { K.ebenenOffen = !K.ebenenOffen; renderModule(); } }, h('span', null, 'EBENEN'), h('span', { class: 'k-eb-pfeil' }, K.ebenenOffen ? '–' : '+')),
    K.ebenenOffen ? h('div', { class: 'k-eb-body' },
      suche,
      h('div', { class: 'k-eb-gruppe' }, 'Grundlage'),
      h('div', { class: 'k-seg k-basis', role: 'group', 'aria-label': 'Kartengrundlage' },
        h('button', { type: 'button', id: 'k-b-offline', class: Z0.kacheln ? '' : 'aktiv', onclick: function () { K.ebenen.kacheln = false; karteWahlSichern(); renderModule(); } }, 'Offline'),
        h('button', { type: 'button', id: 'k-b-carto', class: Z0.kacheln && K.anbieter === 'carto' ? 'aktiv' : '', title: 'Der Anbieter sieht Ausschnitt, IP-Adresse und Ihren Schlüssel', onclick: function () { K.anbieter = 'carto'; K.ebenen.kacheln = !!(K.cartoKey || '').trim(); K.keyHinweis = !K.ebenen.kacheln; karteWahlSichern(); renderModule(); } }, 'CARTO dunkel'),
        h('button', { type: 'button', id: 'k-b-luft', class: Z0.kacheln && K.anbieter === 'luftbild' ? 'aktiv' : '', title: 'Amtliches Luftbild Berlin (20 cm). Außerhalb Berlins bleibt die dunkle Karte sichtbar, soweit ein CARTO-Schlüssel hinterlegt ist', onclick: function () { K.anbieter = 'luftbild'; K.ebenen.kacheln = true; karteWahlSichern(); renderModule(); } }, 'Luftbild'),
        h('button', { type: 'button', id: 'k-b-hybrid', class: Z0.kacheln && K.anbieter === 'hybrid' ? 'aktiv' : '', title: 'Luftbild mit Straßen- und Ortsnamen (CARTO-Schlüssel nötig)', onclick: function () { K.anbieter = 'hybrid'; K.ebenen.kacheln = true; K.keyHinweis = !(K.cartoKey || '').trim(); karteWahlSichern(); renderModule(); } }, 'Hybrid')),
      (K.anbieter === 'luftbild' || K.anbieter === 'hybrid') && Z0.kacheln ? h('p', { class: 'k-eb-note' }, 'Luftbild wird lokal zwischengespeichert (30 Tage). ', h('button', { type: 'button', class: 'link', id: 'k-kc-leer', title: 'Löscht die lokal gespeicherten Luftbild-Kacheln', onclick: function () { KCACHE.leeren().then(function () { KACHELN.clear(); meldung('Bildspeicher geleert.'); renderModule(); }); } }, 'Leeren')) : null,
      (K.anbieter === 'luftbild' || K.anbieter === 'hybrid') && Z0.kacheln ? h('div', { class: 'k-quellen' }, Object.keys(SAT_QUELLEN).map(function (k) {
        return h('label', { class: 'k-ebene', title: SAT_QUELLEN[k].kurz }, h('input', { type: 'checkbox', id: 'k-q-' + k, checked: !K.quellenAus[k], onchange: function (ev) { K.quellenAus[k] = !ev.target.checked; KACHELN.forEach(function (v) { if (v.eb === k && v.el.parentNode) v.el.parentNode.removeChild(v.el); }); karteWahlSichern(); const sv = $('k-svg'); if (sv) zeichneKarte(sv); } }), h('span', null, SAT_QUELLEN[k].name));
      })) : null,
      K.keyHinweis ? h('p', { class: 'k-eb-note k-key-hinweis' }, 'CARTO verlangt einen kostenlosen Schlüssel (carto.com/basemaps/apikey). Unter Darstellung eintragen.') : null,
      h('div', { class: 'k-eb-gruppe' }, 'Ansicht'),
      h('div', { class: 'k-seg', role: 'group', 'aria-label': 'Ansicht' },
        preset('Gesamt', Object.assign({ orte: true, personen: true, organisationen: true, verbindungen: true, ausgang: true, sichtungen: true }, def ? { standorte: true, fenster: true, route: true, strecke: true } : {})),
        preset('Netzwerk', Object.assign({ orte: true, personen: true, organisationen: true, verbindungen: true, ausgang: false, sichtungen: false }, def ? { standorte: true, fenster: false, route: false, strecke: false } : {})),
        def ? preset('Zeit', { standorte: true, orte: true, personen: false, organisationen: false, verbindungen: false, fenster: true, ausgang: true, route: true, sichtungen: true, strecke: true }) : null),
      h('div', { class: 'k-eb-gruppe' }, 'Karte'),
      ebene(def ? ['standorte', 'orte'] : 'orte', def ? 'Standorte und Orte' : 'Orte', IKON.standorte),
      ebene('personen', 'Personen', IKON.personen),
      ebene('organisationen', 'Organisationen', IKON.organisationen),
      ebene('verbindungen', 'Verbindungen', IKON.verbindungen, 'Linien zwischen sichtbaren, verknüpften Dossiers'),
      def ? ebene('fenster', 'Zeitfenster', IKON.fenster, 'Meldefenster und Termine; außerhalb aller aktiven Fenster wird die Karte abgedunkelt') : null,
      ebene(def ? ['ausgang', 'route'] : 'ausgang', def ? 'Eigener Standort' : 'Ausgangsorte', IKON.ausgang, def ? 'Ausgangsorte, letzter Check-in und Anreiseroute' : 'Ausgangsorte aus dem Profil'),
      def ? h('div', { class: 'k-eb-gruppe' }, 'Auftrag') : null,
      ebene('zonen', def ? 'Lagezonen' : 'Eigene Zonen', IKON.zonen, def ? 'Eine Zone je Standort mit eigener Lagebewertung, dazu die eigenen Zonen' : 'Zonen aus dem Profil'),
      ebene('sichtungen', 'Sichtungen', IKON.sichtungen),
      def ? ebene('strecke', 'Vermutete Transportroute', IKON.strecke) : null,
      h('details', { class: 'k-eb-det', open: !!K.keyHinweis }, h('summary', null, 'Darstellung'),
        ebene('gelaende', 'Gewässer und Siedlungen'), ebene('strassen', 'Fernstraßen'), ebene('namen', 'Ortsnamen'), ebene('kacheln', 'Online-Kacheln'),
        h('select', { id: 'k-anbieter', 'aria-label': 'Anbieter der Kacheln', onchange: function (ev) { K.anbieter = ev.target.value; karteWahlSichern(); st.neu(); renderModule(); } },
          h('option', { value: 'carto', selected: K.anbieter === 'carto' }, 'CARTO dunkel'), h('option', { value: 'luftbild', selected: K.anbieter === 'luftbild' }, 'Luftbild Berlin'), h('option', { value: 'hybrid', selected: K.anbieter === 'hybrid' }, 'Luftbild mit Namen'), h('option', { value: 'osm', selected: K.anbieter === 'osm' }, 'OpenStreetMap'), h('option', { value: 'eigen', selected: K.anbieter === 'eigen' }, 'Eigene Kachel-URL')),
        h('label', { class: 'k-ebene' }, h('input', { type: 'checkbox', id: 'k-dunkel', checked: K.dunkel, onchange: function (ev) { K.dunkel = ev.target.checked; karteWahlSichern(); st.neu(); } }), h('span', { class: 'k-ik leer' }), h('span', null, 'Kacheln abdunkeln')),
        K.anbieter === 'carto' ? h('select', { id: 'k-carto-stil', 'aria-label': 'Stil der CARTO-Karte', onchange: function (ev) { K.cartoStil = ev.target.value; karteWahlSichern(); st.neu(); } }, h('option', { value: 'dark_all', selected: K.cartoStil !== 'dark_nolabels' }, 'Dunkel mit Namen'), h('option', { value: 'dark_nolabels', selected: K.cartoStil === 'dark_nolabels' }, 'Dunkel ohne Namen (ruhiger)')) : null,
        (K.anbieter === 'carto' || K.anbieter === 'hybrid' || K.anbieter === 'luftbild') ? h('input', { type: 'password', id: 'k-carto-key', class: 'k-url', value: K.cartoKey || '', placeholder: 'CARTO-Schlüssel (Groß-/Kleinschreibung beachten)', 'aria-label': 'CARTO-Schlüssel', autocomplete: 'off', spellcheck: 'false',
          onchange: function (ev) { K.cartoKey = ev.target.value.trim(); K.keyHinweis = false; if (K.cartoKey) K.ebenen.kacheln = true; karteWahlSichern(); renderModule(); } }) : null,
        K.anbieter === 'eigen' ? h('input', { type: 'text', id: 'k-url', class: 'k-url', value: K.url, placeholder: 'https://…/{z}/{x}/{y}.png', 'aria-label': 'Kachel-URL', autocomplete: 'off', spellcheck: 'false',
          onchange: function (ev) { K.url = ev.target.value; karteWahlSichern(); st.neu(); } }) : null,
        h('p', { class: 'k-eb-note' }, 'Online-Kacheln sind standardmäßig aus. Eingeschaltet lädt der Browser Kacheln vom Anbieter; dieser sieht Ausschnitt, IP-Adresse und bei CARTO den Schlüssel. URL und Schlüssel bleiben nur in diesem Browser und werden nie exportiert.')),
      h('p', { class: 'k-eb-note' }, (def ? 'Roter Ring: Stufe 4 oder 5. ' : '') + 'Der gestrichelte Ring um eine Sichtung zeigt ihre räumliche Unschärfe und wächst mit ihrem Alter.')) : null);
  const res = [
    modKopf(m),
    kartenReiter('karte'),
    panel('Lagekarte', null,
      pickE ? h('div', { class: 'row k-pickbar' }, h('span', null, K.pick.indexOf('SI:') === 0 ? 'Klick auf die Karte setzt einen Sichtungsentwurf zu ' + K.pick.slice(3) + ' ' + pickE.name + '.' : 'Klick auf die Karte setzt die Position von ' + pickE.id + ' ' + pickE.name + '.'),
        knopf('k-pick-x', 'Abbrechen', function () { K.pick = null; renderModule(); })) : null,
      h('div', { class: 'row' }, kopf),
      h('div', { class: 'karte-wrap' + (K.ansicht3d ? ' ist3d' : '') }, svg, K.ansicht3d ? karte3dRahmen() : null, leiste,
        h('div', { class: 'k-status', id: 'k-status', 'aria-label': 'Lage' }),
        h('div', { class: 'k-popup', id: 'k-auswahl', hidden: true, 'aria-live': 'polite' }),
        h('div', { class: 'k-tip', id: 'k-tip', hidden: true }),
        h('div', { class: 'k-zoom' }, knopf('k-plus', '+', function () { st.zoom(0.8); }), knopf('k-minus', '−', function () { st.zoom(-0.8); })))),
    def ? panel('Zeitfenster-Overlay', null,
      h('div', { class: 'row' }, h('label', { for: 'k-dt' }, 'Zeitpunkt'), zeit, h('span', { class: 'mono', id: 'k-zeit' }),
        h('button', { type: 'button', id: 'k-spiel', 'aria-pressed': 'false', onclick: function (ev) {
          const b = ev.currentTarget;
          if (K.spiel) { clearInterval(K.spiel); K.spiel = null; b.textContent = 'Wiedergabe'; b.setAttribute('aria-pressed', 'false'); return; }
          if (K.dt >= 96) K.dt = -12;
          b.textContent = 'Anhalten'; b.setAttribute('aria-pressed', 'true');
          K.spiel = setInterval(function () {
            K.dt = Math.min(96, K.dt + 1);
            const sl = $('k-dt'); if (!sl || !$('k-svg')) { clearInterval(K.spiel); K.spiel = null; return; }
            sl.value = String(K.dt); st.neu(); karteFensterListe(); karteAuswahlAnzeige();
            if (K.dt >= 96) { clearInterval(K.spiel); K.spiel = null; b.textContent = 'Wiedergabe'; b.setAttribute('aria-pressed', 'false'); }
          }, 350);
        } }, 'Wiedergabe')),
      h('div', { id: 'k-fenster' }),
      h('p', { class: 'note pad' }, 'Der Schieber verschiebt den betrachteten Zeitpunkt von 12 Stunden zurück bis 96 Stunden voraus. Ringe auf der Karte: durchgezogen = aktiv, gestrichelt = ausstehend, schwach = abgelaufen. Ist kein Fenster aktiv, wird die Karte leicht abgedunkelt.')) : null
  ];
  const rt = karteStrecke();
  if (rt) res.push(panel(rt.titel, null,
    h('p', { class: 'note pad' }, rt.hinweis),
    h('table', { class: 'tbl' }, h('thead', null, h('tr', null, ['Abschnitt', 'Bewertung', 'Länge', 'Fahrzeit', 'Alternative'].map(function (t) { return h('th', null, t); }))),
      h('tbody', null, rt.abschnitte.map(function (x) {
        return h('tr', null, h('td', null, x.id + ' ' + x.titel), h('td', { class: 'mono' }, x.bewertung), h('td', { class: 'mono' }, x.km + ' km'), h('td', { class: 'mono' }, 'ca. ' + x.min + ' min'),
          h('td', { class: 'mono' }, x.alternative ? x.alternative.km + ' km, ca. ' + x.alternative.min + ' min' : 'keine'));
      }))),
    h('div', { class: 'pad' }, rt.abschnitte.map(function (x) { return h('p', { class: 'note' }, x.id + ': ' + x.text); }))));
  setTimeout(function () { zeichneKarte(svg); karteAuswahlAnzeige(); karteFensterListe(); }, 0);
  return res.filter(Boolean);
}

