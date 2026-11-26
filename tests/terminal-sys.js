/* Paket 3 (docs/terminal-sys-konzept.md): simulierte Systemkonfiguration.
   A0 (verbindliches Abnahmekriterium): vollständiger Kommunikationsablauf mit der Standardkonfiguration ohne zusätzliche Befehle, ohne
      Kennwortabfrage und ohne zusätzliche Wartezeit (PREDICT im geteilten Fenster, pon && plog -f, wg-quick && profanity, LOS-Abbau).
   B: Installation (root, Rechte, Vorlagen unter /usr, einmalig: gelöschte Dateien bleiben gelöscht, Schlüssel bleibt über Neustart gleich).
   C: eingeschränktes sudo der Systemverwaltung (Kennwort, nur /etc als Ziel, keine Umgehung der Dossiersperre, /usr schreibgeschützt).
   D: pppd und chat aus Dateien (Nummer, TIMEOUT, Optionen, Gerät, nopersist, fehlendes Skript, Zurücksetzen aus /usr/share).
   E: WireGuard aus Datei (öffentlicher Schlüssel = X25519 des privaten, Endpunkt, Fehler von wg setconf, Schlüsseldatei, PostUp, hosts).
   F: Hostname konsistent in Prompt, hostname, uname -n/-a und Syslog, wirksam ab der nächsten Anmeldung; ungültig ergibt localhost.
   G: Sicherung Format 3 mit /etc, Wiederherstellung getrennt nach /home und /etc, ältere Sicherung ohne /etc. */
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright');
const { APP } = require('./_pfad');
const { imUeberflug, bis, verbunden, gescheitert, schnelleWahl } = require('./_kestrel');

