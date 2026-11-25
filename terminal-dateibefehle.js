/* Paket 1 (Phase 6b): Dateibefehle auf dem persistenten VFS, Umleitung, Editor und Sicherung des Heimverzeichnisses.
   Architektur: docs/terminal-dateisystem-architektur.md. Klassisches Skript; wird nach terminal-vfs.js und vor profil-modul.js geladen und
   enthält nur Funktionsdeklarationen (Aufrufe erfolgen erst zur Laufzeit; Hilfsfunktionen aus profil-modul.js werden lazy verwendet).
   Befehlsfunktionen erhalten { args, arg, cwd, env, fs } und liefern { code, stdout, stderr [, text] }, wie terminalBefehlLauf es verlangt.
   Meldungen folgen GNU coreutils 9.4 (Namen in einfachen Anführungszeichen mit Shell-Maskierung); Abweichungen stehen in docs/terminal.md. */

function terminalGnuTry(befehl) { return "Try '" + befehl + " --help' for more information."; }
/* Optionen wie getopt_long mit Umstellung: Kurzoptionen (Zeichenfolge), Langoptionen (Name -> Kurzzeichen); "--" beendet die Optionen,
   "-" ist Operand. Unbekanntes ergibt die Originalmeldung von coreutils (Rückgabewert 1). */
function terminalGnuOptionen(befehl, args, kurz, lang) {
  const opt = new Set(), operanden = [];
  let ende = false;
  for (const a of args) {
    if (ende || a === '-' || a[0] !== '-') { operanden.push(a); continue; }
    if (a === '--') { ende = true; continue; }
    if (a.startsWith('--')) {
      const n = lang[a.slice(2)];
      if (!n) return { fehler: { code: 1, stdout: [], stderr: [befehl + ": unrecognized option '" + a + "'", terminalGnuTry(befehl)] } };
      opt.add(n);
      continue;
    }
    for (const c of Array.from(a).slice(1)) {
      if (!kurz.includes(c)) return { fehler: { code: 1, stdout: [], stderr: [befehl + ": invalid option -- '" + c + "'", terminalGnuTry(befehl)] } };
      opt.add(c);
    }
  }
  return { opt: opt, operanden: operanden };
}
function terminalDateiFehlerText(f) { return typeof TERMINAL_VFS !== 'undefined' ? TERMINAL_VFS.fehlerText(f) : String(f); }
function terminalDateiMeldung(befehl, teil, name, f) { return befehl + ': ' + teil + terminalLsQuote(name) + ': ' + terminalDateiFehlerText(f); }
function terminalBasisname(name) { const t = String(name).replace(/\/+$/, '').split('/'); return t[t.length - 1]; }
function terminalSegText(seg) { return '/' + seg.join('/'); }
/* Pfadprüfung vor jeder Dateioperation (Review #137): Zwischenverzeichnisse vor ".." müssen existieren und Verzeichnisse sein; eine Eingabe, die
   ein Verzeichnis verlangt ("x/", "x/."), trifft keine gewöhnliche Datei (ENOTDIR) und legt keine an (opt.fehltVerzeichnis, z. B. EISDIR
   für touch und Umleitung); "." oder ".." als letzte Komponente ist für entfernende Befehle unzulässig (opt.destruktiv: EINVAL).
   Für VFS-Pfade mit solchen Prüfungen wird die Generation VOR der Prüfung gebunden (seg.bindung); die Änderung gilt nur in dieser Generation
   (terminalFsSchreibOp), ein dazwischen änderndes Fenster führt zu EBUSY. Wiederholter Aufruf mit derselben Segmentliste bindet neu.
   null bei Fehler, der Kürzel steht dann in ctx.segFehler (Standard EACCES für unzulässige Zeichen). */
async function terminalSegPruefen(ctx, seg, opt) {
  opt = opt || {};
  ctx.segFehler = 'EACCES';
  if (!seg) return null;
  const zwischen = seg.zwischen || [];
  let bindung = null;
  if ((zwischen.length || seg.endeVerzeichnis) && TERMINAL_VFS.zugehoerig(seg)) {
    await terminalVfsBereit();
    const g = await TERMINAL_VFS.generation();
    if (g.fehler) { ctx.segFehler = g.fehler; return null; }
    bindung = { gen: g.gen };
  }
  if (seg.endePunkt && opt.destruktiv) { ctx.segFehler = 'EINVAL'; return null; }
  for (const p of zwischen) {
    const st = await ctx.fs.stat(p, { pruefen: true });
    if (st.fehler) { ctx.segFehler = st.fehler === 'Datei oder Ordner nicht gefunden' ? 'ENOENT' : st.fehler; return null; }
    if (st.typ === 'file') { ctx.segFehler = 'ENOTDIR'; return null; }
  }
  if (seg.endeVerzeichnis && seg.length) {
    const st = await ctx.fs.stat(seg, { pruefen: true });
    if (!st.fehler && st.typ === 'file') { ctx.segFehler = 'ENOTDIR'; return null; }
    if ((st.fehler === 'ENOENT' || st.fehler === 'Datei oder Ordner nicht gefunden') && opt.fehltVerzeichnis) { ctx.segFehler = opt.fehltVerzeichnis; return null; }
  }
  Object.defineProperty(seg, 'bindung', { value: bindung, configurable: true, writable: true });
  return seg;
}
/* Kind eines geprüften Verzeichnispfads (cp/mv in ein Zielverzeichnis): teilt die Bindung des Verzeichnisses */
function terminalSegKind(seg, name) {
  const kind = seg.concat(name);
  Object.defineProperty(kind, 'bindung', { value: seg.bindung || null, configurable: true, writable: true });
  return kind;
}
async function terminalDateiSeg(ctx, text, opt) { return terminalSegPruefen(ctx, await ctx.fs.resolve(text, { cwd: ctx.cwd }), opt); }
/* Gibt es das Ziel? { typ } oder { fehler } */
async function terminalDateiStat(ctx, seg) {
  const st = await ctx.fs.stat(seg, { pruefen: true });
  return st.fehler === 'Datei oder Ordner nicht gefunden' ? { fehler: 'ENOENT' } : st;
}

