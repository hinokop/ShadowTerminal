/* K2b-2b: explizite lokale Vergleichsansicht, kein Standardrendererwechsel.
   Aktiv nur in index.html?geospatial-v2=1; kein persistenter Schalter.
   K2c-1: explizite Vektorstile, lokaler Schlüssel, leerer bedienbarer Rückfall. */
(function(root){
  'use strict';
  const dev=new URLSearchParams(location.search).get('geospatial-v2')==='1';
  let kontext=null, laden=null, sitzung=null;
  /* Nur Opt-in, vor allen MapLibre-Netzanfragen. Die Standardansicht bleibt unverändert. */
  if(dev){
    const meta=document.createElement('meta');meta.name='referrer';meta.content='no-referrer';document.head.appendChild(meta);
  }
  // Die Lagekarte hat Datei- und Browserquelle bereits aufgelöst (Browser hat Vorrang).
  const lokalKey=()=>typeof VIEW.karte.cartoKey==='string'?VIEW.karte.cartoKey.trim():'';
  const namen={leer:'Ohne Basiskarte',voyager:'Voyager',dunkel:'Dark Matter'};
  /* Nur Sitzungs-RAM: Kamera, explizite Stilwahl, Gebäudewunsch; kein Schlüssel,
     keine Objekte, keine persistente Speicherung. Gemeinsame Kamera folgt in K4. */
  function knoepfe(c){
    if(!aktiv(c))return;
    for(const n of Object.keys(namen)){
      const el=$('k-v2-'+n);if(el){el.disabled=!c.a;el.setAttribute('aria-pressed',String(c.modus===n));}
    }
  }
  function gebaeudeKnoepfe(c){
    if(!aktiv(c))return;
    const g=$('k-v2-gebaeude'), f=$('k-v2-flach'), n=$('k-v2-geneigt');
    if(g){g.disabled=!(c.phase==='online'&&c.map?.getLayer(KARTE_V2_QUELLEN.GEBAEUDE_ID));g.setAttribute('aria-pressed',String(c.gebaeude));}
    if(f){f.disabled=!c.map;f.setAttribute('aria-pressed',String(!!c.map&&c.map.getPitch()<1));}
    if(n){n.disabled=!c.map;n.setAttribute('aria-pressed',String(!!c.map&&c.map.getPitch()>=1));}
  }
  function neigung(c,grad){
    if(!aktiv(c)||!c.map)return;
    c.map.easeTo(grad===0?{pitch:0,bearing:0}:{pitch:60},{});
  }
  function gebaeudeUmschalten(c){
    if(!aktiv(c)||c.phase!=='online'||!c.map.getLayer(KARTE_V2_QUELLEN.GEBAEUDE_ID))return;
    c.gebaeude=!c.gebaeude;
    c.map.setLayoutProperty(KARTE_V2_QUELLEN.GEBAEUDE_ID,'visibility',c.gebaeude?'visible':'none');
    gebaeudeKnoepfe(c);
  }
  function stop(c){
    if(c.abort)c.abort.abort();c.abort=null;
    clearTimeout(c.timer);c.timer=null;
  }
  function kachelReset(c){
    c.quellen=new Set();c.kachelFehler=new Map();c.kachelGeladen=false;c.kachelErfolg=false;c.kachelWarnung=false;c.ressourcenWarnung=false;c.objektWarnung=false;
  }
  function kachelFehlerEintragen(c,e){
    // MapLibre 4.7.1 SourceCache liefert tile und sourceId im Fehlerereignis.
    // Nur Anbieter-Tiles; eigene GeoJSON-Quellen sind kein CARTO-Ausfall.
    if(!e?.tile||!c.quellen.has(e.sourceId))return false;
    const jetzt=Date.now();
    for(const [id,t] of c.kachelFehler)if(jetzt-t>10000)c.kachelFehler.delete(id);
    const id=e.tile.tileID?.key;
    if(id!==undefined)c.kachelFehler.set(e.sourceId+':'+id,jetzt);
    c.kachelWarnung=true;
    hinweis(c,namen[c.modus]+' · einzelne Kacheln nicht verfügbar.');
    return true;
  }
  function onlineHinweis(c){
    hinweis(c,namen[c.modus]+' bereit · '+(c.objektWarnung?'Fehler in lokalen Objektlayern.':'lokale Objektlayer aktiv.')+
      (c.kachelWarnung?' Einzelne Kacheln nicht verfügbar.':'')+
      (c.ressourcenWarnung?' Kartenressource nicht verfügbar.':''));
  }
  function rueckfall(c,grund){
    if(!aktiv(c)||!c.a)return;
    ++c.generation;stop(c);c.modus='leer';c.phase='lokal';c.key='';kachelReset(c);
    try{c.a.setStyle(KARTE_V2_QUELLEN.leererStil());sync();}catch(e){}
    knoepfe(c);gebaeudeKnoepfe(c);hinweis(c,grund+' · Lokale Objektlayer bleiben verfügbar.');
  }
  async function wechseln(c,n){
    if(!aktiv(c)||!c.a||!Object.hasOwn(namen,n))return;
    if(n==='leer'){rueckfall(c,'Ohne Basiskarte');return;}
    const key=lokalKey();
    if(!key){rueckfall(c,'Kein lokaler CARTO-Schlüssel');return;}
    const Q=KARTE_V2_QUELLEN, g=++c.generation;stop(c);kachelReset(c);
    c.modus=n;c.phase='abruf';c.key=key;knopfhilfe();
    function knopfhilfe(){knoepfe(c);gebaeudeKnoepfe(c);hinweis(c,namen[n]+' wird geladen.');}
    const ac=new AbortController();c.abort=ac;
    c.timer=setTimeout(()=>{if(aktiv(c)&&c.generation===g)rueckfall(c,'CARTO-Zeitlimit erreicht');},25000);
    try{
      const antwort=await fetch(Q.cartoRequest(Q.stil(n),key).url,{signal:ac.signal,referrerPolicy:'no-referrer',redirect:'error',credentials:'omit'});
      if(!antwort.ok)throw Error('Stilabruf');
      const s=await antwort.json();
      if(!aktiv(c)||c.generation!==g)return;
      if(!Q.vektorStil(s))throw Error('Vektorstil');
      const stil=Q.gebaeudeStil(s,n==='dunkel',c.gebaeude);
      c.quellen=new Set(Object.entries(stil.sources).filter(([,q])=>q.type==='vector').map(([id])=>id));
      c.phase='kacheln';c.a.setStyle(stil);sync();
    }catch(e){if(aktiv(c)&&c.generation===g)rueckfall(c,'CARTO-Stil nicht verfügbar');}
  }
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
      .catch(e=>{laden=null;throw e;});
    return laden;
  }
  function ansicht(){
    if(!dev)return null;
    return h('section',{class:'panel',id:'k-v2-panel'},
      h('div',{class:'pad'},h('strong',null,'MapLibre – lokale Entwicklungsansicht'),
        h('div',{style:'display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;'},
          ...Object.keys(namen).map(n=>h('button',{type:'button',id:'k-v2-'+n,disabled:true,'aria-pressed':String(n==='leer'),onclick:()=>wechseln(kontext,n)},namen[n]))),
        h('div',{style:'display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;'},
          h('button',{type:'button',id:'k-v2-flach',disabled:true,'aria-pressed':'true',onclick:()=>neigung(kontext,0)},'2D'),
          h('button',{type:'button',id:'k-v2-geneigt',disabled:true,'aria-pressed':'false',onclick:()=>neigung(kontext,60)},'3D-Neigung'),
          h('button',{type:'button',id:'k-v2-gebaeude',disabled:true,'aria-pressed':'false',onclick:()=>gebaeudeUmschalten(kontext)},'Gebäude')),
        h('p',{class:'note'},'Masken und Zentrieren wirken derzeit auf die Lagekarte. Die gemeinsame Kamera folgt später.'),
        h('p',{class:'note'},'3D-Gebäude ab Zoom 15: Anbieterhöhen (können geschätzt sein), fehlende oder unplausible Werte bleiben flach. Keine eigene Höhenschätzung.'),
        h('p',{class:'note',id:'k-v2-status',role:'status'},'Vergleichsansicht wird geladen. Keine Basiskartenanfragen.'),
        h('small',null,'Bei CARTO-Auswahl sieht der Anbieter Kartenausschnitt, IP und Schlüssel. © OpenStreetMap-Mitwirkende, © CARTO.')),
      h('div',{id:'k-v2-map',style:'position:relative;width:100%;height:420px;min-height:240px;background:#101820;border:1px solid var(--border);'}));
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
    c.a.setSelection(auswahl(m));
  }
  function klick(c,e){
    if(!aktiv(c)||!e||!Array.isArray(e.ll)||!e.ll.every(Number.isFinite))return;
    const m=karteRenderModell(), t=e.treffer;
    /* Autoritative Prüfung nochmals am Anwendungsmodell. Nie einen alten oder
       mehrdeutigen Treffer als einen anderen Treffer (oder Leerfläche) behandeln. */
    if(t&&m.marker.concat(m.zonen,m.kanten).filter(x=>x.id===t.id&&x.renderKey===t.renderKey).length!==1)return;
    const lon=e.ll[1], ll=[e.ll[0],lon>=-180&&lon<=180?lon:((lon%360+540)%360)-180];
    if(Math.abs(ll[0])>90)return;
    karteKlickVerarbeiten({ll,markerId:t&&t.art==='marker'?t.id:null,markerKey:t&&t.art==='marker'?t.renderKey:null,
      zoneId:t&&t.art==='zone'?t.id:null,kanteId:t&&t.art==='verbindung'?t.id:null,mehr:!!e.mehr},karteRendererDatenAktualisieren);
    sync();
  }
  function unmount(erhalten=false){
    const c=kontext;kontext=null;
    if(!erhalten||document.body.classList.contains('locked'))sitzung=null;
    else if(c?.a&&c.map){
      // Auch bei fehlerhafter/entfernter Map muss der Abbau weiterlaufen.
      try{
        const kamera=c.a.camera();
        if(kamera)sitzung={kamera,modus:c.modus,gebaeude:c.gebaeude};
      }catch(e){sitzung=null;}
    }
    if(!c)return;
    ++c.generation;stop(c);c.key='';
    /* Ein Fehler beim Aufräumen darf die bestehende Anwendung nicht blockieren. */
    try{if(c.a)c.a.unmount();}catch(e){}
    try{if(c.map)c.map.remove();}catch(e){}
  }
  function mount(){
    if(!dev)return;
    const el=$('k-v2-map'),status=$('k-v2-status');
    if(!el||!status||document.body.classList.contains('locked'))return;
    if(kontext)unmount(true);
    const alt=sitzung;
    const c={el,status,map:null,a:null,modus:'leer',phase:'lokal',gebaeude:alt?.gebaeude||false,key:'',generation:0,abort:null,timer:null};
    kachelReset(c);kontext=c;
    bibliothek().then(()=>{
      if(!aktiv(c))return;
      const K=VIEW.karte;
      c.map=new maplibregl.Map({container:el,style:KARTE_V2_QUELLEN.leererStil(),
        ...(alt?.kamera||{center:[K.lon,Math.max(-85,Math.min(85,K.lat))],zoom:Math.max(1,Math.min(19,K.zoom-0.5))}),attributionControl:true,
        transformRequest:url=>KARTE_V2_QUELLEN.cartoRequest(url,c.key)});
      c.map.addControl(new maplibregl.NavigationControl({visualizePitch:true}),'top-right');
      c.map.on('moveend',()=>gebaeudeKnoepfe(c));
      c.a=KARTE_V2_RENDERER.adapter(c.map,{onClick:e=>klick(c,e),onError:t=>hinweis(c,t)});
      c.map.on('sourcedata',e=>{
        if(!aktiv(c)||!['kacheln','online'].includes(c.phase)||!c.quellen.has(e.sourceId)||e.tile?.state!=='loaded')return;
        c.kachelGeladen=true;c.kachelErfolg=true;
      });
      c.map.on('error',e=>{
        if(!aktiv(c)||!['kacheln','online'].includes(c.phase))return;
        if(kachelFehlerEintragen(c,e))return;
        if(e?.sourceId?.startsWith('shadow-v2-')){
          c.objektWarnung=true;hinweis(c,'Eigene Kartenlayer konnten nicht aufgebaut werden.');return;
        }
        if(c.phase==='kacheln')rueckfall(c,'CARTO-Ressource nicht verfügbar');
        else {c.ressourcenWarnung=true;hinweis(c,namen[c.modus]+' · Kartenressource nicht verfügbar.');}
      });
      c.map.on('idle',()=>{
        if(!aktiv(c)||!c.a.ready())return;
        if(c.phase==='kacheln'||c.phase==='online'){
          if(!c.map.areTilesLoaded())return;
          const jetzt=Date.now();
          for(const [id,t] of c.kachelFehler)if(jetzt-t>10000)c.kachelFehler.delete(id);
          if(c.phase==='kacheln'){
            // Einzelne fehlende Tiles sind tolerierbar; ohne irgendeine geladene
            // Anbieter-Kachel darf der Stil nicht als online gemeldet werden.
            if(!c.kachelGeladen){
              if(c.kachelWarnung)rueckfall(c,'CARTO-Ressource nicht verfügbar');
              return; // ansonsten greift das bestehende Zeitlimit
            }
            stop(c);c.phase='online';gebaeudeKnoepfe(c);
          }else if(!c.kachelErfolg&&c.kachelFehler.size>=3){
            rueckfall(c,'CARTO-Ressource nicht verfügbar');return;
          }
          if(c.kachelErfolg){
            if(!c.kachelFehler.size)c.kachelWarnung=false;
            c.kachelFehler.clear();
          }
          c.kachelErfolg=false;onlineHinweis(c);
        }else if(c.phase==='lokal'&&!c.status.textContent.includes('bleiben verfügbar'))hinweis(c,'Lokale Objektlayer bereit · keine Basiskarte · Kamera vorläufig unabhängig.');
      });
      knoepfe(c);gebaeudeKnoepfe(c);
      sync();
      if(alt&&alt.modus!=='leer')wechseln(c,alt.modus);
    }).catch(()=>{
      if(!aktiv(c))return;
      hinweis(c,'Lokale MapLibre-Ansicht nicht verfügbar. Bestehende Karte bleibt verfügbar.');
      try{unmount();}catch(e){/* Fehler darf Standardkarte nicht beeinflussen */}
    });
  }
  /* Nur für die Entwicklungsansicht; Rückgabe der Adapterreferenz zur Prüfung
     tatsächlicher Treffer und des Lebenszyklus, kein zusätzlicher Datenbestand. */
  root.KARTE_V2_DEV=Object.freeze({ansicht,mount,unmount,sync,adapter:()=>aktiv(kontext)?kontext.a:null});
})(window);
