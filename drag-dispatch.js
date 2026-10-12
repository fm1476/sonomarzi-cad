/* v16.1: drag/drop CAD actions with conflict checks and movable command bar. */
(()=>{
'use strict';
const position=document.getElementById('commandPlacement');
const command=document.querySelector('.cad-smart-command');
const dispatch=document.getElementById('dispatch');
const grid=dispatch?.querySelector('.grid');
const results=document.getElementById('cadCommandResults');
if(!command||!grid||!position)return;
const PLACEMENT='smcad-command-placement-v16.3';
const FLOAT='smcad-command-floating-rect-v16.3';
const handle=document.getElementById('cadCommandHandle');
const reset=document.getElementById('resetCommandLocation');
const find=document.getElementById('findCommandLine');
function bounds(){return {w:window.innerWidth,h:window.innerHeight};}
function floatRect(){try{return JSON.parse(localStorage.getItem(FLOAT))||{};}catch{return {};}}
function setRect(rect){
 const {w,h}=bounds();const width=Math.max(360,Math.min(Number(rect.width)||Math.min(820,w-24),w-16));
 const height=Math.max(95,Math.min(Number(rect.height)||110,h-30));
 const left=Math.max(0,Math.min(Number.isFinite(Number(rect.left))?Number(rect.left):24,w-width));
 const top=Math.max(0,Math.min(Number.isFinite(Number(rect.top))?Number(rect.top):110,h-44));
 Object.assign(command.style,{left:left+'px',top:top+'px',width:width+'px',height:height+'px'});
}
function saveRect(){const r=command.getBoundingClientRect();localStorage.setItem(FLOAT,JSON.stringify({left:r.left,top:r.top,width:r.width,height:r.height}));}
function place(where,focus=false){
 if(command.classList.contains('cad-freeform-window')){if(focus)document.getElementById('command')?.focus();return;}
 command.classList.toggle('cad-command-floating',where==='floating');
 if(where==='floating'){
  dispatch.append(command);setRect(floatRect());
 }else{
  command.style.removeProperty('left');command.style.removeProperty('top');command.style.removeProperty('width');command.style.removeProperty('height');
  if(where==='top')grid.parentElement.insertBefore(command,grid);
  else if(where==='after-boards')grid.insertAdjacentElement('afterend',command);
  else dispatch.append(command);
 }
 position.value=where;localStorage.setItem(PLACEMENT,where);
 if(focus){command.scrollIntoView({behavior:'smooth',block:'start'});document.getElementById('command').focus({preventScroll:true});}
}
position.addEventListener('change',()=>place(position.value,true));
reset?.addEventListener('click',()=>place('top',true));
find?.addEventListener('click',()=>place('top',true));
let saved=localStorage.getItem(PLACEMENT)||localStorage.getItem('smcad-command-placement-v16.1')||'top';
place(['top','after-boards','bottom','floating'].includes(saved)?saved:'top');
let grip=null;
handle?.addEventListener('pointerdown',e=>{
 if(position.value!=='floating'||e.button!==0)return;
 const r=command.getBoundingClientRect();grip={id:e.pointerId,startX:e.clientX,startY:e.clientY,x:r.left,y:r.top};handle.setPointerCapture(e.pointerId);e.preventDefault();
});
handle?.addEventListener('pointermove',e=>{
 if(!grip||grip.id!==e.pointerId)return;
 const r=command.getBoundingClientRect(),{w,h}=bounds();
 command.style.left=Math.max(0,Math.min(w-r.width,grip.x+e.clientX-grip.startX))+'px';
 command.style.top=Math.max(0,Math.min(h-44,grip.y+e.clientY-grip.startY))+'px';
});
function endDrag(){if(grip){grip=null;saveRect();}}
handle?.addEventListener('pointerup',endDrag);handle?.addEventListener('pointercancel',endDrag);
if(typeof ResizeObserver!=='undefined'){const ro=new ResizeObserver(()=>{if(position.value==='floating'&&!grip)saveRect();});ro.observe(command);}
window.addEventListener('resize',()=>{if(position.value==='floating')setRect(floatRect());});
function report(ok,msg){
 const el=document.createElement('div');el.className='cad-result-line'+(ok?'':' error');el.textContent=(ok?'OK: ':'REVIEW: ')+msg;
 results.prepend(el);
 if(results.children.length>12)results.lastElementChild.remove();
 if(!ok&&typeof toast==='function')toast(msg.slice(0,120));
}
function assignments(unit){return state.incidents.filter(i=>i.status!=='CLOSED'&&i.units.includes(unit.id));}
function add(unitId,eventId){
 const unit=state.units.find(u=>u.id===unitId),incident=state.incidents.find(i=>i.id===eventId);
 if(!unit||!incident||incident.status==='CLOSED')return report(false,'Unit or active/pending incident not found.');
 const existing=assignments(unit),other=existing.filter(i=>i.id!==incident.id);
 if(other.length)return report(false,`${unitId} already assigned to ${other.map(i=>i.id+' '+i.type).join(', ')}. Use PRE or voice Preempt to transfer.`);
 if(unit.status==='OUT_OF_SERVICE')return report(false,`${unitId} is out of service.`);
 if(incident.units.includes(unit.id))return report(false,`${unitId} is already assigned to ${incident.id}.`);
 const resolved=cadDispatchTarget(incident,unit);if(resolved.error)return report(false,resolved.error);const target=resolved.incident;if(target.units.includes(unit.id))return report(false,`${unitId} already assigned to ${target.id}.`);target.units.push(unit.id);target.status='ACTIVE';unit.status='DISPATCHED';unit.location=target.location;
 event(target,`DRAG_DISPATCH ${unitId}`);state.selected=target.id;
 save();report(true,`${unitId} DISPATCHED to ${target.id} ${target.type}${resolved.linked?' (linked to '+incident.id+')':''}.`);
}
function release(unitId){
 const unit=state.units.find(u=>u.id===unitId);if(!unit)return report(false,'Unit not found.');
 const active=assignments(unit);
 if(active.length>1)return report(false,`${unitId} has multiple assignments. Resolve manually.`);
 for(const inc of active){inc.units=inc.units.filter(x=>x!==unit.id);event(inc,`DRAG_RELEASE ${unitId}`);if(!inc.units.length){inc.status='PENDING';event(inc,'INCIDENT_RETURNED_PENDING NO_DISPOSITION');}}
 unit.status='AVAILABLE';unit.location='Available';save();report(true,`${unitId} AVAILABLE${active.length?' / released from '+active[0].id:''}.`);
}
let dragging=null;
document.addEventListener('dragstart',e=>{
 const unit=e.target.closest?.('[data-drag-unit]');if(!unit)return;
 dragging=unit.dataset.dragUnit;e.dataTransfer.setData('application/x-cad-unit',dragging);e.dataTransfer.effectAllowed='move';
});
document.addEventListener('dragend',()=>{dragging=null;document.querySelectorAll('.cad-drop-target').forEach(e=>e.classList.remove('cad-drop-target'));});
const receiver=e=>e.target.closest?.('#pending .row[data-id], #activeCalls .row[data-id], #units, [data-panel="units"]');
document.addEventListener('dragover',e=>{
 if(!dragging||!receiver(e))return;
 e.preventDefault();e.dataTransfer.dropEffect='move';
 document.querySelectorAll('.cad-drop-target').forEach(x=>x.classList.remove('cad-drop-target'));
 receiver(e).classList.add('cad-drop-target');
});
document.addEventListener('drop',e=>{
 if(!dragging)return;
 const target=receiver(e);if(!target)return;
 e.preventDefault();e.stopPropagation();
 const id=dragging;dragging=null;
 document.querySelectorAll('.cad-drop-target').forEach(x=>x.classList.remove('cad-drop-target'));
 const incident=target.closest('.row[data-id]');
 if(incident)add(id,incident.dataset.id);
 else if(target.closest('#units,[data-panel="units"]'))release(id);
},true);
})();
