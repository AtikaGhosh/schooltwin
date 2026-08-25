-- Fictional local/staging seed only. Production is provisioned through /admin.
do $$
declare
  v_school uuid := '10000000-0000-0000-0000-000000000001';
  v_building uuid := '10000000-0000-0000-0000-000000000002';
  v_area uuid;
  v_names text[] := array['1A','1B','2A','2B','3A','3B','4A','4B','5A','5B','6A','6B','7A','7B','8A','8B','9A','9B'];
  v_name text;
  v_index integer := 0;
begin
  insert into public.schools(
    id, school_twin_id, name, district, state, time_zone, opening_time, closing_time, status
  ) values (
    v_school, 'ST-OD-1048', 'Sundarpur Government High School', 'Sundarpur', 'Odisha',
    'Asia/Kolkata', '10:00', '16:00', 'draft'
  ) on conflict (id) do nothing;

  insert into public.school_areas(id, school_id, name, kind, description)
  values (v_building, v_school, 'Main Building', 'building', 'Fictional local pilot building')
  on conflict (id) do nothing;

  foreach v_name in array v_names loop
    v_index := v_index + 1;
    v_area := ('20000000-0000-0000-0000-' || lpad(v_index::text, 12, '0'))::uuid;
    insert into public.school_areas(id, school_id, parent_area_id, name, kind, description, marker_value)
    values (v_area, v_school, v_building, 'Class ' || v_name, 'classroom', 'Fictional classroom', 'schooltwin://ST-OD-1048/class/' || v_name)
    on conflict (id) do nothing;
    insert into public.sections(id, school_id, area_id, name, expected_strength, sort_order)
    values (('30000000-0000-0000-0000-' || lpad(v_index::text, 12, '0'))::uuid, v_school, v_area, v_name, 34 + (v_index % 9), v_index)
    on conflict (id) do nothing;
  end loop;

  insert into public.school_areas(id, school_id, name, kind, description, marker_value) values
    ('40000000-0000-0000-0000-000000000001', v_school, 'Kitchen', 'facility', 'Fictional kitchen', 'schooltwin://ST-OD-1048/facility/kitchen'),
    ('40000000-0000-0000-0000-000000000002', v_school, 'Drinking Water', 'facility', 'Fictional water point', 'schooltwin://ST-OD-1048/facility/water'),
    ('40000000-0000-0000-0000-000000000003', v_school, 'Boys Toilet', 'facility', 'Fictional facility', 'schooltwin://ST-OD-1048/facility/boys-toilet'),
    ('40000000-0000-0000-0000-000000000004', v_school, 'Girls Toilet', 'facility', 'Fictional facility', 'schooltwin://ST-OD-1048/facility/girls-toilet'),
    ('40000000-0000-0000-0000-000000000005', v_school, 'Library', 'facility', 'Fictional facility', 'schooltwin://ST-OD-1048/facility/library'),
    ('40000000-0000-0000-0000-000000000006', v_school, 'Electricity', 'facility', 'Fictional facility', 'schooltwin://ST-OD-1048/facility/electricity'),
    ('40000000-0000-0000-0000-000000000007', v_school, 'Playground', 'outdoor', 'Fictional facility', 'schooltwin://ST-OD-1048/facility/playground')
  on conflict (id) do nothing;

  insert into public.facility_evidence_rules(school_id, area_id, daily_required, priority) values
    (v_school, '40000000-0000-0000-0000-000000000001', true, 1),
    (v_school, '40000000-0000-0000-0000-000000000002', true, 2)
  on conflict (school_id, area_id) do update set daily_required = excluded.daily_required, priority = excluded.priority;

  update public.schools set status = 'active' where id = v_school;
  perform private.ensure_school_day(v_school, (now() at time zone 'Asia/Kolkata')::date);
end
$$;
