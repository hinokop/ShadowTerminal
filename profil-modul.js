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
function terminalTabFehler(input, wert, version, antwort) {
  if (input.isConnected && document.activeElement === input && input.value === wert && TERMINAL_ZUSTAND.version === version &&
      antwort.error && terminalTabFehlerZuletzt !== antwort.error) {
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
const TERMINAL_TLE_DIRS = new Map([['/var', ['cache/']], ['/var/cache', ['tle/']], ['/var/cache/tle', ['leo.txt']]]);
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
  const kanal = TERMINAL_ZUSTAND.kanal;
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
async function terminalTransfer(name, bytes, weiter, simMs) {
  const t = TERMINAL_ZUSTAND, start = performance.now();
  // Animation for a local copy, not a measurement of a remote network.
  const dauer = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 :
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
  if (name === null) { terminalAusgabe(befehl + ': unterminated quote'); return; }
  if (befehl === 'ls' && arg.startsWith('-') && !lsLang && !lsAlle) {
    terminalAusgabe("ls: unrecognized option '" + arg + "'"); return;
  }
  if (!name && ['cat', 'head', 'tail', 'wget'].includes(befehl)) { terminalAusgabe(befehl + ': missing file operand'); return; }
  const virtuell = terminalShellPfad(befehl === 'cd' && !name ? '/' : lsLang || lsAlle ? '' : name);
  const nichtGefunden = befehl + ': ' + name + ': No such file or directory';
  if (!virtuell) { terminalAusgabe(befehl + ': ' + name + ': Permission denied'); return; }
  const voll = '/' + virtuell.join('/');
  const listing = !virtuell.length ? ['var/', TERMINAL_DB + '/'] : TERMINAL_TLE_DIRS.get(voll);
  if (listing) {
    if (befehl === 'cd') { t.ort = null; t.virtuellerOrt = virtuell; terminalKanalPromptSync(); }
    else if (befehl === 'ls') terminalAusgabe(listing.join('\n'));
    else terminalAusgabe(befehl + ': ' + name + ': Is a directory');
    return;
  }
  if (voll === TERMINAL_TLE_DATEI) {
    if (befehl === 'cd') terminalAusgabe('cd: ' + name + ': Not a directory');
    else if (befehl === 'wget') terminalAusgabe('wget: ' + name + ': unsupported source');
    else if (befehl === 'ls') terminalAusgabe('leo.txt');
    else terminalAusgabe('IRIDIUM-142\nProfile: demo LEO pass\nAzimuth: 142°\nElevation: 48°');
    return;
  }
  if (virtuell[0] !== TERMINAL_DB) { terminalAusgabe(nichtGefunden); return; }
  const pfad = virtuell.slice(1);
  const wgetStart = befehl === 'wget' ? new Date() : null;
  const antwort = await terminalBruecke(befehl, pfad, lsAlle);
  if (t.version !== version) return;
  if (antwort.error) {
    terminalAusgabe(antwort.error === 'Datei oder Ordner nicht gefunden' ? nichtGefunden : befehl + ': ' + antwort.error);
    return;
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
    if (t.version !== version) return;
    terminalTransferStop();
    terminalDownload(antwort, daten);
    terminalAusgabe([fertig, 'Empfangen [' + bytes + '/' + bytes + '] · Download gestartet']);
  } else terminalAusgabe(antwort.text);
}

const TERMINAL_ZUSTAND = { offen: false, ausgabe: [], prueft: false, dateiLaeuft: false, version: 0, ort: null, virtuellerOrt: null, kanal: null, fortschritt: '', verlauf: [], vpos: -1, entwurf: '', satAufbau: null, satBereit: null, satLink: null };
function terminalAusgabe(zeile) {
  const t = TERMINAL_ZUSTAND;
  t.ausgabe = t.ausgabe.concat(zeile).slice(-45);
  const el = $('profil-terminal-ausgabe');
  if (!el) return;
  el.textContent = t.ausgabe.join('\n');
  el.scrollTop = el.scrollHeight;
}
async function terminalPing() {
  const t = TERMINAL_ZUSTAND;
  if (t.prueft) { terminalAusgabe('relay · Anfrage läuft bereits'); return; }
  t.prueft = true;
  const version = t.version, start = performance.now(), abbruch = new AbortController();
  const timeout = setTimeout(function () { abbruch.abort(); }, 8000);
  const ergebnis = function (text) { if (t.version === version) terminalAusgabe(text); };
  try {
    const antwort = await fetch(TERMINAL_RELAY, { credentials: 'omit', referrerPolicy: 'no-referrer',
      redirect: 'error', cache: 'no-store', signal: abbruch.signal });
    if (!antwort.ok) { ergebnis('relay · HTTPS · HTTP ' + antwort.status); return; }
    const daten = await antwort.json();
    if (!daten.query || !daten.query.general) { ergebnis('relay · HTTPS · unerwartete Antwort'); return; }
    ergebnis('relay · HTTPS · ' + Math.max(1, Math.round(performance.now() - start)) + ' ms');
  } catch (e) {
    ergebnis('relay · HTTPS · ' + (abbruch.signal.aborted ? 'Zeitlimit überschritten' : 'nicht erreichbar'));
  } finally {
    clearTimeout(timeout);
    t.prueft = false;
  }
}
/* A staged dialogue, not a transport. No socket, storage, real key or mission state. */
const TERMINAL_SAT_TEILE = ['live', 'noaa_apt', '--source', 'rtlsdr', '--frequency', '137.1e6', '--samplerate', '2.4e6'];
const TERMINAL_SAT_BEFEHL = 'satcon ' + TERMINAL_SAT_TEILE.join(' ');
const TERMINAL_SAT_TX_TEILE = ['--target', 'IRIDIUM-142', '--device', 'limesdr', '--iface', 'sat0', '--tle', '/var/cache/tle/leo.txt'];
const TERMINAL_SAT_TX_BEFEHL = 'satcon-tx ' + TERMINAL_SAT_TX_TEILE.join(' ');
const TERMINAL_SAT_KANAL_ARG = '--connect --iface sat0 --route mixnet --ephemeral';
const TERMINAL_SAT_RATE = 2400, TERMINAL_SAT_MTU = 512, TERMINAL_SAT_CAP_MS = 60000;
function terminalSatRest(link) {
  const sek = Math.max(0, Math.ceil((link.bis - Date.now()) / 1000));
  return String(Math.floor(sek / 60)).padStart(2, '0') + 'm ' + String(sek % 60).padStart(2, '0') + 's';
}
function terminalSatAnzeige() {
  const feld = $('profil-terminal-sat');
  if (!feld) return;
  const link = TERMINAL_ZUSTAND.satLink;
  feld.hidden = !link;
  feld.textContent = link ? 'sat0 · LOS ' + terminalSatRest(link) : '';
}
function terminalSatLinkAktiv(link) {
  if (TERMINAL_ZUSTAND.satLink !== link) return false;
  if (Date.now() < link.bis) return true;
  const transfer = TERMINAL_ZUSTAND.kanal?.phase === 'transfer';
  terminalKanalAbbruch();
  terminalAusgabe(transfer ? ['[!] Loss of signal · sat0 down.', 'send: transfer interrupted'] : '[!] Loss of signal · sat0 down.');
  return false;
}
function terminalSatAbbruch() {
  const t = TERMINAL_ZUSTAND, alt = t.satAufbau;
  if (t.satLink) clearInterval(t.satLink.timer);
  t.satLink = null;
  terminalSatAnzeige();
  if (t.satBereit) {
    const privat = terminalIdentitaetZeilen(t.satBereit);
    t.ausgabe = t.ausgabe.filter(function (z) { return !privat.includes(z); });
    terminalAusgabe([]);
  }
  t.satAufbau = null; t.satBereit = null;
  if (alt) alt.abbrechen();
}
async function terminalSatTxStart(arg) {
  const t = TERMINAL_ZUSTAND;
  if (arg.split(/\s+/).join(' ') !== TERMINAL_SAT_TX_TEILE.join(' ')) { terminalAusgabe('usage: ' + TERMINAL_SAT_TX_BEFEHL); return; }
  if (t.satAufbau || t.dateiLaeuft || t.prueft) { terminalAusgabe('satcon-tx: operation in progress'); return; }
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
    if (t.satAufbau !== aufbau) return;
    if (text) terminalAusgabe(text);
  }
  t.satAufbau = null;
  const link = { bis: Date.now() + (300 + terminalKanalZufall(601)) * 1000, timer: null };
  t.satLink = link;
  link.timer = setInterval(function () { if (terminalSatLinkAktiv(link)) terminalSatAnzeige(); }, 250);
  terminalSatAnzeige();
  terminalAusgabe('[*] Orbital pass window remaining: ' + terminalSatRest(link) + '.');
}
async function terminalSatStart(arg) {
  const t = TERMINAL_ZUSTAND;
  if (t.satAufbau || t.dateiLaeuft || t.prueft) { terminalAusgabe('Eine Anfrage läuft bereits'); return; }
  if (arg.split(/\s+/).join(' ') !== TERMINAL_SAT_TEILE.join(' ')) { terminalAusgabe(TERMINAL_SAT_BEFEHL); return; }
  terminalSatAbbruch();
  const aufbau = { abbrechen: function () {} }, ident = terminalKanalIdentitaet();
  t.satAufbau = aufbau;
  const reduziert = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const frequenz = (Number(TERMINAL_SAT_TEILE[5]) / 1e6).toFixed(3);
  const werte = ['137.620', '137.912']; if (terminalKanalZufall(2)) werte.reverse(); werte.push(frequenz);
  const zeilen = ['[*] Initializing encrypted uplink...'].concat(werte.map(function (mhz) {
    return '[*] Negotiating frequency lock (' + mhz + ' MHz)...';
  }), ['[*] Establishing Doppler-compensated session...', '[*] Handshake complete. Forward secrecy active.', '[*] Assigning temporary identity...']);
  for (const zeile of zeilen) {
    await new Promise(function (ok) { const timer = setTimeout(ok, reduziert ? 0 : 420); aufbau.abbrechen = function () { clearTimeout(timer); ok(); }; });
    if (t.satAufbau !== aufbau) return;
    terminalAusgabe(zeile);
  }
  t.satAufbau = null; t.satBereit = ident;
  terminalAusgabe(terminalIdentitaetZeilen(ident).concat([
    'Satellite:     NOAA-19 (APT) · ' + frequenz + ' MHz',
    'Link quality:  ' + (82 + terminalKanalZufall(15)) + ' % · SNR ' + ((120 + terminalKanalZufall(61)) / 10).toFixed(1) + ' dB',
    '', 'Secure connection ready.'
  ]));
}
const TERMINAL_KANAL_BEFEHL = 'secure-channel --connect --onion --ephemeral';
const TERMINAL_KANAL_LINIE = '────────────────────────────────────────';
const TERMINAL_KANAL_START = [
  '[*] Initializing encrypted tunnel...',
  '[*] Generating ephemeral keypair... OK',
  '[*] Establishing double-ratchet session...',
  '[*] Handshake complete. Forward secrecy active.',
  '[*] Assigning temporary identity...'
];
function terminalKanalZufall(n) {
  return crypto.getRandomValues(new Uint32Array(1))[0] % n;
}
function terminalKanalZeichen(alphabet, laenge) {
  return Array.from({ length: laenge }, function () { return alphabet[terminalKanalZufall(alphabet.length)]; }).join('');
}
function terminalKanalPromptSync() {
  const label = $('profil-terminal-prompt');
  if (label) label.textContent = terminalPrompt();
}
function terminalKanalAbbruch() {
  const t = TERMINAL_ZUSTAND;
  terminalSatAbbruch();
  if (!t.kanal) return;
  const kanal = t.kanal;
  t.ausgabe = kanal.vorher;
  t.kanal = null;
  if (kanal.pauseBeenden) kanal.pauseBeenden();
  terminalTransferStop();
  const eingabe = $('profil-terminal-eingabe');
  if (eingabe) terminalEingabeSetzen(eingabe, '');
  terminalKanalPromptSync();
  terminalAusgabe([]);
}
const TERMINAL_KANAL_TEMPO = { aufbau: 950, antwort: 15000, vorAbbau: 2000, abbau: 650 };
function terminalKanalPause(kanal, ms) {
  return new Promise(function (ok) {
    const fertig = function () {
      clearTimeout(timer);
      kanal.pauseBeenden = null;
      ok(TERMINAL_ZUSTAND.kanal === kanal && (!kanal.link || terminalSatLinkAktiv(kanal.link)));
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
    'Channel:       end-to-end · self-destruct after close'
  ];
}
async function terminalKanalStart(sat = false) {
  const t = TERMINAL_ZUSTAND;
  if (sat) { await terminalSatKanalStart(); return; }
  if (!t.satBereit) { terminalAusgabe('[!] keine sichere Verbindung hergestellt'); return; }
  if (t.dateiLaeuft || t.prueft) { terminalAusgabe('Eine Anfrage läuft bereits'); return; }
  const ident = t.satBereit, kanal = { phase: 'start', vorher: t.ausgabe.filter(function (z) { return !terminalIdentitaetZeilen(ident).includes(z); }), knoten: ident.knoten, sitzung: ident.sitzung };
  t.satBereit = null;
  t.kanal = kanal;
  terminalKanalPromptSync();
  if (!await terminalKanalFolge(kanal, TERMINAL_KANAL_START, TERMINAL_KANAL_TEMPO.aufbau)) return;
  terminalAusgabe(terminalIdentitaetZeilen(ident).concat(TERMINAL_KANAL_LINIE));
  kanal.phase = 'eingabe';
  terminalKanalPromptSync();
}
async function terminalSatKanalStart() {
  const t = TERMINAL_ZUSTAND, link = t.satLink;
  if (!link || !terminalSatLinkAktiv(link)) { terminalAusgabe('secure-channel: sat0: Link is down'); return; }
  if (t.dateiLaeuft || t.prueft) { terminalAusgabe('Eine Anfrage läuft bereits'); return; }
  const ident = terminalKanalIdentitaet(), kanal = { phase: 'start', vorher: t.ausgabe.slice(), link,
    knoten: ident.knoten, sitzung: ident.sitzung, kontakt: ident.kontakt };
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
    if (!await terminalKanalPause(kanal, reduziert ? 0 : pause)) return;
    if (text) terminalAusgabe(text);
  }
  terminalAusgabe(terminalIdentitaetZeilen(ident).slice(0, 2).concat([
    'Transport:     sat0 (IRIDIUM-142) · 2.4 kbps Burst-Mode',
    'Window:        ' + terminalSatRest(link) + ' remaining before loss of signal (LOS)', TERMINAL_KANAL_LINIE
  ]));
  kanal.phase = 'eingabe';
  terminalKanalPromptSync();
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
  const t = TERMINAL_ZUSTAND, start = new Date(), aktiv = function () {
    return t.kanal === kanal && (!kanal.link || terminalSatLinkAktiv(kanal.link));
  };
  kanal.phase = 'transfer';
  terminalKanalPromptSync();
  const antwort = await terminalBruecke('send', pfad);
  if (!aktiv()) return;
  if (antwort.error) {
    terminalAusgabe('send: ' + antwort.error);
  } else if (kanal.link) {
    const gepolstert = Math.max(64, Math.ceil(antwort.bytes / 64) * 64);
    const reellMs = gepolstert * 8000 / TERMINAL_SAT_RATE, simMs = Math.min(TERMINAL_SAT_CAP_MS, reellMs);
    terminalAusgabe([
      '[*] Preparing & padding payload (' + terminalDateigroesse(antwort.bytes) + ' → ' + terminalDateigroesse(gepolstert) + ').',
      '[*] Encrypting ' + Math.ceil(gepolstert / TERMINAL_SAT_MTU) + ' chunks for sat0 (MTU ' + TERMINAL_SAT_MTU + ' · 2.4 kbps).'
    ]);
    if (simMs < reellMs) terminalAusgabe('[*] Accelerated transfer simulation (60 s cap).');
    const fertig = await terminalTransfer(antwort.name, gepolstert, aktiv, simMs);
    if (!aktiv()) return;
    terminalTransferStop();
    terminalAusgabe([fertig, '[*] ACK received from peer [' + kanal.kontakt + '].']);
  } else {
    const name = antwort.name, bytes = antwort.bytes;
    terminalAusgabe([
      '--' + start.toISOString().slice(0, 19).replace('T', ' ') + 'Z--  SEND /' + [TERMINAL_DB].concat(pfad).join('/'),
      'Empfänger: ' + kanal.knoten + '  (session: ' + kanal.sitzung + ')',
      'Lokale Archivbrücke … 200 OK',
      'Länge: ' + bytes + ' (' + terminalDateigroesse(bytes) + ')',
      'Übergabe an Kanalpuffer: »' + name + '«'
    ]);
    const fertig = await terminalTransfer(name, bytes, aktiv);
    if (!aktiv()) return;
    terminalTransferStop();
    terminalAusgabe([fertig, 'Kanalpuffer vollständig [' + bytes + '/' + bytes + '] · Übermittlung bestätigt']);
  }
  kanal.phase = 'eingabe';
  terminalKanalPromptSync();
}
async function terminalKanalMeldung(zeile, kanal) {
  if (zeile === '/close' || zeile === 'clear') {
    if (zeile === '/close' && kanal.link && kanal.phase === 'eingabe') await terminalSatKanalEnde(kanal, false);
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
  if (kanal.link) { await terminalSatKanalEnde(kanal, true); return; }
  const protokoll = [
    '[*] Closing channel...',
    '[*] Burning session keys...',
    '[*] Wiping memory buffers... (' + (16 + terminalKanalZufall(81)) + ' kb)',
    '[*] Connection terminated.'
  ];
  terminalAusgabe(protokoll[0]);
  if (!await terminalKanalFolge(kanal, protokoll.slice(1), TERMINAL_KANAL_TEMPO.abbau)) return;
  terminalKanalAbbruch();
  terminalAusgabe(['> Verstanden.', TERMINAL_KANAL_LINIE].concat(protokoll));
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

function terminalBefehl(zeile) {
  const m = /^(\S+)(?:\s+(.*))?$/.exec(zeile);
  const befehl = m[1], arg = m[2] || '', t = TERMINAL_ZUSTAND;
  if (befehl === 'exit' && !arg) {
    terminalKanalAbbruch();
    t.version++;
    terminalTransferStop();
    terminalKonsoleSchliessen();
    return;
  }
  if (t.satLink) terminalSatLinkAktiv(t.satLink);
  if (t.kanal) { void terminalKanalMeldung(zeile, t.kanal); return; }
  if (befehl === 'clear' && !arg) { t.version++; terminalTransferStop(); t.ausgabe = []; terminalAusgabe([]); return; }
  terminalAusgabe(terminalPrompt() + ' ' + zeile);
  if (befehl === 'help' && !arg) terminalAusgabe(['ls [-l|-la] · cd <ordner> · pwd · cat <datei> · head <datei> · tail <datei> · wget <datei> · send <datei> (im Kanal) · whoami · uname -a · date · ping relay · clear · exit',
    TERMINAL_SAT_BEFEHL + ' · ' + TERMINAL_KANAL_BEFEHL, TERMINAL_SAT_TX_BEFEHL, 'secure-channel ' + TERMINAL_SAT_KANAL_ARG]);
  else if (befehl === 'pwd' && !arg) terminalAusgabe(terminalArbeitsverzeichnis());
  else if (befehl === 'whoami' && !arg) terminalAusgabe('root');
  else if (befehl === 'uname' && arg === '-a') terminalAusgabe(TERMINAL_UBUNTU);
  else if (befehl === 'date' && !arg) terminalAusgabe(fmtZ(new Date()));
  else if (befehl === 'ping') {
    if (arg === 'relay') terminalPing();
    else terminalAusgabe(arg ? 'ping: ' + arg + ': Name or service not known' : 'ping: usage: ping <destination>');
  } else if (befehl === 'send') terminalAusgabe('send: channel not connected');
  else if (befehl === 'satcon') void terminalSatStart(arg);
  else if (befehl === 'satcon-tx') void terminalSatTxStart(arg);
  else if (befehl === 'secure-channel') {
    if (arg === '--connect --onion --ephemeral') void terminalKanalStart();
    else if (arg.split(/\s+/).join(' ') === TERMINAL_SAT_KANAL_ARG) void terminalKanalStart(true);
    else terminalAusgabe([TERMINAL_KANAL_BEFEHL, 'secure-channel ' + TERMINAL_SAT_KANAL_ARG]);
  } else if (TERMINAL_DATEIBEFEHLE.includes(befehl)) {
    if (t.dateiLaeuft) { terminalAusgabe('Datenbankanfrage läuft bereits'); return; }
    t.dateiLaeuft = true;
    const version = t.version;
    terminalDateiBefehl(befehl, arg, version).catch(function () {
      if (t.version === version) terminalAusgabe('Dateioperation fehlgeschlagen');
    }).finally(function () { t.dateiLaeuft = false; });
  } else if (['help', 'exit', 'clear', 'pwd', 'whoami', 'uname', 'date'].includes(befehl)) {
    terminalAusgabe('usage: ' + befehl + (befehl === 'uname' ? ' -a' : ''));
  } else terminalAusgabe(befehl + ': command not found');
}
const TERMINAL_DATEIBEFEHLE = ['ls', 'cd', 'cat', 'head', 'tail', 'wget'];
const TERMINAL_BEFEHLE = TERMINAL_DATEIBEFEHLE.concat(['help', 'pwd', 'whoami', 'uname', 'date', 'ping', 'clear', 'exit', 'satcon', 'satcon-tx', 'secure-channel', 'send']);
function terminalTabKandidaten(input, bisher, version, kopf, prefix, kandidaten, format) {
  if (!input.isConnected || input.value !== bisher || TERMINAL_ZUSTAND.version !== version ||
      document.activeElement !== input || input.selectionStart !== bisher.length || input.selectionEnd !== bisher.length) return;
  const treffer = kandidaten.filter(function (x) { return x.toLowerCase().startsWith(prefix.toLowerCase()); });
  if (treffer.length === 1) { terminalEingabeSetzen(input, kopf + format(treffer[0])); return; }
  if (treffer.length < 2) return;
  let gemeinsam = treffer[0];
  while (!treffer.every(function (x) { return x.startsWith(gemeinsam); })) gemeinsam = gemeinsam.slice(0, -1);
  if (gemeinsam.length > prefix.length) terminalEingabeSetzen(input, kopf + gemeinsam);
  else terminalAusgabe(treffer.join('  '));
}
async function terminalTab(input, bisher, m) {
  const t = TERMINAL_ZUSTAND, version = t.version;
  const befehl = m[1], arg = m[2];
  const fertig = function (kopf, prefix, kandidaten, format) {
    terminalTabKandidaten(input, bisher, version, kopf, prefix, kandidaten, format);
  };
  if (arg === undefined) {
    // Den etablierten Kurzbefehl „sat<Tab>“ unverändert lassen.
    const kandidaten = 'satcon'.startsWith(befehl) ? ['satcon'] : TERMINAL_BEFEHLE;
    fertig('', befehl, kandidaten, function (x) { return x + ' '; });
    return;
  }
  if (befehl === 'satcon' || befehl === 'satcon-tx') {
    const vorgabe = befehl === 'satcon' ? TERMINAL_SAT_TEILE : TERMINAL_SAT_TX_TEILE;
    const teile = arg.split(/\s+/), prefix = teile.pop(), kandidat = vorgabe[teile.length];
    if (kandidat && teile.every(function (x, i) { return x === vorgabe[i]; })) {
      fertig(bisher.slice(0, bisher.length - prefix.length), prefix, [kandidat], function (x) { return x + ' '; });
    }
    return;
  }
  if (befehl === 'secure-channel') {
    const sat = TERMINAL_ZUSTAND.satLink || arg.startsWith('--connect --i');
    fertig('secure-channel ', arg, [sat ? TERMINAL_SAT_KANAL_ARG : '--connect --onion --ephemeral'], function (x) { return x; });
    return;
  }
  if (befehl === 'ping' || befehl === 'uname' || (befehl === 'ls' && arg.startsWith('-'))) {
    fertig(befehl + ' ', arg, befehl === 'ping' ? ['relay'] : befehl === 'uname' ? ['-a'] : ['-a', '-l', '-la'], function (x) { return x; });
    return;
  }
  const anfang = arg[0] === '"' || arg[0] === "'" ? arg[0] : '';
  const pfad = anfang ? arg.slice(1, arg.endsWith('/' + anfang) ? -1 : undefined) : arg;
  if ((anfang && pfad.includes(anfang)) || /[:\\]|[\u0000-\u001f\u007f]/.test(pfad)) return;
  const ort = terminalArbeitsverzeichnis(), slash = pfad.lastIndexOf('/') + 1;
  const basis = pfad.slice(0, slash), prefix = pfad.slice(slash);
  const teile = terminalShellPfad(basis);
  if (!teile) return;
  const listing = !teile.length ? ['var/', TERMINAL_DB + (basis ? '/' : '')] : TERMINAL_TLE_DIRS.get('/' + teile.join('/'));
  if (listing) {
    const namen = listing.filter(x => befehl !== 'cd' || x !== 'leo.txt').map(x => basis + x);
    fertig(befehl + ' ' + anfang, pfad, namen, function (x) { return x + anfang; });
    return;
  }
  if (teile[0] !== TERMINAL_DB) return;
  const antwort = await terminalBruecke('ls', teile.slice(1), prefix.startsWith('.'));
  if (terminalArbeitsverzeichnis() !== ort) return;
  if (!antwort.entries) { terminalTabFehler(input, bisher, version, antwort); return; }
  terminalTabFehlerZuletzt = '';
  const namen = antwort.entries.filter(function (x) { return x.dir || befehl !== 'cd'; })
    .map(function (x) { return basis + x.name + (x.dir ? '/' : ''); });
  fertig(befehl + ' ' + anfang, pfad, namen, function (x) {
    const quote = anfang || (/\s|^'/.test(x) ? '"' : '');
    return (quote && !anfang ? quote : '') + x + quote;
  });
}
async function terminalKanalTab(input, bisher, kanal) {
  const m = /^send\s+(.*)$/.exec(bisher);
  if (!m) return;
  const anfang = m[1][0] === '"' || m[1][0] === "'" ? m[1][0] : '';
  const pfad = anfang ? m[1].slice(1, m[1].endsWith('/' + anfang) ? -1 : undefined) : m[1];
  if (anfang && pfad.includes(anfang)) return;
  const version = TERMINAL_ZUSTAND.version;
  const kopf = 'send ' + anfang;
  const format = function (x) {
    const quote = anfang || (/\s|^'/.test(x) ? '"' : '');
    return (quote && !anfang ? quote : '') + x + quote;
  };
  const prefix = '/' + TERMINAL_DB + '/';
  if (!pfad || (pfad.startsWith('/') && !pfad.startsWith(prefix)) || (!TERMINAL_ZUSTAND.ort && !pfad.includes('/'))) {
    terminalTabKandidaten(input, bisher, version, kopf, pfad, [pfad.startsWith('/') || !pfad ? prefix : prefix.slice(1)], function () { return format(prefix); });
    return;
  }
  const basis = pfad.slice(0, pfad.lastIndexOf('/') + 1);
  const parent = basis.replace(/\/$/, '');
  const teile = basis === prefix ? [] : basis ? terminalArchivDateipfad('"' + parent + '"') : TERMINAL_ZUSTAND.ort;
  if (!teile) return;
  const antwort = await terminalBruecke('ls', teile, pfad.slice(basis.length).startsWith('.'));
  if (TERMINAL_ZUSTAND.kanal !== kanal || kanal.phase !== 'eingabe') return;
  if (!antwort.entries) { terminalTabFehler(input, bisher, version, antwort); return; }
  terminalTabFehlerZuletzt = '';
  terminalTabKandidaten(input, bisher, version, kopf, pfad, antwort.entries.map(function (x) {
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
  if (ev.key === 'Enter') {
    if (ev.isComposing || ev.keyCode === 229) return;
    ev.preventDefault();
    if (!ev.repeat) ev.currentTarget.form.requestSubmit();
    return;
  }
  if (terminalVerlaufTaste(ev)) return;
  if (TERMINAL_ZUSTAND.kanal) {
    const kanal = TERMINAL_ZUSTAND.kanal, input = ev.currentTarget, wert = input.value;
    if (kanal.phase === 'eingabe' && ev.key === 'Tab' && !ev.shiftKey && !ev.ctrlKey && !ev.altKey && !ev.metaKey && !ev.isComposing &&
        input.selectionStart === wert.length && input.selectionEnd === wert.length && /^send\s/.test(wert)) {
      ev.preventDefault();
      void terminalKanalTab(input, wert, kanal);
    }
    return;
  }
  if (ev.key !== 'Tab' || ev.shiftKey || ev.ctrlKey || ev.altKey || ev.metaKey || ev.isComposing) return;
  const input = ev.currentTarget, bisher = input.value;
  if (input.selectionStart !== bisher.length || input.selectionEnd !== bisher.length) return;
  const m = /^(\S+)(?:\s+(.*))?$/.exec(bisher);
  if (TERMINAL_ZUSTAND.dateiLaeuft || !m || (m[2] === undefined ? !TERMINAL_BEFEHLE.some(function (x) { return x.startsWith(m[1]); }) :
    !['cd', 'cat', 'head', 'tail', 'wget', 'ping', 'uname', 'ls', 'satcon', 'satcon-tx', 'secure-channel'].includes(m[1]))) return;
  ev.preventDefault();
  terminalTab(input, bisher, m).catch(function () {});
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
    oninput: function (ev) {
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
      h('pre', { id: 'profil-terminal-transfer', class: 'mono', hidden: !t.fortschritt }, t.fortschritt),
      h('form', { onsubmit: function (ev) {
        ev.preventDefault();
        const zeile = input.value.replace(/\n/g, ' ').trim();
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
  if (t.satAufbau) {
    terminalSatAbbruch(); terminalAusgabe('[!] Verbindungsaufbau abgebrochen');
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
  terminalKanalAbbruch(); terminalVerlaufLeeren();
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
