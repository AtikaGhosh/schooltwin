-- Narrow service transactions used by Edge Functions. Edge code authenticates;
-- these functions independently enforce ownership and state invariants.

create or replace function private.pair_device(
  p_school_id uuid,
  p_label text,
  p_pairing_code_hmac text,
  p_lease_token_hash text
)
returns jsonb
language plpgsql security definer
set search_path = public, private, pg_temp
as $$
declare v_code private.device_pairing_codes%rowtype; v_device uuid; v_lease uuid;
begin
  if not private.has_school_role(p_school_id, array['school_operator','field_coordinator']::public.app_role[]) then
    raise exception 'not_authorized';
  end if;
  select * into v_code from private.device_pairing_codes
    where school_id = p_school_id and code_hmac = p_pairing_code_hmac for update;
  if not found or v_code.used_at is not null or v_code.revoked_at is not null or v_code.expires_at <= now() then
    raise exception 'invalid_pairing_code';
  end if;
  update private.device_pairing_codes set used_at = now() where id = v_code.id;
  insert into public.devices(school_id, label, paired_by) values (p_school_id, p_label, auth.uid()) returning id into v_device;
  insert into private.device_leases(device_id, school_id, user_id, token_hash, expires_at)
  values (v_device, p_school_id, auth.uid(), p_lease_token_hash, now() + interval '7 days') returning id into v_lease;
  insert into private.server_events(school_id, actor_id, device_id, event_type, target_type, target_id, result)
  values (p_school_id, auth.uid(), v_device, 'device_paired', 'device', v_device, 'accepted');
  return jsonb_build_object('deviceId',v_device,'leaseId',v_lease,'leaseExpiresAt',now() + interval '7 days');
end
$$;

create or replace function private.refresh_device_lease(
  p_device_id uuid,
  p_current_token_hash text,
  p_next_token_hash text
)
returns jsonb
language plpgsql security definer
set search_path = public, private, pg_temp
as $$
declare v_lease private.device_leases%rowtype;
begin
  select * into v_lease from private.device_leases
    where device_id = p_device_id and user_id = auth.uid() and token_hash = p_current_token_hash and revoked_at is null for update;
  if not found or v_lease.expires_at <= now() then raise exception 'invalid_device_lease'; end if;
  if exists (select 1 from public.devices where id = p_device_id and revoked_at is not null) then raise exception 'device_revoked'; end if;
  update private.device_leases set token_hash = p_next_token_hash, refreshed_at = now(), expires_at = now() + interval '7 days'
   where id = v_lease.id;
  update public.devices set last_seen_at = now() where id = p_device_id;
  return jsonb_build_object('deviceId',p_device_id,'leaseExpiresAt',now() + interval '7 days');
end
$$;

create or replace function private.admin_create_pairing_code(
  p_school_id uuid, p_code_hmac text
)
returns jsonb
language plpgsql security definer
set search_path = public, private, pg_temp
as $$
declare v_id uuid;
begin
  if private.current_role() not in ('platform_admin','field_coordinator')
    or (private.current_role() = 'field_coordinator' and not private.has_school_role(p_school_id, array['field_coordinator']::public.app_role[])) then
    raise exception 'not_authorized';
  end if;
  insert into private.device_pairing_codes(school_id, code_hmac, created_by, expires_at)
  values (p_school_id, p_code_hmac, auth.uid(), now() + interval '10 minutes') returning id into v_id;
  return jsonb_build_object('pairingCodeId',v_id,'expiresAt',now() + interval '10 minutes');
end
$$;

create or replace function private.admin_revoke_device(p_device_id uuid, p_reason text)
returns void
language plpgsql security definer
set search_path = public, private, pg_temp
as $$
declare v_school uuid;
begin
  select school_id into strict v_school from public.devices where id = p_device_id for update;
  if private.current_role() not in ('platform_admin','field_coordinator')
    or (private.current_role() = 'field_coordinator' and not private.has_school_role(v_school, array['field_coordinator']::public.app_role[])) then
    raise exception 'not_authorized';
  end if;
  update public.devices set revoked_at = coalesce(revoked_at, now()), revoke_reason = p_reason where id = p_device_id;
  update private.device_leases set revoked_at = coalesce(revoked_at, now()) where device_id = p_device_id;
  insert into private.server_events(school_id, actor_id, device_id, event_type, target_type, target_id, result)
  values (v_school, auth.uid(), p_device_id, 'device_revoked', 'device', p_device_id, 'accepted');
end
$$;

