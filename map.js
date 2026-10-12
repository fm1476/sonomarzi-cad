/* CAD v19.3 - situational awareness map. Positions are simulated; no AVL integration. */
(()=>{
const host=document.getElementById('map');if(!host)return;
const center=[38.2324,-122.6367], cityZoom=12, incidentZoom=16;
const configKey='smcad-map-display-v19.3',cacheKey='smcad-geocode-v14';
let settings={incidents:'active',satellite:false};try{settings={...settings,...JSON.parse(localStorage.getItem(configKey)||'{}')}}catch{}
let cache={};try{cache=JSON.parse(localStorage.getItem(cacheKey)||'{}')}catch{}
let map,unitsLayer,incidentLayer,hydrantLayer,leaderLayer,osm,satellite,drawId=0,selectedKey='',focused=false;
let hydrantsVisible=false, hydrantItems=[], hydrantScope='';
let gisCatalog=null;
// Query view is deliberately transient: redraws honor it, but CAD data is unchanged.
let queryView=null;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const statusSlug=s=>String(s||'UNKNOWN').toLowerCase().replace(/[^a-z0-9]+/g,'-');
const statusColors={available:'#34cf83',dispatched:'#af8bff',enroute:'#55b0ff',onscene:'#f4ab4c','on-scene':'#f4ab4c',code4:'#4ad2ce','code-4':'#4ad2ce','available-on-scene':'#95d471',clear:'#91a2b9',transporting:'#e38ad5','at-hospital':'#e18aa7','out-of-service':'#ef7382'};
function color(s){return statusColors[statusSlug(s)]||'#bdc9d6'}
function kind(u){const id=String(u.id||'').toUpperCase();if(u.discipline==='EMS'||/^M\d/.test(id))return 'ems';if(u.discipline==='FIRE'||/^(?:E|T|B|R)\d/.test(id))return 'fire';if(/S(?:O|H)|SHERIFF/i.test(String(u.agency||'')+' '+id))return 'sheriff';return 'police'}
function symbol(u){const id=String(u.id||'').toUpperCase(),k=kind(u);if(k==='ems')return '✚';if(k==='fire')return /^T\d/.test(id)?'🚒':/^B\d/.test(id)?'◆':/^R\d/.test(id)?'⛑':'🚒';if(k==='sheriff')return '★';return '⬟'}
function demoPoint(u){const x=Number(u.x)||50,y=Number(u.y)||50;return [center[0]+(50-y)*.00048,center[1]+(x-50)*.00067]}
function assignedIncident(unit){return (state.incidents||[]).find(i=>(i.units||[]).includes(unit.id)&&i.status!=='CLOSED')}
function unitIcon(u){const k=kind(u),hex=color(u.status);return L.divIcon({className:'cad-map-unit-wrap',html:`<span class="cad-map-unit cad-map-${k}" style="--cad-status:${hex}" title="${esc(u.id)} — ${esc(u.status)}"><span class="cad-map-unit-symbol">${symbol(u)}</span><span class="cad-map-unit-id">${esc(u.id)}</span></span>`,iconSize:[62,27],iconAnchor:[31,13]})}
function incidentIcon(i){const p=String(i.priority||'P3').toUpperCase(),k=String(i.discipline||'LAW').toLowerCase();const glyph=k==='FIRE'?'🔥':k==='EMS'?'✚':k==='fire'?'🔥':k==='ems'?'✚':'!';return L.divIcon({className:'cad-map-call-wrap',html:`<span class="cad-map-call cad-map-call-${k} cad-map-call-${p.toLowerCase()}"><b>${glyph}</b><small>${esc(p)} · ${esc(i.id.slice(-4))}</small></span>`,iconSize:[68,27],iconAnchor:[34,13]})}
function setResult(text){const el=document.getElementById('cadMapAnswer');if(el)el.textContent=text}
function persist(){localStorage.setItem(configKey,JSON.stringify(settings))}
function init(){if(map||!window.L)return;host.innerHTML='';map=L.map(host,{zoomControl:true,scrollWheelZoom:false}).setView(center,cityZoom);
 osm=L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'});
 satellite=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'Imagery &copy; Esri and contributors'});
 (settings.satellite?satellite:osm).addTo(map);incidentLayer=L.layerGroup().addTo(map);unitsLayer=L.layerGroup().addTo(map);hydrantLayer=L.layerGroup().addTo(map);leaderLayer=L.layerGroup().addTo(map);
 const nav=L.control({position:'topleft'});nav.onAdd=()=>{const wrap=L.DomUtil.create('div','leaflet-bar leaflet-control');const home=L.DomUtil.create('a','cad-map-home',wrap);home.href='#';home.title='Home: Petaluma city view';home.textContent='⌂';const imagery=L.DomUtil.create('a','cad-map-home cad-map-satellite',wrap);imagery.href='#';imagery.title='Toggle satellite imagery';imagery.textContent='◈';L.DomEvent.disableClickPropagation(wrap);L.DomEvent.on(home,'click',e=>{L.DomEvent.preventDefault(e);focused=false;map.setView(center,cityZoom)});L.DomEvent.on(imagery,'click',e=>{L.DomEvent.preventDefault(e);toggleImagery()});return wrap};nav.addTo(map);
 const note=L.control({position:'bottomleft'});note.onAdd=()=>{const el=L.DomUtil.create('div','cad-map-note');el.textContent='SIMULATED UNIT POSITIONS • NOT LIVE AVL';return el};note.addTo(map);
 gisCatalog=window.CadMapLayerCatalog?.(map,{showHydrants:()=>showHydrants(),hideHydrants:()=>hideHydrants(),setResult});
 map.on('moveend zoomend',()=>{if(hydrantsVisible){if(hydrantScope==='viewport')void showHydrants();else drawHydrants()}});requestAnimationFrame(()=>map.invalidateSize());}
