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
 '<h5>Build the response — drag resources into the assignment</h5><div class="cad-alarm-builder"><div><strong>Resource palette</strong><p>Drag or click to add</p><div id="almPalette" class="cad-alarm-palette"></div></div><div class="cad-alarm-dropzone" id="almDropzone"><strong>Response assignment</strong><p>Drag tiles to reorder. Use + / − to adjust quantities.</p><div id="almResources"></div></div></div><button id="almAddResource" type="button">+ Resource</button> <button id="almSave" type="button">Save Alarm Level</button> <button id="almCancel" type="button">Clear Editor</button><p id="almMessage" role="status"></p><div id="almList"></div>';
 const resources=[];
 const typesByDisc={FIRE:['ENGINE','TRUCK','LADDER','RESCUE','BRUSH','CHIEF','TENDER','MEDIC','AMBULANCE'],EMS:['AMBULANCE','MEDIC','ENGINE','RESCUE','CHIEF','SUPERVISOR'],LAW:['PATROL','SUPERVISOR','TRAFFIC','K9','DETECTIVE','SWAT','MOTOR']};
 const symbols={ENGINE:'🚒',TRUCK:'🪜',LADDER:'🪜',RESCUE:'🚑',BRUSH:'🌲',CHIEF:'⭐',TENDER:'💧',MEDIC:'🚑',AMBULANCE:'🚑',PATROL:'🚓',SUPERVISOR:'⭐',TRAFFIC:'🚦',K9:'🐕',DETECTIVE:'🔎',SWAT:'🛡️',MOTOR:'🏍️'};
 function addType(type){const existing=resources.find(x=>x.type===type);if(existing)existing.count++;else resources.push({type,count:1});drawResources()}
 function drawPalette(){
  const disc=$('almDisc').value,masterTypes=master().units.filter(u=>u.discipline===disc).map(u=>u.resourceType).filter(Boolean);
  const types=[...new Set([...(typesByDisc[disc]||[]),...masterTypes])];
  $('almPalette').innerHTML=types.map(t=>'<button type="button" class="cad-alarm-palette-tile" draggable="true" data-palette="'+esc(t)+'"><span>'+esc(symbols[t]||'▣')+'</span>'+esc(t)+'</button>').join('');
  $('almPalette').querySelectorAll('[data-palette]').forEach(btn=>{
   btn.onclick=()=>addType(btn.dataset.palette);
   btn.ondragstart=e=>{e.dataTransfer.setData('text/plain','palette:'+btn.dataset.palette);e.dataTransfer.effectAllowed='copy'}
  });
 }
 function drawResources(){
  $('almResources').innerHTML=resources.map((r,i)=>'<div class="cad-alarm-tile" draggable="true" data-resource-index="'+i+'"><span class="cad-alarm-grip" title="Drag to reorder">⠿</span><span class="cad-alarm-symbol">'+esc(symbols[r.type]||'▣')+'</span><strong>'+esc(r.type)+'</strong><div class="cad-alarm-qty"><button type="button" data-dec="'+i+'" aria-label="Reduce '+esc(r.type)+'">−</button><span>'+esc(r.count)+'</span><button type="button" data-inc="'+i+'" aria-label="Increase '+esc(r.type)+'">+</button></div><button type="button" data-remove="'+i+'" aria-label="Remove '+esc(r.type)+'">×</button></div>').join('')||'<p class="cad-alarm-empty">Drop resource tiles here to build the assignment.</p>';
  $('almResources').querySelectorAll('[data-inc]').forEach(x=>x.onclick=()=>{resources[Number(x.dataset.inc)].count=Math.min(99,resources[Number(x.dataset.inc)].count+1);drawResources()});
  $('almResources').querySelectorAll('[data-dec]').forEach(x=>x.onclick=()=>{const i=Number(x.dataset.dec);resources[i].count=Math.max(1,resources[i].count-1);drawResources()});
  $('almResources').querySelectorAll('[data-remove]').forEach(x=>x.onclick=()=>{resources.splice(Number(x.dataset.remove),1);drawResources()});
  $('almResources').querySelectorAll('[data-resource-index]').forEach(tile=>{
   tile.ondragstart=e=>{e.dataTransfer.setData('text/plain','reorder:'+tile.dataset.resourceIndex);e.dataTransfer.effectAllowed='move'};
   tile.ondragover=e=>e.preventDefault();
   tile.ondrop=e=>{e.preventDefault();e.stopPropagation();const value=e.dataTransfer.getData('text/plain');if(value.startsWith('palette:')){addType(value.slice(8));return}if(!value.startsWith('reorder:'))return;const from=Number(value.slice(8)),to=Number(tile.dataset.resourceIndex);if(!Number.isInteger(from)||from<0||from>=resources.length||from===to)return;resources.splice(to,0,resources.splice(from,1)[0]);drawResources()};
  });
 }
 const drop=$('almDropzone');
 drop.ondragover=e=>{e.preventDefault();drop.classList.add('is-over')};
 drop.ondragleave=e=>{if(!drop.contains(e.relatedTarget))drop.classList.remove('is-over')};
 drop.ondrop=e=>{e.preventDefault();drop.classList.remove('is-over');const value=e.dataTransfer.getData('text/plain');if(value.startsWith('palette:'))addType(value.slice(8))};
 function drawList(){
  $('almList').innerHTML='<h5>Configured alarm levels ('+configs.length+')</h5>'+configs.map(c=>'<div class="cad-alarm-entry"><strong>'+esc(c.agency)+' · '+esc(c.callType)+' · '+esc(c.name)+'</strong> · '+esc(c.mode)+' · Sequence '+c.rank+'<div>'+c.resources.map(r=>esc(r.count+' × '+r.type)).join(' · ')+'</div><button data-edit="'+esc(c.id)+'">Edit</button> <button data-delete="'+esc(c.id)+'">Delete</button></div>').join('')||'<p>No alarm levels configured yet.</p>';
  $('almList').querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>{const c=configs.find(x=>x.id===b.dataset.edit);if(!c)return;currentId=c.id;$('almAgency').value=c.agency;$('almDisc').value=c.discipline;$('almCallType').value=c.callType;$('almName').value=c.name;$('almRank').value=c.rank;$('almMode').value=c.mode;resources.splice(0,resources.length,...c.resources.map(x=>({...x})));drawResources();$('almMessage').textContent='Editing '+c.name});
  $('almList').querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>{if(!confirm('Delete this local alarm level?'))return;configs=configs.filter(x=>x.id!==b.dataset.delete);localStorage.setItem(KEY,JSON.stringify(configs));drawList()});
 }
 function updateTypes(){const cfg=read('smcad-config-v1',{});const d=$('almDisc').value;const types=[...new Set([...(cfg.types?.[d]||[]),...plans().filter(p=>p.discipline===d).map(p=>p.type)])];$('almCallTypes').innerHTML=types.map(x=>'<option>'+esc(x)+'</option>').join('')}
 $('almDisc').onchange=()=>{updateTypes();drawPalette()};updateTypes();drawPalette();drawResources();drawList();
 $('almAddResource').onclick=()=>addType((typesByDisc[$('almDisc').value]||['ENGINE'])[0]);
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