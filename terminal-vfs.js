/* Paket 1 (Phase 6b): persistentes virtuelles Dateisystem des Terminals.
   Architektur: docs/terminal-dateisystem-architektur.md (Abschnitte 3, 4, 9a, 11). Klassisches Skript, wird vor profil-modul.js geladen.
   Zwei Verzeichnisbäume liegen in der IndexedDB "fieldterminal.vfs": /home/raizo (dauerhaft) und /tmp (flüchtig). Alle übrigen Pfade
   (Wurzel, /etc, /var, Archivbrücke) gehören anderen Anbietern und sind hier nie beschreibbar.
   Jede ändernde Operation läuft in genau einer Transaktion über Knoten und Zähler: Fehler brechen sie ab, es entsteht nie ein Teilzustand.
   Fehler sind Objekte { fehler: 'ENOENT' | 'EACCES' | ... }, keine Ausnahmen. Namen sind streng bytegleich (keine Normalisierung,
   Groß-/Kleinschreibung unterscheidet), wie unter Linux. Dateiinhalt ist Text (UTF-8).
   Nicht Teil dieses Moduls: Dateimodi werden gespeichert, aber nicht ausgewertet; es gibt kein root im VFS (Abschnitt 9a). */
const TERMINAL_HEIM = ['home', 'raizo'];
/* Vorläufige Grenzen (nicht gemessen, siehe Abschnitt 4 und 10 des Architekturdokuments): Größe einer Datei, Anzahl der Knoten und
   Gesamtgröße der Inhalte (Heimverzeichnis und /tmp zusammen). Länge eines Namens in Bytes wie unter Linux (NAME_MAX). */
