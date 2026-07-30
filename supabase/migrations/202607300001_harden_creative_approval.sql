alter table public.content_versions add column if not exists approval_idempotency_key text, add column if not exists approval_request_hash text;
create unique index if not exists content_versions_approval_idempotency_idx on public.content_versions(user_id,approval_idempotency_key) where approval_idempotency_key is not null;

create or replace function public.approve_content_version(p_content_plan_id uuid,p_payload jsonb,p_scheduled_for timestamptz,p_remember_patterns boolean,p_idempotency_key text) returns jsonb language plpgsql security definer set search_path=public as $$
declare actor uuid:=auth.uid(); fmt text; n integer; vid uuid; jid uuid; old public.content_versions%rowtype; fingerprint text; total integer:=0; scene jsonb; pos integer:=0; arr jsonb;
begin
 if actor is null then raise exception using errcode='28000',message='authentication required'; end if;
 if p_idempotency_key is null or length(p_idempotency_key) not between 8 and 200 or p_idempotency_key !~ '^[A-Za-z0-9:_-]+$' then raise exception using errcode='22023',message='invalid idempotency key'; end if;
 if p_scheduled_for is null or p_payload is null or jsonb_typeof(p_payload)<>'object' or pg_column_size(p_payload)>65536 then raise exception using errcode='22023',message='invalid approval request'; end if;
 select format into fmt from public.content_plans where id=p_content_plan_id and user_id=actor for update;
 if not found then raise exception using errcode='P0002',message='content plan not found'; end if;
 fingerprint:=md5(p_content_plan_id::text||':'||p_payload::text||':'||p_scheduled_for::text||':'||coalesce(p_remember_patterns,false)::text);
 select * into old from public.content_versions where user_id=actor and approval_idempotency_key=p_idempotency_key;
 if found then
  if old.content_plan_id<>p_content_plan_id or old.approval_request_hash<>fingerprint then raise exception using errcode='22023',message='idempotency key reused with different request'; end if;
  select id into jid from public.ai_jobs where user_id=actor and idempotency_key='creative-memory:'||old.id::text;
  return jsonb_build_object('version',old.version,'version_id',old.id,'memory_job_id',jid,'idempotent_replay',true);
 end if;
 if jsonb_typeof(p_payload->'objective')<>'string' or length(btrim(p_payload->>'objective')) not between 8 and 500 or jsonb_typeof(p_payload->'caption')<>'string' or length(btrim(p_payload->>'caption')) not between 8 and 2200 or jsonb_typeof(p_payload->'cta')<>'string' or length(btrim(p_payload->>'cta')) not between 8 and 300 then raise exception using errcode='22023',message='invalid objective, caption or cta'; end if;
 if jsonb_typeof(p_payload->'hooks')<>'array' or jsonb_array_length(p_payload->'hooks')<>3 or exists(select 1 from jsonb_array_elements(p_payload->'hooks') x where jsonb_typeof(x)<>'string' or length(btrim(x#>>'{}')) not between 8 and 300) or (select count(distinct lower(btrim(x#>>'{}'))) from jsonb_array_elements(p_payload->'hooks') x)<>3 then raise exception using errcode='22023',message='invalid hooks'; end if;
 if jsonb_typeof(p_payload->'scenes')<>'array' or jsonb_array_length(p_payload->'scenes') not between 2 and 8 then raise exception using errcode='22023',message='invalid scenes'; end if;
 for scene in select value from jsonb_array_elements(p_payload->'scenes') loop
  pos:=pos+1;
  if jsonb_typeof(scene)<>'object' or coalesce((scene->>'order')~'^[0-9]+$',false)=false or (scene->>'order')::integer<>pos or jsonb_typeof(scene->'visual')<>'string' or length(btrim(scene->>'visual')) not between 8 and 500 or jsonb_typeof(scene->'speech')<>'string' or length(btrim(scene->>'speech')) not between 8 and 800 or coalesce((scene->>'duration_seconds')~'^[0-9]+$',false)=false or (scene->>'duration_seconds')::integer not between 2 and 20 then raise exception using errcode='22023',message='invalid scene'; end if;
  total:=total+(scene->>'duration_seconds')::integer;
 end loop;
 if fmt<>'carousel' and (total<15 or total>case when fmt='story' then 45 else 60 end) then raise exception using errcode='22023',message='invalid total duration'; end if;
 foreach arr in array array[p_payload->'capture_notes',p_payload->'editing_notes'] loop
  if jsonb_typeof(arr)<>'array' or jsonb_array_length(arr)>8 or exists(select 1 from jsonb_array_elements(arr) x where jsonb_typeof(x)<>'string' or length(btrim(x#>>'{}')) not between 8 and 500) then raise exception using errcode='22023',message='invalid production notes'; end if;
 end loop;
 if jsonb_typeof(p_payload->'hashtags')<>'array' or jsonb_array_length(p_payload->'hashtags')>10 or exists(select 1 from jsonb_array_elements(p_payload->'hashtags') x where jsonb_typeof(x)<>'string' or length(btrim(x#>>'{}')) not between 1 and 100) then raise exception using errcode='22023',message='invalid hashtags'; end if;
 select coalesce(max(version),0)+1 into n from public.content_versions where content_plan_id=p_content_plan_id;
 insert into public.content_versions(user_id,content_plan_id,version,payload,approval_idempotency_key,approval_request_hash) values(actor,p_content_plan_id,n,p_payload,p_idempotency_key,fingerprint) returning id into vid;
 update public.content_plans set status='scheduled',scheduled_for=p_scheduled_for,payload=payload||jsonb_build_object('confirmed_version',n),updated_at=now() where id=p_content_plan_id and user_id=actor;
 if coalesce(p_remember_patterns,false) then insert into public.ai_jobs(user_id,kind,payload,idempotency_key) values(actor,'memories.extract',jsonb_build_object('source_type','content_version','source_id',vid,'content_plan_id',p_content_plan_id,'excerpt',jsonb_build_object('instruction','Extraia somente padrões criativos reutilizáveis; não memorize o roteiro literal nem alegações de desempenho.','creative',p_payload)::text),'creative-memory:'||vid::text) returning id into jid; end if;
 return jsonb_build_object('version',n,'version_id',vid,'memory_job_id',jid,'idempotent_replay',false);
end;$$;

create or replace function public.approve_content_version(p_content_plan_id uuid,p_payload jsonb,p_scheduled_for timestamptz,p_remember_patterns boolean default true) returns jsonb language sql security definer set search_path=public as $$ select public.approve_content_version(p_content_plan_id,p_payload,p_scheduled_for,p_remember_patterns,'legacy:'||md5(p_content_plan_id::text||':'||coalesce(p_payload,'{}'::jsonb)::text||':'||p_scheduled_for::text||':'||coalesce(p_remember_patterns,false)::text)); $$;
revoke all on function public.approve_content_version(uuid,jsonb,timestamptz,boolean,text) from public,anon;
grant execute on function public.approve_content_version(uuid,jsonb,timestamptz,boolean,text) to authenticated;
