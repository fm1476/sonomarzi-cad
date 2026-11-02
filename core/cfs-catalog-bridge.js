/* Convert visual CFS designer records into the agency-scoped Supabase catalog.
 * No network requests or implicit publication are performed here.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CadCfsCatalogBridge=api})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const states={Draft:'DRAFT',Active:'ACTIVE',Inactive:'INACTIVE'};
const priorities={'Priority 1':'P1','Priority 2':'P2','Priority 3':'P3','Priority 4':'P4'};
function toCloud(item,catalog){
 if(!item||!Array.isArray(catalog))throw Error('CFS type and catalog required');
 if(!UUID.test(item.id))throw Error('Publish requires a database UUID; save the type first');
 if(!['LAW','FIRE','EMS'].includes(item.discipline))throw Error('Invalid CFS discipline');
 if(!String(item.name||'').trim()||!String(item.code||'').trim())throw Error('CFS name and code required');
 const autoCreate=[];
 for(const [discipline,key] of [['FIRE','fire'],['EMS','ems']]){
  if(!item[key+'Enabled'])continue;
  const target=catalog.find(x=>x.id===item[key]);
  if(!target||target.discipline!==discipline||item.discipline===discipline)throw Error('Invalid '+discipline+' linked type');
  if(!UUID.test(target.id))throw Error('Save linked '+discipline+' type to database first');
  if((states[target.publication]||target.publication)!=='ACTIVE')throw Error('Activate linked '+discipline+' type before publishing mapping');
  autoCreate.push(target.id);
 }
 return {id:item.id,discipline:item.discipline,name:item.name,code:item.code,category:item.category||'',priority:priorities[item.priority]||item.priority||'P2',description:item.description||'',publication:states[item.publication]||item.publication||'DRAFT',autoCreate};
}
function fromCloud(types){
 if(!Array.isArray(types))throw Error('CFS catalog must be an array');
 return types.map(t=>{const links=Array.isArray(t.autoCreate)?t.autoCreate:[];const linked=d=>types.find(x=>x.discipline===d&&links.includes(x.id));return {id:t.id,name:t.name,code:t.code,discipline:t.discipline,category:t.category||'',priority:Object.keys(priorities).find(k=>priorities[k]===t.priority)||t.priority,description:t.description||'',publication:Object.keys(states).find(k=>states[k]===t.publication)||t.publication,fire:linked('FIRE')?.id||'',ems:linked('EMS')?.id||'',fireEnabled:!!linked('FIRE'),emsEnabled:!!linked('EMS')}})
}
return Object.freeze({toCloud,fromCloud});
});