async function terminalBefehlMkdir(ctx) {
  const z = terminalGnuOptionen('mkdir', ctx.args, 'p', { parents: 'p' });
  if (z.fehler) return z.fehler;
  if (!z.operanden.length) return { code: 1, stdout: [], stderr: ['mkdir: missing operand', terminalGnuTry('mkdir')] };
  const fehler = [];
  for (const name of z.operanden) {
    /* mkdir -p: Zwischenverzeichnisse vor ".." werden zuerst angelegt ("neu/../b" erzeugt neu und b, wie bash) */
    if (z.opt.has('p')) {
      const roh = await ctx.fs.resolve(name, { cwd: ctx.cwd });
      let ok = true;
      for (const pfad of (roh && roh.zwischen) || []) {
        const r0 = await ctx.fs.mkdir(pfad, { eltern: true });
        if (r0.fehler) { fehler.push(terminalDateiMeldung('mkdir', 'cannot create directory ', name, r0.fehler)); ok = false; break; }
      }
      if (!ok) continue;
    }
    const seg = await terminalDateiSeg(ctx, name);
    if (!seg) { fehler.push(terminalDateiMeldung('mkdir', 'cannot create directory ', name, ctx.segFehler)); continue; }
    const r = await ctx.fs.mkdir(seg, { eltern: z.opt.has('p') });
    if (r.fehler) fehler.push(terminalDateiMeldung('mkdir', 'cannot create directory ', name, r.fehler));
  }
  return { code: fehler.length ? 1 : 0, stdout: [], stderr: fehler };
}
async function terminalBefehlTouch(ctx) {
  const z = terminalGnuOptionen('touch', ctx.args, '', {});
  if (z.fehler) return z.fehler;
  if (!z.operanden.length) return { code: 1, stdout: [], stderr: ['touch: missing file operand', terminalGnuTry('touch')] };
  const fehler = [];
  for (const name of z.operanden) {
    const seg = await terminalDateiSeg(ctx, name, { fehltVerzeichnis: 'EISDIR' });
    const r = seg ? await ctx.fs.schreiben(seg, '', { nurAnlegen: true }) : { fehler: ctx.segFehler };
    if (r.fehler) fehler.push(terminalDateiMeldung('touch', 'cannot touch ', name, r.fehler));
  }
  return { code: fehler.length ? 1 : 0, stdout: [], stderr: fehler };
}
async function terminalBefehlRmdir(ctx) {
  const z = terminalGnuOptionen('rmdir', ctx.args, '', {});
  if (z.fehler) return z.fehler;
  if (!z.operanden.length) return { code: 1, stdout: [], stderr: ['rmdir: missing operand', terminalGnuTry('rmdir')] };
  const fehler = [];
  for (const name of z.operanden) {
    const seg = await terminalDateiSeg(ctx, name, { destruktiv: true });
    const r = seg ? await ctx.fs.entfernen(seg, { nurVerzeichnis: true }) : { fehler: ctx.segFehler };
    if (r.fehler) fehler.push(terminalDateiMeldung('rmdir', 'failed to remove ', name, r.fehler));
  }
  return { code: fehler.length ? 1 : 0, stdout: [], stderr: fehler };
}
async function terminalBefehlRm(ctx) {
  const z = terminalGnuOptionen('rm', ctx.args, 'rRf', { recursive: 'r', force: 'f' });
  if (z.fehler) return z.fehler;
  const rek = z.opt.has('r') || z.opt.has('R'), ohneFehler = z.opt.has('f');
  if (!z.operanden.length) return ohneFehler ? { code: 0, stdout: [], stderr: [] } : { code: 1, stdout: [], stderr: ['rm: missing operand', terminalGnuTry('rm')] };
  const fehler = [];
  for (const name of z.operanden) {
    const basis = terminalBasisname(name);
    if (basis === '.' || basis === '..') { fehler.push("rm: refusing to remove '.' or '..' directory: skipping " + terminalLsQuote(name)); continue; }
    const seg = await terminalDateiSeg(ctx, name, { destruktiv: true });
    if (!seg) { fehler.push(terminalDateiMeldung('rm', 'cannot remove ', name, ctx.segFehler)); continue; }
    if (rek && !seg.length) { fehler.push("rm: it is dangerous to operate recursively on '/'", 'rm: use --no-preserve-root to override this failsafe'); continue; }
    const st = await terminalDateiStat(ctx, seg);
    if (st.fehler) { if (!(ohneFehler && st.fehler === 'ENOENT')) fehler.push(terminalDateiMeldung('rm', 'cannot remove ', name, st.fehler)); continue; }
    if (st.typ === 'dir' && !rek) { fehler.push(terminalDateiMeldung('rm', 'cannot remove ', name, 'EISDIR')); continue; }
    const r = await ctx.fs.entfernen(seg, { rekursiv: rek, nurDatei: !rek });
    if (r.fehler) fehler.push(terminalDateiMeldung('rm', 'cannot remove ', name, r.fehler));
  }
  return { code: fehler.length ? 1 : 0, stdout: [], stderr: fehler };
}
/* Zielauflösung für cp und mv: bei mehreren Quellen oder vorhandenem Zielverzeichnis landet jede Quelle unter ihrem Namen im Ziel */
async function terminalZielPlan(ctx, befehl, quellen, zielName) {
  const zielSeg = await terminalDateiSeg(ctx, zielName, { fehltVerzeichnis: 'ENOTDIR' });
  if (!zielSeg) return { fehler: [befehl === 'mv' && quellen.length === 1 ? 'mv: cannot move ' + terminalLsQuote(quellen[0]) + ' to ' + terminalLsQuote(zielName) + ': ' + terminalDateiFehlerText(ctx.segFehler)
    : befehl + ': cannot create ' + (befehl === 'cp' ? 'regular file ' : '') + terminalLsQuote(zielName) + ': ' + terminalDateiFehlerText(ctx.segFehler)] };
  const st = zielSeg.length ? await terminalDateiStat(ctx, zielSeg) : { typ: 'dir' };
  const istDir = !st.fehler && st.typ === 'dir';
  if (quellen.length > 1 && !istDir) return { fehler: [befehl + ': target ' + terminalLsQuote(zielName) + ': ' + (st.fehler === 'ENOENT' ? 'No such file or directory' : 'Not a directory')] };
  return { zielSeg: zielSeg, istDir: istDir };
}
async function terminalBefehlCp(ctx) {
  const z = terminalGnuOptionen('cp', ctx.args, 'rRf', { recursive: 'r', force: 'f' });
  if (z.fehler) return z.fehler;
  const rek = z.opt.has('r') || z.opt.has('R');
  if (!z.operanden.length) return { code: 1, stdout: [], stderr: ['cp: missing file operand', terminalGnuTry('cp')] };
  if (z.operanden.length === 1) return { code: 1, stdout: [], stderr: ['cp: missing destination file operand after ' + terminalLsQuote(z.operanden[0]), terminalGnuTry('cp')] };
  const quellen = z.operanden.slice(0, -1), zielName = z.operanden.at(-1), plan = await terminalZielPlan(ctx, 'cp', quellen, zielName);
  if (plan.fehler) return { code: 1, stdout: [], stderr: plan.fehler };
  const fehler = [];
  for (const name of quellen) {
    const seg = await terminalDateiSeg(ctx, name);
    if (!seg) { fehler.push('cp: cannot stat ' + terminalLsQuote(name) + ': ' + terminalDateiFehlerText(ctx.segFehler)); continue; }
    const basis = terminalBasisname(name) || '';
    /* E6: Inhalte aus /intel werden vorerst nicht ins VFS übernommen (späteres Export-/Herkunftsmodell) */
    if (seg[0] === 'intel') { fehler.push('cp: cannot copy ' + terminalLsQuote(name) + ': Operation not permitted'); continue; }
    /* Schutz (Architektur 11): Exportobjekte der Anwendung werden nie kopiert; die Prüfung steht vor jedem Lesen */
    if (seg[0] === TERMINAL_DB && terminalArchivNameZiel(seg.at(-1))) { fehler.push('cp: cannot open ' + terminalLsQuote(name) + ' for reading: Permission denied'); continue; }
    const st = await terminalDateiStat(ctx, seg);
    if (st.fehler) { fehler.push('cp: cannot stat ' + terminalLsQuote(name) + ': ' + terminalDateiFehlerText(st.fehler === 'Datei oder Ordner nicht gefunden' ? 'ENOENT' : st.fehler)); continue; }
    if (st.typ === 'dir' && !rek) { fehler.push('cp: -r not specified; omitting directory ' + terminalLsQuote(name)); continue; }
    const ziel = plan.istDir ? terminalSegKind(plan.zielSeg, basis) : plan.zielSeg;
    if (ziel.join('/') === seg.join('/')) { fehler.push('cp: ' + terminalLsQuote(name) + ' and ' + terminalLsQuote(zielName) + ' are the same file'); continue; }
    let r;
    if (TERMINAL_VFS.zugehoerig(seg) && TERMINAL_VFS.zugehoerig(ziel)) r = await ctx.fs.kopieren(seg, ziel, { rekursiv: rek });
    else if (st.typ === 'dir') r = { fehler: 'ENOSYS' };
    else {
      const l = await ctx.fs.readFile(seg);
      if (l.fehler) r = { fehler: l.fehler === 'Datei oder Ordner nicht gefunden' ? 'ENOENT' : l.fehler };
      else if (seg[0] === TERMINAL_DB && !ctx.fs.sichtbar(seg)) r = { fehler: 'EACCES' };   /* Sperre während des Lesens */
      else r = await ctx.fs.schreiben(ziel, l.text, {});
    }
    const zielText = plan.istDir ? zielName.replace(/\/+$/, '') + '/' + basis : zielName;
    if (r.fehler === 'EINVAL' && st.typ === 'dir') fehler.push('cp: cannot copy a directory, ' + terminalLsQuote(name) + ', into itself, ' + terminalLsQuote(zielText));
    else if (r.fehler === 'ENOSYS') fehler.push('cp: cannot copy ' + terminalLsQuote(name) + ': Operation not supported');
    else if (r.fehler) fehler.push('cp: cannot create ' + (st.typ === 'dir' ? 'directory ' : 'regular file ') + terminalLsQuote(zielText) + ': ' + terminalDateiFehlerText(r.fehler));
  }
  return { code: fehler.length ? 1 : 0, stdout: [], stderr: fehler };
}
async function terminalBefehlMv(ctx) {
  const z = terminalGnuOptionen('mv', ctx.args, 'f', { force: 'f' });
  if (z.fehler) return z.fehler;
  if (!z.operanden.length) return { code: 1, stdout: [], stderr: ['mv: missing file operand', terminalGnuTry('mv')] };
  if (z.operanden.length === 1) return { code: 1, stdout: [], stderr: ['mv: missing destination file operand after ' + terminalLsQuote(z.operanden[0]), terminalGnuTry('mv')] };
  const quellen = z.operanden.slice(0, -1), zielName = z.operanden.at(-1), plan = await terminalZielPlan(ctx, 'mv', quellen, zielName);
  if (plan.fehler) return { code: 1, stdout: [], stderr: plan.fehler };
  const fehler = [];
  for (const name of quellen) {
    const seg = await terminalDateiSeg(ctx, name, { destruktiv: true });
    if (!seg) { fehler.push('mv: cannot stat ' + terminalLsQuote(name) + ': ' + terminalDateiFehlerText(ctx.segFehler)); continue; }
    const st = await terminalDateiStat(ctx, seg);
    if (st.fehler) { fehler.push('mv: cannot stat ' + terminalLsQuote(name) + ': ' + terminalDateiFehlerText(st.fehler === 'Datei oder Ordner nicht gefunden' ? 'ENOENT' : st.fehler)); continue; }
    const ziel = plan.istDir ? terminalSegKind(plan.zielSeg, terminalBasisname(name)) : plan.zielSeg;
    if (ziel.join('/') === seg.join('/')) { fehler.push('mv: ' + terminalLsQuote(name) + ' and ' + terminalLsQuote(zielName) + ' are the same file'); continue; }
    const r = await ctx.fs.umbenennen(seg, ziel);
    if (!r.fehler) continue;
    const zielText = plan.istDir ? zielName.replace(/\/+$/, '') + '/' + terminalBasisname(name) : zielName;
    if (r.fehler === 'EINVAL') fehler.push('mv: cannot move ' + terminalLsQuote(name) + ' to a subdirectory of itself, ' + terminalLsQuote(zielText));
    else if (r.fehler === 'ENOTDIR' && st.typ === 'dir') fehler.push('mv: cannot overwrite non-directory ' + terminalLsQuote(zielText) + ' with directory ' + terminalLsQuote(name));
    else if (r.fehler === 'EISDIR') fehler.push('mv: cannot overwrite directory ' + terminalLsQuote(zielText) + ' with non-directory');
    else fehler.push('mv: cannot move ' + terminalLsQuote(name) + ' to ' + terminalLsQuote(zielText) + ': ' + terminalDateiFehlerText(r.fehler));
  }
  return { code: fehler.length ? 1 : 0, stdout: [], stderr: fehler };
}

