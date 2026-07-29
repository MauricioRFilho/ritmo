create or replace function public.approve_content_version(
  p_content_plan_id uuid,
  p_payload jsonb,
  p_scheduled_for timestamptz,
  p_remember_patterns boolean default true
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  next_version integer;
  created_version_id uuid;
  memory_job_id uuid;
begin
  if actor is null then
    raise exception 'authentication required';
  end if;

  perform 1 from public.content_plans
   where id = p_content_plan_id and user_id = actor
   for update;
  if not found then
    raise exception 'content plan not found';
  end if;

  select coalesce(max(version), 0) + 1 into next_version
    from public.content_versions where content_plan_id = p_content_plan_id;

  insert into public.content_versions(user_id, content_plan_id, version, payload)
  values (actor, p_content_plan_id, next_version, p_payload)
  returning id into created_version_id;

  update public.content_plans
     set status = 'scheduled', scheduled_for = p_scheduled_for,
         payload = payload || jsonb_build_object('confirmed_version', next_version),
         updated_at = now()
   where id = p_content_plan_id and user_id = actor;

  if p_remember_patterns then
    insert into public.ai_jobs(user_id, kind, payload, idempotency_key)
    values (
      actor,
      'memories.extract',
      jsonb_build_object(
        'source_type', 'content_version',
        'source_id', created_version_id,
        'content_plan_id', p_content_plan_id,
        'excerpt', jsonb_build_object(
          'instruction', 'Extraia somente padrões criativos reutilizáveis; não memorize o roteiro literal nem alegações de desempenho.',
          'creative', p_payload
        )::text
      ),
      'creative-memory:' || created_version_id::text
    ) returning id into memory_job_id;
  end if;

  return jsonb_build_object(
    'version', next_version,
    'version_id', created_version_id,
    'memory_job_id', memory_job_id
  );
end;
$$;

revoke all on function public.approve_content_version(uuid, jsonb, timestamptz, boolean) from public;
revoke all on function public.approve_content_version(uuid, jsonb, timestamptz, boolean) from anon;
grant execute on function public.approve_content_version(uuid, jsonb, timestamptz, boolean) to authenticated;
