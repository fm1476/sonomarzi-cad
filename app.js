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
let state=JSON.parse(localStorage.getItem(KEY)||'null')||defaultState();
window.cadSafetyState=()=>state;
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
if(!Array.isArray(config.types?.LAW))config.types.LAW=[];
if(!config.types.LAW.some(t=>String(t).trim().toLowerCase()==='traffic stop')){config.types.LAW.push('Traffic Stop');localStorage.setItem(CFG,JSON.stringify(config));}
let filter='ALL';window.cadUnitDisciplineFilter='ALL';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const escapeCad=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const now=()=>new Date().toLocaleTimeString('en-US',{hour12:false});
// Track status durations for new actions without inventing timestamps for older demo data.
let lastSavedStatuses=new Map((state.units||[]).map(u=>[u.id,u.status]));
function save(){
 for(const u of state.units||[]){
  if(lastSavedStatuses.has(u.id)&&lastSavedStatuses.get(u.id)!==u.status){u.statusChangedAt=Date.now();}
  lastSavedStatuses.set(u.id,u.status);
 }
 localStorage.setItem(KEY,JSON.stringify(state));render();window.dispatchEvent(new Event('storage'));
}
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
function clearCadUnit(inc,u,disposition='',source='MANUAL'){
 if(!inc.units.includes(u.id))return {ok:false,message:`${u.id} not assigned to ${inc.id}`};
 const d=String(disposition||'').trim();
 inc.units=inc.units.filter(id=>id!==u.id);u.status='CLEAR';u.location='Available';
 if(d){inc.dispositions ||= [];inc.dispositions.push({unitId:u.id,time:now(),value:d});}
 event(inc,`UNIT_CLEARED ${u.id} ${source}${d?' DISPO: '+d:''}`);
 // Never drop a call from the board while another unit remains committed.
 if(inc.units.length===0){inc.status=d?'CLOSED':'PENDING';event(inc,d?`INCIDENT_CLOSED DISPO: ${d}`:'INCIDENT_RETURNED_PENDING NO_DISPOSITION');}
 return {ok:true,message:`${u.id} cleared. Event ${inc.id} ${inc.status}${d?' | Dispo: '+d:''}.`};
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
 $$('.row[data-id]').forEach(el=>el.onclick=()=>{state.selected=el.dataset.id;render()});
 renderDetail(); (window.renderMap||renderMap)();
}
function row(i){return `<div class="row ${state.selected===i.id?'selected':''}" data-id="${escapeCad(i.id)}"><span class="prio ${String(i.priority).toLowerCase()}">${escapeCad(i.priority)}<br><span class="meta">${escapeCad(i.id)}</span></span><span><b>${escapeCad(i.type)}</b><div>${escapeCad(i.location)}</div><div class="meta">${escapeCad(i.agency)} • ${escapeCad(i.discipline)}</div></span><span>${escapeCad(i.units.join(', ')||'—')}<div class="meta">${i.caseNumber?'Case '+escapeCad(i.caseNumber):'No case number'}</div></span></div>`}
function renderDetail(){
 const i=state.incidents.find(x=>x.id===state.selected); if(!i){$('#detail').innerHTML='<div class="detailwrap muted">Select an incident.</div>';return}
 $('#detail').innerHTML=`<div class="detailwrap"><div class="detailhead"><div><b>${i.id} • ${i.type}</b><div>${escapeCad(window.cadCommonPlaces?.resolve(i.location)?.name||'')}${window.cadCommonPlaces?.resolve(i.location)?' · ':''}${escapeCad(i.location)}</div><div class="meta">${i.agency} • ${i.discipline} • ${i.priority} • Case: ${escapeCad(i.caseNumber||'Not assigned')}</div>${cadLinkedNavigation(i)}</div><b>${i.status}</b></div>
 <div class="actions">${i.status==='PENDING'?'<button data-act="activate">Activate</button>':''}<button data-act="assign">Recommend / Assign</button><button data-act="manage">Dispatch / Manage Units</button><button data-act="case">Set Case #</button><button data-act="note">Add Narrative</button>${i.status!=='CLOSED'?'<button data-act="close">Clear Event</button>':''}</div>
 <div><b>Units:</b> ${i.units.join(', ')||'None'}</div>${window.voiceDetailHtml ? window.voiceDetailHtml(i) : `<div class="narr">${i.narrative.join('<br>')}</div>`}<h3>Event History</h3><div class="timeline">${i.events.slice().reverse().map(e=>`<div>${e}</div>`).join('')||'<div>No events yet.</div>'}</div></div>`;
 $$('#detail [data-act]').forEach(b=>b.onclick=()=>detailAction(i,b.dataset.act)); $$('#detail [data-linked-incident]').forEach(b=>b.onclick=()=>{state.selected=b.dataset.linkedIncident;render();}); if(window.voiceBindDetail)window.voiceBindDetail(i);
}
// Shared event closure transaction. Requires disposition regardless of entry path.
window.cadCloseEvent=function(incident,disposition,source='MANUAL'){
 const d=String(disposition||'').trim();
 if(!incident)return {ok:false,message:'Event not found.'};
 if(incident.status==='CLOSED')return {ok:false,message:`${incident.id} is already closed.`};
 if(!d)return {ok:false,message:'A disposition is required to clear an event.'};
 if(d.length>500)return {ok:false,message:'Disposition must be 500 characters or less.'};
 const released=[];
 for(const id of [...incident.units]){
  const u=state.units.find(x=>x.id===id);
  if(u){u.status='AVAILABLE';u.location='Available';released.push(id);}
 }
 incident.units=[];
 incident.status='CLOSED';incident.disposition=d;
 incident.closedAt=new Date().toISOString();
 incident.dispositions ||= [];
 incident.dispositions.push({time:now(),value:d,source,scope:'EVENT'});
 event(incident,`EVENT_CLEARED ${source} DISPO: ${d} | RELEASED: ${released.join(', ')||'none'}`);
 state.selected=incident.id;
 save();
 return {ok:true,message:`${incident.id} closed (${d}). ${released.length} unit(s) released.`};
};
function detailAction(i,a){
 if(a==='activate'){i.status='ACTIVE';event(i,'INCIDENT_ACTIVATED')}
 if(a==='assign'){let u=state.units.find(u=>u.discipline===i.discipline&&u.status==='AVAILABLE');if(u){const resolved=cadDispatchTarget(i,u);const target=resolved.incident;u.status='DISPATCHED';u.location=target.location;if(!target.units.includes(u.id))target.units.push(u.id);target.status='ACTIVE';event(target,`UNIT_ASSIGNED ${u.id}`)}else toast('No available unit of '+i.discipline+' discipline')}
 if(a==='manage'){show('dispatch');document.getElementById('operationsPanel')?.scrollIntoView({block:'nearest'});window.cadOpsSelectIncident?.(i.id);return}
 if(a==='case'){const n=prompt('Case number (leave blank to remove)',i.caseNumber||'');if(n!==null){i.caseNumber=n.trim().slice(0,80);event(i,`CASE_NUMBER ${i.caseNumber||'REMOVED'}`)}}
 if(a==='note'){let n=prompt('Narrative entry');if(n){i.narrative.push(n);event(i,'NARRATIVE_ADDED')}}
 if(a==='close'){window.cadShowClearEvent?.(i);return;}
 save();
}
function renderMap(){
 $('#map').querySelectorAll('.marker').forEach(m=>m.remove());
 state.units.forEach(u=>{let m=document.createElement('div');m.className='marker '+u.discipline.toLowerCase();m.style.left=u.x+'%';m.style.top=u.y+'%';m.title=`${u.id} ${u.status}`;$('#map').appendChild(m)})
}
function populate(){
 $('#agency').innerHTML=config.agencies.map(a=>`<option>${a}</option>`).join('');
 updateTypes();
 $('#cfgAgencies').value=config.agencies.join('\n');$('#cfgLaw').value=config.types.LAW.join('\n');$('#cfgFire').value=config.types.FIRE.join('\n');$('#cfgEms').value=config.types.EMS.join('\n');
}
function updateTypes(){let d=$('#discipline').value;$('#type').innerHTML=config.types[d].map(t=>`<option>${t}</option>`).join('')}
$('#discipline').onchange=updateTypes;
$('#createCall').onclick=()=>{let id=`${String(new Date().getFullYear()).slice(-2)}-${String(++state.seq).padStart(6,'0')}`,i={id,caseNumber:$('#newCaseNumber').value.trim().slice(0,80),agency:$('#agency').value,discipline:$('#discipline').value,priority:$('#priority').value,type:($('#customIncidentType').value.trim()||$('#type').value),location:(window.cadCommonPlaces?.resolve($('#location').value)?.address||$('#location').value),caller:$('#caller').value,phone:$('#phone').value,narrative:[$('#narrative').value],status:'PENDING',units:[],events:[]};event(i,'CALL_CREATED');state.incidents.push(i);state.selected=id;save();show('dispatch');toast(`Created ${id}`)}
$$('nav [data-view]').forEach(b=>b.onclick=()=>show(b.dataset.view));
function show(v){$$('.view').forEach(x=>x.classList.toggle('active',x.id===v));$$('nav [data-view]').forEach(x=>x.classList.toggle('active',x.dataset.view===v))}
$$('.filters button').forEach(b=>b.onclick=()=>{filter=window.CadDiscipline.normalize(b.dataset.discipline);window.cadUnitDisciplineFilter=filter;$$('.filters button').forEach(x=>x.classList.toggle('active',x===b));render()});
// The enhanced command desk installs its own keyboard handling from command-intelligence.js.
$('#saveConfig').onclick=()=>{config={...config,agencies:$('#cfgAgencies').value.split('\n').filter(Boolean),types:{LAW:$('#cfgLaw').value.split('\n').filter(Boolean),FIRE:$('#cfgFire').value.split('\n').filter(Boolean),EMS:$('#cfgEms').value.split('\n').filter(Boolean)}};localStorage.setItem(CFG,JSON.stringify(config));populate();toast('Configuration saved')}
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
function simulate(){toast('Simulation running');let steps=[
()=>{let i={id:`26-${String(++state.seq).padStart(6,'0')}`,agency:'Petaluma Fire / EMS',discipline:'FIRE',priority:'P1',type:'Structure Fire',location:'450 East Washington St',caller:'Multiple callers',phone:'911',narrative:['Smoke and flames visible from second floor.'],status:'PENDING',units:[],events:[]};event(i,'911_CALL_RECEIVED');state.incidents.push(i);state.selected=i.id;save()},
()=>{let i=state.incidents.find(x=>x.id===state.selected);i.status='ACTIVE';['E1','E2','M2'].forEach(id=>{let u=state.units.find(x=>x.id===id);u.status='DISPATCHED';u.location=i.location;i.units.push(id);event(i,`UNIT_ASSIGNED ${id}`)});save()},
()=>{['E1','E2','M2'].forEach(id=>state.units.find(x=>x.id===id).status='ENROUTE');let i=state.incidents.find(x=>x.id===state.selected);event(i,'UNITS_ENROUTE');save()},
()=>{state.units.find(x=>x.id==='E1').status='ONSCENE';let i=state.incidents.find(x=>x.id===state.selected);i.narrative.push('E1 on scene, working fire declared.');event(i,'E1 ONSCENE / WORKING FIRE');save()}
];steps.forEach((f,n)=>setTimeout(f,n*1800))}
window.addEventListener('storage',()=>{state=JSON.parse(localStorage.getItem(KEY)||'null')||state;render()});
setInterval(()=>$('#clock').textContent=new Date().toLocaleString('en-US',{hour12:false}),1000);
populate();render();
const params=new URLSearchParams(location.search);if(params.get('panel')){document.querySelector('nav').style.display='none';document.querySelector('header').style.position='static';let p=params.get('panel');$$('.panel').forEach(x=>x.style.display=x.dataset.panel===p?'block':'none');$('.grid').style.gridTemplateColumns='1fr';$('.command').style.display='none'}
