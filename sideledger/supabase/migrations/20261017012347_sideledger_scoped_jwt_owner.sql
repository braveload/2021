-- A scoped equivalent of auth.uid() using the verified PostgREST JWT claims.
-- This avoids granting the migration role access to the shared auth schema.
create function public.sl_uid() returns uuid language sql stable set search_path='' as $$
 select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid;
$$;
revoke all on function public.sl_uid() from public,anon;
grant execute on function public.sl_uid() to authenticated;

create or replace function public.sl_ensure_profile(p_name text) returns void language plpgsql security definer set search_path='' as $$
begin
 if public.sl_uid() is null then raise exception 'LOGIN_REQUIRED'; end if;
 insert into public.sl_profiles(owner_id,name) values(public.sl_uid(),left(coalesce(nullif(btrim(p_name),''),'사용자'),80)) on conflict do nothing;
end $$;

create or replace function public.sl_create_document(p_client uuid,p_kind text,p_issued date,p_due date,p_notes text,p_items jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=public.sl_uid(); yr int:=extract(year from p_issued); n int; amount_sum numeric:=0; i jsonb; value_total bigint; normalized jsonb:='[]'; doc_id uuid:=gen_random_uuid(); month_now date:=date_trunc('month',now() at time zone 'Asia/Seoul')::date;
begin
 if uid is null then raise exception 'LOGIN_REQUIRED';end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 if not exists(select 1 from public.sl_clients where id=p_client and owner_id=uid) then raise exception 'CLIENT_NOT_FOUND';end if;
 if p_kind not in ('invoice','quote') or p_issued is null or p_due<p_issued or p_due is null or length(p_notes)>1000 then raise exception 'INVALID_DOCUMENT';end if;
 if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 30 then raise exception 'INVALID_ITEMS';end if;
 for i in select * from jsonb_array_elements(p_items) loop
  if coalesce(length(i->>'description'),0) not between 1 and 200 or coalesce(i->>'qty100','') !~ '^[0-9]+$' or coalesce(i->>'unit_price','') !~ '^[0-9]+$' or (i->>'qty100')::bigint not between 1 and 99999999 or (i->>'unit_price')::bigint not between 0 and 9000000000000 then raise exception 'INVALID_ITEM';end if;
  amount_sum:=amount_sum+(i->>'qty100')::numeric*(i->>'unit_price')::numeric;
  normalized:=normalized||jsonb_build_array(jsonb_build_object('description',i->>'description','qty100',(i->>'qty100')::int,'unit_price',(i->>'unit_price')::bigint));
 end loop;
 value_total:=round(amount_sum/100);
 if value_total not between 1 and 9000000000000 or (select coalesce(sum(total),0) from public.sl_documents where owner_id=uid)+value_total>9000000000000 then raise exception 'AMOUNT_LIMIT';end if;
 if (select plan from public.sl_profiles where owner_id=uid)='free' and (select count(*) from public.sl_documents where owner_id=uid and created_month=month_now)>=3 then raise exception 'FREE_DOCUMENT_LIMIT';end if;
 insert into public.sl_counters values(uid,yr,p_kind,1) on conflict(owner_id,year,kind) do update set last=public.sl_counters.last+1 returning last into n;
 insert into public.sl_documents(id,owner_id,client_id,kind,number,issued_on,due_on,items,notes,total,created_month)
 values(doc_id,uid,p_client,p_kind,(case when p_kind='invoice' then 'INV' else 'QUO' end)||'-'||yr||'-'||lpad(n::text,greatest(4,length(n::text)),'0'),p_issued,p_due,normalized,coalesce(p_notes,''),value_total,month_now);
 return doc_id;
end $$;

create or replace function public.sl_document_status(p_id uuid,p_status text,p_paid date default (now() at time zone 'Asia/Seoul')::date) returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=public.sl_uid();d public.sl_documents;
begin
 if uid is null then raise exception 'LOGIN_REQUIRED';end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 select * into d from public.sl_documents where id=p_id and owner_id=uid for update;
 if not found then raise exception 'DOCUMENT_NOT_FOUND';end if;
 if d.status=p_status then return;end if;
 if not ((d.status='draft' and p_status in ('sent','void')) or (d.status='sent' and (p_status='void' or (p_status='paid' and d.kind='invoice')))) then raise exception 'INVALID_TRANSITION';end if;
 if p_status='paid' then
  if p_paid is null or p_paid<d.issued_on then raise exception 'INVALID_PAID_DATE';end if;
  insert into public.sl_entries(owner_id,client_id,kind,amount,occurred_on,category,memo,document_id) values(uid,d.client_id,'income',d.total,p_paid,'외주 수입',d.number||' 입금',d.id);
 end if;
 update public.sl_documents set status=p_status where id=p_id and owner_id=uid;
end $$;

create or replace function public.sl_import_csv(p_rows jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=public.sl_uid();r jsonb;added int:=0;skipped int:=0;d date;a bigint;k text;m text;c text;
begin
 if uid is null then raise exception 'LOGIN_REQUIRED';end if;
 if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows) not between 1 and 2000 then raise exception 'INVALID_CSV';end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 for r in select * from jsonb_array_elements(p_rows) loop
  k:=r->>'kind';m:=coalesce(r->>'memo','');c:=coalesce(nullif(r->>'category',''),'기타');
  if coalesce(r->>'amount','') !~ '^[0-9]+$' or coalesce(r->>'occurred_on','') !~ '^\d{4}-\d{2}-\d{2}$' or k not in ('income','expense') or k is null or length(m)>500 or length(c)>50 then raise exception 'INVALID_CSV_ROW';end if;
  a:=(r->>'amount')::bigint;d:=(r->>'occurred_on')::date;
  if a not between 1 and 9000000000000 then raise exception 'INVALID_CSV_AMOUNT';end if;
  if exists(select 1 from public.sl_entries where owner_id=uid and occurred_on=d and kind=k and amount=a and memo=m) then skipped:=skipped+1;
  else insert into public.sl_entries(owner_id,kind,amount,occurred_on,category,memo) values(uid,k,a,d,c,m);added:=added+1;end if;
 end loop;return jsonb_build_object('added',added,'skipped',skipped);
end $$;
