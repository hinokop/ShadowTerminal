/* Paket 3: simulierte Systemkonfiguration (docs/terminal-sys-konzept.md, Entscheidungen S1 bis S9 und Abnahmekriterium A0).
   Klassisches Skript, wird nach terminal-intel.js und vor profil-modul.js geladen; enthält Tabellen und Funktionen, Aufrufe erst zur Laufzeit.
   - Installation: /etc liegt im VFS (terminal-vfs.js), gehört root und wird beim Sitzungsbeginn genau einmal je Datei aus den Standards
     installiert. Die Standards sind gültig und sofort einsatzbereit (A0); der WireGuard-Schlüssel entsteht dabei einmalig.
   - /usr: schreibgeschützte Vorlagen (S3), Zurücksetzen mit sudo cp.
   - Dienste (pppd, chat, wg-quick, hostname, predict) lesen ihre Dateien beim Start (S5) und prüfen sie wie ihr Vorbild.
   Belegt an Ubuntu 24.04 (ppp 2.4.9-1+1.1ubuntu4, wireguard-tools 1.0.20210914-1ubuntu4) und den Quellen ppp-2.4.9 (pppd/options.c,
   tty.c, main.c; chat/chat.c) sowie wireguard-tools v1.0.20210914 (src/config.c, setconf.c, wg-quick/linux.bash). Vereinfachungen
   stehen in docs/terminal.md. */

/* Optionsnamen von pppd 2.4.9 mit Anzahl der Parameter (n_arguments in options.c), maschinell aus den Optionstabellen der Quelle
   gewonnen (general, auth, tty, lcp, ipcp, ipv6cp, ccp, chap, upap, eap u. a.; ohne die Platzhalter o_wild für Gerät und Geschwindigkeit). */
const SYS_PPPD_OPTIONEN_0 = '+chap +ipv6 +ipx +mppe +mppe-128 +mppe-40 +mschap +mschap-v2 +pap --help --version -ac -all -am -bsdcomp -ccp -chap -crtscts -d -defaultroute -defaultroute6 -deflate -detach -ecp -h -ip -ipv6 -ipx -mn -mppe -mppe-128 -mppe-40 -mru -mschap -mschap-v2 -p -pap -pc -predictor1 -proxyarp -vj -vjccomp auth cdtrcts chapms-strip-domain crtscts debug default-asyncmap default-mru defaultroute defaultroute6 demand dryrun dump enable-session hide-password ipcp-accept-local ipcp-accept-remote ipcp-no-address ipcp-no-addresses ipv6cp-accept-local ipv6cp-accept-remote ipv6cp-use-ipaddr ipv6cp-use-persistent ipx ipxcp-accept-local ipxcp-accept-network ipxcp-accept-remote ktune lcp-echo-adaptive local lock login master_detach modem mp mppe-stateful mpshortseq ms-lanman multilink need-peer-eap noaccomp noauth nobsdcomp noccp nocdtrcts nocrtscts nodefaultroute nodefaultroute6 nodeflate nodeflatedraft nodetach noecp noendpoint noip noipdefault noipv6 noipx noktune nolock nolog nologfd nomagic nomp nomppe nomppe-128 nomppe-40 nomppe-stateful nompshortseq nomultilink nopcomp nopersist nopredictor1 noproxyarp noremoteip noreplacedefaultroute nosendip notty novj novjccomp papcrypt passive persist predictor1 proxyarp receive-all refuse-chap refuse-eap refuse-mschap refuse-mschap-v2 refuse-pap replacedefaultroute require-chap require-eap require-mppe require-mppe-128 require-mppe-40 require-mschap require-mschap-v2 require-pap show-password silent srp-use-pseudonym sync up_sdnotify updetach usehostname usepeerdns xonxoff'.split(' ');
const SYS_PPPD_OPTIONEN_1 = '+ua -as active-filter allow-ip allow-number asyncmap bsdcomp bundle ca call callback capath cert chap-interval chap-max-challenge chap-restart chap-timeout child-timeout connect connect-delay crl crl-dir datarate defaultroute-metric deflate disconnect domain eap-interval eap-max-rreq eap-max-sreq eap-restart eap-timeout endpoint escape file holdoff idle ifname init ip-down-script ip-up-script ipcp-max-configure ipcp-max-failure ipcp-max-terminate ipcp-restart ipparam ipv6 ipv6cp-max-configure ipv6cp-max-failure ipv6cp-max-terminate ipv6cp-restart ipx-network ipx-node ipx-router-name ipx-routing ipxcp-max-configure ipxcp-max-failure ipxcp-max-terminate ipxcp-restart kdebug key lcp-echo-failure lcp-echo-interval lcp-max-configure lcp-max-failure lcp-max-terminate lcp-restart linkname logfd logfile max-tls-version maxconnect maxfail maxoctets mo mo-direction mo-timeout mrru mru ms-dns ms-wins mschap-challenge mschap2-peer-challenge mtu name netmask pap-max-authreq pap-restart pap-timeout pass-filter password plugin privgroup pty record remotename remotenumber set socket srp-interval srp-pn-secret stop-bits unit unset user vj-max-slots welcome'.split(' ');

