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
    modKopf(m),
    panel('Registratur', [h('span', { class: 'badge' }, docs.length + ' von ' + alle.length)],
      h('div', { class: 'ak-suche' }, h('label', { for: 'ak-suche' }, 'Suche'),
        h('input', { type: 'text', id: 'ak-suche', value: VIEW.akte.suche || '', placeholder: 'Betreff, Geschäftszeichen, Art',
          oninput: function (ev) { VIEW.akte.suche = ev.target.value; const pos = ev.target.selectionStart; renderModule(); const i = $('ak-suche'); if (i) { i.focus(); try { i.setSelectionRange(pos, pos); } catch (e) {} } } })),
      tbl),
    cur ? akteAnsicht(cur) : null
  ].flat().filter(Boolean);
}
