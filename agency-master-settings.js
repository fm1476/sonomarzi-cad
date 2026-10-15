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
function refreshTypes(){const e=el('cadMasterResourceType');if(!e)return;const previous=e.value;const disc=el('cadMasterDiscipline').value,agencyId=el('cadMasterAgencySelect').value,agency=data.agencies.find(a=>a.id===agencyId)?.name||'';const types=window.CadResourceTypes?.forAgency(agency,disc).map(x=>x.name)||[];e.innerHTML=types.map(t=>'<option>'+esc(t)+'</option>').join('');if([...e.options].some(o=>o.value===previous))e.value=previous}
el('cadMasterDiscipline').addEventListener('change',refreshTypes);el('cadMasterAgencySelect').addEventListener('change',refreshTypes);window.addEventListener('cad-resource-types-updated',refreshTypes);refreshTypes();
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
async function logOnDuty(masterUnitId){
 const def=data.units.find(u=>u.id===masterUnitId);
 if(!def)throw Error('Unit definition not found.');
 const agency=data.agencies.find(a=>a.id===def.agencyId);
 if(!agency)throw Error('Owning agency not found.');
 if(window.cadSharedIsActive?.()){
  if(typeof window.cadSharedRegisterMasterUnit!=='function')throw Error('Shared CAD logon unavailable. Check dispatcher connection.');
  return await window.cadSharedRegisterMasterUnit(def,agency.name);
 }
 const current=window.cadMasterActiveUnits?.().find(u=>u.masterUnitId===masterUnitId);
 if(current)return {ok:true,alreadyOnDuty:true,callSign:current.id};
 const result=window.cadActivateMasterUnit?.(masterUnitId);
 if(!result?.ok)throw Error(result?.error||'Local activation failed');
 return {ok:true,callSign:def.designator};
}
window.cadLogOnConfiguredUnit=logOnDuty;
function renderDutyLogOnOptions(){
 const select=el('cadDutyLogOnSelect'),button=el('cadDutyLogOnButton');if(!select||!button)return;
 const previous=select.value;
 const shared=!!window.cadSharedIsActive?.();
 const roster=shared?(window.cadSharedRoster?.()||[]):[];
 const local=window.cadMasterActiveUnits?.()||[];
 const eligible=data.units.filter(def=>{
  const match=shared?roster.find(u=>u.call_sign.toUpperCase()===def.designator.toUpperCase()):local.find(u=>u.masterUnitId===def.id);
  return !match||shared&&match.status==='OFF_DUTY';
 });
 select.innerHTML='<option value="">Choose configured unit</option>'+eligible.map(def=>{
  const agency=data.agencies.find(a=>a.id===def.agencyId)?.name||'';
  return '<option value="'+esc(def.id)+'">'+esc(def.designator+' · '+agency+' · '+def.discipline)+'</option>';
 }).join('');
 if(eligible.some(x=>x.id===previous))select.value=previous;
 button.disabled=!select.value;
}
const logOnSelect=el('cadDutyLogOnSelect'),logOnButton=el('cadDutyLogOnButton');
logOnSelect?.addEventListener('change',()=>{if(logOnButton)logOnButton.disabled=!logOnSelect.value;});
logOnButton?.addEventListener('click',async()=>{
 const id=logOnSelect?.value;if(!id)return;
 logOnButton.disabled=true;el('cadDutyLogOnStatus').textContent='Logging on…';
 try{
  const result=await logOnDuty(id);
  el('cadDutyLogOnStatus').textContent=result.alreadyOnDuty?result.callSign+' is already on duty.':result.callSign+' is now AVAILABLE.';
 }catch(error){el('cadDutyLogOnStatus').textContent='Logon failed: '+error.message;}
 renderDutyLogOnOptions();
});
window.addEventListener('cad-master-updated',renderDutyLogOnOptions);

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
 const logOff=el('cadStaffLogOff');if(logOff)logOff.disabled=!unit||!!unit.staffing?.active||!['AVAILABLE','OUTOFSERVICE'].includes(unit.status);
}

