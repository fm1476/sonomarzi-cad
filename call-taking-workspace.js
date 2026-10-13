/* Call Taking shares the dispatch incident objects and Event Narrative renderer. */
(()=>{
'use strict';
const state=()=>window.cadSafetyState?.()||{incidents:[]};
const $=id=>document.getElementById(id);
const safe=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let selected=null,creating=false,expandAfterRefresh=null;
const identity=()=>{let v=(localStorage.getItem('smcad-dispatcher-identity-v1')||'').trim();if(!v){v=(prompt('Call taker ID or initials for narrative attribution:')||'').trim().slice(0,24);if(v)localStorage.setItem('smcad-dispatcher-identity-v1',v)}return v||'Unidentified'};
const field=(label,key,value,kind='text')=>'<label>'+label+'<input name="'+key+'" type="'+kind+'" value="'+safe(value)+'"></label>';
const extraFields=[['locationNotes','Location notes'],['type','Call for service'],['additionalCfs','Additional CFS'],['origin','Origin'],['dispatchStatus','Dispatch status'],['labels','Labels'],['primaryDisposition','Primary disposition'],['additionalDisposition','Additional disposition'],['closingComments','Closing comments']];
const personFields=[['firstName','First name'],['lastName','Last name'],['middleInitial','M.I.'],['phone','Phone'],['extension','Ext.'],['dob','Date of birth'],['location','Location'],['notes','Notes']];
const vehicleFields=[['plate','Plate #'],['state','State'],['vin','VIN'],['color','Color'],['make','Make'],['model','Model'],['year','Year'],['insurance','Insurance carrier'],['involvement','Involvement type'],['notes','Notes']];
const rowFields=(fields,obj,prefix)=>fields.map(([key,label])=>field(label,prefix+'.'+key,obj?.[key]||'')).join('');
const partyRows=(i,kind,fields)=>((i[kind]||[]).map((p,n)=>'<div class="cad-ct-record"><div class="cad-ct-record-title">'+(kind==='vehicles'?'Vehicle ':'Person ')+(n+1)+' <button type="button" data-ct-remove="'+kind+':'+n+'">Remove</button></div><div class="cad-ct-fields">'+rowFields(fields,p,kind+'.'+n)+'</div></div>').join(''));
const extraEditor=i=>'<details class="cad-ct-section" open><summary>Event Information</summary><div class="cad-ct-fields">'+field('Location *','location',i.location)+field('Priority','priority',i.priority)+field('Case number','caseNumber',i.caseNumber||'')+rowFields(extraFields,i,'event')+'</div></details>'+
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
 '<form id="cadCTForm">'+extraEditor(i)+'<button type="submit" class="primary">Save event details</button></form>'+
 '<div class="cad-ct-narrative-header"><h3>Event Narrative</h3></div><form id="cadCTNoteForm" class="cad-ct-note-form"><label for="cadCTNoteInput">New narrative information</label><textarea id="cadCTNoteInput" rows="3" placeholder="Enter new caller information, observations, or updates..."></textarea><button type="submit" class="primary">Add to Event Narrative</button></form><div id="cadCTNarrative">'+(window.voiceDetailHtml?window.voiceDetailHtml(i):'<p>Narrative unavailable</p>')+'</div>';
 editor.querySelectorAll('.cad-ct-section').forEach((d,n)=>{d.open=expandAfterRefresh!==null?n===expandAfterRefresh:previousOpen.length?previousOpen.includes(n):n===0});expandAfterRefresh=null;
 $('cadCTClose').onclick=()=>{selected=null;refresh()};
 $('cadCTActivate')?.addEventListener('click',()=>{if(i.status!=='PENDING')return;i.status='ACTIVE';window.cadCallTakeEvent?.(i,'CALL_ACTIVATED_FROM_CALL_TAKING');window.cadCallTakeSave?.()});
 $('cadCTForm').onsubmit=e=>{e.preventDefault();const f=new FormData(e.currentTarget);let changes=[];for(const key of ['location','priority','caseNumber']){const value=String(f.get(key)||'').trim();if(value!==String(i[key]||'')){i[key]=value;changes.push(key)}}
for(const [key] of extraFields){const value=String(f.get((['primaryDisposition','additionalDisposition','closingComments'].includes(key)?'closure.':'event.')+key)||'').trim();if(value!==String(i[key]||'')){i[key]=value;changes.push(key)}}
for(const kind of ['reportingParties','involvedPersons','vehicles']){const fields=kind==='vehicles'?vehicleFields:personFields;for(let n=0;n<(i[kind]||[]).length;n++)for(const [key] of fields){const value=String(f.get(kind+'.'+n+'.'+key)||'').trim();if(value!==String(i[kind][n][key]||'')){i[kind][n][key]=value;changes.push(kind+'.'+key)}}}if(changes.length){i.callTakeNewInfoAt=new Date().toISOString();i.callTakeUpdateFields=changes;window.cadCallTakeEvent?.(i,'CALL_TAKER_UPDATED '+changes.join(','));window.cadCallTakeSave?.()}};
 editor.querySelectorAll('[data-ct-add]').forEach(b=>b.onclick=()=>{const kind=b.dataset.ctAdd;expandAfterRefresh={reportingParties:1,involvedPersons:2,vehicles:3}[kind];(i[kind]||=[]).push({});window.cadCallTakeSave?.();});
 editor.querySelectorAll('[data-ct-remove]').forEach(b=>b.onclick=()=>{const [kind,index]=b.dataset.ctRemove.split(':');expandAfterRefresh={reportingParties:1,involvedPersons:2,vehicles:3}[kind];i[kind]?.splice(Number(index),1);window.cadCallTakeSave?.()});
 $('cadCTForm').addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.matches('input')&&!e.isComposing){e.preventDefault();e.currentTarget.requestSubmit()}});
 $('cadCTClearEvent')?.addEventListener('click',()=>{const disposition=$('cadCTDisposition')?.value;if(!disposition){$('cadCTDisposition')?.focus();return;}const form=$('cadCTForm');form.requestSubmit();const result=window.cadCloseEvent?.(i,disposition,'CALL_TAKING');if(result?.ok){selected=null;refresh()}else alert(result?.message||'Unable to clear event')});
 $('cadCTNoteForm').onsubmit=e=>{e.preventDefault();const input=$('cadCTNoteInput'),text=input.value.trim();if(!text)return;const author=identity(),timestamp=new Date().toISOString();(i.narrative||=[]).push(text);(i.manualNarrativeEntries||=[]).push({id:'calltake-'+Date.now(),text,timestamp,author});i.callTakeNewInfoAt=timestamp;i.callTakeUpdateFields=['narrative'];window.cadCallTakeEvent?.(i,'NARRATIVE_ADDED '+timestamp+' BY '+author);input.value='';window.cadCallTakeSave?.()};
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
setTimeout(refresh,200);
})();
