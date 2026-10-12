// v18.3: deterministic interpretation of operational reclassification language.
// Speech transcription and AI narrative assistance are separate from CAD state mutations.
(function(){
 const mappings=[
  {discipline:'FIRE',type:'Structure Fire',test:/\b(?:confirmed\s+)?(?:working\s+)?structure\s+fire\b|\bworking\s+fire\b/i},
  {discipline:'FIRE',type:'Vegetation Fire',test:/\b(?:confirmed\s+)?(?:working\s+)?vegetation\s+fire\b|\bbrush\s+fire\b/i},
  {discipline:'FIRE',type:'Vehicle Fire',test:/\b(?:confirmed\s+)?vehicle\s+fire\b/i},
  {discipline:'FIRE',type:'Fire Alarm',test:/\bfire\s+alarm\b/i},
  {discipline:'EMS',type:'Cardiac Arrest',test:/\bcardiac\s+arrest\b|\bpatient\s+in\s+arrest\b/i},
  {discipline:'EMS',type:'Medical Aid',test:/\bmedical\s+aid\b/i},
  {discipline:'EMS',type:'Overdose',test:/\b(?:confirmed\s+)?overdose\b/i},
  {discipline:'LAW',type:'Burglary',test:/\b(?:confirmed\s+)?burglary\b/i},
  {discipline:'LAW',type:'Robbery',test:/\b(?:confirmed\s+)?robbery\b/i},
  {discipline:'LAW',type:'Domestic',test:/\bdomestic(?:\s+disturbance)?\b/i},
  {discipline:'LAW',type:'Traffic Collision',test:/\btraffic\s+collision\b/i},
  {discipline:'LAW',type:'Welfare Check',test:/\bwelfare\s+check\b/i}
 ];
 const normalized=s=>String(s||'').toLowerCase().replace(/[.,!?]/g,' ').replace(/\s+/g,' ').trim();
 function classification(text){
  const t=normalized(text);
  if(/\b(?:possible|possibly|potential|suspected|maybe|might be|may be|unconfirmed|investigating|checking for|negative for|no evidence of)\b/.test(t))return {review:'Classification not confirmed'};
  const explicit=/\b(?:upgrade|reclassify|reclass|change|update)\b.{0,55}\b(?:to|as)\b/.test(t);
  const reported=/\b(?:on scene|onscene|at scene|confirmed|working|now a|now an|is a|is an|found|reports?|advises?)\b/.test(t);
  if(!explicit&&!reported)return null;
  // Recognize user-defined CFS types from saved configuration as well as built-ins.
  // Match complete words, preferring the most specific matching type.
  const dynamic=[];
  for(const discipline of ['LAW','FIRE','EMS'])for(const type of (typeof config!=='undefined'?config.types?.[discipline]:[])||[]){
   const normalizedType=normalized(type);
   if(!normalizedType)continue;
   const pattern=normalizedType.split(' ').map(w=>w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('\\s+');
   if(new RegExp('(?:^|\\b)'+pattern+'(?:\\b|$)','i').test(t)) dynamic.push({discipline,type,test:new RegExp(pattern,'i')});
  }
  const hits=[...mappings.filter(m=>m.test.test(t)),...dynamic].filter((x,i,arr)=>arr.findIndex(y=>normalized(y.type)===normalized(x.type)&&y.discipline===x.discipline)===i).sort((a,b)=>b.type.length-a.type.length);
  if(!hits.length)return explicit?{review:'New incident type not recognized; review manually'}:null;
  // A command may mention both the original and the new type. Favor the target after "to/as".
  let chosen=null;
  if(explicit){const tail=t.split(/\b(?:to|as)\b/).pop();const possible=hits.filter(m=>m.test.test(tail));if(possible.length===1)chosen=possible[0];}
  if(!chosen){const longest=hits.filter(m=>m.type.length===hits[0].type.length);if(longest.length!==1)return {review:'More than one incident classification recognized'};chosen=longest[0];}
  return {type:chosen.type,discipline:chosen.discipline};
 }
 function assignedUnique(unitIds){const ids=[...new Set(unitIds)];if(ids.length!==1)return null;const matches=state.incidents.filter(i=>i.status==='ACTIVE'&&i.units.includes(ids[0]));return matches.length===1?matches[0]:null;}
 function explicitEvent(text){const open=state.incidents.filter(i=>i.status!=='CLOSED');const matches=open.filter(i=>{const n=i.id.replace(/^\d\d-0*/, '');return new RegExp('(?:event|incident|call|#)\\s*(?:number\\s*)?(?:'+i.id.replace('-','[- ]?')+'|'+n+')\\b','i').test(text)});return matches.length===1?matches[0]:null;}
 function resolveIncident(text,unitIds=[]){
  const byId=explicitEvent(text);if(byId)return byId;
  const byUnit=assignedUnique(unitIds);if(byUnit)return byUnit;
  // Address matching only for explicit street number AND street name, unique across incident families.
  const t=normalized(text).replace(/\bstreet\b/g,'st').replace(/\broad\b/g,'rd');
  const matches=state.incidents.filter(i=>i.status==='ACTIVE'&&(()=>{const loc=normalized(i.location).replace(/\bstreet\b/g,'st').replace(/\broad\b/g,'rd');const parts=loc.split(' ');return parts.length>1&&/^\d+/.test(parts[0])&&t.includes(parts[0]+' '+parts[1]);})());
  return matches.length===1?matches[0]:null;
 }
 function apply(inc,parsed,text,origin){
  if(!parsed||!inc)return null;
  if(parsed.review)return {review:parsed.review};
  if(inc.discipline!==parsed.discipline)return {review:`${parsed.type} belongs to ${parsed.discipline}, not ${inc.discipline}; reclassification held`};
  if(inc.type===parsed.type)return {note:`Classification already ${inc.type}`};
  const old=inc.type;inc.type=parsed.type;
  inc.classificationHistory ||= [];
  inc.classificationHistory.push({from:old,to:parsed.type,at:Date.now(),source:origin,utterance:text});
  event(inc,`INCIDENT_RECLASSIFIED ${old} -> ${parsed.type} [${origin}]`);
  return {applied:`${inc.id} reclassified ${old} → ${parsed.type}`};
 }
 window.cadIncidentIntelligence={classification,resolveIncident,apply};
})();
