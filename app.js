const KEY='smcad-poc-v1', CFG='smcad-config-v1';
const defaultConfig={agencies:['Sonoma County Sheriff','Petaluma Police','Petaluma Fire / EMS','REDCOM'],types:{LAW:['Traffic Stop','Domestic','Suspicious Person','Alarm','Traffic Collision','Welfare Check','Disturbance'],FIRE:['Structure Fire','Vegetation Fire','Vehicle Fire','Alarm','Hazard'],EMS:['Medical Aid','Cardiac Arrest','Fall','Overdose','Traffic Collision']}};
const defaultState=()=>({seq:4525,selected:null,incidents:[
{id:'26-004518',agency:'Petaluma Police',discipline:'LAW',priority:'P1',type:'Domestic',location:'725 D St',caller:'RP',phone:'707-555-0144',narrative:['Caller reports physical fight, possible weapon.'],status:'ACTIVE',units:['3A21'],events:[]},
{id:'26-004519',agency:'Petaluma Fire / EMS',discipline:'FIRE',priority:'P2',type:'Alarm',location:'1000 Lakeville St',caller:'Alarm Co',phone:'800-555-0199',narrative:['Commercial fire alarm, zone 2.'],status:'PENDING',units:[],events:[]},
{id:'26-004520',agency:'Sonoma County Sheriff',discipline:'LAW',priority:'P2',type:'Suspicious Person',location:'Old Adobe Rd / Ely',caller:'Anonymous',phone:'',narrative:['Subject checking vehicle doors.'],status:'PENDING',units:[],events:[]},
{id:'26-004521',agency:'Petaluma Police',discipline:'LAW',priority:'P2',type:'Traffic Collision',location:'123 Main St',caller:'Motorist',phone:'707-555-0112',narrative:['Two vehicles involved, injuries unknown.'],status:'PENDING',units:[],events:[]},
{id:'26-004522',agency:'Petaluma Police',discipline:'LAW',priority:'P2',type:'Unwanted Subject',location:'250 Kentucky St',caller:'Store staff',phone:'707-555-0113',narrative:['Customer refusing to leave business.'],status:'PENDING',units:[],events:[]},
{id:'26-004523',agency:'Petaluma Police',discipline:'LAW',priority:'P3',type:'Welfare Check',location:'500 Petaluma Blvd N',caller:'Family member',phone:'707-555-0114',narrative:['Requested welfare check.'],status:'PENDING',units:[],events:[]},
{id:'26-004524',agency:'Petaluma Police',discipline:'LAW',priority:'P2',type:'Burglary Alarm',location:'401 Washington St',caller:'Alarm Company',phone:'800-555-0115',narrative:['Commercial alarm activation.'],status:'PENDING',units:[],events:[]},
{id:'26-004525',agency:'Petaluma Fire / EMS',discipline:'FIRE',priority:'P1',type:'Structure Fire',location:'450 E Washington St',caller:'911 caller',phone:'707-555-0116',narrative:['Smoke reported from second floor, extent unknown.'],status:'PENDING',units:[],events:[]}
],units:[
{id:'3A12',agency:'Petaluma Police',discipline:'LAW',status:'AVAILABLE',location:'Beat 3',x:35,y:44},
{id:'3A14',agency:'Petaluma Police',discipline:'LAW',status:'AVAILABLE',location:'Beat 3',x:54,y:61},
{id:'3A16',agency:'Petaluma Police',discipline:'LAW',status:'AVAILABLE',location:'Beat 1',x:41,y:33},
{id:'3A18',agency:'Petaluma Police',discipline:'LAW',status:'AVAILABLE',location:'Beat 2',x:61,y:75},
{id:'3A21',agency:'Petaluma Police',discipline:'LAW',status:'ONSCENE',location:'725 D St',x:64,y:33},
{id:'3A22',agency:'Petaluma Police',discipline:'LAW',status:'AVAILABLE',location:'Beat 4',x:78,y:48},
{id:'SO12',agency:'Sonoma County Sheriff',discipline:'LAW',status:'AVAILABLE',location:'South County',x:23,y:67},
{id:'E1',agency:'Petaluma Fire / EMS',discipline:'FIRE',status:'AVAILABLE',location:'Station 1',x:72,y:53},
{id:'E2',agency:'Petaluma Fire / EMS',discipline:'FIRE',status:'AVAILABLE',location:'Station 2',x:48,y:26},
{id:'M2',agency:'Petaluma Fire / EMS',discipline:'EMS',status:'AVAILABLE',location:'Station 2',x:82,y:71},
{id:'M3',agency:'Petaluma Fire / EMS',discipline:'EMS',status:'TRANSPORTING',location:'Hospital',x:16,y:24}
]});
let state=window.CadPersistence.read(KEY)||defaultState();
let cadLocalWorkspace=null;
let cadSharedWorkspaceMode=false;
window.cadSharedApplySnapshot=function(snapshot){
 if(!cadSharedWorkspaceMode){cadLocalWorkspace=state;cadSharedWorkspaceMode=true;}
 const previous=state.selected;
 const detailScroll=document.getElementById('detail')?.scrollTop||0;
 const pageScroll=window.scrollY;
 const assigned=new Map();
 for(const a of snapshot.assignments||[]){
  if(!assigned.has(a.incident_id))assigned.set(a.incident_id,[]);
  const u=(snapshot.roster||[]).find(u=>u.id===a.unit_id);
  if(u)assigned.get(a.incident_id).push(u.call_sign);
 }
 const incidents=(snapshot.incidents||[]).map(i=>({
  id:i.incident_number,sharedUuid:i.id,sharedVersion:i.version,caseNumber:i.case_number||'',agency:'SonoMarzi CAD Demo Agency',
  discipline:i.discipline,priority:i.priority,type:i.type,location:i.current_location,
  status:i.status,units:assigned.get(i.id)||[],narrative:(snapshot.incidentEvents||[]).filter(e=>e.incident_id===i.id&&e.event_type==='NARRATIVE_ADDED').slice().reverse().map(e=>e.payload?.text||''),
  events:(snapshot.incidentEvents||[]).filter(e=>e.incident_id===i.id).slice().reverse().map(e=>new Date(e.occurred_at).toLocaleTimeString()+' · '+e.event_type+' '+JSON.stringify(e.payload||{})),
  caller:'',phone:'',locations:(snapshot.incidentLocations||[]).filter(l=>l.incident_id===i.id).slice().reverse().map(l=>({role:l.classification||'PRIMARY',address:l.address,source:l.source||'SHARED_DATABASE',recordedAt:l.recorded_at}))
 }));
 const units=(snapshot.roster||[]).map(u=>({id:u.call_sign,sharedUuid:u.id,sharedVersion:u.version,
  agency:u.home_agency_name||'SonoMarzi CAD Demo Agency',discipline:u.discipline,
  resourceType:u.resource_type,status:u.status,location:'Shared CAD',x:50,y:50}));
 state={...cadLocalWorkspace,incidents,units,selected:incidents.some(i=>i.id===previous)?previous:(incidents.find(i=>i.status==='ACTIVE')||incidents[0])?.id||null};
 render();
 const detail=document.getElementById('detail');
 if(detail&&state.selected===previous)detail.scrollTop=detailScroll;
 if(window.scrollY!==pageScroll)window.scrollTo(0,pageScroll);
};
window.cadSharedRestoreLocal=function(){
 if(!cadSharedWorkspaceMode)return;
 state=cadLocalWorkspace;cadLocalWorkspace=null;cadSharedWorkspaceMode=false;render();
};
window.cadSharedIsActive=()=>cadSharedWorkspaceMode;
window.cadSafetyState=()=>state;
window.cadCallTakeSave=()=>save();
window.CadPlanDispatch={preview(incident){const result=window.CadResponsePlans?.recommendIncident(incident);if(incident.responseZoneSource==='MANUAL_UNVERIFIED'&&!incident.responseZoneReviewed)return {ok:false,message:'Operator-entered response zone requires explicit review before plan dispatch.'};if(result?.status!=='ready')return {ok:false,message:result?.message||'No verified response plan.'};if(incident.status==='CLOSED')return {ok:false,message:'Incident closed.'};const assigned=new Set(incident.units||[]);const units=[...new Set(result.rows.flatMap(r=>r.selected))].filter(id=>!assigned.has(id));if(!units.length)return {ok:false,message:'No additional eligible resources in the plan. The published plan may already be satisfied; supplemental requests need an explicitly configured increment.'};const sharedGroups=(()=>{try{return JSON.parse(localStorage.getItem('smcad-shared-crews-v1')||'[]')}catch{return []}})();const busy=new Set(state.incidents.filter(x=>x.status!=='CLOSED').flatMap(x=>x.units||[]));for(const id of units){const group=sharedGroups.find(g=>(!g.agency||g.agency===incident.agency)&&(g.units||[]).includes(id));if(group){const occupied=(group.units||[]).find(other=>other!==id&&busy.has(other));if(occupied)return {ok:false,message:'Shared crew conflict: '+id+' shares a crew with committed '+occupied+'.'};}}for(const id of units){const u=state.units.find(x=>x.id===id);if(!u||u.status!=='AVAILABLE'||state.incidents.some(x=>x.status!=='CLOSED'&&x.id!==incident.id&&x.units.includes(id)))return {ok:false,message:'Unit '+id+' is no longer available. Refresh recommendations.'};}return {ok:true,units,incidentId:incident.id,message:'Plan '+result.plan.type+' / '+result.plan.zone+'. Manual confirmation required.'}},commit(incident,preview){const fresh=this.preview(incident);if(!fresh.ok)return fresh;if(fresh.incidentId!==preview.incidentId||fresh.units.join('|')!==preview.units.join('|'))return {ok:false,message:'Recommendations changed. Review and confirm again.'};const result=window.CadUnitCommands.assignPlan({state,incident,unitIds:fresh.units,event,sharedGroups:cadSharedCrewGroups()});if(!result.ok)return result;const updated=window.CadResponsePlans?.recommendIncident(incident);if(updated?.status==='ready'){incident.responseShortfalls=updated.rows.filter(row=>Number(row.short)>0).map(row=>({type:row.type,missing:Number(row.short)}));if(incident.responseShortfalls.length)event(incident,'RESPONSE_INCOMPLETE '+incident.responseShortfalls.map(row=>row.type+': '+row.missing+' still needed').join('; '));else event(incident,'RESPONSE_REQUIREMENTS_FILLED');}state.selected=incident.id;save();return result}};
window.cadCallTakeEvent=(inc,msg)=>event(inc,msg);
window.cadRestoreMissingDemoCalls=()=>{
 const existing=new Set((state.incidents||[]).map(i=>i.id));
 const missing=defaultState().incidents.filter(i=>!existing.has(i.id));
 if(!missing.length)return 0;
 state.incidents.push(...missing);
 state.seq=Math.max(Number(state.seq)||0,4525);
 save();
 return missing.length;
};
window.cadDemoDataHealth=()=>({incidentCount:state.incidents?.length||0,openCount:(state.incidents||[]).filter(i=>['PENDING','ACTIVE'].includes(i.status)).length,agencyCount:config?.agencies?.length||0});

