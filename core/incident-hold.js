/* Read-only CAD incident assignment and hold queue semantics.
 * Does not make database changes. Hold metadata is optional for pre-release projections.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.CadIncidentHold=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const reasons=Object.freeze(['UNIT_BUSY','SPECIFIC_UNIT','SPECIALTY_RESOURCE','DISPATCHER_HOLD','AWAITING_INFORMATION','OTHER']);
 function activeAssignments(incident,assignments){
  return (assignments||[]).filter(a=>a.incident_id===incident.id&&a.cleared_at==null);
 }
 function queue(incident,assignments,hold){
  if(incident.status==='CLOSED')return 'CLOSED';
  if(hold?.active)return 'HELD';
  if(activeAssignments(incident,assignments).length)return 'ASSIGNED';
  return 'PENDING';
 }
 function afterUnitRemoved(incident,remainingAssignments,hold){
  if(incident.status==='CLOSED')return 'CLOSED';
  if(activeAssignments(incident,remainingAssignments).length)return 'ACTIVE';
  return 'PENDING'; // Hold state is independent of database incident status.
 }
 function holdSummary(hold){
  if(!hold?.active)return null;
  return {label:'HOLD',reason:reasons.includes(hold.reason)?hold.reason:'OTHER',
   requestedUnit:hold.requestedUnit||null,requestedCapability:hold.requestedCapability||null,
   heldAt:hold.heldAt||null,notes:hold.notes||''};
 }
 function needsAttention(hold,units){
  if(!hold?.active)return false;
  if(hold.requestedUnit){
   const unit=(units||[]).find(u=>String(u.call_sign||u.id).toUpperCase()===String(hold.requestedUnit).toUpperCase());
   return !!unit&&unit.status==='AVAILABLE';
  }
  return false; // Skill-based matching requires the agency staffing/capability rules.
 }
 return Object.freeze({reasons,activeAssignments,queue,afterUnitRemoved,holdSummary,needsAttention});
});