const TERMINAL_VFS_GRENZE = Object.freeze({ datei: 1048576, knoten: 5000, gesamt: 16777216, name: 255, tiefe: 40 });
const TERMINAL_VFS_TAKT = 15000, TERMINAL_VFS_VERALTET = 45000;
const TERMINAL_VFS = (function () {
  const DBNAME = 'fieldterminal.vfs', WURZEL = 1, HOME = 2, RAIZO = 3, TMP = 4;
  let dbp = null, beat = null, sperre = null;
  const meine = 'S' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  const kodierer = new TextEncoder();
  function anf(r) { return new Promise(function (ok, fail) { r.onsuccess = function () { ok(r.result); }; r.onerror = function () { fail(r.error); }; }); }
  function bytes(text) { return kodierer.encode(text).length; }
  function oeffnen() {
    if (dbp) return dbp;
    dbp = new Promise(function (ok, fail) {
      if (typeof indexedDB === 'undefined') { fail(new Error('indexedDB')); return; }
      const r = indexedDB.open(DBNAME, 1);
      r.onupgradeneeded = function () {
        const db = r.result, k = db.createObjectStore('knoten', { keyPath: 'id', autoIncrement: true });
        k.createIndex('ename', ['eltern', 'name'], { unique: true });
        k.createIndex('eltern', 'eltern');
        const m = db.createObjectStore('meta', { keyPath: 'key' }), jetzt = Date.now();
        const dir = function (id, eltern, name, uid, modus, fl) { return { id: id, eltern: eltern, name: name, typ: 'dir', modus: modus, uid: uid, gid: uid, erstellt: jetzt, geaendert: jetzt, groesse: 0, inhalt: '', fluechtig: fl, version: 1 }; };
        k.put(dir(WURZEL, 0, '', 0, 0o755, false)); k.put(dir(HOME, WURZEL, 'home', 0, 0o755, false));
        k.put(dir(RAIZO, HOME, 'raizo', 1000, 0o750, false)); k.put(dir(TMP, WURZEL, 'tmp', 0, 0o1777, true));
        m.put({ key: 'schema', wert: 1 }); m.put({ key: 'zaehler', bytes: 0, knoten: 0 }); m.put({ key: 'sitzungen', wert: {} });
      };
      r.onsuccess = function () { r.result.onversionchange = function () { r.result.close(); dbp = null; }; ok(r.result); };
      r.onerror = function () { fail(r.error); };
      r.onblocked = function () { fail(new Error('blockiert')); };
    }).catch(function (e) { dbp = null; throw e; });
    return dbp;
  }
  /* Eine Transaktion; fn(knoten, meta) liefert ein Ergebnis. Ein Ergebnis mit "fehler" bricht die Transaktion ab (nichts bleibt geändert). */
  function tx(modus, fn) {
    return oeffnen().then(function (db) {
      return new Promise(function (ok) {
        const t = db.transaction(['knoten', 'meta'], modus);
        let erg;
        t.oncomplete = function () { ok(erg); };
        t.onabort = function () { ok(erg && erg.fehler ? erg : { fehler: 'EIO' }); };
        Promise.resolve().then(function () { return fn(t.objectStore('knoten'), t.objectStore('meta')); }).then(function (r) {
          erg = r;
          if (r && r.fehler) { try { t.abort(); } catch (e) { /* bereits beendet */ } }
        }, function () { erg = { fehler: 'EIO' }; try { t.abort(); } catch (e) { /* bereits beendet */ } });
      });
    }, function () { return { fehler: 'EIO' }; });
  }
  async function lauf(k, seg) {
    let n = await anf(k.get(WURZEL));
    for (let i = 0; i < seg.length; i++) {
      if (n.typ !== 'dir') return { fehler: 'ENOTDIR' };
      const c = await anf(k.index('ename').get([n.id, seg[i]]));
      if (!c) return { fehler: 'ENOENT', eltern: n, rest: seg.length - i - 1 };
      n = c;
    }
    return { n: n };
  }
  function zugehoerig(seg) { return seg.length > 0 && (seg[0] === 'home' || seg[0] === 'tmp'); }
  /* Rechtestufe: nur unterhalb von /home/raizo und /tmp dürfen Einträge entstehen, sich ändern oder verschwinden. Wurzel, /home, /home/raizo
     selbst und /tmp selbst sind Einhängepunkte (fest). */
  function schreibrecht(seg) { return seg[0] === 'tmp' ? seg.length >= 2 : seg[0] === 'home' && seg[1] === 'raizo' && seg.length >= 3; }
  function nameFehler(name) {
    if (!name || name === '.' || name === '..' || name.includes('/') || name.includes('\u0000')) return 'EINVAL';
    return bytes(name) > TERMINAL_VFS_GRENZE.name ? 'ENAMETOOLONG' : null;
  }
  function pfadFehler(seg) {
    if (seg.length > TERMINAL_VFS_GRENZE.tiefe) return 'ENAMETOOLONG';
    for (const s of seg) { const f = nameFehler(s); if (f) return f; }
    return null;
  }
  async function zaehlerLesen(m) { return (await anf(m.get('zaehler'))) || { key: 'zaehler', bytes: 0, knoten: 0 }; }
  function neuerKnoten(eltern, name, typ, fl, inhalt) {
    const jetzt = Date.now();
    return { eltern: eltern, name: name, typ: typ, modus: typ === 'dir' ? 0o755 : 0o644, uid: 1000, gid: 1000, erstellt: jetzt, geaendert: jetzt,
      groesse: inhalt ? bytes(inhalt) : 0, inhalt: inhalt || '', fluechtig: fl, version: 1 };
  }
  async function unterbaum(k, id) {
    const aus = [];
    const kinder = await anf(k.index('eltern').getAll(IDBKeyRange.only(id)));
    for (const c of kinder) { aus.push(c); if (c.typ === 'dir') aus.push.apply(aus, await unterbaum(k, c.id)); }
    return aus;
  }
  /* Elternknoten eines Zielpfads: Pfadfehler vor Rechten (wie Linux: ENOENT/ENOTDIR vor EACCES) */
  async function elternVon(k, seg) {
    const p = await lauf(k, seg.slice(0, -1));
    if (p.fehler) return { fehler: p.fehler };
    return p.n.typ === 'dir' ? { n: p.n } : { fehler: 'ENOTDIR' };
  }
  function eintragAnzeige(n) { return { name: n.name, dir: n.typ === 'dir', bytes: n.typ === 'dir' ? 4096 : n.groesse, mtime: Math.floor(n.geaendert / 1000) }; }
  async function pruefenKern(k, m) {
    /* Selbstprüfung (Architektur 4): verwaiste Knoten nach /home/raizo/lost+found, Zähler aus den Daten neu berechnen */
    const alle = await anf(k.getAll()), karte = new Map(alle.map(function (n) { return [n.id, n]; }));
    let repariert = 0, ziel = null;
    for (const n of alle) {
      if (n.id <= TMP) continue;
      const e = karte.get(n.eltern);
      if (e && e.typ === 'dir') continue;
      if (!ziel) {
        ziel = await anf(k.index('ename').get([RAIZO, 'lost+found']));
        if (!ziel) { const nk = neuerKnoten(RAIZO, 'lost+found', 'dir', false); const id = await anf(k.add(nk)); ziel = Object.assign({ id: id }, nk); }
      }
      n.eltern = ziel.id; n.name = n.name + '.' + n.id; n.fluechtig = false;
      k.put(n); repariert++;
    }
    const z = { key: 'zaehler', bytes: 0, knoten: 0 };
    for (const n of alle) if (n.id > TMP) { z.knoten++; if (n.typ === 'file') z.bytes += n.groesse; }
    const alt = await zaehlerLesen(m);
    if (alt.bytes !== z.bytes || alt.knoten !== z.knoten) m.put(z);
    return { repariert: repariert };
  }
  async function tmpLeerenKern(k, m) {
    const alle = await unterbaum(k, TMP), z = await zaehlerLesen(m);
    for (const n of alle) { k.delete(n.id); z.knoten--; if (n.typ === 'file') z.bytes -= n.groesse; }
    m.put(z);
  }
  async function aktiveSitzungen(m, aufraeumen) {
    const eintrag = (await anf(m.get('sitzungen'))) || { key: 'sitzungen', wert: {} }, jetzt = Date.now();
    for (const id of Object.keys(eintrag.wert)) if (jetzt - eintrag.wert[id] > TERMINAL_VFS_VERALTET) { if (aufraeumen) delete eintrag.wert[id]; }
    return eintrag;
  }
  function lebend(eintrag) { const jetzt = Date.now(); return Object.keys(eintrag.wert).filter(function (id) { return jetzt - eintrag.wert[id] <= TERMINAL_VFS_VERALTET; }); }
  /* Lebende Fenster: Web Locks (jedes Fenster hält eine geteilte Sperre; sie endet sofort mit Fenster oder Browser, auch bei unsauberem Ende).
     Ohne Web Locks gilt der Herzschlag in "meta" (verfällt nach TERMINAL_VFS_VERALTET). Liefert null, wenn die Sperren nicht verfügbar sind. */
  function sperreHalten() {
    if (typeof navigator === 'undefined' || !navigator.locks || !navigator.locks.request) return Promise.resolve(false);
    return new Promise(function (ok) {
      try {
        sperre = { ende: null };
        sperre.fertig = navigator.locks.request('ft-vfs-' + meine, { mode: 'shared' }, function () {
          ok(true);
          return new Promise(function (frei) { sperre.ende = frei; });
        }).catch(function () { ok(false); });
      } catch (e) { sperre = null; ok(false); }
    });
  }
  async function sperreLoesen() {
    if (!sperre) return;
    const s = sperre; sperre = null;
    if (s.ende) s.ende();
    await s.fertig;
  }
  async function fremdeFenster() {
    if (!sperre && typeof navigator !== 'undefined') return null;
    try { const q = await navigator.locks.query(); return q.held.filter(function (l) { return l.name.startsWith('ft-vfs-') && l.name !== 'ft-vfs-' + meine; }).length; } catch (e) { return null; }
  }
  async function fremdeFenster2() {
    try { const q = await navigator.locks.query(); return q.held.filter(function (l) { return l.name.startsWith('ft-vfs-') && l.name !== 'ft-vfs-' + meine; }).length; } catch (e) { return null; }
  }
  return {
    GRENZE: TERMINAL_VFS_GRENZE,
    zugehoerig: zugehoerig,
    schreibrecht: schreibrecht,
    pfadFehler: pfadFehler,
    /* Sitzung (D1, Review 9a.2): Beim Start wird /tmp geleert, wenn kein anderes Fenster lebt (auch nach unsauberem Ende); beim Ende
       leert die letzte Sitzung /tmp. Ein Herzschlag in "meta" kennzeichnet lebende Fenster; Einträge ohne Herzschlag verfallen. */
    sitzungStart: async function () {
      /* erst die eigene Sperre, dann zählen: bei gleichzeitigem Start sieht jedes Fenster das andere und /tmp bleibt erhalten (sichere Richtung) */
      if (!sperre) await sperreHalten();
      const sperrenFremd = await fremdeFenster();
      return tx('readwrite', async function (k, m) {
        const e = await aktiveSitzungen(m, true), fremde = sperrenFremd !== null ? new Array(sperrenFremd) : lebend(e).filter(function (id) { return id !== meine; });
        if (!fremde.length) await tmpLeerenKern(k, m);
        e.wert[meine] = Date.now(); m.put(e);
        const p = await pruefenKern(k, m);
        return { ok: true, repariert: p.repariert, fremde: fremde.length };
      }).then(function (r) {
        if (!r.fehler && !beat) {
          beat = setInterval(function () {
            void tx('readwrite', async function (k, m) { const e = await aktiveSitzungen(m, true); e.wert[meine] = Date.now(); m.put(e); return { ok: true }; });
          }, TERMINAL_VFS_TAKT);
          if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) { try { void navigator.storage.persist(); } catch (e) { /* best effort */ } }
        }
        return r;
      });
    },
    sitzungEnde: async function () {
      if (beat) { clearInterval(beat); beat = null; }
      const hatSperre = !!sperre;
      await sperreLoesen();
      const sperrenFremd = hatSperre ? await fremdeFenster2() : null;
      return tx('readwrite', async function (k, m) {
        const e = await aktiveSitzungen(m, true);
        delete e.wert[meine]; m.put(e);
        if (sperrenFremd !== null ? sperrenFremd === 0 : !lebend(e).length) await tmpLeerenKern(k, m);
        return { ok: true };
      });
    },
    stat: function (seg) {
      return tx('readonly', async function (k) {
        const r = await lauf(k, seg);
        if (r.fehler) return { fehler: r.fehler };
        const e = eintragAnzeige(r.n);
        return { adapter: 'vfs', typ: r.n.typ, bytes: e.bytes, mtime: e.mtime, eintrag: e };
      });
    },
    readdir: function (seg) {
      return tx('readonly', async function (k) {
        const r = await lauf(k, seg);
        if (r.fehler) return { fehler: r.fehler };
        if (r.n.typ !== 'dir') return { fehler: 'ENOTDIR' };
        const kinder = await anf(k.index('eltern').getAll(IDBKeyRange.only(r.n.id)));
        return { eintraege: kinder.map(eintragAnzeige) };
      });
    },
    readFile: function (seg) {
      return tx('readonly', async function (k) {
        const r = await lauf(k, seg);
        if (r.fehler) return { fehler: r.fehler };
        return r.n.typ === 'dir' ? { fehler: 'EISDIR' } : { text: r.n.inhalt };
      });
    },
    /* Datei anlegen oder ersetzen; opt.anhaengen hängt an; opt.nurAnlegen (touch): leere Datei anlegen oder Änderungszeit setzen */
    schreiben: function (seg, text, opt) {
      opt = opt || {};
      const pf = pfadFehler(seg);
      if (pf) return Promise.resolve({ fehler: pf });
      return tx('readwrite', async function (k, m) {
        const p = await elternVon(k, seg);
        if (p.fehler) return p;
        const vorhanden = await anf(k.index('ename').get([p.n.id, seg[seg.length - 1]]));
        if (vorhanden && vorhanden.typ === 'dir') {
          if (!opt.nurAnlegen) return { fehler: 'EISDIR' };
          vorhanden.geaendert = Date.now(); k.put(vorhanden);
          return { ok: true };
        }
        if (!schreibrecht(seg)) return { fehler: 'EACCES' };
        const z = await zaehlerLesen(m);
        if (opt.nurAnlegen && vorhanden) { vorhanden.geaendert = Date.now(); k.put(vorhanden); return { ok: true }; }
        const neu = opt.nurAnlegen ? '' : (opt.anhaengen && vorhanden ? vorhanden.inhalt : '') + String(text);
        const b = bytes(neu), alt = vorhanden ? vorhanden.groesse : 0;
        if (b > TERMINAL_VFS_GRENZE.datei) return { fehler: 'EFBIG' };
        if (z.bytes - alt + b > TERMINAL_VFS_GRENZE.gesamt || (!vorhanden && z.knoten + 1 > TERMINAL_VFS_GRENZE.knoten)) return { fehler: 'ENOSPC' };
        if (vorhanden) { vorhanden.inhalt = neu; vorhanden.groesse = b; vorhanden.geaendert = Date.now(); vorhanden.version++; k.put(vorhanden); }
        else { const nk = neuerKnoten(p.n.id, seg[seg.length - 1], 'file', seg[0] === 'tmp', neu); await anf(k.add(nk)); z.knoten++; }
        z.bytes += b - alt; m.put(z);
        return { ok: true, bytes: b };
      });
    },
    /* mkdir; opt.eltern entspricht -p (fehlende Ebenen anlegen, Vorhandenes ist kein Fehler) */
    mkdir: function (seg, opt) {
      opt = opt || {};
      const pf = pfadFehler(seg);
      if (pf) return Promise.resolve({ fehler: pf });
      return tx('readwrite', async function (k, m) {
        const z = await zaehlerLesen(m);
        let n = await anf(k.get(WURZEL));
        for (let i = 0; i < seg.length; i++) {
          if (n.typ !== 'dir') return { fehler: 'ENOTDIR' };
          const c = await anf(k.index('ename').get([n.id, seg[i]])), letzter = i === seg.length - 1;
          if (c) {
            if (letzter && (!opt.eltern || c.typ !== 'dir')) return { fehler: 'EEXIST' };
            n = c;
            continue;
          }
          if (!letzter && !opt.eltern) return { fehler: 'ENOENT' };
          if (!schreibrecht(seg.slice(0, i + 1))) return { fehler: 'EACCES' };
          if (z.knoten + 1 > TERMINAL_VFS_GRENZE.knoten) return { fehler: 'ENOSPC' };
          const nk = neuerKnoten(n.id, seg[i], 'dir', seg[0] === 'tmp');
          const id = await anf(k.add(nk));
          z.knoten++; n = Object.assign({ id: id }, nk);
        }
        m.put(z);
        return { ok: true };
      });
    },
    /* opt.rekursiv: rm -r; opt.nurDatei: unlink-Semantik (rm ohne -r); opt.nurVerzeichnis: rmdir */
    entfernen: function (seg, opt) {
      opt = opt || {};
      return tx('readwrite', async function (k, m) {
        const r = await lauf(k, seg);
        if (r.fehler) return { fehler: r.fehler };
        if (!seg.length || !schreibrecht(seg)) return { fehler: seg.length > 1 && r.n.typ === 'dir' && opt.nurVerzeichnis ? 'EBUSY' : 'EACCES' };
        const n = r.n, z = await zaehlerLesen(m);
        if (n.typ === 'dir' && opt.nurDatei) return { fehler: 'EISDIR' };
        if (n.typ !== 'dir' && opt.nurVerzeichnis) return { fehler: 'ENOTDIR' };
        let weg = [n];
        if (n.typ === 'dir') {
          const unter = await unterbaum(k, n.id);
          if (unter.length && !opt.rekursiv) return { fehler: 'ENOTEMPTY' };
          weg = weg.concat(unter);
        }
        for (const x of weg) { k.delete(x.id); z.knoten--; if (x.typ === 'file') z.bytes -= x.groesse; }
        m.put(z);
        return { ok: true, anzahl: weg.length };
      });
    },
    /* rename(2): Ziel ist der endgültige Pfad (der Befehl mv hängt bei vorhandenem Zielverzeichnis den Namen selbst an) */
    umbenennen: function (von, nach) {
      const pf = pfadFehler(nach);
      if (pf) return Promise.resolve({ fehler: pf });
      return tx('readwrite', async function (k, m) {
        const s = await lauf(k, von);
        if (s.fehler) return { fehler: s.fehler };
        const p = await elternVon(k, nach);
        if (p.fehler) return p;
        if (!von.length || !schreibrecht(von) || !schreibrecht(nach)) return { fehler: 'EACCES' };
        const ziel = await anf(k.index('ename').get([p.n.id, nach[nach.length - 1]])), z = await zaehlerLesen(m);
        if (ziel && ziel.id === s.n.id) return { ok: true };
        for (let a = p.n; a && a.id !== WURZEL; a = await anf(k.get(a.eltern))) if (a.id === s.n.id) return { fehler: 'EINVAL' };
        if (ziel) {
          if (s.n.typ === 'dir' && ziel.typ !== 'dir') return { fehler: 'ENOTDIR' };
          if (s.n.typ !== 'dir' && ziel.typ === 'dir') return { fehler: 'EISDIR' };
          if (ziel.typ === 'dir' && (await anf(k.index('eltern').count(IDBKeyRange.only(ziel.id))))) return { fehler: 'ENOTEMPTY' };
          k.delete(ziel.id); z.knoten--; if (ziel.typ === 'file') z.bytes -= ziel.groesse;
        }
        const fl = nach[0] === 'tmp';
        s.n.eltern = p.n.id; s.n.name = nach[nach.length - 1]; s.n.geaendert = Date.now();
        if (s.n.fluechtig !== fl) {
          s.n.fluechtig = fl;
          for (const x of await unterbaum(k, s.n.id)) { x.fluechtig = fl; k.put(x); }
        }
        k.put(s.n); m.put(z);
        return { ok: true };
      });
    },
    /* cp innerhalb des VFS; Ziel ist der endgültige Pfad (der Befehl hängt bei vorhandenem Zielverzeichnis den Namen selbst an) */
    kopieren: function (von, nach, opt) {
      opt = opt || {};
      const pf = pfadFehler(nach);
      if (pf) return Promise.resolve({ fehler: pf });
      return tx('readwrite', async function (k, m) {
        const s = await lauf(k, von);
        if (s.fehler) return { fehler: s.fehler };
        if (s.n.typ === 'dir' && !opt.rekursiv) return { fehler: 'EISDIR' };
        const p = await elternVon(k, nach);
        if (p.fehler) return p;
        if (!schreibrecht(nach)) return { fehler: 'EACCES' };
        const ziel = await anf(k.index('ename').get([p.n.id, nach[nach.length - 1]])), z = await zaehlerLesen(m);
        for (let a = p.n; a && a.id !== WURZEL; a = await anf(k.get(a.eltern))) if (a.id === s.n.id) return { fehler: 'EINVAL' };
        if (ziel && ziel.typ === 'dir') return { fehler: 'EISDIR' };
        const fl = nach[0] === 'tmp';
        const kopiere = async function (q, elternId, name) {
          const nk = Object.assign({}, q, { eltern: elternId, name: name, fluechtig: fl, erstellt: Date.now(), geaendert: Date.now(), version: 1 });
          delete nk.id;
          if (q.typ === 'file') {
            if (z.bytes + q.groesse > TERMINAL_VFS_GRENZE.gesamt) return { fehler: 'ENOSPC' };
            z.bytes += q.groesse;
          }
          if (z.knoten + 1 > TERMINAL_VFS_GRENZE.knoten) return { fehler: 'ENOSPC' };
          z.knoten++;
          const id = await anf(k.add(nk));
          if (q.typ === 'dir') {
            for (const c of await anf(k.index('eltern').getAll(IDBKeyRange.only(q.id)))) { const f = await kopiere(c, id, c.name); if (f) return f; }
          }
          return null;
        };
        if (ziel) {
          if (s.n.typ === 'dir') return { fehler: 'ENOTDIR' };
          if (ziel.id === s.n.id) return { fehler: 'ESAME' };
          k.delete(ziel.id); z.knoten--; z.bytes -= ziel.groesse;
        }
        const f = await kopiere(s.n, p.n.id, nach[nach.length - 1]);
        if (f) return f;
        m.put(z);
        return { ok: true };
      });
    },
    zaehler: function () { return tx('readonly', async function (k, m) { const z = await zaehlerLesen(m); return { bytes: z.bytes, knoten: z.knoten }; }); },
    /* Sicherung (Abschnitt 4): Inhalt von /home/raizo, ohne /tmp; Pfade relativ, Eltern vor Kindern */
    exportieren: function () {
      return tx('readonly', async function (k) {
        const eintraege = [], rek = async function (id, vor) {
          const kinder = (await anf(k.index('eltern').getAll(IDBKeyRange.only(id)))).sort(function (a, b) { return a.name < b.name ? -1 : a.name > b.name ? 1 : 0; });
          for (const c of kinder) {
            const pfad = vor ? vor + '/' + c.name : c.name;
            eintraege.push(c.typ === 'dir' ? { pfad: pfad, typ: 'dir', modus: c.modus, erstellt: c.erstellt, geaendert: c.geaendert }
              : { pfad: pfad, typ: 'file', modus: c.modus, erstellt: c.erstellt, geaendert: c.geaendert, inhalt: c.inhalt });
            if (c.typ === 'dir') await rek(c.id, pfad);
          }
        };
        await rek(RAIZO, '');
        return { eintraege: eintraege };
      });
    },
    /* Wiederherstellung: ersetzt den Inhalt von /home/raizo vollständig und atomar; ungültige Eingaben ändern nichts */
    importieren: function (eintraege) {
      return tx('readwrite', async function (k, m) {
        const vorhanden = new Map([['', RAIZO]]), z = { key: 'zaehler', bytes: 0, knoten: 0 };
        const alte = await unterbaum(k, TMP), tmpKnoten = alte.length, tmpBytes = alte.reduce(function (s, x) { return s + (x.typ === 'file' ? x.groesse : 0); }, 0);
        for (const x of await unterbaum(k, RAIZO)) k.delete(x.id);
        z.knoten = tmpKnoten; z.bytes = tmpBytes;
        for (const e of eintraege) {
          const teile = e.pfad.split('/'), name = teile[teile.length - 1], elternPfad = teile.slice(0, -1).join('/');
          const eid = vorhanden.get(elternPfad);
          if (eid === undefined || vorhanden.has(e.pfad)) return { fehler: 'EINVAL' };
          const nk = neuerKnoten(eid, name, e.typ, false, e.typ === 'file' ? e.inhalt : '');
          nk.modus = e.modus; nk.erstellt = e.erstellt; nk.geaendert = e.geaendert;
          z.knoten++; z.bytes += nk.groesse;
          if (z.knoten > TERMINAL_VFS_GRENZE.knoten || z.bytes > TERMINAL_VFS_GRENZE.gesamt || nk.groesse > TERMINAL_VFS_GRENZE.datei) return { fehler: 'ENOSPC' };
          vorhanden.set(e.pfad, await anf(k.add(nk)));
        }
        m.put(z);
        return { ok: true, anzahl: eintraege.length };
      });
    },
    /* Fehlerbild für die Befehle: Text wie die C-Bibliothek (strerror) */
    fehlerText: function (f) {
      return { ENOENT: 'No such file or directory', ENOTDIR: 'Not a directory', EISDIR: 'Is a directory', EACCES: 'Permission denied', EEXIST: 'File exists',
        ENOTEMPTY: 'Directory not empty', EINVAL: 'Invalid argument', ENOSPC: 'No space left on device', EFBIG: 'File too large', EXDEV: 'Invalid cross-device link',
        ENAMETOOLONG: 'File name too long', EBUSY: 'Device or resource busy', EIO: 'Input/output error', EROFS: 'Read-only file system', ESAME: 'same file' }[f] || String(f);
    }
  };
})();
