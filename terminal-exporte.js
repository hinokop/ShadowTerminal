/* Paket 4, M4: verwaltete Exporte (docs/terminal-dateiintegration-konzept.md §9). Eigene IndexedDB "fieldterminal.exporte", getrennt von VFS,
   Profil (localStorage), Home-Sicherung und Fallpaket; nicht gesichert (bewusst, §9.8). Schreibgeschützter Anbieter /exports.
   Klassisches Skript nach terminal-intel.js und vor profil-modul.js; liest PROFIL, STATE, INTEL, entitaet und sichtungPin erst zur Laufzeit.
   Die Datenbank wird erst beim ersten Zugriff geöffnet (A0: Anmeldung und Kommunikationsablauf warten nie darauf).
   Grundsätze: unveränderliche Momentaufnahmen; Zustand je Zugriff aus ursprünglichen UND aktuellen Abhängigkeiten (INTEL.bindung,
   INTEL.bindungGueltig, keine zweite Rechtedatenbank); gesperrt, verwaist und nicht vorhanden antworten gleich (ENOENT, D2); Namen aus
   UTC-Zeit mit Millisekunden und einem vom Bestand unabhängigen Zufallssuffix, ohne laufende Nummer (D3, Review zu #140). */
const EXPORTE_GRENZE = { anzahl: 1000, gesamt: 16 * 1048576, datei: 65536 };
const EXPORTE = (function () {
  const DBNAME = 'fieldterminal.exporte';
  let offen = null;
  function oeffnen() {
    if (offen) return offen;
    offen = new Promise(function (ok, fail) {
      let r;
      try { r = indexedDB.open(DBNAME, 1); } catch (e) { fail(e); return; }
      r.onupgradeneeded = function () {
        const db = r.result, s = db.createObjectStore('exporte', { keyPath: 'id' });
        s.createIndex('pfad', 'pfad', { unique: true });
        db.createObjectStore('texte', { keyPath: 'id' });
      };
      r.onsuccess = function () { const db = r.result; db.onversionchange = function () { db.close(); offen = null; }; ok(db); };
      r.onerror = function () { fail(r.error); };
    });
    offen.catch(function () { offen = null; });
    return offen;
  }
  function anf(req) { return new Promise(function (ok, fail) { req.onsuccess = function () { ok(req.result); }; req.onerror = function () { fail(req.error); }; }); }
  /* Eine Transaktion über Metadaten und Texte. fn liefert ein Ergebnis; mit fehler wird die Transaktion verworfen (nichts geändert). Abbruch durch
     den Browser (Speicher voll, QuotaExceededError) ergibt { fehler: 'speicher' }. */
  async function tx(modus, fn) {
    let db;
    try { db = await oeffnen(); } catch (e) { return { fehler: 'eio' }; }
    return new Promise(function (ok) {
      let t, erg = null;
      try { t = db.transaction(['exporte', 'texte'], modus); } catch (e) { ok({ fehler: 'eio' }); return; }
      t.oncomplete = function () { ok(erg); };
      t.onabort = function () { ok(erg && erg.fehler ? erg : { fehler: t.error && t.error.name === 'QuotaExceededError' ? 'speicher' : 'eio' }); };
      Promise.resolve().then(function () { return fn(t.objectStore('exporte'), t.objectStore('texte')); }).then(function (r) {
        erg = r;
        if (r && r.fehler) { try { t.abort(); } catch (e) { /* bereits beendet */ } }
      }, function (e) {
        erg = { fehler: e && e.name === 'QuotaExceededError' ? 'speicher' : 'eio' };
        try { t.abort(); } catch (x) { /* bereits beendet */ }
      });
    });
  }
  function hex(bytes) { return Array.from(bytes, function (b) { return b.toString(16).padStart(2, '0'); }).join(''); }
  async function sha256(text) { return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))); }
  function gesperrtId(id) { return typeof PROFIL !== 'undefined' && !!PROFIL && (PROFIL.gesperrt || []).includes(id); }
  function objekt(art, qid, dossier) {
    if (art === 'pin' || art === 'zone') return ((art === 'pin' ? PROFIL.pins : PROFIL.zonen) || []).find(function (x) { return x && x.id === qid; }) || null;
    const d = STATE.dossiers && STATE.dossiers.entitaeten[dossier];
    return (d && (d.sichtungen || []).find(function (x) { return x && x.id === qid; })) || null;
  }
  function basis(art, qid, dossier) { return art === 'pin' ? ['pins', qid] : art === 'zone' ? ['zones', qid] : ['sightings', dossier, qid]; }
  /* Herkunft beim Anlegen: Objekt, Dossier und bei Sichtungen der eingebettete Ursprungspin, jeweils mit Bindung; fehlende Identität: null */
  function herkunft(art, qid, dossier) {
    const x = objekt(art, qid, dossier);
    if (!x) return null;
    const deps = art === 'sichtung' ? [{ art: 'sichtung', dossier: dossier, id: qid }, { art: 'dossier', id: dossier }] : [{ art: art, id: qid }];
    if (art !== 'sichtung' && x.dossier) deps.push({ art: 'dossier', id: x.dossier });
    if (art === 'sichtung' && typeof sichtungPin === 'function') { const p = sichtungPin(x, dossier); if (p) deps.push({ art: 'pin', id: p.id }); }
    const bindung = deps.map(INTEL.bindung);
    if (!bindung.every(function (b) { return b.da; }) || !bindung.every(INTEL.bindungGueltig)) return null;
    return { deps: deps, bindung: bindung };
  }
  /* Zustand: gesperrt (ursprüngliches oder heutiges Dossier gesperrt, auch bei fehlender oder beschädigter Herkunft), verwaist (nicht
     gesperrt, aber Objekt oder Identität nicht mehr dieselbe, damaliges Dossier fehlt), sonst zugaenglich. */
  function zustand(rec) {
    if (!rec || !Array.isArray(rec.bindung) || !rec.bindung.length || !Array.isArray(rec.deps) || !rec.deps.length) return 'gesperrt';
    const ds = new Set();
    rec.bindung.concat(rec.deps).forEach(function (b) {
      if (!b) return;
      if (b.art === 'dossier') ds.add(b.id);
      if (b.dossier) ds.add(b.dossier);
      if (b.art === 'pin' || b.art === 'zone') { const x = objekt(b.art, b.id); if (x && x.dossier) ds.add(x.dossier); }
    });
    if (Array.from(ds).some(gesperrtId) || rec.deps.some(INTEL.gesperrt)) return 'gesperrt';
    return rec.bindung.every(INTEL.bindungGueltig) ? 'zugaenglich' : 'verwaist';
  }
  function quelle(art, qid, dossier) { return [art, qid, dossier || ''].join('|'); }
  function name(erstellt) {
    const z = new Date(erstellt).toISOString().replace(/[-:]/g, '');   /* 20261125T101500.123Z */
    return z + '-' + hex(crypto.getRandomValues(new Uint8Array(3))) + '.txt';
  }
  function anzeige(r) { return { id: r.id, pfad: '/exports/' + r.pfad, name: r.name, art: r.art, qid: r.qid, dossier: r.dossier, erstellt: r.erstellt, bytes: r.bytes }; }
  /* Gemeinsamer Löschkern (GUI, rm, Sammelbereinigung): Zustand innerhalb der Löschtransaktion erneut; nur der erwartete Zustand wird gelöscht */
  async function entfernen(E, T, rec, erwartet) {
    if (!rec || zustand(rec) !== erwartet) return false;
    await anf(E.delete(rec.id)); await anf(T.delete(rec.id));
    return true;
  }
  async function liste() {
    const r = await tx('readonly', function (E) { return anf(E.getAll()).then(function (alle) { return { alle: alle }; }); });
    return r.fehler ? r : { alle: r.alle.filter(function (x) { return zustand(x) === 'zugaenglich'; }) };
  }
  return {
    zustand: zustand,
    /* Momentaufnahme anlegen (GUI). Duplikatprüfung vor der Grenzprüfung: ein unveränderter zugänglicher Export wird auch am Limit
       wiederverwendet; verborgene Versionen sieht die Prüfung nicht. Rechte unmittelbar vor dem Schreiben erneut geprüft. */
    /* Review 3 zu #140: Die Herkunft wird synchron mit dem Text erfasst (der Aufrufer rendert den Text im selben Takt unmittelbar davor) und
       danach nie durch eine spätere ersetzt. Bei der Duplikatprüfung und unmittelbar vor dem Schreiben muss die aktuelle Herkunft dieselbe
       sein (Objekt, Identität, Dossierzuordnung) und zugänglich bleiben; sonst Abbruch ohne Änderung. Nach dem Abschluss der Transaktion
       wird der gespeicherte Datensatz erneut geprüft: ist er inzwischen nicht mehr zugänglich, meldet anlegen 'nachher' (gespeichert, aber
       nicht bereitgestellt), nie einen Rückbau, der nicht stattgefunden hat. */
    anlegen: async function (art, qid, dossier, text) {
      const h0 = herkunft(art, qid, dossier);
      if (!h0 || h0.deps.some(INTEL.gesperrt)) return { fehler: 'herkunft' };
      const kennung = JSON.stringify([h0.deps, h0.bindung]);
      const unveraendert = function () { const h = herkunft(art, qid, dossier); return !!h && JSON.stringify([h.deps, h.bindung]) === kennung && !h.deps.some(INTEL.gesperrt); };
      const bytes = new TextEncoder().encode(text).length;
      if (!bytes) return { fehler: 'leer' };
      if (bytes > EXPORTE_GRENZE.datei) return { fehler: 'gross' };
      const sha = await sha256(text), erstellt = Date.now(), q = quelle(art, qid, dossier);
      let gespeichert = null;
      const r = await tx('readwrite', async function (E, T) {
        const alle = await anf(E.getAll());
        if (!unveraendert()) return { fehler: 'herkunft' };
        const gleich = alle.find(function (r) { return r.quelle === q && r.sha256 === sha && JSON.stringify([r.deps, r.bindung]) === kennung && zustand(r) === 'zugaenglich'; });
        if (gleich) { gespeichert = gleich; return { modus: 'unveraendert', rec: anzeige(gleich) }; }
        const summe = alle.reduce(function (a, r) { return a + (Number(r.bytes) || 0); }, 0);
        if (alle.length + 1 > EXPORTE_GRENZE.anzahl || summe + bytes > EXPORTE_GRENZE.gesamt) return { fehler: 'grenze' };
        const n = name(erstellt), pfad = basis(art, qid, dossier).concat(n).join('/');
        const id = hex(crypto.getRandomValues(new Uint8Array(8)));
        if (alle.some(function (r) { return r.pfad === pfad || r.id === id; })) return { fehler: 'kollision' };
        const rec = { id: id, pfad: pfad, name: n, quelle: q, art: art, qid: qid, dossier: art === 'sichtung' ? dossier : null, deps: h0.deps, bindung: h0.bindung,
          sprache: 'de', erstellt: erstellt, bytes: bytes, sha256: sha };
        if (!unveraendert()) return { fehler: 'herkunft' };   /* unmittelbar vor dem Schreiben */
        await anf(E.add(rec));   /* eindeutiger Pfadindex: atomare Kollisionserkennung */
        await anf(T.add({ id: id, text: text }));
        gespeichert = rec;
        return { modus: 'neu', rec: anzeige(rec) };
      });
      if (r && !r.fehler && gespeichert && zustand(gespeichert) !== 'zugaenglich') return { fehler: 'nachher', modus: r.modus };
      return r;
    },
    /* Lesen eines zugänglichen Exports über den relativen Pfad (ohne "exports"); Prüfsumme geprüft */
    lesen: async function (rel) {
      const pfad = rel.join('/');
      const r = await tx('readonly', async function (E, T) {
        const rec = await anf(E.index('pfad').get(pfad));
        if (!rec || zustand(rec) !== 'zugaenglich') return { fehler: 'ENOENT' };
        const t = await anf(T.get(rec.id));
        return { rec: rec, text: t ? t.text : null };
      });
      if (r.fehler === 'eio' || r.fehler === 'speicher') return { fehler: 'EIO' };
      if (r.fehler) return r;
      if (typeof r.text !== 'string' || await sha256(r.text) !== r.rec.sha256) return { fehler: 'EIO' };
      if (zustand(r.rec) !== 'zugaenglich') return { fehler: 'ENOENT' };   /* nach dem asynchronen Lesen erneut */
      return r;
    },
    liste: liste,
    /* Gemeinsame validierte Löschaktion (GUI und rm): Zustand innerhalb der Löschtransaktion erneut; nur zugängliche Exporte */
    loeschen: function (ids) {
      return tx('readwrite', async function (E, T) {
        let n = 0;
        for (const id of ids) if (await entfernen(E, T, await anf(E.get(id)), 'zugaenglich')) n++;
        return { geloescht: n };
      });
    },
    loeschenPfad: async function (rel) {
      const pfad = rel.join('/');
      return tx('readwrite', async function (E, T) {
        const rec = await anf(E.index('pfad').get(pfad));
        if (!await entfernen(E, T, rec, 'zugaenglich')) return { fehler: 'ENOENT' };
        return { geloescht: 1, rec: anzeige(rec) };
      });
    },
    /* Sammelbereinigung (D1): nur tatsächlich verwaiste, nie gesperrte Exporte; Ergebnis nur die Anzahl */
    verwaiste: function () { return tx('readonly', function (E) { return anf(E.getAll()).then(function (a) { return { anzahl: a.filter(function (r) { return zustand(r) === 'verwaist'; }).length }; }); }); },
    bereinigen: function () {
      return tx('readwrite', async function (E, T) {
        let n = 0;
        for (const rec of await anf(E.getAll())) if (await entfernen(E, T, rec, 'verwaist')) n++;
        return { geloescht: n };
      });
    },
    /* Schutzabhängigkeit eines Exports für Scrollback und Tab (INTEL.gesperrt, Art 'herkunft') */
    herkunftDep: function (rec) { return { art: 'herkunft', id: rec.id, deps: rec.deps, bindung: rec.bindung }; },
    /* zugängliche Exporte eines Objekts (Knopf "Exporte löschen") */
    vonObjekt: async function (art, qid, dossier) {
      const l = await liste();
      if (l.fehler) return l;
      const q = quelle(art, qid, dossier);
      return { exporte: l.alle.filter(function (r) { return r.quelle === q; }).map(anzeige) };
    },
    /* Name beim Empfänger (/sendfile): Kennungen und Zeitname, ohne Personennamen */
    versandName: function (rec) { return (rec.art === 'sichtung' ? rec.dossier + '-' : '') + rec.qid + '-' + rec.name; }
  };
})();

