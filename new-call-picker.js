/* Isolated new-call agency and CFS picker, survives unrelated CAD view failures. */
(()=>{
'use strict';
const A=document.getElementById('agency'),T=document.getElementById('type'),D=document.getElementById('discipline');
if(!A||!T||!D)return;
const defaults={agencies:['Petaluma Police','Sonoma County Sheriff','Petaluma Fire / EMS','REDCOM'],types:{LAW:['Traffic Stop','Domestic','Suspicious Person','Alarm','Traffic Collision','Welfare Check','Disturbance','Unwanted Subject','Burglary Alarm'],FIRE:['Structure Fire','Vegetation Fire','Vehicle Fire','Alarm','Hazard'],EMS:['Medical Aid','Cardiac Arrest','Fall','Overdose','Traffic Collision']}};
const read=(key)=>{try{return JSON.parse(localStorage.getItem(key)||'null')}catch{return null}};
const unique=arr=>[...new Set(arr.filter(x=>typeof x==='string'&&x.trim()).map(x=>x.trim()))];
const safe=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function agencies(){
 const cfg=read('smcad-config-v1')||{},state=window.cadSafetyState?.()||read('smcad-poc-v1')||{};
 const names=[...defaults.agencies,...(Array.isArray(cfg.agencies)?cfg.agencies:[]),...(state.incidents||[]).map(x=>x.agency),...(state.units||[]).map(x=>x.agency)];
 try{for(const a of window.CadAgencyMaster?.read(localStorage)?.agencies||[])names.push(a.name)}catch{}
 return unique(names);
}
function cfs(){
 const cfg=read('smcad-config-v1')||{};
 const arr=[...(defaults.types[D.value]||[]),...(Array.isArray(cfg.types?.[D.value])?cfg.types[D.value]:[])];
 const state=window.cadSafetyState?.()||read('smcad-poc-v1')||{};
 for(const i of state.incidents||[])if(i.discipline===D.value&&i.type)arr.push(i.type);
 return unique(arr).sort((a,b)=>a.localeCompare(b));
}
function refreshAgencies(){
 const options=agencies(),prior=A.value;
 A.innerHTML=options.map(n=>'<option value="'+safe(n)+'">'+safe(n)+'</option>').join('');
 A.value=options.includes(prior)?prior:'Petaluma Police';
}
const old=T;
const wrap=document.createElement('div');wrap.className='cad-cfs-combo';
const input=document.createElement('input');input.id='type';input.autocomplete='off';input.placeholder='Search code or description…';input.setAttribute('role','combobox');input.setAttribute('aria-expanded','false');input.setAttribute('aria-controls','cadCfsMenu');input.setAttribute('aria-autocomplete','list');input.required=true;
const clear=document.createElement('button');clear.type='button';clear.className='cad-cfs-clear';clear.textContent='×';clear.title='Clear selected CFS';clear.setAttribute('aria-label','Clear CFS');
const toggle=document.createElement('button');toggle.type='button';toggle.className='cad-cfs-toggle';toggle.textContent='⌄';toggle.setAttribute('aria-label','Show Call for Service choices');
const menu=document.createElement('div');menu.id='cadCfsMenu';menu.className='cad-cfs-menu';menu.setAttribute('role','listbox');menu.hidden=true;
old.replaceWith(wrap);wrap.append(input,clear,toggle,menu);
let values=[],active=0,selected='';
function close(){menu.hidden=true;input.setAttribute('aria-expanded','false')}
function choose(v){selected=v;input.value=v;close();input.dispatchEvent(new Event('change',{bubbles:true}))}
function draw(){
 const q=input.value.trim().toLocaleLowerCase(),matches=values.filter(v=>v.toLocaleLowerCase().includes(q));
 if(active>=matches.length)active=0;
 menu.innerHTML='';
 if(!matches.length){const empty=document.createElement('div');empty.className='cad-cfs-empty';empty.textContent='No matching CFS types';menu.append(empty)}
 matches.forEach((v,i)=>{const row=document.createElement('div');row.className='cad-cfs-option'+(i===active?' active':'');row.setAttribute('role','option');row.setAttribute('aria-selected',String(v===selected));row.textContent=v;row.onmousedown=e=>{e.preventDefault();choose(v)};menu.append(row)});
 menu.hidden=false;input.setAttribute('aria-expanded','true');
 if(matches[active])menu.children[active].scrollIntoView({block:'nearest'});
 return matches;
}
function refreshCfs(){values=cfs();if(selected&&!values.includes(selected)){selected='';input.value=''};if(!menu.hidden)draw()}
input.addEventListener('focus',()=>{active=0;draw()});
input.addEventListener('input',()=>{selected='';active=0;draw()});
input.addEventListener('keydown',e=>{
 if(e.key==='Escape'){close();return}
 if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();const matches=draw();active=(active+(e.key==='ArrowDown'?1:-1)+matches.length)%Math.max(matches.length,1);draw();return}
 if(e.key==='Enter'&&!menu.hidden){const matches=values.filter(v=>v.toLocaleLowerCase().includes(input.value.trim().toLocaleLowerCase()));if(matches.length){e.preventDefault();choose(matches[active]||matches[0])}else close()}
});
input.addEventListener('blur',()=>setTimeout(close,100));
toggle.onclick=()=>{if(menu.hidden){input.focus();active=0;draw()}else close()};
clear.onclick=()=>{selected='';input.value='';input.focus();active=0;draw()};
D.addEventListener('change',()=>{selected='';input.value='';refreshCfs()});
A.addEventListener('change',()=>{selected='';input.value='';refreshCfs()});
window.cadRefreshNewCallOptions=()=>{refreshAgencies();refreshCfs()};
refreshAgencies();refreshCfs();
window.addEventListener('storage',()=>{refreshAgencies();refreshCfs()});
document.addEventListener('mousedown',e=>{if(!wrap.contains(e.target))close()});
document.getElementById('cadCTNewCall')?.addEventListener('click',()=>{refreshAgencies();refreshCfs()});
})();
