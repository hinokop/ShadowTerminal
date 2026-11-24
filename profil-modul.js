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
    if (TERMINAL_ZUSTAND.kanal) terminalPppChatLog(TERMINAL_ZUSTAND.kanal, 'Tab: ' + antwort.error, terminalPppAktiv(TERMINAL_ZUSTAND.kanal));
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
  const ort = TERMINAL_ZUSTAND.ort;
  return terminalPfadAufloesen(arg, ort ? [TERMINAL_DB].concat(ort) : (TERMINAL_ZUSTAND.virtuellerOrt || []));
}
/* Reine Pfadauflösung: Segmentliste ab der Wurzel aus Eingabe und ausdrücklich übergebenem Arbeitsverzeichnis (Segmente);
   liest keinen globalen Zustand. null bei unzulässigen Zeichen. */
function terminalPfadAufloesen(arg, cwdSegmente) {
  if (/[:\\]|[\u0000-\u001f\u007f]/.test(arg)) return null;
  const absolut = arg.startsWith('/') || arg === '~' || arg.startsWith('~/');
  const out = absolut ? [] : cwdSegmente.slice();
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
    'persist', 'holdoff ' + TERMINAL_PPP_HOLDOFF / 1000, 'maxfail 0',
    'connect "/usr/sbin/chat -v -f /etc/chatscripts/kestrel"'].join('\n'); }],
  ['/etc/chatscripts/kestrel', function () { return ['ABORT BUSY', "ABORT 'NO CARRIER'", "'' ATZ", 'OK AT+CSQ', 'TIMEOUT ' + TERMINAL_PPP_DAUER.timeout / 1000, 'OK ATDT' + TERMINAL_PPP_WAHL, "CONNECT ''"].join('\n'); }]
]);
function terminalArbeitsverzeichnis() {
  const t = TERMINAL_ZUSTAND;
  return '/' + (t.ort ? [TERMINAL_DB].concat(t.ort) : t.virtuellerOrt || []).join('/');
}
/* Einheitliche Zugriffsprüfung für archivierte Kartenobjekte in der Terminal-Oberfläche (Pin, Zone, Sichtung).
   Die lokale Python-Brücke selbst besitzt keine Profilberechtigungen; direkter Dateisystemzugriff außerhalb dieser
   Oberfläche bleibt davon unabhängig. Geprüft wird nach dem Dateinamen in jedem Ordner, ohne Beachtung der Großschreibung
   (Windows), ohne Endpunkte und Leerzeichen am Ende und ohne Datenstrom nach ':'. Zusätzlich gilt der echte Name, den die
   Brücke meldet (Kurznamen). Eine nachträgliche Sperre entfernt gelesene Texte wieder (terminalSchutzBereinigen). */
const TERMINAL_ARCHIV_MUSTER = [
  { art: 'pin', re: /^lageblatt-(PIN-\d{3,15})(?:-v\d{1,2})?\.txt$/i },
  { art: 'zone', re: /^zone-(ZO-\d{3,15})(?:-v\d{1,2})?\.txt$/i },
  { art: 'sichtung', re: /^sichtung-([POL]-\d{4,15})-(SI-\d{3,15})(?:-v\d{1,2})?\.txt$/i }
];
function terminalArchivNameZiel(name) {
  if (typeof name !== 'string') return null;
  const n = name.split(':')[0].replace(/[. ]+$/, '');
  for (const m of TERMINAL_ARCHIV_MUSTER) {
    const t = m.re.exec(n);
    if (!t) continue;
    return m.art === 'sichtung' ? { art: 'sichtung', id: (t[1] + '-' + t[2]).toUpperCase(), dossier: t[1].toUpperCase() }
      : { art: m.art, id: t[1].toUpperCase() };
  }
  return null;
}
/* Zuordnungen einer Dateianfrage: getippter Name und, nach der Antwort, der echte Name der Brücke (zuletzt der maßgebliche) */
function terminalArchivZiele(op, parts, antwort) {
  if (!['cat', 'head', 'tail', 'wget', 'send'].includes(op) || !Array.isArray(parts) || !parts.length) return [];
  return [parts[parts.length - 1], antwort && antwort.file].map(terminalArchivNameZiel).filter(Boolean);
}
/* Sichtbarkeit eines Namens im Archiv: nur anwendungsseitig gesperrte Export-Objekte (Pin, Zone, Sichtung) sind verborgen;
   gewöhnliche Dateien unterliegen keiner Anwendungsregel (normales Unix-Verhalten). */
function terminalArchivNameSichtbar(name) {
  return terminalArchivSichtbarkeit()(name);
}
/* Momentaufnahme der aktuellen Sperren, einmal je Listung berechnet (statt je Eintrag neu); gleiche Entscheidung wie terminalArchivZielGesperrt. */
function terminalArchivSichtbarkeit() {
  const objekte = new Set(terminalVaultObjekte().filter(function (o) { return o.gesperrt; }).map(function (o) { return o.art + ':' + o.id; }));
  const dossiers = new Set((typeof PROFIL !== 'undefined' && PROFIL && PROFIL.gesperrt) || []);
  return function (name) {
    const z = terminalArchivNameZiel(name);
    if (!z) return true;
    return z.art === 'sichtung' ? !dossiers.has(z.dossier) : !objekte.has(z.art + ':' + z.id);
  };
}
/* Eine Zeile (Verlauf, Vorschlag), die einen Namen gesperrter Archivobjekte enthält. Geprüft wird der Rohtext UND jedes Wort des Shell-Zerlegers
   (terminalZerlegen: Quotes, Maskierungen), jeweils durch Teilstring-Suche; so zählen auch "cat Name; echo", cat "Name"; ..., && und || sowie Pfade.
   Schlägt die Zerlegung fehl, bleibt die Suche im Rohtext (im Zweifel verdächtig, nie automatisch wieder vorgeschlagen). Bewusst großzügig:
   ein gewöhnlicher Dateiname, der einen Archivnamen als Teilstring enthält, gilt ebenfalls als verdächtig. */
const TERMINAL_ARCHIV_NAME_SUCHE = /(?:lageblatt-PIN-\d{3,15}(?:-v\d{1,2})?|zone-ZO-\d{3,15}(?:-v\d{1,2})?|sichtung-[POL]-\d{4,15}-SI-\d{3,15}(?:-v\d{1,2})?)\.txt/gi;
function terminalZeileMitGesperrtemName(zeile, sicht) {
  sicht = sicht || terminalArchivSichtbarkeit();
  const roh = String(zeile), texte = [roh], z = terminalZerlegen(roh);
  if (!z.fehler) z.folge.forEach(function (f) { f.woerter.forEach(function (w) { texte.push(w); }); });
  return texte.some(function (text) { return (text.match(TERMINAL_ARCHIV_NAME_SUCHE) || []).some(function (m) { return !sicht(m); }); });
}
/* Sperrstand als Zeichenkette; ändert er sich (Sperren, Entsperren, Verknüpfung von Pin oder Zone), verfallen alle abgeleiteten Zustände
   mit Archivnamen: Listen-Zwischenspeicher, Auswahlliste, Ergänzungsvorschlag und Verlaufseinträge mit gesperrten Namen. */
const TERMINAL_VORSCHLAG_LS = new Map();
let terminalSperrstandLetzter = null;
function terminalSperrstandPruefen() {
  if (typeof PROFIL === 'undefined' || !PROFIL) return;
  const stand = terminalVaultObjekte().filter(function (o) { return o.gesperrt; }).map(function (o) { return o.art + ':' + o.id; }).sort().join(',') +
    '|' + (PROFIL.gesperrt || []).slice().sort().join(',');
  if (stand === terminalSperrstandLetzter) return;
  terminalSperrstandLetzter = stand;
  /* erst die Datenquellen verwerfen, dann Auswahlliste und Vorschlags-Overlay neu zeichnen (sonst bliebe ein bereits angezeigter Name stehen) */
  TERMINAL_VORSCHLAG_LS.clear();
  const t = TERMINAL_ZUSTAND;
  t.vorschlagErgaenzung = null;
  const sicht = terminalArchivSichtbarkeit();
  t.verlauf = t.verlauf.filter(function (zeile) { return !terminalZeileMitGesperrtemName(zeile, sicht); });
  t.vpos = -1;
  terminalTabReset();
  terminalVorschlagAnzeige();
}
function terminalArchivZielGesperrt(z) {
  if (!z) return false;
  if (z.art === 'sichtung') return (PROFIL.gesperrt || []).includes(z.dossier);
  const objekt = terminalVaultObjekte().find(function (p) { return p.id === z.id && p.art === z.art; });
  return !!objekt && objekt.gesperrt;
}
async function terminalBruecke(op, parts, hidden, exportDaten) {
  if (op === 'ls' && Array.isArray(parts)) {
    /* Variante B (Plan 9.3): Namen gesperrter Archivobjekte erscheinen in keiner Listung; alle Verbraucher (ls, Tab, strenge
       cd-Prüfung) laufen über diesen Zweig. Die Prüfung erfolgt nach dem Abruf, damit eine währenddessen gesetzte Sperre gilt. */
    const liste = await terminalBrueckeLsAlle(parts, hidden);
    if (liste.error || !Array.isArray(liste.entries)) return liste;
    const sicht = terminalArchivSichtbarkeit();
    return Object.assign({}, liste, { entries: liste.entries.filter(function (e) { return sicht(e && e.name); }) });
  }
  /* Vor UND nach dem asynchronen Lesezugriff prüfen: die Sperre könnte
     während einer laufenden Anfrage aktiviert worden sein. */
  if (terminalArchivZiele(op, parts).some(terminalArchivZielGesperrt)) return { error: 'Permission denied' };
  const antwort = await terminalBrueckeSenden(op === 'export-txt' ? {
    op: op, folder: exportDaten.ordner, kind: exportDaten.art, id: exportDaten.id, text: exportDaten.text,
    last: exportDaten.last || undefined
  } : { op: op, parts: parts, hidden: hidden });
  if (terminalArchivZiele(op, parts, antwort).some(terminalArchivZielGesperrt)) return { error: 'Permission denied' };
  return antwort;
}
/* ls über alle Seiten der Brücke (je 500 Einträge, nach Namen sortiert): kein stilles Abschneiden. Eine fehlerhafte
   Seitenfolge ergibt einen Fehler statt einer unvollständigen Liste. */
async function terminalBrueckeLsAlle(parts, hidden) {
  const alle = [];
  let offset = 0;
  for (let seite = 0; seite < 1000; seite++) {
    const antwort = await terminalBrueckeSenden({ op: 'ls', parts: parts, hidden: hidden, offset: offset, limit: 500 });
    if (antwort.error || !Array.isArray(antwort.entries)) return antwort.error ? antwort : { error: TERMINAL_BRUECKE_FEHLER };
    for (const e of antwort.entries) alle.push(e);
    if (antwort.next === null || antwort.next === undefined) return Object.assign({}, antwort, { entries: alle, next: null });
    if (!Number.isSafeInteger(antwort.next) || antwort.next <= offset || antwort.next > 10000000 || antwort.entries.length === 0)
      return { error: TERMINAL_BRUECKE_FEHLER };
    offset = antwort.next;
  }
  return { error: TERMINAL_BRUECKE_FEHLER };
}
/* Gelesene geschützte Archivtexte stehen im Scrollback mit ihrer Zuordnung (ausgabeMeta, gleiche Positionen wie ausgabe).
   Wird die Zuordnung gesperrt, auch durch eine spätere Verknüpfung mit einem gesperrten Dossier, verschwinden sie samt
   Koordinaten und Notizen, gleich über welchen Befehl sie gelesen wurden; übrige Ausgaben bleiben. */
function terminalSchutzBereinigen() {
  const t = TERMINAL_ZUSTAND;
  if (!t || !t.ausgabe || !t.ausgabe.length || !PROFIL) return false;
  const meta = t.ausgabeMeta || [], ausgabe = [], neueMeta = [];
  let geaendert = false;
  const sicht = terminalArchivSichtbarkeit();
  t.ausgabe.forEach(function (zeile, i) {
    let ziel = meta[i] || null;
    if (ziel && ziel.liste) {       /* Archivlistung (ls): nur Zeilen mit nun gesperrtem Namen entfernen, übrige Einträge bleiben */
      const alle = String(zeile).split('\n'), rein = alle.filter(function (l) { return sicht(terminalListenName(l)); });
      if (rein.length === alle.length) { ausgabe.push(zeile); neueMeta.push(ziel); return; }
      geaendert = true;
      if (rein.length) { ausgabe.push(rein.join('\n')); neueMeta.push(ziel); }
      return;
    }
    const m = !ziel && /^VAULT :: RECORD ACCESS\nOBJECT\s+((PIN|ZO)-\d{3,15})\b/.exec(zeile);
    if (m) ziel = { art: m[2] === 'PIN' ? 'pin' : 'zone', id: m[1] };
    if (ziel && terminalArchivZielGesperrt(ziel)) { geaendert = true; return; }
    ausgabe.push(zeile); neueMeta.push(meta[i] || null);
  });
  if (!geaendert) return false;
  t.ausgabe = ausgabe; t.ausgabeMeta = neueMeta;
  return true;
}
/* Nach jeder Zustandsänderung (index.html, dispatch) */
function terminalSchutzPruefen() { terminalSperrstandPruefen(); if (terminalSchutzBereinigen()) terminalAusgabe([]); }
/* Name am Zeilenende einer ls-Ausgabe (kurz: ganze Zeile; lang: letztes Feld nach zwei oder mehr Leerzeichen), ohne Ordnerzeichen und
   ohne Pfad: Dateioperanden erscheinen so, wie sie eingegeben wurden (absolut, relativ, mit ./ oder ../), geprüft wird der Basisname.
   Fehlerzeilen (ls: cannot access '<Pfad>': ...) enthalten keinen Basisnamen am Ende und werden nicht als Listeneintrag gewertet;
   dort steht nur ein selbst eingegebener Name, den ls auch bei Permission denied nennt. */
