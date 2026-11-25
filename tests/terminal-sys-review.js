/* Paket 3, Review #139: Regressionen zu den Befunden.
   A: A0 mit Bestandsprofil (VFS aus Paket 1/2 ohne /etc) ohne jedes Warten des Tests auf interne Bereitschaft: Installation bei der Anmeldung,
      DIALING im Fensterkopf, Verbindung nach der bisherigen Dauer, tatsächlicher LOS-Countdown.
   B: Installation als Transaktion (zu wenig Platz: nichts installiert, klare Meldung, erneuter Versuch bei der nächsten Anmeldung), Sicherung
      danach angestoßen, Zähler nach Wiederherstellung gleich der Neuberechnung (einschließlich /etc selbst).
   C: Wiederherstellung und Import von /etc nur mit sudo-Kennwort (falsch, abgebrochen, --home und altes Format ohne Abfrage, beide Bereiche),
      Rechtevertrag (uid, /etc/wireguard), Schlüssel und Modi nach Wiederherstellung, home-export mit /etc nur nach Kennwort (echte Brücke).
   D: Installationsregister und Wiederherstellung in einem frischen Profil: eine bewusst gelöschte Datei bleibt gelöscht.
   E: Änderung aus einem anderen Fenster wirkt beim nächsten Dienststart ohne neue Anmeldung; Antworten einer beendeten Sitzung gelten nicht.
   F: predict: QTH gültig, ungültig (gemeldet), fehlend (Ausgangsort des Profils), laufendes predict unverändert, nächster Start neu, Restore --home;
      eigene Bahndaten predict.tle (gültig, Prüfsummenfehler, -t), Einwahl bleibt auf der Relaiskette.
   G: Dossiernotiz löschen: Oberfläche mit Sicherheitsabfrage, notes delete im Dossierverzeichnis, Sperre, Speicherfehler mit Rücknahme, Protokoll.
   H: WireGuard: ungültige Address und MTU (Meldungen von iproute2 6.1.0), eigene Adresse außerhalb des Tunnelnetzes ohne Handshake. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');
const { APP, ROOT } = require('./_pfad');
const { bis } = require('./_kestrel');

const PW = 'pw-test-123';
const tmp = p => fs.mkdtempSync(path.join(os.tmpdir(), p));
async function bruecke(sicher) {
  const archiv = tmp('ft-arch-');
  fs.mkdirSync(path.join(archiv, 'pgcl-eu3.arch07'));
  fs.copyFileSync(path.join(ROOT, 'terminal_lokal.py'), path.join(archiv, 'terminal_lokal.py'));
  const py = spawn('python3', [path.join(archiv, 'terminal_lokal.py'), '--serve-only'], { env: { ...process.env, SHADOW_TERMINAL_HOME: sicher } });
  const fragment = await new Promise((ok, fail) => { py.stdout.on('data', d => { const m = /#db=\d+\.[\w-]+/.exec(String(d)); if (m) ok(m[0]); }); py.on('exit', () => fail(new Error('Brücke beendet'))); setTimeout(() => fail(new Error('Brücke startet nicht')), 8000); });
  return { py, fragment };
}
/* Seite mit Anmeldung; das Terminal wird geöffnet, der Test wartet NICHT auf die Bereitschaft der Konfiguration */
async function seite(ctx, fragment) {
  const p = await ctx.newPage();
  p.setDefaultTimeout(20000);
  p.fehler = [];
  p.on('pageerror', e => p.fehler.push(e.message));
  await p.route(/^https?:/, r => /^http:\/\/127\.0\.0\.1:\d+\/db$/.test(r.request().url()) && fragment ? r.continue() : r.abort());
  await p.goto(APP + (fragment || ''));
  await p.fill('#gate-pw', PW); if (await p.isVisible('#gate-pw2')) await p.fill('#gate-pw2', PW);
  await p.click('#gate-go');
  await p.waitForFunction(() => typeof APP_BEREIT !== 'undefined' && APP_BEREIT && !document.body.classList.contains('locked'));
  await p.click('#profil-terminal-oeffnen');
  const inp = p.locator('#profil-terminal-eingabe'), out = p.locator('#profil-terminal-ausgabe');
  const fertig = () => p.waitForFunction(() => !TERMINAL_ZUSTAND.kette && !TERMINAL_ZUSTAND.dateiLaeuft && !TERMINAL_ZUSTAND.sudo);
  p.lauf = async z => {
    const roh = await out.textContent(), vorher = roh === '' ? 0 : roh.split('\n').length;
    await inp.fill(z); await inp.press('Enter'); await fertig();
    return (await out.textContent()).split('\n').slice(vorher + 1).join('\n');
  };
  /* Befehl mit Kennwortabfrage: kennwort null bricht mit Strg+C ab, sonst so viele Versuche wie nötig (falsch: drei) */
  p.mitKennwort = async (z, kennwort = PW) => {
    const roh = await out.textContent(), vorher = roh.split('\n').length;
    await inp.fill(z); await inp.press('Enter');
    await p.waitForFunction(() => !!TERMINAL_ZUSTAND.sudo && !TERMINAL_ZUSTAND.sudo.pruefen);
    if (kennwort === null) await inp.press('Control+c');
    else for (let i = 0; i < 3; i++) {
      await p.waitForFunction(() => !TERMINAL_ZUSTAND.sudo || !TERMINAL_ZUSTAND.sudo.pruefen);
      if (!(await p.evaluate(() => !!TERMINAL_ZUSTAND.sudo))) break;
      await inp.focus(); await p.keyboard.type(kennwort); await p.keyboard.press('Enter');
    }
    await fertig();
    return (await out.textContent()).split('\n').slice(vorher + 1).filter(l => !l.startsWith('[sudo] password for raizo:') && l !== 'Sorry, try again.').join('\n');
  };
  p.inp = inp; p.out = out;
  return p;
}
/* Datei im VFS direkt setzen (Verwaltung) und den Stand neu lesen lassen */
const setze = async (p, pfad, text, priv = true) => {
  await p.evaluate(async ([seg, t, pr]) => { await terminalVfsBereit(); const r = await TERMINAL_VFS.schreiben(seg, t, { privilegiert: pr }); if (r.fehler) throw new Error(r.fehler); terminalSysGeaendert(); }, [pfad.split('/').filter(Boolean), text, priv]);
  await p.waitForFunction(() => terminalSysAktuell());
};
/* Zähler gegen Neuberechnung aller Knoten außer den festen (Wurzel, /home, /home/raizo, /tmp) */
const zaehlerStimmt = p => p.evaluate(async () => {
  const rek = async seg => { const d = await TERMINAL_VFS.readdir(seg, { privilegiert: true }); let k = 0, b = 0; for (const e of d.eintraege) { k++; const s = seg.concat(e.name); if (e.dir) { const r = await rek(s); k += r.k; b += r.b; } else b += new TextEncoder().encode((await TERMINAL_VFS.readFile(s, { privilegiert: true })).text).length; } return { k, b }; };
  const teile = [await rek(['home', 'raizo']), await rek(['tmp'])], etc = await TERMINAL_VFS.stat(['etc'], { privilegiert: true });
  if (!etc.fehler) { const r = await rek(['etc']); teile.push({ k: r.k + 1, b: r.b }); }
  const soll = teile.reduce((a, x) => ({ k: a.k + x.k, b: a.b + x.b }), { k: 0, b: 0 }), z = await TERMINAL_VFS.zaehler();
  return z.knoten === soll.k && z.bytes === soll.b ? true : JSON.stringify({ z, soll });
});
/* VFS in den Stand vor Paket 3 versetzen: /etc und das Installationsregister entfernen (Bestandsprofil aus Paket 1/2) */
const ohneEtc = p => p.evaluate(() => new Promise((ok, fail) => {
  const r = indexedDB.open('fieldterminal.vfs', 1);
  r.onsuccess = () => {
    const db = r.result, t = db.transaction(['knoten', 'meta'], 'readwrite'), k = t.objectStore('knoten');
    k.getAll().onsuccess = ev => {
      const alle = ev.target.result, etc = alle.find(n => n.eltern === 1 && n.name === 'etc'), weg = new Set(etc ? [etc.id] : []);
      let neu = true;
      while (neu) { neu = false; for (const n of alle) if (!weg.has(n.id) && weg.has(n.eltern)) { weg.add(n.id); neu = true; } }
      weg.forEach(id => k.delete(id));
      t.objectStore('meta').delete('sysInstalliert');
    };
    t.oncomplete = () => { db.close(); ok(); }; t.onerror = () => fail(t.error);
  };
  r.onerror = () => fail(r.error);
}));

