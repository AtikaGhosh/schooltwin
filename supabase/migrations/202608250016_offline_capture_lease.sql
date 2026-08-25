-- A capture recorded offline may be uploaded after its work window, but only
-- under a lease issued before recording and only within a bounded upload delay.

alter table private.work_leases
  add column upload_deadline timestamptz;
update private.work_leases set upload_deadline = expires_at + interval '24 hours';
alter table private.work_leases alter column upload_deadline set not null;
alter table private.capture_intents
  add column offline_work_lease_id uuid references private.work_leases(id);

create or replace function private.issue_work_lease(
  p_school_id uuid,p_device_id uuid,p_device_token_hash text,p_task_id uuid,p_token_hash text
)
returns jsonb language plpgsql security definer set search_path=public,private,pg_temp as $$
declare v_expiry timestamptz; v_upload_deadline timestamptz;
begin
  if not private.has_school_role(p_school_id,array['school_operator']::public.app_role[])
    or not private.valid_device_lease(p_school_id,p_device_id,auth.uid(),p_device_token_hash) then
    raise exception 'not_authorized';
  end if;
  select t.scheduled_end + make_interval(secs=>s.completion_grace_seconds)
    into strict v_expiry from public.verification_tasks t join public.schools s on s.id=t.school_id
    where t.id=p_task_id and t.school_id=p_school_id and t.status in ('scheduled','in_progress');
  v_upload_deadline := v_expiry + interval '24 hours';
  insert into private.work_leases(school_id,task_id,device_id,actor_id,token_hash,expires_at,upload_deadline)
  values(p_school_id,p_task_id,p_device_id,auth.uid(),p_token_hash,v_expiry,v_upload_deadline);
  return jsonb_build_object(
    'taskId',p_task_id,
    'expiresAt',v_expiry,
    'uploadDeadline',v_upload_deadline
  );
end $$;

create or replace function private.begin_offline_capture_v2(
  p_school_id uuid,p_device_id uuid,p_device_token_hash text,p_task_id uuid,
  p_object_path text,p_capture_lease_hash text,p_offline_lease_hash text,
  p_client_started_at timestamptz
)
returns jsonb language plpgsql security definer set search_path=public,private,pg_temp as $$
declare
  v_lease private.work_leases%rowtype;
  v_task public.verification_tasks%rowtype;
  v_result jsonb;
  v_intent_id uuid;
begin
  select * into strict v_task from public.verification_tasks
  where id=p_task_id and school_id=p_school_id;
  select * into strict v_lease from private.work_leases
  where token_hash=p_offline_lease_hash and school_id=p_school_id and task_id=p_task_id
    and device_id=p_device_id and actor_id=auth.uid() and upload_deadline>now()
    and used_at is null and revoked_at is null for update;
  if p_client_started_at < v_task.scheduled_start
    or p_client_started_at > v_task.scheduled_end then
    raise exception 'offline_capture_outside_lease';
  end if;
  update private.work_leases set used_at=now() where id=v_lease.id;
  if v_task.status='missed' then
    update public.verification_tasks
    set status='in_progress',started_at=p_client_started_at
    where id=v_task.id and status='missed';
  end if;
  v_result := private.begin_capture(
    p_school_id,p_device_id,p_device_token_hash,p_task_id,p_object_path,
    p_capture_lease_hash,true
  );
  v_intent_id := (v_result->>'captureIntentId')::uuid;
  update private.capture_intents set offline_work_lease_id=v_lease.id where id=v_intent_id;
  return v_result;
exception when no_data_found then raise exception 'invalid_work_lease';
end $$;

create or replace function private.finalize_capture_v2(
  p_mutation_id uuid,p_school_id uuid,p_device_id uuid,p_device_token_hash text,
  p_capture_intent_id uuid,p_byte_length bigint,p_mime_type text,p_client_sha256 text,
  p_client_started_at timestamptz,p_client_ended_at timestamptz,
  p_marker_method text,p_marker_value text,p_expected_marker_matched boolean
)
returns jsonb language plpgsql security definer set search_path=public,private,pg_temp as $$
declare
  v_intent private.capture_intents%rowtype;
  v_task public.verification_tasks%rowtype;
  v_lease private.work_leases%rowtype;