function terminalListenName(zeile) { return String(zeile).split(/\s{2,}/).pop().replace(/\/$/, '').split('/').pop(); }
async function terminalBrueckeSenden(daten) {
  const bruecke = terminalBrueckenAdresse();
  if (!bruecke) return { error: TERMINAL_BRUECKE_FEHLT };
  const controller = new AbortController();
  const t = setTimeout(function () { controller.abort(); }, daten.op === 'disconnect' ? 1500 : 7500);
  try {
    const r = await fetch('http://127.0.0.1:' + bruecke[1] + '/db', {
      method: 'POST', cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer', redirect: 'error',
      headers: { 'Content-Type': 'application/json', 'X-Shadow-Token': bruecke[2] },
      body: JSON.stringify(daten), signal: controller.signal
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
  if (TERMINAL_ZUSTAND.sudo) terminalKetteAbbrechen(130); /* keine offene Kennwortabfrage nach Sitzungsende */
  terminalKanalAbbruch();
  terminalNmapEnde(130);
  /* Shell-Zustand der Sitzung (Arbeitsverzeichnis, vorheriges Verzeichnis) endet mit der Sitzung, auch ohne verbundene Archivbrücke */
  TERMINAL_ZUSTAND.ort = null;
  TERMINAL_ZUSTAND.virtuellerOrt = null;
  TERMINAL_ZUSTAND.oldpwd = null;
  if (!terminalBrueckenAdresse()) return;
  TERMINAL_ZUSTAND.version++;
  terminalTransferStop();
  return terminalBruecke('disconnect');
}
/* Angemeldeter Benutzer der Shell: ein gewöhnlicher Benutzer (kein root), damit sudo ein Kennwort verlangen kann; sudo fragt
   root nie (plugins/sudoers/check.c). Prompt wie bash unter Ubuntu, PS1 '\u@\h:\w\$': '$' für Nicht-root. */
const TERMINAL_BENUTZER = 'raizo', TERMINAL_UID = 1000;     /* erster Benutzer unter Ubuntu; tmux legt seinen Socket unter /tmp/tmux-<uid> an (tmux.c) */
function terminalPrompt() {
  if (TERMINAL_ZUSTAND.sudo) return TERMINAL_ZUSTAND.sudo.pruefen ? '' : terminalSudoPrompt();
  if (TERMINAL_ZUSTAND.orbitLive) return 'predict · Ctrl+C';
  if (terminalPppWaehltVorne()) return '';
  if (TERMINAL_ZUSTAND.kette && !TERMINAL_ZUSTAND.kanal) return '';
  const kanal = TERMINAL_ZUSTAND.kanal;
  if (kanal) return '>';
  return TERMINAL_BENUTZER + '@terminal:' + terminalArbeitsverzeichnis() + '$';
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
  const name = terminalName(arg);
  if (name === null) { terminalAusgabe(befehl + ': unterminated quote'); return 1; }
  if (!name && ['cat', 'head', 'tail', 'wget'].includes(befehl)) { terminalAusgabe(befehl + ': missing file operand'); return 1; }
  const virtuell = terminalShellPfad(name);
  const nichtGefunden = befehl + ': ' + name + ': No such file or directory';
  if (!virtuell) { terminalAusgabe(befehl + ': ' + name + ': Permission denied'); return 1; }
  const voll = '/' + virtuell.join('/');
  const listing = !virtuell.length ? ['etc/', 'var/', TERMINAL_DB + '/'] : TERMINAL_TLE_DIRS.get(voll);
  if (listing) {
    terminalAusgabe(befehl + ': ' + name + ': Is a directory');
    return 1;
  }
  if (voll === '/var/log/syslog' || TERMINAL_VIRT_DATEIEN.has(voll)) {
    if (befehl === 'wget') { terminalAusgabe('wget: ' + name + ': unsupported source'); return 1; }
    if (voll === '/var/log/syslog') terminalSyslog(befehl === 'cat' ? 60 : 10);
    else {
      const zeilen = TERMINAL_VIRT_DATEIEN.get(voll)().split('\n');
      terminalAusgabe(befehl === 'head' ? zeilen.slice(0, 10) : befehl === 'tail' ? zeilen.slice(-10) : zeilen);
    }
    return 0;
  }
  if (virtuell[0] !== TERMINAL_DB) { terminalAusgabe(nichtGefunden); return 1; }
  const pfad = virtuell.slice(1);
  const wgetStart = befehl === 'wget' ? new Date() : null;
  const antwort = await terminalBruecke(befehl, pfad, false);
  if (t.version !== version) return 1;
  if (antwort.error) {
    terminalAusgabe(antwort.error === 'Datei oder Ordner nicht gefunden' ? nichtGefunden : befehl + ': ' + antwort.error);
    return 1;
  }
  if (befehl === 'wget') {
    const daten = Uint8Array.from(atob(antwort.data), function (c) { return c.charCodeAt(0); });
    const bytes = daten.byteLength;
    terminalAusgabe(terminalWgetProtokoll(antwort, pfad, wgetStart, bytes));
    const fertig = await terminalTransfer(antwort.name, bytes, function () { return t.version === version; });
    if (t.version !== version) return 1;
    terminalTransferStop();
    terminalDownload(antwort, daten);
    terminalAusgabe([fertig, 'Empfangen [' + bytes + '/' + bytes + '] · Download gestartet']);
  } else terminalAusgabe(antwort.text, terminalArchivZiele(befehl, pfad, antwort).at(-1) || null);
  return 0;
}

/* Phase 6a-0: gemeinsame Dateisystem-Schnittstelle (Entwurf: docs/phase6a-plan-pwd-cd-ls.md, Abschnitt 9).
   Alle Operationen sind asynchron, weil die Archivbrücke asynchron ist. Zwei Adapter hinter einer Wurzel "/":
   der virtuelle Baum (TERMINAL_TLE_DIRS, TERMINAL_VIRT_DATEIEN, Wurzel) und die Archivbrücke (TERMINAL_DB, nur lesend).
   Fehler sind Objekte { fehler: 'ENOENT' | 'EROFS' | 'ENOSYS' | <Text der Brücke> }, keine Ausnahmen.
   Bewusst noch NICHT auf dieser Schnittstelle: cat, head, tail, wget (terminalDateiBefehl) und die Tab-Ergänzung. */
const TERMINAL_WURZEL_LISTE = ['etc/', 'var/', TERMINAL_DB + '/'];
const TERMINAL_FS = {
  /* Sichtbarkeitsregel gesperrter Archivobjekte (Variante B, Plan 9.3): der Name ist ebenfalls geschützt. Die Regel gilt zentral in
     terminalBruecke('ls') und hier als zweite Schranke (readdir); Befehle prüfen nicht selbst. */
  sichtbar: function (seg) { return seg[0] !== TERMINAL_DB || terminalArchivNameSichtbar(seg[seg.length - 1]); },
  /* Zeichenkette -> Segmentliste ab der Wurzel; null bei unzulässigen Zeichen. Mit opt.cwd (Zeichenkette, z. B. '/etc/ppp') relativ zu
     diesem Arbeitsverzeichnis, ohne den globalen Terminalzustand zu lesen; ohne opt.cwd relativ zum Zustand der einen Shell (Altverhalten). */
  resolve: async function (arg, opt) {
    return opt && typeof opt.cwd === 'string' ? terminalPfadAufloesen(arg, opt.cwd.split('/').filter(Boolean)) : terminalShellPfad(arg);
  },
  /* Art des Ziels. Die Brücke kennt kein stat: ohne opt.pruefen bleibt die Art im Archiv unbekannt (typ null); mit opt.pruefen wird sie
     streng über das Elternverzeichnis festgestellt (siehe unten) und der Zugang über die Brückenoperation "cd" geprüft. */
  stat: async function (seg, opt) {
    const voll = '/' + seg.join('/');
    if (!seg.length || TERMINAL_TLE_DIRS.has(voll)) return { adapter: 'virtuell', typ: 'dir' };
    if (voll === '/var/log/syslog' || TERMINAL_VIRT_DATEIEN.has(voll)) return { adapter: 'virtuell', typ: 'file' };
    if (seg[0] !== TERMINAL_DB) return { fehler: 'ENOENT' };
    if (opt && opt.pruefen) {
      let archivEintrag = null;
      /* Streng wie unter Unix: der Name muss im Elternverzeichnis genau so (Groß-/Kleinschreibung, kein Kurzname) geführt werden;
         dabei zeigt sich auch, ob das Ziel eine Datei ist. Danach die Brückenoperation "cd" als Zugangsprüfung (Schutz, Sperren). */
      if (seg.length > 1) {
        const eltern = await TERMINAL_FS.readdir(seg.slice(0, -1), { versteckt: true });
        if (eltern.fehler) return { adapter: 'archiv', fehler: eltern.fehler === 'Datei oder Ordner nicht gefunden' ? 'ENOENT' : eltern.fehler };
        const eintrag = eltern.eintraege.find(function (e) { return e.name === seg[seg.length - 1]; });
        if (!eintrag) return { adapter: 'archiv', fehler: 'ENOENT' };
        if (!eintrag.dir) return { adapter: 'archiv', typ: 'file', eintrag: eintrag };
        archivEintrag = eintrag;
      }
      const antwort = await terminalBruecke('cd', seg.slice(1), false);
      if (antwort.error) return { adapter: 'archiv', fehler: antwort.error === 'Datei oder Ordner nicht gefunden' ? 'ENOENT' : antwort.error };
      return { adapter: 'archiv', typ: 'dir', eintrag: archivEintrag };
    }
    return { adapter: 'archiv', typ: null };
  },
  /* Einträge { name, dir [, bytes, mtime] } eines Verzeichnisses; opt.versteckt nur im Archiv wirksam */
  readdir: async function (seg, opt) {
    const voll = '/' + seg.join('/');
    if (!seg.length || TERMINAL_TLE_DIRS.has(voll)) {
      const liste = !seg.length ? TERMINAL_WURZEL_LISTE : TERMINAL_TLE_DIRS.get(voll);
      return { eintraege: liste.map(function (x) { return x.endsWith('/') ? { name: x.slice(0, -1), dir: true } : { name: x, dir: false }; }) };
    }
    if (seg[0] !== TERMINAL_DB) return { fehler: 'ENOENT' };
    const antwort = await terminalBruecke('ls', seg.slice(1), !!(opt && opt.versteckt));
    if (antwort.error) return { fehler: antwort.error };
    return { eintraege: antwort.entries.filter(function (e) { return TERMINAL_FS.sichtbar(seg.concat(e.name)); }) };
  },
  /* Textinhalt. Noch kein Verbraucher in 6a-0; die Syslog-Datei wird derzeit direkt vom Befehl erzeugt (ENOSYS). */
  readFile: async function (seg) {
    const voll = '/' + seg.join('/');
    if (TERMINAL_VIRT_DATEIEN.has(voll)) return { text: TERMINAL_VIRT_DATEIEN.get(voll)() };
    if (!seg.length || TERMINAL_TLE_DIRS.has(voll)) return { fehler: 'EISDIR' };
    if (voll === '/var/log/syslog') return { fehler: 'ENOSYS' };
    if (seg[0] !== TERMINAL_DB) return { fehler: 'ENOENT' };
    const antwort = await terminalBruecke('cat', seg.slice(1), false);
    return antwort.error ? { fehler: antwort.error } : { text: antwort.text };
  },
  /* Nur entworfen: beide Adapter sind schreibgeschützt. */
  writeFile: async function () { return { fehler: 'EROFS' }; }
};
function terminalFsFehlerText(befehl, name, fehler) {
  if (fehler === 'ENOENT' || fehler === 'Datei oder Ordner nicht gefunden') return befehl + ': ' + name + ': No such file or directory';
  return befehl + ': ' + fehler;
}
/* Befehlskontext und Ergebnis: eine Befehlsfunktion erhält { args, arg, cwd, env, fs } und liefert
   { code, stdout: [...], stderr: [...], cwd?: { ort, virtuellerOrt } }. Der Aufrufer setzt das Arbeitsverzeichnis und schreibt die
   Ausgabe. Keine Pipes, Ströme oder Prozesse. */
async function terminalBefehlLauf(fn, args, arg, version) {
  const t = TERMINAL_ZUSTAND;
  const env = t.oldpwd ? { OLDPWD: t.oldpwd } : {};
  const cwdVorher = terminalArbeitsverzeichnis();
  const res = await fn({ args: args, arg: arg || '', cwd: cwdVorher, env: env, fs: TERMINAL_FS });
  if (t.version !== version) return 1;
  if (res.cwd) { t.oldpwd = cwdVorher; t.ort = res.cwd.ort; t.virtuellerOrt = res.cwd.virtuellerOrt; terminalKanalPromptSync(); }
  let zeilen = res.stderrZuerst ? (res.stderr || []).concat(res.stdout || []) : (res.stdout || []).concat(res.stderr || []);
  if (res.archivListe) {   /* letzte Prüfung gegen die aktuellen Sperren unmittelbar vor der Ausgabe */
    const sicht = terminalArchivSichtbarkeit();
    zeilen = zeilen.map(function (z) { return String(z).split('\n').filter(function (l) { return sicht(terminalListenName(l)); }).join('\n'); })
      .filter(function (z) { return z !== ''; });
  }
  if (zeilen.length) terminalAusgabe(zeilen, res.archivListe ? { liste: true } : null);
  return res.code;
}
function terminalBefehlFehler(text) { return { code: 1, stdout: [], stderr: [text] }; }
/* pwd als Bash-Builtin (Referenz bash 5.2.21): Optionen -L und -P (ohne symbolische Links gleichwertig, auch kombiniert und wiederholt),
   "--" beendet die Optionen, der erste Nicht-Optionswert beendet die Optionsauswertung, Operanden werden ignoriert. Eine ungültige Option
   (auch "--x", "-L-": gemeldet als "--") ergibt "bash: pwd: -x: invalid option" und die Usage-Zeile, Rückgabewert 2. "--help" gibt den
   Hilfetext aus (stdout), Rückgabewert 2; Optionen werden der Reihe nach ausgewertet. Meldungen mit dem Präfix "bash:" wie im interaktiven Bash. */
const TERMINAL_PWD_HILFE = ['pwd: pwd [-LP]', '    Print the name of the current working directory.', '    ', '    Options:',
  '      -L\tprint the value of $PWD if it names the current working', '    \t\tdirectory', '      -P\tprint the physical directory, without any symbolic links',
  '    ', "    By default, `pwd' behaves as if `-L' were specified.", '    ', '    Exit Status:',
  '    Returns 0 unless an invalid option is given or the current directory', '    cannot be read.'];
function terminalBefehlPwd(ctx) {
  for (const a of ctx.args) {
    if (a === '--') break;
    if (a === '--help') return { code: 2, stdout: [TERMINAL_PWD_HILFE.join('\n')], stderr: [] };
    if (a.length < 2 || a[0] !== '-') break;
    for (const c of Array.from(a).slice(1)) {
      if (c !== 'L' && c !== 'P') return { code: 2, stdout: [], stderr: ['bash: pwd: -' + c + ': invalid option', 'pwd: usage: pwd [-LP]'] };
    }
  }
  return { code: 0, stdout: [ctx.cwd], stderr: [] };
}
/* cd als Bash-Builtin (Referenz bash 5.2.21, lokal gemessen). Optionen -L, -P, -e werden angenommen (ohne Wirkung: keine symbolischen Links),
   "--" beendet die Optionen, der erste Nicht-Optionswert beendet die Optionsauswertung; "-@" gilt wie in der Referenz als ungültig.
   Mehr als ein Operand: "bash: cd: too many arguments" (1). Ohne Operand: Heimatverzeichnis "/" (dokumentierte Abweichung). "cd -" wechselt nach
   OLDPWD und gibt den Pfad aus ("bash: cd: OLDPWD not set", wenn noch kein Wechsel stattfand). "cd ''" bleibt im Verzeichnis (0). Jeder Wechsel
   setzt OLDPWD, auch "cd ."; ein Fehler ändert nichts. Pfadkomponenten werden der Reihe nach geprüft (Datei: Not a directory, fehlend: No such
   file or directory), Archivnamen streng mit Groß-/Kleinschreibung. Nicht nachgebildet: CDPATH, cdable_vars, $HOME-Variable. */
const TERMINAL_CD_HILFE = [
  'cd: cd [-L|[-P [-e]] [-@]] [dir]',
  '    Change the shell working directory.',
  '    ',
  '    Change the current directory to DIR.  The default DIR is the value of the',
  '    HOME shell variable. If DIR is "-", it is converted to $OLDPWD.',
  '    ',
  '    The variable CDPATH defines the search path for the directory containing',
  '    DIR.  Alternative directory names in CDPATH are separated by a colon (:).',
  '    A null directory name is the same as the current directory.  If DIR begins',
  '    with a slash (/), then CDPATH is not used.',
  '    ',
  '    If the directory is not found, and the shell option `cdable_vars\' is set,',
  '    the word is assumed to be  a variable name.  If that variable has a value,',
  '    its value is used for DIR.',
  '    ',
  '    Options:',
  '      -L\tforce symbolic links to be followed: resolve symbolic',
  '    \t\tlinks in DIR after processing instances of `..\'',
  '      -P\tuse the physical directory structure without following',
  '    \t\tsymbolic links: resolve symbolic links in DIR before',
  '    \t\tprocessing instances of `..\'',
  '      -e\tif the -P option is supplied, and the current working',
  '    \t\tdirectory cannot be determined successfully, exit with',
  '    \t\ta non-zero status',
  '      -@\ton systems that support it, present a file with extended',
  '    \t\tattributes as a directory containing the file attributes',
  '    ',
  '    The default is to follow symbolic links, as if `-L\' were specified.',
  '    `..\' is processed by removing the immediately previous pathname component',
  '    back to a slash or the beginning of DIR.',
  '    ',
  '    Exit Status:',
  '    Returns 0 if the directory is changed, and if $PWD is set successfully when',
  '    -P is used; non-zero otherwise.'];
const TERMINAL_CD_USAGE = 'cd: usage: cd [-L|[-P [-e]] [-@]] [dir]';
function terminalCdCwd(seg) {
  return seg.length && seg[0] === TERMINAL_DB ? { ort: seg.slice(1), virtuellerOrt: null } : { ort: null, virtuellerOrt: seg };
}
/* Zielpfad komponentenweise auflösen und prüfen; liefert { seg } oder { fehler } */
async function terminalCdAufloesen(ctx, ziel) {
  const roh = await ctx.fs.resolve(ziel, { cwd: ctx.cwd });
  if (!roh) return { fehler: 'Permission denied' };
  const absolut = ziel.startsWith('/') || ziel === '~' || ziel.startsWith('~/');
  let seg = absolut ? [] : await ctx.fs.resolve('', { cwd: ctx.cwd }), geprueft = null;
  for (const name of (ziel === '~' || ziel.startsWith('~/') ? ziel.slice(1) : ziel).split('/')) {
    if (!name || name === '.') continue;
    if (name === '..') { seg = seg.slice(0, -1); continue; }
    seg = seg.concat(name);
    const st = await ctx.fs.stat(seg, { pruefen: true });
    if (st.fehler) return { fehler: st.fehler };
    if (st.typ !== 'dir') return { fehler: 'ENOTDIR' };
    geprueft = seg.join('/');
  }
  if (geprueft !== seg.join('/')) {
    const st = await ctx.fs.stat(seg, { pruefen: true });
    if (st.fehler) return { fehler: st.fehler };
    if (st.typ !== 'dir') return { fehler: 'ENOTDIR' };
  }
  return { seg: seg };
}
async function terminalBefehlCd(ctx) {
  const args = ctx.args;
  let i = 0;
  for (; i < args.length; i++) {
    const a = args[i];
    if (a === '--') { i++; break; }
    if (a === '--help') return { code: 2, stdout: [TERMINAL_CD_HILFE.join('\n')], stderr: [] };
    if (a.length < 2 || a[0] !== '-') break;
    for (const c of Array.from(a).slice(1)) {
      if (!'LPe'.includes(c)) return { code: 2, stdout: [], stderr: ['bash: cd: -' + c + ': invalid option', TERMINAL_CD_USAGE] };
    }
  }
  const operanden = args.slice(i);
  if (operanden.length > 1) return terminalBefehlFehler('bash: cd: too many arguments');
  let ziel = operanden.length ? operanden[0] : '/', ausgeben = false;
  if (ziel === '-') {
    if (!ctx.env.OLDPWD) return terminalBefehlFehler('bash: cd: OLDPWD not set');
    ziel = ctx.env.OLDPWD; ausgeben = true;
  }
  if (ziel === '') return { code: 0, stdout: [], stderr: [], cwd: terminalCdCwd(await ctx.fs.resolve('', { cwd: ctx.cwd })) };
  const r = await terminalCdAufloesen(ctx, ziel);
  if (r.fehler) {
    const f = r.fehler === 'Datei oder Ordner nicht gefunden' ? 'ENOENT' : r.fehler;
    if (f === 'ENOENT') return terminalBefehlFehler('bash: cd: ' + ziel + ': No such file or directory');
    if (f === 'ENOTDIR') return terminalBefehlFehler('bash: cd: ' + ziel + ': Not a directory');
    if (f === 'Permission denied') return terminalBefehlFehler('bash: cd: ' + ziel + ': Permission denied');
    return terminalBefehlFehler('bash: cd: ' + f);
  }
  return { code: 0, stdout: ausgeben ? ['/' + r.seg.join('/')] : [], stderr: [], cwd: terminalCdCwd(r.seg) };
}
/* ls (Phase 6a-3, Referenz GNU coreutils 9.4, Ausgabe ohne TTY): Optionen und Operanden wie getopt_long mit Umstellung (Optionen auch hinter
   Operanden, "--" beendet sie, "-" ist Operand), zusammengesetzte Kurzoptionen, eindeutig abgekürzte Langoptionen. Umgesetzt: -a, -A, -d, -F,
   -h, -l, -1 und --all, --almost-all, --directory, --classify[=WHEN], --human-readable, --help. Alle übrigen Optionen von ls 9.4 sind für
   die Namenserkennung (Mehrdeutigkeit) bekannt, werden aber wie unbekannte Optionen gemeldet (Entscheidung des Plans: Originalmeldung statt
   Sonderausgabe). Die Reihenfolge der Einträge bleibt die der Quelle (Sortierung, "." und ".." bei -a und das Langformat folgen in 6a-4). */
const TERMINAL_LS_LANG = [['all', 'no'], ['almost-all', 'no'], ['author', 'no'], ['block-size', 'req'], ['classify', 'opt'], ['color', 'opt'],
  ['context', 'no'], ['directory', 'no'], ['dired', 'no'], ['dereference-command-line', 'no'], ['dereference-command-line-symlink-to-dir', 'no'],
  ['dereference', 'no'], ['escape', 'no'], ['full-time', 'no'], ['file-type', 'no'], ['format', 'req'], ['group-directories-first', 'no'],
  ['human-readable', 'no'], ['hide-control-chars', 'no'], ['hide', 'req'], ['hyperlink', 'opt'], ['help', 'no'], ['inode', 'no'],
  ['ignore-backups', 'no'], ['ignore', 'req'], ['indicator-style', 'req'], ['kibibytes', 'no'], ['literal', 'no'], ['numeric-uid-gid', 'no'],
  ['no-group', 'no'], ['quote-name', 'no'], ['quoting-style', 'req'], ['reverse', 'no'], ['recursive', 'no'], ['size', 'no'], ['si', 'no'],
  ['show-control-chars', 'no'], ['sort', 'req'], ['tabsize', 'req'], ['time', 'req'], ['time-style', 'req'], ['version', 'no'], ['width', 'req'],
  ['zero', 'no']];   /* Reihenfolge wie im Programm (bestimmt die Aufzählung bei Mehrdeutigkeit), gegen ls 9.4 für alle Präfixe geprüft */
const TERMINAL_LS_UMGESETZT = { 'all': 'a', 'almost-all': 'A', 'directory': 'd', 'classify': 'F', 'human-readable': 'h', 'help': 'help' };
const TERMINAL_LS_KURZ = 'aAdFhl1';
const TERMINAL_LS_TRY = "Try 'ls --help' for more information.";
const TERMINAL_LS_HILFE = ['Usage: ls [OPTION]... [FILE]...', 'List information about the FILEs (the current directory by default).', '',
  'Mandatory arguments to long options are mandatory for short options too.',
  '  -a, --all                  do not ignore entries starting with .',
  '  -A, --almost-all           do not list implied . and ..',
  '  -d, --directory            list directories themselves, not their contents',
  '  -F, --classify[=WHEN]      append indicator (one of */=>@|) to entries WHEN',
  '  -h, --human-readable       with -l and -s, print sizes like 1K 234M 2G etc.',
  '  -l                         use a long listing format',
  '  -1                         list one file per line',
  '      --help        display this help and exit', '',
  "The WHEN argument defaults to 'always' and can also be 'auto' or 'never'.", '',
  'Exit status:', ' 0  if OK,', ' 1  if minor problems (e.g., cannot access subdirectory),',
  ' 2  if serious trouble (e.g., cannot access command-line argument).', '',
  'GNU coreutils online help: <https://www.gnu.org/software/coreutils/>'];
/* Typografische Anführungszeichen der gnulib-Meldungen (nur argmatch-Meldungen; getopt-Meldungen und "cannot access" bleiben bei ASCII) */
const TERMINAL_LS_ZITAT_LINKS = '\u2018', TERMINAL_LS_ZITAT_RECHTS = '\u2019';
/* Name in Meldungen wie bei ls (Stil "shell": in einfachen Anführungszeichen, ein Apostroph als '\'' ) */
function terminalLsQuote(name) { return "'" + String(name).replace(/'/g, "'\\''") + "'"; }
/* -h: Größe wie ls (Basis 1024, aufgerundet, eine Nachkommastelle unter 10), gegen ls 9.4 gemessen */
function terminalLsGroesse(b) {
  if (b < 1024) return String(b);
  for (let k = 1, q = 1024; k <= 8; k++, q *= 1024) {
    const c = Math.ceil(b / q);
    if (c >= 1024 && k < 8) continue;
    const zehntel = Math.ceil(b * 10 / q);
    return (zehntel < 100 ? Math.floor(zehntel / 10) + '.' + (zehntel % 10) : String(c)) + 'KMGTPEZY'[k - 1];
  }
}
/* Auswertung der Argumente: { fehler: { code, zeilen } } | { hilfe: true } | { opt, operanden } */
function terminalLsOptionen(args) {
  const opt = { alle: null, d: false, F: false, h: false, format: '1' }, operanden = [];
  const fehler = function (zeilen, code) { return { fehler: { code: code || 2, zeilen: zeilen.concat([TERMINAL_LS_TRY]) } }; };
  const setze = function (c) {
    if (c === 'a' || c === 'A') opt.alle = c; else if (c === 'd') opt.d = true; else if (c === 'F') opt.F = true;
    else if (c === 'h') opt.h = true; else if (c === 'l') opt.format = 'l'; else if (c === '1' && opt.format !== 'l') opt.format = '1';   /* ls: -1 ersetzt -l nicht (gemessen, ls 9.4) */
  };
  let ende = false;
  for (const a of args) {
    if (ende || a.length < 2 || a[0] !== '-') { operanden.push(a); continue; }
    if (a === '--') { ende = true; continue; }
    if (a.startsWith('--')) {
      const gleich = a.indexOf('='), name = gleich < 0 ? a.slice(2) : a.slice(2, gleich), wert = gleich < 0 ? null : a.slice(gleich + 1);
      const treffer = TERMINAL_LS_LANG.filter(function (x) { return x[0] === name; });
      const kandidaten = treffer.length ? treffer : TERMINAL_LS_LANG.filter(function (x) { return x[0].startsWith(name); });
      if (!kandidaten.length) return fehler(['ls: unrecognized option ' + terminalLsQuote(a)]);
      if (kandidaten.length > 1) return fehler(['ls: option ' + terminalLsQuote(a) + ' is ambiguous; possibilities: ' + kandidaten.map(function (x) { return terminalLsQuote('--' + x[0]); }).join(' ')]);
      const [voll, art] = kandidaten[0];
      if (art === 'no' && wert !== null) return fehler(['ls: option ' + terminalLsQuote('--' + voll) + " doesn't allow an argument"]);
      if (art === 'req' && wert === null) return fehler(['ls: option ' + terminalLsQuote('--' + voll) + ' requires an argument']);
      const kurz = TERMINAL_LS_UMGESETZT[voll];
      if (!kurz) return fehler(['ls: unrecognized option ' + terminalLsQuote(a)]);   /* bekannt, aber in diesem Terminal nicht umgesetzt */
      if (kurz === 'help') return { hilfe: true };
      if (voll === 'classify' && wert !== null) {
        /* argmatch (gnulib): exakte Übereinstimmung, sonst eindeutige Abkürzung (Groß-/Kleinschreibung beachtet); Abkürzungen,
           die auf verschiedene Werte führen, sind mehrdeutig. Unter en_US.UTF-8 stehen diese Meldungen in typografischen Anführungszeichen. */
        const werte = [['always', 'yes', 'force', true], ['never', 'no', 'none', false], ['auto', 'tty', 'if-tty', false]];
        const namen = []; werte.forEach(function (g, i) { g.slice(0, 3).forEach(function (n) { namen.push([n, i]); }); });
        const genau = namen.filter(function (x) { return x[0] === wert; });
        const teil = genau.length ? genau : namen.filter(function (x) { return x[0].startsWith(wert); });
        const gruppen = Array.from(new Set(teil.map(function (x) { return x[1]; })));
        if (gruppen.length === 1) opt.F = werte[gruppen[0]][3];
        else {
          const q = function (t) { return TERMINAL_LS_ZITAT_LINKS + String(t).replace(/\\/g, '\\\\') + TERMINAL_LS_ZITAT_RECHTS; };
          return fehler(['ls: ' + (gruppen.length ? 'ambiguous' : 'invalid') + ' argument ' + q(wert) + ' for ' + q('--classify'),
            'Valid arguments are:'].concat(werte.map(function (g) { return '  - ' + g.slice(0, 3).map(q).join(', '); })), 1);
        }
      } else setze(kurz);
      continue;
    }
    for (const c of Array.from(a).slice(1)) {
      if (!TERMINAL_LS_KURZ.includes(c)) return fehler(["ls: invalid option -- '" + c + "'"]);
      setze(c);
    }
  }
  return { opt: opt, operanden: operanden };
}
/* Operand auflösen: jede Komponente streng prüfen; eine Datei mit Folgekomponente (auch "/" am Ende) ergibt ENOTDIR.
   Ergebnis { seg, typ, adapter, eintrag } oder { fehler } */
async function terminalLsAufloesen(ctx, ziel) {
  if (ziel === '') return { fehler: 'ENOENT' };   /* ls '' : cannot access '': No such file or directory */
  const roh = await ctx.fs.resolve(ziel, { cwd: ctx.cwd });
  if (!roh) return { fehler: 'Permission denied' };
  const absolut = ziel.startsWith('/') || ziel === '~' || ziel.startsWith('~/');
  const teile = (ziel === '~' || ziel.startsWith('~/') ? ziel.slice(1) : ziel).split('/');
  let seg = absolut ? [] : await ctx.fs.resolve('', { cwd: ctx.cwd }), st = null, datei = false;
  for (let i = absolut ? 1 : 0; i < teile.length; i++) {
    const name = teile[i];
    if (datei) return { fehler: 'ENOTDIR' };
    if (!name || name === '.') { if (!name && i === teile.length - 1 && st && st.typ === 'file') return { fehler: 'ENOTDIR' }; continue; }
    if (name === '..') { seg = seg.slice(0, -1); st = null; continue; }
    seg = seg.concat(name);
    st = await ctx.fs.stat(seg, { pruefen: true });
    if (st.fehler) return { fehler: st.fehler };
    datei = st.typ === 'file';
  }
  if (!st || st.typ === undefined || st.typ === null) { st = await ctx.fs.stat(seg, { pruefen: true }); if (st.fehler) return { fehler: st.fehler }; }
  return { seg: seg, typ: st.typ, adapter: st.adapter, eintrag: st.eintrag || null };
}
async function terminalBefehlLs(ctx) {
  const z = terminalLsOptionen(ctx.args);
  if (z.fehler) return { code: z.fehler.code, stdout: [], stderr: z.fehler.zeilen };
  if (z.hilfe) return { code: 0, stdout: [TERMINAL_LS_HILFE.join('\n')], stderr: [] };
  const opt = z.opt, operanden = z.operanden.length ? z.operanden : ['.'], fehler = [], dateien = [], verzeichnisse = [];
  let archiv = false;
  const marke = function (name, dir) { return name + (opt.F && dir ? '/' : ''); };
  const zeile = function (name, dir, e, adapter) {
    if (opt.format !== 'l' || adapter === 'virtuell' || !e) return marke(name, dir);
    return (dir ? 'dr-x' : '-r--') + '  ' + (opt.h ? terminalLsGroesse(e.bytes) : String(e.bytes)).padStart(8) + '  ' + fmtZ(e.mtime * 1000) + '  ' + marke(name, dir);
  };
  for (const op of operanden) {
    const r = await terminalLsAufloesen(ctx, op);
    if (r.fehler) {
      const f = r.fehler === 'Datei oder Ordner nicht gefunden' ? 'ENOENT' : r.fehler;
      fehler.push('ls: cannot access ' + terminalLsQuote(op) + ': ' + (f === 'ENOENT' ? 'No such file or directory' : f === 'ENOTDIR' ? 'Not a directory' : f));
      continue;
    }
    if (r.adapter === 'archiv') archiv = true;
    if (r.typ === 'dir' && !opt.d) verzeichnisse.push({ op: op, seg: r.seg, adapter: r.adapter });
    else dateien.push({ name: op, text: zeile(op, r.typ === 'dir', r.eintrag, r.adapter) });
  }
  /* Anzeigereihenfolge nach en_US.UTF-8 (TERMINAL_LOCALE); beeinflusst weder Namensauflösung noch Zugriffsentscheidung. */
  const ordne = function (liste, schluessel) { return liste.slice().sort(function (a, b) { return TERMINAL_LOCALE.vergleich(schluessel(a), schluessel(b)); }); };
  verzeichnisse.splice(0, verzeichnisse.length, ...ordne(verzeichnisse, function (v) { return v.op; }));
  const aus = [];
  let erst = true;
  if (dateien.length) { aus.push(ordne(dateien, function (d) { return d.name; }).map(function (d) { return d.text; }).join('\n')); erst = false; }
  let code = fehler.length ? 2 : 0;
  for (const v of verzeichnisse) {
    const dir = await ctx.fs.readdir(v.seg, { versteckt: opt.alle !== null });
    if (dir.fehler) { fehler.push('ls: cannot open directory ' + terminalLsQuote(v.op) + ': ' + (dir.fehler === 'ENOENT' || dir.fehler === 'Datei oder Ordner nicht gefunden' ? 'No such file or directory' : dir.fehler)); code = 2; continue; }
    let eintraege = dir.eintraege.filter(function (x) { return opt.alle !== null || !x.name.startsWith('.'); });
    if (opt.alle === 'a') eintraege = eintraege.concat([{ name: '.', dir: true }, { name: '..', dir: true }]);
    const zeilen = ordne(eintraege, function (x) { return x.name; }).map(function (x) { return zeile(x.name, x.dir, x.bytes === undefined ? null : x, v.adapter); });
    const kopf = operanden.length > 1 ? (erst ? '' : '\n') + v.op + ':' + (zeilen.length ? '\n' : '') : (erst ? '' : '\n');
    const text = kopf + zeilen.join('\n');
    if (operanden.length > 1 || zeilen.length) { aus.push(text); erst = false; }
  }
  return { code: code, stdout: aus, stderr: fehler, stderrZuerst: true, archivListe: archiv };
}

const TERMINAL_ZUSTAND = { offen: false, ausgabe: [], prueft: false, dateiLaeuft: false, version: 0, ort: null, virtuellerOrt: null, oldpwd: null, kanal: null, fortschritt: '', verlauf: [], vpos: -1, entwurf: '', satLink: null, orbitLive: false, modem: null, wgSat: null, syslog: [], kette: null, status: 0, tmux: null, plogFolgen: null, nmap: null };
// Scrollback der Shell; größer als die längste Einzelausgabe (predict -f), damit nichts still verloren geht.
const TERMINAL_PUFFER = 1000;
function terminalAusgabe(zeile, schutzZiel = null) {
  const t = TERMINAL_ZUSTAND;
  /* Metadaten und Text behalten dieselben Pufferpositionen. Die Kennung dient
     nur zur späteren Entfernung geschützter Archivtexte nach einer Sperrung. */
  const neu = [].concat(zeile);
  const meta = t.ausgabeMeta || Array(t.ausgabe.length).fill(null);
  t.ausgabeMeta = meta.concat(neu.map(function () { return schutzZiel; })).slice(-TERMINAL_PUFFER);
  t.ausgabe = t.ausgabe.concat(zeile).slice(-TERMINAL_PUFFER);
  terminalPppAnzeige();
  const el = $('profil-terminal-ausgabe');
  if (!el) return;
  /* Bei gesperrten Objekten die Ausgabe schon vor dem DOM-Update maskieren. Der gespeicherte
     Scrollback bleibt unverändert; bei Entsperrung werden Klarnamen wieder korrekt angezeigt. */
  const gesperrt = typeof PROFIL !== 'undefined' && PROFIL && (PROFIL.gesperrt || []).length &&
    typeof sperreText === 'function';
  el.textContent = (gesperrt ? t.ausgabe.map(sperreText) : t.ausgabe).join('\n');
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
const TERMINAL_SAT_RATE = 2400;
// Countdown HH:MM:SS, auf volle Sekunden aufgerundet: dieselbe Zeitbasis und Rundung in PREDICT, Kopfzeile und Chat.
function terminalCountdown(bis, ms) {
  const sek = Math.max(0, Math.ceil((bis - ms) / 1000)), z = function (n) { return String(n).padStart(2, '0'); };
  return z(Math.floor(sek / 3600)) + ':' + z(Math.floor(sek / 60) % 60) + ':' + z(sek % 60);
}
/* Gemeinsamer Zeitstand aller Anzeigen (volle Sekunde): einmal je Takt erfasst und veröffentlicht. Fensterkopf, Chat-Kopf
   und PREDICT rechnen davon aus; Neuzeichnen außerhalb des Takts (neue plog-Zeile, Größenänderung) nutzt den zuletzt
   veröffentlichten Stand, damit keine Anzeige der anderen eine Sekunde vorausläuft. Ohne laufenden Takt (keine Verbindung,
   kein PREDICT) gilt die laufende Sekunde. */
let TERMINAL_ZEITSTAND = null;
function terminalZeitstand() {
  const jetzt = Math.floor(Date.now() / 1000) * 1000;
  return TERMINAL_ZEITSTAND !== null && jetzt - TERMINAL_ZEITSTAND <= 1000 ? TERMINAL_ZEITSTAND : jetzt;
}
function terminalSatRest(link) { return terminalCountdown(link.bis, terminalZeitstand()); }
// Bezeichnung des Linkendes: LINK END, wenn die Funkmaske den Link vor dem geometrischen LOS beendet, sonst LOS.
function terminalSatEnde(link) { return link.los && link.bis < link.los ? 'LINK END' : 'LOS'; }
// Ein Takt für alle zeitabhängigen Anzeigen: Zeitstand einmal erfassen, dann alle im selben Aufruf neu zeichnen.
function terminalTakt() {
  TERMINAL_ZEITSTAND = Math.floor(Date.now() / 1000) * 1000;
  terminalSatAnzeige();
  if (TERMINAL_ZUSTAND.tmux?.panes.some(function (b) { return b.art === 'predict'; })) terminalTmuxPaneAnzeige();
}
/* Statusanzeige im Fensterkopf (Shadow Terminal, keine Ausgabe eines echten Werkzeugs), allein aus der Phase von pppd:
   DIALING während eines Wählversuchs, gleich ob er gelingt; PPP SETUP ab CONNECT bis zur IP-Adresse (IPCP); erst mit
   stehender PPP-Verbindung grün "<Satellit> · EST. LINK END hh:mm:ss" (geschätzt aus Bahn und Funkmaske). In holdoff
   und vor einer Neuwahl leer, nach poff oder LINK END ebenso. PREDICT zeigt unabhängig davon den geometrischen LOS. */
function terminalSatAnzeige() {
  const feld = $('profil-terminal-sat');
  if (!feld) return;
  const t = TERMINAL_ZUSTAND, modem = t.modem, link = t.satLink;
  let text = '', aktiv = false;
  if (modem?.phase === 'chat') text = 'DIALING';
  else if (modem?.phase === 'seriell' || modem?.phase === 'ppp') text = 'PPP SETUP';
  else if (modem?.phase === 'up' && link && !link.abgelaufen) {
    text = link.sat.name + ' · EST. ' + terminalSatEnde(link) + ' ' + terminalSatRest(link);
    aktiv = true;
  }
  feld.hidden = !text;
  feld.textContent = text;
  feld.classList.toggle('aktiv', aktiv);
  terminalPppAnzeige();
}
function terminalSatLinkAktiv(link) {
  if (TERMINAL_ZUSTAND.satLink !== link) return false;
  if (Date.now() < link.bis) return true;
  if (!link.abgelaufen) {
    link.abgelaufen = true;
    clearInterval(link.timer);
    // LOS ist ein Taktereignis: neuer Zeitstand vor den Meldungen, damit kein Countdown nach dem Hangup noch 1 s zeigt.
    TERMINAL_ZEITSTAND = Math.floor(Date.now() / 1000) * 1000;
    terminalPppModemAus('Modem hangup (NO CARRIER)', true, true);
    terminalTakt();
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
  terminalVorschlagAnzeige();
}
function terminalKanalAbbruch() {
  const t = TERMINAL_ZUSTAND;
  terminalSatAbbruch();
  if (t.kanal) terminalPppChatAus();
  terminalPlogEnde(1);
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
/* Funkmaske (#66): Einwahl ab KESTREL_FUNK.wahl Grad Elevation; ein bestehender Link reißt ab, sobald der Satellit auf dem
   absteigenden Ast unter KESTREL_FUNK.ende Grad sinkt, aus der Bahnkurve berechnet (kestrelLinkEnde). Modellwerte dieser
   Simulation, keine allgemeingültige Grenze. PREDICT zeigt weiter den geometrischen LOS (0°); die Verbindungsanzeige zeigt
   bei abweichender Grenze LINK END. */
const KESTREL_FUNK = { wahl: 5, ende: 3 };
const KESTREL_MIN_EL = KESTREL_FUNK.wahl;
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
    return kestrelSekunde(sat, steigend ? hi : lo, steigend);
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
  return { sat, von, bis: kestrelSekunde(sat, lo, false), maxMs: Math.round(max.ms / 1000) * 1000, maxEl: max.el };
}
// Auf ganze Sekunden festgelegt, unabhängig vom Suchweg: Aufgang = erste Sekunde mit el >= 0, Untergang = letzte.
function kestrelSekunde(sat, x, steigend) {
  let t = Math.floor(x / 1000) * 1000;
  if (steigend) { t -= 1000; while (kestrelEl(sat, t) < 0) t += 1000; return t; }
  t += 1000; while (kestrelEl(sat, t) < 0) t -= 1000; return t;
}
// Erwartetes Linkende eines Überflugs: erste volle Sekunde mit El < KESTREL_FUNK.ende auf dem absteigenden Ast.
function kestrelLinkEnde(u) {
  const ende = KESTREL_FUNK.ende;
  if (ende <= 0) return u.bis;
  let lo = u.maxMs, hi = u.bis;
  if (kestrelEl(u.sat, lo) < ende) return lo;
  while (hi - lo > 20) { const m = (lo + hi) / 2; if (kestrelEl(u.sat, m) >= ende) lo = m; else hi = m; }
  let t = Math.floor(lo / 1000) * 1000 + 1000;
  while (kestrelEl(u.sat, t) < ende) t -= 1000;
  return t + 1000;
}
function kestrelSichtbar(ms) {
  return kestrelSats().map(function (x) { return { sat: x, el: kestrelEl(x, ms) }; })
    .filter(function (x) { return x.el >= 0; }).sort(function (a, b) { return b.el - a.el; });
}
// Sitzungswerte: Prozessnummern und Adressen je Sitzung verschieden.
/* Peer-Datei mit persist, holdoff 20, maxfail 0 (pppd(8), main.c): nach einem gescheiterten Wählversuch wartet pppd
   die holdoff-Zeit ab und wählt ohne eigene Logzeile neu, ohne Grenze für Fehlversuche; nach einem Modem-Hangup
   (LOS) entfällt holdoff. pppd endet nur durch Signal (poff, Strg+C) oder Sitzungsende. */
/* XMPP-Server des Kanals: Onion-Adresse v3 im echten Format (Tor rend-spec: base32(PUBKEY | CHECKSUM | VERSION), CHECKSUM =
   SHA3-256(".onion checksum" | PUBKEY | VERSION)[:2], VERSION = 3). Offline mit einem frischen Ed25519-Schlüssel erzeugt,
   privater Schlüssel verworfen, nie veröffentlicht: ein Platzhalter ohne Dienst. Kein Tor-Zugriff. */
const TERMINAL_XMPP_DOMAIN = 'gcibomdfyfv6wf3hsfustwcahoehehwrxnpjncwykptqlttkdpx2oxyd.onion';
const TERMINAL_PPP_HOLDOFF = 20000;
const TERMINAL_PPP_NEUWAHL = 1000;
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
  // Ist der Chat offline (poff, LOS), zeigt der KESTREL-Block keinen Link mehr; der Chatverlauf mit Lost connection. bleibt.
  const block = !!chat && chat.phase !== 'offline';
  oben.hidden = !block && !live;
  oben.classList.toggle('orbit-live', live);
  unten.hidden = !chat;
  for (const id of ['profil-terminal-xmpp-titel', 'profil-terminal-xmpp-status']) { const el = $(id); if (el) el.hidden = !chat; }
  if (!chat && !live) { shell.hidden = false; return; }
  shell.hidden = !!chat;
  if (!chat) { delete oben.dataset.chat; terminalPredictSetzen(oben, terminalZeitstand()); return; }
  if (!block) { delete oben.dataset.chat; oben.replaceChildren(); }
  else {
    const kopf = chat.link.sat.name + '  [' + terminalSatEnde(chat.link) + ' ' + terminalSatRest(chat.link) + ']', telemetrie = terminalPppZeile(chat.link.sat, terminalZeitstand());
    const daten = kopf + '\n' + telemetrie;
    if (oben.dataset.chat !== daten) {
      delete oben.dataset.predict; oben.dataset.chat = daten;
      oben.replaceChildren(h('span', { class: 'link-kopf' }, kopf), '\n', h('span', { class: 'link-telemetrie' }, telemetrie));
    }
  }
  const fenster = terminalPppAktiv(chat), text = fenster.log.map(function (e) { return e.zeile ?? e; }).join('\n');
  if (unten.textContent !== text) {
    unten.textContent = text;
    unten.scrollTop = unten.scrollHeight;
  }
  // Titelzeile: Titel des aktuellen Fensters (Konsole oder Kontakt, mit [OMEMO]) und die eigene Präsenz.
  const titel = $('profil-terminal-xmpp-titel'), status = $('profil-terminal-xmpp-status');
  if (titel) {
    const praesenz = chat.phase === 'offline' ? 'offline' : chat.phase === 'anmeldung' ? 'connecting' : 'online';
    const links = fenster.kontakt ? fenster.kontakt + (fenster.omemo ? ' [OMEMO]' : '') : 'Console';
    titel.replaceChildren(h('span', { class: 'xmpp-titel' }, links), h('span', { class: 'xmpp-praesenz' }, '[' + praesenz + ']'));
  }
  // Statuszeile (statusbar.c, 0.11.1): links [Zeit] und das eigene Konto, rechts die Fenster ohne Trenner; ein Fenster als
  // [n], das aktuelle als -n-, eines mit Neuem mit normalen Klammern, aber hervorgehoben. Nur Nummern, keine Namen.
  if (status) status.replaceChildren(h('span', { class: 'xmpp-selbst' }, '[' + terminalPppZeit(terminalZeitstand()).slice(0, 5) + '] [' + chat.jid + ']'),
    h('span', { class: 'xmpp-tabs' }, ...chat.fenster.map(function (f, i) {
      const nr = String(i + 1);
      return h('span', { class: 'xmpp-fenster' + (i === chat.aktiv ? ' aktiv' : '') + (f.neu ? ' neu' : '') }, i === chat.aktiv ? '-' + nr + '-' : '[' + nr + ']');
    })));
}
// Datum wie in predict -p/-f (UTC): 18Nov26.
function kestrelDatum(ms) {
  const iso = new Date(ms).toISOString();
  return iso.slice(8, 10) + new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'UTC' }).format(new Date(ms)) + iso.slice(2, 4);
}
// TLE-Epoche aus Zeile 1 (Spalten 19-32: JJTTT.TTTTTTTT, Tag des Jahres mit Bruchteil), als ms UTC.
function kestrelEpoche(sat) {
  const jj = Number(sat.l1.slice(18, 20)), tag = Number(sat.l1.slice(20, 32));
  return Date.UTC(jj < 57 ? 2000 + jj : 1900 + jj, 0, 1) + (tag - 1) * 86400000;
}
/* Interaktives predict (Real-Time Multi-Tracking Mode): alle Satelliten der Datei mit nächstem Ereignis. Kopf mit QTH, Zeit
   und der Spanne der TLE-Epochen; AOS/LOS mit UTC-Datum und Countdown HH:MM:SS; Entfernung in km. Zeilen über dem
   geometrischen Horizont (El >= 0) sind markiert (oben); das bedeutet Sicht, keine Verbindung. */
function terminalPredictLiveTeile(ms) {
  const q = kestrelQth(), sats = kestrelSats(), uhr = function (x) { return kestrelDatum(x) + ' ' + terminalPppZeit(x); };
  const epochen = sats.map(kestrelEpoche), von = Math.min(...epochen), bis = Math.max(...epochen);
  const ep = function (x) { return kestrelDatum(x) + ' ' + terminalPppZeit(x).slice(0, 5); };
  // Kompakt: drei Kopfzeilen, damit die vier Satelliten auch neben plog in einem Bereich Platz finden.
  const kopf = ['PREDICT Real-Time Multi-Tracking Mode · ' + uhr(ms) + ' UTC',
    'QTH ' + q.name + ' ' + Math.abs(q.lat).toFixed(2) + (q.lat >= 0 ? 'N ' : 'S ') + Math.abs(q.lon).toFixed(2) + (q.lon >= 0 ? 'E' : 'W') +
      ' · TLE epoch ' + (ep(von) === ep(bis) ? ep(von) : ep(von) + ' - ' + ep(bis)) + ' UTC',
    'Satellite'.padEnd(12) + 'Az'.padStart(5) + 'El'.padStart(6) + 'Range km'.padStart(10) + '   Next event (UTC)'];
  const zeilen = sats.map(function (sat) {
    const l = kestrelLage(sat, ms), u = kestrelUeberflug(sat, ms), oben = l.el >= 0;
    const ereignis = !u ? '-' : oben ? 'LOS ' + uhr(u.bis) + ' (' + terminalCountdown(u.bis, ms) + ')' : 'AOS ' + uhr(u.von) + ' (' + terminalCountdown(u.von, ms) + ')';
    return { text: sat.name.padEnd(12) + String(Math.round(l.az)).padStart(5) + String(Math.round(l.el)).padStart(6) + String(Math.round(l.range)).padStart(10) + '   ' + ereignis, oben };
  });
  return { kopf, zeilen };
}
function terminalPredictLive(ms) {
  const d = terminalPredictLiveTeile(ms);
  return d.kopf.concat(d.zeilen.map(function (z) { return z.text; })).join('\n');
}
// Setzt die Verfolgung in ein Element; Zeilen über dem Horizont fett (wie PREDICT: BOLD). Nur bei geändertem Text neu.
function terminalPredictSetzen(el, ms) {
  const d = terminalPredictLiveTeile(ms), text = d.kopf.concat(d.zeilen.map(function (z) { return (z.oben ? '+' : '-') + z.text; })).join('\n');
  if (el.dataset.predict === text) return;
  el.dataset.predict = text;
  el.replaceChildren(h('span', { class: 'predict-kopf' }, d.kopf.join('\n')), ...d.zeilen.flatMap(function (z) {
    return ['\n', h('span', { class: z.oben ? 'predict-oben' : 'predict-unten' }, z.text)];
  }));
}
/* profanity-Fenster (Profanity-Guide, Basic usage): Fenster 1 ist die Konsole für System- und Befehlsmeldungen, jedes
   Gespräch bekommt ein eigenes nummeriertes Fenster (/msg öffnet es), /win N wechselt. Ein Fenster mit neuen Meldungen
   wird in der Statuszeile hervorgehoben. ziel: Fensterobjekt; ohne Angabe die Konsole. */
/* Zeile wie Profanity 0.18.2 (_win_print_internal): "<Zeit> <Zeichen> <Text>". Zeichen '-' (Vorgabe), '!' (Hinweise
   wie die OMEMO-Meldungen) oder '~' (OMEMO-verschlüsselte Nachricht, omemo.char).
   opt.stumm: kein Hinweis in der Statuszeile (cons_show, win_println); sonst wird ein nicht aktives Fenster markiert
   (cons_alert, cons_show_error, eingehende Nachricht). */
function terminalPppChatLog(chat, text, ziel, opt) {
  if (TERMINAL_ZUSTAND.kanal !== chat) return null;
  // opt.zeit: Zeit der Zeile, wenn sie nicht die Ankunft ist (Verzögerungsvermerk, XEP-0203)
  const fenster = ziel || chat.fenster[0], kopf = terminalPppZeit(opt?.zeit ?? Date.now()) + ' ' + (opt?.zeichen || '-') + ' ';
  // opt.eintrag: Zeile mit Kennung, die später an derselben Stelle ersetzt wird (Uploadstatus); die Zeit bleibt.
  const eintrag = opt?.eintrag ? { kopf, zeile: kopf + text } : kopf + text;
  fenster.log = fenster.log.concat(eintrag).slice(-70);
  if (fenster !== chat.fenster[chat.aktiv] && !opt?.stumm) fenster.neu = true;
  terminalPppAnzeige();
  return eintrag;
}
function terminalPppEintragSetzen(chat, eintrag, text) {
  if (!eintrag || TERMINAL_ZUSTAND.kanal !== chat) return;
  eintrag.zeile = eintrag.kopf + text;
  terminalPppAnzeige();
}
function terminalPppAktiv(chat) { return chat.fenster[chat.aktiv]; }
function terminalPppFensterWechsel(chat, i) {
  chat.aktiv = i;
  const f = chat.fenster[i];
  f.neu = false;
  chat.kontakt = f.kontakt || null;
  terminalPppAnzeige();
}
function terminalPppLog(text) {
  const t = TERMINAL_ZUSTAND, jetzt = new Date();
  const tag = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(jetzt);
  const zeile = tag + ' ' + terminalPppZeit(+jetzt) + ' terminal ' + text;
  t.syslog = t.syslog.concat(zeile).slice(-60);
  terminalPlogZeile(zeile);
}
function terminalPppChatAus() {
  const t = TERMINAL_ZUSTAND, chat = t.kanal;
  if (chat?.ui !== 'xmpp') return;
  clearTimeout(chat.abbruch);
  clearTimeout(chat.anmeldung);
  chat.fenster.forEach(function (f) { clearTimeout(f.omemoAufbau); });
  clearTimeout(chat.zustellung);
  terminalPppUploadsBeenden(chat);
  t.kanal = null;
  terminalVordergrundEnde(chat, 0);
  terminalTabReset();
  terminalTransferStop();
  const input = $('profil-terminal-eingabe');
  if (input) terminalEingabeSetzen(input, '');
  terminalKanalPromptSync();
  terminalSatAnzeige();
}
// neuWaehlen: Modem-Hangup mit persist; pppd bleibt und wählt sofort neu (holdoff entfällt).
/* Abbauzeilen nach pppd/chat-Quelltext (main.c, tty.c, auth.c, chat.c). Phasen: chat (Connect-Skript läuft), seriell
   (CONNECT, PPP-Interface noch nicht eingerichtet), ppp (ab "Connect: ppp0 <--> …", LCP/IPCP), up, holdoff, neuwahl
   (nach Modem-Hangup, kein Link bis zur nächsten Wahl).
   Signal während chat: es geht an chat ("SIGTERM"/"SIGINT"), das Connect-Skript scheitert, der Fehlerpfad setzt
   asked_to_quit; pppd endet ohne "Terminating on signal" mit "Exit.". Ohne PPP-Link (seriell, holdoff, neuwahl):
   "Terminating" und "Exit.". Ab ppp baut pppd den Link ab ("Connection terminated."). Modem-Hangup mit persist: kein "Exit.". */
function terminalPppAbbauZeilen(modem, grund) {
  const d = 'pppd[' + TERMINAL_SITZUNG.pppd + ']: ', c = 'chat[' + TERMINAL_SITZUNG.chat + ']: ';
  const signal = /^Terminating on signal (\d+)$/.exec(grund);
  if (!signal) return [d + grund, terminalPppEnde()];
  if (modem.phase === 'chat') return [c + (signal[1] === '2' ? 'SIGINT' : 'SIGTERM'), d + 'Connect script failed', d + 'Exit.'];
  if (modem.phase === 'ppp' || modem.phase === 'up') return [d + grund, terminalPppEnde(), d + 'Exit.'];
  return [d + grund, d + 'Exit.'];
}
function terminalPppModemAus(grund, inShell = true, neuWaehlen = false) {
  const t = TERMINAL_ZUSTAND, modem = t.modem;
  if (modem) {
    clearTimeout(modem.timer);
    const zeilen = terminalPppAbbauZeilen(modem, grund);
    zeilen.forEach(terminalPppLog);
    // Liest plog -f mit, erscheinen die Zeilen schon über den Syslog; die direkte Meldung entfällt dann.
    if (inShell && !t.plogFolgen) terminalAusgabe(zeilen);
    // Rückgabewert (pppd(8), tty.c/main.c): Bricht das Signal das laufende Connect-Skript ab, endet pppd mit
    // EXIT_CONNECT_FAILED (8); verarbeitet es das Signal in der Ereignisschleife (holdoff, Aushandlung), mit EXIT_USER_REQUEST (5).
    const code = /^Terminating on signal/.test(grund) && modem.phase === 'chat' ? 8 : grund.includes('signal 2') ? 5 : 1;
    if (!neuWaehlen) terminalVordergrundEnde(modem, code);
  }
  if (modem && neuWaehlen) {
    // Der Link ist abgebaut; bis zur Neuwahl besteht kein PPP-Link (ein poff in dieser Sekunde baut nichts mehr ab).
    modem.bereit = false; modem.link = null; modem.phase = 'neuwahl';
    modem.timer = setTimeout(function () { if (TERMINAL_ZUSTAND.modem === modem) terminalPppWahl(modem); }, TERMINAL_PPP_NEUWAHL);
  } else {
    t.modem = null;
    // pppd ist beendet: der Funklink besteht nicht mehr, der LOS-Zähler im Fensterkopf verschwindet (auch mit wg-sat oder Chat).
    // PREDICT rechnet den Überflug unabhängig davon weiter.
    if (t.satLink) { clearInterval(t.satLink.timer); t.satLink = null; }
  }
  terminalKanalPromptSync();
  terminalSatAnzeige();
  if (t.wgSat) t.wgSat.handshake = null;
  const chat = t.kanal;
  if (chat?.ui !== 'xmpp' || chat.phase === 'offline') return;
  chat.phase = 'offline';
  clearTimeout(chat.anmeldung);
  chat.fenster.forEach(function (f) { clearTimeout(f.omemoAufbau); });
  clearTimeout(chat.zustellung);
  terminalTabReset();
  terminalTransferStop();
  // Profanity kennt die Modemursache nicht (sie steht im Syslog); es meldet den eigenen Uploadfehler und den Verbindungsabbruch.
  // Abbruch wie Profanity 0.18.2: sv_ev_lost_connection schreibt "Lost connection." in die Konsole,
  // wins_lost_connection dieselbe Zeile in jedes andere Fenster. Ein laufender Upload (http_file_put) scheitert mit dem
  // Fehlertext von curl; eine noch unbeantwortete Slot-Anfrage verfällt ohne Meldung.
  const uploads = terminalPppUploadsBeenden(chat);
  chat.abbruch = setTimeout(function () {
    uploads.forEach(function (u) { if (u.status) terminalPppUploadFehler(chat, u, TERMINAL_UPLOAD_ABBRUCH); });
    // Konsole per cons_show_error (cons_alert: Hinweis), die übrigen per win_println (kein Hinweis).
    chat.fenster.forEach(function (f, i) { terminalPppChatLog(chat, 'Lost connection.', f, { stumm: i > 0 }); });
  }, 750);
}
function terminalPppWaehltVorne() {
  const modem = TERMINAL_ZUSTAND.modem;
  return !!modem?.vordergrund && !modem.bereit;
}
// Ausgang eines Wahlversuchs. Für Tests festlegbar: TERMINAL_ZUSTAND.wahlVorgabe = 'ok' | 'busy' | 'nocarrier'.
// Sonst: kein Satellit über der Mindestelevation -> NO CARRIER; Gateway gelegentlich besetzt; tief am Horizont öfter kein Träger.
/* Wahlausgang: ok, busy, nocarrier (Satellit über dem Horizont, Ruf kommt nicht zustande) oder alarm (kein Satellit über dem
   Horizont, das Modem antwortet nicht; chat bricht nach TIMEOUT ab). */
function terminalWahlausgang(el) {
  const vorgabe = TERMINAL_ZUSTAND.wahlVorgabe;
  if (['ok', 'busy', 'nocarrier', 'alarm'].includes(vorgabe)) return el >= KESTREL_MIN_EL || vorgabe !== 'ok' ? vorgabe : el < 0 ? 'alarm' : 'nocarrier';
  if (el < 0) return 'alarm';
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
/* Dauern der Wahl (ms). Belegt an Syslog-Auszügen echter Einwahlen mit chat/pppd: Iridium-Datenruf ATDT bis CONNECT etwa
   10 s, CONNECT bis IP-Adresse etwa 13 s, ohne Antwort Abbruch durch den chat-Timeout (dort 60 s); Analogmodem ATD bis
   CONNECT 19-20 s. Spannen mit Streuung; BUSY und NO CARRIER nicht belegt, angenommen. */
const TERMINAL_PPP_DAUER = { connect: [10000, 20000], ppp: [600, 1000], ip: [9000, 12000], busy: [3000, 5000], nocarrier: [15000, 30000], timeout: 60000 };
function terminalPppDauer(spanne) { return spanne[0] + crypto.getRandomValues(new Uint32Array(1))[0] % (spanne[1] - spanne[0] + 1); }
function terminalPppEinwahl(vordergrund) {
  const modem = { bereit: false, vordergrund, timer: null, link: null, versuche: 0 };
  TERMINAL_ZUSTAND.modem = modem;
  const ende = vordergrund ? terminalVordergrund(modem) : 0;
  terminalPppWahl(modem);
  return ende;
}
// Ein Wählversuch: jedes Mal ein neuer chat-Prozess (neue PID), pppd bleibt derselbe.
function terminalPppWahl(modem) {
  const t = TERMINAL_ZUSTAND, jetzt = Date.now(), S = TERMINAL_SITZUNG;
  if (modem.versuche++) S.chat += 1 + terminalKanalZufall(6);
  modem.holdoff = false;
  modem.phase = 'chat';
  const oben = kestrelSichtbar(jetzt)[0] || null;
  const ausgang = terminalWahlausgang(oben ? oben.el : -90);
  if (t.satLink) clearInterval(t.satLink.timer);
  let link = null;
  if (ausgang === 'ok') {
    const u = kestrelUeberflug(oben.sat, jetzt);
    link = { modus: 'ppp', sat: oben.sat, von: u.von, bis: kestrelLinkEnde(u), los: u.bis, abgelaufen: false, timer: null };
    link.timer = setInterval(function () { if (terminalSatLinkAktiv(link)) terminalTakt(); }, 250);
  }
  t.satLink = link;
  modem.link = link;
  terminalKanalPromptSync();
  terminalSatAnzeige();
  const c = 'chat[' + S.chat + ']: ', d = 'pppd[' + S.pppd + ']: ';
  const wahl = 'ATDT' + TERMINAL_PPP_WAHL;
  const schritte = [
    [0, [c + 'abort on (BUSY)', c + 'abort on (NO CARRIER)', c + 'send (ATZ^M)', c + 'expect (OK)']],
    [150, [c + 'ATZ^M^M', c + 'OK', c + ' -- got it', c + 'send (AT+CSQ^M)', c + 'timeout set to ' + TERMINAL_PPP_DAUER.timeout / 1000 + ' seconds', c + 'expect (OK)']],
    [550, [c + 'AT+CSQ^M^M', c + terminalCsq(oben ? oben.el : -1) + '^M', c + '^M', c + 'OK', c + ' -- got it',
      c + 'send (' + wahl + '^M)', c + 'expect (CONNECT)']]
  ];
  // chat(8): ABORT-Treffer " -- failed" und "Failed (<abort>)", Timeout "alarm" und "Failed" (chat.c); danach pppd.
  const D = TERMINAL_PPP_DAUER;
  if (ausgang === 'ok') schritte.push(
    [terminalPppDauer(D.connect), [c + wahl + '^M^M', c + 'CONNECT 19200', c + ' -- got it']],
    [100, [d + 'Serial connection established.']],
    [terminalPppDauer(D.ppp), [d + 'Using interface ppp0', d + 'Connect: ppp0 <--> /dev/ttyUSB0']],
    [terminalPppDauer(D.ip), [d + 'local  IP address ' + S.lokal, d + 'remote IP address ' + S.gegenstelle]]);
  // Ohne Antwort bleibt die Echozeile unvollständig (sie endet erst mit dem Zeilenumbruch vor einer Antwort) und erscheint nicht.
  else if (ausgang === 'alarm') schritte.push([D.timeout, [c + 'alarm', c + 'Failed', d + 'Connect script failed']]);
  else {
    const grund = ausgang === 'busy' ? 'BUSY' : 'NO CARRIER';
    schritte.push([terminalPppDauer(ausgang === 'busy' ? D.busy : D.nocarrier), [c + wahl + '^M^M', c + grund, c + ' -- failed', c + 'Failed (' + grund + ')', d + 'Connect script failed']]);
  }
  const schritt = function (i) {
    if (t.modem !== modem || (link && !terminalSatLinkAktiv(link))) return;
    const zeilen = schritte[i][1];
    zeilen.forEach(terminalPppLog);
    if (modem.vordergrund) terminalAusgabe(zeilen);
    // Nach CONNECT ist das Connect-Skript fertig; ab "Connect: ppp0 <--> …" besteht das PPP-Interface (LCP/IPCP).
    if (zeilen.some(function (z) { return z.endsWith('CONNECT 19200'); })) { modem.phase = 'seriell'; terminalSatAnzeige(); }
    if (zeilen.some(function (z) { return z.includes('Connect: ppp0 <--> '); })) { modem.phase = 'ppp'; terminalSatAnzeige(); }
    if (i + 1 < schritte.length) {
      modem.timer = setTimeout(() => schritt(i + 1), schritte[i + 1][0]);
      return;
    }
    modem.timer = null;
    if (!link) {
      // Wahl gescheitert: mit persist und maxfail 0 bleibt pppd und wählt nach holdoff neu; updetach bleibt im Vordergrund.
      modem.holdoff = true; modem.phase = 'holdoff';
      modem.timer = setTimeout(function () { if (t.modem === modem) terminalPppWahl(modem); }, TERMINAL_PPP_HOLDOFF);
      terminalKanalPromptSync();
      terminalSatAnzeige();
      return;
    }
    // Verbunden: updetach löst sich vom Terminal, spätere Neuwahlen laufen im Hintergrund.
    modem.bereit = true; modem.phase = 'up';
    modem.vordergrund = false;
    terminalKanalPromptSync();
    terminalSatAnzeige();
    terminalVordergrundEnde(modem, 0);
  };
  schritt(0);
}
/* Die Shell endet (exit in tmux): Ihr Vordergrundjob erhält SIGHUP.
   pppd vor dem Abkoppeln (updetach): pppd(8) NOTES, main.c: "Hangup (SIGHUP)", der laufende Versuch endet (chat erhält
   das Signal, das Connect-Skript scheitert); mit persist bleibt pppd und wählt neu, in der holdoff-Phase sofort.
   Ohne Terminal läuft es im Hintergrund weiter. wg-quick up: bash endet, die EXIT-Falle (del_if) entfernt wg-sat. */
function terminalShellSighup() {
  const t = TERMINAL_ZUSTAND, modem = t.modem, d = 'pppd[' + TERMINAL_SITZUNG.pppd + ']: ';
  if (modem && modem.vordergrund && !modem.bereit) {
    modem.vordergrund = false;
    clearTimeout(modem.timer);
    if (modem.link) { clearInterval(modem.link.timer); if (t.satLink === modem.link) t.satLink = null; modem.link = null; }
    // SIGHUP mit persist (pppd(8), main.c): Während chat wählt, geht das Signal an chat, das Connect-Skript scheitert; der
    // Hangup wird in der holdoff-Schleife verarbeitet und beendet sie sofort. In holdoff ebenso sofort. Nach CONNECT wählt
    // pppd nach holdoff neu; besteht schon das PPP-Interface, baut es zuvor den Link ab.
    if (modem.phase === 'chat') ['chat[' + TERMINAL_SITZUNG.chat + ']: SIGHUP', d + 'Connect script failed', d + 'Hangup (SIGHUP)'].forEach(terminalPppLog);
    else terminalPppLog(d + 'Hangup (SIGHUP)');
    if (modem.phase === 'ppp' || modem.phase === 'seriell') {
      if (modem.phase === 'ppp') terminalPppLog(terminalPppEnde());
      modem.holdoff = true; modem.phase = 'holdoff';
      modem.timer = setTimeout(function () { if (t.modem === modem) terminalPppWahl(modem); }, TERMINAL_PPP_HOLDOFF);
    } else terminalPppWahl(modem);
    terminalVordergrundEnde(modem, 5);
  }
  if (t.wgSat && !t.wgSat.bereit) {
    clearTimeout(t.wgSat.timer); terminalVordergrundEnde(t.wgSat, 1); t.wgSat = null;
  }
  terminalPlogEnde(1);
  terminalNmapEnde(129);
  // Laufende Archivabfragen und Übertragungen der Shell werden verworfen (wie bei clear und Sitzungsende).
  TERMINAL_ZUSTAND.version++;
  terminalTransferStop();
  terminalSatAnzeige();
}
async function terminalPppShell(befehl, arg, args = []) {
  const t = TERMINAL_ZUSTAND, link = t.satLink;
  if (befehl === 'predict') {
    // predict(1): -t <tlefile>, -p <sat> [start] (ein Überflug), -f <sat> [start [ende]] (Positionsdaten);
    // ohne -p/-f das interaktive Programm (hier die Verfolgung aller Satelliten, Ende mit Strg+C).
    const o = terminalPredictOptionen(args);
    if (o.fehler) { terminalAusgabe(o.fehler === 'usage' ? TERMINAL_PREDICT_USAGE : 'predict: ' + o.fehler); return o.fehler === 'usage' ? 2 : 1; }
    if (o.modus === 'live') {
      const orbit = { fertig: null, timer: setInterval(terminalTakt, 250) };
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
      const domain = TERMINAL_XMPP_DOMAIN;
      // Konto wie /account add: Ressource "profanity." + 4 Zeichen (jid_random_resource), danach in accounts gespeichert;
      // hier aus dem Konto abgeleitet, damit sie über Neustarts gleich bleibt.
      const account = 'ghost@' + domain;
      const chat = { ui: 'xmpp', phase: 'anmeldung', link, fenster: [{ titel: 'Console', log: [], neu: false }], aktiv: 0, domain, account,
        jid: account + '/profanity.' + terminalPppAbleitung(account + '/resource', TERMINAL_PPP_ALNUM, 4),
        vorschlag: terminalXmppProfil().kontakt + '@' + domain,
        kontakt: null };
      const ende = terminalVordergrund(chat);
      t.kanal = chat;
      terminalPppChatLog(chat, 'Connecting with account ' + chat.account + ' as ' + chat.jid); // cl_ev_connect_account
      chat.anmeldung = setTimeout(function () {
        if (t.kanal !== chat || chat.phase !== 'anmeldung' || !terminalSatLinkAktiv(link)) return;
        chat.phase = 'eingabe';
        t.wgSat.handshake = Date.now();
        terminalPppChatLog(chat, chat.jid + ' logged in successfully, online (priority 0).'); // cons_show_login_success
        // Nach der Anmeldung (Präsenz) stellt der Server gespeicherte Nachrichten zu.
        terminalXmppZustellungPlanen(chat, TERMINAL_XMPP_OFFLINE_MS);
      }, 6000);
      terminalKanalPromptSync();
      return ende;
    }
  }
  return null;
}
/* plog (pon(1), Debian-ppp). Ohne /var/log/ppp.log (die Peer-Datei setzt kein logfile) ist es
     exec tail "$@" /var/log/syslog | grep ' \(pppd\|chat\)\['
   Argumente gehen an tail (GNU-Ausschnitt: -n N, -nN, -N, --lines=N, -f, -F, --follow), der Rückgabewert ist der
   von grep: 0 mit, 1 ohne Treffer. -f folgt neuen Zeilen bis Strg+C (130). */
const TERMINAL_PLOG_GREP = / (pppd|chat)\[/;
function terminalPlogTail(args) {
  const fehler = function (text, hilfe) { return { fehler: hilfe ? [text, "Try 'tail --help' for more information."] : [text] }; };
  const zahl = function (w) {
    const m = /^([+-]?)(\d+)$/.exec(w);
    return m ? { n: Number(m[2]), vonAnfang: m[1] === '+' } : null;
  };
  let n = { n: 10, vonAnfang: false }, folgen = false, dateien = [], optionen = true;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (!optionen || a === '-' || !a.startsWith('-')) { dateien.push(a); continue; }
    if (a === '--') { optionen = false; continue; }
    // Veraltete Form -N[f], nur als erstes Argument (wie GNU tail).
    const alt = i === 0 && /^-(\d+)(f?)$/.exec(a);
    if (alt) { n = { n: Number(alt[1]), vonAnfang: false }; folgen = folgen || !!alt[2]; continue; }
    if (a.startsWith('--')) {
      const [name, wert] = a.includes('=') ? [a.slice(0, a.indexOf('=')), a.slice(a.indexOf('=') + 1)] : [a, null];
      if (name === '--follow' && (wert === null || wert === 'name' || wert === 'descriptor')) { folgen = true; continue; }
      if (name === '--lines') {
        const w = wert ?? args[++i];
        if (w === undefined) return fehler("tail: option '--lines' requires an argument", true);
        n = zahl(w); if (!n) return fehler("tail: invalid number of lines: '" + w + "'");
        continue;
      }
      return fehler("tail: unrecognized option '" + a + "'", true);
    }
    for (let k = 1; k < a.length; k++) {
      const c = a[k];
      if (c === 'f' || c === 'F') { folgen = true; continue; }
      if (c === 'n') {
        const w = k + 1 < a.length ? a.slice(k + 1) : args[++i];
        if (w === undefined) return fehler("tail: option requires an argument -- 'n'", true);
        n = zahl(w); if (!n) return fehler("tail: invalid number of lines: '" + w + "'");
        break;
      }
      return fehler("tail: invalid option -- '" + c + "'", true);
    }
  }
  return { n, folgen, dateien: dateien.concat('/var/log/syslog') };
}
// Inhalt einer Datei für tail: Zeilen, oder eine Fehlermeldung. Dateien im Archiv werden nicht geöffnet
// (ihr Inhalt enthält keine pppd-Zeilen, grep ließe ohnehin nichts durch); ihr Vorhandensein bleibt ungeprüft.
function terminalPlogDatei(name) {
  const virtuell = terminalShellPfad(name), voll = virtuell && '/' + virtuell.join('/');
  if (voll === '/var/log/syslog') return { zeilen: TERMINAL_ZUSTAND.syslog };
  if (voll && TERMINAL_VIRT_DATEIEN.has(voll)) return { zeilen: TERMINAL_VIRT_DATEIEN.get(voll)().split('\n') };
  if (voll && (voll === '/' || TERMINAL_TLE_DIRS.has(voll))) return { fehler: "tail: error reading '" + name + "': Is a directory" };
  if (virtuell && virtuell[0] === TERMINAL_DB) return { zeilen: [] };
  return { fehler: "tail: cannot open '" + name + "' for reading: No such file or directory" };
}
function terminalPlog(args) {
  const t = TERMINAL_ZUSTAND, opt = terminalPlogTail(args);
  if (opt.fehler) { terminalAusgabe(opt.fehler); return 1; }
  let treffer = false;
  opt.dateien.forEach(function (name) {
    const d = terminalPlogDatei(name);
    if (d.fehler) { terminalAusgabe(d.fehler); return; }
    const zeilen = opt.n.vonAnfang ? d.zeilen.slice(Math.max(0, opt.n.n - 1)) : opt.n.n ? d.zeilen.slice(-opt.n.n) : [];
    const gefiltert = zeilen.filter(function (z) { return TERMINAL_PLOG_GREP.test(z); });
    if (gefiltert.length) { treffer = true; terminalAusgabe(gefiltert); }
  });
  if (!opt.folgen) return treffer ? 0 : 1;
  const folgen = {};
  t.plogFolgen = folgen;
  return terminalVordergrund(folgen);
}
// Neue Syslog-Zeile: ein laufendes plog -f gibt sie aus, wenn grep sie durchlässt.
function terminalPlogZeile(zeile) {
  if (TERMINAL_ZUSTAND.plogFolgen && TERMINAL_PLOG_GREP.test(zeile)) terminalAusgabe(zeile);
  terminalTmuxPlogZeile(zeile);
}
function terminalPlogEnde(code) {
  const t = TERMINAL_ZUSTAND, folgen = t.plogFolgen;
  if (!folgen) return;
  t.plogFolgen = null;
  terminalVordergrundEnde(folgen, code);
}
function terminalSyslog(n) {
  const log = TERMINAL_ZUSTAND.syslog;
  terminalAusgabe(n ? log.slice(-n) : '');
}
const TERMINAL_PPP_ALNUM = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
/* SHA-256 (FIPS 180-4), synchron, für UTF-8-Text; Ergebnis als Hex. crypto.subtle wäre asynchron, die Ableitungen
   werden aber synchron gebraucht (Anmeldezeile, Statuszeile). */
function terminalPppSha256(text) {
  const K = [], H = [];
  const bruch = function (x) { return ((x - Math.floor(x)) * 4294967296) >>> 0; };
  for (let n = 2, k = 0; k < 64; n++) {
    let prim = true;
    for (let d = 2; d * d <= n; d++) if (n % d === 0) { prim = false; break; }
    if (!prim) continue;
    if (k < 8) H.push(bruch(Math.sqrt(n)));
    K.push(bruch(Math.cbrt(n))); k++;
  }
  const b = Array.from(new TextEncoder().encode(text)), bits = b.length * 8;
  b.push(0x80);
  while (b.length % 64 !== 56) b.push(0);
  for (let i = 7; i >= 0; i--) b.push(i >= 4 ? 0 : (bits >>> (i * 8)) & 0xff);
  const rot = function (x, n) { return (x >>> n) | (x << (32 - n)); };
  const W = new Array(64);
  for (let o = 0; o < b.length; o += 64) {
    for (let i = 0; i < 16; i++) W[i] = (b[o + 4 * i] << 24 | b[o + 4 * i + 1] << 16 | b[o + 4 * i + 2] << 8 | b[o + 4 * i + 3]) >>> 0;
    for (let i = 16; i < 64; i++) {
      const s0 = rot(W[i - 15], 7) ^ rot(W[i - 15], 18) ^ (W[i - 15] >>> 3), s1 = rot(W[i - 2], 17) ^ rot(W[i - 2], 19) ^ (W[i - 2] >>> 10);
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) >>> 0;
    }
    let [a, bb, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (rot(e, 6) ^ rot(e, 11) ^ rot(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + W[i]) >>> 0;
      const t2 = ((rot(a, 2) ^ rot(a, 13) ^ rot(a, 22)) + ((a & bb) ^ (a & c) ^ (bb & c))) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = bb; bb = a; a = (t1 + t2) >>> 0;
    }
    [a, bb, c, d, e, f, g, h].forEach(function (v, i) { H[i] = (H[i] + v) >>> 0; });
  }
  return H.map(function (v) { return v.toString(16).padStart(8, '0'); }).join('');
}
/* Feste Ableitung aus der vollständigen JID (SHA-256): steht für Werte, die Profanity einmal erzeugt und speichert
   (Ressource, Identitätsschlüssel, Geräte-ID); sie bleiben so über Neustarts gleich, ohne eigene Ablage. */
function terminalPppAbleitung(text, alphabet, laenge) {
  const hex = terminalPppSha256(text);
  let aus = '';
  for (let i = 0; i < laenge; i++) aus += alphabet[parseInt(hex.substr((i * 2) % 64, 2), 16) % alphabet.length];
  return aus;
}
// omemo_format_fingerprint: 64 Hex-Zeichen klein (Identitätsschlüssel ohne Typbyte), in Achtergruppen mit '-'.
function terminalPppFingerprint(jid) {
  return terminalPppSha256(jid + '/omemo-identity').match(/.{8}/g).join('-');
}
// Geräte-ID: 31 Bit, nicht 0 (libsignal registration id / OMEMO device id).
function terminalPppGeraet(jid) {
  return 1 + parseInt(terminalPppSha256(jid + '/omemo-device').slice(0, 8), 16) % 2147483646;
}
/* Fensternummer wie Profanity 0.18.2 (_wins_get_next_available_num): 1 bis 9, das zehnte Fenster 0 (Alt+0), danach 11.
   /win und der Konsolenhinweis (win N) verwenden diese Nummer; die Statuszeile zeigt das zehnte als 10 (true_win). */
function terminalPppFensterNr(i) { return i === 9 ? 0 : i + 1; }
/* XMPP-Daten im Profil (dauerhaft, wie bei Profanity in accounts und im OMEMO-Speicher):
   kontakt: Lokalteil des festen Kontakts, einmal erzeugt (mit vertrautem Fingerprint);
   omemo: OMEMO je Kontakt gemerkt (accounts_add_omemo_state, true nach /omemo start, false nach /omemo end);
   sitzungen: Kontakte mit aufgebauter OMEMO-Sitzung (session_store): "ready" erscheint nur beim ersten Aufbau;
   ausstehend: Nachrichten des Kontakts beim Server (XEP-0160), je { kontakt, text, zeit (Sendezeit), omemo }. */
function terminalXmppProfil() {
  if (!PROFIL.xmpp || typeof PROFIL.xmpp !== 'object') PROFIL.xmpp = {};
  const x = PROFIL.xmpp;
  const neu = typeof x.kontakt !== 'string' || !/^[a-z]{14}$/.test(x.kontakt);
  if (neu) x.kontakt = terminalKanalZeichen('abcdefghijklmnopqrstuvwxyz', 14);
  if (!x.omemo || typeof x.omemo !== 'object') x.omemo = {};
  if (!Array.isArray(x.sitzungen)) x.sitzungen = [];
  if (!Array.isArray(x.ausstehend)) x.ausstehend = [];
  // Ein neu erzeugter Kontakt wird sofort gespeichert, nicht erst mit dem nächsten Speichervorgang.
  if (neu) terminalXmppSpeichern();
  return x;
}
function terminalXmppSpeichern() { if (typeof profilSpeichern === 'function') profilSpeichern(); }
const TERMINAL_OMEMO_SITZUNGEN = {
  has: function (jid) { return terminalXmppProfil().sitzungen.includes(jid); },
  add: function (jid) { const x = terminalXmppProfil(); if (!x.sitzungen.includes(jid)) { x.sitzungen.push(jid); terminalXmppSpeichern(); } }
};
function terminalOmemoMerken(jid, an) { terminalXmppProfil().omemo[jid] = an; terminalXmppSpeichern(); }
// omemo_start_session: Bundle des Kontakts über den Link holen; "ready" nur, wenn dabei eine neue Sitzung entsteht.
function terminalPppOmemoAufbau(chat, fenster) {
  const t = TERMINAL_ZUSTAND, kontakt = fenster.kontakt;
  if (TERMINAL_OMEMO_SITZUNGEN.has(kontakt)) return;
  fenster.omemoAufbau = setTimeout(function () {
    fenster.omemoAufbau = null;
    if (t.kanal !== chat || chat.phase === 'offline' || !terminalSatLinkAktiv(chat.link)) return;
    TERMINAL_OMEMO_SITZUNGEN.add(kontakt);
    terminalPppChatLog(chat, 'OMEMO session with ' + kontakt + ' (device ' + terminalPppGeraet(kontakt) + ') ready.', fenster, { stumm: true, zeichen: '!' });
  }, 3000);
}
async function terminalPppChatMeldung(zeile, chat) {
  const t = TERMINAL_ZUSTAND;
  if (zeile === '/quit') { terminalPppChatAus(); return; }
  const fenster = terminalPppAktiv(chat);
  // /win N: Fenster wechseln, auch offline (der Verlauf bleibt lesbar).
  const win = /^\/win\s+(\d+)$/.exec(zeile);
  if (win) {
    const i = chat.fenster.findIndex(function (f, j) { return terminalPppFensterNr(j) === Number(win[1]); });
    if (i >= 0) terminalPppFensterWechsel(chat, i);
    else terminalPppChatLog(chat, 'Window ' + win[1] + ' does not exist.', chat.fenster[0], { stumm: true }); // cons_show: Konsole, Fenster bleibt
    return;
  }
  /* Ab hier wie Profanity 0.18.2 (cmd_funcs.c, _cmd_execute_default): jeder Befehl prüft die Verbindung selbst; ein
     unbekannter Befehl und Text in der Konsole ergeben "Unknown command: <Eingabe>" in der Konsole (cons_alert). */
  const verbunden = chat.phase === 'eingabe' && terminalSatLinkAktiv(chat.link);
  const konsole = chat.fenster[0], still = { stumm: true };
  if (zeile.startsWith('/') && !zeile.startsWith('//')) {
    const woerter = zeile.split(/\s+/), befehl = woerter[0].slice(1);
    if (befehl === 'msg') {
      // /msg <contact> [<message>]: Fenster öffnen oder wählen, eine Nachricht geht gleich hinaus.
      const m = /^\/msg\s+(\S+)(?:\s+(.+))?$/.exec(zeile);
      if (!m) { terminalPppFalscheNutzung(chat, fenster, 'msg'); return; }
      if (!verbunden) { terminalPppChatLog(chat, 'You are not currently connected.', konsole, still); return; }
      const ziel = m[1];
      const kontakt = ziel.endsWith('.onion') && !ziel.includes('@') ? chat.vorschlag.split('@')[0] + '@' + ziel : ziel;
      let i = chat.fenster.findIndex(function (f) { return f.kontakt === kontakt; });
      if (i < 0) {
        // chatwin_new: ist OMEMO für den Kontakt gemerkt (omemo.policy automatic), startet es still, ohne Hinweiszeile.
        const omemo = terminalXmppProfil().omemo[kontakt] === true;
        chat.fenster.push({ titel: kontakt, kontakt, log: [], neu: false, omemo });
        i = chat.fenster.length - 1;
        if (omemo) terminalPppOmemoAufbau(chat, chat.fenster[i]);
      }
      terminalPppFensterWechsel(chat, i);
      if (m[2]) terminalPppNachricht(chat, chat.fenster[i], m[2]);
      return;
    }
    if (befehl === 'omemo') {
      /* OMEMO wie cmd_omemo_start/end/fingerprint. Der Fingerprint des Kontakts gilt als bereits vertraut (frühere
         Prüfung); trustmode bleibt manual, eine Vertrauensabfrage entfällt damit. Meldungen ohne Statuszeilen-Hinweis
         (win_println, cons_show). Weitere Unterbefehle (gen, trust, untrust, …) bildet das Terminal nicht ab. */
      const unter = woerter.length === 2 ? woerter[1] : null;
      if (!['start', 'end', 'fingerprint'].includes(unter)) { terminalPppFalscheNutzung(chat, fenster, 'omemo'); return; }
      if (!verbunden) { terminalPppChatLog(chat, 'You must be connected with an account to load OMEMO information.', konsole, still); return; }
      const hinweis = { stumm: true, zeichen: '!' };
      if (unter === 'fingerprint') {
        if (!fenster.kontakt) {
          terminalPppChatLog(chat, 'Your OMEMO fingerprint: ' + terminalPppFingerprint(chat.account), fenster, still);
          terminalPppChatLog(chat, 'There is no known fingerprints for ' + chat.account, fenster, still);
        } else {
          terminalPppChatLog(chat, fenster.kontakt + "'s OMEMO fingerprint: " + terminalPppFingerprint(fenster.kontakt) + ' (trusted) (active)', fenster, still);
          terminalPppChatLog(chat, "You can trust it with '/omemo trust [<contact>] <fingerprint>'", fenster, still);
          terminalPppChatLog(chat, "You can untrust it with '/omemo untrust [<contact>] <fingerprint>'", fenster, still);
        }
      } else if (!fenster.kontakt) {
        terminalPppChatLog(chat, 'You must be in a regular chat window to start an OMEMO session.', fenster, still);
      } else if (unter === 'end') {
        if (!fenster.omemo) terminalPppChatLog(chat, 'You are not currently in an OMEMO session.', fenster, hinweis);
        else { fenster.omemo = false; clearTimeout(fenster.omemoAufbau); fenster.omemoAufbau = null; terminalOmemoMerken(fenster.kontakt, false); terminalPppAnzeige(); }
      } else if (fenster.omemo) {
        terminalPppChatLog(chat, 'You are already in an OMEMO session.', fenster, hinweis);
      } else {
        // is_omemo gilt sofort (Titel [OMEMO]); die Sitzung steht, sobald das Bundle des Kontakts über den Link da ist.
        const kontakt = fenster.kontakt;
        fenster.omemo = true;
        terminalOmemoMerken(kontakt, true);
        terminalPppChatLog(chat, 'Initiating OMEMO session with ' + kontakt + '...', fenster, hinweis);
        terminalPppOmemoAufbau(chat, fenster);
      }
      return;
    }
    if (befehl === 'sendfile') {
      const arg = zeile.slice(woerter[0].length).trim();
      if (!arg || !terminalName(arg)) { terminalPppFalscheNutzung(chat, fenster, 'sendfile'); return; }
      await terminalPppSendfile(chat, fenster, arg);
      return;
    }
    terminalPppChatLog(chat, 'Unknown command: ' + zeile, konsole);
    return;
  }
  // "//" am Anfang: als Nachricht senden, ein "/" fällt weg.
  const text = zeile.startsWith('//') ? zeile.slice(1) : zeile;
  if (!fenster.kontakt) { terminalPppChatLog(chat, 'Unknown command: ' + text, konsole); return; }
  if (!verbunden) { terminalPppChatLog(chat, 'You are not currently connected.', fenster, still); return; }
  terminalPppNachricht(chat, fenster, text);
}
// ui_invalid_command_usage: Leerzeile und Hinweis in der Konsole; steht man im Gespräch, dort zusätzlich der Hinweis.
function terminalPppFalscheNutzung(chat, fenster, befehl) {
  const text = "Invalid usage, see '/help " + befehl + "' for details.", still = { stumm: true };
  terminalPppChatLog(chat, '', chat.fenster[0], still);
  terminalPppChatLog(chat, text, chat.fenster[0], still);
  if (fenster.kontakt) terminalPppChatLog(chat, text, fenster, still);
}
/* Nachricht senden (cl_ev_send_msg). Im OMEMO-Gespräch ohne Bundle findet omemo_on_message_send keinen Schlüssel, die
   Nachricht geht nicht hinaus. Rückgabe: ob sie gesendet wurde. */
function terminalPppNachricht(chat, fenster, text) {
  const t = TERMINAL_ZUSTAND;
  if (fenster.omemo && !TERMINAL_OMEMO_SITZUNGEN.has(fenster.kontakt)) {
    const fehler = { stumm: true, zeichen: '!' };
    terminalPppChatLog(chat, 'This message cannot be encrypted for any recipient.', fenster, fehler);
    terminalPppChatLog(chat, 'It could also be that key bundles have not been received. Try "/omemo end", then "/omemo start".', fenster, fehler);
    return false;
  }
  const zeichen = fenster.omemo ? '~' : '-';
  terminalPppChatLog(chat, 'me: ' + text, fenster, { stumm: true, zeichen });
  if (/^auftrag (erledigt|gescheitert)\.?$/i.test(text)) {
    // Die Nachricht ist beim Server; der Kontakt antwortet nach 7 s, gleich ob wir dann noch verbunden sind. Die Antwort
    // hängt nicht am Fenster: jede Meldung erhält ihre eigene, auch über einen Verbindungsabbruch hinweg.
    const x = terminalXmppProfil();
    x.ausstehend.push({ kontakt: fenster.kontakt, text: 'Verstanden.', zeit: Date.now() + 7000, omemo: fenster.omemo });
    terminalXmppSpeichern();
    terminalXmppZustellungPlanen(chat);
  }
  return true;
}
/* Zustellung durch den Server: fällige Nachrichten gehen an eine verfügbare Sitzung (angemeldet, Link steht), sonst
   bleiben sie gespeichert (XEP-0160) und folgen nach der nächsten Anmeldung mit Verzögerungsvermerk (XEP-0203). */
const TERMINAL_XMPP_OFFLINE_MS = 500; // Zustellung gespeicherter Nachrichten nach der Anmeldung (angenommen)
function terminalXmppZustellungPlanen(chat, mindestens = 0) {
  const t = TERMINAL_ZUSTAND;
  clearTimeout(chat.zustellung);
  chat.zustellung = null;
  const offen = terminalXmppProfil().ausstehend;
  if (!offen.length || chat.phase !== 'eingabe') return;
  const naechste = Math.min.apply(null, offen.map(function (n) { return n.zeit; }));
  chat.zustellung = setTimeout(function () {
    chat.zustellung = null;
    if (t.kanal !== chat || chat.phase !== 'eingabe' || !terminalSatLinkAktiv(chat.link)) return;
    const x = terminalXmppProfil(), jetzt = Date.now();
    const faellig = x.ausstehend.filter(function (n) { return n.zeit <= jetzt; }).sort(function (a, b) { return a.zeit - b.zeit; });
    x.ausstehend = x.ausstehend.filter(function (n) { return n.zeit > jetzt; });
    terminalXmppSpeichern();
    faellig.forEach(function (n) { terminalXmppEingang(chat, n); });
    terminalXmppZustellungPlanen(chat);
  }, Math.max(mindestens, naechste - Date.now()));
}
/* sv_ev_incoming_message: ohne Fenster für den Kontakt öffnet chatwin_new eines (ohne Fokus; OMEMO still, falls gemerkt);
   die Zeile trägt die Sendezeit (stanza_get_oldest_delay); steht man nicht im Fenster, meldet die Konsole die Nachricht
   (console.chat = all, cons_alert). */
function terminalXmppEingang(chat, n) {
  let i = chat.fenster.findIndex(function (f) { return f.kontakt === n.kontakt; });
  if (i < 0) {
    const omemo = terminalXmppProfil().omemo[n.kontakt] === true;
    chat.fenster.push({ titel: n.kontakt, kontakt: n.kontakt, log: [], neu: false, omemo });
    i = chat.fenster.length - 1;
    if (omemo) terminalPppOmemoAufbau(chat, chat.fenster[i]);
  }
  terminalPppChatLog(chat, n.kontakt + ': ' + n.text, chat.fenster[i], { zeichen: n.omemo ? '~' : '-', zeit: n.zeit });
  if (i !== chat.aktiv) terminalPppChatLog(chat, '<< chat message: ' + n.kontakt + ' (win ' + terminalPppFensterNr(i) + ')');
}

/* Dateiversand wie Profanity 0.18.2. cmd_sendfile prüft der Reihe nach Datei, Verbindung und Fenster; im OMEMO-Gespräch
   wird die Datei vorher verschlüsselt (XEP-0454, AES-GCM, 16 Byte Tag). iq_http_upload_request holt beim Upload-Dienst
   einen Slot (XEP-0363). http_file_put lädt hoch und schreibt dabei eine Statuszeile ins Gesprächsfenster, die an
   derselben Stelle von "0%" bis "done" bzw. "failed: …" fortgeschrieben wird. Danach geht die URL als gewöhnliche
   Nachricht hinaus (cl_ev_send_msg); im OMEMO-Gespräch als aesgcm://…#IV+Schlüssel. Scheitert dieser Versand (OMEMO
   ohne Bundle), bleibt der Upload trotzdem "done": Upload und Nachricht sind zwei Schritte. */
const TERMINAL_UPLOAD_SLOT_MS = 2000; // Slot-Anfrage hin und zurück über Tor und die Funkstrecke (angenommen)
const TERMINAL_UPLOAD_GRENZE = 10 * 1024 * 1024; // Prosody mod_http_file_share, http_file_share_size_limit (Vorgabe)
const TERMINAL_UPLOAD_ABBRUCH = 'Failed sending data to the peer'; // curl_easy_strerror(CURLE_SEND_ERROR), angenommen
const TERMINAL_UPLOAD_DATEIFEHLER = ['Datei oder Ordner nicht gefunden', 'Permission denied', 'Datei nicht lesbar'];
function terminalPppZufallHex(bytes) {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)), function (b) { return b.toString(16).padStart(2, '0'); }).join('');
}
// Slot-Kennung im Pfad des Upload-Dienstes: Prosody hängt Slot und Dateiname an die Basis-URL; das Format der Kennung
// (hier 16 Zeichen base64url aus 12 Zufallsbytes) ist angenommen.
function terminalPppSlot() {
  return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(12)))).replace(/\+/g, '-').replace(/\//g, '_');
}
async function terminalPppSendfile(chat, fenster, arg) {
  const t = TERMINAL_ZUSTAND, konsole = chat.fenster[0], datei = terminalName(arg);
  const fehler = function (text) { terminalPppChatLog(chat, text, konsole); }; // cons_show_error
  const pfad = terminalArchivDateipfad(arg);
  if (!pfad?.length) { fehler("Uploading '" + datei + "' failed: File not found!"); return; }
  // chat.pruefung: Dateiprüfungen in Arbeit (Antwort der Brücke steht aus)
  let antwort;
  chat.pruefung = (chat.pruefung || 0) + 1;
  try { antwort = await terminalBruecke('send', pfad); } catch (e) { antwort = { error: TERMINAL_BRUECKE_FEHLER }; }
  finally { chat.pruefung--; }
  if (t.kanal !== chat) return;
  if (antwort.notfile) { fehler("Uploading '" + datei + "' failed: Not a file!"); return; }
  if (TERMINAL_UPLOAD_DATEIFEHLER.includes(antwort.error)) { fehler("Uploading '" + datei + "' failed: File not found!"); return; }
  // Ohne Brücke ist die Datei nicht lesbar; das ist ein Zustand des Terminals, kein Profanity-Text.
  if (antwort.error && antwort.error !== 'Datei zu groß') { terminalPppChatLog(chat, '/sendfile: ' + antwort.error, fenster); return; }
  if (chat.phase !== 'eingabe' || !terminalSatLinkAktiv(chat.link)) {
    terminalPppChatLog(chat, 'You are not currently connected.', konsole, { stumm: true }); // cons_show
    return;
  }
  if (!fenster.kontakt) { fehler('Unsupported window for file transmission.'); return; }
  const omemo = fenster.omemo, dienst = 'upload.' + chat.domain;
  const bytes = antwort.error ? Infinity : antwort.bytes + (omemo ? 16 : 0);
  const u = { fenster, datei, status: null, timer: null, bytes: Math.max(64, bytes), gesendet: 0, prozent: 0, omemo, name: antwort.name };
  (chat.uploads ||= []).push(u);
  u.timer = setTimeout(function () {
    u.timer = null;
    // Die Antwort auf die Slot-Anfrage kommt nur über einen stehenden Link (auch wenn dieser Zeitgeber vor dem Link-Takt läuft).
    if (!terminalSatLinkAktiv(chat.link)) return;
    if (bytes > TERMINAL_UPLOAD_GRENZE) {
      chat.uploads = chat.uploads.filter(function (x) { return x !== u; });
      fehler("Uploading '" + datei + "' failed for " + dienst + ': File too large');
      return;
    }
    u.status = terminalPppChatLog(chat, "Uploading '" + datei + "': 0%", fenster, { stumm: true, zeichen: '!', eintrag: true });
    terminalPppUploadTaktStarten(chat);
  }, TERMINAL_UPLOAD_SLOT_MS);
}
/* Gemeinsamer Upload-Takt je Chat (250 ms). Alle laufenden Uploads teilen sich die Funkrate (2400 bit/s): das Budget eines
   Takts wird gleichmäßig verteilt, was ein fast fertiger Upload nicht braucht, geht an die übrigen. Ohne Deckelung passen in
   einen Überflug von etwa zehn Minuten rechnerisch höchstens rund 176 KiB; reicht die Zeit nicht, bricht der Upload bei
   LINK END ab. Jeder Takt prüft zuerst selbst, ob der Link noch steht: ein Upload kann nach LINK END nicht mehr done werden,
   auch wenn dieser Takt vor dem Link-Takt läuft (terminalSatLinkAktiv löst dann den Abbruch aus). */
