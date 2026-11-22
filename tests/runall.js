/* Standard-Testauswahl der Playwright-Tests, unabhängig vom Ablageort des Projekts. Sie umfasst nicht alle Skripte in tests/ (siehe GRUPPEN);
   Historische UI-Tests (siehe docs/r5-bereinigung.md) sind per Namen weiterhin aufrufbar.
   Aufruf (im Ordner tests/, Playwright installiert):   node runall.js            Standardauswahl
                                                        node runall.js zev zp     nur diese Skripte (ohne .js)
   Je Gruppe laufen die Skripte parallel, höchstens FT_PARALLEL gleichzeitig (Vorgabe: os.availableParallelism(), ältere Node-Versionen: Anzahl der Kerne); Ausgaben und von den Tests geschriebene Dateien (zum Beispiel Screenshots) liegen in <TMP>/ft-out/.
   Ergebnis je Skript: grün; rot (Exit-Code != 0, Zeitüberschreitung nach 170 s oder Treffer auf FAIL, FEHLER: n, Fehlschläge: n, Error);
   ungeprüft (Exit 0, aber keine Ausgabe: das Skript hat nichts belegt); fehlt (Datei nicht vorhanden). Bekannt rote und unzuverlässige Skripte
   werden getrennt ausgewiesen. Exit-Code 1 bei jedem anderen roten oder ungeprüften Skript und bei einem ausdrücklich angeforderten, fehlenden Skript. */
const { spawn } = require('child_process'); const fs = require('fs'); const os = require('os'); const path = require('path');
const GRUPPEN = [
  ['kt', 'kv3', 'alterung', 'pin-nummern-tasten', 'speicher-voll'], ['rs'],
  ['un'], ['p4', 'pn', 'kc'],
  ['kartenprotokoll', 'pins', 'unterlagen', 'aussagen-alt', 'fallpaket', 'recherche'], ['kartensprung', 'identitaeten', 'verlaesslichkeit', 'arbeitsnavigation', 'kartenbereinigung', 'profil-arbeitsansicht'], ['profil-assessment', 'missionstrennung', 'dossier-einheitlich', 'phase5b2-recherchezugang', 'phase5b3-dossieroberflaeche', 'phase5b4-arbeitszugang', 'phase5b5-dossier-nachtraege', 'phase5b6-dossier-kennungen', 'phase5b7-missionsbetrieb', 'phase5c1a-profiltexte', 'phase5c1b-zustandsformat', 'dossier-kurzlage', 'dossier-nummern', 'dossier-maske', 'sichtung-pin', 'sichtung-import', 'bearbeitet-hinweis'], ['recherche-oberflaeche', 'karten-messen', 'ablage-eingang', 'lage-box', 'terminal-bruecken-ausfall', 'fall-modul', 'dossier-fallverweise', 'dossier-galerie-nummern', 'profil-seq-galerie', 'sichtung-export', 'arbeitsstand', 'lagebriefing', 'briefing-eintraege', 'fallpaket-x', 'arbeitsstand-tasten', 'terminal-konsole', 'terminal-link-kette', 'terminal-shell-kern', 'terminal-einwahl-abschluss', 'terminal-einwahl-realismus', 'terminal-tmux', 'terminal-befehlstabelle', 'terminal-auswahlliste', 'terminal-vorschlag', 'terminal-einfaerbung', 'terminal-ppp-persist', 'terminal-plog', 'terminal-tmux-bereiche', 'terminal-predict-anzeige', 'terminal-einwahl-zeiten', 'terminal-ppp-abbruch', 'terminal-link-end', 'terminal-onion', 'terminal-profanity-fenster', 'terminal-profanity-win10', 'terminal-nmap', 'terminal-profanity-sendfile', 'terminal-link-anzeige', 'terminal-profanity-kontakt', 'terminal-profanity-offline', 'terminal-strg-rechts', 'terminal-vorschlag-ergaenzung', 'terminal-benutzer', 'karte-sperre-pins', 'terminal-navigation', 'terminal-sudo', 'terminal-pin-suche', 'terminal-namensnavigation', 'terminal-vault', 'terminal-objektnavigation', 'terminal-archiv-zugriff']
];
/* Phase 5b7: Tests des stillgelegten Missionsablaufs, nicht mehr in der Standardauswahl, per Namen aufrufbar
   (Befunde: docs/phase5-missionsinventar.md, Abschnitte 5b7/5b8). Ein roter Lauf dort ist kein Befund gegen die Anwendung. */
