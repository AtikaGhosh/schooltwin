create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;

alter table public.operator_reports
  add constraint operator_report_description_length check (char_length(description) between 1 and 4000) not valid;
alter table public.operator_reports validate constraint operator_report_description_length;
alter table private.private_reports
  add constraint private_report_description_length check (char_length(description) between 1 and 4000) not valid;
alter table private.private_reports validate constraint private_report_description_length;
alter table public.devices
  add constraint device_label_length check (char_length(label) between 1 and 100) not valid;
alter table public.devices validate constraint device_label_length;

alter table private.capture_intents add column cleanup_claimed_at timestamptz;
alter table public.evidence_objects add column deletion_claimed_at timestamptz;

create or replace function private.claim_expired_evidence()
returns table(evidence_id uuid,object_path text,backup_delete_after timestamptz)
language plpgsql security definer set search_path=public,private,pg_temp as $$
begin
  return query
  update public.evidence_objects e set deletion_claimed_at=now()
  where e.id in (
    select x.id from public.evidence_objects x where x.delete_after<=now() and x.status<>'deleted'
      and (x.deletion_claimed_at is null or x.deletion_claimed_at<now()-interval '30 minutes')
    order by x.delete_after for update skip locked limit 100
  ) returning e.id,e.object_path,e.backup_delete_after;
end $$;

create or replace function private.complete_evidence_deletion(p_evidence_id uuid,p_succeeded boolean,p_error text default null)
returns void language plpgsql security definer set search_path=public,private,pg_temp as $$
begin
  if p_succeeded then
    update public.evidence_objects set status='deleted',backup_status='deleted',deletion_claimed_at=null where id=p_evidence_id;
  else
    update public.evidence_objects set deletion_claimed_at=null where id=p_evidence_id;
    insert into private.system_alerts(kind,severity,detail)
    values('evidence_retention_failure','critical',jsonb_build_object('evidenceId',p_evidence_id,'error',coalesce(p_error,'delete_failed')));
  end if;
end $$;

create or replace function public.rpc_complete_evidence_deletion(p_evidence_id uuid,p_succeeded boolean,p_error text default null)
returns void language sql security invoker set search_path=public,private,pg_temp
as $$select private.complete_evidence_deletion(p_evidence_id,p_succeeded,p_error)$$;

create or replace function private.claim_orphan_uploads()
returns table(intent_id uuid,object_path text) language plpgsql security definer set search_path=public,private,pg_temp as $$
begin
  return query
  update private.capture_intents i set cleanup_claimed_at=now()
  where i.id in (
    select c.id from private.capture_intents c
    where c.finalized_at is null and c.expires_at<=now()
      and (c.cleanup_claimed_at is null or c.cleanup_claimed_at<now()-interval '30 minutes')
    order by c.expires_at for update skip locked limit 100
  ) returning i.id,i.object_path;
end $$;

create or replace function private.complete_orphan_cleanup(p_intent_id uuid,p_succeeded boolean,p_error text default null)
returns void language plpgsql security definer set search_path=public,private,pg_temp as $$
declare v_intent private.capture_intents%rowtype;
begin
  select * into strict v_intent from private.capture_intents where id=p_intent_id for update;
  if p_succeeded then
    delete from private.capture_intents where id=p_intent_id;
  else
    insert into private.failed_uploads(school_id,capture_intent_id,object_path,attempt_count,next_attempt_at,last_error_code)
    values(v_intent.school_id,v_intent.id,v_intent.object_path,1,now()+interval '30 minutes',coalesce(p_error,'orphan_cleanup_failed'))
    on conflict do nothing;
    update private.capture_intents set cleanup_claimed_at=null where id=p_intent_id;
  end if;
end $$;

create or replace function public.rpc_claim_orphan_uploads()
returns table(intent_id uuid,object_path text) language sql security invoker set search_path=public,private,pg_temp
as $$select * from private.claim_orphan_uploads()$$;
create or replace function public.rpc_complete_orphan_cleanup(p_intent_id uuid,p_succeeded boolean,p_error text default null)
returns void language sql security invoker set search_path=public,private,pg_temp
as $$select private.complete_orphan_cleanup(p_intent_id,p_succeeded,p_error)$$;

