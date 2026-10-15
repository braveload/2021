set local search_path = teamnote, pg_temp;
-- Multiple administrators, with single-use invitations bound to an explicit account.
drop index one_owner_per_team;
create index team_admins on team_members(team_id) where role = 'owner';

create or replace function set_member_role(p_team uuid, p_user uuid, p_role text) returns void
language plpgsql security definer set search_path = teamnote, pg_temp as $$
declare v_cur text;
begin
  perform require_user();
  perform 1 from teams where id = p_team for update;
  if coalesce(team_role(p_team), '') <> 'owner' then raise exception 'forbidden'; end if;
  if p_role not in ('owner','staff','member') then raise exception 'invalid_role'; end if;
  select role into v_cur from team_members where team_id=p_team and user_id=p_user;
  if v_cur is null then raise exception 'not_found'; end if;
  if v_cur='owner' and p_role<>'owner' and
    (select count(*) from team_members where team_id=p_team and role='owner') <= 1 then
    raise exception 'last_admin';
  end if;
  update team_members set role=p_role where team_id=p_team and user_id=p_user;
end $$;

create table admin_invites (
  token_hash text primary key check (token_hash ~ '^[0-9a-f]{64}$'),
  team_id uuid not null references teams(id) on delete cascade,
  intended_name text not null check (char_length(intended_name) between 1 and 30),
  expires_at timestamptz not null,
  claimed_by uuid references users(id),
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  check ((claimed_by is null) = (claimed_at is null))
);
alter table admin_invites enable row level security;
revoke all on admin_invites from public, teamnote_app;
create trigger admin_invites_closed before insert or update or delete or truncate on admin_invites
  for each statement execute function enforce_service_open();

create function admin_invite_preview(p_hash text)
returns table(team_name text, intended_name text, expires_at timestamptz, claimed boolean)
language sql stable security definer set search_path = teamnote, pg_temp as $$
  select t.name, i.intended_name, i.expires_at, i.claimed_by is not null
  from admin_invites i join teams t on t.id=i.team_id
  where i.token_hash=p_hash and i.expires_at>now()
$$;

create function claim_admin_invite(p_hash text) returns uuid
language plpgsql security definer set search_path = teamnote, pg_temp as $$
declare v_uid uuid := require_user(); i admin_invites%rowtype; v_name text;
begin
  select * into i from admin_invites where token_hash=p_hash for update;
  if not found then raise exception 'invalid_admin_invite'; end if;
  if i.claimed_by is not null then
    if i.claimed_by=v_uid then return i.team_id; end if;
    raise exception 'admin_invite_used';
  end if;
  if i.expires_at<=now() then raise exception 'invalid_admin_invite'; end if;
  select name into v_name from users where id=v_uid;
  if v_name is distinct from i.intended_name then raise exception 'admin_name_mismatch'; end if;
  perform 1 from teams where id=i.team_id for update;
  insert into team_members(team_id,user_id,role) values(i.team_id,v_uid,'owner')
    on conflict(team_id,user_id) do update set role='owner';
  update admin_invites set claimed_by=v_uid,claimed_at=now() where token_hash=p_hash;
  return i.team_id;
end $$;
revoke all on function admin_invite_preview(text), claim_admin_invite(text) from public;
grant execute on function admin_invite_preview(text), claim_admin_invite(text) to teamnote_app;
