-- 서비스 종료 시각 이후 모든 쓰기를 DB가 차단한다(브라우저 타이머·앱 문구와 무관).
-- 로컬은 먼 미래값, 클라우드는 배포 시 closes_at 을 갱신한다.
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
  foreach t in array array['users','sessions','crews','crew_members','events','registrations',
                           'reactions','reviews','notifications','plan_changes'] loop
    execute format('create trigger %I before insert or update or delete or truncate on %I
                    for each statement execute function enforce_service_open()', t || '_closed', t);
  end loop;
end $$;
