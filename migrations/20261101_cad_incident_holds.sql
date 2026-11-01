-- STAGED FOR CONSOLIDATED CAD RELEASE. NOT APPLIED TO SUPABASE.
-- HOLD is separate from assignment state: calls may be held with or without active units.
create table if not exists public.cad_incident_holds (
 agency_id uuid not null references public.cad_agencies(id),
 incident_id uuid not null references public.cad_incidents(id),
 active boolean not null default true,
 reason text not null default 'DISPATCHER_HOLD',
 requested_unit text,
 requested_capability text,
 notes text not null default '',
 held_at timestamptz not null default now(),
 held_by uuid,
 released_at timestamptz,
 released_by uuid,
 updated_at timestamptz not null default now(),
 primary key (agency_id,incident_id),
 constraint cad_incident_holds_reason_ck check
 (reason in ('UNIT_BUSY','SPECIFIC_UNIT','SPECIALTY_RESOURCE','DISPATCHER_HOLD','AWAITING_INFORMATION','OTHER'))
);
create index if not exists cad_incident_holds_active_idx on public.cad_incident_holds(agency_id,active);
alter table public.cad_incident_holds enable row level security;
drop policy if exists cad_incident_holds_read on public.cad_incident_holds;
create policy cad_incident_holds_read on public.cad_incident_holds
 for select to authenticated using(public.cad_has_access(agency_id,false));
revoke all on public.cad_incident_holds from public,anon,authenticated;
grant select on public.cad_incident_holds to authenticated;
create or replace function public.cad_set_incident_hold(
 p_agency uuid,p_incident uuid,p_expected_version bigint,p_hold boolean,
 p_reason text default 'DISPATCHER_HOLD',
 p_requested_unit text default null,p_requested_capability text default null,p_notes text default ''
) returns jsonb language plpgsql security definer set search_path to '' as $$
declare v_i public.cad_incidents;v_reason text:=upper(btrim(coalesce(p_reason,'DISPATCHER_HOLD')));
begin
 if auth.uid() is null or not public.cad_has_access(p_agency,true) then
  raise exception 'CAD access denied' using errcode='42501';
 end if;
 if p_hold is null then raise exception 'Hold action is required';end if;
 if length(coalesce(p_requested_unit,''))>40 or length(coalesce(p_requested_capability,''))>120
    or length(coalesce(p_notes,''))>1000 then raise exception 'Hold details exceed limits';end if;
 if v_reason not in ('UNIT_BUSY','SPECIFIC_UNIT','SPECIALTY_RESOURCE','DISPATCHER_HOLD','AWAITING_INFORMATION','OTHER') then
  raise exception 'Unknown hold reason';
 end if;
 select * into v_i from public.cad_incidents where id=p_incident and agency_id=p_agency for update;
 if not found or v_i.status='CLOSED' then raise exception 'Only open incidents may be held';end if;
 if v_i.version<>p_expected_version then
  raise exception 'CAD version conflict. Refresh incident before changing hold.' using errcode='40001';
 end if;
 if p_hold then
  insert into public.cad_incident_holds
   (agency_id,incident_id,active,reason,requested_unit,requested_capability,notes,held_at,held_by,released_at,released_by,updated_at)
  values(p_agency,p_incident,true,v_reason,nullif(btrim(p_requested_unit),''),nullif(btrim(p_requested_capability),''),
   coalesce(p_notes,''),now(),auth.uid(),null,null,now())
  on conflict(agency_id,incident_id) do update set active=true,reason=excluded.reason,
    requested_unit=excluded.requested_unit,requested_capability=excluded.requested_capability,
    notes=excluded.notes,held_at=now(),held_by=auth.uid(),
    released_at=null,released_by=null,updated_at=now();
 else
  update public.cad_incident_holds set active=false,released_at=now(),released_by=auth.uid(),updated_at=now()
   where agency_id=p_agency and incident_id=p_incident and active;
 end if;
 update public.cad_incidents set version=version+1,updated_at=now()
  where id=p_incident and agency_id=p_agency;
 insert into public.cad_incident_events(agency_id,incident_id,event_type,payload,actor_id)
 values(p_agency,p_incident,case when p_hold then 'INCIDENT_HELD' else 'INCIDENT_HOLD_RELEASED' end,
  jsonb_build_object('reason',v_reason,'requested_unit',p_requested_unit,'requested_capability',p_requested_capability,'notes',p_notes),auth.uid());
 return jsonb_build_object('ok',true,'incident_id',p_incident,'hold_active',p_hold,'incident_version',v_i.version+1);
end $$;
revoke all on function public.cad_set_incident_hold(uuid,uuid,bigint,boolean,text,text,text,text) from public,anon;
grant execute on function public.cad_set_incident_hold(uuid,uuid,bigint,boolean,text,text,text,text) to authenticated;
