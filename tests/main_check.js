
'use strict';
/* Die Szenariodaten (globales Objekt SCENARIO) stehen in szenario.js und werden vor diesem Skript geladen.
   Auf oberster Ebene dieses Skripts wird SCENARIO nicht ausgewertet; fehlt die Datei, zeigt szenarioFehlt() eine Meldung. */

/* =====================================================================
   GRUNDLAGEN
   ===================================================================== */
const STORAGE_KEY = 'fieldterminal.v1';
const STATE_VERSION = 4;                        /* Phase 4: Missionsstruktur; Zustände der Versionen 2 und 3 werden beim Laden überführt */
const LOG_LIMIT = 600;
let SESSION_START = Date.now();                /* Sitzungsdauer: je Laden, nicht persistent; beginnt mit der Freigabe am Zugangsschirm */
const ZUSTELL_MS = 2000;                         /* eigene Nachricht: gesendet → zugestellt, 2 s nach Versand */
const LESE_MS = 6000;                            /* eigene Nachricht: zugestellt → gelesen, 6 s nach Versand */
const DRINGLICHKEIT = ['Routine', 'Priorität', 'Sofort'];
const SAVE_DELAY = 1000;                        /* Automatisches Speichern von Freitext: 1 s nach der letzten Eingabe */
const MONATE = ['JAN','FEB','MRZ','APR','MAI','JUN','JUL','AUG','SEP','OKT','NOV','DEZ'];
const TAGE = ['So','Mo','Di','Mi','Do','Fr','Sa'];
const SVGNS = 'http://www.w3.org/2000/svg';

const MODULES = [
  { id: 'profil',     key: '1', titel: 'Agentenprofil',         log: 'Profil' },
  { id: 'mission',    key: '2', titel: 'Missionsbriefing',      log: 'Mission' },
  { id: 'dossier',    key: '3', titel: 'Dossier-Datenbank',     log: 'Dossier' },
  { id: 'komm',       key: '4', titel: 'Sichere Kommunikation', log: 'Kommunikation' },
  { id: 'extraktion', key: '5', titel: 'Panic / Extraktion',    log: 'Extraktion' },
  { id: 'karte',      key: '6', titel: 'Lagekarte',             log: 'Karte' },
  { id: 'akten',      key: '7', titel: 'Akten',                 log: 'Akten' }
];
const LOG_MODULE = ['System'].concat(MODULES.map(function (m) { return m.log; }));
const STATUS_LISTE = ['Ruhend', 'Standby', 'Aktiv', 'Erhöhtes Risiko', 'Extraktion ausstehend'];
const STATUS_KLASSE = { 'Ruhend': 's-dim', 'Aktiv': 's-accent', 'Standby': 's-dim', 'Erhöhtes Risiko': 's-warn', 'Extraktion ausstehend': 's-crit' };
const MISSION_KLASSE = { 'Planung': 's-dim', 'Laufend': 's-accent', 'Pausiert': 's-warn', 'Abgeschlossen': 's-dim' };

function p2(n) { return String(n).padStart(2, '0'); }
function p3(n) { return String(n).padStart(3, '0'); }
function nowIso() { return new Date().toISOString(); }
/* Date-Time-Group, z. B. 091432ZNOV26 */
function dtg(d) {
  d = (d instanceof Date) ? d : new Date(d);
  return p2(d.getUTCDate()) + p2(d.getUTCHours()) + p2(d.getUTCMinutes()) + 'Z' + MONATE[d.getUTCMonth()] + p2(d.getUTCFullYear() % 100);
}
/* Langform, z. B. 09.11.2026 14:32:07Z */
function fmtZ(d) {
  d = (d instanceof Date) ? d : new Date(d);
  if (isNaN(d)) return '–';
  return p2(d.getUTCDate()) + '.' + p2(d.getUTCMonth() + 1) + '.' + d.getUTCFullYear() + ' ' +
         p2(d.getUTCHours()) + ':' + p2(d.getUTCMinutes()) + ':' + p2(d.getUTCSeconds()) + 'Z';
}
function fmtDatum(d) {
  d = (d instanceof Date) ? d : new Date(d);
  if (isNaN(d)) return '–';
  return p2(d.getUTCDate()) + '.' + p2(d.getUTCMonth() + 1) + '.' + d.getUTCFullYear();
}
function fmtDauer(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return p2(Math.floor(s / 3600)) + ':' + p2(Math.floor(s / 60) % 60) + ':' + p2(s % 60);
}
/* Restzeit in Tagen, Stunden, Minuten, z. B. "2 d 04:10 h" */
function fmtRest(ms) {
  const m = Math.max(0, Math.floor(ms / 60000)), d = Math.floor(m / 1440);
  return (d ? d + ' d ' : '') + p2(Math.floor(m / 60) % 24) + ':' + p2(m % 60) + ' h';
}
/* Ortszeit des Einsatzraums: MEZ (UTC+1) bzw. MESZ (UTC+2, letzter Sonntag im März 0100Z bis letzter Sonntag im Oktober 0100Z) */
function ortszeit(d) {
  const y = d.getUTCFullYear();
  const letzterSonntag = function (monat) {
    const x = new Date(Date.UTC(y, monat + 1, 0, 1, 0, 0));
    x.setUTCDate(x.getUTCDate() - x.getUTCDay());
    return x.getTime();
  };
  const sommer = d.getTime() >= letzterSonntag(2) && d.getTime() < letzterSonntag(9);
  const l = new Date(d.getTime() + (sommer ? 2 : 1) * 3600000);
  return p2(l.getUTCHours()) + ':' + p2(l.getUTCMinutes()) + ':' + p2(l.getUTCSeconds()) + ' ' + (sommer ? 'MESZ' : 'MEZ');
}

/* DOM-Helfer: erzeugt Elemente ausschließlich über textContent, kein innerHTML mit Daten */
function appendKid(e, c) {
  if (c == null || c === false) return;
  if (Array.isArray(c)) { c.forEach(function (x) { appendKid(e, x); }); return; }
  e.appendChild(c.nodeType ? c : document.createTextNode(String(c)));
}
function h(tag, attrs) {
  const e = document.createElement(tag);
  let val;
  if (attrs) {
    Object.keys(attrs).forEach(function (k) {
      const v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'class') e.className = v;
      else if (k === 'value') val = v;
      else if (k === 'checked') e.checked = true;
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    });
  }
  for (let i = 2; i < arguments.length; i++) appendKid(e, arguments[i]);
  if (val !== undefined) e.value = val;
  return e;
}
function s(tag, attrs) {
  const e = document.createElementNS(SVGNS, tag);
  if (attrs) {
    Object.keys(attrs).forEach(function (k) {
      const v = attrs[k];
      if (v == null || v === false) return;
      if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v);
    });
  }
  for (let i = 2; i < arguments.length; i++) appendKid(e, arguments[i]);
  return e;
}
function $(id) { return document.getElementById(id); }
function statusLabel(status) { return h('span', { class: 'label ' + (STATUS_KLASSE[status] || 's-dim') }, status); }
function stufeKlasse(n) { return n >= 5 ? 's-crit' : n === 4 ? 's-warn' : ''; }
function stufeLabel(n) { return h('span', { class: 'label ' + stufeKlasse(n) }, 'Stufe ' + n + ' – ' + SCENARIO.bedrohungsstufen[n]); }
function land(code) { return h('abbr', { title: SCENARIO.laender[code] || code }, code); }
function eigeneDossiers() { return (typeof STATE !== 'undefined' && STATE && STATE.dossiers && STATE.dossiers.eigene) || []; }
function alleEntitaeten() { return SCENARIO.entitaeten.concat(SCENARIO.standard.dossiers, eigeneDossiers()); }
function entitaet(id) { return alleEntitaeten().find(function (e) { return e.id === id; }); }
function dossierQuelle(e) { return e.mission === 'STD' ? 'Standard' : e.mission; }
/* Missionen: KM = Kontextmission (zuletzt angenommene Mission; bestimmt Banner, Legende, Standorte, Meldewesen, Extraktionsoptionen),
   LM = laufende Mission oder null, MS = Zustand einer Mission. */
function missionDef(id) { return SCENARIO.missionen.find(function (m) { return m.id === id; }) || null; }
function KM() { return missionDef(STATE.kontext); }
function MS(id) { return STATE.missionen[id]; }
function LM() { const m = KM(); return m && MS(m.id).status === 'laufend' ? m : null; }
function zugewiesene() { return SCENARIO.missionen.find(function (m) { return MS(m.id).status === 'zugewiesen'; }) || null; }
function freigeschaltet(mid) { return mid === 'STD' || !!(STATE.missionen[mid] && STATE.missionen[mid].angenommenAm); }
function pool() { return alleEntitaeten().filter(function (e) { return freigeschaltet(e.mission); }); }
function kantenPool() {
  const alle = SCENARIO.verbindungen.concat(SCENARIO.standard.verbindungen, (STATE.dossiers && STATE.dossiers.eigeneKanten) || []);
  return alle.filter(function (v) { const a = entitaet(v.von), b = entitaet(v.nach); return a && b && freigeschaltet(v.mission) && freigeschaltet(a.mission) && freigeschaltet(b.mission); });
}
/* Geltende Bedrohungsbewertung: Grundbewertung oder jüngster freigeschalteter Nachtrag */
function bedrohung(e) {
  let b = e.bedrohung;
  (e.nachtraege || []).forEach(function (n) { if (n.bedrohung && freigeschaltet(n.mission)) b = n.bedrohung; });
  return b;
}
function standortName(id) {
  for (let i = 0; i < SCENARIO.missionen.length; i++) {
    const x = SCENARIO.missionen[i].standorte.find(function (o) { return o.id === id; });
    if (x) return x.name;
  }
  return '–';
}
function legende(id) {
  for (let i = 0; i < SCENARIO.missionen.length; i++) {
    const x = SCENARIO.missionen[i].legenden.find(function (l) { return l.id === id; });
    if (x) return x;
  }
  return null;
}
function ortText(c) { return c && c.standortId ? c.standortId + ' ' + standortName(c.standortId) : '–'; }
function opText(def) { return def.nummer + ' ' + def.name; }
function serienText(name, def) { return SCENARIO.serie.texte[name].replace('{OP}', opText(def)).replace('{AV}', def.aktenvermerk); }
const MZ_KLASSE = { 'offen': 's-dim', 'zugewiesen': 's-warn', 'laufend': 's-accent', 'abgeschlossen': 's-dim', 'abgelehnt': 's-crit', 'abgebrochen': 's-crit' };
function zustandLabel(st) { return h('span', { class: 'label ' + (MZ_KLASSE[st] || 's-dim') }, st); }
function kuerzen(t, n) { return t.length > n ? t.slice(0, n - 1) + '…' : t; }

/* Bausteine für dichte Ansichten */
function feld(k, v, cls) { return h('div', { class: 'field' + (cls ? ' ' + cls : '') }, h('dt', null, k), h('dd', null, v)); }
function panel(titel, kopf) {
  const sec = h('section', { class: 'panel' }, h('h2', null, titel, kopf));
  for (let i = 2; i < arguments.length; i++) appendKid(sec, arguments[i]);
  return sec;
}
function tabelle(kopf, zeilen, leer) {
  return h('div', { class: 'tw' }, h('table', null,
    h('thead', null, h('tr', null, kopf.map(function (k) { return h('th', { scope: 'col' }, k); }))),
    h('tbody', null, zeilen.length ? zeilen.map(function (z) {
      return h('tr', null, z.map(function (c) {
        return (c && c.nodeType === 1 && c.tagName === 'TD') ? c : h('td', null, c);
      }));
    }) : h('tr', null, h('td', { colspan: String(kopf.length), class: 'dim' }, leer || 'Keine Einträge.')))));
}
function td(cls, inhalt) { return h('td', { class: cls }, inhalt); }

/* =====================================================================
   MELDEWESEN (Meldefenster, Frist, Versäumnis)
   ===================================================================== */
/* Parameter (Fenster, Frist, ROE-Nummer, Eskalationstexte) stammen aus der Kontextmission.
   Das Meldewesen ruht ohne laufenden Auftrag und während einer Funkstille. */
function fristMs(def) { return def.meldewesen.fristMin * 60000; }
function fensterListe(tMs, def) {                 /* Fensterbeginne zwei Tage um tMs, aufsteigend */
  const d = new Date(tMs), basis = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()), out = [];
  for (let tag = -2; tag <= 2; tag++) {
    def.meldewesen.fensterStundenUtc.forEach(function (std) { out.push(basis + tag * 86400000 + std * 3600000); });
  }
  return out.sort(function (a, b) { return a - b; });
}
/* Erstes Fenster, dessen Frist nach tMs endet: S = Beginn, D = Fristende, prevD = Fristende des Vorgängers */
function fensterNach(tMs, def) {
  def = def || KM();
  const l = fensterListe(tMs, def), fr = fristMs(def);
  for (let i = 1; i < l.length; i++) {
    if (l[i] + fr > tMs) return { S: l[i], D: l[i] + fr, prevD: l[i - 1] + fr, label: p2(new Date(l[i]).getUTCHours()) + '00Z' };
  }
  return null;
}
/* Einsatzbeginn: Annahme plus Vorlauf des Auftrags; ältere Zustände ohne Angabe gelten als begonnen */
function einsatzBeginn(def) {
  const ms = def && MS(def.id);
  return ms ? (ms.beginn ? Date.parse(ms.beginn) : (ms.angenommenAm ? Date.parse(ms.angenommenAm) : null)) : null;
}
function einsatzLaeuft() { const d = LM(); return !!d && Date.now() >= einsatzBeginn(d); }
function meldeAktiv() { return !!LM() && einsatzLaeuft() && !STATE.funkstille.aktiv; }
function meldungLiegtVor(f) { return Date.parse(STATE.agent.checkin.t) > f.prevD; }
function meldeText(now) {
  if (!LM()) return 'ruht · kein laufender Auftrag';
  if (!einsatzLaeuft()) return 'ruht · Einsatzbeginn in ' + fmtRest(einsatzBeginn(LM()) - now);
  if (STATE.funkstille.aktiv) return 'ausgesetzt · Funkstille seit ' + dtg(STATE.funkstille.seit);
  const f = fensterNach(now);
  const lage = now < f.S ? 'in ' + fmtDauer(f.S - now) : 'Frist läuft, noch ' + fmtDauer(f.D - now);
  return f.label + ' · ' + lage + ' · ' + (meldungLiegtVor(f) ? 'Meldung liegt vor' : 'Meldung offen');
}

/* =====================================================================
   PERSISTENZ (localStorage, jeder Zugriff in try/catch)
   ===================================================================== */
const Store = (function () {
  let ok = false, lastSaved = null;
  try {
    const probe = STORAGE_KEY + '.probe';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    ok = true;
  } catch (e) { ok = false; }
  return {
    isPersistent: function () { return ok; },
    lastSaved: function () { return lastSaved; },
    load: function () {
      if (!ok) return null;
      try { const raw = window.localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : null; }
      catch (e) { return null; }
    },
    save: function (state) {
      if (!ok) return;
      try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); lastSaved = new Date(); }
      catch (e) { ok = false; }
    }
  };
})();

/* =====================================================================
   PROFIL (bleibt beim Zurücksetzen erhalten)
   Eigene Dossiers, Verbindungen, Lichtbilder, Aufnahmen und Kartenpositionen liegen zusätzlich in einem eigenen Speicher
   (localStorage-Schlüssel .profil, im Browserprofil). Zurücksetzen und erster Start spielen ihn in das Standard-Dossier ein.
   Bilder, Aufnahmen und Kartenpositionen liegen nur dort, nicht im Spielstand.
   ===================================================================== */
const PROFIL_KEY = STORAGE_KEY + '.profil';
const PROFIL = (function () {
  const leer = function () { return { v: 1, eigene: [], eigeneKanten: [], daten: {}, seq: { eigen: 0, kante: 0, galerie: 0, ausgang: 0 }, bilder: {}, galerie: {}, koord: {}, ausgang: [] }; };
  let p = leer();
  try {
    const raw = window.localStorage.getItem(PROFIL_KEY);
    if (raw) { const o = JSON.parse(raw); if (o && o.v === 1) p = Object.assign(leer(), o, { seq: Object.assign({ eigen: 0, kante: 0, galerie: 0, ausgang: 0 }, o.seq || {}) }); }
  } catch (e) { /* ohne Profil */ }
  p.leer = leer;
  return p;
})();
const PROFIL_AKTIONEN = { DOSSIER_ANGELEGT: 1, DOSSIER_GELOESCHT: 1, VERBINDUNG_ANGELEGT: 1, VERBINDUNG_GELOESCHT: 1, DOSSIER_NOTIZ: 1, DOSSIER_STATUS: 1, DOSSIER_BILD: 1, DOSSIER_FOTO_HINZU: 1, DOSSIER_FOTO_ENTFERNT: 1, DOSSIER_ORT: 1, AUSGANG_ANGELEGT: 1, AUSGANG_GELOESCHT: 1, AUSGANG_ORT: 1, PROFIL_IMPORT: 1, PROFIL_LEEREN: 1 };
function profilSpeichern() {
  if (STATE && STATE.dossiers) {
    const d = STATE.dossiers, daten = {};
    d.eigene.forEach(function (e) { if (d.entitaeten[e.id]) daten[e.id] = d.entitaeten[e.id]; });
    PROFIL.eigene = d.eigene; PROFIL.eigeneKanten = d.eigeneKanten; PROFIL.daten = daten;
    PROFIL.seq.eigen = Math.max(PROFIL.seq.eigen || 0, STATE.seq.eigen || 0);
    PROFIL.seq.kante = Math.max(PROFIL.seq.kante || 0, STATE.seq.kante || 0);
  }
  try {
    const o = {}; Object.keys(PROFIL).forEach(function (k) { if (k !== 'leer') o[k] = PROFIL[k]; });
    window.localStorage.setItem(PROFIL_KEY, JSON.stringify(o));
    return true;
  } catch (e) { return false; }
}
function profilEinspielen(z) {
  const D = z.dossiers, kopie = function (o) { return JSON.parse(JSON.stringify(o)); };
  PROFIL.eigene.forEach(function (e) {
    if (!D.eigene.some(function (x) { return x.id === e.id; })) D.eigene.push(kopie(e));
    if (!D.entitaeten[e.id]) D.entitaeten[e.id] = kopie(PROFIL.daten[e.id] || { status: null, statusAm: null, notizen: [], aktualisiert: z.t0 });
  });
  PROFIL.eigeneKanten.forEach(function (k) { if (!D.eigeneKanten.some(function (x) { return x.id === k.id; })) D.eigeneKanten.push(kopie(k)); });
  z.seq.eigen = Math.max(z.seq.eigen || 0, PROFIL.seq.eigen || 0);
  z.seq.kante = Math.max(z.seq.kante || 0, PROFIL.seq.kante || 0);
}
function profilGroesseKb() { try { return Math.round((window.localStorage.getItem(PROFIL_KEY) || '').length / 1024); } catch (e) { return 0; } }
function parseKoord(txt) {
  const m = String(txt || '').trim().replace(/,/g, '.').match(/^(-?\d{1,2}(?:\.\d+)?)[\s;]+(-?\d{1,3}(?:\.\d+)?)$/) || String(txt || '').trim().match(/^(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)$/);
  if (!m) return null;
  const la = Number(m[1]), lo = Number(m[2]);
  return la >= -85 && la <= 85 && lo >= -180 && lo <= 180 ? [Math.round(la * 1e5) / 1e5, Math.round(lo * 1e5) / 1e5] : null;
}

/* =====================================================================
   ZUSTAND
   ===================================================================== */
function leererMissionsstand(def) {
  const ziele = {};
  def.ziele.forEach(function (z) { ziele[z.id] = { erledigt: false, t: null }; });
  return { status: 'offen', arbeitsstand: 'Laufend', zugewiesenAm: null, angenommenAm: null, beendetAm: null, ablehnungen: [],
           ziele: ziele, zeitfenster: {}, von: null, bis: null, partnerStand: null,
           skript: def.skript.map(function () { return 'offen'; }),      /* je Skriptnachricht: offen, geplant, gesendet */
           zusatz: [],                                                    /* vom Agenten zugeordnete Zusatzakteure */
           abschlussbericht: null, abbruchgrund: null };
}
/* Setzt alles, was mit der Annahme einer Mission wechselt: Laufzeit, Zeitfenster, Kontext, Legende, Standort,
   Bedrohungsbewertung, Meldewesen, Funkstille. zustand ist beim Erstaufbau noch nicht STATE. */
function missionAnsetzen(zustand, def, tMs) {
  const at = function (min) { return new Date(tMs + min * 60000).toISOString(); };
  const tb = tMs + (def.vorlaufMin || 0) * 60000, atb = function (min) { return new Date(tb + min * 60000).toISOString(); };   /* Einsatzbeginn */
  const iso = new Date(tMs).toISOString(), isoB = new Date(tb).toISOString(), ms = zustand.missionen[def.id];
  ms.status = 'laufend'; ms.arbeitsstand = 'Laufend'; ms.angenommenAm = iso; ms.beginn = isoB;
  /* Nachrichtenskript der Mission: zeitgesteuerte Einträge ab Einsatzbeginn, übrige warten auf ihren Auslöser */
  zustand.plan = zustand.plan.filter(function (p) { return p.typ !== 'skript'; });
  ms.skript = def.skript.map(function (sk, i) {
    if (!sk.ausloeser || sk.ausloeser.typ !== 'zeit') return 'offen';
    planen(zustand, { typ: 'skript', mission: def.id, index: i, faelligAm: new Date(tb + sk.ausloeser.sek * 1000).toISOString() });
    return 'geplant';
  });
  if (!ms.zugewiesenAm) ms.zugewiesenAm = iso;
  ms.von = iso; ms.bis = atb(def.laufzeit.bisMin); ms.partnerStand = at(def.partnerstelle.standMin);
  def.zeitfenster.forEach(function (w) { ms.zeitfenster[w.id] = { von: atb(w.vonMin), bis: atb(w.bisMin) }; });
  zustand.kontext = def.id;
  zustand.agent.legende = def.legendeStart;
  zustand.agent.checkin = { t: iso, standortId: def.anreise ? null : def.checkinStart.standortId };       /* Check-in beim Bezug des Einsatzorts (mit Anreiseplanung erst bei Ankunft) */
  zustand.anreise = null;
  zustand.plan = zustand.plan.filter(function (p) { return p.typ !== 'anreise_pruefung' && p.typ !== 'anreise_ankunft'; });
  if (def.anreise) planen(zustand, { typ: 'anreise_pruefung', mission: def.id, faelligAm: isoB });
  const X = zustand.extraktion;
  X.stufe = def.extraktion.stufeStart; X.bewertet = iso; X.anforderung = leereAnforderung();
  X.begruendung = [{ t: iso, text: def.extraktion.begruendungStart, quelle: 'Handler ' + SCENARIO.kommunikation.kanaele[0].gegenstelle + ', ' + def.name }];
  zustand.melde = { geprueftBis: isoB, versaeumt: 0 };
  zustand.funkstille = { aktiv: false, seit: null, mission: null };
  if (def.funkstille && def.funkstille.ab === 'annahme') planen(zustand, { typ: 'funkstille', mission: def.id, faelligAm: isoB });
}
function buildInitialState(t0) {
  const at = function (min) { return new Date(t0 + min * 60000).toISOString(); };
  const S = SCENARIO, M1 = missionDef(S.serie.start), iso0 = new Date(t0).toISOString();
  const kanaele = {};
  S.kommunikation.kanaele.forEach(function (k) { kanaele[k.id] = { ungelesen: 0, nachrichten: [] }; });
  const dok = {}, missionen = {};
  S.missionen.forEach(function (def) {
    missionen[def.id] = leererMissionsstand(def);
    def.legenden.forEach(function (l) {
      l.dokumente.forEach(function (d) { dok[d.id] = { gueltigBis: d.gueltigTage == null ? null : at(d.gueltigTage * 1440) }; });
    });
  });
  const ent = {};
  S.entitaeten.concat(S.standard.dossiers).forEach(function (e) { ent[e.id] = { status: null, statusAm: null, notizen: [], aktualisiert: iso0 }; });
  const zustand = {
    version: STATE_VERSION,
    t0: iso0,
    seq: { nachricht: 0, log: 0, notiz: 0, bericht: 0, plan: 0 },
    plan: [], automatik: true,
    ui: { modul: 'profil' },
    vorlauf: true,                      /* Erststart: noch kein Auftrag angenommen */
    nachbereitung: null,
    agent: {
      status: 'Ruhend', legende: M1.legendeStart, checkin: { t: iso0, standortId: null }, ablehnungen: 0,
      notizen: '', notizenGeaendert: iso0,
      einschraenkungen: '', einschraenkungenGeaendert: iso0,
      dokumente: dok
    },
    melde: { geprueftBis: iso0, versaeumt: 0 }, funkstille: { aktiv: false, seit: null, mission: null }, kontext: M1.id,
    serie: { folge: null, ende: null },
    einweisung: false, pause: null,
    missionen: missionen,
    berichte: [],
    dossiers: { entitaeten: ent, auswahl: S.standard.dossiers[0].id, eigene: [], eigeneKanten: [] },
    anreise: null,
    akten: { anfragen: {}, freigaben: {}, offen: null },
    komm: { kanaele: kanaele, aktiv: 'handler' },
    extraktion: { stufe: 1, begruendung: [{ t: iso0, text: 'Kein laufender Auftrag.', quelle: 'System' }], bewertet: iso0, anforderung: leereAnforderung(), standortfreigabe: false },
    log: []
  };
  profilEinspielen(zustand);
  return zustand;
}

function isValidState(x) {
  try {
    const zust = SCENARIO.serie.missionszustaende;
    return !!x && x.version === STATE_VERSION &&
      x.ui && MODULES.some(function (m) { return m.id === x.ui.modul; }) &&
      x.seq && typeof x.seq.log === 'number' && typeof x.seq.nachricht === 'number' &&
      x.agent && STATUS_LISTE.indexOf(x.agent.status) >= 0 && !!legende(x.agent.legende) &&
      x.agent.checkin && !isNaN(Date.parse(x.agent.checkin.t)) && x.agent.dokumente && typeof x.agent.ablehnungen === 'number' &&
      typeof x.agent.notizen === 'string' && typeof x.agent.einschraenkungen === 'string' &&
      x.melde && !isNaN(Date.parse(x.melde.geprueftBis)) && typeof x.melde.versaeumt === 'number' &&
      x.funkstille && typeof x.funkstille.aktiv === 'boolean' &&
      !!missionDef(x.kontext) && x.serie && typeof x.serie === 'object' &&
      x.missionen && SCENARIO.missionen.every(function (def) {
        const ms = x.missionen[def.id];
        return ms && zust.indexOf(ms.status) >= 0 && Array.isArray(ms.ablehnungen) && ms.zeitfenster && Array.isArray(ms.skript) &&
               def.ziele.every(function (z) { return !!ms.ziele[z.id]; });
      }) &&
      (x.vorlauf === true || !!x.missionen[x.kontext].angenommenAm) &&
      (x.vorlauf === true || missionDef(x.kontext).zeitfenster.every(function (w) { return !!x.missionen[x.kontext].zeitfenster[w.id]; })) &&
      Array.isArray(x.berichte) && Array.isArray(x.plan) && typeof x.automatik === 'boolean' &&
      x.dossiers && x.dossiers.entitaeten && (!!entitaet(x.dossiers.auswahl) || (x.dossiers.eigene || []).some(function (e) { return e.id === x.dossiers.auswahl; })) &&
      SCENARIO.entitaeten.every(function (e) { return x.dossiers.entitaeten[e.id] && Array.isArray(x.dossiers.entitaeten[e.id].notizen); }) &&
      x.komm && x.komm.kanaele && SCENARIO.kommunikation.kanaele.some(function (k) { return k.id === x.komm.aktiv; }) &&
      SCENARIO.kommunikation.kanaele.every(function (k) { return x.komm.kanaele[k.id] && Array.isArray(x.komm.kanaele[k.id].nachrichten); }) &&
      x.extraktion && x.extraktion.stufe >= 1 && x.extraktion.stufe <= 5 && x.extraktion.anforderung &&
      ['keine', 'angefordert', 'bestätigt', 'in Durchführung'].indexOf(x.extraktion.anforderung.status) >= 0 &&
      Array.isArray(x.extraktion.begruendung) && x.extraktion.begruendung.length > 0 && typeof x.extraktion.begruendung[0] === 'object' &&
      Array.isArray(x.log);
  } catch (e) { return false; }
}

/* Überführung gespeicherter oder importierter Zustände.
   Version 2 → 3: Bedrohungsbegründung als Objekte, erweiterte Anforderung.
   Version 3 → 4: Missionsstruktur. Ziele, Zeitfenster, Lageberichte, Notizen, Nachrichten, Protokoll und
   Extraktionsstand der bisherigen Mission gehen unverändert in M1 bzw. den übergreifenden Zustand über. */
function migrate(x) {
  try {
    if (x && x.version === 2 && x.extraktion && x.agent) {
      const X = x.extraktion;
      X.begruendung = (X.begruendung || []).map(function (b) { return typeof b === 'string' ? { t: X.bewertet, text: b, quelle: 'Handler' } : b; });
      X.anforderung = Object.assign(leereAnforderung(), X.anforderung || {});
      if (X.anforderung.status === 'angefordert' && X.anforderung.durch === 'Gegenstelle') {
        X.anforderung.status = 'bestätigt'; X.anforderung.freigabe = 'erteilt'; X.anforderung.freigabeT = X.anforderung.t;
        X.anforderung.statusZuvor = x.agent.status; x.agent.status = 'Extraktion ausstehend';
      }
      x.version = 3;
    }
    if (x && x.version === 3 && x.mission && x.komm && x.agent && x.dossiers && Array.isArray(x.log)) {
      const n = buildInitialState(Date.parse(x.t0) || Date.now()), m1 = n.missionen[n.kontext];
      n.plan = []; n.serie.folge = null; n.vorlauf = false; missionAnsetzen(n, missionDef(n.kontext), Date.parse(x.t0) || Date.now());
      n.ui = x.ui;
      n.seq = Object.assign(n.seq, x.seq);
      n.agent = Object.assign({}, x.agent, { dokumente: Object.assign({}, n.agent.dokumente, x.agent.dokumente), ablehnungen: 0 });
      n.melde = x.melde;
      m1.ziele = Object.assign(m1.ziele, x.mission.ziele);
      m1.zeitfenster = Object.assign(m1.zeitfenster, x.mission.zeitfenster);
      m1.von = x.mission.von; m1.bis = x.mission.bis;
      if (x.mission.partnerStand) m1.partnerStand = x.mission.partnerStand;
      m1.arbeitsstand = SCENARIO.serie.arbeitsstaende.indexOf(x.mission.status) >= 0 ? x.mission.status : 'Laufend';
      const gespielt = x.komm.skriptIndex || 0, jetzt = Date.now();
      m1.skript = m1.skript.map(function (st, i) { return i < gespielt ? 'gesendet' : st; });
      n.plan = n.plan.filter(function (p) { return !(p.typ === 'skript' && p.index < gespielt); });
      n.plan.forEach(function (p) { if (p.typ === 'skript') p.faelligAm = new Date(jetzt + missionDef(p.mission).skript[p.index].ausloeser.sek * 1000).toISOString(); });
      n.berichte = (x.mission.berichte || []).map(function (b) { return Object.assign({ mission: n.kontext }, b); });
      n.dossiers = { entitaeten: Object.assign({}, n.dossiers.entitaeten, x.dossiers.entitaeten), auswahl: x.dossiers.auswahl };
      n.komm = { kanaele: x.komm.kanaele, aktiv: x.komm.aktiv };
      n.extraktion = x.extraktion;
      n.log = x.log.slice();
      n.seq.log = (n.seq.log || 0) + 1;
      n.log.push({ id: n.seq.log, t: new Date().toISOString(), modul: 'System', aktion: 'Zustand überführt',
                   detail: 'Version 3 → 4: bisherige Mission als ' + n.kontext + ' ' + missionDef(n.kontext).name + ' übernommen (' +
                           Object.keys(x.mission.ziele).length + ' Ziele, ' + n.berichte.length + ' Lageberichte, ' + x.log.length + ' Protokolleinträge)' +
                           (x.mission.status === 'Abgeschlossen' ? '; Arbeitsstand "Abgeschlossen" entfällt, Abschluss erfolgt über den Abschlussbericht' : '') });
      x = n;
    }
    if (x && x.version === 4 && x.missionen && !Array.isArray(x.plan)) {       /* Zustand aus Teilschritt 4a: Plan und Skriptstand nachführen */
      x.plan = []; x.automatik = true; x.seq.plan = 0;
      SCENARIO.missionen.forEach(function (def) {
        const ms = x.missionen[def.id];
        if (!ms) return;
        ms.skript = def.skript.map(function (sk, i) {
          if (i < (ms.skriptIndex || 0)) return 'gesendet';
          if (ms.status === 'laufend' && sk.ausloeser && sk.ausloeser.typ === 'zeit') {
            planen(x, { typ: 'skript', mission: def.id, index: i, faelligAm: new Date(Date.now() + sk.ausloeser.sek * 1000).toISOString() });
            return 'geplant';
          }
          return 'offen';
        });
        delete ms.skriptIndex;
      });
    }
    if (x && x.version === 4 && x.dossiers && x.dossiers.entitaeten && x.missionen) {   /* Nachführung: Standard-Dossier, neue Entitäten, Dossierstatus, ergänzte Skriptnachrichten */
      if (!Array.isArray(x.dossiers.eigene)) x.dossiers.eigene = [];
      if (!Array.isArray(x.dossiers.eigeneKanten)) x.dossiers.eigeneKanten = [];
      delete x.dossiers.bilder;
      if (!('anreise' in x)) x.anreise = null;
      if (!x.akten || typeof x.akten !== 'object') x.akten = { anfragen: {}, freigaben: {}, offen: null };
      if (!('einweisung' in x)) { x.einweisung = true; x.pause = null; }
      SCENARIO.standard.dossiers.forEach(function (e) {
        if (!x.dossiers.entitaeten[e.id]) x.dossiers.entitaeten[e.id] = { status: null, statusAm: null, notizen: [], aktualisiert: x.t0 };
      });
      SCENARIO.entitaeten.forEach(function (e) {
        let d = x.dossiers.entitaeten[e.id];
        if (!d) d = x.dossiers.entitaeten[e.id] = { status: null, statusAm: null, notizen: [], aktualisiert: x.t0 };
        if (!('status' in d)) { d.status = d.markiert ? 'relevant' : null; d.statusAm = d.markiert ? (d.markiertAm || x.t0) : null; }
        delete d.markiert; delete d.markiertAm;
      });
      SCENARIO.missionen.forEach(function (def) {
        const ms = x.missionen[def.id];
        if (!ms || !Array.isArray(ms.skript)) return;
        for (let i = ms.skript.length; i < def.skript.length; i++) {
          const a = def.skript[i].ausloeser || {};
          const faellig = ms.status === 'laufend' && (a.typ === 'zeit' || (a.typ === 'ziel' && ms.ziele[a.ziel] && ms.ziele[a.ziel].erledigt));
          if (faellig && Array.isArray(x.plan)) planen(x, { typ: 'skript', mission: def.id, index: i, faelligAm: new Date(Date.now() + (a.sek || 0) * 1000).toISOString() });
          ms.skript.push(faellig ? 'geplant' : 'offen');
        }
      });
    }
  } catch (e) { /* unbrauchbarer Zustand wird von isValidState verworfen */ }
  return x;
}

let STATE = null;
let RENDERING = false;
/* Reine Ansichtszustände ohne fachlichen Wert (nicht protokolliert, nicht persistent) */
const VIEW = {
  logOpen: false, logFilter: 'Alle', logKrit: false,
  draft: {},                                      /* noch nicht übernommene Eingaben, je Feld-ID */
  dossier: { q: '', typ: 'Alle', stufe: 0, land: 'Alle', status: 'Alle' },
  graph: { typ: 'Alle', quelle: 'F', info: 6, erweitert: false }
};

/* Abgeleitete Werte */
function ungelesenGesamt() {
  return Object.keys(STATE.komm.kanaele).reduce(function (n, k) { return n + (STATE.komm.kanaele[k].ungelesen || 0); }, 0);
}
function offeneZiele() {
  const def = LM();
  return def ? def.ziele.filter(function (z) { return !MS(def.id).ziele[z.id].erledigt; }).length : 0;
}
function markierte() {
  return pool().filter(function (e) { return !!STATE.dossiers.entitaeten[e.id].status; });
}

/* Zustandshelfer, nur innerhalb von dispatch-Handlern zu verwenden */
/* Kanal mit der Gegenstelle der Kontextmission (der lokale Asset wechselt je Auftrag) */
function kanalDef(id) {
  const k = SCENARIO.kommunikation.kanaele.find(function (x) { return x.id === id; });
  if (!k) return null;
  const g = STATE && STATE.vorlauf && id === 'asset' ? 'nicht zugewiesen' : (STATE && KM() && KM().kanalGegenstelle ? KM().kanalGegenstelle[id] : null);
  return g ? Object.assign({}, k, { gegenstelle: g }) : k;
}
function optionDef(id) { return KM().extraktion.optionen.find(function (o) { return o.id === id; }); }
function funkstilleBeenden(grund, out) {
  STATE.funkstille = { aktiv: false, seit: null, mission: null };
  STATE.melde = { geprueftBis: nowIso(), versaeumt: 0 };
  out.push({ modul: 'Kommunikation', aktion: 'Funkstille beendet', krit: true, detail: grund + '; Meldefenster gelten ab jetzt' });
}
/* Bereinigung nach der Nachbereitung: Kanalverläufe, Notizen und Planeinträge gehen, Dossiers werden archiviert */
function nachbereitungAbschliessen(def, out) {
  const iso = nowIso(), K = STATE.komm.kanaele;
  let n = 0;
  Object.keys(K).forEach(function (id) { n += K[id].nachrichten.length; K[id] = { ungelesen: 0, nachrichten: [] }; });
  zustellTimer.forEach(clearTimeout); zustellTimer = [];
  STATE.dialog = {}; STATE.plan = []; STATE.anreise = null; STATE.akten = { anfragen: {}, freigaben: {}, offen: null };
  STATE.agent.notizen = ''; STATE.agent.notizenGeaendert = iso;
  STATE.agent.einschraenkungen = ''; STATE.agent.einschraenkungenGeaendert = iso;
  STATE.agent.checkin = { t: iso, standortId: null };
  let arch = 0;
  SCENARIO.entitaeten.filter(function (e) { return e.mission === def.id; }).forEach(function (e) {
    const d = STATE.dossiers.entitaeten[e.id];
    if (!d.status) { d.status = 'archiviert'; d.statusAm = iso; arch += 1; }
    d.aktualisiert = iso;
  });
  STATE.nachbereitung = null;
  out.push({ modul: 'Mission', aktion: 'Nachbereitung abgeschlossen', krit: true,
    detail: opText(def) + ': ' + n + ' Nachrichten aus den Kanälen entfernt, Notizen und Einschränkungen zurückgesetzt, ' + arch + ' Dossiers archiviert' });
  eingang('handler', { von: 'gegenstelle', absender: kanalDef('handler').gegenstelle, text: serienText('nachbereitungEnde', def) });
  const folge = SCENARIO.missionen.find(function (x) { return MS(x.id).status === 'offen'; });
  if (folge) {
    const sek = typeof def.folgeNachSek === 'number' ? def.folgeNachSek : SCENARIO.serie.folgeNachSek;
    STATE.serie.folge = { mission: folge.id, faelligAm: new Date(Date.now() + sek * 1000).toISOString() };
  } else {
    eingang('handler', { von: 'gegenstelle', absender: kanalDef('handler').gegenstelle, text: serienText('serienende', def) });
    serieBeenden('Serie abgeschlossen', def.id, out);
  }
}
function serieBeenden(art, missionId, out) {
  STATE.serie.folge = null;
  STATE.serie.ende = { art: art, t: nowIso(), mission: missionId };
  out.push({ modul: 'Mission', aktion: 'Auftragsserie beendet', krit: true, detail: art + '; es werden keine weiteren Aufträge zugewiesen' });
}
function optionText(id) { const o = optionDef(id); return 'Option ' + o.id + ' (' + o.titel + ')'; }
function leereAnforderung() {
  return { status: 'keine', option: null, begruendung: '', t: null, durch: null, statusZuvor: null, freigabe: null, freigabeT: null };
}
/* Eingang im Kanal (Gegenstelle oder System). Ist der Kanal gerade geöffnet, gilt die Nachricht sofort als gelesen. */
function eingang(kanalId, p) {
  const k = STATE.komm.kanaele[kanalId];
  const offen = STATE.ui.modul === 'komm' && STATE.komm.aktiv === kanalId;
  STATE.seq.nachricht += 1;
  const msg = { id: 'N-' + p3(STATE.seq.nachricht), von: p.von, absender: p.absender, t: nowIso(), text: p.text,
                status: offen ? 'gelesen' : 'zugestellt', dringlichkeit: p.dringlichkeit || 'Routine', lagerelevant: !!p.lagerelevant, art: p.art || null };
  k.nachrichten.push(msg);
  if (!offen) k.ungelesen += 1;
  return msg;
}
function systemnachricht(kanalId, text) {
  return eingang(kanalId, { von: 'system', absender: 'System', text: text, dringlichkeit: 'Priorität', art: 'Systemnachricht' });
}
function handlernachricht(text, art) {
  return eingang('handler', { von: 'gegenstelle', absender: kanalDef('handler').gegenstelle, text: text, dringlichkeit: 'Priorität', art: art });
}
function kanalLesen(id) {
  const k = STATE.komm.kanaele[id], n = k.ungelesen;
  k.nachrichten.forEach(function (m) { if (m.von !== 'agent' && m.status !== 'gelesen') m.status = 'gelesen'; });
  k.ungelesen = 0;
  return n;
}
function nachricht(id) {
  const ks = Object.keys(STATE.komm.kanaele);
  for (let i = 0; i < ks.length; i++) {
    const m = STATE.komm.kanaele[ks[i]].nachrichten.find(function (x) { return x.id === id; });
    if (m) return { msg: m, kanal: ks[i] };
  }
  return null;
}
/* Kopplung: Änderung des operativen Status mit Protokolleintrag */
function setStatus(neu, grund, out) {
  const alt = STATE.agent.status;
  if (alt === neu) return;
  STATE.agent.status = neu;
  out.push({ modul: 'Profil', aktion: 'Operativer Status geändert', detail: alt + ' → ' + neu + ' (' + grund + ')',
             krit: neu === 'Erhöhtes Risiko' || neu === 'Extraktion ausstehend' });
}
/* Anforderung beenden; der operative Status kehrt zum Stand vor der Anforderung zurück (bei Stufe 4 oder höher mindestens "Erhöhtes Risiko") */
function anforderungAufheben(grund, out, zielStatus) {
  const a = STATE.extraktion.anforderung;
  let ziel = zielStatus || a.statusZuvor || 'Aktiv';
  if (ziel === 'Extraktion ausstehend') ziel = 'Aktiv';
  if (ziel === 'Aktiv' && STATE.extraktion.stufe >= 4) ziel = 'Erhöhtes Risiko';
  STATE.extraktion.anforderung = leereAnforderung();
  planEntfernen(function (p) { return p.typ === 'freigabe' || p.typ === 'durchfuehrung'; });
  if (STATE.agent.status === 'Extraktion ausstehend') setStatus(ziel, grund, out);
}
/* Kopplung: lagerelevante Nachricht erhöht die Bedrohungsstufe um eine Stufe (Obergrenze 5) */
function bedrohungErhoehen(msg, kanalName, out) {
  const X = STATE.extraktion, alt = X.stufe, B = SCENARIO.bedrohungsstufen;
  const anlass = 'lagerelevante Nachricht ' + msg.id + ', Kanal ' + kanalName;
  X.begruendung.push({ t: msg.t, text: msg.text, quelle: msg.id + ', Kanal ' + kanalName });
  X.bewertet = msg.t;
  if (alt < 5) {
    X.stufe = alt + 1;
    out.push({ modul: 'Extraktion', aktion: 'Bedrohungsstufe erhöht', krit: true,
               detail: 'Stufe ' + alt + ' (' + B[alt] + ') → Stufe ' + X.stufe + ' (' + B[X.stufe] + '); Anlass: ' + anlass });
  } else {
    out.push({ modul: 'Extraktion', aktion: 'Bedrohungsstufe unverändert', krit: true, detail: 'Obergrenze Stufe 5 erreicht; Anlass: ' + anlass });
  }
  if (X.stufe >= 4 && STATE.agent.status === 'Aktiv') setStatus('Erhöhtes Risiko', 'Bedrohungsstufe ' + X.stufe + '; Anlass: ' + anlass, out);
}
/* Zustellstatus eigener Nachrichten: gesendet → zugestellt nach 2 s, → gelesen nach 6 s (jeweils ab Versand).
   Die Zeiten werden aus dem Versandzeitpunkt berechnet, damit offene Übergänge ein Neuladen überstehen. */
let zustellTimer = [];
function planeZustellung(kanalId, msg) {
  const t = Date.parse(msg.t);
  [['zugestellt', ZUSTELL_MS], ['gelesen', LESE_MS]].forEach(function (x) {
    zustellTimer.push(setTimeout(function () {
      dispatch({ type: 'NACHRICHT_STATUS', kanal: kanalId, id: msg.id, status: x[0] });
    }, Math.max(0, t + x[1] - Date.now())));
  });
}
function planeAlle() {
  zustellTimer.forEach(clearTimeout); zustellTimer = [];
  Object.keys(STATE.komm.kanaele).forEach(function (kid) {
    STATE.komm.kanaele[kid].nachrichten.forEach(function (m) { if (m.von === 'agent' && m.status !== 'gelesen' && !m.blockiert) planeZustellung(kid, m); });
  });
}

/* =====================================================================
   AUTOMATIK: FÄLLIGKEITEN
   STATE.plan hält alle künftigen Ereignisse der Gegenstellen (Skriptnachricht, Antwort, Freigabe, Durchführung)
   mit Fälligkeitszeit. Der Sekundentakt löst fällige Einträge über dispatch aus; der Plan übersteht ein Neuladen.
   ===================================================================== */
function planen(zustand, item) {
  zustand.seq.plan = (zustand.seq.plan || 0) + 1;
  item.id = 'F-' + p3(zustand.seq.plan);
  zustand.plan.push(item);
  return item;
}
function planEntfernen(pruef) { STATE.plan = STATE.plan.filter(function (p) { return !pruef(p); }); }

/* =====================================================================
   ANREISEPLANUNG
   Zwischen Annahme und Einsatzbeginn wählt der Agent Verkehrsmittel, Abfahrt, Unterkunft und Vorerkundung.
   anreiseBewerten ist rein rechnerisch (Risikowert 0 bis 100 mit nachvollziehbaren Faktoren).
   ===================================================================== */
function dauerText(min) {
  min = Math.round(min);
  const sign = min < 0 ? '−' : '', a = Math.abs(min), hh = Math.floor(a / 60), mm = a % 60;
  return sign + (hh ? hh + ' h ' : '') + (mm || !hh ? mm + ' min' : '').trim();
}
const ART_AUSGANG = ['Safehouse (Wohnung)', 'Safehouse (Lagerhaus)', 'Unterkunft', 'Wohnsitz', 'Sonstiges'];
function anreiseOptionen(def, tMs, jetzt) {
  const stunden = (SCENARIO.anreiseTexte && SCENARIO.anreiseTexte.abfahrtStunden) || [];
  return stunden.filter(function (hh) { const abf = tMs - hh * 3600000; return abf > jetzt + 5 * 60000 && abf <= tMs; });
}
function luftlinieKm(a, b) {
  const r = Math.PI / 180, dLa = (b[0] - a[0]) * r, dLo = (b[1] - a[1]) * r;
  const h2 = Math.sin(dLa / 2) * Math.sin(dLa / 2) + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLo / 2) * Math.sin(dLo / 2);
  return 6371 * 2 * Math.atan2(Math.sqrt(h2), Math.sqrt(1 - h2));
}
/* Reiseoptionen der Mission: mit Ausgangsort aus der Entfernung berechnet (Reihenfolge Bahn, Auto, Chauffeur, Flug, Bus), sonst die festen Optionen des Szenarios */
function anreiseListe(def, ausgangId, unterkunft) {
  const A = def.anreise, ortId = unterkunft === 'ausweich' ? A.unterkunft.ausweich : A.unterkunft.haupt;
  const ausgang = PROFIL.ausgang.find(function (x) { return x.id === ausgangId; }) || null, ziel = karteKoord(ortId), M = SCENARIO.anreiseModelle || {};
  if (!ausgang) return { optionen: A.optionen, km: null, ausgang: null, ortId: ortId, grund: PROFIL.ausgang.length ? 'Ausgangsort wählen.' : '' };
  if (!ausgang.ll || !ziel) return { optionen: [], km: null, ausgang: ausgang, ortId: ortId, grund: !ausgang.ll ? 'Dem Ausgangsort fehlt die Kartenposition.' : 'Dem Einsatzort fehlt die Kartenposition.' };
  const km = luftlinieKm(ausgang.ll, ziel), optionen = [];
  ['bahn', 'auto', 'chauffeur', 'flug', 'bus'].forEach(function (id) {
    const m = M[id];
    if (!m || (m.minKm && km < m.minKm)) return;
    const strecke = km * m.umweg;
    optionen.push({ id: id, name: m.name, spur: m.spur, hinweis: m.hinweis, extra: m.extra || null, km: Math.round(km),
                    dauerMin: Math.round(m.fixMin + strecke / m.kmh * 60 + (m.pauseKm ? Math.floor(strecke / m.pauseKm) * 30 : 0)) });
  });
  return { optionen: optionen, km: km, ausgang: ausgang, ortId: ortId, grund: '' };
}
function anreiseBewerten(def, w, jetzt) {
  const A = def && def.anreise, ms = def && MS(def.id);
  if (!A || !ms || !ms.beginn || !w) return null;
  const L = anreiseListe(def, w.ausgang, w.unterkunft);
  const opt = L.optionen.find(function (o) { return o.id === w.mittel; });
  const ortId = L.ortId;
  if (!opt || !ortId || !isFinite(Number(w.abfahrtH))) return null;
  const tb = Date.parse(ms.beginn), abf = tb - Number(w.abfahrtH) * 3600000, ank = abf + opt.dauerMin * 60000;
  const puffer = Math.round((tb - ank) / 60000), faktoren = [];
  let gueltig = true, grund = '';
  if (PROFIL.ausgang.length && !L.ausgang) { gueltig = false; grund = 'Ausgangsort fehlt.'; }
  else if (abf <= jetzt) { gueltig = false; grund = 'Die Abfahrt liegt nicht mehr in der Zukunft.'; }
  else if (puffer < 0) { gueltig = false; grund = 'Ankunft nach Einsatzbeginn.'; }
  const add = function (text, punkte) { if (punkte > 0) faktoren.push({ text: text, punkte: punkte }); };
  add('Verkehrsmittel hinterlässt Spuren (' + opt.name + ')', [0, 8, 16, 24][opt.spur] || 0);
  if (opt.extra) add(opt.extra.text, opt.extra.punkte);
  if (puffer < 60) add('Puffer bis Einsatzbeginn unter einer Stunde', 40);
  else if (puffer < 240) add('Puffer bis Einsatzbeginn unter vier Stunden', 20);
  else if (puffer > 2160) add('Sehr langer Voraufenthalt im Einsatzraum vor Beginn', 18);
  else if (puffer > 1440) add('Langer Voraufenthalt im Einsatzraum vor Beginn', 10);
  const hUtc = new Date(ank).getUTCHours();
  if (hUtc >= 0 && hUtc < 5) add('Ankunft zur Nachtzeit fällt bei Bezug der Unterkunft auf', 10);
  if (opt.dauerMin > 480) add('Sehr lange Reisedauer', 6);
  if (w.unterkunft === 'ausweich') add('Ausweichunterkunft wird vorzeitig genutzt und steht danach nicht mehr zur Verfügung', 12);
  if (w.erkundung) add('Vorerkundung am Einsatzort erhöht die Auffälligkeit', 10);
  const risiko = Math.min(100, faktoren.reduce(function (n, f) { return n + f.punkte; }, 0));
  const stufe = risiko < 25 ? 'niedrig' : risiko < 45 ? 'mittel' : 'hoch';
  faktoren.sort(function (x, y) { return y.punkte - x.punkte; });
  return { gueltig: gueltig, grund: grund, mittel: opt.id, mittelName: opt.name, abfahrtH: Number(w.abfahrtH), unterkunft: w.unterkunft === 'ausweich' ? 'ausweich' : 'haupt', ortId: ortId,
           ausgangId: L.ausgang ? L.ausgang.id : null, ausgangName: L.ausgang ? L.ausgang.name : null, km: L.km === null ? null : Math.round(L.km),
           erkundung: !!w.erkundung, abfahrt: new Date(abf).toISOString(), ankunft: new Date(ank).toISOString(), dauerMin: opt.dauerMin, puffer: puffer, risiko: risiko, stufe: stufe, faktoren: faktoren };
}
function anreiseRueckmeldung(b) {
  const T = SCENARIO.anreiseTexte, liste = T[b.stufe], f = b.faktoren[0];
  return liste[(b.risiko + b.abfahrtH) % liste.length].replace('{PUFFER}', dauerText(b.puffer)).replace('{ANKUNFT}', fmtZ(b.ankunft))
    .replace('{FAKTOR}', f ? f.text : 'kein besonderer Faktor');
}
/* Skriptnachrichten der laufenden Mission mit passendem Auslöser einplanen (checkin; ziel mit Zielkennung) */
function skriptAusloesen(typ, zielId) {
  const def = LM();
  if (!def || !einsatzLaeuft()) return;
  const ms = MS(def.id);
  def.skript.forEach(function (sk, i) {
    const a = sk.ausloeser || {};
    if (ms.skript[i] !== 'offen' || a.typ !== typ || (typ === 'ziel' && a.ziel !== zielId)) return;
    ms.skript[i] = 'geplant';
    planen(STATE, { typ: 'skript', mission: def.id, index: i, faelligAm: new Date(Date.now() + (a.sek || 0) * 1000).toISOString() });
  });
}
function sendeSkript(def, index, out) {
  const ms = MS(def.id), sk = def.skript[index], k = kanalDef(sk.kanal);
  ms.skript[index] = 'gesendet';
  planEntfernen(function (p) { return p.typ === 'skript' && p.mission === def.id && p.index === index; });
  const msg = eingang(k.id, { von: 'gegenstelle', absender: k.gegenstelle, text: sk.text, lagerelevant: sk.lagerelevant });
  out.push(eingangsEintrag(msg, k, ''));
  if (sk.lagerelevant) bedrohungErhoehen(msg, k.name, out);
}
function eingangsEintrag(msg, k, zusatz) {
  return { modul: 'Kommunikation', aktion: 'Eingehende Nachricht', krit: msg.lagerelevant,
    detail: msg.id + ' von ' + msg.absender + ' (Kanal ' + k.name + ')' + zusatz + (msg.lagerelevant ? ', Merkmal lagerelevant' : '') +
            (msg.status === 'gelesen' ? ', Kanal geöffnet: als gelesen markiert' : ', ungelesen') };
}
function planeGegenstelle(typ) {
  const E = SCENARIO.extraktion, sek = typ === 'freigabe' ? E.freigabeNachSek : E.durchfuehrungNachSek;
  planEntfernen(function (p) { return p.typ === 'freigabe' || p.typ === 'durchfuehrung'; });
  planen(STATE, { typ: typ, faelligAm: new Date(Date.now() + sek * 1000).toISOString() });
}
/* Schritte der Gegenstelle in Modul 5. Freigabe und Durchführung löst die Automatik aus,
   Ablehnung, Aufhebung und Abschluss nur die Regie. Jeder Schritt geht als Nachricht über den Kanal Handler ein. */
function gegenstelleSchritt(schritt) {
  const X = STATE.extraktion, r = X.anforderung, T = SCENARIO.extraktion.meldungen, G = SCENARIO.extraktion.freigabe.durch, out = [];
  if (r.status === 'keine') return null;
  const O = optionText(r.option), txt = function (s) { return s.replace('{O}', O); };
  if (schritt === 'freigabe' && r.status === 'angefordert') {
    const m = handlernachricht(txt(T.freigabe), 'Freigabe');
    r.status = 'bestätigt'; r.freigabe = 'erteilt'; r.freigabeT = m.t;
    out.push({ modul: 'Extraktion', aktion: 'Freigabe durch Handler erteilt', krit: true, detail: O + ': angefordert → bestätigt; Freigabe ' + G + ' mit Nachricht ' + m.id + ' (Kanal Handler)' });
    planeGegenstelle('durchfuehrung');
  } else if (schritt === 'durchfuehrung' && r.status === 'bestätigt') {
    const m = handlernachricht(txt(T.durchfuehrung), 'Durchführung');
    r.status = 'in Durchführung';
    planEntfernen(function (p) { return p.typ === 'freigabe' || p.typ === 'durchfuehrung'; });
    out.push({ modul: 'Extraktion', aktion: 'Extraktion in Durchführung', krit: true, detail: O + ': bestätigt → in Durchführung; Meldung ' + G + ' mit Nachricht ' + m.id + ' (Kanal Handler); Rücknahme nicht mehr möglich' });
  } else if (schritt === 'ablehnen' && r.status === 'angefordert') {
    const m = handlernachricht(txt(T.ablehnung), 'Ablehnung');
    out.push({ modul: 'Extraktion', aktion: 'Freigabe durch Handler abgelehnt', krit: true, detail: O + ': angefordert → keine; Nachricht ' + m.id + ' (Kanal Handler)' });
    anforderungAufheben('Extraktionsanforderung abgelehnt', out);
  } else if (schritt === 'aufheben' && r.status === 'bestätigt') {
    const m = handlernachricht(txt(T.aufhebung), 'Aufhebung');
    out.push({ modul: 'Extraktion', aktion: 'Anforderung durch Gegenstelle aufgehoben', krit: true, detail: O + ': bestätigt → keine; Nachricht ' + m.id + ' (Kanal Handler)' });
    anforderungAufheben('Aufhebung durch Gegenstelle', out);
  } else if (schritt === 'abschliessen' && r.status === 'in Durchführung') {
    const m = handlernachricht(txt(T.abschluss), 'Abschluss');
    out.push({ modul: 'Extraktion', aktion: 'Extraktion abgeschlossen', krit: true, detail: O + ': in Durchführung → keine; Nachricht ' + m.id + ' (Kanal Handler)' });
    anforderungAufheben('Abschluss ' + O, out, 'Standby');
  } else return null;
  return out;
}

/* =====================================================================
   STICHWORTREAKTIONEN
   Auswertung einer Nachricht des Agenten gegen SCENARIO.antworten. Ergebnis: höchstens eine Antwort.
   Erkennung nach Wortstämmen ohne Rücksicht auf Groß- und Kleinschreibung; eine Verneinung innerhalb der
   letzten Wörter vor dem Stamm unterdrückt den Treffer. Variante und Verzögerung folgen aus der Nachrichten-ID.
   ===================================================================== */
/* =====================================================================
   GESPRÄCHSBIBLIOTHEK (dialog.js, globales Objekt DIALOG)
   Ergänzt die Stichwortreaktionen um freie Gespräche in der Rolle der Gegenstelle. Fehlt dialog.js, bleibt alles beim Alten.
   Auswertung: (1) Antwort auf eine offene Rückfrage, (2) operative Stichworte, (3) Absichten, (4) Rückfrage in der Rolle.
   Der Gesprächsstand liegt in STATE.dialog[kanal]: offene Rückfrage, zuletzt verwendete Wendungen (keine Wiederholung).
   ===================================================================== */
function dlgMatcher(text) {
  const A = SCENARIO.antworten;
  const w = text.toLowerCase().split(/[^a-zäöüß0-9-]+/).filter(Boolean);
  const neg = [];
  A.negation.forEach(function (n) { const l = n.split(' ').pop(); if (neg.indexOf(l) < 0) neg.push(l); });
  const negiert = function (i) {
    for (let j = Math.max(0, i - A.negationsfensterWoerter); j < i; j++) {
      if (neg.some(function (n) { return w[j] === n || (n.length >= 4 && w[j].indexOf(n) === 0); })) return true;
    }
    return false;
  };
  /* ^ Wortanfang, = ganzes Wort, Leerzeichen = Wortfolge, sonst Teilwort; ! vorweg hebt die Verneinungsprüfung auf */
  const eins = function (st) {
    let frei = false;
    if (st.charAt(0) === '!') { frei = true; st = st.slice(1); }
    const ok = function (i) { return frei || !negiert(i); };
    if (st.indexOf(' ') >= 0) {
      const t = st.split(' ');
      return w.some(function (tok, i) { return t.every(function (x, k) { return w[i + k] === x; }) && ok(i); });
    }
    const c = st.charAt(0);
    if (c === '=') { const kern = st.slice(1); return w.some(function (tok, i) { return tok === kern && ok(i); }); }
    const anfang = c === '^', kern = anfang ? st.slice(1) : st;
    return w.some(function (tok, i) { return (anfang ? tok.indexOf(kern) === 0 : tok.indexOf(kern) >= 0) && ok(i); });
  };
  return { w: w, trifft: function (liste) { return (liste || []).some(eins); } };
}
function dlgZustand(kanalId) {
  return (STATE.dialog && STATE.dialog[kanalId]) || { offen: null, zuletzt: [], seitFrage: 99, fragenZuletzt: [] };
}
/* Merkt sich nach dem Versand: offene Rückfrage, verwendete Wendung, Abstand seit der letzten Rückfrage */
function dialogMerken(kanalId, r, msg) {
  if (typeof DIALOG === 'undefined' || !r) return;
  STATE.dialog = STATE.dialog || {};
  const ds = STATE.dialog[kanalId] = STATE.dialog[kanalId] || { offen: null, zuletzt: [], seitFrage: 99, fragenZuletzt: [] };
  ds.offen = null; ds.seitFrage += 1;
  if (r.vorlage) { ds.zuletzt.push(r.vorlage); while (ds.zuletzt.length > 6) ds.zuletzt.shift(); }
  if (r.frage) { ds.offen = { id: r.frage, t: msg.t }; ds.seitFrage = 0; ds.fragenZuletzt.push(r.frage); while (ds.fragenZuletzt.length > 3) ds.fragenZuletzt.shift(); }
}
function dlgGemeinsam(kanalId, nr, vorlage, kat, extra) {
  const D = DIALOG, v = D.verzoegerungSek[kanalId] || [1, 3];
  const r = { kat: 'dialog:' + kat, vorlage: vorlage, text: vorlage, verz: v[0] + nr % (v[1] - v[0] + 1), frage: null };
  if (extra) Object.keys(extra).forEach(function (k) { r[k] = extra[k]; });
  return r;
}
function dlgWahl(kanalId, nr, liste, farbe) {
  const ds = dlgZustand(kanalId);
  const frisch = function (l) { return (l || []).filter(function (t) { return ds.zuletzt.indexOf(t) < 0; }); };
  let c = frisch(farbe);
  if (!c.length) c = frisch(liste);
  if (!c.length) c = liste || [''];
  return c[nr % c.length];
}
/* Antwort auf eine offene Rückfrage; strikt = nur bei eindeutiger Antwortklasse und höchstens vier Wörtern */
function dlgFolge(kanalId, text, nr, strikt) {
  const D = DIALOG, ds = dlgZustand(kanalId);
  if (!ds.offen || (Date.now() - Date.parse(ds.offen.t)) > D.nachfrageGueltigMin * 60000) return null;
  const def = (D.nachfragen[kanalId] || []).find(function (x) { return x.id === ds.offen.id; });
  if (!def) return null;
  const m = dlgMatcher(text);
  if (m.w.length > 4 && strikt) return null;
  const klasse = Object.keys(def.klassen).find(function (k) { return m.trifft(def.klassen[k]); });
  if (klasse) return dlgGemeinsam(kanalId, nr, dlgWahl(kanalId, nr, def.folge[klasse]), 'folge');
  if (strikt || m.w.length > 3) return null;
  return dlgGemeinsam(kanalId, nr, dlgWahl(kanalId, nr, def.sonst), 'folge');
}
/* Freie Eingabe: Absicht erkennen, Wendung wählen, gegebenenfalls Rückfrage anhängen */
function dialogAntwort(kanalId, text, msgId, nr) {
  const D = DIALOG, kd = kanalDef(kanalId), m = dlgMatcher(text), ds = dlgZustand(kanalId);
  const mid = KM() ? KM().id : null, nachr = STATE.komm.kanaele[kanalId].nachrichten;
  const eigene = nachr.filter(function (n) { return n.von === 'agent' && n.id !== msgId; });
  const gegen = nachr.filter(function (n) { return n.von === 'gegenstelle'; });
  const lib = function (kat) { return (D.antworten[kat] || {})[kanalId]; };
  const einfach = function (kat) { return dlgGemeinsam(kanalId, nr, dlgWahl(kanalId, nr, lib(kat) || D[kat][kanalId]), kat); };
  const roh = text.trim();
  if (roh.length > 400) return einfach('zuLang');
  if (m.w.length === 0 || roh.length < 2) return einfach('zuKurz');
  const vor = eigene[eigene.length - 1];
  if (vor && vor.text.trim().toLowerCase() === roh.toLowerCase() && Date.now() - Date.parse(vor.t) < 10 * 60000) return einfach('wiederholt');
  const folge = dlgFolge(kanalId, text, nr, false);
  if (folge) return folge;
  const frage = roh.indexOf('?') >= 0;
  const a = D.absichten.find(function (x) {
    if (x.frage === true && !frage) return false;
    if (x.frage === false && frage) return false;
    return x.muster ? new RegExp(x.muster, 'i').test(roh) : m.trifft(x.stamm);
  });
  if (!a) return dlgGemeinsam(kanalId, nr, dlgWahl(kanalId, nr, frage ? D.allgemeineFrage[kanalId] : D.unklar[kanalId]), frage ? 'allgemeineFrage' : 'unklar');
  let kat = a.id, extra = {}, farbe = null;
  if (a.id === 'entitaet') {
    const id = roh.match(new RegExp(a.muster, 'i'))[0].toUpperCase(), e = entitaet(id);
    kat = e && freigeschaltet(e.mission) ? 'entitaet' : 'entitaetUnbekannt';
    extra.E = id; extra.ENAME = e ? e.name : id;
  } else if (a.id === 'wiederholen') {
    const l = gegen[gegen.length - 1];
    if (l) extra.LETZTE = kuerzen(l.text, 200); else kat = 'wiederholenOhne';
  }
  if (kanalId === 'asset' && mid && D.assetFarbe[mid]) farbe = D.assetFarbe[mid][kat] || null;
  const vorlage = dlgWahl(kanalId, nr, lib(kat), farbe);
  const r = dlgGemeinsam(kanalId, nr, vorlage, kat, extra);
  const fragen = D.nachfragen[kanalId] || [];
  if (a.nachfrage && fragen.length && ds.seitFrage >= D.nachfrageAbstand && nr % 2 === 0 && !/\?\s*$/.test(vorlage)) {
    const kand = fragen.filter(function (f) { return ds.fragenZuletzt.indexOf(f.id) < 0; });
    if (kand.length) { const f = kand[nr % kand.length]; r.text = vorlage + ' ' + f.text; r.frage = f.id; }
  }
  r.text = r.text.split('{AGENT}').join(SCENARIO.agent.codename).split('{GEGENSTELLE}').join(kd ? kd.gegenstelle : '')
    .split('{LETZTE}').join(extra.LETZTE || '').split('{E}').join(extra.E || '').split('{ENAME}').join(extra.ENAME || '');
  const jetzt = new Date(), hhmm = p2(jetzt.getUTCHours()) + p2(jetzt.getUTCMinutes());
  r.text = r.text.split('{ZEIT}').join(kanalId === 'asset' ? hhmm.slice(0, 2) + ':' + hhmm.slice(2) + ' Uhr' : hhmm + 'Z');
  return r;
}

function antwortFuer(kanalId, text, dringlichkeit, msgId) {
  const A = SCENARIO.antworten, nr = parseInt(String(msgId).replace(/\D/g, ''), 10) || 0;
  const w = text.toLowerCase().split(/[^a-zäöüß0-9-]+/).filter(Boolean);
  const negWoerter = [];
  A.negation.forEach(function (n) { const letzte = n.split(' ').pop(); if (negWoerter.indexOf(letzte) < 0) negWoerter.push(letzte); });
  const negiert = function (i) {
    for (let j = Math.max(0, i - A.negationsfensterWoerter); j < i; j++) {
      if (negWoerter.some(function (n) { return w[j] === n || (n.length >= 4 && w[j].indexOf(n) === 0); })) return true;
    }
    return false;
  };
  /* Stamm: mit ^ am Wortanfang, mit Leerzeichen als Wortfolge, sonst als Teilwort */
  const stammTrifft = function (st) {
    if (st.indexOf(' ') >= 0) {
      const teile = st.split(' ');
      return w.some(function (tok, i) { return teile.every(function (t, k) { return w[i + k] === t; }) && !negiert(i); });
    }
    const anfang = st.charAt(0) === '^', kern = anfang ? st.slice(1) : st;
    return w.some(function (tok, i) { return (anfang ? tok.indexOf(kern) === 0 : tok.indexOf(kern) >= 0) && !negiert(i); });
  };
  const trifft = function (kat) { return (A.staemme[kat] || []).some(stammTrifft); };
  const wahl = function (liste) { return liste[nr % liste.length]; };
  const def = LM(), X = STATE.extraktion;
  const fuellen = function (t) {
    return t.replace('{OFFEN}', String(offeneZiele())).replace('{GESAMT}', String(def ? def.ziele.length : 0))
            .replace('{STUFE}', String(X.stufe)).replace('{STUFENNAME}', SCENARIO.bedrohungsstufen[X.stufe]).replace('{BEWERTET}', dtg(X.bewertet))
            .replace('{FENSTER}', meldeAktiv() ? fensterNach(Date.now()).label : 'ruht').replace('{OP}', KM().name)
            .replace('{STANDORT}', standortName(STATE.agent.checkin.standortId));
  };
  const verz = A.verzoegerungSek[0] + nr % (A.verzoegerungSek[1] - A.verzoegerungSek[0] + 1);
  const kat = A.prioritaet.filter(trifft)[0] || null;
  const dlgAktiv = typeof DIALOG !== 'undefined';
  const dlgErgebnis = function (d) { return { kat: d.kat, text: fuellen(d.text), verz: d.verz, vorlage: d.vorlage, frage: d.frage }; };
  if (dlgAktiv) {                                        /* eindeutige Antwort auf eine offene Rückfrage geht vor */
    const f = dlgFolge(kanalId, text, nr, true);
    if (f) return dlgErgebnis(f);
  }
  if (!kat) {
    if (dlgAktiv) {
      const d = dialogAntwort(kanalId, text, msgId, nr);
      if (d.kat === 'dialog:unklar' && dringlichkeit !== 'Routine') return { kat: null, text: wahl(A.quittung), verz: verz };
      return dlgErgebnis(d);
    }
    return dringlichkeit !== 'Routine' ? { kat: null, text: wahl(A.quittung), verz: verz } : null;
  }
  let antwort = wahl(A[kat][kanalId]);
  const z = text.match(/\bZ\d?-[PS]\d+\b/i), zid = z ? z[0].toUpperCase() : null, zst = zid && def ? MS(def.id).ziele[zid] : null;
  if (kanalId === 'handler') {
    if (kat === 'extraktion' && X.anforderung.status !== 'keine') {
      antwort = wahl(A.bestehendeAnforderung).replace('{O}', optionText(X.anforderung.option)).replace('{S}', X.anforderung.status);
    } else if (kat === 'erledigt' && zid) {
      antwort = (zst ? (zst.erledigt ? A.zielkennung.abgehakt : A.zielkennung.vermerkt) : A.zielkennung.unbekannt).replace('{Z}', zid);
    } else if (kat === 'ziel' && zid) {
      antwort = (zst ? (zst.erledigt ? A.zielstand.abgehakt : A.zielstand.offen) : A.zielkennung.unbekannt).replace('{Z}', zid);
    } else if ((kat === 'ziel' || kat === 'hinweise' || kat === 'meldung') && !def) {
      antwort = wahl(A.keinAuftrag);
    }
  }
  return { kat: kat, text: fuellen(antwort), verz: verz };
}

/* Dossierstatus (Statuswerte aus SCENARIO.dossierStatus) */
function statusDef(id) { return SCENARIO.dossierStatus.find(function (x) { return x.id === id; }) || null; }
function dossierStatusLabel(id) { const d = statusDef(id); return d ? h('span', { class: 'label ' + d.klasse }, d.label) : h('span', { class: 'dim' }, 'ohne Status'); }
function dossierStatusSetzen(e, status, anlass, out) {
  const d = STATE.dossiers.entitaeten[e.id], neu = statusDef(status), alt = statusDef(d.status);
  if ((d.status || null) === (neu ? neu.id : null)) return;
  d.status = neu ? neu.id : null; d.statusAm = neu ? nowIso() : null; d.aktualisiert = nowIso();
  out.push({ modul: 'Dossier', aktion: 'Dossierstatus geändert', krit: !!(neu && neu.kritisch),
             detail: e.id + ' ' + e.name + ': ' + (alt ? alt.label : 'ohne Status') + ' → ' + (neu ? neu.label : 'ohne Status') + (anlass ? '; Anlass: ' + anlass : '') });
}
/* Ziel abhaken oder wieder öffnen; löst Funkstille-Ende und Skriptauslöser aus */
function zielSetzen(def, z, erledigt, out) {
  const ms = MS(def.id);
  ms.ziele[z.id] = { erledigt: !!erledigt, t: erledigt ? nowIso() : null };
  const offen = offeneZiele();
  out.push({ modul: 'Mission', aktion: erledigt ? 'Missionsziel abgehakt' : 'Missionsziel wieder geöffnet',
    detail: z.id + ' (' + z.art + '): ' + z.text + ' Offen: ' + offen + ' von ' + def.ziele.length + (offen === 0 ? '; Abschluss der Mission möglich' : '') });
  if (erledigt && STATE.funkstille.aktiv && def.funkstille && def.funkstille.bisZiel === z.id) funkstilleBeenden('Vollzugsmeldung ' + z.id, out);
  if (erledigt) skriptAusloesen('ziel', z.id);
}
/* Nachricht des Agenten: Versand, Funkstille-Regel, Zustellung und geplante Antwort */
function nachrichtSenden(k, text, dr, out) {
  STATE.seq.nachricht += 1;
  const msg = { id: 'N-' + p3(STATE.seq.nachricht), von: 'agent', absender: SCENARIO.agent.codename, t: nowIso(), text: text,
                status: 'gesendet', dringlichkeit: dr, lagerelevant: false, art: null };
  STATE.komm.kanaele[k.id].nachrichten.push(msg);
  out.push({ modul: 'Kommunikation', aktion: 'Nachricht gesendet', detail: msg.id + ' an ' + k.gegenstelle + ' (Kanal ' + k.name + '), Dringlichkeit ' + dr + ': ' + kuerzen(text, 110) });
  const r = antwortFuer(k.id, text, dr, msg.id), funk = STATE.funkstille.aktiv;
  const vollzug = funk && k.id === 'handler' && r && r.kat === 'erledigt';     /* erste Vollzugsmeldung beendet die Funkstille */
  if (funk && !vollzug) {
    msg.blockiert = true;                                  /* bleibt auf "gesendet", keine Zustellung, keine Antwort */
    out.push({ modul: 'Kommunikation', aktion: 'Nachricht während Funkstille', krit: true, detail: msg.id + ' (Kanal ' + k.name + ') bleibt auf "gesendet"; keine Zustellung, keine Antwort' });
    return msg;
  }
  planeZustellung(k.id, msg);
  dialogMerken(k.id, r || { vorlage: null }, msg);
  if (r) {
    planen(STATE, { typ: 'antwort', kanal: k.id, zu: msg.id, text: vollzug ? SCENARIO.antworten.funkstilleEnde : r.text, funkstilleEnde: vollzug,
                    faelligAm: new Date(Date.parse(msg.t) + LESE_MS + r.verz * 1000).toISOString() });
  }
  return msg;
}
/* Bilder: Pfad aus dem Feld bild oder, bei bilder.automatisch, aus der Kennung. Kein Bild oder Ladefehler: Platzhalter. */
function bildPfad(obj, kennung) {
  const B = SCENARIO.bilder || {};
  const eigen = PROFIL.bilder[kennung];
  if (eigen) return eigen;
  return obj.bild || (B.automatisch ? (B.ordner || 'bilder/') + kennung.toLowerCase() + '.' + (B.endung || 'jpg') : null);
}
function bildFeld(pfad, alt, leerText) {
  const box = h('div', { class: 'foto' });
  const leer = function () { box.replaceChildren(h('span', { class: 'ph' }, leerText)); };
  if (!pfad) { leer(); return box; }
  box.appendChild(h('img', { src: pfad, alt: alt, onerror: leer }));
  return box;
}

/* Lichtbild aus Datei: Zuschnitt 4:5 aus der Mitte, 240 × 300 Pixel, JPEG; ergibt eine kleine Data-URL für den Zustand */
const BILD_PREFIX = 'data:image/jpeg;base64,';
function bildAusDatei(file, fertig, fehler, opt) {
  if (!file || !/^image\//.test(file.type || '')) { fehler('Keine Bilddatei.'); return; }
  const reader = new FileReader();
  reader.onerror = function () { fehler('Datei nicht lesbar.'); };
  reader.onload = function () {
    const img = new Image();
    img.onerror = function () { fehler('Bildformat wird nicht unterstützt.'); };
    img.onload = function () {
      try {
        const c = document.createElement('canvas');
        if (opt && opt.gross) {                       /* Aufnahme: Seitenverhältnis bleibt, längste Seite höchstens 960 Pixel */
          const f = Math.min(1, 960 / img.width, 960 / img.height);
          c.width = Math.max(1, Math.round(img.width * f)); c.height = Math.max(1, Math.round(img.height * f));
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          fertig(c.toDataURL('image/jpeg', 0.78));
          return;
        }
        const W = 240, H = 300;
        c.width = W; c.height = H;
        const g = c.getContext('2d'), ar = W / H, ir = img.width / img.height;
        let sw = img.width, sh = img.height, sx = 0, sy = 0;
        if (ir > ar) { sw = img.height * ar; sx = (img.width - sw) / 2; } else { sh = img.width / ar; sy = (img.height - sh) / 2; }
        g.fillStyle = '#10151c'; g.fillRect(0, 0, W, H);
        g.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
        fertig(c.toDataURL('image/jpeg', 0.85));
      } catch (e) { fehler('Bild konnte nicht verarbeitet werden.'); }
    };
    img.src = String(reader.result);
  };
  reader.readAsDataURL(file);
}
function bildGueltig(b) { return typeof b === 'string' && b.indexOf(BILD_PREFIX) === 0 && b.length < 450000; }

/* =====================================================================
   DISPATCH
   Einziger Weg zur Zustandsänderung:
   (1) Zustand ändern, (2) Protokolleintrag mit UTC-Zeitstempel,
   (3) in localStorage speichern, (4) Ansichten neu rendern.
   Jeder Handler gibt { modul, aktion, detail, krit } oder eine Liste solcher
   Einträge zurück; null bedeutet: keine Änderung.
   Das Merkmal krit kennzeichnet kritische Ereignisse (Auswertung in Modul 5 und im Protokoll).
   ===================================================================== */
const ACTIONS = {
  /* Meldewesen-Korrektur: Beim Sitzungsstart beginnt die Bewertung bei "jetzt". Fenster, die während der Abwesenheit
     abliefen, werden nicht als Versäumnis gewertet, sondern nur vermerkt. */
  SITZUNG_START: function (a) {
    const out = [{ modul: 'System', aktion: 'Sitzung geöffnet', detail: a.neu ? 'Ausgangszustand aus Szenario erzeugt' : 'Gespeicherter Zustand geladen' }];
    const jetzt = Date.now();
    if (!a.neu && meldeAktiv()) {
      let f = fensterNach(Date.parse(STATE.melde.geprueftBis)), n = 0, erstes = null, letztes = null;
      while (f && f.D <= jetzt && n < 4000) { n += 1; erstes = erstes || f; letztes = f; f = fensterNach(f.D); }
      if (n) out.push({ modul: 'Profil', aktion: 'Fenster während Abwesenheit nicht bewertet',
        detail: n + (n === 1 ? ' Meldefenster' : ' Meldefenster') + ' zwischen ' + erstes.label + ' (' + fmtDatum(erstes.S) + ') und ' + letztes.label + ' (' + fmtDatum(letztes.S) + '); keine Wertung als Versäumnis' });
    }
    STATE.melde.geprueftBis = new Date(jetzt).toISOString();
    if (!a.neu) profilEinspielen(STATE);
    profilSpeichern();
    return out;
  },
  NAVIGATION: function (a) {
    const m = MODULES.find(function (x) { return x.id === a.modul; });
    if (!m || STATE.ui.modul === m.id) return null;
    STATE.ui.modul = m.id;
    let detail = m.titel;
    if (m.id === 'komm') {                               /* Öffnen des Moduls öffnet den aktiven Kanal */
      const n = kanalLesen(STATE.komm.aktiv);
      if (n) detail += '; Kanal ' + kanalDef(STATE.komm.aktiv).name + ': ' + n + (n === 1 ? ' Nachricht' : ' Nachrichten') + ' als gelesen markiert';
    }
    return { modul: m.log, aktion: 'Modul geöffnet', detail: detail };
  },
  EXPORT: function (a) { return { modul: 'System', aktion: 'Zustand exportiert', detail: a.datei }; },
  /* Ereignisse des Zugangsschirms (Zeitstempel stammt vom Ereignis selbst, da sie vor dem Laden des Zustands entstehen können) */
  AUTH_EREIGNIS: function (a) { return a.liste && a.liste.length ? a.liste : null; },
  IMPORT: function (a) {
    STATE = a.state; VIEW.draft = {}; planeAlle(); profilEinspielen(STATE);
    return { modul: 'System', aktion: 'Zustand importiert', detail: a.datei + ', ' + a.state.log.length + ' Protokolleinträge übernommen' };
  },
  IMPORT_ABGELEHNT: function (a) { return { modul: 'System', aktion: 'Import abgelehnt', detail: a.datei + ': ' + a.grund }; },
  RESET: function () {
    STATE = buildInitialState(Date.now()); VIEW.draft = {}; planeAlle();
    return { modul: 'System', aktion: 'Zustand zurückgesetzt', detail: 'Ausgangszustand hergestellt, Seed-Zeiten neu berechnet' };
  },

  /* --- Modul 1: Agentenprofil --- */
  STATUS_GESETZT: function (a) {
    if (STATUS_LISTE.indexOf(a.status) < 0 || a.status === STATE.agent.status) return null;
    if (a.status === 'Ruhend' && (LM() || STATE.extraktion.anforderung.status !== 'keine')) return null;   /* Ruhend nur ohne laufenden Auftrag */
    const alt = STATE.agent.status, jetzt = Date.now(), out = [];
    STATE.agent.status = a.status;
    out.push({ modul: 'Profil', aktion: 'Operativer Status geändert', detail: alt + ' → ' + a.status + ' (manuell)',
               krit: a.status === 'Erhöhtes Risiko' || a.status === 'Extraktion ausstehend' });
    if (a.status === 'Ruhend') {
      STATE.pause = nowIso();
      out.push({ modul: 'Kommunikation', aktion: 'Handler schweigt', detail: 'Status Ruhend: keine Zuweisung und keine Meldungen des Handlers bis zur Reaktivierung' });
    } else if (alt === 'Ruhend') {
      if (STATE.vorlauf && STATE.einweisung === false) {                  /* erste Aktivierung: Verbindungsaufbau, danach erster Auftrag */
        const S = SCENARIO.serie;
        STATE.einweisung = true;
        S.einweisung.forEach(function (m) { planen(STATE, { typ: 'verlauf', kanal: m.kanal, auto: !!m.auto, text: m.text, faelligAm: new Date(jetzt + m.sek * 1000).toISOString() }); });
        STATE.serie.folge = { mission: S.start, faelligAm: new Date(jetzt + S.einweisungFolgeSek * 1000).toISOString() };
        out.push({ modul: 'Kommunikation', aktion: 'Verbindung zum Handler aufgenommen', detail: 'Erste Aktivierung: Einweisung und erster Auftrag folgen' });
      } else if (STATE.pause) {                                            /* Pause: ausstehende Ereignisse um die Ruhezeit verschieben */
        const d = jetzt - Date.parse(STATE.pause), v = function (iso) { return new Date(Date.parse(iso) + d).toISOString(); };
        STATE.plan.forEach(function (p) { if (p.typ !== 'antwort') p.faelligAm = v(p.faelligAm); });
        if (STATE.serie.folge) STATE.serie.folge.faelligAm = v(STATE.serie.folge.faelligAm);
        out.push({ modul: 'Kommunikation', aktion: 'Handler wieder erreichbar', detail: 'Ausstehende Ereignisse um ' + fmtDauer(d) + ' verschoben' });
      }
      STATE.pause = null;
    }
    return out;
  },
  LEGENDE_GEWECHSELT: function (a) {
    const neu = legende(a.legende), alt = legende(STATE.agent.legende);
    if (!neu || neu.id === alt.id) return null;
    STATE.agent.legende = neu.id;
    systemnachricht('handler', 'Systemmeldung: Aktive Legende gewechselt, ' + alt.bezeichnung + ' → ' + neu.bezeichnung + '. Meldung gemäß ROE 7.');
    return { modul: 'Profil', aktion: 'Aktive Legende gewechselt', krit: true,
             detail: alt.bezeichnung + ' (' + alt.name + ', ' + alt.land + ') → ' + neu.bezeichnung + ' (' + neu.name + ', ' + neu.land + '); Systemnachricht an Kanal Handler' };
  },
  CHECKIN: function (a) {
    const def = KM(), ort = def.standorte.find(function (o) { return o.id === a.standortId; });
    if (!ort) return null;
    const jetzt = Date.now();
    STATE.agent.checkin = { t: new Date(jetzt).toISOString(), standortId: ort.id };
    let detail = ort.id + ' ' + ort.name + '; ' + def.meldewesen.kennwortverfahren;
    if (meldeAktiv()) detail += '; zählt für Meldefenster ' + fensterNach(jetzt).label;
    else detail += STATE.funkstille.aktiv ? '; Meldefenster ausgesetzt (Funkstille)' : '; kein laufender Auftrag, Meldewesen ruht';
    if (STATE.melde.versaeumt > 0) {
      detail += '; Versäumniszähler zurückgesetzt (zuvor ' + STATE.melde.versaeumt + ')';
      STATE.melde.versaeumt = 0;
    }
    skriptAusloesen('checkin');
    return { modul: 'Profil', aktion: 'Check-in gemeldet', detail: detail };
  },
  TEXT_GEAENDERT: function (a) {
    if (a.feld !== 'notizen' && a.feld !== 'einschraenkungen') return null;
    if (STATE.agent[a.feld] === a.wert) return null;
    STATE.agent[a.feld] = a.wert;
    STATE.agent[a.feld + 'Geaendert'] = nowIso();
    /* leicht: Das Eingabefeld zeigt den Wert bereits; der Modulbereich wird nicht neu aufgebaut,
       damit ein gleichzeitiger Klick auf eine Schaltfläche nicht verloren geht. */
    return { modul: 'Profil', aktion: a.feld === 'notizen' ? 'Notizen geändert' : 'Operative Einschränkungen geändert',
             detail: 'automatisch gespeichert, ' + a.wert.length + ' Zeichen', leicht: true };
  },
  /* Prüfung der seit der letzten Prüfung abgelaufenen Meldefristen. ROE-Nummer, Eskalationstexte und die
     eingeleitete Option stammen aus dem Meldewesen der laufenden Mission. */
  MELDEFENSTER_PRUEFUNG: function () {
    if (!meldeAktiv()) return null;
    const jetzt = Date.now(), def = LM(), M = def.meldewesen, out = [];
    let f = fensterNach(Date.parse(STATE.melde.geprueftBis)), weitere = 0, letztes = '', schutz = 0;
    while (f && f.D <= jetzt && schutz++ < 4000) {
      if (meldungLiegtVor(f)) {
        out.push({ modul: 'Profil', aktion: 'Meldefenster erfüllt', detail: f.label + ' (' + fmtDatum(f.S) + '), Check-in ' + fmtZ(STATE.agent.checkin.t) });
      } else {
        STATE.melde.versaeumt += 1;
        const n = STATE.melde.versaeumt, kopf = f.label + ' (' + fmtDatum(f.S) + '), Frist ' + fmtZ(f.D) + ' ohne Meldung; ';
        if (n === 1) {
          out.push({ modul: 'Profil', aktion: 'Meldefenster versäumt', krit: true, detail: kopf + '1. Versäumnis. ROE ' + M.roeNr + ': ' + M.eskalation[1] });
          systemnachricht('handler', 'Systemmeldung: Meldefenster ' + f.label + ' ohne Meldung. Nachmeldung angefordert.');
          if (STATE.agent.status === 'Aktiv') setStatus('Erhöhtes Risiko', 'Eskalation nach versäumtem Meldefenster ' + f.label, out);
        } else if (n === 2) {
          out.push({ modul: 'Profil', aktion: 'Meldefenster versäumt', krit: true, detail: kopf + '2. Versäumnis in Folge. ROE ' + M.roeNr + ': ' + M.eskalation[2] });
          if (STATE.extraktion.anforderung.status === 'keine') {
            const jetztIso = nowIso(), O = optionText(M.eskalationOption);
            STATE.extraktion.anforderung = Object.assign(leereAnforderung(), { status: 'bestätigt', option: M.eskalationOption, durch: 'Gegenstelle', t: jetztIso,
              statusZuvor: STATE.agent.status, freigabe: 'erteilt', freigabeT: jetztIso,
              begruendung: 'Durch Gegenstelle eingeleitet: zwei versäumte Meldefenster in Folge (ROE ' + M.roeNr + ').' });
            out.push({ modul: 'Extraktion', aktion: 'Option ' + M.eskalationOption + ' durch Gegenstelle eingeleitet', krit: true, detail: O + ', Stand bestätigt; Anlass: zwei versäumte Meldefenster in Folge (ROE ' + M.roeNr + ')' });
            setStatus('Extraktion ausstehend', O + ' durch Gegenstelle eingeleitet', out);
            planeGegenstelle('durchfuehrung');
            systemnachricht('handler', 'Systemmeldung: Zweites Meldefenster in Folge ohne Meldung. Gegenstelle leitet ' + O + ' ein.');
          } else {
            out.push({ modul: 'Extraktion', aktion: 'Eskalation ohne neue Anforderung', krit: true, detail: 'Es besteht bereits eine Anforderung (Option ' + STATE.extraktion.anforderung.option + ', ' + STATE.extraktion.anforderung.status + ')' });
          }
        } else { weitere += 1; letztes = f.label + ' (' + fmtDatum(f.S) + ')'; }
      }
      STATE.melde.geprueftBis = new Date(f.D).toISOString();
      f = fensterNach(f.D);
    }
    if (weitere) {
      out.push({ modul: 'Profil', aktion: 'Meldefenster versäumt', krit: true,
                 detail: weitere + (weitere === 1 ? ' weiteres Fenster' : ' weitere Fenster') + ' ohne Meldung, zuletzt ' + letztes + '; ' + STATE.melde.versaeumt + ' Versäumnisse in Folge, Eskalation besteht fort' });
    }
    return out.length ? out : null;
  },

  /* --- Modul 4: Sichere Kommunikation --- */
  KANAL_GEOEFFNET: function (a) {
    const k = kanalDef(a.kanal);
    if (!k) return null;
    if (STATE.komm.aktiv === k.id && STATE.komm.kanaele[k.id].ungelesen === 0) return null;
    STATE.komm.aktiv = k.id;
    const n = kanalLesen(k.id);
    return { modul: 'Kommunikation', aktion: 'Kanal geöffnet', detail: k.name + ' (' + k.gegenstelle + ')' + (n ? ', ' + n + (n === 1 ? ' Nachricht' : ' Nachrichten') + ' als gelesen markiert' : '') };
  },
  NACHRICHT_GESENDET: function (a) {
    const k = kanalDef(a.kanal), text = String(a.text || '').trim();
    const dr = DRINGLICHKEIT.indexOf(a.dringlichkeit) >= 0 ? a.dringlichkeit : 'Routine';
    if (!k || !text) return null;
    const out = [];
    nachrichtSenden(k, text, dr, out);
    delete VIEW.draft['km-' + k.id];
    return out;
  },
  NACHRICHT_STATUS: function (a) {
    const n = nachricht(a.id), rang = ['gesendet', 'zugestellt', 'gelesen'];
    if (!n || n.msg.von !== 'agent' || rang.indexOf(a.status) <= rang.indexOf(n.msg.status)) return null;
    const alt = n.msg.status;
    n.msg.status = a.status;
    /* leicht: nur die Statusanzeige der Nachricht wird nachgeführt */
    return { modul: 'Kommunikation', aktion: 'Nachrichtenstatus geändert', leicht: true,
             detail: n.msg.id + ' (Kanal ' + kanalDef(n.kanal).name + '): ' + alt + ' → ' + a.status };
  },
  /* Nächste noch nicht gesendete Skriptnachricht der laufenden Mission sofort (Regie) */
  NACHRICHT_EINGEHEND: function () {
    const def = LM();
    if (!def) return null;
    const i = MS(def.id).skript.findIndex(function (s) { return s !== 'gesendet'; });
    if (i < 0) return null;
    const out = [];
    sendeSkript(def, i, out);
    return out;
  },
  NACHRICHT_EINGESPIELT: function (a) {
    const k = kanalDef(a.kanal), text = String(a.text || '').trim();
    if (!k || !text) return null;
    const msg = eingang(k.id, { von: 'gegenstelle', absender: k.gegenstelle, text: text, lagerelevant: !!a.lagerelevant,
                                dringlichkeit: DRINGLICHKEIT.indexOf(a.dringlichkeit) >= 0 ? a.dringlichkeit : 'Routine' });
    const out = [eingangsEintrag(msg, k, '')];
    if (msg.lagerelevant) bedrohungErhoehen(msg, k.name, out);
    return out;
  },
  /* Fälliger Planeintrag (Skriptnachricht, Antwort, Freigabe, Durchführung) */
  FAELLIG: function (a) {
    const p = STATE.plan.find(function (x) { return x.id === a.id; });
    if (!p) return null;
    planEntfernen(function (x) { return x.id === p.id; });
    let out = [];
    if (p.typ === 'skript') {
      const def = LM();
      if (def && def.id === p.mission && MS(def.id).skript[p.index] !== 'gesendet') sendeSkript(def, p.index, out);
    } else if (p.typ === 'antwort') {
      const k = kanalDef(p.kanal);
      const msg = eingang(k.id, { von: 'gegenstelle', absender: k.gegenstelle, text: p.text });
      out.push(eingangsEintrag(msg, k, ', Antwort auf ' + p.zu));
      if (p.funkstilleEnde && STATE.funkstille.aktiv) funkstilleBeenden('Vollzugsmeldung ' + p.zu + ' über Kanal Handler', out);
    } else if (p.typ === 'funkstille') {
      const def = LM();
      if (def && def.id === p.mission && !STATE.funkstille.aktiv) {
        STATE.funkstille = { aktiv: true, seit: nowIso(), mission: def.id };
        out.push({ modul: 'Kommunikation', aktion: 'Funkstille begonnen', krit: true, detail: (def.funkstille.text || 'Anordnung des Handlers') + '; Einsatzbeginn erreicht, Meldefenster ausgesetzt, keine Eskalation' });
      }
    } else if (p.typ === 'verlauf') {
      const k = kanalDef(p.kanal);
      const msg = p.auto ? eingang(k.id, { von: 'system', absender: 'System', text: p.text, art: 'Systemnachricht' })
                         : eingang(k.id, { von: 'gegenstelle', absender: k.gegenstelle, text: p.text, art: p.art || null });
      out.push(eingangsEintrag(msg, k, ''));
    } else if (p.typ === 'akte_antwort') {
      const doc = (SCENARIO.akten || []).find(function (d) { return d.id === p.doc; }), r = doc && schwerListe(doc).find(function (x) { return x.r === p.r; });
      if (doc && r) {
        const ok = r.antrag === 'gewaehrt';
        if (ok) STATE.akten.freigaben[schwerKey(doc, r)] = true;
        const txt = r.antwort || (ok ? 'Freigabe erteilt. Nur zur Kenntnis.' : 'Antrag abgelehnt.');
        const msg = eingang('handler', { von: 'gegenstelle', absender: kanalDef('handler').gegenstelle, text: 'Akte ' + doc.id + ': ' + txt });
        out.push(eingangsEintrag(msg, kanalDef('handler'), ''));
        out.push({ modul: 'Akten', aktion: ok ? 'Freigabe erteilt' : 'Freigabe abgelehnt', krit: false, detail: doc.id + ', Schwärzung ' + r.r + ' (Mindeststufe ' + r.stufe + ')' });
      }
    } else if (p.typ === 'anreise_ankunft') {
      const an = STATE.anreise, def = missionDef(p.mission);
      if (an && an.mission === p.mission && !an.angekommen && def) {
        an.angekommen = true;
        STATE.agent.checkin = { t: nowIso(), standortId: an.ortId };
        const msg = eingang('handler', { von: 'system', absender: 'System', text: SCENARIO.anreiseTexte.ankunft.replace('{ORT}', an.ortId + ' ' + standortName(an.ortId)), art: 'Systemnachricht' });
        out.push(eingangsEintrag(msg, kanalDef('handler'), ''));
        out.push({ modul: 'Mission', aktion: 'Anreise abgeschlossen', detail: opText(def) + ': Ankunft ' + an.ortId + ' ' + standortName(an.ortId) + ', Check-in gesetzt' });
      }
    } else if (p.typ === 'anreise_pruefung') {
      const def = LM();
      if (def && def.id === p.mission && def.anreise && !STATE.anreise) {
        STATE.anreise = { mission: def.id, eingereicht: null, ohnePlan: true, angekommen: true, risiko: 70, stufe: 'hoch', ortId: def.checkinStart.standortId,
                          faktoren: [{ text: 'Keine Reisemeldung bis Einsatzbeginn', punkte: 70 }], abfahrt: null, ankunft: null };
        STATE.agent.checkin = { t: nowIso(), standortId: def.checkinStart.standortId };
        const msg = eingang('handler', { von: 'gegenstelle', absender: kanalDef('handler').gegenstelle, text: SCENARIO.anreiseTexte.ohnePlan });
        out.push(eingangsEintrag(msg, kanalDef('handler'), ''));
        out.push({ modul: 'Mission', aktion: 'Anreise ohne Meldung', krit: true, detail: opText(def) + ': bis Einsatzbeginn keine Reisemeldung; Risikowert 70, Standort ' + def.checkinStart.standortId + ' angenommen' });
      }
    } else if (p.typ === 'freigabe' || p.typ === 'durchfuehrung') {
      out = gegenstelleSchritt(p.typ) || [];
    }
    return out.length ? out : { modul: 'System', aktion: 'Planeintrag verworfen', detail: p.id + ' (' + p.typ + ') ohne Wirkung, Voraussetzung entfallen' };
  },
  AUTOMATIK_GESETZT: function (a) {
    if (STATE.automatik === !!a.ein) return null;
    STATE.automatik = !!a.ein;
    return { modul: 'System', aktion: 'Automatik der Gegenstellen ' + (STATE.automatik ? 'eingeschaltet' : 'ausgeschaltet'), detail: STATE.plan.length + ' Ereignisse im Plan' };
  },
  FUNKSTILLE_GESETZT: function (a) {
    if (STATE.funkstille.aktiv === !!a.aktiv) return null;
    const out = [];
    if (a.aktiv) {
      STATE.funkstille = { aktiv: true, seit: nowIso(), mission: STATE.kontext };
      out.push({ modul: 'Kommunikation', aktion: 'Funkstille begonnen', krit: true, detail: 'Anordnung des Handlers; Meldefenster ausgesetzt, keine Eskalation' });
    } else funkstilleBeenden('Anordnung des Handlers', out);
    return out;
  },
  BEDROHUNG_GESETZT: function (a) {
    const X = STATE.extraktion, neu = Number(a.stufe), alt = X.stufe, B = SCENARIO.bedrohungsstufen;
    if (!(neu >= 1 && neu <= 5) || neu === alt) return null;
    const t = nowIso(), out = [];
    X.stufe = neu; X.bewertet = t;
    X.begruendung.push({ t: t, text: 'Neubewertung der Lage durch den Handler: Stufe ' + alt + ' → Stufe ' + neu + '.', quelle: 'Handler ' + SCENARIO.extraktion.freigabe.durch });
    out.push({ modul: 'Extraktion', aktion: neu > alt ? 'Bedrohungsstufe erhöht' : 'Bedrohungsstufe gesenkt', krit: true,
               detail: 'Stufe ' + alt + ' (' + B[alt] + ') → Stufe ' + neu + ' (' + B[neu] + '); Anlass: Neubewertung durch den Handler' });
    if (neu >= 4 && STATE.agent.status === 'Aktiv') setStatus('Erhöhtes Risiko', 'Bedrohungsstufe ' + neu + '; Anlass: Neubewertung durch den Handler', out);
    return out;
  },

  /* --- Modul 5: Panic / Extraktion --- */
  EXTRAKTION_ANGEFORDERT: function (a) {
    const o = optionDef(a.option), text = String(a.begruendung || '').trim(), X = STATE.extraktion;
    if (!o || !text || X.anforderung.status !== 'keine') return null;
    const t = nowIso();
    X.anforderung = Object.assign(leereAnforderung(), { status: 'angefordert', option: o.id, begruendung: text, t: t, durch: 'Agent',
                                                         statusZuvor: STATE.agent.status, freigabe: 'ausstehend' });
    delete VIEW.draft['x-begr']; delete VIEW.draft['x-opt'];
    const out = [{ modul: 'Extraktion', aktion: 'Extraktion angefordert', krit: true,
      detail: optionText(o.id) + ', Vorlauf ' + o.vorlauf + '; Begründung: ' + kuerzen(text, 110) + '; Freigabe durch ' + SCENARIO.extraktion.freigabe.durch + ' ausstehend' }];
    setStatus('Extraktion ausstehend', 'Extraktionsanforderung ' + optionText(o.id), out);
    systemnachricht('handler', 'Systemmeldung: Extraktionsanforderung gestellt, ' + optionText(o.id) + '. Begründung: ' + text + ' Freigabe durch Handler ausstehend.');
    planeGegenstelle('freigabe');                           /* Automatik: Freigabe nach freigabeNachSek */
    return out;
  },
  EXTRAKTION_GEGENSTELLE: function (a) { return gegenstelleSchritt(a.schritt); },
  EXTRAKTION_ZURUECKGEZOGEN: function () {
    const r = STATE.extraktion.anforderung;
    if (r.durch !== 'Agent' || (r.status !== 'angefordert' && r.status !== 'bestätigt')) return null;
    const O = optionText(r.option), out = [{ modul: 'Extraktion', aktion: 'Anforderung zurückgezogen', krit: true, detail: O + ': ' + r.status + ' → keine, durch Agent' }];
    systemnachricht('handler', 'Systemmeldung: Extraktionsanforderung ' + O + ' durch Agent zurückgezogen.');
    anforderungAufheben('Extraktionsanforderung zurückgezogen', out);
    return out;
  },
  STANDORTFREIGABE_GESETZT: function (a) {
    const X = STATE.extraktion;
    if (X.standortfreigabe === !!a.ein) return null;
    X.standortfreigabe = !!a.ein;
    return { modul: 'Extraktion', aktion: 'Standortfreigabe ' + (X.standortfreigabe ? 'eingeschaltet' : 'ausgeschaltet'), krit: true,
             detail: 'Letzter bekannter Standort: ' + ortText(STATE.agent.checkin) + ', Stand ' + fmtZ(STATE.agent.checkin.t) };
  },

  /* --- Modul 2: Missionsbriefing und Auftragsabfolge --- */
  ZIEL_GESETZT: function (a) {
    const def = SCENARIO.missionen.find(function (m) { return m.ziele.some(function (z) { return z.id === a.id; }); });
    if (!def) return null;
    const ms = MS(def.id), z = def.ziele.find(function (x) { return x.id === a.id; });
    if (ms.status !== 'laufend' || !einsatzLaeuft() || ms.ziele[z.id].erledigt === !!a.erledigt) return null;   /* Ziele sind erst ab Einsatzbeginn abhakbar */
    const out = [];
    zielSetzen(def, z, a.erledigt, out);
    return out;
  },
  /* Ziel als erledigt (oder eliminiert) melden: Meldung an den Handler, Ziel abhaken, Dossierstatus gemäß Zieldefinition */
  ZIEL_GEMELDET: function (a) {
    const def = LM();
    const z = def ? def.ziele.find(function (x) { return x.id === a.id; }) : null;
    if (!z || !einsatzLaeuft() || MS(def.id).ziele[z.id].erledigt) return null;
    const M = z.meldung || null, sd = M ? statusDef(M.status) : null, out = [];
    out.push({ modul: 'Mission', aktion: sd && sd.id === 'eliminiert' ? 'Ziel als eliminiert gemeldet' : 'Ziel als erledigt gemeldet', krit: !!(sd && sd.kritisch),
               detail: z.id + ' (' + z.art + ')' + (M ? '; Bezug ' + M.entitaet + ' ' + entitaet(M.entitaet).name : '') });
    const text = SCENARIO.serie.texte[M && M.vollzug ? 'vollzugsmeldung' : 'zielmeldung'].replace('{Z}', z.id);
    if (!STATE.funkstille.aktiv || (def.funkstille && def.funkstille.bisZiel === z.id)) nachrichtSenden(kanalDef('handler'), text, 'Priorität', out);
    else out.push({ modul: 'Kommunikation', aktion: 'Zielmeldung zurückgestellt', krit: true, detail: z.id + ': keine Nachricht während der Funkstille; das Ziel wird im Terminal vermerkt' });
    zielSetzen(def, z, true, out);
    if (M) dossierStatusSetzen(entitaet(M.entitaet), M.status, 'Meldung Ziel ' + z.id, out);
    return out;
  },
  MISSIONSSTATUS_GESETZT: function (a) {
    const def = LM();
    if (!def || SCENARIO.serie.arbeitsstaende.indexOf(a.status) < 0 || a.status === MS(def.id).arbeitsstand) return null;
    const alt = MS(def.id).arbeitsstand;
    MS(def.id).arbeitsstand = a.status;
    return { modul: 'Mission', aktion: 'Arbeitsstand geändert', detail: opText(def) + ': ' + alt + ' → ' + a.status };
  },
  LAGEBERICHT: function (a) {
    const text = String(a.text || '').trim();
    if (!text) return null;
    STATE.seq.bericht += 1;
    const id = 'LB-' + p3(STATE.seq.bericht);
    STATE.berichte.push({ id: id, t: nowIso(), text: text, mission: STATE.kontext });
    delete VIEW.draft['lb-text'];
    return { modul: 'Mission', aktion: 'Lagebericht erfasst', detail: id + ' (' + STATE.kontext + '): ' + kuerzen(text, 140) };
  },
  /* Zuweisung eines Auftrags durch den Handler (Folgeauftrag nach der Verzögerung folgeNachSek) */
  MISSION_ZUGEWIESEN: function (a) {
    const def = missionDef(a.id);
    if (!def || MS(def.id).status !== 'offen' || STATE.serie.ende) return null;
    const ms = MS(def.id);
    ms.status = 'zugewiesen'; ms.zugewiesenAm = nowIso();
    STATE.serie.folge = null;
    const m = handlernachricht(def.auftragsnachricht, 'Auftrag');
    return { modul: 'Mission', aktion: 'Neuer Auftrag zugewiesen', krit: true,
             detail: opText(def) + ', Art ' + def.art + ' (' + def.dienstbezeichnung + '), Einstufung ' + def.einstufung + '; Nachricht ' + m.id + ' (Kanal Handler)' };
  },
  MISSION_ANGENOMMEN: function (a) {
    const def = missionDef(a.id);
    if (!def || MS(def.id).status !== 'zugewiesen' || LM() || STATE.serie.ende || STATE.agent.status === 'Ruhend') return null;
    const jetzt = Date.now(), iso = new Date(jetzt).toISOString(), alt = KM(), out = [];
    missionAnsetzen(STATE, def, jetzt);
    STATE.vorlauf = false;
    if (VIEW.karte) VIEW.karte.init = false;
    const neu = SCENARIO.entitaeten.filter(function (e) { return e.mission === def.id; });
    neu.forEach(function (e) { STATE.dossiers.entitaeten[e.id].aktualisiert = iso; });
    ['x-opt', 'x-begr', 'sel-ort'].forEach(function (k) { delete VIEW.draft[k]; });
    const L = legende(def.legendeStart);
    out.push({ modul: 'Mission', aktion: 'Auftrag angenommen', krit: true,
      detail: opText(def) + ', Art ' + def.art + ' (' + def.dienstbezeichnung + '), Einstufung ' + def.einstufung + '; Kontext ' + alt.name + ' → ' + def.name +
              '; Legende ' + L.bezeichnung + ' (' + L.name + '); Standort ' + def.checkinStart.standortId + ' ' + standortName(def.checkinStart.standortId) +
              '; ' + neu.length + ' Dossiers freigeschaltet; Bedrohungsstufe ' + def.extraktion.stufeStart +
              '; Meldefenster ' + def.meldewesen.fensterStundenUtc.map(function (s) { return p2(s) + '00Z'; }).join(' und ') });
    setStatus('Aktiv', 'Annahme ' + opText(def), out);
    systemnachricht('handler', serienText('annahme', def));
    /* Einleitende Nachrichten der Gegenstellen kommen zeitversetzt; Nachrichten des Agenten aus der Vorlage entfallen */
    const BASIS = { handler: 20, support: 70, asset: 140 };
    SCENARIO.kommunikation.kanaele.forEach(function (k) {
      let i = 0;
      (def.verlauf[k.id] || []).forEach(function (m) {
        if (m.auftrag || m.von === 'agent') return;
        const sek = (BASIS[k.id] || 30) + i * 75 + (i * 37 + def.nummer.length * 11) % 60;
        i += 1;
        planen(STATE, { typ: 'verlauf', kanal: k.id, auto: false, art: k.id === 'support' ? 'Automatische Meldung' : null, text: m.text, faelligAm: new Date(jetzt + sek * 1000).toISOString() });
      });
    });
    if (STATE.funkstille.aktiv) out.push({ modul: 'Kommunikation', aktion: 'Funkstille begonnen', krit: true, detail: def.funkstille.text + '; Meldefenster ausgesetzt, keine Eskalation' });
    return out;
  },
  ANREISE_EINGEREICHT: function (a) {
    const def = LM();
    if (!def || !def.anreise || einsatzLaeuft() || STATE.agent.status === 'Ruhend') return null;
    if (STATE.anreise && STATE.anreise.abfahrt && Date.now() >= Date.parse(STATE.anreise.abfahrt)) return null;
    const jetzt = Date.now(), b = anreiseBewerten(def, a, jetzt);
    if (!b || !b.gueltig) return null;
    planEntfernen(function (p) { return p.typ === 'anreise_ankunft' || p.anreise; });
    const text = anreiseRueckmeldung(b);
    STATE.anreise = { mission: def.id, eingereicht: new Date(jetzt).toISOString(), ohnePlan: false, angekommen: false, mittel: b.mittel, mittelName: b.mittelName, abfahrtH: b.abfahrtH,
                      unterkunft: b.unterkunft, ortId: b.ortId, ausgangId: b.ausgangId, ausgangName: b.ausgangName, km: b.km, erkundung: b.erkundung, abfahrt: b.abfahrt, ankunft: b.ankunft, dauerMin: b.dauerMin, puffer: b.puffer,
                      risiko: b.risiko, stufe: b.stufe, faktoren: b.faktoren, rueckmeldung: text };
    planen(STATE, { typ: 'verlauf', kanal: 'handler', auto: false, anreise: true, text: text, faelligAm: new Date(jetzt + (25 + b.risiko % 20) * 1000).toISOString() });
    planen(STATE, { typ: 'anreise_ankunft', mission: def.id, faelligAm: b.ankunft });
    return { modul: 'Mission', aktion: 'Reiseplan eingereicht', krit: b.stufe === 'hoch',
             detail: opText(def) + ': ' + (b.ausgangName ? 'ab ' + b.ausgangName + ', ' : '') + b.mittelName + ', Abfahrt ' + fmtZ(b.abfahrt) + ', Ankunft ' + fmtZ(b.ankunft) + ' in ' + b.ortId + ' ' + standortName(b.ortId) +
                     ', Puffer ' + dauerText(b.puffer) + ', Risikowert ' + b.risiko + ' (' + b.stufe + ')' + (b.erkundung ? ', mit Vorerkundung' : '') };
  },
  MISSION_AKTEUR_ZUGEORDNET: function (a) {
    const def = LM(), e = entitaet(a.id);
    if (!def || !e || !freigeschaltet(e.mission) || e.mission === def.id || STATE.agent.status === 'Ruhend') return null;
    const ms = MS(def.id);
    ms.zusatz = ms.zusatz || [];
    if (ms.zusatz.some(function (x) { return x.id === e.id; })) return null;
    const rolle = ZUSATZ_ROLLEN.indexOf(a.rolle) >= 0 ? a.rolle : ZUSATZ_ROLLEN[0], b = zusatzBewerten(def, e, rolle), T = SCENARIO.zusatzTexte;
    const liste = T[b.urteil], text = liste[(ms.zusatz.length + e.id.length + rolle.length) % liste.length]
      .replace('{E}', e.id + ' ' + e.name).replace('{ROLLE}', rolle).replace('{AUFLAGE}', b.auflage || '').replace('{GRUND}', b.grund || '').replace('  ', ' ');
    ms.zusatz.push({ id: e.id, rolle: rolle, t: nowIso(), urteil: b.urteil, auflage: b.auflage || null, grund: b.grund || null });
    planen(STATE, { typ: 'verlauf', kanal: 'handler', auto: false, text: text, faelligAm: new Date(Date.now() + (20 + e.id.length * 3) * 1000).toISOString() });
    return { modul: 'Mission', aktion: 'Zusatzakteur gemeldet', krit: b.urteil === 'abgelehnt', detail: opText(def) + ': ' + e.id + ' ' + e.name + ' als ' + rolle + ', Bewertung ' + (b.urteil === 'auflage' ? 'mit Auflage' : b.urteil) };
  },
  MISSION_AKTEUR_ENTFERNT: function (a) {
    const def = LM();
    if (!def) return null;
    const ms = MS(def.id), i = (ms.zusatz || []).findIndex(function (x) { return x.id === a.id; });
    if (i < 0) return null;
    const x = ms.zusatz.splice(i, 1)[0], e = entitaet(x.id);
    return { modul: 'Mission', aktion: 'Zusatzakteur zurückgezogen', detail: opText(def) + ': ' + x.id + (e ? ' ' + e.name : '') };
  },
  AKTE_ANTRAG: function (a) {
    const doc = (SCENARIO.akten || []).find(function (d) { return d.id === a.doc; });
    if (!doc || !freigeschaltet(doc.mission) || STATE.agent.status === 'Ruhend') return null;
    const r = schwerListe(doc).find(function (x) { return x.r === a.r; });
    if (!r || !schwerOffen(doc, r) || r.antrag === 'nie') return null;
    const key = schwerKey(doc, r);
    if (STATE.akten.anfragen[key]) return null;
    STATE.akten.anfragen[key] = nowIso();
    planen(STATE, { typ: 'akte_antwort', doc: doc.id, r: r.r, faelligAm: new Date(Date.now() + (50 + (r.t.length * 7) % 40) * 1000).toISOString() });
    return { modul: 'Akten', aktion: 'Freigabe beantragt', detail: doc.id + ' ' + doc.titel + ', Schwärzung ' + r.r + ' (Mindeststufe ' + r.stufe + ', Zugang ' + doc.zugang + ')' };
  },
  MISSION_ABGELEHNT: function (a) {
    const def = missionDef(a.id), text = String(a.begruendung || '').trim();
    if (!def || MS(def.id).status !== 'zugewiesen' || !text) return null;
    const ms = MS(def.id), iso = nowIso(), out = [];
    ms.ablehnungen.push({ t: iso, text: text });
    STATE.agent.ablehnungen += 1;
    const n = ms.ablehnungen.length;
    out.push({ modul: 'Mission', aktion: 'Auftrag abgelehnt', krit: true, detail: opText(def) + ', ' + n + '. Ablehnung; Begründung: ' + kuerzen(text, 140) });
    if (n === 1) {
      const m = handlernachricht(serienText('ablehnung1', def), 'Aktenvermerk');
      out.push({ modul: 'Mission', aktion: 'Aktenvermerk angelegt', krit: true, detail: def.aktenvermerk + ' zu ' + opText(def) + '; Nachricht ' + m.id + ' (Kanal Handler); Auftrag bleibt zugewiesen' });
      if (STATE.agent.status !== 'Extraktion ausstehend') setStatus('Standby', 'Ablehnung ' + opText(def), out);
    } else {
      ms.status = 'abgelehnt'; ms.beendetAm = iso;
      const m = handlernachricht(serienText('ablehnung2', def), 'Abberufung');
      out.push({ modul: 'Mission', aktion: 'Abberufung eingeleitet', krit: true, detail: 'Zweite Ablehnung ' + opText(def) + '; ' + def.aktenvermerk + ' ergänzt; Nachricht ' + m.id + ' (Kanal Handler)' });
      if (STATE.extraktion.anforderung.status === 'keine') {
        STATE.extraktion.anforderung = Object.assign(leereAnforderung(), { status: 'bestätigt', option: 'A', durch: 'Gegenstelle', t: iso,
          statusZuvor: 'Standby', freigabe: 'erteilt', freigabeT: iso, begruendung: 'Durch Handler eingeleitet: Abberufung nach zweiter Ablehnung von ' + opText(def) + ' (' + def.aktenvermerk + ').' });
        out.push({ modul: 'Extraktion', aktion: 'Option A durch Handler eingeleitet', krit: true, detail: optionText('A') + ', Stand bestätigt; Anlass: Abberufung' });
        planeGegenstelle('durchfuehrung');
      }
      setStatus('Extraktion ausstehend', 'Abberufung nach zweiter Ablehnung', out);
      serieBeenden('Abberufung', def.id, out);
    }
    return out;
  },
  MISSION_ABGESCHLOSSEN: function (a) {
    const def = LM(), text = String(a.bericht || '').trim();
    if (!def || offeneZiele() > 0 || text.length < 20) return null;
    const ms = MS(def.id), iso = nowIso(), out = [];
    ms.status = 'abgeschlossen'; ms.beendetAm = iso; ms.abschlussbericht = text;
    STATE.seq.bericht += 1;
    const id = 'LB-' + p3(STATE.seq.bericht);
    STATE.berichte.push({ id: id, t: iso, text: 'Abschlussbericht ' + opText(def) + ': ' + text, mission: def.id, art: 'Abschlussbericht' });
    const m = handlernachricht(serienText('abschluss', def), 'Abschluss');
    out.push({ modul: 'Mission', aktion: 'Mission abgeschlossen', krit: true,
      detail: opText(def) + ': ' + def.ziele.length + ' von ' + def.ziele.length + ' Zielen abgehakt; Abschlussbericht ' + id + ' im Archiv; Bestätigung ' + m.id + ' (Kanal Handler)' });
    if (STATE.funkstille.aktiv) funkstilleBeenden('Abschluss ' + opText(def), out);
    if (STATE.agent.status !== 'Extraktion ausstehend') setStatus('Standby', 'Abschluss ' + opText(def), out);
    STATE.nachbereitung = { mission: def.id, seit: iso, erledigt: {} };
    planen(STATE, { typ: 'verlauf', kanal: 'handler', auto: false, text: SCENARIO.serie.texte.nachbereitungHinweis, faelligAm: new Date(Date.now() + 25000).toISOString() });
    out.push({ modul: 'Mission', aktion: 'Nachbereitung eröffnet', krit: true, detail: opText(def) + ': ' + SCENARIO.serie.nachbereitung.length + ' Schritte; der nächste Auftrag folgt erst nach Abschluss der Nachbereitung' });
    return out;
  },
  NACHBEREITUNG_SCHRITT: function (a) {
    const nb = STATE.nachbereitung, T = SCENARIO.serie.nachbereitung;
    if (!nb) return null;
    const st = T.find(function (x) { return x.id === a.id; });
    if (!st || nb.erledigt[st.id]) return null;
    if (st.id === 'nachbesprechung' && T.some(function (x) { return x.id !== st.id && !nb.erledigt[x.id]; })) return null;
    const def = missionDef(nb.mission), out = [];
    nb.erledigt[st.id] = nowIso();
    out.push({ modul: 'Mission', aktion: 'Nachbereitung: ' + st.titel, krit: true, detail: opText(def) + ': ' + st.vermerk });
    if (T.every(function (x) { return !!nb.erledigt[x.id]; })) nachbereitungAbschliessen(def, out);
    return out;
  },
  MISSION_ABGEBROCHEN: function (a) {
    const def = LM(), text = String(a.begruendung || '').trim();
    if (!def || !def.abbruch || !text) return null;
    const ms = MS(def.id), iso = nowIso(), out = [];
    ms.status = 'abgebrochen'; ms.beendetAm = iso; ms.abbruchgrund = text;
    const m = handlernachricht(serienText('abbruch', def), 'Aktenvermerk');
    out.push({ modul: 'Mission', aktion: 'Auftrag abgebrochen', krit: true,
      detail: opText(def) + '; Begründung: ' + kuerzen(text, 140) + '; ' + def.aktenvermerk + '; Nachricht ' + m.id + ' (Kanal Handler)' });
    if (STATE.funkstille.aktiv) funkstilleBeenden('Abbruch ' + opText(def), out);
    if (STATE.agent.status !== 'Extraktion ausstehend') setStatus('Standby', 'Abbruch ' + opText(def), out);
    serieBeenden('Abbruch', def.id, out);
    return out;
  },

  /* --- Modul 3: Dossier-Datenbank --- */
  DOSSIER_GEOEFFNET: function (a) {
    const e = entitaet(a.id);
    if (!e) return null;
    const wechsel = a.navigieren && STATE.ui.modul !== 'dossier';
    if (!wechsel && STATE.dossiers.auswahl === e.id) return null;
    STATE.dossiers.auswahl = e.id;
    if (wechsel) STATE.ui.modul = 'dossier';
    return { modul: 'Dossier', aktion: 'Dossier geöffnet', detail: e.id + ' ' + e.name + ' (' + e.reg + ')' + (a.ueber ? ', über ' + a.ueber : '') };
  },
  DOSSIER_STATUS: function (a) {
    const e = entitaet(a.id);
    if (!e || !freigeschaltet(e.mission) || (a.status && !statusDef(a.status))) return null;
    const out = [];
    dossierStatusSetzen(e, a.status || null, '', out);
    return out.length ? out : null;
  },
  /* Eigene Dossiers und Verbindungen im Standard-Dossier */
  DOSSIER_ANGELEGT: function (a) {
    const name = String(a.name || '').trim();
    if (!name) return null;
    const typ = ['Person', 'Organisation', 'Ort'].indexOf(a.typ) >= 0 ? a.typ : 'Person';
    const stufe = Math.min(5, Math.max(1, Number(a.stufe) || 2)), t = nowIso(), bildbereit = bildGueltig(a.bild);
    const zeilen = function (txt, trenner) { return String(txt || '').split(trenner).map(function (x) { return x.trim(); }).filter(Boolean); };
    STATE.seq.eigen = (STATE.seq.eigen || 0) + 1;
    const id = (typ === 'Person' ? 'P' : typ === 'Organisation' ? 'O' : 'L') + '-' + (9100 + STATE.seq.eigen);
    const land = SCENARIO.laender[a.land] ? a.land : 'DE';
    STATE.dossiers.eigene.push({ id: id, typ: typ, land: land, mission: 'STD', name: name, bild: null, aliase: zeilen(a.aliase, ','), reg: 'ohne',
      verteiler: 'Eigener Eintrag', rolle: String(a.rolle || '').trim() || 'Keine Beschreibung.', eckdaten: zeilen(a.eckdaten, '\n'),
      bedrohung: { stufe: stufe, begruendung: 'Eigene Einschätzung.' }, nachtraege: [], eigen: true });
    STATE.dossiers.entitaeten[id] = { status: null, statusAm: null, notizen: [], aktualisiert: t };
    if (bildbereit) PROFIL.bilder[id] = a.bild;
    const ll = parseKoord(a.koord); if (ll) PROFIL.koord[id] = ll;
    STATE.dossiers.auswahl = id;
    return { modul: 'Dossier', aktion: 'Eigenes Dossier angelegt', detail: id + ' ' + name + ' (' + typ + ', ' + land + ', Stufe ' + stufe + (bildbereit ? ', mit Lichtbild' : '') + (ll ? ', mit Kartenposition' : '') + ')' };
  },
  DOSSIER_GELOESCHT: function (a) {
    const e = eigeneDossiers().find(function (x) { return x.id === a.id; });
    if (!e) return null;
    STATE.dossiers.eigene = STATE.dossiers.eigene.filter(function (x) { return x.id !== e.id; });
    STATE.dossiers.eigeneKanten = STATE.dossiers.eigeneKanten.filter(function (v) { return v.von !== e.id && v.nach !== e.id; });
    delete STATE.dossiers.entitaeten[e.id];
    delete PROFIL.bilder[e.id]; delete PROFIL.galerie[e.id]; delete PROFIL.koord[e.id];
    if (STATE.dossiers.auswahl === e.id) STATE.dossiers.auswahl = SCENARIO.standard.dossiers[0].id;
    return { modul: 'Dossier', aktion: 'Eigenes Dossier gelöscht', krit: true, detail: e.id + ' ' + e.name + ' mit allen Verbindungen entfernt' };
  },
  DOSSIER_BILD: function (a) {
    const e = entitaet(a.id);
    if (!e || !freigeschaltet(e.mission)) return null;
    if (a.bild === null) {
      if (!PROFIL.bilder[e.id]) return null;
      delete PROFIL.bilder[e.id];
      return { modul: 'Dossier', aktion: 'Lichtbild entfernt', detail: e.id + ' ' + e.name };
    }
    if (!bildGueltig(a.bild)) return null;
    PROFIL.bilder[e.id] = a.bild;
    return { modul: 'Dossier', aktion: 'Lichtbild gesetzt', detail: e.id + ' ' + e.name + ' (' + Math.round(a.bild.length / 1024) + ' kB)' };
  },
  DOSSIER_FOTO_HINZU: function (a) {
    const e = entitaet(a.id);
    if (!e || !freigeschaltet(e.mission) || !bildGueltig(a.bild)) return null;
    const l = PROFIL.galerie[e.id] = PROFIL.galerie[e.id] || [];
    if (l.length >= 60) { meldung('Höchstens 60 Aufnahmen je Dossier.'); return null; }
    PROFIL.seq.galerie = (PROFIL.seq.galerie || 0) + 1;
    const f = { id: 'G-' + p3(PROFIL.seq.galerie), t: nowIso(), bild: a.bild, text: String(a.text || '').trim().slice(0, 200) };
    l.push(f);
    if (!profilSpeichern()) {
      l.pop(); PROFIL.seq.galerie -= 1;
      meldung('Speicher voll: Aufnahme nicht übernommen. Profil exportieren und ältere Aufnahmen entfernen.');
      return null;
    }
    return { modul: 'Dossier', aktion: 'Aufnahme hinzugefügt', detail: e.id + ' ' + e.name + ': ' + f.id + (f.text ? ' (' + kuerzen(f.text, 80) + ')' : '') + ', ' + Math.round(a.bild.length / 1024) + ' kB' };
  },
  DOSSIER_FOTO_ENTFERNT: function (a) {
    const e = entitaet(a.id), l = e && PROFIL.galerie[e.id];
    if (!l) return null;
    const n = l.length;
    PROFIL.galerie[e.id] = l.filter(function (f) { return f.id !== a.foto; });
    if (PROFIL.galerie[e.id].length === n) return null;
    if (!PROFIL.galerie[e.id].length) delete PROFIL.galerie[e.id];
    return { modul: 'Dossier', aktion: 'Aufnahme entfernt', detail: e.id + ' ' + e.name + ': ' + a.foto };
  },
  DOSSIER_ORT: function (a) {
    const e = entitaet(a.id);
    if (!e || !freigeschaltet(e.mission)) return null;
    const leer = a.ll === null || (a.ll === undefined && !String(a.text || '').trim());
    if (leer) {
      if (!PROFIL.koord[e.id]) return null;
      delete PROFIL.koord[e.id];
      return { modul: 'Dossier', aktion: 'Kartenposition entfernt', detail: e.id + ' ' + e.name };
    }
    const ll = Array.isArray(a.ll) && a.ll.length === 2 && isFinite(a.ll[0]) && isFinite(a.ll[1]) && Math.abs(a.ll[0]) <= 85 && Math.abs(a.ll[1]) <= 180 ? [Math.round(a.ll[0] * 1e5) / 1e5, Math.round(a.ll[1] * 1e5) / 1e5] : parseKoord(a.text);
    if (!ll) { meldung('Koordinaten nicht lesbar. Format: Breite, Länge (z. B. 52.5200, 13.4050).'); return null; }
    PROFIL.koord[e.id] = ll;
    return { modul: 'Dossier', aktion: 'Kartenposition gesetzt', detail: e.id + ' ' + e.name + ': ' + ll[0] + ', ' + ll[1] };
  },
  AUSGANG_ANGELEGT: function (a) {
    const name = String(a.name || '').trim().slice(0, 80);
    if (!name) return null;
    const art = ART_AUSGANG.indexOf(a.art) >= 0 ? a.art : ART_AUSGANG[0];
    const ll = Array.isArray(a.ll) ? a.ll : parseKoord(a.text);
    if (String(a.text || '').trim() && !ll) { meldung('Koordinaten nicht lesbar. Format: Breite, Länge (z. B. 52.5200, 13.4050).'); return null; }
    PROFIL.seq.ausgang = (PROFIL.seq.ausgang || 0) + 1;
    const x = { id: 'AO-' + String(PROFIL.seq.ausgang).padStart(2, '0'), name: name, art: art, adresse: String(a.adresse || '').trim().slice(0, 200), ll: ll || null };
    PROFIL.ausgang.push(x);
    return { modul: 'Profil', aktion: 'Ausgangsort angelegt', detail: x.id + ' ' + x.name + ' (' + x.art + ')' };
  },
  AUSGANG_GELOESCHT: function (a) {
    const i = PROFIL.ausgang.findIndex(function (x) { return x.id === a.id; });
    if (i < 0) return null;
    const x = PROFIL.ausgang.splice(i, 1)[0];
    return { modul: 'Profil', aktion: 'Ausgangsort gelöscht', detail: x.id + ' ' + x.name };
  },
  AUSGANG_ORT: function (a) {
    const x = PROFIL.ausgang.find(function (y) { return y.id === a.id; });
    if (!x) return null;
    const ll = Array.isArray(a.ll) && a.ll.length === 2 && isFinite(a.ll[0]) && isFinite(a.ll[1]) && Math.abs(a.ll[0]) <= 85 && Math.abs(a.ll[1]) <= 180 ? [Math.round(a.ll[0] * 1e5) / 1e5, Math.round(a.ll[1] * 1e5) / 1e5] : parseKoord(a.text);
    if (!ll) { meldung('Koordinaten nicht lesbar. Format: Breite, Länge (z. B. 52.5200, 13.4050).'); return null; }
    x.ll = ll;
    return { modul: 'Profil', aktion: 'Position eines Ausgangsorts gesetzt', detail: x.id + ' ' + x.name };
  },
  PROFIL_IMPORT: function (a) {
    const q = a.profil;
    if (!q || q.v !== 1 || !Array.isArray(q.eigene) || !Array.isArray(q.eigeneKanten)) return null;
    let neu = 0;
    q.eigene.forEach(function (e) { if (!PROFIL.eigene.some(function (x) { return x.id === e.id; })) { PROFIL.eigene.push(e); if (q.daten && q.daten[e.id]) PROFIL.daten[e.id] = q.daten[e.id]; neu += 1; } });
    q.eigeneKanten.forEach(function (k) { if (!PROFIL.eigeneKanten.some(function (x) { return x.id === k.id; })) PROFIL.eigeneKanten.push(k); });
    Object.keys(q.bilder || {}).forEach(function (k) { if (!PROFIL.bilder[k] && bildGueltig(q.bilder[k])) PROFIL.bilder[k] = q.bilder[k]; });
    Object.keys(q.koord || {}).forEach(function (k) { if (!PROFIL.koord[k]) PROFIL.koord[k] = q.koord[k]; });
    Object.keys(q.galerie || {}).forEach(function (k) {
      const l = PROFIL.galerie[k] = PROFIL.galerie[k] || [];
      (q.galerie[k] || []).forEach(function (f) { if (f && bildGueltig(f.bild) && !l.some(function (x) { return x.id === f.id; })) l.push(f); });
    });
    (Array.isArray(q.ausgang) ? q.ausgang : []).forEach(function (x) { if (x && x.id && !PROFIL.ausgang.some(function (y) { return y.id === x.id; })) PROFIL.ausgang.push(x); });
    ['eigen', 'kante', 'galerie', 'ausgang'].forEach(function (k) { PROFIL.seq[k] = Math.max(PROFIL.seq[k] || 0, (q.seq && q.seq[k]) || 0); });
    profilEinspielen(STATE);
    return { modul: 'Dossier', aktion: 'Profil geladen', detail: a.datei + ': ' + neu + ' neue eigene Dossiers, Bilder und Aufnahmen zusammengeführt' };
  },
  PROFIL_LEEREN: function () {
    const ids = STATE.dossiers.eigene.map(function (e) { return e.id; });
    ids.forEach(function (id) { delete STATE.dossiers.entitaeten[id]; });
    STATE.dossiers.eigene = []; STATE.dossiers.eigeneKanten = [];
    const alt = PROFIL.leer();
    ['eigene', 'eigeneKanten', 'daten', 'seq', 'bilder', 'galerie', 'koord', 'ausgang'].forEach(function (k) { PROFIL[k] = alt[k]; });
    STATE.seq.eigen = 0; STATE.seq.kante = 0;
    if (ids.indexOf(STATE.dossiers.auswahl) >= 0) STATE.dossiers.auswahl = SCENARIO.standard.dossiers[0].id;
    return { modul: 'Dossier', aktion: 'Profil geleert', krit: true, detail: ids.length + ' eigene Dossiers sowie alle Bilder, Aufnahmen und Kartenpositionen entfernt' };
  },
  VERBINDUNG_ANGELEGT: function (a) {
    const von = entitaet(a.von), nach = entitaet(a.nach);
    if (!von || !nach || von.id === nach.id || !freigeschaltet(von.mission) || !freigeschaltet(nach.mission)) return null;
    if (SCENARIO.verbindungstypen.indexOf(a.typ) < 0 || !/^[A-F][1-6]$/.test(a.bewertung)) return null;
    STATE.seq.kante = (STATE.seq.kante || 0) + 1;
    const id = 'V-E' + STATE.seq.kante;
    STATE.dossiers.eigeneKanten.push({ id: id, mission: 'STD', von: von.id, nach: nach.id, typ: a.typ, richtung: a.beidseitig ? 'beidseitig' : 'gerichtet', bewertung: a.bewertung, quelle: 'Eigene Angabe' });
    return { modul: 'Dossier', aktion: 'Verbindung angelegt', detail: id + ': ' + von.id + (a.beidseitig ? ' ↔ ' : ' → ') + nach.id + ', ' + a.typ + ', Bewertung ' + a.bewertung };
  },
  VERBINDUNG_GELOESCHT: function (a) {
    const v = STATE.dossiers.eigeneKanten.find(function (x) { return x.id === a.id; });
    if (!v) return null;
    STATE.dossiers.eigeneKanten = STATE.dossiers.eigeneKanten.filter(function (x) { return x.id !== v.id; });
    return { modul: 'Dossier', aktion: 'Verbindung entfernt', detail: v.id + ': ' + v.von + ' – ' + v.nach + ', ' + v.typ };
  },
  DOSSIER_NOTIZ: function (a) {
    const e = entitaet(a.id), text = String(a.text || '').trim();
    if (!e || !text) return null;
    const d = STATE.dossiers.entitaeten[e.id];
    STATE.seq.notiz += 1;
    const id = 'DN-' + p3(STATE.seq.notiz), t = nowIso();
    d.notizen.push({ id: id, t: t, text: text });
    d.aktualisiert = t;
    delete VIEW.draft['dn-' + e.id];
    return { modul: 'Dossier', aktion: 'Dossiernotiz hinzugefügt', detail: e.id + ' ' + e.name + ', ' + id + ': ' + kuerzen(text, 120) };
  }
};

function dispatch(action) {
  const handler = ACTIONS[action.type];
  if (!handler) return;
  const ergebnis = handler(action);                      /* (1) */
  if (!ergebnis) return;
  const t = nowIso(), liste = Array.isArray(ergebnis) ? ergebnis : [ergebnis];
  liste.forEach(function (e) {                           /* (2) */
    STATE.seq.log += 1;
    const eintrag = { id: STATE.seq.log, t: e.t || t, modul: e.modul, aktion: e.aktion, detail: e.detail || '' };
    if (e.krit) eintrag.krit = true;
    STATE.log.push(eintrag);
  });
  if (STATE.log.length > LOG_LIMIT) STATE.log.splice(0, STATE.log.length - LOG_LIMIT);
  Store.save(STATE);                                     /* (3) */
  if (PROFIL_AKTIONEN[action.type] && !profilSpeichern()) meldung('Profil konnte nicht gespeichert werden (Speicher voll?).');
  render(liste.every(function (e) { return e.leicht; })); /* (4) */
}

/* =====================================================================
   RENDERING: GERÜST
   Statische Gerüstelemente (Header, Navigation) werden in place aktualisiert.
   Der Modulbereich wird neu aufgebaut; Fokus, Textauswahl und Scrollpositionen
   werden dabei über Element-IDs wiederhergestellt.
   ===================================================================== */
function renderBanner() {
  const txt = 'SEKTION 9 · ' + (STATE.vorlauf ? 'NUR FÜR AUTORISIERTE EMPFÄNGER' : KM().einstufung + ' · NUR FÜR AUTORISIERTE EMPFÄNGER');
  $('banner-top').textContent = txt;
  $('banner-bottom').textContent = txt;
}

function renderHeader() {
  $('h-agent').textContent = SCENARIO.agent.codename + ' / ' + SCENARIO.agent.id;
  $('h-op').textContent = STATE.vorlauf ? 'kein Auftrag' : KM().nummer + ' ' + KM().name + ' · ' + MS(KM().id).status;
  $('h-status').replaceChildren(statusLabel(STATE.agent.status));
  $('h-kanal').textContent = SCENARIO.verbindung;
  $('h-standort').textContent = 'Standortfreigabe: ' + (STATE.extraktion.standortfreigabe ? 'ein' : 'aus');
  $('h-checkin').textContent = STATE.agent.checkin.standortId ? dtg(STATE.agent.checkin.t) + ' · ' + standortName(STATE.agent.checkin.standortId) : '–';
  $('h-melde').textContent = meldeText(Date.now());
  const n = STATE.melde.versaeumt, marken = [];
  if (STATE.funkstille.aktiv) marken.push(h('span', { class: 'label s-warn' }, 'Funkstille'));
  if (n > 0) marken.push(h('span', { class: 'label ' + (n >= 2 ? 's-crit' : 's-warn') }, 'Versäumt in Folge: ' + n));
  $('h-melde-l').replaceChildren.apply($('h-melde-l'), marken);
  const p = $('h-persist');
  if (Store.isPersistent()) p.replaceChildren();
  else p.replaceChildren(h('span', { class: 'label s-warn' }, 'Sitzung nicht persistent'));
  $('btn-log').setAttribute('aria-expanded', VIEW.logOpen ? 'true' : 'false');
  Leiste.sync();
}

/* Zeitfenster-Zelle (Missionsbriefing): Zustand und Restzeit */
function fensterZelle(zelle, now) {
  const w = MS(STATE.kontext).zeitfenster[zelle.getAttribute('data-fenster')];
  if (!w) return;
  const von = Date.parse(w.von), bis = Date.parse(w.bis);
  if (now < von) zelle.replaceChildren(h('span', { class: 'label s-dim' }, 'bevorstehend'), ' Beginn in ' + fmtRest(von - now));
  else if (now < bis) zelle.replaceChildren(h('span', { class: 'label s-accent' }, 'läuft'), ' Rest ' + fmtRest(bis - now));
  else zelle.replaceChildren(h('span', { class: 'label s-dim' }, 'abgelaufen'), ' seit ' + fmtRest(now - bis));
}
/* Sekündlich aktualisierte Anzeigen innerhalb des Modulbereichs */
function tickModule(now) {
  const txt = meldeText(now);
  document.querySelectorAll('[data-melde]').forEach(function (e) { if (e.textContent !== txt) e.textContent = txt; });
  document.querySelectorAll('[data-fenster]').forEach(function (z) {
    const key = Math.floor(now / 60000);
    if (z.getAttribute('data-min') === String(key)) return;      /* Anzeige in Minutenauflösung */
    z.setAttribute('data-min', String(key));
    fensterZelle(z, now);
  });
}
function renderClock() {
  const d = new Date(), now = d.getTime();
  $('h-dtg').textContent = dtg(d);
  $('h-long').textContent = TAGE[d.getUTCDay()] + '., ' + fmtZ(d);
  $('h-orts').textContent = ortszeit(d);
  $('h-session').textContent = fmtDauer(now - SESSION_START);
  $('h-melde').textContent = meldeText(now);
  tickModule(now);
}
/* Sekundentakt: Uhr, Countdown, fällige Zuweisung des Folgeauftrags und Prüfung abgelaufener Meldefristen */
function tick() {
  if (Zugang.beendet()) return;
  Zugang.leerlauf();
  const jetzt = Date.now(), fo = STATE.serie.folge;
  const ruhend = STATE.agent.status === 'Ruhend';                  /* Ruhend: Handler und Gegenstellen schweigen, nur Antworten laufen */
  if (fo && !ruhend && !STATE.serie.ende && Date.parse(fo.faelligAm) <= jetzt) dispatch({ type: 'MISSION_ZUGEWIESEN', id: fo.mission });
  /* Fällige Planeinträge; Antworten laufen auch bei ausgeschalteter Automatik */
  STATE.plan.filter(function (p) { return Date.parse(p.faelligAm) <= jetzt && (p.typ === 'antwort' || (STATE.automatik && !ruhend)); })
    .forEach(function (p) { dispatch({ type: 'FAELLIG', id: p.id }); });
  if (meldeAktiv()) {
    const f = fensterNach(Date.parse(STATE.melde.geprueftBis));
    if (f && f.D <= jetzt) dispatch({ type: 'MELDEFENSTER_PRUEFUNG' });
  }
  renderClock();
}

const NAV_BADGES = {
  mission: function () {
    const z = zugewiesene(), n = offeneZiele();
    if (STATE.nachbereitung) return { txt: '!', an: true, titel: 'Nachbereitung offen' };
    if (STATE.vorlauf && !z) return { txt: '0', an: false, titel: 'kein Auftrag' };
    return z ? { txt: 'Auftrag', an: true, titel: 'Neuer Auftrag zugewiesen: ' + z.name } : { txt: String(n), an: n > 0, titel: n + ' offene Ziele' };
  },
  komm: function () { const n = ungelesenGesamt(); return { txt: String(n), an: n > 0, titel: n + ' ungelesene Nachrichten' }; }
};
function buildNav() {
  const list = $('nav-list');
  MODULES.forEach(function (m) {
    const b = NAV_BADGES[m.id];
    list.appendChild(h('li', null,
      h('button', { type: 'button', id: 'nav-' + m.id, 'aria-keyshortcuts': m.key,
                    onclick: function () { dispatch({ type: 'NAVIGATION', modul: m.id }); } },
        h('span', { class: 'key', 'aria-hidden': 'true' }, m.key),
        h('span', { class: 'ttl' }, m.titel),
        b ? h('span', { class: 'badge', id: 'badge-' + m.id }) : null)));
  });
}
function renderNav() {
  MODULES.forEach(function (m) {
    const btn = $('nav-' + m.id);
    if (STATE.ui.modul === m.id) btn.setAttribute('aria-current', 'page'); else btn.removeAttribute('aria-current');
    if (NAV_BADGES[m.id]) {
      const b = NAV_BADGES[m.id](), el = $('badge-' + m.id);
      el.className = 'badge' + (b.an ? ' on' : '');
      el.replaceChildren(b.txt, h('span', { class: 'vh' }, ' (' + b.titel + ')'));
      el.title = b.titel;
    }
  });
}

function modKopf(m, zusatz) {
  return h('div', { class: 'mod-head' },
    h('h1', { id: 'mod-title', tabindex: '-1' }, m.titel),
    h('span', { class: 'mono dim' }, 'Modul ' + m.key + (STATE.vorlauf ? '' : ' · Vorgang ' + KM().nummer)), zusatz);
}
/* Freitextfeld mit Entwurfspuffer (übersteht Neuaufbau der Ansicht) */
function entwurf(tag, id, key, attrs) {
  const a = Object.assign({ id: id, value: VIEW.draft[key] || '', oninput: function (ev) { VIEW.draft[key] = ev.target.value; } }, attrs);
  return h(tag, a);
}
/* Freitextfeld mit automatischem Speichern (Notizen, Einschränkungen) */
const saveTimer = {};
function autosaveFlush(id, feld) {
  if (RENDERING) return;
  clearTimeout(saveTimer[id]);
  const d = VIEW.draft[id];
  if (d === undefined) return;
  delete VIEW.draft[id];
  dispatch({ type: 'TEXT_GEAENDERT', feld: feld, wert: d });
}
function autosaveFeld(id, feld, label) {
  return h('textarea', { id: id, rows: '5', 'aria-label': label, spellcheck: 'false',
    value: VIEW.draft[id] !== undefined ? VIEW.draft[id] : STATE.agent[feld],
    oninput: function (ev) {
      VIEW.draft[id] = ev.target.value;
      clearTimeout(saveTimer[id]);
      saveTimer[id] = setTimeout(function () { autosaveFlush(id, feld); }, SAVE_DELAY);
    },
    onblur: function () { autosaveFlush(id, feld); } });
}
function autosaveAlle() { autosaveFlush('ta-notizen', 'notizen'); autosaveFlush('ta-einschr', 'einschraenkungen'); }

/* =====================================================================
   MODUL 1: AGENTENPROFIL
   ===================================================================== */
function dokZeile(d, now) {
  const g = STATE.agent.dokumente[d.id].gueltigBis;
  let frist = 'unbefristet', cls = '';
  if (g) {
    const rest = Date.parse(g) - now, tage = Math.ceil(rest / 86400000);
    frist = fmtDatum(g) + ' (' + (rest < 0 ? 'abgelaufen' : tage + (tage === 1 ? ' Tag' : ' Tage')) + ')';
    cls = rest < 0 ? 's-crit' : tage < 30 ? 's-warn' : '';
  }
  return [td('nw', d.id), d.dokument, land(d.land), td('nw', d.nummer), td('nw', frist), h('span', { class: 'label ' + cls, style: 'white-space:normal' }, d.zustand)];
}
function legendePanel(L, now) {
  const aktiv = STATE.agent.legende === L.id;
  return panel(L.bezeichnung + ' (' + L.land + ')',
    h('span', { class: 'label ' + (aktiv ? 's-accent' : 's-dim') }, aktiv ? 'aktive Legende' : 'Reserve'),
    h('div', { class: 'mitfoto' }, bildFeld(bildPfad(L, 'legende-' + L.id), 'Lichtbild ' + L.bezeichnung, 'Kein Lichtbild'), h('dl', { class: 'fields' },
      feld('Name', L.name), feld('Nationalität', [L.nationalitaet + ' (', land(L.land), ')']),
      feld('Wohnsitz laut Legende', L.wohnsitz), feld('Beruf', L.beruf),
      feld('Legende', L.legende, 'full'), feld('Legendentiefe', L.tiefe, 'full'))),
    h('h3', null, 'Supporting Documents'),
    tabelle(['ID', 'Dokument', 'Staat', 'Nummer', 'Gültig bis', 'Zustand'], L.dokumente.map(function (d) { return dokZeile(d, now); })),
    h('div', { class: 'row top' },
      aktiv ? h('span', { class: 'dim' }, 'In Verwendung.')
            : h('button', { type: 'button', id: 'btn-leg-' + L.id, onclick: function () {
                bestaetigen('Aktive Legende wechseln',
                  'Die aktive Legende wird auf "' + L.bezeichnung + '" (' + L.name + ', ' + L.land + ') gesetzt. Der Wechsel wird protokolliert und dem Handler als Systemnachricht gemeldet (ROE 7).',
                  'Legende wechseln', function () {
                    dispatch({ type: 'LEGENDE_GEWECHSELT', legende: L.id });
                    const b = document.querySelector('[id^="btn-leg-"]'); if (b) b.focus();
                  });
              } }, 'Als aktive Legende setzen')));
}

/* Ausgangsorte (privat, nur im Profil): Safehouses, Wohnungen und andere Orte, von denen aus der Agent anreist */
function neuerAusgang() {
  const form = h('div', null,
    feldZeile('Bezeichnung', 'ag-name', h('input', { type: 'text', id: 'ag-name', autocomplete: 'off', spellcheck: 'false', style: 'flex:1 1 220px;min-width:0' })),
    feldZeile('Art', 'ag-art', h('select', { id: 'ag-art' }, ART_AUSGANG.map(function (x) { return h('option', { value: x }, x); }))),
    feldZeile('Adresse', 'ag-adr', h('input', { type: 'text', id: 'ag-adr', autocomplete: 'off', spellcheck: 'false', placeholder: 'optional, nur zur eigenen Erinnerung; wird nirgends sonst angezeigt', style: 'flex:1 1 220px;min-width:0' })),
    feldZeile('Position', 'ag-koord', h('input', { type: 'text', id: 'ag-koord', autocomplete: 'off', spellcheck: 'false', placeholder: 'Breite, Länge (z. B. 52.5200, 13.4050); alternativ später per Karte', style: 'flex:1 1 220px;min-width:0' })));
  bestaetigen('Neuer Ausgangsort', form, 'Ausgangsort anlegen', function () {
    dispatch({ type: 'AUSGANG_ANGELEGT', name: $('ag-name').value, art: $('ag-art').value, adresse: $('ag-adr').value, text: $('ag-koord').value });
  }, { pruefer: function () { return $('ag-name').value.trim().length > 0; }, klartext: 'Neuen Ausgangsort anlegen?' });
}
function ausgangPanel() {
  const liste = PROFIL.ausgang;
  return panel('Ausgangsorte', [h('span', { class: 'badge' }, String(liste.length))],
    h('p', { class: 'note pad' }, 'Orte, von denen aus du zu einem Auftrag anreist. Die Auswahl erfolgt in der Anreiseplanung; die App rechnet die Luftlinie zur Unterkunft und leitet Reisedauer je Verkehrsmittel ab. Bezeichnung und Position erscheinen im Protokoll und auf der Lagekarte, die Adresse nur hier. Alles liegt nur im Profil dieses Browsers.'),
    liste.length ? tabelle(['Kennung', 'Bezeichnung', 'Art', 'Adresse', 'Position', ''], liste.map(function (x) {
      return [td('nw', x.id), td('txt', x.name), td('nw', x.art), td('txt', x.adresse || h('span', { class: 'dim' }, '–')),
        td('nw', x.ll ? x.ll[0].toFixed(4) + ', ' + x.ll[1].toFixed(4) : h('span', { class: 'label s-warn' }, 'fehlt')),
        td('nw', [
          h('button', { type: 'button', class: 'link', 'data-ag': x.id, onclick: function () {
            VIEW.karte.pick = x.id; VIEW.karte.auswahl = null;
            if (x.ll) { VIEW.karte.lat = x.ll[0]; VIEW.karte.lon = x.ll[1]; VIEW.karte.zoom = Math.max(VIEW.karte.zoom, 12); }
            dispatch({ type: 'NAVIGATION', modul: 'karte' }); renderModule(); } }, 'Auf Karte setzen'),
          ' ',
          h('button', { type: 'button', class: 'link', onclick: function () {
            bestaetigen('Ausgangsort löschen', 'Ausgangsort ' + x.id + ' ' + x.name + ' wird aus dem Profil entfernt.', 'Löschen', function () { dispatch({ type: 'AUSGANG_GELOESCHT', id: x.id }); }, { klartext: 'Ausgangsort löschen?' });
          } }, 'Löschen')])];
    }), '') : h('p', { class: 'note pad' }, 'Noch keine Ausgangsorte angelegt.'),
    h('div', { class: 'row top' }, h('button', { type: 'button', id: 'btn-ausgang-neu', onclick: neuerAusgang }, 'Ausgangsort anlegen')));
}
function renderProfil(m) {
  const A = SCENARIO.agent, now = Date.now(), akt = legende(STATE.agent.legende), M = KM().meldewesen, lauf = LM();
  const ortId = VIEW.draft['sel-ort'] || STATE.agent.checkin.standortId;
  return [
    modKopf(m),
    h('div', { class: 'cols' },
      panel('Agentenkennung', null,
        h('dl', { class: 'fields' },
          feld('Codename', A.codename), feld('Interne ID', A.id), feld('Freigabestufe', A.freigabe),
          feld('Einsatzraum', KM().schauplatz.einsatzraum),
          feld('Auftrag', lauf ? opText(lauf) + ', laufend' : 'kein laufender Auftrag'),
          feld('Abgelehnte Aufträge', String(STATE.agent.ablehnungen)),
          feld('Aktive Legende', akt.bezeichnung + ': ' + akt.name + ' (' + akt.land + ')'),
          feld('Operativer Status', statusLabel(STATE.agent.status))),
        h('div', { class: 'row top' },
          h('label', { for: 'sel-status' }, 'Status setzen'),
          h('select', { id: 'sel-status', onchange: function (ev) { dispatch({ type: 'STATUS_GESETZT', status: ev.target.value }); } },
            STATUS_LISTE.map(function (x) { return h('option', { value: x, selected: x === STATE.agent.status, disabled: x === 'Ruhend' && !!LM() }, x); })))),
      panel('Check-in und Meldewesen', null,
        h('dl', { class: 'fields' },
          feld('Letzter Check-in', fmtZ(STATE.agent.checkin.t)),
          feld('Letzter bekannter Standort', ortText(STATE.agent.checkin)),
          feld('Nächstes Meldefenster', h('span', { 'data-melde': '' }, meldeText(now))),
          feld('Versäumte Meldefenster in Folge', STATE.melde.versaeumt === 0 ? '0'
            : h('span', { class: 'label ' + (STATE.melde.versaeumt >= 2 ? 's-crit' : 's-warn') }, String(STATE.melde.versaeumt))),
          feld('Authentisierung', [h('span', { class: 'label s-accent' }, M.kennwortverfahren), ' ', M.kennwortHinweis], 'full'),
          feld('Eskalation gemäß ROE ' + M.roeNr, [M.eskalation[1], h('br'), M.eskalation[2]], 'full')),
        h('div', { class: 'row top' },
          h('label', { for: 'sel-ort' }, 'Standort'),
          h('select', { id: 'sel-ort', onchange: function (ev) { VIEW.draft['sel-ort'] = ev.target.value; } },
            KM().standorte.map(function (o) { return h('option', { value: o.id, selected: o.id === ortId }, o.id + ' ' + o.name + ' (' + o.land + ')'); })),
          h('button', { type: 'button', id: 'btn-checkin', onclick: function () { dispatch({ type: 'CHECKIN', standortId: $('sel-ort').value }); } }, 'Check-in melden')))),
    h('div', { class: 'cols breit' }, KM().legenden.map(function (L) { return legendePanel(L, now); })),
    ausgangPanel(),
    h('div', { class: 'cols' },
      panel('Notizen', null,
        h('div', { class: 'pad' }, autosaveFeld('ta-notizen', 'notizen', 'Notizen')),
        h('p', { class: 'note mono' }, 'Stand: ', h('span', { 'data-geaendert': 'notizen' }, fmtZ(STATE.agent.notizenGeaendert)))),
      panel('Operative Einschränkungen', null,
        h('div', { class: 'pad' }, autosaveFeld('ta-einschr', 'einschraenkungen', 'Operative Einschränkungen')),
        h('p', { class: 'note mono' }, 'Stand: ', h('span', { 'data-geaendert': 'einschraenkungen' }, fmtZ(STATE.agent.einschraenkungenGeaendert))))),
    panel('Ausrüstungsübersicht', null,
      tabelle(['Kategorie', 'Zustand', 'Hinweis'], A.ausruestung.map(function (x) {
        return [x.kategorie, td('nw', h('span', { class: 'label ' + (x.zustand === 'einsatzbereit' ? '' : 's-warn') }, x.zustand)), x.hinweis];
      })))
  ];
}

/* =====================================================================
   MODUL 2: MISSIONSBRIEFING
   ===================================================================== */
function zielListe(def, art) {
  const ms = MS(def.id), frei = ms.status === 'laufend' && einsatzLaeuft();
  return h('ul', { class: 'ziele' }, def.ziele.filter(function (z) { return z.art === art; }).map(function (z) {
    const st = ms.ziele[z.id];
    return h('li', { class: st.erledigt ? 'done' : '' },
      h('input', { type: 'checkbox', id: 'z-' + z.id, checked: st.erledigt, disabled: !frei,
                   onchange: function (ev) { dispatch({ type: 'ZIEL_GESETZT', id: z.id, erledigt: ev.target.checked }); } }),
      h('span', { class: 'mono' }, z.id),
      h('label', { for: 'z-' + z.id }, z.text),
      h('span', { class: 'zt' }, st.erledigt ? 'erledigt · abgehakt ' + fmtZ(st.t)
        : ['offen', frei ? [' · ', h('button', { type: 'button', class: 'link', id: 'zm-' + z.id, onclick: function () { zielMelden(def, z); } },
            z.meldung && z.meldung.status === 'eliminiert' ? 'Als eliminiert melden' : 'Als erledigt melden')] : null]));
  }));
}
function zielMelden(def, z) {
  const M = z.meldung || null, sd = M ? statusDef(M.status) : null, e = M ? entitaet(M.entitaet) : null;
  const los = function () { dispatch({ type: 'ZIEL_GEMELDET', id: z.id }); };
  if (!sd || !sd.kritisch) { los(); return; }
  bestaetigen('Meldung ' + z.id + ': ' + sd.label,
    [h('dl', { class: 'fields' }, feld('Ziel', z.id + ' ' + z.text, 'full'), feld('Bezug', e.id + ' ' + e.name), feld('Dossierstatus neu', sd.label)),
     h('p', { class: 'note' }, 'Die Meldung geht an den Handler und wird aktenkundig.')],
    'Melden', los, { pflicht: 'Ich melde ' + z.id + ' mit dem Status "' + sd.label + '" für ' + e.id + '.', klartext: z.id + ': ' + sd.label + ' melden?' });
}
function dossierLink(e, ueber, id) {
  return h('button', { type: 'button', class: 'link', id: id, onclick: function () {
    dispatch({ type: 'DOSSIER_GEOEFFNET', id: e.id, navigieren: true, ueber: ueber });
    const t = $('mod-title'); if (t) t.focus();
  } }, e.id + ' ' + e.name);
}
function freigabeTabelle(def) {
  return tabelle(['Stufe', 'Stelle', 'Referenz', 'Vermerk'], def.freigabekette.map(function (f) {
    return [td('nw', String(f.stufe)), f.stelle, td('nw', f.referenz), f.vermerk];
  }));
}
function zielTabelle(def) {
  const ms = MS(def.id);
  return tabelle(['ID', 'Art', 'Ziel', 'Abgehakt (UTC)'], def.ziele.map(function (z) {
    const st = ms.ziele[z.id];
    return [td('nw', z.id), z.art, td('txt', z.text), td('nw', st.erledigt ? fmtZ(st.t) : 'offen')];
  }));
}
function funkstilleFeld(def) {
  const an = STATE.funkstille.aktiv && STATE.funkstille.mission === def.id;
  if (!def.funkstille) return an ? [h('span', { class: 'label s-warn' }, 'aktiv'), ' Anordnung des Handlers'] : 'nicht vorgesehen';
  return [h('span', { class: 'label ' + (an ? 's-warn' : 's-dim') }, an ? 'aktiv' : 'nicht aktiv'), ' ' + def.funkstille.text];
}
function auftragFelder(def) {
  return [
    feld('Bezeichnung', def.name), feld('Vorgang', def.nummer),
    feld('Art', def.art), feld('Kurzbezeichnung', def.dienstbezeichnung),
    feld('Einstufung', def.einstufung), feld('Einsatzraum', def.schauplatz.einsatzraum),
    feld('Einsatzbeginn', MS(def.id).beginn ? fmtZ(MS(def.id).beginn) + ' (' + (Date.now() < Date.parse(MS(def.id).beginn) ? 'in ' + fmtRest(Date.parse(MS(def.id).beginn) - Date.now()) : 'begonnen') + ')'
                                            : (def.vorlaufMin ? def.vorlaufMin / 60 + ' Stunden nach Annahme' : 'mit Annahme')),
    feld('Schwerpunkt', def.schauplatz.schwerpunkt),
    feld('Abstreitbarkeit', def.abstreitbarkeit.text, 'full'),
    feld('Funkstille', funkstilleFeld(def), 'full'),
    feld('Ausgangslage', def.ausgangslage, 'full'),
    feld('Gegenstand', def.gegenstand, 'full')
  ];
}
function fokusTitel() { const t = $('mod-title'); if (t) t.focus(); }

/* Dialoge der Auftragsabfolge */
function auftragAnnehmen(def) {
  bestaetigen('Auftrag annehmen: ' + opText(def),
    [h('dl', { class: 'fields' },
       feld('Art', def.art), feld('Kurzbezeichnung', def.dienstbezeichnung), feld('Einstufung', def.einstufung), feld('Einsatzraum', def.schauplatz.einsatzraum),
       feld('Einsatzbeginn', def.vorlaufMin ? def.vorlaufMin / 60 + ' Stunden nach Annahme' : 'mit Annahme'),
       feld('Abstreitbarkeit', def.abstreitbarkeit.text, 'full'),
       def.funkstille ? feld('Funkstille', def.funkstille.text, 'full') : null),
     h('h3', null, 'Ziele'),
     tabelle(['ID', 'Art', 'Ziel'], def.ziele.map(function (z) { return [td('nw', z.id), z.art, td('txt', z.text)]; })),
     h('h3', null, 'Freigabekette'), freigabeTabelle(def),
     h('p', { class: 'note' }, 'Mit Annahme gelten Einstufung, Legende, Standorte, Extraktionsoptionen und Meldewesen dieses Auftrags.')],
    'Auftrag annehmen',
    function () { dispatch({ type: 'MISSION_ANGENOMMEN', id: def.id }); fokusTitel(); },
    { pflicht: 'Ich nehme den Auftrag ' + opText(def) + ' (' + def.dienstbezeichnung + ') ausdrücklich an.',
      klartext: opText(def) + ', ' + def.art + ' (' + def.dienstbezeichnung + '), ' + def.einstufung + '. Auftrag annehmen?' });
}
function auftragAblehnen(def) {
  const n = MS(def.id).ablehnungen.length;
  bestaetigen('Auftrag ablehnen: ' + opText(def),
    [h('p', null, n === 0
      ? 'Die Ablehnung wird als kritisches Ereignis protokolliert. Der Handler legt einen Aktenvermerk an, der Status wird "Standby", der Auftrag bleibt zugewiesen.'
      : 'Dies ist die zweite Ablehnung dieses Auftrags. Der Handler leitet die Abberufung gemäß Option A ein; es werden keine weiteren Aufträge zugewiesen.')],
    'Ablehnung absenden',
    function (text) { dispatch({ type: 'MISSION_ABGELEHNT', id: def.id, begruendung: text }); fokusTitel(); },
    { text: { label: 'Begründung der Ablehnung (Pflichtangabe)', min: 1 }, klartext: 'Ablehnung ' + opText(def) });
}
function missionAbschliessen(def) {
  bestaetigen('Mission abschließen: ' + opText(def),
    [h('h3', null, 'Ziele'), zielTabelle(def),
     h('p', { class: 'note' }, 'Der Bericht geht zu den Akten und an den Handler.')],
    'Mission abschließen',
    function (text) { dispatch({ type: 'MISSION_ABGESCHLOSSEN', bericht: text }); fokusTitel(); },
    { text: { label: 'Abschlussbericht (Pflichtangabe, mindestens 20 Zeichen)', min: 20 },
      pflicht: 'Ich bestätige den Abschluss von ' + opText(def) + ' und die Richtigkeit des Berichts.', klartext: 'Abschlussbericht ' + opText(def) });
}
function auftragAbbrechen(def) {
  bestaetigen('Auftrag abbrechen: ' + opText(def),
    [h('dl', { class: 'fields' }, feld('Abbruchkriterium', def.abbruchkriterium || 'gemäß ROE', 'full')),
     h('p', { class: 'note' }, 'Der Abbruch wird aktenkundig. Weitere Aufträge werden nicht zugewiesen.')],
    'Auftrag abbrechen',
    function (text) { dispatch({ type: 'MISSION_ABGEBROCHEN', begruendung: text }); fokusTitel(); },
    { text: { label: 'Begründung des Abbruchs (Pflichtangabe)', min: 1 },
      pflicht: 'Ich breche den Auftrag ' + opText(def) + ' ausdrücklich ab.', klartext: 'Abbruch ' + opText(def) });
}

function abschlussansicht() {
  const e = STATE.serie.ende;
  const text = e.art === 'Abberufung' ? 'Die Abberufung gemäß Option A wurde durch den Handler eingeleitet (Stand in Modul 5). Es werden keine weiteren Aufträge zugewiesen.'
    : e.art === 'Abbruch' ? 'Der Auftrag wurde abgebrochen. Der Rückzug erfolgt gemäß Plan. Es werden keine weiteren Aufträge zugewiesen.'
    : 'Alle zugewiesenen Aufträge sind abgeschlossen. Nachbesprechung nach gesonderter Weisung des Handlers.';
  return panel('Abschlussansicht: ' + e.art, h('span', { class: 'label ' + (e.art === 'Serie abgeschlossen' ? 's-dim' : 's-crit') }, 'Auftragsserie beendet'),
    h('dl', { class: 'fields' },
      feld('Anlass', e.art), feld('Zeitpunkt', fmtZ(e.t)), feld('Operativer Status', statusLabel(STATE.agent.status)),
      feld('Abgelehnte Aufträge', String(STATE.agent.ablehnungen)), feld('Vermerk', text, 'full')),
    tabelle(['Nr.', 'Vorgang', 'Art', 'Kurzbezeichnung', 'Zustand', 'Angenommen', 'Beendet'], SCENARIO.missionen.map(function (d) {
      const ms = MS(d.id), sichtbar = ms.status !== 'offen';
      return [td('nw', d.id), sichtbar ? d.nummer + ' ' + d.name : 'nicht zugewiesen', sichtbar ? d.art : '–', sichtbar ? d.dienstbezeichnung : '–',
              td('nw', zustandLabel(ms.status)), td('nw', ms.angenommenAm ? fmtZ(ms.angenommenAm) : '–'), td('nw', ms.beendetAm ? fmtZ(ms.beendetAm) : '–')];
    })));
}
function auftragskarte(def) {
  const ms = MS(def.id), n = ms.ablehnungen.length;
  return panel('Neuer Auftrag zugewiesen', [zustandLabel('zugewiesen'), h('span', { class: 'badge' }, 'zugewiesen ' + fmtZ(ms.zugewiesenAm))],
    h('dl', { class: 'fields' }, auftragFelder(def),
      n ? feld('Bisherige Ablehnungen', n + ' (' + def.aktenvermerk + '), zuletzt ' + fmtZ(ms.ablehnungen[n - 1].t) + ': ' + ms.ablehnungen[n - 1].text, 'full') : null),
    h('h3', null, 'Freigabekette'), freigabeTabelle(def),
    h('div', { class: 'row top' },
      h('button', { type: 'button', id: 'btn-annehmen', disabled: !!LM() || STATE.agent.status === 'Ruhend', onclick: function () { auftragAnnehmen(def); } }, 'Auftrag annehmen'),
      h('button', { type: 'button', id: 'btn-ablehnen', onclick: function () { auftragAblehnen(def); } }, 'Auftrag ablehnen'),
      null));
}
function archivPanel() {
  const fertig = SCENARIO.missionen.filter(function (d) { return MS(d.id).status === 'abgeschlossen'; });
  return panel('Abgeschlossene Missionen', h('span', { class: 'badge' }, String(fertig.length)),
    fertig.length ? fertig.map(function (d) {
      const ms = MS(d.id);
      return [h('h3', null, d.id + ' · Vorgang ' + d.nummer + ' ' + d.name),
        h('dl', { class: 'fields' },
          feld('Art', d.art + ' (' + d.dienstbezeichnung + ')'), feld('Einstufung', d.einstufung),
          feld('Zeitraum', fmtZ(ms.angenommenAm) + ' bis ' + fmtZ(ms.beendetAm)),
          feld('Abschlussbericht', ms.abschlussbericht, 'full')),
        zielTabelle(d)];
    }) : h('p', { class: 'note' }, 'Kein abgeschlossener Auftrag.'));
}

/* Zusatzakteure: eigene oder Standard-Dossiers, die der Agent der laufenden Mission zuordnet; der Handler bewertet nach Regeln */
const ZUSATZ_ROLLEN = ['Hinweisgeber', 'Kontakt', 'Beobachtungsobjekt', 'Gegenseite'];
function zugangStufe(def) { return Number(String((def && def.einstufung) || '').replace(/\D/g, '')) || 2; }
/* kürzester Abstand (Kanten) zu einer Entität der Mission, höchstens 3, sonst null */
function missionsAbstand(def, e) {
  const ziel = {}, kanten = kantenPool();
  alleEntitaeten().forEach(function (x) { if (x.mission === def.id) ziel[x.id] = true; });
  const gesehen = {}, rest = [{ id: e.id, d: 0 }];
  gesehen[e.id] = true;
  while (rest.length) {
    const c = rest.shift();
    if (ziel[c.id]) return c.d;
    if (c.d >= 3) continue;
    kanten.forEach(function (v) {
      const n = v.von === c.id ? v.nach : v.nach === c.id ? v.von : null;
      if (n && !gesehen[n]) { gesehen[n] = true; rest.push({ id: n, d: c.d + 1 }); }
    });
  }
  return null;
}
function zusatzBewerten(def, e, rolle) {
  const st = bedrohung(e).stufe, abstand = missionsAbstand(def, e), nah = abstand !== null && abstand <= 2, zugang = zugangStufe(def);
  if (st >= 4 && !nah) return { urteil: 'abgelehnt', grund: 'Der Zusammenhang mit dem Auftrag ist nicht belegt, das Risiko zu hoch.' };
  if (st >= 4 && rolle === 'Gegenseite' && zugang < 4) return { urteil: 'abgelehnt', grund: 'Dieser Akteur liegt über Ihrer Zugangsstufe.' };
  if (st >= 4) return { urteil: 'auflage', auflage: 'Keine Annäherung ohne ausdrückliche Freigabe des Handlers.' };
  if (!nah) return { urteil: 'auflage', auflage: 'Der Zusammenhang mit dem Auftrag ist nicht belegt: nur beobachten, kein Kontakt.' };
  if (e.typ === 'Ort' && rolle === 'Kontakt') return { urteil: 'auflage', auflage: 'Ein Ort ist kein Kontakt: nur Beobachtung aus dem öffentlichen Raum.' };
  if (rolle === 'Kontakt' && st >= 3) return { urteil: 'auflage', auflage: 'Kontaktaufnahme nur nach Rücksprache über den Handler.' };
  return { urteil: 'aufgenommen' };
}
const AN_KLASSE = { niedrig: 's-accent', mittel: 's-warn', hoch: 's-crit' };
function anreisePanel(def) {
  const A = def.anreise;
  if (!A) return null;
  const ms = MS(def.id), plan = STATE.anreise && STATE.anreise.mission === def.id ? STATE.anreise : null, jetzt = Date.now();
  const begonnen = einsatzLaeuft(), abgereist = !!(plan && plan.abfahrt && jetzt >= Date.parse(plan.abfahrt));
  const stufeLbl = function (st, r) { return h('span', { class: 'label ' + AN_KLASSE[st] }, 'Risikowert ' + r + ' · ' + st); };
  const faktorTab = function (f) { return tabelle(['Faktor', 'Punkte'], f.map(function (x) { return [td('txt', x.text), td('nw', '+' + x.punkte)]; }), 'Keine Risikofaktoren.'); };
  if (begonnen || abgereist) {
    const kopf = plan && plan.ohnePlan ? 'ohne Meldung' : plan && plan.angekommen ? 'angekommen' : plan ? 'unterwegs' : 'keine Meldung';
    return panel('Anreise', [h('span', { class: 'badge' }, kopf), plan ? stufeLbl(plan.stufe, plan.risiko) : null],
      plan && !plan.ohnePlan ? h('dl', { class: 'fields' },
        feld('Verkehrsmittel', plan.mittelName), feld('Ausgangsort', plan.ausgangName ? plan.ausgangName + (plan.km ? ' (Luftlinie ' + plan.km + ' km)' : '') : A.herkunft),
        feld('Abfahrt', fmtZ(plan.abfahrt)), feld('Ankunft', fmtZ(plan.ankunft)),
        feld('Unterkunft', plan.ortId + ' ' + standortName(plan.ortId)), feld('Vorerkundung', plan.erkundung ? 'ja' : 'nein'),
        feld('Bewertung des Handlers', plan.rueckmeldung, 'full')) : h('p', { class: 'note pad' }, 'Bis Einsatzbeginn wurde keine Reisemeldung abgegeben.'),
      plan ? h('div', { class: 'pad' }, faktorTab(plan.faktoren)) : null);
  }
  const tb = Date.parse(ms.beginn), liste = anreiseOptionen(def, tb, jetzt);
  const g = function (k, d) { return VIEW.draft[k] != null ? VIEW.draft[k] : d; };
  const waehle = function (k) { return function (ev) { VIEW.draft[k] = ev.target.type === 'checkbox' ? ev.target.checked : ev.target.value; renderModule(); }; };
  const ausgangId = g('an-ausgang', plan && plan.ausgangId ? plan.ausgangId : '');
  const unt = g('an-unt', plan ? plan.unterkunft : 'haupt');
  const L = anreiseListe(def, ausgangId, unt), optionenListe = L.optionen;
  const mittelWunsch = g('an-mittel', plan ? plan.mittel : 'bahn');
  const mittel = optionenListe.some(function (o) { return o.id === mittelWunsch; }) ? mittelWunsch : (optionenListe[0] ? optionenListe[0].id : '');
  let abfH = Number(g('an-abf', plan ? plan.abfahrtH : 24));
  if (liste.length && liste.indexOf(abfH) < 0) abfH = liste.reduce(function (a, b) { return Math.abs(b - abfH) < Math.abs(a - abfH) ? b : a; });
  const erk = !!g('an-erk', plan ? plan.erkundung : false);
  const wahl = { mittel: mittel, abfahrtH: abfH, unterkunft: unt, erkundung: erk, ausgang: ausgangId };
  const b = liste.length && mittel ? anreiseBewerten(def, wahl, jetzt) : null;
  const opt = optionenListe.find(function (o) { return o.id === mittel; });
  return panel('Anreiseplanung', [h('span', { class: 'badge' + (plan ? '' : ' on') }, plan ? 'Plan eingereicht' : 'offen')],
    h('p', { class: 'note pad' }, 'Einsatzbeginn ' + fmtZ(ms.beginn) + '. Die Anreise vorher festlegen; ein eingereichter Plan lässt sich bis zur Abreise ändern. Ohne Meldung bis Einsatzbeginn wird der Agent ohne Plan vor Ort angesetzt.'),
    liste.length ? h('div', null,
      PROFIL.ausgang.length ? h('div', { class: 'row' },
        h('label', { for: 'an-ausgang' }, 'Ausgangsort'),
        h('select', { id: 'an-ausgang', onchange: waehle('an-ausgang') },
          h('option', { value: '', selected: !ausgangId }, '– bitte wählen –'),
          PROFIL.ausgang.map(function (x) { return h('option', { value: x.id, selected: x.id === ausgangId }, x.name + ' (' + x.art + ')' + (x.ll ? '' : ', ohne Position')); })),
        L.km !== null ? h('span', { class: 'dim' }, 'Luftlinie zur Unterkunft: ' + Math.round(L.km) + ' km') : null) :
        h('p', { class: 'note pad' }, 'Keine Ausgangsorte im Profil angelegt: es gelten die festen Reiseoptionen des Auftrags. Ausgangsorte legst du im Agentenprofil an.'),
      L.grund ? h('p', { class: 'note pad' }, L.grund) : null,
      h('div', { class: 'row' },
        h('label', { for: 'an-mittel' }, 'Verkehrsmittel'),
        h('select', { id: 'an-mittel', onchange: waehle('an-mittel') }, optionenListe.map(function (o) { return h('option', { value: o.id, selected: o.id === mittel }, o.name + ' (' + dauerText(o.dauerMin) + (o.km ? ', ' + o.km + ' km' : '') + ')'); })),
        h('label', { for: 'an-abf' }, 'Abfahrt'),
        h('select', { id: 'an-abf', onchange: waehle('an-abf') }, liste.map(function (hh) { return h('option', { value: String(hh), selected: hh === abfH }, fmtZ(new Date(tb - hh * 3600000)).slice(0, 16) + 'Z (' + hh + ' h vor Beginn)'); }))),
      h('div', { class: 'row' },
        h('label', { for: 'an-unt' }, 'Unterkunft'),
        h('select', { id: 'an-unt', onchange: waehle('an-unt') },
          h('option', { value: 'haupt', selected: unt === 'haupt' }, 'Hauptunterkunft ' + A.unterkunft.haupt + ' ' + standortName(A.unterkunft.haupt)),
          h('option', { value: 'ausweich', selected: unt === 'ausweich' }, 'Ausweichunterkunft ' + A.unterkunft.ausweich + ' ' + standortName(A.unterkunft.ausweich))),
        h('input', { type: 'checkbox', id: 'an-erk', checked: erk, onchange: waehle('an-erk') }),
        h('label', { for: 'an-erk' }, 'Vorerkundung am Einsatzort')),
      opt ? h('p', { class: 'note pad' }, opt.hinweis) : null,
      b ? h('dl', { class: 'fields' },
        feld('Ausgangsort', b.ausgangName ? b.ausgangName + ' (Luftlinie ' + b.km + ' km)' : A.herkunft), feld('Reisedauer', dauerText(b.dauerMin)),
        feld('Ankunft', b.gueltig ? fmtZ(b.ankunft) : [fmtZ(b.ankunft), ' ', h('span', { class: 'label s-crit' }, b.grund)]),
        feld('Puffer bis Einsatzbeginn', dauerText(b.puffer)),
        feld('Risikowert', stufeLbl(b.stufe, b.risiko))) : null,
      b ? h('div', { class: 'pad' }, faktorTab(b.faktoren)) : null,
      plan && plan.rueckmeldung ? h('p', { class: 'note pad' }, 'Letzte Bewertung des Handlers: ' + plan.rueckmeldung) : null,
      h('div', { class: 'row top' }, h('button', { type: 'button', id: 'btn-anreise', disabled: !(b && b.gueltig) || STATE.agent.status === 'Ruhend',
        onclick: function () { dispatch({ type: 'ANREISE_EINGEREICHT', mittel: mittel, abfahrtH: abfH, unterkunft: unt, erkundung: erk, ausgang: ausgangId }); } }, plan ? 'Reiseplan ändern' : 'Reiseplan einreichen'))) :
      h('p', { class: 'note pad' }, 'Kein Abfahrtszeitpunkt mehr verfügbar. Der Agent wird zum Einsatzbeginn ohne Plan angesetzt.'));
}
function zusatzZeile(e) {
  const def = LM();
  if (!def || e.mission === def.id) return null;
  const ms = MS(def.id), x = (ms.zusatz || []).find(function (y) { return y.id === e.id; }), ruhend = STATE.agent.status === 'Ruhend';
  if (x) return h('div', { class: 'row top' }, h('span', null, 'Zusatzakteur im Auftrag ' + def.nummer + ': ' + x.rolle),
    h('span', { class: 'label ' + (x.urteil === 'abgelehnt' ? 's-crit' : x.urteil === 'auflage' ? 's-warn' : 's-accent') }, x.urteil === 'auflage' ? 'mit Auflage' : x.urteil),
    h('button', { type: 'button', id: 'btn-zusatz-weg', onclick: function () { dispatch({ type: 'MISSION_AKTEUR_ENTFERNT', id: e.id }); } }, 'Zurückziehen'));
  return h('div', { class: 'row top' },
    h('label', { for: 'sel-zusatz' }, 'Dem Auftrag ' + def.nummer + ' zuordnen als'),
    h('select', { id: 'sel-zusatz' }, ZUSATZ_ROLLEN.map(function (r) { return h('option', { value: r }, r); })),
    h('button', { type: 'button', id: 'btn-zusatz', disabled: ruhend, title: ruhend ? 'Im Status Ruhend nimmt der Handler keine Meldungen an.' : '',
      onclick: function () { dispatch({ type: 'MISSION_AKTEUR_ZUGEORDNET', id: e.id, rolle: $('sel-zusatz').value }); } }, 'Dem Handler melden'));
}
function zusatzPanel(def, ms) {
  const liste = ms.zusatz || [];
  return panel('Zusatzakteure', [h('span', { class: 'badge' }, String(liste.length))],
    liste.length ? tabelle(['Akteur', 'Rolle', 'Bewertung des Handlers', 'Auflage oder Grund', ''], liste.map(function (x) {
      const e = entitaet(x.id);
      return [e ? dossierLink(e, 'Missionsbriefing', 'zl-' + e.id) : td('nw', x.id), x.rolle,
        td('nw', h('span', { class: 'label ' + (x.urteil === 'abgelehnt' ? 's-crit' : x.urteil === 'auflage' ? 's-warn' : 's-accent') }, x.urteil === 'auflage' ? 'mit Auflage' : x.urteil)),
        td('txt', x.auflage || x.grund || 'ohne Auflage'),
        td('nw', h('button', { type: 'button', class: 'link', onclick: function () { dispatch({ type: 'MISSION_AKTEUR_ENTFERNT', id: x.id }); } }, 'Zurückziehen'))];
    }), '') : h('p', { class: 'note pad' }, 'Keine Zusatzakteure. Im Dossier lässt sich ein Akteur dem Auftrag zuordnen; der Handler bewertet die Meldung.'));
}
function renderMission(m) {
  const def = KM(), ms = MS(def.id), P = def.partnerstelle, mark = markierte(), laufend = ms.status === 'laufend';
  const neu = zugewiesene(), offen = offeneZiele();
  const prim = def.ziele.filter(function (z) { return z.art === 'primär'; }), sek = def.ziele.filter(function (z) { return z.art === 'sekundär'; });
  const offenIn = function (l) { return l.filter(function (z) { return !ms.ziele[z.id].erledigt; }).length; };
  const steuerung = [];
  if (laufend) {
    steuerung.push(h('label', { for: 'sel-mstatus' }, 'Arbeitsstand'));
    steuerung.push(h('select', { id: 'sel-mstatus', onchange: function (ev) { dispatch({ type: 'MISSIONSSTATUS_GESETZT', status: ev.target.value }); } },
      SCENARIO.serie.arbeitsstaende.map(function (x) { return h('option', { value: x, selected: x === ms.arbeitsstand }, x); })));
    if (offen === 0) steuerung.push(h('button', { type: 'button', id: 'btn-abschluss', onclick: function () { missionAbschliessen(def); } }, 'Mission abschließen'));
    else steuerung.push(h('span', { class: 'dim' }, offen + ' Ziele offen.'));
    if (def.abbruch) steuerung.push(h('button', { type: 'button', id: 'btn-abbruch', onclick: function () { auftragAbbrechen(def); } }, 'Auftrag abbrechen'));
  } else {
    steuerung.push(h('span', { class: 'dim' }, 'Auftrag ' + ms.status + (ms.beendetAm ? ' seit ' + fmtZ(ms.beendetAm) : '') + '.' +
      (STATE.serie.folge && !neu ? ' Weisung des Handlers abwarten.' : '')));
  }
  return [
    modKopf(m),
    STATE.serie.ende ? abschlussansicht() : null,
    nachbereitungPanel(),
    neu ? auftragskarte(neu) : null,
    laufend ? anreisePanel(def) : null,
    panel(laufend ? 'Laufender Auftrag' : 'Letzter Auftrag', [zustandLabel(ms.status), laufend ? h('span', { class: 'badge' }, 'Arbeitsstand ' + ms.arbeitsstand) : null],
      h('dl', { class: 'fields' }, auftragFelder(def),
        feld('Gültig von', fmtZ(ms.von)), feld('Gültig bis', fmtZ(ms.bis)), feld('Angenommen', fmtZ(ms.angenommenAm)),
        def.abbruch ? feld('Abbruchkriterium', def.abbruchkriterium, 'full') : null),
      h('h3', null, 'Freigabekette'), freigabeTabelle(def),
      h('div', { class: 'row top' }, steuerung)),
    h('div', { class: 'cols' },
      panel('Primäre Ziele', h('span', { class: 'badge' }, offenIn(prim) + ' von ' + prim.length + ' offen'), zielListe(def, 'primär')),
      panel('Sekundäre Ziele', h('span', { class: 'badge' }, offenIn(sek) + ' von ' + sek.length + ' offen'), zielListe(def, 'sekundär'))),
    h('div', { class: 'cols' },
      panel('Rules of Engagement und Einschränkungen', null, h('ol', { class: 'num' }, def.roe.map(function (r) { return h('li', null, r); }))),
      panel('Abstimmung mit Partnerstelle', null,
        h('dl', { class: 'fields wide' },
          feld('Status', [h('span', { class: 'label ' + (P.angezeigt ? 's-accent' : 's-warn') }, P.kurz), ' ', P.status]),
          feld('Stand', fmtZ(ms.partnerStand)),
          feld('Ansprechstelle', P.ansprechstelle, 'full')),
        h('h3', null, 'Beschränkungen'),
        h('ol', { class: 'num' }, P.beschraenkungen.map(function (b) { return h('li', null, b); })))),
    panel('Zeitfenster und Opportunities', null,
      tabelle(['ID', 'Fenster', 'Beginn', 'Ende', 'Zustand und Restzeit'], def.zeitfenster.map(function (w) {
        const z = ms.zeitfenster[w.id];
        return [td('nw', w.id), td('txt', w.titel), td('nw', fmtZ(z.von)), td('nw', fmtZ(z.bis)), h('td', { class: 'nw', 'data-fenster': w.id })];
      }))),
    panel('Zentrale Risiken', null,
      tabelle(['ID', 'Risiko', 'Eintrittswahrscheinlichkeit', 'Auswirkung', 'Gegenmaßnahme'], def.risiken.map(function (r) {
        return [td('nw', r.id), td('txt', r.risiko), r.wahrscheinlichkeit, r.auswirkung, td('txt', r.gegenmassnahme)];
      }))),
    h('div', { class: 'cols' },
      panel('Unterstützende Assets und Kontakte', null,
        tabelle(['Bezeichnung', 'Rolle', 'Kontaktweg'], def.assets.map(function (a) { return [td('nw', a.name), a.rolle, a.kontaktweg]; }))),
      panel('Entitäten mit Status', h('span', { class: 'badge' + (mark.length ? ' on' : '') }, String(mark.length)),
        tabelle(['Entität', 'Typ', 'Staat', 'Bedrohung', 'Status', 'Seit'], mark.map(function (e) {
          const d = STATE.dossiers.entitaeten[e.id];
          return [dossierLink(e, 'Missionsbriefing', 'ml-' + e.id), e.typ, land(e.land), td('nw', stufeLabel(bedrohung(e).stufe)), td('nw', dossierStatusLabel(d.status)), td('nw', fmtZ(d.statusAm))];
        }), 'Keine Entität mit Status.'))),
    laufend ? zusatzPanel(def, ms) : null,
    panel('Lageberichte', h('span', { class: 'badge' }, String(STATE.berichte.length)),
      h('div', { class: 'pad' }, entwurf('textarea', 'lb-text', 'lb-text', { rows: '3', 'aria-label': 'Neuer Lagebericht', placeholder: 'Was, wann, durch wen, mit welchem Ergebnis.', spellcheck: 'false' })),
      h('div', { class: 'row' },
        h('button', { type: 'button', id: 'btn-lb', onclick: function () {
          const t = ($('lb-text').value || '').trim();
          if (!t) { meldung('Lagebericht ohne Text wird nicht erfasst.'); return; }
          dispatch({ type: 'LAGEBERICHT', text: t });
        } }, 'Lagebericht erfassen'),
        null),
      tabelle(['Zeit (UTC)', 'ID', 'Mission', 'Bericht'], STATE.berichte.slice().reverse().map(function (b) {
        return [td('nw', fmtZ(b.t)), td('nw', b.id), td('nw', b.mission || '–'), td('txt', b.text)];
      }), 'Noch kein Lagebericht erfasst.')),
    archivPanel()
  ];
}

/* =====================================================================
   MODUL 3: DOSSIER-DATENBANK
   ===================================================================== */
function formRein(typ, x, y, r, cls) {
  if (typ === 'Person') return s('circle', { cx: x, cy: y, r: r, class: cls });
  if (typ === 'Organisation') return s('rect', { x: x - r, y: y - r, width: 2 * r, height: 2 * r, class: cls });
  const q = r * 1.25;                              /* Ort: Raute */
  return s('polygon', { points: [x, y - q, x + q, y, x, y + q, x - q, y].join(' '), class: cls });
}
function icon(typ) { return s('svg', { class: 'ico', viewBox: '0 0 14 14', 'aria-hidden': 'true', focusable: 'false' }, formRein(typ, 7, 7, typ === 'Ort' ? 4.4 : 5, '')); }
function verbindungenVon(id) { return kantenPool().filter(function (v) { return v.von === id || v.nach === id; }); }
function bewertungText(b) { return b + ': Quelle ' + SCENARIO.admiralty.quelle[b[0]] + ', Information ' + SCENARIO.admiralty.information[b[1]]; }
function graphFilter(v) {
  const G = VIEW.graph;
  return (G.typ === 'Alle' || v.typ === G.typ) && v.bewertung[0] <= G.quelle && Number(v.bewertung[1]) <= G.info;
}
function oeffneDossier(id, ueber) { dispatch({ type: 'DOSSIER_GEOEFFNET', id: id, ueber: ueber }); }

function feldZeile(label, id, el) { return h('div', { class: 'row', style: 'padding:4px 0' }, h('label', { for: id, style: 'min-width:120px' }, label), el); }
function bildWaehler(id, onBild) {
  return h('input', { type: 'file', id: id, accept: 'image/*', 'aria-label': 'Lichtbild wählen', style: 'max-width:260px',
    onchange: function (ev) {
      const f = ev.target.files && ev.target.files[0];
      if (!f) return;
      bildAusDatei(f, onBild, function (grund) { meldung('Lichtbild nicht übernommen: ' + grund); });
    } });
}
function neuesDossier() {
  let bild = null;
  const vorschau = h('div', { class: 'foto', id: 'nd-vorschau', style: 'margin:0' }, h('span', { class: 'ph' }, 'Kein Foto'));
  const stufenText = h('p', { class: 'note', id: 'nd-stufentext', style: 'margin:2px 0 6px 128px' }, SCENARIO.bedrohungsHinweise[2]);
  const zeigen = function () {
    vorschau.replaceChildren(bild ? h('img', { src: bild, alt: 'Vorschau Lichtbild' }) : h('span', { class: 'ph' }, 'Kein Foto'));
    $('nd-entf').disabled = !bild;
  };
  const form = h('div', null,
    feldZeile('Typ', 'nd-typ', h('select', { id: 'nd-typ' }, ['Person', 'Organisation', 'Ort'].map(function (x) { return h('option', { value: x }, x); }))),
    feldZeile('Name', 'nd-name', h('input', { type: 'text', id: 'nd-name', autocomplete: 'off', spellcheck: 'false', style: 'flex:1 1 220px;min-width:0' })),
    feldZeile('Staat', 'nd-land', h('select', { id: 'nd-land' }, Object.keys(SCENARIO.laender).map(function (k) { return h('option', { value: k }, k + ' ' + SCENARIO.laender[k]); }))),
    feldZeile('Aliase', 'nd-alias', h('input', { type: 'text', id: 'nd-alias', autocomplete: 'off', placeholder: 'durch Komma getrennt', style: 'flex:1 1 220px;min-width:0' })),
    feldZeile('Beschreibung', 'nd-rolle', h('textarea', { id: 'nd-rolle', rows: '2', spellcheck: 'false', style: 'flex:1 1 220px;min-width:0' })),
    feldZeile('Eckdaten', 'nd-eck', h('textarea', { id: 'nd-eck', rows: '3', placeholder: 'eine Angabe je Zeile', spellcheck: 'false', style: 'flex:1 1 220px;min-width:0' })),
    feldZeile('Kartenposition', 'nd-koord', h('input', { type: 'text', id: 'nd-koord', autocomplete: 'off', spellcheck: 'false', placeholder: 'optional: Breite, Länge (z. B. 52.5200, 13.4050)', style: 'flex:1 1 220px;min-width:0' })),
    feldZeile('Einschätzung', 'nd-stufe', h('select', { id: 'nd-stufe', onchange: function (ev) { stufenText.textContent = SCENARIO.bedrohungsHinweise[ev.target.value]; } },
      [1, 2, 3, 4, 5].map(function (n) { return h('option', { value: String(n), selected: n === 2 }, n + ' – ' + SCENARIO.bedrohungsstufen[n]); }))),
    stufenText,
    feldZeile('Lichtbild', 'nd-bild', h('div', { class: 'row', style: 'align-items:flex-start;gap:12px' }, vorschau,
      h('div', null, bildWaehler('nd-bild', function (b) { bild = b; zeigen(); }),
        h('div', { style: 'padding-top:6px' }, h('button', { type: 'button', id: 'nd-entf', disabled: true, onclick: function () { bild = null; $('nd-bild').value = ''; zeigen(); } }, 'Foto entfernen')),
        h('p', { class: 'note', style: 'margin:6px 0 0' }, 'Optional. Wird auf 4:5 zugeschnitten und nur lokal im Zustand gespeichert.')))));
  bestaetigen('Neues Dossier anlegen', form, 'Dossier anlegen', function () {
    dispatch({ type: 'DOSSIER_ANGELEGT', typ: $('nd-typ').value, name: $('nd-name').value, land: $('nd-land').value, aliase: $('nd-alias').value,
               rolle: $('nd-rolle').value, eckdaten: $('nd-eck').value, stufe: $('nd-stufe').value, bild: bild, koord: $('nd-koord').value });
  }, { pruefer: function () { return $('nd-name').value.trim().length > 0; }, klartext: 'Neues Dossier anlegen?' });
}
function eigenesPanel(e) {
  const mir = pool().filter(function (x) { return x.id !== e.id; });
  const kanten = ((STATE.dossiers.eigeneKanten) || []).filter(function (v) { return v.von === e.id || v.nach === e.id; });
  const Q = SCENARIO.admiralty;
  const eigenBild = !!PROFIL.bilder[e.id], ll = karteKoord(e.id), llEigen = !!PROFIL.koord[e.id];
  return [
    h('h3', null, 'Lichtbild'),
    h('div', { class: 'row' },
      bildWaehler('fx-bild', function (b) { dispatch({ type: 'DOSSIER_BILD', id: e.id, bild: b }); }),
      eigenBild ? h('button', { type: 'button', id: 'btn-fx', onclick: function () { dispatch({ type: 'DOSSIER_BILD', id: e.id, bild: null }); } }, 'Eigenes Foto entfernen') : null,
      h('span', { class: 'note' }, 'Ersetzt die Datei bilder/' + e.id.toLowerCase() + '.jpg nur in diesem Terminal.')),
    h('h3', null, 'Kartenposition'),
    h('div', { class: 'row' },
      entwurf('input', 'ko-text', 'ko-' + e.id, { type: 'text', autocomplete: 'off', spellcheck: 'false', placeholder: 'Breite, Länge (z. B. 52.5200, 13.4050)', 'aria-label': 'Koordinaten von ' + e.id,
        style: 'flex:1 1 240px;min-width:0', value: VIEW.draft['ko-' + e.id] != null ? VIEW.draft['ko-' + e.id] : (ll ? ll[0] + ', ' + ll[1] : '') }),
      h('button', { type: 'button', id: 'btn-ko', onclick: function () { dispatch({ type: 'DOSSIER_ORT', id: e.id, text: $('ko-text').value }); delete VIEW.draft['ko-' + e.id]; } }, 'Setzen'),
      h('button', { type: 'button', id: 'btn-ko-karte', onclick: function () { VIEW.karte.pick = e.id; VIEW.karte.auswahl = null; if (ll) { VIEW.karte.lat = ll[0]; VIEW.karte.lon = ll[1]; VIEW.karte.zoom = Math.max(VIEW.karte.zoom, 9); } dispatch({ type: 'NAVIGATION', modul: 'karte' }); renderModule(); } }, 'Auf Karte wählen'),
      llEigen ? h('button', { type: 'button', id: 'btn-ko-x', onclick: function () { dispatch({ type: 'DOSSIER_ORT', id: e.id, ll: null }); delete VIEW.draft['ko-' + e.id]; } }, 'Position entfernen') : null,
      h('span', { class: 'note' }, 'Koordinaten lassen sich in jedem Kartendienst per Rechtsklick kopieren. Sie bleiben nur lokal im Profil.')),
    h('h3', null, 'Verbindung hinzufügen'),
    h('div', { class: 'row' },
      h('label', { for: 'vn-ziel' }, 'Gegenüber'),
      h('select', { id: 'vn-ziel' }, mir.map(function (x) { return h('option', { value: x.id }, x.id + ' ' + x.name); })),
      h('label', { for: 'vn-typ' }, 'Typ'),
      h('select', { id: 'vn-typ' }, SCENARIO.verbindungstypen.map(function (x) { return h('option', { value: x }, x); })),
      h('label', { for: 'vn-q' }, 'Quelle'),
      h('select', { id: 'vn-q' }, Object.keys(Q.quelle).map(function (x) { return h('option', { value: x, selected: x === 'C' }, x + ' ' + Q.quelle[x]); })),
      h('label', { for: 'vn-i' }, 'Information'),
      h('select', { id: 'vn-i' }, Object.keys(Q.information).map(function (x) { return h('option', { value: x, selected: x === '3' }, x + ' ' + Q.information[x]); })),
      h('input', { type: 'checkbox', id: 'vn-beid' }), h('label', { for: 'vn-beid' }, 'beidseitig'),
      h('button', { type: 'button', id: 'btn-vn', onclick: function () {
        dispatch({ type: 'VERBINDUNG_ANGELEGT', von: e.id, nach: $('vn-ziel').value, typ: $('vn-typ').value, bewertung: $('vn-q').value + $('vn-i').value, beidseitig: $('vn-beid').checked });
      } }, 'Verbindung anlegen')),
    kanten.length ? tabelle(['ID', 'Verbindung', 'Typ', 'Bewertung', ''], kanten.map(function (v) {
      return [td('nw', v.id), v.von + (v.richtung === 'beidseitig' ? ' ↔ ' : ' → ') + v.nach, v.typ, td('nw', v.bewertung),
              h('button', { type: 'button', class: 'link', id: 'vx-' + v.id, onclick: function () { dispatch({ type: 'VERBINDUNG_GELOESCHT', id: v.id }); } }, 'Entfernen')];
    })) : null,
    e.eigen ? h('div', { class: 'row top' }, h('button', { type: 'button', id: 'btn-dx', onclick: function () {
      bestaetigen('Eigenes Dossier löschen', e.id + ' ' + e.name + ' wird mit allen Notizen und Verbindungen entfernt. Die Löschung wird protokolliert.', 'Dossier löschen',
        function () { dispatch({ type: 'DOSSIER_GELOESCHT', id: e.id }); }, { pflicht: e.id + ' endgültig löschen.' });
    } }, 'Dossier löschen')) : null
  ];
}
function dossierListe() {
  const F = VIEW.dossier, q = F.q.trim().toLowerCase();
  const alle = pool();
  const treffer = alle.filter(function (e) {
    const st = STATE.dossiers.entitaeten[e.id];
    if (F.typ !== 'Alle' && e.typ !== F.typ) return false;
    if (F.land !== 'Alle' && e.land !== F.land) return false;
    if (bedrohung(e).stufe < F.stufe) return false;
    if (F.status === 'mit' ? !st.status : (F.status !== 'Alle' && st.status !== F.status)) return false;
    if (!q) return true;
    return (e.id + ' ' + e.name + ' ' + e.aliase.join(' ') + ' ' + e.rolle + ' ' + e.reg).toLowerCase().indexOf(q) >= 0;
  });
  const neu = function () { renderModule(); };
  return panel('Entitäten', [h('span', { class: 'badge' }, treffer.length + ' von ' + alle.length),
    h('button', { type: 'button', id: 'btn-dneu', style: 'margin-left:8px', onclick: neuesDossier }, 'Neues Dossier')],
    h('div', { class: 'flt' },
      h('label', { for: 'df-q' }, 'Suche'),
      h('input', { type: 'search', id: 'df-q', value: F.q, placeholder: 'ID, Name, Alias, Rolle', autocomplete: 'off', spellcheck: 'false',
                   oninput: function (ev) { F.q = ev.target.value; neu(); } }),
      h('label', { for: 'df-typ' }, 'Typ'),
      h('select', { id: 'df-typ', onchange: function (ev) { F.typ = ev.target.value; neu(); } },
        ['Alle', 'Person', 'Organisation', 'Ort'].map(function (x) { return h('option', { value: x, selected: x === F.typ }, x); })),
      h('label', { for: 'df-stufe' }, 'Bedrohung'),
      h('select', { id: 'df-stufe', onchange: function (ev) { F.stufe = Number(ev.target.value); neu(); } },
        [0, 2, 3, 4, 5].map(function (n) { return h('option', { value: String(n), selected: n === F.stufe }, n === 0 ? 'Alle Stufen' : n === 5 ? 'Stufe 5' : 'ab Stufe ' + n); })),
      h('label', { for: 'df-land' }, 'Staat'),
      h('select', { id: 'df-land', onchange: function (ev) { F.land = ev.target.value; neu(); } },
        ['Alle'].concat(Object.keys(SCENARIO.laender)).map(function (x) { return h('option', { value: x, selected: x === F.land }, x === 'Alle' ? 'Alle' : x + ' ' + SCENARIO.laender[x]); })),
      h('label', { for: 'df-status' }, 'Status'),
      h('select', { id: 'df-status', onchange: function (ev) { F.status = ev.target.value; neu(); } },
        [['Alle', 'Alle'], ['mit', 'mit Status']].concat(SCENARIO.dossierStatus.map(function (x) { return [x.id, x.label]; }))
          .map(function (x) { return h('option', { value: x[0], selected: x[0] === F.status }, x[1]); }))),
    h('ul', { class: 'elist', 'data-scroll': 'elist' },
      treffer.length ? treffer.map(function (e) {
        const st = STATE.dossiers.entitaeten[e.id];
        return h('li', null, h('button', { type: 'button', id: 'dl-' + e.id, 'aria-current': e.id === STATE.dossiers.auswahl ? 'true' : null,
            onclick: function () { oeffneDossier(e.id); } },
          icon(e.typ), h('span', { class: 'nm' }, e.name), h('span', { class: 'meta' }, 'S' + bedrohung(e).stufe + ' · ' + e.land),
          h('span', { class: 'sub' }, e.id + ' · ' + e.typ + ' · ' + dossierQuelle(e) + (st.status ? ' · ' + statusDef(st.status).label : ''))));
      }) : h('li', { class: 'note' }, 'Keine Entität entspricht dem Filter.')),
    h('div', { class: 'legend', 'aria-label': 'Legende Typen' },
      ['Person', 'Organisation', 'Ort'].map(function (t) { return h('span', null, icon(t), t); }),
      h('span', null, 'S1 bis S5: Bedrohungsstufe')));
}

function dossierAnsicht(e) {
  const st = STATE.dossiers.entitaeten[e.id], vs = verbindungenVon(e.id);
  return panel('Dossier ' + e.id, [h('span', { class: 'label ' + stufeKlasse(bedrohung(e).stufe) }, 'Stufe ' + bedrohung(e).stufe + ' – ' + SCENARIO.bedrohungsstufen[bedrohung(e).stufe]),
      st.status ? dossierStatusLabel(st.status) : null],
    h('div', { class: 'mitfoto' }, bildFeld(bildPfad(e, e.id), 'Bild ' + e.id, 'Kein Bild'), h('dl', { class: 'fields' },
      feld('Name', e.name), feld('Typ', e.typ),
      feld('Länderkennung', [land(e.land), ' ' + SCENARIO.laender[e.land] + (e.landHinweis ? ' (' + e.landHinweis + ')' : '')]),
      feld('Aliase', e.aliase.length ? e.aliase.join(', ') : 'keine bekannt'),
      feld('Freigeschaltet mit', e.mission === 'STD' ? 'Standard-Dossier' : e.mission + ' ' + missionDef(e.mission).name),
      feld('Status', st.status ? [dossierStatusLabel(st.status), ' seit ' + fmtZ(st.statusAm)] : 'ohne Status'),
      feld('S-9-Registernummer', e.reg), feld('Letzte Aktualisierung', fmtZ(st.aktualisiert)),
      feld('Verteilerbeschränkung', e.verteiler, 'full'),
      feld(e.mission === 'STD' ? 'Beschreibung' : 'Rolle zur Mission', e.rolle, 'full'),
      feld(e.typ === 'Person' ? 'Biografische Eckdaten' : 'Eckdaten', e.eckdaten.join(' · '), 'full'),
      feld('Bedrohungsbewertung', [stufeLabel(bedrohung(e).stufe), ' ', bedrohung(e).begruendung], 'full'),
      (e.nachtraege || []).filter(function (n) { return freigeschaltet(n.mission); }).map(function (n) {
        return [feld('Nachtrag ' + n.mission + ' ' + missionDef(n.mission).name + ': Rolle', n.rolle, 'full'),
                feld('Nachtrag ' + n.mission + ': Eckdaten', n.eckdaten.join(' · '), 'full')];
      }))),
    h('div', { class: 'row top' },
      h('label', { for: 'sel-dstatus' }, 'Status'),
      h('select', { id: 'sel-dstatus', onchange: function (ev) {
        const wert = ev.target.value, sd = statusDef(wert), los = function () { dispatch({ type: 'DOSSIER_STATUS', id: e.id, status: wert }); };
        if (!sd || !sd.kritisch) { los(); return; }
        ev.target.value = st.status || '';
        bestaetigen('Dossierstatus: ' + sd.label, e.id + ' ' + e.name + ' erhält den Status "' + sd.label + '". Die Änderung wird als kritisches Ereignis protokolliert.',
          'Status setzen', los, { pflicht: 'Status "' + sd.label + '" für ' + e.id + ' bestätigt.' });
      } }, [h('option', { value: '', selected: !st.status }, 'ohne Status')].concat(SCENARIO.dossierStatus.map(function (x) {
        return h('option', { value: x.id, selected: x.id === st.status }, x.label);
      })))),
    zusatzZeile(e),
    h('h3', null, 'Verbindungen (' + vs.length + ')'),
    tabelle(['Gegenüber', 'Typ', 'Richtung', 'Bewertung', 'Quelle'], vs.map(function (v) {
      const g = entitaet(v.von === e.id ? v.nach : v.von);
      const richtung = v.richtung === 'beidseitig' ? 'beidseitig ↔' : (v.von === e.id ? 'ausgehend →' : 'eingehend ←');
      return [h('button', { type: 'button', class: 'link', id: 'vl-' + v.id, onclick: function () { oeffneDossier(g.id, 'Verbindung ' + v.id); } }, g.id + ' ' + g.name),
              v.typ, td('nw', richtung), td('nw', h('abbr', { title: bewertungText(v.bewertung) }, v.bewertung)), v.quelle];
    })),
    galerieBlock(e),
    h('h3', null, 'Notizen (' + st.notizen.length + ')'),
    tabelle(['Zeit (UTC)', 'ID', 'Notiz'], st.notizen.slice().reverse().map(function (n) { return [td('nw', fmtZ(n.t)), td('nw', n.id), td('txt', n.text)]; }), 'Keine Notizen zu diesem Dossier.'),
    h('div', { class: 'row top' },
      entwurf('input', 'dn-text', 'dn-' + e.id, { type: 'text', 'aria-label': 'Neue Notiz zu ' + e.id, placeholder: 'Notiz zu ' + e.id, style: 'flex:1 1 220px;min-width:0', autocomplete: 'off',
        onkeydown: function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); $('btn-dn').click(); } } }),
      h('button', { type: 'button', id: 'btn-dn', onclick: function () {
        const t = ($('dn-text').value || '').trim();
        if (!t) { meldung('Notiz ohne Text wird nicht hinzugefügt.'); return; }
        dispatch({ type: 'DOSSIER_NOTIZ', id: e.id, text: t });
      } }, 'Notiz hinzufügen')),
    eigenesPanel(e));
}

/* Beziehungsansicht: deterministische, konzentrische Anordnung um die ausgewählte Entität.
   Ring 1: direkte Nachbarn; Ring 2 (nur erweiterte Ansicht): Nachbarn der Nachbarn.
   Reihenfolge je Ring gemäß SCENARIO.entitaeten, Start oben, im Uhrzeigersinn. */
function graphSvg(zentrum) {
  const W = 900, H = 690, cx = W / 2, cy = 330, G = VIEW.graph;
  const kanten = kantenPool().filter(graphFilter);
  const ordnung = pool().map(function (e) { return e.id; });
  const nachbarn = function (id) {
    return kanten.filter(function (v) { return v.von === id || v.nach === id; }).map(function (v) { return v.von === id ? v.nach : v.von; });
  };
  const ring1 = ordnung.filter(function (id) { return id !== zentrum.id && nachbarn(zentrum.id).indexOf(id) >= 0; });
  let ring2 = [];
  if (G.erweitert) {
    ring2 = ordnung.filter(function (id) {
      return id !== zentrum.id && ring1.indexOf(id) < 0 && nachbarn(id).some(function (n) { return ring1.indexOf(n) >= 0; });
    });
  }
  const pos = {}, ring = {}, winkel = {};
  pos[zentrum.id] = { x: cx, y: cy }; ring[zentrum.id] = 0;
  const punkt = function (id, grad, rx, ry, nr) {
    const w = grad * Math.PI / 180;
    pos[id] = { x: Math.round(cx + rx * Math.cos(w)), y: Math.round(cy + ry * Math.sin(w)) }; ring[id] = nr; winkel[id] = grad;
  };
  ring1.forEach(function (id, i) { punkt(id, -90 + i * 360 / ring1.length, ring2.length ? 205 : 270, ring2.length ? 135 : 185, 1); });
  if (ring2.length) {
    /* Ring 2: jeder Knoten wird beim ersten verbundenen Ring-1-Knoten eingeordnet und um dessen Winkel aufgefächert */
    const gruppen = {};
    ring2.forEach(function (id) {
      const eltern = ring1.filter(function (r) { return nachbarn(id).indexOf(r) >= 0; })[0];
      (gruppen[eltern] = gruppen[eltern] || []).push(id);
    });
    const plan = [];
    ring1.forEach(function (r) {
      (gruppen[r] || []).forEach(function (id, k, l) { plan.push({ id: id, grad: winkel[r] + (k - (l.length - 1) / 2) * 26 }); });
    });
    const abstand = Math.min(24, 360 / plan.length);
    for (let i = 1; i < plan.length; i++) { if (plan[i].grad < plan[i - 1].grad + abstand) plan[i].grad = plan[i - 1].grad + abstand; }
    const ueber = plan[plan.length - 1].grad + abstand - (plan[0].grad + 360);
    if (ueber > 0) plan.forEach(function (p, i) { p.grad -= ueber * (i + 1) / plan.length; });
    plan.forEach(function (p) { punkt(p.id, p.grad, 390, 252, 2); });
  }
  const sichtbar = kanten.filter(function (v) {
    if (!pos[v.von] || !pos[v.nach]) return false;
    return G.erweitert || v.von === zentrum.id || v.nach === zentrum.id;
  });

  const svg = s('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'group', 'aria-label': 'Beziehungsansicht um ' + zentrum.id + ' ' + zentrum.name + ', ' + sichtbar.length + ' Verbindungen' },
    s('defs', null, s('marker', { id: 'pfeil', viewBox: '0 0 10 10', refX: '9', refY: '5', markerWidth: '7', markerHeight: '7', orient: 'auto-start-reverse' },
      s('path', { d: 'M0 1 L10 5 L0 9 z', class: 'g-arrow' })),
      s('clipPath', { id: 'clip-kreis', clipPathUnits: 'objectBoundingBox' }, s('circle', { cx: '0.5', cy: '0.5', r: '0.5' })),
      s('clipPath', { id: 'clip-raute', clipPathUnits: 'objectBoundingBox' }, s('polygon', { points: '0.5 0 1 0.5 0.5 1 0 0.5' }))));
  const gK = s('g', null), gL = s('g', null), gN = s('g', null);
  let unbeschriftet = 0;
  sichtbar.forEach(function (v) {
    const a = pos[v.von], b = pos[v.nach], dx = b.x - a.x, dy = b.y - a.y, len = Math.sqrt(dx * dx + dy * dy) || 1, ux = dx / len, uy = dy / len;
    const schwach = v.bewertung[0] >= 'D' || Number(v.bewertung[1]) >= 4;
    const quer = ring[v.von] === ring[v.nach];             /* Querverbindung innerhalb eines Rings */
    gK.appendChild(s('line', { x1: a.x + ux * 24, y1: a.y + uy * 24, x2: b.x - ux * 26, y2: b.y - uy * 26, class: 'g-edge' + (schwach ? ' weak' : '') + (quer ? ' quer' : ''),
      'marker-end': 'url(#pfeil)', 'marker-start': v.richtung === 'beidseitig' ? 'url(#pfeil)' : null },
      s('title', null, v.id + ': ' + v.von + (v.richtung === 'beidseitig' ? ' ↔ ' : ' → ') + v.nach + ', ' + v.typ + ', Bewertung ' + bewertungText(v.bewertung) + ', Quelle: ' + v.quelle)));
    if (quer) { unbeschriftet += 1; return; }
    const txt = v.typ + ' ' + v.bewertung, tw = txt.length * 6.4 + 8;
    const innen = ring[v.von] < ring[v.nach] ? a : b, aussen = innen === a ? b : a;
    const mx = innen.x + (aussen.x - innen.x) * 0.56, my = innen.y + (aussen.y - innen.y) * 0.56;
    gL.appendChild(s('rect', { x: mx - tw / 2, y: my - 8, width: tw, height: 15, class: 'g-lblbg' }));
    gL.appendChild(s('text', { x: mx, y: my + 3.5, 'text-anchor': 'middle', class: 'g-lbl' }, txt));
  });
  Object.keys(pos).forEach(function (id) {
    const e = entitaet(id), p = pos[id], mitte = id === zentrum.id, st = bedrohung(e).stufe;
    const oeffnen = function () { if (!mitte) oeffneDossier(id, 'Beziehungsansicht'); };
    const dst = STATE.dossiers.entitaeten[id].status, elim = dst === 'eliminiert', pfad = bildPfad(e, id);
    const name = kuerzen(e.name, 22), kennung = id + ' ' + e.land + (pfad ? ' S' + st : '') + (elim ? ' · ELIMINIERT' : '');
    const clip = e.typ === 'Person' ? 'url(#clip-kreis)' : e.typ === 'Ort' ? 'url(#clip-raute)' : null;
    const oben = p.y < cy - 40;                           /* Beschriftung auf der dem Zentrum abgewandten Seite */
    const y1 = oben ? p.y - 41 : p.y + 38, y2 = oben ? p.y - 28 : p.y + 51;
    const bw = Math.max(name.length * 5.9, kennung.length * 6.7) + 8;
    const g = s('g', { class: 'node', id: 'gn-' + id, tabindex: '0', role: 'button',
      'aria-label': id + ' ' + e.name + ', ' + e.typ + ', ' + e.land + ', Bedrohungsstufe ' + st + (mitte ? ', ausgewählt' : ', Dossier öffnen'),
      onclick: oeffnen, onkeydown: function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); oeffnen(); } } },
      s('title', null, id + ' ' + e.name + ' (' + e.typ + ', ' + e.land + '), Stufe ' + st + ' – ' + SCENARIO.bedrohungsstufen[st] + (dst ? ', Status ' + statusDef(dst).label : '')),
      s('rect', { x: p.x - bw / 2, y: y1 - 11, width: bw, height: 28, class: 'g-lblbg' }),
      mitte ? formRein(e.typ, p.x, p.y, 21, 'g-sel') : null,
      formRein(e.typ, p.x, p.y, 16, 'g-shape' + (st >= 5 ? ' t5' : st === 4 ? ' t4' : '') + (elim ? ' elim' : '')),
      s('text', { x: p.x, y: p.y + 3.5, 'text-anchor': 'middle', class: 'g-lvl' }, 'S' + st),
      pfad ? s('image', { href: pfad, x: p.x - 15, y: p.y - 15, width: 30, height: 30, preserveAspectRatio: 'xMidYMid slice', 'clip-path': clip, onerror: function (ev) { ev.target.remove(); } }) : null,
      s('text', { x: p.x, y: y1, 'text-anchor': 'middle', class: 'g-id' }, kennung),
      s('text', { x: p.x, y: y2, 'text-anchor': 'middle', class: 'g-name' }, name));
    gN.appendChild(g);
  });
  if (!ring1.length) {
    gL.appendChild(s('text', { x: cx, y: cy + 90, 'text-anchor': 'middle', class: 'g-name' }, 'Keine Verbindungen für diesen Filter.'));
  }
  appendKid(svg, [gK, gL, gN]);
  return { svg: svg, kanten: sichtbar.length, knoten: Object.keys(pos).length, unbeschriftet: unbeschriftet };
}
function beziehungsansicht(e) {
  const G = VIEW.graph, A = SCENARIO.admiralty, g = graphSvg(e), neu = function () { renderModule(); };
  return panel('Beziehungsansicht um ' + e.id, h('span', { class: 'badge' }, g.knoten + ' Knoten, ' + g.kanten + ' Verbindungen'),
    h('div', { class: 'row' },
      h('label', { for: 'gf-typ' }, 'Verbindungstyp'),
      h('select', { id: 'gf-typ', onchange: function (ev) { G.typ = ev.target.value; neu(); } },
        ['Alle'].concat(SCENARIO.verbindungstypen).map(function (x) { return h('option', { value: x, selected: x === G.typ }, x); })),
      h('label', { for: 'gf-q' }, 'Quelle bis'),
      h('select', { id: 'gf-q', onchange: function (ev) { G.quelle = ev.target.value; neu(); } },
        Object.keys(A.quelle).map(function (x) { return h('option', { value: x, selected: x === G.quelle }, x + ' ' + A.quelle[x]); })),
      h('label', { for: 'gf-i' }, 'Information bis'),
      h('select', { id: 'gf-i', onchange: function (ev) { G.info = Number(ev.target.value); neu(); } },
        Object.keys(A.information).map(function (x) { return h('option', { value: x, selected: Number(x) === G.info }, x + ' ' + A.information[x]); })),
      h('input', { type: 'checkbox', id: 'gf-erw', checked: G.erweitert, onchange: function (ev) { G.erweitert = ev.target.checked; neu(); } }),
      h('label', { for: 'gf-erw' }, 'zweite Ebene und Querverbindungen')),
    h('div', { class: 'g-wrap', 'data-scroll': 'graph' }, g.svg),
    h('div', { class: 'legend' },
      ['Person', 'Organisation', 'Ort'].map(function (t) { return h('span', null, icon(t), t); }),
      h('span', null, 'Pfeil: Richtung, Doppelpfeil: beidseitig'),
      h('span', null, 'gestrichelt: Quelle D bis F oder Information 4 bis 6'),
      h('span', null, 'Kantenbeschriftung: Typ und Admiralty-Bewertung'),
      g.unbeschriftet ? h('span', null, g.unbeschriftet + ' Querverbindungen innerhalb eines Rings ohne Beschriftung (Angabe als Tooltip und in der Verbindungstabelle)') : null),
    h('details', null, h('summary', null, 'Admiralty-Bewertung: Legende'),
      h('div', { class: 'cols' },
        tabelle(['Quelle', 'Zuverlässigkeit'], Object.keys(A.quelle).map(function (k) { return [td('nw', k), A.quelle[k]]; })),
        tabelle(['Information', 'Glaubhaftigkeit'], Object.keys(A.information).map(function (k) { return [td('nw', k), A.information[k]]; }))),
      h('p', { class: 'note' }, 'F und 6 bezeichnen fehlende Beurteilbarkeit, keine Negativbewertung; die Filter "bis" schließen sie nur in der weitesten Einstellung ein.')));
}
function galerieZeigen(e, f) {
  const inhalt = h('div', null,
    h('img', { class: 'gal-gross', src: f.bild, alt: f.text || ('Aufnahme ' + f.id) }),
    h('p', { class: 'pad' }, f.text || 'Ohne Beschriftung.'),
    h('p', { class: 'note' }, 'Aufnahme ' + f.id + ' zu ' + e.id + ' ' + e.name + ', erfasst ' + fmtZ(f.t) + '.'),
    h('div', { class: 'row' }, h('button', { type: 'button', id: 'gal-x', onclick: function () { $('dlg').close(); dispatch({ type: 'DOSSIER_FOTO_ENTFERNT', id: e.id, foto: f.id }); } }, 'Aufnahme entfernen')));
  bestaetigen('Aufnahme ' + f.id, inhalt, 'Schließen', function () {}, { klartext: 'Aufnahme ' + f.id });
}
function galerieBlock(e) {
  const liste = PROFIL.galerie[e.id] || [];
  const key = 'gal-' + e.id;
  const aufnahmen = liste.length ? h('div', { class: 'gal' }, liste.map(function (f) {
    return h('figure', { class: 'gal-item' },
      h('button', { type: 'button', class: 'gal-bild', id: 'gal-' + f.id, 'aria-label': 'Aufnahme ' + f.id + ' vergrößern', onclick: function () { galerieZeigen(e, f); } }, h('img', { src: f.bild, alt: f.text || ('Aufnahme ' + f.id) })),
      h('figcaption', null, h('span', { class: 'mono' }, f.id + ' · ' + dtg(f.t)), h('span', null, f.text || 'ohne Beschriftung')));
  })) : h('p', { class: 'note pad' }, 'Keine Aufnahmen zu diesem Dossier.');
  const hinzu = function (ev) {
    const dateien = Array.prototype.slice.call(ev.target.files || []);
    ev.target.value = '';
    const text = $('gal-text') ? $('gal-text').value : '';
    const weiter = function (i) {
      if (i >= dateien.length) { delete VIEW.draft[key]; return; }
      bildAusDatei(dateien[i], function (b) { dispatch({ type: 'DOSSIER_FOTO_HINZU', id: e.id, bild: b, text: text }); weiter(i + 1); },
        function (grund) { meldung('Aufnahme nicht übernommen: ' + grund); weiter(i + 1); }, { gross: true });
    };
    weiter(0);
  };
  return [h('h3', null, 'Aufnahmen (' + liste.length + ')'), aufnahmen,
    h('div', { class: 'row top' },
      entwurf('input', 'gal-text', key, { type: 'text', autocomplete: 'off', spellcheck: 'false', placeholder: 'Beschriftung, z. B. Observation, Zufahrt Kai 14, 21:34Z', 'aria-label': 'Beschriftung der Aufnahme', style: 'flex:1 1 260px;min-width:0' }),
      h('input', { type: 'file', id: 'gal-file', accept: 'image/*', multiple: true, 'aria-label': 'Aufnahmen hinzufügen', onchange: hinzu, style: 'max-width:260px' }))];
}
function profilPanel() {
  const n = PROFIL.eigene.length, f = Object.keys(PROFIL.galerie).reduce(function (a, k) { return a + PROFIL.galerie[k].length; }, 0);
  return panel('Profil', [h('span', { class: 'badge' }, profilGroesseKb() + ' kB')],
    h('p', { class: 'note pad' }, 'Eigene Dossiers (' + n + '), Ausgangsorte (' + PROFIL.ausgang.length + '), Bilder (' + Object.keys(PROFIL.bilder).length + '), Aufnahmen (' + f + ') und Kartenpositionen (' + Object.keys(PROFIL.koord).length +
      ') liegen im Profil und bleiben beim Zurücksetzen erhalten. Der Browser fasst rund 5 MB; ein Export sichert das Profil als Datei.'),
    h('div', { class: 'row top' },
      h('button', { type: 'button', id: 'btn-profil-ex', onclick: profilExportieren }, 'Profil sichern'),
      h('label', { for: 'file-profil' }, 'Profil laden'),
      h('input', { type: 'file', id: 'file-profil', accept: 'application/json,.json', onchange: function (ev) { const fl = ev.target.files && ev.target.files[0]; ev.target.value = ''; if (fl) profilImportieren(fl); } }),
      h('button', { type: 'button', id: 'btn-profil-leer', onclick: function () {
        bestaetigen('Profil leeren', 'Alle eigenen Dossiers, Verbindungen, Bilder, Aufnahmen und Kartenpositionen werden endgültig entfernt. Der Vorgang wird protokolliert.', 'Profil leeren',
          function () { dispatch({ type: 'PROFIL_LEEREN' }); }, { pflicht: 'Das gesamte Profil endgültig leeren.' });
      } }, 'Profil leeren')));
}
function profilExportieren() {
  profilSpeichern();
  const datei = 'fieldterminal-profil-' + dtg(new Date()) + '.json';
  try {
    const o = {}; Object.keys(PROFIL).forEach(function (k) { if (k !== 'leer') o[k] = PROFIL[k]; });
    const blob = new Blob([JSON.stringify(o)], { type: 'application/json' }), url = URL.createObjectURL(blob), a = h('a', { href: url, download: datei });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    meldung('Profil exportiert: ' + datei);
  } catch (e) { meldung('Export nicht möglich: ' + e.message); }
}
function profilImportieren(file) {
  const r = new FileReader();
  r.onerror = function () { meldung('Profil nicht lesbar.'); };
  r.onload = function () {
    let o = null;
    try { o = JSON.parse(String(r.result)); } catch (e) { /* ungültig */ }
    if (!o || o.v !== 1) { meldung('Profil abgelehnt: kein gültiges Profil.'); return; }
    dispatch({ type: 'PROFIL_IMPORT', profil: o, datei: file.name });
  };
  r.readAsText(file);
}
function renderDossier(m) {
  let e = entitaet(STATE.dossiers.auswahl);
  if (!e || !freigeschaltet(e.mission)) e = pool()[0];
  return [modKopf(m),
    h('div', { class: 'split' }, dossierListe(), h('div', null, dossierAnsicht(e), beziehungsansicht(e), profilPanel()))];
}

/* =====================================================================
   MODUL 4: SICHERE KOMMUNIKATION
   ===================================================================== */
const DR_KLASSE = { 'Routine': 's-dim', 'Priorität': 's-warn', 'Sofort': 's-crit' };
function nachrichtElement(m) {
  return h('li', { class: 'nmsg' + (m.von === 'agent' ? ' own' : m.von === 'system' ? ' sys' : '') },
    h('div', { class: 'mh' },
      h('span', { class: 'abs' }, m.absender), h('span', null, fmtZ(m.t)), h('span', null, m.id),
      m.dringlichkeit !== 'Routine' ? h('span', { class: 'label ' + DR_KLASSE[m.dringlichkeit] }, m.dringlichkeit) : h('span', null, 'Routine'),
      m.lagerelevant ? h('span', { class: 'label s-warn' }, 'lagerelevant') : null,
      m.art ? h('span', { class: 'label' }, m.art) : null,
      h('span', { class: 'st', 'data-nstatus': m.id }, 'Status: ' + m.status)),
    h('p', null, m.text));
}
/* Anzeige "Gegenstelle schreibt …": zwischen Status "gelesen" der eigenen Nachricht und Eingang der Antwort */
function aktualisiereSchreibt() {
  document.querySelectorAll('[data-schreibt]').forEach(function (el) {
    const kanal = el.getAttribute('data-schreibt');
    const offen = STATE.plan.some(function (p) { const n = p.typ === 'antwort' && p.kanal === kanal ? nachricht(p.zu) : null; return !!n && n.msg.status === 'gelesen'; });
    const war = el.hidden;
    el.hidden = !offen;
    el.textContent = offen ? kanalDef(kanal).gegenstelle + ' schreibt …' : '';
    if (offen && war && el.parentNode) el.parentNode.scrollTop = el.parentNode.scrollHeight;
  });
}
function sendeNachricht() {
  const akt = STATE.komm.aktiv, t = ($('km-text').value || '').trim();
  if (!t) { $('km-hinweis').textContent = 'Nachricht ohne Text wird nicht gesendet.'; return; }
  dispatch({ type: 'NACHRICHT_GESENDET', kanal: akt, text: t, dringlichkeit: $('km-dr').value });
}
function renderKomm(m) {
  const K = SCENARIO.kommunikation, akt = STATE.komm.aktiv, kd = kanalDef(akt), c = STATE.komm.kanaele[akt];
  const alter = Math.floor(kd.schluesselalterStd + Math.max(0, Date.now() - Date.parse(STATE.t0)) / 3600000);
  const dr = VIEW.draft['km-dr'] || 'Routine', gesamt = ungelesenGesamt();
  return [
    modKopf(m),
    h('div', { class: 'komm' },
      panel('Kanäle', h('span', { class: 'badge' + (gesamt ? ' on' : '') }, gesamt + ' ungelesen'),
        h('ul', { class: 'elist klist' }, K.kanaele.map(function (k) {
          const kc = STATE.komm.kanaele[k.id], letzte = kc.nachrichten[kc.nachrichten.length - 1];
          return h('li', null, h('button', { type: 'button', id: 'kn-' + k.id, 'aria-current': k.id === akt ? 'true' : null,
              onclick: function () { dispatch({ type: 'KANAL_GEOEFFNET', kanal: k.id }); } },
            h('span', { class: 'nm' }, k.name),
            h('span', { class: 'badge' + (kc.ungelesen ? ' on' : '') }, kc.ungelesen + ' ungelesen'),
            h('span', { class: 'sub' }, kanalDef(k.id).gegenstelle + ' · ' + kc.nachrichten.length + ' Nachrichten · zuletzt ' + (letzte ? dtg(letzte.t) : '–'))));
        })),
        null),
      panel('Kanal ' + kd.name, h('span', { class: 'badge' }, 'Gegenstelle ' + kd.gegenstelle),
        h('p', { class: 'note mono sec' }, 'Verschlüsselung: ' + kd.verfahren + ' · Schlüsselalter: ' + alter + ' h · Kanalintegrität: ' + kd.integritaet),
        STATE.funkstille.aktiv ? h('p', { class: 'note sec' }, h('span', { class: 'label s-warn' }, 'Funkstille'), ' ' + (KM().funkstille ? KM().funkstille.text : 'Anordnung des Handlers') + '. Kein Versand.') : null,
        h('ol', { class: 'thread', 'data-scroll': 'thread-' + akt + '-' + c.nachrichten.length, 'data-bottom': '', tabindex: '0', 'aria-label': 'Nachrichtenverlauf Kanal ' + kd.name },
          c.nachrichten.map(nachrichtElement), h('li', { class: 'nmsg schreibt', 'data-schreibt': akt, hidden: true }))),
      panel('Nachricht an ' + kd.gegenstelle, null,
        h('div', { class: 'pad' },
          entwurf('textarea', 'km-text', 'km-' + akt, { rows: '6', 'aria-label': 'Nachricht an ' + kd.gegenstelle, placeholder: 'Nachricht an ' + kd.gegenstelle, title: 'Strg+Eingabe sendet', spellcheck: 'false',
            onkeydown: function (ev) { if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); sendeNachricht(); } } })),
        h('div', { class: 'row bausteine' }, SCENARIO.kommunikation.textbausteine.map(function (b, i) {
          return h('button', { type: 'button', class: 'link', id: 'tb-' + i, title: 'Text übernehmen: ' + b.text.replace('  ', ' … '), onclick: function () {
            const ta = $('km-text'), luecke = b.text.indexOf('  ');           /* nur vorbefüllen, nicht senden */
            ta.value = b.text; VIEW.draft['km-' + akt] = b.text; ta.focus();
            if (luecke >= 0) ta.setSelectionRange(luecke + 1, luecke + 1);
          } }, b.titel);
        })),
        h('div', { class: 'row' },
          h('label', { for: 'km-dr' }, 'Dringlichkeit'),
          h('select', { id: 'km-dr', onchange: function (ev) { VIEW.draft['km-dr'] = ev.target.value; } },
            DRINGLICHKEIT.map(function (x) { return h('option', { value: x, selected: x === dr }, x); })),
          h('button', { type: 'button', id: 'btn-send', onclick: sendeNachricht }, 'Senden')),
        h('p', { class: 'note', id: 'km-hinweis', role: 'status' }, '')))
  ];
}

/* =====================================================================
   MODUL 5: PANIC / EXTRAKTION
   ===================================================================== */
const ANF_STUFEN = ['keine', 'angefordert', 'bestätigt', 'in Durchführung'];
function pruefeAnforderung() {
  const X = STATE.extraktion, wahl = VIEW.draft['x-opt'], text = ($('x-begr').value || '').trim(), hin = $('x-hinweis');
  if (!wahl) { hin.textContent = 'Keine Option gewählt.'; return; }
  if (!text) { hin.textContent = 'Begründung fehlt.'; return; }
  hin.textContent = '';
  const o = optionDef(wahl), ort = ortText(STATE.agent.checkin);
  bestaetigen('Extraktionsanforderung bestätigen',
    [h('dl', { class: 'fields wide' },
      feld('Option', optionText(o.id)), feld('Geschätzte Vorlaufzeit', o.vorlauf),
      feld('Begründung', text, 'full'),
      feld('Bedrohungsstufe', 'Stufe ' + X.stufe + ' – ' + SCENARIO.bedrohungsstufen[X.stufe]),
      feld('Letzter bekannter Standort', ort + ', Stand ' + fmtZ(STATE.agent.checkin.t)),
      feld('Standortfreigabe', X.standortfreigabe ? 'ein' : 'aus'),
      feld('Freigabe', SCENARIO.extraktion.freigabe.durch + ', Kanal Handler', 'full'))],
    'Anforderung absenden',
    function () { dispatch({ type: 'EXTRAKTION_ANGEFORDERT', option: o.id, begruendung: text }); const b = $('btn-xrueck'); if (b) b.focus(); },
    { pflicht: 'Ich bestätige die Anforderung von ' + optionText(o.id) + ' ausdrücklich.',
      klartext: optionText(o.id) + ', Vorlauf ' + o.vorlauf + '. Begründung: ' + text + ' Anforderung absenden?' });
}
function renderExtraktion(m) {
  const X = STATE.extraktion, r = X.anforderung, E = SCENARIO.extraktion, G = E.freigabe.durch;
  const idx = ANF_STUFEN.indexOf(r.status), aktiv = r.status !== 'keine', wahl = VIEW.draft['x-opt'] || null;
  const ort = ortText(STATE.agent.checkin);
  const krit = STATE.log.filter(function (e) { return e.krit; }).slice(-12).reverse();
  const aktionen = [];
  if (r.durch === 'Agent' && (r.status === 'angefordert' || r.status === 'bestätigt')) {
    aktionen.push(h('button', { type: 'button', id: 'btn-xrueck', onclick: function () {
      bestaetigen('Anforderung zurückziehen', optionText(r.option) + ' wird zurückgezogen. Der operative Status kehrt zum Stand vor der Anforderung zurück; der Handler erhält eine Systemnachricht.',
        'Zurückziehen', function () { dispatch({ type: 'EXTRAKTION_ZURUECKGEZOGEN' }); });
    } }, 'Anforderung zurückziehen'));
  }
  const hinweis = r.status === 'keine' ? 'Keine Anforderung offen.'
    : r.status === 'angefordert' ? 'Freigabe durch ' + G + ' ausstehend.'
    : r.status === 'bestätigt' ? (r.durch === 'Gegenstelle' ? 'Durch Gegenstelle eingeleitet. Aufhebung nur durch Gegenstelle.' : 'Freigabe liegt vor. Rücknahme bis zum Beginn der Durchführung möglich.')
    : 'In Durchführung. Rücknahme ausgeschlossen.';
  return [
    modKopf(m),
    h('div', { class: 'cols' },
      panel('Bedrohungslage', null,
        h('dl', { class: 'fields' },
          feld('Bedrohungsstufe', [stufeLabel(X.stufe), ' von 5']),
          feld('Letzte Bewertung', fmtZ(X.bewertet)),
          feld('Operativer Status', statusLabel(STATE.agent.status)),
          feld('Lagerelevante Ereignisse', String(X.begruendung.length - 1))),
        h('h3', null, 'Begründung (neueste zuerst)'),
        tabelle(['Zeit (UTC)', 'Quelle', 'Ereignis'], X.begruendung.slice().reverse().slice(0, 4).map(function (b) {
          return [td('nw', fmtZ(b.t)), b.quelle, td('txt', b.text)];
        }))),
      panel('Status der Anforderung', null,
        h('ol', { class: 'steps', 'aria-label': 'Schrittanzeige Anforderung' }, ANF_STUFEN.map(function (st, i) {
          return h('li', { 'aria-current': i === idx ? 'step' : null, class: i < idx ? 'done' : '' },
            h('span', { class: 'n' }, (i + 1) + '. ' + st),
            h('span', { class: 'z' }, i < idx ? 'durchlaufen' : i === idx ? 'aktueller Stand' : 'offen'));
        })),
        aktiv ? h('dl', { class: 'fields' },
          feld('Option', optionText(r.option)), feld('Geschätzte Vorlaufzeit', optionDef(r.option).vorlauf),
          feld('Angefordert durch', r.durch), feld('Zeitpunkt', fmtZ(r.t)),
          feld('Freigabe Handler', r.freigabe === 'erteilt' ? [h('span', { class: 'label s-accent' }, 'erteilt'), ' ' + fmtZ(r.freigabeT)] : h('span', { class: 'label s-warn' }, 'ausstehend')),
          feld('Begründung', r.begruendung, 'full')) : null,
        h('p', { class: 'note' }, hinweis),
        aktionen.length ? h('div', { class: 'row top' }, aktionen) : null)),
    h('div', { class: 'cols' },
      panel('Extraktionsoption und Begründung', null,
        h('fieldset', { class: 'opts', disabled: aktiv },
          h('legend', { class: 'vh' }, 'Extraktionsoption'),
          KM().extraktion.optionen.map(function (o) {
            return h('label', { class: 'opt', for: 'xo-' + o.id },
              h('input', { type: 'radio', name: 'xopt', id: 'xo-' + o.id, value: o.id, checked: wahl === o.id, onchange: function () { VIEW.draft['x-opt'] = o.id; } }),
              h('span', { class: 'mono' }, '(' + o.id + ')'), h('span', null, o.titel), h('span', { class: 'mono dim' }, 'Vorlauf ' + o.vorlauf),
              h('span', { class: 'od' }, o.text));
          }),
          h('div', { class: 'pad' }, entwurf('textarea', 'x-begr', 'x-begr', { rows: '3', 'aria-label': 'Begründung der Anforderung', placeholder: 'Begründung: Anlass, Zeitpunkt, Bewertung.', spellcheck: 'false' })),
          h('div', { class: 'row' },
            h('button', { type: 'button', id: 'btn-xpruef', onclick: pruefeAnforderung }, 'Anforderung prüfen'),
            h('span', { id: 'x-hinweis', role: 'status' }, aktiv ? 'Es besteht bereits eine Anforderung (' + r.status + ').' : ''))),
        h('p', { class: 'note' }, 'Freigabe durch ' + G + ' über Kanal Handler.')),
      panel('Standort', null,
        h('dl', { class: 'fields' },
          feld('Standortfreigabe', h('span', { class: 'label ' + (X.standortfreigabe ? 's-accent' : 's-dim') }, X.standortfreigabe ? 'ein' : 'aus')),
          feld('Letzter bekannter Standort', ort),
          feld('Zeitstempel (letzter Check-in)', fmtZ(STATE.agent.checkin.t)),
          feld('Nächstes Meldefenster', h('span', { 'data-melde': '' }, meldeText(Date.now())))),
        h('div', { class: 'row top' },
          h('button', { type: 'button', id: 'btn-ort', 'aria-pressed': X.standortfreigabe ? 'true' : 'false',
            onclick: function () { dispatch({ type: 'STANDORTFREIGABE_GESETZT', ein: !X.standortfreigabe }); } }, X.standortfreigabe ? 'Standortfreigabe ausschalten' : 'Standortfreigabe einschalten')),
        h('p', { class: 'note' }, 'Übermittelt wird der Standort des letzten Check-ins.'))),
    panel('Letzte kritische Ereignisse', h('span', { class: 'badge' }, krit.length + ' angezeigt'),
      tabelle(['Zeit (UTC)', 'Modul', 'Aktion', 'Detail'], krit.map(function (e) {
        return [td('nw', fmtZ(e.t)), td('nw', e.modul), e.aktion, td('txt', e.detail)];
      }), 'Keine kritischen Ereignisse im Protokoll.'))
  ];
}

/* Erststart (vorlauf): Ansichten ohne Bezug zu einem noch nicht angenommenen Auftrag */
function leerAnsicht(m, titel, text) { return [modKopf(m), panel(titel, null, h('p', { class: 'note pad' }, text))]; }
function renderProfilVorlauf(m) {
  const A = SCENARIO.agent;
  return [
    modKopf(m),
    h('div', { class: 'cols' },
      panel('Agentenkennung', null,
        h('dl', { class: 'fields' },
          feld('Codename', A.codename), feld('Interne ID', A.id), feld('Freigabestufe', A.freigabe),
          feld('Auftrag', 'kein laufender Auftrag'), feld('Abgelehnte Aufträge', String(STATE.agent.ablehnungen)),
          feld('Operativer Status', statusLabel(STATE.agent.status))),
        h('div', { class: 'row top' },
          h('label', { for: 'sel-status' }, 'Status setzen'),
          h('select', { id: 'sel-status', onchange: function (ev) { dispatch({ type: 'STATUS_GESETZT', status: ev.target.value }); } },
            STATUS_LISTE.map(function (x) { return h('option', { value: x, selected: x === STATE.agent.status, disabled: x === 'Ruhend' && !!LM() }, x); })))),
      panel('Meldewesen', null, h('p', { class: 'note pad' }, STATE.agent.status === 'Ruhend'
        ? 'Status Ruhend: Der Handler sendet keine Meldungen und weist keinen Auftrag zu. Mit "Standby" oder "Aktiv" geht das Terminal in Bereitschaft.'
        : 'Kein laufender Auftrag. Legende, Standort und Meldefenster werden mit der Annahme eines Auftrags gesetzt.'))),
    ausgangPanel(),
    h('div', { class: 'cols' },
      panel('Notizen', null, h('div', { class: 'pad' }, autosaveFeld('ta-notizen', 'notizen', 'Notizen'))),
      panel('Operative Einschränkungen', null, h('div', { class: 'pad' }, autosaveFeld('ta-einschr', 'einschraenkungen', 'Operative Einschränkungen'))))
  ];
}
function renderMissionVorlauf(m) {
  const neu = zugewiesene();
  return [modKopf(m), STATE.serie.ende ? abschlussansicht() : null,
          neu ? auftragskarte(neu) : panel('Kein Auftrag zugewiesen', null, h('p', { class: 'note pad' }, STATE.agent.status === 'Ruhend' ? 'Status Ruhend: keine Zuweisung. Zum Empfang auf Standby oder Aktiv setzen.' : 'Zuweisung durch den Handler abwarten.'))];
}
function nachbereitungPanel() {
  const nb = STATE.nachbereitung;
  if (!nb) return null;
  const T = SCENARIO.serie.nachbereitung, def = missionDef(nb.mission), fertig = T.filter(function (x) { return !!nb.erledigt[x.id]; }).length;
  return panel('Nachbereitung ' + opText(def), h('span', { class: 'badge on' }, fertig + ' von ' + T.length + ' erledigt'),
    h('ul', { class: 'nachb' }, T.map(function (x, i) {
      const t = nb.erledigt[x.id], gesperrt = x.id === 'nachbesprechung' && T.some(function (y) { return y.id !== x.id && !nb.erledigt[y.id]; });
      return h('li', { class: t ? 'done' : '' },
        h('span', { class: 'mono' }, String(i + 1)),
        h('span', { class: 'nt' }, h('strong', null, x.titel), ' ', x.text),
        h('span', { class: 'zt' }, t ? 'erledigt · ' + fmtZ(t)
          : h('button', { type: 'button', id: 'nb-' + x.id, disabled: gesperrt, onclick: function () {
              bestaetigen('Nachbereitung: ' + x.titel, x.text, 'Durchführen', function () { dispatch({ type: 'NACHBEREITUNG_SCHRITT', id: x.id }); },
                { klartext: x.titel + ' durchführen?' });
            } }, 'Durchführen')));
    })),
    h('p', { class: 'note pad' }, 'Nach dem letzten Schritt werden die Kanalverläufe gelöscht, Notizen zurückgesetzt und die Dossiers archiviert. Danach folgt der nächste Auftrag.'));
}
/* =====================================================================
   MODUL 6: LAGEKARTE
   Offline-Karte in Mercator-Projektion: Länderumrisse (karte.js), Flüsse, Seen, Siedlungen, Fernstraßen und Orte (karte2.js),
   Gitternetz, Standorte, Orte, Akteure, Anreiseroute und Zeitschieber für die Zeitfenster der Mission.
   Optional (standardmäßig aus): Online-Kacheln mit Straßen und Namen; dabei lädt der Browser Kacheln vom Anbieter.
   Ein Klick auf einen Akteur öffnet sein Dossier. Kartenpositionen setzt der Agent im Dossier (Koordinaten oder Klick auf die Karte).
   ===================================================================== */
const KW = 960, KH = 540, DEG = Math.PI / 180;
VIEW.karte = { lat: 50.5, lon: 8, zoom: 5, dt: 0, auswahl: null, pick: null, init: false, anbieter: 'osm', url: '', dunkel: true,
  ebenen: { ausgang: true, standorte: true, orte: true, akteure: true, fenster: true, route: true, gelaende: true, strassen: true, namen: true, kacheln: false } };
try {
  const gespeichert = JSON.parse(window.localStorage.getItem(STORAGE_KEY + '.kartenwahl') || 'null');
  if (gespeichert && typeof gespeichert === 'object') {
    Object.keys(VIEW.karte.ebenen).forEach(function (k) { if (typeof gespeichert.ebenen[k] === 'boolean') VIEW.karte.ebenen[k] = gespeichert.ebenen[k]; });
    if (gespeichert.anbieter === 'eigen' || gespeichert.anbieter === 'osm') VIEW.karte.anbieter = gespeichert.anbieter;
    if (typeof gespeichert.url === 'string') VIEW.karte.url = gespeichert.url;
    if (typeof gespeichert.dunkel === 'boolean') VIEW.karte.dunkel = gespeichert.dunkel;
  }
} catch (e) { /* ohne gespeicherte Wahl */ }
function karteWahlSichern() { try { window.localStorage.setItem(STORAGE_KEY + '.kartenwahl', JSON.stringify({ ebenen: VIEW.karte.ebenen, anbieter: VIEW.karte.anbieter, url: VIEW.karte.url, dunkel: VIEW.karte.dunkel })); } catch (e) { /* ohne Speicher */ } }
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
  const k = SCENARIO.karte && SCENARIO.karte.koord ? SCENARIO.karte.koord[id] : null;
  return k || null;
}
function karteMarker() {
  const Z = VIEW.karte.ebenen, def = STATE.vorlauf ? null : KM(), out = [];
  if (Z.ausgang) PROFIL.ausgang.forEach(function (x) { if (x.ll) out.push({ id: x.id, kat: 'ausgang', name: x.name, ll: x.ll, art: x.art }); });
  if (def && Z.standorte) def.standorte.forEach(function (st) {
    const ll = karteKoord(st.id);
    if (ll) out.push({ id: st.id, kat: 'standort', name: st.name, ll: ll, land: st.land });
  });
  const zusatzIds = {};
  if (def) (MS(def.id).zusatz || []).forEach(function (x) { if (x.urteil !== 'abgelehnt') zusatzIds[x.id] = true; });
  pool().forEach(function (e) {
    const ll = karteKoord(e.id);
    if (!ll) return;
    if (e.typ === 'Ort') { if (Z.orte) out.push({ id: e.id, kat: 'ort', typ: 'Ort', name: e.name, ll: ll, land: e.land, entitaet: true, stufe: bedrohung(e).stufe }); }
    else if (Z.akteure) out.push({ id: e.id, kat: 'figur', typ: e.typ, name: e.name, ll: ll, land: e.land, entitaet: true, stufe: bedrohung(e).stufe, zusatz: zusatzIds[e.id] || false });
  });
  return out;
}
function karteFenster() {
  const def = STATE.vorlauf ? null : KM();
  if (!def) return [];
  const ms = MS(def.id), T = Date.now() + VIEW.karte.dt * 3600000, zuord = (SCENARIO.karte && SCENARIO.karte.fensterOrt) || {};
  return def.zeitfenster.map(function (w) {
    const z = ms.zeitfenster[w.id];
    if (!z) return null;
    const von = Date.parse(z.von), bis = Date.parse(z.bis);
    return { id: w.id, titel: w.titel, von: von, bis: bis, ort: zuord[w.id] || null, zustand: bis < T ? 'abgelaufen' : von <= T ? 'aktiv' : 'ausstehend', T: T };
  }).filter(Boolean);
}
function karteHerkunft() {
  const def = STATE.vorlauf ? null : KM(), an = STATE.anreise;
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
  const K = VIEW.karte, def = STATE.vorlauf ? null : KM();
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
function kachelURL(z, x, y) {
  const u = VIEW.karte.url.trim();
  if (VIEW.karte.anbieter === 'eigen' && /^https:\/\//.test(u) && u.indexOf('{z}') >= 0) return u.replace('{z}', z).replace('{x}', x).replace('{y}', y);
  return 'https://tile.openstreetmap.org/' + z + '/' + x + '/' + y + '.png';
}
function kachelnZeichnen(P, kids) {
  const K = VIEW.karte, z = Math.max(0, Math.min(19, Math.round(K.zoom))), n = Math.pow(2, z), ts = P.Wd / n;
  const tx = function (lon) { return Math.floor((lon + 180) / 360 * n); };
  const ty = function (lat) { const r = Math.max(-85, Math.min(85, lat)) * DEG; return Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n); };
  const x0 = tx(P.lon(0)), x1 = tx(P.lon(KW)), y0 = Math.max(0, ty(P.lat(0))), y1 = Math.min(n - 1, ty(P.lat(KH)));
  if ((x1 - x0 + 1) * (y1 - y0 + 1) > 60) return;
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
    const lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n))) / DEG, xm = ((x % n) + n) % n;
    kids.push(s('image', { href: kachelURL(z, xm, y), x: P.px(x / n * 360 - 180).toFixed(2), y: P.py(lat).toFixed(2), width: (ts + 0.6).toFixed(2), height: (ts + 0.6).toFixed(2), class: 'k-kachel' + (VIEW.karte.dunkel ? ' dunkel' : ''), preserveAspectRatio: 'none' }));
  }
}
function zeichneKarte(svg) {
  const K = VIEW.karte, P = karteProj(), Z = K.ebenen, zm = K.zoom;
  const vb = { lonMin: P.lon(0), lonMax: P.lon(KW), latMin: P.lat(KH), latMax: P.lat(0) };
  const kids = [s('rect', { x: 0, y: 0, width: KW, height: KH, class: 'k-meer' })];
  const E = karteEbenenDaten();
  if (Z.kacheln) kachelnZeichnen(P, kids);
  else {
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
      if (a) kids.push(s('path', { d: a, class: 'k-strasse' }));
    }
  }
  /* Gitternetz */
  const grad = 360 / P.Wd, gs = karteSchritt([0.0005, 0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 30], 90, 1 / grad);
  for (let lo = Math.ceil(vb.lonMin / gs) * gs; lo <= vb.lonMax; lo += gs) kids.push(s('line', { x1: P.px(lo), y1: 0, x2: P.px(lo), y2: KH, class: 'k-gitter' }));
  for (let la = Math.ceil(vb.latMin / gs) * gs; la <= vb.latMax; la += gs) kids.push(s('line', { x1: 0, y1: P.py(la), x2: KW, y2: P.py(la), class: 'k-gitter' }));
  /* Ortsnamen */
  if (Z.namen && !Z.kacheln) {
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
  /* Route */
  const hk = Z.route ? karteHerkunft() : null;
  if (hk) {
    const x1 = P.px(hk.von[1]), y1 = P.py(hk.von[0]), x2 = P.px(hk.nach[1]), y2 = P.py(hk.nach[0]);
    kids.push(s('line', { x1: x1, y1: y1, x2: x2, y2: y2, class: 'k-route' }), s('circle', { cx: x1, cy: y1, r: 4, class: 'k-start' }));
    const links = x1 > KW - 200;
    kids.push(s('text', { x: links ? x1 - 7 : x1 + 7, y: y1 - 8, class: 'k-text', 'text-anchor': links ? 'end' : 'start' }, hk.name + ' · Abfahrt'));
    kids.push(s('text', { x: (x1 + x2) / 2 + 6, y: (y1 + y2) / 2 - 6, class: 'k-text dim' }, hk.plan.mittelName + ', ' + dauerText(hk.plan.dauerMin)));
  }
  /* Zeitfenster-Ringe */
  (Z.fenster ? karteFenster() : []).forEach(function (w) {
    const ll = w.ort && karteKoord(w.ort);
    if (ll) kids.push(s('circle', { cx: P.px(ll[1]), cy: P.py(ll[0]), r: w.zustand === 'aktiv' ? 17 : 14, class: 'k-fenster ' + w.zustand }));
  });
  /* Markierungen */
  const marker = karteMarker(), ci = STATE.agent.checkin && STATE.agent.checkin.standortId;
  marker.forEach(function (m) {
    const x = P.px(m.ll[1]), y = P.py(m.ll[0]);
    if (x < -20 || x > KW + 20 || y < -20 || y > KH + 20) return;
    const sel = K.auswahl === m.id, hoch = m.stufe >= 4 ? ' hoch' : '';
    const sym = m.kat === 'ausgang' ? [s('polygon', { points: [x, y - 6, x + 5.5, y + 4, x - 5.5, y + 4].join(' '), class: 'k-m ausgang' })] : m.kat === 'standort' ? [s('circle', { cx: x, cy: y, r: 5, class: 'k-m standort' }), s('line', { x1: x - 3, y1: y, x2: x + 3, y2: y, class: 'k-kreuz' }), s('line', { x1: x, y1: y - 3, x2: x, y2: y + 3, class: 'k-kreuz' })]
      : (m.typ === 'Organisation' ? [s('rect', { x: x - 4.5, y: y - 4.5, width: 9, height: 9, class: 'k-m ' + m.kat + hoch })]
      : (m.typ === 'Ort' ? [s('polygon', { points: [x, y - 6, x + 6, y, x, y + 6, x - 6, y].join(' '), class: 'k-m ort' + hoch })]
      : [s('circle', { cx: x, cy: y, r: 4.5, class: 'k-m ' + m.kat + hoch })]));
    const g = s('g', { class: 'k-marker', 'data-id': m.id, tabindex: '0', role: 'button', 'aria-label': m.id + ' ' + m.name + (m.entitaet ? ', Dossier öffnen' : '') });
    g.appendChild(s('title', null, m.id + ' ' + m.name));
    if (m.id === ci) g.appendChild(s('circle', { cx: x, cy: y, r: 10, class: 'k-checkin' }));
    if (m.zusatz) g.appendChild(s('circle', { cx: x, cy: y, r: 9, class: 'k-zusatz' }));
    if (sel) g.appendChild(s('circle', { cx: x, cy: y, r: 12, class: 'k-sel' }));
    sym.forEach(function (e) { g.appendChild(e); });
    g.appendChild(s('circle', { cx: x, cy: y, r: 12, class: 'k-treffer' }));
    if (sel || zm >= 6.5 || m.kat === 'standort') g.appendChild(s('text', { x: x + 9, y: y + 4, class: 'k-text' }, zm >= 9 || sel ? m.id + ' ' + m.name : m.id));
    kids.push(g);
  });
  /* Maßstab, Quellenangabe, Rahmen */
  const kmProPx = 40075.017 * Math.cos(K.lat * DEG) / P.Wd, km = karteSchritt([0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000], 90, 1 / kmProPx), len = km / kmProPx;
  kids.push(s('line', { x1: 16, y1: KH - 18, x2: 16 + len, y2: KH - 18, class: 'k-mass' }), s('text', { x: 16, y: KH - 24, class: 'k-text' }, km < 1 ? Math.round(km * 1000) + ' m' : km + ' km'));
  kids.push(s('text', { x: KW - 12, y: KH - 10, class: 'k-text dim', 'text-anchor': 'end' },
    (Z.kacheln ? (K.anbieter === 'osm' ? '© OpenStreetMap-Mitwirkende' : 'Kacheln: eigener Anbieter') + ' · ' : 'Natural Earth · ') + 'Breite ' + K.lat.toFixed(4) + ', Länge ' + K.lon.toFixed(4) + ' · Zoom ' + K.zoom.toFixed(1)));
  svg.replaceChildren.apply(svg, kids);
}
function karteFensterListe() {
  const liste = karteFenster(), K = VIEW.karte, T = Date.now() + K.dt * 3600000;
  const wrap = $('k-fenster');
  if (!wrap) return;
  wrap.replaceChildren(tabelle(['ID', 'Fenster', 'Ort', 'Zustand'], liste.map(function (w) {
    const lbl = w.zustand === 'aktiv' ? 's-accent' : w.zustand === 'ausstehend' ? 's-warn' : 's-dim';
    const rest = w.zustand === 'aktiv' ? 'noch ' + dauerText((w.bis - T) / 60000) : w.zustand === 'ausstehend' ? 'in ' + dauerText((w.von - T) / 60000) : 'seit ' + dauerText((T - w.bis) / 60000);
    return [td('nw', w.id), td('txt', w.titel + ' (' + fmtZ(w.von).slice(0, 16) + 'Z bis ' + fmtZ(w.bis).slice(0, 16) + 'Z)'),
      w.ort && karteKoord(w.ort) ? h('button', { type: 'button', class: 'link', onclick: function () { karteWaehlen(w.ort, true); } }, w.ort) : td('dim', 'ohne Ort'),
      td('nw', [h('span', { class: 'label ' + lbl }, w.zustand), ' ' + rest])];
  }), STATE.vorlauf ? 'Kein laufender Auftrag, daher keine Zeitfenster.' : 'Keine Zeitfenster.'));
  const z = $('k-zeit');
  if (z) z.textContent = (K.dt === 0 ? 'jetzt' : (K.dt > 0 ? '+' : '−') + Math.abs(K.dt) + ' h') + ' · ' + fmtZ(T).slice(0, 16) + 'Z';
}
function karteAuswahlAnzeige() {
  const box = $('k-auswahl'), id = VIEW.karte.auswahl;
  if (!box) return;
  const m = karteMarker().find(function (x) { return x.id === id; });
  if (!m) { box.replaceChildren(h('p', { class: 'note pad' }, 'Einen Akteur anklicken öffnet sein Dossier; ein Standort zeigt hier Einzelheiten.')); return; }
  const e = m.entitaet ? entitaet(m.id) : null, w = karteFenster().filter(function (x) { return x.ort === m.id; });
  box.replaceChildren(h('dl', { class: 'fields' },
    feld('Kennung', m.id), feld('Bezeichnung', m.name), feld('Art', m.kat === 'ausgang' ? 'Ausgangsort (privat)' : m.kat === 'standort' ? 'Standort des Auftrags' : (e ? e.typ + (e.mission === 'STD' ? ' (Standard-Dossier)' : '') : '–')),
    feld('Staat', m.land ? [land(m.land), ' ' + (SCENARIO.laender[m.land] || '')] : '–'),
    feld('Koordinaten (ungefähr)', m.ll[0].toFixed(4) + ', ' + m.ll[1].toFixed(4)),
    w.length ? feld('Zeitfenster', w.map(function (x) { return x.id + ' (' + x.zustand + ')'; }).join(', ')) : null,
    e ? feld('Dossier', dossierLink(e, 'Lagekarte', 'k-dl-' + e.id)) : null));
}
function karteWaehlen(id, zentrieren) {
  const K = VIEW.karte, m = karteMarker().find(function (x) { return x.id === id; }) || (karteKoord(id) ? { ll: karteKoord(id) } : null);
  K.auswahl = id;
  if (zentrieren && m) { K.lat = m.ll[0]; K.lon = m.ll[1]; K.zoom = Math.max(K.zoom, 11); }
  const svg = $('k-svg');
  if (svg) zeichneKarte(svg);
  karteAuswahlAnzeige();
}
function karteSteuerung(svg) {
  const K = VIEW.karte;
  const neu = function () { zeichneKarte(svg); };
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
    const Wd = 256 * Math.pow(2, K.zoom);
    K.lon -= dx / Wd * 360; K.lat = Math.max(-80, Math.min(80, mercInv(merc(K.lat) + dy * 2 * Math.PI / Wd)));
    neu();
  });
  const klick = function (ev) {
    if (K.pick) {                                                      /* Position für ein Dossier festlegen */
      const c = koordUm(ev), P = karteProj(), id = K.pick;
      K.pick = null;
      dispatch({ type: id.indexOf('AO-') === 0 ? 'AUSGANG_ORT' : 'DOSSIER_ORT', id: id, ll: [P.lat(c[1]), P.lon(c[0])] });
      K.auswahl = id;
      renderModule();
      return;
    }
    const t = ev.target && ev.target.closest ? ev.target.closest('.k-marker') : null;
    const id = t ? t.getAttribute('data-id') : null;
    const e = id ? entitaet(id) : null;
    if (e) {
      dispatch({ type: 'DOSSIER_GEOEFFNET', id: e.id, navigieren: true, ueber: 'Lagekarte' });
      const ti = $('mod-title'); if (ti) ti.focus();
    } else karteWaehlen(id, false);
  };
  svg.addEventListener('pointerup', function (ev) { const z = zug; zug = null; if (z && !z.bewegt) klick({ target: z.ziel, clientX: ev.clientX, clientY: ev.clientY }); });
  svg.addEventListener('pointercancel', function () { zug = null; });
  svg.addEventListener('dblclick', function (ev) { if (K.pick) return; const c = koordUm(ev); zoomUm(1, c[0], c[1]); });
  svg.addEventListener('keydown', function (ev) {
    const t = ev.target && ev.target.closest ? ev.target.closest('.k-marker') : null;
    if (t && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); klick({ target: t, clientX: 0, clientY: 0 }); }
  });
  return { zoom: function (dz) { zoomUm(dz, KW / 2, KH / 2); }, neu: neu };
}
function renderKarte(m) {
  const K = VIEW.karte, def = STATE.vorlauf ? null : KM();
  if (!K.init) { karteGrundansicht(); K.init = true; }
  const svg = s('svg', { id: 'k-svg', class: 'karte-svg' + (K.pick ? ' pick' : ''), viewBox: '0 0 ' + KW + ' ' + KH, role: 'application', 'aria-label': 'Lagekarte, mit Maus ziehen und Mausrad zoomen' });
  const st = karteSteuerung(svg);
  zeichneKarte(svg);
  const knopf = function (id, text, fn) { return h('button', { type: 'button', id: id, onclick: fn }, text); };
  const ebene = function (key, text) {
    return h('span', { class: 'row-item' },
      h('input', { type: 'checkbox', id: 'ke-' + key, checked: K.ebenen[key], onchange: function (ev) { K.ebenen[key] = ev.target.checked; karteWahlSichern(); st.neu(); karteAuswahlAnzeige(); karteFensterListe(); if (key === 'kacheln') renderModule(); } }),
      h('label', { for: 'ke-' + key }, text));
  };
  const pickE = K.pick ? (K.pick.indexOf('AO-') === 0 ? (PROFIL.ausgang.find(function (x) { return x.id === K.pick; }) || null) : entitaet(K.pick)) : null;
  const kopf = [knopf('k-plus', '+', function () { st.zoom(0.8); }), knopf('k-minus', '−', function () { st.zoom(-0.8); }),
    knopf('k-raum', 'Einsatzraum', function () { karteGrundansicht(); st.neu(); }),
    knopf('k-eu', 'Europa', function () { K.lat = 50; K.lon = 10; K.zoom = 4.4; st.neu(); }),
    knopf('k-welt', 'Welt', function () { K.lat = 25; K.lon = 20; K.zoom = 1.9; st.neu(); })];
  const zeit = h('input', { type: 'range', id: 'k-dt', min: '-12', max: '96', step: '1', value: String(K.dt), 'aria-label': 'Zeitpunkt relativ zu jetzt in Stunden',
    oninput: function (ev) { K.dt = Number(ev.target.value); st.neu(); karteFensterListe(); karteAuswahlAnzeige(); } });
  const res = [
    modKopf(m),
    panel('Lagekarte', null,
      pickE ? h('div', { class: 'row k-pickbar' }, h('span', null, 'Klick auf die Karte setzt die Position von ' + pickE.id + ' ' + pickE.name + '.'),
        knopf('k-pick-x', 'Abbrechen', function () { K.pick = null; renderModule(); })) : null,
      h('div', { class: 'row' }, kopf),
      h('div', { class: 'karte-wrap' }, svg),
      h('div', { class: 'legend' },
        h('span', null, s('svg', { class: 'ico', viewBox: '0 0 14 14' }, s('polygon', { points: '7,1 12.5,11 1.5,11', class: 'k-m ausgang' })), 'Ausgangsort'),
        h('span', null, s('svg', { class: 'ico', viewBox: '0 0 14 14' }, s('circle', { cx: 7, cy: 7, r: 5, class: 'k-m standort' })), 'Standort'),
        h('span', null, s('svg', { class: 'ico', viewBox: '0 0 14 14' }, s('polygon', { points: '7,1 13,7 7,13 1,7', class: 'k-m ort' })), 'Ort'),
        h('span', null, s('svg', { class: 'ico', viewBox: '0 0 14 14' }, s('circle', { cx: 7, cy: 7, r: 5, class: 'k-m figur' })), 'Person'),
        h('span', null, s('svg', { class: 'ico', viewBox: '0 0 14 14' }, s('rect', { x: 2, y: 2, width: 10, height: 10, class: 'k-m figur' })), 'Organisation'),
        h('span', null, s('svg', { class: 'ico', viewBox: '0 0 14 14' }, s('circle', { cx: 7, cy: 7, r: 5, class: 'k-m figur hoch' })), 'Stufe 4 oder 5'),
        h('span', null, s('svg', { class: 'ico', viewBox: '0 0 14 14' }, s('circle', { cx: 7, cy: 7, r: 6, class: 'k-checkin' })), 'letzter Check-in'))),
    h('div', { class: 'cols' },
      panel('Ebenen', null,
        h('div', { class: 'row' }, ebene('ausgang', 'Ausgangsorte'), ebene('standorte', 'Standorte'), ebene('orte', 'Orte'), ebene('akteure', 'Akteure'), ebene('fenster', 'Zeitfenster'), ebene('route', 'Anreiseroute')),
        h('div', { class: 'row' }, ebene('gelaende', 'Gewässer und Siedlungen'), ebene('strassen', 'Fernstraßen'), ebene('namen', 'Ortsnamen')),
        h('div', { class: 'row' }, ebene('kacheln', 'Online-Kacheln mit Straßen'),
          h('select', { id: 'k-anbieter', 'aria-label': 'Anbieter der Kacheln', onchange: function (ev) { K.anbieter = ev.target.value; karteWahlSichern(); st.neu(); renderModule(); } },
            h('option', { value: 'osm', selected: K.anbieter === 'osm' }, 'OpenStreetMap'), h('option', { value: 'eigen', selected: K.anbieter === 'eigen' }, 'Eigene Kachel-URL')),
          h('span', { class: 'row-item' }, h('input', { type: 'checkbox', id: 'k-dunkel', checked: K.dunkel, onchange: function (ev) { K.dunkel = ev.target.checked; karteWahlSichern(); st.neu(); } }), h('label', { for: 'k-dunkel' }, 'abgedunkelt'))),
        K.anbieter === 'eigen' ? h('div', { class: 'row' }, h('label', { for: 'k-url' }, 'Kachel-URL'),
          h('input', { type: 'text', id: 'k-url', class: 'k-url', value: K.url, placeholder: 'https://…/{z}/{x}/{y}.png (inklusive eigenem Schlüssel)', autocomplete: 'off', spellcheck: 'false',
            onchange: function (ev) { K.url = ev.target.value; karteWahlSichern(); st.neu(); } })) : null,
        h('p', { class: 'note pad' }, 'Online-Kacheln sind standardmäßig aus. Eingeschaltet lädt der Browser Kacheln vom Anbieter; dieser sieht den angezeigten Ausschnitt und die IP-Adresse. Ohne Internet bleibt die Fläche leer. Die URL wird nur in diesem Browser gespeichert.')),
      panel('Auswahl', null, h('div', { id: 'k-auswahl' }))),
    panel('Zeitfenster-Overlay', null,
      h('div', { class: 'row' }, h('label', { for: 'k-dt' }, 'Zeitpunkt'), zeit, h('span', { class: 'mono', id: 'k-zeit' })),
      h('div', { id: 'k-fenster' }),
      h('p', { class: 'note pad' }, def ? 'Der Schieber verschiebt den betrachteten Zeitpunkt von 12 Stunden zurück bis 96 Stunden voraus. Ringe auf der Karte: durchgezogen = aktiv, gestrichelt = ausstehend, schwach = abgelaufen.' : 'Mit einem laufenden Auftrag erscheinen hier die Zeitfenster samt Ort.'))
  ];
  setTimeout(function () { karteAuswahlAnzeige(); karteFensterListe(); }, 0);
  return res;
}

/* =====================================================================
   MODUL 7: AKTEN
   Dokumentenviewer mit Schwärzungen. Eine Schwärzung bleibt verdeckt, solange die Zugangsstufe der Akte nicht ausreicht.
   Der Agent kann beim Handler Freigabe beantragen; die Antwort kommt zeitversetzt und fällt je nach Akte positiv oder negativ aus.
   Der Text verdeckter Passagen wird nicht in die Seite geschrieben. Freigaben verfallen mit der Nachbereitung.
   ===================================================================== */
VIEW.akte = { offen: null };
function aktenListe() { return (SCENARIO.akten || []).filter(function (d) { return freigeschaltet(d.mission); }); }
function schwerKey(doc, r) { return doc.id + ':' + r.r; }
function schwerOffen(doc, r) { return r.stufe > doc.zugang && !(STATE.akten && STATE.akten.freigaben && STATE.akten.freigaben[schwerKey(doc, r)]); }
function schwerListe(doc) {
  const l = [];
  doc.abschnitte.forEach(function (a) { a.absaetze.forEach(function (p) { p.forEach(function (x) { if (typeof x !== 'string') l.push(x); }); }); });
  return l;
}
function akteSchwaerzung(doc, r, nr) {
  if (!schwerOffen(doc, r)) {
    const frei = r.stufe > doc.zugang;
    return h('span', { class: 'rd-text' + (frei ? ' rd-frei' : ''), title: frei ? 'Freigegeben durch den Handler' : '' }, r.t, h('sup', null, '[' + nr + ']'));
  }
  const breite = Math.max(8, Math.min(44, Math.round(r.t.length / 8) * 8));
  return h('span', { class: 'rd', role: 'img', 'aria-label': 'Geschwärzt, Zugangsstufe ' + r.stufe + ' erforderlich', style: 'width:' + breite + 'ch' }, h('sup', null, '[' + nr + ']'));
}
function akteAnsicht(doc) {
  const liste = schwerListe(doc), nrVon = function (x) { return liste.indexOf(x) + 1; };
  const offen = liste.filter(function (r) { return schwerOffen(doc, r); }).length;
  const blatt = h('div', { class: 'akte', id: 'akte-blatt' },
    h('div', { class: 'akte-kopf' }, h('span', null, 'SEKTION 9'), h('span', null, doc.reg)),
    h('div', { class: 'akte-kopf klein' }, h('span', null, doc.art + ' · ' + doc.stand), h('span', null, 'Zugang Stufe ' + doc.zugang)),
    h('h2', { class: 'akte-titel' }, doc.titel),
    doc.abschnitte.map(function (a) {
      return h('section', null, h('h3', null, a.ueberschrift), a.absaetze.map(function (p) {
        return h('p', null, p.map(function (x) { return typeof x === 'string' ? x : akteSchwaerzung(doc, x, nrVon(x)); }));
      }));
    }));
  const tab = tabelle(['Nr.', 'Mindeststufe', 'Zustand', ''], liste.map(function (r) {
    const key = schwerKey(doc, r), anfrage = STATE.akten.anfragen[key], offenZ = schwerOffen(doc, r);
    const zustand = !offenZ ? (r.stufe > doc.zugang ? 'freigegeben' : 'sichtbar') : anfrage ? 'beantragt ' + fmtZ(anfrage).slice(11, 16) + 'Z' : r.antrag === 'nie' ? 'nicht beantragbar' : 'geschwärzt';
    const knopf = offenZ && r.antrag !== 'nie' && !anfrage ? h('button', { type: 'button', id: 'ak-' + doc.id + '-' + r.r, disabled: STATE.agent.status === 'Ruhend',
      onclick: function () { dispatch({ type: 'AKTE_ANTRAG', doc: doc.id, r: r.r }); } }, 'Freigabe beantragen') : null;
    return [td('nw', '[' + nrVon(r) + ']'), td('nw', 'Stufe ' + r.stufe), td('nw', zustand), knopf || ''];
  }), 'Keine Schwärzungen in dieser Akte.');
  return [panel(doc.id + ' ' + doc.titel, [h('span', { class: 'badge' + (offen ? ' on' : '') }, offen + ' von ' + liste.length + ' verdeckt')], h('div', { class: 'akte-wrap' }, blatt)),
          panel('Schwärzungen', null, tab, h('p', { class: 'note pad' }, 'Ein Antrag geht an den Handler; die Antwort kommt zeitversetzt über den Kanal Handler. Der Handler gibt nur frei, was für den Auftrag nötig ist.'))];
}
function renderAkten(m) {
  const docs = aktenListe();
  if (!VIEW.akte.offen || !docs.some(function (d) { return d.id === VIEW.akte.offen; })) VIEW.akte.offen = docs.length ? docs[0].id : null;
  const cur = docs.find(function (d) { return d.id === VIEW.akte.offen; });
  return [
    modKopf(m),
    panel('Aktenverzeichnis', [h('span', { class: 'badge' }, String(docs.length))],
      tabelle(['Kennung', 'Titel', 'Registernummer', 'Art', 'Zugang', 'Verdeckt'], docs.map(function (d) {
        const l = schwerListe(d), n = l.filter(function (r) { return schwerOffen(d, r); }).length;
        return [td('nw', d.id), h('button', { type: 'button', class: 'link', id: 'ak-open-' + d.id, 'aria-current': d.id === VIEW.akte.offen ? 'true' : null,
          onclick: function () { VIEW.akte.offen = d.id; renderModule(); } }, d.titel), td('nw', d.reg), d.art, td('nw', 'Stufe ' + d.zugang), td('nw', n + ' von ' + l.length)];
      }), 'Keine Akten zugänglich.')),
    cur ? akteAnsicht(cur) : null
  ].flat().filter(Boolean);
}

const RENDER = {
  profil: function (m) { return STATE.vorlauf ? renderProfilVorlauf(m) : renderProfil(m); },
  mission: function (m) { return STATE.vorlauf ? renderMissionVorlauf(m) : renderMission(m); },
  dossier: renderDossier,
  komm: renderKomm,
  karte: renderKarte,
  akten: renderAkten,
  extraktion: function (m) { return STATE.vorlauf ? leerAnsicht(m, 'Extraktion', 'Kein laufender Auftrag. Extraktionsanforderungen sind erst mit einem laufenden Auftrag möglich.') : renderExtraktion(m); }
};

function renderModule() {
  const m = MODULES.find(function (x) { return x.id === STATE.ui.modul; }) || MODULES[0];
  const main = $('main'), act = document.activeElement;
  let halten = null;
  if (act && act.id && main.contains(act)) {
    halten = { id: act.id };
    try { halten.a = act.selectionStart; halten.e = act.selectionEnd; } catch (err) { /* Element ohne Textauswahl */ }
  }
  const sy = window.scrollY, sx = window.scrollX;
  const scrolls = Array.prototype.map.call(main.querySelectorAll('[data-scroll]'), function (el) {
    return [el.getAttribute('data-scroll'), el.scrollTop, el.scrollLeft];
  });
  RENDERING = true;
  try { main.replaceChildren.apply(main, RENDER[m.id](m).filter(Boolean)); }
  finally { RENDERING = false; }
  scrolls.forEach(function (x) {
    const el = main.querySelector('[data-scroll="' + x[0] + '"]');
    if (el) { el.scrollTop = x[1]; el.scrollLeft = x[2]; }
  });
  /* Nachrichtenverlauf: bei neuem Inhalt oder Kanalwechsel ans Ende */
  main.querySelectorAll('[data-bottom]').forEach(function (el) {
    const key = el.getAttribute('data-scroll');
    if (!scrolls.some(function (x) { return x[0] === key; })) el.scrollTop = el.scrollHeight;
  });
  if (halten) {
    const el = $(halten.id);
    if (el && typeof el.focus === 'function') {
      try { el.focus({ preventScroll: true }); } catch (err) { el.focus(); }
      if (typeof halten.a === 'number' && typeof el.setSelectionRange === 'function') {
        try { el.setSelectionRange(halten.a, halten.e); } catch (err) { /* Feldtyp ohne Auswahl */ }
      }
    }
  }
  if (typeof window.scrollTo === 'function') { try { window.scrollTo(sx, sy); } catch (err) { /* nicht verfügbar */ } }
  aktualisiereSchreibt();
  tickModule(Date.now());
  document.title = m.titel + ' – Field Terminal';
}

function buildLogFilter() {
  const sel = $('log-filter');
  ['Alle'].concat(LOG_MODULE).forEach(function (n) { sel.appendChild(h('option', { value: n }, n)); });
  sel.addEventListener('change', function () { VIEW.logFilter = sel.value; renderLog(); });
}
function renderLog() {
  const panelEl = $('log');
  panelEl.hidden = !VIEW.logOpen;
  if (!VIEW.logOpen) return;
  const rows = STATE.log.filter(function (e) { return (VIEW.logFilter === 'Alle' || e.modul === VIEW.logFilter) && (!VIEW.logKrit || e.krit); });
  $('log-count').textContent = rows.length + ' von ' + STATE.log.length + ' Einträgen';
  const body = $('log-body');
  body.replaceChildren();
  if (!rows.length) {
    body.appendChild(h('tr', null, h('td', { colspan: '4', class: 'dim' }, 'Keine Einträge für diesen Filter.')));
    return;
  }
  for (let i = rows.length - 1; i >= 0; i--) {             /* neueste zuerst */
    const e = rows[i];
    body.appendChild(h('tr', null,
      h('td', { class: 'c-t' }, fmtZ(e.t)), h('td', { class: 'c-m' }, e.modul),
      h('td', { class: 'c-a' }, e.aktion, e.krit ? [' ', h('span', { class: 'badge' }, 'kritisch')] : null), h('td', { class: 'c-d' }, e.detail)));
  }
}

function renderSysbar() {
  const x = Store.lastSaved();
  $('sys-info').textContent = Store.isPersistent()
    ? 'Gesichert ' + (x ? dtg(x) : '–') + ' · Protokoll ' + STATE.log.length + ' · Tasten 1–7, P, L'
    : 'Nicht gesichert (kein lokaler Speicher) · Protokoll ' + STATE.log.length + ' · Tasten 1–7, P, L';
}
function meldung(text) { $('sys-msg').textContent = text ? dtg(new Date()) + ' · ' + text : ''; }

/* leicht = true: Modulbereich bleibt stehen, nur die Änderungszeitstempel der Freitextfelder werden nachgeführt */
function render(leicht) {
  renderBanner(); renderHeader(); renderNav();
  if (leicht) {
    document.querySelectorAll('[data-geaendert]').forEach(function (e) { e.textContent = fmtZ(STATE.agent[e.getAttribute('data-geaendert') + 'Geaendert']); });
    aktualisiereSchreibt();
    document.querySelectorAll('[data-nstatus]').forEach(function (e) { const n = nachricht(e.getAttribute('data-nstatus')); if (n) e.textContent = 'Status: ' + n.msg.status; });
  } else renderModule();
  renderLog(); renderSysbar();
}

/* =====================================================================
   BESTÄTIGUNGSDIALOG, EXPORT, IMPORT, RESET
   ===================================================================== */
/* inhalt: Text oder Elemente.
   opt.text:    { label, min } – Pflichttext im Dialog; onOk erhält den Text.
   opt.pflicht: Text einer Bestätigung, die vor dem Auslösen ausdrücklich gesetzt werden muss.
   opt.klartext: Textfassung für den Rückfall ohne <dialog>. */
function bestaetigen(titel, inhalt, okLabel, onOk, opt) {
  const dlg = $('dlg'), o = opt || {};
  if (typeof dlg.showModal !== 'function') {               /* Rückfall für Umgebungen ohne <dialog> */
    const frage = titel + '\n\n' + (o.klartext || (typeof inhalt === 'string' ? inhalt : ''));
    if (o.text) {
      const t = window.prompt(frage + '\n\n' + o.text.label, '');
      if (t != null && t.trim().length >= o.text.min) onOk(t.trim());
    } else if (window.confirm(frage)) onOk();
    return;
  }
  const body = $('dlg-body'), ok = $('dlg-ok');
  let ta = null, cb = null;
  const pruefen = function () { ok.disabled = !!((ta && ta.value.trim().length < o.text.min) || (cb && !cb.checked) || (o.pruefer && !o.pruefer())); };
  $('dlg-title').textContent = titel;
  body.replaceChildren(); appendKid(body, inhalt);
  ok.textContent = okLabel;
  if (o.text) {
    ta = h('textarea', { id: 'dlg-text', rows: '4', spellcheck: 'false', oninput: pruefen });
    body.appendChild(h('div', { style: 'padding:10px 0 0' }, h('label', { for: 'dlg-text' }, o.text.label), ta));
  }
  if (o.pflicht) {
    cb = h('input', { type: 'checkbox', id: 'dlg-pflicht', onchange: pruefen });
    body.appendChild(h('div', { class: 'row', style: 'padding:10px 0 0' }, cb, h('label', { for: 'dlg-pflicht' }, o.pflicht)));
  }
  if (o.pruefer) body.oninput = pruefen;
  pruefen();
  ok.onclick = function () { const t = ta ? ta.value.trim() : undefined; dlg.close(); onOk(t); };
  $('dlg-cancel').onclick = function () { dlg.close(); };
  dlg.showModal();
  (ta || $('dlg-cancel')).focus();
}

function exportState() {
  autosaveAlle();
  const datei = 'fieldterminal-' + SCENARIO.agent.id + '-' + dtg(new Date()) + '.json';
  dispatch({ type: 'EXPORT', datei: datei });              /* Eintrag ist Teil des Exports */
  try {
    const blob = new Blob([JSON.stringify(STATE, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = h('a', { href: url, download: datei });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    meldung('Export erstellt: ' + datei);
  } catch (e) { meldung('Export nicht möglich: ' + e.message); }
}

function importFile(file) {
  const reader = new FileReader();
  reader.onerror = function () { dispatch({ type: 'IMPORT_ABGELEHNT', datei: file.name, grund: 'Datei nicht lesbar' }); meldung('Import abgelehnt: Datei nicht lesbar.'); };
  reader.onload = function () {
    let obj = null, grund = '';
    try { obj = migrate(JSON.parse(String(reader.result))); } catch (e) { grund = 'kein gültiges JSON'; }
    if (!grund && !isValidState(obj)) grund = 'entspricht nicht dem Zustandsformat Version ' + STATE_VERSION;
    if (grund) {
      dispatch({ type: 'IMPORT_ABGELEHNT', datei: file.name, grund: grund });
      meldung('Import abgelehnt: ' + grund + '.');
      return;
    }
    bestaetigen('Zustand importieren',
      'Der aktuelle Zustand wird durch den Inhalt von "' + file.name + '" ersetzt (Stand T0 ' + fmtZ(obj.t0) + ', ' + obj.log.length + ' Protokolleinträge).',
      'Importieren',
      function () { dispatch({ type: 'IMPORT', state: obj, datei: file.name }); meldung('Import übernommen: ' + file.name); });
  };
  reader.readAsText(file);
}

/* =====================================================================
   START
   ===================================================================== */
/* =====================================================================
   REGIE-KONSOLE
   Aufruf ausschließlich über Strg+Umschalt+Alt+R; in der Oberfläche nicht erwähnt. Der Dialog entsteht erst beim
   ersten Aufruf. Regie-Aktionen laufen über dispatch und erzeugen dieselben Protokolleinträge wie die regulären
   Ereignisse; Öffnen und Schließen der Konsole werden nicht protokolliert.
   ===================================================================== */
function regieInhalt(dlg, hinweis) {
  const r = STATE.extraktion.anforderung, lauf = LM();
  const neu = function (text) { regieInhalt(dlg, text); };
  const tun = function (aktion, text) { return function () { dispatch(aktion); neu(text); }; };
  const knopf = function (id, titel, fn, aus) { return h('button', { type: 'button', id: id, disabled: !!aus, onclick: fn }, titel); };
  const folge = SCENARIO.missionen.find(function (m) { return MS(m.id).status === 'offen'; });
  const fokus = document.activeElement && dlg.contains(document.activeElement) ? document.activeElement.id : '';
  dlg.replaceChildren(
    h('h2', { id: 'regie-title' }, 'Regie'),
    h('div', { class: 'body' },
      h('h3', null, '1 Nachricht einspielen'),
      h('div', { class: 'row', style: 'padding:4px 0' },
        h('label', { for: 'rg-kanal' }, 'Kanal'),
        h('select', { id: 'rg-kanal' }, SCENARIO.kommunikation.kanaele.map(function (k) { return h('option', { value: k.id }, k.name + ' (' + kanalDef(k.id).gegenstelle + ')'); })),
        h('label', { for: 'rg-dr' }, 'Dringlichkeit'),
        h('select', { id: 'rg-dr' }, DRINGLICHKEIT.map(function (x) { return h('option', { value: x }, x); })),
        h('input', { type: 'checkbox', id: 'rg-lage' }), h('label', { for: 'rg-lage' }, 'lagerelevant')),
      h('textarea', { id: 'rg-text', rows: '3', 'aria-label': 'Nachrichtentext', spellcheck: 'false' }),
      h('div', { class: 'row', style: 'padding:6px 0 0' },
        knopf('rg-senden', 'Einspielen', function () {
          const t = ($('rg-text').value || '').trim();
          if (!t) { neu('Kein Text.'); return; }
          dispatch({ type: 'NACHRICHT_EINGESPIELT', kanal: $('rg-kanal').value, text: t, lagerelevant: $('rg-lage').checked, dringlichkeit: $('rg-dr').value });
          neu('Nachricht eingespielt.');
        }),
        knopf('rg-skript', '2 Nächste Skriptnachricht jetzt', tun({ type: 'NACHRICHT_EINGEHEND' }, 'Skriptnachricht ausgelöst.'), !lauf || MS(lauf.id).skript.every(function (s) { return s === 'gesendet'; }))),
      h('h3', null, '3 Gegenstelle Modul 5 (Stand: ' + r.status + (r.option ? ', Option ' + r.option : '') + ')'),
      h('div', { class: 'row', style: 'padding:4px 0' },
        knopf('rg-freigabe', 'Freigabe', tun({ type: 'EXTRAKTION_GEGENSTELLE', schritt: 'freigabe' }, 'Freigabe.'), r.status !== 'angefordert'),
        knopf('rg-ablehnung', 'Ablehnung', tun({ type: 'EXTRAKTION_GEGENSTELLE', schritt: 'ablehnen' }, 'Ablehnung.'), r.status !== 'angefordert'),
        knopf('rg-durchf', 'Durchführung', tun({ type: 'EXTRAKTION_GEGENSTELLE', schritt: 'durchfuehrung' }, 'Durchführung.'), r.status !== 'bestätigt'),
        knopf('rg-aufhebung', 'Aufhebung', tun({ type: 'EXTRAKTION_GEGENSTELLE', schritt: 'aufheben' }, 'Aufhebung.'), r.status !== 'bestätigt'),
        knopf('rg-abschluss', 'Abschluss', tun({ type: 'EXTRAKTION_GEGENSTELLE', schritt: 'abschliessen' }, 'Abschluss.'), r.status !== 'in Durchführung')),
      h('h3', null, '4 Automatik, 7 Funkstille'),
      h('div', { class: 'row', style: 'padding:4px 0' },
        h('button', { type: 'button', id: 'rg-auto', 'aria-pressed': STATE.automatik ? 'true' : 'false', onclick: tun({ type: 'AUTOMATIK_GESETZT', ein: !STATE.automatik }, 'Automatik umgeschaltet.') },
          'Automatik: ' + (STATE.automatik ? 'an' : 'aus')),
        h('button', { type: 'button', id: 'rg-funk', 'aria-pressed': STATE.funkstille.aktiv ? 'true' : 'false', onclick: tun({ type: 'FUNKSTILLE_GESETZT', aktiv: !STATE.funkstille.aktiv }, 'Funkstille umgeschaltet.') },
          'Funkstille: ' + (STATE.funkstille.aktiv ? 'an' : 'aus')),
        h('span', { class: 'dim mono' }, STATE.plan.length + ' Ereignisse im Plan')),
      h('h3', null, '5 Auftragsabfolge'),
      h('div', { class: 'row', style: 'padding:4px 0' },
        knopf('rg-folge', 'Folgeauftrag jetzt zuweisen' + (folge ? ' (' + folge.id + ')' : ''), function () { dispatch({ type: 'MISSION_ZUGEWIESEN', id: folge.id }); neu('Folgeauftrag zugewiesen.'); }, !folge || !!zugewiesene() || !!STATE.serie.ende),
        knopf('rg-ziele', 'Alle Ziele der Mission abhaken', function () {
          lauf.ziele.forEach(function (z) { dispatch({ type: 'ZIEL_GESETZT', id: z.id, erledigt: true }); });
          neu('Ziele abgehakt.');
        }, !lauf || offeneZiele() === 0)),
      h('h3', null, '6 Bedrohungsstufe (Stand: ' + STATE.extraktion.stufe + ')'),
      h('div', { class: 'row', style: 'padding:4px 0' },
        h('label', { for: 'rg-stufe' }, 'Stufe'),
        h('select', { id: 'rg-stufe' }, [1, 2, 3, 4, 5].map(function (n) { return h('option', { value: String(n), selected: n === STATE.extraktion.stufe }, n + ' ' + SCENARIO.bedrohungsstufen[n]); })),
        knopf('rg-stufe-set', 'Setzen', function () { dispatch({ type: 'BEDROHUNG_GESETZT', stufe: Number($('rg-stufe').value) }); neu('Bedrohungsstufe gesetzt.'); })),
      h('p', { class: 'note', role: 'status', style: 'padding:8px 0 0' }, hinweis || '')),
    h('div', { class: 'acts' }, knopf('rg-zu', 'Schließen', function () { dlg.close(); })));
  const ziel = fokus && $(fokus);
  if (ziel && !ziel.disabled) ziel.focus(); else if (fokus) $('rg-zu').focus();
}
function oeffneRegie() {
  let dlg = $('regie');
  if (!dlg) {
    dlg = h('dialog', { id: 'regie', 'aria-labelledby': 'regie-title' });
    document.body.appendChild(dlg);
  }
  if (typeof dlg.showModal !== 'function' || dlg.open) return;
  regieInhalt(dlg, '');
  dlg.showModal();
  $('rg-kanal').focus();
}

/* =====================================================================
   ZUGANG
   Zugangsschirm mit Kennung, mehrstufigem Verbindungsaufbau und Sperre.
   Die Kennung wird beim ersten Start festgelegt und nur als gesalzener Hash
   (PBKDF2-SHA-256, Rückfall: einfacher Hash) unter eigenem Schlüssel gespeichert; Export und Zurücksetzen
   berühren ihn nicht. Der Verbindungsaufbau ist eine Inszenierung ohne technische Funktion.
   Die Schranke ist rein lokal und sichtbarkeitsbasiert: Sie hält Mitleser vor dem Bildschirm ab,
   nicht jemanden mit Zugriff auf Browser-Werkzeuge oder die Dateien.
   ===================================================================== */
const AUTH_KEY = STORAGE_KEY + '.auth';
const KENNUNG_MIN = 8;
const FEHLVERSUCHE_MAX = 3;
const SPERRE_SEK = [60, 120, 300];                 /* 1., 2., ab 3. Sperre; Rückstellung nach erfolgreicher Anmeldung */
const LEERLAUF_MS = 15 * 60000;                    /* automatische Sperre nach Inaktivität */
const PBKDF2_RUNDEN = 150000;
const AUFBAU_STUFE_MS = [1200, 2800];              /* Dauer je Stufe, zufällig gezogen */
const AUFBAU_KURZ_MS = [450, 800];                 /* erneute Anmeldung innerhalb einer Sitzung */
const AUFBAU_REDUZIERT_MS = [250, 450];            /* prefers-reduced-motion */
const AUFBAU_SKIP_NACH_MS = 1000;
const AUFBAU_STUFEN = [
  { name: 'Kanal-Initialisierung', detail: 'Authentifizierung erfolgt …' },
  { name: 'Schlüssel-Aushandlung', detail: 'Ende-zu-Ende-Verschlüsselung wird stabilisiert' },
  { name: 'Integritätsprüfung', detail: 'Verschlüsselung wird verifiziert' },
  { name: 'Sitzung freigegeben', detail: '' }
];
const AUFBAU_EASE = ['cubic-bezier(.3,.1,.3,1)', 'cubic-bezier(.5,0,.2,1)', 'cubic-bezier(.2,.6,.4,1)'];
let APP_BEREIT = false;
const AUTH_PENDING = [];                           /* Ereignisse vor dem Laden des Zustands */
let AUTH_MEM = null;                               /* Rückfall ohne lokalen Speicher: Kennung nur für diese Sitzung */

function hexVon(b) { return Array.prototype.map.call(b, function (x) { return (x < 16 ? '0' : '') + x.toString(16); }).join(''); }
function zufallHex(n) {
  const b = new Uint8Array(n);
  if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(b);
  else for (let i = 0; i < n; i++) b[i] = Math.floor(Math.random() * 256);
  return hexVon(b);
}
function subtleOk() { return !!(window.crypto && crypto.subtle && window.TextEncoder); }
function cyrb53(str, seed) {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) { const ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}
function fallbackHash(pw, salt) {
  let x = salt + '|' + pw;
  for (let i = 0; i < 3000; i++) x = cyrb53(x + salt, i).toString(16);
  return x;
}
function kennungHash(pw, salt, algo) {
  if (algo === 'pbkdf2' && subtleOk()) {
    const enc = new TextEncoder();
    return crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits'])
      .then(function (k) { return crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode(salt), iterations: PBKDF2_RUNDEN, hash: 'SHA-256' }, k, 256); })
      .then(function (bits) { return hexVon(new Uint8Array(bits)); });
  }
  return Promise.resolve(fallbackHash(pw, salt));
}
function gleich(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
function authLaden() {
  try {
    const r = localStorage.getItem(AUTH_KEY);
    if (r) {
      const o = JSON.parse(r);
      if (o && o.v === 1 && typeof o.hash === 'string' && typeof o.salt === 'string' && (o.algo === 'pbkdf2' || o.algo === 'fb')) return o;
    }
  } catch (e) { /* kein Zugriff */ }
  return AUTH_MEM;
}
function authSpeichern(o) {
  AUTH_MEM = o;
  try { localStorage.setItem(AUTH_KEY, JSON.stringify(o)); return true; } catch (e) { return false; }
}
function authLog(aktion, detail) {
  const e = { modul: 'System', aktion: aktion, detail: detail || '', t: nowIso() };
  if (APP_BEREIT) dispatch({ type: 'AUTH_EREIGNIS', liste: [e] }); else AUTH_PENDING.push(e);
}

/* =====================================================================
   ADRESSLEISTE (Attrappe)
   Eigene Leiste im Anwendungsfenster: Dienstadresse je Mission (einmal erzeugt und dauerhaft im Profil gespeichert),
   Pfad je Ansicht, Ladestreifen, Relais-Zähler, Verbindungsinfo. Rein optisch, keine Netzwerkfunktion.
   ===================================================================== */
const DIENSTE_KEY = STORAGE_KEY + '.dienste';
const RELAIS_NAMEN = ['Birkenwald', 'Nordlicht', 'Grauschimmel', 'Kupferhain', 'Steinbock', 'Moorlerche', 'Frostkamm', 'Weidenrauch',
  'Salzgarten', 'Nebelkraehe', 'Eisvogel', 'Tannenzoll', 'Dunkelfurt', 'Heidemond', 'Schieferbach', 'Wacholder', 'Rabenstein', 'Lindenhall'];
const RELAIS_LAENDER = ['DE', 'NL', 'CH', 'AT', 'LU', 'SE', 'IS', 'FI', 'NO', 'CZ'];
const SCHALTKREIS_MS = 10 * 60000;                 /* Schaltkreise werden regelmäßig erneuert */

const Leiste = (function () {
  let eintrag = null, mission = null, pfad = null, relaisN = 0, relaisSt = 'getrennt', offen = false;
  let tPanel = null, tLade = null, tKette = null, tNeu = [], mem = {}, lat = [0, 0, 0], latT = 0;

  const rnd = function (lo, hi) { return lo + Math.random() * (hi - lo); };
  const reduziert = function () { return !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); };
  function mulberry32(a) {
    return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let x = Math.imul(a ^ a >>> 15, 1 | a); x = x + Math.imul(x ^ x >>> 7, 61 | x) ^ x; return ((x ^ x >>> 14) >>> 0) / 4294967296; };
  }
  function ladeMap() { try { const o = JSON.parse(localStorage.getItem(DIENSTE_KEY)); if (o && typeof o === 'object') return o; } catch (e) { /* kein Zugriff */ } return mem; }
  function speichereMap(m) { mem = m; try { localStorage.setItem(DIENSTE_KEY, JSON.stringify(m)); } catch (e) { /* nur im Speicher */ } }
  /* 56 Zeichen aus a–z und 2–7, das letzte 'd' wie bei Onion-Adressen der Version 3 */
  function hostErzeugen() {
    const abc = 'abcdefghijklmnopqrstuvwxyz234567', b = new Uint8Array(55);
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(b);
    else for (let i = 0; i < b.length; i++) b[i] = Math.floor(Math.random() * 256);
    let a = '';
    for (let i = 0; i < b.length; i++) a += abc[b[i] & 31];
    return a + 'd.onion';
  }
  function dienst(mid) {
    const m = ladeMap(), e = m[mid];
    if (e && typeof e.host === 'string' && /^[a-z2-7]{55}d\.onion$/.test(e.host)) return e;
    const neu = { host: hostErzeugen(), t: nowIso() };
    m[mid] = neu; speichereMap(m);
    return neu;
  }
  function setzeDienst(mid) {
    mission = mid; eintrag = dienst(mid);
    $('tb-host').textContent = eintrag.host;
    document.title = eintrag.host.slice(0, 16) + '….onion';
  }

  /* Relais-Zähler und Statusanzeige */
  function relais(n, st) {
    relaisN = n; relaisSt = st || (n >= 3 ? 'verbunden' : (n <= 0 ? 'getrennt' : 'verbindet'));
    $('tb-n').textContent = String(n);
    const e = $('tb-st'); e.textContent = relaisSt;
    e.className = 'st ' + (relaisSt === 'verbunden' ? 'on' : (relaisSt === 'getrennt' ? 'off' : 'mid'));
    if (offen) panelFuellen();
  }
  /* Ladestreifen */
  function balken(f, ms) {
    clearTimeout(tLade);
    const b = $('tb-load');
    b.style.transition = (ms && !reduziert()) ? 'transform ' + ms + 'ms ease-out' : 'none';
    b.style.opacity = '1'; b.style.transform = 'scaleX(' + f + ')';
  }
  function balkenAus() {
    const b = $('tb-load');
    b.style.transition = 'opacity 260ms'; b.style.opacity = '0';
    clearTimeout(tLade);
    tLade = setTimeout(function () { b.style.transition = 'none'; b.style.transform = 'scaleX(0)'; }, 300);
  }
  function laden() {                                         /* kurzer Seitenwechsel, ohne Wartezeit für die Bedienung */
    clearTimeout(tKette);
    balken(0, 0); void $('tb-load').offsetWidth;
    const a = Math.round(rnd(140, 280));
    balken(0.72, a);
    tKette = setTimeout(function () { balken(1, 120); tKette = setTimeout(balkenAus, 150); }, a + 40);
  }
  function neuverbinden() {                                  /* neue Mission, neue Adresse, neuer Schaltkreis */
    tNeu.forEach(clearTimeout); tNeu = [];
    relais(0, 'verbindet'); balken(0, 0); void $('tb-load').offsetWidth;
    [1, 2, 3].forEach(function (n, k) {
      tNeu.push(setTimeout(function () {
        relais(n); balken(n / 3, 380);
        if (n === 3) tNeu.push(setTimeout(balkenAus, 440));
      }, Math.round(350 + k * rnd(380, 520))));
    });
  }

  /* Ansicht -> Pfad */
  function pfadFuer() {
    if (!STATE || !STATE.ui) return '/';
    switch (STATE.ui.modul) {
      case 'profil': return '/profil';
      case 'mission': return '/briefing/' + String(STATE.kontext).toLowerCase();
      case 'dossier': return '/dossier' + (STATE.dossiers && STATE.dossiers.auswahl ? '?id=' + STATE.dossiers.auswahl : '');
      case 'komm': return '/kanal/' + (STATE.komm && STATE.komm.aktiv ? STATE.komm.aktiv : '');
      case 'extraktion': return '/extraktion';
    }
    return '/';
  }

  /* Verbindungsinfo */
  function fingerabdruck(hostStr) {
    let x = '';
    for (let k = 1; k <= 6; k++) x += cyrb53(hostStr + '#fp', k).toString(16).padStart(14, '0');
    return x.slice(0, 64).toUpperCase().match(/.{4}/g).join(' ');
  }
  function kette() {
    const slot = Math.floor(Date.now() / SCHALTKREIS_MS), rng = mulberry32(cyrb53(eintrag.host + ':' + slot, 5));
    const rollen = ['Einstieg', 'Mitte', 'Ausstieg'], benutzt = {}, out = [];
    rollen.forEach(function (rolle) {
      let name;
      do { name = RELAIS_NAMEN[Math.floor(rng() * RELAIS_NAMEN.length)]; } while (benutzt[name]);
      benutzt[name] = true;
      out.push({ rolle: rolle, name: name + p2(10 + Math.floor(rng() * 90)), land: RELAIS_LAENDER[Math.floor(rng() * RELAIS_LAENDER.length)], basis: 25 + Math.floor(rng() * 90) });
    });
    return { liste: out, alter: Date.now() - slot * SCHALTKREIS_MS };
  }
  function panelFuellen() {
    if (!eintrag) return;
    const dl = $('tb-dl'), k = kette(), verbunden = relaisN >= 3, jetzt = Date.now();
    if (jetzt - latT > 2500) { lat = k.liste.map(function (r) { return Math.round(r.basis * (0.85 + Math.random() * 0.3)); }); latT = jetzt; }
    const rows = [
      ['Adresse', eintrag.host],
      ['Sektionsschlüssel', 'erstellt ' + dtg(eintrag.t)],
      ['Fingerabdruck', fingerabdruck(eintrag.host)]
    ];
    k.liste.forEach(function (r, i) { rows.push([r.rolle, verbunden ? r.name + ' · ' + r.land + ' · ' + lat[i] + ' ms' : '–']); });
    const sum = lat.reduce(function (a, b) { return a + b; }, 0);
    rows.push(['Gesamtlaufzeit', verbunden ? sum + ' ms' : '–']);
    rows.push(['Schaltkreis', verbunden ? 'seit ' + p2(Math.floor(k.alter / 60000)) + ':' + p2(Math.floor(k.alter / 1000) % 60) : '–']);
    rows.push(['Zustand', relaisSt + ' (' + relaisN + '/3 Relais)']);
    dl.replaceChildren();
    rows.forEach(function (r) { dl.appendChild(h('dt', null, r[0])); dl.appendChild(h('dd', null, r[1])); });
  }
  function umschalten(zu) {
    offen = zu === undefined ? !offen : zu;
    $('tb-panel').hidden = !offen;
    $('tb-shield').setAttribute('aria-expanded', offen ? 'true' : 'false');
    clearInterval(tPanel); tPanel = null;
    if (offen) { latT = 0; panelFuellen(); tPanel = setInterval(panelFuellen, 1000); }
  }

  return {
    init: function (mid) {
      setzeDienst(mid); pfad = null; relais(0);
      $('tb-path').textContent = '/';
      $('tb-shield').addEventListener('click', function () { umschalten(); });
      $('tb-close').addEventListener('click', function () { umschalten(false); $('tb-shield').focus(); });
      document.addEventListener('click', function (ev) { if (offen && !$('torbar').contains(ev.target)) umschalten(false); });
      document.addEventListener('keydown', function (ev) { if (offen && ev.key === 'Escape') { umschalten(false); $('tb-shield').focus(); } });
    },
    /* Aufruf bei jedem Rendern: Adresse folgt der Mission, Pfad der Ansicht */
    sync: function () {
      if (!STATE || !eintrag) return;
      const leise = !APP_BEREIT;
      if (STATE.kontext !== mission) { setzeDienst(STATE.kontext); if (!leise) neuverbinden(); }
      const p = pfadFuer();
      if (p !== pfad) {
        const erst = pfad === null;
        pfad = p; $('tb-path').textContent = p;
        if (!erst && !leise) laden();
      }
    },
    relais: relais, balken: balken, balkenAus: balkenAus
  };
})();

const Zugang = (function () {
  let rec = null, einrichtung = false, beschaeftigt = false, initCb = null, wieder = false, beendet = false;
  let sperrTimer = null, seqTimer = null, skipTimer = null, letzteAktion = Date.now();

  const rnd = function (lo, hi) { return lo + Math.random() * (hi - lo); };
  const reduziert = function () { return !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); };
  function msg(txt, art) {
    const m = $('gate-msg');
    m.className = 'gate-msg' + (art ? ' ' + art : '');
    if (m.textContent !== txt) m.textContent = txt;
  }
  function min(n) { return n + (n === 1 ? ' Minute' : ' Minuten'); }

  /* Hintergrund: treibende Staubpunkte (Libelle und Schimmer sind reines CSS) */
  function hintergrund() {
    const staub = $('gate-dust');
    for (let i = 0; i < 16; i++) {
      staub.appendChild(h('i', { style: 'left:' + Math.round(rnd(2, 98)) + '%;--d:' + Math.round(rnd(16, 34)) + 's;--w:-' + Math.round(rnd(0, 30)) + 's;--x:' + Math.round(rnd(-60, 60)) + 'px' }));
    }
  }

  function restSperre() {
    if (!rec || !rec.sperreBis) return 0;
    const max = SPERRE_SEK[SPERRE_SEK.length - 1] * 1000;
    let rest = rec.sperreBis - Date.now();
    if (rest > max) { rec.sperreBis = Date.now() + max; authSpeichern(rec); rest = max; }   /* zurückgestellte Systemuhr */
    return rest;
  }
  function pruefeSperre() {
    if (!rec || !rec.sperreBis) return false;
    if (restSperre() > 0) return true;
    rec.sperreBis = 0; rec.fehl = 0; authSpeichern(rec);
    authLog('Sperre aufgehoben', 'Erneute Authentifizierung möglich');
    return false;
  }
  function sperrAnzeige() {
    const rest = restSperre();
    if (rest <= 0) { ansicht(); fokus(); return; }
    const sek = Math.ceil(rest / 1000);
    msg('Sitzung gesperrt – erneute Authentifizierung in ' + min(Math.ceil(sek / 60)) + '.', 'crit');
    $('gate-count').textContent = 'Verbleibend ' + p2(Math.floor(sek / 60)) + ':' + p2(sek % 60);
  }
  function fokus() { const f = einrichtung ? $('gate-pw') : $('gate-pw'); if (f && !f.disabled) f.focus(); }

  function ansicht() {
    clearInterval(sperrTimer); sperrTimer = null;
    einrichtung = !rec;
    const gesperrt = !einrichtung && pruefeSperre();
    $('gate-seq').hidden = true; $('gate-form').hidden = false; $('gate-msg').hidden = false;
    $('gate-pw2-wrap').hidden = !einrichtung;
    $('gate-sub').textContent = einrichtung ? 'Erstkonfiguration' : 'Zugang beschränkt';
    $('gate-lbl').textContent = einrichtung ? 'Zugangskennung festlegen' : 'Zugangskennung';
    $('gate-pw').setAttribute('autocomplete', einrichtung ? 'new-password' : 'current-password');
    $('gate-go').textContent = einrichtung ? 'Kennung festlegen' : 'Authentifizieren';
    $('gate-pw').disabled = $('gate-go').disabled = gesperrt;
    $('gate-count').textContent = '';
    beschaeftigt = false;
    if (gesperrt) { sperrAnzeige(); sperrTimer = setInterval(sperrAnzeige, 1000); return; }
    if (einrichtung) msg('Mindestens ' + KENNUNG_MIN + ' Zeichen. Die Kennung wird nur als gesalzener Hash lokal gespeichert und nirgends übertragen.', '');
    else msg(rec.fehl ? 'Verbleibende Versuche: ' + (FEHLVERSUCHE_MAX - rec.fehl) + '.' : '', rec.fehl ? 'warn' : '');
  }

  function ruettelt() {
    const b = $('gate-box');
    b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake');
  }
  function sperren(grund) {
    if (!APP_BEREIT || document.body.classList.contains('locked')) return;
    ['dlg', 'regie'].forEach(function (id) { const d = $(id); if (d && d.open) d.close(); });
    document.body.classList.add('locked');
    Leiste.relais(0);
    wieder = true;
    $('gate-pw').value = ''; $('gate-pw2').value = '';
    authLog('Sitzung gesperrt', grund);
    ansicht(); fokus();
  }

  function aufbau(kurz, fertig) {
    const rm = reduziert();
    const bereich = rm ? AUFBAU_REDUZIERT_MS : (kurz ? AUFBAU_KURZ_MS : AUFBAU_STUFE_MS);
    const liste = $('gate-seq-list'), detail = $('gate-detail'), skip = $('gate-skip');
    liste.replaceChildren();
    const lis = AUFBAU_STUFEN.map(function (st) {
      const li = h('li', null, h('span', { class: 'mark', 'aria-hidden': 'true' }), h('span', null, st.name),
        h('span', { class: 'bar', 'aria-hidden': 'true' }, h('span', { class: 'fill' })));
      liste.appendChild(li); return li;
    });
    $('gate-form').hidden = true; $('gate-seq').hidden = false; $('gate-count').textContent = '';
    Leiste.relais(0, 'verbindet'); Leiste.balken(0, 0);
    msg('', ''); $('gate-msg').hidden = true; detail.textContent = '';
    void liste.offsetWidth;                                   /* Ausgangsstellung festschreiben, damit die Übergänge laufen */
    let i = 0, aus = false;
    const ende = function () {
      if (aus) return; aus = true;
      clearTimeout(seqTimer); clearTimeout(skipTimer); skip.hidden = true;
      Leiste.relais(3); Leiste.balkenAus();
      fertig();
    };
    skip.hidden = true;
    skip.onclick = function () { lis.forEach(function (li) { li.className = 'ok'; }); detail.textContent = 'Sitzung freigegeben.'; ende(); };
    if (!kurz && !rm) skipTimer = setTimeout(function () { skip.hidden = false; }, AUFBAU_SKIP_NACH_MS);
    const schritt = function () {
      if (aus) return;
      if (i >= AUFBAU_STUFEN.length - 1) {
        lis[i].className = 'ok'; detail.textContent = 'Sitzung freigegeben.';
        seqTimer = setTimeout(ende, rm ? 200 : (kurz ? 250 : 700));
        return;
      }
      const li = lis[i], d = Math.round(rnd(bereich[0], bereich[1]));
      li.style.setProperty('--dur', d + 'ms');
      li.style.setProperty('--ease', AUFBAU_EASE[Math.floor(Math.random() * AUFBAU_EASE.length)]);
      li.className = 'run';
      detail.textContent = AUFBAU_STUFEN[i].detail;
      Leiste.balken((i + 1) / 3, d);
      seqTimer = setTimeout(function () { li.className = 'ok'; Leiste.relais(i + 1); i += 1; schritt(); }, d);
    };
    schritt();
  }

  /* Boot-Ausgabe beim kalten Start (nicht bei erneuter Anmeldung); beliebige Taste oder Klick überspringt */
  function boot(fertig) {
    const box = $('gate-boot'), liste = $('gate-boot-list'), rm = reduziert(), gate = $('gate');
    const host = $('tb-host').textContent;
    const zeilen = [
      ['Medium eingebunden', true],
      ['Datenträgerintegrität wird geprüft', true],
      [rec ? 'Sektionsschlüssel wird geladen' : 'Sektionsschlüssel wird erzeugt', true],
      ['Hidden Service wird veröffentlicht', true],
      ['Sektion erreichbar: ' + host.slice(0, 16) + '….onion', false]
    ];
    liste.replaceChildren(); box.hidden = false;
    let i = 0, aus = false, t = null;
    const ende = function (ev) {
      if (aus) return; aus = true;
      if (ev && ev.preventDefault) ev.preventDefault();       /* der überspringende Tastendruck darf nicht im Eingabefeld landen */
      clearTimeout(t);
      document.removeEventListener('keydown', ende, true); gate.removeEventListener('pointerdown', ende);
      box.hidden = true; fertig();
    };
    document.addEventListener('keydown', ende, true); gate.addEventListener('pointerdown', ende);
    const naechste = function () {
      if (aus) return;
      if (i >= zeilen.length) { t = setTimeout(ende, rm ? 150 : 450); return; }
      const z = zeilen[i++], p = h('p', null, z[0] + (z[1] ? ' …' : ''));
      liste.appendChild(p);
      if (!z[1]) { t = setTimeout(naechste, rm ? 0 : Math.round(rnd(250, 500))); return; }
      t = setTimeout(function () {
        p.appendChild(document.createTextNode(' ')); p.appendChild(h('span', { class: 'ok' }, '[OK]'));
        t = setTimeout(naechste, rm ? 0 : Math.round(rnd(120, 360)));
      }, rm ? 0 : Math.round(rnd(180, 520)));
    };
    naechste();
  }

  /* Sitzung beenden: Abschlusssequenz, danach Versuch, das Fenster zu schließen; sonst Rückfallbildschirm */
  function beenden() {
    if (beendet || !APP_BEREIT) return;
    beendet = true;
    clearTimeout(seqTimer); clearTimeout(skipTimer);
    autosaveAlle();
    ['dlg', 'regie'].forEach(function (id) { const d = $(id); if (d && d.open) d.close(); });
    dispatch({ type: 'AUTH_EREIGNIS', liste: [{ modul: 'System', aktion: 'Sitzung beendet', detail: 'Abmeldung durch Benutzer', t: nowIso() }] });
    document.body.classList.add('locked');
    $('gate-box').hidden = true; $('gate-boot').hidden = true;
    const end = $('gate-end'), liste = $('gate-end-list'), rm = reduziert();
    end.hidden = false; liste.replaceChildren(); $('gate-end-fertig').hidden = true;
    const zeilen = [['Kanal wird geschlossen', 2], ['Schlüsselmaterial wird verworfen', 1], ['Sitzung wird gesichert', 0], ['Verbindung getrennt', null]];
    let i = 0;
    const abschluss = function () {
      try { window.close(); } catch (e) { /* nicht erlaubt */ }
      setTimeout(function () { $('gate-end-fertig').hidden = false; $('gate-reconnect').focus(); }, rm ? 100 : 700);
    };
    const schritt = function () {
      if (i >= zeilen.length) { abschluss(); return; }
      const z = zeilen[i++];
      liste.appendChild(h('p', null, z[0] + (z[1] === null ? '.' : ' …')));
      if (z[1] !== null) Leiste.relais(z[1], z[1] > 0 ? 'trennt' : 'getrennt'); else Leiste.relais(0);
      setTimeout(schritt, rm ? 100 : Math.round(rnd(500, 1100)));
    };
    $('gate-reconnect').onclick = function () { location.reload(); };
    schritt();
  }

  function freigeben() {
    document.body.classList.remove('locked');
    $('gate-pw').value = ''; $('gate-pw2').value = '';
    letzteAktion = Date.now();
    if (initCb) { const cb = initCb; initCb = null; cb(); }
    else { const b = $('btn-lock'); if (b) b.focus(); }
  }

  function erfolg() {
    rec.fehl = 0; rec.stufe = 0; rec.sperreBis = 0; authSpeichern(rec);
    authLog(wieder ? 'Sitzung wieder freigegeben' : 'Zugang freigegeben', 'Authentifizierung erfolgreich');
    aufbau(wieder, freigeben);
  }
  function fehlversuch() {
    rec.fehl = (rec.fehl || 0) + 1;
    $('gate-pw').value = '';
    if (rec.fehl >= FEHLVERSUCHE_MAX) {
      const stufe = Math.min(rec.stufe || 0, SPERRE_SEK.length - 1);
      rec.stufe = stufe + 1; rec.sperreBis = Date.now() + SPERRE_SEK[stufe] * 1000; authSpeichern(rec);
      authLog('Zugang gesperrt', FEHLVERSUCHE_MAX + ' Fehlversuche; erneute Authentifizierung frühestens in ' + min(SPERRE_SEK[stufe] / 60));
      ruettelt(); ansicht(); return;
    }
    authSpeichern(rec);
    authLog('Authentifizierung fehlgeschlagen', 'Versuch ' + rec.fehl + ' von ' + FEHLVERSUCHE_MAX);
    beschaeftigt = false; $('gate-pw').disabled = $('gate-go').disabled = false;
    ruettelt();
    const rest = FEHLVERSUCHE_MAX - rec.fehl;
    msg(rec.fehl === 1 ? 'Authentifizierung fehlgeschlagen. Verbleibende Versuche: ' + rest + '.'
                       : 'Kennung nicht akzeptiert. Verbleibende Versuche: ' + rest + '. Bei erneutem Fehlschlag wird die Sitzung gesperrt.', 'warn');
    fokus();
  }

  function abschicken(ev) {
    ev.preventDefault();
    if (beschaeftigt) return;
    const pw = $('gate-pw').value;
    if (einrichtung) {
      const pw2 = $('gate-pw2').value;
      if (pw.length < KENNUNG_MIN) { msg('Die Kennung benötigt mindestens ' + KENNUNG_MIN + ' Zeichen.', 'crit'); return; }
      if (pw !== pw2) { msg('Die beiden Eingaben stimmen nicht überein.', 'crit'); return; }
      beschaeftigt = true; $('gate-go').disabled = true; msg('Kennung wird verarbeitet …', '');
      const salt = zufallHex(16), algo = subtleOk() ? 'pbkdf2' : 'fb';
      kennungHash(pw, salt, algo).then(function (hx) {
        const neu = { v: 1, algo: algo, salt: salt, hash: hx, fehl: 0, stufe: 0, sperreBis: 0, erstellt: nowIso() };
        const dauerhaft = authSpeichern(neu);
        rec = neu;
        authLog('Zugangskennung festgelegt', dauerhaft ? 'Als gesalzener Hash lokal gespeichert' : 'Nur für diese Sitzung (kein lokaler Speicher)');
        einrichtung = false;
        erfolg();
      }, function () { beschaeftigt = false; $('gate-go').disabled = false; msg('Kennung konnte nicht verarbeitet werden.', 'crit'); });
      return;
    }
    if (pruefeSperre()) { ansicht(); return; }
    if (!pw) { msg('Bitte Zugangskennung eingeben.', 'warn'); return; }
    beschaeftigt = true; $('gate-pw').disabled = $('gate-go').disabled = true;
    msg('Authentifizierung wird geprüft …', '');
    const t0 = Date.now(), warte = rnd(500, 950);
    kennungHash(pw, rec.salt, rec.algo).then(function (hx) { return gleich(hx, rec.hash); }, function () { return false; })
      .then(function (ok) {
        setTimeout(function () { if (ok) erfolg(); else fehlversuch(); }, Math.max(0, warte - (Date.now() - t0)));
      });
  }

  return {
    start: function (cb) {
      initCb = cb; rec = authLaden();
      const x = Store.load();
      Leiste.init(x && typeof x.kontext === 'string' ? x.kontext : SCENARIO.missionen[0].id);
      hintergrund();
      $('gate-form').addEventListener('submit', abschicken);
      const aktiv = function () { letzteAktion = Date.now(); };
      ['pointerdown', 'keydown', 'wheel', 'touchstart', 'pointermove'].forEach(function (n) { document.addEventListener(n, aktiv, { passive: true }); });
      ansicht();
      $('gate-box').hidden = true;
      boot(function () { $('gate-box').hidden = false; fokus(); });
    },
    sperren: sperren,
    beenden: beenden,
    beendet: function () { return beendet; },
    leerlauf: function () {
      if (APP_BEREIT && !beendet && !document.body.classList.contains('locked') && Date.now() - letzteAktion > LEERLAUF_MS)
        sperren('Inaktivität (' + min(Math.round(LEERLAUF_MS / 60000)) + ')');
    }
  };
})();

/* Sichtbare Fehlermeldung, wenn szenario.js nicht geladen wurde oder kein gültiges SCENARIO liefert */
function szenarioFehlt() {
  document.body.classList.remove('locked');              /* ohne Szenario gibt es nichts abzusichern */
  const txt = 'SZENARIODATEN NICHT GELADEN';
  $('banner-top').textContent = txt; $('banner-bottom').textContent = txt;
  $('main').replaceChildren(
    h('div', { class: 'mod-head' }, h('h1', null, 'Szenariodatei fehlt')),
    h('section', { class: 'panel', role: 'alert' },
      h('h2', null, 'Start nicht möglich', h('span', { class: 'label s-crit' }, 'Fehler')),
      h('p', { class: 'pad' }, 'Die Datei szenario.js wurde nicht geladen oder enthält kein gültiges Objekt SCENARIO.'),
      h('p', { class: 'pad' }, 'Abhilfe: szenario.js in denselben Ordner wie index.html legen und die Seite neu laden. Gespeicherte Zustände bleiben unberührt.')));
  document.title = 'Szenariodatei fehlt – Field Terminal';
}
function init() {
  SESSION_START = Date.now();
  const geladen = migrate(Store.load());
  const neu = !isValidState(geladen);
  STATE = neu ? buildInitialState(Date.now()) : geladen;

  renderBanner(); buildNav(); buildLogFilter();

  const protokollUmschalten = function () { VIEW.logOpen = !VIEW.logOpen; renderHeader(); renderLog(); };
  $('btn-log').addEventListener('click', protokollUmschalten);
  $('btn-lock').addEventListener('click', function () { Zugang.sperren('Manuell (Schaltfläche)'); });
  $('btn-end').addEventListener('click', function () {
    bestaetigen('Sitzung beenden', 'Der Kanal wird geschlossen und das Fenster beendet. Entwürfe werden zuvor gesichert; der Zustand bleibt für die nächste Sitzung erhalten.',
      'Beenden', function () { Zugang.beenden(); });
  });
  $('log-krit').addEventListener('change', function (ev) { VIEW.logKrit = ev.target.checked; renderLog(); });
  $('btn-export').addEventListener('click', exportState);
  $('btn-import').addEventListener('click', function () { $('file-import').click(); });
  $('file-import').addEventListener('change', function (ev) {
    const f = ev.target.files && ev.target.files[0];
    if (f) importFile(f);
    ev.target.value = '';
  });
  $('btn-reset').addEventListener('click', function () {
    bestaetigen('Zustand zurücksetzen',
      'Der Ausgangszustand wird hergestellt. Protokoll, Notizen, Nachrichten und Statusänderungen dieser Sitzung gehen verloren. Eigene Dossiers, Bilder, Aufnahmen und Kartenpositionen bleiben im Profil erhalten. Ein vorheriger Export wird empfohlen.',
      'Zurücksetzen',
      function () { dispatch({ type: 'RESET' }); meldung('Ausgangszustand hergestellt.'); });
  });
  window.addEventListener('pagehide', autosaveAlle);

  /* Tastaturkürzel: 1 bis 5 Modulwechsel, P Protokoll; nur ohne Fokus in Eingabefeldern und ohne offenen Dialog.
     Strg+Eingabe im Nachrichtenfeld sendet (siehe Modul 4). */
  document.addEventListener('keydown', function (ev) {
    if (document.body.classList.contains('locked')) return;                 /* Zugangsschirm aktiv: keine Kürzel */
    if (ev.ctrlKey && ev.shiftKey && ev.altKey && ev.code === 'KeyR') { ev.preventDefault(); if (!$('dlg').open) oeffneRegie(); return; }   /* Regie-Konsole */
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
    const t = ev.target, tag = t && t.tagName;
    const texteingabe = tag === 'INPUT' && ['checkbox', 'radio', 'button', 'submit'].indexOf(t.type) < 0;   /* Kontrollkästchen und Optionsfelder sperren die Kürzel nicht */
    if (texteingabe || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return;
    if ($('dlg').open || ($('regie') && $('regie').open)) return;
    if (ev.key === 'p' || ev.key === 'P') { ev.preventDefault(); protokollUmschalten(); return; }
    if (ev.key === 'l' || ev.key === 'L') { ev.preventDefault(); Zugang.sperren('Manuell (Taste L)'); return; }
    const m = MODULES.find(function (x) { return x.key === ev.key; });
    if (!m) return;
    ev.preventDefault();
    dispatch({ type: 'NAVIGATION', modul: m.id });
    const titel = $('mod-title'); if (titel) titel.focus();
  });

  dispatch({ type: 'SITZUNG_START', neu: neu });
  planeAlle();
  APP_BEREIT = true;
  if (AUTH_PENDING.length) dispatch({ type: 'AUTH_EREIGNIS', liste: AUTH_PENDING.splice(0) });
  tick();
  setInterval(tick, 1000);
}
if (typeof SCENARIO === 'undefined' || !SCENARIO || !Array.isArray(SCENARIO.missionen) || !SCENARIO.missionen.length) szenarioFehlt();
else Zugang.start(init);