// Add the expanded incident roster once when upgrading an untouched original 3-call demo.
// Never overwrite or replace saved user-created incidents.
const EIGHT_CALL_SEED_KEY='smcad-eight-call-seed-v15';
if(!localStorage.getItem(EIGHT_CALL_SEED_KEY)){
 const originals=['26-004518','26-004519','26-004520'];
 if(state.incidents.length===3 && originals.every(id=>state.incidents.some(i=>i.id===id))){
  for(const incident of defaultState().incidents){if(!state.incidents.some(i=>i.id===incident.id))state.incidents.push(incident);}
  state.seq=Math.max(Number(state.seq)||0,4525);
  localStorage.setItem(KEY,JSON.stringify(state));
 }
 localStorage.setItem(EIGHT_CALL_SEED_KEY,'1');
}

// Seed three additional patrol units into existing browser demo data, once only.
// Preserve any existing incidents, statuses, assignments, and transcript history.
const SIX_UNIT_SEED_KEY='smcad-six-patrol-seed-v1';
if(!localStorage.getItem(SIX_UNIT_SEED_KEY)){
  if(!Array.isArray(state.units)) state.units=[];
  const seeds=defaultState().units.filter(u=>['3A16','3A18','3A22'].includes(u.id));
  for(const u of seeds) if(!state.units.some(existing=>existing.id===u.id)) state.units.push(u);
  localStorage.setItem(KEY,JSON.stringify(state));
  localStorage.setItem(SIX_UNIT_SEED_KEY,'1');
}
let config=JSON.parse(localStorage.getItem(CFG)||'null')||defaultConfig;
// Add the new field-initiated CFS to existing configurations without replacing agency-defined types.
if(!config||typeof config!=='object')config=structuredClone(defaultConfig);
if(!config.types||typeof config.types!=='object')config.types={};
if(!Array.isArray(config.agencies))config.agencies=[];
if(!Array.isArray(config.types.LAW))config.types.LAW=[];
if(!config.types.LAW.some(t=>String(t).trim().toLowerCase()==='traffic stop')){config.types.LAW.push('Traffic Stop');localStorage.setItem(CFG,JSON.stringify(config));}
let filter='ALL';window.cadUnitDisciplineFilter='ALL';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const escapeCad=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const now=()=>new Date().toLocaleTimeString('en-US',{hour12:false});
// Track status durations for new actions without inventing timestamps for older demo data.
let lastSavedStatuses=new Map((state.units||[]).map(u=>[u.id,u.status]));
// Nonblocking location intelligence: resolve high-confidence geocoded incident locations
// against local agency polygons after creation or a location change. Never dispatch resources.
const cadZonePending=new Map();
const cadZoneAttempted=new Map();
async function cadAutoResponseArea(inc,location){
 const id=inc.id, discipline=inc.discipline;
 try{
  const result=await window.CadIncidentZones?.lookup(location,discipline);
  if(!result?.ok)throw Error(result?.message||'No verified GIS match');
  if(inc.location!==location||inc.discipline!==discipline)return;
  const required=discipline==='LAW'?'beat':'esz';
  if(!result.zones?.[required])throw Error('No '+required+' polygon matched');
  inc.esz=result.zones.esz||null;inc.beat=result.zones.beat||null;
  inc.responseZone=result.zones[required];
  inc.responseZoneSource='GIS_AUTO_MATCH';
  inc.responseZoneReviewed=true;
  inc.responseZoneLookup={address:result.address,lat:result.lat,lon:result.lon,at:new Date().toISOString(),source:result.source,original:discipline+'|'+location};
  inc.responseZoneError=null;
  event(inc,'RESPONSE_AREA_AUTO_MATCH '+required.toUpperCase()+' '+inc.responseZone);
  save();
 }catch(error){
  if(inc.location!==location||inc.discipline!==discipline)return;
  inc.responseZoneError=String(error.message||error);
  // Unverified or unmatched locations must never retain a stale response area.
  localStorage.setItem(KEY,JSON.stringify(state));
  render();
 }finally{cadZonePending.delete(id)}
}
function cadQueueResponseAreas(){
 if(!window.CadIncidentZones?.lookup)return;
 for(const inc of state.incidents||[]){
  const location=String(inc.location||'').trim();
  if(!location||inc.status==='CLOSED')continue;
  const signature=inc.discipline+'|'+location;
  if(inc.responseZoneSource?.startsWith('MANUAL'))continue;
  if(inc.responseZoneLookup&&inc.responseZoneSource!=='GIS_AUTO_MATCH'&&inc.responseZoneSource!=='GIS_POINT_LOOKUP')continue;
  if(inc.responseZoneLookup&&inc.responseZoneLookup.original===signature)continue;
  if(cadZonePending.has(inc.id)||cadZoneAttempted.get(inc.id)===signature)continue;
  cadZoneAttempted.set(inc.id,signature);
  // Do not overwrite a manually reviewed area unless the location itself changes.
  if(inc.responseZoneSource?.startsWith('MANUAL')&&!inc.responseZoneLookup)continue;
  if(inc.responseZoneSource==='GIS_POINT_LOOKUP'&&inc.responseZoneLookup?.original!==signature){inc.esz=null;inc.beat=null;inc.responseZone=null;inc.responseZoneReviewed=false;inc.responseZoneLookup=null;}
  if(inc.responseZoneSource==='GIS_AUTO_MATCH'&&inc.responseZoneLookup?.original!==signature){
   inc.esz=null;inc.beat=null;inc.responseZone=null;inc.responseZoneReviewed=false;inc.responseZoneLookup=null;
  }
  cadZonePending.set(inc.id,signature);
  setTimeout(()=>cadAutoResponseArea(inc,location),150);
 }
}
function cadSyncResponseShortfalls(){
 if(!window.CadResponsePlans?.recommendIncident)return;
 for(const incident of state.incidents||[]){
  if(incident.status==='CLOSED'||!Array.isArray(incident.responseShortfalls))continue;
  const recommendation=window.CadResponsePlans.recommendIncident(incident);
  if(recommendation.status!=='ready')continue;
  const next=recommendation.rows.filter(row=>Number(row.short)>0).map(row=>({type:row.type,missing:Number(row.short)}));
  if(JSON.stringify(incident.responseShortfalls)===JSON.stringify(next))continue;
  incident.responseShortfalls=next;
  if(next.length)event(incident,'RESPONSE_SHORTFALL_UPDATED '+next.map(row=>row.type+': '+row.missing+' needed').join('; '));
  else event(incident,'RESPONSE_REQUIREMENTS_FILLED');
 }
}
function save(){
 if(cadSharedWorkspaceMode){window.alert('Shared CAD changes must be made through authenticated dispatch controls. No local change was saved.');window.cadSharedRequestRefresh?.();return;}
 cadSyncResponseShortfalls();
 for(const u of state.units||[]){
  if(lastSavedStatuses.has(u.id)&&lastSavedStatuses.get(u.id)!==u.status){u.statusChangedAt=Date.now();}
  lastSavedStatuses.set(u.id,u.status);
 }
 window.CadPersistence.write(KEY,state);render();window.cadCallTakeRefresh?.();window.dispatchEvent(new Event('storage'));cadQueueResponseAreas();
}
setTimeout(cadQueueResponseAreas,600);
function event(inc,msg){inc.events.push(`${now()} ${msg}`)}

