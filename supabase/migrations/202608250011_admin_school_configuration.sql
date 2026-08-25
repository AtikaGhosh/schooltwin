create or replace function private.admin_save_school_configuration(p_school_id uuid,p_config jsonb)
returns jsonb language plpgsql security definer set search_path=public,private,pg_temp as $$
declare v_item jsonb; v_area uuid; v_sections integer; v_rules integer;
begin
  if private.current_role() not in ('platform_admin','field_coordinator')
    or (private.current_role()='field_coordinator' and not private.has_school_role(p_school_id,array['field_coordinator']::public.app_role[])) then raise exception 'not_authorized'; end if;
  if jsonb_typeof(p_config->'areas')<>'array' or jsonb_typeof(p_config->'sections')<>'array' or jsonb_typeof(p_config->'facilityEvidenceRules')<>'array' then
    raise exception 'invalid_school_configuration';
  end if;

  update public.school_areas set active=false where school_id=p_school_id;
  for v_item in select * from jsonb_array_elements(p_config->'areas') loop
    insert into public.school_areas(school_id,name,kind,description,marker_value,active)
    values(p_school_id,v_item->>'name',(v_item->>'kind')::public.area_kind,coalesce(v_item->>'description',''),v_item->>'markerValue',true)
    on conflict(school_id,name) do update set kind=excluded.kind,description=excluded.description,marker_value=excluded.marker_value,active=true;
  end loop;

  update public.sections set active=false where school_id=p_school_id;
  for v_item in select * from jsonb_array_elements(p_config->'sections') loop
    select id into strict v_area from public.school_areas where school_id=p_school_id and name=v_item->>'areaName' and active;
    insert into public.sections(school_id,area_id,name,expected_strength,sort_order,active)
    values(p_school_id,v_area,v_item->>'name',(v_item->>'expectedStrength')::integer,(v_item->>'sortOrder')::integer,true)
    on conflict(school_id,name) do update set area_id=excluded.area_id,expected_strength=excluded.expected_strength,sort_order=excluded.sort_order,active=true;
  end loop;

  update public.facility_evidence_rules set active=false,daily_required=false where school_id=p_school_id;
  for v_item in select * from jsonb_array_elements(p_config->'facilityEvidenceRules') loop
    select id into strict v_area from public.school_areas where school_id=p_school_id and name=v_item->>'areaName' and active;
    insert into public.facility_evidence_rules(school_id,area_id,daily_required,priority,active)
    values(p_school_id,v_area,true,coalesce((v_item->>'priority')::integer,100),true)
    on conflict(school_id,area_id) do update set daily_required=true,priority=excluded.priority,active=true;
  end loop;

  if jsonb_typeof(p_config->'calendar')='array' then
    for v_item in select * from jsonb_array_elements(p_config->'calendar') loop
      insert into public.school_calendar(school_id,school_date,is_open,opening_time,closing_time,note)
      values(p_school_id,(v_item->>'date')::date,coalesce((v_item->>'isOpen')::boolean,true),(v_item->>'openingTime')::time,(v_item->>'closingTime')::time,v_item->>'note')
      on conflict(school_id,school_date) do update set is_open=excluded.is_open,opening_time=excluded.opening_time,closing_time=excluded.closing_time,note=excluded.note;
    end loop;
  end if;

  select count(*) into v_sections from public.sections where school_id=p_school_id and active;
  select count(*) into v_rules from public.facility_evidence_rules where school_id=p_school_id and active and daily_required;
  if v_sections<>18 or v_rules<>2 then raise exception 'school_configuration_requires_18_sections_and_2_facilities'; end if;
  update public.schools set config_version=config_version+1,updated_at=now() where id=p_school_id;
  return jsonb_build_object('schoolId',p_school_id,'sections',v_sections,'facilityEvidenceRules',v_rules);
end $$;

create or replace function public.rpc_admin_save_school_configuration(p_school_id uuid,p_config jsonb)
returns jsonb language sql security invoker set search_path=public,private,pg_temp
as $$select private.admin_save_school_configuration(p_school_id,p_config)$$;

revoke all on function private.admin_save_school_configuration(uuid,jsonb) from public,anon,authenticated;
revoke all on function public.rpc_admin_save_school_configuration(uuid,jsonb) from public,anon;
grant execute on function private.admin_save_school_configuration(uuid,jsonb) to authenticated;
grant execute on function public.rpc_admin_save_school_configuration(uuid,jsonb) to authenticated;
grant execute on function public.rpc_admin_save_school_configuration(uuid,jsonb) to service_role;
