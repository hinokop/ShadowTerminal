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
    if (TERMINAL_ZUSTAND.kanal) terminalPppChatLog(TERMINAL_ZUSTAND.kanal, 'Tab: ' + antwort.error);
    else terminalAusgabe('Tab: ' + antwort.error);
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
  ['/var/cache/tle', ['kestrel.tle']], ['/var/log', ['syslog']],
  ['/etc', ['chatscripts/', 'ppp/']], ['/etc/ppp', ['peers/']], ['/etc/ppp/peers', ['kestrel']], ['/etc/chatscripts', ['kestrel']]]);
// Virtuelle Textdateien der Einwahlkette (Inhalt bei Aufruf erzeugt).
const TERMINAL_VIRT_DATEIEN = new Map([
  ['/var/cache/tle/kestrel.tle', function () { return KESTREL_TLE.map(function (e) { return e.join('\n'); }).join('\n'); }],
  ['/etc/ppp/peers/kestrel', function () { return ['/dev/ttyUSB0', '19200', 'crtscts', 'lock', 'noauth', 'defaultroute', 'usepeerdns',
    'connect "/usr/sbin/chat -v -f /etc/chatscripts/kestrel"'].join('\n'); }],
  ['/etc/chatscripts/kestrel', function () { return ['ABORT BUSY', "ABORT 'NO CARRIER'", "'' ATZ", 'OK AT+CSQ', 'OK ATDT' + TERMINAL_PPP_WAHL, "CONNECT ''"].join('\n'); }]
]);
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
  if (TERMINAL_ZUSTAND.orbitLive) return 'predict · Ctrl+C';
  if (terminalPppWaehltVorne()) return '';
  if (TERMINAL_ZUSTAND.kette && !TERMINAL_ZUSTAND.kanal) return '';
  const kanal = TERMINAL_ZUSTAND.kanal;
  if (kanal) return '>';
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
  const listing = !virtuell.length ? ['etc/', 'var/', TERMINAL_DB + '/'] : TERMINAL_TLE_DIRS.get(voll);
  if (listing) {
    if (befehl === 'cd') { t.ort = null; t.virtuellerOrt = virtuell; terminalKanalPromptSync(); return 0; }
    if (befehl === 'ls') { terminalAusgabe(listing.join('\n')); return 0; }
    terminalAusgabe(befehl + ': ' + name + ': Is a directory');
    return 1;
  }
  if (voll === '/var/log/syslog' || TERMINAL_VIRT_DATEIEN.has(voll)) {
    if (befehl === 'cd') { terminalAusgabe('cd: ' + name + ': Not a directory'); return 1; }
    if (befehl === 'wget') { terminalAusgabe('wget: ' + name + ': unsupported source'); return 1; }
    if (befehl === 'ls') terminalAusgabe(virtuell.at(-1));
    else if (voll === '/var/log/syslog') terminalSyslog(befehl === 'cat' ? 60 : 10);
    else {
      const zeilen = TERMINAL_VIRT_DATEIEN.get(voll)().split('\n');
      terminalAusgabe(befehl === 'head' ? zeilen.slice(0, 10) : befehl === 'tail' ? zeilen.slice(-10) : zeilen);
    }
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

const TERMINAL_ZUSTAND = { offen: false, ausgabe: [], prueft: false, dateiLaeuft: false, version: 0, ort: null, virtuellerOrt: null, kanal: null, fortschritt: '', verlauf: [], vpos: -1, entwurf: '', satLink: null, orbitLive: false, modem: null, wgSat: null, syslog: [], kette: null, status: 0, tmux: null };
// Scrollback der Shell; größer als die längste Einzelausgabe (predict -f), damit nichts still verloren geht.
const TERMINAL_PUFFER = 1000;
function terminalAusgabe(zeile) {
  const t = TERMINAL_ZUSTAND;
  t.ausgabe = t.ausgabe.concat(zeile).slice(-TERMINAL_PUFFER);
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
// Übertragungsrate der Funkstrecke für /sendfile; Dauer gedeckelt.
const TERMINAL_SAT_RATE = 2400, TERMINAL_SAT_CAP_MS = 60000;
function terminalSatRest(link) {
  const sek = Math.max(0, Math.ceil((link.bis - Date.now()) / 1000));
  return String(Math.floor(sek / 60)).padStart(2, '0') + 'm ' + String(sek % 60).padStart(2, '0') + 's';
}
function terminalSatAnzeige() {
  const feld = $('profil-terminal-sat');
  if (!feld) return;
  const t = TERMINAL_ZUSTAND, link = t.satLink;
  // Ein berechneter Überflug allein belegt keine Verbindung; der Countdown gilt nur, solange die Einwahl steht.
  const sichtbar = !!link && !link.abgelaufen && !!(t.modem || t.wgSat || t.kanal);
  feld.hidden = !sichtbar;
  feld.textContent = sichtbar ? link.sat.name + ' · LOS ' + terminalSatRest(link) : '';
  terminalPppAnzeige();
}
function terminalSatLinkAktiv(link) {
  if (TERMINAL_ZUSTAND.satLink !== link) return false;
  if (Date.now() < link.bis) return true;
  if (!link.abgelaufen) {
    link.abgelaufen = true;
    clearInterval(link.timer);
    terminalPppModemAus('Modem hangup (NO CARRIER)');
    terminalSatAnzeige();
  }
  return false;
}
function terminalSatAbbruch() {
  const t = TERMINAL_ZUSTAND;
  if (t.satLink) clearInterval(t.satLink.timer);
  t.satLink = null;
  terminalOrbitEnde();
  if (t.wgSat) clearTimeout(t.wgSat.timer);
  if (t.modem) { clearTimeout(t.modem.timer); terminalVordergrundEnde(t.modem, 1); }
  if (t.wgSat) terminalVordergrundEnde(t.wgSat, 1);
  t.modem = t.wgSat = null;
  terminalSatAnzeige();
  terminalKanalPromptSync();
}
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
  if (t.kanal) terminalPppChatAus();
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

/* Fixed command grammar and in-memory state. No host processes, sockets or network configuration. */
/* KESTREL-Relaiskette: fiktive Namen, Bahndaten echter Satelliten in niedriger Umlaufbahn (TLE, Prüfsumme geprüft).
   Bahnrechnung mit SGP4 (satellite.js); Beobachter (QTH) ist der erste Ausgangsort mit Kartenposition. */
const KESTREL_TLE = [
  // Stand: Celestrak, Epoche 17./18.11.2026 (Gruppe orbcomm). Bahndaten veralten; nach einigen Wochen neu laden.
  ['KESTREL-1', '1 25159U 98007C   26322.22333344  .00000814  00000+0  32286-3 0  9991',
    '2 25159 107.9644 126.4710 0038305  54.9257 305.5467 14.35966259498705'],
  ['KESTREL-2', '1 40086U 14040A   26321.64062303  .00000552  00000+0  15257-3 0  9999',
    '2 40086  47.0025  85.8943 0002081 215.7844 144.2902 14.58980736656759'],
  ['KESTREL-3', '1 41184U 15081F   26322.22716031  .00000693  00000+0  18210-3 0  9992',
    '2 41184  46.9992 261.7608 0002649 216.5058 143.5648 14.59032038581445'],
  ['KESTREL-4', '1 41182U 15081D   26322.25736361  .00000726  00000+0  18913-3 0  9998',
    '2 41182  47.0032 352.8610 0001881  44.3171 315.7865 14.59012720580129']
];
const TERMINAL_PPP_DATEI = '/var/cache/tle/kestrel.tle';
const TERMINAL_PREDICT_DB = '~/.predict/predict.tle';
const TERMINAL_PPP_PEER = 'kestrel';
const TERMINAL_PPP_WAHL = '00882994401'; // Gateway im Format der Vorwahl +882 (International Networks); Netzkennung nicht als frei geprüft
const KESTREL_MIN_EL = 5;
const KESTREL_QTH_STANDARD = { name: 'DEFAULT', lat: 52.52, lon: 13.405, hoehe: 34 };
let KESTREL_SATS = null;
function kestrelSats() {
  if (!KESTREL_SATS) KESTREL_SATS = KESTREL_TLE.map(function (e) {
    return { name: e[0], l1: e[1], l2: e[2], rec: satellite.twoline2satrec(e[1], e[2]), rev: Number(e[2].slice(63, 68)) };
  });
  return KESTREL_SATS;
}
function kestrelSat(name) { return kestrelSats().find(function (x) { return x.name === name; }) || null; }
function kestrelQth() {
  const o = (typeof PROFIL !== 'undefined' && Array.isArray(PROFIL.ausgang) ? PROFIL.ausgang : []).find(function (x) { return x && Array.isArray(x.ll); });
  return o ? { name: String(o.name || 'QTH').slice(0, 24), lat: Number(o.ll[0]), lon: Number(o.ll[1]), hoehe: 100 } : KESTREL_QTH_STANDARD;
}
// Sonnenrichtung (Näherung des Astronomical Almanac) im äquatorialen System, Einheit km.
function kestrelSonne(ms) {
  const n = ms / 86400000 + 2440587.5 - 2451545.0, r = Math.PI / 180;
  const g = (357.528 + 0.9856003 * n) * r, L = 280.460 + 0.9856474 * n;
  const lam = (L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * r, eps = (23.439 - 0.0000004 * n) * r;
  const au = 149597870.7 * (1.00014 - 0.01671 * Math.cos(g) - 0.00014 * Math.cos(2 * g));
  return { x: au * Math.cos(lam), y: au * Math.cos(eps) * Math.sin(lam), z: au * Math.sin(eps) * Math.sin(lam) };
}
function kestrelLage(sat, ms) {
  const S = satellite, d = new Date(ms), q = kestrelQth(), r = Math.PI / 180;
  const pv = S.propagate(sat.rec, d);
  if (!pv || !pv.position) return null;
  const gmst = S.gstime(d);
  const obs = { latitude: q.lat * r, longitude: q.lon * r, height: q.hoehe / 1000 };
  const la = S.ecfToLookAngles(obs, S.eciToEcf(pv.position, gmst));
  const geo = S.eciToGeodetic(pv.position, gmst);
  const minuten = ms / 60000 - (sat.rec.jdsatepoch - 2440587.5) * 1440;
  const ma = ((sat.rec.mo + sat.rec.no * minuten) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
  const p = pv.position, so = kestrelSonne(ms), sl = Math.hypot(so.x, so.y, so.z);
  const dot = (p.x * so.x + p.y * so.y + p.z * so.z) / sl;
  const quer = Math.sqrt(Math.max(0, p.x * p.x + p.y * p.y + p.z * p.z - dot * dot));
  const sonnig = dot > 0 || quer > 6378.137;
  const lonE = geo.longitude / r;
  return { el: la.elevation / r, az: ((la.azimuth / r) % 360 + 360) % 360, lat: geo.latitude / r, lonW: ((360 - lonE) % 360 + 360) % 360,
    range: la.rangeSat, phase: Math.floor(ma * 256 / (2 * Math.PI)) % 256,
    umlauf: sat.rev + Math.floor((sat.rec.mo + sat.rec.no * minuten) / (2 * Math.PI)), sonnig };
}
function kestrelEl(sat, ms) { const l = kestrelLage(sat, ms); return l ? l.el : -90; }
// Nächster Überflug ab "ab" (läuft einer, dann dieser): Aufgang, Untergang, höchster Punkt; null, wenn keiner in 48 h.
function kestrelUeberflug(sat, ab) {
  // Zwischenspeicher: ein berechneter Überflug gilt für alle späteren Anfragen bis zu seinem Untergang (gleicher QTH).
  const q = kestrelQth(), schluessel = q.lat + ',' + q.lon, c = sat.cache;
  if (c && c.schluessel === schluessel && ab >= c.ab && (c.u ? ab <= c.u.bis : ab - c.ab < 3600000)) return c.u;
  const u = kestrelUeberflugRechnen(sat, ab);
  sat.cache = { schluessel, ab, u };
  return u;
}
function kestrelUeberflugRechnen(sat, ab) {
  const schritt = 30000, grenze = function (a, b) {
    let lo = a, hi = b; // el(lo) < 0 <= el(hi) oder umgekehrt
    const steigend = kestrelEl(sat, b) >= 0;
    while (hi - lo > 20) { const m = (lo + hi) / 2; if ((kestrelEl(sat, m) >= 0) === steigend) hi = m; else lo = m; }
    return Math.round((steigend ? hi : lo) / 1000) * 1000;
  };
  let von;
  if (kestrelEl(sat, ab) >= 0) {
    let a = ab;
    while (kestrelEl(sat, a - schritt) >= 0 && ab - a < 3600000) a -= schritt;
    von = grenze(a - schritt, a);
  } else {
    let a = ab;
    // Tief unter dem Horizont größere Schritte; ein Überflug dauert länger als der größte Schritt bis zum Aufgang.
    let e = kestrelEl(sat, a), letzter = schritt;
    while (e < 0) { letzter = e < -40 ? 240000 : e < -15 ? 90000 : schritt; a += letzter; if (a - ab > 172800000) return null; e = kestrelEl(sat, a); }
    von = grenze(a - letzter, a);
  }
  // Höchster Punkt und Untergang über den ganzen Überflug, unabhängig vom Abfragezeitpunkt.
  let b = von + 1000, max = { ms: von, el: 0 };
  while (kestrelEl(sat, b) >= 0) { const e = kestrelEl(sat, b); if (e > max.el) max = { ms: b, el: e }; b += 10000; if (b - von > 3600000) break; }
  let lo = b - 10000, hi = b;
  while (hi - lo > 20) { const m = (lo + hi) / 2; if (kestrelEl(sat, m) >= 0) lo = m; else hi = m; }
  return { sat, von, bis: Math.round(lo / 1000) * 1000, maxMs: Math.round(max.ms / 1000) * 1000, maxEl: max.el };
}
function kestrelSichtbar(ms) {
  return kestrelSats().map(function (x) { return { sat: x, el: kestrelEl(x, ms) }; })
    .filter(function (x) { return x.el >= 0; }).sort(function (a, b) { return b.el - a.el; });
}
// Sitzungswerte: Prozessnummern und Adressen je Sitzung verschieden.
const TERMINAL_SITZUNG = (function () {
  const z = function (n) { return crypto.getRandomValues(new Uint32Array(1))[0] % n; };
  const pid = 1100 + z(28000);
  return { pppd: pid, chat: pid + 1, lokal: '10.64.' + (z(250) + 2) + '.' + (z(250) + 2), gegenstelle: '10.64.0.1' };
})();
function terminalPppEnde() { return 'pppd[' + TERMINAL_SITZUNG.pppd + ']: Connection terminated.'; }
function terminalPppZeit(ms) {
  return new Date(ms).toISOString().slice(11, 19);
}
const TERMINAL_PREDICT_USAGE = 'usage: predict [-t <tlefile>] [-p <satellite> [start] | -f <satellite> [start [end|+n[m]]]]';
const TERMINAL_PREDICT_MAX = 600;
function terminalPredictOptionen(args) {
  const o = { modus: 'live' };
  let datei = null;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '-t') { datei = args[++i]; if (datei === undefined) return { fehler: 'usage' }; continue; }
    if (a === '-p' || a === '-f') {
      if (o.modus !== 'live' || args[i + 1] === undefined) return { fehler: 'usage' };
      o.modus = a[1]; o.sat = args[++i];
      const rest = [];
      while (args[i + 1] !== undefined && !/^-[a-z]/.test(args[i + 1])) rest.push(args[++i]);
      if (rest.length > (a === '-p' ? 1 : 2)) return { fehler: 'usage' };
      if (rest[0] !== undefined) { if (!/^\d{9,11}$/.test(rest[0])) return { fehler: "invalid start time '" + rest[0] + "' (expected Unix time)" }; o.start = Number(rest[0]); }
      if (rest[1] !== undefined) {
        const m = /^(\+)?(\d{1,11})(m)?$/.exec(rest[1]);
        if (!m || (!m[1] && m[2].length < 9)) return { fehler: "invalid end time '" + rest[1] + "' (expected Unix time or +n[m])" };
        o.ende = { relativ: !!m[1], wert: Number(m[2]), minuten: !!m[3] };
      }
      continue;
    }
    return { fehler: 'usage' };
  }
  // Ohne -t liest predict seine Datenbank ~/.predict/predict.tle (predict(1)); hier dieselben Bahndaten.
  if (datei !== null && datei !== TERMINAL_PPP_DATEI && datei !== TERMINAL_PREDICT_DB) return { fehler: datei + ': No such file or directory' };
  if (o.modus !== 'live') { o.satObj = kestrelSat(o.sat); if (!o.satObj) return { fehler: '"' + o.sat + '" not found in ' + (datei || TERMINAL_PREDICT_DB) }; }
  return o;
}
// Zeile wie predict -f/-p: Unix-Zeit, Datum/Zeit (UTC), Elevation, Azimut, Phase (0-255), Breite, Länge (West),
// Entfernung (km), Umlauf, Sichtbarkeit ('*' sonnig, ' ' im Erdschatten, '+' sichtbar: sonnig und am Ort dunkel).
function terminalPppZeile(sat, ms) {
  const datum = new Date(ms), l = kestrelLage(sat, ms);
  const tag = new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'UTC' }).format(datum);
  const mon = new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'UTC' }).format(datum);
  const iso = datum.toISOString();
  const q = kestrelQth(), so = kestrelSonne(ms);
  const nachtAmOrt = (function () {
    const S = satellite, r = Math.PI / 180, obs = { latitude: q.lat * r, longitude: q.lon * r, height: 0 };
    return S.ecfToLookAngles(obs, S.eciToEcf(so, S.gstime(datum))).elevation / r < -6;
  })();
  const sicht = !l.sonnig ? ' ' : l.el > 0 && nachtAmOrt ? '+' : '*';
  return [Math.floor(ms / 1000), tag, iso.slice(8, 10) + mon + iso.slice(2, 4), terminalPppZeit(ms), Math.round(l.el), Math.round(l.az) % 360,
    l.phase, Math.round(l.lat), Math.round(l.lonW) % 360, Math.round(l.range), l.umlauf, sicht].join('  ');
}
function terminalPppAnzeige() {
  const t = TERMINAL_ZUSTAND, chat = t.kanal?.ui === 'xmpp' ? t.kanal : null;
  const oben = $('profil-terminal-orbit'), unten = $('profil-terminal-chat'), shell = $('profil-terminal-ausgabe');
  if (!oben || !unten || !shell) return;
  const live = !!t.orbitLive;
  oben.hidden = !chat && !live;
  oben.classList.toggle('orbit-live', live);
  unten.hidden = !chat;
  if (!chat && !live) { shell.hidden = false; return; }
  shell.hidden = !!chat;
  const daten = chat ? chat.link.sat.name + '  [LOS ' + terminalSatRest(chat.link) + ']\n' + terminalPppZeile(chat.link.sat, Date.now()) +
    (chat.link.abgelaufen ? '\npppd: Modem hangup (NO CARRIER)' : '') : terminalPredictLive(Date.now());
  if (oben.textContent !== daten) oben.textContent = daten;
  if (!chat) return;
  const text = chat.log.join('\n');
  if (unten.textContent !== text) {
    unten.textContent = text;
    unten.scrollTop = unten.scrollHeight;
  }
}
// Interaktives predict: Verfolgung aller Satelliten der Datei mit nächstem Ereignis (eigene Darstellung).
function terminalPredictLive(ms) {
  const q = kestrelQth(), rest = function (x) { const sek = Math.max(0, Math.round((x - ms) / 1000)); return String(Math.floor(sek / 60)).padStart(2, '0') + 'm ' + String(sek % 60).padStart(2, '0') + 's'; };
  const kopf = 'PREDICT multi-satellite tracking · QTH ' + q.name + ' ' + Math.abs(q.lat).toFixed(2) + (q.lat >= 0 ? 'N ' : 'S ') +
    Math.abs(q.lon).toFixed(2) + (q.lon >= 0 ? 'E' : 'W') + ' · ' + terminalPppZeit(ms) + ' UTC';
  const zeilen = kestrelSats().map(function (sat) {
    const l = kestrelLage(sat, ms), u = kestrelUeberflug(sat, ms);
    const ereignis = !u ? '-' : l.el >= 0 ? 'LOS ' + terminalPppZeit(u.bis) + ' (' + rest(u.bis) + ')' : 'AOS ' + terminalPppZeit(u.von) + ' (' + rest(u.von) + ')';
    return sat.name.padEnd(12) + String(Math.round(l.az)).padStart(5) + String(Math.round(l.el)).padStart(6) + String(Math.round(l.range)).padStart(8) + '   ' + ereignis;
  });
  return [kopf, 'Satellite      Az    El   Range   Next event'].concat(zeilen).join('\n');
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
    const zeilen = ['pppd[' + TERMINAL_SITZUNG.pppd + ']: ' + grund, terminalPppEnde()];
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
// Ausgang eines Wahlversuchs. Für Tests festlegbar: TERMINAL_ZUSTAND.wahlVorgabe = 'ok' | 'busy' | 'nocarrier'.
// Sonst: kein Satellit über der Mindestelevation -> NO CARRIER; Gateway gelegentlich besetzt; tief am Horizont öfter kein Träger.
function terminalWahlausgang(el) {
  const vorgabe = TERMINAL_ZUSTAND.wahlVorgabe;
  if (vorgabe === 'ok' || vorgabe === 'busy' || vorgabe === 'nocarrier') return el >= KESTREL_MIN_EL || vorgabe !== 'ok' ? vorgabe : 'nocarrier';
  if (el < KESTREL_MIN_EL) return 'nocarrier';
  const w = crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
  if (w < 0.08) return 'busy';
  if (el < 15 && w < 0.38) return 'nocarrier';
  return 'ok';
}
// Signalstärke im Format von AT+CSQ (rssi 0-31, ber 99) nach Elevation mit leichter Schwankung.
function terminalCsq(el) {
  if (el < 0) return '+CSQ: 99,99';
  const w = crypto.getRandomValues(new Uint32Array(1))[0] % 5 - 2;
  return '+CSQ: ' + Math.max(0, Math.min(31, Math.round(4 + el * 0.45) + w)) + ',99';
}
function terminalPppEinwahl(vordergrund) {
  const t = TERMINAL_ZUSTAND, jetzt = Date.now(), S = TERMINAL_SITZUNG;
  const oben = kestrelSichtbar(jetzt)[0] || null;
  const ausgang = terminalWahlausgang(oben ? oben.el : -90);
  if (t.satLink) clearInterval(t.satLink.timer);
  let link = null;
  if (ausgang === 'ok') {
    const u = kestrelUeberflug(oben.sat, jetzt);
    link = { modus: 'ppp', sat: oben.sat, von: u.von, bis: u.bis, abgelaufen: false, timer: null };
    link.timer = setInterval(function () { if (terminalSatLinkAktiv(link)) terminalSatAnzeige(); }, 250);
  }
  t.satLink = link;
  const modem = { bereit: false, vordergrund, timer: null, link };
  t.modem = modem;
  terminalKanalPromptSync();
  terminalSatAnzeige();
  const c = 'chat[' + S.chat + ']: ', d = 'pppd[' + S.pppd + ']: ';
  const wahl = 'ATDT' + TERMINAL_PPP_WAHL;
  const schritte = [
    [0, [c + 'abort on (BUSY)', c + 'abort on (NO CARRIER)', c + 'send (ATZ^M)', c + 'expect (OK)']],
    [150, [c + 'ATZ^M^M', c + 'OK', c + ' -- got it', c + 'send (AT+CSQ^M)', c + 'expect (OK)']],
    [550, [c + 'AT+CSQ^M^M', c + terminalCsq(oben ? oben.el : -1) + '^M', c + '^M', c + 'OK', c + ' -- got it',
      c + 'send (' + wahl + '^M)', c + 'expect (CONNECT)']]
  ];
  if (ausgang === 'ok') schritte.push(
    [3250, [c + wahl + '^M^M', c + 'CONNECT 19200', c + ' -- got it']],
    [900, [d + 'Serial connection established.']],
    [750, [d + 'Using interface ppp0', d + 'Connect: ppp0 <--> /dev/ttyUSB0']],
    [1900, [d + 'local  IP address ' + S.lokal, d + 'remote IP address ' + S.gegenstelle]]);
  else schritte.push([ausgang === 'busy' ? 1800 : 6000, [c + wahl + '^M^M', c + (ausgang === 'busy' ? 'BUSY' : 'NO CARRIER'), d + 'Connect script failed']]);
  const schritt = function (i) {
    if (t.modem !== modem || (link && !terminalSatLinkAktiv(link))) return;
    const zeilen = schritte[i][1];
    zeilen.forEach(terminalPppLog);
    if (vordergrund) terminalAusgabe(zeilen);
    if (i + 1 < schritte.length) {
      modem.timer = setTimeout(() => schritt(i + 1), schritte[i + 1][0]);
      return;
    }
    modem.timer = null;
    if (!link) {
      // Wahl gescheitert: pppd endet mit 8 (connect script failed, pppd(8)).
      t.modem = null;
      terminalKanalPromptSync();
      terminalSatAnzeige();
      terminalVordergrundEnde(modem, 8);
      return;
    }
    modem.bereit = true;
    terminalKanalPromptSync();
    terminalVordergrundEnde(modem, 0);
  };
  const ende = vordergrund ? terminalVordergrund(modem) : 0;
  schritt(0);
  return ende;
}
async function terminalPppShell(befehl, arg, args = []) {
  const t = TERMINAL_ZUSTAND, link = t.satLink;
  if (befehl === 'predict') {
    // predict(1): -t <tlefile>, -p <sat> [start] (ein Überflug), -f <sat> [start [ende]] (Positionsdaten);
    // ohne -p/-f das interaktive Programm (hier die Verfolgung aller Satelliten, Ende mit Strg+C).
    const o = terminalPredictOptionen(args);
    if (o.fehler) { terminalAusgabe(o.fehler === 'usage' ? TERMINAL_PREDICT_USAGE : 'predict: ' + o.fehler); return o.fehler === 'usage' ? 2 : 1; }
    if (o.modus === 'live') {
      const orbit = { fertig: null, timer: setInterval(terminalPppAnzeige, 1000) };
      const ende = terminalVordergrund(orbit);
      t.orbitLive = orbit;
      terminalPppAnzeige();
      terminalKanalPromptSync();
      return ende;
    }
    const jetzt = Math.floor(Date.now() / 1000);
    if (o.modus === 'f') {
      const start = o.start ?? jetzt;
      if (o.ende === undefined) { terminalAusgabe(terminalPppZeile(o.satObj, start * 1000)); return 0; }
      const ende = o.ende.relativ ? start + o.ende.wert * (o.ende.minuten ? 60 : 1) : o.ende.wert;
      const schritt = o.ende.minuten ? 60 : 1;
      if (ende < start) return 0;
      const zeilen = [];
      for (let z = start; z <= ende && zeilen.length < TERMINAL_PREDICT_MAX; z += schritt) zeilen.push(terminalPppZeile(o.satObj, z * 1000));
      const gekuerzt = Math.floor((ende - start) / schritt) + 1 > zeilen.length;
      terminalAusgabe(gekuerzt ? zeilen.concat('predict: output limited to ' + TERMINAL_PREDICT_MAX + ' lines') : zeilen);
      return 0;
    }
    // -p: Überflug ab Startzeit in Minutenschritten vom Aufgang bis zum Untergang (Schrittweite eigene Näherung).
    const u = kestrelUeberflug(o.satObj, (o.start ?? jetzt) * 1000);
    if (!u) return 0;
    const zeiten = [];
    for (let z = u.von; z < u.bis; z += 60000) zeiten.push(z);
    zeiten.push(u.bis);
    terminalAusgabe(zeiten.map(function (ms) { return terminalPppZeile(o.satObj, ms); }));
    return 0;
  }
  if (befehl === 'pppd' || befehl === 'pon') {
    // pon <peer> entspricht pppd call <peer> (pon(1)); updetach hält die Shell bis zur fertigen Verbindung an.
    const m = befehl === 'pon' ? /^(\S+)$/.exec(arg) : /^call (\S+)( updetach)?$/.exec(arg);
    if (!m) { terminalAusgabe(befehl === 'pon' ? 'usage: pon <peer>' : 'usage: pppd call <peer> [updetach]'); return 2; }
    if (m[1] !== TERMINAL_PPP_PEER) { terminalAusgabe('pppd: unable to open /etc/ppp/peers/' + m[1] + ': No such file or directory'); return 2; }
    if (t.modem) { terminalAusgabe('pppd: ' + TERMINAL_PPP_PEER + ' already running'); return 1; }
    return terminalPppEinwahl(befehl === 'pppd' && !!m[2]);
  }
  if (befehl === 'tail' && /^-n \d{1,2} \/var\/log\/syslog$/.test(arg)) {
    terminalSyslog(Number(arg.split(' ')[1]));
    return 0;
  }
  if (befehl === 'poff') {
    // poff(1): ohne Argument beendet es die einzige laufende Verbindung; Meldungen und Codes wie im poff-Skript.
    const opt = args.find(function (x) { return /^-/.test(x); });
    if (opt) { terminalAusgabe('poff: Illegal option -- ' + opt.slice(1, 2) + '.'); return 1; }
    if (!t.modem) {
      terminalAusgabe(args.length ? "poff: I could not find a pppd process for provider '" + args[0] + "'. None stopped." : 'poff: No pppd is running.  None stopped.');
      return 1;
    }
    if (args.length && args[0] !== TERMINAL_PPP_PEER) { terminalAusgabe("poff: I could not find a pppd process for provider '" + args[0] + "'. None stopped."); return 1; }
    // Erfolg ist still; der Abbau steht im Syslog. Nur ein unerwarteter Abbruch meldet sich selbst in der Shell.
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
  if (orbit && typeof orbit === 'object') clearInterval(orbit.timer);
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
  if (t.orbitLive || terminalPppWaehltVorne()) { terminalKonsoleEscape(); return true; }
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
/* tmux (Ausschnitt, tmux(1)): Sitzung mit Statuszeile, split-window für predict oberhalb der Shell, Fokuswechsel mit
   Strg+B und Pfeiltaste, kill-pane auf das obere Fenster. Die Shell unten bleibt mit Eingabe, Verlauf, Tab und $? bedienbar. */
function terminalTmuxStatus() {
  const feld = $('profil-terminal-tmux'), t = TERMINAL_ZUSTAND;
  if (!feld) return;
  feld.hidden = !t.tmux;
  if (!t.tmux) return;
  const jetzt = new Date(), z = function (n) { return String(n).padStart(2, '0'); };
  const mon = new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'UTC' }).format(jetzt);
  feld.textContent = '[0] 0:' + (t.tmux.pane ? 'predict' : 'bash') + '*' + ' '.repeat(6) +
    '"terminal" ' + z(jetzt.getUTCHours()) + ':' + z(jetzt.getUTCMinutes()) + ' ' + z(jetzt.getUTCDate()) + '-' + mon + '-' + String(jetzt.getUTCFullYear()).slice(2);
}
function terminalTmuxPaneAnzeige() {
  const feld = $('profil-terminal-pane'), t = TERMINAL_ZUSTAND, pane = t.tmux?.pane;
  const input = $('profil-terminal-eingabe');
  if (feld) {
    feld.hidden = !pane;
    feld.classList.toggle('aktiv', !!pane && t.tmux.fokus === 'oben');
    if (pane) { const text = terminalPredictLive(Date.now()); if (feld.textContent !== text) feld.textContent = text; }
  }
  if (input) input.readOnly = !!pane && t.tmux.fokus === 'oben';
  $('profil-terminal-kern')?.classList.toggle('tmux-oben', !!pane && t.tmux?.fokus === 'oben');
  terminalTmuxStatus();
}
function terminalTmuxPaneSchliessen() {
  const t = TERMINAL_ZUSTAND, pane = t.tmux?.pane;
  if (!pane) return false;
  clearInterval(pane.timer);
  t.tmux.pane = null;
  t.tmux.fokus = 'unten';
  terminalTmuxPaneAnzeige();
  return true;
}
function terminalTmuxEnde() {
  const t = TERMINAL_ZUSTAND;
  if (!t.tmux) return;
  terminalTmuxPaneSchliessen();
  t.tmux = null;
  terminalTmuxPaneAnzeige();
}
function terminalTmuxFokus(richtung) {
  const t = TERMINAL_ZUSTAND;
  if (!t.tmux?.pane) return;
  t.tmux.fokus = richtung;
  terminalTabReset();
  terminalTmuxPaneAnzeige();
  // Der Tastaturfokus bleibt im Eingabefeld; unten ist es wieder beschreibbar.
  $('profil-terminal-eingabe')?.focus();
}
// Befehlsfolgen wie in tmux(1): "tmux new \; split-window -bd predict" (Trenner ";" als eigenes Wort).
function terminalTmux(args) {
  const teile = [[]];
  for (const a of args) { if (a === ';') teile.push([]); else teile.at(-1).push(a); }
  if (teile.length === 1) return terminalTmuxEinzeln(args);
  let code = 0;
  for (let i = 0; i < teile.length; i++) {
    if (!teile[i].length && i === 0) { code = terminalTmuxEinzeln([]); if (code !== 0) return code; continue; }
    if (!teile[i].length) continue;
    code = terminalTmuxEinzeln(teile[i]);
    if (code !== 0) return code;
  }
  return code;
}
function terminalTmuxEinzeln(args) {
  const t = TERMINAL_ZUSTAND, unter = args[0] === undefined ? 'new-session' : args[0];
  const sitzungsBefehle = ['new-session', 'new', 'split-window', 'splitw', 'kill-pane', 'killp', 'kill-server'];
  if (!sitzungsBefehle.includes(unter)) { terminalAusgabe('unknown command: ' + unter); return 1; }
  if (unter === 'new-session' || unter === 'new') {
    if (t.tmux) { terminalAusgabe('sessions should be nested with care, unset $TMUX to force'); return 1; }
    t.tmux = { pane: null, fokus: 'unten' };
    terminalTmuxPaneAnzeige();
    return 0;
  }
  if (!t.tmux) { terminalAusgabe('no server running on /tmp/tmux-0/default'); return 1; }
  if (unter === 'kill-server') { terminalTmuxEnde(); terminalAusgabe('[server exited]'); return 0; }
  if (unter === 'kill-pane' || unter === 'killp') {
    const i = args.indexOf('-t'), ziel = i >= 0 ? args[i + 1] : undefined;
    // Ohne Ziel trifft kill-pane das aktive Fenster, also die Shell; vereinfacht endet damit die Sitzung wie bei exit.
    if (ziel === undefined) { terminalTmuxEnde(); terminalAusgabe('[exited]'); return 0; }
    if (!['{up-of}', '{top}', '{last}'].includes(ziel)) { terminalAusgabe("can't find pane: " + ziel); return 1; }
    if (!terminalTmuxPaneSchliessen()) { terminalAusgabe("can't find pane: " + ziel); return 1; }
    return 0;
  }
  // split-window [-b] [-d] [-v] [Befehl ...]
  let i = 1, oben = false, bleiben = false;
  for (; i < args.length && /^-[bdvh]+$/.test(args[i]); i++) {
    if (args[i].includes('h')) { terminalAusgabe('split-window: -h is not supported in this terminal'); return 1; }
    oben = oben || args[i].includes('b'); bleiben = bleiben || args[i].includes('d');
  }
  if (i < args.length && /^-/.test(args[i])) { terminalAusgabe('split-window: unknown option -- ' + args[i].slice(1, 2)); return 1; }
  if (t.tmux.pane) { terminalAusgabe('create pane failed: pane too small'); return 1; }
  const befehl = args.slice(i);
  // Im oberen Fenster läuft nur die laufende Verfolgung von predict; andere Programme enden sofort und schließen ihr Fenster.
  const o = befehl[0] === 'predict' ? terminalPredictOptionen(befehl.slice(1)) : null;
  if (!o || o.fehler || o.modus !== 'live') return 0;
  t.tmux.pane = { timer: setInterval(terminalTmuxPaneAnzeige, 1000), oben };
  t.tmux.fokus = bleiben ? 'unten' : 'oben';
  terminalTmuxPaneAnzeige();
  return 0;
}
async function terminalEinzelbefehl(woerter) {
  const befehl = woerter[0], args = woerter.slice(1), arg = terminalArgText(args);
  const eintrag = terminalBefehlEintrag(befehl);
  if (!eintrag) { terminalAusgabe(befehl + ': command not found'); return 127; }
  return eintrag.aus(args, arg);
}
// Aufruffehler einfacher Befehle: usage-Zeile, Rückgabewert 2.
function terminalUsage(text) { terminalAusgabe('usage: ' + text); return 2; }
async function terminalDateiAusfuehren(befehl, arg) {
  const t = TERMINAL_ZUSTAND;
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
function terminalHilfe() {
  const zeilen = [[], [], []];
  TERMINAL_TABELLE.forEach(function (e) { (e.hilfe || []).forEach(function (h) { zeilen[h[0]].push(h); }); });
  return zeilen.map(function (z) { return z.sort(function (a, b) { return a[1] - b[1]; }).map(function (h) { return h[2]; }).join(' · '); })
    .concat('cmd1 && cmd2 · cmd1 || cmd2 · cmd1 ; cmd2 · exit status: echo $?');
}
/* Befehlstabelle: Name, Hilfe (Zeile, Position, Text), Ausführung und Art der Tab-Ergänzung an einer Stelle.
   Tab-Arten: pfad (Dateien und Ordner), fest (feste Argumentfolgen), optionen (Optionen ohne Leerzeichen danach),
   predict (Optionen und Satellitennamen), tail (-n mit Syslog, sonst pfad). Dynamische Kandidaten bleiben Funktionen. */
const TERMINAL_PPP = function (name) { return function (args, arg) { return terminalPppShell(name, arg, args); }; };
const TERMINAL_DATEI = function (name) { return function (args, arg) { return terminalDateiAusfuehren(name, arg); }; };
const TERMINAL_TABELLE = [
  { name: 'ls', hilfe: [[0, 0, 'ls [-a|-l|-la]']], tab: { art: 'pfad', optionen: ['-a', '-l', '-la'] }, aus: TERMINAL_DATEI('ls') },
  { name: 'cd', hilfe: [[0, 1, 'cd <ordner>']], tab: { art: 'pfad' }, aus: TERMINAL_DATEI('cd') },
  { name: 'cat', hilfe: [[0, 3, 'cat <datei>']], tab: { art: 'pfad' }, aus: TERMINAL_DATEI('cat') },
  { name: 'head', hilfe: [[0, 4, 'head <datei>']], tab: { art: 'pfad' }, aus: TERMINAL_DATEI('head') },
  { name: 'tail', hilfe: [[0, 5, 'tail <datei>']], tab: { art: 'tail' }, aus: async function (args, arg) {
    const ppp = await terminalPppShell('tail', arg, args);
    return ppp !== null ? ppp : terminalDateiAusfuehren('tail', arg);
  } },
  { name: 'wget', hilfe: [[0, 6, 'wget <datei>']], tab: { art: 'pfad' }, aus: TERMINAL_DATEI('wget') },
  { name: 'help', aus: function (args, arg) { if (arg) return terminalUsage('help'); terminalAusgabe(terminalHilfe()); return 0; } },
  { name: 'pwd', hilfe: [[0, 2, 'pwd']], aus: function (args, arg) { if (arg) return terminalUsage('pwd'); terminalAusgabe(terminalArbeitsverzeichnis()); return 0; } },
  { name: 'whoami', hilfe: [[0, 10, 'whoami']], aus: function (args, arg) { if (arg) return terminalUsage('whoami'); terminalAusgabe('root'); return 0; } },
  { name: 'uname', hilfe: [[0, 11, 'uname -a']], tab: { art: 'optionen', werte: ['-a'] },
    aus: function (args, arg) { if (arg !== '-a') return terminalUsage('uname -a'); terminalAusgabe(TERMINAL_UBUNTU); return 0; } },
  { name: 'date', hilfe: [[0, 12, 'date [+%s]']], aus: function (args, arg) {
    if (arg === '+%s') { terminalAusgabe(String(Math.floor(Date.now() / 1000))); return 0; }
    if (arg) return terminalUsage('date');
    terminalAusgabe(fmtZ(new Date())); return 0;
  } },
  { name: 'ping', hilfe: [[0, 13, 'ping relay']], tab: { art: 'optionen', werte: ['relay'] }, aus: async function (args, arg) {
    if (arg === 'relay') return await terminalPing() ? 0 : 1;
    terminalAusgabe(arg ? 'ping: ' + arg + ': Name or service not known' : 'ping: usage: ping <destination>');
    return arg ? 2 : 1;
  } },
  { name: 'clear', hilfe: [[0, 14, 'clear']], aus: function (args, arg) {
    const t = TERMINAL_ZUSTAND;
    if (arg) return terminalUsage('clear');
    t.version++; terminalTransferStop(); t.ausgabe = []; terminalAusgabe([]);
    return 0;
  } },
  { name: 'exit', hilfe: [[0, 15, 'exit']], aus: function (args, arg) {
    const t = TERMINAL_ZUSTAND;
    if (arg) return terminalUsage('exit');
    // In tmux beendet exit die Shell der Sitzung; vereinfacht endet damit die ganze Sitzung samt oberem Fenster.
    if (t.tmux && !t.kanal && !t.orbitLive) { terminalTmuxEnde(); terminalAusgabe('[exited]'); return 0; }
    t.kette = null;
    terminalKanalAbbruch();
    t.version++;
    terminalTransferStop();
    terminalKonsoleSchliessen();
    return 0;
  } },
  { name: 'predict', hilfe: [[1, 0, 'predict']], tab: { art: 'predict' }, aus: TERMINAL_PPP('predict') },
  { name: 'pon', hilfe: [[1, 1, 'pon kestrel']], tab: { art: 'fest', werte: ['kestrel'] }, aus: TERMINAL_PPP('pon') },
  { name: 'pppd', hilfe: [[1, 2, 'pppd call kestrel [updetach]']],
    tab: { art: 'fest', werte: ['call kestrel updetach'], kette: 'call kestrel && tail -n 12 /var/log/syslog' }, aus: TERMINAL_PPP('pppd') },
  { name: 'poff', hilfe: [[1, 3, 'poff [kestrel]']], tab: { art: 'fest', werte: ['kestrel'], kette: 'kestrel && tail -n 6 /var/log/syslog' }, aus: TERMINAL_PPP('poff') },
  { name: 'echo', hilfe: [[0, 7, 'echo']], aus: function (args) { terminalAusgabe(args.join(' ')); return 0; } },
  { name: 'true', hilfe: [[0, 8, 'true']], aus: function (args, arg) { return arg ? terminalUsage('true') : 0; } },
  { name: 'false', hilfe: [[0, 9, 'false']], aus: function (args, arg) { return arg ? terminalUsage('false') : 1; } },
  { name: 'wg-quick', hilfe: [[1, 4, 'wg-quick']], tab: { art: 'fest', werte: ['up wg-sat', 'down wg-sat'] }, aus: TERMINAL_PPP('wg-quick') },
  { name: 'wg', hilfe: [[1, 5, 'wg']], tab: { art: 'fest', werte: ['show wg-sat'] }, aus: TERMINAL_PPP('wg') },
  { name: 'profanity', hilfe: [[1, 6, 'profanity (/msg, /omemo, /sendfile, /quit)']], aus: TERMINAL_PPP('profanity') },
  { name: 'tmux', hilfe: [[2, 0, 'tmux'], [2, 1, 'tmux split-window -bd predict'], [2, 2, 'Ctrl+B ↑/↓ switch pane'], [2, 3, "tmux kill-pane -t '{up-of}'"]],
    tab: { art: 'fest', werte: ['split-window -bd predict', "kill-pane -t '{up-of}'", 'kill-server'] }, aus: function (args) { return terminalTmux(args); } }
];
const TERMINAL_TABELLE_INDEX = new Map(TERMINAL_TABELLE.map(function (e) { return [e.name, e]; }));
function terminalBefehlEintrag(name) { return TERMINAL_TABELLE_INDEX.get(name) || null; }
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
    void terminalPppChatMeldung(zeile, t.kanal);
    return;
  }
  if (t.kette) return;
  if (zeile !== 'clear') terminalAusgabe(terminalPrompt() + ' ' + zeile);
  const z = terminalZerlegen(zeile);
  if (z.fehler) { terminalAusgabe(z.fehler); t.status = 2; return; }
  void terminalKetteAusfuehren(z.folge);
}
const TERMINAL_BEFEHLE = TERMINAL_TABELLE.map(function (e) { return e.name; });
let terminalTabLauf = null, terminalTabAuswahl = null;
function terminalTabReset() {
  terminalTabLauf = terminalTabAuswahl = null;
  terminalTabListe();
}
/* Auswahlliste wie in zsh: Bei mehreren Treffern zeigt der erste Tab die Liste, ohne die Eingabe zu ändern.
   Jeder weitere Tab (Umschalt+Tab rückwärts) setzt den nächsten Eintrag ein; Enter übernimmt, Escape stellt den Entwurf wieder her. */
