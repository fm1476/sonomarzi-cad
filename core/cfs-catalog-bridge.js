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
async function saveCatalog({api,agency,catalog,makeId}){
 let writesStarted=false;
 try{
  if(!Array.isArray(catalog)||!catalog.length)throw Error('Add at least one call type before saving.');
  const pending=structuredClone(catalog),codes=new Set();
  const key=item=>String(item.discipline||'').trim().toUpperCase()+':'+String(item.code||'').trim().toUpperCase();
  for(const item of pending){
   if(!String(item.name||'').trim()||!String(item.code||'').trim())throw Error('Every call type needs a name and code.');
   if(codes.has(key(item)))throw Error('Two local call types use the same discipline and code. Give each one a different code.');
   codes.add(key(item));
  }
  // Check the agency before any save, including new drafts with different UUIDs.
  // Never silently overwrite an existing active type with a seeded/local draft.
  const existing=await api.loadCfsCatalog(agency);
  for(const item of pending){
   const conflict=existing.find(saved=>key(saved)===key(item)&&saved.id!==item.id);
   if(conflict)throw Error('A '+item.discipline+' call type with code '+String(item.code).trim().toUpperCase()+' is already saved for this agency. Use Export Call Types to keep your drafts, then Load Agency Call Types to edit the saved type. For a new type, choose a different code.');
  }
  const changed=new Map();
  for(const item of pending)if(!UUID.test(item.id)){
   const previous=item.id;item.id=makeId();changed.set(previous,item.id);
  }
  for(const item of pending)for(const field of ['fire','ems'])if(changed.has(item[field]))item[field]=changed.get(item[field]);
  // Validate all mappings before the first network write.
  const payloads=pending.map(item=>toCloud(item,pending));
  for(const payload of payloads){writesStarted=true;await api.saveCfsType({agency,cfsType:{...payload,autoCreate:[]}})}
  for(const payload of payloads)if(payload.autoCreate.length)await api.saveCfsType({agency,cfsType:payload});
  return pending;
 }catch(error){
  const message=String(error?.message||'');
  const friendly=/409|23505|duplicate key|cad_cfs_types_agency_id_discipline_code_key/i.test(message)
   ?'Another saved call type already uses this discipline and code. Load Agency Call Types to review the latest saved types before retrying.'
   :message;
  const result=new Error(friendly||'The agency call types could not be saved.');
  result.writesStarted=writesStarted;throw result;
 }
}
function importLegacyTypes(legacy,existing,makeId){
 const catalog=structuredClone(existing),added=[],skipped=[];
 const normalized=value=>String(value||'').trim().replace(/\s+/g,' ').toUpperCase();
 const codes=new Set(catalog.map(item=>item.discipline+':'+normalized(item.code)));
 for(const discipline of ['LAW','FIRE','EMS'])for(const value of legacy[discipline]||[]){
  const name=String(value||'').trim();if(!name)continue;
  if(catalog.some(item=>item.discipline===discipline&&normalized(item.name)===normalized(name))){skipped.push({discipline,name});continue}
  const stem=(normalized(name).replace(/[^A-Z0-9]+/g,'_').replace(/^_|_$/g,'')||'CFS').slice(0,26);
  let code=stem,suffix=2;while(codes.has(discipline+':'+code))code=stem+'_'+suffix++;
  codes.add(discipline+':'+code);
  const item={id:makeId(),name,code,discipline,category:'Imported',priority:'Priority 2',description:'Imported from the previous CFS list. Review the code, priority and response settings before activation.',publication:'Draft',fire:'',ems:'',fireEnabled:false,emsEnabled:false};
  catalog.push(item);added.push(item);
 }
 return {catalog,added,skipped};
}
return Object.freeze({toCloud,fromCloud,saveCatalog,importLegacyTypes});
});
