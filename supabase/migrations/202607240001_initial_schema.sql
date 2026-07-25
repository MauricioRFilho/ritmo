create extension if not exists pgcrypto;

create type public.memory_status as enum ('suggested','confirmed','pinned','rejected','archived');
create type public.ai_job_status as enum ('queued','running','waiting_retry','completed','failed','cancelled');

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  handle text,
  timezone text not null default 'America/Sao_Paulo',
  locale text not null default 'pt-BR',
  onboarding_completed boolean not null default false,
  context jsonb not null default '{}'::jsonb,
  terms_accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.creator_preferences (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  category text not null, value jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.equipment_items (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  name text not null, category text not null, notes text, available boolean not null default true, created_at timestamptz not null default now()
);
create table public.available_locations (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  name text not null, attributes jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create table public.platform_profiles (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('instagram','tiktok')), handle text, followers integer not null default 0, average_views integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id, platform)
);
create table public.metric_snapshots (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('instagram','tiktok')), captured_at timestamptz not null default now(), metrics jsonb not null
);
create table public.creator_goals (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  title text not null, platform text, metric text not null, current_value numeric not null default 0, target_value numeric not null, target_date date, status text not null default 'active',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.recurring_availability (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6), start_time time not null, end_time time not null, kind text not null, label text, created_at timestamptz not null default now()
);
create table public.schedule_exceptions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  starts_at timestamptz not null, ends_at timestamptz not null, available boolean not null default false, label text, created_at timestamptz not null default now()
);
create table public.weekly_plans (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null, version integer not null default 1, status text not null default 'draft', rationale text, locked_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id, week_start, version)
);
create table public.content_plans (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  weekly_plan_id uuid references public.weekly_plans(id) on delete set null, platform text not null check (platform in ('instagram','tiktok')),
  title text not null, objective text, format text, status text not null default 'idea', scheduled_for timestamptz, is_manually_locked boolean not null default false,
  payload jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.content_tasks (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  content_plan_id uuid references public.content_plans(id) on delete cascade, kind text not null, title text not null,
  starts_at timestamptz, duration_minutes integer, status text not null default 'planned', created_at timestamptz not null default now()
);
create table public.content_versions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  content_plan_id uuid not null references public.content_plans(id) on delete cascade, version integer not null, payload jsonb not null,
  created_at timestamptz not null default now(), unique(content_plan_id, version)
);
create table public.publication_results (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  content_plan_id uuid references public.content_plans(id) on delete set null, platform text not null, published_at timestamptz not null,
  url text, metrics jsonb not null default '{}'::jsonb, notes text, created_at timestamptz not null default now()
);
create table public.conversations (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Meu copiloto', is_primary boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.messages (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade, role text not null check (role in ('user','assistant','system','tool')),
  content text not null, status text not null default 'completed', metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create table public.conversation_summaries (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade, period_start timestamptz not null, period_end timestamptz not null,
  summary text not null, created_at timestamptz not null default now()
);
create table public.creator_memories (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  category text not null, content text not null, status public.memory_status not null default 'suggested', confidence numeric(4,3) not null default .5,
  sensitivity text not null default 'normal', source_type text, source_id uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.memory_sources (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  memory_id uuid not null references public.creator_memories(id) on delete cascade, source_type text not null, source_id uuid, excerpt text, created_at timestamptz not null default now()
);
create table public.trend_evidence (
  id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade,
  term text not null, platform text not null, niche text, region text, source_name text not null, source_url text not null,
  published_at timestamptz, checked_at timestamptz not null default now(), expires_at timestamptz not null, signal text, confidence numeric(4,3), created_at timestamptz not null default now()
);
create table public.ai_jobs (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null, status public.ai_job_status not null default 'queued', payload jsonb not null default '{}'::jsonb, result jsonb,
  idempotency_key text not null, attempts integer not null default 0, max_attempts integer not null default 3, progress integer not null default 0,
  locked_at timestamptz, locked_by text, run_after timestamptz not null default now(), error_code text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(user_id, idempotency_key)
);
create table public.ai_usage_events (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid references public.ai_jobs(id) on delete set null, model text not null, operation text not null, prompt_tokens integer, completion_tokens integer,
  duration_ms integer, success boolean not null, created_at timestamptz not null default now()
);
create table public.audit_events (
  id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete set null,
  action text not null, entity_type text, entity_id uuid, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array[
    'profiles','creator_preferences','equipment_items','available_locations','platform_profiles','metric_snapshots',
    'creator_goals','recurring_availability','schedule_exceptions','weekly_plans','content_plans','content_tasks',
    'content_versions','publication_results','conversations','messages','conversation_summaries','creator_memories',
    'memory_sources','ai_jobs','ai_usage_events'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t || '_owner', t);
    if t <> 'profiles' then execute format('create index %I on public.%I(user_id)', t || '_user_id_idx', t); end if;
  end loop;
end $$;

alter table public.trend_evidence enable row level security;
create policy trend_read on public.trend_evidence for select to authenticated using (user_id is null or (select auth.uid()) = user_id);
create policy trend_owner_write on public.trend_evidence for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create index trend_lookup_idx on public.trend_evidence(platform, niche, region, expires_at);
create index messages_conversation_created_idx on public.messages(conversation_id, created_at);
create index content_plans_schedule_idx on public.content_plans(user_id, scheduled_for);
create index ai_jobs_worker_idx on public.ai_jobs(status, run_after, created_at);

create or replace function public.claim_ai_job(worker_name text)
returns setof public.ai_jobs language plpgsql security definer set search_path = public as $$
begin
  return query
  update public.ai_jobs set status = 'running', locked_at = now(), locked_by = worker_name, attempts = attempts + 1, updated_at = now()
  where id = (
    select id from public.ai_jobs
    where status in ('queued','waiting_retry') and run_after <= now()
    order by created_at for update skip locked limit 1
  )
  returning *;
end $$;
revoke all on function public.claim_ai_job(text) from public, anon, authenticated;
