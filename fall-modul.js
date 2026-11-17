/* Modul X: Arbeitsansicht auf PROFIL.recherche, ohne eigenen Fallbestand. */
const X_STATUS = [['sammlung', 'Informationsgewinnung'], ['laufend', 'Laufend'], ['on-hold', 'On hold'], ['abgeschlossen', 'Abgeschlossen']];
const X_BEWERTUNG = [['unbewertet', 'Unbewertet'], ['duenn', 'Dünne Grundlage'], ['vorlaeufig', 'Vorläufig belastbar'], ['belastbar', 'Belastbar']];
const X_VIEW = { id: null, vorschau: null, keine: false };   /* keine: nach übersprungenem Arbeitsstand kein automatischer erster Fall */
function xStatus(wert) { return xAuswahl(X_STATUS, wert === 'ruhend' ? 'on-hold' : wert); }
function xAuswahl(liste, wert) { return liste.find(function (x) { return x[0] === wert; }) || liste[0]; }
/* Der in X angezeigte Fall: gewählter Fall, sonst der erste (außer nach übersprungenem Arbeitsstand). Anzeige und Arbeitsstand nutzen dieselbe Auswahl. */
function xAngezeigt() { return xFall(X_VIEW.id) || (X_VIEW.keine ? null : PROFIL.recherche.faelle[0]) || null; }
function xFall(id) { return PROFIL.recherche.faelle.find(function (f) { return f.id === id; }); }
function xDossierLesbar(e) { return !!(e && dossierOffen(e.mission) && wissen(e) !== 'unbekannt' && !dossierGesperrt(e) && !infoGesperrt(e)); }
function xPins(f) { return Array.isArray(f.pins) ? f.pins : []; }
function xDossiers(f) { return Array.isArray(f.dossiers) ? f.dossiers : []; }

