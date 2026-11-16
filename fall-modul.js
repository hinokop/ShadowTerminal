/* Modul X: Arbeitsansicht auf PROFIL.recherche, ohne eigenen Fallbestand. */
const X_STATUS = [['sammlung', 'Informationsgewinnung'], ['laufend', 'Laufend'], ['on-hold', 'On hold'], ['abgeschlossen', 'Abgeschlossen']];
const X_BEWERTUNG = [['unbewertet', 'Unbewertet'], ['duenn', 'Dünne Grundlage'], ['vorlaeufig', 'Vorläufig belastbar'], ['belastbar', 'Belastbar']];
const X_VIEW = { id: null, vorschau: null };
function xStatus(wert) { return xAuswahl(X_STATUS, wert === 'ruhend' ? 'on-hold' : wert); }
function xAuswahl(liste, wert) { return liste.find(function (x) { return x[0] === wert; }) || liste[0]; }
function xFall(id) { return PROFIL.recherche.faelle.find(function (f) { return f.id === id; }); }
function xDossierLesbar(e) { return !!(e && dossierOffen(e.mission) && wissen(e) !== 'unbekannt' && !dossierGesperrt(e) && !infoGesperrt(e)); }
function xPins(f) { return Array.isArray(f.pins) ? f.pins : []; }
function xDossiers(f) { return Array.isArray(f.dossiers) ? f.dossiers : []; }

function xAnlegen(daten, dossier) {
  const R = PROFIL.recherche;
  const titel = String(daten.titel || '').trim().slice(0, 120);
  if (!titel) return null;
  R.seq.fall = R.faelle.reduce(function (max, f) {
    return /^F-\d+$/.test(f.id) ? Math.max(max, Number(f.id.slice(2))) : max;
  }, R.seq.fall || 0);
  const f = { id: rchNr('fall'), titel: titel, frage: String(daten.frage || '').trim().slice(0, 300), zustand: 'sammlung', erfasst: nowIso() };
  if (dossier) f.dossiers = [dossier];
  R.faelle.push(f);
  return f;
}

