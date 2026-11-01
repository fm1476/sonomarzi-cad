-- STAGED ONLY: do not apply until the consolidated voice release is approved.
-- Atomic PREEMPT from an existing assignment onto the unique active call of
-- a specified reference unit, with the moving unit immediately ONSCENE.
create or replace function public.cad_preempt_join_unit_on_scene(
 p_agency uuid,p_joining_unit uuid,p_reference_unit uuid,
 p_from_incident uuid,p_to_incident uuid,
 p_expected_from_version bigint,p_expected_to_version bigint,
 p_expected_joining_version bigint,p_expected_reference_version bigint
) returns jsonb language plpgsql security definer set search_path to '' as $$
declare
 v_from public.cad_incidents;
 v_to public.cad_incidents;
 v_join public.cad_units;
 v_ref public.cad_units;
 v_ref_count int;
 v_join_count int;
begin
 if auth.uid() is null or not public.cad_has_access(p_agency,true) then
  raise exception 'CAD access denied' using errcode='42501';
 end if;
 if p_joining_unit=p_reference_unit or p_from_incident=p_to_incident then
  raise exception 'PREEMPT requires distinct units and incidents';
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_agency::text,72361));
 perform 1 from public.cad_incidents
  where agency_id=p_agency and id in(p_from_incident,p_to_incident)
  order by id for update;
 select * into v_from from public.cad_incidents where id=p_from_incident and agency_id=p_agency;
 select * into v_to from public.cad_incidents where id=p_to_incident and agency_id=p_agency;
 if v_from.id is null or v_to.id is null then raise exception 'PREEMPT incidents not found';end if;
 perform 1 from public.cad_units
  where agency_id=p_agency and id in(p_joining_unit,p_reference_unit)
  order by id for update;
 select * into v_join from public.cad_units where id=p_joining_unit and agency_id=p_agency;
 select * into v_ref from public.cad_units where id=p_reference_unit and agency_id=p_agency;
 if v_join.id is null or v_ref.id is null then raise exception 'PREEMPT units not found';end if;
 if v_from.version<>p_expected_from_version or v_to.version<>p_expected_to_version
  or v_join.version<>p_expected_joining_version or v_ref.version<>p_expected_reference_version
 then raise exception 'CAD version conflict. Refresh before PREEMPT.' using errcode='40001';end if;
 if v_from.status<>'ACTIVE' or v_to.status<>'ACTIVE' then
  raise exception 'Both PREEMPT incidents must be active';
 end if;
 if v_join.discipline<>v_to.discipline then
  raise exception 'Cross-discipline PREEMPT requires dispatcher review';
 end if;
 select count(*) into v_join_count from public.cad_assignments
  where agency_id=p_agency and unit_id=p_joining_unit and cleared_at is null;
 if v_join_count<>1 or not exists(select 1 from public.cad_assignments
  where agency_id=p_agency and incident_id=p_from_incident and unit_id=p_joining_unit and cleared_at is null)
 then raise exception 'Moving unit must have exactly one active assignment on its source incident';end if;
 select count(*) into v_ref_count from public.cad_assignments a
  join public.cad_incidents i on i.id=a.incident_id and i.agency_id=a.agency_id
  where a.agency_id=p_agency and a.unit_id=p_reference_unit and a.cleared_at is null and i.status='ACTIVE';
 if v_ref_count<>1 or not exists(select 1 from public.cad_assignments
  where agency_id=p_agency and incident_id=p_to_incident and unit_id=p_reference_unit and cleared_at is null)
 then raise exception 'Reference unit must have exactly one active destination assignment';end if;
 if exists(select 1 from public.cad_shared_crew_units candidate
  join public.cad_shared_crew_units sibling on sibling.crew_id=candidate.crew_id and sibling.unit_id<>candidate.unit_id
  join public.cad_assignments a on a.unit_id=sibling.unit_id and a.cleared_at is null
  where candidate.unit_id=p_joining_unit and candidate.agency_id=p_agency)
 then raise exception 'Shared crew is already committed';end if;
 update public.cad_assignments set cleared_at=now()
  where agency_id=p_agency and incident_id=p_from_incident and unit_id=p_joining_unit and cleared_at is null;
 insert into public.cad_assignments(agency_id,incident_id,unit_id)
  values(p_agency,p_to_incident,p_joining_unit);
 update public.cad_units set status='ONSCENE',version=version+1 where id=p_joining_unit and agency_id=p_agency;
 update public.cad_incidents set
  status=case when exists(select 1 from public.cad_assignments a
   where a.agency_id=p_agency and a.incident_id=p_from_incident and a.cleared_at is null)
   then 'ACTIVE' else 'PENDING' end,
  version=version+1,updated_at=now()
  where agency_id=p_agency and id=p_from_incident;
 update public.cad_incidents set status='ACTIVE',version=version+1,updated_at=now()
  where agency_id=p_agency and id=p_to_incident;
 insert into public.cad_incident_events(agency_id,incident_id,event_type,payload,actor_id)
 values(p_agency,p_from_incident,'UNIT_PREEMPTED_OUT',
  jsonb_build_object('unit_id',p_joining_unit,'to_incident',p_to_incident,'reference_unit',p_reference_unit,'previous_unit_status',v_join.status),auth.uid());
 insert into public.cad_incident_events(agency_id,incident_id,event_type,payload,actor_id)
 values(p_agency,p_to_incident,'UNIT_PREEMPTED_IN',
  jsonb_build_object('unit_id',p_joining_unit,'from_incident',p_from_incident,'reference_unit',p_reference_unit,'status','ONSCENE'),auth.uid());
 return jsonb_build_object('ok',true,'from_incident',p_from_incident,'to_incident',p_to_incident,
  'unit',p_joining_unit,'reference_unit',p_reference_unit,'status','ONSCENE');
end $$;
revoke all on function public.cad_preempt_join_unit_on_scene(uuid,uuid,uuid,uuid,uuid,bigint,bigint,bigint,bigint) from public,anon;
grant execute on function public.cad_preempt_join_unit_on_scene(uuid,uuid,uuid,uuid,uuid,bigint,bigint,bigint,bigint) to authenticated;
