alter table public.privacy_requests
  add column if not exists locked_at timestamptz,
  add column if not exists locked_by text,
  add column if not exists attempts integer not null default 0;

create index if not exists privacy_requests_worker_idx
  on public.privacy_requests(status, request_type, requested_at);

create or replace function public.claim_privacy_deletion(worker_name text)
returns setof public.privacy_requests
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.privacy_requests
  set status = 'processing', locked_at = now(), locked_by = worker_name,
      attempts = attempts + 1
  where id = (
    select id from public.privacy_requests
    where status = 'requested' and request_type = 'deletion'
    order by requested_at for update skip locked limit 1
  )
  returning *;
end;
$$;

revoke all on function public.claim_privacy_deletion(text)
  from public, anon, authenticated;

create or replace function public.requeue_stale_privacy_deletions(
  stale_after interval default interval '15 minutes'
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare affected integer;
begin
  update public.privacy_requests
  set status = case when attempts < 3 then 'requested' else 'rejected' end,
      locked_at = null, locked_by = null, notes = 'processing_timeout'
  where status = 'processing' and request_type = 'deletion'
    and locked_at < now() - stale_after;
  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function public.requeue_stale_privacy_deletions(interval)
  from public, anon, authenticated;

