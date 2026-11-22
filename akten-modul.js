'use strict';
/* Field Terminal: Modul 7, Ablage (Aktenliste, Dokumentenansicht mit Schwärzungen, Einsichtsanträge, Leseprotokoll).
   Klassisches Skript, nach dem Hauptskript geladen (siehe karte-modul.js); nutzt dessen globale Namen. */
/* =====================================================================
   MODUL 7: AKTEN
   Dokumentenviewer mit Schwärzungen. Eine Schwärzung bleibt verdeckt, solange die Zugangsstufe der Akte nicht ausreicht.
   Der Agent kann beim Ansprechpartner Freigabe beantragen; die Antwort kommt zeitversetzt und fällt je nach Akte positiv oder negativ aus.
   Der Text verdeckter Passagen wird nicht in die Seite geschrieben. Freigaben verfallen mit der Nachbereitung.
   ===================================================================== */
VIEW.akte = { offen: null }; VIEW.akte.suche = '';
/* Phase 5b4: Die produktive Ablage zeigt ausschließlich den lokalen Eingang.
   Ein importiertes Altprofil mit VIEW.akte.reiter='registratur' darf die
   historische Akten-/Freigabemaske nicht erneut einblenden. */
function renderAkten(m) {
  return [modKopf(m), akEingangAnsicht()];
}

/* Eingang: vorläufige Einträge gehören keinem Fall. Die Datei liegt bereits im
   Recherche-Dateispeicher und behält bei der Übernahme ihren Anhangsschlüssel. */