/* cat, head, tail auf TERMINAL_FS (VFS-Pfade und Umleitung). head/tail: -n N, -nN. Mehrere Dateien: Kopfzeilen "==> name <==" wie GNU. */
/* Argumente von cat/head/tail: { n, namen } oder { fehler: Befehlsergebnis }; cat nimmt jedes Argument als Dateinamen.
   Auch die Vorprüfung der Umleitung (terminalLiestIntel) nutzt diesen Parser, damit sie dieselben Operanden sieht wie der Befehl. */
function terminalLeserArgs(befehl, args) {
  let n = 10, i = 0;
  const namen = [];
  if (befehl !== 'cat') {
    for (; i < args.length; i++) {
      const a = args[i];
      if (a === '--') { i++; break; }
      if (a === '-n' && i + 1 < args.length) { n = Number(args[++i]); continue; }
      if (/^-n\d+$/.test(a)) { n = Number(a.slice(2)); continue; }
      if (a.length > 1 && a[0] === '-' && a !== '-') return { fehler: { code: 1, stdout: [], stderr: [befehl + ": invalid option -- '" + a.replace(/^-+/, '')[0] + "'", terminalGnuTry(befehl)] } };
      break;
    }
    if (!Number.isInteger(n) || n < 0) return { fehler: { code: 1, stdout: [], stderr: [befehl + ': invalid number of lines: ' + terminalLsQuote(String(n))] } };
  }
  for (; i < args.length; i++) namen.push(args[i]);
  return { n: n, namen: namen };
}
function terminalLeser(befehl) {
  return async function (ctx) {
    const pa = terminalLeserArgs(befehl, ctx.args);
    if (pa.fehler) return pa.fehler;
    const n = pa.n, namen = pa.namen;
    if (!namen.length) return { code: 1, stdout: [], stderr: [befehl + ': missing file operand'] };
    const aus = [], fehler = [], stuecke = [];
    let roh = '', erst = true, code = 0, intel = false;
    for (const name of namen) {
      const seg = await terminalDateiSeg(ctx, name);
      let r;
      if (!seg) r = { fehler: ctx.segFehler };
      else if (seg[0] === TERMINAL_DB && terminalArchivNameZiel(seg.at(-1))) r = { fehler: 'EACCES' };   /* Exportobjekte nie über diesen Weg (Architektur 11) */
      else {
        r = await ctx.fs.readFile(seg);
        if (!r.fehler && seg[0] === TERMINAL_DB && !ctx.fs.sichtbar(seg)) r = { fehler: 'EACCES' };
      }
      if (r.fehler) {
        const f = r.fehler === 'Datei oder Ordner nicht gefunden' ? 'ENOENT' : r.fehler;
        fehler.push(befehl + ': ' + name + ': ' + (f === 'ENOSYS' ? 'Operation not supported' : terminalDateiFehlerText(f)));
        code = 1;
        continue;
      }
      if (r.deps) intel = true;
      /* Abhängigkeiten je Zeile (/intel): zeilenDeps der Datei, sonst die Abhängigkeiten der ganzen Datei */
      /* Vereinigung: Abhängigkeiten der ganzen Datei und der einzelnen Zeile (eine leere Zeilenliste hebt die Dateiabhängigkeit nicht auf) */
      const depsVon = function (j) { const d = (r.deps || []).concat((r.zeilenDeps && r.zeilenDeps[j]) || []); return d.length ? d : null; };
      let text = r.text, zeilenDeps = text.split('\n').map(function (_, j) { return depsVon(j); });
      if (befehl !== 'cat') {
        const zeilen = text.split('\n');
        if (zeilen.at(-1) === '') zeilen.pop();
        const idx = zeilen.map(function (_, j) { return j; }), ausw = befehl === 'head' ? idx.slice(0, n) : n === 0 ? [] : idx.slice(-n);
        text = ausw.length ? ausw.map(function (j) { return zeilen[j]; }).join('\n') + (befehl === 'head' || text.endsWith('\n') ? '\n' : '') : '';
        zeilenDeps = ausw.map(depsVon).concat([null]);
        if (namen.length > 1) { const kopf = (erst ? '' : '\n') + '==> ' + name + ' <==\n'; stuecke.push({ text: kopf, deps: [] }); roh += kopf; }
      }
      erst = false;
      roh += text;
      stuecke.push({ text: text, deps: zeilenDeps });
    }
    if (roh) { const z = roh.split('\n'); if (z.at(-1) === '') z.pop(); aus.push.apply(aus, z); }
    let schutzZeilen = null;
    if (intel) {
      /* Zeilen der Ausgabe den Stücken zuordnen (auch wenn eine Datei ohne Zeilenende in die nächste übergeht) */
      const metas = [[]];
      stuecke.forEach(function (st) {
        st.text.split('\n').forEach(function (teil, k) {
          if (k > 0) metas.push([]);
          const d = st.deps && st.deps[k];
          if (d && (teil !== '' || k === 0)) metas[metas.length - 1] = metas[metas.length - 1].concat(d);
        });
      });
      schutzZeilen = aus.map(function (_, i) { return metas[i] && metas[i].length ? metas[i] : null; });
    }
    return { code: code, stdout: aus, stderr: fehler, text: roh, schutzZeilen: schutzZeilen };
  };
}

/* readlink (ohne Optionen): Ziel eines symbolischen Links; kein Link oder Fehler ergibt keine Ausgabe und Rückgabewert 1 (GNU ohne -v) */
async function terminalBefehlReadlink(ctx) {
  const z = terminalGnuOptionen('readlink', ctx.args, '', {});
  if (z.fehler) return z.fehler;
  if (!z.operanden.length) return { code: 1, stdout: [], stderr: ['readlink: missing operand', terminalGnuTry('readlink')] };
  const aus = [], schutz = [];
  let code = 0;
  for (const name of z.operanden) {
    const seg = await ctx.fs.resolve(name, { cwd: ctx.cwd });
    const r = seg ? await ctx.fs.readlink(seg) : { fehler: 'EACCES' };
    if (r.ziel) { aus.push(r.ziel); schutz.push(r.deps && r.deps.length ? r.deps : null); } else code = 1;
  }
  return { code: code, stdout: aus, stderr: [], schutzZeilen: schutz.some(Boolean) ? schutz : null };
}

/* ---- Umleitung ---- */
const TERMINAL_UMLEITBAR = new Set(['echo', 'pwd', 'ls', 'cat', 'head', 'tail', 'date', 'whoami', 'uname', 'hostname', 'true', 'false', 'touch', 'mkdir', 'rm', 'rmdir', 'cp', 'mv']);
/* Umleitung mit gepufferter Ausgabe nur für lesende, seiteneffektfreie Befehle (Review #138): schreibende Befehle (touch, mkdir, rm, rmdir,
   cp, mv) werden mit Umleitung vor jeder Ausführung abgewiesen; ohne Umleitung arbeiten sie unverändert */
