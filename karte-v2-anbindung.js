/* K2b-2b: explizite lokale Vergleichsansicht, kein Standardrendererwechsel.
   Aktiv nur in index.html?geospatial-v2=1; kein persistenter Schalter.
   K2c-1: explizite Vektorstile, lokaler Schlüssel, leerer bedienbarer Rückfall. */
(function(root){
  'use strict';
  const dev=new URLSearchParams(location.search).get('geospatial-v2')==='1';
  let kontext=null, laden=null;
  /* Nur Opt-in, vor allen MapLibre-Netzanfragen. Die Standardansicht bleibt unverändert. */
  if(dev){
    const meta=document.createElement('meta');meta.name='referrer';meta.content='no-referrer';document.head.appendChild(meta);
  }
  const lokalKey=()=>typeof root.KARTEN_SCHLUESSEL?.carto==='string'?root.KARTEN_SCHLUESSEL.carto.trim():'';
  const namen={leer:'Lokal',voyager:'Voyager',dunkel:'Dark Matter'};
  /* Absichtlich keine Persistenz; ein Modul-Neuaufbau beginnt wieder lokal.
     K4 übernimmt den gemeinsamen Ansichts-/Kamerazustand. */
  function knoepfe(c){
    if(!aktiv(c))return;
    for(const n of Object.keys(namen)){
      const el=$('k-v2-'+n);if(el){el.disabled=!c.a;el.setAttribute('aria-pressed',String(c.modus===n));}
    }
  }
  function stop(c){
    if(c.abort)c.abort.abort();c.abort=null;
    clearTimeout(c.timer);c.timer=null;
  }
  function rueckfall(c,grund){
    if(!aktiv(c)||!c.a)return;
    ++c.generation;stop(c);c.modus='leer';c.phase='lokal';c.key='';
    try{c.a.setStyle(KARTE_V2_QUELLEN.leererStil());sync();}catch(e){}
    knoepfe(c);hinweis(c,grund+' · Lokale Objektlayer bleiben verfügbar.');
  }
  async function wechseln(c,n){
    if(!aktiv(c)||!c.a||!Object.hasOwn(namen,n))return;
    if(n==='leer'){rueckfall(c,'Lokaler Stil');return;}
    const key=lokalKey();
    if(!key){rueckfall(c,'Kein lokaler CARTO-Schlüssel');return;}
    const Q=KARTE_V2_QUELLEN, g=++c.generation;stop(c);
    c.modus=n;c.phase='abruf';c.key=key;knopfhilfe();
    function knopfhilfe(){knoepfe(c);hinweis(c,namen[n]+' wird geladen.');}
    const ac=new AbortController();c.abort=ac;
    c.timer=setTimeout(()=>{if(aktiv(c)&&c.generation===g)rueckfall(c,'CARTO-Zeitlimit erreicht');},25000);
    try{
      const antwort=await fetch(Q.cartoRequest(Q.stil(n),key).url,{signal:ac.signal,referrerPolicy:'no-referrer',redirect:'error',credentials:'omit'});
      if(!antwort.ok)throw Error('Stilabruf');
      const s=await antwort.json();
      if(!aktiv(c)||c.generation!==g)return;
      if(!Q.vektorStil(s))throw Error('Vektorstil');
      c.phase='kacheln';c.a.setStyle(s);sync();
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
  function unmount(){
    const c=kontext;kontext=null;
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
    unmount();
    const c={el,status,map:null,a:null,modus:'leer',phase:'lokal',key:'',generation:0,abort:null,timer:null};kontext=c;
    bibliothek().then(()=>{
      if(!aktiv(c))return;
      const K=VIEW.karte;
      c.map=new maplibregl.Map({container:el,style:KARTE_V2_QUELLEN.leererStil(),
        center:[K.lon,Math.max(-85,Math.min(85,K.lat))],zoom:Math.max(1,Math.min(19,K.zoom-0.5)),attributionControl:true,
        transformRequest:url=>KARTE_V2_QUELLEN.cartoRequest(url,c.key)});
      c.map.addControl(new maplibregl.NavigationControl(),'top-right');
      c.a=KARTE_V2_RENDERER.adapter(c.map,{onClick:e=>klick(c,e),onError:t=>hinweis(c,t)});
      c.map.on('error',()=>{
        if(!aktiv(c))return;
        if(c.phase==='kacheln'||c.phase==='online')rueckfall(c,'CARTO-Ressource nicht verfügbar');
      });
      c.map.on('idle',()=>{
        if(!aktiv(c)||!c.a.ready())return;
        if(c.phase==='kacheln'){stop(c);c.phase='online';hinweis(c,namen[c.modus]+' bereit · lokale Objektlayer aktiv.');}
        else if(c.phase==='lokal'&&!c.status.textContent.includes('bleiben verfügbar'))hinweis(c,'Lokale Objektlayer bereit · keine Basiskarte · Kamera vorläufig unabhängig.');
      });
      knoepfe(c);
      sync();
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
