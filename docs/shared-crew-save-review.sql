-- REVIEW ONLY. DO NOT APPLY TO PRODUCTION UNTIL ISOLATED BRANCH TESTING.
-- Uses existing CAD shared crew tables and their (agency_id, unit_id) unique constraint.
-- Must be reviewed for privileges and tested with real agency JWTs.
begin;
create or replace function public.cad_save_shared_crew(
 p_agency uuid,
 p_crew uuid,
 p_name text,
 p_unit_ids uuid[],
 p_expected_unit_ids uuid[] default null
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
 v_crew uuid;
 v_old uuid[];
 v_new uuid[];
 v_expected uuid[];
begin
 if auth.uid() is null or not public.cad_has_access(p_agency,true) then
  raise exception 'Shared crew edit not authorized';
 end if;
 if length(trim(coalesce(p_name,''))) not between 1 and 120 then
  raise exception 'Crew name must be 1 to 120 characters';
 end if;
 if p_unit_ids is null or array_length(p_unit_ids,1) is null then
  raise exception 'Select at least two units';
 end if;
 select coalesce(array_agg(distinct unit_id order by unit_id),array[]::uuid[]) into v_new from unnest(p_unit_ids) unit_id;
 if cardinality(v_new) < 2 or cardinality(v_new) <> cardinality(p_unit_ids) then
  raise exception 'Provide at least two different apparatus with no duplicates';
 end if;
 -- Serialize all edits for one agency, including creation and competing crew updates.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_agency::text,68237));
 select coalesce(array_agg(unit_id order by unit_id),array[]::uuid[]) into v_old
 from public.cad_shared_crew_units
 where agency_id=p_agency and crew_id=p_crew;
 if p_crew is not null then
  select id into v_crew from public.cad_shared_crews where id=p_crew and agency_id=p_agency for update;
  if v_crew is null then raise exception 'Crew was removed or belongs to another agency';end if;
  if p_expected_unit_ids is null then raise exception 'Expected memberships required to edit an existing crew';end if;
  select coalesce(array_agg(distinct unit_id order by unit_id),array[]::uuid[]) into v_expected from unnest(p_expected_unit_ids) unit_id;
  if v_old<>v_expected then raise exception 'Crew membership changed. Refresh before saving';end if;
 else
  v_crew:=pg_catalog.gen_random_uuid();
 end if;
 if (select count(*) from public.cad_units where agency_id=p_agency and id=any(v_new))<>cardinality(v_new) then
  raise exception 'All selected units must belong to this CAD agency';
 end if;
 if exists(select 1 from public.cad_shared_crew_units where agency_id=p_agency and unit_id=any(v_new) and crew_id<>v_crew) then
  raise exception 'One or more units already belong to another shared crew';
 end if;
 if p_crew is null then
  insert into public.cad_shared_crews(id,agency_id,name) values(v_crew,p_agency,trim(p_name));
 else
  update public.cad_shared_crews set name=trim(p_name) where id=v_crew and agency_id=p_agency;
 end if;
 delete from public.cad_shared_crew_units where agency_id=p_agency and crew_id=v_crew;
 insert into public.cad_shared_crew_units(crew_id,agency_id,unit_id)
 select v_crew,p_agency,x from unnest(v_new) x;
 return v_crew;
end;
$$;
revoke all on function public.cad_save_shared_crew(uuid,uuid,text,uuid[],uuid[]) from public,anon,authenticated;
-- Only grant after security review and branch tests:
-- grant execute on function public.cad_save_shared_crew(uuid,uuid,text,uuid[],uuid[]) to authenticated;
commit;

-- TODO: separate audited deletion RPC with expected membership version;
-- TODO: verify all dispatcher assignment paths enforce shared crew exclusion atomically;
-- TODO: concurrency tests, cross-agency denial tests, JWT role checks, grants/RLS checks.
