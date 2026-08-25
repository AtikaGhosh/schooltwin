create or replace function private.prepare_offline_work(
  p_school_id uuid,p_device_id uuid,p_device_token_hash text
)
returns integer language plpgsql security definer set search_path=public,private,pg_temp as $$
declare v_count integer;
begin
  if not private.has_school_role(p_school_id,array['school_operator']::public.app_role[])
    or not private.valid_device_lease(p_school_id,p_device_id,auth.uid(),p_device_token_hash) then raise exception 'not_authorized'; end if;
  insert into public.task_challenges(school_id,task_id,display_code,steps)
  select t.school_id,t.id,upper(substr(encode(gen_random_bytes(8),'hex'),1,8)),
    jsonb_build_array('Show the expected marker','Pan continuously','End at the entrance')
  from public.verification_tasks t join public.school_days d on d.id=t.school_day_id
  where t.school_id=p_school_id and d.school_date=private.school_local_date(p_school_id)
  on conflict(task_id) do nothing;
  get diagnostics v_count=row_count;
  return v_count;
end $$;

create or replace function public.rpc_prepare_offline_work(p_school_id uuid,p_device_id uuid,p_device_token_hash text)
returns integer language sql security invoker set search_path=public,private,pg_temp
as $$select private.prepare_offline_work(p_school_id,p_device_id,p_device_token_hash)$$;

revoke all on function private.prepare_offline_work(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.rpc_prepare_offline_work(uuid,uuid,text) from public,anon;
grant execute on function private.prepare_offline_work(uuid,uuid,text) to authenticated;
grant execute on function public.rpc_prepare_offline_work(uuid,uuid,text) to authenticated;
grant execute on function public.rpc_prepare_offline_work(uuid,uuid,text) to service_role;
