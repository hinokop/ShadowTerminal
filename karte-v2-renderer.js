/* K2b-2a: lokale Objektlayer. Eingang ausschließlich bereits zugangsgefiltertes
   Rendermodell aus K1. Kein Profilzugriff, kein Anbieterabruf, keine Dispatch-Aktion. */
(function(root){
  'use strict';
  const P='shadow-v2-', ids={punkte:P+'punkte',zonen:P+'zonen',kanten:P+'kanten',mess:P+'mess',unsicherheit:P+'unsicherheit'};
  const farben={pin:'#2e9d4f',sichtung:'#d13b2f',person:'#2f7fd1',org:'#7a4fc9',ort:'#8e5bd6',ausgang:'#2e9d4f',standort:'#0f8a8a',zugriff:'#e08a00'};
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
      const p=feature(x,{type:'Point',coordinates:xy(x.ll)},{kat:String(kat||''),farbe:farben[kat]||'#758696'});
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
    {id:P+'zone-fill',type:'fill',source:ids.zonen,paint:{'fill-color':'#e08a00','fill-opacity':0.18}},
    {id:P+'zone-line',type:'line',source:ids.zonen,paint:{'line-color':'#e08a00','line-width':2,'line-dasharray':[3,2]}},
    {id:P+'unsicherheit-line',type:'line',source:ids.unsicherheit,paint:{'line-color':'#d13b2f','line-width':2,'line-dasharray':[2,2]}},
    {id:P+'kante',type:'line',source:ids.kanten,paint:{'line-color':'#879fb6','line-width':3}},
    {id:P+'mess-line',type:'line',source:ids.mess,filter:['==',['geometry-type'],'LineString'],paint:{'line-color':'#fff','line-width':3}},
    {id:P+'mess-point',type:'circle',source:ids.mess,filter:['==',['geometry-type'],'Point'],paint:{'circle-radius':5,'circle-color':'#fff','circle-stroke-width':2,'circle-stroke-color':'#101820'}},
    {id:P+'auswahl-zone',type:'line',source:ids.zonen,filter:['==',['get','renderKey'],''],paint:{'line-color':'#ffe66a','line-width':4}},
    {id:P+'auswahl-kante',type:'line',source:ids.kanten,filter:['==',['get','renderKey'],''],paint:{'line-color':'#ffe66a','line-width':5}},
    {id:P+'auswahl',type:'circle',source:ids.punkte,filter:['==',['get','renderKey'],''],paint:{'circle-radius':13,'circle-color':'#ffe66a','circle-stroke-width':2,'circle-stroke-color':'#fff'}},
    {id:P+'punkt',type:'circle',source:ids.punkte,paint:{'circle-radius':8,'circle-color':['get','farbe'],'circle-stroke-color':'#fff','circle-stroke-width':2}}
  ];
  function adapter(map,optionen){
    const o=optionen||{};let aktiv=true, snapshot=daten(null), auswahl=null, installiert=false;
    const fehler=()=>{installiert=false;if(typeof o.onError==='function')o.onError('Eigene Kartenlayer konnten nicht aufgebaut werden.');};
    function markieren(){
      if(!installiert)return;
      for(const id of ['auswahl','auswahl-zone','auswahl-kante'])map.setFilter(P+id,['==',['get','renderKey'],auswahl||'']);
    }
    function installieren(){
      if(!aktiv)return;
      installiert=false;
      /* Keine fremden Layer oder Quellen mit kollidierenden Kennungen verändern. */
      if(Object.values(ids).some(id=>map.getSource(id))||layer.some(l=>map.getLayer(l.id))){fehler();return;}
      try{
        for(const [k,id] of Object.entries(ids))map.addSource(id,{type:'geojson',data:snapshot.quellen[k]});
        for(const l of layer)map.addLayer(JSON.parse(JSON.stringify(l)));
        installiert=true;markieren();
      }catch(e){fehler();}
    }
    function setData(modell,opts){
      if(!aktiv)return;
      snapshot=daten(modell,opts);
      if(!snapshot.treffer.has(auswahl))auswahl=null;
      if(installiert){for(const [k,id] of Object.entries(ids))map.getSource(id).setData(snapshot.quellen[k]);markieren();}
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
      unmount:()=>{if(!aktiv)return;aktiv=false;map.off('style.load',installieren);map.off('click',click);if(installiert){for(const l of layer.slice().reverse())if(map.getLayer(l.id))map.removeLayer(l.id);for(const id of Object.values(ids))if(map.getSource(id))map.removeSource(id);}snapshot=daten(null);auswahl=null;installiert=false;}
    };
  }
  const api=Object.freeze({daten,adapter});
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.KARTE_V2_RENDERER=api;
})(typeof globalThis!=='undefined'?globalThis:this);
