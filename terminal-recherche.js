/* Paket 5: Recherchewerkzeuge und begrenzte Pipelines (docs/terminal-recherchewerkzeuge-konzept.md).
   Klassisches Skript nach terminal-exporte.js und vor profil-modul.js; Funktionen der Shell (TERMINAL_FS, terminalAusgabe, terminalBefehlLs,
   terminalLeser, INTEL, ...) werden erst zur Laufzeit gelesen.
   Modell: eine Pipeline ist eine Folge gepufferter Stufen im Speicher, kein Prozessmodell. Jede Stufe erhält einen Strom aus Zeilen mit ihren
   Schutzabhängigkeiten ({ t, d }) und liefert einen neuen. Die Herkunft der gesamten Operation (durchlaufene Anbieter, Archivnamen) entscheidet
   über eine abschließende Umleitung (E6); die Abhängigkeiten je Zeile über Anzeige, Scrollback und spätere Sperre. Zusammengefasste Ergebnisse
   (Anzahl, Hash, sort -u, uniq) tragen die Vereinigung ihrer Eingaben, bei Anzahl und Hash zusätzlich alles in der Operation Gelesene.
   Suchmuster laufen über eine eigene Automatenmaschine mit linearer Laufzeit je Zeile (keine Rückverfolgung, keine Rückverweise). */
const RECHERCHE_GRENZE = { stufen: 8, eintraege: 10000, gelesen: 16 * 1048576, puffer: 4 * 1048576, muster: 1024, zustaende: 4096 };
/* Befehle, die in einer Pipeline stehen dürfen; die eigenen Befehle dieses Moduls laufen auch einzeln über diesen Weg */
const RECHERCHE_PIPE = new Set(['ls', 'cat', 'head', 'tail', 'echo', 'pwd', 'grep', 'find', 'wc', 'sort', 'uniq', 'sha256sum']);
const RECHERCHE_EIGEN = new Set(['grep', 'find', 'wc', 'sort', 'uniq', 'sha256sum']);

/* ---------- Hilfen ---------- */
class RechercheAbbruch extends Error { constructor(meldung) { super(meldung || 'abbruch'); this.meldung = meldung || null; } }
function rDeps() {
  const m = new Map();
  return {
    add: function (liste) { (liste || []).forEach(function (d) { if (d) { const k = JSON.stringify(d); if (!m.has(k)) m.set(k, d); } }); return this; },
    liste: function () { return Array.from(m.values()); }
  };
}
function rVereinigung() { return rVereinigungAus(arguments); }
/* Vereinigung beliebig vieler Listen ohne Argument-Spread (große Eingaben, Review zu #141) */
function rVereinigungAus(listen) { const u = rDeps(); for (const l of listen) u.add(l); const x = u.liste(); return x.length ? x : null; }
/* UTF-8-Länge ohne Kopie */
function rUtf8(s) {
  let n = 0;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); n += c < 0x80 ? 1 : c < 0x800 ? 2 : c >= 0xd800 && c <= 0xdbff ? (i++, 4) : 3; }
  return n;
}
/* Ursprüngliche Bindung (wie #140): Abhängigkeiten auf Dossier, Pin, Zone und Sichtung tragen zusätzlich Identität und ursprüngliche
   Dossierzuordnung; Exportnamen im Archiv die Bindung ihres Objekts. Ohne auflösbare Identität (Altobjekt ohne Anlegezeit oder Kennung)
   bleibt die aktuelle Abhängigkeit allein. Je Operation zwischengespeichert. */
/* Bindung eines Objekts: mit Identität wie #140 (herkunft); Altobjekt ohne Anlegezeit oder Kennung: Existenz (Kennungen werden über
   PROFIL.seq nicht wiederverwendet) und Dossier zum Zeitpunkt des Treffers, damit Verknüpfung A -> B und Sperre A auch hier greift */
function rObjektBindung(d) {
  const x = INTEL.bindung(d);
  if (x.da) return [{ art: 'herkunft', deps: [d], bindung: [x] }];
  const alt = [{ art: 'objekt', ziel: d }];
  if (d.art === 'sichtung') alt.push({ art: 'dossier', id: d.dossier });
  else if ((d.art === 'pin' || d.art === 'zone') && x.dossier) alt.push({ art: 'dossier', id: x.dossier });
  return alt;
}
function rBinden(op, deps) {
  if (!deps || !deps.length) return deps && deps.length ? deps : null;
  const aus = [];
  for (const d of deps) {
    if (!d) continue;
    const k = JSON.stringify(d);
    let b = op.bindungen.get(k);
    if (b === undefined) {
      b = [d];
      if (d.art === 'dossier' || d.art === 'pin' || d.art === 'zone' || d.art === 'sichtung') b = b.concat(rObjektBindung(d));
      else if (d.art === 'archivname') {
        const z = terminalArchivNameZiel(d.name);
        if (z) b = b.concat(rObjektBindung(z.art === 'sichtung' ? { art: 'sichtung', dossier: z.dossier, id: z.id.slice(z.dossier.length + 1) } : { art: z.art, id: z.id }));
      }
      op.bindungen.set(k, b);
    }
    for (const x of b) aus.push(x);
  }
  return aus;
}
function rGesperrt(d) { return !!d && d.some(INTEL.gesperrt); }
function rZeilen(text) {
  const z = String(text).split('\n'), offen = !String(text).endsWith('\n');
  if (!offen || text === '') z.pop();
  return { zeilen: z, offen: offen && text !== '' };
}
/* Ausgabeliste mit fortlaufender Nummer je Eintrag: stdout und stderr der letzten Stufe erscheinen in der Reihenfolge ihrer Entstehung */
function rListe(op) {
  const a = [];
  let bytes = 0;
  a.push = function () {
    for (const x of arguments) {
      if (!x) continue;
      x.n = ++op.nr; x.stufe = op.stufe;
      bytes += rUtf8(x.t) + 1;
      if (bytes > RECHERCHE_GRENZE.puffer) throw new RechercheAbbruch('output limit reached (4 MiB); no result');
      Array.prototype.push.call(a, x);
    }
    return a.length;
  };
  return a;
}
function rStrom(zeilen, offen) { return { zeilen: zeilen || [], offen: !!offen }; }
function rText(strom) { return strom.zeilen.length ? strom.zeilen.map(function (z) { return z.t; }).join('\n') + (strom.offen ? '' : '\n') : ''; }
function rBytes(s) { return new TextEncoder().encode(s).length; }
function rQ(name) { return '‘' + name + '’'; }   /* find in en_US.UTF-8: ‘name’ */
/* Tilde wie von bash vor dem Befehl erweitert: Ausgaben und Meldungen nennen /home/raizo/... */
function rName(name) { return name === '~' || (typeof name === 'string' && name.startsWith('~/')) ? '/' + TERMINAL_HEIM.join('/') + name.slice(1) : name; }
/* Abhängigkeiten eines Kindes beim Durchlauf: Pfadabhängigkeiten der Eltern gelten weiter. Ausnahme /exports: ein virtuelles Verzeichnis trägt die
   Herkunft aller Exporte darunter (nur für seine eigene Zeile, Review 3 zu #140); jede Datei trägt ihre eigene vollständige Herkunft. */
