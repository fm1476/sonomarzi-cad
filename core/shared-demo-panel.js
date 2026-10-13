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
  let snapshot={incidents:[],roster:[],assignments:[]};
  let refreshing=false;
  let refreshTimer=null;
  let lastSignature='';
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
   make(workUnits,snapshot.roster,u=>u.call_sign+'  ·  '+u.status);
   workUpdated.textContent=snapshot.incidents.length+' incidents · '+snapshot.roster.length+' units · auto-sync every 4s';
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
    for(const i of items)boardRow(host,i,i.incident_number+'  ·  '+i.type+'  ·  '+i.current_location+'  ·  '+i.priority,()=>{selectedSharedIncident=i.id;renderSharedBoard()});
    if(!items.length)host.textContent='No calls in this view';
   }
   const units=document.getElementById('cadSharedUnitList');units.replaceChildren();
   for(const u of snapshot.roster.filter(u=>disciplineFilter.value==='ALL'||u.discipline===disciplineFilter.value)){
    boardRow(units,u,u.call_sign+'  ·  '+u.discipline+'  ·  '+u.status,()=>{
     const a=snapshot.assignments.find(a=>a.unit_id===u.id);
     if(a){selectedSharedIncident=a.incident_id;renderSharedBoard()}
    });
   }
   const detail=document.getElementById('cadSharedOperationalDetail');detail.replaceChildren();
   const i=snapshot.incidents.find(i=>i.id===selectedSharedIncident);
   if(!i){detail.textContent='Select any call to view or dispatch, including calls handled by another dispatcher.';return}
   const heading=document.createElement('div');heading.className='cad-shared-board-heading';
   heading.textContent=i.incident_number+' · '+i.type+' · '+i.current_location+' · '+i.status;
   detail.appendChild(heading);
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
   try{await work(window.CadDemoLogin.client(),window.CadDemoLogin.current().agencyId);await refresh()}
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
   if(refreshing)return;
   if(!window.CadDemoLogin.current()){if(!quiet)say('Sign in to load shared data.');return}
   refreshing=true;
   const client=window.CadDemoLogin.client();
   const agency=window.CadDemoLogin.current().agencyId;
   if(!quiet)say('Refreshing shared CAD data…');
   try{
    const [incidents,roster,missing,assignments,dispatchAreas,areaAgencies]=await Promise.all([
     client.listIncidents(agency),client.listUnits(agency),client.listOutstanding(agency),client.listAssignments(agency),client.listDispatchAreas(agency),client.listDispatchAreaAgencies(agency)
    ]);
    const signature=JSON.stringify({incidents,roster,missing,assignments});
    const changed=lastSignature!==''&&lastSignature!==signature;
    lastSignature=signature;
    snapshot={incidents,roster,assignments,dispatchAreas,areaAgencies};syncChoices();renderWorkspace();renderSharedBoard();
    displayRows(tbody,incidents,['incident_number','status','discipline','created_at']);
    displayRows(units,roster,['call_sign','status','resource_type']);
    displayRows(shortages,missing,['incident_id','resource_type','missing_count']);
    text(counts,incidents.length+' incidents · '+roster.length+' units · '+missing.length+' resource shortages');
    if(!quiet||changed)say(changed?'Shared CAD updated from another dispatcher. Local workspace remains separate.':'Shared CAD snapshot loaded. Local workspace remains separate.');
   }catch(error){say(error.message)}finally{refreshing=false}
  }
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
    if(refreshTimer)clearInterval(refreshTimer);
    refreshTimer=setInterval(()=>{if(window.CadDemoLogin.current()&&document.visibilityState!=='hidden')refresh({quiet:true})},4000);
   }catch(error){say(error.message)}finally{submit.disabled=false}
  });
  $('cadSharedRefresh').addEventListener('click',()=>refresh());
  $('cadSharedLogout').addEventListener('click',()=>{
   if(refreshTimer){clearInterval(refreshTimer);refreshTimer=null}
   lastSignature='';
   window.CadDemoLogin.logout();
   tbody.replaceChildren();units.replaceChildren();shortages.replaceChildren();
   snapshot={incidents:[],roster:[],assignments:[]};syncChoices();renderWorkspace();renderSharedBoard();
   board.hidden=true;loginPanel.hidden=false;text(headerUser,'Offline');toggle.classList.remove('is-connected');
   say('Signed out of shared CAD. Local demo remains available.');
  });
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
