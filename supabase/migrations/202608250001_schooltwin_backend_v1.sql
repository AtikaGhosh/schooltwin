-- SchoolTwin Pilot Backend Architecture v1.0
-- PostgreSQL is the final boundary for school ownership, state changes,
-- idempotency, participant capability use, and retention.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_cron with schema extensions;

create schema if not exists private;
create schema if not exists officials;

revoke all on schema private from public, anon, authenticated;
revoke all on schema officials from public, anon, authenticated;

create type public.app_role as enum (
  'platform_admin',
  'field_coordinator',
  'school_operator'
);
create type public.school_status as enum ('draft', 'active', 'suspended');
create type public.area_kind as enum ('building', 'classroom', 'facility', 'outdoor');
create type public.task_status as enum ('scheduled', 'in_progress', 'submitted', 'missed', 'failed');
create type public.task_scope as enum ('class', 'facility');
create type public.session_type as enum ('class_pulse', 'student_pulse', 'private_report');
create type public.session_status as enum ('issued', 'active', 'completed', 'expired');
create type public.grant_status as enum ('issued', 'redeemed', 'expired', 'revoked');
create type public.submission_kind as enum (
  'live_evidence', 'class_pulse', 'facility_pulse', 'student_pulse',
  'operator_report', 'private_report'
);
create type public.submission_visibility as enum ('operator', 'protected');
create type public.mutation_result as enum ('accepted', 'duplicate', 'rejected', 'retry');
create type public.upload_status as enum ('pending', 'uploading', 'uploaded', 'finalized', 'failed', 'orphaned', 'deleted');
create type public.fingerprint_status as enum ('pending', 'matched', 'failed');
create type public.timing_assurance as enum ('server_started', 'offline_claimed');
create type public.incident_category as enum (
  'water', 'sanitation', 'meals', 'teacher_availability', 'electricity',
  'classroom', 'infrastructure', 'other'
);

create table public.schools (
  id uuid primary key default gen_random_uuid(),
  school_twin_id text not null unique,
  name text not null,
  district text not null,
  state text not null,
  time_zone text not null default 'Asia/Kolkata',
  opening_time time not null default '10:00',
  closing_time time not null default '16:00',
  completion_grace_seconds integer not null default 300 check (completion_grace_seconds between 0 and 1800),
  protected_retention_days integer not null default 90 check (protected_retention_days between 1 and 365),
  evidence_retention_days integer not null default 90 check (evidence_retention_days between 1 and 365),
  operational_retention_days integer not null default 365 check (operational_retention_days between 30 and 1825),
  status public.school_status not null default 'draft',
  config_version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (opening_time < closing_time)
);

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  role public.app_role not null,
  disabled_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.school_memberships (
  school_id uuid not null references public.schools(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (school_id, user_id),
  check (role in ('field_coordinator', 'school_operator'))
);

create table public.school_calendar (
  school_id uuid not null references public.schools(id) on delete cascade,
  school_date date not null,
  is_open boolean not null default true,
  opening_time time,
  closing_time time,
  note text,
  primary key (school_id, school_date)
);

create table public.school_areas (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  parent_area_id uuid references public.school_areas(id) on delete set null,
  name text not null,
  kind public.area_kind not null,
  description text not null default '',
  marker_value text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (school_id, name)
);

create table public.sections (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  area_id uuid not null references public.school_areas(id),
  name text not null,
  expected_strength integer not null check (expected_strength between 0 and 500),
  sort_order integer not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (school_id, name),
  unique (school_id, sort_order)
);

create table public.facility_evidence_rules (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  area_id uuid not null references public.school_areas(id) on delete cascade,
  daily_required boolean not null default false,
  priority integer not null default 100,
  active boolean not null default true,
  unique (school_id, area_id)
);

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  label text not null,
  paired_by uuid not null references auth.users(id),
  paired_at timestamptz not null default now(),
  last_seen_at timestamptz,
  revoked_at timestamptz,
  revoke_reason text,
  unique (school_id, label)
);

create table private.device_pairing_codes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  code_hmac text not null unique,
  created_by uuid not null references auth.users(id),
  expires_at timestamptz not null,
  used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table private.device_leases (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  refreshed_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index device_leases_lookup on private.device_leases(device_id, user_id, expires_at);

create table public.school_days (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  school_date date not null,
  opens_at timestamptz not null,
  closes_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (school_id, school_date),
  check (opens_at < closes_at)
);

create table public.participant_sessions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  school_day_id uuid not null references public.school_days(id) on delete cascade,
  section_id uuid references public.sections(id),
  type public.session_type not null,
  status public.session_status not null default 'issued',
  expires_at timestamptz not null,
  activated_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.class_pulse_assignments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  school_day_id uuid not null references public.school_days(id) on delete cascade,
  section_id uuid not null references public.sections(id),
  session_id uuid not null unique references public.participant_sessions(id) on delete cascade,
  scheduled_start timestamptz not null,
  scheduled_end timestamptz not null,
  contextual_question jsonb not null,
  status public.task_status not null default 'scheduled',
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (school_day_id, section_id),
  check (scheduled_start < scheduled_end)
);

