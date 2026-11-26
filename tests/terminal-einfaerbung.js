/* Einfärbung beim Tippen (zsh-syntax-highlighting): Befehlswort grün oder rot, Anführungszeichen gelb, $? eigene Farbe,
   was die Shell abweist rot; Feld durchsichtig mit sichtbarem Cursor, Overlay deckungsgleich; im Chat keine Einfärbung. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { APP } = require('./_pfad');
const { chatBereit } = require('./_kestrel');

(async () => {
  const b = await chromium.launch({ ignoreDefaultArgs: ['--hide-scrollbars'] });
  try {
    const p = await b.newPage({ reducedMotion: 'reduce' });
    p.setDefaultTimeout(12000);
    const errors = [];
    p.on('pageerror', e => errors.push(e.message));
    await p.route(/^https?:/, r => r.abort());
    await p.goto(APP);
    await p.fill('#gate-pw', 'pw-test-123');
    if (await p.isVisible('#gate-pw2')) await p.fill('#gate-pw2', 'pw-test-123');
    await p.click('#gate-go'); await p.click('#profil-terminal-oeffnen');
    const inp = p.locator('#profil-terminal-eingabe'), geist = p.locator('#profil-terminal-vorschlag');
    const tippen = async z => { await inp.fill(''); await inp.focus(); await p.keyboard.type(z); };
    const lex = z => p.evaluate(z => terminalEinfaerben(z), z);
    /* Zerlegung: lückenlos, gleiche Regeln wie terminalZerlegen */
    const faelle = [
      ['echo hallo', [['echo', 'befehl'], [' ', 'leer'], ['hallo', 'argument']]],
      ['ech', [['ech', 'unbekannt']]],
      ['echo "a $? b" \'c\'', [['echo', 'befehl'], [' ', 'leer'], ['"a ', 'zeichenkette'], ['$?', 'variable'], [' b"', 'zeichenkette'], [' ', 'leer'], ["'c'", 'zeichenkette']]],
      ['echo $? && foo; ls', [['echo', 'befehl'], [' ', 'leer'], ['$?', 'variable'], [' ', 'leer'], ['&&', 'operator'], [' ', 'leer'], ['foo', 'unbekannt'], [';', 'operator'], [' ', 'leer'], ['ls', 'befehl']]],
      ['echo "offen', [['echo', 'befehl'], [' ', 'leer'], ['"offen', 'zeichenkette']]],
      ['"echo', [['"echo', 'zeichenkette']]],
      ['"echo" x', [['"echo"', 'befehl'], [' ', 'leer'], ['x', 'argument']]],
      ['ec"ho', [['ec', 'unbekannt'], ['"ho', 'zeichenkette']]],
      ['ls | cat', [['ls', 'befehl'], [' ', 'leer'], ['|', 'operator'], [' ', 'leer'], ['cat', 'befehl']]],   /* Pipe seit Paket 5 */
      ['ls |& cat', [['ls', 'befehl'], [' ', 'leer'], ['|&', 'fehler'], [' ', 'leer'], ['cat', 'argument']]],
      ['&& ls', [['&&', 'fehler'], [' ', 'leer'], ['ls', 'befehl']]],
      ['e\\cho x', [['e\\cho', 'befehl'], [' ', 'leer'], ['x', 'argument']]],
      ['tmux \\; ls', [['tmux', 'befehl'], [' ', 'leer'], ['\\;', 'argument'], [' ', 'leer'], ['ls', 'argument']]],
      ['echo $(ls)', [['echo', 'befehl'], [' ', 'leer'], ['$(', 'fehler'], ['ls)', 'argument']]],
    ];
    for (const [z, soll] of faelle) {
      const ist = await lex(z);
      assert.deepEqual(ist, soll, z);
      assert.equal(ist.map(t => t[0]).join(''), z, 'lückenlos: ' + z);
    }
    /* Oberfläche: Farben beim Tippen */
    await tippen('ech');
    assert.equal(await geist.locator('.f-unbekannt').textContent(), 'ech');
    await p.keyboard.type('o "x"');
    assert.equal(await geist.locator('.f-befehl').textContent(), 'echo');
    assert.equal(await geist.locator('.f-zeichenkette').textContent(), '"x"');
    assert.equal(await geist.locator('.text').textContent(), 'echo "x"', 'Overlay zeigt genau die Eingabe');
    const farbe = await p.evaluate(() => {
      const i = document.getElementById('profil-terminal-eingabe'), g = document.getElementById('profil-terminal-vorschlag');
      const st = getComputedStyle(i), gb = g.getBoundingClientRect(), ib = i.getBoundingClientRect();
      return { color: st.color, caret: st.caretColor, befehl: getComputedStyle(g.querySelector('.f-befehl')).color,
        lage: [gb.left - ib.left, gb.top - ib.top, gb.width - ib.width, gb.height - ib.height].map(Math.round) };
    });
    assert.equal(farbe.color, 'rgba(0, 0, 0, 0)', 'Feldtext durchsichtig');
    assert.notEqual(farbe.caret, 'rgba(0, 0, 0, 0)', 'Cursor sichtbar');
    assert.equal(farbe.befehl, 'rgb(127, 211, 107)');
    assert.deepEqual(farbe.lage, [0, 0, 0, 0], 'Overlay deckungsgleich mit dem Feld');
    /* Bildlaufleiste (wie unter Windows): Overlay bricht gleich um und rollt mit */
    await p.addStyleTag({ content: '#profil-terminal-eingabe::-webkit-scrollbar{width:17px}' });
    await inp.fill('echo ' + 'wort"x"'.repeat(140)); await inp.focus(); await p.keyboard.press('Control+End');
    const lauf = await p.evaluate(() => {
      const i = document.getElementById('profil-terminal-eingabe'), g = document.getElementById('profil-terminal-vorschlag');
      const ib = i.getBoundingClientRect(), st = getComputedStyle(i);
      const rand = ib.left + i.clientLeft + i.clientWidth - parseFloat(st.paddingRight);
      const rechts = Math.max(...[...g.querySelector('.text').getClientRects()].map(r => r.right));
      return { leiste: i.offsetWidth - i.clientWidth > 2, hoehe: [i.scrollHeight, g.scrollHeight], oben: [i.scrollTop, g.scrollTop], ueber: rechts - rand };
    });
    assert.ok(lauf.ueber <= 0.5, 'Overlaytext reicht nicht unter die Bildlaufleiste: ' + lauf.ueber);
    assert.ok(lauf.leiste, 'Testaufbau: Bildlaufleiste vorhanden');
    assert.ok(Math.abs(lauf.hoehe[0] - lauf.hoehe[1]) <= 1, 'gleicher Umbruch: ' + lauf.hoehe);
    assert.ok(lauf.oben[0] > 0 && Math.abs(lauf.oben[0] - lauf.oben[1]) <= 1, 'gleiche Rollposition: ' + lauf.oben);
    /* Fenster schmaler und wieder breiter ziehen, ohne Tastendruck: die Leiste erscheint und verschwindet,
       das Overlay folgt (Größen-Observer). Länge so gewählt, dass die Zeile breit gerade ohne Leiste auskommt. */
    const deckung = () => p.evaluate(() => new Promise(fertig => requestAnimationFrame(() => requestAnimationFrame(() => {
      const i = document.getElementById('profil-terminal-eingabe'), g = document.getElementById('profil-terminal-vorschlag');
      const ib = i.getBoundingClientRect(), st = getComputedStyle(i);
      const rand = ib.left + i.clientLeft + i.clientWidth - parseFloat(st.paddingRight);
      const rechts = Math.max(...[...g.querySelector('.text').getClientRects()].map(r => r.right));
      fertig({ leiste: i.offsetWidth - i.clientWidth - i.clientLeft * 2 > 2, ueber: rechts - rand, hoehe: [i.scrollHeight, g.scrollHeight] });
    }))));
    const breitAlt = await p.evaluate(() => { terminalKonsoleGeometrie.breite = 900; terminalKonsoleLayout(); return 900; });
    let n = 8;
    for (; n < 140; n++) {
      await inp.fill('echo ' + 'wort"x"'.repeat(n + 1));
      if ((await deckung()).leiste) break;
    }
    await inp.fill('echo ' + 'wort"x"'.repeat(n)); await inp.focus();
    assert.equal((await deckung()).leiste, false, 'Testaufbau: breit ohne Leiste');
    await p.evaluate(() => { terminalKonsoleGeometrie.breite = 560; terminalKonsoleLayout(); });
    let d = await deckung();
    assert.ok(d.leiste, 'Testaufbau: schmal mit Leiste');
    assert.ok(d.ueber <= 0.5, 'schmal: Overlaytext reicht nicht unter die Leiste: ' + d.ueber);
    assert.ok(Math.abs(d.hoehe[0] - d.hoehe[1]) <= 1, 'schmal: gleicher Umbruch ' + d.hoehe);
    await p.evaluate(b => { terminalKonsoleGeometrie.breite = b; terminalKonsoleLayout(); }, breitAlt);
    d = await deckung();
    assert.equal(d.leiste, false, 'breit: Leiste wieder weg');
    assert.ok(Math.abs(d.hoehe[0] - d.hoehe[1]) <= 1, 'breit: gleicher Umbruch ' + d.hoehe);
    /* Programmatische Änderungen (Tab-Ergänzung, Strg+C) folgen sofort */
    await tippen('pred'); await inp.press('Tab');
    assert.equal(await inp.inputValue(), 'predict ');
    assert.equal(await geist.locator('.text').textContent(), 'predict ');
    assert.equal(await geist.locator('.f-befehl').textContent(), 'predict');
    await inp.press('Control+c');
    assert.equal(await inp.inputValue(), '');
    assert.equal(await geist.isVisible(), false, 'leere Eingabe: kein Overlay');
    /* IME-Komposition: das Feld zeigt den Text selbst, danach wieder eingefärbt */
    await tippen('ls');
    await inp.evaluate(e => e.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true })));
    assert.equal(await geist.isVisible(), false, 'während der Komposition kein Overlay');
    assert.notEqual(await inp.evaluate(e => getComputedStyle(e).color), 'rgba(0, 0, 0, 0)', 'während der Komposition sichtbarer Feldtext');
    await inp.evaluate(e => e.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true })));
    assert.equal(await geist.locator('.f-befehl').textContent(), 'ls');
    /* Nach Enter: Feld leer, Overlay leer */
    await inp.fill('echo eins'); await inp.press('Enter'); await p.waitForFunction(() => !TERMINAL_ZUSTAND.kette);
    assert.equal(await geist.isVisible(), false);
    /* Chat: keine Einfärbung, normaler Feldtext */
    await chatBereit(p, { kontakt: false });
    await tippen('echo "hallo"');
    assert.equal(await geist.isVisible(), false, 'im Chat kein Overlay');
    assert.notEqual(await inp.evaluate(e => getComputedStyle(e).color), 'rgba(0, 0, 0, 0)', 'im Chat sichtbarer Feldtext');
    await inp.fill('/quit'); await inp.press('Enter');
    await p.waitForFunction(() => !TERMINAL_ZUSTAND.kanal);
    await tippen('ls');
    assert.equal(await geist.locator('.f-befehl').textContent(), 'ls', 'nach dem Chat wieder eingefärbt');
    assert.deepEqual(errors, []);
    console.log('OK: Einfärbung beim Tippen');
  } finally { await b.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
