#!/usr/bin/env python3
"""Erzeugt die Kollationstabelle (en_US.UTF-8) in terminal-locale.js aus der glibc-Quelle iso14651_t1_common.

Aufruf:  python3 tools/gen-locale-en_US.py [--schreiben] [Quelle]
  ohne --schreiben: der generierte Abschnitt (zwischen den Marken GENERIERT-BEGINN und GENERIERT-ENDE) geht nach stdout;
  mit --schreiben: derselbe Abschnitt ersetzt den Abschnitt in terminal-locale.js; der handgeschriebene Vergleichscode bleibt unberührt.
Der Abschnitt nennt die SHA-256-Summe der Quelle; tests/terminal-locale.js erzeugt ihn neu und vergleicht (wenn die Quelle vorhanden ist).
Referenz: Ubuntu 24.04, glibc 2.39, /usr/share/i18n/locales/iso14651_t1_common.
Repertoire: U+0020..U+007E, U+00A0..U+017F (ASCII, Latin-1, Latin Extended-A).
Die Rangwerte werden dicht neu nummeriert; die Ordnung bleibt erhalten.
"""
import re, sys, json, hashlib, os
args = [a for a in sys.argv[1:] if a != '--schreiben']
schreiben = '--schreiben' in sys.argv[1:]
quelle = args[0] if args else '/usr/share/i18n/locales/iso14651_t1_common'
sha = hashlib.sha256(open(quelle, 'rb').read()).hexdigest()
src = open(quelle, encoding='utf-8').read().split('\n')
rang = {}; zeichen = {}
for i, l in enumerate(src):
    m = re.match(r'^<([^>\s]+)>\s*(%.*)?$', l)
    if m: rang.setdefault(m.group(1), i)
    m = re.match(r'^<U([0-9A-F]+)>\s+(.*?);(.*?);(.*?);<U[0-9A-F]+>', l)
    if m:
        cp = int(m.group(1), 16)
        def syms(f): return [] if f.strip() == 'IGNORE' else re.findall(r'<([^>]+)>', f)
        zeichen.setdefault(cp, (syms(m.group(2)), syms(m.group(3)), syms(m.group(4)), i))
rep = [c for c in list(range(0x20, 0x7f)) + list(range(0xa0, 0x180)) if c in zeichen]
benutzt = sorted({rang[s] for c in rep for k in range(3) for s in zeichen[c][k]})
dicht = {r: n + 1 for n, r in enumerate(benutzt)}
l4 = {r: n + 1 for n, r in enumerate(sorted({zeichen[c][3] for c in rep}))}
tab = {}
for c in rep:
    w = zeichen[c]
    tab[c] = [[dicht[rang[s]] for s in w[k]] for k in range(3)] + [l4[w[3]]]
abschnitt = ('/* GENERIERT-BEGINN: von tools/gen-locale-en_US.py erzeugt, nicht von Hand ändern.\n'
             '   Kollation en_US.UTF-8 (glibc 2.39, Ubuntu 24.04), Quelle iso14651_t1_common, SHA-256 ' + sha + ',\n'
             '   Repertoire U+0020-007E und U+00A0-017F. Je Zeichen: [Gewichte Ebene 1, 2, 3, Rang Ebene 4]; leere Liste = IGNORE. */\n'
             'const TERMINAL_LOCALE_TABELLE = ' + json.dumps({str(c): tab[c] for c in rep}, separators=(',', ':')) + ';\n'
             '/* GENERIERT-ENDE */')
if schreiben:
    ziel = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'terminal-locale.js')
    t = open(ziel, encoding='utf-8').read()
    m = re.search(r'/\* GENERIERT-BEGINN.*?/\* GENERIERT-ENDE \*/', t, re.S)
    if not m: sys.exit('Marken nicht gefunden')
    open(ziel, 'w', encoding='utf-8').write(t[:m.start()] + abschnitt + t[m.end():])
else:
    print(abschnitt)
