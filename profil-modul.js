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
const TERMINAL_BRUECKE = /^#db=(\d{1,5})\.([\w-]{43})$/.exec(window.location.hash);
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
async function terminalBruecke(op, parts, hidden, exportDaten) {
  if (!TERMINAL_BRUECKE) return { error: 'Lokale Datenbank nicht verbunden. Starte START_TERMINAL.bat.' };
  const controller = new AbortController();
  const t = setTimeout(function () { controller.abort(); }, op === 'disconnect' ? 1500 : 7500);
  try {
    const r = await fetch('http://127.0.0.1:' + TERMINAL_BRUECKE[1] + '/db', {
      method: 'POST', cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer', redirect: 'error',
      headers: { 'Content-Type': 'application/json', 'X-Shadow-Token': TERMINAL_BRUECKE[2] },
      body: JSON.stringify(op === 'export-txt' ? {
        op: op, folder: exportDaten.ordner, kind: exportDaten.art, id: exportDaten.id, text: exportDaten.text
      } : { op: op, parts: parts, hidden: hidden }), signal: controller.signal
    });
    if (!r.ok) return { error: r.status === 403 ? 'Permission denied' : 'Lokale Datenbank nicht erreichbar' };
    return await r.json();
  } catch (ex) {
    return { error: 'Lokale Datenbank nicht erreichbar' };
  } finally { clearTimeout(t); }
}
function terminalSitzungTrennen() {
  terminalKanalAbbruch();
  if (!TERMINAL_BRUECKE) return;
  TERMINAL_ZUSTAND.version++;
  terminalTransferStop();
  TERMINAL_ZUSTAND.ort = null;
  return terminalBruecke('disconnect');
}
function terminalPrompt() {
  const kanal = TERMINAL_ZUSTAND.kanal;
  if (kanal) return kanal.phase === 'eingabe' ? 'you >' : '…';
  const ort = TERMINAL_ZUSTAND.ort;
  return 'root@terminal:' + (ort ? '/' + [TERMINAL_DB].concat(ort).join('/') : '~') + '#';
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
async function terminalTransfer(name, bytes, weiter) {
  const t = TERMINAL_ZUSTAND, start = performance.now();
  // Animation for a local copy, not a measurement of a remote network.
  const dauer = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 :
    Math.min(6500, 550 + bytes / (1.5 * 1024));
  do {
    if (!weiter()) return null;
    const zeit = performance.now() - start;
    if (zeit >= dauer) return terminalTransferZeile(name, bytes, 1, zeit, 0);
    t.fortschritt = terminalTransferZeile(name, bytes, zeit / dauer, zeit, dauer - zeit);
    terminalTransferAktualisieren();
    await new Promise(function (ok) { setTimeout(ok, Math.min(120, dauer - zeit)); });
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
  if (befehl === 'ls' && arg && !lsLang) { terminalAusgabe('ls: unterstützt werden ls, ls -l und ls -la'); return; }
  const name = terminalName(arg);
  if (name === null) { terminalAusgabe('Ungültiger Dateiname'); return; }
  if (!t.ort) {
    if (befehl === 'ls') { terminalAusgabe(TERMINAL_DB + '/'); return; }
    if (befehl !== 'cd' || name !== TERMINAL_DB) { terminalAusgabe('Zuerst: cd "' + TERMINAL_DB + '"'); return; }
  }
  if (!name && ['cat', 'head', 'tail', 'wget'].includes(befehl)) { terminalAusgabe('Dateiname fehlt'); return; }
  const pfad = t.ort ? terminalPfad(befehl === 'ls' ? '' : name) : [];
  if (!pfad) { terminalAusgabe('Permission denied'); return; }
  const wgetStart = befehl === 'wget' ? new Date() : null;
  const antwort = await terminalBruecke(befehl, pfad, arg === '-la' || arg === '-al');
  if (t.version !== version) return;
  if (antwort.error) { terminalAusgabe(antwort.error); return; }
  if (befehl === 'cd') {
    t.ort = pfad;
    const label = $('profil-terminal-prompt');
    if (label) label.textContent = terminalPrompt();
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

const TERMINAL_ZUSTAND = { offen: false, ausgabe: [], prueft: false, dateiLaeuft: false, version: 0, ort: null, kanal: null, fortschritt: '' };
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
  if (!t.kanal) return;
  const kanal = t.kanal;
  t.ausgabe = kanal.vorher;
  t.kanal = null;
  if (kanal.pauseBeenden) kanal.pauseBeenden();
  terminalTransferStop();
  const eingabe = $('profil-terminal-eingabe');
  if (eingabe) eingabe.value = '';
  terminalKanalPromptSync();
  terminalAusgabe([]);
}
const TERMINAL_KANAL_TEMPO = { aufbau: 950, antwort: 15000, vorAbbau: 2000, abbau: 650 };
function terminalKanalPause(kanal, ms) {
  return new Promise(function (ok) {
    const fertig = function () {
      clearTimeout(timer);
      kanal.pauseBeenden = null;
      ok(TERMINAL_ZUSTAND.kanal === kanal);
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
async function terminalKanalStart() {
  const t = TERMINAL_ZUSTAND;
  if (t.dateiLaeuft || t.prueft) { terminalAusgabe('Eine Anfrage läuft bereits'); return; }
  const kanal = { phase: 'start', vorher: t.ausgabe.slice() };
  t.kanal = kanal;
  terminalKanalPromptSync();
  const hex = '0123456789abcdef', abc = 'abcdefghijklmnopqrstuvwxyz';
  const knoten = 'NODE-' + String(terminalKanalZufall(10000)).padStart(4, '0') + '-' + terminalKanalZeichen(abc.toUpperCase(), 1);
  const sitzung = [4, 4, 4].map(function (n) { return terminalKanalZeichen(hex, n); }).join('-');
  const kontakt = terminalKanalZeichen(abc, 14);
  kanal.knoten = knoten;
  kanal.sitzung = sitzung;
  if (!await terminalKanalFolge(kanal, TERMINAL_KANAL_START, TERMINAL_KANAL_TEMPO.aufbau)) return;
  terminalAusgabe([
    'Connected to:  ' + knoten + '  (session: ' + sitzung + ')',
    'Contact:       "' + kontakt + '"',
    'Channel:       end-to-end · self-destruct after close',
    TERMINAL_KANAL_LINIE
  ]);
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
  const t = TERMINAL_ZUSTAND, start = new Date(), aktiv = function () { return t.kanal === kanal; };
  kanal.phase = 'transfer';
  terminalKanalPromptSync();
  const antwort = await terminalBruecke('send', pfad);
  if (!aktiv()) return;
  if (antwort.error) {
    terminalAusgabe('send: ' + antwort.error);
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
  if (zeile === '/close' || zeile === 'clear') { terminalKanalAbbruch(); return; }
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

function terminalBefehl(zeile) {
  const m = /^(\S+)(?:\s+(.*))?$/.exec(zeile);
  const befehl = m[1], arg = m[2] || '', t = TERMINAL_ZUSTAND;
  if (befehl === 'exit' && !arg) {
    terminalKanalAbbruch();
    t.version++;
    terminalTransferStop();
    t.offen = false;
    const panel = $('profil-terminal');
    if (panel) {
      panel.open = false;
      panel.querySelector('summary').focus();
    }
    return;
  }
  if (t.kanal) { void terminalKanalMeldung(zeile, t.kanal); return; }
  if (befehl === 'clear' && !arg) { t.version++; terminalTransferStop(); t.ausgabe = []; terminalAusgabe([]); return; }
  terminalAusgabe(terminalPrompt() + ' ' + zeile);
  if (befehl === 'help' && !arg) terminalAusgabe('ls [-l|-la] · cd <ordner> · pwd · cat <datei> · head <datei> · tail <datei> · wget <datei> · send <datei> (im Kanal) · whoami · uname -a · date · ping relay · clear · exit · ' + TERMINAL_KANAL_BEFEHL);
  else if (befehl === 'pwd' && !arg) terminalAusgabe(t.ort ? '/' + [TERMINAL_DB].concat(t.ort).join('/') : '/');
  else if (befehl === 'whoami' && !arg) terminalAusgabe('root');
  else if (befehl === 'uname' && arg === '-a') terminalAusgabe(TERMINAL_UBUNTU);
  else if (befehl === 'date' && !arg) terminalAusgabe(fmtZ(new Date()));
  else if (befehl === 'ping') {
    if (arg === 'relay') terminalPing();
    else terminalAusgabe('ping: verfügbares Ziel ist relay');
  } else if (befehl === 'send') terminalAusgabe('send ist im geöffneten Secure Channel verfügbar.');
  else if (befehl === 'secure-channel') {
    if (arg === '--connect --onion --ephemeral') void terminalKanalStart();
    else terminalAusgabe(TERMINAL_KANAL_BEFEHL);
  } else if (TERMINAL_DATEIBEFEHLE.includes(befehl)) {
    if (t.dateiLaeuft) { terminalAusgabe('Datenbankanfrage läuft bereits'); return; }
    t.dateiLaeuft = true;
    const version = t.version;
    terminalDateiBefehl(befehl, arg, version).catch(function () {
      if (t.version === version) terminalAusgabe('Dateioperation fehlgeschlagen');
    }).finally(function () { t.dateiLaeuft = false; });
  } else terminalAusgabe('command not found');
}
const TERMINAL_DATEIBEFEHLE = ['ls', 'cd', 'cat', 'head', 'tail', 'wget'];
const TERMINAL_BEFEHLE = TERMINAL_DATEIBEFEHLE.concat(['help', 'pwd', 'whoami', 'uname', 'date', 'ping', 'clear', 'exit', 'secure-channel', 'send']);
function terminalTabKandidaten(input, bisher, version, kopf, prefix, kandidaten, format) {
  if (!input.isConnected || input.value !== bisher || TERMINAL_ZUSTAND.version !== version ||
      document.activeElement !== input || input.selectionStart !== bisher.length || input.selectionEnd !== bisher.length) return;
  const treffer = kandidaten.filter(function (x) { return x.toLowerCase().startsWith(prefix.toLowerCase()); });
  if (treffer.length === 1) { input.value = kopf + format(treffer[0]); return; }
  if (treffer.length < 2) return;
  let gemeinsam = treffer[0];
  while (!treffer.every(function (x) { return x.startsWith(gemeinsam); })) gemeinsam = gemeinsam.slice(0, -1);
  if (gemeinsam.length > prefix.length) input.value = kopf + gemeinsam;
  else terminalAusgabe(treffer.join('  '));
}
async function terminalTab(input, bisher, m) {
  const t = TERMINAL_ZUSTAND, version = t.version;
  const befehl = m[1], arg = m[2];
  const fertig = function (kopf, prefix, kandidaten, format) {
    terminalTabKandidaten(input, bisher, version, kopf, prefix, kandidaten, format);
  };
  if (arg === undefined) {
    fertig('', befehl, TERMINAL_BEFEHLE, function (x) { return x + ' '; });
    return;
  }
  if (befehl === 'secure-channel') {
    fertig('secure-channel ', arg, ['--connect --onion --ephemeral'], function (x) { return x; });
    return;
  }
  if (befehl === 'ping' || befehl === 'uname' || befehl === 'ls') {
    fertig(befehl + ' ', arg, befehl === 'ping' ? ['relay'] : befehl === 'uname' ? ['-a'] : ['-l', '-la'], function (x) { return x; });
    return;
  }
  const anfang = arg[0] === '"' || arg[0] === "'" ? arg[0] : '';
  const pfad = anfang ? arg.slice(1, arg.endsWith('/' + anfang) ? -1 : undefined) : arg;
  if ((anfang && pfad.includes(anfang)) || /^[\\/]|[:\\]|[\u0000-\u001f\u007f]/.test(pfad)) return;
  if (!t.ort) {
    if (befehl === 'cd') fertig('cd ' + anfang, pfad, [TERMINAL_DB], function (x) { return x + anfang; });
    return;
  }
  const ort = t.ort, slash = pfad.lastIndexOf('/') + 1;
  const basis = pfad.slice(0, slash), prefix = pfad.slice(slash);
  const teile = terminalPfad(basis);
  if (!teile || !TERMINAL_BRUECKE) return;
  const antwort = await terminalBruecke('ls', teile, prefix.startsWith('.'));
  if (t.ort !== ort || !antwort.entries) return;
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
  if (!pfad || (pfad.startsWith('/') && !pfad.startsWith(prefix))) {
    terminalTabKandidaten(input, bisher, version, kopf, pfad, [prefix], format);
    return;
  }
  if (!TERMINAL_BRUECKE) return;
  const basis = pfad.slice(0, pfad.lastIndexOf('/') + 1);
  const parent = basis.replace(/\/$/, '');
  const teile = basis === prefix ? [] : basis ? terminalArchivDateipfad('"' + parent + '"') : TERMINAL_ZUSTAND.ort;
  if (!teile) return;
  const antwort = await terminalBruecke('ls', teile, pfad.slice(basis.length).startsWith('.'));
  if (TERMINAL_ZUSTAND.kanal !== kanal || kanal.phase !== 'eingabe' || !antwort.entries) return;
  terminalTabKandidaten(input, bisher, version, kopf, pfad, antwort.entries.map(function (x) {
    return basis + x.name + (x.dir ? '/' : '');
  }), format);
}
function terminalTabTaste(ev) {
  if (TERMINAL_ZUSTAND.kanal) {
    if (ev.key === 'Escape') { ev.preventDefault(); terminalKanalAbbruch(); return; }
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
    !['cd', 'cat', 'head', 'tail', 'wget', 'ping', 'uname', 'ls', 'secure-channel'].includes(m[1]))) return;
  ev.preventDefault();
  terminalTab(input, bisher, m).catch(function () {});
}

function profilTerminalPanel() {
  const t = TERMINAL_ZUSTAND;
  const input = h('input', { id: 'profil-terminal-eingabe', type: 'text', 'aria-label': 'Terminalbefehl',
    maxlength: 1024, autocomplete: 'off', spellcheck: 'false', onkeydown: terminalTabTaste });
  return h('details', { id: 'profil-terminal', class: 'panel profil-terminal', open: t.offen,
    ontoggle: function (ev) {
      if (!ev.currentTarget.isConnected) return;
      t.offen = ev.currentTarget.open;
      if (!t.offen) terminalKanalAbbruch();
    } },
    h('summary', null, 'Terminal'),
    h('div', { class: 'profil-terminal-kern' },
      h('pre', { id: 'profil-terminal-ausgabe', class: 'mono', role: 'log', 'aria-label': 'Terminalausgabe' }, t.ausgabe.join('\n')),
      h('pre', { id: 'profil-terminal-transfer', class: 'mono', hidden: !t.fortschritt }, t.fortschritt),
      h('form', { onsubmit: function (ev) {
        ev.preventDefault();
        const zeile = input.value.trim();
        input.value = '';
        if (zeile) terminalBefehl(zeile);
      } }, h('label', { id: 'profil-terminal-prompt', for: input.id, class: 'mono' }, terminalPrompt()), input,
        h('button', { type: 'submit' }, 'Ausführen'))));
}

// Locking the app drops the temporary dialogue even when the window stays open.
new MutationObserver(function () {
  if (document.body.classList.contains('locked')) terminalKanalAbbruch();
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
    profilTerminalPanel(),
    [STATE.agent.notizen, STATE.agent.einschraenkungen, VIEW.draft['ta-notizen'], VIEW.draft['ta-einschr']].some(Boolean) ?
      h('details', { class: 'panel profil-alt-notizen' }, h('summary', null, 'Bisherige Notizen'),
        h('div', { class: 'cols pad' },
          panel('Notizen', null, h('div', { class: 'pad' }, autosaveFeld('ta-notizen', 'notizen', 'Notizen'))),
          panel('Operative Einschränkungen', null, h('div', { class: 'pad' }, autosaveFeld('ta-einschr', 'einschraenkungen', 'Operative Einschränkungen'))))) : null,
    karteBereinigenPanel());
}
