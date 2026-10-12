// v16.8 detachable CAD panels. Main pane becomes a restore slot rather than a duplicate.
(()=>{
'use strict';
const key='smcad-workspace-popouts-v16.6',activeKey='smcad-active-popouts-v16.8';
const available={pending:'Pending Calls',active:'Active Incidents',units:'Unit Status',detail:'Incident Detail',map:'Operational Map',command:'Command Line',voice:'Voice Intelligence',assistant:'CAD Board Intelligence'};
const params=new URLSearchParams(location.search),detached=params.get('panel');
const valid=Object.prototype.hasOwnProperty.call(available,detached);
const read=k=>{try{return JSON.parse(localStorage.getItem(k)||'[]')}catch{return []}};
const write=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
function mark(id,on){const list=read(activeKey).filter(x=>x!==id);if(on)list.push(id);write(activeKey,list)}
function remember(id){const ids=read(key);if(!ids.includes(id)){ids.push(id);write(key,ids)}}
if(valid){
 document.body.classList.add('cad-detached','cad-detached-'+detached);
 const panel=document.querySelector('[data-panel="'+detached+'"]');panel?.classList.add('cad-detached-target');
 if(panel)panel.style.setProperty('display','flex','important');
 document.title=available[detached]+' | SonoMarzi CAD';
 // A manually closed window restores the pane in the original console.
 window.addEventListener('pagehide',()=>mark(detached,false));
 return;
}
const existing=new Map();
function refresh(){const open=read(activeKey);for(const [id,name] of Object.entries(available)){
  const panel=document.querySelector('[data-panel="'+id+'"]');
  const external={command:document.querySelector('.cad-smart-command'),voice:document.querySelector('.voice-panel'),assistant:document.querySelector('.cad-board-assistant')}[id];
  const el=panel||external;if(!el)continue;
  const isOpen=open.includes(id);el.classList.toggle('cad-popped',isOpen);
  let placeholder=el.querySelector(':scope > .cad-pop-placeholder');
  if(isOpen&&!placeholder){placeholder=document.createElement('div');placeholder.className='cad-pop-placeholder';
   const desc=document.createElement('span');desc.textContent=name+' is open in another window.';
   const btn=document.createElement('button');btn.type='button';btn.textContent='Return to this workspace';btn.addEventListener('click',()=>{const w=existing.get(id);if(w&&!w.closed)w.close();mark(id,false);refresh()});
   placeholder.append(desc,btn);el.append(placeholder);
  }else if(!isOpen&&placeholder)placeholder.remove();
 }}
function openPanel(id){if(!available[id])return;const url=new URL(location.href);url.searchParams.set('panel',id);
 const w=window.open(url.toString(),'CAD_POPOUT_'+id,'popup=yes,width=900,height=700,resizable=yes,scrollbars=yes');
 if(!w){alert('Allow pop-ups for this CAD site and try again.');return}
 existing.set(id,w);mark(id,true);remember(id);refresh();w.focus();
 const timer=setInterval(()=>{if(w.closed){clearInterval(timer);existing.delete(id);mark(id,false);refresh()}},1000);
}
// One compact launcher in Workspace Layout replaces the per-pane Pop Out buttons.
const launcher=document.getElementById('cadExternalPanel');
if(launcher){for(const [id,name] of Object.entries(available))launcher.add(new Option(name,id));}
document.getElementById('cadExternalOpen')?.addEventListener('click',()=>{const id=launcher?.value;if(!id)return alert('Select a pane to open in another browser window.');openPanel(id)});
document.getElementById('cadOpenSavedWindows')?.addEventListener('click',()=>{const ids=read(key).filter(x=>available[x]);if(!ids.length)return alert('No saved pop-out panels.');ids.forEach(openPanel)});
window.addEventListener('storage',e=>{if(e.key===activeKey)refresh()});
// Recover stale pop-out state after a browser restart.
write(activeKey,[]);refresh();
})();
