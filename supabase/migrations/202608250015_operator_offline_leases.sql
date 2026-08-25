-- Offline operator forms require a narrow, server-issued lease. The lease
-- authorizes one subject and is consumed by the first accepted mutation.

create table private.operator_work_leases (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  school_day_id uuid not null references public.school_days(id) on delete cascade,
  subject_kind text not null check (subject_kind in ('facility_check', 'operator_report')),
  subject_id uuid,
  device_id uuid not null references public.devices(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  work_valid_from timestamptz not null,
  work_valid_until timestamptz not null,
  upload_deadline timestamptz not null,
  used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (work_valid_from < work_valid_until),
  check (work_valid_until <= upload_deadline),
  check (
    (subject_kind = 'facility_check' and subject_id is not null)
    or (subject_kind = 'operator_report' and subject_id is null)
  )
);

create index operator_work_lease_lookup
  on private.operator_work_leases(school_id, device_id, actor_id, subject_kind, subject_id)
  where used_at is null and revoked_at is null;

alter table private.operator_work_leases enable row level security;
revoke all on private.operator_work_leases from public, anon, authenticated;
grant all on private.operator_work_leases to service_role;

create or replace function private.issue_operator_work_lease(
  p_school_id uuid,
  p_device_id uuid,
  p_device_token_hash text,
  p_subject_kind text,
  p_subject_id uuid,
  p_token_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_day public.school_days%rowtype;
  v_from timestamptz;
  v_until timestamptz;
begin
  if not private.has_school_role(p_school_id, array['school_operator']::public.app_role[])
    or not private.valid_device_lease(p_school_id, p_device_id, auth.uid(), p_device_token_hash) then
    raise exception 'not_authorized';
  end if;

  select * into strict v_day
  from public.school_days
  where school_id = p_school_id
    and school_date = private.school_local_date(p_school_id);

  if p_subject_kind = 'facility_check' then
    select scheduled_start, scheduled_end
    into strict v_from, v_until
    from public.facility_pulse_assignments
    where id = p_subject_id
      and school_id = p_school_id
      and school_day_id = v_day.id
      and status in ('scheduled', 'in_progress');
  elsif p_subject_kind = 'operator_report' and p_subject_id is null then
    v_from := v_day.opens_at;
    v_until := v_day.closes_at;
  else
    raise exception 'invalid_lease_subject';
  end if;

  insert into private.operator_work_leases(
    school_id, school_day_id, subject_kind, subject_id, device_id, actor_id,
    token_hash, work_valid_from, work_valid_until, upload_deadline
  ) values (
    p_school_id, v_day.id, p_subject_kind, p_subject_id, p_device_id, auth.uid(),
    p_token_hash, v_from, v_until, v_until + interval '24 hours'
  );

  return jsonb_build_object(
    'kind', p_subject_kind,
    'subjectId', p_subject_id,
    'expiresAt', v_until,
    'uploadDeadline', v_until + interval '24 hours'
  );
end
$$;

create or replace function private.apply_operator_mutation_v2(
  p_mutation_id uuid,
  p_school_id uuid,
  p_device_id uuid,
  p_device_token_hash text,
  p_type text,
  p_payload jsonb,
  p_occurred_at_client timestamptz,
  p_offline_claimed boolean,
  p_work_lease_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_assignment public.facility_pulse_assignments%rowtype;
  v_school public.schools%rowtype;
  v_lease private.operator_work_leases%rowtype;
  v_subject_id uuid;
begin
  if p_type = 'facility_pulse' then
    v_subject_id := nullif(p_payload->>'assignmentId', '')::uuid;
    select * into strict v_assignment
    from public.facility_pulse_assignments
    where id = v_subject_id and school_id = p_school_id
    for update;
    select * into strict v_school from public.schools where id = p_school_id;
  elsif p_type <> 'operator_report' then
    raise exception 'unsupported_mutation';
  end if;

  if p_offline_claimed then
    if p_work_lease_hash is null then raise exception 'valid_work_lease_required'; end if;
    select * into strict v_lease
    from private.operator_work_leases
    where token_hash = p_work_lease_hash
      and school_id = p_school_id
      and device_id = p_device_id
      and actor_id = auth.uid()
      and subject_kind = case when p_type = 'facility_pulse' then 'facility_check' else 'operator_report' end
      and subject_id is not distinct from v_subject_id
      and used_at is null
      and revoked_at is null
      and upload_deadline > now()
    for update;

    if p_occurred_at_client < v_lease.work_valid_from - interval '5 minutes'
      or p_occurred_at_client > v_lease.work_valid_until then
      raise exception 'offline_work_outside_lease';
    end if;
    update private.operator_work_leases set used_at = now() where id = v_lease.id;
    if p_type = 'facility_pulse' and v_assignment.status = 'missed' then
      update public.facility_pulse_assignments
      set status = 'in_progress', started_at = p_occurred_at_client
      where id = v_assignment.id and status = 'missed';
    end if;
  elsif p_type = 'facility_pulse' then
    if now() < v_assignment.scheduled_start then raise exception 'assignment_not_open'; end if;
    if now() > v_assignment.scheduled_end
      + make_interval(secs => v_school.completion_grace_seconds) then
      raise exception 'completion_grace_expired';
    end if;
  end if;

  return private.apply_operator_mutation(
    p_mutation_id,
    p_school_id,
    p_device_id,
    p_device_token_hash,
    p_type,
    p_payload
  );
exception
  when no_data_found then raise exception 'valid_work_lease_required';
end
$$;

create or replace function public.rpc_issue_operator_work_lease(
  p_school_id uuid,
  p_device_id uuid,
  p_device_token_hash text,
  p_subject_kind text,
  p_subject_id uuid,
  p_token_hash text
)
returns jsonb
language sql
security invoker
set search_path = public, private, pg_temp
as $$
  select private.issue_operator_work_lease(
    p_school_id, p_device_id, p_device_token_hash, p_subject_kind,
    p_subject_id, p_token_hash
  )
$$;

create or replace function public.rpc_apply_operator_mutation_v2(
  p_mutation_id uuid,
  p_school_id uuid,
  p_device_id uuid,
  p_device_token_hash text,
  p_type text,
  p_payload jsonb,
  p_occurred_at_client timestamptz,
  p_offline_claimed boolean,
  p_work_lease_hash text
)
returns jsonb
language sql
security invoker
set search_path = public, private, pg_temp
as $$
  select private.apply_operator_mutation_v2(
    p_mutation_id, p_school_id, p_device_id, p_device_token_hash, p_type,
    p_payload, p_occurred_at_client, p_offline_claimed, p_work_lease_hash
  )
$$;

revoke all on function private.issue_operator_work_lease(uuid, uuid, text, text, uuid, text) from public, anon, authenticated;
revoke all on function private.apply_operator_mutation_v2(uuid, uuid, uuid, text, text, jsonb, timestamptz, boolean, text) from public, anon, authenticated;
revoke all on function public.rpc_issue_operator_work_lease(uuid, uuid, text, text, uuid, text) from public, anon;
revoke all on function public.rpc_apply_operator_mutation_v2(uuid, uuid, uuid, text, text, jsonb, timestamptz, boolean, text) from public, anon;

grant execute on function private.issue_operator_work_lease(uuid, uuid, text, text, uuid, text) to authenticated, service_role;
grant execute on function private.apply_operator_mutation_v2(uuid, uuid, uuid, text, text, jsonb, timestamptz, boolean, text) to authenticated, service_role;
grant execute on function public.rpc_issue_operator_work_lease(uuid, uuid, text, text, uuid, text) to authenticated, service_role;
grant execute on function public.rpc_apply_operator_mutation_v2(uuid, uuid, uuid, text, text, jsonb, timestamptz, boolean, text) to authenticated, service_role;
