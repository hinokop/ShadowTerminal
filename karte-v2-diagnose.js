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
  const api=Object.freeze({ORTE,statistik,quelle,stichprobe,text,beschriftung});
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.KARTE_V2_DIAGNOSE=api;
})(typeof globalThis!=='undefined'?globalThis:this);
