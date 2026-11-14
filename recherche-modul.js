/* =====================================================================
   MODUL 8: RECHERCHEBELEGE (Fallkern, erster Schnitt)
   Belege am Dossier ohne laufenden Auftrag. Eigener Schreib- und Lesepfad, getrennt vom Missionspfad (ms.dokumente).
   Datenvertrag: docs/datenvertrag.md. Objekte: Fall, Quelle, Fassung, Beobachtung (PROFIL.recherche, im Profil gespeichert).
   Dateien liegen bytegetreu in einer eigenen IndexedDB ('fieldterminal.recherche'), die das Zurücksetzen des Zustands nicht leert.
   Klassisches Skript, wird nach dem Hauptskript geladen; vom Hauptskript nur zur Laufzeit referenziert.
   ===================================================================== */
VIEW.recherche = VIEW.recherche || {};
PROFIL.recherche = PROFIL.recherche || { faelle: [], quellen: [], fassungen: [], beobachtungen: [], aussagen: [], seq: { fall: 0, quelle: 0, fassung: 0, beobachtung: 0, aussage: 0 } };
['faelle', 'quellen', 'fassungen', 'beobachtungen', 'aussagen'].forEach(function (k) { PROFIL.recherche[k] = PROFIL.recherche[k] || []; });
PROFIL.recherche.seq = Object.assign({ fall: 0, quelle: 0, fassung: 0, beobachtung: 0, aussage: 0 }, PROFIL.recherche.seq || {});
PROFIL_AKTIONEN.RECHERCHE_BELEG = 1;

const RCH_MAX = 20 * 1024 * 1024;
const RCH_FUNDSTELLEN = ['Seite', 'Absatz', 'Zeitmarke', 'Zeichenbereich', 'ganze Datei'];
const RCH_ID = { fall: ['F-', 'fall'], quelle: ['Q-', 'quelle'], fassung: ['V-', 'fassung'], beobachtung: ['B-', 'beobachtung'], aussage: ['A-', 'aussage'] };
const RCH_STATUS = [['entwurf', 'Entwurf'], ['offen', 'offen'], ['abgeschlossen', 'abgeschlossen']];
const RCH_EINSCHAETZUNG = [['', 'nicht eingeschätzt'], ['widerlegt', 'widerlegt'], ['dagegen', 'spricht dagegen'], ['unentschieden', 'unentschieden'], ['dafuer', 'spricht dafür'], ['gestuetzt', 'gestützt']];

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
function rchSchreiben(aktion, aktionsName) {
  const R = PROFIL.recherche, sicher = JSON.stringify(R), logN = STATE.log.length;
  dispatch(aktion);
  if (JSON.stringify(R) === sicher) return false;                       /* nichts geändert (abgelehnt) */
  if (profilSpeichern()) return true;
  rchWiederherstellen(sicher);
  for (let i = STATE.log.length - 1; i >= logN && i >= 0; i--) { if (STATE.log[i].detail && STATE.log[i].aktion === aktionsName) { STATE.log.splice(i, 1); break; } }
  meldung('Nicht gespeichert: Profilspeicher voll oder nicht beschreibbar. Die Eingabe bleibt erhalten.');
  return false;
}

/* ---------- Aktion ---------- */
ACTIONS.RECHERCHE_BELEG = function (a) {
  const R = PROFIL.recherche, e = entitaet(a.dossier);
  if (!e || !a.fassung || !a.fundstelle) return null;
  let fall = a.fall ? R.faelle.find(function (f) { return f.id === a.fall; }) : null, neuerFall = false;
  if (!fall && a.neuerFall && a.neuerFall.titel) {
    fall = { id: rchNr('fall'), titel: String(a.neuerFall.titel).slice(0, 120), frage: String(a.neuerFall.frage || '').slice(0, 300), zustand: 'offen', erfasst: nowIso() };
    R.faelle.push(fall); neuerFall = true;
  }
  if (!fall) return null;                                    /* kein stiller Standardfall */
  const t = nowIso(), q = { id: rchNr('quelle'), fall: fall.id, art: a.art, herkunft: String(a.herkunft || '').slice(0, 300), erfasst: t, aktuelleFassung: null, notiz: String(a.notiz || '').slice(0, 300) };
  const f = Object.assign({ id: rchNr('fassung'), quelle: q.id, erfasst: t }, a.fassung);
  q.aktuelleFassung = f.id;
  const b = { id: rchNr('beobachtung'), fassung: f.id, fundstelle: a.fundstelle, zitat: String(a.zitat || '').slice(0, 2000), ereignis: null, dossiers: [e.id], erfasst: t };
  R.quellen.push(q); R.fassungen.push(f); R.beobachtungen.push(b);
  return { modul: 'Dossier', aktion: 'Recherchebeleg erfasst', detail: e.id + ' ' + e.name + ': ' + q.id + ' (' + q.art + ') im Fall ' + fall.id + (neuerFall ? ' (neu angelegt)' : '') + ', Fundstelle ' + a.fundstelle.typ + (a.fundstelle.wert ? ' ' + a.fundstelle.wert : '') };
};