function rErben(seg, eltern, kind) { return terminalAnbieter(seg).name === 'exporte' ? (kind && kind.length ? kind : null) : rVereinigung(eltern, kind); }
function rPfadJoin(basis, name) { return basis === '' ? name : basis.endsWith('/') ? basis + name : basis + '/' + name; }
function rFehlerText(f) {
  if (f === 'ENOENT' || f === 'Datei oder Ordner nicht gefunden') return 'No such file or directory';
  if (f === 'ENOSYS') return 'Operation not supported';
  return /^E[A-Z]+$/.test(f) ? terminalDateiFehlerText(f) : String(f);
}
/* Operation: gemeinsamer Zustand aller Stufen (Grenzen, Herkunft, Abbruch) */
function rOperation(umleitZiel, umleitArt) {
  const t = TERMINAL_ZUSTAND, herkunft = new Set(), gelesenPfade = [];
  const op = { version: t.version, kette: t.kette, herkunft: herkunft, archivSchutz: false, eintraege: 0, gelesen: 0, schritte: 0, letzt: Date.now(),
    nr: 0, takte: 0, cache: {}, bindungen: new Map(), alles: rDeps(), zielSeg: umleitZiel, zielArt: umleitArt, gelesenPfade: gelesenPfade };
  const basis = terminalFsMitHerkunft(herkunft, { gelesen: gelesenPfade });
  /* Bei ">" ist das Ziel für die Befehle leer wie nach dem Kürzen durch bash; ">>" liest den bisherigen Inhalt */
  op.fs = Object.assign({}, basis, {
    readFile: function (seg, o) {
      if (op.zielSeg && op.zielArt === '>' && seg && seg.join('/') === op.zielSeg.join('/')) { gelesenPfade.push(seg.join('/')); return Promise.resolve({ text: '' }); }
      return basis.readFile(seg, o);
    }
  });
  return op;
}
function rPruefen(op) {
  const t = TERMINAL_ZUSTAND;
  if (t.version !== op.version || (op.kette && (op.kette.abgebrochen || t.kette !== op.kette))) throw new RechercheAbbruch(null);
}
/* Rückgabe an die Ereignisschleife (UI, Funk- und LOS-Zeitgeber), höchstens alle 8 ms; danach Sitzung und Abbruch prüfen */
/* Zeit ODER Anzahl der Takte: unter einer angehaltenen Uhr (A0-Tests, Hintergrundfenster) steht Date.now() still */
async function rTakt(op) {
  if (Date.now() - op.letzt < 8 && ++op.takte < 64) return;
  op.takte = 0;
  await new Promise(function (ok) { const c = new MessageChannel(); c.port1.onmessage = function () { c.port1.close(); ok(); }; c.port2.postMessage(0); });
  op.letzt = Date.now();
  rPruefen(op);
}
function rEintrag(op) { if (++op.eintraege > RECHERCHE_GRENZE.eintraege) throw new RechercheAbbruch('search limit reached (' + RECHERCHE_GRENZE.eintraege + ' entries); no result'); }
function rGelesen(op, n) { op.gelesen += n; if (op.gelesen > RECHERCHE_GRENZE.gelesen) throw new RechercheAbbruch('read limit reached (16 MiB); no result'); }
function rPuffer(strom) {
  let n = 0;
  for (const z of strom.zeilen) { n += rUtf8(z.t) + 1; if (n > RECHERCHE_GRENZE.puffer) throw new RechercheAbbruch('output limit reached (4 MiB); no result'); }
}
/* Datei lesen mit den Regeln der bestehenden Leser (terminalLeser): Exportobjekte im Archiv nie, Sichtbarkeit vor und nach dem Lesen */
async function rDatei(op, seg, pfadDeps) {
  let r;
  if (seg[0] === TERMINAL_DB && terminalArchivNameZiel(seg.at(-1))) r = { fehler: 'EACCES' };
  else {
    r = await op.fs.readFile(seg);
    rPruefen(op);
    if (!r.fehler && seg[0] === TERMINAL_DB && !TERMINAL_FS.sichtbar(seg)) r = { fehler: 'EACCES' };
  }
  if (r.fehler) return { fehler: r.fehler === 'Datei oder Ordner nicht gefunden' ? 'ENOENT' : r.fehler };
  rGelesen(op, rBytes(r.text));
  const basis = rBinden(op, rVereinigung(pfadDeps, r.deps)) || [];
  op.alles.add(basis);
  const zd = (r.zeilenDeps || []).map(function (d) { const b = rBinden(op, d); op.alles.add(b); return b; });
  const z = rZeilen(r.text), zeilen = [];
  for (let j = 0; j < z.zeilen.length; j++) zeilen.push({ t: z.zeilen[j], d: zd[j] && zd[j].length ? rVereinigung(basis, zd[j]) : basis.length ? basis : null });
  return { text: r.text, strom: rStrom(zeilen, z.offen), deps: basis.length ? basis : null };
}
/* Pfad eines Operanden wie terminalSendPfad (Paket 4): in /intel komponentenweise physisch (Links auf ihr Ziel, ".." danach), sonst
   lexikalisch; Verzeichnisse, die ".." überspringt, müssen bestehen und Verzeichnisse sein; "datei/" ist ENOTDIR. Die Abhängigkeiten aller
   durchlaufenen Einträge bleiben erhalten (gebunden). opt.lstat (find -P): eine letzte Komponente, die ein Link ist, wird nicht gefolgt.
   Ergebnis { seg, deps, link } oder { fehler }. Durchlaufenes /intel zählt für E6 auch dann, wenn der Pfad es wieder verlässt. */
async function rAufloesen(op, pfad, opt) {
  opt = opt || {};
  const roh = terminalShellPfad(pfad);
  if (!roh) return { fehler: 'ENOENT' };
  const heim = pfad === '~' || pfad.startsWith('~/'), absolut = heim || pfad.startsWith('/');
  let seg = heim ? TERMINAL_HEIM.slice() : absolut ? [] : terminalShellPfad('').slice(), fest = seg.length, datei = false;
  const zwischen = [], deps = [];
  const teile = (heim ? pfad.slice(1) : pfad).split('/').filter(function (n) { return n && n !== '.'; });
  for (let i = 0; i < teile.length; i++) {
    const name = teile[i];
    if (datei) return { fehler: 'ENOTDIR' };
    if (name === '..') { if (seg.length > fest && seg[0] !== 'intel') zwischen.push(seg.slice()); seg.pop(); fest = Math.min(fest, seg.length); continue; }
    seg.push(name);
    if (seg[0] === 'intel') op.herkunft.add('intel');
    if (seg[0] === 'intel' && seg.length > 1) {
      if (i === teile.length - 1 && opt.lstat && !roh.endeVerzeichnis) {
        const l = await op.fs.readlink(seg);
        rPruefen(op);
        if (l && l.ziel) { for (const d of l.deps || []) deps.push(d); return { seg: seg, deps: rBinden(op, deps), link: true }; }
      }
      const st = INTEL.stat(seg.slice(1));
      if (st.fehler) return { fehler: st.fehler };
      for (const d of st.pfadDeps || []) deps.push(d);
      seg = st.kanonisch.slice(); fest = Math.min(fest, seg.length);
      datei = st.typ === 'file';
    }
  }
  for (const z of zwischen) {
    const st = await op.fs.stat(z, { pruefen: true, cache: op.cache });
    rPruefen(op);
    if (st.fehler) return { fehler: st.fehler === 'Datei oder Ordner nicht gefunden' ? 'ENOENT' : st.fehler };
    if (st.typ === 'file') return { fehler: 'ENOTDIR' };
  }
  if (roh.endeVerzeichnis && seg.length) {
    const st = await op.fs.stat(seg, { pruefen: true, cache: op.cache });
    rPruefen(op);
    if (!st.fehler && st.typ === 'file') return { fehler: 'ENOTDIR' };
  }
  const b = rBinden(op, deps);
  op.alles.add(b);
  return { seg: seg, deps: b };
}
/* Physische Art eines Startpfads ohne Folgen eines Links (lstat): Links kennt nur /intel */
async function rLstat(op, seg, endeVerzeichnis) {
  if (!endeVerzeichnis && seg.length && terminalAnbieter(seg).name === 'intel') {
    const l = await op.fs.readlink(seg);
    rPruefen(op);
    if (l && l.ziel) return { typ: 'link', deps: rBinden(op, l.deps) };
  }
  const st = await op.fs.stat(seg, { pruefen: true, cache: op.cache });
  rPruefen(op);
  if (st.fehler) return { fehler: st.fehler === 'Datei oder Ordner nicht gefunden' ? 'ENOENT' : st.fehler };
  return { typ: st.typ === 'dir' ? 'dir' : 'file', deps: rBinden(op, st.deps) };
}
/* Verzeichnis lesen: Einträge mit Art und Abhängigkeiten (Eintrag und Verzeichnis); versteckte Einträge eingeschlossen */
async function rVerzeichnis(op, seg) {
  const r = await op.fs.readdir(seg, { versteckt: true, cache: op.cache });
  rPruefen(op);
  if (r.fehler) return { fehler: r.fehler === 'Datei oder Ordner nicht gefunden' ? 'ENOENT' : r.fehler };
  const dd = rBinden(op, r.deps) || [];
  op.alles.add(dd);
  return { eintraege: r.eintraege.filter(function (e) { return e.name !== '.' && e.name !== '..'; }).map(function (e) {
    /* Archiv: Namen der Exportobjekte sind geschützt (Sichtbarkeitsregel des Archivs); jede Zeile mit einem Archivnamen trägt ihn. Auch in
       op.alles, damit Zahlen über später ausgefilterte Namen gebunden bleiben. */
    let ad = null;
    if (seg[0] === TERMINAL_DB && terminalArchivNameZiel(e.name)) { ad = [{ art: 'archivname', name: e.name }]; op.archivSchutz = true; }
    const ed = rBinden(op, rVereinigung(e.deps, ad));
    op.alles.add(ed);
    return { name: e.name, typ: e.link ? 'link' : e.dir ? 'dir' : 'file', deps: rVereinigung(dd, ed) };
  }) };
}
/* Optionen im Stil von getopt: Kurzoptionen (Buchstabe -> 'flag' oder 'wert'), Langoptionen; erster Nicht-Optionswert bleibt Operand,
   GNU-Umstellung (Optionen nach Operanden) wie coreutils. Fehler mit Originalwortlaut und dem Rückgabewert des Werkzeugs. */
