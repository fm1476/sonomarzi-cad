/* CAD freeform workspace: visual coordinates only, never CAD transactions. */
(()=>{
'use strict';
if(new URLSearchParams(location.search).has('panel')) return;
const main=document.getElementById('dispatch'), stage=main?.querySelector(':scope > .grid');
if(!stage)return;
const KEY='smcad-freeform-v16.9';
const definitions=[
 ['pending','Pending Calls','[data-panel="pending"]',12,10,390,360],
 ['active','Active Incidents','[data-panel="active"]',414,10,545,420],
 ['units','Unit Status','[data-panel="units"]',971,10,355,390],
 ['detail','Incident Detail','[data-panel="detail"]',12,440,545,410],
 ['map','Operational Map','[data-panel="map"]',569,450,520,400],
 ['workspace','Workspace Layout','.cad-workspace-toolbar',1101,420,460,230],
 ['command','Command Line','.cad-smart-command',12,875,950,135],
 ['results','Command Results','.cad-command-results',975,875,460,190],
 ['assistant','Board Intelligence','.cad-board-assistant',12,1030,720,340],
 ['voice','Voice Intelligence','.voice-panel',750,1080,750,330]
];
let saved={};try{saved=JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch{}
const nodes=new Map();let maxZ=5;let pendingSave=0;

stage.classList.add('cad-freeform');
function store(){const data={};for(const [id,el] of nodes){const r=el.getBoundingClientRect(),g=stage.getBoundingClientRect();data[id]={x:Math.round(r.left-g.left),y:Math.round(r.top-g.top),w:Math.round(r.width),h:Math.round(r.height),z:Number(el.style.zIndex)||1};}localStorage.setItem(KEY,JSON.stringify(data));}
function delayedStore(){cancelAnimationFrame(pendingSave);pendingSave=requestAnimationFrame(store)}
function clamp(v,min,max){return Math.min(max,Math.max(min,v))}
function totalHeight(){let bottom=900;for(const el of nodes.values())bottom=Math.max(bottom,el.offsetTop+el.offsetHeight+24);stage.style.minHeight=bottom+'px';}
function constrain(el){const width=Math.max(320,stage.clientWidth);const w=clamp(el.offsetWidth,270,Math.max(270,width));el.style.width=w+'px';el.style.left=clamp(el.offsetLeft,0,Math.max(0,width-w))+'px';el.style.top=Math.max(0,el.offsetTop)+'px'}
function apply(id,el,x,y,w,h,z){const r=saved[id]||{};Object.assign(el.style,{left:Math.max(0,Number(r.x??x))+'px',top:Math.max(0,Number(r.y??y))+'px',width:Math.max(270,Number(r.w??w))+'px',height:Math.max(id==='command'?105:135,Number(r.h??h))+'px',zIndex:String(Number(r.z??z)||2)});maxZ=Math.max(maxZ,Number(el.style.zIndex));}
function layoutDefault(){const area=Math.max(1120,stage.clientWidth);const scale=area/1580;return Math.min(1,scale)}
function activate(el){el.style.zIndex=String(++maxZ)}
function bindDrag(el,handle){handle.classList.add('cad-freeform-handle');handle.title='Drag to move this pane anywhere on the canvas';
 let start=null;
 handle.addEventListener('pointerdown',e=>{
  if(e.button!==0||e.target.closest('button,select,input,textarea,label,a,[draggable],.cad-freeform-resizer,.cad-suggestions'))return;
  start={id:e.pointerId,x:e.clientX,y:e.clientY,left:el.offsetLeft,top:el.offsetTop};activate(el);handle.setPointerCapture(e.pointerId);e.preventDefault();
 });
 handle.addEventListener('pointermove',e=>{if(!start||e.pointerId!==start.id)return;const dx=e.clientX-start.x,dy=e.clientY-start.y;el.style.left=clamp(start.left+dx,0,Math.max(0,stage.clientWidth-el.offsetWidth))+'px';el.style.top=Math.max(0,start.top+dy)+'px';totalHeight();});
 const finish=()=>{if(!start)return;start=null;totalHeight();delayedStore();};handle.addEventListener('pointerup',finish);handle.addEventListener('pointercancel',finish);
}
function bindResize(el){const grip=document.createElement('div');grip.className='cad-freeform-resizer';grip.title='Drag to resize this pane horizontally and vertically';grip.setAttribute('aria-label','Resize panel');el.append(grip);
 let drag=null;
 grip.addEventListener('pointerdown',e=>{if(e.button!==0)return;drag={id:e.pointerId,x:e.clientX,y:e.clientY,w:el.offsetWidth,h:el.offsetHeight};activate(el);grip.setPointerCapture(e.pointerId);e.preventDefault();e.stopPropagation()});
 grip.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;el.style.width=clamp(drag.w+e.clientX-drag.x,270,Math.max(270,stage.clientWidth-el.offsetLeft))+'px';el.style.height=Math.max(el.classList.contains('cad-smart-command')?105:135,drag.h+e.clientY-drag.y)+'px';totalHeight();if(el.dataset.panel==='map')window.cadInvalidateMapSize?.();});
 const finish=()=>{if(!drag)return;drag=null;if(el.dataset.panel==='map')window.cadInvalidateMapSize?.();delayedStore();};grip.addEventListener('pointerup',finish);grip.addEventListener('pointercancel',finish);
}
// Prevent the legacy fixed-placement selector and old resize handles from competing with freeform controls.
const oldSelect=document.getElementById('commandPlacement');if(oldSelect){oldSelect.value='top';oldSelect.disabled=true;oldSelect.title='Free workspace layout controls position instead';}
for(const [id,label,selector,x,y,w,h] of definitions){
 const el=document.querySelector(selector);if(!el)continue;
 if(id==='command')el.classList.remove('cad-command-floating');
 stage.append(el);nodes.set(id,el);el.classList.add('cad-freeform-window');el.dataset.freeWindow=id;
 // Existing rendering/board DnD remains available; only the noninteractive heading area moves the pane.
 let handle=id==='workspace'?el.querySelector('strong'):id==='command'?document.getElementById('cadCommandHandle'):el.querySelector('h2,.cad-result-header,.voice-heading');
 if(!handle){handle=document.createElement('div');handle.className='cad-freeform-title';handle.textContent=label;el.prepend(handle);}
 if(id==='workspace'){const bar=document.createElement('div');bar.className='cad-freeform-title';bar.textContent='⠿ Workspace Layout';el.prepend(bar);handle=bar;}
 if(id==='command')el.querySelector('.cad-command-draglabel')?.remove();
 const scale=layoutDefault();apply(id,el,Math.round(x*scale),y,Math.round(w*scale),h,2);
 if(id==='command'){
  // Drag from any unused command-pane surface, not only the tiny COMMAND label.
  // Input and Execute remain interactive; the resize grip is separately handled.
  bindDrag(el,el);
  el.classList.add('cad-command-grab-surface');
  handle.title='Drag the empty command bar area to move this pane';
 }else bindDrag(el,handle);
 bindResize(el);
}
function restoreDefaults(){saved={};for(const [id,label,sel,x,y,w,h] of definitions){const el=nodes.get(id);if(!el)continue;const scale=layoutDefault();apply(id,el,Math.round(x*scale),y,Math.round(w*scale),h,2);constrain(el);}totalHeight();store();window.renderMap?.();}

for(const el of nodes.values())constrain(el);totalHeight();
window.addEventListener('resize',()=>{for(const el of nodes.values())constrain(el);totalHeight()});
// Force initial tile repaint after moving map into a positioned container.
setTimeout(()=>window.renderMap?.(),250);
})();
