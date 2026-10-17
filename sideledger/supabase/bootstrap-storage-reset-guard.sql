-- One-time owner operation after account recovery migration. Do not run as CI migrator.
create policy sl_receipts_session_guard on storage.objects as restrictive for all to authenticated
using(bucket_id<>'sl-receipts' or (select public.sl_session_allowed()))
with check(bucket_id<>'sl-receipts' or (select public.sl_session_allowed()));