const TERMINAL_UMLEITBAR_SCHREIBEND = new Set(['touch', 'mkdir', 'rm', 'rmdir', 'cp', 'mv']);
function terminalBefehlFn(befehl) {
  return { pwd: terminalBefehlPwd, ls: terminalBefehlLs, cat: terminalLeser('cat'), head: terminalLeser('head'), tail: terminalLeser('tail'),
    touch: terminalBefehlTouch, mkdir: terminalBefehlMkdir, rmdir: terminalBefehlRmdir, rm: terminalBefehlRm, cp: terminalBefehlCp, mv: terminalBefehlMv }[befehl] || null;
}
/* Befehle, die auch ohne Umleitung über die ctx-Schnittstelle laufen (cat, head, tail nur bei VFS-Pfaden, siehe terminalDateiAusfuehren) */
function terminalBefehlDirekt(befehl) {
  return { touch: terminalBefehlTouch, mkdir: terminalBefehlMkdir, rmdir: terminalBefehlRmdir, rm: terminalBefehlRm, cp: terminalBefehlCp, mv: terminalBefehlMv,
    nano: terminalBefehlNano, readlink: terminalBefehlReadlink, 'home-backup': terminalBefehlHomeBackup, 'home-restore': terminalBefehlHomeRestore, 'home-import': terminalBefehlHomeImport, 'home-export': terminalBefehlHomeExport }[befehl] || null;
}
/* Das Ziel wird vor dem Befehl geöffnet (angelegt, bei ">" geleert), auch wenn der Befehl scheitert, wie in bash. stdout geht nur in die Datei,
   stderr bleibt auf dem Bildschirm; Rückgabewert ist der des Befehls, bei Schreibfehler 1. */
/* E6, Vorprüfung vor dem Öffnen der Zieldatei: liest der Befehl nach seinem eigenen Parser einen Operanden aus /intel (bei ls ohne Operand das
   Arbeitsverzeichnis)? Die Entscheidung über den Anbieter folgt der Pfadauflösung der Befehle (lexikalisch; nur /intel kennt Links). Die
   verbindliche Durchsetzung geschieht danach am tatsächlichen Lesepfad (terminalFsMitHerkunft). */
function terminalLiestIntel(befehl, args) {
  let ops;
  if (befehl === 'ls') { const z = terminalLsOptionen(args); if (z.fehler || z.hilfe) return false; ops = z.operanden.length ? z.operanden : ['.']; }
  else if (befehl === 'cat' || befehl === 'head' || befehl === 'tail') { const z = terminalLeserArgs(befehl, args); if (z.fehler) return false; ops = z.namen; }
  else return false;
  return ops.some(function (o) { const seg = terminalShellPfad(o); return !!seg && seg[0] === 'intel'; });
}
/* Dateischnittstelle mit Herkunftsaufzeichnung: merkt sich die Anbieter aller gelesenen Pfade (stat, readdir, readFile, readlink) und in
   opt.gelesen die mit readFile gelesenen Pfade. opt.intelSperren (Umleitung, E6): jeder Zugriff auf /intel wird aufgezeichnet und sofort
   verweigert (fail-closed), sodass keine /intel-Inhalte in die gepufferte Ausgabe gelangen. */
function terminalFsMitHerkunft(herkunft, opt) {
  opt = opt || {};
  const verweigert = { fehler: 'Operation not permitted' };
  const zugriff = function (seg, weiter) {
    if (seg) herkunft.add(terminalAnbieter(seg).name);
    if (seg && opt.intelSperren && terminalAnbieter(seg).name === 'intel') return Promise.resolve(verweigert);
    return weiter();
  };
  return Object.assign({}, TERMINAL_FS, {
    stat: function (seg, o) { return zugriff(seg, function () { return TERMINAL_FS.stat(seg, o); }); },
    readdir: function (seg, o) { return zugriff(seg, function () { return TERMINAL_FS.readdir(seg, o); }); },
    readFile: function (seg) { if (seg && opt.gelesen) opt.gelesen.push(seg.join('/')); return zugriff(seg, function () { return TERMINAL_FS.readFile(seg); }); },
    readlink: function (seg) { return zugriff(seg, function () { return TERMINAL_FS.readlink(seg); }); }
  });
}
async function terminalUmgeleitet(woerter, um, status) {
  const t = TERMINAL_ZUSTAND, version = t.version;
  const ziel = um.ziel;
  if (woerter.length && terminalLiestIntel(woerter[0], woerter.slice(1))) {
    terminalAusgabe('bash: ' + woerter[0] + ': Operation not permitted');   /* E6: keine dauerhafte Übernahme von /intel-Inhalten */
    return 1;
  }
  const zielSeg = ziel ? terminalShellPfad(ziel) : null;
  if (zielSeg && zielSeg[0] === 'intel' && um.art === '>>') return terminalIntelNotizUmleitung(woerter, um, zielSeg);
  const pctx = { fs: TERMINAL_FS }, uopt = { fehltVerzeichnis: 'EISDIR' }, seg = await terminalSegPruefen(pctx, terminalShellPfad(ziel), uopt);
  const f = function (kuerzel) { return 'bash: ' + ziel + ': ' + terminalDateiFehlerText(kuerzel); };
  if (!ziel) { terminalAusgabe('bash: : No such file or directory'); return 1; }
  if (t.version !== version) return 1;
  if (!seg) { terminalAusgabe(f(pctx.segFehler)); return 1; }
  /* Reihenfolge (Review #138, E6): erst den Befehl mit gepufferter Ausgabe ausführen und über die Herkunft entscheiden, danach die Zieldatei
     genau einmal über den abgesicherten Schreibpfad öffnen und schreiben. Bei Abweisung wird das Ziel nicht berührt (auch nicht angelegt).
     Abweichung von bash: das Ziel entsteht erst nach dem Befehl (eine Liste des Zielordners zeigt die neue Datei nicht); liest der Befehl
     das Ziel selbst, wird wie bei bash nichts aus ihm übernommen (">": Ziel danach leer; ">>": unverändert; cat meldet
     "input file is output file"). */
  /* Ein einziger abgesicherter VFS-Schreibvorgang nach der Herkunftsentscheidung (">": Inhalt ersetzen, ">>": anhängen bzw. anlegen), mit
     erneuter Pfadprüfung; scheitert er (z. B. Quote), bleibt der bisherige Inhalt erhalten (Transaktion des VFS) */
  const oeffnen = async function (text, befehlName) {
    if (!(await terminalSegPruefen(pctx, seg, uopt))) { if (t.version === version) terminalAusgabe(f(pctx.segFehler)); return false; }
    if (t.version !== version) return false;
    const w = await TERMINAL_FS.schreiben(seg, text, { anhaengen: um.art === '>>' });
    if (t.version !== version) return false;
    if (w.fehler) {
      terminalAusgabe(text && (w.fehler === 'ENOSPC' || w.fehler === 'EFBIG') ? 'bash: ' + befehlName + ': write error: ' + terminalDateiFehlerText(w.fehler) : f(w.fehler));
      return false;
    }
    return true;
  };
  if (!woerter.length) return (await oeffnen('')) ? 0 : 1;
  const befehl = woerter[0], args = woerter.slice(1);
  if (TERMINAL_UMLEITBAR_SCHREIBEND.has(befehl)) {
    terminalAusgabe('bash: ' + befehl + ': output redirection is not supported for commands that change files');   /* nichts ausgeführt, Ziel unberührt */
    return 1;
  }
  if (!TERMINAL_UMLEITBAR.has(befehl)) {
    if (!(await oeffnen(''))) return 1;   /* bash legt die Zieldatei an, bevor der Befehl scheitert */
    terminalAusgabe(terminalBefehlEintrag(befehl) ? 'bash: ' + befehl + ': output redirection is not supported for this command' : befehl + ': command not found');
    return terminalBefehlEintrag(befehl) ? 1 : 127;
  }
  if (woerter.some(function (w) { return befehl !== 'echo' && terminalArchivNameZiel(terminalBasisname(w)); })) {
    terminalAusgabe('bash: ' + befehl + ': Permission denied');   /* geschützte Exportobjekte nie in Dateien übernehmen (Architektur 11) */
    return 1;
  }
  let res;
  const gelesen = [];
  const einfach = { echo: function () { return [args.join(' ')]; }, whoami: function () { return [TERMINAL_BENUTZER]; }, uname: function () { return !args.length ? ['Linux'] : args.length === 1 && args[0] === '-a' ? [terminalUname()] : args.length === 1 && args[0] === '-n' ? [TERMINAL_SYS.hostname] : null; },
    hostname: function () { return args.length ? null : [TERMINAL_SYS.hostname]; },
    date: function () { return args.length ? null : [fmtZ(new Date())]; }, true: function () { return args.length ? null : []; }, false: function () { return args.length ? null : []; } };
  if (einfach[befehl]) {
    const zeilen = einfach[befehl]();
    if (zeilen === null) { terminalAusgabe('usage: ' + befehl); return 2; }
    res = { code: befehl === 'false' ? 1 : 0, stdout: zeilen, stderr: [] };
  } else {
    const fn = terminalBefehlFn(befehl);
    const env = t.oldpwd ? { OLDPWD: t.oldpwd } : {};
    const herkunft = new Set();
    res = await fn({ args: args, arg: terminalArgText(args), cwd: terminalArbeitsverzeichnis(), env: env, fs: terminalFsMitHerkunft(herkunft, { intelSperren: true, gelesen: gelesen }) });
    if (t.version !== version) return 1;
    if (res.cwd) { t.oldpwd = terminalArbeitsverzeichnis(); t.ort = res.cwd.ort; t.virtuellerOrt = res.cwd.virtuellerOrt; }
    /* E6 am tatsächlichen Lesepfad: jeder Zugriff auf /intel (auch nur die Prüfung eines Zwischenordners) führt zur Abweisung; das Ziel
       ist bis hierhin unberührt */
    if (herkunft.has('intel') || res.schutzBloecke || res.schutzZeilen) {
      if (t.version === version) terminalAusgabe('bash: ' + befehl + ': Operation not permitted');
      return 1;
    }
  }
  const selbst = gelesen.includes(seg.join('/'));
  if (selbst && befehl === 'cat') res.stderr = (res.stderr || []).concat(['cat: ' + ziel + ': input file is output file']);
  const fehlerZeilen = (res.stderr || []).filter(function (z) { return z !== ''; });
  if (fehlerZeilen.length) terminalAusgabe(fehlerZeilen);
  /* Archivlistung (ls): Namen der Exportobjekte (Lageblatt, Zone, Sichtung) gelangen nie in eine Datei, gleich ob gesperrt oder frei; so
     bleibt nach einer späteren Sperre nichts Unbereinigtes im VFS (Architektur 11). Übrige Einträge bleiben unverändert. */
  if (res.archivListe) {
    res.stdout = (res.stdout || []).map(function (z) { return String(z).split('\n').filter(function (l) { return !terminalArchivNameZiel(terminalListenName(l)); }).join('\n'); })
      .filter(function (z) { return z !== ''; });
    delete res.text;
  }
  const text = selbst ? '' : typeof res.text === 'string' ? res.text : (res.stdout || []).length ? res.stdout.join('\n') + '\n' : '';
  if (!(await oeffnen(text, befehl))) return 1;
  return selbst && befehl === 'cat' ? 1 : res.code;
}

