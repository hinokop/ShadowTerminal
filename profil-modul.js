/* Shadow Terminal: Arbeitsprofil und fiktive Identitätskarten. Die alten IDs bleiben für gespeicherte Profile stabil. */
const ARBEITS_IDENTITAETEN = {
  haupt: { bezeichnung: 'Hauptidentität', name: 'Daniel Rohde', land: 'DE', ort: 'Hannover', beruf: 'Bürosachbearbeiter',
    text: 'Bearbeitet Anfragen, pflegt Unterlagen und koordiniert Termine in einem kleinen Büro.',
    anlagen: [['H-01', 'Profilblatt'], ['H-02', 'Eigene Anlage']] },
  ausweich: { bezeichnung: 'Reporter', name: 'Sven Albrecht', land: 'DE', ort: 'Cottbus', beruf: 'Freier Lokalreporter',
    text: 'Recherchiert lokale Themen, führt Interviews und schreibt Beiträge für Redaktionen.',
    anlagen: [['A-01', 'Themenmappe'], ['A-02', 'Artikelprobe']] },
  grenz: { bezeichnung: 'Taxifahrer', name: 'Martin Weller', land: 'DE', ort: 'Berlin', beruf: 'Taxifahrer',
    text: 'Übernimmt Fahrten im Stadtgebiet, plant Strecken und hilft Fahrgästen beim Gepäck.',
    anlagen: [['G-01', 'Schichtnotiz'], ['G-02', 'Eigene Anlage']] }
};
const ARBEITS_STATUS = ['Offline', 'Standby', 'Aktiv'];
/* Die internen Speicherschlüssel bleiben beim Umbenennen der Achsen unverändert. */
const AGENT_RADAR = [
  ['sprache', 'Sprachkompetenz', 55], ['tradecraft', 'Kampferfahrung', 90], ['cyber', 'Cyber', 80],
  ['physis', 'Physis', 70], ['stress', 'Sozialkompetenz', 97]
];
function arbeitsProfilStatus() {
  return ARBEITS_STATUS.includes(PROFIL.arbeitsstatus) ? PROFIL.arbeitsstatus : 'Offline';
}
function arbeitsProfilSpeichern(feldName, wert) {
  const alt = PROFIL[feldName];
  PROFIL[feldName] = wert;
  if (profilSpeichern()) return true;
  if (alt === undefined) delete PROFIL[feldName];
  else PROFIL[feldName] = alt;
  meldung('Änderung konnte nicht gespeichert werden.');
  return false;
}
function radarWerte() {
  return AGENT_RADAR.map(function (a) {
    const n = PROFIL.agentRadar && PROFIL.agentRadar[a[0]];
    return Number.isInteger(n) && n >= 0 && n <= 100 ? n : a[2];
  });
}
function radarGrafik(werte) {
  const punkt = function (i, wert) {
    const a = 2 * Math.PI * i / AGENT_RADAR.length;
    return [180 + Math.sin(a) * wert, 135 - Math.cos(a) * wert];
  };
  const punkte = function (w) { return w.map(function (v, i) { return punkt(i, v).join(','); }).join(' '); };
  return s('svg', { class: 'profil-radar', viewBox: '-30 0 420 250', 'aria-hidden': 'true' },
    [20, 40, 60, 80, 100].map(function (n) {
      return s('polygon', { points: punkte(AGENT_RADAR.map(function () { return n; })), class: 'profil-radar-ring' });
    }),
    AGENT_RADAR.map(function (_, i) {
      const p = punkt(i, 100);
      return s('line', { x1: 180, y1: 135, x2: p[0], y2: p[1], class: 'profil-radar-ring' });
    }),
    s('polygon', { points: punkte(werte), class: 'profil-radar-form' }),
    AGENT_RADAR.map(function (a, i) {
      const p = punkt(i, 113), v = punkt(i, werte[i]);
      return [
        s('circle', { cx: v[0], cy: v[1], r: 2.8, class: 'profil-radar-punkt' }),
        s('text', { x: p[0], y: p[1], 'text-anchor': i === 0 ? 'middle' : i < 3 ? 'start' : 'end', class: 'profil-radar-text' }, a[1])
      ];
    }));
}
function agentRadarPanel(stand) {
  const werte = stand.radar;
  return panel('Kompetenzprofil', h('span', { class: 'badge' }, 'SIMULATION · 0–100'),
    h('div', { class: 'profil-radar-inhalt' },
      radarGrafik(werte),
      h('dl', { class: 'profil-radar-werte' }, AGENT_RADAR.map(function (a, i) {
        return h('div', null, h('dt', null, a[1]), h('dd', { class: 'mono' }, String(werte[i])));
      }))),
    stand.quelle !== 'eigen' ? null : h('details', { class: 'pad' }, h('summary', null, 'Werte bearbeiten'),
      h('p', { class: 'note' }, 'Deine Startwerte sind vorbelegt. Änderungen bleiben in diesem Browser und lösen nichts aus.'),
      h('form', { class: 'profil-radar-formular', onsubmit: function (ev) {
        ev.preventDefault();
        const neu = {};
        AGENT_RADAR.forEach(function (a) { neu[a[0]] = ev.target.elements[a[0]].valueAsNumber; });
        if (AGENT_RADAR.every(function (a) { const n = neu[a[0]]; return Number.isInteger(n) && n >= 0 && n <= 100; }) &&
            arbeitsProfilSpeichern('agentRadar', neu)) {
          renderModule();
          $('profil-radar-speichern').closest('details').querySelector('summary').focus();
        }
      } }, AGENT_RADAR.map(function (a, i) {
        const id = 'radar-' + a[0];
        return h('label', { for: id }, a[1], h('input', { id: id, name: a[0], type: 'number', min: 0, max: 100, step: 1, required: true, value: werte[i] }));
      }), h('button', { id: 'profil-radar-speichern', type: 'submit' }, 'Werte speichern'))));
}
const PSYCH_FAKTOREN = [
  ['stress', 'Stressresistenz', 90], ['stabil', 'Emotionale Stabilität', 90],
  ['druck', 'Entscheidungsfähigkeit unter Druck', 90], ['belastung', 'Körperliche Belastungstoleranz', 100],
  ['impuls', 'Impulskontrolle', 70], ['erholung', 'Erholungsfähigkeit', 50]
];
const ASSESSMENT_VORLAGEN = {
  B: { radar: [71, 65, 76, 70, 74], psycho: [69, 77, 72, 71, 78, 74] },
  C: { radar: [55, 49, 61, 59, 53], psycho: [52, 61, 55, 59, 57, 52] }
};
function assessmentWertGueltig(n) { return Number.isInteger(n) && n >= 0 && n <= 100; }
function psychoWerte() {
  return PSYCH_FAKTOREN.map(function (a) {
    const n = PROFIL.agentPsycho && PROFIL.agentPsycho[a[0]];
    return assessmentWertGueltig(n) ? n : a[2];
  });
}
function assessmentRotationGueltig(r) {
  return !!r && typeof r.start === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.start) &&
    Number.isFinite(Date.parse(r.start)) && typeof r.bZuerst === 'boolean';
}
let assessmentRotationErsatz;
function assessmentRotation(now) {
  if (assessmentRotationGueltig(PROFIL.assessmentRotation)) return PROFIL.assessmentRotation;
  if (assessmentRotationErsatz) return assessmentRotationErsatz;
  const start = new Date(now).toISOString().slice(0, 10);
  const neu = { start: start, bZuerst: Math.random() < .5 };
  if (!arbeitsProfilSpeichern('assessmentRotation', neu)) assessmentRotationErsatz = neu;
  return neu;
}
function assessmentTermin(start, periode) {
  const d = new Date(start), tag = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + 3 * periode);
  const letzter = new Date(d);
  letzter.setUTCMonth(letzter.getUTCMonth() + 1, 0);
  d.setUTCDate(Math.min(tag, letzter.getUTCDate()));
  return d.getTime();
}
function assessmentStand(now) {
  const rotation = assessmentRotation(now), start = new Date(rotation.start);
  const n = new Date(now);
  const monate = (n.getUTCFullYear() - start.getUTCFullYear()) * 12 + n.getUTCMonth() - start.getUTCMonth();
  let periode = Math.max(0, Math.floor(monate / 3));
  if (periode && now < assessmentTermin(start, periode)) periode--;
  const reihe = rotation.bZuerst ? ['eigen', 'B', 'C'] : ['eigen', 'C', 'B'];
  const daten = function (p) {
    const quelle = reihe[p % reihe.length], vorlage = ASSESSMENT_VORLAGEN[quelle];
    const radar = vorlage ? vorlage.radar : radarWerte(), psycho = vorlage ? vorlage.psycho : psychoWerte();
    const alle = radar.concat(psycho);
    const score = Math.round(alle.reduce(function (a, b) { return a + b; }, 0) / alle.length);
    const note = score >= 80 ? ['A', 'sehr gut'] : score >= 65 ? ['B', 'solide'] : score >= 50 ? ['C', 'knapp bestanden'] : ['D', 'nicht bestanden'];
    return { quelle: quelle, am: assessmentTermin(start, p), radar: radar, psycho: psycho, score: score, note: note };
  };
  const liste = [];
  for (let p = periode; p >= 0 && p > periode - 3; p--) liste.push(daten(p));
  return { aktuell: liste[0], liste: liste, phase: periode % 3 + 1, naechster: assessmentTermin(start, periode + 1) };
}
function psychoPanel(stand) {
  const werte = stand.psycho;
  return panel('Psychologisches Profil', h('span', { class: 'badge' }, '0–100'),
    h('dl', { class: 'profil-psycho pad' }, PSYCH_FAKTOREN.map(function (a, i) {
      return h('div', null, h('dt', null, a[1]), h('dd', null,
        h('meter', { min: 0, max: 100, value: werte[i], 'aria-label': a[1] }),
        h('span', { class: 'mono' }, String(werte[i]))));
    })),
    stand.quelle !== 'eigen' ? null : h('details', { class: 'pad' }, h('summary', null, 'Psychologische Werte bearbeiten'),
      h('form', { class: 'profil-radar-formular', onsubmit: function (ev) {
        ev.preventDefault();
        const neu = {};
        PSYCH_FAKTOREN.forEach(function (a) { neu[a[0]] = ev.target.elements[a[0]].valueAsNumber; });
        if (Object.values(neu).every(assessmentWertGueltig) && arbeitsProfilSpeichern('agentPsycho', neu)) {
          renderModule();
          $('profil-psycho-speichern').closest('details').querySelector('summary').focus();
        }
      } }, PSYCH_FAKTOREN.map(function (a, i) {
        return h('label', null, a[1], h('input', { name: a[0], type: 'number', min: 0, max: 100, step: 1, required: true, value: werte[i] }));
      }), h('button', { id: 'profil-psycho-speichern', type: 'submit' }, 'Werte speichern'))));
}
function assessmentZyklusPanel(stand) {
  return panel('Assessment-Zyklus', h('span', { class: 'badge' }, 'Phase ' + stand.phase + ' / 3'),
    h('dl', { class: 'fields profil-zyklus-daten' },
      feld('Aktueller Stichtag', fmtDatum(stand.aktuell.am)),
      feld('Nächster Stichtag', fmtDatum(stand.naechster))),
    h('ol', { class: 'profil-zyklus pad', 'aria-label': 'Phasen der aktuellen Rotation' }, [1, 2, 3].map(function (n) {
      return h('li', { 'aria-current': n === stand.phase ? 'step' : null, class: n < stand.phase ? 'erledigt' : '' },
        h('span', { class: 'mono' }, '0' + n), h('span', null, n === stand.phase ? 'Aktuell' : n < stand.phase ? 'Abgelaufen' : 'Ausstehend'));
    })));
}
function assessmentSparkline(liste) {
  const werte = liste.slice().reverse().map(function (x) { return x.score; });
  const x = function (i) { return 5 + i * 126 / (werte.length - 1); };
  const y = function (n) { return 38 - n * .32; };
  return s('svg', { viewBox: '0 0 136 43', role: 'img', 'aria-label': 'Scoreverlauf von alt nach neu, Skala 0 bis 100: ' + werte.join(', ') },
    [0, 50, 100].map(function (n) { return s('line', { class: 'profil-verlauf-raster', x1: 5, x2: 131, y1: y(n), y2: y(n) }); }),
    s('polyline', { class: 'profil-verlauf-linie', points: werte.map(function (n, i) { return x(i) + ',' + y(n); }).join(' ') }),
    werte.map(function (n, i) { return s('circle', { class: 'profil-radar-punkt', cx: x(i), cy: y(n), r: 2.4 }); }));
}
function assessmentVerlaufPanel(stand) {
  const verlauf = panel('Assessment-Verlauf', h('span', { class: 'badge' }, stand.liste.length + ' / 3 Einträge'),
    tabelle(['Datum', 'Gesamtscore', 'Note'], stand.liste.map(function (x) {
      return [td('nw', fmtDatum(x.am)), td('nw', x.score + ' / 100'),
        h('span', { class: 'label ' + (x.note[0] === 'A' ? 's-accent' : x.note[0] === 'C' ? 's-warn' : x.note[0] === 'D' ? 's-crit' : 's-dim') }, x.note.join(' · '))];
    }), ''),
    h('div', { class: 'profil-verlauf-fuss pad' },
      h('div', { class: 'profil-noten' }, h('span', { class: 'dim' }, 'Notenschwellen'),
        h('span', { class: 'mono' }, 'C ≥ 50 · B ≥ 65 · A ≥ 80')),
      stand.liste.length > 1 ? h('div', { class: 'profil-spark' }, h('span', { class: 'dim' }, 'Scoreverlauf'), assessmentSparkline(stand.liste)) :
        h('span', { class: 'dim profil-verlauf-hinweis' }, 'Verlaufsgrafik ab dem zweiten Eintrag')));
  verlauf.id = 'profil-verlauf';
  return verlauf;
}
function assessmentAnsicht(kennung, now) {
  const plan = assessmentStand(now);
  return h('div', { id: 'profil-assessment', 'data-wechsel': plan.naechster },
    h('div', { class: 'cols' }, h('div', { class: 'profil-kennung-spalte' }, kennung, assessmentZyklusPanel(plan)), agentRadarPanel(plan.aktuell)),
    h('div', { class: 'cols' }, psychoPanel(plan.aktuell), assessmentVerlaufPanel(plan)));
}
function profilAssessmentAktualisieren(now) {
  const box = $('profil-assessment');
  if (!box || now < Number(box.dataset.wechsel)) return;
  box.replaceWith(assessmentAnsicht($('profil-kennung'), now));
}