// Demo-only sequential case numbers, allocated once per incident and persisted locally.
function assignCaseNumber(inc){
 if(inc.caseNumber)return inc.caseNumber;
 const yr=String(new Date().getFullYear()).slice(-2);
 let n=Number(state.caseSequence||0);
 const used=new Set(state.incidents.map(i=>i.caseNumber).filter(Boolean));
 let candidate;
 do{candidate=`${yr}-C${String(++n).padStart(6,'0')}`;}while(used.has(candidate));
 state.caseSequence=n;inc.caseNumber=candidate;event(inc,`CASE_NUMBER_AUTO ${candidate}`);
 return candidate;
}
function cadSharedCrewGroups(){
 try{const groups=JSON.parse(localStorage.getItem('smcad-shared-crews-v1')||'[]');return Array.isArray(groups)?groups:[]}
 catch{return []}
}
function clearCadUnit(inc,u,disposition='',source='MANUAL'){
 return window.CadUnitCommands.clear({incident:inc,unit:u,disposition,source,event,now});
}

// Cross-discipline linked incidents share a common emergency but own their assignments.
// Canonical mapping: one open child per requested discipline across the same incident family.
function cadIncidentFamily(incident){
 const byId=new Map(state.incidents.map(i=>[i.id,i]));
 let current=incident;const seen=new Set();
 while(current?.linkedFrom && byId.has(current.linkedFrom) && !seen.has(current.id)){
  seen.add(current.id);current=byId.get(current.linkedFrom);
 }
 return current||incident;
}
function cadDispatchTarget(source,unit,create=true){
 if(!source||!unit)return {error:'Unknown incident or unit.'};
 if(source.status==='CLOSED')return {error:`${source.id} is closed.`};
 if(!['LAW','FIRE','EMS'].includes(unit.discipline))return {error:`Unrecognized discipline for ${unit.id}.`};
 if(source.discipline===unit.discipline)return {incident:source,created:false};
 const root=cadIncidentFamily(source);
 const relatives=state.incidents.filter(i=>i.id===root.id || cadIncidentFamily(i).id===root.id);
 const existing=relatives.find(i=>i.discipline===unit.discipline && i.status!=='CLOSED');
 if(existing)return {incident:existing,created:false,linked:true,origin:source};
 if(!create)return {incident:null,created:false,linked:true,origin:source};
 const year=String(new Date().getFullYear()).slice(-2);
 let id;
 do {id=`${year}-${String(++state.seq).padStart(6,'0')}`;} while(state.incidents.some(i=>i.id===id));
 const type=unit.discipline==='FIRE'?'Fire Assist':unit.discipline==='EMS'?'Medical Assist':'Police Assist';
 const inc={id,agency:unit.agency,discipline:unit.discipline,priority:source.priority,type,location:source.location,caller:source.caller||'',phone:source.phone||'',narrative:[`Linked ${unit.discipline} response to ${source.id} (${source.discipline})`,...(source.narrative||[]).slice(0,8)],status:'PENDING',units:[],events:[],linkedFrom:source.id,linkedRoot:root.id};
 state.incidents.push(inc);
 event(source,`LINKED_EVENT_CREATED ${id} ${unit.discipline} for ${unit.id}`);
 event(inc,`LINKED_FROM ${source.id} ${source.discipline} / root ${root.id}`);
 return {incident:inc,created:true,linked:true,origin:source};
}
function cadLinkedLabel(incident){
 const root=cadIncidentFamily(incident);
 const relatives=state.incidents.filter(i=>i.id!==incident.id&&cadIncidentFamily(i).id===root.id);
 return (incident.linkedFrom?`Linked from ${incident.linkedFrom}`:'')+(relatives.length?`${incident.linkedFrom?' · ':''}Related: ${relatives.map(i=>`${i.discipline} ${i.id}`).join(', ')}`:'');
}
function cadLinkedNavigation(incident){
 const root=cadIncidentFamily(incident);
 const family=state.incidents.filter(i=>cadIncidentFamily(i).id===root.id);
 if(family.length<2)return '';
 return `<div class="cad-linked-nav" aria-label="Related incident links"><span class="cad-linked-heading">🔗 RELATED EVENTS</span>${family.map(i=>`<button type="button" class="cad-linked-event ${i.id===incident.id?'is-current':''}" data-linked-incident="${escapeCad(i.id)}" ${i.id===incident.id?'disabled aria-current="true"':''} title="Go to ${escapeCad(i.discipline)} incident ${escapeCad(i.id)}">${escapeCad(i.discipline)} · ${escapeCad(i.id)} · ${escapeCad(i.status)}</button>`).join('')}</div>`;
}
function toast(t){$('#toast').textContent=t;$('#toast').classList.add('show');setTimeout(()=>$('#toast').classList.remove('show'),1800)}
function render(){
 const pending=state.incidents.filter(i=>i.status==='PENDING'), active=state.incidents.filter(i=>i.status==='ACTIVE');
 $('#pendingCount').textContent=`(${pending.length})`; $('#activeCount').textContent=`(${active.length})`;
 if(window.cadBoardRender){window.cadBoardRender('pending',pending);window.cadBoardRender('active',active);window.cadBoardRender('units',window.CadDiscipline.filterUnits(state.units,filter));}
 else {$('#pending').innerHTML=pending.map(row).join('')||'<div class="row muted">No pending incidents</div>';$('#activeCalls').innerHTML=active.map(row).join('')||'<div class="row muted">No active incidents</div>';$('#units').innerHTML=state.units.map(u=>`<div class="unit"><b>${u.id}</b><span>${u.agency}</span><span>${u.status}</span></div>`).join('');}
 document.querySelectorAll('.row[data-id]').forEach(el=>{el.onclick=()=>{state.selected=el.dataset.id;render();};});
 renderDetail(); window.cadDispatchInfoRefresh?.(); (window.renderMap||renderMap)();
}
function row(i){return `<div class="row ${state.selected===i.id?'selected':''}" data-id="${escapeCad(i.id)}"><span class="prio ${String(i.priority).toLowerCase()}">${escapeCad(i.priority)}<br><span class="meta">${escapeCad(i.id)}</span></span><span><b>${escapeCad(i.type)}</b>${i.alarmLevel?`<span class="cad-alarm-chip">${escapeCad(i.alarmLevel)}</span>`:''}<div>${escapeCad(i.location)}</div><div class="meta">${escapeCad(i.agency)} • ${escapeCad(i.discipline)}</div></span><span>${escapeCad(i.units.join(', ')||'—')}<div class="meta">${i.caseNumber?'Case '+escapeCad(i.caseNumber):'No case number'}</div></span></div>`}
function renderDetail(){
 const i=state.incidents.find(x=>x.id===state.selected); if(!i){$('#detail').innerHTML='<div class="detailwrap muted">Select an incident.</div>';return}
 if(i.callTakeNewInfoAt)window.cadDispatchInfoRead?.(i.id,i.callTakeNewInfoAt);
 $('#detail').innerHTML=`<div class="detailwrap"><div class="detailhead"><div><b>${escapeCad(i.id)} • ${escapeCad(i.type)}</b>${i.alarmLevel?`<span class="cad-alarm-chip cad-alarm-chip-header">${escapeCad(i.alarmLevel)}</span>`:''}<div>${escapeCad(window.cadCommonPlaces?.resolve(i.location)?.name||'')}${window.cadCommonPlaces?.resolve(i.location)?' · ':''}${escapeCad(i.location)}</div><div class="meta">${i.agency} • ${i.discipline} • ${i.priority} • Case: ${escapeCad(i.caseNumber||'Not assigned')}</div>${cadLinkedNavigation(i)}</div><b>${i.status}</b></div>
 <div class="actions">${cadSharedWorkspaceMode?'<button data-act="shared-dispatch">Dispatch / Manage Shared Units</button><button data-act="shared-case">Set Case #</button><button data-act="shared-note">Add Narrative</button><button data-act="shared-location">Correct Location</button><button data-act="shared-close">Clear Event</button>':`${i.status==='PENDING'?'<button data-act="activate">Activate</button>':''}<button data-act="plan">Response Plan / Recommendations</button><button data-act="assign">Quick Assign</button><button data-act="manage">Dispatch / Manage Units</button><button data-act="edit">Edit Event / Location</button><button data-act="case">Set Case #</button><button data-act="note">Add Narrative</button>${i.status!=='CLOSED'?'<button data-act="close">Clear Event</button>':''}`}</div>
 <div><b>Units:</b> ${i.units.join(', ')||'None'}</div><div id="cadLocationHistory"><strong>Event locations</strong><div>${cadLocationHistory(i).map(l=>'<div>'+escapeCad(l.role)+' · '+escapeCad(l.address)+' · '+escapeCad(l.source)+' · '+escapeCad(l.recordedAt)+'</div>').join('')}</div>${i.locationAdvisory?.pendingUnits?.length?'<div style="color:#ffc778">Location correction: notify / acknowledge '+escapeCad(i.locationAdvisory.pendingUnits.join(', '))+'</div>':''}</div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"><input id="cadLocationSearchInput" aria-label="Search all event locations" placeholder="Search all event locations" style="min-width:220px;padding:8px"><button data-act="location-search">Search locations</button></div><div id="cadLocationSearchResults"></div><section class="cad-incident-notes"><h3>Narratives (${i.narrative.length})</h3><div class="narr">${i.narrative.length?i.narrative.map(escapeCad).join('<br>'):'No narrative entries yet.'}</div></section><div id="cadIncidentZoneInfo"></div><div id="cadIncidentPlanRecommendations"></div>${window.CadAlarmLevels?.renderIncident(i)||''}<h3>Event History</h3><div class="timeline">${i.events.slice().reverse().map(e=>`<div>${escapeCad(e)}</div>`).join('')||'<div>No events yet.</div>'}</div></div>`;
 $$('#detail [data-act]').forEach(b=>b.onclick=()=>detailAction(i,b.dataset.act)); $$('#detail [data-linked-incident]').forEach(b=>b.onclick=()=>{state.selected=b.dataset.linkedIncident;render();}); if(window.CadResponsePlans){const panel=document.getElementById('cadIncidentPlanRecommendations');const result=window.CadResponsePlans.recommendIncident(i);if(panel){const esc=escapeCad;const shortages=result.status==='ready'?result.rows.filter(row=>Number(row.short)>0).map(row=>({type:row.type,missing:Number(row.short)})):[];const stored=(i.responseShortfalls||[]).filter(row=>Number(row.missing)>0);const visibleShortages=result.status==='ready'?shortages:stored;const warning=visibleShortages.length?'<div role="alert" style="border:2px solid #d68b22;border-radius:10px;padding:12px;margin:10px 0;background:rgba(214,139,34,.12)"><strong>⚠ INCOMPLETE RESPONSE — RESOURCES STILL NEEDED</strong>'+visibleShortages.map(row=>'<div><strong>'+esc(row.type)+'</strong>: '+row.missing+' additional unit(s) required</div>').join('')+'<div style="margin-top:6px;font-size:.9em">Dispatch available units now. Use Dispatch / Manage Units to assign replacements or mutual aid. Shortages remain until filled.</div></div>':(i.responseShortfalls?.length?'<div role="status" style="padding:8px">✓ Previously identified response shortages filled.</div>':'');panel.innerHTML='<section class="cad-plan-recommendation"><strong>Response Plan Recommendations</strong>'+warning+'<p>'+esc(result.message)+'</p>'+(result.status==='ready'?'<p>Published plan: '+esc(result.plan.type)+' · Zone '+esc(result.plan.zone)+' · '+esc(result.plan.level||'Standard')+'</p>'+result.rows.map(r=>'<div><strong>'+esc(r.type)+'</strong>: '+esc(r.selected.join(', ')||'No additional eligible units')+' · Plan '+r.requested+' / Assigned '+r.already+' / Needed '+r.need+(r.short?' / Short '+r.short:'')+'</div>').join(''):'')+'</section>'}}if(window.CadResponsePlans){const panel=document.getElementById('cadIncidentPlanRecommendations');if(panel){const result=window.CadResponsePlans.recommendIncident(i);if(result.status==='ready'){const b=document.createElement('button');b.type='button';b.textContent='Dispatch recommended units';b.onclick=()=>{const preview=window.CadPlanDispatch?.preview(i);if(!preview?.ok){alert(preview?.message||'Unable to dispatch');return;}if(!confirm('Dispatch '+preview.units.join(', ')+' to '+i.id+'?\\n'+preview.message))return;const outcome=window.CadPlanDispatch.commit(i,preview);if(!outcome.ok)alert(outcome.message);};panel.appendChild(b)}}}{const zonePanel=document.getElementById('cadIncidentZoneInfo');if(zonePanel){const zones=[['Fire / EMS ESZ',i.esz],['Police beat',i.beat],['Response zone',i.responseZone||i.zone]].filter(x=>x[1]);zonePanel.innerHTML='<section class="cad-response-area"><div class="cad-response-area-head"><div><div class="cad-eyebrow">LOCATION INTELLIGENCE</div><h3>Response areas</h3></div><span class="cad-zone-status '+(['GIS_POINT_LOOKUP','GIS_AUTO_MATCH'].includes(i.responseZoneSource)?'verified':i.responseZoneReviewed?'reviewed':'unverified')+'">'+(i.responseZoneSource==='GIS_AUTO_MATCH'?'Auto GIS matched':i.responseZoneSource==='GIS_POINT_LOOKUP'?'GIS matched':i.responseZoneError?'GIS needs review':i.responseZoneReviewed?'Operator reviewed':'Not verified')+'</span></div><div class="cad-zone-grid"><div class="cad-zone-tile"><span>FIRE / EMS ESZ</span><strong>'+escapeCad(i.esz||'—')+'</strong></div><div class="cad-zone-tile"><span>POLICE BEAT</span><strong>'+escapeCad(i.beat||'—')+'</strong></div><div class="cad-zone-tile"><span>PLAN RESPONSE AREA</span><strong>'+escapeCad(i.responseZone||i.zone||'—')+'</strong></div></div><div class="cad-zone-toolbar"><button class="cad-zone-primary" id="cadLookupResponseZone" type="button">⌖ &nbsp; Find response areas</button><button class="cad-zone-secondary" id="cadManageLocalGIS" type="button">GIS datasets</button><details class="cad-zone-override"><summary>Manual override <span>⌄</span></summary><div class="cad-zone-override-body"><label for="cadManualResponseZone">Response zone or beat ID</label><input id="cadManualResponseZone" value="'+escapeCad(i.responseZone||i.zone||'')+'" placeholder="Enter zone ID"><div class="cad-zone-override-actions"><button id="cadSetResponseZone" type="button">Apply zone</button><button id="cadReviewResponseZone" type="button">Review zone</button></div><small>Operator-entered zones require review before plan dispatch.</small></div></details></div></section>';document.getElementById('cadManageLocalGIS').onclick=()=>window.CadLocalGISAdmin?.open();document.getElementById('cadLookupResponseZone').onclick=async()=>{const button=document.getElementById('cadLookupResponseZone');button.disabled=true;button.textContent='Looking up GIS zones…';try{const result=await window.CadIncidentZones.lookup(i.location,i.discipline);if(!result.ok){alert(result.message);return}const lines=Object.entries(result.zones).map(([k,v])=>k+': '+v);if(!confirm('Address candidate: '+result.address+'\\n'+lines.join('\\n')+'\\n\\nConfirm this location and apply GIS-derived areas to '+i.id+'?'))return;if(i.location!==result.original){alert('Incident location changed. Run lookup again.');return}i.esz=result.zones.esz||null;i.beat=result.zones.beat||null;i.responseZone=i.discipline==='LAW'?i.beat:i.esz;i.responseZoneSource='GIS_POINT_LOOKUP';i.responseZoneReviewed=true;i.responseZoneError=null;i.responseZoneLookup={address:result.address,lat:result.lat,lon:result.lon,at:new Date().toISOString(),original:i.discipline+'|'+i.location,source:result.source==='LOCAL_GEOJSON'?'ArcGIS geocode + local GeoJSON':'ArcGIS geocode + Petaluma GIS'};event(i,'RESPONSE_ZONE_GIS_LOOKUP '+lines.join(' '));save()}catch(error){alert('GIS lookup failed: '+error.message)}finally{button.disabled=false;button.textContent='Look up ESZ / beat from address'}};document.getElementById('cadReviewResponseZone').onclick=()=>{if(i.responseZoneSource!=='MANUAL_UNVERIFIED'){alert('No operator-entered zone awaiting review.');return}if(!confirm('Confirm you independently checked the incident location and jurisdiction for response zone '+i.responseZone+'? This is an operator review, not GIS verification.'))return;i.responseZoneReviewed=true;event(i,'RESPONSE_ZONE_OPERATOR_REVIEW '+i.responseZone);save()};document.getElementById('cadSetResponseZone').onclick=()=>{const entered=document.getElementById('cadManualResponseZone').value.trim();if(!entered){alert('Enter a response zone or beat.');return}if(!confirm('Set operator-entered response zone '+entered+' for '+i.id+'? Verify location and jurisdiction first.'))return;i.responseZone=entered;i.responseZoneSource='MANUAL_UNVERIFIED';i.responseZoneReviewed=false;event(i,'RESPONSE_ZONE_MANUAL '+entered);save()}}}if(window.voiceBindDetail)window.voiceBindDetail(i);window.CadAlarmLevels?.bindIncident(i);
}
// Shared event closure transaction. Requires disposition regardless of entry path.
window.cadCloseEvent=function(incident,disposition,source='MANUAL'){
 const result=window.CadUnitCommands.closeEvent({state,incident,disposition,source,event,now});
 if(result.ok){state.selected=incident.id;save();}
 return result;
};
window.cadSetUnitStatus=function(unitId,status,incidentId=null,source='MANUAL'){
 const unit=state.units.find(u=>u.id===unitId);
 const incident=incidentId?state.incidents.find(i=>i.id===incidentId):null;
 if(incidentId&&!incident)return {ok:false,message:'Event not found'};
 const result=window.CadUnitCommands.setStatus({state,unit,status,incident,event,source});
 if(result.ok&&result.message!=='Status unchanged')save();
 return result;
};

