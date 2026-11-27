/* K2b-2b: explizite lokale Vergleichsansicht, kein Standardrendererwechsel.
   Aktiv nur in index.html?geospatial-v2=1; kein persistenter Schalter.
   K2c-1: explizite Vektorstile, lokaler Schlüssel, leerer bedienbarer Rückfall. */
(function(root){
  'use strict';
  const dev=new URLSearchParams(location.search).get('geospatial-v2')==='1';
  let kontext=null, laden=null, sitzung=null, voll=false;
  /* Nur Opt-in, vor allen MapLibre-Netzanfragen. Die Standardansicht bleibt unverändert. */
  if(dev){
    const meta=document.createElement('meta');meta.name='referrer';meta.content='no-referrer';document.head.appendChild(meta);
  }
  // Die Lagekarte hat Datei- und Browserquelle bereits aufgelöst (Browser hat Vorrang).
  const lokalKey=()=>typeof VIEW.karte.cartoKey==='string'?VIEW.karte.cartoKey.trim():'';
  const namen={leer:'Ohne Basiskarte',voyager:'Voyager',dunkel:'Dark Matter',shadow:'Shadow',luftbild:'Luftbild',hybrid:'Hybrid'};
  const STIL_RAM_MS=10*60*1000; // begrenzte Wiederverwendung, nur beim Neuaufbau
  /* Nur Sitzungs-RAM: Kamera, explizite Stilwahl, Gebäudewunsch; kein Schlüssel,
     keine Objekte, keine persistente Speicherung. Gemeinsame Kamera folgt in K4. */
  function knoepfe(c){
    if(!aktiv(c))return;
    for(const n of Object.keys(namen)){
      const el=$('k-v2-'+n);if(el){el.disabled=!c.a;el.setAttribute('aria-pressed',String(c.modus===n));}
    }
    const row=$('k-v2-bildwahl-zeile'), sel=$('k-v2-bildwahl');
    const raster=['luftbild','hybrid'].includes(c.modus);
    if(row)row.hidden=!raster;
    if(sel){sel.disabled=!c.a||!raster;sel.value=c.bildWahl;}
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
    clearTimeout(c.fehlerTimer);c.fehlerTimer=null;
  }
  function hybridStop(c){
    const h=c.hyb;if(!h)return;c.hyb=null;
    h.abort?.abort();clearTimeout(h.abrufTimer);clearTimeout(h.tileTimer);
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
    ++c.generation;stop(c);hybridStop(c);c.modus='leer';c.phase='lokal';c.bildQuelle=null;c.bildSourceId=null;c.key='';c.stilCache=null;c.stilKandidat=null;kachelReset(c);
    try{c.a.setStyle(KARTE_V2_QUELLEN.leererStil());sync();}catch(e){}
    knoepfe(c);gebaeudeKnoepfe(c);hinweis(c,grund+' · Lokale Objektlayer bleiben verfügbar.');
  }
  /* K2d-2b: Modus unabhängig von der Quelle. Automatik wählt nur aus
     der freigegebenen Liste anhand Mittelpunkt/Zoom; keine Abdeckungsgarantie.
     Keine automatische Freischaltung weiterer Dienste oder Kostenquellen. */
  function bildPosition(c){return c.map.getCenter().wrap().toArray();}
  function bildKandidaten(c){
    const Q=KARTE_V2_QUELLEN, center=bildPosition(c), zoom=c.map.getZoom();
    if(c.bildWahl!=='auto')return !c.hyb?.bildManuellFehler&&Q.bildBereich(c.bildWahl,center,zoom)==='kandidat'?[c.bildWahl]:[];
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
      hinweis(c,namen[c.modus]+' · '+grund+' Lokale Objektlayer bleiben verfügbar.'+hybridZusatz(c));
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
    const aufloesung=info.gsd>=1?info.gsd+' m':Math.round(info.gsd*100)+' cm';
    hinweis(c,(c.modus==='hybrid'?'Hybrid · ':'')+info.name+' · '+info.aufnahme+' · nominal '+aufloesung+' · '+stand+
      (info.art==='Satellitenübersicht'?' Historische Übersicht, keine Gebäudedetailauflösung.':'')+
      (c.bildAusgefallen.length?' Automatischer Quellenrückfall.':'')+
      (c.kachelWarnung||c.ressourcenWarnung?' Teil-/Ladefehler.':'')+
      (c.objektWarnung?' Fehler in lokalen Objektlayern.':'')+
      (over?' Overzoom, keine zusätzliche Bildinformation.':'')+hybridZusatz(c));
  }
  function bildAusfall(c,grund){
    if(!aktiv(c)||c.phase!=='bild')return;
    if(c.bildWahl==='auto'&&c.bildQuelle){
      if(!c.bildAusgefallen.includes(c.bildQuelle))c.bildAusgefallen.push(c.bildQuelle);
      bildAktualisieren(c);
    }else if(c.modus==='hybrid'&&c.bildQuelle){
      c.hyb.bildManuellFehler=true;bildAktualisieren(c,true);
    }else rueckfall(c,grund);
  }
  function bildAktualisieren(c,erzwingen=false){
    if(!aktiv(c)||c.phase!=='bild')return;
    const Q=KARTE_V2_QUELLEN, id=bildKandidaten(c)[0]||null;
    if(!erzwingen&&id===c.bildQuelle){bildStatus(c);return;}
    ++c.generation;stop(c);kachelReset(c);c.key=c.hyb?.stil&&c.hyb.key===lokalKey()?c.hyb.key:'';c.stilCache=null;c.stilKandidat=null;
    c.bildQuelle=id;c.bildSourceId=id?Q.BILD_ID+'-'+c.generation:null;
    if(id)c.quellen=new Set([c.bildSourceId]);
    let stil;
    const h=c.hyb;
    if(h){
      clearTimeout(h.tileTimer);h.tileTimer=null;h.vektorId=null;h.geladen=false;h.erfolg=false;h.fehler=new Map();h.warnung=false;
      if(h.stil&&!c.key){h.stil=null;h.grund='CARTO-Schlüssel geändert';}
      if(h.stil){
        try{
          h.vektorId='shadow-v2-hybrid-'+c.generation;
          stil=Q.hybridStil(id,h.stil,c.bildSourceId||Q.BILD_ID,h.vektorId);
          const g=c.generation;
          h.tileTimer=setTimeout(()=>{if(aktiv(c)&&c.hyb===h&&c.generation===g&&!h.geladen)hybridAusfall(c,'CARTO-Kachelzeitlimit');},25000);
        }catch(e){h.stil=null;h.vektorId=null;h.grund='CARTO-Hybridstil nicht verfügbar';c.key='';}
      }
    }
    try{c.a.setStyle(stil||(id?Q.bildStil(id,c.bildSourceId):Q.leererStil()));sync();bildStatus(c);}
    catch(e){if(h?.stil)hybridAusfall(c,'CARTO-Hybridstil nicht verfügbar');else if(id)bildAusfall(c,'Luftbild nicht verfügbar');else rueckfall(c,'Kartenstil nicht verfügbar');}
  }
  function bildWechseln(c,wieder=false){
    hybridStop(c);c.modus='luftbild';c.phase='bild';
    if(!wieder)c.bildAusgefallen=[];
    knoepfe(c);gebaeudeKnoepfe(c);bildAktualisieren(c,true);
  }
  function bildManuell(wahl){
    const c=kontext;
    if(!aktiv(c)||c.phase!=='bild'||(wahl!=='auto'&&!KARTE_V2_QUELLEN.bildInfo(wahl)))return;
    c.bildWahl=wahl;c.bildAusgefallen=[];if(c.hyb)c.hyb.bildManuellFehler=false;bildAktualisieren(c,true);
  }
  function hybridZusatz(c){
    const h=c.hyb;if(!h)return '';
    return h.laden?' CARTO-Stil wird geladen.':h.grund?' '+h.grund+'; ohne Vektoroverlay.':
      h.geladen?' Vektorkacheln geladen'+(h.warnung?' (Teil-/Ladefehler).':'.'):
      ' Vektorkacheln noch nicht bestätigt'+(h.warnung?' (Teil-/Ladefehler).':'.');
  }
  function hybridAusfall(c,grund){
    const h=c.hyb;if(!aktiv(c)||!h)return;
    h.abort?.abort();clearTimeout(h.abrufTimer);clearTimeout(h.tileTimer);
    h.abort=null;h.laden=false;h.stil=null;h.grund=grund;c.key='';
    bildAktualisieren(c,true);
  }
  async function hybridWechseln(c,wieder=false,alt=null){
    hybridStop(c);c.modus='hybrid';c.phase='bild';
    if(!wieder)c.bildAusgefallen=[];
    const key=lokalKey(),h={key,laden:!!key,grund:key?'':'Kein lokaler CARTO-Schlüssel',stil:null,zeit:0,abort:null,abrufTimer:null,tileTimer:null,bildManuellFehler:!!(wieder&&alt?.bildManuellFehler)};
    if(wieder&&alt?.grund){h.grund=alt.grund;h.laden=false;}
    else if(wieder&&key&&alt?.stil&&Date.now()-alt.zeit<STIL_RAM_MS&&KARTE_V2_QUELLEN.styleCachebar(alt.stil,key)){
      h.stil=alt.stil;h.zeit=alt.zeit;h.laden=false;
    }
    c.hyb=h;knoepfe(c);gebaeudeKnoepfe(c);bildAktualisieren(c,true);
    if(!aktiv(c)||c.hyb!==h||!h.laden)return;
    const Q=KARTE_V2_QUELLEN,ac=new AbortController();h.abort=ac;
    h.abrufTimer=setTimeout(()=>{if(aktiv(c)&&c.hyb===h)hybridAusfall(c,'CARTO-Stilzeitlimit');},25000);
    try{
      const antwort=await fetch(Q.cartoRequest(Q.stil('dunkel'),key).url,{signal:ac.signal,referrerPolicy:'no-referrer',redirect:'error',credentials:'omit'});
      if(!antwort.ok)throw Error('Stilabruf');
      const s=await antwort.json();
      if(!aktiv(c)||c.hyb!==h||h.abort!==ac)return;
      // Kein Wiederverwenden eines Styles, der zu einem anderen Key geladen wurde.
      if(key!==lokalKey()){hybridAusfall(c,'CARTO-Schlüssel geändert');return;}
      h.stil=s;h.zeit=Date.now();h.laden=false;bildAktualisieren(c,true);
    }catch(e){if(aktiv(c)&&c.hyb===h&&h.abort===ac)hybridAusfall(c,'CARTO-Stil nicht verfügbar');}
    finally{clearTimeout(h.abrufTimer);if(h.abort===ac)h.abort=null;}
  }
  function hybridFehler(c,e){
    const h=c.hyb;if(!h)return false;
    if(e?.sourceId?.startsWith('shadow-v2-hybrid-')){
      if(e.sourceId!==h.vektorId)return true;
      h.warnung=true;
      const id=e.tile?.tileID?.key;
      const jetzt=Date.now();for(const [k,t] of h.fehler)if(jetzt-t>10000)h.fehler.delete(k);
      if(id!==undefined)h.fehler.set(id,jetzt);
      bildStatus(c);return true;
    }
    return false;
  }
  function hybridIdle(c,nurFehler=false){
    const h=c.hyb;if(!h?.stil||!h.vektorId)return false;
    for(const [id,t] of h.fehler)if(Date.now()-t>10000)h.fehler.delete(id);
    if((!h.geladen&&h.fehler.size)||(!h.erfolg&&h.fehler.size>=3)){
      hybridAusfall(c,'CARTO-Vektorkacheln nicht verfügbar');return true;
    }
    if(nurFehler)return false;
    if(h.erfolg){if(!h.fehler.size)h.warnung=false;h.fehler.clear();}
    h.erfolg=false;return false;
  }
  async function wechseln(c,n,cache=null,wieder=false){
    if(!aktiv(c)||!c.a||!Object.hasOwn(namen,n))return;
    if(n==='leer'){rueckfall(c,'Ohne Basiskarte');return;}
    if(n==='luftbild'){bildWechseln(c,wieder);return;}
    if(n==='hybrid'){hybridWechseln(c,wieder,cache);return;}
    hybridStop(c);
    const key=lokalKey();
    if(!key){rueckfall(c,'Kein lokaler CARTO-Schlüssel');return;}
    const Q=KARTE_V2_QUELLEN, g=++c.generation;stop(c);kachelReset(c);
    c.modus=n;c.phase='abruf';c.bildQuelle=null;c.bildSourceId=null;c.key=key;c.stilCache=null;c.stilKandidat=null;knopfhilfe();
    function knopfhilfe(){knoepfe(c);gebaeudeKnoepfe(c);hinweis(c,namen[n]+' wird geladen.');}
    const ac=new AbortController();c.abort=ac;
    c.timer=setTimeout(()=>{if(aktiv(c)&&c.generation===g)rueckfall(c,'CARTO-Zeitlimit erreicht');},25000);
    try{
      let s,zeit;
      const cacheTreffer=cache&&cache.modus===n&&Date.now()-cache.zeit<STIL_RAM_MS&&Q.styleCachebar(cache.stil,key);
      if(cacheTreffer){s=cache.stil;zeit=cache.zeit;}
      else{
        const antwort=await fetch(Q.cartoRequest(Q.stil(n==='shadow'?'dunkel':n),key).url,{signal:ac.signal,referrerPolicy:'no-referrer',redirect:'error',credentials:'omit'});
        if(!antwort.ok)throw Error('Stilabruf');
        s=await antwort.json();zeit=Date.now();
      }
      if(!aktiv(c)||c.generation!==g)return;
      if(!Q.vektorStil(s))throw Error('Vektorstil');
      const basis=Q.gebaeudeStil(s,n==='dunkel'||n==='shadow',c.gebaeude);
      const stil=n==='shadow'?Q.shadowStil(basis):basis;
      if(Q.styleCachebar(s,key)){
        c.stilKandidat={modus:n,zeit,stil:s};
        if(cacheTreffer)c.stilCache=c.stilKandidat; // bereits in dieser Sitzung online bewährt
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
      .then(()=>typeof KARTE_V2_DIAGNOSE==='undefined'?script('karte-v2-diagnose.js'):null)
      .catch(e=>{laden=null;throw e;});
    return laden;
  }
  function gruppe(name,children){
    return h('div',{style:'display:flex;flex-direction:column;gap:4px;min-width:0;'},
      h('span',{style:'font-size:10px;letter-spacing:.08em;text-transform:uppercase;opacity:.72;'},name),
      h('div',{role:'group','aria-label':name,style:'display:flex;gap:5px;flex-wrap:wrap;align-items:center;'},children));
  }
  function legendeAktualisieren(){
    const box=$('k-v2-legendenliste');
    if(!box||typeof KARTE_V2_RENDERER==='undefined')return;
    if(!box.childElementCount){
      for(const l of KARTE_V2_RENDERER.legende){
        let symbol;
        if(l.symbol){
          const bild=KARTE_V2_RENDERER.symbolBild(l.symbol);
          symbol=h('canvas',{'aria-hidden':'true','data-symbol':l.symbol,width:bild.width,height:bild.height,
            style:'display:inline-block;flex:none;width:20px;height:20px;'});
          const ctx=symbol.getContext('2d');
          if(ctx){const pixel=ctx.createImageData(bild.width,bild.height);pixel.data.set(bild.data);ctx.putImageData(pixel,0,0);}
        }else{
          symbol=h('span',{'aria-hidden':'true',style:'display:inline-block;flex:none;width:20px;height:'+(l.form==='linie'?'3px':'20px')+
            ';border-radius:'+(l.form==='ring'||l.form==='zone'?'50%':'2px')+';background:'+(l.form==='linie'?l.farbe:'transparent')+
            ';border:'+(l.form==='ring'||l.form==='zone'?'2px '+(l.name==='Auswahl'?'solid ':'dashed ')+l.farbe:'0')+';box-sizing:border-box;'});
        }
        const input=l.filter?h('input',{type:'checkbox',id:'k-v2-eb-'+l.filter,checked:ebeneAktiv(l.filter),
          onchange:e=>ebeneWaehlen(l.filter,e.target.checked)}):null;
        box.appendChild(h(l.filter?'label':'div',{style:'display:flex;gap:8px;align-items:center;min-height:24px;'},
          input,symbol,h('span',null,l.name)));
      }
    }
    for(const l of KARTE_V2_RENDERER.legende){
      if(!l.filter)continue;const el=$('k-v2-eb-'+l.filter);
      if(el)el.checked=ebeneAktiv(l.filter);
    }
  }
  function ebeneAktiv(key){
    const v=VIEW.karte.ebenen[key];
    return ['pins','zonen','sichtungen'].includes(key)?v!==false:!!v;
  }
  function ebeneWaehlen(key,wert){
    if(!aktiv(kontext)||!KARTE_V2_RENDERER.legende.some(l=>l.filter===key))return;
    VIEW.karte.ebenen[key]=!!wert;
    // Explicitly hiding sightings also clears the targeted-sighting exception.
    if(key==='sichtungen'&&!wert)VIEW.karte.sichtungFokus=null;
    // Use existing in-memory filters; no new V2 persistence (including key).
    const alt=$('ke-'+key);if(alt)alt.checked=!!wert;
    karteRendererDatenAktualisieren();karteAuswahlAnzeige();karteStatusAkt();legendeAktualisieren();
  }
  function kameraAnzeige(c){
    if(!aktiv(c)||!c.map)return;
    const el=$('k-v2-kamera'),p=bildPosition(c);
    if(el)el.textContent=p[1].toFixed(5)+', '+p[0].toFixed(5)+' · Zoom '+c.map.getZoom().toFixed(2)+' · Neigung '+c.map.getPitch().toFixed(0)+'°';
  }
  function werkzeugAnzeige(){
    const K=VIEW.karte;
    for(const [id,aktiv,txt] of [
      ['pin',K.pinSetzen,K.pinSetzen?'Pin: auf Karte klicken':'Pin setzen'],
      ['zone',K.zoneSetzen==='eigen',K.zoneSetzen==='eigen'?'Zone: auf Karte klicken':'Zone markieren'],
      ['messen',K.messen,K.messen?'Messen beenden':K.messPts.length?'Messung löschen':'Messen']
    ]){
      const b=$('k-v2-werkzeug-'+id);
      if(b){b.disabled=!kontext?.a;b.textContent=txt;b.setAttribute('aria-pressed',String(!!aktiv));}
    }
  }
  const normalHoehe='clamp(420px,60vh,850px)';
  const vollHoehe='max(280px,calc(100vh - 230px))';
  function layout(c){
    const panel=$('k-v2-panel'),el=$('k-v2-map'),b=$('k-v2-voll');
    if(!panel||!el||!b)return;
    panel.style.cssText=voll?'position:fixed;inset:30px 0 0;z-index:80;margin:0;overflow:auto;background:var(--panel);box-sizing:border-box;':'';
    panel.dataset.voll=String(voll);
    el.style.height=voll?vollHoehe:normalHoehe;
    b.setAttribute('aria-pressed',String(voll));
    b.textContent=voll?'Vollbild verlassen (Esc)':'Vollbild';
    if(aktiv(c)&&c.a){c.a.resize();kameraAnzeige(c);}
  }
  function vollWaehlen(wert){
    const c=kontext;if(!aktiv(c)||!c.a)return;
    voll=!!wert;layout(c);$('k-v2-voll')?.focus({preventScroll:true});
  }
  function ansicht(){
    if(!dev)return null;
    return h('section',{class:'panel',id:'k-v2-panel'},
      h('div',{class:'pad',style:'display:flex;flex-direction:column;gap:10px;'},
        h('div',{style:'display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;'},
          h('strong',null,'Lagekarte · MapLibre'),h('small',null,'Entwicklungsansicht'),
          h('button',{type:'button',id:'k-v2-voll',disabled:true,'aria-pressed':String(voll),onclick:()=>vollWaehlen(!voll)},voll?'Vollbild verlassen (Esc)':'Vollbild')),
        h('div',{style:'display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start;'},
          gruppe('Basiskarte',Object.keys(namen).map(n=>h('button',{type:'button',id:'k-v2-'+n,disabled:true,'aria-pressed':String(n==='leer'),onclick:()=>wechseln(kontext,n)},namen[n]))),
          gruppe('Ansicht',[
            h('button',{type:'button',id:'k-v2-flach',disabled:true,'aria-pressed':'true',onclick:()=>neigung(kontext,0)},'2D'),
            h('button',{type:'button',id:'k-v2-geneigt',disabled:true,'aria-pressed':'false',onclick:()=>neigung(kontext,60)},'3D-Neigung'),
            h('button',{type:'button',id:'k-v2-gebaeude',disabled:true,'aria-pressed':'false',onclick:()=>gebaeudeUmschalten(kontext)},'Gebäude')])),
        h('div',{id:'k-v2-bildwahl-zeile',hidden:true},
          h('label',{for:'k-v2-bildwahl'},'Bildquelle '),
          h('select',{id:'k-v2-bildwahl',disabled:true,onchange:e=>bildManuell(e.target.value)},h('option',{value:'auto'},'Automatisch'))),
        gruppe('Werkzeuge',[
          ...['pin','zone','messen'].map((art,i)=>h('button',{type:'button',id:'k-v2-werkzeug-'+art,disabled:true,'aria-pressed':'false',
            onclick:()=>{if(aktiv(kontext)&&kontext.a)karteWerkzeugWaehlen(art);}},['Pin setzen','Zone markieren','Messen'][i]))]),
        h('details',{id:'k-v2-legende',style:'border:1px solid var(--border);padding:6px 10px;'},
          h('summary',{style:'cursor:pointer;'},'Rechercheebenen und Legende'),
          h('div',{id:'k-v2-legendenliste',style:'display:grid;grid-template-columns:repeat(auto-fit,minmax(155px,1fr));gap:4px 12px;margin:6px 0;'}),
          h('small',null,'Objekte werden nach den vorhandenen Zugriffs- und Ebenenfiltern angezeigt. Basiskartenbeschriftungen sind davon unabhängig.'))),
      h('div',{id:'k-v2-map',style:'position:relative;width:100%;height:clamp(420px,60vh,850px);min-height:240px;background:#101820;border:1px solid var(--border);'}),
      h('div',{class:'pad',style:'display:flex;flex-direction:column;gap:4px;border-bottom:1px solid var(--border);'},
        h('div',{id:'k-v2-kamera',style:'font-size:11px;font-variant-numeric:tabular-nums;'},'Kamera wird geladen.'),
        h('p',{class:'note',id:'k-v2-status',role:'status',style:'margin:0;'},'Vergleichsansicht wird geladen. Keine Basiskartenanfragen.')),
      h('div',{id:'k-v2-paneele',style:'display:flex;flex-wrap:wrap;align-items:flex-start;gap:12px;padding:12px;'},
        h('div',{class:'k-status',id:'k-status','aria-label':'Lage',style:'position:static;max-width:none;width:auto;flex:1 1 240px;box-sizing:border-box;'}),
        h('div',{class:'k-popup',id:'k-auswahl',hidden:true,'aria-live':'polite',style:'position:static;transform:none;width:auto;flex:1 1 320px;max-height:55vh;box-sizing:border-box;'})),
      h('details',{class:'pad',style:'border-top:1px solid var(--border);'},h('summary',null,'Technische Hinweise und Diagnose'),
        h('p',{class:'note'},'Masken und Zentrieren wirken derzeit auf die alte Lagekarte. Die gemeinsame Kamera folgt in K4.'),
        h('p',{class:'note'},'3D-Gebäude ab Zoom 15: Anbieterhöhen (können geschätzt sein), fehlende oder unplausible Werte bleiben flach. Keine eigene Höhenschätzung.'),
        h('button',{type:'button',id:'k-v2-qualitaet',onclick:qualitaetsbericht},'Qualitätsbericht'),
        h('textarea',{id:'k-v2-qualitaetsbericht',hidden:true,readonly:true,rows:8,'aria-label':'Redigierter Qualitätsbericht',style:'display:none;width:100%;margin-top:8px;'}),
        h('p',null,'Bei Online-Auswahl sieht der Anbieter Kartenausschnitt und IP, CARTO zusätzlich den Schlüssel. Attributionen stehen auf der Karte. © OpenStreetMap-Mitwirkende, © CARTO.')));
  }
  function qualitaetsbericht(){
    const c=kontext,feld=$('k-v2-qualitaetsbericht');
    if(!aktiv(c)||!c.a||!feld)return;
    const out=['SHADOW / K2f – Qualitätsstichprobe','Modus: '+namen[c.modus],
      'Zoom: '+c.map.getZoom().toFixed(2)+' · Neigung: '+c.map.getPitch().toFixed(1),
      'Bildquelle: '+(KARTE_V2_QUELLEN.bildInfo(c.bildQuelle)?.name||'keine'),
      'Status: '+c.status.textContent,
      'Nur Renderfragmente; keine eindeutige Objektzählung oder Sichtbarkeits-/Qualitätsgarantie.'];
    try{
      const d=KARTE_V2_DIAGNOSE.renderDetails(c.map);
      if(d)for(const [k,v] of Object.entries(d))out.push(k+': '+v.layer+' aktive Layer; '+v.fragmente+' Renderfragmente');
      else out.push('Keine eindeutige Vektorquelle.');
      const a=KARTE_V2_DIAGNOSE.adressDetails(c.map);
      if(a){
        out.push('Adressdaten: '+a.geprueft+'/'+a.gesamt+' Gebäudefragmente geprüft; nummerierte Punkte '+a.punkt+', Polygone '+a.polygon+', sonstige '+a.sonstige+'; kind=address '+a.kindAddress);
        for(const [i,l] of a.layer.entries()){
          out.push('Adresslayer '+(i+1)+': Zoom '+l.min+'–'+l.max+', sichtbar '+(l.sichtbar?'ja':'nein')+', Geometriefilter '+(l.geometrieFilter?'ja':'nein')+', kind-Filter '+(l.kindFilter?'ja':'nein')+', Nummernfilter '+(l.nummerFilter?'ja':'nein'));
          const st=l.stil;
          out.push('Adressstil '+(i+1)+': text-color '+st.farbe+' · text-halo-color '+st.halo+' · text-halo-width '+st.haloBreite+' · text-opacity '+st.opazitaet+' · text-size '+st.groesse+' · text-pitch-alignment '+st.neigung);
        }
        for(const [i,l] of a.extrusion.entries())out.push('Extrusionsstil '+(i+1)+': sichtbar '+(l.sichtbar?'ja':'nein')+' · fill-extrusion-color '+l.farbe+' · fill-extrusion-opacity '+l.opazitaet);
      }
      out.push('Kartenressourcen geladen: '+(c.map.areTilesLoaded()?'ja':'nein'));
    }catch(e){out.push('Renderstichprobe nicht auswertbar.');}
    feld.value=out.join('\n');feld.hidden=false;feld.style.display='block';
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
    c.a.setSelection(auswahl(m));legendeAktualisieren();werkzeugAnzeige();
  }
  function mitte(){
    if(!dev||document.body.classList.contains('locked')||STATE.ui.modul!=='karte'||VIEW.karte.reiter==='protokoll')return null;
    const c=kontext;
    if(aktiv(c)&&c.map){const p=bildPosition(c);return [p[1],p[0]];}
    // During a normal remount, keep the same reference until MapLibre is
    // ready. Never read a saved camera after access lock (session cleared).
    const p=sitzung?.kamera?.center;
    return Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)?[p[1],((p[0]%360+540)%360)-180]:null;
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
  // Fehler können nach dem letzten idle eintreffen. Erst nach Rückkehr
  // aus MapLibre's Ereigniskette prüfen; ein Repaint deckt noch laufende Tiles ab.
  // Nur Fehlerübergänge: Erfolgsfenster werden ausschließlich bei idle beendet.
  function fehlerAuswertungPlanen(c){
    if(!aktiv(c)||c.fehlerTimer!==null)return;
    const g=c.generation;
    c.fehlerTimer=setTimeout(()=>{
      c.fehlerTimer=null;
      if(!aktiv(c)||c.generation!==g)return;
      kachelAuswerten(c,true);
      if(aktiv(c)&&c.generation===g)c.map.triggerRepaint();
    },0);
  }
  function kachelAuswerten(c,nurFehler=false){
    if(!aktiv(c)||!c.a.ready())return;
    if(c.phase==='bild'){
      if(!c.map.areTilesLoaded())return;
      if(hybridIdle(c,nurFehler))return;
      if(!c.bildQuelle){bildStatus(c);return;}
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
      if(nurFehler)return;
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
        if(nurFehler)return;
        stop(c);c.phase='online';c.stilCache=c.stilKandidat;c.stilKandidat=null;gebaeudeKnoepfe(c);
      }else if(!c.kachelErfolg&&c.kachelFehler.size>=3){
        rueckfall(c,'CARTO-Ressource nicht verfügbar');return;
      }
      if(nurFehler)return;
      if(c.kachelErfolg){
        if(!c.kachelFehler.size)c.kachelWarnung=false;
        c.kachelFehler.clear();
      }
      c.kachelErfolg=false;onlineHinweis(c);
    }else if(!nurFehler&&c.phase==='lokal'&&!c.status.textContent.includes('bleiben verfügbar'))hinweis(c,'Lokale Objektlayer bereit · keine Basiskarte · Kamera vorläufig unabhängig.');
  }
  function mount(){
    if(!dev)return;
    const el=$('k-v2-map'),status=$('k-v2-status');
    if(!el||!status||document.body.classList.contains('locked'))return;
    if(kontext)unmount(true,true);
    const alt=sitzung;
    const c={el,status,map:null,a:null,modus:'leer',phase:'lokal',gebaeude:alt?.gebaeude||false,bildWahl:alt?.bildWahl||'auto',bildAusgefallen:alt?.bildAusgefallen?.slice()||[],bildQuelle:null,bildSourceId:null,hyb:null,key:'',stilCache:null,stilKandidat:null,generation:0,abort:null,timer:null,fehlerTimer:null};
    kachelReset(c);kontext=c;layout(c);
    c.vollTaste=e=>{
      if(!aktiv(c)||!voll||e.key!=='Escape'||e.defaultPrevented||$('dlg')?.open||$('regie')?.open)return;
      if(['INPUT','TEXTAREA','SELECT'].includes(e.target?.tagName)&&e.target.type!=='checkbox'&&e.target.type!=='radio')return;
      e.preventDefault();e.stopPropagation();vollWaehlen(false);
    };
    document.addEventListener('keydown',c.vollTaste,true);
    bibliothek().then(()=>{
      if(!aktiv(c))return;
      const K=VIEW.karte, sel=$('k-v2-bildwahl');
      if(sel)for(const q of KARTE_V2_QUELLEN.bildListe())sel.appendChild(h('option',{value:q.id},q.name));
      c.map=new maplibregl.Map({container:el,style:KARTE_V2_QUELLEN.leererStil(),
        ...(alt?.kamera||{center:[K.lon,Math.max(-85,Math.min(85,K.lat))],zoom:Math.max(1,Math.min(19,K.zoom-0.5))}),attributionControl:true,
        transformRequest:url=>KARTE_V2_QUELLEN.cartoRequest(url,c.key)});
      c.map.addControl(new maplibregl.NavigationControl({visualizePitch:true}),'top-right');
      c.map.addControl(new maplibregl.ScaleControl({maxWidth:100,unit:'metric'}),'bottom-left');
      let letzteMitte=mitte();
      c.map.on('dragstart',()=>{if(aktiv(c)){VIEW.karte.bezug=null;VIEW.karte.bezugRenderKey=null;}});
      c.map.on('moveend',()=>{
        if(!aktiv(c))return;
        gebaeudeKnoepfe(c);bildAktualisieren(c);kameraAnzeige(c);
        const jetzt=mitte();
        if(jetzt&&(!letzteMitte||jetzt.some((v,i)=>Math.abs(v-letzteMitte[i])>1e-9))){
          letzteMitte=jetzt;karteStatusAkt();
        }
      });
      c.a=KARTE_V2_RENDERER.adapter(c.map,{onClick:e=>klick(c,e),onError:t=>hinweis(c,t)});
      c.map.on('sourcedata',e=>{
        if(!aktiv(c)||!['kacheln','online','bild'].includes(c.phase))return;
        if((c.quellen.has(e.sourceId)||(c.hyb?.vektorId&&e.sourceId===c.hyb.vektorId))&&
           (c.kachelWarnung||c.ressourcenWarnung||c.hyb?.fehler?.size))fehlerAuswertungPlanen(c);
        if(e.tile?.state!=='loaded')return;
        if(c.hyb?.vektorId&&e.sourceId===c.hyb.vektorId){c.hyb.geladen=true;c.hyb.erfolg=true;clearTimeout(c.hyb.tileTimer);c.hyb.tileTimer=null;bildStatus(c);return;}
        if(!c.quellen.has(e.sourceId))return;
        c.kachelGeladen=true;c.kachelErfolg=true;
        if(c.phase==='bild')bildStatus(c);
      });
      c.map.on('error',e=>{
        if(!aktiv(c)||!['kacheln','online','bild'].includes(c.phase))return;
        if(hybridFehler(c,e)){if(e.sourceId===c.hyb?.vektorId)fehlerAuswertungPlanen(c);return;}
        if(e?.sourceId?.startsWith('shadow-v2-hybrid-'))return;
        if(kachelFehlerEintragen(c,e)){if(c.phase==='bild')bildStatus(c);fehlerAuswertungPlanen(c);return;}
        if(e?.sourceId?.startsWith(KARTE_V2_QUELLEN.BILD_ID+'-')){
          if(c.phase==='bild'&&e.sourceId===c.bildSourceId){c.ressourcenWarnung=true;bildStatus(c);fehlerAuswertungPlanen(c);}return;
        }
        if(e?.sourceId?.startsWith('shadow-v2-')){
          c.objektWarnung=true;hinweis(c,'Eigene Kartenlayer konnten nicht aufgebaut werden.');return;
        }
        if(c.phase==='bild'){
          if(!e?.sourceId){if(c.hyb?.stil)c.hyb.warnung=true;else if(c.bildQuelle)c.ressourcenWarnung=true;bildStatus(c);}
          return;
        }
        if(c.phase==='kacheln')rueckfall(c,'CARTO-Ressource nicht verfügbar');
        else {c.ressourcenWarnung=true;hinweis(c,namen[c.modus]+' · Kartenressource nicht verfügbar.');}
      });
      c.map.on('idle',()=>kachelAuswerten(c));
      knoepfe(c);gebaeudeKnoepfe(c);
      sync();karteStatusAkt();kameraAnzeige(c);
      $('k-v2-voll').disabled=false;layout(c);
      if(alt&&alt.modus!=='leer')wechseln(c,alt.modus,alt.modus==='hybrid'?alt.hybrid:alt.stilCache,true);
    }).catch(()=>{
      if(!aktiv(c))return;
      hinweis(c,'Lokale MapLibre-Ansicht nicht verfügbar. Bestehende Karte bleibt verfügbar.');
      try{unmount();}catch(e){/* Fehler darf Standardkarte nicht beeinflussen */}
    });
  }
  /* Nur für die Entwicklungsansicht; Rückgabe der Adapterreferenz zur Prüfung
     tatsächlicher Treffer und des Lebenszyklus, kein zusätzlicher Datenbestand. */
  root.KARTE_V2_DEV=Object.freeze({ansicht,mount,unmount,sync,mitte,aktiviert:dev,adapter:()=>aktiv(kontext)?kontext.a:null});
})(window);
