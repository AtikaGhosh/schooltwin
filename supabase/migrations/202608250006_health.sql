create or replace function public.rpc_backend_health()
returns jsonb language sql security definer set search_path=public,private,pg_temp stable
as $$
  select jsonb_build_object(
    'status','ok',
    'serverTime',now(),
    'activeSchools',(select count(*) from public.schools where status='active'),
    'openAlerts',(select count(*) from private.system_alerts where status <> 'closed')
  )
$$;
revoke all on function public.rpc_backend_health() from public,anon,authenticated;
grant execute on function public.rpc_backend_health() to service_role;