function rOptionen(befehl, args, kurz, lang, code, kopf) {
  const opt = [], operanden = [];
  let ende = false;
  const fehler = function (z) { return { fehler: { code: code, aus: [], err: (kopf ? [z].concat(kopf) : [z, terminalGnuTry(befehl)]).map(function (t) { return { t: t, d: null }; }) } }; };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (ende || a === '-' || a[0] !== '-' || a.length < 2) { operanden.push(a); continue; }
    if (a === '--') { ende = true; continue; }
    if (a.startsWith('--')) {
      const gl = a.indexOf('='), n = gl < 0 ? a.slice(2) : a.slice(2, gl), e = lang[n];
      if (!e) return fehler(befehl + ": unrecognized option '" + a + "'");
      if (e.wert) {
        if (gl >= 0) opt.push([e.k, a.slice(gl + 1)]);
        else if (i + 1 < args.length) opt.push([e.k, args[++i]]);
        else return fehler(befehl + ": option '--" + n + "' requires an argument");
      } else opt.push([e.k, true]);
      continue;
    }
    const zeichen = Array.from(a).slice(1);
    for (let j = 0; j < zeichen.length; j++) {
      const c = zeichen[j], art = kurz[c];
      if (art === 'nicht') return { fehler: { code: code, aus: [], err: [{ t: befehl + ': -' + c + ': option not supported in Shadow Terminal', d: null }] } };
      if (!art) return fehler(befehl + ": invalid option -- '" + c + "'");
      if (art === 'wert') {
        const rest = zeichen.slice(j + 1).join('');
        if (rest) opt.push([c, rest]);
        else if (i + 1 < args.length) opt.push([c, args[++i]]);
        else return fehler(befehl + ": option requires an argument -- '" + c + "'");
        break;
      }
      opt.push([c, true]);
    }
  }
  return { opt: opt, operanden: operanden, hat: function (k) { return opt.some(function (o) { return o[0] === k; }); } };
}
function rFehler(code, zeilen) { return { code: code, aus: rStrom([]), err: zeilen.map(function (t) { return { t: t, d: null }; }) }; }