/* Anbieter /exports (Einhängepunkt in profil-modul.js): Verzeichnisse sind virtuell und bestehen nur über zugänglichen Exporten. */
const EXPORTE_ANBIETER = {
  name: 'exporte', schreibFehler: 'EROFS',
  /* opt.cache (Paket 5, eine Such- oder Pipelineoperation): Bestand einmal je Operation lesen. Unbedenklich, weil jede ausgegebene Zeile ihre
     eigene Herkunft trägt und unmittelbar vor Ausgabe und Übernahme gegen den aktuellen Stand geprüft wird. */
  baum: async function (opt) {
    if (opt && opt.cache && opt.cache.exporte) return opt.cache.exporte;
    const l = await EXPORTE.liste();
    if (!l.fehler && opt && opt.cache) opt.cache.exporte = l.alle;
    return l.fehler ? null : l.alle;
  },
  /* Schutzabhängigkeiten einer Ausgabezeile (Review 3 zu #140): eine Datei trägt ihre vollständige Herkunft (ursprüngliche Abhängigkeiten
     und Bindung); ein virtuelles Verzeichnis besteht nur über zugänglichen Exporten und trägt deshalb die Herkunft aller Nachfahren. Wird
     einer davon unzugänglich, verschwindet die Zeile konservativ aus dem Scrollback und aus Tab-Vorschlägen. /exports selbst verrät nichts. */
  deps: function (rel, recs) {
    if (!rel.length) return [];
    return (recs || []).map(EXPORTE.herkunftDep);
  },
  knoten: async function (rel, opt) {
    const alle = await EXPORTE_ANBIETER.baum(opt);
    if (!alle) return rel.length ? { fehler: 'EIO' } : { typ: 'dir', kinder: [], recs: [] };
    const p = rel.join('/'), datei = alle.find(function (r) { return r.pfad === p; });
    if (datei) return { typ: 'file', rec: datei, recs: [datei] };
    const unter = alle.filter(function (r) { return !p || r.pfad.startsWith(p + '/'); });
    if (rel.length && !unter.length) return { fehler: 'ENOENT' };
    const kinder = new Map();
    unter.forEach(function (r) {
      const rest = r.pfad.split('/').slice(rel.length), n = rest[0], dir = rest.length > 1;
      const alt = kinder.get(n) || { name: n, dir: dir, rec: null, mtime: 0, recs: [] };
      alt.recs.push(r);
      if (!dir) alt.rec = r;
      alt.mtime = Math.max(alt.mtime, r.erstellt);
      kinder.set(n, alt);
    });
    return { typ: 'dir', kinder: Array.from(kinder.values()), recs: unter, mtime: unter.reduce(function (m, r) { return Math.max(m, r.erstellt); }, 0) };
  },
  eintrag: function (rel, k) {
    const dir = !k.rec;
    return { name: rel[rel.length - 1] || 'exports', dir: dir, bytes: dir ? 4096 : k.rec.bytes, mtime: Math.floor((k.mtime || (k.rec && k.rec.erstellt) || Date.now()) / 1000), modus: dir ? 0o555 : 0o444, uid: 0,
      deps: EXPORTE_ANBIETER.deps(rel, k.recs) };
  },
  stat: async function (seg, opt) {
    const rel = seg.slice(1), k = await EXPORTE_ANBIETER.knoten(rel, opt);
    if (k.fehler) return k;
    const e = EXPORTE_ANBIETER.eintrag(rel, k);
    return { adapter: 'exporte', typ: k.typ, eintrag: e, deps: e.deps };
  },
  readdir: async function (seg, opt) {
    const rel = seg.slice(1), k = await EXPORTE_ANBIETER.knoten(rel, opt);
    if (k.fehler) return k;
    if (k.typ !== 'dir') return { fehler: 'ENOTDIR' };
    /* Das Verzeichnis selbst ist über den getippten Pfad benannt (vereinbarte Ausnahme); jede Kindzeile trägt ihre eigene Herkunft, damit andere
       sichtbare Exporte bei einer Sperre stehen bleiben */
    return { eintraege: k.kinder.map(function (c) { return EXPORTE_ANBIETER.eintrag(rel.concat(c.name), c); }), deps: [] };
  },
  readFile: async function (seg) {
    const rel = seg.slice(1);
    if (!rel.length) return { fehler: 'EISDIR' };
    const r = await EXPORTE.lesen(rel);
    if (r.fehler === 'ENOENT') { const k = await EXPORTE_ANBIETER.knoten(rel); return { fehler: k.typ === 'dir' ? 'EISDIR' : 'ENOENT' }; }
    if (r.fehler) return r;
    return { text: r.text, deps: [EXPORTE.herkunftDep(r.rec)], rec: r.rec };
  },
  /* rm einer einzelnen Exportdatei über die gemeinsame Löschaktion; Verzeichnisse und -r: Read-only file system (unabhängig vom Bestand) */
  entfernen: async function (seg, opt) {
    const rel = seg.slice(1);
    if (!rel.length || (opt && (opt.rekursiv || opt.nurVerzeichnis))) return { fehler: 'EROFS' };
    const k = await EXPORTE_ANBIETER.knoten(rel);
    if (k.fehler) return k;
    if (k.typ === 'dir') return { fehler: 'EROFS' };
    const r = await EXPORTE.loeschenPfad(rel);
    if (r.fehler === 'eio' || r.fehler === 'speicher') return { fehler: 'EIO' };
    if (!r.fehler && typeof exportProtokoll === 'function') exportProtokoll('Export gelöscht', r.rec.qid + (r.rec.dossier ? ', ' + r.rec.dossier : '') + ', 1');
    return r.fehler ? r : { ok: true };
  }
};
/* Protokolleintrag (Art und Kennung, kein Inhalt). Das Protokoll liegt im Zustand und ist mit der Exportdatenbank nicht gemeinsam atomar:
   Ergebnis false, wenn der Eintrag nicht gespeichert werden konnte; ein bereits gespeicherter Export gilt trotzdem (Review zu #140). */
function exportProtokoll(aktion, detail) {
  try { dispatch({ type: 'EXPORT_PROTOKOLL', aktion: aktion, detail: detail }); } catch (e) { return false; }
  return !(typeof Store !== 'undefined' && Store && (Store.sperrgrund || (typeof Store.saveGeprueft === 'function' && Store.saveGeprueft(STATE) !== 'ok')));
}