/* Änderungen atomar im Profil sichern, bevor die Oberfläche Erfolg meldet. */
function xSchreiben(aenderung) {
  const R = PROFIL.recherche, sicher = JSON.stringify(R);
  const ergebnis = aenderung();
  if (!ergebnis) return false;
  if (profilSpeichern()) return true;
  rchWiederherstellen(sicher);
  meldung('Falländerung nicht gespeichert. Der bisherige Stand bleibt erhalten.');
  return false;
}
function xOeffnen(id) {
  if (X_VIEW.id !== id) X_VIEW.vorschau = null;
  X_VIEW.id = id;
  if (STATE.ui.modul === 'x') renderModule();
  else dispatch({ type: 'NAVIGATION', modul: 'x' });
}
function xFallMaterial(f) {
  const R = PROFIL.recherche;
  const quellen = new Set(R.quellen.filter(function (q) { return q.fall === f.id; }).map(function (q) { return q.id; }));
  const fassungen = new Set(R.fassungen.filter(function (v) { return quellen.has(v.quelle); }).map(function (v) { return v.id; }));
  return { quellen: quellen, fassungen: fassungen, unterlagen: R.beobachtungen.filter(function (b) { return fassungen.has(b.fassung); }) };
}
async function xLoeschen(id) {
  const R = PROFIL.recherche, f = xFall(id);
  if (!f || AK_EINGANG.arbeit) { meldung('Fall kann gerade nicht gelöscht werden.'); return; }
  const m = xFallMaterial(f), bIds = new Set(m.unterlagen.map(function (b) { return b.id; }));
  const keys = new Set(R.fassungen.filter(function (v) { return m.fassungen.has(v.id) && v.anhang; }).map(function (v) { return v.anhang; }));
  const zonen = (PROFIL.zonen || []).filter(function (z) { return Array.isArray(z.unterlagen) && z.unterlagen.some(function (b) { return bIds.has(b); }); });
  const alt = zonen.map(function (z) { return z.unterlagen; });
  if (!xSchreiben(function () {
    R.faelle = R.faelle.filter(function (x) { return x !== f; });
    R.quellen = R.quellen.filter(function (x) { return !m.quellen.has(x.id); });
    R.fassungen = R.fassungen.filter(function (x) { return !m.fassungen.has(x.id); });
    R.beobachtungen = R.beobachtungen.filter(function (x) { return !bIds.has(x.id); });
    R.aussagen = R.aussagen.filter(function (x) { return x.fall !== id; });
    R.aussagen.forEach(function (x) {
      ['stuetzend', 'widersprechend'].forEach(function (k) {
        if (Array.isArray(x[k])) x[k] = x[k].filter(function (v) { return !bIds.has(v.beob); });
      });
    });
    zonen.forEach(function (z) { z.unterlagen = z.unterlagen.filter(function (b) { return !bIds.has(b); }); });
    return true;
  })) { zonen.forEach(function (z, i) { z.unterlagen = alt[i]; }); return; }
  if (VIEW.recherche.fall === id) { VIEW.recherche.fall = ''; VIEW.recherche.fallDossier = null; }
  ['rch-fall', 'rch-fp-fall'].forEach(function (k) { if (VIEW.draft[k] === id) delete VIEW.draft[k]; });
  bIds.forEach(function (b) { delete VIEW.draft['rch-n-' + b]; });
  VIEW.recherche.sprungziel.forEach(function (b, d) { if (bIds.has(b)) VIEW.recherche.sprungziel.delete(d); });
  delete VIEW.draft['x-form-' + id];
  X_VIEW.id = null; X_VIEW.vorschau = null;
  if (STATE.ui.modul === 'x') renderModule();
  try {
    for (const k of keys) {
      if (!PROFIL.recherche.fassungen.some(function (v) { return v.anhang === k; }) &&
          !akEingangLesen().some(function (e) { return e.anhang === k; })) await RIDB.del(k);
    }
    meldung(id + ' gelöscht. Dossiers und Kartenpins blieben erhalten.');
  } catch (e) {
    meldung(id + ' gelöscht. Nicht mehr verknüpfte Dateikopien konnten nicht vollständig aufgeräumt werden.');
  }
}