create or replace function private.admin_add_membership(
  p_school_id uuid, p_user_id uuid, p_role public.app_role
)
returns void
language plpgsql security definer
set search_path = public, private, pg_temp
as $$
begin
  if private.current_role() not in ('platform_admin','field_coordinator')
    or (private.current_role() = 'field_coordinator' and not private.has_school_role(p_school_id, array['field_coordinator']::public.app_role[])) then
    raise exception 'not_authorized';
  end if;
  if p_role not in ('school_operator','field_coordinator') then raise exception 'invalid_membership_role'; end if;
  insert into public.school_memberships(school_id,user_id,role) values (p_school_id,p_user_id,p_role)
  on conflict (school_id,user_id) do update set role = excluded.role, revoked_at = null;
end
$$;

create or replace function private.admin_issue_grant_batch(
  p_school_id uuid,
  p_school_day_id uuid,
  p_grants jsonb
)
returns jsonb
language plpgsql security definer
set search_path = public, private, pg_temp
as $$
declare v_batch uuid; v_item jsonb; v_count integer := 0;
begin
  if private.current_role() not in ('platform_admin','field_coordinator')
    or (private.current_role() = 'field_coordinator' and not private.has_school_role(p_school_id, array['field_coordinator']::public.app_role[])) then
    raise exception 'not_authorized';
  end if;
  if not exists (select 1 from public.school_days where id = p_school_day_id and school_id = p_school_id) then raise exception 'invalid_school_day'; end if;
  insert into private.access_grant_batches(school_id,school_day_id,created_by) values (p_school_id,p_school_day_id,auth.uid()) returning id into v_batch;
  for v_item in select * from jsonb_array_elements(p_grants) loop
    insert into private.access_grants(batch_id,school_id,school_day_id,session_id,code_hmac,session_type,expires_at)
    select v_batch,p_school_id,p_school_day_id,s.id,v_item->>'codeHmac',s.type,s.expires_at
    from public.participant_sessions s
    where s.id = (v_item->>'sessionId')::uuid and s.school_id = p_school_id and s.school_day_id = p_school_day_id;
    if not found then raise exception 'invalid_session'; end if;
    v_count := v_count + 1;
  end loop;
  return jsonb_build_object('batchId',v_batch,'count',v_count);
end
$$;

create or replace function private.admin_confirm_batch_printed(p_batch_id uuid)
returns void
language plpgsql security definer
set search_path = public, private, pg_temp
as $$
declare v_school uuid;
begin
  select school_id into strict v_school from private.access_grant_batches where id = p_batch_id for update;
  if private.current_role() not in ('platform_admin','field_coordinator')
    or (private.current_role() = 'field_coordinator' and not private.has_school_role(v_school, array['field_coordinator']::public.app_role[])) then
    raise exception 'not_authorized';
  end if;
  update private.access_grant_batches set confirmed_printed_at = coalesce(confirmed_printed_at,now()) where id = p_batch_id;
end
$$;

create or replace function private.admin_revoke_grant_batch(p_batch_id uuid)
returns void
language plpgsql security definer
set search_path = public, private, pg_temp
as $$
declare v_school uuid;
begin
  select school_id into strict v_school from private.access_grant_batches where id = p_batch_id for update;
  if private.current_role() not in ('platform_admin','field_coordinator')
    or (private.current_role() = 'field_coordinator' and not private.has_school_role(v_school, array['field_coordinator']::public.app_role[])) then
    raise exception 'not_authorized';
  end if;
  update private.access_grant_batches set revoked_at = coalesce(revoked_at,now()) where id = p_batch_id;
  update private.access_grants set status = 'revoked', revoked_at = coalesce(revoked_at,now())
    where batch_id = p_batch_id and status = 'issued';
end
$$;

