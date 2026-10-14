-- =====================================================================
-- 우리 팀 롤링페이퍼 · Supabase 스키마 (무료 플랜 / anon 키만 사용)
-- 모든 객체에 rp_ 접두사를 붙여 같은 프로젝트의 다른 실습(점심 룰렛 등)과 충돌하지 않습니다.
-- 여러 번 실행해도 안전합니다(idempotent).
-- =====================================================================

-- ---------- 테이블 ----------
create table if not exists rp_boards (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique check (code ~ '^[a-z0-9]{4,12}$'),
  title      text not null check (char_length(title) between 1 and 40),
  theme      text not null default 'birthday'
             check (theme in ('birthday','farewell','graduation','feedback','cheer')),
  deadline   timestamptz,                       -- null = 마감 없음
  secret     boolean not null default false,    -- true = 마감 전에는 남의 글 비공개
  created_at timestamptz not null default now()
);

-- 관리자 토큰의 해시는 별도 테이블 (anon 에게는 어떤 권한도 주지 않음)
create table if not exists rp_board_secrets (
  board_id   uuid primary key references rp_boards(id) on delete cascade,
  admin_hash text not null
);

create table if not exists rp_notes (
  id          bigint generated always as identity primary key,
  board_id    uuid not null references rp_boards(id) on delete cascade,
  author      text not null default '익명' check (char_length(author) between 1 and 12),
  message     text not null check (char_length(message) between 1 and 100),
  color       text not null default 'yellow' check (color in ('yellow','pink','mint','blue')),
  sticker     text check (sticker is null or char_length(sticker) <= 8),
  photo_path  text check (photo_path is null or char_length(photo_path) <= 200),
  client_hash text not null,
  hearts      int  not null default 0 check (hearts >= 0),
  created_at  timestamptz not null default now()
);
create index if not exists rp_notes_board_idx on rp_notes (board_id, created_at desc);

create table if not exists rp_hearts (
  note_id     bigint not null references rp_notes(id) on delete cascade,
  client_hash text   not null,
  primary key (note_id, client_hash)
);

-- ---------- 권한: 테이블은 읽기만, 쓰기는 전부 RPC ----------
alter table rp_boards        enable row level security;
alter table rp_board_secrets enable row level security;
alter table rp_notes         enable row level security;
alter table rp_hearts        enable row level security;

revoke all on rp_boards, rp_board_secrets, rp_notes, rp_hearts from anon, authenticated;
grant select on rp_boards, rp_notes to anon, authenticated;

drop policy if exists rp_boards_read on rp_boards;
create policy rp_boards_read on rp_boards for select to anon, authenticated using (true);

-- 비밀 모드: 마감 시각이 지나기 전에는 글 자체를 서버가 내려주지 않음
drop policy if exists rp_notes_read on rp_notes;
create policy rp_notes_read on rp_notes for select to anon, authenticated using (
  exists (
    select 1 from rp_boards b
    where b.id = rp_notes.board_id
      and (not b.secret or (b.deadline is not null and now() >= b.deadline))
  )
);

-- ---------- 헬퍼 ----------
create or replace function rp_now() returns timestamptz
language sql stable as $$ select now() $$;

create or replace function rp_hash(p text) returns text
language sql immutable as $$ select encode(sha256(convert_to(p, 'utf8')), 'hex') $$;

