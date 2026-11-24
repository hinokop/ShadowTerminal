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
async function terminalDateiSeg(ctx, text) { return ctx.fs.resolve(text, { cwd: ctx.cwd }); }
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
    const seg = await terminalDateiSeg(ctx, name);
    if (!seg) { fehler.push(terminalDateiMeldung('mkdir', 'cannot create directory ', name, 'EACCES')); continue; }
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
    const seg = await terminalDateiSeg(ctx, name);
    const r = seg ? await ctx.fs.schreiben(seg, '', { nurAnlegen: true }) : { fehler: 'EACCES' };
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
    const seg = await terminalDateiSeg(ctx, name);
    const r = seg ? await ctx.fs.entfernen(seg, { nurVerzeichnis: true }) : { fehler: 'EACCES' };
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
    const seg = await terminalDateiSeg(ctx, name);
    if (!seg) { fehler.push(terminalDateiMeldung('rm', 'cannot remove ', name, 'EACCES')); continue; }
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
  const zielSeg = await terminalDateiSeg(ctx, zielName);
  if (!zielSeg) return { fehler: [befehl + ': cannot create ' + (befehl === 'cp' ? 'regular file ' : '') + terminalLsQuote(zielName) + ': Permission denied'] };
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
    if (!seg) { fehler.push('cp: cannot stat ' + terminalLsQuote(name) + ': Permission denied'); continue; }
    const basis = terminalBasisname(name) || '';
    /* Schutz (Architektur 11): Exportobjekte der Anwendung werden nie kopiert; die Prüfung steht vor jedem Lesen */
    if (seg[0] === TERMINAL_DB && terminalArchivNameZiel(seg.at(-1))) { fehler.push('cp: cannot open ' + terminalLsQuote(name) + ' for reading: Permission denied'); continue; }
    const st = await terminalDateiStat(ctx, seg);
    if (st.fehler) { fehler.push('cp: cannot stat ' + terminalLsQuote(name) + ': ' + terminalDateiFehlerText(st.fehler === 'Datei oder Ordner nicht gefunden' ? 'ENOENT' : st.fehler)); continue; }
    if (st.typ === 'dir' && !rek) { fehler.push('cp: -r not specified; omitting directory ' + terminalLsQuote(name)); continue; }
    const ziel = plan.istDir ? plan.zielSeg.concat(basis) : plan.zielSeg;
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
    const seg = await terminalDateiSeg(ctx, name);
    if (!seg) { fehler.push('mv: cannot stat ' + terminalLsQuote(name) + ': Permission denied'); continue; }
    const st = await terminalDateiStat(ctx, seg);
    if (st.fehler) { fehler.push('mv: cannot stat ' + terminalLsQuote(name) + ': ' + terminalDateiFehlerText(st.fehler === 'Datei oder Ordner nicht gefunden' ? 'ENOENT' : st.fehler)); continue; }
    const ziel = plan.istDir ? plan.zielSeg.concat(terminalBasisname(name)) : plan.zielSeg;
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
function terminalLeser(befehl) {
  return async function (ctx) {
    let n = 10, i = 0;
    const namen = [];
    if (befehl !== 'cat') {
      for (; i < ctx.args.length; i++) {
        const a = ctx.args[i];
        if (a === '--') { i++; break; }
        if (a === '-n' && i + 1 < ctx.args.length) { n = Number(ctx.args[++i]); continue; }
        if (/^-n\d+$/.test(a)) { n = Number(a.slice(2)); continue; }
        if (a.length > 1 && a[0] === '-' && a !== '-') return { code: 1, stdout: [], stderr: [befehl + ": invalid option -- '" + a.replace(/^-+/, '')[0] + "'", terminalGnuTry(befehl)] };
        break;
      }
      if (!Number.isInteger(n) || n < 0) return { code: 1, stdout: [], stderr: [befehl + ': invalid number of lines: ' + terminalLsQuote(String(n))] };
    }
    for (; i < ctx.args.length; i++) namen.push(ctx.args[i]);
    if (!namen.length) return { code: 1, stdout: [], stderr: [befehl + ': missing file operand'] };
    const aus = [], fehler = [];
    let roh = '', erst = true, code = 0;
    for (const name of namen) {
      const seg = await terminalDateiSeg(ctx, name);
      let r;
      if (!seg) r = { fehler: 'EACCES' };
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
      let text = r.text;
      if (befehl !== 'cat') {
        const zeilen = text.split('\n');
        if (zeilen.at(-1) === '') zeilen.pop();
        const ausw = befehl === 'head' ? zeilen.slice(0, n) : n === 0 ? [] : zeilen.slice(-n);
        text = ausw.length ? ausw.join('\n') + (befehl === 'head' || text.endsWith('\n') ? '\n' : '') : '';
        if (namen.length > 1) { const kopf = (erst ? '' : '\n') + '==> ' + name + ' <==\n'; text = kopf + text; }
      }
      erst = false;
      roh += text;
    }
    if (roh) { const z = roh.split('\n'); if (z.at(-1) === '') z.pop(); aus.push.apply(aus, z); }
    return { code: code, stdout: aus, stderr: fehler, text: roh };
  };
}

