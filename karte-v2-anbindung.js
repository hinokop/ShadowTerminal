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
  const namen={leer:'Ohne Basiskarte',voyager:'Voyager',dunkel:'Dark Matter',luftbild:'Luftbild'};
  const STIL_RAM_MS=10*60*1000; // begrenzte Wiederverwendung, nur beim Neuaufbau
  /* Nur Sitzungs-RAM: Kamera, explizite Stilwahl, Gebäudewunsch; kein Schlüssel,
     keine Objekte, keine persistente Speicherung. Gemeinsame Kamera folgt in K4. */
  function knoepfe(c){
    if(!aktiv(c))return;
    for(const n of Object.keys(namen)){
      const el=$('k-v2-'+n);if(el){el.disabled=!c.a;el.setAttribute('aria-pressed',String(c.modus===n));}
    }
    const row=$('k-v2-bildwahl-zeile'), sel=$('k-v2-bildwahl');
    if(row)row.hidden=c.modus!=='luftbild';
    if(sel){sel.disabled=!c.a||c.modus!=='luftbild';sel.value=c.bildWahl;}
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
    // Nur Anbieter-Tiles; eigene GeoJSON-Quellen sind kein Basiskartenausfall.
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
    ++c.generation;stop(c);c.modus='leer';c.phase='lokal';c.bildQuelle=null;c.bildSourceId=null;c.key='';c.stilCache=null;c.stilKandidat=null;kachelReset(c);
    try{c.a.setStyle(KARTE_V2_QUELLEN.leererStil());sync();}catch(e){}
    knoepfe(c);gebaeudeKnoepfe(c);hinweis(c,grund+' · Lokale Objektlayer bleiben verfügbar.');
  }
  /* K2d-2b: Modus unabhängig von der Quelle. Automatik wählt nur aus
     der freigegebenen Liste anhand Mittelpunkt/Zoom; keine Abdeckungsgarantie.
     Keine automatische Freischaltung weiterer Dienste oder Kostenquellen. */
  function bildPosition(c){return c.map.getCenter().wrap().toArray();}
  function bildKandidaten(c){
    const Q=KARTE_V2_QUELLEN, center=bildPosition(c), zoom=c.map.getZoom();
    if(c.bildWahl!=='auto')return Q.bildBereich(c.bildWahl,center,zoom)==='kandidat'?[c.bildWahl]:[];
    return Q.bildKandidaten(center,zoom,c.bildAusgefallen);
  }
  function bildStatus(c){
    if(!aktiv(c)||c.phase!=='bild')return;
    const Q=KARTE_V2_QUELLEN;
    if(!c.bildQuelle){
      const ids=c.bildWahl==='auto'?Q.bildListe().map(q=>q.id):[c.bildWahl];
      const bereiche=ids.map(id=>Q.bildBereich(id,bildPosition(c),c.map.getZoom()));
      const grund=bereiche.includes('kandidat')?'Keine geeignete Bildquelle verfügbar.':
        bereiche.includes('uebersicht')?'Weiter hineinzoomen.':'Mittelpunkt außerhalb des Anfragebereichs.';
      hinweis(c,'Luftbild · '+grund+' Lokale Objektlayer bleiben verfügbar.');
      return;
    }
    const info=Q.bildInfo(c.bildQuelle);
    const bereich=Q.bildBereich(c.bildQuelle,bildPosition(c),c.map.getZoom());
    const over=c.map.getZoom()>info.maxzoom-Math.log2(512/info.tileSize);
    if(bereich!=='kandidat'||c.kachelGeladen){
      clearTimeout(c.timer);c.timer=null;
    }else if(c.timer===null){
      const g=c.generation;
      c.timer=setTimeout(()=>{
        if(aktiv(c)&&c.generation===g&&c.phase==='bild'&&!c.kachelGeladen)bildAusfall(c,'Luftbild-Zeitlimit erreicht');
      },25000);
    }
    const stand=bereich==='ausserhalb'?'Mittelpunkt außerhalb des Anfragebereichs.':
      bereich==='uebersicht'?'Weiter hineinzoomen.':
      c.kachelGeladen?'Bildkacheln geladen (seit Auswahl); tatsächliche Abdeckung visuell prüfen.':'Noch keine Bildkachel bestätigt.';
    hinweis(c,info.name+' · '+info.aufnahme+' · nominal '+Math.round(info.gsd*100)+' cm · '+stand+
      (c.bildAusgefallen.length?' Automatischer Quellenrückfall.':'')+
      (c.kachelWarnung||c.ressourcenWarnung?' Teil-/Ladefehler.':'')+
      (c.objektWarnung?' Fehler in lokalen Objektlayern.':'')+
      (over?' Overzoom, keine zusätzliche Bildinformation.':''));
  }
  function bildAusfall(c,grund){
    if(!aktiv(c)||c.phase!=='bild')return;
    if(c.bildWahl==='auto'&&c.bildQuelle){
      if(!c.bildAusgefallen.includes(c.bildQuelle))c.bildAusgefallen.push(c.bildQuelle);
      bildAktualisieren(c);
    }else rueckfall(c,grund);
  }
  function bildAktualisieren(c,erzwingen=false){
    if(!aktiv(c)||c.phase!=='bild')return;
    const Q=KARTE_V2_QUELLEN, id=bildKandidaten(c)[0]||null;
    if(!erzwingen&&id===c.bildQuelle){bildStatus(c);return;}
    ++c.generation;stop(c);kachelReset(c);c.key='';c.stilCache=null;c.stilKandidat=null;
    c.bildQuelle=id;c.bildSourceId=id?Q.BILD_ID+'-'+c.generation:null;
    if(id)c.quellen=new Set([c.bildSourceId]);
    try{c.a.setStyle(id?Q.bildStil(id,c.bildSourceId):Q.leererStil());sync();bildStatus(c);}
    catch(e){bildAusfall(c,'Luftbild nicht verfügbar');}
  }
  function bildWechseln(c,wieder=false){
    c.modus='luftbild';c.phase='bild';
    if(!wieder)c.bildAusgefallen=[];
    knoepfe(c);gebaeudeKnoepfe(c);bildAktualisieren(c,true);
  }
  function bildManuell(wahl){
    const c=kontext;
    if(!aktiv(c)||c.phase!=='bild'||(wahl!=='auto'&&!KARTE_V2_QUELLEN.bildInfo(wahl)))return;
    c.bildWahl=wahl;c.bildAusgefallen=[];bildAktualisieren(c,true);
  }
  async function wechseln(c,n,cache=null,wieder=false){
    if(!aktiv(c)||!c.a||!Object.hasOwn(namen,n))return;
    if(n==='leer'){rueckfall(c,'Ohne Basiskarte');return;}
    if(n==='luftbild'){bildWechseln(c,wieder);return;}
    const key=lokalKey();
    if(!key){rueckfall(c,'Kein lokaler CARTO-Schlüssel');return;}
    const Q=KARTE_V2_QUELLEN, g=++c.generation;stop(c);kachelReset(c);
    c.modus=n;c.phase='abruf';c.bildQuelle=null;c.bildSourceId=null;c.key=key;c.stilCache=null;c.stilKandidat=null;knopfhilfe();
    function knopfhilfe(){knoepfe(c);gebaeudeKnoepfe(c);hinweis(c,namen[n]+' wird geladen.');}
    const ac=new AbortController();c.abort=ac;
    c.timer=setTimeout(()=>{if(aktiv(c)&&c.generation===g)rueckfall(c,'CARTO-Zeitlimit erreicht');},25000);
    try{
      let s,zeit;
      const wieder=cache&&cache.modus===n&&Date.now()-cache.zeit<STIL_RAM_MS&&Q.styleCachebar(cache.stil,key);
      if(wieder){s=cache.stil;zeit=cache.zeit;}
      else{
        const antwort=await fetch(Q.cartoRequest(Q.stil(n),key).url,{signal:ac.signal,referrerPolicy:'no-referrer',redirect:'error',credentials:'omit'});
        if(!antwort.ok)throw Error('Stilabruf');
        s=await antwort.json();zeit=Date.now();
      }
      if(!aktiv(c)||c.generation!==g)return;
      if(!Q.vektorStil(s))throw Error('Vektorstil');
      const stil=Q.gebaeudeStil(s,n==='dunkel',c.gebaeude);
      if(Q.styleCachebar(s,key)){
        c.stilKandidat={modus:n,zeit,stil:s};
        if(wieder)c.stilCache=c.stilKandidat; // bereits in dieser Sitzung online bewährt
      }
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
        h('div',{id:'k-v2-bildwahl-zeile',hidden:true,style:'margin-top:8px;'},
          h('label',{for:'k-v2-bildwahl'},'Bildquelle '),
          h('select',{id:'k-v2-bildwahl',disabled:true,onchange:e=>bildManuell(e.target.value)},
            h('option',{value:'auto'},'Automatisch'))),
        h('div',{style:'display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;'},
          h('button',{type:'button',id:'k-v2-flach',disabled:true,'aria-pressed':'true',onclick:()=>neigung(kontext,0)},'2D'),
          h('button',{type:'button',id:'k-v2-geneigt',disabled:true,'aria-pressed':'false',onclick:()=>neigung(kontext,60)},'3D-Neigung'),
          h('button',{type:'button',id:'k-v2-gebaeude',disabled:true,'aria-pressed':'false',onclick:()=>gebaeudeUmschalten(kontext)},'Gebäude')),
        h('p',{class:'note'},'Masken und Zentrieren wirken derzeit auf die Lagekarte. Die gemeinsame Kamera folgt später.'),
        h('p',{class:'note'},'3D-Gebäude ab Zoom 15: Anbieterhöhen (können geschätzt sein), fehlende oder unplausible Werte bleiben flach. Keine eigene Höhenschätzung.'),
        h('p',{class:'note',id:'k-v2-status',role:'status'},'Vergleichsansicht wird geladen. Keine Basiskartenanfragen.'),
        h('small',null,'Bei Online-Auswahl sieht der jeweilige Anbieter Kartenausschnitt und IP, CARTO zusätzlich den Schlüssel. Die Bildquelle und ihre Metadaten werden im Status und in der Kartenattribution ausgewiesen. © OpenStreetMap-Mitwirkende, © CARTO.')),
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
        if(kamera)sitzung={kamera,modus:c.modus,gebaeude:c.gebaeude,
          stilCache:c.key&&c.key===lokalKey()?c.stilCache:null,bildWahl:c.bildWahl,bildAusgefallen:c.bildAusgefallen.slice()};
      }catch(e){sitzung=null;}
    }
    if(!c)return;
    ++c.generation;stop(c);c.key='';c.stilCache=null;c.stilKandidat=null;
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
    const c={el,status,map:null,a:null,modus:'leer',phase:'lokal',gebaeude:alt?.gebaeude||false,bildWahl:alt?.bildWahl||'auto',bildAusgefallen:alt?.bildAusgefallen?.slice()||[],bildQuelle:null,bildSourceId:null,key:'',stilCache:null,stilKandidat:null,generation:0,abort:null,timer:null};
    kachelReset(c);kontext=c;
    bibliothek().then(()=>{
      if(!aktiv(c))return;
      const K=VIEW.karte, sel=$('k-v2-bildwahl');
      if(sel)for(const q of KARTE_V2_QUELLEN.bildListe())sel.appendChild(h('option',{value:q.id},q.name));
      c.map=new maplibregl.Map({container:el,style:KARTE_V2_QUELLEN.leererStil(),
        ...(alt?.kamera||{center:[K.lon,Math.max(-85,Math.min(85,K.lat))],zoom:Math.max(1,Math.min(19,K.zoom-0.5))}),attributionControl:true,
        transformRequest:url=>KARTE_V2_QUELLEN.cartoRequest(url,c.key)});
      c.map.addControl(new maplibregl.NavigationControl({visualizePitch:true}),'top-right');
      c.map.on('moveend',()=>{gebaeudeKnoepfe(c);bildAktualisieren(c);});
      c.a=KARTE_V2_RENDERER.adapter(c.map,{onClick:e=>klick(c,e),onError:t=>hinweis(c,t)});
      c.map.on('sourcedata',e=>{
        if(!aktiv(c)||!['kacheln','online','bild'].includes(c.phase)||!c.quellen.has(e.sourceId)||e.tile?.state!=='loaded')return;
        c.kachelGeladen=true;c.kachelErfolg=true;
        if(c.phase==='bild')bildStatus(c);
      });
      c.map.on('error',e=>{
        if(!aktiv(c)||!['kacheln','online','bild'].includes(c.phase))return;
        if(kachelFehlerEintragen(c,e)){if(c.phase==='bild')bildStatus(c);return;}
        if(c.phase==='bild'&&e?.sourceId?.startsWith(KARTE_V2_QUELLEN.BILD_ID+'-')){
          if(e.sourceId===c.bildSourceId){c.ressourcenWarnung=true;bildStatus(c);}return;
        }
        if(e?.sourceId?.startsWith('shadow-v2-')){
          c.objektWarnung=true;hinweis(c,'Eigene Kartenlayer konnten nicht aufgebaut werden.');return;
        }
        if(c.phase==='bild'){
          if(!e?.sourceId&&c.bildQuelle){c.ressourcenWarnung=true;bildStatus(c);}
          return;
        }
        if(c.phase==='kacheln')rueckfall(c,'CARTO-Ressource nicht verfügbar');
        else {c.ressourcenWarnung=true;hinweis(c,namen[c.modus]+' · Kartenressource nicht verfügbar.');}
      });
      c.map.on('idle',()=>{
        if(!aktiv(c)||!c.a.ready())return;
        if(c.phase==='bild'){
          if(!c.bildQuelle){bildStatus(c);return;}
          if(!c.map.areTilesLoaded())return;
          if(!c.kachelGeladen&&(c.kachelWarnung||c.ressourcenWarnung)&&
             KARTE_V2_QUELLEN.bildBereich(c.bildQuelle,bildPosition(c),c.map.getZoom())==='kandidat'){
            bildAusfall(c,'Luftbild nicht verfügbar');return;
          }
          // Wie beim Vektorstil einzelne Ausfälle tolerieren; nach erfolgreichem
          // Start erst bei einer Häufung ohne neuen Erfolg im Anfragebereich zurückfallen.
          const jetzt=Date.now();
          for(const [id,t] of c.kachelFehler)if(jetzt-t>10000)c.kachelFehler.delete(id);
          if(c.kachelGeladen&&!c.kachelErfolg&&c.kachelFehler.size>=3&&
             KARTE_V2_QUELLEN.bildBereich(c.bildQuelle,bildPosition(c),c.map.getZoom())==='kandidat'){
            bildAusfall(c,'Luftbild nicht verfügbar');return;
          }
          if(c.kachelErfolg){
            if(!c.kachelFehler.size)c.kachelWarnung=false;
            c.kachelFehler.clear();
          }
          c.kachelErfolg=false;bildStatus(c);return;
        }
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
            stop(c);c.phase='online';c.stilCache=c.stilKandidat;c.stilKandidat=null;gebaeudeKnoepfe(c);
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
      if(alt&&alt.modus!=='leer')wechseln(c,alt.modus,alt.stilCache,true);
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
