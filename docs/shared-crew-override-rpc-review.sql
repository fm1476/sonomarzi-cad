-- REVIEW ONLY. NOT DEPLOYED. Requires isolated database tests and explicit authorization.
-- Dedicated override grants are authoritative DB rows, never user-controlled JWT metadata.
begin;
create table if not exists public.cad_shared_crew_override_grants (
 agency_id uuid not null references public.cad_agencies(id),
 user_id uuid not null references auth.users(id),
 granted_by uuid not null references auth.users(id),
 granted_at timestamptz not null default now(),
 revoked_at timestamptz,
 primary key (agency_id,user_id)
);
alter table public.cad_shared_crew_override_grants enable row level security;
revoke all on public.cad_shared_crew_override_grants from public,anon,authenticated;
-- Administration of grants is out-of-band pending explicit admin authorization design.
create or replace function public.cad_assign_unit_with_crew_override(
 p_agency uuid,p_incident uuid,p_unit uuid,
 p_expected_incident_version bigint,p_expected_unit_version bigint,p_reason text
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_i public.cad_incidents; v_u public.cad_units; v_conflicts jsonb;
begin
 if auth.uid() is null or not public.cad_has_access(p_agency,true) then
  raise exception 'CAD access denied' using errcode='42501';
 end if;
 if not exists(select 1 from public.cad_shared_crew_override_grants g where g.agency_id=p_agency and g.user_id=auth.uid() and g.revoked_at is null) then
  raise exception 'Shared-crew override permission denied' using errcode='42501';
 end if;
 if length(btrim(coalesce(p_reason,''))) not between 10 and 500 then
  raise exception 'Override reason must be 10 to 500 characters';
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_agency::text,72361));
 select * into v_i from public.cad_incidents where id=p_incident and agency_id=p_agency for update;
 if not found or v_i.status='CLOSED' then raise exception 'Active incident not found';end if;
 select * into v_u from public.cad_units where id=p_unit and agency_id=p_agency for update;
 if not found then raise exception 'Unit not found';end if;
 if v_i.version<>p_expected_incident_version or v_u.version<>p_expected_unit_version then
  raise exception 'CAD version conflict' using errcode='40001';
 end if;
 if v_u.status<>'AVAILABLE' then raise exception 'Unit unavailable';end if;
 if exists(select 1 from public.cad_assignments where agency_id=p_agency and unit_id=p_unit and cleared_at is null) then
  raise exception 'Unit already assigned';
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('unit_id',sibling.unit_id,'incident_id',a.incident_id)), '[]'::jsonb)
 into v_conflicts
 from public.cad_shared_crew_units candidate
 join public.cad_shared_crew_units sibling on sibling.crew_id=candidate.crew_id and sibling.agency_id=candidate.agency_id and sibling.unit_id<>candidate.unit_id
 join public.cad_assignments a on a.unit_id=sibling.unit_id and a.agency_id=p_agency and a.cleared_at is null
 where candidate.unit_id=p_unit and candidate.agency_id=p_agency;
 if jsonb_array_length(v_conflicts)=0 then
  raise exception 'No shared crew conflict; use ordinary dispatch';
 end if;
 -- Only the shared-crew exclusion is waived. All normal unit/incident guards remain.
 insert into public.cad_assignments(agency_id,incident_id,unit_id) values(p_agency,p_incident,p_unit);
 update public.cad_units set status='DISPATCHED',version=version+1 where id=p_unit and agency_id=p_agency;
 update public.cad_incidents set status='ACTIVE',version=version+1,updated_at=now() where id=p_incident and agency_id=p_agency;
 insert into public.cad_incident_events(agency_id,incident_id,event_type,payload,actor_id)
 values(p_agency,p_incident,'SHARED_CREW_OVERRIDE_ASSIGNED',
 jsonb_build_object('unit_id',p_unit,'conflicts',v_conflicts,'reason',btrim(p_reason),
 'expected_incident_version',p_expected_incident_version,'expected_unit_version',p_expected_unit_version),auth.uid());
 return jsonb_build_object('ok',true,'incident_version',v_i.version+1,'unit_version',v_u.version+1,'conflicts',v_conflicts);
end;
$$;
revoke all on function public.cad_assign_unit_with_crew_override(uuid,uuid,uuid,bigint,bigint,text) from public,anon,authenticated;
-- DO NOT GRANT EXECUTE until branch testing validates authorization and all guard parity.
commit;