/* ---- Umleitung ---- */
const TERMINAL_UMLEITBAR = new Set(['echo', 'pwd', 'ls', 'cat', 'head', 'tail', 'date', 'whoami', 'uname', 'true', 'false', 'touch', 'mkdir', 'rm', 'rmdir', 'cp', 'mv']);
function terminalBefehlFn(befehl) {
  return { pwd: terminalBefehlPwd, ls: terminalBefehlLs, cat: terminalLeser('cat'), head: terminalLeser('head'), tail: terminalLeser('tail'),
    touch: terminalBefehlTouch, mkdir: terminalBefehlMkdir, rmdir: terminalBefehlRmdir, rm: terminalBefehlRm, cp: terminalBefehlCp, mv: terminalBefehlMv }[befehl] || null;
}
/* Befehle, die auch ohne Umleitung über die ctx-Schnittstelle laufen (cat, head, tail nur bei VFS-Pfaden, siehe terminalDateiAusfuehren) */
function terminalBefehlDirekt(befehl) {
  return { touch: terminalBefehlTouch, mkdir: terminalBefehlMkdir, rmdir: terminalBefehlRmdir, rm: terminalBefehlRm, cp: terminalBefehlCp, mv: terminalBefehlMv,
    nano: terminalBefehlNano, 'home-backup': terminalBefehlHomeBackup, 'home-restore': terminalBefehlHomeRestore, 'home-export': terminalBefehlHomeExport }[befehl] || null;
}
/* Das Ziel wird vor dem Befehl geöffnet (angelegt, bei ">" geleert), auch wenn der Befehl scheitert, wie in bash. stdout geht nur in die Datei,
   stderr bleibt auf dem Bildschirm; Rückgabewert ist der des Befehls, bei Schreibfehler 1. */
