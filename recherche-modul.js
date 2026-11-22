/* =====================================================================
   MODUL 8: RECHERCHE, UNTERLAGEN ZUM FALL (Fallkern)
   Unterlagen am Dossier ohne laufenden Auftrag. Eigener Schreib- und Lesepfad, getrennt vom Missionspfad (ms.dokumente).
   Datenvertrag: docs/datenvertrag.md. Objekte: Fall, Quelle, Fassung, Beobachtung (PROFIL.recherche, im Profil gespeichert).
   Dateien liegen bytegetreu in einer eigenen IndexedDB ('fieldterminal.recherche'), die das Zurücksetzen des Zustands nicht leert.
   Klassisches Skript, wird nach dem Hauptskript geladen; vom Hauptskript nur zur Laufzeit referenziert.
   ===================================================================== */
VIEW.recherche = Object.assign({ fall: '', offen: false, datei: null, weitere: false, unterlagenOffen: new Set(), sprungziel: new Map() }, VIEW.recherche || {});
PROFIL.recherche = PROFIL.recherche || { faelle: [], quellen: [], fassungen: [], beobachtungen: [], aussagen: [], seq: { fall: 0, quelle: 0, fassung: 0, beobachtung: 0, aussage: 0 } };
['faelle', 'quellen', 'fassungen', 'beobachtungen', 'aussagen'].forEach(function (k) { PROFIL.recherche[k] = PROFIL.recherche[k] || []; });
PROFIL.recherche.seq = Object.assign({ fall: 0, quelle: 0, fassung: 0, beobachtung: 0, aussage: 0 }, PROFIL.recherche.seq || {});
PROFIL_AKTIONEN.RECHERCHE_BELEG = 1; PROFIL_AKTIONEN.RECHERCHE_PAKET_IMPORT = 1;

