/* Browser-local alarm-level configuration and read-only escalation recommendations. */
(()=>{'use strict';
const KEY='smcad-alarm-levels-v1',PLAN_KEY='smcad-response-plans-v1';
const $=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const read=(key,fallback)=>{try{const v=JSON.parse(localStorage.getItem(key)||'null');return v??fallback}catch{return fallback}};
const defaults=['First Alarm','Working Fire','Second Alarm','Third Alarm'];
let configs=read(KEY,[]),currentId='',preview=null;
const master=()=>{try{return window.CadAgencyMaster?.read(localStorage)||{agencies:[],units:[]}}catch{return {agencies:[],units:[]}}};
const agencyNames=()=>[...new Set([...master().agencies.map(a=>a.name),...(window.cadSafetyState?.().units||[]).map(u=>u.agency)])].filter(Boolean);
const plans=()=>read(PLAN_KEY,[]);
function resolve(incident,level){
 const matches=plans().filter(p=>p.status==='Published'&&p.discipline===incident.discipline&&p.type===incident.type&&p.level===level&&(!p.agency||p.agency===incident.agency));
 const zone=String(incident.responseZone||incident.zone||'').trim();
 return matches.find(p=>zone&&p.zone===zone)||matches.find(p=>p.zone==='DEFAULT'||p.zone==='*')||null;
}
function matching(incident){
 return configs.filter(c=>c.agency===incident.agency&&c.discipline===incident.discipline&&c.callType===incident.type).sort((a,b)=>a.rank-b.rank);
}
function calculate(incident,target){
 const levels=matching(incident),entry=levels.find(c=>c.id===target);
 if(!entry)return {error:'No matching alarm level configuration for this agency and call type.'};
 const current=levels.find(c=>c.name===(incident.alarmLevel||''));const previous=current?.rank??-1;
 if(previous>=entry.rank)return {error:'Choose a higher alarm level for escalation. Lowering levels requires a separate review workflow.'};
 const plan=resolve(incident,entry.name);
 let needs={};
 if(entry.mode==='ADDITIVE'){
  const applicable=levels.filter(c=>c.rank>previous&&c.rank<=entry.rank);
  for(const level of applicable)for(const r of level.resources||[])needs[r.type]=(needs[r.type]||0)+Number(r.count||0);
 }else{
  for(const r of entry.resources||[])needs[r.type]=(needs[r.type]||0)+Number(r.count||0);
  if(entry.mode==='TOTAL'){
   const units=window.cadSafetyState?.().units||[],definitions=master().units;
   for(const id of incident.units||[]){
    const u=units.find(x=>x.id===id);if(!u)continue;
    const def=definitions.find(d=>d.id===u.masterUnitId||d.designator===u.id&&master().agencies.some(a=>a.id===d.agencyId&&a.name===u.agency));
    const type=def?.resourceType||(/^[E][0-9]/i.test(id)?'ENGINE':/^[T][0-9]/i.test(id)?'TRUCK':/^[M][0-9]/i.test(id)?'AMBULANCE':null);
    if(type&&needs[type])needs[type]=Math.max(0,needs[type]-1);
   }
  }
 }
 return {entry,plan,needs:Object.entries(needs).filter(([,n])=>n>0).map(([type,count])=>({type,count})),previous};
}
function renderConfig(){
 const host=$('cadAlarmManager');if(!host)return;
 const agencies=agencyNames();
 host.innerHTML='<h4>Alarm Level Manager</h4><p>Browser-local configuration. These are example rules until your agency validates them. Saving does not dispatch units.</p>'+
 '<div class="cad-alarm-form"><label>Agency<select id="almAgency">'+agencies.map(a=>'<option>'+esc(a)+'</option>').join('')+'</select></label>'+
 '<label>Discipline<select id="almDisc"><option>FIRE</option><option>EMS</option><option>LAW</option></select></label>'+
 '<label>Call type<input id="almCallType" list="almCallTypes" placeholder="Structure Fire"></label><datalist id="almCallTypes"></datalist>'+
 '<label>Level name<input id="almName" list="almNames" placeholder="First Alarm"></label><datalist id="almNames">'+defaults.map(x=>'<option>'+esc(x)+'</option>').join('')+'</datalist>'+
 '<label>Sequence (1 = first)<input id="almRank" type="number" min="1" max="20" value="1"></label>'+
 '<label>Escalation mode<select id="almMode"><option value="ADDITIVE">Add resources</option><option value="TOTAL">Total target</option><option value="REPLACEMENT">Replacement recommendation (review only)</option></select></label></div>'+
 '<h5>Resources required at this level</h5><div id="almResources"></div><button id="almAddResource" type="button">+ Resource</button> <button id="almSave" type="button">Save Alarm Level</button> <button id="almCancel" type="button">Clear Editor</button><p id="almMessage" role="status"></p><div id="almList"></div>';
 const resources=[{type:'ENGINE',count:1}];
 function drawResources(){
  $('almResources').innerHTML=resources.map((r,i)=>'<div class="cad-alarm-resource"><label>Type<input data-type="'+i+'" value="'+esc(r.type)+'" placeholder="ENGINE"></label><label>Quantity<input data-count="'+i+'" type="number" min="1" max="99" value="'+esc(r.count)+'"></label><button data-remove="'+i+'" type="button">Remove</button></div>').join('');
  $('almResources').querySelectorAll('[data-type]').forEach(x=>x.oninput=()=>resources[Number(x.dataset.type)].type=x.value.toUpperCase().trim());
  $('almResources').querySelectorAll('[data-count]').forEach(x=>x.oninput=()=>resources[Number(x.dataset.count)].count=Number(x.value));
  $('almResources').querySelectorAll('[data-remove]').forEach(x=>x.onclick=()=>{resources.splice(Number(x.dataset.remove),1);drawResources()});
 }
 function drawList(){
  $('almList').innerHTML='<h5>Configured alarm levels ('+configs.length+')</h5>'+configs.map(c=>'<div class="cad-alarm-entry"><strong>'+esc(c.agency)+' · '+esc(c.callType)+' · '+esc(c.name)+'</strong> · '+esc(c.mode)+' · Sequence '+c.rank+'<div>'+c.resources.map(r=>esc(r.count+' × '+r.type)).join(' · ')+'</div><button data-edit="'+esc(c.id)+'">Edit</button> <button data-delete="'+esc(c.id)+'">Delete</button></div>').join('')||'<p>No alarm levels configured yet.</p>';
  $('almList').querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>{const c=configs.find(x=>x.id===b.dataset.edit);if(!c)return;currentId=c.id;$('almAgency').value=c.agency;$('almDisc').value=c.discipline;$('almCallType').value=c.callType;$('almName').value=c.name;$('almRank').value=c.rank;$('almMode').value=c.mode;resources.splice(0,resources.length,...c.resources.map(x=>({...x})));drawResources();$('almMessage').textContent='Editing '+c.name});
  $('almList').querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>{if(!confirm('Delete this local alarm level?'))return;configs=configs.filter(x=>x.id!==b.dataset.delete);localStorage.setItem(KEY,JSON.stringify(configs));drawList()});
 }
 function updateTypes(){const cfg=read('smcad-config-v1',{});const d=$('almDisc').value;const types=[...new Set([...(cfg.types?.[d]||[]),...plans().filter(p=>p.discipline===d).map(p=>p.type)])];$('almCallTypes').innerHTML=types.map(x=>'<option>'+esc(x)+'</option>').join('')}
 $('almDisc').onchange=updateTypes;updateTypes();drawResources();drawList();
 $('almAddResource').onclick=()=>{resources.push({type:'ENGINE',count:1});drawResources()};
 $('almCancel').onclick=()=>{currentId='';renderConfig()};
 $('almSave').onclick=()=>{
  const c={id:currentId||crypto.randomUUID(),agency:$('almAgency').value,discipline:$('almDisc').value,callType:$('almCallType').value.trim(),name:$('almName').value.trim(),rank:Number($('almRank').value),mode:$('almMode').value,resources:resources.map(x=>({...x})),savedAt:new Date().toISOString()};
  if(!c.agency||!c.callType||!c.name||!Number.isInteger(c.rank)||c.rank<1||c.rank>20||!c.resources.length||c.resources.some(r=>!r.type||!Number.isInteger(r.count)||r.count<1||r.count>99))return $('almMessage').textContent='Complete the agency, call type, level, sequence and valid resources.';
  if(configs.some(x=>x.id!==c.id&&x.agency===c.agency&&x.discipline===c.discipline&&x.callType===c.callType&&(x.name===c.name||x.rank===c.rank)))return $('almMessage').textContent='A level with that name or sequence already exists for this agency/call type.';
  configs=configs.filter(x=>x.id!==c.id).concat(c);localStorage.setItem(KEY,JSON.stringify(configs));currentId='';renderConfig();$('almMessage').textContent='Alarm level saved locally. No incident or unit status changed.';
 };
}
function renderIncident(incident){
 if(!incident||incident.status==='CLOSED')return '';
 const levels=matching(incident).filter(c=>c.rank>(matching(incident).find(x=>x.name===incident.alarmLevel)?.rank??-1));
 if(!levels.length)return '';
 return '<div class="cad-alarm-incident"><strong>Alarm Level: '+esc(incident.alarmLevel||'Not set')+'</strong><label>Propose escalation<select id="cadAlarmTarget"><option value="">Choose level…</option>'+levels.map(c=>'<option value="'+esc(c.id)+'">'+esc(c.name)+'</option>').join('')+'</select></label><button id="cadAlarmPreview" type="button">Preview Additional Response</button><div id="cadAlarmProposal" role="status"></div></div>';
}
function bindIncident(incident){
 const btn=$('cadAlarmPreview');if(!btn)return;
 btn.onclick=()=>{
  const result=calculate(incident,$('cadAlarmTarget').value),host=$('cadAlarmProposal');preview=null;
  if(result.error){host.textContent=result.error;return}
  const {entry,needs,plan}=result;
  const warning=entry.mode==='REPLACEMENT'?'Replacement is a recommendation only; no existing units are removed.':'';
  host.innerHTML='<p><strong>'+esc(entry.name)+'</strong> · '+esc(entry.mode)+'</p><p>Additional resources: '+(needs.map(r=>esc(r.count+' '+r.type)).join(', ')||'No additional resources required')+'</p><p>Matching published response plan: '+(plan?esc(plan.zone+' / '+plan.type):'None found — unit recommendation cannot be calculated yet')+'</p><p>'+esc(warning)+'</p><p>No apparatus will be dispatched automatically. This action only records an alarm level change.</p><button id="cadAlarmConfirm" type="button">Confirm Alarm Level (No Dispatch)</button>';
  preview={incidentId:incident.id,levelId:entry.id};
  $('cadAlarmConfirm').onclick=()=>{
   if(!preview||preview.incidentId!==incident.id||preview.levelId!==entry.id)return;
   if(!confirm('Record escalation to '+entry.name+'? This does NOT dispatch units.'))return;
   const state=window.cadSafetyState?.();const live=state?.incidents?.find(i=>i.id===incident.id);
   if(!live||live.status==='CLOSED')return host.textContent='Incident is no longer eligible.';
   const again=calculate(live,entry.id);if(again.error)return host.textContent=again.error;
   live.alarmLevel=entry.name;live.alarmHistory??=[];live.alarmHistory.push({level:entry.name,mode:entry.mode,time:new Date().toISOString(),needs:again.needs});
   live.events??=[];live.events.push(new Date().toLocaleTimeString('en-US',{hour12:false})+' ALARM_LEVEL_CHANGED '+entry.name+' (NO DISPATCH)');
   window.cadCallTakeSave?.();preview=null;
  };
 };
}
window.CadAlarmLevels={renderConfig,renderIncident,bindIncident,calculate};
function init(){const host=$('cadResponseDesigner');if(!host)return;const mount=document.createElement('section');mount.id='cadAlarmManager';mount.className='cad-alarm-manager';host.insertAdjacentElement('beforebegin',mount);renderConfig()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();