async function terminalUmgeleitet(woerter, um, status) {
  const t = TERMINAL_ZUSTAND, version = t.version;
  const ziel = um.ziel;
  const seg = terminalShellPfad(ziel);
  const f = function (kuerzel) { return 'bash: ' + ziel + ': ' + terminalDateiFehlerText(kuerzel); };
  if (!ziel) { terminalAusgabe('bash: : No such file or directory'); return 1; }
  if (!seg) { terminalAusgabe(f('EACCES')); return 1; }
  const auf = await TERMINAL_FS.schreiben(seg, '', { anhaengen: um.art === '>>' });
  if (t.version !== version) return 1;
  if (auf.fehler) { terminalAusgabe(f(auf.fehler)); return 1; }
  if (!woerter.length) return 0;
  const befehl = woerter[0], args = woerter.slice(1);
  if (!TERMINAL_UMLEITBAR.has(befehl)) {
    terminalAusgabe(terminalBefehlEintrag(befehl) ? 'bash: ' + befehl + ': output redirection is not supported for this command' : befehl + ': command not found');
    return terminalBefehlEintrag(befehl) ? 1 : 127;
  }
  if (woerter.some(function (w) { return befehl !== 'echo' && terminalArchivNameZiel(terminalBasisname(w)); })) {
    terminalAusgabe('bash: ' + befehl + ': Permission denied');   /* geschützte Exportobjekte nie in Dateien übernehmen (Architektur 11) */
    return 1;
  }
  let res;
  const einfach = { echo: function () { return [args.join(' ')]; }, whoami: function () { return [TERMINAL_BENUTZER]; }, uname: function () { return args.length === 1 && args[0] === '-a' ? [TERMINAL_UBUNTU] : null; },
    date: function () { return args.length ? null : [fmtZ(new Date())]; }, true: function () { return args.length ? null : []; }, false: function () { return args.length ? null : []; } };
  if (einfach[befehl]) {
    const zeilen = einfach[befehl]();
    if (zeilen === null) { terminalAusgabe('usage: ' + befehl); return 2; }
    res = { code: befehl === 'false' ? 1 : 0, stdout: zeilen, stderr: [] };
  } else {
    const fn = terminalBefehlFn(befehl);
    const env = t.oldpwd ? { OLDPWD: t.oldpwd } : {};
    res = await fn({ args: args, arg: terminalArgText(args), cwd: terminalArbeitsverzeichnis(), env: env, fs: TERMINAL_FS });
    if (t.version !== version) return 1;
    if (res.cwd) { t.oldpwd = terminalArbeitsverzeichnis(); t.ort = res.cwd.ort; t.virtuellerOrt = res.cwd.virtuellerOrt; }
  }
  const fehlerZeilen = (res.stderr || []).filter(function (z) { return z !== ''; });
  if (fehlerZeilen.length) terminalAusgabe(fehlerZeilen);
  const text = typeof res.text === 'string' ? res.text : (res.stdout || []).length ? res.stdout.join('\n') + '\n' : '';
  if (text) {
    const w = await TERMINAL_FS.schreiben(seg, text, { anhaengen: true });
    if (t.version !== version) return 1;
    if (w.fehler) { terminalAusgabe('bash: ' + befehl + ': write error: ' + terminalDateiFehlerText(w.fehler)); return 1; }
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
  const name = z.operanden[0], seg = await terminalDateiSeg(ctx, name);
  if (!seg || !seg.length) return { code: 1, stdout: [], stderr: ['nano: ' + name + ': Permission denied'] };
  if (seg[0] === TERMINAL_DB && terminalArchivNameZiel(seg.at(-1))) return { code: 1, stdout: [], stderr: ['nano: ' + name + ': Permission denied'] };
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
    const sichern = async function () {
      if (speichert) return false;
      speichert = true;
      const r = await TERMINAL_FS.schreiben(seg, feld.value, {});
      speichert = false;
      if (r.fehler) { meldung('Error writing ' + name + ': ' + terminalDateiFehlerText(r.fehler)); return false; }
      geaendert = false; neu = false; zeigeKopf();
      meldung('Wrote ' + (feld.value ? feld.value.split('\n').length - (feld.value.endsWith('\n') ? 1 : 0) : 0) + ' lines');
      return true;
    };
    feld.addEventListener('input', function () { geaendert = true; zeigeKopf(); if (!frage) meldung(''); });
    feld.addEventListener('keydown', function (ev) {
      const k = ev.key.toLowerCase(), strg = ev.ctrlKey && !ev.altKey && !ev.metaKey;
      if (frage) {
        ev.preventDefault(); ev.stopPropagation();
        if (k === 'y') { frage = false; void sichern().then(function (ok) { if (ok) ende(0); }); }
        else if (k === 'n') ende(0);
        else if ((strg && k === 'c') || k === 'escape') { frage = false; meldung('Cancelled'); }
        return;
      }
      if (strg && k === 'o') { ev.preventDefault(); ev.stopPropagation(); void sichern(); return; }
      if (strg && k === 'x') {
        ev.preventDefault(); ev.stopPropagation();
        if (!geaendert) { ende(0); return; }
        frage = true; meldung('Save modified buffer?  Y Yes   N No   ^C Cancel');
        return;
      }
      if (strg) { ev.stopPropagation(); return; }   /* Strg+C usw. gehören dem Editor, nicht dem Auftrag der Shell */
      if (ev.key === 'Tab' && !ev.shiftKey) {
        ev.preventDefault();
        feld.setRangeText('\t', feld.selectionStart, feld.selectionEnd, 'end');
        geaendert = true; zeigeKopf();
      }
    });
    t.editor = { name: name, feld: feld };
    zeigeKopf();
    meldung(neu ? 'New File' : '');
    kern.classList.add('editor-aktiv');
    kern.appendChild(box);
    feld.focus();
  });
}