/* ---------- Standards (Installation) und Vorlagen unter /usr ---------- */
const SYS_HOSTNAME_STANDARD = 'terminal';
const SYS_WG = { gegenstelle: '7QsCNrPUIddA7y5vuHmoYsaiX2aKbS6wQDnHr5G1F0g=', endpunkt: '192.0.2.42:51820', tunnelGegenstelle: '10.200.200.1' };
/* Paketdatum der Vorlagen (wie das Datum im Kernel-Build von uname -a) */
const SYS_PAKET_ZEIT = Date.UTC(2024, 7, 30, 12, 2, 4);
function sysTexte() {
  return {
    hostname: SYS_HOSTNAME_STANDARD + '\n',
    hosts: ['127.0.0.1 localhost', '127.0.1.1 ' + SYS_HOSTNAME_STANDARD, '', '# The following lines are desirable for IPv6 capable hosts',
      '::1     ip6-localhost ip6-loopback', 'fe00::0 ip6-localnet', 'ff00::0 ip6-mcastprefix', 'ff02::1 ip6-allnodes', 'ff02::2 ip6-allrouters', ''].join('\n'),
    osRelease: ['PRETTY_NAME="Ubuntu 24.04.1 LTS"', 'NAME="Ubuntu"', 'VERSION_ID="24.04"', 'VERSION="24.04.1 LTS (Noble Numbat)"', 'VERSION_CODENAME=noble',
      'ID=ubuntu', 'ID_LIKE=debian', 'HOME_URL="https://www.ubuntu.com/"', 'SUPPORT_URL="https://help.ubuntu.com/"',
      'BUG_REPORT_URL="https://bugs.launchpad.net/ubuntu/"', 'PRIVACY_POLICY_URL="https://www.ubuntu.com/legal/terms-and-policies/privacy-policy"',
      'UBUNTU_CODENAME=noble', 'LOGO=ubuntu-logo', ''].join('\n'),
    /* Inhalt wie bisher aus den Konstanten der Einwahl (profil-modul.js), damit sich der Ablauf nicht ändert (A0) */
    peer: ['/dev/ttyUSB0', '19200', 'crtscts', 'lock', 'noauth', 'defaultroute', 'usepeerdns', 'persist', 'holdoff ' + TERMINAL_PPP_HOLDOFF / 1000,
      'maxfail 0', 'connect "/usr/sbin/chat -v -f /etc/chatscripts/' + TERMINAL_PPP_PEER + '"', ''].join('\n'),
    chat: ['ABORT BUSY', "ABORT 'NO CARRIER'", "'' ATZ", 'OK AT+CSQ', 'TIMEOUT ' + TERMINAL_PPP_DAUER.timeout / 1000, 'OK ATDT' + TERMINAL_PPP_WAHL, "CONNECT ''", ''].join('\n'),
    wg: ['[Interface]', 'Address = 10.200.200.2/24', 'ListenPort = 51820', 'MTU = 1280', 'PostUp = wg set %i private-key /etc/wireguard/wg-sat.key', '',
      '[Peer]', 'PublicKey = ' + SYS_WG.gegenstelle, 'Endpoint = ' + SYS_WG.endpunkt, 'AllowedIPs = 10.200.200.0/24', ''].join('\n')
  };
}
/* Installationsliste für TERMINAL_VFS.installieren: Eltern vor Kindern, alles root. Der private Schlüssel wird hier erzeugt, aber nur
   übernommen, wenn die Datei noch nie installiert wurde (einmalig, A0). */