function render(){
 if(!el('cadMasterLinkExisting')){const b=document.createElement('button');b.id='cadMasterLinkExisting';b.type='button';b.textContent='Link Existing CAD Units to Agency Master';b.style.margin='8px';b.addEventListener('click',()=>{const result=window.cadLinkExistingMasterUnits?.();message.textContent=result?.ok?result.linked+' existing operational unit(s) linked. No duplicates created and statuses preserved.':'Link failed: '+(result?.error||'CAD integration unavailable');renderStaff()});list.before(b)}
 if(!el('cadMasterImportDemo')){const b=document.createElement('button');b.id='cadMasterImportDemo';b.type='button';b.textContent='Import Existing CAD Agencies & Units';b.style.margin='8px 0';b.addEventListener('click',()=>{if(confirm('Copy the current CAD agency names and unit designators into persistent Agency Master? Existing master records will be preserved. No personnel or staffing will be invented.'))importDemoRoster()});list.before(b)}
 const record=(title,subtitle,buttons)=>'<div class="cad-master-record"><div class="cad-master-record-main"><strong>'+esc(title)+'</strong><small>'+esc(subtitle)+'</small></div><div class="cad-master-record-actions">'+buttons+'</div></div>';
 const editButton=(kind,id)=>'<button type="button" data-master-edit="'+esc(kind)+'" data-master-id="'+esc(id)+'">Edit</button>';
 list.innerHTML='<section class="cad-master-records"><h4>Agencies ('+data.agencies.length+')</h4>'+
 (data.agencies.map(a=>record(a.name,a.id+' · '+a.model,editButton('agency',a.id))).join('')||'<p>No configured agencies yet.</p>')+'</section>'+
 '<section class="cad-master-records"><h4>Personnel ('+data.personnel.length+')</h4>'+
 (data.personnel.map(p=>record(p.name,p.id+' · '+p.agencyId,editButton('person',p.id))).join('')||'<p>No configured personnel yet.</p>')+'</section>'+
 '<section class="cad-master-records"><h4>Units ('+data.units.length+')</h4>'+
 (data.units.map(u=>record(u.designator,u.agencyId+' · '+u.discipline+' · '+u.model+(u.resourceType?' · '+u.resourceType:''),editButton('unit',u.id)+' <button type="button" data-unit-activate="'+esc(u.id)+'">Activate</button> <button type="button" data-unit-delete="'+esc(u.id)+'">Remove</button>')).join('')||'<p>No configured units yet.</p>')+'</section>';
 el('cadMasterAgencySelect').innerHTML=opts(data.agencies.map(a=>({id:a.id,name:a.name})));
 el('cadMasterPersonnelAgency').innerHTML=opts(data.agencies.map(a=>({id:a.id,name:a.name})));
 el('cadMasterPersonSelect').innerHTML='<option value="">None / assigned at sign-on</option>'+opts(data.personnel.filter(p=>p.agencyId===el('cadMasterAgencySelect').value).map(p=>({id:p.id,name:p.name+' ('+p.id+')'})));
 renderStaff();renderDutyLogOnOptions();refreshTypes();
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
el('cadStaffLogOff')?.addEventListener('click',()=>{
 const unitId=el('cadStaffUnit').value;if(!unitId)return;
 if(!confirm('Log off '+unitId+' from the operational roster? Its master definition will remain available for future activation.'))return;
 const result=window.cadLogOffMasterUnit?.(unitId);
 el('cadStaffMessage').textContent=result?.ok?'Unit '+unitId+' logged off. Master definition retained.':'Logoff rejected: '+(result?.error||'CAD unavailable.');
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
function editRecord(kind,id){
 const collection=kind==='agency'?'agencies':kind==='person'?'personnel':kind==='unit'?'units':null;
 const value=data[collection]?.find(x=>x.id===id);if(!value)return;
 const fields=kind==='agency'?[['name','Agency name'],['model','Identification model']]:
 kind==='person'?[['name','Display name'],['agencyId','Owning agency']]:
 [['designator','Radio designator'],['agencyId','Owning agency'],['discipline','Discipline'],['resourceType','Resource type'],['model','Identification model'],['personId','Associated person'],['minStaffing','Minimum staffing'],['qualifications','Required qualifications']];
 const dialog=document.createElement('dialog');dialog.className='cad-master-dialog';
 const idInput=part=>'<input data-edit-field="'+esc(part)+'" value="'+esc(part==='qualifications'?(value.qualifications||[]).join(', '):value[part]??'')+'">';
 const options=(items,v)=>items.map(x=>'<option value="'+esc(x.value)+'"'+(x.value===v?' selected':'')+'>'+esc(x.label)+'</option>').join('');
 const field=(name,label)=>{
  let control=idInput(name);
  if(name==='model')control='<select data-edit-field="model">'+options(M.MODELS.map(x=>({value:x,label:x})),value.model)+'</select>';
  if(name==='discipline')control='<select data-edit-field="discipline">'+options(M.DISCIPLINES.map(x=>({value:x,label:x})),value.discipline)+'</select>';
  if(name==='agencyId')control='<select data-edit-field="agencyId">'+options(data.agencies.map(x=>({value:x.id,label:x.name})),value.agencyId)+'</select>';
  if(name==='personId')control='<select data-edit-field="personId"><option value="">No person</option>'+options(data.personnel.map(x=>({value:x.id,label:x.name})),value.personId||'')+'</select>';
  return '<label>'+esc(label)+control+'</label>';
 };
 dialog.innerHTML='<h3>Edit '+esc(kind==='agency'?'Agency':kind==='person'?'Personnel':'Unit')+'</h3><p>Internal ID: '+esc(id)+' (unchanged to protect references)</p><form method="dialog">'+fields.map(x=>field(...x)).join('')+'<p data-edit-error role="alert"></p><div class="cad-master-dialog-actions"><button value="cancel">Cancel</button><button class="primary" value="save">Save Changes</button></div></form>';
 document.body.appendChild(dialog);
 dialog.addEventListener('close',()=>{
  if(dialog.returnValue==='save'){
   const updates={};for(const [field] of fields)updates[field]=dialog.querySelector('[data-edit-field="'+field+'"]').value.trim();
   if(kind==='unit'){
    updates.minStaffing=Number(updates.minStaffing);
    updates.qualifications=updates.qualifications.split(',').map(x=>x.trim()).filter(Boolean);
    if(!Number.isInteger(updates.minStaffing)||updates.minStaffing<0||updates.minStaffing>30){message.textContent='Minimum staffing must be 0–30.';dialog.remove();return;}
   }
   const next=structuredClone(data),target=next[collection].find(x=>x.id===id);Object.assign(target,updates);
   if(kind==='agency'&&!updates.name){message.textContent='Agency name required.';dialog.remove();return;}
   if(kind==='agency'&&next.agencies.some(x=>x.id!==id&&x.name.toLowerCase()===updates.name.toLowerCase())){message.textContent='Agency name already exists.';dialog.remove();return;}
   if(kind==='unit'&&!updates.designator){message.textContent='Unit designator required.';dialog.remove();return;}
   if(kind==='unit'&&next.units.some(x=>x.id!==id&&x.agencyId===updates.agencyId&&x.designator.toLowerCase()===updates.designator.toLowerCase())){message.textContent='Duplicate radio designator for that agency.';dialog.remove();return;}
   if(kind==='unit'){
    const active=window.cadMasterActiveUnits?.().find(u=>u.masterUnitId===id);
    if(active&&['designator','agencyId','discipline'].some(k=>updates[k]!==value[k])){message.textContent='Log off '+active.id+' before changing its designator, agency or discipline.';dialog.remove();return;}
   }
   if(kind==='agency'&&updates.name!==value.name){
    const occupied=(window.cadMasterActiveUnits?.()||[]).some(u=>next.units.some(x=>x.id===u.masterUnitId&&x.agencyId===id));
    if(occupied){message.textContent='Log off this agency’s activated units before changing its name.';dialog.remove();return;}
   }
   const previousName=kind==='agency'?value.name:null;
   try{
    M.validate(next);
    if(kind==='agency'&&previousName!==updates.name){
     // Keep agency-scoped resource types attached to the renamed agency.
     const key='smcad-resource-types-v1',original=localStorage.getItem(key),catalog=JSON.parse(original||'[]');
     if(Array.isArray(catalog)){
      localStorage.setItem(key,JSON.stringify(catalog.map(x=>x.agency===previousName?{...x,agency:updates.name}:x)));
      window.dispatchEvent(new Event('cad-resource-types-updated'));
     }
    }
    M.save(localStorage,next);data=next;render();message.textContent='Changes saved. Internal IDs preserved.';
   }catch(error){message.textContent='Changes not saved: '+error.message;}
  }
  dialog.remove();
 });
 dialog.showModal();
}
list.addEventListener('click',async e=>{
 const editKind=e.target?.getAttribute('data-master-edit');if(editKind){editRecord(editKind,e.target.getAttribute('data-master-id'));return;}
 const activateId=e.target?.getAttribute('data-unit-activate');if(activateId){
  message.textContent='Logging unit on duty…';
  try{
   const result=await logOnDuty(activateId);
   message.textContent=result.alreadyOnDuty?'Unit '+result.callSign+' is already on duty.':'Unit '+result.callSign+' logged on duty and available.';
  }catch(error){message.textContent='Log On Duty failed: '+error.message;}
  renderStaff();renderDutyLogOnOptions();return;
 }
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