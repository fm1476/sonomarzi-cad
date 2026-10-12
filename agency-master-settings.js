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
function render(){
 list.innerHTML='<h4>Agencies ('+data.agencies.length+')</h4>'+(data.agencies.map(a=>'<div>'+esc(a.name)+' ('+esc(a.id)+') · '+esc(a.model)+'</div>').join('')||'<p>No configured agencies yet.</p>')+
 '<h4>Personnel ('+data.personnel.length+')</h4>'+(data.personnel.map(p=>'<div>'+esc(p.name)+' ('+esc(p.id)+') · '+esc(p.agencyId)+'</div>').join('')||'<p>No configured personnel yet.</p>')+
 '<h4>Units ('+data.units.length+')</h4>'+(data.units.map(u=>'<div><strong>'+esc(u.designator)+'</strong> · '+esc(u.agencyId)+' · '+esc(u.discipline)+' · '+esc(u.model)+(u.personId?' · '+esc(u.personId):'')+' <button type="button" data-unit-activate="'+esc(u.id)+'">Activate in CAD</button> <button type="button" data-unit-delete="'+esc(u.id)+'">Remove</button></div>').join('')||'<p>No configured units yet.</p>');
 el('cadMasterAgencySelect').innerHTML=opts(data.agencies.map(a=>({id:a.id,name:a.name})));
 el('cadMasterPersonnelAgency').innerHTML=opts(data.agencies.map(a=>({id:a.id,name:a.name})));
 el('cadMasterPersonSelect').innerHTML='<option value="">None / assigned at sign-on</option>'+opts(data.personnel.map(p=>({id:p.id,name:p.name+' ('+p.id+')'})));
}
function commit(next,success){try{M.save(localStorage,next);data=next;render();message.textContent=success;}catch(e){message.textContent='Not saved: '+e.message;}}
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
 commit({...data,units:[...data.units,{id,designator,agencyId,discipline,model,personId}]},'Unit saved. This is a master definition, not a live CAD assignment.');
});
list.addEventListener('click',e=>{
 const activateId=e.target?.getAttribute('data-unit-activate');if(activateId){const result=window.cadActivateMasterUnit?.(activateId);message.textContent=result?.ok?'Unit activated in live CAD roster.':'Activation failed: '+(result?.error||'CAD integration unavailable');return;}
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