function sysInstallListe() {
  const x = sysTexte(), d = function (pfad, modus) { return { pfad: pfad, typ: 'dir', modus: modus || 0o755, uid: 0 }; };
  const f = function (pfad, inhalt, modus) { return { pfad: pfad, typ: 'file', modus: modus || 0o644, uid: 0, inhalt: inhalt }; };
  return [d('etc'), f('etc/hostname', x.hostname), f('etc/hosts', x.hosts), f('etc/os-release', x.osRelease),
    d('etc/ppp'), d('etc/ppp/peers'), f('etc/ppp/peers/' + TERMINAL_PPP_PEER, x.peer), d('etc/chatscripts'), f('etc/chatscripts/' + TERMINAL_PPP_PEER, x.chat),
    d('etc/wireguard', 0o700), f('etc/wireguard/wg-sat.conf', x.wg, 0o600), f('etc/wireguard/wg-sat.key', sysWgSchluesselNeu() + '\n', 0o600)];
}
/* Schreibgeschützte Vorlagen (Einhängepunkt /usr, Anbieter "paket"): Pfad -> Text oder null (Verzeichnis) */
function sysUsrBaum() {
  const x = sysTexte();
  return new Map([['usr', null], ['usr/lib', null], ['usr/lib/os-release', x.osRelease], ['usr/share', null],
    ['usr/share/base-files', null], ['usr/share/base-files/hostname', x.hostname], ['usr/share/base-files/hosts', x.hosts],
    ['usr/share/ppp', null], ['usr/share/ppp/' + TERMINAL_PPP_PEER + '.peer', x.peer], ['usr/share/ppp/' + TERMINAL_PPP_PEER + '.chatscript', x.chat],
    ['usr/share/wireguard', null], ['usr/share/wireguard/wg-sat.conf', x.wg]]);
}
const SYS_USR_ANBIETER = {
  name: 'paket', schreibFehler: 'EROFS',
  stat: async function (seg) {
    const b = sysUsrBaum(), p = seg.join('/');
    if (!b.has(p)) return { fehler: 'ENOENT' };
    const e = sysUsrEintrag(seg[seg.length - 1], b.get(p));
    return { adapter: 'paket', typ: e.dir ? 'dir' : 'file', bytes: e.bytes, mtime: e.mtime, eintrag: e };
  },
  readdir: async function (seg) {
    const b = sysUsrBaum(), p = seg.join('/');
    if (!b.has(p)) return { fehler: 'ENOENT' };
    if (b.get(p) !== null) return { fehler: 'ENOTDIR' };
    const eintraege = [];
    b.forEach(function (inhalt, pfad) { const t = pfad.split('/'); if (t.length === seg.length + 1 && pfad.startsWith(p + '/')) eintraege.push(sysUsrEintrag(t[t.length - 1], inhalt)); });
    return { eintraege: eintraege };
  },
  readFile: async function (seg) {
    const b = sysUsrBaum(), p = seg.join('/');
    if (!b.has(p)) return { fehler: 'ENOENT' };
    return b.get(p) === null ? { fehler: 'EISDIR' } : { text: b.get(p) };
  }
};
function sysUsrEintrag(name, inhalt) {
  return { name: name, dir: inhalt === null, bytes: inhalt === null ? 4096 : new TextEncoder().encode(inhalt).length, mtime: Math.floor(SYS_PAKET_ZEIT / 1000), modus: inhalt === null ? 0o755 : 0o644 };
}

/* ---------- Lesen durch Dienste ---------- */
/* Dienste laufen mit den Rechten ihres Vorbilds (pppd, wg-quick als root); Rückgabe { text } oder { fehler } */
async function sysDateiLesen(pfad, alsBenutzer) {
  await terminalVfsBereit();
  return TERMINAL_VFS.readFile(pfad.split('/').filter(Boolean), { privilegiert: !alsBenutzer });
}
async function sysDateiStat(pfad) {
  await terminalVfsBereit();
  return TERMINAL_VFS.stat(pfad.split('/').filter(Boolean), { privilegiert: true });
}

/* ---------- pppd: Optionsdatei (getword, options_from_file in options.c) ---------- */
/* Wörter wie getword: Leerraum trennt, "#" am Wortanfang beginnt einen Kommentar bis zum Zeilenende, '…' und "…" schließen Leerraum ein,
   "\" maskiert das nächste Zeichen (einschließlich Zeilenumbruch). Vereinfachung: keine Oktal-/Steuerzeichenfolgen. */