const RCH_MAX = 20 * 1024 * 1024;
const RCH_FUNDSTELLEN = ['Seite', 'Absatz', 'Abschnitt', 'Zeitmarke', 'Zeichenbereich', 'ganze Datei'];
/* Fundstellenarten, die zum Material passen; alles Weitere steht unter "Weitere Optionen" */
const RCH_FT_MATERIAL = { pdf: ['Seite'], zeit: ['Zeitmarke'], text: ['Absatz', 'Abschnitt'], bild: [], datei: [] };
function rchMaterial(datei) {
  if (!datei) return 'text';
  const t = String(datei.type || '').toLowerCase(), n = String(datei.name || '').toLowerCase();
  if (t === 'application/pdf' || /\.pdf$/.test(n)) return 'pdf';
  if (/^(video|audio)\//.test(t) || /\.(mp4|mov|mkv|webm|mp3|wav|m4a|ogg)$/.test(n)) return 'zeit';
  if (/^image\//.test(t)) return 'bild';
  if (/^text\//.test(t) || /\.(txt|md|html?|rtf|docx?)$/.test(n)) return 'text';
  return 'datei';
}
const RCH_ID = { fall: ['F-', 'fall'], quelle: ['Q-', 'quelle'], fassung: ['V-', 'fassung'], beobachtung: ['B-', 'beobachtung'], aussage: ['A-', 'aussage'] };

/* ---------- Dateispeicher ---------- */
const RIDB = {
  db: null,
  oeffnen: function () {
    return new Promise(function (ok, nein) {
      if (RIDB.db) { ok(RIDB.db); return; }
      let r;
      try { r = indexedDB.open('fieldterminal.recherche', 1); } catch (x) { nein(x); return; }
      r.onupgradeneeded = function () { r.result.createObjectStore('dateien'); };
      r.onsuccess = function () { RIDB.db = r.result; ok(RIDB.db); };
      r.onerror = function () { nein(r.error); };
    });
  },
  tun: function (modus, f) {
    return RIDB.oeffnen().then(function (db) {
      return new Promise(function (ok, nein) {
        const tx = db.transaction('dateien', modus), req = f(tx.objectStore('dateien'));
        tx.oncomplete = function () { ok(req ? req.result : null); };
        tx.onerror = tx.onabort = function () { nein(tx.error); };
      });
    });
  },
  put: function (k, blob) { return RIDB.tun('readwrite', function (st) { return st.put(blob, k); }); },
  get: function (k) { return RIDB.tun('readonly', function (st) { return st.get(k); }); },
  del: function (k) { return RIDB.tun('readwrite', function (st) { return st.delete(k); }); },
  schluessel: function () { return RIDB.tun('readonly', function (st) { return st.getAllKeys(); }); }
};

function rchHash(blob) {
  if (!(window.crypto && crypto.subtle && blob.arrayBuffer)) return Promise.resolve(null);       /* ohne Prüfsumme: als fehlend ausweisen, nichts ersetzen */
  return blob.arrayBuffer().then(function (b) { return crypto.subtle.digest('SHA-256', b); }).then(function (d) {
    return Array.prototype.map.call(new Uint8Array(d), function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
  }).catch(function () { return null; });
}
function rchNr(art) { const R = PROFIL.recherche; R.seq[RCH_ID[art][1]] += 1; return RCH_ID[art][0] + p3(R.seq[RCH_ID[art][1]]); }

/* Rücknahme: Stand wiederherstellen, wenn das Profil nicht gesichert werden konnte */
const RCH_LISTEN = ['faelle', 'quellen', 'fassungen', 'beobachtungen', 'aussagen'];
function rchWiederherstellen(sicher) {
  const R = PROFIL.recherche, alt = JSON.parse(sicher);
  RCH_LISTEN.forEach(function (k) { R[k].length = 0; (alt[k] || []).forEach(function (x) { R[k].push(x); }); });
  R.seq = Object.assign({ fall: 0, quelle: 0, fassung: 0, beobachtung: 0, aussage: 0 }, alt.seq);
}
/* Führt eine Aktion aus und nimmt sie samt Protokolleintrag zurück, wenn sie das Profil ändert, dieses aber nicht gespeichert werden kann. Liefert true bei Erfolg. */
function rchSchreiben(aktion, aktionsName, zurueck) {
  rchSchreiben.fehler = false;
  const R = PROFIL.recherche, sicher = JSON.stringify(R), logN = STATE.log.length;
  dispatch(aktion);
  if (JSON.stringify(R) === sicher && !(typeof zurueck === 'function' && zurueck.geaendert && zurueck.geaendert())) return false;   /* nichts geändert (abgelehnt) */
  if (profilSpeichern()) return true;
  rchSchreiben.fehler = true;                                           /* Speichern gescheitert (nicht: nichts zu ändern) */
  rchWiederherstellen(sicher);
  if (typeof zurueck === 'function') zurueck();
  for (let i = STATE.log.length - 1; i >= logN && i >= 0; i--) { if (STATE.log[i].detail && STATE.log[i].aktion === aktionsName) { STATE.log.splice(i, 1); break; } }
  meldung('Nicht gespeichert: Profilspeicher voll oder nicht beschreibbar. Die Eingabe bleibt erhalten.');
  return false;
}

/* ---------- Aktion ---------- */
ACTIONS.RECHERCHE_BELEG = function (a) {
  const R = PROFIL.recherche, e = entitaet(a.dossier);
  if (!e || dossierGesperrt(e) || !a.fassung) return null;
  const ft = a.fundstelle && a.fundstelle.typ ? { typ: String(a.fundstelle.typ).slice(0, 40), wert: String(a.fundstelle.wert || '').slice(0, 120) } : null;      /* Fundstelle ist optional */
  let fall = a.fall ? R.faelle.find(function (f) { return f.id === a.fall; }) : null, neuerFall = false;
  if (!fall && a.neuerFall && a.neuerFall.titel) {
    fall = xAnlegen(a.neuerFall); neuerFall = !!fall;
  }
  if (!fall) return null;                                    /* kein stiller Standardfall */
  const t = nowIso(), q = { id: rchNr('quelle'), fall: fall.id, art: a.art, herkunft: String(a.herkunft || '').slice(0, 300), erfasst: t, aktuelleFassung: null, notiz: String(a.notiz || '').slice(0, 300) };
  const f = Object.assign({ id: rchNr('fassung'), quelle: q.id, erfasst: t }, a.fassung);
  q.aktuelleFassung = f.id;
  const b = { id: rchNr('beobachtung'), fassung: f.id, fundstelle: ft, zitat: String(a.zitat || '').slice(0, 2000), ereignis: null, dossiers: [e.id], erfasst: t };
  R.quellen.push(q); R.fassungen.push(f); R.beobachtungen.push(b);
  return { modul: 'Dossier', aktion: 'Unterlage erfasst', detail: e.id + ' ' + e.name + ': ' + q.id + ' (' + q.art + ') im Fall ' + fall.id + (neuerFall ? ' (neu angelegt)' : '') + (ft ? ', Fundstelle ' + ft.typ + (ft.wert ? ' ' + ft.wert : '') : ', ohne Fundstelle') };
};

/* ---------- Markierung einer Unterlage ---------- */
/* Die Markierung gilt der Unterlage selbst: geprüft und nützlich. Sie bestätigt keine daraus abgeleitete Behauptung. */
ACTIONS.RECHERCHE_UNTERLAGE_MARKIERT = function (a) {
  const R = PROFIL.recherche, b = R.beobachtungen.find(function (x) { return x.id === a.beob; });
  if (!b) return null;
  const p = b.pruefung = b.pruefung || { nuetzlich: false, am: null, notiz: '' }, teile = [];
  if (typeof a.geprueft === 'boolean' && a.geprueft !== !!p.nuetzlich) { p.nuetzlich = a.geprueft; p.am = a.geprueft ? nowIso() : null; teile.push(a.geprueft ? 'als geprüft und nützlich markiert' : 'Markierung zurückgenommen'); }
  if (typeof a.notiz === 'string' && a.notiz.trim().slice(0, 500) !== (p.notiz || '')) { p.notiz = a.notiz.trim().slice(0, 500); teile.push(p.notiz ? 'Notiz gesetzt' : 'Notiz entfernt'); }
  if (!teile.length) { if (!b.pruefung.nuetzlich && !b.pruefung.notiz && !b.pruefung.am) delete b.pruefung; return null; }
  const f = R.fassungen.find(function (y) { return y.id === b.fassung; }) || {};
  return { modul: 'Dossier', aktion: 'Unterlage geprüft', detail: b.id + ' (' + (f.quelle || '–') + '): ' + teile.join(', ') };
};
PROFIL_AKTIONEN.RECHERCHE_UNTERLAGE_MARKIERT = 1;

/* Gemeinsam genutzte Unterlagen bleiben im Fall erhalten. Nur die Dossierzuordnung wird gelöst. */
function rchUnterlageTeiltBezug(b, dossier) {
  return (b.dossiers || []).some(function (id) { return id !== dossier; }) ||
    (PROFIL.zonen || []).some(function (z) { return (z.unterlagen || []).includes(b.id); }) ||
    PROFIL.recherche.aussagen.some(function (x) {
      return (x.stuetzend || []).concat(x.widersprechend || []).some(function (v) { return v.beob === b.id; });
    });
}
ACTIONS.RECHERCHE_UNTERLAGE_ENTFERNT = function (a) {
  const e = entitaet(a.dossier), R = PROFIL.recherche;
  const b = R.beobachtungen.find(function (x) { return x.id === a.beob && (x.dossiers || []).includes(a.dossier); });
  /* Löschen einer Unterlagen-Zuordnung ist nur durch manuelle Sperren begrenzt. */
  if (!e || !b || dossierGesperrt(e)) return null;

  const geteilt = rchUnterlageTeiltBezug(b, e.id), sicher = JSON.stringify(R);
  let datei = null;
  if (geteilt) b.dossiers = b.dossiers.filter(function (id) { return id !== e.id; });
  else {
    R.beobachtungen = R.beobachtungen.filter(function (x) { return x !== b; });
    const f = R.fassungen.find(function (x) { return x.id === b.fassung; });
    if (f && !R.beobachtungen.some(function (x) { return x.fassung === f.id; })) {
      R.fassungen = R.fassungen.filter(function (x) { return x !== f; });
      const weitere = R.fassungen.filter(function (x) { return x.quelle === f.quelle; });
      const q = R.quellen.find(function (x) { return x.id === f.quelle; });
      if (q && !weitere.length) R.quellen = R.quellen.filter(function (x) { return x !== q; });
      else if (q && q.aktuelleFassung === f.id) q.aktuelleFassung = weitere[weitere.length - 1].id;
      if (f.anhang && !R.fassungen.some(function (x) { return x.anhang === f.anhang; })) datei = f.anhang;
    }
  }
  if (!profilSpeichern()) {
    rchWiederherstellen(sicher);
    meldung('Unterlage konnte nicht gespeichert werden. Sie bleibt erhalten.'); return null;
  }
  delete VIEW.draft['rch-n-' + b.id];
  if (VIEW.recherche.sprungziel.get(e.id) === b.id) VIEW.recherche.sprungziel.delete(e.id);
  if (datei) RIDB.del(datei).catch(function () { meldung('Unterlage entfernt. Die nicht mehr verknüpfte Dateikopie konnte nicht aufgeräumt werden.'); });
  return { modul: 'Dossier', aktion: geteilt ? 'Unterlage vom Dossier gelöst' : 'Unterlage gelöscht', detail: b.id + ' · ' + e.id };
};

/* ---------- Aussagen (Altdaten) ----------
   Das Aussagenregister ist entfernt: keine Oberfläche, keine Bearbeitung. Vorhandene Aussagen in PROFIL.recherche.aussagen bleiben unverändert
   erhalten und reisen im Fallpaket mit (Export, Import, Zusammenführung). */

/* ---------- Lesen ---------- */
function rchBelege(e) {
  const R = PROFIL.recherche;
  return R.beobachtungen.filter(function (b) { return (b.dossiers || []).indexOf(e.id) >= 0; }).map(function (b) {
    const f = R.fassungen.find(function (x) { return x.id === b.fassung; }) || {}, q = R.quellen.find(function (x) { return x.id === f.quelle; }) || {};
    return { b: b, f: f, q: q, fall: R.faelle.find(function (x) { return x.id === q.fall; }) || null };
  });
}
function rchZuBeobachtung(id) {
  const R = PROFIL.recherche, b = R.beobachtungen.find(function (x) { return x.id === id; }); if (!b) return null;
  const f = R.fassungen.find(function (x) { return x.id === b.fassung; }) || {}, q = R.quellen.find(function (x) { return x.id === f.quelle; }) || {};
  return { b: b, f: f, q: q, fall: R.faelle.find(function (x) { return x.id === q.fall; }) || null };
}
function rchFundstelleText(ft) { return ft && ft.typ ? ft.typ + (ft.wert ? ' ' + ft.wert : '') : 'keine Angabe'; }
function rchOeffnen(z) {
  RIDB.get(z.f.anhang).then(function (blob) {
    if (!blob) { meldung('Datei nicht mehr vorhanden (Browserspeicher geleert?).'); return null; }
    return rchHash(blob).then(function (hash) {
      const stand = !z.f.hash ? 'ohne gespeicherte Prüfsumme' : !hash ? 'Prüfsumme nicht berechenbar' : hash === z.f.hash ? 'Prüfsumme stimmt' : 'ABWEICHENDE PRÜFSUMME: Datei wurde verändert';
      const seite = z.b.fundstelle && z.b.fundstelle.typ === 'Seite' && /^\d{1,5}$/.test(z.b.fundstelle.wert || '') && z.f.typ === 'application/pdf' ? '#page=' + z.b.fundstelle.wert : '';
      const u = URL.createObjectURL(blob), a = h('a', { href: u + seite, target: '_blank', rel: 'noopener' });
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(u); }, 60000);
      meldung(z.q.id + ' geöffnet, Fundstelle ' + rchFundstelleText(z.b.fundstelle) + '; ' + stand + '.');
    });
  }).catch(function () { meldung('Datei konnte nicht gelesen werden.'); });
}

/* ---------- Erfassen ---------- */
function rchEntwurf(k) { return VIEW.draft['rch-' + k] || ''; }
function rchSetze(k) { return function (ev) { VIEW.draft['rch-' + k] = ev.target.value; }; }
function rchFallAuswahl(e) {
  const K = VIEW.recherche;
  if (K.fall && K.fallDossier === e.id && PROFIL.recherche.faelle.some(function (f) { return f.id === K.fall; })) return K.fall;
  const faelle = {}; rchBelege(e).forEach(function (z) { if (z.fall) faelle[z.fall.id] = 1; });
  const ids = Object.keys(faelle);
  return ids.length === 1 ? ids[0] : '';                                  /* nur wenn eindeutig, und dann sichtbar im Auswahlfeld */
}
function rchErfassen(e) {
  const R = PROFIL.recherche, K = VIEW.recherche, datei = K.datei || null;
  /* Alle Angaben werden beim Klick gemeinsam erfasst; der weitere (asynchrone) Ablauf liest keine Eingaben mehr */
  const erlaubt = RCH_FT_MATERIAL[rchMaterial(datei)] || [], typ1 = rchEntwurf('ft-typ'), typ2 = rchEntwurf('ft-typ2');
  const eing = { fall: rchEntwurf('fall') || rchFallAuswahl(e), titel: rchEntwurf('fall-titel').trim(), frage: rchEntwurf('fall-frage'), text: rchEntwurf('text').trim(),
    ftTyp: typ2 || (erlaubt.indexOf(typ1) >= 0 ? typ1 : (erlaubt[0] || '')), ftWert: rchEntwurf('ft-wert').trim(), herkunft: rchEntwurf('herkunft'), notiz: rchEntwurf('notiz') };
  const gesendet = { 'fall': VIEW.draft['rch-fall'], 'fall-titel': VIEW.draft['rch-fall-titel'], 'fall-frage': VIEW.draft['rch-fall-frage'], 'text': VIEW.draft['rch-text'], 'ft-typ': VIEW.draft['rch-ft-typ'], 'ft-typ2': VIEW.draft['rch-ft-typ2'], 'ft-wert': VIEW.draft['rch-ft-wert'],
    'herkunft': VIEW.draft['rch-herkunft'], 'notiz': VIEW.draft['rch-notiz'] };
  if (!eing.fall) { meldung('Bitte zuerst einen Fall wählen oder einen neuen anlegen.'); return; }
  const neu = eing.fall === '__neu';
  if (neu && !eing.titel) { meldung('Für einen neuen Fall fehlt der Titel.'); return; }
  if (!datei && !eing.text) { meldung('Weder Datei noch Textauszug angegeben.'); return; }
  if (datei && datei.size > RCH_MAX) { meldung('Datei über 20 MB, nicht angenommen.'); return; }
  /* Fundstelle ist optional: ohne Wert (außer "ganze Datei") wird keine gespeichert */
  const fundstelle = eing.ftTyp === 'ganze Datei' ? { typ: 'ganze Datei', wert: '' } : (eing.ftTyp && eing.ftWert ? { typ: eing.ftTyp, wert: eing.ftWert } : null);
  const fertig = function (fassung) {
    const sicher = JSON.stringify(R);                                  /* Stand vor dem Anlegen, für die Rücknahme */
    dispatch({ type: 'RECHERCHE_BELEG', dossier: e.id, fall: neu ? null : eing.fall, neuerFall: neu ? { titel: eing.titel, frage: eing.frage } : null,
      art: datei ? 'Datei' : 'Text', herkunft: eing.herkunft, notiz: eing.notiz, fassung: fassung, fundstelle: fundstelle, zitat: eing.text });
    if (JSON.stringify(R) === sicher) { if (fassung.anhang) RIDB.del(fassung.anhang).catch(function () {}); return; }          /* Aktion hat nichts angelegt */
    if (!profilSpeichern()) {                                          /* Profil nicht gesichert: Eintrag zurücknehmen, Datei aufräumen, Entwurf behalten */
      rchWiederherstellen(sicher);
      for (let i = STATE.log.length - 1; i >= 0 && i >= STATE.log.length - 5; i--) { if (STATE.log[i].aktion === 'Unterlage erfasst') { STATE.log.splice(i, 1); break; } }
      if (fassung.anhang) RIDB.del(fassung.anhang).catch(function () {});
      meldung('Unterlage nicht gespeichert: Profilspeicher voll oder nicht beschreibbar. Die Eingabe bleibt erhalten.');
      renderModule();
      return;
    }
    /* Nur die gesendeten Eingaben löschen; ein inzwischen neuer Entwurf bleibt erhalten */
    Object.keys(gesendet).forEach(function (k) { if (VIEW.draft['rch-' + k] === gesendet[k]) delete VIEW.draft['rch-' + k]; });
    K.fall = R.quellen[R.quellen.length - 1].fall; K.fallDossier = e.id; K.offen = false; if (K.datei === datei) K.datei = null;           /* der Fall bleibt sichtbar ausgewählt */
    renderModule();
  };
  if (!datei) { fertig({ dateiname: null, groesse: eing.text.length, typ: 'text/plain', hash: null, anhang: false }); return; }
  /* Datei zuerst sichern; erst danach entstehen die Datensätze */
  const schluessel = 'ANH-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);      /* eigener Dateischlüssel, unabhängig von der Fassungsnummer */
  rchHash(datei).then(function (hash) {
    return RIDB.put(schluessel, datei).then(function () { fertig({ dateiname: datei.name, groesse: datei.size, typ: datei.type || 'application/octet-stream', hash: hash, anhang: schluessel }); });
  }).catch(function () { RIDB.del(schluessel).catch(function () {}); meldung('Unterlage konnte nicht gespeichert werden (Browserspeicher nicht verfügbar).'); });
}

/* ---------- Ansicht ---------- */
/* ---------- Ansicht: Unterlagen zum Fall ---------- */
function rchUnterlageZeigen(id) {
  const bereich = $('rch-dossier-unterlagen'), zeile = $('rch-u-' + id), K = VIEW.recherche;
  if (!bereich || !zeile || !bereich.contains(zeile)) { meldung('Unterlage in diesem Dossier nicht verfügbar.'); return; }
  const dossier = bereich.dataset.dossier;
  K.unterlagenOffen.add(dossier); K.sprungziel.set(dossier, id);
  renderModule();
  const ziel = $('rch-u-' + id);
  if (!ziel) return;
  ziel.focus({ preventScroll: true });
  ziel.scrollIntoView({ block: 'center', inline: 'nearest' });
}
function rchUnterlageZeile(e, z) {
  const b = z.b, p = b.pruefung || null, ok = !!(p && p.nuetzlich), nk = 'rch-n-' + b.id;
  const titel = z.f.dateiname || kuerzen(String(b.zitat || '').replace(/\s+/g, ' '), 90) || z.q.id;
  const fremd = (b.dossiers || []).indexOf(e.id) < 0;
  const speichern = function (d) { if (rchSchreiben(Object.assign({ type: 'RECHERCHE_UNTERLAGE_MARKIERT', beob: b.id }, d), 'Unterlage geprüft')) { delete VIEW.draft[nk]; renderModule(); } };
  const notizText = function () { return VIEW.draft[nk] != null ? VIEW.draft[nk] : (p && p.notiz) || ''; };
  const zeile = function (k, v) { return h('div', null, h('span', { class: 'dim' }, k + ': '), v); };
  const sprung = VIEW.recherche.sprungziel.get(e.id) === b.id;
  return h('div', { class: 'pad' + (sprung ? ' rch-sprungziel' : ''), id: 'rch-u-' + b.id, tabindex: '-1', style: 'border-top:1px dashed #33425a;min-width:0;overflow-wrap:anywhere' },
    h('div', null, h('strong', null, titel), sprung ? h('span', { class: 'rch-sprungmarke' }, 'Verweis aus Kurzlage') : null, ' ', ok ? h('span', { class: 'label s-accent' }, 'geprüft und nützlich') : null, fremd ? h('span', { class: 'label s-dim' }, ' anderes Dossier: ' + (b.dossiers || []).join(', ')) : null),
    (function () { const zs = (PROFIL.zonen || []).filter(function (y) { return (y.unterlagen || []).indexOf(b.id) >= 0; }); return zs.length ? h('div', { class: 'note', id: 'rch-karte-' + b.id }, 'Auf der Karte: ', zs.map(function (y) { return [h('button', { type: 'button', class: 'link', 'data-zone': y.id, onclick: function () { if (typeof kartenObjektZeigen === 'function') kartenObjektZeigen(y.id); } }, 'Zone ' + y.name), ' ']; })) : null; })(),
    h('div', { class: 'note' }, 'Quelle: ' + (z.q.herkunft || 'nicht angegeben') + (b.fundstelle && b.fundstelle.typ ? ' · Fundstelle: ' + rchFundstelleText(b.fundstelle) : '')),
    z.b.zitat && z.f.dateiname ? h('details', { id: 'rch-z-' + b.id }, h('summary', null, 'Textauszug'), h('div', { class: 'note', style: 'white-space:pre-wrap', 'data-vollstaendig': '1' }, b.zitat))
      : (b.zitat ? h('details', { id: 'rch-z-' + b.id }, h('summary', null, 'Vollständigen Textauszug anzeigen'), h('div', { class: 'note', style: 'white-space:pre-wrap', 'data-vollstaendig': '1' }, b.zitat)) : null),
    h('div', { class: 'row' },
      z.f.anhang ? h('button', { type: 'button', id: 'rch-o-' + b.id, onclick: function () { rchOeffnen({ b: b, f: z.f, q: z.q }); } }, 'Öffnen') : null,
      h('button', { type: 'button', id: 'rch-m-' + b.id, onclick: function () { speichern({ geprueft: !ok, notiz: notizText() }); } }, ok ? 'Markierung zurücknehmen' : 'Als geprüft und nützlich markieren'),
      h('label', { for: nk }, 'Notiz'),
      entwurf('input', nk, nk, { autocomplete: 'off', type: 'text', 'aria-label': 'Notiz zu ' + b.id, maxlength: '500', value: notizText(), style: 'flex:1 1 220px;min-width:0' }),
      h('button', { type: 'button', id: 'rch-ns-' + b.id, onclick: function () { speichern({ notiz: notizText() }); } }, 'Notiz speichern'),
      fremd ? null : h('button', { type: 'button', id: 'rch-x-' + b.id, onclick: function () {
        const geteilt = rchUnterlageTeiltBezug(b, e.id), aktion = geteilt ? 'Vom Dossier lösen' : 'Unterlage löschen';
        bestaetigen(aktion, b.id + ' · ' + titel + '. ' + (geteilt
          ? 'Andere Dossiers, Zonen und frühere Aussagen behalten ihren Bezug.'
          : 'Die Unterlage wird gelöscht. Der Fall und andere Unterlagen bleiben erhalten.'),
          aktion, function () { dispatch({ type: 'RECHERCHE_UNTERLAGE_ENTFERNT', dossier: e.id, beob: b.id }); });
      } }, rchUnterlageTeiltBezug(b, e.id) ? 'Vom Dossier lösen' : 'Unterlage löschen')),
    h('details', { id: 'rch-d-' + b.id }, h('summary', null, 'Details'),
      h('div', { class: 'note', style: 'overflow-wrap:anywhere' },
        zeile('Nummern', z.q.id + ' · ' + z.f.id + ' · ' + b.id), zeile('Fall', z.fall.id + ' ' + z.fall.titel), zeile('Art', (z.q.art || '–') + (z.f.typ ? ', ' + z.f.typ : '') + (z.f.groesse ? ', ' + z.f.groesse + ' Byte' : '')),
        zeile('Prüfsumme (SHA-256)', z.f.hash || (z.f.anhang ? 'fehlt' : 'kein Anhang')), zeile('Erfasst (UTC)', fmtZ(b.erfasst)), z.q.notiz ? zeile('Anmerkung bei Erfassung', z.q.notiz) : null,
        p && p.am ? zeile('Markiert (UTC)', fmtZ(p.am)) : null)));
}
function rechercheBelege(e) {
  const R = PROFIL.recherche, K = VIEW.recherche, fallId = rchFallAuswahl(e), alt = typeof dossierBelege === 'function' ? dossierBelege(e).length : 0;
  const liste = rchBelege(e).filter(function (z) { return !!z.fall; });
  const sel = function (id, label, opts, wert, onch) { return h('select', { id: id, 'aria-label': label, onchange: onch }, opts.map(function (o) { return h('option', { value: o[0], selected: o[0] === wert }, o[1]); })); };
  let formular = null;
  if (K.offen) {
    const fallWahl = rchEntwurf('fall') || fallId, datei = K.datei, mat = rchMaterial(datei), erlaubt = RCH_FT_MATERIAL[mat] || [];
    const typ1 = erlaubt.indexOf(rchEntwurf('ft-typ')) >= 0 ? rchEntwurf('ft-typ') : (erlaubt[0] || ''), typ2 = rchEntwurf('ft-typ2'), typ = typ2 || typ1;
    const fallOpt = [['', '– Fall wählen –']].concat(R.faelle.map(function (f) { return [f.id, f.id + ' ' + f.titel]; })).concat([['__neu', 'Neuen Fall anlegen …']]);
    const inp = h('input', { type: 'file', id: 'rch-datei', 'aria-label': 'Unterlage als Datei', onchange: function (ev) { K.datei = ev.target.files && ev.target.files[0] || null; renderModule(); } });
    try { if (K.datei) { const dt = new DataTransfer(); dt.items.add(K.datei); inp.files = dt.files; } } catch (x) { /* Auswahl bleibt sichtbar leer */ }
    formular = h('div', { class: 'pad', id: 'rch-form', style: 'border-top:1px dashed #33425a' },
      h('div', { class: 'row' }, h('label', { for: 'rch-fall' }, 'Fall'),
        sel('rch-fall', 'Fall wählen', fallOpt, fallWahl, function (ev) { VIEW.draft['rch-fall'] = ev.target.value; renderModule(); })),
      fallWahl === '__neu' ? h('div', { class: 'row' },
        h('label', { for: 'rch-fall-titel' }, 'Titel des Falls'), entwurf('input', 'rch-fall-titel', 'rch-fall-titel', { autocomplete: 'off', type: 'text', 'aria-label': 'Titel des neuen Falls', maxlength: '120', style: 'flex:1 1 220px;min-width:0' }),
        h('label', { for: 'rch-fall-frage' }, 'Recherchefrage'), entwurf('input', 'rch-fall-frage', 'rch-fall-frage', { autocomplete: 'off', type: 'text', 'aria-label': 'Recherchefrage', maxlength: '300', style: 'flex:2 1 300px;min-width:0' })) : null,
      h('div', { class: 'row' }, h('label', { for: 'rch-datei' }, 'Datei'), inp,
        h('label', { for: 'rch-herkunft' }, 'Quelle oder URL'), entwurf('input', 'rch-herkunft', 'rch-herkunft', { autocomplete: 'off', type: 'text', 'aria-label': 'Quelle oder URL', maxlength: '300', style: 'flex:1 1 260px;min-width:0' })),
      h('div', { class: 'row' }, h('label', { for: 'rch-text' }, 'Textauszug'), entwurf('textarea', 'rch-text', 'rch-text', { 'aria-label': 'Textauszug', rows: '3', maxlength: '2000', style: 'flex:1 1 100%;min-width:0' })),
      h('div', { class: 'row' }, h('label', { for: 'rch-ft-typ' }, 'Fundstelle'),
        sel('rch-ft-typ', 'Art der Fundstelle', erlaubt.map(function (x) { return [x, x]; }).concat(erlaubt.length ? [] : [['', 'keine Angabe']]), typ1, function (ev) { VIEW.draft['rch-ft-typ'] = ev.target.value; renderModule(); }),
        typ && typ !== 'ganze Datei' ? [h('label', { for: 'rch-ft-wert' }, 'Wert'), entwurf('input', 'rch-ft-wert', 'rch-ft-wert', { autocomplete: 'off', type: 'text', 'aria-label': 'Wert der Fundstelle', maxlength: '120', style: 'flex:1 1 220px;min-width:0' })]
          : (typ === 'ganze Datei' ? h('span', { class: 'note' }, 'Der Verweis gilt der ganzen Datei.') : h('span', { class: 'note' }, 'Ohne Fundstelle gespeichert.'))),
      h('details', { id: 'rch-weitere', open: K.weitere, ontoggle: function (ev) { K.weitere = ev.target.open; } }, h('summary', null, 'Weitere Optionen'),
        h('div', { class: 'row' }, h('label', { for: 'rch-ft-typ2' }, 'Andere Fundstellenart'),
          sel('rch-ft-typ2', 'Andere Art der Fundstelle', [['', 'wie oben']].concat(RCH_FUNDSTELLEN.map(function (x) { return [x, x]; })), typ2, function (ev) { VIEW.draft['rch-ft-typ2'] = ev.target.value; renderModule(); })),
        h('div', { class: 'row' }, h('label', { for: 'rch-notiz' }, 'Anmerkung'), entwurf('input', 'rch-notiz', 'rch-notiz', { autocomplete: 'off', type: 'text', 'aria-label': 'Anmerkung zur Unterlage', maxlength: '300', style: 'flex:1 1 300px;min-width:0' }))),
      h('div', { class: 'row' },
        h('button', { type: 'button', id: 'rch-ok', onclick: function () { rchErfassen(e); } }, 'Unterlage speichern'),
        h('button', { type: 'button', id: 'rch-abbruch', onclick: function () { K.offen = false; renderModule(); } }, 'Abbrechen')));
  }
  const bereich = h('details', { class: 'panel dossier-unterlagen', id: 'rch-dossier-unterlagen', 'data-dossier': e.id, open: K.unterlagenOffen.has(e.id) },
    h('summary', { onclick: function (ev) {
      ev.preventDefault();
      bereich.open = !bereich.open;
      if (bereich.open) K.unterlagenOffen.add(e.id); else K.unterlagenOffen.delete(e.id);
    } }, 'Unterlagen zu diesem Dossier', h('span', { class: 'badge' }, String(liste.length))),
    h('div', { class: 'row pad' },
      h('button', { type: 'button', id: 'rch-neu', 'aria-expanded': K.offen ? 'true' : 'false', onclick: function () { K.offen = !K.offen; renderModule(); } }, K.offen ? 'Formular schließen' : 'Unterlage hinzufügen'),
      alt ? h('span', { class: 'note' }, 'Ältere Unterlagen aus Aufträgen liegen unter Aufklärung und Freigabe.') : null),
    formular,
    liste.length ? liste.map(function (z) { return rchUnterlageZeile(e, z); })
      : h('p', { class: 'note pad' }, 'Diesem Dossier sind noch keine Unterlagen zugeordnet.'));
  return bereich;
}

/* Orte zum Dossier: Zonen und Pins, die auf dieses Dossier verweisen (Rückbezug der Verknüpfung auf der Karte) */
function rechercheOrte(e) {
  const liste = (PROFIL.zonen || []).filter(function (z) { return z.dossier === e.id; }).map(function (z) { return { id: z.id, art: 'Zone', name: z.name, zusatz: 'Radius ' + z.r + ' m' }; })
    .concat((PROFIL.pins || []).filter(function (x) { return x.dossier === e.id; }).map(function (x) { return { id: x.id, art: 'Pin', name: x.name, zusatz: '' }; }));
  if (!liste.length) return null;
  return panel('Orte zu diesem Dossier', [h('span', { class: 'badge' }, String(liste.length))],
    h('div', { class: 'pad', id: 'rch-orte' }, liste.map(function (o) {
      return h('div', { class: 'row' }, h('span', null, o.art + ' ' + o.name + (o.zusatz ? ' · ' + o.zusatz : '')),
        h('button', { type: 'button', class: 'link', 'data-ort': o.id, onclick: function () { if (typeof kartenObjektZeigen === 'function') kartenObjektZeigen(o.id); } }, 'Auf der Karte zeigen'));
    })));
}
function rechercheDossier(e) { return [rechercheBelege(e), rechercheOrte(e), h('details', { class: 'pad', id: 'rch-datentransfer' }, h('summary', null, 'Datentransfer'), rechercheFallpaket())].filter(Boolean); }

/* =====================================================================
   FALLPAKET: ein Fall als eine Datei (Datensätze, benötigte Dossierangaben, Belegdateien), mit Manifest und Prüfsummen.
   Prüfen vor Übernehmen (alles oder nichts), Zusammenführen ohne Überschreiben: abweichende Nummern erhalten neue Nummern.
   ===================================================================== */
const RCH_PLURAL = { fall: 'faelle', quelle: 'quellen', fassung: 'fassungen', beobachtung: 'beobachtungen', aussage: 'aussagen' };
function rchKanon(o) {
  if (Array.isArray(o)) return '[' + o.map(rchKanon).join(',') + ']';
  if (o && typeof o === 'object') return '{' + Object.keys(o).sort().filter(function (k) { return o[k] !== undefined; }).map(function (k) { return JSON.stringify(k) + ':' + rchKanon(o[k]); }).join(',') + '}';
  return JSON.stringify(o === undefined ? null : o);
}
function rchHex(buf) { return Array.prototype.map.call(new Uint8Array(buf), function (x) { return ('0' + x.toString(16)).slice(-2); }).join(''); }
function rchTextHash(t) { return crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)).then(rchHex); }
function rchBase64(blob) {
  return new Promise(function (ok, nein) {
    const r = new FileReader(); r.onerror = function () { nein(r.error); };
    r.onload = function () { ok(String(r.result).split(',')[1] || ''); }; r.readAsDataURL(blob);
  });
}
function rchAusBase64(b64, typ) {
  const bin = atob(b64), u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return new Blob([u], { type: typ || 'application/octet-stream' });
}
function rchKopie(o) { return JSON.parse(JSON.stringify(o)); }