function xVerknuepfen(f, art, id, loesen) {
  const akt = xFall(f.id);
  if (!akt || !id) return false;
  const alt = art === 'dossiers' ? xDossiers(akt) : xPins(akt);
  if (loesen ? !alt.includes(id) : alt.includes(id)) return false;
  if (!loesen && !(art === 'dossiers' ? xDossierLesbar(entitaet(id)) : xPinLesbar((PROFIL.pins || []).find(function (p) { return p.id === id; })))) return false;
  return xSchreiben(function () {
    akt[art] = loesen ? alt.filter(function (x) { return x !== id; }) : alt.concat(id);
    return true;
  });
}
function xBtn(id, titel, klick) { return h('button', { id: id, type: 'button', onclick: klick }, titel); }
function xSelect(id, liste, wert, attr) {
  return h('select', Object.assign({ id: id }, attr || {}), liste.map(function (x) {
    return h('option', { value: x[0], selected: x[0] === wert }, x[1]);
  }));
}
function xNeu(dossier) {
  if (dossier && !xDossierLesbar(dossier)) return;
  const fallwahl = xSelect('x-dialog-fall', [['__neu', 'Neuen Fall anlegen']].concat(PROFIL.recherche.faelle.map(function (f) { return [f.id, f.id + ' · ' + f.titel]; })), '__neu');
  const titel = h('input', { id: 'x-dialog-titel', maxlength: 120, autocomplete: 'off' });
  fallwahl.onchange = function () { titel.disabled = this.value !== '__neu'; };
  bestaetigen(dossier ? 'Dossier zu Fall hinzufügen' : 'Neuen Fall anlegen',
    [dossier ? feldZeile('Fall', fallwahl.id, fallwahl) : null, feldZeile('Falltitel', titel.id, titel)],
    dossier ? 'Zuordnen und öffnen' : 'Fall anlegen',
    function () {
      if (dossier && !xDossierLesbar(entitaet(dossier.id))) return;
      if (fallwahl.value !== '__neu') {
        const f = xFall(fallwahl.value);
        if (f && (xDossiers(f).includes(dossier.id) || xVerknuepfen(f, 'dossiers', dossier.id, false))) xOeffnen(f.id);
      } else {
        let f;
        if (xSchreiben(function () { f = xAnlegen({ titel: titel.value }, dossier && dossier.id); return !!f; })) xOeffnen(f.id);
      }
    }, { pruefer: function () { return fallwahl.value !== '__neu' || !!titel.value.trim(); } });
}
function xDossierOeffnen(id, unterlage) {
  if (!xDossierLesbar(entitaet(id))) return;
  VIEW.dtab = 'info';
  dispatch({ type: 'DOSSIER_GEOEFFNET', id: id, navigieren: true, ueber: 'X' });
  if (unterlage) rchUnterlageZeigen(unterlage);
}
function xDossierKnopf(e) {
  return xDossierLesbar(e) ? xBtn('x-dossier-fall', 'Zu Fall hinzufügen', function () { xNeu(e); }) : null;
}
function xPinLesbar(p) { return !!(p && (!p.dossier || xDossierLesbar(entitaet(p.dossier)))); }
function xZurKarte(f, pin) {
  const K = VIEW.karte;
  Object.assign(K, { reiter: 'karte', pick: pin ? null : 'X:' + f.id, messPts: [], messen: false, pinSetzen: false, zoneSetzen: false, zugriffSetzen: false });
  if (pin) K.ebenen.pins = true;
  dispatch({ type: 'NAVIGATION', modul: 'karte' });
  if (pin) {
    const si = pinSichtung(pin);
    if (si && K.ebenen.sichtungen !== false) xSichtungsZiel(si, pin);
    else karteWaehlen(pin.id, true);
  } else if ($('k-svg')) $('k-svg').focus();
}
function xSichtungsZiel(si, pin) {
  VIEW.karte.sichtungFokus = si.id;
  const id = karteMarker().some(function (m) { return m.id === si.id; }) ? si.id : pin.id;
  karteWaehlen(id, true);
}
function xPinSetzen(id, ll) {
  const f = xFall(id);
  if (!f) { renderModule(); return; }
  const anzahl = xPins(f).length;
  dispatch({ type: 'PIN_ANGELEGT', ll: ll, xFall: id });
  if (xPins(xFall(id)).length > anzahl) xOeffnen(id);
  else renderModule();
}
function xPinUebernehmen(f, px) {
  return xSchreiben(function () { f.pins = xPins(f).concat(px.id); return true; });
}
function xPinsLoesen(ids) {
  PROFIL.recherche.faelle.forEach(function (f) {
    if (xPins(f).some(function (id) { return ids.has(id); })) f.pins = xPins(f).filter(function (id) { return !ids.has(id); });
  });
}

