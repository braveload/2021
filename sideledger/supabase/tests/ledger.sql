begin;
insert into auth.users(id) values('a1111111-1111-4111-8111-111111111111'),('b1111111-1111-4111-8111-111111111111');
set local role authenticated;
select set_config('request.jwt.claim.sub','a1111111-1111-4111-8111-111111111111',true);
select public.sl_ensure_profile('TEST A');
with c as(insert into public.sl_clients(name) values('TEST A CLIENT') returning id) select set_config('sl_test.client',id::text,true) from c;
do $$declare d uuid;begin
 d:=public.sl_create_document(current_setting('sl_test.client')::uuid,'invoice',current_date,current_date,'','[{"description":"TEST","qty100":125,"unit_price":1000}]');
 if (select total from public.sl_documents where id=d)<>1250 then raise exception 'TEST TOTAL FAILED';end if;
 perform set_config('sl_test.document',d::text,true);
 begin perform public.sl_document_status(d,'paid');raise exception 'TEST INVALID TRANSITION ACCEPTED';exception when others then if SQLERRM<>'INVALID_TRANSITION' then raise;end if;end;
 perform public.sl_document_status(d,'sent');perform public.sl_document_status(d,'paid');perform public.sl_document_status(d,'paid');
 if (select count(*) from public.sl_entries where document_id=d)<>1 then raise exception 'TEST IDEMPOTENCY FAILED';end if;
 begin delete from public.sl_entries where document_id=d;raise exception 'TEST PAID DELETE ACCEPTED';exception when others then if SQLERRM<>'PAID_ENTRY_IMMUTABLE' then raise;end if;end;
 begin update public.sl_profiles set plan='pro';raise exception 'TEST PLAN UPDATE ACCEPTED';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub','b1111111-1111-4111-8111-111111111111',true);
select public.sl_ensure_profile('TEST B');
do $$begin
 if (select count(*) from public.sl_clients)<>0 or (select count(*) from public.sl_documents)<>0 or (select count(*) from public.sl_entries)<>0 then raise exception 'TEST RLS LEAK';end if;
 begin perform public.sl_create_document(current_setting('sl_test.client')::uuid,'invoice',current_date,current_date,'','[{"description":"TEST","qty100":100,"unit_price":1}]');raise exception 'TEST CROSS CLIENT ACCEPTED';exception when others then if SQLERRM<>'CLIENT_NOT_FOUND' then raise;end if;end;
 begin perform public.sl_document_status(current_setting('sl_test.document')::uuid,'void');raise exception 'TEST CROSS DOCUMENT ACCEPTED';exception when others then if SQLERRM<>'DOCUMENT_NOT_FOUND' then raise;end if;end;
 begin select last from public.sl_counters;raise exception 'TEST COUNTER ACCESS ACCEPTED';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub','a1111111-1111-4111-8111-111111111111',true);
do $$declare r jsonb;begin
 r:=public.sl_import_csv('[{"kind":"expense","amount":22,"occurred_on":"2026-10-17","category":"TEST","memo":"DEDUP"},{"kind":"expense","amount":22,"occurred_on":"2026-10-17","category":"TEST","memo":"DEDUP"}]');
 if r<> '{"added":1,"skipped":1}'::jsonb then raise exception 'TEST CSV DEDUP FAILED';end if;
 begin perform public.sl_import_csv('[{"kind":"income","amount":1,"occurred_on":"2026-10-17","memo":"ROLLBACK"},{"kind":"expense","amount":-1,"occurred_on":"2026-10-17"}]');raise exception 'TEST INVALID CSV ACCEPTED';exception when others then if SQLERRM<>'INVALID_CSV_ROW' and SQLERRM<>'INVALID_CSV_AMOUNT' then raise;end if;end;
 if exists(select 1 from public.sl_entries where memo='ROLLBACK') then raise exception 'TEST CSV ATOMICITY FAILED';end if;
end $$;
reset role;
update public.sl_profiles set plan='free' where owner_id='b1111111-1111-4111-8111-111111111111';
set local role authenticated;
select set_config('request.jwt.claim.sub','b1111111-1111-4111-8111-111111111111',true);
with c as(insert into public.sl_clients(name) values('TEST B CLIENT') returning id) select set_config('sl_test.client',id::text,true) from c;
do $$begin
 for n in 1..3 loop perform public.sl_create_document(current_setting('sl_test.client')::uuid,'invoice',current_date,current_date,'','[{"description":"TEST","qty100":100,"unit_price":1}]');end loop;
 begin perform public.sl_create_document(current_setting('sl_test.client')::uuid,'invoice','2020-01-01','2020-01-01','','[{"description":"TEST","qty100":100,"unit_price":1}]');raise exception 'TEST FREE LIMIT BYPASS';exception when others then if SQLERRM<>'FREE_DOCUMENT_LIMIT' then raise;end if;end;
 insert into public.sl_clients(name) values('TEST TWO'),('TEST THREE');
 begin insert into public.sl_clients(name) values('TEST FOUR');raise exception 'TEST CLIENT LIMIT FAILED';exception when others then if SQLERRM<>'FREE_CLIENT_LIMIT' then raise;end if;end;
end $$;
reset role;
update public.sl_documents set created_month='2000-01-01' where owner_id='b1111111-1111-4111-8111-111111111111';
update public.sl_profiles set plan='pro' where owner_id='b1111111-1111-4111-8111-111111111111';
set local role authenticated;
do $$declare names text[];begin
 for n in 1..10 loop perform public.sl_create_document(current_setting('sl_test.client')::uuid,'quote',current_date,current_date,'','[{"description":"TEST","qty100":100,"unit_price":1}]');end loop;
 select array_agg(number) into names from public.sl_documents where kind='quote';if cardinality(names)<>10 or (select count(distinct number) from public.sl_documents where kind='quote')<>10 then raise exception 'TEST NUMBER FAILED';end if;
end $$;
select 'PASS: RLS, cross-owner references, sum, transition, paid-idempotency, immutable income, plan grant, counters grant, CSV dedup/atomicity, Free limits, Pro numbering' as result;
rollback;
