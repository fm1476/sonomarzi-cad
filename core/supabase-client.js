/* Optional Supabase CAD client. Does not change the local demo persistence mode.
 * Pass a short-lived authenticated access token from a future login flow.
 * Never pass service-role credentials or store tokens in localStorage.
 */
(()=>{'use strict';
 const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 function create({url,anonKey,getAccessToken,fetchImpl}={}){
  if(typeof url!=='string'||!/^https:\/\/[a-z0-9.-]+$/i.test(url))throw Error('Valid HTTPS Supabase project URL required');
  if(typeof anonKey!=='string'||!anonKey.trim())throw Error('Supabase publishable/anon key required');
  if(typeof getAccessToken!=='function')throw Error('Authenticated token provider required');
  const transport=fetchImpl||fetch;
  const base=url.replace(/\/$/,'')+'/rest/v1/';
  async function request(path,{method='GET',body,prefer}={}){
   const token=await getAccessToken();
   if(typeof token!=='string'||!token.trim())throw Error('CAD login required');
   const headers={apikey:anonKey,Authorization:'Bearer '+token,Accept:'application/json'};
   if(body!==undefined)headers['Content-Type']='application/json';
   if(prefer)headers.Prefer=prefer;
   const response=await transport(base+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'});
   const data=await response.json().catch(()=>null);
   if(!response.ok)throw Error('CAD request failed ('+response.status+'): '+(data?.message||data?.error||'Server rejected request'));
   return data;
  }
  function id(value){if(!UUID.test(String(value)))throw Error('Valid CAD UUID required');return value}
  function rpc(name,args){return request('rpc/'+name,{method:'POST',body:args})}
  function read(table,agency,extra=''){
   return request(table+'?agency_id=eq.'+encodeURIComponent(id(agency))+(extra?'&'+extra:''));
  }
  return Object.freeze({
   listAgencies:()=>request('cad_agencies?select=id,name&order=name'),
   listIncidents:agency=>read('cad_incidents',agency,'select=*&order=created_at.desc&limit=250'),
   listUnits:agency=>read('cad_units',agency,'select=*&order=call_sign&limit=500'),
   listAssignments:agency=>read('cad_assignments',agency,'select=*&cleared_at=is.null&limit=500'),
   listDispatchAreas:agency=>read('cad_dispatch_areas',agency,'select=id,name,description,active&active=eq.true&order=name'),
   listDispatchAreaAgencies:agency=>read('cad_dispatch_area_agencies',agency,'select=dispatch_area_id,served_agency_name'),
   createIncidentAuto:({agency,discipline,type,priority,location})=>rpc('cad_create_incident_auto',{p_agency:id(agency),p_discipline:discipline,p_type:type,p_priority:priority,p_location:location}),
   createIncident:({agency,number,discipline,type,priority,location})=>rpc('cad_create_incident',{p_agency:id(agency),p_number:number,p_discipline:discipline,p_type:type,p_priority:priority,p_location:location}),
   preemptUnit:({agency,fromIncident,toIncident,unit,fromVersion,toVersion,unitVersion})=>rpc('cad_preempt_unit',{p_agency:id(agency),p_from_incident:id(fromIncident),p_to_incident:id(toIncident),p_unit:id(unit),p_expected_from_version:fromVersion,p_expected_to_version:toVersion,p_expected_unit_version:unitVersion}),
   assignUnit:({agency,incident,unit,incidentVersion,unitVersion})=>rpc('cad_assign_unit',{p_agency:id(agency),p_incident:id(incident),p_unit:id(unit),p_expected_incident_version:incidentVersion,p_expected_unit_version:unitVersion}),
   reclassifyIncident:({agency,incident,unit,type,incidentVersion,report})=>rpc('cad_reclassify_incident',{p_agency:id(agency),p_incident:id(incident),p_unit:id(unit),p_type:type,p_expected_version:incidentVersion,p_report:report}),
   changeUnitStatus:({agency,incident,unit,status,unitVersion})=>rpc('cad_change_unit_status',{p_agency:id(agency),p_incident:id(incident),p_unit:id(unit),p_status:status,p_expected_unit_version:unitVersion}),
   listOutstanding:agency=>read('cad_outstanding_resources',agency,'select=*&order=incident_id,resource_type'),
   listIncidentEvents:agency=>read('cad_incident_events',agency,'select=*&order=occurred_at.desc&limit=500'),
   listIncidentLocations:agency=>read('cad_incident_locations',agency,'select=*&order=recorded_at.desc&limit=500'),
   allocateCaseNumber:({agency,incident,incidentVersion})=>rpc('cad_allocate_case_number',{p_agency:id(agency),p_incident:id(incident),p_expected_version:incidentVersion}),
   setCaseNumber:({agency,incident,caseNumber,incidentVersion})=>rpc('cad_set_case_number',{p_agency:id(agency),p_incident:id(incident),p_case_number:caseNumber,p_expected_version:incidentVersion}),
   addNarrative:({agency,incident,text,incidentVersion})=>rpc('cad_add_narrative',{p_agency:id(agency),p_incident:id(incident),p_text:text,p_expected_version:incidentVersion}),
   closeIncident:({agency,incident,disposition,incidentVersion})=>rpc('cad_close_incident',{p_agency:id(agency),p_incident:id(incident),p_disposition:disposition,p_expected_version:incidentVersion}),
   activateIncident:({agency,incident,incidentVersion})=>rpc('cad_activate_incident',{p_agency:id(agency),p_incident:id(incident),p_expected_version:incidentVersion}),
   editIncident:({agency,incident,incidentVersion,type,priority,location,caseNumber,source})=>rpc('cad_edit_incident',{p_agency:id(agency),p_incident:id(incident),p_expected_version:incidentVersion,p_type:type,p_priority:priority,p_location:location,p_case_number:caseNumber,p_source:source||'DISPATCH'}),
   correctLocation:({agency,incident,location,incidentVersion,source})=>rpc('cad_correct_location',{p_agency:id(agency),p_incident:id(incident),p_location:location,p_expected_version:incidentVersion,p_source:source||'DISPATCH'}),
   assignResponsePlan:({agency,incident,unitIds,incidentVersion,unitVersions})=>rpc('cad_assign_response_plan',{p_agency:id(agency),p_incident:id(incident),p_unit_ids:unitIds.map(id),p_expected_incident_version:incidentVersion,p_expected_unit_versions:unitVersions}),
   setRequirements:({agency,incident,incidentVersion,requirements})=>rpc('cad_set_response_requirements',{p_agency:id(agency),p_incident:id(incident),p_expected_version:incidentVersion,p_requirements:requirements}),
   refreshShortfalls:({agency,incident})=>rpc('cad_refresh_response_shortfalls',{p_agency:id(agency),p_incident:id(incident)}),
   clearUnit:({agency,incident,unit,incidentVersion,unitVersion,disposition})=>rpc('cad_clear_unit',{p_agency:id(agency),p_incident:id(incident),p_unit:id(unit),p_expected_incident_version:incidentVersion,p_expected_unit_version:unitVersion,p_disposition:disposition||null})
  });
 }
 window.CadSupabase=Object.freeze({create});
})();