function sysPppWoerter(text) {
  const w = [];
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === '#') { while (i < text.length && text[i] !== '\n') i++; continue; }
    let wort = '', quote = null;
    while (i < text.length) {
      const z = text[i];
      if (quote) { if (z === quote) { quote = null; i++; continue; } }
      else if (/\s/.test(z)) break;
      else if (z === '"' || z === "'") { quote = z; i++; continue; }
      if (z === '\\' && i + 1 < text.length) { if (text[i + 1] !== '\n') wort += text[i + 1]; i += 2; continue; }
      wort += z; i++;
    }
    w.push(wort);
  }
  return w;
}
/* strtoul mit Basis 0 wie number_option: Präfix muss eine Zahl sein, sonst Fehler */
function sysZahl(text) {
  const m = /^\s*([+-]?)(0[xX][0-9a-fA-F]+|0[0-7]*|[1-9][0-9]*)/.exec(text);
  if (!m) return null;
  const v = m[2].length > 1 && /^0[xX]/.test(m[2]) ? parseInt(m[2].slice(2), 16) : m[2].length > 1 && m[2][0] === '0' ? parseInt(m[2], 8) : parseInt(m[2], 10);
  return m[1] === '-' ? -v : v;
}
const SYS_GERAETE = ['ttyUSB0'];
/* Liest /etc/ppp/peers/<peer> wie pppd call: Ergebnis { konfig } oder { fehler: [Zeilen] } (Meldungen wie option_error: "pppd: …") */
async function sysPppPeer(peer) {
  const datei = '/etc/ppp/peers/' + peer;
  const r = await sysDateiLesen(datei);
  if (r.fehler) return { fehler: ['pppd: Can\'t open options file ' + datei + ': ' + TERMINAL_VFS.fehlerText(r.fehler === 'EISDIR' ? 'EISDIR' : r.fehler)] };
  const woerter = sysPppWoerter(r.text), null0 = new Set(SYS_PPPD_OPTIONEN_0), eins = new Set(SYS_PPPD_OPTIONEN_1);
  const k = { geraet: '/dev/ttyUSB0', geschwindigkeit: null, persist: false, holdoff: 30, maxfail: 10, connect: null };   /* Standardwerte von pppd 2.4.9 */
  for (let i = 0; i < woerter.length; i++) {
    const w = woerter[i], fehler = function (text) { return { fehler: ['pppd: ' + text] }; };
    if (null0.has(w)) {
      if (w === 'persist') k.persist = true;
      if (w === 'nopersist') k.persist = false;
      continue;
    }
    if (eins.has(w)) {
      if (i + 1 >= woerter.length) return fehler('In file ' + datei + ": too few parameters for option '" + w + "'");
      const wert = woerter[++i];
      if (w === 'holdoff' || w === 'maxfail') {
        const v = sysZahl(wert);
        if (v === null) return fehler("invalid numeric parameter '" + wert + "' for " + w + ' option');
        k[w] = v;
      }
      if (w === 'connect') k.connect = wert;
      continue;
    }
    /* Platzhalteroptionen (o_wild): Gerät (setdevname, ohne "/" unter /dev) und Geschwindigkeit (setspeed) */
    const dev = w[0] === '/' ? w : '/dev/' + w;
    if (w && dev.startsWith('/dev/') && SYS_GERAETE.includes(dev.slice(5))) { k.geraet = dev; continue; }
    if (/^[0-9]+$/.test(w)) { k.geschwindigkeit = Number(w); continue; }
    return fehler('In file ' + datei + ": unrecognized option '" + w + "'");
  }
  return { konfig: k };
}

/* ---------- chat: Skript (do_file) und Ablauf (chat_expect, chat_send, get_string) ---------- */
/* Wörter wie do_file: zeilenweise, "#" am Zeilenanfang ist Kommentar, '…'/"…" (ohne Anführungszeichen übernommen, "\" überspringt ein Zeichen) */
function sysChatWoerter(text) {
  const w = [];
  const zeilen = text.split('\n');
  for (let n = 0; n < zeilen.length; n++) {
    const z = zeilen[n];
    if (z[0] === '#') continue;
    let i = 0;
    while (i < z.length) {
      if (z[i] === ' ' || z[i] === '\t') { i++; continue; }
      if (z[i] === '"' || z[i] === "'") {
        const q = z[i++], a = i;
        while (z[i] !== q) { if (i >= z.length) return { fehler: 'unterminated quote (line ' + (n + 1) + ')' }; if (z[i++] === '\\' && i < z.length) i++; }
        w.push(z.slice(a, i)); i++;
      } else { const a = i; while (i < z.length && z[i] !== ' ' && z[i] !== '\t') i++; w.push(z.slice(a, i)); }
    }
  }
  return { woerter: w };
}
/* connect-Zeile: "/usr/sbin/chat [-v] [-V] [-e] [-E] [-s] [-S] [-t timeout] [-f datei] [skript…]" (chat(8)) */
function sysChatAufruf(connect) {
  const w = sysPppWoerter(connect || '');
  if (!w.length || (w[0] !== '/usr/sbin/chat' && w[0] !== 'chat')) return null;
  const a = { datei: null, timeout: null, skript: [] };
  for (let i = 1; i < w.length; i++) {
    if (w[i] === '-f') { a.datei = w[++i] || ''; continue; }
    if (w[i] === '-t') { a.timeout = Number(w[++i]); continue; }
    if (/^-[vVeEsS]+$/.test(w[i])) continue;
    a.skript = w.slice(i); break;
  }
  return a;
}
/* Ablauf eines chat-Prozesses gegen das simulierte Modem. ctx: { praefix, csq, ausgang ('ok'|'busy'|'nocarrier'|'alarm'), nummer (Gateway),
   dauer (Wahldauern in ms), timeout (Startwert in s) }. Ergebnis { schritte: [[ms seit Beginn, [Zeilen]]], verbunden: bool, abbruch: bool }.
   Vereinfachungen wie bisher (docs/terminal.md): ein leeres Expect und ein leeres Send werden nicht protokolliert; Antwortzeilen des Modems
   erscheinen ganz, sobald sie eintreffen. Antwortzeiten des Modems: ATZ und übrige AT-Befehle 150 ms, AT+CSQ 550 ms (wie bisher). */
