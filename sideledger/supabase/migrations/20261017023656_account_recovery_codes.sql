create table public.sl_recovery_codes (
 owner_id uuid primary key references public.sl_profiles(owner_id) on delete cascade,
 code_hash text not null unique check(code_hash ~ '^[a-f0-9]{64}$'),
 email text not null, created_at timestamptz not null default now(),
 used_at timestamptz, claim_id uuid
);
create table public.sl_account_security (
 owner_id uuid primary key references public.sl_profiles(owner_id) on delete cascade,
 reset_at timestamptz not null
);
alter table public.sl_recovery_codes enable row level security;
alter table public.sl_account_security enable row level security;
revoke all on public.sl_recovery_codes,public.sl_account_security from public,anon,authenticated;
grant all on public.sl_recovery_codes,public.sl_account_security to service_role;
grant select on public.sl_account_security to authenticated;
create policy sl_security_read on public.sl_account_security for select to authenticated using(owner_id=(select auth.uid()));
create function public.sl_recovery_claim(p_hash text,p_claim uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.sl_recovery_codes;begin
 update public.sl_recovery_codes set used_at=clock_timestamp(),claim_id=p_claim where code_hash=p_hash and used_at is null returning * into r;
 if r.owner_id is null then return null;end if;
 return jsonb_build_object('id',r.owner_id,'email',r.email);
end $$;
create function public.sl_recovery_finish(p_owner uuid,p_claim uuid,p_success boolean) returns boolean language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from public.sl_recovery_codes where owner_id=p_owner and claim_id=p_claim) then return false;end if;
 if p_success then
  insert into public.sl_account_security(owner_id,reset_at) values(p_owner,clock_timestamp()) on conflict(owner_id) do update set reset_at=excluded.reset_at;
 else
  update public.sl_recovery_codes set used_at=null,claim_id=null where owner_id=p_owner and claim_id=p_claim;
 end if;
 return true;
end $$;
revoke all on function public.sl_recovery_claim(text,uuid),public.sl_recovery_finish(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.sl_recovery_claim(text,uuid),public.sl_recovery_finish(uuid,uuid,boolean) to service_role;
create function public.sl_session_allowed() returns boolean language sql stable security invoker set search_path='' as $$
 select not exists(select 1 from public.sl_account_security s where s.owner_id=coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid
 and coalesce((nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'iat')::bigint,0)<=floor(extract(epoch from s.reset_at)));
$$;
revoke all on function public.sl_session_allowed() from public,anon;
grant execute on function public.sl_session_allowed() to authenticated;
create or replace function public.sl_uid() returns uuid language sql stable security invoker set search_path='' as $$
 select case when public.sl_session_allowed() then coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid else null end;
$$;
create policy sl_profiles_session on public.sl_profiles as restrictive for all to authenticated using((select public.sl_session_allowed())) with check((select public.sl_session_allowed()));
create policy sl_clients_session on public.sl_clients as restrictive for all to authenticated using((select public.sl_session_allowed())) with check((select public.sl_session_allowed()));
create policy sl_entries_session on public.sl_entries as restrictive for all to authenticated using((select public.sl_session_allowed())) with check((select public.sl_session_allowed()));
create policy sl_documents_session on public.sl_documents as restrictive for all to authenticated using((select public.sl_session_allowed())) with check((select public.sl_session_allowed()));
create policy sl_receipts_session on public.sl_receipts as restrictive for all to authenticated using((select public.sl_session_allowed())) with check((select public.sl_session_allowed()));