function xAnlegen(daten, dossier) {
  const R = PROFIL.recherche;
  const titel = String(daten.titel || '').trim().slice(0, 120);
  if (!titel) return null;
  /* Nur vorhandene Fälle belegen Nummern. Der Import verwendet weiterhin seine eigene Reservierung. */
  R.seq.fall = R.faelle.reduce(function (max, f) {
    return /^F-\d+$/.test(f.id) ? Math.max(max, Number(f.id.slice(2))) : max;
  }, 0);
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
  X_VIEW.id = id; X_VIEW.keine = false;
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
  delete VIEW.draft['x-form-' + id]; ['x-bf-text-', 'x-bf-art-', 'x-bf-bearb-', 'x-bf-bearb-text-'].forEach(function (k) { delete VIEW.draft[k + id]; });
  X_VIEW.id = null; X_VIEW.vorschau = null; X_VIEW.keine = false;
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
  if (!xDossierLesbar(e)) return null;
  const unterlagen = new Set(rchBelege(e).filter(function (z) { return !!z.fall; }).map(function (z) { return z.fall.id; }));
  const faelle = PROFIL.recherche.faelle.filter(function (f) { return xDossiers(f).includes(e.id) || unterlagen.has(f.id); });
  return [
    xBtn('x-dossier-fall', 'Zu Fall hinzufügen', function () { xNeu(e); }),
    faelle.length ? h('div', { class: 'row', id: 'x-dossier-faelle', role: 'group', 'aria-label': 'Zugehörige Fälle' },
      h('span', { class: 'dim' }, 'Fälle in X'),
      faelle.map(function (f) {
        const basis = xDossiers(f).includes(e.id) ? '' : ' · über Unterlagen';
        return h('button', {
          type: 'button', class: 'link', id: 'x-dossier-verweis-' + f.id,
          title: xStatus(f.zustand)[1], onclick: function () { if (xFall(f.id)) xOeffnen(f.id); }
        }, f.id + ' · ' + f.titel + basis);
      })) : h('span', { id: 'x-dossier-kein-fall', class: 'dim' }, 'Keinem Fall zugeordnet')
  ];
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
  const lage = xTextEditor('x-kurzlage', d.frage !== undefined ? d.frage : (xFrageHtml(f) || xTextAusKlartext(f.frage)), function (html) { (VIEW.draft[key] = VIEW.draft[key] || {}).frage = html; }, 'Kurzlage / Leitfrage');
  const status = xSelect('x-status', X_STATUS, d.zustand ?? xStatus(f.zustand)[0], { onchange: merken('zustand') });
  const bewertung = xSelect('x-bewertung', X_BEWERTUNG, d.bewertung ?? xAuswahl(X_BEWERTUNG, f.bewertung)[0], { onchange: merken('bewertung') });
  const begruendung = h('textarea', { id: 'x-begruendung', rows: 2, maxlength: 500, value: d.begruendung ?? f.begruendung ?? '', oninput: merken('begruendung') });
  return h('form', { class: 'x-form', onsubmit: function (ev) {
    ev.preventDefault();
    const akt = xFall(f.id), name = titel.value.trim();
    if (!akt || !name) { meldung('Bitte einen Falltitel eingeben.'); return; }
    const html = lage.wert(), klar = xTextPlain(html);
    if (klar.length > 300) { meldung('Höchstens 300 Zeichen für die Kurzlage.'); return; }
    if (xSchreiben(function () {
      Object.assign(akt, { titel: name, frage: klar, zustand: status.value, bewertung: bewertung.value, begruendung: begruendung.value.trim() });
      if (klar && html !== xTextAusKlartext(klar)) akt.frageFormat = html; else delete akt.frageFormat;
      return true;
    })) { delete VIEW.draft[key]; meldung(f.id + ' gespeichert.'); renderModule(); }
  } },
  feldZeile('Titel', titel.id, titel), feldZeile('Kurzlage / Leitfrage', 'x-kurzlage', lage.knoten),
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
      return h('li', { id: 'x-eintrag-' + b.id, tabindex: '-1' }, h('div', { class: 'x-unterlage' }, h('strong', null, zeige),
        h('span', { class: 'dim' }, b.id + ' · ' + rchFundstelleText(b.fundstelle) + ' · ' + (b.pruefung && b.pruefung.nuetzlich ? 'geprüft und nützlich' : 'nicht als geprüft markiert')),
        b.zitat ? h('p', { class: 'x-kurztext' }, b.zitat) : null),
        z.f.anhang ? xBtn('x-vorschau-' + b.id, auswahl ? 'Vorschau schließen' : 'Vorschau', function () { X_VIEW.vorschau = auswahl ? null : b.id; renderModule(); }) : null,
        z.f.anhang ? xBtn('x-datei-' + b.id, 'Datei öffnen', function () { rchOeffnen(z); }) : null,
        dos.map(function (id) { return xBtn('x-unterlage-' + b.id + '-' + id, id, function () { xDossierOeffnen(id, b.id); }); }), vorschau);
    })) : h('p', { class: 'note' }, 'Noch keine Unterlagen für diesen Fall. Dateien können aus dem Eingang oder am Dossier zugeordnet werden.')));
}
/* Einfacher Texteditor für Einträge: Fett, Kursiv, Unterstrichen, Liste. Eingefügt wird nur Text; Inhalt wird mit der Bereinigung der Dossier-Kurzlage
   (kurzlageInhalt) beim Speichern und bei jeder Anzeige aus erlaubten Elementen neu aufgebaut. Unterlagen-Verweise der Kurzlage gibt es hier nicht. */