function xForm(f) {
  const key = 'x-form-' + f.id, d = VIEW.draft[key] || {};
  const merken = function (k) { return function (ev) {
    (VIEW.draft[key] = VIEW.draft[key] || {})[k] = ev.target.value;
  }; };
  const titel = h('input', { id: 'x-titel', required: true, maxlength: 120, value: d.titel ?? f.titel, oninput: merken('titel') });
  const lage = h('textarea', { id: 'x-kurzlage', rows: 4, maxlength: 300, value: d.frage ?? f.frage ?? '', oninput: merken('frage') });
  const status = xSelect('x-status', X_STATUS, d.zustand ?? xStatus(f.zustand)[0], { onchange: merken('zustand') });
  const bewertung = xSelect('x-bewertung', X_BEWERTUNG, d.bewertung ?? xAuswahl(X_BEWERTUNG, f.bewertung)[0], { onchange: merken('bewertung') });
  const begruendung = h('textarea', { id: 'x-begruendung', rows: 2, maxlength: 500, value: d.begruendung ?? f.begruendung ?? '', oninput: merken('begruendung') });
  return h('form', { class: 'x-form', onsubmit: function (ev) {
    ev.preventDefault();
    const akt = xFall(f.id), name = titel.value.trim();
    if (!akt || !name) { meldung('Bitte einen Falltitel eingeben.'); return; }
    if (xSchreiben(function () {
      Object.assign(akt, { titel: name, frage: lage.value.trim(), zustand: status.value, bewertung: bewertung.value, begruendung: begruendung.value.trim() });
      return true;
    })) { delete VIEW.draft[key]; meldung(f.id + ' gespeichert.'); renderModule(); }
  } },
  feldZeile('Titel', titel.id, titel), feldZeile('Kurzlage / Leitfrage', lage.id, lage),
  feldZeile('Zustand', status.id, status), feldZeile('Bewertung der Informationslage', bewertung.id, bewertung), feldZeile('Begründung (optional)', begruendung.id, begruendung),
  h('button', { id: 'x-speichern', type: 'submit' }, 'Fall speichern'));
}
function xBezugPanel(f, pins) {
  const art = pins ? 'pins' : 'dossiers', ids = pins ? xPins(f) : xDossiers(f);
  const alle = pins ? (PROFIL.pins || []).filter(xPinLesbar) : pool().filter(xDossierLesbar);
  const verfuegbar = alle.filter(function (x) { return !ids.includes(x.id); });
  const k = pins ? 'pin' : 'dossier';
  const sel = xSelect('x-' + k + '-wahl', [['', pins ? 'Pin wählen' : 'Dossier wählen']].concat(verfuegbar.map(function (x) { return [x.id, x.id + ' · ' + x.name]; })), '', { 'aria-label': pins ? 'Vorhandener Pin' : 'Vorhandenes Dossier' });
  return panel(pins ? 'Kartenpins' : 'Dossiers', null, h('div', { class: 'pad' },
    h('div', { class: 'row' }, sel, xBtn('x-' + k + '-hinzu', 'Verknüpfen', function () {
      if (!sel.value) { meldung(pins ? 'Bitte einen Pin auswählen.' : 'Bitte ein Dossier auswählen.'); return; }
      if (xVerknuepfen(f, art, sel.value, false)) renderModule();
    }), pins ? xBtn('x-pin-neu', 'Pin auf Karte setzen', function () { xZurKarte(f); }) : null),
    ids.length ? h('ul', { class: 'x-items' }, ids.map(function (id) {
      const o = alle.find(function (x) { return x.id === id; });
      return h('li', null, o ? xBtn('x-' + k + '-offen-' + id, id + ' · ' + o.name, function () {
        if (pins) xZurKarte(f, o); else xDossierOeffnen(id);
      }) : h('span', { class: 'dim' }, id + ' · nicht verfügbar'),
      xBtn('x-' + k + '-loesen-' + id, 'Verknüpfung lösen', function () { if (xVerknuepfen(f, art, id, true)) renderModule(); }));
    })) : h('p', { class: 'note' }, pins ? 'Noch keine Pins verknüpft.' : 'Noch keine Dossiers verknüpft.')));
}
function xUnterlagen(f) {
  const L = xFallMaterial(f).unterlagen;
  return panel('Unterlagen', null, h('div', { class: 'pad' },
    L.length ? h('ul', { class: 'x-items' }, L.map(function (b) {
      const z = rchZuBeobachtung(b.id);
      const dos = b.dossiers || [];
      if (dos.some(function (id) { return !xDossierLesbar(entitaet(id)); })) return h('li', null, h('span', { class: 'dim' }, b.id + ' · Unterlage nicht verfügbar'));
      const zeige = z.f.dateiname || z.q.herkunft || 'Textunterlage';
      const auswahl = X_VIEW.vorschau === b.id;
      const vorschau = auswahl && z.f.anhang ? h('div', { class: 'x-vorschau', id: 'x-vorschau', 'aria-live': 'polite' }, 'Vorschau wird geladen …') : null;
      if (vorschau) setTimeout(function () { if (vorschau.isConnected) void akDateivorschau(z.f, vorschau); }, 0);
      return h('li', null, h('div', { class: 'x-unterlage' }, h('strong', null, zeige),
        h('span', { class: 'dim' }, b.id + ' · ' + rchFundstelleText(b.fundstelle) + ' · ' + (b.pruefung && b.pruefung.nuetzlich ? 'geprüft und nützlich' : 'nicht als geprüft markiert')),
        b.zitat ? h('p', { class: 'x-kurztext' }, b.zitat) : null),
        z.f.anhang ? xBtn('x-vorschau-' + b.id, auswahl ? 'Vorschau schließen' : 'Vorschau', function () { X_VIEW.vorschau = auswahl ? null : b.id; renderModule(); }) : null,
        z.f.anhang ? xBtn('x-datei-' + b.id, 'Datei öffnen', function () { rchOeffnen(z); }) : null,
        dos.map(function (id) { return xBtn('x-unterlage-' + b.id + '-' + id, id, function () { xDossierOeffnen(id, b.id); }); }), vorschau);
    })) : h('p', { class: 'note' }, 'Noch keine Unterlagen für diesen Fall. Dateien können aus dem Eingang oder am Dossier zugeordnet werden.')));
}
function renderX(m) {
  akVorschauFreigeben();
  const L = PROFIL.recherche.faelle;
  const f = xFall(X_VIEW.id) || L[0];
  const liste = panel('Fälle', null, h('div', { class: 'pad' },
    xBtn('x-neu', 'Neuer Fall', function () { xNeu(null); }),
    L.length ? h('ul', { class: 'x-faelle', 'aria-label': 'Fälle' }, L.map(function (x) {
      return h('li', null, h('button', { type: 'button', id: 'x-fall-' + x.id, 'aria-current': f === x ? 'true' : null, onclick: function () { xOeffnen(x.id); } },
        h('span', { class: 'dim' }, x.id + ' · ' + xStatus(x.zustand)[1]), h('strong', null, x.titel)));
    })) : h('p', { class: 'note' }, 'Noch keine Fälle.')));
  if (!f) return [modKopf(m), liste];
  return [modKopf(m), h('div', { class: 'split x-layout' }, liste, h('div', null,
    panel(f.id + ' · ' + f.titel, null, h('div', { class: 'pad' }, xForm(f))),
    xBezugPanel(f, false), xBezugPanel(f, true), xUnterlagen(f),
    panel('Fall löschen', null, h('div', { class: 'pad' },
      h('p', { class: 'note' }, 'Löscht den Fall und seine Unterlagen. Dossiers und Pins bleiben erhalten.'),
      xBtn('x-loeschen', 'Fall löschen …', function () {
        const n = xFallMaterial(f).unterlagen.length;
        bestaetigen(f.id + ' endgültig löschen?', '„' + f.titel + '“ samt ' + n + ' Unterlage(n) und den Zuordnungen wird gelöscht. Dossiers, Kartenpins und Dateien außerhalb des Terminals bleiben erhalten.',
          'Fall endgültig löschen', function () { void xLoeschen(f.id); }, { pflicht: 'Ich möchte diesen Fall endgültig löschen.' });
      })))))];
}
