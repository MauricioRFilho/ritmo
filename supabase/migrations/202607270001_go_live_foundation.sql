-- Fundação incremental para o Go Live. Esta migration é idempotente e não
-- altera a migration inicial já potencialmente aplicada em outros ambientes.

alter table public.audit_events enable row level security;

drop policy if exists audit_events_owner_read on public.audit_events;
create policy audit_events_owner_read
on public.audit_events for select
to authenticated
using ((select auth.uid()) = user_id);

-- Eventos de auditoria são append-only para o cliente. Atualização e exclusão
-- ficam restritas ao service role, que ignora RLS.
drop policy if exists audit_events_owner_insert on public.audit_events;
create policy audit_events_owner_insert
on public.audit_events for insert
to authenticated
with check ((select auth.uid()) = user_id);

create index if not exists audit_events_user_id_idx
  on public.audit_events(user_id, created_at desc);

alter table public.profiles
  add column if not exists account_mode text not null default 'professional'
    check (account_mode in ('hobby', 'professional', 'team'));

alter table public.creator_preferences
  add column if not exists niche_id text;

create unique index if not exists creator_preferences_user_category_idx
  on public.creator_preferences(user_id, category);

-- Faz um job abandonado voltar à fila. Somente o worker/service role pode chamar.
create or replace function public.requeue_stale_ai_jobs(stale_after interval default interval '10 minutes')
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  update public.ai_jobs
  set
    status = case when attempts < max_attempts then 'waiting_retry'::public.ai_job_status
                  else 'failed'::public.ai_job_status end,
    run_after = case when attempts < max_attempts then now() else run_after end,
    error_code = 'worker_timeout',
    locked_at = null,
    locked_by = null,
    updated_at = now()
  where status = 'running'
    and locked_at < now() - stale_after;

  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function public.requeue_stale_ai_jobs(interval)
  from public, anon, authenticated;

