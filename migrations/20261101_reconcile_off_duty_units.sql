-- Explicit reconciliation of a legacy off-duty roster record with agency master.
-- No existing rows change when this migration is applied.
create table if not exists public.cad_unit_configuration_events (
 id uuid primary key default gen_random_uuid(),
 agency_id uuid not null references public.cad_agencies(id),
 unit_id uuid not null references public.cad_units(id),
 actor_id uuid not null,
 previous_definition jsonb not null,
 revised_definition jsonb not null,
 changed_at timestamptz not null default now()
);
create index if not exists cad_unit_configuration_events_by_unit
 on public.cad_unit_configuration_events(agency_id,unit_id,changed_at desc);
alter table public.cad_unit_configuration_events enable row level security;
drop policy if exists cad_unit_configuration_events_read on public.cad_unit_configuration_events;
create policy cad_unit_configuration_events_read on public.cad_unit_configuration_events
 for select to authenticated using(public.cad_has_access(agency_id,false));
revoke all on public.cad_unit_configuration_events from anon,authenticated;
grant select on public.cad_unit_configuration_events to authenticated;
create or replace function public.cad_reconcile_off_duty_unit(
 p_agency uuid,p_unit uuid,p_expected_version bigint,
 p_discipline text,p_resource_type text,p_home_agency text
) returns jsonb language plpgsql security definer set search_path to '' as $$
declare
 v public.cad_units;
 v_discipline text:=upper(btrim(p_discipline));
 v_type text:=upper(btrim(p_resource_type));
 v_home text:=nullif(btrim(p_home_agency),'');
 v_old jsonb;
 v_new jsonb;
begin
 if auth.uid() is null or not public.cad_has_access(p_agency,true) then
  raise exception 'CAD access denied' using errcode='42501';
 end if;
 if v_discipline not in ('LAW','FIRE','EMS') then raise exception 'Invalid discipline';end if;
 if v_type !~ '^[A-Z0-9_ -]{2,40}$' then raise exception 'Invalid resource type';end if;
 if v_home is null or length(v_home)>120 then raise exception 'Valid owning agency required';end if;
 select * into v from public.cad_units
  where id=p_unit and agency_id=p_agency for update;
 if not found then raise exception 'Unit not found';end if;
 if v.version<>p_expected_version then
  raise exception 'CAD version conflict. Refresh roster and retry.' using errcode='40001';
 end if;
 if v.status<>'OFF_DUTY' then raise exception 'Only off-duty units can be reconciled';end if;
 if exists(select 1 from public.cad_assignments a
   where a.agency_id=p_agency and a.unit_id=p_unit and a.cleared_at is null)
 then raise exception 'Unit still has an active incident assignment';end if;
 v_old:=jsonb_build_object('discipline',v.discipline,'resource_type',v.resource_type,'home_agency_name',v.home_agency_name,'status',v.status);
 v_new:=jsonb_build_object('discipline',v_discipline,'resource_type',v_type,'home_agency_name',v_home,'status','AVAILABLE');
 update public.cad_units set discipline=v_discipline,resource_type=v_type,
  home_agency_name=v_home,status='AVAILABLE',is_temporary=false,version=version+1
 where id=v.id and agency_id=p_agency;
 insert into public.cad_unit_configuration_events
  (agency_id,unit_id,actor_id,previous_definition,revised_definition)
 values(p_agency,v.id,auth.uid(),v_old,v_new);
 insert into public.cad_unit_duty_events(agency_id,unit_id,event_type,actor_id)
 values(p_agency,v.id,'ON_DUTY',auth.uid());
 return jsonb_build_object('ok',true,'unit_id',v.id,'call_sign',v.call_sign,'status','AVAILABLE','version',v.version+1,'previous',v_old,'current',v_new);
end $$;
revoke all on function public.cad_reconcile_off_duty_unit(uuid,uuid,bigint,text,text,text) from public;
grant execute on function public.cad_reconcile_off_duty_unit(uuid,uuid,bigint,text,text,text) to authenticated;
