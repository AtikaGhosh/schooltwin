-- The secret-key worker receives only the fields required to verify one
-- pending evidence object. It does not query the evidence table directly.
create or replace function private.claim_evidence_fingerprint(p_evidence_id uuid)
returns table(object_path text, client_sha256 text, backup_delete_after timestamptz)
language sql
security definer
set search_path=public,private,pg_temp
as $$
  select e.object_path,e.client_sha256,e.backup_delete_after
  from public.evidence_objects e
  where e.id=p_evidence_id and e.status='finalized' and e.fingerprint_status='pending'
$$;

create or replace function public.rpc_claim_evidence_fingerprint(p_evidence_id uuid)
returns table(object_path text, client_sha256 text, backup_delete_after timestamptz)
language sql
security invoker
set search_path=public,private,pg_temp
as $$select * from private.claim_evidence_fingerprint(p_evidence_id)$$;

revoke all on function private.claim_evidence_fingerprint(uuid) from public,anon,authenticated;
revoke all on function public.rpc_claim_evidence_fingerprint(uuid) from public,anon,authenticated;
grant execute on function private.claim_evidence_fingerprint(uuid) to service_role;
grant execute on function public.rpc_claim_evidence_fingerprint(uuid) to service_role;
