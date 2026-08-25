alter table public.evidence_objects
  add column backup_status text not null default 'pending' check (backup_status in ('pending','mirrored','failed','deleted')),
  add column backed_up_at timestamptz;

create or replace function private.set_evidence_backup(p_evidence_id uuid,p_status text)
returns void language plpgsql security definer set search_path=public,private,pg_temp as $$
begin
  if p_status not in ('mirrored','failed','deleted') then raise exception 'invalid_backup_status'; end if;
  update public.evidence_objects set backup_status=p_status,backed_up_at=case when p_status='mirrored' then now() else backed_up_at end where id=p_evidence_id;
  if not found then raise exception 'evidence_unavailable'; end if;
end $$;

create or replace function public.rpc_set_evidence_backup(p_evidence_id uuid,p_status text)
returns void language sql security invoker set search_path=public,private,pg_temp
as $$select private.set_evidence_backup(p_evidence_id,p_status)$$;

create or replace function private.admin_register_profile(
  p_user_id uuid,p_display_name text,p_role public.app_role,p_school_id uuid default null
)
returns void language plpgsql security definer set search_path=public,private,pg_temp as $$
begin
  if private.current_role() not in ('platform_admin','field_coordinator') then raise exception 'not_authorized'; end if;
  if private.current_role()='field_coordinator' and (p_role<>'school_operator' or p_school_id is null or not private.has_school_role(p_school_id,array['field_coordinator']::public.app_role[])) then raise exception 'not_authorized'; end if;
  insert into public.profiles(user_id,display_name,role) values(p_user_id,p_display_name,p_role)
  on conflict(user_id) do update set display_name=excluded.display_name,role=excluded.role,disabled_at=null;
  if p_school_id is not null then perform private.admin_add_membership(p_school_id,p_user_id,p_role); end if;
end $$;

create or replace function public.rpc_admin_register_profile(p_user_id uuid,p_display_name text,p_role public.app_role,p_school_id uuid default null)
returns void language sql security invoker set search_path=public,private,pg_temp
as $$select private.admin_register_profile(p_user_id,p_display_name,p_role,p_school_id)$$;

revoke all on function public.rpc_set_evidence_backup(uuid,text) from public,anon,authenticated;
grant execute on function public.rpc_set_evidence_backup(uuid,text) to service_role;
grant execute on function public.rpc_admin_register_profile(uuid,text,public.app_role,uuid) to authenticated,service_role;
grant execute on function private.set_evidence_backup(uuid,text) to service_role;
grant execute on function private.admin_register_profile(uuid,text,public.app_role,uuid) to service_role;
