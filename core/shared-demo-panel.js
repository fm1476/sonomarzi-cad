/* Optional shared CAD test controls; local dispatch workspace stays independent. */
(()=>{'use strict';
 function boot(){
  const demoConfig=Object.freeze({url:'https://gtmdigvuwjyfpgpdjmph.supabase.co',publishableKey:'sb_publishable_h8InBmqS_gfcHbgdxGqF6A_s3cf5ShD',agencyId:'ec800f31-c030-438f-9d8f-51c70a75af95'});
  const root=document.getElementById('cadSharedDemo');
  if(!root||!window.CadDemoLogin)return;
  const $=id=>root.querySelector('#'+id);
  const toggle=document.getElementById('cadSharedToggle');
  const headerUser=document.getElementById('cadSharedHeaderUser');
  const setOpen=open=>{root.hidden=!open;toggle.setAttribute('aria-expanded',String(open))};
  toggle.addEventListener('click',()=>setOpen(root.hidden));
  $('cadSharedClose').addEventListener('click',()=>setOpen(false));
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!root.hidden)setOpen(false)});
  const status=$('cadSharedStatus');
  const say=message=>{status.textContent=message};
  const form=$('cadSharedLoginForm');
  const board=$('cadSharedBoard');
  const loginPanel=$('cadSharedLoginPanel');
  const tbody=$('cadSharedIncidents');
  const units=$('cadSharedUnits');
  const shortages=$('cadSharedShortages');
  const counts=$('cadSharedCounts');
  let snapshot={incidents:[],roster:[],assignments:[],holds:[],statusCatalog:[],customStatuses:[]};
  let refreshing=false;
  let refreshAgain=false;
  let refreshTimer=null;
  const POLL_BASE_MS=5000;
  const POLL_MAX_MS=30000;
  let pollingStopped=true,refreshFailures=0;
  function stopPolling(){
   pollingStopped=true;
   if(refreshTimer)clearTimeout(refreshTimer);
   refreshTimer=null;
  }
  function schedulePolling(delay){
   if(pollingStopped||!window.CadDemoLogin?.current())return;
   if(refreshTimer)clearTimeout(refreshTimer);
   refreshTimer=setTimeout(async()=>{
    refreshTimer=null;
    if(pollingStopped)return;
    if(document.visibilityState==='hidden'){schedulePolling(POLL_BASE_MS);return;}
    await refresh({quiet:true});
    if(!pollingStopped){
     const next=Math.min(POLL_MAX_MS,POLL_BASE_MS*Math.pow(2,Math.min(refreshFailures,3)));
     schedulePolling(next);
    }
   },delay);
  }
  function startPolling(){stopPolling();pollingStopped=false;schedulePolling(POLL_BASE_MS);}

  let lastSignature='';
  let confirmedMutationEpoch=0;
  const workspace=document.getElementById('cadSharedWorkspace');
  const workIncidents=document.getElementById('cadSharedWorkspaceIncidents');
  const workUnits=document.getElementById('cadSharedWorkspaceUnits');
  const workUpdated=document.getElementById('cadSharedWorkspaceUpdated');
  document.getElementById('cadSharedWorkspaceManage')?.addEventListener('click',()=>setOpen(true));
  function renderWorkspace(){
   if(!workspace)return;
   workspace.hidden=!window.CadDemoLogin.current();
   if(workspace.hidden)return;
   const make=(host,items,format)=>{
    host.replaceChildren();
    if(!items.length){const empty=document.createElement('div');empty.className='cad-shared-workspace-empty';empty.textContent='No shared records yet';host.appendChild(empty);return}
    for(const item of items){const line=document.createElement('div');line.className='cad-shared-workspace-item';line.textContent=format(item);host.appendChild(line)}
   };
   make(workIncidents,snapshot.incidents.slice(0,8),i=>i.incident_number+'  ·  '+i.discipline+'  ·  '+i.status+'  ·  '+i.current_location);
   make(workUnits,snapshot.roster.filter(u=>u.status!=='OFF_DUTY'),u=>u.call_sign+'  ·  '+u.status);
   workUpdated.textContent=snapshot.incidents.length+' incidents · '+snapshot.roster.filter(u=>u.status!=='OFF_DUTY').length+' on-duty units · auto-sync every 5s';
  }

  const sharedBoard=document.getElementById('cadSharedOperational');
  const localGrid=document.querySelector('section.grid');
  const disciplineFilter=document.getElementById('cadSharedDiscipline');
  const areaFilter=document.getElementById('cadSharedArea');
  let selectedSharedIncident=null;
  const boardText=(id,value)=>{const node=document.getElementById(id);if(node)node.textContent=value};
  const filteredIncident=i=>disciplineFilter.value==='ALL'||i.discipline===disciplineFilter.value;
  function boardRow(host,item,label,handler){
   const button=document.createElement('button');
   button.type='button';button.className='cad-shared-board-row';button.textContent=label;
   button.addEventListener('click',handler);host.appendChild(button);
  }
  function renderSharedBoard(){
   if(!sharedBoard)return;
   const connected=!!window.CadDemoLogin.current();
   sharedBoard.hidden=!connected;
   if(localGrid)localGrid.hidden=false;
   if(!connected)return;
   const visible=snapshot.incidents.filter(filteredIncident);
   const pending=visible.filter(i=>i.status==='PENDING');
   const active=visible.filter(i=>i.status==='ACTIVE');
   boardText('cadSharedPendingCount','('+pending.length+')');
   boardText('cadSharedActiveCount','('+active.length+')');
   for(const [id,items] of [['cadSharedPendingList',pending],['cadSharedActiveList',active]]){
    const host=document.getElementById(id);host.replaceChildren();
    for(const i of items)boardRow(host,i,i.incident_number+'  ·  '+i.type+'  ·  '+i.current_location+'  ·  '+i.priority+(snapshot.holds.find(h=>h.incident_id===i.id&&h.active)?' · HELD FOR '+(snapshot.holds.find(h=>h.incident_id===i.id&&h.active).requested_unit||'REVIEW'):''),()=>{selectedSharedIncident=i.id;renderSharedBoard()});
    if(!items.length)host.textContent='No calls in this view';
   }
   const units=document.getElementById('cadSharedUnitList');units.replaceChildren();
   for(const u of snapshot.roster.filter(u=>u.status!=='OFF_DUTY'&&(disciplineFilter.value==='ALL'||u.discipline===disciplineFilter.value))){
    boardRow(units,u,u.call_sign+'  ·  '+u.discipline+'  ·  '+u.status,()=>{
     const a=snapshot.assignments.find(a=>a.unit_id===u.id);
     if(a){selectedSharedIncident=a.incident_id;renderSharedBoard()}
    });
   }
   // Off-duty units are excluded from Unit Status but can be logged on by a
   // dispatcher from the shared roster management control.
   let onDutyControl=document.getElementById('cadSharedLogOnDuty');
   if(!onDutyControl){
    onDutyControl=document.createElement('div');onDutyControl.id='cadSharedLogOnDuty';
    units.after(onDutyControl);
   }
   onDutyControl.replaceChildren();
   const offDuty=snapshot.roster.filter(u=>u.status==='OFF_DUTY');
   if(offDuty.length){
    const pick=document.createElement('select');pick.setAttribute('aria-label','Off-duty unit to log on');
    for(const u of offDuty){const opt=document.createElement('option');opt.value=u.id;opt.textContent=u.call_sign+' · '+u.discipline;pick.appendChild(opt)}
    const logOn=document.createElement('button');logOn.type='button';logOn.textContent='Log On Duty';logOn.className='cad-shared-btn';
    logOn.addEventListener('click',async()=>{
     const unit=offDuty.find(u=>u.id===pick.value);if(!unit)return;
     if(!window.confirm('Log '+unit.call_sign+' on duty and mark AVAILABLE?'))return;
     logOn.disabled=true;
     try{await window.cadSharedSetUnitDuty(unit.id,true);}
     catch(error){window.alert('Log On Duty failed: '+error.message);}
     finally{logOn.disabled=false}
    });
    onDutyControl.append(pick,logOn);
   }
   const detail=document.getElementById('cadSharedOperationalDetail');detail.replaceChildren();
   const i=snapshot.incidents.find(i=>i.id===selectedSharedIncident);
   if(!i){detail.textContent='Select any call to view or dispatch, including calls handled by another dispatcher.';return}
   const heading=document.createElement('div');heading.className='cad-shared-board-heading';
   heading.textContent=i.incident_number+' · '+i.type+' · '+i.current_location+' · '+i.status;
   detail.appendChild(heading);
   if(i.status!=='CLOSED'){
    const hold=snapshot.holds.find(h=>h.incident_id===i.id&&h.active);
    const line=document.createElement('div');line.className='cad-shared-board-assignment';
    const label=document.createElement('span');label.textContent=hold?'HELD · '+(hold.requested_unit||hold.reason):'Not held';line.append(label);
    const button=document.createElement('button');button.className='cad-shared-btn';button.type='button';button.textContent=hold?'Release Hold':'Hold for Unit';
    button.onclick=async()=>{
     let unit=null,reason='DISPATCHER_HOLD',notes='';
     if(!hold){
      const value=window.prompt('Hold for unit (call sign, blank for general hold):','');
      if(value===null)return;
      unit=value.trim().toUpperCase();
      if(unit&&!snapshot.roster.some(u=>u.call_sign.toUpperCase()===unit)){window.alert('Unit not found in shared roster.');return}
      reason=unit?'SPECIFIC_UNIT':'DISPATCHER_HOLD';
      const input=window.prompt('Optional hold reason / notes:','');
      if(input===null)return;notes=input.trim().slice(0,1000);
     }
     button.disabled=true;
     try{await window.cadSharedCommand(hold?'release-hold':'hold',{incidentId:i.id,requestedUnit:unit,reason,notes});}
     catch(error){window.alert('Hold operation failed: '+error.message)}
     finally{button.disabled=false}
    };
    line.append(button);detail.append(line);
    if(hold?.requested_unit&&snapshot.roster.some(u=>u.call_sign.toUpperCase()===hold.requested_unit.toUpperCase()&&u.status==='AVAILABLE')){
     const notice=document.createElement('strong');notice.textContent='Requested unit AVAILABLE. Review for dispatch.';line.append(notice);
    }
   }

   const assigned=snapshot.assignments.filter(a=>a.incident_id===i.id);
   for(const a of assigned){
    const u=snapshot.roster.find(u=>u.id===a.unit_id);if(!u)continue;
    const line=document.createElement('div');line.className='cad-shared-board-assignment';
    const label=document.createElement('span');label.textContent=u.call_sign+' · '+u.status;line.appendChild(label);
    const select=document.createElement('select');
    for(const st of ['DISPATCHED','ENROUTE','ONSCENE','TRANSPORTING','AT_HOSPITAL','OUT_OF_SERVICE'])select.appendChild(option(st,st));
    select.value=u.status;line.appendChild(select);
    const btn=document.createElement('button');btn.className='cad-shared-btn';btn.textContent='Update';
    btn.addEventListener('click',()=>operate(btn,(client,agency)=>client.changeUnitStatus({agency,incident:i.id,unit:u.id,status:select.value,unitVersion:u.version})));
    line.appendChild(btn);
    const clear=document.createElement('button');clear.className='cad-shared-btn';clear.textContent='Clear unit';
    clear.addEventListener('click',()=>{if(!window.confirm('Clear '+u.call_sign+' from '+i.incident_number+'?'))return;operate(clear,(client,agency)=>client.clearUnit({agency,incident:i.id,unit:u.id,incidentVersion:i.version,unitVersion:u.version,disposition:'CLEARED'}))});
    line.appendChild(clear);detail.appendChild(line);
   }
   if(i.status!=='CLOSED'){
    const line=document.createElement('div');line.className='cad-shared-board-assignment';
    const select=document.createElement('select');
    const available=snapshot.roster.filter(u=>u.status==='AVAILABLE');
    for(const u of available)select.appendChild(option(u.id,u.call_sign+' · '+u.discipline));
    line.appendChild(select);
    const btn=document.createElement('button');btn.className='cad-shared-btn';btn.textContent='Dispatch unit';btn.disabled=!available.length;
    btn.addEventListener('click',()=>{const u=snapshot.roster.find(u=>u.id===select.value);if(!u)return;operate(btn,(client,agency)=>client.assignUnit({agency,incident:i.id,unit:u.id,incidentVersion:i.version,unitVersion:u.version}))});
    line.appendChild(btn);detail.appendChild(line);
   }
  }
  disciplineFilter?.addEventListener('change',renderSharedBoard);
  document.getElementById('cadSharedShowAll')?.addEventListener('click',()=>{disciplineFilter.value='ALL';areaFilter.value='ALL';renderSharedBoard()});

  const option=(value,label)=>{const o=document.createElement('option');o.value=value;o.textContent=label;return o};
  function choose(select,items,format){
   const previous=select.value;select.replaceChildren();
   for(const item of items)select.appendChild(option(item.id,format(item)));
   if(items.some(item=>item.id===previous))select.value=previous;
  }
  function syncChoices(){
   choose($('cadSharedTargetIncident'),snapshot.incidents.filter(i=>i.status!=='CLOSED'),i=>i.incident_number+' · '+i.status);
   choose($('cadSharedTargetUnit'),snapshot.roster.filter(u=>u.status==='AVAILABLE'),u=>u.call_sign+' · '+u.discipline);
   const active=snapshot.assignments.map(a=>{
    const u=snapshot.roster.find(u=>u.id===a.unit_id);
    const i=snapshot.incidents.find(i=>i.id===a.incident_id);
    return u&&i?{id:a.id,unit:u,incident:i}:null;
   }).filter(Boolean);
   const target=$('cadSharedStatusUnit'),old=target.value;target.replaceChildren();
   for(const a of active)target.appendChild(option(a.id,a.unit.call_sign+' · '+a.incident.incident_number+' · '+a.unit.status));
   if(active.some(a=>a.id===old))target.value=old;
  }
  async function operate(button,work){
   if(!window.CadDemoLogin.current())return say('Sign in first.');
   button.disabled=true;
   try{await work(window.CadDemoLogin.client(),window.CadDemoLogin.current().agencyId);await refresh({quiet:true})}
   catch(error){say(error.message+' — Refresh shared data and retry after reviewing current assignments.')}
   finally{button.disabled=false}
  }
  $('cadSharedCreateForm').addEventListener('submit',event=>{
   event.preventDefault();
   operate($('cadSharedCreate'),async(client,agency)=>{
    await client.createIncident({agency,number:$('cadSharedNewNumber').value.trim(),discipline:$('cadSharedNewDiscipline').value,type:$('cadSharedNewType').value.trim(),priority:$('cadSharedNewPriority').value,location:$('cadSharedNewLocation').value.trim()});
    $('cadSharedCreateForm').reset();
   });
  });
  $('cadSharedAssign').addEventListener('click',()=>operate($('cadSharedAssign'),async(client,agency)=>{
   const incident=snapshot.incidents.find(i=>i.id===$('cadSharedTargetIncident').value);
   const unit=snapshot.roster.find(u=>u.id===$('cadSharedTargetUnit').value);
   if(!incident||!unit)throw Error('Choose an active incident and available unit');
   await client.assignUnit({agency,incident:incident.id,unit:unit.id,incidentVersion:incident.version,unitVersion:unit.version});
  }));
  $('cadSharedChangeStatus').addEventListener('click',()=>operate($('cadSharedChangeStatus'),async(client,agency)=>{
   const assignment=snapshot.assignments.find(a=>a.id===$('cadSharedStatusUnit').value);
   const unit=snapshot.roster.find(u=>u.id===assignment?.unit_id);
   if(!assignment||!unit)throw Error('Choose an assigned unit');
   await client.changeUnitStatus({agency,incident:assignment.incident_id,unit:unit.id,status:$('cadSharedNewStatus').value,unitVersion:unit.version});
  }));

  const text=(node,value)=>{node.textContent=String(value??'—')};
  function cell(row,value){const td=document.createElement('td');text(td,value);row.appendChild(td)}
  function displayRows(host,items,fields){
   host.replaceChildren();
   for(const item of items){const tr=document.createElement('tr');for(const field of fields)cell(tr,item[field]);host.appendChild(tr)}
  }
  async function refresh({quiet=false}={}){
   if(refreshing){refreshAgain=true;return;}
   if(!window.CadDemoLogin.current()){if(!quiet)say('Sign in to load shared data.');return}
   refreshing=true;
   const refreshEpoch=confirmedMutationEpoch;
   const client=window.CadDemoLogin.client();
   const agency=window.CadDemoLogin.current().agencyId;
   if(!quiet)say('Refreshing shared CAD data…');
   try{
    const [incidents,roster,missing,assignments,dispatchAreas,areaAgencies,incidentEvents,incidentLocations,holds,statusCatalog,customStatuses,combinedLinks,cfsTypes]=await Promise.all([
     client.listIncidents(agency),client.listUnits(agency),client.listOutstanding(agency),client.listAssignments(agency),client.listDispatchAreas(agency),client.listDispatchAreaAgencies(agency),client.listIncidentEvents(agency),client.listIncidentLocations(agency),client.listIncidentHolds(agency),client.listUnitStatusCatalog(agency),client.listUnitCustomStatuses(agency),client.listCombinedLinks(agency),client.listCfsTypes(agency)
    ]);
    if(refreshEpoch!==confirmedMutationEpoch){refreshAgain=true;return;}
    refreshFailures=0;
    const signature=JSON.stringify({incidents,roster,missing,assignments,incidentEvents,incidentLocations,holds,statusCatalog,customStatuses,combinedLinks,cfsTypes});
    const needsRender=lastSignature!==signature;
    const changed=lastSignature!==''&&needsRender;
    lastSignature=signature;
    snapshot={incidents,roster,assignments,dispatchAreas,areaAgencies,incidentEvents,incidentLocations,holds,statusCatalog,customStatuses,combinedLinks,cfsTypes};syncChoices();renderWorkspace();renderSharedBoard();if(needsRender)window.cadSharedApplySnapshot?.(snapshot);window.dispatchEvent(new CustomEvent('cad:unit-status-catalog-updated',{detail:{catalog:statusCatalog}}));
    displayRows(tbody,incidents,['incident_number','status','discipline','created_at']);
    displayRows(units,roster.filter(u=>u.status!=='OFF_DUTY'),['call_sign','status','resource_type']);
    displayRows(shortages,missing,['incident_id','resource_type','missing_count']);
    text(counts,incidents.length+' incidents · '+roster.length+' units · '+missing.length+' resource shortages');
    if(!quiet||changed)say(changed?'Shared CAD updated from another dispatcher. Local workspace remains separate.':'Shared CAD snapshot loaded. Local workspace remains separate.');
   }catch(error){refreshFailures++;say('Shared CAD refresh failed: '+error.message+'. Retrying at reduced frequency.')}finally{
    refreshing=false;
    if(refreshAgain){refreshAgain=false;queueMicrotask(()=>refresh({quiet:true}));}
   }
  }
  // Apply the confirmed close result immediately; polling reconciles every other session.
  function applyConfirmedClose(incidentId,disposition){
   const existing=snapshot.incidents.find(i=>i.id===incidentId);
   if(!existing)return;
   snapshot.incidents=snapshot.incidents.map(i=>i.id===incidentId?{...i,status:'CLOSED',closed_at:new Date().toISOString(),version:i.version+1}:i);
   const released=snapshot.assignments.filter(a=>a.incident_id===incidentId);
   const releasedIds=new Set(released.map(a=>a.unit_id));
   snapshot.assignments=snapshot.assignments.filter(a=>a.incident_id!==incidentId);
   snapshot.roster=snapshot.roster.map(u=>releasedIds.has(u.id)?{...u,status:'AVAILABLE',version:u.version+1}:u);
   snapshot.incidentEvents=[...(snapshot.incidentEvents||[]),{incident_id:incidentId,event_type:'INCIDENT_CLOSED',payload:{disposition},occurred_at:new Date().toISOString()}];
   confirmedMutationEpoch++;
   lastSignature='';
   window.cadSharedApplySnapshot?.(snapshot);
  }
  // Original CAD controls use this single authenticated command gateway.
  // Unit duty is incident-independent. A confirmed RPC changes the agency-wide
  // roster, not merely this dispatcher's browser view.
  // Configure-and-log-on is distinct from incident dispatch. Reuse the
  // database's authenticated idempotent register RPC, then refresh the shared board.
  window.cadSharedRegisterMasterUnit=async function(def,agencyName){
   const session=window.CadDemoLogin.current();
   if(!session)throw Error('Sign in to shared CAD first.');
   if(!def||!def.designator||!def.discipline||!def.resourceType)throw Error('Unit needs a designator, discipline, and resource type.');
   const callSign=String(def.designator).trim().toUpperCase();
   if(!/^[A-Z0-9]{1,12}$/.test(callSign))throw Error('Shared CAD callsigns must be 1–12 letters or digits, no spaces.');
   const previous=snapshot.roster.find(u=>u.call_sign.toUpperCase()===callSign);
   if(previous){
    const targetType=String(def.resourceType).trim().toUpperCase();
    const mismatch=previous.discipline!==def.discipline||previous.resource_type!==targetType||
      (previous.home_agency_name||'SonoMarzi CAD Demo Agency')!==agencyName;
    if(!mismatch){
     if(previous.status==='AVAILABLE')return {ok:true,alreadyOnDuty:true,callSign};
     if(previous.status==='OFF_DUTY')return await window.cadSharedSetUnitDuty(previous.id,true).then(result=>({ok:true,callSign,result}));
     throw Error(callSign+' is already in service ('+previous.status+').');
    }
    if(previous.status!=='OFF_DUTY')
     throw Error(callSign+' is active with a different agency/unit configuration. Take it off duty first; existing incident history is protected.');
    if(snapshot.assignments.some(a=>a.unit_id===previous.id))
     throw Error(callSign+' has an incident assignment and cannot be reconciled.');
    const details=callSign+' exists in the legacy shared CAD roster with different definitions.\n\n'+
      'SHARED RECORD: '+(previous.home_agency_name||'SonoMarzi CAD Demo Agency')+' | '+previous.discipline+' | '+previous.resource_type+'\n'+
      'YOUR CONFIGURATION: '+agencyName+' | '+def.discipline+' | '+targetType+'\n\n'+
      'Replace the obsolete demo unit details with your configured definition and log it on as AVAILABLE?';
    if(!window.confirm(details))throw Error('Reconciliation canceled. No records changed.');
    const client=window.CadDemoLogin.client();
    try{
     const result=await client.reconcileOffDutyUnit({agency:session.agencyId,unit:previous.id,unitVersion:previous.version,
      discipline:def.discipline,resourceType:targetType,homeAgency:agencyName});
     await refresh({quiet:true});
     const current=snapshot.roster.find(u=>u.id===previous.id);
     if(!current||current.status!=='AVAILABLE'||current.discipline!==def.discipline||
       current.resource_type!==targetType||current.home_agency_name!==agencyName)
       throw Error('Reconciliation not yet reflected in shared CAD. Refresh before retrying.');
     return {ok:true,callSign,unitId:current.id,reconciled:true,result};
    }catch(error){await refresh({quiet:true});throw Error(error.message+' — Verify the shared roster before retrying.');}
   }
   const client=window.CadDemoLogin.client();
   let result;
   try{
    result=await client.registerUnit({agency:session.agencyId,callSign,discipline:def.discipline,resourceType:def.resourceType,temporary:false,homeAgency:agencyName});
    await refresh({quiet:true});
    const now=snapshot.roster.find(u=>u.call_sign.toUpperCase()===callSign);
    if(!now||now.status!=='AVAILABLE')throw Error('Shared CAD logon response could not be confirmed. Review roster before retrying.');
    return {ok:true,callSign,unitId:now.id,result};
   }catch(error){
    await refresh({quiet:true});
    throw Error(error.message+' — Check the shared roster before retrying.');
   }
  };
  window.cadSharedRoster=()=>snapshot.roster.slice();
  window.cadSharedRefresh=()=>refresh({quiet:true});
  window.cadSharedSetUnitDuty=async function(unitId,onDuty){
   const session=window.CadDemoLogin.current();
   if(!session)throw Error('Sign in to shared CAD first.');
   const unit=snapshot.roster.find(u=>u.id===unitId||u.call_sign===unitId);
   if(!unit)throw Error('Unit not found. Refresh the shared roster.');
   const assigned=snapshot.assignments.some(a=>a.unit_id===unit.id);
   if(assigned)throw Error('Unit is assigned to an incident. Clear it first.');
   if(onDuty?unit.status!=='OFF_DUTY':unit.status!=='AVAILABLE')throw Error('Unit status changed; refresh before modifying duty.');
   const client=window.CadDemoLogin.client();
   let result;
   try{
    result=await client.setUnitDuty({agency:session.agencyId,unit:unit.id,unitVersion:unit.version,onDuty});
    await refresh({quiet:true});
    if(action==='create'&&result?.combined){const primary=snapshot.incidents.find(x=>x.id===result.primary_id);return {...result,incident_number:primary?.incident_number||result.incident_number||result.primary_id}}
    return result;
   }catch(error){
    await refresh({quiet:true});
    throw Error(error.message+' — Refresh shared roster and verify duty status before retrying.');
   }
  };
  window.cadSharedApplyCustomStatus=async function(unitId,code){
   const session=window.CadDemoLogin.current();if(!session)throw Error('Sign in to shared CAD first');
   const unit=snapshot.roster.find(u=>u.id===unitId||u.call_sign===unitId);
   if(!unit)throw Error('Unit not found in shared roster');
   const row=snapshot.statusCatalog?.find(s=>s.code===code&&s.enabled&&['ALL',unit.discipline].includes(s.discipline));
   if(!row)throw Error('Configured status not available for unit');
   try{const result=await window.CadDemoLogin.client().applyCustomUnitStatus({agency:session.agencyId,unit:unit.id,code,unitVersion:unit.version});await refresh({quiet:true});return result;}
   catch(error){await refresh({quiet:true});throw error}
  };
  window.cadSharedCommand=async function(action,args={}){
   const session=window.CadDemoLogin.current();
   if(!session)throw Error('Sign in to shared CAD first.');
   const client=window.CadDemoLogin.client(),agency=session.agencyId;
   const incident=snapshot.incidents.find(i=>i.id===args.incidentId||i.incident_number===args.incidentId);
   const unit=snapshot.roster.find(u=>u.id===args.unitId||u.call_sign===args.unitId);
   try{
    let result;
    if(action==='create'){
     // Resolve configured CFS types before creating calls. The mapping is directional.
     // Never silently create a single call when a configured combined event cannot be resolved.
     // A missing catalog schema is a configuration error, not permission to bypass mappings.
     const configured=await client.listCfsTypes(agency);
     const matches=configured.filter(x=>x.publication==='ACTIVE'&&x.discipline===args.discipline&&(x.name||'').trim().toLowerCase()===String(args.type||'').trim().toLowerCase());
     if(matches.length>1)throw Error('Ambiguous agency CFS type. Resolve duplicate configuration.');
     if(matches.length===1){
      const created=await client.createCombinedIncident({agency,cfsTypeId:matches[0].id,priority:args.priority,location:args.location});
      result={...created,combined:true,primary_id:created.incidents?.[0]?.id,incident_number:created.incidents?.[0]?.incident_number};
     }else{
      if(configured.length)throw Error('CFS type is not active in agency catalog. Select a configured type.');
      result=await client.createIncidentAuto({agency,discipline:args.discipline,type:args.type,priority:args.priority,location:args.location});
     }
    }else{
     if(!incident)throw Error('Incident not found. Refresh and retry.');
     if(action==='join-onscene'){
      const joining=snapshot.roster.find(u=>u.id===args.joiningUnitId||u.call_sign===args.joiningUnitId);
      const reference=snapshot.roster.find(u=>u.id===args.referenceUnitId||u.call_sign===args.referenceUnitId);
      if(!joining||!reference||joining.id===reference.id)throw Error('Two distinct roster units required');
      if(joining.status!=='AVAILABLE')throw Error('Joining unit not AVAILABLE');
      if(!snapshot.assignments.some(a=>a.incident_id===incident.id&&a.unit_id===reference.id))throw Error('Reference unit not assigned to destination event');
      if(snapshot.assignments.some(a=>a.unit_id===joining.id))throw Error('Joining unit already assigned; explicit PREEMPT required');
      result=await client.joinUnitOnScene({agency,incident:incident.id,joiningUnit:joining.id,referenceUnit:reference.id,incidentVersion:incident.version,joiningVersion:joining.version,referenceVersion:reference.version});
     }
     else if(action==='hold'||action==='release-hold')result=await client.setIncidentHold({agency,incident:incident.id,incidentVersion:incident.version,hold:action==='hold',reason:args.reason,requestedUnit:args.requestedUnit,requestedCapability:args.requestedCapability,notes:args.notes});
     else if(action==='allocate-case')result=await client.allocateCaseNumber({agency,incident:incident.id,incidentVersion:incident.version});
     else if(action==='case')result=await client.setCaseNumber({agency,incident:incident.id,caseNumber:args.caseNumber||'',incidentVersion:incident.version});
     else if(action==='note')result=await client.addNarrative({agency,incident:incident.id,text:args.text,incidentVersion:incident.version});
     else if(action==='batch-assign'){
      const names=Array.isArray(args.unitIds)?args.unitIds:[];
      const distinct=[...new Set(names)];
      if(!distinct.length||distinct.length!==names.length||distinct.length>30)throw Error('Select 1-30 unique units for shared dispatch.');
      const matched=distinct.map(id=>snapshot.roster.find(u=>u.id===id||u.call_sign===id));
      if(matched.some(u=>!u))throw Error('One or more requested units do not exist in the shared roster.');
      if(matched.some(u=>u.status!=='AVAILABLE'))throw Error('Requested unit is not available. No response plan dispatched.');
      const versions=Object.fromEntries(matched.map(u=>[u.id,u.version]));
      result=await client.assignResponsePlan({agency,incident:incident.id,unitIds:matched.map(u=>u.id),incidentVersion:incident.version,unitVersions:versions});
     }
     else if(action==='activate')result=await client.activateIncident({agency,incident:incident.id,incidentVersion:incident.version});
     else if(action==='edit')result=await client.editIncident({agency,incident:incident.id,incidentVersion:incident.version,type:args.type,priority:args.priority,location:args.location,caseNumber:args.caseNumber,source:args.source||'DISPATCH'});
     else if(action==='preempt'){
      if(!unit)throw Error('Unit not found in shared roster.');
      const source=snapshot.incidents.find(i=>i.id===args.fromIncidentId||i.incident_number===args.fromIncidentId);
      if(!source||source.id===incident.id)throw Error('Valid distinct source and destination incidents required.');
      const assignments=snapshot.assignments.filter(a=>a.unit_id===unit.id);
      if(assignments.length!==1||assignments[0].incident_id!==source.id)throw Error('Exactly one existing assignment on the source incident required.');
      result=await client.preemptUnit({agency,fromIncident:source.id,toIncident:incident.id,unit:unit.id,fromVersion:source.version,toVersion:incident.version,unitVersion:unit.version});
     }
     else if(action==='reclassify'){
      if(!unit)throw Error('Reporting unit not found in shared roster.');
      result=await client.reclassifyIncident({agency,incident:incident.id,unit:unit.id,type:args.type,incidentVersion:incident.version,report:args.report});
     }
     else if(action==='close'){result=await client.closeIncident({agency,incident:incident.id,disposition:args.disposition||'CLOSED',incidentVersion:incident.version});applyConfirmedClose(incident.id,args.disposition||'CLOSED');}
     else if(action==='location')result=await client.correctLocation({agency,incident:incident.id,location:args.location,incidentVersion:incident.version,source:'DISPATCH'});
     else{
      if(!unit)throw Error('Unit not found. Refresh and retry.');
      if(action==='assign'){
       if(unit.status!=='AVAILABLE')throw Error(unit.call_sign+' is not available.');
       result=await client.assignUnit({agency,incident:incident.id,unit:unit.id,incidentVersion:incident.version,unitVersion:unit.version});
      }else if(action==='clear')result=await client.clearUnit({agency,incident:incident.id,unit:unit.id,incidentVersion:incident.version,unitVersion:unit.version,disposition:args.disposition||'CLEARED'});
      else if(action==='status')result=await client.changeUnitStatus({agency,incident:incident.id,unit:unit.id,status:args.status,unitVersion:unit.version});
      else throw Error('Unsupported shared CAD operation: '+action);
     }
    }
    await refresh({quiet:true});
    return result;
   }catch(error){
    await refresh({quiet:true});
    throw Error(error.message+' — Shared records were refreshed. Review the current state before retrying.');
   }
  };
  window.cadSharedRequestRefresh=()=>refresh({quiet:true});
  window.addEventListener('cad:shared-dispatch',event=>{
   const button=document.getElementById('cadSharedToggle');
   if(!window.CadDemoLogin.current())return window.alert('Sign in to shared CAD first.');
   const state=window.cadSafetyState?.();
   const selected=state?.incidents?.find(i=>i.id===(event.detail?.incidentId||state.selected));
   if(!selected?.sharedUuid)return;
   const incident=snapshot.incidents.find(i=>i.id===selected.sharedUuid);
   if(!incident)return;
   const available=snapshot.roster.filter(u=>u.status==='AVAILABLE');
   const assigned=snapshot.assignments.filter(a=>a.incident_id===incident.id).map(a=>snapshot.roster.find(u=>u.id===a.unit_id)).filter(Boolean);
   const options=['Dispatch available unit',...assigned.map(u=>'Clear '+u.call_sign)];
   const chosen=window.prompt('Shared CAD · '+incident.incident_number+'\\n'+options.map((v,index)=>index+': '+v).join('\\n')+'\\nEnter an option number:','0');
   if(chosen===null)return;
   const n=Number(chosen);
   if(!Number.isInteger(n)||n<0||n>=options.length)return window.alert('Invalid selection.');
   if(n>0){const unit=assigned[n-1];if(!window.confirm('Clear '+unit.call_sign+'?'))return;return operate(button,(client,agency)=>client.clearUnit({agency,incident:incident.id,unit:unit.id,incidentVersion:incident.version,unitVersion:unit.version,disposition:'CLEARED'}))}
   if(!available.length)return window.alert('No available units.');
   const callSign=window.prompt('Available units: '+available.map(u=>u.call_sign).join(', ')+'\\nEnter call sign:');
   if(!callSign)return;
   const unit=available.find(u=>u.call_sign.toUpperCase()===callSign.trim().toUpperCase());
   if(!unit)return window.alert('Unit not available. Refresh and try again.');
   operate(button,(client,agency)=>client.assignUnit({agency,incident:incident.id,unit:unit.id,incidentVersion:incident.version,unitVersion:unit.version}));
  });
  window.addEventListener('cad:shared-unit-operation',event=>{
   const {unitId,eventId,action}=event.detail||{};
   const unit=snapshot.roster.find(u=>u.call_sign===unitId);
   if(!unit)return window.alert('Unit not found in shared roster.');
   const incident=action==='assign'?snapshot.incidents.find(i=>i.incident_number===eventId):snapshot.incidents.find(i=>snapshot.assignments.some(a=>a.incident_id===i.id&&a.unit_id===unit.id));
   if(!incident)return window.alert('Shared incident not found for this unit.');
   if(action==='assign'&&unit.status!=='AVAILABLE')return window.alert(unitId+' is not available.');
   const button=document.getElementById('cadSharedToggle');
   if(action==='assign')operate(button,(client,agency)=>client.assignUnit({agency,incident:incident.id,unit:unit.id,incidentVersion:incident.version,unitVersion:unit.version}));
   else operate(button,(client,agency)=>client.clearUnit({agency,incident:incident.id,unit:unit.id,incidentVersion:incident.version,unitVersion:unit.version,disposition:'CLEARED'}));
  });
  form.addEventListener('submit',async event=>{
   event.preventDefault();
   const submit=$('cadSharedSignIn');submit.disabled=true;
   try{
    window.CadDemoLogin.configure(demoConfig);
    const result=await window.CadDemoLogin.login($('cadSharedUser').value,$('cadSharedPassword').value);
    $('cadSharedPassword').value='';
    loginPanel.hidden=true;board.hidden=false;
    text($('cadSharedSignedIn'),result.username);text(headerUser,result.username);toggle.classList.add('is-connected');
    setOpen(false);
    await refresh();
    await window.CadCloudSettings?.connect();
    startPolling();
   }catch(error){say(error.message)}finally{submit.disabled=false}
  });
  $('cadSharedRefresh').addEventListener('click',()=>refresh());
  $('cadSharedLogout').addEventListener('click',()=>{
   stopPolling();
   lastSignature='';
   window.CadCloudSettings?.stop();
   window.CadDemoLogin.logout();
   tbody.replaceChildren();units.replaceChildren();shortages.replaceChildren();
   snapshot={incidents:[],roster:[],assignments:[]};syncChoices();renderWorkspace();renderSharedBoard();window.cadSharedRestoreLocal?.();
   board.hidden=true;loginPanel.hidden=false;text(headerUser,'Offline');toggle.classList.remove('is-connected');
   say('Signed out of shared CAD. Local demo remains available.');
  });
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
