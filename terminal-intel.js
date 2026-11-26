/* Paket 2: Einhängepunkt /intel – schreibgeschützte Sicht auf den Recherchebestand (Dossiers, Fälle mit Unterlagen, Pins, Zonen, Sichtungen).
   Konzept und verbindliche Entscheidungen: docs/terminal-intel-konzept.md (Abschnitt 0). Klassisches Skript; wird nach karte-modul.js und
   recherche-modul.js und vor profil-modul.js geladen und enthält nur Funktionsdeklarationen. Daten und Zugangsregeln der Anwendung
   (dossierRechercheBestand, entitaet, PROFIL, STATE, pinGesperrt, zoneGesperrt, sperreText, Renderer der Karte) werden erst zur Laufzeit gelesen.
   Grundsätze: Sicht, keine Kopie (jeder Zugriff rendert neu); Namen der Objektverzeichnisse sind ausschließlich stabile Kennungen (E1);
   Querverweise sind vom Anbieter erzeugte symbolische Links auf kanonische Pfade ohne weitere Links, daher ohne Zyklen beim Auflösen (E3);
   gesperrte Objekte fehlen in Listen und ergeben bei direktem Zugriff "Permission denied" (Variante B, E4); jede Ausgabe trägt Abhängigkeiten
   (deps), damit eine spätere Sperre sie aus dem Scrollback entfernt. Systemseitige Beschriftungen sind englisch, Benutzerinhalte bleiben (E5). */