function cadLocationRecord(i,address,role,source,verified){
 return {id:'loc-'+Date.now()+'-'+Math.random().toString(36).slice(2,8),address:String(address||'').trim(),role,source,recordedAt:new Date().toISOString(),verified:!!verified?.ok,lat:verified?.lat??null,lon:verified?.lon??null,beat:verified?.zones?.beat||null,esz:verified?.zones?.esz||null};
}
function cadLocationHistory(i){
 if(!Array.isArray(i.locations))i.locations=[];
 if(!i.locations.length&&i.location)i.locations.push(cadLocationRecord(i,i.location,'PRIMARY','INITIAL',i.responseZoneReviewed?{ok:true,lat:i.responseZoneLookup?.lat,lon:i.responseZoneLookup?.lon,zones:{beat:i.beat,esz:i.esz}}:null));
 return i.locations;
}
window.cadClassifyIncidentLocation=(id,locationId,classification,reason='')=>{
 const i=state.incidents.find(x=>x.id===id),entry=i&&cadLocationHistory(i).find(x=>x.id===locationId);
 if(!entry)return {ok:false,message:'Location record not found'};
 if(!['PREVIOUS','RELATED','REPORTED_IN_ERROR'].includes(classification))return {ok:false,message:'Invalid classification'};
 if(entry.role==='PRIMARY')return {ok:false,message:'Current primary location cannot be reclassified. Change the primary location first.'};
 const old=entry.role;
 // Preserve the original entry and every classification change; never splice, filter or remove location records.
 entry.classificationHistory ||= [];
 entry.classificationHistory.push({from:old,to:classification,reason:String(reason),at:new Date().toISOString()});
 entry.role=classification;event(i,'LOCATION_RECLASSIFIED '+entry.address+' '+old+' TO '+classification+' REASON '+String(reason));save();return {ok:true};
};
function cadFormatPhone(raw){
 const v=String(raw||'').trim();if(!v)return '';
 if(v.startsWith('+'))return '+'+v.slice(1).replace(/[^0-9]/g,'').slice(0,15);
 const digits=v.replace(/\D/g,'');
 const local=digits.length===11&&digits[0]==='1'?digits.slice(1):digits;
 if(local.length===10)return '('+local.slice(0,3)+') '+local.slice(3,6)+'-'+local.slice(6);
 if(local.length>6&&local.length<10)return '('+local.slice(0,3)+') '+local.slice(3,6)+'-'+local.slice(6);
 if(local.length>3&&local.length<=6)return '('+local.slice(0,3)+') '+local.slice(3);
 return local;
}
window.cadPhoneNormalize=raw=>cadPhoneCanonical(raw);
function cadPhoneCanonical(raw){
 const value=String(raw||'').trim(),digits=value.replace(/\D/g,'');
 if(!value)return {ok:true,canonical:'',formatted:''};
 if(value.startsWith('+'))return digits.length>=7&&digits.length<=15?{ok:true,canonical:'+'+digits,formatted:cadFormatPhone(value)}:{ok:false,message:'International numbers must have 7–15 digits after +.'};
 if(digits.length===10)return {ok:true,canonical:'+1'+digits,formatted:cadFormatPhone(value)};
 if(digits.length===11&&digits.startsWith('1'))return {ok:true,canonical:'+'+digits,formatted:cadFormatPhone(value)};
 return {ok:false,message:'Enter a 10-digit U.S. number or an international number beginning with + and country code.'};
}
function cadCallerParts(i){if(i.callerFirstName!==undefined||i.callerLastName!==undefined)return [i.callerFirstName||'',i.callerLastName||''];const words=String(i.caller||'').trim().split(/\s+/);return words.length===2?words:[String(i.caller||''),'']}
window.cadSaveCaller=(id,first,last,address,same,verified)=>{
 const i=state.incidents.find(x=>x.id===id);if(!i)return {ok:false};
 const name=[first.trim(),last.trim()].filter(Boolean).join(' '),old=i.callerLocation||'',next=String(address||'').trim();
 if(old!==next){if(next){cadLocationHistory(i).push(cadLocationRecord(i,next,'CALLER','DISPATCH_EDITOR',verified));}event(i,'CALLER_LOCATION_CHANGED FROM '+(old||'(none)')+' TO '+(next||'(none)'));}
 if(i.caller!==name)event(i,'CALLER_NAME_CHANGED FROM '+(i.caller||'')+' TO '+name);
 i.callerFirstName=first.trim();i.callerLastName=last.trim();i.caller=name;i.callerLocation=next;i.callerSameAsEvent=!!same;save();return {ok:true};
};
window.cadConfiguredTypes=discipline=>[...new Set([...(defaultConfig.types?.[discipline]||[]),...(config.types?.[discipline]||[])])];
window.cadFindEventsByLocation=query=>{
 const q=String(query||'').trim().toLowerCase();if(!q)return [];
 return state.incidents.filter(i=>cadLocationHistory(i).some(l=>l.address.toLowerCase().includes(q))).map(i=>({id:i.id,type:i.type,status:i.status,currentLocation:i.location,locations:i.locations.filter(l=>l.address.toLowerCase().includes(q))}));
};
window.cadAddIncidentLocation=(id,address,role='RELATED',source='DISPATCH',verified=null)=>{
 const i=state.incidents.find(x=>x.id===id),value=String(address||'').trim();
 if(!i||!value)return {ok:false,message:'Event and location required'};
 if(!['RELATED','REPORTED_IN_ERROR','PREVIOUS'].includes(role))return {ok:false,message:'Invalid related location classification'};
 const records=cadLocationHistory(i);records.push(cadLocationRecord(i,value,role,source,verified));
 event(i,'LOCATION_ADDED '+role+' '+value+' VIA '+source+(verified?.ok?' GIS_VERIFIED':' NOT_VERIFIED'));save();return {ok:true};
};
window.cadUpdateIncidentFields=(id,updates,source='DISPATCH')=>
 window.CadIncidentCommands.updateFields({state,id,updates,source,event,save});

