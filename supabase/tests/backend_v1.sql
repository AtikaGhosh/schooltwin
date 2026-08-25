begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

select has_schema('private', 'private schema exists');
select has_schema('officials', 'officials schema exists');
select has_table('public', 'schools', 'schools table exists');
select has_table('private', 'access_grants', 'protected grant table exists');
select has_table('private', 'participant_capabilities', 'capability table exists');
select has_table('private', 'private_reports', 'private report table exists');
select has_table('public', 'evidence_objects', 'evidence table exists');
select has_view('officials', 'officials_feed_v1', 'future feed contract exists');

select is(
  (select count(*)::integer from public.class_pulse_assignments a join public.school_days d on d.id = a.school_day_id where d.school_date = (now() at time zone 'Asia/Kolkata')::date),
  18,
  'current seed creates exactly 18 class checks'
);
select is(
  (select count(*)::integer from public.verification_tasks t join public.school_days d on d.id = t.school_day_id where d.school_date = (now() at time zone 'Asia/Kolkata')::date and t.scope = 'class'),
  18,
  'current seed creates exactly 18 class videos'
);
select is(
  (select count(*)::integer from public.facility_pulse_assignments a join public.school_days d on d.id = a.school_day_id where d.school_date = (now() at time zone 'Asia/Kolkata')::date),
  1,
  'current seed creates exactly one facility check'
);
select is(
  (select count(*)::integer from public.verification_tasks t join public.school_days d on d.id = t.school_day_id where d.school_date = (now() at time zone 'Asia/Kolkata')::date and t.scope = 'facility'),
  2,
  'current seed creates exactly two facility videos'
);

select is((select completion_grace_seconds from public.schools where school_twin_id = 'ST-OD-1048'), 300, 'grace is five minutes');
select is((select protected_retention_days from public.schools where school_twin_id = 'ST-OD-1048'), 90, 'protected retention is 90 days');
select is((select evidence_retention_days from public.schools where school_twin_id = 'ST-OD-1048'), 90, 'video retention is 90 days');

select hasnt_column('private', 'private_reports', 'participant_id', 'private report has no participant');
select hasnt_column('private', 'private_reports', 'session_id', 'private report has no session');
select hasnt_column('private', 'private_reports', 'device_id', 'private report has no device');
select hasnt_column('private', 'private_reports', 'submitted_at', 'private report has no exact application time');
select has_column('private', 'private_reports', 'school_date', 'private report keeps school date');

select isnt_empty(
  $$select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'private' and p.proname = 'redeem_access_grant' and p.prosecdef$$,
  'redemption is a security-definer database transaction'
);
select isnt_empty(
  $$select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'private' and p.proname = 'submit_participant_response' and p.prosecdef$$,
  'participant submission is a security-definer database transaction'
);
select isnt_empty(
  $$select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'submissions' and c.relrowsecurity$$,
  'submissions have row security enabled'
);
select isnt_empty(
  $$select 1 from storage.buckets where id = 'school-evidence' and not public and file_size_limit = 31457280$$,
  'evidence bucket is private and size limited'
);

select * from finish();
rollback;