create or replace function private.sync_pull(
  p_school_id uuid, p_device_id uuid, p_device_token_hash text, p_cursor timestamptz default null
)
returns jsonb
language plpgsql security definer
set search_path = public, private, pg_temp
as $$
declare v_day public.school_days%rowtype; v_school public.schools%rowtype; v_lease timestamptz;
begin
  if not private.has_school_role(p_school_id, array['school_operator']::public.app_role[]) then raise exception 'not_authorized'; end if;
  if not private.valid_device_lease(p_school_id,p_device_id,auth.uid(),p_device_token_hash) then raise exception 'invalid_device_lease'; end if;
  select * into strict v_school from public.schools where id = p_school_id;
  perform private.ensure_school_day(p_school_id, null);
  select * into strict v_day from public.school_days where school_id = p_school_id and school_date = private.school_local_date(p_school_id);
  select expires_at into v_lease from private.device_leases where device_id = p_device_id and user_id = auth.uid() and token_hash = p_device_token_hash and revoked_at is null;
  update public.devices set last_seen_at = now() where id = p_device_id;
  return jsonb_build_object(
    'serverTime',now(), 'schoolConfigVersion',v_school.config_version, 'deviceLeaseExpiresAt',v_lease,
    'school',to_jsonb(v_school),
    'areas',coalesce((select jsonb_agg(to_jsonb(a) order by a.name) from public.school_areas a where a.school_id=p_school_id and a.active),'[]'::jsonb),
    'sections',coalesce((select jsonb_agg(to_jsonb(s) order by s.sort_order) from public.sections s where s.school_id=p_school_id and s.active),'[]'::jsonb),
    'classAssignments',coalesce((select jsonb_agg(to_jsonb(a)) from public.class_pulse_assignments a where a.school_day_id=v_day.id),'[]'::jsonb),
    'facilityAssignments',coalesce((select jsonb_agg(to_jsonb(a)) from public.facility_pulse_assignments a where a.school_day_id=v_day.id),'[]'::jsonb),
    'tasks',coalesce((select jsonb_agg(to_jsonb(t)) from public.verification_tasks t where t.school_day_id=v_day.id),'[]'::jsonb),
    'challenges',coalesce((select jsonb_agg(to_jsonb(c)) from public.task_challenges c where c.school_id=p_school_id),'[]'::jsonb),
    'operatorHistory',coalesce((select jsonb_agg(to_jsonb(s) order by s.accepted_at desc) from public.operator_submission_views s where s.school_id=p_school_id limit 100),'[]'::jsonb),
    'revokedIds','[]'::jsonb, 'nextCursor',now()
  );
end
$$;

create or replace function private.begin_capture(
  p_school_id uuid, p_device_id uuid, p_device_token_hash text, p_task_id uuid,
  p_object_path text, p_work_lease_hash text, p_offline boolean default false
)
returns jsonb
language plpgsql security definer
set search_path = public, private, pg_temp
as $$
declare v_task public.verification_tasks%rowtype; v_school public.schools%rowtype; v_challenge public.task_challenges%rowtype; v_intent uuid;
begin
  if not private.has_school_role(p_school_id,array['school_operator']::public.app_role[]) then raise exception 'not_authorized'; end if;
  if not private.valid_device_lease(p_school_id,p_device_id,auth.uid(),p_device_token_hash) then raise exception 'invalid_device_lease'; end if;
  select * into strict v_task from public.verification_tasks where id=p_task_id and school_id=p_school_id for update;
  select * into strict v_school from public.schools where id=p_school_id;
  if v_task.status not in ('scheduled','in_progress') then raise exception 'task_unavailable'; end if;
  if not p_offline and (now() < v_task.scheduled_start or now() > v_task.scheduled_end) then raise exception 'task_outside_window'; end if;
  if v_task.status='scheduled' then update public.verification_tasks set status='in_progress',started_at=now() where id=v_task.id; end if;
  select * into v_challenge from public.task_challenges where task_id=v_task.id;
  if not found then
    insert into public.task_challenges(school_id,task_id,display_code,steps)
    values (p_school_id,v_task.id,upper(substr(encode(gen_random_bytes(8),'hex'),1,8)),jsonb_build_array('Show the expected marker','Pan continuously','End at the entrance'))
    returning * into v_challenge;
  end if;
  insert into private.capture_intents(school_id,task_id,device_id,actor_id,challenge_id,object_path,work_lease_hash,timing_assurance,expires_at)
  values (p_school_id,v_task.id,p_device_id,auth.uid(),v_challenge.id,p_object_path,p_work_lease_hash,
    case when p_offline then 'offline_claimed' else 'server_started' end,now()+interval '24 hours') returning id into v_intent;
  return jsonb_build_object('captureIntentId',v_intent,'challenge',to_jsonb(v_challenge),'objectPath',p_object_path,'expiresAt',now()+interval '24 hours','maxBytes',31457280,'minSeconds',10,'maxSeconds',60);
end
$$;

