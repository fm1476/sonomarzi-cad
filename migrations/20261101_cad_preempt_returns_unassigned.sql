-- STAGED ONLY: not applied until consolidated release is approved.
-- Preserve existing authenticated preempt semantics, correcting source queue state.
CREATE OR REPLACE FUNCTION public.cad_preempt_unit(p_agency uuid, p_from_incident uuid, p_to_incident uuid, p_unit uuid, p_expected_from_version bigint, p_expected_to_version bigint, p_expected_unit_version bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_from public.cad_incidents;v_to public.cad_incidents;v_unit public.cad_units;v_active_count integer;
begin
 if auth.uid() is null or not public.cad_has_access(p_agency,true) then raise exception 'CAD access denied' using errcode='42501';end if;
 if p_from_incident=p_to_incident then raise exception 'PREEMPT requires different incidents';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_agency::text,72361));
 -- Fixed lock order for incidents; serialize with unit assignment operations via agency advisory lock.
 perform 1 from public.cad_incidents where id in (p_from_incident,p_to_incident) and agency_id=p_agency order by id for update;
 select * into v_from from public.cad_incidents where id=p_from_incident and agency_id=p_agency;
 select * into v_to from public.cad_incidents where id=p_to_incident and agency_id=p_agency;
 if v_from.id is null or v_to.id is null then raise exception 'Both incidents must exist within agency';end if;
 select * into v_unit from public.cad_units where id=p_unit and agency_id=p_agency for update;
 if not found then raise exception 'Unit not found in agency';end if;
 if v_from.version<>p_expected_from_version or v_to.version<>p_expected_to_version or v_unit.version<>p_expected_unit_version then
  raise exception 'CAD version conflict' using errcode='40001';
 end if;
 if v_from.status<>'ACTIVE' or v_to.status='CLOSED' then raise exception 'Invalid source or destination incident status';end if;
 if v_unit.discipline<>v_to.discipline then raise exception 'Cross-discipline PREEMPT requires a linked incident';end if;
 select count(*) into v_active_count from public.cad_assignments where agency_id=p_agency and unit_id=p_unit and cleared_at is null;
 if v_active_count<>1 or not exists(select 1 from public.cad_assignments where agency_id=p_agency and incident_id=p_from_incident and unit_id=p_unit and cleared_at is null) then
  raise exception 'Unit must have exactly one active assignment on source incident';
 end if;
 if exists(
  select 1 from public.cad_shared_crew_units candidate
  join public.cad_shared_crew_units sibling on sibling.crew_id=candidate.crew_id and sibling.unit_id<>candidate.unit_id
  join public.cad_assignments a on a.unit_id=sibling.unit_id and a.cleared_at is null
  where candidate.unit_id=p_unit and candidate.agency_id=p_agency
 ) then raise exception 'Another shared crew resource is already committed';end if;
 update public.cad_assignments set cleared_at=now()
  where agency_id=p_agency and incident_id=p_from_incident and unit_id=p_unit and cleared_at is null;
 insert into public.cad_assignments(agency_id,incident_id,unit_id) values(p_agency,p_to_incident,p_unit);
 update public.cad_units set status='DISPATCHED',version=version+1 where id=p_unit;
 -- Source incident returns to PENDING when the transferred unit was its last active unit.
 -- Leave it ACTIVE when other units remain assigned. Never close it on PREEMPT.
 update public.cad_incidents set
  status=case when exists(select 1 from public.cad_assignments
    where agency_id=p_agency and incident_id=p_from_incident and cleared_at is null)
    then 'ACTIVE' else 'PENDING' end,
  version=version+1,updated_at=now()
 where id=p_from_incident and agency_id=p_agency;
 update public.cad_incidents set status='ACTIVE',version=version+1,updated_at=now() where id=p_to_incident;
 insert into public.cad_incident_events(agency_id,incident_id,event_type,payload,actor_id)
 values(p_agency,p_from_incident,'UNIT_PREEMPTED_OUT',
  jsonb_build_object('unit_id',p_unit,'to_incident',p_to_incident,'previous_unit_status',v_unit.status),auth.uid());
 insert into public.cad_incident_events(agency_id,incident_id,event_type,payload,actor_id)
 values(p_agency,p_to_incident,'UNIT_PREEMPTED_IN',
  jsonb_build_object('unit_id',p_unit,'from_incident',p_from_incident,'status','DISPATCHED'),auth.uid());
 return jsonb_build_object('ok',true,'from_incident',p_from_incident,'to_incident',p_to_incident,'unit',p_unit,'status','DISPATCHED');
end $function$
;