function terminalPppUploadTaktStarten(chat) {
  if (chat.uploadTakt) return;
  chat.uploadZuletzt = Date.now();
  chat.uploadTakt = setInterval(function () { terminalPppUploadSchritt(chat); }, 250);
}
function terminalPppUploadSchritt(chat) {
  if (TERMINAL_ZUSTAND.kanal !== chat || !terminalSatLinkAktiv(chat.link)) return;
  const jetzt = Date.now();
  let budget = (jetzt - chat.uploadZuletzt) * TERMINAL_SAT_RATE / 8000;
  chat.uploadZuletzt = jetzt;
  const laufend = chat.uploads.filter(function (u) { return u.status && u.gesendet < u.bytes; })
    .sort(function (a, b) { return (a.bytes - a.gesendet) - (b.bytes - b.gesendet); });
  laufend.forEach(function (u, i) {
    const anteil = Math.min(u.bytes - u.gesendet, budget / (laufend.length - i));
    u.gesendet += anteil;
    budget -= anteil;
  });
  // Ausgabe in der Reihenfolge, in der die Uploads begonnen haben
  chat.uploads.filter(function (u) { return laufend.includes(u); }).forEach(function (u) {
    const zeile = function (text) { terminalPppEintragSetzen(chat, u.status, "Uploading '" + u.datei + "'" + text); };
    if (u.gesendet < u.bytes - 1e-6) {
      const prozent = Math.floor(100 * u.gesendet / u.bytes);
      if (prozent !== u.prozent) { u.prozent = prozent; zeile(': ' + prozent + '%'); }
      return;
    }
    u.gesendet = u.bytes;
    chat.uploads = chat.uploads.filter(function (x) { return x !== u; });
    zeile(': done');
    // Basis-URL des Dienstes auf dem Onion-Host (https, XEP-0363); im OMEMO-Gespräch Schema aesgcm (format_alt_url).
    const url = (u.omemo ? 'aesgcm' : 'https') + '://' + chat.domain + '/file_share/' + terminalPppSlot() + '/' +
      encodeURIComponent(u.name) + (u.omemo ? '#' + terminalPppZufallHex(12 + 32) : '');
    terminalPppNachricht(chat, u.fenster, url);
  });
  if (!chat.uploads.some(function (u) { return u.status; })) { clearInterval(chat.uploadTakt); chat.uploadTakt = null; }
}
// Laufende Uploads und offene Slot-Anfragen anhalten (Abbruch, /quit); Rückgabe: die angehaltenen Uploads.
function terminalPppUploadsBeenden(chat) {
  const uploads = chat.uploads || [];
  uploads.forEach(function (u) { clearTimeout(u.timer); });
  clearInterval(chat.uploadTakt);
  chat.uploadTakt = null;
  chat.uploads = [];
  return uploads;
}
// http_file_put mit curl-Fehler: Statuszeile "failed: …" im Gesprächsfenster, dieselbe Meldung in der Konsole.
function terminalPppUploadFehler(chat, u, grund) {
  const text = "Uploading '" + u.datei + "' failed: " + grund;
  terminalPppEintragSetzen(chat, u.status, text);
  terminalPppChatLog(chat, text, chat.fenster[0]);
}

