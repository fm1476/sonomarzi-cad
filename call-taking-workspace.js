/* Call Taking shares the dispatch incident objects and Event Narrative renderer. */
(()=>{
'use strict';
const state=()=>window.cadSafetyState?.()||{incidents:[]};
const $=id=>document.getElementById(id);
const safe=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let selected=null,creating=false,expandAfterRefresh=null,editingEntity=null;
const identity=()=>{let v=(localStorage.getItem('smcad-dispatcher-identity-v1')||'').trim();if(!v){v=(prompt('Call taker ID or initials for narrative attribution:')||'').trim().slice(0,24);if(v)localStorage.setItem('smcad-dispatcher-identity-v1',v)}return v||'Unidentified'};
const field=(label,key,value,kind='text')=>'<label>'+label+'<input name="'+key+'" type="'+kind+'" value="'+safe(value)+'"></label>';
const geoField=()=>'<div class="cad-ct-geo" style="margin:8px 0 14px;padding:12px;border:1px solid #335875;border-radius:10px;background:#102b40"><div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap"><strong>Location validation &amp; response area</strong><button type="button" data-ct-geo-validate style="border:1px solid #64a8df;border-radius:8px;padding:8px 12px;background:#153d5d;color:#eaf6ff;cursor:pointer">Validate location</button></div><div data-ct-geo-result role="status" aria-live="polite" style="margin-top:9px;color:#b9d5e7;font-size:13px">Enter an address, then validate to identify the response area.</div></div>';
const setupGeoValidation=(form,incident)=>{
 const input=form.querySelector('[name="location"]');if(!input)return;
 const holder=document.createElement('div');holder.innerHTML=geoField();const panel=holder.firstElementChild;
 input.closest('label')?.insertAdjacentElement('afterend',panel);
 const status=panel.querySelector('[data-ct-geo-result]'),button=panel.querySelector('[data-ct-geo-validate]');
 window.cadAddressPicker?.(input,()=>incident?.discipline||'LAW',v=>{if(v)form.dataset.cadGeoValidation=JSON.stringify(v);else delete form.dataset.cadGeoValidation});
 const showCurrent=()=>{if(!incident)return;const area=incident.discipline==='LAW'?incident.beat:incident.esz;if(area&&incident.responseZoneLookup&&incident.responseZoneLookup.original===incident.discipline+'|'+input.value.trim())status.textContent='✓ '+(incident.discipline==='LAW'?'Police Beat ':'Fire/EMS ESZ ')+area+' · GIS matched';};
 showCurrent();
 input.addEventListener('input',()=>{delete form.dataset.cadGeoValidation;status.textContent='Address changed. Validate the new location before using a response plan.';status.style.color='#f3c983'});
 button.onclick=async()=>{
  const location=input.value.trim();if(!location){status.textContent='Enter a location first.';return}
  const discipline=incident?.discipline||form.querySelector('[name="discipline"]')?.value||'LAW';
  button.disabled=true;button.textContent='Validating…';status.textContent='Checking address and geographic response boundaries…';
  try{
   const result=await window.CadIncidentZones.lookup(location,discipline);
   if(input.value.trim()!==location){status.textContent='Address changed during validation. Validate again.';return}
   if(!result.ok)throw Error(result.message||'Location could not be verified');
   const required=discipline==='LAW'?'beat':'esz',area=result.zones?.[required];
   if(!area)throw Error('No '+required+' boundary found for this location');
   const confirmed=window.confirm('GIS address: '+result.address+'\\n'+(required==='beat'?'Police Beat ':'Fire/EMS ESZ ')+area+'\\n\\nUse this validated address and response area?');
   if(!confirmed){status.textContent='Location candidate not confirmed. No response area applied.';return}
   status.style.color='#a5e9bd';status.textContent='✓ Validated '+result.address+' · '+(required==='beat'?'Police Beat ':'Fire/EMS ESZ ')+area+'. Save event details to apply.';
   form.dataset.cadGeoValidation=JSON.stringify({location,discipline,result});
  }catch(err){delete form.dataset.cadGeoValidation;status.style.color='#f3a6a6';status.textContent='Needs review: '+err.message}
  finally{button.disabled=false;button.textContent='Validate location'}
 };
};
const extraFields=[['locationNotes','Location notes'],['type','Call for service'],['additionalCfs','Additional CFS'],['origin','Origin'],['dispatchStatus','Dispatch status'],['labels','Labels'],['primaryDisposition','Primary disposition'],['additionalDisposition','Additional disposition'],['closingComments','Closing comments']];
const personFields=[['firstName','First name'],['lastName','Last name'],['middleInitial','M.I.'],['phone','Phone'],['extension','Ext.'],['dob','Date of birth'],['location','Location'],['notes','Notes']];
const vehicleFields=[['plate','Plate #'],['state','State'],['vin','VIN'],['color','Color'],['make','Make'],['model','Model'],['year','Year'],['insurance','Insurance carrier'],['involvement','Involvement type'],['notes','Notes']];
const rowFields=(fields,obj,prefix)=>fields.map(([key,label])=>field(label,prefix+'.'+key,obj?.[key]||'')).join('');
const partyRows=(i,kind,fields)=>((i[kind]||[]).map((p,n)=>{
 const label=kind==='vehicles'?[p.plate,p.state,p.make,p.model].filter(Boolean).join(' · '):[p.firstName,p.middleInitial,p.lastName].filter(Boolean).join(' ');
 const secondary=kind==='vehicles'?[p.color,p.year].filter(Boolean).join(' · '):[p.phone,p.location].filter(Boolean).join(' · ');
 return '<div class="cad-ct-record"><div class="cad-ct-record-title"><div><strong>'+safe(label||(kind==='vehicles'?'New vehicle':'New person')+' '+(n+1))+'</strong><small>'+safe(secondary||(Object.values(p).some(Boolean)?'Details recorded':'Details not entered'))+'</small></div><div class="cad-ct-record-actions"><button type="button" data-ct-edit="'+kind+':'+n+'">Edit</button><button type="button" data-ct-remove="'+kind+':'+n+'">Remove</button></div></div><div class="cad-ct-fields" data-ct-fields="'+kind+':'+n+'" '+(editingEntity===kind+':'+n?'':'hidden')+'>'+rowFields(fields,p,kind+'.'+n)+'</div></div>';
 }).join(''));
const configuredEventFields=i=>{
 const defs=window.cadEventFormFields?.(i.agency);
 if(!Array.isArray(defs))return field('Location *','location',i.location)+field('Priority','priority',i.priority)+field('Case number','caseNumber',i.caseNumber||'')+rowFields(extraFields.filter(([k])=>!['primaryDisposition','additionalDisposition','closingComments'].includes(k)),i,'event');
 const builtins=new Set(['location','priority','caseNumber',...extraFields.map(x=>x[0])]);
 const fields=defs.filter(f=>f.visible!==false&&f.id!=='primaryDisposition'&&f.id!=='additionalDisposition'&&f.id!=='closingComments');
 const existing=new Set(fields.map(f=>f.id));
 for(const id of ['location','priority','type'])if(!existing.has(id))fields.unshift({id,label:id,type:'text'});
 return fields.map(f=>{
  const name=f.custom?'custom.'+f.id:['location','priority','caseNumber'].includes(f.id)?f.id:'event.'+f.id;
  const value=f.custom?i.customFields?.[f.id]:i[f.id];
  const label=escField(f.label||f.id)+(f.required?' *':'');
  const required=f.required?' required':'';
  const control=f.type==='textarea'?'<textarea name="'+name+'"'+required+'>'+escField(value)+'</textarea>':f.type==='select'?'<select name="'+name+'"'+required+'><option value="">Select…</option>'+(f.options||[]).map(o=>'<option value="'+escField(o)+'" '+(o===value?'selected':'')+'>'+escField(o)+'</option>').join('')+'</select>':f.type==='checkbox'?'<input type="checkbox" name="'+name+'" value="true" '+(value?'checked':'')+'>':'<input type="'+(f.type==='date'?'date':'text')+'" name="'+name+'" value="'+escField(value||'')+'"'+required+'>';
  return '<label class="cad-ct-config-field '+(f.width==='full'?'wide':'')+'">'+label+control+'</label>';
 }).join('');
};
const escField=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const callerFields=i=>{
 const full=String(i.caller||'').trim().split(/\s+/),first=i.callerFirstName!==undefined?i.callerFirstName:full.length===2?full[0]:i.caller||'',last=i.callerLastName!==undefined?i.callerLastName:full.length===2?full[1]:'';
 return '<details class="cad-ct-section"><summary>Caller Information</summary><div class="cad-ct-fields">'+
 field('First name','callerFirstName',first)+field('Last name','callerLastName',last)+
 '<label>Phone<input type="tel" name="callerPhone" autocomplete="tel" placeholder="(707) 555-1212 or +44…" value="'+safe(i.phone||'')+'"></label>'+
 '<label class="wide">Caller location<input name="callerLocation" autocomplete="off" value="'+safe(i.callerLocation||'')+'"></label>'+
 '<label class="wide" style="display:flex;align-items:center;gap:8px"><input type="checkbox" name="callerSameAsEvent" '+(i.callerSameAsEvent?'checked':'')+'>Caller is at the same location as the event</label>'+
 '</div></details>';
};
const extraEditor=i=>'<details class="cad-ct-section" open><summary>Event Information</summary><div class="cad-ct-fields">'+configuredEventFields(i)+'</div></details>'+callerFields(i)+
'<details class="cad-ct-section"><summary>Reporting Parties ('+(i.reportingParties||[]).length+')</summary>'+partyRows(i,'reportingParties',personFields)+'<button type="button" data-ct-add="reportingParties">+ Add Reporting Party</button></details>'+
'<details class="cad-ct-section"><summary>Involved Persons ('+(i.involvedPersons||[]).length+')</summary>'+partyRows(i,'involvedPersons',personFields)+'<button type="button" data-ct-add="involvedPersons">+ Add Involved Person</button></details>'+
'<details class="cad-ct-section"><summary>Vehicles ('+(i.vehicles||[]).length+')</summary>'+partyRows(i,'vehicles',vehicleFields)+'<button type="button" data-ct-add="vehicles">+ Add Vehicle</button></details>'+
'<details class="cad-ct-section"><summary>Event Closure</summary><div class="cad-ct-fields"><label>Primary disposition<select id="cadCTDisposition" required><option value="">Select disposition</option>'+[...document.querySelectorAll('#cadDispoOptions option')].map(o=>'<option value="'+safe(o.value)+'">'+safe(o.value)+'</option>').join('')+'</select></label>'+rowFields(extraFields.filter(x=>['additionalDisposition','closingComments'].includes(x[0])),i,'closure')+'</div><button type="button" id="cadCTClearEvent" class="cad-ct-danger">Save & Clear Event</button></details>';
function refresh(){
 const previousOpen=[...($('cadCTEditor')?.querySelectorAll('.cad-ct-section')||[])].map((d,n)=>d.open?n:-1).filter(n=>n>=0);
 const incidents=(state().incidents||[]).filter(i=>['PENDING','ACTIVE'].includes(i.status)),filter=$('cadCTFilter')?.value||'ALL';
 const agency=$('cadCTAgency'),agencies=[...new Set(incidents.map(i=>i.agency).filter(Boolean))].sort(),previousAgency=agency.value;
 agency.innerHTML='<option value="ALL">All agencies</option>'+agencies.map(a=>'<option value="'+safe(a)+'">'+safe(a)+'</option>').join('');agency.value=agencies.includes(previousAgency)?previousAgency:'ALL';
 const discipline=$('cadCTDiscipline').value,priority=$('cadCTPriority').value,sort=$('cadCTSort').value;
 const shown=incidents.filter(i=>(filter==='ALL'||i.status===filter)&&(agency.value==='ALL'||i.agency===agency.value)&&(discipline==='ALL'||i.discipline===discipline)&&(priority==='ALL'||i.priority===priority)).sort((a,b)=>sort==='agency'?String(a.agency).localeCompare(String(b.agency)):sort==='priority'?String(a.priority).localeCompare(String(b.priority)):sort==='oldest'?String(a.id).localeCompare(String(b.id)):String(b.id).localeCompare(String(a.id)));
 $('cadCTCount').textContent='('+incidents.length+')';
 $('cadCTQueue').innerHTML=shown.map(i=>'<button type="button" class="cad-ct-item '+(selected===i.id?'selected':'')+'" data-ct-id="'+safe(i.id)+'"><span class="cad-ct-id">'+safe(i.id)+'</span><span class="cad-ct-type">'+safe(i.type)+'</span><span class="cad-ct-place">'+safe(i.location)+'</span><span class="cad-ct-agency">'+safe(i.agency)+'</span><span class="cad-ct-status '+safe(i.status.toLowerCase())+'">'+safe(i.status)+'</span></button>').join('')||'<p class="cad-ct-empty">No matching open calls.</p>';
 if(!incidents.length){
 const health=window.cadDemoDataHealth?.()||{};
 const message=document.createElement('div');message.className='cad-ct-recovery';
 message.innerHTML='<p>'+((health.incidentCount||0)>0?'There are incident records, but none are currently Pending or Active.':'No incidents are stored in this browser profile.')+'</p><button type="button" id="cadCTRestoreDemo">Restore missing sample calls (keep existing data)</button>';
 $('cadCTQueue').append(message);
 message.querySelector('button').onclick=()=>{const count=window.cadRestoreMissingDemoCalls?.()||0;refresh();alert(count?count+' missing sample calls restored. Existing records preserved.':'All original sample call IDs are already present. No records changed.')};
}
 $('cadCTQueue').querySelectorAll('[data-ct-id]').forEach(b=>b.onclick=()=>{selected=b.dataset.ctId;creating=false;refresh()});
 const i=incidents.find(x=>x.id===selected),editor=$('cadCTEditor');const newForm=$('cadCTNewForm');newForm.hidden=!creating; if(!i||creating){editor.hidden=true;$('cadCTEmpty').hidden=creating||!!i;return}
 editor.hidden=false;$('cadCTEmpty').hidden=true;
 editor.innerHTML='<div class="cad-ct-heading"><div><h2>'+safe(i.id)+' · '+safe(i.type)+'</h2><p>'+safe(i.agency)+' · '+safe(i.status)+' · '+safe(i.discipline)+'</p></div><div class="cad-ct-toolbar">'+(i.status==='PENDING'?'<button type="button" id="cadCTActivate" class="primary">Activate Call</button>':'')+'<button type="button" id="cadCTClose">Close editor</button></div></div>'+
 '<div class="cad-ct-event-body"><div class="cad-ct-event-info"><form id="cadCTForm">'+extraEditor(i)+'<div class="cad-ct-savebar"><button type="submit" class="primary">Save event details</button><span id="cadCTSaveStatus" role="status">Changes save when you select Save</span></div></form></div><div class="cad-ct-event-narrative">'+
 '<div class="cad-ct-narrative-header"><h3>Event Narrative</h3></div><form id="cadCTNoteForm" class="cad-ct-note-form"><label for="cadCTNoteInput">New narrative information</label><textarea id="cadCTNoteInput" rows="3" placeholder="Enter new caller information, observations, or updates..."></textarea><button type="submit" class="primary">Add to Event Narrative</button></form><div id="cadCTNarrative">'+(window.voiceDetailHtml?window.voiceDetailHtml(i):'<p>Narrative unavailable</p>')+'</div>';
 editor.querySelectorAll('.cad-ct-section').forEach((d,n)=>{d.open=expandAfterRefresh!==null?n===expandAfterRefresh:previousOpen.length?previousOpen.includes(n):n===0});expandAfterRefresh=null;
 $('cadCTClose').onclick=()=>{selected=null;refresh()};
 $('cadCTActivate')?.addEventListener('click',()=>{if(window.cadSharedIsActive?.()){window.alert('Manual activation requires a shared CAD transaction. No changes made.');return;}if(i.status!=='PENDING')return;i.status='ACTIVE';window.cadCallTakeEvent?.(i,'CALL_ACTIVATED_FROM_CALL_TAKING');window.cadCallTakeSave?.()});
 setupGeoValidation($('cadCTForm'),i);
 const callerAddress=$('cadCTForm').querySelector('[name="callerLocation"]'),same=$('cadCTForm').querySelector('[name="callerSameAsEvent"]'),eventAddress=$('cadCTForm').querySelector('[name="location"]');
 let callerVerified=null;
 window.cadAddressPicker?.(callerAddress,()=>i.discipline,v=>{callerVerified=v});
 const syncCaller=()=>{callerAddress.readOnly=same.checked;if(same.checked){callerAddress.value=eventAddress?.value||i.location;callerVerified=null}callerAddress.style.opacity=same.checked?'.75':'1'};
 same.addEventListener('change',syncCaller);eventAddress?.addEventListener('input',()=>{if(same.checked)syncCaller()});syncCaller();
 const phoneInput=$('cadCTForm').querySelector('[name="callerPhone"]');
 phoneInput.addEventListener('blur',()=>{const v=window.cadPhoneNormalize?.(phoneInput.value);if(v?.ok)phoneInput.value=v.formatted});

 const sharedOriginalForm=new Map(new FormData($('cadCTForm')).entries());
 $('cadCTForm').onsubmit=async e=>{e.preventDefault();
 if(window.cadSharedIsActive?.()){
  const status=$('cadCTSaveStatus');
  const f=new FormData(e.currentTarget);
  const newLocation=String(f.get('location')??i.location).trim();
  const newPriority=String(f.get('priority')??i.priority).trim();
  const newCaseNumber=String(f.get('caseNumber')??i.caseNumber??'').trim();
  const newType=String(f.get('event.type')??f.get('type')??i.type).trim();
  const values={type:newType,priority:newPriority,location:newLocation,caseNumber:newCaseNumber,source:'CALL_TAKING'};
  const tracked=new Set(['location','priority','caseNumber','type','event.type']);
  const unsupported=Array.from(new Set([...sharedOriginalForm.keys(),...Array.from(f.keys())])).filter(key=>!tracked.has(key)&&String(f.get(key)??'')!==String(sharedOriginalForm.get(key)??''));
  if(unsupported.length){
   status.textContent='Not saved: '+unsupported.join(', ')+' cannot yet be updated through shared CAD. No fields were saved.';
   return;
  }
  if(!newLocation||!newPriority||!newType){status.textContent='CFS type, location and priority are required.';return}
  const updated=values.type!==i.type||values.location!==i.location||values.priority!==i.priority||values.caseNumber!==(i.caseNumber||'');
  if(!updated){status.textContent='No supported shared changes to save';return}
  const button=e.currentTarget.querySelector('[type="submit"]');if(button)button.disabled=true;
  status.textContent='Saving to shared CAD…';
  try{
   await window.cadSharedCommand('edit',{incidentId:i.id,...values});
   const current=window.cadSafetyState?.().incidents?.find(x=>x.sharedUuid===i.sharedUuid);
   if(!current||current.type!==values.type||current.location!==values.location||current.priority!==values.priority||(current.caseNumber||'')!==values.caseNumber)
    throw Error('Database did not confirm the requested changes');
   status.textContent='Saved to shared CAD ✓';refresh();
  }catch(error){status.textContent='Save failed: '+error.message}
  finally{if(button)button.disabled=false}
  return;
 }
 const f=new FormData(e.currentTarget);let changes=[];
 const checkedPhone=window.cadPhoneNormalize?.(f.get('callerPhone')||'');
 if(checkedPhone&&!checkedPhone.ok){$('cadCTSaveStatus').textContent=checkedPhone.message;phoneInput.focus();return}
 const first=String(f.get('callerFirstName')||''),last=String(f.get('callerLastName')||'');
 const callerAddressValue=same.checked?String(eventAddress?.value||i.location):String(f.get('callerLocation')||'');
 const callerChanged=first.trim()!==String(i.callerFirstName??'').trim()||last.trim()!==String(i.callerLastName??'').trim()||callerAddressValue.trim()!==String(i.callerLocation||'').trim()||same.checked!==!!i.callerSameAsEvent;
 if(callerChanged){const result=window.cadSaveCaller?.(i.id,first,last,callerAddressValue,same.checked,callerVerified?.result||null);if(result?.ok)changes.push('callerInformation')}
 if(checkedPhone&&checkedPhone.formatted!==String(i.phone||'')){window.cadUpdateIncidentFields?.(i.id,{phone:checkedPhone.formatted},'CALL_TAKING');i.callerPhoneCanonical=checkedPhone.canonical;changes.push('callerPhone')}
for(const key of ['location','priority','caseNumber']){if(!f.has(key))continue;const value=String(f.get(key)||'').trim();if(value!==String(i[key]||'')){if(key==='location'){window.cadUpdateIncidentLocation?.(i.id,value,'CALL_TAKING',null)}else{i[key]=value}changes.push(key)}}
const layout=window.cadEventFormFields?.(i.agency);
if(Array.isArray(layout)){for(const def of layout){if(!def.custom)continue;const value=def.type==='checkbox'?f.has('custom.'+def.id):String(f.get('custom.'+def.id)||'').trim();(i.customFields||={});if(value!==i.customFields[def.id]){i.customFields[def.id]=value;changes.push('custom.'+def.id)}}}
for(const [key] of extraFields){const name=(['primaryDisposition','additionalDisposition','closingComments'].includes(key)?'closure.':'event.')+key;if(!f.has(name))continue;const value=String(f.get(name)||'').trim();if(value!==String(i[key]||'')){i[key]=value;changes.push(key)}}
for(const kind of ['reportingParties','involvedPersons','vehicles']){const fields=kind==='vehicles'?vehicleFields:personFields;for(let n=0;n<(i[kind]||[]).length;n++)for(const [key] of fields){const value=String(f.get(kind+'.'+n+'.'+key)||'').trim();if(value!==String(i[kind][n][key]||'')){i[kind][n][key]=value;changes.push(kind+'.'+key)}}}if(changes.includes('location')||e.currentTarget.dataset.cadGeoValidation){const validated=(()=>{try{return JSON.parse(e.currentTarget.dataset.cadGeoValidation||'null')}catch{return null}})();i.esz=null;i.beat=null;i.responseZone=null;i.responseZoneReviewed=false;i.responseZoneLookup=null;i.responseZoneSource=null;i.responseZoneError=null;if(validated&&validated.location===i.location&&validated.discipline===i.discipline){const r=validated.result;i.esz=r.zones.esz||null;i.beat=r.zones.beat||null;i.responseZone=i.discipline==='LAW'?i.beat:i.esz;i.responseZoneSource='GIS_POINT_LOOKUP';i.responseZoneReviewed=true;i.responseZoneLookup={address:r.address,lat:r.lat,lon:r.lon,at:new Date().toISOString(),original:i.discipline+'|'+i.location,source:r.source};window.cadCallTakeEvent?.(i,'LOCATION_VALIDATED_RESPONSE_AREA '+i.responseZone)}}if(changes.length){editingEntity=null;i.callTakeNewInfoAt=new Date().toISOString();i.callTakeUpdateFields=changes;window.cadCallTakeEvent?.(i,'CALL_TAKER_UPDATED '+changes.join(','));window.cadCallTakeSave?.();const status=$('cadCTSaveStatus');if(status)status.textContent='Saved ✓'}else{$('cadCTSaveStatus').textContent='No changes to save'}};
 editor.querySelectorAll('[data-ct-add]').forEach(b=>b.onclick=()=>{if(window.cadSharedIsActive?.()){window.alert('Shared CAD cannot yet save added reporting parties, people or vehicles. No changes made.');return;}const kind=b.dataset.ctAdd;editingEntity=kind+':'+((i[kind]||[]).length);expandAfterRefresh={reportingParties:1,involvedPersons:2,vehicles:3}[kind];(i[kind]||=[]).push({});window.cadCallTakeSave?.();});
 editor.querySelectorAll('[data-ct-edit]').forEach(b=>b.onclick=()=>{editingEntity=b.dataset.ctEdit;expandAfterRefresh={reportingParties:1,involvedPersons:2,vehicles:3}[editingEntity.split(':')[0]];refresh();editor.querySelector('[data-ct-fields="'+editingEntity+'"] input')?.focus()});
 editor.querySelectorAll('[data-ct-remove]').forEach(b=>b.onclick=()=>{if(window.cadSharedIsActive?.()){window.alert('Shared CAD cannot yet save removal of reporting parties, people or vehicles. No changes made.');return;}const [kind,index]=b.dataset.ctRemove.split(':');expandAfterRefresh={reportingParties:1,involvedPersons:2,vehicles:3}[kind];i[kind]?.splice(Number(index),1);editingEntity=null;window.cadCallTakeSave?.()});
 $('cadCTForm').addEventListener('input',()=>{const status=$('cadCTSaveStatus');if(status)status.textContent='Unsaved changes'});
 $('cadCTForm').addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.matches('input')&&!e.isComposing){e.preventDefault();e.currentTarget.requestSubmit()}});
 $('cadCTClearEvent')?.addEventListener('click',()=>{if(window.cadSharedIsActive?.()){window.alert('Clear shared incidents through the dispatcher shared Close Event action. No local change made.');return;}const disposition=$('cadCTDisposition')?.value;if(!disposition){$('cadCTDisposition')?.focus();return;}const form=$('cadCTForm');form.requestSubmit();const result=window.cadCloseEvent?.(i,disposition,'CALL_TAKING');if(result?.ok){selected=null;refresh()}else alert(result?.message||'Unable to clear event')});
 $('cadCTNoteForm').onsubmit=async e=>{e.preventDefault();const input=$('cadCTNoteInput'),text=input.value.trim();if(!text)return;
  if(window.cadSharedIsActive?.()){
   const button=e.currentTarget.querySelector('button[type="submit"]');if(button)button.disabled=true;
   try{await window.cadSharedCommand('note',{incidentId:i.id,text});input.value='';refresh();}
   catch(error){window.alert('Narrative not saved: '+error.message)}
   finally{if(button)button.disabled=false}
   return;
  }const author=identity(),timestamp=new Date().toISOString();(i.narrative||=[]).push(text);(i.manualNarrativeEntries||=[]).push({id:'calltake-'+Date.now(),text,timestamp,author});i.callTakeNewInfoAt=timestamp;i.callTakeUpdateFields=['narrative'];window.cadCallTakeEvent?.(i,'NARRATIVE_ADDED '+timestamp+' BY '+author);input.value='';window.cadCallTakeSave?.();requestAnimationFrame(()=>document.getElementById('cadCTNoteInput')?.focus())};
 $('cadCTNoteInput').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();if(e.repeat)return;$('cadCTNoteForm').requestSubmit()}});
 // Reuse the same transcript navigation and chronological sort controls as Dispatch.
 const narrative=$('cadCTNarrative');
 narrative.querySelectorAll('[data-voice-tab]').forEach(b=>b.onclick=()=>{const tab=b.dataset.voiceTab; narrative.querySelectorAll('[data-voice-tab]').forEach(x=>x.classList.toggle('active',x===b)); const content=narrative.querySelector('.voice-detail-content'); if(!content)return; if(tab==='narrative'){const tmp=document.createElement('div');tmp.innerHTML=window.voiceDetailHtml?.(i)||'';content.innerHTML=tmp.querySelector('.voice-detail-content')?.innerHTML||'No narrative entries';}else{content.innerHTML=(i.radioTranscripts||[]).map(r=>'<div class="voice-entry"><div class="meta">'+safe(r.time)+' | '+safe(r.source)+'</div>'+safe(r.text)+'</div>').join('')||'No transcripts';}});
 narrative.querySelector('#voiceEntryOrder')?.addEventListener('change',e=>{window.cadVoiceSetOrder?.(e.target.value);refresh()});
 narrative.querySelectorAll('[data-transcript-ref]').forEach(b=>b.onclick=()=>{const record=(i.radioTranscripts||[]).find(r=>r.id===b.dataset.transcriptRef);if(record){const body=narrative.querySelector('.voice-detail-content');body.innerHTML='<div class="voice-entry"><div class="meta">'+safe(record.time)+' | '+safe(record.source)+'</div>'+safe(record.text)+'</div>'}});
}
window.cadCallTakeRefresh=refresh;
window.cadCallTakeSelect=id=>{selected=id;creating=false;refresh()};
['cadCTFilter','cadCTAgency','cadCTDiscipline','cadCTPriority','cadCTSort'].forEach(id=>$(id)?.addEventListener('change',refresh));
const newForm=$('cadCTNewForm');document.querySelector('#calltake .cad-ct-right')?.prepend(newForm);
$('cadCTNew').onclick=()=>{selected=null;creating=true;refresh();$('agency')?.focus()};
$('createCall')?.addEventListener('click',()=>{creating=false;selected=null;refresh()});
newForm.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.matches('input')&&!e.isComposing){e.preventDefault();$('createCall')?.click()}});