/* Paket 2, Meilenstein 5 (E7): "befehl >> /intel/dossiers/<typ>/<id>/notes" hängt genau eine Dossiernotiz an, über dieselbe Anwendungsaktion wie
   die Oberfläche (DOSSIER_NOTIZ) mit dauerhaftem Erfolgsstatus (dossierNotizDauerhaft, index.html): erst nach geprüfter Speicherung gilt der
   Befehl als erfolgreich, sonst wird zurückgenommen und "Input/output error" gemeldet. Andere Ziele in /intel und ">" sind schreibgeschützt. */
async function terminalIntelNotizUmleitung(woerter, um, seg) {
  const t = TERMINAL_ZUSTAND, version = t.version, ziel = um.ziel;
  const f = function (k) { terminalAusgabe('bash: ' + ziel + ': ' + terminalDateiFehlerText(k)); return 1; };
  /* Ziel: echte Komponenten prüfen (fehlende Zwischenordner, "notes/", "notes/."), danach das Notizziel des Anbieters */
  const pctx = { fs: TERMINAL_FS }, zopt = { fehltVerzeichnis: 'ENOTDIR' };
  const zielPruefen = async function () {
    if (!(await terminalSegPruefen(pctx, seg, zopt))) return { fehler: pctx.segFehler };
    if (seg.endeVerzeichnis) return { fehler: 'ENOTDIR' };
    const nz = INTEL.notizZiel(seg.slice(1));
    if (nz.fehler) return { fehler: nz.fehler === 'Permission denied' ? 'EACCES' : nz.fehler };
    return nz.id ? { id: nz.id } : { fehler: 'EROFS' };
  };
  const z1 = await zielPruefen();
  if (z1.fehler) return f(z1.fehler);
  if (!woerter.length) return 0;
  const befehl = woerter[0], args = woerter.slice(1);
  /* Quellen: nur echo oder Textdateien aus dem VFS (cat/head/tail); keine Listen, keine Archiv- oder /intel-Inhalte */
  const nurQuellen = 'bash: ' + ziel + ': only echo or text files from /home and /tmp can be appended to notes';
  let res;
  if (befehl === 'echo') res = { code: 0, stdout: [args.join(' ')], stderr: [] };
  else if (befehl === 'cat' || befehl === 'head' || befehl === 'tail') {
    const herkunft = new Set(), env = t.oldpwd ? { OLDPWD: t.oldpwd } : {};
    res = await terminalBefehlFn(befehl)({ args: args, arg: terminalArgText(args), cwd: terminalArbeitsverzeichnis(), env: env, fs: terminalFsMitHerkunft(herkunft) });
    if (t.version !== version) return 1;
    if (Array.from(herkunft).some(function (a) { return a !== 'vfs'; }) || res.schutzZeilen) { terminalAusgabe(nurQuellen); return 1; }
  } else {
    terminalAusgabe(TERMINAL_UMLEITBAR.has(befehl) || terminalBefehlEintrag(befehl) ? nurQuellen : befehl + ': command not found');
    return TERMINAL_UMLEITBAR.has(befehl) || terminalBefehlEintrag(befehl) ? 1 : 127;
  }
  const fehlerZeilen = (res.stderr || []).filter(function (z) { return z !== ''; });
  if (fehlerZeilen.length) terminalAusgabe(fehlerZeilen);
  const text = (typeof res.text === 'string' ? res.text : (res.stdout || []).join('\n')).replace(/\n$/, '');
  if (!text.trim()) return res.code;
  /* nach dem asynchronen Lesen erneut: Ziel, Sperre, gleiches Dossier */
  const z2 = await zielPruefen();
  if (t.version !== version) return 1;
  if (z2.fehler) return f(z2.fehler);
  if (z2.id !== z1.id) return f('ENOENT');
  const r = dossierNotizDauerhaft(z1.id, text, 'Terminal');
  if (r.fehler) {
    if (r.inkonsistent) { terminalAusgabe('bash: ' + ziel + ': Input/output error (storage could not be restored; the saved state may be inconsistent)'); return 1; }
    return f(r.fehler);
  }
  return res.code;
}