/* ---------- Aussagen ---------- */
function rchAussage(id) { return PROFIL.recherche.aussagen.find(function (x) { return x.id === id; }) || null; }
function rchVerknuepfung(a, beob) {
  const s = a.stuetzend.find(function (x) { return x.beob === beob; });
  if (s) return { l: s, rolle: 'stuetzend' };
  const w = a.widersprechend.find(function (x) { return x.beob === beob; });
  return w ? { l: w, rolle: 'widersprechend' } : null;
}
ACTIONS.RECHERCHE_AUSSAGE_NEU = function (a) {
  const R = PROFIL.recherche, e = entitaet(a.dossier), fall = R.faelle.find(function (f) { return f.id === a.fall; }), text = String(a.text || '').trim().slice(0, 500);
  if (!e || !fall || !text) return null;                                 /* kein stiller Standardfall */
  const x = { id: rchNr('aussage'), fall: fall.id, text: text, status: 'entwurf', einschaetzung: null, begruendung: '', dossiers: [e.id], stuetzend: [], widersprechend: [], erfasst: nowIso(), geaendert: nowIso() };
  R.aussagen.push(x);
  return { modul: 'Dossier', aktion: 'Aussage angelegt', detail: x.id + ' im Fall ' + fall.id + ' (Dossier ' + e.id + '): ' + kuerzen(text, 80) };
};
ACTIONS.RECHERCHE_AUSSAGE_SETZEN = function (a) {
  const x = rchAussage(a.id); if (!x) return null;
  const teile = [];
  if (a.status && RCH_STATUS.some(function (s) { return s[0] === a.status; }) && a.status !== x.status) { x.status = a.status; teile.push('Status ' + a.status); }
  if (a.begruendung != null && String(a.begruendung) !== x.begruendung) { x.begruendung = String(a.begruendung).slice(0, 1000); teile.push('Begründung'); }
  if (a.einschaetzung !== undefined && (a.einschaetzung || null) !== x.einschaetzung) {
    const st = a.einschaetzung || null;
    if (st && !RCH_EINSCHAETZUNG.some(function (s) { return s[0] === st; })) return null;
    if ((st === 'gestuetzt' || st === 'dafuer') && !x.stuetzend.length) return null;          /* ohne Fundstelle nie als belegt */
    if ((st === 'widerlegt' || st === 'dagegen') && !x.widersprechend.length) return null;
    if (st && !x.begruendung.trim()) return null;
    x.einschaetzung = st; teile.push('Einschätzung ' + (st || 'zurückgenommen'));
  }
  if (!teile.length) return null;
  x.geaendert = nowIso();
  return { modul: 'Dossier', aktion: 'Aussage geändert', detail: x.id + ': ' + teile.join(', ') };
};
ACTIONS.RECHERCHE_BELEG_VERKNUEPFT = function (a) {
  const R = PROFIL.recherche, x = rchAussage(a.aussage), b = R.beobachtungen.find(function (y) { return y.id === a.beob; });
  if (!x || !b || (a.rolle !== 'stuetzend' && a.rolle !== 'widersprechend') || rchVerknuepfung(x, b.id)) return null;
  const f = R.fassungen.find(function (y) { return y.id === b.fassung; }) || {}, q = R.quellen.find(function (y) { return y.id === f.quelle; }) || {};
  if (q.fall !== x.fall) return null;                                    /* nur Belege desselben Falls */
  x[a.rolle].push({ beob: b.id, pruefstand: 'eingetragen', geprueftAm: null }); x.geaendert = nowIso();
  return { modul: 'Dossier', aktion: 'Beleg verknüpft', detail: x.id + ': ' + b.id + ' als ' + (a.rolle === 'stuetzend' ? 'stützend' : 'widersprechend') };
};
ACTIONS.RECHERCHE_PRUEFSTAND = function (a) {
  const x = rchAussage(a.aussage), v = x && rchVerknuepfung(x, a.beob);
  if (!v || (a.stand !== 'geprueft' && a.stand !== 'eingetragen') || v.l.pruefstand === a.stand) return null;
  v.l.pruefstand = a.stand; v.l.geprueftAm = a.stand === 'geprueft' ? nowIso() : null; x.geaendert = nowIso();
  return { modul: 'Dossier', aktion: 'Prüfstand gesetzt', detail: x.id + ' / ' + a.beob + ': ' + a.stand };
};
ACTIONS.RECHERCHE_BELEG_GELOEST = function (a) {
  const x = rchAussage(a.aussage), v = x && rchVerknuepfung(x, a.beob); if (!v) return null;
  x[v.rolle] = x[v.rolle].filter(function (l) { return l.beob !== a.beob; });
  /* Eine Einschätzung, die ohne diesen Beleg nicht mehr zulässig ist, wird zurückgenommen und die Begründung bleibt stehen */
  if ((x.einschaetzung === 'gestuetzt' || x.einschaetzung === 'dafuer') && !x.stuetzend.length) x.einschaetzung = null;
  if ((x.einschaetzung === 'widerlegt' || x.einschaetzung === 'dagegen') && !x.widersprechend.length) x.einschaetzung = null;
  x.geaendert = nowIso();
  return { modul: 'Dossier', aktion: 'Beleg gelöst', detail: x.id + ': ' + a.beob };
};
['RECHERCHE_AUSSAGE_NEU', 'RECHERCHE_AUSSAGE_SETZEN', 'RECHERCHE_BELEG_VERKNUEPFT', 'RECHERCHE_PRUEFSTAND', 'RECHERCHE_BELEG_GELOEST'].forEach(function (k) { PROFIL_AKTIONEN[k] = 1; });

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
function rchFundstelleText(ft) { return ft ? ft.typ + (ft.wert ? ' ' + ft.wert : '') : 'fehlt'; }
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
function rchErfassen(e) {
  const R = PROFIL.recherche, datei = $('rch-datei') && $('rch-datei').files && $('rch-datei').files[0];
  /* Alle Angaben werden beim Klick gemeinsam erfasst; der weitere (asynchrone) Ablauf liest keine Eingaben mehr */
  const eing = { fall: rchEntwurf('fall'), titel: rchEntwurf('fall-titel').trim(), frage: rchEntwurf('fall-frage'), text: rchEntwurf('text').trim(), ftTyp: rchEntwurf('ft-typ') || RCH_FUNDSTELLEN[0],
    ftWert: rchEntwurf('ft-wert').trim(), herkunft: rchEntwurf('herkunft'), notiz: rchEntwurf('notiz') };
  const gesendet = { 'fall': eing.fall, 'fall-titel': VIEW.draft['rch-fall-titel'], 'fall-frage': VIEW.draft['rch-fall-frage'], 'text': VIEW.draft['rch-text'], 'ft-typ': VIEW.draft['rch-ft-typ'], 'ft-wert': VIEW.draft['rch-ft-wert'],
    'herkunft': VIEW.draft['rch-herkunft'], 'notiz': VIEW.draft['rch-notiz'] };
  if (!eing.fall) { meldung('Bitte zuerst einen Fall wählen oder einen neuen anlegen.'); return; }
  const neu = eing.fall === '__neu';
  if (neu && !eing.titel) { meldung('Für einen neuen Fall fehlt der Titel.'); return; }
  if (!datei && !eing.text) { meldung('Weder Datei noch Textauszug angegeben.'); return; }
  if (datei && datei.size > RCH_MAX) { meldung('Datei über 20 MB, nicht angenommen.'); return; }
  if (eing.ftTyp !== 'ganze Datei' && !eing.ftWert) { meldung('Die Fundstelle braucht einen Wert (oder "ganze Datei" wählen).'); return; }
  const fundstelle = { typ: eing.ftTyp, wert: eing.ftTyp === 'ganze Datei' ? '' : eing.ftWert };
  const fertig = function (fassung) {
    const sicher = JSON.stringify(R);                                  /* Stand vor dem Anlegen, für die Rücknahme */
    dispatch({ type: 'RECHERCHE_BELEG', dossier: e.id, fall: neu ? null : eing.fall, neuerFall: neu ? { titel: eing.titel, frage: eing.frage } : null,
      art: datei ? 'Datei' : 'Text', herkunft: eing.herkunft, notiz: eing.notiz, fassung: fassung, fundstelle: fundstelle, zitat: eing.text });
    if (JSON.stringify(R) === sicher) { if (fassung.anhang) RIDB.del(fassung.anhang).catch(function () {}); return; }          /* Aktion hat nichts angelegt */
    if (!profilSpeichern()) {                                          /* Profil nicht gesichert: Eintrag zurücknehmen, Datei aufräumen, Entwurf behalten */
      rchWiederherstellen(sicher);
      for (let i = STATE.log.length - 1; i >= 0 && i >= STATE.log.length - 5; i--) { if (STATE.log[i].aktion === 'Recherchebeleg erfasst') { STATE.log.splice(i, 1); break; } }
      if (fassung.anhang) RIDB.del(fassung.anhang).catch(function () {});
      meldung('Beleg nicht gespeichert: Profilspeicher voll oder nicht beschreibbar. Die Eingabe bleibt erhalten.');
      renderModule();
      return;
    }
    /* Nur die gesendeten Eingaben löschen; ein inzwischen neuer Entwurf bleibt erhalten */
    Object.keys(gesendet).forEach(function (k) { if (VIEW.draft['rch-' + k] === gesendet[k]) delete VIEW.draft['rch-' + k]; });
    renderModule();
  };
  if (!datei) { fertig({ dateiname: null, groesse: eing.text.length, typ: 'text/plain', hash: null, anhang: false }); return; }
  /* Datei zuerst sichern; erst danach entstehen die Datensätze */
  const schluessel = 'ANH-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);      /* eigener Dateischlüssel, unabhängig von der Fassungsnummer */
  rchHash(datei).then(function (hash) {
    return RIDB.put(schluessel, datei).then(function () { fertig({ dateiname: datei.name, groesse: datei.size, typ: datei.type || 'application/octet-stream', hash: hash, anhang: schluessel }); });
  }).catch(function () { RIDB.del(schluessel).catch(function () {}); meldung('Beleg konnte nicht gespeichert werden (Browserspeicher nicht verfügbar).'); });
}