const INTEL_TYPEN = [['Person', 'persons', 'person'], ['Organisation', 'organizations', 'organization'], ['Ort', 'locations', 'location']];
const INTEL_START = Date.now();
const INTEL = (function () {
  const EN = {
    zustand: { sammlung: 'information gathering', offen: 'information gathering', laufend: 'in progress', 'on-hold': 'on hold', ruhend: 'on hold', abgeschlossen: 'closed' },
    bewertung: { unbewertet: 'unrated', duenn: 'thin basis', vorlaeufig: 'provisionally reliable', belastbar: 'reliable' },
    quelle: { Datei: 'file', Link: 'link', Text: 'text', Eigenbeobachtung: 'own observation' },
    guete: { unbewertet: 'unrated', gesichert: 'confirmed', plausibel: 'plausible', unbestaetigt: 'unconfirmed', widerspruechlich: 'contradictory', veraltet: 'outdated' },
    stufe: { aktuell: 'current', alternd: 'ageing', veraltet: 'outdated' },
    genau: { Koordinate: 'coordinate', Ortschaft: 'locality', Richtung: 'direction' },
    umgebung: { zufahrt: 'Access routes', sicht: 'Lines of sight', flucht: 'Escape routes', publikum: 'Public traffic', kameras: 'Cameras, lighting', nachbarn: 'Neighbourhood, businesses' },
    zweck: { Treffpunkt: 'meeting point', Beobachtungspunkt: 'observation point', 'Übergabe': 'handover', Unterstand: 'shelter', Fluchtweg: 'escape route', 'Parkmöglichkeit': 'parking', Sammelpunkt: 'assembly point', Sonstiges: 'other' },
    /* Statuswerte der Dossiers (SCENARIO.dossierStatus), Beziehungsarten (SCENARIO.verbindungstypen), Richtung, Falleinträge (X_EINTRAG_ARTEN) */
    status: { beobachtet: 'under observation', relevant: 'relevant', abgeschlossen: 'closed', archiviert: 'archived', beendet: 'ended', eliminiert: 'eliminated' },
    beziehung: { Leitung: 'leadership', 'Beschäftigung': 'employment', Unterstellung: 'subordination', Finanzierung: 'financing', 'Zugehörigkeit': 'affiliation',
      Kontakt: 'contact', Nutzung: 'use', Aufenthalt: 'presence', Transport: 'transport' },
    eintrag: { lage: 'situation', schritt: 'next step', frage: 'open question' },
    fundstelle: { Seite: 'page', Absatz: 'paragraph', Abschnitt: 'section', Zeitmarke: 'timestamp', Zeichenbereich: 'character range', 'ganze Datei': 'whole file' }
  };
  const wert = function (tabelle, x) { return Object.prototype.hasOwnProperty.call(tabelle, x) ? tabelle[x] : x; };
  function zeit(t) { const d = new Date(t); return t == null || isNaN(d) ? '-' : d.toISOString().slice(0, 19).replace('T', ' ') + ' UTC'; }
  function ms(t) { const v = Date.parse(t); return isFinite(v) ? v : INTEL_START; }
  function leer(x) { return x === undefined || x === null || x === '' ? '-' : String(x); }
  /* Beschriftung der vorhandenen Textblätter der Karte (pinText, eigeneZoneText, sichtungText), englisch */
  function textEN() {
    return {
      position: 'Position', zweck: 'Purpose', zweckLeer: 'not set', zweckWert: function (z) { return wert(EN.zweck, z); },
      umgebung: function (u) { return wert(EN.umgebung, u[0]); }, notiz: 'Note', angelegt: 'Created', zeitAngelegt: zeit, radius: 'Radius',
      stand: 'Last checked', zeitStand: zeit, pruefung: 'Check remark', kopfSichtung: function (si, e) { return si.id + ' · dossier ' + e.id + ' ' + e.name; },
      zeit: 'Time', zeitSichtung: zeit, ortMeldung: 'Reported location', ungefaehr: function (g) { return 'approximate, from ' + wert(EN.genau, g); },
      guete: 'Rating', gueteLabel: function (k) { return wert(EN.guete, k); }, aktualitaet: 'Age', stufe: function (s) { return wert(EN.stufe, s); },
      beobachtung: 'Observation', entwurf: 'Draft', leer: '-'
    };
  }

  /* ---- Bestand und Sperren (gleiche Regeln wie Oberfläche und zielZugang) ---- */
  function typDir(typ) { const x = INTEL_TYPEN.find(function (t) { return t[0] === typ; }); return x ? x[1] : null; }
  function typName(typ) { const x = INTEL_TYPEN.find(function (t) { return t[0] === typ; }); return x ? x[2] : String(typ); }
  function dossiers() { return dossierRechercheBestand().filter(function (e) { return e && typDir(e.typ); }); }
  function zustand(id) { return (STATE.dossiers && STATE.dossiers.entitaeten[id]) || { notizen: [] }; }
  function dossierPfad(id) { const e = entitaet(id), d = e && typDir(e.typ); return d ? ['dossiers', d, id] : null; }
  function pins() { return (PROFIL.pins || []).filter(function (p) { return p && /^PIN-\d{3,15}$/.test(p.id) && Array.isArray(p.ll); }); }
  function zonen() { return (PROFIL.zonen || []).filter(function (z) { return z && /^ZO-\d{3,15}$/.test(z.id) && Array.isArray(z.ll); }); }
  function sichtungen(id) { return (zustand(id).sichtungen || []).filter(function (si) { return si && /^SI-\d{3,15}$/.test(si.id); }); }
  function faelle() { return ((PROFIL.recherche || {}).faelle || []).filter(function (f) { return f && /^F-\d+$/.test(f.id); }); }
  function R() { return PROFIL.recherche || { quellen: [], fassungen: [], beobachtungen: [] }; }
  function dossierGesperrtId(id) { return (PROFIL.gesperrt || []).includes(id); }
  function gesperrt(dep) {
    if (!dep) return false;
    if (dep.art === 'dossier') return dossierGesperrtId(dep.id);
    if (dep.art === 'sichtung') return dossierGesperrtId(dep.dossier);
    if (dep.art === 'pin') { const p = (PROFIL.pins || []).find(function (x) { return x.id === dep.id; }); return !!p && pinGesperrt(p); }
    if (dep.art === 'zone') { const z = (PROFIL.zonen || []).find(function (x) { return x.id === dep.id; }); return !!z && zoneGesperrt(z); }
    /* Herkunft eines verwalteten Exports (Paket 4, M4): ursprüngliche Abhängigkeiten UND Bindung; fehlende oder ungültige Herkunft gilt als gesperrt
       (fail closed), damit auch ein früher ausgegebener Name nach Sperre, Identitätswechsel oder Löschung aus dem Scrollback verschwindet */
    /* Name aus einer Archivlistung in einer Pipeline (Paket 5): gesperrt, solange der Name nach der Archivregel nicht sichtbar ist */
    if (dep.art === 'archivname') return typeof terminalArchivNameSichtbar === 'function' && !terminalArchivNameSichtbar(dep.name);
    if (dep.art === 'herkunft') return !Array.isArray(dep.deps) || !dep.deps.length || !Array.isArray(dep.bindung) || !dep.bindung.length || dep.deps.some(gesperrt) || !dep.bindung.every(bindungGueltig);
    return false;
  }
  const dep = { dossier: function (id) { return { art: 'dossier', id: id }; }, pin: function (id) { return { art: 'pin', id: id }; },
    zone: function (id) { return { art: 'zone', id: id }; }, sichtung: function (d, id) { return { art: 'sichtung', dossier: d, id: id }; } };

  /* ---- Einträge ---- */
  function D(name, mtime, deps) { return { name: name, art: 'dir', deps: deps || [], mtime: mtime || INTEL_START }; }
  function F(name, render, mtime, deps) { return { name: name, art: 'file', render: render, deps: deps || [], mtime: mtime || INTEL_START }; }
  function L(name, ziel, mtime, deps) { return { name: name, art: 'link', ziel: ziel, deps: deps || [], mtime: mtime || INTEL_START }; }
  /* Tabelle mit Kopfzeile; je Zeile eigene Abhängigkeiten (granulare Schutzmetadaten für zusammengesetzte Ausgaben, E4) */
  /* Zellen einer Tabelle sind immer einzeilig (kontrollierte Escape-Darstellung), damit physische Zeilen und Schutzmetadaten übereinstimmen */
  function zelle(x) { return String(x).replace(/\r\n|\r|\n/g, '\\n').replace(/\t/g, '\\t').replace(/[\u0000-\u001f\u007f]/g, '?'); }
  function tabelle(kopf, zeilen) {
    zeilen = zeilen.map(function (z) { return { spalten: z.spalten.map(zelle), deps: z.deps }; });
    const alle = [kopf].concat(zeilen.map(function (z) { return z.spalten; })), breite = kopf.map(function (_, i) { return Math.max.apply(null, alle.map(function (r) { return String(r[i]).length; })); });
    const fmt = function (r) { return r.map(function (x, i) { return i === r.length - 1 ? String(x) : String(x).padEnd(breite[i]); }).join('  '); };
    return { text: [fmt(kopf)].concat(zeilen.map(function (z) { return fmt(z.spalten); })).join('\n') + '\n', zeilenDeps: [[]].concat(zeilen.map(function (z) { return z.deps; })) };
  }
  function felder(liste) { return liste.filter(Boolean).map(function (x) { return x[0] + ': ' + leer(x[1]); }).join('\n') + '\n'; }

  /* ---- Inhalte ---- */
  const README = ['/intel is a read-only view of the research data of this workstation.',
    'Changes made in the application appear here immediately; nothing is copied.', '',
    '  dossiers/     persons, organizations and locations, one directory per dossier',
    '  cases/        cases with linked dossiers, pins and sources',
    '  geospatial/   pins, zones and sightings', '',
    'Locked objects are not listed and cannot be accessed (Permission denied).',
    '"sudo open <id>" unlocks a dossier. "open ." and "map ." show the current object',
    'in the application. Dossier notes can be appended: echo "text" >> notes'].join('\n') + '\n';
  function dossierIndex(typFilter) {
    const liste = dossiers().filter(function (e) { return (!typFilter || typDir(e.typ) === typFilter) && !dossierGesperrtId(e.id); })
      .sort(function (a, b) { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; });
    return tabelle(['ID', 'TYPE', 'STATUS', 'NAME'], liste.map(function (e) { return { spalten: [e.id, typName(e.typ), zustand(e.id).status ? wert(EN.status, zustand(e.id).status) : '-', e.name], deps: [dep.dossier(e.id)] }; }));
  }
  function profil(e) {
    const st = zustand(e.id), ll = typeof karteKoord === 'function' ? karteKoord(e.id) : null;
    const el = typeof erkenntnisLage === 'function' && e.typ !== 'Ort' ? erkenntnisLage(e) : null;
    return { text: felder([['ID', e.id], ['Name', e.name], ['Type', typName(e.typ)], ['Country', e.land], ['Aliases', (e.aliase || []).length ? e.aliase.join(', ') : 'none known'],
      ['Status', st.status ? wert(EN.status, st.status) + (st.statusAm ? ' since ' + zeit(st.statusAm) : '') : 'none'],
      ['Register number', (typeof dossierRegisternummer === 'function' && dossierRegisternummer(e, st)) || 'none'],
      ['Position', ll ? ll[0].toFixed(5) + ', ' + ll[1].toFixed(5) : null],
      el ? ['Findings', el.anzahl ? el.anzahl + ', latest ' + el.juengste.art + ' ' + zeit(el.juengste.t) : 'none recorded'] : null,
      ['Summary', typeof st.kurzlage === 'string' ? st.kurzlage : null], ['Description', e.rolle], ['Key facts', (e.eckdaten || []).join(' · ')],
      ['Notes', (st.notizen || []).length], ['Sightings', sichtungen(e.id).length], ['Last modified', zeit(st.aktualisiert)]]) };
  }
  function notizen(e) {
    const n = zustand(e.id).notizen || [];
    return { text: n.map(function (x) { return x.id + '\n' + zeit(x.t) + '\n' + x.text; }).join('\n\n') + (n.length ? '\n' : '') };
  }
  function verbindungen(e) {
    const kanten = typeof dossierRechercheKanten === 'function' ? dossierRechercheKanten() : [];   /* wie die Oberfläche: Kanten zu gesperrten Dossiers fehlen */
    const z = kanten.filter(function (v) { return v.von === e.id || v.nach === e.id; }).map(function (v) {
      const anderer = v.von === e.id ? v.nach : v.von, o = entitaet(anderer);
      const pfeil = v.richtung === 'beidseitig' ? '<->' : v.von === e.id ? '->' : '<-';
      return { spalten: [pfeil, anderer, v.typ ? wert(EN.beziehung, v.typ) : '-', v.bewertung || '-', o ? o.name : '-'], deps: [dep.dossier(anderer)] };
    });
    return tabelle(['DIR', 'ID', 'RELATION', 'RATING', 'NAME'], z);
  }
  function bilder(e) {
    const groesse = function (b) { const m = /^data:[^,]*;base64,(.*)$/.exec(String(b || '')); return m ? Math.floor(m[1].length * 3 / 4) - (m[1].endsWith('==') ? 2 : m[1].endsWith('=') ? 1 : 0) : '-'; };
    const z = (PROFIL.galerie && PROFIL.galerie[e.id] || []).map(function (f) { return { spalten: [f.id, groesse(f.bild), zeit(f.t), f.text || '-'], deps: [] }; });
    if (PROFIL.bilder && PROFIL.bilder[e.id]) z.unshift({ spalten: ['portrait', groesse(PROFIL.bilder[e.id]), '-', '-'], deps: [] });
    return tabelle(['ID', 'BYTES', 'TAKEN', 'CAPTION'], z);
  }
  function dossierFaelle(id) {
    const e = entitaet(id), mitUnterlagen = new Set((e && typeof rchBelege === 'function' ? rchBelege(e) : []).filter(function (z) { return !!z.fall; }).map(function (z) { return z.fall.id; }));
    return faelle().filter(function (f) { return (Array.isArray(f.dossiers) && f.dossiers.includes(id)) || mitUnterlagen.has(f.id); });
  }
  /* Fall mit den Einträgen aus Modul X (Lage, nächste Schritte, offene Fragen; xEintraege, Klartext über xTextPlain) */
  function fallText(f) {
    const eintraege = typeof xEintraege === 'function' ? xEintraege(f) : [];
    const klar = function (t) { return typeof xTextPlain === 'function' ? xTextPlain(t).replace(/\n+$/, '') : String(t); };
    const kopf = felder([['ID', f.id], ['Title', f.titel], ['Question', f.frage], ['State', wert(EN.zustand, f.zustand)], ['Assessment', wert(EN.bewertung, f.bewertung || 'unbewertet')],
      ['Rationale', f.begruendung], ['Note', f.notiz], ['Created', zeit(f.erfasst)], ['Last modified', zeit(f.geaendert || f.erfasst)]]);
    if (!eintraege.length) return { text: kopf + '\nEntries: none\n' };
    return { text: kopf + '\nEntries:\n' + eintraege.map(function (e) {
      return '[' + wert(EN.eintrag, e.art) + '] ' + zeit(e.erfasst) + (e.geaendert ? ' (changed ' + zeit(e.geaendert) + ')' : '') + '\n' + klar(e.text);
    }).join('\n\n') + '\n' };
  }
  function fallIndex() { return tabelle(['ID', 'STATE', 'TITLE'], faelle().map(function (f) { return { spalten: [f.id, wert(EN.zustand, f.zustand), f.titel], deps: [] }; })); }
  function quelleText(q) {
    return { text: felder([['ID', q.id], ['Case', q.fall], ['Type', wert(EN.quelle, q.art)], ['Origin', q.herkunft], ['URL', q.url], ['Retrieved', q.abruf ? zeit(q.abruf) : null],
      ['Rating', q.guete ? (q.guete.wert || q.guete.stufe || '-') + (q.guete.begruendung ? ' (' + q.guete.begruendung + ')' : '') : 'unrated'],
      ['Derived from', Array.isArray(q.kette) && q.kette.length ? q.kette.map(function (k) { return k.id || k; }).join(', ') : null],
      ['Note', q.notiz], ['Current version', q.aktuelleFassung], ['Recorded', zeit(q.erfasst)]]) };
  }
  function fassungText(v) {
    return { text: felder([['ID', v.id], ['Source', v.quelle], ['Recorded', zeit(v.erfasst)], ['File name', v.dateiname], ['Size', v.groesse], ['Media type', v.typ],
      ['SHA-256', v.hash], ['Published', v.veroeffentlicht ? zeit(v.veroeffentlicht) : null], ['Attachment', v.anhang ? 'stored in the application (open the case to view)' : 'none']]) };
  }
  function ortText(o) { return !o ? null : typeof o === 'string' ? o : o.roh || o.text || o.name || (Array.isArray(o.ll) ? o.ll[0] + ', ' + o.ll[1] : null); }
  function ereignisText(x) { return !x ? null : typeof x === 'string' ? zeit(x) : (x.von || x.bis) ? zeit(x.von) + ' to ' + zeit(x.bis) : null; }
  function beobachtungenText(vId) {
    const liste = R().beobachtungen.filter(function (b) { return b && b.fassung === vId; });
    return { text: liste.map(function (b) {
      const p = b.pruefung;
      return [b.id, felder([['Location in source', b.fundstelle && b.fundstelle.typ ? wert(EN.fundstelle, b.fundstelle.typ) + (b.fundstelle.wert ? ' ' + b.fundstelle.wert : '') : 'none'],
        ['Quote', b.zitat], ['Event time', ereignisText(b.ereignis)], ['Place', ortText(b.ort)], ['Dossiers', (b.dossiers || []).join(', ')],
        ['Review', p && (p.nuetzlich || p.am) ? (p.nuetzlich ? 'checked and useful' : 'checked') + (p.am ? ' ' + zeit(p.am) : '') + (p.notiz ? ', ' + p.notiz : '') : 'not checked'],
        ['Recorded', zeit(b.erfasst)]]).trimEnd()].join('\n');
    }).join('\n\n') + (liste.length ? '\n' : '') };
  }
  function koordinaten(x) { return { text: 'latitude: ' + x.ll[0].toFixed(5) + '\nlongitude: ' + x.ll[1].toFixed(5) + '\n' }; }
  function pinIndex() {
    return tabelle(['ID', 'DOSSIER', 'NAME'], pins().filter(function (p) { return !pinGesperrt(p); }).map(function (p) { return { spalten: [p.id, p.dossier || '-', p.name || '-'], deps: [dep.pin(p.id)] }; }));
  }
  function zonenIndex() {
    return tabelle(['ID', 'RADIUS', 'DOSSIER', 'NAME'], zonen().filter(function (z) { return !zoneGesperrt(z); }).map(function (z) { return { spalten: [z.id, (z.r || '-') + ' m', z.dossier || '-', z.name || '-'], deps: [dep.zone(z.id)] }; }));
  }

  /* ---- Baum: Kinder eines kanonischen Verzeichnisses (rel ohne "intel"), einschließlich gesperrter Einträge (Filter in readdir) ---- */
  function kinder(rel) {
    const n = rel.length, a = rel[0];
    if (n === 0) return [F('README', function () { return { text: README }; }), D('cases'), D('dossiers'), D('geospatial')];
    if (a === 'dossiers') {
      if (n === 1) return [F('index', function () { return dossierIndex(null); })].concat(INTEL_TYPEN.map(function (t) { return D(t[1]); }));
      const typ = INTEL_TYPEN.find(function (t) { return t[1] === rel[1]; });
      if (!typ) return null;
      if (n === 2) return [F('index', function () { return dossierIndex(typ[1]); })].concat(dossiers().filter(function (e) { return e.typ === typ[0]; })
        .map(function (e) { return D(e.id, ms(zustand(e.id).aktualisiert), [dep.dossier(e.id)]); }));
      const e = entitaet(rel[2]);
      if (!e || e.typ !== typ[0]) return null;
      const t = ms(zustand(e.id).aktualisiert), d = [dep.dossier(e.id)];
      if (n === 3) {
        const liste = [F('profile', function () { return profil(e); }, t, d), F('notes', function () { return notizen(e); }, t, d), F('links', function () { return verbindungen(e); }, t, d),
          F('images', function () { return bilder(e); }, t, d), D('cases', t, d), D('pins', t, d), D('zones', t, d)];
        if (sichtungen(e.id).length) liste.push(L('sightings', ['geospatial', 'sightings', e.id], t, d));
        return liste;
      }
      if (n === 4 && rel[3] === 'cases') return dossierFaelle(e.id).map(function (f) { return L(f.id, ['cases', f.id], ms(f.geaendert || f.erfasst), d); });
      if (n === 4 && rel[3] === 'pins') return pins().filter(function (p) { return p.dossier === e.id; }).map(function (p) { return L(p.id, ['geospatial', 'pins', p.id], ms(p.t), d.concat(dep.pin(p.id))); });
      if (n === 4 && rel[3] === 'zones') return zonen().filter(function (z) { return z.dossier === e.id; }).map(function (z) { return L(z.id, ['geospatial', 'zones', z.id], ms(z.stand || z.t), d.concat(dep.zone(z.id))); });
      return null;
    }
    if (a === 'cases') {
      if (n === 1) return [F('index', fallIndex)].concat(faelle().map(function (f) { return D(f.id, ms(f.geaendert || f.erfasst)); }));
      const f = faelle().find(function (x) { return x.id === rel[1]; });
      if (!f) return null;
      const t = ms(f.geaendert || f.erfasst);
      if (n === 2) return [F('case', function () { return fallText(f); }, t), D('dossiers', t), D('pins', t), D('sources', t)];
      if (n === 3 && rel[2] === 'dossiers') {
        /* E4: Kennungen verknüpfter Dossiers bleiben sichtbar, auch gesperrte; das Folgen des Links prüft das Ziel */
        return (Array.isArray(f.dossiers) ? f.dossiers : []).filter(function (id) { return !!dossierPfad(id); }).map(function (id) { return L(id, dossierPfad(id), t); });
      }
      if (n === 3 && rel[2] === 'pins') {
        /* E4: gesperrte Kartenobjekte werden nicht offengelegt */
        return (Array.isArray(f.pins) ? f.pins : []).map(function (id) { return pins().find(function (p) { return p.id === id; }); }).filter(Boolean)
          .map(function (p) { return L(p.id, ['geospatial', 'pins', p.id], t, [dep.pin(p.id)]); });
      }
      if (rel[2] !== 'sources') return null;
      const quellen = R().quellen.filter(function (q) { return q && q.fall === f.id && /^Q-\d+$/.test(q.id); });
      if (n === 3) return quellen.map(function (q) { return D(q.id, ms(q.erfasst), []); });
      const q = quellen.find(function (x) { return x.id === rel[3]; });
      if (!q) return null;
      const fassungen = R().fassungen.filter(function (v) { return v && v.quelle === q.id && /^V-\d+$/.test(v.id); });
      if (n === 4) return [F('source', function () { return quelleText(q); }, ms(q.erfasst))].concat(fassungen.map(function (v) { return D(v.id, ms(v.erfasst)); }));
      const v = fassungen.find(function (x) { return x.id === rel[4]; });
      if (!v || n !== 5) return null;
      return [F('version', function () { return fassungText(v); }, ms(v.erfasst)), F('observations', function () { return beobachtungenText(v.id); }, ms(v.erfasst))];
    }
    if (a === 'geospatial') {
      if (n === 1) return [D('pins'), D('sightings'), D('zones')];
      if (rel[1] === 'pins' || rel[1] === 'zones') {
        const pin = rel[1] === 'pins', bestand = pin ? pins() : zonen(), mk = pin ? dep.pin : dep.zone;
        if (n === 2) return [F('index', pin ? pinIndex : zonenIndex)].concat(bestand.map(function (x) { return D(x.id, ms(x.stand || x.t), [mk(x.id)]); }));
        const x = bestand.find(function (y) { return y.id === rel[2]; });
        if (!x || n !== 3) return null;
        const t = ms(x.stand || x.t), d = [mk(x.id)];
        const liste = [F('record', function () { return { text: (pin ? pinText(x, textEN()) : eigeneZoneText(x, textEN())) + '\n' }; }, t, d), F('coordinates', function () { return koordinaten(x); }, t, d)];
        if (x.dossier && dossierPfad(x.dossier)) liste.push(L('dossier', dossierPfad(x.dossier), t, d));
        return liste;
      }
      if (rel[1] === 'sightings') {
        if (n === 2) return dossiers().filter(function (e) { return sichtungen(e.id).length; }).map(function (e) { return D(e.id, ms(zustand(e.id).aktualisiert), [dep.dossier(e.id)]); });
        const e = entitaet(rel[2]);
        if (!e || !typDir(e.typ) || !sichtungen(e.id).length) return null;
        if (n === 3) return sichtungen(e.id).map(function (si) { return D(si.id, ms(si.t), [dep.sichtung(e.id, si.id)]); });
        const si = sichtungen(e.id).find(function (x) { return x.id === rel[3]; });
        if (!si || n !== 4) return null;
        const t = ms(si.t), d = [dep.sichtung(e.id, si.id)];
        const liste = [F('record', function () { return { text: sichtungText(e, si, textEN()) + '\n' }; }, t, d), L('dossier', dossierPfad(e.id), t, d)];
        const p = si.pin && pins().find(function (x) { return x.id === si.pin; });
        if (p) liste.push(L('pin', ['geospatial', 'pins', p.id], t, d.concat(dep.pin(p.id))));
        return liste;
      }
      return null;
    }
    return null;
  }
  /* Auflösen: folgt Links in Zwischenkomponenten und, mit folgen, auch in der letzten. Linkziele sind kanonisch und enthalten keine Links,
     ein Folgen endet daher nach einem Schritt (keine Zyklen, auch bei gegenseitigen Verweisen Dossier <-> Fall). */
  /* sammeln (optional): nimmt die Abhängigkeiten jedes durchlaufenen Eintrags auf, auch der Links (Versand, Paket 4) */
  function aufloesen(rel, folgen, tiefe, sammeln) {
    if ((tiefe || 0) > 4) return { fehler: 'ELOOP' };
    let cur = [], eintrag = D('', INTEL_START);
    for (let i = 0; i < rel.length; i++) {
      const k = kinder(cur);
      if (!k) return { fehler: 'ENOENT' };
      const e = k.find(function (x) { return x.name === rel[i]; });
      if (!e) return { fehler: 'ENOENT' };
      if (sammeln) sammeln.push.apply(sammeln, e.deps);
      if (e.deps.some(gesperrt)) return { fehler: 'EACCES', bei: e.art === 'link' ? e.ziel : cur.concat(rel[i]) };
      const letzt = i === rel.length - 1;
      if (e.art === 'link' && (!letzt || folgen)) {
        const z = aufloesen(e.ziel, true, (tiefe || 0) + 1, sammeln);
        if (z.fehler) return z;
        cur = z.kanonisch; eintrag = z.eintrag;
        continue;
      }
      if (e.art === 'file' && !letzt) return { fehler: 'ENOTDIR' };
      cur = cur.concat(rel[i]); eintrag = e;
    }
    return { kanonisch: cur, eintrag: eintrag };
  }
  function rendern(e) { const r = e.render(); return { text: typeof sperreText === 'function' ? String(sperreText(r.text)) : r.text, zeilenDeps: r.zeilenDeps || null }; }
  function bytes(t) { return new TextEncoder().encode(t).length; }
  function anzeige(e) {
    const x = { name: e.name, dir: e.art === 'dir', mtime: Math.floor(e.mtime / 1000), deps: e.deps };
    if (e.art === 'link') { x.link = true; x.ziel = '/intel/' + e.ziel.join('/'); x.zielDir = true; x.bytes = x.ziel.length; }
    else x.bytes = e.art === 'dir' ? 4096 : bytes(rendern(e).text);
    return x;
  }
  /* ---- Versand (Paket 4, M3): Momentaufnahme mit Ursprung und Bindung ----
     Bindung einer Abhängigkeit: der Zustand des Objekts beim Versand (Pin und Zone mit Anlegezeit und Dossier, Sichtung mit dauerhafter UID).
     Gültig bleibt sie nur, solange das Objekt mit derselben Identität besteht und weder das damalige noch das heutige Dossier gesperrt ist;
     eine neu vergebene Kennung wird nicht als der alte Ursprung gedeutet. */
  /* Identität fail closed (Review 2 zu #140): Pin und Zone brauchen eine Anlegezeit t, eine Sichtung ihre dauerhafte UID; fehlt sie, ist die
     Bindung ungültig (da: false). Das damalige Dossier muss weiter bestehen. */
  function kennzeit(t) { return typeof t === 'string' && t !== '' ? t : null; }
  function bindung(d) {
    if (d.art === 'pin' || d.art === 'zone') {
      const x = (d.art === 'pin' ? pins() : zonen()).find(function (y) { return y.id === d.id; });
      return { art: d.art, id: d.id, t: x ? kennzeit(x.t) : null, dossier: x ? x.dossier || null : null, da: !!x && !!kennzeit(x.t) && (!x.dossier || !!entitaet(x.dossier)) };
    }
    if (d.art === 'sichtung') {
      const si = sichtungen(d.dossier).find(function (y) { return y.id === d.id; });
      return { art: 'sichtung', dossier: d.dossier, id: d.id, uid: si ? si.uid || null : null, da: !!si && !!si.uid && !!entitaet(d.dossier) };
    }
    return { art: d.art, id: d.id, da: d.art !== 'dossier' || !!entitaet(d.id) };
  }
  function bindungGueltig(b) {
    if (!b || !b.da) return false;
    if (b.art === 'dossier') return !!entitaet(b.id) && !dossierGesperrtId(b.id);
    if (b.art === 'pin' || b.art === 'zone') {
      const x = (b.art === 'pin' ? pins() : zonen()).find(function (y) { return y.id === b.id; });
      return !!x && !!b.t && kennzeit(x.t) === b.t && !(b.dossier && (!entitaet(b.dossier) || dossierGesperrtId(b.dossier))) && !(x.dossier && dossierGesperrtId(x.dossier));
    }
    if (b.art === 'sichtung') {
      const si = sichtungen(b.dossier).find(function (y) { return y.id === b.id; });
      return !!si && !!b.uid && si.uid === b.uid && !!entitaet(b.dossier) && !dossierGesperrtId(b.dossier);
    }
    return !gesperrt(b);
  }
  function eindeutig(liste) {
    const s = new Set();
    return liste.filter(function (d) { const k = JSON.stringify([d.art, d.id, d.dossier || null]); if (s.has(k)) return false; s.add(k); return true; });
  }
  const FEHLER = { EACCES: 'Permission denied' };
  const f = function (r) { return { fehler: FEHLER[r.fehler] || r.fehler }; };
  function objektVon(kan) {
    if (kan[0] === 'dossiers' && kan.length >= 3) return { art: 'dossier', id: kan[2], dossier: kan[2] };
    if (kan[0] === 'cases' && kan.length >= 2) return { art: 'fall', id: kan[1] };
    if (kan[0] === 'geospatial' && (kan[1] === 'pins' || kan[1] === 'zones') && kan.length >= 3) return { art: kan[1] === 'pins' ? 'pin' : 'zone', id: kan[2] };
    if (kan[0] === 'geospatial' && kan[1] === 'sightings' && kan.length >= 4) return { art: 'sichtung', id: kan[3], dossier: kan[2] };
    return null;
  }
  return {
    gesperrt: gesperrt,
    /* Schnittstelle des Anbieters (seg ohne führendes "intel") */
    stat: function (rel) {
      const pfad = [], r = aufloesen(rel, true, 0, pfad);
      if (r.fehler) return f(r);
      /* pfadDeps: Abhängigkeiten aller durchlaufenen Einträge einschließlich Links (Versand, Paket 4) */
      return { adapter: 'intel', typ: r.eintrag.art === 'file' ? 'file' : 'dir', eintrag: anzeige(r.eintrag), kanonisch: ['intel'].concat(r.kanonisch), deps: r.eintrag.deps, pfadDeps: eindeutig(pfad) };
    },
    readdir: function (rel) {
      const r = aufloesen(rel, true);
      if (r.fehler) return f(r);
      if (r.eintrag.art === 'file') return { fehler: 'ENOTDIR' };
      const k = kinder(r.kanonisch) || [];
      return { eintraege: k.filter(function (e) { return !e.deps.some(gesperrt); }).map(anzeige), kanonisch: ['intel'].concat(r.kanonisch), deps: r.eintrag.deps };
    },
    readFile: function (rel) {
      const r = aufloesen(rel, true);
      if (r.fehler) return f(r);
      if (r.eintrag.art !== 'file') return { fehler: 'EISDIR' };
      const x = rendern(r.eintrag);
      /* Prüfung unmittelbar vor der Rückgabe (die Sperre kann sich während eines Befehls ändern) */
      if (r.eintrag.deps.some(gesperrt)) return { fehler: 'Permission denied' };
      return { text: x.text, deps: r.eintrag.deps, zeilenDeps: x.zeilenDeps };
    },
    /* Versand einer Blattdatei: { text, deps, bindung, kanonisch } aus genau einer Darstellung. deps vereinigt Pfad (einschließlich Links),
       Datei und alle enthaltenen Zeilen; zusammengesetzte Indizes sind die Momentaufnahme der sichtbaren Zeilen. */
    /* zusatz: Abhängigkeiten des physisch aufgelösten Eingabepfads (terminalSendPfad), damit Links vor ".." erhalten bleiben. Ein Sichtungsrecord
       bettet seinen Ursprungspin ein (sichtungText): dessen Bindung gehört zur Momentaufnahme (spätere Verknüpfung oder Sperre des Pins). */
    versand: function (rel, zusatz) {
      const pfad = [], r = aufloesen(rel, true, 0, pfad);
      if (r.fehler) return f(r);
      if (r.eintrag.art !== 'file') return { fehler: 'EISDIR' };
      const x = rendern(r.eintrag), k = r.kanonisch, eingebettet = [];
      if (k[0] === 'geospatial' && k[1] === 'sightings' && k[4] === 'record' && typeof sichtungPin === 'function') {
        const si = sichtungen(k[2]).find(function (y) { return y.id === k[3]; }), p = si && sichtungPin(si, k[2]);
        if (p) eingebettet.push(dep.pin(p.id));
      }
      const deps = eindeutig((zusatz || []).concat(pfad, r.eintrag.deps, eingebettet, [].concat.apply([], (x.zeilenDeps || []).map(function (z) { return z || []; }))));
      if (deps.some(gesperrt)) return { fehler: 'Permission denied' };
      return { text: x.text, deps: deps, bindung: deps.map(bindung), kanonisch: ['intel'].concat(r.kanonisch) };
    },
    bindung: bindung,
    bindungGueltig: bindungGueltig,
    readlink: function (rel) {
      const r = aufloesen(rel, false);
      if (r.fehler) return f(r);
      return r.eintrag.art === 'link' ? { ziel: '/intel/' + r.eintrag.ziel.join('/'), deps: r.eintrag.deps } : { fehler: 'EINVAL' };
    },
    /* Rechercheobjekt eines Pfads (für open/map): { art: dossier|fall|pin|zone|sichtung, id, dossier } oder null */
    objekt: function (rel) {
      const r = aufloesen(rel, true);
      /* gesperrt: Objekt, dessen Sperre den Zugriff verhindert (für die Entsperrung über das bestehende sudo open, E9) */
      if (r.fehler) return Object.assign(f(r), r.bei ? { gesperrt: objektVon(r.bei) } : {});
      return { objekt: objektVon(r.kanonisch) };
    },
    /* Pfad eines Objekts (Knopf "Im Terminal"); null, wenn es im Baum nicht vorkommt */
    pfad: function (art, id, dossier) {
      const p = art === 'dossier' ? dossierPfad(id) : art === 'fall' ? (faelle().some(function (x) { return x.id === id; }) ? ['cases', id] : null)
        : art === 'pin' ? (pins().some(function (x) { return x.id === id; }) ? ['geospatial', 'pins', id] : null)
        : art === 'zone' ? (zonen().some(function (x) { return x.id === id; }) ? ['geospatial', 'zones', id] : null)
        : art === 'sichtung' ? (dossier && sichtungen(dossier).some(function (x) { return x.id === id; }) ? ['geospatial', 'sightings', dossier, id] : null) : null;
      return p ? '/intel/' + p.join('/') : null;
    },
    /* Notizziel: kanonischer Pfad .../dossiers/<typ>/<id>/notes -> Dossierkennung, sonst null */
    notizZiel: function (rel) {
      const r = aufloesen(rel, true);
      if (r.fehler) return f(r);
      const k = r.kanonisch;
      return k.length === 4 && k[0] === 'dossiers' && k[3] === 'notes' ? { id: k[2] } : { id: null };
    }
  };
})();
