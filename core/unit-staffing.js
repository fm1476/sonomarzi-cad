/* Pure shift staffing and sign-on transitions for demo CAD units. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.CadUnitStaffing=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
function assign(master,state,unitId,personIds){
 const unit=state.units.find(u=>u.id===unitId);if(!unit)throw Error('Active CAD unit not found.');
 if(!unit.masterUnitId)throw Error('Only configured master units support staffing in this preview.');
 const def=master.units.find(u=>u.id===unit.masterUnitId);if(!def)throw Error('Unit master definition no longer exists.');
 if(!Array.isArray(personIds)||!personIds.length||new Set(personIds).size!==personIds.length)throw Error('Select one or more distinct personnel.');
 const crew=personIds.map(id=>{const p=master.personnel.find(p=>p.id===id);if(!p)throw Error('Unknown personnel: '+id);if(p.agencyId!==def.agencyId)throw Error('Personnel belongs to a different agency: '+id);return {id:p.id,name:p.name};});
 for(const other of state.units){if(other.id!==unitId&&other.staffing?.active&&other.staffing.personIds.some(id=>personIds.includes(id)))throw Error('Personnel already signed on to '+other.id);}
 const now=new Date().toISOString();
 return {...state,units:state.units.map(u=>u.id===unitId?{...u,staffing:{active:true,personIds:[...personIds],crew,startedAt:now}}:u)};
}
function signOff(state,unitId){
 const unit=state.units.find(u=>u.id===unitId);if(!unit)throw Error('Active CAD unit not found.');
 if(!unit.staffing?.active)throw Error('Unit is not signed on.');
 if(unit.status!=='AVAILABLE'&&unit.status!=='OUTOFSERVICE')throw Error('Unit must be available or out of service before sign-off.');
 if(state.incidents.some(i=>i.status!=='CLOSED'&&i.units?.includes(unitId)))throw Error('Unit is still assigned to an open incident.');
 return {...state,units:state.units.map(u=>u.id===unitId?{...u,staffing:{...u.staffing,active:false,endedAt:new Date().toISOString()}}:u)};
}
return Object.freeze({assign,signOff});
});