'use strict';
/* Field Terminal: Modul 7, Ablage (Aktenliste, Dokumentenansicht mit Schwärzungen, Einsichtsanträge, Leseprotokoll).
   Klassisches Skript, nach dem Hauptskript geladen (siehe karte-modul.js); nutzt dessen globale Namen. */
/* =====================================================================
   MODUL 7: AKTEN
   Dokumentenviewer mit Schwärzungen. Eine Schwärzung bleibt verdeckt, solange die Zugangsstufe der Akte nicht ausreicht.
   Der Agent kann beim Ansprechpartner Freigabe beantragen; die Antwort kommt zeitversetzt und fällt je nach Akte positiv oder negativ aus.
   Der Text verdeckter Passagen wird nicht in die Seite geschrieben. Freigaben verfallen mit der Nachbereitung.
   ===================================================================== */
VIEW.akte = { offen: null }; VIEW.akte.suche = '';
function aktenListe() { return (SCENARIO.akten || []).filter(function (d) { return freigeschaltet(d.mission); }); }
function schwerKey(doc, r) { return doc.id + ':' + r.r; }
function schwerOffen(doc, r) { return r.stufe > doc.zugang && !(STATE.akten && STATE.akten.freigaben && STATE.akten.freigaben[schwerKey(doc, r)]); }
function schwerListe(doc) {
  const l = [];
  doc.abschnitte.forEach(function (a) { a.absaetze.forEach(function (p) { p.forEach(function (x) { if (typeof x !== 'string') l.push(x); }); }); });
  return l;
}
/* Schwärzungsgründe wie in Herausgabevermerken: Kürzel im schwarzen Balken, Legende am Blattende */
const AK_GRUND = { D: 'Schutz Dritter', Q: 'Quellen- und Methodenschutz', E: 'Einsatzplanung, Kreis der Eingeweihten' };
function akGrund(r) { return r.grund || (r.stufe >= 4 ? 'E' : r.stufe === 3 ? 'Q' : 'D'); }
function akEinstufung(doc) { return doc.einstufung || (doc.art === 'Handbuch' ? 'NUR FÜR DEN DIENSTGEBRAUCH' : doc.zugang >= 3 ? 'GEHEIM' : 'VERTRAULICH'); }
function akZeichen(doc) { let n = 0; doc.abschnitte.forEach(function (a) { n += a.ueberschrift.length; a.absaetze.forEach(function (p) { p.forEach(function (x) { n += (typeof x === 'string' ? x : x.t).length; }); }); }); return n; }
function akBlaetter(doc) { return Math.max(1, Math.ceil(akZeichen(doc) / 1900)); }
function akVerteiler(doc) { return doc.verteiler || (doc.art === 'Handbuch' ? 'Alle Einsatzkräfte, Registratur' : 'Ansprechpartner; Einsatzkraft (Einsicht nach Zugangsstufe); Registratur'); }
function akAusfertigung(doc) { return 1 + (cyrb53(doc.id + SCENARIO.agent.id, 3) % 6); }
function akSachakte(d) { return d.mission === 'STD' ? 'Allgemeine Dienstvorschriften' : 'Sachakte ' + String(d.reg).replace(/^S9-Reg\.\s*/, '').split('/')[0]; }
function akteSchwaerzung(doc, r, nr) {
  if (!schwerOffen(doc, r)) {
    const frei = r.stufe > doc.zugang;
    return h('span', { class: 'rd-text' + (frei ? ' rd-frei' : ''), title: frei ? 'Einsicht gewährt durch den Ansprechpartner' : '' }, r.t, h('sup', null, '[' + nr + ']'));
  }
  const breite = Math.max(8, Math.min(44, Math.round(r.t.length / 8) * 8));
  return h('span', { class: 'rd', role: 'img', 'aria-label': 'Geschwärzt, Grund ' + AK_GRUND[akGrund(r)] + ', Zugangsstufe ' + r.stufe + ' erforderlich', style: 'width:' + breite + 'ch' }, h('i', { class: 'rd-k' }, akGrund(r)), h('sup', null, '[' + nr + ']'));
}
function akteAnsicht(doc) {
  const liste = schwerListe(doc), nrVon = function (x) { return liste.indexOf(x) + 1; };
  const offen = liste.filter(function (r) { return schwerOffen(doc, r); }).length;
  const vs = akEinstufung(doc), bl = akBlaetter(doc), gz = String(doc.reg).replace(/^S9-Reg\.\s*/, 'S9 ');
  const legende = Object.keys(AK_GRUND).filter(function (k) { return liste.some(function (r) { return akGrund(r) === k && schwerOffen(doc, r); }); });
  const blatt = h('div', { class: 'akte', id: 'akte-blatt' },
    h('div', { class: 'akte-vs' }, vs),
    h('div', { class: 'akte-kopf' }, h('strong', null, SCENARIO.dienst), h('span', null, 'Registratur')),
    h('div', { class: 'akte-feld' },
      h('div', null, h('span', { class: 'ak-l' }, 'Geschäftszeichen'), h('span', null, gz)),
      h('div', null, h('span', { class: 'ak-l' }, 'Datum / Stand'), h('span', null, doc.stand)),
      h('div', null, h('span', { class: 'ak-l' }, 'Art'), h('span', null, doc.art)),
      h('div', null, h('span', { class: 'ak-l' }, 'Ausfertigung'), h('span', null, akAusfertigung(doc) + ' von 6, Empfänger ' + SCENARIO.agent.codename))),
    h('h2', { class: 'akte-titel' }, h('span', { class: 'ak-l' }, 'Betreff'), doc.titel),
    h('div', { class: 'akte-bezug' }, h('span', { class: 'ak-l' }, 'Verteiler'), akVerteiler(doc)),
    doc.abschnitte.map(function (a) {
      return h('section', null, h('h3', null, a.ueberschrift), a.absaetze.map(function (p) {
        return h('p', null, p.map(function (x) { return typeof x === 'string' ? x : akteSchwaerzung(doc, x, nrVon(x)); }));
      }));
    }),
    doc.anlagen && doc.anlagen.length ? h('div', { class: 'akte-anl' }, h('strong', null, 'Anlagen'), doc.anlagen.map(function (x, i) {
      const d2 = x.doc ? aktenListe().find(function (d) { return d.id === x.doc; }) : null;
      return h('div', null, 'Anlage ' + (i + 1) + ': ', d2 ? h('button', { type: 'button', class: 'link', id: 'ak-anl-' + d2.id, onclick: function () { dispatch({ type: 'AKTE_GEOEFFNET', id: d2.id }); } }, x.titel) : x.titel + (x.doc ? ' (nicht zugänglich)' : ' (nicht Bestandteil dieser Ausfertigung)'));
    })) : null,
    h('div', { class: 'akte-aend' }, h('strong', null, 'Änderungsnachweis'), (doc.verlauf && doc.verlauf.length ? doc.verlauf : [{ stand: doc.stand, text: 'Erstfassung' }]).map(function (v) { return h('div', null, v.stand + ': ' + v.text); })),
    legende.length ? h('div', { class: 'akte-legende' }, h('strong', null, 'Schwärzungsvermerk: '), legende.map(function (k) { return k + ' = ' + AK_GRUND[k]; }).join(' · ')) : null,
    h('div', { class: 'akte-fuss' }, h('span', null, gz), h('span', null, bl === 1 ? 'Blatt 1 von 1' : 'Blatt 1 bis ' + bl + ' von ' + bl), h('span', null, vs)),
    h('div', { class: 'akte-vs unten' }, vs));
  const tab = tabelle(['Nr.', 'Grund', 'Mindeststufe', 'Stand', ''], liste.map(function (r) {
    const key = schwerKey(doc, r), anfrage = STATE.akten.anfragen[key], offenZ = schwerOffen(doc, r);
    const zustand = !offenZ ? (r.stufe > doc.zugang ? 'Einsicht gewährt' : 'ohne Beschränkung') : anfrage ? 'Ersuchen ' + fmtZ(anfrage).slice(11, 16) + 'Z, Antwort ausstehend' : r.antrag === 'nie' ? 'Einsicht ausgeschlossen' : 'nicht beantragt';
    const knopf = offenZ && r.antrag !== 'nie' && !anfrage ? h('button', { type: 'button', id: 'ak-' + doc.id + '-' + r.r, disabled: STATE.agent.status === 'Ruhend',
      onclick: function () { dispatch({ type: 'AKTE_ANTRAG', doc: doc.id, r: r.r }); } }, 'Einsicht erbitten') : null;
    return [td('nw', '[' + nrVon(r) + ']'), td('nw', akGrund(r) + ' · ' + AK_GRUND[akGrund(r)]), td('nw', 'Stufe ' + r.stufe), td('nw', zustand), knopf || ''];
  }), 'Keine Schwärzungen in diesem Dokument.');
  return [panel(doc.reg + ' · ' + doc.titel, [h('span', { class: 'badge' + (offen ? ' on' : '') }, offen ? 'teilweise einsehbar' : 'vollständig einsehbar')], h('div', { class: 'akte-wrap' }, blatt)),
          panel('Einsichtsvorgänge', [h('span', { class: 'badge' }, offen + ' von ' + liste.length + ' geschwärzt')], tab,
            h('p', { class: 'note pad', id: 'ak-lese' }, 'Leseprotokoll: ' + (function () { const g = (STATE.akten.gelesen || {})[doc.id]; return g ? SCENARIO.agent.codename + ', erste Einsicht ' + fmtZ(g.erst) + ', zuletzt ' + fmtZ(g.zuletzt) + ', ' + g.n + (g.n === 1 ? ' Einsicht' : ' Einsichten') : 'keine Einsicht verzeichnet'; })() + '.'),
            h('p', { class: 'note pad' }, 'Ein Einsichtsersuchen geht über den Ansprechpartner an die Registratur; die Antwort kommt zeitversetzt über den Kanal Ansprechpartner. Entschieden wird nach Zugangsstufe und Kreis der Eingeweihten.'))];
}
/* Darstellung des Moduls 7 */
function renderAkten(m) {
  const eingang = VIEW.akte.reiter === 'eingang';
  const reiter = h('div', { class: 'reiterleiste', role: 'tablist', 'aria-label': 'Ablagebereiche' },
    [['registratur', 'Registratur'], ['eingang', 'Eingang']].map(function (x) {
      const an = eingang === (x[0] === 'eingang');
      return h('button', { type: 'button', role: 'tab', 'aria-selected': an ? 'true' : 'false', id: 'ak-tab-' + x[0], class: 'reiter' + (an ? ' on' : ''),
        onclick: function () { VIEW.akte.reiter = x[0]; renderModule(); } }, x[1]);
    }));
  if (eingang) return [modKopf(m), reiter, akEingangAnsicht()];
  akVorschauFreigeben();
  const alle = aktenListe(), q = erkFold(VIEW.akte.suche || '');
  const docs = alle.filter(function (d) { return !q || erkFold(d.titel + ' ' + d.reg + ' ' + d.art).indexOf(q) >= 0; });
  if (!VIEW.akte.offen || !alle.some(function (d) { return d.id === VIEW.akte.offen; })) VIEW.akte.offen = alle.length ? alle[0].id : null;
  const cur = alle.find(function (d) { return d.id === VIEW.akte.offen; });
  const zeilen = []; let gruppe = null;
  docs.forEach(function (d) {
    const g = akSachakte(d), l = schwerListe(d), n = l.filter(function (r) { return schwerOffen(d, r); }).length;
    if (g !== gruppe) { gruppe = g; zeilen.push(h('tr', { class: 'ak-gruppe' }, h('td', { colspan: '6' }, g))); }
    zeilen.push(h('tr', { class: d.id === VIEW.akte.offen ? 'ak-aktiv' : null },
      td('nw', d.reg.replace(/^S9-Reg\.\s*/, 'S9 ')),
      h('td', null, h('button', { type: 'button', class: 'link', id: 'ak-open-' + d.id, 'aria-current': d.id === VIEW.akte.offen ? 'true' : null,
        onclick: function () { dispatch({ type: 'AKTE_GEOEFFNET', id: d.id }); } }, d.titel)),
      td('nw', d.art), td('nw', akEinstufung(d)), td('nw', akBlaetter(d) + ' Bl.'), td('nw', n ? 'teilweise (' + n + ' geschwärzt)' : 'vollständig')));
  });
  const tbl = h('div', { class: 'tw' }, h('table', null,
    h('thead', null, h('tr', null, ['Geschäftszeichen', 'Betreff', 'Art', 'Einstufung', 'Umfang', 'Einsicht'].map(function (t) { return h('th', { scope: 'col' }, t); }))),
    h('tbody', null, zeilen.length ? zeilen : h('tr', null, h('td', { colspan: '6', class: 'dim' }, 'Keine Treffer.')))));
  return [
    modKopf(m), reiter,
    panel('Registratur', [h('span', { class: 'badge' }, docs.length + ' von ' + alle.length)],
      h('div', { class: 'ak-suche' }, h('label', { for: 'ak-suche' }, 'Suche'),
        h('input', { type: 'text', id: 'ak-suche', value: VIEW.akte.suche || '', placeholder: 'Betreff, Geschäftszeichen, Art',
          oninput: function (ev) { VIEW.akte.suche = ev.target.value; const pos = ev.target.selectionStart; renderModule(); const i = $('ak-suche'); if (i) { i.focus(); try { i.setSelectionRange(pos, pos); } catch (e) {} } } })),
      tbl),
    cur ? akteAnsicht(cur) : null
  ].flat().filter(Boolean);
}

