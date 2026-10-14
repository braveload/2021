-- Supabase 배포 대비: 자동 REST(PostgREST) 노출 역할(anon/authenticated)이
-- 테이블·함수에 접근하지 못하게 한다. 이 앱은 서버가 app_user로만 DB에 접속한다.
-- (역할이 없는 로컬 Postgres에서는 아무 일도 하지 않는다)
do $$
declare r text;
begin
  foreach r in array array['anon','authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on all tables in schema public from %I', r);
      execute format('revoke all on all functions in schema public from %I', r);
      execute format('revoke all on all sequences in schema public from %I', r);
      execute format('alter default privileges in schema public revoke all on tables from %I', r);
      execute format('alter default privileges in schema public revoke all on functions from %I', r);
      execute format('alter default privileges in schema public revoke all on sequences from %I', r);
    end if;
  end loop;
end $$;
