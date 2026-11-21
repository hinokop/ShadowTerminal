/* map und open: Navigation nach Kennung über zielZugang. map öffnet die Lagekarte, map PIN-nnn und open PIN-nnn springen
   zum Pin (kartenObjektZeigen), open P-/O-/L-nnnn öffnet das Dossier (DOSSIER_GEOEFFNET wie dossierLink). Manuell gesperrte
   Ziele: Permission denied, keine Navigation; Pins nur über ihr verknüpftes Dossier gesperrt. Zeichnet die Karte statt
   des Pins seine Sichtung, wird die Sichtung gewählt. Nach dem Sprung ist das Terminal minimiert; pppd, tmux und Profanity
   laufen weiter, auch über Modulwechsel der Oberfläche. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { APP } = require('./_pfad');
const { imUeberflug, bis, schnelleWahl } = require('./_kestrel');

(async () => {
  const b = await chromium.launch();
  try {
    const p = await b.newPage({ viewport: { width: 1500, height: 1000 }, reducedMotion: 'reduce' });
    p.setDefaultTimeout(15000);
    const errors = [];
    p.on('pageerror', e => errors.push(e.message));
    await p.route(/^https?:/, r => r.abort());
    await p.clock.install();
    await p.goto(APP);
    await p.fill('#gate-pw', 'pw-test-123');
    if (await p.isVisible('#gate-pw2')) await p.fill('#gate-pw2', 'pw-test-123');
    await p.click('#gate-go');
    await p.waitForFunction(() => !document.body.classList.contains('locked'));
    const z = await p.evaluate(() => {
      const neu = name => { dispatch({ type: 'DOSSIER_ANGELEGT', name, typ: 'Person' }); return STATE.dossiers.eigene.find(x => x.name === name).id; };
      const frei = neu('Quellner Ida'), gesperrt = neu('Quarzfeld Testmann');
      const pin = (name, dossier) => { dispatch({ type: 'PIN_ANGELEGT', ll: [52.52 + PROFIL.pins.length * 0.001, 13.405], name, dossier }); return PROFIL.pins.at(-1).id; };
      const offen = pin('Parkplatz Nord'), zu = pin('Kühlhaus Quellweg', gesperrt), entwurf = pin('Hofeinfahrt West', frei);
      dispatch({ type: 'SICHTUNG_HINZU', id: frei, ort: '52.5301, 13.4101', text: 'am Tor', pin: entwurf });
      dispatch({ type: 'DOSSIER_SPERREN', id: gesperrt });
      dispatch({ type: 'NAVIGATION', modul: 'profil' }); renderModule();
      return { frei, gesperrt, offen, zu, entwurf, si: PROFIL.pins.find(x => x.id === entwurf).sichtung };
    });
    assert.match(z.frei, /^P-\d{4}$/); assert.match(z.offen, /^PIN-\d{3}$/); assert.ok(z.si);
    await p.click('#profil-terminal-oeffnen');
    const inp = p.locator('#profil-terminal-eingabe'), out = p.locator('#profil-terminal-ausgabe');
    const cmd = async zeile => { await inp.fill(zeile); await inp.press('Enter'); await p.waitForFunction(() => !TERMINAL_ZUSTAND.kette); };
    const minimiert = () => p.evaluate(() => document.getElementById('profil-terminal').classList.contains('minimiert'));
    const zurueck = async () => { assert.equal(await minimiert(), true, 'Terminal minimiert'); await p.click('#profil-terminal-minimieren'); };
    const status = async () => { await cmd('echo $?'); return (await out.textContent()).trim().split('\n').at(-1); };
    const ansicht = () => p.evaluate(() => ({ modul: STATE.ui.modul, auswahl: STATE.ui.modul === 'karte' ? VIEW.karte.auswahl : STATE.dossiers.auswahl }));
    const popup = () => p.evaluate(() => { const x = document.getElementById('k-auswahl'); return x && !x.hidden ? (x.querySelector('#pin-name')?.value || x.innerText) : null; });

    /* map: Lagekarte */
    await cmd('map');
    assert.equal((await ansicht()).modul, 'karte');
    await zurueck(); assert.equal(await status(), '0');

    /* open: Dossier; Pin über open und map */
    await cmd('open ' + z.frei);
    assert.deepEqual(await ansicht(), { modul: 'dossier', auswahl: z.frei });
    await zurueck(); assert.equal(await status(), '0');
    for (const befehl of ['open', 'map']) {
      await p.evaluate(() => { dispatch({ type: 'NAVIGATION', modul: 'profil' }); renderModule(); });
      await cmd(befehl + ' ' + z.offen);
      assert.deepEqual(await ansicht(), { modul: 'karte', auswahl: z.offen });
      assert.equal(await popup(), 'Parkplatz Nord', 'Informationsfenster des Pins');
      await zurueck(); assert.equal(await status(), '0');
    }

    /* Pin, den die Karte zugunsten seiner Sichtung ausblendet: die Sichtung wird gewählt, ihr Fenster zeigt den Pin */
    assert.equal(await p.evaluate(i => karteMarker().some(m => m.id === i), z.entwurf), false);
    await cmd('map ' + z.entwurf);
    assert.deepEqual(await ansicht(), { modul: 'karte', auswahl: z.si });
    assert.equal(await popup(), 'Hofeinfahrt West');
    await zurueck();

    /* Gesperrt: keine Navigation, kein Minimieren */
    await p.evaluate(() => { dispatch({ type: 'NAVIGATION', modul: 'profil' }); renderModule(); });
    for (const [zeile, meldung] of [['open ' + z.gesperrt, 'open: ' + z.gesperrt + ': Permission denied'], ['map ' + z.zu, 'map: ' + z.zu + ': Permission denied'],
      ['open ' + z.zu, 'open: ' + z.zu + ': Permission denied'], ['open P-9999', 'open: P-9999: No such file or directory'],
      ['open PIN-999', 'open: PIN-999: No such file or directory'], ['open quellner', 'open: quellner: No such file or directory']]) {
      await cmd(zeile);
      assert.equal((await out.textContent()).trim().split('\n').at(-1), meldung);
      assert.equal(await status(), '1');
      assert.equal((await ansicht()).modul, 'profil', zeile);
      assert.equal(await minimiert(), false);
    }
    for (const zeile of ['open', 'map ' + z.frei, 'map ' + z.offen + ' x']) {
      await cmd(zeile);
      assert.match((await out.textContent()).trim().split('\n').at(-1), /^usage: (map \[PIN-nnn\]|open <P-nnnn\|O-nnnn\|L-nnnn\|PIN-nnn>)$/);
      assert.equal(await status(), '2');
    }

    /* Laufende Sitzungen: pppd und tmux bleiben bei open und map, Profanity bei Modulwechseln der Oberfläche */
    await schnelleWahl(p);
    await imUeberflug(p);
    await cmd('pon kestrel');
    await bis(p, () => TERMINAL_ZUSTAND.modem?.phase === 'up');
    await cmd('tmux'); await cmd('tmux split-window -bd predict');
    const sitzung = () => p.evaluate(() => ({ ppp: TERMINAL_ZUSTAND.modem?.phase, panes: TERMINAL_ZUSTAND.tmux?.panes.length }));
    const vorher = await sitzung();
    assert.deepEqual(vorher, { ppp: 'up', panes: 1 }, 'PREDICT-Bereich über der Shell');
    await cmd('open ' + z.frei); await zurueck();
    await cmd('map ' + z.offen); await zurueck();
    assert.deepEqual(await sitzung(), vorher);
    await inp.fill('wg-quick up wg-sat && profanity'); await inp.press('Enter');
    await bis(p, () => TERMINAL_ZUSTAND.kanal?.phase === 'eingabe');
    for (const m of ['dossier', 'karte', 'profil']) await p.evaluate(x => { dispatch({ type: 'NAVIGATION', modul: x }); renderModule(); }, m);
    assert.equal(await p.evaluate(() => TERMINAL_ZUSTAND.kanal?.phase), 'eingabe', 'Profanity läuft');
    assert.deepEqual(await sitzung(), vorher);
    assert.deepEqual(errors, []);
    console.log('OK: map und open (Kennung, Sperre, ausgeblendeter Pin, laufende Sitzungen)');
  } finally { await b.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
