-- Proposed for consolidated release ONLY. Do not apply to live Supabase during parser tests.
-- A single authenticated transaction places the arriving unit on the incident
-- already assigned to the named reference unit, and marks it ONSCENE.
create or replace function public.cad_join_unit_on_scene(
 p_agency uuid,p_joining_unit uuid,p_reference_unit uuid,
 p_expected_incident_version bigint,p_expected_joining_version bigint,
 p_expected_reference_version bigint
) returns jsonb language plpgsql security definer set search_path to '' as $$
declare
 v_i public.cad_incidents;
 v_join public.cad_units;
 v_ref public.cad_units;
 v_incident uuid;
 v_refs int;
begin
 if auth.uid() is null or not public.cad_has_access(p_agency,true) then
  raise exception 'CAD access denied' using errcode='42501';
 end if;
 if p_joining_unit=p_reference_unit then raise exception 'Cannot join the same unit';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_agency::text,72361));
 select a.incident_id into v_incident
 from public.cad_assignments a
 join public.cad_incidents i on i.id=a.incident_id and i.agency_id=a.agency_id
 where a.agency_id=p_agency and a.unit_id=p_reference_unit
   and a.cleared_at is null and i.status='ACTIVE'
 limit 1;
 if v_incident is null then raise exception 'Reference unit is not assigned to an active incident';end if;
 select count(*) into v_refs from public.cad_assignments a
 join public.cad_incidents i on i.id=a.incident_id and i.agency_id=a.agency_id
 where a.agency_id=p_agency and a.unit_id=p_reference_unit
   and a.cleared_at is null and i.status='ACTIVE';
 if v_refs<>1 then raise exception 'Reference unit has multiple active assignments';end if;
 select * into v_i from public.cad_incidents where id=v_incident and agency_id=p_agency for update;
 perform 1 from public.cad_units
 where agency_id=p_agency and id in(p_joining_unit,p_reference_unit) order by id for update;
 select * into v_join from public.cad_units where id=p_joining_unit and agency_id=p_agency;
 select * into v_ref from public.cad_units where id=p_reference_unit and agency_id=p_agency;
 if not found or v_join.id is null or v_ref.id is null then raise exception 'Units not found';end if;
 if v_i.status<>'ACTIVE' or v_i.version<>p_expected_incident_version
  or v_join.version<>p_expected_joining_version
  or v_ref.version<>p_expected_reference_version then
  raise exception 'CAD version conflict. Refresh incident and unit assignments.' using errcode='40001';
 end if;
 if v_join.status<>'AVAILABLE' then raise exception 'Joining unit not available';end if;
 if v_join.discipline<>v_i.discipline then raise exception 'Cross-discipline join requires review';end if;
 if exists(select 1 from public.cad_assignments where agency_id=p_agency and unit_id=p_joining_unit and cleared_at is null) then
  raise exception 'Joining unit already assigned';
 end if;
 if exists(select 1 from public.cad_shared_crew_units c
  join public.cad_shared_crew_units s on s.crew_id=c.crew_id and s.unit_id<>c.unit_id
  join public.cad_assignments a on a.unit_id=s.unit_id and a.cleared_at is null
  where c.agency_id=p_agency and c.unit_id=p_joining_unit) then
  raise exception 'Joining unit shared crew is busy';
 end if;
 insert into public.cad_assignments(agency_id,incident_id,unit_id)
 values(p_agency,v_i.id,p_joining_unit);
 update public.cad_units set status='ONSCENE',version=version+1 where id=p_joining_unit;
 update public.cad_incidents set version=version+1,updated_at=now() where id=v_i.id;
 insert into public.cad_incident_events(agency_id,incident_id,event_type,payload,actor_id)
 values(p_agency,v_i.id,'UNIT_JOINED_ONSCENE',
  jsonb_build_object('unit_id',p_joining_unit,'with_unit_id',p_reference_unit),auth.uid());
 return jsonb_build_object('ok',true,'incident_id',v_i.id,'joining_unit_id',p_joining_unit,'reference_unit_id',p_reference_unit,'status','ONSCENE');
end $$;
revoke all on function public.cad_join_unit_on_scene(uuid,uuid,uuid,bigint,bigint,bigint) from public,anon;
grant execute on function public.cad_join_unit_on_scene(uuid,uuid,uuid,bigint,bigint,bigint) to authenticated;
