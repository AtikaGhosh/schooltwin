create table private.restoration_runs (
  id uuid primary key default gen_random_uuid(),
  recovery_point timestamptz not null,
  status text not null default 'running' check (status in ('running','approved','failed')),
  cleanup_counts jsonb not null default '{}'::jsonb,
  checks jsonb not null default '{}'::jsonb,
  report_hmac text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);
revoke all on private.restoration_runs from public,anon,authenticated;
grant all on private.restoration_runs to service_role;

create or replace function private.restore_prepare(
  p_recovery_point timestamptz,
  p_revoked_user_ids uuid[] default '{}',
  p_revoked_device_ids uuid[] default '{}',
  p_revoked_batch_ids uuid[] default '{}'
)
returns jsonb language plpgsql security definer set search_path=public,private,pg_temp as $$
declare
  v_run uuid;
  v_class integer; v_student integer; v_reports integer;
  v_failures integer; v_events integer; v_intents integer;
  v_counts jsonb;
begin
  if p_recovery_point>now() then raise exception 'invalid_recovery_point'; end if;
  insert into private.restoration_runs(recovery_point) values(p_recovery_point) returning id into v_run;
  delete from private.class_pulse_responses where delete_after<=now();
  get diagnostics v_class=row_count;
  delete from private.student_pulse_responses where delete_after<=now();
  get diagnostics v_student=row_count;
  delete from private.private_reports where delete_after<=private.school_local_date(school_id);
  get diagnostics v_reports=row_count;
  delete from private.grant_redemption_failures where occurred_at<=now()-interval '30 days';
  get diagnostics v_failures=row_count;
  delete from private.server_events where delete_after<=now();
  get diagnostics v_events=row_count;
  select count(*) into v_intents from private.capture_intents
  where finalized_at is null and expires_at<=now();

  update public.profiles set disabled_at=coalesce(disabled_at,now()) where user_id=any(p_revoked_user_ids);
  update public.school_memberships set revoked_at=coalesce(revoked_at,now()) where user_id=any(p_revoked_user_ids);
  update public.devices set revoked_at=coalesce(revoked_at,now()),revoke_reason=coalesce(revoke_reason,'restore gate replay')
    where id=any(p_revoked_device_ids);
  update private.device_leases set revoked_at=coalesce(revoked_at,now())
    where device_id=any(p_revoked_device_ids) or user_id=any(p_revoked_user_ids);
  update private.work_leases set revoked_at=coalesce(revoked_at,now())
    where device_id=any(p_revoked_device_ids) or actor_id=any(p_revoked_user_ids);
  update private.operator_work_leases set revoked_at=coalesce(revoked_at,now())
    where device_id=any(p_revoked_device_ids) or actor_id=any(p_revoked_user_ids);
  update private.access_grant_batches set revoked_at=coalesce(revoked_at,now()) where id=any(p_revoked_batch_ids);
  update private.access_grants set status='revoked',revoked_at=coalesce(revoked_at,now())
    where batch_id=any(p_revoked_batch_ids) and status='issued';

  v_counts:=jsonb_build_object(
    'classResponses',v_class,'studentResponses',v_student,'privateReports',v_reports,
    'failedAttempts',v_failures,'serverEvents',v_events,'captureIntents',v_intents
  );
  update private.restoration_runs set cleanup_counts=v_counts where id=v_run;
  return jsonb_build_object('runId',v_run,'cleanupCounts',v_counts);
end $$;

create or replace function private.restore_finalize(p_run_id uuid,p_report_hmac text)
returns jsonb language plpgsql security definer set search_path=public,private,pg_temp as $$
declare v_checks jsonb;
begin
  if nullif(p_report_hmac,'') is null then raise exception 'report_signature_required'; end if;
  perform 1 from private.restoration_runs where id=p_run_id and status='running' for update;
  if not found then raise exception 'restore_run_unavailable'; end if;
  v_checks:=jsonb_build_object(
    'expiredClassResponses',(select count(*) from private.class_pulse_responses where delete_after<=now()),
    'expiredStudentResponses',(select count(*) from private.student_pulse_responses where delete_after<=now()),
    'expiredPrivateReports',(select count(*) from private.private_reports where delete_after<=private.school_local_date(school_id)),
    'expiredEvidence',(select count(*) from public.evidence_objects where delete_after<=now() and status<>'deleted'),
    'oldCaptureIntents',(select count(*) from private.capture_intents where finalized_at is null and expires_at<=now())
  );
  if exists(select 1 from jsonb_each_text(v_checks) where value::integer<>0) then
    update private.restoration_runs set status='failed',checks=v_checks,completed_at=now() where id=p_run_id;
    return jsonb_build_object('runId',p_run_id,'status','failed','checks',v_checks);
  end if;
  update private.restoration_runs
  set status='approved',checks=v_checks,report_hmac=p_report_hmac,completed_at=now()
  where id=p_run_id;
  return jsonb_build_object('runId',p_run_id,'status','approved','checks',v_checks,'completedAt',now());
end $$;

create or replace function public.rpc_restore_prepare(
  p_recovery_point timestamptz,p_revoked_user_ids uuid[] default '{}',
  p_revoked_device_ids uuid[] default '{}',p_revoked_batch_ids uuid[] default '{}'
)
returns jsonb language sql security invoker set search_path=public,private,pg_temp
as $$select private.restore_prepare(p_recovery_point,p_revoked_user_ids,p_revoked_device_ids,p_revoked_batch_ids)$$;
create or replace function public.rpc_restore_finalize(p_run_id uuid,p_report_hmac text)
returns jsonb language sql security invoker set search_path=public,private,pg_temp
as $$select private.restore_finalize(p_run_id,p_report_hmac)$$;

revoke all on function private.restore_prepare(timestamptz,uuid[],uuid[],uuid[]) from public,anon,authenticated;
revoke all on function private.restore_finalize(uuid,text) from public,anon,authenticated;
revoke all on function public.rpc_restore_prepare(timestamptz,uuid[],uuid[],uuid[]) from public,anon,authenticated;
revoke all on function public.rpc_restore_finalize(uuid,text) from public,anon,authenticated;
grant execute on function private.restore_prepare(timestamptz,uuid[],uuid[],uuid[]) to service_role;
grant execute on function private.restore_finalize(uuid,text) to service_role;
grant execute on function public.rpc_restore_prepare(timestamptz,uuid[],uuid[],uuid[]) to service_role;
grant execute on function public.rpc_restore_finalize(uuid,text) to service_role;
