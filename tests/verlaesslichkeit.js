/* Verlässlichkeit: Pins, Importkonflikte, Sichtungsgüte, Ortsauflösung. Prüft den Checkout, aus dem es liegt (nicht /home/claude). Exit-Code 1 bei Fehlschlag. */
const PF = require('./_pfad.js'); const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1500, height: 950 } })).newPage(); const err = [];
  p.on('pageerror', x => err.push(x.message));
  await p.route(/geobasis|eox|gdi\.berlin|cartocdn|open-meteo|openfreemap|unpkg/, r => r.abort());
  await p.goto(PF.APP); await p.waitForTimeout(5200); await p.fill('#gate-pw', 'pw-test-123'); await p.fill('#gate-pw2', 'pw-test-123'); await p.click('#gate-go');
  await p.waitForFunction(() => !document.body.classList.contains('locked'), null, { timeout: 20000 });
  const r = await p.evaluate(() => {
    const o = {}, ids = () => PROFIL.pins.map(x => x.id).join(',');
    dispatch({ type: 'PIN_ANGELEGT', ll: [52.5, 13.4] }); dispatch({ type: 'PIN_ANGELEGT', ll: [52.6, 13.5] });
    const id1 = PROFIL.pins[0].id; dispatch({ type: 'PIN_ENTFERNT', id: id1 }); dispatch({ type: 'PIN_ANGELEGT', ll: [52.7, 13.6] });
    const neu = PROFIL.pins[PROFIL.pins.length - 1]; o.idNeu = neu.id !== id1 && PROFIL.pins.filter(x => x.id === neu.id).length === 1;
    const p2 = JSON.parse(JSON.stringify(PROFIL.pins[0])), basis = { v: 1, eigene: [], eigeneKanten: [] };
    /* gleiche ID und Position, andere Notiz: nicht still verwerfen */
    const abw = Object.assign({}, p2, { notiz: 'andere Notiz' }), n0 = PROFIL.pins.length;
    dispatch({ type: 'PROFIL_IMPORT', datei: 'a.json', profil: Object.assign({ pins: [abw] }, basis) });
    o.notizKopie = PROFIL.pins.length === n0 + 1 && PROFIL.pins.some(x => x.notiz === 'andere Notiz');
    /* zweimal dieselbe Datei: keine weitere Kopie */
    const n1 = PROFIL.pins.length; dispatch({ type: 'PROFIL_IMPORT', datei: 'a.json', profil: Object.assign({ pins: [abw] }, basis) }); o.zweimal = PROFIL.pins.length === n1;
    /* Positionskonflikt, ebenfalls zweimal */
    const pos = Object.assign({}, p2, { ll: [1, 2] }); dispatch({ type: 'PROFIL_IMPORT', datei: 'b.json', profil: Object.assign({ pins: [pos] }, basis) });
    const n2 = PROFIL.pins.length; dispatch({ type: 'PROFIL_IMPORT', datei: 'b.json', profil: Object.assign({ pins: [pos] }, basis) }); o.posZweimal = PROFIL.pins.length === n2;
    /* vollständig identischer Pin: keine Kopie */
    const n3 = PROFIL.pins.length; dispatch({ type: 'PROFIL_IMPORT', datei: 'c.json', profil: Object.assign({ pins: [JSON.parse(JSON.stringify(PROFIL.pins[0]))] }, basis) }); o.identisch = PROFIL.pins.length === n3;
    /* Konfliktkopie, in der Quelle nur umbenannt: Änderung geht nicht verloren; Originalname bleibt getrennt gespeichert */
    const ren = Object.assign({}, abw, { name: 'Umbenannt' }); const n4 = PROFIL.pins.length;
    dispatch({ type: 'PROFIL_IMPORT', datei: 'r.json', profil: Object.assign({ pins: [ren] }, basis) });
    o.umbenannt = PROFIL.pins.length === n4 + 1 && PROFIL.pins.some(x => x.importName === 'Umbenannt');
    /* eingehende IDs sind reserviert: Ersatz-ID kollidiert nicht mit einem späteren Pin derselben Datei */
    const hoch = PROFIL.pins.reduce((m, y) => Math.max(m, Number(/^PIN-(\d+)$/.exec(y.id)[1])), 0), nxt = 'PIN-' + String(hoch + 1).padStart(3, '0');
    dispatch({ type: 'PROFIL_IMPORT', datei: 'k.json', profil: Object.assign({ pins: [Object.assign({}, p2, { ll: [7, 8] }), { id: nxt, name: 'Spaeter', ll: [9, 9], zwecke: [], umgebung: {}, notiz: '', t: '2026-01-01T00:00:00.000Z' }] }, basis) });
    o.reserviert = PROFIL.pins.filter(x => x.id === nxt).length === 1 && PROFIL.pins.some(x => x.id === nxt && x.name === 'Spaeter') && new Set(PROFIL.pins.map(x => x.id)).size === PROFIL.pins.length;
    /* mitgebrachter Zähler wird berücksichtigt */
    dispatch({ type: 'PROFIL_IMPORT', datei: 'd.json', profil: Object.assign({ pins: [], seq: { pin: 40 } }, basis) }); dispatch({ type: 'PIN_ANGELEGT', ll: [52.8, 13.7] });
    o.zaehler = Number(PROFIL.pins[PROFIL.pins.length - 1].id.slice(4)) >= 41;
    /* Leeren: Pins weg, Zähler bleibt */
    dispatch({ type: 'PROFIL_LEEREN' }); o.pinsLeer = PROFIL.pins.length === 0; dispatch({ type: 'PIN_ANGELEGT', ll: [52.9, 13.8] }); o.zaehlerNachLeeren = Number(PROFIL.pins[0].id.slice(4)) > 41;
    /* Sichtung ohne Güte */
    const e = Object.keys(STATE.dossiers.entitaeten)[0]; dispatch({ type: 'SICHTUNG_HINZU', id: e, ort: 'irgendwo', text: 'test' });
    o.guete = STATE.dossiers.entitaeten[e].sichtungen.slice(-1)[0].guete;
    /* Ortsauflösung: mehrdeutig im Verzeichnis liefert keinen Punkt, exakt eindeutig schon */
    const verz = karteEbenenDaten().orte, nn = x => erkFold(String(x[0])).replace(/[^a-z0-9 ]/g, ' ').trim();
    const mehr = verz.map(nn).filter(n => n.length >= 5).map(n => n.slice(0, 5)).find((pf, i, a) => a.indexOf(pf) !== a.lastIndexOf(pf) && verz.filter(x => nn(x).indexOf(pf) === 0).length > 1 && !verz.some(x => nn(x) === pf));
    o.mehrdeutigPraefix = mehr; o.mehrdeutigKeinPunkt = mehr ? sichtungKoord({ ort: mehr }) === null : null;
    /* mehrdeutiger Dossier-Ort sperrt auch den Rückfall auf das Ortsverzeichnis */
    const alt = window.pool; window.pool = function () { return [{ id: 'T-A', typ: 'Ort', name: 'Tokyo Test A' }, { id: 'T-B', typ: 'Ort', name: 'Tokyo Test B' }]; };
    PROFIL.koord['T-A'] = [35.6, 139.7]; PROFIL.koord['T-B'] = [35.7, 139.8];
    const imAtlas = verz.some(x => nn(x) === 'tokyo'); o.tokyoImAtlas = imAtlas; o.tokyoMehrdeutig = sichtungKoord({ ort: 'Tokyo' }) === null;
    window.pool = alt; delete PROFIL.koord['T-A']; delete PROFIL.koord['T-B'];
    const eindeutig = verz.find(x => nn(x).length >= 5 && verz.filter(y => nn(y) === nn(x)).length === 1); o.exaktPunkt = eindeutig ? !!sichtungKoord({ ort: String(eindeutig[0]) }) : null;
    return o;
  });
  console.log(JSON.stringify(r)); let ok = true; const chk = (n, c) => { console.log((c ? 'OK   ' : 'FAIL ') + n); if (!c) ok = false; };
  chk('Pin-ID wird nicht wiederverwendet', r.idNeu); chk('gleiche ID, andere Notiz: als Kopie übernommen', r.notizKopie); chk('dieselbe Datei zweimal: keine weitere Kopie', r.zweimal);
  chk('Positionskonflikt zweimal: keine weitere Kopie', r.posZweimal); chk('identischer Pin: keine Kopie', r.identisch); chk('mitgebrachter Zähler wird berücksichtigt', r.zaehler);
  chk('Profil leeren entfernt Pins', r.pinsLeer); chk('ID-Zähler bleibt nach dem Leeren', r.zaehlerNachLeeren); chk('Sichtung ohne Güte ist unbewertet', r.guete === 'unbewertet');
  chk('mehrdeutiger Ortsname im Verzeichnis: kein Punkt (' + r.mehrdeutigPraefix + ')', r.mehrdeutigKeinPunkt === true); chk('eindeutiger Ortsname: Punkt', r.exaktPunkt === true);
  chk('Testfall Tokyo vorhanden im Ortsverzeichnis', r.tokyoImAtlas === true); chk('mehrdeutiger Dossier-Ort sperrt den Rückfall', r.tokyoMehrdeutig === true);
  chk('Konfliktkopie umbenannt: Änderung bleibt erhalten', r.umbenannt); chk('eingehende IDs reserviert', r.reserviert);
  chk('keine Seitenfehler', err.length === 0); if (err.length) console.log(err.join('|'));
  await b.close(); process.exit(ok ? 0 : 1);
})();
