-- Supabase 환경을 흉내 내는 최소 스텁 (로컬 Postgres 테스트 전용 — 실제 Supabase 에는 실행하지 않음)
create role anon nologin;
create role authenticated nologin;
create schema if not exists storage;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
create publication supabase_realtime;
grant usage on schema public to anon, authenticated;
-- Supabase 기본값: public 의 새 테이블/함수에 anon·authenticated 권한이 자동 부여됨
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant execute on functions to anon, authenticated;