/* nmap: das installierte Nmap auf dem PC über die lokale Brücke (terminal_lokal.py). Die Argumente gehen unverändert an
   nmap (ohne Shell, Optionen nicht eingeschränkt); die Ausgabe (stdout und stderr in der Reihenfolge von Nmap) erscheint
   laufend, Strg+C beendet den Prozess, $? ist Nmaps Rückgabewert. Es scannt die echten Schnittstellen des PCs; ppp0 und
   wg-sat der Simulation spielen dafür keine Rolle. */
function terminalNmapText(lauf, text) {
  const teile = (lauf.rest + text).split('\n');
  lauf.rest = teile.pop();
  if (teile.length) terminalAusgabe(teile);
}
async function terminalNmap(args) {
  const t = TERMINAL_ZUSTAND;
  const start = await terminalBrueckeSenden({ op: 'nmap-start', args: args });
  if (start.missing) { terminalAusgabe('nmap: command not found'); return 127; }
  if (start.error) { terminalAusgabe(start.error); return 1; }
  const lauf = { job: start.job, rest: '', fertig: null };
  t.nmap = lauf;
  const ende = terminalVordergrund(lauf);
  (async function () {
    let von = 0;
    while (t.nmap === lauf) {
      const a = await terminalBrueckeSenden({ op: 'nmap-read', job: lauf.job, from: von });
      if (t.nmap !== lauf) return;
      if (a.error) { terminalAusgabe(a.error); t.nmap = null; terminalVordergrundEnde(lauf, 1); return; }
      von = a.next;
      if (a.out) terminalNmapText(lauf, a.out);
      if (a.done) {
        if (lauf.rest) terminalAusgabe(lauf.rest);
        t.nmap = null;
        terminalVordergrundEnde(lauf, a.code < 0 ? 128 - a.code : a.code);
        return;
      }
    }
  })();
  return ende;
}
// Abbruch (Strg+C: 130, SIGHUP: 129, Trennen): Prozess beenden, bereits gelieferte Ausgabe bleibt stehen.
function terminalNmapEnde(code) {
  const t = TERMINAL_ZUSTAND, lauf = t.nmap;
  if (!lauf) return;
  t.nmap = null;
  if (lauf.rest) terminalAusgabe(lauf.rest);
  void terminalBrueckeSenden({ op: 'nmap-stop', job: lauf.job });
  terminalVordergrundEnde(lauf, code);
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
  if (kette && TERMINAL_ZUSTAND.sudo) terminalSudoEnde('abbruch');
  if (kette && !kette.abgebrochen) { kette.abgebrochen = true; kette.code = code; }
}
function terminalStrgC() {
  const t = TERMINAL_ZUSTAND, input = $('profil-terminal-eingabe');
  if (t.orbitLive || terminalPppWaehltVorne()) { terminalKonsoleEscape(); return true; }
  if (t.kanal) return false;
  if (t.sudo) { terminalKetteAbbrechen(130); return true; }      /* Kennwortabfrage: kein ^C (kein Echo), nur der Zeilenumbruch */
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
    terminalPlogEnde(130);
    terminalNmapEnde(130);
    return true;
  }
  terminalTabReset();
  terminalAusgabe(terminalPrompt() + ' ' + (input?.value || '').replace(/\n/g, ' ') + '^C');
  if (input) terminalEingabeSetzen(input, '');
  t.vpos = -1;
  t.status = 130;
  return true;
}
/* tmux (Ausschnitt, tmux(1)): Sitzung mit Statuszeile; split-window legt Bereiche oberhalb der Shell an (bis zu zwei:
   predict und plog -f), Fokuswechsel mit Strg+B und Pfeiltaste (select-pane -U/-D, ohne Umlauf) oder o (nächster Bereich),
   kill-pane auf {up-of}, {top} oder {last}. Die Shell unten bleibt mit Eingabe, Verlauf, Tab und $? bedienbar.
   Endet das Programm eines Bereichs, schließt tmux ihn (remain-on-exit ist aus). */