function xTextOhneVerweise(html) {
  /* In einem eigenen, inerten Dokument parsen: Knoten dürfen nie in das aktive Dokument wandern (sonst laden Bilder und onerror feuert). */
  const doc = document.implementation.createHTMLDocument('');
  doc.body.innerHTML = typeof html === 'string' ? html.slice(0, 24000) : '';
  doc.body.querySelectorAll('[data-unterlage]').forEach(function (n) { n.remove(); });
  return doc.body.innerHTML;
}
function xTextKanon(html) { return kurzlageKanon(xTextOhneVerweise(html)); }
function xTextAnzeige(html) { return h('div', { class: 'kl-text' }, kurzlageInhalt(xTextOhneVerweise(html), new Map(), true)); }
/* Klartext mit Zeilenumbrüchen aus bereinigtem Inhalt; dient Längenprüfung, Leerprüfung und dem Klartextfeld des Falls. */
function xTextPlain(html) {
  const wurzel = h('div', null, kurzlageInhalt(xTextOhneVerweise(html), new Map(), false)), block = { DIV: 1, P: 1, UL: 1, LI: 1 };
  let aus = '';
  const gehe = function (n) {
    if (n.nodeType === 3) { aus += n.data; return; }
    if (n.nodeType !== 1) return;
    if (n.tagName === 'BR') { aus += '\n'; return; }
    const b = block[n.tagName] === 1;
    if (b && aus && !/\n$/.test(aus)) aus += '\n';
    Array.from(n.childNodes).forEach(gehe);
    if (b && aus && !/\n$/.test(aus)) aus += '\n';
  };
  Array.from(wurzel.childNodes).forEach(gehe);
  return aus.replace(/\u00a0/g, ' ').trim();
}
/* Klartext als Editorinhalt (maskiert, Zeilenumbrüche als <br>). */
function xTextAusKlartext(t) {
  const d = h('div'); String(t || '').split('\n').forEach(function (z, i) { if (i) d.appendChild(document.createElement('br')); d.appendChild(document.createTextNode(z)); });
  return d.innerHTML;
}
/* Formatierte Kurzlage gilt nur, wenn ihr Klartext zum Klartextfeld des Falls passt. */
function xFrageHtml(f) { return typeof f.frageFormat === 'string' && f.frage && xTextPlain(f.frageFormat) === f.frage ? f.frageFormat : null; }
function xTextEditor(id, start, beiAenderung, beschriftung) {
  const eingabe = h('div', { id: id, class: 'kl-text kl-eingabe', contenteditable: 'true', role: 'textbox', 'aria-multiline': 'true', 'aria-label': beschriftung || 'Text des Eintrags', spellcheck: 'true' },
    kurzlageInhalt(xTextOhneVerweise(start || ''), new Map(), false));
  let position = null;
  const merken = function () {
    const sel = window.getSelection(), r = sel.rangeCount ? sel.getRangeAt(0) : null;
    if (r && eingabe.contains(r.commonAncestorContainer)) position = r.cloneRange();
  };
  const wieder = function () {
    eingabe.focus();
    const sel = window.getSelection(); let r = position;
    if (!r || !eingabe.contains(r.commonAncestorContainer)) { r = document.createRange(); r.selectNodeContents(eingabe); r.collapse(false); }
    sel.removeAllRanges(); sel.addRange(r);
  };
  ['input', 'keyup', 'mouseup', 'blur'].forEach(function (a) { eingabe.addEventListener(a, merken); });
  eingabe.addEventListener('input', function () { if (beiAenderung) beiAenderung(eingabe.innerHTML); });
  eingabe.addEventListener('paste', function (ev) {
    ev.preventDefault(); document.execCommand('insertText', false, (ev.clipboardData || window.clipboardData).getData('text/plain')); merken();
  });
  eingabe.addEventListener('drop', function (ev) { ev.preventDefault(); });
  const format = function (befehl, titel, text) {
    return h('button', { type: 'button', 'data-format': befehl, 'aria-label': titel, title: titel,
      onmousedown: function (ev) { merken(); ev.preventDefault(); },
      onclick: function () { wieder(); document.execCommand('styleWithCSS', false, false); document.execCommand(befehl, false, null); merken(); if (beiAenderung) beiAenderung(eingabe.innerHTML); } }, text);
  };
  const leiste = h('div', { id: id + '-leiste', class: 'kl-werkzeuge', role: 'group', 'aria-label': 'Text formatieren' },
    format('bold', 'Fett', h('b', null, 'B')), format('italic', 'Kursiv', h('i', null, 'I')), format('underline', 'Unterstrichen', h('u', null, 'U')), format('insertUnorderedList', 'Aufzählung', '• Liste'));
  return { knoten: h('div', { class: 'x-editor' }, leiste, eingabe), wert: function () { return xTextKanon(eingabe.innerHTML); }, roh: function () { return eingabe.innerHTML; } };
}
/* Datierte Einträge je Fall: Lage, Nächster Schritt, Offene Frage. Manuell gepflegt, mit fester uid; ohne frühere Fassungen und ohne Verweise. */
const X_EINTRAG_ARTEN = { lage: 'Lage', schritt: 'Nächster Schritt', frage: 'Offene Frage' };
const X_EINTRAG_MAX = 500, X_EINTRAEGE_MAX = 200;
/* Nur wohlgeformte Einträge (Importe und Altdaten können Beliebiges enthalten); doppelte uid zählen einmal. */
function xEintraege(f) {
  if (!Array.isArray(f.eintraege)) return [];
  const gesehen = {};
  return f.eintraege.filter(function (e) {
    const ok = e && typeof e === 'object' && typeof e.uid === 'string' && e.uid && !gesehen[e.uid] && X_EINTRAG_ARTEN[e.art] && typeof e.text === 'string' && typeof e.erfasst === 'string';
    if (ok) gesehen[e.uid] = 1; return ok;
  });
}
function xEintragAendern(fallId, aenderung, okText) {
  const akt = xFall(fallId); if (!akt) return false;
  const ok = xSchreiben(function () { return aenderung(akt); });
  if (ok && okText) meldung(okText);
  return ok;
}
function xEintragZeile(f, e) {
  const bearb = VIEW.draft['x-bf-bearb-' + f.id] === e.uid, dr = VIEW.draft['x-bf-bearb-text-' + f.id];
  const kopf = h('span', { class: 'dim' }, X_EINTRAG_ARTEN[e.art] + ' · ' + fmtZ(e.erfasst) + (e.geaendert ? ' · geändert ' + fmtZ(e.geaendert) : ''));
  if (bearb) {
    const ed = xTextEditor('x-bf-bearb-text-' + e.uid, dr !== undefined ? dr : e.text, function (html) { VIEW.draft['x-bf-bearb-text-' + f.id] = html; });
    return h('li', { id: 'x-bf-' + e.uid, 'data-eintrag': e.uid }, h('div', { class: 'x-bf-inhalt' }, kopf, ed.knoten, h('div', { class: 'row' },
      xBtn('x-bf-bearb-ok-' + e.uid, 'Speichern', function () {
        const text = ed.wert();
        if (!xTextPlain(text)) { meldung('Der Text des Eintrags darf nicht leer sein.'); return; }
        if (xTextPlain(text).length > X_EINTRAG_MAX) { meldung('Höchstens ' + X_EINTRAG_MAX + ' Zeichen je Eintrag.'); return; }
        let ok = true;
        if (text !== e.text) ok = xEintragAendern(f.id, function (akt) { const z = xEintraege(akt).find(function (x) { return x.uid === e.uid; }); if (!z) return false; z.text = text; z.geaendert = nowIso(); return true; }, 'Eintrag gespeichert.');
        if (ok) { delete VIEW.draft['x-bf-bearb-' + f.id]; delete VIEW.draft['x-bf-bearb-text-' + f.id]; }
        else VIEW.draft['x-bf-bearb-text-' + f.id] = text;
        renderModule();
      }),
      xBtn('x-bf-bearb-abbr-' + e.uid, 'Abbrechen', function () { delete VIEW.draft['x-bf-bearb-' + f.id]; delete VIEW.draft['x-bf-bearb-text-' + f.id]; renderModule(); }))));
  }
  return h('li', { id: 'x-bf-' + e.uid, 'data-eintrag': e.uid, class: e.erledigt ? 'x-erledigt' : '' }, h('div', { class: 'x-bf-inhalt' }, kopf,
    h('div', { class: e.erledigt ? 'x-bf-text x-erledigt-text' : 'x-bf-text' }, xTextAnzeige(e.text)),
    h('div', { class: 'row' },
      e.art === 'frage' ? h('label', null, h('input', { type: 'checkbox', id: 'x-bf-erledigt-' + e.uid, checked: !!e.erledigt, onchange: function (ev) {
        const wert = ev.target.checked;
        xEintragAendern(f.id, function (akt) { const z = xEintraege(akt).find(function (x) { return x.uid === e.uid; }); if (!z) return false; if (wert) z.erledigt = true; else delete z.erledigt; return true; });
        renderModule();
      } }), ' erledigt') : null,
      xBtn('x-bf-bearb-' + e.uid, 'Bearbeiten', function () { VIEW.draft['x-bf-bearb-' + f.id] = e.uid; delete VIEW.draft['x-bf-bearb-text-' + f.id]; renderModule(); }),
      xBtn('x-bf-loesch-' + e.uid, 'Löschen', function () {
        bestaetigen('Eintrag löschen?', '„' + xTextPlain(e.text).slice(0, 120) + (xTextPlain(e.text).length > 120 ? ' …' : '') + '“ wird gelöscht.', 'Eintrag löschen', function () {
          xEintragAendern(f.id, function (akt) { const n = xEintraege(akt).filter(function (x) { return x.uid !== e.uid; }); if (n.length === xEintraege(akt).length) return false; if (n.length) akt.eintraege = n; else delete akt.eintraege; return true; }, 'Eintrag gelöscht.');
          renderModule();
        });
      }))));
}
function xEintraegeBlock(f) {
  const E = xEintraege(f).map(function (e, i) { return { e: e, i: i }; }).sort(function (a, c) { return String(c.e.erfasst).localeCompare(String(a.e.erfasst)) || c.i - a.i; });
  const art = h('select', { id: 'x-bf-art', 'aria-label': 'Art des Eintrags', onchange: function (ev) { VIEW.draft['x-bf-art-' + f.id] = ev.target.value; } },
    Object.keys(X_EINTRAG_ARTEN).map(function (k) { return h('option', { value: k, selected: (VIEW.draft['x-bf-art-' + f.id] || 'lage') === k }, X_EINTRAG_ARTEN[k]); }));
  const ed = xTextEditor('x-bf-text', VIEW.draft['x-bf-text-' + f.id] || '', function (html) { VIEW.draft['x-bf-text-' + f.id] = html; });
  return h('div', null,
    h('p', { class: 'dim' }, 'Einträge'),
    h('div', { class: 'row' }, art), ed.knoten,
    h('div', { class: 'row' }, xBtn('x-bf-neu', 'Eintrag hinzufügen', function () {
      const t = ed.wert();
      if (!xTextPlain(t)) { meldung('Bitte einen Text für den Eintrag eingeben.'); return; }
      if (xTextPlain(t).length > X_EINTRAG_MAX) { meldung('Höchstens ' + X_EINTRAG_MAX + ' Zeichen je Eintrag.'); return; }
      if (xEintraege(xFall(f.id) || f).length >= X_EINTRAEGE_MAX) { meldung('Höchstens ' + X_EINTRAEGE_MAX + ' Einträge je Fall.'); return; }
      const wahl = art.value in X_EINTRAG_ARTEN ? art.value : 'lage';
      if (xEintragAendern(f.id, function (akt) { akt.eintraege = xEintraege(akt).concat([{ uid: sichtungKennung(), art: wahl, text: t, erfasst: nowIso() }]); return true; }, 'Eintrag gespeichert.')) delete VIEW.draft['x-bf-text-' + f.id];
      renderModule();
    })),
    E.length ? h('ul', { class: 'x-items' }, E.map(function (x) { return xEintragZeile(f, x.e); })) : h('p', { class: 'note' }, 'Noch keine Einträge.'));
}
/* Lagebriefing (Anzeige): vorhandene Kurzlage und bis zu fünf zuletzt erfasste, zugängliche Unterlagen. Keine eigenen Daten. */
function xBriefing(f) {
  const L = xFallMaterial(f).unterlagen.map(function (b, i) { return { b: b, i: i }; }).filter(function (x) {
    return (x.b.dossiers || []).every(function (id) { return xDossierLesbar(entitaet(id)); });          /* nicht lesbare Unterlagen erscheinen hier nicht */
  }).sort(function (a, c) { return String(c.b.erfasst || '').localeCompare(String(a.b.erfasst || '')) || c.i - a.i; }).slice(0, 5);
  return h('section', { id: 'x-briefing', class: 'panel', 'aria-label': 'Lagebriefing' },
    h('div', { class: 'pad' },
      h('h3', null, 'Lagebriefing'),
      h('p', { class: 'dim' }, 'Kurzlage'), f.frage ? (xFrageHtml(f) ? h('div', { class: 'x-kurztext' }, xTextAnzeige(xFrageHtml(f))) : h('p', { class: 'x-kurztext x-klartext' }, f.frage)) : h('p', { class: 'x-kurztext' }, 'Keine Kurzlage erfasst.'),
      xEintraegeBlock(f),
      h('p', { class: 'dim' }, 'Zuletzt hinzugefügt'),
      L.length ? h('ul', { class: 'x-items' }, L.map(function (x) {
        const b = x.b, z = rchZuBeobachtung(b.id);
        return h('li', { 'data-unterlage': b.id }, xBtn('x-brief-' + b.id, z.f.dateiname || z.q.herkunft || 'Textunterlage', function () {
          const e = document.getElementById('x-eintrag-' + b.id);
          if (e) { e.scrollIntoView({ block: 'center' }); e.focus(); }
        }), h('span', { class: 'dim' }, ' ' + b.id + ' · ' + fmtZ(b.erfasst)));
      })) : h('p', { class: 'note' }, 'Noch keine Unterlagen.')));
}
/* Fallpaket in X: "sichern" gilt dem geöffneten Fall, "importieren" ist auch ohne Fall verfügbar. Beides nutzt die Paketlogik der Recherche. */
function xPaketPanel(f) {
  return panel('Fallpaket', null, h('div', { class: 'pad' },
    h('p', { class: 'note' }, 'Ein einzelner Fall mit Quellen, Unterlagen, Dateien und den benötigten Dossierangaben als eine Datei. Das Profil insgesamt sichert die Schaltfläche „Export“ in der Leiste.'),
    f ? h('div', { class: 'row' }, xBtn('x-paket-sichern', 'Fallpaket sichern (' + f.id + ')', function () { rchPaketSichern(f.id); })) : null,
    h('div', { class: 'row top' }, h('label', { for: 'x-paket-laden' }, 'Fallpaket importieren')),
    h('div', { class: 'row' }, h('input', { type: 'file', id: 'x-paket-laden', accept: 'application/json,.json', onchange: function (ev) {
      const fl = ev.target.files && ev.target.files[0]; ev.target.value = ''; if (fl) rchPaketLaden(fl);
    } }))));
}
/* Einmalige Übernahme des früheren Einzelfelds "Nächster Schritt" (Testpaket mit PR #50) als datierter Eintrag.
   Feste Kennung: erneutes Laden erzeugt keine Dublette; Zeitstempel bleibt der bisherige. */