/* ---------- Export ---------- */
function rchPaketBauen(fallId) {
  const R = PROFIL.recherche, fall = R.faelle.find(function (f) { return f.id === fallId; });
  if (!fall) return Promise.reject(new Error('Fall nicht gefunden.'));
  const quellen = R.quellen.filter(function (q) { return q.fall === fall.id; }), qid = {}; quellen.forEach(function (q) { qid[q.id] = 1; });
  const fassungen = R.fassungen.filter(function (f) { return qid[f.quelle]; }), fid = {}; fassungen.forEach(function (f) { fid[f.id] = 1; });
  const beobachtungen = R.beobachtungen.filter(function (b) { return fid[b.fassung]; });
  const aussagen = R.aussagen.filter(function (a) { return a.fall === fall.id; });
  if (xDossiers(fall).some(function (id) { const e = entitaet(id); return e && !xDossierLesbar(e); })) return Promise.reject(new Error('Ein verknüpftes Dossier ist gesperrt oder nicht freigegeben.'));
  const dids = {}; xDossiers(fall).forEach(function (id) { dids[id] = 1; }); beobachtungen.concat(aussagen).forEach(function (x) { (x.dossiers || []).forEach(function (d) { dids[d] = 1; }); });
  const dossiers = Object.keys(dids).sort().map(function (id) {
    const e = entitaet(id);
    if (!e) return { id: id, name: '(unbekannt)', typ: 'Person', land: 'DE', fehlt: true };
    const d = { id: e.id, typ: e.typ, name: e.name, land: e.land, aliase: e.aliase || [], rolle: e.rolle || '', eckdaten: e.eckdaten || [], bedrohung: e.bedrohung || null, eigen: !!e.eigen };
    if (PROFIL.koord[e.id]) d.koord = PROFIL.koord[e.id];
    return d;
  });
  const paketFall = Object.assign({}, fall); delete paketFall.pins;   /* Die Profil-JSON transportiert Kartenpins. Fallpakete enthalten nur Recherchematerial. */
  const inhalt = rchKopie({ fall: paketFall, quellen: quellen, fassungen: fassungen, beobachtungen: beobachtungen, aussagen: aussagen, dossiers: dossiers });
  const dateien = {}, liste = [];
  const mitDatei = fassungen.filter(function (f) { return f.anhang; });
  return mitDatei.reduce(function (kette, f) {
    return kette.then(function () {
      return RIDB.get(f.anhang).then(function (blob) {
        const eintrag = { key: f.anhang, dateiname: f.dateiname, groesse: f.groesse, typ: f.typ, hashImBeleg: f.hash || null };
        if (!blob) { eintrag.status = 'fehlt'; eintrag.sha256 = null; liste.push(eintrag); return null; }
        return rchHash(blob).then(function (hash) {
          eintrag.sha256 = hash; eintrag.groesse = blob.size;
          eintrag.status = !hash ? 'ohne Prüfsumme' : f.hash && f.hash !== hash ? 'abweichend' : 'ok';
          liste.push(eintrag);
          return rchBase64(blob).then(function (b64) { dateien[f.anhang] = b64; });
        });
      });
    });
  }, Promise.resolve()).then(function () {
    return rchTextHash(rchKanon({ inhalt: inhalt, dateien: liste }));                 /* die Prüfsummen der Dateien sind selbst gesichert */
  }).then(function (inhaltHash) {
    const manifest = { erstellt: nowIso(), programm: 'Field Terminal', fall: { id: fall.id, titel: fall.titel },
      zaehler: { quellen: quellen.length, fassungen: fassungen.length, beobachtungen: beobachtungen.length, aussagen: aussagen.length, dossiers: dossiers.length, dateien: Object.keys(dateien).length },
      dateien: liste, inhaltHash: inhaltHash,
      hinweis: 'Das Paket enthält nur die für den Fall benötigten Dossierangaben (ohne Bilder und Notizen) und die Belegdateien. Die Dateien sind einzeln mit SHA-256 gesichert.' };
    const warn = liste.filter(function (x) { return x.status !== 'ok'; });
    return { text: JSON.stringify({ format: 'fieldterminal-fallpaket', v: 1, manifest: manifest, inhalt: inhalt, dateien: dateien }), manifest: manifest, warnungen: warn };
  });
}
function rchPaketSichern(fallId) {
  if (!fallId) { meldung('Bitte zuerst einen Fall wählen.'); return; }
  rchPaketBauen(fallId).then(function (p) {
    const datei = 'fallpaket-' + fallId + '-' + dtg(new Date()) + '.json';
    const blob = new Blob([p.text], { type: 'application/json' }), url = URL.createObjectURL(blob), a = h('a', { href: url, download: datei });
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    const z = p.manifest.zaehler;
    meldung('Fallpaket gesichert: ' + datei + ' (' + z.quellen + ' Quellen, ' + z.beobachtungen + ' Unterlagen, ' + z.dateien + ' Dateien' + (z.aussagen ? ', ' + z.aussagen + ' frühere Aussagen' : '') + ')' +
      (p.warnungen.length ? '. ACHTUNG: ' + p.warnungen.map(function (x) { return x.key + ' ' + x.status; }).join(', ') + ' (im Manifest vermerkt)' : '') + '.');
  }).catch(function (e) { meldung('Fallpaket nicht erstellt: ' + (e && e.message ? e.message : 'unbekannter Fehler') + '.'); });
}