/* ---------- Suchmuster: Parser (GNU BRE/ERE-Teilmenge) und Automat ---------- */
const R_KLASSEN = {
  alpha: function (c) { return /\p{L}/u.test(c); }, digit: function (c) { return /[0-9]/.test(c); }, alnum: function (c) { return /[\p{L}\p{N}]/u.test(c); },
  upper: function (c) { return /\p{Lu}/u.test(c); }, lower: function (c) { return /\p{Ll}/u.test(c); }, space: function (c) { return /\s/.test(c); },
  blank: function (c) { return c === ' ' || c === '\t'; }, punct: function (c) { return /[!-/:-@[-`{-~]/.test(c) || /\p{P}/u.test(c); },
  xdigit: function (c) { return /[0-9A-Fa-f]/.test(c); }, cntrl: function (c) { return /[\u0000-\u001f\u007f]/.test(c); },
  print: function (c) { return !/[\u0000-\u001f\u007f]/.test(c); }, graph: function (c) { return !/[\u0000- \u007f]/.test(c); }
};
function rWortZeichen(c) { return c !== undefined && /[\p{L}\p{N}_]/u.test(c); }
function rMusterFehler(text) { const e = new Error(text); e.muster = true; return e; }
/* AST: {t:'z', c} Zeichen, {t:'.'}, {t:'[', neg, teile:[[lo,hi]|fn]}, {t:'^'}, {t:'$'}, {t:'cat', a}, {t:'alt', a}, {t:'rep', k, min, max} */
function rParse(muster, ere) {
  const s = Array.from(muster);
  let i = 0;
  const am = function () { return s[i]; };
  function klammer() {
    i++;   /* [ */
    let neg = false;
    if (s[i] === '^') { neg = true; i++; }
    const teile = [];
    let erst = true;
    while (true) {
      if (i >= s.length) throw rMusterFehler('Unmatched [, [^, [:, [., or [=');
      let c = s[i];
      if (c === ']' && !erst) { i++; break; }
      erst = false;
      if (c === '[' && (s[i + 1] === ':' || s[i + 1] === '.' || s[i + 1] === '=')) {
        const art = s[i + 1], ende = s.slice(i + 2).join('').indexOf(art + ']');
        if (ende < 0) throw rMusterFehler('Unmatched [, [^, [:, [., or [=');
        const name = s.slice(i + 2, i + 2 + Array.from(s.slice(i + 2).join('').slice(0, ende)).length).join('');
        i += 2 + Array.from(name).length + 2;
        if (art !== ':') throw rMusterFehler('collating elements and equivalence classes are not supported');
        if (!R_KLASSEN[name]) throw rMusterFehler('Invalid character class name');
        teile.push(R_KLASSEN[name]);
        continue;
      }
      i++;
      if (s[i] === '-' && s[i + 1] !== undefined && s[i + 1] !== ']') {
        const hi = s[i + 1];
        i += 2;
        if (hi.codePointAt(0) < c.codePointAt(0)) throw rMusterFehler('Invalid range end');
        teile.push([c.codePointAt(0), hi.codePointAt(0)]);
      } else teile.push([c.codePointAt(0), c.codePointAt(0)]);
    }
    return { t: '[', neg: neg, teile: teile };
  }
  function intervall(start) {
    /* nach "{" bzw. "\{": m, m, oder m,n; ungültig in ERE: "{" ist ein Zeichen */
    let j = start, a = '', b = null;
    while (/[0-9]/.test(s[j] || '')) a += s[j++];
    if (s[j] === ',') { j++; b = ''; while (/[0-9]/.test(s[j] || '')) b += s[j++]; }
    const zu = ere ? s[j] === '}' : s[j] === '\\' && s[j + 1] === '}';
    if (!zu || a === '') return null;
    const min = Number(a), max = b === null ? min : b === '' ? Infinity : Number(b);
    if (max < min || min > 255 || (max !== Infinity && max > 255)) throw rMusterFehler('Invalid content of \\{\\}');
    return { min: min, max: max, ende: j + (ere ? 1 : 2) };
  }
  function alternative(tiefe) {
    const zweige = [sequenz(tiefe)];
    while (i < s.length && (ere ? s[i] === '|' : s[i] === '\\' && s[i + 1] === '|')) { i += ere ? 1 : 2; zweige.push(sequenz(tiefe)); }
    return zweige.length > 1 ? { t: 'alt', a: zweige } : zweige[0];
  }
  function sequenz(tiefe) {
    const a = [];
    const start = i;
    while (i < s.length) {
      const c = s[i];
      if (ere ? c === '|' : c === '\\' && s[i + 1] === '|') break;
      if (ere ? c === ')' : c === '\\' && s[i + 1] === ')') { if (tiefe > 0) break; if (ere) throw rMusterFehler('Unmatched ) or \\)'); }
      let atom = null;
      const amAnfang = i === start;
      if (c === '^' && (ere || amAnfang)) { i++; a.push({ t: '^' }); continue; }
      if (c === '$') {
        const n = s[i + 1], ende = i + 1 >= s.length || (ere ? n === '|' || n === ')' : n === '\\' && (s[i + 2] === '|' || s[i + 2] === ')'));
        if (ere || ende) { i++; a.push({ t: '$' }); continue; }
      }
      const quant = ere ? (c === '*' || c === '+' || c === '?' || c === '{') : (c === '*' || (c === '\\' && (s[i + 1] === '+' || s[i + 1] === '?' || s[i + 1] === '{')));
      if (quant && (a.length && a[a.length - 1].t !== '^')) {
        let min, max, weiter;
        if (c === '*') { min = 0; max = Infinity; weiter = i + 1; }
        else if (ere && c === '+') { min = 1; max = Infinity; weiter = i + 1; }
        else if (ere && c === '?') { min = 0; max = 1; weiter = i + 1; }
        else if (!ere && s[i + 1] === '+') { min = 1; max = Infinity; weiter = i + 2; }
        else if (!ere && s[i + 1] === '?') { min = 0; max = 1; weiter = i + 2; }
        else {
          const iv = intervall(i + (ere ? 1 : 2));
          if (!iv) { if (!ere) throw rMusterFehler('Unmatched \\{'); a.push({ t: 'z', c: '{' }); i++; continue; }
          min = iv.min; max = iv.max; weiter = iv.ende;
        }
        const vor = a.pop();
        a.push({ t: 'rep', k: vor, min: min, max: max });
        i = weiter;
        continue;
      }
      if (c === '.') { atom = { t: '.' }; i++; }
      else if (c === '[') atom = klammer();
      else if (ere && c === '(') {
        i++;
        atom = alternative(tiefe + 1);
        if (s[i] !== ')') throw rMusterFehler('Unmatched ( or \\(');
        i++;
      } else if (c === '\\') {
        const n = s[i + 1];
        if (n === undefined) throw rMusterFehler('Trailing backslash');
        if (!ere && n === '(') {
          i += 2;
          atom = alternative(tiefe + 1);
          if (!(s[i] === '\\' && s[i + 1] === ')')) throw rMusterFehler('Unmatched ( or \\(');
          i += 2;
        } else if (/[1-9]/.test(n)) throw rMusterFehler('back-references are not supported');
        else if ('bB<>`\''.includes(n)) throw rMusterFehler('\\' + n + ' is not supported');
        else if (n === 'w' || n === 'W') { atom = { t: '[', neg: n === 'W', teile: [rWortZeichen] }; i += 2; }
        else if (n === 's' || n === 'S') { atom = { t: '[', neg: n === 'S', teile: [R_KLASSEN.space] }; i += 2; }
        else { atom = { t: 'z', c: n }; i += 2; }
      } else { atom = { t: 'z', c: c }; i++; }
      a.push(atom);
    }
    return a.length === 1 ? a[0] : { t: 'cat', a: a };
  }
  const baum = alternative(0);
  if (i < s.length) throw rMusterFehler(ere ? 'Unmatched ) or \\)' : 'Unmatched ) or \\)');
  return baum;
}
/* Thompson-Automat: Zustände { art, c|test, aus, aus2 }; art: 'z' Zeichen, 't' Test, 's' Verzweigung, 'e' Sprung, '^', '$', 'wa', 'we', 'ok' */
function rKompilieren(baum, opt) {
  const Z = [];
  const neu = function (z) { Z.push(z); if (Z.length > RECHERCHE_GRENZE.zustaende) throw rMusterFehler('Regular expression too big'); return Z.length - 1; };
  const falt = function (c) { return opt.i ? c.toLowerCase() : c; };
  function frag(n) {
    /* liefert { start, enden: [[zustand, feld]] } */
    switch (n.t) {
      case 'z': { const z = neu({ art: 'z', c: falt(n.c) }); return { start: z, enden: [[z, 'aus']] }; }
      case '.': { const z = neu({ art: 't', test: function () { return true; } }); return { start: z, enden: [[z, 'aus']] }; }
      case '[': {
        const teile = n.teile, neg = n.neg;
        const drin = function (c) {
          const cp = c.codePointAt(0);
          return teile.some(function (t) { return typeof t === 'function' ? t(c) : cp >= t[0] && cp <= t[1]; });
        };
        const test = opt.i ? function (c) { return (drin(c) || drin(c.toUpperCase()) || drin(c.toLowerCase())) !== neg; } : function (c) { return drin(c) !== neg; };
        const z = neu({ art: 't', test: test });
        return { start: z, enden: [[z, 'aus']] };
      }
      case '^': case '$': { const z = neu({ art: n.t }); return { start: z, enden: [[z, 'aus']] }; }
      case 'cat': {
        if (!n.a.length) { const z = neu({ art: 'e' }); return { start: z, enden: [[z, 'aus']] }; }
        const teile = n.a.map(frag);
        for (let k = 0; k < teile.length - 1; k++) teile[k].enden.forEach(function (e) { Z[e[0]][e[1]] = teile[k + 1].start; });
        return { start: teile[0].start, enden: teile[teile.length - 1].enden };
      }
      case 'alt': {
        const teile = n.a.map(frag);
        let start = teile[teile.length - 1].start;
        for (let k = teile.length - 2; k >= 0; k--) start = neu({ art: 's', aus: teile[k].start, aus2: start });
        return { start: start, enden: [].concat.apply([], teile.map(function (x) { return x.enden; })) };
      }
      case 'rep': {
        /* min Pflichtkopien, danach (max - min) optionale oder eine Schleife */
        const kette = [];
        for (let k = 0; k < n.min; k++) kette.push(frag(n.k));
        if (n.max === Infinity) {
          const f = frag(n.k), s = neu({ art: 's', aus: f.start, aus2: null });
          f.enden.forEach(function (e) { Z[e[0]][e[1]] = s; });
          kette.push({ start: s, enden: [[s, 'aus2']] });
        } else {
          for (let k = n.min; k < n.max; k++) {
            const f = frag(n.k), s = neu({ art: 's', aus: f.start, aus2: null });
            kette.push({ start: s, enden: f.enden.concat([[s, 'aus2']]) });
          }
        }
        if (!kette.length) { const z = neu({ art: 'e' }); return { start: z, enden: [[z, 'aus']] }; }
        for (let k = 0; k < kette.length - 1; k++) kette[k].enden.forEach(function (e) { Z[e[0]][e[1]] = kette[k + 1].start; });
        return { start: kette[0].start, enden: kette[kette.length - 1].enden };
      }
    }
    throw rMusterFehler('internal');
  }
  let f = frag(baum);
  const teile = [];
  if (opt.x) teile.push({ start: neu({ art: '^' }), enden: null });
  else if (opt.w) teile.push({ start: neu({ art: 'wa' }), enden: null });
  teile.forEach(function (t) { t.enden = [[t.start, 'aus']]; });
  if (teile.length) { teile[0].enden.forEach(function (e) { Z[e[0]][e[1]] = f.start; }); f = { start: teile[0].start, enden: f.enden }; }
  const ende = opt.x ? neu({ art: '$' }) : opt.w ? neu({ art: 'we' }) : null;
  const ok = neu({ art: 'ok' });
  if (ende !== null) { f.enden.forEach(function (e) { Z[e[0]][e[1]] = ende; }); Z[ende].aus = ok; }
  else f.enden.forEach(function (e) { Z[e[0]][e[1]] = ok; });
  return { Z: Z, start: f.start };
}
/* Zeilentest in linearer Zeit: Zustandsmenge je Position; bei sehr langen Zeilen gibt der Test die Ereignisschleife frei */
async function rAutomatTest(a, cps, op) {
  const Z = a.Z, n = cps.length, marke = new Int32Array(Z.length).fill(-1);
  let akt = [], gen = 0;
  const hinzu = function (liste, s, pos) {
    const stapel = [s];
    while (stapel.length) {
      const x = stapel.pop();
      if (x === null || x === undefined || marke[x] === gen) continue;
      marke[x] = gen;
      const z = Z[x];
      switch (z.art) {
        case 's': stapel.push(z.aus2, z.aus); break;
        case 'e': stapel.push(z.aus); break;
        case '^': if (pos === 0) stapel.push(z.aus); break;
        case '$': if (pos === n) stapel.push(z.aus); break;
        /* -w wie GNU: vor dem Treffer und nach dem Treffer kein Wortzeichen (der Treffer selbst darf leer sein oder aus Satzzeichen bestehen) */
        case 'wa': if (!rWortZeichen(cps[pos - 1])) stapel.push(z.aus); break;
        case 'we': if (!rWortZeichen(cps[pos])) stapel.push(z.aus); break;
        case 'ok': return true;
        default: liste.push(x);
      }
    }
    return false;
  };
  for (let pos = 0; pos <= n; pos++) {
    gen++;
    const naechste = [];
    for (const x of akt) {
      const z = Z[x];
      if (z.art === 'z' ? z.c === cps[pos - 1] : z.test(cps[pos - 1])) { if (hinzu(naechste, z.aus, pos)) return true; }
    }
    if (hinzu(naechste, a.start, pos)) return true;   /* Suche ohne Anker: an jeder Position neu beginnen */
    akt = naechste;
    op.schritte += akt.length + 1;
    if (op.schritte > 200000) { op.schritte = 0; await rTakt(op); }
  }
  return false;
}
/* Muster (mehrere über -e) zu einem Prüfer: feste Zeichenketten (-F) direkt, sonst Automat. -i faltet Muster und Zeile. */
function rPruefer(muster, opt) {
  if (muster.some(function (m) { return Array.from(m).length > RECHERCHE_GRENZE.muster; })) throw rMusterFehler('pattern too long (maximum ' + RECHERCHE_GRENZE.muster + ' characters)');
  const falt = function (x) { return opt.i ? x.toLowerCase() : x; };
  if (opt.F) {
    const fest = muster.map(falt);
    return async function (zeile, op) {
      const z = falt(zeile);
      for (const m of fest) {
        if (opt.x) { if (z === m) return true; continue; }
        if (!opt.w) { if (z.includes(m)) return true; continue; }
        /* -F -w: Vorkommen über indexOf, Wortgrenzen je Vorkommen; Schritte begrenzt die Freigabe der Ereignisschleife. Leeres Muster: jede
           Position einmal (GNU: Treffer, wo davor und danach kein Wortzeichen steht); endet am Zeilenende (Review 2 zu #141). */
        if (m === '') {
          const cps = Array.from(z);
          for (let k = 0; k <= cps.length; k++) if (!rWortZeichen(cps[k - 1]) && !rWortZeichen(cps[k])) return true;
          continue;
        }
        let p = z.indexOf(m);
        while (p >= 0) {
          const vor = Array.from(z.slice(Math.max(0, p - 2), p)).pop(), nach = Array.from(z.slice(p + m.length, p + m.length + 2))[0];
          if (!rWortZeichen(vor) && !rWortZeichen(nach)) return true;
          op.schritte += m.length + 1;
          if (op.schritte > 200000) { op.schritte = 0; await rTakt(op); }
          p = z.indexOf(m, p + 1);
        }
      }
      return false;
    };
  }
  const automaten = muster.map(function (m) { return rKompilieren(rParse(m, opt.E), opt); });
  return async function (zeile, op) {
    const cps = Array.from(falt(zeile));
    for (const a of automaten) if (await rAutomatTest(a, cps, op)) return true;
    return false;
  };
}

/* ---------- grep ---------- */
const R_GREP_KURZ = { i: 'flag', y: 'flag', n: 'flag', r: 'flag', l: 'flag', v: 'flag', c: 'flag', F: 'flag', E: 'flag', G: 'flag', e: 'wert', h: 'flag', H: 'flag', s: 'flag', q: 'flag', w: 'flag', x: 'flag',
  A: 'nicht', B: 'nicht', C: 'nicht', o: 'nicht', R: 'nicht', L: 'nicht', m: 'nicht', f: 'nicht', P: 'nicht', z: 'nicht', Z: 'nicht', a: 'nicht', b: 'nicht', T: 'nicht', U: 'nicht', d: 'nicht', D: 'nicht', I: 'nicht', u: 'nicht', V: 'nicht' };
