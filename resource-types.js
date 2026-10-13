/* Agency-scoped resource type catalog; seeded from actual configured master unit types. */
(function(root){
'use strict';
const KEY='smcad-resource-types-v1',D=['LAW','FIRE','EMS'];
const read=()=>{try{const x=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(x)?x:[]}catch{return []}};
const save=items=>{localStorage.setItem(KEY,JSON.stringify(items));window.dispatchEvent(new Event('cad-resource-types-updated'))};
const master=()=>root.CadAgencyMaster?.read(localStorage)||{agencies:[],units:[]};
const nameFor=(agencyId,m)=>m.agencies.find(a=>a.id===agencyId)?.name||'';
function forAgency(agencyName,discipline){
 const m=master(),entries=read().filter(x=>x.agency===agencyName&&x.discipline===discipline);
 const actual=m.units.filter(u=>u.discipline===discipline&&nameFor(u.agencyId,m)===agencyName).map(u=>u.resourceType).filter(Boolean);
 const unique=[...new Set([...entries.map(x=>x.name),...actual])];
 return unique.map(name=>entries.find(x=>x.name===name)||{agency:agencyName,discipline,name,icon:'▣',source:'existing-unit'}).sort((a,b)=>(a.order??999)-(b.order??999));
}
function forDiscipline(d){const m=master();return [...new Set([...read().filter(x=>x.discipline===d).map(x=>x.name),...m.units.filter(u=>u.discipline===d).map(u=>u.resourceType).filter(Boolean)])]}
function render(){
 let host=document.getElementById('cadResourceTypeManager');if(!host){const target=document.getElementById('cadMasterList');if(!target)return;host=document.createElement('section');host.id='cadResourceTypeManager';host.className='cad-resource-type-manager';target.before(host)}
 const m=master(),agencies=m.agencies.map(a=>a.name);
 host.innerHTML='<h4>Resource Type Catalog</h4><p>Configure resource types for each agency. Existing types used by unit definitions remain visible; the catalog feeds the alarm and response-plan palettes.</p><div class="cad-rt-toolbar"><label>Agency<select id="crtAgency">'+agencies.map(x=>'<option>'+esc(x)+'</option>').join('')+'</select></label><label>Discipline<select id="crtDisc"><option>FIRE</option><option>EMS</option><option>LAW</option></select></label></div><div class="cad-rt-toolbar"><label>New resource type<input id="crtName" placeholder="QUINT"></label><label>Icon<button id="crtPickIcon" type="button" class="cad-rt-pick-icon">Choose Icon</button><input id="crtIcon" type="hidden"></label><button id="crtAdd" type="button">Add Resource Type</button></div><div id="crtCards" class="cad-rt-cards"></div><p id="crtStatus" role="status"></p>';
 let chosenIcon='fire-engine';const pick=document.getElementById('crtPickIcon');const iconInput=document.getElementById('crtIcon');const updatePick=()=>{pick.innerHTML=(root.CadVehicleIcons?.svg(chosenIcon)||'▣')+' <span>Choose Icon</span>';iconInput.value=chosenIcon};pick.onclick=()=>root.CadVehicleIcons?.choose(id=>{chosenIcon=id;updatePick()},chosenIcon);updatePick();
 const agency=document.getElementById('crtAgency'),disc=document.getElementById('crtDisc'),cards=document.getElementById('crtCards'),status=document.getElementById('crtStatus');
 function draw(){
  const entries=forAgency(agency.value,disc.value);
  cards.innerHTML=entries.map((x,i)=>'<div class="cad-rt-card" draggable="true" data-index="'+i+'" data-name="'+esc(x.name)+'"><span class="cad-rt-grip">⠿</span><span class="cad-rt-icon">'+esc(x.icon||'▣')+'</span><strong>'+esc(x.name)+'</strong><button type="button" data-edit="'+esc(x.name)+'">Edit</button><button type="button" data-remove="'+esc(x.name)+'">Remove</button></div>').join('')||'<p>No resource types yet. Add one above.</p>';
  cards.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>{const old=entries.find(x=>x.name===b.dataset.edit);const name=prompt('Resource type name',old.name)?.trim().toUpperCase();if(!name)return;const icon=old.icon||'fire-engine';if(entries.some(x=>x.name===name&&x.name!==old.name))return status.textContent='That resource type already exists.';if(m.units.some(u=>u.resourceType===old.name&&nameFor(u.agencyId,m)===agency.value&&u.discipline===disc.value)&&name!==old.name)return status.textContent='This type is assigned to units. Update their definitions before renaming.';let all=read().filter(x=>!(x.agency===agency.value&&x.discipline===disc.value&&x.name===old.name));all.push({...old,agency:agency.value,discipline:disc.value,name,icon,order:entries.indexOf(old)});save(all);draw()});
  cards.querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('contextmenu',e=>{e.preventDefault();const old=entries.find(x=>x.name===b.dataset.edit);if(!old)return;root.CadVehicleIcons?.choose(icon=>{const all=read().filter(x=>!(x.agency===agency.value&&x.discipline===disc.value&&x.name===old.name));save([...all,{...old,agency:agency.value,discipline:disc.value,icon}]);draw()},old.icon)}));
  cards.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{const name=b.dataset.remove;if(m.units.some(u=>u.resourceType===name&&nameFor(u.agencyId,m)===agency.value&&u.discipline===disc.value))return status.textContent='Cannot remove '+name+': existing units use it.';if(!confirm('Remove '+name+' from this agency catalog? Existing saved response assignments are preserved.'))return;save(read().filter(x=>!(x.agency===agency.value&&x.discipline===disc.value&&x.name===name)));draw()});
  cards.querySelectorAll('[data-index]').forEach(tile=>{tile.ondragstart=e=>e.dataTransfer.setData('text/plain',tile.dataset.index);tile.ondragover=e=>e.preventDefault();tile.ondrop=e=>{e.preventDefault();const from=Number(e.dataTransfer.getData('text/plain')),to=Number(tile.dataset.index);if(!Number.isInteger(from)||from<0||from>=entries.length||from===to)return;const ordered=entries.slice();ordered.splice(to,0,ordered.splice(from,1)[0]);const others=read().filter(x=>!(x.agency===agency.value&&x.discipline===disc.value));save([...others,...ordered.map((x,i)=>({...x,agency:agency.value,discipline:disc.value,order:i}))]);draw()}});
 }
 agency.onchange=draw;disc.onchange=draw;
 document.getElementById('crtAdd').onclick=()=>{const name=document.getElementById('crtName').value.trim().toUpperCase(),icon=document.getElementById('crtIcon').value.trim()||'fire-engine';if(!/^[A-Z0-9][A-Z0-9 _-]{0,39}$/.test(name))return status.textContent='Use 1–40 letters, numbers, spaces, underscores or hyphens.';if(forAgency(agency.value,disc.value).some(x=>x.name===name))return status.textContent='Type already exists.';save([...read(),{agency:agency.value,discipline:disc.value,name,icon,order:forAgency(agency.value,disc.value).length}]);document.getElementById('crtName').value='';chosenIcon='fire-engine';updatePick();draw();status.textContent=name+' added.'};draw();
}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
root.CadResourceTypes={forAgency,forDiscipline,render};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',render);else render();
})(window);