function sysChatAblauf(woerter, ctx) {
  const c = ctx.praefix, schritte = [], zeit = { t: 0 }, aborts = [];
  let timeout = ctx.timeout > 0 ? ctx.timeout : 45, naechstes = null, antwort = null, verbunden = false;
  const log = function (t, zeilen) { const l = schritte[schritte.length - 1]; if (l && l[0] === t) l[1].push(...zeilen); else schritte.push([t, zeilen.slice()]); };
  const sichtbar = function (s) { return s.replace(/[\u0000-\u001f]/g, function (z) { return '^' + String.fromCharCode(z.charCodeAt(0) + 64); }); };
  const senden = function (s) {
    if (s === '') return;   /* Vereinfachung: leeres Send ohne Protokoll und ohne Wirkung */
    const ohneCr = /\\c$/.test(s), text = ohneCr ? s.slice(0, -2) : s;
    log(zeit.t, [c + 'send (' + sichtbar(text) + (ohneCr ? '' : '^M') + ')']);
    const befehl = text.toUpperCase(), echo = text + '^M^M';
    if (/^ATD[TP]?/.test(befehl)) {
      const nummer = text.replace(/^ATD[TP]?/i, '');
      let ausgang = ctx.ausgang;
      if (nummer !== ctx.nummer && ausgang === 'ok') ausgang = 'nocarrier';   /* andere Nummer: kein Träger (S6) */
      if (ausgang === 'ok') { antwort = { bei: zeit.t + ctx.dauer.connect, zeilen: [echo, 'CONNECT 19200'] }; verbunden = 'wartend'; }
      else if (ausgang === 'busy') antwort = { bei: zeit.t + ctx.dauer.busy, zeilen: [echo, 'BUSY'] };
      else if (ausgang === 'nocarrier') antwort = { bei: zeit.t + ctx.dauer.nocarrier, zeilen: [echo, 'NO CARRIER'] };
      else antwort = null;   /* kein Satellit: das Modem antwortet nicht */
    } else if (/^AT/.test(befehl)) {
      antwort = /^AT\+CSQ$/.test(befehl) ? { bei: zeit.t + 550, zeilen: [echo, ctx.csq + '^M', '^M', 'OK'] } : { bei: zeit.t + 150, zeilen: [echo, 'OK'] };
    } else antwort = { bei: zeit.t + 150, zeilen: [echo, 'ERROR'] };
  };
  const scheitern = function (t, zeilen) { log(t, zeilen); return { schritte: schritte, verbunden: false, abbruch: true }; };
  for (let i = 0; i < woerter.length; i += 2) {
    const e = woerter[i], s = woerter[i + 1];
    const kw = ['ABORT', 'CLR_ABORT', 'REPORT', 'CLR_REPORT', 'TIMEOUT', 'ECHO', 'SAY', 'HANGUP'];
    if (kw.includes(e)) {
      if (s === undefined) break;
      if (e === 'ABORT') { aborts.push(s); log(zeit.t, [c + 'abort on (' + s + ')']); }
      if (e === 'CLR_ABORT') { const j = aborts.indexOf(s); if (j >= 0) { aborts.splice(j, 1); log(zeit.t, [c + 'clear abort on (' + s + ')']); } }
      if (e === 'REPORT') log(zeit.t, [c + 'report (' + s + ')']);
      if (e === 'TIMEOUT') { timeout = parseInt(s, 10) > 0 ? parseInt(s, 10) : 45; log(zeit.t, [c + 'timeout set to ' + timeout + ' seconds']); }
      continue;
    }
    if (e !== '') {
      log(zeit.t, [c + 'expect (' + e + ')']);
      const frist = zeit.t + timeout * 1000;
      if (!antwort || antwort.bei > frist) return scheitern(frist, [c + 'alarm', c + 'Failed']);
      /* frühester Treffer im Zeichenstrom: erwartete Zeichenfolge oder ABORT */
      const strom = antwort.zeilen.join('\n');
      let treffer = { pos: strom.indexOf(e), art: 'ok', wort: e };
      if (treffer.pos < 0) treffer = { pos: Infinity, art: null };
      aborts.forEach(function (a) { const p = strom.indexOf(a); if (p >= 0 && p < treffer.pos) treffer = { pos: p, art: 'abort', wort: a }; });
      zeit.t = antwort.bei;
      if (treffer.art === null) {   /* keine passende Antwort: chat wartet bis zum Timeout */
        log(zeit.t, antwort.zeilen.map(function (z) { return c + z; }));
        return scheitern(frist, [c + 'alarm', c + 'Failed']);
      }
      const bis = strom.slice(0, treffer.pos + treffer.wort.length).split('\n').length;
      log(zeit.t, antwort.zeilen.slice(0, bis).map(function (z) { return c + z; }));
      if (treffer.art === 'abort') return scheitern(zeit.t, [c + ' -- failed', c + 'Failed (' + treffer.wort + ')']);
      log(zeit.t, [c + ' -- got it']);
      if (verbunden === 'wartend' && antwort.zeilen[1] === 'CONNECT 19200') verbunden = true;
      antwort = null;
    }
    if (s !== undefined) senden(s);
  }
  /* Skript beendet: Erfolg des Connect-Skripts; ein Träger besteht nur nach erfolgreicher Wahl */
  if (verbunden === 'wartend') { zeit.t = antwort.bei; verbunden = true; }
  return { schritte: schritte, verbunden: verbunden === true, abbruch: false, ende: zeit.t };
}

