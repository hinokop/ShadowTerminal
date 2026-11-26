/* Paket 5, A0 bei laufender Recherche (Review zu #141): gesteuerte Uhr, Standardkonfiguration, repräsentativer Bestand (200 zusätzliche Dossiers).
   1. Eine Recherche über /intel läuft bei angehaltener Uhr vollständig durch (Freigabe der Ereignisschleife nach Takten, nicht nur nach Zeit).
   2. pon kestrel && tmux split-window -bd plog -f mit den bisherigen Dauern; während einer laufenden Recherche (angehalten am Lesepunkt) bleibt
      der Link bestehen, plog -f schreibt weiter.
   3. Linkende (LOS bzw. LINK END) während einer laufenden Recherche: Hangup zum vorgesehenen Zeitpunkt, die Recherche endet danach mit korrektem Ergebnis.
   Der weitere Ablauf mit wg-quick und profanity ist durch terminal-sys.js (A0) abgedeckt; profanity übernimmt die Eingabe, eine gleichzeitige
   Recherche ist dort nicht möglich. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright');
const { APP } = require('./_pfad');
const { imUeberflug, schnelleWahl } = require('./_kestrel');

const PW = 'pw-test-123';
(async () => {
  const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'ft-p5a0-')), { reducedMotion: 'reduce', viewport: { width: 1280, height: 900 } });
  try {
    const p = await ctx.newPage();
    p.setDefaultTimeout(30000);
    const fehler = [];
    p.on('pageerror', e => fehler.push(e.message));
    await p.route(/^https?:/, r => r.abort());
    await p.goto(APP);
    await p.fill('#gate-pw', PW); if (await p.isVisible('#gate-pw2')) await p.fill('#gate-pw2', PW);
    await p.click('#gate-go');
    await p.waitForFunction(() => typeof APP_BEREIT !== 'undefined' && APP_BEREIT && !!STATE && !document.body.classList.contains('locked'));
    const anzahl = await p.evaluate(() => {
      for (let i = 0; i < 200; i++) {
        dispatch({ type: 'DOSSIER_ANGELEGT', name: 'A0 ' + i, typ: 'Person' });
        dispatch({ type: 'DOSSIER_NOTIZ', id: STATE.dossiers.eigene.at(-1).id, text: 'A0MARKE ' + i });
      }
      return STATE.dossiers.eigene.length;
    });
    assert.ok(anzahl >= 200);
    await p.click('#profil-terminal-oeffnen');
    await p.waitForFunction(() => terminalSysAktuell());
    const inp = p.locator('#profil-terminal-eingabe'), out = p.locator('#profil-terminal-ausgabe');
    const fertig = () => p.waitForFunction(() => !TERMINAL_ZUSTAND.kette && !TERMINAL_ZUSTAND.dateiLaeuft && !TERMINAL_ZUSTAND.sudo);
    const lauf = async z => {
      const roh = await out.textContent(), vorher = roh === '' ? 0 : roh.split('\n').length;
      await inp.fill(z); await inp.press('Enter'); await fertig();
      return (await out.textContent()).split('\n').slice(vorher + 1).join('\n');
    };
    /* Haltestelle am Lesepunkt von /intel (Notiz eines bestimmten Dossiers) */
    await p.evaluate(() => {
      const a = TERMINAL_ANBIETER.intel, rf = a.readFile;
      window.__h = null;
      a.readFile = async function (seg) {
        const h = window.__h;
        if (h && seg.join('/').endsWith(h.bei)) { window.__h = null; h.erreicht = true; await new Promise(ok => { h.weiter = ok; }); }
        return rf.apply(this, arguments);
      };
    });
    const halte = async (zeile, bei) => {
      await p.evaluate(b => { window.__hA = window.__h = { bei: b }; }, bei);
      const roh = await out.textContent();
      await inp.fill(zeile); await inp.press('Enter');
      await p.waitForFunction(() => window.__hA.erreicht);
      return roh === '' ? 0 : roh.split('\n').length;
    };
    const lezte = await p.evaluate(() => STATE.dossiers.eigene.at(-1).id);

    await p.clock.install();
    await schnelleWahl(p);
    await imUeberflug(p, { wahl: 'ok' });
    /* 1. bei angehaltener Uhr */
    assert.equal(await lauf('grep -ri a0marke /intel/dossiers/persons | wc -l'), '200', 'Recherche bei angehaltener Uhr');
    /* 2. Einwahl mit den bisherigen Dauern, Recherche während des bestehenden Links */
    await lauf('tmux');
    const start = await p.evaluate(() => Date.now());
    await lauf('pon kestrel && tmux split-window -bd plog -f');
    await p.clock.runFor(6600);
    assert.equal(await p.evaluate(() => TERMINAL_ZUSTAND.modem?.bereit), false, 'keine Verbindung vor der bisherigen Dauer');
    await p.clock.runFor(200);
    assert.equal(await p.evaluate(() => TERMINAL_ZUSTAND.modem?.bereit), true, 'verbunden nach der bisherigen Dauer');
    assert.ok((await p.evaluate(() => Date.now())) - start <= 6800);
    assert.match(await p.locator('.tmux-pane').nth(0).textContent(), /pppd\[\d+\]: remote IP address/, 'plog -f zeigt die Einwahl');
    let vor = await halte('grep -rci a0marke /intel/dossiers/persons | grep -c ":1$"', lezte + '/notes');
    await p.clock.runFor(3000);
    assert.equal(await p.evaluate(() => TERMINAL_ZUSTAND.modem?.bereit), true, 'Link besteht während der Recherche');
    assert.equal(await p.evaluate(() => !!TERMINAL_ZUSTAND.satLink && !TERMINAL_ZUSTAND.satLink.abgelaufen), true);
    await p.evaluate(() => window.__hA.weiter());
    await fertig();
    assert.equal((await out.textContent()).split('\n').slice(vor + 1).join('\n'), '200');
    /* 3. LOS während einer laufenden Recherche */
    vor = await halte('grep -ri a0marke /intel/dossiers/persons | wc -l', lezte + '/notes');
    /* Die zu prüfende Verbindung festhalten: pppd darf schon 1 s nach ihrem
       Hangup erneut wählen und satLink durch einen neuen Versuch ersetzen.
       Der neue Versuch ist nicht der Link, dessen LOS wir prüfen. */
    const rest = await p.evaluate(() => {
      window.__a0Link = TERMINAL_ZUSTAND.satLink;
      return window.__a0Link.bis - Date.now();
    });
    assert.ok(rest > 2000 && rest < 3600000, 'Linkende in ' + rest + ' ms');
    await p.clock.runFor(rest - 1000);
    const davor = await p.evaluate(() => ({
      selber: TERMINAL_ZUSTAND.satLink === window.__a0Link,
      abgelaufen: !!window.__a0Link.abgelaufen, bereit: !!TERMINAL_ZUSTAND.modem?.bereit
    }));
    assert.deepEqual(davor, { selber: true, abgelaufen: false, bereit: true }, 'ursprünglicher Link steht bis kurz vor LOS');
    await p.clock.runFor(2000);
    const danach = await p.evaluate(() => ({
      altAbgelaufen: !!window.__a0Link.abgelaufen,
      altEnde: window.__a0Link.bis, jetzt: Date.now(),
      neuerLink: !!TERMINAL_ZUSTAND.satLink && TERMINAL_ZUSTAND.satLink !== window.__a0Link,
      neuerSat: TERMINAL_ZUSTAND.satLink?.sat?.name || null,
      neuerEnde: TERMINAL_ZUSTAND.satLink?.bis || null,
      bereit: !!TERMINAL_ZUSTAND.modem?.bereit, phase: TERMINAL_ZUSTAND.modem?.phase || null
    }));
    assert.equal(danach.altAbgelaufen, true, 'Abbau des ursprünglichen Links bei LOS trotz laufender Recherche: ' + JSON.stringify(danach));
    assert.equal(danach.bereit, false, 'keine bereits stehende PPP-Verbindung unmittelbar nach LOS: ' + JSON.stringify(danach));
    console.log('A0 LOS: ' + JSON.stringify(danach));
    await p.evaluate(() => { delete window.__a0Link; });
    assert.ok(await p.evaluate(() => TERMINAL_ZUSTAND.syslog.some(z => /Modem hangup \(NO CARRIER\)/.test(z))), 'Hangup im Systemprotokoll');
    assert.match(await p.locator('.tmux-pane').nth(0).textContent(), /Modem hangup/, 'plog -f zeigt den Abbau');
    await p.evaluate(() => window.__hA.weiter());
    await fertig();
    /* pppd meldet den Abbau wie bisher auch in der Konsole; das Ergebnis der Recherche folgt danach */
    const nachLos = (await out.textContent()).split('\n').slice(vor + 1);
    assert.equal(nachLos.at(-1), '200', 'Ergebnis nach LOS korrekt: ' + nachLos.join('|'));
    assert.ok(nachLos.slice(0, -1).every(l => /^pppd\[\d+\]: /.test(l)), nachLos.join('|'));
    await lauf('poff');
    await lauf('tmux kill-server');
    await p.clock.resume();
    assert.deepEqual(fehler, [], fehler.join('; '));
    console.log('terminal-paket5-a0 grün');
  } finally { await ctx.close(); }
})().catch(e => { console.error(e); process.exit(1); });
