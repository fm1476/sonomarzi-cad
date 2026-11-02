-- STAGED ONLY. NOT APPLIED TO SUPABASE.
-- Agency CFS catalog and directional, discipline-specific automatic call mappings.
create table if not exists public.cad_cfs_types(
 id uuid primary key default gen_random_uuid(),
 agency_id uuid not null references public.cad_agencies(id),
 discipline text not null check(discipline in ('LAW','FIRE','EMS')),
 name text not null check(length(btrim(name)) between 1 and 160),
 code text not null check(length(btrim(code)) between 1 and 32),
 category text not null default '',
 priority text not null default 'P2',
 description text not null default '',
 icon text not null default '',
 color text not null default '',
 response_plan_id uuid,
 publication text not null default 'DRAFT' check(publication in ('DRAFT','ACTIVE','INACTIVE')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(agency_id,discipline,code),
 unique(agency_id,id),
 unique(agency_id,id,discipline)
);
create table if not exists public.cad_cfs_auto_links(
 agency_id uuid not null references public.cad_agencies(id),
 source_type_id uuid not null references public.cad_cfs_types(id) on delete cascade,
 target_discipline text not null check(target_discipline in ('LAW','FIRE','EMS')),
 target_type_id uuid not null references public.cad_cfs_types(id),
 created_at timestamptz not null default now(),
 primary key(agency_id,source_type_id,target_discipline),
 foreign key(agency_id,source_type_id) references public.cad_cfs_types(agency_id,id),
 foreign key(agency_id,target_type_id,target_discipline) references public.cad_cfs_types(agency_id,id,discipline),
 check(source_type_id<>target_type_id)
);
create table if not exists public.cad_combined_incident_links(
 agency_id uuid not null references public.cad_agencies(id),
 root_incident_id uuid not null references public.cad_incidents(id),
 incident_id uuid not null references public.cad_incidents(id),
 discipline text not null check(discipline in ('LAW','FIRE','EMS')),
 created_at timestamptz not null default now(),
 primary key(agency_id,incident_id),
 unique(agency_id,root_incident_id,discipline)
);
create index if not exists cad_combined_root_idx on public.cad_combined_incident_links(agency_id,root_incident_id);
alter table public.cad_cfs_types enable row level security;
alter table public.cad_cfs_auto_links enable row level security;
alter table public.cad_combined_incident_links enable row level security;
create policy cad_cfs_types_read on public.cad_cfs_types for select to authenticated using(public.cad_has_access(agency_id,false));
create policy cad_cfs_auto_links_read on public.cad_cfs_auto_links for select to authenticated using(public.cad_has_access(agency_id,false));
create policy cad_combined_incident_links_read on public.cad_combined_incident_links for select to authenticated using(public.cad_has_access(agency_id,false));
revoke all on public.cad_cfs_types,public.cad_cfs_auto_links,public.cad_combined_incident_links from public,anon,authenticated;
grant select on public.cad_cfs_types,public.cad_cfs_auto_links,public.cad_combined_incident_links to authenticated;
-- Catalog writes require an authenticated, authorized RPC; direct table writes are intentionally disabled.
create or replace function public.cad_save_cfs_type(p_agency uuid,p_type jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_id uuid;v_d text;v_name text;v_code text;v_pub text;v_target jsonb;v_target_id uuid;v_target_d text;
begin
 if auth.uid() is null or not public.cad_has_access(p_agency,true) then raise exception 'CAD configuration access denied' using errcode='42501';end if;
 v_id:=coalesce(nullif(p_type->>'id','')::uuid,gen_random_uuid());
 v_d:=upper(btrim(coalesce(p_type->>'discipline','')));
 v_name:=btrim(coalesce(p_type->>'name',''));
 v_code:=upper(btrim(coalesce(p_type->>'code','')));
 v_pub:=upper(coalesce(p_type->>'publication','DRAFT'));
 if v_d not in ('LAW','FIRE','EMS') or length(v_name) not between 1 and 160 or length(v_code) not between 1 and 32 or v_pub not in ('DRAFT','ACTIVE','INACTIVE') then raise exception 'Invalid CFS type';end if;
 insert into public.cad_cfs_types(id,agency_id,discipline,name,code,category,priority,description,icon,color,publication)
 values(v_id,p_agency,v_d,v_name,v_code,left(coalesce(p_type->>'category',''),100),left(coalesce(p_type->>'priority','P2'),16),left(coalesce(p_type->>'description',''),2000),left(coalesce(p_type->>'icon',''),100),left(coalesce(p_type->>'color',''),32),v_pub)
 on conflict(id) do update set name=excluded.name,code=excluded.code,category=excluded.category,priority=excluded.priority,description=excluded.description,icon=excluded.icon,color=excluded.color,publication=excluded.publication,updated_at=now()
 where public.cad_cfs_types.agency_id=p_agency and public.cad_cfs_types.discipline=excluded.discipline;
 if not found then raise exception 'Cannot change agency or discipline for existing CFS type';end if;
 delete from public.cad_cfs_auto_links where agency_id=p_agency and source_type_id=v_id;
 for v_target in select value from jsonb_array_elements(coalesce(p_type->'autoCreate','[]'::jsonb)) loop
  v_target_id:=(v_target#>>'{}')::uuid;
  select discipline into v_target_d from public.cad_cfs_types where id=v_target_id and agency_id=p_agency and publication='ACTIVE';
  if v_target_d is null or v_target_d=v_d then raise exception 'Linked CFS type must be an active type in another discipline';end if;
  insert into public.cad_cfs_auto_links(agency_id,source_type_id,target_discipline,target_type_id) values(p_agency,v_id,v_target_d,v_target_id);
 end loop;
 return jsonb_build_object('id',v_id,'ok',true);
end $$;
revoke all on function public.cad_save_cfs_type(uuid,jsonb) from public,anon;
grant execute on function public.cad_save_cfs_type(uuid,jsonb) to authenticated;
-- Combined creation is one transaction: any failed child creation rolls back all calls.
-- This RPC delegates numbering and event audit to the existing cad_create_incident_auto RPC.
create or replace function public.cad_create_combined_incident(p_agency uuid,p_cfs_type uuid,p_priority text,p_location text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_primary public.cad_cfs_types;v_created public.cad_incidents;v_root uuid;v_incident uuid;v_ids jsonb:='[]'::jsonb;v_row record;
begin
 if auth.uid() is null or not public.cad_has_access(p_agency,true) then raise exception 'CAD access denied' using errcode='42501';end if;
 select * into v_primary from public.cad_cfs_types where id=p_cfs_type and agency_id=p_agency and publication='ACTIVE';
 if not found then raise exception 'Active CFS type not found';end if;
 for v_row in
  select v_primary.id as id,v_primary.discipline as discipline,v_primary.name as name,0 as sort_order
  union all
  select t.id,t.discipline,t.name,1 from public.cad_cfs_auto_links l join public.cad_cfs_types t on t.id=l.target_type_id and t.agency_id=l.agency_id
   where l.agency_id=p_agency and l.source_type_id=p_cfs_type and t.publication='ACTIVE'
  order by sort_order,discipline
 loop
  v_created:=public.cad_create_incident_auto(p_agency,v_row.discipline,v_row.name,coalesce(nullif(p_priority,''),v_primary.priority),p_location);
  v_incident:=v_created.id;
  if v_incident is null then raise exception 'CAD incident creation returned no incident ID';end if;
  if v_root is null then v_root:=v_incident;end if;
  insert into public.cad_combined_incident_links(agency_id,root_incident_id,incident_id,discipline) values(p_agency,v_root,v_incident,v_row.discipline);
  v_ids:=v_ids||jsonb_build_array(jsonb_build_object('id',v_incident,'incident_number',v_created.incident_number,'discipline',v_row.discipline,'cfs_type_id',v_row.id));
 end loop;
 return jsonb_build_object('root_incident_id',v_root,'incidents',v_ids);
end $$;
revoke all on function public.cad_create_combined_incident(uuid,uuid,text,text) from public,anon;
grant execute on function public.cad_create_combined_incident(uuid,uuid,text,text) to authenticated;
