-- SideLedger only. Never alter shared Auth settings or existing app objects.
create table public.sl_profiles (
 owner_id uuid primary key references auth.users(id) on delete cascade,
 name text not null check(length(name) between 1 and 80),
 account text not null default '' check(length(account)<=200),
 plan text not null default 'trial' check(plan in ('trial','free','pro'))
);
create table public.sl_clients (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null default auth.uid() references public.sl_profiles(owner_id),
 name text not null check(length(name) between 1 and 100), email text not null default '' check(length(email)<=254),unique(owner_id,id)
);
create table public.sl_counters(owner_id uuid references public.sl_profiles(owner_id),year int,kind text,last int not null,primary key(owner_id,year,kind));
create table public.sl_documents (
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references public.sl_profiles(owner_id),client_id uuid not null,
 kind text not null check(kind in ('invoice','quote')),number text not null,
 issued_on date not null,due_on date not null check(due_on>=issued_on),
 status text not null default 'draft' check(status in ('draft','sent','paid','void')),
 items jsonb not null,notes text not null default '',total bigint not null check(total between 1 and 9000000000000),
 created_month date not null,unique(owner_id,id),unique(owner_id,number),foreign key(owner_id,client_id) references public.sl_clients(owner_id,id)
);
create table public.sl_entries (
 id uuid primary key default gen_random_uuid(),owner_id uuid not null default auth.uid() references public.sl_profiles(owner_id),client_id uuid,
 kind text not null check(kind in ('income','expense')),amount bigint not null check(amount between 1 and 9000000000000),occurred_on date not null,
 category text not null check(length(category) between 1 and 50),memo text not null default '' check(length(memo)<=500),document_id uuid unique,
 fingerprint text,unique(owner_id,id),unique(owner_id,fingerprint),foreign key(owner_id,client_id) references public.sl_clients(owner_id,id),
 foreign key(owner_id,document_id) references public.sl_documents(owner_id,id)
);
create table public.sl_receipts (
 id uuid primary key default gen_random_uuid(),owner_id uuid not null default auth.uid() references public.sl_profiles(owner_id),entry_id uuid not null unique,
 path text not null unique check(split_part(path,'/',1)=owner_id::text),mime text not null check(mime in ('image/jpeg','image/png')),
 foreign key(owner_id,entry_id) references public.sl_entries(owner_id,id) on delete cascade
);
create index on public.sl_entries(owner_id,occurred_on);
create index on public.sl_documents(owner_id,issued_on);
alter table public.sl_profiles enable row level security;
alter table public.sl_clients enable row level security;
alter table public.sl_counters enable row level security;
alter table public.sl_documents enable row level security;
alter table public.sl_entries enable row level security;
alter table public.sl_receipts enable row level security;
create policy sl_profiles_own on public.sl_profiles for all to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
create policy sl_clients_own on public.sl_clients for all to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
create policy sl_documents_own on public.sl_documents for select to authenticated using(owner_id=(select auth.uid()));
create policy sl_entries_own on public.sl_entries for all to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()) and (client_id is null or exists(select 1 from public.sl_clients c where c.id=client_id and c.owner_id=(select auth.uid()))));
create policy sl_receipts_own on public.sl_receipts for all to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()) and exists(select 1 from public.sl_entries e where e.id=entry_id and e.owner_id=(select auth.uid())));
revoke all on public.sl_profiles,public.sl_clients,public.sl_counters,public.sl_documents,public.sl_entries,public.sl_receipts from anon,authenticated;
grant select on public.sl_profiles,public.sl_clients,public.sl_documents,public.sl_entries,public.sl_receipts to authenticated;
grant update(name,account) on public.sl_profiles to authenticated;
grant insert(name,email),update(name,email),delete on public.sl_clients to authenticated;
grant insert(kind,amount,occurred_on,category,memo,client_id,fingerprint),update(kind,amount,occurred_on,category,memo,client_id,fingerprint),delete on public.sl_entries to authenticated;
grant insert(entry_id,path,mime),delete on public.sl_receipts to authenticated;

create function public.sl_ensure_profile(p_name text) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'LOGIN_REQUIRED'; end if;
 insert into public.sl_profiles(owner_id,name) values(auth.uid(),left(coalesce(nullif(btrim(p_name),''),'사용자'),80)) on conflict do nothing;
end $$;
revoke all on function public.sl_ensure_profile(text) from public,anon;
grant execute on function public.sl_ensure_profile(text) to authenticated;

create function public.sl_guard() returns trigger language plpgsql set search_path='' as $$
declare uid uuid; plan_name text; s bigint;
begin
 uid:=case when TG_OP='DELETE' then OLD.owner_id else NEW.owner_id end;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 select plan into plan_name from public.sl_profiles where owner_id=uid;
 if TG_TABLE_NAME='sl_clients' and TG_OP='INSERT' and plan_name='free' and (select count(*) from public.sl_clients where owner_id=uid)>=3 then raise exception 'FREE_CLIENT_LIMIT'; end if;
 if TG_TABLE_NAME='sl_receipts' and plan_name='free' then raise exception 'FREE_RECEIPT_LIMIT'; end if;
 if TG_TABLE_NAME='sl_entries' then
  if TG_OP in ('UPDATE','DELETE') and OLD.document_id is not null then raise exception 'PAID_ENTRY_IMMUTABLE'; end if;
  if TG_OP<>'DELETE' then
   select coalesce(sum(amount),0) into s from public.sl_entries where owner_id=uid and id<>NEW.id;
   if s+NEW.amount>9000000000000 then raise exception 'AMOUNT_LIMIT'; end if;
   if TG_OP='UPDATE' then NEW.fingerprint:=null; end if;
  end if;
 end if;
 if TG_OP='DELETE' then return OLD; end if;return NEW;
end $$;
revoke all on function public.sl_guard() from public,anon,authenticated;
create trigger sl_clients_guard before insert on public.sl_clients for each row execute function public.sl_guard();
create trigger sl_entries_guard before insert or update or delete on public.sl_entries for each row execute function public.sl_guard();
create trigger sl_receipts_guard before insert on public.sl_receipts for each row execute function public.sl_guard();

create function public.sl_create_document(p_client uuid,p_kind text,p_issued date,p_due date,p_notes text,p_items jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); yr int:=extract(year from p_issued); n int; amount_sum numeric:=0; i jsonb; value_total bigint; normalized jsonb:='[]'; doc_id uuid:=gen_random_uuid(); month_now date:=date_trunc('month',now() at time zone 'Asia/Seoul')::date;
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
revoke all on function public.sl_create_document(uuid,text,date,date,text,jsonb) from public,anon;
grant execute on function public.sl_create_document(uuid,text,date,date,text,jsonb) to authenticated;

create function public.sl_document_status(p_id uuid,p_status text,p_paid date default (now() at time zone 'Asia/Seoul')::date) returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();d public.sl_documents;
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
revoke all on function public.sl_document_status(uuid,text,date) from public,anon;
grant execute on function public.sl_document_status(uuid,text,date) to authenticated;

create function public.sl_import_csv(p_rows jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();r jsonb;added int:=0;skipped int:=0;d date;a bigint;k text;m text;c text;
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
revoke all on function public.sl_import_csv(jsonb) from public,anon;
grant execute on function public.sl_import_csv(jsonb) to authenticated;
create view public.sl_monthly_summary with(security_invoker=true) as select owner_id,date_trunc('month',occurred_on)::date as month,coalesce(sum(amount) filter(where kind='income'),0) income,coalesce(sum(amount) filter(where kind='expense'),0) expense from public.sl_entries group by 1,2;
grant select on public.sl_monthly_summary to authenticated;