/* ---------- Prüfen (vor jeder Änderung) ---------- */
function rchPaketPruefen(o) {
  const fehler = [];
  const nok = function (t) { fehler.push(t); return Promise.resolve({ fehler: fehler }); };
  if (!o || o.format !== 'fieldterminal-fallpaket' || o.v !== 1) return nok('kein Fallpaket dieser Version');
  const i = o.inhalt, m = o.manifest;
  if (!i || !m || !i.fall || typeof i.fall.id !== 'string' || !['quellen', 'fassungen', 'beobachtungen', 'aussagen', 'dossiers'].every(function (k) { return Array.isArray(i[k]); })) return nok('Aufbau unvollständig');
  const muster = { fall: /^F-\d+$/, quelle: /^Q-\d+$/, fassung: /^V-\d+$/, beobachtung: /^B-\d+$/, aussage: /^A-\d+$/ };
  if (!muster.fall.test(i.fall.id)) return nok('ungültige Fallnummer');
  const ids = function (l, art) { const s = {}; l.forEach(function (x) { if (!x || !muster[art].test(x.id || '') || s[x.id]) fehler.push('ungültige oder doppelte Nummer in ' + RCH_PLURAL[art] + ': ' + (x && x.id)); else s[x.id] = 1; }); return s; };
  const q = ids(i.quellen, 'quelle'), f = ids(i.fassungen, 'fassung'), b = ids(i.beobachtungen, 'beobachtung'); ids(i.aussagen, 'aussage');
  i.quellen.forEach(function (x) { if (x.fall !== i.fall.id) fehler.push(x.id + ' gehört nicht zum Fall'); });
  i.fassungen.forEach(function (x) { if (!q[x.quelle]) fehler.push(x.id + ': Quelle ' + x.quelle + ' fehlt'); });
  i.beobachtungen.forEach(function (x) { if (!f[x.fassung]) fehler.push(x.id + ': Fassung ' + x.fassung + ' fehlt'); });
  i.aussagen.forEach(function (x) { if (x.fall !== i.fall.id) fehler.push(x.id + ' gehört nicht zum Fall'); ['stuetzend', 'widersprechend'].forEach(function (k) { if (!Array.isArray(x[k])) fehler.push(x.id + ': ' + k + ' fehlt'); else x[k].forEach(function (l) { if (!b[l.beob]) fehler.push(x.id + ': Beleg ' + l.beob + ' fehlt'); }); }); });
  if (fehler.length) return Promise.resolve({ fehler: fehler.slice(0, 8) });
  if (!(window.crypto && crypto.subtle)) return nok('Prüfsummen sind in diesem Browser nicht berechenbar; das Paket wird nicht übernommen');
  return rchTextHash(rchKanon({ inhalt: i, dateien: Array.isArray(m.dateien) ? m.dateien : [] })).then(function (h1) {
    if (h1 !== m.inhaltHash) return { fehler: ['Inhalt oder Dateiliste stimmen nicht mit der Prüfsumme im Manifest überein (Paket verändert oder beschädigt)'] };
    const blobs = {}, fehlend = [], liste = Array.isArray(m.dateien) ? m.dateien : [];
    const keys = {}; i.fassungen.forEach(function (x) { if (x.anhang) keys[x.anhang] = x; });
    return liste.reduce(function (kette, d) {
      return kette.then(function () {
        if (!d || !keys[d.key]) { fehler.push('Manifest nennt Datei ohne Beleg: ' + (d && d.key)); return null; }
        if (d.status === 'fehlt') { fehlend.push(d.key); return null; }
        if (d.status === 'ok' && keys[d.key].hash && keys[d.key].hash !== d.sha256) { fehler.push('Manifest und Beleg widersprechen sich bei ' + d.key + ' (Prüfsumme)'); return null; }
        const b64 = o.dateien && o.dateien[d.key];
        if (typeof b64 !== 'string') { fehler.push('Datei fehlt im Paket: ' + d.key); return null; }
        let blob; try { blob = rchAusBase64(b64, d.typ); } catch (x) { fehler.push('Datei nicht lesbar: ' + d.key); return null; }
        if (blob.size > RCH_MAX) { fehler.push('Datei über 20 MB: ' + d.key); return null; }
        return rchHash(blob).then(function (hash) {
          if (!hash || hash !== d.sha256) fehler.push('Prüfsumme der Datei ' + d.key + ' (' + d.dateiname + ') stimmt nicht');
          else blobs[d.key] = { blob: blob, hash: hash };
        });
      });
    }, Promise.resolve()).then(function () {
      Object.keys(keys).forEach(function (k) { if (!blobs[k] && fehlend.indexOf(k) < 0 && !fehler.length) fehler.push('Datei ' + k + ' ist im Manifest nicht aufgeführt'); });
      return { fehler: fehler.slice(0, 8), blobs: blobs, fehlend: fehlend };
    });
  });
}