const R_GREP_LANG = { 'ignore-case': { k: 'i' }, 'line-number': { k: 'n' }, recursive: { k: 'r' }, 'files-with-matches': { k: 'l' }, 'invert-match': { k: 'v' }, count: { k: 'c' },
  'fixed-strings': { k: 'F' }, 'extended-regexp': { k: 'E' }, 'basic-regexp': { k: 'G' }, regexp: { k: 'e', wert: true }, 'no-filename': { k: 'h' }, 'with-filename': { k: 'H' },
  'no-messages': { k: 's' }, quiet: { k: 'q' }, silent: { k: 'q' }, 'word-regexp': { k: 'w' }, 'line-regexp': { k: 'x' } };
const R_GREP_USAGE = ['Usage: grep [OPTION]... PATTERNS [FILE]...', "Try 'grep --help' for more information."];
async function rGrep(op, args, stdin, ctx) {
  const p = rOptionen('grep', args, R_GREP_KURZ, R_GREP_LANG, 2, R_GREP_USAGE.slice(0, 1).concat(R_GREP_USAGE.slice(1)));
  if (p.fehler) { p.fehler.aus = rStrom([]); return p.fehler; }
  const o = {};
  let muster = [];
  p.opt.forEach(function (x) { if (x[0] === 'e') muster.push(x[1]); else o[x[0] === 'y' ? 'i' : x[0]] = true; });
  if (o.F && o.E) return rFehler(2, ['grep: conflicting matchers specified']);
  let ops = p.operanden.slice();
  if (!muster.length) { if (!ops.length) return rFehler(2, R_GREP_USAGE); muster = [ops.shift()]; }
  ops = ops.map(rName);
  muster = [].concat.apply([], muster.map(function (m) { return m.split('\n'); }));
  let pruefer;
  try { pruefer = rPruefer(muster, o); } catch (e) { if (e.muster) return rFehler(2, ['grep: ' + e.message]); throw e; }
  const aus = rListe(op), err = rListe(op);
  let treffer = false, fehler = false;
  const rekursiv = !!o.r, ohneOperand = !ops.length;
  /* Dateinamen: -H/-h, sonst bei mehr als einem Operanden, bei -r erst sobald ein Verzeichnis durchsucht wird (GNU: out_file < 0) */
  let mitName = o.H ? 1 : o.h ? 0 : ops.length > 1 ? 1 : rekursiv ? -1 : 0;
  const meldung = function (t, d) { fehler = true; if (!o.s) err.push({ t: 'grep: ' + t, d: d || null }); };
  const durchsuchen = async function (name, strom, deps, binaer) {
    let n = 0, erste = null;
    for (let j = 0; j < strom.zeilen.length; j++) {
      if (j % 256 === 255) await rTakt(op);   /* auch ohne Treffer */
      const z = strom.zeilen[j];
      const pass = (await pruefer(z.t, op)) !== !!o.v;
      if (!pass) continue;
      n++;
      if (o.q) { treffer = true; return 'stopp'; }
      if (o.l) { erste = z; break; }
      if (!o.c && !binaer) aus.push({ t: (mitName > 0 ? name + ':' : '') + (o.n ? (j + 1) + ':' : '') + z.t, d: rVereinigung(z.d, deps) });
    }
    if (n) treffer = true;
    if (o.l) { if (erste) aus.push({ t: name, d: rVereinigung(erste.d, deps) }); return; }
    if (o.c) {
      /* Anzahl (auch 0): Vereinigung aller Eingabezeilen und alles in der Operation Gelesenen, auch vorher ausgefilterter Zeilen */
      const l = [deps, op.alles.liste()];
      for (const z of strom.zeilen) l.push(z.d);
      aus.push({ t: (mitName > 0 ? name + ':' : '') + n, d: rVereinigungAus(l) });
      return;
    }
    if (binaer && n) err.push({ t: 'grep: ' + name + ': binary file matches', d: deps });
  };
  const datei = async function (name, seg, deps) {
    rEintrag(op);
    const r = await rDatei(op, seg, deps);
    if (r.fehler) { meldung(name + ': ' + (r.fehler === 'EISDIR' ? 'Is a directory' : rFehlerText(r.fehler)), deps); return; }
    if (op.zielSeg && op.zielArt === '>>' && seg.join('/') === op.zielSeg.join('/') && !o.l && !o.c && !o.q) { meldung(name + ': input file is also the output', deps); return; }
    return durchsuchen(name, r.strom, rVereinigung(deps, r.deps), r.text.includes('\u0000'));
  };
  const baum = async function (name, seg, deps) {
    rEintrag(op);
    const v = await rVerzeichnis(op, seg);
    if (v.fehler) { meldung(name + ': ' + rFehlerText(v.fehler), deps); return; }
    if (mitName < 0) mitName = 1;
    for (const e of v.eintraege) {
      await rTakt(op);
      if (rGesperrt(e.deps)) continue;
      const kind = rPfadJoin(name, e.name), kseg = seg.concat(e.name), kd = rErben(seg, deps, e.deps);
      if (e.typ === 'link') continue;   /* -r folgt Links nur auf der Befehlszeile */
      const s = e.typ === 'dir' ? await baum(kind, kseg, kd) : await datei(kind, kseg, kd);
      if (s === 'stopp') return s;
    }
  };
  if (ohneOperand && !rekursiv) {
    const s = await durchsuchen('(standard input)', stdin, null, rText(stdin).includes('\u0000'));
    void s;
  } else {
    const liste = ohneOperand ? [null] : ops;   /* grep -r ohne Operand: Arbeitsverzeichnis, Namen ohne "./" */
    for (const name of liste) {
      if (name === '-') { if ((await durchsuchen('(standard input)', stdin, null, false)) === 'stopp') break; continue; }
      const pf = await rAufloesen(op, name === null ? '.' : name);
      if (pf.fehler) { meldung((name === null ? '.' : name) + ': ' + rFehlerText(pf.fehler)); continue; }
      const seg = pf.seg;
      const st = await op.fs.stat(seg, { pruefen: true, cache: op.cache });
      rPruefen(op);
      if (st.fehler) { meldung((name === null ? '.' : name) + ': ' + rFehlerText(st.fehler)); continue; }
      const sd = rVereinigung(pf.deps, rBinden(op, st.deps));
      let s;
      if (st.typ === 'dir') {
        if (!rekursiv) { meldung(name + ': Is a directory'); continue; }
        s = await baum(name === null ? '' : name, seg, sd);
      } else s = await datei(name, seg, sd);
      if (s === 'stopp') break;
    }
  }
  return { code: fehler && !(o.q && treffer) ? 2 : treffer ? 0 : 1, aus: rStrom(o.q ? [] : aus), err: err };
}

/* ---------- find ---------- */
/* Namensmuster wie fnmatch ohne FNM_PERIOD: * ? [..] und \; Vergleich ohne Rückverfolgung über die letzte Sternposition */
function rGlob(muster, ci) {
  const s = Array.from(ci ? muster.toLowerCase() : muster), tok = [];
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '*') { if (tok.length && tok[tok.length - 1].t === '*') continue; tok.push({ t: '*' }); }
    else if (c === '?') tok.push({ t: '?' });
    else if (c === '\\' && i + 1 < s.length) tok.push({ t: 'z', c: s[++i] });
    else if (c === '[') {
      let j = i + 1, neg = false;
      if (s[j] === '!' || s[j] === '^') { neg = true; j++; }
      const teile = [];
      let erst = true, ok = false;
      for (; j < s.length; j++) {
        if (s[j] === ']' && !erst) { ok = true; break; }
        erst = false;
        if (s[j + 1] === '-' && s[j + 2] !== undefined && s[j + 2] !== ']') { teile.push([s[j], s[j + 2]]); j += 2; }
        else teile.push([s[j], s[j]]);
      }
      if (!ok) { tok.push({ t: 'z', c: '[' }); continue; }
      tok.push({ t: '[', neg: neg, teile: teile });
      i = j;
    } else tok.push({ t: 'z', c: c });
  }
  const passt = function (k, c) {
    if (k.t === '?') return true;
    if (k.t === 'z') return k.c === c;
    const cp = c.codePointAt(0), drin = k.teile.some(function (t) { return cp >= t[0].codePointAt(0) && cp <= t[1].codePointAt(0); });
    return drin !== k.neg;
  };
  return function (name) {
    const n = Array.from(ci ? name.toLowerCase() : name);
    let ti = 0, ni = 0, stern = -1, merk = 0;
    while (ni < n.length) {
      if (ti < tok.length && tok[ti].t !== '*' && passt(tok[ti], n[ni])) { ti++; ni++; }
      else if (ti < tok.length && tok[ti].t === '*') { stern = ti++; merk = ni; }
      else if (stern >= 0) { ti = stern + 1; ni = ++merk; }
      else return false;
    }
    while (ti < tok.length && tok[ti].t === '*') ti++;
    return ti === tok.length;
  };
}
const R_FIND_GLOBAL = new Set(['-maxdepth', '-mindepth']);
const R_FIND_NICHT = new Set(['-exec', '-execdir', '-ok', '-okdir', '-delete', '-fprint', '-fprint0', '-fprintf', '-fls', '-printf', '-print0', '-ls', '-o', '-or', '-not', '!', '(', ')', ',',
  '-path', '-ipath', '-wholename', '-iwholename', '-regex', '-iregex', '-size', '-mtime', '-mmin', '-newer', '-user', '-group', '-perm', '-empty', '-prune', '-quit', '-L', '-H', '-follow', '-xdev', '-mount', '-depth']);