/* ---- Editor (nano-ähnlich) ---- */
const TERMINAL_EDITOR_HILFE = ['^O Write Out', '^X Exit'];
async function terminalBefehlNano(ctx) {
  const t = TERMINAL_ZUSTAND;
  const z = terminalGnuOptionen('nano', ctx.args, '', {});
  if (z.fehler) return z.fehler;
  if (z.operanden.length !== 1) return { code: 1, stdout: [], stderr: ['nano: exactly one file name is required in this terminal (usage: nano <file>)'] };
  const name = z.operanden[0], seg = await terminalDateiSeg(ctx, name, { fehltVerzeichnis: 'EISDIR' });
  if (!seg || !seg.length) return { code: 1, stdout: [], stderr: ['nano: ' + name + ': ' + terminalDateiFehlerText(seg ? 'EACCES' : ctx.segFehler)] };
  if (seg[0] === TERMINAL_DB && terminalArchivNameZiel(seg.at(-1))) return { code: 1, stdout: [], stderr: ['nano: ' + name + ': Permission denied'] };
  if (seg[0] === 'intel') return { code: 1, stdout: [], stderr: ['nano: ' + name + ': Read-only file system'] };   /* /intel: kein Editor (E6, E7) */
  let text = '', neu = false;
  const st = await ctx.fs.stat(seg, { pruefen: true });
  if (st.fehler && st.fehler !== 'ENOENT') return { code: 1, stdout: [], stderr: ['nano: ' + name + ': ' + terminalDateiFehlerText(st.fehler)] };
  if (st.fehler) neu = true;
  else if (st.typ === 'dir') return { code: 1, stdout: [], stderr: ['nano: ' + name + ': Is a directory'] };
  else {
    const r = await ctx.fs.readFile(seg);
    if (r.fehler) return { code: 1, stdout: [], stderr: ['nano: ' + name + ': ' + (r.fehler === 'ENOSYS' ? 'Operation not supported' : terminalDateiFehlerText(r.fehler))] };
    if (seg[0] === TERMINAL_DB && !ctx.fs.sichtbar(seg)) return { code: 1, stdout: [], stderr: ['nano: ' + name + ': Permission denied'] };
    text = r.text;
  }
  return new Promise(function (fertig) {
    const kern = $('profil-terminal-kern');
    if (!kern) { fertig({ code: 1, stdout: [], stderr: ['nano: no terminal'] }); return; }
    const feld = h('textarea', { id: 'profil-terminal-editor-text', class: 'mono', spellcheck: 'false', autocomplete: 'off', 'aria-label': 'Editor: ' + name }),
      kopf = h('div', { class: 'mono editor-kopf' }), status = h('div', { class: 'mono editor-status', role: 'status' }),
      hilfe = h('div', { class: 'mono editor-hilfe' }, TERMINAL_EDITOR_HILFE.join('    ')),
      box = h('div', { id: 'profil-terminal-editor', class: 'editor' }, kopf, feld, status, hilfe);
    feld.value = text;
    let geaendert = false, frage = false, speichert = false;
    const zeigeKopf = function () { kopf.textContent = '  Shadow nano   File: ' + name + (geaendert ? '   Modified' : ''); };
    const meldung = function (s) { status.textContent = s ? '[ ' + s + ' ]' : ''; };
    const ende = function (code) {
      box.remove(); kern.classList.remove('editor-aktiv'); t.editor = null;
      const input = $('profil-terminal-eingabe');
      if (input) input.focus({ preventScroll: true });
      fertig({ code: code, stdout: [], stderr: [] });
    };
    /* version zählt Änderungen des Puffers; gespeichert wird der Stand beim Start. Wurde während des Schreibens weitergetippt, bleibt der
       Puffer "Modified" (kein stilles Verwerfen bei ^X). */
    let version = 0;
    const sichern = async function () {
      if (speichert) return false;
      speichert = true;
      const stand = version, text = feld.value;
      /* Pfad vor jedem Schreiben neu prüfen und binden (der Editor kann lange offen sein) */
      const pr = await terminalSegPruefen(ctx, seg, { fehltVerzeichnis: 'EISDIR' });
      const r = pr ? await ctx.fs.schreiben(seg, text, {}) : { fehler: ctx.segFehler };   /* ctx.fs: mit sudo die Systemverwaltung */
      speichert = false;
      if (r.fehler) { meldung('Error writing ' + name + ': ' + terminalDateiFehlerText(r.fehler)); return false; }
      neu = false;
      if (version === stand) geaendert = false;
      zeigeKopf();
      meldung('Wrote ' + (text ? text.split('\n').length - (text.endsWith('\n') ? 1 : 0) : 0) + ' lines' + (version === stand ? '' : ' (buffer changed meanwhile)'));
      return true;
    };
    feld.addEventListener('input', function () { geaendert = true; version++; zeigeKopf(); if (!frage) meldung(''); });
    feld.addEventListener('keydown', function (ev) {
      const k = ev.key.toLowerCase(), strg = ev.ctrlKey && !ev.altKey && !ev.metaKey;
      if (frage) {
        ev.preventDefault(); ev.stopPropagation();
        if (k === 'y') {
          frage = false;
          void sichern().then(function (ok) {
            if (!ok) return;
            if (geaendert) { frage = true; meldung('Buffer changed while saving. Save modified buffer?  Y Yes   N No   ^C Cancel'); } else ende(0);
          });
        }
        else if (k === 'n') ende(0);
        else if ((strg && k === 'c') || k === 'escape') { frage = false; meldung('Cancelled'); }
        return;
      }
      if (strg && k === 'o') { ev.preventDefault(); ev.stopPropagation(); void sichern(); return; }
      if (strg && k === 'x') {
        ev.preventDefault(); ev.stopPropagation();
        if (speichert) { meldung('Writing, please wait'); return; }
        if (!geaendert) { ende(0); return; }
        frage = true; meldung('Save modified buffer?  Y Yes   N No   ^C Cancel');
        return;
      }
      if (strg) { ev.stopPropagation(); return; }   /* Strg+C usw. gehören dem Editor, nicht dem Auftrag der Shell */
      if (ev.key === 'Tab' && !ev.shiftKey) {
        ev.preventDefault();
        feld.setRangeText('\t', feld.selectionStart, feld.selectionEnd, 'end');
        geaendert = true; version++; zeigeKopf();
      }
    });
    /* Abmeldung: Editor beenden, ohne zu schreiben; liefert, ob ungesicherte Änderungen verworfen wurden */
    t.editor = { name: name, feld: feld, abbrechen: function () { const verworfen = geaendert; ende(130); return verworfen; } };
    zeigeKopf();
    meldung(neu ? 'New File' : '');
    kern.classList.add('editor-aktiv');
    kern.appendChild(box);
    feld.focus();
  });
}

/* ---- Sicherung des Heimverzeichnisses ---- */
const TERMINAL_HOME_FORMAT = 'fieldterminal-home';
/* Größenvertrag mit der Brücke (terminal_lokal.py MAX_HOME, MAX_HOME_REQUEST): Worst Case des VFS sind 16 MiB Inhalt aus lauter Steuerzeichen,
   je Byte 6 Bytes in der Sicherung und 7 in der Anfrage (JSON in JSON). Übergroße Bestände werden sichtbar abgelehnt, nie gekürzt. */
let TERMINAL_HOME_MAX = 112 * 1024 * 1024, TERMINAL_HOME_ANFRAGE_MAX = 128 * 1024 * 1024;
const TERMINAL_HOME_NAME = /^home-\d{8}T\d{6}Z(?:-\d)?\.json$/;
async function terminalHomeHash(text) {
  const h = await terminalVaultHash(text);
  return h;
}
/* Format 2 (Review #137): jeder Eintrag nennt nur seinen Namen und den Index seines Elternverzeichnisses (-1: /home/raizo), statt den ganzen
   relativen Pfad zu wiederholen. So bleibt jeder gültige Bestand im Größenvertrag (5000 Knoten mit Namen bis 255 Bytes bei beliebiger Tiefe).
   Format 3 (Paket 3, S2): zusätzlich "etc" im selben Indexformat mit Eigentümer (uid 0 oder 1000) und eigenem Manifest (manifest.etc), damit
   Systemkonfiguration und WireGuard-Schlüssel mitgesichert werden. Formate 1 und 2 werden weiterhin gelesen (dann nur /home/raizo). */
