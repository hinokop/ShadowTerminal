const SAT = 'satcon live noaa_apt --source rtlsdr --frequency 137.1e6 --samplerate 2.4e6';
async function vorbereiten(p) {
  const eingabe = p.locator('#profil-terminal-eingabe');
  await eingabe.fill(SAT);
  await eingabe.press('Enter');
  await p.waitForFunction(() => !!TERMINAL_ZUSTAND.satBereit);
}
module.exports = { SAT, vorbereiten };
