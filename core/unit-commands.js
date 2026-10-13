/* Shared synchronous local-demo unit assignment command.
 * This is NOT a concurrent or transactional dispatch backend.
 * Server-side Supabase RPC must revalidate availability and shared crews atomically.
 */
(()=>{'use strict';
 function assign({state,incident,unit,event,source='MANUAL',sharedGroups=[]}){
  if(!incident||!unit)return {ok:false,message:'Incident and unit required'};
  if(incident.status==='CLOSED')return {ok:false,message:'Incident closed'};
  if(unit.status!=='AVAILABLE')return {ok:false,message:'Unit '+unit.id+' is not available'};
  if((incident.units||[]).includes(unit.id))return {ok:false,message:'Unit already assigned'};
  const active=state.incidents.filter(i=>i.status!=='CLOSED');
  if(active.some(i=>(i.units||[]).includes(unit.id)))return {ok:false,message:'Unit '+unit.id+' already committed'};
  const group=sharedGroups.find(g=>(!g.agency||g.agency===incident.agency)&&(g.units||[]).includes(unit.id));
  if(group){
   const busy=new Set(active.flatMap(i=>i.units||[]));
   const occupied=(group.units||[]).find(id=>id!==unit.id&&busy.has(id));
   if(occupied)return {ok:false,message:'Shared crew conflict with '+occupied};
  }
  unit.status='DISPATCHED';unit.location=incident.location;
  incident.units ||= [];incident.units.push(unit.id);
  incident.status='ACTIVE';
  event(incident,source==='PLAN'?'RESPONSE_PLAN_UNIT_DISPATCHED '+unit.id:'UNIT_ASSIGNED '+unit.id);
  return {ok:true,message:'Assigned '+unit.id};
 }
 function assignPlan({state,incident,unitIds,event,sharedGroups=[]}){
  if(!incident||incident.status==='CLOSED')return {ok:false,message:'Incident unavailable'};
  if(!Array.isArray(unitIds)||!unitIds.length||new Set(unitIds).size!==unitIds.length)return {ok:false,message:'Invalid plan units'};
  const candidates=unitIds.map(id=>state.units.find(u=>u.id===id));
  if(candidates.some(u=>!u))return {ok:false,message:'Plan references unknown unit'};
  const active=state.incidents.filter(i=>i.status!=='CLOSED');
  const busy=new Set(active.flatMap(i=>i.units||[]));
  for(const u of candidates){
   if(u.status!=='AVAILABLE'||busy.has(u.id))return {ok:false,message:'Unit '+u.id+' is no longer available'};
   const group=sharedGroups.find(g=>(!g.agency||g.agency===incident.agency)&&(g.units||[]).includes(u.id));
   if(group){
    const occupied=(group.units||[]).find(id=>id!==u.id&&(busy.has(id)||unitIds.includes(id)));
    if(occupied)return {ok:false,message:'Shared crew conflict: '+u.id+' and '+occupied};
   }
  }
  // Validate the full set before applying any changes; local-only, not database atomicity.
  for(const u of candidates){
   u.status='DISPATCHED';u.location=incident.location;
   incident.units ||= [];incident.units.push(u.id);
   event(incident,'RESPONSE_PLAN_UNIT_DISPATCHED '+u.id);
  }
  incident.status='ACTIVE';
  return {ok:true,message:'Dispatched '+unitIds.join(', ')};
 }
 function clear({incident,unit,disposition='',source='MANUAL',event,now}){
  if(!incident||!unit||!(incident.units||[]).includes(unit.id))return {ok:false,message:'Unit not assigned to event'};
  const d=String(disposition||'').trim();
  incident.units=incident.units.filter(id=>id!==unit.id);
  unit.status='CLEAR';unit.location='Available';
  if(d){incident.dispositions ||= [];incident.dispositions.push({unitId:unit.id,time:now(),value:d})}
  event(incident,`UNIT_CLEARED ${unit.id} ${source}${d?' DISPO: '+d:''}`);
  if(!incident.units.length){incident.status=d?'CLOSED':'PENDING';event(incident,d?`INCIDENT_CLOSED DISPO: ${d}`:'INCIDENT_RETURNED_PENDING NO_DISPOSITION')}
  return {ok:true,message:`${unit.id} cleared. Event ${incident.id} ${incident.status}${d?' | Dispo: '+d:''}.`};
 }
 window.CadUnitCommands=Object.freeze({assign,assignPlan,clear});
})();
