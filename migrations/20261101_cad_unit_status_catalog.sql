-- Configurable agency-wide unit status display catalog. Canonical CAD status is never overwritten.
create table if not exists public.cad_unit_status_catalog (
 agency_id uuid not null references public.cad_agencies(id),
 code text not null,
 label text not null,
 canonical_status text not null,
 discipline text not null default 'ALL',
 radio_phrases text[] not null default '{}',
 enabled boolean not null default true,
 updated_at timestamptz not null default now(),
 updated_by uuid,
 primary key(agency_id,code),
 constraint cad_unit_status_code_check check(code ~ '^[A-Z0-9_]{2,32}$'),
 constraint cad_unit_status_label_check check(length(btrim(label)) between 2 and 60),
 constraint cad_unit_status_canonical_check check(canonical_status in ('AVAILABLE','DISPATCHED','ENROUTE','ONSCENE','TRANSPORTING','AT_HOSPITAL','OUT_OF_SERVICE')),
 constraint cad_unit_status_discipline_check check(discipline in ('ALL','LAW','FIRE','EMS')),
 constraint cad_unit_status_radio_limit check(cardinality(radio_phrases)<=12)
);
alter table public.cad_unit_status_catalog enable row level security;
revoke all on public.cad_unit_status_catalog from public,anon,authenticated;
grant select on public.cad_unit_status_catalog to authenticated;
drop policy if exists cad_unit_status_catalog_read on public.cad_unit_status_catalog;
create policy cad_unit_status_catalog_read on public.cad_unit_status_catalog for select to authenticated using(public.cad_has_access(agency_id,false));
create or replace function public.cad_save_unit_status_catalog(
 p_agency uuid,p_code text,p_label text,p_canonical text,p_discipline text,p_phrases text[],p_enabled boolean
) returns jsonb language plpgsql security definer set search_path to '' as $$
declare v_code text:=upper(btrim(coalesce(p_code,'')));v_canonical text:=upper(btrim(coalesce(p_canonical,'')));v_discipline text:=upper(btrim(coalesce(p_discipline,'')));v_label text:=btrim(coalesce(p_label,''));
begin
 if auth.uid() is null or not public.cad_has_access(p_agency,true) then raise exception 'CAD access denied' using errcode='42501';end if;
 if v_code !~ '^[A-Z0-9_]{2,32}$' or length(v_label) not between 2 and 60 then raise exception 'Invalid status code or label';end if;
 if v_canonical not in ('AVAILABLE','DISPATCHED','ENROUTE','ONSCENE','TRANSPORTING','AT_HOSPITAL','OUT_OF_SERVICE') then raise exception 'Invalid canonical status';end if;
 if v_discipline not in ('ALL','LAW','FIRE','EMS') then raise exception 'Invalid discipline';end if;
 if coalesce(cardinality(p_phrases),0)>12 or exists(select 1 from unnest(coalesce(p_phrases,'{}'::text[])) t where length(t)>90 or length(btrim(t))<2) then raise exception 'Invalid radio aliases';end if;
 insert into public.cad_unit_status_catalog(agency_id,code,label,canonical_status,discipline,radio_phrases,enabled,updated_at,updated_by)
 values(p_agency,v_code,v_label,v_canonical,v_discipline,coalesce(p_phrases,'{}'::text[]),coalesce(p_enabled,true),now(),auth.uid())
 on conflict (agency_id,code) do update set label=excluded.label,canonical_status=excluded.canonical_status,discipline=excluded.discipline,radio_phrases=excluded.radio_phrases,enabled=excluded.enabled,updated_at=now(),updated_by=auth.uid();
 return jsonb_build_object('ok',true,'code',v_code);
end $$;
revoke all on function public.cad_save_unit_status_catalog(uuid,text,text,text,text,text[],boolean) from public,anon;
grant execute on function public.cad_save_unit_status_catalog(uuid,text,text,text,text,text[],boolean) to authenticated;
