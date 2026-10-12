// Independent panel lanes: resizing a panel never resizes the neighbouring panel.
(()=>{
'use strict';
const grid=document.querySelector('#dispatch>.grid');if(!grid)return;
const ids=['pending','active','units','detail','map'];
const KEY='smcad-panel-lanes-v16.8',ORDER='smcad-panel-order-v15.5';
let arrangement;try{arrangement=JSON.parse(localStorage.getItem(KEY)||'null')}catch{}
if(!Array.isArray(arrangement)||arrangement.length!==3||ids.some(id=>!arrangement.flat().includes(id)))arrangement=[['pending','detail'],['active','map'],['units']];
const panels=Object.fromEntries(ids.map(id=>[id,grid.querySelector('[data-panel="'+id+'"]')]));
const lanes=[0,1,2].map(i=>{const x=document.createElement('div');x.className='cad-lane';x.dataset.lane=i;grid.append(x);return x});
grid.classList.add('cad-lanes');
for(let i=0;i<3;i++)for(const id of arrangement[i])if(panels[id])lanes[i].append(panels[id]);
function persist(){const data=lanes.map(l=>[...l.querySelectorAll(':scope > [data-panel]')].map(x=>x.dataset.panel));localStorage.setItem(KEY,JSON.stringify(data));localStorage.setItem(ORDER,JSON.stringify(data.flat()));if(window.renderMap)requestAnimationFrame(()=>window.renderMap())}
let moving=null;
for(const panel of Object.values(panels)){
 const grip=panel?.querySelector('.panel-drag');if(!grip)continue;
 grip.addEventListener('dragstart',e=>{moving=panel;e.dataTransfer.setData('text/plain','pane:'+panel.dataset.panel);e.dataTransfer.effectAllowed='move'});
 grip.addEventListener('dragend',()=>{moving=null;lanes.forEach(l=>l.classList.remove('cad-lane-over'))});
 panel.addEventListener('dragover',e=>{if(moving&&moving!==panel){e.preventDefault();e.stopPropagation()}});
 panel.addEventListener('drop',e=>{if(!moving||moving===panel)return;e.preventDefault();e.stopPropagation();panel.parentElement.insertBefore(moving,panel);persist();moving=null});
}
for(const lane of lanes){
 lane.addEventListener('dragover',e=>{if(moving){e.preventDefault();lane.classList.add('cad-lane-over')}});
 lane.addEventListener('dragleave',e=>{if(!lane.contains(e.relatedTarget))lane.classList.remove('cad-lane-over')});
 lane.addEventListener('drop',e=>{if(!moving)return;e.preventDefault();e.stopPropagation();lane.append(moving);moving=null;lanes.forEach(l=>l.classList.remove('cad-lane-over'));persist()});
}
})();
