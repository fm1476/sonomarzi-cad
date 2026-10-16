-- Cloud settings v1: shared agency configuration and per-user workspace preferences.
-- Existing localStorage data remains untouched until a user explicitly imports it.
create table if not exists public.cad_agency_config_documents(
 agency_id uuid not null references public.cad_agencies(id),
 document_key text not null check (document_key ~ '^smcad-[a-z0-9.-]{1,100}$'),
 payload jsonb not null,
 version bigint not null default 1 check(version>0),
 updated_by uuid,
 updated_at timestamptz not null default now(),
 primary key(agency_id,document_key)
);
create table if not exists public.cad_user_preferences(
 agency_id uuid not null references public.cad_agencies(id),
 user_id uuid not null references auth.users(id),
 preference_key text not null check (preference_key ~ '^smcad-[a-z0-9.-]{1,100}$'),
 payload jsonb not null,
 version bigint not null default 1 check(version>0),
 updated_at timestamptz not null default now(),
 primary key(agency_id,user_id,preference_key)
);
alter table public.cad_agency_config_documents enable row level security;
alter table public.cad_user_preferences enable row level security;
drop policy if exists cad_config_read on public.cad_agency_config_documents;
create policy cad_config_read on public.cad_agency_config_documents for select to authenticated
 using(public.cad_has_access(agency_id,false));
drop policy if exists cad_user_pref_read on public.cad_user_preferences;
create policy cad_user_pref_read on public.cad_user_preferences for select to authenticated
 using(user_id=(select auth.uid()) and public.cad_has_access(agency_id,false));
revoke all on public.cad_agency_config_documents from anon,authenticated;
revoke all on public.cad_user_preferences from anon,authenticated;
grant select on public.cad_agency_config_documents,public.cad_user_preferences to authenticated;

create or replace function public.cad_save_cloud_setting(
 p_agency uuid,p_scope text,p_key text,p_payload jsonb,p_expected_version bigint
) returns jsonb language plpgsql security definer set search_path to '' as $$
declare v_uid uuid:=auth.uid();v_version bigint;v_next bigint;
begin
 if v_uid is null or not public.cad_has_access(p_agency,true) and p_scope='AGENCY' then raise exception 'CAD write access denied' using errcode='42501';end if;
 if not public.cad_has_access(p_agency,false) then raise exception 'CAD agency access denied' using errcode='42501';end if;
 if p_scope not in ('AGENCY','USER') then raise exception 'Invalid settings scope';end if;
 if p_key !~ '^smcad-[a-z0-9.-]{1,100}$' then raise exception 'Invalid settings key';end if;
 if p_payload is null or pg_catalog.octet_length(p_payload::text)>500000 then raise exception 'Settings payload is missing or too large';end if;
 if p_expected_version is not null and p_expected_version<0 then raise exception 'Invalid expected version';end if;
 -- Serialize settings writes per agency, user and document key.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_agency::text||':'||p_scope||':'||case when p_scope='USER' then v_uid::text else '' end||':'||p_key,118034));
 if p_scope='AGENCY' then
  select version into v_version from public.cad_agency_config_documents where agency_id=p_agency and document_key=p_key for update;
  if not found then
   if p_expected_version is distinct from 0 then raise exception 'CAD settings version conflict' using errcode='40001';end if;
   insert into public.cad_agency_config_documents(agency_id,document_key,payload,updated_by) values(p_agency,p_key,p_payload,v_uid);
   v_next:=1;
  else
   if p_expected_version is distinct from v_version then raise exception 'CAD settings version conflict' using errcode='40001';end if;
   update public.cad_agency_config_documents set payload=p_payload,version=version+1,updated_by=v_uid,updated_at=now()
    where agency_id=p_agency and document_key=p_key returning version into v_next;
  end if;
 else
  select version into v_version from public.cad_user_preferences where agency_id=p_agency and user_id=v_uid and preference_key=p_key for update;
  if not found then
   if p_expected_version is distinct from 0 then raise exception 'CAD settings version conflict' using errcode='40001';end if;
   insert into public.cad_user_preferences(agency_id,user_id,preference_key,payload) values(p_agency,v_uid,p_key,p_payload);
   v_next:=1;
  else
   if p_expected_version is distinct from v_version then raise exception 'CAD settings version conflict' using errcode='40001';end if;
   update public.cad_user_preferences set payload=p_payload,version=version+1,updated_at=now()
    where agency_id=p_agency and user_id=v_uid and preference_key=p_key returning version into v_next;
  end if;
 end if;
 return jsonb_build_object('ok',true,'scope',p_scope,'key',p_key,'version',v_next);
end $$;
revoke all on function public.cad_save_cloud_setting(uuid,text,text,jsonb,bigint) from public;
grant execute on function public.cad_save_cloud_setting(uuid,text,text,jsonb,bigint) to authenticated;
