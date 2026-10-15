/* Hosted CAD explicit cleanup: remove exactly three legacy browser-local agencies.
 * Always requires backup and human confirmation; never invokes Supabase APIs.
 */
(()=>{
'use strict';
const TARGETS=Object.freeze([
 {id:'AG-SONOMA-COUNTY-SHERIFF',name:'Sonoma County Sheriff'},
 {id:'AG-PETALUMA-FIRE-EMS',name:'Petaluma Fire / EMS'},
 {id:'AG-REDCOM',name:'REDCOM'}
]);
const KEY={local:'smcad-poc-v1',config:'smcad-config-v1',master:'smcad-agency-master-v1',resources:'smcad-resource-types-v1',clean:'smcad-original-demo-cleaned-v1'};
const $=id=>document.getElementById(id);
const safe=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const load=(key,fallback)=>{const raw=localStorage.getItem(key);return raw===null?fallback:JSON.parse(raw)};
function inspect(){
 const master=window.CadAgencyMaster.read(localStorage);
 const local=load(KEY.local,{incidents:[],units:[]}),config=load(KEY.config,{agencies:[]});
 const resources=load(KEY.resources,[]);
 if(!Array.isArray(resources)||!Array.isArray(local.incidents)||!Array.isArray(local.units)||!Array.isArray(config.agencies))throw Error('Browser CAD data invalid. Export before editing.');
 return {master,local,config,resources};
}
function affected(data,selected){
 const names=new Set(selected.map(t=>t.name)),ids=new Set(selected.map(t=>t.id));
 const matchingMaster=data.master.agencies.filter(a=>ids.has(a.id)&&names.has(a.name));
 const actualIds=new Set(matchingMaster.map(a=>a.id));
 const masterUnits=data.master.units.filter(u=>actualIds.has(u.agencyId));
 const personnel=data.master.personnel.filter(p=>actualIds.has(p.agencyId));
 return {
  masterAgencies:matchingMaster,
  masterUnits,personnel,
  operationalUnits:data.local.units.filter(u=>names.has(u.agency)),
  incidents:data.local.incidents.filter(i=>names.has(i.agency)),
  resourceTypes:data.resources.filter(x=>names.has(x.agency)),
  configAgencies:data.config.agencies.filter(x=>names.has(x))
 };
}
function mount(){
 if(['localhost','127.0.0.1','[::1]'].includes(location.hostname))return;
 const anchor=$('cadMasterList');if(!anchor)return;
 const section=document.createElement('section');section.id='cadLegacyCleanup';
 section.style.cssText='margin:18px 0;padding:16px;border:1px solid var(--border,#5a6880);border-radius:12px';
 section.innerHTML='<h4>Remove original demo agencies</h4><p>Select the legacy agency records to remove, along with their associated browser-local personnel, units, calls and agency-specific resource types. Petaluma Police and Supabase records are never changed.</p><div id="cadLegacyCandidates"></div><p id="cadLegacyStatus" role="status" aria-live="polite"></p>';
 anchor.before(section);
 const candidate=$('cadLegacyCandidates'),status=$('cadLegacyStatus');
 let previewData;
 function render(){
  try{previewData=inspect();}catch(e){status.textContent='Unable to read CAD configuration: '+e.message;return;}
  candidate.innerHTML=TARGETS.map(t=>{
   const counts=affected(previewData,[t]);
   return '<label style="display:block;margin:10px 0"><input type="checkbox" data-agency="'+safe(t.id)+'"> <strong>'+safe(t.name)+'</strong> ('+safe(t.id)+') — '+counts.masterUnits.length+' master units, '+counts.personnel.length+' personnel, '+counts.operationalUnits.length+' operational units, '+counts.incidents.length+' browser calls, '+counts.resourceTypes.length+' resource types</label>';
  }).join('')+'<button type="button" id="cadLegacyPreview">Preview selected records</button><div id="cadLegacyDetail"></div><button type="button" id="cadLegacyBackup" disabled>1. Download full browser backup</button> <button type="button" id="cadLegacyApply" disabled>2. Delete selected agency data</button>';
  const chosen=()=>TARGETS.filter(t=>candidate.querySelector('[data-agency="'+t.id+'"]')?.checked);
  const details=$('cadLegacyDetail'),backup=$('cadLegacyBackup'),apply=$('cadLegacyApply');
  let backedUp=false,selected=[],signature='';
  candidate.querySelectorAll('[data-agency]').forEach(x=>x.onchange=()=>{backup.disabled=true;apply.disabled=true;backedUp=false;details.textContent='Selection changed. Preview again.';});
  $('cadLegacyPreview').onclick=()=>{
   if(window.cadSharedIsActive?.()){status.textContent='Switch out of Shared CAD before using this browser-only cleanup.';return;}
   selected=chosen();if(!selected.length){status.textContent='Select at least one agency.';return;}
   const fresh=inspect(),records=affected(fresh,selected);
   signature=JSON.stringify({selected,records});
   const lines=[
    ['Agency masters',records.masterAgencies.map(x=>x.name+' ('+x.id+')')],
    ['Personnel',records.personnel.map(x=>x.name+' ('+x.id+')')],
    ['Master unit definitions',records.masterUnits.map(x=>x.designator+' ('+x.id+')')],
    ['Operational units',records.operationalUnits.map(x=>x.id)],
    ['Browser-local calls',records.incidents.map(x=>x.id)],
    ['Resource types',records.resourceTypes.map(x=>x.agency+' — '+x.discipline+' — '+x.name)],
    ['Agency configuration',records.configAgencies]
   ];
   details.innerHTML='<p><strong>Preview of records to remove:</strong></p>'+lines.map(([title,values])=>'<details><summary>'+safe(title)+' ('+values.length+')</summary><p>'+safe(values.join(', ')||'None')+'</p></details>').join('')+'<p>All other agency and resource-type records will be preserved. Shared CAD Supabase records will not be modified.</p>';
   backedUp=false;apply.disabled=true;backup.disabled=false;
   status.textContent='Review the counts, then download the backup before applying.';
  };
  backup.onclick=()=>{
   if(!selected.length||!signature)return;
   const values={};
   for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key?.startsWith('smcad-'))values[key]=localStorage.getItem(key);}
   const data={kind:'cad-hosted-browser-backup',origin:location.origin,exportedAt:new Date().toISOString(),values};
   const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
   const link=document.createElement('a');link.href=url;link.download='cad-hosted-backup-'+new Date().toISOString().slice(0,10)+'.json';link.click();
   setTimeout(()=>URL.revokeObjectURL(url),30000);
   backedUp=true;apply.disabled=false;status.textContent='Backup download started. Verify you saved it before deleting.';
  };
  apply.onclick=()=>{
   if(!backedUp||!selected.length||window.cadSharedIsActive?.())return;
   const fresh=inspect(),records=affected(fresh,selected);
   if(signature!==JSON.stringify({selected,records})){status.textContent='Configuration changed since preview. Preview and download another backup.';apply.disabled=true;return;}
   const selectedIds=new Set(records.masterAgencies.map(x=>x.id)),names=new Set(selected.map(x=>x.name));
   const next=structuredClone(fresh.master);
   next.agencies=next.agencies.filter(x=>!selectedIds.has(x.id));
   next.units=next.units.filter(x=>!selectedIds.has(x.agencyId));
   next.personnel=next.personnel.filter(x=>!selectedIds.has(x.agencyId));
   try{window.CadAgencyMaster.validate(next);}catch(e){status.textContent='Validation blocked cleanup: '+e.message;return;}
   if(!confirm('DELETE all browser-local records belonging to '+selected.map(x=>x.name).join(', ')+'? This includes personnel, unit definitions, calls and resource types. Keep your downloaded backup. Shared Supabase records will NOT be deleted.'))return;
   const keys=Object.values(KEY),before=Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)]));
   try{
    window.CadAgencyMaster.save(localStorage,next);
    localStorage.setItem(KEY.resources,JSON.stringify(fresh.resources.filter(x=>!names.has(x.agency))));
    window.cadApplyOriginalDemoCleanup({agencyNames:selected.map(x=>x.name)});
    status.textContent='Selected browser-local agency data removed. Reloading…';
    location.reload();
   }catch(e){
    for(const k of keys){if(before[k]===null)localStorage.removeItem(k);else localStorage.setItem(k,before[k]);}
    status.textContent='Cleanup failed; stored data restored: '+e.message;
   }
  };
  status.textContent='Nothing is selected or deleted automatically. This operates only on this browser profile.';
 }
 render();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();
