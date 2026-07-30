-- Biblioteca pública de roteiros e ideias.
-- As tabelas-base nunca são leitura pública: views projetam somente campos
-- aprovados e evitam expor user_id ou dados privados do criador.

create type public.community_editorial_status as enum
  ('draft', 'pending', 'changes_requested', 'approved', 'rejected', 'withdrawn');
create type public.template_origin as enum ('official', 'community');
create type public.template_performance_status as enum
  ('unmeasured', 'measured', 'performance_validated');
create type public.staff_role as enum ('moderator', 'admin');
create type public.moderation_action as enum
  ('submitted', 'approved', 'rejected', 'changes_requested', 'withdrawn');

create table public.public_creator_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  handle text not null,
  display_name text not null,
  bio text,
  avatar_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint public_creator_profiles_handle_format
    check (handle ~ '^[a-z0-9][a-z0-9_-]{2,29}$'),
  constraint public_creator_profiles_display_name_length
    check (length(btrim(display_name)) between 2 and 80),
  constraint public_creator_profiles_bio_length
    check (bio is null or length(bio) <= 500),
  constraint public_creator_profiles_avatar_https
    check (avatar_url is null or avatar_url ~ '^https://')
);
create unique index public_creator_profiles_handle_lower_idx
  on public.public_creator_profiles(lower(handle));

create table public.community_staff_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.staff_role not null,
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table public.community_posts (
  id uuid primary key default gen_random_uuid(),
  author_profile_id uuid not null references public.public_creator_profiles(id),
  slug text not null unique,
  editorial_status public.community_editorial_status not null default 'draft',
  current_submission_id uuid,
  published_at timestamptz,
  withdrawn_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint community_posts_slug_format
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*-[a-f0-9]{8}$')
);

create table public.community_submissions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  version integer not null check (version > 0),
  source_content_plan_id uuid not null references public.content_plans(id),
  source_content_version_id uuid not null references public.content_versions(id),
  title text not null check (length(btrim(title)) between 8 and 140),
  summary text not null check (length(btrim(summary)) between 20 and 500),
  usage_notes text check (usage_notes is null or length(usage_notes) <= 1000),
  niches text[] not null default '{}',
  tags text[] not null default '{}',
  creative_type text not null check (length(creative_type) between 2 and 50),
  format text not null check (length(format) between 2 and 50),
  platform text not null check (length(platform) between 2 and 30),
  objective text not null check (length(objective) between 2 and 120),
  snapshot jsonb not null,
  editorial_status public.community_editorial_status not null default 'pending',
  rights_confirmed boolean not null,
  adaptation_license_accepted boolean not null,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  moderation_reason text,
  created_at timestamptz not null default now(),
  unique (post_id, version),
  constraint community_submission_snapshot_object
    check (jsonb_typeof(snapshot) = 'object' and pg_column_size(snapshot) <= 131072),
  constraint community_submission_tags_limit
    check (cardinality(tags) <= 12 and cardinality(niches) <= 8),
  constraint community_submission_required_consent
    check (rights_confirmed and adaptation_license_accepted),
  constraint community_submission_moderation_reason
    check (moderation_reason is null or length(moderation_reason) between 3 and 1000)
);

alter table public.community_posts
  add constraint community_posts_current_submission_fk
  foreign key (current_submission_id)
  references public.community_submissions(id) on delete set null;

create table public.creative_template_catalog (
  id uuid primary key default gen_random_uuid(),
  template_key text not null,
  version integer not null check (version > 0),
  origin public.template_origin not null,
  community_post_id uuid references public.community_posts(id) on delete restrict,
  community_submission_id uuid references public.community_submissions(id) on delete restrict,
  title text not null check (length(btrim(title)) between 3 and 140),
  summary text not null check (length(btrim(summary)) between 8 and 500),
  creative_type text not null,
  format text not null,
  platform text not null,
  objective text not null,
  niches text[] not null default '{}',
  tags text[] not null default '{}',
  schema_version integer not null default 1 check (schema_version > 0),
  template_json jsonb not null,
  editorial_status public.community_editorial_status not null default 'approved',
  performance_status public.template_performance_status not null default 'unmeasured',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (template_key, version),
  constraint creative_template_json_object
    check (jsonb_typeof(template_json) = 'object' and pg_column_size(template_json) <= 131072),
  constraint creative_template_origin_reference
    check (
      (origin = 'official' and community_post_id is null and community_submission_id is null)
      or
      (origin = 'community' and community_post_id is not null and community_submission_id is not null)
    ),
  constraint creative_template_public_state
    check (not active or editorial_status = 'approved')
);

create table public.community_post_likes (
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create table public.community_post_saves (
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create table public.community_post_reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  reporter_user_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (reason in ('copyright', 'unsafe', 'spam', 'misleading', 'other')),
  details text check (details is null or length(details) <= 1000),
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null,
  unique (post_id, reporter_user_id)
);
create table public.community_moderation_events (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  submission_id uuid references public.community_submissions(id) on delete set null,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  action public.moderation_action not null,
  reason text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  constraint community_moderation_metadata_object check (jsonb_typeof(metadata) = 'object')
);
create table public.community_reuse_provenance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_post_id uuid not null references public.community_posts(id) on delete restrict,
  source_template_id uuid not null references public.creative_template_catalog(id) on delete restrict,
  source_template_version integer not null,
  target_content_plan_id uuid not null unique references public.content_plans(id) on delete cascade,
  ai_job_id uuid references public.ai_jobs(id) on delete set null,
  result_content_version_id uuid references public.content_versions(id) on delete set null,
  created_at timestamptz not null default now()
);

create index community_submissions_queue_idx
  on public.community_submissions(editorial_status, submitted_at);
create index community_submissions_author_day_idx
  on public.community_submissions(author_user_id, submitted_at desc);
create index community_posts_public_idx
  on public.community_posts(editorial_status, published_at desc);
create index creative_template_discovery_idx
  on public.creative_template_catalog(editorial_status, active, creative_type, format);
create index community_likes_post_idx on public.community_post_likes(post_id);
create index community_saves_user_idx on public.community_post_saves(user_id, created_at desc);
create index community_reports_queue_idx on public.community_post_reports(status, created_at);