const TERMINAL_TMUX_BEREICHE = 2;
function terminalTmuxStatus() {
  const feld = $('profil-terminal-tmux'), t = TERMINAL_ZUSTAND;
  if (!feld) return;
  feld.hidden = !t.tmux;
  if (!t.tmux) return;
  const jetzt = new Date(), z = function (n) { return String(n).padStart(2, '0'); };
  const mon = new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'UTC' }).format(jetzt);
  // automatic-rename: der Fenstername ist das laufende Programm des aktiven Bereichs (plog ist ein sh-Skript).
  const aktiv = t.tmux.fokus === 'oben' ? t.tmux.aktiv : null;
  const name = !aktiv ? 'bash' : aktiv.art === 'plog' ? 'sh' : 'predict';
  feld.textContent = '[0] 0:' + name + '*' + ' '.repeat(6) +
    '"terminal" ' + z(jetzt.getUTCHours()) + ':' + z(jetzt.getUTCMinutes()) + ' ' + z(jetzt.getUTCDate()) + '-' + mon + '-' + String(jetzt.getUTCFullYear()).slice(2);
}
function terminalTmuxBereichText(bereich) {
  if (bereich.art === 'predict') return terminalPredictLive(Date.now());
  return bereich.zeilen.join('\n');
}
function terminalTmuxPaneAnzeige() {
  const t = TERMINAL_ZUSTAND, kern = $('profil-terminal-kern'), ausgabe = $('profil-terminal-ausgabe');
  const bereiche = t.tmux?.panes || [], oben = !!t.tmux && t.tmux.fokus === 'oben';
  if (kern && ausgabe) {
    // Erst die Aufteilung (ein oder zwei Bereiche) setzen, dann messen: sonst gilt die Kürzung für die alte Höhe.
    kern.classList.toggle('tmux-zwei', bereiche.length > 1);
    kern.querySelectorAll('.tmux-pane').forEach(function (el) { if (!bereiche.some(function (b) { return b.el === el; })) el.remove(); });
    bereiche.forEach(function (b) {
      if (!b.el) b.el = h('pre', { class: 'tmux-pane mono', 'aria-label': 'tmux: ' + b.art,
        onpointerdown: function (ev) { ev.preventDefault(); terminalTmuxFokusAuf(b); } });
      if (b.el.nextElementSibling !== (bereiche[bereiche.indexOf(b) + 1]?.el || ausgabe)) kern.insertBefore(b.el, bereiche[bereiche.indexOf(b) + 1]?.el || ausgabe);
      b.el.classList.toggle('aktiv', oben && t.tmux.aktiv === b);
      if (b.art === 'plog') {
        const text = terminalTmuxBereichText(b);
        // Wie tail im Terminal: die letzten ganzen Zeilen, die in den Bereich passen; gemessen mit vollem Text.
        if (b.el.textContent !== text) b.el.textContent = text;
        if (b.el.scrollHeight > b.el.clientHeight) {
          const st = getComputedStyle(b.el), hoehe = b.el.clientHeight - parseFloat(st.paddingTop) - parseFloat(st.paddingBottom);
          // Schätzung nach Zeilenhöhe, dann so lange kürzen, bis auch umbrochene Zeilen ganz hineinpassen.
          let k = Math.max(1, Math.floor(hoehe / parseFloat(st.lineHeight)));
          b.el.textContent = b.zeilen.slice(-k).join('\n');
          while (k > 1 && b.el.scrollHeight > b.el.clientHeight) b.el.textContent = b.zeilen.slice(-(--k)).join('\n');
        }
      } else terminalPredictSetzen(b.el, terminalZeitstand());
    });
  }
  const input = $('profil-terminal-eingabe');
  if (input) input.readOnly = oben;
  kern?.classList.toggle('tmux-oben', oben);
  terminalTmuxStatus();
}
function terminalTmuxPaneSchliessen(bereich) {
  const t = TERMINAL_ZUSTAND, panes = t.tmux?.panes;
  if (!panes || !panes.includes(bereich)) return false;
  clearInterval(bereich.timer);
  panes.splice(panes.indexOf(bereich), 1);
  if (t.tmux.letzter === bereich) t.tmux.letzter = null;
  // Schließt der aktive Bereich, geht der Fokus an die Shell.
  if (t.tmux.aktiv === bereich) { t.tmux.aktiv = null; t.tmux.fokus = 'unten'; }
  terminalTmuxPaneAnzeige();
  return true;
}
function terminalTmuxEnde() {
  const t = TERMINAL_ZUSTAND;
  if (!t.tmux) return;
  t.tmux.panes.slice().forEach(terminalTmuxPaneSchliessen);
  t.tmux = null;
  terminalTmuxPaneAnzeige();
}
// Fokus auf einen oberen Bereich oder (null) auf die Shell; der vorherige wird für {last} gemerkt.
function terminalTmuxFokusAuf(bereich) {
  const t = TERMINAL_ZUSTAND;
  if (!t.tmux || (bereich && !t.tmux.panes.includes(bereich))) return;
  const vorher = t.tmux.fokus === 'oben' ? t.tmux.aktiv : 'shell';
  t.tmux.aktiv = bereich || null;
  t.tmux.fokus = bereich ? 'oben' : 'unten';
  if (vorher !== (bereich || 'shell')) t.tmux.letzter = vorher;
  terminalTabReset();
  terminalTmuxPaneAnzeige();
  // Der Tastaturfokus bleibt im Eingabefeld; unten ist es wieder beschreibbar.
  $('profil-terminal-eingabe')?.focus();
}
// select-pane -U / -D (ohne Umlauf) und -t :.+ (nächster Bereich, mit Umlauf); Reihenfolge von oben nach unten, die Shell zuletzt.
function terminalTmuxWechsel(richtung) {
  const t = TERMINAL_ZUSTAND;
  if (!t.tmux?.panes.length) return;
  const folge = t.tmux.panes.concat(null), jetzt = folge.indexOf(t.tmux.fokus === 'oben' ? t.tmux.aktiv : null);
  const ziel = richtung === 'hoch' ? Math.max(0, jetzt - 1) : richtung === 'runter' ? Math.min(folge.length - 1, jetzt + 1) : (jetzt + 1) % folge.length;
  terminalTmuxFokusAuf(folge[ziel]);
}
// Neue plog-Zeile für Bereiche, in denen plog -f läuft.
function terminalTmuxPlogZeile(zeile) {
  const bereiche = TERMINAL_ZUSTAND.tmux?.panes.filter(function (b) { return b.art === 'plog'; }) || [];
  if (!bereiche.length || !TERMINAL_PLOG_GREP.test(zeile)) return;
  bereiche.forEach(function (b) { b.zeilen = b.zeilen.concat(zeile).slice(-200); });
  terminalTmuxPaneAnzeige();
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
    t.tmux = { panes: [], fokus: 'unten', aktiv: null, letzter: null };
    terminalTmuxPaneAnzeige();
    return 0;
  }
  if (!t.tmux) { terminalAusgabe('no server running on /tmp/tmux-' + TERMINAL_UID + '/default'); return 1; }
  if (unter === 'kill-server') { terminalTmuxEnde(); terminalAusgabe('[server exited]'); return 0; }
  if (unter === 'kill-pane' || unter === 'killp') {
    const i = args.indexOf('-t'), ziel = i >= 0 ? args[i + 1] : undefined;
    // Ohne Ziel trifft kill-pane das aktive Fenster: von der Shell aus endet vereinfacht die Sitzung wie bei exit.
    // kill-pane wird hier immer aus der Shell aufgerufen; {up-of} ist der Bereich direkt über ihr.
    if (ziel === undefined) { terminalTmuxEnde(); terminalAusgabe('[exited]'); return 0; }
    const panes = t.tmux.panes;
    const treffer = ziel === '{up-of}' ? panes.at(-1) : ziel === '{top}' ? panes[0] : ziel === '{last}' ? (t.tmux.letzter === 'shell' ? undefined : t.tmux.letzter) : undefined;
    if (!['{up-of}', '{top}', '{last}'].includes(ziel) || !treffer) { terminalAusgabe("can't find pane: " + ziel); return 1; }
    terminalTmuxPaneSchliessen(treffer);
    return 0;
  }
  // split-window [-b] [-d] [-v] [Befehl ...]
  let i = 1, davor = false, bleiben = false;
  for (; i < args.length && /^-[bdvh]+$/.test(args[i]); i++) {
    if (args[i].includes('h')) { terminalAusgabe('split-window: -h is not supported in this terminal'); return 1; }
    davor = davor || args[i].includes('b'); bleiben = bleiben || args[i].includes('d');
  }
  if (i < args.length && /^-/.test(args[i])) { terminalAusgabe('split-window: unknown option -- ' + args[i].slice(1, 2)); return 1; }
  if (t.tmux.panes.length >= TERMINAL_TMUX_BEREICHE) { terminalAusgabe('create pane failed: pane too small'); return 1; }
  const befehl = args.slice(i);
  // Im neuen Bereich laufen nur Programme, die nicht sofort enden: die Verfolgung von predict und plog -f.
  // Alle anderen enden sofort, ihr Bereich schließt sich wieder.
  let bereich = null;
  if (befehl[0] === 'predict') {
    const o = terminalPredictOptionen(befehl.slice(1));
    if (o && !o.fehler && o.modus === 'live') bereich = { art: 'predict', timer: setInterval(terminalTakt, 250) };
  } else if (befehl[0] === 'plog') {
    const opt = terminalPlogTail(befehl.slice(1));
    if (!opt.fehler && opt.folgen) {
      const zeilen = [];
      opt.dateien.forEach(function (name) {
        const d = terminalPlogDatei(name);
        if (d.fehler) { zeilen.push(d.fehler); return; }
        const teil = opt.n.vonAnfang ? d.zeilen.slice(Math.max(0, opt.n.n - 1)) : opt.n.n ? d.zeilen.slice(-opt.n.n) : [];
        zeilen.push(...teil.filter(function (z) { return TERMINAL_PLOG_GREP.test(z); }));
      });
      bereich = { art: 'plog', zeilen };
    }
  }
  if (!bereich) return 0;
  // -b: oberhalb des aktiven Bereichs, sonst darunter; ist die Shell aktiv, steht der neue Bereich direkt über ihr.
  const panes = t.tmux.panes, aktiv = t.tmux.fokus === 'oben' ? panes.indexOf(t.tmux.aktiv) : -1;
  panes.splice(aktiv < 0 ? panes.length : davor ? aktiv : aktiv + 1, 0, bereich);
  if (bleiben) terminalTmuxPaneAnzeige(); else terminalTmuxFokusAuf(bereich);
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
async function terminalDateiAusfuehren(befehl, arg, args) {
  const t = TERMINAL_ZUSTAND;
  if (t.dateiLaeuft) { terminalAusgabe('Datenbankanfrage läuft bereits'); return 1; }
  t.dateiLaeuft = true;
  const version = t.version;
  try {
    const fn = befehl === 'cd' ? terminalBefehlCd : befehl === 'ls' ? terminalBefehlLs : null;
    return fn ? await terminalBefehlLauf(fn, args || [], arg, version) : await terminalDateiBefehl(befehl, arg, version);
  } catch (e) {
    if (t.version === version) terminalAusgabe('Dateioperation fehlgeschlagen');
    return 1;
  } finally { t.dateiLaeuft = false; }
}
/* map und open: Navigation der Oberfläche nach Kennung oder lesbarem Namen. Zugang wie in der Oberfläche
   über zielZugang (index.html): manuell
   gesperrte Ziele verweigert (Permission denied), die Missionsfreigabe zeigt die bestehende Ansicht "Zugriff beschränkt".
   Wortlaut der Meldungen nach dem Muster der Dateibefehle (Simulationsentscheidung). Nach dem Sprung wird das Terminal
   minimiert; Shell, pppd, Profanity und tmux laufen weiter (das Fenster liegt außerhalb der beim Modulwechsel ersetzten Oberfläche). */