/* ---------- Zusammenführen (gemeinsam für Fallpaket und Profilimport) ---------- */
let RCH_LETZTER = null;
function rchZusammenfuehren(inh, opt) {
  if (!inh.faelle && inh.fall) inh = Object.assign({}, inh, { faelle: [inh.fall] });             /* Fallpaket: ein Fall; Profil: Liste */
  const R = PROFIL.recherche, z = { neu: 0, gleich: 0, neueNr: 0, ohneDossier: 0, verlorenVerkn: 0, verworfen: 0 };
  const map = { fall: {}, quelle: {}, fassung: {}, beobachtung: {}, aussage: {} };
  Object.keys(RCH_PLURAL).forEach(function (art) {                   /* eingehende Nummern vorab reservieren, damit Ersatznummern nie kollidieren */
    const k = RCH_ID[art][1], hoechst = (inh[RCH_PLURAL[art]] || []).reduce(function (mx, x) { const n = /^[A-Z]-(\d+)$/.exec(x && x.id || ''); return n ? Math.max(mx, Number(n[1])) : mx; }, 0);
    R.seq[k] = Math.max(R.seq[k] || 0, hoechst);
  });
  const inhaltVon = function (y, art) { const c = rchKopie(y); if (art === 'fall' && !opt.pin) delete c.pins; delete c.id; delete c.importVon; delete c.aktuelleFassung; delete c._af; return rchKanon(c); };
  const schritt = function (art, umbau) {
    (inh[RCH_PLURAL[art]] || []).forEach(function (x) {
      const liste = R[RCH_PLURAL[art]], c = umbau(rchKopie(x));
      if (!c) { z.verworfen += 1; return; }
      const lokal = liste.find(function (y) { return y.id === x.id; });
      if (!lokal) { liste.push(c); map[art][x.id] = c.id; z.neu += 1; return; }
      if (inhaltVon(lokal, art) === inhaltVon(c, art)) { map[art][x.id] = lokal.id; z.gleich += 1; return; }
      const kopie = liste.find(function (y) { return y.importVon === x.id && inhaltVon(y, art) === inhaltVon(c, art); });
      if (kopie) { map[art][x.id] = kopie.id; z.gleich += 1; return; }
      c.id = rchNr(art); c.importVon = x.id; liste.push(c); map[art][x.id] = c.id; z.neueNr += 1;
    });
  };
  const dos = function (l) { const aus = []; (l || []).forEach(function (d) { const n = opt.dossier(d); if (n) { if (aus.indexOf(n) < 0) aus.push(n); } else z.ohneDossier += 1; }); return aus; };
  schritt('fall', function (c) {
    if (Object.prototype.hasOwnProperty.call(c, 'dossiers')) c.dossiers = dos(xDossiers(c));
    if (Object.prototype.hasOwnProperty.call(c, 'pins')) {
      if (opt.pin) c.pins = Array.from(new Set(xPins(c).map(opt.pin).filter(Boolean)));
      else delete c.pins;
    }
    return c;
  });
  schritt('quelle', function (c) { c.fall = map.fall[c.fall]; if (!c.fall) return null; c._af = c.aktuelleFassung; c.aktuelleFassung = null; return c; });
  schritt('fassung', function (c) { c.quelle = map.quelle[c.quelle]; if (!c.quelle) return null; if (c.anhang && opt.dateiKey && opt.dateiKey[c.anhang]) c.anhang = opt.dateiKey[c.anhang]; return c; });
  R.quellen.forEach(function (qq) { if (qq._af !== undefined) { qq.aktuelleFassung = map.fassung[qq._af] || null; delete qq._af; } });
  schritt('beobachtung', function (c) { c.fassung = map.fassung[c.fassung]; if (!c.fassung) return null; c.dossiers = dos(c.dossiers); return c; });
  schritt('aussage', function (c) {
    c.fall = map.fall[c.fall]; if (!c.fall) return null; c.dossiers = dos(c.dossiers);
    ['stuetzend', 'widersprechend'].forEach(function (k) {
      const vor = (c[k] || []).length; c[k] = (c[k] || []).filter(function (l) { return map.beobachtung[l.beob]; }).map(function (l) { return Object.assign({}, l, { beob: map.beobachtung[l.beob] }); }); z.verlorenVerkn += vor - c[k].length;
    });
    return c;
  });
  z.map = map;
  return z;
}
function rchZusammenfassung(z) {
  return z.neu + ' neue Datensätze, ' + z.gleich + ' bereits vorhanden' + (z.neueNr ? ', ' + z.neueNr + ' mit abweichendem Inhalt unter neuer Nummer übernommen' : '') +
    (z.ohneDossier ? ', ' + z.ohneDossier + ' Dossierverknüpfung(en) nicht zuordenbar (nicht übernommen)' : '') + (z.verlorenVerkn ? ', ' + z.verlorenVerkn + ' Belegverknüpfung(en) nicht übernommen' : '') +
    (z.verworfen ? ', ' + z.verworfen + ' Datensatz/Datensätze unvollständig, nicht übernommen' : '');
}
/* Profilimport: Dossiernummern gelten nur, wenn das lokale Dossier dasselbe ist */
function rchProfilZusammenfuehren(rq, q, pinNeu) {
  rchProfilZusammenfuehren.abbildung = null;      /* eingehende → lokale Nummern des letzten Laufs, für Verweise aus anderen Objekten (Zonen) */
  if (!rq || !['faelle', 'quellen', 'fassungen', 'beobachtungen', 'aussagen'].every(function (k) { return Array.isArray(rq[k] || []); })) return '; Recherchedaten im Profil unlesbar, nicht übernommen';
  const eing = {}; (q.eigene || []).forEach(function (e) { eing[e.id] = e; });
  const z = rchZusammenfuehren(rq, { dossier: function (id) {
    const lok = entitaet(id), e = eing[id];
    if (e) return lok && lok.name === e.name && lok.typ === e.typ ? id : null;
    return lok ? id : null;
  }, pin: function (id) {
    return Array.isArray(q.pins) && q.pins.some(function (p) { return p && p.id === id && Array.isArray(p.ll); }) ? ((pinNeu || {})[id] || id) : null;
  } });
  rchProfilZusammenfuehren.abbildung = z.map;
  const mitDatei = (rq.fassungen || []).some(function (f) { return f && f.anhang; });
  return '; Recherche: ' + rchZusammenfassung(z) + (mitDatei ? '. Belegdateien sind nicht Teil der Profilsicherung; dafür Fallpakete verwenden' : '');
}

