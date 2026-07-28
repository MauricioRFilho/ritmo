begin;

select plan(7);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data
) values
(
  '00000000-0000-0000-0000-000000000000',
  '11111111-1111-4111-8111-111111111111',
  'authenticated', 'authenticated', 'creator-a@ritmo.test', '',
  now(), now(), now(), '{}'::jsonb, '{"display_name":"Criador A"}'::jsonb
),
(
  '00000000-0000-0000-0000-000000000000',
  '22222222-2222-4222-8222-222222222222',
  'authenticated', 'authenticated', 'creator-b@ritmo.test', '',
  now(), now(), now(), '{}'::jsonb, '{"display_name":"Criador B"}'::jsonb
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '11111111-1111-4111-8111-111111111111',
  true
);

insert into public.audit_events (user_id, action)
values ('11111111-1111-4111-8111-111111111111', 'rls_test_a');

insert into public.content_plans (
  user_id, platform, title, status
) values (
  '11111111-1111-4111-8111-111111111111',
  'instagram',
  'Conteúdo privado A',
  'idea'
);

select is(
  (select count(*)::integer from public.audit_events),
  1,
  'creator A reads own audit event'
);

select is(
  (select count(*)::integer from public.content_plans),
  1,
  'creator A reads own content'
);

select set_config(
  'request.jwt.claim.sub',
  '22222222-2222-4222-8222-222222222222',
  true
);

select is(
  (select count(*)::integer from public.audit_events),
  0,
  'creator B cannot read audit event from creator A'
);

select is(
  (select count(*)::integer from public.content_plans),
  0,
  'creator B cannot read content from creator A'
);

select lives_ok(
  $$
    update public.content_plans
    set title = 'Tentativa de alteração'
    where user_id = '11111111-1111-4111-8111-111111111111'
  $$,
  'creator B update is safely filtered by RLS'
);

select set_config(
  'request.jwt.claim.sub',
  '11111111-1111-4111-8111-111111111111',
  true
);

select is(
  (
    select title from public.content_plans
    where user_id = '11111111-1111-4111-8111-111111111111'
  ),
  'Conteúdo privado A',
  'creator B did not change creator A content'
);

select set_config(
  'request.jwt.claim.sub',
  '22222222-2222-4222-8222-222222222222',
  true
);

select throws_ok(
  $$
    insert into public.audit_events (user_id, action)
    values ('11111111-1111-4111-8111-111111111111', 'forged')
  $$,
  '42501',
  'new row violates row-level security policy for table "audit_events"',
  'creator B cannot forge an audit event for creator A'
);

select * from finish();
rollback;
