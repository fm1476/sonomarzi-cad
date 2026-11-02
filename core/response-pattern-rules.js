/* Pure response-pattern eligibility: agency-local schedules and geographic hierarchy. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.CadResponsePatternRules=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const n=x=>String(x??'').trim().toUpperCase();
const validClock=x=>typeof x==='string'&&/^([01]\\d|2[0-3]):[0-5]\\d$/.test(x);
function clock(x){const [h,m]=x.split(':').map(Number);return h*60+m}
function localParts(timestamp,timeZone){
 const date=new Date(timestamp);
 if(!Number.isFinite(date.valueOf()))return null;
 try{
  const vals=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone,weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date).map(p=>[p.type,p.value]));
  return {day:['SUN','MON','TUE','WED','THU','FRI','SAT'].indexOf(n(vals.weekday)),minutes:Number(vals.hour)*60+Number(vals.minute)};
 }catch{return null}
}
function matches(pattern,incident){
 if(!pattern)return true;
 const geography=pattern.geography||{};
 if(geography.dispatchArea&&n(geography.dispatchArea)!==n(incident.dispatch_area||incident.dispatchArea))return false;
 const sub=geography.subdivisions||[];
 if(sub.length>5||sub.some((value,i)=>value&&n(value)!==n((incident.subdivisions||[])[i])))return false;
 if(sub.some(Boolean)&&!geography.dispatchArea)return false;
 const s=pattern.schedule||{};
 const hasSchedule=s.days?.length||s.startTime||s.endTime;
 if(s.activeFrom||s.expiresAt||hasSchedule){
  const instant=new Date(incident.occurred_at||incident.created_at||incident.timestamp||'').getTime();
  if(!Number.isFinite(instant))return false;
  if(s.activeFrom&&(!Number.isFinite(Date.parse(s.activeFrom))||instant<Date.parse(s.activeFrom)))return false;
  if(s.expiresAt&&(!Number.isFinite(Date.parse(s.expiresAt))||instant>=Date.parse(s.expiresAt)))return false;
  if(hasSchedule){
   if(!s.timeZone||!validClock(s.startTime)||!validClock(s.endTime))return false;
   const local=localParts(instant,s.timeZone);if(!local||local.day<0)return false;
   const start=clock(s.startTime),end=clock(s.endTime);
   if(start===end)return false; // explicit 24-hour patterns require no clock range
   const dayKeys=['SUN','MON','TUE','WED','THU','FRI','SAT'];
   const permitted=new Set((s.days||dayKeys).map(n));
   if(start<end){if(local.minutes<start||local.minutes>=end||!permitted.has(dayKeys[local.day]))return false}
   else if(local.minutes>=start){if(!permitted.has(dayKeys[local.day]))return false}
   else if(local.minutes<end){if(!permitted.has(dayKeys[(local.day+6)%7]))return false}
   else return false;
  }
 }
 return true
}
function specificity(pattern){
 const g=pattern?.geography||{},s=pattern?.schedule||{};
 return [g.dispatchArea?1:0,(g.subdivisions||[]).filter(Boolean).length,s.days?.length?1:0,s.startTime&&s.endTime?1:0,s.activeFrom||s.expiresAt?1:0]
}
return Object.freeze({matches,specificity,localParts});
});
