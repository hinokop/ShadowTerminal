'use strict';
// Diagnostic baseline, not a hardware-independent speed threshold.
// One local production renderer per fresh page; no profile or live provider.
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const os=require('node:os');
const {performance}=require('node:perf_hooks');
const round=n=>Math.round(n*100)/100;
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
 try{
  console.log('K4 Last Hardware: '+JSON.stringify({
    platform:os.platform(),arch:os.arch(),cpu:os.cpus()[0]?.model||null,
    logicalCpus:os.cpus().length,availableCpus:os.availableParallelism?.()||null,
    totalMemoryMiB:Math.round(os.totalmem()/1048576),browser:b.version(),
    graphics:'Chromium ANGLE/SwiftShader requested',viewport:[1100,800]
  }));
  for(const n of [100,1000]){
   const p=await b.newPage({viewport:{width:1100,height:800},reducedMotion:'no-preference',deviceScaleFactor:1});
   p.setDefaultTimeout(25000);
   const errors=[],net=[];p.on('pageerror',e=>errors.push(e.message));
   await p.route(/^https?:/,r=>{net.push(r.request().url());return r.abort();});
   try{
    await p.goto(pathToFileURL(path.join(__dirname,'geospatial-k4-last.html')).href);
    const cdp=await p.context().newCDPSession(p);
    const heap=async()=>{try{const h=await cdp.send('Runtime.getHeapUsage');return round(h.usedSize/1048576);}catch(e){return null;}};
    const heapBefore=await heap();
    const counts=await p.evaluate(n=>{
      const R=KARTE_V2_RENDERER,begin=performance.now();
      const map=new maplibregl.Map({container:'map',style:KARTE_V2_QUELLEN.leererStil(),
        center:[13.405,52.52],zoom:14,pitch:0,bearing:0,attributionControl:false,renderWorldCopies:false});
      const errors=[],clicks=[];let clickStart=null;
      map.getCanvas().addEventListener('click',e=>{clickStart=e.timeStamp;},true);
      map.on('error',()=>errors.push('map event'));
      const a=R.adapter(map,{onClick:e=>clicks.push({key:e.treffer?.renderKey||null,ll:e.treffer?.ll||null,
        ms:clickStart===null?null:performance.now()-clickStart}),onError:(_text,phase)=>errors.push('adapter '+phase)});
      const pointN=n*8/10,zoneN=n/10,edgeN=n/10;
      const ll=(x,y)=>{const q=map.unproject([x,y]);return [q.lat,q.lng];};
      // A regular grid with an isolated anchor at the centre, three
      // coincident points, dossier edges and actual circular geometries.
      const grid=[];
      for(let y=55;y<=745;y+=24)for(let x=55;x<=1045;x+=24)
        if(Math.hypot(x-550,y-400)>125)grid.push([x,y]);
      const marker=Array.from({length:pointN},(_,i)=>{
        const id='SYN-M-'+i,coord=i===0?[52.52,13.405]:ll(...grid[i-1]);
        const dossier=i>3&&i<=3+edgeN*2;
        return {id,renderKey:id,ll:coord,kat:dossier?'figur':i%7===0?'sichtung':'pin',
          ...(dossier?{entitaet:true,typ:i%2?'Person':'Organisation'}:i%7===0?{unM:{m:35}}:{})};
      });
      // Keep the anchor as a pin and intentionally exercise dense layout.
      marker[0].kat='pin';delete marker[0].unM;
      marker[2].ll=marker[1].ll.slice();marker[3].ll=marker[1].ll.slice();
      const zonen=Array.from({length:zoneN},(_,i)=>({id:'SYN-Z-'+i,renderKey:'SYN-Z-'+i,ll:marker[4+i].ll.slice(),r:40}));
      const kanten=Array.from({length:edgeN},(_,i)=>({id:'SYN-E-'+i,renderKey:'SYN-E-'+i,von:marker[4+2*i].id,nach:marker[5+2*i].id}));
      const model={marker,zonen,kanten},snapshot=R.daten(model),start=performance.now();
      a.setData(model);a.setSelection(marker[0].renderKey);
      window.__last={map,a,R,model,errors,clicks,begin,submitMs:performance.now()-start};
      return {points:snapshot.quellen.punkte.features.length,zones:snapshot.quellen.zonen.features.length,
        edges:snapshot.quellen.kanten.features.length,identities:snapshot.treffer.size};
    },n);
    assert.deepEqual(counts,{points:n*.8,zones:n*.1,edges:n*.1,identities:n});
    const anchorReady=()=>p.waitForFunction(()=>{
      const {map,a,model}=__last,m=model.marker[0];
      return a.ready()&&map.loaded()&&map.areTilesLoaded()&&a.hitTest(a.project(m.ll))?.renderKey===m.renderKey;
    });
    await anchorReady();
    const initial=await p.evaluate(()=>{
      const {map,begin,submitMs}=__last;
      return {firstRenderedMs:performance.now()-begin,submitMs,
        visibleMarkers:new Set(map.queryRenderedFeatures({layers:['shadow-v2-punkt']}).map(f=>f.properties.renderKey)).size};
    });
    assert.ok(initial.visibleMarkers>0&&initial.visibleMarkers<=counts.points);
    const heapLoaded=await heap();
    const bewegung=async art=>p.evaluate(async art=>{
      const {map,a}=__last,ids=['shadow-v2-punkte','shadow-v2-leit'],writes=[0,0],restore=[];
      for(const [i,id] of ids.entries()){
        const s=map.getSource(id),orig=s.setData;
        s.setData=function(...args){writes[i]++;return orig.apply(this,args);};
        restore.push(()=>{s.setData=orig;});
      }
      const start=performance.now(),frames=[];let last=start,raf,done=false,moveEvents=0;
      const onMove=()=>moveEvents++;map.on('move',onMove);
      function tick(now){if(done)return;frames.push(Math.max(0,now-last));last=now;raf=requestAnimationFrame(tick);}
      raf=requestAnimationFrame(tick);
      const before=a.camera();
      try{
        await new Promise(resolve=>{
          map.once('moveend',resolve);
          const opts={duration:900,essential:true};
          if(art==='pan')map.panBy([35,20],opts);
          else if(art==='zoom')map.easeTo({...opts,zoom:before.zoom+.5});
          else map.easeTo({...opts,pitch:45,bearing:20});
        });
        const after=a.camera(),elapsed=performance.now()-start;
        const sorted=frames.slice().sort((x,y)=>x-y),q=f=>sorted.length?sorted[Math.ceil(f*sorted.length)-1]:null;
        return {elapsedMs:elapsed,frameSamples:frames.length,moveEvents,frameP50Ms:q(.5),frameP95Ms:q(.95),
          frameMaxMs:sorted.at(-1)??null,writes,changed:art==='pan'?Math.hypot(after.center[0]-before.center[0],after.center[1]-before.center[1])>1e-6:
          art==='zoom'?after.zoom>before.zoom:after.pitch>before.pitch&&after.bearing!==before.bearing};
      }finally{done=true;cancelAnimationFrame(raf);map.off('move',onMove);restore.forEach(f=>f());}
    },art);
    const pan=await bewegung('pan'),zoom=await bewegung('zoom'),pitch=await bewegung('pitch');
    for(const m of [pan,zoom,pitch])assert.ok(m.changed&&m.moveEvents>0,'camera movement exercised');
    // No all-visible assertion: collisions, viewport and pitch change the
    // displayed set. The isolated anchor is a real rendered hit after reset.
    await p.evaluate(()=>__last.map.jumpTo({center:[13.405,52.52],zoom:14,pitch:0,bearing:0}));
    await anchorReady();
    const point=await p.evaluate(()=>{const {a,model}=__last;const q=a.project(model.marker[0].ll);return [q.x,q.y];});
    const startClick=performance.now();
    await p.mouse.click(...point);
    const clickRoundtripMs=performance.now()-startClick;
    const click=await p.evaluate(()=>__last.clicks.at(-1));
    assert.equal(click.key,'SYN-M-0');assert.deepEqual(click.ll,[52.52,13.405]);
    assert.ok(Number.isFinite(click.ms)&&click.ms>=0,'real click latency');
    const filtered=await p.evaluate(()=>{
      const {a,model}=__last,q=a.project(model.marker[0].ll),start=performance.now();
      a.setData({marker:[],zonen:[],kanten:[]});
      return {submitMs:performance.now()-start,stale:a.hitTest(q)};
    });
    assert.equal(filtered.stale,null,'removed object is not interactive even before worker completion');
    await p.waitForFunction(()=>__last.map.loaded()&&__last.map.queryRenderedFeatures({layers:['shadow-v2-punkt']}).length===0);
    await p.evaluate(()=>{__last.restoreStart=performance.now();__last.a.setData(__last.model);});
    await anchorReady();
    const restoredMs=await p.evaluate(()=>performance.now()-__last.restoreStart);
    const heapAfter=await heap();
    assert.deepEqual(await p.evaluate(()=>__last.errors),[]);
    assert.deepEqual(net,[],'no provider request');assert.deepEqual(errors,[]);
    const stats={objects:n,...counts,initial,pan,zoom,pitch,click:{handlerMs:click.ms,roundtripMs:clickRoundtripMs},
      filterSubmitMs:filtered.submitMs,restoredMs,mainJsHeapMiB:{before:heapBefore,loaded:heapLoaded,after:heapAfter},httpRequests:net.length};
    // Main-thread V8 heap only; not process, worker or GPU memory.
    console.log('K4 Last Messung: '+JSON.stringify(stats));
    await p.evaluate(()=>{__last.a.unmount();__last.map.remove();delete window.__last;});
    await cdp.detach();
   }finally{await p.close();}
  }
 }finally{await b.close();}
 console.log('OK: synthetische lokale Last mit 100 und 1000 Objekten, Kamerabewegungen, Klick, Filter und Wiederherstellung');
})().catch(e=>{console.error(e);process.exitCode=1;});