/* Eingang: vorläufige Einträge gehören keinem Fall. Die Datei liegt bereits im
   Recherche-Dateispeicher und behält bei der Übernahme ihren Anhangsschlüssel. */
const AK_EINGANG_KEY = PROFIL_KEY + '.ablage-eingang';
const AK_EINGANG = { auswahl: null, arbeit: false };
let akVorschauUrl = null;
function akEingangLesen() {
  const liste = JSON.parse(localStorage.getItem(AK_EINGANG_KEY) || '[]');
  if (!Array.isArray(liste)) throw new Error('Eingang nicht lesbar');
  return liste;
}
function akEingangSpeichern(liste) {
  localStorage.setItem(AK_EINGANG_KEY, JSON.stringify(liste));
}
function akEingangSichtbar(liste) {
  const vergeben = new Set(PROFIL.recherche.fassungen.map(function (f) { return f.anhang; }));
  return liste.filter(function (x) { return !vergeben.has(x.anhang); });
}
function akEingangFertig() {
  AK_EINGANG.arbeit = false;
  if (STATE.ui.modul === 'akten') renderModule();
}
async function akEingangAblegen(file) {
  if (!file || AK_EINGANG.arbeit) return;
  if (file.size > RCH_MAX) { meldung('Datei über 20 MB, nicht angenommen.'); return; }
  AK_EINGANG.arbeit = true;
  let schluessel = null, abgelegt = false;
  try {
    const liste = akEingangLesen();
    schluessel = 'ANH-E-' + Array.from(crypto.getRandomValues(new Uint32Array(4)), function (x) { return x.toString(16).padStart(8, '0'); }).join('');
    const hash = await rchHash(file);
    await RIDB.put(schluessel, file);
    akEingangSpeichern(akEingangSichtbar(liste).concat({ anhang: schluessel, dateiname: file.name, groesse: file.size, typ: file.type || 'application/octet-stream', hash: hash, erfasst: nowIso() }));
    abgelegt = true;
    AK_EINGANG.auswahl = schluessel;
    meldung('Datei im Eingang abgelegt.');
  } catch (e) {
    if (schluessel && !abgelegt) await RIDB.del(schluessel).catch(function () {});
    meldung('Datei konnte nicht im Eingang abgelegt werden.');
  } finally { akEingangFertig(); }
}
async function akEingangLoeschen(eintrag) {
  if (AK_EINGANG.arbeit) return;
  AK_EINGANG.arbeit = true;
  let alt, entfernt = false;
  try {
    alt = akEingangLesen();
    if (!akEingangSichtbar(alt).some(function (x) { return x.anhang === eintrag.anhang; })) {
      meldung('Datei ist nicht mehr im Eingang.'); return;
    }
    akEingangSpeichern(alt.filter(function (x) { return x.anhang !== eintrag.anhang; }));
    entfernt = true;
    await RIDB.del(eintrag.anhang);
    if (AK_EINGANG.auswahl === eintrag.anhang) AK_EINGANG.auswahl = null;
    meldung('Datei aus dem Eingang gelöscht.');
  } catch (e) {
    if (entfernt) {
      try {
        const aktuell = akEingangLesen();
        if (!aktuell.some(function (x) { return x.anhang === eintrag.anhang; })) akEingangSpeichern(aktuell.concat(eintrag));
      } catch (ex) { meldung('Datei konnte nicht gelöscht und der Listeneintrag nicht wiederhergestellt werden.'); return; }
    }
    meldung('Datei konnte nicht aus dem Eingang gelöscht werden.');
  } finally { akEingangFertig(); }
}
function akVorschauFreigeben() {
  if (akVorschauUrl) { URL.revokeObjectURL(akVorschauUrl); akVorschauUrl = null; }
}
new MutationObserver(function () {
  if (STATE && (STATE.ui.modul !== 'akten' || document.body.classList.contains('locked'))) akVorschauFreigeben();
}).observe(document.body, { attributes: true, attributeFilter: ['class'], childList: true, subtree: true });
async function akEingangVorschau(eintrag, ziel) {
  try {
    const blob = await RIDB.get(eintrag.anhang);
    if (!ziel.isConnected || document.body.classList.contains('locked')) return;
    if (!blob) { ziel.textContent = 'Datei im lokalen Speicher nicht vorhanden.'; return; }
    const bild = /^(image\/(png|jpeg|gif|webp|bmp))$/.test(blob.type);
    if (bild) {
      akVorschauUrl = URL.createObjectURL(blob);
      ziel.replaceChildren(h('img', { src: akVorschauUrl, alt: eintrag.dateiname, style: 'max-width:100%;max-height:60vh;object-fit:contain' }));
    } else if (blob.type === 'application/pdf' && (await blob.slice(0, 5).text()) === '%PDF-') {
      if (!ziel.isConnected || document.body.classList.contains('locked')) return;
      akVorschauUrl = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      ziel.replaceChildren(h('iframe', { src: akVorschauUrl, title: 'PDF-Vorschau: ' + eintrag.dateiname, style: 'width:100%;height:55vh;border:0' }));
    } else if (/^text\/(plain|markdown|csv)$/.test(blob.type) || /\.(txt|md|csv)$/i.test(eintrag.dateiname)) {
      const text = await blob.slice(0, 65536).text();
      if (ziel.isConnected) ziel.replaceChildren(h('pre', { style: 'white-space:pre-wrap;overflow-wrap:anywhere;max-height:55vh;overflow:auto' }, text + (blob.size > 65536 ? '\n… Vorschau gekürzt' : '')));
    } else ziel.textContent = 'Für dieses Dateiformat ist keine Vorschau verfügbar.';
  } catch (e) { if (ziel.isConnected) ziel.textContent = 'Vorschau konnte nicht geladen werden.'; }
}
async function akEingangZuordnen(eintrag, form) {
  if (AK_EINGANG.arbeit) return;
  const dossier = entitaet(form.elements.dossier.value), fall = form.elements.fall.value;
  const titel = form.elements.titel.value.trim();
  if (!dossier || dossierGesperrt(dossier) || infoGesperrt(dossier) || !dossierOffen(dossier.mission) ||
      (!PROFIL.recherche.faelle.some(function (f) { return f.id === fall; }) && !(fall === '__neu' && titel))) {
    meldung('Bitte ein verfügbares Dossier und einen Fall wählen oder benennen.'); return;
  }
  const notiz = form.elements.notiz.value, ft = form.elements.fundstelle.value.trim(), ftTyp = form.elements.ftTyp.value;
  AK_EINGANG.arbeit = true;
  try {
    const blob = await RIDB.get(eintrag.anhang);
    if (!blob) { meldung('Datei fehlt. Die Zuordnung wurde nicht gespeichert.'); return; }
    if (!akEingangSichtbar(akEingangLesen()).some(function (x) { return x.anhang === eintrag.anhang; })) return;
    if (dossierGesperrt(dossier) || infoGesperrt(dossier) || entitaet(dossier.id) !== dossier || document.body.classList.contains('locked')) return;
    const ok = rchSchreiben({ type: 'RECHERCHE_BELEG', dossier: dossier.id, fall: fall === '__neu' ? null : fall,
      neuerFall: fall === '__neu' ? { titel: titel } : null, art: 'Datei', notiz: notiz,
      fundstelle: ft || ftTyp === 'ganze Datei' ? { typ: ftTyp, wert: ft } : null,
      fassung: { anhang: eintrag.anhang, dateiname: eintrag.dateiname, typ: eintrag.typ, groesse: eintrag.groesse, hash: eintrag.hash }
    }, 'Unterlage erfasst');
    if (!ok) return;
    try { akEingangSpeichern(akEingangSichtbar(akEingangLesen())); } catch (e) { /* vergebene Dateien bleiben aus der Eingangsliste gefiltert */ }
    AK_EINGANG.auswahl = null;
    meldung('Datei dem Fall und Dossier zugeordnet.');
  } catch (e) { meldung('Zuordnung nicht gespeichert. Die Datei bleibt im Eingang.'); }
  finally { akEingangFertig(); }
}
function akEingangAnsicht() {
  akVorschauFreigeben();
  let liste;
  try { liste = akEingangSichtbar(akEingangLesen()); }
  catch (e) { return panel('Eingang', null, h('p', { class: 'note' }, 'Der lokale Eingangsspeicher ist nicht lesbar.')); }
  const cur = liste.find(function (x) { return x.anhang === AK_EINGANG.auswahl; }) || liste[liste.length - 1];
  const seite = h('section', null,
    h('label', { for: 'ak-eingang-datei' }, 'Datei ablegen'),
    h('input', { id: 'ak-eingang-datei', type: 'file', disabled: AK_EINGANG.arbeit, onchange: function (ev) { const f = ev.target.files[0]; ev.target.value = ''; void akEingangAblegen(f); } }),
    h('p', { class: 'note' }, 'Lokal in diesem Browserprofil. Nicht in der Profil-JSON enthalten. Nach Zuordnung über das Fallpaket sicherbar.'),
    h('ul', { class: 'ak-eingang-liste', 'aria-label': 'Dateien im Eingang' }, liste.slice().reverse().map(function (x, i) {
      return h('li', null, h('button', { type: 'button', id: 'ak-eingang-wahl-' + i, title: x.dateiname, 'aria-current': x === cur ? 'true' : null, onclick: function () { AK_EINGANG.auswahl = x.anhang; renderModule(); } }, h('span', { class: 'ak-eingang-name' }, x.dateiname)));
    })));
  if (!cur) return panel('Eingang', null, h('div', { class: 'pad' }, seite, h('p', { class: 'note' }, 'Noch keine Dateien abgelegt.')));
  const vorschau = h('div', { id: 'ak-eingang-vorschau', 'aria-live': 'polite' }, 'Vorschau wird geladen …');
  const fall = h('select', { name: 'fall', id: 'ak-eingang-fall' },
    h('option', { value: '' }, 'Fall wählen'), PROFIL.recherche.faelle.map(function (f) { return h('option', { value: f.id }, f.titel); }), h('option', { value: '__neu' }, 'Neuen Fall anlegen'));
  const tit = h('input', { id: 'ak-eingang-titel', name: 'titel', maxlength: 120, disabled: true });
  fall.addEventListener('change', function () { tit.disabled = fall.value !== '__neu'; });
  const dos = h('select', { name: 'dossier', id: 'ak-eingang-dossier' }, h('option', { value: '' }, 'Dossier wählen'), pool().filter(function (e) {
    return !dossierGesperrt(e) && !infoGesperrt(e) && dossierOffen(e.mission);
  }).map(function (e) { return h('option', { value: e.id }, e.id + ' ' + e.name); }));
  const form = h('form', { onsubmit: function (ev) { ev.preventDefault(); void akEingangZuordnen(cur, ev.currentTarget); } },
    feldZeile('Fall', fall.id, fall), feldZeile('Neuer Falltitel', tit.id, tit), feldZeile('Dossier', dos.id, dos),
    feldZeile('Fundstellenart', 'ak-eingang-ft-typ', h('select', { id: 'ak-eingang-ft-typ', name: 'ftTyp' }, RCH_FUNDSTELLEN.map(function (x) { return h('option', { value: x }, x); }))),
    feldZeile('Fundstelle (optional)', 'ak-eingang-ft', h('input', { id: 'ak-eingang-ft', name: 'fundstelle', maxlength: 120 })),
    feldZeile('Notiz (optional)', 'ak-eingang-notiz', h('input', { id: 'ak-eingang-notiz', name: 'notiz', maxlength: 300 })),
    h('button', { type: 'submit', id: 'ak-eingang-zuordnen', disabled: AK_EINGANG.arbeit }, 'Zuordnen'));
  setTimeout(function () { if (vorschau.isConnected) void akEingangVorschau(cur, vorschau); }, 0);
  return panel('Eingang', null, h('div', { class: 'pad ak-eingang-layout' }, seite,
    h('section', null, h('h3', null, cur.dateiname), vorschau, form,
      h('div', { class: 'row' }, h('button', { type: 'button', id: 'ak-eingang-loeschen', disabled: AK_EINGANG.arbeit,
        onclick: function () {
          bestaetigen('Datei aus dem Eingang löschen?', '„' + cur.dateiname + '“ wird aus dem lokalen Eingang entfernt. Die Originaldatei außerhalb des Terminals bleibt erhalten.',
            'Datei löschen', function () { void akEingangLoeschen(cur); });
        } }, 'Datei löschen')))));
}