const split=$('cadCTSplit'),divider=$('cadCTDivider');let dragging=false;
const applyWidth=percent=>{const width=Math.min(75,Math.max(25,percent));split.style.setProperty('--cad-ct-left-width',width+'%');localStorage.setItem('smcad-calltake-split-v1',String(width))};
applyWidth(Number(localStorage.getItem('smcad-calltake-split-v1'))||48);
divider?.addEventListener('pointerdown',e=>{if(e.button!==0||window.matchMedia('(max-width: 850px)').matches)return;dragging=true;divider.setPointerCapture(e.pointerId);e.preventDefault()});
divider?.addEventListener('pointermove',e=>{if(!dragging)return;const rect=split.getBoundingClientRect();applyWidth((e.clientX-rect.left)/rect.width*100)});
divider?.addEventListener('pointerup',()=>dragging=false);
divider?.addEventListener('pointercancel',()=>dragging=false);
divider?.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();applyWidth((Number(localStorage.getItem('smcad-calltake-split-v1'))||48)+(e.key==='ArrowLeft'?-3:3))}});
// Full-height panels with an entire bottom-edge drag target. Persist only user drags.
const sizeKey='smcad-calltake-panel-heights-v2';
const queuePanel=document.querySelector('#calltake .cad-calltake-queue');
const editorPanel=$('cadCTEditor');
const newCallPanel=$('cadCTNewForm');
const rightPanel=document.querySelector('#calltake .cad-ct-right');
let savedHeights={};try{savedHeights=JSON.parse(localStorage.getItem(sizeKey)||'{}')}catch{}
const defaultHeight=()=>Math.max(550,window.innerHeight-95);
function applyHeight(el,key){
 if(!el)return;
 const height=Number(savedHeights[key]);
 el.style.height=(Number.isFinite(height)&&height>=350?height:defaultHeight())+'px';
}
function installBottomHandle(el,key){
 if(!el)return;
 const handle=document.createElement('div');
 handle.className='cad-ct-bottom-handle';
 handle.title='Drag anywhere on this bar to resize height';
 handle.setAttribute('role','separator');
 handle.setAttribute('aria-orientation','horizontal');
 handle.setAttribute('aria-label','Resize '+key+' height');
 handle.tabIndex=0;
 el.appendChild(handle);
 let startY=0,startHeight=0,active=false;
 handle.addEventListener('pointerdown',e=>{
  if(e.button!==0)return;
  active=true;startY=e.clientY;startHeight=el.getBoundingClientRect().height;
  handle.setPointerCapture(e.pointerId);e.preventDefault();
 });
 handle.addEventListener('pointermove',e=>{
  if(!active)return;
  el.style.height=Math.max(350,Math.min(2400,startHeight+e.clientY-startY))+'px';
 });
 const finish=()=>{if(!active)return;active=false;savedHeights[key]=Math.round(el.getBoundingClientRect().height);localStorage.setItem(sizeKey,JSON.stringify(savedHeights))};
 handle.addEventListener('pointerup',finish);
 handle.addEventListener('pointercancel',finish);
 handle.addEventListener('keydown',e=>{
  if(!['ArrowUp','ArrowDown'].includes(e.key))return;
  e.preventDefault();
  const height=Math.max(350,el.getBoundingClientRect().height+(e.key==='ArrowDown'?40:-40));
  el.style.height=height+'px';savedHeights[key]=height;localStorage.setItem(sizeKey,JSON.stringify(savedHeights));
 });
}
installBottomHandle(queuePanel,'queue');
installBottomHandle(editorPanel,'editor');
installBottomHandle(newCallPanel,'newCall');
function applyPanelHeights(){
 applyHeight(queuePanel,'queue');
 applyHeight(editorPanel,'editor');
 applyHeight(newCallPanel,'newCall');
 if(rightPanel)rightPanel.style.minHeight=defaultHeight()+'px';
}
applyPanelHeights();
window.addEventListener('resize',()=>{if(!savedHeights.queue)applyHeight(queuePanel,'queue');if(!savedHeights.editor)applyHeight(editorPanel,'editor');if(!savedHeights.newCall)applyHeight(newCallPanel,'newCall')});
setTimeout(refresh,200);
})();
