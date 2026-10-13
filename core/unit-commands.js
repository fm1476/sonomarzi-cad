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
 window.CadUnitCommands=Object.freeze({assign});
})();