const X_ALT_SCHRITT_UID = 'altschritt';
let X_ALT_SCHRITT_FEHLER = false;
function xAltSchrittKandidaten() {
  return PROFIL.recherche.faelle.filter(function (f) { return f && f.naechsterSchritt && typeof f.naechsterSchritt === 'object' && typeof f.naechsterSchritt.text === 'string'; });
}
function xAltSchrittUebernehmen() {
  const K = xAltSchrittKandidaten();
  if (!K.length) { X_ALT_SCHRITT_FEHLER = false; return; }
  if (X_ALT_SCHRITT_FEHLER) return;
  const ok = xSchreiben(function () {
    K.forEach(function (f) {
      const s = f.naechsterSchritt, klar = s.text.trim().slice(0, X_EINTRAG_MAX);
      const vorhanden = xEintraege(f).some(function (e) { return e.uid === X_ALT_SCHRITT_UID; });
      if (klar && !vorhanden) {
        if (xEintraege(f).length >= X_EINTRAEGE_MAX) return;
        const am = typeof s.am === 'string' && s.am ? s.am : (typeof f.erfasst === 'string' && f.erfasst ? f.erfasst : nowIso());
        f.eintraege = xEintraege(f).concat([{ uid: X_ALT_SCHRITT_UID, art: 'schritt', text: xTextKanon(xTextAusKlartext(klar)), erfasst: am }]);
      }
      delete f.naechsterSchritt;
    });
    return true;
  });
  if (!ok) X_ALT_SCHRITT_FEHLER = true;
}
function renderX(m) {
  akVorschauFreigeben();
  xAltSchrittUebernehmen();
  const L = PROFIL.recherche.faelle;
  const f = xAngezeigt();
  const liste = panel('Fälle', null, h('div', { class: 'pad' },
    xBtn('x-neu', 'Neuer Fall', function () { xNeu(null); }),
    L.length ? h('ul', { class: 'x-faelle', 'aria-label': 'Fälle' }, L.map(function (x) {
      return h('li', null, h('button', { type: 'button', id: 'x-fall-' + x.id, 'aria-current': f === x ? 'true' : null, onclick: function () { xOeffnen(x.id); } },
        h('span', { class: 'dim' }, x.id + ' · ' + xStatus(x.zustand)[1]), h('strong', null, x.titel)));
    })) : h('p', { class: 'note' }, 'Noch keine Fälle.')));
  if (!f) return [modKopf(m), h('div', null, liste, xPaketPanel(null))];
  return [modKopf(m), h('div', { class: 'split x-layout' }, h('div', null, liste, xPaketPanel(f)), h('div', null,
    xBriefing(f),
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
