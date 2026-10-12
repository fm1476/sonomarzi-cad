// Named CAD workspace layouts. UI preferences only; never stores operational records.
(()=>{
'use strict';
const PREFIX='smcad-workspace-presets-v16.5', CURRENT='smcad-workspace-current-v16.5';
const BOARD='smcad-board-layout-v15.5',ORDER='smcad-panel-order-v15.5',POSITION='smcad-command-placement-v16.3',RECT='smcad-command-floating-rect-v16.3',HEIGHTS='smcad-board-heights-v16.5',POPOUTS='smcad-workspace-popouts-v16.6',LANES='smcad-panel-lanes-v16.8',FREE='smcad-freeform-v16.9';
const keys=[BOARD,ORDER,POSITION,RECT,HEIGHTS,POPOUTS,LANES,FREE];
const select=document.getElementById('cadWorkspaceSelect');if(!select)return;
const status=document.getElementById('cadWorkspaceStatus');
const grid=document.querySelector('#dispatch .grid');
const panels=[...grid.querySelectorAll('[data-panel]')];
const defaults={};for(const k of keys)defaults[k]=localStorage.getItem(k);
let store;
try{store=JSON.parse(localStorage.getItem(PREFIX)||'null')}catch{}
if(!store||typeof store!=='object'||!Array.isArray(store.items))store={items:[]};
const current=()=>localStorage.getItem(CURRENT)||'';
const now=()=>new Date().toISOString();
function persist(){localStorage.setItem(PREFIX,JSON.stringify(store));}
function say(msg){status.textContent=msg;}
function capture(){const data={};keys.forEach(k=>data[k]=localStorage.getItem(k));data[ORDER]=JSON.stringify([...grid.querySelectorAll('[data-panel]')].map(x=>x.dataset.panel));return data;}
function refresh(){const id=select.value;select.replaceChildren();select.add(new Option('Current unsaved layout',''));for(const item of store.items)select.add(new Option(item.name,item.id));if(store.items.some(x=>x.id===id))select.value=id;else if(store.items.some(x=>x.id===current()))select.value=current();}
function selected(){return store.items.find(x=>x.id===select.value);}
function takeName(message,initial=''){const x=prompt(message,initial);return x===null?null:x.trim().slice(0,60);}
function unique(name,ignore=''){return !store.items.some(x=>x.id!==ignore&&x.name.toLowerCase()===name.toLowerCase());}
function saveNew(){const name=takeName('Name this CAD workspace (e.g. Fire Operations, Patrol, Command):');if(name===null)return;if(!name)return say('A workspace name is required.');if(!unique(name))return say('That workspace name already exists.');const item={id:'ws-'+Date.now()+'-'+Math.random().toString(36).slice(2,6),name,modified:now(),values:capture()};store.items.push(item);persist();localStorage.setItem(CURRENT,item.id);refresh();select.value=item.id;say('Saved workspace: '+name);}
function load(){const item=selected();if(!item)return say('Select a saved workspace to load.');if(!item.values||typeof item.values!=='object')return say('Workspace data is invalid.');for(const k of keys){const v=item.values[k];if(typeof v==='string')localStorage.setItem(k,v);else localStorage.removeItem(k)}localStorage.setItem(CURRENT,item.id);location.reload();}
function update(){const item=selected();if(!item)return say('Select a saved workspace to update.');item.values=capture();item.modified=now();persist();localStorage.setItem(CURRENT,item.id);say('Updated workspace: '+item.name);}
function rename(){const item=selected();if(!item)return say('Select a workspace to rename.');const name=takeName('New workspace name:',item.name);if(name===null)return;if(!name||!unique(name,item.id))return say('Name is empty or already used.');item.name=name;item.modified=now();persist();refresh();say('Renamed workspace: '+name);}
function remove(){const item=selected();if(!item)return say('Select a workspace to delete.');if(!confirm('Delete saved workspace “'+item.name+'”? Current calls and unit statuses will not be deleted.'))return;store.items=store.items.filter(x=>x.id!==item.id);persist();if(current()===item.id)localStorage.removeItem(CURRENT);refresh();select.value='';say('Deleted workspace: '+item.name);}
function reset(){if(!confirm('Reset the visual workspace layout? This does not reset incidents or units.'))return;for(const k of keys)localStorage.removeItem(k);localStorage.removeItem(CURRENT);location.reload();}
[['cadWorkspaceLoad',load],['cadWorkspaceNew',saveNew],['cadWorkspaceUpdate',update],['cadWorkspaceRename',rename],['cadWorkspaceDelete',remove],['cadWorkspaceReset',reset]].forEach(([id,fn])=>document.getElementById(id)?.addEventListener('click',fn));
select.addEventListener('change',()=>say(selected()?'Selected '+selected().name+'; press Load to apply.':'Current unsaved layout.'));
refresh();
// Resize operational boards vertically using a dedicated bottom edge handle.
let heights={};try{heights=JSON.parse(localStorage.getItem(HEIGHTS)||'{}')||{}}catch{}
for(const panel of panels.filter(p=>['pending','active','units'].includes(p.dataset.panel))){
 const id=panel.dataset.panel;
 if(Number.isFinite(Number(heights[id]))&&Number(heights[id])>=220)panel.style.height=Number(heights[id])+'px';
 const grip=document.createElement('div');grip.className='cad-panel-height-grip';grip.title='Drag up or down to change this board height';grip.textContent='⋯';panel.append(grip);
 let drag=null;
 grip.addEventListener('pointerdown',e=>{if(e.button!==0)return;drag={y:e.clientY,height:panel.getBoundingClientRect().height,id:e.pointerId};grip.setPointerCapture(e.pointerId);e.preventDefault();});
 grip.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;const height=Math.max(220,Math.min(1300,drag.height+e.clientY-drag.y));panel.style.height=height+'px';});
 const end=()=>{if(!drag)return;drag=null;heights[id]=Math.round(panel.getBoundingClientRect().height);localStorage.setItem(HEIGHTS,JSON.stringify(heights));if(id==='map'&&window.renderMap)renderMap();};
 grip.addEventListener('pointerup',end);grip.addEventListener('pointercancel',end);
}
// Horizontal-only resize grip for floating command line.
const command=document.querySelector('.cad-smart-command');if(command){
 const grip=document.createElement('div');grip.className='cad-command-width-grip';grip.title='Drag to adjust command line width';command.append(grip);
 let drag=null;
 grip.addEventListener('pointerdown',e=>{if(e.button!==0)return;drag={id:e.pointerId,x:e.clientX,w:command.getBoundingClientRect().width};grip.setPointerCapture(e.pointerId);e.preventDefault();});
 grip.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;if(!command.classList.contains('cad-command-floating'))return;const width=Math.max(360,Math.min(window.innerWidth-16,drag.w+e.clientX-drag.x));command.style.width=width+'px';});
 const end=()=>{if(!drag)return;drag=null;const r=command.getBoundingClientRect();localStorage.setItem(RECT,JSON.stringify({left:r.left,top:r.top,width:r.width,height:110}));};
 grip.addEventListener('pointerup',end);grip.addEventListener('pointercancel',end);
}
})();