-- 관리자 토큰 검증 → 보드 id (실패하면 FORBIDDEN)
create or replace function rp_admin_board(p_code text, p_token text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  select b.id into v_id
    from rp_boards b join rp_board_secrets s on s.board_id = b.id
   where b.code = lower(p_code) and s.admin_hash = rp_hash(coalesce(p_token, ''));
  if v_id is null then raise exception 'FORBIDDEN'; end if;
  return v_id;
end $$;
revoke all on function rp_admin_board(text, text) from public, anon, authenticated;

-- ---------- 보드 만들기 ----------
create or replace function rp_create_board(
  p_code text, p_title text, p_theme text, p_deadline timestamptz, p_secret boolean, p_token text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if (select count(*) from rp_boards) >= 300 then raise exception 'FULL'; end if;  -- 무료 한도 보호
  if char_length(coalesce(p_token, '')) < 16 then raise exception 'BAD_TOKEN'; end if;
  insert into rp_boards (code, title, theme, deadline, secret)
  values (lower(p_code), btrim(p_title), p_theme, p_deadline, coalesce(p_secret, false))
  returning id into v_id;
  insert into rp_board_secrets (board_id, admin_hash) values (v_id, rp_hash(p_token));
  return v_id;
end $$;

-- ---------- 글 붙이기 (마감·도배·한도 검사를 서버에서) ----------
create or replace function rp_post_note(
  p_board uuid, p_author text, p_message text, p_color text,
  p_sticker text, p_photo text, p_client text
) returns table (id bigint, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  b rp_boards;
  v_hash text := rp_hash(coalesce(p_client, ''));
begin
  select * into b from rp_boards where rp_boards.id = p_board;
  if not found then raise exception 'NOT_FOUND'; end if;
  if b.deadline is not null and now() >= b.deadline then raise exception 'CLOSED'; end if;
  if char_length(coalesce(p_client, '')) < 8 then raise exception 'BAD_CLIENT'; end if;

  if exists (select 1 from rp_notes n
              where n.board_id = b.id and n.client_hash = v_hash
                and n.created_at > now() - interval '3 seconds') then
    raise exception 'COOLDOWN';
  end if;
  if (select count(*) from rp_notes n where n.board_id = b.id) >= 300 then raise exception 'FULL'; end if;
  if p_photo is not null then
    if p_photo not like b.code || '/%' then raise exception 'BAD_PHOTO'; end if;
    if (select count(*) from rp_notes n where n.board_id = b.id and n.photo_path is not null) >= 60 then
      raise exception 'PHOTO_FULL';
    end if;
  end if;

  return query
    insert into rp_notes (board_id, author, message, color, sticker, photo_path, client_hash)
    values (b.id,
            coalesce(nullif(btrim(p_author), ''), '익명'),
            btrim(p_message),
            coalesce(p_color, 'yellow'),
            nullif(p_sticker, ''),
            p_photo,
            v_hash)
    returning rp_notes.id, rp_notes.created_at;
end $$;

-- ---------- 하트 토글 (사람당 1개) ----------
create or replace function rp_toggle_heart(p_note bigint, p_client text)
returns table (hearts int, liked boolean)
language plpgsql security definer set search_path = public as $$
declare
  v_hash text := rp_hash(coalesce(p_client, ''));
  v_count int;
begin
  if char_length(coalesce(p_client, '')) < 8 then raise exception 'BAD_CLIENT'; end if;
  perform 1 from rp_notes n join rp_boards b on b.id = n.board_id
   where n.id = p_note and (not b.secret or (b.deadline is not null and now() >= b.deadline));
  if not found then raise exception 'NOT_FOUND'; end if;

  delete from rp_hearts h where h.note_id = p_note and h.client_hash = v_hash;
  if found then
    update rp_notes n set hearts = greatest(n.hearts - 1, 0) where n.id = p_note returning n.hearts into v_count;
    return query select v_count, false;
  else
    insert into rp_hearts (note_id, client_hash) values (p_note, v_hash);
    update rp_notes n set hearts = n.hearts + 1 where n.id = p_note returning n.hearts into v_count;
    return query select v_count, true;
  end if;
end $$;

create or replace function rp_my_hearts(p_board uuid, p_client text) returns setof bigint
language sql stable security definer set search_path = public as $$
  select h.note_id from rp_hearts h join rp_notes n on n.id = h.note_id
   where n.board_id = p_board and h.client_hash = rp_hash(coalesce(p_client, ''))
$$;

-- ---------- 관리자 기능 (토큰 필요) ----------
create or replace function rp_admin_check(p_code text, p_token text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  perform rp_admin_board(p_code, p_token);
  return true;
exception when others then
  return false;
end $$;

create or replace function rp_admin_delete_note(p_code text, p_token text, p_note bigint) returns void
language plpgsql security definer set search_path = public as $$
declare v_board uuid := rp_admin_board(p_code, p_token);
begin
  delete from rp_notes n where n.id = p_note and n.board_id = v_board;
end $$;

create or replace function rp_admin_update_board(
  p_code text, p_token text, p_title text, p_deadline timestamptz, p_clear_deadline boolean, p_secret boolean
) returns void
language plpgsql security definer set search_path = public as $$
declare v_board uuid := rp_admin_board(p_code, p_token);
begin
  update rp_boards b set
    title    = coalesce(nullif(btrim(p_title), ''), b.title),
    deadline = case when p_clear_deadline then null else coalesce(p_deadline, b.deadline) end,
    secret   = coalesce(p_secret, b.secret)
  where b.id = v_board;
end $$;

grant execute on function
  rp_now(), rp_create_board(text, text, text, timestamptz, boolean, text),
  rp_post_note(uuid, text, text, text, text, text, text),
  rp_toggle_heart(bigint, text), rp_my_hearts(uuid, text),
  rp_admin_check(text, text), rp_admin_delete_note(text, text, bigint),
  rp_admin_update_board(text, text, text, timestamptz, boolean, boolean)
  to anon, authenticated;

-- ---------- 실시간 켜기 ----------
do $$ begin
  alter publication supabase_realtime add table rp_notes;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table rp_boards;   -- 마감/제목 변경을 모든 화면에 즉시 반영
exception when duplicate_object then null;
end $$;

-- ---------- 사진 저장소 (Storage) : 공개 읽기 / 업로드만 허용 / 512KB 제한 ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('rp-photos', 'rp-photos', true, 524288, array['image/jpeg', 'image/webp', 'image/png'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists rp_photos_upload on storage.objects;
create policy rp_photos_upload on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'rp-photos');
