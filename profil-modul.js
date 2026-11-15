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
  ['sprache', 'Sprachkompetenz', 72], ['tradecraft', 'Kampferfahrung', 81], ['cyber', 'Cyber', 68],
  ['physis', 'Physis', 87], ['stress', 'Sozialkompetenz', 90]
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
function agentRadarPanel() {
  const werte = radarWerte();
  return panel('Kompetenzprofil', h('span', { class: 'badge' }, 'SIMULATION · 0–100'),
    h('div', { class: 'profil-radar-inhalt' },
      radarGrafik(werte),
      h('dl', { class: 'profil-radar-werte' }, AGENT_RADAR.map(function (a, i) {
        return h('div', null, h('dt', null, a[1]), h('dd', { class: 'mono' }, String(werte[i])));
      }))),
    h('details', { class: 'pad' }, h('summary', null, 'Werte bearbeiten'),
      h('p', { class: 'note' }, 'Fiktive Startwerte. Du kannst sie frei setzen. Sie ändern keine Freigaben und lösen nichts aus.'),
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
  return kopf.concat(
    h('div', { class: 'cols' },
      panel('Agentenkennung', null, h('dl', { class: 'fields' }, feld('Codename', A.codename), feld('Interne ID', A.id),
        feld('Aktive Identität', id ? id.name + ' · ' + id.bezeichnung : '–', 'full'), feld('Status', statusLabel(status), 'full')),
        h('div', { class: 'row top' }, h('label', { for: 'sel-status' }, 'Status setzen'),
          h('select', { id: 'sel-status', value: status, onchange: function (ev) {
            arbeitsProfilSpeichern('arbeitsstatus', ev.target.value);
            renderHeader(); renderModule();
          } }, ARBEITS_STATUS.map(function (x) { return h('option', { value: x }, x); })))),
      agentRadarPanel()),
    h('div', { class: 'cols' },
      panel('Notizen', null, h('div', { class: 'pad' }, autosaveFeld('ta-notizen', 'notizen', 'Notizen'))),
      panel('Operative Einschränkungen', null, h('div', { class: 'pad' }, autosaveFeld('ta-einschr', 'einschraenkungen', 'Operative Einschränkungen')))),
    karteBereinigenPanel());
}
