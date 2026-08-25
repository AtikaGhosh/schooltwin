-- Persist terminal states after server-controlled windows. A later offline
-- claim can proceed only when a valid, unused signed lease proves that the
-- device received authority before the window closed.

create or replace function private.close_expired_work()
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_class_missed integer;
  v_class_failed integer;
  v_facility_missed integer;
  v_facility_failed integer;
  v_tasks_missed integer;
  v_tasks_failed integer;
begin
  update public.class_pulse_assignments
  set status='missed'
  where status='scheduled' and scheduled_end<now();
  get diagnostics v_class_missed=row_count;

  update public.class_pulse_assignments a
  set status='failed'
  from public.schools s
  where a.school_id=s.id and a.status='in_progress'
    and a.scheduled_end+make_interval(secs=>s.completion_grace_seconds)<now();
  get diagnostics v_class_failed=row_count;

  update public.facility_pulse_assignments
  set status='missed'
  where status='scheduled' and scheduled_end<now();
  get diagnostics v_facility_missed=row_count;

  update public.facility_pulse_assignments a
  set status='failed'
  from public.schools s
  where a.school_id=s.id and a.status='in_progress'
    and a.scheduled_end+make_interval(secs=>s.completion_grace_seconds)<now();
  get diagnostics v_facility_failed=row_count;

  update public.verification_tasks
  set status='missed'
  where status='scheduled' and scheduled_end<now();
  get diagnostics v_tasks_missed=row_count;

  update public.verification_tasks t
  set status='failed'
  from public.schools s
  where t.school_id=s.id and t.status='in_progress'
    and t.scheduled_end+make_interval(secs=>s.completion_grace_seconds)<now();
  get diagnostics v_tasks_failed=row_count;

  return jsonb_build_object(
    'classMissed',v_class_missed,
    'classFailed',v_class_failed,
    'facilityMissed',v_facility_missed,
    'facilityFailed',v_facility_failed,
    'taskMissed',v_tasks_missed,
    'taskFailed',v_tasks_failed
  );
end
$$;

create or replace function public.rpc_close_expired_work()
returns jsonb
language sql
security invoker
set search_path=public,private,pg_temp
as $$select private.close_expired_work()$$;

revoke all on function private.close_expired_work() from public,anon,authenticated;
revoke all on function public.rpc_close_expired_work() from public,anon,authenticated;
grant execute on function private.close_expired_work() to service_role;
grant execute on function public.rpc_close_expired_work() to service_role;

do $$
declare v_job bigint;
begin
  select jobid into v_job from cron.job where jobname='schooltwin-close-expired-work';
  if v_job is not null then perform cron.unschedule(v_job); end if;
  perform cron.schedule(
    'schooltwin-close-expired-work',
    '*/5 * * * *',
    'select private.close_expired_work()'
  );
end
$$;