/* ---------- Ansicht ---------- */
function rechercheBelege(e) {
  const R = PROFIL.recherche, liste = rchBelege(e), alt = typeof dossierBelege === 'function' ? dossierBelege(e).length : 0;
  const fallWahl = rchEntwurf('fall'), ftTyp = rchEntwurf('ft-typ') || RCH_FUNDSTELLEN[0];
  const sel = function (id, label, opts, wert, onch) { return h('select', { id: id, 'aria-label': label, onchange: onch }, opts.map(function (o) { return h('option', { value: o[0], selected: o[0] === wert }, o[1]); })); };
  const fallOpt = [['', '– Fall wählen –']].concat(R.faelle.map(function (f) { return [f.id, f.id + ' ' + f.titel]; })).concat([['__neu', 'Neuen Fall anlegen …']]);
  return panel('Recherchebelege', [h('span', { class: 'badge' }, String(liste.length))],
    h('div', { class: 'pad' },
      h('p', { class: 'note' }, 'Belege zu diesem Dossier, unabhängig von einem Auftrag. Jeder Beleg gehört zu einem Fall und trägt eine Fundstelle; Dateien bleiben unverändert, eine Prüfsumme weist spätere Änderungen nach.'
        + (alt ? ' Missionsbelege (' + alt + ') stehen weiter im Abschnitt Aufklärung und Freigabe.' : '')),
      h('div', { class: 'row' }, h('label', { for: 'rch-fall' }, 'Fall'),
        sel('rch-fall', 'Fall wählen', fallOpt, fallWahl, function (ev) { VIEW.draft['rch-fall'] = ev.target.value; renderModule(); })),
      fallWahl === '__neu' ? h('div', { class: 'row' },
        entwurf('input', 'rch-fall-titel', 'rch-fall-titel', { type: 'text', 'aria-label': 'Titel des neuen Falls', placeholder: 'Titel des Falls', maxlength: '120', style: 'flex:1 1 220px;min-width:0' }),
        entwurf('input', 'rch-fall-frage', 'rch-fall-frage', { type: 'text', 'aria-label': 'Recherchefrage', placeholder: 'Recherchefrage (optional)', maxlength: '300', style: 'flex:2 1 300px;min-width:0' })) : null,
      h('div', { class: 'row' }, h('label', { for: 'rch-datei' }, 'Datei'), h('input', { type: 'file', id: 'rch-datei', 'aria-label': 'Beleg als Datei' }),
        entwurf('input', 'rch-herkunft', 'rch-herkunft', { type: 'text', 'aria-label': 'Herkunft oder Adresse', placeholder: 'Herkunft oder Adresse (optional; wird nicht abgerufen)', maxlength: '300', style: 'flex:1 1 260px;min-width:0' })),
      h('div', { class: 'row' }, entwurf('textarea', 'rch-text', 'rch-text', { 'aria-label': 'Textauszug', placeholder: 'Textauszug (wörtlich; ohne Datei Pflicht)', rows: '3', maxlength: '2000', style: 'flex:1 1 100%;min-width:0' })),
      h('div', { class: 'row' }, h('label', { for: 'rch-ft-typ' }, 'Fundstelle'),
        sel('rch-ft-typ', 'Art der Fundstelle', RCH_FUNDSTELLEN.map(function (x) { return [x, x]; }), ftTyp, function (ev) { VIEW.draft['rch-ft-typ'] = ev.target.value; renderModule(); }),
        ftTyp === 'ganze Datei' ? h('span', { class: 'note' }, 'Schwächste Fundstelle: der Beleg verweist nicht auf eine Stelle.')
          : entwurf('input', 'rch-ft-wert', 'rch-ft-wert', { type: 'text', 'aria-label': 'Wert der Fundstelle', placeholder: ftTyp === 'Seite' ? 'Seitenzahl, z. B. 4' : ftTyp === 'Zeitmarke' ? 'z. B. 00:12:30' : 'z. B. Absatz 3 oder Zeichen 120-340', maxlength: '60', style: 'flex:1 1 200px;min-width:0' })),
      h('div', { class: 'row' },
        entwurf('input', 'rch-notiz', 'rch-notiz', { type: 'text', 'aria-label': 'Anmerkung zum Beleg', placeholder: 'Anmerkung (optional)', maxlength: '300', style: 'flex:1 1 300px;min-width:0' }),
        h('button', { type: 'button', id: 'rch-ok', onclick: function () { rchErfassen(e); } }, 'Beleg erfassen')),
      liste.length ? tabelle(['ID', 'Fall', 'Art', 'Fundstelle', 'Prüfsumme', 'Erfasst (UTC)', ''], liste.map(function (z) {
        return [td('nw', z.q.id || '–'), td('txt', z.fall ? z.fall.id + ' ' + z.fall.titel : '–'), td('nw', z.q.art || '–'),
          td('nw', rchFundstelleText(z.b.fundstelle)), td('nw', z.f.hash ? z.f.hash.slice(0, 12) + '…' : (z.f.anhang ? 'fehlt' : 'kein Anhang')), td('nw', fmtZ(z.b.erfasst)),
          td('txt', z.f.anhang ? h('button', { type: 'button', class: 'link', onclick: function () { rchOeffnen(z); } }, 'Öffnen')
            : h('details', null, h('summary', null, 'Textauszug'), h('div', { class: 'note' }, z.b.zitat)))];
      })) : h('p', { class: 'note' }, 'Noch keine Recherchebelege zu diesem Dossier.')));
}