create or replace function public.is_community_moderator(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_user_id is not null and exists (
    select 1 from public.community_staff_roles
    where user_id = p_user_id and role in ('moderator', 'admin')
  );
$$;
revoke all on function public.is_community_moderator(uuid) from public, anon;
grant execute on function public.is_community_moderator(uuid) to authenticated;

create or replace function public.sanitize_community_snapshot(p_payload jsonb)
returns jsonb language sql immutable set search_path = public as $$
  select coalesce(jsonb_object_agg(entry.key, entry.value), '{}'::jsonb)
  from jsonb_each(coalesce(p_payload, '{}'::jsonb)) entry
  where entry.key = any (array[
    'objective','hooks','scenes','capture_notes','editing_notes','caption','cta',
    'hashtags','duration_seconds','slides','visual','prompt','script','disclosure',
    'shot_list','sections','alt_text'
  ]);
$$;
revoke all on function public.sanitize_community_snapshot(jsonb) from public, anon, authenticated;

alter table public.public_creator_profiles enable row level security;
alter table public.community_staff_roles enable row level security;
alter table public.community_posts enable row level security;
alter table public.community_submissions enable row level security;
alter table public.creative_template_catalog enable row level security;
alter table public.community_post_likes enable row level security;
alter table public.community_post_saves enable row level security;
alter table public.community_post_reports enable row level security;
alter table public.community_moderation_events enable row level security;
alter table public.community_reuse_provenance enable row level security;

create policy public_creator_profiles_owner
on public.public_creator_profiles for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy community_posts_author_read
on public.community_posts for select to authenticated
using (
  author_profile_id in (
    select id from public.public_creator_profiles where user_id = (select auth.uid())
  )
  or public.is_community_moderator()
);
create policy community_submissions_author_read
on public.community_submissions for select to authenticated
using (author_user_id = (select auth.uid()) or public.is_community_moderator());
create policy creative_template_catalog_moderator_read
on public.creative_template_catalog for select to authenticated
using (public.is_community_moderator());
create policy community_post_likes_owner
on public.community_post_likes for select to authenticated
using (user_id = (select auth.uid()));
create policy community_post_saves_owner
on public.community_post_saves for select to authenticated
using (user_id = (select auth.uid()));
create policy community_post_reports_owner_or_moderator
on public.community_post_reports for select to authenticated
using (reporter_user_id = (select auth.uid()) or public.is_community_moderator());
create policy community_moderation_events_author_or_moderator
on public.community_moderation_events for select to authenticated
using (
  public.is_community_moderator()
  or exists (
    select 1 from public.community_posts p
    join public.public_creator_profiles pp on pp.id = p.author_profile_id
    where p.id = post_id and pp.user_id = (select auth.uid())
  )
);
create policy community_reuse_provenance_owner
on public.community_reuse_provenance for select to authenticated
using (user_id = (select auth.uid()));

-- Views públicas deliberadamente não projetam user_id, snapshots privados,
-- eventos de moderação, saves ou denúncias.
create view public.public_creator_directory
with (security_invoker = false, security_barrier = true)
as
select id, handle, display_name, bio, avatar_url, created_at
from public.public_creator_profiles
where is_active;

create view public.community_library
with (security_invoker = false, security_barrier = true)
as
select
  p.id, p.slug, p.published_at,
  s.title, s.summary, s.usage_notes, s.niches, s.tags,
  s.creative_type, s.format, s.platform, s.objective, s.snapshot,
  s.version, pp.id as author_profile_id, pp.handle as author_handle,
  pp.display_name as author_display_name, pp.avatar_url as author_avatar_url,
  count(distinct l.user_id)::bigint as like_count,
  count(distinct r.id)::bigint as reuse_count
from public.community_posts p
join public.community_submissions s on s.id = p.current_submission_id
join public.public_creator_profiles pp on pp.id = p.author_profile_id and pp.is_active
left join public.community_post_likes l on l.post_id = p.id
left join public.community_reuse_provenance r on r.source_post_id = p.id
where p.editorial_status = 'approved' and p.withdrawn_at is null
  and s.editorial_status = 'approved'
group by p.id, s.id, pp.id;

create view public.public_template_catalog
with (security_invoker = false, security_barrier = true)
as
select
  id, template_key, version, origin, community_post_id, title, summary,
  creative_type, format, platform, objective, niches, tags, schema_version,
  template_json, performance_status, created_at
from public.creative_template_catalog
where editorial_status = 'approved' and active;

revoke all on public.public_creator_directory from public;
revoke all on public.community_library from public;
revoke all on public.public_template_catalog from public;
grant select on public.public_creator_directory to anon, authenticated;
grant select on public.community_library to anon, authenticated;
grant select on public.public_template_catalog to anon, authenticated;

create or replace function public.submit_community_content(
  p_source_content_version_id uuid,
  p_title text,
  p_summary text,
  p_usage_notes text,
  p_niches text[],
  p_tags text[],
  p_creative_type text,
  p_format text,
  p_platform text,
  p_objective text,
  p_rights_confirmed boolean,
  p_adaptation_license_accepted boolean,
  p_post_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  profile_id uuid;
  source_version public.content_versions%rowtype;
  source_plan public.content_plans%rowtype;
  target_post public.community_posts%rowtype;
  next_version integer;
  submission_id uuid;
  clean_title text := btrim(p_title);
  generated_slug text;
begin
  if actor is null then
    raise exception using errcode = '28000', message = 'authentication required';
  end if;
  if not coalesce(p_rights_confirmed, false)
     or not coalesce(p_adaptation_license_accepted, false) then
    raise exception using errcode = '22023', message = 'rights and adaptation license are required';
  end if;
  if length(clean_title) not between 8 and 140
     or length(btrim(p_summary)) not between 20 and 500
     or coalesce(cardinality(p_niches), 0) > 8
     or coalesce(cardinality(p_tags), 0) > 12 then
    raise exception using errcode = '22023', message = 'invalid publication metadata';
  end if;
  if exists (
    select 1 from unnest(coalesce(p_niches, '{}') || coalesce(p_tags, '{}')) item
    where length(btrim(item)) not between 1 and 50
  ) then
    raise exception using errcode = '22023', message = 'invalid publication tags';
  end if;
  if (
    select count(*) from public.community_submissions
    where author_user_id = actor and submitted_at >= now() - interval '24 hours'
  ) >= 5 then
    raise exception using errcode = 'P0001', message = 'daily submission limit reached';
  end if;

  select * into source_version
  from public.content_versions
  where id = p_source_content_version_id and user_id = actor
    and approval_idempotency_key is not null;
  if not found then
    raise exception using errcode = 'P0002', message = 'approved content version not found';
  end if;
  select * into source_plan
  from public.content_plans
  where id = source_version.content_plan_id and user_id = actor;
  if not found then
    raise exception using errcode = 'P0002', message = 'content plan not found';
  end if;
  select id into profile_id
  from public.public_creator_profiles
  where user_id = actor and is_active;
  if profile_id is null then
    raise exception using errcode = 'P0002', message = 'active public profile required';
  end if;

  if p_post_id is null then
    generated_slug :=
      coalesce(
        nullif(trim(both '-' from regexp_replace(lower(clean_title), '[^a-z0-9]+', '-', 'g')), ''),
        'roteiro'
      ) || '-' || substr(md5(gen_random_uuid()::text), 1, 8);
    insert into public.community_posts(author_profile_id, slug, editorial_status)
    values (profile_id, generated_slug, 'pending')
    returning * into target_post;
    next_version := 1;
  else
    select p.* into target_post
    from public.community_posts p
    join public.public_creator_profiles pp on pp.id = p.author_profile_id
    where p.id = p_post_id and pp.user_id = actor
    for update of p;
    if not found or target_post.editorial_status = 'withdrawn' then
      raise exception using errcode = 'P0002', message = 'community post not found';
    end if;
    if exists (
      select 1 from public.community_submissions
      where post_id = p_post_id and editorial_status = 'pending'
    ) then
      raise exception using errcode = '23505', message = 'post already has a pending submission';
    end if;
    select coalesce(max(version), 0) + 1 into next_version
    from public.community_submissions where post_id = p_post_id;
  end if;

  insert into public.community_submissions(
    post_id, author_user_id, version,
    source_content_plan_id, source_content_version_id,
    title, summary, usage_notes, niches, tags,
    creative_type, format, platform, objective, snapshot,
    rights_confirmed, adaptation_license_accepted
  ) values (
    target_post.id, actor, next_version,
    source_plan.id, source_version.id,
    clean_title, btrim(p_summary), nullif(btrim(p_usage_notes), ''),
    coalesce(p_niches, '{}'), coalesce(p_tags, '{}'),
    btrim(p_creative_type), btrim(p_format), btrim(p_platform), btrim(p_objective),
    public.sanitize_community_snapshot(source_version.payload),
    true, true
  ) returning id into submission_id;

  -- Uma edição não remove a versão pública anterior enquanto aguarda revisão.
  if target_post.current_submission_id is null then
    update public.community_posts
    set editorial_status = 'pending', updated_at = now()
    where id = target_post.id;
  end if;
  insert into public.community_moderation_events(
    post_id, submission_id, actor_user_id, action
  ) values (target_post.id, submission_id, actor, 'submitted');

  return jsonb_build_object(
    'post_id', target_post.id,
    'submission_id', submission_id,
    'version', next_version,
    'status', 'pending'
  );
end;
$$;

create or replace function public.moderate_community_submission(
  p_submission_id uuid,
  p_decision public.community_editorial_status,
  p_reason text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  candidate public.community_submissions%rowtype;
  post_row public.community_posts%rowtype;
  template_id uuid;
  template_version integer;
  event_action public.moderation_action;
begin
  if actor is null or not public.is_community_moderator(actor) then
    raise exception using errcode = '42501', message = 'moderator role required';
  end if;
  if p_decision not in ('approved', 'rejected', 'changes_requested') then
    raise exception using errcode = '22023', message = 'invalid moderation decision';
  end if;
  if p_decision <> 'approved' and length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception using errcode = '22023', message = 'moderation reason required';
  end if;

  select * into candidate from public.community_submissions
  where id = p_submission_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'submission not found';
  end if;
  if candidate.author_user_id = actor then
    raise exception using errcode = '42501', message = 'authors cannot moderate their own submission';
  end if;
  if candidate.editorial_status = p_decision then
    select id into template_id from public.creative_template_catalog
    where community_submission_id = candidate.id;
    return jsonb_build_object(
      'post_id', candidate.post_id, 'submission_id', candidate.id,
      'status', p_decision, 'template_id', template_id, 'idempotent_replay', true
    );
  end if;
  if candidate.editorial_status <> 'pending' then
    raise exception using errcode = '22023', message = 'submission is not pending';
  end if;

  select * into post_row from public.community_posts
  where id = candidate.post_id for update;
  update public.community_submissions set
    editorial_status = p_decision,
    reviewed_at = now(), reviewed_by = actor,
    moderation_reason = nullif(btrim(p_reason), '')
  where id = candidate.id;

  if p_decision = 'approved' then
    update public.community_posts set
      editorial_status = 'approved',
      current_submission_id = candidate.id,
      published_at = coalesce(published_at, now()),
      withdrawn_at = null,
      updated_at = now()
    where id = candidate.post_id;

    select coalesce(max(version), 0) + 1 into template_version
    from public.creative_template_catalog
    where template_key = 'community:' || candidate.post_id::text;
    insert into public.creative_template_catalog(
      template_key, version, origin, community_post_id, community_submission_id,
      title, summary, creative_type, format, platform, objective,
      niches, tags, template_json
    ) values (
      'community:' || candidate.post_id::text, template_version, 'community',
      candidate.post_id, candidate.id, candidate.title, candidate.summary,
      candidate.creative_type, candidate.format, candidate.platform,
      candidate.objective, candidate.niches, candidate.tags, candidate.snapshot
    ) returning id into template_id;
    update public.creative_template_catalog
    set active = false
    where template_key = 'community:' || candidate.post_id::text
      and id <> template_id;
    event_action := 'approved';
  elsif p_decision = 'rejected' then
    if post_row.current_submission_id is null then
      update public.community_posts set editorial_status = 'rejected', updated_at = now()
      where id = candidate.post_id;
    end if;
    event_action := 'rejected';
  else
    if post_row.current_submission_id is null then
      update public.community_posts set editorial_status = 'changes_requested', updated_at = now()
      where id = candidate.post_id;
    end if;
    event_action := 'changes_requested';
  end if;

  insert into public.community_moderation_events(
    post_id, submission_id, actor_user_id, action, reason
  ) values (candidate.post_id, candidate.id, actor, event_action, nullif(btrim(p_reason), ''));
  return jsonb_build_object(
    'post_id', candidate.post_id, 'submission_id', candidate.id,
    'status', p_decision, 'template_id', template_id, 'idempotent_replay', false
  );
end;
$$;

create or replace function public.withdraw_community_post(p_post_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare actor uuid := auth.uid(); affected integer;
begin
  if actor is null then raise exception using errcode = '28000', message = 'authentication required'; end if;
  update public.community_posts p set
    editorial_status = 'withdrawn', withdrawn_at = now(), updated_at = now()
  from public.public_creator_profiles pp
  where p.id = p_post_id and pp.id = p.author_profile_id and pp.user_id = actor
    and p.editorial_status <> 'withdrawn';
  get diagnostics affected = row_count;
  if affected = 0 and not exists (
    select 1 from public.community_posts p
    join public.public_creator_profiles pp on pp.id = p.author_profile_id
    where p.id = p_post_id and pp.user_id = actor and p.editorial_status = 'withdrawn'
  ) then raise exception using errcode = 'P0002', message = 'community post not found'; end if;
  update public.creative_template_catalog set active = false
  where community_post_id = p_post_id and active;
  if affected > 0 then
    insert into public.community_moderation_events(post_id, actor_user_id, action)
    values (p_post_id, actor, 'withdrawn');
  end if;
  return jsonb_build_object('post_id', p_post_id, 'status', 'withdrawn', 'idempotent_replay', affected = 0);
end;
$$;

create or replace function public.toggle_community_like(p_post_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare actor uuid := auth.uid();
begin
  if actor is null then raise exception using errcode='28000',message='authentication required'; end if;
  if not exists (select 1 from public.community_posts where id=p_post_id and editorial_status='approved' and withdrawn_at is null)
  then raise exception using errcode='P0002',message='public post not found'; end if;
  delete from public.community_post_likes where post_id=p_post_id and user_id=actor;
  if found then return false; end if;
  insert into public.community_post_likes(post_id,user_id) values(p_post_id,actor);
  return true;
end; $$;

create or replace function public.toggle_community_save(p_post_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare actor uuid := auth.uid();
begin
  if actor is null then raise exception using errcode='28000',message='authentication required'; end if;
  if not exists (select 1 from public.community_posts where id=p_post_id and editorial_status='approved' and withdrawn_at is null)
  then raise exception using errcode='P0002',message='public post not found'; end if;
  delete from public.community_post_saves where post_id=p_post_id and user_id=actor;
  if found then return false; end if;
  insert into public.community_post_saves(post_id,user_id) values(p_post_id,actor);
  return true;
end; $$;

create or replace function public.report_community_post(p_post_id uuid, p_reason text, p_details text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare actor uuid:=auth.uid(); report_id uuid;
begin
  if actor is null then raise exception using errcode='28000',message='authentication required'; end if;
  if p_reason not in ('copyright','unsafe','spam','misleading','other') or length(coalesce(p_details,''))>1000
  then raise exception using errcode='22023',message='invalid report'; end if;
  if not exists(select 1 from public.community_posts where id=p_post_id and editorial_status='approved' and withdrawn_at is null)
  then raise exception using errcode='P0002',message='public post not found'; end if;
  insert into public.community_post_reports(post_id,reporter_user_id,reason,details)
  values(p_post_id,actor,p_reason,nullif(btrim(p_details),''))
  on conflict(post_id,reporter_user_id) do update set reason=excluded.reason,details=excluded.details,status='open',created_at=now()
  returning id into report_id;
  return report_id;
end; $$;

create or replace function public.create_private_community_adaptation(
  p_post_id uuid,
  p_template_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid:=auth.uid();
  template_row public.creative_template_catalog%rowtype;
  plan_id uuid;
  provenance_id uuid;
begin
  if actor is null then raise exception using errcode='28000',message='authentication required'; end if;
  select * into template_row from public.creative_template_catalog
  where id=p_template_id and community_post_id=p_post_id
    and editorial_status='approved' and active;
  if not found then raise exception using errcode='P0002',message='approved template not found'; end if;
  insert into public.content_plans(user_id,platform,title,objective,format,status,payload)
  values(
    actor,
    case when template_row.platform in ('instagram','tiktok') then template_row.platform else 'instagram' end,
    'Adaptação: '||template_row.title, template_row.objective, template_row.format, 'idea',
    jsonb_build_object(
      'adaptation_status','pending_ai',
      'source',jsonb_build_object(
        'community_post_id',p_post_id,'template_id',template_row.id,
        'template_version',template_row.version
      )
    )
  ) returning id into plan_id;
  insert into public.community_reuse_provenance(
    user_id,source_post_id,source_template_id,source_template_version,target_content_plan_id
  ) values(actor,p_post_id,template_row.id,template_row.version,plan_id)
  returning id into provenance_id;
  return jsonb_build_object(
    'content_plan_id',plan_id,'provenance_id',provenance_id,
    'adaptation_status','pending_ai'
  );
end; $$;

revoke all on function public.submit_community_content(uuid,text,text,text,text[],text[],text,text,text,text,boolean,boolean,uuid) from public, anon;
revoke all on function public.moderate_community_submission(uuid,public.community_editorial_status,text) from public, anon;
revoke all on function public.withdraw_community_post(uuid) from public, anon;
revoke all on function public.toggle_community_like(uuid) from public, anon;
revoke all on function public.toggle_community_save(uuid) from public, anon;
revoke all on function public.report_community_post(uuid,text,text) from public, anon;
revoke all on function public.create_private_community_adaptation(uuid,uuid) from public, anon;
grant execute on function public.submit_community_content(uuid,text,text,text,text[],text[],text,text,text,text,boolean,boolean,uuid) to authenticated;
grant execute on function public.moderate_community_submission(uuid,public.community_editorial_status,text) to authenticated;
grant execute on function public.withdraw_community_post(uuid) to authenticated;
grant execute on function public.toggle_community_like(uuid) to authenticated;
grant execute on function public.toggle_community_save(uuid) to authenticated;
grant execute on function public.report_community_post(uuid,text,text) to authenticated;
grant execute on function public.create_private_community_adaptation(uuid,uuid) to authenticated;

-- Staff só pode ser provisionado por service_role/postgres.
revoke all on public.community_staff_roles from anon, authenticated;
revoke insert, update, delete on public.creative_template_catalog from anon, authenticated;
revoke insert, update, delete on public.community_posts from anon, authenticated;
revoke insert, update, delete on public.community_submissions from anon, authenticated;
revoke insert, update, delete on public.community_moderation_events from anon, authenticated;
revoke insert, update, delete on public.community_reuse_provenance from anon, authenticated;





-- Hardening de retries: estado desejado e chaves idempotentes.
alter table public.community_submissions add column submission_idempotency_key text, add column submission_request_hash text;
create unique index community_submission_idempotency_idx on public.community_submissions(author_user_id,submission_idempotency_key) where submission_idempotency_key is not null;
alter table public.community_reuse_provenance add column idempotency_key text, add column adaptation_request_hash text;
create unique index community_adaptation_idempotency_idx on public.community_reuse_provenance(user_id,idempotency_key) where idempotency_key is not null;

create or replace function public.set_community_like(p_post_id uuid,p_active boolean) returns boolean language plpgsql security definer set search_path=public as $$
declare actor uuid:=auth.uid(); begin
 if actor is null then raise exception using errcode='28000',message='authentication required'; end if;
 if p_active is null then raise exception using errcode='22023',message='active state is required'; end if;
 if not exists(select 1 from public.community_posts where id=p_post_id and editorial_status='approved' and withdrawn_at is null) then raise exception using errcode='P0002',message='public post not found'; end if;
 if p_active then insert into public.community_post_likes(post_id,user_id) values(p_post_id,actor) on conflict(post_id,user_id) do nothing;
 else delete from public.community_post_likes where post_id=p_post_id and user_id=actor; end if;
 return p_active;
end; $$;
create or replace function public.set_community_save(p_post_id uuid,p_active boolean) returns boolean language plpgsql security definer set search_path=public as $$
declare actor uuid:=auth.uid(); begin
 if actor is null then raise exception using errcode='28000',message='authentication required'; end if;
 if p_active is null then raise exception using errcode='22023',message='active state is required'; end if;
 if not exists(select 1 from public.community_posts where id=p_post_id and editorial_status='approved' and withdrawn_at is null) then raise exception using errcode='P0002',message='public post not found'; end if;
 if p_active then insert into public.community_post_saves(post_id,user_id) values(p_post_id,actor) on conflict(post_id,user_id) do nothing;
 else delete from public.community_post_saves where post_id=p_post_id and user_id=actor; end if;
 return p_active;
end; $$;

create or replace function public.submit_community_content(p_source_content_version_id uuid,p_title text,p_summary text,p_usage_notes text,p_niches text[],p_tags text[],p_creative_type text,p_format text,p_platform text,p_objective text,p_rights_confirmed boolean,p_adaptation_license_accepted boolean,p_post_id uuid,p_idempotency_key text) returns jsonb language plpgsql security definer set search_path=public as $$
declare actor uuid:=auth.uid(); prior public.community_submissions%rowtype; result jsonb; fingerprint text;
begin
 if actor is null then raise exception using errcode='28000',message='authentication required'; end if;
 if p_idempotency_key is null or length(p_idempotency_key) not between 8 and 200 or p_idempotency_key !~ '^[A-Za-z0-9:_-]+$' then raise exception using errcode='22023',message='invalid idempotency key'; end if;
 fingerprint:=md5(p_source_content_version_id::text||':'||coalesce(p_post_id::text,'')||':'||coalesce(p_title,'')||':'||coalesce(p_summary,'')||':'||coalesce(p_usage_notes,'')||':'||coalesce(p_niches,'{}')::text||':'||coalesce(p_tags,'{}')::text||':'||coalesce(p_creative_type,'')||':'||coalesce(p_format,'')||':'||coalesce(p_platform,'')||':'||coalesce(p_objective,'')||':'||coalesce(p_rights_confirmed,false)::text||':'||coalesce(p_adaptation_license_accepted,false)::text);
 select * into prior from public.community_submissions where author_user_id=actor and submission_idempotency_key=p_idempotency_key;
 if found then
  if prior.submission_request_hash<>fingerprint then raise exception using errcode='22023',message='idempotency key reused with different request'; end if;
  return jsonb_build_object('post_id',prior.post_id,'submission_id',prior.id,'version',prior.version,'status',prior.editorial_status,'idempotent_replay',true);
 end if;
 result:=public.submit_community_content(p_source_content_version_id,p_title,p_summary,p_usage_notes,p_niches,p_tags,p_creative_type,p_format,p_platform,p_objective,p_rights_confirmed,p_adaptation_license_accepted,p_post_id);
 update public.community_submissions set submission_idempotency_key=p_idempotency_key,submission_request_hash=fingerprint where id=(result->>'submission_id')::uuid and author_user_id=actor;
 return result||jsonb_build_object('idempotent_replay',false);
end; $$;

create or replace function public.create_private_community_adaptation(p_post_id uuid,p_template_id uuid,p_idempotency_key text) returns jsonb language plpgsql security definer set search_path=public as $$
declare actor uuid:=auth.uid(); prior public.community_reuse_provenance%rowtype; result jsonb; fingerprint text:=md5(p_post_id::text||':'||p_template_id::text);
begin
 if actor is null then raise exception using errcode='28000',message='authentication required'; end if;
 if p_idempotency_key is null or length(p_idempotency_key) not between 8 and 200 or p_idempotency_key !~ '^[A-Za-z0-9:_-]+$' then raise exception using errcode='22023',message='invalid idempotency key'; end if;
 select * into prior from public.community_reuse_provenance where user_id=actor and idempotency_key=p_idempotency_key;
 if found then
  if prior.adaptation_request_hash<>fingerprint then raise exception using errcode='22023',message='idempotency key reused with different source'; end if;
  return jsonb_build_object('content_plan_id',prior.target_content_plan_id,'provenance_id',prior.id,'adaptation_status','pending_ai','idempotent_replay',true);
 end if;
 result:=public.create_private_community_adaptation(p_post_id,p_template_id);
 update public.community_reuse_provenance set idempotency_key=p_idempotency_key,adaptation_request_hash=fingerprint where id=(result->>'provenance_id')::uuid and user_id=actor;
 return result||jsonb_build_object('idempotent_replay',false);
end; $$;
revoke all on function public.set_community_like(uuid,boolean) from public,anon;
revoke all on function public.set_community_save(uuid,boolean) from public,anon;
revoke all on function public.submit_community_content(uuid,text,text,text,text[],text[],text,text,text,text,boolean,boolean,uuid,text) from public,anon;
revoke all on function public.create_private_community_adaptation(uuid,uuid,text) from public,anon;
grant execute on function public.set_community_like(uuid,boolean) to authenticated;
grant execute on function public.set_community_save(uuid,boolean) to authenticated;
grant execute on function public.submit_community_content(uuid,text,text,text,text[],text[],text,text,text,text,boolean,boolean,uuid,text) to authenticated;
grant execute on function public.create_private_community_adaptation(uuid,uuid,text) to authenticated;

-- Feature flags server-side: fail closed e administração exclusiva por service_role.
create table public.community_feature_flags(
  name text primary key check(name in ('read','submissions','interactions','adaptation')),
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
insert into public.community_feature_flags(name) values ('read'),('submissions'),('interactions'),('adaptation');
alter table public.community_feature_flags enable row level security;
revoke all on public.community_feature_flags from anon,authenticated;
create or replace function public.community_feature_enabled(p_name text) returns boolean language sql stable security definer set search_path=public as $$
 select coalesce((select enabled from public.community_feature_flags where name=p_name),false);
$$;
revoke all on function public.community_feature_enabled(text) from public,anon,authenticated;

create or replace view public.public_creator_directory with (security_invoker=false,security_barrier=true) as
select id,handle,display_name,bio,avatar_url,created_at from public.public_creator_profiles where is_active and public.community_feature_enabled('read');
create or replace view public.community_library with (security_invoker=false,security_barrier=true) as
select p.id,p.slug,p.published_at,s.title,s.summary,s.usage_notes,s.niches,s.tags,s.creative_type,s.format,s.platform,s.objective,s.snapshot,s.version,pp.id as author_profile_id,pp.handle as author_handle,pp.display_name as author_display_name,pp.avatar_url as author_avatar_url,count(distinct l.user_id)::bigint as like_count,count(distinct r.id)::bigint as reuse_count
from public.community_posts p join public.community_submissions s on s.id=p.current_submission_id join public.public_creator_profiles pp on pp.id=p.author_profile_id and pp.is_active left join public.community_post_likes l on l.post_id=p.id left join public.community_reuse_provenance r on r.source_post_id=p.id
where public.community_feature_enabled('read') and p.editorial_status='approved' and p.withdrawn_at is null and s.editorial_status='approved' group by p.id,s.id,pp.id;
create or replace view public.public_template_catalog with (security_invoker=false,security_barrier=true) as
select id,template_key,version,origin,community_post_id,title,summary,creative_type,format,platform,objective,niches,tags,schema_version,template_json,performance_status,created_at from public.creative_template_catalog where public.community_feature_enabled('read') and editorial_status='approved' and active;
grant select on public.public_creator_directory,public.community_library,public.public_template_catalog to anon,authenticated;

-- As assinaturas legadas mutáveis deixam de ser públicas: clientes devem usar
-- as variantes idempotentes abaixo.
revoke execute on function public.submit_community_content(uuid,text,text,text,text[],text[],text,text,text,text,boolean,boolean,uuid) from authenticated;
revoke execute on function public.toggle_community_like(uuid) from authenticated;
revoke execute on function public.toggle_community_save(uuid) from authenticated;
revoke execute on function public.create_private_community_adaptation(uuid,uuid) from authenticated;

create or replace function public.set_community_like(p_post_id uuid,p_active boolean) returns boolean language plpgsql security definer set search_path=public as $$
declare actor uuid:=auth.uid(); begin
 if actor is null then raise exception using errcode='28000',message='authentication required'; end if;
 if not public.community_feature_enabled('interactions') then raise exception using errcode='55000',message='community interactions disabled'; end if;
 if p_active is null then raise exception using errcode='22023',message='active state is required'; end if;
 if not exists(select 1 from public.community_posts where id=p_post_id and editorial_status='approved' and withdrawn_at is null) then raise exception using errcode='P0002',message='public post not found'; end if;
 if p_active then insert into public.community_post_likes(post_id,user_id) values(p_post_id,actor) on conflict(post_id,user_id) do nothing; else delete from public.community_post_likes where post_id=p_post_id and user_id=actor; end if; return p_active;
end; $$;
create or replace function public.set_community_save(p_post_id uuid,p_active boolean) returns boolean language plpgsql security definer set search_path=public as $$
declare actor uuid:=auth.uid(); begin
 if actor is null then raise exception using errcode='28000',message='authentication required'; end if;
 if not public.community_feature_enabled('interactions') then raise exception using errcode='55000',message='community interactions disabled'; end if;
 if p_active is null then raise exception using errcode='22023',message='active state is required'; end if;
 if not exists(select 1 from public.community_posts where id=p_post_id and editorial_status='approved' and withdrawn_at is null) then raise exception using errcode='P0002',message='public post not found'; end if;
 if p_active then insert into public.community_post_saves(post_id,user_id) values(p_post_id,actor) on conflict(post_id,user_id) do nothing; else delete from public.community_post_saves where post_id=p_post_id and user_id=actor; end if; return p_active;
end; $$;
create or replace function public.report_community_post(p_post_id uuid,p_reason text,p_details text default null) returns uuid language plpgsql security definer set search_path=public as $$
declare actor uuid:=auth.uid(); report_id uuid; begin
 if actor is null then raise exception using errcode='28000',message='authentication required'; end if;
 if not public.community_feature_enabled('interactions') then raise exception using errcode='55000',message='community interactions disabled'; end if;
 if p_reason not in ('copyright','unsafe','spam','misleading','other') or length(coalesce(p_details,''))>1000 then raise exception using errcode='22023',message='invalid report'; end if;
 if not exists(select 1 from public.community_posts where id=p_post_id and editorial_status='approved' and withdrawn_at is null) then raise exception using errcode='P0002',message='public post not found'; end if;
 insert into public.community_post_reports(post_id,reporter_user_id,reason,details) values(p_post_id,actor,p_reason,nullif(btrim(p_details),'')) on conflict(post_id,reporter_user_id) do update set reason=excluded.reason,details=excluded.details,status='open',created_at=now() returning id into report_id; return report_id;
end; $$;

-- Envelopes de flags sobre as RPCs idempotentes.
create or replace function public.submit_community_content_guarded(p_source_content_version_id uuid,p_title text,p_summary text,p_usage_notes text,p_niches text[],p_tags text[],p_creative_type text,p_format text,p_platform text,p_objective text,p_rights_confirmed boolean,p_adaptation_license_accepted boolean,p_post_id uuid,p_idempotency_key text) returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if not public.community_feature_enabled('submissions') then raise exception using errcode='55000',message='community submissions disabled'; end if;
 return public.submit_community_content(p_source_content_version_id,p_title,p_summary,p_usage_notes,p_niches,p_tags,p_creative_type,p_format,p_platform,p_objective,p_rights_confirmed,p_adaptation_license_accepted,p_post_id,p_idempotency_key);
end; $$;
create or replace function public.create_private_community_adaptation_guarded(p_post_id uuid,p_template_id uuid,p_idempotency_key text) returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if not public.community_feature_enabled('adaptation') then raise exception using errcode='55000',message='community adaptation disabled'; end if;
 return public.create_private_community_adaptation(p_post_id,p_template_id,p_idempotency_key);
end; $$;
revoke all on function public.submit_community_content(uuid,text,text,text,text[],text[],text,text,text,text,boolean,boolean,uuid,text) from authenticated;
revoke all on function public.create_private_community_adaptation(uuid,uuid,text) from authenticated;
revoke all on function public.submit_community_content_guarded(uuid,text,text,text,text[],text[],text,text,text,text,boolean,boolean,uuid,text) from public,anon;
revoke all on function public.create_private_community_adaptation_guarded(uuid,uuid,text) from public,anon;
grant execute on function public.submit_community_content_guarded(uuid,text,text,text,text[],text[],text,text,text,text,boolean,boolean,uuid,text) to authenticated;
grant execute on function public.create_private_community_adaptation_guarded(uuid,uuid,text) to authenticated;

-- Mantém os nomes públicos do contrato; implementações sem gate tornam-se internas.
alter function public.submit_community_content(uuid,text,text,text,text[],text[],text,text,text,text,boolean,boolean,uuid,text) rename to submit_community_content_internal;
alter function public.create_private_community_adaptation(uuid,uuid,text) rename to create_private_community_adaptation_internal;
create or replace function public.submit_community_content(p_source_content_version_id uuid,p_title text,p_summary text,p_usage_notes text,p_niches text[],p_tags text[],p_creative_type text,p_format text,p_platform text,p_objective text,p_rights_confirmed boolean,p_adaptation_license_accepted boolean,p_post_id uuid,p_idempotency_key text) returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if not public.community_feature_enabled('submissions') then raise exception using errcode='55000',message='community submissions disabled'; end if;
 return public.submit_community_content_internal(p_source_content_version_id,p_title,p_summary,p_usage_notes,p_niches,p_tags,p_creative_type,p_format,p_platform,p_objective,p_rights_confirmed,p_adaptation_license_accepted,p_post_id,p_idempotency_key);
end; $$;
create or replace function public.create_private_community_adaptation(p_post_id uuid,p_template_id uuid,p_idempotency_key text) returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if not public.community_feature_enabled('adaptation') then raise exception using errcode='55000',message='community adaptation disabled'; end if;
 return public.create_private_community_adaptation_internal(p_post_id,p_template_id,p_idempotency_key);
end; $$;
drop function public.submit_community_content_guarded(uuid,text,text,text,text[],text[],text,text,text,text,boolean,boolean,uuid,text);
drop function public.create_private_community_adaptation_guarded(uuid,uuid,text);
revoke all on function public.submit_community_content_internal(uuid,text,text,text,text[],text[],text,text,text,text,boolean,boolean,uuid,text) from public,anon,authenticated;
revoke all on function public.create_private_community_adaptation_internal(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.submit_community_content(uuid,text,text,text,text[],text[],text,text,text,text,boolean,boolean,uuid,text) from public,anon;
revoke all on function public.create_private_community_adaptation(uuid,uuid,text) from public,anon;
grant execute on function public.submit_community_content(uuid,text,text,text,text[],text[],text,text,text,text,boolean,boolean,uuid,text) to authenticated;
grant execute on function public.create_private_community_adaptation(uuid,uuid,text) to authenticated;

-- Ativação operacional (service_role/postgres, por ambiente):
-- update public.community_feature_flags set enabled=true,updated_at=now(),updated_by=<operator_uuid> where name='<flag>';


-- Leitura do estado booleano é pública; escrita da tabela permanece service-only.
grant execute on function public.community_feature_enabled(text) to anon,authenticated;

-- Adaptação unificada para templates oficiais e comunitários.
alter table public.community_reuse_provenance alter column source_post_id drop not null;
alter table public.community_reuse_provenance add column completion_result_hash text;
create or replace function public.start_template_adaptation(p_template_id uuid,p_community_post_id uuid default null,p_idempotency_key text default null) returns jsonb language plpgsql security definer set search_path=public as $$
declare actor uuid:=auth.uid(); template_row public.creative_template_catalog%rowtype; prior public.community_reuse_provenance%rowtype; plan_id uuid; provenance_id uuid; job_id uuid; fingerprint text:=md5(p_template_id::text||':'||coalesce(p_community_post_id::text,''));
begin
 if actor is null then raise exception using errcode='28000',message='authentication required'; end if;
 if not public.community_feature_enabled('adaptation') then raise exception using errcode='55000',message='community adaptation disabled'; end if;
 if p_idempotency_key is null or length(p_idempotency_key) not between 8 and 200 or p_idempotency_key !~ '^[A-Za-z0-9:_-]+$' then raise exception using errcode='22023',message='invalid idempotency key'; end if;
 select * into prior from public.community_reuse_provenance where user_id=actor and idempotency_key=p_idempotency_key;
 if found then if prior.adaptation_request_hash<>fingerprint then raise exception using errcode='22023',message='idempotency key reused with different source'; end if; return jsonb_build_object('content_plan_id',prior.target_content_plan_id,'provenance_id',prior.id,'ai_job_id',prior.ai_job_id,'adaptation_status','pending_ai','idempotent_replay',true); end if;
 select * into template_row from public.creative_template_catalog where id=p_template_id and editorial_status='approved' and active;
 if not found then raise exception using errcode='P0002',message='approved template not found'; end if;
 if template_row.origin='community' and (p_community_post_id is null or p_community_post_id<>template_row.community_post_id or not exists(select 1 from public.community_posts where id=p_community_post_id and editorial_status='approved' and withdrawn_at is null)) then raise exception using errcode='22023',message='community post does not match template'; end if;
 if template_row.origin='official' and p_community_post_id is not null then raise exception using errcode='22023',message='official template cannot reference community post'; end if;
 insert into public.content_plans(user_id,platform,title,objective,format,status,payload) values(actor,case when template_row.platform in('instagram','tiktok') then template_row.platform else 'instagram' end,'Adaptação: '||template_row.title,template_row.objective,template_row.format,'idea',jsonb_build_object('adaptation_status','pending_ai','source',jsonb_build_object('community_post_id',p_community_post_id,'template_id',template_row.id,'template_version',template_row.version))) returning id into plan_id;
 insert into public.community_reuse_provenance(user_id,source_post_id,source_template_id,source_template_version,target_content_plan_id,idempotency_key,adaptation_request_hash) values(actor,p_community_post_id,template_row.id,template_row.version,plan_id,p_idempotency_key,fingerprint) returning id into provenance_id;
 insert into public.ai_jobs(user_id,kind,status,payload,idempotency_key) values(actor,'content.adapt','queued',jsonb_build_object('provenance_id',provenance_id,'content_plan_id',plan_id,'template_id',template_row.id,'template_version',template_row.version,'community_post_id',p_community_post_id,'approved_template',template_row.template_json,'authorized_creator_context',jsonb_build_object('profile',(select context from public.profiles where user_id=actor),'preferences',coalesce((select jsonb_object_agg(category,value) from public.creator_preferences where user_id=actor),'{}'::jsonb))),'template-adapt:'||provenance_id::text) returning id into job_id;
 update public.community_reuse_provenance set ai_job_id=job_id where id=provenance_id;
 return jsonb_build_object('content_plan_id',plan_id,'provenance_id',provenance_id,'ai_job_id',job_id,'adaptation_status','pending_ai','idempotent_replay',false);
end; $$;
create or replace function public.complete_community_adaptation(p_ai_job_id uuid,p_result jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
declare job public.ai_jobs%rowtype; provenance public.community_reuse_provenance%rowtype; version_id uuid; next_version integer; result_hash text;
begin
 if p_result is null or jsonb_typeof(p_result)<>'object' or pg_column_size(p_result)>131072 then raise exception using errcode='22023',message='invalid adaptation result'; end if;
 result_hash:=md5(p_result::text);
 select * into job from public.ai_jobs where id=p_ai_job_id and kind='content.adapt' for update;
 if not found then raise exception using errcode='P0002',message='adaptation job not found'; end if;
 select * into provenance from public.community_reuse_provenance where ai_job_id=job.id and user_id=job.user_id and target_content_plan_id=(job.payload->>'content_plan_id')::uuid and id=(job.payload->>'provenance_id')::uuid for update;
 if not found then raise exception using errcode='P0002',message='adaptation provenance not found'; end if;
 if provenance.result_content_version_id is not null then if provenance.completion_result_hash<>result_hash then raise exception using errcode='22023',message='adaptation job replayed with different result'; end if; return jsonb_build_object('content_plan_id',provenance.target_content_plan_id,'provenance_id',provenance.id,'content_version_id',provenance.result_content_version_id,'idempotent_replay',true); end if;
 if job.status not in ('running','queued','waiting_retry') then raise exception using errcode='55000',message='adaptation job is not completable'; end if;
 select coalesce(max(version),0)+1 into next_version from public.content_versions where content_plan_id=provenance.target_content_plan_id;
 insert into public.content_versions(user_id,content_plan_id,version,payload) values(job.user_id,provenance.target_content_plan_id,next_version,p_result) returning id into version_id;
 update public.content_plans set status='review',payload=payload||jsonb_build_object('adaptation_status','completed','generated_version_id',version_id),updated_at=now() where id=provenance.target_content_plan_id and user_id=job.user_id;
 update public.community_reuse_provenance set result_content_version_id=version_id,completion_result_hash=result_hash where id=provenance.id;
 update public.ai_jobs set status='completed',result=jsonb_build_object('content_version_id',version_id,'content_plan_id',provenance.target_content_plan_id),progress=100,error_code=null,updated_at=now() where id=job.id;
 return jsonb_build_object('content_plan_id',provenance.target_content_plan_id,'provenance_id',provenance.id,'content_version_id',version_id,'idempotent_replay',false);
end; $$;
revoke execute on function public.create_private_community_adaptation(uuid,uuid,text) from authenticated;
revoke all on function public.start_template_adaptation(uuid,uuid,text) from public,anon;
grant execute on function public.start_template_adaptation(uuid,uuid,text) to authenticated;
revoke all on function public.complete_community_adaptation(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.complete_community_adaptation(uuid,jsonb) to service_role;


-- Contrato final de início: versão e briefing fazem parte da transação e do fingerprint.
create or replace function public.start_template_adaptation(p_template_id uuid,p_template_version integer,p_community_post_id uuid,p_adaptation_brief text,p_idempotency_key text) returns jsonb language plpgsql security definer set search_path=public as $$
declare actor uuid:=auth.uid(); template_row public.creative_template_catalog%rowtype; prior public.community_reuse_provenance%rowtype; plan_id uuid; provenance_id uuid; job_id uuid; clean_brief text:=btrim(p_adaptation_brief); fingerprint text;
begin
 if actor is null then raise exception using errcode='28000',message='authentication required'; end if;
 if not public.community_feature_enabled('adaptation') then raise exception using errcode='55000',message='community adaptation disabled'; end if;
 if p_template_version is null or p_template_version<1 then raise exception using errcode='22023',message='invalid template version'; end if;
 if length(clean_brief) not between 8 and 1000 then raise exception using errcode='22023',message='invalid adaptation brief'; end if;
 if p_idempotency_key is null or length(p_idempotency_key) not between 8 and 200 or p_idempotency_key !~ '^[A-Za-z0-9:_-]+$' then raise exception using errcode='22023',message='invalid idempotency key'; end if;
 fingerprint:=md5(p_template_id::text||':'||p_template_version::text||':'||coalesce(p_community_post_id::text,'')||':'||clean_brief);
 select * into prior from public.community_reuse_provenance where user_id=actor and idempotency_key=p_idempotency_key;
 if found then if prior.adaptation_request_hash<>fingerprint then raise exception using errcode='22023',message='idempotency key reused with different source'; end if; return jsonb_build_object('content_plan_id',prior.target_content_plan_id,'provenance_id',prior.id,'ai_job_id',prior.ai_job_id,'adaptation_status','pending_ai','idempotent_replay',true); end if;
 select * into template_row from public.creative_template_catalog where id=p_template_id and version=p_template_version and editorial_status='approved' and active;
 if not found then raise exception using errcode='P0002',message='approved template version not found'; end if;
 if template_row.origin='community' and (p_community_post_id is null or p_community_post_id<>template_row.community_post_id or not exists(select 1 from public.community_posts where id=p_community_post_id and editorial_status='approved' and withdrawn_at is null)) then raise exception using errcode='22023',message='community post does not match template'; end if;
 if template_row.origin='official' and p_community_post_id is not null then raise exception using errcode='22023',message='official template cannot reference community post'; end if;
 insert into public.content_plans(user_id,platform,title,objective,format,status,payload) values(actor,case when template_row.platform in('instagram','tiktok') then template_row.platform else 'instagram' end,'Adaptação: '||template_row.title,template_row.objective,template_row.format,'idea',jsonb_build_object('adaptation_status','pending_ai','source',jsonb_build_object('community_post_id',p_community_post_id,'template_id',template_row.id,'template_version',template_row.version))) returning id into plan_id;
 insert into public.community_reuse_provenance(user_id,source_post_id,source_template_id,source_template_version,target_content_plan_id,idempotency_key,adaptation_request_hash) values(actor,p_community_post_id,template_row.id,template_row.version,plan_id,p_idempotency_key,fingerprint) returning id into provenance_id;
 insert into public.ai_jobs(user_id,kind,status,payload,idempotency_key) values(actor,'content.adapt','queued',jsonb_build_object('provenance_id',provenance_id,'content_plan_id',plan_id,'template_id',template_row.id,'template_version',template_row.version,'community_post_id',p_community_post_id,'approved_template',template_row.template_json,'authorized_creator_context',jsonb_build_object('profile',(select context from public.profiles where user_id=actor),'preferences',coalesce((select jsonb_object_agg(category,value) from public.creator_preferences where user_id=actor),'{}'::jsonb)),'request',jsonb_build_object('adaptation_brief',clean_brief)),'template-adapt:'||provenance_id::text) returning id into job_id;
 update public.community_reuse_provenance set ai_job_id=job_id where id=provenance_id;
 return jsonb_build_object('content_plan_id',plan_id,'provenance_id',provenance_id,'ai_job_id',job_id,'adaptation_status','pending_ai','idempotent_replay',false);
end; $$;
revoke execute on function public.start_template_adaptation(uuid,uuid,text) from authenticated;
revoke all on function public.start_template_adaptation(uuid,integer,uuid,text,text) from public,anon;
grant execute on function public.start_template_adaptation(uuid,integer,uuid,text,text) to authenticated;

-- Tipos criativos são um contrato compartilhado entre banco, gateway e worker.
alter table public.community_submissions add constraint community_submissions_creative_type_canonical check (creative_type in ('advertising_image','instagram_carousel','short_video','tech_educational_video','ugc_ad','story_sequence','live_stream','newsletter')) not valid;
alter table public.community_submissions validate constraint community_submissions_creative_type_canonical;
alter table public.creative_template_catalog add constraint creative_template_catalog_creative_type_canonical check (creative_type in ('advertising_image','instagram_carousel','short_video','tech_educational_video','ugc_ad','story_sequence','live_stream','newsletter')) not valid;
alter table public.creative_template_catalog validate constraint creative_template_catalog_creative_type_canonical;
