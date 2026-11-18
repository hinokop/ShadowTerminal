/* Standard-Testauswahl der Playwright-Tests, unabhängig vom Ablageort des Projekts. Sie umfasst nicht alle Skripte in tests/ (siehe GRUPPEN);
   Historische UI-Tests (siehe docs/r5-bereinigung.md) sind per Namen weiterhin aufrufbar.
   Aufruf (im Ordner tests/, Playwright installiert):   node runall.js            Standardauswahl
                                                        node runall.js zev zp     nur diese Skripte (ohne .js)
   Je Gruppe laufen die Skripte parallel; Ausgaben und von den Tests geschriebene Dateien (zum Beispiel Screenshots) liegen in <TMP>/ft-out/.
   Ergebnis je Skript: grün; rot (Exit-Code != 0, Zeitüberschreitung nach 170 s oder Treffer auf FAIL, FEHLER: n, Fehlschläge: n, Error);
   ungeprüft (Exit 0, aber keine Ausgabe: das Skript hat nichts belegt); fehlt (Datei nicht vorhanden). Bekannt rote und unzuverlässige Skripte
   werden getrennt ausgewiesen. Exit-Code 1 bei jedem anderen roten oder ungeprüften Skript und bei einem ausdrücklich angeforderten, fehlenden Skript. */
const { spawn } = require('child_process'); const fs = require('fs'); const os = require('os'); const path = require('path');
const GRUPPEN = [
  ['kt', 'kv3', 'zn'], ['zn3', 'zev', 'dp', 'al', 'abd'], ['zb', 'ds2', 'wk3'], ['fgy', 'fd', 'fg', 'rs', 'm1flow'],
  ['zp', 'un', 'tx', 'sm'], ['au', 'p2', 'p3', 'p4', 'pn', 'kwz', 'nx', 'kc', 'ak2'],
  ['kartenprotokoll', 'pins', 'unterlagen', 'aussagen-alt', 'fallpaket', 'recherche'], ['kartensprung', 'identitaeten', 'verlaesslichkeit', 'arbeitsnavigation', 'kartenbereinigung', 'profil-arbeitsansicht'], ['profil-assessment', 'missionstrennung', 'dossier-einheitlich', 'dossier-kurzlage', 'dossier-nummern', 'dossier-maske', 'sichtung-pin', 'sichtung-import', 'bearbeitet-hinweis'], ['recherche-oberflaeche', 'karten-messen', 'ablage-eingang', 'lage-box', 'terminal-bruecken-ausfall', 'fall-modul', 'dossier-fallverweise', 'dossier-galerie-nummern', 'profil-seq-galerie', 'sichtung-export', 'arbeitsstand', 'lagebriefing', 'briefing-eintraege', 'fallpaket-x', 'arbeitsstand-tasten', 'terminal-konsole', 'terminal-link-kette', 'terminal-shell-kern', 'terminal-einwahl-abschluss', 'terminal-einwahl-realismus', 'terminal-tmux', 'terminal-befehlstabelle', 'terminal-auswahlliste', 'terminal-vorschlag', 'terminal-einfaerbung', 'terminal-plog']
];
const BEKANNT = { m1flow: 'Missionsablauf, auch auf main rot', abd: 'unzuverlässig', wk3: 'unzuverlässig', dp: 'unzuverlässig' };
const FEHLER = /(^|\s)FAIL\b|FEHLER: [1-9]|Fehlschläge: [1-9]|Error/;
const ausgabe = path.join(process.env.TMPDIR || os.tmpdir(), 'ft-out'); fs.mkdirSync(ausgabe, { recursive: true });
const wahl = process.argv.slice(2);
if (!fs.existsSync(path.join(__dirname, '..', 'kartenschluessel.js'))) console.log('Hinweis: ../kartenschluessel.js fehlt (lokale Datei, nie einchecken). Ohne sie erscheint ein Startfehler, einige Tests (zum Beispiel zn, pn) scheitern dann.\n');
function lauf(name) {
  return new Promise(res => {
    const datei = path.join(__dirname, name + '.js');
    if (!fs.existsSync(datei)) return res({ name, status: 'fehlt' });
    const out = fs.createWriteStream(path.join(ausgabe, name + '.txt')); let text = '';
    const k = spawn(process.execPath, [datei], { cwd: ausgabe, env: process.env }); let zeit = false;
    const t = setTimeout(() => { zeit = true; k.kill('SIGKILL'); }, 170000);
    const sammeln = d => { text += d; out.write(d); }; k.stdout.on('data', sammeln); k.stderr.on('data', sammeln);
    k.on('close', code => { clearTimeout(t); out.end(); res({ name, status: zeit ? 'Zeit' : (code !== 0 || FEHLER.test(text)) ? 'rot' : !text.trim() ? 'ungeprüft' : 'grün', code }); });
  });
}
(async () => {
  const gruppen = wahl.length ? [wahl] : GRUPPEN, erg = [];
  for (const g of gruppen) erg.push(...await Promise.all(g.map(lauf)));
  let neu = 0;
  erg.forEach(r => { const b = BEKANNT[r.name], angefordert = wahl.indexOf(r.name) >= 0; console.log(r.name.padEnd(18) + r.status + (r.status !== 'grün' && r.status !== 'fehlt' && b ? '  (bekannt: ' + b + ')' : '') + (r.status === 'fehlt' && angefordert ? '  (angefordert, aber nicht vorhanden)' : '')); if ((r.status === 'rot' || r.status === 'Zeit' || r.status === 'ungeprüft') && !b) neu++; if (r.status === 'fehlt' && angefordert) neu++; });
  console.log('\n' + erg.filter(r => r.status === 'grün').length + ' grün, ' + erg.filter(r => r.status === 'ungeprüft').length + ' ungeprüft, ' + erg.filter(r => r.status === 'fehlt').length + ' nicht vorhanden, ' + neu + ' unerwartet rot, ungeprüft oder fehlend. Ausgaben: ' + ausgabe);
  process.exit(neu ? 1 : 0);
})();
