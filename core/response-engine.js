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
 const warnings=[];
 if(!Array.isArray(plan.resources)||!plan.resources.length)return {status:'blocked',message:'Plan has no resource requirements.',rows:[],unitIds:[]};
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
  if(req.stationId){
   const home=norm(u.station_id||u.home_station_id||'');
   if(!home)return 'Station assignment not verified';
   if(home!==norm(req.stationId))return 'Not assigned to required station';
  }
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
  if(!type||count<1){warnings.push('Invalid resource requirement: '+(type||'missing type'));continue}
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
 return {status:warnings.length?'blocked':missing.length?'shortage':'ready',message:warnings.length?warnings.join('; '):missing.length?'Response requirements remain unfilled. Dispatcher review required.':'Recommendations ready for dispatcher review. No units dispatched.',planId:plan.id,rows,missing,warnings,unitIds:warnings.length?[]:rows.flatMap(r=>r.recommended.map(u=>u.id))};
}
function escalate({plan,incident,roster=[],assignments=[],crews=[],stations=[],qualifications=[],level}={}){
 if(!plan||!incident)return {status:'blocked',message:'Select a plan and incident.',rows:[],unitIds:[]};
 const levels=Array.isArray(plan.alarmLevels)?plan.alarmLevels:[];
 const target=levels.find(l=>l.id===level||l.name===level);
 if(!target)return {status:'blocked',message:'Selected alarm level is not configured.',rows:[],unitIds:[]};
 const ordered=levels.slice().sort((a,b)=>Number(a.rank)-Number(b.rank));
 if(!Number.isFinite(Number(target.rank)))return {status:'blocked',message:'Alarm level sequence is invalid.',rows:[],unitIds:[]};
 const current=ordered.find(l=>l.id===incident.alarm_level||l.name===incident.alarm_level);
 if(current&&Number(current.rank)>=Number(target.rank))return {status:'blocked',message:'Only higher alarm levels can be proposed here.',rows:[],unitIds:[]};
 const mode=norm(target.mode||'TOTAL');
 if(!['TOTAL','ADDITIVE'].includes(mode))return {status:'blocked',message:'Unsupported escalation mode.',rows:[],unitIds:[]};
 const accumulated=new Map();
 // Total-target levels include already assigned resources. Additive levels add
 // requirements from each crossed tier, then subtract current assignments.
 const tiers=mode==='ADDITIVE'?ordered.filter(l=>Number(l.rank)<=Number(target.rank)): [target];
 for(const tier of tiers)for(const r of tier.resources||[]){
  const type=norm(r.type);if(!type||!Number.isInteger(Number(r.count))||Number(r.count)<1)return {status:'blocked',message:'Invalid alarm-level requirement.',rows:[],unitIds:[]};
  const previous=accumulated.get(type);
  if(previous){previous.count+=Number(r.count);previous.preferredUnits=[...new Set([...(previous.preferredUnits||[]),...(r.preferredUnits||[])])];}
  else accumulated.set(type,{...r,type,count:Number(r.count)});
 }
 if(!accumulated.size)return {status:'blocked',message:'Alarm level contains no resource requirements.',rows:[],unitIds:[]};
 const proposal=recommend({plan:{...plan,resources:[...accumulated.values()]},incident,roster,assignments,crews,stations,qualifications});
 return {...proposal,alarmLevel:target.name,escalationMode:mode,message:proposal.message+' Alarm change itself requires separate dispatcher confirmation.'};
}
return Object.freeze({match,selectPlan,recommend,escalate});
});