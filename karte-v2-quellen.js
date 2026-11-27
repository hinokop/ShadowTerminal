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
  const GEBAEUDE_ID='shadow-v2-gebaeude-3d', HAUSNUMMER_ID='shadow-v2-hausnummer';
  // Nur Provider-Style ohne eingebettete Zugangsdaten im Sitzungsspeicher halten.
  // Konservativ: bei verdächtigen URL-Parametern oder aktuellem Key nicht cachen.
  function styleCachebar(s,key){
    if(!vektorStil(s)||typeof key!=='string'||!key.trim())return false;
    const k=key.trim(), raw=JSON.stringify(s);
    if(raw.includes(k)||raw.includes(encodeURIComponent(k))||raw.includes(new URLSearchParams({key:k}).toString().slice(4)))return false;
    function sicher(v){
      if(typeof v==='string'){
        if(/(?:[?&]|%3f|%26)(?:key|api[_-]?key|access[_-]?token|token|signature|sig|auth|credential|password)(?:=|%3d)/i.test(v))return false;
        if(/^https?:\/\//i.test(v)){try{const u=new URL(v);if(u.username||u.password)return false;}catch(e){return false;}}
        return true;
      }
      if(Array.isArray(v))return v.every(sicher);
      if(v&&typeof v==='object')return Object.entries(v).every(([n,x])=>! /^(?:api[_-]?key|access[_-]?token|token|authorization|credential|password|secret)$/i.test(n)&&sicher(x));
      return true;
    }
    return sicher(s);
  }
  function hausnummern(copy,source){
    // Protomaps: addr_housenumber ist ein Attribut der Adresspunkte in buildings.
    // Vorhandene Provider-Layer respektieren; nur bei tatsächlichem Fehlen ergänzen.
    const nummern=copy.layers.filter(l=>l.type==='symbol'&&l.source===source&&l['source-layer']==='buildings'&&
      (JSON.stringify(l.layout?.['text-field']||'').includes('addr_housenumber')||l.id==='housenumber'));
    if(nummern.length){
      for(const l of nummern){
        l.minzoom=Math.min(l.minzoom??0,17);
        if(l.layout?.visibility==='none')l.layout.visibility='visible';
        if(copy.layers.indexOf(l)<copy.layers.findIndex(x=>x.id===GEBAEUDE_ID)){
          copy.layers.splice(copy.layers.indexOf(l),1);copy.layers.push(l);
        }
      }
      return;
    }
    if(typeof copy.glyphs!=='string'||!copy.glyphs||copy.layers.some(l=>l.id===HAUSNUMMER_ID))return;
    // Nur bereits im konkreten Dark-Matter-Stil verwendete Fontstacks.
    const schrift=copy.layers.filter(l=>l.type==='symbol').map(l=>l.layout?.['text-font'])
      .find(v=>Array.isArray(v)&&v.length>0&&v.every(x=>typeof x==='string'&&x.trim())&&
        !['get','var','literal','case','match','coalesce','step','concat','to-string','format','let'].includes(v[0]));
    if(!schrift)return;
    copy.layers.push({id:HAUSNUMMER_ID,type:'symbol',source,'source-layer':'buildings',minzoom:17,
      filter:['all',['==',['geometry-type'],'Point'],['==',['get','kind'],'address'],['has','addr_housenumber'],['!=',['to-string',['get','addr_housenumber']],'']],
      layout:{'text-field':['to-string',['get','addr_housenumber']],'text-font':schrift.slice(),'text-size':11,
        'text-pitch-alignment':'viewport','text-rotation-alignment':'viewport','text-padding':1,'text-allow-overlap':false},
      paint:{'text-color':'#d6dbe0','text-halo-color':'#24292e','text-halo-width':1.2}});
  }
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
    if(nacht)hausnummern(copy,source);
    return copy;
  }
  /* K2d-1: isolierter Rasterquellenvertrag. Keine Abfrage beim Laden,
     kein Key, keine Profilinformationen und keine eigene persistente Kachelablage.
     bounds ist nur ein Anfragefilter, kein Nachweis echter Bildabdeckung. */
  const BILDQUELLEN=Object.freeze({
    berlin2024:Object.freeze({
      name:'Berlin TrueDOP 2024',anbieter:'Senatsverwaltung Berlin',art:'Orthophoto',
      aufnahme:'2024 (Datensatzjahr)',gsd:0.20,lizenz:'dl-de-zero-2.0',
      attribution:'Geoportal Berlin · TrueDOP 2024 · dl-de-zero-2.0',
      bounds:Object.freeze([13.07,52.33,13.78,52.69]),minzoom:10,maxzoom:19,tileSize:256,
      url:'https://gdi.berlin.de/services/wms/truedop_2024?service=WMS&version=1.3.0&request=GetMap&layers=truedop_2024&styles=&crs=EPSG:3857&bbox={bbox-epsg-3857}&width=256&height=256&format=image/png&transparent=true'
    }),
    brandenburg:Object.freeze({
      name:'Brandenburg / Berlin DOP20',anbieter:'LGB',art:'Orthophoto',
      aufnahme:'Aufnahmezeit je Kachel unbekannt',gsd:0.20,lizenz:'dl-de/by-2-0',
      attribution:'© GeoBasis-DE/LGB, dl-de/by-2-0; © Geoportal Berlin, dl-de/by-2-0',
      bounds:Object.freeze([11.2,51.35,14.8,53.6]),minzoom:10,maxzoom:19,tileSize:256,
      url:'https://isk.geobasis-bb.de/mapproxy/dop20c/service/wms?service=WMS&version=1.3.0&request=GetMap&layers=bebb_dop20c&styles=&crs=EPSG:3857&bbox={bbox-epsg-3857}&width=256&height=256&format=image/jpeg'
    }),
    rheinlandPfalz:Object.freeze({
      name:'Rheinland-Pfalz DOP20',anbieter:'LVermGeo Rheinland-Pfalz',art:'Orthophoto',
      aufnahme:'Aufnahmezeit je Kachel unbekannt',gsd:0.20,lizenz:'dl-de/by-2-0',
      attribution:'©GeoBasis-DE / LVermGeoRP ('+new Date().getFullYear()+'), dl-de/by-2-0, <a href="https://www.lvermgeo.rlp.de">lvermgeo.rlp.de</a> [Daten bearbeitet]',
      bounds:Object.freeze([6.037773,48.897996,8.617703,51.000893]),minzoom:10,maxzoom:19,tileSize:256,
      url:'https://geo4.service24.rlp.de/wms/rp_dop20.fcgi?service=WMS&version=1.1.1&request=GetMap&layers=rp_dop20&styles=&srs=EPSG:3857&bbox={bbox-epsg-3857}&width=256&height=256&format=image/png&transparent=true'
    }),
    nrw:Object.freeze({
      name:'Nordrhein-Westfalen DOP10',anbieter:'Geobasis NRW',art:'Orthophoto',
      aufnahme:'Aktueller qualitätsgesicherter Bestand; Aufnahmezeit je Kachel unbekannt',gsd:0.10,lizenz:'dl-de-zero-2.0',
      attribution:'Geobasis NRW · DOP10 · <a href="https://www.govdata.de/dl-de/zero-2-0">dl-de-zero-2.0</a>',
      bounds:Object.freeze([5.86,50.31,9.47,52.54]),minzoom:10,maxzoom:20,tileSize:256,
      url:'https://www.wms.nrw.de/geobasis/wms_nw_dop?service=WMS&version=1.3.0&request=GetMap&layers=nw_dop_rgb&styles=&crs=EPSG:3857&bbox={bbox-epsg-3857}&width=256&height=256&format=image/png&transparent=true'
    }),
    sentinel2016:Object.freeze({
      name:'Sentinel-2 Übersicht (EOX)',anbieter:'EOX IT Services GmbH',art:'Satellitenübersicht',
      aufnahme:'2016/2017 (historisches Mosaik)',gsd:10,lizenz:'CC BY 4.0',
      attribution:'<a href="https://cloudless.eox.at">EOxCloudless</a> by <a href="https://eox.at">EOX IT Services GmbH</a> (Contains modified Copernicus Sentinel data 2016 &amp; 2017) · <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>',
      bounds:Object.freeze([-180,-85.05112878,180,85.05112878]),minzoom:0,maxzoom:14,tileSize:256,
      url:'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/{z}/{y}/{x}.jpg'
    })
  });
  const BILD_ID='shadow-v2-bild', BILD_LAYER='shadow-v2-bild-raster';
  function bildInfo(id){
    if(!Object.hasOwn(BILDQUELLEN,id))return null;
    const {url,...info}=BILDQUELLEN[id];return {...info,bounds:info.bounds.slice()};
  }
  function bildBereich(id,center,zoom){
    const q=bildInfo(id);
    if(!q||!Array.isArray(center)||center.length!==2||!center.every(Number.isFinite)||!Number.isFinite(zoom))return 'unbekannt';
    const [lon,lat]=center,[w,s,e,n]=q.bounds;
    if(lon<w||lon>e||lat<s||lat>n)return 'ausserhalb';
    if(zoom<q.minzoom-Math.log2(512/q.tileSize))return 'uebersicht';
    return 'kandidat'; // tatsächliche Abdeckung/Schärfe erst visuell nachweisbar
  }
  function bildListe(){return Object.keys(BILDQUELLEN).map(id=>({id,...bildInfo(id)}));}
  // Reihenfolge: feinere nominelle GSD, bei Gleichstand die spezifischere
  // regionale Referenz (Berlin vor BB-BE). Nur freigegebene feste Liste.
  function bildKandidaten(center,zoom,ausgeschlossen=[]){
    return bildListe().filter(q=>!ausgeschlossen.includes(q.id)&&bildBereich(q.id,center,zoom)==='kandidat')
      .sort((a,b)=>a.gsd-b.gsd).map(q=>q.id);
  }
  function bildStil(id,sourceId=BILD_ID){
    if(!Object.hasOwn(BILDQUELLEN,id))throw Error('Unbekannte Bildquelle');
    const q=BILDQUELLEN[id],s=leererStil();
    s.sources[sourceId]={type:'raster',tiles:[q.url],tileSize:q.tileSize,bounds:q.bounds.slice(),
      minzoom:q.minzoom,maxzoom:q.maxzoom,attribution:q.attribution};
    s.layers.push({id:BILD_LAYER,type:'raster',source:sourceId,paint:{'raster-fade-duration':0}});
    return s;
  }
  /* K2e-1: reiner Hybridstil. Raster bleibt sichtbar; ausschließlich
     Straßenlinien und Textbeschriftungen aus dem geladenen Vektorstil.
     Keine Flächenfüllungen, Gebäudeextrusion, Icons oder erfundenen Daten. */
  function hybridStil(id,vektor,sourceId=BILD_ID,vektorId=null){
    const raster=id===null?leererStil():bildStil(id,sourceId);
    if(!vektorStil(vektor))throw Error('Keine geeignete Vektorquelle');
    const copy=JSON.parse(JSON.stringify(vektor));
    const quellen=Object.keys(copy.sources).filter(k=>copy.sources[k]?.type==='vector'&&copy.layers.some(l=>l.source===k&&l['source-layer']==='buildings'));
    if(quellen.length!==1)throw Error('Vektorquelle nicht eindeutig');
    const source=quellen[0];
    if(Object.hasOwn(raster.sources,source)||copy.layers.some(l=>l.id===BILD_LAYER||l.id==='hintergrund'))throw Error('Hybrid-ID-Konflikt');
    hausnummern(copy,source);
    const textLayer=l=>l.type==='symbol'&&l.layout?.['text-field']&&(
      ['roads','places'].includes(l['source-layer'])||
      (l['source-layer']==='buildings'&&(l.id===HAUSNUMMER_ID||l.id==='housenumber'||JSON.stringify(l.layout['text-field']).includes('addr_housenumber'))));
    const linien=[],texte=[];
    for(const l of copy.layers){
      if(l.source!==source||l.layout?.visibility==='none')continue;
      if(l.type==='line'&&l['source-layer']==='roads'){
        // Anbieterfilter, Zoomgrenzen und Linienbreiten erhalten.
        l.paint={...l.paint,'line-color':'#f1e7cf','line-opacity':0.55};
        delete l.paint['line-pattern'];delete l.paint['line-gradient'];
        linien.push(l);
      }else if(textLayer(l)){
        // Nur Text: keine Sprite-Abhängigkeit, keine opaken Flächen.
        for(const k of Object.keys(l.layout))if(k.startsWith('icon-'))delete l.layout[k];
        for(const k of Object.keys(l.paint||{}))if(k.startsWith('icon-'))delete l.paint[k];
        l.paint={...l.paint,'text-color':'#ffffff','text-halo-color':'#18232b','text-halo-width':1.4};
        texte.push(l);
      }
    }
    if(!linien.length&&!texte.length)throw Error('Keine geeigneten Hybridlayer');
    if(texte.length&&typeof copy.glyphs!=='string')throw Error('Keine Glyphenquelle');
    const ziel=vektorId||source;
    if(Object.hasOwn(raster.sources,ziel))throw Error('Hybrid-Quellkonflikt');
    raster.sources[ziel]=copy.sources[source];
    for(const l of [...linien,...texte])l.source=ziel;
    if(texte.length)raster.glyphs=copy.glyphs;
    raster.layers.push(...linien,...texte);
    return raster;
  }
  const api = Object.freeze({ cartoRequest, leererStil, stil, vektorStil, gebaeudeStil, styleCachebar, GEBAEUDE_ID, HAUSNUMMER_ID, bildInfo, bildBereich, bildListe, bildKandidaten, bildStil, hybridStil, BILD_ID, BILD_LAYER });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.KARTE_V2_QUELLEN = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
