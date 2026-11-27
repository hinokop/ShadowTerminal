/* K4a: provider state machine, cache, requests and health. Factory has no
   network or DOM side effects; the controller owns the active context. */
(function(root){
  'use strict';
  function erstellen({namen,aktiv,hinweis,sync,knoepfe,gebaeudeKnoepfe}){
  const lokalKey=()=>typeof VIEW.karte.cartoKey==='string'?VIEW.karte.cartoKey.trim():'';
  const STIL_RAM_MS=10*60*1000; // bounded reuse in session RAM
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
  function bildManuell(c,wahl){
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
      const basis=Q.gebaeudeStil(s,n==='shadow',c.gebaeude);
      const stil=n==='shadow'?Q.shadowStil(basis):basis;
      if(Q.styleCachebar(s,key)){
        c.stilKandidat={modus:n,zeit,stil:s};
        if(cacheTreffer)c.stilCache=c.stilKandidat; // bereits in dieser Sitzung online bewährt
      }
      c.quellen=new Set(Object.entries(stil.sources).filter(([,q])=>q.type==='vector').map(([id])=>id));
      c.phase='kacheln';c.a.setStyle(stil);sync();
    }catch(e){if(aktiv(c)&&c.generation===g)rueckfall(c,'CARTO-Stil nicht verfügbar');}
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
  function ereignisse(c){
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
  }
  return Object.freeze({lokalKey,stop,hybridStop,kachelReset,bildPosition,bildAktualisieren,bildManuell,wechseln,ereignisse});
  }
  root.KARTE_V2_QUELLENSTEUERUNG=Object.freeze({erstellen});
})(window);
