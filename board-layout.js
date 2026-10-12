// Board layout settings are UI-only and never modify CAD records.
(function(){
const KEY='smcad-board-layout-v15.5';
const fields={pending:['event','call','units'],active:['event','call','units'],units:['id','agency','location','status']};
const labels={event:'Priority / Event',call:'Call / Location',units:'Assigned Units',id:'Unit',agency:'Agency',location:'Location',status:'Status'};
const defaults={pending:{agency:'ALL',discipline:'ALL',sort:'priority',group:false,columns:[...fields.pending]},active:{agency:'ALL',discipline:'ALL',sort:'priority',group:false,columns:[...fields.active]},units:{agency:'ALL',status:'ALL',sort:'id',group:'none',columns:[...fields.units]}};
let saved={};try{saved=JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch(e){}
const opts={};for(const type of Object.keys(defaults)){
 const v=saved[type]||{};opts[type]={...defaults[type],...v};
 if(!Array.isArray(opts[type].columns)||fields[type].some(f=>!opts[type].columns.includes(f)))opts[type].columns=[...fields[type]];
}
function persist(){localStorage.setItem(KEY,JSON.stringify(opts))}
const alpha=(a,b)=>String(a).localeCompare(String(b),undefined,{numeric:true,sensitivity:'base'});
function buildColumns(type){const el=document.querySelector(`[data-columns="${type}"]`);if(!el)return;
 el.innerHTML=opts[type].columns.map(f=>`<span draggable="true" class="col-drag" data-field="${f}" title="Drag to rearrange columns">⠿ ${labels[f]}</span>`).join('');
 el.querySelectorAll('[draggable]').forEach(node=>{
 node.addEventListener('dragstart',e=>{e.dataTransfer.setData('text/plain',type+'|'+node.dataset.field);e.dataTransfer.effectAllowed='move'});
 node.addEventListener('dragover',e=>e.preventDefault());
 node.addEventListener('drop',e=>{e.preventDefault();const [origin,field]=(e.dataTransfer.getData('text/plain')||'').split('|');if(origin!==type||!opts[type].columns.includes(field))return;const cols=opts[type].columns;cols.splice(cols.indexOf(field),1);cols.splice(cols.indexOf(node.dataset.field),0,field);persist();window.render()});
 });
}
function initialize(){document.querySelectorAll('.board-controls').forEach(bar=>{
 const type=bar.dataset.board;
 const agency=bar.querySelector('[data-setting="agency"]');
 const names=[...new Set([...state.units,...state.incidents].map(x=>x.agency).filter(Boolean))].sort(alpha);
 agency.innerHTML='<option value="ALL">All agencies</option>'+names.map(x=>`<option value="${escapeCad(x)}">${escapeCad(x)}</option>`).join('');
 const statuses=bar.querySelector('[data-setting="status"]');
 if(statuses)statuses.innerHTML='<option value="ALL">All statuses</option>'+[...new Set(state.units.map(x=>x.status))].sort(alpha).map(x=>`<option value="${escapeCad(x)}">${escapeCad(x).replaceAll('_',' ')}</option>`).join('');
 bar.querySelectorAll('[data-setting]').forEach(node=>{
 const setting=node.dataset.setting;if(node.type==='checkbox')node.checked=!!opts[type][setting];else{if(![...node.options].some(o=>o.value===opts[type][setting]))opts[type][setting]='ALL';node.value=opts[type][setting]}
 node.onchange=()=>{opts[type][setting]=node.type==='checkbox'?node.checked:node.value;persist();window.render()};
 });
 buildColumns(type);
 });}
const itemHTML=(type,item)=>{
 if(type!=='units'){
 const components={event:`<span class="prio ${String(item.priority).toLowerCase()}">${escapeCad(item.priority)}<div class="meta">${escapeCad(item.id)}</div></span>`,call:`<span><b>${escapeCad(item.type)}</b><div>${(()=>{const place=window.cadCommonPlaces?.resolve(item.location);const name=item.commonPlaceName||place?.name;return name?`<span class="cad-board-common-place">${escapeCad(name)}</span><span class="cad-board-street-address">${escapeCad(item.location)}</span>`:escapeCad(item.location)})()}</div><div class="meta">${escapeCad(item.agency)} • <strong class="cad-discipline cad-discipline-${String(item.discipline).toLowerCase()}">${escapeCad(item.discipline)}</strong></div>${item.linkedFrom?`<div class="meta cad-linked-note">↳ Linked from ${escapeCad(item.linkedFrom)}</div>`:''}${typeof cadIncidentFamily==='function' && state.incidents.some(other=>other.id!==item.id&&cadIncidentFamily(other).id===cadIncidentFamily(item).id)?`<span class="cad-linked-board-label">🔗 LINKED ${escapeCad(item.discipline)}</span>`:''}</span>`,units:`<span>${(item.units||[]).length?(item.units||[]).map(id=>`<span class="cad-unit-chip status-${String(state.units.find(u=>u.id===id)?.status||'UNKNOWN').toLowerCase().replace(/[^a-z0-9]+/g,'-')}" draggable="true" data-drag-unit="${escapeCad(id)}" title="Drag to another incident or Units Status">${escapeCad(id)}</span>`).join(' '):'—'}<div class="meta">${item.caseNumber?'Case '+escapeCad(item.caseNumber):'No case number'}</div></span>`};
 return `<div class="row board-flex ${state.selected===item.id?'selected':''}" data-id="${escapeCad(item.id)}">${opts[type].columns.map(f=>components[f]).join('')}</div>`;
 }
 const unitStatusClass=`status-${String(item.status).toLowerCase().replace(/[^a-z0-9]+/g,'-')}`;
 const components={id:`<span class="cad-unit-chip board-unit-pill ${unitStatusClass}" draggable="false" title="${escapeCad(item.id)} • ${escapeCad(String(item.status).replace(/_/g,' '))}">${escapeCad(item.id)}</span>`,agency:`<span>${escapeCad(item.agency)}<div class="meta">${escapeCad(item.discipline)}</div></span>`,location:`<span class="cad-board-location" title="${escapeCad(item.location||'Not reported')}">${escapeCad(item.location||'Not reported')}</span>`,status:`<span class="status ${unitStatusClass}">${escapeCad(String(item.status).replace(/_/g,' '))}</span>`};
 return `<div class="unit board-flex" draggable="true" data-drag-unit="${escapeCad(item.id)}" title="Drag to Pending/Active incident to dispatch, or Units board to make available">${opts.units.columns.map(f=>components[f]).join('')}</div>`;
};
function groupHTML(type,items,by){const groups=new Map();for(const item of items){const key=item[by]||'Unassigned';if(!groups.has(key))groups.set(key,[]);groups.get(key).push(item)}return [...groups].sort((a,b)=>alpha(a[0],b[0])).map(([name,rows])=>`<div class="board-group">${escapeCad(name)} <span>(${rows.length})</span></div>`+rows.map(i=>itemHTML(type,i)).join('')).join('')}
window.cadBoardRender=function(type,list){
 const target=document.getElementById(type==='active'?'activeCalls':type);if(!target)return;
 const v=opts[type];let rows=list.filter(i=>(v.agency==='ALL'||i.agency===v.agency)&&(type==='units'?(v.status==='ALL'||i.status===v.status):(v.discipline==='ALL'||i.discipline===v.discipline)));
 rows.sort((a,b)=>{const sort=v.sort;let x,y;if(sort==='priority'){x=a.priority;y=b.priority}else if(sort==='event'){x=a.id;y=b.id}else if(sort==='type'){x=a.type;y=b.type}else if(sort==='location'){x=a.location;y=b.location}else if(sort==='status'){x=a.status;y=b.status}else if(sort==='discipline'){x=a.discipline;y=b.discipline}else if(sort==='agency'){x=a.agency;y=b.agency}else{x=a.id;y=b.id}return alpha(x,y)||alpha(a.id,b.id)});
 const by=(type==='units'?(v.group==='none'?null:v.group):(v.group?'agency':null));
 target.innerHTML=!rows.length?'<div class="board-empty">No matching records</div>':by?groupHTML(type,rows,by):rows.map(r=>itemHTML(type,r)).join('');
 // Agency and new status entries can change when voice logs a unit on.
 const bar=document.querySelector(`.board-controls[data-board="${type}"]`);
 const ag=bar?.querySelector('[data-setting="agency"]');
 if(ag){const names=[...new Set([...state.units,...state.incidents].map(x=>x.agency).filter(Boolean))].sort(alpha);for(const n of names)if(![...ag.options].some(o=>o.value===n))ag.add(new Option(n,n))}
 if(type==='units'){const el=bar.querySelector('[data-setting="status"]');for(const n of [...new Set(state.units.map(x=>x.status))].sort(alpha))if(![...el.options].some(o=>o.value===n))el.add(new Option(n.replaceAll('_',' '),n))}
};
function initPanelDrag(){const grid=document.querySelector('#dispatch .grid');if(!grid)return;const orderKey='smcad-panel-order-v15.5';let ids=[];try{ids=JSON.parse(localStorage.getItem(orderKey)||'[]')}catch(e){}
 for(const id of ids){const p=grid.querySelector(`[data-panel="${id}"]`);if(p)grid.appendChild(p)}
 let dragged=null;grid.querySelectorAll('.panel-drag').forEach(handle=>{const panel=handle.closest('[data-panel]');handle.addEventListener('dragstart',e=>{dragged=panel;e.dataTransfer.setData('text/plain','panel:'+panel.dataset.panel);e.dataTransfer.effectAllowed='move'});handle.addEventListener('dragend',()=>{dragged=null})});
 grid.querySelectorAll('[data-panel]').forEach(panel=>{panel.addEventListener('dragover',e=>{if(dragged&&dragged!==panel)e.preventDefault()});panel.addEventListener('drop',e=>{if(!dragged||dragged===panel)return;e.preventDefault();grid.insertBefore(dragged,panel);localStorage.setItem(orderKey,JSON.stringify([...grid.querySelectorAll('[data-panel]')].map(p=>p.dataset.panel)));renderMap();dragged=null})});}
initialize();initPanelDrag();
})();
