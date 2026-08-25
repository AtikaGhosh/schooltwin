-- Publicly addressable RPC wrappers. They expose narrow transactions, never
-- private tables. Browser roles receive only the functions explicitly granted.

create or replace function public.rpc_pair_device(p_school_id uuid,p_label text,p_pairing_code_hmac text,p_lease_token_hash text)
returns jsonb language sql security invoker set search_path=public,private,pg_temp
as $$select private.pair_device(p_school_id,p_label,p_pairing_code_hmac,p_lease_token_hash)$$;
create or replace function public.rpc_refresh_device_lease(p_device_id uuid,p_current_token_hash text,p_next_token_hash text)
returns jsonb language sql security invoker set search_path=public,private,pg_temp
as $$select private.refresh_device_lease(p_device_id,p_current_token_hash,p_next_token_hash)$$;
create or replace function public.rpc_admin_create_pairing_code(p_school_id uuid,p_code_hmac text)
returns jsonb language sql security invoker set search_path=public,private,pg_temp
as $$select private.admin_create_pairing_code(p_school_id,p_code_hmac)$$;
create or replace function public.rpc_admin_revoke_device(p_device_id uuid,p_reason text)
returns void language sql security invoker set search_path=public,private,pg_temp
as $$select private.admin_revoke_device(p_device_id,p_reason)$$;
create or replace function public.rpc_admin_add_membership(p_school_id uuid,p_user_id uuid,p_role public.app_role)
returns void language sql security invoker set search_path=public,private,pg_temp
as $$select private.admin_add_membership(p_school_id,p_user_id,p_role)$$;
create or replace function public.rpc_admin_issue_grant_batch(p_school_id uuid,p_school_day_id uuid,p_grants jsonb)
returns jsonb language sql security invoker set search_path=public,private,pg_temp
as $$select private.admin_issue_grant_batch(p_school_id,p_school_day_id,p_grants)$$;
create or replace function public.rpc_admin_confirm_batch_printed(p_batch_id uuid)
returns void language sql security invoker set search_path=public,private,pg_temp
as $$select private.admin_confirm_batch_printed(p_batch_id)$$;
create or replace function public.rpc_admin_revoke_grant_batch(p_batch_id uuid)
returns void language sql security invoker set search_path=public,private,pg_temp
as $$select private.admin_revoke_grant_batch(p_batch_id)$$;
create or replace function public.rpc_sync_pull(p_school_id uuid,p_device_id uuid,p_device_token_hash text,p_cursor timestamptz default null)
returns jsonb language sql security invoker set search_path=public,private,pg_temp
as $$select private.sync_pull(p_school_id,p_device_id,p_device_token_hash,p_cursor)$$;
create or replace function public.rpc_apply_operator_mutation(p_mutation_id uuid,p_school_id uuid,p_device_id uuid,p_device_token_hash text,p_type text,p_payload jsonb)
returns jsonb language sql security invoker set search_path=public,private,pg_temp
as $$select private.apply_operator_mutation(p_mutation_id,p_school_id,p_device_id,p_device_token_hash,p_type,p_payload)$$;
create or replace function public.rpc_begin_capture(p_school_id uuid,p_device_id uuid,p_device_token_hash text,p_task_id uuid,p_object_path text,p_work_lease_hash text,p_offline boolean default false)
returns jsonb language sql security invoker set search_path=public,private,pg_temp
as $$select private.begin_capture(p_school_id,p_device_id,p_device_token_hash,p_task_id,p_object_path,p_work_lease_hash,p_offline)$$;
create or replace function public.rpc_finalize_capture(p_mutation_id uuid,p_school_id uuid,p_device_id uuid,p_device_token_hash text,p_capture_intent_id uuid,p_byte_length bigint,p_mime_type text,p_client_sha256 text,p_client_started_at timestamptz,p_client_ended_at timestamptz,p_marker_method text,p_marker_value text,p_expected_marker_matched boolean)
returns jsonb language sql security invoker set search_path=public,private,pg_temp
as $$select private.finalize_capture(p_mutation_id,p_school_id,p_device_id,p_device_token_hash,p_capture_intent_id,p_byte_length,p_mime_type,p_client_sha256,p_client_started_at,p_client_ended_at,p_marker_method,p_marker_value,p_expected_marker_matched)$$;

