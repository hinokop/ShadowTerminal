#!/usr/bin/env python3
"""Erzeugt terminal-locale.js (Kollation en_US.UTF-8) aus der glibc-Quelle iso14651_t1_common.

Aufruf:  python3 tools/gen-locale-en_US.py [Quelle] > terminal-locale.js
Referenz: Ubuntu 24.04, glibc 2.39, /usr/share/i18n/locales/iso14651_t1_common.
Repertoire: U+0020..U+007E, U+00A0..U+017F (ASCII, Latin-1, Latin Extended-A).
Die Rangwerte werden dicht neu nummeriert; die Ordnung bleibt erhalten.
"""
import re, sys, json
quelle = sys.argv[1] if len(sys.argv) > 1 else '/usr/share/i18n/locales/iso14651_t1_common'
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
out = []
out.append('/* GENERIERT von tools/gen-locale-en_US.py, nicht von Hand ändern.\n'
           '   Kollation en_US.UTF-8 (glibc 2.39, iso14651_t1_common, Ubuntu 24.04), Repertoire U+0020-007E und U+00A0-017F.\n'
           '   Je Zeichen: [Gewichte Ebene 1, Ebene 2, Ebene 3, Rang Ebene 4]; leere Liste = IGNORE. */')
out.append('const TERMINAL_LOCALE_TABELLE = ' + json.dumps({str(c): tab[c] for c in rep}, separators=(',', ':')) + ';')
print('\n'.join(out))