create table public.facility_pulse_assignments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  school_day_id uuid not null unique references public.school_days(id) on delete cascade,
  scheduled_start timestamptz not null,
  scheduled_end timestamptz not null,
  status public.task_status not null default 'scheduled',
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  check (scheduled_start < scheduled_end)
);

create table public.verification_tasks (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  school_day_id uuid not null references public.school_days(id) on delete cascade,
  section_id uuid references public.sections(id),
  area_id uuid not null references public.school_areas(id),
  scope public.task_scope not null,
  title text not null,
  instructions text not null,
  scheduled_start timestamptz not null,
  scheduled_end timestamptz not null,
  status public.task_status not null default 'scheduled',
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  check (scheduled_start < scheduled_end),
  check ((scope = 'class' and section_id is not null) or scope = 'facility')
);
create unique index verification_task_class_unique on public.verification_tasks(school_day_id, section_id) where scope = 'class';
create unique index verification_task_facility_unique on public.verification_tasks(school_day_id, area_id) where scope = 'facility';

create table private.access_grant_batches (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  school_day_id uuid not null references public.school_days(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  confirmed_printed_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table private.access_grants (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references private.access_grant_batches(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  school_day_id uuid not null references public.school_days(id) on delete cascade,
  session_id uuid not null unique references public.participant_sessions(id) on delete cascade,
  code_hmac text not null unique,
  session_type public.session_type not null,
  expires_at timestamptz not null,
  status public.grant_status not null default 'issued',
  redeemed_at timestamptz,
  redeemed_on date,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table private.grant_redemption_failures (
  id bigint generated always as identity primary key,
  school_id uuid references public.schools(id) on delete cascade,
  session_id uuid,
  device_id uuid,
  ip_hash text,
  occurred_at timestamptz not null default now(),
  reason text not null
);
create index grant_failure_window on private.grant_redemption_failures(session_id, device_id, occurred_at desc);
create index grant_failure_school_window on private.grant_redemption_failures(school_id, occurred_at desc);
create index grant_failure_ip_window on private.grant_redemption_failures(ip_hash, occurred_at desc);

create table private.participant_capabilities (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  session_id uuid not null unique references public.participant_sessions(id) on delete cascade,
  grant_id uuid not null unique references private.access_grants(id) on delete cascade,
  token_hash text not null unique,
  session_type public.session_type not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create table private.class_pulse_responses (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  assignment_id uuid not null unique references public.class_pulse_assignments(id) on delete cascade,
  session_id uuid not null unique references public.participant_sessions(id),
  section_id uuid not null references public.sections(id),
  approximate_students_present integer not null check (approximate_students_present >= 0),
  first_period_teacher_present boolean not null,
  scheduled_classes_held text not null check (scheduled_classes_held in ('all', 'partial', 'none')),
  electricity_available boolean not null,
  fans_and_lights_working text not null check (fans_and_lights_working in ('all', 'some', 'none')),
  classroom_usable boolean not null,
  drinking_water_available text not null check (drinking_water_available in ('yes', 'no', 'did_not_check')),
  toilets_accessible text not null check (toilets_accessible in ('yes', 'no', 'did_not_check')),
  meal_status text not null check (meal_status in ('served', 'not_served', 'not_yet')),
  unusual_condition text not null check (unusual_condition in ('no_issue', 'teacher_absent', 'water_issue', 'meal_issue', 'infrastructure_issue', 'other')),
  contextual_answers jsonb not null,
  submitted_at timestamptz not null default now(),
  delete_after timestamptz not null
);

create table private.student_pulse_responses (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  session_id uuid not null unique references public.participant_sessions(id) on delete cascade,
  answers jsonb not null,
  submitted_at timestamptz not null default now(),
  delete_after timestamptz not null
);

create table private.private_reports (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  category public.incident_category not null,
  description text not null check (char_length(description) between 10 and 5000),
  school_date date not null,
  delete_after date not null
);

create table public.facility_pulse_responses (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  assignment_id uuid not null unique references public.facility_pulse_assignments(id) on delete cascade,
  values jsonb not null,
  submitted_by uuid not null references auth.users(id),
  submitted_at timestamptz not null default now()
);

create table public.operator_reports (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  category public.incident_category not null,
  description text not null check (char_length(description) between 10 and 5000),
  submitted_by uuid not null references auth.users(id),
  submitted_at timestamptz not null default now()
);

create table public.task_challenges (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  task_id uuid not null unique references public.verification_tasks(id) on delete cascade,
  display_code text not null,
  steps jsonb not null,
  issued_at timestamptz not null default now()
);

create table private.capture_intents (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  task_id uuid not null references public.verification_tasks(id) on delete cascade,
  device_id uuid not null references public.devices(id),
  actor_id uuid not null references auth.users(id),
  challenge_id uuid not null references public.task_challenges(id),
  object_path text not null unique,
  work_lease_hash text not null,
  timing_assurance public.timing_assurance not null,
  expires_at timestamptz not null,
  finalized_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.evidence_objects (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  task_id uuid not null unique references public.verification_tasks(id),
  challenge_id uuid not null references public.task_challenges(id),
  object_path text not null unique,
  byte_length bigint not null check (byte_length between 1 and 31457280),
  mime_type text not null check (mime_type like 'video/%'),
  client_sha256 text not null check (client_sha256 ~ '^[0-9a-f]{64}$'),
  server_sha256 text,
  fingerprint_status public.fingerprint_status not null default 'pending',
  timing_assurance public.timing_assurance not null,
  client_started_at timestamptz,
  client_ended_at timestamptz,
  received_at timestamptz not null default now(),
  marker_method text not null,
  marker_value text,
  expected_marker_matched boolean not null,
  delete_after timestamptz not null,
  backup_delete_after timestamptz not null,
  status public.upload_status not null default 'finalized'
);

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  school_day_id uuid references public.school_days(id),
  task_id uuid references public.verification_tasks(id),
  assignment_id uuid,
  source_record_id uuid not null,
  kind public.submission_kind not null,
  visibility public.submission_visibility not null,
  title text not null,
  accepted_at timestamptz not null default now()
);
create unique index submission_task_once on public.submissions(task_id) where task_id is not null;
create unique index submission_assignment_once on public.submissions(assignment_id) where assignment_id is not null;

create table private.mutation_receipts (
  mutation_id uuid primary key,
  school_id uuid not null references public.schools(id) on delete cascade,
  device_id uuid not null references public.devices(id),
  result public.mutation_result not null,
  response jsonb not null,
  accepted_at timestamptz not null default now()
);

create table private.server_events (
  id bigint generated always as identity primary key,
  school_id uuid references public.schools(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  device_id uuid references public.devices(id) on delete set null,
  event_type text not null,
  target_type text,
  target_id uuid,
  result text not null,
  correlation_id uuid not null default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  delete_after timestamptz not null default (now() + interval '365 days'),
  detail jsonb not null default '{}'::jsonb,
  check (not (detail ?| array['answers', 'description', 'code', 'capability', 'pass']))
);

create table private.retention_jobs (
  id bigint generated always as identity primary key,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null check (status in ('running', 'completed', 'failed')),
  deleted_counts jsonb not null default '{}'::jsonb,
  error_code text
);

create table private.system_alerts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade,
  kind text not null,
  severity text not null check (severity in ('info', 'warning', 'critical')),
  status text not null default 'open' check (status in ('open', 'acknowledged', 'closed')),
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

create table private.failed_uploads (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade,
  capture_intent_id uuid,
  object_path text,
  attempt_count integer not null default 0,
  next_attempt_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create or replace function private.current_role()
returns public.app_role
language sql stable security definer
set search_path = public, private, pg_temp
as $$
  select role from public.profiles where user_id = auth.uid() and disabled_at is null
$$;

create or replace function private.has_school_role(p_school_id uuid, p_roles public.app_role[])
returns boolean
language sql stable security definer
set search_path = public, private, pg_temp
as $$
  select
    private.current_role() = 'platform_admin'
    or exists (
      select 1 from public.school_memberships m
      where m.school_id = p_school_id
        and m.user_id = auth.uid()
        and m.revoked_at is null
        and m.role = any(p_roles)
    )
$$;

create or replace function private.valid_device_lease(
  p_school_id uuid,
  p_device_id uuid,
  p_user_id uuid,
  p_token_hash text
)
returns boolean
language sql stable security definer
set search_path = public, private, pg_temp
as $$
  select exists (
    select 1
    from private.device_leases l
    join public.devices d on d.id = l.device_id
    where l.school_id = p_school_id
      and l.device_id = p_device_id
      and l.user_id = p_user_id
      and l.token_hash = p_token_hash
      and l.expires_at > now()
      and l.revoked_at is null
      and d.revoked_at is null
  )
$$;

create or replace function private.school_local_date(p_school_id uuid, p_at timestamptz default now())
returns date
language sql stable security definer
set search_path = public, private, pg_temp
as $$
  select (p_at at time zone s.time_zone)::date from public.schools s where s.id = p_school_id
$$;

create or replace function public.activate_school(p_school_id uuid)
returns void
language plpgsql security definer
set search_path = public, private, pg_temp
as $$
declare
  v_sections integer;
  v_facilities integer;
begin
  if not private.has_school_role(p_school_id, array['field_coordinator']::public.app_role[])
     and private.current_role() <> 'platform_admin' then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  select count(*) into v_sections from public.sections where school_id = p_school_id and active;
  select count(*) into v_facilities from public.facility_evidence_rules where school_id = p_school_id and active and daily_required;
  if v_sections <> 18 then raise exception 'school_requires_18_sections'; end if;
  if v_facilities <> 2 then raise exception 'school_requires_2_facility_evidence_rules'; end if;
  update public.schools set status = 'active', config_version = config_version + 1, updated_at = now() where id = p_school_id;
end
$$;

create or replace function private.ensure_school_day(p_school_id uuid, p_school_date date default null)
returns uuid
language plpgsql security definer
set search_path = public, private, pg_temp
as $$
declare
  v_school public.schools%rowtype;
  v_date date;
  v_open time;
  v_close time;
  v_day_id uuid;
  v_section record;
  v_session_id uuid;
  v_area record;
begin
  select * into strict v_school from public.schools where id = p_school_id and status = 'active' for update;
  v_date := coalesce(p_school_date, (now() at time zone v_school.time_zone)::date);
  if exists (select 1 from public.school_calendar where school_id = p_school_id and school_date = v_date and not is_open) then
    raise exception 'school_closed';
  end if;
  select coalesce(c.opening_time, v_school.opening_time), coalesce(c.closing_time, v_school.closing_time)
    into v_open, v_close
    from (select 1) x
    left join public.school_calendar c on c.school_id = p_school_id and c.school_date = v_date;

  insert into public.school_days(school_id, school_date, opens_at, closes_at)
  values (
    p_school_id,
    v_date,
    (v_date + v_open) at time zone v_school.time_zone,
    (v_date + v_close) at time zone v_school.time_zone
  )
  on conflict (school_id, school_date) do update set school_id = excluded.school_id
  returning id into v_day_id;

  for v_section in select * from public.sections where school_id = p_school_id and active order by sort_order loop
    select id into v_session_id from public.participant_sessions
      where school_day_id = v_day_id and section_id = v_section.id and type = 'class_pulse';
    if v_session_id is null then
      insert into public.participant_sessions(school_id, school_day_id, section_id, type, expires_at)
      select p_school_id, v_day_id, v_section.id, 'class_pulse', closes_at + interval '5 minutes'
      from public.school_days where id = v_day_id returning id into v_session_id;
    end if;
    insert into public.class_pulse_assignments(
      school_id, school_day_id, section_id, session_id, scheduled_start, scheduled_end, contextual_question
    )
    select p_school_id, v_day_id, v_section.id, v_session_id, opens_at, closes_at,
      jsonb_build_object('id', 'context-' || v_section.id, 'prompt', 'Did the first planned lesson begin?', 'allowedAnswers', jsonb_build_array('yes','no','not_sure'))
    from public.school_days where id = v_day_id
    on conflict (school_day_id, section_id) do nothing;

    insert into public.verification_tasks(
      school_id, school_day_id, section_id, area_id, scope, title, instructions, scheduled_start, scheduled_end
    )
    select p_school_id, v_day_id, v_section.id, v_section.area_id, 'class',
      'Class ' || v_section.name || ' Video', 'Record one continuous class video.', opens_at, closes_at
    from public.school_days where id = v_day_id
    on conflict (school_day_id, section_id) where scope = 'class' do nothing;
  end loop;

  insert into public.facility_pulse_assignments(school_id, school_day_id, scheduled_start, scheduled_end)
  select p_school_id, v_day_id, opens_at, closes_at from public.school_days where id = v_day_id
  on conflict (school_day_id) do nothing;

  for v_area in
    select a.* from public.facility_evidence_rules r
    join public.school_areas a on a.id = r.area_id
    where r.school_id = p_school_id and r.active and r.daily_required
    order by r.priority, a.id limit 2
  loop
    insert into public.verification_tasks(
      school_id, school_day_id, area_id, scope, title, instructions, scheduled_start, scheduled_end
    )
    select p_school_id, v_day_id, v_area.id, 'facility',
      v_area.name || ' Video', 'Record one continuous facility video.', opens_at, closes_at
    from public.school_days where id = v_day_id
    on conflict (school_day_id, area_id) where scope = 'facility' do nothing;
  end loop;
  return v_day_id;
end
$$;

create or replace function private.ensure_all_school_days()
returns integer
language plpgsql security definer
set search_path = public, private, pg_temp
as $$
declare v_school record; v_count integer := 0;
begin
  for v_school in select id from public.schools where status = 'active' loop
    perform private.ensure_school_day(v_school.id, null);
    v_count := v_count + 1;
  end loop;
  return v_count;
end
$$;

create or replace function private.fail_redemption(
  p_school_id uuid, p_session_id uuid, p_device_id uuid, p_ip_hash text, p_reason text
)
returns void
language sql security definer
set search_path = public, private, pg_temp
as $$
  insert into private.grant_redemption_failures(school_id, session_id, device_id, ip_hash, reason)
  values (p_school_id, p_session_id, p_device_id, p_ip_hash, p_reason)
$$;

create or replace function private.redeem_access_grant(
  p_session_id uuid,
  p_code_hmac text,
  p_device_id uuid,
  p_ip_hash text,
  p_capability_token_hash text
)
returns table(capability_id uuid, session_id uuid, session_type public.session_type, expires_at timestamptz)
language plpgsql security definer
set search_path = public, private, pg_temp
as $$
declare
  v_grant private.access_grants%rowtype;
  v_session public.participant_sessions%rowtype;
  v_failures integer;
  v_capability_id uuid;
  v_capability_expires timestamptz;
begin
  select * into v_session from public.participant_sessions where id = p_session_id for update;
  if not found then raise exception 'invalid_grant'; end if;

  select count(*) into v_failures from private.grant_redemption_failures
   where occurred_at > now() - interval '15 minutes'
     and (session_id = p_session_id or device_id = p_device_id or ip_hash = p_ip_hash or school_id = v_session.school_id);
  if v_failures >= 10 then raise exception 'redemption_locked'; end if;

  select * into v_grant from private.access_grants
   where session_id = p_session_id and code_hmac = p_code_hmac for update;
  if not found then
    perform private.fail_redemption(v_session.school_id, p_session_id, p_device_id, p_ip_hash, 'invalid');
    raise exception 'invalid_grant';
  end if;
  if v_grant.status <> 'issued' then raise exception 'grant_used_or_revoked'; end if;
  if v_grant.expires_at <= now() then
    update private.access_grants set status = 'expired' where id = v_grant.id;
    raise exception 'grant_expired';
  end if;
  if v_session.status <> 'issued' or v_session.expires_at <= now() then raise exception 'session_unavailable'; end if;
  if v_grant.session_type <> v_session.type then raise exception 'wrong_session'; end if;

  update private.access_grants set
    status = 'redeemed',
    redeemed_at = case when session_type = 'private_report' then null else now() end,
    redeemed_on = private.school_local_date(school_id)
  where id = v_grant.id and status = 'issued';
  if not found then raise exception 'grant_used_or_revoked'; end if;

  update public.participant_sessions set status = 'active', activated_at = now()
   where id = p_session_id and status = 'issued';

  v_capability_expires := least(v_grant.expires_at, now() + interval '30 minutes');
  insert into private.participant_capabilities(school_id, session_id, grant_id, token_hash, session_type, expires_at)
  values (v_grant.school_id, p_session_id, v_grant.id, p_capability_token_hash, v_grant.session_type, v_capability_expires)
  returning id into v_capability_id;

  return query select v_capability_id, p_session_id, v_grant.session_type, v_capability_expires;
end
$$;

create or replace function private.submit_participant_response(
  p_capability_hash text,
  p_payload jsonb
)
returns jsonb
language plpgsql security definer
set search_path = public, private, pg_temp
as $$
declare
  v_cap private.participant_capabilities%rowtype;
  v_session public.participant_sessions%rowtype;
  v_school public.schools%rowtype;
  v_assignment public.class_pulse_assignments%rowtype;
  v_section public.sections%rowtype;
  v_source_id uuid := gen_random_uuid();
  v_visibility public.submission_visibility := 'protected';
  v_title text;
begin
  select * into v_cap from private.participant_capabilities
   where token_hash = p_capability_hash and consumed_at is null for update;
  if not found then raise exception 'invalid_capability'; end if;
  if v_cap.expires_at <= now() then raise exception 'capability_expired'; end if;
  select * into strict v_session from public.participant_sessions where id = v_cap.session_id for update;
  select * into strict v_school from public.schools where id = v_cap.school_id;
  if v_session.status <> 'active' then raise exception 'session_unavailable'; end if;

  if v_cap.session_type = 'class_pulse' then
    select * into strict v_assignment from public.class_pulse_assignments where session_id = v_session.id for update;
    select * into strict v_section from public.sections where id = v_assignment.section_id;
    if (p_payload->>'approximateStudentsPresent')::integer not between 0 and v_section.expected_strength then
      raise exception 'students_out_of_range';
    end if;
    insert into private.class_pulse_responses(
      id, school_id, assignment_id, session_id, section_id, approximate_students_present,
      first_period_teacher_present, scheduled_classes_held, electricity_available,
      fans_and_lights_working, classroom_usable, drinking_water_available,
      toilets_accessible, meal_status, unusual_condition, contextual_answers, delete_after
    ) values (
      v_source_id, v_cap.school_id, v_assignment.id, v_session.id, v_assignment.section_id,
      (p_payload->>'approximateStudentsPresent')::integer,
      (p_payload->>'firstPeriodTeacherPresent') = 'yes', p_payload->>'scheduledClassesHeld',
      (p_payload->>'electricityAvailable') = 'yes', p_payload->>'fansAndLightsWorking',
      (p_payload->>'classroomUsable') = 'yes', p_payload->>'drinkingWaterAvailable',
      p_payload->>'toiletsAccessible', p_payload->>'mealStatus', p_payload->>'unusualCondition',
      coalesce(p_payload->'contextualAnswers', '[]'::jsonb), now() + make_interval(days => v_school.protected_retention_days)
    );
    update public.class_pulse_assignments set status = 'submitted', completed_at = now()
      where id = v_assignment.id and status in ('scheduled','in_progress');
    v_title := 'Class ' || v_section.name || ' Daily Class Check';
    insert into public.submissions(school_id, school_day_id, assignment_id, source_record_id, kind, visibility, title)
    values (v_cap.school_id, v_session.school_day_id, v_assignment.id, v_source_id, 'class_pulse', v_visibility, v_title);
  elsif v_cap.session_type = 'student_pulse' then
    if jsonb_typeof(p_payload->'answers') <> 'array' or jsonb_array_length(p_payload->'answers') not between 1 and 2 then
      raise exception 'invalid_answers';
    end if;
    insert into private.student_pulse_responses(id, school_id, session_id, answers, delete_after)
    values (v_source_id, v_cap.school_id, v_session.id, p_payload->'answers', now() + make_interval(days => v_school.protected_retention_days));
    insert into public.submissions(school_id, school_day_id, source_record_id, kind, visibility, title)
    values (v_cap.school_id, v_session.school_day_id, v_source_id, 'student_pulse', 'protected', 'Student Private Check');
  elsif v_cap.session_type = 'private_report' then
    if p_payload->>'category' = 'sensitive_or_immediate_safety' then raise exception 'sensitive_content_prohibited'; end if;
    if p_payload->>'category' not in ('water','sanitation','meals','teacher_availability','electricity','classroom','infrastructure','other') then
      raise exception 'invalid_category';
    end if;
    insert into private.private_reports(id, school_id, category, description, school_date, delete_after)
    values (
      v_source_id, v_cap.school_id, (p_payload->>'category')::public.incident_category,
      p_payload->>'description', private.school_local_date(v_cap.school_id),
      private.school_local_date(v_cap.school_id) + v_school.protected_retention_days
    );
    -- Deliberately no submission row and no per-report server event: both would create joinable timing data.
  else
    raise exception 'unsupported_session';
  end if;

  update public.participant_sessions set status = 'completed', completed_at = now() where id = v_session.id;
  delete from private.participant_capabilities where id = v_cap.id;
  return jsonb_build_object('status', 'accepted', 'sessionId', v_session.id);
exception when unique_violation then
  raise exception 'already_submitted';
end
$$;

create or replace function private.apply_operator_mutation(
  p_mutation_id uuid,
  p_school_id uuid,
  p_device_id uuid,
  p_device_token_hash text,
  p_type text,
  p_payload jsonb
)
returns jsonb
language plpgsql security definer
set search_path = public, private, pg_temp
as $$
declare v_existing private.mutation_receipts%rowtype; v_response jsonb; v_source_id uuid := gen_random_uuid();
begin
  select * into v_existing from private.mutation_receipts where mutation_id = p_mutation_id;
  if found then return v_existing.response || jsonb_build_object('result', 'duplicate'); end if;
  if not private.has_school_role(p_school_id, array['school_operator']::public.app_role[]) then raise exception 'not_authorized'; end if;
  if not private.valid_device_lease(p_school_id, p_device_id, auth.uid(), p_device_token_hash) then raise exception 'invalid_device_lease'; end if;

  if p_type = 'operator_report' then
    if p_payload->>'category' = 'sensitive_or_immediate_safety' then raise exception 'sensitive_content_prohibited'; end if;
    insert into public.operator_reports(id, school_id, category, description, submitted_by)
    values (v_source_id, p_school_id, (p_payload->>'category')::public.incident_category, p_payload->>'description', auth.uid());
    insert into public.submissions(school_id, source_record_id, kind, visibility, title)
    values (p_school_id, v_source_id, 'operator_report', 'operator', 'Problem report');
  elsif p_type = 'facility_pulse' then
    insert into public.facility_pulse_responses(id, school_id, assignment_id, values, submitted_by)
    values (v_source_id, p_school_id, (p_payload->>'assignmentId')::uuid, p_payload->'values', auth.uid());
    update public.facility_pulse_assignments set status = 'submitted', completed_at = now()
      where id = (p_payload->>'assignmentId')::uuid and school_id = p_school_id and status in ('scheduled','in_progress');
    if not found then raise exception 'assignment_unavailable'; end if;
    insert into public.submissions(school_id, school_day_id, assignment_id, source_record_id, kind, visibility, title)
    select p_school_id, school_day_id, id, v_source_id, 'facility_pulse', 'operator', 'Daily Facility Check'
      from public.facility_pulse_assignments where id = (p_payload->>'assignmentId')::uuid;
  else
    raise exception 'unsupported_mutation';
  end if;
  v_response := jsonb_build_object('result','accepted','sourceRecordId',v_source_id,'serverTime',now());
  insert into private.mutation_receipts(mutation_id, school_id, device_id, result, response)
  values (p_mutation_id, p_school_id, p_device_id, 'accepted', v_response);
  insert into private.server_events(school_id, actor_id, device_id, event_type, target_type, target_id, result)
  values (p_school_id, auth.uid(), p_device_id, p_type || '_submitted', p_type, v_source_id, 'accepted');
  return v_response;
exception when unique_violation then
  raise exception 'already_submitted';
end
$$;

create or replace function private.apply_retention()
returns jsonb
language plpgsql security definer
set search_path = public, private, pg_temp
as $$
declare v_job bigint; v_class integer; v_student integer; v_reports integer; v_events integer;
begin
  insert into private.retention_jobs(status) values ('running') returning id into v_job;
  delete from private.class_pulse_responses where delete_after <= now(); get diagnostics v_class = row_count;
  delete from private.student_pulse_responses where delete_after <= now(); get diagnostics v_student = row_count;
  delete from private.private_reports where delete_after <= current_date; get diagnostics v_reports = row_count;
  delete from private.grant_redemption_failures where occurred_at <= now() - interval '30 days';
  delete from private.server_events where delete_after <= now(); get diagnostics v_events = row_count;
  update public.evidence_objects set status = 'deleted' where delete_after <= now() and status <> 'deleted';
  update private.retention_jobs set completed_at = now(), status = 'completed',
    deleted_counts = jsonb_build_object('classResponses',v_class,'studentResponses',v_student,'privateReports',v_reports,'events',v_events)
    where id = v_job;
  return jsonb_build_object('jobId',v_job,'classResponses',v_class,'studentResponses',v_student,'privateReports',v_reports,'events',v_events);
exception when others then
  update private.retention_jobs set completed_at = now(), status = 'failed', error_code = sqlstate where id = v_job;
  raise;
end
$$;

create or replace function private.prevent_immutable_change()
returns trigger language plpgsql set search_path = public, private, pg_temp as $$
begin raise exception 'immutable_record'; end
$$;
create trigger submissions_immutable before update or delete on public.submissions for each row execute function private.prevent_immutable_change();
create trigger server_events_immutable before update or delete on private.server_events for each row execute function private.prevent_immutable_change();

create or replace view public.operator_submission_views
with (security_invoker = true)
as
select id, school_id, task_id, assignment_id, kind, title, accepted_at
from public.submissions
where visibility = 'operator';

create or replace view officials.officials_feed_v1 as
select s.school_id, s.school_day_id, s.kind as source_kind, s.source_record_id,
       s.accepted_at, 'observation_submitted'::text as collection_fact
from public.submissions s;
revoke all on officials.officials_feed_v1 from public, anon, authenticated;

alter table public.schools enable row level security;
alter table public.profiles enable row level security;
alter table public.school_memberships enable row level security;
alter table public.school_calendar enable row level security;
alter table public.school_areas enable row level security;
alter table public.sections enable row level security;
alter table public.facility_evidence_rules enable row level security;
alter table public.devices enable row level security;
alter table public.school_days enable row level security;
alter table public.participant_sessions enable row level security;
alter table public.class_pulse_assignments enable row level security;
alter table public.facility_pulse_assignments enable row level security;
alter table public.verification_tasks enable row level security;
alter table public.facility_pulse_responses enable row level security;
alter table public.operator_reports enable row level security;
alter table public.task_challenges enable row level security;
alter table public.evidence_objects enable row level security;
alter table public.submissions enable row level security;

create policy profile_self_read on public.profiles for select to authenticated using (user_id = auth.uid());
create policy school_member_read on public.schools for select to authenticated using (private.has_school_role(id, array['field_coordinator','school_operator']::public.app_role[]));
create policy membership_self_read on public.school_memberships for select to authenticated using (user_id = auth.uid() or private.current_role() = 'platform_admin');
create policy areas_member_read on public.school_areas for select to authenticated using (private.has_school_role(school_id, array['field_coordinator','school_operator']::public.app_role[]));
create policy sections_member_read on public.sections for select to authenticated using (private.has_school_role(school_id, array['field_coordinator','school_operator']::public.app_role[]));
create policy calendar_member_read on public.school_calendar for select to authenticated using (private.has_school_role(school_id, array['field_coordinator','school_operator']::public.app_role[]));
create policy facility_rules_member_read on public.facility_evidence_rules for select to authenticated using (private.has_school_role(school_id, array['field_coordinator','school_operator']::public.app_role[]));
create policy devices_member_read on public.devices for select to authenticated using (private.has_school_role(school_id, array['field_coordinator','school_operator']::public.app_role[]));
create policy school_days_member_read on public.school_days for select to authenticated using (private.has_school_role(school_id, array['field_coordinator','school_operator']::public.app_role[]));
create policy sessions_operator_safe_read on public.participant_sessions for select to authenticated using (private.has_school_role(school_id, array['school_operator']::public.app_role[]));
create policy class_assignments_member_read on public.class_pulse_assignments for select to authenticated using (private.has_school_role(school_id, array['school_operator']::public.app_role[]));
create policy facility_assignments_member_read on public.facility_pulse_assignments for select to authenticated using (private.has_school_role(school_id, array['school_operator']::public.app_role[]));
create policy tasks_member_read on public.verification_tasks for select to authenticated using (private.has_school_role(school_id, array['school_operator']::public.app_role[]));
create policy facility_response_operator_read on public.facility_pulse_responses for select to authenticated using (private.has_school_role(school_id, array['school_operator']::public.app_role[]));
create policy operator_reports_member_read on public.operator_reports for select to authenticated using (private.has_school_role(school_id, array['school_operator']::public.app_role[]));
create policy challenge_operator_read on public.task_challenges for select to authenticated using (private.has_school_role(school_id, array['school_operator']::public.app_role[]));
create policy evidence_operator_read on public.evidence_objects for select to authenticated using (private.has_school_role(school_id, array['school_operator']::public.app_role[]));
create policy submissions_operator_read on public.submissions for select to authenticated using (visibility = 'operator' and private.has_school_role(school_id, array['school_operator']::public.app_role[]));

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('school-evidence', 'school-evidence', false, 31457280, array['video/webm','video/mp4'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy evidence_storage_read on storage.objects for select to authenticated
using (
  bucket_id = 'school-evidence'
  and exists (
    select 1 from public.evidence_objects e
    where e.object_path = name
      and private.has_school_role(e.school_id, array['school_operator']::public.app_role[])
  )
);
-- Upload INSERT is intentionally absent for browser roles. Signed upload URLs are created by Edge Functions.

revoke all on all tables in schema private from anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated;
grant usage on schema public to authenticated;
grant select on public.operator_submission_views to authenticated;
grant execute on function public.activate_school(uuid) to authenticated;
grant execute on function private.apply_operator_mutation(uuid,uuid,uuid,text,text,jsonb) to authenticated;

grant usage on schema private to service_role;
grant all on all tables in schema private to service_role;
grant execute on all functions in schema private to service_role;

select cron.schedule('schooltwin-create-school-days', '5 * * * *', $$select private.ensure_all_school_days()$$)
where not exists (select 1 from cron.job where jobname = 'schooltwin-create-school-days');
select cron.schedule('schooltwin-retention', '35 19 * * *', $$select private.apply_retention()$$)
where not exists (select 1 from cron.job where jobname = 'schooltwin-retention');

comment on schema private is 'Never expose through the Data API. Protected participant data and server-only state.';
comment on schema officials is 'Future Officials App feed contracts. No current application grants.';
comment on table private.private_reports is 'Ordinary private operational reports. Deliberately stores school date only and no participant/session/device link.';
comment on table private.server_events is 'Application-append-only operational events. Database administrators remain able to change data; this is not immutable storage.';
