-- 수정 1: 비멤버(crew_role = NULL)가 `not in (...)` 검사를 통과하던 문제
-- 수정 2: register_event에서 count(*) 이후 FOUND가 항상 true라 신규 신청이 깨지던 문제

create or replace function update_crew(p_crew uuid, p_name text, p_intro text, p_theme text) returns void
  language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform require_user();
  if coalesce(crew_role(p_crew), '') not in ('owner','staff') then raise exception 'forbidden'; end if;
  update crews set name = trim(p_name), intro = coalesce(p_intro,''), theme = p_theme where id = p_crew;
end $$;

create or replace function set_member_role(p_crew uuid, p_user uuid, p_role text) returns void
  language plpgsql security definer set search_path = public, pg_temp as $$
declare v_plan text; v_staff int; v_cur text;
begin
  perform require_user();
  if coalesce(crew_role(p_crew), '') <> 'owner' then raise exception 'forbidden'; end if;
  if p_role not in ('staff','member') then raise exception 'invalid_role'; end if;
  select plan into v_plan from crews where id = p_crew for update;
  select role into v_cur from crew_members where crew_id = p_crew and user_id = p_user;
  if v_cur is null then raise exception 'not_found'; end if;
  if v_cur = 'owner' then raise exception 'forbidden'; end if;
  select count(*) into v_staff from crew_members where crew_id = p_crew and role = 'staff';
  if p_role = 'staff' and v_cur <> 'staff'
     and v_staff >= (case when v_plan = 'pro' then 5 else 1 end) then
    raise exception 'staff_limit';
  end if;
  update crew_members set role = p_role where crew_id = p_crew and user_id = p_user;
end $$;

create or replace function set_plan(p_crew uuid, p_plan text) returns void
  language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := require_user(); v_m int; v_s int;
begin
  if coalesce(crew_role(p_crew), '') <> 'owner' then raise exception 'forbidden'; end if;
  if p_plan not in ('free','pro') then raise exception 'invalid_plan'; end if;
  perform 1 from crews where id = p_crew for update;
  if p_plan = 'free' then
    select count(*) into v_m from crew_members where crew_id = p_crew;
    select count(*) into v_s from crew_members where crew_id = p_crew and role = 'staff';
    if v_m > 30 then raise exception 'too_many_members'; end if;
    if v_s > 1 then raise exception 'staff_limit'; end if;
  end if;
  update crews set plan = p_plan where id = p_crew;
  insert into plan_changes (crew_id, plan, changed_by) values (p_crew, p_plan, v_uid);
end $$;

create or replace function create_event(p_crew uuid, p_title text, p_desc text, p_loc text, p_starts timestamptz, p_cap int)
  returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := require_user(); v_id uuid; m record;
begin
  if coalesce(crew_role(p_crew), '') not in ('owner','staff') then raise exception 'forbidden'; end if;
  if p_starts <= now() then raise exception 'past_time'; end if;
  insert into events (crew_id, title, description, location, starts_at, capacity, created_by)
    values (p_crew, trim(p_title), coalesce(p_desc,''), coalesce(p_loc,''), p_starts, p_cap, v_uid)
    returning id into v_id;
  for m in select user_id from crew_members where crew_id = p_crew and user_id <> v_uid loop
    perform notify(m.user_id, p_crew, v_id, 'new_event', '새 모임이 열렸어요: ' || trim(p_title), 'event:' || v_id);
  end loop;
  return v_id;
end $$;

create or replace function update_event(p_event uuid, p_title text, p_desc text, p_loc text, p_starts timestamptz, p_cap int)
  returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare e events%rowtype; v_att int;
begin
  perform require_user();
  select * into e from events where id = p_event for update;
  if not found then raise exception 'not_found'; end if;
  if coalesce(crew_role(e.crew_id), '') not in ('owner','staff') then raise exception 'forbidden'; end if;
  if e.starts_at <= now() then raise exception 'event_started'; end if;
  if p_starts <= now() then raise exception 'past_time'; end if;
  select count(*) into v_att from registrations where event_id = p_event and status = 'attending';
  if p_cap < v_att then raise exception 'capacity_below_attending'; end if;
  update events set title = trim(p_title), description = coalesce(p_desc,''), location = coalesce(p_loc,''),
    starts_at = p_starts, capacity = p_cap where id = p_event;
  perform promote_waitlist(p_event);
end $$;

create or replace function register_event(p_event uuid) returns text
  language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := require_user(); e events%rowtype; r registrations%rowtype;
        v_att int; v_status text; v_had boolean;
begin
  select * into e from events where id = p_event for update;   -- 동시 신청 직렬화
  if not found or not is_member(e.crew_id) then raise exception 'forbidden'; end if;
  if e.starts_at <= now() then raise exception 'event_started'; end if;
  select * into r from registrations where event_id = p_event and user_id = v_uid;
  v_had := found;                                              -- count(*) 전에 FOUND 보존
  if v_had and r.status in ('attending','waitlist') then return r.status; end if;  -- 중복 클릭 멱등
  select count(*) into v_att from registrations where event_id = p_event and status = 'attending';
  v_status := case when v_att < e.capacity then 'attending' else 'waitlist' end;
  if v_had then
    update registrations set status = v_status, seq = nextval('registration_seq'),
      checked_in = false, updated_at = now() where id = r.id returning * into r;
  else
    insert into registrations (event_id, user_id, status) values (p_event, v_uid, v_status) returning * into r;
  end if;
  perform notify(v_uid, e.crew_id, p_event, 'registered',
    case v_status when 'attending' then '참석이 확정됐어요: ' else '대기 명단에 올랐어요: ' end || e.title,
    'reg:' || r.id || ':' || r.seq);
  return v_status;
end $$;

create or replace function check_in(p_event uuid, p_user uuid, p_flag boolean) returns void
  language plpgsql security definer set search_path = public, pg_temp as $$
declare e events%rowtype;
begin
  perform require_user();
  select * into e from events where id = p_event;
  if not found then raise exception 'not_found'; end if;
  if coalesce(crew_role(e.crew_id), '') not in ('owner','staff') then raise exception 'forbidden'; end if;
  if now() < e.starts_at - interval '2 hours' then raise exception 'too_early'; end if;
  update registrations set checked_in = p_flag, updated_at = now()
    where event_id = p_event and user_id = p_user and status = 'attending';
  if not found then raise exception 'not_attending'; end if;
end $$;