/* ---------- WireGuard (wg-quick/linux.bash, src/config.c) ---------- */
function sysB64(bytes) { let s = ''; bytes.forEach(function (b) { s += String.fromCharCode(b); }); return btoa(s); }
function sysB64Bytes(text) {
  if (typeof text !== 'string' || !/^[A-Za-z0-9+/]{42}[AEIMQUYcgkosw048]=$/.test(text)) return null;   /* key_from_base64: genau 32 Bytes */
  return Uint8Array.from(atob(text), function (z) { return z.charCodeAt(0); });
}
/* wg genkey: 32 Zufallsbytes, geklemmt (curve25519_clamp_secret) */
function sysWgSchluesselNeu() {
  const k = crypto.getRandomValues(new Uint8Array(32));
  k[0] &= 248; k[31] = (k[31] & 127) | 64;
  return sysB64(k);
}
/* X25519 (RFC 7748, Montgomery-Leiter) für wg pubkey: öffentlicher Schlüssel = X25519(privat, 9). BigInt genügt (ein Aufruf je Start). */
function sysX25519Basis(privat) {
  const p = (1n << 255n) - 19n, a24 = 121665n;
  const k = Uint8Array.from(privat); k[0] &= 248; k[31] = (k[31] & 127) | 64;
  let n = 0n; for (let i = 31; i >= 0; i--) n = (n << 8n) | BigInt(k[i]);
  const mod = function (x) { const r = x % p; return r < 0n ? r + p : r; };
  const pot = function (b, e) { let r = 1n; b = mod(b); while (e > 0n) { if (e & 1n) r = mod(r * b); b = mod(b * b); e >>= 1n; } return r; };
  let x2 = 1n, z2 = 0n, x3 = 9n, z3 = 1n, swap = 0n;
  for (let t = 254n; t >= 0n; t--) {
    const kt = (n >> t) & 1n;
    if (swap ^ kt) { [x2, x3] = [x3, x2]; [z2, z3] = [z3, z2]; }
    swap = kt;
    const A = mod(x2 + z2), AA = mod(A * A), B = mod(x2 - z2), BB = mod(B * B), E = mod(AA - BB), C = mod(x3 + z3), D = mod(x3 - z3);
    const DA = mod(D * A), CB = mod(C * B);
    x3 = mod((DA + CB) * (DA + CB)); z3 = mod(9n * mod((DA - CB) * (DA - CB)));
    x2 = mod(AA * BB); z2 = mod(E * mod(AA + a24 * E));
  }
  if (swap) { [x2, x3] = [x3, x2]; [z2, z3] = [z3, z2]; }
  let u = mod(x2 * pot(z2, p - 2n));
  const aus = new Uint8Array(32);
  for (let i = 0; i < 32; i++) { aus[i] = Number(u & 255n); u >>= 8n; }
  return aus;
}
/* Liest /etc/wireguard/<if>.conf wie wg-quick (parse_options) und den Rest wie wg setconf (config_read_line, process_line).
   Ergebnis { konfig, warnung } oder { fehler: [Zeilen], phase: 'parse'|'setconf' } */
