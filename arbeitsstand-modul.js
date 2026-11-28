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
  const pin = (PROFIL.pins || []).find(function (p) { return p.id === id; });
  if (pin) return !pinGesperrt(pin);
  if (typeof karteZoneFinden === 'function' && karteZoneFinden(id)) return true;
  try {
    /* Alte Arbeitsstände enthalten nur die SI-Nummer. Auch ausgeblendete
       oder gesperrte Doppelgänger zählen bei der Eindeutigkeitsprüfung. */
    if (/^SI-/.test(id)) {
      let n = 0;
      Object.values(STATE.dossiers.entitaeten).forEach(function (d) {
        (d.sichtungen || []).forEach(function (si) { if (si.id === id) n++; });
      });
      if (n !== 1) return false;
    }
    return karteMarkerFinden(id, null) !== null;
  } catch (e) { return false; }
}
/* The logical zoom can reach 22.5 in V2. Keep old low-zoom states readable,
   reject malformed values explicitly instead of discarding a valid V2 camera. */
function asKarteKameraGueltig(k) {
  const g = KARTE_V2_KAMERA;
  return [k.lat, k.lon, k.zoom].every(Number.isFinite) && Math.abs(k.lat) <= g.maxLat &&
    Math.abs(k.lon) <= 180 && k.zoom >= 1 && k.zoom <= g.maxZoom + g.zoomOffset;
}
/* Wendet einen gespeicherten Stand an und nennt, was übersprungen wurde. Verändert nur Ansichtsdaten. */
function asAnwenden(s) {
  const uebersprungen = [];
  if (!s || typeof s !== 'object') return { ok: false, uebersprungen: uebersprungen };
  if (typeof s.dossier === 'string' && s.dossier) {
    const e = entitaet(s.dossier);
    const regOk = !e || !e.eigen || (!!s.dossierReg && asDossierReg(e.id) === s.dossierReg);   /* eigene Dossiers ohne belastbare Registernummer: überspringen */
    /* Der gespeicherte Arbeitsstand folgt dem aktuellen Recherchezugang; nur
       Identität/Registernummer und die manuelle Dossiersperre entscheiden. */
    if (e && regOk && dossierRechercheBestand().some(function (x) { return x.id === e.id; }) && !dossierGesperrt(e)) {
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
    if (asKarteKameraGueltig(k)) { K.lat = k.lat; K.lon = k.lon; K.zoom = k.zoom; K.init = true; }   /* init: die Karte soll beim ersten Aufbau nach dem Start nicht auf die Grundansicht zurückspringen */
    else uebersprungen.push('Kartenkamera');
    if (k.ebenen && typeof k.ebenen === 'object') Object.keys(K.ebenen).forEach(function (n) { if (typeof k.ebenen[n] === 'boolean') K.ebenen[n] = k.ebenen[n]; });
    if (typeof karteWahlSichern === 'function') karteWahlSichern();
    K.pick = null; K.messen = false; K.messPts = [];
    K.pinSetzen = false; K.zoneSetzen = false; K.zugriffSetzen = false;   /* kein Platziermodus aus der vorherigen Ansicht */
    /* Laufzeitidentität und Fokus gehören nicht zum gespeicherten Arbeitsstand. */
    K.auswahlIdentitaet = null; K.sichtungFokus = null; K.bezug = null; K.bezugRenderKey = null; K.popupVersatz = null;
    K.mehr = []; K.mehrModus = false;
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
    h('button', { type: 'button', id: 'as-speichern', title: 'Aktuelle Ansicht als Arbeitsstand speichern (F1)', onclick: asSpeichern }, 'Stand sichern'),
    h('button', { type: 'button', id: 'as-wieder', disabled: !vorhanden, title: vorhanden ? 'Gespeicherter Arbeitsstand vom ' + fmtZ(s.t) + ' (F2)' : 'Kein Arbeitsstand gespeichert', onclick: asWiederherstellen }, 'Stand laden')
  ];
}
function asNavigationAktualisieren() {
  const b = document.getElementById('as-wieder'), st = PROFIL.arbeitsstand, vorhanden = !!(st && st.t);
  if (!b) return;
  b.disabled = !vorhanden; b.title = vorhanden ? 'Gespeicherter Arbeitsstand vom ' + fmtZ(st.t) + ' (F2)' : 'Kein Arbeitsstand gespeichert';
}