const PW = 'pw-test-123';
/* öffentlicher X25519-Schlüssel nach Node (Referenz für wg show) */
function oeffentlich(privatB64) {
  const der = Buffer.concat([Buffer.from('302e020100300506032b656e04220420', 'hex'), Buffer.from(privatB64, 'base64')]);
  return crypto.createPublicKey(crypto.createPrivateKey({ key: der, format: 'der', type: 'pkcs8' })).export({ format: 'der', type: 'spki' }).slice(-32).toString('base64');
}
(async () => {
  const profil = fs.mkdtempSync(path.join(os.tmpdir(), 'ft-sys-'));
  const ctx = await chromium.launchPersistentContext(profil, { reducedMotion: 'reduce', viewport: { width: 1280, height: 900 } });
  try {
    let p, inp, out;
    const fehlerSeite = [];
    const oeffnen = async () => {
      p = await ctx.newPage();
      p.setDefaultTimeout(15000);
      p.on('pageerror', e => fehlerSeite.push(e.message));
      await p.route(/^https?:/, r => r.abort());
      await p.goto(APP);
      await p.fill('#gate-pw', PW);
      if (await p.isVisible('#gate-pw2')) await p.fill('#gate-pw2', PW);
      await p.click('#gate-go');
      await p.waitForFunction(() => typeof APP_BEREIT !== 'undefined' && APP_BEREIT && !document.body.classList.contains('locked'));
      await p.click('#profil-terminal-oeffnen');
      await p.waitForFunction(() => terminalSysAktuell());
      inp = p.locator('#profil-terminal-eingabe'); out = p.locator('#profil-terminal-ausgabe');
    };
    const fertig = () => p.waitForFunction(() => !TERMINAL_ZUSTAND.kette && !TERMINAL_ZUSTAND.dateiLaeuft && !TERMINAL_ZUSTAND.sudo);
    const lauf = async z => {
      const roh = await out.textContent(), vorher = roh === '' ? 0 : roh.split('\n').length;
      await inp.fill(z); await inp.press('Enter'); await fertig();
      return (await out.textContent()).split('\n').slice(vorher + 1).join('\n');
    };
    /* sudo: Kennwort verdeckt eingeben (wie terminal-sudo.js); falsch: drei Versuche */
    const sudo = async (z, kennwort = PW) => {
      const roh = await out.textContent(), vorher = roh.split('\n').length;
      await inp.fill(z); await inp.press('Enter');
      await p.waitForFunction(() => !!TERMINAL_ZUSTAND.sudo && !TERMINAL_ZUSTAND.sudo.pruefen);
      for (let i = 0; i < (kennwort === PW ? 1 : 3); i++) {
        await p.waitForFunction(() => !TERMINAL_ZUSTAND.sudo || !TERMINAL_ZUSTAND.sudo.pruefen);
        if (!(await p.evaluate(() => !!TERMINAL_ZUSTAND.sudo))) break;
        await inp.focus(); await p.keyboard.type(kennwort); await p.keyboard.press('Enter');
      }
      await fertig();
      return (await out.textContent()).split('\n').slice(vorher + 1).filter(l => !l.startsWith('[sudo] password for raizo:') && l !== 'Sorry, try again.').join('\n');
    };
    const status = async () => lauf('echo $?');
    /* Systemdatei direkt setzen (Verwaltung über das VFS, wie sudo); danach Stand der Konfiguration neu lesen */
    const setzeEtc = async (pfad, text) => {
      await p.evaluate(async ([seg, t]) => { const r = await TERMINAL_VFS.schreiben(seg, t, { privilegiert: true }); if (r.fehler) throw new Error(r.fehler); terminalSysGeaendert(); }, [pfad.split('/').filter(Boolean), text]);
      await p.waitForFunction(() => terminalSysAktuell());
    };
    const entferneEtc = async pfad => {
      await p.evaluate(async seg => { const r = await TERMINAL_VFS.entfernen(seg, { privilegiert: true }); if (r.fehler) throw new Error(r.fehler); terminalSysGeaendert(); }, pfad.split('/').filter(Boolean));
      await p.waitForFunction(() => terminalSysAktuell());
    };
    const zuruecksetzen = async () => {
      for (const [ziel, vorlage] of [['/etc/ppp/peers/kestrel', '/usr/share/ppp/kestrel.peer'], ['/etc/chatscripts/kestrel', '/usr/share/ppp/kestrel.chatscript'], ['/etc/wireguard/wg-sat.conf', '/usr/share/wireguard/wg-sat.conf']]) {
        const t = await p.evaluate(async s => (await TERMINAL_FS.readFile(s)).text, vorlage.split('/').filter(Boolean));
        await setzeEtc(ziel, t);
      }
    };
    const syslog = () => p.evaluate(() => TERMINAL_ZUSTAND.syslog.map(z => z.replace(/^\w+ +\d+ [\d:]+ \S+ /, '').replace(/\[\d+\]/, '')));
    const marke = () => p.evaluate(() => { TERMINAL_ZUSTAND.syslog = TERMINAL_ZUSTAND.syslog.concat('--- marke'); });
    const seitMarke = async () => { const l = await syslog(); return l.slice(l.lastIndexOf('--- marke') + 1); };
    await oeffnen();

    /* ---- A0: vollständiger Ablauf mit Standardkonfiguration, keine zusätzlichen Befehle oder Wartezeiten ---- */
    await p.clock.install();
    await schnelleWahl(p);
    await imUeberflug(p, { wahl: 'ok' });
    await lauf('tmux');
    await lauf('tmux split-window -bd predict');
    const start = await p.evaluate(() => Date.now());
    await lauf('pon kestrel && tmux split-window -bd plog -f');
    assert.deepEqual(await p.locator('.tmux-pane').evaluateAll(l => l.map(e => e.getAttribute('aria-label').slice(6))), ['predict', 'plog'], 'A0: predict und plog -f im geteilten Fenster');
    assert.equal(await p.evaluate(() => TERMINAL_ZUSTAND.modem?.phase), 'chat', 'A0: die Wahl beginnt sofort');
    /* Feste Testdauern (schnelleWahl): ATZ 150 ms, AT+CSQ 550 ms, CONNECT 3250 ms, Leitung 100 ms, ppp0 750 ms, IP 1900 ms = 6700 ms */
    await p.clock.runFor(6600);
    assert.equal(await p.evaluate(() => TERMINAL_ZUSTAND.modem?.bereit), false, 'A0: keine Verbindung vor der bisherigen Dauer');
    await p.clock.runFor(200);
    assert.equal(await p.evaluate(() => TERMINAL_ZUSTAND.modem?.bereit), true, 'A0: verbunden nach der bisherigen Dauer, ohne zusätzliche Wartezeit');
    assert.ok((await p.evaluate(() => Date.now())) - start <= 6800);
    assert.match(await p.locator('.tmux-pane').nth(1).textContent(), /pppd\[\d+\]: remote IP address/, 'A0: plog -f zeigt die Einwahl');
    assert.equal(await p.locator('#profil-terminal-sat').isVisible(), true, 'A0: LOS-Zähler im Fensterkopf');
    await inp.fill('wg-quick up wg-sat && profanity'); await inp.press('Enter');
    await p.clock.runFor(600);
    assert.equal(await p.evaluate(() => !!TERMINAL_ZUSTAND.wgSat?.bereit), false);
    await p.clock.runFor(100);
    assert.equal(await p.evaluate(() => !!TERMINAL_ZUSTAND.wgSat?.bereit), true, 'A0: wg-sat nach 650 ms wie bisher');
    await p.clock.runFor(6000);
    assert.equal(await p.evaluate(() => TERMINAL_ZUSTAND.kanal?.phase), 'eingabe', 'A0: profanity angemeldet');
    const ablauf = await out.textContent();
    assert.doesNotMatch(ablauf, /\[sudo\]|Warning|Login failed|does not exist|Permission denied/, 'A0: keine Kennwortabfrage, keine Warnung, kein Fehler');
    assert.match(ablauf, /\[#\] wg set wg-sat private-key \/etc\/wireguard\/wg-sat\.key/, 'A0: Schlüssel automatisch über PostUp');
    /* LOS: Abbau wie bisher */
    await p.evaluate(() => { TERMINAL_ZUSTAND.satLink.bis = Date.now() + 500; });
    await p.clock.runFor(2000);
    assert.equal(await p.evaluate(() => TERMINAL_ZUSTAND.kanal?.phase), 'offline', 'A0: Verbindungsabbau bei LOS');
    await p.keyboard.press('Control+c').catch(() => {});
    await p.evaluate(() => { terminalKanalAbbruch(); });
    await lauf('wg-quick down wg-sat');
    await lauf('poff');
    await lauf('tmux kill-server');
    await p.clock.resume();

    /* ---- B: Installation ---- */
    assert.equal(await lauf('ls /'), 'etc\nexports\nhome\nintel\n' + (await p.evaluate(() => TERMINAL_DB)) + '\ntmp\nusr\nvar');
    assert.equal(await lauf('ls /etc'), 'chatscripts\nhostname\nhosts\nos-release\nppp\nwireguard');
    assert.match(await lauf('ls -l /etc'), /^drwx------ .* wireguard$/m, 'wireguard 0700');
    assert.match(await lauf('cat /etc/os-release'), /^PRETTY_NAME="Ubuntu 24\.04\.1 LTS"$/m);
    assert.equal(await lauf('ls /etc/wireguard'), "ls: cannot open directory '/etc/wireguard': Permission denied");
    assert.equal(await lauf('cat /etc/wireguard/wg-sat.key'), 'cat: /etc/wireguard/wg-sat.key: Permission denied');
    assert.equal(await lauf('cp /etc/wireguard/wg-sat.key k'), "cp: cannot stat '/etc/wireguard/wg-sat.key': Permission denied");
    assert.equal(await lauf('echo x > /etc/hostname'), 'bash: /etc/hostname: Permission denied');
    assert.equal(await lauf('touch /etc/neu'), "touch: cannot touch '/etc/neu': Permission denied");
    assert.equal(await lauf('rm /etc/hosts'), "rm: cannot remove '/etc/hosts': Permission denied");
    assert.equal(await lauf('mv /etc/hosts h'), "mv: cannot move '/etc/hosts' to 'h': Permission denied");
    assert.equal(await lauf('cat /usr/share/ppp/kestrel.peer'), await lauf('cat /etc/ppp/peers/kestrel'), 'Vorlage entspricht der Installation');
    assert.equal(await lauf('cat /usr/share/ppp/kestrel.chatscript'), await lauf('cat /etc/chatscripts/kestrel'));
    assert.equal(await lauf('touch /usr/x'), "touch: cannot touch '/usr/x': Read-only file system");
    assert.equal(await lauf('cd /etc/wireguard'), 'bash: cd: /etc/wireguard: Permission denied', 'chdir verlangt das Durchsuchrecht');
    const tab = async (vorher, nachher) => { await inp.fill(vorher); await inp.press('Tab'); await p.waitForFunction(w => $('profil-terminal-eingabe').value === w, nachher); await inp.fill(''); };
    await tab('cat /usr/share/ppp/kestrel.p', 'cat /usr/share/ppp/kestrel.peer');
    await tab('cat /etc/os', 'cat /etc/os-release');
    await inp.fill('cat /etc/wireguard/w'); await inp.press('Tab'); await p.waitForTimeout(300);
    assert.equal(await inp.inputValue(), 'cat /etc/wireguard/w', 'keine Ergänzung im geschützten Verzeichnis'); await inp.fill('');
    const schluessel = (await sudo('sudo cat /etc/wireguard/wg-sat.key')).trim();
    assert.match(schluessel, /^[A-Za-z0-9+/]{43}=$/);
    assert.equal(Buffer.from(schluessel, 'base64')[0] & 7, 0, 'geklemmter Schlüssel (wg genkey)');
    assert.match(await sudo('sudo ls -l /etc/wireguard'), /^-rw------- .* wg-sat\.conf\n-rw------- .* wg-sat\.key$/);
    /* einmalig: gelöschte Datei bleibt gelöscht, der Schlüssel bleibt über Abmeldung und Neuladen gleich */
    assert.equal(await sudo('sudo rm /etc/os-release'), '');
    await lauf('exit');
    await p.click('#profil-terminal-oeffnen');
    await p.waitForFunction(() => terminalSysAktuell());
    assert.equal(await lauf('cat /etc/os-release'), 'cat: /etc/os-release: No such file or directory', 'nicht neu installiert');
    await p.close();
    await oeffnen();
    assert.equal((await sudo('sudo cat /etc/wireguard/wg-sat.key')).trim(), schluessel, 'Schlüssel über Neuladen unverändert');
    await sudo('sudo cp /usr/lib/os-release /etc/os-release');
    assert.match(await lauf('cat /etc/os-release'), /^NAME="Ubuntu"$/m, 'aus der Vorlage wiederhergestellt');

    /* ---- C: sudo der Systemverwaltung ---- */
    assert.equal(await sudo('sudo cp /usr/share/ppp/kestrel.peer /etc/ppp/peers/test', 'falsch'), 'sudo: 3 incorrect password attempts');
    assert.equal(await lauf('ls /etc/ppp/peers'), 'kestrel', 'falsches Kennwort: nichts geändert');
    assert.equal(await sudo('sudo cp /usr/share/ppp/kestrel.peer /etc/ppp/peers/test'), '');
    assert.match(await lauf('ls -l /etc/ppp/peers'), /^-rw-r--r-- .* test$/m);
    assert.equal(await sudo('sudo cp /etc/wireguard/wg-sat.key /home/raizo/k'), "cp: cannot create regular file '/home/raizo/k': Operation not permitted", 'nur Ziele unter /etc');
    assert.equal(await sudo('sudo mv /etc/ppp/peers/test /tmp/test'), "mv: cannot move '/etc/ppp/peers/test' to '/tmp/test': Operation not permitted");
    assert.equal(await lauf('ls /home/raizo /tmp'), '/home/raizo:\n\n/tmp:', 'nichts außerhalb von /etc entstanden');
    assert.equal(await sudo('sudo rm /etc/ppp/peers/test'), '');
    assert.equal(await sudo('sudo touch /usr/share/ppp/x'), "touch: cannot touch '/usr/share/ppp/x': Read-only file system", '/usr bleibt schreibgeschützt');
    assert.equal(await lauf('sudo pon kestrel'), 'sudo: pon: not supported in Shadow Terminal');
    assert.equal(await lauf('sudo cat /etc/hosts > h'), 'bash: sudo: output redirection is not supported for this command', 'keine Umleitung geschützter Inhalte');
    /* keine Umgehung der Dossiersperre durch Dateibefehle */
    await p.evaluate(() => dispatch({ type: 'DOSSIER_SPERREN', id: 'P-0002' }));
    assert.equal(await sudo('sudo ls /intel/dossiers/persons/P-0002'), "ls: cannot access '/intel/dossiers/persons/P-0002': Permission denied");
    assert.doesNotMatch(await sudo('sudo ls /intel/dossiers/persons'), /P-0002/);
    assert.equal(await p.evaluate(() => zielZugang('P-0002').gesperrt), true, 'Sperre bleibt');
    await p.evaluate(() => dispatch({ type: 'DOSSIER_ENTSPERREN', id: 'P-0002' }));

    /* ---- D: pppd und chat aus Dateien ---- */
    await p.clock.install();
    await schnelleWahl(p);
    await imUeberflug(p, { wahl: 'ok' });
    const chatStandard = await lauf('cat /etc/chatscripts/kestrel');
    /* andere Nummer: kein Träger */
    await setzeEtc('/etc/chatscripts/kestrel', chatStandard.replace('ATDT00882994401', 'ATDT0049301234567') + '\n');
    await marke(); await lauf('pon kestrel'); await gescheitert(p);
    assert.deepEqual((await seitMarke()).filter(z => /NO CARRIER|Connect script failed|send \(ATDT/.test(z)), ['chat: abort on (NO CARRIER)', 'chat: send (ATDT0049301234567^M)', 'chat: NO CARRIER', 'chat: Failed (NO CARRIER)', 'pppd: Connect script failed']);
    await lauf('poff');
    /* TIMEOUT aus dem Skript: ohne Satellit Abbruch nach 5 s statt 60 s */
    await setzeEtc('/etc/chatscripts/kestrel', chatStandard.replace('TIMEOUT 60', 'TIMEOUT 5') + '\n');
    await p.evaluate(() => { TERMINAL_ZUSTAND.wahlVorgabe = 'alarm'; });
    await marke(); await lauf('pon kestrel');
    await p.clock.runFor(5500);
    assert.ok(!(await seitMarke()).includes('chat: alarm'), 'noch kein Abbruch (Erwartung CONNECT ab 0,7 s)');
    await p.clock.runFor(400);
    assert.deepEqual((await seitMarke()).filter(z => /timeout set|alarm|Failed$|script failed/.test(z)), ['chat: timeout set to 5 seconds', 'chat: alarm', 'chat: Failed', 'pppd: Connect script failed']);
    await lauf('poff');
    await setzeEtc('/etc/chatscripts/kestrel', chatStandard + '\n');
    await p.evaluate(() => { TERMINAL_ZUSTAND.wahlVorgabe = 'ok'; });
    /* Optionsdatei wie options_from_file */
    const peerStandard = await lauf('cat /etc/ppp/peers/kestrel');
    await setzeEtc('/etc/ppp/peers/kestrel', peerStandard + '\nbogus\n');
    assert.equal(await lauf('pon kestrel'), "pppd: In file /etc/ppp/peers/kestrel: unrecognized option 'bogus'"); assert.equal(await status(), '2');
    await setzeEtc('/etc/ppp/peers/kestrel', peerStandard.replace('/dev/ttyUSB0', '/dev/ttyUSB1') + '\n');
    assert.equal(await lauf('pon kestrel'), "pppd: In file /etc/ppp/peers/kestrel: unrecognized option '/dev/ttyUSB1'", 'nicht vorhandenes Gerät (setdevname)');
    await setzeEtc('/etc/ppp/peers/kestrel', peerStandard.replace('holdoff 20', 'holdoff zwanzig') + '\n');
    assert.equal(await lauf('pon kestrel'), "pppd: invalid numeric parameter 'zwanzig' for holdoff option");
    await setzeEtc('/etc/ppp/peers/kestrel', peerStandard + '\nholdoff\n');
    assert.equal(await lauf('pon kestrel'), "pppd: In file /etc/ppp/peers/kestrel: too few parameters for option 'holdoff'");
    assert.equal(await lauf('pppd call ../x'), 'pppd: call option value may not contain .. or start with /');
    /* holdoff aus der Datei */
    await setzeEtc('/etc/ppp/peers/kestrel', peerStandard.replace('holdoff 20', 'holdoff 3') + '\n');
    await p.evaluate(() => { TERMINAL_ZUSTAND.wahlVorgabe = 'busy'; });
    await marke(); await lauf('pon kestrel'); await gescheitert(p);
    await p.clock.runFor(2900);
    assert.equal((await seitMarke()).filter(z => z === 'chat: abort on (BUSY)').length, 1);
    await p.clock.runFor(200);
    assert.equal((await seitMarke()).filter(z => z === 'chat: abort on (BUSY)').length, 2, 'Neuwahl nach holdoff 3 s');
    await lauf('poff');
    /* nopersist: nach dem ersten Fehlschlag endet pppd */
    await setzeEtc('/etc/ppp/peers/kestrel', peerStandard.replace('persist', 'nopersist') + '\n');
    await marke(); await lauf('pon kestrel'); await p.clock.runFor(3000);
    assert.deepEqual((await seitMarke()).slice(-2), ['pppd: Connect script failed', 'pppd: Exit.']);
    assert.equal(await p.evaluate(() => TERMINAL_ZUSTAND.modem), null);
    /* fehlendes Connect-Skript */
    await setzeEtc('/etc/ppp/peers/kestrel', peerStandard.replace('/etc/chatscripts/kestrel', '/etc/chatscripts/fehlt') + '\n');
    await marke(); await lauf('pon kestrel'); await p.clock.runFor(100);
    assert.deepEqual((await seitMarke()).slice(0, 2), ['chat: /etc/chatscripts/fehlt -- open failed: No such file or directory', 'pppd: Connect script failed']);
    await lauf('poff');
    /* Zurücksetzen mit sudo cp aus /usr/share: der Standard verbindet wieder */
    await p.clock.resume();
    await sudo('sudo cp /usr/share/ppp/kestrel.peer /etc/ppp/peers/kestrel');
    await p.waitForFunction(() => terminalSysAktuell());
    assert.equal(await lauf('cat /etc/ppp/peers/kestrel'), peerStandard);
    await p.clock.install();
    await p.evaluate(() => { TERMINAL_ZUSTAND.wahlVorgabe = 'ok'; });
    await imUeberflug(p, { wahl: 'ok' });
    await lauf('pon kestrel'); await verbunden(p);

    /* ---- E: WireGuard ---- */
    const wgStandard = (await sudo('sudo cat /etc/wireguard/wg-sat.conf')) + '\n';
    const wgUp = async () => { const roh = (await out.textContent()).split('\n').length; await inp.fill('wg-quick up wg-sat'); await inp.press('Enter'); await p.clock.runFor(700); await fertig(); return (await out.textContent()).split('\n').slice(roh).join('\n'); };
    await wgUp();
    const show = await lauf('wg show wg-sat');
    assert.match(show, new RegExp('^interface: wg-sat\\n  public key: ' + oeffentlich(schluessel).replace(/[+/]/g, '\\$&') + '\\n  private key: \\(hidden\\)\\n  listening port: 51820\\n\\npeer: 7QsCNrPUIddA7y5vuHmoYsaiX2aKbS6wQDnHr5G1F0g=\\n  endpoint: 192\\.0\\.2\\.42:51820\\n  allowed ips: 10\\.200\\.200\\.0/24$'), 'öffentlicher Schlüssel = X25519 des gespeicherten privaten: ' + show);
    await lauf('wg-quick down wg-sat');
    assert.match(await wgUp(), /\[#\] ip link set mtu 1280 up dev wg-sat\n\[#\] wg set wg-sat private-key \/etc\/wireguard\/wg-sat\.key$/, 'Ablauf wiederholbar');
    assert.match(await lauf('wg show wg-sat'), new RegExp('public key: ' + oeffentlich(schluessel).replace(/[+/]/g, '\\$&')), 'derselbe Schlüssel bei jedem up');
    await lauf('wg-quick down wg-sat');
    /* anderer Endpunkt: Schnittstelle steht, aber kein Handshake, profanity meldet "Login failed." */
    await setzeEtc('/etc/wireguard/wg-sat.conf', wgStandard.replace('192.0.2.42:51820', '192.0.2.99:51820'));
    await wgUp();
    assert.equal(await p.evaluate(() => [TERMINAL_ZUSTAND.wgSat?.bereit, TERMINAL_ZUSTAND.wgSat?.erreichbar]).then(JSON.stringify), '[true,false]');
    await inp.fill('profanity'); await inp.press('Enter'); await p.clock.runFor(6100);
    assert.match(await p.evaluate(() => TERMINAL_ZUSTAND.kanal.fenster[0].log.map(x => x.text || x).join('\n')), /Login failed\./);
    await inp.fill('/quit'); await inp.press('Enter'); await p.clock.runFor(500);
    await p.waitForFunction(() => !TERMINAL_ZUSTAND.kanal);
    assert.equal(await p.evaluate(() => !!TERMINAL_ZUSTAND.modem?.bereit), true, 'Einwahl unberührt');
    await lauf('wg-quick down wg-sat');
    /* Endpunkt über /etc/hosts; ohne Eintrag: Namensauflösung scheitert in wg setconf */
    await setzeEtc('/etc/wireguard/wg-sat.conf', wgStandard.replace('192.0.2.42:51820', 'gateway.kestrel:51820'));
    let z = await wgUp();
    assert.match(z, /\[#\] wg setconf wg-sat \/dev\/fd\/63\nName or service not known: `gateway\.kestrel:51820'\nConfiguration parsing error\n\[#\] ip link delete dev wg-sat/);
    const hosts = await lauf('cat /etc/hosts');
    await setzeEtc('/etc/hosts', hosts + '\n192.0.2.42 gateway.kestrel\n');
    await setzeEtc('/etc/wireguard/wg-sat.conf', wgStandard.replace('192.0.2.42:51820', 'gateway.kestrel:51820'));
    await wgUp();
    assert.equal(await p.evaluate(() => TERMINAL_ZUSTAND.wgSat?.erreichbar), true, 'Endpunkt aus /etc/hosts aufgelöst');
    await lauf('wg-quick down wg-sat');
    await setzeEtc('/etc/hosts', hosts + '\n');
    /* Fehler von wg setconf: Schnittstelle wird wieder entfernt */
    await setzeEtc('/etc/wireguard/wg-sat.conf', wgStandard.replace('[Peer]', '[Peer]\nGibtEsNicht = 1'));
    assert.match(await wgUp(), /Line unrecognized: `GibtEsNicht=1'\nConfiguration parsing error\n\[#\] ip link delete dev wg-sat/);
    await setzeEtc('/etc/wireguard/wg-sat.conf', wgStandard.replace('ListenPort = 51820', 'PrivateKey = kaputt'));
    assert.match(await wgUp(), /Key is not the correct length or format: `kaputt'\nConfiguration parsing error/);
    /* PostUp: nur die Schlüsseldatei, sonst klare Grenze der Simulation; fehlende Schlüsseldatei wie wg (perror fopen) */
    await setzeEtc('/etc/wireguard/wg-sat.conf', wgStandard.replace(/PostUp = .*/, 'PostUp = iptables -A FORWARD -i %i -j ACCEPT'));
    assert.match(await wgUp(), /\[#\] iptables -A FORWARD -i wg-sat -j ACCEPT\nwg-quick: PostUp is limited to 'wg set %i private-key <file>' in this terminal\n\[#\] ip link delete dev wg-sat/);
    await setzeEtc('/etc/wireguard/wg-sat.conf', wgStandard.replace('wg-sat.key', 'fehlt.key'));
    assert.match(await wgUp(), /\[#\] wg set wg-sat private-key \/etc\/wireguard\/fehlt\.key\nfopen: No such file or directory\n\[#\] ip link delete dev wg-sat/);
    assert.equal(await p.evaluate(() => TERMINAL_ZUSTAND.wgSat), null);
    /* ip address add / ip link set mtu (iproute2 6.1.0): ungültige Werte beenden wg-quick, Abbau */
    await setzeEtc('/etc/wireguard/wg-sat.conf', wgStandard.replace('Address = 10.200.200.2/24', 'Address = bogus'));
    assert.match(await wgUp(), /\[#\] ip -4 address add bogus dev wg-sat\nError: inet prefix is expected rather than "bogus"\.\n\[#\] ip link delete dev wg-sat/);
    await setzeEtc('/etc/wireguard/wg-sat.conf', wgStandard.replace('MTU = 1280', 'MTU = abc'));
    assert.match(await wgUp(), /\[#\] ip link set mtu abc up dev wg-sat\nError: argument "abc" is wrong: Invalid "mtu" value\n\[#\] ip link delete dev wg-sat/);
    await setzeEtc('/etc/wireguard/wg-sat.conf', wgStandard.replace('Address = 10.200.200.2/24', 'Address = 10.9.9.2/24'));
    await wgUp();
    assert.deepEqual(await p.evaluate(() => [TERMINAL_ZUSTAND.wgSat?.bereit, TERMINAL_ZUSTAND.wgSat?.erreichbar]), [true, false], 'eigene Adresse außerhalb des Tunnelnetzes: kein Handshake');
    await lauf('wg-quick down wg-sat');
    await entferneEtc('/etc/wireguard/wg-sat.conf');
    assert.equal(await lauf('wg-quick up wg-sat'), "wg-quick: `/etc/wireguard/wg-sat.conf' does not exist");
    await zuruecksetzen();
    await wgUp();
    assert.equal(await p.evaluate(() => TERMINAL_ZUSTAND.wgSat?.erreichbar), true, 'Standard aus /usr/share wieder erreichbar');
    await lauf('wg-quick down wg-sat'); await lauf('poff');
    await p.clock.resume();

    /* ---- F: Hostname ---- */
    await lauf('echo relay7 > /tmp/h');
    await sudo('sudo cp /tmp/h /etc/hostname');
    assert.equal(await lauf('hostname'), 'terminal', 'wirksam erst ab der nächsten Anmeldung');
    assert.equal(await lauf('hostname neu'), 'hostname: you must be root to change the host name');
    await lauf('exit');
    await p.click('#profil-terminal-oeffnen');
    await p.waitForFunction(() => TERMINAL_SYS.hostname === 'relay7');
    assert.equal(await p.locator('#profil-terminal-prompt').textContent(), 'raizo@relay7:~$');
    assert.equal(await lauf('hostname'), 'relay7');
    assert.equal(await lauf('uname -n'), 'relay7');
    assert.match(await lauf('uname -a'), /^Linux relay7 6\.8\.0-45-generic /);
    assert.equal(await lauf('hostname > /tmp/x; cat /tmp/x'), 'relay7');
    await p.evaluate(() => terminalPppLog('pppd[1]: Probe'));
    assert.match(await p.evaluate(() => TERMINAL_ZUSTAND.syslog.at(-1)), /^\w+ +\d+ [\d:]+ relay7 pppd\[1\]: Probe$/, 'neue Systemprotokolle mit dem aktiven Namen');
    await setzeEtc('/etc/hostname', 'kein gültiger name\n');
    await lauf('exit'); await p.click('#profil-terminal-oeffnen');
    await p.waitForFunction(() => TERMINAL_SYS.hostname === 'localhost');
    assert.equal(await lauf('uname -n'), 'localhost');
    await setzeEtc('/etc/hostname', 'terminal\n');
    await lauf('exit'); await p.click('#profil-terminal-oeffnen');
    await p.waitForFunction(() => TERMINAL_SYS.hostname === 'terminal' && terminalSysAktuell());

    /* ---- G: Sicherung mit /etc (Brücke im Speicher nachgebildet) ---- */
    await p.evaluate(() => {
      window.__ablage = new Map();
      terminalBrueckenAdresse = function () { return ['x', 1, 't']; };
      terminalBrueckeSenden = async function (a) {
        if (a.op === 'home-save') { const name = 'home-2026112' + window.__ablage.size + 'T000000Z.json'; window.__ablage.set(name, a.data); return { name: name, bytes: a.data.length }; }
        if (a.op === 'home-list') return { backups: [...window.__ablage.keys()].reverse().map(n => ({ name: n, bytes: window.__ablage.get(n).length })) };
        if (a.op === 'home-load') { const d = window.__ablage.get(a.name); return d ? { data: d, sha256: await terminalHomeHash(d) } : { error: 'not found' }; }
        return { error: 'unbekannt' };
      };
    });
    await lauf('rm -f h; echo daheim > notiz.txt');   /* h: von der abgewiesenen Umleitung in C angelegt (bash öffnet das Ziel zuerst) */
    const b1 = await lauf('home-backup');
    assert.match(b1, /^home-backup: (home-\S+\.json) \(1 entries in \/home\/raizo, 11 in \/etc, \d+ B\)$/, b1);
    const name1 = b1.match(/(home-\S+\.json)/)[1];
    const paket = await p.evaluate(n => JSON.parse(window.__ablage.get(n)), name1);
    assert.equal(paket.version, 3);
    assert.ok(paket.etc.some(e => e.name === 'wg-sat.key' && e.uid === 0 && e.modus === 0o600 && e.inhalt.trim() === schluessel), 'Schlüssel in der Sicherung');
    await setzeEtc('/etc/hosts', 'geaendert\n');
    await lauf('echo neu > spaeter.txt');
    assert.match(await lauf('home-restore --etc ' + name1), /this replaces everything in \/etc \(11 entries in the backup\)\. The current state is saved first\. Changing \/etc requires the sudo password\./);
    assert.match(await sudo('home-restore --yes --etc ' + name1), /^home-restore: 11 entries restored to \/etc from home-\S+\n/, 'Review #139: /etc nur nach Kennwort');
    assert.match(await lauf('cat /etc/hosts'), /^127\.0\.0\.1 localhost/, '/etc zurückgesetzt');
    assert.equal(await lauf('ls'), 'notiz.txt\nspaeter.txt', '/home bei --etc unverändert');
    await setzeEtc('/etc/hosts', 'nochmal\n');
    assert.match(await lauf('home-restore --yes --home ' + name1), /^home-restore: 1 entries restored/);
    assert.equal(await lauf('ls'), 'notiz.txt');
    assert.equal(await lauf('cat /etc/hosts'), 'nochmal', '/etc bei --home unverändert');
    assert.match(await sudo('home-restore --yes ' + name1), /^home-restore: 1 entries restored from home-\S+ \(\/etc: 11 entries\)\n/);
    assert.equal(await lauf('home-restore --yes --home --etc ' + name1), 'usage: home-restore [--yes] [--home | --etc] <name>');
    /* ältere Sicherung (Format 2) ohne /etc */
    await p.evaluate(async n => {
      const alt = JSON.parse(window.__ablage.get(n)); delete alt.etc; delete alt.manifest.etc; alt.version = 2;
      window.__ablage.set('home-20261101T000000Z.json', JSON.stringify(alt));
    }, name1);
    assert.equal(await lauf('home-restore --yes --etc home-20261101T000000Z.json'), 'home-restore: home-20261101T000000Z.json: this backup contains no /etc; nothing changed');
    await setzeEtc('/etc/hosts', 'bleibt\n');
    assert.match(await lauf('home-restore --yes home-20261101T000000Z.json'), /^home-restore: 1 entries restored from home-20261101T000000Z\.json\n/);
    assert.equal(await lauf('cat /etc/hosts'), 'bleibt', 'Format 2 lässt /etc unverändert');
    /* beschädigter /etc-Teil wird erkannt, nichts geändert */
    await p.evaluate(async n => {
      const x = JSON.parse(window.__ablage.get(n)); x.etc[1].inhalt = 'manipuliert';
      window.__ablage.set('home-20261102T000000Z.json', JSON.stringify(x));
    }, name1);
    assert.equal(await lauf('home-restore --yes home-20261102T000000Z.json'), 'home-restore: home-20261102T000000Z.json: backup is damaged (checksum mismatch); nothing changed');

    assert.deepEqual(fehlerSeite, []);
    console.log('OK: terminal-sys (A0 Ablauf, Installation, sudo-Verwaltung, pppd/chat, WireGuard, Hostname, Sicherung)');
  } finally {
    await ctx.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
