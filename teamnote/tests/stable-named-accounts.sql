-- Regression tests, no production account or team changes are committed.
begin;
do $$ <<test>>
declare uid uuid; tid uuid; key text := 'name-fixture-'||substr(gen_random_uuid()::text,1,8);
  blocked boolean; before_count integer; recovered uuid; rec text := repeat(md5(gen_random_uuid()::text),2);
  exp text := repeat(md5(gen_random_uuid()::text),2); session_hash text := repeat(md5(gen_random_uuid()::text),2);
begin
  perform set_config('app.user_id','',true);
  uid:=teamnote.auth_start_named(key);
  select count(*) into before_count from teamnote.users;
  perform set_config('app.user_id',uid::text,true);
  if teamnote.auth_start_named(' '||key||' ')<>uid then raise exception 'repeat start returned another account'; end if;
  if teamnote.auth_start_named(upper(key))<>uid then raise exception 'normalized name was not reused'; end if;
  if (select count(*) from teamnote.users)<>before_count then raise exception 'repeat start inserted account'; end if;
  blocked:=false;
  begin perform teamnote.auth_start_named('different-account'); exception when others then
    if sqlerrm='account_name_mismatch' then blocked:=true; else raise; end if; end;
  if not blocked then raise exception 'changed name replaced account'; end if;
  perform set_config('app.user_id','',true);
  blocked:=false;
  begin perform teamnote.auth_start_named(key); exception when others then
    if sqlerrm='account_exists' then blocked:=true; else raise; end if; end;
  if not blocked then raise exception 'anonymous name entry impersonated existing account'; end if;
  if (select count(*) from teamnote.users)<>before_count then raise exception 'anonymous duplicate inserted'; end if;
  perform set_config('app.user_id',uid::text,true);
  tid:=teamnote.create_team('stable-account-fixture',15);
  insert into teamnote.account_recovery_links(token_hash,user_id,team_id,expires_at)
    values(rec,uid,tid,now()+interval '1 day'),(exp,uid,tid,now()-interval '1 second');
  if not exists(select 1 from teamnote.account_recovery_preview(rec) where name=key and role='owner' and not used) then
    raise exception 'preview does not identify original account'; end if;
  perform set_config('app.user_id','',true);
  if teamnote.redeem_account_recovery(rec,session_hash)<>tid then raise exception 'recovery redirected to wrong team'; end if;
  select id into recovered from teamnote.auth_session_user(session_hash);
  if recovered<>uid then raise exception 'recovery created or returned different account'; end if;
  blocked:=false;
  begin perform teamnote.redeem_account_recovery(rec,session_hash); exception when others then
    if sqlerrm='recovery_used' then blocked:=true; else raise; end if; end;
  if not blocked then raise exception 'recovery token reused'; end if;
  blocked:=false;
  begin perform teamnote.redeem_account_recovery(exp,session_hash); exception when others then
    if sqlerrm='invalid_recovery' then blocked:=true; else raise; end if; end;
  if not blocked then raise exception 'expired token used'; end if;
  blocked:=false;
  begin perform teamnote.redeem_account_recovery(repeat('f',64),session_hash); exception when others then
    if sqlerrm='invalid_recovery' then blocked:=true; else raise; end if; end;
  if not blocked then raise exception 'forged token used'; end if;
  if has_table_privilege('teamnote_app','teamnote.account_recovery_links','SELECT') or
     has_function_privilege('anon','teamnote.redeem_account_recovery(text,text)','EXECUTE') then
    raise exception 'recovery links exposed publicly'; end if;
end $$;
rollback;
select 'PASS: repeat start idempotent, normalized names, wrong-name session guard, no anonymous duplicate or name takeover, recovery preserves account/team, one-use/expiry/forgery/ACL checks' as result;