const AK_EINGANG_KEY = PROFIL_KEY + '.ablage-eingang';
const AK_EINGANG = { auswahl: null, arbeit: false };
let akVorschauUrl = null;
function akEingangLesen() {
  const liste = JSON.parse(localStorage.getItem(AK_EINGANG_KEY) || '[]');
  if (!Array.isArray(liste)) throw new Error('Eingang nicht lesbar');
  return liste;
}
function akEingangSpeichern(liste) {
  localStorage.setItem(AK_EINGANG_KEY, JSON.stringify(liste));
}
function akEingangSichtbar(liste) {
  const vergeben = new Set(PROFIL.recherche.fassungen.map(function (f) { return f.anhang; }));
  return liste.filter(function (x) { return !vergeben.has(x.anhang); });
}
function akEingangFertig() {
  AK_EINGANG.arbeit = false;
  if (STATE.ui.modul === 'akten') renderModule();
}
async function akEingangAblegen(file) {
  if (!file || AK_EINGANG.arbeit) return;
  if (file.size > RCH_MAX) { meldung('Datei über 20 MB, nicht angenommen.'); return; }
  AK_EINGANG.arbeit = true;
  let schluessel = null, abgelegt = false;
  try {
    const liste = akEingangLesen();
    schluessel = 'ANH-E-' + Array.from(crypto.getRandomValues(new Uint32Array(4)), function (x) { return x.toString(16).padStart(8, '0'); }).join('');
    const hash = await rchHash(file);
    await RIDB.put(schluessel, file);
    akEingangSpeichern(akEingangSichtbar(liste).concat({ anhang: schluessel, dateiname: file.name, groesse: file.size, typ: file.type || 'application/octet-stream', hash: hash, erfasst: nowIso() }));
    abgelegt = true;
    AK_EINGANG.auswahl = schluessel;
    meldung('Datei im Eingang abgelegt.');
  } catch (e) {
    if (schluessel && !abgelegt) await RIDB.del(schluessel).catch(function () {});
    meldung('Datei konnte nicht im Eingang abgelegt werden.');
  } finally { akEingangFertig(); }
}
async function akEingangLoeschen(eintrag) {
  if (AK_EINGANG.arbeit) return;
  AK_EINGANG.arbeit = true;
  let alt, entfernt = false;
  try {
    alt = akEingangLesen();
    if (!akEingangSichtbar(alt).some(function (x) { return x.anhang === eintrag.anhang; })) {
      meldung('Datei ist nicht mehr im Eingang.'); return;
    }
    akEingangSpeichern(alt.filter(function (x) { return x.anhang !== eintrag.anhang; }));
    entfernt = true;
    await RIDB.del(eintrag.anhang);
    if (AK_EINGANG.auswahl === eintrag.anhang) AK_EINGANG.auswahl = null;
    meldung('Datei aus dem Eingang gelöscht.');
  } catch (e) {
    if (entfernt) {
      try {
        const aktuell = akEingangLesen();
        if (!aktuell.some(function (x) { return x.anhang === eintrag.anhang; })) akEingangSpeichern(aktuell.concat(eintrag));
      } catch (ex) { meldung('Datei konnte nicht gelöscht und der Listeneintrag nicht wiederhergestellt werden.'); return; }
    }
    meldung('Datei konnte nicht aus dem Eingang gelöscht werden.');
  } finally { akEingangFertig(); }
}
function akVorschauFreigeben() {
  if (akVorschauUrl) { URL.revokeObjectURL(akVorschauUrl); akVorschauUrl = null; }
}
new MutationObserver(function () {
  if (STATE && (!['akten', 'x'].includes(STATE.ui.modul) || document.body.classList.contains('locked'))) akVorschauFreigeben();
}).observe(document.body, { attributes: true, attributeFilter: ['class'], childList: true, subtree: true });
async function akDateivorschau(eintrag, ziel) {
  try {
    const blob = await RIDB.get(eintrag.anhang);
    if (!ziel.isConnected || document.body.classList.contains('locked')) return;
    if (!blob) { ziel.textContent = 'Datei im lokalen Speicher nicht vorhanden.'; return; }
    const bild = /^(image\/(png|jpeg|gif|webp|bmp))$/.test(blob.type);
    if (bild) {
      akVorschauUrl = URL.createObjectURL(blob);
      ziel.replaceChildren(h('img', { src: akVorschauUrl, alt: eintrag.dateiname, style: 'max-width:100%;max-height:60vh;object-fit:contain' }));
    } else if (blob.type === 'application/pdf' && (await blob.slice(0, 5).text()) === '%PDF-') {
      if (!ziel.isConnected || document.body.classList.contains('locked')) return;
      akVorschauUrl = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      ziel.replaceChildren(h('iframe', { src: akVorschauUrl, title: 'PDF-Vorschau: ' + eintrag.dateiname, style: 'width:100%;height:55vh;border:0' }));
    } else if (/^text\/(plain|markdown|csv)$/.test(blob.type) || /\.(txt|md|csv)$/i.test(eintrag.dateiname)) {
      const text = await blob.slice(0, 65536).text();
      if (ziel.isConnected) ziel.replaceChildren(h('pre', { style: 'white-space:pre-wrap;overflow-wrap:anywhere;max-height:55vh;overflow:auto' }, text + (blob.size > 65536 ? '\n… Vorschau gekürzt' : '')));
    } else ziel.textContent = 'Für dieses Dateiformat ist keine Vorschau verfügbar.';
  } catch (e) { if (ziel.isConnected) ziel.textContent = 'Vorschau konnte nicht geladen werden.'; }
}
async function akEingangZuordnen(eintrag, form) {
  if (AK_EINGANG.arbeit) return;
  const dossier = entitaet(form.elements.dossier.value), fall = form.elements.fall.value;
  const titel = form.elements.titel.value.trim();
  if (!dossier || dossierGesperrt(dossier) || !dossierRechercheBestand().some(function (e) { return e.id === dossier.id; }) ||
      (!PROFIL.recherche.faelle.some(function (f) { return f.id === fall; }) && !(fall === '__neu' && titel))) {
    meldung('Bitte ein verfügbares Dossier und einen Fall wählen oder benennen.'); return;
  }
  const notiz = form.elements.notiz.value, ft = form.elements.fundstelle.value.trim(), ftTyp = form.elements.ftTyp.value;
  AK_EINGANG.arbeit = true;
  try {
    const blob = await RIDB.get(eintrag.anhang);
    if (!blob) { meldung('Datei fehlt. Die Zuordnung wurde nicht gespeichert.'); return; }
    if (!akEingangSichtbar(akEingangLesen()).some(function (x) { return x.anhang === eintrag.anhang; })) return;
    if (dossierGesperrt(dossier) || entitaet(dossier.id) !== dossier || document.body.classList.contains('locked')) return;
    const ok = rchSchreiben({ type: 'RECHERCHE_BELEG', dossier: dossier.id, fall: fall === '__neu' ? null : fall,
      neuerFall: fall === '__neu' ? { titel: titel } : null, art: 'Datei', notiz: notiz,
      fundstelle: ft || ftTyp === 'ganze Datei' ? { typ: ftTyp, wert: ft } : null,
      fassung: { anhang: eintrag.anhang, dateiname: eintrag.dateiname, typ: eintrag.typ, groesse: eintrag.groesse, hash: eintrag.hash }
    }, 'Unterlage erfasst');
    if (!ok) return;
    try { akEingangSpeichern(akEingangSichtbar(akEingangLesen())); } catch (e) { /* vergebene Dateien bleiben aus der Eingangsliste gefiltert */ }
    AK_EINGANG.auswahl = null;
    meldung('Datei dem Fall und Dossier zugeordnet.');
  } catch (e) { meldung('Zuordnung nicht gespeichert. Die Datei bleibt im Eingang.'); }
  finally { akEingangFertig(); }
}
function akEingangAnsicht() {
  akVorschauFreigeben();
  let liste;
  try { liste = akEingangSichtbar(akEingangLesen()); }
  catch (e) { return panel('Eingang', null, h('p', { class: 'note' }, 'Der lokale Eingangsspeicher ist nicht lesbar.')); }
  const cur = liste.find(function (x) { return x.anhang === AK_EINGANG.auswahl; }) || liste[liste.length - 1];
  const seite = h('section', null,
    h('label', { for: 'ak-eingang-datei' }, 'Datei ablegen'),
    h('input', { id: 'ak-eingang-datei', type: 'file', disabled: AK_EINGANG.arbeit, onchange: function (ev) { const f = ev.target.files[0]; ev.target.value = ''; void akEingangAblegen(f); } }),
    h('p', { class: 'note' }, 'Lokal in diesem Browserprofil. Nicht in der Profil-JSON enthalten. Nach Zuordnung über das Fallpaket sicherbar.'),
    h('ul', { class: 'ak-eingang-liste', 'aria-label': 'Dateien im Eingang' }, liste.slice().reverse().map(function (x, i) {
      return h('li', null, h('button', { type: 'button', id: 'ak-eingang-wahl-' + i, title: x.dateiname, 'aria-current': x === cur ? 'true' : null, onclick: function () { AK_EINGANG.auswahl = x.anhang; renderModule(); } }, h('span', { class: 'ak-eingang-name' }, x.dateiname)));
    })));
  if (!cur) return panel('Eingang', null, h('div', { class: 'pad' }, seite, h('p', { class: 'note' }, 'Noch keine Dateien abgelegt.')));
  const vorschau = h('div', { id: 'ak-eingang-vorschau', 'aria-live': 'polite' }, 'Vorschau wird geladen …');
  const fall = h('select', { name: 'fall', id: 'ak-eingang-fall' },
    h('option', { value: '' }, 'Fall wählen'), PROFIL.recherche.faelle.map(function (f) { return h('option', { value: f.id }, f.titel); }), h('option', { value: '__neu' }, 'Neuen Fall anlegen'));
  const tit = h('input', { id: 'ak-eingang-titel', name: 'titel', maxlength: 120, disabled: true });
  fall.addEventListener('change', function () { tit.disabled = fall.value !== '__neu'; });
  const dos = h('select', { name: 'dossier', id: 'ak-eingang-dossier' }, h('option', { value: '' }, 'Dossier wählen'), /* Der lokale Eingang ist unabhängig von missionsgebundenen Freigabestufen.
     Manuell gesperrte Dossiers erscheinen nicht in der Auswahl. */
  dossierRechercheBestand().filter(function (e) {
    return !dossierGesperrt(e);
  }).map(function (e) { return h('option', { value: e.id }, e.id + ' ' + e.name); }));
  const form = h('form', { onsubmit: function (ev) { ev.preventDefault(); void akEingangZuordnen(cur, ev.currentTarget); } },
    feldZeile('Fall', fall.id, fall), feldZeile('Neuer Falltitel', tit.id, tit), feldZeile('Dossier', dos.id, dos),
    feldZeile('Fundstellenart', 'ak-eingang-ft-typ', h('select', { id: 'ak-eingang-ft-typ', name: 'ftTyp' }, RCH_FUNDSTELLEN.map(function (x) { return h('option', { value: x }, x); }))),
    feldZeile('Fundstelle (optional)', 'ak-eingang-ft', h('input', { id: 'ak-eingang-ft', name: 'fundstelle', maxlength: 120 })),
    feldZeile('Notiz (optional)', 'ak-eingang-notiz', h('input', { id: 'ak-eingang-notiz', name: 'notiz', maxlength: 300 })),
    h('button', { type: 'submit', id: 'ak-eingang-zuordnen', disabled: AK_EINGANG.arbeit }, 'Zuordnen'));
  setTimeout(function () { if (vorschau.isConnected) void akDateivorschau(cur, vorschau); }, 0);
  return panel('Eingang', null, h('div', { class: 'pad ak-eingang-layout' }, seite,
    h('section', null, h('h3', null, cur.dateiname), vorschau, form,
      h('div', { class: 'row' }, h('button', { type: 'button', id: 'ak-eingang-loeschen', disabled: AK_EINGANG.arbeit,
        onclick: function () {
          bestaetigen('Datei aus dem Eingang löschen?', '„' + cur.dateiname + '“ wird aus dem lokalen Eingang entfernt. Die Originaldatei außerhalb des Terminals bleibt erhalten.',
            'Datei löschen', function () { void akEingangLoeschen(cur); });
        } }, 'Datei löschen')))));
}