async function rFind(op, args, stdin, ctx) {
  const start = [];
  let i = 0;
  while (i < args.length && !(args[i].startsWith('-') && args[i].length > 1) && args[i] !== '!' && args[i] !== '(') start.push(rName(args[i++]));
  if (!start.length) start.push('.');
  const tests = [], err = rListe(op);
  let max = Infinity, min = 0, testGesehen = null;
  for (; i < args.length; i++) {
    const a = args[i];
    if (R_FIND_NICHT.has(a)) return rFehler(1, ['find: ' + a + ': not supported in Shadow Terminal']);
    if (a === '-print' || a === '-a' || a === '-and' || a === '-true') { if (a === '-print') testGesehen = testGesehen || a; continue; }
    if (['-name', '-iname', '-type', '-maxdepth', '-mindepth'].includes(a)) {
      if (i + 1 >= args.length) return rFehler(1, ["find: missing argument to `" + a + "'"]);
      const w = args[++i];
      if (R_FIND_GLOBAL.has(a)) {
        if (!/^\d+$/.test(w)) return rFehler(1, ['find: Expected a positive decimal integer argument to ' + a + ', but got ' + rQ(w)]);
        if (testGesehen) err.push({ t: 'find: warning: you have specified the global option ' + a + ' after the argument ' + testGesehen + ', but global options are not positional, i.e., ' + a + ' affects tests specified before it as well as those specified after it.  Please specify global options before other arguments.', d: null });
        if (a === '-maxdepth') max = Number(w); else min = Number(w);
        continue;
      }
      testGesehen = testGesehen || a;
      if (a === '-type') {
        const arten = w.split(',');
        if (!w || arten.some(function (x) { return !/^[bcdpflsD]$/.test(x); })) return rFehler(1, ['find: Unknown argument to -type: ' + w]);
        if (arten.some(function (x) { return !'fdl'.includes(x); })) return rFehler(1, ['find: -type ' + w + ': only f, d and l are supported in Shadow Terminal']);
        tests.push(function (e) { return arten.includes(e.typ === 'dir' ? 'd' : e.typ === 'link' ? 'l' : 'f'); });
      } else {
        const g = rGlob(w, a === '-iname');
        tests.push(function (e) { return !w.includes('/') && g(e.name); });
      }
      continue;
    }
    if (a.startsWith('-')) return rFehler(1, ["find: unknown predicate `" + a + "'"]);
    return rFehler(1, ['find: paths must precede expression: `' + a + "'"]);
  }
  const aus = rListe(op);
  let code = 0;
  const besuchen = async function (pfad, seg, name, typ, tiefe, deps) {
    rEintrag(op);
    await rTakt(op);
    const e = { name: name, typ: typ };
    if (tiefe >= min && tests.every(function (t) { return t(e); })) aus.push({ t: pfad, d: deps });
    if (typ !== 'dir' || tiefe >= max) return;
    const v = await rVerzeichnis(op, seg);
    if (v.fehler) { err.push({ t: 'find: ' + rQ(pfad) + ': ' + rFehlerText(v.fehler), d: deps }); code = 1; return; }
    for (const k of v.eintraege) {
      if (rGesperrt(k.deps)) continue;
      await besuchen(rPfadJoin(pfad, k.name), seg.concat(k.name), k.name, k.typ, tiefe + 1, rErben(seg, deps, k.deps));
    }
  };
  for (const s of start) {
    const pf = await rAufloesen(op, s, { lstat: true });
    if (pf.fehler) { err.push({ t: 'find: ' + rQ(s) + ': ' + rFehlerText(pf.fehler), d: null }); code = 1; continue; }
    const st = pf.link ? { typ: 'link', deps: null } : await rLstat(op, pf.seg, true);
    if (st.fehler) { err.push({ t: 'find: ' + rQ(s) + ': ' + rFehlerText(st.fehler), d: null }); code = 1; continue; }
    const basis = s.replace(/\/+$/, '').split('/').pop() || s;
    await besuchen(s, pf.seg, basis, st.typ, 0, rVereinigung(pf.deps, st.deps));
  }
  return { code: code, aus: rStrom(aus), err: err };
}

/* ---------- Eingaben aus Dateioperanden oder stdin (wc, sort, uniq, sha256sum, cat/head/tail in Pipelines) ---------- */
async function rEingaben(op, befehl, ops, stdin, ctx) {
  const ein = [], err = [];
  let code = 0;
  ops = ops.length ? ops.map(rName) : ['-'];
  for (const name of ops) {
    if (name === '-') { ein.push({ name: '-', strom: stdin, text: rText(stdin), regulaer: false, deps: null }); continue; }
    rEintrag(op);
    const pf = await rAufloesen(op, name);
    const r = pf.fehler ? { fehler: pf.fehler } : await rDatei(op, pf.seg, pf.deps);
    if (r.fehler) { err.push({ t: befehl + ': ' + name + ': ' + (r.fehler === 'EISDIR' ? 'Is a directory' : rFehlerText(r.fehler)), d: null }); code = 1; ein.push({ name: name, fehlt: r.fehler }); continue; }
    ein.push({ name: name, strom: r.strom, text: r.text, regulaer: true, deps: r.deps });
  }
  return { ein: ein, err: err, code: code };
}
function rAlleDeps(op, e) { const l = [e.deps, op.alles.liste()]; for (const z of e.strom.zeilen) l.push(z.d); return rVereinigungAus(l); }

/* ---------- wc ---------- */
const R_WC_LEER = new RegExp('[ \\t\\n\\v\\f\\r\\u0085\\u1680\\u2000-\\u2006\\u2008-\\u200a\\u2028\\u2029\\u205f\\u3000]');
async function rWc(op, args, stdin, ctx) {
  const p = rOptionen('wc', args, { l: 'flag', w: 'flag', c: 'flag', m: 'flag', L: 'nicht' }, { lines: { k: 'l' }, words: { k: 'w' }, bytes: { k: 'c' }, chars: { k: 'm' } }, 1);
  if (p.fehler) { p.fehler.aus = rStrom([]); return p.fehler; }
  let spalten = ['l', 'w', 'm', 'c'].filter(p.hat);
  if (!spalten.length) spalten = ['l', 'w', 'c'];
  const e = await rEingaben(op, 'wc', p.operanden, stdin, ctx);
  const zahlen = e.ein.map(function (x) {
    if (x.fehlt) return { name: x.name, w: { l: 0, w: 0, m: 0, c: 0 }, fehlt: x.fehlt };
    const t = x.text;
    let woerter = 0, imWort = false;
    for (const c of t) { const leer = R_WC_LEER.test(c); if (!leer && !imWort) woerter++; imWort = !leer; }
    return { name: x.name, w: { l: (t.match(/\n/g) || []).length, w: woerter, m: Array.from(t).length, c: rBytes(t) }, deps: rAlleDeps(op, x), regulaer: x.regulaer, bytes: rBytes(t) };
  });
  /* Breite wie coreutils 9.4 (compute_number_width): ein Wert und eine Eingabe ohne Breite; sonst mindestens 7 bei nicht regulärer Eingabe,
     ansonsten die Stellen der Summe der Dateigrößen */
  let breite = 1;
  if (!(zahlen.length === 1 && spalten.length === 1) && zahlen.length && !zahlen[0].fehlt) {
    let minimum = 1, summe = 0;
    zahlen.forEach(function (z) { if (z.fehlt) return; if (!z.regulaer) minimum = 7; else summe += z.bytes; });
    for (; summe >= 10; summe = Math.floor(summe / 10)) breite++;
    breite = Math.max(breite, minimum);
  }
  const zeile = function (w, name) { return spalten.map(function (k) { return String(w[k]).padStart(breite); }).join(' ') + (name === '-' ? '' : ' ' + name); };
  const aus = zahlen.filter(function (z) { return !z.fehlt || z.fehlt === 'EISDIR'; }).map(function (z) { return { t: zeile(z.w, z.name), d: z.deps || null }; });
  if (zahlen.length > 1) {
    const s = { l: 0, w: 0, m: 0, c: 0 };
    zahlen.forEach(function (z) { ['l', 'w', 'm', 'c'].forEach(function (k) { s[k] += z.w[k]; }); });
    aus.push({ t: zeile(s, 'total'), d: rVereinigungAus(zahlen.map(function (z) { return z.deps; })) });
  }
  return { code: e.code, aus: rStrom(aus), err: e.err };
}

