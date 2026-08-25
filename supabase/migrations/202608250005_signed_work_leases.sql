-- Offline work is allowed only under a server-issued, task-scoped lease.
create table private.work_leases (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  task_id uuid not null references public.verification_tasks(id) on delete cascade,
  device_id uuid not null references public.devices(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index work_leases_lookup on private.work_leases(task_id,device_id,actor_id,expires_at)
  where used_at is null and revoked_at is null;

create or replace function private.issue_work_lease(
  p_school_id uuid,p_device_id uuid,p_device_token_hash text,p_task_id uuid,p_token_hash text
)
returns jsonb language plpgsql security definer set search_path=public,private,pg_temp as $$
declare v_expiry timestamptz;
begin
  if not private.has_school_role(p_school_id,array['school_operator']::public.app_role[])
    or not private.valid_device_lease(p_school_id,p_device_id,auth.uid(),p_device_token_hash) then
    raise exception 'not_authorized';
  end if;
  select least(t.scheduled_end + make_interval(secs=>s.completion_grace_seconds), now()+interval '24 hours')
    into strict v_expiry from public.verification_tasks t join public.schools s on s.id=t.school_id
    where t.id=p_task_id and t.school_id=p_school_id and t.status in ('scheduled','in_progress');
  insert into private.work_leases(school_id,task_id,device_id,actor_id,token_hash,expires_at)
  values(p_school_id,p_task_id,p_device_id,auth.uid(),p_token_hash,v_expiry);
  return jsonb_build_object('taskId',p_task_id,'expiresAt',v_expiry);
end $$;

create or replace function private.begin_offline_capture(
  p_school_id uuid,p_device_id uuid,p_device_token_hash text,p_task_id uuid,
  p_object_path text,p_capture_lease_hash text,p_offline_lease_hash text
)
returns jsonb language plpgsql security definer set search_path=public,private,pg_temp as $$
declare v_lease private.work_leases%rowtype; v_result jsonb;
begin
  select * into strict v_lease from private.work_leases
  where token_hash=p_offline_lease_hash and school_id=p_school_id and task_id=p_task_id
    and device_id=p_device_id and actor_id=auth.uid() and expires_at>now()
    and used_at is null and revoked_at is null for update;
  update private.work_leases set used_at=now() where id=v_lease.id;
  v_result := private.begin_capture(p_school_id,p_device_id,p_device_token_hash,p_task_id,p_object_path,p_capture_lease_hash,true);
  return v_result;
exception when no_data_found then raise exception 'invalid_work_lease';
end $$;

create or replace function public.rpc_issue_work_lease(
  p_school_id uuid,p_device_id uuid,p_device_token_hash text,p_task_id uuid,p_token_hash text
)
returns jsonb language sql security invoker set search_path=public,private,pg_temp
as $$select private.issue_work_lease(p_school_id,p_device_id,p_device_token_hash,p_task_id,p_token_hash)$$;

create or replace function public.rpc_begin_offline_capture(
  p_school_id uuid,p_device_id uuid,p_device_token_hash text,p_task_id uuid,
  p_object_path text,p_capture_lease_hash text,p_offline_lease_hash text
)
returns jsonb language sql security invoker set search_path=public,private,pg_temp
as $$select private.begin_offline_capture(p_school_id,p_device_id,p_device_token_hash,p_task_id,p_object_path,p_capture_lease_hash,p_offline_lease_hash)$$;

revoke all on private.work_leases from public,anon,authenticated;
revoke all on function private.issue_work_lease(uuid,uuid,text,uuid,text) from public,anon,authenticated;
revoke all on function private.begin_offline_capture(uuid,uuid,text,uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.rpc_issue_work_lease(uuid,uuid,text,uuid,text) from public,anon;
revoke all on function public.rpc_begin_offline_capture(uuid,uuid,text,uuid,text,text,text) from public,anon;
grant execute on function private.issue_work_lease(uuid,uuid,text,uuid,text) to authenticated;
grant execute on function private.begin_offline_capture(uuid,uuid,text,uuid,text,text,text) to authenticated;
grant execute on function public.rpc_issue_work_lease(uuid,uuid,text,uuid,text) to authenticated;
grant execute on function public.rpc_begin_offline_capture(uuid,uuid,text,uuid,text,text,text) to authenticated;
grant all on private.work_leases to service_role;
grant execute on function public.rpc_issue_work_lease(uuid,uuid,text,uuid,text) to service_role;
grant execute on function public.rpc_begin_offline_capture(uuid,uuid,text,uuid,text,text,text) to service_role;

alter table private.work_leases enable row level security;