create or replace function private.finalize_capture(
  p_mutation_id uuid, p_school_id uuid, p_device_id uuid, p_device_token_hash text,
  p_capture_intent_id uuid, p_byte_length bigint, p_mime_type text, p_client_sha256 text,
  p_client_started_at timestamptz, p_client_ended_at timestamptz,
  p_marker_method text, p_marker_value text, p_expected_marker_matched boolean
)
returns jsonb
language plpgsql security definer
set search_path = public, private, pg_temp
as $$
declare v_existing private.mutation_receipts%rowtype; v_intent private.capture_intents%rowtype; v_task public.verification_tasks%rowtype; v_school public.schools%rowtype; v_evidence uuid; v_response jsonb;
begin
  select * into v_existing from private.mutation_receipts where mutation_id=p_mutation_id;
  if found then return v_existing.response || jsonb_build_object('result','duplicate'); end if;
  if not private.has_school_role(p_school_id,array['school_operator']::public.app_role[]) then raise exception 'not_authorized'; end if;
  if not private.valid_device_lease(p_school_id,p_device_id,auth.uid(),p_device_token_hash) then raise exception 'invalid_device_lease'; end if;
  select * into strict v_intent from private.capture_intents where id=p_capture_intent_id and school_id=p_school_id and device_id=p_device_id for update;
  if v_intent.finalized_at is not null or v_intent.expires_at<=now() then raise exception 'capture_intent_unavailable'; end if;
  if p_byte_length not between 1 and 31457280 or p_mime_type not like 'video/%' or p_client_sha256 !~ '^[0-9a-f]{64}$' then raise exception 'invalid_capture_metadata'; end if;
  if not p_expected_marker_matched then raise exception 'expected_marker_not_matched'; end if;
  select * into strict v_task from public.verification_tasks where id=v_intent.task_id for update;
  select * into strict v_school from public.schools where id=p_school_id;
  if v_task.status <> 'in_progress' then raise exception 'task_unavailable'; end if;
  if v_intent.timing_assurance='server_started' and now() > v_task.scheduled_end + make_interval(secs=>v_school.completion_grace_seconds) then raise exception 'completion_grace_expired'; end if;
  insert into public.evidence_objects(school_id,task_id,challenge_id,object_path,byte_length,mime_type,client_sha256,timing_assurance,client_started_at,client_ended_at,marker_method,marker_value,expected_marker_matched,delete_after,backup_delete_after)
  values (p_school_id,v_task.id,v_intent.challenge_id,v_intent.object_path,p_byte_length,p_mime_type,p_client_sha256,v_intent.timing_assurance,p_client_started_at,p_client_ended_at,p_marker_method,p_marker_value,p_expected_marker_matched,
    now()+make_interval(days=>v_school.evidence_retention_days),now()+make_interval(days=>v_school.evidence_retention_days)) returning id into v_evidence;
  update private.capture_intents set finalized_at=now() where id=v_intent.id;
  update public.verification_tasks set status='submitted',completed_at=now() where id=v_task.id;
  insert into public.submissions(school_id,school_day_id,task_id,source_record_id,kind,visibility,title)
  values (p_school_id,v_task.school_day_id,v_task.id,v_evidence,'live_evidence','operator',v_task.title);
  v_response:=jsonb_build_object('result','accepted','evidenceId',v_evidence,'serverTime',now(),'fingerprintStatus','pending');
  insert into private.mutation_receipts(mutation_id,school_id,device_id,result,response) values (p_mutation_id,p_school_id,p_device_id,'accepted',v_response);
  insert into private.server_events(school_id,actor_id,device_id,event_type,target_type,target_id,result)
  values(p_school_id,auth.uid(),p_device_id,'capture_submitted','evidence',v_evidence,'accepted');
  return v_response;
exception when unique_violation then raise exception 'already_submitted';
end
$$;

create or replace function private.set_evidence_fingerprint(p_evidence_id uuid,p_server_sha256 text,p_matched boolean)
returns void language plpgsql security definer set search_path=public,private,pg_temp as $$
begin
  update public.evidence_objects set server_sha256=p_server_sha256,fingerprint_status=case when p_matched then 'matched' else 'failed' end where id=p_evidence_id and fingerprint_status='pending';
  if not found then raise exception 'evidence_unavailable'; end if;
end $$;

create or replace function private.claim_expired_evidence()
returns table(evidence_id uuid,object_path text,backup_delete_after timestamptz)
language plpgsql security definer set search_path=public,private,pg_temp as $$
begin
  return query
  update public.evidence_objects e set status='deleted'
  where e.delete_after<=now() and e.status<>'deleted'
  returning e.id,e.object_path,e.backup_delete_after;
end $$;

revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.pair_device(uuid,text,text,text) to authenticated;
grant execute on function private.refresh_device_lease(uuid,text,text) to authenticated;
grant execute on function private.admin_create_pairing_code(uuid,text) to authenticated;
grant execute on function private.admin_revoke_device(uuid,text) to authenticated;
grant execute on function private.admin_add_membership(uuid,uuid,public.app_role) to authenticated;
grant execute on function private.admin_issue_grant_batch(uuid,uuid,jsonb) to authenticated;
grant execute on function private.admin_confirm_batch_printed(uuid) to authenticated;
grant execute on function private.admin_revoke_grant_batch(uuid) to authenticated;
grant execute on function private.sync_pull(uuid,uuid,text,timestamptz) to authenticated;
grant execute on function private.begin_capture(uuid,uuid,text,uuid,text,text,boolean) to authenticated;
grant execute on function private.finalize_capture(uuid,uuid,uuid,text,uuid,bigint,text,text,timestamptz,timestamptz,text,text,boolean) to authenticated;
grant execute on all functions in schema private to service_role;
