/* Agency-scoped unit status configuration; canonical status semantics are unchanged. */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const core=['AVAILABLE','DISPATCHED','ENROUTE','ONSCENE','TRANSPORTING','AT_HOSPITAL','OUT_OF_SERVICE'];
const defaults=[
 ['AVAILABLE','Available','AVAILABLE','ALL'],['DISPATCHED','Dispatched','DISPATCHED','ALL'],
 ['ENROUTE','Enroute','ENROUTE','ALL'],['ONSCENE','On scene','ONSCENE','ALL'],
 ['TRANSPORTING','Transporting','TRANSPORTING','EMS'],['AT_HOSPITAL','At hospital','AT_HOSPITAL','EMS'],
 ['OUT_OF_SERVICE','Out of service','OUT_OF_SERVICE','ALL']
];
let current=[],editing=null;
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const session=()=>window.CadDemoLogin?.current?.();
const client=()=>window.CadDemoLogin?.client?.();
function render(){
 const host=$('cadUnitStatusCatalogList');if(!host)return;
 const rows=current.length?current:defaults.map(([code,label,canonical_status,discipline])=>({code,label,canonical_status,discipline,enabled:true,radio_phrases:[]}));
 host.innerHTML=rows.map(x=>'<div class="cad-status-config-item"><div><b>'+escape(x.label)+'</b><small>'+escape(x.code)+' · '+escape(x.discipline)+' · '+escape(x.canonical_status)+(x.enabled===false?' · Disabled':'')+'</small></div><button type="button" data-status-edit="'+escape(x.code)+'">Edit</button></div>').join('');
 host.querySelectorAll('[data-status-edit]').forEach(button=>button.onclick=()=>{
  const row=rows.find(x=>x.code===button.dataset.statusEdit);if(!row)return;
  editing=row.code;
  $('cadStatusCode').value=row.code;$('cadStatusCode').readOnly=true;
  $('cadStatusLabel').value=row.label;$('cadStatusCanonical').value=row.canonical_status;
  $('cadStatusDiscipline').value=row.discipline;$('cadStatusAliases').value=(row.radio_phrases||[]).join(', ');
  $('cadStatusEnabled').checked=row.enabled!==false;
  $('cadStatusEditor').hidden=false;
 });
 $('cadStatusConfigStatus').textContent=session()?'Shared agency configuration':'Sign in to shared CAD to save agency-wide statuses.';
}
window.addEventListener('cad:unit-status-catalog-updated',e=>{current=e.detail?.catalog||[];render();});
$('cadStatusNew').onclick=()=>{
 editing=null;$('cadStatusCode').readOnly=false;$('cadStatusCode').value='';
 $('cadStatusLabel').value='';$('cadStatusCanonical').value='AVAILABLE';
 $('cadStatusDiscipline').value='ALL';$('cadStatusAliases').value='';
 $('cadStatusEnabled').checked=true;$('cadStatusEditor').hidden=false;
};
$('cadStatusCancel').onclick=()=>{$('cadStatusEditor').hidden=true;};
$('cadStatusSave').onclick=async()=>{
 const code=$('cadStatusCode').value.trim().toUpperCase().replace(/\s+/g,'_');
 const label=$('cadStatusLabel').value.trim(),canonicalStatus=$('cadStatusCanonical').value,discipline=$('cadStatusDiscipline').value;
 const radioPhrases=$('cadStatusAliases').value.split(',').map(v=>v.trim()).filter(Boolean);
 const status=$('cadStatusConfigStatus');
 if(!/^[A-Z0-9_]{2,32}$/.test(code)||label.length<2||label.length>60||radioPhrases.length>12){status.textContent='Check code, label and radio phrases.';return;}
 const login=session();if(!login){status.textContent='Sign in to shared CAD before saving.';return;}
 const button=$('cadStatusSave');button.disabled=true;status.textContent='Saving agency status…';
 try{
  await client().saveUnitStatusCatalog({agency:login.agencyId,code,label,canonicalStatus,discipline,radioPhrases,enabled:$('cadStatusEnabled').checked});
  current=await client().listUnitStatusCatalog(login.agencyId);
  window.dispatchEvent(new CustomEvent('cad:unit-status-catalog-updated',{detail:{catalog:current}}));
  $('cadStatusEditor').hidden=true;status.textContent='Saved to shared agency catalog.';
 }catch(error){status.textContent='Save failed: '+error.message;}
 finally{button.disabled=false;}
};
render();
})();