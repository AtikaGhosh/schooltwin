-- Redemption failures must commit, so expected denial paths return a typed result
-- instead of raising an exception that would roll the audit insert back.
create or replace function private.redeem_access_grant_v2(
  p_session_id uuid,p_code_hmac text,p_device_id uuid,p_ip_hash text,p_capability_token_hash text
)
returns jsonb language plpgsql security definer set search_path=public,private,pg_temp as $$
declare
  v_grant private.access_grants%rowtype; v_session public.participant_sessions%rowtype;
  v_capability_id uuid; v_capability_expires timestamptz;
  v_session_failures integer; v_device_failures integer; v_school_failures integer;
  v_ip_failures integer; v_global_failures integer;
begin
  select * into v_session from public.participant_sessions where id=p_session_id for update;
  if not found then
    perform private.fail_redemption(null,p_session_id,p_device_id,p_ip_hash,'invalid_session');
    return jsonb_build_object('ok',false,'error','invalid_grant');
  end if;

  select count(*) into v_session_failures from private.grant_redemption_failures where occurred_at>now()-interval '15 minutes' and session_id=p_session_id;
  select count(*) into v_device_failures from private.grant_redemption_failures where occurred_at>now()-interval '15 minutes' and device_id=p_device_id;
  select count(*) into v_school_failures from private.grant_redemption_failures where occurred_at>now()-interval '15 minutes' and school_id=v_session.school_id;
  select count(*) into v_ip_failures from private.grant_redemption_failures where occurred_at>now()-interval '15 minutes' and ip_hash=p_ip_hash;
  select count(*) into v_global_failures from private.grant_redemption_failures where occurred_at>now()-interval '5 minutes';
  if v_session_failures>=5 or v_device_failures>=10 or v_ip_failures>=20 or v_school_failures>=50 or v_global_failures>=200 then
    if v_school_failures>=50 or v_global_failures>=200 then
      insert into private.system_alerts(school_id,kind,severity,detail)
      select v_session.school_id,'participant_redemption_volume','warning',jsonb_build_object('schoolFailures',v_school_failures,'globalFailures',v_global_failures)
      where not exists(select 1 from private.system_alerts where kind='participant_redemption_volume' and status='open' and created_at>now()-interval '15 minutes');
    end if;
    return jsonb_build_object('ok',false,'error','redemption_locked');
  end if;

  select * into v_grant from private.access_grants where session_id=p_session_id and code_hmac=p_code_hmac for update;
  if not found then
    perform private.fail_redemption(v_session.school_id,p_session_id,p_device_id,p_ip_hash,'invalid');
    return jsonb_build_object('ok',false,'error','invalid_grant');
  end if;
  if v_grant.status<>'issued' then return jsonb_build_object('ok',false,'error','grant_used_or_revoked'); end if;
  if v_grant.expires_at<=now() then
    update private.access_grants set status='expired' where id=v_grant.id;
    return jsonb_build_object('ok',false,'error','grant_expired');
  end if;
  if v_session.status<>'issued' or v_session.expires_at<=now() then return jsonb_build_object('ok',false,'error','session_unavailable'); end if;
  if v_grant.session_type<>v_session.type then return jsonb_build_object('ok',false,'error','wrong_session'); end if;

  update private.access_grants set status='redeemed',
    redeemed_at=case when session_type='private_report' then null else now() end,
    redeemed_on=private.school_local_date(school_id)
  where id=v_grant.id and status='issued';
  if not found then return jsonb_build_object('ok',false,'error','grant_used_or_revoked'); end if;

  update public.participant_sessions set status='active',activated_at=now() where id=p_session_id and status='issued';
  v_capability_expires:=least(v_grant.expires_at,now()+interval '30 minutes');
  insert into private.participant_capabilities(school_id,session_id,grant_id,token_hash,session_type,expires_at)
  values(v_grant.school_id,p_session_id,v_grant.id,p_capability_token_hash,v_grant.session_type,v_capability_expires)
  returning id into v_capability_id;
  return jsonb_build_object('ok',true,'capabilityId',v_capability_id,'sessionId',p_session_id,'sessionType',v_grant.session_type,'expiresAt',v_capability_expires);
end $$;

create or replace function public.rpc_redeem_access_grant_v2(
  p_session_id uuid,p_code_hmac text,p_device_id uuid,p_ip_hash text,p_capability_token_hash text
)
returns jsonb language sql security invoker set search_path=public,private,pg_temp
as $$select private.redeem_access_grant_v2(p_session_id,p_code_hmac,p_device_id,p_ip_hash,p_capability_token_hash)$$;

revoke all on function private.redeem_access_grant_v2(uuid,text,uuid,text,text) from public,anon,authenticated;
revoke all on function public.rpc_redeem_access_grant_v2(uuid,text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.rpc_redeem_access_grant_v2(uuid,text,uuid,text,text) to service_role;
grant execute on function private.redeem_access_grant_v2(uuid,text,uuid,text,text) to service_role;
