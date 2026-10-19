-- Name entry must not create duplicates or authenticate an unrelated browser by name alone.
create function auth_start_named(p_name text) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := app_uid(); v_name text; v_current text;
begin
  if p_name is null or char_length(trim(p_name)) not between 1 and 30 then
    raise exception 'invalid_name';
  end if;
  v_name := lower(regexp_replace(trim(p_name),'[[:space:]]+','','g'));
  if v_name='' then raise exception 'invalid_name'; end if;
  if v_uid is not null then
    select lower(regexp_replace(trim(name),'[[:space:]]+','','g')) into v_current from users where id=v_uid;
    if v_current is distinct from v_name then raise exception 'account_name_mismatch'; end if;
    return v_uid;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_name,43573));
  if exists(select 1 from users where lower(regexp_replace(trim(name),'[[:space:]]+','','g'))=v_name) then
    raise exception 'account_exists';
  end if;
  insert into users(email,name,pw_hash)
    values('guest-'||gen_random_uuid()||'@guest.local',trim(p_name),'!') returning id into v_uid;
  return v_uid;
end $$;
revoke all on function auth_start_named(text) from public;
grant execute on function auth_start_named(text) to teamnote_app;

create table account_recovery_links (
  token_hash text primary key check(token_hash ~ '^[0-9a-f]{64}$'),
  user_id uuid not null references users(id),
  team_id uuid not null references teams(id),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
alter table account_recovery_links enable row level security;
revoke all on account_recovery_links from public,teamnote_app;
create trigger account_recovery_links_closed before insert or update or delete or truncate on account_recovery_links
  for each statement execute function enforce_service_open();

create function account_recovery_preview(p_hash text)
returns table(name text, team_name text, role text, used boolean)
language sql stable security definer set search_path = public, pg_temp as $$
  select u.name,t.name,m.role,r.used_at is not null
  from account_recovery_links r join users u on u.id=r.user_id
  join teams t on t.id=r.team_id
  join team_members m on m.user_id=r.user_id and m.team_id=r.team_id
  where r.token_hash=p_hash and r.expires_at>now()
$$;

create function redeem_account_recovery(p_hash text,p_session_hash text) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare r account_recovery_links%rowtype;
begin
  if p_session_hash is null or p_session_hash !~ '^[0-9a-f]{64}$' then raise exception 'invalid_recovery'; end if;
  select * into r from account_recovery_links where token_hash=p_hash for update;
  if not found then raise exception 'invalid_recovery'; end if;
  if r.used_at is not null then raise exception 'recovery_used'; end if;
  if r.expires_at<=now() or not exists(select 1 from team_members where user_id=r.user_id and team_id=r.team_id) then
    raise exception 'invalid_recovery';
  end if;
  perform auth_create_session(r.user_id,p_session_hash,24*180);
  update account_recovery_links set used_at=now() where token_hash=p_hash;
  return r.team_id;
end $$;
revoke all on function account_recovery_preview(text),redeem_account_recovery(text,text) from public;
grant execute on function account_recovery_preview(text),redeem_account_recovery(text,text) to teamnote_app;
