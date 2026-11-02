/* Shared apparatus crew configuration, independent of individual staffing. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.CadSharedCrewConfig=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const id=x=>String(x??'').trim();
function validate(groups,units){
 const errors=[],occupied=new Map(),known=new Map(units.map(u=>[id(u.id),u]));
 const names=new Set();
 for(const group of groups){
  const members=group.unitIds||[];
  if(!id(group.name))errors.push('Each crew group needs a name.');
  const label=id(group.name).toUpperCase();
  if(label&&names.has(label))errors.push('Duplicate shared-crew group name: '+group.name);
  names.add(label);
  if(!Array.isArray(members)){errors.push('Crew members must be an array.');continue}
  if(new Set(members.map(id)).size!==members.length)errors.push('Duplicate apparatus within group '+group.name);
  if(members.length<2)errors.push('Group '+(group.name||group.id)+' requires at least two apparatus.');
  for(const unitId of members){
   const key=id(unitId);
   if(!known.has(key)){errors.push('Unknown apparatus: '+key);continue}
   const unit=known.get(key);
   if(group.agencyId&&unit.agency_id&&group.agencyId!==unit.agency_id)errors.push('Apparatus '+(unit.call_sign||key)+' is outside the configured agency.');
   if(occupied.has(key))errors.push('Apparatus '+(unit.call_sign||key)+' belongs to multiple shared-crew groups.');
   occupied.set(key,group.id);
  }
 }
 return [...new Set(errors)];
}
function blockedUnits(groups,committedUnitIds){
 const committed=new Set(committedUnitIds.map(id)),blocked=new Map();
 for(const group of groups){
  const members=group.unitIds||[];
  const active=members.filter(unitId=>committed.has(unitId));
  if(!active.length)continue;
  for(const unitId of members)if(!committed.has(unitId))blocked.set(unitId,{crewId:group.id,crewName:group.name,committedBy:active.slice()});
 }
 return blocked;
}
return Object.freeze({validate,blockedUnits});
});