begin
  select * into strict v_intent from private.capture_intents
  where id=p_capture_intent_id and school_id=p_school_id and device_id=p_device_id;
  select * into strict v_task from public.verification_tasks where id=v_intent.task_id;
  if p_client_ended_at <= p_client_started_at
    or extract(epoch from (p_client_ended_at-p_client_started_at)) not between 10 and 60 then
    raise exception 'invalid_capture_duration';
  end if;
  if v_intent.timing_assurance='offline_claimed' then
    select * into strict v_lease from private.work_leases where id=v_intent.offline_work_lease_id;
    if p_client_started_at < v_task.scheduled_start
      or p_client_started_at > v_task.scheduled_end
      or p_client_ended_at > v_lease.expires_at then
      raise exception 'offline_capture_outside_lease';
    end if;
  elsif p_client_started_at < v_intent.created_at - interval '1 minute'
    or p_client_started_at > v_intent.created_at + interval '5 minutes' then
    raise exception 'capture_start_mismatch';
  end if;
  return private.finalize_capture(
    p_mutation_id,p_school_id,p_device_id,p_device_token_hash,p_capture_intent_id,
    p_byte_length,p_mime_type,p_client_sha256,p_client_started_at,p_client_ended_at,
    p_marker_method,p_marker_value,p_expected_marker_matched
  );
end $$;

create or replace function public.rpc_begin_offline_capture_v2(
  p_school_id uuid,p_device_id uuid,p_device_token_hash text,p_task_id uuid,
  p_object_path text,p_capture_lease_hash text,p_offline_lease_hash text,
  p_client_started_at timestamptz
)
returns jsonb language sql security invoker set search_path=public,private,pg_temp
as $$select private.begin_offline_capture_v2(
  p_school_id,p_device_id,p_device_token_hash,p_task_id,p_object_path,
  p_capture_lease_hash,p_offline_lease_hash,p_client_started_at
)$$;

create or replace function public.rpc_finalize_capture_v2(
  p_mutation_id uuid,p_school_id uuid,p_device_id uuid,p_device_token_hash text,
  p_capture_intent_id uuid,p_byte_length bigint,p_mime_type text,p_client_sha256 text,
  p_client_started_at timestamptz,p_client_ended_at timestamptz,
  p_marker_method text,p_marker_value text,p_expected_marker_matched boolean
)
returns jsonb language sql security invoker set search_path=public,private,pg_temp
as $$select private.finalize_capture_v2(
  p_mutation_id,p_school_id,p_device_id,p_device_token_hash,p_capture_intent_id,
  p_byte_length,p_mime_type,p_client_sha256,p_client_started_at,p_client_ended_at,
  p_marker_method,p_marker_value,p_expected_marker_matched
)$$;

revoke all on function private.begin_offline_capture_v2(uuid,uuid,text,uuid,text,text,text,timestamptz) from public,anon,authenticated;
revoke all on function private.finalize_capture_v2(uuid,uuid,uuid,text,uuid,bigint,text,text,timestamptz,timestamptz,text,text,boolean) from public,anon,authenticated;
revoke all on function public.rpc_begin_offline_capture_v2(uuid,uuid,text,uuid,text,text,text,timestamptz) from public,anon;
revoke all on function public.rpc_finalize_capture_v2(uuid,uuid,uuid,text,uuid,bigint,text,text,timestamptz,timestamptz,text,text,boolean) from public,anon;
grant execute on function private.begin_offline_capture_v2(uuid,uuid,text,uuid,text,text,text,timestamptz) to authenticated,service_role;
grant execute on function private.finalize_capture_v2(uuid,uuid,uuid,text,uuid,bigint,text,text,timestamptz,timestamptz,text,text,boolean) to authenticated,service_role;
grant execute on function public.rpc_begin_offline_capture_v2(uuid,uuid,text,uuid,text,text,text,timestamptz) to authenticated,service_role;
grant execute on function public.rpc_finalize_capture_v2(uuid,uuid,uuid,text,uuid,bigint,text,text,timestamptz,timestamptz,text,text,boolean) to authenticated,service_role;