/* ---------- Ansicht: Aussagen ---------- */
function rchAussagenFelder(e) {
  const R = PROFIL.recherche, liste = R.aussagen.filter(function (x) { return (x.dossiers || []).indexOf(e.id) >= 0; });
  const sel = function (id, label, opts, wert, onch) { return h('select', { id: id, 'aria-label': label, onchange: onch }, opts.map(function (o) { return h('option', { value: o[0], selected: o[0] === (wert || '') }, o[1]); })); };
  const sieh = function (typ, d) { if (!rchSchreiben(Object.assign({ type: typ }, d), typ === 'RECHERCHE_AUSSAGE_NEU' ? 'Aussage angelegt' : typ === 'RECHERCHE_AUSSAGE_SETZEN' ? 'Aussage geändert' : typ === 'RECHERCHE_BELEG_VERKNUEPFT' ? 'Beleg verknüpft' : typ === 'RECHERCHE_PRUEFSTAND' ? 'Prüfstand gesetzt' : 'Beleg gelöst')) return false; renderModule(); return true; };
  const neuFall = rchEntwurf('a-fall'), neuText = rchEntwurf('a-text');
  const formular = h('div', null,
    h('div', { class: 'row' }, h('label', { for: 'rca-fall' }, 'Fall'),
      sel('rca-fall', 'Fall der Aussage', [['', '– Fall wählen –']].concat(R.faelle.map(function (f) { return [f.id, f.id + ' ' + f.titel]; })), neuFall, function (ev) { VIEW.draft['rch-a-fall'] = ev.target.value; }),
      entwurf('input', 'rca-text', 'rch-a-text', { type: 'text', 'aria-label': 'Aussage', placeholder: 'Überprüfbarer Satz, z. B. "Der Radweg wurde im Juni eröffnet."', maxlength: '500', style: 'flex:1 1 320px;min-width:0' }),
      h('button', { type: 'button', id: 'rca-neu', onclick: function () {
        const f = VIEW.draft['rch-a-fall'] || '', t = (VIEW.draft['rch-a-text'] || '').trim();
        if (!f) { meldung(R.faelle.length ? 'Bitte einen Fall wählen.' : 'Zuerst einen Beleg erfassen, damit ein Fall besteht.'); return; }
        if (!t) { meldung('Die Aussage ist leer.'); return; }
        if (sieh('RECHERCHE_AUSSAGE_NEU', { dossier: e.id, fall: f, text: t })) { delete VIEW.draft['rch-a-text']; renderModule(); }
      } }, 'Aussage anlegen')));
  const bloecke = liste.map(function (x) {
    const kand = R.beobachtungen.filter(function (b) { const z = rchZuBeobachtung(b.id); return z && z.q.fall === x.fall && !rchVerknuepfung(x, b.id); });
    const strittig = x.stuetzend.length && x.widersprechend.length, ohne = !x.stuetzend.length && !x.widersprechend.length;
    const zeilen = x.stuetzend.map(function (l) { return [l, 'stützend']; }).concat(x.widersprechend.map(function (l) { return [l, 'widersprechend']; })).map(function (p) {
      const l = p[0], z = rchZuBeobachtung(l.beob);
      return [td('nw', l.beob), td('nw', p[1]), td('nw', z ? rchFundstelleText(z.b.fundstelle) : 'fehlt'), td('txt', z && z.b.zitat ? kuerzen(z.b.zitat, 60) : (z && z.f.dateiname) || ''),
        td('nw', h('span', { class: 'label ' + (l.pruefstand === 'geprueft' ? 's-accent' : 's-dim') }, l.pruefstand === 'geprueft' ? 'geprüft' : 'eingetragen')),
        td('txt', [z && z.f.anhang ? h('button', { type: 'button', class: 'link', onclick: function () { rchOeffnen(z); } }, 'Öffnen') : null, ' ',
          h('button', { type: 'button', class: 'link', id: 'rca-pr-' + x.id + '-' + l.beob, onclick: function () { sieh('RECHERCHE_PRUEFSTAND', { aussage: x.id, beob: l.beob, stand: l.pruefstand === 'geprueft' ? 'eingetragen' : 'geprueft' }); } }, l.pruefstand === 'geprueft' ? 'Prüfung zurücknehmen' : 'Als geprüft bestätigen'), ' ',
          h('button', { type: 'button', class: 'link', onclick: function () { sieh('RECHERCHE_BELEG_GELOEST', { aussage: x.id, beob: l.beob }); } }, 'Lösen')])];
    });
    const gk = 'rca-b-' + x.id, rk = 'rca-r-' + x.id, bk = 'rca-begr-' + x.id;
    return h('div', { class: 'pad', style: 'border-top:1px dashed #33425a' },
      h('p', null, h('strong', null, x.id + ' '), x.text, ' ', h('span', { class: 'label s-dim' }, 'Fall ' + x.fall), ' ',
        strittig ? h('span', { class: 'label s-warn' }, 'strittig: Belege dafür und dagegen') : null,
        ohne ? h('span', { class: 'label s-warn' }, 'ohne Fundstelle: nicht belegt') : null),
      h('div', { class: 'row' }, h('label', { for: 'rca-st-' + x.id }, 'Status'),
        sel('rca-st-' + x.id, 'Status ' + x.id, RCH_STATUS, x.status, function (ev) { sieh('RECHERCHE_AUSSAGE_SETZEN', { id: x.id, status: ev.target.value }); }),
        h('label', { for: 'rca-ei-' + x.id }, 'Einschätzung'),
        sel('rca-ei-' + x.id, 'Einschätzung ' + x.id, RCH_EINSCHAETZUNG, x.einschaetzung, function (ev) {
          const st = ev.target.value || null;
          if ((st === 'gestuetzt' || st === 'dafuer') && !x.stuetzend.length) { meldung('Ohne stützenden Beleg mit Fundstelle ist diese Einschätzung nicht möglich.'); renderModule(); return; }
          if ((st === 'widerlegt' || st === 'dagegen') && !x.widersprechend.length) { meldung('Ohne widersprechenden Beleg mit Fundstelle ist diese Einschätzung nicht möglich.'); renderModule(); return; }
          if (st && !x.begruendung.trim() && !(VIEW.draft[bk] || '').trim()) { meldung('Zuerst eine Begründung eintragen.'); renderModule(); return; }
          if ((VIEW.draft[bk] || '').trim() && VIEW.draft[bk].trim() !== x.begruendung) { if (!rchSchreiben({ type: 'RECHERCHE_AUSSAGE_SETZEN', id: x.id, begruendung: VIEW.draft[bk].trim() }, 'Aussage geändert')) { renderModule(); return; } }
          sieh('RECHERCHE_AUSSAGE_SETZEN', { id: x.id, einschaetzung: st }); delete VIEW.draft[bk];
        })),
      h('div', { class: 'row' }, entwurf('input', 'rca-begr-' + x.id, bk, { type: 'text', 'aria-label': 'Begründung ' + x.id, placeholder: 'Begründung der Einschätzung', maxlength: '1000', value: VIEW.draft[bk] != null ? VIEW.draft[bk] : x.begruendung, style: 'flex:1 1 360px;min-width:0' }),
        h('button', { type: 'button', id: 'rca-begr-ok-' + x.id, onclick: function () { const t = (VIEW.draft[bk] != null ? VIEW.draft[bk] : x.begruendung).trim(); if (sieh('RECHERCHE_AUSSAGE_SETZEN', { id: x.id, begruendung: t })) delete VIEW.draft[bk]; } }, 'Begründung speichern')),
      zeilen.length ? tabelle(['Beleg', 'Rolle', 'Fundstelle', 'Inhalt', 'Prüfstand', ''], zeilen) : null,
      kand.length ? h('div', { class: 'row' }, h('label', { for: gk }, 'Beleg'),
        sel(gk, 'Beleg verknüpfen ' + x.id, [['', '– Beleg wählen –']].concat(kand.map(function (b) { const z = rchZuBeobachtung(b.id); return [b.id, b.id + ' · ' + z.q.id + ' · ' + rchFundstelleText(b.fundstelle)]; })), VIEW.draft[gk] || '', function (ev) { VIEW.draft[gk] = ev.target.value; }),
        sel(rk, 'Rolle des Belegs ' + x.id, [['stuetzend', 'stützend'], ['widersprechend', 'widersprechend']], VIEW.draft[rk] || 'stuetzend', function (ev) { VIEW.draft[rk] = ev.target.value; }),
        h('button', { type: 'button', id: 'rca-v-' + x.id, onclick: function () { const b = VIEW.draft[gk]; if (!b) { meldung('Bitte einen Beleg wählen.'); return; } if (sieh('RECHERCHE_BELEG_VERKNUEPFT', { aussage: x.id, beob: b, rolle: VIEW.draft[rk] || 'stuetzend' })) { delete VIEW.draft[gk]; delete VIEW.draft[rk]; } } }, 'Verknüpfen'))
        : h('p', { class: 'note' }, 'Keine weiteren Belege dieses Falls zum Verknüpfen.'));
  });
  return { formular: formular, bloecke: bloecke, anzahl: liste.length };
}
function rechercheAussagen(e) {
  const F = rchAussagenFelder(e);
  return panel('Aussagen', [h('span', { class: 'badge' }, String(F.anzahl))],
    h('div', { class: 'pad' }, h('p', { class: 'note' }, 'Überprüfbare Sätze zu diesem Dossier mit Belegen dafür und dagegen. Die Einschätzung ist Ihr Urteil mit Begründung; die Anwendung rechnet nichts und schlägt nichts vor. Ohne stützenden Beleg mit Fundstelle ist keine positive Einschätzung möglich.'), F.formular),
    F.bloecke);
}
function rechercheDossier(e) { return [rechercheBelege(e), rechercheAussagen(e)]; }
