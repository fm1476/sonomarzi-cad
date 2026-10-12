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
 '<div class="cad-ct-narrative-header"><h3>Event Narrative</h3><button type="button" id="cadCTAddNote" class="primary">Add Narrative</button></div><div id="cadCTNarrative">'+(window.voiceDetailHtml?window.voiceDetailHtml(i):'<p>Narrative unavailable</p>')+'</div>';
 $('cadCTClose').onclick=()=>{selected=null;refresh()};
 $('cadCTActivate')?.addEventListener('click',()=>{if(i.status!=='PENDING')return;i.status='ACTIVE';window.cadCallTakeEvent?.(i,'CALL_ACTIVATED_FROM_CALL_TAKING');window.cadCallTakeSave?.()});
 $('cadCTForm').onsubmit=e=>{e.preventDefault();const f=new FormData(e.currentTarget);let changes=[];for(const key of ['location','caller','phone','priority','caseNumber']){const value=String(f.get(key)||'').trim();if(value!==String(i[key]||'')){i[key]=value;changes.push(key)}}if(changes.length){window.cadCallTakeEvent?.(i,'CALL_TAKER_UPDATED '+changes.join(','));window.cadCallTakeSave?.()}};
 $('cadCTAddNote').onclick=()=>{const note=prompt('Narrative entry');if(!note?.trim())return;const author=identity(),timestamp=new Date().toISOString(),text=note.trim();(i.narrative||=[]).push(text);(i.manualNarrativeEntries||=[]).push({id:'calltake-'+Date.now(),text,timestamp,author});window.cadCallTakeEvent?.(i,'NARRATIVE_ADDED '+timestamp+' BY '+author);window.cadCallTakeSave?.()};
 // Reuse the same transcript navigation and chronological sort controls as Dispatch.
 window.voiceBindDetail?.(i);
}
window.cadCallTakeRefresh=refresh;
$('cadCTFilter')?.addEventListener('change',refresh);
setTimeout(refresh,200);
})();
