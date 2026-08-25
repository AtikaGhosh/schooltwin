create or replace function private.admin_create_participant_sessions(
  p_school_id uuid,p_school_day_id uuid,p_type public.session_type,p_count integer
)
returns uuid[] language plpgsql security definer set search_path=public,private,pg_temp as $$
declare v_ids uuid[]; v_expires timestamptz;
begin
  if private.current_role() not in ('platform_admin','field_coordinator')
    or (private.current_role()='field_coordinator' and not private.has_school_role(p_school_id,array['field_coordinator']::public.app_role[])) then
    raise exception 'not_authorized';
  end if;
  if p_type not in ('student_pulse','private_report') or p_count not between 1 and 100 then raise exception 'invalid_session_batch'; end if;
  select closes_at+interval '5 minutes' into strict v_expires from public.school_days where id=p_school_day_id and school_id=p_school_id;
  with created as (
    insert into public.participant_sessions(school_id,school_day_id,type,expires_at)
    select p_school_id,p_school_day_id,p_type,v_expires from generate_series(1,p_count)
    returning id
  ) select array_agg(id) into v_ids from created;
  return v_ids;
end $$;

create or replace function public.rpc_admin_create_participant_sessions(
  p_school_id uuid,p_school_day_id uuid,p_type public.session_type,p_count integer
)
returns uuid[] language sql security invoker set search_path=public,private,pg_temp
as $$select private.admin_create_participant_sessions(p_school_id,p_school_day_id,p_type,p_count)$$;

create or replace function public.rpc_operator_participant_launches(p_school_id uuid)
returns jsonb language plpgsql security definer set search_path=public,private,pg_temp stable as $$
declare v_day uuid; v_student uuid; v_report uuid; v_state text;
begin
  if not private.has_school_role(p_school_id,array['school_operator']::public.app_role[]) then raise exception 'not_authorized'; end if;
  select id into v_day from public.school_days where school_id=p_school_id and school_date=private.school_local_date(p_school_id);
  select id into v_student from public.participant_sessions where school_day_id=v_day and type='student_pulse' and status='issued' and expires_at>now() order by created_at limit 1;
  select id into v_report from public.participant_sessions where school_day_id=v_day and type='private_report' and status='issued' and expires_at>now() order by created_at limit 1;
  select case when exists(select 1 from public.participant_sessions where school_day_id=v_day and type='student_pulse' and status='active') then 'active'
    when exists(select 1 from public.participant_sessions where school_day_id=v_day and type='student_pulse' and status='completed') then 'completed'
    else 'inactive' end into v_state;
  return jsonb_build_object('studentPulseSessionId',v_student,'privateReportSessionId',v_report,'studentPrivateState',v_state);
end $$;

revoke all on function private.admin_create_participant_sessions(uuid,uuid,public.session_type,integer) from public,anon,authenticated;
revoke all on function public.rpc_admin_create_participant_sessions(uuid,uuid,public.session_type,integer) from public,anon;
revoke all on function public.rpc_operator_participant_launches(uuid) from public,anon;
grant execute on function private.admin_create_participant_sessions(uuid,uuid,public.session_type,integer) to authenticated;
grant execute on function public.rpc_admin_create_participant_sessions(uuid,uuid,public.session_type,integer) to authenticated;
grant execute on function public.rpc_operator_participant_launches(uuid) to authenticated;
grant execute on function public.rpc_admin_create_participant_sessions(uuid,uuid,public.session_type,integer) to service_role;
grant execute on function public.rpc_operator_participant_launches(uuid) to service_role;