async function sysWgKonfig(iface) {
  const datei = '/etc/wireguard/' + iface + '.conf';
  const st = await sysDateiStat(datei);
  if (st.fehler) return { fehler: ['wg-quick: `' + datei + "' does not exist"], phase: 'parse' };
  const r = await sysDateiLesen(datei);
  if (r.fehler) return { fehler: ['wg-quick: `' + datei + "' does not exist"], phase: 'parse' };
  const k = { adressen: [], mtu: null, postUp: [], port: null, privat: null, peers: [] };
  let abschnitt = null, peer = null;
  const wgZeilen = [];
  for (const roh of r.text.split('\n')) {
    const ohne = roh.split('#')[0], schluessel = ohne.split('=')[0].trim(), wert = ohne.includes('=') ? ohne.slice(ohne.indexOf('=') + 1).trim() : ohne.trim();
    const sk = schluessel.toLowerCase();
    if (schluessel.startsWith('[')) abschnitt = null;
    if (sk === '[interface]') abschnitt = 'if';
    if (abschnitt === 'if') {
      if (sk === 'address') { k.adressen.push(...wert.split(',').map(function (x) { return x.trim(); }).filter(Boolean)); continue; }
      if (sk === 'mtu') { k.mtu = wert; continue; }
      if (sk === 'postup') { k.postUp.push(wert); continue; }
      if (['dns', 'table', 'preup', 'predown', 'postdown', 'saveconfig'].includes(sk)) continue;
    }
    wgZeilen.push(roh);
  }
  /* wg setconf: Zeile ohne Leerraum und Kommentar; Schlüssel ohne Unterschied der Großschreibung (strncasecmp) */
  let geraet = false;
  const fehler = function (zeilen) { return { fehler: zeilen.concat('Configuration parsing error'), phase: 'setconf' }; };
  for (const roh of wgZeilen) {
    const zeile = roh.split('#')[0].replace(/\s/g, '');
    if (!zeile) continue;
    const z = zeile.toLowerCase();
    if (z === '[interface]') { geraet = true; peer = null; continue; }
    if (z === '[peer]') { geraet = false; peer = { publicKey: null, endpunkt: null, erlaubt: [] }; k.peers.push(peer); continue; }
    const eq = zeile.indexOf('='), sch = eq > 0 ? z.slice(0, eq) : null, wert = eq > 0 ? zeile.slice(eq + 1) : null;
    if (geraet && sch === 'listenport') {
      if (!wert) return fehler(['Unable to parse empty port']);
      if (!/^\d+$/.test(wert) || Number(wert) > 65535) return fehler(['Servname not supported for ai_socktype: `' + wert + "'"]);   /* getaddrinfo, EAI_SERVICE */
      k.port = Number(wert); continue;
    }
    if (geraet && sch === 'privatekey') { if (!sysB64Bytes(wert)) return fehler(['Key is not the correct length or format: `' + wert + "'"]); k.privat = wert; continue; }
    if (geraet && sch === 'fwmark') continue;
    if (peer && sch === 'publickey') { if (!sysB64Bytes(wert)) return fehler(['Key is not the correct length or format: `' + wert + "'"]); peer.publicKey = wert; continue; }
    if (peer && sch === 'endpoint') {
      if (!wert) return fehler(['Unable to parse empty endpoint']);
      const m = /^(.*):([^:]*)$/.exec(wert);
      if (!m || !m[2]) return fehler(['Unable to find port of endpoint: `' + wert + "'"]);
      if (!/^\d+$/.test(m[2]) || Number(m[2]) > 65535) return fehler(['Servname not supported for ai_socktype: `' + wert + "'"]);
      /* Namensauflösung ohne DNS (Simulation): IPv4-Adresse oder Eintrag in /etc/hosts, sonst EAI_NONAME */
      const ip = /^\d{1,3}(\.\d{1,3}){3}$/.test(m[1]) ? m[1] : await sysHostsAufloesen(m[1]);
      if (!ip) return fehler(['Name or service not known: `' + wert + "'"]);
      peer.endpunkt = ip + ':' + Number(m[2]); continue;
    }
    if (peer && sch === 'allowedips') {
      for (const a of wert.split(',')) if (!/^\d{1,3}(\.\d{1,3}){3}(\/\d{1,2})?$/.test(a) && !/:/.test(a)) return fehler(['AllowedIP is not in the correct format: `' + a + "'"]);
      peer.erlaubt.push(...wert.split(',')); continue;
    }
    if (peer && (sch === 'persistentkeepalive' || sch === 'presharedkey')) continue;
    return fehler(['Line unrecognized: `' + zeile + "'"]);
  }
  if (k.peers.some(function (p) { return !p.publicKey; })) return fehler(['A peer is missing a public key']);
  /* Warnung wie parse_options: Datei UND Verzeichnis für andere zugänglich (Modus & 0007) */
  const dir = await sysDateiStat('/etc/wireguard');
  const warnung = (st.eintrag && dir.eintrag && (st.eintrag.modus & dir.eintrag.modus & 0o007)) ? 'Warning: `' + datei + "' is world accessible" : null;
  return { konfig: k, warnung: warnung };
}
/* PostUp (begrenzte Simulationsfunktion, Präzisierung 25.11.2026): nur "wg set %i private-key <Datei>"; keine allgemeine Ausführung.
   Ergebnis { zeilen, privat } oder { zeilen, fehler: true } */