function toggleImagery(){settings.satellite=!settings.satellite;persist();if(!map)return;map.removeLayer(settings.satellite?osm:satellite);(settings.satellite?satellite:osm).addTo(map);(settings.satellite?satellite:osm).bringToBack();setResult(settings.satellite?'Satellite imagery enabled.':'Street map enabled.')}
async function geocode(address){const original=String(address||'').trim(),place=window.cadCommonPlaces?.resolve(original),query=place?.address||original,key=query.toLowerCase();if(place?.coordinates?.length===2)return place.coordinates;if(!query)return null;if(cache[key])return cache[key];try{const r=await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us&q='+encodeURIComponent(query+', Petaluma, California'),{headers:{Accept:'application/json'}});if(r.ok){const rows=await r.json();if(rows.length){const pos=[Number(rows[0].lat),Number(rows[0].lon)];cache[key]=pos;localStorage.setItem(cacheKey,JSON.stringify(cache));return pos}}}catch(e){console.warn('Map location not found',e)}return null}
async function updateUnitCoords(id,address){
 const u=(state.units||[]).find(x=>x.id===id);if(!u||u.location!==address)return;
 const coords=await geocode(address);if(!coords){u.mapLocationPending=true;setResult(`Location saved for ${id}, but ${address} could not be geocoded. Map still uses its approximate point.`);return;}
 if(u.location!==address)return;u.mapCoords=coords;u.mapLocationPending=false;localStorage.setItem(KEY,JSON.stringify(state));void draw();
}
window.cadResolveUnitAddress=(id,address)=>{void updateUnitCoords(id,address)};
const meters=(a,b)=>{const r=Math.PI/180,dlat=(b[0]-a[0])*r,dlon=(b[1]-a[1])*r,la1=a[0]*r,la2=b[0]*r;return 6371000*2*Math.asin(Math.sqrt(Math.sin(dlat/2)**2+Math.cos(la1)*Math.cos(la2)*Math.sin(dlon/2)**2))};
function hydrantText(){const el=document.querySelector('#cadLayersMount input[data-layer="hydrants"]');if(el)el.checked=hydrantsVisible}
async function showHydrants(incident=null){
 init();setResult('Loading City of Petaluma hydrants for this map area…');
 // Toggling the layer must never alter the operator's existing map extent.
 // A location-specific request moves to the incident first and only loads local hydrants.
 let coords=null;
 if(incident){coords=await geocode(incident.location);if(!coords){setResult(`Cannot locate ${incident.id}; hydrant layer not changed.`);return}
  map.setView(coords,16);queryView={units:new Set(),incidents:new Set([incident.id]),label:'hydrants'};focused=true;updateReset();await draw();
 }
 const viewCenter=incident?coords:[map.getCenter().lat,map.getCenter().lng];
 // Query an area around the present map center rather than the entire municipality.
 // The backend caps the radius at 1500m; map bounds additionally hide off-screen results.
 const bounds=map.getBounds();const edge=[bounds.getNorth(),bounds.getEast()];
 const radius=incident?650:Math.min(1500,Math.max(150,Math.ceil(meters(viewCenter,edge))));
 const scope=incident?`near:${incident.id}:${incident.location}`:'viewport';
 try{
  const q=`mode=near&lat=${encodeURIComponent(viewCenter[0])}&lon=${encodeURIComponent(viewCenter[1])}&radius=${radius}`;
  const res=await fetch('/.netlify/functions/hydrants?'+q);const json=await res.json();if(!res.ok)throw new Error(json.error||'GIS query failed');
  hydrantItems=(json.features||[]).filter(f=>f.geometry?.type==='Point'&&Array.isArray(f.geometry.coordinates));hydrantsVisible=true;hydrantScope=scope;drawHydrants();hydrantText();
  setResult(`${hydrantItems.length} mapped hydrants retrieved near ${incident?incident.id:'the current map view'}; only those in the visible map area are displayed. No automatic zoom. Reference only.`);
 }catch(err){setResult(`Hydrant layer unavailable: ${err.message}`)}
}
function drawHydrants(){if(!hydrantLayer||!window.L)return;hydrantLayer.clearLayers();if(!hydrantsVisible)return;
 for(const f of hydrantItems){const p=f.properties||{},xy=f.geometry.coordinates;
  if(!map.getBounds().contains([xy[1],xy[0]]))continue;
 const icon=L.divIcon({className:'cad-hydrant-wrap',html:'<span class="cad-hydrant-symbol" title="Mapped hydrant">H</span>',iconSize:[18,18],iconAnchor:[9,9]});
 const m=L.marker([xy[1],xy[0]],{icon,interactive:true});m.bindPopup(`<b>💧 Hydrant ${esc(p.FACILITYID||'Unspecified')}</b><br>${esc(p.LOCDESC||'Location description unavailable')}<br>PSI: ${p.PSI??'Not listed'}<br>City GIS reference; not field verified.`);m.addTo(hydrantLayer)}
}
function hideHydrants(silent=false){hydrantsVisible=false;hydrantItems=[];hydrantScope='';hydrantLayer?.clearLayers();hydrantText();if(queryView?.label==='hydrants'){queryView=null;focused=false;updateReset();void draw()}if(!silent)setResult('Hydrants hidden.')}
function findMentionedIncident(q){const all=(state.incidents||[]).filter(i=>i.status!=='CLOSED');
 const num=q.match(/(?:event|call|incident|cfs|#)\s*#?\s*(\d{4,6}|\d{2}-\d{5,6})/i);
 if(num){const matches=all.filter(i=>i.id===num[1]||i.id.endsWith(num[1]));if(matches.length===1)return matches[0]}
 const normalized=s=>String(s||'').toLowerCase().replace(/\b(street|st\.?|avenue|ave\.?|road|rd\.?|boulevard|blvd\.?)\b/g,'').replace(/[^a-z0-9]/g,'');
 const nq=normalized(q);const matching=all.filter(i=>{const addr=normalized(i.location);return addr.length>5&&nq.includes(addr)});return matching.length===1?matching[0]:null;
}
function eligibleIncidents(){return (state.incidents||[]).filter(i=>settings.incidents==='both'?['ACTIVE','PENDING'].includes(i.status):i.status===settings.incidents.toUpperCase())}
function visibleUnits(){const discipline=window.cadUnitDisciplineFilter||'ALL';return (state.units||[]).filter(u=>(discipline==='ALL'||u.discipline===discipline)&&(!queryView||queryView.units.has(u.id.toUpperCase())))}
function visibleIncidents(){return queryView?(state.incidents||[]).filter(i=>queryView.incidents.has(i.id)):eligibleIncidents()}
function setQueryView(units,incidents,label){queryView={units:new Set(units.map(u=>u.id.toUpperCase())),incidents:new Set(incidents.map(i=>i.id)),label};focused=true;return draw().then(()=>{const markers=[...markerByUnit.values(),...markerByIncident.values()];if(markers.length){map.fitBounds(L.latLngBounds(markers.map(m=>m.getLatLng())).pad(.35),{maxZoom:16});if(markers.length===1)markers[0].openPopup()}setResult(`${incidents.length} call${incidents.length===1?'':'s'} and ${units.length} unit${units.length===1?'':'s'}: ${label}.`);updateReset()})}
function updateReset(){const button=document.getElementById('cadMapResetQuery');if(button)button.hidden=!queryView}
function resetQuery(){hideHydrants(true);queryView=null;focused=false;selectedKey='';updateReset();void draw();setResult('Normal map view restored.')}
let markerByUnit=new Map(),markerByIncident=new Map();
function offsetPoint(coords,key){const h=[...String(key)].reduce((n,c)=>((n*31+c.charCodeAt(0))>>>0),7);const angle=((h%360)*Math.PI)/180;const d=0.00012;return [coords[0]+Math.cos(angle)*d,coords[1]+Math.sin(angle)*d/Math.max(.5,Math.cos(coords[0]*Math.PI/180))]}
function addLeader(origin,offset){if(!leaderLayer)return;L.circleMarker(origin,{radius:2.5,fillOpacity:.85,color:'#e6f4ff',weight:1,interactive:false}).addTo(leaderLayer);L.polyline([origin,offset],{color:'#d1e9ff',opacity:.75,weight:1.3,interactive:false}).addTo(leaderLayer)}
async function draw(){init();if(!map)return;const id=++drawId;markerByUnit=new Map();markerByIncident=new Map();unitsLayer.clearLayers();incidentLayer.clearLayers();leaderLayer?.clearLayers();drawHydrants();
 for(const u of visibleUnits()){const linked=assignedIncident(u);const coords=Array.isArray(u.mapCoords)&&u.mapCoords.length===2?u.mapCoords:demoPoint(u);const marker=L.marker(offsetPoint(coords,u.id),{icon:unitIcon(u),riseOnHover:true});marker.bindPopup(`<strong>${esc(u.id)}</strong> • ${esc(kind(u).toUpperCase())}<br>Status: <b>${esc(String(u.status).replaceAll('_',' '))}</b><br>Reported location: ${esc(u.location||'Not reported')}<br>Mapped position: ${Array.isArray(u.mapCoords)?'geocoded reported location (not live AVL)':'simulated (not live AVL)'}<br>Call: ${linked?esc(linked.id+' — '+linked.type):'Not assigned'}${linked?`<br>Address: ${esc(linked.location)}`:''}`);marker.addTo(unitsLayer);addLeader(coords,marker.getLatLng());markerByUnit.set(u.id.toUpperCase(),marker)}
 const selected=(state.incidents||[]).find(i=>i.id===state.selected);const requests=visibleIncidents();if(!queryView&&selected&&!requests.includes(selected))requests.push(selected);
 for(const i of requests){const pos=await geocode(i.location);if(id!==drawId)return;if(!pos)continue;const marker=L.marker(offsetPoint(pos,i.id),{icon:incidentIcon(i),zIndexOffset:i.status==='ACTIVE'?250:0});marker.bindPopup(`<b>${esc(i.id)} • ${esc(i.type)}</b><br>${esc(i.discipline)} • ${esc(i.priority)} • ${esc(i.status)}<br>${esc(i.location)}<br>Assigned: ${esc((i.units||[]).join(', ')||'None')}<br><small>Geocoded address; verify for operations.</small>`).on('click',()=>{state.selected=i.id;window.renderDetail?.()});marker.addTo(incidentLayer);addLeader(pos,marker.getLatLng());markerByIncident.set(i.id,marker)}
 if(selected&&!focused){const key=selected.id+'|'+selected.location;if(key!==selectedKey){selectedKey=key;const marker=markerByIncident.get(selected.id);if(marker)map.flyTo(marker.getLatLng(),incidentZoom,{duration:.5})}}
 map.invalidateSize({pan:false})}
async function focusMarkers(markers,labelText){
 const unitIds=new Set([...markerByUnit].filter(([,m])=>markers.includes(m)).map(([id])=>id));
 const incidentIds=new Set([...markerByIncident].filter(([,m])=>markers.includes(m)).map(([id])=>id));
 return setQueryView((state.units||[]).filter(u=>unitIds.has(u.id.toUpperCase())),(state.incidents||[]).filter(i=>incidentIds.has(i.id)),labelText);
}
const norm=s=>String(s||'').toLowerCase().replace(/\bthree\s+adam\s+(twenty\s+one|21)\b/g,'3a21').replace(/\bthree\s+adam\s+(twelve|12)\b/g,'3a12').replace(/\bengine\s+(one|two|three|1|2|3)\b/g,(_,n)=>'e'+({one:1,two:2,three:3}[n]||n)).replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
async function ask(raw){
 const question=norm(raw);setResult(`Heard: ${raw}`);
 // Explicit navigation questions intentionally pan/zoom, unlike layer visibility commands.
 if(/\b(?:zoom (?:in )?(?:to|on)|go to|take me to|navigate to|center (?:on|at)|show me (?:the )?(?:location|address) (?:of|at)?|find (?:the )?(?:address|location) (?:of|at)?)\b/i.test(question)||/^(?:show me|find|locate)\s+(?:\d+\s+[^,]+|(?:event|incident|call|cfs)\s*#?\d{4,6})$/i.test(String(raw).trim())){
  const selectedEvent=findMentionedIncident(raw);
  const eventNum=raw.match(/(?:event|incident|call|cfs|#)\s*#?\s*(?:\d{2}-)?(\d{4,6})/i);
  let incident=selectedEvent;
  if(eventNum&&!incident){const matches=(state.incidents||[]).filter(i=>i.id.endsWith(eventNum[1]));if(matches.length===1)incident=matches[0];else if(matches.length>1){setResult('More than one event matches that number. Please use the full event ID.');return}}
  let label=incident?.location||'';
  if(!label){label=String(raw).replace(/^.*?\b(?:zoom (?:in )?(?:to|on)|go to|take me to|navigate to|center (?:on|at)|show me (?:the )?(?:location|address) (?:of|at)?|find (?:the )?(?:address|location) (?:of|at)?)\b/i,'').replace(/^\s*(?:the|at|of|on|to)\s+/i,'').replace(/^(?:show me|find|locate)\s+/i,'').replace(/[?.!,]+$/,'').trim()}
  if(!label){setResult('Tell me a street address, Common Place, or event number to locate.');return}
  if(!incident&&/^(?:event|incident|call|cfs)\b/i.test(label)){setResult('That event was not uniquely identified. Please use the complete event number.');return}
  const coordinates=await geocode(label);
  if(!coordinates){setResult(`Could not geocode ${label}. No map movement made.`);return}
  init();focused=true;map.setView(coordinates,17);setResult(`Centered map on ${incident?incident.id+' — ':''}${label}. Position from GIS geocoding; verify before operational use.`);return;
 }
 if(gisCatalog&&await gisCatalog.voice(raw))return;
 if(/\b(hydrant|hydrants)\b/.test(question)){
  if(/\b(hide|remove|clear|turn off)\b/.test(question)){hideHydrants();return}
  const isAll=/\ball\b/.test(question)&&!/\b(event|incident|call|cfs)\b/.test(question);
  const target=isAll?null:findMentionedIncident(raw);
  if(!isAll&&!target&&/\b(event|incident|call|cfs|#|near|around)\b/.test(question)){setResult('Cannot uniquely identify the event. Please include its full number or select a matching event.');return}
  await showHydrants(target);return;
 }
 if(hydrantsVisible)hideHydrants(true);
 const all=(state.incidents||[]),units=(state.units||[]);
 const unit=units.find(u=>new RegExp('(?:^|\\s)'+u.id.toLowerCase()+'(?:\\s|$)').test(question)||question.includes(norm(u.id)));
 const mentionsPending=/\bpending\b/.test(question),mentionsActive=/\bactive\b/.test(question),mentionsAvailable=/\bavailable\b/.test(question);
 const mentionsCalls=/\b(call|calls|incidents|events)\b/.test(question),mentionsUnits=/\b(unit|units|apparatus|resources)\b/.test(question);
 // Combined requests are treated as intersection of requested categories, not a zoom-only overlay.
 if(mentionsCalls&&mentionsUnits&&(mentionsPending||mentionsActive||mentionsAvailable)){
   const calls=all.filter(i=>mentionsPending&&mentionsActive?['PENDING','ACTIVE'].includes(i.status):mentionsPending?i.status==='PENDING':mentionsActive?i.status==='ACTIVE':false);
   const chosenUnits=mentionsAvailable?units.filter(u=>u.status==='AVAILABLE'):[];
   await setQueryView(chosenUnits,calls,'requested calls and units');return;
 }
 if(/\bwhere (?:is|are)\b|\blocate\b|\bfind\b/.test(question)&&unit){await setQueryView([unit],[],unit.id);return}
 if(mentionsUnits&&/\bassigned\b|\bresponding\b|\bon (?:the|a) call\b/.test(question)){
   const matched=all.filter(i=>(question.includes(i.id.slice(-4))||(question.includes(norm(i.type))&&question.includes(norm(i.location)))||question.includes(norm(i.location)))&&i.units?.length);
   const target=matched.length===1?matched[0]:null;
   if(!target){setResult(matched.length>1?'Multiple calls match. Please specify the event number.':'No unique matching assigned call; try an address or event number.');return}
   await setQueryView(units.filter(u=>(target.units||[]).includes(u.id)),[],`units assigned to ${target.id}`);return;
 }
 if(/\bp\s*[123]\b|priority\s*(?:one|two|three|1|2|3)/.test(question)){
   const m=question.match(/\bp\s*([123])\b|priority\s*(one|two|three|[123])/);const n=m&&(m[1]||({one:1,two:2,three:3}[m[2]]||m[2]));
   await setQueryView([],all.filter(i=>i.priority===`P${n}`&&['ACTIVE','PENDING'].includes(i.status)),`P${n} calls`);return;
 }
 if(mentionsCalls&&(mentionsPending||mentionsActive||/\ball\b/.test(question))){
   const v=mentionsPending&&mentionsActive?'both':mentionsPending?'pending':mentionsActive?'active':'both';
   settings.incidents=v;persist();syncSelect();
   await setQueryView([],all.filter(i=>v==='both'?['ACTIVE','PENDING'].includes(i.status):i.status===v.toUpperCase()),`${v==='both'?'active and pending':v} incidents`);return;
 }
 if(unit){await setQueryView([unit],[],unit.id);return}
 if(mentionsUnits&&mentionsAvailable){await setQueryView(units.filter(u=>u.status==='AVAILABLE'),[],'available units');return}
 setResult('Try “show pending calls and available units”, “show all P1 calls”, “where is 3A21”, or “show units assigned to the Domestic at 725 D St”.');
}
function syncSelect(){const sel=document.getElementById('cadMapIncidentFilter');if(sel)sel.value=settings.incidents}
function mount(){const panel=host.closest('[data-panel="map"]');if(!panel||document.getElementById('cadMapToolbar'))return;const bar=document.createElement('div');bar.id='cadMapToolbar';bar.className='cad-map-toolbar';bar.innerHTML='<label>Calls <select id="cadMapIncidentFilter" aria-label="Incidents displayed on map"><option value="active">Active</option><option value="pending">Pending</option><option value="both">Both</option></select></label><div id="cadLayersMount"></div><div class="cad-map-query"><input id="cadMapQuestion" type="text" placeholder="Ask the map…" aria-label="Ask the operational map"><button id="cadMapAsk" type="button">Show</button><button id="cadMapResetQuery" type="button" hidden title="Restore regular map markers">Reset View</button><button id="cadMapPTT" type="button" title="Hold to ask the map using your microphone">🎙 Hold to Ask</button></div><span id="cadMapAnswer" role="status" aria-live="polite">Try: show all P1 calls · where is 3A21</span>';panel.insertBefore(bar,host);syncSelect();gisCatalog?.mount(document.getElementById('cadLayersMount'));
 document.getElementById('cadMapIncidentFilter').addEventListener('change',e=>{queryView=null;updateReset();settings.incidents=e.target.value;persist();focused=true;draw()});document.getElementById('cadMapResetQuery').onclick=resetQuery;const input=document.getElementById('cadMapQuestion');document.getElementById('cadMapAsk').onclick=()=>ask(input.value);input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();ask(input.value)}});
 let recorder,stream,chunks=[];const ptt=document.getElementById('cadMapPTT');async function start(){if(recorder?.state==='recording')return;try{stream=await navigator.mediaDevices.getUserMedia({audio:true});chunks=[];recorder=new MediaRecorder(stream);recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};recorder.onstop=async()=>{stream?.getTracks().forEach(t=>t.stop());ptt.textContent='🎙 Hold to Ask';const blob=new Blob(chunks,{type:recorder.mimeType||'audio/webm'});if(!blob.size)return;setResult('Transcribing map question…');try{const r=await fetch('/.netlify/functions/transcribe',{method:'POST',headers:{'Content-Type':blob.type},body:blob});if(!r.ok)throw new Error('Transcription request failed');const data=await r.json();const result=data.text||data.transcript||data.transcription||'';if(!result)throw new Error('No speech recognized');input.value=result;await ask(result)}catch(e){setResult(`Map voice unavailable: ${e.message}`)}};recorder.start();ptt.textContent='🔴 Listening…';setResult('Release to ask the map')}catch(e){setResult('Microphone unavailable. Type your question instead.')}}
 function stop(){if(recorder?.state==='recording')recorder.stop()};ptt.addEventListener('pointerdown',e=>{if(e.button!==0&&e.pointerType==='mouse')return;e.preventDefault();ptt.setPointerCapture?.(e.pointerId);start()});ptt.addEventListener('pointerup',stop);ptt.addEventListener('pointercancel',stop);ptt.addEventListener('keydown',e=>{if(e.key===' '&&!e.repeat){e.preventDefault();start()}});ptt.addEventListener('keyup',e=>{if(e.key===' '){e.preventDefault();stop()}});
}
window.cadInvalidateMapSize=()=>map?.invalidateSize({pan:false});if(window.ResizeObserver)new ResizeObserver(()=>window.cadInvalidateMapSize()).observe(host);
init();mount();const old=window.renderMap;window.renderMap=function(){if(window.L)void draw();else old?.()};window.addEventListener('load',()=>{void draw();setTimeout(()=>map?.invalidateSize(),350)});draw();
})();
