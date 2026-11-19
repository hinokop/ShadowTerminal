/* Onion-Adresse v3 (#66): Format nach Tor rend-spec, unabhängig in Node geprüft (base32-Länge 56, Version 3, Prüfsumme
   SHA3-256(".onion checksum" | PUBKEY | VERSION)[:2]); profanity meldet sich an genau dieser Adresse an. */
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { chromium } = require('playwright');
const { APP } = require('./_pfad');
const { chatBereit, schnelleWahl } = require('./_kestrel');

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz234567';
function base32(text) {
  let bits = 0, wert = 0; const out = [];
  for (const z of text) { const i = ALPHABET.indexOf(z); assert.ok(i >= 0, 'base32-Zeichen ' + z); wert = (wert << 5) | i; bits += 5; if (bits >= 8) { out.push((wert >>> (bits - 8)) & 255); bits -= 8; } }
  return Buffer.from(out);
}

(async () => {
  const b = await chromium.launch();
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
    await schnelleWahl(p);
    const domain = await p.evaluate(() => TERMINAL_XMPP_DOMAIN);
    const m = /^([a-z2-7]{56})\.onion$/.exec(domain);
    assert.ok(m, 'Form: 56 base32-Zeichen und .onion: ' + domain);
    const roh = base32(m[1]);
    assert.equal(roh.length, 35);
    const pub = roh.subarray(0, 32), pruef = roh.subarray(32, 34), version = roh[34];
    assert.equal(version, 3, 'Version 3');
    const soll = crypto.createHash('sha3-256').update(Buffer.concat([Buffer.from('.onion checksum'), pub, Buffer.from([3])])).digest().subarray(0, 2);
    assert.deepEqual(pruef, soll, 'Prüfsumme');
    // Ed25519-Punkt gültig: Node importiert den öffentlichen Schlüssel.
    crypto.createPublicKey({ key: { kty: 'OKP', crv: 'Ed25519', x: pub.toString('base64url') }, format: 'jwk' });
    // Gegenprobe: ein geändertes Zeichen verletzt die Prüfsumme.
    const falsch = base32((m[1][0] === 'a' ? 'b' : 'a') + m[1].slice(1));
    assert.notDeepEqual(crypto.createHash('sha3-256').update(Buffer.concat([Buffer.from('.onion checksum'), falsch.subarray(0, 32), Buffer.from([3])])).digest().subarray(0, 2), falsch.subarray(32, 34));

    /* profanity: Anmeldung und Kontaktvorschlag unter dieser Adresse */
    await chatBereit(p, { kontakt: false });
    const chat = await p.locator('#profil-terminal-chat').textContent();
    assert.ok(chat.includes('Connecting with account ghost@' + domain + ' as ghost@' + domain + '/profanity.'), 'Connecting');
    assert.ok(/ghost@\S+\/profanity\.[0-9A-Za-z]{4} logged in successfully, online \(priority 0\)\./.test(chat), 'Anmeldung');
    assert.match(await p.evaluate(() => TERMINAL_ZUSTAND.kanal.vorschlag), new RegExp('^[a-z]{14}@' + m[1] + '\\.onion$'));
    assert.deepEqual(errors, []);
    console.log('OK: Onion-Adresse v3 ' + domain);
  } finally { await b.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
