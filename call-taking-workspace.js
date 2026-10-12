/* Call Taking shares the dispatch incident objects and Event Narrative renderer. */
(()=>{
'use strict';
const state=()=>window.cadSafetyState?.()||{incidents:[]};
const $=id=>document.getElementById(id);
const safe=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let selected=null;
const identity=()=>{let v=(localStorage.getItem('smcad-dispatcher-identity-v1')||'').trim();if(!v){v=(prompt('Call taker ID or initials for narrative attribution:')||'').trim().slice(0,24);if(v)localStorage.setItem('smcad-dispatcher-identity-v1',v)}return v||'Unidentified'};
const field=(label,key,value,kind='text')=>'<label>'+label+'<input name="'+key+'" type="'+kind+'" value="'+safe(value)+'"></label>';
function refresh(){
 const incidents=(state().incidents||[]).filter(i=>['PENDING','ACTIVE'].includes(i.status)),filter=$('cadCTFilter')?.value||'ALL';
 const shown=incidents.filter(i=>filter==='ALL'||i.status===filter);
 $('cadCTCount').textContent='('+incidents.length+')';
 $('cadCTQueue').innerHTML=shown.map(i=>'<button type="button" class="cad-ct-item '+(selected===i.id?'selected':'')+'" data-ct-id="'+safe(i.id)+'"><span class="cad-ct-id">'+safe(i.id)+'</span><span class="cad-ct-type">'+safe(i.type)+'</span><span class="cad-ct-place">'+safe(i.location)+'</span><span class="cad-ct-agency">'+safe(i.agency)+'</span><span class="cad-ct-status '+safe(i.status.toLowerCase())+'">'+safe(i.status)+'</span></button>').join('')||'<p class="cad-ct-empty">No matching open calls.</p>';
 $('cadCTQueue').querySelectorAll('[data-ct-id]').forEach(b=>b.onclick=()=>{selected=b.dataset.ctId;refresh()});
 const i=incidents.find(x=>x.id===selected),editor=$('cadCTEditor');if(!i){editor.hidden=true;return}
 editor.hidden=false;
 editor.innerHTML='<div class="cad-ct-heading"><div><h2>'+safe(i.id)+' · '+safe(i.type)+'</h2><p>'+safe(i.agency)+' · '+safe(i.status)+' · '+safe(i.discipline)+'</p></div><div class="cad-ct-toolbar">'+(i.status==='PENDING'?'<button type="button" id="cadCTActivate" class="primary">Activate Call</button>':'')+'<button type="button" id="cadCTClose">Close editor</button></div></div>'+
 '<form id="cadCTForm"><div class="cad-ct-fields">'+field('Location','location',i.location)+field('Caller','caller',i.caller)+field('Phone','phone',i.phone)+field('Priority','priority',i.priority)+field('Case number','caseNumber',i.caseNumber||'')+'</div><button type="submit" class="primary">Save call details</button></form>'+
 '<div class="cad-ct-narrative-header"><h3>Event Narrative</h3></div><form id="cadCTNoteForm" class="cad-ct-note-form"><label for="cadCTNoteInput">New narrative information</label><textarea id="cadCTNoteInput" rows="3" placeholder="Enter new caller information, observations, or updates..."></textarea><button type="submit" class="primary">Add to Event Narrative</button></form><div id="cadCTNarrative">'+(window.voiceDetailHtml?window.voiceDetailHtml(i):'<p>Narrative unavailable</p>')+'</div>';
 $('cadCTClose').onclick=()=>{selected=null;refresh()};
 $('cadCTActivate')?.addEventListener('click',()=>{if(i.status!=='PENDING')return;i.status='ACTIVE';window.cadCallTakeEvent?.(i,'CALL_ACTIVATED_FROM_CALL_TAKING');window.cadCallTakeSave?.()});
 $('cadCTForm').onsubmit=e=>{e.preventDefault();const f=new FormData(e.currentTarget);let changes=[];for(const key of ['location','caller','phone','priority','caseNumber']){const value=String(f.get(key)||'').trim();if(value!==String(i[key]||'')){i[key]=value;changes.push(key)}}if(changes.length){i.callTakeNewInfoAt=new Date().toISOString();i.callTakeUpdateFields=changes;window.cadCallTakeEvent?.(i,'CALL_TAKER_UPDATED '+changes.join(','));window.cadCallTakeSave?.()}};
 $('cadCTNoteForm').onsubmit=e=>{e.preventDefault();const input=$('cadCTNoteInput'),text=input.value.trim();if(!text)return;const author=identity(),timestamp=new Date().toISOString();(i.narrative||=[]).push(text);(i.manualNarrativeEntries||=[]).push({id:'calltake-'+Date.now(),text,timestamp,author});i.callTakeNewInfoAt=timestamp;i.callTakeUpdateFields=['narrative'];window.cadCallTakeEvent?.(i,'NARRATIVE_ADDED '+timestamp+' BY '+author);input.value='';window.cadCallTakeSave?.()};
 // Reuse the same transcript navigation and chronological sort controls as Dispatch.
 const narrative=$('cadCTNarrative');
 narrative.querySelectorAll('[data-voice-tab]').forEach(b=>b.onclick=()=>{b.closest('.voice-tabs')?.querySelectorAll('[data-voice-tab]').forEach(x=>x.classList.toggle('active',x===b));const showNarrative=b.dataset.voiceTab==='narrative';narrative.querySelector('.voice-detail-content').innerHTML=showNarrative?window.cadCallTakeNarrativeHtml?.(i)||'Select Dispatch to view full narrative':(i.radioTranscripts||[]).map(r=>'<div class="voice-entry"><div class="meta">'+safe(r.time)+' | '+safe(r.source)+'</div>'+safe(r.text)+'</div>').join('')});
 narrative.querySelector('#voiceEntryOrder')?.addEventListener('change',e=>{localStorage.setItem('smcad-voice-order-v17.3',e.target.value);refresh()});
 narrative.querySelectorAll('[data-transcript-ref]').forEach(b=>b.onclick=()=>{const record=(i.radioTranscripts||[]).find(r=>r.id===b.dataset.transcriptRef);if(record){const body=narrative.querySelector('.voice-detail-content');body.innerHTML='<div class="voice-entry"><div class="meta">'+safe(record.time)+' | '+safe(record.source)+'</div>'+safe(record.text)+'</div>'}});
}
window.cadCallTakeRefresh=refresh;
$('cadCTFilter')?.addEventListener('change',refresh);
setTimeout(refresh,200);
})();
