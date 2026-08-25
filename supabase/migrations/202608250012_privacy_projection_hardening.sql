-- Participant session rows reveal private workflow counts and timing. Operators
-- receive only the safe launch/status DTO returned by rpc_operator_participant_launches.
drop policy if exists sessions_operator_safe_read on public.participant_sessions;
revoke all on public.participant_sessions from anon,authenticated;
drop policy if exists evidence_storage_read on storage.objects;
drop policy if exists evidence_operator_read on public.evidence_objects;
revoke all on public.evidence_objects from anon,authenticated;

create or replace function public.rpc_authorize_evidence_download(p_evidence_id uuid)
returns text language plpgsql security definer set search_path=public,private,pg_temp stable as $$
declare v_path text;
begin
  select object_path into strict v_path from public.evidence_objects
  where id=p_evidence_id and status='finalized'
    and private.has_school_role(school_id,array['school_operator']::public.app_role[]);
  return v_path;
exception when no_data_found then raise exception 'evidence_unavailable';
end $$;

revoke all on function public.rpc_authorize_evidence_download(uuid) from public,anon;
grant execute on function public.rpc_authorize_evidence_download(uuid) to authenticated,service_role;

comment on table public.participant_sessions is
  'Server workflow state. No direct browser reads; use narrow operator/kiosk projections.';
