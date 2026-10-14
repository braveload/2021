-- CrewNote 전용 스키마 설치 (기존 public 스키마의 다른 서비스 테이블은 건드리지 않음)
create schema if not exists crewnote;
set search_path = crewnote;
revoke all on schema crewnote from public;
revoke all on schema crewnote from anon, authenticated;
-- ===== db/migrations/001_init.sql =====
-- CrewNote 초기 스키마: 테이블 + RLS + RPC (모든 쓰기는 RPC 경유)

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'app_user') then
    create role app_user login;
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

create table crews (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 40),
  intro text not null default '' check (char_length(intro) <= 500),
  theme text not null default 'running' check (theme in ('running','reading','study')),
  plan text not null default 'free' check (plan in ('free','pro')),
  invite_code text not null unique default encode(extensions.gen_random_bytes(6), 'hex'),
  created_by uuid not null references users(id),
  created_at timestamptz not null default now()
);

create table crew_members (
  crew_id uuid not null references crews(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role text not null check (role in ('owner','staff','member')),
  joined_at timestamptz not null default now(),
  primary key (crew_id, user_id)
);
create index on crew_members (user_id);
create unique index one_owner_per_crew on crew_members (crew_id) where role = 'owner';

create table events (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references crews(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 60),
  description text not null default '' check (char_length(description) <= 1000),
  location text not null default '' check (char_length(location) <= 100),
  starts_at timestamptz not null,
  capacity int not null check (capacity between 1 and 500),
  created_by uuid not null references users(id),
  created_at timestamptz not null default now()
);
create index on events (crew_id, starts_at desc);

create sequence registration_seq;
create table registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  status text not null check (status in ('attending','waitlist','cancelled')),
  seq bigint not null default nextval('registration_seq'),
  checked_in boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, user_id)
);
create index on registrations (event_id, status, seq);
create index on registrations (user_id);

