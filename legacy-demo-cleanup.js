/* Explicit, reversible browser-local legacy CAD cleanup. Never calls Supabase. */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const SAMPLE_AGENCIES=['Sonoma County Sheriff','Petaluma Police','Petaluma Fire / EMS','REDCOM'];
const SAMPLE_UNITS=new Set(['3A12','3A14','3A16','3A18','3A21','3A22','SO12','E1','E2','M2','M3']);
const LOCAL_KEY='smcad-poc-v1',CONFIG_KEY='smcad-config-v1',CLEAN_KEY='smcad-original-demo-cleaned-v1';
const MASTER_KEY='smcad-agency-master-v1',RESOURCE_KEY='smcad-resource-types-v1';
const state=()=>JSON.parse(localStorage.getItem(LOCAL_KEY)||'null')||{units:[],incidents:[]};
const config=()=>JSON.parse(localStorage.getItem(CONFIG_KEY)||'null')||{agencies:[]};
const master=()=>window.CadAgencyMaster?.read(localStorage);
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
function inspect(){
 const local=state(),cfg=config(),m=master()||{agencies:[],units:[],personnel:[]};
 const originalUnits=(local.units||[]).filter(u=>SAMPLE_UNITS.has(u.id)&&SAMPLE_AGENCIES.includes(u.agency));
 const importedUnits=(m.units||[]).filter(u=>u.source==='demo-roster-import');
 const originalIncidents=(local.incidents||[]).filter(i=>/^26-0045(?:18|19|20|21|22|23|24|25)$/.test(i.id)&&SAMPLE_AGENCIES.includes(i.agency));
 const candidateAgencies=(m.agencies||[]).filter(a=>SAMPLE_AGENCIES.includes(a.name)&&a.id==='AG-'+a.name.toUpperCase().replace(/[^A-Z0-9]+/g,'-').replace(/^-|-$/g,''));
 return {local,cfg,m,originalUnits,originalIncidents,importedUnits,candidateAgencies};
}
function mount(){
 if(typeof location==='undefined'||['localhost','127.0.0.1','[::1]'].includes(location.hostname))return;
 const anchor=$('cadMasterList');if(!anchor)return;
 const section=document.createElement('section');section.id='cadLegacyCleanup';section.style.cssText='margin:18px 0;padding:16px;border:1px solid var(--border,#5a6880);border-radius:12px';
 section.innerHTML='<h4>Clean up original demo records</h4><p>Review original sample agency and unit entries. Your new configurations and resource types are preserved. Supabase data is never changed.</p><button id="cadLegacyPreview" type="button">Preview demo cleanup</button><div id="cadLegacyCandidates"></div><p id="cadLegacyStatus" role="status" aria-live="polite"></p>';
 anchor.before(section);
 const candidate=$('cadLegacyCandidates'),status=$('cadLegacyStatus');
 const preview=()=>{
  const {local,m,originalUnits,originalIncidents,importedUnits,candidateAgencies}=inspect();
  const assigned=new Set((local.incidents||[]).filter(i=>i.status!=='CLOSED').flatMap(i=>i.units||[]));
  const rows=[
   ...originalUnits.map(u=>({kind:'local-unit',id:u.id,title:'Operational demo unit '+u.id+' · '+u.agency,blocked:assigned.has(u.id),reason:'assigned to an open incident'})),
   ...originalIncidents.map(i=>({kind:'local-incident',id:i.id,title:'Original sample call '+i.id+' · '+i.agency,blocked:i.status==='ACTIVE'||(i.units||[]).length>0,reason:'active or assigned incident'})),
   ...importedUnits.map(u=>({kind:'master-unit',id:u.id,title:'Imported demo master unit '+u.designator+' · '+(m.agencies.find(a=>a.id===u.agencyId)?.name||u.agencyId),blocked:!!u.personId,reason:'assigned master personnel'})),
   ...candidateAgencies.map(a=>({kind:'master-agency',id:a.id,title:'Imported demo agency '+a.name,blocked:(m.units||[]).some(u=>u.agencyId===a.id&&u.source!=='demo-roster-import')||(m.personnel||[]).some(p=>p.agencyId===a.id),reason:'contains new unit definitions or personnel'}))
  ];
  // No defaults are silently selected. The operator confirms exact identities.
  candidate.innerHTML='<p><strong>Original hard-coded agency names will stop appearing automatically after cleanup.</strong> Existing configured agencies with the same names are retained.</p>'+
   (rows.length?rows.map((r,i)=>'<label style="display:block;margin:7px 0"><input type="checkbox" data-clean-row="'+i+'" '+(r.blocked?'disabled':'')+'> '+escape(r.title)+(r.blocked?' — protected ('+escape(r.reason)+')':'')+'</label>').join(''):'<p>No removable imported demo definitions identified. Default sample names can still be hidden.</p>')+
   '<button type="button" id="cadLegacyBackup">1. Download full browser backup</button> <button type="button" id="cadLegacyApply" disabled>2. Apply selected cleanup</button>';
  let backedUp=false;
  $('cadLegacyBackup').onclick=()=>{
   const keys=[LOCAL_KEY,CONFIG_KEY,MASTER_KEY,RESOURCE_KEY,CLEAN_KEY,'smcad-eight-call-seed-v15','smcad-six-patrol-seed-v1'];
   const data={kind:'cad-browser-backup',exportedAt:new Date().toISOString(),origin:location.origin,values:Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)]))};
   const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
   const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='cad-browser-backup-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
   backedUp=true;$('cadLegacyApply').disabled=false;status.textContent='Backup download started. Save the file somewhere safe before proceeding.';
  };
  $('cadLegacyApply').onclick=()=>{
   if(!backedUp)return;
   if(window.cadSharedIsActive?.()){status.textContent='Switch out of Shared CAD before making browser-local changes. Supabase is not affected.';return;}
   const chosen=rows.filter((r,i)=>!r.blocked&&candidate.querySelector('[data-clean-row="'+i+'"]')?.checked);
   const unitIds=chosen.filter(r=>r.kind==='local-unit').map(r=>r.id);
   const incidentIds=chosen.filter(r=>r.kind==='local-incident').map(r=>r.id);
   const removeMaster=new Set(chosen.filter(r=>r.kind==='master-unit').map(r=>r.id));
   const removeAgencies=new Set(chosen.filter(r=>r.kind==='master-agency').map(r=>r.id));
   const fresh=inspect(),next=structuredClone(fresh.m);
   const stale=chosen.some(r=>r.kind==='local-unit'?!fresh.originalUnits.some(u=>u.id===r.id):r.kind==='local-incident'?!fresh.originalIncidents.some(i=>i.id===r.id):r.kind==='master-unit'?!fresh.importedUnits.some(u=>u.id===r.id):!fresh.candidateAgencies.some(a=>a.id===r.id));
   if(stale){status.textContent='Records changed since preview. Review the cleanup again.';return;}
   next.units=next.units.filter(u=>!removeMaster.has(u.id));
   if([...removeAgencies].some(id=>next.units.some(u=>u.agencyId===id)||next.personnel.some(p=>p.agencyId===id))){status.textContent='An agency still has units or personnel. Remove those first and preview again.';return;}
   next.agencies=next.agencies.filter(a=>!removeAgencies.has(a.id));
   try{window.CadAgencyMaster.validate(next);}catch(e){status.textContent='Cleanup blocked: '+e.message;return;}
   if(!confirm('Apply cleanup to this browser only? Remove '+unitIds.length+' operational demo units, '+incidentIds.length+' idle demo calls, '+removeMaster.size+' imported unit definitions, '+removeAgencies.size+' imported agencies, and hide hard-coded sample agencies? Resource types and Supabase records are preserved.'))return;
   const keys=[LOCAL_KEY,CONFIG_KEY,MASTER_KEY,CLEAN_KEY];
   const snapshot=Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)]));
   try{
    // All validation precedes writes; restore values if an unexpected exception occurs.
    window.CadAgencyMaster.save(localStorage,next);
    window.cadApplyOriginalDemoCleanup({unitIds,incidentIds,agencyNames:[]});
    status.textContent='Cleanup completed. Your resource types and new agency definitions were preserved. Reloading…';
    location.reload();
   }catch(error){
    for(const k of keys){if(snapshot[k]===null)localStorage.removeItem(k);else localStorage.setItem(k,snapshot[k]);}
    status.textContent='Cleanup aborted and browser records restored: '+error.message;
   }
  };
  status.textContent='Select only the original demo entries you recognize. Nothing is selected by default.';
 };
 $('cadLegacyPreview').onclick=preview;
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();
