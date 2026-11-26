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
  /* V2 akzeptiert nur die aktuelle Anbieterdefinition, keine eingebauten Versionspfade.
     Keine Mutation des geladenen Stils und kein Schlüssel im Style-Objekt. */
  function vektorStil(s) {
    if (!s || s.version !== 8 || !s.sources || !Array.isArray(s.layers)) return false;
    return Object.entries(s.sources).some(([id,src])=>src && src.type==='vector' &&
      s.layers.some(l=>l.source===id && l['source-layer']==='buildings'));
  }
  /* K2c-3: Protomaps buildings, Meterkonvention; keine eigene Höhenschätzung.
     Nur Polygon-Gebäude/-teile, ab z15 (darunter zusammengefasste Geometrien).
     1500 m ist eine konservative Plausibilitätsgrenze, kein Messnachweis. */
  const GEBAEUDE_ID='shadow-v2-gebaeude-3d';
  function gebaeudeStil(s,nacht,an){
    if(!vektorStil(s))throw Error('Keine Vektorquelle');
    const copy=JSON.parse(JSON.stringify(s));
    const quellen=Object.keys(copy.sources).filter(id=>copy.sources[id]?.type==='vector'&&copy.layers.some(l=>l.source===id&&l['source-layer']==='buildings'));
    if(quellen.length!==1||copy.layers.some(l=>l.id===GEBAEUDE_ID))throw Error('Gebäudequelle nicht eindeutig');
    const source=quellen[0], h=['number',['get','height'],0], base=['number',['get','min_height'],-1];
    const validBase=['any',['!',['has','min_height']],['all',['>=',base,0],['<',base,h]]];
    const layer={id:GEBAEUDE_ID,type:'fill-extrusion',source,'source-layer':'buildings',minzoom:15,
      filter:['all',['==',['geometry-type'],'Polygon'],['in',['get','kind'],['literal',['building','building_part']]],['>',h,0],['<=',h,1500],validBase],
      layout:{visibility:an?'visible':'none'},
      paint:{'fill-extrusion-color':nacht?'#637783':'#b0a69a','fill-extrusion-height':h,
        'fill-extrusion-base':['case',['has','min_height'],base,0],'fill-extrusion-opacity':0.82}};
    // Nach den Gebäudegrundrissen, vor späteren Labels und eigenen Objektlayern.
    let at=-1;
    copy.layers.forEach((l,i)=>{if(l.source===source&&l['source-layer']==='buildings'&&(l.type==='fill'||l.type==='line'))at=i;});
    if(at<0)throw Error('Keine Gebäudegrundrisse');
    copy.layers.splice(at+1,0,layer);
    return copy;
  }
  const api = Object.freeze({ cartoRequest, leererStil, stil, vektorStil, gebaeudeStil, GEBAEUDE_ID });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.KARTE_V2_QUELLEN = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
