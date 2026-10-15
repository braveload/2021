-- Run through the authorized DB connection. Test accounts and teams are rolled back.
begin;
do $$ <<multiple_admins>>
declare a uuid; b uuid; c uuid; member_id uuid; outsider uuid; team_id uuid;
  code text; token_b text := repeat(md5(gen_random_uuid()::text),2);
  token_c text := repeat(md5(gen_random_uuid()::text),2);
  expired text := repeat(md5(gen_random_uuid()::text),2);
  req uuid; req2 uuid; d date := (date_trunc('week',current_date)+interval '14 days')::date;
  blocked boolean; u uuid; decision boolean;
begin
  perform set_config('app.user_id','',true);
  a := teamnote.auth_register(gen_random_uuid()||'@test.local','fixture-a','!');
  b := teamnote.auth_register(gen_random_uuid()||'@test.local','fixture-b','!');
  c := teamnote.auth_register(gen_random_uuid()||'@test.local','fixture-c','!');
  member_id := teamnote.auth_register(gen_random_uuid()||'@test.local','fixture-member','!');
  outsider := teamnote.auth_register(gen_random_uuid()||'@test.local','fixture-outsider','!');
  perform set_config('app.user_id',a::text,true);
  team_id := teamnote.create_team('multiple-admin-fixture',15);
  select invite_code into code from teamnote.teams where id=team_id;
  insert into teamnote.admin_invites(token_hash,team_id,intended_name,expires_at) values
    (token_b,team_id,'fixture-b',now()+interval '7 days'),
    (token_c,team_id,'fixture-c',now()+interval '7 days'),
    (expired,team_id,'fixture-outsider',now()-interval '1 second');
  perform set_config('app.user_id',b::text,true);
  perform teamnote.join_team(code);
  if teamnote.team_role(team_id)<>'member' then raise exception 'name-only privilege escalation'; end if;
  perform set_config('app.user_id',a::text,true);
  blocked:=false;
  begin perform teamnote.claim_admin_invite(token_b);
    exception when others then if sqlerrm='admin_name_mismatch' then blocked:=true; else raise; end if;
  end;
  if not blocked then raise exception 'wrong identity claimed invitation'; end if;
  perform set_config('app.user_id',b::text,true);
  perform teamnote.claim_admin_invite(token_b);
  perform teamnote.claim_admin_invite(token_b); -- same account retry is idempotent
  perform set_config('app.user_id',c::text,true);
  blocked:=false;
  begin perform teamnote.claim_admin_invite(token_b);
    exception when others then if sqlerrm='admin_invite_used' then blocked:=true; else raise; end if;
  end;
  if not blocked then raise exception 'reused invitation accepted'; end if;
  perform teamnote.claim_admin_invite(token_c);
  if (select count(*) from teamnote.team_members m where m.team_id=multiple_admins.team_id and role='owner')<>3 then
    raise exception 'three admins not supported';
  end if;
  perform set_config('app.user_id',a::text,true);
  perform teamnote.set_member_role(team_id,a,'member');
  if teamnote.team_role(team_id)<>'member' then raise exception 'creator demotion failed'; end if;
  blocked:=false;
  begin perform teamnote.set_member_role(team_id,a,'owner');
    exception when others then if sqlerrm='forbidden' then blocked:=true; else raise; end if;
  end;
  if not blocked then raise exception 'demoted admin regained authority'; end if;
  req := teamnote.request_leave(team_id,'full',d,d,'permission fixture');
  foreach u in array array[a,member_id,outsider] loop
    perform set_config('app.user_id',u::text,true);
    foreach decision in array array[true,false] loop
      blocked:=false;
      begin perform teamnote.decide_leave(req,decision,'forbidden fixture');
        exception when others then if sqlerrm='forbidden' then blocked:=true; else raise; end if;
      end;
      if not blocked then raise exception 'non-admin decision accepted'; end if;
    end loop;
  end loop;
  perform set_config('app.user_id',b::text,true);
  perform teamnote.decide_leave(req,true,'administrator b');
  perform set_config('app.user_id',a::text,true);
  req2 := teamnote.request_leave(team_id,'full',d+1,d+1,'rejection fixture');
  perform set_config('app.user_id',c::text,true);
  perform teamnote.decide_leave(req2,false,'administrator c');
  if (select status from teamnote.leave_requests where id=req)<>'approved' or
     (select status from teamnote.leave_requests where id=req2)<>'rejected' then
    raise exception 'admin approval/rejection failed';
  end if;
  perform set_config('app.user_id',b::text,true);
  perform teamnote.set_member_role(team_id,c,'member');
  blocked:=false;
  begin perform teamnote.set_member_role(team_id,b,'member');
    exception when others then if sqlerrm='last_admin' then blocked:=true; else raise; end if;
  end;
  if not blocked then raise exception 'last administrator removed'; end if;
  perform set_config('app.user_id',outsider::text,true);
  blocked:=false;
  begin perform teamnote.claim_admin_invite(expired);
    exception when others then if sqlerrm='invalid_admin_invite' then blocked:=true; else raise; end if;
  end;
  if not blocked then raise exception 'expired invitation accepted'; end if;
  if has_table_privilege('teamnote_app','teamnote.admin_invites','SELECT') or
     has_function_privilege('anon','teamnote.claim_admin_invite(text)','EXECUTE') then
    raise exception 'invitation access control failure';
  end if;
end $$;
rollback;
select 'PASS: three administrators, creator demotion, admin-only decisions, one-use and expired invitations, last-admin guard, invitation ACLs; all fixtures rolled back' as result;