async function sysWgPostUp(befehl, iface) {
  const text = befehl.replace(/%i/g, iface), zeilen = ['[#] ' + text];
  const m = /^wg\s+set\s+(\S+)\s+private-key\s+(\S+)$/.exec(text.trim());
  if (!m || m[1] !== iface) return { zeilen: zeilen.concat("wg-quick: PostUp is limited to 'wg set %i private-key <file>' in this terminal"), fehler: true };
  const r = await sysDateiLesen(m[2]);
  if (r.fehler) return { zeilen: zeilen.concat('fopen: ' + TERMINAL_VFS.fehlerText(r.fehler)), fehler: true };
  /* parse_keyfile: genau 44 Zeichen, danach nur Leerraum; leere Datei bedeutet Schlüssel null */
  if (r.text === '') return { zeilen: zeilen, privat: null };
  const kopf = r.text.slice(0, 44), rest = r.text.slice(44);
  if (kopf.length < 44) return { zeilen: zeilen.concat('Invalid length key in key file'), fehler: true };
  const fremd = rest.split('').find(function (z) { return !/\s/.test(z); });
  if (fremd) return { zeilen: zeilen.concat('Found trailing character in key file: `' + fremd + "'"), fehler: true };
  if (!sysB64Bytes(kopf)) return { zeilen: zeilen.concat('Key is not the correct length or format: `' + kopf + "'"), fehler: true };
  return { zeilen: zeilen, privat: kopf };
}
/* Handshake mit der Gegenstelle ist nur möglich, wenn Endpunkt und Schlüssel der Gegenstelle stimmen, ein privater Schlüssel gesetzt ist und
   die erlaubten Adressen die Tunneladresse der Gegenstelle enthalten (S6: realistische Folgen nur bei eigener Änderung). */
function sysWgErreichbar(k, privat) {
  const p = k.peers.find(function (x) { return x.publicKey === SYS_WG.gegenstelle; });
  if (!p || p.endpunkt !== SYS_WG.endpunkt || !privat) return false;
  return p.erlaubt.some(function (a) {
    const [netz, bits] = a.split('/'), b = bits === undefined ? 32 : Number(bits);
    const zahl = function (ip) { return ip.split('.').reduce(function (s, x) { return s * 256 + Number(x); }, 0); };
    if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(netz) || b > 32) return false;
    const maske = b === 0 ? 0 : (0xffffffff << (32 - b)) >>> 0;
    return ((zahl(netz) & maske) >>> 0) === ((zahl(SYS_WG.tunnelGegenstelle) & maske) >>> 0);
  });
}

/* ---------- Hostname (hostname(1), hostname(7)) ---------- */
const TERMINAL_SYS = { hostname: SYS_HOSTNAME_STANDARD, ppp: null, wg: null, qth: null };   /* aktiver Hostname, Stand der Konfiguration (Einwahl, WireGuard), QTH von predict */
/* Gültig nach hostname(7): Labels aus Buchstaben, Ziffern und "-", nicht mit "-" beginnend oder endend, insgesamt höchstens 64 Zeichen */
function sysHostnameGueltig(name) { return name.length > 0 && name.length <= 64 && name.split('.').every(function (l) { return /^[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/.test(l); }); }
/* Der aktive Name wird bei der Anmeldung gelesen (terminalVfsBereit in profil-modul.js): erste Zeile von /etc/hostname; fehlt oder ist
   sie ungültig, gilt "localhost" (Annahme, Rückfallname). */
/* IPv4-Adresse eines Namens aus /etc/hosts (erster passender Eintrag) oder null */
async function sysHostsAufloesen(name) {
  const r = await sysDateiLesen('/etc/hosts');
  if (r.fehler) return null;
  for (const z of r.text.split('\n')) {
    const w = z.split('#')[0].trim().split(/\s+/);
    if (w.length > 1 && /^\d{1,3}(\.\d{1,3}){3}$/.test(w[0]) && w.slice(1).includes(name)) return w[0];
  }
  return null;
}
/* ---------- predict: QTH (~/.predict/predict.qth) ---------- */
/* Format von predict: Name, Breite (Nord positiv), Länge (WEST positiv), Höhe in Metern, je eine Zeile. Ungültig oder fehlend: null. */
function sysQthParse(text) {
  const z = text.split('\n').map(function (x) { return x.trim(); });
  if (z.length < 4) return null;
  const lat = Number(z[1]), lonW = Number(z[2]), hoehe = Number(z[3]);
  if (!z[0] || !Number.isFinite(lat) || !Number.isFinite(lonW) || !Number.isFinite(hoehe) || Math.abs(lat) > 90 || Math.abs(lonW) > 360) return null;
  const lonE = ((-lonW % 360) + 540) % 360 - 180;
  return { name: z[0].slice(0, 24), lat: lat, lon: lonE, hoehe: hoehe };
}
/* Beim Start von predict (S5): eigene QTH-Datei hat Vorrang; sonst dynamisch der Ausgangsort des Profils, danach Berlin (kestrelQth). */
async function sysPredictQthLaden() {
  const r = await sysDateiLesen('/home/raizo/.predict/predict.qth', true);   /* predict läuft als raizo */
  TERMINAL_SYS.qth = r.fehler ? null : sysQthParse(r.text);
  return TERMINAL_SYS.qth;
}