function cadUpdateIncidentLocation(i,newLocation,source,verified){
 const previous=i.location,location=String(newLocation||'').trim();
 if(!location)return {ok:false,message:'Location is required'};
 if(previous===location)return {ok:false,message:'Location unchanged'};
 const records=cadLocationHistory(i);const oldPrimary=records.filter(l=>l.role==='PRIMARY').slice(-1)[0];if(oldPrimary){oldPrimary.role='PREVIOUS';oldPrimary.supersededAt=new Date().toISOString();oldPrimary.supersededBy=location;}records.push(cadLocationRecord(i,location,'PRIMARY',source,verified));
 i.location=location;i.beat=null;i.esz=null;i.responseZone=null;i.responseZoneReviewed=false;i.responseZoneLookup=null;i.responseZoneSource='UNVERIFIED';i.responseZoneError=null;
 if(verified?.ok){i.beat=verified.zones?.beat||null;i.esz=verified.zones?.esz||null;i.responseZone=i.discipline==='LAW'?i.beat:i.esz;i.responseZoneReviewed=true;i.responseZoneSource='GIS_POINT_LOOKUP';i.responseZoneLookup={address:verified.address,lat:verified.lat,lon:verified.lon,at:new Date().toISOString(),source:verified.source,original:i.discipline+'|'+location}}
 event(i,'LOCATION_CHANGED '+source+' FROM '+previous+' TO '+location+(verified?.ok?' GIS_VERIFIED':' NOT_VERIFIED'));
 if((i.units||[]).length){i.locationAdvisory={location,previous,at:new Date().toISOString(),pendingUnits:[...i.units],acknowledgedUnits:[]};event(i,'LOCATION_CHANGE_NOTIFY_RESPONDING_UNITS '+i.units.join(','));}
 save();return {ok:true,message:'Location updated'+(verified?.ok?' and GIS validated':' (not verified)')};
}
window.cadAcknowledgeLocation=(id,unitId)=>{const i=state.incidents.find(x=>x.id===id);if(!i?.locationAdvisory?.pendingUnits?.includes(unitId))return {ok:false};i.locationAdvisory.pendingUnits=i.locationAdvisory.pendingUnits.filter(x=>x!==unitId);i.locationAdvisory.acknowledgedUnits.push(unitId);event(i,'LOCATION_ADVISORY_ACK '+unitId);save();return {ok:true}};
window.cadUpdateIncidentLocation=(id,location,source,verified)=>{
 const i=state.incidents.find(x=>x.id===id);return i?cadUpdateIncidentLocation(i,location,source||'MANUAL',verified):{ok:false,message:'Event not found'};
};
function cadDispatchEdit(i){
 document.getElementById('cadDispatchEditDialog')?.remove();
 const dialog=document.createElement('dialog');dialog.id='cadDispatchEditDialog';
 dialog.style.cssText='background:#11263b;color:#f0f7ff;border:1px solid #365772;border-radius:16px;padding:26px;max-width:690px;width:calc(100% - 28px);max-height:88vh;overflow-y:auto;box-shadow:0 24px 80px #000b';
 const heading=document.createElement('h3');heading.textContent='Edit Event · '+i.id;heading.style.cssText='margin:0 0 20px;font-size:21px;letter-spacing:.2px;color:#f2f8ff';
 const form=document.createElement('form');form.method='dialog';form.style.cssText='display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px';
 const field=(name,value)=>{const label=document.createElement('label');label.textContent=name;label.style.cssText='display:grid;gap:7px;font-size:12px;font-weight:700;letter-spacing:.3px;color:#adc7dc;min-width:0';const input=document.createElement('input');input.value=value||'';input.style.cssText='box-sizing:border-box;width:100%;min-width:0;padding:12px;background:#18334b;color:white;border:1px solid #456986;border-radius:9px;font-size:14px';label.append(input);form.append(label);return input};
 const typeLabel=document.createElement('label');typeLabel.textContent='Call for Service (CFS) type';typeLabel.style.cssText='display:grid;gap:7px;font-size:12px;font-weight:700;color:#adc7dc';
 const type=document.createElement('select');type.style.cssText='box-sizing:border-box;width:100%;min-width:0;padding:12px;background:#18334b;color:white;border:1px solid #456986;border-radius:9px;font-size:14px';
 const options=[...new Set([i.type,...(defaultConfig.types?.[i.discipline]||[]),...(config.types?.[i.discipline]||[])].filter(Boolean))];
 for(const name of options){const option=document.createElement('option');option.value=name;option.textContent=name;type.append(option)}
 type.value=i.type;typeLabel.append(type);form.append(typeLabel);
 const location=field('Primary location',i.location);location.parentElement.style.gridColumn='1 / -1';
 const [firstName,lastName]=cadCallerParts(i);
 const callerFirst=field('Caller first name',firstName),callerLast=field('Caller last name',lastName),phone=field('Caller phone',i.phone);
 phone.type='tel';phone.inputMode='tel';phone.autocomplete='tel';phone.placeholder='(707) 555-1212 or +44 20 7946 0958';
 phone.value=cadFormatPhone(i.phone||'');phone.addEventListener('blur',()=>{const check=cadPhoneCanonical(phone.value);if(check.ok)phone.value=check.formatted});
 const callerLocation=field('Caller location',i.callerLocation||'');callerLocation.parentElement.style.gridColumn='1 / -1';
 const sameRow=document.createElement('label');sameRow.style.cssText='grid-column:1 / -1;display:flex;align-items:center;gap:10px;color:#c9e3f3;font-size:13px';
 const sameLocation=document.createElement('input');sameLocation.type='checkbox';sameLocation.checked=!!i.callerSameAsEvent;sameLocation.style.cssText='width:18px;height:18px;accent-color:#3198ee';
 sameRow.append(sameLocation,document.createTextNode('Caller is at the same location as the event'));form.append(sameRow);
 let callerVerified=null;window.cadAddressPicker?.(callerLocation,()=>i.discipline,v=>{callerVerified=v});
 const syncCaller=()=>{callerLocation.readOnly=sameLocation.checked;if(sameLocation.checked){callerLocation.value=location.value;callerVerified=null}callerLocation.style.opacity=sameLocation.checked?'.7':'1'};
 sameLocation.onchange=syncCaller;location.addEventListener('input',()=>{if(sameLocation.checked)syncCaller()});syncCaller();
 const priorityLabel=document.createElement('label');priorityLabel.textContent='Priority';priorityLabel.style.cssText=typeLabel.style.cssText;
 const priority=document.createElement('select');priority.style.cssText=type.style.cssText;
 for(const p of ['P1','P2','P3','P4','P5']){const o=document.createElement('option');o.value=p;o.textContent=p;priority.append(o)}priority.value=i.priority||'P2';priorityLabel.append(priority);form.insertBefore(priorityLabel,location.parentElement);
 const agency=field('Agency',i.agency);const disciplineLabel=document.createElement('label');disciplineLabel.textContent='Discipline';disciplineLabel.style.cssText=typeLabel.style.cssText;
 const discipline=document.createElement('select');discipline.style.cssText=type.style.cssText;
 for(const d of ['LAW','FIRE','EMS']){const o=document.createElement('option');o.value=d;o.textContent=d;discipline.append(o)}discipline.value=i.discipline;disciplineLabel.append(discipline);form.append(disciplineLabel);
 discipline.onchange=()=>{const selected=type.value;type.replaceChildren();for(const name of [...new Set([selected,...(defaultConfig.types?.[discipline.value]||[]),...(config.types?.[discipline.value]||[])])]){const o=document.createElement('option');o.value=name;o.textContent=name;type.append(o)}type.value=selected};
 const note=field('Add narrative (optional)','');note.parentElement.style.gridColumn='1 / -1';
 const related=field('Add related location (optional)','');related.parentElement.style.gridColumn='1 / -1';
 let relatedVerified=null;window.cadAddressPicker?.(related,()=>discipline.value,v=>{relatedVerified=v});
 let verified=null;
 window.cadAddressPicker?.(location,()=>i.discipline,v=>{verified=v});
 const info=document.createElement('p');info.style.cssText='font-size:12px;color:#f4c68c';info.textContent='Unverified locations may be saved. Assigned units must be advised of location changes.';info.style.gridColumn='1 / -1';info.style.margin='0';form.append(info);
 const actions=document.createElement('div');actions.style.cssText='display:flex;gap:12px;justify-content:flex-end;grid-column:1 / -1;border-top:1px solid #34516a;padding-top:18px;margin-top:4px';
 const saveButton=document.createElement('button');saveButton.type='button';saveButton.textContent='Save changes';saveButton.className='primary';saveButton.style.cssText='padding:11px 18px;border-radius:9px;font-weight:700';
 const cancel=document.createElement('button');cancel.type='button';cancel.textContent='Cancel';cancel.onclick=()=>dialog.close();cancel.style.cssText='padding:11px 18px;border-radius:9px;background:#203c55;color:#dbeaf6;border:1px solid #496780';
 actions.append(saveButton,cancel);form.append(actions);dialog.append(heading,form);document.body.append(dialog);
 saveButton.onclick=()=>{
  if(!type.value.trim()||!location.value.trim()){info.textContent='Incident type and location are required.';info.style.color='#ff9898';return}
  const checkedPhone=cadPhoneCanonical(phone.value);
  if(!checkedPhone.ok){info.textContent=checkedPhone.message;info.style.color='#ff9898';phone.focus();return}
  const updated=window.cadUpdateIncidentFields(i.id,{type:type.value,priority:priority.value,agency:agency.value,discipline:discipline.value,phone:checkedPhone.formatted,narrative:note.value},'DISPATCH_EDITOR');
  if(!updated.ok){info.textContent=updated.message;return}
  i.callerPhoneCanonical=checkedPhone.canonical;
  if(location.value.trim()!==i.location)cadUpdateIncidentLocation(i,location.value.trim(),'DISPATCH_EDITOR',verified?.result);
  window.cadSaveCaller(i.id,callerFirst.value,callerLast.value,sameLocation.checked?location.value:callerLocation.value,sameLocation.checked,sameLocation.checked?verified?.result:callerVerified?.result);
  if(related.value.trim())window.cadAddIncidentLocation(i.id,related.value.trim(),'RELATED','DISPATCH_EDITOR',relatedVerified?.result||null);
  save();
  dialog.close();toast('Event '+i.id+' updated');
 };
 dialog.addEventListener('close',()=>dialog.remove());dialog.showModal();
}

