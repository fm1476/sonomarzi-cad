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
declare v public.cad_incidents; previous_rank integer; v_raw text; v_plan jsonb; v_level jsonb; v_settings jsonb; v_matches integer;
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
 -- Validate the requested alarm level against the active plan in the SAME transaction.
 select payload into v_settings from public.cad_agency_config_documents
 where agency_id=p_agency and document_key='smcad-response-plans-v1';
 v_raw:=v_settings->>'raw';
 if v_raw is null then raise exception 'Response plans are not configured';end if;
 if pg_catalog.jsonb_typeof(v_raw::jsonb) <> 'array'
 then raise exception 'Response plans are not configured';end if;
 select count(*) into v_matches from pg_catalog.jsonb_array_elements(v_raw::jsonb) p(value)
 where p.value->>'id'=p_plan_id and upper(coalesce(p.value->>'status','')) in ('ACTIVE','PUBLISHED');
 if v_matches<>1 then raise exception 'Plan identifier is not unique and active';end if;
 select p.value into v_plan from pg_catalog.jsonb_array_elements(v_raw::jsonb) p(value)
 where p.value->>'id'=p_plan_id
   and upper(coalesce(p.value->>'status','')) in ('ACTIVE','PUBLISHED')
   and upper(coalesce(p.value->>'discipline',''))=upper(v.discipline)
   and upper(coalesce(p.value->>'type',''))=upper(v.type)
   and (nullif(p.value->>'priority','') is null or p.value->>'priority'=v.priority)
 limit 1;
 if v_plan is null then raise exception 'Active response plan does not match incident';end if;
 -- Reject ambiguous active plans that resolve to this same incident.
 select count(*) into v_matches from pg_catalog.jsonb_array_elements(v_raw::jsonb) p(value)
 where upper(coalesce(p.value->>'status','')) in ('ACTIVE','PUBLISHED')
   and upper(coalesce(p.value->>'discipline',''))=upper(v.discipline)
   and upper(coalesce(p.value->>'type',''))=upper(v.type)
   and (nullif(p.value->>'priority','') is null or p.value->>'priority'=v.priority)
   and upper(coalesce(nullif(btrim(coalesce(p.value->>'area',p.value->>'zone','')),''),'DEFAULT')) in ('DEFAULT','*');
 if v_matches>1 then raise exception 'Conflicting active response plans require review';end if;
 -- The plan configuration is scoped by the agency document and the incident row
 -- is locked. All alarm changes remain separate from dispatch transactions.
 select count(*) into v_matches from pg_catalog.jsonb_array_elements(coalesce(v_plan->'alarmLevels','[]'::jsonb)) l(value)
 where l.value->>'name'=p_level_name and l.value->>'rank'=p_level_rank::text;
 if v_matches<>1 then raise exception 'Alarm level is missing or ambiguous';end if;
 select l.value into v_level from pg_catalog.jsonb_array_elements(coalesce(v_plan->'alarmLevels','[]'::jsonb)) l(value)
 where l.value->>'name'=p_level_name and l.value->>'rank'=p_level_rank::text
 limit 1;
 if v_level is null then raise exception 'Requested alarm level is not configured in the active plan';end if;
 if jsonb_typeof(coalesce(v_level->'resources','null'::jsonb)) <> 'array'
    or jsonb_array_length(coalesce(v_level->'resources','[]'::jsonb)) < 1
 then raise exception 'Selected alarm level contains no valid resource array';end if;
 -- Note: geographic plan restrictions require a trusted, persisted response area
 -- on the incident. Until authoritative area matching is available, restricted
 -- plans MUST NOT be accepted for alarm transitions.
 if nullif(btrim(coalesce(v_plan->>'area',v_plan->>'zone','')),'') is not null
    and upper(btrim(coalesce(v_plan->>'area',v_plan->>'zone',''))) not in ('DEFAULT','*')
 then raise exception 'Geographic alarm plan requires verified incident response area';end if;
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
-- GRANT remains intentionally absent until migration review and authenticated acceptance.
-- Do not GRANT EXECUTE until the server verifies the configured active plan's alarm level.
commit;