const TERMINAL_AUSWAHL_MAX = 60;
function terminalTabListe() {
  const feld = $('profil-terminal-auswahl'), a = terminalTabAuswahl;
  if (!feld) return;
  feld.hidden = !a;
  if (!a) { feld.replaceChildren(); return; }
  // Sichtbarer Ausschnitt wandert mit der Auswahl; gleich breite Spalten wie in zsh.
  const n = a.anzeige.length, sp = terminalTabSpalten();
  // Ausschnitt an Zeilen ausgerichtet, damit Spalten beim Blättern gleich bleiben.
  const roh = n <= TERMINAL_AUSWAHL_MAX || a.index < 0 ? 0 : Math.max(0, a.index - TERMINAL_AUSWAHL_MAX + 1);
  const start = Math.min(Math.ceil(roh / sp) * sp, Math.max(0, Math.ceil((n - TERMINAL_AUSWAHL_MAX) / sp) * sp));
  a.start = start;
  const breite = Math.max.apply(null, a.anzeige.map(function (x) { return x.length; })) + 2;
  feld.style.setProperty('--spalte', breite + 'ch');
  const eintraege = a.anzeige.slice(start, start + TERMINAL_AUSWAHL_MAX).map(function (name, i) {
    return h('span', { class: (name.endsWith('/') ? 'ordner' : '') + (start + i === a.index ? ' aktiv' : '') }, name);
  });
  if (start > 0) eintraege.unshift(h('span', { class: 'mehr' }, '… ' + start + ' before'));
  if (start + TERMINAL_AUSWAHL_MAX < n) eintraege.push(h('span', { class: 'mehr' }, '… ' + (n - start - TERMINAL_AUSWAHL_MAX) + ' more'));
  feld.replaceChildren.apply(feld, eintraege);
}
// Spalten der Liste aus dem Layout (für ↑/↓ zeilenweise).
function terminalTabSpalten() {
  const feld = $('profil-terminal-auswahl');
  const spalten = feld ? getComputedStyle(feld).gridTemplateColumns.split(' ').filter(Boolean).length : 1;
  return Math.max(1, spalten || 1);
}
// Eine Auswahlfunktion für Tab, Umschalt+Tab und Pfeiltasten: schritt = ±1 (Eintrag) oder ±Spalten (Zeile).
function terminalTabWaehlen(auswahl, schritt) {
  const n = auswahl.werte.length;
  if (auswahl.index < 0) auswahl.index = schritt > 0 ? 0 : n - 1;
  else if (Math.abs(schritt) === 1) auswahl.index = (auswahl.index + schritt + n) % n;
  else {
    const ziel = auswahl.index + schritt;
    auswahl.index = ziel < 0 || ziel >= n ? (ziel < 0 ? auswahl.index % Math.abs(schritt) + Math.floor((n - 1 - auswahl.index % Math.abs(schritt)) / Math.abs(schritt)) * Math.abs(schritt) : auswahl.index % Math.abs(schritt)) : ziel;
  }
  terminalEingabeSetzen(auswahl.input, auswahl.werte[auswahl.index]);
  terminalTabListe();
}
function terminalTabAnzeigename(x) {
  const ordner = x.endsWith('/'), rein = ordner ? x.slice(0, -1) : x;
  return rein.slice(rein.lastIndexOf('/') + 1) + (ordner ? '/' : '');
}
function terminalTabKontext(lauf) {
  const t = TERMINAL_ZUSTAND;
  return t.version === lauf.version && t.kanal === lauf.kanal && (!t.kanal || t.kanal.phase === 'eingabe') && t.tmux?.fokus !== 'oben' &&
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
    // Nur anzeigen; der Entwurf bleibt, bis ein weiterer Tab ausdrücklich einen Eintrag wählt.
    terminalTabAuswahl = { ...lauf, werte: treffer.map(x => kopf + format(x)), anzeige: treffer.map(terminalTabAnzeigename), index: -1, original: input.value };
    terminalTabListe();
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
  const tab = terminalBefehlEintrag(befehl)?.tab;
  if (!tab) return;
  if (tab.art === 'predict') {
    let rest = arg, kopf = 'predict ';
    const vorgabe = [['-t'], [TERMINAL_PPP_DATEI], ['-p'], kestrelSats().map(function (x) { return x.name; })];
    for (let i = 0; i < vorgabe.length; i++) {
      const liste = i === 2 && /^-f(?:\s|$)/.test(rest) ? ['-f'] : vorgabe[i];
      const wort = liste.find(function (w) { return rest.startsWith(w) && /^\s+/.test(rest.slice(w.length)); });
      if (!wort) { fertig(kopf, rest, liste, x => x + ' '); return; }
      const trennung = /^\s+/.exec(rest.slice(wort.length));
      kopf += wort + trennung[0];
      rest = rest.slice(wort.length + trennung[0].length);
    }
    return;
  }
  if (tab.art === 'fest') {
    fertig(befehl + ' ', arg, tab.kette && arg.includes('&&') ? [tab.kette] : tab.werte, x => x);
    return;
  }
  if (tab.art === 'tail' && /^-n(?:\s|$)/.test(arg)) {
    const m = /^(-n\s+\d{1,2}\s+)(.*)$/.exec(arg);
    if (m) fertig('tail ' + m[1], m[2], ['/var/log/syslog'], x => x);
    else fertig('tail ', arg, ['-n 12 /var/log/syslog'], x => x);
    return;
  }
  if (tab.art === 'optionen' || (tab.optionen && arg.startsWith('-'))) {
    fertig(befehl + ' ', arg, tab.werte || tab.optionen, function (x) { return x; });
    return;
  }
  const anfang = arg[0] === '"' || arg[0] === "'" ? arg[0] : '';
  const pfad = anfang ? arg.slice(1, arg.endsWith('/' + anfang) ? -1 : undefined) : arg;
  if ((anfang && pfad.includes(anfang)) || /[:\\]|[\u0000-\u001f\u007f]/.test(pfad)) return;
  const slash = pfad.lastIndexOf('/') + 1;
  const basis = pfad.slice(0, slash), prefix = pfad.slice(slash);
  const teile = terminalShellPfad(basis);
  if (!teile) return;
  const listing = !teile.length ? ['etc/', 'var/', TERMINAL_DB + (basis ? '/' : '')] : TERMINAL_TLE_DIRS.get('/' + teile.join('/'));
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
  const kommando = '/sendfile';
  {
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
  const m = /^\/sendfile\s+(.*)$/.exec(lauf.wert);
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
  const offen = terminalTabAuswahl;
  if (ev.key === 'Enter' && offen && !ev.isComposing) {
    // Bei sichtbarer Liste führt Enter nie aus: mit Auswahl übernimmt es den Eintrag, ohne Auswahl schließt es nur die Liste.
    ev.preventDefault(); terminalTabReset(); return;
  }
  const pfeile = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 'zeile', ArrowUp: '-zeile' };
  if (offen && pfeile[ev.key] !== undefined && !ev.shiftKey && !ev.ctrlKey && !ev.altKey && !ev.metaKey &&
      offen.input === ev.currentTarget && terminalTabKontext(offen) &&
      ev.currentTarget.value === (offen.index < 0 ? offen.original : offen.werte[offen.index])) {
    // Pfeiltasten nur bei offener Liste: ←/→ Eintrag für Eintrag, ↑/↓ zeilenweise; sonst bleibt der Verlauf zuständig.
    ev.preventDefault();
    const sp = terminalTabSpalten(), r = pfeile[ev.key];
    terminalTabWaehlen(offen, r === 'zeile' ? sp : r === '-zeile' ? -sp : r);
    return;
  }
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
  if (auswahl?.input === input && terminalTabKontext(auswahl) && bisher === (auswahl.index < 0 ? auswahl.original : auswahl.werte[auswahl.index])) {
    ev.preventDefault();
    terminalTabWaehlen(auswahl, ev.shiftKey ? -1 : 1);
    return;
  }
  if (ev.shiftKey) return;
  const t = TERMINAL_ZUSTAND;
  const m = /^(\S+)(?:\s+(.*))?$/.exec(bisher);
  if (t.orbitLive || terminalPppWaehltVorne()) return;
  if (t.kanal ? t.kanal.phase !== 'eingabe' ||
      !(/^\/(?:sendfile|msg|omemo)\s/.test(bisher) || (bisher.startsWith('/') && !/\s/.test(bisher))) :
      t.dateiLaeuft || !m || (m[2] === undefined ? !TERMINAL_BEFEHLE.some(x => x.startsWith(m[1])) :
      !terminalBefehlEintrag(m[1])?.tab)) return;
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
      h('pre', { id: 'profil-terminal-pane', class: 'mono', 'aria-label': 'tmux: predict', hidden: true,
        onpointerdown: function (ev) { ev.preventDefault(); terminalTmuxFokus('oben'); } }),
      h('pre', { id: 'profil-terminal-ausgabe', class: 'mono', role: 'log', 'aria-label': 'Terminalausgabe' }, t.ausgabe.join('\n')),
      h('pre', { id: 'profil-terminal-orbit', class: 'mono', 'aria-label': 'Überflug', hidden: true }),
      h('pre', { id: 'profil-terminal-chat', class: 'mono', role: 'log', 'aria-label': 'Chatverlauf', hidden: true }),
      h('pre', { id: 'profil-terminal-transfer', class: 'mono', hidden: !t.fortschritt }, t.fortschritt),
      h('form', { onsubmit: function (ev) {
        ev.preventDefault();
        terminalTabReset();
        const zeile = input.value.replace(/\n/g, ' ').trim();
        if (TERMINAL_ZUSTAND.tmux?.fokus === 'oben') return;
        if (zeile !== 'exit' && terminalBeschaeftigt()) return;
        terminalEingabeSetzen(input, '');
        if (zeile) { terminalVerlaufNehmen(zeile); terminalBefehl(zeile); }
      } }, h('label', { id: 'profil-terminal-prompt', for: input.id, class: 'mono' }, terminalPrompt()), input,
        h('button', { type: 'submit' }, 'Ausführen')),
      h('div', { id: 'profil-terminal-auswahl', class: 'mono', 'aria-label': 'Vervollständigung', hidden: true }),
      h('div', { id: 'profil-terminal-tmux', class: 'mono', 'aria-label': 'tmux-Statuszeile', hidden: true }));
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
  const t = TERMINAL_ZUSTAND, liste = terminalTabAuswahl;
  if (liste) {
    if (liste.input?.isConnected) terminalEingabeSetzen(liste.input, liste.original);
    terminalTabReset();
    return;
  }
  if (t.orbitLive) {
    terminalKetteAbbrechen();
    terminalOrbitEnde();
    terminalPppAnzeige();
    terminalKanalPromptSync();
  } else if (terminalPppWaehltVorne()) {
    terminalKetteAbbrechen(5);
    terminalPppModemAus('Terminating on signal 2');
  } else if (t.kanal) {
    terminalPppChatAus();
  } else if (t.vpos !== -1) {
    t.vpos = -1;
    const input = $('profil-terminal-eingabe');
    terminalEingabeSetzen(input, t.entwurf);
  } else terminalKonsoleSchliessen();
}
document.addEventListener('keydown', function (ev) {
  if (document.body.classList.contains('locked') || terminalKonsoleDialogOffen() || ev.isComposing) return;
  const tx = TERMINAL_ZUSTAND.tmux, imTerminal = TERMINAL_ZUSTAND.offen && $('profil-terminal')?.contains(ev.target);
  if (tx && imTerminal) {
    // Pfeiltasten sind wie in tmux wiederholbar (-r): nach dem Präfix innerhalb von 500 ms ohne neues Strg+B.
    const pfeil = !ev.ctrlKey && !ev.altKey && !ev.metaKey && (ev.key === 'ArrowUp' || ev.key === 'ArrowDown');
    if (pfeil && tx.wiederholBis && Date.now() < tx.wiederholBis) {
      ev.preventDefault(); ev.stopImmediatePropagation();
      terminalTmuxFokus(ev.key === 'ArrowUp' ? 'oben' : 'unten');
      tx.wiederholBis = Date.now() + 500;
      return;
    }
    if (tx.praefix && !['Control', 'Shift', 'Alt', 'Meta'].includes(ev.key)) {
      tx.praefix = false; tx.wiederholBis = 0; ev.preventDefault(); ev.stopImmediatePropagation();
      if (ev.key === 'ArrowUp' || ev.key === 'ArrowDown') {
        terminalTmuxFokus(ev.key === 'ArrowUp' ? 'oben' : 'unten');
        if (!ev.ctrlKey) tx.wiederholBis = Date.now() + 500;
      } else if (ev.key === 'o') terminalTmuxFokus(tx.fokus === 'oben' ? 'unten' : 'oben');
      return;
    }
    if (tx.wiederholBis && !['Control', 'Shift', 'Alt', 'Meta'].includes(ev.key)) tx.wiederholBis = 0;
    if (ev.ctrlKey && !ev.altKey && !ev.metaKey && ev.key.toLowerCase() === 'b') { tx.praefix = true; ev.preventDefault(); ev.stopImmediatePropagation(); return; }
    if (tx.fokus === 'oben' && ev.ctrlKey && ev.key.toLowerCase() === 'c' && !ev.repeat) {
      // Strg+C beendet predict im oberen Fenster; tmux schließt das Fenster, der Fokus geht zurück zur Shell.
      ev.preventDefault(); ev.stopImmediatePropagation(); terminalTmuxPaneSchliessen(); return;
    }
    // Ist oben aktiv, gehören alle übrigen Tasten predict: kein Verlauf, keine Ergänzung, keine Eingabe unten. Escape bleibt frei.
    if (tx.fokus === 'oben' && ev.key !== 'Escape') { ev.preventDefault(); ev.stopImmediatePropagation(); return; }
  }
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
  TERMINAL_ZUSTAND.kette = null; terminalKanalAbbruch(); terminalTmuxEnde(); terminalVerlaufLeeren();
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
