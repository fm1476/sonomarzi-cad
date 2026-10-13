/* Fire/EMS response plans: browser-local configuration prototype, not live dispatch. */
(()=>{'use strict';
const KEY='smcad-response-plans-v1',CREWS='smcad-shared-crews-v1';
const read=k=>{try{return JSON.parse(localStorage.getItem(k)||'[]')}catch{return []}};
let plans=read(KEY),crews=read(CREWS);
const root=document.getElementById('cadResponseDesigner');if(!root)return;
const el=id=>document.getElementById(id);
const save=()=>{localStorage.setItem(KEY,JSON.stringify(plans));localStorage.setItem(CREWS,JSON.stringify(crews))};
const escape=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
let selectedCrewId=null;let discipline='FIRE',agency='',zone='',zoneMap=null,zoneOverlay=null,zoneAbort=null,mapObserver=null;
const INITIAL_CENTER=[38.2448,-122.6400], INITIAL_ZOOM=13;
const gis={FIRE:{url:'https://maps.cityofpetaluma.net/mapping/rest/services/Fire/FireWebApp_MIL/MapServer/11',field:'ESZ_NUM'},EMS:{url:'https://maps.cityofpetaluma.net/mapping/rest/services/Fire/FireWebApp_MIL/MapServer/11',field:'ESZ_NUM'},LAW:{url:'https://maps.cityofpetaluma.net/mapping/rest/services/Police/DistrictPolicing_Public_MIL1/FeatureServer/1',field:'PD_BEAT'}};
function render(){
 // Tear down Leaflet before replacing its container. Discipline switches must recreate a fresh map.
 zoneAbort?.abort();zoneAbort=null;
 if(mapObserver){mapObserver.disconnect();mapObserver=null}
 if(zoneMap){zoneMap.off();zoneMap.remove();zoneMap=null;zoneOverlay=null}
 const zones=[...new Set(plans.filter(p=>p.discipline===discipline).map(p=>p.zone))];
 const agencyNames=(window.CadAgencyMaster?.read(localStorage)?.agencies||[]).map(a=>a.name);if(!agencyNames.includes(agency))agency=agencyNames[0]||'';
 root.innerHTML='<h4>Response Plan Designer</h4><p>Local draft/publish prototype. Does not affect live dispatch.</p><label>Agency<select id="rpAgency">'+agencyNames.map(a=>'<option value="'+escape(a)+'">'+escape(a)+'</option>').join('')+'</select></label><label>Discipline<select id="rpDisc"><option>FIRE</option><option>EMS</option><option>LAW</option></select></label><label>Response zone / police beat<input id="rpZone" placeholder="Click a polygon on the map, or enter a zone ID" value="'+escape(zone)+'"></label><div id="rpZoneMap" style="height:370px;min-height:300px;border:1px solid #34536d;border-radius:10px;margin:12px 0;overflow:hidden" aria-label="Select response zone on map"></div><p id="rpMapStatus">Loading response area map…</p><button id="rpOpen" type="button">Open Zone</button><button id="rpNew" type="button">New Plan</button><div id="rpPlans"></div><div id="rpEditor"></div><h4>Shared Crew Groups</h4><p>Apparatus sharing a crew cannot be recommended as independently staffed resources.</p><label>Group name<input id="rpCrewName" placeholder="Station 1 primary crew"></label><label>Apparatus (comma separated)<input id="rpCrewUnits" placeholder="E1, R1, BR1"></label><button id="rpAddCrew" type="button">Add Shared Crew</button><div id="rpCrews"></div><p id="rpMessage" role="status"></p>';
 el('rpAgency').value=agency;el('rpAgency').onchange=e=>{agency=e.target.value;showPlans();showCrews()};el('rpDisc').value=discipline;el('rpDisc').onchange=e=>{discipline=e.target.value;zone='';render()};
 el('rpOpen').onclick=()=>{zone=el('rpZone').value.trim();showPlans()};
 el('rpNew').onclick=()=>{zone=el('rpZone').value.trim();if(!zone)return msg('Select an ESZ first.');edit()};
 el('rpAddCrew').onclick=()=>{const name=el('rpCrewName').value.trim(),units=[...new Set(el('rpCrewUnits').value.toUpperCase().split(',').map(s=>s.trim()).filter(Boolean))];if(!name||units.length<2)return msg('Provide a group name and at least two apparatus.');if(crews.some(g=>(!g.agency||g.agency===agency)&&g.units.some(id=>units.includes(id))))return msg('An apparatus is already in another shared crew group for this agency.');crews.push({id:crypto.randomUUID(),agency,name,units});save();showCrews();msg('Shared crew saved locally.')};
 showPlans();showCrews();initZoneMap();
}
function initZoneMap(){
 if(!window.L){msg('Map library unavailable. Zone IDs can still be entered manually.');return}
 zoneMap=L.map('rpZoneMap',{scrollWheelZoom:false}).setView(INITIAL_CENTER,INITIAL_ZOOM);
 L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(zoneMap);
 zoneOverlay=L.geoJSON(null,{style:f=>({color:zone===featureZone(f)?'#f7d66b':'#5cb3e6',weight:zone===featureZone(f)?3:1.2,fillColor:'#50a2d4',fillOpacity:.12}),onEachFeature:(f,layer)=>{
 const id=featureZone(f);layer.bindTooltip(id||'Unnamed area',{sticky:true});
 layer.on('click',()=>{if(!id)return;zone=id;el('rpZone').value=id;zoneOverlay.setStyle(x=>({color:zone===featureZone(x)?'#f7d66b':'#5cb3e6',weight:zone===featureZone(x)?3:1.2,fillColor:'#50a2d4',fillOpacity:.12}));showPlans();msg('Selected '+discipline+' zone '+id+'.')});
 }}).addTo(zoneMap);
 zoneMap.on('moveend',loadMapZones);
 const host=el('rpZoneMap');let lastWidth=0,lastHeight=0,initialSized=false;
 function fixSize(){if(!zoneMap||!host||!host.isConnected)return;const box=host.getBoundingClientRect();if(box.width<100||box.height<100)return;if(Math.abs(box.width-lastWidth)<2&&Math.abs(box.height-lastHeight)<2)return;lastWidth=box.width;lastHeight=box.height;requestAnimationFrame(()=>{if(zoneMap&&host.isConnected){zoneMap.invalidateSize({pan:false,animate:false});if(!initialSized){initialSized=true;zoneMap.setView(INITIAL_CENTER,INITIAL_ZOOM,{animate:false})}}})}
 if(window.ResizeObserver){mapObserver=new ResizeObserver(fixSize);mapObserver.observe(host)}
 const visibleObserver=new MutationObserver(fixSize);visibleObserver.observe(document.querySelector('[data-config-panel="response"]')||root,{attributes:true,attributeFilter:['hidden','style','class']});
 const previousObserver=mapObserver;mapObserver={disconnect(){previousObserver?.disconnect();visibleObserver.disconnect()}};
 setTimeout(fixSize,150);setTimeout(fixSize,650);
 setTimeout(()=>{if(zoneMap&&host.isConnected){zoneMap.invalidateSize({pan:false,animate:false});loadMapZones()}},250);
}
function featureZone(f){
 const p=f.properties||{},configured=gis[discipline].field;
 if(configured&&p[configured]!=null)return String(p[configured]);
 for(const k of ['BEAT','BEAT_NAME','BEAT_NUM','BEAT_NUMBER','BEAT_ID','NAME','ZONE','ZONE_NAME','DISTRICT','AREA','LABEL'])if(p[k]!=null&&String(p[k]).trim())return String(p[k]);
 const found=Object.entries(p).find(([k,v])=>/beat|zone|district|area/i.test(k)&&v!=null&&typeof v!=='object');
 return found?String(found[1]):String(p.OBJECTID||p.ObjectId||'');
}
async function loadMapZones(){
 if(!zoneMap||!zoneOverlay)return;
 zoneAbort?.abort();const controller=new AbortController();zoneAbort=controller;
 const bounds=zoneMap.getBounds(),sw=bounds.getSouthWest(),ne=bounds.getNorthEast();
 const params=new URLSearchParams({geometry:JSON.stringify({xmin:sw.lng,ymin:sw.lat,xmax:ne.lng,ymax:ne.lat,spatialReference:{wkid:4326}}),geometryType:'esriGeometryEnvelope',inSR:'4326',spatialRel:'esriSpatialRelIntersects',outFields:'*',returnGeometry:'true',outSR:'4326',f:'geojson',resultRecordCount:'500'});
 try{
 const response=await fetch(gis[discipline].url+'/query?'+params,{signal:controller.signal});
 if(!response.ok)throw Error('HTTP '+response.status);const data=await response.json();
 if(controller!==zoneAbort||!zoneMap)return;if(data.error)throw Error(data.error.message||'GIS service error');
 if(data.type!=='FeatureCollection')throw Error('GIS service did not return GeoJSON');
 zoneOverlay.clearLayers();zoneOverlay.addData(data);
 el('rpMapStatus').textContent=data.features.length+' '+discipline+' GIS features shown. Click a zone or beat to open its plans. Map position is unchanged.';
 }catch(e){if(e.name!=='AbortError'&&el('rpMapStatus'))el('rpMapStatus').textContent='GIS layer unavailable: '+e.message+'. Manual zone entry remains available.'}
}
function msg(t){el('rpMessage').textContent=t}
function showCrews(){
 const host=el('rpCrews'),master=window.CadAgencyMaster?.read(localStorage)||{agencies:[],units:[],personnel:[]};
 const a=master.agencies.find(x=>x.name===agency);
 const defs=master.units.filter(x=>x.agencyId===a?.id);
 const active=(window.cadSafetyState?.().units||[]).filter(x=>x.agency===agency);
 const unitIds=[...new Set([...defs.map(x=>x.designator),...active.map(x=>x.id)])];
 const personnel=master.personnel.filter(x=>x.agencyId===a?.id);
 const owned=crews.filter(g=>g.agency===agency);
 const vehicle=id=>{const d=defs.find(x=>x.designator===id);const type=d?.resourceType||'';const icon=window.CadResourceTypes?.iconFor(agency,d?.discipline||discipline,type);return icon&&window.CadVehicleIcons?.items.some(x=>x.id===icon)?window.CadVehicleIcons.svg(icon):'🚒'};
 host.innerHTML='<div class="rp-crew-workspace"><section class="rp-crew-library"><h4>Apparatus library</h4><p>Drag a unit into a crew card, or select a card and click the unit.</p><div class="rp-crew-pills">'+unitIds.map(id=>'<button type="button" draggable="true" class="rp-crew-pill" data-crew-source="'+escape(id)+'">'+vehicle(id)+'<strong>'+escape(id)+'</strong></button>').join('')+'</div><h4>Personnel library</h4><p>Personnel assignments here are planning assignments, not shift sign-on.</p><div class="rp-crew-pills">'+personnel.map(x=>'<button type="button" draggable="true" class="rp-crew-pill" data-person-source="'+escape(x.id)+'">👤 '+escape(x.name)+'</button>').join('')+'</div></section><section class="rp-crew-board"><div class="rp-crew-board-header"><h4>Shared crew groups</h4><button type="button" id="rpCrewNewVisual">+ New crew</button></div><div id="rpCrewCards">'+owned.map(g=>'<article class="rp-crew-card" data-crew-target="'+escape(g.id)+'"><div class="rp-crew-card-header"><strong>'+escape(g.name)+'</strong><button type="button" data-crew-delete="'+escape(g.id)+'">Remove</button></div><div class="rp-crew-pills">'+(g.units||[]).map(id=>'<span class="rp-crew-assigned">'+vehicle(id)+' '+escape(id)+' <button type="button" data-crew-unassign="'+escape(g.id)+'" data-unit="'+escape(id)+'" aria-label="Remove '+escape(id)+'">×</button></span>').join('')+'</div><div class="rp-crew-personnel"><strong>Planned personnel</strong><div class="rp-crew-pills">'+(g.personIds||[]).map(id=>'<span class="rp-crew-assigned">👤 '+escape(personnel.find(p=>p.id===id)?.name||id)+' <button type="button" data-person-unassign="'+escape(g.id)+'" data-person="'+escape(id)+'">×</button></span>').join('')+'</div></div><small>Drop apparatus or personnel here. A crew may operate only one apparatus at a time.</small></article>').join('')+'</div></section></div>';
 let selected=owned.some(g=>g.id===selectedCrewId)?selectedCrewId:(owned[0]?.id||null);
 const change=(id,kind)=>{const group=crews.find(g=>g.id===selected);if(!group)return msg('Create a crew group first.');if(kind==='unit'){if(crews.some(g=>g.id!==group.id&&(!g.agency||g.agency===agency)&&(g.units||[]).includes(id)))return msg(id+' already belongs to another crew.');group.units=[...new Set([...(group.units||[]),id])]}else{if(crews.some(g=>g.id!==group.id&&g.agency===agency&&(g.personIds||[]).includes(id)))return msg('Personnel already assigned to another planned crew.');group.personIds=[...new Set([...(group.personIds||[]),id])]}save();showCrews()};
 host.querySelector('#rpCrewNewVisual').onclick=()=>{const name=prompt('Crew group name (for example, Station 1 shared crew)')?.trim();if(!name)return;crews.push({id:crypto.randomUUID(),agency,name,units:[],personIds:[]});selectedCrewId=crews[crews.length-1].id;save();showCrews();msg('Crew group created. Drag apparatus and personnel into its card.')};
 host.querySelectorAll('[data-crew-target]').forEach(card=>{card.onclick=e=>{if(e.target.closest('button'))return;selected=card.dataset.crewTarget;selectedCrewId=selected;host.querySelectorAll('[data-crew-target]').forEach(c=>c.classList.toggle('rp-crew-selected',c===card))};card.ondragover=e=>{e.preventDefault();card.classList.add('rp-crew-hover')};card.ondragleave=()=>card.classList.remove('rp-crew-hover');card.ondrop=e=>{e.preventDefault();card.classList.remove('rp-crew-hover');selected=card.dataset.crewTarget;selectedCrewId=selected;const data=e.dataTransfer.getData('text/plain');if(data.startsWith('crew-unit:'))change(data.slice(10),'unit');if(data.startsWith('crew-person:'))change(data.slice(12),'person')}});
 host.querySelectorAll('[data-crew-source]').forEach(b=>{b.ondragstart=e=>e.dataTransfer.setData('text/plain','crew-unit:'+b.dataset.crewSource);b.onclick=()=>change(b.dataset.crewSource,'unit')});
 host.querySelectorAll('[data-person-source]').forEach(b=>{b.ondragstart=e=>e.dataTransfer.setData('text/plain','crew-person:'+b.dataset.personSource);b.onclick=()=>change(b.dataset.personSource,'person')});
 host.querySelectorAll('[data-crew-delete]').forEach(b=>b.onclick=()=>{if(!confirm('Remove this shared crew group?'))return;crews=crews.filter(g=>g.id!==b.dataset.crewDelete);save();showCrews()});
 host.querySelectorAll('[data-crew-unassign]').forEach(b=>b.onclick=()=>{const g=crews.find(x=>x.id===b.dataset.crewUnassign);g.units=g.units.filter(id=>id!==b.dataset.unit);save();showCrews()});
 host.querySelectorAll('[data-person-unassign]').forEach(b=>b.onclick=()=>{const g=crews.find(x=>x.id===b.dataset.personUnassign);g.personIds=(g.personIds||[]).filter(id=>id!==b.dataset.person);save();showCrews()});
 if(selected)host.querySelector('[data-crew-target="'+CSS.escape(selected)+'"]')?.classList.add('rp-crew-selected');
}
function showPlans(){el('rpZone').value=zone;const matches=plans.filter(p=>p.zone===zone&&p.discipline===discipline&&(!p.agency||p.agency===agency));el('rpPlans').innerHTML=matches.map(p=>'<p>'+escape(p.type)+' · '+escape(p.level)+' · '+escape(p.status)+(p.savedAt?' · Saved '+escape(new Date(p.savedAt).toLocaleString()):'')+' <button data-edit-plan="'+escape(p.id)+'">Edit</button></p>').join('')||(zone?'<p>No existing plans for this ESZ.</p>':'<p>Select an ESZ to begin.</p>');el('rpPlans').querySelectorAll('[data-edit-plan]').forEach(b=>b.onclick=()=>edit(b.dataset.editPlan));if(matches.length===1)edit(matches[0].id);else el('rpEditor').innerHTML=''}
const DEFAULT_CFS={LAW:['Traffic Stop','Domestic','Suspicious Person','Alarm','Traffic Collision','Welfare Check','Disturbance','Unwanted Subject','Burglary Alarm'],FIRE:['Structure Fire','Vegetation Fire','Vehicle Fire','Alarm','Hazard'],EMS:['Medical Aid','Cardiac Arrest','Fall','Overdose','Traffic Collision']};
function cfsOptions(d,existing){
 const cfg=(()=>{try{return JSON.parse(localStorage.getItem('smcad-config-v1')||'{}')}catch{return {}}})();
 const state=window.cadSafetyState?.()||{};
 return [...new Set([...(DEFAULT_CFS[d]||[]),...(Array.isArray(cfg.types?.[d])?cfg.types[d]:[]),...(state.incidents||[]).filter(i=>i.discipline===d).map(i=>i.type),existing].filter(x=>typeof x==='string'&&x.trim()))].sort((a,b)=>a.localeCompare(b));
}
const RESOURCE_TYPES={
 FIRE:['ENGINE','TRUCK','LADDER','RESCUE','BRUSH','CHIEF','TENDER','MEDIC','AMBULANCE','OTHER'],
 EMS:['AMBULANCE','MEDIC','ENGINE','RESCUE','CHIEF','SUPERVISOR','OTHER'],
 LAW:['PATROL','SUPERVISOR','TRAFFIC','K9','DETECTIVE','SWAT','MOTOR','OTHER']
};
/* Read-only response plan test bench. No incident or unit state is changed. */
function testPlan(plan,overrides={}){
 const master=(()=>{try{return window.CadAgencyMaster?.read(localStorage)||{units:[]}}catch{return {units:[]}}})();
 const roster=window.cadSafetyState?.().units||[];
 const chosen=new Set(),usedCrew=new Set(),usedPersonnel=new Set(),rows=[];
 const infer=u=>{
  const id=String(u.id||'').toUpperCase();
  if(u.discipline==='LAW')return /K9/.test(id)?'K9':/MOTOR|M[0-9]/.test(id)?'MOTOR':'PATROL';
  if(/^E[0-9]/.test(id))return 'ENGINE';
  if(/^T[0-9]/.test(id))return 'TRUCK';
  if(/^R[0-9]/.test(id))return 'RESCUE';
  if(/^B[0-9]/.test(id))return 'BRUSH';
  if(/^M[0-9]/.test(id))return 'AMBULANCE';
  if(/^C[0-9]/.test(id))return 'CHIEF';
  return null;
 };
 const candidates=roster.filter(u=>u.discipline===plan.discipline&&(!plan.agency||u.agency===plan.agency)).map(u=>{
  const definition=(master.units||[]).find(m=>(m.id===u.masterUnitId)||(m.designator===u.id&&master.agencies?.some(a=>a.id===m.agencyId&&a.name===u.agency)));
  const group=crews.find(g=>(!g.agency||g.agency===u.agency)&&g.units.some(id=>id.toUpperCase()===String(u.id).toUpperCase()));
  return {...u,status:overrides[u.id]?.status||u.status,simStaff:overrides[u.id]?.staff,resourceType:definition?.resourceType||infer(u),crewId:group?.id||null,definition};
 });
 const eligibility=u=>{if(chosen.has(u.id))return 'Already selected';if(String(u.status).toUpperCase()!=='AVAILABLE')return 'Status: '+u.status;if(u.crewId&&usedCrew.has(u.crewId))return 'Shared crew committed';if(u.staffing?.active&&u.staffing.personIds?.some(id=>usedPersonnel.has(id)))return 'Signed-on personnel already committed';const required=Number(u.definition?.minStaffing||0);if(required>0){if(u.simStaff===undefined||u.simStaff===null||u.simStaff==='')return 'Staffing unverified (requires '+required+')';if(Number(u.simStaff)<required)return 'Understaffed: '+u.simStaff+' of '+required+' required'}return null};
 for(const request of plan.resources){
  const selected=[],rejected=[],trace=[];const need=Number(request.count)||0;
  const pool=candidates.filter(x=>x.resourceType===request.type);
  const rule=(plan.runOrders||{})[request.type]||[];
  const tryUnit=(u,why)=>{
   if(selected.length>=need)return;
   const reason=eligibility(u);
   if(reason){rejected.push({id:u.id,reason});trace.push(u.id+' skipped: '+reason);return}
   selected.push(u.id);chosen.add(u.id);if(u.crewId)usedCrew.add(u.crewId);if(u.staffing?.active)for(const id of u.staffing.personIds||[])usedPersonnel.add(id);
   trace.push(u.id+' selected via '+why);
  };
  for(const step of rule){
   if(selected.length>=need)break;
   const value=String(step.value||'').trim(),kind=step.kind;
   if(kind==='CLOSEST'){trace.push('CLOSEST not evaluated: no verified travel-time calculation');continue}
   let found=[];
   if(kind==='UNIT')found=pool.filter(u=>String(u.id).toUpperCase()===value.toUpperCase());
   if(kind==='EITHER'){const ids=value.toUpperCase().split(',').map(x=>x.trim()).filter(Boolean);found=ids.map(id=>pool.find(u=>String(u.id).toUpperCase()===id)).filter(Boolean)}
   if(kind==='LOCATION')found=pool.filter(u=>String(u.location||'').toUpperCase().includes(value.toUpperCase()));
   if(!found.length)trace.push(kind+' '+value+': no matching '+request.type+' units');
   for(const u of found){if(selected.length>=need)break;tryUnit(u,kind+' '+value)}
  }
  // The current prototype has no geographic distance calculation. When rules
  // cannot fill a request, explicitly use an unordered roster fallback.
  if(selected.length<need){
   trace.push('Using unranked demo-roster fallback for '+(need-selected.length)+' remaining resource(s)');
   for(const u of pool){if(selected.length>=need)break;if(chosen.has(u.id))continue;tryUnit(u,'roster fallback')}
  }
  rows.push({type:request.type,need,selected,rejected,short:Math.max(0,need-selected.length),trace,rule:rule.length?rule.map(x=>x.kind+' '+(x.value||'')).join(' → '):'No configured preference'});
 }
 return rows;
}
function drawTest(plan,overrides={}){
 const host=el('rpTestResults');if(!host)return;
 const rows=testPlan(plan,overrides),short=rows.reduce((n,r)=>n+r.short,0);
 const roster=(window.cadSafetyState?.().units||[]).filter(u=>u.discipline===plan.discipline);
 const master=(()=>{try{return window.CadAgencyMaster?.read(localStorage)||{units:[]}}catch{return {units:[]}}})();
 host.innerHTML='<h4>Simulation results — '+(short?'Resource shortfall':'All requested types matched')+'</h4>'+
 '<p>Read-only demo roster check. No units dispatched. Unit types without a master definition are inferred from designators for demo purposes. Personnel qualifications, actual staffing, travel time, and geographic closest-unit calculations are not verified.</p>'+ 
 '<details class="rp-scenario" open><summary>What-if scenarios: availability and staffing</summary><p>Simulation-only overrides. Units with configured minimum staffing are excluded until staffing is explicitly verified in this test. These values do not change the actual roster.</p><div class="rp-scenario-grid">'+roster.map(u=>{const def=(master.units||[]).find(m=>(m.id===u.masterUnitId)||(m.designator===u.id&&master.agencies?.some(a=>a.id===m.agencyId&&a.name===u.agency)));const min=Number(def?.minStaffing||0);const o=overrides[u.id]||{};return '<div class="rp-scenario-unit"><strong>'+escape(u.id)+'</strong><label>Availability<select data-sim-unit="'+escape(u.id)+'"><option value="">Actual: '+escape(u.status)+'</option><option value="AVAILABLE" '+(o.status==='AVAILABLE'?'selected':'')+'>Available</option><option value="UNAVAILABLE" '+(o.status==='UNAVAILABLE'?'selected':'')+'>Unavailable</option></select></label>'+(min?'<label>Simulated crew (minimum '+min+')<input type="number" min="0" max="99" step="1" placeholder="Not verified" data-sim-staff="'+escape(u.id)+'" value="'+escape(o.staff??'')+'"></label>':'')+'</div>'}).join('')+'</div><button type="button" id="rpScenarioReset">Reset scenario</button></details>'+
 rows.map(r=>'<div style="border:1px solid #36536c;border-radius:8px;padding:10px;margin:8px 0"><strong>'+escape(r.type)+' · '+r.selected.length+'/'+r.need+'</strong> — '+(r.selected.length?'Selected: '+escape(r.selected.join(', ')):'No eligible units selected')+
 (r.short?' <strong style="color:#ffb17c">Short '+r.short+'</strong>':'')+'<div style="font-size:12px;color:#a9bfd0">Run order: '+escape(r.rule)+'</div>'+
 (r.rejected.length?'<div style="font-size:12px;color:#a9bfd0">Excluded: '+r.rejected.map(x=>escape(x.id+' ('+x.reason+')')).join('; ')+'</div>':'')+'<details><summary>Why these units?</summary><ol>'+r.trace.map(t=>'<li>'+escape(t)+'</li>').join('')+'</ol></details></div>').join('');
 host.querySelectorAll('[data-sim-unit]').forEach(select=>select.onchange=()=>{const next=structuredClone(overrides),id=select.dataset.simUnit;next[id]??={};if(select.value)next[id].status=select.value;else delete next[id].status;drawTest(plan,next)});
 host.querySelectorAll('[data-sim-staff]').forEach(input=>input.onchange=()=>{const next=structuredClone(overrides),id=input.dataset.simStaff;next[id]??={};if(input.value!==''&&Number.isInteger(Number(input.value))&&Number(input.value)>=0&&Number(input.value)<=99)next[id].staff=Number(input.value);else delete next[id].staff;drawTest(plan,next)});
 host.querySelector('#rpScenarioReset').onclick=()=>drawTest(plan,{});
}
function edit(id){
 const p=plans.find(x=>x.id===id);
 const defaults=discipline==='LAW'?[{type:'PATROL',count:2},{type:'SUPERVISOR',count:1}]:discipline==='EMS'?[{type:'AMBULANCE',count:1},{type:'ENGINE',count:1}]:[{type:'ENGINE',count:2},{type:'TRUCK',count:1},{type:'CHIEF',count:1}];
 let resources=(p?.resources||defaults.filter(r=>(window.CadResourceTypes?.forAgency(agency,discipline).map(x=>x.name)||[]).includes(r.type))).map(r=>({...r}));
 let runOrders=structuredClone(p?.runOrders||{});
 const master=(()=>{try{return window.CadAgencyMaster?.read(localStorage)||{units:[],agencies:[]}}catch{return {units:[],agencies:[]}}})();
 const options=[...new Set([...(window.CadResourceTypes?.forAgency(agency,discipline).map(x=>x.name)||[]),...(p?.resources||[]).map(r=>r.type)])];
 const roster=(window.cadSafetyState?.().units||[]).filter(u=>u.discipline===discipline);
 const agencyFor=u=>master.agencies?.find(a=>a.id===u.agencyId)?.name||'';
 const availableUnits=[...new Map([...roster.filter(u=>u.agency===agency).map(u=>[u.agency+'|'+u.id,{id:u.id,agency:u.agency,type:(master.units||[]).find(m=>m.id===u.masterUnitId)?.resourceType||''}]),...(master.units||[]).filter(u=>u.discipline===discipline&&agencyFor(u)===agency).map(u=>[agencyFor(u)+'|'+u.designator,{id:u.designator,agency:agencyFor(u),type:u.resourceType||''}])].map(([k,v])=>[k,v])).values()];
 const iconFor=type=>{const id=window.CadResourceTypes?.iconFor(agency,discipline,type);return id&&window.CadVehicleIcons?.items.some(x=>x.id===id)?window.CadVehicleIcons.svg(id):escape(id||symbols[type]||'▣')};
 const symbols={ENGINE:'🚒',TRUCK:'🪜',LADDER:'🪜',RESCUE:'🚑',BRUSH:'🌲',CHIEF:'⭐',TENDER:'💧',MEDIC:'🚑',AMBULANCE:'🚑',PATROL:'🚓',SUPERVISOR:'⭐',K9:'🐕',SWAT:'🛡️'};

 el('rpEditor').innerHTML='<h4>'+(p?'Edit Plan':'New Plan')+' — '+escape(discipline==='LAW'?'Beat ':'ESZ ')+escape(zone)+'</h4>'+
 '<label>Call type<select id="rpType">'+cfsOptions(discipline,p?.type).map(type=>'<option value="'+escape(type)+'" '+(type===p?.type?'selected':'')+'>'+escape(type)+'</option>').join('')+'</select></label>'+
 '<label>Response level<select id="rpLevel"><option>First Alarm</option><option>Working Fire</option><option>Second Alarm</option><option>Standard</option></select></label>'+
 '<label>Selection method<select id="rpMethod"><option>HYBRID</option><option>CLOSEST</option><option>RUN_CARD</option></select></label>'+
 '<h4>Response resources</h4><p>Choose resource types, set quantities, and use the arrows to establish dispatch order.</p>'+
 '<div class="rp-palette-wrap"><div><strong>Resource types</strong><p>Drag or click a tile to add it to the assignment.</p><div id="rpTypePalette" class="rp-palette"></div></div><div class="rp-palette-drop"><strong>Response assignment</strong><div id="rpResourceCards"></div></div></div><h4>Visual Run Order Builder</h4><p>Define preferred units or station/beat locations for each resource type. Drag a rule by its grip to change priority. Unmatched resources fall back to roster order in this prototype.</p><div id="rpRunOrders"></div><button id="rpAddResource" type="button">+ Add Resource</button><button id="rpTest" type="button" style="margin-left:8px">Test Response Plan</button><div id="rpTestResults" role="status" aria-live="polite"></div>'+
 '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:18px"><button id="rpDraft" type="button">Save Draft</button><button id="rpPublish" type="button">Publish Locally</button></div><p id="rpSaveFeedback" role="status" aria-live="polite" style="margin-top:10px;font-weight:700"></p>';
 el('rpLevel').value=p?.level||'Standard';el('rpMethod').value=p?.method||'HYBRID';
 function renderPalettes(){
  el('rpTypePalette').innerHTML=options.map(t=>'<button type="button" draggable="true" class="rp-palette-pill" data-type-pill="'+escape(t)+'">'+iconFor(t)+' '+escape(t)+'</button>').join('');
  el('rpTypePalette').querySelectorAll('[data-type-pill]').forEach(b=>{b.onclick=()=>addResource(b.dataset.typePill);b.ondragstart=e=>{e.dataTransfer.setData('text/plain','resource:'+b.dataset.typePill);e.dataTransfer.effectAllowed='copy'}});
  el('rpUnitPalette').innerHTML=availableUnits.map(u=>'<button type="button" draggable="true" class="rp-palette-pill" data-unit-pill="'+escape(u.id)+'" data-unit-type="'+escape(u.type)+'" title="'+escape(u.agency)+'">'+iconFor(u.type)+' '+escape(u.id)+' <small>'+escape(u.agency)+'</small></button>').join('')||'<p>No agency units found for this discipline.</p>';
  el('rpUnitPalette').querySelectorAll('[data-unit-pill]').forEach(b=>{b.onclick=()=>addUnit(b.dataset.unitPill,b.dataset.unitType);b.ondragstart=e=>{e.dataTransfer.setData('text/plain','unit:'+b.dataset.unitPill+'|'+b.dataset.unitType);e.dataTransfer.effectAllowed='copy'}});
 }
 function addResource(type){const found=resources.find(r=>r.type===type);if(found)found.count=Math.min(99,Number(found.count)+1);else resources.push({type,count:1});drawResources();drawOrders()}
 function addUnit(id,type){
  const target=type&&resources.some(r=>r.type===type)?type:resources.length===1?resources[0].type:null;
  if(!target){msg('Add the matching resource type first, then drop the unit onto that run-order card.');return}
  (runOrders[target]??=[]).push({kind:'UNIT',value:id});drawOrders();msg(id+' added to '+target+' run order. No live dispatch changes.');
 }
 function drawResources(){
  el('rpResourceCards').innerHTML=resources.map((resource,i)=>'<div data-resource-index="'+i+'" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;border:1px solid #34536d;border-radius:10px;padding:12px;margin:8px 0;background:rgba(31,75,109,.22)">'+
   '<strong style="min-width:30px">'+(i+1)+'.</strong><span class="rp-resource-icon">'+iconFor(resource.type)+'</span>'+
   '<label style="flex:1;min-width:160px">Resource type<select data-resource-type="'+i+'">'+[...new Set([...options,resource.type])].map(type=>'<option value="'+escape(type)+'" '+(resource.type===type?'selected':'')+'>'+escape(type)+'</option>').join('')+'</select></label>'+
   '<label style="min-width:100px">Quantity<input type="number" min="1" max="99" style="width:85px" data-resource-count="'+i+'" value="'+escape(resource.count)+'"></label>'+
   '<button type="button" data-resource-up="'+i+'" '+(i===0?'disabled':'')+' aria-label="Move resource up">↑</button>'+
   '<button type="button" data-resource-down="'+i+'" '+(i===resources.length-1?'disabled':'')+' aria-label="Move resource down">↓</button>'+
   '<button type="button" data-resource-remove="'+i+'" aria-label="Remove resource">Remove</button></div>').join('')||'<p>No resources yet. Add one to begin.</p>';
  el('rpResourceCards').querySelectorAll('[data-resource-type]').forEach(x=>x.onchange=()=>{resources[Number(x.dataset.resourceType)].type=x.value});
  el('rpResourceCards').querySelectorAll('[data-resource-count]').forEach(x=>x.onchange=()=>{resources[Number(x.dataset.resourceCount)].count=Number(x.value)});
  el('rpResourceCards').querySelectorAll('[data-resource-up]').forEach(x=>x.onclick=()=>{const i=Number(x.dataset.resourceUp);[resources[i-1],resources[i]]=[resources[i],resources[i-1]];drawResources()});
  el('rpResourceCards').querySelectorAll('[data-resource-down]').forEach(x=>x.onclick=()=>{const i=Number(x.dataset.resourceDown);[resources[i+1],resources[i]]=[resources[i],resources[i+1]];drawResources()});
  el('rpResourceCards').querySelectorAll('[data-resource-remove]').forEach(x=>x.onclick=()=>{resources.splice(Number(x.dataset.resourceRemove),1);drawResources()});
 }
 drawResources();
 function drawOrders(){
  const types=[...new Set(resources.map(x=>x.type))];
  el('rpRunOrders').innerHTML=types.map(type=>'<section class="rp-run-group" data-run-type="'+escape(type)+'"><h4>'+escape(type)+'</h4>'+
   (runOrders[type]||[]).map((step,i)=>'<div class="rp-run-step" draggable="true" data-step="'+i+'"><span class="rp-run-grip" title="Drag to reorder">⠿</span><strong>'+(i+1)+'</strong><select data-run-kind="'+i+'"><option value="UNIT" '+(step.kind==='UNIT'?'selected':'')+'>Specific unit</option><option value="EITHER" '+(step.kind==='EITHER'?'selected':'')+'>Either unit</option><option value="LOCATION" '+(step.kind==='LOCATION'?'selected':'')+'>Station / beat</option><option value="CLOSEST" '+(step.kind==='CLOSEST'?'selected':'')+'>Closest (placeholder)</option></select><input data-run-value="'+i+'" value="'+escape(step.value||'')+'" placeholder="E1, or E1,E2, or Station 1"><button data-run-remove="'+i+'" type="button">Remove</button></div>').join('')+
   '<button data-run-add type="button">+ Add run-order step</button><p class="rp-rule-explain" style="font-size:12px;color:#a9bfd0">'+escape((runOrders[type]||[]).map((step,i)=>(i+1)+'. '+({UNIT:'Prefer unit',EITHER:'Choose first eligible from',LOCATION:'Prefer units at',CLOSEST:'Closest eligible unit (not yet implemented)'}[step.kind]||step.kind)+' '+(step.value||'')).join(' · ')||'No preference set; use demo roster order')+'</p></section>').join('');
  el('rpRunOrders').querySelectorAll('[data-run-type]').forEach(group=>{
   group.ondragover=e=>{if(e.dataTransfer.types.includes('text/plain'))e.preventDefault()};
   group.ondrop=e=>{const v=e.dataTransfer.getData('text/plain');if(!v.startsWith('unit:'))return;e.preventDefault();e.stopPropagation();const [id,type]=v.slice(5).split('|');if(type&&type!==group.dataset.runType){msg(id+' is configured as '+type+'. Drop it on the matching resource card.');return}(runOrders[group.dataset.runType]??=[]).push({kind:'UNIT',value:id});drawOrders()};
   const type=group.dataset.runType;
   group.querySelector('[data-run-add]').onclick=()=>{(runOrders[type]??=[]).push({kind:'UNIT',value:''});drawOrders()};
   group.querySelectorAll('[data-run-kind]').forEach(x=>x.onchange=()=>{runOrders[type][Number(x.dataset.runKind)].kind=x.value;drawOrders()});
   group.querySelectorAll('[data-run-value]').forEach(x=>x.oninput=()=>{runOrders[type][Number(x.dataset.runValue)].value=x.value;const explain=group.querySelector('.rp-rule-explain');if(explain)explain.textContent=runOrders[type].map((step,i)=>(i+1)+'. '+step.kind+' '+(step.value||'')).join(' · ')});
   group.querySelectorAll('[data-run-remove]').forEach(x=>x.onclick=()=>{runOrders[type].splice(Number(x.dataset.runRemove),1);drawOrders()});
   let from=null;
   group.querySelectorAll('[data-step]').forEach(node=>{
    node.addEventListener('dragstart',e=>{from=Number(node.dataset.step);e.dataTransfer.setData('text/plain',String(from))});
    node.addEventListener('dragover',e=>e.preventDefault());
    node.addEventListener('drop',e=>{e.preventDefault();const to=Number(node.dataset.step);if(from===null||from===to)return;const steps=runOrders[type];steps.splice(to,0,steps.splice(from,1)[0]);drawOrders()});
   });
  });
 }
 drawOrders();renderPalettes();
 const resourceDrop=el('rpResourceCards');
 resourceDrop.ondragover=e=>e.preventDefault();
 resourceDrop.ondrop=e=>{const v=e.dataTransfer.getData('text/plain');if(v.startsWith('resource:')){e.preventDefault();addResource(v.slice(9))}};
 el('rpResourceCards').addEventListener('change',e=>{if(e.target.matches('[data-resource-type]'))setTimeout(drawOrders,0)});
 el('rpAddResource').onclick=()=>{if(!options.length)return msg('Configure resource types for this agency first.');resources.push({type:options[0],count:1});drawResources();drawOrders()};
 el('rpTest').onclick=()=>{const requested=resources.map(r=>({...r,count:Number(r.count)}));if(!requested.length||requested.some(r=>!r.type||!Number.isInteger(r.count)||r.count<1))return msg('Enter valid resources before testing.');drawTest({agency,discipline,resources:requested,runOrders})};
 function commit(status){
  const type=el('rpType').value.trim();
  if(!type||!resources.length||resources.some(r=>!r.type||!Number.isInteger(r.count)||r.count<1||r.count>99))return msg('Enter a call type and at least one resource with a quantity from 1 to 99.');
  if(Object.values(runOrders).some(steps=>steps.some(step=>step.kind!=='CLOSEST'&&!step.value.trim())))return msg('Complete each run-order step or remove the empty step.');
  const next={id:id||crypto.randomUUID(),zone,agency,discipline,type,level:el('rpLevel').value,method:el('rpMethod').value,resources:resources.map(r=>({...r})),runOrders,status,savedAt:new Date().toISOString()};
  try{plans=plans.filter(x=>x.id!==id);plans.push(next);save();showPlans();const confirmation=(status==='Draft'?'Draft saved':'Plan published locally')+' at '+new Date(next.savedAt).toLocaleTimeString()+'.';const feedback=el('rpSaveFeedback');if(feedback){feedback.textContent='✓ '+confirmation;feedback.style.color='#72e0a2'}msg(confirmation+' No live dispatch changes.')}catch(error){const feedback=el('rpSaveFeedback');if(feedback){feedback.textContent='Save failed: '+error.message;feedback.style.color='#ff9898'}msg('Save failed: '+error.message)}
 }
 el('rpDraft').onclick=()=>commit('Draft');el('rpPublish').onclick=()=>commit('Published');
}
window.CadResponsePlans={recommendIncident(incident){if(!incident)return {status:'none',message:'No incident selected.'};const matching=plans.filter(p=>p.status==='Published'&&p.discipline===incident.discipline&&p.agency===incident.agency&&p.type?.toLowerCase()===String(incident.type||'').toLowerCase());if(!matching.length)return {status:'none',message:'No published response plan matches this agency, discipline and call type.'};const zone=String(incident.responseZone||incident.zone||incident.esz||incident.beat||'').trim();if(!zone)return {status:'zone',message:'A published plan exists, but the incident has no verified response zone or beat. Select the zone before recommending units.'};const matches=matching.filter(p=>String(p.zone).trim().toLowerCase()===zone.toLowerCase());if(matches.length!==1)return {status:'zone',message:matches.length?'Multiple published plans match this zone. Resolve the ambiguity before using recommendations.':'No published plan matches incident zone '+zone+'.'};const plan=matches[0];return {status:'ready',plan:{id:plan.id,type:plan.type,zone:plan.zone,level:plan.level},rows:testPlan(plan),message:'Read-only simulation. No units have been dispatched.'}},openZone(z,d='FIRE'){zone=String(z);discipline=['EMS','LAW'].includes(d)?d:'FIRE';render()},sharedCrewConflicts:ids=>{const used=new Set();return ids.filter(id=>{const g=crews.find(x=>x.units.includes(id));if(!g)return false;if(used.has(g.id))return true;used.add(g.id);return false})}};
render();
})();