const TERMINAL_RELAY = 'https://www.wikidata.org/w/api.php?action=query&meta=siteinfo&siprop=general&format=json&origin=*';
const TERMINAL_DB = 'pgcl-eu3.arch07';
const TERMINAL_UBUNTU = 'Linux ubuntu-server 6.8.0-45-generic #45-Ubuntu SMP PREEMPT_DYNAMIC Fri Aug 30 12:02:04 UTC 2024 x86_64 x86_64 x86_64 GNU/Linux';
function terminalBrueckenAdresse() { return /^#db=(\d{1,5})\.([\w-]{43})$/.exec(window.location.hash); }
const TERMINAL_BRUECKE_START = 'Starte START_TERMINAL.bat erneut und lass das Konsolenfenster offen.';
const TERMINAL_BRUECKE_FEHLER = 'Lokale Datenbank nicht erreichbar. ' + TERMINAL_BRUECKE_START;
const TERMINAL_BRUECKE_FEHLT = 'Lokale Datenbank nicht verbunden. Starte START_TERMINAL.bat.';
let terminalTabFehlerZuletzt = '';
function terminalTabFehler(lauf, antwort) {
  if (terminalTabGueltig(lauf) && antwort.error && terminalTabFehlerZuletzt !== antwort.error) {
    terminalTabFehlerZuletzt = antwort.error;
    terminalAusgabe('Tab: ' + antwort.error);
  }
}
function terminalPfad(arg) {
  const out = TERMINAL_ZUSTAND.ort.slice();
  if (/^[\\/]|[:\\]|[\u0000-\u001f\u007f]/.test(arg)) return null;
  for (const name of arg.split('/')) {
    if (!name || name === '.') continue;
    if (name === '..') out.pop();
    else out.push(name);
  }
  return out;
}
// Pfade der Oberfläche beginnen an einer virtuellen Wurzel. Nur der Archivzweig geht an die Brücke.
function terminalShellPfad(arg) {
  if (/[:\\]|[\u0000-\u001f\u007f]/.test(arg)) return null;
  const ort = TERMINAL_ZUSTAND.ort;
  const absolut = arg.startsWith('/') || arg === '~' || arg.startsWith('~/');
  const out = absolut ? [] : ort ? [TERMINAL_DB].concat(ort) : (TERMINAL_ZUSTAND.virtuellerOrt || []).slice();
  for (const name of (arg === '~' || arg.startsWith('~/') ? arg.slice(1) : arg).split('/')) {
    if (!name || name === '.') continue;
    if (name === '..') out.pop();
    else out.push(name);
  }
  return out;
}
const TERMINAL_TLE_DIRS = new Map([['/var', ['cache/', 'log/']], ['/var/cache', ['tle/']],
  ['/var/cache/tle', ['leo.txt', 'iridium.tle']], ['/var/log', ['syslog']]]);
const TERMINAL_TLE_DATEI = '/var/cache/tle/leo.txt';
function terminalArbeitsverzeichnis() {
  const t = TERMINAL_ZUSTAND;
  return '/' + (t.ort ? [TERMINAL_DB].concat(t.ort) : t.virtuellerOrt || []).join('/');
}
async function terminalBruecke(op, parts, hidden, exportDaten) {
  const bruecke = terminalBrueckenAdresse();
  if (!bruecke) return { error: TERMINAL_BRUECKE_FEHLT };
  const controller = new AbortController();
  const t = setTimeout(function () { controller.abort(); }, op === 'disconnect' ? 1500 : 7500);
  try {
    const r = await fetch('http://127.0.0.1:' + bruecke[1] + '/db', {
      method: 'POST', cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer', redirect: 'error',
      headers: { 'Content-Type': 'application/json', 'X-Shadow-Token': bruecke[2] },
      body: JSON.stringify(op === 'export-txt' ? {
        op: op, folder: exportDaten.ordner, kind: exportDaten.art, id: exportDaten.id, text: exportDaten.text,
        last: exportDaten.last || undefined
      } : { op: op, parts: parts, hidden: hidden }), signal: controller.signal
    });
    if (!r.ok) return { error: r.status === 403 ? 'Zugriff auf die lokale Datenbank verweigert. ' + TERMINAL_BRUECKE_START : TERMINAL_BRUECKE_FEHLER };
    const antwort = await r.json();
    if (antwort.error === 'Lokale Sitzung getrennt') antwort.error += '. ' + TERMINAL_BRUECKE_START;
    return antwort;
  } catch (ex) {
    return { error: TERMINAL_BRUECKE_FEHLER };
  } finally { clearTimeout(t); }
}
function terminalSitzungTrennen() {
  terminalKanalAbbruch();
  if (!terminalBrueckenAdresse()) return;
  TERMINAL_ZUSTAND.version++;
  terminalTransferStop();
  TERMINAL_ZUSTAND.ort = null;
  TERMINAL_ZUSTAND.virtuellerOrt = null;
  return terminalBruecke('disconnect');
}
function terminalPrompt() {
  if (TERMINAL_ZUSTAND.orbitLive) return 'predict -f · Ctrl+C';
  if (terminalPppWaehltVorne()) return '';
  if (TERMINAL_ZUSTAND.kette && !TERMINAL_ZUSTAND.kanal) return '';
  const kanal = TERMINAL_ZUSTAND.kanal;
  if (kanal?.ui === 'xmpp') return '>';
  if (kanal) return kanal.phase === 'eingabe' ? 'you >' : '…';
  return 'root@terminal:' + terminalArbeitsverzeichnis() + '#';
}
function terminalName(arg) {
  if (!arg) return '';
  if (arg[0] === '"' || arg[0] === "'") return arg.length >= 2 && arg.endsWith(arg[0]) ? arg.slice(1, -1) : null;
  return arg;
}
function terminalDownload(d, daten) {
  const url = URL.createObjectURL(new Blob([daten], { type: 'application/octet-stream' }));
  const a = h('a', { href: url, download: d.name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
}
function terminalDateigroesse(bytes) {
  const zahl = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 });
  return bytes >= 1048576 ? zahl.format(bytes / 1048576) + ' MiB' :
    bytes >= 1024 ? zahl.format(bytes / 1024) + ' KiB' : bytes + ' B';
}
function terminalTransferZeile(name, gesamt, anteil, dauer, rest) {
  const prozent = Math.floor(anteil * 100), fuellung = Math.floor(anteil * 30);
  const balken = '='.repeat(fuellung) + '>'.padEnd(31 - fuellung, ' ');
  const sek = (ms) => (ms / 1000).toLocaleString('de-DE', { maximumFractionDigits: 2 }) + ' s';
  return name + '  ' + String(prozent).padStart(3) + '%[' + balken + ']  ' +
    terminalDateigroesse(Math.floor(gesamt * anteil)) + ' / ' + terminalDateigroesse(gesamt) +
    '  in ' + sek(dauer) + (rest ? '  ETA ' + sek(rest) : '');
}
function terminalTransferAktualisieren() {
  const feld = $('profil-terminal-transfer');
  if (!feld) return;
  feld.textContent = TERMINAL_ZUSTAND.fortschritt;
  feld.hidden = !TERMINAL_ZUSTAND.fortschritt;
}
function terminalTransferStop() {
  TERMINAL_ZUSTAND.fortschritt = '';
  terminalTransferAktualisieren();
}
async function terminalTransfer(name, bytes, weiter, simMs, zeitErhalten = false) {
  const t = TERMINAL_ZUSTAND, start = performance.now();
  // Animation for a local copy, not a measurement of a remote network.
  const dauer = !zeitErhalten && matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 :
    (simMs ?? Math.min(6500, 550 + bytes / (1.5 * 1024)));
  do {
    if (!weiter()) return null;
    const zeit = performance.now() - start;
    if (zeit >= dauer) return terminalTransferZeile(name, bytes, 1, zeit, 0);
    t.fortschritt = terminalTransferZeile(name, bytes, zeit / dauer, zeit, dauer - zeit);
    terminalTransferAktualisieren();
    await new Promise(function (ok) { setTimeout(ok, Math.max(1, Math.ceil(Math.min(120, dauer - zeit)))); });
  } while (true);
}
function terminalWgetProtokoll(antwort, pfad, von, bytes) {
  const uri = 'https://' + antwort.endpoint + '/' + [TERMINAL_DB].concat(pfad).map(encodeURIComponent).join('/');
  return [
    '--' + von.toISOString().slice(0, 19).replace('T', ' ') + 'Z--  ' + uri,
    'Verbindungsaufbau zu ' + antwort.endpoint + ':443 … verbunden (lokal).',
    'Antwort der Archivbrücke … 200 OK',
    'Länge: ' + bytes + ' (' + terminalDateigroesse(bytes) + ')',
    'Wird an den Browser-Download übergeben: »' + antwort.name + '«'
  ];
}
async function terminalDateiBefehl(befehl, arg, version) {
  const t = TERMINAL_ZUSTAND;
  const lsLang = befehl === 'ls' && ['-l', '-la', '-al'].includes(arg);
  const lsAlle = befehl === 'ls' && ['-a', '-la', '-al'].includes(arg);
  const name = terminalName(arg);
  if (name === null) { terminalAusgabe(befehl + ': unterminated quote'); return 1; }
  if (befehl === 'ls' && arg.startsWith('-') && !lsLang && !lsAlle) {
    terminalAusgabe("ls: unrecognized option '" + arg + "'"); return 1;
  }
  if (!name && ['cat', 'head', 'tail', 'wget'].includes(befehl)) { terminalAusgabe(befehl + ': missing file operand'); return 1; }
  const virtuell = terminalShellPfad(befehl === 'cd' && !name ? '/' : lsLang || lsAlle ? '' : name);
  const nichtGefunden = befehl + ': ' + name + ': No such file or directory';
  if (!virtuell) { terminalAusgabe(befehl + ': ' + name + ': Permission denied'); return 1; }
  const voll = '/' + virtuell.join('/');
  const listing = !virtuell.length ? ['var/', TERMINAL_DB + '/'] : TERMINAL_TLE_DIRS.get(voll);
  if (listing) {
    if (befehl === 'cd') { t.ort = null; t.virtuellerOrt = virtuell; terminalKanalPromptSync(); return 0; }
    if (befehl === 'ls') { terminalAusgabe(listing.join('\n')); return 0; }
    terminalAusgabe(befehl + ': ' + name + ': Is a directory');
    return 1;
  }
  if (voll === '/var/log/syslog' || voll === TERMINAL_TLE_DATEI || voll === TERMINAL_PPP_DATEI) {
    if (befehl === 'cd') { terminalAusgabe('cd: ' + name + ': Not a directory'); return 1; }
    if (befehl === 'wget') { terminalAusgabe('wget: ' + name + ': unsupported source'); return 1; }
    if (befehl === 'ls') terminalAusgabe(virtuell.at(-1));
    else if (voll === '/var/log/syslog') terminalSyslog(befehl === 'cat' ? 60 : 10);
    else if (voll === TERMINAL_PPP_DATEI) terminalAusgabe('IRIDIUM 142');
    else terminalAusgabe('IRIDIUM-142\nProfile: demo LEO pass\nAzimuth: 142°\nElevation: 48°');
    return 0;
  }
  if (virtuell[0] !== TERMINAL_DB) { terminalAusgabe(nichtGefunden); return 1; }
  const pfad = virtuell.slice(1);
  const wgetStart = befehl === 'wget' ? new Date() : null;
  const antwort = await terminalBruecke(befehl, pfad, lsAlle);
  if (t.version !== version) return 1;
  if (antwort.error) {
    terminalAusgabe(antwort.error === 'Datei oder Ordner nicht gefunden' ? nichtGefunden : befehl + ': ' + antwort.error);
    return 1;
  }
  if (befehl === 'cd') {
    t.ort = pfad;
    t.virtuellerOrt = null;
    terminalKanalPromptSync();
  } else if (befehl === 'ls') {
    const zeilen = antwort.entries.map(function (x) {
      return lsLang ? (x.dir ? 'dr-x' : '-r--') + '  ' + String(x.bytes).padStart(8) + '  ' + fmtZ(x.mtime * 1000) + '  ' + x.name + (x.dir ? '/' : '') :
        x.name + (x.dir ? '/' : '');
    });
    terminalAusgabe(zeilen.join('\n') || '(leer)');
  } else if (befehl === 'wget') {
    const daten = Uint8Array.from(atob(antwort.data), function (c) { return c.charCodeAt(0); });
    const bytes = daten.byteLength;
    terminalAusgabe(terminalWgetProtokoll(antwort, pfad, wgetStart, bytes));
    const fertig = await terminalTransfer(antwort.name, bytes, function () { return t.version === version; });
    if (t.version !== version) return 1;
    terminalTransferStop();
    terminalDownload(antwort, daten);
    terminalAusgabe([fertig, 'Empfangen [' + bytes + '/' + bytes + '] · Download gestartet']);
  } else terminalAusgabe(antwort.text);
  return 0;
}

const TERMINAL_ZUSTAND = { offen: false, ausgabe: [], prueft: false, dateiLaeuft: false, version: 0, ort: null, virtuellerOrt: null, kanal: null, fortschritt: '', verlauf: [], vpos: -1, entwurf: '', satAufbau: null, satLink: null, orbitLive: false, modem: null, modemEnde: null, wgSat: null, syslog: [], kette: null, status: 0 };
function terminalAusgabe(zeile) {
  const t = TERMINAL_ZUSTAND;
  t.ausgabe = t.ausgabe.concat(zeile).slice(-45);
  terminalPppAnzeige();
  const el = $('profil-terminal-ausgabe');
  if (!el) return;
  el.textContent = t.ausgabe.join('\n');
  el.scrollTop = el.scrollHeight;
}
async function terminalPing() {
  const t = TERMINAL_ZUSTAND;
  if (t.prueft) { terminalAusgabe('ping: relay: operation in progress'); return false; }
  t.prueft = true;
  const version = t.version, start = performance.now(), abbruch = new AbortController();
  const timeout = setTimeout(function () { abbruch.abort(); }, 8000);
  const ergebnis = function (text) { if (t.version === version) terminalAusgabe(text); };
  try {
    const antwort = await fetch(TERMINAL_RELAY, { credentials: 'omit', referrerPolicy: 'no-referrer',
      redirect: 'error', cache: 'no-store', signal: abbruch.signal });
    if (!antwort.ok) { ergebnis('relay · HTTPS · HTTP ' + antwort.status); return false; }
    const daten = await antwort.json();
    if (!daten.query || !daten.query.general) { ergebnis('relay · HTTPS · unerwartete Antwort'); return false; }
    ergebnis('relay · HTTPS · ' + Math.max(1, Math.round(performance.now() - start)) + ' ms');
    return true;
  } catch (e) {
    ergebnis('relay · HTTPS · ' + (abbruch.signal.aborted ? 'Zeitlimit überschritten' : 'nicht erreichbar'));
    return false;
  } finally {
    clearTimeout(timeout);
    t.prueft = false;
  }
}
/* A staged dialogue, not a transport. No socket, storage, real key or mission state. */
const TERMINAL_SAT_TX_TEILE = ['--target', 'IRIDIUM-142', '--device', 'limesdr', '--iface', 'sat0', '--tle', '/var/cache/tle/leo.txt'];
const TERMINAL_SAT_TX_BEFEHL = 'satcon-tx ' + TERMINAL_SAT_TX_TEILE.join(' ');
const TERMINAL_SAT_KANAL_TEILE = ['--connect', '--iface', 'sat0', '--route', 'mixnet', '--ephemeral'];
const TERMINAL_SAT_KANAL_ARG = TERMINAL_SAT_KANAL_TEILE.join(' ');
const TERMINAL_SAT_RATE = 2400, TERMINAL_SAT_MTU = 512, TERMINAL_SAT_CAP_MS = 60000;
function terminalSatRest(link) {
  const sek = Math.max(0, Math.ceil((link.bis - Date.now()) / 1000));
  return String(Math.floor(sek / 60)).padStart(2, '0') + 'm ' + String(sek % 60).padStart(2, '0') + 's';
}
function terminalSatAnzeige() {
  const feld = $('profil-terminal-sat');
  if (!feld) return;
  const t = TERMINAL_ZUSTAND, link = t.satLink;
  // Ein berechneter Überflug allein belegt keine Verbindung; der Countdown gilt nur, solange die Einwahl steht.
  const sichtbar = !!link && (link.modus !== 'ppp' || (!link.abgelaufen && !!(t.modem || t.wgSat || t.kanal?.ui === 'xmpp')));
  feld.hidden = !sichtbar;
  feld.textContent = sichtbar ? (link.modus === 'ppp' ? 'IRIDIUM 142' : 'sat0') + ' · LOS ' + terminalSatRest(link) : '';
  terminalPppAnzeige();
}
function terminalSatLinkAktiv(link) {
  if (TERMINAL_ZUSTAND.satLink !== link) return false;
  if (Date.now() < link.bis) return true;
  if (link.modus === 'ppp') {
    if (!link.abgelaufen) {
      link.abgelaufen = true;
      clearInterval(link.timer);
      terminalPppModemAus('Modem hangup (NO CARRIER)');
      terminalSatAnzeige();
    }
    return false;
  }
  const transfer = TERMINAL_ZUSTAND.kanal?.phase === 'transfer';
  terminalKanalAbbruch();
  terminalAusgabe(transfer ? ['[!] Loss of signal · sat0 down.', 'send: transfer interrupted'] : '[!] Loss of signal · sat0 down.');
  return false;
}
function terminalSatAbbruch() {
  const t = TERMINAL_ZUSTAND, alt = t.satAufbau;
  if (t.satLink) clearInterval(t.satLink.timer);
  t.satLink = null;
  terminalOrbitEnde();
  if (t.wgSat) clearTimeout(t.wgSat.timer);
  if (t.modem) { clearTimeout(t.modem.timer); terminalVordergrundEnde(t.modem, 1); }
  if (t.wgSat) terminalVordergrundEnde(t.wgSat, 1);
  t.modem = t.wgSat = null;
  t.modemEnde = null;
  terminalSatAnzeige();
  terminalKanalPromptSync();
  t.satAufbau = null;
  if (alt) alt.abbrechen();
}
async function terminalSatTxStart(arg) {
  const t = TERMINAL_ZUSTAND;
  if (arg.split(/\s+/).join(' ') !== TERMINAL_SAT_TX_TEILE.join(' ')) { terminalAusgabe('usage: ' + TERMINAL_SAT_TX_BEFEHL); return 1; }
  if (t.satAufbau || t.dateiLaeuft || t.prueft) { terminalAusgabe('satcon-tx: operation in progress'); return 1; }
  if (t.modem || t.wgSat) { terminalAusgabe('satcon-tx: ppp0 or wg-sat is in use'); return 1; }
  terminalSatAbbruch();
  const aufbau = { abbrechen: function () {} };
  t.satAufbau = aufbau;
  const reduziert = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const schritte = [
    [0, '[*] Loading TLE profile... Satellite in range (Azimuth: 142°, Elevation: 48°).'],
    [600, '[*] Initializing LimeSDR TX/RX stream...'],
    [1400, '[*] Locking downlink beacon...'],
    [2800, '[*] Lock acquired. Doppler compensation active.'],
    [900, '[*] Transmitting burst handshake...'],
    [4500, '[*] Link layer authenticated. Interface [sat0] is UP (MTU: 512, Rate: 2.4 kbps).'],
    [500, '']
  ];
  for (const [pause, text] of schritte) {
    if (pause && !reduziert) await new Promise(function (ok) {
      const timer = setTimeout(ok, pause);
      aufbau.abbrechen = function () { clearTimeout(timer); ok(); };
    });
    if (t.satAufbau !== aufbau) return 130;
    if (text) terminalAusgabe(text);
  }
  t.satAufbau = null;
  const link = { bis: Date.now() + (300 + terminalKanalZufall(601)) * 1000, timer: null };
  t.satLink = link;
  link.timer = setInterval(function () { if (terminalSatLinkAktiv(link)) terminalSatAnzeige(); }, 250);
  terminalSatAnzeige();
  terminalAusgabe('[*] Orbital pass window remaining: ' + terminalSatRest(link) + '.');
  return 0;
}
const TERMINAL_KANAL_LINIE = '────────────────────────────────────────';
function terminalKanalZufall(n) {
  return crypto.getRandomValues(new Uint32Array(1))[0] % n;
}
function terminalKanalZeichen(alphabet, laenge) {
  return Array.from({ length: laenge }, function () { return alphabet[terminalKanalZufall(alphabet.length)]; }).join('');
}
// Läuft ein Befehl im Vordergrund ohne eigene Eingabe, nimmt die Shell keine Zeile an; die Eingabe bleibt stehen.
function terminalBeschaeftigt() {
  const t = TERMINAL_ZUSTAND;
  return terminalPppWaehltVorne() || (!!t.kette && !t.kanal && !t.orbitLive);
}
function terminalKanalPromptSync() {
  const label = $('profil-terminal-prompt');
  if (!label) return;
  // Der Prompt ändert die Höhe der Eingabezeile; war die Ausgabe unten, bleibt sie unten.
  const aus = $('profil-terminal-ausgabe');
  const unten = !!aus && aus.scrollHeight - aus.scrollTop - aus.clientHeight < 4;
  label.textContent = terminalPrompt();
  label.parentElement?.setAttribute('aria-busy', terminalBeschaeftigt() ? 'true' : 'false');
  if (unten) aus.scrollTop = aus.scrollHeight;
}
function terminalKanalAbbruch() {
  const t = TERMINAL_ZUSTAND;
  terminalSatAbbruch();
  if (!t.kanal) return;
  const kanal = t.kanal;
  if (kanal.ui === 'xmpp') { terminalPppChatAus(); return; }
  t.ausgabe = kanal.vorher;
  t.kanal = null;
  terminalVordergrundEnde(kanal, 0);
  if (kanal.pauseBeenden) kanal.pauseBeenden();
  terminalTransferStop();
  const eingabe = $('profil-terminal-eingabe');
  if (eingabe) terminalEingabeSetzen(eingabe, '');
  terminalKanalPromptSync();
  terminalAusgabe([]);
}
const TERMINAL_KANAL_TEMPO = { antwort: 15000, vorAbbau: 2000, abbau: 650 };
function terminalKanalPause(kanal, ms) {
  return new Promise(function (ok) {
    const fertig = function () {
      clearTimeout(timer);
      kanal.pauseBeenden = null;
      ok(TERMINAL_ZUSTAND.kanal === kanal && terminalSatLinkAktiv(kanal.link));
    };
    const timer = setTimeout(fertig, ms);
    kanal.pauseBeenden = fertig;
  });
}
async function terminalKanalFolge(kanal, zeilen, pause) {
  const reduziert = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  for (const zeile of zeilen) {
    if (!await terminalKanalPause(kanal, reduziert ? 0 : pause)) return false;
    terminalAusgabe(zeile);
  }
  return true;
}
function terminalKanalIdentitaet() {
  const hex = '0123456789abcdef', abc = 'abcdefghijklmnopqrstuvwxyz';
  return {
    knoten: 'NODE-' + String(terminalKanalZufall(10000)).padStart(4, '0') + '-' + terminalKanalZeichen(abc.toUpperCase(), 1),
    sitzung: [4, 4, 4].map(function (n) { return terminalKanalZeichen(hex, n); }).join('-'),
    kontakt: terminalKanalZeichen(abc, 14)
  };
}
function terminalIdentitaetZeilen(ident) {
  return [
    'Connected to:  ' + ident.knoten + '  (session: ' + ident.sitzung + ')',
    'Contact:       "' + ident.kontakt + '"',
  ];
}
async function terminalSatKanalStart() {
  const t = TERMINAL_ZUSTAND, link = t.satLink;
  if (!link || link.modus === 'ppp' || !terminalSatLinkAktiv(link)) { terminalAusgabe('secure-channel: sat0: Link is down'); return 1; }
  if (t.dateiLaeuft || t.prueft) { terminalAusgabe('secure-channel: operation in progress'); return 1; }
  const ident = terminalKanalIdentitaet(), kanal = { phase: 'start', vorher: t.ausgabe.slice(), link,
    knoten: ident.knoten, sitzung: ident.sitzung, kontakt: ident.kontakt };
  const ende = terminalVordergrund(kanal);
  t.kanal = kanal;
  terminalKanalPromptSync();
  terminalAusgabe('[*] Binding tunnel to interface [sat0]...');
  const schritte = [
    [300, '[*] Locking session memory... OK'],
    [400, '[*] Generating ephemeral key material... OK'],
    [900, '[*] Routing via 2-hop terrestrial relay...'],
    [1500, '[*] Establishing peer handshake...'],
    [2100, '[*] Initializing Double-Ratchet state... OK'],
    [300, '[*] Verifying safety numbers... OK'],
    [300, '']
  ];
  const reduziert = matchMedia('(prefers-reduced-motion: reduce)').matches;
  for (const [pause, text] of schritte) {
    if (!await terminalKanalPause(kanal, reduziert ? 0 : pause)) return ende;
    if (text) terminalAusgabe(text);
  }
  terminalAusgabe(terminalIdentitaetZeilen(ident).concat([
    'Transport:     sat0 (IRIDIUM-142) · 2.4 kbps Burst-Mode',
    'Window:        ' + terminalSatRest(link) + ' remaining before loss of signal (LOS)', TERMINAL_KANAL_LINIE
  ]));
  kanal.phase = 'eingabe';
  terminalKanalPromptSync();
  return ende;
}
function terminalArchivDateipfad(arg) {
  const name = terminalName(arg);
  if (!name) return null;
  const prefix = '/' + TERMINAL_DB + '/';
  if (name.startsWith(prefix)) {
    const teile = name.slice(prefix.length).split('/');
    return teile.every(function (x) {
      return x !== '' && x !== '.' && x !== '..' && !/[:\\\u0000-\u001f\u007f]/.test(x);
    }) ? teile : null;
  }
  return TERMINAL_ZUSTAND.ort && terminalPfad(name);
}
async function terminalKanalDatei(arg, kanal) {
  const pfad = terminalArchivDateipfad(arg);
  if (!pfad || !pfad.length) {
    terminalAusgabe('send: Dateipfad innerhalb von /' + TERMINAL_DB + '/ erwartet.');
    return;
  }
  const t = TERMINAL_ZUSTAND, aktiv = function () {
    return t.kanal === kanal && terminalSatLinkAktiv(kanal.link);
  };
  kanal.phase = 'transfer';
  terminalKanalPromptSync();
  const antwort = await terminalBruecke('send', pfad);
  if (!aktiv()) return;
  if (antwort.error) {
    terminalAusgabe('send: ' + antwort.error);
  } else {
    const gepolstert = Math.max(64, Math.ceil(antwort.bytes / 64) * 64);
    const reellMs = gepolstert * 8000 / TERMINAL_SAT_RATE, simMs = Math.min(TERMINAL_SAT_CAP_MS, reellMs);
    terminalAusgabe([
      '[*] Preparing & padding payload (' + terminalDateigroesse(antwort.bytes) + ' → ' + terminalDateigroesse(gepolstert) + ').',
      '[*] Encrypting ' + Math.ceil(gepolstert / TERMINAL_SAT_MTU) + ' chunks for sat0 (MTU ' + TERMINAL_SAT_MTU + ' · 2.4 kbps).'
    ]);
    const fertig = await terminalTransfer(antwort.name, gepolstert, aktiv, simMs);
    if (!aktiv()) return;
    terminalTransferStop();
    terminalAusgabe([fertig, '[*] ACK received from peer [' + kanal.kontakt + '].']);
  }
  kanal.phase = 'eingabe';
  terminalKanalPromptSync();
}
async function terminalKanalMeldung(zeile, kanal) {
  if (zeile === '/close' || zeile === 'clear') {
    if (zeile === '/close' && kanal.phase === 'eingabe') await terminalSatKanalEnde(kanal, false);
    else terminalKanalAbbruch();
    return;
  }
  if (kanal.phase !== 'eingabe') return;
  if (/^send(?:\s|$)/.test(zeile)) {
    terminalAusgabe('you > ' + zeile);
    try {
      await terminalKanalDatei(zeile.slice(4).trim(), kanal);
    } catch (ex) {
      if (TERMINAL_ZUSTAND.kanal === kanal) {
        terminalTransferStop();
        kanal.phase = 'eingabe';
        terminalKanalPromptSync();
        terminalAusgabe('send: Dateioperation fehlgeschlagen');
      }
    }
    return;
  }
  if (!/^auftrag (erledigt|gescheitert)\.?$/i.test(zeile)) {
    terminalAusgabe('Erwartet: Auftrag erledigt. / Auftrag gescheitert.');
    return;
  }
  kanal.phase = 'ende';
  terminalKanalPromptSync();
  terminalAusgabe('you > ' + zeile);
  if (!await terminalKanalPause(kanal, TERMINAL_KANAL_TEMPO.antwort)) return;
  terminalAusgabe(['> Verstanden.', TERMINAL_KANAL_LINIE]);
  if (!await terminalKanalPause(kanal, TERMINAL_KANAL_TEMPO.vorAbbau)) return;
  await terminalSatKanalEnde(kanal, true);
}
async function terminalSatKanalEnde(kanal, bestaetigt) {
  kanal.phase = 'ende';
  terminalKanalPromptSync();
  const protokoll = ['[*] Sending CLOSE frame...', '[*] Wiping key material... done.',
    '[*] Detaching sat0 (RF carrier OFF)... done.', 'Connection terminated.'];
  terminalAusgabe(protokoll[0]);
  if (!await terminalKanalFolge(kanal, protokoll.slice(1, -1), TERMINAL_KANAL_TEMPO.abbau)) return;
  terminalKanalAbbruch();
  terminalAusgabe((bestaetigt ? ['> Verstanden.', TERMINAL_KANAL_LINIE] : []).concat(protokoll));
}

/* Fixed command grammar and in-memory state. No host processes, sockets or network configuration. */
const TERMINAL_PPP_DATEI = '/var/cache/tle/iridium.tle';
const TERMINAL_PPP_SAT = 'IRIDIUM 142';
const TERMINAL_PPP_ENDE = 'pppd[1401]: Connection terminated.';
function terminalPppZeit(ms) {
  return new Date(ms).toISOString().slice(11, 19);
}
function terminalPppZeile(link, ms) {
  const zeit = Math.max(link.von, Math.min(ms, link.bis));
  const datum = new Date(zeit);
  const tag = new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'UTC' }).format(datum);
  const mon = new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'UTC' }).format(datum);
  const iso = datum.toISOString();
  const faktor = (zeit - link.von) / (link.bis - link.von);
  const hoehe = Math.round(48 * Math.sin(Math.PI * faktor));
  const azimut = Math.round(112 + 203 * faktor);
  return [Math.floor(zeit / 1000), tag, iso.slice(8, 10) + mon + iso.slice(2, 4),
    terminalPppZeit(zeit), hoehe, azimut, Math.floor(192 + 42 * faktor) % 256,
    Math.round(51 + 4 * faktor), Math.round(7 + 9 * faktor),
    Math.round(2410 - 1498 * Math.sin(Math.PI * faktor)), link.orbit, '*'].join('  ');
}
function terminalPppAnzeige() {
  const t = TERMINAL_ZUSTAND, chat = t.kanal?.ui === 'xmpp' ? t.kanal : null;
  const oben = $('profil-terminal-orbit'), unten = $('profil-terminal-chat'), shell = $('profil-terminal-ausgabe');
  if (!oben || !unten || !shell) return;
  const live = t.orbitLive && !!t.satLink;
  oben.hidden = !chat && !live;
  oben.classList.toggle('orbit-live', live);
  unten.hidden = !chat;
  if (!chat && !live) { shell.hidden = false; return; }
  shell.hidden = !!chat;
  const link = chat ? chat.link : t.satLink;
  const daten = TERMINAL_PPP_SAT + '  [LOS ' + terminalSatRest(link) + ']\n' +
    terminalPppZeile(link, Date.now()) + (link.abgelaufen ? '\npppd: Modem hangup (NO CARRIER)' : '');
  if (oben.textContent !== daten) oben.textContent = daten;
  if (!chat) return;
  const text = chat.log.join('\n');
  if (unten.textContent !== text) {
    unten.textContent = text;
    unten.scrollTop = unten.scrollHeight;
  }
}
function terminalPppChatLog(chat, text) {
  if (TERMINAL_ZUSTAND.kanal !== chat) return;
  chat.log = chat.log.concat(terminalPppZeit(Date.now()) + ' - ' + text).slice(-70);
  terminalPppAnzeige();
}
function terminalPppLog(text) {
  const t = TERMINAL_ZUSTAND, jetzt = new Date();
  const tag = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(jetzt);
  t.syslog = t.syslog.concat(tag + ' ' + terminalPppZeit(+jetzt) + ' terminal ' + text).slice(-60);
}
function terminalPppChatAus() {
  const t = TERMINAL_ZUSTAND, chat = t.kanal;
  if (chat?.ui !== 'xmpp') return;
  clearTimeout(chat.antwort);
  clearTimeout(chat.abbruch);
  clearTimeout(chat.anmeldung);
  clearTimeout(chat.omemoAufbau);
  t.kanal = null;
  terminalVordergrundEnde(chat, 0);
  terminalTabReset();
  terminalTransferStop();
  const input = $('profil-terminal-eingabe');
  if (input) terminalEingabeSetzen(input, '');
  terminalKanalPromptSync();
  terminalSatAnzeige();
}
function terminalPppModemAus(grund, inShell = true) {
  const t = TERMINAL_ZUSTAND, modem = t.modem;
  if (modem) {
    clearTimeout(modem.timer);
    const zeilen = ['pppd[1401]: ' + grund, TERMINAL_PPP_ENDE];
    t.modemEnde = grund;
    zeilen.forEach(terminalPppLog);
    if (inShell) terminalAusgabe(zeilen);
    terminalVordergrundEnde(modem, grund.includes('signal 2') ? 5 : 1);
  }
  t.modem = null;
  terminalKanalPromptSync();
  terminalSatAnzeige();
  if (t.wgSat) t.wgSat.handshake = null;
  const chat = t.kanal;
  if (chat?.ui !== 'xmpp' || chat.phase === 'offline') return;
  const transfer = chat.phase === 'transfer';
  chat.phase = 'offline';
  clearTimeout(chat.antwort);
  clearTimeout(chat.anmeldung);
  clearTimeout(chat.omemoAufbau);
  terminalTabReset();
  terminalTransferStop();
  terminalPppChatLog(chat, 'pppd: ' + grund);
  chat.abbruch = setTimeout(function () {
    if (transfer) terminalPppChatLog(chat, 'Error uploading file: Network unreachable');
    terminalPppChatLog(chat, 'Disconnected from ' + chat.account);
  }, 750);
}
function terminalPppWaehltVorne() {
  const modem = TERMINAL_ZUSTAND.modem;
  return !!modem?.vordergrund && !modem.bereit;
}
function terminalPppEinwahl(link, vordergrund) {
  const t = TERMINAL_ZUSTAND, modem = { bereit: false, vordergrund, timer: null };
  t.modem = modem;
  t.modemEnde = null;
  terminalKanalPromptSync();
  terminalSatAnzeige();
  const schritte = [
    [0, ['chat[1402]: abort on (BUSY)', 'chat[1402]: abort on (NO CARRIER)']],
    [450, ['chat[1402]: send (AT+CSQ^M)']],
    [650, ['chat[1402]: +CSQ:4^M']],
    [450, ['chat[1402]: send (ATD*99***1#^M)']],
    [2400, ['chat[1402]: CONNECT 2400']],
    [900, ['pppd[1401]: Serial connection established.']],
    [750, ['pppd[1401]: Using interface ppp0']],
    [1900, ['pppd[1401]: local IP address 10.184.12.94']]
  ];
  const schritt = function (i) {
    if (t.modem !== modem || !terminalSatLinkAktiv(link)) return;
    const zeilen = schritte[i][1];
    zeilen.forEach(terminalPppLog);
    if (vordergrund) terminalAusgabe(zeilen);
    if (i + 1 < schritte.length) {
      modem.timer = setTimeout(() => schritt(i + 1), schritte[i + 1][0]);
      return;
    }
    modem.bereit = true;
    modem.timer = null;
    terminalKanalPromptSync();
    terminalVordergrundEnde(modem, 0);
  };
  const ende = vordergrund ? terminalVordergrund(modem) : 0;
  schritt(0);
  return ende;
}
async function terminalPppShell(befehl, arg) {
  const t = TERMINAL_ZUSTAND, link = t.satLink;
  if (befehl === 'predict') {
    const m = /^-t\s+\/var\/cache\/tle\/iridium\.tle\s+-([pf])\s+"IRIDIUM 142"$/.exec(arg);
    if (!m) { terminalAusgabe('usage: predict -t ' + TERMINAL_PPP_DATEI + ' -p "' + TERMINAL_PPP_SAT + '"'); return 2; }
    if (link && link.modus !== 'ppp') { terminalAusgabe('predict: sat0 is still in use'); return 1; }
    if (!link || link.abgelaufen) {
      const jetzt = Math.floor(Date.now() / 1000) * 1000;
      const pass = { modus: 'ppp', von: jetzt - 180000, bis: jetzt + (300 + terminalKanalZufall(601)) * 1000,
        orbit: 25000 + terminalKanalZufall(70000), abgelaufen: false };
      t.satLink = pass;
      t.modemEnde = null;
      pass.timer = setInterval(function () { if (terminalSatLinkAktiv(pass)) terminalSatAnzeige(); }, 250);
      terminalSatAnzeige();
    }
    const pass = t.satLink;
    if (m[1] === 'f') {
      const orbit = { fertig: null };
      const ende = terminalVordergrund(orbit);
      t.orbitLive = orbit;
      terminalPppAnzeige();
      terminalKanalPromptSync();
      return ende;
    }
    terminalAusgabe([pass.von, (pass.von + pass.bis) / 2, pass.bis].map(ms => terminalPppZeile(pass, ms)));
    return 0;
  }
  if (befehl === 'pppd') {
    const m = /^call iridium( updetach)?$/.exec(arg);
    if (!m) { terminalAusgabe('usage: pppd call iridium [updetach]'); return 2; }
    if (link?.modus !== 'ppp' || !terminalSatLinkAktiv(link)) { terminalAusgabe('pppd: NO CARRIER'); return 1; }
    if (t.modem) { terminalAusgabe('pppd: iridium already running'); return 1; }
    return terminalPppEinwahl(link, !!m[1]);
  }
  if (befehl === 'tail' && /^-n \d{1,2} \/var\/log\/syslog$/.test(arg)) {
    terminalSyslog(Number(arg.split(' ')[1]));
    return 0;
  }
  if (befehl === 'poff') {
    if (arg !== 'iridium') { terminalAusgabe('usage: poff iridium'); return 2; }
    if (!t.modem) {
      const letzterAbbruch = t.modemEnde?.includes('NO CARRIER');
      terminalAusgabe('poff: iridium is not running' + (letzterAbbruch ? ' (NO CARRIER)' : ''));
      return 1;
    }
    // poff beendet pppd still; der Abbau steht im Syslog. Nur ein unerwarteter Abbruch meldet sich selbst in der Shell.
    terminalPppModemAus('Terminating on signal 15', false);
    return 0;
  }
  if (befehl === 'wg-quick') {
    if (arg === 'up wg-sat') {
      if (t.wgSat) { terminalAusgabe('wg-quick: wg-sat already exists'); return 1; }
      if (!t.modem?.bereit || link?.modus !== 'ppp' || !terminalSatLinkAktiv(link)) { terminalAusgabe('wg-quick: ppp0 is not ready'); return 1; }
      {
        const kennung = () => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
        const interfaceSat = { bereit: false, handshake: null, lokal: kennung(), peer: kennung(), timer: null };
        t.wgSat = interfaceSat;
        const ende = terminalVordergrund(interfaceSat);
        terminalAusgabe('[#] ip link add wg-sat type wireguard');
        interfaceSat.timer = setTimeout(function () {
          if (t.wgSat !== interfaceSat) return;
          if (!t.modem?.bereit || !terminalSatLinkAktiv(link)) {
            t.wgSat = null;
            terminalAusgabe(['wg-quick: ppp0: Network unreachable', '[#] ip link delete dev wg-sat']);
            terminalVordergrundEnde(interfaceSat, 1);
            return;
          }
          interfaceSat.bereit = true;
          terminalAusgabe(['[#] wg setconf wg-sat /dev/fd/63', '[#] ip -4 address add 10.200.200.2/24 dev wg-sat',
            '[#] ip link set mtu 1280 up dev wg-sat']);
          terminalVordergrundEnde(interfaceSat, 0);
        }, 650);
        return ende;
      }
    }
    if (arg === 'down wg-sat') {
      if (!t.wgSat) { terminalAusgabe('wg-quick: wg-sat is not a WireGuard interface'); return 1; }
      clearTimeout(t.wgSat.timer); terminalVordergrundEnde(t.wgSat, 1); t.wgSat = null;
      terminalAusgabe('[#] ip link delete dev wg-sat'); terminalSatAnzeige();
      return 0;
    }
    terminalAusgabe('usage: wg-quick [ up | down ] wg-sat');
    return 2;
  }
  if (befehl === 'wg') {
    if (arg !== 'show wg-sat') { terminalAusgabe('usage: wg show wg-sat'); return 2; }
    if (!t.wgSat) { terminalAusgabe('Unable to access interface: No such device'); return 1; }
    if (!t.wgSat.bereit) { terminalAusgabe('wg-sat: configuring'); return 1; }
    {
      const zeilen = ['interface: wg-sat', '  public key: ' + t.wgSat.lokal, '  private key: (hidden)', '  listening port: 51820',
        '', 'peer: ' + t.wgSat.peer, '  endpoint: 192.0.2.42:51820', '  allowed ips: 10.200.200.0/24'];
      if (t.wgSat.handshake !== null) zeilen.push('  latest handshake: ' + Math.floor((Date.now() - t.wgSat.handshake) / 1000) + ' seconds ago');
      terminalAusgabe(zeilen);
    }
    return 0;
  }
  if (befehl === 'profanity') {
    if (arg) { terminalAusgabe('usage: profanity'); return 2; }
    if (!t.modem?.bereit || !t.wgSat?.bereit || link?.modus !== 'ppp' || !terminalSatLinkAktiv(link)) { terminalAusgabe('profanity: Network unreachable'); return 1; }
    {
      const domain = 'node-5966-q.onion';
      const chat = { ui: 'xmpp', phase: 'anmeldung', link, log: [], domain, account: 'ghost@' + domain,
        vorschlag: terminalKanalZeichen('abcdefghijklmnopqrstuvwxyz', 14) + '@' + domain,
        kontakt: null, omemo: false, antwort: null, fingerprint: terminalPppFingerprint(), fingerprints: new Map() };
      const ende = terminalVordergrund(chat);
      t.kanal = chat;
      terminalPppChatLog(chat, 'Connecting to ' + chat.account);
      chat.anmeldung = setTimeout(function () {
        if (t.kanal !== chat || chat.phase !== 'anmeldung' || !terminalSatLinkAktiv(link)) return;
        chat.phase = 'eingabe';
        t.wgSat.handshake = Date.now();
        terminalPppChatLog(chat, chat.account + ' logged in successfully, online.');
      }, 6000);
      terminalKanalPromptSync();
      return ende;
    }
  }
  return null;
}
function terminalSyslog(n) {
  const log = TERMINAL_ZUSTAND.syslog;
  terminalAusgabe(n ? log.slice(-n) : '');
}
function terminalPppFingerprint() {
  return terminalKanalZeichen('0123456789ABCDEF', 64).match(/.{8}/g).join(' ');
}
async function terminalPppChatMeldung(zeile, chat) {
  const t = TERMINAL_ZUSTAND;
  if (zeile === '/quit') { terminalPppChatAus(); return; }
  if (chat.phase === 'offline' || !terminalSatLinkAktiv(chat.link)) {
    terminalPppChatLog(chat, 'Not connected. Use /quit to return to the terminal.');
    return;
  }
  if (chat.phase === 'anmeldung') { terminalPppChatLog(chat, 'Not logged in yet.'); return; }
  if (zeile.startsWith('/')) terminalPppChatLog(chat, zeile);
  if (/^\/msg\s+[a-z0-9][a-z0-9_.-]*(?:@[a-z0-9.-]+)?$/i.test(zeile)) {
    const ziel = zeile.slice(5).trim();
    chat.kontakt = ziel.endsWith('.onion') && !ziel.includes('@') ? chat.vorschlag.split('@')[0] + '@' + ziel : ziel;
    chat.omemo = false;
    clearTimeout(chat.antwort);
    clearTimeout(chat.omemoAufbau);
    chat.omemoAufbau = null;
    return;
  }
  if (zeile === '/omemo start' || zeile === '/omemo fingerprint') {
    if (!chat.kontakt) terminalPppChatLog(chat, 'No active conversation. Use /msg <contact>.');
    else if (zeile.endsWith('start')) {
      if (chat.omemo || chat.omemoAufbau) return;
      chat.omemoAufbau = setTimeout(function () {
        chat.omemoAufbau = null;
        if (t.kanal !== chat || chat.phase === 'offline' || !terminalSatLinkAktiv(chat.link)) return;
        chat.omemo = true;
        terminalPppChatLog(chat, 'OMEMO session started.');
      }, 3000);
    }
    else {
      if (!chat.fingerprints.has(chat.kontakt)) chat.fingerprints.set(chat.kontakt, terminalPppFingerprint());
      terminalPppChatLog(chat, 'Your OMEMO fingerprint: ' + chat.fingerprint);
      terminalPppChatLog(chat, chat.kontakt.split('@')[0] + "'s OMEMO fingerprint: " + chat.fingerprints.get(chat.kontakt));
    }
    return;
  }
  if (!chat.kontakt) { terminalPppChatLog(chat, 'No active conversation. Use /msg <contact>.'); return; }
  if (/^\/sendfile(?:\s|$)/.test(zeile)) {
    if (chat.phase === 'transfer') { terminalPppChatLog(chat, 'An upload is already in progress.'); return; }
    const pfad = terminalArchivDateipfad(zeile.slice(9).trim());
    if (!pfad?.length) { terminalPppChatLog(chat, 'Usage: /sendfile /' + TERMINAL_DB + '/<file>'); return; }
    chat.phase = 'transfer';
    const aktiv = () => t.kanal === chat && chat.phase === 'transfer' && terminalSatLinkAktiv(chat.link);
    try {
      const antwort = await terminalBruecke('send', pfad);
      if (!aktiv()) return;
      if (antwort.error) terminalPppChatLog(chat, 'Error uploading file: ' + antwort.error);
      else {
        terminalPppChatLog(chat, 'Sending file: /' + [TERMINAL_DB].concat(pfad).join('/') + ' (' + terminalDateigroesse(antwort.bytes) + ')');
        const dauer = Math.min(TERMINAL_SAT_CAP_MS, Math.max(64, antwort.bytes) * 8000 / TERMINAL_SAT_RATE);
        const fertig = await terminalTransfer(antwort.name, antwort.bytes, aktiv, dauer, true);
        if (!aktiv()) return;
        terminalPppChatLog(chat, fertig);
        terminalPppChatLog(chat, 'File sent successfully.');
      }
    } catch (e) { if (aktiv()) terminalPppChatLog(chat, 'Error uploading file.'); }
    if (aktiv()) { terminalTransferStop(); chat.phase = 'eingabe'; }
    return;
  }
  if (zeile.startsWith('/')) { terminalPppChatLog(chat, 'Unknown command: ' + zeile.split(/\s/)[0]); return; }
  terminalPppChatLog(chat, 'me: ' + zeile);
  if (/^auftrag (erledigt|gescheitert)\.?$/i.test(zeile)) {
    const kontakt = chat.kontakt;
    clearTimeout(chat.antwort);
    chat.antwort = setTimeout(function () {
      if (t.kanal === chat && chat.phase !== 'offline' && terminalSatLinkAktiv(chat.link))
        terminalPppChatLog(chat, kontakt + ': Verstanden.');
    }, 7000);
  }
}

