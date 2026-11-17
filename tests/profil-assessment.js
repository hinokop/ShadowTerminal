const assert = require('node:assert/strict');
const PF = require('./_pfad.js');
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  try {
    const p = await b.newPage({ viewport: { width: 1366, height: 768 } });
    const fehler = [], netz = [];
    let zielAntwort = true;
    p.on('pageerror', e => fehler.push(e.message));
    await p.route(/^https?:/, route => {
      netz.push(route.request().url());
      if (zielAntwort && route.request().url().startsWith('https://www.wikidata.org/w/api.php?')) {
        return route.fulfill({json:{query:{general:{sitename:'Wikidata'}}}, headers:{'access-control-allow-origin':'*'}});
      }
      return route.abort();
    });
    await p.clock.install({time:new Date('2026-01-31T12:00:00Z')});
    async function login() {
      await p.locator('#gate-pw').fill('pw-test-123');
      if (await p.locator('#gate-pw2').isVisible()) await p.locator('#gate-pw2').fill('pw-test-123');
      await p.click('#gate-go');
      await p.waitForFunction(() => !document.body.classList.contains('locked'));
    }
    await p.goto(PF.APP); await login();
    const js = (d) => p.evaluate(d => assessmentStand(Date.parse(d)), d);
    const erste = await js('2026-01-31T12:00:00Z');
    assert.equal(erste.aktuell.note[0], 'A');
    assert.equal(erste.aktuell.score, 80);
    assert.deepEqual(erste.aktuell.radar, [55, 90, 80, 70, 97]);
    assert.deepEqual(erste.aktuell.psycho, [90, 90, 90, 100, 70, 50]);
    assert.match(await p.locator('.profil-kennung-spalte').textContent(), /Phase 1 \/ 3.*30\.04\.2026/);
    assert.equal(await p.locator('#profil-verlauf svg').count(), 0);
    assert.equal(erste.liste.length, 1);
    assert.equal(new Date(erste.naechster).toISOString(), '2026-04-30T00:00:00.000Z');
    assert.equal(await p.locator('meter').count(), 6);
    assert.equal(await p.getByText('Bisherige Notizen').count(), 0);
    await p.evaluate(() => {
      dispatch({type:'TEXT_GEAENDERT', feld:'notizen', wert:'Alter Text'});
      renderModule();
    });
    assert.equal(await p.locator('.profil-alt-notizen').getAttribute('open'), null);
    await p.getByText('Bisherige Notizen', {exact:true}).click();
    assert.equal(await p.locator('#ta-notizen').inputValue(), 'Alter Text');
    await p.getByText('Psychologische Werte bearbeiten', {exact:true}).click();
    await p.locator('input[name="druck"]').fill('99');
    await p.click('#profil-psycho-speichern');
    assert.equal(await p.locator('meter[aria-label="Entscheidungsfähigkeit unter Druck"]').getAttribute('value'), '99');
    const eigene = await js('2026-01-31T12:00:00Z');
    const zweite = await js('2026-04-30T00:00:00Z'), dritte = await js('2026-07-31T00:00:00Z'), vierte = await js('2026-10-31T00:00:00Z');
    assert.deepEqual([zweite.aktuell.note[0], dritte.aktuell.note[0]].sort(), ['B','C']);
    assert.equal(vierte.aktuell.quelle, 'eigen');
    assert.deepEqual(vierte.aktuell.psycho, eigene.aktuell.psycho);
    assert.notDeepEqual(zweite.aktuell.radar, dritte.aktuell.radar);
    assert.equal(vierte.liste.length, 3);
    await p.clock.setSystemTime(new Date('2026-04-30T00:00:00Z'));
    await p.evaluate(() => tickModule(Date.now()));
    assert.equal(await p.getByText('Psychologische Werte bearbeiten', {exact:true}).count(), 0);
    assert.match(await p.locator('.profil-kennung-spalte').textContent(), /Phase 2 \/ 3.*31\.07\.2026/);
    assert.equal(await p.locator('#profil-verlauf svg polyline').count(), 1);
    assert.equal(await p.locator('#profil-verlauf svg circle').count(), 2);
    assert.equal(await p.locator('meter[aria-label="Entscheidungsfähigkeit unter Druck"]').getAttribute('value'), String(zweite.aktuell.psycho[2]));
    await p.reload(); await login();
    assert.deepEqual((await js('2026-04-30T00:00:00Z')).aktuell, zweite.aktuell);
    await p.clock.setSystemTime(new Date('2026-10-31T00:00:00Z'));
    await p.evaluate(() => tickModule(Date.now()));
    assert.equal(await p.locator('meter[aria-label="Entscheidungsfähigkeit unter Druck"]').getAttribute('value'), '99');
    assert.equal(await p.locator('#btn-karte-bereinigen').isVisible(), true);
    await p.locator('#profil-terminal-oeffnen').click();
    const ausgabe = p.locator('#profil-terminal-ausgabe');
    const cmd = async zeile => { await p.locator('#profil-terminal-eingabe').fill(zeile); await p.locator('#profil-terminal-eingabe').press('Enter'); };
    const netz0 = netz.length;
    await cmd('ls'); await cmd('pwd'); await cmd('whoami'); await cmd('ping https://example.org'); await cmd('echo test');
    assert.match(await ausgabe.textContent(), /pgcl-eu3\.arch07\//);
    assert.match(await ausgabe.textContent(), /\nroot\n/);
    assert.match(await ausgabe.textContent(), /verfügbares Ziel ist relay/);
    assert.match(await ausgabe.textContent(), /command not found/);
    assert.equal(netz.length, netz0);
    await cmd('ping relay');
    await p.waitForFunction(() => /relay · HTTPS · \d+ ms/.test(document.getElementById('profil-terminal-ausgabe').textContent));
    assert.equal(netz.length, netz0 + 1);
    zielAntwort = false;
    await cmd('ping relay');
    await p.waitForFunction(() => /relay · HTTPS · nicht erreichbar/.test(document.getElementById('profil-terminal-ausgabe').textContent));
    await cmd('clear');
    assert.equal(await ausgabe.textContent(), '');
    await p.getByText('Psychologische Werte bearbeiten', {exact:true}).click();
    await p.locator('input[name="druck"]').fill('45');
    await p.click('#profil-psycho-speichern');
    assert.equal((await js('2026-10-31T00:00:00Z')).aktuell.psycho[2], 45);
    assert.equal(await p.locator('meter[aria-label="Entscheidungsfähigkeit unter Druck"]').getAttribute('value'), '45');
    assert.deepEqual(fehler, []);
    console.log('OK: Rotation mit Monatsgrenzen und Reload, Profilwerte und Alt-Notizen, Terminal mit HTTPS-Antwort und Offlinefehler');
  } finally { await b.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
