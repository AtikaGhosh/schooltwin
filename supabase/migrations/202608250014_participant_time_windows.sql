-- Participant sessions remain online-only and server time is authoritative.
-- Class checks may start only inside their assignment window. A check that
-- started on time may finish inside the school's configured completion grace.

create or replace function private.redeem_access_grant_v3(
  p_session_id uuid,
  p_code_hmac text,
  p_device_id uuid,
  p_ip_hash text,
  p_capability_token_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_session public.participant_sessions%rowtype;
  v_assignment public.class_pulse_assignments%rowtype;
  v_result jsonb;
begin
  select * into v_session
  from public.participant_sessions
  where id = p_session_id;

  if not found then
    return private.redeem_access_grant_v2(
      p_session_id,
      p_code_hmac,
      p_device_id,
      p_ip_hash,
      p_capability_token_hash
    );
  end if;

  if v_session.type = 'class_pulse' then
    select * into v_assignment
    from public.class_pulse_assignments
    where session_id = p_session_id;

    if not found or v_assignment.status not in ('scheduled', 'in_progress') then
      return jsonb_build_object('ok', false, 'error', 'assignment_unavailable');
    end if;
    if now() < v_assignment.scheduled_start then
      return jsonb_build_object('ok', false, 'error', 'assignment_not_open');
    end if;
    if now() > v_assignment.scheduled_end then
      update public.class_pulse_assignments
      set status = 'missed'
      where id = v_assignment.id and status = 'scheduled';
      return jsonb_build_object('ok', false, 'error', 'assignment_closed');
    end if;
  end if;

  v_result := private.redeem_access_grant_v2(
    p_session_id,
    p_code_hmac,
    p_device_id,
    p_ip_hash,
    p_capability_token_hash
  );

  if v_result->>'ok' = 'true' and v_session.type = 'class_pulse' then
    update public.class_pulse_assignments
    set status = 'in_progress', started_at = coalesce(started_at, now())
    where session_id = p_session_id and status = 'scheduled';
  end if;

  return v_result;
end
$$;

create or replace function private.submit_participant_response_v2(
  p_capability_hash text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_cap private.participant_capabilities%rowtype;
  v_session public.participant_sessions%rowtype;
  v_assignment public.class_pulse_assignments%rowtype;
  v_grace_seconds integer;
begin
  select * into v_cap
  from private.participant_capabilities
  where token_hash = p_capability_hash and consumed_at is null;

  if not found then
    raise exception 'invalid_capability';
  end if;
  if v_cap.expires_at <= now() then
    raise exception 'capability_expired';
  end if;

  select * into strict v_session
  from public.participant_sessions
  where id = v_cap.session_id;

  if v_session.type = 'class_pulse' then
    select a.*
    into strict v_assignment
    from public.class_pulse_assignments a
    where a.session_id = v_session.id;

    select completion_grace_seconds
    into strict v_grace_seconds
    from public.schools
    where id = v_assignment.school_id;

    if v_assignment.status <> 'in_progress' or v_assignment.started_at is null then
      return jsonb_build_object('ok', false, 'error', 'assignment_not_started');
    end if;
    if v_assignment.started_at > v_assignment.scheduled_end then
      return jsonb_build_object('ok', false, 'error', 'assignment_started_late');
    end if;
    if now() > v_assignment.scheduled_end + make_interval(secs => v_grace_seconds) then
      update public.class_pulse_assignments
      set status = 'failed'
      where id = v_assignment.id and status = 'in_progress';
      return jsonb_build_object('ok', false, 'error', 'completion_grace_expired');
    end if;
  end if;

  return private.submit_participant_response(p_capability_hash, p_payload);
end
$$;

create or replace function public.rpc_redeem_access_grant_v3(
  p_session_id uuid,
  p_code_hmac text,
  p_device_id uuid,
  p_ip_hash text,
  p_capability_token_hash text
)
returns jsonb
language sql
security invoker
set search_path = public, private, pg_temp
as $$
  select private.redeem_access_grant_v3(
    p_session_id,
    p_code_hmac,
    p_device_id,
    p_ip_hash,
    p_capability_token_hash
  )
$$;

create or replace function public.rpc_submit_participant_response_v2(
  p_capability_hash text,
  p_payload jsonb
)
returns jsonb
language sql
security invoker
set search_path = public, private, pg_temp
as $$
  select private.submit_participant_response_v2(p_capability_hash, p_payload)
$$;

revoke all on function private.redeem_access_grant_v3(uuid, text, uuid, text, text) from public, anon, authenticated;
revoke all on function private.submit_participant_response_v2(text, jsonb) from public, anon, authenticated;
revoke all on function public.rpc_redeem_access_grant_v3(uuid, text, uuid, text, text) from public, anon, authenticated;
revoke all on function public.rpc_submit_participant_response_v2(text, jsonb) from public, anon, authenticated;

grant execute on function private.redeem_access_grant_v3(uuid, text, uuid, text, text) to service_role;
grant execute on function private.submit_participant_response_v2(text, jsonb) to service_role;
grant execute on function public.rpc_redeem_access_grant_v3(uuid, text, uuid, text, text) to service_role;
grant execute on function public.rpc_submit_participant_response_v2(text, jsonb) to service_role;
