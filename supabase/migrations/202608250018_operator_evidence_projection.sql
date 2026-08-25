-- Operators may receive only the evidence identifier needed to request a
-- short-lived playback link. Object paths and Storage metadata stay hidden.
create or replace view public.operator_submission_views
with (security_invoker = true)
as
select
  id,
  school_id,
  task_id,
  assignment_id,
  kind,
  title,
  accepted_at,
  case when kind='live_evidence' then source_record_id else null end as evidence_id
from public.submissions
where visibility='operator';

grant select on public.operator_submission_views to authenticated;
