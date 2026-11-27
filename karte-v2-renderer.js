/* K2b-2a: lokale Objektlayer. Eingang ausschließlich bereits zugangsgefiltertes
   Rendermodell aus K1. Kein Profilzugriff, kein Anbieterabruf, keine Dispatch-Aktion. */
(function(root){
  'use strict';
  const P='shadow-v2-', ids={punkte:P+'punkte',zonen:P+'zonen',kanten:P+'kanten',mess:P+'mess',unsicherheit:P+'unsicherheit'};
  const farben={pin:'#2e9d4f',sichtung:'#d13b2f',person:'#2f7fd1',org:'#7a4fc9',ort:'#8e5bd6',ausgang:'#2e9d4f',standort:'#0f8a8a',zugriff:'#e08a00'};
  const linienfarben=Object.freeze({zone:'#e08a00',kante:'#879fb6',unsicherheit:farben.sichtung,auswahl:'#ffe66a',mess:'#fff'});
  // K3d-2: shared local symbol vocabulary, independent of provider sprites.
  const formen=Object.freeze({person:'kreis',org:'quadrat',ort:'raute',pin:'pin',sichtung:'dreieck',ausgang:'kreuz',standort:'raute',zugriff:'quadrat',sonstige:'kreis'});
  const symbolKat=k=>Object.prototype.hasOwnProperty.call(formen,k)?k:'sonstige';
  const symbolId=k=>P+'icon-'+symbolKat(k);
  const polygon=Object.freeze({
    quadrat:[[-.82,-.82],[.82,-.82],[.82,.82],[-.82,.82]],
    raute:[[0,-1],[1,0],[0,1],[-1,0]],
    pin:[[-.8,-.85],[.8,-.85],[.8,.15],[0,1],[-.8,.15]],
    dreieck:[[0,-1],[.96,.82],[-.96,.82]],
    kreuz:[[-.33,-.95],[.33,-.95],[.33,-.33],[.95,-.33],[.95,.33],[.33,.33],[.33,.95],[-.33,.95],[-.33,.33],[-.95,.33],[-.95,-.33],[-.33,-.33]]
  });
  function innen(form,x,y){
    if(form==='kreis')return x*x+y*y<=.9*.9;
    const p=polygon[form];if(!p)return false;
    let hit=false;
    for(let i=0,j=p.length-1;i<p.length;j=i++){
      const [a,b]=p[i],[c,d]=p[j];
      if((b>y)!==(d>y)&&x<(c-a)*(y-b)/(d-b)+a)hit=!hit;
    }
    return hit;
  }
  // 20 CSS pixels, 2x raster; white contour and 4x coverage sampling.
  function symbolBild(k){
    k=symbolKat(k);const form=formen[k],farbe=farben[k]||'#758696';
    const rgb=[1,3,5].map(i=>parseInt(farbe.slice(i,i+2),16));
    const width=40,height=40,data=new Uint8Array(width*height*4);
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      let a=0,fill=0;
      for(const dy of [.25,.75])for(const dx of [.25,.75]){
        const u=(x+dx-20)/18,v=(y+dy-20)/18;
        if(innen(form,u,v)){a++;if(innen(form,u/.76,v/.76))fill++;}
      }
      const i=(y*width+x)*4;
      if(a){for(let c=0;c<3;c++)data[i+c]=Math.round((rgb[c]*fill+255*(a-fill))/a);data[i+3]=Math.round(a*255/4);}
    }
    return {width,height,data};
  }
  const legende=Object.freeze([
    ['personen','Personen',formen.person,farben.person,'person'],
    ['organisationen','Organisationen',formen.org,farben.org,'org'],
    ['orte','Orte',formen.ort,farben.ort,'ort'],
    ['pins','Pins',formen.pin,farben.pin,'pin'],
    ['zonen','Eigene Zonen','zone',linienfarben.zone],
    ['sichtungen','Sichtungen',formen.sichtung,farben.sichtung,'sichtung'],
    ['verbindungen','Verbindungen','linie',linienfarben.kante],
    ['ausgang','Ausgangsorte',formen.ausgang,farben.ausgang,'ausgang'],
    [null,'Unschärfering','ring',linienfarben.unsicherheit],
    [null,'Auswahl','ring',linienfarben.auswahl],
    [null,'Messung','linie',linienfarben.mess]
  ].map(([filter,name,form,farbe,symbol])=>Object.freeze({filter,name,form,farbe,symbol:symbol||null})));
  const fc=features=>({type:'FeatureCollection',features});
  const gueltig=ll=>Array.isArray(ll)&&ll.length===2&&ll.every(Number.isFinite)&&Math.abs(ll[0])<=85.051129&&Math.abs(ll[1])<=180;
  const xy=ll=>[ll[1],ll[0]];
  const key=x=>x&&typeof x.renderKey==='string'&&x.renderKey.length>0&&typeof x.id==='string';
  const arr=x=>Array.isArray(x)?x:[];
  function feature(x,geometry,extra){
    return {type:'Feature',properties:Object.assign({id:x.id,renderKey:x.renderKey},extra||{}),geometry};
  }
  /* Großkreisring, kontinuierliche Längengrade auch an der Datumsgrenze.
     Im Mercator nicht darstellbare Ringe auslassen, statt Koordinaten zu verfälschen. */
  function ring(ll,r){
    if(!gueltig(ll)||!Number.isFinite(r)||r<=0||r>1000000)return null;
    const rad=Math.PI/180, lat=ll[0]*rad, lon=ll[1], d=r/6371000, p=[];
    for(let i=0;i<64;i++){
      const a=i/64*2*Math.PI, phi=Math.asin(Math.sin(lat)*Math.cos(d)+Math.cos(lat)*Math.sin(d)*Math.cos(a));
      const y=phi/rad, x=lon+Math.atan2(Math.sin(a)*Math.sin(d)*Math.cos(lat),Math.cos(d)-Math.sin(lat)*Math.sin(phi))/rad;
      if(Math.abs(y)>85.051129)return null;
      p.push([x,y]);
    }
    p.push(p[0].slice()); return {type:'Polygon',coordinates:[p]};
  }
  function linie(a,b){
    const c=xy(a),d=xy(b);
    while(d[0]-c[0]>180)d[0]-=360;
    while(d[0]-c[0]<-180)d[0]+=360;
    return {type:'LineString',coordinates:[c,d]};
  }
  function daten(modell,optionen){
    const m=modell||{}, o=optionen||{}, marker=arr(m.marker), zonen=arr(m.zonen), kanten=arr(m.kanten);
    const counts=new Map();
    for(const x of marker.concat(zonen,kanten))if(key(x))counts.set(x.renderKey,(counts.get(x.renderKey)||0)+1);
    const eindeutig=x=>key(x)&&counts.get(x.renderKey)===1;
    const punkte=[], flaechen=[], verbindungen=[], unsicherheit=[], mess=[], treffer=new Map(), dossier=new Map();
    for(const x of marker){
      if(!eindeutig(x)||!gueltig(x.ll))continue;
      const kat=x.kat==='figur'?(x.typ==='Organisation'?'org':'person'):x.kat;
      const p=feature(x,{type:'Point',coordinates:xy(x.ll)},{kat:String(kat||''),farbe:farben[symbolKat(kat)]||'#758696',symbol:symbolId(kat)});
      punkte.push(p); treffer.set(x.renderKey,{id:x.id,renderKey:x.renderKey,art:'marker',ll:x.ll.slice()});
      if(x.entitaet){if(dossier.has(x.id))dossier.set(x.id,null);else dossier.set(x.id,x.ll);}
      const g=x.kat==='sichtung'&&x.unM?ring(x.ll,x.unM.m):null;
      if(g)unsicherheit.push(feature(x,g));
    }
    for(const z of zonen){
      if(!eindeutig(z))continue;
      const g=ring(z.ll,z.r);if(!g)continue;
      flaechen.push(feature(z,g));treffer.set(z.renderKey,{id:z.id,renderKey:z.renderKey,art:'zone',ll:z.ll.slice()});
    }
    for(const v of kanten){
      if(!eindeutig(v)||!dossier.get(v.von)||!dossier.get(v.nach))continue;
      verbindungen.push(feature(v,linie(dossier.get(v.von),dossier.get(v.nach))));
      treffer.set(v.renderKey,{id:v.id,renderKey:v.renderKey,art:'verbindung'});
    }
    const mp=arr(o.mess).slice(0,2).filter(gueltig);
    mp.forEach(ll=>mess.push({type:'Feature',properties:{},geometry:{type:'Point',coordinates:xy(ll)}}));
    if(mp.length===2)mess.push({type:'Feature',properties:{},geometry:linie(mp[0],mp[1])});
    return {quellen:{punkte:fc(punkte),zonen:fc(flaechen),kanten:fc(verbindungen),mess:fc(mess),unsicherheit:fc(unsicherheit)},treffer};
  }
  const layer=[
    {id:P+'zone-fill',type:'fill',source:ids.zonen,paint:{'fill-color':linienfarben.zone,'fill-opacity':0.18}},
    {id:P+'zone-line',type:'line',source:ids.zonen,paint:{'line-color':linienfarben.zone,'line-width':2,'line-dasharray':[3,2]}},
    {id:P+'unsicherheit-line',type:'line',source:ids.unsicherheit,paint:{'line-color':linienfarben.unsicherheit,'line-width':2,'line-dasharray':[2,2]}},
    {id:P+'kante',type:'line',source:ids.kanten,paint:{'line-color':linienfarben.kante,'line-width':3}},
    {id:P+'mess-line',type:'line',source:ids.mess,filter:['==',['geometry-type'],'LineString'],paint:{'line-color':linienfarben.mess,'line-width':3}},
    {id:P+'mess-point',type:'circle',source:ids.mess,filter:['==',['geometry-type'],'Point'],paint:{'circle-radius':5,'circle-color':linienfarben.mess,'circle-stroke-width':2,'circle-stroke-color':'#101820'}},
    {id:P+'auswahl-zone',type:'line',source:ids.zonen,filter:['==',['get','renderKey'],''],paint:{'line-color':linienfarben.auswahl,'line-width':4}},
    {id:P+'auswahl-kante',type:'line',source:ids.kanten,filter:['==',['get','renderKey'],''],paint:{'line-color':linienfarben.auswahl,'line-width':5}},
    {id:P+'auswahl',type:'circle',source:ids.punkte,filter:['==',['get','renderKey'],''],paint:{'circle-radius':13,'circle-color':linienfarben.auswahl,'circle-stroke-width':2,'circle-stroke-color':'#fff'}},
    {id:P+'punkt',type:'symbol',source:ids.punkte,layout:{'icon-image':['get','symbol'],'icon-allow-overlap':true,'icon-ignore-placement':true,'icon-pitch-alignment':'viewport','icon-rotation-alignment':'viewport'}}
  ];
  function adapter(map,optionen){
    const o=optionen||{};let aktiv=true, snapshot=daten(null), auswahl=null, installiert=false, markiert=undefined;
    /* MapLibre BoxZoom unterdrückt auch einen stationären Shift-Klick (mouseupWindow).
       Shift ist im K1-Klickvertrag reserviert; die übrigen Kameragesten bleiben unverändert. */
    const boxZoomWarAktiv=!!map.boxZoom?.isEnabled();
    if(boxZoomWarAktiv)map.boxZoom.disable();
    const fehler=()=>{installiert=false;if(typeof o.onError==='function')o.onError('Eigene Kartenlayer konnten nicht aufgebaut werden.');};
    function markieren(){
      if(!installiert||markiert===auswahl)return;
      for(const id of ['auswahl','auswahl-zone','auswahl-kante'])map.setFilter(P+id,['==',['get','renderKey'],auswahl||'']);
      markiert=auswahl;
    }
    function installieren(){
      if(!aktiv)return;
      installiert=false;markiert=undefined;
      /* Keine fremden Layer oder Quellen mit kollidierenden Kennungen verändern. */
      if(Object.values(ids).some(id=>map.getSource(id))||layer.some(l=>map.getLayer(l.id))||Object.keys(formen).some(k=>map.hasImage(symbolId(k)))){fehler();return;}
      try{
        for(const k of Object.keys(formen))map.addImage(symbolId(k),symbolBild(k),{pixelRatio:2});
        for(const [k,id] of Object.entries(ids))map.addSource(id,{type:'geojson',data:snapshot.quellen[k]});
        for(const l of layer)map.addLayer(JSON.parse(JSON.stringify(l)));
        installiert=true;markieren();
      }catch(e){fehler();}
    }
    function setData(modell,opts){
      if(!aktiv)return;
      const vorher=snapshot;
      snapshot=daten(modell,opts);
      // The hit registry always reflects the new authorized model immediately.
      // Only changed GeoJSON sources need a worker update; selection and tool
      // changes must not invalidate unchanged rendered symbols.
      if(!snapshot.treffer.has(auswahl))auswahl=null;
      if(installiert){
        for(const [k,id] of Object.entries(ids)){
          if(JSON.stringify(vorher.quellen[k])!==JSON.stringify(snapshot.quellen[k]))
            map.getSource(id).setData(snapshot.quellen[k]);
        }
        markieren();
      }
    }
    function setSelection(k){
      if(!aktiv)return false;
      auswahl=snapshot.treffer.has(k)?k:null;markieren();return auswahl!==null;
    }
    function hitTest(p){
      if(!aktiv||!installiert)return null;
      const groups=[P+'punkt',P+'kante',P+'zone-fill'];
      for(const id of groups){
        const hits=map.queryRenderedFeatures(p,{layers:[id]});
        for(const f of hits){const h=snapshot.treffer.get(f.properties.renderKey);if(h)return Object.assign({},h,h.ll?{ll:h.ll.slice()}:{});}
      }
      return null;
    }
    function click(e){
      if(!aktiv||!installiert||typeof o.onClick!=='function')return;
      const ev=e.originalEvent;
      o.onClick({ll:[e.lngLat.lat,e.lngLat.lng],treffer:hitTest(e.point),mehr:!!(ev&&(ev.shiftKey||ev.ctrlKey||ev.metaKey))});
    }
    function stilwechsel(stil){if(!aktiv)return;installiert=false;map.setStyle(stil,{diff:false});}
    map.on('style.load',installieren);map.on('click',click);
    if(map.isStyleLoaded())installieren();
    return {setData,setSelection,hitTest,setStyle:stilwechsel,
      camera:()=>aktiv?{center:map.getCenter().toArray(),zoom:map.getZoom(),pitch:map.getPitch(),bearing:map.getBearing()}:null,
      project:ll=>aktiv&&gueltig(ll)?map.project(xy(ll)):null,
      unproject:p=>{if(!aktiv)return null;const q=map.unproject(p).wrap();return [q.lat,q.lng];},
      resize:()=>{if(aktiv)map.resize();},
      flyTo:opts=>{if(aktiv)map.flyTo(opts);},
      ready:()=>aktiv&&installiert,
      unmount:()=>{if(!aktiv)return;aktiv=false;map.off('style.load',installieren);map.off('click',click);if(boxZoomWarAktiv)map.boxZoom.enable();if(installiert){for(const l of layer.slice().reverse())if(map.getLayer(l.id))map.removeLayer(l.id);for(const id of Object.values(ids))if(map.getSource(id))map.removeSource(id);for(const k of Object.keys(formen))if(map.hasImage(symbolId(k)))map.removeImage(symbolId(k));}snapshot=daten(null);auswahl=null;installiert=false;}
    };
  }
  const api=Object.freeze({daten,adapter,legende,symbolBild});
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.KARTE_V2_RENDERER=api;
})(typeof globalThis!=='undefined'?globalThis:this);
