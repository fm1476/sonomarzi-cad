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
const input=document.createElement('input');
input.id='type';input.setAttribute('list','cadCfsOptions');input.setAttribute('autocomplete','off');input.setAttribute('placeholder','Start typing a Call for Service…');input.setAttribute('aria-label','Call for Service');input.required=true;
const datalist=document.createElement('datalist');datalist.id='cadCfsOptions';
old.replaceWith(input);input.after(datalist);
function refreshCfs(){const prior=input.value;datalist.innerHTML=cfs().map(n=>'<option value="'+safe(n)+'"></option>').join('');input.value=prior;}
D.addEventListener('change',()=>{input.value='';refreshCfs()});
const nativeRefresh=window.cadRefreshNewCallOptions;
window.cadRefreshNewCallOptions=()=>{refreshAgencies();refreshCfs();nativeRefresh?.()};
refreshAgencies();refreshCfs();
window.addEventListener('storage',()=>{refreshAgencies();refreshCfs()});
const newBtn=document.getElementById('cadCTNewCall');
newBtn?.addEventListener('click',()=>{refreshAgencies();refreshCfs()});
})();
