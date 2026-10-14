-- TeamNote: 팀 출석부 + 연차(반차 포함) 신청 노트. 모든 쓰기는 RPC 경유, 모든 테이블 RLS.
create extension if not exists pgcrypto;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'teamnote_app') then
    create role teamnote_app login;
  end if;
end $$;

create table users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text not null check (char_length(name) between 1 and 30),
  pw_hash text not null,
  created_at timestamptz not null default now()
);

create table sessions (
  token_hash text primary key,
  user_id uuid not null references users(id) on delete cascade,
  expires_at timestamptz not null
);

create table teams (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 40),
  annual_days numeric(4,1) not null default 15 check (annual_days between 0 and 60),
  invite_code text not null unique default encode(gen_random_bytes(6), 'hex'),
  created_by uuid not null references users(id),
  created_at timestamptz not null default now()
);

create table team_members (
  team_id uuid not null references teams(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role text not null check (role in ('owner','staff','member')),
  allowance_override numeric(4,1) check (allowance_override between 0 and 60),
  joined_at timestamptz not null default now(),
  primary key (team_id, user_id)
);
create index on team_members (user_id);
create unique index one_owner_per_team on team_members (team_id) where role = 'owner';

create table leave_requests (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  kind text not null check (kind in ('full','half_am','half_pm')),
  start_date date not null,
  end_date date not null,
  days numeric(4,1) not null check (days > 0),
  reason text not null default '' check (char_length(reason) <= 200),
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  decided_by uuid references users(id),
  decided_at timestamptz,
  decision_note text not null default '' check (char_length(decision_note) <= 200),
  created_at timestamptz not null default now(),
  check (end_date >= start_date),
  check (kind = 'full' or start_date = end_date),
  check (extract(year from start_date) = extract(year from end_date))
);
create index on leave_requests (team_id, status, start_date);
create index on leave_requests (user_id, start_date);

create table attendance (
  team_id uuid not null references teams(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  work_date date not null,
  status text not null check (status in ('office','remote','field')),
  updated_by uuid references users(id),
  updated_at timestamptz not null default now(),
  primary key (team_id, user_id, work_date)
);
create index on attendance (team_id, work_date);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  team_id uuid references teams(id) on delete cascade,
  kind text not null,
  body text not null,
  dedupe_key text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);
create index on notifications (user_id, created_at desc);

-- ---------- 헬퍼 ----------
create function app_uid() returns uuid language sql stable
  as $$ select nullif(current_setting('app.user_id', true), '')::uuid $$;

create function kst_today() returns date language sql stable
  as $$ select (now() at time zone 'Asia/Seoul')::date $$;

create function team_role(p_team uuid) returns text language sql stable
  security definer set search_path = public, pg_temp
  as $$ select role from team_members where team_id = p_team and user_id = app_uid() $$;

create function is_member(p_team uuid) returns boolean language sql stable
  security definer set search_path = public, pg_temp
  as $$ select exists (select 1 from team_members where team_id = p_team and user_id = app_uid()) $$;

create function is_approver(p_team uuid) returns boolean language sql stable
  security definer set search_path = public, pg_temp
  as $$ select coalesce(team_role(p_team), '') in ('owner','staff') $$;

create function shares_team(p_user uuid) returns boolean language sql stable
  security definer set search_path = public, pg_temp
  as $$ select exists (select 1 from team_members a join team_members b on a.team_id = b.team_id
                       where a.user_id = app_uid() and b.user_id = p_user) $$;

-- 근무일(월~금) 수 계산
create function workdays(p_start date, p_end date) returns int language sql immutable
  as $$ select count(*)::int from generate_series(p_start, p_end, interval '1 day') d
        where extract(isodow from d) < 6 $$;

-- ---------- RLS ----------
alter table users enable row level security;
alter table sessions enable row level security;
alter table teams enable row level security;
alter table team_members enable row level security;
alter table leave_requests enable row level security;
alter table attendance enable row level security;
alter table notifications enable row level security;

create policy users_select on users for select using (id = app_uid() or shares_team(id));
create policy teams_select on teams for select using (is_member(id));
create policy members_select on team_members for select using (is_member(team_id));
-- 연차 사유는 본인과 승인자만 조회 (팀 캘린더는 team_calendar() 함수로 사유 없이 제공)
create policy leave_select on leave_requests for select using (user_id = app_uid() or is_approver(team_id));
create policy attendance_select on attendance for select using (is_member(team_id));
create policy notif_select on notifications for select using (user_id = app_uid());

-- ---------- 인증 ----------
create function auth_register(p_email text, p_name text, p_hash text) returns uuid
  language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid;
begin
  insert into users (email, name, pw_hash) values (lower(trim(p_email)), trim(p_name), p_hash)
    returning id into v_id;
  return v_id;
exception when unique_violation then raise exception 'email_taken';
end $$;

create function auth_get_login(p_email text) returns table (id uuid, pw_hash text)
  language sql security definer set search_path = public, pg_temp
  as $$ select u.id, u.pw_hash from users u where u.email = lower(trim(p_email)) $$;

create function auth_create_session(p_user uuid, p_token_hash text, p_hours int) returns void
  language sql security definer set search_path = public, pg_temp
  as $$ delete from sessions where expires_at < now();
        insert into sessions (token_hash, user_id, expires_at)
        values (p_token_hash, p_user, now() + make_interval(hours => p_hours)) $$;

create function auth_session_user(p_token_hash text) returns table (id uuid, name text, email text)
  language sql security definer set search_path = public, pg_temp
  as $$ select u.id, u.name, u.email from sessions s join users u on u.id = s.user_id
        where s.token_hash = p_token_hash and s.expires_at > now() $$;

create function auth_delete_session(p_token_hash text) returns void
  language sql security definer set search_path = public, pg_temp
  as $$ delete from sessions where token_hash = p_token_hash $$;

-- ---------- 내부 ----------
create function require_user() returns uuid language plpgsql stable
  security definer set search_path = public, pg_temp as $$
begin
  if app_uid() is null then raise exception 'not_authenticated'; end if;
  return app_uid();
end $$;

create function notify(p_user uuid, p_team uuid, p_kind text, p_body text, p_key text)
  returns void language sql security definer set search_path = public, pg_temp
  as $$ insert into notifications (user_id, team_id, kind, body, dedupe_key)
        values (p_user, p_team, p_kind, p_body, p_key)
        on conflict (user_id, dedupe_key) do nothing $$;

-- 해당 연도 연차 지급일수 (개인 지정 > 팀 기본)
create function allowance_of(p_team uuid, p_user uuid) returns numeric
  language sql stable security definer set search_path = public, pg_temp
  as $$ select coalesce(m.allowance_override, t.annual_days)
        from team_members m join teams t on t.id = m.team_id
        where m.team_id = p_team and m.user_id = p_user $$;

-- ---------- 팀 ----------
create function team_preview(p_code text)
  returns table (id uuid, name text, member_count int)
  language sql stable security definer set search_path = public, pg_temp
  as $$ select t.id, t.name, (select count(*)::int from team_members m where m.team_id = t.id)
        from teams t where t.invite_code = p_code $$;

create function create_team(p_name text, p_days numeric) returns uuid
  language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := require_user(); v_id uuid;
begin
  insert into teams (name, annual_days, created_by) values (trim(p_name), p_days, v_uid) returning id into v_id;
  insert into team_members (team_id, user_id, role) values (v_id, v_uid, 'owner');
  return v_id;
end $$;

create function update_team(p_team uuid, p_name text, p_days numeric) returns void
  language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform require_user();
  if coalesce(team_role(p_team), '') <> 'owner' then raise exception 'forbidden'; end if;
  update teams set name = trim(p_name), annual_days = p_days where id = p_team;
end $$;

create function join_team(p_code text) returns uuid
  language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := require_user(); v_team uuid;
begin
  select id into v_team from teams where invite_code = p_code;
  if v_team is null then raise exception 'invalid_invite'; end if;
  insert into team_members (team_id, user_id, role) values (v_team, v_uid, 'member')
    on conflict do nothing;
  return v_team;
end $$;

create function set_member_role(p_team uuid, p_user uuid, p_role text) returns void
  language plpgsql security definer set search_path = public, pg_temp as $$
declare v_cur text;
begin
  perform require_user();
  if coalesce(team_role(p_team), '') <> 'owner' then raise exception 'forbidden'; end if;
  if p_role not in ('staff','member') then raise exception 'invalid_role'; end if;
  select role into v_cur from team_members where team_id = p_team and user_id = p_user;
  if v_cur is null then raise exception 'not_found'; end if;
  if v_cur = 'owner' then raise exception 'forbidden'; end if;
  update team_members set role = p_role where team_id = p_team and user_id = p_user;
end $$;

-- 개인별 지급일수 지정 (null = 팀 기본값 사용)
create function set_member_allowance(p_team uuid, p_user uuid, p_days numeric) returns void
  language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform require_user();
  if coalesce(team_role(p_team), '') <> 'owner' then raise exception 'forbidden'; end if;
  update team_members set allowance_override = p_days where team_id = p_team and user_id = p_user;
  if not found then raise exception 'not_found'; end if;
end $$;

-- ---------- 연차 ----------
create function leave_used(p_team uuid, p_user uuid, p_year int, p_status text[])
  returns numeric language sql stable security definer set search_path = public, pg_temp
  as $$ select coalesce(sum(days), 0) from leave_requests
        where team_id = p_team and user_id = p_user and status = any(p_status)
          and extract(year from start_date)::int = p_year $$;

create function leave_balance(p_team uuid, p_user uuid, p_year int)
  returns table (allowance numeric, approved numeric, pending numeric, remaining numeric)
  language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_uid uuid := require_user(); v_al numeric; v_ap numeric; v_pe numeric;
begin
  if not is_member(p_team) then raise exception 'forbidden'; end if;
  if p_user <> v_uid and not is_approver(p_team) then raise exception 'forbidden'; end if;
  v_al := coalesce(allowance_of(p_team, p_user), 0);
  v_ap := leave_used(p_team, p_user, p_year, array['approved']);
  v_pe := leave_used(p_team, p_user, p_year, array['pending']);
  return query select v_al, v_ap, v_pe, v_al - v_ap - v_pe;
end $$;

create function request_leave(p_team uuid, p_kind text, p_start date, p_end date, p_reason text)
  returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := require_user(); v_days numeric; v_al numeric; v_used numeric; v_id uuid;
        v_name text; a record; v_end date := p_end;
begin
  if not is_member(p_team) then raise exception 'forbidden'; end if;
  if p_kind not in ('full','half_am','half_pm') then raise exception 'invalid_kind'; end if;
  if p_kind <> 'full' then v_end := p_start; end if;
  if p_start is null or v_end is null or v_end < p_start then raise exception 'invalid_dates'; end if;
  if p_start < kst_today() then raise exception 'past_date'; end if;
  if v_end - p_start > 60 then raise exception 'too_long'; end if;
  if extract(year from p_start) <> extract(year from v_end) then raise exception 'cross_year'; end if;
  if p_kind = 'full' then
    v_days := workdays(p_start, v_end);
    if v_days = 0 then raise exception 'no_workdays'; end if;
  else
    if extract(isodow from p_start) >= 6 then raise exception 'no_workdays'; end if;
    v_days := 0.5;
  end if;

  -- 본인 행을 잠가 동시 신청 시 잔여일을 정확히 지킨다
  perform 1 from team_members where team_id = p_team and user_id = v_uid for update;

  if exists (select 1 from leave_requests r
             where r.team_id = p_team and r.user_id = v_uid and r.status in ('pending','approved')
               and r.start_date <= v_end and r.end_date >= p_start
               and not (r.kind <> 'full' and p_kind <> 'full' and r.kind <> p_kind)) then
    raise exception 'overlap';
  end if;

  v_al := coalesce(allowance_of(p_team, v_uid), 0);
  v_used := leave_used(p_team, v_uid, extract(year from p_start)::int, array['pending','approved']);
  if v_used + v_days > v_al then raise exception 'insufficient_balance'; end if;

  insert into leave_requests (team_id, user_id, kind, start_date, end_date, days, reason)
    values (p_team, v_uid, p_kind, p_start, v_end, v_days, coalesce(trim(p_reason), ''))
    returning id into v_id;

  select name into v_name from users where id = v_uid;
  for a in select user_id from team_members where team_id = p_team and role in ('owner','staff') and user_id <> v_uid loop
    perform notify(a.user_id, p_team, 'leave_requested',
      v_name || '님이 연차를 신청했어요 (' || p_start || ', ' || v_days || '일)', 'req:' || v_id || ':' || a.user_id);
  end loop;
  return v_id;
end $$;

create function decide_leave(p_leave uuid, p_approve boolean, p_note text) returns void
  language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := require_user(); r leave_requests%rowtype;
begin
  select * into r from leave_requests where id = p_leave for update;
  if not found then raise exception 'not_found'; end if;
  if not is_approver(r.team_id) then raise exception 'forbidden'; end if;
  if r.user_id = v_uid and team_role(r.team_id) <> 'owner' then raise exception 'self_approval'; end if;
  if r.status <> 'pending' then raise exception 'already_decided'; end if;
  update leave_requests set status = case when p_approve then 'approved' else 'rejected' end,
    decided_by = v_uid, decided_at = now(), decision_note = coalesce(trim(p_note), '') where id = p_leave;
  perform notify(r.user_id, r.team_id, case when p_approve then 'leave_approved' else 'leave_rejected' end,
    case when p_approve then '연차가 승인됐어요: ' else '연차가 반려됐어요: ' end || r.start_date || ' (' || r.days || '일)',
    'decide:' || r.id);
end $$;

create function cancel_leave(p_leave uuid) returns void
  language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := require_user(); r leave_requests%rowtype;
begin
  select * into r from leave_requests where id = p_leave for update;
  if not found then raise exception 'not_found'; end if;
  if r.user_id <> v_uid then raise exception 'forbidden'; end if;
  if r.status = 'cancelled' then return; end if;                     -- 멱등
  if r.status = 'rejected' then raise exception 'already_decided'; end if;
  if r.status = 'approved' and r.start_date <= kst_today() then raise exception 'leave_started'; end if;
  update leave_requests set status = 'cancelled', decided_at = now() where id = p_leave;
end $$;

-- 팀 캘린더: 승인된 연차만, 사유 없이
create function team_calendar(p_team uuid, p_from date, p_to date)
  returns table (user_id uuid, name text, kind text, start_date date, end_date date, days numeric)
  language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform require_user();
  if not is_member(p_team) then raise exception 'forbidden'; end if;
  return query select r.user_id, u.name, r.kind, r.start_date, r.end_date, r.days
    from leave_requests r join users u on u.id = r.user_id
    where r.team_id = p_team and r.status = 'approved' and r.start_date <= p_to and r.end_date >= p_from
    order by r.start_date, u.name limit 500;
end $$;

-- ---------- 출석(일자별 상태) ----------
create function set_attendance(p_team uuid, p_status text) returns void
  language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := require_user(); v_today date := kst_today();
begin
  if not is_member(p_team) then raise exception 'forbidden'; end if;
  if p_status not in ('office','remote','field') then raise exception 'invalid_status'; end if;
  if extract(isodow from v_today) >= 6 then raise exception 'weekend'; end if;
  if exists (select 1 from leave_requests where team_id = p_team and user_id = v_uid and status = 'approved'
             and kind = 'full' and v_today between start_date and end_date) then
    raise exception 'on_leave';
  end if;
  insert into attendance (team_id, user_id, work_date, status, updated_by)
    values (p_team, v_uid, v_today, p_status, v_uid)
    on conflict (team_id, user_id, work_date) do update set status = excluded.status, updated_by = v_uid, updated_at = now();
end $$;

create function fix_attendance(p_team uuid, p_user uuid, p_date date, p_status text) returns void
  language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := require_user();
begin
  if not is_approver(p_team) then raise exception 'forbidden'; end if;
  if p_status not in ('office','remote','field') then raise exception 'invalid_status'; end if;
  if p_date > kst_today() then raise exception 'future_date'; end if;
  if not exists (select 1 from team_members where team_id = p_team and user_id = p_user) then
    raise exception 'not_found';
  end if;
  insert into attendance (team_id, user_id, work_date, status, updated_by)
    values (p_team, p_user, p_date, p_status, v_uid)
    on conflict (team_id, user_id, work_date) do update set status = excluded.status, updated_by = v_uid, updated_at = now();
end $$;

create function mark_notifications_read() returns void
  language sql security definer set search_path = public, pg_temp
  as $$ update notifications set read_at = now() where user_id = app_uid() and read_at is null $$;

-- ---------- 서비스 종료 시각 이후 쓰기 차단 (로컬은 먼 미래, 클라우드는 배포 시 갱신) ----------
create table service_state (
  id boolean primary key default true check (id),
  closes_at timestamptz not null
);
insert into service_state (id, closes_at) values (true, '2100-01-01T00:00:00Z');
alter table service_state enable row level security;

create function enforce_service_open() returns trigger language plpgsql
  security definer set search_path = public, pg_temp as $$
begin
  if now() >= (select closes_at from service_state where id) then
    raise exception 'service_closed';
  end if;
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array['users','sessions','teams','team_members','leave_requests','attendance','notifications'] loop
    execute format('create trigger %I before insert or update or delete or truncate on %I
                    for each statement execute function enforce_service_open()', t || '_closed', t);
  end loop;
end $$;

-- ---------- 권한 ----------
revoke all on all tables in schema public from public, teamnote_app;
revoke execute on all functions in schema public from public;
grant usage on schema public to teamnote_app;
grant select on users, teams, team_members, leave_requests, attendance, notifications to teamnote_app;
grant execute on function
  app_uid(), kst_today(), team_role(uuid), is_member(uuid), is_approver(uuid), shares_team(uuid),
  team_preview(text), auth_register(text,text,text), auth_get_login(text),
  auth_create_session(uuid,text,int), auth_session_user(text), auth_delete_session(text),
  create_team(text,numeric), update_team(uuid,text,numeric), join_team(text),
  set_member_role(uuid,uuid,text), set_member_allowance(uuid,uuid,numeric),
  leave_balance(uuid,uuid,int), request_leave(uuid,text,date,date,text),
  decide_leave(uuid,boolean,text), cancel_leave(uuid), team_calendar(uuid,date,date),
  set_attendance(uuid,text), fix_attendance(uuid,uuid,date,text), mark_notifications_read()
  to teamnote_app;