/* ---------- sort ---------- */
function rLocaleSchluessel(s) { return TERMINAL_LOCALE.schluessel(s); }
function rLocaleVergleich(ka, kb, a, b) {
  if (a === b) return 0;
  for (let e = 0; e < 4; e++) {
    const x = ka[e], y = kb[e], n = Math.min(x.length, y.length);
    for (let i = 0; i < n; i++) if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1;
    if (x.length !== y.length) return x.length < y.length ? -1 : 1;
  }
  return a < b ? -1 : a > b ? 1 : 0;
}
/* -n: führende Leerzeichen, Vorzeichen, Ziffern mit Tausendertrennzeichen ',' (en_US), Dezimalpunkt; sonst 0 */
/* Exakt als Zeichenketten (keine Rundung großer Zahlen): Vorzeichen, Ganzteil ohne führende Nullen, Bruchteil ohne folgende Nullen */
function rZahl(s) {
  const m = /^[ \t]*(-?)((?:[0-9]+(?:,[0-9]+)*)?)(?:\.([0-9]*))?/.exec(s);
  const ganz = (m[2] || '').replace(/,/g, '').replace(/^0+/, ''), bruch = (m[3] || '').replace(/0+$/, '');
  return { neg: !!m[1] && !!(ganz || bruch), ganz: ganz, bruch: bruch };
}
function rZahlVergleich(a, b) {
  if (a.neg !== b.neg) return a.neg ? -1 : 1;
  let v = a.ganz.length !== b.ganz.length ? (a.ganz.length < b.ganz.length ? -1 : 1) : a.ganz < b.ganz ? -1 : a.ganz > b.ganz ? 1 : 0;
  if (!v) v = a.bruch < b.bruch ? -1 : a.bruch > b.bruch ? 1 : 0;
  return a.neg ? -v : v;
}
async function rSort(op, args, stdin, ctx) {
  const p = rOptionen('sort', args, { r: 'flag', n: 'flag', u: 'flag', f: 'nicht', k: 'nicht', t: 'nicht', o: 'nicht', b: 'nicht', d: 'nicht', g: 'nicht', h: 'nicht', M: 'nicht', V: 'nicht', s: 'nicht', c: 'nicht', m: 'nicht', z: 'nicht' },
    { reverse: { k: 'r' }, 'numeric-sort': { k: 'n' }, unique: { k: 'u' } }, 2);
  if (p.fehler) { p.fehler.aus = rStrom([]); return p.fehler; }
  const e = await rEingaben(op, 'sort', p.operanden, stdin, ctx);
  if (e.code) return { code: 2, aus: rStrom([]), err: e.err.map(function (x) { return { t: x.t.replace(/^sort: ([^:]+): /, 'sort: cannot read: $1: '), d: x.d }; }) };
  const zeilen = [];
  for (const x of e.ein) for (const z of x.strom.zeilen) zeilen.push(z);
  const r = p.hat('r'), n = p.hat('n'), u = p.hat('u');
  const k = zeilen.map(function (z, i) { return { z: z, i: i, s: rLocaleSchluessel(z.t), n: n ? rZahl(z.t) : null }; });
  await rTakt(op);
  const schluessel = function (a, b) { return n ? rZahlVergleich(a.n, b.n) : rLocaleVergleich(a.s, b.s, a.z.t, b.z.t); };
  k.sort(function (a, b) {
    let v = schluessel(a, b);
    if (!v && n && !u) v = rLocaleVergleich(a.s, b.s, a.z.t, b.z.t);   /* letzte Stufe: ganze Zeile */
    return r ? -v : v;
  });
  await rTakt(op);
  let aus;
  if (u) {
    aus = [];
    for (const x of k) {
      const vor = aus.length ? aus[aus.length - 1] : null;
      if (vor && !schluessel(vor.k, x)) { vor.d = rVereinigung(vor.d, x.z.d); continue; }
      aus.push({ t: x.z.t, d: x.z.d, k: x });
    }
    aus = aus.map(function (x) { return { t: x.t, d: x.d }; });
  } else aus = k.map(function (x) { return x.z; });
  return { code: 0, aus: rStrom(aus), err: [] };
}

/* ---------- uniq ---------- */
async function rUniq(op, args, stdin, ctx) {
  const p = rOptionen('uniq', args, { c: 'flag', d: 'flag', u: 'flag', i: 'flag', D: 'nicht', f: 'nicht', s: 'nicht', w: 'nicht', z: 'nicht' },
    { count: { k: 'c' }, repeated: { k: 'd' }, unique: { k: 'u' }, 'ignore-case': { k: 'i' } }, 1);
  if (p.fehler) { p.fehler.aus = rStrom([]); return p.fehler; }
  if (p.operanden.length > 1) return rFehler(1, ['uniq: an OUTPUT operand is not supported in Shadow Terminal; use a redirection']);
  const e = await rEingaben(op, 'uniq', p.operanden, stdin, ctx);
  if (e.code) return { code: 1, aus: rStrom([]), err: e.err };
  const zeilen = e.ein[0].strom.zeilen, gleich = p.hat('i') ? function (a, b) { return a.toLowerCase() === b.toLowerCase(); } : function (a, b) { return a === b; };
  const gruppen = [];
  for (const z of zeilen) {
    const g = gruppen[gruppen.length - 1];
    if (g && gleich(g.t, z.t)) { g.n++; g.d = rVereinigung(g.d, z.d); } else gruppen.push({ t: z.t, n: 1, d: z.d });
  }
  /* -c, -d, -u hängen von Anzahlen ab: gebunden an alles in der Operation Gelesene (auch ausgefilterte Zeilen) */
  const zaehlt = p.hat('c') || p.hat('d') || p.hat('u'), alles = zaehlt ? op.alles.liste() : null;
  const aus = gruppen.filter(function (g) { return (!p.hat('d') || g.n > 1) && (!p.hat('u') || g.n === 1); })
    .map(function (g) { return { t: (p.hat('c') ? String(g.n).padStart(7) + ' ' : '') + g.t, d: zaehlt ? rVereinigung(g.d, alles, e.ein[0].deps) : g.d }; });
  return { code: 0, aus: rStrom(aus, e.ein[0].strom.offen && aus.length && gruppen.length && aus[aus.length - 1].t.endsWith(gruppen[gruppen.length - 1].t)), err: [] };
}

/* ---------- sha256sum (M4) ---------- */
async function rSha256(op, args, stdin, ctx) {
  const p = rOptionen('sha256sum', args, { b: 'flag', t: 'flag', c: 'nicht', z: 'nicht' }, { binary: { k: 'b' }, text: { k: 't' }, tag: { k: 'tag' } }, 1);
  if (p.fehler) { p.fehler.aus = rStrom([]); return p.fehler; }
  if (p.hat('tag')) return rFehler(1, ['sha256sum: --tag: option not supported in Shadow Terminal']);
  const archiv = [];
  const ops = [];
  for (const name of p.operanden) {
    const pf = name === '-' ? null : await rAufloesen(op, rName(name));
    if (pf && pf.seg && pf.seg[0] === TERMINAL_DB) archiv.push(rName(name)); else ops.push(name);
  }
  /* nur Archivoperanden: keine Prüfsumme der Standardeingabe (Review zu #141) */
  const e = ops.length || !archiv.length ? await rEingaben(op, 'sha256sum', ops, stdin, ctx) : { ein: [], err: [], code: 0 };
  const aus = [];
  for (const x of e.ein) {
    if (x.fehlt) continue;
    const h = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(x.text))), function (b) { return b.toString(16).padStart(2, '0'); }).join('');
    rPruefen(op);
    aus.push({ t: h + (p.hat('b') ? ' *' : '  ') + x.name, d: rAlleDeps(op, x) });
  }
  /* Archiv: die Brücke liefert dekodierten Text (ohne BOM), nicht die Bytes der Datei; keine Ersatzprüfsumme */
  const err = e.err.concat(archiv.map(function (n) { return { t: 'sha256sum: ' + n + ': Operation not supported (archive files are delivered as decoded text)', d: null }; }));
  return { code: e.code || (archiv.length ? 1 : 0), aus: rStrom(aus), err: err };
}