/* ---- Sicherung des Heimverzeichnisses ---- */
const TERMINAL_HOME_FORMAT = 'fieldterminal-home';
const TERMINAL_HOME_NAME = /^home-\d{8}T\d{6}Z(?:-\d)?\.json$/;
async function terminalHomeHash(text) {
  const h = await terminalVaultHash(text);
  return h;
}
async function terminalHomePaket() {
  const ex = await TERMINAL_VFS.exportieren();
  if (ex.fehler) return { fehler: ex.fehler };
  const koerper = JSON.stringify(ex.eintraege), summe = await terminalHomeHash(koerper);
  if (!summe) return { fehler: 'EIO' };
  const bytes = ex.eintraege.reduce(function (s, e) { return s + (e.typ === 'file' ? new TextEncoder().encode(e.inhalt).length : 0); }, 0);
  const paket = { format: TERMINAL_HOME_FORMAT, version: 1, erstellt: new Date().toISOString(),
    manifest: { eintraege: ex.eintraege.length, bytes: bytes, sha256: summe }, eintraege: ex.eintraege };
  return { paket: paket, text: JSON.stringify(paket) };
}
/* Vollständige Prüfung vor jeder Wiederherstellung; nichts wird verändert, bevor alles gültig ist. */
async function terminalHomePruefen(text) {
  let p;
  try { p = JSON.parse(text); } catch (e) { return { fehler: 'not a valid backup (unreadable)' }; }
  if (!p || p.format !== TERMINAL_HOME_FORMAT || p.version !== 1 || !Array.isArray(p.eintraege) || !p.manifest) return { fehler: 'not a valid backup (format)' };
  const koerper = JSON.stringify(p.eintraege);
  if ((await terminalHomeHash(koerper)) !== p.manifest.sha256) return { fehler: 'backup is damaged (checksum mismatch)' };
  if (p.manifest.eintraege !== p.eintraege.length) return { fehler: 'backup is damaged (entry count)' };
  const g = TERMINAL_VFS.GRENZE, gesehen = new Set(['']);
  let summe = 0;
  if (p.eintraege.length > g.knoten) return { fehler: 'backup exceeds the limits of this file system' };
  for (const e of p.eintraege) {
    if (!e || typeof e.pfad !== 'string' || (e.typ !== 'dir' && e.typ !== 'file') || !Number.isFinite(e.modus) || !Number.isFinite(e.erstellt) || !Number.isFinite(e.geaendert)) return { fehler: 'not a valid backup (entry)' };
    if (e.typ === 'file' && typeof e.inhalt !== 'string') return { fehler: 'not a valid backup (entry)' };
    const teile = e.pfad.split('/');
    if (TERMINAL_VFS.pfadFehler(teile) || gesehen.has(e.pfad) || !gesehen.has(teile.slice(0, -1).join('/'))) return { fehler: 'not a valid backup (path)' };
    gesehen.add(e.pfad);
    if (e.typ === 'file') { const b = new TextEncoder().encode(e.inhalt).length; if (b > g.datei) return { fehler: 'backup exceeds the limits of this file system' }; summe += b; }
  }
  if (summe > g.gesamt) return { fehler: 'backup exceeds the limits of this file system' };
  return { paket: p };
}
async function terminalHomeSichern(automatisch) {
  const t = TERMINAL_ZUSTAND;
  t.homeAenderung = false;   /* Änderungen während der Sicherung setzen das Kennzeichen erneut */
  const pk = await terminalHomePaket();
  if (pk.fehler) { t.homeAenderung = true; return { fehler: terminalDateiFehlerText(pk.fehler) }; }
  const antwort = await terminalBrueckeSenden({ op: 'home-save', data: pk.text, sha256: await terminalHomeHash(pk.text) });
  if (antwort.error) { t.homeAenderung = true; return { fehler: antwort.error }; }
  return { name: antwort.name, bytes: antwort.bytes, eintraege: pk.paket.manifest.eintraege };
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
  return { code: 0, stdout: ['home-backup: ' + r.name + ' (' + r.eintraege + ' entries, ' + r.bytes + ' B)'], stderr: [] };
}
async function terminalBefehlHomeRestore(ctx) {
  if (!terminalBrueckenAdresse()) return { code: 1, stdout: [], stderr: ['home-restore: local bridge not connected. ' + TERMINAL_BRUECKE_START] };
  const yes = ctx.args.includes('--yes'), rest = ctx.args.filter(function (a) { return a !== '--yes'; });
  if (rest.length > 1) return { code: 2, stdout: [], stderr: ['usage: home-restore [--yes] <name>'] };
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
  if (!yes) return { code: 1, stdout: [], stderr: ['home-restore: this replaces everything in /home/raizo (' + gp.paket.manifest.eintraege + ' entries in the backup). The current state is saved first.', 'Run again with --yes to proceed.'] };
  const vorher = await terminalHomeSichern(false);
  if (vorher.fehler) return { code: 1, stdout: [], stderr: ['home-restore: could not save the current state first (' + vorher.fehler + '); nothing changed'] };
  const r = await TERMINAL_VFS.importieren(gp.paket.eintraege);
  if (r.fehler) return { code: 1, stdout: [], stderr: ['home-restore: ' + terminalDateiFehlerText(r.fehler) + '; nothing changed'] };
  return { code: 0, stdout: ['home-restore: ' + r.anzahl + ' entries restored from ' + name, 'previous state saved as ' + vorher.name], stderr: [] };
}
async function terminalBefehlHomeExport(ctx) {
  if (ctx.args.length) return { code: 2, stdout: [], stderr: ['usage: home-export'] };
  const pk = await terminalHomePaket();
  if (pk.fehler) return { code: 1, stdout: [], stderr: ['home-export: ' + terminalDateiFehlerText(pk.fehler)] };
  const stempel = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  terminalDownload({ name: 'home-' + stempel + '.json' }, pk.text);
  return { code: 0, stdout: ['home-export: home-' + stempel + '.json (' + pk.paket.manifest.eintraege + ' entries) handed to the browser download'], stderr: [] };
}
