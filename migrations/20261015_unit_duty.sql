-- End-of-shift duty state for shared CAD. No data rows are deleted.
create table if not exists public.cad_unit_duty_events (
 id uuid primary key default gen_random_uuid(),
 agency_id uuid not null references public.cad_agencies(id),
 unit_id uuid not null references public.cad_units(id),
 event_type text not null check(event_type in ('ON_DUTY','OFF_DUTY')),
 actor_id uuid,
 occurred_at timestamptz not null default now()
);
create index if not exists cad_unit_duty_events_agency_unit_idx on public.cad_unit_duty_events(agency_id,unit_id,occurred_at desc);
alter table public.cad_unit_duty_events enable row level security;
drop policy if exists cad_unit_duty_events_read on public.cad_unit_duty_events;
create policy cad_unit_duty_events_read on public.cad_unit_duty_events for select to authenticated using (public.cad_has_access(agency_id,false));
grant select on public.cad_unit_duty_events to authenticated;
create or replace function public.cad_set_unit_duty(
 p_agency uuid,p_unit uuid,p_expected_unit_version bigint,p_on_duty boolean
) returns jsonb language plpgsql security definer set search_path to '' as $$
declare v_u public.cad_units;v_next text;
begin
 if auth.uid() is null or not public.cad_has_access(p_agency,true) then
  raise exception 'CAD access denied' using errcode='42501';
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_agency::text,72361));
 select * into v_u from public.cad_units where id=p_unit and agency_id=p_agency for update;
 if not found then raise exception 'Unit not found';end if;
 if v_u.version<>p_expected_unit_version then raise exception 'CAD version conflict' using errcode='40001';end if;
 if exists(select 1 from public.cad_assignments where agency_id=p_agency and unit_id=p_unit and cleared_at is null) then
  raise exception 'Clear all active incident assignments before changing duty';
 end if;
 if p_on_duty then
  if v_u.status<>'OFF_DUTY' then raise exception 'Unit must be off duty before logon';end if;
  v_next:='AVAILABLE';
 else
  if v_u.status<>'AVAILABLE' then raise exception 'Only available and clear units may go off duty';end if;
  v_next:='OFF_DUTY';
 end if;
 update public.cad_units set status=v_next,version=version+1 where id=p_unit and agency_id=p_agency;
 insert into public.cad_unit_duty_events(agency_id,unit_id,event_type,actor_id)
 values(p_agency,p_unit,case when p_on_duty then 'ON_DUTY' else 'OFF_DUTY' end,auth.uid());
 return jsonb_build_object('ok',true,'status',v_next,'unit_version',v_u.version+1);
end $$;
revoke all on function public.cad_set_unit_duty(uuid,uuid,bigint,boolean) from public;
grant execute on function public.cad_set_unit_duty(uuid,uuid,bigint,boolean) to authenticated;