create table reactions (
  event_id uuid not null references events(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  emoji text not null check (emoji in ('🔥','👏','😆','💪','❤️')),
  primary key (event_id, user_id, emoji)
);

create table reviews (
  event_id uuid not null references events(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 100),
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  crew_id uuid references crews(id) on delete cascade,
  event_id uuid references events(id) on delete cascade,
  kind text not null,
  body text not null,
  dedupe_key text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);
create index on notifications (user_id, created_at desc);

create table plan_changes (
  id bigserial primary key,
  crew_id uuid not null references crews(id) on delete cascade,
  plan text not null,
  changed_by uuid not null references users(id),
  changed_at timestamptz not null default now()
);

-- ---------- 헬퍼 (RLS 정책에서 사용, 재귀 방지를 위해 security definer) ----------
create function app_uid() returns uuid language sql stable
  as $$ select nullif(current_setting('app.user_id', true), '')::uuid $$;

create function is_member(p_crew uuid) returns boolean language sql stable
  security definer set search_path = crewnote, pg_temp
  as $$ select exists (select 1 from crew_members where crew_id = p_crew and user_id = app_uid()) $$;

create function crew_role(p_crew uuid) returns text language sql stable
  security definer set search_path = crewnote, pg_temp
  as $$ select role from crew_members where crew_id = p_crew and user_id = app_uid() $$;

create function shares_crew(p_user uuid) returns boolean language sql stable
  security definer set search_path = crewnote, pg_temp
  as $$ select exists (select 1 from crew_members a join crew_members b on a.crew_id = b.crew_id
                       where a.user_id = app_uid() and b.user_id = p_user) $$;

create function event_crew(p_event uuid) returns uuid language sql stable
  security definer set search_path = crewnote, pg_temp
  as $$ select crew_id from events where id = p_event $$;

-- ---------- RLS ----------
alter table users enable row level security;
alter table sessions enable row level security;
alter table crews enable row level security;
alter table crew_members enable row level security;
alter table events enable row level security;
alter table registrations enable row level security;
alter table reactions enable row level security;
alter table reviews enable row level security;
alter table notifications enable row level security;
alter table plan_changes enable row level security;

create policy users_select on users for select using (id = app_uid() or shares_crew(id));
create policy crews_select on crews for select using (is_member(id));
create policy members_select on crew_members for select using (is_member(crew_id));
create policy events_select on events for select using (is_member(crew_id));
create policy regs_select on registrations for select using (is_member(event_crew(event_id)));
create policy reactions_select on reactions for select using (is_member(event_crew(event_id)));
create policy reviews_select on reviews for select using (is_member(event_crew(event_id)));
create policy notif_select on notifications for select using (user_id = app_uid());
create policy plan_changes_select on plan_changes for select using (is_member(crew_id));

-- 정원(멤버 수) 제한: 모든 경로의 INSERT에 DB가 직접 적용
create function enforce_member_limit() returns trigger language plpgsql
  security definer set search_path = crewnote, pg_temp as $$
declare v_plan text; v_cnt int;
begin
  select plan into v_plan from crews where id = new.crew_id for update;
  select count(*) into v_cnt from crew_members where crew_id = new.crew_id;
  if v_plan = 'free' and v_cnt >= 30 then raise exception 'member_limit'; end if;
  return new;
end $$;
create trigger crew_members_limit before insert on crew_members
  for each row execute function enforce_member_limit();

-- ---------- 인증 ----------
create function auth_register(p_email text, p_name text, p_hash text) returns uuid
  language plpgsql security definer set search_path = crewnote, pg_temp as $$
declare v_id uuid;
begin
  insert into users (email, name, pw_hash) values (lower(trim(p_email)), trim(p_name), p_hash)
    returning id into v_id;
  return v_id;
exception when unique_violation then raise exception 'email_taken';
end $$;

create function auth_get_login(p_email text) returns table (id uuid, pw_hash text)
  language sql security definer set search_path = crewnote, pg_temp
  as $$ select u.id, u.pw_hash from users u where u.email = lower(trim(p_email)) $$;

create function auth_create_session(p_user uuid, p_token_hash text, p_hours int) returns void
  language sql security definer set search_path = crewnote, pg_temp
  as $$ delete from sessions where expires_at < now();
        insert into sessions (token_hash, user_id, expires_at)
        values (p_token_hash, p_user, now() + make_interval(hours => p_hours)) $$;

create function auth_session_user(p_token_hash text) returns table (id uuid, name text, email text)
  language sql security definer set search_path = crewnote, pg_temp
  as $$ select u.id, u.name, u.email from sessions s join users u on u.id = s.user_id
        where s.token_hash = p_token_hash and s.expires_at > now() $$;

create function auth_delete_session(p_token_hash text) returns void
  language sql security definer set search_path = crewnote, pg_temp
  as $$ delete from sessions where token_hash = p_token_hash $$;

-- ---------- 내부 유틸 ----------
create function require_user() returns uuid language plpgsql stable
  security definer set search_path = crewnote, pg_temp as $$
begin
  if app_uid() is null then raise exception 'not_authenticated'; end if;
  return app_uid();
end $$;

create function notify(p_user uuid, p_crew uuid, p_event uuid, p_kind text, p_body text, p_key text)
  returns void language sql security definer set search_path = crewnote, pg_temp
  as $$ insert into notifications (user_id, crew_id, event_id, kind, body, dedupe_key)
        values (p_user, p_crew, p_event, p_kind, p_body, p_key)
        on conflict (user_id, dedupe_key) do nothing $$;

-- 대기 1번부터 빈자리만큼 승급 (event 행은 호출자가 FOR UPDATE로 잠근 상태)
create function promote_waitlist(p_event uuid) returns int
  language plpgsql security definer set search_path = crewnote, pg_temp as $$
declare v_cap int; v_att int; v_crew uuid; v_title text; r record; v_n int := 0;
begin
  select capacity, crew_id, title into v_cap, v_crew, v_title from events where id = p_event;
  loop
    select count(*) into v_att from registrations where event_id = p_event and status = 'attending';
    exit when v_att >= v_cap;
    select * into r from registrations
      where event_id = p_event and status = 'waitlist' order by seq limit 1 for update;
    exit when not found;
    update registrations set status = 'attending', updated_at = now() where id = r.id;
    perform notify(r.user_id, v_crew, p_event, 'promoted',
      '대기에서 참석으로 승급됐어요: ' || v_title, 'promote:' || r.id || ':' || r.seq);
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

-- ---------- 크루 ----------
create function crew_preview(p_code text)
  returns table (id uuid, name text, intro text, theme text, plan text, member_count int)
  language sql stable security definer set search_path = crewnote, pg_temp
  as $$ select c.id, c.name, c.intro, c.theme, c.plan,
               (select count(*)::int from crew_members m where m.crew_id = c.id)
        from crews c where c.invite_code = p_code $$;

create function create_crew(p_name text, p_intro text, p_theme text) returns uuid
  language plpgsql security definer set search_path = crewnote, pg_temp as $$
declare v_uid uuid := require_user(); v_id uuid;
begin
  insert into crews (name, intro, theme, created_by) values (trim(p_name), coalesce(p_intro,''), p_theme, v_uid)
    returning id into v_id;
  insert into crew_members (crew_id, user_id, role) values (v_id, v_uid, 'owner');
  return v_id;
end $$;

create function update_crew(p_crew uuid, p_name text, p_intro text, p_theme text) returns void
  language plpgsql security definer set search_path = crewnote, pg_temp as $$
begin
  perform require_user();
  if crew_role(p_crew) not in ('owner','staff') then raise exception 'forbidden'; end if;
  update crews set name = trim(p_name), intro = coalesce(p_intro,''), theme = p_theme where id = p_crew;
end $$;

create function join_crew(p_code text) returns uuid
  language plpgsql security definer set search_path = crewnote, pg_temp as $$
declare v_uid uuid := require_user(); v_crew uuid;
begin
  select id into v_crew from crews where invite_code = p_code;
  if v_crew is null then raise exception 'invalid_invite'; end if;
  if exists (select 1 from crew_members where crew_id = v_crew and user_id = v_uid) then
    return v_crew;
  end if;
  insert into crew_members (crew_id, user_id, role) values (v_crew, v_uid, 'member');
  return v_crew;
end $$;

create function set_member_role(p_crew uuid, p_user uuid, p_role text) returns void
  language plpgsql security definer set search_path = crewnote, pg_temp as $$
declare v_plan text; v_staff int; v_cur text;
begin
  perform require_user();
  if crew_role(p_crew) <> 'owner' then raise exception 'forbidden'; end if;
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

-- 모의 구독 (실제 결제 없음)
create function set_plan(p_crew uuid, p_plan text) returns void
  language plpgsql security definer set search_path = crewnote, pg_temp as $$
declare v_uid uuid := require_user(); v_m int; v_s int;
begin
  if crew_role(p_crew) <> 'owner' then raise exception 'forbidden'; end if;
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

-- ---------- 모임 ----------
create function create_event(p_crew uuid, p_title text, p_desc text, p_loc text, p_starts timestamptz, p_cap int)
  returns uuid language plpgsql security definer set search_path = crewnote, pg_temp as $$
declare v_uid uuid := require_user(); v_id uuid; m record;
begin
  if crew_role(p_crew) not in ('owner','staff') then raise exception 'forbidden'; end if;
  if p_starts <= now() then raise exception 'past_time'; end if;
  insert into events (crew_id, title, description, location, starts_at, capacity, created_by)
    values (p_crew, trim(p_title), coalesce(p_desc,''), coalesce(p_loc,''), p_starts, p_cap, v_uid)
    returning id into v_id;
  for m in select user_id from crew_members where crew_id = p_crew and user_id <> v_uid loop
    perform notify(m.user_id, p_crew, v_id, 'new_event', '새 모임이 열렸어요: ' || trim(p_title), 'event:' || v_id);
  end loop;
  return v_id;
end $$;

create function update_event(p_event uuid, p_title text, p_desc text, p_loc text, p_starts timestamptz, p_cap int)
  returns void language plpgsql security definer set search_path = crewnote, pg_temp as $$
declare e events%rowtype; v_att int;
begin
  perform require_user();
  select * into e from events where id = p_event for update;
  if not found then raise exception 'not_found'; end if;
  if crew_role(e.crew_id) not in ('owner','staff') then raise exception 'forbidden'; end if;
  if e.starts_at <= now() then raise exception 'event_started'; end if;
  if p_starts <= now() then raise exception 'past_time'; end if;
  select count(*) into v_att from registrations where event_id = p_event and status = 'attending';
  if p_cap < v_att then raise exception 'capacity_below_attending'; end if;
  update events set title = trim(p_title), description = coalesce(p_desc,''), location = coalesce(p_loc,''),
    starts_at = p_starts, capacity = p_cap where id = p_event;
  perform promote_waitlist(p_event);
end $$;

create function register_event(p_event uuid) returns text
  language plpgsql security definer set search_path = crewnote, pg_temp as $$
declare v_uid uuid := require_user(); e events%rowtype; r registrations%rowtype; v_att int; v_status text;
begin
  select * into e from events where id = p_event for update;   -- 동시 신청 직렬화
  if not found or not is_member(e.crew_id) then raise exception 'forbidden'; end if;
  if e.starts_at <= now() then raise exception 'event_started'; end if;
  select * into r from registrations where event_id = p_event and user_id = v_uid;
  if found and r.status in ('attending','waitlist') then return r.status; end if;  -- 중복 클릭 멱등
  select count(*) into v_att from registrations where event_id = p_event and status = 'attending';
  v_status := case when v_att < e.capacity then 'attending' else 'waitlist' end;
  if found then
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

create function cancel_registration(p_event uuid) returns void
  language plpgsql security definer set search_path = crewnote, pg_temp as $$
declare v_uid uuid := require_user(); e events%rowtype; r registrations%rowtype;
begin
  select * into e from events where id = p_event for update;
  if not found then raise exception 'not_found'; end if;
  if e.starts_at <= now() then raise exception 'event_started'; end if;
  select * into r from registrations where event_id = p_event and user_id = v_uid;
  if not found or r.status = 'cancelled' then return; end if;      -- 멱등
  update registrations set status = 'cancelled', updated_at = now() where id = r.id;
  if r.status = 'attending' then perform promote_waitlist(p_event); end if;
end $$;

create function check_in(p_event uuid, p_user uuid, p_flag boolean) returns void
  language plpgsql security definer set search_path = crewnote, pg_temp as $$
declare e events%rowtype;
begin
  perform require_user();
  select * into e from events where id = p_event;
  if not found then raise exception 'not_found'; end if;
  if crew_role(e.crew_id) not in ('owner','staff') then raise exception 'forbidden'; end if;
  if now() < e.starts_at - interval '2 hours' then raise exception 'too_early'; end if;
  update registrations set checked_in = p_flag, updated_at = now()
    where event_id = p_event and user_id = p_user and status = 'attending';
  if not found then raise exception 'not_attending'; end if;
end $$;

create function toggle_reaction(p_event uuid, p_emoji text) returns void
  language plpgsql security definer set search_path = crewnote, pg_temp as $$
declare v_uid uuid := require_user();
begin
  if not is_member(event_crew(p_event)) then raise exception 'forbidden'; end if;
  if exists (select 1 from reactions where event_id = p_event and user_id = v_uid and emoji = p_emoji) then
    delete from reactions where event_id = p_event and user_id = v_uid and emoji = p_emoji;
  else
    insert into reactions (event_id, user_id, emoji) values (p_event, v_uid, p_emoji);
  end if;
end $$;

create function post_review(p_event uuid, p_body text) returns void
  language plpgsql security definer set search_path = crewnote, pg_temp as $$
declare v_uid uuid := require_user(); e events%rowtype;
begin
  select * into e from events where id = p_event;
  if not found then raise exception 'not_found'; end if;
  if e.starts_at > now() then raise exception 'not_started'; end if;
  if not exists (select 1 from registrations where event_id = p_event and user_id = v_uid
                 and status = 'attending' and checked_in) then raise exception 'not_attended'; end if;
  insert into reviews (event_id, user_id, body) values (p_event, v_uid, trim(p_body))
    on conflict (event_id, user_id) do update set body = excluded.body;
end $$;

-- 무료 대안 리마인더: 크론 없이, 접속 시 24시간 이내 모임을 알림함에 1회만 생성
create function generate_reminders() returns int
  language plpgsql security definer set search_path = crewnote, pg_temp as $$
declare v_uid uuid := require_user(); r record; v_n int := 0;
begin
  for r in select e.id, e.crew_id, e.title from registrations g join events e on e.id = g.event_id
           where g.user_id = v_uid and g.status = 'attending'
             and e.starts_at > now() and e.starts_at <= now() + interval '24 hours' loop
    perform notify(v_uid, r.crew_id, r.id, 'reminder', '24시간 안에 모임이 있어요: ' || r.title, 'remind:' || r.id);
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

create function mark_notifications_read() returns void
  language sql security definer set search_path = crewnote, pg_temp
  as $$ update notifications set read_at = now() where user_id = app_uid() and read_at is null $$;

-- ---------- 권한 ----------
revoke all on all tables in schema crewnote from public, app_user;
revoke execute on all functions in schema crewnote from public;
grant usage on schema crewnote to app_user;
grant select on users, crews, crew_members, events, registrations, reactions, reviews,
  notifications, plan_changes to app_user;
grant execute on function
  app_uid(), is_member(uuid), crew_role(uuid), crew_preview(text),
  auth_register(text,text,text), auth_get_login(text), auth_create_session(uuid,text,int),
  auth_session_user(text), auth_delete_session(text),
  create_crew(text,text,text), update_crew(uuid,text,text,text), join_crew(text),
  set_member_role(uuid,uuid,text), set_plan(uuid,text),
  create_event(uuid,text,text,text,timestamptz,int), update_event(uuid,text,text,text,timestamptz,int),
  register_event(uuid), cancel_registration(uuid), check_in(uuid,uuid,boolean),
  toggle_reaction(uuid,text), post_review(uuid,text), generate_reminders(), mark_notifications_read()
  to app_user;
-- RLS 정책이 호출하는 헬퍼도 app_user가 평가할 수 있어야 함
grant execute on function shares_crew(uuid), event_crew(uuid) to app_user;
-- ===== db/migrations/002_fix_null_role_and_found.sql =====
-- 수정 1: 비멤버(crew_role = NULL)가 `not in (...)` 검사를 통과하던 문제
-- 수정 2: register_event에서 count(*) 이후 FOUND가 항상 true라 신규 신청이 깨지던 문제

create or replace function update_crew(p_crew uuid, p_name text, p_intro text, p_theme text) returns void
  language plpgsql security definer set search_path = crewnote, pg_temp as $$
begin
  perform require_user();
  if coalesce(crew_role(p_crew), '') not in ('owner','staff') then raise exception 'forbidden'; end if;
  update crews set name = trim(p_name), intro = coalesce(p_intro,''), theme = p_theme where id = p_crew;
end $$;

create or replace function set_member_role(p_crew uuid, p_user uuid, p_role text) returns void
  language plpgsql security definer set search_path = crewnote, pg_temp as $$
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
  language plpgsql security definer set search_path = crewnote, pg_temp as $$
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
  returns uuid language plpgsql security definer set search_path = crewnote, pg_temp as $$
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
  returns void language plpgsql security definer set search_path = crewnote, pg_temp as $$
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
  language plpgsql security definer set search_path = crewnote, pg_temp as $$
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
  language plpgsql security definer set search_path = crewnote, pg_temp as $$
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
-- ===== db/migrations/003_lock_supabase_api_roles.sql =====
-- Supabase 배포 대비: 자동 REST(PostgREST) 노출 역할(anon/authenticated)이
-- 테이블·함수에 접근하지 못하게 한다. 이 앱은 서버가 app_user로만 DB에 접속한다.
-- (역할이 없는 로컬 Postgres에서는 아무 일도 하지 않는다)
do $$
declare r text;
begin
  foreach r in array array['anon','authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on all tables in schema crewnote from %I', r);
      execute format('revoke all on all functions in schema crewnote from %I', r);
      execute format('revoke all on all sequences in schema crewnote from %I', r);
      execute format('alter default privileges in schema crewnote revoke all on tables from %I', r);
      execute format('alter default privileges in schema crewnote revoke all on functions from %I', r);
      execute format('alter default privileges in schema crewnote revoke all on sequences from %I', r);
    end if;
  end loop;
end $$;
alter role app_user set search_path = crewnote;