const HISTORISCH = ['zn', 'zn3', 'zev', 'al', 'abd', 'zb', 'ds2', 'zp', 'sm', 'kwz', 'nx', 'm1flow', 'dp', 'wk3',
  /* Phase 5b8: Code der alten Module entfernt */ 'fg', 'tx', 'fgy', 'p3', 'ak2', 'au', 'p2',
  /* Phase 5b9: Dialogkern entfernt */ 'fd'];
const BEKANNT = { m1flow: 'Missionsablauf, auch auf main rot', 'lage-box': 'unter Parallellast instabil (animationKeinRueckfall), einzeln grün', wk3: 'unzuverlässig', dp: 'unzuverlässig' };
const FEHLER = /(^|\s)FAIL\b|FEHLER: [1-9]|Fehlschläge: [1-9]|Error/;
// Höchstzahl gleichzeitig laufender Skripte. Zu viele Browser auf wenigen Kernen lassen Tests am Start scheitern (Absturz, Ladezeit).
// availableParallelism zählt die dem Prozess verfügbaren Kerne (u. a. CPU-Affinität); os.cpus() alle Kerne des Rechners.
const PARALLEL = Math.max(1, Number(process.env.FT_PARALLEL) || (os.availableParallelism ? os.availableParallelism() : os.cpus().length) || 1);
// Art eines roten Ergebnisses, nur zur Anzeige: Absturz oder Start (Laden, Anmeldung) getrennt von fachlichen Fehlschlägen.
function fehlerArt(text) {
  if (/Target crashed|Target page, context or browser has been closed|browserType\.launch/.test(text)) return 'Absturz';
  if (/page\.goto: Timeout|waiting for locator\('#(gate-pw2?|gate-go|profil-terminal-oeffnen)'\)/.test(text.split('\n').slice(0, 6).join('\n'))) return 'Start';
  return 'fachlich';
}
// Eine Gruppe mit begrenzter Gleichzeitigkeit; Reihenfolge der Ergebnisse wie in der Gruppe.
async function gruppeLaufen(namen) {
  const erg = new Array(namen.length); let naechster = 0;
  const arbeiter = async () => { while (naechster < namen.length) { const i = naechster++; erg[i] = await lauf(namen[i]); } };
  await Promise.all(Array.from({ length: Math.min(PARALLEL, namen.length) }, arbeiter));
  return erg;
}
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
    k.on('close', code => {
      clearTimeout(t); out.end();
      const status = zeit ? 'Zeit' : (code !== 0 || FEHLER.test(text)) ? 'rot' : !text.trim() ? 'ungeprüft' : 'grün';
      res({ name, status, code, art: status === 'rot' ? fehlerArt(text) : null });
    });
  });
}
(async () => {
  const gruppen = wahl.length ? [wahl] : GRUPPEN, erg = [];
  console.log('Gleichzeitig: ' + PARALLEL + ' (FT_PARALLEL)\n');
  for (const g of gruppen) erg.push(...await gruppeLaufen(g));
  let neu = 0;
  erg.forEach(r => { const b = BEKANNT[r.name] || (HISTORISCH.indexOf(r.name) >= 0 ? 'historisch, stillgelegter Missionsablauf' : null), angefordert = wahl.indexOf(r.name) >= 0; console.log(r.name.padEnd(18) + r.status + (r.art && r.art !== 'fachlich' ? ' [' + r.art + ']' : '') + (r.status !== 'grün' && r.status !== 'fehlt' && b ? '  (bekannt: ' + b + ')' : '') + (r.status === 'fehlt' && angefordert ? '  (angefordert, aber nicht vorhanden)' : '')); if ((r.status === 'rot' || r.status === 'Zeit' || r.status === 'ungeprüft') && !b) neu++; if (r.status === 'fehlt' && angefordert) neu++; });
  console.log('\n' + erg.filter(r => r.status === 'grün').length + ' grün, ' + erg.filter(r => r.status === 'ungeprüft').length + ' ungeprüft, ' + erg.filter(r => r.status === 'fehlt').length + ' nicht vorhanden, ' + neu + ' unerwartet rot, ungeprüft oder fehlend. Ausgaben: ' + ausgabe);
  process.exit(neu ? 1 : 0);
})();
