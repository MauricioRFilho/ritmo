create table if not exists public.privacy_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_type text not null check (request_type in ('export', 'deletion')),
  status text not null default 'requested'
    check (status in ('requested', 'processing', 'completed', 'rejected')),
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  notes text
);

alter table public.privacy_requests enable row level security;

create policy privacy_requests_owner_read
on public.privacy_requests for select
to authenticated
using ((select auth.uid()) = user_id);

create policy privacy_requests_owner_insert
on public.privacy_requests for insert
to authenticated
with check ((select auth.uid()) = user_id and status = 'requested');

create index if not exists privacy_requests_user_id_idx
  on public.privacy_requests(user_id, requested_at desc);

