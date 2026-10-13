/* Shared incident field command. UI/voice callers use the same validation.
 * Persistence and event logging are injected by the local adapter.
 * The Supabase implementation will validate again on the server.
 */
(()=>{'use strict';
 function updateFields({state,id,updates,source='DISPATCH',event,save}){
  const incident=state.incidents.find(x=>x.id===id);
  if(!incident||incident.status==='CLOSED')return {ok:false,message:'Active event not found'};
  if(!updates||typeof updates!=='object'||Array.isArray(updates))return {ok:false,message:'Invalid field updates'};
  const allowed=['type','priority','agency','discipline','caller','phone'];
  for(const key of allowed)if(Object.hasOwn(updates,key)){
   const next=String(updates[key]??'').trim();
   if(['type','priority','agency','discipline'].includes(key)&&!next)return {ok:false,message:key+' is required'};
   if(key==='priority'&&!/^P[1-5]$/.test(next))return {ok:false,message:'Priority must be P1 through P5'};
   if(key==='discipline'&&!['LAW','FIRE','EMS'].includes(next))return {ok:false,message:'Invalid discipline'};
  }
  for(const key of allowed)if(Object.hasOwn(updates,key)){
   const next=String(updates[key]??'').trim();
   if(String(incident[key]??'')!==next){
    event(incident,'FIELD_CHANGED '+key.toUpperCase()+' FROM '+String(incident[key]??'')+' TO '+next+' VIA '+source);
    incident[key]=next;
   }
  }
  if(typeof updates.narrative==='string'&&updates.narrative.trim()){
   const note=updates.narrative.trim();
   incident.narrative ||= [];
   incident.narrative.push(note);
   event(incident,'NARRATIVE_ADDED VIA '+source+' '+note);
  }
  save();
  return {ok:true,message:'Event updated'};
 }
 window.CadIncidentCommands=Object.freeze({updateFields});
})();
