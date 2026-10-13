/* Agency-scoped browser-local Call Taking form layout designer (POC). */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const base=[['location','Location','text'],['priority','Priority','text'],['caseNumber','Case number','text'],['locationNotes','Location notes','text'],['type','Call for service','text'],['additionalCfs','Additional CFS','text'],['origin','Origin','text'],['dispatchStatus','Dispatch status','text'],['labels','Labels','text']];
const protectedIds=new Set(['location','priority','type']);
const defaults=()=>base.map(([id,label,type])=>({id,label,type,visible:true,required:id==='location',width:'half',custom:false}));
const key=a=>'smcad-form-designer-v1-'+encodeURIComponent(a);
const agencyOf=i=>String(i?.agency||'').trim();
function read(a){try{return JSON.parse(localStorage.getItem(key(a))||'{}')}catch{return {}}}
function published(a){const x=read(a).published;return Array.isArray(x?.fields)?x:null}
function fieldsFor(a){return published(a)?.fields||defaults()}
window.cadEventFormFields=fieldsFor;
const masterAgencies=()=>{const s=window.cadSafetyState?.();const names=(s?.incidents||[]).map(i=>agencyOf(i));try{const m=JSON.parse(localStorage.getItem('smcad-agency-master-v1')||'{}');for(const a of m.agencies||[])names.push(a.name||a.id||a.agencyName||'')}catch{}return [...new Set(names.filter(Boolean))].sort()};
const designer=$('cadFormDesigner'),open=$('cadOpenFormDesigner');
if(!designer||!open)return;
let agency='',draft=[],selected='',dragged='',dirty=false;
function load(a){agency=a;const doc=read(a);draft=structuredClone(doc.draft?.fields||doc.published?.fields||defaults());selected='';dirty=false;render()}
function persistDraft(){if(!agency)return;const doc=read(agency);doc.draft={fields:structuredClone(draft),updatedAt:new Date().toISOString()};localStorage.setItem(key(agency),JSON.stringify(doc));dirty=false;render()}
function render(){
 const agencies=masterAgencies();if(!agency&&agencies.length)agency=agencies[0];
 const doc=read(agency),item=draft.find(f=>f.id===selected);
 designer.innerHTML='<div class="cad-fd-head"><div><h3>Call Taking · Master Event Form</h3><p>Agency-wide layout · browser-local proof of concept</p></div><button type="button" id="cadFdExit">Close Designer</button></div>'+
 '<div class="cad-fd-actions"><label>Agency<select id="cadFdAgency">'+agencies.map(a=>'<option '+(a===agency?'selected':'')+'>'+esc(a)+'</option>').join('')+'</select></label><span class="cad-fd-state">'+(dirty?'Unsaved draft changes':doc.published?'Published '+new Date(doc.published.updatedAt).toLocaleString():'Using default layout')+'</span><button type="button" id="cadFdSave">Save Draft</button><button type="button" id="cadFdPreview">Preview</button><button type="button" class="primary" id="cadFdPublish">Publish to Agency</button><button type="button" id="cadFdRestore">Restore Published</button></div>'+
 '<div class="cad-fd-grid"><aside class="cad-fd-library"><h4>Add a field</h4><button type="button" data-add="text">+ Text</button><button type="button" data-add="textarea">+ Long text</button><button type="button" data-add="select">+ Dropdown</button><button type="button" data-add="date">+ Date</button><button type="button" data-add="checkbox">+ Checkbox</button><p>Drag fields on the canvas to reorder. Core fields cannot be deleted.</p></aside>'+
 '<div class="cad-fd-canvas"><h4>Event Information · Layout</h4><div class="cad-fd-fields">'+draft.map(f=>'<button type="button" draggable="true" data-field="'+esc(f.id)+'" class="cad-fd-tile '+(selected===f.id?'selected ':'')+(f.width==='full'?'wide':'')+'"><span class="cad-fd-grip">⠿</span><strong>'+esc(f.label)+'</strong><small>'+esc(f.type)+(f.required?' · required':'')+(f.visible?'':' · hidden')+'</small></button>').join('')+'</div></div>'+
 '<aside class="cad-fd-properties"><h4>Field properties</h4>'+(item?'<label>Label<input id="cadFdLabel" value="'+esc(item.label)+'"></label><label>Type<select id="cadFdType">'+['text','textarea','select','date','checkbox'].map(t=>'<option value="'+t+'" '+(t===item.type?'selected':'')+'>'+t+'</option>').join('')+'</select></label><label>Width<select id="cadFdWidth"><option value="half" '+(item.width==='half'?'selected':'')+'>Half</option><option value="full" '+(item.width==='full'?'selected':'')+'>Full</option></select></label><label><input type="checkbox" id="cadFdVisible" '+(item.visible?'checked':'')+' '+(protectedIds.has(item.id)?'disabled':'')+'> Visible</label><label><input type="checkbox" id="cadFdRequired" '+(item.required?'checked':'')+'> Required</label>'+(item.type==='select'?'<label>Dropdown options (one per line)<textarea id="cadFdOptions">'+esc((item.options||[]).join('\n'))+'</textarea></label>':'')+(item.custom?'<button type="button" id="cadFdDelete">Delete custom field</button>':'<p>Built-in field · underlying data key is protected.</p>'):'<p>Select a field to configure it.</p>')+'</aside></div><div id="cadFdPreviewPane" hidden></div>';
 $('cadFdExit').onclick=()=>designer.hidden=true;
 $('cadFdAgency').onchange=e=>{if(dirty&&!confirm('Discard unsaved draft changes?')){e.target.value=agency;return}load(e.target.value)};
 $('cadFdSave').onclick=persistDraft;
 $('cadFdRestore').onclick=()=>{if(confirm('Restore the last published layout to the draft?')){draft=structuredClone(doc.published?.fields||defaults());dirty=true;render()}};
 $('cadFdPublish').onclick=()=>{if(!agency)return;if(!confirm('Publish this form layout for '+agency+'? Existing event data will be retained.'))return;const d=read(agency);d.previous=d.published||null;d.published={fields:structuredClone(draft),updatedAt:new Date().toISOString()};d.draft={fields:structuredClone(draft),updatedAt:d.published.updatedAt};localStorage.setItem(key(agency),JSON.stringify(d));dirty=false;window.cadCallTakeRefresh?.();render()};
 $('cadFdPreview').onclick=()=>{const pane=$('cadFdPreviewPane');pane.hidden=!pane.hidden;pane.innerHTML='<h4>Preview · '+esc(agency)+'</h4><div class="cad-fd-fields">'+draft.filter(f=>f.visible).map(f=>'<label class="'+(f.width==='full'?'wide':'')+'">'+esc(f.label)+(f.required?' *':'')+'<input disabled placeholder="'+esc(f.type)+'"></label>').join('')+'</div>'};
 designer.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>{const type=b.dataset.add,id='custom_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,6);draft.push({id,label:'New '+type+' field',type,visible:true,required:false,width:'half',custom:true,options:type==='select'?['Option 1','Option 2']:[]});selected=id;dirty=true;render()});
 designer.querySelectorAll('[data-field]').forEach(b=>{
  b.onclick=()=>{selected=b.dataset.field;render()};
  b.ondragstart=e=>{dragged=b.dataset.field;e.dataTransfer.effectAllowed='move'};
  b.ondragover=e=>{e.preventDefault();e.dataTransfer.dropEffect='move'};
  b.ondrop=e=>{e.preventDefault();const from=draft.findIndex(f=>f.id===dragged),to=draft.findIndex(f=>f.id===b.dataset.field);if(from<0||to<0)return;draft.splice(to,0,draft.splice(from,1)[0]);dirty=true;render()};
 });
 if(!item)return;
 const bind=(id,prop,fn=x=>x)=>{const el=$(id);if(el)el.onchange=()=>{item[prop]=fn(el.type==='checkbox'?el.checked:el.value);dirty=true;render()}};
 bind('cadFdLabel','label',v=>v.trim()||item.label);bind('cadFdType','type');bind('cadFdWidth','width');bind('cadFdVisible','visible');bind('cadFdRequired','required');
 bind('cadFdOptions','options',v=>v.split('\n').map(x=>x.trim()).filter(Boolean));
 $('cadFdDelete')?.addEventListener('click',()=>{draft=draft.filter(f=>f.id!==selected);selected='';dirty=true;render()});
}
const section=$('cadConfigSection');
section?.addEventListener('change',()=>{document.querySelectorAll('[data-config-panel]').forEach(p=>p.hidden=p.dataset.configPanel!==section.value)});
open.onclick=()=>{designer.hidden=false;load(agency||masterAgencies()[0]||'')};
})();