(async () => {
  const profil = tmp('ft-sysr-'), sicher = tmp('ft-sysr-home-');
  const { py, fragment } = await bruecke(sicher);
  let ctx = await chromium.launchPersistentContext(profil, { reducedMotion: 'reduce', viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  try {
    /* ---- A: A0 mit Bestandsprofil, ohne Warten auf interne Bereitschaft ---- */
    let p = await seite(ctx, fragment);
    assert.equal(await p.lauf('echo alt > bestand.txt; cat bestand.txt'), 'alt');
    await p.lauf('exit');
    await ohneEtc(p);
    await p.close();
    p = await seite(ctx, fragment);
    await p.clock.install();
    await p.evaluate(() => Object.assign(TERMINAL_PPP_DAUER, { connect: [3250, 3250], ppp: [750, 750], ip: [1900, 1900] }));
    /* Uhr in einen Überflug (reine Bahnrechnung, unabhängig von der Anmeldung) */
    const ziel = await p.evaluate(() => { let ab = Date.now(); for (let k = 0; k < 60; k++) { let best = null; for (const sat of kestrelSats()) { const u = kestrelUeberflug(sat, ab); if (u && (!best || u.von < best.von)) best = u; } if (best.maxEl >= 15) { let t = Math.max(best.von, Date.now() + 1000); while (kestrelEl(best.sat, t) < 10 && t < best.bis) t += 5000; if (best.bis - t >= 360000) return t; } ab = best.bis + 60000; } return null; });
    for (let j = await p.evaluate(() => Date.now()); ziel - j > 600000;) { j += 600000; await p.clock.pauseAt(new Date(j)); await p.evaluate(() => document.dispatchEvent(new Event('pointermove'))); }
    await p.clock.pauseAt(new Date(ziel));
    await p.evaluate(() => { TERMINAL_ZUSTAND.wahlVorgabe = 'ok'; });
    await p.inp.fill('pon kestrel && tmux'); await p.inp.press('Enter');
    await p.waitForFunction(() => /DIALING/.test(document.getElementById('profil-terminal-sat').textContent), null, { timeout: 20000 });
    const start = await p.evaluate(() => Date.now());
    await p.clock.runFor(6600);
    assert.equal(await p.evaluate(() => TERMINAL_ZUSTAND.modem?.bereit), false);
    await p.clock.runFor(200);
    assert.equal(await p.evaluate(() => TERMINAL_ZUSTAND.modem?.bereit), true, 'A0 im Bestandsprofil: Verbindung nach der bisherigen Dauer ab DIALING');
    assert.ok(await p.evaluate(() => Date.now()) - start <= 6800);
    const los1 = await p.locator('#profil-terminal-sat').textContent();
    await p.clock.runFor(2000);
    const los2 = await p.locator('#profil-terminal-sat').textContent(), sek = t => { const m = /(\d\d):(\d\d):(\d\d)/.exec(t); return m ? +m[1] * 3600 + +m[2] * 60 + +m[3] : null; };
    assert.ok(sek(los1) !== null && sek(los1) - sek(los2) === 2, 'tatsächlicher Countdown: ' + los1 + ' -> ' + los2);
    await p.clock.resume();
    await p.waitForFunction(() => !TERMINAL_ZUSTAND.kette);
    assert.equal(await p.lauf('cat bestand.txt; ls /etc'), 'alt\nchatscripts\nhostname\nhosts\nos-release\nppp\nwireguard', 'Bestand erhalten, /etc bei der Anmeldung installiert');
    assert.doesNotMatch(await p.out.textContent(), /\[sudo\]|could not be installed/);
    await p.lauf('poff'); await p.lauf('tmux kill-server');
    assert.equal(await zaehlerStimmt(p), true, 'Zähler nach Installation');

    /* ---- B: Installation als Transaktion ---- */
    await p.lauf('exit');
    await p.evaluate(async () => {
      /* VFS bis auf wenige Bytes füllen (Bestand, der unter Paket 1 gültig war) */
      await terminalVfsBereit(); const z = await TERMINAL_VFS.zaehler(), frei = TERMINAL_VFS.GRENZE.gesamt - z.bytes - 400;
      for (let i = 0, rest = frei; rest > 0; i++) { const n = Math.min(rest, 1048576); const r = await TERMINAL_VFS.schreiben(['home', 'raizo', 'fuell' + i], 'x'.repeat(n), {}); if (r.fehler) throw new Error(r.fehler); rest -= n; }
      await terminalVfsEnde();
    });
    /* Stand vor Paket 3 herstellen: /etc fehlt, der freie Platz reicht nicht für die Standards (Datei aus der Zeit vor der Installation) */
    await ohneEtc(p);
    await p.evaluate(() => new Promise((ok, fail) => {
      const r = indexedDB.open('fieldterminal.vfs', 1);
      r.onsuccess = () => { const db = r.result, t = db.transaction(['knoten'], 'readwrite'); const j = Date.now();
        t.objectStore('knoten').add({ eltern: 3, name: 'vorher.txt', typ: 'file', modus: 0o644, uid: 1000, gid: 1000, erstellt: j, geaendert: j, groesse: 2400, inhalt: 'v'.repeat(2400), fluechtig: false, version: 1 });
        t.oncomplete = () => { db.close(); ok(); }; t.onerror = () => fail(t.error); };
      r.onerror = () => fail(r.error);
    }));
    await p.click('#profil-terminal-oeffnen');
    await p.waitForFunction(() => /default configuration in \/etc could not be installed/.test(document.getElementById('profil-terminal-ausgabe').textContent));
    assert.match(await p.out.textContent(), /terminal: the default configuration in \/etc could not be installed \(No space left on device: \d+ files\); free space in \/home or \/tmp, then exit and open the terminal again/);
    assert.equal(await p.evaluate(async () => (await TERMINAL_VFS.stat(['etc'], { privilegiert: true })).fehler), 'ENOENT', 'nichts teilweise installiert');
    assert.match(await p.lauf('pon kestrel'), /Can't open options file|does not exist/, 'ohne Installation keine erfundene Konfiguration');
    await p.lauf('rm fuell0 vorher.txt');
    await p.lauf('exit');
    await p.evaluate(() => { TERMINAL_ZUSTAND.homeAenderung = false; });
    await p.click('#profil-terminal-oeffnen');
    await p.waitForFunction(() => terminalSysAktuell());
    assert.equal(await p.lauf('ls /etc/ppp/peers'), 'kestrel', 'erneuter Versuch bei der nächsten Anmeldung');
    assert.equal(await p.evaluate(() => TERMINAL_ZUSTAND.homeAenderung), true, 'Installation stößt die Sicherung an');
    for (let i = 2; i < 20; i++) await p.lauf('rm -f fuell' + i);
    assert.equal(await zaehlerStimmt(p), true);

    /* ---- C: Wiederherstellung, Import und Export von /etc nur mit Kennwort (echte Brücke) ---- */
    const schluessel = (await p.mitKennwort('sudo cat /etc/wireguard/wg-sat.key')).trim();
    const b1 = await p.lauf('home-backup'), name1 = /home-\S+\.json/.exec(b1)[0];
    assert.match(b1, /in \/etc/);
    await setze(p, '/etc/hosts', 'geaendert\n');
    await setze(p, '/etc/wireguard/wg-sat.key', 'kaputt\n');
    assert.equal(await p.mitKennwort('home-restore --yes --etc ' + name1, 'falsch'), 'sudo: 3 incorrect password attempts\nhome-restore: changing /etc requires administrator authentication; nothing changed');
    assert.equal(await p.lauf('cat /etc/hosts'), 'geaendert', 'falsches Kennwort: nichts geändert');
    assert.match(await p.mitKennwort('home-restore --yes ' + name1, null), /home-restore: changing \/etc requires administrator authentication; nothing changed$/);
    assert.equal(await p.lauf('echo $?'), '130');
    assert.equal(await p.lauf('cat /etc/hosts'), 'geaendert', 'abgebrochen: nichts geändert');
    const vorHome = await p.lauf('home-restore --yes --home ' + name1);
    assert.match(vorHome, /^home-restore: \d+ entries restored from /, '--home ohne Kennwort');
    assert.doesNotMatch(vorHome, /\[sudo\]/);
    assert.match(await p.mitKennwort('home-restore --yes --etc ' + name1), /^home-restore: 11 entries restored to \/etc from /);
    assert.match(await p.lauf('cat /etc/hosts'), /^127\.0\.0\.1 localhost/);
    assert.equal((await p.mitKennwort('sudo cat /etc/wireguard/wg-sat.key')).trim(), schluessel, 'Schlüssel aus der Sicherung');
    assert.match(await p.mitKennwort('sudo ls -l /etc/wireguard'), /^-rw------- .* wg-sat\.conf\n-rw------- .* wg-sat\.key$/, 'Modi aus der Sicherung');
    assert.match(await p.lauf('ls -l /etc'), /^drwx------ .* wireguard$/m);
    assert.equal(await zaehlerStimmt(p), true, 'Zähler nach Wiederherstellung (einschließlich /etc selbst)');
    /* altes Format 2 ohne /etc: keine Abfrage, /etc unverändert */
    const paket = JSON.parse(fs.readFileSync(path.join(sicher, name1), 'utf8'));
    const alt = JSON.parse(JSON.stringify(paket)); delete alt.etc; delete alt.manifest.etc; alt.version = 2;
    fs.writeFileSync(path.join(sicher, 'home-20261101T000000Z.json'), JSON.stringify(alt));
    await setze(p, '/etc/hosts', 'bleibt\n');
    assert.match(await p.lauf('home-restore --yes home-20261101T000000Z.json'), /^home-restore: \d+ entries restored from home-20261101T000000Z\.json\nprevious state/);
    assert.equal(await p.lauf('cat /etc/hosts'), 'bleibt');
    /* Rechtevertrag: /etc mit uid 1000 oder /etc/wireguard für andere lesbar wird abgewiesen (vor jeder Abfrage) */
    const hashe = t => p.evaluate(x => terminalHomeHash(x), t);
    for (const [aendern, n] of [[x => { x.etc[0].uid = 1000; }, '02'], [x => { x.etc.find(e => e.name === 'wireguard').modus = 0o755; }, '03']]) {
      const m = JSON.parse(JSON.stringify(paket)); aendern(m); m.manifest.etc.sha256 = await hashe(JSON.stringify(m.etc));
      fs.writeFileSync(path.join(sicher, 'home-202611' + n + 'T000000Z.json'), JSON.stringify(m));
      assert.equal(await p.lauf('home-restore --yes home-202611' + n + 'T000000Z.json'), 'home-restore: home-202611' + n + 'T000000Z.json: not a valid backup (owner or permissions in /etc); nothing changed');
    }
    /* Export: mit /etc nur nach Kennwort und mit Hinweis; --home ohne */
    const downloads = []; p.on('download', d => downloads.push(d.suggestedFilename()));
    assert.match(await p.lauf('home-export --home'), /^home-export: home-\S+\.json \(\d+ entries\) handed to the browser download$/);
    assert.equal(await p.mitKennwort('home-export', 'falsch'), 'sudo: 3 incorrect password attempts\nhome-export: exporting /etc requires administrator authentication; nothing exported (home-export --home exports /home/raizo only)');
    const ex = await p.mitKennwort('home-export');
    assert.match(ex, /^home-export: home-\S+\.json \(\d+ entries in \/home\/raizo, 11 in \/etc\) handed to the browser download\nhome-export: the file contains \/etc including the private WireGuard key \(\/etc\/wireguard\/wg-sat\.key\) unencrypted; keep it private$/);
    await p.waitForTimeout(500);
    assert.equal(downloads.length, 2, 'zwei Exporte, der abgewiesene ohne Datei');

    /* ---- D: Register und Wiederherstellung in einem frischen Profil ---- */
    await p.mitKennwort('sudo rm /etc/os-release');
    const b2 = await p.lauf('home-backup'), name2 = /home-\S+\.json/.exec(b2)[0];
    assert.match(b2, /10 in \/etc/);
    const ctx2 = await chromium.launchPersistentContext(tmp('ft-sysr2-'), { reducedMotion: 'reduce' });
    const q = await seite(ctx2, fragment);
    assert.match(await q.lauf('cat /etc/os-release'), /^PRETTY_NAME=/, 'frisches Profil: installiert');
    assert.match(await q.mitKennwort('home-restore --yes --etc ' + name2), /^home-restore: 10 entries restored to \/etc/);
    await q.lauf('exit'); await q.click('#profil-terminal-oeffnen');
    assert.equal(await q.lauf('cat /etc/os-release'), 'cat: /etc/os-release: No such file or directory', 'bewusst gelöscht bleibt gelöscht, auch nach erneuter Anmeldung');
    assert.equal((await q.mitKennwort('sudo cat /etc/wireguard/wg-sat.key')).trim(), schluessel, 'Schlüssel des alten Profils übernommen');
    await ctx2.close();
    await p.mitKennwort('sudo cp /usr/lib/os-release /etc/os-release');

    /* ---- E: anderes Fenster, Sitzungsbindung ---- */
    const p2 = await seite(ctx, fragment);
    await p2.waitForFunction(() => terminalSysAktuell());
    await p.waitForFunction(() => terminalSysAktuell());
    const chat = await p.lauf('cat /etc/chatscripts/kestrel');
    await setze(p2, '/etc/chatscripts/kestrel', chat.replace('ATDT00882994401', 'ATDT0049301234567') + '\n');
    assert.equal(await p.evaluate(() => terminalSysAktuell()), false, 'Fenster 1 erkennt den veralteten Stand synchron');
    await p.evaluate(() => { TERMINAL_ZUSTAND.wahlVorgabe = 'ok'; });
    await p.clock.install();
    const ziel2 = await p.evaluate(() => { let ab = Date.now(); for (let k = 0; k < 60; k++) { let best = null; for (const sat of kestrelSats()) { const u = kestrelUeberflug(sat, ab); if (u && (!best || u.von < best.von)) best = u; } if (best.maxEl >= 15) { let t = Math.max(best.von, Date.now() + 1000); while (kestrelEl(best.sat, t) < 10 && t < best.bis) t += 5000; if (best.bis - t >= 360000) return t; } ab = best.bis + 60000; } return null; });
    for (let j = await p.evaluate(() => Date.now()); ziel2 - j > 600000;) { j += 600000; await p.clock.pauseAt(new Date(j)); await p.evaluate(() => document.dispatchEvent(new Event('pointermove'))); }
    await p.clock.pauseAt(new Date(ziel2));
    await p.evaluate(() => { TERMINAL_ZUSTAND.syslog = []; });
    await p.lauf('pon kestrel');
    await bis(p, () => TERMINAL_ZUSTAND.syslog.some(z => /send \(ATDT/.test(z)));
    assert.ok(await p.evaluate(() => TERMINAL_ZUSTAND.syslog.some(z => /send \(ATDT0049301234567\^M\)/.test(z))), 'neue Nummer beim nächsten Dienststart, ohne neue Anmeldung');
    await p.lauf('poff');
    await p.clock.resume();
    await setze(p2, '/etc/chatscripts/kestrel', chat + '\n');
    await p2.close();
    /* Sitzungsbindung: ein Ladevorgang der beendeten Sitzung überschreibt die neue nicht */
    assert.equal(await p.evaluate(async () => { const alt = terminalSysSitzung; await terminalVfsEnde(); await terminalSysLaden(alt, false); return TERMINAL_SYS.bereit; }), false);
    await p.click('#profil-terminal-oeffnen').catch(() => {});
    await p.evaluate(() => terminalVfsBereit());
    await p.waitForFunction(() => terminalSysAktuell());

    /* ---- F: predict (QTH und Bahndaten) ---- */
    await p.lauf('mkdir -p .predict');
    const zeile = async z => (await p.lauf(z)).split('\n')[0];
    const berlin = await zeile('predict -f KESTREL-1 1795600000');
    await setze(p, '/home/raizo/.predict/predict.qth', 'TOKYO\n35.68\n-139.69\n40\n', false);
    const tokyo = await zeile('predict -f KESTREL-1 1795600000');
    assert.notEqual(tokyo, berlin, 'eigene QTH-Datei hat Vorrang');
    await setze(p, '/home/raizo/.predict/predict.qth', 'TOKYO\n35.68\n\n40\n', false);
    assert.equal(await p.lauf('predict -f KESTREL-1 1795600000'), "predict: ~/.predict/predict.qth: invalid longitude ''", 'leere Länge ist kein Wert 0');
    assert.equal(await p.lauf('echo $?'), '1');
    await setze(p, '/home/raizo/.predict/predict.qth', 'TOKYO\n35.68\n-139.69\n', false);
    assert.match(await p.lauf('predict -f KESTREL-1 1795600000'), /^predict: ~\/\.predict\/predict\.qth: expected four lines/);
    await p.evaluate(async () => { await TERMINAL_VFS.entfernen(['home', 'raizo', '.predict', 'predict.qth'], {}); terminalSysGeaendert(); });
    await p.waitForFunction(() => terminalSysAktuell());
    assert.equal(await zeile('predict -f KESTREL-1 1795600000'), berlin, 'ohne Datei: Standort der Station');
    await p.evaluate(() => { dispatch({ type: 'AUSGANG_ANGELEGT', name: 'Kiel', art: ART_AUSGANG[0], ll: [54.32, 10.13] }); });
    const kiel = await zeile('predict -f KESTREL-1 1795600000');
    assert.notEqual(kiel, berlin, 'dynamisch der Ausgangsort des Profils');
    /* laufendes predict behält seinen QTH, der nächste Start übernimmt die Änderung */
    await p.lauf('tmux'); await p.lauf('tmux split-window -bd predict');
    const kopf = () => p.locator('.tmux-pane').first().textContent();
    assert.match(await kopf(), /QTH Kiel /);
    await setze(p, '/home/raizo/.predict/predict.qth', 'TOKYO\n35.68\n-139.69\n40\n', false);
    await p.waitForTimeout(600);
    assert.match(await kopf(), /QTH Kiel /, 'laufender Bereich unverändert (S5)');
    await p.lauf("tmux kill-pane -t '{up-of}'"); await p.lauf('tmux split-window -bd predict'); await p.waitForTimeout(400);
    assert.match(await kopf(), /QTH TOKYO 35\.68N 139\.69E \(predict\.qth\)/, 'nächster Start mit eigener Datei, gekennzeichnet');
    await p.lauf('tmux kill-server');
    /* Wiederherstellung --home aktualisiert den QTH */
    const b3 = await p.lauf('home-backup'), name3 = /home-\S+\.json/.exec(b3)[0];
    await setze(p, '/home/raizo/.predict/predict.qth', 'OSLO\n59.91\n-10.75\n20\n', false);
    await p.lauf('home-restore --yes --home ' + name3);
    await p.waitForFunction(() => terminalSysAktuell() && TERMINAL_SYS.qth && TERMINAL_SYS.qth.name === 'TOKYO');
    /* eigene Bahndaten: gültig (umbenannter Satellit), Prüfsummenfehler, -t; die Einwahl bleibt auf der Relaiskette */
    const tle = await p.lauf('cat /var/cache/tle/kestrel.tle');
    await setze(p, '/home/raizo/.predict/predict.tle', tle.replace('KESTREL-2', 'EIGEN-2') + '\n', false);
    assert.match(await p.lauf('predict -f EIGEN-2 1795600000'), /^1795600000 /);
    assert.equal(await p.lauf('predict -f KESTREL-2 1795600000'), 'predict: "KESTREL-2" not found in ~/.predict/predict.tle');
    assert.ok(await p.evaluate(() => kestrelSats().some(s => s.name === 'KESTREL-2')), 'Relaiskette unverändert');
    const kaputt = tle.split('\n'); kaputt[1] = kaputt[1].slice(0, 68) + String((Number(kaputt[1][68]) + 1) % 10);
    await setze(p, '/home/raizo/.predict/predict.tle', kaputt.join('\n') + '\n', false);
    assert.equal(await p.lauf('predict -f KESTREL-1 1795600000'), 'predict: ~/.predict/predict.tle: KESTREL-1: checksum error in line 1');
    await setze(p, '/home/raizo/eins.tle', tle.split('\n').slice(0, 3).join('\n') + '\n', false);
    await p.evaluate(async () => { await TERMINAL_VFS.entfernen(['home', 'raizo', '.predict', 'predict.tle'], {}); terminalSysGeaendert(); });
    await p.waitForFunction(() => terminalSysAktuell());
    assert.match(await p.lauf('predict -t eins.tle -f KESTREL-1 1795600000'), /^1795600000 /, '-t mit eigener Datei');
    assert.equal(await p.lauf('predict -t eins.tle -f KESTREL-2 1795600000'), 'predict: "KESTREL-2" not found in eins.tle');
    assert.equal(await p.lauf('predict -t fehlt.tle'), 'predict: fehlt.tle: No such file or directory');
    await p.lauf('rm -r .predict eins.tle');

    /* ---- G: Dossiernotiz löschen ---- */
    await p.lauf('cd /intel/dossiers/persons/P-0001');
    await p.lauf('echo erste >> notes'); await p.lauf('echo zweite >> notes');
    const ids = await p.evaluate(() => STATE.dossiers.entitaeten['P-0001'].notizen.map(n => n.id));
    const [n1, n2] = ids.slice(-2);
    assert.equal(await p.lauf('notes delete ' + n1), '');
    assert.equal(await p.lauf('echo $?'), '0');
    assert.doesNotMatch(await p.lauf('cat notes'), new RegExp(n1 + '\\b'));
    assert.equal(await p.lauf('notes delete ' + n1), 'notes: ' + n1 + ': No such note');
    assert.equal(await p.lauf('echo x > notes'), 'bash: notes: Read-only file system', 'notes bleibt schreibgeschützt');
    assert.equal(await p.lauf('rm notes'), "rm: cannot remove 'notes': Read-only file system");
    assert.match(await p.evaluate(() => STATE.log.at(-1).aktion + ': ' + STATE.log.at(-1).detail), new RegExp('^Dossiernotiz gelöscht: P-0001 .*, ' + n1 + ': erste \\(Terminal\\)$'));
    /* Speicherfehler: Rücknahme, Notiz bleibt */
    await p.evaluate(() => { window.__sg = Store.saveGeprueft; Store.saveGeprueft = () => 'fehler'; });
    assert.equal(await p.lauf('notes delete ' + n2), 'notes: ' + n2 + ': Input/output error');
    await p.evaluate(() => { Store.saveGeprueft = window.__sg; });
    assert.ok(await p.evaluate(n => STATE.dossiers.entitaeten['P-0001'].notizen.some(x => x.id === n), n2), 'Rücknahme');
    assert.ok(await p.evaluate(n => JSON.parse(localStorage.getItem(STORAGE_KEY)).dossiers.entitaeten['P-0001'].notizen.some(x => x.id === n), n2), 'gespeicherter Stand unverändert');
    /* Sperre */
    await p.lauf('cd /intel/dossiers/persons/P-0002'); await p.lauf('echo gesperrt >> notes');
    const n3 = await p.evaluate(() => STATE.dossiers.entitaeten['P-0002'].notizen.at(-1).id);
    await p.evaluate(() => dispatch({ type: 'DOSSIER_SPERREN', id: 'P-0002' }));
    assert.equal(await p.lauf('notes delete ' + n3), 'notes: ' + n3 + ': Permission denied');
    await p.evaluate(() => dispatch({ type: 'DOSSIER_ENTSPERREN', id: 'P-0002' }));
    await p.lauf('cd /');
    assert.equal(await p.lauf('notes delete ' + n3), 'notes: not in a dossier directory (cd /intel/dossiers/<type>/<ID>)');
    /* Oberfläche: Sicherheitsabfrage, gleiche Aktion */
    await p.evaluate(() => terminalKonsoleSchliessen());
    await p.evaluate(() => dispatch({ type: 'DOSSIER_GEOEFFNET', id: 'P-0001', navigieren: true }));
    const knopf = p.locator('button.dn-loeschen[data-notiz="' + n2 + '"]');
    await knopf.click();
    await p.locator('#dlg').waitFor({ state: 'visible' });
    assert.match(await p.locator('#dlg').textContent(), new RegExp(n2 + ' zu P-0001 wird gelöscht: "zweite"'));
    await p.locator('#dlg button', { hasText: 'Abbrechen' }).click();
    assert.ok(await p.evaluate(n => STATE.dossiers.entitaeten['P-0001'].notizen.some(x => x.id === n), n2), 'Abbrechen löscht nichts');
    await knopf.click();
    await p.locator('#dlg button', { hasText: 'Notiz löschen' }).click();
    await p.waitForFunction(n => !STATE.dossiers.entitaeten['P-0001'].notizen.some(x => x.id === n), n2);
    assert.match(await p.evaluate(() => STATE.log.at(-1).detail), new RegExp(n2 + ': zweite$'));
    assert.ok(await p.evaluate(n => !JSON.parse(localStorage.getItem(STORAGE_KEY)).dossiers.entitaeten['P-0001'].notizen.some(x => x.id === n), n2), 'dauerhaft gespeichert');

    /* ---- H: WireGuard Address und MTU ---- */
    await p.evaluate(() => terminalKonsoleOeffnen());
    const wg = (await p.mitKennwort('sudo cat /etc/wireguard/wg-sat.conf')) + '\n';
    const pruef = await p.evaluate(([w]) => {
      const k = sysWgKonfig; return Promise.all([
        sysWgAdresseGueltig('10.200.200.2/24'), sysWgAdresseGueltig('bogus'), sysWgAdresseGueltig('10.200.300.2/24'), sysWgMtuGueltig('1280'), sysWgMtuGueltig('abc'),
        sysWgErreichbar({ adressen: ['10.200.200.1/24'], peers: [{ publicKey: SYS_WG.gegenstelle, endpunkt: SYS_WG.endpunkt, erlaubt: ['10.200.200.0/24'] }] }, 'x'),
        sysWgErreichbar({ adressen: ['10.200.200.2/24'], peers: [{ publicKey: SYS_WG.gegenstelle, endpunkt: SYS_WG.endpunkt, erlaubt: ['10.200.200.0/24'] }] }, 'x')]);
    }, [wg]);
    assert.deepEqual(pruef, [true, false, false, true, false, false, true], 'Address, MTU und eigene Tunneladresse');
    assert.ok(wg.includes('Address = 10.200.200.2/24'));
    assert.deepEqual(p.fehler, []);
    console.log('OK: terminal-sys-review (A0 Bestandsprofil ohne Warten, Installation, Kennwort für /etc, Register, Fenster, predict QTH/TLE, Notizen löschen, WireGuard)');
  } finally {
    await ctx.close();
    py.kill();
  }
})().catch(e => { console.error(e); process.exit(1); });