const TERMINAL_KENNUNG_DOSSIER = /^[POL]-\d{4}$/, TERMINAL_KENNUNG_PIN = /^PIN-\d{3,}$/,
  TERMINAL_KENNUNG_ZONE = /^ZO-\d{3,15}$/;
/* Auflösung einer direkten Namenseingabe. Nur im UI lesbare Ziele werden angeboten:
   manuell gesperrte Pins/Dossiers bleiben ausschließlich über ihre Kennung erreichbar.
   Die Namensauflösung arbeitet exakt oder mit eindeutigem Namensanfang, nie als unscharfe
   Suche im Hintergrund. Für Teilstrings bleibt "map pins <query>" zuständig. */
/* Temporärer Namensschutz bis zur Entfernung der alten Missionsfreigaben.
   Direkte Kennungsnavigation bleibt von diesem Filter unberührt. */
function terminalDossierNameLesbar(e) {
  /* Die manuelle Sperre bleibt; historische Ansprechpartnerstatuswerte steuern
     die aktuelle Recherche- und Namensnavigation nicht mehr. */
  return !!e && !dossierGesperrt(e);
}
function terminalZielNamen(befehl, text) {
  const q = terminalPinSuchtext(text).replace(/\s+/g, ' ').trim();
  if (!q) return [];
  const namen = [], verborgen = [];
  (PROFIL.pins || []).forEach(function (p) {
    if (!p || !p.id || !p.name) return;
    const ziel = { id: p.id, name: p.name, suchnamen: [p.name] };
    (pinGesperrt(p) ? verborgen : namen).push(ziel);
  });
  (PROFIL.zonen || []).forEach(function (z) {
    if (!z || !z.id || !z.name) return;
    const ziel = { id: z.id, name: z.name, suchnamen: [z.name] };
    (zoneGesperrt(z) ? verborgen : namen).push(ziel);
  });
  if (befehl === 'open') dossierRechercheBestand().forEach(function (e) {
    const alias = Array.isArray(e.aliase) ? e.aliase : [];
    const ziel = { id: e.id, name: e.name, suchnamen: [e.name].concat(alias) };
    (terminalDossierNameLesbar(e) ? namen : verborgen).push(ziel);
  });
  const norm = function (n) { return terminalPinSuchtext(n).replace(/\s+/g, ' ').trim(); };
  const exakt = namen.filter(function (n) { return n.suchnamen.some(function (x) { return norm(x) === q; }); });
  /* Geschützte exakte Namen dürfen nicht still auf einen längeren
     sichtbaren Präfixtreffer umgeleitet werden. */
  if (!exakt.length && verborgen.some(function (n) {
    return n.suchnamen.some(function (x) { return norm(x) === q; });
  })) return [];
  const passend = exakt.length ? exakt : namen.filter(function (n) {
    return n.suchnamen.some(function (x) { return norm(x).startsWith(q); });
  });
  return passend.sort(function (a, b) { return a.id.localeCompare(b.id, undefined, { numeric: true }); });
}
function terminalZiel(befehl, eingabe) {
  const text = String(eingabe || '').trim();
  if (TERMINAL_KENNUNG_DOSSIER.test(text) || TERMINAL_KENNUNG_PIN.test(text) || TERMINAL_KENNUNG_ZONE.test(text)) {
    const ziel = zielZugang(text);
    if (!ziel || (befehl === 'map' && ziel.art !== 'pin' && ziel.art !== 'zone'))
      terminalAusgabe(befehl + ': ' + text + ': No such file or directory');
    return ziel && (befehl !== 'map' || ziel.art === 'pin' || ziel.art === 'zone') ? ziel : null;
  }
  const treffer = terminalZielNamen(befehl, text);
  if (treffer.length > 1) {
    terminalAusgabe(befehl + ': ' + text + ': ambiguous name (' + treffer.length + ' matches)');
    terminalAusgabe(treffer.slice(0, 12).map(function (z) { return '  ' + z.id + '  ' + z.name; }));
    if (treffer.length > 12) terminalAusgabe('  ... ' + (treffer.length - 12) + ' more');
    return null;
  }
  const ziel = treffer.length === 1 ? zielZugang(treffer[0].id) : null;
  if (!ziel) terminalAusgabe(befehl + ': ' + text + ': No such file or directory');
  return ziel;
}
function terminalNachNavigation() {
  const fenster = $('profil-terminal');
  if (fenster && !fenster.classList.contains('minimiert')) $('profil-terminal-minimieren')?.click();
}
/* Pin auf der Karte zeigen. Zeichnet die Karte statt des Pins seine Sichtung (karteMarker), wird die Sichtung gewählt wie mit
   "Sichtung auf der Karte" im Dossier; deren Fenster enthält das Formular des Pins. */
function terminalPinZeigen(px) {
  const si = px.sichtung && px.dossier && typeof pinSichtung === 'function' ? pinSichtung(px) : null;
  const ueberSichtung = si && karteMarker().some(function (m) { return m.kat === 'sichtung' && m.entId === px.dossier && m.id === si.id; });
  if (!ueberSichtung) {           /* kartenObjektZeigen wählt und zentriert, öffnet das Fenster aber nicht */
    if (!kartenObjektZeigen(px.id)) return false;
    karteAuswahlAnzeige();
    return true;
  }
  const K = VIEW.karte;
  K.pick = null; K.reiter = 'karte'; K.sichtungFokus = si.id; K.zoom = Math.max(K.zoom, 15); K.init = true;
  dispatch({ type: 'NAVIGATION', modul: 'karte' });
  renderModule();
  karteWaehlen(si.id, true);
  return true;
}
/* Nach einer neuen manuellen Sperre dürfen offene Tab-Listen und bereits sichtbare Terminaltexte
   keine zuvor angezeigten Namen geschützter Pins behalten. */