create or replace function public.rpc_redeem_access_grant(p_session_id uuid,p_code_hmac text,p_device_id uuid,p_ip_hash text,p_capability_token_hash text)
returns table(capability_id uuid,session_id uuid,session_type public.session_type,expires_at timestamptz)
language sql security invoker set search_path=public,private,pg_temp
as $$select * from private.redeem_access_grant(p_session_id,p_code_hmac,p_device_id,p_ip_hash,p_capability_token_hash)$$;
create or replace function public.rpc_submit_participant_response(p_capability_hash text,p_payload jsonb)
returns jsonb language sql security invoker set search_path=public,private,pg_temp
as $$select private.submit_participant_response(p_capability_hash,p_payload)$$;
create or replace function public.rpc_set_evidence_fingerprint(p_evidence_id uuid,p_server_sha256 text,p_matched boolean)
returns void language sql security invoker set search_path=public,private,pg_temp
as $$select private.set_evidence_fingerprint(p_evidence_id,p_server_sha256,p_matched)$$;
create or replace function public.rpc_apply_retention()
returns jsonb language sql security invoker set search_path=public,private,pg_temp
as $$select private.apply_retention()$$;
create or replace function public.rpc_claim_expired_evidence()
returns table(evidence_id uuid,object_path text,backup_delete_after timestamptz)
language sql security invoker set search_path=public,private,pg_temp
as $$select * from private.claim_expired_evidence()$$;

create or replace function public.rpc_admin_save_school(p_school jsonb)
returns uuid
language plpgsql security definer set search_path=public,private,pg_temp
as $$
declare v_id uuid;
begin
  if private.current_role() <> 'platform_admin' then raise exception 'not_authorized'; end if;
  if p_school ? 'id' then
    update public.schools set
      school_twin_id=p_school->>'schoolTwinId',name=p_school->>'name',district=p_school->>'district',state=p_school->>'state',
      time_zone=coalesce(p_school->>'timeZone','Asia/Kolkata'),opening_time=coalesce((p_school->>'openingTime')::time,'10:00'),
      closing_time=coalesce((p_school->>'closingTime')::time,'16:00'),config_version=config_version+1,updated_at=now()
    where id=(p_school->>'id')::uuid returning id into v_id;
  else
    insert into public.schools(school_twin_id,name,district,state,time_zone,opening_time,closing_time)
    values(p_school->>'schoolTwinId',p_school->>'name',p_school->>'district',p_school->>'state',coalesce(p_school->>'timeZone','Asia/Kolkata'),coalesce((p_school->>'openingTime')::time,'10:00'),coalesce((p_school->>'closingTime')::time,'16:00'))
    returning id into v_id;
  end if;
  if v_id is null then raise exception 'school_not_found'; end if;
  return v_id;
end $$;

revoke all on all functions in schema public from public, anon, authenticated;
-- Restore intentional read helper access removed by the broad revoke.
grant execute on function public.activate_school(uuid) to authenticated;
grant execute on function public.rpc_pair_device(uuid,text,text,text) to authenticated;
grant execute on function public.rpc_refresh_device_lease(uuid,text,text) to authenticated;
grant execute on function public.rpc_admin_create_pairing_code(uuid,text) to authenticated;
grant execute on function public.rpc_admin_revoke_device(uuid,text) to authenticated;
grant execute on function public.rpc_admin_add_membership(uuid,uuid,public.app_role) to authenticated;
grant execute on function public.rpc_admin_issue_grant_batch(uuid,uuid,jsonb) to authenticated;
grant execute on function public.rpc_admin_confirm_batch_printed(uuid) to authenticated;
grant execute on function public.rpc_admin_revoke_grant_batch(uuid) to authenticated;
grant execute on function public.rpc_sync_pull(uuid,uuid,text,timestamptz) to authenticated;
grant execute on function public.rpc_apply_operator_mutation(uuid,uuid,uuid,text,text,jsonb) to authenticated;
grant execute on function public.rpc_begin_capture(uuid,uuid,text,uuid,text,text,boolean) to authenticated;
grant execute on function public.rpc_finalize_capture(uuid,uuid,uuid,text,uuid,bigint,text,text,timestamptz,timestamptz,text,text,boolean) to authenticated;
grant execute on function public.rpc_admin_save_school(jsonb) to authenticated;

grant execute on function public.rpc_redeem_access_grant(uuid,text,uuid,text,text) to service_role;
grant execute on function public.rpc_submit_participant_response(text,jsonb) to service_role;
grant execute on function public.rpc_set_evidence_fingerprint(uuid,text,boolean) to service_role;
grant execute on function public.rpc_apply_retention() to service_role;
grant execute on function public.rpc_claim_expired_evidence() to service_role;
grant execute on all functions in schema public to service_role;
