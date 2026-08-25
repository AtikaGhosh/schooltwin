create or replace function private.validate_protected_response()
returns trigger language plpgsql set search_path=public,private,pg_temp as $$
declare v_answer jsonb;
begin
  if tg_table_name='student_pulse_responses' then
    if jsonb_typeof(new.answers)<>'array' or jsonb_array_length(new.answers) not between 1 and 2 then raise exception 'invalid_answers'; end if;
    for v_answer in select * from jsonb_array_elements(new.answers) loop
      if v_answer->>'answer' not in ('yes','no','did_not_check','not_sure','not_applicable') or nullif(v_answer->>'questionId','') is null then
        raise exception 'invalid_answers';
      end if;
    end loop;
  elsif tg_table_name='class_pulse_responses' then
    if jsonb_typeof(new.contextual_answers)<>'array' or jsonb_array_length(new.contextual_answers)<>1 then raise exception 'invalid_contextual_answers'; end if;
    for v_answer in select * from jsonb_array_elements(new.contextual_answers) loop
      if v_answer->>'answer' not in ('yes','no','did_not_check','not_sure','not_applicable') or nullif(v_answer->>'questionId','') is null then
        raise exception 'invalid_contextual_answers';
      end if;
    end loop;
  end if;
  return new;
end $$;

create trigger validate_student_pulse_response before insert on private.student_pulse_responses
for each row execute function private.validate_protected_response();
create trigger validate_class_pulse_response before insert on private.class_pulse_responses
for each row execute function private.validate_protected_response();

create or replace function private.validate_facility_response()
returns trigger language plpgsql set search_path=public,private,pg_temp as $$
begin
  if new.values->>'drinkingWater' not in ('available','unavailable')
    or new.values->>'boysToilet' not in ('usable','partially_usable','unusable')
    or new.values->>'girlsToilet' not in ('usable','partially_usable','unusable')
    or new.values->>'kitchen' not in ('operational','issue')
    or new.values->>'electricity' not in ('available','unavailable')
    or new.values->>'library' not in ('operational','issue')
    or new.values->>'playground' not in ('operational','issue') then
    raise exception 'invalid_facility_response';
  end if;
  return new;
end $$;
create trigger validate_facility_response before insert on public.facility_pulse_responses
for each row execute function private.validate_facility_response();

alter table public.operator_reports add constraint operator_report_not_blank check (description ~ '\S') not valid;
alter table public.operator_reports validate constraint operator_report_not_blank;
alter table private.private_reports add constraint private_report_not_blank check (description ~ '\S') not valid;
alter table private.private_reports validate constraint private_report_not_blank;