/* Shell-Kern: zerlegt eine Zeile in Befehle (Anführungszeichen, \-Escape, $?), verkettet mit &&, || und ;
   und führt nacheinander aus. Jeder Befehl liefert einen Rückgabewert; die Befehle selbst kennen keine Verkettung.
   Pipes, Umleitungen und Befehlsersetzung sind nicht vorhanden. */
const TERMINAL_STATUS_MARKE = '\u0001';
function terminalZerlegen(zeile) {
  const folge = [];
  let woerter = [], wort = null, quote = null;
  const wortEnde = function () { if (wort !== null) { woerter.push(wort); wort = null; } };
  const befehlEnde = function (op) { wortEnde(); folge.push({ woerter, op }); woerter = []; };
  for (let i = 0; i < zeile.length; i++) {
    const c = zeile[i], n = zeile[i + 1];
    if (quote === "'") { if (c === "'") quote = null; else wort += c; continue; }
    if (quote === '"') {
      if (c === '"') quote = null;
      else if (c === '\\' && n !== undefined && '"\\$'.includes(n)) { wort += n; i++; }
      else if (c === '$' && n === '?') { wort += TERMINAL_STATUS_MARKE; i++; }
      else wort += c;
      continue;
    }
    if (c === "'" || c === '"') { quote = c; wort = wort ?? ''; continue; }
    if (/\s/.test(c)) { wortEnde(); continue; }
    if (c === '\\') { if (n !== undefined) { wort = (wort ?? '') + n; i++; } continue; }
    if (c === '&' && n === '&') { befehlEnde('&&'); i++; continue; }
    if (c === '|' && n === '|') { befehlEnde('||'); i++; continue; }
    if (c === ';') { befehlEnde(';'); continue; }
    if ('|&<>`'.includes(c) || (c === '$' && n === '(')) return { fehler: 'terminal: ' + (c === '$' ? '$(' : c) + ': pipes, redirections and substitutions are not supported' };
    if (c === '$' && n === '?') { wort = (wort ?? '') + TERMINAL_STATUS_MARKE; i++; continue; }
    wort = (wort ?? '') + c;
  }
  if (quote) return { fehler: 'terminal: unexpected EOF while looking for matching `' + quote + "'" };
  befehlEnde(null);
  if (folge.length > 1 && !folge.at(-1).woerter.length && folge.at(-2).op === ';') folge.pop();
  for (let i = 0; i < folge.length; i++) {
    if (folge[i].woerter.length) continue;
    const token = folge[i].op || (i ? 'newline' : '');
    return { fehler: 'terminal: syntax error near unexpected token `' + token + "'" };
  }
  return { folge };
}
// Die bisherigen Befehle erwarten ihre Argumente als Text; Wörter mit Leerzeichen oder Anführungszeichen werden wieder gequotet.
function terminalArgText(woerter) {
  return woerter.map(function (w) {
    if (w && !/[\s'"]/.test(w)) return w;
    return w.includes('"') && !w.includes("'") ? "'" + w + "'" : '"' + w + '"';
  }).join(' ');
}
/* Vordergrund: ein Befehl, der erst später endet (Einwahl, Chat, Live-Überflug, Kanal), hält die Kette bis zu seinem Ende an. */
function terminalVordergrund(obj) {
  return new Promise(function (ok) { obj.fertig = ok; });
}
function terminalVordergrundEnde(obj, code) {
  const fertig = obj?.fertig;
  if (!fertig) return;
  obj.fertig = null;
  fertig(code);
}
function terminalOrbitEnde() {
  const t = TERMINAL_ZUSTAND, orbit = t.orbitLive;
  t.orbitLive = false;
  if (orbit && typeof orbit === 'object') terminalVordergrundEnde(orbit, 130);
}
// Strg+C bricht die ganze Kette ab. $? ist der Rückgabewert des unterbrochenen Programms:
// pppd fängt SIGINT ab und endet mit 5 (pppd(8)), andere Programme enden durch das Signal (128 + 2).
function terminalKetteAbbrechen(code = 130) {
  const kette = TERMINAL_ZUSTAND.kette;
  if (kette && !kette.abgebrochen) { kette.abgebrochen = true; kette.code = code; }
}
function terminalStrgC() {
  const t = TERMINAL_ZUSTAND, input = $('profil-terminal-eingabe');
  if (t.orbitLive || terminalPppWaehltVorne() || t.satAufbau) { terminalKonsoleEscape(); return true; }
  if (t.kanal) return false;
  if (t.kette) {
    terminalKetteAbbrechen(130);
    const wg = t.wgSat;
    if (wg && !wg.bereit) {
      // wg-quick räumt beim Abbruch die halb angelegte Schnittstelle wieder ab.
      clearTimeout(wg.timer); t.wgSat = null;
      terminalAusgabe(['^C', '[#] ip link delete dev wg-sat']);
      terminalVordergrundEnde(wg, 130);
      terminalSatAnzeige();
    } else terminalAusgabe('^C');
    return true;
  }
  terminalTabReset();
  terminalAusgabe(terminalPrompt() + ' ' + (input?.value || '').replace(/\n/g, ' ') + '^C');
  if (input) terminalEingabeSetzen(input, '');
  t.vpos = -1;
  t.status = 130;
  return true;
}
async function terminalEinzelbefehl(woerter) {
  const t = TERMINAL_ZUSTAND, befehl = woerter[0], args = woerter.slice(1), arg = terminalArgText(args);
  if (befehl === 'exit') {
    if (arg) { terminalAusgabe('usage: exit'); return 2; }
    t.kette = null;
    terminalKanalAbbruch();
    t.version++;
    terminalTransferStop();
    terminalKonsoleSchliessen();
    return 0;
  }
  if (befehl === 'clear') {
    if (arg) { terminalAusgabe('usage: clear'); return 2; }
    t.version++; terminalTransferStop(); t.ausgabe = []; terminalAusgabe([]);
    return 0;
  }
  const ppp = await terminalPppShell(befehl, arg);
  if (ppp !== null) return ppp;
  if (befehl === 'echo') { terminalAusgabe(args.join(' ')); return 0; }
  if (befehl === 'true' && !arg) return 0;
  if (befehl === 'false' && !arg) return 1;
  if (befehl === 'help' && !arg) {
    terminalAusgabe(['ls [-a|-l|-la] · cd <ordner> · pwd · cat <datei> · head <datei> · tail <datei> · wget <datei> · echo · true · false · whoami · uname -a · date · ping relay · clear · exit',
      'predict · pppd call iridium [updetach] · poff iridium · wg-quick · wg · profanity (/msg, /omemo, /sendfile, /quit)',
      'cmd1 && cmd2 · cmd1 || cmd2 · cmd1 ; cmd2 · exit status: echo $?']);
    return 0;
  }
  if (befehl === 'pwd' && !arg) { terminalAusgabe(terminalArbeitsverzeichnis()); return 0; }
  if (befehl === 'whoami' && !arg) { terminalAusgabe('root'); return 0; }
  if (befehl === 'uname' && arg === '-a') { terminalAusgabe(TERMINAL_UBUNTU); return 0; }
  if (befehl === 'date' && !arg) { terminalAusgabe(fmtZ(new Date())); return 0; }
  if (befehl === 'ping') {
    if (arg === 'relay') return await terminalPing() ? 0 : 1;
    terminalAusgabe(arg ? 'ping: ' + arg + ': Name or service not known' : 'ping: usage: ping <destination>');
    return arg ? 2 : 1;
  }
  if (befehl === 'send') { terminalAusgabe('send: channel not connected'); return 1; }
  if (befehl === 'satcon-tx') return terminalSatTxStart(arg);
  if (befehl === 'secure-channel') {
    if (arg.split(/\s+/).join(' ') === TERMINAL_SAT_KANAL_ARG) return terminalSatKanalStart();
    terminalAusgabe('usage: secure-channel ' + TERMINAL_SAT_KANAL_ARG);
    return 2;
  }
  if (TERMINAL_DATEIBEFEHLE.includes(befehl)) {
    if (t.dateiLaeuft) { terminalAusgabe('Datenbankanfrage läuft bereits'); return 1; }
    t.dateiLaeuft = true;
    const version = t.version;
    try {
      return await terminalDateiBefehl(befehl, arg, version);
    } catch (e) {
      if (t.version === version) terminalAusgabe('Dateioperation fehlgeschlagen');
      return 1;
    } finally { t.dateiLaeuft = false; }
  }
  if (['help', 'pwd', 'whoami', 'uname', 'date', 'true', 'false'].includes(befehl)) {
    terminalAusgabe('usage: ' + befehl + (befehl === 'uname' ? ' -a' : ''));
    return 2;
  }
  terminalAusgabe(befehl + ': command not found');
  return 127;
}
async function terminalKetteAusfuehren(folge) {
  const t = TERMINAL_ZUSTAND, kette = { abgebrochen: false };
  t.kette = kette;
  terminalKanalPromptSync();
  try {
    let op = null;
    for (const teil of folge) {
      if (t.kette !== kette || kette.abgebrochen) return;
      const ueberspringen = (op === '&&' && t.status !== 0) || (op === '||' && t.status === 0);
      op = teil.op;
      if (ueberspringen) continue;
      if (t.satLink) terminalSatLinkAktiv(t.satLink);
      const woerter = teil.woerter.map(function (w) { return w.split(TERMINAL_STATUS_MARKE).join(String(t.status)); });
      let code;
      try { code = await terminalEinzelbefehl(woerter); } catch (e) { code = 1; }
      if (t.kette !== kette) return;
      t.status = kette.abgebrochen ? kette.code : typeof code === 'number' ? code : 0;
    }
  } finally {
    if (t.kette === kette) { t.kette = null; terminalKanalPromptSync(); }
  }
}
function terminalBefehl(zeile) {
  const t = TERMINAL_ZUSTAND;
  if (zeile === 'exit' && (t.kanal || t.orbitLive || t.kette)) { void terminalEinzelbefehl(['exit']); return; }
  if (t.satLink) terminalSatLinkAktiv(t.satLink);
  if (t.orbitLive || terminalPppWaehltVorne()) return;
  if (t.kanal) {
    if (t.kanal.ui === 'xmpp') void terminalPppChatMeldung(zeile, t.kanal);
    else void terminalKanalMeldung(zeile, t.kanal);
    return;
  }
  if (t.kette) return;
  if (zeile !== 'clear') terminalAusgabe(terminalPrompt() + ' ' + zeile);
  const z = terminalZerlegen(zeile);
  if (z.fehler) { terminalAusgabe(z.fehler); t.status = 2; return; }
  void terminalKetteAusfuehren(z.folge);
}
const TERMINAL_DATEIBEFEHLE = ['ls', 'cd', 'cat', 'head', 'tail', 'wget'];
const TERMINAL_BEFEHLE = TERMINAL_DATEIBEFEHLE.concat(['help', 'pwd', 'whoami', 'uname', 'date', 'ping', 'clear', 'exit',
  'predict', 'pppd', 'poff', 'wg-quick', 'wg', 'profanity', 'satcon-tx', 'secure-channel', 'send']);
const TERMINAL_PPP_TAB = new Map([
  ['predict', []],
  ['pppd', ['call iridium updetach']], ['poff', ['iridium']], ['wg-quick', ['up wg-sat', 'down wg-sat']], ['wg', ['show wg-sat']]
]);
let terminalTabLauf = null, terminalTabAuswahl = null;
function terminalTabReset() {
  terminalTabLauf = terminalTabAuswahl = null;
}
function terminalTabKontext(lauf) {
  const t = TERMINAL_ZUSTAND;
  return t.version === lauf.version && t.kanal === lauf.kanal && (!t.kanal || t.kanal.phase === 'eingabe') &&
    terminalArbeitsverzeichnis() === lauf.ort;
}
function terminalTabGueltig(lauf) {
  const input = lauf.input, n = lauf.wert.length;
  return terminalTabLauf === lauf && terminalTabKontext(lauf) && input.isConnected &&
    document.activeElement === input && input.value === lauf.wert && input.selectionStart === n && input.selectionEnd === n;
}
function terminalTabKandidaten(lauf, kopf, prefix, kandidaten, format) {
  if (!terminalTabGueltig(lauf)) return;
  const input = lauf.input;
  const treffer = [...new Set(kandidaten)].filter(x => x.toLowerCase().startsWith(prefix.toLowerCase()));
  if (treffer.length === 1) { terminalEingabeSetzen(input, kopf + format(treffer[0])); return; }
  if (treffer.length < 2) return;
  let gemeinsam = treffer[0];
  while (!treffer.every(function (x) { return x.startsWith(gemeinsam); })) gemeinsam = gemeinsam.slice(0, -1);
  if (gemeinsam.length > prefix.length) terminalEingabeSetzen(input, kopf + gemeinsam);
  else {
    const werte = treffer.map(x => kopf + format(x));
    const index = Math.max(0, werte.indexOf(input.value));
    terminalTabAuswahl = { ...lauf, werte, index };
    terminalEingabeSetzen(input, werte[index]);
  }
}
async function terminalTab(lauf, m) {
  const bisher = lauf.wert;
  const befehl = m[1], arg = m[2];
  const fertig = function (kopf, prefix, kandidaten, format) {
    terminalTabKandidaten(lauf, kopf, prefix, kandidaten, format);
  };
  if (arg === undefined) {
    fertig('', befehl, TERMINAL_BEFEHLE, function (x) { return x + ' '; });
    return;
  }
  if (befehl === 'satcon-tx' || befehl === 'secure-channel') {
    const vorgabe = befehl === 'satcon-tx' ? TERMINAL_SAT_TX_TEILE : TERMINAL_SAT_KANAL_TEILE;
    const teile = arg.split(/\s+/), prefix = teile.pop(), kandidat = vorgabe[teile.length];
    if (kandidat && teile.every(function (x, i) { return x === vorgabe[i]; })) {
      fertig(bisher.slice(0, bisher.length - prefix.length), prefix, [kandidat], function (x) { return x + ' '; });
    }
    return;
  }
  if (befehl === 'predict') {
    let rest = arg, kopf = 'predict ';
    const vorgabe = ['-t', TERMINAL_PPP_DATEI, '-p', '"' + TERMINAL_PPP_SAT + '"'];
    for (let i = 0; i < vorgabe.length; i++) {
      const wort = i === 2 && /^-f(?:\s|$)/.test(rest) ? '-f' : vorgabe[i];
      const trennung = rest.startsWith(wort) && /^\s+/.exec(rest.slice(wort.length));
      if (!trennung) { fertig(kopf, rest, [wort], x => x + ' '); return; }
      kopf += wort + trennung[0];
      rest = rest.slice(wort.length + trennung[0].length);
    }
    return;
  }
  if (TERMINAL_PPP_TAB.has(befehl)) {
    if ((befehl === 'pppd' || befehl === 'poff') && arg.includes('&&')) {
      const befehlsanfang = befehl === 'pppd' ? 'call iridium' : 'iridium';
      fertig(befehl + ' ', arg, [befehlsanfang + ' && tail -n ' + (befehl === 'pppd' ? '12' : '6') + ' /var/log/syslog'], x => x);
      return;
    }
    fertig(befehl + ' ', arg, TERMINAL_PPP_TAB.get(befehl), x => x);
    return;
  }
  if (befehl === 'tail' && /^-n(?:\s|$)/.test(arg)) {
    const m = /^(-n\s+\d{1,2}\s+)(.*)$/.exec(arg);
    if (m) fertig('tail ' + m[1], m[2], ['/var/log/syslog'], x => x);
    else fertig('tail ', arg, ['-n 12 /var/log/syslog'], x => x);
    return;
  }
  if (befehl === 'ping' || befehl === 'uname' || (befehl === 'ls' && arg.startsWith('-'))) {
    fertig(befehl + ' ', arg, befehl === 'ping' ? ['relay'] : befehl === 'uname' ? ['-a'] : ['-a', '-l', '-la'], function (x) { return x; });
    return;
  }
  const anfang = arg[0] === '"' || arg[0] === "'" ? arg[0] : '';
  const pfad = anfang ? arg.slice(1, arg.endsWith('/' + anfang) ? -1 : undefined) : arg;
  if ((anfang && pfad.includes(anfang)) || /[:\\]|[\u0000-\u001f\u007f]/.test(pfad)) return;
  const slash = pfad.lastIndexOf('/') + 1;
  const basis = pfad.slice(0, slash), prefix = pfad.slice(slash);
  const teile = terminalShellPfad(basis);
  if (!teile) return;
  const listing = !teile.length ? ['var/', TERMINAL_DB + (basis ? '/' : '')] : TERMINAL_TLE_DIRS.get('/' + teile.join('/'));
  if (listing) {
    const namen = listing.filter(x => befehl !== 'cd' || x.endsWith('/') || x === TERMINAL_DB).map(x => basis + x);
    fertig(befehl + ' ' + anfang, pfad, namen, function (x) { return x + anfang; });
    return;
  }
  if (teile[0] !== TERMINAL_DB) return;
  const antwort = await terminalBruecke('ls', teile.slice(1), prefix.startsWith('.'));
  if (!terminalTabGueltig(lauf)) return;
  if (!antwort.entries) { terminalTabFehler(lauf, antwort); return; }
  terminalTabFehlerZuletzt = '';
  const namen = antwort.entries.filter(function (x) { return x.dir || befehl !== 'cd'; })
    .map(function (x) { return basis + x.name + (x.dir ? '/' : ''); });
  fertig(befehl + ' ' + anfang, pfad, namen, function (x) {
    const quote = anfang || (/\s|^'/.test(x) ? '"' : '');
    return (quote && !anfang ? quote : '') + x + quote;
  });
}
async function terminalKanalTab(lauf) {
  const kommando = lauf.kanal.ui === 'xmpp' ? '/sendfile' : 'send';
  if (lauf.kanal.ui === 'xmpp') {
    if (!/\s/.test(lauf.wert)) {
      terminalTabKandidaten(lauf, '', lauf.wert, ['/msg', '/omemo', '/sendfile', '/quit'], x => x + ' ');
      return;
    }
    const kontakt = /^\/msg\s+(.*)$/.exec(lauf.wert);
    if (kontakt) {
      const chat = lauf.kanal, teil = kontakt[1];
      if (teil && chat.domain.startsWith(teil.toLowerCase())) {
        terminalTabKandidaten(lauf, '/msg ', teil, [chat.domain], () => chat.vorschlag);
      } else terminalTabKandidaten(lauf, '/msg ', teil, [chat.vorschlag], x => x);
      return;
    }
    const omemo = /^\/omemo\s+(.*)$/.exec(lauf.wert);
    if (omemo) {
      terminalTabKandidaten(lauf, '/omemo ', omemo[1], ['start', 'fingerprint'], x => x);
      return;
    }
  }
  const m = /^(?:send|\/sendfile)\s+(.*)$/.exec(lauf.wert);
  if (!m) return;
  const anfang = m[1][0] === '"' || m[1][0] === "'" ? m[1][0] : '';
  const pfad = anfang ? m[1].slice(1, m[1].length > 1 && m[1].endsWith(anfang) ? -1 : undefined) : m[1];
  if (anfang && pfad.includes(anfang)) return;
  const kopf = kommando + ' ' + anfang;
  const format = function (x) {
    const quote = anfang || (/\s|^'/.test(x) ? '"' : '');
    return (quote && !anfang ? quote : '') + x + quote;
  };
  const prefix = '/' + TERMINAL_DB + '/';
  if (!pfad || (pfad.startsWith('/') && !pfad.startsWith(prefix)) || (!TERMINAL_ZUSTAND.ort && !pfad.includes('/'))) {
    terminalTabKandidaten(lauf, kopf, pfad, [pfad.startsWith('/') || !pfad ? prefix : prefix.slice(1)], function () { return format(prefix); });
    return;
  }
  const basis = pfad.slice(0, pfad.lastIndexOf('/') + 1);
  const parent = basis.replace(/\/$/, '');
  const teile = basis === prefix ? [] : basis ? terminalArchivDateipfad('"' + parent + '"') : TERMINAL_ZUSTAND.ort;
  if (!teile) return;
  const antwort = await terminalBruecke('ls', teile, pfad.slice(basis.length).startsWith('.'));
  if (!terminalTabGueltig(lauf)) return;
  if (!antwort.entries) { terminalTabFehler(lauf, antwort); return; }
  terminalTabFehlerZuletzt = '';
  terminalTabKandidaten(lauf, kopf, pfad, antwort.entries.map(function (x) {
    return basis + x.name + (x.dir ? '/' : '');
  }), format);
}
/* Befehlsverlauf: nur im Speicher der Sitzung (50 Einträge), nicht im Profil. Nicht aufgenommen werden exit und alles innerhalb des Kanals. */
function terminalVerlaufNehmen(zeile) {
  const t = TERMINAL_ZUSTAND;
  t.vpos = -1; t.entwurf = '';
  if (t.kanal || zeile === 'exit') return;
  if (t.verlauf[t.verlauf.length - 1] !== zeile) t.verlauf.push(zeile);
  if (t.verlauf.length > 50) t.verlauf.shift();
}
function terminalVerlaufLeeren() { const t = TERMINAL_ZUSTAND; t.verlauf = []; t.vpos = -1; t.entwurf = ''; }
function terminalVerlaufTaste(ev) {
  const t = TERMINAL_ZUSTAND, input = ev.currentTarget, n = t.verlauf.length;
  if (ev.shiftKey || ev.ctrlKey || ev.altKey || ev.metaKey || ev.isComposing || t.kanal) return false;
  if ((ev.key !== 'ArrowUp' && ev.key !== 'ArrowDown') || !n) return false;
  if (ev.key === 'ArrowDown' && t.vpos === -1) return false;
  ev.preventDefault();
  if (ev.key === 'ArrowUp') {
    if (t.vpos === -1) { t.entwurf = input.value; t.vpos = n - 1; } else if (t.vpos > 0) t.vpos--;
    terminalEingabeSetzen(input, t.verlauf[t.vpos]);
  } else if (t.vpos < n - 1) { t.vpos++; terminalEingabeSetzen(input, t.verlauf[t.vpos]); }
  else { t.vpos = -1; terminalEingabeSetzen(input, t.entwurf); }
  return true;
}
function terminalTabTaste(ev) {
  if (ev.key !== 'Tab' && ev.key !== 'Shift') terminalTabReset();
  if (ev.key === 'Enter') {
    if (ev.isComposing || ev.keyCode === 229) return;
    ev.preventDefault();
    if (!ev.repeat) ev.currentTarget.form.requestSubmit();
    return;
  }
  if (terminalVerlaufTaste(ev)) return;
  if (ev.key !== 'Tab' || ev.ctrlKey || ev.altKey || ev.metaKey || ev.isComposing) return;
  const input = ev.currentTarget, bisher = input.value;
  if (input.selectionStart !== bisher.length || input.selectionEnd !== bisher.length) return;
  const auswahl = terminalTabAuswahl;
  if (auswahl?.input === input && terminalTabKontext(auswahl) && bisher === auswahl.werte[auswahl.index]) {
    ev.preventDefault();
    const n = auswahl.werte.length;
    auswahl.index = (auswahl.index + (ev.shiftKey ? -1 : 1) + n) % n;
    terminalEingabeSetzen(input, auswahl.werte[auswahl.index]);
    return;
  }
  if (ev.shiftKey) return;
  const t = TERMINAL_ZUSTAND;
  const m = /^(\S+)(?:\s+(.*))?$/.exec(bisher);
  if (t.orbitLive || terminalPppWaehltVorne()) return;
  if (t.kanal ? t.kanal.phase !== 'eingabe' || (t.kanal.ui === 'xmpp' ?
      !(/^\/(?:sendfile|msg|omemo)\s/.test(bisher) || (bisher.startsWith('/') && !/\s/.test(bisher))) : !/^send\s/.test(bisher)) :
      t.dateiLaeuft || !m || (m[2] === undefined ? !TERMINAL_BEFEHLE.some(x => x.startsWith(m[1])) :
      !TERMINAL_PPP_TAB.has(m[1]) && !['cd', 'cat', 'head', 'tail', 'wget', 'ping', 'uname', 'ls', 'satcon-tx', 'secure-channel'].includes(m[1]))) return;
  ev.preventDefault();
  if (terminalTabLauf?.wert === bisher && terminalTabGueltig(terminalTabLauf)) return;
  terminalTabAuswahl = null;
  const lauf = { input, wert: bisher, version: t.version, kanal: t.kanal, ort: terminalArbeitsverzeichnis() };
  terminalTabLauf = lauf;
  (t.kanal ? terminalKanalTab(lauf) : terminalTab(lauf, m)).catch(function () {}).finally(function () {
    if (terminalTabLauf === lauf) terminalTabLauf = null;
  });
}

function terminalEingabeHoehe(input) {
  if (!input.clientWidth) return;
  const scroll = input.scrollTop;
  input.style.height = '0px';
  input.style.height = (input.scrollHeight + input.offsetHeight - input.clientHeight) + 'px';
  input.scrollTop = document.activeElement === input && input.selectionStart === input.value.length ? input.scrollHeight : scroll;
}
function terminalEingabeSetzen(input, wert) {
  input.value = wert;
  input.setSelectionRange(input.value.length, input.value.length);
  terminalEingabeHoehe(input);
}
function terminalKonsoleBauen() {
  const t = TERMINAL_ZUSTAND;
  const input = h('textarea', { id: 'profil-terminal-eingabe', rows: 1, 'aria-label': 'Terminalbefehl',
    maxlength: 1024, autocomplete: 'off', spellcheck: 'false', onkeydown: terminalTabTaste,
    onblur: terminalTabReset, onpointerdown: terminalTabReset,
    oninput: function (ev) {
      terminalTabReset();
      if (ev.isComposing) return;
      if (input.value.includes('\n')) {
        const von = input.selectionStart, bis = input.selectionEnd;
        input.value = input.value.replace(/\n/g, ' ');
        input.setSelectionRange(von, bis);
      }
      terminalEingabeHoehe(input);
    } });
  const titel = h('div', { class: 'profil-terminal-titel', 'aria-hidden': 'true' }, 'Shadow Terminal');
  const minimieren = h('button', { type: 'button', id: 'profil-terminal-minimieren',
    'aria-controls': 'profil-terminal-kern', 'aria-expanded': 'true', 'aria-label': 'Minimieren', title: 'Minimieren' }, '−');
  const griff = h('span', { class: 'profil-terminal-groesse', 'aria-hidden': 'true' });
  const kern = h('div', { id: 'profil-terminal-kern', class: 'profil-terminal-kern' },
      h('pre', { id: 'profil-terminal-ausgabe', class: 'mono', role: 'log', 'aria-label': 'Terminalausgabe' }, t.ausgabe.join('\n')),
      h('pre', { id: 'profil-terminal-orbit', class: 'mono', 'aria-label': 'Überflug', hidden: true }),
      h('pre', { id: 'profil-terminal-chat', class: 'mono', role: 'log', 'aria-label': 'Chatverlauf', hidden: true }),
      h('pre', { id: 'profil-terminal-transfer', class: 'mono', hidden: !t.fortschritt }, t.fortschritt),
      h('form', { onsubmit: function (ev) {
        ev.preventDefault();
        terminalTabReset();
        const zeile = input.value.replace(/\n/g, ' ').trim();
        if (zeile !== 'exit' && terminalBeschaeftigt()) return;
        terminalEingabeSetzen(input, '');
        if (zeile) { terminalVerlaufNehmen(zeile); terminalBefehl(zeile); }
      } }, h('label', { id: 'profil-terminal-prompt', for: input.id, class: 'mono' }, terminalPrompt()), input,
        h('button', { type: 'submit' }, 'Ausführen')));
  const fenster = h('section', { id: 'profil-terminal', class: 'panel profil-terminal', 'aria-label': 'Shadow Terminal', tabindex: '-1', hidden: true },
    h('div', { class: 'profil-terminal-kopf' }, titel, h('span', { id: 'profil-terminal-sat', class: 'mono', hidden: true }), minimieren,
      h('button', { type: 'button', id: 'profil-terminal-schliessen', 'aria-label': 'Schließen', title: 'Schließen',
        onclick: function () { terminalKonsoleSchliessen(); } }, '×')), kern, griff);
  function minimierenSetzen(klein) {
    fenster.classList.toggle('minimiert', klein);
    kern.hidden = griff.hidden = klein;
    const name = klein ? 'Wiederherstellen' : 'Minimieren';
    minimieren.setAttribute('aria-label', name);
    minimieren.setAttribute('aria-expanded', String(!klein));
    minimieren.title = name;
    minimieren.textContent = klein ? '□' : '−';
    terminalKonsoleLayout();
    if (!klein) {
      terminalEingabeHoehe(input);
      const ausgabe = $('profil-terminal-ausgabe');
      ausgabe.scrollTop = ausgabe.scrollHeight;
    }
  }
  minimieren.addEventListener('click', function () { minimierenSetzen(!kern.hidden); });
  titel.addEventListener('dblclick', function () { minimierenSetzen(!kern.hidden); });
  terminalKonsoleZeiger(titel, fenster, false);
  terminalKonsoleZeiger(griff, fenster, true);
  let breite = 0;
  new ResizeObserver(function () {
    if (input.clientWidth === breite) return;
    breite = input.clientWidth;
    terminalEingabeHoehe(input);
  }).observe(fenster);
  return fenster;
}

/* Genau eine Ansicht und Sitzung, außerhalb der beim Modulwechsel ersetzten Oberfläche. */
let terminalKonsoleFokus = null;
let terminalKonsoleGeometrie = null;
const TERMINAL_FENSTERRAND = 8;
function terminalKonsoleLayout() {
  const fenster = $('profil-terminal');
  if (!fenster || fenster.hidden) return;
  const rand = TERMINAL_FENSTERRAND, w = document.documentElement.clientWidth - 2 * rand;
  const h = document.documentElement.clientHeight - 2 * rand;
  const begrenze = function (x, min, max) { return Math.min(max, Math.max(min, x)); };
  if (!terminalKonsoleGeometrie) {
    const breite = Math.min(760, w), hoehe = Math.min(400, h);
    terminalKonsoleGeometrie = { x: rand + (w - breite) / 2, y: rand + Math.max(0, (h - hoehe) * 0.65), breite, hoehe };
  }
  const g = terminalKonsoleGeometrie;
  const breite = begrenze(g.breite, Math.min(300, w), w);
  const hoehe = begrenze(g.hoehe, Math.min(185, h), h);
  fenster.style.width = breite + 'px';
  fenster.style.height = fenster.classList.contains('minimiert') ? '' : hoehe + 'px';
  const aktuell = fenster.offsetHeight;
  fenster.style.left = begrenze(g.x, rand, rand + w - breite) + 'px';
  fenster.style.top = begrenze(g.y, rand, rand + Math.max(0, h - aktuell)) + 'px';
}
function terminalKonsoleZeiger(griff, fenster, groesse) {
  let start = null;
  griff.addEventListener('pointerdown', function (ev) {
    if (ev.button !== 0 || !ev.isPrimary) return;
    const box = fenster.getBoundingClientRect();
    start = { id: ev.pointerId, px: ev.clientX, py: ev.clientY, x: box.left, y: box.top, breite: box.width, hoehe: box.height };
    griff.setPointerCapture(ev.pointerId);
    ev.preventDefault();
    fenster.focus({ preventScroll: true });
  });
  griff.addEventListener('pointermove', function (ev) {
    if (!start || start.id !== ev.pointerId) return;
    const dx = ev.clientX - start.px, dy = ev.clientY - start.py;
    const g = terminalKonsoleGeometrie;
    if (groesse) {
      g.x = start.x; g.y = start.y;
      g.breite = Math.min(start.breite + dx, document.documentElement.clientWidth - start.x - TERMINAL_FENSTERRAND);
      g.hoehe = Math.min(start.hoehe + dy, document.documentElement.clientHeight - start.y - TERMINAL_FENSTERRAND);
    } else { g.x = start.x + dx; g.y = start.y + dy; }
    terminalKonsoleLayout();
  });
  griff.addEventListener('lostpointercapture', function () { start = null; });
}
window.addEventListener('resize', terminalKonsoleLayout);
function terminalKonsoleDialogOffen() { return !!($('dlg')?.open || $('regie')?.open); }
function terminalKonsoleOeffnen() {
  if (typeof APP_BEREIT === 'undefined' || !APP_BEREIT || document.body.classList.contains('locked') || terminalKonsoleDialogOffen()) return;
  let konsole = $('profil-terminal');
  if (!konsole) {
    konsole = terminalKonsoleBauen();
    document.body.appendChild(konsole);
  }
  if (!TERMINAL_ZUSTAND.offen) terminalKonsoleFokus = document.activeElement;
  TERMINAL_ZUSTAND.offen = true;
  konsole.hidden = false;
  if (konsole.classList.contains('minimiert')) $('profil-terminal-minimieren').click();
  terminalKonsoleLayout();
  terminalEingabeHoehe($('profil-terminal-eingabe'));
  const ausgabe = $('profil-terminal-ausgabe');
  ausgabe.scrollTop = ausgabe.scrollHeight;
  konsole.focus({ preventScroll: true });
}
function terminalKonsoleSchliessen(fokus = true) {
  if (!TERMINAL_ZUSTAND.offen) return;
  TERMINAL_ZUSTAND.offen = false;
  $('profil-terminal').hidden = true;
  if (fokus) {
    const ziel = terminalKonsoleFokus;
    if (ziel && ziel !== document.body && ziel.isConnected && ziel.getClientRects().length) ziel.focus();
    else $('mod-title')?.focus();
  }
  terminalKonsoleFokus = null;
}
function terminalKonsoleEscape() {
  const t = TERMINAL_ZUSTAND;
  if (t.orbitLive) {
    terminalKetteAbbrechen();
    terminalOrbitEnde();
    terminalPppAnzeige();
    terminalKanalPromptSync();
  } else if (terminalPppWaehltVorne()) {
    terminalKetteAbbrechen(5);
    terminalPppModemAus('Terminating on signal 2');
  } else if (t.satAufbau) {
    terminalKetteAbbrechen();
    terminalSatAbbruch(); terminalAusgabe('[!] Verbindungsaufbau abgebrochen');
  } else if (t.kanal?.ui === 'xmpp') {
    terminalPppChatAus();
  } else if (t.kanal) {
    terminalKanalAbbruch();
  } else if (t.vpos !== -1) {
    t.vpos = -1;
    const input = $('profil-terminal-eingabe');
    terminalEingabeSetzen(input, t.entwurf);
  } else terminalKonsoleSchliessen();
}
document.addEventListener('keydown', function (ev) {
  if (document.body.classList.contains('locked') || terminalKonsoleDialogOffen() || ev.isComposing) return;
  const strgC = ev.ctrlKey && !ev.altKey && !ev.metaKey && !ev.shiftKey && ev.key.toLowerCase() === 'c' &&
    TERMINAL_ZUSTAND.offen && $('profil-terminal')?.contains(ev.target);
  if (strgC && !ev.repeat) {
    // Markierter Text wird wie gewohnt kopiert; sonst wirkt Strg+C wie SIGINT.
    const feld = ev.target, auswahl = String(window.getSelection?.() || '') ||
      (typeof feld.selectionStart === 'number' && feld.selectionStart !== feld.selectionEnd);
    if (!auswahl && terminalStrgC()) { ev.preventDefault(); ev.stopImmediatePropagation(); return; }
  }
  if (ev.key === 'Escape' && TERMINAL_ZUSTAND.offen) {
    ev.preventDefault();
    ev.stopImmediatePropagation(); // Escape darf nie zugleich ein Kartenwerkzeug abbrechen.
    if (!ev.repeat) terminalKonsoleEscape();
    return;
  }
  if (!/^[tT]$/.test(ev.key) || ev.repeat || ev.ctrlKey || ev.altKey || ev.metaKey) return;
  const ziel = ev.target;
  if (ziel.isContentEditable || ziel.closest?.('input, textarea, select, [role="textbox"]')) return;
  ev.preventDefault();
  if (TERMINAL_ZUSTAND.offen) terminalKonsoleSchliessen();
  else terminalKonsoleOeffnen();
}, true);

// Locking the app drops the temporary dialogue even when the window stays open.
new MutationObserver(function () {
  if (!document.body.classList.contains('locked')) return;
  TERMINAL_ZUSTAND.kette = null; terminalKanalAbbruch(); terminalVerlaufLeeren();
  const input = $('profil-terminal-eingabe');
  if (input) terminalEingabeSetzen(input, '');
  terminalKonsoleSchliessen(false);
}).observe(document.body, { attributes: true, attributeFilter: ['class'] });

function identitaetDateiSchluessel(id, nr) { return 'identitaet:' + id + ':' + nr; }
function identitaetDateiZeile(id, d) {
  const nr = d[0], key = identitaetDateiSchluessel(id, nr);
  const name = h('span', { class: 'dim', 'aria-live': 'polite' }, 'Wird geladen …');
  let datei;
  const laden = h('button', { type: 'button', hidden: true, onclick: function () {
    if (!datei) return;
    const url = URL.createObjectURL(datei);
    const a = h('a', { href: url, download: datei.name || nr });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
  } }, 'Herunterladen');
  const entfernen = h('button', { type: 'button', hidden: true, class: 'link', onclick: function () {
    bestaetigen('Anlage entfernen', 'Die lokale Datei zu ' + nr + ' wird entfernt.', 'Entfernen', function () {
      aendern(function () { return RIDB.del(key).then(function () { anzeigen(null); }); });
    });
  } }, 'Entfernen');
  const input = h('input', { type: 'file', hidden: true, id: 'id-datei-' + nr, onchange: function () {
    const f = input.files && input.files[0];
    input.value = '';
    if (!f) return;
    if (f.size > 20 * 1024 * 1024) { meldung('Die Anlage darf höchstens 20 MB groß sein.'); return; }
    aendern(function () { return RIDB.put(key, f).then(function () { anzeigen(f); }); });
  } });
  const nrKnopf = h('button', { type: 'button', id: 'id-nr-' + nr, class: 'link mono', disabled: true,
    title: 'Datei für ' + nr + ' auswählen oder ersetzen', onclick: function () { input.click(); } }, nr);
  function anzeigen(f) {
    datei = f || null;
    name.textContent = datei ? (datei.name || 'Datei vorhanden') : 'Keine Datei';
    laden.hidden = entfernen.hidden = !datei;
  }
  function aendern(fn) {
    nrKnopf.disabled = entfernen.disabled = true;
    fn().catch(function () { meldung('Anlage konnte nicht geändert werden.'); })
      .finally(function () { nrKnopf.disabled = entfernen.disabled = false; });
  }
  RIDB.get(key).then(function (f) { anzeigen(f); nrKnopf.disabled = false; })
    .catch(function () { name.textContent = 'Lokaler Dateispeicher nicht verfügbar'; });
  return [td('nw', [nrKnopf, input]), d[1], td('txt', name), h('div', { class: 'profil-datei-aktionen' }, laden, entfernen)];
}
function arbeitsIdentitaetKarte(id) {
  const L = ARBEITS_IDENTITAETEN[id], aktiv = aktiveLegendeId() === id, hatFoto = !!PROFIL.bilder['legende-' + id];
  const sec = panel(L.bezeichnung,
    h('span', { class: 'label ' + (aktiv ? 's-accent' : 's-dim') }, aktiv ? 'aktive Identität' : 'nicht aktiv'),
    h('div', { class: 'mitfoto' }, bildFeld(bildPfad({}, 'legende-' + id), 'Lichtbild ' + L.bezeichnung, 'Kein Lichtbild'), h('dl', { class: 'fields' },
      feld('Name', L.name), feld('Wohnort', L.ort), feld('Land', land(L.land)), feld('Beruf', L.beruf), feld('Hintergrund', L.text, 'full'))),
    h('div', { class: 'row' }, h('label', { for: 'lb-' + id }, 'Lichtbild'),
      bildWaehler('lb-' + id, function (b) { dispatch({ type: 'LEGENDE_BILD', id: id, bild: b }); }),
      hatFoto ? h('button', { type: 'button', class: 'link', onclick: function () { dispatch({ type: 'LEGENDE_BILD', id: id, bild: null }); } }, 'Lichtbild entfernen') : null),
    h('h3', null, 'Anlagen'),
    tabelle(['Nummer', 'Bezeichnung', 'Lokale Datei', ''], L.anlagen.map(function (d) { return identitaetDateiZeile(id, d); })),
    h('div', { class: 'row top' },
      aktiv ? h('span', { class: 'dim' }, 'In Verwendung.')
            : h('button', { type: 'button', id: 'btn-leg-' + id, onclick: function () {
                bestaetigen('Aktive Identität wechseln', L.bezeichnung + ' – ' + L.name, 'Identität wechseln',
                  function () { dispatch({ type: 'LEGENDE_GEWECHSELT', legende: id }); $('reiter-tarn').focus(); });
              } }, 'Als aktive Identität setzen')));
  sec.dataset.identitaet = id;
  return sec;
}
function renderArbeitsprofil(m) {
  const kopf = [h('div', { class: 'mod-head' }, h('h1', { id: 'mod-title', tabindex: '-1' }, m.titel),
    h('span', { class: 'mono dim' }, 'Modul ' + m.key)), reiterLeiste()];
  if (VIEW.profilReiter === 'orte') return kopf.concat(ausgangPanel());
  if (VIEW.profilReiter === 'tarn') return kopf.concat(
    h('p', { class: 'note pad' }, 'Fiktive Identitäten. Auf eine Anlagennummer klicken, um eine eigene Datei hinzuzufügen oder zu ersetzen. Die Dateien bleiben in diesem Browser.'),
    h('div', { class: 'profil-identitaeten' }, Object.keys(ARBEITS_IDENTITAETEN).map(arbeitsIdentitaetKarte)));
  const A = SCENARIO.agent, id = ARBEITS_IDENTITAETEN[aktiveLegendeId()], status = arbeitsProfilStatus();
  const kennung = panel('Agentenkennung', null, h('dl', { class: 'fields' }, feld('Codename', A.codename), feld('Interne ID', A.id),
    feld('Aktive Identität', id ? id.name + ' · ' + id.bezeichnung : '–', 'full'), feld('Status', statusLabel(status), 'full')),
    h('div', { class: 'row top' }, h('label', { for: 'sel-status' }, 'Status setzen'),
      h('select', { id: 'sel-status', value: status, onchange: function (ev) {
        arbeitsProfilSpeichern('arbeitsstatus', ev.target.value);
        renderHeader(); renderModule();
      } }, ARBEITS_STATUS.map(function (x) { return h('option', { value: x }, x); }))));
  kennung.id = 'profil-kennung';
  return kopf.concat(assessmentAnsicht(kennung, Date.now()),
    h('button', { id: 'profil-terminal-oeffnen', type: 'button', 'aria-keyshortcuts': 'T',
      onclick: terminalKonsoleOeffnen }, 'Terminal öffnen'),
    [STATE.agent.notizen, STATE.agent.einschraenkungen, VIEW.draft['ta-notizen'], VIEW.draft['ta-einschr']].some(Boolean) ?
      h('details', { class: 'panel profil-alt-notizen' }, h('summary', null, 'Bisherige Notizen'),
        h('div', { class: 'cols pad' },
          panel('Notizen', null, h('div', { class: 'pad' }, autosaveFeld('ta-notizen', 'notizen', 'Notizen'))),
          panel('Operative Einschränkungen', null, h('div', { class: 'pad' }, autosaveFeld('ta-einschr', 'einschraenkungen', 'Operative Einschränkungen'))))) : null,
    karteBereinigenPanel());
}
