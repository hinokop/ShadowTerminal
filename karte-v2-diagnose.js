/* K2c: lokale, rein lesende Stichprobe der vom Anbieter gelieferten Vektordaten.
   Keine Schlüssel, URLs, Attributwerte oder Profilobjekte im Bericht. */
(function(root){
  'use strict';
  const ORTE=Object.freeze([
    Object.freeze({name:'Berlin-Mitte',center:Object.freeze([13.405,52.52])}),
    Object.freeze({name:'Neustadt an der Weinstraße',center:Object.freeze([8.138,49.350])}),
    Object.freeze({name:'St. Martin (Dorf)',center:Object.freeze([8.105,49.301])})
  ]);
  const LAYER=['buildings','places','roads','pois','water','landuse','boundaries'];
  const numerisch=v=>typeof v==='number'&&Number.isFinite(v)||typeof v==='string'&&v.trim()!==''&&Number.isFinite(Number(v));
  function statistik(features){
    const felder=Object.create(null), zahlen=Object.create(null);
    const namen=['name','name:de','name:en'];
    const hoehen=['height','min_height','render_height','render_min_height','building:levels','levels','building:min_level'];
    for(const f of features){
      const p=f.properties||{};
      for(const [k,v] of Object.entries(p)){
        felder[k]=(felder[k]||0)+1;
        if(hoehen.includes(k)&&numerisch(v))zahlen[k]=(zahlen[k]||0)+1;
      }
    }
    const vorhanden=Object.keys(felder).sort().map(k=>[k,felder[k]]);
    const nutzbar=Object.fromEntries(namen.map(k=>[k,features.filter(f=>typeof f.properties?.[k]==='string'&&f.properties[k].trim()!=='').length]));
    return {fragmente:features.length,felder:vorhanden,namen:nutzbar,hoehen:Object.fromEntries(hoehen.map(k=>[k,{vorhanden:felder[k]||0,numerisch:zahlen[k]||0}]))};
  }
  function quelle(stil){
    if(!stil||!stil.sources||!Array.isArray(stil.layers))return null;
    const ids=Object.keys(stil.sources).filter(id=>stil.sources[id].type==='vector'&&stil.layers.some(l=>l.source===id&&l['source-layer']==='buildings'));
    return ids.length===1?ids[0]:null;
  }
  function stichprobe(map){
    const stil=map.getStyle(), id=quelle(stil);
    if(!id)throw Error('Keine eindeutige Vektorquelle mit Gebäudeebene.');
    const out={nativeMaxzoom:stil.sources[id].maxzoom??null,layer:{}};
    for(const l of LAYER)out.layer[l]=statistik(map.querySourceFeatures(id,{sourceLayer:l}));
    return out;
  }
  function text(ort,zoom,s){
    const b=s.layer.buildings;
    const lines=[ort+' | Kartenzoom '+zoom+' | Quell-Maxzoom '+(s.nativeMaxzoom??'nicht angegeben'),
      'Gebäudefragmente: '+b.fragmente,
      'Gebäudeattribute (Anzahl je Feld): '+(b.felder.map(([k,n])=>k+'='+n).join(', ')||'keine'),
      'Höhenfelder (vorhanden / numerisch): '+Object.entries(b.hoehen).map(([k,v])=>k+'='+v.vorhanden+'/'+v.numerisch).join(', ')];
    for(const [l,v] of Object.entries(s.layer))lines.push(l+': '+v.fragmente+' Fragmente; name='+v.namen.name+', name:de='+v.namen['name:de']+', name:en='+v.namen['name:en']+'; Attribute: '+(v.felder.map(([k,n])=>k+'='+n).join(', ')||'keine'));
    return lines.join('\n');
  }
  // Ausschließlich feste Kategorien und numerische Style-Metadaten, keine IDs,
  // URLs, Textausdrücke oder tatsächlichen Beschriftungswerte in den Bericht.
  function beschriftung(stil){
    const id=quelle(stil);
    if(!id)return 'Keine eindeutige Vektorquelle.';
    const gruppen=[['Hausnummern','buildings','addr_housenumber'],['Straßenbeschriftung','roads',null],['POI-Beschriftung','pois',null],['Ortsbeschriftung','places',null]];
    return gruppen.map(([titel,layer,feld])=>{
      const ls=stil.layers.filter(l=>l.source===id&&l['source-layer']===layer&&l.type==='symbol'&&l.layout?.['text-field']&&(!feld||JSON.stringify(l.layout['text-field']).includes(feld)));
      const aktiv=ls.filter(l=>l.layout.visibility!=='none');
      const grenzen=aktiv.map(l=>[Number.isFinite(l.minzoom)?l.minzoom:0,Number.isFinite(l.maxzoom)?l.maxzoom:24]).map(([a,b])=>a+'–'+b);
      return titel+': '+aktiv.length+'/'+ls.length+' aktive Textlayer; Zoom '+(grenzen.join(', ')||'—');
    }).join('\n');
  }
  // Fest definierte öffentliche Referenzorte, niemals Benutzer-/Profilkoordinaten.
  const BILDPROBEN=Object.freeze([
    ['berlin2024','Berlin-Mitte',[13.405,52.52],19],
    ['brandenburg','Cottbus',[14.33,51.76],19],
    ['rheinlandPfalz','Koblenz',[7.596,50.359],19],
    ['nrw','Düsseldorf',[6.773,51.225],20],
    ['sentinel2016','Sydney – Übersicht',[151.21,-33.87],8],
    ['sentinel2016','Sydney – Detailgrenze',[151.21,-33.87],14]
  ].map(([id,ort,center,z])=>Object.freeze({id,ort,center:Object.freeze(center),z})));
  function bildProbe(Q,p){
    if(!BILDPROBEN.includes(p))throw Error('Keine feste Referenzprobe');
    const info=Q.bildInfo(p.id),s=Q.bildStil(p.id).sources[Q.BILD_ID];
    if(!info||p.z<info.minzoom||p.z>info.maxzoom||Q.bildBereich(p.id,p.center,p.z-Math.log2(512/info.tileSize))!=='kandidat')throw Error('Probe außerhalb der Anfragegrenzen');
    const [lon,lat]=p.center,n=2**p.z,R=20037508.342789244;
    const x=Math.floor((lon+180)/360*n),y=Math.floor((1-Math.asinh(Math.tan(lat*Math.PI/180))/Math.PI)/2*n);
    const d=2*R/n, bbox=[-R+x*d,R-(y+1)*d,-R+(x+1)*d,R-y*d];
    const url=s.tiles[0].replace('{bbox-epsg-3857}',bbox.join(',')).replace('{z}',p.z).replace('{x}',x).replace('{y}',y);
    if(!url.startsWith('https://')||/[{}]/.test(url))throw Error('Ungültige Referenz-URL');
    return {url,x,y,z:p.z,tileSize:s.tileSize};
  }
  function pixelStatistik(data){
    if(!data||!data.length||data.length%4)throw Error('Keine RGBA-Pixel');
    let alpha=0,deckend=0,abweichend=0,erste=null;
    for(let i=0;i<data.length;i+=4){
      if(data[i+3]===0){alpha++;continue;}
      if(data[i+3]===255)deckend++;
      const rgb=data[i]*65536+data[i+1]*256+data[i+2];
      if(erste===null)erste=rgb;else if(rgb!==erste)abweichend++;
    }
    const n=data.length/4;
    return {pixel:n,transparent:alpha,deckend,einfarbig:erste!==null&&abweichend===0,
      auffaellig:alpha===n||abweichend===0};
  }
  // Nur aggregierte Renderfragmente; keine Textwerte oder Nutzerobjekte.
  function renderDetails(map){
    const stil=map.getStyle();
    if(!stil?.sources||!Array.isArray(stil.layers))return null;
    const ids=Object.keys(stil.sources).filter(k=>stil.sources[k].type==='vector'&&stil.layers.some(l=>l.source===k&&['buildings','roads','places','pois'].includes(l['source-layer'])));
    if(ids.length!==1)return null;
    const id=ids[0];
    const gruppen=[['Hausnummern','buildings','addr_housenumber'],['Straßen','roads',null],['Orte','places',null],['POIs','pois',null]];
    const out={};
    for(const [name,layer,feld] of gruppen){
      const ids=stil.layers.filter(l=>l.source===id&&l['source-layer']===layer&&l.type==='symbol'&&l.layout?.visibility!=='none'&&l.layout?.['text-field']&&(!feld||l.id==='housenumber'||JSON.stringify(l.layout['text-field']).includes(feld))).map(l=>l.id);
      out[name]={layer:ids.length,fragmente:ids.length?map.queryRenderedFeatures({layers:ids}).length:0};
    }
    const g=stil.layers.filter(l=>l.source===id&&l.type==='fill-extrusion'&&l.layout?.visibility!=='none').map(l=>l.id);
    out.Extrusion={layer:g.length,fragmente:g.length?map.queryRenderedFeatures({layers:g}).length:0};
    return out;
  }
  // M2: fixed-category metadata only. Never return house numbers, names,
  // coordinates, filter expressions or provider URLs.
  // Report only whitelisted scalar style constants; expressions may contain
  // arbitrary strings, so never serialize their contents or layer IDs.
  function stilKonstante(v,art){
    if(v===undefined)return 'nicht gesetzt';
    if(Array.isArray(v)||v&&typeof v==='object')return 'Ausdruck/Objekt';
    if(art==='zahl'&&typeof v==='number'&&Number.isFinite(v))return v;
    if(art==='ausrichtung'&&['map','viewport','auto'].includes(v))return v;
    if(art==='farbe'&&typeof v==='string'&&v.length<=80&&
      (/^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(v)||
       /^(?:rgba?|hsla?)\([\d.,%+\-\s]+\)$/i.test(v)||
       /^(?:black|white|transparent|gray|grey|silver|red|green|blue|yellow|orange|purple|navy|teal|aqua|lime|maroon|olive|fuchsia)$/i.test(v)))return v;
    return 'nicht ausgewertet';
  }
  function adressStil(l){
    return {farbe:stilKonstante(l.paint?.['text-color'],'farbe'),
      halo:stilKonstante(l.paint?.['text-halo-color'],'farbe'),
      haloBreite:stilKonstante(l.paint?.['text-halo-width'],'zahl'),
      opazitaet:stilKonstante(l.paint?.['text-opacity'],'zahl'),
      groesse:stilKonstante(l.layout?.['text-size'],'zahl'),
      neigung:stilKonstante(l.layout?.['text-pitch-alignment'],'ausrichtung')};
  }
  function adressDetails(map){
    const stil=map.getStyle(),id=quelle(stil);
    if(!id)return null;
    const ls=stil.layers.filter(l=>l.source===id&&l['source-layer']==='buildings'&&l.type==='symbol'&&
      (l.id==='housenumber'||JSON.stringify(l.layout?.['text-field']||'').includes('addr_housenumber')));
    const layer=ls.map(l=>{
      const filter=JSON.stringify(l.filter||[]);
      return {min:Number.isFinite(l.minzoom)?l.minzoom:0,max:Number.isFinite(l.maxzoom)?l.maxzoom:24,
        sichtbar:l.layout?.visibility!=='none',geometrieFilter:filter.includes('geometry-type')||filter.includes('$type'),
        kindFilter:filter.includes('"kind"'),nummerFilter:filter.includes('addr_housenumber'),stil:adressStil(l)};
    });
    const features=map.querySourceFeatures(id,{sourceLayer:'buildings'});
    const extrusion=stil.layers.filter(l=>l.source===id&&l.type==='fill-extrusion').map(l=>({
      sichtbar:l.layout?.visibility!=='none',
      farbe:stilKonstante(l.paint?.['fill-extrusion-color'],'farbe'),
      opazitaet:stilKonstante(l.paint?.['fill-extrusion-opacity'],'zahl')
    }));
    const out={gesamt:features.length,geprueft:Math.min(features.length,10000),punkt:0,polygon:0,sonstige:0,kindAddress:0,layer,extrusion};
    for(let i=0;i<out.geprueft;i++){
      const f=features[i],p=f.properties||{},nr=p.addr_housenumber;
      if(nr===undefined||nr===null||String(nr).trim()==='')continue;
      const typ=f.geometry?.type;
      if(typ==='Point'||typ==='MultiPoint')out.punkt++;
      else if(typ==='Polygon'||typ==='MultiPolygon')out.polygon++;
      else out.sonstige++;
      if(p.kind==='address')out.kindAddress++;
    }
    return out;
  }
  const api=Object.freeze({ORTE,statistik,quelle,stichprobe,text,beschriftung,BILDPROBEN,bildProbe,pixelStatistik,renderDetails,adressDetails});
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.KARTE_V2_DIAGNOSE=api;
})(typeof globalThis!=='undefined'?globalThis:this);