/* ---------- bestehende Befehle als Stufen ---------- */
function rCtx(op, args) {
  const t = TERMINAL_ZUSTAND;
  return { args: args, arg: terminalArgText(args), cwd: terminalArbeitsverzeichnis(), env: t.oldpwd ? { OLDPWD: t.oldpwd } : {}, fs: op.fs };
}
function rAusAlt(res) {
  /* Ergebnis der Befehlsfunktionen { stdout, stderr, schutzBloecke | schutzZeilen, archivListe } als Strom */
  const aus = [];
  (res.stdout || []).forEach(function (block, i) {
    const zeilen = String(block).split('\n');
    const b = res.schutzBloecke && res.schutzBloecke[i];
    zeilen.forEach(function (z, j) {
      let d = b && b.intelZeilen ? b.intelZeilen[j] || null : res.schutzZeilen && res.schutzZeilen[i] ? res.schutzZeilen[i] : null;
      if (res.archivListe) {
        const name = terminalListenName(z);
        if (name && terminalArchivNameZiel(name)) d = rVereinigung(d, [{ art: 'archivname', name: name }]);
      }
      aus.push({ t: z, d: d && d.length ? d : null });
    });
  });
  return aus;
}
async function rAltStufe(op, befehl, args, stdin, ctx) {
  if (befehl === 'echo') return { code: 0, aus: rStrom([{ t: args.join(' '), d: null }]), err: [] };
  if (befehl === 'pwd') { const r = terminalBefehlPwd(rCtx(op, args)); return { code: r.code, aus: rStrom(rAusAlt(r)), err: (r.stderr || []).map(function (t) { return { t: t, d: null }; }) }; }
  if (befehl === 'ls') {
    const r = await terminalBefehlLs(rCtx(op, args));
    rPruefen(op);
    const aus = rAusAlt(r);
    if (r.archivListe && aus.some(function (z) { return terminalArchivNameZiel(terminalListenName(z.t)); })) op.archivSchutz = true;
    aus.forEach(function (z) { z.d = rBinden(op, z.d); op.alles.add(z.d); });
    return { code: r.code, aus: rStrom(aus.filter(function (z) { return z.t !== '' || !r.stdout.length; })), err: (r.stderr || []).map(function (t) { return { t: t, d: null }; }) };
  }
  /* cat, head, tail */
  const pa = terminalLeserArgs(befehl, args);
  if (pa.fehler) return { code: pa.fehler.code, aus: rStrom([]), err: pa.fehler.stderr.map(function (t) { return { t: t, d: null }; }) };
  if (!pa.namen.length || (pa.namen.length === 1 && pa.namen[0] === '-')) {
    let z = stdin.zeilen;
    if (befehl === 'head') z = z.slice(0, pa.n);
    if (befehl === 'tail') z = pa.n === 0 ? [] : z.slice(-pa.n);
    return { code: 0, aus: rStrom(z, stdin.offen && z.length > 0 && (befehl !== 'head' || z.length === stdin.zeilen.length)), err: [] };
  }
  /* Mit Dateioperanden: dieselben Eingaben wie wc/sort (Resolver mit Zwischenordnern, Links in /intel, Bindung, gezählte Lesebytes) */
  const e = await rEingaben(op, befehl, pa.namen, stdin, ctx);
  const gut = e.ein.filter(function (x) { return !x.fehlt; }), mehrere = pa.namen.length > 1;
  const aus = [];
  let offen = false;
  gut.forEach(function (x, i) {
    let z = x.strom.zeilen;
    if (befehl === 'head') z = z.slice(0, pa.n);
    if (befehl === 'tail') z = pa.n === 0 ? [] : z.slice(-pa.n);
    if (befehl !== 'cat' && mehrere) { if (i) aus.push({ t: '', d: null }); aus.push({ t: '==> ' + x.name + ' <==', d: null }); offen = false; }
    z.forEach(function (zeile, j) {
      if (j === 0 && offen && aus.length) { const v = aus[aus.length - 1]; aus[aus.length - 1] = { t: v.t + zeile.t, d: rVereinigung(v.d, zeile.d) }; }
      else aus.push(zeile);
    });
    const letzteGewaehlt = befehl !== 'head' || z.length === x.strom.zeilen.length;
    offen = z.length ? x.strom.offen && letzteGewaehlt : offen;
  });
  return { code: e.code, aus: rStrom(aus, offen), err: e.err };
}
const R_STUFEN = { grep: rGrep, find: rFind, wc: rWc, sort: rSort, uniq: rUniq, sha256sum: rSha256 };

/* ---------- Ausführung ---------- */
/* Eine Pipeline (oder ein einzelner eigener Befehl) mit optionaler abschließender Umleitung. stdin der ersten Stufe ist leer (wie </dev/null):
   das Terminal kennt keine interaktive Standardeingabe. Rückgabewert der letzten Stufe (kein pipefail); Grenze oder Abbruch: keine Ausgabe. */
async function terminalRechercheAusfuehren(stufen, um) {
  const t = TERMINAL_ZUSTAND;
  if (stufen.length > RECHERCHE_GRENZE.stufen) { terminalAusgabe('terminal: pipelines are limited to ' + RECHERCHE_GRENZE.stufen + ' commands'); return 2; }
  for (const w of stufen) {
    if (stufen.length > 1 && !RECHERCHE_PIPE.has(w[0])) { terminalAusgabe('terminal: ' + w[0] + ': not supported in a pipeline'); return 2; }
  }
  if (t.dateiLaeuft) { terminalAusgabe('Datenbankanfrage läuft bereits'); return 1; }
  /* Ziel der Umleitung vor jeder Ausführung prüfen (kein Anlegen, keine Änderung) */
  let zielSeg = null;
  const pctx = { fs: TERMINAL_FS }, uopt = { fehltVerzeichnis: 'EISDIR' };
  if (um) {
    if (!um.ziel) { terminalAusgabe('bash: : No such file or directory'); return 1; }
    zielSeg = await terminalSegPruefen(pctx, terminalShellPfad(um.ziel), uopt);
    if (!zielSeg) { terminalAusgabe('bash: ' + um.ziel + ': ' + terminalDateiFehlerText(pctx.segFehler)); return 1; }
  }
  t.dateiLaeuft = true;
  const op = rOperation(zielSeg, um && um.art);
  let strom = rStrom([]), code = 0;
  const fehler = [];
  try {
    for (const w of stufen) {
      op.stufe = (op.stufe || 0) + 1;
      const befehl = w[0], args = w.slice(1), ctx = { cwd: terminalArbeitsverzeichnis() };
      const r = R_STUFEN[befehl] ? await R_STUFEN[befehl](op, args, strom, ctx) : await rAltStufe(op, befehl, args, strom, ctx);
      rPruefen(op);
      const letzte = w === stufen[stufen.length - 1];
      r.err.forEach(function (z) { z.letzte = letzte; });
      for (const z of r.err) fehler.push(z);
      code = r.code;
      /* Übergabe an die nächste Stufe: inzwischen gesperrte Zeilen fallen weg; Größe begrenzt */
      strom = rStrom(r.aus.zeilen.filter(function (z) { return !rGesperrt(z.d); }), r.aus.offen);
      rPuffer(strom);
      await rTakt(op);
    }
  } catch (e) {
    t.dateiLaeuft = false;
    if (!(e instanceof RechercheAbbruch)) { if (t.version === op.version) terminalAusgabe('Dateioperation fehlgeschlagen'); return 1; }
    if (e.meldung === null) return t.version === op.version && op.kette ? op.kette.code || 130 : 1;
    if (t.version === op.version) terminalAusgabe(stufen[stufen.length - 1][0] + ': ' + e.meldung);
    return 2;
  }
  t.dateiLaeuft = false;
  if (t.version !== op.version) return 1;
  /* Letzte Prüfung unmittelbar vor der Ausgabe bzw. dem Schreiben */
  const sichtbar = function (z) { return !rGesperrt(z.d); };
  const err = fehler.filter(sichtbar), aus = strom.zeilen.filter(sichtbar);
  const zeigen = function (liste) {
    if (liste.length) terminalAusgabe(liste.map(function (z) { return z.t; }), { jeEintrag: liste.map(function (z) { return z.d ? { intel: z.d } : null; }) });
  };
  if (!um) {
    /* Meldungen früherer Stufen zuerst; die der letzten Stufe mit ihrer Ausgabe in Entstehungsreihenfolge, soweit nummeriert */
    const letzte = err.filter(function (z) { return z.letzte; }), vorher = err.filter(function (z) { return !z.letzte; });
    const nummeriert = letzte.concat(aus).every(function (z) { return z.n && z.stufe === op.stufe; });   /* nur selbst erzeugte Zeilen der letzten Stufe */
    zeigen(vorher.concat(nummeriert ? letzte.concat(aus).sort(function (a, b) { return a.n - b.n; }) : letzte.concat(aus)));
    return code;
  }
  zeigen(err);
  /* E6 über die ganze Operation: /intel, /exports oder geschützte Archivnamen durchlaufen (auch ohne Treffer, auch nur Zahlen oder Hashes) */
  const geschuetzt = op.herkunft.has('intel') || op.herkunft.has('exporte') || op.archivSchutz || strom.zeilen.some(function (z) { return z.d; });
  if (geschuetzt) { terminalAusgabe('bash: ' + stufen[0][0] + ': Operation not permitted'); return 1; }
  if (!(await terminalSegPruefen(pctx, zielSeg, uopt))) { if (t.version === op.version) terminalAusgabe('bash: ' + um.ziel + ': ' + terminalDateiFehlerText(pctx.segFehler)); return 1; }
  if (t.version !== op.version) return 1;
  const w = await TERMINAL_FS.schreiben(zielSeg, rText(strom), { anhaengen: um.art === '>>' });
  if (t.version !== op.version) return 1;
  if (w.fehler) {
    terminalAusgabe(w.fehler === 'ENOSPC' || w.fehler === 'EFBIG' ? 'bash: ' + stufen[stufen.length - 1][0] + ': write error: ' + terminalDateiFehlerText(w.fehler) : 'bash: ' + um.ziel + ': ' + terminalDateiFehlerText(w.fehler));
    return 1;
  }
  return code;
}
