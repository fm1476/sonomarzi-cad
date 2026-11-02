/* Deterministic, read-only shared-CAD response planner. Never dispatches units. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.CadResponseEngine=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const norm=v=>String(v??'').trim().toUpperCase();
const num=v=>Number.isInteger(Number(v))&&Number(v)>=0?Number(v):0;
const unique=xs=>[...new Set(xs)];
function match(plan,incident){
 if(norm(plan.status)!=='ACTIVE'&&norm(plan.status)!=='PUBLISHED')return false;
 if(plan.agencyId&&plan.agencyId!==incident.agency_id)return false;
 if(plan.discipline!==incident.discipline)return false;
 if(plan.cfsTypeId&&plan.cfsTypeId!==incident.cfs_type_id)return false;
 if(!plan.cfsTypeId&&norm(plan.type)!==norm(incident.type))return false;
 if(plan.priority!=null&&Number(plan.priority)!==Number(incident.priority))return false;
 const zone=norm(incident.response_zone||incident.zone||incident.esz||incident.beat);
 const configured=norm(plan.area||plan.zone||'');
 return !configured||configured==='DEFAULT'||configured==='*'||(zone&&configured===zone);
}
function selectPlan(plans,incident){
 const found=(plans||[]).filter(p=>match(p,incident));
 if(!found.length)return {plan:null,reason:'No active response plan matches this agency, discipline, call type, priority and response area.'};
 const rank=p=>[p.cfsTypeId?1:0,p.priority!=null?1:0,!!norm(p.area||p.zone)&&!['*','DEFAULT'].includes(norm(p.area||p.zone))?1:0].join('');
 const top=found.sort((a,b)=>rank(b).localeCompare(rank(a)));
 if(top.length>1&&rank(top[0])===rank(top[1]))return {plan:null,reason:'More than one active plan matches at the same specificity. Resolve the conflicting plans.'};
 return {plan:top[0],reason:null};
}
function recommend({plans=[],plan:explicitPlan,incident,roster=[],assignments=[],crews=[],stations=[],qualifications=[]}={}){
 if(!incident)return {status:'blocked',message:'Select an incident.',rows:[]};
 const selection=explicitPlan?{plan:explicitPlan,reason:null}:selectPlan(plans,incident);
 const plan=selection.plan;
 if(!plan)return {status:'blocked',message:selection.reason,rows:[]};
 const active=assignments.filter(a=>!a.cleared_at&&a.active!==false);
 const assignedHere=new Set(active.filter(a=>a.incident_id===incident.id).map(a=>a.unit_id));
 const assignedElsewhere=new Set(active.filter(a=>a.incident_id!==incident.id).map(a=>a.unit_id));
 const crewMembers=new Map(),crewForUnit=new Map();
 for(const crew of crews){
  const ids=unique(crew.unitIds||crew.units||[]).map(norm);
  for(const id of ids)crewForUnit.set(id,crew.id);
  crewMembers.set(crew.id,ids);
 }
 const occupiedCrews=new Set();
 for(const u of roster)if(assignedHere.has(u.id)||assignedElsewhere.has(u.id)){const c=crewForUnit.get(norm(u.call_sign||u.id));if(c)occupiedCrews.add(c)}
 const selected=new Set(),usedCrews=new Set(occupiedCrews),usedPeople=new Set();
 for(const u of roster)if(assignedHere.has(u.id)||assignedElsewhere.has(u.id))for(const person of u.staffing?.personIds||[])usedPeople.add(person);
 const stationById=new Map(stations.map(s=>[s.id,s]));
 const qualificationsByUnit=new Map();
 for(const entry of qualifications){if(!qualificationsByUnit.has(entry.unitId))qualificationsByUnit.set(entry.unitId,new Set());qualificationsByUnit.get(entry.unitId).add(norm(entry.code))}
 const rows=[],missing=[];
 function eligible(u,req){
  if(norm(u.discipline)!==norm(plan.discipline))return 'Different discipline';
  if(u.agency_id&&incident.agency_id&&u.agency_id!==incident.agency_id&&!req.allowMutualAid)return 'Outside incident agency; mutual aid not authorized';
  if(req.specificUnit&&norm(req.specificUnit)!==norm(u.call_sign))return 'Not the specified unit';
  if(assignedElsewhere.has(u.id))return 'Assigned to another incident';
  if(assignedHere.has(u.id))return 'Already assigned to this incident';
  if(selected.has(u.id))return 'Already recommended';
  if(norm(u.status)!=='AVAILABLE')return 'Not available: '+(u.status||'unknown');
  if(u.on_duty===false)return 'Off duty';
  const crew=crewForUnit.get(norm(u.call_sign||u.id));
  if(crew&&usedCrews.has(crew))return 'Shared crew already committed';
  if((u.staffing?.personIds||[]).some(p=>usedPeople.has(p)))return 'Personnel already committed';
  if(req.stationId&&u.station_id!==req.stationId&&u.home_station_id!==req.stationId)return 'Not assigned to required station';
  if(req.area&&norm(req.area)!==norm(u.response_area))return 'Outside configured response area';
  if(req.requiredStaffing!=null){
   if(!u.staffing?.active)return 'Staffing not verified';
   if((u.staffing.personIds||[]).length<Number(req.requiredStaffing))return 'Insufficient staffing';
  }
  const required=req.qualifications||[];
  const actual=qualificationsByUnit.get(u.id);
  if(required.length&&(!actual||required.some(q=>!actual.has(norm(q)))))return 'Required qualification not verified';
  return null;
 }
 for(const req of plan.resources||[]){
  const count=num(req.count),type=norm(req.type);
  const already=roster.filter(u=>assignedHere.has(u.id)&&norm(u.resource_type)===type).length;
  const remaining=Math.max(0,count-already);
  const qualified=[],excluded=[];
  const same=roster.filter(u=>norm(u.resource_type)===type);
  const order=unique([...(req.preferredUnits||[]).map(norm),...(req.alternatives||[]).map(norm)]);
  const priority=u=>{const idx=order.indexOf(norm(u.call_sign));return idx<0?999:idx};
  const pool=same.sort((a,b)=>priority(a)-priority(b)||norm(a.call_sign).localeCompare(norm(b.call_sign)));
  for(const u of pool){
   const reason=eligible(u,req);
   if(reason){excluded.push({unit:u.call_sign,reason});continue}
   if(qualified.length>=remaining)continue;
   // Unranked resources are not selected unless this requirement explicitly allows fallback.
   if(order.length&&!order.includes(norm(u.call_sign))&&!req.allowUnrankedFallback){excluded.push({unit:u.call_sign,reason:'Not in configured response order'});continue}
   if(!order.length&&!req.allowUnrankedFallback&&!req.specificUnit){excluded.push({unit:u.call_sign,reason:'No response order configured'});continue}
   qualified.push({id:u.id,callSign:u.call_sign,reason:order.includes(norm(u.call_sign))?'Configured response order':req.specificUnit?'Specified resource':'Explicit roster fallback'});
   selected.add(u.id);
   const crew=crewForUnit.get(norm(u.call_sign));if(crew)usedCrews.add(crew);
   for(const person of u.staffing?.personIds||[])usedPeople.add(person);
  }
  const shortage=Math.max(0,remaining-qualified.length);
  if(shortage)missing.push({type,count:shortage});
  rows.push({type,requested:count,alreadyAssigned:already,recommended:qualified,excluded,shortage,station:stationById.get(req.stationId)?.name||null});
 }
 return {status:missing.length?'shortage':'ready',message:missing.length?'Response requirements remain unfilled. Dispatcher review required.':'Recommendations ready for dispatcher review. No units dispatched.',planId:plan.id,rows,missing,unitIds:rows.flatMap(r=>r.recommended.map(u=>u.id))};
}
return Object.freeze({match,selectPlan,recommend});
});