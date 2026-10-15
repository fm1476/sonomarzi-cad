/* CAD hackathon operations control desk. Does not use AI to mutate CAD state. */
(()=>{
const $=id=>document.getElementById(id);const info=msg=>{$('opsInfo').textContent=msg;};
let chosenIncident=null,chosenUnit=null;
function availableIncidents(){return state.incidents.filter(i=>i.status!=='CLOSED');}
function refresh(){
 const incidents=availableIncidents();const selected=incidents.find(i=>i.id===chosenIncident)||incidents.find(i=>i.id===state.selected)||incidents[0];chosenIncident=selected?.id||null;
 $('opsIncident').innerHTML=incidents.map(i=>`<option value="${i.id}">${i.id} | ${i.type} | ${i.location}</option>`).join('');$('opsIncident').value=chosenIncident||'';
 $('opsUnit').innerHTML=state.units.map(u=>`<option value="${u.id}">${u.id} | ${u.status} | ${u.agency}</option>`).join('');if(chosenUnit&&state.units.some(u=>u.id===chosenUnit))$('opsUnit').value=chosenUnit;chosenUnit=$('opsUnit').value;
 $('opsCase').value=selected?.caseNumber||'';
}
function selected(){return state.incidents.find(i=>i.id===$('opsIncident').value&&i.status!=='CLOSED');}
function unit(){return state.units.find(u=>u.id===$('opsUnit').value);}
function commit(message){save();refresh();info(message);}
async function shared(action,args,success){
 const buttons=['opsAssign','opsApplyStatus','opsRelease'].map($).filter(Boolean);
 buttons.forEach(b=>b.disabled=true);
 info('Updating shared CAD…');
 try{await window.cadSharedCommand(action,args);info(success);refresh();}
 catch(error){info('Shared CAD: '+error.message);}
 finally{buttons.forEach(b=>b.disabled=false);}
}
function sharedMode(){return window.cadSharedIsActive?.()===true;}

function detach(u,except){for(const call of state.incidents){if(call.id===except)continue;if(call.status==='ACTIVE'&&call.units.includes(u.id)){call.units=call.units.filter(id=>id!==u.id);event(call,`UNIT_REASSIGNED ${u.id} to ${except||'available'}`);}}}
$('opsIncident').onchange=()=>{chosenIncident=$('opsIncident').value;state.selected=chosenIncident;if(sharedMode())render();else save();refresh();};
$('opsUnit').onchange=()=>{chosenUnit=$('opsUnit').value;};
$('opsAssign').onclick=()=>{const i=selected(),u=unit();if(!i||!u){info('Choose an incident and unit first.');return;}if(sharedMode()){if(u.status!=='AVAILABLE'){info(u.id+' is not available.');return;}return shared('assign',{incidentId:i.id,unitId:u.id},u.id+' dispatched to '+i.id+'.');}if(u.status==='OUT_OF_SERVICE'){info('Unit is out of service. Change its status before dispatching.');return;}const existing=state.incidents.filter(x=>x.status!=='CLOSED'&&x.units.includes(u.id)&&x.id!==i.id);if(existing.length){info(`DISPATCH CONFLICT: ${u.id} assigned to ${existing.map(x=>x.id).join(', ')}. Release or preempt first.`);return;}const resolved=cadDispatchTarget(i,u);if(resolved.error){info(resolved.error);return;}const target=resolved.incident;if(target.units.includes(u.id)){info(`${u.id} already assigned to ${target.id}.`);return;}target.units.push(u.id);target.status='ACTIVE';const old=u.status;u.status='DISPATCHED';u.location=target.location;event(target,`UNIT_DISPATCHED ${u.id} ${old} -> DISPATCHED`);state.selected=target.id;chosenIncident=target.id;commit(`${u.id} dispatched to ${target.id}.${resolved.linked?' Linked to '+i.id+'.':''}`);};
$('opsApplyStatus').onclick=()=>{
 const i=selected(),u=unit(),requested=$('opsStatus').value;
 if(!u){info('Select a unit.');return;}
 if(!i){info('Select an incident before changing its operational unit status.');return;}
 if(sharedMode()){
  if(!i.units.includes(u.id)){info('Assign the unit to the incident first.');return;}
  if(['CLEAR','CLEAR_DISPOSITION','AVAILABLE'].includes(requested)){
   const disposition=requested==='CLEAR_DISPOSITION'?$('opsDisposition').value.trim():'CLEARED';
   if(!disposition){info('Enter a disposition first.');return;}
   return shared('clear',{incidentId:i.id,unitId:u.id,disposition},u.id+' cleared from '+i.id+'.');
  }
  if(requested==='AVAILABLE_ON_SCENE'){info('This status is not yet supported in shared mode.');return;}
  return shared('status',{incidentId:i.id,unitId:u.id,status:requested},u.id+' status changed to '+requested+'.');
 }
 const assigned=i.units.includes(u.id);
 const clear=requested==='CLEAR'||requested==='CLEAR_DISPOSITION';
 if(!assigned && !['AVAILABLE','OUT_OF_SERVICE'].includes(requested) && !(requested==='AT_HOSPITAL' && u.discipline==='EMS' && u.status==='TRANSPORTING')){info('Assign this unit to the incident first.');return;}
 let disposition='';
 if(requested==='CLEAR_DISPOSITION'){
  disposition=$('opsDisposition').value.trim();
  if(!disposition){info('Enter a disposition before choosing Clear with Disposition.');$('opsDisposition').focus();return;}
 }
 const old=u.status;
 if(clear){const result=clearCadUnit(i,u,disposition,'MANUAL');commit(result.message);return;}
 u.status=requested;
 if(['AVAILABLE','OUT_OF_SERVICE'].includes(requested)){i.units=i.units.filter(id=>id!==u.id);u.location=requested==='AVAILABLE'?'Available':'Out of service';if(!i.units.length){i.status='PENDING';event(i,'INCIDENT_RETURNED_PENDING NO_DISPOSITION');}}
 else u.location=i.location;
 event(i,`MANUAL_STATUS ${u.id} ${old} -> ${u.status}`);
 commit(`${u.id}: ${old} → ${u.status}.`);
};
$('opsRelease').onclick=()=>{const i=selected(),u=unit();if(!u)return;if(sharedMode()){if(!i||!i.units.includes(u.id)){info('Choose the incident currently assigned to '+u.id+'.');return;}return shared('clear',{incidentId:i.id,unitId:u.id,disposition:'CLEARED'},u.id+' released.');}let changed=false;for(const call of state.incidents){if(call.units.includes(u.id)&&call.status!=='CLOSED'){call.units=call.units.filter(id=>id!==u.id);event(call,`UNIT_RELEASED ${u.id}`);changed=true;}}u.status='AVAILABLE';u.location='Available';commit(`${u.id} released and available${changed?' (removed from incident)':''}.`);};
$('opsAutoCase').onclick=()=>{if(sharedMode()){const i=selected();if(!i)return info('Choose an incident.');const number=String(new Date().getFullYear())+'-'+i.id.replace(/[^0-9]/g,'');return shared('case',{incidentId:i.id,caseNumber:number},'Case '+number+' assigned.');}const i=selected();if(!i){info('Select an incident first.');return;}const num=assignCaseNumber(i);commit(`Case ${num} assigned to ${i.id}.`);};
$('opsSaveCase').onclick=()=>{if(sharedMode()){const i=selected();if(!i)return info('Choose an incident.');const number=$('opsCase').value.trim().slice(0,80);return shared('case',{incidentId:i.id,caseNumber:number},'Case number saved.');}const i=selected();if(!i){info('Select an incident first.');return;}const value=$('opsCase').value.trim().slice(0,80);i.caseNumber=value;event(i,`CASE_NUMBER ${value||'CLEARED'}`);commit(`Case number ${value||'cleared'} for ${i.id}.`);};
$('opsNewCall').onclick=()=>show('calltake');
$('opsCreateUnit').onclick=()=>{if(sharedMode()){info('Adding temporary units is not yet supported in shared mode.');return;}const id=$('opsNewUnitId').value.toUpperCase().trim().replace(/\s+/g,'');if(!/^[A-Z0-9]{2,12}$/.test(id)){info('Enter a unit ID using 2–12 letters or numbers.');return;}if(state.units.some(u=>u.id===id)){info(`${id} already exists.`);return;}const agency=$('opsNewUnitAgency').value,discipline=$('opsNewUnitType').value;state.units.push({id,agency,discipline,status:'AVAILABLE',location:'Available',x:15+(state.units.length*13)%70,y:15+(state.units.length*17)%70});$('opsNewUnitId').value='';chosenUnit=id;commit(`Added demo unit ${id}.`);};
window.cadOpsSelectIncident=id=>{chosenIncident=id;refresh();};
const oldRender=render;render=function(){oldRender();if($('opsIncident'))refresh();};
refresh();
})();
