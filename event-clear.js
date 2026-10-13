/* v19.8: disposition-required incident closure, contextual clear and configuration. */
(()=>{'use strict';
const KEY='smcad-clear-dispositions-v19.8';
const defaults={LAW:['Report Taken','Advice Given','Arrest Made','Unable to Locate'],FIRE:['False Alarm','No Fire Found','Fire Extinguished','Assisted'],EMS:['Patient Transported','Patient Refusal','No Patient Found','Cancelled']};
let saved;try{saved=JSON.parse(localStorage.getItem(KEY)||'null')}catch{}
let choices=saved&&typeof saved==='object'?{...defaults,...saved}:{...defaults};
function getChoices(d){return Array.isArray(choices[d])?choices[d]:[]}
const modal=document.createElement('dialog');modal.id='cadClearDialog';modal.className='cad-clear-dialog';modal.innerHTML='<form method="dialog"><h3>Clear Event</h3><div id="cadClearSummary"></div><label for="cadClearPick">Disposition selection</label><select id="cadClearPick"></select><label for="cadClearFree">Disposition (required)</label><textarea id="cadClearFree" maxlength="500" rows="3" placeholder="Enter or select a disposition"></textarea><div class="cad-clear-actions"><button type="button" id="cadClearCancel">Cancel</button><button type="button" id="cadClearConfirm">Clear Event</button></div><p id="cadClearError" role="alert"></p></form>';
document.body.append(modal);
const $=id=>document.getElementById(id);let currentId=null;
function show(incident){if(!incident||incident.status==='CLOSED')return;currentId=incident.id;$('cadClearSummary').textContent=`${incident.id} · ${incident.type} · ${incident.location} · ${incident.units.length} assigned unit(s)`;
 $('cadClearPick').innerHTML='<option value="">Choose suggested disposition (optional)</option>';
 for(const d of getChoices(incident.discipline)){const opt=document.createElement('option');opt.value=d;opt.textContent=d;$('cadClearPick').append(opt)}
 $('cadClearFree').value='';$('cadClearError').textContent='';modal.showModal();}
window.cadShowClearEvent=show;
$('cadClearPick').onchange=()=>{if($('cadClearPick').value)$('cadClearFree').value=$('cadClearPick').value};
$('cadClearCancel').onclick=()=>modal.close();
$('cadClearConfirm').onclick=async()=>{
 const incident=state.incidents.find(i=>i.id===currentId);
 const disposition=$('cadClearFree').value.trim();
 if(!incident){$('cadClearError').textContent='Incident no longer exists. Refresh the board.';return;}
 if(!disposition){$('cadClearError').textContent='A disposition is required.';return;}
 const button=$('cadClearConfirm');
 if(window.cadSharedIsActive?.()){
  button.disabled=true;
  button.textContent='Closing in shared CAD…';
  $('cadClearError').textContent='Saving closure and releasing assigned units…';
  try{
   await window.cadSharedCommand('close',{incidentId:incident.id,disposition});
   modal.close();
  }catch(error){
   $('cadClearError').textContent='Closure not saved: '+error.message;
  }finally{button.disabled=false;button.textContent='Clear Event';}
  return;
 }
 const result=window.cadCloseEvent(incident,disposition,'CONTEXT_MENU');
 if(!result.ok){$('cadClearError').textContent=result.message;return;}
 modal.close();
};
// Delegation survives board re-renders, including grouped and sorted rows.
document.addEventListener('contextmenu',e=>{const row=e.target.closest('#pending [data-id], #activeCalls [data-id]');if(!row)return;const incident=state.incidents.find(i=>i.id===row.dataset.id);if(!incident||incident.status==='CLOSED')return;e.preventDefault();show(incident)});
const cfg=document.querySelector('#config .config');
if(cfg){const div=document.createElement('section');div.className='cad-clear-config';div.innerHTML='<h3>CAD Commands & Event Dispositions</h3><p><strong>CE</strong> clears an event: <code>CE #4525 ,report taken</code>. All event clearances require a disposition. Right-click a Pending or Active incident for the clearance dialog. The configured choices are suggestions; free text remains available.</p><div id="cadClearConfigFields"></div><button type="button" id="cadSaveClearChoices">Save disposition choices</button><span id="cadClearSaved" aria-live="polite"></span>';cfg.append(div);
 for(const discipline of ['LAW','FIRE','EMS']){const label=document.createElement('label');label.textContent=`${discipline} dispositions (one per line)`;const area=document.createElement('textarea');area.dataset.discipline=discipline;area.value=getChoices(discipline).join('\n');label.append(area);$('cadClearConfigFields').append(label)}
 $('cadSaveClearChoices').onclick=()=>{for(const area of div.querySelectorAll('textarea[data-discipline]')){choices[area.dataset.discipline]=[...new Set(area.value.split('\n').map(s=>s.trim()).filter(Boolean))].slice(0,100);}localStorage.setItem(KEY,JSON.stringify(choices));$('cadClearSaved').textContent=' Saved.';};}
})();