function terminalPinSperreAktualisieren() {
  if (typeof terminalTabReset === 'function') terminalTabReset();
  const t = TERMINAL_ZUSTAND;
  if (t) {
    t.vorschlagErgaenzung = null;
    /* Die Shell-Historie darf einen zuvor benutzten Namenssuchbegriff nach dem Sperren
       nicht erneut als grauen Vorschlag oder über Pfeil-hoch offenlegen. Kennungen bleiben. */
    const pinNamen = (PROFIL.pins || []).filter(pinGesperrt).map(function (p) { return p.name; });
    const dossierNamen = dossierRechercheBestand().filter(dossierGesperrt).flatMap(function (e) {
      return [e.name].concat(Array.isArray(e.aliase) ? e.aliase : []);
    });
    const zonenNamen = (PROFIL.zonen || []).filter(function (z) {
      return z.dossier && (PROFIL.gesperrt || []).includes(z.dossier);
    }).map(function (z) { return z.name; });
    const gesperrte = pinNamen.concat(zonenNamen, dossierNamen).map(terminalPinSuchtext).filter(function (name) { return name.length >= 3; });
    t.verlauf = t.verlauf.filter(function (zeile) {
      const norm = terminalPinSuchtext(zeile);
      if (gesperrte.some(function (name) { return norm.includes(name); })) return false;
      const m = /^(?:sudo\s+)?(?:map|open)\s+(?:(?:pins|zones)\s+)?(.+)$/i.exec(zeile.trim());
      if (!m) return true;
      const query = terminalPinSuchtext(m[1]).replace(/^['"]|['"]$/g, '');
      if (/^(?:pin-\d+|[pol]-\d+)$/.test(query) || query.length < 3) return true;
      return !gesperrte.some(function (name) { return name.includes(query) || query.includes(name); });
    });
    t.vpos = -1;
    t.entwurf = '';
    /* Bereits angezeigte Archivtexte müssen bei einer nachträglichen Sperre vollständig verschwinden */
    terminalSchutzBereinigen();
  }
  const fenster = $('profil-terminal');
  const ausgabe = $('profil-terminal-ausgabe');
  if (ausgabe && t && typeof sperreText === 'function') ausgabe.textContent = t.ausgabe.map(sperreText).join('\n');
  if (fenster && typeof sperreMaskieren === 'function') sperreMaskieren(fenster);
}
/* Live-Suche in den persistenten Profil-Pins, unabhängig von Kartenebene und gezeichneten Markern.
   Bei gesperrten Dossiers sind ausschließlich Pin-Kennungen auffindbar; Namen und Zwecke bleiben unzugänglich. */
function terminalPinSuchtext(text) {
  return String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}
function terminalPinTreffer(suche = '') {
  const q = terminalPinSuchtext(suche.trim());
  return (PROFIL.pins || []).filter(function (p) {
    if (!p || !p.id) return false;
    if (!q) return true;
    if (terminalPinSuchtext(p.id).includes(q)) return true;
    if (pinGesperrt(p)) return false;
    return terminalPinSuchtext([p.name].concat(p.zwecke || []).join(' ')).includes(q);
  }).slice().sort(function (a, b) { return a.id.localeCompare(b.id, undefined, { numeric: true }); });
}
function terminalPinListe(args) {
  const suche = args.join(' ').trim(), treffer = terminalPinTreffer(suche);
  if (!treffer.length) {
    terminalAusgabe(suche ? 'map: pins: No matches for ' + suche : 'map: pins: No pins found');
    return suche ? 1 : 0;
  }
  terminalAusgabe(treffer.map(function (p) {
    return p.id + '  ' + (pinGesperrt(p) ? '[LOCKED]' : p.name || p.id);
  }));
  return 0;
}
/* Eigene Profilzonen besitzen separate Kennungen (ZO-nnn) und werden niemals als Pins gelistet. */
function terminalZoneTreffer(suche = '') {
  const q = terminalPinSuchtext(suche.trim());
  return (PROFIL.zonen || []).filter(function (z) {
    if (!z || !TERMINAL_KENNUNG_ZONE.test(z.id)) return false;
    if (!q || terminalPinSuchtext(z.id).includes(q)) return true;
    if (zoneGesperrt(z)) return false;
    return terminalPinSuchtext(z.name).includes(q);
  }).slice().sort(function (a, b) { return a.id.localeCompare(b.id, undefined, { numeric: true }); });
}
function terminalZoneListe(args) {
  const suche = args.join(' ').trim(), treffer = terminalZoneTreffer(suche);
  if (!treffer.length) {
    terminalAusgabe(suche ? 'map: zones: No matches for ' + suche : 'map: zones: No zones found');
    return suche ? 1 : 0;
  }
  terminalAusgabe(treffer.map(function (z) {
    return z.id + '  ' + (zoneGesperrt(z) ? '[LOCKED]' : z.name || z.id);
  }));
  return 0;
}
/* Einmalige Tab-Quelle für map/open und deren sudo-Varianten. Namensvorschläge setzen beim Übernehmen
   immer die stabile Pin-Kennung ein. Gesperrte Pins tragen hier nie den Namen als Kandidat. */
function terminalPinTab(befehl, arg, kopf, fertig) {
  if (befehl === 'open' && /^export(?:\s|$)/i.test(arg)) {
    const m = /^export\s+(.*)$/i.exec(arg);
    if (!m) { fertig(kopf, arg, ['export'], function () { return 'export '; }); return; }
    terminalVaultTab(befehl, m[1], kopf + 'export ', fertig);
    return;
  }
  if (befehl === 'map' && /^(pins|zones)(?:\s|$)/i.test(arg)) {
    const m = /^(pins|zones)\s+(.*)$/i.exec(arg);
    const art = m ? m[1].toLowerCase() : arg.toLowerCase();
    if (!m) { fertig(kopf, arg, [art], function () { return art + ' '; }); return; }
    const liste = art === 'zones' ? terminalZoneTreffer() : terminalPinTreffer();
    const prefix = m[2];
    const namen = liste.map(function (x) {
      return (art === 'zones' ? zoneGesperrt(x) : pinGesperrt(x)) ? x.id : (x.name || x.id);
    });
    fertig(kopf + art + ' ', prefix, namen, function (x) { return /\s/.test(x) ? '"' + x.replace(/"/g, '') + '"' : x; });
    return;
  }
  const pins = terminalPinTreffer(), zonen = terminalZoneTreffer();
  const kennungen = pins.map(function (p) { return p.id; }).concat(zonen.map(function (z) { return z.id; }));
  const namen = pins.filter(function (p) { return !pinGesperrt(p) && p.name; })
    .map(function (p) { return p.name + ' [' + p.id + ']'; })
    .concat(zonen.filter(function (z) { return !zoneGesperrt(z) && z.name; })
      .map(function (z) { return z.name + ' [' + z.id + ']'; }));
  const lesbareDossiers = befehl === 'open' ? dossierRechercheBestand() : [];
  const dossiers = lesbareDossiers.map(function (e) { return e.id; });
  const dossierNamen = lesbareDossiers.filter(terminalDossierNameLesbar).flatMap(function (e) {
    return [e.name].concat(Array.isArray(e.aliase) ? e.aliase : []).filter(Boolean)
      .map(function (n) { return n + ' [' + e.id + ']'; });
  });
  const kandidaten = (befehl === 'map' ? ['pins', 'zones'] : []).concat(kennungen, dossiers, namen, dossierNamen);
  fertig(kopf, arg, kandidaten, function (x) {
    const ref = / \[(PIN-\d{3,}|ZO-\d{3,15}|[POL]-\d{4})\]$/.exec(x);
    return (ref ? ref[1] : x) + (x === 'pins' || x === 'zones' ? ' ' : '');
  });
}

/* VAULT ist die simulierte Katalogschicht der Shell. Die Daten stammen weiterhin nur aus der
   zugriffsbeschränkten lokalen Archivbrücke; keine Dateipfade, Ports oder Host-Adressen in der UI.
   Der technische Speicherweg bleibt ausschließlich in der Entwicklerdokumentation sichtbar. */
const TERMINAL_VAULT_MUSTER = [
  { art: 'pin', re: /^lageblatt-(PIN-\d{3,15})(?:-v(\d{1,2}))?\.txt$/ },
  { art: 'zone', re: /^zone-(ZO-\d{3,15})(?:-v(\d{1,2}))?\.txt$/ }
];
function terminalVaultObjekte() {
  return (PROFIL.pins || []).filter(function (p) { return p && p.id; }).map(function (p) {
    return { id: p.id, name: p.name || p.id, art: 'pin', objekt: p, gesperrt: pinGesperrt(p) };
  }).concat((PROFIL.zonen || []).filter(function (z) { return z && z.id && /^ZO-\d{3,15}$/.test(z.id); }).map(function (z) {
    return { id: z.id, name: z.name || z.id, art: 'zone', objekt: z, gesperrt: zoneGesperrt(z) };
  }));
}
function terminalVaultFinden(text, bestand, praefix) {
  const q = terminalPinSuchtext(text).replace(/\s+/g, ' ').trim();
  if (!q) return praefix ? bestand : [];
  const sichtbar = bestand.filter(function (x) {
    return terminalPinSuchtext(x.id) === q || (!x.gesperrt && terminalPinSuchtext(x.name) === q);
  });
  if (praefix && sichtbar.length) return sichtbar;
  const passende = bestand.filter(function (x) {
    const id = terminalPinSuchtext(x.id), name = x.gesperrt ? '' : terminalPinSuchtext(x.name);
    return praefix ? id.startsWith(q) || name.startsWith(q) : id.includes(q) || name.includes(q);
  });
  return passende;
}
function terminalVaultZuordnung(basis) {
  const pin = terminalVaultObjekte();
  return pin.find(function (x) { return x.id === basis; }) || null;
}
async function terminalVaultKatalog() {
  if (!terminalBrueckenAdresse()) return { error: 'VAULT: INDEX LINK UNAVAILABLE' };
  const sammlung = [];
  for (const ordner of ['ops', 'dokumente']) {
    const antwort = await terminalBrueckeLsAlle([ordner], false);
    if (antwort.error || !Array.isArray(antwort.entries)) return { error: 'VAULT: INDEX LINK UNAVAILABLE' };
    for (const e of antwort.entries) {
      if (!e || e.dir || typeof e.name !== 'string') continue;
      const muster = TERMINAL_VAULT_MUSTER.find(function (m) { return m.re.test(e.name); });
      if (!muster) continue;
      const teile = muster.re.exec(e.name);
      const zuordnung = terminalVaultZuordnung(teile[1]);
      if (!zuordnung || zuordnung.art !== muster.art) continue;
      const letzter = (PROFIL.exporte || {})[muster.art + ':' + zuordnung.id + ':' + ordner];
      sammlung.push({ ...zuordnung, ordner, dateiname: e.name, revision: Number(teile[2] || 1),
        registriert: !!(letzter && letzter.name === e.name && letzter.sha),
        mtime: Number(e.mtime) || 0, bytes: Number(e.bytes) || 0 });
    }
  }
  sammlung.sort(function (a, b) {
    return Number(b.registriert) - Number(a.registriert) ||
      b.mtime - a.mtime || b.revision - a.revision || a.ordner.localeCompare(b.ordner);
  });
  return { records: sammlung };
}
function terminalVaultEintraege(records) {
  const gruppen = new Map();
  records.forEach(function (r) {
    if (!gruppen.has(r.id)) gruppen.set(r.id, []);
    gruppen.get(r.id).push(r);
  });
  return [...gruppen.values()].sort(function (a, b) {
    return a[0].id.localeCompare(b[0].id, undefined, { numeric: true });
  });
}
async function terminalVaultListe(args) {
  const suchtext = args.join(' ').trim(), katalog = await terminalVaultKatalog();
  if (katalog.error) { terminalAusgabe(katalog.error); return 1; }
  const eintraege = terminalVaultEintraege(katalog.records).filter(function (gruppe) {
    return !suchtext || terminalVaultFinden(suchtext, [gruppe[0]], false).length;
  });
  terminalAusgabe('VAULT :: RECORD INDEX');
  if (!eintraege.length) {
    terminalAusgabe(suchtext ? 'No indexed records matching query' : 'Index empty');
    return suchtext ? 1 : 0;
  }
  terminalAusgabe(eintraege.map(function (gruppe) {
    const p = gruppe[0];
    return p.id + '  ' + (p.gesperrt ? '[LOCKED]' : p.name) +
      (p.gesperrt ? '' : '  [RECORDS ' + gruppe.length + ']');
  }));
  terminalAusgabe('INDEX :: ' + eintraege.length + ' OBJECTS');
  return 0;
}
function terminalVaultAufloesen(text) {
  const alle = terminalVaultObjekte();
  const genau = terminalVaultFinden(text, alle, true);
  return genau;
}
function terminalVaultTab(befehl, arg, kopf, fertig) {
  const eintraege = terminalVaultObjekte(), werte = eintraege.map(function (e) { return e.id; })
    .concat(eintraege.filter(function (e) { return !e.gesperrt; }).map(function (e) { return e.name + ' [' + e.id + ']'; }));
  fertig(kopf, arg, werte, function (s) {
    const m = / \[((?:PIN|ZO)-\d{3,15})\]$/.exec(s);
    return m ? m[1] : s;
  });
}
async function terminalVaultHash(text) {
  if (typeof crypto === 'undefined' || !crypto.subtle || typeof TextEncoder === 'undefined') return null;
  try {
    const data = new TextEncoder().encode(text);
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
    return [...digest].map(function (n) { return n.toString(16).padStart(2, '0'); }).join('');
  } catch (_) { return null; }
}
async function terminalVaultOeffnen(args, sudo = false) {
  const suchtext = args.join(' ').trim();
  if (!suchtext) return terminalUsage('open export <name|PIN-nnn|ZO-nnn>');
  const kandidaten = terminalVaultAufloesen(suchtext);
  if (!kandidaten.length) { terminalAusgabe('VAULT: record not found'); return 1; }
  if (kandidaten.length > 1) {
    terminalAusgabe('VAULT: ambiguous name (' + kandidaten.length + ' matches)');
    terminalAusgabe(kandidaten.slice(0, 12).map(function (p) {
      return '  ' + p.id + '  ' + (p.gesperrt ? '[LOCKED]' : p.name);
    }));
    return 1;
  }
  let objekt = kandidaten[0];
  if (objekt.gesperrt) {
    if (!sudo) { terminalAusgabe('VAULT: ' + objekt.id + ': Permission denied'); return 1; }
    const ok = await terminalSudoKennwort();
    if (ok !== true) return ok === 'abbruch' ? 130 : 1;
    dispatch({ type: 'DOSSIER_ENTSPERREN', id: objekt.objekt.dossier });
    objekt = terminalVaultObjekte().find(function (x) { return x.id === objekt.id; });
    if (!objekt || objekt.gesperrt) { terminalAusgabe('VAULT: access denied'); return 1; }
  }
  const katalog = await terminalVaultKatalog();
  if (katalog.error) { terminalAusgabe(katalog.error); return 1; }
  const records = katalog.records.filter(function (x) { return x.id === objekt.id; });
  if (!records.length) { terminalAusgabe('VAULT: record not indexed'); return 1; }
  const rec = records[0]; /* katalog ist nach letztem Änderungszeitpunkt, Revision und Sammlung sortiert */
  const version = TERMINAL_ZUSTAND.version;
  const antwort = await terminalBruecke('cat', [rec.ordner, rec.dateiname], false);
  if (TERMINAL_ZUSTAND.version !== version) return 1;
  if (antwort.error || typeof antwort.text !== 'string') {
    terminalAusgabe('VAULT: record stream unavailable');
    return 1;
  }
  /* Die Daten könnten während der Anfrage erneut gesperrt worden sein. */
  const jetzt = terminalVaultObjekte().find(function (x) { return x.id === rec.id; });
  if (!jetzt || jetzt.gesperrt) { terminalAusgabe('VAULT: access revoked'); return 1; }
  const vermerk = (PROFIL.exporte || {})[rec.art + ':' + rec.id + ':' + rec.ordner];
  const registriert = !!(vermerk && vermerk.name === rec.dateiname && vermerk.sha);
  const istHash = await terminalVaultHash(antwort.text);
  const aktText = rec.art === 'pin' ? pinText(jetzt.objekt) + '\n' : eigeneZoneText(jetzt.objekt) + '\n';
  const sollHash = await terminalVaultHash(aktText);
  const integritaet = !registriert ? 'UNTRACKED' : !istHash ? 'UNVERIFIED' :
    istHash !== vermerk.sha ? 'INTEGRITY MISMATCH' :
    !sollHash ? 'VERIFIED' : sollHash === istHash ? 'VERIFIED / CURRENT' : 'VERIFIED / OUTDATED';
  /* Ausschließlich fiktive Datenbanksemantik in der Oberfläche, kein Transferprotokoll oder Dateisystempfad. */
  const zuletzt = terminalVaultObjekte().find(function (x) { return x.id === rec.id; });
  if (!zuletzt || zuletzt.gesperrt) { terminalAusgabe('VAULT: access revoked'); return 1; }
  terminalAusgabe([
    'VAULT :: RECORD ACCESS',
    'OBJECT     ' + zuletzt.id + ' · ' + zuletzt.name,
    'REVISION   ' + rec.revision.toString().padStart(2, '0'),
    'INTEGRITY  ' + integritaet,
    '────────────────────────────────────────',
    antwort.text.replace(/\n$/, ''),
    '────────────────────────────────────────',
    'VAULT :: END OF RECORD'
  ].join('\n'), { art: rec.art, id: rec.id });
  return 0;
}

async function terminalNavigation(befehl, args, sudo = false) {
  if (befehl === 'open' && args[0] === 'export') return terminalVaultOeffnen(args.slice(1), sudo);
  if (befehl === 'map' && !args.length) {
    VIEW.karte.reiter = 'karte';
    dispatch({ type: 'NAVIGATION', modul: 'karte' });
    renderModule();
    terminalNachNavigation();
    return 0;
  }
  if (befehl === 'map' && args[0] === 'pins') return terminalPinListe(args.slice(1));
  if (befehl === 'map' && args[0] === 'zones') return terminalZoneListe(args.slice(1));
  const eingabe = args.join(' ').trim();
  if (!eingabe || (befehl === 'map' && args.length === 1 && TERMINAL_KENNUNG_DOSSIER.test(args[0])) ||
      (args.length > 1 && (TERMINAL_KENNUNG_DOSSIER.test(args[0]) || TERMINAL_KENNUNG_PIN.test(args[0]) || TERMINAL_KENNUNG_ZONE.test(args[0]))))
    return terminalUsage(befehl === 'map' ? 'map [pins [query]|zones [query]|PIN-nnn|ZO-nnn|name]' : 'open <id|name|export name>');
  let z = terminalZiel(befehl, eingabe);
  if (!z) return 1;
  /* open löst Kartenobjekte ausschließlich auf ihr Bezugsdossier auf; ohne Verknüpfung
     gibt es keinen Dossierwechsel und auch keinen unnötigen sudo-Prompt. */
  if (befehl === 'open' && (z.art === 'pin' || z.art === 'zone') && !z.dossier) {
    terminalAusgabe('open: ' + z.id + ': No linked dossier');
    return 1;
  }
  if (z.gesperrt) {
    if (!sudo) { terminalAusgabe(befehl + ': ' + z.id + ': Permission denied'); return 1; }
    /* sudo: Zugangskennung der Oberfläche, dann dieselbe dauerhafte Dossierentsperrung */
    const ok = await terminalSudoKennwort();
    if (ok !== true) return ok === 'abbruch' ? 130 : 1;
    dispatch({ type: 'DOSSIER_ENTSPERREN', id: z.dossier });
    z = zielZugang(z.id);
    if (!z || z.gesperrt) { terminalAusgabe(befehl + ': ' + (z?.id || eingabe) + ': Permission denied'); return 1; }
  }
  if (befehl === 'map') {
    const ok = z.art === 'pin' ? terminalPinZeigen(z.objekt) : kartenObjektZeigen(z.id);
    if (!ok) { terminalAusgabe('map: ' + z.id + ': No such file or directory'); return 1; }
    if (z.art === 'zone') karteAuswahlAnzeige();
  } else {
    const dossier = z.art === 'dossier' ? z : zielZugang(z.dossier);
    if (!dossier || dossier.art !== 'dossier') {
      terminalAusgabe('open: ' + z.id + ': Linked dossier not found');
      return 1;
    }
    if (dossier.gesperrt) {
      terminalAusgabe('open: ' + z.id + ': Permission denied');
      return 1;
    }
    dispatch({ type: 'DOSSIER_GEOEFFNET', id: dossier.id, navigieren: true, ueber: 'Terminal' });
  }
  terminalNachNavigation();
  return 0;
}
/* sudo: für die eingebauten Navigationsbefehle map und open. Ein Kennwort verlangt es nur, wenn diese ein manuell gesperrtes Ziel treffen
   (Entscheidung Shadow; das Original fragt vor jedem Befehl, ohne Zwischenspeicher). Prompt wie das Ubuntu-Paket (angenommen;
   das Original setzt "Password: ", configure.ac), kein Echo, nicht im Verlauf, kein Vorschlag. Drei Versuche
   (passwd_tries, configure.ac), Meldungen "Sorry, try again." und "sudo: 3 incorrect password attempts" (logging.c).
   Strg+C: Zeilenumbruch, dann SIGINT (tgetpass.c), Rückgabewert 130. Die Missionsfreigabe hebt sudo nicht auf. */
const TERMINAL_SUDO_VERSUCHE = 3;
const TERMINAL_SUDO_USAGE = ['usage: sudo -h | -K | -k | -V', 'usage: sudo -v [-ABkNnS] [-g group] [-h host] [-p prompt] [-u user]',
  'usage: sudo -l [-ABkNnS] [-g group] [-h host] [-p prompt] [-U user]', '            [-u user] [command [arg ...]]',
  'usage: sudo [-ABbEHkNnPS] [-C num] [-D directory]', '            [-g group] [-h host] [-p prompt] [-R directory] [-T timeout]',
  '            [-u user] [VAR=value] [-i | -s] [command [arg ...]]', 'usage: sudo -e [-ABkNnS] [-C num] [-D directory]',
  '            [-g group] [-h host] [-p prompt] [-R directory] [-T timeout]', '            [-u user] file ...'];
function terminalSudoPrompt() { return '[sudo] password for ' + TERMINAL_BENUTZER + ':'; }
async function terminalSudo(args) {
  if (!args.length) { terminalAusgabe(TERMINAL_SUDO_USAGE); return 1; }
  const befehl = args[0], eintrag = terminalBefehlEintrag(befehl), rest = args.slice(1);
  if (!eintrag) { terminalAusgabe('sudo: ' + befehl + ': command not found'); return 1; }
  if (befehl !== 'map' && befehl !== 'open') {
    terminalAusgabe('sudo: ' + befehl + ': not supported in Shadow Terminal');
    return 1;
  }
  return terminalNavigation(befehl, rest, true);
}
/* Verdeckte Eingabe: die Zeichen landen nur in TERMINAL_ZUSTAND.sudo.puffer, nie im Eingabefeld, im Verlauf oder in der Ausgabe. */
function terminalSudoKennwort() {
  return new Promise(function (fertig) {
    TERMINAL_ZUSTAND.sudo = { puffer: '', versuche: 0, pruefen: false, fertig };
    const input = $('profil-terminal-eingabe');
    if (input) { terminalEingabeSetzen(input, ''); input.setAttribute('aria-label', 'Kennwort'); input.parentElement?.classList.add('verdeckt'); }
    terminalKanalPromptSync();
  });
}
function terminalSudoEnde(ergebnis) {
  const s = TERMINAL_ZUSTAND.sudo;
  if (!s) return;
  TERMINAL_ZUSTAND.sudo = null;
  s.puffer = '';
  const input = $('profil-terminal-eingabe');
  if (input) { terminalEingabeSetzen(input, ''); input.setAttribute('aria-label', 'Terminalbefehl'); input.parentElement?.classList.remove('verdeckt'); }
  if (ergebnis === 'abbruch' && !s.pruefen) terminalAusgabe(terminalSudoPrompt() + ' ');
  terminalKanalPromptSync();
  s.fertig(ergebnis);
}
async function terminalSudoEingabe() {
  const s = TERMINAL_ZUSTAND.sudo;
  if (!s || s.pruefen) return;
  const kennwort = s.puffer;
  s.puffer = ''; s.pruefen = true;
  terminalAusgabe(terminalSudoPrompt() + ' ');
  terminalKanalPromptSync();
  const ok = await kennungPruefen(kennwort);
  if (TERMINAL_ZUSTAND.sudo !== s) return;
  s.pruefen = false;
  if (ok) { terminalSudoEnde(true); return; }
  if (++s.versuche >= TERMINAL_SUDO_VERSUCHE) { terminalAusgabe('sudo: ' + s.versuche + ' incorrect password attempts'); terminalSudoEnde(false); return; }
  terminalAusgabe('Sorry, try again.');
  terminalKanalPromptSync();
}
function terminalSudoTaste(ev) {
  const s = TERMINAL_ZUSTAND.sudo, strg = ev.ctrlKey && !ev.altKey && !ev.metaKey, k = ev.key.toLowerCase();   /* AltGr meldet Strg+Alt */
  if (ev.isComposing) return;
  if (strg && (k === 'c' || k === 'v')) return;      /* Strg+C: SIGINT über den Dokument-Handler; Strg+V: oninput übernimmt */
  ev.preventDefault();
  if (s.pruefen) return;
  if (ev.key === 'Enter') { if (!ev.repeat) void terminalSudoEingabe(); return; }
  if (ev.key === 'Backspace') { s.puffer = Array.from(s.puffer).slice(0, -1).join(''); return; }
  if (strg && k === 'u') { s.puffer = ''; return; }
  if (Array.from(ev.key).length === 1 && !strg && !ev.metaKey) s.puffer += ev.key;
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
const TERMINAL_DATEI = function (name) { return function (args, arg) { return terminalDateiAusfuehren(name, arg, args); }; };
const TERMINAL_TABELLE = [
  { name: 'ls', hilfe: [[0, 0, 'ls [OPTION]... [FILE]...']], tab: { art: 'pfad', optionen: ['-1', '-a', '-A', '-d', '-F', '-h', '-l'] }, aus: TERMINAL_DATEI('ls') },
  { name: 'cd', hilfe: [[0, 1, 'cd <ordner>']], tab: { art: 'pfad' }, aus: TERMINAL_DATEI('cd') },
  { name: 'cat', hilfe: [[0, 3, 'cat <datei>']], tab: { art: 'pfad' }, aus: TERMINAL_DATEI('cat') },
  { name: 'head', hilfe: [[0, 4, 'head <datei>']], tab: { art: 'pfad' }, aus: TERMINAL_DATEI('head') },
  { name: 'tail', hilfe: [[0, 5, 'tail <datei>']], tab: { art: 'tail' }, aus: async function (args, arg) {
    const ppp = await terminalPppShell('tail', arg, args);
    return ppp !== null ? ppp : terminalDateiAusfuehren('tail', arg);
  } },
  { name: 'wget', hilfe: [[0, 6, 'wget <datei>']], tab: { art: 'pfad' }, aus: TERMINAL_DATEI('wget') },
  { name: 'help', aus: function (args, arg) { if (arg) return terminalUsage('help'); terminalAusgabe(terminalHilfe()); return 0; } },
  { name: 'pwd', hilfe: [[0, 2, 'pwd']], aus: function (args, arg) { return terminalBefehlLauf(terminalBefehlPwd, args, arg, TERMINAL_ZUSTAND.version); } },
  { name: 'whoami', hilfe: [[0, 10, 'whoami']], aus: function (args, arg) { if (arg) return terminalUsage('whoami'); terminalAusgabe(TERMINAL_BENUTZER); return 0; } },
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
    t.version++; terminalTransferStop(); t.ausgabe = []; t.ausgabeMeta = []; terminalAusgabe([]);
    return 0;
  } },
  { name: 'exit', hilfe: [[0, 15, 'exit']], aus: function (args, arg) {
    const t = TERMINAL_ZUSTAND;
    if (arg) return terminalUsage('exit');
    // In tmux beendet exit die Shell der Sitzung; vereinfacht endet damit die ganze Sitzung samt oberem Fenster.
    // Mit der Shell enden ihr Vordergrundjob (SIGHUP: plog -f, pppd vor dem Abkoppeln, wg-quick up) und der Rest der Kette.
    if (t.tmux && !t.kanal && !t.orbitLive) {
      if (t.kette) { t.kette = null; terminalShellSighup(); }
      terminalTmuxEnde(); terminalAusgabe('[exited]'); terminalKanalPromptSync();
      return 0;
    }
    t.kette = null;
    terminalKanalAbbruch();
    terminalNmapEnde(129);
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
  { name: 'plog', hilfe: [[1, 3.5, 'plog [-n N] [-f]']], tab: { art: 'optionen', werte: ['-f', '-n'] }, aus: function (args) { return terminalPlog(args); } },
  { name: 'nmap', hilfe: [[0, 6.5, 'nmap <options> <target>']], aus: function (args) { return terminalNmap(args); } },
  { name: 'exports', hilfe: [[0, 6.55, 'exports [query]']], tab: { art: 'vault' }, aus: function (args) { return terminalVaultListe(args); } },
  { name: 'map', hilfe: [[0, 6.6, 'map [pins [query]|zones [query]|PIN-nnn|ZO-nnn|name]']], tab: { art: 'navigation' }, aus: function (args) { return terminalNavigation('map', args); } },
  { name: 'open', hilfe: [[0, 6.7, 'open <id|name|export name>']], tab: { art: 'navigation' }, aus: function (args) { return terminalNavigation('open', args); } },
  { name: 'sudo', hilfe: [[0, 6.8, 'sudo <command>']], tab: { art: 'navigation' }, aus: function (args) { return terminalSudo(args); } },
  { name: 'echo', hilfe: [[0, 7, 'echo']], aus: function (args) { terminalAusgabe(args.join(' ')); return 0; } },
  { name: 'true', hilfe: [[0, 8, 'true']], aus: function (args, arg) { return arg ? terminalUsage('true') : 0; } },
  { name: 'false', hilfe: [[0, 9, 'false']], aus: function (args, arg) { return arg ? terminalUsage('false') : 1; } },
  { name: 'wg-quick', hilfe: [[1, 4, 'wg-quick']], tab: { art: 'fest', werte: ['up wg-sat', 'down wg-sat'] }, aus: TERMINAL_PPP('wg-quick') },
  { name: 'wg', hilfe: [[1, 5, 'wg']], tab: { art: 'fest', werte: ['show wg-sat'] }, aus: TERMINAL_PPP('wg') },
  { name: 'profanity', hilfe: [[1, 6, 'profanity (/msg, /omemo, /sendfile, /quit)']], aus: TERMINAL_PPP('profanity') },
  { name: 'tmux', hilfe: [[2, 0, 'tmux'], [2, 1, 'tmux split-window -bd predict'], [2, 1.5, 'tmux split-window -bd plog -f'], [2, 2, 'Ctrl+B ↑/↓ switch pane'], [2, 3, "tmux kill-pane -t '{up-of}'"]],
    tab: { art: 'fest', werte: ['split-window -bd predict', 'split-window -bd plog -f', "kill-pane -t '{up-of}'", 'kill-server'] }, aus: function (args) { return terminalTmux(args); } }
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
  terminalVorschlagAnzeige();
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
  const befehl = m[1];
  let arg = m[2], kopfB = befehl + ' ';
  // lauf.nurVorschlag: nur die Treffer festhalten (grauer Vorschlag), nichts an der Eingabe ändern.
  const fertig = function (kopf, prefix, kandidaten, format) {
    if (lauf.nurVorschlag) { lauf.ergebnis = { kopf, prefix, kandidaten, format }; return; }
    terminalTabKandidaten(lauf, kopf, prefix, kandidaten, format);
  };
  if (arg === undefined) {
    fertig('', befehl, TERMINAL_BEFEHLE, function (x) { return x + ' '; });
    return;
  }
  const tab = terminalBefehlEintrag(befehl)?.tab;
  if (!tab) return;
  /* ls: führende Optionswörter bleiben stehen, ergänzt wird der Pfad dahinter (ls -l /etc/p) */
  const vorOpt = befehl === 'ls' ? /^((?:-\S*\s+)+)(.*)$/.exec(arg) : null;
  if (vorOpt) { kopfB = befehl + ' ' + vorOpt[1]; arg = vorOpt[2]; }
  if (befehl === 'sudo') {
    const sub = /^(map|open)(?:\s+(.*))?$/.exec(arg);
    if (!sub || sub[2] === undefined) {
      fertig('sudo ', arg, ['map', 'open'], function (x) { return x + ' '; });
      return;
    }
    terminalPinTab(sub[1], sub[2], 'sudo ' + sub[1] + ' ', fertig);
    return;
  }
  if (befehl === 'exports') {
    terminalVaultTab(befehl, arg, befehl + ' ', fertig);
    return;
  }
  if (befehl === 'map' || befehl === 'open') {
    terminalPinTab(befehl, arg, befehl + ' ', fertig);
    return;
  }
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
  if (tab.art === 'optionen' || (tab.optionen && arg.startsWith('-') && !vorOpt)) {
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
    fertig(kopfB + anfang, pfad, namen, function (x) { return x + anfang; });
    return;
  }
  if (teile[0] !== TERMINAL_DB) return;
  const antwort = lauf.nurVorschlag ? await terminalVorschlagLs(teile.slice(1), prefix.startsWith('.'))
    : await terminalBruecke('ls', teile.slice(1), prefix.startsWith('.'));
  if (lauf.nurVorschlag) { if (antwort.entries && terminalVorschlagGueltig(lauf)) lauf.fertigLs = true; else return; }
  else if (!terminalTabGueltig(lauf)) return;
  if (!antwort.entries) { terminalTabFehler(lauf, antwort); return; }
  terminalTabFehlerZuletzt = '';
  const sichtJetzt = terminalArchivSichtbarkeit();   /* letzte Prüfung unmittelbar vor der Übernahme */
  const namen = antwort.entries.filter(function (x) { return sichtJetzt(x.name) && (x.dir || befehl !== 'cd'); })
    .map(function (x) { return basis + x.name + (x.dir ? '/' : ''); });
  fertig(kopfB + anfang, pfad, namen, function (x) {
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
      terminalTabKandidaten(lauf, '/omemo ', omemo[1], ['start', 'end', 'fingerprint'], x => x);
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
  const sichtJetzt = terminalArchivSichtbarkeit();   /* letzte Prüfung unmittelbar vor der Übernahme */
  terminalTabKandidaten(lauf, kopf, pfad, antwort.entries.filter(function (x) { return sichtJetzt(x.name); }).map(function (x) {
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
  if (TERMINAL_ZUSTAND.sudo) { terminalSudoTaste(ev); return; }
  const offen = terminalTabAuswahl;
  /* Strg+→ wie Oh My Zsh mit zsh-autosuggestions: forward-word (lib/key-bindings.zsh, ^[[1;5C) mit WORDCHARS=''
     (lib/completion.zsh), also nur Buchstaben und Ziffern als Wortzeichen; forward-word überspringt Wortzeichen, dann
     Nicht-Wortzeichen (zle_word.c). Mit Vorschlag übernimmt es ihn bis dorthin (_zsh_autosuggest_partial_accept),
     sonst bewegt es nur den Cursor. Im Chat (profanity, eigener Zeileneditor) bleibt die Taste beim Browser. */
  if (ev.key === 'ArrowRight' && ev.ctrlKey && !ev.shiftKey && !ev.altKey && !ev.metaKey && !offen && !ev.isComposing && !TERMINAL_ZUSTAND.kanal) {
    const input = ev.currentTarget, rest = terminalVorschlag(), voll = input.value + rest, wort = /[\p{L}\p{N}]/u;
    let i = input.selectionEnd;
    while (i < voll.length && wort.test(voll[i])) i++;
    while (i < voll.length && !wort.test(voll[i])) i++;
    ev.preventDefault();
    if (rest && i > input.value.length) terminalEingabeSetzen(input, voll.slice(0, i));
    else { input.setSelectionRange(i, i); terminalVorschlagAnzeige(); }
    return;
  }
  if ((ev.key === 'ArrowRight' || ev.key === 'End') && !offen && !ev.isComposing && ev.keyCode !== 229 && !ev.shiftKey && !ev.ctrlKey && !ev.altKey && !ev.metaKey) {
    const rest = terminalVorschlag(), input = ev.currentTarget;
    if (rest && input.selectionStart === input.value.length) { ev.preventDefault(); terminalEingabeSetzen(input, input.value + rest); return; }
  }
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
  terminalVorschlagAnzeige();
}
/* Grauer Vorschlag wie zsh-autosuggestions: jüngster Verlaufseintrag, der mit der Eingabe beginnt, als Rest hinter dem Text.
   → oder Ende am Zeilenende übernimmt ihn. Nicht im Chat, nicht beim Blättern im Verlauf, nicht bei offener Auswahlliste. */
function terminalVorschlag() {
  const t = TERMINAL_ZUSTAND, input = $('profil-terminal-eingabe');
  if (!input || !input.value || t.kanal || t.orbitLive || t.vpos !== -1 || terminalTabAuswahl || t.tmux?.fokus === 'oben' || terminalBeschaeftigt()) return '';
  if (document.activeElement === input && (input.selectionStart !== input.value.length || input.selectionEnd !== input.value.length)) return '';
  // Der jüngste passende Eintrag entscheidet; ist er genau die Eingabe, gibt es keinen Vorschlag (kein älterer, längerer).
  for (let i = t.verlauf.length - 1; i >= 0; i--) {
    const e = t.verlauf[i];
    if (e.startsWith(input.value) && !terminalZeileMitGesperrtemName(e)) return e.slice(input.value.length);
  }
  // Zweite Quelle wie ZSH_AUTOSUGGEST_STRATEGY=(history completion): der erste Treffer der Tab-Ergänzung.
  const k = t.vorschlagErgaenzung;
  if (k && k.wert === input.value && k.version === t.version && k.ort === terminalArbeitsverzeichnis())
    return terminalZeileMitGesperrtemName(k.wert + k.rest) ? '' : k.rest;
  if (!k || k.wert !== input.value) terminalVorschlagErgaenzen(input);
  return '';
}
/* Strategie completion von zsh-autosuggestions (src/strategies/completion.zsh): die Ergänzung läuft wie bei Tab,
   compstate[insert]=1 fügt den ersten Treffer ein (Treffer sortiert), matcher-list '' verlangt, dass er die Eingabe
   genau fortsetzt. Asynchron wie ZSH_AUTOSUGGEST_USE_ASYNC: das Ergebnis gilt nur, solange die Eingabe gleich bleibt. */
function terminalVorschlagErgaenzen(input) {
  const t = TERMINAL_ZUSTAND, wert = input.value, m = /^(\S+)(?:\s+(.*))?$/.exec(wert);
  t.vorschlagErgaenzung = { wert, rest: '', version: t.version, ort: terminalArbeitsverzeichnis() };
  if (!m || t.dateiLaeuft || (m[2] !== undefined && !terminalBefehlEintrag(m[1])?.tab)) return;
  const lauf = { input, wert, version: t.version, kanal: null, ort: terminalArbeitsverzeichnis(), nurVorschlag: true };
  terminalTab(lauf, m).then(function () {
    const e = lauf.ergebnis, eintrag = t.vorschlagErgaenzung;
    if (!e || eintrag?.wert !== wert || !terminalVorschlagGueltig(lauf)) return;
    const erster = [...new Set(e.kandidaten)].filter(function (x) { return x.startsWith(e.prefix); }).sort()[0];
    const voll = erster === undefined ? '' : e.kopf + e.format(erster);
    if (voll.length > wert.length && voll.startsWith(wert)) { eintrag.rest = voll.slice(wert.length); terminalVorschlagAnzeige(); }
  }).catch(function () {});
}
function terminalVorschlagGueltig(lauf) {
  const t = TERMINAL_ZUSTAND, input = lauf.input, n = lauf.wert.length;
  return t.version === lauf.version && !t.kanal && terminalArbeitsverzeichnis() === lauf.ort && input.isConnected &&
    input.value === lauf.wert && input.selectionStart === n && input.selectionEnd === n;
}
// Ordnerinhalt für den Vorschlag: je Ordner eine Anfrage an die Brücke, 10 s zwischengespeichert.
function terminalVorschlagLs(teile, versteckt) {
  const schluessel = teile.join('/') + (versteckt ? '\u0000.' : ''), alt = TERMINAL_VORSCHLAG_LS.get(schluessel);
  /* Auch ein Treffer im Zwischenspeicher wird bei jeder Entnahme gegen die aktuellen Sperren gefiltert */
  const jetzt = function (antwort) {
    if (!antwort.entries) return antwort;
    const sicht = terminalArchivSichtbarkeit();
    return Object.assign({}, antwort, { entries: antwort.entries.filter(function (e) { return sicht(e && e.name); }) });
  };
  if (alt && Date.now() - alt.zeit < 10000) return alt.antwort.then(jetzt);
  const antwort = terminalBruecke('ls', teile, versteckt);
  TERMINAL_VORSCHLAG_LS.set(schluessel, { zeit: Date.now(), antwort });
  return antwort.then(jetzt);
}
/* Einfärbung beim Tippen wie zsh-syntax-highlighting. Die Zerlegung folgt terminalZerlegen, damit die Farbe zeigt,
   was die Shell beim Ausführen tut: Befehlswort grün (bekannt) oder rot (command not found), Anführungszeichen gelb
   (offen bis zum Zeilenende), $? eigene Farbe, Trenner ohne Farbe; was die Shell abweist (Pipes, Umleitungen,
   Ersetzungen, Trenner ohne Befehl davor), rot. Ergebnis: lückenlose Abschnitte [text, art]. */
function terminalEinfaerben(zeile) {
  const teile = [];
  let wort = null, befehlsPos = true, quote = null;
  const dazu = function (text, art) {
    const letzt = teile.at(-1);
    if (letzt && letzt[1] === art) letzt[0] += text; else teile.push([text, art]);
  };
  const wortEnde = function () {
    if (!wort) return;
    const name = wort.map(function (w) { return w[2]; }).join('');
    // Ein noch offenes Anführungszeichen ist kein fertiges Befehlswort (Enter: unexpected EOF): bleibt gelb.
    const offen = befehlsPos && quote;
    const art = befehlsPos ? (!offen && terminalBefehlEintrag(name) ? 'befehl' : 'unbekannt') : 'argument';
    const teil = wort; wort = null;
    teil.forEach(function (w) { dazu(w[0], w[1] === 'wort' || (befehlsPos && !offen) ? art : w[1]); });
    befehlsPos = false;
  };
  // Ein Wort sammelt Abschnitte mit dem Wert, den terminalZerlegen daraus macht (für den Namen des Befehls).
  const wortDazu = function (text, art, wert) {
    if (!wort) wort = [];
    const letzt = wort.at(-1);
    if (letzt && letzt[1] === art) { letzt[0] += text; letzt[2] += wert; } else wort.push([text, art, wert]);
  };
  for (let i = 0; i < zeile.length; i++) {
    const c = zeile[i], n = zeile[i + 1];
    if (quote === "'") { wortDazu(c, 'zeichenkette', c === "'" ? '' : c); if (c === "'") quote = null; continue; }
    if (quote === '"') {
      if (c === '"') { wortDazu(c, 'zeichenkette', ''); quote = null; }
      else if (c === '\\' && n !== undefined && '"\\$'.includes(n)) { wortDazu(c + n, 'zeichenkette', n); i++; }
      else if (c === '$' && n === '?') { wortDazu('$?', 'variable', '$?'); i++; }
      else wortDazu(c, 'zeichenkette', c);
      continue;
    }
    if (c === "'" || c === '"') { quote = c; wortDazu(c, 'zeichenkette', ''); continue; }
    if (/\s/.test(c)) { wortEnde(); dazu(c, 'leer'); continue; }
    if (c === '\\') { wortDazu(n === undefined ? c : c + n, 'wort', n ?? ''); i++; continue; }
    const op = (c === '&' && n === '&') || (c === '|' && n === '|') ? c + n : c === ';' ? ';' : '';
    if (op) {
      const ohneBefehl = befehlsPos && !wort;
      wortEnde();
      dazu(op, ohneBefehl ? 'fehler' : 'operator');
      befehlsPos = true; i += op.length - 1;
      continue;
    }
    if ('|&<>`'.includes(c) || (c === '$' && n === '(')) { wortEnde(); dazu(c === '$' ? '$(' : c, 'fehler'); if (c === '$') i++; continue; }
    if (c === '$' && n === '?') { wortDazu('$?', 'variable', '$?'); i++; continue; }
    wortDazu(c, 'wort', c);
  }
  wortEnde();
  return teile;
}
/* Ein Overlay hinter dem (dann durchsichtigen) Eingabefeld zeigt den eingefärbten Text und den grauen Vorschlag.
   Im Chat bleibt das Feld normal: Nachrichten sind keine Befehle. */
function terminalVorschlagAnzeige() {
  const geist = $('profil-terminal-vorschlag'), input = $('profil-terminal-eingabe');
  if (!geist || !input) return;
  // Während einer IME-Komposition zeigt das Feld den Text selbst: das Overlay kennt den unfertigen Text nicht.
  const farbig = !TERMINAL_ZUSTAND.kanal && !input.dataset.ime, rest = input.dataset.ime ? '' : terminalVorschlag();
  input.parentElement?.classList.toggle('farbig', farbig);
  geist.hidden = !(rest || (farbig && input.value));
  if (geist.hidden) { geist.replaceChildren(); return; }
  // Gleiche Schrift, Abstände und Umbruch wie das Eingabefeld, damit der Text genau unter dem Feld steht.
  const st = getComputedStyle(input);
  ['font', 'letterSpacing', 'lineHeight', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
    'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth', 'textIndent'].forEach(function (k) { geist.style[k] = st[k]; });
  // Eine Bildlaufleiste (Windows) verengt nur das Feld; das Overlay bekommt den Platz als Innenabstand, sonst bricht es anders um.
  const leiste = input.offsetWidth - input.clientWidth - parseFloat(st.borderLeftWidth) - parseFloat(st.borderRightWidth);
  if (leiste > 0) geist.style.paddingRight = 'calc(' + st.paddingRight + ' + ' + leiste + 'px)';
  const text = farbig
    ? terminalEinfaerben(input.value).map(function (t) { return t[1] === 'leer' || t[1] === 'argument' ? t[0] : h('span', { class: 'f-' + t[1] }, t[0]); })
    : [input.value];
  geist.replaceChildren(h('span', { class: 'text' }, ...text), ...(rest ? [h('span', { class: 'rest' }, rest)] : []));
  geist.scrollTop = input.scrollTop;
}
function terminalKonsoleBauen() {
  const t = TERMINAL_ZUSTAND;
  const input = h('textarea', { id: 'profil-terminal-eingabe', rows: 1, 'aria-label': 'Terminalbefehl',
    maxlength: 1024, autocomplete: 'off', spellcheck: 'false', onkeydown: terminalTabTaste,
    onblur: terminalTabReset, onpointerdown: terminalTabReset,
    oninput: function (ev) {
      const sudo = TERMINAL_ZUSTAND.sudo;
      if (sudo) { if (!ev.isComposing) { if (!sudo.pruefen) sudo.puffer += input.value.replace(/\n/g, ''); input.value = ''; } return; }   /* Einfügen, IME */
      terminalTabReset();
      if (ev.isComposing) return;
      if (input.value.includes('\n')) {
        const von = input.selectionStart, bis = input.selectionEnd;
        input.value = input.value.replace(/\n/g, ' ');
        input.setSelectionRange(von, bis);
      }
      terminalEingabeHoehe(input);
      terminalVorschlagAnzeige();
    }, oncompositionstart: function () { input.dataset.ime = '1'; terminalVorschlagAnzeige(); },
    oncompositionend: function () { delete input.dataset.ime; terminalVorschlagAnzeige(); },
    onkeyup: terminalVorschlagAnzeige, onpointerup: terminalVorschlagAnzeige, onfocus: terminalVorschlagAnzeige, onscroll: function () { const g = $('profil-terminal-vorschlag'); if (g) g.scrollTop = input.scrollTop; } });
  const titel = h('div', { class: 'profil-terminal-titel', 'aria-hidden': 'true' }, 'Shadow Terminal');
  const minimieren = h('button', { type: 'button', id: 'profil-terminal-minimieren',
    'aria-controls': 'profil-terminal-kern', 'aria-expanded': 'true', 'aria-label': 'Minimieren', title: 'Minimieren' }, '−');
  const griff = h('span', { class: 'profil-terminal-groesse', 'aria-hidden': 'true' });
  const kern = h('div', { id: 'profil-terminal-kern', class: 'profil-terminal-kern' },
      h('pre', { id: 'profil-terminal-ausgabe', class: 'mono', role: 'log', 'aria-label': 'Terminalausgabe' }, t.ausgabe.join('\n')),
      h('pre', { id: 'profil-terminal-orbit', class: 'mono', 'aria-label': 'Überflug', hidden: true }),
      h('div', { id: 'profil-terminal-xmpp-titel', class: 'mono', 'aria-label': 'profanity: Titelzeile', hidden: true }),
      h('pre', { id: 'profil-terminal-chat', class: 'mono', role: 'log', 'aria-label': 'Chatverlauf', hidden: true }),
      h('div', { id: 'profil-terminal-xmpp-status', class: 'mono', 'aria-label': 'profanity: Statuszeile', hidden: true }),
      h('pre', { id: 'profil-terminal-transfer', class: 'mono', hidden: !t.fortschritt }, t.fortschritt),
      h('form', { onsubmit: function (ev) {
        ev.preventDefault();
        if (TERMINAL_ZUSTAND.sudo) { void terminalSudoEingabe(); return; }      /* Schaltfläche während der Kennwortabfrage */
        terminalTabReset();
        const zeile = input.value.replace(/\n/g, ' ').trim();
        if (TERMINAL_ZUSTAND.tmux?.fokus === 'oben') return;
        if (zeile !== 'exit' && terminalBeschaeftigt()) return;
        terminalEingabeSetzen(input, '');
        if (zeile) { terminalVerlaufNehmen(zeile); terminalBefehl(zeile); }
      } }, h('label', { id: 'profil-terminal-prompt', for: input.id, class: 'mono' }, terminalPrompt()),
        h('div', { class: 'profil-terminal-feld' }, h('div', { id: 'profil-terminal-vorschlag', class: 'mono', 'aria-hidden': 'true', hidden: true }), input),
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
  const beobachter = new ResizeObserver(function () {
    // Andere Fenstergröße: plog in tmux-Bereichen zeigt wieder die jüngsten ganzen Zeilen, die hineinpassen.
    if (TERMINAL_ZUSTAND.tmux?.panes.length) terminalTmuxPaneAnzeige();
    if (input.clientWidth === breite) return;
    breite = input.clientWidth;
    terminalEingabeHoehe(input);
    // Neue Breite oder eine erscheinende Bildlaufleiste: das Overlay bricht sonst anders um als das durchsichtige Feld.
    terminalVorschlagAnzeige();
  });
  beobachter.observe(fenster);
  beobachter.observe(input);
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
  if (TERMINAL_ZUSTAND.sudo) terminalKetteAbbrechen(130); /* Schließen verwirft Kennwort und offenen Auftrag */
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
    // Rückgabewert wie in terminalPppModemAus: 8, solange das Connect-Skript läuft, sonst 5.
    terminalKetteAbbrechen(t.modem?.phase === 'chat' ? 8 : 5);
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
      terminalTmuxWechsel(ev.key === 'ArrowUp' ? 'hoch' : 'runter');
      tx.wiederholBis = Date.now() + 500;
      return;
    }
    if (tx.praefix && !['Control', 'Shift', 'Alt', 'Meta'].includes(ev.key)) {
      tx.praefix = false; tx.wiederholBis = 0; ev.preventDefault(); ev.stopImmediatePropagation();
      if (ev.key === 'ArrowUp' || ev.key === 'ArrowDown') {
        terminalTmuxWechsel(ev.key === 'ArrowUp' ? 'hoch' : 'runter');
        if (!ev.ctrlKey) tx.wiederholBis = Date.now() + 500;
      } else if (ev.key === 'o') terminalTmuxWechsel('naechstes');
      return;
    }
    if (tx.wiederholBis && !['Control', 'Shift', 'Alt', 'Meta'].includes(ev.key)) tx.wiederholBis = 0;
    if (ev.ctrlKey && !ev.altKey && !ev.metaKey && ev.key.toLowerCase() === 'b') { tx.praefix = true; ev.preventDefault(); ev.stopImmediatePropagation(); return; }
    if (tx.fokus === 'oben' && ev.ctrlKey && ev.key.toLowerCase() === 'c' && !ev.repeat) {
      // Strg+C beendet das Programm im aktiven oberen Bereich; tmux schließt ihn, der Fokus geht zurück zur Shell.
      ev.preventDefault(); ev.stopImmediatePropagation(); terminalTmuxPaneSchliessen(tx.aktiv); return;
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
  if (TERMINAL_ZUSTAND.sudo) terminalKetteAbbrechen(130); /* erst Promise/Puffer beenden, dann Sitzung löschen */
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
    [PROFIL.profiltexte.notizen.text, PROFIL.profiltexte.einschraenkungen.text, PROFIL.profiltexte.notizen.verdraengt.length, PROFIL.profiltexte.einschraenkungen.verdraengt.length, VIEW.draft['ta-notizen'], VIEW.draft['ta-einschr']].some(Boolean) ?   /* Phase 5c1a: Quelle ist das Profil */
      h('details', { class: 'panel profil-alt-notizen' }, h('summary', null, 'Bisherige Notizen'),
        h('div', { class: 'cols pad' },
          panel('Notizen', null, h('div', { class: 'pad' }, autosaveFeld('ta-notizen', 'notizen', 'Notizen'), profiltextAufbewahrt('notizen'))),
          panel('Operative Einschränkungen', null, h('div', { class: 'pad' }, autosaveFeld('ta-einschr', 'einschraenkungen', 'Operative Einschränkungen'), profiltextAufbewahrt('einschraenkungen'))))) : null,
    karteBereinigenPanel());
}
