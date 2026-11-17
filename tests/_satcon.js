const SAT = 'satcon-tx --target IRIDIUM-142 --device limesdr --iface sat0 --tle /var/cache/tle/leo.txt';
async function vorbereiten(p) {
  const eingabe = p.locator('#profil-terminal-eingabe');
  await eingabe.fill(SAT);
  await eingabe.press('Enter');
  await p.waitForFunction(() => !!TERMINAL_ZUSTAND.satLink);
}
module.exports = { SAT, vorbereiten };
