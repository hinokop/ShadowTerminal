/* K2a: unabhängiger Quellenvertrag für MapLibre. Kein Profilzugriff, kein Netzwerk beim Laden. */
(function (root) {
  'use strict';
  const STILE = Object.freeze({
    voyager: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
    dunkel: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
  });
  function cartoRequest(url, key) {
    if (typeof url !== 'string' || typeof key !== 'string' || !key.trim()) return { url: url };
    let u;
    try { u = new URL(url); } catch (e) { return { url: url }; }
    const host = u.hostname;
    /* Nur die offiziell dokumentierte HTTPS-Domain und ihre Subdomains.
       Kein Schlüssel für fremde Hosts, HTTP, lokale Daten oder Blob-URLs. */
    if (u.protocol !== 'https:' || u.port || u.username || u.password ||
        !(host === 'basemaps.cartocdn.com' || host.endsWith('.basemaps.cartocdn.com'))) return { url: url };
    u.searchParams.set('key', key.trim());
    return { url: u.href };
  }
  function leererStil() {
    return { version: 8, sources: {}, layers: [{ id: 'hintergrund', type: 'background', paint: { 'background-color': '#101820' } }] };
  }
  function stil(name) {
    return Object.prototype.hasOwnProperty.call(STILE, name) ? STILE[name] : null;
  }
  const api = Object.freeze({ cartoRequest, leererStil, stil });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.KARTE_V2_QUELLEN = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
