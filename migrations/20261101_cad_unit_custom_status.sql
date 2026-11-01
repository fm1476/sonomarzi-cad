-- Per-unit custom status selection, paired with canonical dispatch state.
create table if not exists public.cad_unit_custom_status (
 agency_id uuid not null references public.cad_agencies(id),
 unit_id uuid not null references public.cad_units(id),
 code text not null,
 canonical_status text not null,
 updated_at timestamptz not null default now(),
 updated_by uuid,
 primary key(agency_id,unit_id),
 foreign key(agency_id,code) references public.cad_unit_status_catalog(agency_id,code)
);
alter table public.cad_unit_custom_status enable row level security;
revoke all on public.cad_unit_custom_status from public,anon,authenticated;
grant select on public.cad_unit_custom_status to authenticated;
drop policy if exists cad_unit_custom_status_read on public.cad_unit_custom_status;
create policy cad_unit_custom_status_read on public.cad_unit_custom_status for select to authenticated using(public.cad_has_access(agency_id,false));
create or replace function public.cad_apply_custom_unit_status(
 p_agency uuid,p_unit uuid,p_code text,p_expected_version bigint
) returns jsonb language plpgsql security definer set search_path to '' as $$
declare v_unit public.cad_units;v_catalog public.cad_unit_status_catalog;v_assigned integer;
begin
 if auth.uid() is null or not public.cad_has_access(p_agency,true) then raise exception 'CAD access denied' using errcode='42501';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_agency::text,72361));
 select * into v_unit from public.cad_units where id=p_unit and agency_id=p_agency for update;
 if not found then raise exception 'Unit not found';end if;
 if v_unit.version<>p_expected_version then raise exception 'Unit version conflict' using errcode='40001';end if;
 select * into v_catalog from public.cad_unit_status_catalog where agency_id=p_agency and code=upper(btrim(p_code)) and enabled;
 if not found then raise exception 'Configured unit status unavailable';end if;
 if v_catalog.discipline not in ('ALL',v_unit.discipline) then raise exception 'Status not applicable to unit discipline';end if;
 select count(*) into v_assigned from public.cad_assignments a where a.agency_id=p_agency and a.unit_id=p_unit and a.cleared_at is null;
 if v_assigned>1 then raise exception 'Multiple unit assignments require dispatcher review';end if;
 if v_assigned=0 and v_catalog.canonical_status not in ('AVAILABLE','OUT_OF_SERVICE') then raise exception 'Unassigned unit status must map to AVAILABLE or OUT_OF_SERVICE';end if;
 if v_assigned>0 and v_catalog.canonical_status not in ('DISPATCHED','ENROUTE','ONSCENE','TRANSPORTING','AT_HOSPITAL','OUT_OF_SERVICE') then raise exception 'Assigned unit cannot be marked available without clearing the call';end if;
 update public.cad_units set status=v_catalog.canonical_status,version=version+1 where id=p_unit and agency_id=p_agency;
 insert into public.cad_unit_custom_status(agency_id,unit_id,code,canonical_status,updated_at,updated_by)
 values(p_agency,p_unit,v_catalog.code,v_catalog.canonical_status,now(),auth.uid())
 on conflict(agency_id,unit_id) do update set code=excluded.code,canonical_status=excluded.canonical_status,updated_at=now(),updated_by=auth.uid();
 if v_assigned>0 then
 insert into public.cad_incident_events(agency_id,incident_id,event_type,payload,actor_id)
 select p_agency,a.incident_id,'UNIT_STATUS_CHANGED',jsonb_build_object('unit_id',p_unit,'from',v_unit.status,'to',v_catalog.canonical_status,'configured_status',v_catalog.code),auth.uid()
 from public.cad_assignments a where a.agency_id=p_agency and a.unit_id=p_unit and a.cleared_at is null;
 end if;
 return jsonb_build_object('ok',true,'unit_version',v_unit.version+1,'status',v_catalog.canonical_status,'custom_status',v_catalog.code);
end $$;
revoke all on function public.cad_apply_custom_unit_status(uuid,uuid,text,bigint) from public,anon;
grant execute on function public.cad_apply_custom_unit_status(uuid,uuid,text,bigint) to authenticated;