revoke all on function private.claim_orphan_uploads() from public,anon,authenticated;
revoke all on function private.complete_orphan_cleanup(uuid,boolean,text) from public,anon,authenticated;
revoke all on function public.rpc_claim_orphan_uploads() from public,anon,authenticated;
revoke all on function public.rpc_complete_orphan_cleanup(uuid,boolean,text) from public,anon,authenticated;
grant execute on function private.claim_orphan_uploads() to service_role;
grant execute on function private.complete_orphan_cleanup(uuid,boolean,text) to service_role;
grant execute on function public.rpc_claim_orphan_uploads() to service_role;
grant execute on function public.rpc_complete_orphan_cleanup(uuid,boolean,text) to service_role;
revoke all on function private.complete_evidence_deletion(uuid,boolean,text) from public,anon,authenticated;
revoke all on function public.rpc_complete_evidence_deletion(uuid,boolean,text) from public,anon,authenticated;
grant execute on function private.complete_evidence_deletion(uuid,boolean,text) to service_role;
grant execute on function public.rpc_complete_evidence_deletion(uuid,boolean,text) to service_role;

create or replace function private.apply_retention()
returns jsonb language plpgsql security definer set search_path=public,private,pg_temp as $$
declare v_job bigint; v_class integer; v_student integer; v_reports integer; v_events integer;
begin
  insert into private.retention_jobs(status) values('running') returning id into v_job;
  delete from private.class_pulse_responses where delete_after<=now(); get diagnostics v_class=row_count;
  delete from private.student_pulse_responses where delete_after<=now(); get diagnostics v_student=row_count;
  delete from private.private_reports where delete_after<=current_date; get diagnostics v_reports=row_count;
  delete from private.grant_redemption_failures where occurred_at<=now()-interval '30 days';
  delete from private.server_events where delete_after<=now(); get diagnostics v_events=row_count;
  update private.retention_jobs set completed_at=now(),status='completed',deleted_counts=jsonb_build_object(
    'classResponses',v_class,'studentResponses',v_student,'privateReports',v_reports,'events',v_events
  ) where id=v_job;
  return jsonb_build_object('jobId',v_job,'classResponses',v_class,'studentResponses',v_student,'privateReports',v_reports,'events',v_events);
exception when others then
  update private.retention_jobs set completed_at=now(),status='failed',error_code=sqlstate where id=v_job;
  raise;
end $$;

-- The database-only retention schedule cannot delete Storage or mirrored objects.
-- Replace it with a regional Edge Function call configured through Vault.
select cron.unschedule(jobid) from cron.job where jobname='schooltwin-retention';

create or replace function private.invoke_retention_edge()
returns bigint language plpgsql security definer set search_path=public,private,vault,extensions,pg_temp as $$
declare v_base text; v_secret text; v_request bigint;
begin
  select decrypted_secret into v_base from vault.decrypted_secrets where name='schooltwin_edge_base_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name='schooltwin_cron_secret';
  if v_base is null or v_secret is null then
    insert into private.system_alerts(kind,severity,detail) values('retention_not_configured','critical','{}'::jsonb);
    return null;
  end if;
  select net.http_post(
    url=>rtrim(v_base,'/')||'/retention-worker',
    headers=>jsonb_build_object('content-type','application/json','x-schooltwin-cron-secret',v_secret),
    body=>'{}'::jsonb,
    timeout_milliseconds=>120000
  ) into v_request;
  return v_request;
end $$;

revoke all on function private.invoke_retention_edge() from public,anon,authenticated;
grant execute on function private.invoke_retention_edge() to service_role;
select cron.schedule('schooltwin-retention-edge','35 19 * * *',$$select private.invoke_retention_edge()$$)
where not exists(select 1 from cron.job where jobname='schooltwin-retention-edge');
