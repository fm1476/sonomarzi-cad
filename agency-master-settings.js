/* Agency master editor: browser-local and deliberately separate from demo reset. */
(function(){
'use strict';
const M=window.CadAgencyMaster;if(!M)return;
const el=id=>document.getElementById(id),message=el('cadMasterMessage'),list=el('cadMasterList');
if(!message||!list)return;
let data;
try{data=M.read(localStorage);}catch(e){message.textContent='Saved master data could not be loaded: '+e.message+'. Export/recover it before editing.';return;}
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const opts=(items,value)=>items.map(x=>'<option value="'+esc(x.id)+'"'+(x.id===value?' selected':'')+'>'+esc(x.name)+'</option>').join('');
const TYPES={LAW:['PATROL','SUPERVISOR','TRAFFIC','K9','DETECTIVE','SWAT','MOTOR','OTHER'],FIRE:['ENGINE','TRUCK','LADDER','RESCUE','BRUSH','CHIEF','TENDER','MEDIC','AMBULANCE','OTHER'],EMS:['AMBULANCE','MEDIC','ENGINE','RESCUE','CHIEF','SUPERVISOR','OTHER']};
function refreshTypes(){const e=el('cadMasterResourceType');if(!e)return;const previous=e.value;e.innerHTML=(TYPES[el('cadMasterDiscipline').value]||[]).map(t=>'<option>'+t+'</option>').join('');if([...e.options].some(o=>o.value===previous))e.value=previous}
el('cadMasterDiscipline').addEventListener('change',refreshTypes);refreshTypes();
function importDemoRoster(){
 const source=window.cadSafetyState?.();
 if(!source||!Array.isArray(source.units))return message.textContent='CAD roster unavailable.';
 const next=structuredClone(data),added={agencies:0,units:0},skipped=[];
 const agencyNames=[...new Set([...(source.units||[]).map(u=>u.agency),...(JSON.parse(localStorage.getItem('smcad-config-v1')||'{}').agencies||[])])].filter(Boolean);
 for(const name of agencyNames){
  if(next.agencies.some(a=>a.name.toLowerCase()===name.toLowerCase()))continue;
  let id='AG-'+name.toUpperCase().replace(/[^A-Z0-9]+/g,'-').replace(/^-|-$/g,'');
  let base=id,n=2;while(next.agencies.some(a=>a.id===id))id=base+'-'+n++;
  next.agencies.push({id,name,model:'APPARATUS'});added.agencies++;
 }
 for(const unit of source.units){
  const agency=next.agencies.find(a=>a.name.toLowerCase()===String(unit.agency).toLowerCase());
  if(!agency||!unit.id||!['LAW','FIRE','EMS'].includes(unit.discipline)){skipped.push(unit.id||'?');continue}
  if(next.units.some(u=>u.agencyId===agency.id&&u.designator.toUpperCase()===String(unit.id).toUpperCase()))continue;
  let id='UNIT-'+agency.id+'-'+String(unit.id).toUpperCase().replace(/[^A-Z0-9]+/g,'-');
  let base=id,n=2;while(next.units.some(u=>u.id===id))id=base+'-'+n++;
  const designator=String(unit.id);
  const type=unit.discipline==='LAW'?'PATROL':/^E\d/i.test(designator)?'ENGINE':/^T\d/i.test(designator)?'TRUCK':/^R\d/i.test(designator)?'RESCUE':/^M\d/i.test(designator)?'AMBULANCE':/^C\d/i.test(designator)?'CHIEF':'OTHER';
  next.units.push({id,designator,agencyId:agency.id,discipline:unit.discipline,model:'APPARATUS',resourceType:type,minStaffing:0,qualifications:[],source:'demo-roster-import'});
  added.units++;
 }
 try{M.save(localStorage,next);data=next;render();message.textContent='Imported '+added.agencies+' agencies and '+added.units+' unit definitions; '+skipped.length+' skipped. Existing master records were preserved. Staffing requirements remain unverified and unset.';window.dispatchEvent(new Event('cad-master-updated'))}
 catch(e){message.textContent='Import failed; nothing changed: '+e.message}
}
function renderStaff(){
 const unitSelect=el('cadStaffUnit'),crewSelect=el('cadStaffCrew'),status=el('cadStaffCurrent');
 const active=window.cadMasterActiveUnits?.()||[];
 const previous=unitSelect.value;
 unitSelect.innerHTML=active.length?opts(active.map(u=>({id:u.id,name:u.id+' · '+u.status+(u.staffing?.active?' · signed on':'')}))):'<option value="">No activated units</option>';
 if(active.some(u=>u.id===previous))unitSelect.value=previous;
 const unit=active.find(u=>u.id===unitSelect.value);
 const definition=data.units.find(u=>u.id===unit?.masterUnitId);
 const eligible=data.personnel.filter(p=>p.agencyId===definition?.agencyId);
 crewSelect.innerHTML=eligible.length?opts(eligible.map(p=>({id:p.id,name:p.name+' ('+p.id+')'}))):'<option value="">No personnel available for this agency</option>';
 for(const option of crewSelect.options)option.selected=!!unit?.staffing?.active&&unit.staffing.personIds.includes(option.value);
 status.textContent=!active.length?'No activated units found. Activate a unit in Configuration → Agencies & Units first.':!definition?'Unit definition missing. Re-activate the unit from Agency Configuration.':!eligible.length?'No personnel for this agency. Add personnel in Agency Configuration.':unit?.staffing?.active?'On duty: '+unit.staffing.crew.map(p=>p.name).join(', '):'No crew currently signed on.';
 el('cadStaffSignOn').disabled=!unit||!definition||!eligible.length;
 el('cadStaffSignOff').disabled=!unit?.staffing?.active;
}

function render(){
 if(!el('cadMasterLinkExisting')){const b=document.createElement('button');b.id='cadMasterLinkExisting';b.type='button';b.textContent='Link Existing CAD Units to Agency Master';b.style.margin='8px';b.addEventListener('click',()=>{const result=window.cadLinkExistingMasterUnits?.();message.textContent=result?.ok?result.linked+' existing operational unit(s) linked. No duplicates created and statuses preserved.':'Link failed: '+(result?.error||'CAD integration unavailable');renderStaff()});list.before(b)}
 if(!el('cadMasterImportDemo')){const b=document.createElement('button');b.id='cadMasterImportDemo';b.type='button';b.textContent='Import Existing CAD Agencies & Units';b.style.margin='8px 0';b.addEventListener('click',()=>{if(confirm('Copy the current CAD agency names and unit designators into persistent Agency Master? Existing master records will be preserved. No personnel or staffing will be invented.'))importDemoRoster()});list.before(b)}
 list.innerHTML='<h4>Agencies ('+data.agencies.length+')</h4>'+(data.agencies.map(a=>'<div>'+esc(a.name)+' ('+esc(a.id)+') · '+esc(a.model)+'</div>').join('')||'<p>No configured agencies yet.</p>')+
 '<h4>Personnel ('+data.personnel.length+')</h4>'+(data.personnel.map(p=>'<div>'+esc(p.name)+' ('+esc(p.id)+') · '+esc(p.agencyId)+'</div>').join('')||'<p>No configured personnel yet.</p>')+
 '<h4>Units ('+data.units.length+')</h4>'+(data.units.map(u=>'<div><strong>'+esc(u.designator)+'</strong> · '+esc(u.agencyId)+' · '+esc(u.discipline)+' · '+esc(u.model)+(u.resourceType?' · '+esc(u.resourceType):'')+(u.personId?' · '+esc(u.personId):'')+' <button type="button" data-unit-activate="'+esc(u.id)+'">Activate in CAD</button> <button type="button" data-unit-delete="'+esc(u.id)+'">Remove</button></div>').join('')||'<p>No configured units yet.</p>');
 el('cadMasterAgencySelect').innerHTML=opts(data.agencies.map(a=>({id:a.id,name:a.name})));
 el('cadMasterPersonnelAgency').innerHTML=opts(data.agencies.map(a=>({id:a.id,name:a.name})));
 el('cadMasterPersonSelect').innerHTML='<option value="">None / assigned at sign-on</option>'+opts(data.personnel.filter(p=>p.agencyId===el('cadMasterAgencySelect').value).map(p=>({id:p.id,name:p.name+' ('+p.id+')'})));
 renderStaff();
}
function commit(next,success){try{M.save(localStorage,next);data=next;render();message.textContent=success;}catch(e){message.textContent='Not saved: '+e.message;}}
el('cadMasterAgencySelect').addEventListener('change',()=>{const agencyId=el('cadMasterAgencySelect').value;el('cadMasterPersonSelect').innerHTML='<option value="">None / assigned at sign-on</option>'+opts(data.personnel.filter(p=>p.agencyId===agencyId).map(p=>({id:p.id,name:p.name+' ('+p.id+')'})));});
el('cadStaffUnit').addEventListener('change',renderStaff);
window.addEventListener('focus',renderStaff);
document.addEventListener('click',e=>{if(e.target?.closest?.('[data-unit-activate]'))setTimeout(renderStaff,0);});
el('cadStaffSignOn').addEventListener('click',()=>{
 const unitId=el('cadStaffUnit').value,personIds=[...el('cadStaffCrew').selectedOptions].map(o=>o.value);
 const result=window.cadStaffMasterUnit?.(unitId,personIds);
 el('cadStaffMessage').textContent=result?.ok?'Crew signed on.':'Sign-on rejected: '+(result?.error||'CAD integration unavailable');
 renderStaff();
});
el('cadStaffSignOff').addEventListener('click',()=>{
 const result=window.cadSignOffMasterUnit?.(el('cadStaffUnit').value);
 el('cadStaffMessage').textContent=result?.ok?'Crew signed off.':'Sign-off rejected: '+(result?.error||'CAD integration unavailable');
 renderStaff();
});
el('cadMasterAddAgency').addEventListener('click',()=>{
 const id=el('cadMasterAgencyId').value.trim(),name=el('cadMasterAgencyName').value.trim(),model=el('cadMasterAgencyModel').value;
 if(!id||!name){message.textContent='Agency ID and name are required.';return;}
 commit({...data,agencies:[...data.agencies,{id,name,model}]},'Agency saved. Configuration survives demo reset.');
});
el('cadMasterAddPerson').addEventListener('click',()=>{
 const id=el('cadMasterPersonId').value.trim(),name=el('cadMasterPersonName').value.trim(),agencyId=el('cadMasterPersonnelAgency').value;
 if(!id||!name){message.textContent='Personnel ID and name are required.';return;}
 commit({...data,personnel:[...data.personnel,{id,name,agencyId}]},'Personnel saved.');
});
el('cadMasterAddUnit').addEventListener('click',()=>{
 const id=el('cadMasterUnitId').value.trim(),designator=el('cadMasterDesignator').value.trim(),agencyId=el('cadMasterAgencySelect').value,discipline=el('cadMasterDiscipline').value,model=el('cadMasterUnitModel').value,personId=el('cadMasterPersonSelect').value;
 if(!id||!designator){message.textContent='Unit ID and designator are required.';return;}
 commit({...data,units:[...data.units,{id,designator,agencyId,discipline,model,personId,resourceType:el('cadMasterResourceType').value,minStaffing:Number(el('cadMasterMinStaffing').value),qualifications:el('cadMasterQualifications').value.split(',').map(x=>x.trim()).filter(Boolean)}]},'Unit saved. This is a master definition, not a live CAD assignment.');
});
list.addEventListener('click',e=>{
 const activateId=e.target?.getAttribute('data-unit-activate');if(activateId){const result=window.cadActivateMasterUnit?.(activateId);message.textContent=result?.ok?'Unit activated in live CAD roster.':'Activation failed: '+(result?.error||'CAD integration unavailable');renderStaff();return;}
 const id=e.target?.getAttribute('data-unit-delete');if(!id)return;
 if(!confirm('Remove this unit master definition? This does not change active demo CAD units.'))return;
 commit({...data,units:data.units.filter(u=>u.id!==id)},'Unit definition removed.');
});
el('cadMasterExport').addEventListener('click',()=>{
 const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='cad-agency-master.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
el('cadMasterImport').addEventListener('change',async e=>{
 const file=e.target.files?.[0];if(!file)return;
 try{const next=M.parse(await file.text());if(!confirm('Replace browser-local agency master configuration with this file?'))return;commit(next,'Agency master imported.');}catch(err){message.textContent='Import rejected: '+err.message;}finally{e.target.value='';}
});
window.addEventListener('storage',e=>{if(e.key!==M.KEY)return;try{data=M.read(localStorage);render();message.textContent='Configuration refreshed from another tab.';}catch(err){message.textContent='External configuration invalid: '+err.message;}});
render();
})();