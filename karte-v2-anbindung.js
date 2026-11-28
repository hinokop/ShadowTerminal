/* K2b-2b: explizite lokale Vergleichsansicht, kein Standardrendererwechsel.
   Aktiv nur in index.html?geospatial-v2=1; kein persistenter Schalter.
   K2c-1: explizite Vektorstile, lokaler Schlüssel, leerer bedienbarer Rückfall. */
(function(root){
  'use strict';
  const modus=new URLSearchParams(location.search).get('geospatial-v2');
  const solo=modus==='solo',dev=modus==='1'||solo;
  let kontext=null, laden=null, sitzung=null, voll=false, rueckfall=false, rueckfallGrund='';
  const v2Aktiv=()=>dev&&!rueckfall;
  /* Nur Opt-in, vor allen MapLibre-Netzanfragen. Die Standardansicht bleibt unverändert. */
  if(dev){
    const meta=document.createElement('meta');meta.name='referrer';meta.content='no-referrer';document.head.appendChild(meta);
  }
  // Die Lagekarte hat Datei- und Browserquelle bereits aufgelöst (Browser hat Vorrang).
  const namen={voyager:'Voyager',shadow:'Shadow',luftbild:'Luftbild',hybrid:'Hybrid',leer:'Ohne Basiskarte'};
  // Factories are side-effect-free on creation. Cross-module commands are
  // resolved lazily, after both interfaces have been constructed.
  const quelle=KARTE_V2_QUELLENSTEUERUNG.erstellen({namen,aktiv,hinweis,sync,
    knoepfe:c=>ui.knoepfe(c),gebaeudeKnoepfe:c=>ui.gebaeudeKnoepfe(c)});
  const ui=KARTE_V2_OBERFLAECHE.erstellen({dev,namen,aktiv,
    getKontext:()=>kontext,getVoll:()=>voll,setVoll:v=>{voll=v;},
    wechseln:quelle.wechseln,bildManuell:quelle.bildManuell,bildPosition:quelle.bildPosition});
  const {lokalKey,stop,hybridStop,kachelReset,bildPosition,bildAktualisieren,wechseln}=quelle;
  const {knoepfe,gebaeudeKnoepfe,legendeAktualisieren,kameraAnzeige,werkzeugAnzeige,layout,vollWaehlen,ansicht}=ui;
  function aktiv(c){
    return c&&kontext===c&&c.el.isConnected&&!document.body.classList.contains('locked')&&STATE.ui.modul==='karte'&&VIEW.karte.reiter!=='protokoll';
  }
  function hinweis(c,text){if(aktiv(c))c.status.textContent=text;}
  function bibliothek(){
    if(laden)return laden;
    const script=src=>new Promise((ok,no)=>{
      const s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=no;document.head.appendChild(s);
    });
    if(!document.getElementById('k-v2-css')){
      const css=document.createElement('link');css.id='k-v2-css';css.rel='stylesheet';css.href='vendor/maplibre-gl/maplibre-gl.css';document.head.appendChild(css);
    }
    laden=Promise.resolve().then(()=>typeof maplibregl==='undefined'?script('vendor/maplibre-gl/maplibre-gl.js'):null)
      .then(()=>typeof KARTE_V2_RENDERER==='undefined'?script('karte-v2-renderer.js'):null)
      .then(()=>typeof KARTE_V2_QUELLEN==='undefined'?script('karte-v2-quellen.js'):null)
      .then(()=>typeof KARTE_V2_DIAGNOSE==='undefined'?script('karte-v2-diagnose.js'):null)
      .catch(e=>{laden=null;throw e;});
    return laden;
  }
  function auswahl(modell){
    const K=VIEW.karte, id=K.auswahl, k=karteAuswahlSchluessel();
    if(!id)return null;
    const alle=modell.marker.concat(modell.zonen,modell.kanten);
    const t=alle.filter(x=>x.id===id&&(!k||x.renderKey===k));
    return t.length===1?t[0].renderKey:null;
  }
  function sync(modell){
    const c=kontext;if(!aktiv(c)||!c.a)return;
    const m=modell||karteRenderModell();
    c.a.setData(m,{mess:VIEW.karte.messPts});
    c.a.setSelection(auswahl(m));legendeAktualisieren();werkzeugAnzeige();ui.sucheAktualisieren(m);
  }
  // VIEW.karte owns geographic center and scale; V2 keeps its orientation.
  const normLon=lon=>lon>=-180&&lon<=180?lon:((lon%360+540)%360)-180;
  function zielKamera(lat,lon,zoom){
    if(![lat,lon,zoom].every(Number.isFinite))return null;
    const g=KARTE_V2_KAMERA;
    return {center:[normLon(lon),Math.max(-g.maxLat,Math.min(g.maxLat,lat))],
      zoom:Math.max(g.minZoom,Math.min(g.maxZoom,zoom-g.zoomOffset))};
  }
  function kameraTeilen(c,zeichnen=true){
    if(!aktiv(c)||!c.a||VIEW.karte.ansicht3d)return;
    const p=c.a.camera(),K=VIEW.karte;
    if(!p||!p.center.every(Number.isFinite)||!Number.isFinite(p.zoom))return;
    const lon=normLon(p.center[0]),lat=p.center[1],zoom=p.zoom+KARTE_V2_KAMERA.zoomOffset;
    const anders=K.lon!==lon||K.lat!==lat||K.zoom!==zoom;
    K.lon=lon;K.lat=lat;K.zoom=zoom;
    // Share the last visible frame even if navigation interrupts the gesture.
    // The comparison SVG is redrawn only on moveend, never for every frame.
    if(anders)c.kameraSvgOffen=true;
    if(zeichnen&&c.kameraSvgOffen){
      c.kameraSvgOffen=false;const svg=$('k-svg');if(svg)zeichneKarte(svg);
    }
  }
  function kameraSetzen(lat,lon,zoom,animiert=false,fertig){
    const c=kontext,z=zielKamera(lat,lon,zoom),K=VIEW.karte;
    if(!v2Aktiv()||!z||K.ansicht3d||!aktiv(c))return false;
    if(K.flug){cancelAnimationFrame(K.flug);K.flug=null;}
    if(!c.map||!c.a){
      K.lon=z.center[0];K.lat=z.center[1];K.zoom=z.zoom+KARTE_V2_KAMERA.zoomOffset;K.init=true;
      if(fertig)fertig();return true;
    }
    const reduziert=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    c.map.stop();
    // Explicit overview jumps return to an unrotated flat map.
    if(z.zoom<4)Object.assign(z,{pitch:0,bearing:0});
    const p=c.a.camera(),gleich=Math.abs(p.center[0]-z.center[0])<1e-8&&Math.abs(p.center[1]-z.center[1])<1e-8&&Math.abs(p.zoom-z.zoom)<1e-8&&
      (z.pitch===undefined||p.pitch===z.pitch&&p.bearing===z.bearing);
    if(gleich){kameraTeilen(c);if(fertig)fertig();return true;}
    if(animiert&&!reduziert){
      if(fertig)c.map.once('moveend',()=>{if(aktiv(c))fertig();});
      c.map.easeTo({...z,duration:550});
    }else{
      c.map.jumpTo(z);kameraTeilen(c);if(fertig)fertig();
    }
    return true;
  }
  function ansichtUmschalten(){
    const c=kontext;
    if(!aktiv(c)||!c.a||!c.map||VIEW.karte.ansicht3d)return false;
    ui.neigung(c,c.map.getPitch()>=1?0:60);
    return true;
  }
  function mitte(){
    if(!v2Aktiv()||document.body.classList.contains('locked')||STATE.ui.modul!=='karte'||VIEW.karte.reiter==='protokoll')return null;
    const c=kontext;
    if(aktiv(c)&&c.map&&!VIEW.karte.ansicht3d){const p=bildPosition(c);return [p[1],p[0]];}
    const K=VIEW.karte;
    return [K.lat,K.lon].every(Number.isFinite)?[K.lat,K.lon]:null;
  }
  function klick(c,e){
    if(!aktiv(c)||!e||!Array.isArray(e.ll)||!e.ll.every(Number.isFinite))return;
    const m=karteRenderModell(), t=e.treffer;
    /* Autoritative Prüfung nochmals am Anwendungsmodell. Nie einen alten oder
       mehrdeutigen Treffer als einen anderen Treffer (oder Leerfläche) behandeln. */
    if(t&&m.marker.concat(m.zonen,m.kanten).filter(x=>x.id===t.id&&x.renderKey===t.renderKey).length!==1)return;
    const lon=e.ll[1], ll=[e.ll[0],lon>=-180&&lon<=180?lon:((lon%360+540)%360)-180];
    if(Math.abs(ll[0])>90)return;
    const K=VIEW.karte, werkzeug=K.pick||K.pinSetzen||K.zoneSetzen||K.zugriffSetzen||K.messen;
    karteKlickVerarbeiten({ll,markerId:t&&t.art==='marker'?t.id:null,markerKey:t&&t.art==='marker'?t.renderKey:null,
      zoneId:t&&t.art==='zone'?t.id:null,kanteId:t&&t.art==='verbindung'?t.id:null,mehr:!!e.mehr},karteRendererDatenAktualisieren);
    if(!werkzeug&&aktiv(c)){
      if(t&&K.auswahl===t.id)karteBezugSetzen(t.id);
      else if(!t&&!K.auswahl)karteBezugSetzen(null);
    }
    sync();
  }
  function unmount(erhalten=false,layoutErhalten=false){
    const c=kontext;kontext=null;
    if(!erhalten||!layoutErhalten||document.body.classList.contains('locked'))voll=false;
    if(c?.vollTaste)document.removeEventListener('keydown',c.vollTaste,true);
    if(!erhalten||document.body.classList.contains('locked'))sitzung=null;
    else if(c?.a&&c.map){
      // Auch bei fehlerhafter/entfernter Map muss der Abbau weiterlaufen.
      try{
        const kamera=c.a.camera();
        if(kamera)sitzung={kamera,modus:c.modus,gebaeude:c.gebaeude,
          stilCache:c.key&&c.key===lokalKey()?c.stilCache:null,bildWahl:c.bildWahl,bildAusgefallen:c.bildAusgefallen.slice(),
          hybrid:c.hyb?{grund:c.hyb.grund,bildManuellFehler:c.hyb.bildManuellFehler,zeit:c.hyb.zeit,
            stil:c.hyb.geladen&&c.hyb.key===lokalKey()&&KARTE_V2_QUELLEN.styleCachebar(c.hyb.stil,c.hyb.key)?c.hyb.stil:null}:null};
      }catch(e){sitzung=null;}
    }
    if(!c)return;
    ++c.generation;stop(c);hybridStop(c);c.key='';c.stilCache=null;c.stilKandidat=null;
    /* Ein Fehler beim Aufräumen darf die bestehende Anwendung nicht blockieren. */
    try{if(c.a)c.a.unmount();}catch(e){}
    try{if(c.map)c.map.remove();}catch(e){}
  }
  // Renderer callbacks can run inside style.load or even adapter construction.
  // Defer teardown until the MapLibre stack has returned; never tear down a
  // newer context because an old style or map failed.
  function objektFehler(c){
    if(!aktiv(c)||c.objektFehler)return;
    c.objektFehler=true;
    hinweis(c,'Eigene Kartenlayer konnten nicht aufgebaut werden.');
    queueMicrotask(()=>{
      if(aktiv(c))zurueckfallen(c,'MapLibre-Objektlayer konnten nicht aufgebaut werden.');
    });
  }
  function zurueckfallen(c,grund='MapLibre konnte nicht gestartet werden.'){
    if(!aktiv(c)||rueckfall)return;
    // Keep the existing authorized application model, camera and placement
    // state. Do not activate a different online provider as a side effect.
    rueckfall=true;rueckfallGrund=grund;
    VIEW.karte.ebenen.kacheln=false;
    VIEW.karte.ansicht3d=false;
    unmount();
    // The full render now assigns the shared panels and export control back
    // to SVG. The session flag prevents automatic retry loops.
    renderModule();
  }
  function mount(){
    if(!v2Aktiv())return;
    const el=$('k-v2-map'),status=$('k-v2-status');
    if(!el||!status||document.body.classList.contains('locked'))return;
    if(kontext)unmount(true,true);
    const alt=sitzung;
    const c={el,status,map:null,a:null,modus:'leer',phase:'lokal',gebaeude:alt?.gebaeude||false,bildWahl:alt?.bildWahl||'auto',bildAusgefallen:alt?.bildAusgefallen?.slice()||[],bildQuelle:null,bildSourceId:null,hyb:null,key:'',stilCache:null,stilKandidat:null,generation:0,abort:null,timer:null,fehlerTimer:null};
    kachelReset(c);kontext=c;layout(c);
    c.vollTaste=e=>{
      if(!aktiv(c)||!c.a||e.key!=='Escape'||e.defaultPrevented||$('dlg')?.open||$('regie')?.open)return;
      if(['INPUT','TEXTAREA','SELECT'].includes(e.target?.tagName)&&e.target.type!=='checkbox'&&e.target.type!=='radio')return;
      if(!voll&&!$('k-v2-panel')?.contains(e.target))return;
      const K=VIEW.karte;
      if(K.pick||K.pinSetzen||K.zoneSetzen||K.zugriffSetzen||K.messen){
        e.preventDefault();e.stopPropagation();
        K.pick=null;K.pinSetzen=false;K.zoneSetzen=false;K.zugriffSetzen=false;K.messen=false;K.messPts=[];
        if(!karteWerkzeugAktualisieren())renderModule();
        return;
      }
      if(voll){e.preventDefault();e.stopPropagation();vollWaehlen(false);}
    };
    document.addEventListener('keydown',c.vollTaste,true);
    bibliothek().then(()=>{
      if(!aktiv(c))return;
      const K=VIEW.karte, sel=$('k-v2-bildwahl');
      if(sel)for(const q of KARTE_V2_QUELLEN.bildListe())sel.appendChild(h('option',{value:q.id},q.name));
      c.map=new maplibregl.Map({container:el,style:KARTE_V2_QUELLEN.leererStil(),
        ...zielKamera(K.lat,K.lon,K.zoom),pitch:alt?.kamera?.pitch||0,bearing:alt?.kamera?.bearing||0,
        minZoom:KARTE_V2_KAMERA.minZoom,maxZoom:KARTE_V2_KAMERA.maxZoom,attributionControl:true,renderWorldCopies:false,
        transformRequest:url=>KARTE_V2_QUELLEN.cartoRequest(url,c.key)});
      c.map.addControl(new maplibregl.NavigationControl({visualizePitch:true}),'top-right');
      c.map.addControl(new maplibregl.ScaleControl({maxWidth:100,unit:'metric'}),'bottom-left');
      let letzteMitte=mitte();
      c.map.on('resize',()=>{if(aktiv(c))kartePopupPos();});
      c.map.on('dragstart',()=>{if(aktiv(c)){VIEW.karte.bezug=null;VIEW.karte.bezugRenderKey=null;}});
      c.map.on('move',()=>kameraTeilen(c,false));
      c.map.on('moveend',()=>{
        if(!aktiv(c))return;
        gebaeudeKnoepfe(c);bildAktualisieren(c);kameraAnzeige(c);
        kameraTeilen(c);
        const jetzt=mitte();
        if(jetzt&&(!letzteMitte||jetzt.some((v,i)=>Math.abs(v-letzteMitte[i])>1e-9))){
          letzteMitte=jetzt;karteStatusAkt();
        }
      });
      c.a=KARTE_V2_RENDERER.adapter(c.map,{onClick:e=>klick(c,e),onError:()=>objektFehler(c)});
      quelle.ereignisse(c);
      knoepfe(c);gebaeudeKnoepfe(c);
      sync();kameraTeilen(c);karteAuswahlAnzeige();karteStatusAkt();kameraAnzeige(c);
      $('k-v2-voll').disabled=false;layout(c);
      if(alt&&alt.modus!=='leer')wechseln(c,alt.modus,alt.modus==='hybrid'?alt.hybrid:alt.stilCache,true);
      else if(!alt)wechseln(c,'shadow');
    }).catch(()=>{
      zurueckfallen(c);
    });
  }
  /* Nur für die Entwicklungsansicht; Rückgabe der Adapterreferenz zur Prüfung
     tatsächlicher Treffer und des Lebenszyklus, kein zusätzlicher Datenbestand. */
  root.KARTE_V2_DEV=Object.freeze({ansicht:()=>v2Aktiv()?ansicht():null,mount,unmount,sync,mitte,kameraSetzen,ansichtUmschalten,
    get aktiviert(){return v2Aktiv();},get solo(){return solo&&v2Aktiv();},get rueckfall(){return rueckfall;},get rueckfallGrund(){return rueckfallGrund;},adapter:()=>aktiv(kontext)?kontext.a:null});
})(window);
