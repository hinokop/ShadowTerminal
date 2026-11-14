/* =====================================================================
   MODUL 8: RECHERCHEBELEGE (Fallkern, erster Schnitt)
   Belege am Dossier ohne laufenden Auftrag. Eigener Schreib- und Lesepfad, getrennt vom Missionspfad (ms.dokumente).
   Datenvertrag: docs/datenvertrag.md. Objekte: Fall, Quelle, Fassung, Beobachtung (PROFIL.recherche, im Profil gespeichert).
   Dateien liegen bytegetreu in einer eigenen IndexedDB ('fieldterminal.recherche'), die das Zurücksetzen des Zustands nicht leert.
   Klassisches Skript, wird nach dem Hauptskript geladen; vom Hauptskript nur zur Laufzeit referenziert.
   ===================================================================== */
VIEW.recherche = VIEW.recherche || {};
PROFIL.recherche = PROFIL.recherche || { faelle: [], quellen: [], fassungen: [], beobachtungen: [], seq: { fall: 0, quelle: 0, fassung: 0, beobachtung: 0 } };
['faelle', 'quellen', 'fassungen', 'beobachtungen'].forEach(function (k) { PROFIL.recherche[k] = PROFIL.recherche[k] || []; });
PROFIL.recherche.seq = Object.assign({ fall: 0, quelle: 0, fassung: 0, beobachtung: 0 }, PROFIL.recherche.seq || {});
PROFIL_AKTIONEN.RECHERCHE_BELEG = 1;

const RCH_MAX = 20 * 1024 * 1024;
const RCH_FUNDSTELLEN = ['Seite', 'Absatz', 'Zeitmarke', 'Zeichenbereich', 'ganze Datei'];
const RCH_ID = { fall: ['F-', 'fall'], quelle: ['Q-', 'quelle'], fassung: ['V-', 'fassung'], beobachtung: ['B-', 'beobachtung'] };

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
  get: function (k) { return RIDB.tun('readonly', function (st) { return st.get(k); }); }
};

function rchHash(blob) {
  if (!(window.crypto && crypto.subtle && blob.arrayBuffer)) return Promise.resolve(null);       /* ohne Prüfsumme: als fehlend ausweisen, nichts ersetzen */
  return blob.arrayBuffer().then(function (b) { return crypto.subtle.digest('SHA-256', b); }).then(function (d) {
    return Array.prototype.map.call(new Uint8Array(d), function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
  }).catch(function () { return null; });
}
function rchNr(art) { const R = PROFIL.recherche; R.seq[RCH_ID[art][1]] += 1; return RCH_ID[art][0] + p3(R.seq[RCH_ID[art][1]]); }

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

/* ---------- Lesen ---------- */
function rchBelege(e) {
  const R = PROFIL.recherche;
  return R.beobachtungen.filter(function (b) { return (b.dossiers || []).indexOf(e.id) >= 0; }).map(function (b) {
    const f = R.fassungen.find(function (x) { return x.id === b.fassung; }) || {}, q = R.quellen.find(function (x) { return x.id === f.quelle; }) || {};
    return { b: b, f: f, q: q, fall: R.faelle.find(function (x) { return x.id === q.fall; }) || null };
  });
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
  const R = PROFIL.recherche, fallWahl = rchEntwurf('fall'), datei = $('rch-datei') && $('rch-datei').files && $('rch-datei').files[0];
  const text = rchEntwurf('text').trim(), ftTyp = rchEntwurf('ft-typ') || RCH_FUNDSTELLEN[0], ftWert = rchEntwurf('ft-wert').trim();
  if (!fallWahl) { meldung('Bitte zuerst einen Fall wählen oder einen neuen anlegen.'); return; }
  const neu = fallWahl === '__neu', titel = rchEntwurf('fall-titel').trim();
  if (neu && !titel) { meldung('Für einen neuen Fall fehlt der Titel.'); return; }
  if (!datei && !text) { meldung('Weder Datei noch Textauszug angegeben.'); return; }
  if (datei && datei.size > RCH_MAX) { meldung('Datei über 20 MB, nicht angenommen.'); return; }
  if (ftTyp !== 'ganze Datei' && !ftWert) { meldung('Die Fundstelle braucht einen Wert (oder "ganze Datei" wählen).'); return; }
  const fundstelle = { typ: ftTyp, wert: ftTyp === 'ganze Datei' ? '' : ftWert };
  const fertig = function (fassung) {
    dispatch({ type: 'RECHERCHE_BELEG', dossier: e.id, fall: neu ? null : fallWahl, neuerFall: neu ? { titel: titel, frage: rchEntwurf('fall-frage') } : null,
      art: datei ? 'Datei' : 'Text', herkunft: rchEntwurf('herkunft'), notiz: rchEntwurf('notiz'), fassung: fassung, fundstelle: fundstelle, zitat: text });
    ['fall', 'fall-titel', 'fall-frage', 'text', 'ft-typ', 'ft-wert', 'herkunft', 'notiz'].forEach(function (k) { delete VIEW.draft['rch-' + k]; });
    renderModule();
  };
  if (!datei) { fertig({ dateiname: null, groesse: text.length, typ: 'text/plain', hash: null, anhang: false }); return; }
  /* Datei zuerst sichern; erst danach entstehen die Datensätze */
  const schluessel = 'ANH-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);      /* eigener Dateischlüssel, unabhängig von der Fassungsnummer */
  rchHash(datei).then(function (hash) {
    return RIDB.put(schluessel, datei).then(function () { fertig({ dateiname: datei.name, groesse: datei.size, typ: datei.type || 'application/octet-stream', hash: hash, anhang: schluessel }); });
  }).catch(function () { meldung('Beleg konnte nicht gespeichert werden (Browserspeicher nicht verfügbar).'); });
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
