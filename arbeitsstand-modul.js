/* Arbeitsstand: ein bewusst gespeicherter Ansichtsstand (Arbeitsbereich, Dossier, Fall in X, Kartenmitte, Zoom, Ebenen, gewähltes Kartenobjekt).
   Gespeichert wird nur auf ausdrücklichen Klick, wiederhergestellt ebenso. Kein Sprung beim Start, keine Änderung am Fallpaket.
   Beim Wiederherstellen werden nicht mehr vorhandene, gesperrte oder nicht lesbare Objekte übersprungen. Klassisches Skript, wird nach dem Hauptskript geladen. */
/* Eigene Dossiers erhalten ihre Kennung wieder, wenn das zuletzt angelegte gelöscht wird: zusätzlich die Registernummer als Identität. */
function asDossierReg(id) {
  const e = id && entitaet(id);
  return e && e.eigen ? dossierRegisternummer(e, STATE.dossiers.entitaeten[e.id]) || null : null;
}
function asErfassen() {
  const K = VIEW.karte, ebenen = {};
  Object.keys(K.ebenen).forEach(function (k) { ebenen[k] = !!K.ebenen[k]; });
  return {
    t: nowIso(), modul: STATE.ui.modul, dossier: STATE.dossiers.auswahl || null, dtab: VIEW.dtab || null, dossierReg: asDossierReg(STATE.dossiers.auswahl), fall: (xAngezeigt() || {}).id || null, fallErfasst: (xAngezeigt() || {}).erfasst || null,
    karte: { lat: K.lat, lon: K.lon, zoom: K.zoom, ebenen: ebenen, auswahl: K.auswahl || null }
  };
}
function asAuswahlGueltig(id) {
  if (typeof id !== 'string' || !id) return false;
  if ((PROFIL.pins || []).some(function (p) { return p.id === id; })) return true;
  if (typeof karteZoneFinden === 'function' && karteZoneFinden(id)) return true;
  try { return karteMarker().some(function (m) { return m.id === id; }); } catch (e) { return false; }
}
/* Wendet einen gespeicherten Stand an und nennt, was übersprungen wurde. Verändert nur Ansichtsdaten. */
function asAnwenden(s) {
  const uebersprungen = [];
  if (!s || typeof s !== 'object') return { ok: false, uebersprungen: uebersprungen };
  if (typeof s.dossier === 'string' && s.dossier) {
    const e = entitaet(s.dossier);
    const regOk = !e || !e.eigen || (!!s.dossierReg && asDossierReg(e.id) === s.dossierReg);   /* eigene Dossiers ohne belastbare Registernummer: überspringen */
    if (e && regOk && dossierOffen(e.mission) && wissen(e) !== 'unbekannt' && !dossierGesperrt(e) && !infoGesperrt(e)) {
      STATE.dossiers.auswahl = e.id;
      if (s.dtab === 'info' || s.dtab === 'sichtungen' || s.dtab === 'chronik') VIEW.dtab = s.dtab;
    } else uebersprungen.push('Dossier ' + s.dossier);
  }
  if (typeof s.fall === 'string' && s.fall) {
    const f = xFall(s.fall);
    /* Nummern werden wiedervergeben: der Fall gilt nur bei gleicher Nummer und gleichem Erfassungszeitpunkt */
    if (f && s.fallErfasst && f.erfasst === s.fallErfasst) { X_VIEW.id = s.fall; X_VIEW.keine = false; } else { uebersprungen.push('Fall ' + s.fall); if (!xFall(X_VIEW.id)) X_VIEW.keine = true; }
  }
  const k = s.karte, K = VIEW.karte;
  if (k && typeof k === 'object') {
    if (isFinite(k.lat) && isFinite(k.lon) && Math.abs(k.lat) <= 85 && Math.abs(k.lon) <= 180 && isFinite(k.zoom) && k.zoom >= 1 && k.zoom <= 22) { K.lat = k.lat; K.lon = k.lon; K.zoom = k.zoom; K.init = true; }   /* init: die Karte soll beim ersten Aufbau nach dem Start nicht auf die Grundansicht zurückspringen */
    if (k.ebenen && typeof k.ebenen === 'object') Object.keys(K.ebenen).forEach(function (n) { if (typeof k.ebenen[n] === 'boolean') K.ebenen[n] = k.ebenen[n]; });
    if (typeof karteWahlSichern === 'function') karteWahlSichern();
    K.pick = null; K.messen = false; K.messPts = [];
    K.pinSetzen = false; K.zoneSetzen = false; K.zugriffSetzen = false;   /* kein Platziermodus aus der vorherigen Ansicht */
    if (k.auswahl) { if (asAuswahlGueltig(k.auswahl)) K.auswahl = k.auswahl; else { K.auswahl = null; uebersprungen.push('Kartenobjekt ' + k.auswahl); } } else K.auswahl = null;
  }
  const ziel = ARBEITSMODULE.some(function (m) { return m.id === s.modul; }) ? s.modul : 'profil';
  STATE.ui.modul = ziel;
  return { ok: true, uebersprungen: uebersprungen };
}
function asSpeichern() { dispatch({ type: 'ARBEITSSTAND_GESPEICHERT' }); }
function asWiederherstellen() { dispatch({ type: 'ARBEITSSTAND_WIEDERHERGESTELLT' }); }
function asNavigation() {
  const s = PROFIL.arbeitsstand, vorhanden = !!(s && s.t);
  return [
    h('button', { type: 'button', id: 'as-speichern', title: 'Aktuelle Ansicht als Arbeitsstand speichern', onclick: asSpeichern }, 'Stand sichern'),
    h('button', { type: 'button', id: 'as-wieder', disabled: !vorhanden, title: vorhanden ? 'Gespeicherter Arbeitsstand vom ' + fmtZ(s.t) : 'Kein Arbeitsstand gespeichert', onclick: asWiederherstellen }, 'Stand laden')
  ];
}
function asNavigationAktualisieren() {
  const b = document.getElementById('as-wieder'), st = PROFIL.arbeitsstand, vorhanden = !!(st && st.t);
  if (!b) return;
  b.disabled = !vorhanden; b.title = vorhanden ? 'Gespeicherter Arbeitsstand vom ' + fmtZ(st.t) : 'Kein Arbeitsstand gespeichert';
}