/* ---------- Übernehmen ---------- */
ACTIONS.RECHERCHE_PAKET_IMPORT = function (a) {
  const i = a.inhalt; if (!i || !Array.isArray(i.dossiers)) return null;
  const t = nowIso(), neueDossiers = [], dmap = {};
  i.dossiers.forEach(function (d) {
    const lok = entitaet(ID_STD[d.id] || d.id);                       /* Pakete mit alten Nummern: Beispiele über die Zuordnungstabelle */
    if (lok && lok.name === d.name && lok.typ === d.typ) { dmap[d.id] = lok.id; return; }
    const kopie = STATE.dossiers.eigene.find(function (e) { return e.importVon && e.importVon.id === d.id && e.importVon.name === d.name && e.typ === d.typ; });
    if (kopie) { dmap[d.id] = kopie.id; return; }
    const typ = ['Person', 'Organisation', 'Ort'].indexOf(d.typ) >= 0 ? d.typ : 'Person', name = String(d.name || '').trim().slice(0, 120) || '(ohne Namen)';
    const zl = function (l) { return (Array.isArray(l) ? l : []).map(function (x) { return String(x).slice(0, 200); }).filter(Boolean).slice(0, 30); };
    STATE.seq.eigen = (STATE.seq.eigen || 0) + 1;
    const id = idNaechste(typ === 'Person' ? 'P' : typ === 'Organisation' ? 'O' : 'L', idBelegtLokal(alleEntitaeten().concat(PROFIL.eigene || [])));
    const b = d.bedrohung && typeof d.bedrohung === 'object' ? { stufe: Math.min(5, Math.max(1, Number(d.bedrohung.stufe) || 2)), begruendung: String(d.bedrohung.begruendung || 'Aus Fallpaket übernommen.').slice(0, 300) } : { stufe: 2, begruendung: 'Aus Fallpaket übernommen.' };
    STATE.dossiers.eigene.push({ id: id, typ: typ, land: SCENARIO.laender[d.land] ? d.land : 'DE', mission: 'STD', name: name, bild: null, aliase: zl(d.aliase), reg: 'ohne', verteiler: 'Eigener Eintrag',
      rolle: String(d.rolle || '').slice(0, 500) || 'Aus Fallpaket übernommen.', eckdaten: zl(d.eckdaten), bedrohung: b, nachtraege: [], eigen: true, importVon: { id: d.id, name: d.name } });
    STATE.dossiers.entitaeten[id] = { status: null, statusAm: null, notizen: [], aktualisiert: t };
    if (Array.isArray(d.koord) && d.koord.length === 2 && d.koord.every(function (x) { return typeof x === 'number' && isFinite(x); })) PROFIL.koord[id] = d.koord;
    dmap[d.id] = id; neueDossiers.push(id);
  });
  const z = rchZusammenfuehren(i, { dossier: function (id) { return dmap[id] || null; }, dateiKey: a.dateiKey || {} });
  RCH_LETZTER = { z: z, dossiers: neueDossiers.length };
  if (!(z.neu || z.neueNr || neueDossiers.length)) return null;
  return { modul: 'Dossier', aktion: 'Fallpaket geladen', detail: a.datei + ': Fall ' + i.fall.id + ' ' + kuerzen(String(i.fall.titel || ''), 60) + ': ' + rchZusammenfassung(z) + (neueDossiers.length ? '; ' + neueDossiers.length + ' Dossier(s) neu angelegt' : '') };
};
function rchPaketLaden(file) {
  const r = new FileReader();
  r.onerror = function () { meldung('Fallpaket nicht lesbar.'); };
  r.onload = function () {
    let o = null; try { o = JSON.parse(String(r.result)); } catch (x) { /* ungültig */ }
    const neu = [];                                                     /* nur Dateien dieses Importversuchs */
    const aufraeumen = function () { return Promise.all(neu.map(function (k) { return RIDB.del(k).catch(function () {}); })); };
    rchPaketPruefen(o).then(function (p) {
      if (p.fehler.length) { meldung('Fallpaket abgelehnt, nichts übernommen: ' + p.fehler.join('; ') + '.'); return null; }
      const dateiKey = {};
      return Object.keys(p.blobs).reduce(function (kette, k) {
        return kette.then(function () {
          return RIDB.get(k).then(function (vorhanden) {
            if (!vorhanden) { return RIDB.put(k, p.blobs[k].blob).then(function () { neu.push(k); }); }          /* fehlende Datei: wird (wieder) abgelegt */
            return rchHash(vorhanden).then(function (h1) {
              if (h1 === p.blobs[k].hash) return null;                                  /* dieselbe Datei liegt schon vor */
              /* anderer Inhalt unter demselben Schlüssel: Ersatzschlüssel aus dem Inhalt, damit ein Wiederholungsimport dieselbe Zuordnung ergibt */
              const k2 = k + '-' + p.blobs[k].hash.slice(0, 12); dateiKey[k] = k2;
              return RIDB.get(k2).then(function (da) {
                if (!da) return RIDB.put(k2, p.blobs[k].blob).then(function () { neu.push(k2); });
                /* Der Ersatzschlüssel ist bereits belegt: nur dieselbe Datei gilt als vorhanden. Eine abweichende wird nicht überschrieben, der Import bricht ab. */
                return rchHash(da).then(function (h2) {
                  if (h2 !== p.blobs[k].hash) throw { abbruch: 'Fallpaket abgelehnt, nichts übernommen: Die vorhandene Belegdatei ' + k2 + ' stimmt nicht mit der Prüfsumme im Paket überein (beschädigt oder verändert). Sie wurde nicht überschrieben' };
                  return null;
                });
              });
            });
          });
        });
      }, Promise.resolve()).then(function () {
        RCH_LETZTER = null;
        const vorKoord = JSON.stringify(PROFIL.koord), vorEigene = STATE.dossiers.eigene.slice(), vorSeq = STATE.seq.eigen, vorEnt = Object.keys(STATE.dossiers.entitaeten);
        const zurueck = function () {
          STATE.dossiers.eigene = vorEigene; STATE.seq.eigen = vorSeq; PROFIL.koord = JSON.parse(vorKoord);
          Object.keys(STATE.dossiers.entitaeten).forEach(function (id) { if (vorEnt.indexOf(id) < 0) delete STATE.dossiers.entitaeten[id]; });
        };
        zurueck.geaendert = function () { return STATE.dossiers.eigene.length !== vorEigene.length; };
        const ok = rchSchreiben({ type: 'RECHERCHE_PAKET_IMPORT', inhalt: o.inhalt, dateiKey: dateiKey, datei: file.name }, 'Fallpaket geladen', zurueck);
        if (!ok) {
          if (rchSchreiben.fehler || !RCH_LETZTER) { aufraeumen(); }                      /* gescheitert: nichts bleibt halb übernommen */
          else if (neu.length) meldung('Fallpaket ' + o.inhalt.fall.id + ': ' + neu.length + ' fehlende Belegdatei(en) wiederhergestellt, Datensätze unverändert.');
          else meldung('Fallpaket ' + o.inhalt.fall.id + ' ist bereits vollständig vorhanden, nichts geändert.');
        } else if (!p.fehlend.length) meldung('Fallpaket ' + o.inhalt.fall.id + ' geladen: ' + rchZusammenfassung(RCH_LETZTER.z) + (RCH_LETZTER.dossiers ? '; ' + RCH_LETZTER.dossiers + ' Dossier(s) neu angelegt' : '') + '.');
        else if (p.fehlend.length) meldung('Hinweis: ' + p.fehlend.length + ' Belegdatei(en) fehlten schon im Paket (' + p.fehlend.join(', ') + ').');
        renderModule();
      });
    }).catch(function (fe) { aufraeumen(); meldung(fe && fe.abbruch ? fe.abbruch + '.' : 'Fallpaket konnte nicht übernommen werden (Browserspeicher nicht verfügbar); nichts übernommen.'); });
  };
  r.readAsText(file);
}
function rechercheFallpaket() {
  const R = PROFIL.recherche;
  return panel('Fallpaket', [h('span', { class: 'badge' }, String(R.faelle.length))],
    h('div', { class: 'pad' }, h('p', { class: 'note' }, 'Ein Fall mit allen Quellen, Unterlagen, Dateien und den benötigten Dossierangaben als eine Datei. Beim Laden wird vor jeder Änderung geprüft; Vorhandenes wird nie überschrieben.' + (R.aussagen.length ? ' Frühere Aussagen (' + R.aussagen.length + ') sind nicht mehr bearbeitbar und reisen unverändert im Paket mit.' : '')),
      h('div', { class: 'row' }, h('label', { for: 'rfp-fall' }, 'Fall'),
        h('select', { id: 'rfp-fall', 'aria-label': 'Fall für das Fallpaket', onchange: function (ev) { VIEW.draft['rch-fp-fall'] = ev.target.value; } },
          [h('option', { value: '' }, '– Fall wählen –')].concat(R.faelle.map(function (f) { return h('option', { value: f.id, selected: f.id === VIEW.draft['rch-fp-fall'] }, f.id + ' ' + f.titel); }))),
        h('button', { type: 'button', id: 'rfp-ex', onclick: function () { rchPaketSichern(VIEW.draft['rch-fp-fall'] || ''); } }, 'Fallpaket sichern'),
        h('label', { for: 'rfp-in' }, 'Fallpaket laden'),
        h('input', { type: 'file', id: 'rfp-in', accept: 'application/json,.json', onchange: function (ev) { const fl = ev.target.files && ev.target.files[0]; ev.target.value = ''; if (fl) rchPaketLaden(fl); } }))));
}