function detailAction(i,a){
 if(a==='shared-dispatch'){window.dispatchEvent(new CustomEvent('cad:shared-dispatch',{detail:{incidentId:i.id}}));return;}
 if(a==='shared-case'){const caseNumber=prompt('Case number:',i.caseNumber||'');if(caseNumber===null)return;window.cadSharedCommand('case',{incidentId:i.id,caseNumber:caseNumber.trim()}).catch(e=>alert(e.message));return;}
 if(a==='shared-note'){const text=prompt('Add narrative to '+i.id+':');if(!text?.trim())return;window.cadSharedCommand('note',{incidentId:i.id,text:text.trim()}).catch(e=>alert(e.message));return;}
 if(a==='shared-close'){const disposition=prompt('Disposition for '+i.id+':');if(!disposition?.trim())return;window.cadSharedCommand('close',{incidentId:i.id,disposition:disposition.trim()}).catch(e=>alert(e.message));return;}
 if(a==='shared-location'){const location=prompt('Correct incident location:',i.location);if(!location?.trim()||location.trim()===i.location)return;window.cadSharedCommand('location',{incidentId:i.id,location:location.trim()}).catch(e=>alert(e.message));return;}
 if(a==='edit'){cadDispatchEdit(i);return;}
 if(a==='location-search'){const q=document.getElementById('cadLocationSearchInput')?.value||'';const matches=window.cadFindEventsByLocation(q);const panel=document.getElementById('cadLocationSearchResults');if(panel)panel.innerHTML=matches.length?matches.map(m=>'<div><button data-location-result="'+escapeCad(m.id)+'">'+escapeCad(m.id)+'</button> · '+escapeCad(m.type)+' · '+m.locations.map(l=>escapeCad(l.role+': '+l.address)).join(' | ')+'</div>').join(''):'No matching locations';panel?.querySelectorAll('[data-location-result]').forEach(b=>b.onclick=()=>{state.selected=b.dataset.locationResult;render()});return;}
 if(a==='activate'){i.status='ACTIVE';event(i,'INCIDENT_ACTIVATED')}
 if(a==='assign'){let u=state.units.find(u=>u.discipline===i.discipline&&u.status==='AVAILABLE');if(u){const resolved=cadDispatchTarget(i,u);const target=resolved.incident;const result=window.CadUnitCommands.assign({state,incident:target,unit:u,event,sharedGroups:cadSharedCrewGroups()});if(!result.ok)toast(result.message)}else toast('No available unit of '+i.discipline+' discipline')}
 if(a==='plan'){const panel=document.getElementById('cadIncidentPlanRecommendations');if(panel){panel.scrollIntoView({block:'center',behavior:'smooth'});panel.style.outline='2px solid #46b7ec';setTimeout(()=>panel.style.outline='',1800)}return}
 if(a==='manage'){show('dispatch');document.getElementById('operationsPanel')?.scrollIntoView({block:'nearest'});window.cadOpsSelectIncident?.(i.id);return}
 if(a==='case'){const n=prompt('Case number (leave blank to remove)',i.caseNumber||'');if(n!==null){i.caseNumber=n.trim().slice(0,80);event(i,`CASE_NUMBER ${i.caseNumber||'REMOVED'}`)}}
 if(a==='note'){let n=prompt('Narrative entry');if(n?.trim()){const text=n.trim(),timestamp=new Date().toISOString();const author=(localStorage.getItem('smcad-dispatcher-identity-v1')||'').trim()||'Unidentified';i.narrative.push(text);(i.manualNarrativeEntries ||= []).push({id:'manual-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),text,timestamp,author});event(i,'NARRATIVE_ADDED '+timestamp+' BY '+author)}}
 if(a==='close'){window.cadShowClearEvent?.(i);return;}
 save();
}
function renderMap(){
 $('#map').querySelectorAll('.marker').forEach(m=>m.remove());
 state.units.forEach(u=>{let m=document.createElement('div');m.className='marker '+u.discipline.toLowerCase();m.style.left=u.x+'%';m.style.top=u.y+'%';m.title=`${u.id} ${u.status}`;$('#map').appendChild(m)})
}
function availableAgencies(){
 const names=['Petaluma Police'];
 const add=a=>{const n=String(a??'').trim();if(n&&!names.some(x=>x.toLowerCase()===n.toLowerCase()))names.push(n)};
 for(const a of defaultConfig.agencies)add(a);
 for(const a of config.agencies||[])add(a);
 for(const a of state.incidents||[])add(a.agency);
 for(const u of state.units||[])add(u.agency);
 try{for(const a of window.CadAgencyMaster?.read(localStorage)?.agencies||[])add(a.name)}catch(e){console.warn('Agency master unavailable',e)}
 return names;
}
function populate(){
 const agency=$('#agency'),previous=agency.value;
 agency.innerHTML=availableAgencies().map(a=>`<option value="${escapeCad(a)}">${escapeCad(a)}</option>`).join('');
 agency.value=availableAgencies().includes(previous)?previous:'Petaluma Police';
 updateTypes();
 $('#cfgAgencies').value=(config.agencies||[]).join('\n');$('#cfgLaw').value=(config.types?.LAW||[]).join('\n');$('#cfgFire').value=(config.types?.FIRE||[]).join('\n');$('#cfgEms').value=(config.types?.EMS||[]).join('\n');
}
function updateTypes(){const d=$('#discipline').value;const types=[...new Set([...(defaultConfig.types[d]||[]),...(config.types?.[d]||[])])];$('#type').innerHTML=types.map(t=>`<option value="${escapeCad(t)}">${escapeCad(t)}</option>`).join('')}

/* Live CAD address suggestions, independent of response-area polygon datasets. */
window.cadAddressPicker=(input,disciplineFor,onVerified)=>{
 if(!input||input.dataset.cadPickerInstalled)return;
 input.dataset.cadPickerInstalled='1';
 const wrap=document.createElement('div');wrap.className='cad-address-assist';
 const badge=document.createElement('span');badge.className='cad-address-badge';badge.textContent='Not verified';badge.style.cssText='display:inline-flex;padding:5px 9px;margin:6px 0;border-radius:6px;border:1px solid #c75d5d;color:#ffc1c1;background:#40212b;font-size:12px;font-weight:700';
 const list=document.createElement('div');list.setAttribute('role','listbox');list.style.cssText='display:none;position:relative;z-index:30;background:#10263b;border:1px solid #4b7395;border-radius:8px;max-height:210px;overflow:auto;box-shadow:0 8px 20px #0008';
 wrap.append(badge,list);input.insertAdjacentElement('afterend',wrap);
 let timer=0,seq=0,options=[],active=-1,verified=null;
 const mark=(mode,label)=>{badge.textContent=label;const color=mode==='valid'?'#9df0b8':mode==='loading'?'#f5d38a':'#ffc1c1';badge.style.color=color;badge.style.borderColor=color;badge.style.background=mode==='valid'?'#173d2d':mode==='loading'?'#3c3420':'#40212b'};
 const hide=()=>{list.style.display='none';list.replaceChildren();active=-1};
 const invalidate=()=>{verified=null;input.dataset.cadVerified='';onVerified?.(null);mark('invalid',input.value.trim()?'Not verified':'Location required')};
 const choose=async item=>{
  hide();input.value=item.address;invalidate();mark('loading','Validating…');
  const current=++seq,discipline=disciplineFor(),value=input.value.trim();
  try{
   const r=await window.CadIncidentZones.lookup(value,discipline);
   if(current!==seq||input.value.trim()!==value||disciplineFor()!==discipline)return;
   if(!r?.ok||!r.zones?.[discipline==='LAW'?'beat':'esz']){mark('invalid','Not verified');return}
   verified={location:value,discipline,result:r};input.dataset.cadVerified='true';onVerified?.(verified);
   mark('valid','✓ Valid · '+(discipline==='LAW'?'Beat ':'ESZ ')+r.zones[discipline==='LAW'?'beat':'esz']);
  }catch(e){if(current===seq)mark('invalid','Validation unavailable')}
 };
 const draw=()=>{
  list.replaceChildren();if(!options.length){hide();return}
  options.forEach((item,n)=>{const b=document.createElement('button');b.type='button';b.setAttribute('role','option');b.setAttribute('aria-selected',String(n===active));b.textContent=item.address;b.style.cssText='display:block;width:100%;text-align:left;padding:10px 12px;background:'+(n===active?'#235478':'transparent')+';border:0;color:#eff8ff;cursor:pointer';b.addEventListener('mousedown',e=>e.preventDefault());b.addEventListener('click',()=>choose(item));list.append(b)});list.style.display='block';
 };
 const search=async query=>{
  const request=++seq;mark('loading','Searching addresses…');
  try{
   const u=new URL('https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/suggest');
   u.searchParams.set('text',/petaluma/i.test(query)?query:query+', Petaluma, CA');
   u.searchParams.set('f','json');u.searchParams.set('maxSuggestions','6');
   const response=await fetch(u);if(!response.ok)throw Error('Search unavailable');
   const data=await response.json();if(data.error)throw Error(data.error.message||'Search unavailable');
   if(request!==seq)return;
   options=(data.suggestions||[]).map(x=>({address:x.text})).filter(x=>x.address);active=-1;draw();
   mark('invalid','Not verified · select a suggestion');
  }catch(e){if(request===seq){hide();mark('loading','Suggestions unavailable')}}
 };
 input.addEventListener('input',()=>{clearTimeout(timer);++seq;invalidate();hide();const q=input.value.trim();if(q.length>=3)timer=setTimeout(()=>search(q),300)});
 input.addEventListener('keydown',e=>{if(list.style.display==='none')return;if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();active=(active+(e.key==='ArrowDown'?1:options.length-1))%options.length;draw()}else if(e.key==='Enter'&&active>=0){e.preventDefault();e.stopImmediatePropagation();choose(options[active])}else if(e.key==='Escape'){hide()}});
 input.addEventListener('blur',()=>setTimeout(hide,180));
 return {getVerified:()=>verified,invalidate};
};

$('#discipline').onchange=updateTypes;
const cadNewLocation=$('#location');
let cadNewVerified=null;
window.cadAddressPicker(cadNewLocation,()=>$('#discipline').value,v=>{cadNewVerified=v});
$('#discipline').addEventListener('change',()=>{cadNewVerified=null;cadNewLocation.dispatchEvent(new Event('input'))});

const newCallerLocation=$('#newCallerLocation'),newCallerSame=$('#newCallerSameAsEvent'),newPhone=$('#phone');
 let newCallerVerified=null;
 window.cadAddressPicker?.(newCallerLocation,()=>$('#discipline').value,v=>{newCallerVerified=v});
 const syncNewCaller=()=>{newCallerLocation.readOnly=newCallerSame.checked;if(newCallerSame.checked){newCallerLocation.value=$('#location').value;newCallerVerified=null}newCallerLocation.style.opacity=newCallerSame.checked?'.75':'1'};
 newCallerSame.addEventListener('change',syncNewCaller);
 $('#location').addEventListener('input',()=>{if(newCallerSame.checked)syncNewCaller()});
 newPhone.addEventListener('blur',()=>{const result=cadPhoneCanonical(newPhone.value);if(result.ok)newPhone.value=result.formatted});
 $('#createCall').onclick=()=>{
 const agency=$('#agency').value.trim(),discipline=$('#discipline').value;
 const type=($('#customIncidentType').value.trim()||$('#type').value||'').trim();
 const location=$('#location').value.trim();
 if(!agency){toast('Select an agency');$('#agency').focus();return}
 if(!type){toast('Incident type is required');$('#type').focus();$('#type').style.outline='2px solid #ef7777';return}
 if(!location){toast('Location is required');$('#location').focus();$('#location').style.outline='2px solid #ef7777';return}
 const checkedPhone=cadPhoneCanonical($('#phone').value);if(!checkedPhone.ok){toast(checkedPhone.message);$('#phone').focus();return}
 if(cadSharedWorkspaceMode){
  window.cadSharedCommand('create',{discipline,type,priority:$('#priority').value,location:window.cadCommonPlaces?.resolve(location)?.address||location}).then(created=>{
   state.selected=created.incident_number;
   render();
   toast('Shared call created: '+created.incident_number);
  }).catch(e=>alert(e.message));
  return;
 }
 const id=`${String(new Date().getFullYear()).slice(-2)}-${String(++state.seq).padStart(6,'0')}`;
 const initialNote=$('#narrative').value.trim();
 const i={id,caseNumber:$('#newCaseNumber').value.trim().slice(0,80),agency,discipline,priority:$('#priority').value,type,location:window.cadCommonPlaces?.resolve(location)?.address||location,caller:[$('#callerFirstName').value.trim(),$('#callerLastName').value.trim()].filter(Boolean).join(' '),callerFirstName:$('#callerFirstName').value.trim(),callerLastName:$('#callerLastName').value.trim(),callerLocation:newCallerSame.checked?location:newCallerLocation.value.trim(),callerSameAsEvent:newCallerSame.checked,phone:checkedPhone.formatted,callerPhoneCanonical:checkedPhone.canonical,narrative:initialNote?[initialNote]:[],status:'PENDING',units:[],events:[]};
 if(cadNewVerified&&cadNewVerified.location===location&&cadNewVerified.discipline===discipline){
 const r=cadNewVerified.result;i.location=location;i.esz=r.zones.esz||null;i.beat=r.zones.beat||null;
 i.responseZone=discipline==='LAW'?i.beat:i.esz;i.responseZoneReviewed=true;i.responseZoneSource='GIS_POINT_LOOKUP';
 i.responseZoneLookup={address:r.address,lat:r.lat,lon:r.lon,source:r.source,at:new Date().toISOString(),original:discipline+'|'+location};
}else{i.responseZoneReviewed=false;i.responseZoneSource='UNVERIFIED';event(i,'LOCATION_NOT_VERIFIED')}
 cadLocationHistory(i);
 if(i.callerLocation)cadLocationHistory(i).push(cadLocationRecord(i,i.callerLocation,'CALLER','CALL_TAKING',newCallerSame.checked?cadNewVerified?.result:newCallerVerified?.result));
 event(i,'CALL_CREATED');state.incidents.push(i);state.selected=id;save();
 for(const key of ['newCaseNumber','customIncidentType','location','callerFirstName','callerLastName','newCallerLocation','phone','narrative'])$('#'+key).value='';
 $('#priority').value='P2';newCallerSame.checked=false;newCallerVerified=null;syncNewCaller();cadNewVerified=null;cadNewLocation.dispatchEvent(new Event('input'));
 if(document.getElementById('calltake')?.classList.contains('active'))window.cadCallTakeSelect?.(id);else show('dispatch');
 toast('Pending call created: '+id);
};

$$('nav [data-view]').forEach(b=>b.onclick=()=>show(b.dataset.view));
window.cadShowView=show;
function show(v){$$('.view').forEach(x=>x.classList.toggle('active',x.id===v));$$('nav [data-view]').forEach(x=>x.classList.toggle('active',x.dataset.view===v));if(v==='calltake')window.cadCallTakeRefresh?.()}
document.querySelector('[data-panel="units"] .filters')?.addEventListener('click',e=>{
 const btn=e.target.closest('button[data-discipline]');
 if(!btn)return;
 filter=window.CadDiscipline.normalize(btn.dataset.discipline);
 window.cadUnitDisciplineFilter=filter;
 document.querySelectorAll('[data-panel="units"] button[data-discipline]').forEach(x=>x.classList.toggle('active',x===btn));
 render();
});
// The enhanced command desk installs its own keyboard handling from command-intelligence.js.
$('#saveConfig').onclick=()=>{config={...config,agencies:$('#cfgAgencies').value.split('\n').filter(Boolean),types:{LAW:$('#cfgLaw').value.split('\n').filter(Boolean),FIRE:$('#cfgFire').value.split('\n').filter(Boolean),EMS:$('#cfgEms').value.split('\n').filter(Boolean)}};localStorage.setItem(CFG,JSON.stringify(config));populate();toast('Configuration saved')}
window.cadLinkExistingMasterUnits=function(){
 try{
  const result=window.CadUnitActivation.linkExisting(window.CadAgencyMaster.read(localStorage),state);
  if(result.linked){state=result.state;save();}
  return {ok:true,linked:result.linked};
 }catch(e){return {ok:false,error:e.message}}
};
window.cadActivateMasterUnit=function(masterUnitId){
 try{
  const master=window.CadAgencyMaster.read(localStorage);
  state=window.CadUnitActivation.activate(master,state,masterUnitId);
  save();toast('Configured unit activated in CAD');
  return {ok:true};
 }catch(e){toast('Unit not activated: '+e.message);return {ok:false,error:e.message};}
};
window.cadStaffMasterUnit=function(unitId,personIds){
 try{state=window.CadUnitStaffing.assign(window.CadAgencyMaster.read(localStorage),state,unitId,personIds);save();toast('Crew signed on to '+unitId);return {ok:true};}
 catch(e){toast('Sign-on rejected: '+e.message);return {ok:false,error:e.message};}
};
window.cadSignOffMasterUnit=function(unitId){
 try{state=window.CadUnitStaffing.signOff(state,unitId);save();toast('Crew signed off '+unitId);return {ok:true};}
 catch(e){toast('Sign-off rejected: '+e.message);return {ok:false,error:e.message};}
};
window.cadMasterActiveUnits=function(){return state.units.filter(u=>u.masterUnitId).map(u=>({id:u.id,masterUnitId:u.masterUnitId,status:u.status,staffing:u.staffing||null}));};
// Demo incidents are optional and can be reloaded without touching Agency Master or unit status.
if($('#reset')&&!document.getElementById('cadLoadDemoCalls')){
 const btn=document.createElement('button');
 btn.id='cadLoadDemoCalls';btn.type='button';btn.textContent='Load Demo Calls';
 btn.title='Restore missing fictional sample incidents without resetting agencies, units or existing calls';
 $('#reset').insertAdjacentElement('beforebegin',btn);
 btn.addEventListener('click',()=>{
  const count=window.cadRestoreMissingDemoCalls();
  toast(count?count+' demo calls loaded; existing records preserved':'All standard demo calls are already present');
 });
}
$('#reset').onclick=()=>{
 if(!confirm('RESET ENTIRE DEMO?\n\nThis will erase all browser-saved incidents, cases, unit assignments/statuses, radio transcripts, AI summaries, activity history, and legacy demo settings. Permanent Agency Master records will NOT be erased. It will restore the original sample data.\n\nThis cannot be undone.'))return;
 localStorage.setItem(KEY,JSON.stringify(defaultState()));
 localStorage.removeItem(CFG);
 localStorage.removeItem('smcad-agency-phrase-preview-v1');
 localStorage.setItem(SIX_UNIT_SEED_KEY,'1');
 // Reload cancels any pending summary requests and resets voice/operations UI.
 window.location.reload();
}
$('#simulateBtn').onclick=()=>simulate();
function simulate(){
 toast('Simulation running');
 let demoId=null;
 const steps=[
  ()=>{
   const i={id:`26-${String(++state.seq).padStart(6,'0')}`,agency:'Petaluma Fire / EMS',discipline:'FIRE',priority:'P1',type:'Structure Fire',location:'450 East Washington St',caller:'Multiple callers',phone:'911',narrative:['Smoke and flames visible from second floor.'],status:'PENDING',units:[],events:[]};
   event(i,'911_CALL_RECEIVED');state.incidents.push(i);state.selected=i.id;demoId=i.id;save();
  },
  ()=>{
   const incident=state.incidents.find(i=>i.id===demoId);
   if(!incident)return;
   const result=window.CadUnitCommands.assignPlan({state,incident,unitIds:['E1','E2','M2'],event,sharedGroups:cadSharedCrewGroups()});
   if(!result.ok){toast('Simulation dispatch blocked: '+result.message);demoId=null;return}
   save();
  },
  ()=>{
   const incident=state.incidents.find(i=>i.id===demoId);
   if(!incident)return;
   for(const id of ['E1','E2','M2']){
    const result=window.CadUnitCommands.setStatus({state,unit:state.units.find(u=>u.id===id),status:'ENROUTE',incident,event,source:'SIMULATION'});
    if(!result.ok){toast('Simulation status blocked: '+result.message);return}
   }
   event(incident,'UNITS_ENROUTE');save();
  },
  ()=>{
   const incident=state.incidents.find(i=>i.id===demoId);
   if(!incident)return;
   const result=window.CadUnitCommands.setStatus({state,unit:state.units.find(u=>u.id==='E1'),status:'ONSCENE',incident,event,source:'SIMULATION'});
   if(!result.ok){toast('Simulation status blocked: '+result.message);return}
   incident.narrative.push('E1 on scene, working fire declared.');
   event(incident,'E1 ONSCENE / WORKING FIRE');save();
  }
 ];
 steps.forEach((step,index)=>setTimeout(step,index*1800));
}

window.addEventListener('storage',()=>{state=JSON.parse(localStorage.getItem(KEY)||'null')||state;render()});
setInterval(()=>$('#clock').textContent=new Date().toLocaleString('en-US',{hour12:false}),1000);
populate();render();
const params=new URLSearchParams(location.search);if(params.get('panel')){document.querySelector('nav').style.display='none';document.querySelector('header').style.position='static';let p=params.get('panel');$$('.panel').forEach(x=>x.style.display=x.dataset.panel===p?'block':'none');$('.grid').style.gridTemplateColumns='1fr';$('.command').style.display='none'}
