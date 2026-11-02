/* Agency CFS mapping planner: selecting one configured CFS type can spawn linked disciplines. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.CadCfsMappings=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const DISCIPLINES=['LAW','FIRE','EMS'];
function validate(catalog){
 if(!Array.isArray(catalog))throw Error('CFS catalog must be an array');
 const byId=new Map();
 for(const item of catalog){
  if(!item||typeof item.id!=='string'||!item.id.trim()||!DISCIPLINES.includes(item.discipline)||typeof item.label!=='string'||!item.label.trim())throw Error('Invalid CFS type');
  if(byId.has(item.id))throw Error('Duplicate CFS type ID');
  byId.set(item.id,item);
 }
 for(const item of catalog){
  const disciplines=new Set([item.discipline]);
  if(!Array.isArray(item.autoCreate||[]))throw Error('Invalid linked CFS mappings');
  for(const id of item.autoCreate||[]){
   const linked=byId.get(id);
   if(!linked)throw Error('Linked CFS type not found');
   if(disciplines.has(linked.discipline))throw Error('Duplicate discipline in combined event');
   disciplines.add(linked.discipline);
  }
 }
 return byId;
}
function plan(catalog,selectedId){
 const byId=validate(catalog),primary=byId.get(selectedId);
 if(!primary)throw Error('CFS type not found');
 return [primary,...(primary.autoCreate||[]).map(id=>byId.get(id))].map(x=>({cfsTypeId:x.id,discipline:x.discipline,type:x.label,responsePlanId:x.responsePlanId||null}));
}
return Object.freeze({validate,plan});
});
