const { vorbereiten } = require('./_satcon');
/* Terminal: Pfeiltasten blättern durch den Befehlsverlauf der Sitzung. Exit-Code 1 bei Fehlschlag. */
const assert = require('node:assert/strict'); const { chromium } = require('playwright'); const PF = require('./_pfad');
(async () => {
  const b = await chromium.launch(); const err = [];
  try {
    const p = await b.newPage(); p.on('pageerror', e => err.push(e.message));
    await p.route(/^https?:/, r => r.abort());
    await p.goto(PF.APP); await p.locator('#gate-pw').fill('pw-test-123'); if (await p.locator('#gate-pw2').isVisible()) await p.locator('#gate-pw2').fill('pw-test-123');
    await p.locator('#gate-go').click(); await p.waitForFunction(() => !document.body.classList.contains('locked'));
    await p.evaluate(() => dispatch({ type: 'NAVIGATION', modul: 'profil' }));
    await p.locator('#profil-terminal-oeffnen').click();
    const input = p.locator('#profil-terminal-eingabe'), wert = () => input.inputValue();
    const lauf = async z => { await input.fill(z); await input.press('Enter'); await p.waitForTimeout(150); };
    await input.focus(); await input.press('ArrowUp'); assert.equal(await wert(), '');                       /* leerer Verlauf: nichts */
    for (const z of ['pwd', 'whoami', 'whoami', 'date']) await lauf(z);                                       /* doppelte Folge zählt einmal */
    await input.fill('entwurf'); await input.press('ArrowUp'); assert.equal(await wert(), 'date');
    await input.press('ArrowUp'); assert.equal(await wert(), 'whoami');
    await input.press('ArrowUp'); assert.equal(await wert(), 'pwd');
    await input.press('ArrowUp'); assert.equal(await wert(), 'pwd');                                           /* Anfang bleibt */
    await input.press('ArrowDown'); assert.equal(await wert(), 'whoami');
    await input.press('ArrowDown'); await input.press('ArrowDown'); assert.equal(await wert(), 'entwurf');    /* Ende stellt den Entwurf wieder her */
    assert.equal(await p.evaluate(() => { const i = document.getElementById('profil-terminal-eingabe'); return i.selectionStart === i.value.length; }), true);
    await input.press('ArrowUp'); await input.press('Escape'); assert.equal(await wert(), 'entwurf');         /* Escape verwirft das Blättern */
    await input.fill(''); await input.press('ArrowUp'); await input.press('Enter'); await p.waitForTimeout(150);   /* wiederholter Befehl */
    assert.equal(await p.evaluate(() => TERMINAL_ZUSTAND.verlauf.join(',')), 'pwd,whoami,date');
    /* Kanal: nichts wird aufgenommen, Pfeiltasten blättern dort nicht */
    await vorbereiten(p);
    await lauf('secure-channel --connect --iface sat0 --route mixnet --ephemeral');
    await p.waitForFunction(() => document.querySelector('#profil-terminal-prompt').textContent === 'you >', null, { timeout: 40000 });
    const vorher = await p.evaluate(() => TERMINAL_ZUSTAND.verlauf.join(','));
    await input.fill('hallo'); await input.press('ArrowUp'); assert.equal(await wert(), 'hallo');
    await lauf('pwd');
    assert.equal(await p.evaluate(() => TERMINAL_ZUSTAND.verlauf.join(',')), vorher);
    /* exit wird nicht aufgenommen; Sperre leert den Verlauf */
    await lauf('exit');
    assert.equal(await p.evaluate(() => TERMINAL_ZUSTAND.verlauf.includes('exit')), false);
    await p.evaluate(() => document.body.classList.add('locked')); await p.waitForTimeout(200);
    assert.equal(await p.evaluate(() => TERMINAL_ZUSTAND.verlauf.length), 0);
    assert.deepEqual(err, []);
    console.log('Terminal-Verlauf: grün');
  } finally { await b.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
