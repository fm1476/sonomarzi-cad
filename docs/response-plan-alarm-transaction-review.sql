-- REVIEW-ONLY SQL PROPOSAL. Do not execute against the active Supabase project
-- without explicit approval. Based on inspected public.cad_incidents, public.cad_incident_events,
-- public.cad_has_access, and existing version-checked CAD RPC conventions on 2026-11-01.
-- The call itself records alarm-level state ONLY. It does not dispatch or preempt units.
begin;

create table if not exists public.cad_incident_alarm_state (
  agency_id uuid not null,
  incident_id uuid primary key references public.cad_incidents(id) on delete cascade,
  alarm_name text not null check (length(alarm_name) between 1 and 120),
  alarm_rank integer not null check (alarm_rank between 1 and 20),
  plan_id text not null check (length(plan_id) between 1 and 150),
  recorded_at timestamptz not null default now(),
  recorded_by uuid,
  constraint cad_alarm_agency_incident_unique unique (agency_id, incident_id)
);

alter table public.cad_incident_alarm_state enable row level security;
revoke all on public.cad_incident_alarm_state from public, anon, authenticated;
grant select on public.cad_incident_alarm_state to authenticated;
create policy cad_alarm_state_read on public.cad_incident_alarm_state
 for select to authenticated
 using (auth.uid() is not null and public.cad_has_access(agency_id,false));

create or replace function public.cad_set_incident_alarm_level(
 p_agency uuid,
 p_incident uuid,
 p_expected_version bigint,
 p_plan_id text,
 p_level_name text,
 p_level_rank integer
) returns jsonb language plpgsql security definer set search_path = ''
as $fn$
declare v public.cad_incidents; previous_rank integer;
begin
 if auth.uid() is null or not public.cad_has_access(p_agency,true)
 then raise exception 'CAD access denied' using errcode='42501';end if;
 if p_level_name is null or length(btrim(p_level_name)) not between 1 and 120
    or p_plan_id is null or length(btrim(p_plan_id)) not between 1 and 150
    or p_level_rank not between 1 and 20
 then raise exception 'Invalid alarm level request';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_agency::text,72361));
 select * into v from public.cad_incidents
 where agency_id=p_agency and id=p_incident for update;
 if not found or v.status='CLOSED' then raise exception 'Open incident not found';end if;
 if v.version<>p_expected_version then raise exception 'CAD version conflict' using errcode='40001';end if;
 select alarm_rank into previous_rank from public.cad_incident_alarm_state
 where agency_id=p_agency and incident_id=p_incident for update;
 if previous_rank is not null and p_level_rank<=previous_rank
 then raise exception 'Alarm level must advance';end if;
 -- NOTE: before enabling this RPC, validate plan ID, level ID, rank and name
 -- against the ACTIVE plan stored in agency configuration inside the transaction.
 -- Until that validation is implemented, this function MUST NOT be granted to clients.
 insert into public.cad_incident_alarm_state(agency_id,incident_id,alarm_name,alarm_rank,plan_id,recorded_by)
 values(p_agency,p_incident,btrim(p_level_name),p_level_rank,btrim(p_plan_id),auth.uid())
 on conflict(incident_id) do update
 set alarm_name=excluded.alarm_name,alarm_rank=excluded.alarm_rank,plan_id=excluded.plan_id,
 recorded_at=now(),recorded_by=excluded.recorded_by;
 update public.cad_incidents set version=version+1,updated_at=now()
 where agency_id=p_agency and id=p_incident;
 insert into public.cad_incident_events(agency_id,incident_id,event_type,payload,actor_id)
 values(p_agency,p_incident,'ALARM_LEVEL_CHANGED',
 jsonb_build_object('plan_id',p_plan_id,'alarm_name',p_level_name,'rank',p_level_rank,
 'prior_rank',previous_rank,'dispatch_performed',false),auth.uid());
 return jsonb_build_object('ok',true,'incident_version',v.version+1,'alarm_name',p_level_name,
 'units_dispatched',0);
end $fn$;

revoke all on function public.cad_set_incident_alarm_level(uuid,uuid,bigint,text,text,integer)
 from public,anon,authenticated;
-- Do not GRANT EXECUTE until the server verifies the configured active plan's alarm level.
commit;
