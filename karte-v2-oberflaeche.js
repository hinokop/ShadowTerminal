/* K4a: V2 presentation and controls. No provider fetch, no independent
   session or object store. All state and commands come from the controller. */
(function(root){
  'use strict';
  function erstellen({dev,namen,aktiv,getKontext,getVoll,setVoll,wechseln,bildManuell,bildPosition}){
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
  function gruppe(name,children){
    return h('div',{style:'display:flex;flex-direction:column;gap:4px;min-width:0;'},
      h('span',{style:'font-size:10px;letter-spacing:.08em;text-transform:uppercase;opacity:.72;'},name),
      h('div',{role:'group','aria-label':name,style:'display:flex;gap:5px;flex-wrap:wrap;align-items:center;min-width:0;'},children));
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
    if(!aktiv(getKontext())||!KARTE_V2_RENDERER.legende.some(l=>l.filter===key))return;
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
      if(b){b.disabled=!getKontext()?.a;b.textContent=txt;b.setAttribute('aria-pressed',String(!!aktiv));}
    }
    const mess=$('k-v2-messwert');
    if(mess){
      const pts=K.messPts;
      mess.hidden=!K.messen&&pts.length!==2;
      if(pts.length===2){
        const km=karteDistanz(pts[0],pts[1]);
        mess.textContent='Luftlinie: '+(km<1?Math.round(km*1000)+' m':km.toFixed(2).replace('.',',')+' km');
      }else mess.textContent=pts.length===1?'Zweiten Messpunkt wählen.':'Ersten Messpunkt wählen.';
    }
    if(getKontext()?.map)getKontext().map.getCanvas().style.cursor=(K.pick||K.pinSetzen||K.zoneSetzen||K.zugriffSetzen||K.messen)?'crosshair':'';
  }
  const normalHoehe='clamp(420px,60vh,850px)';
  const vollHoehe='max(280px,calc(100vh - 230px))';
  function layout(c){
    const panel=$('k-v2-panel'),el=$('k-v2-map'),b=$('k-v2-voll');
    if(!panel||!el||!b)return;
    panel.style.cssText=getVoll()?'position:fixed;inset:30px 0 0;z-index:80;margin:0;overflow:auto;background:var(--panel);box-sizing:border-box;':'';
    panel.dataset.voll=String(getVoll());
    el.style.height=getVoll()?vollHoehe:normalHoehe;
    b.setAttribute('aria-pressed',String(getVoll()));
    b.textContent=getVoll()?'Vollbild verlassen (Esc)':'Vollbild';
    if(aktiv(c)&&c.a){c.a.resize();kameraAnzeige(c);}
    kartePopupPos();
  }
  function vollWaehlen(wert){
    const c=getKontext();if(!aktiv(c)||!c.a)return;
    setVoll(!!wert);layout(c);$('k-v2-voll')?.focus({preventScroll:true});
  }
  function ansicht(){
    if(!dev)return null;
    return h('section',{class:'panel',id:'k-v2-panel'},
      h('div',{class:'pad',style:'display:flex;flex-direction:column;gap:8px;min-width:0;'},
        h('div',{style:'display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;'},
          h('strong',null,'Lagekarte · MapLibre'),h('small',null,'Entwicklungsansicht'),
          h('button',{type:'button',id:'k-v2-voll',disabled:true,'aria-pressed':String(getVoll()),onclick:()=>vollWaehlen(!getVoll())},getVoll()?'Vollbild verlassen (Esc)':'Vollbild')),
        h('div',{style:'display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start;'},
          gruppe('Basiskarte',Object.keys(namen).map(n=>h('button',{type:'button',id:'k-v2-'+n,disabled:true,'aria-pressed':String(n==='leer'),onclick:()=>wechseln(getKontext(),n)},namen[n]))),
          gruppe('Ansicht',[
            h('button',{type:'button',id:'k-v2-flach',disabled:true,'aria-pressed':'true',onclick:()=>neigung(getKontext(),0)},'2D'),
            h('button',{type:'button',id:'k-v2-geneigt',disabled:true,'aria-pressed':'false',onclick:()=>neigung(getKontext(),60)},'3D-Neigung'),
            h('button',{type:'button',id:'k-v2-gebaeude',disabled:true,'aria-pressed':'false',onclick:()=>gebaeudeUmschalten(getKontext())},'Gebäude')])),
        h('div',{id:'k-v2-bildwahl-zeile',hidden:true},
          h('label',{for:'k-v2-bildwahl'},'Bildquelle '),
          h('select',{id:'k-v2-bildwahl',disabled:true,onchange:e=>bildManuell(getKontext(),e.target.value)},h('option',{value:'auto'},'Automatisch'))),
        gruppe('Werkzeuge',[
          ...['pin','zone','messen'].map((art,i)=>h('button',{type:'button',id:'k-v2-werkzeug-'+art,disabled:true,'aria-pressed':'false',
            onclick:()=>{if(aktiv(getKontext())&&getKontext().a)karteWerkzeugWaehlen(art);}},['Pin setzen','Zone markieren','Messen'][i]))]),
        h('output',{id:'k-v2-messwert',role:'status',hidden:true,style:'font-size:13px;font-weight:600;font-variant-numeric:tabular-nums;'},''),
        h('details',{id:'k-v2-legende',style:'border:1px solid var(--border);padding:6px 10px;'},
          h('summary',{style:'cursor:pointer;'},'Rechercheebenen und Legende'),
          h('div',{id:'k-v2-legendenliste',style:'display:grid;grid-template-columns:repeat(auto-fit,minmax(min(155px,100%),1fr));gap:4px 12px;margin:6px 0;'}),
          h('small',null,'Objekte werden nach den vorhandenen Zugriffs- und Ebenenfiltern angezeigt. Basiskartenbeschriftungen sind davon unabhängig.'))),
      h('div',{id:'k-v2-buehne'},
        h('div',{id:'k-v2-map',style:'position:relative;width:100%;box-sizing:border-box;height:clamp(420px,60vh,850px);min-height:240px;background:#101820;border:1px solid var(--border);'}),
        h('div',{id:'k-v2-paneele'},
          h('div',{class:'k-status',id:'k-status','aria-label':'Lage'}),
          h('div',{class:'k-popup',id:'k-auswahl',hidden:true,'aria-live':'polite',role:'region','aria-label':'Objektinspektor'}))),
      h('div',{class:'pad',style:'display:flex;flex-direction:column;gap:4px;border-bottom:1px solid var(--border);'},
        h('div',{id:'k-v2-kamera',style:'font-size:11px;font-variant-numeric:tabular-nums;'},'Kamera wird geladen.'),
        h('p',{class:'note',id:'k-v2-status',role:'status',style:'margin:0;'},'Karte wird geladen. Shadow ist die Standardkarte.')),
      h('details',{class:'pad',style:'border-top:1px solid var(--border);'},h('summary',null,'Technische Hinweise und Diagnose'),
        h('p',{class:'note'},'Mitte, Zoom und Zentrieren sind mit der SVG-Lagekarte gekoppelt. Masken und die historische 3D-Ansicht folgen in K4.'),
        h('p',{class:'note'},'3D-Gebäude ab Zoom 15: Anbieterhöhen (können geschätzt sein), fehlende oder unplausible Werte bleiben flach. Keine eigene Höhenschätzung.'),
        h('button',{type:'button',id:'k-v2-qualitaet',onclick:qualitaetsbericht},'Qualitätsbericht'),
        h('textarea',{id:'k-v2-qualitaetsbericht',hidden:true,readonly:true,rows:8,'aria-label':'Redigierter Qualitätsbericht',style:'display:none;width:100%;margin-top:8px;'}),
        h('p',null,'Shadow lädt beim Kartenstart mit lokalem Schlüssel. Bei Online-Karten sieht der Anbieter Kartenausschnitt und IP, CARTO zusätzlich den Schlüssel. Attributionen stehen auf der Karte. © OpenStreetMap-Mitwirkende, © CARTO.')));
  }
  function qualitaetsbericht(){
    const c=getKontext(),feld=$('k-v2-qualitaetsbericht');
    if(!aktiv(c)||!c.a||!feld)return;
    const out=['SHADOW / K3 – Qualitätsstichprobe','Modus: '+namen[c.modus],
      'Zoom: '+c.map.getZoom().toFixed(2)+' · Neigung: '+c.map.getPitch().toFixed(1),
      'Bildquelle: '+(KARTE_V2_QUELLEN.bildInfo(c.bildQuelle)?.name||'keine'),
      'Kartenfläche: '+c.el.clientWidth+' × '+c.el.clientHeight+' CSS-Pixel · DPR '+(root.devicePixelRatio||1)+' · Vollbild '+(getVoll()?'ja':'nein'),
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
  return Object.freeze({knoepfe,gebaeudeKnoepfe,legendeAktualisieren,kameraAnzeige,werkzeugAnzeige,layout,vollWaehlen,ansicht});
  }
  root.KARTE_V2_OBERFLAECHE=Object.freeze({erstellen});
})(window);