function terminalHomeIndex(liste, mitUid) {
  const index = new Map([['', -1]]);
  return liste.map(function (e, i) {
    const teile = e.pfad.split('/'), name = teile.pop();
    index.set(e.pfad, i);
    const x = { eltern: index.get(teile.join('/')), name: name, typ: e.typ, modus: e.modus, erstellt: e.erstellt, geaendert: e.geaendert };
    if (mitUid) x.uid = e.uid;
    if (e.typ === 'file') x.inhalt = e.inhalt;
    return x;
  });
}
function terminalHomeBytes(liste) { return liste.reduce(function (s, e) { return s + (e.typ === 'file' ? new TextEncoder().encode(e.inhalt).length : 0); }, 0); }
async function terminalHomePaket() {
  const ex = await TERMINAL_VFS.exportieren();
  if (ex.fehler) return { fehler: ex.fehler };
  const eintraege = terminalHomeIndex(ex.eintraege, false), etc = terminalHomeIndex(ex.etc || [], true);
  const summe = await terminalHomeHash(JSON.stringify(eintraege)), summeEtc = await terminalHomeHash(JSON.stringify(etc));
  if (!summe || !summeEtc) return { fehler: 'EIO' };
  const paket = { format: TERMINAL_HOME_FORMAT, version: 3, erstellt: new Date().toISOString(),
    manifest: { eintraege: eintraege.length, bytes: terminalHomeBytes(eintraege), sha256: summe, etc: { eintraege: etc.length, bytes: terminalHomeBytes(etc), sha256: summeEtc } },
    eintraege: eintraege, etc: etc };
  return { paket: paket, text: JSON.stringify(paket), gen: ex.gen };
}
/* Index-Format -> Pfadliste; null bei ungültigem Elternindex oder Namen */
function terminalHomePfade(liste) {
  const pfade = [];
  for (let i = 0; i < liste.length; i++) {
    const e = liste[i];
    if (!e || !Number.isInteger(e.eltern) || e.eltern < -1 || e.eltern >= i || typeof e.name !== 'string' || !e.name || e.name.includes('/')) return null;
    pfade.push(e.eltern === -1 ? e.name : pfade[e.eltern] + '/' + e.name);
  }
  return liste.map(function (e, i) { const x = { pfad: pfade[i], typ: e.typ, modus: e.modus, erstellt: e.erstellt, geaendert: e.geaendert }; if ('uid' in e) x.uid = e.uid; if ('inhalt' in e) x.inhalt = e.inhalt; return x; });
}
/* Einträge eines Bereichs prüfen (Namen, Tiefe samt Präfix, Eltern, Arten, Grenzen); Rückgabe { bytes } oder { fehler } */
function terminalHomeBereichPruefen(liste, praefix, mitUid) {
  const g = TERMINAL_VFS.GRENZE, art = new Map([['', 'dir']]);
  let summe = 0;
  for (const e of liste) {
    if (!e || typeof e.pfad !== 'string' || !e.pfad || (e.typ !== 'dir' && e.typ !== 'file') || !Number.isInteger(e.modus) || e.modus < 0 || e.modus > 0o7777 ||
      !Number.isFinite(e.erstellt) || !Number.isFinite(e.geaendert) || (mitUid && e.uid !== 0 && e.uid !== 1000)) return { fehler: 'not a valid backup (entry)' };
    if (e.typ === 'file' && typeof e.inhalt !== 'string') return { fehler: 'not a valid backup (entry)' };
    const teile = e.pfad.split('/');
    /* Namen und Tiefe wie bei jeder Operation (einschließlich des Präfixes); der Elternpfad muss ein bereits aufgeführtes VERZEICHNIS sein */
    if (TERMINAL_VFS.pfadFehler(praefix.concat(teile)) || art.has(e.pfad) || art.get(teile.slice(0, -1).join('/')) !== 'dir') return { fehler: 'not a valid backup (path)' };
    art.set(e.pfad, e.typ);
    if (e.typ === 'file') { const b = new TextEncoder().encode(e.inhalt).length; if (b > g.datei) return { fehler: 'backup exceeds the limits of this file system' }; summe += b; }
  }
  return { bytes: summe };
}
/* Vollständige Prüfung vor jeder Wiederherstellung; nichts wird verändert, bevor alles gültig ist. */
async function terminalHomePruefen(text) {
  let p;
  try { p = JSON.parse(text); } catch (e) { return { fehler: 'not a valid backup (unreadable)' }; }
  if (!p || p.format !== TERMINAL_HOME_FORMAT || ![1, 2, 3].includes(p.version) || !Array.isArray(p.eintraege) || !p.manifest) return { fehler: 'not a valid backup (format)' };
  if ((await terminalHomeHash(JSON.stringify(p.eintraege))) !== p.manifest.sha256) return { fehler: 'backup is damaged (checksum mismatch)' };
  if (p.manifest.eintraege !== p.eintraege.length) return { fehler: 'backup is damaged (entry count)' };
  const g = TERMINAL_VFS.GRENZE;
  if (p.version === 3) {
    if (!Array.isArray(p.etc) || !p.manifest.etc) return { fehler: 'not a valid backup (format)' };
    if ((await terminalHomeHash(JSON.stringify(p.etc))) !== p.manifest.etc.sha256) return { fehler: 'backup is damaged (checksum mismatch)' };
    if (p.manifest.etc.eintraege !== p.etc.length) return { fehler: 'backup is damaged (entry count)' };
  }
  if (p.eintraege.length + (p.version === 3 ? p.etc.length : 0) > g.knoten) return { fehler: 'backup exceeds the limits of this file system' };
  /* Format 2 und 3 -> Pfade: der Elternindex muss auf einen FRÜHEREN Eintrag zeigen; der Name ist ein einzelner gültiger Name */
  p.eintraegeV1 = p.version === 1 ? p.eintraege : terminalHomePfade(p.eintraege);
  p.etcV1 = p.version === 3 ? terminalHomePfade(p.etc) : null;
  if (!p.eintraegeV1 || (p.version === 3 && !p.etcV1)) return { fehler: 'not a valid backup (path)' };
  const h = terminalHomeBereichPruefen(p.eintraegeV1, TERMINAL_HEIM, false);
  if (h.fehler) return h;
  const e = p.etcV1 ? terminalHomeBereichPruefen(p.etcV1, ['etc'], true) : { bytes: 0 };
  if (e.fehler) return e;
  if (h.bytes + e.bytes > g.gesamt) return { fehler: 'backup exceeds the limits of this file system' };
  if (p.manifest.bytes !== h.bytes || (p.etcV1 && p.manifest.etc.bytes !== e.bytes)) return { fehler: 'backup is damaged (byte count)' };
  return { paket: p };
}
/* Bereiche einer Wiederherstellung (S9: Befehle behalten ihre Namen, die Bereiche sind getrennt wählbar): --home nur /home/raizo,
   --etc nur /etc; ohne Angabe beide, soweit die Sicherung sie enthält (Formate 1 und 2 nur /home/raizo). */
function terminalHomeBereiche(args, befehl) {
  const nurHome = args.includes('--home'), nurEtc = args.includes('--etc');
  if (nurHome && nurEtc) return { fehler: 'usage: ' + befehl + ' [--yes] [--home | --etc]' + (befehl === 'home-restore' ? ' <name>' : '') };
  return { home: !nurEtc, etc: !nurHome, rest: args.filter(function (a) { return a !== '--home' && a !== '--etc'; }) };
}
/* Meldung nach dem Einspielen: Anzahl für /home/raizo wie bisher vorn, /etc als Zusatz; nur /etc: eigene Form */
function terminalHomeErgebnis(befehl, r, quelle) {
  if (r.home === null) return befehl + ': ' + r.etc + ' entries restored to /etc from ' + quelle;
  return befehl + ': ' + r.home + ' entries restored from ' + quelle + (r.etc !== null ? ' (/etc: ' + r.etc + ' entries)' : '');
}
function terminalHomeUmfang(gp, b) {
  const teile = [];
  if (b.home) teile.push('/home/raizo (' + gp.paket.manifest.eintraege + ' entries in the backup)');
  if (b.etc && gp.paket.etcV1) teile.push('/etc (' + gp.paket.manifest.etc.eintraege + ' entries in the backup)');
  return teile;
}
/* Sicherungen laufen nacheinander (automatische, manuelle und die letzte bei der Abmeldung): eine neue wartet auf die laufende. */
let terminalHomeLaufend = null;
function terminalHomeSichern(automatisch) {
  const lauf = (terminalHomeLaufend || Promise.resolve()).catch(function () {}).then(function () { return terminalHomeSichernKern(automatisch); });
  terminalHomeLaufend = lauf;
  const frei = function () { if (terminalHomeLaufend === lauf) terminalHomeLaufend = null; };
  lauf.then(frei, frei);
  return lauf;
}
async function terminalHomeSichernKern(automatisch) {
  const t = TERMINAL_ZUSTAND;
  t.homeAenderung = false;   /* Änderungen während der Sicherung setzen das Kennzeichen erneut */
  const pk = await terminalHomePaket();
  if (pk.fehler) { t.homeAenderung = true; return { fehler: terminalDateiFehlerText(pk.fehler) }; }
  const anfrage = { op: 'home-save', data: pk.text, sha256: await terminalHomeHash(pk.text) };
  const groesse = new TextEncoder().encode(JSON.stringify(anfrage)).length;
  if (new TextEncoder().encode(pk.text).length > TERMINAL_HOME_MAX || groesse > TERMINAL_HOME_ANFRAGE_MAX) {
    t.homeAenderung = true;
    return { fehler: 'backup too large for the local bridge (' + Math.ceil(groesse / 1048576) + ' MiB, limit ' + Math.floor(TERMINAL_HOME_ANFRAGE_MAX / 1048576) + ' MiB); nothing saved' };
  }
  const antwort = await terminalBrueckeSenden(anfrage);
  if (antwort.error) { t.homeAenderung = true; return { fehler: antwort.error }; }
  return { name: antwort.name, bytes: antwort.bytes, eintraege: pk.paket.manifest.eintraege, etc: pk.paket.manifest.etc.eintraege, gen: pk.gen };
}
/* Änderungen unter /home lösen nach einer Ruhezeit eine automatische Sicherung aus (nur mit verbundener Brücke); Fehler werden einmal gemeldet. */
let terminalHomeTimer = null, terminalHomeRuhe = 20000;   /* Ruhezeit in ms; Tests verkürzen sie */
function terminalHomeGeaendert() {
  const t = TERMINAL_ZUSTAND;
  t.homeAenderung = true;
  if (!terminalBrueckenAdresse()) return;
  clearTimeout(terminalHomeTimer);
  terminalHomeTimer = setTimeout(async function () {
    terminalHomeTimer = null;
    if (!t.homeAenderung) return;
    const r = await terminalHomeSichern(true);
    if (r.fehler && !t.homeFehlerGemeldet) { t.homeFehlerGemeldet = true; terminalAusgabe('home-backup: automatic backup failed: ' + r.fehler); }
    else if (!r.fehler) t.homeFehlerGemeldet = false;
  }, terminalHomeRuhe);
}
async function terminalBefehlHomeBackup(ctx) {
  if (ctx.args.length && !(ctx.args.length === 1 && ctx.args[0] === 'list')) return { code: 2, stdout: [], stderr: ['usage: home-backup [list]'] };
  if (!terminalBrueckenAdresse()) return { code: 1, stdout: [], stderr: ['home-backup: local bridge not connected. ' + TERMINAL_BRUECKE_START, 'Use home-export for a manual copy.'] };
  if (ctx.args[0] === 'list') {
    const a = await terminalBrueckeSenden({ op: 'home-list' });
    if (a.error) return { code: 1, stdout: [], stderr: ['home-backup: ' + a.error] };
    return { code: 0, stdout: a.backups.length ? a.backups.map(function (b) { return b.name + '  ' + b.bytes + ' B'; }) : ['no backups'], stderr: [] };
  }
  const r = await terminalHomeSichern(false);
  if (r.fehler) return { code: 1, stdout: [], stderr: ['home-backup: ' + r.fehler] };
  return { code: 0, stdout: ['home-backup: ' + r.name + ' (' + r.eintraege + ' entries in /home/raizo, ' + r.etc + ' in /etc, ' + r.bytes + ' B)'], stderr: [] };
}
async function terminalBefehlHomeRestore(ctx) {
  if (!terminalBrueckenAdresse()) return { code: 1, stdout: [], stderr: ['home-restore: local bridge not connected. ' + TERMINAL_BRUECKE_START] };
  const bereich = terminalHomeBereiche(ctx.args, 'home-restore');
  if (bereich.fehler) return { code: 2, stdout: [], stderr: [bereich.fehler] };
  const yes = bereich.rest.includes('--yes'), rest = bereich.rest.filter(function (a) { return a !== '--yes'; });
  if (rest.length > 1) return { code: 2, stdout: [], stderr: ['usage: home-restore [--yes] [--home | --etc] <name>'] };
  const liste = await terminalBrueckeSenden({ op: 'home-list' });
  if (liste.error) return { code: 1, stdout: [], stderr: ['home-restore: ' + liste.error] };
  if (!rest.length) return { code: 0, stdout: liste.backups.length ? ['Available backups (newest first):'].concat(liste.backups.map(function (b) { return '  ' + b.name; }), ['Restore with: home-restore --yes <name>']) : ['no backups'], stderr: [] };
  const name = rest[0];
  if (!TERMINAL_HOME_NAME.test(name)) return { code: 1, stdout: [], stderr: ['home-restore: ' + name + ': not a backup name'] };
  const geladen = await terminalBrueckeSenden({ op: 'home-load', name: name });
  if (geladen.error) return { code: 1, stdout: [], stderr: ['home-restore: ' + geladen.error] };
  if ((await terminalHomeHash(geladen.data)) !== geladen.sha256) return { code: 1, stdout: [], stderr: ['home-restore: ' + name + ': checksum mismatch in transfer; nothing changed'] };
  const gp = await terminalHomePruefen(geladen.data);
  if (gp.fehler) return { code: 1, stdout: [], stderr: ['home-restore: ' + name + ': ' + gp.fehler + '; nothing changed'] };
  if (bereich.etc && !bereich.home && !gp.paket.etcV1) return { code: 1, stdout: [], stderr: ['home-restore: ' + name + ': this backup contains no /etc; nothing changed'] };
  if (!yes) return { code: 1, stdout: [], stderr: ['home-restore: this replaces everything in ' + terminalHomeUmfang(gp, bereich).join(' and in ') + '. The current state is saved first.', 'Run again with --yes to proceed.'] };
  const vorher = await terminalHomeSichern(false);
  if (vorher.fehler) return { code: 1, stdout: [], stderr: ['home-restore: could not save the current state first (' + vorher.fehler + '); nothing changed'] };
  const r = await TERMINAL_VFS.importieren(bereich.home ? gp.paket.eintraegeV1 : null, { gen: vorher.gen, etc: bereich.etc ? gp.paket.etcV1 : null });
  if (r.fehler === 'EBUSY') return { code: 1, stdout: [], stderr: ['home-restore: files changed in another window while restoring; nothing changed. Run the command again.'] };
  if (r.fehler) return { code: 1, stdout: [], stderr: ['home-restore: ' + terminalDateiFehlerText(r.fehler) + '; nothing changed'] };
  terminalHomeGeaendert(); if (r.etc !== null) terminalSysGeaendert();
  return { code: 0, stdout: [terminalHomeErgebnis('home-restore', r, name), 'previous state saved as ' + vorher.name], stderr: [] };
}
/* Manueller Rückweg ohne Brücke: eine mit home-export erzeugte Datei wird über die Dateiauswahl des Browsers gelesen und genauso geprüft und
   atomar eingespielt wie eine Sicherung der Brücke. Ohne Brücke wird der vorherige Stand nicht gesondert abgelegt (Hinweis vor dem Ersetzen). */
