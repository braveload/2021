-- One-time bootstrap by project owner. Do not run from the restricted CI role.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('sl-receipts','sl-receipts',false,5242880,array['image/jpeg','image/png']);
create policy sl_receipts_select on storage.objects for select to authenticated using(bucket_id='sl-receipts' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy sl_receipts_insert on storage.objects for insert to authenticated with check(bucket_id='sl-receipts' and (storage.foldername(name))[1]=(select auth.uid())::text and exists(select 1 from public.sl_profiles where owner_id=(select auth.uid()) and plan in ('trial','pro')));
create policy sl_receipts_delete on storage.objects for delete to authenticated using(bucket_id='sl-receipts' and (storage.foldername(name))[1]=(select auth.uid())::text);