function terminalHomeDateiWaehlen() {
  return new Promise(function (ok) {
    const feld = document.createElement('input');
    feld.type = 'file'; feld.accept = '.json,application/json'; feld.style.display = 'none';
    feld.addEventListener('change', function () {
      const f = feld.files && feld.files[0];
      if (!f) { feld.remove(); ok(null); return; }
      if (f.size > TERMINAL_HOME_MAX) { feld.remove(); ok({ fehler: 'file too large' }); return; }
      f.text().then(function (text) { feld.remove(); ok({ text: text, name: f.name }); }, function () { feld.remove(); ok({ fehler: 'file unreadable' }); });
    });
    feld.addEventListener('cancel', function () { feld.remove(); ok(null); });
    document.body.appendChild(feld);
    feld.click();
  });
}
async function terminalBefehlHomeImport(ctx) {
  const bereich = terminalHomeBereiche(ctx.args, 'home-import');
  if (bereich.fehler) return { code: 2, stdout: [], stderr: [bereich.fehler] };
  const yes = bereich.rest.includes('--yes'), rest = bereich.rest.filter(function (a) { return a !== '--yes'; });
  if (rest.length) return { code: 2, stdout: [], stderr: ['usage: home-import [--yes] [--home | --etc]'] };
  if (!yes) return { code: 1, stdout: [], stderr: ['home-import: this replaces everything in ' + (bereich.home && bereich.etc ? '/home/raizo (and /etc, if the file contains it)' : bereich.home ? '/home/raizo' : '/etc') + ' with the contents of a file created by home-export.',
    terminalBrueckenAdresse() ? 'The current state is saved first.' : 'The local bridge is not connected: the current state is NOT saved separately. Use home-export first.', 'Run again with --yes and choose the file.'] };
  const d = await terminalHomeDateiWaehlen();
  if (!d) return { code: 1, stdout: [], stderr: ['home-import: no file chosen; nothing changed'] };
  if (d.fehler) return { code: 1, stdout: [], stderr: ['home-import: ' + d.fehler + '; nothing changed'] };
  const gp = await terminalHomePruefen(d.text);
  if (gp.fehler) return { code: 1, stdout: [], stderr: ['home-import: ' + d.name + ': ' + gp.fehler + '; nothing changed'] };
  let gen, vorherName = null;
  if (terminalBrueckenAdresse()) {
    const vorher = await terminalHomeSichern(false);
    if (vorher.fehler) return { code: 1, stdout: [], stderr: ['home-import: could not save the current state first (' + vorher.fehler + '); nothing changed'] };
    gen = vorher.gen; vorherName = vorher.name;
  } else {
    const ex = await TERMINAL_VFS.exportieren();
    if (ex.fehler) return { code: 1, stdout: [], stderr: ['home-import: ' + terminalDateiFehlerText(ex.fehler) + '; nothing changed'] };
    gen = ex.gen;
  }
  if (bereich.etc && !bereich.home && !gp.paket.etcV1) return { code: 1, stdout: [], stderr: ['home-import: ' + d.name + ': this file contains no /etc; nothing changed'] };
  const r = await TERMINAL_VFS.importieren(bereich.home ? gp.paket.eintraegeV1 : null, { gen: gen, etc: bereich.etc ? gp.paket.etcV1 : null });
  if (r.fehler === 'EBUSY') return { code: 1, stdout: [], stderr: ['home-import: files changed in another window while importing; nothing changed. Run the command again.'] };
  if (r.fehler) return { code: 1, stdout: [], stderr: ['home-import: ' + terminalDateiFehlerText(r.fehler) + '; nothing changed'] };
  terminalHomeGeaendert(); if (r.etc !== null) terminalSysGeaendert();
  return { code: 0, stdout: [terminalHomeErgebnis('home-import', r, d.name)].concat(vorherName ? ['previous state saved as ' + vorherName] : []), stderr: [] };
}
async function terminalBefehlHomeExport(ctx) {
  if (ctx.args.length) return { code: 2, stdout: [], stderr: ['usage: home-export'] };
  const pk = await terminalHomePaket();
  if (pk.fehler) return { code: 1, stdout: [], stderr: ['home-export: ' + terminalDateiFehlerText(pk.fehler)] };
  const stempel = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  terminalDownload({ name: 'home-' + stempel + '.json' }, pk.text);
  return { code: 0, stdout: ['home-export: home-' + stempel + '.json (' + pk.paket.manifest.eintraege + ' entries) handed to the browser download'], stderr: [] };
}
